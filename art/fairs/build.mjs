// The town square's festival pieces (ROADMAP 7.7), drawn pixel by pixel at their exact in-game size:
//
//   fair:plate          102x102 [3,3]   the Sprocket Fair's 6x6 test plate, flat on the plaza at the
//                                       plate's top-left tile: flagstones in a grid of riveted iron
//                                       straps every 16 px, a 3 px brass rim with corner bolts
//   fair:banner:<f>      64x32  [32,32] the Fair's banner on two brass poles, a cog emblem, bunting;
//                                       f 0-1 the cloth and the pennants stir
//   haul:stall:<k>:<f>   32x40  [0,24]  a Harvest Haul market stall: a 2x1-tile counter (the bottom
//                                       32x16) under a striped awning on two posts, front-facing in
//                                       3/4 view; k 0 produce in crates, 1 preserves (jars, crocks),
//                                       2 machine parts (gears, springs, coils), 3 flour sacks and
//                                       loaves; f 0-1 the awning's scallops stir
//   haul:podium:<f>      32x40  [0,24]  the Mayor's auction podium: a raised wooden stand with a
//                                       lectern, a brass bell and bunting; f 0-1 the bunting stirs
//
// Why by script: these are rule-bound (a 16 px grid that must line up with the plaza's tiles, stripes
// and scallops that repeat exactly, two-frame loops where only the cloth moves), and every colour is
// picked from the STYLE.md ramps. 0 generations.
//
// Usage: node art/fairs/build.mjs   -> art/fairs/sheet.png + art/fairs/sprites.json (recipe),
//                                      e2e/out/fairs-build.png (x3 preview on the plaza's cobbles)
// Then: node scripts/sprites-import.mjs art/fairs/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, INK } from '../factory/gen/lib.mjs';
import { PAL } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------------------------------------------------------------- ramps (Resurrect 64)
const BRASS = ['#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'];
const WOOD = ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'];
const IRON = ['#3e3546', '#625565', '#7f708a', '#9babb2'];
const STONE = { dark: '#694f62', base: '#966c6c', lit: '#ab947a', crack: '#625565' };

/** deterministic hash in [0, 1) */
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** paint a character grid at (x0, y0); '.' and ' ' are skipped */
function stamp(im, x0, y0, rows, legend) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || ch === ' ') return;
    if (!(ch in legend)) throw new Error('legend ' + ch);
    im.set(x0 + i, y0 + j, legend[ch]);
  }));
  return im;
}

const out = []; // { name, im, origin }
const add = (name, im, origin) => out.push({ name, im, origin });

