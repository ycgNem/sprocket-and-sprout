// Low-level pixel-art drawing helpers. All colors are palette indices.
import { PALETTE } from '../../data/palette';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function px(ctx: Ctx, x: number, y: number, c: number) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: number) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function hline(ctx: Ctx, x0: number, x1: number, y: number, c: number) {
  rect(ctx, Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
}
export function vline(ctx: Ctx, x: number, y0: number, y1: number, c: number) {
  rect(ctx, x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
}

/** Outlined rect: border color + fill. */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: number, border: number) {
  rect(ctx, x, y, w, h, border);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

/** Filled pixel circle (integer midpoint-ish). */
export function disc(ctx: Ctx, cx: number, cy: number, r: number, c: number) {
  ctx.fillStyle = PALETTE[c];
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
    ctx.fillRect((cx - w) | 0, (cy + y) | 0, w * 2 + 1, 1);
  }
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: number) {
  ctx.fillStyle = PALETTE[c];
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry + 0.5);
    const w = Math.round(rx * Math.sqrt(Math.max(0, t)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: number) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = PALETTE[c];
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * Draw a template: rows of characters, each char maps to a palette index via `map`.
 * '.' or ' ' are transparent.
 */
export function tpl(ctx: Ctx, rows: readonly string[], x: number, y: number, map: Record<string, number>, flipX = false) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = map[ch];
      if (c === undefined) continue;
      ctx.fillStyle = PALETTE[c];
      ctx.fillRect(x + (flipX ? row.length - 1 - i : i), y + r, 1, 1);
    }
  }
}

/**
 * Add a 1px dark outline around all opaque pixels of a canvas region (in place).
 * Used to give sprites a consistent cozy outline.
 */
export function outline(c: HTMLCanvasElement, color = 0, x = 0, y = 0, w = c.width, h = c.height) {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const hex = PALETTE[color];
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx;
      if (mask[i]) continue;
      const n =
        (xx > 0 && mask[i - 1]) || (xx < w - 1 && mask[i + 1]) || (yy > 0 && mask[i - w]) || (yy < h - 1 && mask[i + w]);
      if (n) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, x, y);
}

/** Simple dithered fill between two palette colors using a 2x2 Bayer pattern. */
export function dither(ctx: Ctx, x: number, y: number, w: number, h: number, a: number, b: number, t: number) {
  const bayer = [0, 2, 3, 1];
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const th = (bayer[(yy & 1) * 2 + (xx & 1)] + 0.5) / 4;
      px(ctx, x + xx, y + yy, t > th ? b : a);
    }
}
