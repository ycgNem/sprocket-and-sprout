// Farmhouse furniture: hf:<name>:<variant>:<season>. Drawn live, y-sorted, bottom-anchored.
import { C, DARK, LIGHT } from '../../data/palette';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily } from '../atlas';
import { PixBuf } from './pixbuf';

type Furn = { w: number; h: number; ox: number; oy: number; pb: PixBuf };

const SEASON_FLOWERS = [[C.rose, C.butter], [C.amber, C.cream], [C.terracotta, C.apricot], [C.frost, C.rose]];

function bed(v: number): Furn {
  // head 8px above the head tile, two tiles long
  const pb = new PixBuf(16, 40);
  pb.rect(1, 0, 14, 10, C.walnut);
  pb.rect(2, 1, 12, 2, C.oak);
  pb.rect(1, 0, 2, 12, C.bark); pb.rect(13, 0, 2, 12, C.bark);
  // mattress + pillow
  pb.rect(2, 9, 12, 28, C.cream);
  pb.rect(3, 10, 10, 6, C.frost);
  pb.rect(3, 10, 10, 1, C.cream);
  // patchwork quilt
  const quilt = v ? [C.lavender, C.violet, C.sky] : [C.rose, C.blush, C.apricot];
  for (let y = 17; y < 37; y++)
    for (let x = 2; x < 14; x++) {
      const px = Math.floor((x - 2) / 4), py = Math.floor((y - 17) / 4);
      let c = quilt[(px + py * 2) % 3];
      if ((x - 2) % 4 === 0 || (y - 17) % 4 === 0) c = C.cream;
      pb.set(x, y, c);
    }
  pb.rect(2, 17, 12, 1, LIGHT[quilt[0]] ?? C.cream);
  // quilt drapes over the sides
  for (let y = 18; y < 37; y++) { pb.set(1, y, DARK[quilt[0]]); pb.set(14, y, DARK[quilt[0]]); }
  // foot board
  pb.rect(1, 36, 14, 3, C.walnut);
  pb.rect(1, 36, 14, 1, C.oak);
  pb.outline(C.ink);
  return { w: 16, h: 40, ox: 0, oy: 8, pb };
}

function dresser(): Furn {
  const pb = new PixBuf(16, 26);
  pb.rect(1, 8, 14, 17, C.oak);
  pb.rect(1, 8, 14, 2, C.tan);
  for (let i = 0; i < 3; i++) {
    pb.rect(2, 11 + i * 4, 12, 3, C.walnut);
    pb.rect(2, 11 + i * 4, 12, 1, C.oak);
    pb.set(7, 12 + i * 4, C.brass); pb.set(8, 12 + i * 4, C.brass);
  }
  pb.rect(2, 24, 2, 2, C.bark); pb.rect(12, 24, 2, 2, C.bark);
  // a little lamp and a framed photo on top
  pb.rect(3, 4, 4, 3, C.butter); pb.rect(4, 7, 2, 1, C.brass); pb.rect(3, 4, 4, 1, C.cream);
  pb.rect(9, 3, 5, 5, C.walnut); pb.rect(10, 4, 3, 3, C.sky); pb.set(11, 5, C.leaf);
  pb.outline(C.ink);
  return { w: 16, h: 26, ox: 0, oy: 10, pb };
}

