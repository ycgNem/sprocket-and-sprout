// Belt family, drawn pixel by pixel (exact lane geometry, seamless 4-frame treads, palette only).
// Writes art/factory/belts/belts.png (grid of 16x16 cells + 32x16 splitters) and belts.json, the
// rect of every sprite name, which art/factory/gen/recipe.mjs turns into sprites.json entries.
//
//   belt:<tier>:<rot>:<curve>:<frame>  16x16, frames 0-15, local frame heading north, rot = quarter turns cw
//   ug:<tier>:<rot>:<in>:<frame>       16x16, frames 0-15, hood over the tunnel end
//   split:<tier>:<frame>               32x16, flow north (the renderer rotates it)
//   armb:<id>, armh:*                  the clockwork arm parts, drawn by gen/arms.mjs (see there)
//
// Treads move 1 px per frame over 16 frames, so they glide with the items (the renderer advances
// belt frames at speed*16 per second; items travel speed*16 px per second). Pattern period 16 = one tile.
//
// Usage: node art/factory/gen/belts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { ARM, drawArmBase, drawClaw, drawKey, drawSideKey, drawCoil, KEY_ORIGIN, SIDE_KEY_ORIGIN, COIL_ORIGIN } from './arms.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../belts');
fs.mkdirSync(OUT, { recursive: true });

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const INK = '#2e222f';

// ---------- tiny image ----------
function img(w, h) { return { w, h, px: new Array(w * h).fill(null) }; }
const get = (im, x, y) => (x < 0 || y < 0 || x >= im.w || y >= im.h ? null : im.px[y * im.w + x]);
const put = (im, x, y, c) => { if (x >= 0 && y >= 0 && x < im.w && y < im.h) im.px[y * im.w + x] = c; };
/** rotate a square image by `rot` quarter turns clockwise (pixel exact) */
function rotate(im, rot) {
  let cur = im;
  for (let r = 0; r < (rot & 3); r++) {
    const n = img(cur.h, cur.w);
    for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) put(n, cur.h - 1 - y, x, get(cur, x, y));
    cur = n;
  }
  return cur;
}

// ---------- tiers ----------
// rail: [outer, top, bolt]  surf: [base, edge, seamA (dark, once per tile), seamB, chevron, chevronShade]
const TIER = {
  1: { // Woven Belt: canvas on wooden rollers
    rail: [INK, '#9e4539', '#e6904e'], railAlt: '#9e4539',
    surf: ['#ab947a', '#966c6c', '#694f62', '#966c6c', '#fdcbb0', '#ab947a'],
    hood: ['#7a3045', '#9e4539', '#cd683d', '#e6904e'], mouth: ['#2e222f', '#45293f'],
  },
  2: { // Brass Belt: brass rollers, oiled leather
    rail: [INK, '#f79617', '#fbff86'], railAlt: '#cd683d',
    surf: ['#7a3045', '#45293f', '#2e222f', '#45293f', '#f9c22b', '#cd683d'],
    hood: ['#9e4539', '#cd683d', '#f79617', '#f9c22b'], mouth: ['#2e222f', '#45293f'],
  },
  3: { // Gilded Express: gold trim, plum velvet, hazard-striped rails
    rail: [INK, '#f9c22b', '#fbff86'], railAlt: '#6b3e75',
    surf: ['#6b3e75', '#45293f', '#2e222f', '#45293f', '#fbff86', '#f9c22b'],
    hood: ['#cd683d', '#f79617', '#f9c22b', '#fbff86'], mouth: ['#2e222f', '#45293f'],
  },
};

/**
 * Straight belt texture, local frame heading north. x across (0..15), y along (0 = front/exit).
 * `s` is the along coordinate already shifted by the frame (pattern period 16).
 */
function beltTex(t, x, s, yStatic) {
  const T = TIER[t];
  const [base, edge, seamA, seamB, chev, chevSh] = T.surf;
  if (x === 0 || x === 15) return T.rail[0];
  if (x === 1 || x === 14) {
    // rails don't move: bolts every 4 px; tier 3 gets dashed hazard stripes
    if (t === 3) return Math.floor(yStatic / 2) % 2 ? T.railAlt : T.rail[1];
    return yStatic % 4 === 1 ? T.rail[2] : yStatic % 4 === 3 && t === 2 ? T.railAlt : T.rail[1];
  }
  const p = ((s % 16) + 16) % 16;
  // chevron pointing north, tip at p=3 (rows 3..5), two pixels thick on the arms
  const cx = x < 8 ? 7 - x : x - 8; // 0 at the center pair
  const row = p - 3;
  if (row >= 0 && row <= 3 && x >= 4 && x <= 11) {
    if (cx === row) return chev;
    if (cx === row - 1 && row >= 1) return chevSh;
  }
  if (p % 4 === 0) return p === 8 ? seamA : seamB; // the dark seam once per tile shows the motion
  if (x === 2 || x === 13) return edge;
  return base;
}

