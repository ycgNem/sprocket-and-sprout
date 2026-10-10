// Rust and Restore (ROADMAP.md 6.0): the old keeper's machines rusted while the farm stood empty.
// A rusted structure does nothing, can't be picked up or broken, and comes back when the player
// presses F at it (arms take a mainspring). Only the opening's yard has rust.
import type { Game } from './Game';
import type { Ent } from './ents';
import { ITEM_BY_ID } from '../data/items';
import { MState, setState } from './mstate';
import { lesson } from './lessons';

export const isRusted = (e: Ent | null | undefined): boolean => !!e?.st?.rust;

/** "Rusted: F to restore (needs a mainspring)" */
export function rustText(e: Ent): string {
  const need = e.st.need ? ITEM_BY_ID.get(e.st.need)?.name.toLowerCase() : null;
  return need ? `Rusted: F to restore (needs a ${need})` : 'Rusted: F to restore';
}

/** Rust a structure (the yard's set dressing), optionally needing a part to come back. */
export function rustStruct(e: Ent, need?: string) {
  e.st.rust = 1;
  if (need) e.st.need = need;
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
  if (need && g.player.inv.countId(need) <= 0) {
    const name = ITEM_BY_ID.get(need)?.name.toLowerCase() ?? need;
    g.toast(`The ${e.def.name.toLowerCase()}'s spring has snapped: it needs a ${name}.`);
    g.emit({ t: 'sfx', id: 'error' });
    return true;
  }
  if (need) g.player.inv.removeSpec(need, 1);
  delete e.st.rust;
  delete e.st.need;
  // the keeper's desk brings research with it: sprout bundles can be crafted, the Workshop sells desks
  if (e.def.kind === 'lab') g.flags.add('lab');
  setState(e, MState.Idle, 'Restored', g.simTime);
  g.emit({ t: 'restored', ent: e.id, x: e.x + e.w / 2, y: e.y + e.h / 2 });
  g.emit({ t: 'sfx', id: 'place', x: e.x, y: e.y });
  g.emit({ t: 'sfx', id: 'chime', v: 0.6 });
  g.count('restored');
  g.sys.quests?.notify?.(g, 'restore', 1, e.def.id);
  lesson(g, 'rust');
  return true;
}
