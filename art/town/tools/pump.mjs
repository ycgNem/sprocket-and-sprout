// The Waterworks' pump house: town:pump:<season>:<state 0 shuttered, 1 running, 2 running at
// night>[:<frame 0-3>], 80 x 102 anchored at (0, 38): the procedural 80 x 98 house (baked from
// src/render/art/townworks.ts, art/town/baked/) 4 px lower in a frame 4 px taller, so a beam
// engine has room on the ridge. World positions are unchanged (the renderer's chimney smoke and
// vent steam land where they did; the steam now rises between the trestle's legs).
//
// STYLE.md "Machines": the readable moving part is a timber walking beam on a brass A-frame
// trestle over the roof vent, a pump rod into a gland at its west end, a piston rod from a copper
// cylinder by the chimney at its east end; running, it rocks +-3 px at the ends over four frames.
// Shuttered, the same silhouette at rest: the beam down on its gland, brass gone to rust, moss
// on the timber. Industrial botany: ivy up the house's east corner and moss on the plinth, more
// of both while it stands shut. The design follows PixelLab batch d3a36762 slots 53-57 (a
// nodding beam engine with a horse head, used as reference only).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INK = '#2e222f', SH = '#45293f';
const WOOD = { s: '#45293f', d: '#7a3045', m: '#9e4539', b: '#cd683d', l: '#e6904e' };
const BRASS = { d: '#9e4539', m: '#cd683d', b: '#f79617', l: '#f9c22b', h: '#fbff86' };
const RUST = { d: '#7a3045', m: '#9e4539', b: '#cd683d', l: '#cd683d', h: '#e6904e' };
const COPPER = { d: '#6e2727', m: '#b33831', b: '#ea4f36', l: '#f57d4a', h: '#fca790' };
const IRON = { d: '#625565', l: '#9babb2' };
const LEAF = { d: '#165a4c', m: '#239063', b: '#1ebc73', l: '#91db69' };
const MOSS = { d: '#676633', m: '#a2a947' };
const SNOW = '#ffffff';

export const W = 80, H = 102, OY = 38, DY = 4;
const PIVOT = [39, 8], HALF = 17, SWING = [-3, 0, 3, 0];

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** ivy climbing from (x, y0) up to y1, leaves alternating side to side */
function climb(im, x0, y0, y1, seed, dense) {
  let x = x0;
  for (let y = y0; y >= y1; y--) {
    im.set(x, y, (y0 - y) % 3 === 0 ? LEAF.d : LEAF.m);
    if ((y0 - y) % 2 === 0 || dense) {
      const side = hash(y, seed, 1) < 0.5 ? -1 : 1;
      im.set(x + side, y, hash(y, seed, 2) < 0.4 ? LEAF.b : LEAF.m);
      if (hash(y, seed, 3) < 0.3) im.set(x + side, y - 1, LEAF.l);
      if (dense && hash(y, seed, 4) < 0.5) im.set(x - side, y, LEAF.d);
    }
    if (hash(y, seed, 5) < 0.18) x += hash(y, seed, 6) < 0.5 ? -1 : 1;
    x = Math.max(x0 - 3, Math.min(x0 + 2, x));
  }
}

