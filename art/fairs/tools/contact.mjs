// Contact sheet of Phase 6 round 2's new sprites, cut from the imported sheets (src/art/ruins.*,
// fairs.*, fieldworks.*): each group at 1x on the left and 3x on the right, on the plaza's cobbles
// (#ab947a) and grass. Rows: the wrecks o:56:<v>:<season> (v down, season across); the Haul stalls
// haul:stall:<k>:<f> and the podium; the Fair plate and banner; the gantry bridges' wheel frames.
// Usage: node art/fairs/tools/contact.mjs -> e2e/out/round2-contact.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from '../../factory/gen/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sheets = {};
function frame(sheet, name) {
  const s = (sheets[sheet] ??= { im: Img.load(path.join(ROOT, 'src/art', sheet + '.png')), m: JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art', sheet + '.json'), 'utf8')) });
  const e = s.m.sprites.find((q) => q.match === name);
  if (!e) throw new Error(`${sheet}: no ${name}`);
  return s.im.crop(...e.r);
}
const scale = (im, k) => { const o = new Img(im.w * k, im.h * k); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = im.px[Math.floor(y / k) * im.w + Math.floor(x / k)]; return o; };

const groups = [
  { bg: '#ab947a', items: [0, 1, 2, 3].flatMap((v) => [0, 1, 2, 3].map((s) => frame('ruins', `o:56:${v}:${s}`))), cols: 4 },
  { bg: '#ab947a', items: [...[0, 1, 2, 3].flatMap((k) => [0, 1].map((f) => frame('fairs', `haul:stall:${k}:${f}`))), frame('fairs', 'haul:podium:0'), frame('fairs', 'haul:podium:1')], cols: 10 },
  { bg: '#ab947a', items: [frame('fairs', 'fair:plate'), frame('fairs', 'fair:banner:0'), frame('fairs', 'fair:banner:1')], cols: 3 },
  { bg: '#239063', items: [0, 1, 2, 3].map((f) => frame('fieldworks', `gantry:beam:0:${f}`)), cols: 1 },
  { bg: '#239063', items: [0, 1, 2, 3].map((f) => frame('fieldworks', `gantry:beam:1:${f}`)), cols: 4 },
];
const PAD = 6;
/** lay a group out in a grid at scale k: returns an Img */
function grid(g, k) {
  const cw = Math.max(...g.items.map((i) => i.w)) * k + PAD, ch = Math.max(...g.items.map((i) => i.h)) * k + PAD;
  const rows = Math.ceil(g.items.length / g.cols);
  const o = new Img(g.cols * cw + PAD, rows * ch + PAD);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, g.bg);
  g.items.forEach((im, i) => o.draw(scale(im, k), PAD + (i % g.cols) * cw, PAD + Math.floor(i / g.cols) * ch));
  return o;
}
const blocks = groups.map((g) => [grid(g, 1), grid(g, 3)]);
const W = Math.max(...blocks.map(([a, b]) => a.w + b.w + 3 * PAD)), H = blocks.reduce((h, [a, b]) => h + Math.max(a.h, b.h) + PAD, PAD);
const out = new Img(W, H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.set(x, y, '#2e222f');
let y = PAD;
for (const [a, b] of blocks) { out.draw(a, PAD, y); out.draw(b, a.w + 2 * PAD, y); y += Math.max(a.h, b.h) + PAD; }
out.save(path.join(ROOT, 'e2e/out/round2-contact.png'));
console.log(`e2e/out/round2-contact.png ${W}x${H}`);
