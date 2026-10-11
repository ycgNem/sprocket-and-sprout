// The Deepworks machines (deep:<kind>:<restored>:<frame>, src/render/art/deep.ts): one PixelLab
// candidate per machine (art/deep/raw/, see raw/batches.json) is the restored machine; this script
// derives every frame from it, so all frames of a machine share one silhouette and ground line:
//   working frames: only the moving part changes (a sheave wheel, a nodding beam with its rods and
//     flywheel, a firebox, spark globes and a dynamo, cart wheels, a lamp, the star's twinkles);
//   derelict (on = 0): the same machine tarnished one shade down with rust, berry and plum
//     blotches, a missing plate, lamps out (the sim's faint lights keep a faint source).
// Writes art/deep/out/<kind>-<on>-<f>.png at their final frame size plus art/deep/frames.json
// (frame size and anchor per kind), which art/deep/sprites.json lists for the importer.
// Usage: node art/deep/build.mjs  (then node scripts/sprites-import.mjs art/deep/sprites.json)
import fs from 'node:fs';
import path from 'node:path';
import { Img, DEEP, ROOT, sheet, hash } from './tools/lib.mjs';

const OUT = path.join(DEEP, 'out');
const raw = (batch, slot) => Img.load(path.join(DEEP, 'raw', batch, slot + '.png'), { snap: true });
const inR = (x, y, [x0, y0, w, h]) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;

// ---- palette names (Resurrect 64) ----
const C = {
  ink: '#2e222f', plum: '#3e3546', mauve: '#625565', bark: '#45293f', wine: '#753c54', berry: '#7a3045', rust: '#9e4539',
  terra: '#cd683d', apricot: '#e6904e', amber: '#fbb954', copperDk: '#6e2727', copperMd: '#b33831', copper: '#ea4f36',
  copperLt: '#f57d4a', peach: '#fca790', cream: '#fdcbb0', ember: '#fb6b1d', brass: '#f79617', gold: '#f9c22b', butter: '#fbff86',
  taupe: '#966c6c', tan: '#ab947a', frost: '#c7dcd0', pebble: '#9babb2', lilac: '#7f708a',
  moss: '#165a4c', jade: '#239063', deep1: '#323353', deep2: '#484a77', river: '#4d65b4', sky: '#4d9be6', aqua: '#8fd3ff',
  teal: '#0b8a8f', mint: '#8ff8e2', violet: '#905ea9', lavender: '#a884f3', pink: '#eaaded', grape: '#6b3e75',
};
const DARK = new Set([C.ink, C.bark, C.plum, C.copperDk, C.berry, C.wine, C.grape, C.deep1, '#313638', '#374e4a']);

/** close the outline where a light pixel touches transparency: plum-black on the shadow side
 *  (below / right of the art), the darkest material shade on the lit top-left (STYLE.md) */
function closeOutline(im) {
  const src = im.clone();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (src.get(x, y)) continue;
    const n = [[x, y - 1, 'below'], [x - 1, y, 'right'], [x, y + 1, 'above'], [x + 1, y, 'left']]
      .filter(([a, b]) => src.get(a, b) && !DARK.has(src.get(a, b)));
    if (!n.length) continue;
    im.set(x, y, n.some(([, , side]) => side === 'below' || side === 'right') ? C.ink : C.bark);
  }
  return im;
}

