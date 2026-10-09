// Zoomed view of a sprite with a coordinate grid, for placing animation effects.
// Usage: node art/factory/gen/inspect.mjs <png> [out.png] [scale] [--snap] [--crop]
//   --crop  trims to the art's bounding box first (coordinates then match the cropped art)
import fs from 'node:fs';
import { loadArt, bbox, crop } from '../../../scripts/lib/pixel.mjs';
import { encodePNG } from '../../../scripts/lib/png.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [file, out = 'e2e/out/inspect.png', K0 = '12'] = args;
const K = +K0;
let img = loadArt(file, 'auto', { snap: process.argv.includes('--snap') }).img;
if (process.argv.includes('--crop')) { const b = bbox(img); img = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); }
const W = img.w * K + K * 2, H = img.h * K + K * 2;
const d = new Uint8Array(W * H * 4);
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) d.set(c, (y * W + x) * 4); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, ((x >> 3) + (y >> 3)) & 1 ? [60, 56, 66, 255] : [72, 68, 78, 255]);
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
  const p = (y * img.w + x) * 4;
  if (img.data[p + 3] < 128) continue;
  for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) put(K * 2 + x * K + xx, K * 2 + y * K + yy, [img.data[p], img.data[p + 1], img.data[p + 2], 255]);
}
// grid lines every pixel (faint) and every 4 (strong), labels every 4
for (let x = 0; x <= img.w; x++) for (let y = K * 2; y < H; y++) put(K * 2 + x * K, y, x % 4 ? [40, 36, 44, 255] : [255, 80, 80, 255]);
for (let y = 0; y <= img.h; y++) for (let x = K * 2; x < W; x++) put(x, K * 2 + y * K, y % 4 ? [40, 36, 44, 255] : [255, 80, 80, 255]);
const label = (n, x0, y0) => [...String(n)].forEach((ch, k) => { const g = DIG[+ch]; for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '1') for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(x0 + (k * 4 + x) * 2 + a, y0 + y * 2 + b, [255, 230, 120, 255]); });
for (let x = 0; x < img.w; x += 4) label(x, K * 2 + x * K + 2, 2);
for (let y = 0; y < img.h; y += 4) label(y, 1, K * 2 + y * K + 2);
fs.writeFileSync(out, encodePNG(W, H, d));
console.log(`${out}: ${img.w}x${img.h} at x${K}`);
