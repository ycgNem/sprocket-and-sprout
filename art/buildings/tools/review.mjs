// Review sheet: per building, summer day | summer night (recolor) | winter | fall, on a grass backdrop
// with the footprint outlined (1 px dots). Usage: review.mjs out.png [ids...] [--scale 2]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { rgbOf } from '../../../scripts/lib/pixel.mjs';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args[0]; const K = +(args[args.indexOf('--scale') + 1] || 2); const ids = args.slice(1).filter((a, i) => !a.startsWith('--') && args[i] !== '--scale');
const recipe = JSON.parse(fs.readFileSync(path.join(base, 'sprites.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(base, 'buildings.json'), 'utf8'));
const rows = [];
for (const [id, e] of Object.entries(cfg)) {
  if (id.startsWith('_') || (ids.length && !ids.includes(id))) continue;
  const pick = (re) => recipe.sprites.find((s) => re.test(s.match));
  const pre = e.kind === 'bld' ? `bld:${id}:` : e.kind === 'st' ? `st:${e.id ?? id}:[*]:[*]:` : 'cartw';
  const cells = [];
  if (e.states) for (const st of Object.keys(e.states)) cells.push(pick(new RegExp(`^${pre}(1|[*]):${st}$`)), pick(new RegExp(`^${pre}3:${st}$`)));
  else cells.push(pick(new RegExp(`^${pre}(1|[*])(:0)?$`)), pick(new RegExp(`^${pre}1:1$`)), pick(new RegExp(`^${pre}3(:0)?$`)), pick(new RegExp(`^${pre}2(:0)?$`)), pick(new RegExp(`^${pre}0(:0)?$`)));
  rows.push({ id, e, cells: cells.filter(Boolean) });
}
const load = (s) => { const img = decodePNG(fs.readFileSync(path.join(base, s.file))); if (s.recolor) { const m = Object.fromEntries(Object.entries(s.recolor).map(([a, b]) => [rgbOf(a).join(','), rgbOf(b)])); for (let i = 0; i < img.data.length; i += 4) { const k = `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`; if (img.data[i + 3] && m[k]) img.data.set(m[k], i); } } return img; };
const PAD = 6;
const cw = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.frame[0]))) + PAD * 2, ch = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.frame[1]))) + PAD * 2;
const cols = Math.max(...rows.map((r) => r.cells.length));
const W = cols * cw, H = rows.length * ch;
const img = new Uint8Array(W * K * H * K * 4);
const put = (x, y, r, g, b) => { for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) { const p = ((y * K + yy) * W * K + x * K + xx) * 4; img[p] = r; img[p + 1] = g; img[p + 2] = b; img[p + 3] = 255; } };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 0x23, 0x90, 0x63);
rows.forEach((r, ri) => r.cells.forEach((c, ci) => {
  const night = /:1(:[0-9*]+)?$/.test(c.match) && c.recolor;
  const s = load(c); const ox = ci * cw + PAD, oy = ri * ch + PAD + (ch - PAD * 2 - c.frame[1]);
  if (night) for (let y = 0; y < c.frame[1]; y++) for (let x = 0; x < c.frame[0]; x++) put(ox + x, oy + y, 0x16, 0x3a, 0x40);
  // footprint
  const fx = ox + c.origin[0], fy = oy + c.origin[1], fw = r.e.W, fh = r.e.H - r.e.oy;
  for (let x = 0; x < fw; x += 2) { put(fx + x, fy, 255, 255, 0); put(fx + x, fy + fh - 1, 255, 255, 0); }
  for (let y = 0; y < fh; y += 2) { put(fx, fy + y, 255, 255, 0); put(fx + fw - 1, fy + y, 255, 255, 0); }
  if (r.e.kind === 'bld') { const dx = fx + r.e.doorTile - 8; for (let x = 0; x < 16; x++) put(dx + x, fy + fh + 1, 255, 80, 80); }
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const p = (y * s.w + x) * 4; if (s.data[p + 3]) put(ox + x, oy + y, s.data[p], s.data[p + 1], s.data[p + 2]); }
}));
fs.writeFileSync(out, encodePNG(W * K, H * K, img));
console.log(out, rows.map((r) => r.id).join(' '));
