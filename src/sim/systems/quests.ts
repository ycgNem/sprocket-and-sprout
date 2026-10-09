// Quests: tutorial chain, story quests, daily town requests. Progress via notify() hooks + polling.
import { shortName } from '../../data/cookbook';
import { QUESTS, QUEST_BY_ID, REQUEST_POOL } from '../../data/goals';
import { ITEM_BY_ID, ITEMS, matchesSpec } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { STRUCT_BY_ID } from '../../data/structures';
import { RESEARCH_BY_ID } from '../../data/research';
import type { ObjectiveDef, QuestDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { key, kDef } from '../inventory';
import { addPoints, hearts, npcSys } from './npcs';

export interface ActiveQuest {
  id: string;
  prog: number[];
  day: number;
}

export interface Request {
  npc: string;
  item: string;
  n: number;
  text: string;
  reward: number;
  taken: boolean;
  done: boolean;
}

export interface QuestSys {
  active: ActiveQuest[];
  done: string[];
  requests: Request[];
  /** request quest currently accepted */
  current: number;
}

export function questSys(g: Game): QuestSys & Record<string, any> {
  if (!g.sys.quests) g.sys.quests = { active: [], done: [], requests: [], current: -1 };
  const q = g.sys.quests;
  q.notify = notify;
  q.tracker = tracker;
  q.tryDeliver = tryDeliver;
  return q;
}

export function questDef(id: string): QuestDef | null {
  if (id.startsWith('req:')) return null;
  return QUEST_BY_ID.get(id) ?? null;
}

function start(g: Game, def: QuestDef) {
  const q = questSys(g);
  if (q.done.includes(def.id) || q.active.some((a) => a.id === def.id)) return;
  q.active.push({ id: def.id, prog: def.objectives.map(() => 0), day: g.dayIndex });
  if (g.dayIndex > 0 || def.id !== 't_welcome') {
    g.toast(`New quest: ${def.title}`, undefined, 6);
    // a soft sting and a scroll unfurling over your head for a new quest; the fanfare is for finishing one
    g.emit({ t: 'sfx', id: 'chime', v: 0.7 });
    g.emit({ t: 'fx', kind: 'scroll', x: g.player.x, y: g.player.y - 2.1 });
  }
  g.sys.mail?.send?.(g, 'quest:' + def.id, { title: def.title, text: def.desc, from: def.giver });
  // some objectives may already be satisfied
  poll(g);
}

/** `bedtime`: the day is ending, so quests held back by `firstDayFrom` start now (and can complete) */
function startAvailable(g: Game, bedtime = false) {
  const q = questSys(g);
  for (const d of QUESTS) {
    if (q.done.includes(d.id) || q.active.some((a) => a.id === d.id)) continue;
    if (d.startDay !== undefined && g.dayIndex < d.startDay) continue;
    if (!bedtime && d.firstDayFrom !== undefined && g.dayIndex === 0 && g.time.min < d.firstDayFrom * 60) continue;
    if (d.needFlag && !g.flags.has(d.needFlag)) continue;
    // Sandbox has no quests; Clockwork Rush keeps only the opening tutorial
    if (g.mode === 'sandbox' || (g.mode === 'rush' && !d.tutorial)) continue;
    // at most three story quests at once; the rest wait their turn (tutorial steps don't count)
    if (d.startDay === undefined && !d.tutorial && q.active.filter((a) => !QUEST_BY_ID.get(a.id)?.tutorial).length >= 3) continue;
    // a prerequisite gated behind a flag this save doesn't have (e.g. the new opening) counts as met
    const met = (a: string) => q.done.includes(a) || (!!QUEST_BY_ID.get(a)?.needFlag && !g.flags.has(QUEST_BY_ID.get(a)!.needFlag!));
    if (d.after && !d.after.every(met)) continue;
    if (!d.after && d.startDay === undefined) continue;
    start(g, d);
  }
}

function objDone(g: Game, o: ObjectiveDef, prog: number): boolean {
  switch (o.t) {
    case 'have': return g.player.inv.countSpec(o.item) >= o.n;
    case 'money': return g.earned >= o.n;
    case 'friend':
      if (o.npc === '*') return npcSys(g).list.filter((n) => hearts(n) >= o.hearts).length >= 3;
      return hearts(npcSys(g).byId.get(o.npc)!) >= o.hearts;
    case 'produce': {
      let rate = 0;
      for (let i = 0; i < ITEMS.length; i++) if (matchesSpec(ITEMS[i], o.item)) rate += g.stats.rate(i, 0, 'prod');
      return rate >= o.perMin || prog > 0;
    }
    // things crafted before the quest started count if you still have them (in the bag or placed)
    case 'craft': return prog >= o.n || (!o.fresh && g.player.inv.countId(o.item) + g.ents.all().filter((e) => !e.ghost && e.def.item === o.item).length >= o.n);
    // structures placed before the quest started count too
    case 'build': return prog >= o.n || g.ents.all().filter((e) => !e.ghost && e.def.id === o.struct).length >= o.n;
    // "any topic" counts once one is being studied (a costly first pick must not stall the tutorial)
    case 'research': return o.id === '*' ? (g.counters.research ?? 0) >= 1 || !!g.research.current : g.research.done.has(o.id);
    case 'floor': return (g.sys.mine?.deepest ?? 0) >= o.n;
    // `met`: having already met them counts (you said hello before the quest asked)
    case 'talk': return prog >= 1 || (!!o.met && !!npcSys(g).byId.get(o.npc)?.met);
    case 'sleep':
    case 'visit':
      return prog >= 1;
    default:
      return prog >= ('n' in o ? o.n : 1);
  }
}

export function objText(g: Game, o: ObjectiveDef, prog: number): string {
  const item = (id: string) => (id[0] === '#' ? id.slice(1) + ' goods' : ITEM_BY_ID.get(id)?.name ?? id);
  switch (o.t) {
    case 'have': return `Have ${o.n} ${item(o.item)} (${Math.min(o.n, g.player.inv.countSpec(o.item))}/${o.n})`;
    case 'deliver': return `Bring ${o.n} ${item(o.item)} to ${shortName(NPC_BY_ID.get(o.to)?.name ?? '')}`;
    case 'ship': return `Ship ${o.n} ${item(o.item)} (${Math.min(prog, o.n)}/${o.n})`;
    case 'talk': return `Talk to ${shortName(NPC_BY_ID.get(o.npc)?.name ?? '')}`;
    case 'build': {
      // placed ones count, so show them (not just the ones built since the quest began)
      const placed = g.ents.all().filter((e) => !e.ghost && e.def.id === o.struct).length;
      return `Build ${o.n > 1 ? o.n + ' ' : 'a '}${STRUCT_BY_ID.get(o.struct)?.name} (${Math.min(Math.max(prog, placed), o.n)}/${o.n})`;
    }
    case 'craft': return `Craft ${o.n > 1 ? o.n + ' ' : 'a '}${item(o.item)}` + (o.fresh ? ` (${Math.min(prog, o.n)}/${o.n})` : '');
    case 'load': return `Load the ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct}`;
    case 'research': return o.id === '*' ? 'Start researching a topic' : `Research ${RESEARCH_BY_ID.get(o.id)?.name}`;
    case 'floor': return `Reach mine floor ${o.n} (${Math.min(o.n, g.sys.mine?.deepest ?? 0)}/${o.n})`;
    case 'catch': return `Catch ${o.n} fish (${Math.min(prog, o.n)}/${o.n})`;
    case 'till': return `Till ${o.n} soil (${Math.min(prog, o.n)}/${o.n})`;
    case 'plant': return `Plant ${o.n} seeds (${Math.min(prog, o.n)}/${o.n})`;
    case 'water': return `Water ${o.n} crops (${Math.min(prog, o.n)}/${o.n})`;
    case 'harvest': return `Harvest ${o.n} ${o.item ? item(o.item) : 'crops'} (${Math.min(prog, o.n)}/${o.n})`;
    case 'money': return `Earn ${o.n.toLocaleString()} coins (${Math.min(o.n, g.earned).toLocaleString()})`;
    case 'sleep': return 'Go to bed';
    case 'visit': return `Visit the ${o.loc}`;
    case 'friend': return o.npc === '*' ? `4 hearts with 3 villagers (${npcSys(g).list.filter((n) => hearts(n) >= o.hearts).length}/3)` : `${o.hearts} hearts with ${NPC_BY_ID.get(o.npc)?.name}`;
    case 'produce': return `Make ${item(o.item)} with machines`;
  }
}

function complete(g: Game, a: ActiveQuest) {
  const q = questSys(g);
  const def = QUEST_BY_ID.get(a.id)!;
  q.active = q.active.filter((x) => x !== a);
  q.done.push(a.id);
  g.flags.add('quest_done:' + a.id);
  const r = def.reward;
  if (r.money) {
    g.player.money += r.money;
    g.earned += r.money;
  }
  for (const it of r.items ?? []) g.give(key(it.item), it.n);
  if (r.flag) g.flags.add(r.flag);
  (q.today ??= []).push(def.title);
  if (r.friendship) {
    const n = npcSys(g).byId.get(r.friendship[0]);
    if (n) addPoints(g, n, r.friendship[1]);
  }
  const giver = npcSys(g).byId.get(def.giver);
  if (giver && !r.friendship) addPoints(g, giver, 40);
  // the play screen shows a banner, flies the reward in and plays the fanfare
  g.emit({ t: 'quest', title: def.title, money: r.money ?? 0, items: r.items ?? [] });
  g.count('quests');
  startAvailable(g);
}

export function poll(g: Game) {
  const q = questSys(g);
  for (const a of [...q.active]) {
    const def = QUEST_BY_ID.get(a.id);
    if (!def) continue;
    if (def.objectives.every((o, i) => objDone(g, o, a.prog[i]))) complete(g, a);
  }
}

function notify(g: Game, type: string, n: number, extra?: string) {
  const q = questSys(g);
  for (const a of q.active) {
    const def = QUEST_BY_ID.get(a.id);
    if (!def) continue;
    def.objectives.forEach((o, i) => {
      if (o.t !== type) return;
      switch (o.t) {
        case 'talk': if (extra === o.npc) a.prog[i] = 1; break;
        case 'harvest': if (!o.item || o.item === extra) a.prog[i] += n; break;
        case 'ship': if (o.item === extra || (o.item[0] === '#' && extra && matchesSpec(ITEM_BY_ID.get(extra)!, o.item))) a.prog[i] += n; break;
        case 'craft': if (o.item === extra) a.prog[i] += n; break;
        case 'load': if (o.struct === extra) a.prog[i] += n; break;
        case 'build': if (o.struct === extra) a.prog[i] += n; break;
        case 'catch': if (!o.fish || o.fish === extra) a.prog[i] += n; break;
        case 'till': case 'plant': case 'water': a.prog[i] += n; break;
        case 'sleep': a.prog[i] = 1; break;
        case 'visit': if (o.loc === extra) a.prog[i] = 1; break;
        default: break;
      }
    });
  }
  // requests progress is checked on delivery
  if (type !== 'have') poll(g);
}

function tracker(g: Game) {
  const q = questSys(g);
  const out: { title: string; lines: { text: string; done: boolean }[] }[] = [];
  const list = [...q.active].sort((a, b) => (QUEST_BY_ID.get(b.id)?.tutorial ? 1 : 0) - (QUEST_BY_ID.get(a.id)?.tutorial ? 1 : 0));
  for (const a of list) {
    const def = QUEST_BY_ID.get(a.id);
    if (!def) continue;
    out.push({ title: def.title, lines: def.objectives.map((o, i) => ({ text: objText(g, o, a.prog[i]), done: objDone(g, o, a.prog[i]) })) });
  }
  if (q.current >= 0 && q.requests[q.current] && !q.requests[q.current].done) {
    const r = q.requests[q.current];
    out.unshift({ title: `Request: ${shortName(NPC_BY_ID.get(r.npc)!.name)}`, lines: [{ text: `Bring ${r.n} ${ITEM_BY_ID.get(r.item)!.name} (${Math.min(r.n, g.player.inv.countId(r.item))}/${r.n})`, done: g.player.inv.countId(r.item) >= r.n }] });
  }
  return out;
}

// ---------------- requests ----------------
function rollRequests(g: Game) {
  const q = questSys(g);
  const pool = REQUEST_POOL.filter((r) => !r.seasons || r.seasons.includes(g.time.season));
  const keep = q.current >= 0 && q.requests[q.current] && !q.requests[q.current].done ? q.requests[q.current] : null;
  q.requests = keep ? [keep] : [];
  q.current = keep ? 0 : -1;
  const used = new Set<string>(keep ? [keep.npc] : []);
  for (let tries = 0; tries < 20 && q.requests.length < 3; tries++) {
    const r = g.rng.pick(pool);
    if (used.has(r.npc)) continue;
    used.add(r.npc);
    const price = ITEM_BY_ID.get(r.item)!.price;
    q.requests.push({ npc: r.npc, item: r.item, n: r.n, text: r.text, reward: Math.round(price * r.n * 2.2 + 120), taken: false, done: false });
  }
}

export function acceptRequest(g: Game, i: number) {
  const q = questSys(g);
  if (q.current >= 0 && q.requests[q.current] && !q.requests[q.current].done) return 'Finish your current request first.';
  q.current = i;
  q.requests[i].taken = true;
  g.emit({ t: 'sfx', id: 'quest' });
  return null;
}

function tryDeliver(g: Game, npcId: string, k: number): boolean {
  const q = questSys(g);
  const r = q.current >= 0 ? q.requests[q.current] : null;
  if (!r || r.done || r.npc !== npcId) return false;
  const d = kDef(k);
  if (d.id !== r.item) return false;
  if (g.player.inv.countId(r.item) < r.n) {
    g.toast(`${shortName(NPC_BY_ID.get(npcId)!.name)} needs ${r.n} ${d.name}. You have ${g.player.inv.countId(r.item)}.`);
    return true;
  }
  g.player.inv.removeSpec(r.item, r.n);
  r.done = true;
  g.player.money += r.reward;
  g.earned += r.reward;
  const n = npcSys(g).byId.get(npcId)!;
  addPoints(g, n, 150);
  g.count('requests');
  g.emit({ t: 'sfx', id: 'quest' });
  g.emit({ t: 'fx', kind: 'coins', x: g.player.x, y: g.player.y - 1 });
  g.emit({ t: 'ui', open: 'dialog', arg: { npc: npcId, name: NPC_BY_ID.get(npcId)!.name, pages: [`You're a lifesaver, ${g.player.name}! Here: ${r.reward} coins, as promised.`], hearts: hearts(n) } });
  return true;
}

registerSystem({
  name: 'quests',
  tick(g) {
    if (g.tickN % 60 === 0) {
      const q = questSys(g);
      // visit objectives
      for (const a of q.active) {
        const def = QUEST_BY_ID.get(a.id);
        def?.objectives.forEach((o, i) => {
          if (o.t === 'visit') {
            const l = g.map.locs.get(o.loc);
            if (l && Math.hypot(g.player.x - l[0], g.player.y - l[1]) < 4) a.prog[i] = 1;
          }
        });
      }
      poll(g);
      // quests held back until an hour of the first day (bedtime) start when it comes
      if (g.dayIndex === 0) startAvailable(g);
    }
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    questSys(g);
    startAvailable(g);
    rollRequests(g);
  },
  dayEnd(g, summary) {
    startAvailable(g, true);
    notify(g, 'sleep', 1);
    const q = questSys(g);
    summary.quests = q.today ?? [];
    q.today = [];
  },
  save(g) {
    const q = questSys(g);
    return { active: q.active, done: q.done, requests: q.requests, current: q.current };
  },
  load(g, d) {
    const q = questSys(g);
    q.active = (d.active ?? []).filter((a: ActiveQuest) => QUEST_BY_ID.has(a.id));
    q.done = d.done ?? [];
    q.requests = (d.requests ?? []).filter((r: Request) => ITEM_BY_ID.has(r.item));
    q.current = d.current ?? -1;
  },
});

export { QUESTS };
