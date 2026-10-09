// Color prep for the crop candidates: PixelLab draws leaves in pure grass greens (hue ~110°) that sit
// between Resurrect's emerald foliage ramp and its olives, so the plain snap sends many of them to the
// cool sage grays (#547e64, #374e4a, #313638) and the plants go dull. This maps every saturated green
// onto the foliage ramp by lightness (STYLE.md: #165a4c #239063 #1ebc73 #91db69 #cddf6c, olive for
// yellow-greens), near-black greens onto the plum outline, and snaps everything else as the importer
// would. Output is palette-exact, so the import is a no-op on colors.
//
// Ripe glint: every ripe take (PICKS[id].ripe) gets a warm glow highlight (STYLE.md: ripe has a
// sparkle or glow) when it has fewer than 2 glow pixels: the lightest interior pixel of the fruit
// becomes #fbff86 (yellow/green fruit) or #fdcbb0 (red/orange/purple fruit), plus its lightest
// neighbor to the right or below.
//
// Usage: node art/crops/prep.mjs <batch> [<batch> …]   raw/<batch>/*.png -> src/<batch>/*.png (1x)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';
import { detectScale, downscale, nearest, PAL, rgbOf, lab, de2000, hex } from '../../scripts/lib/pixel.mjs';
import { PICKS, FERT } from './picks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FOLIAGE = ['#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'].map((h) => ({ h, rgb: rgbOf(h), lab: lab(rgbOf(h)) }));
const OUTLINE = rgbOf('#2e222f');

function hsv([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}

export function mapColor(rgb, plain = false) {
  const { h, s } = hsv(rgb);
  if (plain) return rgbOf(PAL[nearest(rgb[0], rgb[1], rgb[2]).i]);
  const L = lab(rgb);
  if (h >= 70 && h <= 160 && s >= 0.3) {
    if (L[0] < 16) return OUTLINE;
    let best = null, bd = Infinity;
    for (const f of FOLIAGE) { const d = de2000(L, f.lab, 1); if (d < bd) { bd = d; best = f; } }
    return best.rgb;
  }
  return rgbOf(PAL[nearest(rgb[0], rgb[1], rgb[2]).i]);
}

// fertilizer specks keep their own lime/sky/amber: plain snap, no foliage remap
const PLAIN = new Set(Object.values(FERT));
const RIPE = new Set(Object.values(PICKS).flatMap((p) => p.ripe ?? []));
const GLOW = new Set(['#fbff86', '#fdcbb0']);
const NOT_FRUIT = new Set(['#2e222f', '#165a4c', '#239063', '#1ebc73', '#ffffff', '#fbff86', '#fdcbb0']);
function glint(img) {
  const { w, h, data: d } = img;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : d[(y * w + x) * 4 + 3] ? hex(...d.subarray((y * w + x) * 4, (y * w + x) * 4 + 3)) : null);
  let glow = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (GLOW.has(at(x, y))) glow++;
  if (glow >= 2) return 0;
  let best = null;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const c = at(x, y);
      if (!c || NOT_FRUIT.has(c) || ![at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].every(Boolean)) continue;
      const l = lab(rgbOf(c))[0];
      if (!best || l > best.l) best = { x, y, c, l };
    }
  if (!best) return 0;
  const { h: hue } = hsv(rgbOf(best.c));
  const to = rgbOf(hue >= 45 && hue <= 170 ? '#fbff86' : '#fdcbb0');
  const put = (x, y) => d.set([...to, 255], (y * w + x) * 4);
  put(best.x, best.y);
  const nb = [[best.x + 1, best.y], [best.x, best.y + 1]].map(([x, y]) => ({ x, y, c: at(x, y) })).filter((n) => n.c && !NOT_FRUIT.has(n.c)).sort((a, b) => lab(rgbOf(b.c))[0] - lab(rgbOf(a.c))[0])[0];
  if (nb) put(nb.x, nb.y);
  return nb ? 2 : 1;
}

