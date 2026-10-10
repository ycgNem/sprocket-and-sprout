// Lines: the port graph of the works (who feeds whom), the line around any structure, and the
// bottleneck diagnosis the inspector, the Lines tab and the night tally share (ROADMAP.md 4.6, 4.8).
import { ADVICE, adviceText } from '../data/advice';
import { CROP_BY_ID } from '../data/crops';
import type { CropDef } from '../data/types';
import { availableRecipes, machTakesText } from './systems/machines';
import { DAY_SECS } from './systems/stats';
import { ITEMS } from '../data/items';
import type { Game } from './Game';
import { BeltKind, DX, DY, Ent, Ents, entName } from './ents';
import { kDef } from './inventory';
import { MState } from './mstate';
import { rebuildBelts } from './systems/belts';
import { armRate } from './systems/arms';
import { powerState } from './systems/power';

export interface PortNode {
  ins: Ent[];
  outs: Ent[];
}

/** structures that take crops from the ground: a field is their source */
export const FIELD_KINDS = new Set(['gleaner', 'harvester', 'gantry']);

let cache: { ents: Ents; ver: number; nodes: Map<number, PortNode> } | null = null;

const root = (e: Ent) => e.parent ?? e;

function drillFront(e: Ent): [number, number] {
  switch (e.rot) {
    case 0: return [e.x, e.y - 1];
    case 1: return [e.x + e.w, e.y];
    case 2: return [e.x + 1, e.y + e.h];
    default: return [e.x - 1, e.y + 1];
  }
}

/** The port graph, rebuilt when anything is placed, removed or rotated. */
export function portGraph(g: Game): Map<number, PortNode> {
  const ents = g.ents;
  if (cache && cache.ents === ents && cache.ver === ents.version && !ents.beltsDirty) return cache.nodes;
  if (ents.beltsDirty) rebuildBelts(ents);
  const nodes = new Map<number, PortNode>();
  const node = (e: Ent) => {
    let n = nodes.get(e.id);
    if (!n) nodes.set(e.id, (n = { ins: [], outs: [] }));
    return n;
  };
  const edge = (a: Ent | null, b: Ent | null) => {
    if (!a || !b || a.ghost || b.ghost) return;
    a = root(a);
    b = root(b);
    if (a === b) return;
    const na = node(a), nb = node(b);
    if (!na.outs.includes(b)) na.outs.push(b);
    if (!nb.ins.includes(a)) nb.ins.push(a);
  };
  for (const e of ents.arms) {
    if (e.ghost) continue;
    const r = e.arm!.reach;
    node(e);
    edge(ents.rootAt(e.x - DX[e.rot] * r, e.y - DY[e.rot] * r), e);
    edge(e, ents.rootAt(e.x + DX[e.rot] * r, e.y + DY[e.rot] * r));
  }
  for (const e of ents.belts) {
    if (e.ghost) continue;
    const b = e.belt!;
    node(root(e));
    if (b.next) edge(e, b.next);
    else if (b.kind !== BeltKind.UnderIn) {
      const front = ents.rootAt(e.x + DX[e.rot], e.y + DY[e.rot]);
      if (front && !front.belt) edge(e, front);
    }
  }
  for (const e of ents.others) {
    if (e.ghost || e.def.kind !== 'drill') continue;
    const [x, y] = drillFront(e);
    edge(e, ents.rootAt(x, y));
  }
  cache = { ents, ver: ents.version, nodes };
  return nodes;
}

/** Is anything aimed at this structure (an arm dropping on it, a belt ending at it)? */
export function hasFeeder(g: Game, e: Ent): boolean {
  return (portGraph(g).get(root(e).id)?.ins.length ?? 0) > 0;
}

export function feedersOf(g: Game, e: Ent): Ent[] {
  return portGraph(g).get(root(e).id)?.ins ?? [];
}

export function takersOf(g: Game, e: Ent): Ent[] {
  return portGraph(g).get(root(e).id)?.outs ?? [];
}

/**
 * The field machine a structure's supply traces back to (through arms, belts and empty chests),
 * if any: a stage that waits on it is "waiting for harvest", not Starved (ROADMAP.md 4.2).
 */
