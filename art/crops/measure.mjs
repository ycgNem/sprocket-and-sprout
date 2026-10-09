// Bounding boxes of review candidates (after unscale, snap, stray removal): node art/crops/measure.mjs <dir> [cols]
import fs from 'node:fs';
import path from 'node:path';
import { loadArt, bbox, dropStrays } from '../../scripts/lib/pixel.mjs';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
const rows = [];
for (const f of files) {
  const L = loadArt(path.join(dir, f), 'auto');
  dropStrays(L.img);
  const b = bbox(L.img);
  rows.push(b ? `${parseInt(f)}:${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}` : `${parseInt(f)}:empty`);
}
console.log(rows.join('  '));
