// Small pixel-drawing kit for the factory art scripts: palette-only images, outlines, PNG I/O.
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG, decodePNG, upscale } from '../../../scripts/lib/png.mjs';

export const INK = '#2e222f';
export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// material ramps (STYLE.md), dark -> light
export const WOOD = ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'];
export const BRASS = ['#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'];
export const COPPER = ['#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790'];
export const IRON = ['#3e3546', '#625565', '#7f708a', '#9babb2'];
export const STONE = ['#3e3546', '#625565', '#966c6c', '#ab947a', '#c7dcd0'];
export const MOSS = ['#165a4c', '#239063', '#1ebc73', '#91db69'];

export class Img {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  static load(file) {
    const d = decodePNG(fs.readFileSync(file));
    const im = new Img(d.w, d.h);
    for (let i = 0; i < d.w * d.h; i++) if (d.data[i * 4 + 3] >= 128) im.px[i] = hexOf(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]);
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
  /** filled ellipse through pixel centers */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c);
    return this;
  }
  /** paste another image's opaque pixels at (dx, dy) */
  draw(src, dx = 0, dy = 0) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(dx + x, dy + y, c); } return this; }
  /** 1 px outline around the silhouette (outside), optionally not along some edges of the image */
  outline(c = INK, { skipEdges = '' } = {}) {
    const o = this.clone();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => this.get(x + dx, y + dy))) o.px[y * this.w + x] = c;
      }
    this.px = o.px;
    return this;
  }
  recolor(map) { this.px = this.px.map((c) => (c && map[c] ? map[c] : c)); return this; }
  bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  crop(x, y, w, h) { const o = new Img(w, h); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) o.px[yy * w + xx] = this.get(x + xx, y + yy); return o; }
  rgba() {
    const d = new Uint8Array(this.w * this.h * 4);
    this.px.forEach((c, i) => { if (c) d.set([...rgb(c), 255], i * 4); });
    return d;
  }
  save(file, scale = 1) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let im = { w: this.w, h: this.h, data: this.rgba() };
    if (scale > 1) im = upscale(im, scale);
    fs.writeFileSync(file, encodePNG(im.w, im.h, im.data));
  }
}

/** Lay images in a grid (cell size = max), return { sheet, rects } with rects keyed by name */
export function packGrid(items, cols = 8, gap = 1) {
  const cw = Math.max(...items.map((i) => i.im.w)) + gap, ch = Math.max(...items.map((i) => i.im.h)) + gap;
  const sheet = new Img(cols * cw, Math.ceil(items.length / cols) * ch);
  const rects = {};
  items.forEach((it, k) => {
    const x = (k % cols) * cw, y = Math.floor(k / cols) * ch;
    sheet.draw(it.im, x, y);
    rects[it.name] = [x, y, it.im.w, it.im.h];
  });
  return { sheet, rects };
}

/** Preview: images on a grass-and-soil backdrop at scale k, labeled by index order */
export function preview(items, file, k = 4, cols = 8) {
  const cw = Math.max(...items.map((i) => i.im.w)) + 4, ch = Math.max(...items.map((i) => i.im.h)) + 4;
  const sheet = new Img(cols * cw, Math.ceil(items.length / cols) * ch);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) {
    const cx = Math.floor(x / cw);
    sheet.set(x, y, cx % 2 ? '#239063' : '#9e4539');
  }
  items.forEach((it, i) => {
    const x = (i % cols) * cw + 2, y = Math.floor(i / cols) * ch + 2;
    sheet.draw(it.im, x + Math.floor((cw - 4 - it.im.w) / 2), y + (ch - 4 - it.im.h));
  });
  sheet.save(file, k);
}
