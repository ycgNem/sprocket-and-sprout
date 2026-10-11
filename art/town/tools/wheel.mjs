// The Town Mill's waterwheel, drawn by rule: town:wheel:<on>:<frame 0-3>, 72 x 72, hub at the
// pixel corner (36, 36), the river's surface at hub + 13 (below it only foam and wake are drawn,
// so the river's own water shows; src/render/townworks.ts draws the spray).
//
// Design from PixelLab map object b4e4f664 (art/town/raw/wheel/w2.png): a thick rim of bolted
// felloe segments, a brass dome hub, ivy on the idle wheel. Generated pixels can't turn: a 4-frame
// loop reads as turning only if every repeating part shares one period and each frame moves a
// quarter of it, and rotating pixels breaks the outline. So the wheel is 8-fold (8 spokes, 8
// felloes with a brass strap at each joint, 8 floats between the spokes), 45 degrees per loop,
// 11.25 degrees per frame, clockwise (the west side rises out of the water, where the renderer
// throws spray). Light from the upper left is fixed per pixel, so highlights stay put while the
// wood turns under them.
import { Img } from './px.mjs';

const INK = '#2e222f';
const WOOD = { s: '#45293f', d: '#7a3045', m: '#9e4539', b: '#cd683d', l: '#e6904e' };
const BRASS = { d: '#9e4539', m: '#cd683d', b: '#f79617', l: '#f9c22b', h: '#fbff86' };
const STONE = { s: '#3e3546', d: '#625565', m: '#966c6c', b: '#ab947a', l: '#c7dcd0' };
const WATER = { dd: '#323353', d: '#484a77', m: '#4d65b4', b: '#4d9be6', l: '#8fd3ff', w: '#ffffff' };
const LEAF = { d: '#165a4c', m: '#239063', b: '#1ebc73', l: '#91db69' };
const MOSS = { d: '#676633', m: '#a2a947' };

export const S = 72, C = 36, WL = C + 13;
const N = 8, PERIOD = (2 * Math.PI) / N, STEP = PERIOD / 4;
const R_HUB = 5.6, R_FLANGE = 7.2, R_IN = 20.5, R_OUT = 27, R_FLOAT = 34;
/** unit vector toward the light (upper left) */
const LX = -Math.SQRT1_2, LY = -Math.SQRT1_2;

/** a stable per-cell hash in [0, 1) */
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** distances rounded to 1e-6, so a pixel on a band's edge is classed the same in every frame */
const q6 = (v) => Math.round(v * 1e6) / 1e6;
const wrap = (a) => { a %= 2 * Math.PI; if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; };

/**
 * Classify one pixel of the wheel at rotation `rot` (radians, clockwise): returns a color or null.
 * Order: hub, flange, rim (with joint straps), floats, spokes (behind the rim and hub).
 */
function wheelPixel(x, y, rot, missing) {
  const dx = x + 0.5 - C, dy = y + 0.5 - C;
  const r = Math.hypot(dx, dy);
  const ux = dx / (r || 1), uy = dy / (r || 1);
  const phi = Math.atan2(dy, dx);
  const lit = ux * LX + uy * LY; // > 0: this side of a round part faces the light
  // ---- hub: a brass dome, lit from the upper left, a dark socket ring round it ----
  if (r < R_HUB) {
    const hx = dx + 1.6, hy = dy + 1.6, hr = Math.hypot(hx, hy);
    if (hr < 1.3) return BRASS.h;
    if (hr < 2.7) return BRASS.l;
    if (r > R_HUB - 1.1) return lit > 0.2 ? BRASS.b : BRASS.d;
    return lit < -0.35 ? BRASS.m : BRASS.b;
  }
  if (r < R_FLANGE) return lit > 0.3 ? WOOD.m : WOOD.s;
  // ---- floats: radial boards between the spokes, bolted over the rim and standing out past it ----
  const psi = wrap(phi - rot);
  if (r >= R_IN + 1 && r < R_FLOAT) {
    const k = Math.round((psi - PERIOD / 2) / PERIOD);
    const d = wrap(psi - (k * PERIOD + PERIOD / 2));
    const j = ((k % N) + N) % N;
    const s = q6(r * Math.sin(d)); // signed distance across the board
    const half = 2.3;
    if (!missing.includes(j) && Math.abs(s) <= half) {
      // which edge of the board faces the light: its tangent at this angle
      const a = rot + k * PERIOD + PERIOD / 2;
      const tl = -Math.sin(a) * LX + Math.cos(a) * LY + 1e-3; // tangent (toward +psi) . light (biased: a part pointing straight at the light lights the same edge every frame)
      const edge = s > half - 1.05 ? (tl > 0 ? 1 : -1) : s < -half + 1.05 ? (tl > 0 ? -1 : 1) : 0;
      if (r > R_FLOAT - 1.2) return WOOD.s; // the board's end grain
      if (r > 29.4 && r < 30.6) return edge > 0 ? BRASS.l : BRASS.b; // a brass strap across it
      return edge > 0 ? WOOD.b : edge < 0 ? WOOD.d : WOOD.m;
    }
  }
  // ---- the rim: felloe planks, bevelled (outer edge lit top-left, inner edge lit bottom-right) ----
  const seg = ((psi % PERIOD) + PERIOD) % PERIOD; // 0 at a joint (where a spoke meets the rim)
  const toJoint = q6(Math.min(seg, PERIOD - seg) * r); // arc distance to the nearest joint
  if (r >= R_IN && r < R_OUT) {
    if (toJoint < 1.15) {
      // the brass strap over the joint, and its bolt
      if (Math.abs(r - 23.7) < 0.8) return BRASS.d;
      return lit > 0.25 ? BRASS.l : lit < -0.4 ? BRASS.m : BRASS.b;
    }
    if (toJoint < 1.9) return WOOD.s; // the seam beside the strap
    if (r > R_OUT - 1.1) return lit > 0.3 ? WOOD.l : lit < -0.5 ? WOOD.s : WOOD.b;
    if (r < R_IN + 1.1) return lit < -0.3 ? WOOD.b : WOOD.s;
    // the plank's grain, a groove along its middle
    if (Math.abs(r - 23.9) < 0.5 && toJoint > 3.5) return WOOD.d;
    return lit > 0.6 ? WOOD.b : lit < -0.6 ? WOOD.d : WOOD.m;
  }
  // ---- spokes, from the flange to the rim ----
  if (r >= R_FLANGE && r < R_IN) {
    const k = Math.round(psi / PERIOD);
    const d = wrap(psi - k * PERIOD);
    const s = q6(r * Math.sin(d));
    const half = 1.55;
    if (Math.abs(s) <= half) {
      const a = rot + k * PERIOD;
      const tl = -Math.sin(a) * LX + Math.cos(a) * LY + 1e-3;
      const side = s > 0.5 ? 1 : s < -0.5 ? -1 : 0;
      if (side === 0) return WOOD.m;
      return side * tl > 0 ? WOOD.b : WOOD.s;
    }
  }
  return null;
}

