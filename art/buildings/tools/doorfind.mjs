// Print the bottom rows of a candidate as letters (one per palette color) to read the door span.
// Usage: doorfind.mjs <png> [rows=24] [--every 1]
import { loadArt, bbox, crop } from '../../../scripts/lib/pixel.mjs';
const [f, n = 24] = process.argv.slice(2);
const L = loadArt(f); const b = bbox(L.img); const a = crop(L.img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const pal = new Map(); const ch = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let ruler1 = '', ruler2 = '';
for (let x = 0; x < a.w; x++) { ruler1 += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' '; ruler2 += String(x % 10); }
console.log('    ' + ruler1); console.log('    ' + ruler2);
for (let y = Math.max(0, a.h - n); y < a.h; y++) {
  let s = '';
  for (let x = 0; x < a.w; x++) { const p = (y * a.w + x) * 4; if (!a.data[p + 3]) { s += '.'; continue; } const h = [0, 1, 2].map((i) => a.data[p + i].toString(16).padStart(2, '0')).join(''); if (!pal.has(h)) pal.set(h, ch[pal.size]); s += pal.get(h); }
  console.log(String(y).padStart(3) + ' ' + s);
}
console.log([...pal].map(([h, c]) => c + '=#' + h).join(' '));
