// The Sprocket & Sprout emblem: a brass sprocket rendered by rule, so 8 frames turn through exactly
// one tooth pitch (45 degrees) and loop seamlessly. Design and material follow the PixelLab concept
// batch in raw/concepts (create_1_direction_object, see build.mjs; #19 and #0 were the models):
// broad flat brass with a butter rim light, a thin dark groove, a recessed copper disc with a ring
// of holes, a dark collar and a gold bolt with a glint.
//
// How it stays steady:
// - The body (rim, groove, disc, collar, bolt) is classified by the pixel centre's radius only, so
//   its pixels are identical in every frame; only the teeth and the holes move.
// - Each tooth gets exactly round(its area) pixels, the ones it covers most (8x8 supersampling),
//   so teeth don't swell or shrink as they turn.
// - Holes are one fixed stamp placed at their rounded positions, so they keep their shape.
// - Shading comes from a fixed light in the upper left, per pixel: broad diagonal bands plus an
//   edge light from each pixel's outward normal (8 neighbours). Nothing is rotated with the teeth.
// The outline and the 3D side are derived from each frame's final mask.
import { PX } from './pal.mjs';

const TAU = Math.PI * 2;

/**
 * Radii in pixels from the centre, which is a pixel corner (frames are even-sized), for the fill;
 * the 1 px plum outline goes outside them. From the outside in: teeth (rTip..rRoot), rim
 * (rRoot..rim), groove (..groove), disc (..disc, with holes), collar (..collar), bolt.
 */
export const DESIGNS = {
  // hotbar end caps: 16 x 16, centre (8, 8)
  small: {
    size: 16, depth: 0, teeth: 8, lit: 0.75,
    rRoot: 5.0, toothStamp: ['##', '##'], toothR: 6.1, // 2 x 2 teeth that keep their shape
    rim: 3.3, groove: 1.45, disc: 1.45, collar: 1.45, // brass ring, dark hub, 2 x 2 bolt
    holes: null,
  },
  // title: the O of "Sprocket", 28 x 28 face + 3 px side, centre (14, 14)
  large: {
    size: 28, depth: 3, teeth: 8, lit: 0.38, shadow: PX.plum,
    rTip: 13.0, rRoot: 9.7, wTip: 3.7, wRoot: 4.7,
    rim: 7.6, groove: 6.7, disc: 3.05, collar: 2.25,
    holes: { n: 8, r: 4.9, shape: ['aa', 'aa'] },
  },
};

// region ids
export const EMPTY = 0, TOOTH = 1, RIM = 2, GROOVE = 3, DISC = 4, COLLAR = 5, BOLT = 6, HOLE = 7;
// height of each region for the bevel rule (empty lowest)
const HEIGHT = { [EMPTY]: -9, [TOOTH]: 2, [RIM]: 2, [GROOVE]: -1, [DISC]: 0, [COLLAR]: -1, [BOLT]: 2, [HOLE]: -2 };

function bodyRegion(D, r) {
  if (r > D.rRoot) return EMPTY;
  if (r > D.rim) return RIM;
  if (r > D.groove) return GROOVE;
  if (r > D.disc) return DISC;
  if (r > D.collar) return COLLAR;
  return BOLT;
}

/** index of the tooth covering (dx, dy) at rotation theta, or -1 */
function toothAt(D, dx, dy, theta) {
  const r = Math.hypot(dx, dy);
  if (r > D.rTip || r < D.rRoot - 2) return -1;
  const pitch = TAU / D.teeth;
  const phi = Math.atan2(dy, dx) - theta;
  const k = Math.round(phi / pitch);
  const a = phi - k * pitch;
  const u = r * Math.cos(a), v = r * Math.sin(a); // radial, tangential in the tooth's frame
  const t = Math.min(1, Math.max(0, (u - D.rRoot) / (D.rTip - D.rRoot)));
  const half = (D.wRoot + (D.wTip - D.wRoot) * t) / 2;
  return u <= D.rTip && Math.abs(v) <= half ? ((k % D.teeth) + D.teeth) % D.teeth : -1;
}

/** region map of one frame: `f` in 0..7 turns the gear by f/8 of a tooth pitch (clockwise) */
export function gearRegions(D, f) {
  const S = D.size, c = S / 2;
  const theta = ((f + (D.phase ?? 0)) / 8) * (TAU / D.teeth);
  const SS = 8;
  const reg = new Array(S * S).fill(EMPTY);
  const cand = Array.from({ length: D.teeth }, () => []);
  if (D.toothStamp) {
    // small gears: every tooth is the same fixed stamp, moved along the circle (no morphing)
    const st = D.toothStamp, sw = st[0].length, sh = st.length;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) reg[y * S + x] = bodyRegion(D, Math.hypot(x + 0.5 - c, y + 0.5 - c));
    for (let k = 0; k < D.teeth; k++) {
      const a = theta + k * (TAU / D.teeth);
      const tx = Math.round(c + D.toothR * Math.cos(a) - sw / 2), ty = Math.round(c + D.toothR * Math.sin(a) - sh / 2);
      st.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && reg[(ty + j) * S + tx + i] === EMPTY) reg[(ty + j) * S + tx + i] = TOOTH; }));
    }
    return reg;
  }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const b = bodyRegion(D, Math.hypot(x + 0.5 - c, y + 0.5 - c));
      if (b !== EMPTY) { reg[y * S + x] = b; continue; }
      const cov = new Array(D.teeth).fill(0);
      for (let j = 0; j < SS; j++)
        for (let i = 0; i < SS; i++) {
          const k = toothAt(D, x + (i + 0.5) / SS - c, y + (j + 0.5) / SS - c, theta);
          if (k >= 0) cov[k]++;
        }
      cov.forEach((n, k) => { if (n) cand[k].push({ i: y * S + x, cov: n / (SS * SS), x, y }); });
    }
  // each tooth keeps the round(area) pixels it covers most
  cand.forEach((list) => {
    const area = Math.round(list.reduce((a, p) => a + p.cov, 0));
    list.sort((p, q) => q.cov - p.cov || q.y - p.y || q.x - p.x);
    list.slice(0, area).forEach((p) => (reg[p.i] = TOOTH));
  });
  if (D.holes) {
    const { n, r, shape } = D.holes;
    const sw = shape[0].length, sh = shape.length;
    for (let k = 0; k < n; k++) {
      const a = theta + (k + 0.5) * (TAU / n);
      const hx = Math.round(c + r * Math.cos(a) - sw / 2), hy = Math.round(c + r * Math.sin(a) - sh / 2);
      shape.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') reg[(hy + j) * S + hx + i] = HOLE; }));
    }
  }
  return reg;
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const LX = -Math.SQRT1_2, LY = -Math.SQRT1_2; // toward the light

