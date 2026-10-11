// Quests: the tutorial chain and story quests. Progress via notify() hooks + polling. (Today's town
// asks are orders now: src/sim/systems/orders.ts.)
import { questName } from '../../data/cookbook';
import { C } from '../../data/palette';
import { CROP_BY_ID } from '../../data/crops';
import { QUESTS, QUEST_BY_ID } from '../../data/goals';
import { ITEM_BY_ID, ITEMS, matchesSpec } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { STRUCT_BY_ID } from '../../data/structures';
import { RESEARCH_BY_ID } from '../../data/research';
import type { ObjectiveDef, QuestDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { DX, DY, type Ent } from '../ents';
import { key, kDef } from '../inventory';
import { addPoints, hearts, npcSys } from './npcs';
import { portGraph } from '../lines';
import { allEnts } from '../indoors';
import { stageCount, stageNext, stages, validateText } from './research';

export interface ActiveQuest {
  id: string;
  prog: number[];
  day: number;
}

export interface QuestSys {
  active: ActiveQuest[];
  done: string[];
}

export function questSys(g: Game): QuestSys & Record<string, any> {
  if (!g.sys.quests) g.sys.quests = { active: [], done: [] };
  const q = g.sys.quests;
  q.notify = notify;
  q.tracker = tracker;
  q.now = nowLines;
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
  if (g.dayIndex > 0 || def.id !== 'k1_line') {
    g.toast(`New quest: ${def.title}`, undefined, 6);
    // a soft sting and a scroll unfurling over your head for a new quest; the fanfare is for finishing one
    g.emit({ t: 'sfx', id: 'chime', v: 0.7 });
    g.emit({ t: 'fx', kind: 'scroll', x: g.player.x, y: g.player.y - 2.1 });
  }
  // no letter: the tracker and the toast already say it (DECISIONS #57, 'too much mail')
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
    // at most three story quests at once; the rest wait their turn (tutorial steps and small gifts don't count)
    const story = (a: ActiveQuest) => !QUEST_BY_ID.get(a.id)?.tutorial && !QUEST_BY_ID.get(a.id)?.small;
    if (d.startDay === undefined && !d.tutorial && !d.small && q.active.filter(story).length >= 3) continue;
    // a prerequisite gated behind a flag this save doesn't have (e.g. the new opening) counts as met
    const met = (a: string) => q.done.includes(a) || (!!QUEST_BY_ID.get(a)?.needFlag && !g.flags.has(QUEST_BY_ID.get(a)!.needFlag!));
    if (d.after && !d.after.every(met)) continue;
    if (!d.after && d.startDay === undefined) continue;
    start(g, d);
  }
}

export function objDone(g: Game, o: ObjectiveDef, prog: number): boolean {
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
    // (a structure counts wherever it stands: on the farm or in the farmhouse's workshop)
    case 'craft': return prog >= o.n || (!o.fresh && g.player.inv.countId(o.item) + allEnts(g).filter((e) => !e.ghost && !e.st.rust && e.def.item === o.item).length >= o.n);
    // structures placed before the quest started count too (the keeper's rusted ones aren't yours yet)
    case 'build': return prog >= o.n || allEnts(g).filter((e) => !e.ghost && !e.st.rust && e.def.id === o.struct).length >= o.n;
    // "any topic" counts once one is being studied (a costly first pick must not stall the tutorial)
    case 'research': return o.id === '*' ? (g.counters.research ?? 0) >= 1 || !!g.research.current : g.research.done.has(o.id);
    case 'floor': return (g.sys.mine?.deepest ?? 0) >= o.n;
    // `met`: having already met them counts (you said hello before the quest asked)
    case 'talk': return prog >= 1 || (!!o.met && !!npcSys(g).byId.get(o.npc)?.met);
    case 'sleep':
    case 'visit':
      return prog >= 1;
    // a rusted structure brought back: the one at a tile, or no rusted one of the kind left
    case 'restore': {
      // the piece at a tile: restored, even if it has been picked up and moved since (a rusted one
      // can't be moved, so an empty tile was restored first)
      if (o.at) return !g.ents.rootAt(o.at[0], o.at[1])?.st.rust;
      if (o.rect) return rustedIn(g, o.rect).left === 0;
      const of = g.ents.all().filter((e) => !e.ghost && e.def.id === o.struct);
      return of.length > 0 && of.every((e) => !e.st.rust);
    }
    case 'order': return prog >= 1 || (g.sys.orders?.filled?.[o.id] ?? 0) >= 1;
    case 'grid': return gridCovers(g, o.struct);
    case 'flag': return g.flags.has(o.flag);
    case 'count': return (g.counters[o.key] ?? 0) >= o.n;
    case 'stage': return g.research.done.has(o.id) || stages(g, o.id)[o.stage] !== false;
    case 'gleaned': return gleanedCount(g, o.crop) >= o.n;
    case 'arm': return !!armBetween(g, o.from, o.to);
    case 'feeds': {
      const nodes = portGraph(g);
      return g.ents.all().some((e) => !e.ghost && !e.st.rust && e.def.id === o.struct && (!o.other || !e.st.keeper) && (nodes.get(e.id)?.ins.length ?? 0) > 0);
    }
    default:
      return prog >= ('n' in o ? o.n : 1);
  }
}

