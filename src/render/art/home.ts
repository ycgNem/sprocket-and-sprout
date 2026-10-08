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

// ---------- placeable furniture ----------
function armchair(v: number): Furn {
  const pb = new PixBuf(16, 20);
  const [a, b] = v ? [C.moss, C.pine] : [C.rose, C.wine];
  pb.rect(2, 2, 12, 9, a);
  pb.rect(3, 3, 10, 1, LIGHT[a] ?? a);
  pb.rect(1, 8, 3, 8, b); pb.rect(12, 8, 3, 8, b);
  pb.rect(1, 8, 3, 1, a); pb.rect(12, 8, 3, 1, a);
  pb.rect(4, 10, 8, 5, a);
  pb.rect(4, 10, 8, 1, LIGHT[a] ?? a);
  pb.rect(2, 16, 2, 3, C.walnut); pb.rect(12, 16, 2, 3, C.walnut);
  for (let x = 4; x < 12; x += 3) pb.set(x, 6, b);
  pb.outline(C.ink);
  return { w: 16, h: 20, ox: 0, oy: 4, pb };
}

function lamp(): Furn {
  const pb = new PixBuf(16, 28);
  pb.rect(4, 2, 8, 7, C.butter);
  pb.rect(3, 8, 10, 2, C.apricot);
  for (let x = 3; x < 13; x += 2) pb.set(x, 10, C.amber);
  pb.rect(5, 2, 6, 1, C.cream);
  pb.rect(7, 10, 2, 15, C.brass);
  pb.rect(4, 25, 8, 2, C.brass); pb.rect(5, 24, 6, 1, C.copper);
  pb.outline(C.ink);
  return { w: 16, h: 28, ox: 0, oy: 12, pb };
}

function rug2(v: number): Furn {
  const pb = new PixBuf(32, 32);
  if (v === 0) {
    for (let r = 14; r > 0; r -= 2) pb.ellipse(16, 16, r + 1, r, [C.deepsea, C.river, C.sky, C.frost][(r / 2) % 4]);
  } else {
    pb.rect(1, 3, 30, 26, C.moss);
    pb.rect(3, 5, 26, 22, C.grass);
    pb.rect(5, 7, 22, 18, C.leaf);
    for (let i = 0; i < 9; i++) {
      const x = 7 + (i % 3) * 8, y = 9 + Math.floor(i / 3) * 6;
      pb.disc(x + 1, y + 1, 1.5, [C.rose, C.butter, C.cream][i % 3]);
    }
    for (let x = 1; x < 31; x += 2) { pb.set(x, 2, C.cream); pb.set(x, 29, C.cream); }
  }
  return { w: 32, h: 32, ox: 0, oy: 0, pb };
}

function tank(): Furn {
  const pb = new PixBuf(32, 26);
  pb.rect(1, 18, 30, 7, C.walnut);
  pb.rect(1, 18, 30, 1, C.oak);
  pb.rect(3, 21, 4, 2, C.bark); pb.rect(25, 21, 4, 2, C.bark);
  pb.rect(2, 3, 28, 15, C.river);
  pb.rect(3, 4, 26, 13, C.aqua);
  pb.rect(3, 4, 26, 2, C.sky);
  pb.rect(3, 14, 26, 3, C.tan);
  pb.rect(6, 9, 1, 5, C.leaf); pb.rect(7, 7, 1, 7, C.grass); pb.rect(24, 8, 1, 6, C.leaf); pb.rect(25, 10, 1, 4, C.moss);
  pb.rect(2, 2, 28, 1, C.slate);
  pb.outline(C.ink);
  return { w: 32, h: 26, ox: 0, oy: 10, pb };
}

function petbed(): Furn {
  const pb = new PixBuf(16, 16);
  pb.ellipse(8, 11, 7, 4, C.wine);
  pb.ellipse(8, 10.5, 5, 2.6, C.blush);
  pb.rect(4, 10, 3, 1, C.cream);
  pb.outline(C.ink);
  return { w: 16, h: 16, ox: 0, oy: 0, pb };
}

