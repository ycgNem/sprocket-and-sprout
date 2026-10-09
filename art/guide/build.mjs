// Phase 3 "first session" guide sprites, hand-pixeled at 1x (STYLE.md, "What generation can't do
// well"): the post courier (a brass clockwork mail-bird), the off-screen compass arrow, the machine
// progress ring, the new-quest scroll and the wax seal stamp. Same look and density as the juice
// sheet (art/juice/build.mjs): 1 px plum outline, light from the upper left, 3-4 shades a material.
//
// Design references: the PixelLab batches in raw/b20 and raw/b24 (batches.json). The birds came back
// 20-24 px tall for a sprite that must fly inside 20 x 16 with its wings up, and their wing poses
// don't line up into a cycle, so they set the design (gold body, copper wings, cream satchel with
// a red wax dot, kraft parcel tied with string) and every frame here is drawn from one body and
// four wing poses. The compass, ring and seal are drawn by rule so steps and directions stay even.
//
// Usage: node art/guide/build.mjs [--preview]
//   -> art/guide/hand/<name>.png (one file per frame, `:` -> `_`) and art/guide/sprites.json
//   --preview also writes e2e/out/guide/build-preview.png (every frame at x8 on grass/dirt/plum)
//   then: node scripts/sprites-import.mjs art/guide/sprites.json   (src/art/guide.png + .json)
//         node art/guide/contact.mjs                               (e2e/out/guide/contact.png)
// Every color is a Resurrect 64 palette color.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// shared legend (palette hex)
const L = {
  o: '#2e222f', // outline, plum-black
  p: '#45293f', // deep plum
  P: '#7a3045', // wine
  // brass
  d: '#9e4539',
  r: '#cd683d',
  a: '#f79617',
  y: '#f9c22b',
  h: '#fbff86',
  u: '#fbb954', // light amber glow
  e: '#e6904e', // wood / kraft light
  // copper
  x: '#6e2727',
  R: '#b33831',
  F: '#ea4f36',
  q: '#f57d4a',
  k: '#fca790',
  // cream / parchment
  W: '#ffffff',
  c: '#fdcbb0',
  t: '#ab947a',
  m: '#966c6c',
  // wax red
  C: '#ae2334',
  E: '#e83b3b',
  l: '#f68181',
  // green (ring fill)
  D: '#239063',
  V: '#1ebc73',
  v: '#91db69',
  G: '#cddf6c',
  // neutrals
  n: '#3e3546',
  g: '#fb6b1d', // orange glow (the courier's eye)
};

/** name -> { w, h, px: (string|null)[] } */
const S = {};
const ENTRIES = []; // recipe entries in order

function fromRows(rows) {
  const h = rows.length, w = rows[0].length;
  rows.forEach((r, y) => { if (r.length !== w) throw new Error(`row ${y} is ${r.length} wide, expected ${w}: "${r}"`); });
  const px = [];
  for (const r of rows) for (const ch of r) {
    if (ch === '.' || ch === ' ') { px.push(null); continue; }
    if (!L[ch]) throw new Error(`unknown color '${ch}'`);
    px.push(ch);
  }
  return { w, h, px };
}
function blankG(w, h) { return { w, h, px: new Array(w * h).fill(null) }; }
const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? null : g.px[y * g.w + x]);
const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.px[y * g.w + x] = c; };
const clone = (g) => ({ w: g.w, h: g.h, px: g.px.slice() });
/** paint the opaque pixels of src onto dst at (dx, dy) */
function stamp(dst, src, dx = 0, dy = 0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = at(src, x, y); if (c) put(dst, x + dx, y + dy, c); }
  return dst;
}
/** 4-neighbor outline around every opaque pixel, in color c (only on empty pixels) */
function outline(g, c = 'o') {
  const add = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (at(g, x, y)) continue;
    if (at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) put(g, x, y, c);
  return g;
}
function def(name, g, origin) {
  if (S[name]) throw new Error('duplicate ' + name);
  if (origin[0] >= g.w || origin[1] >= g.h) throw new Error(`${name}: origin outside the frame`);
  S[name] = g;
  ENTRIES.push({ match: name, file: `hand/${name.replace(/:/g, '_')}.png`, frame: [g.w, g.h], origin });
}

