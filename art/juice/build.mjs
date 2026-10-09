// Phase 3 juice sprites (reward VFX), hand-pixeled at 1x from the PixelLab design batch in raw/b16
// (batches.json). The batch came back at 14-16 px for sprites the game draws at 8-14 px, and
// shrinking pixel art ruins it, so the small ones are drawn here as character grids (STYLE.md,
// "What generation can't do well"). Growth series (star burst, puff, glint, gust, coin heaps)
// are derived by rule from one design so the frames stay consistent.
//
// Usage: node art/juice/build.mjs
//   -> art/juice/hand/<name>.png (one file per frame, `:` -> `_`) and art/juice/sprites.json
//   then: node scripts/sprites-import.mjs art/juice/sprites.json   (src/art/juice.png + .json)
//         node art/juice/contact.mjs                               (e2e/out/juice/contact.png)
// Every color is a Resurrect 64 palette color.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// shared legend (palette hex)
const L = {
  o: '#2e222f', // outline, plum-black
  p: '#45293f', // deep plum
  P: '#7a3045', // wine (wood shadow)
  d: '#9e4539', // brass deep / wood
  r: '#cd683d', // brass dark / wood mid
  e: '#e6904e', // wood light
  a: '#f79617', // amber
  y: '#f9c22b', // gold
  h: '#fbff86', // butter
  W: '#ffffff', // white glint
  u: '#fbb954', // light amber glow
  c: '#fdcbb0', // cream peach
  t: '#ab947a', // taupe
  m: '#966c6c', // warm gray-rose
  g: '#fb6b1d', // orange
  F: '#ea4f36', // red-orange
  R: '#b33831', // deep red-orange
  n: '#f04f78', // rose
  s: '#c32454', // rose shade
  l: '#f68181', // rose light
  k: '#fca790', // peach highlight
  G: '#cddf6c', // pale green
  v: '#91db69', // light green
  V: '#1ebc73', // green
};

/** name -> { w, h, px: (string|null)[] } */
const S = {};
const ENTRIES = []; // recipe entries in order

function fromRows(rows) {
  const h = rows.length, w = rows[0].length;
  rows.forEach((r, y) => { if (r.length !== w) throw new Error(`row ${y} is ${r.length} wide, expected ${w}: "${r}"`); });
  const px = [];
  for (const r of rows) for (const ch of r) {
    if (ch === '.' || ch === ' ') { px.push(null); continue; }
    if (!L[ch]) throw new Error(`unknown color '${ch}'`);
    px.push(ch);
  }
  return { w, h, px };
}
function blankG(w, h) { return { w, h, px: new Array(w * h).fill(null) }; }
const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? null : g.px[y * g.w + x]);
const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.px[y * g.w + x] = c; };
/** 4-neighbor outline around every opaque pixel, in color c (only on empty pixels) */
function outline(g, c = 'o') {
  const add = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (at(g, x, y)) continue;
    if (at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) put(g, x, y, c);
  return g;
}
function def(name, g, origin) {
  if (S[name]) throw new Error('duplicate ' + name);
  S[name] = g;
  ENTRIES.push({ match: name, file: `hand/${name.replace(/:/g, '_')}.png`, frame: [g.w, g.h], origin });
}

