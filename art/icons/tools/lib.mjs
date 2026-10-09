// Icon processing shared by the icon tools: load a raw 16 px PixelLab candidate, snap it to the
// palette, close the #2e222f outline, center it in a 16x16 frame.
import fs from 'node:fs';
import { decodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, rgbOf, hex, lab, quantize, bbox, crop, blank, blit } from '../../../scripts/lib/pixel.mjs';

export const INK = '#2e222f';
const INK_RGB = rgbOf(INK);
const L_OF = new Map(PAL.map((h) => [h, lab(rgbOf(h))[0]]));
export const lum = (h) => L_OF.get(h) ?? 50;

export function load(file, kL = 2) {
  const raw = decodePNG(fs.readFileSync(file));
  const img = { w: raw.w, h: raw.h, data: new Uint8Array(raw.data) };
  const q = quantize(img, kL);
  return { img, q };
}
export const px = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const p = (y * img.w + x) * 4;
  return img.data[p + 3] ? hex(img.data[p], img.data[p + 1], img.data[p + 2]) : null;
};
export const put = (img, x, y, h) => {
  const p = (y * img.w + x) * 4;
  if (h === null) img.data.fill(0, p, p + 4);
  else img.data.set([...rgbOf(h), 255], p);
};
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Close the outline: a silhouette-edge pixel becomes #2e222f when it is darker than an interior
 * neighbor (the generator drew an outline there in a dark shade of the material) or dark in itself.
 * Thin parts (no interior neighbor) keep their color, so handles and stems stay readable.
 * `darkL`: lightness under which an edge pixel always becomes ink.
 */
export function closeOutline(img, { darkL = 32, outer = false } = {}) {
  const edge = [], set = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const c = px(img, x, y);
    if (!c || c === INK) continue;
    if (!N4.some(([dx, dy]) => !px(img, x + dx, y + dy))) continue;
    edge.push([x, y, c]);
  }
  const isEdge = new Set(edge.map(([x, y]) => x + ',' + y));
  for (const [x, y, c] of edge) {
    let darker = lum(c) < darkL;
    for (const [dx, dy] of N4) {
      const n = px(img, x + dx, y + dy);
      if (!n || n === INK || isEdge.has(x + dx + ',' + (y + dy))) continue;
      if (lum(n) - lum(c) > 6) darker = true;
    }
    if (darker) set.push([x, y]);
  }
  for (const [x, y] of set) put(img, x, y, INK);
  // optional: ink around light edge pixels that are still bare (only where the frame has room)
  if (outer) {
    const add = [];
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      if (px(img, x, y)) continue;
      if (N4.some(([dx, dy]) => { const n = px(img, x + dx, y + dy); return n && n !== INK; })) add.push([x, y]);
    }
    for (const [x, y] of add) put(img, x, y, INK);
  }
  return set.length;
}

/** share of silhouette-edge pixels that are ink */
export function inkShare(img) {
  let e = 0, k = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const c = px(img, x, y);
    if (!c) continue;
    if (N4.some(([dx, dy]) => !px(img, x + dx, y + dy))) { e++; if (c === INK) k++; }
  }
  return e ? k / e : 1;
}

/** crop to the art and center it in a w x h frame (floor), returns { img, w, h, fits } */
export function center(img, W = 16, H = 16, nudge = [0, 0]) {
  const b = bbox(img);
  if (!b) return { img: blank(W, H), w: 0, h: 0, fits: true };
  const cut = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  const out = blank(W, H);
  const clipped = blit(out, cut, Math.floor((W - cut.w) / 2) + nudge[0], Math.floor((H - cut.h) / 2) + nudge[1]);
  return { img: out, w: cut.w, h: cut.h, fits: !clipped };
}

export function copy(img) { return { w: img.w, h: img.h, data: new Uint8Array(img.data) }; }

/**
 * Trim thin tips until the art fits `max` px: repeatedly drop the outermost row/column on an
 * oversize axis when it holds at most `thin` opaque pixels (a stem end, a spout, a fin tip), then
 * close the outline again. Bulky art that overflows is left alone (returns false).
 */
export function trimTips(img, max = 14, thin = 2) {
  let changed = false;
  for (let guard = 0; guard < 6; guard++) {
    const b = bbox(img);
    if (!b) return true;
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    if (w <= max && h <= max) break;
    const lines = [];
    const count = (xs, ys) => { let n = 0; for (const y of ys) for (const x of xs) if (px(img, x, y)) n++; return n; };
    const span = (a, z) => Array.from({ length: z - a + 1 }, (_, i) => a + i);
    if (h > max) {
      lines.push({ n: count(span(b.x0, b.x1), [b.y0]), kill: () => span(b.x0, b.x1).forEach((x) => put(img, x, b.y0, null)), y: b.y0, dir: 1, axis: 'y' });
      lines.push({ n: count(span(b.x0, b.x1), [b.y1]), kill: () => span(b.x0, b.x1).forEach((x) => put(img, x, b.y1, null)), y: b.y1, dir: -1, axis: 'y' });
    }
    if (w > max) {
      lines.push({ n: count([b.x0], span(b.y0, b.y1)), kill: () => span(b.y0, b.y1).forEach((y) => put(img, b.x0, y, null)), x: b.x0, dir: 1, axis: 'x' });
      lines.push({ n: count([b.x1], span(b.y0, b.y1)), kill: () => span(b.y0, b.y1).forEach((y) => put(img, b.x1, y, null)), x: b.x1, dir: -1, axis: 'x' });
    }
    lines.sort((a, c) => a.n - c.n);
    const best = lines[0];
    if (!best || best.n > thin) return false;
    // the pixels just inside the cut line become the new tip: ink them where the cut line had ink
    const inner = [];
    if (best.axis === 'y') for (let x = b.x0; x <= b.x1; x++) { if (px(img, x, best.y) && px(img, x, best.y + best.dir)) inner.push([x, best.y + best.dir]); }
    else for (let y = b.y0; y <= b.y1; y++) { if (px(img, best.x, y) && px(img, best.x + best.dir, y)) inner.push([best.x + best.dir, y]); }
    best.kill();
    for (const [x, y] of inner) put(img, x, y, INK);
    changed = true;
  }
  const b = bbox(img);
  return !b || (b.x1 - b.x0 < max && b.y1 - b.y0 < max) ? true : (changed ? false : false);
}

/** Every silhouette-edge pixel becomes #2e222f (art whose generator drew a light rim instead of an outline). */
export function inkEdge(img) {
  const set = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (px(img, x, y) && N4.some(([dx, dy]) => !px(img, x + dx, y + dy))) set.push([x, y]);
  }
  for (const [x, y] of set) put(img, x, y, INK);
  return set.length;
}
