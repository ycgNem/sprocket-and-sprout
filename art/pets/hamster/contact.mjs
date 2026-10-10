// Contact sheet of the hamster art as imported (read back from src/art/creatures.* and src/art/home.*),
// at 4x: every coat and pose, the ball frames, the cage layers alone and stacked with a hamster in the
// bedding and one in the wheel on the farmhouse floor, and a farm scene at the game's 1x, 2x and 3x.
// Usage: node art/pets/hamster/contact.mjs → art/pets/hamster/contact.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { ROOT, blank, blit } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const K = 4; // art pixels → sheet pixels
const sheetOf = (name) => {
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art', name + '.json'), 'utf8'));
  return { M, P: decodePNG(fs.readFileSync(path.join(ROOT, 'src/art', M.file))) };
};
const SHEETS = [sheetOf('creatures'), sheetOf('home'), sheetOf('terrain')];
const cut = (P, [x, y, w, h]) => {
  const im = blank(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const p = ((y + yy) * P.w + x + xx) * 4;
    im.data.set(P.data.subarray(p, p + 4), (yy * w + xx) * 4);
  }
  return im;
};
/** a sprite exactly as the sheet registers it: { img, o } */
function spr(match) {
  for (const { M, P } of SHEETS.slice(0, 2)) {
    const s = M.sprites.find((q) => q.match === match);
    if (s) return { img: cut(P, s.r), o: s.o };
  }
  throw new Error('no sprite ' + match);
}
const T = SHEETS[2];
const tile = (xy) => cut(T.P, [...xy, 16, 16]);
const FLOOR = T.M.tiles.woodfloor.map(tile), GRASS = T.M.bases.grass.slice(0, 4).map(tile);

// ---- the sheet ----
const BG = [40, 34, 44], INK = [251, 255, 134], DIM = [171, 148, 122];
const W = 1280;
let H = 4000;
const S = blank(W, H);
for (let i = 0; i < S.data.length; i += 4) S.data.set([...BG, 255], i);
const fill = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) S.data.set([...c, 255], (y * W + x) * 4); };
/** draw an art image scaled k at sheet (x, y), opaque pixels only */
function put(img, x, y, k = K) {
  for (let yy = 0; yy < img.h * k; yy++) for (let xx = 0; xx < img.w * k; xx++) {
    const p = (Math.floor(yy / k) * img.w + Math.floor(xx / k)) * 4;
    if (img.data[p + 3]) S.data.set(img.data.subarray(p, p + 4), ((y + yy) * W + x + xx) * 4);
  }
}
/** a ground patch w x h art px of tiles, then sprites placed by their origin at ground-local points */
function ground(tiles, w, h, ox = 0, oy = 0) {
  const g = blank(w, h);
  for (let ty = -1; ty * 16 < h; ty++) for (let tx = -1; tx * 16 < w; tx++) blit(g, tiles[(((tx + ty) % tiles.length) + tiles.length) % tiles.length], tx * 16 + ox, ty * 16 + oy);
  return g;
}
const place = (g, s, x, y) => blit(g, s.img, x - s.o[0], y - s.o[1]);

// 3x5 capitals and digits for labels
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  ' ': '000000000000000', ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100',
  '(': '010100100100010', ')': '010001001001010', '/': '001001010100100', '+': '000010111010000', '*': '000101010101000', '<': '001010100010001', '>': '100010001010100',
};
function text(str, x, y, c = INK, s = 2) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') fill(cx + q * s, y + r * s, s, s, c);
    cx += 4 * s;
  }
  return cx;
}

let y = 16;
text('HAMSTER PET - CONTACT SHEET (4X), READ BACK FROM THE IMPORTED SHEETS', 16, y, INK, 3); y += 26;
text('SRC/ART/CREATURES: PET:HAMSTER:<COAT>:<POSE>, PET:HAMSTERBALL:<COAT>:<FRAME>   SRC/ART/HOME: HF:HAMSTERCAGE:0/1:*, HF:HAMSTERWHEEL:<F>:*', 16, y, DIM); y += 28;

