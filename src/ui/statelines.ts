// The machine contract in words: the state line and the rate line every surface shares
// (hover tooltips, structure windows, the line inspector). ROADMAP.md 4.3.
import { C } from '../data/palette';
import { ITEM_BY_ID } from '../data/items';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import { fmt } from '../sim/lines';
import { MState, stateText } from '../sim/mstate';
import { armRate } from '../sim/systems/arms';
import { powerState } from '../sim/systems/power';

export const STATE_COL: Record<MState, number> = {
  [MState.Idle]: C.pebble,
  [MState.Working]: C.lime,
  [MState.Starved]: C.amber,
  [MState.Blocked]: C.rose,
  [MState.Unpowered]: C.sky,
  [MState.NeedsFuel]: C.stone,
};

/** the same colours on a light (paper / peach) panel, where amber and lime don't read */
export const STATE_COL_PAPER: Record<MState, number> = {
  [MState.Idle]: C.oak,
  [MState.Working]: C.moss,
  [MState.Starved]: C.rust,
  [MState.Blocked]: C.brick,
  [MState.Unpowered]: C.dusk,
  [MState.NeedsFuel]: C.walnut,
};

/** structures that have a state worth a line */
export function hasState(e: Ent): boolean {
  return !!(e.arm || e.mach || e.belt || e.inv || e.gen || ['lab', 'drill', 'harvester', 'planter', 'gleaner', 'gantry', 'tapper'].includes(e.def.kind));
}

/** "Waiting for cogbeans", "Working: Cogbean Pickles", "Running at 60%: the grid is 40 sparks short" */
export function structStateLine(g: Game, e: Ent, paper = false): { text: string; color: number } | null {
  if (!hasState(e) || e.def.kind === 'pole') return null;
  // chests and crates: the fill tells it
  if ((e.def.kind === 'chest' || e.def.kind === 'shipbin') && e.inv) {
    const used = e.inv.slots.filter(Boolean).length;
    if (e.state !== MState.Blocked && used === 0) return { text: 'Empty', color: paper ? C.oak : C.pebble };
    return { text: e.state === MState.Blocked ? `Full (${used}/${e.inv.size} stacks)` : `${used}/${e.inv.size} stacks used`, color: (paper ? STATE_COL_PAPER : STATE_COL)[e.state] };
  }
  let text = stateText(e);
  if (e.state === MState.Working && e.mach?.recipe && e.mach.crafting && !e.why) text = 'Working: ' + (ITEM_BY_ID.get(e.mach.recipe.out[0].item)?.name ?? '');
  // a consumer on a short grid says by how much
  if (e.def.powerUse && e.net && !e.off) {
    const n = powerState(g).nets.get(e.net);
    if (n && n.demand > n.cap + 0.5) text += ` (${Math.ceil(n.demand - n.cap)} sparks short)`;
  }
  if (e.arm && e.st.wind > 0) text += `  - wound, ${Math.ceil(e.st.wind)}s`;
  return { text, color: (paper ? STATE_COL_PAPER : STATE_COL)[e.state] };
}

/** what it actually moves: items per minute over the last minute */
export function structRateLine(g: Game, e: Ent): string | null {
  const log = g.stats.states;
  if (e.arm) return `${fmt(log.rate(e, 'out'))}/min carried (up to ${Math.round(armRate(e, g.mods.armHand) * (e.st.wind > 0 ? 2 : 1))})`;
  if (e.mach) return `${fmt(log.rate(e, 'out'))}/min made`;
  if (['harvester', 'gleaner', 'gantry'].includes(e.def.kind)) return `${fmt(log.rate(e, 'out'))}/min picked`;
  if (e.def.kind === 'drill') return `${fmt(log.rate(e, 'out'))}/min dug`;
  if (e.def.kind === 'chest' || e.def.kind === 'shipbin' || e.def.kind === 'lab' || e.def.kind === 'depot') {
    const r = log.rate(e, 'in');
    return r > 0 ? `${fmt(r)}/min arriving` : null;
  }
  return null;
}
