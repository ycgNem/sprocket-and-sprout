// Print the art bounding box of every PNG in a folder: node art/factory/gen/sizes.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { loadArt, bbox } from '../../../scripts/lib/pixel.mjs';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort((a, b) => parseInt(a) - parseInt(b));
const out = [];
for (const f of files) {
  const L = loadArt(path.join(dir, f));
  const b = bbox(L.img);
  out.push(`${f.replace('.png', '')}:${b ? `${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}` : 'empty'}${L.k > 1 ? `(k${L.k})` : ''}`);
}
console.log(out.join('  '));
