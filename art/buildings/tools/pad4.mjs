// Snap + trim a PNG and pad it with transparent pixels to multiples of 4 (for PixelLab edits).
// Usage: node art/buildings/tools/pad4.mjs in.png out.png [--nosnap] [--w W --h H]  (pad to at least W x H, art bottom-centered)
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, quantize, bbox, crop, blank, blit } from '../../../scripts/lib/pixel.mjs';
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? +a[i + 1] : d; };
const raw = decodePNG(fs.readFileSync(a[0]));
const img = downscale(raw, detectScale(raw)).img;
if (!a.includes('--nosnap')) quantize(img);
const b = bbox(img);
const art = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const W = Math.ceil(Math.max(art.w, opt('--w', 0)) / 4) * 4, H = Math.ceil(Math.max(art.h, opt('--h', 0)) / 4) * 4;
const out = blank(W, H);
blit(out, art, Math.floor((W - art.w) / 2), H - art.h);
fs.writeFileSync(a[1], encodePNG(W, H, out.data));
console.log(a[1], W + 'x' + H, 'art', art.w + 'x' + art.h);
