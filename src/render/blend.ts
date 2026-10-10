// Synthesized ground transitions (1.2 playtest: "ground tiles don't connect ... prevalent when
// farming"). The dual grid draws one tile per vertex from the classes of the four map tiles that
// meet there. Pairs with a Wang set in the terrain art use it; any other meeting (flagstone and
// water, tilled soil and a path, three terrains at a bridge end) used to drop one class and leave a
// square notch. Here such a vertex is painted instead: every class over the ones below it (the
// CLASS_PRIO order) through a smooth, slightly wobbly mask, with a dark rim on the lower side and
// a line of foam where the lower side is water. The wobble comes from world coordinates and fades
// out at the tile's edges, so neighbouring tiles (painted or art) meet cleanly.
import { hash2 } from '../engine/rng';
import { CLASS_PRIO } from './art/match';
import type { TerrainArt } from './art/sheets';
import { makeCanvas, ctx2d } from './art/pixel';
import { sprite } from './atlas';

const T = 16;
const prio = (k: string) => CLASS_PRIO[k] ?? 3;
const WATERY = new Set(['water', 'deep']);

/** pixels of a base tile (after its season recolor), cached by sprite name */
const pixCache = new Map<string, Uint8ClampedArray | null>();
function basePixels(name: string): Uint8ClampedArray | null {
  if (pixCache.has(name)) return pixCache.get(name)!;
  const s = sprite(name);
  let out: Uint8ClampedArray | null = null;
  if (s && s.w >= T && s.h >= T) {
    const c = makeCanvas(T, T);
    const cx = ctx2d(c);
    cx.drawImage(s.img, s.x, s.y, T, T, 0, 0, T, T);
    out = cx.getImageData(0, 0, T, T).data;
  }
  pixCache.set(name, out);
  return out;
}

/** forget cached pixels (the art mode or a sheet changed) */
export function resetBlend() {
  pixCache.clear();
}

/** smooth value noise in [-1, 1] on a 5 px lattice of world pixels */
function noise(wx: number, wy: number): number {
  const L = 5;
  const gx = Math.floor(wx / L), gy = Math.floor(wy / L);
  const fx = wx / L - gx, fy = wy / L - gy;
  const n = (x: number, y: number) => hash2(x, y, 53) * 2 - 1;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = n(gx, gy) + (n(gx + 1, gy) - n(gx, gy)) * sx;
  const b = n(gx, gy + 1) + (n(gx + 1, gy + 1) - n(gx, gy + 1)) * sx;
  return a + (b - a) * sy;
}

/**
 * Pairs painted even though the art has a set: the tilled-soil sets' tiles don't meet (the seam
 * audit's worst offenders, e2e/out/seams.md), which is what made farmed ground look broken.
 */
export const BLEND_OVER_ART = new Set(['grass|soil', 'grass|wet', 'dirt|soil', 'dirt|wet']);
const pairKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);

/** Does this vertex need painting (no art set covers its classes, or the set is one we override)? */
export function needsBlend(hasSet: (a: string, b: string) => boolean, corners: string[]): boolean {
  const kinds = [...new Set(corners)];
  if (kinds.length < 2) return false;
  if (kinds.length === 2) return !hasSet(kinds[0], kinds[1]) || (useOverride && BLEND_OVER_ART.has(pairKey(kinds[0], kinds[1])));
  return true;
}

/** the override switch (the debug panel and the comparison shots flip it) */
let useOverride = true;
export function setBlendOverride(on: boolean) {
  useOverride = on;
}

/**
 * Paint the vertex tile for corners [nw, ne, sw, se] at (vx, vy) (map tile coords of the vertex)
 * into ctx at (px, py). False when a class has no base art (the caller falls back).
 */
export function blendVertex(art: TerrainArt, corners: string[], vx: number, vy: number, season: number, ctx: CanvasRenderingContext2D, px: number, py: number): boolean {
  const classes = [...new Set(corners)].sort((a, b) => prio(a) - prio(b));
  const h = hash2(vx, vy, 7);
  const pix: Uint8ClampedArray[] = [];
  for (const c of classes) {
    const name = art.vertex(c, c, c, c, h, season);
    const p = name ? basePixels(name) : null;
    if (!p) return false;
    pix.push(p);
  }
  // which class owns each pixel: each class above the lowest claims the corners at or above its rank
  const owner = new Uint8Array(T * T);
  const ox = vx * T - 8, oy = vy * T - 8;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      // quadrant centres sit at 4 and 12; outside them a pixel is its quadrant's
      const u = Math.max(0, Math.min(1, (x + 0.5 - 4) / 8)), v = Math.max(0, Math.min(1, (y + 0.5 - 4) / 8));
      const edge = Math.min(1, Math.min(x, T - 1 - x, y, T - 1 - y) / 4);
      const wob = noise(ox + x, oy + y) * 0.28 * edge;
      let o = 0;
      for (let c = 1; c < classes.length; c++) {
        const r = prio(classes[c]);
        const w = corners.map((k) => (prio(k) >= r ? 1 : 0));
        const f = w[0] * (1 - u) * (1 - v) + w[1] * u * (1 - v) + w[2] * (1 - u) * v + w[3] * u * v;
        if (f + wob > 0.5) o = c;
      }
      owner[y * T + x] = o;
    }
  const img = ctx.createImageData(T, T);
  const d = img.data;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const i = y * T + x, o = owner[i], src = pix[o];
      let r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
      // the lower side of a boundary gets a rim: dark on land, foam on water
      let above = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= T || yy >= T) continue;
        if (owner[yy * T + xx] > o) above = true;
      }
      if (above) {
        if (WATERY.has(classes[o])) {
          r = Math.round(r + (235 - r) * 0.55);
          g = Math.round(g + (245 - g) * 0.55);
          b = Math.round(b + (240 - b) * 0.55);
        } else {
          r = Math.round(r * 0.62);
          g = Math.round(g * 0.58);
          b = Math.round(b * 0.66);
        }
      }
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
  const c = makeCanvas(T, T);
  ctx2d(c).putImageData(img, 0, 0);
  ctx.drawImage(c, px, py);
  return true;
}
