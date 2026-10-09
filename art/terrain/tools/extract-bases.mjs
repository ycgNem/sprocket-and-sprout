// Save each graded set's pure tiles (all corners lower / all upper) as try/bases/<class>-<set>.png.
// Usage: node art/terrain/tools/extract-bases.mjs  (run from the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { crop } from '../../../scripts/lib/pixel.mjs';
const root = 'art/terrain/sets';
fs.mkdirSync('art/terrain/try/bases', { recursive: true });
for (const d of fs.readdirSync(root)) {
  const [lower, upper] = d.split('-');
  const meta = JSON.parse(fs.readFileSync(path.join(root, d, 'tileset.json'), 'utf8'));
  const img = decodePNG(fs.readFileSync(path.join(root, d, 'tileset.png')));
  for (const t of meta.tileset_data.tiles) {
    const v = Object.values(t.corners);
    const cls = v.every((c) => c === 'lower') ? lower : v.every((c) => c === 'upper') ? upper : null;
    if (!cls) continue;
    const b = t.bounding_box;
    fs.writeFileSync(`art/terrain/try/bases/${cls}-${d}.png`, encodePNG(16, 16, crop(img, b.x, b.y, 16, 16).data));
  }
}
console.log(fs.readdirSync('art/terrain/try/bases').join(' '));
