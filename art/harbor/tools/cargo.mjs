// Export cargo on the pier deck (harbor:cargo:<0-3>): hand-pixeled (0 generations) from one crate,
// one sack and one pallet, stacked by rule so every stage is the same pallet with more on it:
//   0 an empty pallet, 1 two crates and a sack, 2 a full first layer, 3 two layers under a
//   cargo net gathered into a brass lifting ring.
// Frame 32x40, origin (0, 8): the 2x2-tile footprint is the frame's bottom 32 rows.
import { Img, PAL } from './px.mjs';

const O = '#2e222f';
export const CARGO = { w: 32, h: 40, ox: 0, oy: 8 };

const KEY = {
  O,
  e: '#e6904e', c: '#cd683d', b: '#9e4539', j: '#7a3045', k: '#45293f', // wood
  l: '#fdcbb0', s: '#ab947a', m: '#966c6c', d: '#7a3045', t: '#9e4539', x: '#9e4539', // burlap, tie, stamp
  f: '#f79617', g: '#f9c22b', // brass
};

// 12x12: top face rows 0-3, front face rows 3-11; bottom-left at (x, B)
const CRATE = [
  '.OOOOOOOOOO.',
  'OeeeeeeeeecO',
  'OccccccccbbO',
  'OOOOOOOOOOOO',
  'OeccccccccbO',
  'OcbbbbbbbbjO',
  'OcbjjjjjjbjO',
  'OcbbbgbbbbjO',
  'OcbjjjjjjbjO',
  'OcbbbbbbbbjO',
  'OcccccccbbjO',
  '.OOOOOOOOOO.',
];
// 10x10 sack of grain, tied at the neck
const SACK = [
  '...OOOO...',
  '...OssO...',
  '..OttttO..',
  '.OlssssmO.',
  'OllsssssmO',
  'OlssxsssmO',
  'OlsxxxssmO',
  'OsssssmmmO',
  'OmssmmmmdO',
  '.OOOOOOOO.',
];
// 30x10 pallet: deck boards (lit top face), front stringer, three blocks
const PALLET = [
  '.OOOOOOOOOOOOOOOOOOOOOOOOOOOO.',
  'OeeeeeejeeeeeejeeeeeejeeeeeecO',
  'OecccccjecccccjecccccjecccccbO',
  'OecccccjecccccjecccccjecccccbO',
  'OcccccbjcccccbjcccccbjcccccbbO',
  'OOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
  'OccccccccccccccccccccccccccbbO',
  'ObbbbbbbbbbbbbbbbbbbbbbbbbbbjO',
  'OOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
  'ObbjO.......ObbbjO.......ObbjO',
  'OOOOO.......OOOOOO.......OOOOO',
];

function stamp(img, x, y, rows) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') img.set(x + i, y + j, KEY[ch]); }));
}
const place = (img, rows, x, B) => stamp(img, x, B - rows.length + 1, rows);

const PALLET_Y = 29; // pallet rows 29-39
const FRONT = 33;    // base row of the front layer (on the pallet's deck, front edge)
const BACK = 30;     // base row of the back layer
const UP = 8;        // a crate on a crate sits 8 rows higher (its base on the lower one's top edge)

function pallet() {
  const img = new Img(CARGO.w, CARGO.h);
  stamp(img, 1, PALLET_Y, PALLET);
  return img;
}

/** the cargo net: a diamond mesh over the stack (not the pallet), gathered to a ring on top */
function net(img, top, ringX) {
  const mesh = new Img(img.w, img.h);
  for (let y = top + 2; y < PALLET_Y + 2; y++) for (let x = 0; x < img.w; x++) {
    const c = img.get(x, y);
    if (!c || c === O) continue;
    const u = (x + y) % 6, v = (x - y + 60) % 6;
    if (u === 0 && v === 0) mesh.set(x, y, '#ab947a'); // knot
    else if (u === 0 || v === 0) mesh.set(x, y, '#fdcbb0');
  }
  img.blit(mesh, 0, 0);
  // ropes from the ring down to the stack's top corners
  const ring = [ringX, top - 3];
  const corners = [[3, top + 3], [ringX + 7, top + 5]];
  for (const [cx, cy] of corners) {
    let [x0, y0] = ring;
    const dx = Math.abs(cx - x0), dy = Math.abs(cy - y0), sx = cx > x0 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (y0 > ring[1] + 1) img.set(x0, y0, '#fdcbb0');
      if (x0 === cx && y0 === cy) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += 1; }
    }
  }
  // the brass lifting ring
  stamp(img, ringX - 2, ring[1] - 2, ['.OOO.', 'OgfgO', 'Of.fO', 'OffjO', '.OOO.']);
}

export function buildCargo() {
  const frames = [];
  // 0: empty pallet
  frames.push(pallet());
  // 1: a crate front-left, one behind it to the right, a sack front-right
  {
    const img = pallet();
    place(img, CRATE, 15, BACK);
    place(img, CRATE, 2, FRONT);
    place(img, SACK, 18, FRONT);
    frames.push(img);
  }
  // 2: a full first layer: two crates at the back, a crate and two sacks in front
  {
    const img = pallet();
    place(img, CRATE, 4, BACK);
    place(img, CRATE, 16, BACK);
    place(img, CRATE, 1, FRONT);
    place(img, SACK, 13, FRONT);
    place(img, SACK, 21, FRONT);
    frames.push(img);
  }
  // 3: a second layer on top, under a cargo net
  {
    const img = pallet();
    place(img, CRATE, 4, BACK);
    place(img, CRATE, 16, BACK);
    place(img, CRATE, 1, FRONT);
    place(img, CRATE, 13, FRONT);
    place(img, SACK, 21, FRONT);
    place(img, CRATE, 10, BACK - UP);
    place(img, CRATE, 2, FRONT - UP);
    place(img, SACK, 15, FRONT - UP);
    net(img, BACK - UP - 11, 16);
    frames.push(img);
  }
  for (const f of frames) for (const c of f.colors().keys()) if (!PAL.includes(c)) throw new Error('cargo: off-palette ' + c);
  return frames;
}
