// The Sprocket Fair's ground on the square (ROADMAP.md 7.7): where the Professor's 6x6 test plate
// and the three entries stand on Fair day, and where the hosts and entrants wait. This is the spec
// the blockout is drawn from (src/render/fairground.ts, with the existing structure sprites while the
// Fair is on); Phase 6's art pass replaces the drawing and keeps these places. In tiles: the plaza
// is x 122-143, y 53-68, its middle 133,61; the clocktower stands on x 131-135, y 54-59 with its door
// at 133,59, the fountain on 132-134 x 67-68, the benches at 127/138 x 58/66, the Orders board at
// 126,64. The plate takes the open middle of the plaza in front of the clocktower; the entries
// stand on either side of it, clear of the benches, the board and the lamps.
import { STRUCT_BY_ID } from '../../data/structures';

/** the plate: the Professor builds the line you bring on it (the test bed, src/sim/testbed.ts) */
export const FAIR_PLATE = { x: 130, y: 60, w: 6, h: 6 };

export interface FairPiece {
  /** a structure id: drawn with its sprite, machines with their working frames */
  def: string;
  x: number;
  y: number;
}

/** the three entries, running (src/sim/fair.ts has their numbers): each villager's own line */
export const FAIR_ENTRY_LINES: { who: string; pieces: FairPiece[] }[] = [
  // Juniper's flour: two grist mills west of the plate, a chest of grain between them and the plate
  { who: 'juniper', pieces: [{ def: 'mill', x: 125, y: 60 }, { def: 'mill', x: 125, y: 62 }, { def: 'chest_wood', x: 127, y: 61 }] },
  // Bram's copper bars: a furnace and its ore chest, east of the plate
  { who: 'bram', pieces: [{ def: 'furnace', x: 138, y: 60 }, { def: 'chest_wood', x: 139, y: 60 }] },
  // the Professor's pickled cogbeans: her old crock and its bean chest, below Bram's
  { who: 'ottoline', pieces: [{ def: 'jar', x: 138, y: 63 }, { def: 'chest_wood', x: 139, y: 63 }] },
];

/** where they stand while the Fair is on: the Professor at the plate's south edge, the entrants by their lines */
export const FAIR_SPOTS: Record<string, [number, number]> = {
  ottoline: [133, 66],
  tobias: [129, 59],
  bram: [140, 61],
  juniper: [124, 62],
};

/** the tiles the plate and the entries take (the other villagers' festival spots keep off them) */
export function fairgroundTile(x: number, y: number): boolean {
  const P = FAIR_PLATE;
  if (x >= P.x && x < P.x + P.w && y >= P.y && y < P.y + P.h) return true;
  for (const line of FAIR_ENTRY_LINES)
    for (const p of line.pieces) {
      const [w, h] = STRUCT_BY_ID.get(p.def)?.size ?? [1, 1];
      if (x >= p.x && x < p.x + w && y >= p.y && y < p.y + h) return true;
    }
  return false;
}
