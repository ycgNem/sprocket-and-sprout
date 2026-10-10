// The hamster pet (pet:hamster:<coat>:<pose>) and its exercise ball (pet:hamsterball:<coat>:<frame>):
// hand-pixeled as ASCII so every pose and coat stays editable. The PixelLab batch raw/hamster1/
// (create_1_direction_object, size 16) is the design reference: a round golden Syrian with a cream
// belly and cheeks, an upright seed-eating pose, a curled sleeping ball, the white, grey and banded
// coats, a clear ball. Its sprites came out 14x12 and soft-edged, too big next to the cat (16x15), so
// the finals are drawn here at 10x8, like Tock (tock.mjs).
//
// Usage: node art/creatures/hamster.mjs → art/creatures/src/pet_hamster_<coat>_<pose>.png and
//        pet_hamsterball_<coat>_<frame>.png (16x16, palette-exact, feet on row 15), then
//        node art/creatures/build-recipe.mjs && node scripts/sprites-import.mjs art/creatures/sprites.json
//
// Frames are 16x16 with the origin at (8, 15), facing right (the renderer mirrors for left), the pets'
// convention: 0 stand; 1, 4, 5 the scurry (played 0 1 4 5: stretched stride, feet gathered, a little
// hop); 2 sits up holding a seed, cheeks puffed (3/4 front, like the cat's and dog's sit); 3 curled
// asleep; 6 the same a pixel rounder (breathing; alternate 3 and 6). Coats: 0 Golden, 1 Snow (ruby
// eyes), 2 Silver, 3 Panda (black head and rump, white band). The ball (frames 0-3) is clear plastic:
// a pale ring (no plum outline, like the fish tank's glass), a fixed glint at the upper left, four seam
// studs that roll clockwise a sixteenth of a turn per frame, the hamster scurrying inside.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'src');
const W = 16, H = 16;

// semantic keys: o outline · R ear rim · H/F/S/D fur light → deep · W/C/c cream light, base, shade
// (belly, muzzle, cheeks) · P pink (inner ear, paws) · N nose · G/E eye glint and pupil · k/K the seed
const GOLD = {
  o: '#2e222f', R: '#fbb954', H: '#fbb954', F: '#e6904e', S: '#cd683d', D: '#9e4539',
  W: '#ffffff', C: '#fdcbb0', c: '#ab947a', P: '#f68181', N: '#ed8099', G: '#ffffff', E: '#2e222f',
  k: '#3e3546', K: '#c7dcd0',
};
// cream-white fur shaded peach and taupe (STYLE.md's cream ramp), ruby eyes
const SNOW = { ...GOLD, R: '#ffffff', H: '#ffffff', F: '#ffffff', S: '#fdcbb0', D: '#ab947a', C: '#fdcbb0', c: '#ab947a', G: '#e83b3b', E: '#ae2334' };
// dove grey, the silver cat's ramp, pale belly
const SILVER = { ...GOLD, R: '#c7dcd0', H: '#c7dcd0', F: '#9babb2', S: '#7f708a', D: '#625565', W: '#ffffff', C: '#ffffff', c: '#c7dcd0' };
// panda: black fur (the midnight cat's ramp) on the head and rump, the SNOW fur on the band
const BLACK = { ...GOLD, R: '#694f62', H: '#694f62', F: '#3e3546', S: '#45293f', D: '#2e222f', W: '#7f708a', C: '#625565', c: '#45293f' };
const BAND = { ...SNOW, R: '#694f62', G: '#ffffff', E: '#2e222f', C: '#ffffff', c: '#fdcbb0' };
export const COATS = ['golden', 'snow', 'silver', 'panda'];

const pad = (rows) => [...Array(H - rows.length).fill('.'.repeat(W)), ...rows];
const up = (rows, n) => [...rows.slice(n), ...Array(n).fill('.'.repeat(W))];

// ---- the poses (golden keys; the ground is row 15) ----
const STAND = pad([
  '.......oo.......',
  '.....ooRPo......',
  '....oHHFFFo.....',
  '...oHHFFFGFo....',
  '...oHFFFFECNo...',
  '...oFFFSSCCCo...',
  '...oSSCCCCco....',
  '....oPPooPPo....',
  '.....oo..oo.....',
]);
// stride: the body stretched a pixel, the back foot pushing off, the front foot reaching
const STRIDE = pad([
  '........oo......',
  '.....oooRPo.....',
  '....oHHHFFFo....',
  '...oHHFFFFGFo...',
  '...oHFFFFFECNo..',
  '...oFFFFSSCCCo..',
  '...oSSSCCCCco...',
  '...oPPoooooPPo..',
  '....oo.....oo...',
]);
// feet gathered under the belly
const GATHER = pad([
  '.......oo.......',
  '.....ooRPo......',
  '....oHHFFFo.....',
  '...oHHFFFGFo....',
  '...oHFFFFECNo...',
  '...oFFFSSCCCo...',
  '...oSSCCCCco....',
  '....oPPoPPoo....',
  '.....oo.oo......',
]);
// sat up on its haunches, 3/4 front: both ears, cheeks puffed, a sunflower seed in its paws
const SIT = pad([
  '....oo....oo....',
  '...oRPooooPRo...',
  '...oHHHHFFFFo...',
  '..oHHGFFFGFFSo..',
  '..oHHEFFFEFFSo..',
  '..oWCCCNCCCCSo..',
  '..oWCCPkPCCCSo..',
  '...oHFPKPFFSo...',
  '...oHFFCCFFSo...',
  '..oHFFFCCFFSSo..',
  '..oSFFFCcFFSSo..',
  '...ooPPooPPooo..',
]);
// curled up asleep: a ball of fur, the ear on top, eye shut, nose tucked into the belly
const SLEEP = pad([
  '......oooo......',
  '....ooHHHHoo....',
  '...oHHHFFFRPo...',
  '...oHHFFFFFFo...',
  '...oHFFFFooFo...',
  '...oHFFFSSCCo...',
  '....oSSSSCNo....',
  '.....oooooo.....',
]);
// breathing in: a pixel rounder
const SLEEP_IN = pad([
  '......oooo......',
  '....ooHHHHoo....',
  '...oHHHFFFRPo...',
  '...oHHFFFFFFo...',
  '...oHFFFFFFFo...',
  '...oHFFFFooFo...',
  '...oHFFFSSCCo...',
  '....oSSSSCNo....',
  '.....oooooo.....',
]);
export const POSES = { 0: STAND, 1: STRIDE, 2: SIT, 3: SLEEP, 4: GATHER, 5: up(GATHER, 1), 6: SLEEP_IN };