function painting(v: number): Furn {
  const pb = new PixBuf(14, 12);
  pb.rect(0, 0, 14, 12, C.brass);
  pb.rect(1, 1, 12, 10, C.copper);
  if (v === 0) {
    pb.rect(2, 2, 10, 4, C.butter); pb.rect(2, 2, 10, 1, C.apricot);
    pb.rect(2, 6, 10, 4, C.grass); pb.rect(2, 6, 10, 1, C.leaf);
    pb.disc(9, 4, 1.4, C.cream); pb.set(4, 8, C.rose); pb.set(7, 7, C.cream);
  } else if (v === 1) {
    pb.rect(2, 2, 10, 4, C.slate); pb.rect(2, 6, 10, 4, C.deepsea);
    pb.line(2, 7, 6, 5, C.frost); pb.line(6, 5, 11, 8, C.river); pb.set(9, 3, C.butter);
  } else {
    pb.rect(2, 2, 10, 8, C.violet); pb.rect(2, 7, 10, 3, C.plum);
    pb.rect(6, 3, 3, 7, C.stone); pb.rect(6, 3, 3, 1, C.pebble); pb.set(7, 5, C.cream);
    pb.set(3, 3, C.butter); pb.set(11, 4, C.butter);
  }
  pb.outline(C.ink);
  return { w: 14, h: 12, ox: -1, oy: 9, pb };
}

function trophy(v: number): Furn {
  const pb = new PixBuf(16, 12);
  // wooden plaque with a mounted fish
  pb.rect(1, 1, 14, 10, C.walnut);
  pb.rect(2, 2, 12, 8, C.oak);
  const [a, b] = [[C.butter, C.amber], [C.slate, C.brass], [C.aqua, C.violet]][v] ?? [C.butter, C.amber];
  pb.ellipse(7, 6, 4.5, 2.2, a);
  pb.rect(3, 5, 9, 1, b);
  pb.rect(11, 4, 1, 5, a); pb.rect(12, 3, 1, 2, a); pb.rect(12, 8, 1, 2, a);
  pb.set(4, 5, C.ink);
  pb.rect(6, 10, 4, 1, C.brass);
  pb.outline(C.ink);
  return { w: 16, h: 12, ox: 0, oy: 9, pb };
}

function lanternArt(): Furn {
  const pb = new PixBuf(16, 26);
  pb.rect(7, 12, 2, 12, C.bark);
  pb.rect(4, 23, 8, 2, C.walnut);
  pb.rect(4, 2, 8, 10, C.brass);
  pb.rect(5, 3, 6, 8, C.butter);
  pb.rect(7, 5, 2, 4, C.cream);
  pb.rect(3, 1, 10, 2, C.copper); pb.rect(6, 0, 4, 1, C.copper);
  pb.outline(C.ink);
  return { w: 16, h: 26, ox: 0, oy: 10, pb };
}

function gildedClock(): Furn {
  const pb = new PixBuf(16, 34);
  pb.rect(3, 2, 10, 30, C.walnut);
  pb.rect(2, 0, 12, 3, C.brass);
  pb.rect(4, 4, 8, 8, C.brass);
  pb.disc(8, 8, 3, C.cream);
  pb.set(8, 6, C.ink); pb.set(8, 7, C.ink); pb.set(9, 8, C.ink);
  pb.rect(5, 14, 6, 14, C.bark);
  pb.rect(7, 15, 2, 9, C.brass); pb.disc(8, 25, 1.6, C.butter);
  pb.rect(2, 31, 12, 3, C.brass);
  pb.outline(C.ink);
  return { w: 16, h: 34, ox: 0, oy: 18, pb };
}

function globe(): Furn {
  const pb = new PixBuf(16, 24);
  pb.rect(7, 16, 2, 6, C.walnut); pb.rect(4, 21, 8, 2, C.walnut);
  pb.disc(8, 9, 5.5, C.river);
  pb.disc(6, 7, 2, C.leaf); pb.rect(9, 10, 3, 2, C.leaf); pb.set(10, 6, C.moss);
  pb.line(2, 9, 14, 9, C.brass);
  pb.rect(8, 2, 1, 2, C.brass); pb.rect(8, 15, 1, 2, C.brass);
  pb.outline(C.ink);
  return { w: 16, h: 24, ox: 0, oy: 8, pb };
}

