// Works outfits on the portrait busts (Phase 6 round 2, ROADMAP 7.6): six villagers were re-roled as
// works specialists and their walking sheets got new outfits (art/npcs/<id>/), so their 32 px busts
// get the same clothes here. Each outfit is pixels drawn over the bust (outfits/<id>.png, read by
// moods.mjs as `overlay` and pasted over every mood, so the blink frame never changes the clothes);
// garment recolours that follow the bust's own shapes are `recolor` rules in moods.json instead.
//
// An outfit is a list of [row, column, "pixels"] runs, one character per pixel (LEGEND; "." leaves the
// bust as it is, "_" erases to transparent).
//
// Usage: node art/portraits/outfits.mjs && node art/portraits/moods.mjs
//        && node scripts/sprites-import.mjs art/portraits/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEGEND = {
  _: '#ff00ff', // erase (moods.mjs)
  O: '#2e222f', // outline
  1: '#45293f', 2: '#6e2727', 3: '#7a3045', 4: '#9e4539', 5: '#cd683d', // plum, rust, brass shadow
  Y: '#fbff86', R: '#f9c22b', r: '#f79617', e: '#e6904e', // brass, forehead
  G: '#8fd3ff', g: '#4d9be6', k: '#484a77', K: '#323353', B: '#4d65b4', // glass, coat blues
  C: '#fdcbb0', c: '#ab947a', m: '#966c6c', W: '#ffffff', // cream, taupe leather
  v: '#547e64', V: '#374e4a', // green canvas
  y: '#cf657f', // eraser
  H: '#c7dcd0', h: '#9babb2', j: '#7f708a', d: '#625565', // grey hair
  p: '#753c54', P: '#45293f', // plum coat
  o: '#676633', q: '#4c3e24', L: '#a2a947', // olive hood
};
for (const [ch, c] of Object.entries(LEGEND)) if (ch !== '_' && !PAL.includes(c)) throw new Error(`legend ${ch}: ${c} is not a palette colour`);