// ---- A: poses ----
const COATS = ['0 GOLDEN', '1 SNOW', '2 SILVER', '3 PANDA'];
const POSES = ['0 STAND', '1 STRIDE', '2 SIT', '3 ASLEEP', '4 GATHER', '5 HOP', '6 BREATHE'];
text('PET:HAMSTER:<COAT>:<POSE>  16X16 FRAME, ORIGIN (8,15) = FEET, FACING RIGHT. WALK 0 1 4 5, SLEEP 3/6', 16, y); y += 22;
const CELL = 18 * K, LX = 132;
POSES.forEach((p, i) => text(p, LX + i * (CELL + 8), y, DIM));
y += 16;
COATS.forEach((c, r) => {
  text(c, 16, y + CELL / 2 - 5);
  POSES.forEach((_, p) => {
    const g = ground((r + p) % 2 ? GRASS : FLOOR, 18, 18, -3, -2);
    place(g, spr(`pet:hamster:${r}:${p}`), 9, 16);
    put(g, LX + p * (CELL + 8), y);
  });
  y += CELL + 8;
});
y += 12;

// ---- B: the ball ----
text('PET:HAMSTERBALL:<COAT>:<FRAME>  16X16, ORIGIN (8,15). FRAMES 0-3 ROLL RIGHT (SEAM STUDS TURN CLOCKWISE)', 16, y); y += 22;
['0 GRASS', '1', '2', '3', '0 FLOOR', '1', '2', '3'].forEach((t, i) => text(t, LX + i * (CELL + 8), y, DIM));
y += 16;
COATS.forEach((c, r) => {
  text(c, 16, y + CELL / 2 - 5);
  for (let i = 0; i < 8; i++) {
    const g = ground(i < 4 ? GRASS : FLOOR, 18, 18, -5, -4);
    place(g, spr(`pet:hamsterball:${r}:${i % 4}`), 9, 16);
    put(g, LX + i * (CELL + 8), y);
  }
  y += CELL + 8;
});
y += 12;

// ---- C: the cage ----
const back = spr('hf:hamstercage:0:*'), front = spr('hf:hamstercage:1:*'), wheels = [0, 1, 2, 3].map((f) => spr(`hf:hamsterwheel:${f}:*`));
text('HF:HAMSTERCAGE (2X1 TILES)  32X26 CANVAS, ORIGIN (0,10): THE TILE ROW IS CANVAS ROWS 10-25. LAYERS ALONE:', 16, y); y += 22;
const CW = 34 * K;
const layers = [['0 BACK', back], ['WHEEL 0', wheels[0]], ['WHEEL 1', wheels[1]], ['WHEEL 2', wheels[2]], ['WHEEL 3', wheels[3]], ['1 FRONT', front]];
layers.forEach(([t, s], i) => {
  const x = 16 + i * (CW + 12);
  text(t, x, y, DIM);
  // a quiet checker so transparent pixels show
  for (let yy = 0; yy < 26; yy++) for (let xx = 0; xx < 32; xx++) fill(x + xx * K, y + 14 + yy * K, K, K, ((xx >> 1) + (yy >> 1)) & 1 ? [58, 52, 64] : [74, 66, 80]);
  put(s.img, x, y + 14);
});
y += 14 + 26 * K + 16;

text('STACKED ON THE FARMHOUSE FLOOR: BACK, WHEEL FRAME, HAMSTER, FRONT (THE DOTTED LINE IS THE TILE ROW)', 16, y); y += 22;
// spots in canvas pixels (for the hamster sprite's origin): bedding (10,20), wheel (23,19)
const BED = [10, 20], WHEEL = [23, 19];
function cage(wf, hams) {
  const g = ground(FLOOR, 40, 36, 0, 4);
  const cx = 4, cy = 4; // the canvas' top-left; the tile row starts at cy + 10
  blit(g, back.img, cx, cy);
  if (wf !== null) blit(g, wheels[wf].img, cx, cy);
  for (const [name, [sx, sy]] of hams) place(g, spr(name), cx + sx, cy + sy);
  blit(g, front.img, cx, cy);
  return g;
}
const scenes = [
  ['EMPTY (WHEEL 0)', cage(0, [])],
  ['GOLDEN ASLEEP (3)', cage(0, [['pet:hamster:0:3', BED]])],
  ['SNOW SITS (2)', cage(0, [['pet:hamster:1:2', BED]])],
  ['SILVER STANDS (0)', cage(0, [['pet:hamster:2:0', [12, 20]]])],
  ['GOLDEN RUNS F0+P0', cage(0, [['pet:hamster:0:0', WHEEL]])],
  ['F1+P1', cage(1, [['pet:hamster:0:1', WHEEL]])],
  ['F2+P4', cage(2, [['pet:hamster:0:4', WHEEL]])],
  ['F3+P5', cage(3, [['pet:hamster:0:5', WHEEL]])],
  ['PANDA RUNS F1+P1', cage(1, [['pet:hamster:3:1', WHEEL]])],
  ['PANDA ASLEEP (6)', cage(0, [['pet:hamster:3:6', BED]])],
];
const SW = 40 * K + 12, PER = Math.floor((W - 16) / SW);
scenes.forEach(([t, g], i) => {
  const x = 16 + (i % PER) * SW, yy = y + Math.floor(i / PER) * (36 * K + 26);
  text(t, x, yy, DIM);
  put(g, x, yy + 14);
  // mark the tile row (canvas rows 10-25 → ground rows 14-29) with dots on the left edge
  for (let r = 14; r < 30; r += 2) fill(x - 6, yy + 14 + r * K, 3, 3, INK);
});
y += Math.ceil(scenes.length / PER) * (36 * K + 26) + 6;

