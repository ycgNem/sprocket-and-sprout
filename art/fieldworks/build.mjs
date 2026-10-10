// The Field Works (ROADMAP 4.9): gleaner, rails, field gantry (hopper car, bridge, picker head)
// and their item icons, drawn pixel by pixel at their exact in-game size.
//
// Why by hand: the gantry pieces are 112-124 px long and must line up with the rails and the
// 16 px grid exactly; the gleaner has to fit 16 px wide with its arm and key moving between frames
// on a body that never boils. The PixelLab batches in raw/F1 (24 px machines and parts) and raw/F2
// (16 px icons) are the design references (raw/batches.json): drum-and-key gleaner (F1 1, 2, 21),
// hopper wagon heaped with beans (F1 42), A-frame wheeled leg (F1 44), wheeled trolley with a claw
// (F1 50), oil bottles (F2 38-51; the final keeps the i:oil family silhouette instead).
//
// Usage: node --experimental-transform-types art/fieldworks/build.mjs (it reads src/data/palette.ts)
//   -> art/fieldworks/sheet.png + art/fieldworks/sprites.json (recipe for scripts/sprites-import.mjs)
//   -> e2e/out/fieldworks-build.png (x4 preview on grass and soil)
// Then: node scripts/sprites-import.mjs art/fieldworks/sprites.json
// In the game: node art/fieldworks/shots.mjs (e2e/out/fieldworks-game*.png, new and ?art=old)
//
// Names (frame, origin):
//   st:gleaner:*:0:* idle, st:gleaner:<0-3>:1:* working   16x26 [0,10]
//   rail:0 (north-south), rail:1 (east-west)               16x16 [0,0]
//   gantry:car:0[:full]  112x28 [0,12]    gantry:car:1[:full]  20x124 [2,12]
//   gantry:beam:0        112x24 [0,20]    gantry:beam:1        32x124 [8,12]
//   gantry:head:<0-3>    16x16  [0,12]  (trolley meets the girder; see head())
//   i:/ib: gleaner, rail, gantry, cogbean_oil; aliases i:/ib:field_gantry (the item id),
//   st:field_gantry:*:*:* (= car:0, build ghost) and st:rail:*:*:* (= rail:0)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Img, INK, WOOD, BRASS, COPPER, IRON } from '../factory/gen/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------------------------------------------------------------- colors (Resurrect 64 only)
// WOOD   #45293f #7a3045 #9e4539 #cd683d #e6904e      BRASS  #9e4539 #cd683d #f79617 #f9c22b #fbff86
// COPPER #6e2727 #b33831 #ea4f36 #f57d4a #fca790      IRON   #3e3546 #625565 #7f708a #9babb2
const WICKER = ['#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954'];
const LEAF = ['#165a4c', '#239063', '#1ebc73', '#91db69'];
const COG = '#fb6b1d';

/** darkest shade of the material a color belongs to: the lit-edge outline for big objects */
const EDGE = {};
for (const c of WOOD) EDGE[c] = WOOD[0];
for (const c of BRASS) EDGE[c] = BRASS[0];
for (const c of COPPER) EDGE[c] = COPPER[0];
for (const c of IRON) EDGE[c] = INK;
for (const c of WICKER) EDGE[c] = WOOD[0];
for (const c of LEAF) EDGE[c] = LEAF[0];

/** selective outline (STYLE.md, large objects): plum on the bottom and the shadow side, the
 *  material's darkest shade where the outline pixel sits above or left of the art. Only the outer
 *  silhouette is outlined: holes in a lattice stay open, so the ground shows through the truss. */
function outlineSel(im) {
  const outside = new Uint8Array(im.w * im.h);
  const stack = [];
  for (let x = 0; x < im.w; x++) stack.push([x, 0], [x, im.h - 1]);
  for (let y = 0; y < im.h; y++) stack.push([0, y], [im.w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= im.w || y >= im.h || outside[y * im.w + x] || im.get(x, y)) continue;
    outside[y * im.w + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const o = im.clone();
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      if (im.get(x, y) || !outside[y * im.w + x]) continue;
      const below = im.get(x, y + 1), right = im.get(x + 1, y), above = im.get(x, y - 1), left = im.get(x - 1, y);
      if (!below && !right && !above && !left) continue;
      const lit = (below || right) && !above && !left;
      o.px[y * im.w + x] = lit ? EDGE[below ?? right] ?? INK : INK;
    }
  im.px = o.px;
  return im;
}

/** paint a character grid at (x0, y0); '.' and ' ' are skipped */
function stamp(im, x0, y0, rows, legend) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') im.set(x0 + i, y0 + j, legend[ch] ?? (() => { throw new Error('legend ' + ch); })()); }));
  return im;
}

const out = []; // { name, im, origin }
const add = (name, im, origin = [0, 0]) => out.push({ name, im, origin });

