// Small RGBA pixel helpers for the town art scripts (palette from src/data/palette.ts via
// scripts/lib/pixel.mjs; PNG coding from scripts/lib/png.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, rgbOf, nearest, detectScale, downscale, lab, de2000 } from '../../../scripts/lib/pixel.mjs';

export { PAL, hex, rgbOf, lab };

/** An RGBA image with string-color access ('#rrggbb', null = clear). */
export class Img {
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.data = data ?? new Uint8Array(w * h * 4);
  }
  static load(file, { unscale = true } = {}) {
    let im = decodePNG(fs.readFileSync(file));
    if (unscale) im = downscale(im, detectScale(im)).img;
    return new Img(im.w, im.h, new Uint8Array(im.data));
  }
  clone() {
    return new Img(this.w, this.h, new Uint8Array(this.data));
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    if (!this.in(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] < 128) return null;
    return hex(this.data[i], this.data[i + 1], this.data[i + 2]);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.in(x, y)) return;
    const i = (y * this.w + x) * 4;
    if (c === null) { this.data.fill(0, i, i + 4); return; }
    const [r, g, b] = rgbOf(c);
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
  }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  crop(x, y, w, h) {
    const o = new Img(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const c = this.get(x + xx, y + yy); if (c) o.set(xx, yy, c); }
    return o;
  }
  /** paste src with its (0,0) at (dx, dy); clear pixels of src are skipped */
  blit(src, dx, dy, { flipX = false } = {}) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(flipX ? src.w - 1 - x : x, y);
      if (c) this.set(dx + x, dy + y, c);
    }
    return this;
  }
  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  trim() {
    const b = this.bbox();
    return b ? this.crop(b.x0, b.y0, b.w, b.h) : new Img(1, 1);
  }
  /** snap every opaque pixel to the nearest palette color (CIEDE2000, lightness at half weight) */
  snap(kL = 2) {
    const memo = new Map();
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] < 128) { this.data.fill(0, i, i + 4); continue; }
      const k = (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
      let c = memo.get(k);
      if (!c) { c = PAL[nearest(this.data[i], this.data[i + 1], this.data[i + 2], kL).i]; memo.set(k, c); }
      const [r, g, b] = rgbOf(c);
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
    }
    return this;
  }
  /** snap every opaque pixel to the nearest of `colors` (palette hexes): grading onto chosen ramps */
  snapTo(colors, kL = 2, rect = null) {
    const labs = colors.map((c) => lab(rgbOf(c)));
    const memo = new Map();
    const [rx, ry, rw, rh] = rect ?? [0, 0, this.w, this.h];
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
      if (!this.in(x, y)) continue;
      const i = (y * this.w + x) * 4;
      if (this.data[i + 3] < 128) continue;
      const k = (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
      let c = memo.get(k);
      if (!c) {
        const L = lab([this.data[i], this.data[i + 1], this.data[i + 2]]);
        let best = 0, bd = Infinity;
        labs.forEach((p, j) => { const d = de2000(L, p, kL); if (d < bd) { bd = d; best = j; } });
        c = colors[best];
        memo.set(k, c);
      }
      const [r, g, b] = rgbOf(c);
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
    }
    return this;
  }
  /** grade by lightness: each pixel's CIE L picks a color from `ramp` (dark to light) by thresholds */
  gradeL(ramp, cuts, rect = null) {
    const [rx, ry, rw, rh] = rect ?? [0, 0, this.w, this.h];
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
      if (!this.in(x, y)) continue;
      const i = (y * this.w + x) * 4;
      if (this.data[i + 3] < 128) continue;
      const L = lab([this.data[i], this.data[i + 1], this.data[i + 2]])[0];
      let j = 0;
      while (j < cuts.length && L > cuts[j]) j++;
      const [r, g, b] = rgbOf(ramp[j]);
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b;
    }
    return this;
  }
  /** exact color swaps */
  recolor(map) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.get(x, y); if (c && map[c]) this.set(x, y, map[c]); }
    return this;
  }
  colors() {
    const m = new Map();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.get(x, y); if (c) m.set(c, (m.get(c) ?? 0) + 1); }
    return m;
  }
  offPalette() {
    let n = 0;
    for (const c of this.colors().keys()) if (!PAL.includes(c)) n++;
    return n;
  }
  save(file, k = 1) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    if (k === 1) { fs.writeFileSync(file, encodePNG(this.w, this.h, this.data)); return; }
    const o = new Img(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const i = ((y / k | 0) * this.w + (x / k | 0)) * 4, j = (y * o.w + x) * 4;
      o.data.set(this.data.subarray(i, i + 4), j);
    }
    fs.writeFileSync(file, encodePNG(o.w, o.h, o.data));
  }
  toBase64() {
    return Buffer.from(encodePNG(this.w, this.h, this.data)).toString('base64');
  }
}

/** a lineup of images on a checker (or a flat color), each at scale k, with gaps */
export function lineup(imgs, { k = 3, gap = 4, bg = null, cols = imgs.length } = {}) {
  const cw = Math.max(...imgs.map((i) => i.w)), ch = Math.max(...imgs.map((i) => i.h));
  const rows = Math.ceil(imgs.length / cols);
  const W = cols * (cw + gap) + gap, H = rows * (ch + gap) + gap;
  const o = new Img(W * k, H * k);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    const j = (y * o.w + x) * 4;
    if (bg) { const [r, g, b] = rgbOf(bg); o.data.set([r, g, b, 255], j); }
    else o.data.set(((x >> 3) + (y >> 3)) & 1 ? [70, 64, 78, 255] : [84, 76, 92, 255], j);
  }
  imgs.forEach((im, n) => {
    const cx = gap + (n % cols) * (cw + gap), cy = gap + Math.floor(n / cols) * (ch + gap) + (ch - im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const i = (y * im.w + x) * 4;
      if (im.data[i + 3] < 128) continue;
      for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) o.data.set(im.data.subarray(i, i + 4), (((cy + y) * k + yy) * o.w + (cx + x) * k + xx) * 4);
    }
  });
  return o;
}
