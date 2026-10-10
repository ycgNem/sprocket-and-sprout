// Rust and Restore (ROADMAP.md 6.0): the old keeper's machines rusted while the farm stood empty.
// A rusted structure does nothing, can't be picked up or broken, and comes back when the player
// presses F at it (arms take a mainspring). Only the opening's yard has rust.
import type { Game } from './Game';
import type { Ent } from './ents';
import { ITEM_BY_ID } from '../data/items';
import { MState, setState } from './mstate';
import { lesson } from './lessons';

export const isRusted = (e: Ent | null | undefined): boolean => !!e?.st?.rust;

/** the part a rusted structure needs, in words: "a mainspring", "5 copper bars" */
export function needText(e: Ent): string | null {
  if (!e.st.need) return null;
  const name = ITEM_BY_ID.get(e.st.need)?.name.toLowerCase() ?? e.st.need;
  const n = e.st.needN ?? 1;
  return n > 1 ? `${n} ${name}s` : `a ${name}`;
}

/** "Rusted: F to restore (needs a mainspring)" */
export function rustText(e: Ent): string {
  const need = needText(e);
  return need ? `Rusted: F to restore (needs ${need})` : 'Rusted: F to restore';
}

/** Rust a structure (the keeper's set dressing), optionally needing n of a part to come back. */
export function rustStruct(e: Ent, need?: string, n = 1) {
  e.st.rust = 1;
  if (need) e.st.need = need;
  if (need && n > 1) e.st.needN = n;
  e.working = false;
  setState(e, MState.Idle, rustText(e), 0);
}

/** A system's tick for a rusted structure: Idle, saying what brings it back. True when rusted. */
export function rustTick(e: Ent, now: number): boolean {
  if (!e.st.rust) return false;
  e.working = false;
  setState(e, MState.Idle, rustText(e), now);
  return true;
}

/** F at a rusted structure: take its part from the bag and bring it back. True when handled. */
export function restore(g: Game, e: Ent): boolean {
  if (!e.st.rust) return false;
  const need = e.st.need as string | undefined;
  const n = (e.st.needN as number | undefined) ?? 1;
  const have = need ? g.player.inv.countId(need) : 0;
  if (need && have < n) {
    const what = e.def.kind === 'arm' ? `The ${e.def.name.toLowerCase()}'s spring has snapped: it needs ${needText(e)}.` : `The keeper's ${e.def.name.toLowerCase()} needs ${needText(e)} to come back${n > 1 ? ` (you have ${have})` : ''}.`;
    g.toast(what);
    g.emit({ t: 'sfx', id: 'error' });
    return true;
  }
  if (need) g.player.inv.removeSpec(need, n);
  delete e.st.rust;
  delete e.st.need;
  delete e.st.needN;
  // a restored pole, wheel or machine changes the grid and the port graph
  g.ents.powerDirty = true;
  g.ents.version++;
  // the keeper's desk brings research with it: sprout bundles can be crafted, the Workshop sells desks
  if (e.def.kind === 'lab') g.flags.add('lab');
  // nobody restores a thing without looking it over: B5's "look" stage can't wait on a rusted belt that's gone
  g.flags.add('observed:' + e.def.id);
  setState(e, MState.Idle, 'Restored', g.simTime);
  g.emit({ t: 'restored', ent: e.id, x: e.x + e.w / 2, y: e.y + e.h / 2 });
  g.emit({ t: 'sfx', id: 'place', x: e.x, y: e.y });
  g.emit({ t: 'sfx', id: 'chime', v: 0.6 });
  g.count('restored');
  g.sys.quests?.notify?.(g, 'restore', 1, e.def.id);
  lesson(g, 'rust');
  return true;
}
