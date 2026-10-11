// Sable's works outfit (Phase 6 round 2): PixelLab edit_image redrew their 16 walk frames as the
// archivist (a long coat to the knees, a satchel strap across the chest, rolled drawings at the hip),
// saved in edit-a/. The edit's slate coat sits far from the palette, so every colour is mapped here by
// hand onto Sable's 1.x ramps (the blue cardigan's, their skin tone, the purple hair, the lavender
// scarf); prep/ is what recipe.json imports. The down row's walk2 came out drawn from behind in the
// original walk, so edit-a/south/2.png is the edited south rotation and the recipe reuses walk0 there.
//
// Usage: node art/npcs/sable/prep.mjs && node scripts/art-import.mjs art/npcs/sable/recipe.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, nearest } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = ['south', 'east', 'north', 'west'];
/** source colour -> palette colour */
const MAP = {
  // outline
  '#010006': '#2e222f', '#010106': '#2e222f', '#010003': '#2e222f', '#070107': '#2e222f', '#080612': '#2e222f', '#180b11': '#2e222f',
  // the coat on the 1.x cardigan ramp
  '#64707f': '#4d65b4', '#525f71': '#484a77', '#3c4b5e': '#484a77', '#344155': '#323353', '#283349': '#323353',
  '#1f273e': '#323353', '#151931': '#323353', '#26131c': '#323353', '#251b2d': '#323353',
  // skin (1.x tone ramp)
  '#ed9a6a': '#cd683d', '#c07a64': '#cd683d', '#b85f48': '#9e4539', '#a74a3d': '#9e4539', '#984535': '#7a3045', '#883f34': '#7a3045',
  // satchel, strap, boots
  '#7c3133': '#7a3045', '#66312d': '#6e2727', '#5a1e14': '#45293f',
  // purple hair, lavender scarf
  '#76507e': '#6b3e75', '#684372': '#6b3e75', '#5a375d': '#6b3e75', '#492352': '#45293f', '#401f3a': '#45293f',
  '#7f64a3': '#905ea9', '#634996': '#905ea9', '#877aa5': '#a884f3', '#a69abc': '#a884f3',
  // rolled drawings, glints
  '#ebd3af': '#fdcbb0', '#e6b799': '#ab947a', '#f6e9cf': '#ffffff', '#dbdae0': '#ffffff',
};

const unmapped = new Map();
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
    fs.mkdirSync(path.join(HERE, 'prep', d), { recursive: true });
    fs.writeFileSync(path.join(HERE, 'prep', d, `${f}.png`), encodePNG(img.w, img.h, out));
  }
console.log('sable prep: 16 frames -> art/npcs/sable/prep/' + (unmapped.size ? `; unmapped (snapped): ${[...unmapped].map(([c, n]) => `${c}:${n}`).join(' ')}` : ''));
