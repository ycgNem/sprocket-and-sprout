// Pixel kit for the Deepworks art scripts (art/deep/): palette-only images, PNG I/O, snapping,
// outlines, previews. Shared PNG and palette code comes from scripts/lib (the importers' own).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { PAL, nearest, detectScale, downscale } from '../../../scripts/lib/pixel.mjs';

export const DEEP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(DEEP, '../..');
export { PAL };

export const INK = '#2e222f';
export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// material ramps (STYLE.md), dark -> light
export const WOOD = ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'];
export const BRASS = ['#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'];
export const COPPER = ['#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790'];
export const IRON = ['#3e3546', '#625565', '#7f708a', '#9babb2'];
export const STONE = ['#3e3546', '#625565', '#966c6c', '#ab947a', '#c7dcd0'];
export const GLOW = ['#fbb954', '#f9c22b', '#fbff86', '#fdcbb0'];
export const WATER = ['#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff'];
export const STAR = ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'];

/** deterministic hash in [0, 1) */
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Img {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  /** load a PNG; integer upscaling undone, alpha thresholded, optionally snapped to the palette */
  static load(file, { snap = false, kL = 2, scale = 'auto' } = {}) {
    let d = decodePNG(fs.readFileSync(file));
    const k = scale === 'auto' ? detectScale(d) : scale;
    if (k > 1) d = downscale(d, k).img;
    const im = new Img(d.w, d.h);
    for (let i = 0; i < d.w * d.h; i++) {
      if (d.data[i * 4 + 3] < 128) continue;
      const [r, g, b] = [d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]];
      im.px[i] = snap ? PAL[nearest(r, g, b, kL).i] : hexOf(r, g, b);
    }
    return im;
  }
  clone() { const o = new Img(this.w, this.h); o.px = this.px.slice(); return o; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; return this; }
  rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c); return this; }
  hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); return this; }
  vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); return this; }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }
  /** copy another image's opaque pixels at (dx, dy) */
  blit(src, dx = 0, dy = 0, flipX = false) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(flipX ? src.w - 1 - x : x, y);
      if (c) this.set(dx + x, dy + y, c);
    }
    return this;
  }
  crop(x, y, w, h) { const o = new Img(w, h); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) o.px[yy * w + xx] = this.get(x + xx, y + yy); return o; }
  /** recolor by map (whole image or inside rect [x, y, w, h]) */
  recolor(map, r = [0, 0, this.w, this.h]) {
    const m = new Map(Object.entries(map).map(([a, b]) => [a.toLowerCase(), b && b.toLowerCase()]));
    for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) {
      const c = this.get(x, y);
      if (c && m.has(c)) this.set(x, y, m.get(c));
    }
    return this;
  }
  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** trim to the opaque bbox */
  trim() { const b = this.bbox(); return b ? this.crop(b.x0, b.y0, b.w, b.h) : new Img(1, 1); }
  /** add a 1 px outline of color c around the silhouette (4-neighbour) */
  outline(c = INK) {
    const src = this.px.slice();
    const on = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) this.set(x, y, c);
    return this;
  }
  /** colors used, with counts */
  colors() { const m = new Map(); for (const c of this.px) if (c) m.set(c, (m.get(c) ?? 0) + 1); return m; }
  offPalette() { return [...this.colors().keys()].filter((c) => !PAL.includes(c)); }
  toRGBA() {
    const d = new Uint8Array(this.w * this.h * 4);
    this.px.forEach((c, i) => { if (c) { d.set(rgb(c), i * 4); d[i * 4 + 3] = 255; } });
    return { w: this.w, h: this.h, data: d };
  }
  save(file, k = 1) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const img = k > 1 ? upscale(this.toRGBA(), k) : this.toRGBA();
    fs.writeFileSync(file, encodePNG(img.w, img.h, img.data));
    return this;
  }
}

/** snap one color to the palette (the importer's metric) */
export function snapHex(c, kL = 2) {
  const [r, g, b] = rgb(c);
  return PAL[nearest(r, g, b, kL).i];
}

/** a grid of images on a checkerboard, each at scale k, with a 3x5 index digit in the corner */
export function sheet(items, file, { k = 4, cols = 8, gap = 2, bg = null } = {}) {
  const cw = Math.max(...items.map((i) => i.w)) + gap * 2, ch = Math.max(...items.map((i) => i.h)) + gap * 2 + 6;
  const rows = Math.ceil(items.length / cols);
  const out = new Img(cols * cw, rows * ch);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
    out.set(x, y, bg ?? ((((x >> 2) + (y >> 2)) & 1) ? '#3e3546' : (cx + cy) & 1 ? '#45293f' : '#4c3e24'));
  }
  items.forEach((im, i) => {
    const ox = (i % cols) * cw + gap, oy = Math.floor(i / cols) * ch + gap;
    digits(out, String(i), ox, oy, '#fbb954');
    out.blit(im, ox, oy + 6);
  });
  out.save(file, k);
  return out;
}

const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
};
export function digits(im, s, x, y, c) {
  [...s].forEach((ch, k) => {
    const g = FONT[ch];
    if (!g) return;
    for (let i = 0; i < 15; i++) if (g[i] === '1') im.set(x + k * 4 + (i % 3), y + Math.floor(i / 3), c);
  });
}
