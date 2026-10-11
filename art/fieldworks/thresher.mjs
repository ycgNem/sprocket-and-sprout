// The Thresher (ROADMAP 4.10, a 2x2 powered machine): st:thresher:*:0:* idle (still),
// st:thresher:<0-3>:1:* working. Frame 32x42, origin [0, 10]: the bottom 32 rows are the footprint, the
// golden sheaf in the hopper rises into the 10 rows above it (src/render/art/structs.ts EXTRA_TOP).
// Drawn pixel by pixel, in the gleaner's style (art/fieldworks/build.mjs): rust-red timber with brass
// bands, a copper hood and spout, closed plum outline, light from the upper left. Design references:
// PixelLab batch F3 (raw/F3: a golden sheaf in a funnel hopper, a drum behind a brass-ringed window,
// a spoked flywheel, a chute with straw; nothing is imported from it).
//
// The three rules of STYLE.md "Machines":
//   1. a readable moving part: the beater drum in its window (brass bars ride down it, 4 frames), plus
//      a spoked flywheel turning on the left and straw riding down the chute on the right;
//   2. idle is still (drum and wheel parked, lantern dark, chute and spout dry); working changes only
//      the drum, the wheel, the straw, the grain and the lantern, every other pixel stays identical;
//   3. a marked output side: the east side is the output: a plank chute with straw slides out of the
//      right wall, and a copper spout over a sack drips grain at the front. The hopper (input) is
//      top left, with the flywheel under it.
import { Img, INK, WOOD, BRASS, COPPER, IRON } from '../factory/gen/lib.mjs';

const STRAW = ['#cd683d', '#e6904e', '#fbb954', '#f9c22b', '#fbff86'];
const SACK = ['#966c6c', '#ab947a', '#fdcbb0'];
const LEAF = ['#165a4c', '#239063', '#1ebc73', '#91db69'];
const DEEP = WOOD[0]; // #45293f, the darkest inside shade

// geometry (frame pixels)
const BODY = { x0: 7, x1: 24, y0: 15, y1: 35 };
const WIN = { cx: 15.5, cy: 25, r: 6 };
const WHEEL = { cx: 5.5, cy: 31.5, r: 5.5 };

/** painted by character grid: '.' skips; legend maps characters to colors */
function stamp(im, x0, y0, rows, legend) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || ch === ' ') return;
    const c = legend[ch];
    if (!c) throw new Error('thresher legend: ' + ch);
    im.set(x0 + i, y0 + j, c);
  }));
  return im;
}

/** filled disc through pixel centers */
const inDisc = (x, y, cx, cy, r) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
/** which way a pixel faces the light: negative = upper left (lit), positive = lower right (shade) */
const facing = (x, y, cx, cy) => (x + 0.5 - cx) + (y + 0.5 - cy);

/** horizontal planks, 4 px pitch: lit top edge, body, body, seam; staggered end joints, lit left edge, shaded right edge */
function planks(im, x0, y0, x1, y1, seed = 0) {
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) % 4;
    for (let x = x0; x <= x1; x++) im.set(x, y, k === 0 ? WOOD[3] : k === 3 ? WOOD[1] : WOOD[2]);
    if (k === 1 || k === 2) im.set(x0 + 3 + ((((y - y0) >> 2) * 7 + seed) % (x1 - x0 - 5)), y, WOOD[1]); // end joint
  }
  for (let y = y0; y <= y1; y++) {
    im.set(x0, y, (y - y0) % 4 === 3 ? WOOD[2] : WOOD[4]);
    im.set(x1, y, (y - y0) % 4 === 0 ? WOOD[2] : WOOD[0]);
  }
}

/** a brass band across x0..x1 at y (3 rows: lit, body, shade) with rivets */
function band(im, x0, x1, y) {
  im.hline(x0, x1, y, BRASS[3]);
  im.hline(x0, x1, y + 1, BRASS[2]);
  im.hline(x0, x1, y + 2, BRASS[1]);
  im.set(x0 + 1, y + 1, BRASS[4]);
  im.set(x1 - 1, y + 1, BRASS[4]);
}

/** the sheaf in the hopper: four ears fanned out of a copper cord, the butts down in the dark mouth */
function sheaf(im) {
  stamp(im, 1, 0, [
    '.e...e..e...e.',
    'de..de.de..de.',
    'dc..dc.dc..dc.',
    '.cb.cb.cb.cb..',
    '..c.c.cb.cb...',
    '...cc.cbcb....',
    '....rrrrrr....',
    '...cb.cbc.bc..',
  ], { e: STRAW[4], d: STRAW[3], c: STRAW[2], b: STRAW[1], r: COPPER[2] });
}

