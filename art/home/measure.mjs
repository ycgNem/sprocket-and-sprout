// Measure the art bounding box of each candidate in a raw batch folder (after undoing upscaling).
// Usage: node art/home/measure.mjs art/home/raw/<batch>
import fs from 'node:fs';
import path from 'node:path';
import { loadArt, bbox } from '../../scripts/lib/pixel.mjs';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
const out = [];
for (const f of files) {
  const L = loadArt(path.join(dir, f), 'auto');
  const b = bbox(L.img);
  out.push(`${parseInt(f)}:${b ? `${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}` : '-'}${L.k > 1 ? `(x${L.k})` : ''}`);
}
console.log(out.join('  '));