/** derelict: every material one shade down, glass dull, then rust / berry / plum blotches */
const TARNISH = {
  [C.butter]: C.apricot, [C.gold]: C.terra, [C.amber]: C.terra, [C.brass]: C.rust, [C.ember]: C.rust,
  [C.apricot]: C.terra, [C.terra]: C.rust, [C.rust]: C.berry,
  [C.peach]: C.terra, [C.copperLt]: C.rust, [C.copper]: C.copperMd, [C.copperMd]: C.copperDk,
  [C.frost]: C.lilac, [C.pebble]: C.mauve, [C.lilac]: C.mauve, [C.tan]: C.taupe, [C.cream]: C.tan,
};
function decay(im, { seed = 1, p = 0.14, skip = [], rect = [0, 0, im.w, im.h] } = {}) {
  const src = im.clone();
  for (let y = rect[1]; y < rect[1] + rect[3]; y++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) {
    const c = src.get(x, y);
    if (!c || c === C.ink || skip.some((r) => inR(x, y, r))) continue;
    let o = TARNISH[c] ?? c;
    const r = hash(x >> 1, y >> 1, seed), r2 = hash(x, y, seed + 7);
    // blotches in 2x2 cells (ragged edges from the per-pixel hash); outlines and darks stay
    if (r < p && r2 < 0.8 && !DARK.has(c)) o = r < p * 0.4 ? C.berry : r < p * 0.75 ? C.rust : C.bark;
    im.set(x, y, o);
  }
  return im;
}

/** rust streaks running down from a row of points (for painted panels) */
function streaks(im, pts, len = 5, seed = 3) {
  for (const [x, y] of pts) {
    const n = 2 + Math.floor(hash(x, y, seed) * len);
    for (let k = 0; k < n; k++) {
      const c = im.get(x, y + k);
      if (!c || c === C.ink) break;
      im.set(x, y + k, k === 0 ? C.berry : k < n - 1 ? C.rust : C.taupe);
    }
  }
  return im;
}

/** a spoked wheel's inside: interior cleared to `back`, n spokes at angle a (deg), a hub on top.
 *  (cx, cy) is the continuous centre; pixels whose centres lie within r are the interior. */
function spokes(im, cx, cy, r, a, n, { back = C.bark, spoke = C.terra, lit = C.apricot, hub = C.brass, hubLit = C.gold, clip = () => true, broken = [] } = {}) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++)
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r && clip(x, y)) im.set(x, y, back);
  for (let k = 0; k < n; k++) {
    if (broken.includes(k)) continue;
    const t = ((a + (k * 360) / n) * Math.PI) / 180, dx = Math.cos(t), dy = Math.sin(t);
    // spokes on the upper-left half catch the light
    const col = dx + dy < -0.2 ? lit : spoke;
    for (let s = 1; s < r - 0.2; s += 0.35) {
      const x = Math.floor(cx + dx * s), y = Math.floor(cy + dy * s);
      if (clip(x, y)) im.set(x, y, col);
    }
  }
  const hx = Math.floor(cx - 0.5), hy = Math.floor(cy - 0.5);
  for (const [x, y, c] of [[hx, hy, hubLit], [hx + 1, hy, hub], [hx, hy + 1, hub], [hx + 1, hy + 1, C.rust]]) if (clip(x, y)) im.set(x, y, c);
  return im;
}

/** shift a set of pixels (a Map "x,y" -> color) by dy(x) and paint them */
function paintShifted(im, pix, dyOf) {
  for (const [k, c] of pix) { const [x, y] = k.split(',').map(Number); im.set(x, y + dyOf(x), c); }
  return im;
}

/** take pixels matching pred out of im (returns them as a Map) */
function lift(im, pred) {
  const m = new Map();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = im.get(x, y);
    if (c && pred(x, y, c)) { m.set(x + ',' + y, c); im.set(x, y, null); }
  }
  return m;
}

const MACHINES = {}; // kind -> { foot (tiles), footX (canvas x of the footprint's left edge), frames: { 1: Img[], 0: Img[] } }