function drawBelt(t, rot, curve, frame) {
  const im = img(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (curve === 0) { put(im, x, y, beltTex(t, x, y + frame, y)); continue; }
      // quarter ring around a top corner: curve 1 = from the left (corner 0,0), 2 = from the right (16,0)
      const cx = curve === 1 ? 0 : 16;
      const dx = Math.abs(x + 0.5 - cx), dy = y + 0.5;
      const d = Math.hypot(dx, dy);
      if (d >= 16) continue;
      const th = Math.atan2(dy, dx); // 0 at the top edge (exit) .. pi/2 at the side edge (entry)
      const along = Math.min(15.999, (th / (Math.PI / 2)) * 16);
      const across = curve === 1 ? Math.floor(d) : 15 - Math.floor(d);
      put(im, x, y, beltTex(t, across, Math.floor(along) + frame, Math.floor(along)));
    }
  return rotate(im, rot);
}

/** shade a solid region in world space: light from the upper left */
function shadeRegion(im, mask, [dark, base, light, hi]) {
  const inM = (x, y) => x >= 0 && y >= 0 && x < im.w && y < im.h && mask[y * im.w + x];
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      if (!inM(x, y)) continue;
      const up = !inM(x, y - 1), left = !inM(x - 1, y), down = !inM(x, y + 1), right = !inM(x + 1, y);
      let c = base;
      if (up || left) c = up && left ? hi : light;
      else if (down || right) c = dark;
      put(im, x, y, c);
    }
}

function drawUnder(t, rot, isIn, frame) {
  const T = TIER[t];
  const belt = drawBelt(t, 0, 0, frame);
  // hood in local coordinates: entrance hood at the front (y 0..8), exit hood at the back (y 7..15).
  // It is a half-cylinder tunnel roof along the belt with a dark arched mouth facing the belt.
  const loc = img(16, 16);
  const y0 = isIn ? 0 : 7, y1 = isIn ? 8 : 15;
  const mouthY = isIn ? y1 : y0; // the open side faces the visible belt
  const farY = isIn ? y0 : y1, inward = isIn ? -1 : 1;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) {
    const dFar = Math.abs(y - farY);
    if (dFar === 0 && (x < 2 || x > 13)) continue; // rounded far end
    if (dFar === 1 && (x < 1 || x > 14)) continue;
    let v = 'H';
    const k = Math.abs(y - mouthY); // rows into the tunnel from the mouth
    const half = [5, 4, 3][k]; // arch half-width per row
    if (half !== undefined && Math.abs(x - 7.5) < half) v = k === 0 ? 'M' : 'm';
    else if (half !== undefined && Math.abs(x - 7.5) < half + 1) v = 'E'; // rim around the mouth
    else if (k > 2 && (y - farY) % 3 === 0 && dFar > 0) v = 'R';
    put(loc, x, y, v);
  }
  void inward;
  const w = rotate(loc, rot);
  const out = rotate(belt, rot);
  const [dk, base, lt, hi] = T.hood;
  const vertical = rot % 2 === 0; // tunnel axis runs up/down on screen
  for (let i = 0; i < 256; i++) {
    const v = w.px[i];
    if (v === null) continue;
    const x = i % 16, y = (i / 16) | 0;
    // cylinder shading across the axis, lit from the upper left
    const a = vertical ? x : y;
    let c = a <= 1 ? lt : a <= 4 ? hi : a <= 10 ? base : a <= 13 ? lt === hi ? base : dk : dk;
    if (a >= 2 && a <= 4) c = a === 3 ? hi : lt;
    if (a >= 5 && a <= 10) c = base;
    if (a >= 11) c = dk;
    if (v === 'R') c = c === hi || c === lt ? base : dk;
    if (v === 'E') c = T.rail[1] === '#9e4539' ? '#e6904e' : '#fbff86';
    if (v === 'm') c = T.mouth[1];
    if (v === 'M') c = T.mouth[0];
    // outline where the hood meets the belt or the tile edge on the sides (the mouth stays open)
    const edge = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15) return false;
      return w.px[ny * 16 + nx] === null;
    });
    if (edge && v !== 'M' && v !== 'm') c = INK;
    put(out, x, y, c);
  }
  return out;
}