export function fieldSource(g: Game, e: Ent): Ent | null {
  const nodes = portGraph(g);
  const seen = new Set<number>([root(e).id]);
  let frontier = nodes.get(root(e).id)?.ins ?? [];
  for (let d = 0; d < 30 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const f of frontier) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      // a rusted piece carries nothing: the chain to the field is broken there, so what it feeds
      // is starved, not waiting for a harvest (the critic, Phase 2: M1a)
      if (f.st.rust) continue;
      if (FIELD_KINDS.has(f.def.kind)) return f;
      // arms and belts pass supply through; so does a chest that has run empty
      if (f.arm || f.belt || ((f.def.kind === 'chest') && f.inv?.isEmpty())) next.push(...(nodes.get(f.id)?.ins ?? []));
    }
    frontier = next;
  }
  return null;
}

/** "Waiting for harvest: next ripe crop in 2 watered days" from the field machine's own line */
export function harvestWaitText(src: Ent): string {
  if (src.state !== MState.Idle || !src.why) return 'Waiting for harvest';
  // "Ripe: picks at noon (or ...)" reads as "Waiting for harvest at noon"
  if (src.why.startsWith('Ripe')) return 'Waiting for harvest at noon';
  return `Waiting for harvest: ${src.why[0].toLowerCase()}${src.why.slice(1)}`;
}

/** Every structure connected to `start` through ports, both ways (capped). */
export function lineOf(g: Game, start: Ent, cap = 200): { members: Ent[]; sources: Ent[]; sinks: Ent[] } {
  const nodes = portGraph(g);
  const s0 = root(start);
  const seen = new Set<number>([s0.id]);
  const members: Ent[] = [s0];
  for (let i = 0; i < members.length && members.length < cap; i++) {
    const n = nodes.get(members[i].id);
    if (!n) continue;
    for (const o of [...n.ins, ...n.outs]) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      members.push(o);
    }
  }
  const sources = members.filter((e) => !(nodes.get(e.id)?.ins.length) && !e.belt && !e.arm);
  const sinks = members.filter((e) => !(nodes.get(e.id)?.outs.length) && !e.belt && !e.arm);
  return { members, sources, sinks };
}

// ---------------- diagnosis ----------------

export interface Stage {
  e: Ent;
  /** distance from the sink (0 = the sink) */
  depth: number;
  /** share of the day (or the last minute, early on) in each state, and waiting for harvest */
  shares: number[];
  harvestWait: number;
  /** share of the day Working only as a queue in front of a busy taker (not real work) */
  queued: number;
  /** items a works day: received / made or moved (measured) */
  inDay: number;
  outDay: number;
  /** what it could make flat out in a works day (makers only; fields: their nominal yield) */
  capDay: number;
}

export interface Diagnosis {
  sink: Ent;
  /** sources first, the sink last; belts are folded into `belts` */
  stages: Stage[];
  belts: number;
  /** the stage the diagnosis is about (null when every stage keeps up) */
  problem: Stage | null;
  /** the advice case, its gap (stated with numbers) and its fixes (behind the "?") */
  key: string;
  gap: string;
  fix: string;
  /** items a works day arriving at the sink */
  rate: number;
}

const MAKER_KINDS = new Set(['gleaner', 'harvester', 'gantry', 'planter', 'drill', 'lab']);
const isMaker = (e: Ent) => !!e.mach || MAKER_KINDS.has(e.def.kind);
const label = (e: Ent) => entName(e).toLowerCase();

/** what a starved machine waits for, in words */
function wantName(e: Ent): string {
  return e.want ?? 'its input';
}

/** what feeds a starved stage, found by walking up past arms and belts */
function sourceOf(nodes: Map<number, PortNode>, e: Ent): Ent | null {
  const seen = new Set<number>([e.id]);
  let frontier = nodes.get(e.id)?.ins ?? [];
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const f of frontier) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (!f.arm && !f.belt) return f;
      next.push(...(nodes.get(f.id)?.ins ?? []));
    }
    frontier = next;
  }
  return null;
}

/** the first makers downstream of a source, past arms and belts (who shares it) */
function makersFedBy(nodes: Map<number, PortNode>, src: Ent): Ent[] {
  const out: Ent[] = [];
  const seen = new Set<number>([src.id]);
  let frontier = nodes.get(src.id)?.outs ?? [];
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const f of frontier) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (f.arm || f.belt) next.push(...(nodes.get(f.id)?.outs ?? []));
      else if (isMaker(f)) out.push(f);
    }
    frontier = next;
  }
  return out;
}