// =========================================================================================
// 1. fx:coin:0..5  9x9, origin (4,4): a spinning gold coin with a stamped cog ring.
//    0 face, 1 three-quarter (edge on the right), 2 narrow, 3 edge-on, 4 narrow, 5 three-quarter
//    (edge on the left), then back to 0. Light from the upper left on every frame.
// =========================================================================================
const COIN = [
  [
    '..ooooo..',
    '.ohhhyao.',
    'ohWyyyyao',
    'ohyaaayro',
    'ohyayayro',
    'oyyaaahro',
    'oayyyyyro',
    '.oarrrro.',
    '..ooooo..',
  ],
  [
    '...ooo...',
    '..ohyro..',
    '.ohWyaro.',
    '.ohaayro.',
    '.ohayydo.',
    '.oyaaydo.',
    '.oayyado.',
    '..oardo..',
    '...ooo...',
  ],
  [
    '...ooo...',
    '..ohyro..',
    '..oWyro..',
    '..ohado..',
    '..oyydo..',
    '..oyado..',
    '..oaydo..',
    '..oardo..',
    '...ooo...',
  ],
  [
    '....o....',
    '...oho...',
    '...oho...',
    '...oyo...',
    '...oyo...',
    '...oao...',
    '...oao...',
    '...oro...',
    '....o....',
  ],
  [
    '...ooo...',
    '..oahyo..',
    '..oaWyo..',
    '..oaayo..',
    '..oryyo..',
    '..orayo..',
    '..oryao..',
    '..odaro..',
    '...ooo...',
  ],
  [
    '...ooo...',
    '..ohhyo..',
    '.oahWyyo.',
    '.oahaayo.',
    '.orhyayo.',
    '.oryaaro.',
    '.orayyro.',
    '..odrro..',
    '...ooo...',
  ],
];
COIN.forEach((rows, i) => def(`fx:coin:${i}`, fromRows(rows), [4, 4]));

// =========================================================================================
// 2. fx:star:0..3  13x13, origin (6,6): tool impact star. 0 small hot 4-point flash, 1 the full
//    8-point burst, 2 the burst breaks into its points (center gone), 3 thin fading tips.
// =========================================================================================
const STARS = [
  [
    '.............',
    '.............',
    '......a......',
    '.....aWa.....',
    '.....aWa.....',
    '...aahWhaa...',
    '..aWWWWWWWa..',
    '...aahWhaa...',
    '.....aWa.....',
    '.....aWa.....',
    '......a......',
    '.............',
    '.............',
  ],
  [
    '......a......',
    '.....aha.....',
    '.a...aWa...a.',
    '.ah..hWh..ha.',
    '..hh.hWh.hh..',
    '...hhWWWhh...',
    'ahhWWWWWWWhha',
    '...hhWWWhh...',
    '..hh.hWh.hh..',
    '.ah..hWh..ha.',
    '.a...aWa...a.',
    '.....aha.....',
    '......a......',
  ],
  [
    '......y......',
    '......h......',
    '.y....W....y.',
    '..h.......h..',
    '...h.....h...',
    '.............',
    'yhW.......Why',
    '.............',
    '...h.....h...',
    '..h.......h..',
    '.y....W....y.',
    '......h......',
    '......y......',
  ],
  [
    '......c......',
    '.............',
    '.c.........c.',
    '.............',
    '.............',
    '.............',
    'c...........c',
    '.............',
    '.............',
    '.............',
    '.c.........c.',
    '.............',
    '......c......',
  ],
];
STARS.forEach((rows, i) => def(`fx:star:${i}`, fromRows(rows), [6, 6]));

// =========================================================================================
// 3. fx:puff:0..4  14x14, origin (7,7): a soft dust/smoke puff: a scalloped cream cloud, white
//    rims on the bumps (light from the upper left), taupe creases and a warm-gray base. 0 small and
//    dense, 1 swelling, 2 full, 3 breaking into lumps that drift outward, 4 the last wisps.
// =========================================================================================
function lumps(list, shape) {
  const g = blankG(14, 14);
  for (const [x, y] of list) shape.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, x + i, y + j, ch); }));
  return g;
}
const PUFFS = [
  fromRows([
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.......WW.....',
    '.....WWccc....',
    '....Wccccct...',
    '....tcctcct...',
    '.....mmmmm....',
    '..............',
    '..............',
    '..............',
    '..............',
  ]),
  fromRows([
    '..............',
    '..............',
    '..............',
    '..............',
    '.......WWc....',
    '...WWc.Wccc...',
    '..Wccctcccct..',
    '..Wcccccccct..',
    '..ccccccccct..',
    '...tccctcct...',
    '....mm.mmm....',
    '..............',
    '..............',
    '..............',
  ]),
  fromRows([
    '..............',
    '..............',
    '..............',
    '......WWc.....',
    '.....WWccc....',
    '..WW.Wccct.W..',
    '.Wcctccccctcc.',
    '.Wcccccccccct.',
    '.ccccccccccct.',
    '.ccccccccccct.',
    '..cccccccccct.',
    '..tccctcccctt.',
    '...tmm.mmmt...',
    '..............',
  ]),
  lumps([[5, 1], [10, 5], [0, 5], [2, 10], [9, 10]], ['.WW.', 'Wcct', '.tt.']),
  lumps([[6, 0], [12, 4], [0, 7], [2, 12], [11, 12]], ['Wc', 'ct']),
];
PUFFS.forEach((g, i) => def(`fx:puff:${i}`, g, [7, 7]));

