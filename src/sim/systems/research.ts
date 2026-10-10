// Research (ROADMAP.md 7.3): desks consume one of each bundle per unit; completing nodes unlocks
// recipes. Keystones carry stages before the bundles: observe (a flag), experiment (objectives),
// validate (an item made at a rate, held for some minutes); a desk on a keystone whose stages
// aren't done waits and takes nothing. Era rewards (the 1.x buff nodes) come from town keystones.
import { ERA_REWARDS, REWARD_BY_ID, RESEARCH, RESEARCH_BY_ID } from '../../data/research';
import { RECIPES } from '../../data/recipes';
import { ITEM_BY_ID, ITEMS, matchesSpec } from '../../data/items';
import type { ObjectiveDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { MState, setState } from '../mstate';
import { rustTick } from '../rust';
import type { Ent } from '../ents';
import { key, kDef, kId } from '../inventory';
import { PORT_HANDLERS } from '../ports';

/** bundle units a topic costs (half, rounded up, in Clockwork Rush) */
export function researchUnits(id: string, g?: Game) {
  const r = RESEARCH_BY_ID.get(id)!;
  const n = r.cost[0]?.n ?? 1;
  return g?.mode === 'rush' ? Math.ceil(n / 2) : n;
}

export function canResearch(g: Game, id: string): boolean {
  const r = RESEARCH_BY_ID.get(id);
  if (!r || g.research.done.has(id)) return false;
  if (r.needFlag && !g.flags.has(r.needFlag)) return false;
  return r.prereq.every((p) => g.research.done.has(p));
}

export function setResearch(g: Game, id: string | null) {
  if (id && !canResearch(g, id)) return;
  g.research.current = id;
  // the Keeper's Line's B5 checks that Conveyance was picked at the desk
  if (id) g.flags.add('study:' + id);
}

/** Recipes and structures a node unlocks (for the tree UI). */
export function unlocksOf(id: string) {
  const recs = RECIPES.filter((r) => r.unlock === id);
  const items = [...new Set(recs.map((r) => r.out[0].item))];
  return { recipes: recs, items };
}

// ---------------- keystone stages ----------------

/** a stage objective that the state can answer (no per-quest progress): flags, counters, builds */
export function stageObjMet(g: Game, o: ObjectiveDef): boolean {
  switch (o.t) {
    case 'flag': return g.flags.has(o.flag);
    case 'count': return (g.counters[o.key] ?? 0) >= o.n;
    case 'build': return g.ents.all().filter((e) => !e.ghost && !e.st.rust && e.def.id === o.struct).length >= o.n;
    case 'research': return g.research.done.has(o.id);
    case 'have': return g.player.inv.countSpec(o.item) >= o.n;
    default: return false;
  }
}

/** a stage objective's line with its count ("Grind 20 meal or flour (12/20)") */
export function stageObjText(g: Game, o: ObjectiveDef): string {
  const label = o.label ?? o.t;
  if (o.t === 'count') return `${label} (${Math.min(o.n, Math.floor(g.counters[o.key] ?? 0))}/${o.n})`;
  if (o.t === 'build') return `${label} (${Math.min(o.n, g.ents.all().filter((e) => !e.ghost && !e.st.rust && e.def.id === o.struct).length)}/${o.n})`;
  return label;
}

export interface StageState {
  observe: boolean | null;
  experiment: boolean | null;
  validate: boolean | null;
  /** seconds held toward validate, and seconds needed */
  held: number;
  need: number;
  /** all stages before Apply are done (or the node has none) */
  ready: boolean;
}

/** where a keystone's stages stand (a plain node is always ready) */
export function stages(g: Game, id: string): StageState {
  const k = RESEARCH_BY_ID.get(id)?.keystone;
  // Sandbox has no keystone stages: research there is a plain tree
  if (!k || g.mode === 'sandbox' || g.research.done.has(id)) return { observe: null, experiment: null, validate: null, held: 0, need: 0, ready: true };
  const observe = k.observe ? g.flags.has(k.observe.flag) : null;
  const experiment = k.experiment ? k.experiment.every((o) => stageObjMet(g, o)) : null;
  const need = k.validate ? k.validate.minutes * 60 : 0;
  const held = Math.min(need, g.research.valid[id] ?? 0);
  const validate = k.validate ? held >= need || g.flags.has('validated:' + id) : null;
  return { observe, experiment, validate, held, need, ready: observe !== false && experiment !== false && validate !== false };
}

/** the first stage still open, in words (for the desk's line and the Now strip) */
export function stageNext(g: Game, id: string): string | null {
  const k = RESEARCH_BY_ID.get(id)?.keystone;
  const s = stages(g, id);
  if (!k || s.ready) return null;
  if (s.observe === false) return k.observe!.label;
  if (s.experiment === false) {
    const o = k.experiment!.find((x) => !stageObjMet(g, x))!;
    return stageObjText(g, o);
  }
  if (s.validate === false) return `${k.validate!.label} (${fmtClock(s.held)} of ${fmtClock(s.need)})`;
  return null;
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** items a minute of a spec made over the last minute (the stats' 1-second buckets) */
function ratePerMin(g: Game, spec: string): number {
  let rate = 0;
  for (let i = 0; i < ITEMS.length; i++) if (matchesSpec(ITEMS[i], spec)) rate += g.stats.rate(i, 0, 'prod');
  return rate;
}

/**
 * Once a second: each available keystone whose earlier stages are done counts the time its item
 * keeps up the rate; dropping below it starts the count again.
 */
function tickValidate(g: Game) {
  for (const r of RESEARCH) {
    const v = r.keystone?.validate;
    if (!v || g.research.done.has(r.id) || g.flags.has('validated:' + r.id) || !canResearch(g, r.id)) continue;
    const s = stages(g, r.id);
    if (s.observe === false || s.experiment === false) continue;
    if (ratePerMin(g, v.item) >= v.perMin) g.research.valid[r.id] = (g.research.valid[r.id] ?? 0) + 1;
    else g.research.valid[r.id] = 0;
    if ((g.research.valid[r.id] ?? 0) >= v.minutes * 60) {
      g.flags.add('validated:' + r.id);
      g.toast(`${r.name}: validated! The desk can study it now.`, 'i:' + r.icon, 6);
      g.emit({ t: 'sfx', id: 'chime' });
    }
  }
}

// ---------------- effects and era rewards ----------------

export function applyEffects(g: Game) {
  const add = (t: string, v: number) => {
    switch (t) {
      case 'armHand': g.mods.armHand += v; break;
      case 'machineSpeed': g.mods.machineSpeed += v; break;
      case 'labSpeed': g.mods.labSpeed += v; break;
      case 'energy': g.mods.energy += v; break;
      case 'droneSpeed': g.mods.droneSpeed += v; break;
      case 'droneCount': g.mods.droneCount += v; break;
      case 'reach': g.mods.reach += v; break;
      case 'marketBonus': g.mods.marketBonus += v; break;
    }
  };
  for (const id of g.research.done) for (const e of RESEARCH_BY_ID.get(id)?.effects ?? []) add(e.t, e.v);
  for (const id of g.research.rewards) for (const e of REWARD_BY_ID.get(id)?.effects ?? []) add(e.t, e.v);
}

function resetMods(g: Game) {
  g.mods = { armHand: 0, machineSpeed: 1, labSpeed: 1, energy: 0, droneSpeed: 1, droneCount: 0, reach: 0, marketBonus: 0 };
  applyEffects(g);
}

/**
 * Grant the era rewards whose town keystone is done (idempotent: a loaded save that already has the
 * flag gets its pieces back quietly; a fresh one shows the card).
 */
export function grantEraRewards(g: Game, quiet = false) {
  let changed = false;
  for (const er of ERA_REWARDS) {
    if (!g.flags.has(er.flag) || er.pieces.every((p) => g.research.rewards.has(p))) continue;
    for (const p of er.pieces) g.research.rewards.add(p);
    changed = true;
    if (quiet || g.flags.has('era_card:' + er.flag)) continue;
    g.flags.add('era_card:' + er.flag);
    g.emit({ t: 'era', era: er.era, title: er.title, pieces: er.pieces.map((p) => REWARD_BY_ID.get(p)!.text) });
    g.emit({ t: 'sfx', id: 'quest' });
  }
  if (changed) resetMods(g);
}

function complete(g: Game, id: string) {
  g.research.done.add(id);
  g.research.current = null;
  resetMods(g);
  // the play screen shows a "Discovery!" ribbon naming what it unlocked
  g.emit({ t: 'research', id });
  g.emit({ t: 'fx', kind: 'magic', x: g.player.x, y: g.player.y - 1, n: 20 });
  g.sys.quests?.notify?.(g, 'research', 1, id);
  g.count('research');
}

function labAccept(g: Game, e: Ent, k: number): number {
  const d = kDef(k);
  if (d.cat !== 'research') return 0;
  const have = e.inv!.count(k);
  return Math.max(0, 10 - have);
}

function updateLabs(g: Game, dt: number) {
  const cur = g.research.current;
  if (!cur) {
    for (const e of g.ents.others) if (e.def.kind === 'lab' && !rustTick(e, g.simTime)) {
      e.working = false;
      setState(e, MState.Idle, 'No topic chosen: open the research tree (T)', g.simTime);
    }
    return;
  }
  const r = RESEARCH_BY_ID.get(cur);
  if (!r) {
    g.research.current = null;
    return;
  }
  const units = researchUnits(cur, g);
  // a keystone whose stages aren't done: the desk waits for them and takes no bundles
  const next = stageNext(g, cur);
  for (const e of g.ents.others) {
    if (e.def.kind !== 'lab' || e.ghost || rustTick(e, g.simTime)) continue;
    const inv = e.inv!;
    if (!e.st.unit) {
      if (next) {
        e.working = false;
        setState(e, MState.Idle, `${r.name} first: ${next[0].toLowerCase()}${next.slice(1)}`, g.simTime);
        continue;
      }
      // need one of each bundle type
      if (!r.cost.every((c) => inv.countId(c.item) >= 1)) {
        e.working = false;
        e.want = r.cost.filter((c) => inv.countId(c.item) < 1).map((c) => ITEM_BY_ID.get(c.item)!.name.toLowerCase()).join(' and ');
        setState(e, MState.Starved, 'Waiting for ' + e.want, g.simTime);
        continue;
      }
      if ((g.research.progress[cur] ?? 0) + (g.sys.labsInFlight?.[cur] ?? 0) >= units) {
        e.working = false;
        setState(e, MState.Idle, 'Other desks are finishing this topic', g.simTime);
        continue;
      }
      for (const c of r.cost) {
        inv.remove(key(c.item), 1);
        g.stats.use(key(c.item), 1);
      }
      e.st.unit = cur;
      e.st.progress = 0;
      g.sys.labsInFlight = { ...(g.sys.labsInFlight ?? {}), [cur]: (g.sys.labsInFlight?.[cur] ?? 0) + 1 };
    }
    e.working = true;
    setState(e, MState.Working, 'Studying', g.simTime);
    const speed = (e.def.speed ?? 1) * g.mods.labSpeed;
    const unitR = RESEARCH_BY_ID.get(e.st.unit as string) ?? r;
    e.st.progress += (dt * speed) / unitR.unitTime;
    if (e.st.progress >= 1) {
      const node = e.st.unit as string;
      e.st.unit = false;
      e.st.progress = 0;
      g.sys.labsInFlight[node] = Math.max(0, (g.sys.labsInFlight[node] ?? 1) - 1);
      g.research.progress[node] = (g.research.progress[node] ?? 0) + 1;
      if (g.research.progress[node] >= researchUnits(node, g) && !g.research.done.has(node)) complete(g, node);
    }
  }
}

registerSystem({
  name: 'research',
  works: true,
  tick(g, dt) {
    updateLabs(g, dt);
    if (g.tickN % 60 === 0) {
      tickValidate(g);
      grantEraRewards(g);
    }
  },
  dayStart(g) {
    g.sys.applyResearch = applyEffects;
  },
  afterLoad(g) {
    g.sys.applyResearch = applyEffects;
    // a save whose town keystones are done gets their era rewards back, without the cards
    grantEraRewards(g, true);
  },
});

PORT_HANDLERS.lab = {
  accept: labAccept,
  insert: (g, e, k, n) => {
    const can = Math.min(n, labAccept(g, e, k));
    if (can > 0) e.inv!.add(k, can);
    return can;
  },
  take: () => null,
};

export { RESEARCH, kId };
