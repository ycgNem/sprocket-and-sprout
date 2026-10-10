// Workshop HQ (ROADMAP.md 7.8): structures inside the farmhouse. They live in a second entity
// store (`g.houseEnts`) that the machine, desk and night-shift code tick like the farm's; the
// renderer draws them with the farm's structure code. Indoors takes what makes sense in a
// workshop with no wiring: chests, the hand-era machines (nothing that draws power), the study
// desk, lamps and signs. Belts and arms wait for the Basement (2.1).
import { STRUCT_BY_ID } from '../data/structures';
import type { StructureDef } from '../data/types';
import type { Game } from './Game';
import type { PlaceCheck } from './build';
import { structFootprint } from './build';
import type { Dir, Ent, Ents } from './ents';
import { O, T } from './world/tilemap';
import { HOUSE_DOOR } from './world/house';

/** the kinds of structure that go indoors (a machine only if it draws no power) */
const INDOOR_KINDS = new Set(['chest', 'machine', 'lab', 'lamp', 'decor']);

/** why a structure can't go indoors, or null if it can */
export function indoorRule(def: StructureDef): string | null {
  if (def.kind === 'belt' || def.kind === 'underground' || def.kind === 'splitter' || def.kind === 'arm') return 'Belts and arms stay outside: the farmhouse has no Basement for them.';
  if (!INDOOR_KINDS.has(def.kind)) return `A ${def.name.toLowerCase()} belongs outside.`;
  if (def.powerUse) return `The ${def.name.toLowerCase()} needs power: there's no grid indoors.`;
  // the bee crates feed bumblebots, which fly outdoors
  if (def.id.startsWith('crate_')) return 'Bumblebots fly outdoors: their crates stay outside.';
  return null;
}

export const goesIndoors = (defId: string) => {
  const d = STRUCT_BY_ID.get(defId);
  return !!d && !indoorRule(d);
};

/** the store under the player: the farmhouse's indoors, the farm's outdoors, none in the Deepworks */
export function hereEnts(g: Game): Ents | null {
  if (g.player.where === 'house') return g.houseEnts;
  if (g.player.where === 'world') return g.ents;
  return null;
}

/** furniture, structures and the room's fixed pieces that a structure can't stand on */
const FREE_OBJ = new Set<number>([O.NONE, O.RUG]);

/**
 * Can a structure go on the farmhouse floor here? Floor tiles only (not the walls, the bed, the
 * stove...), not over furniture (a rug is fine), never in the doorway, never under the player.
 */
export function canPlaceIndoors(g: Game, defId: string, x: number, y: number, rot: Dir): PlaceCheck {
  const def = STRUCT_BY_ID.get(defId);
  if (!def) return { ok: false, reason: 'Unknown' };
  const rule = indoorRule(def);
  if (rule) return { ok: false, reason: rule };
  const m = g.sys.house?.map;
  if (!m) return { ok: false, reason: 'Not here' };
  const decorAt = g.sys.house?.decorAt as ((g: Game, x: number, y: number) => { id: string } | null) | undefined;
  const flatDecor = g.sys.house?.flatDecor as ((id: string) => boolean) | undefined;
  for (const t of structFootprint(def, x, y, def.rotatable ? rot : 0)) {
    if (!m.inb(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
    const gr = m.g(t.x, t.y);
    if (gr !== T.WOODFLOOR && gr !== T.PATH) return { ok: false, reason: 'That has to go on the floor.' };
    if (t.x === HOUSE_DOOR[0] && t.y >= HOUSE_DOOR[1] - 2) return { ok: false, reason: 'Keep the doorway clear.' };
    if (!FREE_OBJ.has(m.o(t.x, t.y))) return { ok: false, reason: 'That spot is taken.' };
    const d = decorAt?.(g, t.x, t.y);
    if (d && !flatDecor?.(d.id)) return { ok: false, reason: 'That spot is taken.' };
    if (g.houseEnts.at(t.x, t.y)) return { ok: false, reason: 'Something is already here' };
    if (def.solid && Math.abs(g.player.x - (t.x + 0.5)) < 0.8 && Math.abs(g.player.y - (t.y + 0.5)) < 0.7) return { ok: false, reason: 'You are standing there' };
  }
  return { ok: true };
}

/** Place a structure indoors (the item was already taken from the bag). */
export function placeIndoors(g: Game, defId: string, x: number, y: number, rot: Dir): Ent {
  const def = STRUCT_BY_ID.get(defId)!;
  const e = g.houseEnts.add(defId, x, y, def.rotatable ? rot : 0);
  g.emit({ t: 'fx', kind: 'dust', x: e.x + e.w / 2, y: e.y + e.h / 2, n: 8 });
  g.emit({ t: 'sfx', id: 'place', x: e.x, y: e.y });
  g.count('placed_indoors');
  return e;
}

/** structures the farm's and the farmhouse's stores hold, for counts that span both */
export const allEnts = (g: Game): Ent[] => [...g.ents.map.values(), ...g.houseEnts.map.values()];