// ================================================================ GLEANER (16x26, origin [0,10])
// A dark timber post on a little foot; on top a brass spring barrel seen face-on with its coiled
// spring, the wind-up key out of its left side; a wicker basket hangs on the post's left; a jointed
// brass picking arm on the right. Working: the key spins (bow broad, narrow, edge, narrow) and the
// arm sweeps from high up down to the crops at the foot and back. Idle: arm folded, key broad.
const GLEANER_LEGEND = {
  1: WOOD[0], 2: WOOD[1], 3: WOOD[2], 4: WOOD[3], 5: WOOD[4],
  a: BRASS[0], b: BRASS[1], c: BRASS[2], d: BRASS[3], e: BRASS[4],
  w: WICKER[0], x: WICKER[1], y: WICKER[2], z: WICKER[3], Z: WICKER[4],
  g: LEAF[1], h: LEAF[2], i: LEAF[3], o: COG, K: INK,
  O: COPPER[0], P: COPPER[1], Q: COPPER[2], R: COPPER[3],
};
// spring barrel, 9x9: copper rim around a dark case, the coiled spring in bright brass, hub pin.
// The copper ring keeps the gleaner apart from ripe brass-and-gold crops around it.
const DRUM = [
  '..RRRQQ..',
  '.RQ111QP.',
  'RQ1dddc1O',
  'R1d111c1O',
  'R1d1e1c1O',
  'Q1d1cc11O',
  'Q1cc111PO',
  '.P1111PO.',
  '..PPOOO..',
];
// post planted in the ground with two struts, the barrel on top, a basket of picked beans at its foot
function gleanerBody() {
  const im = new Img(16, 26);
  // post, lit left column, grain marks
  for (let y = 9; y <= 23; y++) { im.set(7, y, WOOD[2]); im.set(8, y, WOOD[1]); im.set(9, y, WOOD[0]); }
  im.set(7, 12, WOOD[3]); im.set(8, 15, WOOD[0]); im.set(7, 17, WOOD[3]);
  // brass band low on the post, darker where it goes into the ground
  stamp(im, 7, 19, ['dcb'], GLEANER_LEGEND);
  im.set(7, 23, WOOD[1]); im.set(8, 23, WOOD[0]);
  // spring barrel and the bracket under it
  stamp(im, 4, 1, DRUM, GLEANER_LEGEND);
  stamp(im, 7, 10, ['dcb'], GLEANER_LEGEND);
  // wicker basket on the ground, heaped with picked beans (one ripe cogbean)
  stamp(im, 1, 16, [
    '.ihi..',
    'ihgoh.',
    'ZZZZzy',
    'zyzzyx',
    'yxyyxw',
    'zyzzyx',
    '.yxxw.',
  ], GLEANER_LEGEND);
  return im;
}
// key on the barrel's left: bow broad / narrow / edge-on / narrow
const KEY = [
  { px: [[1, 3, 'd'], [1, 4, 'c'], [2, 4, 'd'], [1, 5, 'c'], [2, 5, 'c'], [3, 5, 'b'], [1, 6, 'b'], [2, 6, 'c'], [1, 7, 'a']] },
  { px: [[2, 3, 'd'], [2, 4, 'c'], [2, 5, 'c'], [3, 5, 'b'], [2, 6, 'b'], [2, 7, 'a']] },
  { px: [[1, 5, 'd'], [2, 5, 'c'], [3, 5, 'b']] },
  { px: [[2, 3, 'd'], [2, 4, 'c'], [2, 5, 'c'], [3, 5, 'b'], [2, 6, 'b'], [2, 7, 'a']] },
];
// arm poses: shoulder pin on the post at (10, 12), elbow, hand; claw shut, open, picking or carrying a bean
const SHOULDER = [10, 12];
const ARM = {
  idle: { elbow: [13, 15], hand: [12, 19], claw: 'shut' },
  0: { elbow: [13, 9], hand: [14, 5], claw: 'bean' },
  1: { elbow: [14, 13], hand: [14, 18], claw: 'open' },
  2: { elbow: [13, 16], hand: [13, 21], claw: 'pick' },
  3: { elbow: [14, 11], hand: [13, 15], claw: 'bean' },
};
function rod2(im, x0, y0, x1, y1, c, cDark) {
  const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
  const t = new Img(im.w, im.h);
  t.line(x0, y0, x1, y1, c);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (t.get(x, y)) {
    im.set(x, y, c);
    const [qx, qy] = steep ? [x + 1, y] : [x, y + 1];
    if (!t.get(qx, qy)) im.set(qx, qy, cDark);
  }
}
function drawArm(im, pose) {
  const [sx, sy] = SHOULDER, [ex, ey] = pose.elbow, [hx, hy] = pose.hand;
  rod2(im, sx, sy, ex, ey, BRASS[3], BRASS[1]);
  rod2(im, ex, ey, hx, hy, BRASS[3], BRASS[1]);
  im.set(ex, ey, BRASS[1]); // elbow rivet
  im.set(sx, sy, BRASS[4]); // shoulder pin
  const down = hy >= ey ? 1 : -1;
  if (pose.claw === 'shut') { im.set(hx, hy + 1, IRON[2]); }
  if (pose.claw === 'open') { im.set(hx - 1, hy + 1, IRON[3]); im.set(hx + 1, hy + 1, IRON[1]); }
  if (pose.claw === 'pick') { im.set(hx - 1, hy + 1, IRON[3]); im.set(hx + 1, hy + 1, IRON[1]); im.set(hx, hy + 1, LEAF[3]); im.set(hx, hy + 2, LEAF[1]); }
  if (pose.claw === 'bean') { im.set(hx, hy + down, LEAF[3]); im.set(hx + down, hy + down, LEAF[2]); }
}
function gleaner(f) {
  const im = gleanerBody();
  for (const [x, y, ch] of KEY[f === 'idle' ? 0 : f].px) im.set(x, y, GLEANER_LEGEND[ch]);
  drawArm(im, ARM[f]);
  im.outline(INK);
  return im;
}
add('st:gleaner:*:0:*', gleaner('idle'), [0, 10]);
for (let f = 0; f < 4; f++) add(`st:gleaner:${f}:1:*`, gleaner(f), [0, 10]);