// the spots, drawn on the empty cage
text('SPOTS (CANVAS PX, WHERE THE HAMSTER ORIGIN GOES): BEDDING (10,20) SLEEP/SIT, FLOOR X 7-12 Y 19-20, WHEEL (23,19) RUN 0 1 4 5', 16, y); y += 22;
{
  const g = cage(0, []);
  const mark = (x, yy, c) => { g.data.set([...c, 255], (yy * g.w + x) * 4); };
  for (let x = 7; x <= 12; x++) { mark(4 + x, 4 + 19, [143, 211, 255]); mark(4 + x, 4 + 20, [143, 211, 255]); }
  mark(4 + BED[0], 4 + BED[1], [251, 255, 134]); mark(4 + WHEEL[0], 4 + WHEEL[1], [251, 255, 134]);
  put(g, 16, y, K);
  text('YELLOW = BED AND WHEEL SPOTS', 16 + 40 * K + 16, y + 20, DIM);
  text('BLUE = THE FLOOR BAND IT MAY WANDER', 16 + 40 * K + 16, y + 40, DIM);
  text('WHEEL: CENTRE (23,13), 15 PX ACROSS', 16 + 40 * K + 16, y + 60, DIM);
  y += 36 * K + 16;
}

// ---- D: game zoom ----
text('AT THE GAME ZOOM: 1X, 2X, 3X (NATIVE PIXELS, NOT 4X) - THE CAGE INDOORS, THE BALL AND A STANDING HAMSTER ON GRASS', 16, y); y += 22;
{
  const g = blank(110, 40);
  blit(g, ground(FLOOR, 44, 40, 0, 4), 0, 0);
  blit(g, ground(GRASS, 66, 40), 44, 0);
  blit(g, cage(1, [['pet:hamster:2:1', WHEEL]]), 0, 0);
  const b = spr('pet:hamsterball:0:1'), h = spr('pet:hamster:3:0'), cat = spr('pet:cat:0:0');
  // a shadow under each pet like the renderer's (shadow:10, ink at 28 %), blended for this review image only
  for (const [px, py] of [[62, 34], [80, 34], [96, 34]]) for (let dx = -4; dx <= 4; dx++) for (let dy = -1; dy <= 1; dy++) {
    if ((dx * dx) / 20 + dy * dy > 1.2) continue;
    const q = ((py + dy) * g.w + px + dx) * 4;
    for (let k = 0; k < 3; k++) g.data[q + k] = Math.round(g.data[q + k] * 0.72 + [46, 34, 47][k] * 0.28);
  }
  place(g, b, 62, 34); place(g, h, 80, 34); place(g, cat, 96, 34);
  let x = 16;
  for (const k of [1, 2, 3]) { put(g, x, y, k); text(k + 'X', x, y + 40 * k + 6, DIM); x += 110 * k + 24; }
  y += 40 * 3 + 24;
}

// crop and write
const out = blank(W, y + 8);
out.data.set(S.data.subarray(0, out.data.length));
fs.writeFileSync(path.join(HERE, 'contact.png'), encodePNG(out.w, out.h, out.data));
console.log(`art/pets/hamster/contact.png: ${out.w}x${out.h}`);