function telescope(): Furn {
  const pb = new PixBuf(16, 24);
  pb.line(3, 22, 8, 12, C.walnut); pb.line(13, 22, 8, 12, C.walnut); pb.line(8, 22, 8, 12, C.bark);
  pb.line(3, 12, 14, 3, C.brass); pb.line(3, 13, 14, 4, C.brass); pb.line(4, 13, 14, 5, C.copper);
  pb.rect(13, 2, 2, 4, C.copper);
  pb.outline(C.ink);
  return { w: 16, h: 24, ox: 0, oy: 8, pb };
}

function musicbox(): Furn {
  const pb = new PixBuf(16, 18);
  pb.rect(7, 12, 2, 4, C.walnut); pb.rect(3, 15, 10, 2, C.walnut);
  pb.rect(3, 6, 10, 6, C.wine);
  pb.rect(3, 6, 10, 1, C.rose);
  pb.rect(5, 8, 6, 2, C.brass);
  pb.rect(2, 3, 12, 3, C.wine); pb.rect(2, 3, 12, 1, C.blush);
  pb.rect(13, 8, 2, 1, C.brass);
  pb.outline(C.ink);
  return { w: 16, h: 18, ox: 0, oy: 2, pb };
}

function tapestry(): Furn {
  const pb = new PixBuf(14, 16);
  pb.rect(0, 0, 14, 1, C.walnut);
  pb.rect(1, 1, 12, 14, C.violet);
  pb.rect(2, 2, 10, 12, C.lavender);
  pb.line(2, 11, 6, 5, C.violet); pb.line(6, 5, 9, 9, C.violet); pb.line(9, 9, 11, 6, C.violet);
  pb.rect(2, 11, 10, 3, C.moss);
  pb.disc(10, 4, 1.2, C.butter);
  for (let x = 1; x < 13; x += 2) pb.set(x, 15, C.butter);
  pb.outline(C.ink);
  return { w: 14, h: 16, ox: -1, oy: 11, pb };
}

/** Mags' wagon: a painted cart with a striped canopy */
export function cartArt(): PixBuf {
  const pb = new PixBuf(48, 40);
  // wheels
  pb.disc(10, 33, 6, C.walnut); pb.disc(10, 33, 4, C.oak); pb.disc(10, 33, 1.5, C.bark);
  pb.disc(38, 33, 6, C.walnut); pb.disc(38, 33, 4, C.oak); pb.disc(38, 33, 1.5, C.bark);
  // body
  pb.rect(3, 18, 42, 12, C.violet);
  pb.rect(3, 18, 42, 2, C.lavender);
  pb.rect(5, 22, 38, 6, C.wine);
  for (let x = 8; x < 42; x += 8) pb.rect(x, 22, 2, 6, C.butter);
  // canopy poles + striped canopy
  pb.rect(4, 6, 2, 12, C.bark); pb.rect(42, 6, 2, 12, C.bark);
  for (let x = 0; x < 48; x++) {
    const h = 4 + Math.round(Math.sin((x / 47) * Math.PI) * 4);
    for (let y = 6 - h + 4; y < 9; y++) pb.set(x, y, Math.floor(x / 6) % 2 ? C.cream : C.rose);
  }
  for (let x = 1; x < 48; x += 6) pb.rect(x, 9, 3, 2, C.rose);
  // goods on display
  pb.rect(10, 13, 6, 5, C.tan); pb.rect(10, 13, 6, 1, C.butter);
  pb.disc(22, 15, 2.5, C.aqua); pb.disc(27, 15.5, 2, C.amber);
  pb.rect(31, 12, 4, 6, C.river); pb.rect(31, 12, 4, 1, C.frost);
  pb.rect(37, 14, 5, 4, C.brass);
  pb.outline(C.ink);
  return pb;
}

function banner(): Furn {
  const pb = new PixBuf(12, 16);
  pb.rect(0, 0, 12, 1, C.brass);
  pb.rect(1, 1, 10, 12, C.wine);
  pb.set(1, 13, C.wine); pb.set(10, 13, C.wine); pb.rect(3, 13, 6, 1, C.wine); pb.rect(5, 14, 2, 1, C.wine);
  pb.disc(6, 6, 2.5, C.brass); pb.set(6, 6, C.butter);
  pb.rect(2, 10, 8, 1, C.brass);
  pb.outline(C.ink);
  return { w: 12, h: 16, ox: -2, oy: 10, pb };
}

