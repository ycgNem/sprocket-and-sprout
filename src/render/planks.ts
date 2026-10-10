// Plank decks (ROADMAP 1.2 bug 3; the owner's 2.0 playtest: "make sure the bridges are seamless"): river
// bridges, the lake dock, the pier and the placeable Plank Walk are T.PLANKS tiles, drawn from the
// terrain sheet's plank classes (art/terrain/tools/planks.mjs). Every tile of a bridge agrees on
// its direction and its railings:
//   - the deck runs along the longer straight run of planks through the tile; its boards lie across
//     it, the way a bridge is planked (an east-west bridge: `planks_h`, boards north-south; a dock
//     or the pier running north-south: `planks_v`, boards east-west), each board one piece across
//     the whole deck (the board colours follow the position along the run)
//   - a run (the 4-connected plank tiles) that spans water (somewhere water lies beyond the deck on
//     both sides: a bridge, the dock, the pier) is a bridge: its long sides carry a railing from end
//     to end, over the banks too, except where a road joins from the side; any other run (a Plank
//     Walk on land) gets railings only on sides that face water
//   - a railing on the far (north) side stands on the deck's edge, the near (south) one in front of
//     it with the deck's face below; a post stands wherever a railing stops (`planks_post_<corner>`)
//   - where the deck ends along its run it lands on the bank, or stops over the water (the pier's
//     tip): `planks_end_<side>`; a long side with no railing shows the deck's edge
//     (`planks_side_<side>`)
// The near railing and its posts stand in front of whoever walks the deck's south row, so they are
// y-sorted (plankFront, drawn by the renderer's object pass); everything else is baked into the
// ground chunk (drawPlanks). Under a deck the dual grid carries the ground on (plankVertex): the
// halves of the vertex tiles that show beside the deck look as if the bank ran on underneath it,
// so no shore notches into a road or a beach at the deck's ends and sides.
import { hash2 } from '../engine/rng';
import { T, type TileMap } from '../sim/world/tilemap';
import { terrainArt } from './art/sheets';

export type PlankSide = 'n' | 'e' | 's' | 'w';
/** what lies beyond one side of a plank tile (a road is a path: it may join a bridge from the side) */
export type PlankEdge = 'plank' | 'water' | 'land' | 'road';

const SIDES: PlankSide[] = ['n', 'e', 's', 'w'];
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
/** a run bigger than this is a floor, not a bridge: read tile by tile */
const MAX_RUN = 4096;
/** how far a straight run is followed to choose the deck's direction */
const RUN = 24;

function edgeAt(m: TileMap, x: number, y: number): PlankEdge {
  if (!m.inb(x, y)) return 'land';
  const t = m.g(x, y);
  if (t === T.PLANKS) return 'plank';
  if (m.isWater(x, y)) return 'water';
  return t === T.PATH ? 'road' : 'land';
}
const isPlank = (m: TileMap, x: number, y: number) => m.inb(x, y) && m.g(x, y) === T.PLANKS;

/** One plank run (4-connected T.PLANKS tiles): does it span water? */
interface Run {
  /** some tile has water beyond the deck on both sides (across it either way): a bridge, the dock,
   * the pier; its long sides carry railings from end to end */
  bridge: boolean;
}
/** runs by tile index, for one map at one version (rebuilt lazily when the map changes) */
let cache: { m: TileMap; ver: number; runs: Map<number, Run> } | null = null;

