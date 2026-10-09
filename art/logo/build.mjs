// Builds the logo sheet sources: the brass sprocket emblem in two sizes (8-frame seamless spin)
// and the title wordmark with an empty slot for the spinning O. Everything is drawn by rule
// (gear.mjs, glyphs.mjs, word.mjs); the PixelLab concept batch in raw/concepts was the design
// reference (create_1_direction_object, size 32, 64 slots, 10 generations; prompts in
// concepts.json).
//
// Usage: node art/logo/build.mjs
//   -> art/logo/src/ui_sprocket_<f>.png   16 x 16, origin (8, 8)       hotbar end caps
//      art/logo/src/logo_gear_<f>.png     29 x 32, origin (14, 14)     the O of the wordmark
//      art/logo/src/logo_word.png         the wordmark, origin (0, 0)
//      art/logo/layout.json               sizes, origins and the O slot centre
//      e2e/out/logo/frames.png            all frames of both gears, x1 and x4, on bark/walnut/grass
//      e2e/out/logo/word.png              wordmark + gear frame 0 at x1, x2, x4
//      e2e/out/logo/hotbar-mock.png       the sprockets in the hotbar (x2 over a game screenshot)
//      art/logo/sprites.json              the import recipe (matches layout.json)
// Then: node scripts/sprites-import.mjs art/logo/sprites.json  (-> src/art/logo.png + .json)
//       node art/logo/ingame.mjs  (title shots from the running game, e2e/out/logo/title-*.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../../scripts/lib/png.mjs';
import { DESIGNS, gearFrame } from './gear.mjs';
import { renderWord } from './word.mjs';
import { PX, toImage, blank, draw, fillRect, save } from './pal.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(HERE, 'src'), OUT = path.join(ROOT, 'e2e/out/logo');
fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- gears ----
const gears = {};
for (const [key, D] of Object.entries(DESIGNS)) {
  gears[key] = [...Array(8)].map((_, f) => gearFrame(D, f));
  const name = key === 'small' ? 'ui_sprocket' : 'logo_gear';
  gears[key].forEach((fr, f) => save(path.join(SRC, `${name}_${f}.png`), toImage(fr)));
}
// steadiness check: pixels that differ between consecutive frames (incl. the 7 -> 0 wrap) must lie
// outside the body's static rings, except the holes ring
for (const [key, D] of Object.entries(DESIGNS)) {
  const fr = gears[key], c = D.size / 2, moved = [];
  for (let f = 0; f < 8; f++) {
    const a = fr[f], b = fr[(f + 1) % 8];
    let n = 0, inner = 0;
    a.px.forEach((p, i) => {
      if (p === b.px[i]) return;
      n++;
      const x = i % a.w, y = Math.floor(i / a.w);
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const holeBand = D.holes && Math.abs(r - D.holes.r) < 2;
      if (y < D.size && r < D.rRoot - 1 && !holeBand) inner++; // the root ring may change: valleys move
    });
    moved.push(n + (inner ? `(!${inner})` : ''));
  }
  console.log(`${key}: ${fr[0].w}x${fr[0].h}, changed px per step ${moved.join(' ')}`);
}

// ---- wordmark ----
const LG = DESIGNS.large, lc = LG.size / 2;
const reach = new Map(); // every gear pixel (face or side) any frame fills, relative to the centre
for (const fr of gears.large) fr.px.forEach((p, i) => {
  if (!p || p === PX.ink || p === LG.shadow) return;
  const x = i % fr.w, y = Math.floor(i / fr.w);
  reach.set(x + ',' + y, [x - lc, y - lc]);
});
const word = renderWord([...reach.values()], lc);
save(path.join(SRC, 'logo_word.png'), toImage(word));
const layout = {
  'logo:word': { size: [word.w, word.h], origin: [0, 0], oSlotCentre: word.slot },
  'logo:gear:0..7': { size: [gears.large[0].w, gears.large[0].h], origin: [lc, lc], note: 'draw with its origin on logo:word oSlotCentre' },
  'ui:sprocket:0..7': { size: [gears.small[0].w, gears.small[0].h], origin: [DESIGNS.small.size / 2, DESIGNS.small.size / 2] },
};
fs.writeFileSync(path.join(HERE, 'layout.json'), JSON.stringify(layout, null, 1) + '\n');
console.log(`word: ${word.w}x${word.h}, O slot centre (${word.slot.join(', ')})`);
// the import recipe follows the layout (sizes and the slot move when the art changes)
{
  const frames = (match, file, L) => [...Array(8)].map((_, f) => ({ match: match + f, file: file.replace('#', f), frame: L.size, origin: L.origin }));
  const recipe = {
    _: 'Logo sheet: the brass sprocket emblem (ui:sprocket:0..7 for the hotbar end caps, logo:gear:0..7 for the title) and the title wordmark logo:word with an empty O slot (meta.oSlotCentre: draw logo:gear with its origin there). Written by art/logo/build.mjs, which draws every source by rule; frames are copied as is (place none, scale 1).',
    name: 'logo', kind: 'sprites', scale: 1, defaults: { place: 'none' }, meta: { oSlotCentre: word.slot },
    sprites: [
      ...frames('ui:sprocket:', 'src/ui_sprocket_#.png', layout['ui:sprocket:0..7']),
      ...frames('logo:gear:', 'src/logo_gear_#.png', layout['logo:gear:0..7']),
      { match: 'logo:word', file: 'src/logo_word.png', frame: [word.w, word.h], origin: [0, 0] },
    ],
  };
  const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + recipe.sprites.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n ]');
  fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');
}

