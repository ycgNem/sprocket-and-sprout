// Clockwork arm parts, drawn pixel by pixel (palette only, light from the upper left). Imported by
// gen/belts.mjs into the factory-belts sheet; the renderer's drawArm puts them together.
//
//   armb:<id>                    16x16 turntable with the mainspring, arbor (shoulder) at ARBOR
//   armh:<id>:<s>:<dir>          9x9 claw, origin (4,4) = the wrist; s 0 open, 1 closed;
//                                dir = the way the jaws point, in rotation order (0 N, 1 E, 2 S, 3 W)
//   armh:<id>:<s>                the old name: the claw pointing down (dir 2)
//   armh:key:<f>                 the spring arm's winding key seen face-on (pointing at or away
//                                from the viewer), 4 frames (f 0 broad .. 2 edge-on), origin = the
//                                stem's foot
//   armh:key:<f>:<1|3>           the same key side-on, its shaft pointing east (1) or west (3)
//   armh:coil:<f>                the powered arms' copper motor coil, 4 frames (f 0 idle, 1-3 lit
//                                turning), origin = its foot
//
// Pure module (no node imports) so the browser can import it for previews.
export const INK = '#2e222f';
export const RAMP = {
  wood: ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'],
  brass: ['#7a3045', '#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'],
  copper: ['#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790'],
  iron: ['#3e3546', '#625565', '#7f708a', '#9babb2', '#c7dcd0'],
  taupe: ['#3e3546', '#694f62', '#966c6c', '#ab947a'],
  gold: ['#cd683d', '#f79617', '#f9c22b', '#fbff86'],
  rose: ['#753c54', '#a24b6f', '#cf657f', '#ed8099'],
  purple: ['#45293f', '#6b3e75', '#905ea9', '#a884f3'],
  blue: ['#484a77', '#4d65b4', '#4d9be6', '#8fd3ff'],
};
/** per kind: plate ramp (5), ring (4: dark..light), arm segment ramp (4), claw fingers (4) */
export const ARM = {
  arm_basic: { plate: RAMP.wood, ring: RAMP.taupe, seg: ['#7a3045', '#9e4539', '#cd683d', '#e6904e'], finger: RAMP.brass.slice(1, 5) },
  arm_fast: { plate: RAMP.brass.slice(0, 5), ring: RAMP.gold, seg: ['#9e4539', '#cd683d', '#f79617', '#f9c22b'], finger: RAMP.iron.slice(1, 5) },
  arm_long: { plate: RAMP.brass.slice(0, 5), ring: RAMP.rose, seg: RAMP.rose, finger: RAMP.iron.slice(1, 5) },
  arm_filter: { plate: RAMP.brass.slice(0, 5), ring: RAMP.purple, seg: RAMP.purple, finger: RAMP.iron.slice(1, 5) },
  arm_bulk: { plate: RAMP.brass.slice(0, 5), ring: RAMP.blue, seg: RAMP.blue, finger: RAMP.iron.slice(1, 5) },
};
/** where the arm's shoulder sits on the 16x16 base (the mainspring's arbor) */
export const ARBOR = [8, 8];

export function img(w, h) { return { w, h, px: new Array(w * h).fill(null) }; }
export const get = (im, x, y) => (x < 0 || y < 0 || x >= im.w || y >= im.h ? null : im.px[y * im.w + x]);
export const put = (im, x, y, c) => { if (x >= 0 && y >= 0 && x < im.w && y < im.h) im.px[y * im.w + x] = c; };
export function outline(im) {
  const o = img(im.w, im.h);
  o.px = im.px.slice();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (get(im, x, y) !== null) continue;
    if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => get(im, x + dx, y + dy) !== null)) put(o, x, y, INK);
  }
  return o;
}
export function mirrorX(im) {
  const o = img(im.w, im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) put(o, im.w - 1 - x, y, get(im, x, y));
  return o;
}
/** a grid of characters -> image via a colour map */
export function grid(rows, col) {
  const im = img(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch]) put(im, x, y, col[ch]); }));
  return im;
}

