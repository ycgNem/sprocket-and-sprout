// The square's fountain: town:fountain:<on>:<frame 0-3>:<season>, 48 x 58, anchored at the
// footprint's top-left (0, 26); the footprint is the bottom 3 x 2 tiles.
//
// The stone is PixelLab map object e6eca3c5 (art/town/raw/fountain/f1.png), generated dry, graded
// by lightness onto a warm sandstone ramp (the plain palette snap turned it salmon; STYLE's stone
// ramp lost it against the plaza's cobbles), outlined top-left in the deep shade as STYLE asks of
// large objects, its finial recoloured to brass. The water is drawn per frame over that stone, so
// the stone stays pixel-identical between frames: the basin and the upper bowl fill, a jet plays
// from the finial, two curtains fall from the bowl's lip (where the renderer throws its spray) and
// rings spread where they land. Dry: dead leaves and cracks. Winter: snow on the rims (and in the
// dry basin).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INK = '#2e222f', SH = '#45293f';
const SAND = ['#2e222f', '#45293f', '#753c54', '#966c6c', '#ab947a', '#fdcbb0'];
const BRASS = { d: '#9e4539', m: '#cd683d', b: '#f79617', l: '#f9c22b', h: '#fbff86' };
const WATER = { dd: '#323353', d: '#484a77', m: '#4d65b4', b: '#4d9be6', l: '#8fd3ff', w: '#ffffff' };
const SNOW = { b: '#c7dcd0', l: '#ffffff' };
const LEAF = { d: '#676633', m: '#a2a947', w: '#9e4539', o: '#cd683d' };

export const W = 48, H = 58, DY = 3; // the source art sits 3 px lower in the frame than generated
/** water surfaces, in frame px: the basin and the upper bowl (ellipses), minus the column */
const BASIN = { cx: 24, cy: 41 + DY, rx: 18.6, ry: 6.3, top: 36.6 + DY };
const BOWL = { cx: 24, cy: 20.2 + DY, rx: 7.6, ry: 2.3 };
const COLUMN = { x0: 21, x1: 27, yTop: 26 + DY, yBase: 43 + DY }; // the lower column, standing in the water
const CURTAINS = [16, 32]; // x of the two falls from the bowl's lip
const LIP = 24 + DY, LAND = 39 + DY;

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

let stoneCache = null;
/** the graded, outlined stone (no water), in a 48 x 58 frame */
export function stone() {
  if (stoneCache) return stoneCache.clone();
  const src = Img.load(path.join(HERE, '..', 'raw', 'fountain', 'f1.png'));
  const im = new Img(W, H);
  im.blit(src, 0, DY);
  // the finial (rows 4-9 of the source): brass, not olive
  const fin = [21, 4 + DY, 8, 6];
  im.gradeL(SAND, [20, 32, 48, 62, 76]);
  const raw = new Img(W, H).blit(src, 0, DY);
  raw.gradeL([INK, BRASS.d, BRASS.m, BRASS.b, BRASS.l, BRASS.h], [22, 36, 50, 66, 80], fin);
  for (let y = fin[1]; y < fin[1] + fin[3]; y++) for (let x = fin[0]; x < fin[0] + fin[2]; x++) { const c = raw.get(x, y); if (c) im.set(x, y, c); }
  // selective outline: the deep shade on the lit top-left edges (the bottom-right edges are dark already)
  const o = im.clone();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (o.get(x, y)) continue;
    const R = o.get(x + 1, y), D = o.get(x, y + 1), L = o.get(x - 1, y), U = o.get(x, y - 1);
    if ((R || D) && !L && !U) {
      const n = R ?? D;
      if (n !== INK && n !== SH) im.set(x, y, SH);
    } else if ((L || U) && !R && !D) {
      const n = L ?? U;
      if (n !== INK && n !== SH) im.set(x, y, INK);
    }
  }
  stoneCache = im;
  return im.clone();
}

