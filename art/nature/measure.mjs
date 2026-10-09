// Bounding boxes of raw candidates after palette snap: node art/nature/measure.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { loadArt, bbox } from '../../scripts/lib/pixel.mjs';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort((a, b) => parseInt(a) - parseInt(b));
for (const f of files) {
  const L = loadArt(path.join(dir, f));
  const b = bbox(L.img);
  if (!b) { console.log(f, 'empty'); continue; }
  console.log(f.padEnd(8), `${L.img.w}x${L.img.h}`, 'art', `${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}`, 'at', b.x0, b.y0, 'colors', L.q.colorsOut.size, 'far', L.q.far);
}