// ================================================================ fair:plate (102x102, [3,3])
// Frame x/y 3..98 is the 6x6 plate; 0..2 and 99..101 the rim. Each 16 px cell is a flagstone; the
// grid is iron straps two pixels wide on the cell lines (lit on the side toward the light, dark on
// the other, so each seam reads as a raised strap) with a brass rivet where straps cross. Next to
// the rim the plate's edge falls in the rim's shadow (top, left) or catches its lit inner face
// (bottom, right), as the straps do.
function plate() {
  const N = 6, T = 16, O = 3, W = N * T + 2 * O;
  const im = new Img(W, W);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = O + i * T, y0 = O + j * T;
    // the flagstone: flat stone with a few two-pixel specks (mica and pits), now and then a crack
    for (let v = 1; v < T - 1; v++) for (let u = 1; u < T - 1; u++) im.set(x0 + u, y0 + v, STONE.base);
    for (let v = 2; v < T - 2; v++) for (let u = 2; u < T - 3; u++) {
      const r = hash(x0 + u, y0 + v, 7);
      if (r < 0.02 && im.get(x0 + u - 1, y0 + v) === STONE.base && im.get(x0 + u + 2, y0 + v) === STONE.base) {
        const c = r < 0.01 ? STONE.dark : STONE.lit;
        im.set(x0 + u, y0 + v, c); im.set(x0 + u + 1, y0 + v, c);
      }
    }
    if (hash(i, j, 3) < 0.3) {
      // a hairline crack running down from the top edge, its upper-left lip catching the light
      let x = x0 + 3 + Math.floor(hash(i, j, 4) * 9), y = y0 + 1;
      const len = 4 + Math.floor(hash(i, j, 5) * 5);
      for (let k = 0; k < len; k++) {
        im.set(x, y, STONE.dark);
        if (im.get(x - 1, y) === STONE.base) im.set(x - 1, y, STONE.lit);
        y++;
        if (hash(x, y, 6) < 0.45) x += hash(x, y, 8) < 0.5 ? -1 : 1;
        x = Math.max(x0 + 2, Math.min(x0 + T - 3, x));
      }
    }
    // straps: the cell's right column and bottom row are the strap's lit half (its face toward the
    // light), its left column and top row the strap's shadow falling on this stone
    for (let k = 0; k < T; k++) {
      im.set(x0 + k, y0, IRON[0]); im.set(x0, y0 + k, IRON[0]);
      im.set(x0 + k, y0 + T - 1, IRON[2]); im.set(x0 + T - 1, y0 + k, IRON[2]);
    }
    im.set(x0, y0 + T - 1, IRON[1]); im.set(x0 + T - 1, y0, IRON[1]);
  }
  // brass rivets where the straps cross (2x2, lit top-left)
  for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
    const x = O + i * T - 1, y = O + j * T - 1;
    im.set(x, y, BRASS[3]); im.set(x + 1, y, BRASS[2]); im.set(x, y + 1, BRASS[2]); im.set(x + 1, y + 1, BRASS[0]);
  }
  // the rim, 3 px: on the lit top and left an edge in the brass's darkest shade, a highlight, brass;
  // on the bottom and right brass, the rim's front face in shade, and the plum outline
  for (let k = 0; k < W; k++) {
    im.set(k, 0, BRASS[0]); im.set(k, 1, BRASS[3]); im.set(k, 2, BRASS[2]);
    im.set(0, k, BRASS[0]); im.set(1, k, BRASS[3]); im.set(2, k, BRASS[2]);
  }
  for (let k = 1; k < W; k++) {
    im.set(k, W - 3, BRASS[2]); im.set(k, W - 2, BRASS[1]);
    im.set(W - 3, k, BRASS[2]); im.set(W - 2, k, BRASS[1]);
  }
  for (let k = 0; k < W; k++) { im.set(k, W - 1, INK); im.set(W - 1, k, INK); }
  // the rim's top and left faces stop where the bottom and right faces turn the corner
  im.set(W - 2, 1, BRASS[2]); im.set(W - 2, 2, BRASS[2]); im.set(1, W - 2, BRASS[2]); im.set(2, W - 2, BRASS[1]);
  // corner plates: a riveted brass square on each corner of the rim (5x5 inside the outline)
  const CORNER = [
    'aaaab',
    'abbbc',
    'abrsc',
    'absdc',
    'bcccd',
  ];
  const col = { a: BRASS[3], b: BRASS[2], c: BRASS[1], d: BRASS[0], r: '#fbff86', s: BRASS[1] };
  for (const [x, y] of [[0, 0], [W - 5, 0], [0, W - 5], [W - 5, W - 5]]) stamp(im, x, y, CORNER, col);
  // the outline closes round the corner plates on the shadow sides
  for (let k = 0; k < W; k++) { im.set(k, W - 1, INK); im.set(W - 1, k, INK); }
  return im;
}
add('fair:plate', plate(), [3, 3]);

