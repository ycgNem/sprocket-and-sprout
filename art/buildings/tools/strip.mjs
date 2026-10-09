// Paste several PNGs (snapped, trimmed) side by side, bottom-aligned, on a transparent strip.
// Usage: node art/buildings/tools/strip.mjs out.png a.png b.png ... [--gap 8] [--pad 4]
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, quantize, bbox, crop, blank, blit } from '../../../scripts/lib/pixel.mjs';
const args = process.argv.slice(2);
const out = args[0];
const files = args.slice(1).filter((a) => !a.startsWith('--'));
const imgs = files.map((f) => { const raw = decodePNG(fs.readFileSync(f)); const img = downscale(raw, detectScale(raw)).img; quantize(img); const b = bbox(img); return crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); });
const gap = 8, pad = 4;
const W = imgs.reduce((a, i) => a + i.w, 0) + gap * (imgs.length - 1) + pad * 2, H = Math.max(...imgs.map((i) => i.h)) + pad * 2;
const W4 = Math.ceil(W / 4) * 4, H4 = Math.ceil(H / 4) * 4;
const s = blank(W4, H4);
let x = pad;
for (const i of imgs) { blit(s, i, x, H4 - pad - i.h); x += i.w + gap; }
fs.writeFileSync(out, encodePNG(s.w, s.h, s.data));
console.log(out, s.w + 'x' + s.h);