const inEll = (e, x, y) => ((x + 0.5 - e.cx) / e.rx) ** 2 + ((y + 0.5 - e.cy) / e.ry) ** 2 <= 1;
const inColumn = (x, y) => x >= COLUMN.x0 && x <= COLUMN.x1 && y >= COLUMN.yTop && y <= COLUMN.yBase;
export const basinMask = (x, y) => inEll(BASIN, x, y) && y + 0.5 >= BASIN.top && !inColumn(x, y);
export const bowlMask = (x, y) => inEll(BOWL, x, y) && !(x >= 22 && x <= 26 && y < BOWL.cy);
/** the rims' top surfaces: the basin's ring above its front face, the bowl's ring */
const RIM = { cx: 24, cy: 41 + DY, rx: 23, ry: 9.6 }, BOWL_RIM = { cx: 24, cy: 20.2 + DY, rx: 9.8, ry: 3.6 };
const rimTop = (x, y) => (inEll(RIM, x, y) && !inEll({ ...BASIN, rx: BASIN.rx + 0.6, ry: BASIN.ry + 0.6 }, x, y) && y <= 49 && !inColumn(x, y)) ||
  (inEll(BOWL_RIM, x, y) && !inEll(BOWL, x, y) && y <= 24 + DY && !(x >= 22 && x <= 26 && y < 22 + DY));