// ---------------------------------------------------------------------------------------------
// The old lift (D1/15): a barred cage under a brass sheave wheel, a hand winch on the left, a
// lantern on the right. Working: the wheel turns (spokes 45 degrees a frame), the lantern flickers.
// Derelict: the lantern out, two spokes gone, a bar missing and one bent.
{
  const b = raw('D1', 15);
  b.recolor({ '#ab947a': C.taupe });
  // the dark of the shaft behind the bars (PixelLab left the cage see-through, and the busy
  // Earth floor showing between the bars hid the cage)
  const shaft = (x, y) => (y <= 20 ? C.ink : C.plum);
  for (let y = 19; y <= 31; y++) for (let x = 15; x <= 27; x++) if (!b.get(x, y)) b.set(x, y, shaft(x, y));
  closeOutline(b);
  const W = { cx: 21, cy: 7.2, r: 4.6, clip: (x, y) => y <= 9 };
  const lantern = [[34, 29], [35, 29], [34, 30], [35, 30]];
  const on = [0, 1, 2, 3].map((f) => {
    const im = b.clone();
    spokes(im, W.cx, W.cy, W.r, 22.5 * f + 10, 4, { clip: W.clip });
    // the lantern breathes: the core dims on the odd frames
    if (f % 2) { im.set(35, 29, C.gold); im.set(34, 30, C.gold); }
    im.set(34, 28, f % 2 ? C.apricot : C.amber); im.set(35, 28, f % 2 ? C.apricot : C.amber);
    return im;
  });
  const off = b.clone();
  spokes(off, W.cx, W.cy, W.r, 22.5 + 10, 4, { clip: W.clip, broken: [1] });
  for (const [x, y] of lantern) off.set(x, y, C.plum);
  off.set(34, 29, C.mauve); off.set(34, 28, C.bark); off.set(35, 28, C.bark);
  // a missing bar, another bent in
  for (let y = 19; y <= 31; y++) { off.set(24, y, shaft(24, y)); off.set(25, y, shaft(25, y)); }
  for (let y = 25; y <= 27; y++) { off.set(19, y, C.apricot); off.set(20, y, C.bark); off.set(21, y, shaft(21, y)); }
  decay(off, { seed: 11, p: 0.16 });
  MACHINES.lift = { foot: 2, footX: 5, frames: { 1: on, 0: [off] } };
}

// ---------------------------------------------------------------------------------------------
// The old pump (D1/33): a beam engine. Working: the beam nods about its pivot (21, 9), the piston
// rod (x 10) and the connecting rod (x 31-32) follow it, the crank pin goes round the flywheel.
// Derelict: still, rusted, a spoke broken, the sump full of standing water.
{
  const b = raw('D1', 33);
  closeOutline(b);
  const isLeftRod = (x, y) => x === 10 && y >= 8 && y <= 17;
  const isRightRod = (x, y) => (x === 31 || x === 32) && y >= 15 && y <= 26;
  const isBearing = (x, y) => x >= 16 && x <= 25 && y >= 11;
  const beam = lift(b, (x, y) => y <= 14 && x >= 8 && !isLeftRod(x, y) && !isBearing(x, y));
  lift(b, (x, y) => isLeftRod(x, y) || isRightRod(x, y));
  const FW = { cx: 31.5, cy: 34, r: 4.6 };
  // frames: crank pin left, top, right, bottom; the beam's right end follows the pin
  const POSE = [{ a: 0, pin: [29, 33] }, { a: -2, pin: [31, 31] }, { a: 0, pin: [33, 33] }, { a: 2, pin: [31, 35] }];
  const dyOf = (a) => (x) => Math.round((a * (x - 21)) / 13);
  const draw = (f, derelict) => {
    const { a, pin } = POSE[f];
    const im = b.clone();
    spokes(im, FW.cx, FW.cy, FW.r, 22.5 * f, 4, derelict ? { broken: [2] } : {});
    // the connecting rod from the beam's right end down to the crank pin (2 px wide)
    const top = 15 + dyOf(a)(31.5);
    const steps = pin[1] - top;
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(31 + ((pin[0] - 31) * k) / Math.max(1, steps)), y = top + k;
      im.set(x, y, k < 2 ? C.bark : C.rust); im.set(x + 1, y, k < 2 ? C.bark : C.copperDk);
    }
    im.set(pin[0], pin[1], C.gold); im.set(pin[0] + 1, pin[1], C.brass); im.set(pin[0], pin[1] + 1, C.brass); im.set(pin[0] + 1, pin[1] + 1, C.rust);
    // the piston rod from the beam's left end down into the cylinder
    const lt = 8 + dyOf(a)(10);
    for (let y = lt; y <= 17; y++) im.set(10, y, y === lt ? C.berry : C.copperDk);
    paintShifted(im, beam, dyOf(a));
    return im;
  };
  const on = [0, 1, 2, 3].map((f) => draw(f, false));
  const off = draw(0, true);
  // the sump (the stone trough under the trestle) stands full of water
  for (let y = 34; y <= 36; y++) for (let x = 9; x <= 23; x++) {
    const c = off.get(x, y);
    if (c === C.taupe || c === C.tan) off.set(x, y, y === 34 ? C.deep2 : (x + y) % 5 === 0 ? C.sky : C.river);
  }
  decay(off, { seed: 5, p: 0.15, skip: [[9, 34, 15, 3]] });
  MACHINES.pump = { foot: 2, footX: 4, frames: { 1: on, 0: [off] } };
}