// ---------------------------------------------------------------------------------------------
// The base: a round turntable whose top is the mainspring barrel (a steel spiral around the brass
// arbor), the kind's colour on the rim. Arbor (shoulder pivot) at ARBOR.
// ---------------------------------------------------------------------------------------------
/** the mainspring: an Archimedean spiral, squashed for the 3/4 view (the gleaner's gold-on-plum spring) */
const SPRING = { a: 1.6, b: 0.6, q: 0.66, turns: 1.6, ox: 7.5, oy: 7.6 };
export function drawArmBase(id) {
  const A = ARM[id];
  const P = A.plate, R = A.ring;
  const im = img(16, 16);
  const cx = 8, cy = 8, rx = 6.7, ry = 4.8, face = 1, ringW = 1.15;
  const inTop = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const inBody = (x, y) => { for (let k = 0; k <= face; k++) if (inTop(x, y - k)) return true; return false; };
  const inFloor = (x, y) => ((x + 0.5 - cx) / (rx - ringW)) ** 2 + ((y + 0.5 - cy) / (ry - ringW * 0.8)) ** 2 <= 1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!inBody(x, y)) continue;
    if (!inTop(x, y)) { put(im, x, y, x + 0.5 < cx - 2 ? P[2] : x + 0.5 < cx + 3 ? P[1] : P[0]); continue; }
    if (!inFloor(x, y)) {
      // the rim in the kind's colour, lit on the upper left
      const sh = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry;
      put(im, x, y, sh < -0.35 ? R[3] : sh > 0.55 ? R[0] : R[1]);
    } else put(im, x, y, '#45293f');
  }
  // the spring, gold on the plum barrel floor
  const { a, b, q, turns, ox, oy } = SPRING;
  const seen = new Set();
  for (let th = 0; th <= turns * 2 * Math.PI; th += 0.01) {
    const r = a + b * th;
    const x = Math.floor(ox + Math.cos(th) * r), y = Math.floor(oy + Math.sin(th) * r * q);
    if (seen.has(x * 16 + y) || !inFloor(x, y)) continue;
    seen.add(x * 16 + y);
    put(im, x, y, Math.cos(th) + Math.sin(th) < 0 ? RAMP.brass[2] : RAMP.brass[1]);
  }
  // front face bolts
  for (const x of [4, 8, 11]) if (get(im, x, 12) && !inTop(x, 12)) put(im, x, 12, P[4]);
  // arbor cap (the shoulder) at ARBOR: brass, lit top-left
  const [ax, ay] = ARBOR;
  put(im, ax - 1, ay - 1, RAMP.brass[5]); put(im, ax, ay - 1, RAMP.brass[4]);
  put(im, ax - 1, ay, RAMP.brass[3]); put(im, ax, ay, RAMP.brass[2]);
  return outline(im);
}

// ---------------------------------------------------------------------------------------------
// Claws: a C-shaped pincer, wrist hub in the kind colour, two curved fingers. Drawn as masks for
// E, SE and S (and their mirrors), shaded per pixel from the upper left.
// ---------------------------------------------------------------------------------------------
// H hub, F finger, P pin (brass). Origin (4,4) is the wrist (the hub centre).
const CLAW_MASK = {
  E: {
    0: ['.........', '....FFF..', '..HHF..F.', '.HHHH....', '.HHPH....', '.HHHH....', '..HHF..F.', '....FFF..', '.........'],
    1: ['.........', '.........', '..HHFFF..', '.HHHH..F.', '.HHPH..F.', '.HHHH..F.', '..HHFFF..', '.........', '.........'],
  },
  SE: {
    0: ['.........', '.HHH.....', '.HHHH.F..', '.HHPHF.F.', '..HHH...F', '...F.....', '..F...F..', '...FF....', '.........'],
    1: ['.........', '.HHH.....', '.HHHHF...', '.HHPH.F..', '..HHH..F.', '..F...F..', '...F.F...', '....F....', '.........'],
  },
  S: {
    0: ['.........', '..HHHHH..', '..HHPHH..', '..HHHHH..', '.F.HHH.F.', '.F.....F.', '.F.....F.', '..F...F..', '.........'],
    1: ['.........', '..HHHHH..', '..HHPHH..', '..HHHHH..', '..FHHHF..', '..F...F..', '..F...F..', '...FFF...', '.........'],
  },
};
function transpose(rows) { return rows[0].split('').map((_, x) => rows.map((r) => r[x]).join('')); }
function flipV(rows) { return rows.slice().reverse(); }
function flipH(rows) { return rows.map((r) => [...r].reverse().join('')); }
/** dir in the game's rotation order: 0 N, 1 E, 2 S, 3 W (the way the jaws open) */
export function clawMask(dir, s) {
  const E = CLAW_MASK.E[s], S = CLAW_MASK.S[s];
  return [flipV(S), E, S, flipH(E)][dir & 3];
}
function shadeMask(rows, map) {
  // map: ch -> ramp [dark, base, light]; lit where the neighbour up or left is outside the part
  const h = rows.length, w = rows[0].length;
  const im = img(w, h);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = at(x, y);
    const ramp = map[ch];
    if (!ramp) continue;
    if (!Array.isArray(ramp)) { put(im, x, y, ramp); continue; }
    const same = (c) => c === ch || (ch !== 'P' && c === 'P');
    const up = !same(at(x, y - 1)), left = !same(at(x - 1, y)), down = !same(at(x, y + 1)), right = !same(at(x + 1, y));
    let c = ramp[1];
    if ((up || left) && !(down && right)) c = ramp[2];
    else if ((down || right) && !(up || left)) c = ramp[0];
    put(im, x, y, c);
  }
  return outline(im);
}
export function drawClaw(id, s, dir) {
  const A = ARM[id];
  const m = clawMask(dir, s);
  return shadeMask(m, { H: [A.ring[0], A.ring[1], A.ring[3] ?? A.ring[2]], F: [A.finger[0], A.finger[1], A.finger[3]], P: RAMP.brass[4] });
}