// =========================================================================================
// 1. courier:fly:0..5, courier:carry:0..5, courier:perch:0..1   20x16, origin (10,15)
//    A small brass clockwork mail-bird seen from the side, facing right (the game mirrors it):
//    gold body, copper riveted wings, a copper beak, one glowing amber eye in a dark lens, a flat
//    cream satchel with a red wax button. One body grid is shared by every frame; the near wing has
//    four poses (up, mid, level, down) and the far wing is the near one shifted forward and darkened,
//    so the 6-frame flap is up > mid > level > down > rise (half folded) > mid. The body bobs 1 px (up while the
//    wings push down). carry = fly + a kraft parcel tied with string held under the feet. perch =
//    standing on its feet with the wing folded; perch:1 dips the head to peck (grab the parcel).
//    Composed as fill only, then outlined by rule (1 px plum).
// =========================================================================================
const FLY_BODY = [
  '....................', // 0
  '....................', // 1
  '.............hhy....', // 2  head
  '............hyyya...', // 3
  '............yy*yaFR.', // 4  eye (*, 2x2 lens), beak
  '.......hhyyyyyyarR..', // 5  back, beak lower
  '.rayyhyyyyyyaaar....', // 6  tail, body
  '..draaaaaaaaaar.....', // 7
  '....raaaaaaaarr.....', // 8
  '.....rrrrrrrrd......', // 9
  '.......ddddd........', // 10 belly
];
// perched: the same body with the tail angled down
const PERCH_BODY = FLY_BODY.map((r, y) => y === 6 ? '...ayhyyyyyyaaar....' : y === 7 ? '..raaaaaaaaaaar.....' : y === 8 ? '.drraaaaaaaaarr.....' : y === 9 ? '.dr..rrrrrrrrd......' : r);
// perch:1, the peck: the body stays level, the head drops 3 px onto the chest with the beak turned
// down, the tail tips up
const PECK_BODY = [
  '....................', // 0
  '....................', // 1
  '....................', // 2
  '....................', // 3
  '..ra................', // 4  tail tip, up
  '...rayyhhyyyyhhy....', // 5  back, head top
  '....ahyyyyyyhyyya...', // 6
  '....raaaaaaayy*yaF..', // 7  eye (*), beak
  '....raaaaaaaayyaarR.', // 8  beak tip, pointing down
  '.....rrrrrrrraarr...', // 9
  '.......ddddd........', // 10
];
const SATCHEL = [[10, 8, 'c'], [11, 8, 'c'], [12, 8, 'c'], [13, 8, 't'], [10, 9, 't'], [11, 9, 't'], [12, 9, 't'], [13, 9, 'm']];
// the eye: a glowing amber lens with a dark rim on its shaded side (variants for review: EYE=A..D)
const EYES = {
  E: [[0, 0, 'u'], [1, 0, 'o'], [0, 1, 'o'], [1, 1, 'o']],
  F: [[0, 0, 'g'], [1, 0, 'o'], [0, 1, 'o'], [1, 1, 'p']],
  G: [[0, 0, 'h'], [1, 0, 'g'], [0, 1, 'g'], [1, 1, 'o']],
};
const EYE = EYES.F; // E and G were the runner-ups (an all-dark lens; an all-glow lens)
// near wing poses, fill only, in fly coordinates (shoulder about (9,5)); + = a brass rivet
const WINGS = {
  up: [
    '....................',
    '....kq..............',
    '....kqqF............',
    '.....kqFR...........',
    '.....kq+FR..........',
    '......kqFFR.........',
    '.......qq+Rx........',
    '........qFRx........',
  ],
  mid: [
    '....................',
    '..kq................',
    '..kqqF..............',
    '...kq+FR............',
    '....kqqFFR..........',
    '......qq+FRx........',
    '........qFRx........',
  ],
  level: [
    '....................',
    '....................',
    '....................',
    '....................',
    '...kqqqqF...........',
    '.kqqq+FF+Rx.........',
    '..qFFRRRRx..........',
    '...xx.xx............',
  ],
  rise: [ // the upstroke: the wing half folded, tips trailing low behind the tail
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.....kqqqqF.........',
    '..kqqq+FFRx.........',
    '.qFFRRxx............',
    '.Rxx................',
  ],
  down: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '........qFR.........',
    '......kqqFRx........',
    '.....kqq+FRx........',
    '....kqFF+Rx.........',
    '...kqFFRx...........',
    '...qFRRx............',
    '..qFRx..............',
    '..Rx................',
  ],
  folded: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.....kqqqqF.........',
    '...kqq+FF+Rx........',
    '....qFFRRRx.........',
    '......Rxx...........',
  ],
};
// copper, one step deeper than the drawn letters so the wings stand apart from the gold body;
// the far wing one step deeper again
const NEAR = { k: 'q', q: 'F', F: 'R', R: 'x', x: 'x', '+': 'y' };
const FAR = { k: 'F', q: 'R', F: 'x', R: 'x', x: 'x', '+': 'x' };
const PARCEL = [
  // kraft paper, lit top-left, tied with a cream string cross; fill cols 7..12, rows 12..14
  [7, 12, 'e'], [8, 12, 'e'], [9, 12, 'e'], [10, 12, 'c'], [11, 12, 'r'], [12, 12, 'r'],
  [7, 13, 'c'], [8, 13, 'c'], [9, 13, 'c'], [10, 13, 'c'], [11, 13, 'c'], [12, 13, 'c'],
  [7, 14, 'r'], [8, 14, 'r'], [9, 14, 'd'], [10, 14, 'c'], [11, 14, 'd'], [12, 14, 'd'],
];
function rowsToCells(rows) { const out = []; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') out.push([x, y, ch]); })); return out; }
function courier({ wing, dy = 0, parcel = false, perch = false, peck = false }) {
  const g = blankG(20, 16);
  const oy = perch ? 1 : 0; // perched: the bird sits 1 px lower, on its legs (toe outline on row 15)
  const P = (cells, ddx = 0, ddy = 0, map) => { for (const [x, y, c] of cells) put(g, x + ddx, y + ddy + dy + oy, map ? map[c] ?? c : c); };
  const wingCells = rowsToCells(WINGS[wing]);
  if (!perch && wing !== 'level') P(wingCells, 2, 0, FAR); // far wing, behind everything, shifted forward (hidden when level)
  const body = rowsToCells(peck ? PECK_BODY : perch ? PERCH_BODY : FLY_BODY);
  const eyeAt = body.find(([, , c]) => c === '*');
  P(body.map(([x, y, c]) => [x, y, c === '*' ? 'y' : c]));
  P(SATCHEL, peck ? -1 : 0);
  P(EYE.map(([x, y, c]) => [eyeAt[0] + x, eyeAt[1] + y, c]));
  if (perch) {
    // (thin legs go on after the outline)
  } else if (parcel) {
    P(PARCEL);
    put(g, 8, 11 + dy, 'd'); put(g, 11, 11 + dy, 'd'); // feet gripping the parcel
  } else {
    put(g, 8, 11 + dy, 'd'); put(g, 10, 11 + dy, 'd'); // feet tucked under the belly
  }
  P(wingCells, 0, 0, NEAR);
  outline(g);
  // the neck joint: a dark brass collar between head and body (it reads as clockwork)
  for (const [x, y] of peck ? [[12, 6], [12, 7], [12, 8]] : [[12, 5], [12, 6], [13, 7]]) if (at(g, x, y + dy + oy) && at(g, x, y + dy + oy) !== 'o') put(g, x, y + dy + oy, 'r');
  if (perch) {
    // thin legs, no outline of their own: one pixel wide, toes forward, standing on row 15
    for (const [x, y] of [[9, 12], [9, 13], [9, 14], [10, 14], [11, 12], [11, 13], [11, 14], [12, 14]]) put(g, x, y + 1, 'P');
  }
  return g;
}
const FLAP = [['up', 0], ['mid', 0], ['level', -1], ['down', -1], ['rise', -1], ['mid', 0]];
FLAP.forEach(([wing, dy], i) => def(`courier:fly:${i}`, courier({ wing, dy }), [10, 15]));
FLAP.forEach(([wing, dy], i) => def(`courier:carry:${i}`, courier({ wing, dy, parcel: true }), [10, 15]));
def('courier:perch:0', courier({ wing: 'folded', perch: true }), [10, 15]);
def('courier:perch:1', courier({ wing: 'folded', perch: true, peck: true }), [10, 15]);

// =========================================================================================
// 2. fx:compass:0..7  11x11, origin (5,5): a chunky amber arrowhead, plum outline. 0 = up, then
//    clockwise in 45 degree steps. Two masks are drawn by hand (up and up-right); the other six are
//    exact 90 degree turns of them about the centre pixel, and the shading is applied afterwards by
//    one rule (light from the upper left), so every direction has the same weight, outline and light.
// =========================================================================================
// up: a dart, sides rising 3 rows per pixel, a notched back. up-right: the same dart drawn by hand
// on the diagonal, where those sides become even 1:2 steps (atan 1/3 turned 45 degrees is exactly
// atan 1/2), mirror-symmetric about its axis. Both span the 11 x 11 box with their outline, so they
// sit centred, and have the same area (35 / 36 px). Tried and rejected: a 90 degree tip (the
// diagonals read as corner brackets) and a wide 2:1 dart (its diagonal reads as a right triangle).
const COMPASS_UP = [
  '...........',
  '.....#.....',
  '....###....',
  '....###....',
  '....###....',
  '...#####...',
  '...#####...',
  '...#####...',
  '..###.###..',
  '..##...##..',
  '...........',
];
const COMPASS_UR = [
  '...........',
  '........##.',
  '......####.',
  '....#####..',
  '..#######..',
  '.#######...',
  '..#.####...',
  '.....##....',
  '....###....',
  '.....#.....',
  '...........',
];
function maskOf(rows) { return rows.map((r) => [...r].map((ch) => ch === '#')); }
const rot90 = (m) => { const n = m.length; return m.map((_, y) => m.map((__, x) => m[n - 1 - x][y])); }; // clockwise
function shadeArrow(m) {
  const n = m.length, g = blankG(n, n);
  const M = (x, y) => x >= 0 && y >= 0 && x < n && y < n && m[y][x];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!M(x, y)) continue;
    const lit = (!M(x, y - 1)) + (!M(x - 1, y)) + 0.5 * (!M(x - 1, y - 1));
    const dark = (!M(x, y + 1)) + (!M(x + 1, y)) + 0.5 * (!M(x + 1, y + 1));
    const deep = (!M(x, y + 2) && !M(x, y + 1)) || (!M(x + 2, y) && !M(x + 1, y));
    let c = 'y';
    if (lit > dark) c = 'h';
    else if (dark > lit) c = dark >= 2 ? 'r' : 'a';
    else if (lit && dark) c = 'y';
    void deep;
    put(g, x, y, c);
  }
  return outline(g);
}
{
  const up = maskOf(COMPASS_UP), ur = maskOf(COMPASS_UR);
  const masks = [];
  let a = up, b = ur;
  for (let k = 0; k < 4; k++) { masks.push(a, b); a = rot90(a); b = rot90(b); }
  masks.forEach((m, i) => def(`fx:compass:${i}`, shadeArrow(m), [5, 5]));
}

