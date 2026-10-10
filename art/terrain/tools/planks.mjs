// The plank deck set (ROADMAP 1.2 bug 3; the owner's 2.0 playtest: "make sure the bridges are
// seamless"): bridges, docks, the pier and the placeable Plank Walk. Drawn by rule, not generated: the
// boards must run on unbroken over decks of any size and every overlay must line up with the boards
// under it, which generation can't promise (STYLE.md, "What generation can't do well"). Wood ramp from
// STYLE.md: #45293f #7a3045 #9e4539 #cd683d #e6904e, light from the upper left, no outline on the deck
// (terrain), selective dark edges on the raised parts. src/render/planks.ts says which piece goes where.
//
// Writes per-tile classes for scripts/terrain-import.mjs (tiles/<class>/<n>.png, 16x16):
//   planks_h/0-8   deck of a run going east-west (a river bridge): boards lie across it, north-south,
//                  4 px wide; tile n = colouring (n / 3) x detail (n % 3). A colouring fixes each board's
//                  colour; the renderer keeps one colouring along each board, so a board runs unbroken
//                  across the deck; details (grain, knots) never touch the top and bottom rows, so any
//                  detail stacks on any other
//   planks_v/0-8   deck of a run going north-south (the dock, the pier): the same boards turned east-west
//   planks/0-2     = planks_h colourings 0-2 (the fallback the renderer draws without src/render/planks.ts)
//   planks_rail_{n,e,s,w}   a railing along a long side: n stands on the deck's far edge, s in front of
//                  the deck with the deck's face below it (y-sorted by the renderer), w and e seen from above
//   planks_end_{n,e,s,w}    where the deck ends along its run: it lands on the bank or stops over water
//                  (a heavier end board; at the south end, the deck's face)
//   planks_side_{n,e,s,w}   a long side with no railing (a Plank Walk on land, a road joining a bridge)
//   planks_post_{nw,ne,sw,se}  a post where a railing stops (the corners of a bridge, a dock, the pier)
// Usage: node art/terrain/tools/planks.mjs [outDir]   (run from the repo root; build.sh runs it)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { rgbOf } from '../../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TILES = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, '..', 'tiles');
const S = 16;
const D0 = '#2e222f', D1 = '#45293f', D2 = '#7a3045', D3 = '#9e4539', D4 = '#cd683d', D5 = '#e6904e';

// start clean: every planks* class is written by this script only
for (const d of fs.existsSync(TILES) ? fs.readdirSync(TILES) : []) if (d === 'planks' || d.startsWith('planks_')) fs.rmSync(path.join(TILES, d), { recursive: true });