// ---------------------------------------------------------------------------------------------
// The winding key (vertical stem, butterfly bow) turning: broad, three-quarter, edge, three-quarter
// (the last mirrored). Origin = the stem's foot (bottom centre).
// ---------------------------------------------------------------------------------------------
const KEY = [
  ['.OO.OO.', 'OYyOyyO', 'OyyOydO', '.OOyOO.', '..OYO..', '..OyO..', '..OOO..'],
  ['..OOO..', '.OYyyO.', '.OyydO.', '..OyO..', '..OYO..', '..OyO..', '..OOO..'],
  ['...O...', '..OYO..', '..OyO..', '..OdO..', '..OYO..', '..OyO..', '..OOO..'],
  ['..OOO..', '.OyyYO.', '.OdyyO.', '..OyO..', '..OYO..', '..OyO..', '..OOO..'],
];
export function drawKey(f, ramp = RAMP.brass) {
  return grid(KEY[f & 3], { O: INK, y: ramp[3], Y: ramp[5], d: ramp[2], '.': null });
}
export const KEY_ORIGIN = [3, 6];
/**
 * The key as seen on a toy's back: the shaft sticks out sideways, the bow upright (two lobes and a
 * pinched waist, the classic wind-up profile). armh:key:<f>:1 points east (shaft root at the left, origin [0, 4]), :3 points west (root
 * at the right, origin [8, 4]); both lit from the upper left, not mirrored copies.
 */
const SIDE_KEY = {
  1: [
    ['....OOO..', '...OYyyO.', '...OyyyO.', 'OOOOOydO.', 'OssssyO..', 'OOOOOyO..', '...OyyyO.', '...OyddO.', '....OOO..'],
    ['....OO...', '...OYyO..', '...OyyO..', 'OOOOOyO..', 'OssssyO..', 'OOOOOyO..', '...OydO..', '...OddO..', '....OO...'],
    ['....O....', '...OYO...', '...OyO...', 'OOOOyO...', 'OsssyO...', 'OOOOyO...', '...OyO...', '...OdO...', '....O....'],
    ['....OO...', '...OyYO..', '...OyyO..', 'OOOOOyO..', 'OssssyO..', 'OOOOOyO..', '...OdyO..', '...OddO..', '....OO...'],
  ],
  3: [
    ['..OOO....', '.OYyyO...', '.OyyyO...', '.OdyOOOOO', '..OyssssO', '..OyOOOOO', '.OyyyO...', '.OyddO...', '..OOO....'],
    ['...OO....', '..OYyO...', '..OyyO...', '..OyOOOOO', '..OyssssO', '..OyOOOOO', '..OydO...', '..OddO...', '...OO....'],
    ['....O....', '...OYO...', '...OyO...', '...OyOOOO', '...OysssO', '...OyOOOO', '...OyO...', '...OdO...', '....O....'],
    ['...OO....', '..OyYO...', '..OyyO...', '..OyOOOOO', '..OyssssO', '..OyOOOOO', '..OdyO...', '..OddO...', '...OO....'],
  ],
};
export function drawSideKey(f, side, ramp = RAMP.brass) {
  return grid(SIDE_KEY[side][f & 3], { O: INK, y: ramp[3], Y: ramp[5], d: ramp[2], s: ramp[4], '.': null });
}
export const SIDE_KEY_ORIGIN = { 1: [0, 4], 3: [8, 4] };

// ---------------------------------------------------------------------------------------------
// The motor coil of the powered arms: a copper winding on a brass spindle; lit frames turn.
// ---------------------------------------------------------------------------------------------
const COIL = [
  '.OOOOO.',
  'ObBbbbO',
  'OCcccCO',
  'OkkkkkO',
  'OCcccCO',
  '.OOOOO.',
];
/** f 0 idle (dull), 1..3 powered: a spark runs round the winding */
export function drawCoil(f) {
  const lit = f > 0;
  const map = { O: INK, b: RAMP.brass[3], B: RAMP.brass[5], C: RAMP.copper[3], c: lit ? RAMP.copper[3] : RAMP.copper[2], k: RAMP.copper[1] };
  const im = grid(COIL, map);
  if (lit) {
    // the spark: a bright pixel stepping along the winding
    const spots = [[1, 2], [3, 4], [5, 2]];
    const [x, y] = spots[(f - 1) % 3];
    put(im, x, y, RAMP.brass[5]);
  }
  return im;
}
export const COIL_ORIGIN = [3, 5];