function fireplace(): Furn {
  // a two-tile stone hearth with a chimney breast up the wall
  const pb = new PixBuf(32, 34);
  for (let y = 0; y < 34; y++)
    for (let x = 4; x < 28; x++) {
      const row = Math.floor(y / 3), off = row % 2 ? 2 : 0;
      const mortar = y % 3 === 2 || (x + off) % 5 === 0;
      pb.set(x, y, mortar ? C.slate : hash2(Math.floor((x + off) / 5), row, 3) < 0.35 ? C.pebble : C.stone);
    }
  // mantel
  pb.rect(1, 12, 30, 3, C.walnut);
  pb.rect(1, 12, 30, 1, C.oak);
  // candles + a jar on the mantel
  pb.rect(5, 9, 2, 3, C.cream); pb.set(5, 8, C.butter);
  pb.rect(24, 9, 2, 3, C.cream); pb.set(25, 8, C.butter);
  pb.rect(14, 8, 4, 4, C.copper); pb.rect(14, 8, 4, 1, C.brass);
  // firebox
  pb.rect(8, 18, 16, 14, C.ink);
  pb.rect(9, 19, 14, 1, C.plum);
  pb.rect(7, 17, 18, 1, C.brick);
  // logs
  pb.rect(10, 28, 12, 2, C.bark); pb.rect(11, 27, 4, 1, C.walnut); pb.rect(17, 27, 4, 1, C.walnut);
  // hearth stones
  pb.rect(4, 32, 24, 2, C.brick);
  pb.rect(4, 32, 24, 1, C.terracotta);
  pb.outline(C.ink);
  return { w: 32, h: 34, ox: 0, oy: 18, pb };
}

function stove(v: number): Furn {
  const pb = new PixBuf(16, 26);
  const body = v ? C.wine : C.slate;
  pb.rect(1, 9, 14, 15, body);
  pb.rect(1, 8, 14, 3, C.ink);
  pb.rect(2, 8, 4, 1, DARK[body] ?? C.ink); pb.rect(9, 8, 4, 1, DARK[body] ?? C.ink);
  // oven door with a little window
  pb.rect(3, 13, 10, 8, DARK[body] ?? C.ink);
  pb.rect(5, 15, 6, 3, v ? C.amber : C.plum);
  pb.rect(4, 12, 8, 1, v ? C.brass : C.pebble);
  pb.rect(2, 24, 2, 2, C.ink); pb.rect(12, 24, 2, 2, C.ink);
  // stovepipe up the wall
  pb.rect(11, 0, 3, 8, C.slate); pb.rect(11, 0, 1, 8, C.stone);
  // kettle (and a pot once the kitchen is fitted)
  pb.ellipse(5, 6, 3, 2, C.copper); pb.rect(4, 3, 3, 1, C.brass); pb.set(8, 5, C.copper);
  if (v) { pb.rect(8, 5, 4, 3, C.stone); pb.rect(8, 5, 4, 1, C.pebble); }
  pb.outline(C.ink);
  return { w: 16, h: 26, ox: 0, oy: 10, pb };
}

function shelf(v: number): Furn {
  const pb = new PixBuf(16, 30);
  pb.rect(1, 0, 14, 30, C.walnut);
  pb.rect(2, 1, 12, 28, C.bark);
  const books = [C.rose, C.river, C.leaf, C.butter, C.violet, C.terracotta, C.aqua, C.wine];
  for (let s = 0; s < 3; s++) {
    const y0 = 2 + s * 9;
    pb.rect(1, y0 + 7, 14, 2, C.oak);
    if (v === 0 || s === 0) {
      let x = 2;
      while (x < 14) {
        const w = 1 + Math.floor(hash2(x, s, v + 4) * 2);
        const h = 5 + Math.floor(hash2(s, x, 7) * 3);
        pb.rect(x, y0 + 7 - h, w, h, books[Math.floor(hash2(x * 3, s, 9) * books.length)]);
        x += w + (hash2(x, s, 11) < 0.15 ? 1 : 0);
      }
    } else if (s === 1) {
      // jars of jam and pickles
      for (let i = 0; i < 3; i++) {
        const c = [C.wine, C.lime, C.amber][i];
        pb.rect(3 + i * 4, y0 + 2, 3, 5, c); pb.rect(3 + i * 4, y0 + 1, 3, 1, C.cream);
      }
    } else {
      // plates
      pb.disc(5, y0 + 4, 2.5, C.cream); pb.disc(10, y0 + 4, 2.5, C.frost); pb.set(5, y0 + 4, C.sky); pb.set(10, y0 + 4, C.sky);
    }
  }
  pb.outline(C.ink);
  return { w: 16, h: 30, ox: 0, oy: 14, pb };
}