// ---------------------------------------------------------------------------------------------
// The rail cart (D1/42): a plank tub heaped with ore on rails, a lantern hung on the front.
// Working: the wheels turn (a bright spoke goes round each), the ore glints, the lantern flickers.
// Derelict: the heap is rubble, a plank is missing, the wheels seized, the lantern down to a glow.
{
  const b = raw('D1', 42);
  b.recolor({ '#ffffff': C.butter, '#b2ba90': C.tan });
  closeOutline(b);
  const inHeap = (x, y) => y <= 10 ? true : y <= 17 && x >= 8 && x <= 32;
  const WHEELS = [[6, 33], [32, 33]];
  const GLINTS = [[16, 13], [27, 9], [12, 16], [25, 16]];
  const on = [0, 1, 2, 3].map((f) => {
    const im = b.clone();
    // a spoke catching the light goes round each 4x4 wheel (inner 2x2: TL, TR, BR, BL)
    for (const [wx, wy] of WHEELS) {
      const inner = [[1, 1], [2, 1], [2, 2], [1, 2]];
      inner.forEach(([dx, dy], k) => im.set(wx + dx, wy + dy, k === f ? C.apricot : k === (f + 2) % 4 ? C.berry : C.rust));
    }
    GLINTS.forEach(([x, y], k) => { if (im.get(x, y)) im.set(x, y, k === f ? C.butter : C.gold); });
    if (f % 2) im.set(4, 28, C.gold);
    return im;
  });
  const off = b.clone();
  // rubble in place of the ore: the same heap in warm stone
  const STONE = [C.plum, C.mauve, C.taupe, C.tan];
  const lum = { [C.butter]: 3, [C.amber]: 3, [C.apricot]: 3, [C.gold]: 3, [C.terra]: 2, [C.rust]: 2, [C.tan]: 3, [C.taupe]: 2, [C.copperDk]: 1, [C.berry]: 1, [C.wine]: 1, [C.mauve]: 1 };
  for (let y = 0; y < off.h; y++) for (let x = 0; x < off.w; x++) {
    const c = off.get(x, y);
    if (!c || !inHeap(x, y) || c === C.ink || c === C.bark) continue;
    const l = lum[c] ?? 1;
    off.set(x, y, STONE[Math.max(0, Math.min(3, l - (hash(x, y, 4) < 0.3 ? 1 : 0)))]);
  }
  // a plank gone from the front
  for (let y = 26; y <= 28; y++) for (let x = 13; x <= 18; x++) off.set(x, y, y === 26 ? C.bark : C.ink);
  // the lantern down to a low flame
  off.set(4, 27, C.terra); off.set(4, 28, C.rust); off.set(3, 27, C.berry); off.set(3, 28, C.berry);
  decay(off, { seed: 13, p: 0.15, skip: [[2, 25, 4, 5]] });
  MACHINES.cart = { foot: 2, footX: 5, frames: { 1: on, 0: [off] } };
}