/** furniture art by name ("armchair:1", "table:0:2" ...), shared by the world and item icons */
export function furnArt(name: string): Furn | null {
  const [kind, vs, ss] = name.split(':');
  const v = +vs || 0, season = +ss || 0;
  switch (kind) {
    case 'bed': return bed(v);
    case 'dresser': return dresser();
    case 'fireplace': return fireplace();
    case 'stove': return stove(v);
    case 'shelf': return shelf(v);
    case 'table': return table(season);
    case 'chair': return chair();
    case 'almanac': return almanac();
    case 'plant': return plant(v);
    case 'window': return windowArt(v, season);
    case 'clock': return clockArt();
    case 'rug': return rug();
    case 'doormat': return doormat();
    case 'armchair': return armchair(v);
    case 'lamp': return lamp();
    case 'rug2': return rug2(v);
    case 'tank': return tank();
    case 'petbed': return petbed();
    case 'painting': return painting(v);
    case 'banner': return banner();
    case 'globe': return globe();
    case 'telescope': return telescope();
    case 'musicbox': return musicbox();
    case 'tapestry': return tapestry();
    case 'lantern': return lanternArt();
    case 'gclock': return gildedClock();
    case 'trophy': return trophy(v);
  }
  return null;
}

// ---------- pets: pet:<kind>:<coat>:<pose> (0 stand, 1 walk, 2 sit, 3 sleep), facing right ----------
const CAT_COATS = [[C.apricot, C.terracotta, C.cream], [C.pebble, C.stone, C.cream], [C.slate, C.plum, C.stone], [C.cream, C.terracotta, C.bark]];
const DOG_COATS = [[C.butter, C.amber, C.cream], [C.oak, C.walnut, C.tan], [C.cream, C.bark, C.cream], [C.tan, C.bark, C.cream]];

function drawCat(coat: number, pose: number): PixBuf {
  const [base, mark, light] = CAT_COATS[coat] ?? CAT_COATS[0];
  const pb = new PixBuf(16, 16);
  const eye = coat === 2 ? C.lime : C.ink;
  const ears = (hx: number, hy: number) => {
    pb.set(hx - 2, hy - 3, base); pb.rect(hx - 2, hy - 2, 2, 1, base);
    pb.set(hx + 1, hy - 3, base); pb.rect(hx, hy - 2, 2, 1, base);
    pb.set(hx - 2, hy - 2, C.rose);
  };
  if (pose <= 1) {
    const st = pose;
    pb.ellipse(7, 10, 4.6, 2.6, base);
    pb.disc(12, 7, 2.7, base);
    ears(12, 6);
    pb.line(3, 9, 1, 6, base); pb.line(1, 6, 2, 3 + st, base);
    for (const [x, ph] of [[4, 0], [6, 1], [9, 0], [11, 1]] as const) pb.rect(x, 12, 1, 3 - ((ph + st) % 2), DARK[base] ?? base);
    // markings
    if (coat === 3) { pb.disc(6, 9, 1.6, mark); pb.disc(9, 10, 1.2, C.bark); pb.set(12, 5, mark); }
    else for (let x = 5; x < 10; x += 2) pb.rect(x, 8, 1, 2, mark);
    pb.rect(8, 11, 4, 1, light);
    pb.set(13, 7, eye);
    pb.set(15, 8, C.rose);
  } else if (pose === 2) {
    pb.ellipse(8, 11, 3.2, 3.6, base);
    pb.disc(9, 6, 2.7, base);
    ears(9, 5);
    pb.rect(5, 14, 7, 1, base); pb.set(4, 13, base);
    pb.rect(8, 12, 1, 3, light); pb.rect(10, 12, 1, 3, light);
    if (coat === 3) { pb.disc(7, 10, 1.4, mark); pb.set(10, 4, mark); }
    else { pb.rect(6, 9, 1, 2, mark); pb.rect(6, 12, 1, 1, mark); }
    pb.set(10, 6, eye); pb.set(8, 6, eye);
    pb.set(9, 7, C.rose);
  } else {
    pb.ellipse(8, 12, 5.5, 2.8, base);
    pb.disc(11, 12, 2.4, base);
    pb.set(10, 9, base); pb.set(12, 9, base);
    pb.rect(3, 14, 8, 1, mark);
    if (coat === 3) pb.disc(6, 11, 1.5, mark);
    else for (let x = 4; x < 9; x += 2) pb.set(x, 10, mark);
    pb.rect(11, 12, 2, 1, C.ink);
  }
  pb.outline(C.ink);
  return pb;
}