/** plants of a crop within reach of the player's own working gleaners (each picks the 3x3 around it) */
export function gleanedCount(g: Game, crop: string): number {
  const seen = new Set<number>();
  for (const e of g.ents.all()) {
    if (e.def.kind !== 'gleaner' || e.ghost || e.st.rust || e.st.keeper) continue;
    const r = e.def.reach ?? 1;
    for (let y = e.y - r; y <= e.y + r; y++)
      for (let x = e.x - r; x <= e.x + r; x++) {
        const i = g.map.idx(x, y);
        if (g.soil.get(i)?.crop?.id === crop) seen.add(i);
      }
  }
  return seen.size;
}

/** structures in a rect (x, y, w, h): how many there are and how many are still rusted */
/**
 * A working arm that takes from a structure of `from` and drops into one of `to` (an id or a kind,
 * either may be left out), or null. Inline rather than src/sim/systems/arms.ts's armTiles: importing
 * a system from here would move it in the tick order.
 */
export function armBetween(g: Game, from?: string, to?: string): Ent | null {
  const is = (e: Ent | null, want?: string) => !want || (!!e && !e.ghost && !e.st.rust && (e.def.id === want || e.def.kind === want));
  for (const e of g.ents.arms) {
    if (e.ghost || e.st.rust || !e.arm) continue;
    const r = e.arm.reach;
    if (is(g.ents.rootAt(e.x - DX[e.rot] * r, e.y - DY[e.rot] * r), from) && is(g.ents.rootAt(e.x + DX[e.rot] * r, e.y + DY[e.rot] * r), to)) return e;
  }
  return null;
}

export function rustedIn(g: Game, r: [number, number, number, number]): { all: number; left: number } {
  const seen = new Set<number>();
  let all = 0, left = 0;
  for (let y = r[1]; y < r[1] + r[3]; y++)
    for (let x = r[0]; x < r[0] + r[2]; x++) {
      const e = g.ents.rootAt(x, y);
      if (!e || e.ghost || seen.has(e.id)) continue;
      seen.add(e.id);
      if (!e.st.yard) continue;
      all++;
      if (e.st.rust) left++;
    }
  return { all, left };
}

/** a switched-on machine of this kind whose grid can power everything on it at once */
export function gridCovers(g: Game, struct: string): boolean {
  const ps = g.sys.power as { nets: Map<number, { cap: number }> } | undefined;
  for (const e of g.ents.machines) {
    if (e.def.id !== struct || e.ghost || e.st.rust || e.off || !e.net) continue;
    const n = ps?.nets.get(e.net);
    if (!n) continue;
    const full = g.ents.consumers.filter((c) => c.net === e.net && !c.off && !c.st.rust).reduce((a, c) => a + (c.def.powerUse ?? 0), 0);
    if (n.cap >= full - 0.5) return true;
  }
  return false;
}