// ---------------------------------------------------------------------------------------------
// The fallen star (D1/53): a lump of starmetal in its crater. Always alive: its brightest facets
// pulse and the twinkles round it come and go (restored and derelict are the same art).
{
  const b = raw('D1', 53);
  const HI = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === '#ffffff') HI.push([x, y]);
  b.recolor({ '#ffffff': C.cream, '#b2ba90': C.butter });
  // the three twinkles PixelLab drew (redrawn per frame below), plus two more that come and go
  const TW = [[29, 9], [10, 15], [33, 15], [5, 21], [37, 7]];
  for (const [x, y] of TW.slice(0, 3)) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + dy, null);
  closeOutline(b);
  const twinkle = (im, [x, y], s) => {
    if (s === 2) { im.set(x, y, C.butter); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) im.set(x + dx, y + dy, C.amber); }
    else if (s === 1) im.set(x, y, C.gold);
  };
  const PULSE = [C.pink, C.cream, C.butter, C.cream];
  const on = [0, 1, 2, 3].map((f) => {
    const im = b.clone();
    // (at the peak only half the facets flare, so it shimmers rather than blinks)
    for (const [x, y] of HI) if (im.get(x, y) === C.cream) im.set(x, y, PULSE[f] === C.butter && hash(x, y, 2) < 0.5 ? C.cream : PULSE[f]);
    TW.forEach((p, k) => twinkle(im, p, [2, 1, 0, 1][(f + k) % 4] * (k >= 3 && (f + k) % 2 ? 0 : 1)));
    return im;
  });
  MACHINES.star = { foot: 2, footX: 5, frames: { 1: on, 0: on.map((im) => im.clone()) }, keepStrays: true };
}

// ---------------------------------------------------------------------------------------------
// The seized boiler (D2/5): a riveted copper drum on a brick base, firebox at the front left, two
// gauges, a stack. Working: the fire flickers in the firebox and the ash pit, the gauge needle
// ticks. Derelict (how the game shows it): firebox cold but for two dying embers (the sim's faint
// terracotta light), gauge glass dull and cracked, a plate missing, moss at the foot.
{
  const b = raw('D2', 5);
  b.recolor({ '#b2ba90': C.cream });
  closeOutline(b);
  const FIRE = [C.copperMd, C.copper, C.ember, C.brass, C.amber, C.butter];
  const fireRects = [[7, 31, 11, 13], [7, 47, 5, 3]];
  const isFire = (x, y) => fireRects.some((r) => inR(x, y, r)) && FIRE.includes(b.get(x, y));
  const on = [0, 1, 2, 3].map((f) => {
    const im = b.clone();
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      if (!isFire(x, y)) continue;
      const r = hash(x, y, 31 * f + 7), i = FIRE.indexOf(im.get(x, y));
      const s = (r < 0.22 ? -1 : r > 0.78 ? 1 : 0) + (f === 2 ? -1 : 0);
      im.set(x, y, FIRE[Math.max(0, Math.min(5, i + s))]);
    }
    // the needle of the big gauge ticks across its dial
    im.set(20, 15, C.ink);
    im.set([19, 20, 21, 20][f], 14, C.copperMd);
    return im;
  });
  const off = b.clone();
  for (let y = 0; y < off.h; y++) for (let x = 0; x < off.w; x++) {
    if (!isFire(x, y)) continue;
    const i = FIRE.indexOf(off.get(x, y));
    off.set(x, y, i >= 4 ? C.bark : i >= 2 ? C.plum : C.ink);
  }
  for (const [x, y, c] of [[11, 41, C.copperMd], [12, 41, C.copperDk], [9, 40, C.copperDk]]) off.set(x, y, c);
  // dull gauge glass with a crack
  off.recolor({ [C.cream]: C.taupe }, [10, 10, 15, 10]);
  off.set(19, 14, C.bark); off.set(20, 15, C.bark); off.set(21, 15, C.ink);
  // a plate gone from the drum
  for (let y = 28; y <= 31; y++) for (let x = 33; x <= 36; x++) off.set(x, y, y === 28 ? C.bark : C.ink);
  // moss at the foot of the brickwork
  for (const [x, y] of [[3, 45], [4, 45], [4, 44], [5, 46], [3, 46], [44, 44], [45, 44], [45, 43], [46, 44]]) if (off.get(x, y) && off.get(x, y) !== C.ink) off.set(x, y, (x + y) % 3 ? C.jade : C.moss);
  decay(off, { seed: 21, p: 0.13, skip: [[3, 43, 4, 4], [44, 43, 3, 2]] });
  MACHINES.boiler = { foot: 3, footX: 4, frames: { 1: on, 0: [off] } };
}