/** what a structure takes, in words, for the wrong-input advice */
function takesText(g: Game, e: Ent): string {
  if (e.mach) return machTakesText(g, e);
  switch (e.def.kind) {
    case 'shipbin': return 'anything that sells';
    case 'planter': return 'seeds and fertilizer';
    case 'gantry': return 'seeds';
    case 'fishtrap': return 'bait';
    case 'generator':
    case 'drill': return 'wood or coal';
  }
  return 'other goods';
}

function sourceKey(src: Ent | null): string {
  if (!src) return 'none';
  if (src.def.kind === 'drill') return 'drill';
  if (src.mach || MAKER_KINDS.has(src.def.kind)) return 'machine';
  return 'chest';
}

/** the tiles a field machine picks from */
export function fieldTiles(e: Ent): [number, number][] {
  if (e.def.kind === 'gantry') return e.strip ?? [];
  const r = e.def.reach ?? 1;
  const out: [number, number][] = [];
  for (let y = e.y - r; y <= e.y + e.h - 1 + r; y++) for (let x = e.x - r; x <= e.x + e.w - 1 + r; x++) if (!(x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)) out.push([x, y]);
  return out;
}

/** a crop picked by hand inside a field machine's reach counts toward that field (ROADMAP.md 4.2) */
export function noteHandPick(g: Game, i: number, n: number) {
  const x = i % g.map.w, y = Math.floor(i / g.map.w);
  for (const e of g.ents.others) {
    if (e.ghost || !FIELD_KINDS.has(e.def.kind)) continue;
    if (fieldTiles(e).some(([fx, fy]) => fx === x && fy === y)) g.stats.states.handPicked(e, n);
  }
}

/**
 * A field's nominal yield (ROADMAP.md 4.2: always nominal, a field ripens all at once): plants in
 * reach x average yield / days per harvest, plus the crop most of them are and its yield a plant.
 */
export function fieldYield(g: Game, e: Ent): { perDay: number; perPlant: number; crop: string; plants: number } {
  let perDay = 0, plants = 0;
  const count = new Map<string, number>();
  for (const [x, y] of fieldTiles(e)) {
    if (!g.map.inb(x, y)) continue;
    const s = g.soil.get(g.map.idx(x, y));
    if (!s?.crop || s.crop.dead) continue;
    const cr = CROP_BY_ID.get(s.crop.id);
    if (!cr) continue;
    plants++;
    perDay += plantPerDay(cr);
    count.set(cr.name, (count.get(cr.name) ?? 0) + 1);
  }
  const crop = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'crop';
  const perPlant = plants ? perDay / plants : 0;
  return { perDay, perPlant, crop: crop.toLowerCase(), plants };
}

export function plantPerDay(cr: CropDef): number {
  const [lo, hi] = cr.yield ?? [1, 1];
  const days = cr.regrow ?? cr.stages.reduce((a, b) => a + b, 0);
  return (lo + hi) / 2 / Math.max(1, days);
}

/** what a machine could take in flat out in a works day (its recipe's inputs) */
function inputDay(g: Game, e: Ent): number {
  const m = e.mach;
  if (!m) return 0;
  const r = m.recipe ?? availableRecipes(g, e)[0];
  if (!r) return 0;
  const inN = r.in.reduce((a, i) => a + i.n, 0);
  return (DAY_SECS / Math.max(0.05, r.time)) * m.speed * g.mods.machineSpeed * inN;
}

/** what a maker could make flat out in a works day */
function capacityDay(g: Game, e: Ent): number {
  if (FIELD_KINDS.has(e.def.kind)) return fieldYield(g, e).perDay;
  const m = e.mach;
  if (!m) return 0;
  const r = m.recipe ?? availableRecipes(g, e)[0];
  if (!r) return 0;
  const outN = r.out.reduce((a, o) => a + (o.chance ?? 1) * o.n, 0);
  return (DAY_SECS / Math.max(0.05, r.time)) * m.speed * g.mods.machineSpeed * outN;
}

