// Megaproject frames: mega:<id>:<progress 0-8>:<frame 0-1> (64x112, origin [0,48]) and the empty
// Grand Works site (st:construction_site, 64x80, origin [0,16]).
// Progress 0-7: the finished monument revealed from the ground up, with the scaffolding standing
// behind it and rising a little above the built part. Progress 8: the monument; frame 1 is a
// small animation made from frame 0 (a recolor or a 1 px shift of one region), never new art.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, quantize, bbox, crop, blank, blit, rgbOf, dropStrays } from '../../../scripts/lib/pixel.mjs';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 64, H = 112, OY = 48;
const load = (f) => {
  const raw = decodePNG(fs.readFileSync(path.join(base, f)));
  const img = downscale(raw, detectScale(raw)).img;
  quantize(img);
  dropStrays(img);
  const b = bbox(img);
  return crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
};
const hexAt = (img, x, y) => { const p = (y * img.w + x) * 4; return img.data[p + 3] ? '#' + [0, 1, 2].map((k) => img.data[p + k].toString(16).padStart(2, '0')).join('') : null; };
const place = (dst, art, yBottom = dst.h - 1) => blit(dst, art, Math.floor((dst.w - art.w) / 2), yBottom - (art.h - 1));
const copy = (img) => ({ w: img.w, h: img.h, data: new Uint8Array(img.data) });

const MEGA = {
  m_beacon: { src: 'raw/mega/beacon1.png', frame1: { recolor: [[[10, 10, 30, 24], { '#f9c22b': '#fbff86', '#fbb954': '#f9c22b', '#0b5e65': '#0b8a8f', '#0b8a8f': '#30e1b9' }]] } },
  m_orrery: { src: 'raw/mega/orrery1.png', frame1: { recolor: [[[0, 0, 58, 16], { '#f79617': '#f9c22b', '#fbb954': '#fbff86', '#e6904e': '#fbb954' }]] } },
  m_skyship: { src: 'raw/mega/skyship1.png', frame1: { shift: [[0, 0, 64, 24], 0, -1] } },
};
const scaffold = load('raw/mega/scaffold1.png');
const outDir = path.join(base, 'out');
fs.mkdirSync(outDir, { recursive: true });
const entries = [];
const save = (name, img, match, origin) => {
  const file = `out/${name}.png`;
  fs.writeFileSync(path.join(base, file), encodePNG(img.w, img.h, img.data));
  for (const m of [].concat(match)) entries.push({ match: m, file, place: 'none', frame: [img.w, img.h], origin, keepStrays: true });
};

for (const [id, m] of Object.entries(MEGA)) {
  const art = load(m.src);
  for (let q = 0; q <= 8; q++) {
    const img = blank(W, H);
    if (q === 8) place(img, art);
    else {
      // built part: the bottom (q+1)/9 of the monument, at least its plinth
      const built = Math.max(12, Math.round(((q + 1) / 9) * art.h));
      const top = H - built; // first visible monument row in the frame
      const sc = crop(scaffold, 0, Math.max(0, scaffold.h - (built + 16)), scaffold.w, Math.min(scaffold.h, built + 16));
      place(img, sc);
      const part = crop(art, 0, art.h - built, art.w, built);
      place(img, part);
      void top;
    }
    const f0 = `mega_${id}_${q}`;
    if (q < 8) { save(f0, img, [`mega:${id}:${q}:0`, `mega:${id}:${q}:1`], [0, OY]); continue; }
    save(f0, img, `mega:${id}:8:0`, [0, OY]);
    // frame 1
    const f1 = copy(img);
    const x0 = Math.floor((W - art.w) / 2), y0 = H - art.h;
    for (const [[rx, ry, rw, rh], map] of m.frame1.recolor ?? []) for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
      const c = hexAt(f1, x + x0, y + y0);
      if (c && map[c]) f1.data.set([...rgbOf(map[c]), 255], ((y + y0) * W + x + x0) * 4);
    }
    if (m.frame1.shift) {
      const [[rx, ry, rw, rh], dx, dy] = m.frame1.shift;
      const reg = crop(img, rx + x0, ry + y0, rw, rh);
      for (let y = ry + y0; y < ry + y0 + rh; y++) for (let x = rx + x0; x < rx + x0 + rw; x++) if (x >= 0 && x < W) f1.data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
      blit(f1, reg, rx + x0 + dx, ry + y0 + dy);
      // what was under the region's old bottom row comes back from frame 0
      for (let x = 0; x < W; x++) { const y = ry + y0 + rh - 1; if (!f1.data[(y * W + x) * 4 + 3] && y + 1 < H) { const p = (y * W + x) * 4; f1.data.set(img.data.subarray(p, p + 4), p); } }
    }
    save(`${f0}_f1`, f1, `mega:${id}:8:1`, [0, OY]);
  }
}
// the Grand Works site before a project is chosen: the bottom of the scaffolding
const site = blank(64, 80);
place(site, crop(scaffold, 0, Math.max(0, scaffold.h - 78), scaffold.w, Math.min(scaffold.h, 78)));
save('construction_site', site, 'st:construction_site:**', [0, 16]);
fs.writeFileSync(path.join(outDir, 'mega.entries.json'), JSON.stringify(entries, null, 1));
console.log(`mega: ${entries.length} entries -> art/buildings/out/mega.entries.json`);