// ---- ripe clean-up: no baked sparkle crosses (the renderer twinkles every ripe crop itself) ----
const OUT = '#2e222f';
const SPARK = new Set(['#fbff86', '#f9c22b', '#fbb954', '#ffffff', '#fdcbb0', '#f79617', '#c7dcd0', '#8ff8e2', '#e6904e', '#ab947a']);
function pixels(img) {
  const { w, h, data: d } = img;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : d[(y * w + x) * 4 + 3] ? hex(...d.subarray((y * w + x) * 4, (y * w + x) * 4 + 3)) : null);
  const put = (x, y, c) => (c ? d.set([...rgbOf(c), 255], (y * w + x) * 4) : d.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4));
  return { w, h, at, put };
}
/** Remove "+" sparkles: a spark-colored center with spark-colored arms and at most one spark diagonal. */
function unsparkle(img) {
  const { w, h, at, put } = pixels(img);
  const sp = (x, y) => SPARK.has(at(x, y));
  const cross = new Set();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // (a) spark-colored plus, also over the plant; (b) any-colored plus floating in open air
      // (sprites have closed outlines, so unoutlined pixels with air on 3 diagonals are sparkles)
      const solid = (px, py) => at(px, py) && at(px, py) !== OUT;
      const isA = sp(x, y) && sp(x - 1, y) && sp(x + 1, y) && sp(x, y - 1) && sp(x, y + 1)
        && sp(x - 1, y - 1) + sp(x + 1, y - 1) + sp(x - 1, y + 1) + sp(x + 1, y + 1) <= 1;
      const isB = solid(x, y) && solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)
        && !at(x - 1, y - 1) + !at(x + 1, y - 1) + !at(x - 1, y + 1) + !at(x + 1, y + 1) >= 3;
      if (!isA && !isB) continue;
      const arm = isA ? sp : (px, py) => solid(px, py) && !at(px - 1, py - 1) + !at(px + 1, py - 1) + !at(px - 1, py + 1) + !at(px + 1, py + 1) >= 2;
      cross.add(y * w + x);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        for (let k = 1; k <= 3 && arm(x + dx * k, y + dy * k); k++) cross.add((y + dy * k) * w + x + dx * k);
    }
  if (!cross.size) return 0;
  // repaint each cross pixel from its surroundings: open air stays open, inside the plant takes the
  // most common neighboring plant color
  const fills = [];
  for (const i of cross) {
    const x = i % w, y = (i / w) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => !cross.has(ny * w + nx));
    const open = nb.slice(0, 4).filter(([nx, ny]) => !at(nx, ny)).length;
    const cols = nb.map(([nx, ny]) => at(nx, ny)).filter((c) => c && c !== OUT);
    const mode = cols.sort((a, b) => cols.filter((c) => c === b).length - cols.filter((c) => c === a).length)[0];
    fills.push([x, y, open >= 2 || !mode ? null : mode]);
  }
  for (const [x, y, c] of fills) put(x, y, c);
  // close the outline where a cross sat on the silhouette, then drop loose bits (a cross's own outline)
  for (const [x, y, c] of fills) if (!c) for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (at(nx, ny) && at(nx, ny) !== OUT) put(nx, ny, OUT);
  dropSmallParts(img, 12);
  return cross.size;
}
function dropSmallParts(img, max) {
  const { w, h, at, put } = pixels(img);
  const seen = new Int32Array(w * h).fill(-1), parts = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] >= 0 || !at(s % w, (s / w) | 0)) continue;
    const q = [s], part = [];
    seen[s] = parts.length;
    while (q.length) {
      const i = q.pop(); part.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]]) {
        const j = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && seen[j] < 0 && at(nx, ny)) { seen[j] = parts.length; q.push(j); }
      }
    }
    parts.push(part);
  }
  const big = Math.max(...parts.map((p) => p.length));
  for (const p of parts) if (p.length <= max && p.length < big) for (const i of p) put(i % w, (i / w) | 0, null);
}

// ---- leafy ripe: a lit rim and a fuller crown so ripe reads apart from the stage before ----
// (cabbage, kale, frostmint, tea leaf, spinach and rhubarb ripen into a bigger rosette)
const LEAFY = new Set(['cabbage', 'kale', 'frostmint', 'tealeaf', 'spinach', 'rhubarb']);
const LEAFY_RIPE = new Set([...LEAFY].flatMap((id) => PICKS[id].ripe));
const RIM = { '#165a4c': '#cddf6c', '#239063': '#cddf6c', '#1ebc73': '#cddf6c', '#91db69': '#cddf6c', '#374e4a': '#cddf6c', '#547e64': '#cddf6c',
  '#0b5e65': '#8ff8e2', '#0b8a8f': '#8ff8e2', '#0eaf9b': '#8ff8e2', '#30e1b9': '#8ff8e2' }; // teal frostmint gets a pale teal rim
function ripen(img) {
  const { w, h, at, put } = pixels(img);
  // fuller: fill notches in the silhouette (open pixels walled in on 3 sides), then raise the crown 1 px
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!at(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy)).length >= 3) add.push([x, y]);
    for (const [x, y] of add) put(x, y, OUT);
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h && !at(x, y)) y++;
    if (y > 0 && y < h && at(x, y) === OUT && at(x, y + 1) && at(x, y + 1) !== OUT) { put(x, y - 1, OUT); put(x, y, at(x, y + 1)); }
  }
  // outline pixels that ended up inside take the color under them
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (at(x, y) === OUT && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => at(x + dx, y + dy))) {
        const below = at(x, y + 1) !== OUT ? at(x, y + 1) : at(x + 1, y) !== OUT ? at(x + 1, y) : null;
        if (below && RIM[below]) put(x, y, below);
      }
  // lit rim: leaf pixels whose top or left neighbor is outline or air
  const rim = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (!RIM[c]) continue;
      const up = at(x, y - 1), left = at(x - 1, y);
      if (!up || up === OUT || !left || left === OUT) rim.push([x, y, RIM[c]]);
    }
  for (const [x, y, c] of rim) put(x, y, c);
  return rim.length;
}

const report = process.argv.includes('--report');
for (const batch of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const inDir = path.join(here, 'raw', batch), outDir = path.join(here, 'src', batch);
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(inDir).filter((f) => /^\d+\.png$/.test(f));
  for (const f of files) {
    const raw = decodePNG(fs.readFileSync(path.join(inDir, f)));
    const img = downscale(raw, detectScale(raw)).img;
    const d = img.data, plain = PLAIN.has(batch + '/' + f.replace('.png', ''));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d.fill(0, i, i + 4); continue; }
      d.set([...mapColor([d[i], d[i + 1], d[i + 2]], plain), 255], i);
    }
    const ref = batch + '/' + f.replace('.png', '');
    if (RIPE.has(ref)) {
      const crosses = unsparkle(img);
      dropSmallParts(img, 12); // loose glitter around the plant
      const rim = LEAFY_RIPE.has(ref) ? ripen(img) : 0;
      glint(img);
      if (report && (crosses || rim)) console.log(`  ${ref}: ${crosses ? crosses + ' sparkle px removed' : ''}${rim ? ` rim ${rim} px` : ''}`);
    }
    fs.writeFileSync(path.join(outDir, f), encodePNG(img.w, img.h, d));
  }
  console.log(`${batch}: ${files.length} -> art/crops/src/${batch}`);
}
