// Seam fix for the diagonal Wang masks (ROADMAP 1.2 bug 3): a set's diagonal tiles (mask 9 = upper NW +
// SE, mask 6 = upper NE + SW) are where PixelLab sets meet their neighbours worst (e2e/seams.mjs). A
// diagonal is two opposite corners that don't touch, so it can be rebuilt from the set's own corner
// tiles: mask 9 = mask 8 above the anti-diagonal + mask 1 below it, mask 6 = mask 4 above the main
// diagonal + mask 2 below it. The cut runs through the lower class in both tiles, and every edge of the
// result is an edge of a corner tile, so the diagonal meets its neighbours exactly as the corners do.
// Usage: node art/terrain/tools/diagonals.mjs <set> …   (graded sets in art/terrain/sets/<set>/; build.sh)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const S = 16;
for (const name of process.argv.slice(2)) {
  const dir = path.join(here, '..', 'sets', name);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const img = decodePNG(fs.readFileSync(path.join(dir, 'tileset.png')));
  const maskOf = (t) => (t.corners.NW === 'upper' ? 8 : 0) | (t.corners.NE === 'upper' ? 4 : 0) | (t.corners.SW === 'upper' ? 2 : 0) | (t.corners.SE === 'upper' ? 1 : 0);
  const box = (m) => meta.tileset_data.tiles.find((t) => maskOf(t) === m).bounding_box;
  const px = (b, x, y) => { const p = ((b.y + y) * img.w + b.x + x) * 4; return img.data.slice(p, p + 4); };
  const put = (b, x, y, c) => img.data.set(c, ((b.y + y) * img.w + b.x + x) * 4);
  const build = (target, a, b, useA) => {
    const T = box(target), A = box(a), B = box(b);
    const src = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) src.push(useA(x, y) ? px(A, x, y) : px(B, x, y));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(T, x, y, src[y * S + x]);
  };
  build(9, 8, 1, (x, y) => x + y < S - 1 || (x + y === S - 1 && x < S / 2)); // NW corner tile above the anti-diagonal
  build(6, 4, 2, (x, y) => x - y > 0 || (x === y && x >= S / 2)); // NE corner tile above the main diagonal
  fs.writeFileSync(path.join(dir, 'tileset.png'), encodePNG(img.w, img.h, img.data));
  console.log(`diagonals: ${name} masks 9 and 6 rebuilt from its corner tiles`);
}