function drawDog(coat: number, pose: number): PixBuf {
  const [base, mark, light] = DOG_COATS[coat] ?? DOG_COATS[0];
  const pb = new PixBuf(16, 16);
  const ear = DARK[base] ?? mark;
  if (pose <= 1) {
    const st = pose;
    pb.ellipse(7, 9, 5, 3, base);
    if (coat === 3) pb.ellipse(6, 7.5, 4, 1.4, mark);
    if (coat === 2) { pb.disc(5, 8, 1.5, mark); pb.disc(9, 10, 1.2, mark); }
    pb.disc(12, 6, 2.9, base);
    pb.rect(13, 6, 3, 2, light);
    pb.set(15, 6, C.ink);
    pb.set(12, 5, C.ink);
    pb.rect(10, 4, 2, 4, ear);
    // tail wags between frames
    if (st) pb.line(2, 8, 0, 4, base); else pb.line(2, 8, 1, 3, base);
    for (const [x, ph] of [[3, 0], [5, 1], [9, 0], [11, 1]] as const) pb.rect(x, 11, 2, 4 - ((ph + st) % 2), DARK[base] ?? base);
    pb.rect(7, 11, 3, 1, light);
  } else if (pose === 2) {
    pb.ellipse(7, 11, 3.6, 3.6, base);
    if (coat === 2) pb.disc(6, 10, 1.4, mark);
    pb.disc(9, 5, 3, base);
    pb.rect(10, 6, 3, 2, light);
    pb.set(12, 6, C.ink);
    pb.set(10, 4, C.ink);
    pb.rect(6, 3, 2, 4, ear);
    pb.rect(8, 12, 2, 3, light); pb.rect(4, 13, 3, 2, DARK[base] ?? base);
    pb.line(3, 13, 1, 11, base);
    pb.rect(8, 8, 3, 1, C.rose);
  } else {
    pb.ellipse(8, 12, 6, 2.8, base);
    if (coat === 3) pb.ellipse(7, 11, 4, 1.2, mark);
    if (coat === 2) pb.disc(6, 12, 1.6, mark);
    pb.disc(12, 12, 2.6, base);
    pb.rect(13, 12, 2, 2, light);
    pb.rect(11, 10, 2, 3, ear);
    pb.rect(11, 12, 2, 1, C.ink);
    pb.line(2, 13, 0, 12, base);
  }
  pb.outline(C.ink);
  return pb;
}

function drawBowl(full: number): PixBuf {
  const pb = new PixBuf(16, 16);
  pb.ellipse(8, 12, 5, 2.6, C.river);
  pb.ellipse(8, 11.4, 3.8, 1.6, full ? C.sky : C.slate);
  if (full) { pb.set(6, 11, C.frost); pb.set(7, 11, C.frost); }
  pb.rect(4, 13, 8, 1, C.deepsea);
  pb.outline(C.ink);
  return pb;
}

export function registerHomeSprites() {
  defSpriteFamily('pet:', (name) => {
    const [, kind, cs, ps] = name.split(':');
    const pb = kind === 'dog' ? drawDog(+cs, +ps) : drawCat(+cs, +ps);
    return { w: 16, h: 16, ox: 8, oy: 15, draw: (ctx) => pb.drawTo(ctx) };
  });
  defSpriteFamily('cartw:', () => {
    const pb = cartArt();
    return { w: 48, h: 40, ox: 0, oy: 24, draw: (ctx) => pb.drawTo(ctx) };
  });
  defSpriteFamily('bowl:', (name) => {
    const pb = drawBowl(+name.split(':')[1]);
    return { w: 16, h: 16, ox: 0, oy: 0, draw: (ctx) => pb.drawTo(ctx) };
  });
  defSpriteFamily('hf:', (name) => {
    const f = furnArt(name.slice(3));
    if (!f) return null;
    const pb = f.pb;
    return { w: f.w, h: f.h, ox: f.ox, oy: f.oy, draw: (ctx) => pb.drawTo(ctx) };
  });
}