export function objText(g: Game, o: ObjectiveDef, prog: number): string {
  const item = (id: string) => (id[0] === '#' ? id.slice(1) + ' goods' : ITEM_BY_ID.get(id)?.name ?? id);
  // a hand-written label for the Now strip, with the count when there is one to show
  if (o.label) {
    const n = 'n' in o ? o.n : 0;
    if (o.t === 'have') return `${o.label} (${Math.min(o.n, g.player.inv.countSpec(o.item))}/${o.n})`;
    if (o.t === 'restore' && o.rect) {
      const r = rustedIn(g, o.rect);
      return `${o.label} (${r.all - r.left}/${r.all})`;
    }
    if (o.t === 'order') {
      // a works order: its items in so far, over all its lines
      const open = (g.sys.orders?.open as { def: string; done?: boolean; lines: { n: number; have: number }[] }[] | undefined)?.find((x) => x.def === o.id && !x.done);
      if (!open) return o.label;
      const have = open.lines.reduce((a, l) => a + Math.min(l.n, l.have), 0), n = open.lines.reduce((a, l) => a + l.n, 0);
      return `${o.label} (${have}/${n})`;
    }
    if (o.t === 'count') return `${o.label} (${Math.min(o.n, Math.floor(g.counters[o.key] ?? 0))}/${o.n})`;
    if (o.t === 'stage') return stageLine(g, o.id, o.stage, o.label);
    // a keystone's desk waits for its stages: say which one is next
    if (o.t === 'research' && o.id !== '*' && !g.research.done.has(o.id)) {
      const next = stageNext(g, o.id);
      if (next) return `${o.label} (first: ${next[0].toLowerCase()}${next.slice(1)})`;
    }
    return n > 1 && o.t !== 'build' ? `${o.label} (${Math.min(prog, n)}/${n})` : o.label;
  }
  switch (o.t) {
    case 'have': return `Have ${o.n} ${item(o.item)} (${Math.min(o.n, g.player.inv.countSpec(o.item))}/${o.n})`;
    case 'deliver': return `Bring ${o.n} ${item(o.item)} to ${questName(o.to, NPC_BY_ID.get(o.to)?.name ?? '')}`;
    case 'ship': return `Ship ${o.n} ${item(o.item)} (${Math.min(prog, o.n)}/${o.n})`;
    case 'talk': return `Talk to ${questName(o.npc, NPC_BY_ID.get(o.npc)?.name ?? '')}`;
    case 'build': {
      // placed ones count, so show them (not just the ones built since the quest began)
      const placed = g.ents.all().filter((e) => !e.ghost && !e.st.rust && e.def.id === o.struct).length;
      return `Build ${o.n > 1 ? o.n + ' ' : 'a '}${STRUCT_BY_ID.get(o.struct)?.name} (${Math.min(Math.max(prog, placed), o.n)}/${o.n})`;
    }
    case 'craft': return `Craft ${o.n > 1 ? o.n + ' ' : 'a '}${item(o.item)}` + (o.fresh ? ` (${Math.min(prog, o.n)}/${o.n})` : '');
    case 'load': return `Load the ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct}`;
    case 'research': return o.id === '*' ? 'Start researching a topic' : `Research ${RESEARCH_BY_ID.get(o.id)?.name}`;
    case 'floor': return `Reach Deepworks level ${o.n} (${Math.min(o.n, g.sys.mine?.deepest ?? 0)}/${o.n})`;
    case 'catch': return `Catch ${o.n} fish (${Math.min(prog, o.n)}/${o.n})`;
    case 'till': return `Till ${o.n} soil (${Math.min(prog, o.n)}/${o.n})`;
    case 'plant': return o.crop ? `Plant ${o.n} ${CROP_BY_ID.get(o.crop)?.name ?? o.crop} (${Math.min(prog, o.n)}/${o.n})` : `Plant ${o.n} seeds (${Math.min(prog, o.n)}/${o.n})`;
    case 'gleaned': return `${o.n} ${CROP_BY_ID.get(o.crop)?.name ?? o.crop} plants in reach of your gleaners (${Math.min(gleanedCount(g, o.crop), o.n)}/${o.n})`;
    case 'water': return `Water ${o.n} crops (${Math.min(prog, o.n)}/${o.n})`;
    case 'harvest': return `Harvest ${o.n} ${o.item ? item(o.item) : 'crops'} (${Math.min(prog, o.n)}/${o.n})`;
    case 'money': return `Earn ${o.n.toLocaleString()} coins (${Math.min(o.n, g.earned).toLocaleString()})`;
    case 'sleep': return 'Go to bed';
    case 'visit': return `Visit the ${o.loc}`;
    case 'friend': return o.npc === '*' ? `Trust ${o.hearts} with 3 villagers (${npcSys(g).list.filter((n) => hearts(n) >= o.hearts).length}/3)` : `Trust ${o.hearts} with ${NPC_BY_ID.get(o.npc)?.name}`;
    case 'produce': return `Make ${item(o.item)} with machines`;
    case 'crate': return `${o.auto ? 'Ship' : 'Put'} ${o.n} ${item(o.item)} ${o.auto ? 'by arm' : 'in the crate'} (${Math.min(prog, o.n)}/${o.n})`;
    case 'restore': return o.struct ? `Restore the ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct}` : 'Restore it';
    case 'flag': return o.flag;
    case 'made': return `Make ${o.n} batches in a ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct} (${Math.min(prog, o.n)}/${o.n})`;
    case 'feeds': return `Feed a ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct} with an arm`;
    case 'armload': return `An arm feeds the ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct} (${Math.min(prog, o.n)}/${o.n})`;
    case 'arm': {
      const nm = (id: string | undefined, or: string) => (id ? STRUCT_BY_ID.get(id)?.name.toLowerCase() ?? id : or);
      return `Put an arm from the ${nm(o.from, 'chest')} to the ${nm(o.to, 'machine')}`;
    }
    case 'order': return `Fill the order: ${o.id}`;
    case 'grid': return `Enough power for the ${STRUCT_BY_ID.get(o.struct)?.name ?? o.struct}'s grid`;
    case 'count': return `${o.key} (${Math.min(o.n, Math.floor(g.counters[o.key] ?? 0))}/${o.n})`;
    case 'stage': return stageLine(g, o.id, o.stage, RESEARCH_BY_ID.get(o.id)?.name ?? o.id);
  }
}

