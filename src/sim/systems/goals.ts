// Long-term goals: the clocktower restoration board, megaprojects, museum donations,
// collection log, and the mailbox.
import { shortName } from '../../data/cookbook';
import { MEGAPROJECTS, MEGA_BY_ID, PROJECTS, PROJECT_BY_ID } from '../../data/goals';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { key, kDef, kId } from '../inventory';
import { PORT_HANDLERS } from '../ports';

export interface Letter {
  id: string;
  from: string;
  title: string;
  text: string;
  items?: { item: string; n: number }[];
  read: boolean;
  day: number;
}

export interface GoalSys {
  projects: Record<string, Record<string, number>>;
  doneProjects: string[];
  mega: string[];
  museum: string[];
  shipped: Record<string, number>;
  fish: Record<string, { n: number; max: number }>;
  found: string[];
  mail: Letter[];
}

export function goals(g: Game): GoalSys {
  if (!g.sys.goals) g.sys.goals = { projects: {}, doneProjects: [], mega: [], museum: [], shipped: {}, fish: {}, found: [], mail: [] } as GoalSys;
  return g.sys.goals;
}

// ---------------- restoration board ----------------
export function projectNeed(g: Game, pid: string, spec: string): number {
  const p = PROJECT_BY_ID.get(pid)!;
  const want = p.items.find((i) => i.item === spec)?.n ?? 0;
  return Math.max(0, want - (goals(g).projects[pid]?.[spec] ?? 0));
}

/** Donate as many of item k as useful to a project. Returns amount taken. */
export function donate(g: Game, pid: string, k: number, n: number): number {
  const gs = goals(g);
  if (gs.doneProjects.includes(pid)) return 0;
  const p = PROJECT_BY_ID.get(pid)!;
  const d = kDef(k);
  let taken = 0;
  for (const it of p.items) {
    if (!matchesSpec(d, it.item)) continue;
    const need = projectNeed(g, pid, it.item);
    const t = Math.min(need, n - taken);
    if (t <= 0) continue;
    gs.projects[pid] ??= {};
    gs.projects[pid][it.item] = (gs.projects[pid][it.item] ?? 0) + t;
    taken += t;
  }
  if (taken) {
    g.emit({ t: 'sfx', id: 'insert' });
    checkProject(g, pid);
  }
  return taken;
}

export function projectReady(g: Game, pid: string) {
  const p = PROJECT_BY_ID.get(pid)!;
  return p.items.every((i) => projectNeed(g, pid, i.item) <= 0);
}

function checkProject(g: Game, pid: string) {
  const gs = goals(g);
  const p = PROJECT_BY_ID.get(pid)!;
  if (!projectReady(g, pid) || gs.doneProjects.includes(pid)) return;
  if (p.money && g.player.money < p.money) {
    g.toast(`All items are in! ${p.name} also needs ${p.money} coins.`);
    return;
  }
  finishProject(g, pid);
}

export function payProject(g: Game, pid: string) {
  const p = PROJECT_BY_ID.get(pid)!;
  if (!projectReady(g, pid) || !p.money || g.player.money < p.money) return;
  g.player.money -= p.money;
  finishProject(g, pid);
}

function finishProject(g: Game, pid: string) {
  const gs = goals(g);
  const p = PROJECT_BY_ID.get(pid)!;
  gs.doneProjects.push(pid);
  for (const it of p.reward.items ?? []) g.give(key(it.item), it.n);
  if (p.reward.flag) g.flags.add(p.reward.flag);
  g.toast(`Restoration complete: ${p.name}! ${p.reward.text}`, undefined, 6);
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'fx', kind: 'magic', x: g.player.x, y: g.player.y - 1, n: 30 });
  g.count('projects');
  // completing an area
  const area = PROJECTS.filter((x) => x.area === p.area);
  if (area.every((x) => gs.doneProjects.includes(x.id))) {
    g.toast(`The ${p.area} restoration is finished! The town feels brighter.`, undefined, 6);
    g.flags.add('area_' + p.area.toLowerCase());
    if (p.area === 'Fields') g.player.maxEnergy += 30;
  }
  if (pid === 'p_clock') {
    send(g, 'clock', { from: 'tobias', title: 'The Clock Strikes!', text: 'For the first time in thirty years, the clocktower struck the hour this morning. The whole town gathered in the square. Thank you, from all of Thistlewick. Come see us. - Mayor Tobias Thistle' });
  }
}