// ================================================================ haul:stall:<k>:<f> (32x40, [0,24])
// Frame rows 24-39 are the 2x1-tile footprint. Back to front: two posts, the goods standing on the
// counter's top, the counter (top board, a lit lip, a planked front on a dark plinth), and over it
// all the awning: a striped roof sloping toward you, its valance and a row of scallops, one per
// stripe. f 1 ripples the scallops (every other one drops a pixel); nothing else moves.
const CREAM = ['#966c6c', '#ab947a', '#fdcbb0'];
const AWNING = [
  ['#165a4c', '#239063', '#1ebc73'], // 0 produce: leaf green
  ['#a24b6f', '#cf657f', '#ed8099'], // 1 preserves: rose
  ['#484a77', '#4d65b4', '#4d9be6'], // 2 machine parts: blue
  ['#b33831', '#ea4f36', '#f57d4a'], // 3 flour and bread: brick red
];
const SW = 6; // stripe width: five stripes across the awning
/** the posts and the booth's back wall of dark planks, behind the goods */
function booth(im) {
  for (let y = 12; y <= 27; y++) for (let x = 4; x <= 27; x++) im.set(x, y, (x - 4) % 6 === 5 ? WOOD[0] : WOOD[1]);
  for (const x of [2, 28]) for (let y = 8; y <= 27; y++) { im.set(x, y, WOOD[3]); im.set(x + 1, y, WOOD[2]); }
}
function counter(im) {
  // the top board, seen from above: back plank in shade, front plank lit, a lit lip
  im.hline(1, 30, 27, WOOD[2]); im.hline(1, 30, 28, WOOD[3]); im.hline(1, 30, 29, WOOD[3]);
  for (const x of [9, 22]) im.set(x, 28, WOOD[2]);
  im.hline(1, 30, 30, WOOD[4]);
  // the planked front: lit top row, planks with dark seams every 5 px, a darker right end
  for (let y = 31; y <= 37; y++) for (let x = 1; x <= 30; x++) im.set(x, y, (x - 1) % 5 === 4 ? WOOD[1] : y === 31 ? WOOD[3] : WOOD[2]);
  for (let y = 31; y <= 37; y++) { im.set(1, y, WOOD[3]); im.set(30, y, WOOD[1]); }
  for (const x of [1, 2, 29, 30]) { im.set(x, 32, BRASS[2]); im.set(x, 36, BRASS[1]); }
  for (let x = 3; x <= 28; x += 5) im.set(x, 32, WOOD[4]);
  im.hline(1, 30, 38, WOOD[0]);
}
/** the awning in colour ramp A with cream stripes (x 1-30, five stripes of 6 px: colour, cream,
 *  colour, cream, colour), the plum outline round it; f 1 blows the scallops' tips a pixel east */
function awning(im, A, f) {
  const X0 = 1, X1 = 30;
  const stripe = (x) => Math.floor((x - X0) / SW);
  const colour = (x) => stripe(x) % 2 === 0;
  for (let x = X0; x <= X1; x++) {
    const a = colour(x);
    // the roof, rows 2-7: lit along the back, the stripe's base down the slope
    im.set(x, 2, a ? A[2] : CREAM[2]);
    for (let y = 3; y <= 7; y++) im.set(x, y, a ? A[1] : CREAM[2]);
    // the rolled front edge (lit) and the valance under it (a shade down: it faces you)
    im.set(x, 8, a ? A[2] : CREAM[2]);
    for (let y = 9; y <= 11; y++) im.set(x, y, a ? A[1] : CREAM[1]);
  }
  // the cloth's ribs: a fold down the right edge of each colour stripe, the cream ones' in shade
  for (let x = X0; x <= X1; x++) if ((x - X0) % SW === SW - 1) for (let y = 3; y <= 7; y++) im.set(x, y, colour(x) ? A[0] : CREAM[1]);
  // rounded back corners and the ridge pole
  im.set(X0, 2, null); im.set(X1, 2, null);
  im.hline(X0 + 1, X1 - 1, 1, WOOD[3]); im.set(X0 + 1, 1, WOOD[4]); im.set(X1 - 1, 1, WOOD[2]);
  // scallops: a rounded lobe under each stripe, three rows; f 1 blows the lower two east a pixel
  const s0 = f === 1 ? 1 : 0;
  for (let s = 0; s < 5; s++) {
    const x0 = X0 + s * SW, a = s % 2 === 0;
    const [dk, md] = a ? [A[0], A[1]] : [CREAM[0], CREAM[1]];
    for (let x = x0; x < x0 + SW; x++) im.set(x, 12, x === x0 + SW - 1 ? dk : md);
    for (let x = x0 + 1; x < x0 + SW - 1; x++) im.set(Math.min(X1, x + s0), 13, x === x0 + SW - 2 ? dk : md);
    for (let x = x0 + 2; x < x0 + SW - 2; x++) im.set(Math.min(X1, x + s0), 14, dk);
  }
}

