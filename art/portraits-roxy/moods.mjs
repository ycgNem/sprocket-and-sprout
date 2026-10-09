// Roxy Vane's 64x64 dialogue portraits (twice the detail of the 32x32 villager portraits), built the
// way art/portraits/moods.mjs builds theirs: one neutral bust, and each mood is that bust with only
// the face zone taken from a PixelLab edit of it, so the blink (mood 1 shown for a moment) never
// flickers the hair or the clothes.
//
// Colors: every source color snaps only to the material ramps in `pal` (the same ramps as her
// walking sheet, art/npcs/roxy/prep.config.mjs), with `srcMap` for the big clusters: the plain
// nearest-color snap turns the wine-red hair brown (#6e2727) and the fleece collar sage.
//
//   base   batch2/0.png    create_image_pro 7e539bf5 (16 busts, tight framing), the confident smirk
//   moods  edits/mood<n>.png  edit_image_pro_flash on the base: 1 laughing with closed eyes (also
//          the blink), 2 sad / worried, 3 surprised and flustered (blush)
//   zone   [x0, y0, x1, y1] the face, brows to chin
//
// Usage: node art/portraits-roxy/moods.mjs   (then node scripts/sprites-import.mjs art/portraits-roxy/sprites.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, PAL_LAB, lab, de2000, rgbOf, hex, detectScale, downscale, blank } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const base = 'batch2/0.png';
const moods = { 1: 'edits/mood1.png', 2: 'edits/mood2.png', 3: 'edits/mood3.png' };
const zone = [20, 16, 47, 40];

const pal = [
  '#2e222f', '#45293f', '#694f62', // outline, plum shadow
  '#7a3045', '#ae2334', // wine-red hair, corset
  '#b33831', '#e83b3b', '#f68181', // lips, blush
  '#6e2727', '#9e4539', '#cd683d', // brown leather
  '#e6904e', '#fca790', // skin (apricot ramp with #cd683d)
  '#966c6c', '#ab947a', '#fdcbb0', '#ffffff', // fleece collar, eye whites, teeth
  '#f79617', '#f9c22b', '#fbb954', // brass goggle rims, earrings
  '#625565', '#7f708a', '#9babb2', '#c7dcd0', // goggle glass
];
const srcMap = {
  '#2a0716': '#2e222f',
  // hair (and the corset's dark wine)
  '#380618': '#45293f', '#350c1c': '#45293f', '#430e1c': '#45293f', '#4d0a1c': '#45293f', '#560e23': '#7a3045',
  '#67102a': '#7a3045', '#71152c': '#7a3045', '#7c182e': '#7a3045', '#832531': '#7a3045', '#9b213b': '#ae2334',
  '#b02d44': '#ae2334', '#bc3045': '#ae2334',
  // jacket
  '#411a1c': '#45293f', '#4f2725': '#45293f', '#572328': '#6e2727', '#5c362c': '#6e2727', '#6a3b2e': '#6e2727',
  '#6c1e24': '#6e2727', '#724b33': '#9e4539', '#903e38': '#9e4539', '#9d4f40': '#9e4539', '#966243': '#9e4539',
  // skin
  '#ad5c48': '#cd683d', '#c47956': '#cd683d', '#c28a61': '#e6904e', '#d78e5b': '#e6904e', '#ddad7d': '#fca790',
  // fleece collar
  '#7c6049': '#966c6c', '#9c7550': '#966c6c', '#baa081': '#ab947a', '#c2a985': '#ab947a', '#8a8b7f': '#ab947a',
  '#efd5aa': '#fdcbb0', '#f2e1c8': '#fdcbb0',
  // goggles
  '#708c91': '#9babb2', '#6a6a72': '#7f708a', '#83a0a7': '#9babb2', '#b1cdd4': '#c7dcd0', '#bdd8e1': '#c7dcd0',
  '#cdc6ca': '#c7dcd0', '#ebba60': '#fbb954', '#fede77': '#f9c22b',
  '#fcf7f9': '#ffffff',
};

const allowed = pal.map((h) => { const i = PAL.indexOf(h); if (i < 0) throw new Error(h + ' not in palette'); return i; });
const cache = new Map();
const snapHex = (h) => {
  if (srcMap[h]) return srcMap[h];
  if (!cache.has(h)) {
    const L = lab(rgbOf(h));
    let best = allowed[0], bd = Infinity;
    for (const j of allowed) { const d = de2000(L, PAL_LAB[j], 1); if (d < bd) { bd = d; best = j; } }
    cache.set(h, PAL[best]);
  }
  return cache.get(h);
};
function load(file) {
  const png = decodePNG(fs.readFileSync(path.join(HERE, file)));
  const img = downscale(png, detectScale(png)).img;
  const out = blank(img.w, img.h);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    out.data.set([...rgbOf(snapHex(hex(img.data[i], img.data[i + 1], img.data[i + 2]))), 255], i);
  }
  return out;
}
const get = (img, x, y) => { const p = (y * img.w + x) * 4; return img.data[p + 3] ? hex(img.data[p], img.data[p + 1], img.data[p + 2]) : null; };
const set = (img, x, y, h) => { const p = (y * img.w + x) * 4; if (h === null) img.data.fill(0, p, p + 4); else img.data.set([...rgbOf(h), 255], p); };

fs.mkdirSync(path.join(HERE, 'moods'), { recursive: true });
const neutral = load(base);
fs.writeFileSync(path.join(HERE, 'moods', 'roxy-0.png'), encodePNG(neutral.w, neutral.h, neutral.data));
const recolor = (img, { region: [x0, y0, x1, y1], map }) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = get(img, x, y); if (c && map[c]) set(img, x, y, map[c]); }
};
// inside the face the edits' taupe and amber specks (cheek creases, nose glints) are skin light
const FACE_FIX = [{ region: zone, map: { '#ab947a': '#fca790', '#fbb954': '#fca790' } }];
// mood 3: the edit's blush snaps to skin-shade specks that read as freckles; make them pink
const FIX = { 3: [{ region: [22, 29, 29, 32], map: { '#cd683d': '#f68181' } }, { region: [37, 29, 44, 32], map: { '#cd683d': '#f68181' } }] };
// the beauty mark (her left cheek) stays on every mood
const MARK = [[41, 29]];
for (const [mood, file] of Object.entries(moods)) {
  const edit = load(file);
  const out = { w: neutral.w, h: neutral.h, data: Uint8Array.from(neutral.data) };
  const [x0, y0, x1, y1] = zone;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(out, x, y, get(edit, x, y));
  if (mood !== '1') for (const [x, y] of MARK) set(out, x, y, get(neutral, x, y));
  for (const r of [...FACE_FIX, ...(FIX[mood] ?? [])]) recolor(out, r);
  fs.writeFileSync(path.join(HERE, 'moods', `roxy-${mood}.png`), encodePNG(out.w, out.h, out.data));
}
console.log('moods: 4 portraits -> art/portraits-roxy/moods/');