function runOf(m: TileMap, x: number, y: number): Run {
  if (!cache || cache.m !== m || cache.ver !== m.version) cache = { m, ver: m.version, runs: new Map() };
  const i = m.idx(x, y);
  const hit = cache.runs.get(i);
  if (hit) return hit;
  // flood the run
  const tiles: number[] = [i];
  const seen = new Set<number>(tiles);
  for (let k = 0; k < tiles.length && tiles.length < MAX_RUN; k++) {
    const tx = tiles[k] % m.w, ty = Math.floor(tiles[k] / m.w);
    for (let d = 0; d < 4; d++) {
      const nx = tx + DX[d], ny = ty + DY[d];
      if (!isPlank(m, nx, ny)) continue;
      const j = m.idx(nx, ny);
      if (!seen.has(j)) { seen.add(j); tiles.push(j); }
    }
  }
  // a bridge: walking straight across the deck from one side, there is water before and after it
  let bridge = false;
  for (const j of tiles) {
    if (bridge) break;
    const tx = j % m.w, ty = Math.floor(j / m.w);
    for (const [ax, ay] of [[0, 1], [1, 0]]) {
      if (isPlank(m, tx - ax, ty - ay) || !m.isWater(tx - ax, ty - ay)) continue;
      let k = 1;
      while (k < 64 && isPlank(m, tx + ax * k, ty + ay * k)) k++;
      if (m.isWater(tx + ax * k, ty + ay * k)) { bridge = true; break; }
    }
  }
  const run: Run = { bridge };
  for (const j of tiles) cache.runs.set(j, run);
  return run;
}

/** how many plank tiles follow (x, y) in direction (dx, dy) */
function reach(m: TileMap, x: number, y: number, dx: number, dy: number): number {
  let n = 0;
  while (n < RUN && isPlank(m, x + dx * (n + 1), y + dy * (n + 1))) n++;
  return n;
}

/**
 * The direction a plank tile's deck runs: 'h' (east-west) or 'v' (north-south), from the longer
 * straight run of planks through it (every tile of a rectangular deck agrees; each arm of an L-shaped
 * walk goes its own way). A tie (a square patch, a lone tile) runs between the water sides if there
 * are some, else east-west.
 */
export function plankAxis(m: TileMap, x: number, y: number): 'h' | 'v' {
  const h = reach(m, x, y, 1, 0) + reach(m, x, y, -1, 0);
  const v = reach(m, x, y, 0, 1) + reach(m, x, y, 0, -1);
  if (h !== v) return h > v ? 'h' : 'v';
  const wet = (d: number) => m.isWater(x + DX[d], y + DY[d]);
  if ((wet(1) || wet(3)) && !(wet(0) || wet(2))) return 'v';
  return 'h';
}

/** Does side d of plank tile (x, y) carry a railing? */
function railAt(m: TileMap, x: number, y: number, d: number): boolean {
  // ends of the run (sides along its direction) are landings or open ends, never railed
  const axis = plankAxis(m, x, y);
  if (axis === 'h' ? d === 1 || d === 3 : d === 0 || d === 2) return false;
  const e = edgeAt(m, x + DX[d], y + DY[d]);
  return e === 'water' || (e === 'land' && runOf(m, x, y).bridge);
}

/** The pieces of one plank tile: `ground` is baked with the terrain, `front` is y-sorted in front of the deck. */
export interface PlankPieces {
  ground: string[];
  front: string[];
}

/**
 * The terrain classes for one plank tile, bottom to top: the deck, its ends and edges, the railings,
 * the posts. Depends only on the map, so it can be unit-tested with a small TileMap.
 */
export function plankParts(m: TileMap, x: number, y: number): PlankPieces {
  const axis = plankAxis(m, x, y);
  const edge = SIDES.map((_, d) => edgeAt(m, x + DX[d], y + DY[d]));
  const rail = SIDES.map((_, d) => railAt(m, x, y, d));
  const isEnd = (d: number) => (axis === 'h' ? d === 1 || d === 3 : d === 0 || d === 2);
  const ground = [`planks_${axis}`];
  const front: string[] = [];
  for (let d = 0; d < 4; d++) {
    if (edge[d] === 'plank' || rail[d]) continue;
    ground.push(`planks_${isEnd(d) ? 'end' : 'side'}_${SIDES[d]}`);
  }
  for (let d = 0; d < 4; d++) if (rail[d]) (d === 2 ? front : ground).push(`planks_rail_${SIDES[d]}`);
  // a post where a railing stops: the railing on side a goes on into the next tile across side b
  // only if that tile is deck with a railing on its side a too
  const corners: [string, number, number][] = [['nw', 0, 3], ['ne', 0, 1], ['sw', 2, 3], ['se', 2, 1]];
  for (const [c, a, b] of corners) {
    const stops = (r: number, o: number) => rail[r] && !(edge[o] === 'plank' && railAt(m, x + DX[o], y + DY[o], r));
    if (stops(a, b) || stops(b, a)) (a === 2 ? front : ground).push(`planks_post_${c}`);
  }
  return { ground, front };
}

