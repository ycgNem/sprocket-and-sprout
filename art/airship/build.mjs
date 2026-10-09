// The Brass Vixen (Roxy Vane's airship, Skyhook Field): turns the chosen PixelLab candidate into
// the graded, cleaned and animated frames of bld:airship:<season>:<night>:<frame> and writes the
// sprites-import recipe.
//
//   node art/airship/build.mjs            -> art/airship/out/*.png, art/airship/sprites.json,
//                                            e2e/out/airship/*.png (previews)
//   node scripts/sprites-import.mjs art/airship/sprites.json   -> src/art/airship.png + .json
//
// Source: raw/p1_2.png (create_image_pro 144x168 with art/buildings/raw/styleref.png as the style
// image, candidate 2 of 4). Everything after the generation is done here by rule, so the import
// is repeatable:
//   grade     the envelope gets explicit wine / cream ramps (a plain snap turns cream into sage),
//             outlines become #2e222f, the rest snaps to the nearest palette color
//   glass     porthole / door / dormer glass becomes the store's night key ramp
//             (#484a77 #4d9be6 #8fd3ff -> #e6904e #fbb954 #fbff86 at night, as a recolor)
//   hand      mooring rope + stake (pixel grid), and per frame a waving pennant and a turning
//             propeller drawn by rule over the erased generated ones
//   bob       the envelope (and everything above its bottom edge) drops 1 px in frames 2-3
//   shadow    a soft dithered ground shadow under the hull, in a key color recolored per season
//   winter    snow on the envelope top, the cabin roof and the chimney (season 3 frames)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../scripts/lib/png.mjs';
import { nearest, PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

// ---------------------------------------------------------------- image as a grid of hex strings
const toGrid = (img) => {
  const g = [];
  for (let y = 0; y < img.h; y++) {
    const row = [];
    for (let x = 0; x < img.w; x++) {
      const p = (y * img.w + x) * 4;
      row.push(img.data[p + 3] < 128 ? null : '#' + [0, 1, 2].map((k) => img.data[p + k].toString(16).padStart(2, '0')).join(''));
    }
    g.push(row);
  }
  return g;
};
const W0 = (g) => g[0].length, H0 = (g) => g.length;
const clone = (g) => g.map((r) => r.slice());
const get = (g, x, y) => (y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : null);
const set = (g, x, y, c) => { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; };
const toImg = (g) => {
  const w = W0(g), h = H0(g), data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x]) data.set([...rgbOf(g[y][x]), 255], (y * w + x) * 4);
  return { w, h, data };
};
const save = (g, file, k = 1, bg = null) => {
  let img = toImg(g);
  if (bg) { const c = rgbOf(bg); for (let i = 0; i < img.data.length; i += 4) if (!img.data[i + 3]) img.data.set([...c, 255], i); }
  if (k > 1) img = upscale(img, k);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(img.w, img.h, img.data));
};
const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

// ---------------------------------------------------------------- 1. source + grade
const SRC = 'raw/p1_2.png';
const raw = toGrid(decodePNG(fs.readFileSync(path.join(here, SRC))));

// wine ramp for the envelope stripes and fins [deep, shadow, base, lit]. A (oxblood red with plum
// shadows) is the pick; B-D are the alternatives that were compared (--wine B, previews only).
const WINES = {
  A: ['#45293f', '#7a3045', '#ae2334', '#e83b3b'],
  B: ['#45293f', '#753c54', '#a24b6f', '#cf657f'],
  C: ['#45293f', '#6e2727', '#ae2334', '#c32454'],
  D: ['#45293f', '#7a3045', '#a24b6f', '#cf657f'],
};
const WINE = WINES[opt('wine', 'A')];
// cream ramp [deep, shadow, base]; STYLE: "map PixelLab's cream onto this ramp explicitly"
const CREAM = ['#966c6c', '#ab947a', '#fdcbb0'];

const OUTLINE = { '#280a23': '#2e222f', '#2d0b1f': '#2e222f' };
// envelope fabric (and fins): rows 0..69
const ENVELOPE = [0, 0, 144, 70];
const ENV_MAP = {
  '#982f48': WINE[2], '#732038': WINE[1], '#681e35': WINE[1], '#5a1932': WINE[0], '#4f162e': WINE[0],
  '#ecdeba': CREAM[2], '#c39b82': CREAM[1], '#9a655d': CREAM[0],
};
// glass: hull portholes, door window, cabin portholes, dormer window
const GLASS = [[34, 107, 6, 6], [49, 107, 6, 6], [85, 107, 7, 6], [100, 107, 7, 6], [68, 109, 5, 4], [99, 92, 5, 4], [113, 92, 5, 4], [105, 79, 6, 6]];
const GLASS_KEY = ['#484a77', '#4d9be6', '#8fd3ff'];
const GLASS_MAP = { '#5d95b9': GLASS_KEY[1], '#97d9f9': GLASS_KEY[2], '#2a639a': GLASS_KEY[0], '#495679': GLASS_KEY[0] };
// everywhere else: warm the few cool grays the generator used (ropes, rail, propeller tips)
const REST_MAP = { '#948a8e': '#966c6c', '#495679': '#3e3546', '#6e4e57': '#694f62', '#ecdeba': '#fdcbb0' };