/** town:fountain:<on>:<frame>:<season> */
export function drawFountain(on, f, season) {
  const im = stone();
  const snow = season === 3;
  if (on) {
    // ---- the basin's water: a lighter band under the far wall, ripples, glints ----
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!basinMask(x, y)) continue;
      const dy = (y + 0.5 - BASIN.cy) / BASIN.ry;
      let c = dy < -0.55 ? WATER.m : WATER.b;
      // the edge against the rim reads deeper
      const e = ((x + 0.5 - BASIN.cx) / BASIN.rx) ** 2 + dy * dy;
      if (e > 0.82) c = WATER.m;
      im.set(x, y, c);
    }
    // rings spreading from where each curtain lands, one ring per curtain moving outward per frame
    for (const cx of CURTAINS) {
      for (const k of [0, 2]) {
        const r = ((f + k) % 4) * 1.6 + 1.5;
        for (let a = 0; a < 48; a++) {
          const t = (a / 48) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(t) * r * 1.7 - 0.5), y = Math.round(LAND + 1 + Math.sin(t) * r * 0.5 - 0.5);
          // dashed, and fading as it spreads (the outer rings keep only their front arc)
          if (r > 4 && (Math.sin(t) < 0 || a % 3 === 0)) continue;
          if (basinMask(x, y)) im.set(x, y, WATER.l);
        }
      }
    }
    // the column's reflection, a darker streak in front of its foot
    for (let y = COLUMN.yBase + 2; y < COLUMN.yBase + 5; y++) for (let x = COLUMN.x0 + 1; x < COLUMN.x1; x++) if (basinMask(x, y) && (x + y) % 2 === 0) im.set(x, y, WATER.m);
    // the ring round the column's foot, and glints drifting with the frame
    for (let x = COLUMN.x0 - 2; x <= COLUMN.x1 + 2; x++) if (basinMask(x, COLUMN.yBase + 1) && (x + f) % 4 !== 0) im.set(x, COLUMN.yBase + 1, WATER.l);
    for (const [gx, gy] of [[9, 42], [37, 44], [13, 46], [30, 46], [20, 47]]) {
      const x = gx + (f % 2), y = gy + DY - 1;
      if (basinMask(x, y) && (gx + f) % 4 !== 0) im.set(x, y, WATER.w);
    }
    // ---- the upper bowl, brim-full ----
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bowlMask(x, y)) im.set(x, y, (x + y + f) % 4 === 0 ? WATER.l : WATER.b);
    // ---- the curtains from the lip into the basin: bands of light running down ----
    for (const cx of CURTAINS) {
      for (let y = LIP; y < LAND + 1; y++) {
        const k = (y - f * 2 + cx) % 4;
        im.set(cx, y, k === 0 ? WATER.w : k === 1 ? WATER.l : WATER.b);
        // the outer edge of the fall, a pixel wider near the bottom
        const ox = cx < 24 ? cx - 1 : cx + 1;
        if (y > LIP + 6 && (y + f) % 4 === 0) im.set(ox, y, WATER.l);
      }
      // splash where it lands
      const sx = cx < 24 ? -1 : 1;
      im.set(cx - sx, LAND, WATER.w); im.set(cx + sx * 2, LAND, WATER.w);
      im.set(cx + (f % 2 ? -2 : 2), LAND - 1, WATER.l);
    }
    // ---- the jet from the finial: a column that bobs, droplets either side ----
    const top = 4 + DY; // the finial's tip
    for (let y = top - 6; y < top; y++) {
      if (y < 0) continue;
      const wob = (y + f) % 2 ? 0 : -1;
      im.set(24 + wob, y, y < top - 4 ? WATER.w : WATER.l);
    }
    for (const [dx, dy] of [[-2, -3], [2, -2]]) im.set(24 + dx + (f % 2 ? 0 : dx > 0 ? 1 : -1), top + dy + ((f >> 1) & 1), WATER.l);
  } else {
    // ---- dry: cracks across the floor and a few dead leaves ----
    const floor = (x, y) => basinMask(x, y) && y > BASIN.cy - 3;
    for (const [x0, y0, x1, y1] of [[10, 43, 16, 46], [16, 46, 19, 45], [30, 42, 34, 46], [34, 46, 38, 47]])
      for (let i = 0; i <= 8; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / 8), y = Math.round(y0 + DY - 1 + ((y1 - y0) * i) / 8);
        if (floor(x, y)) im.set(x, y, SH);
      }
    if (!snow) for (const [x, y, c] of [[12, 45, LEAF.w], [27, 47, LEAF.d], [35, 44, LEAF.o], [19, 44, LEAF.m], [8, 42, LEAF.o]]) {
      if (floor(x, y + DY - 1)) { im.set(x, y + DY - 1, c); im.set(x + 1, y + DY - 1, c); }
    }
    // a dry stain round the bowl
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bowlMask(x, y) && hash(x, y, 4) < 0.4) im.set(x, y, SH);
  }
  if (snow) {
    // snow on the rims' top surfaces only (the basin's ring and the bowl's), never down the column
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!rimTop(x, y)) continue;
      const c = im.get(x, y);
      if (c === SAND[5] || c === SAND[4]) im.set(x, y, hash(x, y, 2) < 0.15 ? SNOW.b : SNOW.l);
      else if (c === SAND[3]) im.set(x, y, SNOW.b);
    }
    // the dry basin holds a drift: smooth, shaded under the far wall
    if (!on) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!basinMask(x, y)) continue;
      const dy = (y + 0.5 - BASIN.cy) / BASIN.ry;
      if (dy < -0.5) continue;
      im.set(x, y, dy < -0.2 || (x >= COLUMN.x0 && x <= COLUMN.x1 + 2 && dy < 0.5) ? SNOW.b : SNOW.l);
    }
  }
  return im;
}

if (process.argv[1] && process.argv[1].endsWith('fountain.mjs')) {
  const { lineup } = await import('./px.mjs');
  const mask = stone();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (basinMask(x, y)) mask.set(x, y, '#e83b3b'); if (bowlMask(x, y)) mask.set(x, y, '#30e1b9'); if (inColumn(x, y) && mask.get(x, y)) mask.set(x, y, '#f9c22b'); }
  const frames = [mask, drawFountain(false, 0, 0), drawFountain(true, 0, 0), drawFountain(true, 1, 0), drawFountain(true, 2, 0), drawFountain(true, 3, 0), drawFountain(false, 0, 3), drawFountain(true, 1, 3)];
  const out = process.argv[2] ?? 'e2e/out/town-fountain-draft.png';
  lineup(frames, { k: 5, gap: 3, bg: '#ab947a' }).save(out);
  console.log('wrote', out, frames.map((f) => f.offPalette()).join(','));
}