// =========================================================================================
// 4. fx:glint:0..3  9x9, origin (4,4): a sharp 4-point sparkle that blooms and shrinks; bigger and
//    brighter than fx:twinkle (5x5): a white core, long butter arms with gold tips.
// =========================================================================================
const GLINTS = [
  [
    '.........',
    '.........',
    '.........',
    '....h....',
    '...hWh...',
    '....h....',
    '.........',
    '.........',
    '.........',
  ],
  [
    '.........',
    '....y....',
    '....h....',
    '...hWh...',
    '.yhWWWhy.',
    '...hWh...',
    '....h....',
    '....y....',
    '.........',
  ],
  [
    '....y....',
    '....h....',
    '....W....',
    '...hWh...',
    'yhWWWWWhy',
    '...hWh...',
    '....W....',
    '....h....',
    '....y....',
  ],
  [
    '.........',
    '.........',
    '....c....',
    '....h....',
    '..chWhc..',
    '....h....',
    '....c....',
    '.........',
    '.........',
  ],
];
GLINTS.forEach((rows, i) => def(`fx:glint:${i}`, fromRows(rows), [4, 4]));

// =========================================================================================
// 5. fx:heart:0..1  9x8, origin (4,4): plump rose heart, white glint; 1 squashed (wider bottom,
//    one row shorter, same ground line).
// =========================================================================================
const HEARTS = [
  [
    '.ooo.ooo.',
    'olWnonnno',
    'olnnnnnso',
    'onnnnnnso',
    '.onnnnso.',
    '..onnso..',
    '...oso...',
    '....o....',
  ],
  [
    '.........',
    '.ooo.ooo.',
    'olWnonnno',
    'olnnnnnso',
    'onnnnnsso',
    '.onnnsso.',
    '..onsso..',
    '...ooo...',
  ],
];
HEARTS.forEach((rows, i) => def(`fx:heart:${i}`, fromRows(rows), [4, 4]));

// =========================================================================================
// 6. fx:streak:0..2  12x14, origin (6,13) bottom-center: a cozy flame badge (amber core, orange
//    edge, butter tip). The round base (rows 6-13) never moves; the tip sways left, right, center.
// =========================================================================================
const FLAME_BASE = [
  '..ogayhyago.',
  '.ogaayhhyago',
  '.ogayhhhyaFo',
  '.ogayhhhyaFo',
  '..ogayyyaFo.',
  '..oFgaaagFo.',
  '...oRFFFRo..',
  '....ooooo...',
];
const STREAKS = [
  [
    '.....o......',
    '....oho.....',
    '....ohgo....',
    '...ogyago...',
    '...ogyaago..',
    '..ogayyago..',
    ...FLAME_BASE,
  ],
  [
    '.......o....',
    '......oho...',
    '.....ogho...',
    '....ogayo...',
    '...ogaaygo..',
    '...ogayyago.',
    ...FLAME_BASE,
  ],
  [
    '............',
    '......o.....',
    '.....oho....',
    '....oghgo...',
    '...ogyhago..',
    '..ogayyago..',
    ...FLAME_BASE,
  ],
];
STREAKS.forEach((rows, i) => def(`fx:streak:${i}`, fromRows(rows), [6, 13]));