// ---- previews ----
const gearImgs = { small: gears.small.map(toImage), large: gears.large.map(toImage) };
{
  // frames.png: rows = gear x background; each row: 8 frames at x1, then 8 frames at x4
  const bgs = [['bark', '#45293f'], ['walnut', '#4c3e24'], ['grass', '#239063']];
  const cell1 = 34, cell4 = 34 * 4;
  const rows = [];
  for (const key of ['small', 'large']) for (const bg of bgs) rows.push([key, bg]);
  const W = 8 * cell1 + 8 * cell4 + 24, H = rows.length * (cell4 + 8) + 8;
  const out = blank(W, H, PX.ink);
  rows.forEach(([key, [, col]], r) => {
    const y0 = 8 + r * (cell4 + 8);
    fillRect(out, 8, y0, W - 16, cell4, col);
    gearImgs[key].forEach((im, f) => {
      draw(out, im, 8 + f * cell1 + (cell1 - im.w) / 2 | 0, y0 + 4);
      draw(out, im, 16 + 8 * cell1 + f * cell4 + ((cell4 - im.w * 4) / 2 | 0), y0 + ((cell4 - im.h * 4) / 2 | 0), 4);
    });
  });
  save(path.join(OUT, 'frames.png'), out);
}
{
  const comp = blank(word.w, word.h);
  draw(comp, toImage(word), 0, 0);
  draw(comp, gearImgs.large[0], word.slot[0] - lc, word.slot[1] - lc);
  save(path.join(OUT, 'word-1x.png'), comp);
  const pad = 8, out = blank(word.w * 4 + pad * 2, word.h * 7 + pad * 4, '#239063');
  fillRect(out, 0, 0, out.w, word.h * 4 + pad * 2, '#45293f');
  draw(out, comp, pad, pad, 4);
  draw(out, comp, pad, word.h * 4 + pad * 3, 2);
  draw(out, comp, pad + word.w * 2 + pad * 2, word.h * 4 + pad * 3, 1);
  save(path.join(OUT, 'word.png'), out);
}
{
  // hotbar mock: the in-game shot with the procedural gears painted over (housing colour) and
  // ui:sprocket frames 0 and 3 drawn at x2 where drawHotbar puts the end caps
  const shot = path.join(ROOT, 'e2e/out/screens/first-morning.png');
  if (fs.existsSync(shot)) {
    const img = decodePNG(fs.readFileSync(shot));
    const ui = { w: img.w / 2, h: img.h / 2 };
    const S = 20, gap = 3, N = 12, capW = 16, hw = N * (S + gap) - gap + capW * 2 + 8;
    const hx = Math.floor((ui.w - hw) / 2), hy = ui.h - S - 17, by = hy - 5, gy = by + 18;
    const caps = [hx + capW / 2 + 3, hx + hw - capW / 2 - 3];
    const shotImg = { w: img.w, h: img.h, data: img.data };
    caps.forEach((cx, i) => {
      fillRect(shotImg, (cx - 9) * 2, (gy - 9) * 2, 36, 36, '#45293f');
      draw(shotImg, gearImgs.small[i ? 3 : 0], (cx - 8) * 2, (gy - 8) * 2, 2);
    });
    const x0 = (hx - 6) * 2, y0 = (by - 24) * 2, w = (hw + 12) * 2, h = img.h - y0;
    const crop = blank(w, h);
    for (let y = 0; y < h; y++) crop.data.set(shotImg.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4);
    save(path.join(OUT, 'hotbar-mock.png'), crop);
    // close-up of the left cap, x4 of the screen (x8 art)
    const cu = blank(56 * 4, 48 * 4);
    const cx0 = (caps[0] - 14) * 2, cy0 = (gy - 12) * 2;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 56; x++) {
      const s = ((cy0 + y) * img.w + cx0 + x) * 4;
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) cu.data.set(shotImg.data.subarray(s, s + 4), ((y * 4 + yy) * cu.w + x * 4 + xx) * 4);
    }
    save(path.join(OUT, 'hotbar-closeup.png'), cu);
  }
}
console.log('previews: e2e/out/logo/frames.png, word.png, word-1x.png, hotbar-mock.png, hotbar-closeup.png');