/** a keystone stage's line: the experiment's count since the keystone opened, the validate clock live */
function stageLine(g: Game, id: string, stage: 'observe' | 'experiment' | 'validate', label: string): string {
  const k = RESEARCH_BY_ID.get(id)?.keystone;
  if (!k || g.research.done.has(id)) return label;
  if (stage === 'experiment') {
    const o = k.experiment?.find((x) => x.t === 'count');
    if (o && o.t === 'count') return `${label} (${Math.min(o.n, Math.floor(stageCount(g, id, o.key)))}/${o.n})`;
  }
  if (stage === 'validate' && stages(g, id).validate === false) return `${label}: ${validateText(g, id)}`;
  return label;
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
  // the giver's Trust: a main quest 100 (ROADMAP.md 7.6), others 40; not twice when the reward already gives it
  const giver = npcSys(g).byId.get(def.giver);
  if (giver && r.friendship?.[0] !== def.giver) addPoints(g, giver, def.main ? 100 : 40);
  // the play screen shows a banner, flies the reward in and plays the fanfare
  g.emit({ t: 'quest', title: def.title, money: r.money ?? 0, items: r.items ?? [] });
  if (def.done) g.toast(def.done, undefined, C.amber);
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

function notify(g: Game, type: string, n: number, extra?: string, opts?: { auto?: boolean; other?: boolean; full?: boolean }) {
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
        case 'plant': if (!o.crop || o.crop === extra) a.prog[i] += n; break;
        case 'till': case 'water': a.prog[i] += n; break;
        case 'sleep': a.prog[i] = 1; break;
        case 'visit': if (o.loc === extra) a.prog[i] = 1; break;
        case 'crate':
          if ((!o.auto || opts?.auto) && extra && (o.item === extra || (o.item[0] === '#' && matchesSpec(ITEM_BY_ID.get(extra)!, o.item)))) a.prog[i] += n;
          break;
        case 'made': if (o.struct === extra && (!o.other || opts?.other) && (!o.full || opts?.full)) a.prog[i] += n; break;
        case 'armload': if (o.struct === extra) a.prog[i] += n; break;
        case 'order': if (o.id === extra) a.prog[i] = 1; break;
        default: break;
      }
    });
  }
  if (type !== 'have') poll(g);
}

export interface NowLine {
  id: string;
  title: string;
  text: string;
  why: string;
  /** the objective's index in its quest */
  index: number;
  /** how many steps its quest has */
  steps: number;
}

/**
 * The Now strip's lines (ROADMAP.md 6.2): the main path's current step first (the Keeper's Line,
 * then the keystones), then tutorial steps, then story quests; one line per quest, its first
 * unfinished objective, with its why.
 */