function table(season: number): Furn {
  const pb = new PixBuf(16, 22);
  pb.rect(0, 8, 16, 8, C.cream);
  for (let x = 0; x < 16; x += 2) pb.set(x, 15, C.blush);
  for (let x = 1; x < 16; x += 4) for (let y = 8; y < 15; y += 4) pb.set(x, y + 1, C.blush);
  pb.rect(0, 16, 16, 2, C.walnut);
  pb.rect(1, 18, 2, 4, C.bark); pb.rect(13, 18, 2, 4, C.bark);
  // vase of seasonal flowers
  const [a, b] = SEASON_FLOWERS[season];
  pb.rect(7, 6, 3, 4, C.river); pb.rect(7, 6, 3, 1, C.sky);
  pb.set(8, 5, C.leaf); pb.set(6, 4, C.leaf); pb.set(10, 4, C.leaf);
  pb.disc(6, 3, 1.3, a); pb.disc(10, 3, 1.3, b); pb.disc(8, 1.8, 1.3, a);
  pb.outline(C.ink);
  return { w: 16, h: 22, ox: 0, oy: 6, pb };
}

function chair(): Furn {
  const pb = new PixBuf(16, 20);
  pb.rect(3, 2, 2, 12, C.walnut);
  pb.rect(3, 2, 2, 1, C.oak);
  pb.rect(4, 4, 1, 6, C.bark);
  pb.rect(3, 10, 10, 3, C.oak);
  pb.rect(3, 10, 10, 1, C.tan);
  pb.rect(4, 11, 7, 1, C.rose);
  pb.rect(3, 13, 2, 6, C.walnut); pb.rect(11, 13, 2, 6, C.walnut);
  pb.outline(C.ink);
  return { w: 16, h: 20, ox: 0, oy: 4, pb };
}

function almanac(): Furn {
  const pb = new PixBuf(16, 22);
  // lectern
  pb.rect(6, 11, 4, 9, C.walnut);
  pb.rect(4, 20, 8, 2, C.bark);
  pb.rect(1, 7, 14, 5, C.oak);
  pb.rect(1, 7, 14, 1, C.tan);
  // open book
  pb.rect(2, 3, 6, 6, C.cream); pb.rect(8, 3, 6, 6, C.cream);
  pb.rect(7, 3, 2, 6, C.tan);
  for (let y = 4; y < 8; y++) { pb.rect(3, y, 3 + (y % 2), 1, y === 4 ? C.rose : C.pebble); pb.rect(9, y, 4 - (y % 2), 1, C.pebble); }
  pb.rect(12, 8, 1, 4, C.rose); // ribbon
  pb.outline(C.ink);
  return { w: 16, h: 22, ox: 0, oy: 6, pb };
}

function plant(v: number): Furn {
  const pb = new PixBuf(16, 26);
  pb.rect(4, 18, 8, 7, C.terracotta);
  pb.rect(3, 17, 10, 2, C.brick);
  pb.rect(5, 19, 1, 5, C.apricot);
  if (v === 0) {
    // fiddle-leaf fig
    pb.rect(7, 6, 2, 12, C.bark);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      pb.ellipse(8 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 2.6, 2, i % 2 ? C.leaf : C.grass);
    }
    pb.ellipse(8, 3, 2.5, 2, C.lime);
  } else {
    // fern fronds
    for (let i = 0; i < 6; i++) {
      const dx = (i - 2.5) * 1.6;
      pb.line(8, 17, Math.round(8 + dx * 2.5), Math.round(6 + Math.abs(dx) * 1.8), i % 2 ? C.leaf : C.moss);
      pb.line(8, 17, Math.round(8 + dx * 2.2), Math.round(7 + Math.abs(dx) * 1.8), C.grass);
    }
  }
  pb.outline(C.ink);
  return { w: 16, h: 26, ox: 0, oy: 10, pb };
}

