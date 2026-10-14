// The Copper Gull, the harbor's merchant steam clipper (harbor:ship:<f>, harbor:ship:sail:<f>): one
// PixelLab pick graded onto the game's ramps, every frame derived by rule.
//
// Source: raw/s3.png (create_map_object 160x120, view side, selective outline, detailed shading,
// high detail; raw/batches.json). Its sails are set (a gaff mainsail and a jib), which is the
// under-way look; the moored look furls them by rule.
//
//   grade     hull planks onto the wood ramp, brass onto the brass ramp, sails onto the cream ramp
//             of the game's puffs and the airship envelope, near-blacks onto the plum outline
//   copper    the four plank rows above the waterline become copper sheathing with plate seams
//   furl      (moored) the mainsail bundled on its boom with ties, a topping lift from the masthead,
//             the jib rolled along the forestay; a mooring line from the stern into the water
//   sail      (under way) the sails as generated, a bow wave and a wake in the foam
//   bob       everything above the waterline sinks 1 px in frames 2-3; the waterline foam stays
//   smoke     two puffs per frame on a 4-stage path out of the brass stack (straight up while
//             moored, streaming aft under way), drawn like fx:puff (white rims, cream, taupe)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, PAL } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const O = '#2e222f';

// frame = raw rows TOP..W+1 (W = waterline row in raw coords), raw x = frame x
const TOP = 10, W = 99;
export const SHIP = { w: 160, h: W + 2 - TOP, ox: 0 };
SHIP.oy = SHIP.h - 64;

// ------------------------------------------------------------------ grade
const GRADE = {
  // outline and near-blacks
  '#050201': O, '#180704': O, '#1f1e1c': O, '#300912': O,
  // hull planks (dark source) onto the wood ramp
  '#28040d': '#45293f', '#39140b': '#7a3045', '#471f14': '#9e4539', '#79381b': '#cd683d', '#d47647': '#e6904e',
  // rigging
  '#372e2e': '#45293f',
  // brass
  '#634302': '#9e4539', '#916407': '#cd683d', '#b77e08': '#f79617', '#f4af24': '#f9c22b',
  // sails: the cream ramp (#fdcbb0 cloth, #ffffff lit, #ab947a / #966c6c folds)
  '#fef7c9': '#fdcbb0', '#f1d6a8': '#fdcbb0', '#caa67f': '#ab947a', '#b3885d': '#966c6c',
};
// the lit side of each sail gets white, by source shade: #fef7c9 next to the luff
const inTri = (px, py, [ax, ay], [bx, by], [cx, cy]) => {
  const d = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = d(px, py, ax, ay, bx, by), d2 = d(px, py, bx, by, cx, cy), d3 = d(px, py, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
// sail regions in raw coords
const MAINSAIL = (x, y) => x >= 10 && x <= 44 && y >= 19 && y <= 64;
const JIB = (x, y) => x >= 114 && y <= 76 && inTri(x, y, [113, 31], [152, 68], [113, 79]);

function grade(raw) {
  const g = raw.clone();
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    const c = raw.get(x, y);
    if (!c) continue;
    let out = GRADE[c];
    if (!out) throw new Error('ship: ungraded source color ' + c);
    // sails: the brightest cloth facing the light (upper-left half of each sail) turns white
    if (c === '#fef7c9' && (MAINSAIL(x, y) ? y < 30 + (x - 10) * 0.6 : x < 124 + (y - 36) * 0.35)) out = '#ffffff';
    g.set(x, y, out);
  }
  return g;
}

// ------------------------------------------------------------------ copper sheathing
const HULL_X = [12, 141];
function copper(img) {
  for (let x = HULL_X[0]; x <= HULL_X[1]; x++) {
    // lowest hull (non-outline) pixel above the waterline in this column
    let b = -1;
    for (let y = W - 1; y >= 84; y--) { const c = img.get(x, y); if (c && c !== O) { b = y; break; } }
    if (b < 0) continue;
    const seam = (x - 13) % 7 === 0;
    for (let k = 0; k < 4; k++) {
      const y = b - k;
      const c = img.get(x, y);
      if (!c || c === O) break;
      // [bottom .. top]: shadow at the water, base, base, lit top edge
      const ramp = ['#6e2727', '#b33831', '#b33831', '#ea4f36'][k];
      img.set(x, y, seam && k > 0 && k < 3 ? '#6e2727' : ramp);
    }
    // a dark line above the band separates copper from planks
    const above = img.get(x, b - 4);
    if (above && above !== O) img.set(x, b - 4, '#45293f');
  }
  // rivet glints on the lit top row
  for (let x = HULL_X[0] + 3; x <= HULL_X[1] - 6; x += 7) {
    for (let y = W - 1; y >= 84; y--) { if (img.get(x, y) === '#ea4f36') { img.set(x, y, '#f57d4a'); break; } }
  }
}

// ------------------------------------------------------------------ drawing helpers
function line(img, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const pts = [];
  for (;;) {
    pts.push([x0, y0]);
    if (c) img.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return pts;
}
function stamp(img, x, y, rows, key) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === ' ' || ch === '.') return;
    img.set(x + i, y + j, ch === '_' ? null : key[ch]);
  }));
}

