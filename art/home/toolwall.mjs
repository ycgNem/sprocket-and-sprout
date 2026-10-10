// hf:toolwall (32x16): the workshop's tool wall, hand-pixeled as ASCII so it stays editable.
// The w36 batch drew good pegboards (raw/w36/49, 51) but 32x24, too tall for the wall row, and a
// 32x16 Pro Flash (raw/pf/toolwall1.png) lost the board; this keeps their look: a reddish pegboard
// with dark peg holes, a plum frame, a hand saw, a claw hammer, a brass gear and a wrench.
// Usage: node art/home/toolwall.mjs → art/home/src/toolwall.png (then the sprites import)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 32, H = 16;
const K = {
  o: '#2e222f', // outline
  L: '#cd683d', // board, lit edge
  b: '#9e4539', // board
  h: '#6e2727', // board shade edge
  p: '#7a3045', // peg holes (soft, so they never cut into a tool's outline)
  1: '#3e3546', 2: '#625565', 3: '#9babb2', 4: '#c7dcd0', // iron, dark to glint
  d: '#7a3045', w: '#cd683d', W: '#e6904e', // wood handles
  S: '#9e4539', s: '#cd683d', m: '#f79617', g: '#f9c22b', G: '#fbff86', // brass
  x: '#45293f', // the gear's hub
};

// the pegboard: plum frame, lit top/left edge, shaded bottom/right edge, holes on a 2 px grid
const grid = [];
for (let y = 0; y < H; y++) {
  let r = '';
  for (let x = 0; x < W; x++) {
    const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
    if (corner) r += '.';
    else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) r += 'o';
    else if (y === 1 || x === 1) r += 'L';
    else if (y === H - 2 || x === W - 2) r += 'h';
    else r += x % 2 === 1 && y % 2 === 1 ? 'p' : 'b';
  }
  grid.push([...r]);
}
const paste = (x0, y0, rows) => rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') grid[y0 + y][x0 + x] = c; }));

// hand saw, hung by its grip, teeth on the right
paste(2, 2, [
  '.ooooo.',
  'oWWWwwo',
  'oWooowo',
  'owwwwdo',
  '.o433o.',
  '.o4333o',
  '.o433o.',
  '.o4333o',
  '..o33o.',
  '..o333o',
  '..o3o..',
  '...o...',
]);
// claw hammer, head up
paste(10, 2, [
  'ooooo',
  'o432o',
  'oo21o',
  '.oWo.',
  '.oWo.',
  '.oWo.',
  '.owo.',
  '.owo.',
  '.owo.',
  '.odo.',
  '.odo.',
  '..o..',
]);
// open-ended wrench with a ring end
paste(25, 2, [
  'oo.oo',
  'o4o3o',
  'o433o',
  '.o3o.',
  '.o3o.',
  '.o3o.',
  '.o2o.',
  '.o2o.',
  'oo2oo',
  'o3h2o',
  'o221o',
  '.ooo.',
]);

// brass gear, lit from the upper left: eight teeth round a small dark hub
paste(16, 3, [
  '..o.o.o..',
  '.ogogomo.',
  'ogGggmmso',
  '.oggsmso.',
  'ogmsxsmSo',
  '.omssmSo.',
  'osmmmSSSo',
  '.oSoSoSo.',
  '..o.o.o..',
]);
const data = new Uint8Array(W * H * 4);
grid.forEach((row, y) => row.forEach((c, x) => {
  if (c === '.') return;
  const hx = K[c];
  if (!PAL.includes(hx)) throw new Error(`${c}: ${hx} is not a palette color`);
  data.set([...rgbOf(hx), 255], (y * W + x) * 4);
}));
fs.mkdirSync(path.join(HERE, 'src'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'src', 'toolwall.png'), encodePNG(W, H, data));
console.log('toolwall: 32x16\n' + grid.map((r) => r.join('')).join('\n'));
