// Print a rect of a candidate (snapped, trimmed coords) as letters + legend.
// Usage: region.mjs <png> x y w h
import { loadArt, bbox, crop } from '../../../scripts/lib/pixel.mjs';
const [f, x0, y0, w, h] = process.argv.slice(2).map((v, i) => (i ? +v : v));
const L = loadArt(f); const b = bbox(L.img); const a = crop(L.img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const pal = new Map(); const ch = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let r = '    '; for (let x = x0; x < x0 + w; x++) r += String(x % 10); console.log(r);
for (let y = y0; y < y0 + h; y++) {
  let s = '';
  for (let x = x0; x < x0 + w; x++) { if (x >= a.w || y >= a.h) { s += ' '; continue; } const p = (y * a.w + x) * 4; if (!a.data[p + 3]) { s += '.'; continue; } const hx = [0, 1, 2].map((i) => a.data[p + i].toString(16).padStart(2, '0')).join(''); if (!pal.has(hx)) pal.set(hx, ch[pal.size]); s += pal.get(hx); }
  console.log(String(y).padStart(3) + ' ' + s);
}
console.log([...pal].map(([hx, c]) => c + '=#' + hx).join(' '));