// ---------------------------------------------------------------- the static machine
function machine() {
  const im = new Img(32, 42);

  // --- hopper: a timber funnel with a brass rim and a dark mouth
  for (let y = 10; y <= 14; y++) {
    const inset = (y - 10) >> 1;
    for (let x = 4 + inset; x <= 14 - inset; x++) {
      const lit = x === 4 + inset, shade = x >= 13 - inset;
      im.set(x, y, lit ? WOOD[4] : shade ? WOOD[1] : (y - 10) % 2 ? WOOD[2] : WOOD[3]);
    }
  }
  im.hline(2, 16, 8, BRASS[4]);
  im.hline(2, 16, 9, BRASS[3]);
  im.hline(3, 15, 7, DEEP);
  im.set(2, 8, BRASS[3]); im.set(16, 8, BRASS[2]);
  im.hline(3, 15, 10, BRASS[1]);
  im.set(3, 10, BRASS[2]);
  sheaf(im);

  // --- plinth: dark timber skirt the machine stands on, brass studs at the corners
  for (let y = 36; y <= 40; y++) for (let x = 6; x <= 25; x++) im.set(x, y, y === 36 ? WOOD[2] : (x - 6) % 5 === 4 ? WOOD[0] : y === 40 ? WOOD[0] : WOOD[1]);
  for (let y = 36; y <= 40; y++) { im.set(6, y, y === 36 ? WOOD[3] : WOOD[2]); im.set(25, y, WOOD[0]); }
  for (const x of [8, 23]) im.set(x, 38, BRASS[3]);

  // --- body: two dark posts framing planked panels, brass bands on the lid and above the plinth
  const { x0, x1, y0, y1 } = BODY;
  planks(im, x0 + 2, y0, x1 - 2, y1, 3);
  for (let y = y0; y <= y1; y++) {
    // posts: vertical timber, the left one lit, the right one in shade
    im.set(x0, y, WOOD[2]); im.set(x0 + 1, y, WOOD[1]);
    im.set(x1 - 1, y, WOOD[1]); im.set(x1, y, WOOD[0]);
  }
  for (const y of [20, 28]) { im.set(x0, y, BRASS[3]); im.set(x1 - 1, y, BRASS[2]); }
  // the lid: three rows of brass across the whole width
  im.hline(x0, x1, 15, BRASS[3]);
  im.hline(x0, x1, 16, BRASS[2]);
  im.hline(x0 + 1, x1, 17, BRASS[1]);
  band(im, x0, x1, 33);

  // knots and scuffs, so the panels are not a pattern
  for (const [x, y, c] of [[10, 18, WOOD[1]], [21, 19, WOOD[1]], [9, 24, WOOD[3]], [22, 25, WOOD[3]], [10, 31, WOOD[1]], [21, 30, WOOD[4]], [9, 21, WOOD[4]], [22, 22, WOOD[1]]]) im.set(x, y, c);

  // --- chute: a plank trough out of a copper-framed hatch in the right wall, 45 degrees down to a heap of straw
  im.rect(21, 23, 5, 7, COPPER[1]);     // the hatch's frame...
  im.rect(22, 25, 3, 4, DEEP);          // ...and the dark mouth the straw comes out of
  im.hline(21, 25, 23, COPPER[3]);
  im.vline(21, 23, 29, COPPER[2]);
  for (let x = 24; x <= 31; x++) {
    const t = chuteTop(x);
    [WOOD[4], WOOD[3], WOOD[2], WOOD[1], WOOD[1], WOOD[0], WOOD[0]].forEach((c, k) => im.set(x, t + k, c)); // lit lip, the trough, the front board in shade
  }
  // the straw that has landed: a heap against the chute's foot
  stamp(im, 26, 36, [
    '...e.',
    '..edc',
    '.edcc',
    'edccb',
    'ddcbb',
  ], { e: STRAW[4], d: STRAW[3], c: STRAW[2], b: STRAW[1] });

  // --- grain spout over a wicker basket, front centre: a copper spout hangs off the bottom band
  stamp(im, 13, 33, [
    '.rrrr.',
    '.RrrR.',
    '..Rr..',
  ], { r: COPPER[2], R: COPPER[1] });
  im.set(13, 34, COPPER[3]); im.set(14, 33, COPPER[3]);
  // the basket, heaped with grain
  stamp(im, 11, 36, [
    '..GeGG..',
    '.hGGGGGs',
    'hWwWwWws',
    'hwWwWwWs',
    '.ssssss.',
  ], { h: WOOD[4], W: WOOD[3], w: WOOD[2], s: WOOD[1], G: STRAW[3], e: STRAW[4] });

  // --- industrial botany: a tuft of grass at the left foot and a vine up the hopper's side
  stamp(im, 1, 37, [
    '.g..i.',
    'gG.gG.',
    '.GgGg.',
    '..gG..',
  ], { g: LEAF[1], G: LEAF[2], i: LEAF[3] });
  stamp(im, 1, 9, [
    '.i.',
    'gG.',
    '.g.',
    'iG.',
  ], { g: LEAF[1], G: LEAF[2], i: LEAF[3] });
  return im;
}

