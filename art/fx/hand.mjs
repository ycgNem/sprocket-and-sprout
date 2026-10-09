// Hand-pixeled FX sprites (emote bubbles, critters, mail, bunting, fireball), drawn at their exact
// in-game size from the designs in raw/b16 (PixelLab create_1_direction_object, see batches.json).
// The batch came back at 14-16 px for sprites the renderer draws at 5-9 px, and shrinking pixel art
// ruins it, so each sprite is re-drawn here by hand at 1x in the batch's colors and shapes.
// Color variants (butterfly colors, gray bird, pennant colors) are `recolor`s in sprites.json.
//
// Usage: node art/fx/hand.mjs   -> art/fx/hand/<name>.png (one file per sprite, `:` -> `_`)
//                                  e2e/out/fx-hand.png (x6 preview on grass, stone, water, dark)
// Every color is a Resurrect 64 palette color.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// shared legend (palette hex); a sprite may extend or override it
const L = {
  o: '#2e222f', // outline, plum-black
  p: '#45293f', // deep plum
  w: '#ffffff', // bubble / paper white
  c: '#fdcbb0', // cream-peach shade
  h: '#fbff86', // pale yellow (twinkle arms)
  t: '#ab947a', // taupe (paper fold lines)
  r: '#e83b3b', // red
  R: '#ae2334', // dark red
  f: '#f68181', // pink highlight
  k: '#f04f78', // pink (cheeks)
  b: '#4d65b4', // blue
  B: '#484a77', // dark blue
  s: '#4d9be6', // sky blue
  v: '#905ea9', // purple
  V: '#6b3e75', // dark purple
};

const S = {};

// ---- emote bubbles: 15x13, cream with a plum outline; the tail tip (7,12) is the origin ----
const BUBBLE = [
  '...ooooooooo...',
  '.oowwwwwwwwwoo.',
  '.owwwwwwwwwwwo.',
  'owwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwo',
  'owwwwwwwwwwwwco',
  'owwwwwwwwwwwwco',
  '.owwwwwwwwwwco.',
  '.oocccccccccoo.',
  '...ooocccooo...',
  '......oco......',
  '.......o.......',
];
/** symbol rows stamped into the bubble at (x, y); '.' keeps the bubble */
function bubble(sym, x, y) {
  const rows = BUBBLE.map((r) => r.split(''));
  sym.forEach((r, j) => r.split('').forEach((ch, i) => { if (ch !== '.') rows[y + j][x + i] = ch; }));
  return rows.map((r) => r.join(''));
}
S['emote:heart'] = { rows: bubble([
  '.rr.rr.',
  'rffrrrr',
  'rfrrrrR',
  '.rrrrR.',
  '..rRR..',
  '...R...',
], 4, 2) };
S['emote:exclaim'] = { rows: bubble([
  'ooo',
  'ooo',
  '.o.',
  '.o.',
  '...',
  '.o.',
], 6, 2) };
S['emote:question'] = { rows: bubble([
  '.bbb.',
  'bB.bb',
  '...bB',
  '..bB.',
  '..b..',
  '.....',
  '..b..',
], 5, 2) };
S['emote:note'] = { rows: bubble([
  '..vvvvv',
  '..v...v',
  '..v...v',
  '.vv..vv',
  'vvV.vvV',
  'vV..vV.',
], 4, 2) };
S['emote:zzz'] = { rows: bubble([
  '......ssss',
  '........s.',
  'bbbbb..s..',
  '...B..ssss',
  '..b.......',
  '.B........',
  'bbbbb.....',
], 3, 2) };
S['emote:smile'] = { rows: bubble([
  '.o...o.',
  '.o...o.',
  '.......',
  'ko...ok',
  '..ooo..',
], 4, 3) };

// ---- butterflies 7x5, origin (3,4): yellow; pink, lavender, cream, amber are recolors ----
// frame 0 wings open (top view), frame 1 wings folded up over the body
const FLY = { h: '#fbff86', m: '#f9c22b', d: '#f79617', D: '#cd683d' };
S['amb:fly:0:0'] = { legend: FLY, rows: [
  'hh...md',
  'hmmommd',
  '.mmodd.',
  '.mdodD.',
  '..D.D..',
] };
S['amb:fly:0:1'] = { legend: FLY, rows: [
  '..hm...',
  '..hmd..',
  '..mmd..',
  '...o...',
  '.......',
] };

// ---- sparrow 9x8 facing right, origin (4,7) = feet; the gray bird is a recolor ----
// 0 sitting, 1 hop (tail up, feet tucked), 2 flying wing up, 3 flying wing down
const BIRD = { a: '#7a3045', l: '#9e4539', m: '#cd683d', h: '#e6904e', e: '#fdcbb0', E: '#ab947a', y: '#f79617' };
S['amb:bird:0:0'] = { legend: BIRD, rows: [
  '.........',
  '.....ooo.',
  '....ommmo',
  '.o..omomy',
  '.ooollmeo',
  '..oaallEo',
  '...ooooo.',
  '....o.o..',
] };
S['amb:bird:0:1'] = { legend: BIRD, rows: [
  '.........',
  '.o...ooo.',
  '.oo.ommmo',
  '..oaomomy',
  '...ollmeo',
  '...oalEo.',
  '....ooo..',
  '.........',
] };
S['amb:bird:0:2'] = { legend: BIRD, rows: [
  '.oo......',
  'ohmo.ooo.',
  '.ohmommmo',
  '.oomomomy',
  '.ooollmeo',
  '..oaallEo',
  '...ooooo.',
  '.........',
] };
S['amb:bird:0:3'] = { legend: BIRD, rows: [
  '.........',
  '.....ooo.',
  '....ommmo',
  '.o..omomy',
  '.ooollmeo',
  '..ohmllEo',
  '.ohmoooo.',
  '.oo......',
] };

