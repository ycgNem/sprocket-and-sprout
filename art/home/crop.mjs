// Crop a raw candidate to its art bounding box (after undoing upscaling), optionally snapped to the
// palette, and print it as base64 (style references for PixelLab) or write it to a file.
// Usage: node art/home/crop.mjs <in.png> [--out file.png] [--snap] [--b64]
import fs from 'node:fs';
import { loadArt, bbox, crop } from '../../scripts/lib/pixel.mjs';
import { encodePNG } from '../../scripts/lib/png.mjs';
const a = process.argv.slice(2);
const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const L = loadArt(a[0], 'auto', { snap: a.includes('--snap') });
const b = bbox(L.img);
const c = crop(L.img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const png = encodePNG(c.w, c.h, c.data);
if (opt('--out')) fs.writeFileSync(opt('--out'), png);
if (a.includes('--b64')) console.log(Buffer.from(png).toString('base64'));
console.error(`${c.w}x${c.h}`);