// ================================================================ RAIL (16x16 floor piece, origin [0,0])
// Two iron rails on dark timber sleepers, 10 px wide so the soil rows beside it keep their edge.
// rail:0 runs north-south, rail:1 east-west; sleepers every 4 px, so runs tile seamlessly.
// Rail lines (what gantry wheels sit on): x 5 and 10 in rail:0, y 5 and 10 in rail:1.
const RAIL_LINES = [5, 10];
function rail(axis) {
  const im = new Img(16, 16);
  // put(along, across, color): along = position on the running axis, across = across the track
  const put = (along, across, c) => (axis === 0 ? im.set(across, along, c) : im.set(along, across, c));
  // sleepers: 2 px of dark timber, 12 px long; the end toward the light is lit
  for (let k = 0; k < 4; k++) {
    const t = 1 + k * 4;
    for (let s = 2; s <= 13; s++) {
      put(t, s, s === 2 ? WOOD[2] : WOOD[1]);
      put(t + 1, s, s === 2 ? WOOD[1] : WOOD[0]);
    }
  }
  // rails: lit head, darker web on the shaded side
  for (const r of RAIL_LINES) for (let s = 0; s < 16; s++) { put(s, r, IRON[3]); put(s, r + 1, IRON[1]); }
  // a brass tie plate on every other sleeper, so the track reads as made, not drawn
  for (const t of [1, 9]) for (const r of RAIL_LINES) put(t, r - 1, BRASS[2]);
  return im;
}
add('rail:0', rail(0));
add('rail:1', rail(1));

// ================================================================ FIELD GANTRY
// The car (hopper wagon) parks across the rail start; the bridge rides the two rails 7 tiles
// apart; the picker head hangs from the bridge over the crop tile it works.
// Heaped crops in a full hopper: 2x2 beans on a dark green bed (lit upper left), a few ripe
// cogbeans and tomatoes. top(x) gives the heap's top row per column (bumps above the rim).
function heap(im, x0, x1, top, yBottom, seed = 1) {
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let x = x0; x <= x1; x++) for (let y = top(x); y <= yBottom; y++) im.set(x, y, y === top(x) ? LEAF[2] : LEAF[0]);
  for (let y = Math.min(...Array.from({ length: x1 - x0 + 1 }, (_, i) => top(x0 + i))) - 1; y <= yBottom; y += 2)
    for (let x = x0 - 1 + ((y >> 1) % 2); x <= x1; x += 3) {
      const bx = x + (rnd() < 0.5 ? 0 : 1), by = y;
      const v = rnd();
      const [l, m, d] = v < 0.08 ? [BRASS[3], COG, COPPER[1]] : v < 0.13 ? ['#f68181', '#e83b3b', '#ae2334'] : v < 0.55 ? [LEAF[3], LEAF[2], LEAF[1]] : [LEAF[2], LEAF[1], LEAF[0]];
      for (const [dx, dy, c] of [[0, 0, l], [1, 0, m], [0, 1, m], [1, 1, d]]) {
        const px = bx + dx, py = by + dy;
        if (px >= x0 && px <= x1 && py >= top(px) && py <= yBottom) im.set(px, py, c);
      }
    }
}

