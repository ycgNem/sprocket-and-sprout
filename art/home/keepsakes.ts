// The five export ports' keepsakes (2.2): farmhouse floor pieces, one tile each, hand-pixeled as
// ASCII so they stay editable. Placed like the Brass Globe: a 16x24 frame, origin (0, 8), the art
// standing on the frame's bottom centre (art/home/sprites.json, hf:keepsake:<n>:*).
//   0 Brassmouth   a brass foundry bell hung in a dark iron frame
//   1 Verdance     three painted blue-and-white spice jars stacked on a little wooden stand
//   2 Ember Isles  a dwarf palm in a red lacquer pot with a gold rim
//   3 Saltspire    a shipwright's model of the Copper Gull on its cradle
//   4 Kettleholm   a copper samovar with brass handles, band and tap
// Light from the upper left, a closed #2e222f outline, Resurrect 64 only (the script throws on
// anything else). Each also gets a 16x16 item icon, cut from the same drawing (ICON below).
//
// Usage: node art/home/keepsakes.ts   -> art/home/src/keepsake<n>.png, art/icons/raw/hand/f_keep_<port>.png,
//                                        e2e/out/art/keepsakes.png (x8 review)
//        then node scripts/sprites-import.mjs art/home/sprites.json   (and the icons build)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** `drop`: the rows left out of the 16-row item icon (a repeated body row, the stand's legs) */
type Piece = { port: string; key: Record<string, string>; rows: string[]; drop: number[] };
const K = '#2e222f';

const PIECES: Piece[] = [
  {
    port: 'brassmouth',
    drop: [6, 14],
    key: { k: K, g: '#7f708a', I: '#625565', i: '#3e3546', Y: '#fbff86', y: '#f9c22b', o: '#f79617', b: '#cd683d', B: '#9e4539' },
    rows: [
      '.kkkkkkkkkkkkkk.',
      '.kgIIIIIIIIIIik.',
      '.kkkkkkookkkkkk.',
      '.kIk..kyok..kik.',
      '.kIk.kYyyok.kik.',
      '.kIkkYyyyyokkik.',
      '.kIkkYyyyyokkik.',
      '.kIkkyooooBkkik.',
      '.kIkkYyyyyokkik.',
      '.kIkYYyyyyookik.',
      '.kkYYyyyyyoookk.',
      '.kIkkkkkkkkkkik.',
      '.kIk..kyok..kik.',
      '.kIk...kk...kik.',
      '.kIk........kik.',
      'kkIkkkkkkkkkkikk',
      'kgIIIIIIIIIIiiik',
      'kkkkkkkkkkkkkkkk',
    ],
  },
  {
    port: 'verdance',
    drop: [8, 9, 14, 19, 20],
    key: { k: K, W: '#ffffff', s: '#c7dcd0', L: '#8fd3ff', B: '#4d9be6', b: '#4d65b4', w: '#cd683d', d: '#9e4539', h: '#e6904e' },
    rows: [
      '......kkk......',
      '.....kLBbk.....',
      '.....kkkkk.....',
      '....kWWWWsk....',
      '....kWBWBsk....',
      '....kBWBWsk....',
      '....kWWWssk....',
      'kkkkkkkkkkkkkkk',
      'khwwwwwwwwwwwdk',
      'kkkkkkkkkkkkkkk',
      '.kLBbk...kLBbk.',
      '.kkkkk...kkkkk.',
      'kWWWWsk.kWWWWsk',
      'kWBBWsk.kBWWBsk',
      'kWBBWsk.kWBBWsk',
      'kWWWssk.kWWWssk',
      'kkkkkkkkkkkkkkk',
      'khwwwwwwwwwwwdk',
      'kkkkkkkkkkkkkkk',
      '.kdk.......kdk.',
      '.kkk.......kkk.',
    ],
  },
  {
    port: 'ember',
    drop: [9, 14],
    key: { k: K, G: '#91db69', g: '#1ebc73', d: '#239063', D: '#165a4c', w: '#cd683d', W: '#9e4539', Y: '#fbff86', y: '#f9c22b', o: '#f79617', R: '#f57d4a', r: '#e83b3b', m: '#ae2334', M: '#6e2727' },
    rows: [
      '....kkk..kkk....',
      '..kkGGgkkGggkk..',
      '.kGGggdkkGggddk.',
      'kGggkkGgGgkkgddk',
      'kGgk.kGggdk.kgdk',
      'kgk.kGgkkgdk.kdk',
      'kgk.kgkwWkdk.kdk',
      '.k..kkkWwkkk..k.',
      '......kwWk......',
      '......kWwk......',
      '...kkkkkkkkkk...',
      '...kYyyyyyyok...',
      '...kkkkkkkkkk...',
      '...kRrrrrrrmk...',
      '...kRrrrrrmmk...',
      '....krrrrmmk....',
      '....krrrmmMk....',
      '.....kkkkkk.....',
    ],
  },
  {
    port: 'saltspire',
    drop: [15, 16, 17, 18],
    key: { k: K, W: '#ffffff', c: '#fdcbb0', S: '#c7dcd0', R: '#e83b3b', C: '#e6904e', o: '#cd683d', h: '#9e4539', H: '#7a3045', w: '#cd683d', d: '#9e4539', l: '#e6904e' },
    rows: [
      '.........k......',
      '.........kRRk...',
      '.......kkkkkk...',
      '....k..kWWWSk...',
      '..kkkkkkWWWSk...',
      '..kWWSkkWWcSk...',
      '..kWcSkkWccSk...',
      '..kccSkkcccSk...',
      '..kkkkkkkkkkk...',
      'k...k....k...kkk',
      'kkkkkkkkkkkkkCok',
      'kCCCCCCCCCCCCook',
      '.khhhhhhhhhhhHk.',
      '..kkhhhhhhhHkk..',
      '....kkkkkkkk....',
      '....kwk..kwk....',
      '...kkwkkkkwkk...',
      '...klwwwwwwdk...',
      '...kkkkkkkkkk...',
    ],
  },
  {
    port: 'kettleholm',
    drop: [5, 10],
    key: { k: K, C: '#fbb954', c: '#e6904e', m: '#cd683d', d: '#9e4539', Y: '#fbff86', y: '#f9c22b', o: '#f79617' },
    rows: [
      '.......kk.......',
      '......kYok......',
      '.....kkkkkk.....',
      '.....kCcmdk.....',
      '....kkkkkkkk....',
      '...kCCccccmdk...',
      '.kkkCYccccmdkkk.',
      '.kykCYccccmdkyk.',
      '.kkkCcccccmdkkk.',
      '...kYyyyyyook...',
      '...kCcccccmdk...',
      '.kkkCcccccmdk...',
      'kYyoCcccccmdk...',
      'kok.kCccccmk....',
      '.k...kkcmkk.....',
      '....kkkkkkkk....',
      '...kCccccmmdk...',
      '...kkkkkkkkkk...',
    ],
  },
];