/** the chute's lip row for a column (45 degrees down from the hatch) */
const chuteTop = (x) => 27 + (x - 24);

/** the lantern on the lid: dark glass idle, a lit amber pane working */
function lantern(im, on) {
  stamp(im, 19, 10, [
    '.bb.',
    'bggb',
    'bggb',
    'bbbb',
  ], { b: BRASS[2], g: on ? BRASS[3] : WOOD[1] });
  im.set(19, 11, on ? BRASS[4] : BRASS[3]); im.set(20, 10, BRASS[3]);
  if (on) { im.set(20, 11, BRASS[4]); im.set(21, 12, BRASS[4]); }
}

/** straw sliding down the chute (4 frames, one column a frame) or lying still when idle */
function chuteStraw(im, f) {
  const at = f === 'idle' ? [1, 5] : [f, f + 4];
  for (const s of at) for (const dx of [0, 1]) {
    const x = 24 + s + dx;
    if (x > 31) continue;
    const t = chuteTop(x);
    im.set(x, t - 1, STRAW[dx ? 2 : 3]);
    im.set(x, t, dx ? STRAW[3] : STRAW[4]);
    im.set(x, t + 1, STRAW[2]);
  }
}

/** grain dribbling from the spout onto the heap in the basket (working only) */
function grain(im, f) {
  if (f === 'idle') return;
  im.set(15 + (f & 1), 35, STRAW[3]);
  im.set(14 + f % 3, 36, STRAW[4]);
}

/** the beater drum seen end-on through its window: a copper ring with a plum shadow ring, three brass
 *  blades turning in the dark (30 degrees a frame: 120 degrees is the loop) */
function window(im, a) {
  const { cx, cy, r } = WIN;
  const rShadow = r + 0.9, rIn = r - 1.6;
  for (let y = Math.floor(cy - rShadow); y <= cy + rShadow; y++) for (let x = Math.floor(cx - rShadow); x <= cx + rShadow; x++) {
    if (!inDisc(x, y, cx, cy, rShadow)) continue;
    const f = facing(x, y, cx, cy);
    if (inDisc(x, y, cx, cy, rIn)) im.set(x, y, DEEP);
    else if (inDisc(x, y, cx, cy, r)) im.set(x, y, f < -2 ? COPPER[3] : f > 2.5 ? COPPER[1] : COPPER[2]);
    else im.set(x, y, INK);
  }
  for (let k = 0; k < 3; k++) {
    const th = ((a + k * 120) * Math.PI) / 180;
    const ex = cx - 0.5 + Math.cos(th) * (rIn - 0.3), ey = cy - 0.5 + Math.sin(th) * (rIn - 0.3);
    const nx = -Math.sin(th) * 0.6, ny = Math.cos(th) * 0.6;
    im.line(cx - 0.5 + nx, cy - 0.5 + ny, ex + nx, ey + ny, BRASS[3]);
    im.line(cx - 0.5 - nx, cy - 0.5 - ny, ex - nx, ey - ny, BRASS[2]);
    im.set(Math.round(ex), Math.round(ey), BRASS[4]);
  }
  im.rect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2, BRASS[2]);
  im.set(Math.floor(cx) - 1, Math.floor(cy) - 1, BRASS[4]);
}

/** the flywheel: copper rim, dark backing, six brass spokes at angle a (deg), brass hub */
function flywheel(im, a) {
  const { cx, cy, r } = WHEEL;
  const rIn = r - 2;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!inDisc(x, y, cx, cy, r)) continue;
    if (inDisc(x, y, cx, cy, rIn)) { im.set(x, y, DEEP); continue; }
    const f = facing(x, y, cx, cy);
    im.set(x, y, f < -2 ? COPPER[2] : f > 2.5 ? COPPER[0] : COPPER[1]);
  }
  for (let k = 0; k < 6; k++) {
    const th = ((a + k * 60) * Math.PI) / 180;
    im.line(cx - 0.5, cy - 0.5, cx - 0.5 + Math.cos(th) * (rIn - 0.4), cy - 0.5 + Math.sin(th) * (rIn - 0.4), BRASS[2]);
  }
  const hx = Math.floor(cx), hy = Math.floor(cy);
  im.rect(hx - 1, hy - 1, 3, 3, BRASS[3]);
  im.set(hx, hy, BRASS[4]);
  im.set(hx + 1, hy + 1, BRASS[1]);
}

/** one frame: 'idle' or 0..3 */
function thresher(f) {
  const im = machine();
  window(im, f === 'idle' ? 0 : f * 30);
  flywheel(im, f === 'idle' ? 0 : f * 15);
  lantern(im, f !== 'idle');
  chuteStraw(im, f);
  grain(im, f);
  im.outline(INK);
  return im;
}

export { machine, thresher, planks, band, stamp, inDisc, STRAW, SACK, LEAF, DEEP };