// ---- gantry:car:0  112x28, origin [0,12]: the wagon spans 7 tiles east-west on north-south rails
function carEW(full) {
  const im = new Img(112, 28);
  const X0 = 2, X1 = 109;
  // hopper: back rim, inside (dark), then the front: brass rim over dark timber planks
  im.hline(X0 + 1, X1 - 1, 2, BRASS[3]);
  im.rect(X0, 3, X1 - X0 + 1, 2, WOOD[1]); // far inner wall in shade
  im.rect(X0, 5, X1 - X0 + 1, 3, WOOD[0]); // hopper floor
  for (let x = X0 + 7; x <= X1; x += 16) im.vline(x, 3, 4, WOOD[2]); // inner ribs
  if (full) heap(im, X0 + 1, X1 - 1, (x) => 3 - Math.round(1 + Math.sin(x * 0.45) + Math.sin(x * 0.13 + 1)), 7, 5);
  im.hline(X0, X1, 8, BRASS[4]);
  im.hline(X0, X1, 9, BRASS[2]);
  im.hline(X0, X1, 10, BRASS[1]);
  for (let y = 11; y <= 16; y++) {
    const inset = Math.floor((y - 11) / 3);
    const plank = (y - 11) % 3 === 2 ? WOOD[0] : (y - 11) % 3 === 0 ? WOOD[2] : WOOD[1];
    im.hline(X0 + inset, X1 - inset, y, plank);
    im.set(X0 + inset, y, WOOD[3]);
  }
  // brass bands on every tile line with rivets, brass corner caps
  for (let x = 16; x < 112; x += 16) {
    im.vline(x - 1, 9, 16, BRASS[3]); im.vline(x, 9, 16, BRASS[2]); im.vline(x + 1, 11, 16, BRASS[1]);
    im.set(x - 1, 12, BRASS[4]); im.set(x - 1, 15, BRASS[4]);
  }
  for (const [x, c] of [[X0, BRASS[3]], [X0 + 1, BRASS[2]], [X1 - 1, BRASS[2]], [X1, BRASS[1]]]) im.vline(x, 8, 16, c);
  // discharge hatch in the middle: copper door with a brass latch (where arms take from)
  im.rect(51, 11, 10, 7, COPPER[2]);
  im.hline(51, 60, 11, COPPER[3]); im.vline(51, 11, 17, COPPER[3]);
  im.hline(52, 60, 17, COPPER[1]); im.vline(60, 12, 17, COPPER[1]);
  im.rect(53, 13, 6, 3, COPPER[1]); im.hline(53, 58, 13, COPPER[0]);
  im.set(55, 15, BRASS[3]); im.set(56, 15, BRASS[2]);
  // chassis: dark timber beam the whole length, brass bolts
  im.hline(1, 110, 17, WOOD[2]);
  im.rect(1, 18, 110, 2, WOOD[1]);
  im.hline(1, 110, 20, WOOD[0]);
  for (let x = 8; x < 112; x += 16) im.set(x, 18, BRASS[3]);
  im.rect(51, 17, 10, 1, COPPER[1]); // hatch lip over the beam
  // wheel trucks on the two end tiles, wheels exactly on the rail lines
  for (const t of [0, 96]) {
    im.rect(t + 3, 21, 10, 2, IRON[1]);
    im.hline(t + 3, t + 12, 21, IRON[2]);
    for (const r of RAIL_LINES) {
      im.vline(t + r, 21, 25, IRON[2]);
      im.vline(t + r + 1, 21, 25, IRON[0]);
      im.set(t + r, 22, IRON[3]);
    }
  }
  return outlineSel(im);
}

// ---- gantry:car:1  20x124, origin [2,12]: the wagon spans 7 tiles north-south on east-west rails
function carNS(full) {
  const im = new Img(20, 124);
  const T = 2, B = 113; // top face rows (the box is 10 px tall: footprint 12..123 seen 10 px higher)
  // rim: west rim lit, east rim shaded, north rim lit, inner walls, floor
  im.rect(2, T, 16, B - T + 1, WOOD[0]);
  im.vline(2, T, B, BRASS[3]); im.vline(17, T, B, BRASS[1]);
  im.hline(2, 17, T, BRASS[4]); im.hline(2, 17, B, BRASS[2]);
  im.vline(3, T + 1, B - 1, WOOD[0]);  // west inner wall, facing east: in shade
  im.vline(16, T + 1, B - 1, WOOD[2]); // east inner wall, facing the light
  im.vline(15, T + 1, B - 1, WOOD[1]);
  im.hline(3, 16, T + 1, WOOD[1]); im.hline(3, 16, T + 2, WOOD[1]); // north inner wall
  // brass ribs across the hopper on every tile line, with a rivet on each rim
  for (let y = T + 16; y < B; y += 16) {
    im.hline(3, 16, y, BRASS[2]); im.hline(4, 16, y + 1, BRASS[0]);
    im.set(2, y, BRASS[4]); im.set(17, y, BRASS[2]);
  }
  if (full) for (let k = 0; k < 7; k++) {
    const y0 = T + 2 + k * 16, y1 = Math.min(B - 1, y0 + 14);
    heap(im, 4, 15, (x) => y0 + (x % 3 === 0 ? 0 : 1), y1, 11 + k);
  }
  // south face: brass plates, copper hatch, chassis
  im.rect(2, B + 1, 16, 6, BRASS[2]);
  im.hline(2, 17, B + 1, BRASS[3]);
  im.vline(2, B + 1, B + 6, BRASS[3]); im.vline(17, B + 1, B + 6, BRASS[1]);
  im.rect(7, B + 2, 6, 5, COPPER[2]); im.hline(7, 12, B + 2, COPPER[3]); im.vline(12, B + 3, B + 6, COPPER[1]);
  im.set(9, B + 4, BRASS[3]); im.set(10, B + 4, BRASS[2]);
  im.hline(2, 17, B + 7, WOOD[2]); im.hline(2, 17, B + 8, WOOD[1]); im.hline(2, 17, B + 9, WOOD[0]);
  // wheels peeking out both sides on each rail line (north and south trucks)
  for (const yr of [12, 108]) for (const r of RAIL_LINES) {
    const y = yr + r - 1;
    for (const x of [0, 18]) { im.rect(x, y, 2, 3, IRON[1]); im.set(x, y, IRON[3]); im.set(x + 1, y + 2, IRON[0]); }
  }
  return outlineSel(im);
}

