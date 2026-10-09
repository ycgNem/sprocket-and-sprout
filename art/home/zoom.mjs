// Crop a region of a screenshot and scale it up by an integer (nearest neighbour), for reviews.
// Usage: node art/home/zoom.mjs in.png out.png x,y,w,h scale
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';
const [inp, out, r, sc] = process.argv.slice(2);
const [x0, y0, w, h] = r.split(',').map(Number), s = +sc;
const src = decodePNG(fs.readFileSync(inp));
const data = new Uint8Array(w * s * h * s * 4);
for (let y = 0; y < h * s; y++)
  for (let x = 0; x < w * s; x++) {
    const p = ((y0 + Math.floor(y / s)) * src.w + x0 + Math.floor(x / s)) * 4;
    data.set(src.data.subarray(p, p + 4), (y * w * s + x) * 4);
  }
fs.writeFileSync(out, encodePNG(w * s, h * s, data));
