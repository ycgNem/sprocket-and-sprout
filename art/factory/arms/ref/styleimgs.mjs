// Crops a few shipped factory sprites into 32x32 PNGs (transparent) as PixelLab style references.
// Usage: node art/factory/arms/ref/styleimgs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../../scripts/lib/png.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const want = { gleaner: ['fieldworks', 'st:gleaner:0:1:'], jar: ['factory', 'st:jar:0:1:'], chest: ['factory', 'st:chest_wood:'], crate: ['buildings', 'st:shipping_crate:'] };
for (const [nm, [sheet, prefix]] of Object.entries(want)) {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, `src/art/${sheet}.json`), 'utf8'));
  const list = Array.isArray(man) ? man : man.sprites ?? man.frames;
  const f = list.find((s) => s.match.startsWith(prefix));
  if (!f) { console.log('missing', nm); continue; }
  const png = decodePNG(fs.readFileSync(path.join(ROOT, `src/art/${sheet}.png`)));
  const [x, y, w, h] = f.r;
  const S = 32, out = new Uint8Array(S * S * 4);
  const ox = Math.floor((S - w) / 2), oy = S - h - 1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const si = ((y + j) * png.w + (x + i)) * 4, di = ((oy + j) * S + (ox + i)) * 4;
    if (oy + j < 0 || ox + i < 0 || oy + j >= S || ox + i >= S) continue;
    for (let k = 0; k < 4; k++) out[di + k] = png.data[si + k];
  }
  fs.writeFileSync(path.join(HERE, `style-${nm}.png`), encodePNG(S, S, out));
  console.log(nm, f.match, w, h);
}