// ---- gantry:beam:0  112x24, origin [0,20]: the bridge spans east-west, legs on the two rail tiles
function beamEW() {
  const im = new Img(112, 24);
  // legs: tapered lattice towers from under the girder to the wheel truck
  for (const t of [0, 96]) {
    // two posts splaying out toward the truck, an X brace and a cross bar between them
    im.line(t + 5, 8, t + 3, 16, BRASS[3]); im.line(t + 6, 8, t + 4, 16, BRASS[2]);
    im.line(t + 10, 8, t + 12, 16, BRASS[1]); im.line(t + 9, 8, t + 11, 16, BRASS[2]);
    im.line(t + 6, 9, t + 9, 12, BRASS[1]); im.line(t + 9, 9, t + 6, 12, BRASS[2]);
    im.hline(t + 5, t + 10, 13, BRASS[3]); im.hline(t + 5, t + 10, 14, BRASS[1]);
    // wheel truck and wheels on the rail lines
    im.rect(t + 3, 17, 10, 2, IRON[1]); im.hline(t + 3, t + 12, 17, IRON[2]);
    for (const r of RAIL_LINES) { im.vline(t + r, 19, 22, IRON[2]); im.vline(t + r + 1, 19, 22, IRON[0]); im.set(t + r, 19, IRON[3]); }
  }
  // girder: Warren truss, lit top chord, open lattice, bottom chord the trolley runs under
  im.hline(0, 111, 1, BRASS[4]); im.hline(0, 111, 2, BRASS[2]);
  // diagonals: down over 3 px, up over 3 px; the middle step is 2 px wide so no pixel floats
  for (let x = 0; x < 112; x++) {
    const p = x % 6;
    const y = p < 3 ? 3 + p : 8 - p;
    im.set(x, y, p < 3 ? BRASS[2] : BRASS[1]);
    if (p === 1 || p === 4) im.set(x + 1, y, p < 3 ? BRASS[2] : BRASS[1]);
  }
  im.hline(0, 111, 6, BRASS[3]); im.hline(0, 111, 7, BRASS[1]);
  for (let x = 3; x < 112; x += 6) im.set(x, 6, BRASS[4]);
  // end caps over the legs, a copper drive box with its brass gear on the left end
  for (const t of [0, 96]) {
    im.rect(t + 3, 1, 10, 7, BRASS[2]); im.hline(t + 3, t + 12, 1, BRASS[4]); im.vline(t + 3, 2, 7, BRASS[3]); im.vline(t + 12, 2, 7, BRASS[1]); im.hline(t + 3, t + 12, 7, BRASS[1]);
    im.set(t + 5, 3, BRASS[4]); im.set(t + 10, 3, BRASS[4]); im.set(t + 5, 5, BRASS[3]); im.set(t + 10, 5, BRASS[3]);
  }
  im.rect(15, 0, 7, 6, COPPER[2]); im.hline(15, 21, 0, COPPER[3]); im.vline(21, 1, 5, COPPER[1]); im.hline(16, 21, 5, COPPER[1]);
  for (const [x, y] of [[18, 1], [16, 3], [20, 3], [18, 4]]) im.set(x, y, BRASS[3]);
  im.set(18, 3, BRASS[4]);
  // cogbean vine climbing the right leg (industrial botany)
  for (const [x, y, c] of [[100, 16, LEAF[1]], [99, 14, LEAF[2]], [100, 13, LEAF[1]], [101, 12, LEAF[3]], [100, 11, LEAF[2]], [99, 9, LEAF[2]], [98, 10, LEAF[1]], [102, 14, COG]]) im.set(x, y, c);
  return outlineSel(im);
}

