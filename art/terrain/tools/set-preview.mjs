// Preview a Wang tileset (pl-fetch.mjs tileset dir): its 16 masks in order and a made-up patch of the
// lower class in the upper class drawn with the game's dual-grid rule, at x4. Optional base tiles
// (--lower a.png,b.png --upper c.png) stand in for masks 0 / 15 the way the game uses bases.
// Usage: node art/terrain/tools/set-preview.mjs <set dir> <out.png> [--lower f1,f2] [--upper f1,f2]
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { crop, blank, blit } from '../../../scripts/lib/pixel.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const [dir, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
const sheet = decodePNG(fs.readFileSync(path.join(dir, 'tileset.png')));
const tiles = {};
for (const t of meta.tileset_data?.tiles ?? meta.tiles) {
  const c = t.corners;
  const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
  const b = t.bounding_box;
  (tiles[mask] ??= []).push(crop(sheet, b.x, b.y, 16, 16));
}
const load = (list) => list?.split(',').map((f) => decodePNG(fs.readFileSync(f)));
const lowerB = load(opt('--lower')), upperB = load(opt('--upper'));
if (lowerB) tiles[0] = lowerB;
if (upperB) tiles[15] = upperB;
// map: 1 = lower class
const MW = 14, MH = 10;
const map = [];
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
  let c = 0;
  if (x >= 2 && x <= 10 && y >= 2 && y <= 6) c = 1; // a square
  if (y === 4 && x > 10) c = 1; // a 1-wide road out
  if (x === 5 && y > 6) c = 1; // a 1-wide road down
  if (x >= 8 && x <= 9 && y >= 7) c = 1; // a 2-wide road down
  if (x === 12 && y === 8) c = 1; // a lone tile
  if ((x === 3 || x === 4) && y === 3) c = 0; // a notch of grass inside
  map.push(c);
}
const at = (x, y) => map[Math.max(0, Math.min(MH - 1, y)) * MW + Math.max(0, Math.min(MW - 1, x))];
const demo = blank(MW * 16, MH * 16);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
for (let vy = 0; vy <= MH; vy++)
  for (let vx = 0; vx <= MW; vx++) {
    const up = (x, y) => (at(x, y) ? 0 : 1);
    const mask = (up(vx - 1, vy - 1) << 3) | (up(vx, vy - 1) << 2) | (up(vx - 1, vy) << 1) | up(vx, vy);
    const l = tiles[mask];
    if (l) blit(demo, l[Math.floor(hash(vx, vy) * l.length)], vx * 16 - 8, vy * 16 - 8);
  }
const strip = blank(16 * 17, 16);
for (let m = 0; m < 16; m++) if (tiles[m]) blit(strip, tiles[m][0], m * 17, 0);
const img = blank(Math.max(strip.w, demo.w), strip.h + 4 + demo.h);
for (let i = 0; i < img.data.length; i += 4) img.data.set([46, 34, 47, 255], i);
blit(img, strip, 0, 0);
blit(img, demo, 0, strip.h + 4);
const u = upscale(img, 4);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(u.w, u.h, u.data));
console.log(`${out}: masks 0-15 on top, a demo patch below`);
