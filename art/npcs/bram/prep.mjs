// Bram's works outfit (Phase 6 round 2): PixelLab edit_image redrew his 16 walk frames as a foundry
// master (heavy leather apron, gauntlets, brass goggles pushed up), saved in edit-a/. This maps every
// colour of that edit onto the palette by hand, so he keeps his 1.x colours (blue shirt, warm brown
// skin, black beard) and the gauntlets read as leather, not bare arms; prep/ is what recipe.json imports.
//
// Usage: node art/npcs/bram/prep.mjs && node scripts/art-import.mjs art/npcs/bram/recipe.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, nearest } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = ['south', 'east', 'north', 'west'];
/** rows from the top of the art that are the head (goggles to beard) */
const HEAD = 12;
/** source colour -> palette colour; [head, body] where one colour plays two parts */
const MAP = {
  // outline and near-blacks
  '#000000': '#2e222f', '#000001': '#2e222f', '#010000': '#2e222f', '#010001': '#2e222f', '#010003': '#2e222f',
  '#010100': '#2e222f', '#010103': '#2e222f', '#000101': '#2e222f', '#020202': '#2e222f', '#100a0d': '#2e222f',
  '#1b161b': '#2e222f',
  // black hair and beard, dark trousers
  '#252129': '#3e3546', '#2c2e3a': '#3e3546', '#3b363b': '#3e3546', '#3b4346': '#625565',
  // the 1.x blue shirt
  '#4c5467': '#4d65b4', '#2d3042': '#484a77',
  // leather apron and boots
  '#56372b': '#6e2727', '#331f23': '#45293f', '#3b2525': '#45293f', '#442e25': '#45293f',
  // skin (the 1.x tone ramp) / tan leather gauntlets
  '#7d4c38': '#9e4539', '#6d452f': ['#7a3045', '#966c6c'], '#90623c': '#ab947a', '#a3723e': '#ab947a',
  // eyes, goggle glint, brass goggles
  '#fbe7b1': '#ffffff', '#debfac': '#fdcbb0', '#c59041': '#f79617', '#f1c470': '#f9c22b',
};

/**
 * The goggles from the front: the edit drew two bright brass blobs right above his eyes, which read
 * as glowing eyes on his dark face. Redrawn as one band: brass rims and bridge, pale glass lenses.
 * [x of the left lens, row] per south frame.
 */
const GOGGLES = { 0: [15, 3], 1: [15, 3], 2: [15, 3], 3: [17, 3] };
function goggles(set, [L, y]) {
  const top = ['#cd683d', '#8fd3ff', '#4d9be6', '#f79617', '#f79617', '#8fd3ff', '#4d9be6', '#cd683d'];
  top.forEach((c, i) => set(L - 1 + i, y, c));
  for (const x of [L, L + 4]) { set(x, y + 1, '#4d9be6'); set(x + 1, y + 1, '#484a77'); }
}

const unmapped = new Map();
for (const d of DIRS)
  for (let f = 0; f < 4; f++) {
    const img = decodePNG(fs.readFileSync(path.join(HERE, 'edit-a', d, `${f}.png`)));
    let top = img.h;
    for (let i = 0; i < img.w * img.h; i++) if (img.data[i * 4 + 3] >= 128) { top = Math.floor(i / img.w); break; }
    const out = new Uint8Array(img.data.length);
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4;
        if (img.data[i + 3] < 128) continue;
        const src = hex(img.data[i], img.data[i + 1], img.data[i + 2]);
        let to = MAP[src];
        if (Array.isArray(to)) to = y - top < HEAD ? to[0] : to[1];
        if (!to) {
          to = PAL[nearest(img.data[i], img.data[i + 1], img.data[i + 2]).i];
          unmapped.set(src, (unmapped.get(src) ?? 0) + 1);
        }
        out.set([1, 3, 5].map((k) => parseInt(to.slice(k, k + 2), 16)).concat(255), i);
      }
    const set = (x, y, c) => out.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), (y * img.w + x) * 4);
    if (d === 'south') goggles(set, GOGGLES[f]);
    fs.mkdirSync(path.join(HERE, 'prep', d), { recursive: true });
    fs.writeFileSync(path.join(HERE, 'prep', d, `${f}.png`), encodePNG(img.w, img.h, out));
  }
console.log('bram prep: 16 frames -> art/npcs/bram/prep/' + (unmapped.size ? `; unmapped (snapped): ${[...unmapped].map(([c, n]) => `${c}:${n}`).join(' ')}` : ''));
