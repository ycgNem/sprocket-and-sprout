// What tools/seams.mjs changed, set by set: masks 1-14 of the tileset as drawn before the seam fix
// (art/terrain/try/seams-before/<set>/, kept by seams.mjs), as they are now (art/terrain/sets/<set>/), and the
// changed pixels in magenta over the dimmed new tile, at x9. Look at it before keeping a seams.mjs change:
// a changed pixel should read as part of the rim or the class it sits in.
// Usage: node art/terrain/tools/seams-diff.mjs [set …] [--out e2e/out/terrain/seams] [--scale 9]
// Writes <out>/diff-<set>.png for every set the fix touched (no set given), or for the sets named.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { crop, blank, blit } from '../../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(here, '..');
const ROOT = path.join(T, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'e2e/out/terrain/seams')), K = +opt('--scale', 9);
const named = args.filter((a, i) => !a.startsWith('--') && !['--out', '--scale'].includes(args[i - 1]));
const kept = path.join(T, 'try', 'seams-before');
const names = named.length ? named : fs.existsSync(kept) ? fs.readdirSync(kept).sort() : [];
if (!names.length) { console.log('seams-diff: nothing to compare (run tools/seams.mjs first; it keeps the sets it changes in try/seams-before/)'); process.exit(0); }

function tiles(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const sheet = decodePNG(fs.readFileSync(path.join(dir, 'tileset.png')));
  const out = {};
  for (const t of meta.tileset_data.tiles) {
    const c = t.corners;
    const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
    out[mask] = crop(sheet, t.bounding_box.x, t.bounding_box.y, 16, 16);
  }
  return out;
}
const masks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const cols = 7, G = 3, cell = 16 + G, band = 3 * 16 + 3 * G + 2;
fs.mkdirSync(OUT, { recursive: true });
for (const name of names) {
  const beforeDir = path.join(kept, name), afterDir = path.join(T, 'sets', name);
  if (!fs.existsSync(beforeDir) || !fs.existsSync(afterDir)) { console.log(`seams-diff: ${name}: no before/after pair`); continue; }
  const A = tiles(beforeDir), B = tiles(afterDir);
  const img = blank(cols * cell, Math.ceil(masks.length / cols) * band);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([46, 34, 47, 255], i);
  let changed = 0;
  masks.forEach((m, k) => {
    const ox = (k % cols) * cell, oy = Math.floor(k / cols) * band;
    blit(img, A[m], ox, oy);
    blit(img, B[m], ox, oy + 16 + G);
    const d = blank(16, 16);
    for (let i = 0; i < 256; i++) {
      const same = [0, 1, 2].every((j) => A[m].data[i * 4 + j] === B[m].data[i * 4 + j]);
      if (!same) changed++;
      d.data.set(same ? [B[m].data[i * 4] >> 2, B[m].data[i * 4 + 1] >> 2, B[m].data[i * 4 + 2] >> 2, 255] : [255, 0, 255, 255], i * 4);
    }
    blit(img, d, ox, oy + 2 * (16 + G));
  });
  const u = upscale(img, K);
  fs.writeFileSync(path.join(OUT, `diff-${name}.png`), encodePNG(u.w, u.h, u.data));
  console.log(`seams-diff: ${name}: ${changed} pixels changed -> ${path.relative(ROOT, path.join(OUT, `diff-${name}.png`)).replace(/\\/g, '/')} (before, after, changed)`);
}
