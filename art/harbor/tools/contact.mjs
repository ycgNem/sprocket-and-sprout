// Contact sheet of the imported harbor sheet (src/art/harbor.png + .json): every frame at 1x and at
// 3x, labeled with its name, on the ground it stands on (sand for the warehouse, sea for the ship,
// pier planks for the cargo). The 3x copy marks the footprint (the origin's box) with corner ticks.
//
//   node art/harbor/tools/contact.mjs   -> e2e/out/harbor/contact.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art/harbor.json'), 'utf8'));
const sheet = Img.load(path.join(ROOT, 'src/art/harbor.png'), { unscale: false });

// 3x5 font for labels
const FONT = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111',
  f: '111100110100100', g: '011100101101011', h: '101101111101101', i: '111010010010111', k: '101101110101101',
  l: '100100100100111', n: '110101101101101', o: '010101101101010', p: '110101110100100', r: '110101110101101',
  s: '011100010001110', t: '111010010010010', u: '101101101101111', w: '101101101111101', x: '101101010101101',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001',
  5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  ':': '000010000010000', ' ': '000000000000000', ',': '000000000010100', '(': '001010010010001', ')': '100010010010100',
  'v': '000101101101010', 'm': '000111111101101', 'y': '101101011001110', '=': '000111000111000',
};
function text(img, x, y, s, c = '#2e222f', k = 1) {
  for (const ch of s.toLowerCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) img.set(x + i * k + xx, y + j * k + yy, c);
    x += 4 * k;
  }
}

const GROUND = (name) => (name.startsWith('harbor:ship') ? '#4d9be6' : name.startsWith('harbor:cargo') ? '#9e4539' : '#fbb954');
const entries = meta.sprites;
const K = 3, PAD = 8, LABEL = 14, MAXW = 1560;
// cells flow left to right: label, the frame at 1x, the frame at 3x under it
const cells = entries.map((e) => ({ e, w: e.r[2], h: e.r[3], cw: Math.max(e.r[2] * K, 4 * 2 * 34), ch: LABEL + e.r[3] + 4 + e.r[3] * K }));
let cx = PAD, cy = PAD, rowH = 0;
for (const c of cells) {
  if (cx + c.cw > MAXW) { cx = PAD; cy += rowH + PAD; rowH = 0; }
  c.x = cx; c.y = cy; cx += c.cw + PAD; rowH = Math.max(rowH, c.ch);
}
const W = MAXW + PAD, H = cy + rowH + PAD;
const out = new Img(W, H);
out.rect(0, 0, W, H, '#c7dcd0');
for (const { e, w, h, x, y } of cells) {
  const [sx, sy] = e.r, [ox, oy] = e.o;
  const bg = GROUND(e.match);
  text(out, x, y, e.match, '#2e222f', 2);
  text(out, x + 4 * 2 * (e.match.length + 1), y + 4, `${w}x${h} (${ox},${oy})`, '#625565', 1);
  let art = sheet.crop(sx, sy, w, h);
  if (e.flipX) art = new Img(w, h).blit(art, 0, 0, { flipX: true });
  const t1 = y + LABEL;
  out.rect(x, t1, w, h, bg);
  out.blit(art, x, t1);
  const t3 = t1 + h + 4;
  out.rect(x, t3, w * K, h * K, bg);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = art.get(i, j); if (c) out.rect(x + i * K, t3 + j * K, K, K, c); }
  // footprint corner ticks on the 3x copy: the box from (ox, oy) to the frame's bottom
  const fw = Math.round((w - ox) / 16) * 16, fh = h - oy;
  const fx0 = x + ox * K, fy0 = t3 + oy * K, fx1 = fx0 + fw * K - 1, fy1 = fy0 + fh * K - 1;
  for (const [px, py, dx, dy] of [[fx0, fy0, 1, 1], [fx1, fy0, -1, 1], [fx0, fy1, 1, -1], [fx1, fy1, -1, -1]]) {
    for (let t = 0; t < 8; t++) { out.set(px + dx * t, py, '#e83b3b'); out.set(px, py + dy * t, '#e83b3b'); }
  }
}
const file = path.join(ROOT, 'e2e/out/harbor/contact.png');
out.save(file);
console.log(`${entries.length} sprites -> ${path.relative(ROOT, file)} (${W}x${H})`);