// ---- the goods: little sprites as character grids (K the plum outline), set on the counter
const GL = {
  K: INK,
  1: WOOD[0], 2: WOOD[1], 3: WOOD[2], 4: WOOD[3], 5: WOOD[4],
  o: '#fb6b1d', O: '#f79617', p: '#cd683d', P: '#9e4539', // pumpkin
  r: '#ea4f36', R: '#f57d4a', q: '#b33831', Q: '#fca790', // apples, copper
  g: '#239063', h: '#1ebc73', i: '#91db69', j: '#165a4c', // greens
  u: '#f9c22b', v: '#fbff86', // gold
  l: '#9babb2', m: '#c7dcd0', n: '#7f708a', k: '#3e3546', L: '#625565', // glass, iron
  a: '#fbb954', b: '#e6904e', // honey
  c: '#6b3e75', d: '#905ea9', // plum jam
  e: '#966c6c', f: '#ab947a', F: '#fdcbb0', // crock, cloth, sacks
  s: '#9e4539', t: '#f79617', T: '#f9c22b', // brass
};
const SPR = {
  pumpkin: [
    '...gj...',
    '.KKgjKK.',
    'KOOoOooK',
    'KOoOoopK',
    'KoOoopPK',
    '.KppPPK.',
    '..KKKK..',
  ],
  crate: [
    'K55555555K',
    'K44444444K',
    'K22222222K',
    'K43444434K',
    'KKKKKKKKKK',
  ],
  apples: [
    '..KK.KK.K.',
    '.KRrKRrKgK',
    'KRrqKrqRrK',
    'KrqRrKRrqK',
  ],
  cabbages: [
    '.KKK.KKK.',
    'KihhKhihK',
    'KhgjKigjK',
    'KjgjKjjgK',
    '.KKK.KKK.',
  ],
  jar: [
    '.KKK.',
    'KFFfK',
    '.KnK.',
    'KmuaK',
    'KlabK',
    'KlbbK',
    '.KKK.',
  ],
  jarJam: [
    '.KKK.',
    'KFFfK',
    '.KnK.',
    'KmdcK',
    'KldcK',
    'KlccK',
    '.KKK.',
  ],
  jarPickle: [
    '.KKK.',
    'KFFfK',
    '.KnK.',
    'KmhgK',
    'KlgjK',
    'KljjK',
    '.KKK.',
  ],
  crock: [
    '..KKK..',
    '.KfFfK.',
    'KFFFffK',
    'KF2222K',
    'KFfffeK',
    'KffeeeK',
    '.KKKKK.',
  ],
  gear: [
    '..K.K.K..',
    '.KTKTKtK.',
    'KTTtttttK',
    '.KtsKKtsK',
    'KTtK.KtsK',
    '.KtsKKssK',
    'KtttssssK',
    '.KtKsKsK.',
    '..K.K.K..',
  ],
  spring: [
    '.KKKK.',
    'KllnLK',
    '.KKKKK',
    'KllnLK',
    'KKKKK.',
    'KllnLK',
    '.KKKK.',
  ],
  coil: [
    '.KKKKKK.',
    'K455443K',
    '.KRRrqK.',
    '.KrrqqK.',
    '.KRRrqK.',
    '.KrrqqK.',
    'K433332K',
    '.KKKKKK.',
  ],
  sack: [
    '...KK...',
    '..K33K..',
    '.KFKKfK.',
    'KFFFFffK',
    'KFFFFfeK',
    'KFFFffeK',
    'KfFffeeK',
    '.KKKKKK.',
  ],
  loaf: [
    '..KKKKK..',
    '.KbabbaK.',
    'KbapbappK',
    'KbbppbpPK',
    'KppppPPPK',
    '.KKKKKKK.',
  ],
  board: [
    'K5555555555K',
    'K3333333333K',
    'KKKKKKKKKKKK',
  ],
};
/** place sprite rows with their bottom row on frame row `by`, left edge at x */
const put = (im, name, x, by) => stamp(im, x, by - SPR[name].length + 1, SPR[name], GL);
const GOODS = [
  // 0 produce: a crate of pumpkins, a crate heaped with red apples, cabbages in front
  (im) => {
    put(im, 'crate', 4, 28); put(im, 'pumpkin', 5, 24); put(im, 'pumpkin', 9, 23);
    put(im, 'crate', 15, 28); put(im, 'apples', 15, 24);
    put(im, 'cabbages', 19, 28);
  },
  // 1 preserves: honey, plum jam and pickle jars round a crock
  (im) => {
    put(im, 'jar', 5, 28); put(im, 'jarJam', 9, 28); put(im, 'crock', 14, 28); put(im, 'jarPickle', 21, 28); put(im, 'jar', 7, 22);
  },
  // 2 machine parts: a brass gear on edge, springs, a copper coil
  (im) => {
    put(im, 'gear', 4, 28); put(im, 'spring', 13, 28); put(im, 'spring', 17, 27); put(im, 'coil', 21, 28);
  },
  // 3 flour and bread: two flour sacks, loaves on a board
  (im) => {
    put(im, 'sack', 4, 28); put(im, 'sack', 10, 27); put(im, 'board', 16, 28); put(im, 'loaf', 16, 26); put(im, 'loaf', 19, 23);
  },
];
function stall(k, f) {
  const im = new Img(32, 40);
  booth(im);
  counter(im);
  GOODS[k](im);
  awning(im, AWNING[k], f);
  return im.outline(INK);
}
for (let k = 0; k < 4; k++) for (let f = 0; f < 2; f++) add(`haul:stall:${k}:${f}`, stall(k, f), [0, 24]);