/** the beam engine for one frame (d: the west end's offset; +d lowers it) */
function engine(im, d, shut, winter) {
  const B = shut ? RUST : BRASS;
  const [px, py] = PIVOT;
  const xl = px - HALF, xr = px + HALF;
  const yAt = (x) => Math.round(py + (d * (px - x)) / HALF); // west end at py + d... (d > 0: west end down)
  const yl = py + d, yr = py - d;
  // ---- the copper cylinder by the chimney, and the gland on the ridge (behind the rods) ----
  const cx0 = 50, cy0 = 13 + DY, ch = 9;
  im.rect(cx0 - 1, cy0 - 1, 8, ch + 2, INK);
  im.rect(cx0, cy0, 6, ch, COPPER.b);
  im.rect(cx0, cy0, 1, ch, COPPER.l); im.rect(cx0 + 4, cy0, 2, ch, COPPER.m); im.rect(cx0 + 5, cy0, 1, ch, COPPER.d);
  for (const by of [cy0 + 1, cy0 + ch - 2]) { im.rect(cx0, by, 6, 1, B.b); im.set(cx0, by, B.l); im.set(cx0 + 5, by, B.d); }
  im.rect(cx0 - 1, cy0 - 2, 8, 1, INK); im.rect(cx0, cy0 - 1, 6, 1, shut ? COPPER.m : COPPER.l);
  const gx0 = xl - 2, gy0 = 18 + DY;
  im.rect(gx0 - 1, gy0 - 1, 7, 5, INK);
  im.rect(gx0, gy0, 5, 3, B.b); im.rect(gx0, gy0, 5, 1, B.l); im.rect(gx0 + 4, gy0, 1, 3, B.d);
  // ---- the rods ----
  const rodL = xl + 1, rodR = xr - 1;
  for (let y = yl + 4; y < gy0 - 1; y++) { im.set(rodL, y, IRON.l); im.set(rodL + 1, y, IRON.d); }
  for (let y = yr + 3; y < cy0 - 2; y++) { im.set(rodR, y, IRON.l); im.set(rodR + 1, y, IRON.d); }
  // ---- the trestle: a brass A-frame from the roof vent's top (row 15) up to the pivot ----
  const vt = 11 + DY;
  for (const [x0, x1, lit] of [[34, px - 1, true], [44, px + 1, false]]) {
    const n = vt - (py + 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = vt - i;
      im.set(x - 1, y, INK); im.set(x, y, lit ? B.l : B.b); im.set(x + 1, y, lit ? B.b : B.d); im.set(x + 2, y, INK);
    }
  }
  // its cross-tie
  im.rect(36, vt - 4, 6, 1, INK); im.rect(36, vt - 3, 6, 1, B.m); im.rect(36, vt - 2, 6, 1, INK);
  // ---- the walking beam: outline, lit top, body, shade, outline ----
  for (let x = xl; x <= xr; x++) {
    const y = yAt(x);
    im.set(x, y - 2, SH); im.set(x, y - 1, WOOD.b); im.set(x, y, WOOD.m); im.set(x, y + 1, WOOD.d); im.set(x, y + 2, INK);
    if (shut && hash(x, 1, 7) < 0.3) im.set(x, y - 1, hash(x, 2, 7) < 0.5 ? MOSS.d : LEAF.m);
    if (winter && hash(x, 3, 7) < 0.85) im.set(x, y - 2, SNOW);
  }
  for (let y = yl - 2; y <= yl + 2; y++) im.set(xl - 1, y, INK);
  for (let y = yr - 2; y <= yr + 2; y++) im.set(xr + 1, y, INK);
  // the horse head at the west end, over the pump rod
  im.rect(xl - 1, yl - 3, 4, 8, INK);
  im.rect(xl, yl - 2, 2, 6, WOOD.b); im.set(xl, yl - 2, WOOD.l); im.rect(xl + 1, yl - 1, 1, 5, WOOD.m);
  im.set(xl - 1, yl - 3, null); im.set(xl - 1, yl + 4, null);
  im.set(xl + 2, yl - 2, B.l); im.set(xl + 2, yl + 3, B.b);
  // the brass cap at the east end
  im.rect(xr - 2, yr - 1, 3, 3, B.b); im.set(xr - 2, yr - 1, B.l); im.set(xr, yr + 1, B.d);
  // the pivot's boss
  im.rect(px - 2, py - 2, 5, 5, INK);
  im.rect(px - 1, py - 1, 3, 3, B.b); im.set(px - 1, py - 1, B.h === BRASS.h ? B.h : B.l); im.set(px + 1, py + 1, B.d);
  im.set(px - 2, py - 2, null); im.set(px + 2, py - 2, null); im.set(px - 2, py + 2, null); im.set(px + 2, py + 2, null);
}

/** town:pump:<season>:<state>:<frame> */
export function drawPump(season, state, frame) {
  const im = new Img(W, H);
  im.blit(Img.load(path.join(HERE, '..', 'baked', `town_pump_${season}_${state}.png`)), 0, DY);
  const shut = state === 0, winter = season === 3;
  // ---- industrial botany: ivy up the east corner, moss along the plinth ----
  if (!winter) {
    climb(im, 76, 91 + DY, (shut ? 60 : 72) + DY, 31, shut);
    climb(im, 73, 91 + DY, (shut ? 70 : 82) + DY, 47, false);
    if (shut) climb(im, 3, 91 + DY, 70 + DY, 59, false);
    for (let x = 2; x < 78; x++) {
      const v = hash(Math.floor(x / 3), 1, shut ? 3 : 4);
      if (v < (shut ? 0.5 : 0.25) && hash(x, 2, 5) < 0.75) im.set(x, 92 + DY, hash(x, 3, 5) < 0.5 ? MOSS.m : MOSS.d);
      if (shut && v < 0.2 && hash(x, 4, 5) < 0.5) im.set(x, 93 + DY, LEAF.d);
    }
  }
  engine(im, shut ? 3 : SWING[frame % 4], shut, winter);
  return im;
}

if (process.argv[1] && process.argv[1].endsWith('pump.mjs')) {
  const { lineup } = await import('./px.mjs');
  const frames = [drawPump(0, 0, 0), drawPump(0, 1, 0), drawPump(0, 1, 1), drawPump(0, 1, 2), drawPump(0, 2, 0), drawPump(3, 1, 2)];
  lineup(frames, { k: 3, gap: 4, bg: '#239063' }).save(process.argv[2] ?? 'e2e/out/town-pump-draft.png');
  console.log(frames.map((f) => f.offPalette()).join(','));
}