// ---- gantry:beam:1  32x124, origin [8,12]: the bridge spans north-south, A-frame legs on the rails
function beamNS() {
  const im = new Img(32, 124);
  const legs = (yTop, yFoot) => {
    // two splayed legs, seen face-on from the south, a cross bar, wheel trucks on the rail lines
    im.line(10, yTop, 3, yFoot, BRASS[3]); im.line(11, yTop, 4, yFoot, BRASS[2]); im.line(12, yTop, 5, yFoot, BRASS[1]);
    im.line(19, yTop, 26, yFoot, BRASS[3]); im.line(20, yTop, 27, yFoot, BRASS[2]); im.line(21, yTop, 28, yFoot, BRASS[1]);
    const yb = Math.round((yTop + yFoot) / 2);
    im.hline(8, 23, yb, BRASS[2]); im.hline(8, 23, yb + 1, BRASS[1]);
    for (const x0 of [1, 24]) {
      im.rect(x0, yFoot, 7, 2, IRON[1]); im.hline(x0, x0 + 6, yFoot, IRON[2]);
      for (const dx of [1, 4]) { im.rect(x0 + dx, yFoot + 2, 2, 2, IRON[2]); im.set(x0 + dx, yFoot + 2, IRON[3]); im.set(x0 + dx + 1, yFoot + 3, IRON[0]); }
    }
  };
  legs(5, 18);     // north rail: lines at frame y 17 and 22
  // girder seen from above: two chords with rungs and diagonals between (open lattice)
  const G0 = 2, G1 = 104;
  // chords at frame x 9-11 and 20-22 (world x +1..3 and +12..14 of the column): the head's
  // trolley wheels (gantry:head, x 1-3 and 12-14) ride on them
  for (let y = G0; y <= G1; y++) {
    im.set(9, y, BRASS[3]); im.set(10, y, BRASS[2]); im.set(11, y, BRASS[1]);
    im.set(20, y, BRASS[3]); im.set(21, y, BRASS[2]); im.set(22, y, BRASS[1]);
  }
  for (let y = G0; y <= G1; y += 8) { im.hline(9, 22, y, BRASS[3]); im.hline(10, 21, y + 1, BRASS[1]); }
  for (let y = G0 + 2; y + 5 <= G1; y += 8) { im.line(12, y, 18, y + 5, BRASS[2]); im.line(13, y, 19, y + 5, BRASS[2]); }
  im.hline(9, 22, G1, BRASS[1]);
  // end plates and the copper drive box at the north end
  im.rect(8, G0, 16, 4, BRASS[2]); im.hline(8, 23, G0, BRASS[4]); im.hline(8, 23, G0 + 3, BRASS[1]);
  im.rect(12, G0 + 4, 8, 5, COPPER[2]); im.hline(12, 19, G0 + 4, COPPER[3]); im.vline(19, G0 + 5, G0 + 8, COPPER[1]);
  im.set(15, G0 + 6, BRASS[4]); im.set(16, G0 + 6, BRASS[3]);
  im.rect(8, G1 - 3, 16, 4, BRASS[2]); im.hline(8, 23, G1 - 3, BRASS[3]); im.hline(8, 23, G1, BRASS[1]);
  legs(G1 - 2, 114); // south rail: lines at frame y 113 and 118
  // cogbean vine on the south-east leg
  for (const [x, y, c] of [[26, 113, LEAF[1]], [25, 111, LEAF[2]], [26, 109, LEAF[3]], [24, 108, LEAF[2]], [25, 106, LEAF[1]], [27, 111, COG]]) im.set(x, y, c);
  return outlineSel(im);
}

// ---- gantry:head:<f>  16x16, origin [0,12]: the trolley rides the girder (wheels at x 1-3 and
// 12-14: on the bottom chord of beam:0, on the two chords of beam:1); the telescopic picker drops
// to the crop and back: open, reaching, gripping a crop, lifting it. src/render/fieldworks.ts
// draws it at the crop tile (4 px higher on axis 0); with this origin the trolley meets the girder
// on both axes and the claw comes down to the top of the crop.
function head(f) {
  const im = new Img(16, 16);
  // trolley: two wheels, axle, brass carriage with a copper cable drum
  for (const x of [1, 12]) { im.rect(x, 1, 3, 3, IRON[1]); im.set(x, 1, IRON[3]); im.set(x + 1, 2, IRON[0]); im.set(x + 2, 3, IRON[0]); }
  im.hline(4, 11, 2, IRON[2]);
  im.rect(3, 4, 10, 3, BRASS[2]); im.hline(3, 12, 4, BRASS[3]); im.set(3, 4, BRASS[4]); im.hline(4, 12, 6, BRASS[1]); im.vline(12, 4, 6, BRASS[1]);
  im.rect(6, 4, 4, 2, COPPER[2]); im.hline(6, 9, 4, COPPER[3]); im.set(7 + (f % 2), 5, COPPER[0]); // drum turns
  // telescope: brass sleeve, iron rod of the frame's reach, claw
  const reach = [0, 3, 5, 2][f];
  im.rect(7, 7, 2, 2, BRASS[3]); im.set(8, 8, BRASS[1]);
  const end = 9 + reach;
  for (let y = 9; y < end; y++) { im.set(7, y, IRON[3]); im.set(8, y, IRON[1]); }
  im.hline(6, 9, end, BRASS[2]); im.set(6, end, BRASS[3]);
  const crop = f === 2 || f === 3;
  if (!crop) {
    // open claw: three iron fingers spread
    im.set(5, end + 1, IRON[2]); im.set(4, end + 2, IRON[2]);
    im.set(10, end + 1, IRON[1]); im.set(11, end + 2, IRON[1]);
    im.set(7, end + 1, IRON[2]); im.set(7, end + 2, IRON[3]);
  } else {
    // closed on a picked crop
    im.rect(6, end + 1, 4, 2, LEAF[2]); im.set(6, end + 1, LEAF[3]); im.set(9, end + 2, LEAF[1]); im.set(8, end + 1, COG);
    im.set(5, end + 1, IRON[2]); im.set(5, end + 2, IRON[2]); im.set(10, end + 1, IRON[1]); im.set(10, end + 2, IRON[1]);
  }
  im.outline(INK);
  return im;
}

