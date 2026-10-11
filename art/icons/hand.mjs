// Hand-pixeled item icons: icons drawn by hand at 16x16 from the item's own in-game art instead of
// picked from a PixelLab batch. One character grid per icon; every key is a Resurrect 64 palette
// color. picks.json picks each as { "src": "hand/<id>", "ink": false, "trim": false }: the grid
// already has its closed #2e222f outline and fits the frame, so art/icons/tools/build.mjs only
// centers it (a no-op for a 16x16 grid drawn centered).
//
// Usage: node art/icons/hand.mjs   -> art/icons/raw/hand/<id>.png, e2e/out/icons-hand.png (x8 review)
//        then node art/icons/tools/build.mjs and node scripts/sprites-import.mjs art/icons/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const ICONS = {};

// ---- f_hamster_cage: the Hamster Cage (2x1 farmhouse furniture) ----
// Redrawn from its own layers (art/home/hamstercage.mjs: back, wheel frame 0, front) and the golden
// hamster (art/creatures/src/pet_hamster_0_*), not scaled down. 16x14 like the fish tank and pet bed
// (wide, so 16 px on that axis only). Light from the upper left: the lit left post and front rail,
// the shaded right post. Top face: the back rail, one row of brass lid bars over the wine inside,
// the front rail. Inside: the water bottle (brass cap above the rail, glass below), wine back bars,
// the hamster curled on its shavings (ear, eye, cream cheek, pink nose; facing the wheel) and the
// spoked brass wheel, set a row under the rail so its rim reads round, its foot behind the tray's
// lip as in the game. The front bars are left out: at this size a bar across the 4 px hamster
// breaks it up, and the lid bars, posts and back bars carry the bars. The wooden tray: lit rim,
// plank face with seams, brass corner brackets and nameplate.
ICONS.f_hamster_cage = {
  key: {
    k: '#2e222f', // outline
    G: '#fbff86', g: '#f9c22b', m: '#f79617', s: '#cd683d', S: '#9e4539', // brass, tray wood
    d: '#45293f', D: '#7a3045', // the shadowed inside, back bars, the wheel's drum
    W: '#ffffff', c: '#fdcbb0', t: '#ab947a', // wood shavings (and the hamster's cheek)
    a: '#fbb954', b: '#e6904e', p: '#f68181', // golden coat, pink ear and nose
    L: '#8fd3ff', B: '#4d9be6', // the bottle's glass and water
  },
  rows: [
    '................',
    '.kkkkkkkkkkkkkk.',
    'kGssssssssssssmk',
    'kgdgdmdmddmdmdsk',
    'kgGGGgggggggggsk',
    'kgdLdDdDddddddsk',
    'kgdBdDdDddggmdsk',
    'kgddkpkkdgDmDmsk',
    'kgdkaabkgDDmDDsk',
    'kgkaakbkgmmGmmsk',
    'kgkbbcpkmDDmDDsk',
    'kgWcccWctsDmDssk',
    'kssssssssssssssk',
    'kmSSDSSGgSSDSSmk',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
};

// ---- 2.0 Phase 6, the cover pass: the eleven items that had no icon (art/icons/items.tsv's post-1.1
// items). Hand-pixeled at 16x16 like the hamster cage, from the item's own look (src/data/items.ts
// icon specs) and its neighbours in the sheet: closed plum outline, light from the upper left, warm
// ramps. k is always the plum outline #2e222f.

// ---- canvas: a rolled bolt of heavy cloth, spiral end to the left, two rope ties, a brass grommet ----
ICONS.canvas = {
  key: {
    k: '#2e222f',
    L: '#fdcbb0', M: '#ab947a', D: '#966c6c', d: '#694f62', // the folded cloth, the same pile as cloth, linen and fleece weave
    H: '#fbb954', h: '#e6904e', R: '#cd683d', r: '#9e4539', // the rope tied round it, crossed
  },
  rows: [
    '................',
    '........kk......',
    '.......khRkk....',
    '.....kkLhRLLkk..',
    '...kkLLLhRMLLLk.',
    '..kLLLLLhRLLMLk.',
    '.kLLLLLLhRLLLDD.',
    '.kMMDDLLhRLLDk..',
    '.khhhhhhHHhhhhk.',
    '.kRRRRRRRRRRRRk.',
    '.kMLDDLLhRDMDMk.',
    '..kDMLLDhRDMDk..',
    '...kDkDDhRMMk...',
    '.....kkMhRk.....',
    '.......kk.......',
    '................',
  ],
};

// ---- lubricant: a brass oil can with a long spout and a drop of amber oil at the tip ----
ICONS.lubricant = {
  key: {
    k: '#2e222f',
    G: '#fbff86', g: '#f9c22b', m: '#f79617', s: '#cd683d', S: '#9e4539', // brass
    c: '#f57d4a', C: '#b33831',                                           // copper spout
    a: '#fbb954', A: '#e6904e',                                           // oil
  },
  rows: [
    '................',
    '.............kk.',
    '............kGak',
    '...........kccak',
    '....kkkk..kcck.k',
    '...kGggmk.kCk...',
    '..kkmmmmkkCk....',
    '.kk.kkkkkkk.....',
    '.k.kGGgggmmk....',
    '.k.kGggmmmsk....',
    '.kkkgggmmmsk....',
    '..k.kgmmmssk....',
    '..k.kmmmsssk....',
    '...kkSSSSSSk....',
    '....kkkkkkk.....',
    '................',
  ],
};

// ---- grain: a heap of threshed grain, the kernels catching the light ----
ICONS.grain = {
  key: {
    k: '#2e222f',
    L: '#fbff86', G: '#f9c22b', A: '#fbb954', D: '#e6904e', E: '#cd683d',
  },
  rows: [
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkLGLGkk....',
    '...kLGGLGGGGk...',
    '..kLGLGAGLGGAk..',
    '..kGGGLGGGAGAAk.',
    '.kLGAGGGLGGAGDDk',
    '.kGGGLGAGGGAGDEk',
    '.kAGAGGGGAGDDEEk',
    '..kDAAGDADDEEEk.',
    '...kkDDEEEEEkk..',
    '.....kkkkkkk....',
    '................',
    '................',
  ],
};

// ---- straw: a tied bundle of pale hollow stalks, cut ends up, loose butts down ----
ICONS.straw = {
  key: {
    k: '#2e222f',
    L: '#fbff86', G: '#f9c22b', A: '#fbb954', D: '#e6904e',
    R: '#cd683d', r: '#9e4539',
  },
  rows: [
    '................',
    '....k..k.kk.....',
    '...kLkkLkkGkk...',
    '..kLGkLGkGAGAk..',
    '..kLGkLGkGAGAk..',
    '..kLGkLGkGADAk..',
    '.kkRRRRRRRRRrkk.',
    '.kLrrrrrrrrrrDk.',
    '..kLGkLGkGADAk..',
    '..kLGkLAkGADAk..',
    '..kLAkLAkGDDAk..',
    '...kAkkAkkGDkk..',
    '...kk.kk.kkkk...',
    '................',
    '................',
    '................',
  ],
};

// ---- starch_paste: a squat glass jar of boiled-down white paste under a brass lid, a kraft label ----
ICONS.starch_paste = {
  key: {
    k: '#2e222f',
    G: '#fbff86', g: '#f9c22b', m: '#f79617', s: '#cd683d',   // brass lid
    B: '#c7dcd0', b: '#8fd3ff',                                // the glass catching light
    W: '#ffffff', P: '#fdcbb0', p: '#c7dcd0', q: '#9babb2',    // paste: lit, body, shade, deep shade
    T: '#fdcbb0', t: '#ab947a', n: '#625565',                  // label and its ink
  },
  rows: [
    '................',
    '......kkkk......',
    '....kkGggmkk....',
    '....kGggmmsk....',
    '....kkkkkkkk....',
    '...kbWWWWWPpk...',
    '..kbWWWWWWPPpk..',
    '..kBWPPPPPPpqk..',
    '..kBWTTTTTTpqk..',
    '..kBPTnnnnTpqk..',
    '..kBPTTTTTTpqk..',
    '..kBPPPPPPppqk..',
    '..kkqpppppqqkk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
};

// ---- pigment: a cobalt glazed pot heaped with ground rose and violet colour, a drip down its side ----
ICONS.pigment = {
  key: {
    k: '#2e222f',
    h: '#ed8099', r: '#cf657f', R: '#a24b6f', v: '#a884f3', V: '#905ea9', // the powder
    L: '#8fd3ff', b: '#4d9be6', B: '#4d65b4', D: '#484a77',              // the glaze
    c: '#fdcbb0',                                                        // the cream band
  },
  rows: [
    '................',
    '.......kkk......',
    '.....kkhrrkk....',
    '....khhrrrvvk...',
    '...khhrrrrvVVk..',
    '...kkkkkkkkkkk..',
    '..kLbbbbbbbBBDk.',
    '..kLbccccccBBDk.',
    '..kLbbbbbbbBDDk.',
    '...kLbbbbbBBDk..',
    '...kLbbbbbBDDk..',
    '...kbbbbbbBDDk..',
    '....kkBBBBDkk...',
    '.....kkkkkkk....',
    '................',
    '................',
  ],
};

// ---- spirit: a tall clear bottle of grain spirit, corked, a little flame on its label ----
ICONS.spirit = {
  key: {
    k: '#2e222f',
    c: '#cd683d', C: '#9e4539',                                  // cork
    W: '#ffffff', B: '#c7dcd0', b: '#8fd3ff', d: '#9babb2',      // glass and liquid
    T: '#fdcbb0', t: '#ab947a',                                  // label
    F: '#fb6b1d', f: '#f9c22b',                                  // the flame
  },
  rows: [
    '................',
    '.......kkkk.....',
    '.......kccCk....',
    '.......kcCCk....',
    '......kkkkkkk...',
    '......kWBBbdk...',
    '......kWBBbdk...',
    '.....kkWBBbbkk..',
    '....kWWBBBBbbdk.',
    '....kWBTTTTTbdk.',
    '....kWBTfFTTbdk.',
    '....kWBTFFFTbdk.',
    '....kBbTTTTTbdk.',
    '....kbbbbbbbddk.',
    '.....kkkkkkkkk..',
    '................',
  ],
};

// ---- rapeseed: a little sheaf of canola, yellow flower heads over blue-green leaves, tied with cord ----
ICONS.rapeseed = {
  key: {
    k: '#2e222f',
    Y: '#fbff86', y: '#f9c22b', o: '#f79617',                   // flowers
    g: '#239063', G: '#1ebc73', t: '#0b8a8f', T: '#0eaf9b', d: '#0b5e65', // stems and leaves
    R: '#cd683d', r: '#9e4539',                                  // cord
  },
  rows: [
    '................',
    '.....kk...kk....',
    '....kYyk.kYyk...',
    '...kYyyokYyyok..',
    '...kyyoykkyoyk..',
    '....kkgkkgkgk...',
    '.kk...kgkgkk....',
    '.kTkk..kgkgk....',
    '.kTTtkkkRRRRk...',
    '..kTTtkkrrrrk...',
    '...kkddtkkgk....',
    '.....kkddkgk....',
    '.......kkkgk....',
    '.........kk.....',
    '................',
    '................',
  ],
};

// ---- rapeseed_seed: the seed packet every crop has (a tilted parchment square), a yellow canola spray ----
ICONS.rapeseed_seed = {
  key: {
    k: '#2e222f',
    b: '#fdcbb0', c: '#fbb954', d: '#e6904e',                   // parchment and its shading
    Y: '#fbff86', y: '#f9c22b', o: '#f79617',                   // flowers
    g: '#239063', t: '#0b8a8f', T: '#0eaf9b',                   // stem and leaves
  },
  rows: [
    '................',
    '.....kkkk.......',
    '....kbbbbkkkk...',
    '....kbbbbbbbbk..',
    '...kbbyybbyybbk.',
    '...kbYYyyYyybdk.',
    '...kbyoybyoybdk.',
    '...kbbgbbgbbbdk.',
    '...kbtgTbgTbddk.',
    '..kbbTtgggtTbdk.',
    '..kbbbbbgbbbbdk.',
    '..kbbbbbbbbbddk.',
    '..kbbbbbbbbbdk..',
    '...kkkkbbbbkk...',
    '.......kkkk.....',
    '................',
  ],
};

// ---- thresher: a small thresher: sheaf in the hopper, a porthole with its brass beater, the flywheel, the chute ----
ICONS.thresher = {
  key: {
    k: '#2e222f',
    a: '#fbff86', b: '#f9c22b', c: '#fbb954',                     // straw
    d: '#f57d4a', e: '#ea4f36', g: '#b33831',                     // the copper drum ring
    f: '#45293f', h: '#f79617',                                   // the dark inside, a brass blade
    i: '#e6904e', j: '#cd683d', l: '#9e4539', m: '#7a3045',       // timber stand
  },
  rows: [
    '..k.k...........',
    '.kakbk.kkkkk....',
    'kabcbbkddddek...',
    'kbbcbcddfffeek..',
    '.kbgbcdbfffheek.',
    '..kcciffbfhffgk.',
    '...kiifffabffgk.',
    '....kdfffbfffgk.',
    '....keeffhffggk.',
    '.....keefffgjjlk',
    '....kkkeggggkllb',
    '...kijjjjjjjjjcb',
    '...klllllllllfkk',
    '....kkkkkkkkkk..',
    '................',
    '................',
  ],
};

// ---- tram_bin: the tram cart's ore bin at the quarry: a timber hopper on legs, brass band, ore heaped in it ----
ICONS.tram_bin = {
  key: {
    k: '#2e222f',
    S: '#ab947a', s: '#966c6c', n: '#625565', i: '#c7dcd0',     // ore: lit, body, shade, a glint
    o: '#ea4f36', O: '#b33831',                                  // copper ore and the copper chute
    W: '#cd683d', w: '#9e4539', x: '#7a3045', h: '#e6904e',      // timber
    Y: '#f9c22b', y: '#f79617',                                  // brass
  },
  rows: [
    '................',
    '......kkkk......',
    '....kkSiSokk....',
    '...kSSsSSsSnk...',
    '..kSsSoSSsSsnk..',
    '..kYYYYYYYYYyk..',
    '..khWWWWWWWwwk..',
    '..khWWWWWWWwxk..',
    '...kYYYYYYYyk...',
    '...khWWWWWwxk...',
    '....khWWWwxk....',
    '....kkOOOOkk....',
    '...kwk.OO.kwk...',
    '...kwk....kwk...',
    '..kkxk....kxkk..',
    '................',
  ],
};

// ---- write ----
const outDir = path.join(HERE, 'raw/hand');
fs.mkdirSync(outDir, { recursive: true });
const imgs = [];
for (const [id, { key, rows }] of Object.entries(ICONS)) {
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) throw new Error(`${id}: the grid must be 16x16`);
  for (const c of Object.values(key)) if (!PAL.includes(c)) throw new Error(`${id}: ${c} is not a palette color`);
  const data = new Uint8Array(16 * 16 * 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    if (!key[ch]) throw new Error(`${id}: no key for "${ch}" at ${x},${y}`);
    data.set([...rgbOf(key[ch]), 255], (y * 16 + x) * 4);
  }));
  fs.writeFileSync(path.join(outDir, id + '.png'), encodePNG(16, 16, data));
  imgs.push(data);
}

// review: each icon x8 on the inventory-slot tan, the dark UI plum and floorboard wood
const K = 8, BG = ['#ab947a', '#3e3546', '#9e4539'], cell = 18;
const W = imgs.length * BG.length * cell, H = cell;
const prev = new Uint8Array(W * K * H * K * 4);
const put = (x, y, rgba) => { for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) prev.set(rgba, (((y * K + j) * W * K) + x * K + i) * 4); };
imgs.forEach((data, n) => BG.forEach((bg, b) => {
  const x0 = (n * BG.length + b) * cell;
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
    const inner = x >= 1 && x <= 16 && y >= 1 && y <= 16;
    const p = ((y - 1) * 16 + (x - 1)) * 4;
    put(x0 + x, y, inner && data[p + 3] ? data.subarray(p, p + 4) : inner ? [...rgbOf(bg), 255] : [46, 34, 47, 255]);
  }
}));
fs.mkdirSync(path.join(ROOT, 'e2e/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'e2e/out/icons-hand.png'), encodePNG(W * K, H * K, prev));
console.log(`hand icons: ${Object.keys(ICONS).join(', ')} -> art/icons/raw/hand/; review e2e/out/icons-hand.png`);