// =========================================================================================
// 7. fx:arrow:0..3  11x12, origin (5,11) = the tip: chunky down arrow, amber/butter, plum outline.
//    0 rest, 1 stretched (taller, narrower), 2 rest, 3 squashed (wider, shorter). The tip never moves.
// =========================================================================================
const ARROW_REST = [
  '...........',
  '...ooooo...',
  '...oWhyo...',
  '...ohyao...',
  '...ohyao...',
  '.ooohyaooo.',
  '.ohhhyyyao.',
  '..ohhyyro..',
  '...ohyro...',
  '....oao....',
  '....oro....',
  '.....o.....',
];
const ARROWS = [
  ARROW_REST,
  [
    '...ooooo...',
    '...oWhyo...',
    '...ohyao...',
    '...ohyao...',
    '...ohyao...',
    '..oohyaoo..',
    '..ohhyyao..',
    '..ohhyyro..',
    '...ohyro...',
    '....oao....',
    '....oro....',
    '.....o.....',
  ],
  ARROW_REST,
  [
    '...........',
    '...........',
    '..ooooooo..',
    '..oWhhyyo..',
    '..ohhyyao..',
    'ooohhyyaooo',
    'ohhhhyyyaro',
    '.ohhhyyyro.',
    '..ohhyyro..',
    '...ohyro...',
    '....oro....',
    '.....o.....',
  ],
];
ARROWS.forEach((rows, i) => def(`fx:arrow:${i}`, fromRows(rows), [5, 11]));

// =========================================================================================
// 8. fx:gust:0..3  20x8, origin (10,4): two thin breeze lines that sweep right and curl; each frame
//    shows a window of each path, bright at the front (white, cream), pale green at the tail.
// =========================================================================================
// path A: a long gentle rise that ends in a curl; path B: a shorter line under it
const PATH_A = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 3], [10, 3], [11, 3], [12, 3], [13, 2], [14, 1], [15, 0], [16, 0], [17, 0], [18, 1], [18, 2], [17, 3], [16, 3], [15, 2]];
const PATH_B = [[2, 7], [3, 7], [4, 7], [5, 7], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 5], [13, 5], [14, 5]];
function gust(windows) {
  const g = blankG(20, 8);
  for (const [path, a, b, fade] of windows) {
    const end = Math.min(b, path.length - 1), len = end - a + 1;
    for (let i = a; i <= end; i++) {
      const k = end - i; // distance from the front
      if (fade && k % 2 === 1) continue;
      const c = fade ? (k < 2 ? 'c' : 'G') : k === 0 ? 'W' : k < len - 2 ? 'c' : 'G';
      put(g, path[i][0], path[i][1], c);
    }
  }
  return g;
}
const GUSTS = [
  gust([[PATH_A, 0, 6], [PATH_B, 0, 4]]),
  gust([[PATH_A, 2, 14], [PATH_B, 1, 10]]),
  gust([[PATH_A, 8, 22], [PATH_B, 5, 12]]),
  gust([[PATH_A, 14, 22, true], [PATH_B, 9, 12, true]]),
];
GUSTS.forEach((g, i) => def(`fx:gust:${i}`, g, [10, 4]));

// =========================================================================================
// 9. fx:pile:0..3  16x16, origin (8,15) bottom-center: coin heaps for the night tally. A heap is
//    a dome filled by rule with overlapping little coins (lit on the left, shaded on the right),
//    outlined in plum, with loose round coins in front; 3 adds a glint on top.
// =========================================================================================
const LOOSE = ['..ooo..', '.ohhyo.', 'ohyyyao', '.oarro.', '..ooo..']; // a coin lying flat
const MINI = ['.hy.', 'hyya', '.ar.']; // coin texture inside a heap, lit side
const MINI_S = ['.ya.', 'yaar', '.rd.']; // shaded side
function heap({ wx = 0, hy = 0, loose = [], stacks = [], sparkle = false }) {
  const g = blankG(16, 16);
  const base = 14, cx = 8;
  const inDome = (x, y) => { if (!hy || y > base || y < base - hy) return false; const t = (base - y) / hy; return Math.abs(x - cx) <= wx * Math.sqrt(1 - t * t) + 0.25; };
  if (hy) {
    // coin texture: rows of little coins, back (top) rows first, every other row offset
    for (let row = 0, y = base - hy - 1; y <= base; row++, y += 2)
      for (let x = (row % 2 ? 0 : 2) - 4; x < 16; x += 4) {
        const shade = x + 2 > cx + 1;
        (shade ? MINI_S : MINI).forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && inDome(x + i, y + j)) put(g, x + i, y + j, ch); }));
      }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inDome(x, y) && !at(g, x, y)) put(g, x, y, x > cx ? 'a' : 'y');
    for (let x = 0; x < 16; x++) if (inDome(x, base)) put(g, x, base, x > cx ? 'd' : 'r'); // ground contact
    outline(g, 'o');
  }
  // a stack: coins drawn bottom first, each 2 px higher, so every lower coin shows its edge
  for (const [x, y, n] of stacks) for (let k = 0; k < n; k++) LOOSE.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, x + i, y - 2 * k + j, ch); }));
  for (const [x, y] of loose) LOOSE.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, x + i, y + j, ch); }));
  if (sparkle) for (const [x, y, c] of [[13, 0, 'y'], [13, 1, 'h'], [11, 2, 'y'], [12, 2, 'h'], [13, 2, 'W'], [14, 2, 'h'], [15, 2, 'y'], [13, 3, 'h'], [13, 4, 'y']]) put(g, x, y, c);
  return g;
}
const PILES = [
  heap({ loose: [[2, 10], [8, 10], [5, 11]] }),
  heap({ stacks: [[3, 11, 3]], loose: [[8, 11], [10, 9]] }),
  heap({ wx: 6, hy: 6, loose: [[0, 11], [10, 11]] }),
  heap({ wx: 7, hy: 10, loose: [[0, 11], [10, 11]], sparkle: true }),
];
PILES.forEach((g, i) => def(`fx:pile:${i}`, g, [8, 15]));

