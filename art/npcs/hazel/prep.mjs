// Hazel's works outfit (Phase 6 round 2): PixelLab edit_image redrew her 16 walk frames as the
// draughtswoman (an ink-stained cream smock over the lavender shirt, a pencil behind the ear, a rolled
// blueprint under the arm), saved in edit-a/. This maps every colour of the edit onto the palette by
// hand (the plain snap turns the cream smock sage and the copper hair brown) and patches the frames
// where the edit dropped the blueprint; prep/ is what recipe.json imports.
//
// Usage: node art/npcs/hazel/prep.mjs && node scripts/art-import.mjs art/npcs/hazel/recipe.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, nearest } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = ['south', 'east', 'north', 'west'];
/** source colour -> palette colour */
const MAP = {
  // outline and dark edges
  '#010000': '#2e222f', '#020101': '#2e222f', '#090505': '#2e222f', '#221617': '#2e222f', '#260607': '#2e222f', '#232431': '#2e222f',
  '#3e1e27': '#45293f', '#56282f': '#7a3045', '#9d6f73': '#966c6c',
  // copper hair
  '#480d0f': '#6e2727', '#561516': '#6e2727', '#6b1a17': '#9e4539', '#77291c': '#9e4539', '#881919': '#9e4539', '#8b3117': '#9e4539',
  '#a13924': '#cd683d', '#b04918': '#cd683d', '#c0481a': '#cd683d', '#c95a45': '#e6904e',
  // skin
  '#efaa7c': '#fca790', '#eb9d78': '#fca790', '#f6be90': '#fdcbb0', '#e08564': '#e6904e', '#d47054': '#e6904e',
  // lavender shirt, rose scarf
  '#a68aa2': '#7f708a', '#a27da1': '#7f708a', '#786d91': '#6b3e75', '#734b6e': '#6b3e75', '#5f3554': '#45293f',
  '#dd5e84': '#cf657f', '#ab4a5d': '#a24b6f',
  // cream smock, ink, blueprint, pencil
  '#e4d9b7': '#fdcbb0', '#c3af8c': '#ab947a', '#0f1e43': '#323353', '#37639f': '#4d65b4', '#548dcc': '#4d9be6', '#e6bd26': '#f9c22b',
};

const unmapped = new Map();
const frames = {};
for (const d of DIRS)
  for (let f = 0; f < 4; f++) {
    const img = decodePNG(fs.readFileSync(path.join(HERE, 'edit-a', d, `${f}.png`)));
    const out = new Uint8Array(img.data.length);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < 128) continue;
      const src = hex(img.data[i], img.data[i + 1], img.data[i + 2]);
      let to = MAP[src];
      if (!to) {
        to = PAL[nearest(img.data[i], img.data[i + 1], img.data[i + 2]).i];
        unmapped.set(src, (unmapped.get(src) ?? 0) + 1);
      }
      out.set([1, 3, 5].map((k) => parseInt(to.slice(k, k + 2), 16)).concat(255), i);
    }
    frames[`${d}/${f}`] = { w: img.w, h: img.h, data: out };
  }
// The edit dropped the blueprint (and twice the pencil) in some walk frames, so they would flicker:
// copy the roll from the direction's walk0 (same body position), behind the hand, outline included.
const ROLL = new Set(['#323353', '#4d65b4', '#4d9be6']);
const HAND = new Set(['#fca790', '#e6904e']);
const px = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return img.data[i + 3] ? hex(img.data[i], img.data[i + 1], img.data[i + 2]) : null;
};
const put = (img, x, y, c) => img.data.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), (y * img.w + x) * 4);
function stampRoll(dir, from, to, [x0, y0, x1, y1]) {
  const s = frames[`${dir}/${from}`], t = frames[`${dir}/${to}`];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const c = px(s, x, y);
      if (ROLL.has(c) && !HAND.has(px(t, x, y))) put(t, x, y, c);
      // the roll's outer outline where it sticks out of the body
      else if (c === '#2e222f' && !px(t, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ROLL.has(px(s, x + dx, y + dy)))) put(t, x, y, c);
    }
}
stampRoll('south', 0, 1, [15, 14, 26, 22]);
stampRoll('east', 0, 1, [19, 19, 25, 24]);
stampRoll('north', 0, 1, [20, 17, 25, 23]);
stampRoll('west', 0, 1, [7, 19, 23, 24]);
stampRoll('west', 0, 3, [7, 19, 23, 24]);
// the pencil behind the ear
for (const [k, list] of Object.entries({
  'north/1': [[23, 5, '#7a3045'], [23, 6, '#fca790'], [22, 7, '#f9c22b'], [22, 8, '#966c6c']],
  'west/3': [[15, 8, '#45293f'], [16, 8, '#f9c22b'], [16, 9, '#45293f'], [17, 9, '#f9c22b']],
})) for (const [x, y, c] of list) put(frames[k], x, y, c);

for (const [k, img] of Object.entries(frames)) {
  fs.mkdirSync(path.join(HERE, 'prep', k.split('/')[0]), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'prep', `${k}.png`), encodePNG(img.w, img.h, img.data));
}
console.log('hazel prep: 16 frames -> art/npcs/hazel/prep/' + (unmapped.size ? `; unmapped (snapped): ${[...unmapped].map(([c, n]) => `${c}:${n}`).join(' ')}` : ''));