/** One frame as { w, h, px: hex|null[] } (face, then side and outline). */
export function gearFrame(D, f, ramp = PX.brass) {
  const S = D.size, c = S / 2;
  const reg = gearRegions(D, f);
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? EMPTY : reg[y * S + x]);
  const B = ramp; // wine, rust, copper, orange, gold, butter
  // outward normal toward lower neighbours, dotted with the light: +1 faces the light
  const edge = (x, y, h, lower = (hh) => hh < h) => {
    // only pixels with a lower 4-neighbour are edge pixels (a 1 px line); the normal uses all 8
    if (!(lower(HEIGHT[at(x - 1, y)]) || lower(HEIGHT[at(x + 1, y)]) || lower(HEIGHT[at(x, y - 1)]) || lower(HEIGHT[at(x, y + 1)]))) return 0;
    let nx = 0, ny = 0;
    for (const [dx, dy] of N8) if (lower(HEIGHT[at(x + dx, y + dy)])) { const w = dx && dy ? 0.7 : 1; nx += dx * w; ny += dy * w; }
    const l = Math.hypot(nx, ny);
    return l ? (nx * LX + ny * LY) / l : 0;
  };
  const px = new Array(S * S).fill(null);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const g = reg[y * S + x];
      if (g === EMPTY) continue;
      const h = HEIGHT[g];
      const diag = -((x + 0.5 - c) + (y + 0.5 - c)) / (Math.SQRT2 * c); // +1 upper left .. -1 lower right
      let col;
      if (g === TOOTH || g === RIM) {
        const out = edge(x, y, h, (hh) => hh === HEIGHT[EMPTY]); // the silhouette edge
        const inn = edge(x, y, h, (hh) => hh > HEIGHT[EMPTY] && hh < h); // the step down into the groove
        let s = y < c ? 4 : 3; // the same horizon as the letters: gold above the centre, orange below
        if (out > D.lit) s = 5;
        else if (out > 0.38) s = Math.max(s, 4);
        else if (out < -0.38) s = Math.min(s, 2);
        else if (inn > 0.38) s = Math.max(s, 4);
        else if (inn < -0.38) s = Math.min(s, 3);
        col = B[clamp(s, 1, 5)];
      } else if (g === GROOVE || g === COLLAR) col = B[0];
      else if (g === HOLE) col = PX.plum;
      else if (g === DISC) {
        // recess: shaded under its upper-left wall, lit along its lower-right wall
        let up = false, dn = false;
        for (const [dx, dy] of N8) {
          const hh = HEIGHT[at(x + dx, y + dy)];
          if (hh > h && dx + dy < 0) up = true;
          if (hh > h && dx + dy > 0) dn = true;
        }
        col = up && !dn ? B[1] : B[2];
      } else if (g === BOLT) {
        const e = edge(x, y, h);
        col = e < -0.38 ? B[3] : diag > 0 ? B[4] : B[3];
      }
      px[y * S + x] = col;
    }
  // bolt glint: the bolt pixel nearest its upper-left shoulder
  let best = -1, bd = Infinity;
  const bc = c - D.collar * 0.4;
  for (let i = 0; i < reg.length; i++) {
    if (reg[i] !== BOLT) continue;
    const d = Math.hypot((i % S) + 0.5 - bc, Math.floor(i / S) + 0.5 - bc);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0) px[best] = B[5];
  return finish(px, S, S, D.depth, undefined, D.shadow);
}

/**
 * Grow a face by `depth` px of 3D side below it, then a 1 px plum outline around everything
 * (4-neighbour rule: a clean single-pixel line). The frame grows by `depth` rows.
 */
export function finish(px, W0, H0, depth, side = [PX.brass[1], PX.brass[0]], shadow = null) {
  const W = W0 + (shadow ? 1 : 0), H = H0 + depth + (shadow ? 1 : 0);
  const face = new Array(W * H).fill(null);
  px.forEach((p, i) => (face[Math.floor(i / W0) * W + (i % W0)] = p));
  const out = face.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (face[y * W + x]) continue;
      for (let k = 1; k <= depth; k++)
        if (y - k >= 0 && face[(y - k) * W + x]) { out[y * W + x] = k === depth ? side[1] : side[0]; break; }
    }
  const solid = out.map((p) => p !== null);
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && solid[y * W + x];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!solid[y * W + x] && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) out[y * W + x] = PX.ink;
  if (shadow) {
    const inked = out.map((p) => p !== null);
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) if (!inked[y * W + x] && inked[(y - 1) * W + x - 1]) out[y * W + x] = shadow;
  }
  return { w: W, h: H, px: out };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