/** a 4-spoke gear: ring radius 4 around (cx, cy), spokes turning 22.5 degrees a frame */
function gear(im, cx, cy, frame, [dark, base, light]) {
  for (let y = -5; y <= 5; y++)
    for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, y);
      if (d > 4.6) continue;
      let c = null;
      if (d > 3.4) c = base;
      else if (d < 1.2) c = light;
      else {
        const a = Math.atan2(y, x) - (frame * Math.PI) / 8;
        const k = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
        if (k < 0.32 || k > Math.PI / 2 - 0.32) c = base; else c = dark;
      }
      put(im, cx + x, cy + y, c);
    }
  // teeth: 8 around the rim, rotating with the spokes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (frame * Math.PI) / 16;
    put(im, Math.round(cx + Math.cos(a) * 5.2), Math.round(cy + Math.sin(a) * 5.2), base);
  }
  put(im, cx, cy, INK);
}

function outline(im) {
  const o = img(im.w, im.h);
  o.px = im.px.slice();
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      if (get(im, x, y) !== null) continue;
      if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => get(im, x + dx, y + dy) !== null)) put(o, x, y, INK);
    }
  return o;
}

function drawSplitter(t, frame) {
  const T = TIER[t];
  const [d, b, l, h] = T.hood;
  const im = img(32, 16);
  // housing bar across both belts, symmetric top/bottom because the renderer rotates it
  const mask = new Array(32 * 16).fill(false);
  for (let y = 4; y <= 11; y++) for (let x = 1; x <= 30; x++) if (!((x === 1 || x === 30) && (y === 4 || y === 11))) mask[y * 32 + x] = true;
  // end caps a little taller
  for (const x0 of [1, 27]) for (let y = 3; y <= 12; y++) for (let x = x0; x < x0 + 4; x++) if (!((y === 3 || y === 12) && (x === x0 || x === x0 + 3))) mask[y * 32 + x] = true;
  for (let i = 0; i < mask.length; i++) if (mask[i]) im.px[i] = b;
  for (let x = 1; x <= 30; x++) { if (mask[4 * 32 + x]) put(im, x, 4, l); if (mask[11 * 32 + x]) put(im, x, 11, d); }
  for (const x0 of [1, 27]) { for (let x = x0; x < x0 + 4; x++) { if (get(im, x, 3)) put(im, x, 3, h); if (get(im, x, 12)) put(im, x, 12, d); } }
  // two mouths, one over each belt's lanes
  for (const mx of [5, 21]) {
    for (let x = mx; x < mx + 6; x++) { put(im, x, 6, T.mouth[1]); put(im, x, 7, T.mouth[0]); put(im, x, 8, T.mouth[0]); put(im, x, 9, T.mouth[1]); }
    // a brass indicator dot that blinks in turn (which side gets the next item)
    const lit = (frame >> 1) % 2 === (mx === 5 ? 0 : 1);
    put(im, mx + 2, 5, lit ? '#fbff86' : d); put(im, mx + 3, 5, lit ? '#fbff86' : d);
  }
  // rivets along the bar
  for (const x of [3, 13, 18, 28]) { put(im, x, 5, h); put(im, x, 10, d); }
  gear(im, 16, 8, frame, ['#9e4539', '#f79617', '#fbff86']);
  return outline(im);
}

// ---------- pack ----------
const cells = []; // { name, im }
for (const t of [1, 2, 3]) {
  for (const curve of [0, 1, 2]) for (const rot of [0, 1, 2, 3]) for (let f = 0; f < 16; f++) cells.push({ name: `belt:${t}:${rot}:${curve}:${f}`, im: drawBelt(t, rot, curve, f) });
  for (const isIn of [1, 0]) for (const rot of [0, 1, 2, 3]) for (let f = 0; f < 16; f++) cells.push({ name: `ug:${t}:${rot}:${isIn}:${f}`, im: drawUnder(t, rot, isIn, f) });
}
for (const id of Object.keys(ARM)) cells.push({ name: `armb:${id}`, im: drawArmBase(id) });

