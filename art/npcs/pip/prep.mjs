// Pip's works outfit (Phase 6 round 2), the self-appointed apprentice: big leather gloves, a green
// tool satchel with a wrench, brass goggles on the forehead. PixelLab edit_image redrew the 16 walk
// frames (edit-b/: gloves and satchel; asked for goggles too, edit-a/ turned the golden hair into a
// leather cap, so it is kept only as a reference). This maps every colour of edit-b onto the palette
// by hand (head and body apart: the edit uses the same golds for the hair and the gloves) and draws
// the goggles; prep/ is what recipe.json imports. The input frames were the 24 px walk padded to 32
// (pad32/), so the edit's canvas is 32 px.
//
// Usage: node art/npcs/pip/prep.mjs && node scripts/art-import.mjs art/npcs/pip/recipe.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, nearest } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = ['south', 'east', 'north', 'west'];
/** rows from the top of the art that are the head */
const HEAD = 11;
/** source colour -> palette colour; [head, body] where one colour plays two parts */
const MAP = {
  '#06030e': '#2e222f',
  // golden hair / leather gloves
  '#f2dcb5': ['#fbff86', '#c7dcd0'], '#f6cd67': ['#f9c22b', '#e6904e'], '#dd9a46': ['#fbb954', '#cd683d'], '#bf6c39': ['#f79617', '#9e4539'],
  // skin, brown shorts and boots
  '#e78c6c': '#e6904e', '#7d382d': ['#cd683d', '#6e2727'], '#3c1e22': '#45293f', '#313041': '#3e3546',
  // sky blue t-shirt
  '#658eaa': '#4d9be6', '#3b568b': '#4d65b4',
  // green satchel and strap
  '#465f4d': '#374e4a', '#71905a': '#547e64',
};

/**
 * Goggles on the forehead, placed from the head's outline at its 5th row: two pale glass lenses on a
 * dark plum strap from the front, one lens at the brow and the strap from the side. Only paints
 * inside the outline.
 */
const STRAP = '#45293f', GLINT = '#8fd3ff', GLASS = '#4d9be6', DEEP = '#4d65b4';
function goggles(img, d, top) {
  const get = (x, y) => { const i = (y * img.w + x) * 4; return img.data[i + 3] ? hex(img.data[i], img.data[i + 1], img.data[i + 2]) : null; };
  const set = (x, y, c) => { const v = get(x, y); if (v && v !== '#2e222f') img.data.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), (y * img.w + x) * 4); };
  const g = top + 4;
  let xL = -1, xR = -1;
  for (let x = 0; x < img.w; x++) if (get(x, g)) { if (xL < 0) xL = x; xR = x; }
  if (d === 'south') {
    const x0 = Math.round((xL + xR) / 2) - 4;
    [STRAP, STRAP, GLINT, GLASS, STRAP, GLINT, GLASS, STRAP, STRAP].forEach((c, i) => set(x0 + i, g, c));
    [null, STRAP, GLASS, DEEP, STRAP, GLASS, DEEP, STRAP, null].forEach((c, i) => c && set(x0 + i, g + 1, c));
  } else if (d === 'north') {
    // from behind only the hair: a strap across it made the round golden head read as a hard hat
  } else {
    // the lens sits one pixel in from the face's front edge, the strap runs back along the head
    const front = d === 'east' ? xR - 1 : xL + 1, back = d === 'east' ? -1 : 1;
    const lx = d === 'east' ? front - 1 : front;
    set(lx, g, GLINT); set(lx + 1, g, GLASS); set(lx, g + 1, GLASS); set(lx + 1, g + 1, DEEP);
    for (let x = front + 2 * back; d === 'east' ? x > xL : x < xR; x += back) set(x, g, STRAP);
  }
}

const unmapped = new Map();
for (const d of DIRS)
  for (let f = 0; f < 4; f++) {
    const img = decodePNG(fs.readFileSync(path.join(HERE, 'edit-b', d, `${f}.png`)));
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
    goggles({ w: img.w, h: img.h, data: out }, d, top);
    fs.mkdirSync(path.join(HERE, 'prep', d), { recursive: true });
    fs.writeFileSync(path.join(HERE, 'prep', d, `${f}.png`), encodePNG(img.w, img.h, out));
  }
console.log('pip prep: 16 frames -> art/npcs/pip/prep/' + (unmapped.size ? `; unmapped (snapped): ${[...unmapped].map(([c, n]) => `${c}:${n}`).join(' ')}` : ''));
