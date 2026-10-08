// Fast pixel buffer for generating art with direct ImageData writes.
import { PALETTE_RGB } from '../../data/palette';
import { makeCanvas } from './pixel';
import { hash2 } from '../../engine/rng';

export class PixBuf {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: number, a = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c < 0) return;
    const i = (y * this.w + x) * 4;
    const rgb = PALETTE_RGB[c];
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data[(y * this.w + x) * 4 + 3] > 0;
  }
  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  /** fill with base color and per-pixel speckle variation */
  noise(x: number, y: number, w: number, h: number, base: number, alt: number, p: number, seed: number) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, hash2(xx, yy, seed) < p ? alt : base);
  }
  disc(cx: number, cy: number, r: number, c: number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** add a 1px outline in color c around opaque pixels */
  outline(c = 0) {
    const mask = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.w * this.h; i++) mask[i] = this.data[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (mask[i]) continue;
        if ((x > 0 && mask[i - 1]) || (x < this.w - 1 && mask[i + 1]) || (y > 0 && mask[i - this.w]) || (y < this.h - 1 && mask[i + this.w])) this.set(x, y, c);
      }
  }
  /** shade: darken pixels on the bottom/right of the shape with a palette remap */
  toCanvas(): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h);
    c.getContext('2d')!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return c;
  }
  drawTo(ctx: CanvasRenderingContext2D, x = 0, y = 0) {
    ctx.putImageData(new ImageData(this.data, this.w, this.h), x, y);
  }
}