// the panda's white band per pose: columns [x0, x1] (lying, walking) or rows (sitting up)
const BANDS = {
  0: { x: [5, 6] }, 1: { x: [5, 7] }, 4: { x: [5, 6] }, 5: { x: [5, 6] },
  2: { y: [11, 12] }, 3: { x: [6, 7] }, 6: { x: [6, 7] },
};
const keyFor = (coat, pose, x, y) => {
  if (coat !== 3) return [GOLD, SNOW, SILVER][coat];
  const b = BANDS[pose];
  const inBand = b.x ? x >= b.x[0] && x <= b.x[1] : y >= b.y[0] && y <= b.y[1];
  return inBand ? BAND : BLACK;
};

function paint(rows, coat, pose, dx = 0, dy = 0, into = null) {
  const img = into ?? { w: W, h: H, data: new Uint8Array(W * H * 4) };
  rows.forEach((r, y) => {
    if (r.length !== W) throw new Error(`pose ${pose} row ${y}: ${r.length} wide`);
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      const hx = keyFor(coat, pose, x, y)[ch];
      if (!hx || !PAL.includes(hx)) throw new Error(`pose ${pose} coat ${coat}: "${ch}" has no palette color`);
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) throw new Error(`pose ${pose} clipped at ${X},${Y}`);
      img.data.set([...rgbOf(hx), 255], (Y * img.w + X) * 4);
    });
  });
  return img;
}

// ---- the ball: a 13 px clear sphere (x 2..14, y 3..15) centred on the origin column ----
const RING = '#c7dcd0', RING_SHADE = '#9babb2', STUD = '#7f708a', GLINT = '#ffffff';
const inBall = (x, y) => (x - 8) ** 2 + (y - 9) ** 2 <= 42.25;
const ringPx = [];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (inBall(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !inBall(x + a, y + b))) ringPx.push([x, y]);
const angleOf = ([x, y]) => (Math.atan2(y - 9, x - 8) * 180) / Math.PI; // 0 = right, 90 = down (clockwise on screen)
const GLINTS = [[5, 5], [4, 6]];
// the hamster inside scurries through the run cycle, feet on the ball's floor; [pose, dx, dy] per frame
// (the stretched stride sits a pixel further left so its nose stays off the ring)
const BALL_RUN = [[0, 1, -1], [1, 0, -1], [4, 1, -1], [5, 1, -1]];
function ball(coat, f) {
  const img = { w: W, h: H, data: new Uint8Array(W * H * 4) };
  for (const p of ringPx) {
    const a = angleOf(p);
    img.data.set([...rgbOf(a > -10 && a < 150 ? RING_SHADE : RING), 255], (p[1] * W + p[0]) * 4);
  }
  // seam studs: four ring pixels 90 degrees apart, turning 22.5 degrees clockwise per frame (rolling right)
  for (let i = 0; i < 4; i++) {
    const want = -60 + i * 90 + f * 22.5;
    let best = null, bd = 1e9;
    for (const p of ringPx) { const d = Math.abs(((angleOf(p) - want + 540) % 360) - 180); if (d < bd) { bd = d; best = p; } }
    img.data.set([...rgbOf(STUD), 255], (best[1] * W + best[0]) * 4);
  }
  const [pose, dx, dy] = BALL_RUN[f];
  paint(POSES[pose], coat, pose, dx, dy, img);
  for (const [x, y] of GLINTS) img.data.set([...rgbOf(GLINT), 255], (y * W + x) * 4);
  return img;
}

export const frames = [];
for (let c = 0; c < 4; c++) for (let p = 0; p < 7; p++) frames.push({ name: `pet_hamster_${c}_${p}`, img: paint(POSES[p], c, p) });
for (let c = 0; c < 4; c++) for (let f = 0; f < 4; f++) frames.push({ name: `pet_hamsterball_${c}_${f}`, img: ball(c, f) });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { name, img } of frames) fs.writeFileSync(path.join(OUT, name + '.png'), encodePNG(img.w, img.h, img.data));
  console.log(`hamster: ${frames.length} frames → art/creatures/src/`);
}