// ---- fish 8x5, origin (4,4): 0 leaping up (head upper right), 1 diving (head lower right) ----
const FISH = { g: '#f79617', G: '#cd683d', H: '#fbb954', w: '#fbff86', e: '#fdcbb0' };
S['amb:fish:0'] = { legend: FISH, rows: [
  '.....oo.',
  '...ooHwo',
  'o.oggHeo',
  'oogGeo..',
  'o.oo....',
] };
S['amb:fish:1'] = { legend: FISH, rows: [
  'o.oo....',
  'oogGeo..',
  'o.oggHeo',
  '...ooHwo',
  '.....oo.',
] };

// ---- mail: letter 10x8 and the raised flag 5x8 (post in column 0), origin (0,0) ----
S['fx:letter'] = { rows: [
  'oooooooooo',
  'otwwwwwwto',
  'owtwwwwtwo',
  'owwtrrtwco',
  'owwwrRwwco',
  'owwwwwwcco',
  'occcccccco',
  'oooooooooo',
] };
S['fx:mailflag'] = { rows: [
  'poooo',
  'pfrro',
  'prrRo',
  'poooo',
  'p....',
  'p....',
  'p....',
  'p....',
] };

// ---- bunting pennant 6x6, origin (0,0): the string is row 0; rose, the others are recolors ----
const PEN = { n: '#45293f', h: '#f68181', m: '#f04f78', d: '#c32454' };
S['fx:pennant:0'] = { legend: PEN, rows: [
  'nnnnnn',
  '.hmmd.',
  '.hmmd.',
  '..md..',
  '..md..',
  '......',
] };

// ---- ember wisp fireball 7x7, origin (3,6): two flicker frames ----
const FIRE = { R: '#b33831', O: '#ea4f36', g: '#fb6b1d', a: '#f79617', y: '#f9c22b', W: '#fbff86' };
S['fx:fireball:0'] = { legend: FIRE, rows: [
  '...O...',
  '..OgO.O',
  '.OgagOg',
  'OgayagO',
  'OayWyaO',
  '.gyWyg.',
  '..RgR..',
] };
S['fx:fireball:1'] = { legend: FIRE, rows: [
  '.O.....',
  '.O.O...',
  '.gOgO..',
  'OgayagO',
  'OayWyaO',
  'OgyWygO',
  '.RgggR.',
] };

// ---- ripe-crop twinkle 5x5, origin (2,2) = center: 0 small cross, 1 full star, 2 fading ----
// no outline: it is a glint. w white core, h pale yellow, c peach
S['fx:twinkle:0'] = { rows: [
  '.....',
  '..h..',
  '.hwh.',
  '..h..',
  '.....',
] };
S['fx:twinkle:1'] = { rows: [
  '..c..',
  '..h..',
  'chwhc',
  '..h..',
  '..c..',
] };
S['fx:twinkle:2'] = { rows: [
  '.....',
  '..c..',
  '.chc.',
  '..c..',
  '.....',
] };

// ---- write ----
const outDir = path.join(HERE, 'hand');
fs.mkdirSync(outDir, { recursive: true });
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const imgs = [];
for (const [name, s] of Object.entries(S)) {
  const leg = { ...L, ...(s.legend ?? {}) };
  const h = s.rows.length, w = s.rows[0].length;
  s.rows.forEach((r, y) => { if (r.length !== w) throw new Error(`${name}: row ${y} is ${r.length} wide, expected ${w}`); });
  const data = new Uint8Array(w * h * 4);
  s.rows.forEach((r, y) => r.split('').forEach((ch, x) => {
    if (ch === '.') return;
    const hx = leg[ch];
    if (!hx) throw new Error(`${name}: unknown color '${ch}' at ${x},${y}`);
    data.set([...rgb(hx), 255], (y * w + x) * 4);
  }));
  fs.writeFileSync(path.join(outDir, name.replace(/:/g, '_') + '.png'), encodePNG(w, h, data));
  imgs.push({ name, w, h, data });
}

// preview: every sprite x6 on four backgrounds (one band per background, 10 sprites a row)
const K = 6, BG = ['#239063', '#966c6c', '#4d65b4', '#3e3546'].map(rgb), COLS = 10;
const CW = 17 * K, CH = 15 * K, ROWS = Math.ceil(imgs.length / COLS);
const PW = COLS * CW, PH = BG.length * ROWS * CH;
const pv = new Uint8Array(PW * PH * 4);
imgs.forEach((im, n) => BG.forEach((bg, b) => {
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const X = (n % COLS) * CW + x, Y = (b * ROWS + Math.floor(n / COLS)) * CH + y;
    const ix = Math.floor((x - K) / K), iy = Math.floor((y - K) / K);
    let c = [...bg, 255];
    if (ix >= 0 && iy >= 0 && ix < im.w && iy < im.h && im.data[(iy * im.w + ix) * 4 + 3]) c = [...im.data.slice((iy * im.w + ix) * 4, (iy * im.w + ix) * 4 + 3), 255];
    if (x < 2 || y < 2) c = [20, 16, 24, 255];
    pv.set(c, (Y * PW + X) * 4);
  }
}));
fs.mkdirSync(path.join(ROOT, 'e2e/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'e2e/out/fx-hand.png'), encodePNG(PW, PH, pv));
console.log(`${imgs.length} sprites -> ${path.relative(ROOT, outDir)}; preview e2e/out/fx-hand.png`);
