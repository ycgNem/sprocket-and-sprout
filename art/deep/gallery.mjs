// The works problems' doorways (o:<O.GALLERY>:<v>:<season>, 16x16, drawn into the map chunks):
// 0 level 6's collapsed gallery, 1 shored with fresh timber, 2 level 10's flooded stair, 3 drained.
// Hand-pixeled as character grids on one shared timber frame, so the four states line up.
// Usage: node art/deep/gallery.mjs  -> art/deep/out/gallery-<v>.png, e2e/out/deep/gallery.png
import path from 'node:path';
import { Img, DEEP, ROOT, sheet, PAL } from './tools/lib.mjs';

const K = {
  '.': null,
  o: '#2e222f', // outline, the dark of the mouth
  p: '#3e3546', P: '#45293f', // plum dark, wood darkest
  w: '#7a3045', b: '#9e4539', t: '#cd683d', T: '#e6904e', F: '#fbb954', // timber (F: fresh-cut highlight)
  s: '#625565', S: '#966c6c', A: '#ab947a', C: '#c7dcd0', // warm stone
  1: '#323353', 2: '#484a77', 3: '#4d65b4', 4: '#4d9be6', 5: '#8fd3ff', // water
  y: '#f79617', Y: '#f9c22b', // brass bolts
  m: '#165a4c', M: '#239063', // moss
};

// the frame: a lintel across the top resting on two posts; the mouth is x 4-11, rows 4-15
const FRAME = [
  'oooooooooooooooo',
  'oTTTTTTTTTTTTTto',
  'otttttttttttttbo',
  'owwwwwwwwwwwwwwo',
];
const post = (row) => 'oTtw' + row + 'tbwo';

const STAIR = [ // the steps going down, darkening into the wall (rows 4-15, x 4-11)
  'oooooooo',
  'oooooooo',
  'pppppppo',
  'oooooooo',
  'sssssspp',
  'pppppppp',
  'SSSSSSss',
  'ssssssss',
  'AAAAAASs',
  'SSSSSSSs',
  'CAAAAAAS',
  'AAAAAASS',
];

const STATES = {
  // 0: caved in: the lintel snapped and sagging, rubble and a fallen beam fill the mouth
  0: [
    'oooooooooooooooo',
    'oTTTTTToTTTTTTto',
    'ottttttwottttbbo',
    'owwwwwwoowwwwwwo',
    'oTtwoootooootbwo',
    'oTtwoTtbwoooobwo',
    'oTtwooowbtoAsbwo',
    'oTtwosAoowbtoowo',
    'oTtwsAASoowbtowo',
    'oTtoAACSsooowbto',
    'oTosAASSsoAAoowo',
    'ooASSssooAACSooo',
    'oSAASooSAACASsSo',
    'oAAASsSAAASSSsSo',
    'oSSSsoSSASsssoso',
    'ooooo.oooooooooo',
  ],
  // 1: shored: a fresh header beam with brass bolts and knee braces under the old lintel, the way down open
  1: [
    ...FRAME.slice(0, 3),
    'owwwwwwwwwwwwwwo',
    'oTtwFFFFFFFFtbwo',
    'oTtwtYttttYttbwo',
    'oTtwbtpppptbtbwo',
    'oTtwotbooobtobwo',
    post('sssssspp'), post('pppppppp'), post('SSSSSSss'), post('ssssssss'),
    post('AAAAAASs'), post('SSSSSSSs'), post('CAAAAAAS'), 'oTtwAAAAAASStbwo',
  ],
  // 2: flooded: dark water up to the threshold, a glint where the lantern catches it
  2: [
    ...FRAME,
    post('oooooooo'), post('oooooooo'),
    post('11111111'), post('12211121'), post('22222222'), post('23322232'),
    post('33333333'), post('34433343'), post('33333333'), post('45333543'),
    post('44344434'), 'oTtw44444444tbwo',
  ],
  // 3: drained: the steps again, still wet: dark treads, a puddle, moss in the corner
  3: [
    ...FRAME,
    post('oooooooo'), post('oooooooo'), post('pppppppo'), post('oooooooo'),
    post('sssssspp'), post('pppppppp'), post('SSS33Sss'), post('ssssssss'),
    post('AAAAAASs'), post('SSSSSSSs'), post('mAAAA43S'), 'oTtwMAAAAASStbwo',
  ],
};

const out = [];
for (const [v, rows] of Object.entries(STATES)) {
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) throw new Error(`gallery ${v}: rows must be 16x16 (${rows.map((r) => r.length).join(',')})`);
  const im = new Img(16, 16);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (!(ch in K)) throw new Error(`gallery ${v}: unknown key ${ch}`);
    if (K[ch]) im.set(x, y, K[ch]);
  }));
  const off = im.offPalette();
  if (off.length) throw new Error(`gallery ${v}: off-palette ${off}`);
  im.save(path.join(DEEP, 'out', `gallery-${v}.png`));
  out.push(im);
}
void STAIR; void PAL;
sheet(out, path.join(ROOT, 'e2e/out/deep/gallery.png'), { k: 8, cols: 4 });
console.log('gallery: 4 doorways -> art/deep/out/gallery-*.png, e2e/out/deep/gallery.png');