// ================================================================ haul:podium:<f> (32x40, [0,24])
// The Mayor's auction podium: a raised plank stage on the footprint, a lectern on the left with the
// auction book open on its slope and a brass cog on its front, a brass bell hanging from a gallows
// post on the right, and a string of bunting along the stage's front; f 1 the pennants swing east.
const PENNANT = [['#ae2334', '#e83b3b'], ['#cd683d', '#f9c22b'], ['#165a4c', '#1ebc73'], ['#484a77', '#4d9be6'], ['#a24b6f', '#cf657f']];
function podium(f) {
  const im = new Img(32, 40);
  // the bell's gallows on the right: a post, an arm, a brace
  for (let y = 5; y <= 26; y++) { im.set(27, y, WOOD[3]); im.set(28, y, WOOD[1]); }
  im.hline(19, 28, 5, WOOD[4]); im.hline(19, 28, 6, WOOD[2]);
  im.set(26, 7, WOOD[2]); // brace
  // the bell: a brass dome on a yoke, lit upper left, the lip flared, the clapper below
  stamp(im, 19, 7, [
    '...c...',
    '..dcb..',
    '..dcb..',
    '.ddcbb.',
    '.dccba.',
    'dccbbba',
    '...e...',
  ], { a: BRASS[0], b: BRASS[1], c: BRASS[2], d: BRASS[3], e: IRON[0] });
  // the stage: a plank top seen from above, a lit lip, a planked front on a dark plinth
  for (let y = 25; y <= 28; y++) for (let x = 1; x <= 30; x++) im.set(x, y, y === 25 ? WOOD[2] : (x % 8 === 7 ? WOOD[2] : WOOD[3]));
  im.hline(1, 30, 29, WOOD[4]);
  for (let y = 30; y <= 37; y++) for (let x = 1; x <= 30; x++) im.set(x, y, (x - 1) % 6 === 5 ? WOOD[1] : WOOD[2]);
  for (let y = 30; y <= 37; y++) { im.set(1, y, WOOD[3]); im.set(30, y, WOOD[1]); }
  im.hline(1, 30, 38, WOOD[0]);
  for (const x of [1, 2, 29, 30]) { im.set(x, 31, BRASS[2]); im.set(x, 36, BRASS[1]); }
  // the lectern: a slanted top with the open auction book, a panelled front with a brass cog
  stamp(im, 5, 13, [
    'KKKKKKKKKKKK',
    'K55FFFFFF55K',
    'K4FFFfFFFf4K',
    'KK44444444KK',
    '.K43333334K.',
    '.K433TT334K.',
    '.K43TttT34K.',
    '.K43TttT34K.',
    '.K433TT334K.',
    '.K43333334K.',
    '.K43333334K.',
    'KK44444444KK',
    'K2222222222K',
  ], { K: INK, 2: WOOD[1], 3: WOOD[2], 4: WOOD[3], 5: WOOD[4], F: '#fdcbb0', f: '#ab947a', T: BRASS[3], t: BRASS[1] });
  // bunting along the front: a cord and five pennants, each lit on its left
  im.hline(1, 30, 30, WOOD[0]);
  for (let p = 0; p < 5; p++) {
    const x0 = 2 + p * 6, [dk, lt] = PENNANT[p];
    const sw = f === 1 ? 1 : 0;
    for (let x = x0; x < x0 + 5; x++) im.set(x, 31, x < x0 + 2 ? lt : dk);
    for (let x = x0 + 1; x < x0 + 4; x++) im.set(x + sw, 32, x === x0 + 1 ? lt : dk);
    im.set(x0 + 2 + sw, 33, dk);
  }
  return im.outline(INK);
}
for (let f = 0; f < 2; f++) add(`haul:podium:${f}`, podium(f), [0, 24]);

