// Mood portraits from one neutral bust. PixelLab's edit_image redraws the whole bust with the new
// expression and drifts details and colors a little everywhere, which would make the dialogue blink
// (mood 1 shown for a tenth of a second every few seconds) flicker the hair and clothes. So a mood
// image is the snapped neutral bust with only the face zone taken from the snapped edit:
//   zone      [x0, y0, x1, y1] the face (brows to chin), per portrait or the default
//   map       { mood: { "#from": "#to" } } palette fixes applied to the edit first (skin-tone drift)
//   baseMap   { "#from": "#to" } palette fix applied to the neutral bust inside the zone (a noisy face)
//   recolor   [{ region: [x0, y0, x1, y1], map: { "#from": "#to" } }] applied to every mood's output
//             (a garment recolor that must match the walking sheet)
// Output: moods/<id>-<mood>.png (mood 0 is the snapped neutral bust).
//
// Usage: node art/portraits/moods.mjs   (then node scripts/sprites-import.mjs art/portraits/sprites.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { loadArt, hex } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SET = JSON.parse(fs.readFileSync(path.join(HERE, 'moods.json'), 'utf8'));
fs.mkdirSync(path.join(HERE, 'moods'), { recursive: true });
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const recolor = (img, rules) => {
  for (const { region: [x0, y0, x1, y1], map } of rules ?? []) {
    const m = Object.fromEntries(Object.entries(map).map(([a, b]) => [a.toLowerCase(), rgb(b.toLowerCase())]));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = (y * img.w + x) * 4;
        const to = img.data[i + 3] && m[hex(img.data[i], img.data[i + 1], img.data[i + 2])];
        if (to) img.data.set(to, i);
      }
  }
  return img;
};
const save = (img, f) => fs.writeFileSync(path.join(HERE, 'moods', f), encodePNG(img.w, img.h, img.data));

let n = 0;
for (const [id, p] of Object.entries(SET.portraits)) {
  const base = loadArt(path.join(HERE, p.base), 'auto').img;
  if (p.baseMap) {
    const bm = Object.fromEntries(Object.entries(p.baseMap).map(([a, b]) => [a.toLowerCase(), rgb(b.toLowerCase())]));
    const [x0, y0, x1, y1] = p.zone ?? SET.zone;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = (y * base.w + x) * 4;
        const to = base.data[i + 3] && bm[hex(base.data[i], base.data[i + 1], base.data[i + 2])];
        if (to) base.data.set(to, i);
      }
  }
  save(recolor({ w: base.w, h: base.h, data: Uint8Array.from(base.data) }, p.recolor), `${id}-0.png`);
  n++;
  for (const [mood, file] of Object.entries(p.moods ?? {})) {
    const edit = loadArt(path.join(HERE, file), 'auto').img;
    const map = Object.fromEntries(Object.entries(p.map?.[mood] ?? {}).map(([a, b]) => [a.toLowerCase(), b.toLowerCase()]));
    const [x0, y0, x1, y1] = p.zone ?? SET.zone;
    const out = { w: base.w, h: base.h, data: Uint8Array.from(base.data) };
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = (y * out.w + x) * 4;
        if (!edit.data[i + 3]) { out.data.fill(0, i, i + 4); continue; }
        const h = hex(edit.data[i], edit.data[i + 1], edit.data[i + 2]);
        out.data.set([...rgb(map[h] ?? h), 255], i);
      }
    save(recolor(out, p.recolor), `${id}-${mood}.png`);
    n++;
  }
}
console.log(`moods: ${n} portraits -> art/portraits/moods/`);
