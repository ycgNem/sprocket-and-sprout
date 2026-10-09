// Zoomed review of built icons: node art/icons/tools/zoom.mjs <out.png> <id|prefix*> … [--scale 6] [--cols 10] [--bg #ab947a]
// Reads art/icons/src.png + sprites.json (run build.mjs first). Ids in the given order; `jam_*` expands.
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { blank, blit, crop, hex, rgbOf } from '../../../scripts/lib/pixel.mjs';
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const skip = new Set(['--scale', '--cols', '--bg'].flatMap((k) => { const i = args.indexOf(k); return i >= 0 ? [i, i + 1] : []; }));
const [out, ...pats] = args.filter((a, i) => !skip.has(i) && !a.startsWith('--'));
const K = +opt('--scale', 6), COLS = +opt('--cols', 10), BG = rgbOf(opt('--bg', '#ab947a'));
const R = JSON.parse(fs.readFileSync(path.join(HERE, 'sprites.json'), 'utf8'));
const raw = decodePNG(fs.readFileSync(path.join(HERE, 'src.png')));
const src = { w: raw.w, h: raw.h, data: new Uint8Array(raw.data) };
const by = new Map(R.sprites.map((e) => [e.match, e]));
const items = fs.readFileSync(path.join(HERE, 'items.tsv'), 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t')[0]);
const ids = pats.flatMap((p) => (p.endsWith('*') ? items.filter((i) => i.startsWith(p.slice(0, -1))) : [p]));
function frame(m) {
  const e = by.get(m);
  if (!e) return null;
  if (e.like) {
    const b = frame(e.like);
    if (!b) return null;
    const o = { ...b, data: new Uint8Array(b.data) };
    for (let i = 0; i < o.data.length; i += 4) {
      if (!o.data[i + 3]) continue;
      const to = e.recolor?.[hex(o.data[i], o.data[i + 1], o.data[i + 2])];
      if (to) o.data.set(rgbOf(to), i);
    }
    return o;
  }
  return crop(src, ...e.rect);
}
const cell = 18;
const sheet = blank(COLS * cell, Math.ceil(ids.length / COLS) * cell);
for (let i = 0; i < sheet.data.length; i += 4) {
  const x = (i / 4) % sheet.w, y = Math.floor(i / 4 / sheet.w);
  sheet.data.set(x % cell >= 1 && x % cell <= 16 && y % cell >= 1 && y % cell <= 16 ? [...BG, 255] : [46, 34, 47, 255], i);
}
ids.forEach((id, n) => { const f = frame('i:' + id); if (f) blit(sheet, f, (n % COLS) * cell + 1, Math.floor(n / COLS) * cell + 1); });
const big = blank(sheet.w * K, sheet.h * K);
for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) { const p = (Math.floor(y / K) * sheet.w + Math.floor(x / K)) * 4; big.data.set(sheet.data.subarray(p, p + 4), (y * big.w + x) * 4); }
fs.writeFileSync(out, encodePNG(big.w, big.h, big.data));
console.log(`${out}: ${ids.length} icons, ${COLS} per row`);
console.log(ids.map((id, n) => `${n}:${id}`).join(' '));