// ---------------- megaprojects ----------------
export function megaStage(e: Ent) {
  const def = e.st.project ? MEGA_BY_ID.get(e.st.project) : null;
  if (!def) return null;
  return def.stages[e.st.stage] ?? null;
}

export function megaNeed(e: Ent, spec: string): number {
  const st = megaStage(e);
  if (!st) return 0;
  const want = st.items.find((i) => i.item === spec)?.n ?? 0;
  return Math.max(0, want - (e.st.delivered?.[spec] ?? 0));
}

function megaAccept(_g: Game, e: Ent, k: number): number {
  const st = megaStage(e);
  if (!st) return 0;
  const d = kDef(k);
  let room = 0;
  for (const it of st.items) if (matchesSpec(d, it.item)) room += megaNeed(e, it.item);
  return room;
}

function megaInsert(g: Game, e: Ent, k: number, n: number): number {
  const st = megaStage(e);
  if (!st) return 0;
  const d = kDef(k);
  let taken = 0;
  for (const it of st.items) {
    if (!matchesSpec(d, it.item)) continue;
    const t = Math.min(megaNeed(e, it.item), n - taken);
    if (t <= 0) continue;
    e.st.delivered ??= {};
    e.st.delivered[it.item] = (e.st.delivered[it.item] ?? 0) + t;
    taken += t;
  }
  if (taken) {
    g.stats.use(k, taken);
    if (st.items.every((i) => megaNeed(e, i.item) <= 0)) advanceMega(g, e);
  }
  return taken;
}

function advanceMega(g: Game, e: Ent) {
  const def = MEGA_BY_ID.get(e.st.project)!;
  e.st.stage++;
  e.st.delivered = {};
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'shake', amt: 0.3 });
  if (e.st.stage >= def.stages.length) {
    e.st.complete = true;
    goals(g).mega.push(def.id);
    applyMega(g);
    g.toast(`${def.name} is complete! ${def.reward}`, undefined, 6);
    g.emit({ t: 'ui', open: 'message', arg: { title: def.name, text: `After countless deliveries, the ${def.name} stands finished.\n\n${def.reward}`, icon: 'construction_site' } });
    g.count('megaprojects');
  } else g.toast(`${def.name}: stage "${def.stages[e.st.stage - 1].name}" complete!`);
}

export function applyMega(g: Game) {
  const done = goals(g).mega;
  g.sys.megaBonus = {
    machine: done.includes('m_orrery') ? 0.25 : 0,
    market: done.includes('m_skyship') ? 0.25 : 0,
    beacon: done.includes('m_beacon'),
  };
}

export function startMega(g: Game, e: Ent, id: string) {
  if (e.st.project) return;
  if (goals(g).mega.includes(id)) return;
  e.st.project = id;
  e.st.stage = 0;
  e.st.delivered = {};
  g.toast(`Construction begins: ${MEGA_BY_ID.get(id)!.name}!`);
}

PORT_HANDLERS.megaproject = { accept: megaAccept, insert: megaInsert, take: () => null };

// ---------------- museum & collections ----------------
export function museumAccepts(id: string) {
  const d = ITEM_BY_ID.get(id);
  return !!d && (d.cat === 'gem' || d.cat === 'mineral' || d.tags?.includes('relic'));
}
export const MUSEUM_TOTAL = ITEMS.filter((d) => museumAccepts(d.id)).length;
export const MUSEUM_REWARDS: [number, string, number][] = [
  [5, 'cherry_sapling', 1], [10, 'sprinkler_2', 4], [15, 'super_tonic', 20], [20, 'sword_3', 1], [25, 'starpetal_seed', 10],
];

export function donateMuseum(g: Game, id: string): boolean {
  const gs = goals(g);
  if (!museumAccepts(id) || gs.museum.includes(id)) return false;
  if (g.player.inv.removeSpec(id, 1).length === 0) return false;
  gs.museum.push(id);
  g.emit({ t: 'sfx', id: 'chime' });
  for (const [n, item, c] of MUSEUM_REWARDS) {
    if (gs.museum.length === n) {
      g.give(key(item), c);
      g.toast(`Sable is delighted: ${n} donations! You receive ${c} ${ITEM_BY_ID.get(item)!.name}.`);
    }
  }
  g.count('donations');
  return true;
}

// ---------------- mail ----------------
export function send(g: Game, id: string, l: { from: string; title: string; text: string; items?: { item: string; n: number }[] }) {
  const gs = goals(g);
  if (gs.mail.some((m) => m.id === id)) return;
  gs.mail.unshift({ id, from: l.from, title: l.title, text: l.text, items: l.items, read: false, day: g.dayIndex });
  if (gs.mail.length > 60) gs.mail.pop();
}

