// Fences that connect (the owner's 2.0 playtest: "the fences aren't rotated where they need to be").
// A fence, a wall or a gate is drawn as the piece for the way it meets its neighbours, so a run going
// north-south looks like one (art/fences/build.mjs draws the pieces; the procedural fallbacks are in
// src/render/art/structs.ts and objects.ts):
//   fence:wood:<mask>    a Wood Fence: rails to each side that joins a wood fence, or a gate hanging
//                        that way
//   fence:stone:<mask>   a Stone Wall: the wall runs on to each side with a wall, or east-west into a
//                        gate (a gate in a north-south wall hangs in front of the wall's end)
//   fence:gate:h         a Garden Gate across an east-west run (or standing alone)
//   fence:gate:v<n><s>   a gate in a north-south run: n 1 when it hangs from a fence or wall north of
//                        it (else it has a hinge post of its own), s 1 when a wood fence or gate south
//                        of it covers its post below the face
//   fence:map:<mask>:<v>:<season>  the map's O.FENCE (the ranch paddock), joined to O.FENCE only; v 1
//                        is the weathered look (as `o:14:1` was)
// mask = N 1 | E 2 | S 4 | W 8. Footprints, solidity and the y-sorting are the structures' own: only
// the sprite changes.
import type { Ent, Ents } from '../sim/ents';
import { O, type TileMap } from '../sim/world/tilemap';

export const FENCE_N = 1, FENCE_E = 2, FENCE_S = 4, FENCE_W = 8;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], BIT = [FENCE_N, FENCE_E, FENCE_S, FENCE_W];

type Family = 'wood' | 'stone' | 'gate';
function familyOf(e: Ent | null): Family | null {
  if (!e || e.ghost) return null;
  if (e.def.kind === 'gate') return 'gate';
  if (e.def.kind !== 'fence') return null;
  return e.def.id === 'fence_stone' ? 'stone' : 'wood';
}

/** neighbours' families, north, east, south, west */
function around(ents: Ents, x: number, y: number): (Family | null)[] {
  return BIT.map((_, d) => familyOf(ents.at(x + DX[d], y + DY[d])));
}

/** A gate hangs north-south when a fence, wall or gate stands north or south of it and none east or west. */
export function gateVertical(ents: Ents, x: number, y: number): boolean {
  const nb = around(ents, x, y);
  return (!!nb[0] || !!nb[2]) && !(nb[1] || nb[3]);
}

/** The connection mask of a wood fence or stone wall at (x, y) of family `fam`. */
export function fenceMask(ents: Ents, x: number, y: number, fam: 'wood' | 'stone'): number {
  const nb = around(ents, x, y);
  let mask = 0;
  nb.forEach((f, d) => {
    if (!f) return;
    const ns = d === 0 || d === 2;
    let joins = f === fam;
    if (f === 'gate') {
      const vert = gateVertical(ents, x + DX[d], y + DY[d]);
      // a gate joins along the way it hangs; a wall takes one only east-west
      joins = fam === 'wood' ? ns === vert : !ns && !vert;
    }
    if (joins) mask |= BIT[d];
  });
  return mask;
}

/** The connected sprite for a fence, wall or gate structure, or null for anything else. */
export function fenceSprite(ents: Ents, e: Ent): string | null {
  const fam = familyOf(e);
  if (!fam) return null;
  if (fam !== 'gate') return `fence:${fam}:${fenceMask(ents, e.x, e.y, fam)}`;
  if (!gateVertical(ents, e.x, e.y)) return 'fence:gate:h';
  const nb = around(ents, e.x, e.y);
  return `fence:gate:v${nb[0] ? 1 : 0}${nb[2] === 'wood' || nb[2] === 'gate' ? 1 : 0}`;
}

/** The connected sprite for the map's fence object at (x, y) (it is baked into the ground). */
export function mapFenceSprite(m: TileMap, x: number, y: number, season: number): string {
  let mask = 0;
  for (let d = 0; d < 4; d++) if (m.o(x + DX[d], y + DY[d]) === O.FENCE) mask |= BIT[d];
  const v = (m.deco[m.idx(x, y)] % 8) % 3 === 1 ? 1 : 0;
  return `fence:map:${mask}:${v}:${season}`;
}