// ------------------------------------------------------------------ furled (moored) rig
function furl(img) {
  // clear the set sails (keep the masts, the ratlines and the forestay)
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const c = img.get(x, y);
    if (!c) continue;
    if (MAINSAIL(x, y)) img.set(x, y, null);
    else if (JIB(x, y) && c !== '#45293f') img.set(x, y, null);
  }
  // the forestay where the jib's luff covered it
  line(img, 114, 24, 151, 71, '#45293f');
  // mainsail bundled on the boom: boom rows 63-64 from the stern to the mast, bundle above it
  const B0 = 12, B1 = 44;
  for (let x = B0; x <= B1; x++) { img.set(x, 62, O); img.set(x, 63, '#cd683d'); img.set(x, 64, '#7a3045'); img.set(x, 65, O); }
  img.set(B0 - 1, 63, O); img.set(B0 - 1, 64, O);
  // the bundle: a rounded cream roll, lit on top, ties every 6 px
  const R0 = 15, R1 = 43;
  for (let x = R0; x <= R1; x++) {
    const end = x === R0 || x === R1;
    const top = end ? 59 : 58;
    img.set(x, top - 1, O);
    for (let y = top; y <= 61; y++) img.set(x, y, y === top ? '#ffffff' : y === 61 ? '#ab947a' : '#fdcbb0');
    if (!end && (x - R0) % 6 === 3) { img.set(x, top, '#7a3045'); img.set(x, top + 1, '#7a3045'); img.set(x, top + 2, '#7a3045'); img.set(x, 61, '#45293f'); }
  }
  img.set(R0 - 1, 59, O); img.set(R0 - 1, 60, O); img.set(R0 - 1, 61, O);
  img.set(R1 + 1, 59, O); img.set(R1 + 1, 60, O); img.set(R1 + 1, 61, O);
  for (let x = R0; x <= R1; x++) if (img.get(x, 62) !== O) img.set(x, 62, O);
  // gooseneck where the boom meets the mast
  stamp(img, 43, 62, ['OO', 'kO', 'kO'], { O, k: '#f79617' });
  // topping lift: masthead to the boom end
  line(img, 44, 20, 13, 61, '#45293f');
  // jib rolled along the forestay: a 2 px cream roll left of the stay from y 38 to 66
  const stay = line(img, 114, 24, 151, 71, null).filter(([, y]) => y >= 38 && y <= 66);
  for (const [x, y] of stay) {
    img.set(x - 3, y, O);
    img.set(x - 2, y, y % 5 === 0 ? '#7a3045' : '#fdcbb0');
    img.set(x - 1, y, y % 5 === 0 ? '#7a3045' : '#ab947a');
  }
  for (const [x, y] of stay.slice(0, 1)) { img.set(x - 2, y - 1, O); img.set(x - 1, y - 1, O); }
  for (const [x, y] of stay.slice(-1)) { img.set(x - 2, y + 1, O); img.set(x - 1, y + 1, O); }
  return img;
}