export function nowLines(g: Game, max = 1): NowLine[] {
  const q = questSys(g);
  const rank = (id: string) => {
    const d = QUEST_BY_ID.get(id);
    return d?.main ? 0 : d?.tutorial ? 1 : 2;
  };
  const out: NowLine[] = [];
  for (const a of [...q.active].filter((x) => QUEST_BY_ID.has(x.id)).sort((x, y) => rank(x.id) - rank(y.id))) {
    const def = QUEST_BY_ID.get(a.id)!;
    const i = def.objectives.findIndex((o, j) => !objDone(g, o, a.prog[j]));
    if (i < 0) continue;
    const o = def.objectives[i];
    out.push({ id: a.id, title: def.title, text: objText(g, o, a.prog[i]), why: o.why ?? def.why ?? '', index: i, steps: def.objectives.length });
    if (out.length >= max) break;
  }
  return out;
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
  return out;
}

/**
 * What a villager wants that the counter can hand over (a villager at work in their shop, src/ui/
 * windows/town.ts): their quests' deliveries (enough in the bag, or not yet) and their open orders
 * by hand, each with the bag's first stack it takes (null: none in the bag)
 */
export function counterAsks(g: Game, npcId: string): { label: string; k: number | null; ok: boolean }[] {
  const out: { label: string; k: number | null; ok: boolean }[] = [];
  const name = (id: string) => (id[0] === '#' ? id.slice(1) + ' goods' : ITEM_BY_ID.get(id)?.name ?? id);
  for (const a of questSys(g).active) {
    const def = QUEST_BY_ID.get(a.id);
    def?.objectives.forEach((o, j) => {
      if (o.t !== 'deliver' || o.to !== npcId || a.prog[j] >= o.n) return;
      const have = g.player.inv.countSpec(o.item);
      const s = g.player.inv.slots.find((s) => s && matchesSpec(kDef(s.k), o.item));
      out.push({ label: `${o.n} ${name(o.item)} for "${def.title}" (${have} in your bag)`, k: s?.k ?? null, ok: have >= o.n });
    });
  }
  for (const w of (g.sys.orders?.wants?.(g, npcId) ?? []) as { label: string; k: number | null }[]) out.push({ ...w, ok: w.k !== null });
  return out;
}

/** the counter's Hand in: the first thing a villager wants that the bag can give (false: nothing) */
export function handIn(g: Game, npcId: string, shopAfter?: string): boolean {
  const a = counterAsks(g, npcId).find((x) => x.ok && x.k !== null);
  return !!a && tryDeliver(g, npcId, a.k!, shopAfter);
}

function tryDeliver(g: Game, npcId: string, k: number, shopAfter?: string): boolean {
  const q = questSys(g);
  for (const a of q.active) {
    const def = QUEST_BY_ID.get(a.id);
    const i = def?.objectives.findIndex((o, j) => o.t === 'deliver' && o.to === npcId && a.prog[j] < o.n && matchesSpec(kDef(k), o.item)) ?? -1;
    if (!def || i < 0) continue;
    const o = def.objectives[i] as { item: string; n: number };
    const have = g.player.inv.countSpec(o.item);
    const name = questName(npcId, NPC_BY_ID.get(npcId)!.name);
    if (have < o.n) {
      g.toast(`${name} needs ${o.n} of them. You have ${have}.`);
      return true;
    }
    g.player.inv.removeSpec(o.item, o.n);
    a.prog[i] = o.n;
    g.emit({ t: 'sfx', id: 'quest' });
    g.emit({ t: 'fx', kind: 'coins', x: g.player.x, y: g.player.y - 1 });
    poll(g);
    return true;
  }
  // an order of theirs that takes it: today's ask or a standing order (src/sim/systems/orders.ts)
  return !!g.sys.orders?.hand?.(g, npcId, k, shopAfter);
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
  },
  afterLoad(g) {
    // a save whose quests were retired (1.x's tutorial chains) starts what it can now, not tomorrow
    if (g.map.w >= 100) startAvailable(g);
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
    return { active: q.active, done: q.done };
  },
  load(g, d) {
    const q = questSys(g);
    // progress sized to the quest as it is now (a step added since the save counts from 0, not NaN)
    q.active = (d.active ?? []).filter((a: ActiveQuest) => QUEST_BY_ID.has(a.id)).map((a: ActiveQuest) => {
      const n = QUEST_BY_ID.get(a.id)!.objectives.length;
      return { ...a, prog: Array.from({ length: n }, (_, i) => a.prog?.[i] ?? 0) };
    });
    q.done = d.done ?? [];
  },
});

export { QUESTS };