const graded = clone(raw);
for (let y = 0; y < H0(raw); y++)
  for (let x = 0; x < W0(raw); x++) {
    const c = raw[y][x];
    if (!c) continue;
    let out = OUTLINE[c];
    if (!out && GLASS.some((r) => inRect(x, y, r))) out = GLASS_MAP[c];
    if (!out && inRect(x, y, ENVELOPE)) out = ENV_MAP[c];
    if (!out) out = REST_MAP[c];
    if (!out) out = PAL[nearest(...rgbOf(c), 2).i];
    if (out === '#4d65b4') out = GLASS_KEY[0];
    // keep the night keys inside the glass only
    if (GLASS_KEY.includes(out) && !GLASS.some((r) => inRect(x, y, r))) out = '#3e3546';
    graded[y][x] = out;
  }

// ---------------------------------------------------------------- 2. frame layout
// The frame is the raw canvas widened 6 px to the left (room for the mooring stake) and cut to
// 148 x 148. Footprint 8 x 5 tiles (128 x 80): its bottom row is the frame's bottom row, and the
// gangplank (raw x 62..78, center 70) lands on the door tile x = 4 (footprint px 64..80).
const DX = 6;                       // frame x = raw x + DX
const FW = 148, FH = 148;
const FOOT = { w: 128, h: 80 };
const ORIGIN = [DX - 2, FH - FOOT.h]; // [4, 68]: footprint x = raw x + 2

// colors
const O = '#2e222f';
const SNOW = ['#ffffff', '#c7dcd0'];
const SHADOW_KEY = '#165a4c';       // only the ground shadow uses it; recolored per season
const SHADOW = { 0: SHADOW_KEY, 1: SHADOW_KEY, 2: '#4c3e24', 3: '#9babb2' };

const base = Array.from({ length: FH }, () => new Array(FW).fill(null));
for (let y = 0; y < Math.min(FH, H0(graded)); y++) for (let x = 0; x < W0(graded); x++) if (graded[y][x] && x + DX < FW) base[y][x + DX] = graded[y][x];
const P = (g, x, y, c) => set(g, x + DX, y, c);       // raw coords
const G = (g, x, y) => get(g, x + DX, y);

// the generated pennant and propeller blades are redrawn per frame
for (let y = 0; y <= 11; y++) for (let x = 69; x <= 86; x++) P(base, x, y, null);
for (let y = 95; y <= 127; y++) for (let x = 131; x <= 141; x++) if (y < 109 || y > 113) P(base, x, y, null);

// ---------------------------------------------------------------- 3. mooring rope and stake
{
  // stake: a wooden post left of the bow, rope wrapped under its top
  const stake = [
    '.OOO.',
    'OiaaO',
    'OadgO',
    'ObbbO',
    'OadgO',
    'OadgO',
    'OadgO',
    'OadgO',
    'OadgO',
    'OadgO',
    'OgggO',
    '.OOO.',
  ];
  const C = { O, i: '#e6904e', a: '#cd683d', d: '#9e4539', g: '#7a3045', b: '#6e2727' };
  const sx = -5, sy = 128;
  stake.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') P(base, sx + i, sy + j, C[ch]); }));
  // the line: quadratic curve from the bow cleat down to the wrap, sagging a little
  const p0 = [11, 99], p2 = [0, 131], p1 = [7, 122];
  let last = null;
  for (let t = 0; t <= 1.0001; t += 0.005) {
    const x = Math.round((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]);
    const y = Math.round((1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]);
    if (last && last[0] === x && last[1] === y) continue;
    last = [x, y];
    if (!G(base, x, y)) P(base, x, y, '#9e4539');
    if (!G(base, x + 1, y)) P(base, x + 1, y, O);
  }
}