/** ivy strands hanging from a point, leaves alternating side to side (deterministic by seed) */
function ivy(im, x0, y0, len, seed, maxY) {
  let x = x0;
  for (let i = 0; i < len; i++) {
    const y = y0 + i;
    if (y >= maxY) break;
    im.set(x, y, i % 3 === 0 ? LEAF.d : LEAF.m);
    if (i % 2 === 0) {
      const side = hash(i, seed, 3) < 0.5 ? -1 : 1;
      im.set(x + side, y, hash(i, seed, 4) < 0.5 ? LEAF.b : LEAF.m);
      if (hash(i, seed, 5) < 0.35) im.set(x + side, y - 1, LEAF.l);
    }
    if (hash(i, seed, 6) < 0.2) x += hash(i, seed, 7) < 0.5 ? -1 : 1;
  }
}

/** selective outline round every opaque region: plum below and right, the deep shade above and left */
function outline(im, lit = WOOD.s) {
  const src = im.clone();
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      if (src.get(x, y)) continue;
      const L = src.get(x - 1, y), U = src.get(x, y - 1), R = src.get(x + 1, y), D = src.get(x, y + 1);
      if (L || U) im.set(x, y, INK);
      else if (R || D) im.set(x, y, lit);
    }
}

/** the stone pier east of the rim with the axle's bearing; ivy on it, more on the idle mill */
function pier(im, on) {
  const x0 = 61, x1 = 72, top = C - 6;
  for (let y = top; y <= WL + 1; y++)
    for (let x = x0; x < x1; x++) {
      const row = Math.floor((y - top) / 4), bx = (x - x0 + (row % 2 ? 2 : 0)) % 5;
      let c = hash(Math.floor((x - x0 + (row % 2 ? 2 : 0)) / 5), row, 13) < 0.5 ? STONE.b : STONE.m;
      if ((y - top) % 4 === 3 || bx === 4) c = STONE.d;
      else if ((y - top) % 4 === 0 && c === STONE.b) c = STONE.l;
      if (x === x0) c = STONE.d;
      im.set(x, y, c);
    }
  // the cap stone and the bearing block with its brass bolts
  im.rect(x0 - 1, top - 2, x1 - x0 + 1, 2, STONE.b);
  im.rect(x0 - 1, top - 2, x1 - x0 + 1, 1, STONE.l);
  im.rect(x0 + 2, top - 5, 7, 3, WOOD.d);
  im.rect(x0 + 2, top - 5, 7, 1, WOOD.b);
  im.set(x0 + 3, top - 4, BRASS.l); im.set(x0 + 7, top - 4, BRASS.l);
  // ivy over the pier's cap and down its face
  const strands = on ? [[x0 + 1, 3], [x0 + 9, 5]] : [[x0, 9], [x0 + 3, 6], [x0 + 6, 11], [x0 + 9, 8]];
  for (const [sx, n] of strands) ivy(im, sx, top - 2, n, sx * 7 + (on ? 1 : 2), WL);
  for (let x = x0 - 1; x < x1; x++) if (hash(x, 1, on ? 21 : 22) < (on ? 0.25 : 0.6)) im.set(x, top - 2, hash(x, 2, 9) < 0.5 ? LEAF.m : LEAF.b);
}

