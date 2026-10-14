// The harbor's export warehouse (harbor:warehouse:<restored>): one PixelLab pick, widened to the
// 4-tile footprint and given its two states by rule, so both share one silhouette (STYLE.md,
// "Restored vs. derelict").
//
// Source: raw/pro/0.png (create_image_pro 64x80, Resurrect 64 palette, style image cut from
// bld:workshop and bld:store; candidate 0 of 9, raw/batches.json).
//
//   widen     7 columns inserted (roof: a copy of one shingle course; wall: plain planks; base:
//             stones), so the eaves span the 4-tile footprint
//   restored  brighter pennant, a ship icon on the sign board; the generated crane, lantern and
//             brass hinges as they came
//   winter    snow on the roof by the town buildings' rule (both states)
//   derelict  sun-bleached planks, rusted brass, two holes in the roof, boarded window and doors,
//             a dark lantern, a crooked blank sign, a torn pennant, moss, and the crane's jib
//             fallen against the mast with a frayed rope end
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, PAL } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const O = '#2e222f';

/** frame geometry: source x/y -> frame x/y; footprint 64x48 */
export const WAREHOUSE = { w: 69, h: 71, ox: 5, oy: 23 };
const FX = -1, FY = -4; // frame = source + (FX, FY) after widening

// ------------------------------------------------------------------ widening
/** insert 7 columns: roof rows 26-44 copy 34..40 at 41; above the roof at 41; wall rows 45-67
 *  copy planks 21,22 at 23; base rows 68-74 copy stones 12..18 at 12 */
function widen(src) {
  const out = new Img(src.w + 7, src.h);
  for (let y = 0; y < src.h; y++) {
    let at, copy;
    if (y < 26) { at = 41; copy = [41, 41, 41, 41, 41, 41, 41]; }
    else if (y <= 44) { at = 41; copy = [34, 35, 36, 37, 38, 39, 40]; }
    else if (y <= 67) { at = 23; copy = [21, 22, 21, 22, 21, 22, 21]; }
    else { at = 12; copy = [12, 13, 14, 15, 16, 17, 18]; }
    for (let x = 0; x < out.w; x++) {
      const sx = x < at ? x : x < at + 7 ? copy[x - at] : x - 7;
      const c = y < 26 && x >= at && x < at + 7 ? null : src.get(sx, y);
      if (c) out.set(x, y, c);
    }
  }
  return out;
}

// ------------------------------------------------------------------ shared edits (source coords)
function paintRect(img, x, y, w, h, map) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const c = img.get(xx, yy);
    if (c && map[c]) img.set(xx, yy, map[c]);
  }
}
/** rows of a character grid onto img at (x, y); ' ' or '.' = leave, '_' = clear */
function stamp(img, x, y, rows, key) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === ' ' || ch === '.') return;
    img.set(x + i, y + j, ch === '_' ? null : key[ch]);
  }));
}

// sign face (13x5 at 28,46 in source coords): a little sailing ship, no text
const SIGN_SHIP = [
  'dddddddjddddd',
  'ddddddsjddddd',
  'dddddssjsdddd',
  'ddjjjjjjjjjdd',
  'dddjjjjjjjddd',
];

// ------------------------------------------------------------------ winter
// The town's rule (art/buildings/tools/compose.mjs): the roof's colors turn to snow keeping their
// lightness order, by pixel share: the darkest ~20% snow shadow, the next ~50% snow, the rest bright.
const SNOW = ['#9babb2', '#c7dcd0', '#ffffff'];
const ROOF = [6, 26, 64, 19]; // x, y, w, h in widened source coords (eaves to ridge)
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
function snowRoof(img) {
  const [rx, ry, rw, rh] = ROOF;
  const cnt = new Map();
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { const c = img.get(x, y); if (c && c !== O) cnt.set(c, (cnt.get(c) ?? 0) + 1); }
  const total = [...cnt.values()].reduce((a, b) => a + b, 0);
  const map = new Map();
  let cum = 0;
  for (const c of [...cnt.keys()].sort((a, b) => lum(a) - lum(b))) {
    const mid = (cum + cnt.get(c) / 2) / total;
    map.set(c, mid < 0.2 ? SNOW[0] : mid < 0.7 ? SNOW[1] : SNOW[2]);
    cum += cnt.get(c);
  }
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { const c = img.get(x, y); if (c && c !== O) img.set(x, y, map.get(c)); }
}

