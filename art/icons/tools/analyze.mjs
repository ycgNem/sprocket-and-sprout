// Icon candidate stats: art bbox, colors after the palette snap, how much of the silhouette
// edge is the #2e222f outline, far-snapped pixels.
// Usage: node art/icons/tools/analyze.mjs <dir> [--only 0,3,5]
import fs from 'node:fs';
import path from 'node:path';
import { loadArt, bbox, hex } from '../../../scripts/lib/pixel.mjs';
const args = process.argv.slice(2);
const dir = args[0];
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',').map(Number)) : null;
const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
const rows = [];
for (const f of files) {
  const i = parseInt(f);
  if (only && !only.has(i)) continue;
  const L = loadArt(path.join(dir, f));
  const im = L.img;
  const b = bbox(im);
  if (!b) { rows.push(`${i}\tempty`); continue; }
  const at = (x, y) => (x < 0 || y < 0 || x >= im.w || y >= im.h ? 0 : im.data[(y * im.w + x) * 4 + 3]);
  let edge = 0, ink = 0;
  const cols = new Set();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const p = (y * im.w + x) * 4;
    if (!im.data[p + 3]) continue;
    const h = hex(im.data[p], im.data[p + 1], im.data[p + 2]);
    cols.add(h);
    if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) { edge++; if (h === '#2e222f') ink++; }
  }
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  rows.push(`${i}\t${w}x${h}${w > 14 || h > 14 ? ' BIG' : ''}\tcolors ${cols.size}\toutline ${Math.round((100 * ink) / edge)}%\tfar ${((100 * L.q.far) / L.q.opaque).toFixed(1)}%`);
}
console.log(rows.join('\n'));