/** shares of the day (or the last minute until 2 game hours of the day have run) */
function sharesOf(g: Game, e: Ent): { shares: number[]; harvestWait: number; queued: number } {
  const d = g.stats.states.day(e);
  if (d.secs >= 84) return { shares: d.shares, harvestWait: d.harvestWait, queued: d.queued };
  return { shares: g.stats.states.shares(e), harvestWait: e.fieldWait ? 1 : 0, queued: g.stats.states.queuedShare(e) };
}

/** per day at or below one a minute, per minute above that (ROADMAP.md 4.2) */
export function fmtRate(perDay: number): string {
  const perMin = perDay / (DAY_SECS / 60);
  return perMin > 1 ? `${fmt(perMin)}/min` : `${fmt(perDay)}/day`;
}

/**
 * One unit for a table of rates (the critic: the Lines tab mixed /min and /day row by row): per
 * minute when any of them is above one a minute, else per day. `fmtRateIn` writes a rate in it.
 */
export const perMinUnit = (perDays: number[]): boolean => perDays.some((d) => d / (DAY_SECS / 60) > 1);
export function fmtRateIn(perDay: number, perMin: boolean): string {
  return perMin ? `${fmt(perDay / (DAY_SECS / 60))}/min` : `${fmt(perDay)}/day`;
}

