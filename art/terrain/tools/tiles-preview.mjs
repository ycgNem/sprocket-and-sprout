// Each per-tile class dir (art/terrain/tiles/<class>/*.png) as a 4x4 patch of its variants, side by side.
// Usage: node art/terrain/tools/tiles-preview.mjs <tiles dir> <out.png> [scale] [class …]
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { blank, blit } from '../../../scripts/lib/pixel.mjs';
const [dir, out, sc = '3', ...only] = process.argv.slice(2);
const classes = (only.length ? only : fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory())).sort();
const N = 4, T = 16, P = N * T + 4;
const cols = 8, rows = Math.ceil(classes.length / cols);
const img = blank(cols * P, rows * P);
for (let i = 0; i < img.data.length; i += 4) img.data.set([46, 34, 47, 255], i);
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
classes.forEach((c, k) => {
  const files = fs.readdirSync(path.join(dir, c)).filter((f) => /\.png$/.test(f)).map((f) => decodePNG(fs.readFileSync(path.join(dir, c, f))));
  const ox = (k % cols) * P + 2, oy = Math.floor(k / cols) * P + 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) blit(img, files[Math.floor(hash(x, y, k) * files.length)], ox + x * T, oy + y * T);
});
const u = upscale(img, +sc);
fs.writeFileSync(out, encodePNG(u.w, u.h, u.data));
console.log(out + ': ' + classes.join(' '));