// =========================================================================================
// 10. fx:chest:0..2  16x16, origin (8,15) bottom-center: a small reward chest, warm wood with brass
//     bands and a lock plate. 0 closed, 1 lid popping up with light spilling out, 2 open, full of
//     glowing gold. The body (rows 9-15) is the same in every frame.
// =========================================================================================
function chest(state) {
  const g = blankG(16, 16);
  const row = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) put(g, x, y, c); };
  const bands = (y, c4, c12) => { put(g, 4, y, c4); put(g, 12, y, c12); };
  // body: seam, planks, bands, lock plate, bottom
  row(9, 1, 15, 'o'); row(9, 2, 14, 'p'); bands(9, 'r', 'r');
  for (let y = 10; y <= 13; y++) { row(y, 1, 15, 'o'); row(y, 2, 14, y === 12 ? 'd' : 'r'); put(g, 2, y, y === 12 ? 'r' : 'e'); put(g, 14, y, 'd'); bands(y, 'a', 'a'); }
  put(g, 4, 10, 'y');
  row(14, 1, 15, 'o'); row(14, 2, 14, 'P'); bands(14, 'r', 'r');
  row(15, 1, 15, 'o');
  [['h', 'y', 'a'], ['y', 'o', 'a'], ['a', 'a', 'r']].forEach((r, j) => r.forEach((c, i) => put(g, 7 + i, 10 + j, c)));
  const lid = (dy) => {
    row(3 + dy, 3, 13, 'o');
    put(g, 2, 4 + dy, 'o'); put(g, 14, 4 + dy, 'o'); row(4 + dy, 3, 13, 'e'); bands(4 + dy, 'y', 'y');
    for (let y = 5; y <= 8; y++) { put(g, 1, y + dy, 'o'); put(g, 15, y + dy, 'o'); }
    row(5 + dy, 2, 14, 'e'); bands(5 + dy, 'y', 'a'); put(g, 14, 5 + dy, 'r');
    row(6 + dy, 2, 14, 'r'); put(g, 2, 6 + dy, 'e'); bands(6 + dy, 'a', 'a'); put(g, 14, 6 + dy, 'd');
    row(7 + dy, 2, 14, 'r'); bands(7 + dy, 'a', 'a'); put(g, 14, 7 + dy, 'd');
    row(8 + dy, 2, 14, 'd'); bands(8 + dy, 'r', 'r'); put(g, 14, 8 + dy, 'P');
    put(g, 7, 8 + dy, 'a'); put(g, 8, 8 + dy, 'y'); put(g, 9, 8 + dy, 'a'); // hasp tab
  };
  if (state === 0) lid(0);
  if (state === 1) {
    lid(-2);
    // the gap: light pouring out between lid and box
    put(g, 1, 7, 'o'); put(g, 15, 7, 'o'); put(g, 1, 8, 'o'); put(g, 15, 8, 'o');
    row(7, 2, 14, 'h'); row(7, 6, 10, 'W'); put(g, 2, 7, 'u'); put(g, 14, 7, 'u');
    row(8, 2, 14, 'y'); row(8, 5, 11, 'h'); put(g, 2, 8, 'a'); put(g, 14, 8, 'a');
    for (const [x, y, c] of [[0, 7, 'h'], [0, 5, 'y'], [15, 5, 'y'], [2, 0, 'h'], [8, 0, 'W'], [14, 0, 'h'], [5, 0, 'y'], [11, 0, 'y']]) if (!at(g, x, y)) put(g, x, y, c);
  }
  if (state === 2) {
    // lid swung back: its dark inside, lit from below by the gold
    row(1, 3, 13, 'o');
    put(g, 2, 2, 'o'); put(g, 14, 2, 'o'); row(2, 3, 13, 'p'); bands(2, 'P', 'P');
    for (let y = 3; y <= 8; y++) { put(g, 1, y, 'o'); put(g, 15, y, 'o'); }
    row(3, 2, 14, 'P'); bands(3, 'd', 'd');
    row(4, 2, 14, 'd'); bands(4, 'r', 'r');
    row(5, 2, 14, 'r'); row(5, 4, 12, 'u');
    // gold heaped up out of the box, glowing
    row(5, 6, 10, 'h'); put(g, 7, 5, 'W');
    row(6, 2, 14, 'y'); row(6, 4, 12, 'h'); for (const x of [5, 9]) put(g, x, 6, 'W'); put(g, 2, 6, 'u'); put(g, 14, 6, 'a');
    row(7, 2, 14, 'h'); for (const x of [3, 7, 11]) put(g, x, 7, 'W'); put(g, 13, 7, 'y'); put(g, 14, 7, 'a');
    row(8, 2, 14, 'y'); for (const x of [2, 5, 9]) put(g, x, 8, 'h'); put(g, 12, 8, 'a'); put(g, 13, 8, 'a'); put(g, 14, 8, 'r');
    for (const [x, y, c] of [[8, 0, 'W'], [5, 0, 'h'], [11, 0, 'h'], [0, 2, 'y'], [15, 1, 'y'], [0, 5, 'h'], [0, 6, 'u'], [15, 9, 'u']]) if (!at(g, x, y)) put(g, x, y, c);
  }
  return g;
}
[0, 1, 2].forEach((i) => def(`fx:chest:${i}`, chest(i), [8, 15]));

