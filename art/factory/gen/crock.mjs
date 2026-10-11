// The preserving crock (st:jar) as a machine, for the 2.0 screenshot test (the critic: the yard's
// machines read as small pots). The keeper's glass-fronted crock of raspberry jam (PixelLab batch
// D/5, its wooden lid taken off) under a hand-pixeled brass canner lid: a pressure gauge on the
// dome, a copper steam vent with a weighted cap, two clamp bars bolted down the sides. 16 x 30 on
// the 1 x 1 footprint, so it stands 14 px above its tile like a keg.
//
// specs.mjs animates it with CROCK: the gauge needle swings while it works (at rest, pointing low,
// when idle), the vent's weight jiggles, the jam bubbles, and the renderer puffs steam from the
// vent (meta.smoke).
//
// Preview: node art/factory/gen/crock.mjs  ->  e2e/out/crock.png (old crock | off | working 0-3, x8,
// on grass and on dirt)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './lib.mjs';
import { loadArt, dropStrays } from '../../../scripts/lib/pixel.mjs';

/** recolour inside a rect (as specs.mjs does; not imported, specs.mjs imports this file) */
function recolorRect(im, [x0, y0, w, h], map) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = im.get(x, y); if (c && map[c]) im.set(x, y, map[c]); }
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = path.resolve(HERE, '..');
const ROOT = path.resolve(ART, '../..');

export const W = 16, H = 30;
/** the old crock's rows that stay (the glass body, its copper hoop and the stand), and where they go */
const BODY_FROM = 6, BODY_TO = 14;

const KEY = {
  a: '#2e222f', p: '#45293f',
  S: '#9e4539', s: '#cd683d', m: '#f79617', g: '#f9c22b', G: '#fbff86', // brass
  c: '#6e2727', d: '#b33831', e: '#ea4f36', f: '#f57d4a', h: '#fca790', // copper
  w: '#fdcbb0', t: '#ab947a', // the dial's face
};

// rows 0-8: the weighted vent cap and the copper vent at the right edge (row 0 stays clear for the
// cap to lift into); the lid comes from drawLid. Only the vent stands high: the dome rises 7 px, about
// the old wooden lid, so an arm on the tile behind keeps its turntable in view (the keeper's arm in
// the opening stands right there).
const TOP = [
  '................',
  '...........aaaa.',
  '..........aGggsa',
  '..........ammsSa',
  '..........aaaaaa',
  '...........afda.',
  '...........afda.',
  '...........aeda.',
  '...........aeda.',
];
/** the brass canner lid: interior spans per row (a low dome on a 2-row rim), closed in ink */
const LID = { 8: [5, 10], 9: [3, 12], 10: [2, 13], 11: [1, 14], 12: [1, 14] };
// the clamp bars down both sides, rows 13-19 (x 0-1 and 14-15), bolted to the copper hoop
const BARS = [
  ['am', 'Sa'],
  ['am', 'Sa'],
  ['am', 'Sa'],
  ['am', 'Sa'],
  ['am', 'Sa'],
  ['ag', 'sa'],
  ['aS', 'Sa'],
];
/** the pressure gauge on the crock's front, low on the left (w face, t its shade): kept below the
 *  renderer's status lamp at the tile's top right, so the two never pair up as a face */
const GAUGE = {
  at: [2, 18],
  rows: [
    '..aaa..',
    '.awwwa.',
    'awwwwwa',
    'awwwwwa',
    'awwwwta',
    '.attta.',
    '..aaa..',
  ],
};

/** the needle: the pin at the dial's centre and the tip, at rest (idle) and per working frame */
export const NEEDLE = {
  pin: [5, 21], c: '#45293f',
  // tip pixels: at rest it points low left; working, it swings between up and right
  rest: [[4, 22]],
  on: [[[5, 20], [5, 19]], [[6, 20]], [[6, 21], [7, 21]], [[6, 20]]],
};

export const CROCK = {
  /** the vent's weighted cap (lifts a pixel on frames 1 and 3) */
  weight: [10, 1, 6, 4],
  /** steam in the vent's mouth while the cap is up */
  puff: [[11, 4, '#2e222f'], [12, 4, '#fdcbb0'], [13, 4, '#fdcbb0'], [14, 4, '#2e222f']],
  /** the jam behind the glass, above and right of the gauge (bubbles) */
  jam: [9, 15, 3, 7],
  /** the top of the cap: the renderer's steam puffs (meta.smoke) */
  smoke: [12, 1],
};

/** the working frames' effects (fx.mjs), in order: needle, cap, steam, bubbles */
export function crockFx() {
  return [
    ...needleFx(),
    { t: 'move', rect: CROCK.weight, dy: [0, -1, 0, -1] },
    { t: 'paint', px: CROCK.puff, frames: [1, 3] },
    { t: 'bubbles', rect: CROCK.jam, c: '#f68181', n: 3 },
  ];
}

