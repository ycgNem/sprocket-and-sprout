// node art/ui/tools/zoom.mjs <in.png> <x> <y> <w> <h> <k> <out.png>: crop + nearest upscale (previews)
import fs from 'node:fs';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
const [f, x, y, w, h, k, out] = process.argv.slice(2);
const im = decodePNG(fs.readFileSync(f));
const W = +w, H = +h, d = new Uint8Array(W * H * 4);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) d.set(im.data.subarray(((+y + j) * im.w + +x + i) * 4, ((+y + j) * im.w + +x + i) * 4 + 4), (j * W + i) * 4);
const u = upscale({ w: W, h: H, data: d }, +k);
fs.writeFileSync(out, encodePNG(u.w, u.h, u.data));