add('gantry:car:0', carEW(false), [0, 12]);
add('gantry:car:0:full', carEW(true), [0, 12]);
add('gantry:car:1', carNS(false), [2, 12]);
add('gantry:car:1:full', carNS(true), [2, 12]);
add('gantry:beam:0', beamEW(), [0, 20]);
add('gantry:beam:1', beamNS(), [8, 12]);
for (let f = 0; f < 4; f++) add(`gantry:head:${f}`, head(f), [0, 12]);

// ================================================================ ITEM ICONS (16x16) and belt icons (10x10)
// Art inside 14x14 with a closed plum outline, light from the upper left (STYLE.md, icons).
function iconGleaner() {
  const im = new Img(16, 16);
  // spring barrel (rim, dark case, coil, hub), key, post, basket of beans, folded arm
  stamp(im, 1, 1, [
    '.....RRRQ.....',
    '....RQ111P....',
    '.d.RQ1ddd1P...',
    '.cdcR1d1e1O...',
    '.cc.R1d111O...',
    '.b..Q11dddO...',
    '.....P111O....',
    '......POO.....',
    '.ihi..432dc...',
    'ihgoh.321.b...',
    'ZZZZzy321..b..',
    'zyzzyx321..b..',
    'yxyyxw321..r..',
    '.yxxw.321.....',
  ], { ...GLEANER_LEGEND, r: IRON[2] });
  return im.outline(INK);
}
function iconRail() {
  const im = new Img(16, 16);
  for (const x of [2, 6, 10]) for (let y = 3; y <= 12; y++) { im.set(x, y, y === 3 ? WOOD[3] : WOOD[2]); im.set(x + 1, y, WOOD[1]); im.set(x + 2, y, y > 3 ? WOOD[0] : WOOD[1]); }
  for (const r of [5, 10]) for (let x = 1; x <= 14; x++) { im.set(x, r, IRON[3]); im.set(x, r + 1, IRON[1]); }
  for (const r of [5, 10]) { im.set(1, r, IRON[3]); im.set(14, r + 1, IRON[0]); }
  for (const x of [3, 11]) for (const r of [4, 9]) im.set(x, r, BRASS[2]);
  return im.outline(INK);
}
function iconGantry() {
  const im = new Img(16, 16);
  // legs splayed out to the wheels
  im.line(3, 5, 1, 11, BRASS[3]); im.line(4, 5, 2, 11, BRASS[1]);
  im.line(11, 5, 13, 11, BRASS[2]); im.line(12, 5, 14, 11, BRASS[1]);
  for (const x of [1, 12]) { im.rect(x, 12, 3, 2, IRON[1]); im.set(x, 12, IRON[3]); im.set(x + 2, 13, IRON[0]); }
  // girder
  im.hline(1, 14, 1, BRASS[4]); im.hline(1, 14, 2, BRASS[2]);
  for (let x = 1; x <= 14; x++) im.set(x, 3 + ((x >> 1) % 2), BRASS[1]);
  im.hline(1, 14, 5, BRASS[3]); im.hline(1, 14, 6, BRASS[1]);
  // trolley, rod and a claw holding a bean
  im.rect(6, 7, 4, 2, BRASS[2]); im.hline(6, 9, 7, BRASS[3]); im.set(9, 8, BRASS[1]);
  im.set(7, 9, IRON[3]); im.set(8, 9, IRON[1]); im.set(7, 10, IRON[3]); im.set(8, 10, IRON[1]);
  im.set(6, 11, IRON[2]); im.set(9, 11, IRON[1]);
  im.rect(7, 11, 2, 2, LEAF[2]); im.set(7, 11, LEAF[3]); im.set(8, 12, LEAF[1]);
  return im.outline(INK);
}
// cogbean oil: the i:oil bottle (same family silhouette as oil and truffle oil), pale green-gold
// oil, a cream label with an orange cog
function iconCogbeanOil() {
  const OIL = [
    '................',
    '.......aba......',
    '.....cacdea.....',
    '.....afggga.....',
    '......acha......',
    '......aiia......',
    '.....afehja.....',
    '....aikiiija....',
    '....ajkjjjja....',
    '....ajmmmmja....',
    '....ajmoomha....',
    '....ajnoonha....',
    '....ajjjjjha....',
    '....ajjljjha....',
    '.....aaaaaa.....',
    '................',
  ];
  const legend = {
    a: INK, b: '#9e4539', c: '#cd683d', d: '#4c3e24', e: '#fbb954', f: '#c7dcd0', g: '#ffffff',
    h: '#a2a947', i: '#fbff86', j: '#cddf6c', k: '#b2ba90', l: '#d5e04b',
    m: '#fdcbb0', n: '#ab947a', o: COG,
  };
  return stamp(new Img(16, 16), 0, 0, OIL, legend);
}
const ICONS = { gleaner: iconGleaner(), rail: iconRail(), gantry: iconGantry(), cogbean_oil: iconCogbeanOil() };
for (const [id, im] of Object.entries(ICONS)) add('i:' + id, im);

