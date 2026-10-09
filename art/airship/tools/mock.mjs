// Scale mock: the Brass Vixen next to the store (Thistlewick Mercantile, an 8 x 6 building) on
// grass, both cut from the imported sheets with their manifest offsets exactly as the renderer
// draws them (footprint top-left minus o). Footprints are outlined in dots, the airship's door tile
// (x = 4 of the bottom row) in a box.
//
//   node art/airship/tools/mock.mjs   -> e2e/out/airship/mock-scale.png (x3)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const T = 16;
const sheet = (name) => ({ m: JSON.parse(fs.readFileSync(path.join(ROOT, `src/art/${name}.json`), 'utf8')), img: decodePNG(fs.readFileSync(path.join(ROOT, `src/art/${name}.png`))) });
const sheets = { buildings: sheet('buildings'), airship: sheet('airship') };
const find = (s, name) => s.m.sprites.find((e) => e.match === name);

const W = 21 * T, H = 14 * T;
const img = { w: W, h: H, data: new Uint8Array(W * H * 4) };
const put = (x, y, rgb) => { if (x >= 0 && y >= 0 && x < W && y < H) img.data.set([...rgb, 255], (y * W + x) * 4); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// grass with a few tufts so the shadow reads against something
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, rgb(((x * 7 + y * 13) % 29 === 0) ? '#165a4c' : ((x * 5 + y * 3) % 37 === 0) ? '#91db69' : '#239063'));

function draw(s, name, fx, fy) {
  const e = find(s, name);
  const [sx, sy, sw, sh] = e.r, [ox, oy] = e.o;
  const x0 = fx * T - ox, y0 = fy * T - oy;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const p = ((sy + y) * s.img.w + sx + x) * 4;
    if (s.img.data[p + 3]) put(x0 + x, y0 + y, [s.img.data[p], s.img.data[p + 1], s.img.data[p + 2]]);
  }
}
const dots = (fx, fy, fw, fh, c) => {
  for (let x = fx * T; x < (fx + fw) * T; x += 2) { put(x, fy * T, c); put(x, (fy + fh) * T - 1, c); }
  for (let y = fy * T; y < (fy + fh) * T; y += 2) { put(fx * T, y, c); put((fx + fw) * T - 1, y, c); }
};
const ground = 13; // both footprints end on tile row 12
draw(sheets.buildings, 'bld:store:1:0', 1, ground - 6);
draw(sheets.airship, 'bld:airship:1:0:0', 11, ground - 5);
dots(1, ground - 6, 8, 6, rgb('#fbff86'));
dots(11, ground - 5, 8, 5, rgb('#fbff86'));
dots(11 + 4, ground - 1, 1, 1, rgb('#fbb954'));
const out = path.join(ROOT, 'e2e/out/airship/mock-scale.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const u = upscale(img, 3);
fs.writeFileSync(out, encodePNG(u.w, u.h, u.data));
console.log(out);
