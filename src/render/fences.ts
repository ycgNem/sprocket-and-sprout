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
import { STRUCT_BY_ID } from '../data/structures';
import type { StructureDef } from '../data/types';
import type { Ent, Ents } from '../sim/ents';
import { O, type TileMap } from '../sim/world/tilemap';

export const FENCE_N = 1, FENCE_E = 2, FENCE_S = 4, FENCE_W = 8;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], BIT = [FENCE_N, FENCE_E, FENCE_S, FENCE_W];

type Family = 'wood' | 'stone' | 'gate';
/** what stands at a tile, as far as fences go */
type FamAt = (x: number, y: number) => Family | null;

function familyOfDef(def: StructureDef | undefined): Family | null {
  if (!def) return null;
  if (def.kind === 'gate') return 'gate';
  if (def.kind !== 'fence') return null;
  return def.id === 'fence_stone' ? 'stone' : 'wood';
}
function familyOf(e: Ent | null): Family | null {
  return !e || e.ghost ? null : familyOfDef(e.def);
}
/** placed structures only: a blueprint ghost does not join */
const placed = (ents: Ents): FamAt => (x, y) => familyOf(ents.at(x, y));

/** neighbours' families, north, east, south, west */
function around(at: FamAt, x: number, y: number): (Family | null)[] {
  return BIT.map((_, d) => at(x + DX[d], y + DY[d]));
}

function vertical(at: FamAt, x: number, y: number): boolean {
  const nb = around(at, x, y);
  return (!!nb[0] || !!nb[2]) && !(nb[1] || nb[3]);
}

function maskOf(at: FamAt, x: number, y: number, fam: 'wood' | 'stone'): number {
  const nb = around(at, x, y);
  let mask = 0;
  nb.forEach((f, d) => {
    if (!f) return;
    const ns = d === 0 || d === 2;
    let joins = f === fam;
    if (f === 'gate') {
      const vert = vertical(at, x + DX[d], y + DY[d]);
      // a gate joins along the way it hangs; a wall takes one only east-west
      joins = fam === 'wood' ? ns === vert : !ns && !vert;
    }
    if (joins) mask |= BIT[d];
  });
  return mask;
}

function pieceOf(at: FamAt, fam: Family, x: number, y: number): string {
  if (fam !== 'gate') return `fence:${fam}:${maskOf(at, x, y, fam)}`;
  if (!vertical(at, x, y)) return 'fence:gate:h';
  const nb = around(at, x, y);
  return `fence:gate:v${nb[0] ? 1 : 0}${nb[2] === 'wood' || nb[2] === 'gate' ? 1 : 0}`;
}

/** A gate hangs north-south when a fence, wall or gate stands north or south of it and none east or west. */
export function gateVertical(ents: Ents, x: number, y: number): boolean {
  return vertical(placed(ents), x, y);
}

/** The connection mask of a wood fence or stone wall at (x, y) of family `fam`. */
export function fenceMask(ents: Ents, x: number, y: number, fam: 'wood' | 'stone'): number {
  return maskOf(placed(ents), x, y, fam);
}

/** The connected sprite for a fence, wall or gate structure, or null for anything else. */
export function fenceSprite(ents: Ents, e: Ent): string | null {
  const fam = familyOf(e);
  return fam ? pieceOf(placed(ents), fam, e.x, e.y) : null;
}

/**
 * The piece a fence, wall or gate not built yet would show at (x, y): a blueprint ghost, or the
 * placement preview, where `planned` holds the other tiles being placed with it (a drag line or a
 * pasted blueprint, keyed "x,y", to their structure ids). Placed structures, blueprint ghosts and the
 * planned tiles all count as neighbours, so a north-south line previews as one. Null for anything
 * that isn't a fence.
 */
export function plannedFenceSprite(ents: Ents, defId: string, x: number, y: number, planned?: Map<string, string>): string | null {
  const fam = familyOfDef(STRUCT_BY_ID.get(defId));
  if (!fam) return null;
  const at: FamAt = (tx, ty) => {
    const p = planned?.get(`${tx},${ty}`);
    if (p) return familyOfDef(STRUCT_BY_ID.get(p));
    const e = ents.at(tx, ty);
    return e ? familyOfDef(e.def) : null;
  };
  return pieceOf(at, fam, x, y);
}

/** The connected sprite for the map's fence object at (x, y) (it is baked into the ground). */
export function mapFenceSprite(m: TileMap, x: number, y: number, season: number): string {
  let mask = 0;
  for (let d = 0; d < 4; d++) if (m.o(x + DX[d], y + DY[d]) === O.FENCE) mask |= BIT[d];
  const v = (m.deco[m.idx(x, y)] % 8) % 3 === 1 ? 1 : 0;
  return `fence:map:${mask}:${v}:${season}`;
}
