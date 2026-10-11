// The square's twelve lamps: town:lamp:<state 0 bare post, 1 hung but dark, 2 lit>, 16 x 44,
// anchored at (0, 28) (the post stands on the tile's bottom-center).
//
// The lantern is PixelLab batch d3a36762 slot 8 (art/town/raw/b32/8.png): a hexagonal lantern
// under a verdigris hood. Its 31 px lamp is lengthened to the town lamp's 44 px with the shaft it
// already has, given the procedural lamp's lamplighter's crossbar and brass collar and a stepped
// plinth; the finial goes brass. Dark and bare are edits of the same lamp, so the three states
// only differ where they should.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INK = '#2e222f';
const POST = { s: '#313638', d: '#374e4a', m: '#547e64', l: '#92a984' };
const BRASS = { d: '#9e4539', m: '#cd683d', b: '#f79617', l: '#f9c22b', h: '#fbff86' };
const GLASS_DARK = { '#fbff86': '#323353', '#fbb954': '#484a77', '#e6904e': '#4d65b4', '#cd683d': '#484a77' };

let lanternCache = null;
function lantern() {
  if (lanternCache) return lanternCache.clone();
  const im = Img.load(path.join(HERE, '..', 'raw', 'b32', '8.png')).snap().trim();
  // the finial and the hood's top: brass instead of taupe
  im.recolor({ '#ab947a': BRASS.l, '#966c6c': BRASS.b, '#6e2727': BRASS.d });
  lanternCache = im.crop(0, 0, im.w, 16);
  return lanternCache.clone();
}

/** town:lamp:<state> */
export function drawLamp(state) {
  const im = new Img(16, 44);
  const L = lantern();
  const lx = 2; // 12 px lantern centered in 16
  // ---- the shaft (x 6..9): outline, dark side, lit stripe, body, outline ----
  for (let y = 16; y < 39; y++) {
    im.set(6, y, INK); im.set(7, y, y > 19 && y < 36 ? POST.m : POST.d); im.set(8, y, POST.d); im.set(9, y, INK);
  }
  // the lamplighter's crossbar under the lantern, with knobs
  im.rect(3, 18, 10, 1, POST.d); im.rect(3, 17, 10, 1, INK); im.rect(3, 19, 10, 1, INK);
  im.set(2, 18, INK); im.set(13, 18, INK);
  im.set(3, 17, POST.m); im.set(12, 17, POST.m);
  im.rect(4, 18, 2, 1, POST.m);
  // the brass collar halfway down
  im.rect(6, 27, 4, 1, BRASS.b); im.set(6, 27, BRASS.l); im.set(9, 27, BRASS.d);
  im.rect(5, 26, 6, 1, INK); im.rect(5, 28, 6, 1, INK); im.set(5, 27, INK); im.set(10, 27, INK);
  // ---- the stepped plinth ----
  im.rect(5, 38, 6, 2, POST.d); im.rect(5, 38, 6, 1, POST.m);
  im.rect(4, 40, 8, 3, POST.d); im.rect(4, 40, 8, 1, POST.l); im.rect(10, 41, 1, 2, POST.s); im.rect(4, 42, 8, 1, POST.s);
  im.rect(4, 37, 8, 1, INK); im.set(4, 38, INK); im.set(4, 39, INK); im.set(11, 38, INK); im.set(11, 39, INK);
  im.rect(3, 39, 1, 4, INK); im.rect(12, 39, 1, 4, INK); im.rect(3, 39, 10, 1, INK); im.rect(4, 43, 8, 1, INK);
  im.rect(5, 38, 6, 2, POST.d); im.rect(5, 38, 6, 1, POST.m); im.rect(4, 40, 8, 1, POST.l);
  if (state === 0) {
    // an empty bracket waiting for its lantern: a cup with two prongs
    im.rect(5, 13, 6, 1, INK); im.rect(4, 14, 8, 1, INK); im.rect(5, 14, 6, 1, BRASS.b); im.set(5, 14, BRASS.l);
    im.rect(5, 15, 6, 1, INK); im.rect(6, 15, 4, 1, POST.d);
    im.set(5, 12, INK); im.set(10, 12, INK); im.set(5, 11, POST.m); im.set(10, 11, POST.d); im.set(5, 10, INK); im.set(10, 10, INK);
    im.set(4, 11, INK); im.set(11, 11, INK); im.set(6, 12, INK); im.set(9, 12, INK); im.set(6, 11, INK); im.set(9, 11, INK);
    return im;
  }
  if (state === 1) for (let y = 8; y < 15; y++) for (let x = 0; x < L.w; x++) { const c = L.get(x, y); if (c && GLASS_DARK[c]) L.set(x, y, GLASS_DARK[c]); }
  im.blit(L, lx, 0);
  if (state === 1) im.set(lx + 3, 9, '#8fd3ff');
  return im;
}

if (process.argv[1] && process.argv[1].endsWith('lamp.mjs')) {
  const { lineup } = await import('./px.mjs');
  const frames = [drawLamp(0), drawLamp(1), drawLamp(2), Img.load('art/town/baked/town_lamp_0.png'), Img.load('art/town/baked/town_lamp_1.png'), Img.load('art/town/baked/town_lamp_2.png')];
  lineup(frames, { k: 8, gap: 3, bg: '#ab947a' }).save(process.argv[2] ?? 'e2e/out/town-lamp-draft.png');
  console.log(frames.map((f) => f.offPalette()).join(','));
}