const grid = () => new Array(S * S).fill(null);
const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) g[y * S + x] = c; };
const get = (g, x, y) => g[y * S + x];
function save(g, cls, name) {
  const data = new Uint8Array(S * S * 4);
  g.forEach((c, i) => { if (c) data.set([...rgbOf(c), 255], i * 4); });
  const dir = path.join(TILES, cls);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.png`), encodePNG(S, S, data));
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
/** transpose (x <-> y): a north-south-board deck turned into an east-west-board one, light kept top-left */
const transpose = (g) => { const o = grid(); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) o[y * S + x] = g[x * S + y]; return o; };

// ---- the deck ----
// Four boards across the tile, 4 px each: a lit edge, two body columns and the dark gap. A board is
// worn, new (a lighter edge) or old (a darker streak down its body); a colouring sets the four.
const BOARD = {
  worn: { lit: D4, body: D4, body2: D4, grain: D3, gap: D2 },
  new: { lit: D5, body: D4, body2: D4, grain: D3, gap: D2 },
  old: { lit: D4, body: D4, body2: D3, grain: D3, gap: D2 },
};
const COLOURINGS = [
  ['worn', 'new', 'worn', 'old'],
  ['new', 'worn', 'old', 'worn'],
  ['worn', 'old', 'new', 'worn'],
];
/** the deck of an east-west run: boards north-south. Details stay off rows 0 and 15 (they stack). */
function deckH(colouring, seed) {
  const r = rng(seed), g = grid();
  colouring.forEach((kind, k) => {
    const b = BOARD[kind], x0 = 4 * k;
    for (let y = 0; y < S; y++) { put(g, x0, y, b.lit); put(g, x0 + 1, y, b.body); put(g, x0 + 2, y, b.body2); put(g, x0 + 3, y, b.gap); }
    // grain: a darker streak along the board, now and then a light catch on its lit edge
    if (r() < 0.8) {
      const x = x0 + 1 + Math.floor(r() * 2), y = 2 + Math.floor(r() * 8), len = 2 + Math.floor(r() * 4);
      for (let i = 0; i < len && y + i < S - 1; i++) if (get(g, x, y + i) !== D3) put(g, x, y + i, b.grain);
    }
    if (kind !== 'new' && r() < 0.4) { const y = 2 + Math.floor(r() * 11); put(g, x0, y, D5); put(g, x0, y + 1, D5); }
    // a knot now and then
    if (r() < 0.25) { const y = 3 + Math.floor(r() * 9), x = x0 + 1; put(g, x, y, D2); put(g, x + 1, y, D3); }
  });
  return g;
}
const DETAILS = [11, 23, 37];
COLOURINGS.forEach((col, c) => DETAILS.forEach((seed, d) => {
  const g = deckH(col, seed + c * 101);
  save(g, 'planks_h', String(c * 3 + d));
  save(transpose(g), 'planks_v', String(c * 3 + d));
  if (d === 0) save(g, 'planks', String(c));
}));

// ---- railings ----
// A railing is a little fence like the wood fence: a rail on posts. A post stands on every tile
// boundary (each railing tile draws its half of the two), so a railing of any length keeps one
// rhythm; where a railing stops, a corner post covers the half posts. Lit on top in #e6904e, shaded
// with the darker wood, the plum outline on the shadow side (STYLE.md, selective outline).
const POST = [D5, D4, D3, D0];
/** a post's 4 columns at x0 (may straddle the tile edge), rows top..bottom; cap = lighter top */
function postCols(g, x0, top, bottom) {
  for (let i = 0; i < 4; i++) for (let y = top; y <= bottom; y++) {
    let c = POST[i];
    if (y === top && i < 3) c = i === 2 ? D4 : D5;
    if (y === bottom && i < 3) c = D0;
    put(g, x0 + i, y, c);
  }
}
// the far railing (north side of an east-west deck): the rail (rows 1-2) on posts standing on the
// deck's far edge (rows 0-6), its shadow on the boards
{
  const g = grid();
  for (let x = 0; x < S; x++) { put(g, x, 1, D5); put(g, x, 2, D3); put(g, x, 3, D0); put(g, x, 4, D3); }
  postCols(g, -2, 0, 6); postCols(g, 14, 0, 6);
  save(g, 'planks_rail_n', '0');
}
// the near railing (south side): the rail (rows 6-7) on posts that go down the deck's face; the face
// is the deck's side beam (rows 12-15: lit lip, face, bolts, plum line under it)
{
  const g = grid();
  for (let x = 0; x < S; x++) { put(g, x, 6, D5); put(g, x, 7, D3); put(g, x, 8, D0); put(g, x, 12, D5); put(g, x, 13, D3); put(g, x, 14, D2); put(g, x, 15, D0); }
  for (const bx of [7]) put(g, bx, 14, D1);
  postCols(g, -2, 5, 15); postCols(g, 14, 5, 15);
  // the posts' lower part is the darker side of the beam they're bolted to
  for (const x of [-2, -1, 0, 1, 14, 15]) for (let y = 12; y <= 14; y++) { const c = get(g, (x + 16) % 16, y); if (x >= 0 && x < 16) put(g, x, y, c === D5 ? D4 : c === D4 ? D3 : c); }
  save(g, 'planks_rail_s', '0');
}
// side railings of a north-south deck, seen from above: the rail (lit top, shaded face, plum edge on
// its shadow side, its shadow on the boards) and a post cap on every tile boundary
function sideRail(west) {
  const g = grid();
  for (let y = 0; y < S; y++) {
    if (west) { put(g, 0, y, D3); put(g, 1, y, D5); put(g, 2, y, D4); put(g, 3, y, D0); put(g, 4, y, D3); }
    else { put(g, 11, y, D3); put(g, 12, y, D4); put(g, 13, y, D5); put(g, 14, y, D4); put(g, 15, y, D0); }
  }
  // a post cap straddling each tile boundary: rows 14-15 here, 0-1 in the next tile, its face below
  const xs = west ? [0, 1, 2, 3] : [12, 13, 14, 15];
  const capA = [D5, D5, D5, D4], capB = [D5, D4, D4, D3], faceA = [D3, D3, D2, D1];
  for (const [y, row] of [[14, capA], [15, capB], [0, capA], [1, capB], [2, faceA]]) xs.forEach((x, i) => put(g, x, y, row[i]));
  xs.forEach((x) => put(g, x, 3, D0));
  // the posts' shadow side
  const inner = west ? 4 : 11;
  for (const y of [14, 15, 0, 1, 2, 3]) put(g, inner, y, D0);
  return g;
}
save(sideRail(true), 'planks_rail_w', '0');
save(sideRail(false), 'planks_rail_e', '0');

// ---- ends: where the deck ends along its run ----
// the boards end in a darker edge; at the south end the deck's face shows (its end beam)
{
  const w = grid(), e = grid(), n = grid(), s = grid();
  for (let i = 0; i < S; i++) {
    put(w, 0, i, D2); put(w, 1, i, D3);
    put(e, 15, i, D1); put(e, 14, i, D3);
    put(n, i, 0, D2); put(n, i, 1, D3);
    put(s, i, 12, D5); put(s, i, 13, D3); put(s, i, 14, D2); put(s, i, 15, D0);
  }
  for (const k of [4, 11]) put(s, k, 14, D1);
  save(n, 'planks_end_n', '0'); save(s, 'planks_end_s', '0'); save(w, 'planks_end_w', '0'); save(e, 'planks_end_e', '0');
}
// ---- the deck's edge on a long side with no railing ----
{
  const n = grid(), s = grid(), w = grid(), e = grid();
  for (let i = 0; i < S; i++) { put(n, i, 0, D2); put(s, i, 13, D5); put(s, i, 14, D2); put(s, i, 15, D0); put(w, 0, i, D2); put(e, 15, i, D1); }
  save(n, 'planks_side_n', '0'); save(s, 'planks_side_s', '0'); save(w, 'planks_side_w', '0'); save(e, 'planks_side_e', '0');
}
// ---- corner posts where a railing stops ----
// the same post as the railing's, whole, inside the deck's corner: the far ones on the deck's far
// edge, the near ones down its face
{
  const nw = grid(), ne = grid(), sw = grid(), se = grid();
  postCols(nw, 0, 0, 7); postCols(ne, 12, 0, 7);
  postCols(sw, 0, 4, 15); postCols(se, 12, 4, 15);
  // a corner post on a side railing: its face shows below its cap
  save(nw, 'planks_post_nw', '0'); save(ne, 'planks_post_ne', '0'); save(sw, 'planks_post_sw', '0'); save(se, 'planks_post_se', '0');
}
console.log('planks: planks_h/v (3 colourings x 3 details), planks (fallback), rail/end/side n,e,s,w, post nw,ne,sw,se -> ' + path.relative(process.cwd(), TILES));