// ---------------------------------------------------------------- 4. per-frame parts
// pennant: a tapered flag on the mast (hoist at raw x 69, center row 6), a wave runs to the tail
const PEN = { lit: '#e83b3b', base: '#ae2334', shade: '#7a3045' };
function pennant(g, f) {
  const L = 13, x0 = 69, cy = 6;
  const cloth = new Map(); // "x,y" -> color (fill only; the outline goes around it afterwards)
  let pt = null, pb = null;
  for (let c = 0; c < L; c++) {
    const ph = 2 * Math.PI * (c / 10 - f / 4);
    const dy = Math.round(1.4 * (c / (L - 1)) * Math.sin(ph));
    const hh = 2 * (1 - c / (L - 1)) + 0.3;
    let top = Math.round(cy - hh) + dy, bot = Math.round(cy + hh) + dy;
    // keep the cloth in one piece: each column touches the one before it
    if (pt != null) { if (top > pb) top = pb; if (bot < pt) bot = pt; }
    pt = top; pb = bot;
    const fold = Math.cos(ph);
    const body = fold > 0.6 ? PEN.lit : fold < -0.6 ? PEN.shade : PEN.base;
    for (let y = top; y <= bot; y++) cloth.set(`${x0 + c},${y}`, bot - top >= 2 && y === top && body !== PEN.shade ? PEN.lit : bot - top >= 2 && y === bot ? PEN.shade : body);
  }
  for (const [k, c] of cloth) { const [x, y] = k.split(',').map(Number); P(g, x, y, c); }
  for (const k of cloth.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [ax, ay] of [[x + 1, y], [x, y - 1], [x, y + 1], [x + 1, y - 1], [x + 1, y + 1]])
      if (ax >= x0 && !cloth.has(`${ax},${ay}`) && !G(g, ax, ay)) P(g, ax, ay, O);
  }
}

// propeller: two brass blades seen edge-on (the shaft points right); the visible length follows
// the turn (long, short, nub, short) and the face shading flips, so 4 frames read as spinning
const BLADE = { lit: [O, '#fbb954', '#cd683d', '#9e4539', O], dark: [O, '#cd683d', '#9e4539', '#6e2727', O] };
const ROOT_ROW = [O, '#9e4539', '#cd683d', '#9e4539', O];
const PROP = [{ len: 10, up: 'lit', down: 'dark' }, { len: 6, up: 'lit', down: 'lit' }, { len: 1, up: 'dark', down: 'dark' }, { len: 6, up: 'dark', down: 'dark' }];
function propeller(g, f) {
  const p = PROP[f];
  const blade = (y0, dir, face) => {
    for (let i = 0; i < p.len; i++) BLADE[face].forEach((c, k) => P(g, 131 + k, y0 + dir * i, i === 0 ? ROOT_ROW[k] : c));
    for (let k = 1; k <= 3; k++) P(g, 131 + k, y0 + dir * p.len, O);
  };
  blade(108, -1, p.up);
  blade(114, +1, p.down);
}

// envelope bob: everything in rows 0..69 (envelope, fins, nose, mast, pennant, rope tops) drops
// 1 px; the gondola, cabin and chimney (row 70 and below) never move
const BOB = [0, 0, 1, 1], BOB_ROWS = 70;
function bob(g, d) {
  if (!d) return g;
  const out = clone(g);
  for (let y = 0; y < BOB_ROWS; y++) for (let x = 0; x < FW; x++) out[y][x] = null;
  for (let y = 0; y < BOB_ROWS; y++) for (let x = 0; x < FW; x++) if (g[y][x]) out[y + d][x] = g[y][x];
  return out;
}

// ground shadow under the hull: solid core, checker-dithered rim, only on empty pixels
function shadow(g) {
  const cx = 70 + DX, cy = 136, rx = 57, ry = 5.5;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1 || get(g, x, y)) continue;
      if (d < 0.5 || (x + y) % 2 === 0) set(g, x, y, SHADOW_KEY);
    }
  return g;
}