/** town:wheel:<on>:<frame> */
export function drawWheel(on, f) {
  const im = new Img(S, S);
  const rot = on ? f * STEP : 0.19;
  const missing = on ? [] : [5];
  // the axle, behind the wheel, from the hub to the pier
  const back = new Img(S, S);
  pier(back, on);
  back.rect(C + 2, C - 2, S - C - 4, 4, WOOD.d);
  back.rect(C + 2, C - 2, S - C - 4, 1, WOOD.b);
  back.rect(C + 2, C + 1, S - C - 4, 1, WOOD.s);
  // the wheel itself
  const wheel = new Img(S, S);
  for (let y = 0; y < WL; y++) for (let x = 0; x < S; x++) {
    const c = wheelPixel(x, y, rot, missing);
    if (c) wheel.set(x, y, c);
  }
  // the idle wheel: one float lost, moss over its lower half, ivy hanging from the rim
  if (!on) {
    for (let y = C - 2; y < WL; y++) for (let x = 0; x < S; x++) {
      const c = wheel.get(x, y);
      if (!c || c === BRASS.h || c === BRASS.l) continue;
      // clumps: a coarse 3 px cell decides, a fine hash ragged-edges it
      const v = hash(Math.floor(x / 3), Math.floor(y / 3), 5), e = hash(x, y, 8);
      if (v < 0.16 + (y - C) * 0.02 && e < 0.8) wheel.set(x, y, e < 0.3 ? MOSS.m : e < 0.6 ? MOSS.d : LEAF.d);
    }
    for (const [a, n] of [[2.35, 7], [2.9, 9], [0.55, 6], [0.15, 10], [1.2, 4], [3.6, 5]]) {
      const x = Math.round(C + Math.cos(a + 0.2) * (R_OUT - 1)), y = Math.round(C + Math.sin(a + 0.2) * (R_OUT - 1));
      if (y < WL) ivy(wheel, x, y, n, Math.round(a * 100), WL);
    }
  }
  outline(wheel);
  im.blit(back, 0, 0);
  // the axle shows only through the gaps: the wheel goes on top
  im.blit(wheel, 0, 0);
  // nothing above the river's surface is cut; below it only water effects
  for (let y = WL; y < S; y++) for (let x = 0; x < S; x++) if (x < 61 || y > WL + 1) im.set(x, y, null);
  // ---- the waterline ----
  for (let x = C - 32; x < S; x++) {
    if (on) {
      // every water pattern repeats on the 4-frame loop: shifts of 2 px per frame, periods of 8
      if (x > C + 25) { if ((x + f * 2) % 8 < 3) im.set(x, WL, WATER.l); continue; }
      const k = (x + f * 2) % 8;
      im.set(x, WL, k === 0 ? WATER.b : WATER.w);
      if (k < 4) im.set(x, WL + 1, WATER.l);
      if (k === 2 && x % 2) im.set(x, WL - 1, WATER.w);
    } else if (x >= C - 28 && x <= C + 26) {
      im.set(x, WL, WATER.d);
      if (hash(x, 3, 3) < 0.35) im.set(x, WL + 1, hash(x, 4, 3) < 0.5 ? MOSS.d : LEAF.d);
    }
  }
  if (on) {
    // churn where the floats dip in (east) and rise out (west), and the wake running downstream
    for (const [cx, w] of [[C - 24, 7], [C + 21, 6]])
      for (let i = 0; i < w; i++) {
        const x = cx + i, h = (i + f * 2) % 8;
        if (h < 2) im.set(x, WL - 1, WATER.w);
        if (h === 3) im.set(x, WL - 2, WATER.l);
      }
    for (let y = WL + 2; y < S - 1; y++) for (let x = C - 24; x <= C + 26; x++) {
      const t = (y - WL) / (S - WL);
      const h = hash(x, (((Math.floor((y - f * 2) / 2) % 4) + 4) % 4) + 4 * Math.floor(y / 16), 21);
      if (h < 0.075 * (1 - t)) im.set(x, y, h < 0.022 ? WATER.w : WATER.l);
    }
  }
  return im;
}

if (process.argv[1] && process.argv[1].endsWith('wheel.mjs')) {
  const { lineup } = await import('./px.mjs');
  const frames = [drawWheel(false, 0), drawWheel(true, 0), drawWheel(true, 1), drawWheel(true, 2), drawWheel(true, 3)];
  const out = process.argv[2] ?? 'e2e/out/town-wheel-draft.png';
  lineup(frames, { k: 5, gap: 4, bg: '#4d9be6' }).save(out);
  console.log('wrote', out, frames.map((f) => f.offPalette()).join(','));
}