// ---------------------------------------------------------------------------------------------
// The lamp works (D2/7): spark coils in four glass globes on a bench, wired to a dynamo. Working:
// the globes light in turn and their sparks crackle. Derelict (how the game shows it): dead glass,
// one globe still glimmering aqua on alternate frames (the sim's faint aqua light).
{
  const b = raw('D2', 7);
  b.recolor({ '#313638': C.plum, '#374e4a': C.teal, '#b2ba90': C.tan });
  closeOutline(b);
  const GLOBES = [[6, 20, 10, 9], [16, 17, 10, 10], [26, 14, 10, 10], [36, 11, 10, 10]];
  const SPARK = [C.teal, C.aqua, C.mint];
  const inGlobe = (x, y) => GLOBES.findIndex((r) => inR(x, y, r));
  const on = [0, 1, 2, 3].map((f) => {
    const im = b.clone();
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const g = inGlobe(x, y), c = im.get(x, y);
      if (g < 0 || !c) continue;
      if (c === C.frost && g === f && hash(x, y, 3) < 0.55) im.set(x, y, C.mint);
      else if (SPARK.includes(c)) im.set(x, y, SPARK[(SPARK.indexOf(c) + f + g) % 3]);
    }
    return im;
  });
  const dead = b.clone();
  for (let y = 0; y < dead.h; y++) for (let x = 0; x < dead.w; x++) {
    const g = inGlobe(x, y), c = dead.get(x, y);
    if (g < 0 || !c) continue;
    if (c === C.frost) dead.set(x, y, C.plum);
    else if (c === C.pebble) dead.set(x, y, C.mauve);
    else if (SPARK.includes(c)) dead.set(x, y, g === 2 ? C.teal : C.bark);
  }
  // a dull reflection on each globe (upper left)
  for (const [x, y] of GLOBES) { dead.set(x + 3, y + 2, C.lilac); dead.set(x + 2, y + 3, C.lilac); dead.set(x + 3, y + 3, C.mauve); }
  decay(dead, { seed: 17, p: 0.12, skip: GLOBES });
  const off = [dead, dead.clone()];
  for (let y = 0; y < off[1].h; y++) for (let x = 0; x < off[1].w; x++) if (inGlobe(x, y) === 2 && off[1].get(x, y) === C.teal) off[1].set(x, y, hash(x, y, 9) < 0.5 ? C.aqua : C.mint);
  MACHINES.lampworks = { foot: 3, footX: 4, frames: { 1: on, 0: off } };
}

// ---------------------------------------------------------------------------------------------
// The old works' lockers (D2/11): three painted lockers, the middle one open on rolled blueprints,
// a miner's lamp hanging at the left (the sim lights it in both states, so it flickers in both).
// Derelict: rust runs from the seams and rivets, paint chipped to bare metal.
{
  const b = raw('D2', 11);
  const LAMP = [2, 19, 6, 15];
  b.recolor({ '#b2ba90': C.cream }, LAMP);
  b.recolor({ '#313638': C.plum });
  closeOutline(b);
  const flicker = (im, f) => { if (f) im.recolor({ [C.cream]: C.amber, [C.amber]: C.brass }, LAMP); return im; };
  const on = [0, 1].map((f) => flicker(b.clone(), f));
  const worn = b.clone();
  decay(worn, { seed: 23, p: 0.035, skip: [LAMP, [26, 18, 10, 30]] });
  // rust creeps up from the feet: denser toward the bottom edge of each locker
  for (let y = 40; y < worn.h; y++) for (let x = 4; x < 54; x++) {
    const c = worn.get(x, y);
    if (!c || DARK.has(c) || inR(x, y, [25, 18, 12, 32])) continue;
    const r = hash(x >> 1, y, 29);
    if (r < (y - 40) / 16) worn.set(x, y, r < (y - 40) / 40 ? C.berry : C.rust);
  }
  // rust runs down from the top seams, the vents and the handles
  const pts = [];
  for (let x = 6; x < 52; x++) if (hash(x, 1, 5) < 0.22 && x !== 25 && x !== 37) pts.push([x, x < 24 ? 17 + (x % 3) : 15 + (x % 2)]);
  pts.push([14, 40], [15, 40], [44, 38]);
  streaks(worn, pts, 6, 3);
  // chips of bare metal
  for (const [x, y] of [[9, 30], [10, 30], [10, 31], [20, 44], [21, 44], [47, 27], [48, 27], [48, 28], [41, 46]]) if (worn.get(x, y) && worn.get(x, y) !== C.ink) worn.set(x, y, (x + y) % 2 ? C.mauve : C.taupe);
  const off = [0, 1].map((f) => flicker(worn.clone(), f));
  MACHINES.lockers = { foot: 3, footX: 4, frames: { 1: on, 0: off } };
}

