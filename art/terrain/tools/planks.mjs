// The plank deck set (ROADMAP 1.2 bug 3): bridges, docks, the pier and the placeable Plank Walk.
// Drawn by rule, not generated: the boards must tile exactly in runs of any length and every overlay
// must line up with the boards under it, which generation can't promise (STYLE.md, "What generation
// can't do well"). Wood ramp from STYLE.md: #45293f #7a3045 #9e4539 #cd683d #e6904e, light from the
// upper left, no outline on the deck (terrain), selective dark edges on the raised parts.
//
// Writes per-tile classes for scripts/terrain-import.mjs (tiles/<class>/<n>.png, 16x16):
//   planks_h/0-2   deck of a run going east-west (a river bridge): boards laid along the run, east-west
//   planks_v/0-2   deck of a run going north-south (a dock, the pier): boards laid north-south
//   planks/0-2     = planks_h (the fallback the renderer draws without src/render/planks.ts)
// Boards run along the deck so the railing posts (upright) read against them.
//   planks_rail_{n,e,s,w}   a railing on a side that faces water (overlay; transparent elsewhere)
//   planks_end_{n,e,s,w}    the heavy end beam where a run meets land (overlay)
//   planks_side_{n,e,s,w}   the deck's edge on a long side that meets land (overlay)
//   planks_post_{nw,ne,sw,se}  a corner post where a railing stops (overlay)
// The edge rows/columns of the decks are the same in every variant, so variants mix freely.
// Usage: node art/terrain/tools/planks.mjs   (run from the repo root; build.sh runs it)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { rgbOf } from '../../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TILES = path.join(here, '..', 'tiles');
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
/** transpose (x <-> y): a horizontal-board design turned into a vertical-board one, light kept top-left */
const transpose = (g) => { const o = grid(); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) o[y * S + x] = g[x * S + y]; return o; };

/**
 * Horizontal boards (long side east-west), 4 px each: lit top row, two body rows, a dark gap row.
 * joints[k] = x of board k's butt joint (none at the tile's edge columns, so every variant shares
 * its edges); weather = index of a board whose segment left of its joint is older and darker.
 */
function boardsH(seed, joints, weather = -1) {
  const r = rng(seed), g = grid();
  for (let k = 0; k < 4; k++) {
    const y0 = 4 * k;
    for (let x = 0; x < S; x++) { put(g, x, y0, D4); put(g, x, y0 + 1, D3); put(g, x, y0 + 2, D3); put(g, x, y0 + 3, D1); }
    // grain: short darker streaks on the body rows, a few lit flecks; never on the edge columns
    for (let n = 0; n < 2; n++) {
      const y = y0 + 1 + Math.floor(r() * 2), x = 2 + Math.floor(r() * 10), len = 2 + Math.floor(r() * 3);
      for (let i = 0; i < len && x + i < S - 2; i++) put(g, x + i, y, D2);
    }
    if (r() < 0.6) put(g, 2 + Math.floor(r() * 11), y0 + 1, D5);
    const j = joints[k];
    if (j != null) {
      // butt joint: dark seam, the next board's end lit, the previous board's end shaded, two nails
      for (let y = y0; y < y0 + 3; y++) { put(g, j, y, D1); put(g, j - 1, y, y === y0 ? D4 : D2); put(g, j + 1, y, D4); }
      put(g, j - 2, y0 + 1, D1); put(g, j + 2, y0 + 1, D1);
      if (k === weather) for (let x = 1; x < j - 1; x++) { put(g, x, y0, D3); put(g, x, y0 + 1, D2); put(g, x, y0 + 2, get(g, x, y0 + 2) === D2 ? D1 : D2); }
    }
  }
  return g;
}
const VARIANTS = [
  [11, [9, 4, 12, 6], -1],
  [23, [5, 11, 3, 9], 2],
  [37, [12, 7, null, 4], 1],
];
const decks = VARIANTS.map(([seed, joints, weather]) => boardsH(seed, joints, weather));
decks.forEach((g, i) => { save(g, 'planks_h', String(i)); save(g, 'planks', String(i)); save(transpose(g), 'planks_v', String(i)); });