// ---------------------------------------------------------------- 5. winter
const hash = (x) => ((x * 73856093) ^ (x * 19349663)) >>> 0;
function snow(g) {
  const s = clone(g);
  // envelope top: under the outline, 1-3 px of snow where the top is flat enough to hold it
  const top = (x) => {
    for (let y = x >= 62 && x <= 71 ? 17 : 12; y < 60; y++) if (G(g, x, y)) return y;
    return null;
  };
  for (let x = 15; x <= 122; x++) {
    const y = top(x), a = top(x - 2), b = top(x + 2);
    if (y == null || a == null || b == null) continue;
    const slope = Math.abs(a - b);
    let depth = slope <= 1 ? 4 : slope <= 3 ? 3 : slope <= 6 ? 2 : slope <= 9 ? 1 : 0;
    if (depth >= 3 && hash(x) % 3 === 0) depth++;
    for (let i = 1; i <= depth; i++) if (G(g, x, y + i) && G(g, x, y + i) !== O) P(s, x, y + i, i === depth && depth > 1 ? SNOW[1] : SNOW[0]);
  }
  // cabin roof (outline row 76), clear of the dormer and the chimney
  for (let x = 89; x <= 128; x++) {
    if ((x >= 103 && x <= 111) || (x >= 116 && x <= 122)) continue;
    if (G(g, x, 76) !== O) continue;
    P(s, x, 77, SNOW[0]);
    if (hash(x) % 3 !== 0) P(s, x, 78, SNOW[1]);
  }
  for (let x = 117; x <= 121; x++) P(s, x, 71, SNOW[0]); // chimney cap
  for (let x = 104; x <= 107; x++) if (G(g, x, 74) && G(g, x, 74) !== O) P(s, x, 74, SNOW[0]); // dormer peak
  for (let x = 86; x <= 92; x++) if (G(g, x, 135) && G(g, x, 135) !== O) P(s, x, 135, SNOW[0]); // front crate
  for (let x = 97; x <= 102; x++) if (G(g, x, 131) && G(g, x, 131) !== O) P(s, x, 131, SNOW[0]); // back crate
  return s;
}

// ---------------------------------------------------------------- 6. frames, recipe, previews
const GLASS_NIGHT = { '#484a77': '#e6904e', '#4d9be6': '#fbb954', '#8fd3ff': '#fbff86' };
const OUTDIR = path.join(here, 'out');
const PREV = path.join(ROOT, 'e2e/out/airship');
fs.mkdirSync(OUTDIR, { recursive: true });
const frames = {}; // 'day' | 'winter' -> [4 grids]
for (const [kind, src] of [['day', base], ['winter', snow(base)]]) {
  frames[kind] = [0, 1, 2, 3].map((f) => {
    const g = clone(src);
    pennant(g, f);
    propeller(g, f);
    return shadow(bob(g, BOB[f]));
  });
  frames[kind].forEach((g, f) => save(g, path.join(OUTDIR, `${kind}${f}.png`)));
}

const sprites = [];
for (let s = 0; s < 4; s++)
  for (let n = 0; n < 2; n++)
    for (let f = 0; f < 4; f++) {
      const recolor = { ...(SHADOW[s] !== SHADOW_KEY ? { [SHADOW_KEY]: SHADOW[s] } : {}), ...(n ? GLASS_NIGHT : {}) };
      sprites.push({
        match: `bld:airship:${s}:${n}:${f}`,
        file: `out/${s === 3 ? 'winter' : 'day'}${f}.png`,
        place: 'none', frame: [FW, FH], origin: ORIGIN, keepStrays: true,
        ...(Object.keys(recolor).length ? { recolor } : {}),
      });
    }
const recipe = {
  name: 'airship',
  kind: 'sprites',
  meta: { footprint: [8, 5], door: [4, 4], frames: 4, source: 'art/airship/raw/p1_2.png' },
  sprites,
};
fs.writeFileSync(path.join(here, 'sprites.json'), JSON.stringify(recipe, null, 1) + '\n');

// previews: 4 frames day and night at 3x on grass, fall and winter strips
const recolorGrid = (g, map) => g.map((r) => r.map((c) => (c && map[c]) || c));
const strip = (gs, bg) => {
  const gap = 4, w = gs.length * (FW + gap) + gap, h = FH + 2 * gap;
  const out = Array.from({ length: h }, () => new Array(w).fill(bg));
  gs.forEach((g, i) => { for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (g[y][x]) out[y + gap][x + gap + i * (FW + gap)] = g[y][x]; });
  return out;
};
save(strip(frames.day, '#239063'), path.join(PREV, 'frames-day.png'), 3);
save(strip(frames.day.map((g) => recolorGrid(g, GLASS_NIGHT)), '#239063'), path.join(PREV, 'frames-night.png'), 3);
save(strip(frames.day.map((g) => recolorGrid(g, { [SHADOW_KEY]: SHADOW[2] })), '#676633'), path.join(PREV, 'frames-fall.png'), 3);
save(strip(frames.winter.map((g) => recolorGrid(g, { [SHADOW_KEY]: SHADOW[3] })), '#ffffff'), path.join(PREV, 'frames-winter.png'), 3);
console.log(`airship: ${sprites.length} sprite names, frame ${FW}x${FH}, origin [${ORIGIN}], footprint ${FOOT.w}x${FOOT.h}`);