/** Walk up from a sink and name the bottleneck (ROADMAP.md 4.8). */
export function diagnose(g: Game, sink: Ent): Diagnosis {
  const nodes = portGraph(g);
  const log = g.stats.states;
  const s0 = root(sink);
  const depth = new Map<number, number>([[s0.id, 0]]);
  const order: Ent[] = [s0];
  for (let i = 0; i < order.length && order.length < 200; i++) {
    for (const f of nodes.get(order[i].id)?.ins ?? []) {
      if (depth.has(f.id)) continue;
      depth.set(f.id, depth.get(order[i].id)! + 1);
      order.push(f);
    }
  }
  const all: Stage[] = order.map((e) => {
    const { shares, harvestWait, queued } = sharesOf(g, e);
    return { e, depth: depth.get(e.id)!, shares, harvestWait, queued, inDay: log.perDay(e, 'in'), outDay: log.perDay(e, 'out'), capDay: isMaker(e) ? capacityDay(g, e) : 0 };
  });
  const belts = all.filter((s) => s.e.belt);
  const stages = all.filter((s) => !s.e.belt).sort((a, b) => b.depth - a.depth);
  const rate = log.perDay(s0, 'in');
  const pct = (v: number) => Math.round(v * 100);
  let problem: Stage | null = null;
  let key = '';
  let vars: Record<string, string | number> = {};
  let hands = '';
  const pick =(s: Stage | null, k: string, v: Record<string, string | number>) => {
    problem = s;
    key = k;
    vars = v;
  };
  // 1. power: a consumer on a short grid, or without power much of the time; then fuel
  const ps = powerState(g);
  for (const s of stages) {
    const e = s.e;
    if (!e.def.powerUse || e.off) continue;
    const net = e.net ? ps.nets.get(e.net) : undefined;
    const unp = s.shares[MState.Unpowered];
    if (!net && unp >= 0.2) {
      pick(s, 'power:none', { name: label(e), pct: pct(unp) });
      break;
    }
    if (net && net.sat < 0.99 && s.shares[MState.Working] + unp >= 0.3) {
      const off = consumersToSwitchOff(g, e.net);
      pick(s, 'power:brownout', { name: label(e), pct: pct(net.sat), need: Math.ceil(net.demand - net.cap), n: off, s: off === 1 ? '' : 's' });
      break;
    }
  }
  if (!key) {
    const s = stages.find((s) => s.shares[MState.NeedsFuel] >= 0.2);
    if (s) pick(s, 'needsfuel', { name: label(s.e), pct: pct(s.shares[MState.NeedsFuel]) });
  }
  // 2. field-limited: the first maker downstream of a field waits for harvest
  if (!key) {
    // judged on the field's nominal yield against what the maker can use (a field ripens all at once,
    // so a day's count says little): the maker waits for harvest now, or did for much of the day
    const s = stages.find((s) => s.e.mach && (s.harvestWait >= 0.3 || s.e.fieldWait));
    const field = s ? fieldSource(g, s.e) : null;
    const fy = field ? fieldYield(g, field) : null;
    if (s && field && fy && fy.perDay < s.capDay * 0.9) {
      // the field's beans feed every maker drawing on it
      const can = s.capDay;
      const more = fy.perPlant > 0 ? Math.max(1, Math.ceil((can - fy.perDay) / fy.perPlant)) : 0;
      pick(s, 'field', { name: label(s.e), crop: fy.crop, have: fmt(fy.perDay), can: fmt(can), more });
      const d = log.day(field);
      if (d.handN > 0) hands = `Your hands took ${fmt(d.handN)} of the field's ${fmt(d.handN + d.outN)}.`;
    }
  }
  // 3. an arm flat out while what it feeds still starves, or while the machine it empties piles
  //    up: the arm is the bottleneck. Flat out means swinging, not queued in front of a busy
  //    machine, and never when it could move twice what its machines need (the critic, M1b: "flat
  //    out, 100%" for an arm waiting on a busy crock)
  if (!key) {
    const perMin = (d: number) => d / (DAY_SECS / 60);
    for (const s of stages) {
      const swing = s.shares[MState.Working] - s.queued;
      if (!s.e.arm || swing < 0.9) continue;
      const near = (ids: Ent[]) => ids.map((o) => all.find((x) => x.e === o)).filter((x): x is Stage => !!x && isMaker(x.e));
      const hungry = near(nodes.get(s.e.id)?.outs ?? []).filter((f) => f.shares[MState.Starved] >= 0.3);
      const piling = near(nodes.get(s.e.id)?.ins ?? []).filter((f) => f.e.mach && f.shares[MState.Working] + f.shares[MState.Blocked] >= 0.9 && (f.e.mach.outBuf.reduce((a, o) => a + o.n, 0) >= 6 || f.shares[MState.Blocked] >= 0.3));
      if (!hungry.length && !piling.length) continue;
      // what the machines need a day (inputs for the hungry ones, outputs for the piling ones)
      const need = hungry.length ? hungry.reduce((a, f) => a + inputDay(g, f.e), 0) : piling.reduce((a, f) => a + f.capDay, 0);
      const moves = armRate(s.e, g.mods.armHand) * (DAY_SECS / 60);
      if (need > 0 && moves >= need * 2) continue;
      pick(s, hungry.length ? 'slow:arm' : 'slow:arm-out', { name: label(s.e), src: piling[0] ? label(piling[0].e) : '', pct: pct(swing), can: fmt(perMin(need)), have: fmt(perMin(moves)) });
      break;
    }
  }
  // 4. the wrong input: an arm or belt stopped by an item its taker can't use at all (a hard stop
  //    that reads as "starved" further down; never "the chest ran dry" with 50 stone in it)
  if (!key) {
    const s = [...stages, ...belts].filter((s) => s.e.refused !== undefined && s.e.state === MState.Blocked).sort((a, b) => b.depth - a.depth)[0];
    const taker = s ? nodes.get(s.e.id)?.outs.find((o) => !o.belt && !o.arm) : undefined;
    if (s && taker) {
      const src = s.e.arm ? nodes.get(s.e.id)?.ins[0] : undefined;
      pick(s, s.e.arm ? 'wrong:arm' : 'wrong:belt', { name: label(taker), item: kDef(s.e.refused!).name.toLowerCase(), src: src ? label(src) : 'chest', takes: takesText(g, taker) });
    }
  }
  // 5. the most upstream maker that starves (the root cause): what it waits for and where from
  if (!key) {
    const starved = stages.filter((s) => isMaker(s.e) && s.shares[MState.Starved] >= 0.3);
    if (starved.length) {
      const s = starved.reduce((a, b) => (b.depth > a.depth ? b : a));
      const src = sourceOf(nodes, s.e);
      // two or more machines drawing on one starving source share it
      const sharing = src ? makersFedBy(nodes, src).filter((o) => o !== s.e).length : 0;
      // a chest with goods in it didn't run dry: it has none of what's wanted
      const k = sharing ? 'starved:shared' : sourceKey(src) === 'chest' && src?.inv?.slots.some(Boolean) ? 'starved:chest-other' : 'starved:' + sourceKey(src);
      pick(s, k, { name: label(s.e), pct: pct(s.shares[MState.Starved]), item: wantName(s.e), src: src ? label(src) : 'nothing', n: sharing + 1 });
    }
  }
  // 6. the most downstream real block (queues in front of busy machines are Working, not Blocked)
  if (!key) {
    const blocked = [...stages, ...belts].filter((s) => s.shares[MState.Blocked] >= 0.3).sort((a, b) => a.depth - b.depth);
    if (blocked.length) {
      const s = blocked[0];
      const k = s.e.def.kind;
      const dst = s.e.arm ? (nodes.get(s.e.id)?.outs[0] ?? null) : null;
      pick(s, k === 'shipbin' ? 'blocked:shipbin' : k === 'chest' ? 'blocked:chest' : s.e.belt ? 'blocked:belt' : s.e.arm ? 'blocked:arm' : 'blocked:machine', { name: label(s.e), pct: pct(s.shares[MState.Blocked]), dst: dst ? label(dst) : 'nothing' });
    }
  }
  // 7. all good: name the slowest maker
  if (!key) {
    const makers = stages.filter((s) => isMaker(s.e) && s.capDay > 0);
    if (makers.length) {
      const slow = makers.sort((a, b) => a.capDay - b.capDay)[0];
      pick(null, 'ok', { name: label(slow.e), have: fmtRate(slow.capDay) });
    } else if (rate > 0) pick(null, 'ok:plain', { have: fmtRate(rate) });
    else pick(null, 'empty', {});
  }
  const t = adviceText(key, vars);
  return { sink: s0, stages, belts: belts.length, problem, key, gap: hands ? `${t.gap} ${hands}` : t.gap, fix: t.fix, rate };
}