type Img = { w: number; h: number; data: Uint8Array };
function draw(p: Piece): Img {
  const h = p.rows.length, w = p.rows[0].length;
  const data = new Uint8Array(w * h * 4);
  p.rows.forEach((r, y) => {
    if (r.length !== w) throw new Error(`${p.port}: row ${y} is ${r.length} wide, not ${w}`);
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      const c = p.key[ch];
      if (!c || !PAL.includes(c)) throw new Error(`${p.port}: '${ch}' (${c}) is not a palette color`);
      data.set([...rgbOf(c), 255], (y * w + x) * 4);
    });
  });
  if (w > 16 || h > 24) throw new Error(`${p.port}: ${w}x${h} does not fit the 16x24 frame`);
  return { w, h, data };
}
const save = (f: string, im: Img) => fs.writeFileSync(f, encodePNG(im.w, im.h, im.data));

/** the item icon: the drawing without its `drop` rows, centred in 16x16 */
function icon(p: Piece): Img {
  const im = draw({ ...p, rows: p.rows.filter((_, y) => !p.drop.includes(y)) });
  if (im.h > 16) throw new Error(`${p.port}: the icon is ${im.h} rows, drop ${im.h - 16} more`);
  const out: Img = { w: 16, h: 16, data: new Uint8Array(16 * 16 * 4) };
  const ox = Math.floor((16 - im.w) / 2), oy = Math.floor((16 - im.h) / 2);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const s = (y * im.w + x) * 4;
    if (im.data[s + 3]) out.data.set(im.data.subarray(s, s + 4), ((y + oy) * 16 + x + ox) * 4);
  }
  return out;
}

const imgs = PIECES.map(draw);
imgs.forEach((im, n) => save(path.join(HERE, 'src', `keepsake${n}.png`), im));
const icons = PIECES.map(icon);
icons.forEach((im, n) => save(path.join(ROOT, 'art/icons/raw/hand', `f_keep_${PIECES[n].port}.png`), im));

// review: the five and their icons at x8 on the farmhouse floor's tan
{
  const S = 8, cell = 18, W = PIECES.length * cell * 2, H = 26;
  const out: Img = { w: W * S, h: H * S, data: new Uint8Array(W * S * H * S * 4) };
  const bg = rgbOf('#e6904e');
  for (let i = 0; i < out.data.length; i += 4) out.data.set([...bg, 255], i);
  [...imgs, ...icons].forEach((im, n) => {
    const ox = n * cell + Math.floor((cell - im.w) / 2), oy = H - 1 - im.h;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const s = (y * im.w + x) * 4;
      if (!im.data[s + 3]) continue;
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) out.data.set(im.data.subarray(s, s + 4), (((oy + y) * S + yy) * out.w + (ox + x) * S + xx) * 4);
    }
  });
  fs.mkdirSync(path.join(ROOT, 'e2e/out/art'), { recursive: true });
  save(path.join(ROOT, 'e2e/out/art/keepsakes.png'), out);
}
console.log('keepsakes: ' + PIECES.map((p, n) => `keepsake${n} (${p.port}, ${imgs[n].w}x${imgs[n].h})`).join(', '));
