// Tock, the player's clockwork companion (pet:tock:0:<pose>): hand-pixeled source poses, written as
// ASCII parts so every pose shares one body. The PixelLab batch raw/tock1/ (create_1_direction_object,
// size 20) is the design reference: a round brass pocket-watch body, one big teal lens, a wind-up key
// on the back, stubby copper legs; its sprites came out noisy at this size (a fin-like key, muddy
// legs), so the final is drawn here and prep.mjs derives the walk cycle from it.
//
// Usage: node art/creatures/tock.mjs → raw/tock/<pose>.png (then prep.mjs, build-recipe.mjs, the import)
//   stand      the idle pose, key face-on
//   stand_k1   key turned a quarter (walk frames 1 and 5)
//   stand_k2   key edge-on (walk frame 4)
//   sit        sat down, legs out front, key slowing mid-turn
//   rest       powered down: key still, lens dark; prep.mjs makes the standby glow (pose 6) from it
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'raw', 'tock');
const KEY = {
  o: '#2e222f', // outline
  G: '#fbff86', g: '#f9c22b', m: '#f79617', s: '#cd683d', S: '#9e4539', D: '#7a3045', // brass, glint to deepest
  x: '#45293f', // the lens bezel
  W: '#ffffff', L: '#8ff8e2', T: '#30e1b9', t: '#0eaf9b', d: '#0b8a8f', k: '#0b5e65', // glass
  C: '#f57d4a', c: '#ea4f36', r: '#b33831', R: '#6e2727', // copper limbs
};

// the body: an 11 px brass disc lit from the upper left, the lens on its front (right) half
const BODY = [
  '...ooooo...',
  '..ogGgmmo..',
  '.ogGggmmso.',
  'ogggmmxxxso',
  'oggmmxWLTxo',
  'oggmmxLTtxo',
  'ommmsxTtdxo',
  'ommsssxxxSo',
  '.osSSSSSSo.',
  '..oSDDDDo..',
  '...ooooo...',
];
// the crown (the watch's winding knob) sits on top: rows -2..-1 relative to the body
const CROWN = ['oooo', 'ogmo'];
// the wind-up key on the back, three turns: face-on butterfly, a quarter turn, edge-on
const KEYS = {
  k0: ['.oo.', 'ogmo', 'omso', '.oSS', 'omso', 'osSo', '.oo.'],
  k1: ['..o.', '.ogo', '.oso', '..oS', '.omo', '.oSo', '..o.'],
  k2: ['....', '..o.', '.oso', '.oSS', '.oSo', '..o.', '....'],
};
// standing legs and feet (back foot, front foot), rows 11..13 relative to the body
const LEGS = [
  '.oco..oco..',
  'oCcRo.oCcRo',
  'ooooo.ooooo',
];
// the front arm, a copper mitten held a little forward
const ARM = ['.o..', 'Cco.', 'orRo', '.oo.'];
// sitting: the front foot pokes out under the body, the arm rests on it
const SIT_FOOT = ['ooo.', 'CcRo', 'ooo.'];
const SIT_ARM = ['.o.', 'oCo', 'oco', '.o.'];

const W = 22, H = 20;
function canvas() { return Array.from({ length: H }, () => Array(W).fill('.')); }
function put(cv, part, x0, y0) {
  part.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cv[y0 + y][x0 + x] = ch; }));
}
// lens states: lit, dark (resting), and the faint standby glow prep.mjs derives for pose 6
const DIM = { W: 'd', L: 'k', T: 'k', t: 'k', d: 'x' };
function pose({ by, key, legs = true, sit = false, dim = false }) {
  const cv = canvas(), bx = 5;
  if (legs) put(cv, LEGS, bx + 1, by + 11);
  put(cv, BODY, bx, by);
  put(cv, CROWN, bx + 4, by - 2);
  put(cv, KEYS[key], bx - 4, by + 2);
  if (sit) { put(cv, SIT_FOOT, bx + 9, by + 8); put(cv, SIT_ARM, bx + 10, by + 5); }
  else put(cv, ARM, bx + 10, by + 7);
  if (dim) for (const row of cv) for (let x = 0; x < W; x++) if (DIM[row[x]]) row[x] = DIM[row[x]];
  return cv;
}
// the ground is row 17 in every pose (prep.mjs aligns them all on the stand pose)
const POSES = {
  stand: pose({ by: 4, key: 'k0' }),
  stand_k1: pose({ by: 4, key: 'k1' }),
  stand_k2: pose({ by: 4, key: 'k2' }),
  sit: pose({ by: 7, key: 'k1', legs: false, sit: true }),
  rest: pose({ by: 7, key: 'k2', legs: false, sit: true, dim: true }),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, cv] of Object.entries(POSES)) {
  const data = new Uint8Array(W * H * 4);
  cv.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === '.') return;
    const hx = KEY[ch];
    if (!hx || !PAL.includes(hx)) throw new Error(`${name}: "${ch}" has no palette color`);
    data.set([...rgbOf(hx), 255], (y * W + x) * 4);
  }));
  fs.writeFileSync(path.join(OUT, name + '.png'), encodePNG(W, H, data));
  console.log(name + '\n' + cv.map((r) => r.join('')).join('\n'));
}
