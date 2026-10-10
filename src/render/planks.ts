// Plank decks (ROADMAP 1.2 bug 3): river bridges, the lake dock, the pier and the placeable Plank Walk
// are T.PLANKS tiles. Each one is drawn from the terrain sheet's plank classes (art/terrain/tools/
// planks.mjs) by looking at its neighbours:
//   - the deck runs along the longer straight run of planks through the tile (a bridge over a river
//     runs east-west: `planks_h`; a dock or the pier runs north-south: `planks_v`; the boards are laid
//     along the run)
//   - a side that faces water gets a railing (`planks_rail_<side>`), with a post wherever the railing
//     stops (`planks_post_<corner>`): at the bank, at the end of a dock, where the deck leaves the water
//   - a side that meets land at the end of the run gets the heavy end beam (`planks_end_<side>`), a
//     long side over land gets the deck's edge (`planks_side_<side>`)
// so a lone Plank Walk tile on grass is a framed little deck with no rails, and a bridge has rails
// along the water and beams where it lands on the bank.
//
// The renderer calls drawPlanks() for each T.PLANKS tile while baking a ground chunk (bakeArt, pass 2)
// and planksUnder() for the dual-grid class under a plank tile (water only where there is water).
import { hash2 } from '../engine/rng';
import { T, type TileMap } from '../sim/world/tilemap';
import { terrainArt } from './art/sheets';

export type PlankSide = 'n' | 'e' | 's' | 'w';
/** what lies beyond one side of a plank tile */
export type PlankEdge = 'plank' | 'water' | 'land';

const SIDES: PlankSide[] = ['n', 'e', 's', 'w'];
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
/** how far a run is followed to choose the deck's direction */
const RUN = 12;

function edgeAt(m: TileMap, x: number, y: number): PlankEdge {
  if (!m.inb(x, y)) return 'land';
  if (m.g(x, y) === T.PLANKS) return 'plank';
  return m.isWater(x, y) ? 'water' : 'land';
}

function run(m: TileMap, x: number, y: number, dx: number, dy: number): number {
  let n = 0;
  while (n < RUN && m.g(x + dx * (n + 1), y + dy * (n + 1)) === T.PLANKS) n++;
  return n;
}

/**
 * The direction a plank tile's deck runs: 'h' (east-west) or 'v' (north-south), from the longer
 * straight run of planks through it. A tie (a square patch, a lone tile) runs between the water
 * sides if there are some, else east-west.
 */
export function plankAxis(m: TileMap, x: number, y: number): 'h' | 'v' {
  const h = run(m, x, y, 1, 0) + run(m, x, y, -1, 0);
  const v = run(m, x, y, 0, 1) + run(m, x, y, 0, -1);
  if (h !== v) return h > v ? 'h' : 'v';
  const wet = (d: number) => edgeAt(m, x + DX[d], y + DY[d]) === 'water';
  if ((wet(1) || wet(3)) && !(wet(0) || wet(2))) return 'v';
  return 'h';
}

/**
 * The terrain classes for one plank tile, bottom to top: the deck, the edges and end beams, the
 * railings, the corner posts. Depends only on the map, so it can be unit-tested with a small TileMap.
 */
export function plankPieces(m: TileMap, x: number, y: number): string[] {
  const axis = plankAxis(m, x, y);
  const edge = SIDES.map((_, d) => edgeAt(m, x + DX[d], y + DY[d]));
  const out = [`planks_${axis}`];
  // a side is an end of the run when it lies along the deck's direction
  const isEnd = (d: number) => (axis === 'h' ? d === 1 || d === 3 : d === 0 || d === 2);
  for (let d = 0; d < 4; d++) if (edge[d] === 'land') out.push(`planks_${isEnd(d) ? 'end' : 'side'}_${SIDES[d]}`);
  for (let d = 0; d < 4; d++) if (edge[d] === 'water') out.push(`planks_rail_${SIDES[d]}`);
  // a post where a railing stops: the railing on side a goes on into the next tile across side b only
  // if that tile is deck with water on its side a too (the diagonal tile)
  const corners: [string, number, number][] = [['nw', 0, 3], ['ne', 0, 1], ['sw', 2, 3], ['se', 2, 1]];
  for (const [c, a, b] of corners) {
    const diag = edgeAt(m, x + DX[a] + DX[b], y + DY[a] + DY[b]);
    const stops = (r: number, o: number) => edge[r] === 'water' && !(edge[o] === 'plank' && diag === 'water');
    if (stops(a, b) || stops(b, a)) out.push(`planks_post_${c}`);
  }
  return out;
}

/**
 * Draw the plank tile at map (x, y) with the imported terrain art: `draw(name)` gets each terrain
 * sprite name in order, to be drawn at the tile's top-left. Returns false (and draws nothing) when
 * the terrain sheet has no plank deck classes, so the caller can fall back to its own drawing.
 */
export function drawPlanks(m: TileMap, x: number, y: number, season: number, draw: (name: string) => void): boolean {
  const art = terrainArt();
  if (!art || !art.hasTile('planks_h') || !art.hasTile('planks_v')) return false;
  const h = hash2(x, y, 9);
  for (const cls of plankPieces(m, x, y)) {
    const name = art.tile(cls, h, season);
    if (name) draw(name);
  }
  return true;
}

/**
 * The dual-grid class under a plank tile: water when the planks span water (any of the 8 tiles
 * around is water: a bridge, a dock), else null, so the corners take the land around it and a Plank
 * Walk on grass gets no ring of shore.
 */
export function planksUnder(m: TileMap, x: number, y: number): 'water' | null {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m.isWater(x + dx, y + dy)) return 'water';
  return null;
}