/** fx:nopower: 9x9 brass badge with a plum lightning bolt (the renderer blinks it), origin top-left */
function drawNoPower() {
  const im = img(9, 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const corner = (x === 0 || x === 8) && (y === 0 || y === 8);
    if (corner) continue;
    const edge = x === 0 || x === 8 || y === 0 || y === 8;
    put(im, x, y, edge ? INK : x === 1 || y === 1 ? '#fbff86' : x === 7 || y === 7 ? '#cd683d' : '#f9c22b');
  }
  put(im, 1, 1, '#fbff86'); put(im, 7, 1, '#f79617'); put(im, 1, 7, '#f79617');
  for (const [x, y] of [[5, 1], [6, 1], [4, 2], [5, 2], [3, 3], [4, 3], [5, 3], [6, 3], [4, 4], [5, 4], [3, 5], [4, 5], [3, 6], [2, 7]]) put(im, x, y, '#45293f');
  return im;
}
/** fx:pipframe: 14x3 rounded trough for the 12 px progress bar (origin 1,0); fx:pipfill: 1x1 */
function drawPipFrame() {
  const im = img(14, 3);
  for (let x = 1; x < 13; x++) { put(im, x, 0, INK); put(im, x, 2, INK); put(im, x, 1, '#45293f'); }
  put(im, 0, 1, INK); put(im, 13, 1, INK);
  return im;
}
const fxs = [
  { name: 'fx:nopower', im: drawNoPower(), origin: [0, 0] },
  { name: 'fx:pipframe', im: drawPipFrame(), origin: [1, 0] },
  { name: 'fx:pipfill', im: (() => { const im = img(1, 1); put(im, 0, 0, '#cddf6c'); return im; })(), origin: [0, 0] },
];
// the arm's small parts (gen/arms.mjs): claws in 4 directions (+ the old dir-less names, pointing
// down), the winding key and the motor coil
const claws = [];
for (const id of Object.keys(ARM)) for (const st of [0, 1]) {
  for (let d = 0; d < 4; d++) claws.push({ name: `armh:${id}:${st}:${d}`, im: drawClaw(id, st, d), origin: [4, 4] });
  claws.push({ name: `armh:${id}:${st}`, im: drawClaw(id, st, 2), origin: [4, 4] });
}
for (let f = 0; f < 4; f++) claws.push({ name: `armh:key:${f}`, im: drawKey(f), origin: KEY_ORIGIN });
for (const side of [1, 3]) for (let f = 0; f < 4; f++) claws.push({ name: `armh:key:${f}:${side}`, im: drawSideKey(f, side), origin: SIDE_KEY_ORIGIN[side] });
for (let f = 0; f < 4; f++) claws.push({ name: `armh:coil:${f}`, im: drawCoil(f), origin: COIL_ORIGIN });
const wide = [];
for (const t of [1, 2, 3]) for (let f = 0; f < 4; f++) wide.push({ name: `split:${t}:${f}`, im: drawSplitter(t, f) });

const COLS = 16;
const rows16 = Math.ceil(cells.length / COLS);
const W = COLS * 16;
// small sprites (claws, keys, coils, fx) go on shelves below the 16 px cells and the splitters
const smalls = [...claws, ...fxs];
const shelfY0 = rows16 * 16 + Math.ceil(wide.length / 8) * 16;
const smallAt = [];
{
  let x = 0, y = shelfY0, rowH = 0;
  for (const c of smalls) {
    if (x + c.im.w > W) { x = 0; y += rowH + 1; rowH = 0; }
    smallAt.push([x, y]);
    x += c.im.w + 1;
    rowH = Math.max(rowH, c.im.h);
  }
  var H = y + rowH + 1;
}
const sheet = new Uint8Array(W * H * 4);
const rects = {};
function blitTo(im, ox, oy) {
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = get(im, x, y);
    if (!c) continue;
    const [r, g, b] = rgb(c);
    sheet.set([r, g, b, 255], ((oy + y) * W + ox + x) * 4);
  }
}
cells.forEach((c, i) => { const x = (i % COLS) * 16, y = Math.floor(i / COLS) * 16; blitTo(c.im, x, y); rects[c.name] = [x, y, 16, 16]; });
wide.forEach((c, i) => { const x = (i % 8) * 32, y = rows16 * 16 + Math.floor(i / 8) * 16; blitTo(c.im, x, y); rects[c.name] = [x, y, 32, 16]; });
const origins = {};
smalls.forEach((c, i) => { const [x, y] = smallAt[i]; blitTo(c.im, x, y); rects[c.name] = [x, y, c.im.w, c.im.h]; origins[c.name] = c.origin; });
fs.writeFileSync(path.join(OUT, 'origins.json'), JSON.stringify(origins));
fs.writeFileSync(path.join(OUT, 'belts.png'), encodePNG(W, H, sheet));
fs.writeFileSync(path.join(OUT, 'belts.json'), JSON.stringify(rects, null, 0));
const big = upscale({ w: W, h: H, data: sheet }, 4);
fs.writeFileSync(path.resolve(HERE, '../../../e2e/out/belts.x4.png'), encodePNG(big.w, big.h, big.data));
console.log(`belts.png ${W}x${H}: ${cells.length + wide.length} sprites`);