// =========================================================================================
// 3. fx:ring:0..8  11x11, origin (5,5): a brass ring gauge on a dark plum disc. Regions are a hand
//    map (o outline, B brass rim, T track, D disc); the 24 track pixels are sorted by angle clockwise
//    from 12 o'clock and frame k fills the first 3k of them, so every step adds the same amount.
//    Empty track wine, fill lime green (lighter on the lit upper-left half), a butter glint at the head.
// =========================================================================================
const RING_MAP = [
  '...ooooo...',
  '..oBBBBBo..',
  '.oBTTTTTBo.',
  'oBTTDDDTTBo',
  'oBTDDDDDTBo',
  'oBTDDDDDTBo',
  'oBTDDDDDTBo',
  'oBTTDDDTTBo',
  '.oBTTTTTBo.',
  '..oBBBBBo..',
  '...ooooo...',
];
{
  const N = 11, C = 5;
  const base = blankG(N, N), track = [];
  RING_MAP.forEach((row, y) => [...row].forEach((ch, x) => {
    const dx = x - C, dy = y - C, r = Math.hypot(dx, dy) || 1;
    const lit = (-dx - dy) / r; // 1 = facing the light (upper left)
    if (ch === 'o') put(base, x, y, 'o');
    else if (ch === 'B') put(base, x, y, lit > 0.5 ? 'h' : lit > -0.2 ? 'y' : lit > -0.8 ? 'a' : 'r');
    else if (ch === 'D') put(base, x, y, 'p');
    else if (ch === 'T') {
      put(base, x, y, 'P');
      track.push({ x, y, r, lit, ang: (Math.atan2(dx, -dy) + 2 * Math.PI - 1e-9) % (2 * Math.PI) });
    }
  }));
  track.sort((p, q) => p.ang - q.ang || q.r - p.r);
  if (track.length % 8) throw new Error(`ring track has ${track.length} pixels, not a multiple of 8`);
  for (let k = 0; k <= 8; k++) {
    const g = clone(base), n = (k * track.length) / 8;
    for (let i = 0; i < n; i++) { const t = track[i]; put(g, t.x, t.y, i === n - 1 ? 'h' : t.lit > 0 ? 'v' : 'V'); }
    def(`fx:ring:${k}`, g, [5, 5]);
  }
}

