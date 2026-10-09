// Hearth flame layers: hf:fire:<n> = the fire-coloured pixels of each PixelLab animation frame
// (raw/fire/1..6.png, animate_image on src/fireplace_lit.png) that differ from the empty hearth
// (src/fireplace.png), only where the empty hearth is dark interior (#45293f). Stone, mantel and logs never leak in, so the
// layer can be drawn over the static fireplace on any frame.
// Usage: node art/home/fire.mjs   → art/home/src/fire0.png … fire5.png (13x15)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArt, bbox, crop, blank, hex } from '../../scripts/lib/pixel.mjs';
import { encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = [9, 16, 13, 15]; // hearth opening in fireplace art coords (x, y, w, h)
const FIRE = new Set(['#ea4f36', '#fb6b1d', '#f79617', '#f9c22b', '#fbff86', '#e83b3b', '#b33831', '#fbb954', '#e6904e', '#f57d4a']);

const trim = (img) => { const b = bbox(img); return crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); };
const base = loadArt(path.join(HERE, 'src/fireplace.png'), 1).img;
const frames = fs.readdirSync(path.join(HERE, 'raw/fire')).filter((f) => /^\d+\.png$/.test(f) && f !== '0.png').sort((a, b) => parseInt(a) - parseInt(b));
frames.forEach((f, n) => {
  const fr = loadArt(path.join(HERE, "raw/fire", f), 1).img; // same 30x34 canvas as the seed: no trim, so frames stay aligned
  if (fr.w !== base.w || fr.h !== base.h) console.log(`warning: ${f} is ${fr.w}x${fr.h}, base ${base.w}x${base.h}`);
  const out = blank(R[2], R[3]);
  let n_px = 0;
  for (let y = 0; y < R[3]; y++)
    for (let x = 0; x < R[2]; x++) {
      const p = ((R[1] + y) * fr.w + R[0] + x) * 4, q = ((R[1] + y) * base.w + R[0] + x) * 4;
      if (fr.data[p + 3] < 128) continue;
      const c = hex(fr.data[p], fr.data[p + 1], fr.data[p + 2]);
      const same = base.data[q + 3] >= 128 && c === hex(base.data[q], base.data[q + 1], base.data[q + 2]);
      const inside = base.data[q + 3] >= 128 && hex(base.data[q], base.data[q + 1], base.data[q + 2]) === '#45293f'; // dark hearth interior only
      if (same || !inside || !FIRE.has(c)) continue;
      out.data.set(fr.data.subarray(p, p + 4), (y * R[2] + x) * 4);
      n_px++;
    }
  fs.writeFileSync(path.join(HERE, 'src', `fire${n}.png`), encodePNG(out.w, out.h, out.data));
  console.log(`fire${n}: ${n_px} flame pixels from ${f}`);
});