/** the dial's face pixels (to clear a needle) */
function facePx() {
  const px = [];
  GAUGE.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'w' || ch === 't') px.push([GAUGE.at[0] + x, GAUGE.at[1] + y, KEY[ch]]); }));
  return px;
}

/** paint fx for the needle per frame: clear the face, then pin and tip (frame -1 = idle) */
export function needleFx() {
  const face = facePx();
  const draw = (tip) => [...face, [...NEEDLE.pin, NEEDLE.c], ...tip.map(([x, y]) => [x, y, NEEDLE.c])];
  return [
    { t: 'paint', px: draw(NEEDLE.rest), frames: [-1] },
    ...NEEDLE.on.map((tip, f) => ({ t: 'paint', px: draw(tip), frames: [f] })),
  ];
}

/** the lid: the dome lit from the upper left, the rim's top edge catching the light, its face shaded */
function drawLid(im) {
  const inLid = (x, y) => !!LID[y] && x >= LID[y][0] && x <= LID[y][1];
  const layer = new Img(W, H);
  for (const [k, [x0, x1]] of Object.entries(LID)) {
    const y = +k;
    for (let x = x0; x <= x1; x++) {
      let c;
      if (y === 11) c = x === x0 ? KEY.G : x >= x1 - 1 ? KEY.m : KEY.g;
      else if (y === 12) c = x >= x1 - 1 ? KEY.S : KEY.s;
      else {
        const up = !inLid(x, y - 1), left = !inLid(x - 1, y), right = !inLid(x + 1, y);
        c = up && left ? KEY.G : up || left ? KEY.g : right ? KEY.s : KEY.m;
      }
      layer.set(x, y, c);
    }
  }
  layer.outline(KEY.a);
  im.draw(layer);
}

/** the old crock as structs.mjs loads it, jam recoloured: the art cropped to its 16 x 22 box */
function oldCrock() {
  const L = loadArt(path.join(ART, 'raw/D/5.png'));
  dropStrays(L.img);
  const im = new Img(L.img.w, L.img.h);
  for (let i = 0; i < im.w * im.h; i++) if (L.img.data[i * 4 + 3]) im.px[i] = '#' + [0, 1, 2].map((k) => L.img.data[i * 4 + k].toString(16).padStart(2, '0')).join('');
  recolorRect(im, [8, 8, 10, 11], { '#7a3045': '#c32454', '#45293f': '#831c5d', '#ea4f36': '#f04f78' });
  const b = im.bbox();
  return im.crop(b.x0, b.y0, b.w, b.h);
}

export function drawCrock() {
  const old = oldCrock();
  if (old.w !== W) throw new Error(`crock: the old crock is ${old.w} px wide, not ${W}`);
  const im = new Img(W, H);
  for (let y = BODY_FROM; y < old.h; y++) for (let x = 0; x < W; x++) im.set(x, BODY_TO + y - BODY_FROM, old.get(x, y));
  if (BODY_TO + old.h - BODY_FROM !== H) throw new Error('crock: the body does not reach the bottom row');
  drawLid(im);
  TOP.forEach((r, y) => {
    if (r.length !== W) throw new Error(`crock: TOP row ${y} is ${r.length} wide`);
    [...r].forEach((ch, x) => { if (ch !== '.') im.set(x, y, KEY[ch]); });
  });
  BARS.forEach(([l, r], k) => {
    [...l].forEach((ch, x) => im.set(x, 13 + k, KEY[ch]));
    [...r].forEach((ch, x) => im.set(14 + x, 13 + k, KEY[ch]));
  });
  GAUGE.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') im.set(GAUGE.at[0] + x, GAUGE.at[1] + y, KEY[ch]); }));
  return im;
}

// ---- preview ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { animate } = await import('./fx.mjs');
  const base = drawCrock();
  const { off, on } = animate(base, crockFx());
  const old = oldCrock();
  const frames = [old, off, ...on];
  const K = 8, CW = 20, CH = 34;
  const sheet = new Img(frames.length * CW, 2 * CH);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, y < CH ? (((x * 7 + y * 13) % 23) ? '#239063' : '#165a4c') : (((x * 5 + y * 11) % 19) ? '#e6904e' : '#cd683d'));
  frames.forEach((f, i) => { for (const row of [0, 1]) sheet.draw(f, i * CW + 2, row * CH + CH - 2 - f.h); });
  sheet.save(path.join(ROOT, 'e2e/out/crock.png'), K);
  console.log('e2e/out/crock.png: old | off | on0-3');
}