// =========================================================================================
// 4. fx:scroll:0..3  16x16, origin (8,15) bottom-centre: a parchment scroll with brass end caps that
//    unrolls upward from a fixed bottom roller: 0 rolled, 1 a quarter open, 2 half, 3 open with ink
//    lines and a red wax dot. The bottom roller never moves.
// =========================================================================================
function roller(g, y, x0 = 2, x1 = 13, fat = false) {
  // a horizontal paper roll with brass knobs; y = top fill row (3 rows, 4 if fat)
  const rows = fat ? ['W', 'c', 'k', 't'] : ['W', 'c', 't'];
  rows.forEach((c, j) => { for (let x = x0; x <= x1; x++) put(g, x, y + j, c); });
  // the paper spiral end on the left, a shaded crease on the right
  put(g, x0, y + 1, 'k'); put(g, x1, y, 'c'); put(g, x1, y + rows.length - 1, 'm');
  // brass knobs, one row taller than the roll
  const kh = rows.length + 1;
  const knob = (x, side) => {
    for (let j = 0; j < kh; j++) {
      const yy = y - 1 + j + (fat ? 0 : 0);
      const c = j === 0 ? (side < 0 ? 'h' : 'y') : j === kh - 1 ? 'r' : side < 0 ? 'y' : 'a';
      put(g, x, yy, c);
      put(g, x + side, yy, j === 0 ? 'y' : j === kh - 1 ? 'd' : side < 0 ? 'a' : 'r');
    }
  };
  knob(x0 - 1, -1); knob(x1 + 1, 1);
}
function scroll(open) {
  // open = paper rows between the rollers (0 = closed: the top roller sits on the bottom one)
  const g = blankG(16, 16);
  const bottomY = 12; // bottom roller fill rows 12..14, knobs 11..14, outline down to 15
  const topY = bottomY - 4 - open; // top roller fill rows topY..topY+2
  // paper sheet between the rollers, inset one pixel from the roll, lit on the left
  for (let y = topY + 3; y < bottomY; y++) for (let x = 3; x <= 12; x++) put(g, x, y, x === 3 ? 'W' : x === 12 ? 't' : x === 11 ? 'k' : 'c');
  roller(g, bottomY);
  roller(g, topY);
  // the text comes off the bottom roller as the top one rises, so the lines hang from the top
  // roller; only rows clear of the bottom knobs (<= 10) show
  const last = bottomY - 2;
  for (const [y, x0, x1] of [[topY + 4, 5, 10], [topY + 6, 5, 9], [topY + 8, 5, 7]]) if (y <= last) for (let x = x0; x <= x1; x++) put(g, x, y, 'm');
  const dotY = topY + 7; // the red wax dot beside the short last line
  if (dotY + 1 <= last) { put(g, 9, dotY, 'l'); put(g, 10, dotY, 'E'); put(g, 9, dotY + 1, 'E'); put(g, 10, dotY + 1, 'C'); }
  if (open === 0) {
    // closed: a wax seal over the seam between the rollers
    for (const [x, y, c] of [[7, 10, 'l'], [8, 10, 'E'], [6, 11, 'E'], [7, 11, 'E'], [8, 11, 'E'], [9, 11, 'C'], [7, 12, 'C'], [8, 12, 'C']]) put(g, x, y, c);
  }
  return outline(g);
}
[0, 2, 4, 6].forEach((open, i) => def(`fx:scroll:${i}`, scroll(open), [8, 15]));

