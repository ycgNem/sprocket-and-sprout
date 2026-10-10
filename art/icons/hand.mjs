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
