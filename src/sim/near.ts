// Who answers one F when several things could (the owner's playtest: the Professor standing beside
// the water wheel took the F meant for it). What stands on the faced tile comes first, then the
// tile's own things, then a villager or animal only near it: src/sim/actions.ts (interactTile) and
// src/sim/prompts.ts (the key bubble) follow the same order. A pure module: no system imports.

import type { Game } from './Game';
import type { BuildingInfo, TileMap } from './world/tilemap';

/** a villager or animal standing on a tile (its feet on it), not just near it */
export const onTile = (c: { x: number; y: number }, tx: number, ty: number) => Math.floor(c.x) === tx && Math.floor(c.y) === ty;

/**
 * The building F reaches at a tile: its own, or the one just above (its door's step). The greenhouse
 * is walked into, never entered, so a bed along its back wall (that step row) with a crop or a
 * structure on it answers F itself (the owner: hops planted against the wall couldn't be picked; F
 * there went to the wall since the first build).
 */
export function buildingFaced(g: Game, m: TileMap, tx: number, ty: number): BuildingInfo | null {
  const own = m.buildingAtTile(tx, ty);
  if (own) return own;
  const b = m.buildingAtTile(tx, ty - 1);
  return b?.id === 'greenhouse' && (g.soil.get(m.idx(tx, ty))?.crop || g.ents.rootAt(tx, ty)) ? null : b;
}