// =========================================================================================
// 5. fx:seal:0..2  18x18, origin (9,9): a red wax seal with the sprocket emblem (ui:sprocket in
//    src/art/logo.*: 8 teeth round a ring with a hub) pressed into it. 0 a large soft blob coming
//    in, 1 squashed wide on impact, 2 settled round with a highlight. The blob is drawn by rule (a
//    dome lit from the upper left, a wavy dripped edge); the emblem is a hand grid engraved into the
//    wax: a flat dark sprocket silhouette, the hub left raised.
// =========================================================================================
const EMBLEM = [
  '....##....',
  '.##.##.##.',
  '.########.',
  '..##..##..',
  '###....###',
  '###....###',
  '..##..##..',
  '.########.',
  '.##.##.##.',
  '....##....',
];
const EMBLEM_SQUASH = [
  '.##.##.##.',
  '.########.',
  '..##..##..',
  '###....###',
  '..##..##..',
  '.########.',
  '.##.##.##.',
];
function seal(state) {
  const N = 18, C0 = 9, g = blankG(N, N);
  const shape = [
    { rx: 8.0, ry: 8.0, wav: 0.0 },
    { rx: 8.5, ry: 5.9, wav: 0.3 },
    { rx: 7.4, ry: 7.4, wav: 0.3 },
  ][state];
  // normalised radius of a pixel centre (1 = the blob's edge), with a 7-lobe drip wobble
  const rn = (x, y) => {
    const dx = x + 0.5 - C0, dy = y + 0.5 - C0, th = Math.atan2(dy, dx);
    const k = 1 + (shape.wav * Math.sin(7 * th + 0.6)) / shape.rx;
    return Math.hypot(dx / (shape.rx * k), dy / (shape.ry * k));
  };
  const em = state === 1 ? EMBLEM_SQUASH : EMBLEM;
  const ex = C0 - 5, ey = state === 1 ? C0 - 3 : C0 - 5;
  const E = (x, y) => { const r = em[y - ey]; return !!r && r[x - ex] === '#'; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = rn(x, y);
    if (r > 1) continue;
    const dx = x + 0.5 - C0, dy = y + 0.5 - C0;
    const lit = -(dx / shape.rx + dy / shape.ry) / Math.SQRT2 / Math.max(r, 0.01); // facing the light
    let c = 'E';
    if (r > 0.74) c = lit > 0.35 ? 'l' : lit < -0.6 ? 'x' : lit < -0.15 ? 'C' : 'E'; // the rim of the dome
    if (E(x, y)) c = 'C'; // engraved: a flat dark silhouette reads best at 1x (wall shading made it noisy)
    put(g, x, y, c);
  }
  // glossy glint on the upper left
  const glints = [
    [[5, 3, 'k'], [4, 4, 'k'], [6, 3, 'l'], [3, 5, 'l'], [5, 4, 'W']],
    [[4, 5, 'k'], [5, 4, 'k'], [6, 4, 'l'], [3, 6, 'l']],
    [[5, 3, 'k'], [4, 4, 'W'], [3, 5, 'k'], [6, 3, 'l']],
  ][state];
  for (const [x, y, c] of glints) if (at(g, x, y)) put(g, x, y, c);
  return outline(g);
}
[0, 1, 2].forEach((i) => def(`fx:seal:${i}`, seal(i), [9, 9]));

