// The tram's cart: town:cart:<h side | v end>:<loaded 0/1>:<frame 0/1>, anchored at its wheels'
// ground line (bottom-center). Frames: h 24 x 23 (12, 22), v 16 x 22 (8, 21): taller than the
// procedural 24 x 18 / 16 x 18 so the heap of ore fits above the rim; the anchor stays the
// wheels' ground line, so the renderer needs no change.
//
// Bodies: PixelLab batch 44b7f08c slots 40 (long side) and 48 (end), generated from the same
// description so they match. The heap is scripted to sit in each opening (copper ore, taupe stone,
// a little iron; nuggets lit top-left). Frame 1 moves each wheel's brass glint a pixel round.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INK = '#2e222f';
const ORE = [
  ['#ea4f36', '#f57d4a', '#b33831'], // copper ore: base, lit, shade
  ['#966c6c', '#ab947a', '#625565'], // stone
  ['#f57d4a', '#fca790', '#ea4f36'],
  ['#b33831', '#ea4f36', '#6e2727'],
  ['#7f708a', '#9babb2', '#625565'], // a little iron
];

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const body = (slot) => Img.load(path.join(HERE, '..', 'raw', 'b24', slot + '.png')).snap().trim();

/** a heap of ore over the opening x0..x1, its base on row y0 (the rim's top row), up to `peak` px high */
function heap(im, x0, x1, y0, peak, seed) {
  const w = x1 - x0 + 1;
  const top = [];
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0 + 0.5) / w;
    top.push(Math.round(Math.sin(t * Math.PI) * peak + (hash(x, 1, seed) - 0.5) * 1.2));
  }
  for (let x = x0; x <= x1; x++) {
    const h = top[x - x0];
    for (let y = y0 - h; y <= y0 + 1; y++) {
      // 2 x 2 nuggets on a staggered grid
      const gx = Math.floor((x - x0 + (Math.floor((y - y0) / 2) % 2)) / 2), gy = Math.floor((y - y0 + 8) / 2);
      const n = ORE[Math.floor(hash(gx, gy, seed + 3) * (hash(gx, gy, seed + 4) < 0.15 ? 5 : 4))];
      const lx = (x - x0 + (Math.floor((y - y0) / 2) % 2)) % 2, ly = (y - y0 + 8) % 2;
      im.set(x, y, lx === 0 && ly === 0 ? n[1] : lx === 1 && ly === 1 ? n[2] : n[0]);
    }
    // the outline over the heap
    im.set(x, y0 - h - 1, INK);
  }
  // close the heap's ends against the rim
  im.set(x0 - 1, y0 - top[0], INK);
  im.set(x1 + 1, y0 - top[w - 1], INK);
}

/** town:cart:<view>:<loaded>:<frame> */
export function drawCart(view, loaded, f) {
  const side = view === 'h';
  const W = side ? 24 : 16, H = side ? 23 : 22;
  const src = body(side ? 40 : 48);
  const im = new Img(W, H);
  const dx = Math.floor((W - src.w) / 2), dy = H - src.h;
  im.blit(src, dx, dy);
  if (loaded) {
    if (side) heap(im, dx + 2, dx + 17, dy + 2, 4, 11);
    else heap(im, dx + 2, dx + 13, dy + 2, 4, 23);
  }
  if (f) {
    // the wheels turn: each brass glint moves a pixel round its hub
    if (side) {
      for (const [hx, hy] of [[5, 16], [14, 16]]) {
        const c = im.get(dx + hx, dy + hy);
        im.set(dx + hx, dy + hy, '#6e2727');
        im.set(dx + hx + 1, dy + hy + 1, c);
      }
    } else {
      for (const [hx, hy] of [[2, 15], [13, 15]]) im.set(dx + hx, dy + hy, '#9e4539');
      im.set(dx + 7, dy + 13, '#fbb954'); im.set(dx + 8, dy + 13, '#f9c22b');
    }
  }
  return im;
}

if (process.argv[1] && process.argv[1].endsWith('cart.mjs')) {
  const { lineup } = await import('./px.mjs');
  const frames = [];
  for (const v of ['h', 'v']) for (const l of [0, 1]) for (const f of [0, 1]) frames.push(drawCart(v, l, f));
  for (const n of ['town_cart_h_0_0', 'town_cart_h_1_0', 'town_cart_v_0_0', 'town_cart_v_1_0']) frames.push(Img.load('art/town/baked/' + n + '.png'));
  lineup(frames, { k: 6, gap: 3, bg: '#ab947a' }).save(process.argv[2] ?? 'e2e/out/town-cart-draft.png');
  console.log(frames.map((f) => f.offPalette()).join(','));
}
