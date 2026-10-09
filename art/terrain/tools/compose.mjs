// Compose terrain tiles from graded pieces: a base tile, overlays (opaque pixels only), flips.
// Usage: node art/terrain/tools/compose.mjs art/terrain/compose.json
//   [{ "out": "tiles/ore0/1.png", "base": "tiles/rock/0.png", "flipX": false, "flipY": false,
//      "recolor": [{ "rect": [x, y, w, h], "map": { "#a": "#b" } }], "shade": […],
//      "over": [{ "file": "x.png", "dx": 0, "dy": 0, "flipX": false, "rect": [x, y, w, h] }], "set": [[x, y, "#hex"]] }]
// Paths are relative to the JSON file. Flips of the base apply before the overlays.
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { crop } from '../../../scripts/lib/pixel.mjs';
const file = process.argv[2];
const base = path.dirname(path.resolve(file));
const ops = JSON.parse(fs.readFileSync(file, 'utf8'));
const load = (f, rect) => { const i = decodePNG(fs.readFileSync(path.resolve(base, f))); return rect ? crop(i, ...rect) : i; };
function flip(img, fx, fy) {
  if (!fx && !fy) return img;
  const o = { w: img.w, h: img.h, data: new Uint8Array(img.data.length) };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const sx = fx ? img.w - 1 - x : x, sy = fy ? img.h - 1 - y : y;
    o.data.set(img.data.subarray((sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4), (y * img.w + x) * 4);
  }
  return o;
}
for (const op of ops) {
  const img = flip(load(op.base, op.rect), op.flipX, op.flipY);
  for (const ov of op.over ?? []) {
    const o = flip(load(ov.file, ov.rect), ov.flipX, ov.flipY);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const p = (y * o.w + x) * 4;
      if (o.data[p + 3] < 128) continue;
      const tx = (ov.dx ?? 0) + x, ty = (ov.dy ?? 0) + y;
      if (ov.wrap) { const wx = ((tx % img.w) + img.w) % img.w, wy = ((ty % img.h) + img.h) % img.h; img.data.set([...o.data.subarray(p, p + 3), 255], (wy * img.w + wx) * 4); continue; }
      if (tx < 0 || ty < 0 || tx >= img.w || ty >= img.h) continue;
      img.data.set([...o.data.subarray(p, p + 3), 255], (ty * img.w + tx) * 4);
    }
  }
  // recolor: [{ rect: [x, y, w, h], map: { "#from": "#to" }, only?: [[x, y], …] }] palette swaps inside a region (or listed pixels)
  for (const rc of op.recolor ?? []) {
    const pts = rc.only ?? (() => { const [rx, ry, rw, rh] = rc.rect; const a = []; for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) a.push([x, y]); return a; })();
    for (const [x, y] of pts) {
      const p = (y * img.w + x) * 4, h = '#' + [0, 1, 2].map((k) => img.data[p + k].toString(16).padStart(2, '0')).join('');
      const to = rc.map[h];
      if (to) img.data.set([1, 3, 5].map((j) => parseInt(to.slice(j, j + 2), 16)), p);
    }
  }
  // shade: [{ y0, y1, steps, ladder: [dark … light] }] moves rows y0..y1-1 down the ladder (e.g. a cliff foot in shadow)
  for (const sh of op.shade ?? []) for (let y = sh.y0; y < sh.y1; y++) for (let x = 0; x < img.w; x++) {
    const p = (y * img.w + x) * 4, h = '#' + [0, 1, 2].map((k) => img.data[p + k].toString(16).padStart(2, '0')).join('');
    const k = sh.ladder.indexOf(h);
    if (k > 0) { const t = sh.ladder[Math.max(0, k - sh.steps)]; img.data.set([1, 3, 5].map((j) => parseInt(t.slice(j, j + 2), 16)), p); }
  }
  // set: [[x, y, "#hex"], …] single pixels after the overlays (cleanup)
  for (const [x, y, h] of op.set ?? []) img.data.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], (y * img.w + x) * 4);
  const out = path.resolve(base, op.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(img.w, img.h, img.data));
}
console.log(`${ops.length} tile(s) composed`);