// ---------------------------------------------------------------------------------------------
// output: crop every machine to the union of its frames; the anchor is the footprint's
// bottom-left corner (ox = footprint left - crop left, oy = frame height: the art stands on the
// footprint's bottom edge)
fs.mkdirSync(OUT, { recursive: true });
const meta = {};
const review = [];
for (const [kind, m] of Object.entries(MACHINES)) {
  const all = [...m.frames[1], ...m.frames[0]];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const im of all) { const bb = im.bbox(); x0 = Math.min(x0, bb.x0); y0 = Math.min(y0, bb.y0); x1 = Math.max(x1, bb.x1); y1 = Math.max(y1, bb.y1); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  meta[kind] = { frame: [w, h], origin: [m.footX - x0, h], frames: { 1: m.frames[1].length, 0: m.frames[0].length } };
  for (const on of [1, 0]) m.frames[on].forEach((im, f) => {
    const c = im.crop(x0, y0, w, h);
    const off = c.offPalette();
    if (off.length) throw new Error(`${kind} ${on} ${f}: off-palette ${off}`);
    c.save(path.join(OUT, `${kind}-${on}-${f}.png`));
    review.push(c);
  });
  console.log(`${kind}: ${w}x${h}, origin ${meta[kind].origin}, frames on ${m.frames[1].length} / off ${m.frames[0].length}`);
}
fs.writeFileSync(path.join(DEEP, 'frames.json'), JSON.stringify(meta, null, 1) + '\n');
sheet(review, path.join(ROOT, 'e2e/out/deep/build.png'), { k: 4, cols: 5 });

// the importer's recipe: every frame by name, then a catch-all per kind and state (frame 0), so
// any frame index the renderer asks for (deepFrames in src/render/art/deep.ts) has imported art;
// then the works problems' doorways (o:<O.GALLERY = 52>:<state>:<season>, art/deep/gallery.mjs)
const sprites = [];
for (const [kind, m] of Object.entries(MACHINES)) {
  const { frame, origin } = meta[kind];
  for (const on of [1, 0]) {
    m.frames[on].forEach((_, f) => sprites.push({ match: `deep:${kind}:${on}:${f}`, file: `out/${kind}-${on}-${f}.png`, frame, origin, ...(m.keepStrays ? { keepStrays: true } : {}) }));
    sprites.push({ match: `deep:${kind}:${on}:*`, like: `deep:${kind}:${on}:0` });
  }
}
for (const v of [0, 1, 2, 3]) sprites.push({ match: `o:52:${v}:*`, file: `out/gallery-${v}.png`, frame: [16, 16], origin: [0, 0] });
const recipe = {
  _note: 'Generated by art/deep/build.mjs (machines) and art/deep/gallery.mjs (doorways); rerun those, then node scripts/sprites-import.mjs art/deep/sprites.json',
  name: 'deep', kind: 'sprites', defaults: { place: 'none' }, sprites,
};
fs.writeFileSync(path.join(DEEP, 'sprites.json'), JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + sprites.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n ]') + '\n');
console.log(`sprites.json: ${sprites.length} entries`);
