// Inspect a candidate: snap to the palette, trim, print size + color histogram, and write an
// x4 view with a grid (thin every 8 px, bright every 16) so coordinates can be read off.
// Usage: node art/buildings/tools/inspect.mjs <png> [--out file.png] [--grid 8] [--notrim]
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, quantize, bbox, crop, PAL } from '../../../scripts/lib/pixel.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args[0];
const raw = decodePNG(fs.readFileSync(file));
let img = downscale(raw, detectScale(raw)).img;
const q = quantize(img);
const b = bbox(img);
if (!args.includes('--notrim')) img = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const hist = new Map();
for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) { const h = '#' + [0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join(''); hist.set(h, (hist.get(h) ?? 0) + 1); }
console.log(`${file}: raw ${raw.w}x${raw.h}, bbox x${b.x0}-${b.x1} y${b.y0}-${b.y1} -> art ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}, meanDE ${q.meanD.toFixed(1)}, far ${q.far}`);
console.log([...hist].sort((a, c) => c[1] - a[1]).map(([h, n]) => `${PAL.indexOf(h)}:${h}:${n}`).join(' '));
const K = 4, G = +opt('--grid', 8), W = img.w * K, H = img.h * K;
const out = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = Math.floor(x / K), sy = Math.floor(y / K), p = (sy * img.w + sx) * 4, o = (y * W + x) * 4;
  const chk = ((sx >> 2) + (sy >> 2)) % 2 ? 60 : 80;
  if (img.data[p + 3]) out.set([img.data[p], img.data[p + 1], img.data[p + 2], 255], o); else out.set([chk, chk, chk, 255], o);
  const onX = x % (G * K) === 0, onY = y % (G * K) === 0;
  if (onX || onY) {
    const major = (onX && sx % 16 === 0) || (onY && sy % 16 === 0);
    out.set(major ? [255, 0, 255, 255] : [0, 255, 255, 255], o);
  }
}
const of = opt('--out', file.replace(/\.png$/, '.grid.png'));
fs.writeFileSync(of, encodePNG(W, H, out));
console.log('grid view:', of);