function restored(src, winter = false) {
  const img = src.clone();
  if (winter) snowRoof(img);
  // pennant: from roof red to a brighter red so it reads against the shingles
  paintRect(img, 57, 16, 12, 6, { '#9e4539': '#b33831' });
  for (let x = 58; x <= 61; x++) img.set(x, 18, '#ea4f36');
  img.set(58, 17, '#ea4f36');
  // sign board ship icon
  stamp(img, 35, 46, SIGN_SHIP, { d: '#cd683d', j: '#45293f', s: '#fdcbb0' });
  return img;
}

// ------------------------------------------------------------------ derelict
const FADE = {
  '#9e4539': '#966c6c', // plank base -> sun-bleached
  '#6e2727': '#694f62', // plank shade
  '#cd683d': '#ab947a', // lit edges
  '#e6904e': '#ab947a',
  '#f9c22b': '#9e4539', // brass -> rust
  '#a2a947': '#676633',
  '#ffffff': '#625565', // lantern glass, dark
  '#c7dcd0': '#7f708a',
};

function derelict(src, winter = false) {
  const img = src.clone();
  // 1. the crane: clear the generated jib, rope and hook (left of the mast), keep the mast
  for (let y = 0; y < 34; y++) for (let x = 0; x < 21; x++) {
    if (y >= 26 && x >= 6) continue; // roof
    img.set(x, y, null);
  }
  // 2. bleach the walls and the mast, rust the brass; the roof keeps a faded red under moss
  paintRect(img, 0, 0, img.w, 26, FADE);
  paintRect(img, 0, 45, img.w, img.h - 45, FADE);
  paintRect(img, 0, 26, img.w, 19, { ...FADE, '#9e4539': '#9e4539', '#6e2727': '#7a3045', '#cd683d': '#966c6c', '#e6904e': '#966c6c' });
  if (winter) snowRoof(img);
  // 3. pennant: a torn scrap on a bare pole
  for (let y = 16; y < 23; y++) for (let x = 57; x < 69; x++) img.set(x, y, null);
  stamp(img, 57, 17, [
    'Oaab',
    'Oab.',
    'Ob..',
  ], { O, a: '#694f62', b: '#966c6c' });
  img.set(56, 16, O);
  // 4. the fallen jib: hinged at the mast (20,16), lying down-left across the roof to (9,30)
  const jib = [];
  {
    let x0 = 20, y0 = 16;
    const x1 = 9, y1 = 30;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = -1, sy = 1;
    let err = dx - dy;
    for (;;) {
      jib.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  const body = new Set();
  for (const [x, y] of jib) { body.add(x + ',' + y); body.add(x + 1 + ',' + y); }
  // outline first (around the 2-px beam), then the beam: lit left column, shaded right
  for (const k of body) {
    const [x, y] = k.split(',').map(Number);
    for (const [ax, ay] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!body.has(x + ax + ',' + (y + ay))) img.set(x + ax, y + ay, O);
  }
  for (const [x, y] of jib) { img.set(x, y, '#ab947a'); img.set(x + 1, y, '#694f62'); }
  // rust streaks on the beam and a seized pulley at the tip
  for (const [x, y] of jib.filter((_, i) => i % 4 === 2)) img.set(x + 1, y, '#9e4539');
  stamp(img, 7, 29, [
    '.OOO.',
    'OcdcO',
    'OdOdO',
    'OcdcO',
    '.OOO.',
  ], { O, c: '#7a3045', d: '#9e4539' });
  // a frayed rope end hanging from the pulley
  stamp(img, 8, 34, ['a', 'b', '.a', 'b'], { a: '#ab947a', b: '#966c6c' });
  // the hinge on the mast, rusted
  stamp(img, 20, 15, ['OO', 'cO'], { O, c: '#7a3045' });
  // 5. holes in the roof (dark loft, a rafter across, broken shingle ends lit on the near rim)
  const HK = { O, j: '#45293f', r: '#694f62', h: '#ab947a' };
  stamp(img, 27, 37, [
    '.OOO..',
    'OjOOO.',
    'OOOjOO',
    '.hOOh.',
  ], HK);
  stamp(img, 50, 34, [
    '...OOOO...',
    '.OOjOOOOO.',
    'OOjOOOOjOO',
    'OrrrrrrrrO',
    'OjOOOOOOjO',
    '.OOOjOOOO.',
    '..hh.hh.h.',
  ], HK);
  // moss: a few soft clusters on the roof
  const MOSS = ['#4c3e24', '#676633', '#676633', '#a2a947'];
  for (const [mx, my] of winter ? [] : [[24, 41], [40, 28], [62, 42], [8, 38], [33, 36]]) {
    for (const [dx, dy, k] of [[0, 0, 1], [1, 0, 2], [-1, 1, 0], [0, 1, 1], [1, 1, 1], [2, 1, 0], [0, -1, 3]]) {
      const c = img.get(mx + dx, my + dy);
      if (c && c !== O) img.set(mx + dx, my + dy, MOSS[k]);
    }
  }
  // 6. boarded window (right) and boards nailed across the cargo doors
  const board = (x, y, w) => {
    for (let i = 0; i < w; i++) { img.set(x + i, y - 1, O); img.set(x + i, y, '#ab947a'); img.set(x + i, y + 1, '#966c6c'); img.set(x + i, y + 2, O); }
    img.set(x + 1, y + 1, O); img.set(x + w - 2, y + 1, O); // nails
  };
  board(54, 56, 9);
  board(54, 59, 9);
  board(30, 58, 23);
  board(30, 65, 23);
  // 7. crooked, blank sign: plain faded board, right end sagging 1 px
  for (let y = 46; y <= 50; y++) for (let x = 35; x <= 47; x++) img.set(x, y, '#ab947a');
  const wall = img.get(31, 45);
  for (let y = 52; y >= 45; y--) for (let x = 42; x <= 48; x++) img.set(x, y + 1, img.get(x, y));
  for (let x = 42; x <= 47; x++) img.set(x, 45, wall);
  img.set(46, 48, '#694f62'); img.set(45, 49, '#694f62'); img.set(44, 49, '#694f62'); // a crack
  // 8. gaps between the planks, moss on the roof and on the base stones
  for (const [x, y, w] of [[13, 47, 4], [14, 63, 5], [57, 50, 3], [50, 49, 3]]) for (let i = 0; i < w; i++) img.set(x + i, y, '#2e222f');
  const moss = [[8, 71], [9, 70], [21, 72], [22, 72], [65, 70], [66, 71], [9, 66], [10, 67]];
  for (const [x, y] of moss) if (img.get(x, y) && img.get(x, y) !== O) img.set(x, y, (x + y) % 3 ? '#676633' : '#4c3e24');
  return img;
}

/** [derelict, restored, derelict in winter, restored in winter], cropped to the frame */
export function buildWarehouse() {
  const src = Img.load(path.join(HERE, '../raw/pro/0.png'), { unscale: false });
  const wide = widen(src);
  const frames = [derelict(wide), restored(wide), derelict(wide, true), restored(wide, true)].map((im) => {
    const f = new Img(WAREHOUSE.w, WAREHOUSE.h);
    for (let y = 0; y < WAREHOUSE.h; y++) for (let x = 0; x < WAREHOUSE.w; x++) { const c = im.get(x - FX, y - FY); if (c) f.set(x, y, c); }
    return f;
  });
  for (const f of frames) for (const c of f.colors().keys()) if (!PAL.includes(c)) throw new Error('warehouse: off-palette ' + c);
  return frames;
}
