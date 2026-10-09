// Imported UI skin: nine-slice frames for panels, buttons and slots (sprites `ui:*` from a sheet in
// src/art/). Each source frame is three borders wide and high: the border is a third of its
// smaller side (24x24 → 8 px corners). Corners are drawn 1:1, edges and the center are tiled in
// whole copies, never stretched, so the pixels stay on the grid. Without a frame the UI kit draws
// its procedural style.
import { hasImage, sprite } from '../render/atlas';
import { makeCanvas, ctx2d } from '../render/art/pixel';

const cache = new Map<string, HTMLCanvasElement>();
const MAX = 96;

/** Is there an imported frame for this skin name? */
export function hasSkin(name: string): boolean {
  return hasImage(name);
}

/** Forget composed frames (after the art changes). */
export function resetSkin() {
  cache.clear();
}

function compose(name: string, w: number, h: number): HTMLCanvasElement {
  const s = sprite(name);
  const b = Math.floor(Math.min(s.w, s.h) / 3);
  const mw = s.w - 2 * b, mh = s.h - 2 * b;
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  // tile source region (sx, sy, sw, sh) over destination (dx, dy, dw, dh)
  const tile = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
    if (dw <= 0 || dh <= 0) return;
    for (let y = 0; y < dh; y += sh)
      for (let x = 0; x < dw; x += sw) {
        const cw = Math.min(sw, dw - x), chh = Math.min(sh, dh - y);
        ctx.drawImage(s.img, s.x + sx, s.y + sy, cw, chh, dx + x, dy + y, cw, chh);
      }
  };
  const bw = Math.min(b, Math.floor(w / 2)), bh = Math.min(b, Math.floor(h / 2));
  tile(b, b, mw, mh, bw, bh, w - 2 * bw, h - 2 * bh); // center
  tile(b, 0, mw, b, bw, 0, w - 2 * bw, bh); // top
  tile(b, s.h - b, mw, b, bw, h - bh, w - 2 * bw, bh); // bottom
  tile(0, b, b, mh, 0, bh, bw, h - 2 * bh); // left
  tile(s.w - b, b, b, mh, w - bw, bh, bw, h - 2 * bh); // right
  ctx.drawImage(s.img, s.x, s.y, bw, bh, 0, 0, bw, bh);
  ctx.drawImage(s.img, s.x + s.w - bw, s.y, bw, bh, w - bw, 0, bw, bh);
  ctx.drawImage(s.img, s.x, s.y + s.h - bh, bw, bh, 0, h - bh, bw, bh);
  ctx.drawImage(s.img, s.x + s.w - bw, s.y + s.h - bh, bw, bh, w - bw, h - bh, bw, bh);
  return c;
}

/** Draw a nine-slice skin frame over x, y, w, h; false when the skin has no such frame. */
export function drawSkin(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number): boolean {
  if (w < 2 || h < 2 || !hasImage(name)) return false;
  w = Math.round(w);
  h = Math.round(h);
  const key = `${name}|${w}x${h}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
    c = compose(name, w, h);
    cache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x), Math.round(y));
  return true;
}