// belt icons: the game's own rule (src/render/art/icons.ts, ib:) applied here, so ib:<id> exists
// before the item does and matches what the game would derive: each 2x2 block of the icon keeps
// its most common non-outline color, the 8x8 fill gets a lit top-left and dark bottom-right edge,
// then an outline (plum below/right, the material's double-dark shade above/left).
const PAL = await import(pathToFileURL(path.join(ROOT, 'src/data/palette.ts')).href).catch(() => null);
if (!PAL) throw new Error('belt icons need palette.ts: run with node --experimental-transform-types');
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const palIndex = (h) => {
  const [r, g, b] = hexRGB(h);
  let best = 0, bestD = Infinity;
  PAL.PALETTE_RGB.forEach(([pr, pg, pb], i) => { const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < bestD) [best, bestD] = [i, d]; });
  return best;
};
function beltIcon(icon) {
  const fill = new Array(64).fill(-1);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const votes = new Map();
      let opaque = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const c = icon.get(x * 2 + dx, y * 2 + dy);
        if (!c) continue;
        opaque++;
        const k = palIndex(c);
        if (k !== PAL.C.ink) votes.set(k, (votes.get(k) ?? 0) + 1);
      }
      let best = -1, bestN = 0;
      for (const [c, n] of votes) if (n > bestN) [best, bestN] = [c, n];
      if (opaque >= 2 && best >= 0) fill[y * 8 + x] = best;
    }
  const im = new Img(10, 10);
  const put = (x, y, c) => { if (c >= 0) im.set(x, y, PAL.PALETTE[c]); };
  const at = (x, y) => (x >= 0 && y >= 0 && x < 8 && y < 8 ? fill[y * 8 + x] : -1);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const c = at(x, y);
      if (c < 0) continue;
      put(x + 1, y + 1, at(x + 1, y) < 0 || at(x, y + 1) < 0 ? PAL.DARK[c] : at(x - 1, y) < 0 || at(x, y - 1) < 0 ? PAL.LIGHT[c] : c);
    }
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      if (at(x - 1, y - 1) >= 0) continue;
      const below = at(x - 1, y), right = at(x, y - 1), above = at(x - 1, y - 2), left = at(x - 2, y - 1);
      if (above >= 0 || left >= 0) put(x, y, PAL.C.ink);
      else if (below >= 0 || right >= 0) put(x, y, PAL.DARK[PAL.DARK[below >= 0 ? below : right]]);
    }
  return im;
}
for (const [id, im] of Object.entries(ICONS)) add('ib:' + id, beltIcon(im));

// aliases the game also asks for: the gantry's item and structure id is field_gantry (i:, ib:,
// and st: for the build ghost / structure icon), the rail's structure sprite (build ghost)
const byName = (n) => out.find((o) => o.name === n);
add('i:field_gantry', byName('i:gantry').im);
add('ib:field_gantry', byName('ib:gantry').im);
add('st:field_gantry:*:*:*', byName('gantry:car:0').im, [0, 12]);
add('st:rail:*:*:*', byName('rail:0').im);

// ================================================================ output
export { out };

/** preview: every sprite on grass and on tilled soil, x4 */
function preview(items, file, k = 4) {
  const pad = 4;
  const W = items.reduce((w, it) => w + it.im.w + pad, pad);
  const H = Math.max(...items.map((it) => it.im.h)) * 2 + pad * 3;
  const sheet = new Img(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sheet.set(x, y, y < H / 2 ? ((x >> 4) + (y >> 4)) % 2 ? '#239063' : '#1ebc73' : ((x >> 4) + (y >> 4)) % 2 ? '#7a3045' : '#9e4539');
  let x = pad;
  for (const it of items) {
    sheet.draw(it.im, x, pad);
    sheet.draw(it.im, x, H / 2 + pad);
    x += it.im.w + pad;
  }
  sheet.save(file, k);
}
/** shelf-pack every frame into art/fieldworks/sheet.png and write the sprites-import recipe */
function writeSheet() {
  const W = 256, gap = 1;
  let x = 0, y = 0, rowH = 0;
  const rects = [];
  // tall frames first so the shelves stay tight
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
    name: 'fieldworks',
    kind: 'sprites',
    meta: { note: 'Field Works (ROADMAP 4.9): gleaner, rails, field gantry (car, bridge, picker head), item and belt icons. Drawn by art/fieldworks/build.mjs from the PixelLab design references in art/fieldworks/raw; do not edit by hand.' },
    scale: 1,
    defaults: { file: 'sheet.png', place: 'none', keepStrays: true },
    sprites: out.map((o, i) => ({ match: o.name, rect: rects[i], frame: [o.im.w, o.im.h], origin: o.origin })),
  };
  const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + recipe.sprites.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n ]');
  fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSheet();
  const only = process.argv.includes('--only') ? new RegExp(process.argv[process.argv.indexOf('--only') + 1]) : null;
  preview(out.filter((o) => !only || only.test(o.name)), path.join(ROOT, 'e2e/out/fieldworks-build.png'), +(process.argv.includes('--k') ? process.argv[process.argv.indexOf('--k') + 1] : 4));
  console.log(`${out.length} sprites`);
}
