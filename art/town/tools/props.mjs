// The tram's small pieces and the town line's post.
//   st:tram_bin:*:*:<season>  18 x 31, origin (1, 15): PixelLab batch d3a36762 slot 32 (a copper
//       hopper on braced timber stilts), with a copper spout on its south side over the cart (the
//       marked output side) and snow on the rim in winter. The renderer's ore pixels (tile top
//       -13/-12, x 3-14) land inside the open mouth.
//   town:sign      12 x 30, origin (6, 29): batch d3a36762 slot 40 (a brass roundel with a cart on
//       a post with a stone foot).
//   town:townline  10 x 26, origin (5, 25): hand-pixeled after batch slot 48 (crossarm, copper
//       insulators, a brass junction box); the renderer's wire ends on the west insulator at
//       (2, 4), so the post keeps the procedural one's geometry.
//   town:buffer    12 x 14, origin (6, 12): hand-pixeled after batch 44b7f08c slot 24, its bumper
//       copper instead of the candidate's alarm red.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const raw = (b, i) => Img.load(path.join(HERE, '..', 'raw', b, i + '.png')).snap().trim();

/** paint a character grid at (x0, y0); '.' is skipped */
function stamp(im, x0, y0, rows, legend) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.') return;
    if (!(ch in legend)) throw new Error('legend ' + ch);
    im.set(x0 + i, y0 + j, legend[ch]);
  }));
  return im;
}

/** st:tram_bin:*:*:<season> */
export function drawBin(season) {
  const im = new Img(18, 31);
  im.blit(raw('b32', 32), 0, 0);
  // the spout: a copper chute from the funnel's foot leaning south over the cart
  stamp(im, 6, 16, [
    'aaaaaa',
    'aCLCCa',
    'aDCCDa',
    '.aCDa.',
    '.aBBa.',
    '..aa..',
  ], { a: '#2e222f', C: '#cd683d', L: '#e6904e', D: '#9e4539', B: '#f9c22b' });
  if (season === 3) for (let x = 1; x < 17; x++) if (im.get(x, 1)) im.set(x, 1, x % 5 ? '#ffffff' : '#c7dcd0');
  return im;
}

export function drawSign() {
  const im = new Img(12, 30);
  const a = raw('b32', 40);
  im.blit(a, Math.floor((12 - a.w) / 2), 30 - a.h);
  return im;
}

export function drawTownLine() {
  return stamp(new Img(10, 26), 0, 0, [
    '..........',
    '..........',
    '.aa....aa.',
    'aBHa..aBHa',
    'aCCa..aCCa',
    'aaaaaaaaaa',
    'aWWWLWWWWa',
    'aDDDDDDDDa',
    '.aaaLDaaa.',
    '...aLDa...',
    '...aLDa...',
    '..aaaaaa..',
    '..aHBBMa..',
    '..aBkkMa..',
    '..aBBBMa..',
    '..aMMMMa..',
    '..aaaaaa..',
    '...aLDa...',
    '...aLDa...',
    '...aLDa...',
    '...aLDa...',
    '...aLDa...',
    '..aaLDaa..',
    '..aSSSTa..',
    '..aTTTTa..',
    '..aaaaaa..',
  ], { a: '#2e222f', B: '#f9c22b', H: '#fbff86', M: '#cd683d', C: '#ea4f36', W: '#cd683d', L: '#9e4539', D: '#7a3045', k: '#45293f', S: '#ab947a', T: '#966c6c' });
}

export function drawBuffer() {
  return stamp(new Img(12, 14), 0, 0, [
    '.aa......aa.',
    'aBHa....aBHa',
    'aWLa....aWLa',
    'aaaaaaaaaaaa',
    'aPPPPPPPPPPa',
    'aCCBCCCCBCCa',
    'aDDDDDDDDDDa',
    'aaaaaaaaaaaa',
    '.aWLa..aWLa.',
    '.aWLaaaaWLa.',
    '.aWLWWWLWLa.',
    '.aWLDDDDWLa.',
    '.aWLaaaaWLa.',
    '.aaaa..aaaa.',
  ], { a: '#2e222f', B: '#f9c22b', H: '#fbff86', W: '#9e4539', L: '#7a3045', D: '#45293f', P: '#f57d4a', C: '#ea4f36', K: '#b33831' }).recolor({ '#45293f': '#45293f' });
}

if (process.argv[1] && process.argv[1].endsWith('props.mjs')) {
  const { lineup } = await import('./px.mjs');
  const B = (n) => Img.load('art/town/baked/' + n + '.png');
  const frames = [drawBin(0), drawBin(3), B('st_tram_bin_0_0_0'), drawSign(), B('town_sign'), drawTownLine(), B('town_townline'), drawBuffer(), B('town_buffer')];
  lineup(frames, { k: 6, gap: 3, bg: '#966c6c' }).save(process.argv[2] ?? 'e2e/out/town-props-draft.png');
  console.log(frames.map((f) => f.offPalette()).join(','));
}