// ---- overlays ----
// Raised parts (railings, posts) are lit on top in #e6904e, shaded with the darker wood and edged in
// the plum outline on their shadow side (STYLE.md, selective outline), and cast a 1-px #45293f shadow
// on the deck below and to the right, so they read as standing on the boards.
// railing along the north edge: a lit top rail with a crisp dark underside, posts down to the deck
const postV = (g, px, y0, y1) => { for (let y = y0; y <= y1; y++) { put(g, px, y, D5); put(g, px + 1, y, D3); put(g, px + 2, y, D0); } for (let x = px; x < px + 3; x++) put(g, x, y1 + 1, D0); };
{
  const g = grid();
  for (let x = 0; x < S; x++) { put(g, x, 0, D5); put(g, x, 1, D3); put(g, x, 2, D0); }
  for (const px of [2, 10]) postV(g, px, 3, 5);
  save(g, 'planks_rail_n', '0');
}
// railing along the south edge: the top rail, posts standing on the deck's edge, the deck's front face
{
  const g = grid();
  for (let x = 0; x < S; x++) { put(g, x, 7, D5); put(g, x, 8, D3); put(g, x, 9, D0); put(g, x, 13, D3); put(g, x, 14, D2); put(g, x, 15, D0); }
  for (const px of [2, 10]) for (let y = 10; y <= 12; y++) { put(g, px, y, D5); put(g, px + 1, y, D3); put(g, px + 2, y, D0); }
  save(g, 'planks_rail_s', '0');
}
// side railings seen from above: a lit rail between a dark outer face and a crisp edge, square post caps
const cap = (g, x0, y0, outlineX) => {
  put(g, x0, y0, D5); put(g, x0 + 1, y0, D5); put(g, x0 + 2, y0, D4);
  put(g, x0, y0 + 1, D5); put(g, x0 + 1, y0 + 1, D4); put(g, x0 + 2, y0 + 1, D3);
  put(g, x0, y0 + 2, D3); put(g, x0 + 1, y0 + 2, D3); put(g, x0 + 2, y0 + 2, D2);
  for (let x = x0; x < x0 + 3; x++) put(g, x, y0 + 3, D0);
  for (let y = y0; y < y0 + 4; y++) put(g, outlineX, y, D0);
};
{
  const g = grid();
  for (let y = 0; y < S; y++) { put(g, 0, y, D2); put(g, 1, y, D5); put(g, 2, y, D3); put(g, 3, y, D0); }
  for (const py of [2, 10]) cap(g, 0, py, 3);
  save(g, 'planks_rail_w', '0');
}
{
  const g = grid();
  for (let y = 0; y < S; y++) { put(g, 12, y, D2); put(g, 13, y, D5); put(g, 14, y, D3); put(g, 15, y, D0); }
  for (const py of [2, 10]) cap(g, 12, py, 15);
  save(g, 'planks_rail_e', '0');
}
// end beams: a heavy sleeper across the board ends where the run meets land, two bolts
{
  const n = grid(), s = grid(), w = grid(), e = grid();
  for (let i = 0; i < S; i++) {
    put(n, i, 0, D4); put(n, i, 1, D3); put(n, i, 2, D2); put(n, i, 3, D1);
    put(s, i, 12, D1); put(s, i, 13, D4); put(s, i, 14, D2); put(s, i, 15, D1);
    put(w, 0, i, D4); put(w, 1, i, D3); put(w, 2, i, D2); put(w, 3, i, D1);
    put(e, 12, i, D1); put(e, 13, i, D4); put(e, 14, i, D3); put(e, 15, i, D2);
  }
  for (const k of [3, 12]) { put(n, k, 1, D1); put(s, k, 13, D2); put(s, k, 14, D1); put(w, 1, k, D1); put(e, 14, k, D1); }
  save(n, 'planks_end_n', '0'); save(s, 'planks_end_s', '0'); save(w, 'planks_end_w', '0'); save(e, 'planks_end_e', '0');
}
// deck edges on a long side over land: lit edges in the wood's dark shade, the front face at the south
{
  const n = grid(), s = grid(), w = grid(), e = grid();
  for (let i = 0; i < S; i++) { put(n, i, 0, D2); put(w, 0, i, D2); put(e, 15, i, D1); put(s, i, 14, D2); put(s, i, 15, D1); }
  save(n, 'planks_side_n', '0'); save(s, 'planks_side_s', '0'); save(w, 'planks_side_w', '0'); save(e, 'planks_side_e', '0');
}
// corner posts where a railing stops (at the end of a bridge, the corner of a dock): a big lit cap,
// the post's front face, the outline on its right and at its foot
const post = (g, x0, y0) => {
  for (let x = x0; x < x0 + 4; x++) { put(g, x, y0, D5); put(g, x, y0 + 1, x < x0 + 3 ? D5 : D4); }
  for (let y = y0 + 2; y < y0 + 6; y++) { put(g, x0, y, D4); put(g, x0 + 1, y, D4); put(g, x0 + 2, y, D3); put(g, x0 + 3, y, D2); }
  for (let x = x0; x < x0 + 4; x++) put(g, x, y0 + 6, D0);
  if (x0 + 4 < S) for (let y = y0; y < y0 + 7; y++) put(g, x0 + 4, y, D0);
  if (x0 > 0) for (let y = y0; y < y0 + 7; y++) put(g, x0 - 1, y, get(g, x0 - 1, y) ?? D2);
};
{
  const nw = grid(), ne = grid(), sw = grid(), se = grid();
  post(nw, 0, 0); post(ne, 12, 0); post(sw, 0, 7); post(se, 12, 7);
  save(nw, 'planks_post_nw', '0'); save(ne, 'planks_post_ne', '0'); save(sw, 'planks_post_sw', '0'); save(se, 'planks_post_se', '0');
}
console.log('planks: planks_h/v (3 variants each), planks (fallback), rail/end/side n,e,s,w, post nw,ne,sw,se -> ' + path.relative(process.cwd(), TILES));