const OUTFITS = {
  // Bram: brass goggles pushed up on the hairline, blue glass, a leather strap round the head
  bram: [
    [4, 11, 'Rr'], [4, 19, 'Rr'],
    [5, 8, '22rGgr5555rGgr22'],
    [6, 8, '225gk5....5gk522'],
    [7, 11, '55'], [7, 19, '55'],
  ],
  // Pip: oversized goggles on the golden hair (dark rims, it would vanish in brass) and the green
  // satchel strap across the t-shirt
  pip: [
    [9, 11, '11'], [9, 19, '11'],
    [10, 8, '111Gg111111Gg111'],
    [11, 8, '111gk1....1gk111'],
    [12, 11, '11'], [12, 19, '11'],
    [25, 11, 'vv'], [26, 12, 'Vvv'], [27, 14, 'Vvv'], [28, 16, 'Vvv'], [29, 18, 'Vvv'], [30, 20, 'Vvv'], [31, 22, 'Vv'],
  ],
  // Juniper: the tan leather apron's bib with a pocket over the green shirt (its straps are the
  // suspenders, recoloured in moods.json); the lime neckerchief stays knotted at the throat
  juniper: [
    [27, 10, 'mmmmmmmmmmmm'],
    [28, 10, 'mCcccccccccm'],
    [29, 10, 'mcCccccccccm'],
    [30, 10, 'mccmmmmmmccm'],
    [31, 10, 'mccmccccmccm'],
  ],
  // Sable: lapels of the long coat (recoloured to the sheet's blue in moods.json), the satchel strap,
  // and a rolled drawing standing up behind the shoulder
  sable: [
    [17, 2, 'OOO'],
    [18, 1, 'OCWcO'], [19, 1, 'OCccO'], [20, 2, 'OCcmO'], [21, 2, 'O333O'], [22, 3, 'OCcmO'], [23, 3, 'OCcmO'], [24, 4, 'OCcO'],
    [27, 11, 'B'], [28, 11, 'B'], [29, 11, 'B'], [30, 11, 'BB'], [31, 11, 'B'],
    [25, 24, '322'], [26, 22, '322'], [27, 20, '322'], [28, 18, '322'], [29, 16, '322'], [30, 14, '322'], [31, 12, '322'],
  ],
  // Hazel: a pencil tucked behind the ear (eraser up and back), and the ink-stained cream smock over
  // the lavender shirt with the rose scarf's end hanging down it
  hazel: [
    [12, 24, 'y'], [13, 23, 'Rr'], [14, 22, 'Rr'], [15, 21, 'Cr'],
    [27, 7, 'mCCCCm......mCccm'],
    [28, 7, 'mCCCCCCCCCyy2cccm'],
    [29, 7, 'mCCKkCCCCCyy2cccm'],
    [30, 7, 'mCKCCCCCCcyy2cKcm'],
    [31, 7, 'mCCCCCCCCcyy2cccm'],
  ],
  // Thorne: the hood pushed back. Grey hair where it was, dark welding goggles in brass rims on the
  // forehead, the hood bunched round the neck as the olive collar of the sheet, the plum coat below
  thorne: [
    [2, 13, '______'],
    [3, 11, '_OOOOOOOO_'],
    [4, 10, 'OOHHHhHhhjOO'],
    [5, 9, 'OhRRrhHhhRRrjO'],
    [6, 8, 'OqRHVVrhhRHVVrqO'],
    [7, 8, 'OqRVVv5qqRVVv5qO'],
    [8, 8, 'OjrVvv5eerVvv5dO'],
    [9, 7, 'Ohj54445ee54445jdO'],
    [10, 7, 'Ohj5eeeee555555jdO'],
    // the ears, and the neck where the hood was
    [11, 6, '_Ohh'], [11, 21, 'jjdO_'],
    [12, 6, 'OOh'], [12, 22, 'jdOO'],
    [13, 5, 'Oe5h'], [13, 23, 'd54O'],
    [14, 5, 'Oe4j'], [14, 23, 'd45O'],
    [15, 5, '_O5j'], [15, 23, 'd5O_'],
    [16, 5, '__'], [16, 24, 'O__'],
    [17, 4, '___'], [17, 25, '___'],
    [18, 4, '___'], [18, 25, '___'],
    [19, 4, '__'], [19, 26, '__'],
    // the collar: the hood's olive cloth bunched on the shoulders, lit from the upper left
    [20, 4, 'OO'], [20, 26, 'OO'],
    [21, 3, 'Ooo'], [21, 26, 'ooO'],
    [22, 2, 'OLoq'], [22, 26, 'ooqO'],
    [23, 1, 'OLooq'], [23, 25, 'oooqqO'],
    [24, 1, 'Ooooq'], [24, 26, 'oqqqO'],
    [25, 1, 'OoqqP'], [26, 1, 'OqqPp'], [27, 1, 'OPppp'],
    [25, 26, 'qqqPO'], [26, 25, 'qqPppO'], [27, 25, 'PppppO'],
  ],
};

fs.mkdirSync(path.join(HERE, 'outfits'), { recursive: true });
for (const [id, runs] of Object.entries(OUTFITS)) {
  const data = new Uint8Array(32 * 32 * 4);
  for (const [y, x0, s] of runs)
    [...s].forEach((ch, i) => {
      if (ch === '.') return;
      const c = LEGEND[ch];
      if (!c) throw new Error(`${id}: unknown pixel "${ch}"`);
      data.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), (y * 32 + x0 + i) * 4);
    });
  fs.writeFileSync(path.join(HERE, 'outfits', `${id}.png`), encodePNG(32, 32, data));
}
console.log(`outfits: ${Object.keys(OUTFITS).length} overlays -> art/portraits/outfits/`);
