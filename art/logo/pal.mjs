// Resurrect 64 colors the logo uses (STYLE.md material ramps), and tiny image helpers.
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG, upscale } from '../../scripts/lib/png.mjs';

export const PX = {
  ink: '#2e222f', // outline
  plum: '#45293f', // deepest shade, drop shadow
  // brass, shadow -> light: wine, rust, copper, orange, gold, butter
  brass: ['#7a3045', '#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'],
  // foliage, shadow -> light
  leaf: ['#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'],
  // cream: taupe shade .. white glint
  cream: ['#966c6c', '#ab947a', '#fdcbb0', '#ffffff'],
  amber: '#fbb954',
};

export const rgba = (h) => (h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255] : [0, 0, 0, 0]);

/** { w, h, px: hex|null[] } -> RGBA image */
export function toImage({ w, h, px }) {
  const data = new Uint8Array(w * h * 4);
  px.forEach((p, i) => data.set(rgba(p), i * 4));
  return { w, h, data };
}

export function blank(w, h, fill = null) {
  const data = new Uint8Array(w * h * 4);
  if (fill) for (let i = 0; i < w * h; i++) data.set(rgba(fill), i * 4);
  return { w, h, data };
}

/** alpha-blit src onto dst at (dx, dy), scaled by k (nearest) */
export function draw(dst, src, dx, dy, k = 1) {
  for (let y = 0; y < src.h * k; y++)
    for (let x = 0; x < src.w * k; x++) {
      const s = (Math.floor(y / k) * src.w + Math.floor(x / k)) * 4;
      if (!src.data[s + 3]) continue;
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.w + tx) * 4);
    }
}

export function fillRect(dst, x0, y0, w, h, hex) {
  const c = rgba(hex);
  for (let y = Math.max(0, y0); y < Math.min(dst.h, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(dst.w, x0 + w); x++) dst.data.set(c, (y * dst.w + x) * 4);
}

export function save(file, img, k = 1) {
  const im = k > 1 ? upscale(img, k) : img;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(im.w, im.h, im.data));
}