// ------------------------------------------------------------------ smoke
// 4 stages of one puff [dx, dy from the stack mouth, shape]; shapes in the fx:puff key
const PUFF = [
  ['..WW..', '.WWccc', 'Wccccct', 'tcctcct', '.mmmmm.'],
  ['....WWc..', '.WWc.Wccc.', 'Wccctcccct', 'Wcccccccct', 'ccccccccct', '.tccctcct.', '..mm.mmm..'],
  ['....WWc.....', '...WWccc....', 'WW.Wccct.W..', 'cctccccctcc.', 'ccccccccccct', 'cccccccccct.', '.tccctcccctt', '..tmm.mmmt..'],
  ['.WW.....WW.', 'Wcct...Wcct', '.tt.....tt.', '...........', '....WW.....', '...Wcct....', '....tt.....'],
];
const PK = { W: '#ffffff', c: '#fdcbb0', t: '#ab947a', m: '#966c6c' };
const STACK = { x: 63, y: 41 }; // stack mouth center, raw coords
const PATH_MOORED = [[0, -1], [-1, -7], [-2, -15], [-4, -24]];
const PATH_SAIL = [[-1, -1], [-6, -6], [-14, -11], [-24, -15]];

function smoke(img, f, path_) {
  for (const s of [f % 4, (f + 2) % 4]) {
    const shape = PUFF[s];
    const w = shape[0].length, h = shape.length;
    const [dx, dy] = path_[s];
    stamp(img, STACK.x + dx - Math.floor(w / 2), STACK.y + dy - h + 1, shape, PK);
  }
}

// ------------------------------------------------------------------ waterline foam
function foam(img, f, underway) {
  // columns where the hull meets the water
  const cols = [];
  for (let x = 0; x < img.w; x++) if (img.get(x, W - 1)) cols.push(x);
  const x0 = Math.min(...cols) - 1, x1 = Math.max(...cols) + 1;
  for (let x = x0; x <= x1; x++) {
    const k = (x + f * 2) % 6;
    img.set(x, W, k === 0 ? '#8fd3ff' : '#ffffff');
    if ((x + f * 3) % 5 === 0) img.set(x, W + 1, '#8fd3ff');
  }
  if (underway) {
    // bow wave: foam piled against the stem, curling forward
    const bow = [[x1 + 1, W], [x1 + 2, W], [x1 + 3, W + 1], [x1, W - 1], [x1 + 1, W - 1], [x1 + 4, W + 1]];
    bow.forEach(([x, y], i) => img.set(x, y, i % 3 === 2 ? '#8fd3ff' : '#ffffff'));
    // wake behind the stern: broken foam trailing off, shifting each frame
    for (let i = 0; i < 12; i++) {
      const x = x0 - 1 - i;
      if (x < 0) break;
      if ((i + f) % 3 !== 2) img.set(x, W, i < 5 ? '#ffffff' : '#8fd3ff');
      if ((i + f) % 4 === 0) img.set(x, W + 1, '#8fd3ff');
    }
  }
}

// ------------------------------------------------------------------ frames
/** returns { moored: [4 Img], sail: [4 Img] } at the frame size */
export function buildShip() {
  const raw = Img.load(path.join(HERE, '../raw/s3.png'), { unscale: false });
  const base = grade(raw);
  copper(base);
  const sailRig = base.clone();
  // under way: no mooring rope over the stern
  for (let y = 84; y < raw.h; y++) for (let x = 0; x < 11; x++) sailRig.set(x, y, null);
  const moored = furl(base.clone());
  const make = (rig, f, underway) => {
    const dy = f >= 2 ? 1 : 0;
    const full = new Img(raw.w, raw.h);
    full.blit(rig, 0, dy);
    smoke(full, f, underway ? PATH_SAIL : PATH_MOORED);
    // below the waterline nothing shows (the sea is drawn under the sprite)
    for (let y = W; y < full.h; y++) for (let x = 0; x < full.w; x++) full.set(x, y, null);
    foam(full, f, underway);
    const bb = full.bbox();
    if (bb.y0 < TOP) throw new Error('ship: art above the frame top (row ' + bb.y0 + ')');
    const out = new Img(SHIP.w, SHIP.h);
    for (let y = 0; y < SHIP.h; y++) for (let x = 0; x < SHIP.w; x++) { const c = full.get(x, y + TOP); if (c) out.set(x, y, c); }
    for (const c of out.colors().keys()) if (!PAL.includes(c)) throw new Error('ship: off-palette ' + c);
    return out;
  };
  return {
    moored: [0, 1, 2, 3].map((f) => make(moored, f, false)),
    sail: [0, 1, 2, 3].map((f) => make(sailRig, f, true)),
  };
}