export function fmt(v: number): string {
  return v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString();
}
/** the fewest consumers (biggest first) to switch off to bring a grid's demand under its supply */
export function consumersToSwitchOff(g: Game, net: number): number {
  const n = powerState(g).nets.get(net);
  if (!n || n.demand <= n.cap) return 0;
  const draws = g.ents.consumers.filter((e) => e.net === net && !e.off).map((e) => (e.working ? e.def.powerUse ?? 0 : e.def.powerIdle ?? 0)).sort((a, b) => b - a);
  let over = n.demand - n.cap, k = 0;
  for (const d of draws) {
    if (over <= 0) break;
    over -= d;
    k++;
  }
  return k;
}

/**
 * The night tally's line (ROADMAP.md 4.3): yesterday's worst bottleneck across every line, stated
 * with its numbers; null when every line kept up (or there are no lines yet).
 */
export function worksTally(g: Game): string | null {
  const rank: Record<string, number> = { 'power:none': 0, 'power:brownout': 1, needsfuel: 2, field: 3, 'slow:arm': 4, 'slow:arm-out': 4, 'starved:shared': 5, 'starved:chest': 5, 'starved:machine': 5, 'starved:drill': 5, 'starved:none': 6 };
  let best: Diagnosis | null = null;
  for (const s of lineSinks(g).slice(0, 12)) {
    const d = diagnose(g, s);
    if (!d.problem) continue;
    const r = rank[d.key] ?? 7;
    if (!best || r < (rank[best.key] ?? 7)) best = d;
  }
  return best ? best.gap : null;
}

/** Sinks worth listing in the Lines tab: crates, end chests, desks, depots, machines nothing empties. */
export function lineSinks(g: Game): Ent[] {
  const nodes = portGraph(g);
  const out: Ent[] = [];
  for (const [id, n] of nodes) {
    if (n.outs.length || !n.ins.length) continue;
    const e = g.ents.get(id);
    if (!e || e.ghost || e.belt || e.arm) continue;
    out.push(e);
  }
  return out.sort((a, b) => g.stats.states.rate(b, 'in') - g.stats.states.rate(a, 'in'));
}

/** the name of the item a line's sink mostly receives (for labels) */
export function sinkItem(e: Ent): string | null {
  const s = e.inv?.slots.find(Boolean);
  if (s) return kDef(s.k).name;
  const o = e.mach?.outBuf[0];
  return o ? ITEMS[o.k >> 2].name : null;
}

export { ADVICE };