// ================================================================ fair:banner:<f> (64x32, [32,32])
// The Sprocket Fair's banner: two brass poles with ball finials, a cream cloth hung from a brass rod
// with a deep blue border, a brass cog in the middle, swallowtail points along its foot, and a
// string of bunting sagging between the poles under it. f 1: the points and the pennants stir.
/** a brass cog centred on (cx, cy): body, teeth, a hub hole showing the ground colour, lit upper
 *  left and outlined in the brass's darkest shade */
function cog(im, cx, cy, R, teeth, ground) {
  const inCog = (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (r < 1.6) return false;
    return r <= R - 1.6 || (r <= R && Math.cos(Math.atan2(dy, dx) * teeth) > 0.15);
  };
  const box = [Math.floor(cx - R - 2), Math.floor(cy - R - 2), Math.ceil(cx + R + 2), Math.ceil(cy + R + 2)];
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (inCog(x, y)) {
      // the rim and teeth catch the light on the upper left and fall into shade lower right; the
      // face is plain brass with a darker ring round the hub
      const lit = (dx + dy) / r, rim = r > R - 2.6;
      im.set(x, y, rim && lit < -0.3 ? BRASS[3] : rim && lit > 0.3 ? BRASS[1] : r < 2.7 ? BRASS[1] : BRASS[2]);
    } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => inCog(x + ax, y + ay))) im.set(x, y, r < 2 ? BRASS[0] : BRASS[0]);
    else if (r < 1.6) im.set(x, y, ground);
  }
}
function banner(f) {
  const im = new Img(64, 32);
  const BLUE = ['#323353', '#484a77', '#4d65b4'];
  const CLOTH = ['#ab947a', '#fdcbb0'];
  // poles (lit left, shaded right), ball finials, little feet
  for (const x of [3, 59]) {
    for (let y = 3; y <= 30; y++) { im.set(x, y, BRASS[3]); im.set(x + 1, y, BRASS[1]); }
    stamp(im, x - 1, 0, ['.ba.', 'bcda', '.da.'], { a: BRASS[0], b: BRASS[4], c: BRASS[3], d: BRASS[2] });
    im.hline(x - 1, x + 2, 31, BRASS[1]); im.set(x - 1, 31, BRASS[2]);
  }
  // the rod across the pole tops
  im.hline(5, 58, 4, BRASS[3]); im.hline(5, 58, 5, BRASS[1]);
  // the cloth: rows 6-21, x 8-55; blue border two pixels wide, cream field, two soft folds
  const X0 = 8, X1 = 55, Y0 = 6, Y1 = 21;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const border = x < X0 + 2 || x > X1 - 2 || y < Y0 + 2 || y > Y1 - 1;
    im.set(x, y, border ? (x < X0 + 1 || y < Y0 + 1 ? BLUE[2] : BLUE[1]) : CLOTH[1]);
  }
  for (const fx of [17, 46]) for (let y = Y0 + 2; y <= Y1 - 2; y++) im.set(fx, y, CLOTH[0]);
  // gold trim inside the border
  for (let x = X0 + 2; x <= X1 - 2; x++) { im.set(x, Y0 + 2, BRASS[2]); im.set(x, Y1 - 1, BRASS[1]); }
  for (let y = Y0 + 2; y <= Y1 - 1; y++) { im.set(X0 + 2, y, BRASS[2]); im.set(X1 - 2, y, BRASS[1]); }
  // loops over the rod
  for (let x = X0 + 3; x <= X1 - 3; x += 8) { im.set(x, 5, BLUE[1]); im.set(x + 1, 5, BLUE[0]); }
  // swallowtail points under the cloth: six V points, f 1 sways them a pixel east
  const sw = f === 1 ? 1 : 0;
  for (let p = 0; p < 6; p++) {
    const x0 = X0 + p * 8;
    for (let x = x0; x < x0 + 8; x++) im.set(x, Y1 + 1, BLUE[1]);
    for (let x = x0 + 1; x < x0 + 7; x++) im.set(x + sw, Y1 + 2, x === x0 + 1 ? BLUE[2] : BLUE[1]);
    for (let x = x0 + 2; x < x0 + 6; x++) im.set(x + sw, Y1 + 3, BLUE[0]);
    for (let x = x0 + 3; x < x0 + 5; x++) im.set(x + sw, Y1 + 4, BLUE[0]);
  }
  // the cog emblem in the middle of the field
  cog(im, 32, 14, 5.5, 8, CLOTH[1]);
  // bunting sagging between the poles under the banner
  const sag = (x) => 26 + Math.round(2.5 * Math.sin(((x - 5) / 53) * Math.PI));
  for (let x = 5; x <= 58; x++) im.set(x, sag(x), WOOD[1]);
  for (let p = 0; p < 7; p++) {
    const x0 = 7 + p * 7, [dk, lt] = PENNANT[p % PENNANT.length];
    const y0 = sag(x0 + 2) + 1;
    for (let x = x0; x < x0 + 5; x++) im.set(x, y0, x < x0 + 2 ? lt : dk);
    for (let x = x0 + 1; x < x0 + 4; x++) im.set(x + sw, y0 + 1, x === x0 + 1 ? lt : dk);
    im.set(x0 + 2 + sw, y0 + 2, dk);
  }
  return im.outline(INK);
}
for (let f = 0; f < 2; f++) add(`fair:banner:${f}`, banner(f), [32, 32]);