export function readMail(g: Game, m: Letter) {
  if (!m.read) {
    m.read = true;
    for (const it of m.items ?? []) g.give(key(it.item), it.n);
  }
}

function mailSend(g: Game, id: string, args: any) {
  if (id === 'smithy_done') send(g, 'smithy_' + g.dayIndex, { from: 'bram', title: 'Your tool is ready', text: `Finished your ${ITEM_BY_ID.get(args.tool)?.name}. It's in your bag. Treat it well. - Bram` });
  else if (id.startsWith('quest:')) {
    // quests already show as toasts; tutorial letters go in the mailbox for reference
    const from = args.from;
    send(g, id, { from, title: args.title, text: args.text });
  } else send(g, id, args);
}

function seasonalMail(g: Game) {
  const t = g.time;
  const SEAS = ['Spring', 'Summer', 'Fall', 'Winter'];
  if (t.day === 1) send(g, `season_${g.dayIndex}`, { from: 'marigold', title: `${SEAS[t.season]} has arrived!`, text: `New ${SEAS[t.season].toLowerCase()} seeds are on the shelves at the Mercantile. Out-of-season crops wither at the change of season, so plan ahead! - Marigold` });
  // festival reminder the day before
  const fest = g.sys.festivals?.list?.find?.((f: any) => f.season === t.season && f.day === t.day + 1);
  if (fest) send(g, `fest_${g.dayIndex}`, { from: fest.host, title: `${fest.name} is tomorrow!`, text: `${fest.desc} Come to the town square! - ${NPC_BY_ID.get(fest.host)?.name}` });
  // birthdays tomorrow
  for (const n of g.sys.npcs?.list ?? []) {
    const d = NPC_BY_ID.get(n.id)!;
    if (d.birthday.season === t.season && d.birthday.day === t.day + 1 && n.met) send(g, `bday_${n.id}_${t.year}`, { from: 'marigold', title: 'Psst!', text: `${shortName(d.name)}'s birthday is tomorrow. A thoughtful gift goes a long way! - Marigold` });
  }
  // occasional gifts from close friends
  for (const n of g.sys.npcs?.list ?? []) {
    if (n.points >= 1000 && g.rng.next() < 0.015) {
      const d = NPC_BY_ID.get(n.id)!;
      const love = d.gifts.love.filter((x) => x[0] !== '#' && ITEM_BY_ID.has(x));
      if (love.length) send(g, `gift_${n.id}_${g.dayIndex}`, { from: n.id, title: 'A little something', text: `I saw this and thought of you. - ${shortName(d.name)}`, items: [{ item: g.rng.pick(['cake', 'cookies', 'bread', 'tea', 'honey']), n: 1 }] });
    }
  }
}

registerSystem({
  name: 'goals',
  dayStart(g) {
    const gs = goals(g);
    g.sys.mail = { send: mailSend, unread: () => gs.mail.filter((m) => !m.read).length };
    g.sys.collections = {
      shipped: (gg: Game, k: number, n: number) => (gs.shipped[kId(k)] = (gs.shipped[kId(k)] ?? 0) + n),
      fish: (gg: Game, id: string, size: number) => {
        const f = (gs.fish[id] ??= { n: 0, max: 0 });
        f.n++;
        f.max = Math.max(f.max, size);
      },
      found: (gg: Game, k: number) => {
        const id = kId(k);
        if (!gs.found.includes(id)) gs.found.push(id);
      },
    };
    if (g.dayIndex === 0 && g.map.w > 100) {
      send(g, 'welcome', {
        from: 'tobias', title: 'Welcome to Thistlewick!',
        text: `Dear ${g.player.name},\n\nWelcome to ${g.player.farmName} Farm! The old place has been empty for years, so forgive the weeds. The townsfolk are eager to meet you; the town is just east across the bridge.\n\nI've left a few radish seeds and some coins to get you started.\n\nWarmly,\nMayor Tobias Thistle`,
        items: [{ item: 'radish_seed', n: 5 }],
      });
    }
    seasonalMail(g);
    applyMega(g);
  },
  save(g) {
    return goals(g);
  },
  load(g, d) {
    const gs = goals(g);
    Object.assign(gs, { projects: {}, doneProjects: [], mega: [], museum: [], shipped: {}, fish: {}, found: [], mail: [], ...d });
  },
  afterLoad(g) {
    applyMega(g);
  },
});

export { MEGAPROJECTS, PROJECTS };
