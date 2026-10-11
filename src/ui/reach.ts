// What a structure reaches, as tiles: shaded on the ground while placing one and on hover once placed
// (src/app/play.ts drawReach; the owner after 2.0: "in order to see the radius for the scarecrow or
// harvest crane i need to break it and hover before i put it down"). Each shape is the one the game
// uses: a sprinkler's (src/sim/systems/farming.ts sprinklerTiles), the scarecrow's circle (crows), a
// field machine's square (fieldReach, the gleaner's around), a pole's supply square, a hive's range.
import type { StructureDef } from '../data/types';
import type { Game } from '../sim/Game';
import { sprinklerTiles } from '../sim/systems/farming';

/** structures whose reach shows on the ground */
export const REACH_KINDS = new Set(['pole', 'sprinkler', 'harvester', 'planter', 'gleaner', 'scarecrow', 'hive']);

/** the tiles a structure at (x, y) reaches, as y * 4096 + x */
export function reachTiles(g: Game, def: StructureDef, x: number, y: number): Set<number> {
  const tiles = new Set<number>();
  const add = (tx: number, ty: number) => tiles.add(ty * 4096 + tx);
  const k = def.kind;
  if (k === 'sprinkler') for (const [tx, ty] of sprinklerTiles((def.reach ?? 0) + (g.sys.megaBonus?.beacon ? 1 : 0), x, y)) add(tx, ty);
  else if (k === 'scarecrow') {
    const r = def.reach ?? 8;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) <= r) add(x + dx, y + dy);
  } else {
    const field = k === 'harvester' || k === 'planter' || k === 'gleaner';
    const r = k === 'pole' ? def.supply ?? 2 : (def.reach ?? 3) + (field && g.hasPerk('rancher') ? 1 : 0);
    const [w, h] = def.size;
    for (let ty = y - r; ty < y + h + r; ty++) for (let tx = x - r; tx < x + w + r; tx++) add(tx, ty);
  }
  return tiles;
}