// ================================================================ output
export { out };

function checkPalette() {
  const pal = new Set(PAL.map((c) => c.toLowerCase()));
  for (const { name, im } of out) for (const c of im.px) if (c && !pal.has(c.toLowerCase())) throw new Error(`${name}: ${c} is not a palette colour`);
}

/** preview: every sprite at x3 on the plaza's cobbles (#ab947a, mortar #625565) and on grass */
function preview(items, file, k = 3) {
  const pad = 6;
  const W = items.reduce((w, it) => w + it.im.w + pad, pad);
  const H = Math.max(...items.map((it) => it.im.h)) * 2 + pad * 3;
  const sheet = new Img(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const top = y < H / 2;
    const mortar = (x % 9 === 0) || ((y + (Math.floor(x / 9) % 2) * 4) % 8 === 0);
    sheet.set(x, y, top ? (mortar ? '#625565' : '#ab947a') : ((x >> 4) + (y >> 4)) % 2 ? '#239063' : '#1ebc73');
  }
  let x = pad;
  for (const it of items) {
    sheet.draw(it.im, x, pad);
    sheet.draw(it.im, x, Math.floor(H / 2) + pad);
    x += it.im.w + pad;
  }
  sheet.save(file, k);
}

/** shelf-pack every frame into art/fairs/sheet.png and write the sprites-import recipe */
function writeSheet() {
  const W = 256, gap = 1;
  let x = 0, y = 0, rowH = 0;
  const rects = [];
  const order = out.map((o, i) => i).sort((a, b) => out[b].im.h - out[a].im.h || a - b);
  for (const i of order) {
    const { im } = out[i];
    if (x + im.w > W) { x = 0; y += rowH + gap; rowH = 0; }
    rects[i] = [x, y, im.w, im.h];
    x += im.w + gap; rowH = Math.max(rowH, im.h);
  }
  const sheet = new Img(W, y + rowH);
  out.forEach((o, i) => sheet.draw(o.im, rects[i][0], rects[i][1]));
  sheet.save(path.join(HERE, 'sheet.png'));
  const recipe = {
    name: 'fairs',
    kind: 'sprites',
    meta: { note: 'The square on festival days (ROADMAP 7.7): the Sprocket Fair test plate and banner, the Harvest Haul stalls and the Mayor\'s podium. Drawn by art/fairs/build.mjs; do not edit by hand.' },
    scale: 1,
    defaults: { file: 'sheet.png', place: 'none', keepStrays: true },
    sprites: out.map((o, i) => ({ match: o.name, rect: rects[i], frame: [o.im.w, o.im.h], origin: o.origin })),
  };
  const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + recipe.sprites.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n ]');
  fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPalette();
  writeSheet();
  const only = process.argv.includes('--only') ? new RegExp(process.argv[process.argv.indexOf('--only') + 1]) : null;
  preview(out.filter((o) => !only || only.test(o.name)), path.join(ROOT, 'e2e/out/fairs-build.png'), +(process.argv.includes('--k') ? process.argv[process.argv.indexOf('--k') + 1] : 3));
  console.log(`${out.length} sprites`);
}
