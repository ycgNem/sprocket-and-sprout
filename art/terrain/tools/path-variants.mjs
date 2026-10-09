// Cobblestone path base variants that tile with the set's pure path tile and with each other: the
// 2-px outer ring stays exactly the base tile (so every edge keeps the same stone/mortar rhythm), the
// 12x12 interior is the base interior mirrored or turned (stones stay in horizontal courses), and some
// variants get a detail: moss in a mortar gap, a cracked stone, a darker stone, a worn stone.
// Moss uses the grass colors on purpose: the season maps turn it olive in fall and snowy in winter.
// Usage: node art/terrain/tools/path-variants.mjs <base.png> <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { hex, rgbOf } from '../../../scripts/lib/pixel.mjs';

const [baseFile, outDir] = process.argv.slice(2);
const base = decodePNG(fs.readFileSync(baseFile));
const S = 16, R = 2, N = S - 2 * R;
const MORTAR = '#3e3546', DARK = '#625565', ROSE = '#966c6c', LIGHT = '#ab947a';
const MOSS = ['#165a4c', '#239063', '#1ebc73'];

const get = (img, x, y) => hex(img.data[(y * S + x) * 4], img.data[(y * S + x) * 4 + 1], img.data[(y * S + x) * 4 + 2]);
const put = (img, x, y, h) => img.data.set([...rgbOf(h), 255], (y * S + x) * 4);
const inner = (x, y) => x >= R + 1 && y >= R + 1 && x < S - R - 1 && y < S - R - 1;

function transform(f) {
  const o = { w: S, h: S, data: new Uint8Array(base.data) };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [sx, sy] = f(x, y);
      const s = ((sy + R) * S + sx + R) * 4;
      o.data.set(base.data.subarray(s, s + 4), ((y + R) * S + x + R) * 4);
    }
  return o;
}
const T = {
  id: (x, y) => [x, y],
  flipX: (x, y) => [N - 1 - x, y],
  flipY: (x, y) => [x, N - 1 - y],
  rot180: (x, y) => [N - 1 - x, N - 1 - y],
};

/** moss: a few grass pixels in the interior mortar pixel with the most mortar around it (nth best) */
function moss(img, nth = 0) {
  const spots = [];
  for (let y = R + 1; y < S - R - 1; y++)
    for (let x = R + 1; x < S - R - 1; x++) {
      if (get(img, x, y) !== MORTAR) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(img, x + dx, y + dy) === MORTAR) n++;
      spots.push({ x, y, n });
    }
  spots.sort((a, b) => b.n - a.n || a.y - b.y || a.x - b.x);
  const s = spots[Math.min(nth, spots.length - 1)];
  const cells = [[0, 0, 0], [1, 0, 1], [0, -1, 2], [-1, 0, 1], [1, -1, 0]];
  for (const [dx, dy, c] of cells) if (inner(s.x + dx, s.y + dy) && get(img, s.x + dx, s.y + dy) === MORTAR) put(img, s.x + dx, s.y + dy, MOSS[c]);
}
/** the nth interior spot where a w x h box is all one color (scanned top-left to bottom-right) */
function box(img, color, w, h, nth) {
  const found = [];
  for (let y = R + 1; y + h <= S - R - 1; y++)
    for (let x = R + 1; x + w <= S - R - 1; x++) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w; xx++) if (get(img, xx, yy) !== color) { ok = false; break; }
      if (ok && !found.some((p) => Math.abs(p[0] - x) < w && Math.abs(p[1] - y) < h)) found.push([x, y]);
    }
  return found[nth % Math.max(1, found.length)];
}
/** darker stone: a light patch turns into a rose cobble with a dark lower edge (lit top-left kept) */
function darker(img, nth = 0) {
  const p = box(img, LIGHT, 4, 2, nth);
  if (!p) return;
  const [x, y] = p;
  for (let xx = x + 1; xx < x + 4; xx++) put(img, xx, y, ROSE);
  for (let xx = x; xx < x + 4; xx++) put(img, xx, y + 1, xx === x ? ROSE : DARK);
}
/** worn stone: a rose patch goes light with two small pits */
function worn(img, nth = 0) {
  const p = box(img, ROSE, 3, 2, nth);
  if (!p) return;
  const [x, y] = p;
  for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 3; xx++) put(img, xx, yy, LIGHT);
  put(img, x + 1, y + 1, ROSE);
}
/** crack: a short diagonal crack across a light patch */
function crack(img, nth = 0) {
  const p = box(img, LIGHT, 3, 3, nth);
  if (!p) return;
  const [x, y] = p;
  put(img, x, y, DARK); put(img, x + 1, y + 1, MORTAR); put(img, x + 1, y + 2, MORTAR); put(img, x + 2, y + 2, DARK);
}

const variants = [
  ['flipX', []],
  ['flipY', [(i) => moss(i, 0)]],
  ['rot180', []],
  ['flipX', [(i) => darker(i, 0)]],
  ['id', [(i) => crack(i, 0), (i) => worn(i, 0)]],
  ['rot180', [(i) => moss(i, 1), (i) => darker(i, 1)]],
];
fs.mkdirSync(outDir, { recursive: true });
variants.forEach(([t, fx], i) => {
  const img = transform(T[t]);
  for (const f of fx) f(img);
  fs.writeFileSync(path.join(outDir, `v${i + 1}.png`), encodePNG(S, S, img.data));
});
console.log(`${variants.length} path variants in ${outDir}`);