function windowArt(night: number, season: number): Furn {
  const pb = new PixBuf(16, 14);
  pb.rect(1, 1, 14, 12, C.oak);
  const sky = night ? C.deepsea : season === 3 ? C.frost : C.sky;
  pb.rect(2, 2, 12, 10, sky);
  if (night) { pb.set(4, 4, C.cream); pb.set(10, 3, C.butter); pb.set(12, 7, C.cream); pb.disc(6, 8, 1.4, C.cream); }
  else {
    pb.rect(2, 9, 12, 3, season === 2 ? C.amber : season === 3 ? C.cream : C.leaf);
    pb.rect(4, 4, 3, 1, C.cream); pb.rect(3, 5, 5, 1, C.cream);
  }
  pb.rect(7, 2, 2, 10, C.oak); pb.rect(2, 6, 12, 1, C.oak);
  // curtains
  pb.rect(0, 0, 16, 2, C.wine);
  pb.rect(0, 2, 3, 11, C.rose); pb.rect(13, 2, 3, 11, C.rose);
  pb.rect(1, 3, 1, 9, C.blush); pb.rect(14, 3, 1, 9, C.blush);
  pb.rect(1, 13, 14, 1, C.tan);
  pb.outline(C.ink);
  return { w: 16, h: 14, ox: 0, oy: 8, pb };
}

function clockArt(): Furn {
  const pb = new PixBuf(16, 16);
  pb.rect(4, 1, 8, 14, C.walnut);
  pb.rect(5, 2, 6, 1, C.oak);
  pb.disc(8, 6, 3.4, C.cream);
  pb.rect(6, 10, 4, 4, C.bark);
  pb.outline(C.ink);
  return { w: 16, h: 16, ox: 0, oy: 9, pb };
}

function rug(): Furn {
  const pb = new PixBuf(48, 48);
  pb.ellipse(24, 24, 22, 20, C.wine);
  pb.ellipse(24, 24, 19, 17, C.terracotta);
  pb.ellipse(24, 24, 15, 13, C.apricot);
  pb.ellipse(24, 24, 11, 9, C.terracotta);
  pb.ellipse(24, 24, 6, 5, C.butter);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pb.set(Math.round(24 + Math.cos(a) * 17), Math.round(24 + Math.sin(a) * 15), C.cream);
  }
  return { w: 48, h: 48, ox: 0, oy: 0, pb };
}

function doormat(): Furn {
  const pb = new PixBuf(16, 16);
  pb.rect(1, 4, 14, 9, C.tan);
  for (let y = 5; y < 12; y++) for (let x = 2; x < 14; x++) if ((x + y) % 3 === 0) pb.set(x, y, C.oak);
  pb.rect(3, 7, 10, 3, C.walnut);
  pb.rect(4, 8, 2, 1, C.cream); pb.rect(7, 8, 2, 1, C.cream); pb.rect(10, 8, 2, 1, C.cream);
  return { w: 16, h: 16, ox: 0, oy: 0, pb };
}

export function registerHomeSprites() {
  defSpriteFamily('hf:', (name) => {
    const [, kind, vs, ss] = name.split(':');
    const v = +vs || 0, season = +ss || 0;
    let f: Furn | null = null;
    switch (kind) {
      case 'bed': f = bed(v); break;
      case 'dresser': f = dresser(); break;
      case 'fireplace': f = fireplace(); break;
      case 'stove': f = stove(v); break;
      case 'shelf': f = shelf(v); break;
      case 'table': f = table(season); break;
      case 'chair': f = chair(); break;
      case 'almanac': f = almanac(); break;
      case 'plant': f = plant(v); break;
      case 'window': f = windowArt(v, season); break;
      case 'clock': f = clockArt(); break;
      case 'rug': f = rug(); break;
      case 'doormat': f = doormat(); break;
    }
    if (!f) return null;
    const pb = f.pb;
    return { w: f.w, h: f.h, ox: f.ox, oy: f.oy, draw: (ctx) => pb.drawTo(ctx) };
  });
}