/** All of a plank tile's pieces in drawing order (ground, then front): the whole tile as one list. */
export function plankPieces(m: TileMap, x: number, y: number): string[] {
  const p = plankParts(m, x, y);
  return [...p.ground, ...p.front];
}

/**
 * The deck variant hash: boards lie across the run, so a board is one piece over the whole deck when
 * every tile across it uses the same board colours (the variant follows the position along the run);
 * the detail (grain, knots) varies tile by tile. The terrain sheet holds 3 colourings x 3 details.
 */
export function deckHash(axis: 'h' | 'v', x: number, y: number): number {
  const along = axis === 'h' ? x : y;
  const colouring = Math.floor(hash2(along, 0, 19) * 3);
  const detail = Math.floor(hash2(x, y, 23) * 3);
  return (colouring * 3 + detail + 0.5) / 9;
}

/**
 * Draw the plank tile at map (x, y) with the imported terrain art: `draw(name)` gets each terrain
 * sprite name in order, to be drawn at the tile's top-left. Returns false (and draws nothing) when
 * the terrain sheet has no plank deck classes, so the caller can fall back to its own drawing.
 * The near railing is not drawn here (plankFront).
 */
export function drawPlanks(m: TileMap, x: number, y: number, season: number, draw: (name: string) => void): boolean {
  const art = terrainArt();
  if (!art || !art.hasTile('planks_h') || !art.hasTile('planks_v')) return false;
  const p = plankParts(m, x, y);
  const h = hash2(x, y, 9);
  p.ground.forEach((cls, i) => {
    const name = art.tile(cls, i === 0 ? deckHash(cls === 'planks_h' ? 'h' : 'v', x, y) : h, season);
    if (name) draw(name);
  });
  return true;
}

/**
 * The near railing of a plank tile and its posts (the terrain sprite names, drawn at the tile's
 * top-left), or [] when it has none or there is no plank art. The renderer y-sorts them at the
 * tile's south edge, so someone on the deck's south row walks behind the railing.
 */
export function plankFront(m: TileMap, x: number, y: number, season: number): string[] {
  const art = terrainArt();
  if (!art || !art.hasTile('planks_h')) return [];
  const p = plankParts(m, x, y);
  if (!p.front.length) return [];
  const h = hash2(x, y, 9);
  const out: string[] = [];
  for (const cls of p.front) {
    const name = art.tile(cls, h, season);
    if (name) out.push(name);
  }
  return out;
}

/** The dual-grid class a plank corner stands for while its vertex is resolved (see plankVertex). */
export const PLANK_UNDER = 'planks';

/**
 * Resolve the plank corners of one dual-grid vertex: cs holds the four corner classes (NW, NE, SW,
 * SE; PLANK_UNDER where the tile is deck) and is rewritten in place. A plank corner takes the class
 * of the ground beside it, so the ground on the visible half of the vertex tile runs straight on
 * under the deck: the neighbour along the deck's run first (where the deck lands on a road, the road
 * goes on under it), then the one across it (a bank runs on under a bridge), then the diagonal one.
 * A vertex all under deck (hidden) takes water under a bridge, else grass.
 */
export function plankVertex(m: TileMap, vx: number, vy: number, cs: (string | null)[]) {
  const H = [1, 0, 3, 2], V = [2, 3, 0, 1], D = [3, 2, 1, 0];
  const seen = (k: number) => (cs[k] !== PLANK_UNDER ? cs[k] : null);
  const out = cs.slice();
  for (let k = 0; k < 4; k++) {
    if (cs[k] !== PLANK_UNDER) continue;
    const tx = vx - 1 + (k & 1), ty = vy - 1 + (k >> 1);
    if (!isPlank(m, tx, ty)) { out[k] = null; continue; }
    const h = seen(H[k]), v = seen(V[k]);
    out[k] = (plankAxis(m, tx, ty) === 'h' ? h ?? v : v ?? h) ?? seen(D[k]) ?? (runOf(m, tx, ty).bridge ? 'water' : 'grass');
  }
  for (let k = 0; k < 4; k++) cs[k] = out[k];
}