// ---- write ----
const outDir = path.join(HERE, 'hand');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(outDir, f));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
for (const [name, g] of Object.entries(S)) {
  const data = new Uint8Array(g.w * g.h * 4);
  g.px.forEach((ch, i) => { if (ch) data.set([...rgb(L[ch]), 255], i * 4); });
  fs.writeFileSync(path.join(outDir, name.replace(/:/g, '_') + '.png'), encodePNG(g.w, g.h, data));
}
const recipe = {
  _: 'Phase 3 first-session guide sprites: the post courier (courier:fly/carry/perch, a brass clockwork mail-bird facing right; the game mirrors it), the off-screen compass (fx:compass:0..7, 0 = up, clockwise), the machine progress ring (fx:ring:0..8), the new-quest scroll (fx:scroll:0..3) and the wax seal stamp (fx:seal:0..2). Art: hand/*.png, drawn at 1x by art/guide/build.mjs from the PixelLab design batches raw/b20 and raw/b24 (batches.json). Frames are separate names with a numeric suffix.',
  name: 'guide',
  kind: 'sprites',
  scale: 1,
  defaults: { place: 'none', keepStrays: true },
  sprites: ENTRIES,
};
const head = JSON.stringify({ ...recipe, sprites: [] }, null, 2);
fs.writeFileSync(path.join(HERE, 'sprites.json'), head.replace('"sprites": []', '"sprites": [\n' + ENTRIES.map((e) => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]') + '\n');
console.log(`${ENTRIES.length} frames -> art/guide/hand, recipe art/guide/sprites.json`);

// ---- preview: every frame at x8 on grass, dirt and the HUD plum ----
if (process.argv.includes('--preview')) {
  const K = +(process.argv[process.argv.indexOf('--preview') + 1] || 0) || 8;
  const terr = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art/terrain.json'), 'utf8'));
  const tpng = decodePNG(fs.readFileSync(path.join(ROOT, 'src/art', terr.file)));
  const tile = (cls) => { const [tx, ty] = terr.bases[cls][0]; return (x, y) => { const p = ((ty + (y & 15)) * tpng.w + tx + (x & 15)) * 4; return [tpng.data[p], tpng.data[p + 1], tpng.data[p + 2]]; }; };
  const bgs = [tile('grass'), tile('dirt'), () => rgb('#2e222f')];
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
  const names = Object.keys(S).filter((n) => !only || n.startsWith(only));
  const cw = 22, ch = 20; // cell in 1x px
  const cols = Math.min(names.length, Math.max(1, Math.floor(1800 / (cw * K))));
  const rowsN = Math.ceil(names.length / cols);
  const W = cols * cw * K, H = bgs.length * rowsN * ch * K;
  const img = new Uint8Array(W * H * 4);
  bgs.forEach((bg, b) => names.forEach((nm, i) => {
    const g = S[nm], X0 = (i % cols) * cw, Y0 = (b * rowsN + Math.floor(i / cols)) * ch;
    const ox = X0 + Math.floor((cw - g.w) / 2), oy = Y0 + Math.floor((ch - g.h) / 2);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = at(g, X0 + x - ox, Y0 + y - oy);
      const col = c ? rgb(L[c]) : bg(x, y);
      for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) img.set([...col, 255], (((Y0 + y) * K + yy) * W + (X0 + x) * K + xx) * 4);
    }
  }));
  const out = path.join(ROOT, 'e2e/out/guide/build-preview.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(W, H, img));
  console.log('preview', path.relative(ROOT, out), W + 'x' + H);
}
