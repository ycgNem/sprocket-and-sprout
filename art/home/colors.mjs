// List the palette colors a candidate snaps to (count, hex, and the source colors that land on each),
// plus an ASCII map of the snapped art, to plan recolors and fix-ups.
// Usage: node art/home/colors.mjs <in.png> [--map]
import { loadArt, PAL, hex } from '../../scripts/lib/pixel.mjs';
const [file, ...rest] = process.argv.slice(2);
const raw = loadArt(file, 'auto', { snap: false }).img, L = loadArt(file, 'auto').img;
const by = new Map();
for (let i = 0; i < L.data.length; i += 4) {
  if (L.data[i + 3] < 128) continue;
  const h = hex(L.data[i], L.data[i + 1], L.data[i + 2]), s = hex(raw.data[i], raw.data[i + 1], raw.data[i + 2]);
  const e = by.get(h) ?? { n: 0, src: new Map() };
  e.n++; e.src.set(s, (e.src.get(s) ?? 0) + 1); by.set(h, e);
}
const keys = [...by.keys()].sort((a, b) => by.get(b).n - by.get(a).n);
const sym = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
keys.forEach((k, i) => console.log(sym[i], k, `pal${PAL.indexOf(k)}`, by.get(k).n, [...by.get(k).src].map(([s, n]) => `${s}x${n}`).join(' ')));
if (rest.includes('--map')) for (let y = 0; y < L.h; y++) {
  let row = '';
  for (let x = 0; x < L.w; x++) { const p = (y * L.w + x) * 4; row += L.data[p + 3] < 128 ? '.' : sym[keys.indexOf(hex(L.data[p], L.data[p + 1], L.data[p + 2]))]; }
  if (row.replace(/\./g, '')) console.log(String(y).padStart(2), row);
}
