// Print a prepped source as letters (one per palette color) to inspect single pixels:
// node art/crops/ascii.mjs b1/10 [--raw]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArt, hex } from '../../scripts/lib/pixel.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
for (const ref of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const L = loadArt(path.join(here, 'src', ref + '.png'), 1);
  const key = new Map(); const sym = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rows = [];
  for (let y = 0; y < L.img.h; y++) {
    let s = '';
    for (let x = 0; x < L.img.w; x++) {
      const p = (y * L.img.w + x) * 4;
      if (!L.img.data[p + 3]) { s += '.'; continue; }
      const c = hex(L.img.data[p], L.img.data[p + 1], L.img.data[p + 2]);
      if (c === '#2e222f') { s += '#'; continue; }
      if (!key.has(c)) key.set(c, sym[key.size]);
      s += key.get(c);
    }
    rows.push(s);
  }
  console.log(ref, [...key].map(([c, k]) => `${k}=${c}`).join(' '));
  console.log(rows.join('\n'));
}