// ---- write ----
const outDir = path.join(HERE, 'hand');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(outDir, f));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
for (const [name, g] of Object.entries(S)) {
  const data = new Uint8Array(g.w * g.h * 4);
  g.px.forEach((ch, i) => { if (ch) data.set([...rgb(L[ch]), 255], i * 4); });
  fs.writeFileSync(path.join(outDir, name.replace(/:/g, '_') + '.png'), encodePNG(g.w, g.h, data));
}
const recipe = {
  _: 'Phase 3 juice sprites (reward VFX for src/render/juice.ts): coin spin, impact star, puff, glint, heart, streak flame, guide arrow, wind gust, coin piles, reward chest. Art: hand/*.png, drawn at 1x by art/juice/build.mjs from the PixelLab design batch raw/b16 (batches.json). Frames are separate names with a numeric suffix; origins are the frame center unless the entry says otherwise (streak, arrow, pile, chest: bottom-center).',
  name: 'juice',
  kind: 'sprites',
  scale: 1,
  defaults: { place: 'none', keepStrays: true },
  sprites: ENTRIES,
};
// one sprite per line keeps the diffs readable
const head = JSON.stringify({ ...recipe, sprites: [] }, null, 2);
fs.writeFileSync(path.join(HERE, 'sprites.json'), head.replace('"sprites": []', '"sprites": [\n' + ENTRIES.map((e) => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]') + '\n');
console.log(`${ENTRIES.length} frames -> art/juice/hand, recipe art/juice/sprites.json`);
