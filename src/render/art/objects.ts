// Natural objects, trees and town buildings.
import { C, DARK, LIGHT } from '../../data/palette';
import { TREE_BY_ID } from '../../data/trees';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily } from '../atlas';
import { O } from '../../sim/world/tilemap';
import { PixBuf } from './pixbuf';
import { drawGallery } from './deep';

const FLOWER_COLS = [[C.rose, C.butter], [C.butter, C.amber], [C.lavender, C.cream], [C.cream, C.amber], [C.blush, C.cream], [C.sky, C.cream]];

function rockShape(pb: PixBuf, cx: number, cy: number, rx: number, ry: number, base: number, seed: number) {
  pb.ellipse(cx, cy, rx, ry, base);
  // shading: top-left light, bottom-right dark
  for (let y = 0; y < pb.h; y++)
    for (let x = 0; x < pb.w; x++) {
      if (!pb.get(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx + dy > 0.7) pb.set(x, y, DARK[base]);
      else if (dx + dy < -0.8) pb.set(x, y, LIGHT[base]);
      else if (hash2(x, y, seed) < 0.08) pb.set(x, y, DARK[base]);
    }
  pb.outline(C.ink);
}

function leafy(pb: PixBuf, cx: number, cy: number, r: number, leaf: number, seed: number) {
  // little cluster of leaves
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + seed;
    pb.disc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.5, r * 0.45, i % 2 ? leaf : DARK[leaf]);
  }
}

/** Natural flat objects: o:<obj>:<variant>:<season> */
function drawObj(o: O, v: number, season: number): PixBuf {
  const pb = new PixBuf(16, 16);
  const winter = season === 3;
  switch (o) {
    case O.ROCK:
      rockShape(pb, 8, 10, 5 + (v % 2), 4, v === 2 ? C.pebble : C.stone, v);
      if (winter) for (let x = 5; x < 11; x++) pb.set(x, 6, C.cream);
      break;
    case O.BOULDER:
      rockShape(pb, 8, 9, 7, 6, C.stone, 3);
      pb.line(5, 6, 8, 9, C.slate);
      if (winter) for (let x = 4; x < 12; x++) pb.set(x, 3, C.cream);
      break;
    case O.ORE_ROCK: {
      rockShape(pb, 8, 10, 6, 5, C.stone, v);
      const col = [C.copper, C.pebble, C.pebble, C.brass, C.ink, C.lavender, C.stone, C.terracotta][v] ?? C.copper;
      const spots: [number, number][] = [[5, 8], [9, 9], [7, 12], [11, 11], [6, 10]];
      for (const [x, y] of spots) { pb.set(x, y, col); pb.set(x + 1, y, LIGHT[col]); }
      break;
    }
    case O.GEM_ROCK: {
      rockShape(pb, 8, 10, 6, 5, C.slate, v);
      const gc = [C.violet, C.amber, C.leaf, C.rose, C.sky, C.blush, C.lavender][v % 7];
      pb.line(6, 9, 6, 6, gc); pb.line(7, 9, 8, 5, LIGHT[gc]); pb.line(10, 10, 11, 7, gc);
      break;
    }
    case O.ICE_ROCK:
      rockShape(pb, 8, 10, 6, 5, C.aqua, v);
      pb.line(6, 7, 9, 7, C.frost);
      break;
    case O.CRYSTAL:
      for (let i = 0; i < 3; i++) {
        const x = 5 + i * 3, h = 6 + ((i + v) % 3) * 2;
        pb.rect(x, 14 - h, 2, h, i === 1 ? C.lavender : C.violet);
        pb.set(x, 14 - h, C.frost);
      }
      pb.outline(C.ink);
      break;
    case O.STALAGMITE:
      for (let y = 3; y < 15; y++) {
        const w = Math.floor((y - 3) / 3) + 1;
        pb.rect(8 - w, y, w * 2, 1, y < 8 ? C.stone : C.slate);
      }
      pb.outline(C.ink);
      break;
    case O.WEED: {
      const leaf = season === 2 ? C.amber : winter ? C.pebble : v === 1 ? C.leaf : C.grass;
      for (let i = 0; i < 4; i++) {
        const x = 4 + i * 2 + (v % 2);
        pb.line(x, 14, x + (i % 2 ? 1 : -1), 7 + ((i + v) % 3), leaf);
        pb.set(x + (i % 2 ? 1 : -1), 6 + ((i + v) % 3), LIGHT[leaf]);
      }
      pb.line(5, 14, 11, 14, DARK[leaf]);
      if (v === 2 && !winter) { pb.set(7, 6, C.butter); pb.set(10, 7, C.cream); }
      pb.outline(C.ink);
      break;
    }
    case O.TWIG:
      pb.line(3, 12, 12, 9, C.walnut);
      pb.line(3, 11, 12, 8, C.oak);
      pb.line(8, 10, 10, 6, C.walnut);
      if (v) pb.line(5, 13, 9, 13, C.oak);
      pb.outline(C.ink);
      break;
    case O.STUMP:
      pb.rect(3, 7, 10, 7, C.walnut);
      pb.ellipse(8, 7, 5, 2.5, C.tan);
      pb.ellipse(8, 7, 3, 1.4, C.oak);
      pb.set(8, 7, C.walnut);
      pb.rect(2, 12, 2, 2, C.bark); pb.rect(12, 12, 2, 2, C.bark);
      for (let y = 9; y < 14; y++) pb.set(5 + (y % 3), y, C.bark);
      if (winter) pb.ellipse(8, 6, 4, 1.5, C.cream);
      pb.outline(C.ink);
      break;
    case O.LOG:
      pb.rect(1, 6, 14, 8, C.walnut);
      pb.rect(1, 6, 14, 2, C.oak);
      pb.ellipse(14, 10, 2, 4, C.tan);
      pb.set(14, 10, C.oak);
      for (let x = 2; x < 12; x += 3) pb.set(x, 11, C.bark);
      if (winter) pb.rect(2, 5, 11, 1, C.cream);
      pb.outline(C.ink);
      break;
    case O.TALLGRASS: {
      const c = winter ? C.pebble : season === 2 ? C.amber : season === 1 ? C.moss : C.grass;
      for (let i = 0; i < 7; i++) {
        const x = 2 + i * 2;
        const h = 6 + Math.floor(hash2(i, v, 1) * 5);
        pb.line(x, 15, x + (i % 3) - 1, 15 - h, i % 2 ? c : LIGHT[c]);
      }
      break;
    }
    case O.BUSH: {
      const leaf = season === 2 ? C.terracotta : winter ? C.moss : C.moss;
      pb.disc(8, 9, 6.5, leaf);
      pb.disc(5, 10, 4, DARK[leaf]);
      pb.disc(9, 7, 4.5, LIGHT[leaf] === C.cream ? leaf : season === 2 ? C.apricot : C.grass);
      if (winter) { pb.ellipse(8, 4.5, 5, 1.6, C.cream); pb.set(4, 7, C.cream); }
      if (season === 1 && v % 3 === 0) { pb.set(6, 8, C.rose); pb.set(10, 10, C.rose); pb.set(8, 12, C.rose); }
      pb.outline(C.ink);
      break;
    }
    case O.FLOWER: {
      if (winter) {
        pb.set(7, 13, C.pebble);
        break;
      }
      const [a, b] = FLOWER_COLS[v % FLOWER_COLS.length];
      const stems: [number, number][] = [[4, 9], [9, 7], [12, 11]];
      stems.forEach(([x, y], i) => {
        if (i === 2 && v % 2) return;
        pb.line(x, y + 1, x, 15, C.moss);
        pb.set(x - 1, y, a); pb.set(x + 1, y, a); pb.set(x, y - 1, a); pb.set(x, y + 1, a);
        pb.set(x, y, b);
      });
      break;
    }
    case O.MUSHROOM:
      pb.rect(5, 11, 2, 3, C.cream);
      pb.ellipse(6, 10, 3, 2, season === 2 ? C.terracotta : C.rose);
      pb.set(5, 9, C.cream);
      pb.rect(10, 12, 1, 2, C.cream);
      pb.ellipse(10.5, 11, 2, 1.4, C.tan);
      pb.outline(C.ink);
      break;
    case O.REEDS:
      for (let i = 0; i < 4; i++) {
        const x = 3 + i * 3;
        pb.line(x, 15, x, 4 + (i % 2) * 2, winter ? C.tan : C.moss);
        if (i % 2 === 0) pb.rect(x, 4 + (i % 2) * 2, 1, 3, C.walnut);
      }
      break;
    case O.LILYPAD:
      pb.ellipse(8, 9, 5, 3, C.grass);
      pb.line(8, 9, 12, 8, C.moss);
      if (v % 2 === 0 && season < 2) { pb.set(6, 8, C.blush); pb.set(7, 7, C.cream); }
      break;
    case O.ARTIFACT:
      for (const [x, y] of [[5, 9], [9, 7], [8, 11]]) {
        pb.set(x, y, C.walnut); pb.set(x + 1, y - 1, C.walnut); pb.set(x + 2, y, C.bark);
      }
      break;
    case O.FLOWERBED: {
      pb.rect(1, 6, 14, 9, C.walnut);
      pb.rect(1, 6, 14, 1, C.oak);
      if (!winter) {
        const [a, b] = FLOWER_COLS[v % FLOWER_COLS.length];
        for (let i = 0; i < 6; i++) {
          const x = 3 + (i % 3) * 4, y = 8 + Math.floor(i / 3) * 4;
          pb.set(x, y + 1, C.moss); pb.set(x, y, a); pb.set(x + 1, y, b); pb.set(x - 1, y, a); pb.set(x, y - 1, a);
        }
      } else pb.rect(2, 7, 12, 2, C.cream);
      pb.outline(C.ink);
      break;
    }
    case O.HEDGE:
      pb.rect(1, 3, 14, 12, C.moss);
      for (let i = 0; i < 20; i++) pb.set(1 + Math.floor(hash2(i, 1, v) * 14), 3 + Math.floor(hash2(1, i, v) * 12), i % 2 ? C.grass : C.pine);
      pb.rect(1, 3, 14, 1, winter ? C.cream : C.grass);
      pb.outline(C.ink);
      break;
    case O.TREASURE: {
      // 0 small chest, 1 grand gilded chest, 2 opened
      const grand = v === 1;
      const body = grand ? C.wine : C.oak, band = grand ? C.brass : C.stone;
      pb.rect(2, 7, 12, 8, body);
      pb.rect(2, 7, 12, 1, LIGHT[body] ?? body);
      if (v === 2) {
        pb.rect(2, 4, 12, 3, DARK[body] ?? body);
        pb.rect(3, 7, 10, 2, C.ink);
      } else {
        pb.rect(2, 4, 12, 4, body);
        pb.rect(2, 4, 12, 1, LIGHT[body] ?? body);
        pb.rect(7, 7, 2, 3, C.butter);
      }
      pb.rect(4, 4, 1, 11, band); pb.rect(11, 4, 1, 11, band);
      if (grand) { pb.set(3, 3, C.butter); pb.set(13, 2, C.cream); }
      pb.outline(C.ink);
      break;
    }
    case O.FENCE:
      pb.rect(7, 3, 3, 12, C.oak);
      pb.rect(7, 3, 3, 1, C.tan);
      pb.rect(0, 6, 16, 2, C.walnut);
      pb.rect(0, 10, 16, 2, C.walnut);
      if (winter) pb.rect(7, 2, 3, 1, C.cream);
      pb.outline(C.ink);
      break;
    case O.BENCH:
      pb.rect(1, 6, 14, 2, C.oak);
      pb.rect(1, 9, 14, 2, C.walnut);
      pb.rect(2, 11, 2, 4, C.bark); pb.rect(12, 11, 2, 4, C.bark);
      pb.outline(C.ink);
      break;
    case O.BARREL:
    case O.CRATE:
      if (o === O.CRATE) {
        pb.rect(2, 4, 12, 11, C.oak);
        pb.line(2, 4, 13, 14, C.walnut); pb.line(13, 4, 2, 14, C.walnut);
        pb.rect(2, 4, 12, 1, C.tan);
      } else {
        pb.ellipse(8, 9, 5.5, 6, C.walnut);
        pb.rect(3, 6, 11, 1, C.stone); pb.rect(3, 12, 11, 1, C.stone);
        pb.ellipse(8, 4, 4, 1.4, C.oak);
      }
      pb.outline(C.ink);
      break;
    case O.SIGNPOST:
      pb.rect(7, 6, 2, 9, C.walnut);
      pb.rect(2, 3, 12, 5, C.oak);
      pb.line(3, 5, 12, 5, C.walnut);
      pb.outline(C.ink);
      break;
    case O.MAILBOX:
      pb.rect(7, 8, 2, 7, C.walnut);
      pb.rect(3, 3, 10, 6, C.river);
      pb.rect(3, 3, 10, 1, C.sky);
      pb.rect(11, 1, 1, 4, C.rose);
      pb.outline(C.ink);
      break;
    case O.LADDER:
      pb.ellipse(8, 8, 6, 5, C.ink);
      pb.rect(5, 3, 1, 10, C.oak); pb.rect(10, 3, 1, 10, C.oak);
      for (let y = 4; y < 13; y += 3) pb.rect(5, y, 6, 1, C.tan);
      break;
    case O.SHAFT:
      pb.ellipse(8, 9, 6, 5, C.ink);
      pb.ellipse(8, 9, 4, 3, C.plum);
      for (let i = 0; i < 6; i++) pb.set(3 + i * 2, 4 + (i % 2), C.stone);
      break;
    case O.MINE_EXIT:
      pb.rect(4, 0, 1, 16, C.oak); pb.rect(11, 0, 1, 16, C.oak);
      for (let y = 1; y < 16; y += 3) pb.rect(4, y, 8, 1, C.tan);
      break;
    case O.ELEVATOR:
      pb.rect(2, 1, 12, 14, C.bark);
      pb.rect(3, 2, 10, 12, C.ink);
      for (let x = 3; x < 13; x += 2) pb.rect(x, 2, 1, 12, C.brass);
      pb.rect(2, 1, 12, 1, C.brass);
      pb.outline(C.ink);
      break;
    case O.GALLERY:
      drawGallery(pb, v);
      break;
    case O.WELL:
      pb.ellipse(8, 11, 6, 4, C.stone);
      pb.ellipse(8, 10, 4, 2.5, C.deepsea);
      pb.rect(2, 2, 1, 9, C.walnut); pb.rect(13, 2, 1, 9, C.walnut);
      pb.rect(1, 1, 14, 2, C.terracotta);
      pb.outline(C.ink);
      break;
    default:
      break;
  }
  return pb;
}

/** Trees: tree:<species>:<stage>:<season>:<fruit>:<variant>  (32x48, anchored bottom-center) */
function drawTree(species: string, stage: number, season: number, fruit: number, v: number): PixBuf {
  const pb = new PixBuf(32, 48);
  const def = TREE_BY_ID.get(species);
  const look = def?.look ?? { leaf: C.grass, leaf2: C.moss, trunk: C.walnut, shape: 'round' as const };
  const shape = look.shape;
  const deciduous = shape === 'round' || shape === 'tall' || shape === 'willow';
  let leaf = look.leaf, leaf2 = look.leaf2;
  if (season === 2 && deciduous && def?.wild !== false) {
    if (species === 'maple') { leaf = C.rose; leaf2 = C.terracotta; }
    else if (species === 'birch') { leaf = C.amber; leaf2 = C.brass; }
    else if (species === 'oak') { leaf = C.apricot; leaf2 = C.terracotta; }
    else if (species === 'willow') { leaf = C.lime; leaf2 = C.amber; }
    else { leaf = C.amber; leaf2 = C.apricot; }
  }
  if (season === 0 && (species === 'cherry' || species === 'apricot' || species === 'peach')) { leaf = C.blush; leaf2 = C.rose; }
  const bare = season === 3 && deciduous && species !== 'snowberry';
  const trunk = look.trunk;
  const cx = 16, base = 46;

  if (stage === 0) {
    pb.ellipse(cx, base - 1, 3, 1.5, C.walnut);
    pb.set(cx, base - 2, C.oak);
    return pb;
  }
  if (stage === 1) {
    pb.line(cx, base, cx, base - 4, C.moss);
    pb.set(cx - 1, base - 4, C.leaf); pb.set(cx + 1, base - 5, C.leaf); pb.set(cx - 2, base - 3, C.grass);
    pb.outline(C.ink);
    return pb;
  }
  if (stage === 2) {
    pb.rect(cx, base - 9, 1, 9, trunk);
    if (!bare) leafy(pb, cx, base - 10, 5, leaf, v);
    else { pb.line(cx, base - 8, cx - 3, base - 11, trunk); pb.line(cx, base - 7, cx + 3, base - 10, trunk); }
    pb.outline(C.ink);
    return pb;
  }
  const big = stage >= 4;
  const H = big ? 1 : 0.62;
  // trunk
  const th = Math.round((shape === 'palm' ? 30 : shape === 'pine' ? 12 : shape === 'tall' ? 18 : 14) * H);
  const tw = big ? (shape === 'tall' || shape === 'palm' ? 3 : 4) : 2;
  for (let y = 0; y < th; y++) {
    const sway = shape === 'palm' ? Math.round(Math.sin(y / 10) * 2) : 0;
    for (let x = 0; x < tw; x++) {
      const c = shape === 'tall' ? (hash2(x, y, 5) < 0.2 ? C.ink : C.cream) : x === 0 ? DARK[trunk] : x === tw - 1 ? LIGHT[trunk] : trunk;
      pb.set(cx - (tw >> 1) + x + sway, base - y, c);
    }
  }
  if (big && shape !== 'palm') { pb.set(cx - 3, base, DARK[trunk]); pb.set(cx + 2, base, DARK[trunk]); }
  const top = base - th;
  if (bare) {
    // branches
    const br: [number, number, number, number][] = [[0, 0, -7, -8], [0, 0, 6, -9], [0, -4, -4, -12], [0, -4, 4, -13], [0, -2, 0, -14]];
    for (const [x0, y0, x1, y1] of br) pb.line(cx + x0, top + y0, cx + Math.round(x1 * H), top + Math.round(y1 * H), trunk);
    for (const [, , x1, y1] of br) pb.set(cx + Math.round(x1 * H), top + Math.round(y1 * H) - 1, C.cream);
    pb.outline(C.ink);
    return pb;
  }
  const canopy = new PixBuf(32, 48);
  if (shape === 'pine') {
    const layers = big ? 4 : 3;
    for (let l = 0; l < layers; l++) {
      const yb = top + 4 - l * 7 * H;
      const w = (12 - l * 2.5) * H + 2;
      for (let y = 0; y < 9 * H; y++) {
        const ww = Math.round((w * (y + 1)) / (9 * H));
        for (let x = -ww; x <= ww; x++) canopy.set(cx + x, Math.round(yb - 9 * H + y), x < -ww / 3 ? leaf : leaf2);
      }
    }
  } else if (shape === 'palm') {
    const fr: [number, number][] = [[-11, 4], [11, 4], [-8, -3], [8, -3], [0, -6], [-12, 0], [12, 0]];
    for (const [dx, dy] of fr) {
      canopy.line(cx, top, cx + dx, top + dy, leaf);
      canopy.line(cx, top + 1, cx + dx, top + dy + 1, leaf2);
    }
    if (fruit > 0 || (big && v % 2 === 0)) { canopy.disc(cx - 1, top + 2, 1.5, C.walnut); canopy.disc(cx + 2, top + 2, 1.5, C.bark); }
  } else if (shape === 'willow') {
    canopy.ellipse(cx, top - 4 * H, 12 * H + 1, 9 * H + 1, leaf);
    for (let i = -11; i <= 11; i += 2) {
      const len = 10 + Math.floor(hash2(i, v, 2) * 8);
      canopy.line(cx + Math.round(i * H), top - 2, cx + Math.round(i * H * 1.1), top + Math.round(len * H), i % 4 === 1 ? leaf2 : leaf);
    }
  } else if (shape === 'tall') {
    canopy.ellipse(cx, top - 9 * H, 7 * H + 1, 13 * H + 1, leaf);
  } else {
    const r = 11 * H + 1;
    canopy.disc(cx, top - r * 0.7, r, leaf);
    canopy.disc(cx - r * 0.6, top - r * 0.2, r * 0.65, leaf);
    canopy.disc(cx + r * 0.6, top - r * 0.2, r * 0.65, leaf);
    canopy.disc(cx, top - r * 1.25, r * 0.6, leaf);
  }
  // shade canopy: dark bottom, light top-left, clumps
  let minY = 48, maxY = 0;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) if (canopy.get(x, y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const span = Math.max(1, maxY - minY);
  for (let y = minY; y <= maxY; y++)
    for (let x = 0; x < 32; x++) {
      if (!canopy.get(x, y)) continue;
      if (shape === 'palm' || shape === 'pine') {
        const i = (y * 32 + x) * 4;
        for (let k = 0; k < 4; k++) pb.data[i + k] = canopy.data[i + k];
        continue;
      }
      const t = (y - minY) / span;
      const h = hash2(x >> 1, y >> 1, v + 3);
      let c = leaf;
      if (t > 0.62 || (t > 0.45 && h < 0.35)) c = leaf2;
      else if (t < 0.3 && x < cx && h < 0.5) c = LIGHT[leaf] === C.cream ? leaf : LIGHT[leaf];
      if (h > 0.93) c = DARK[leaf2];
      pb.set(x, y, c);
    }
  if (season === 3 && !bare) {
    // snow caps
    for (let x = 0; x < 32; x++)
      for (let y = 0; y < 48; y++)
        if (pb.get(x, y) && !pb.get(x, y - 1) && y < base - 4) {
          pb.set(x, y, C.cream);
          if (hash2(x, y, 9) < 0.5) pb.set(x, y + 1, C.frost);
        }
  }
  // fruit
  if (fruit > 0 && def?.look.fruit !== undefined && shape !== 'palm') {
    const fc = def.look.fruit;
    let placed = 0;
    for (let i = 0; i < 40 && placed < Math.min(6, fruit * 2); i++) {
      const x = Math.floor(hash2(i, 1, v) * 32), y = Math.floor(hash2(1, i, v) * 48);
      if (pb.get(x, y) && pb.get(x + 1, y + 1) && y < base - th) {
        pb.set(x, y, fc); pb.set(x + 1, y, fc); pb.set(x, y + 1, DARK[fc]); pb.set(x + 1, y + 1, fc);
        placed++;
      }
    }
  }
  pb.outline(C.ink);
  return pb;
}

/** Building art: bld:<id>:<season>:<state> */
export interface BldDesc { id: string; kind: string; w: number; h: number; roof: number; wall: number }
const bldDescs = new Map<string, BldDesc>();
export function registerBuildingDesc(d: BldDesc) {
  bldDescs.set(d.id, d);
}

const ROOF_H = 18;
function drawBuilding(d: BldDesc, season: number, state: number): PixBuf {
  const W = d.w * 16, H = d.h * 16 + ROOF_H;
  const pb = new PixBuf(W, H);
  const winter = season === 3;
  const wallTop = ROOF_H + Math.floor(d.h * 16 * 0.38);
  const groundY = H - 1;
  if (d.kind === 'tower') {
    // stone clocktower
    pb.rect(8, 14, W - 16, H - 14, C.stone);
    for (let y = 16; y < H; y += 5) for (let x = 8; x < W - 8; x++) if ((x + Math.floor(y / 5) * 4) % 8 === 0) pb.set(x, y, C.slate);
    for (let y = 16; y < H; y += 5) pb.rect(8, y, W - 16, 1, C.slate);
    pb.rect(4, 2, W - 8, 14, C.slate);
    for (let x = 4; x < W - 4; x++) pb.set(x, 2 + Math.abs(x - W / 2) / 3, C.wine);
    pb.rect(W / 2 - 1, 0, 2, 4, C.brass);
    // clock face
    const cx = W / 2, cy = 30;
    pb.disc(cx, cy, 10, C.brass);
    pb.disc(cx, cy, 8.5, C.cream);
    for (let i = 0; i < 12; i++) pb.set(cx + Math.cos((i / 12) * Math.PI * 2) * 7, cy + Math.sin((i / 12) * Math.PI * 2) * 7, C.ink);
    if (state === 0) {
      // stopped at 4:17, cracked
      pb.line(cx, cy, cx + 4, cy + 2, C.ink); pb.line(cx, cy, cx + 2, cy - 6, C.ink);
      pb.line(cx - 6, cy - 3, cx - 2, cy + 4, C.stone);
      pb.set(W - 14, 48, C.moss); pb.set(W - 13, 49, C.moss); pb.set(12, 60, C.moss);
    }
    // door
    pb.rect(cx - 5, H - 18, 10, 18, C.walnut);
    pb.ellipse(cx, H - 18, 5, 3, C.walnut);
    pb.rect(cx - 5, H - 18, 1, 18, C.bark);
    pb.set(cx + 3, H - 9, C.brass);
    pb.outline(C.ink);
    return pb;
  }
  if (d.kind === 'mine') {
    pb.rect(0, 10, W, H - 10, C.slate);
    for (let i = 0; i < 60; i++) pb.set(Math.floor(hash2(i, 2, 3) * W), 10 + Math.floor(hash2(2, i, 3) * (H - 10)), i % 3 ? C.stone : C.ink);
    const cx = W / 2;
    pb.ellipse(cx, H - 10, 14, 16, C.ink);
    pb.rect(cx - 14, H - 10, 28, 10, C.ink);
    pb.rect(cx - 16, H - 30, 4, 30, C.oak); pb.rect(cx + 12, H - 30, 4, 30, C.oak);
    pb.rect(cx - 18, H - 32, 36, 4, C.walnut);
    pb.rect(cx - 4, H - 5, 8, 2, C.stone);
    return pb;
  }
  if (d.kind === 'greenhouse') {
    // only the back wall + roof ridge is a building; the glass roof is drawn as an overlay
    pb.rect(0, H - 22, W, 22, C.walnut);
    for (let x = 0; x < W; x += 8) pb.rect(x, H - 22, 1, 22, C.bark);
    pb.rect(0, H - 22, W, 2, C.oak);
    for (let x = 2; x < W - 2; x += 8) {
      pb.rect(x, H - 18, 5, 12, state ? C.aqua : (x / 8) % 3 === 1 ? C.ink : C.aqua);
      pb.set(x + 1, H - 17, C.frost);
    }
    pb.outline(C.ink);
    return pb;
  }
  // walls
  const wall = d.wall;
  for (let y = wallTop; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = wall;
      if (wall === C.oak || wall === C.walnut || wall === C.tan) {
        if ((y - wallTop) % 4 === 3) c = DARK[wall];
      } else if (hash2(x, y, 3) < 0.05) c = DARK[wall] === C.pebble ? C.pebble : DARK[wall];
      pb.set(x, y, c);
    }
  // foundation
  pb.rect(0, H - 4, W, 4, C.stone);
  for (let x = 0; x < W; x += 5) pb.set(x, H - 3, C.slate);
  // corner beams
  if (d.kind !== 'farmhouse' || true) {
    pb.rect(0, wallTop, 2, H - wallTop - 4, C.walnut);
    pb.rect(W - 2, wallTop, 2, H - wallTop - 4, C.walnut);
  }
  // roof (gable seen from the front: a slanted band)
  const roof = d.roof;
  for (let y = 0; y < wallTop + 2; y++) {
    const inset = Math.max(0, Math.floor((ROOF_H - y) * 0.6));
    for (let x = inset - 2; x < W - inset + 2; x++) {
      if (x < 0 || x >= W) continue;
      let c = roof;
      const row = Math.floor(y / 3);
      if (y % 3 === 2) c = DARK[roof];
      else if ((x + row * 3) % 7 === 0) c = DARK[roof];
      else if (y < 4) c = LIGHT[roof];
      if (winter && (y < wallTop - 4 || hash2(x, y, 4) < 0.25) && y % 3 !== 2) c = hash2(x, y, 5) < 0.2 ? C.frost : C.cream;
      pb.set(x, y, c);
    }
  }
  pb.rect(0, wallTop + 1, W, 2, DARK[roof]);
  // the keeper's farmhouse: timber band, copper downpipe and a brass cog on the gable
  if (d.kind === 'farmhouse') {
    pb.rect(2, wallTop + 17, W - 4, 2, C.walnut);
    pb.rect(3, wallTop + 2, 2, H - wallTop - 6, C.copper);
    pb.rect(3, wallTop + 2, 1, H - wallTop - 6, C.apricot);
    for (let y = wallTop + 6; y < H - 6; y += 8) pb.rect(2, y, 4, 1, C.brass);
    pb.rect(1, H - 6, 6, 2, C.copper);
    const gx = Math.floor(W / 2), gy = 7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pb.rect(Math.round(gx + Math.cos(a) * 5) - 1, Math.round(gy + Math.sin(a) * 5) - 1, 2, 2, C.brass);
    }
    pb.disc(gx, gy, 4.2, C.brass);
    pb.disc(gx, gy, 2.4, C.copper);
    pb.disc(gx, gy, 1, C.ink);
  }
  // chimney
  if (d.kind === 'farmhouse' || d.id === 'inn' || d.id === 'smithy' || d.id === 'hermit_hut') {
    pb.rect(W - 18, 0, 7, 12, d.kind === 'farmhouse' ? C.copper : C.brick);
    pb.rect(W - 19, 0, 9, 2, d.kind === 'farmhouse' ? C.brass : C.slate);
    for (let y = 3; y < 12; y += 3) pb.rect(W - 18, y, 7, 1, C.wine);
  }
  // door
  const doorX = Math.floor(d.w / 2) * 16 + 3;
  pb.rect(doorX, H - 20, 10, 16, C.walnut);
  pb.rect(doorX, H - 20, 10, 1, C.oak);
  pb.rect(doorX + 4, H - 20, 1, 16, C.bark);
  pb.set(doorX + 7, H - 12, C.brass);
  pb.rect(doorX - 1, H - 21, 12, 1, C.bark);
  // windows
  const winY = wallTop + 6;
  const winCount = Math.max(1, Math.floor(d.w / 3));
  for (let i = 0; i < winCount; i++) {
    const wx = Math.floor(((i + 0.5) / winCount) * W) - 5;
    if (Math.abs(wx + 5 - (doorX + 5)) < 12) continue;
    pb.rect(wx, winY, 10, 9, C.walnut);
    pb.rect(wx + 1, winY + 1, 8, 7, state ? C.amber : C.river);
    pb.rect(wx + 1, winY + 1, 3, 2, state ? C.butter : C.sky);
    pb.rect(wx + 5, winY + 1, 1, 7, C.walnut);
    pb.rect(wx + 1, winY + 4, 8, 1, C.walnut);
    // flower box
    if (d.kind !== 'shop' || i % 2 === 0) {
      pb.rect(wx, winY + 9, 10, 2, C.oak);
      if (!winter) for (let k = 0; k < 4; k++) pb.set(wx + 1 + k * 2, winY + 8, [C.rose, C.butter, C.lavender, C.blush][(k + i) % 4]);
    }
  }
  // seasonal touches on homes
  if (d.kind === 'farmhouse' || d.kind === 'house') {
    if (winter) {
      // wreath on the door and icicles along the eaves
      pb.disc(doorX + 5, H - 15, 3.2, C.pine);
      pb.disc(doorX + 5, H - 15, 1.4, C.walnut);
      pb.set(doorX + 4, H - 18, C.rose); pb.set(doorX + 6, H - 18, C.rose); pb.set(doorX + 5, H - 17, C.brick);
      for (let x = 3; x < W - 3; x += 4) { pb.rect(x, wallTop + 3, 1, 2 + ((x / 4) % 3), C.frost); }
    } else if (season === 2) {
      // pumpkins and a bundle of corn stalks by the door
      pb.ellipse(doorX - 5, H - 6, 3.5, 2.5, C.apricot); pb.rect(doorX - 5, H - 9, 1, 2, C.moss);
      pb.ellipse(doorX + 15, H - 6, 2.5, 2, C.terracotta); pb.set(doorX + 15, H - 8, C.moss);
      pb.rect(doorX + 18, H - 14, 1, 10, C.tan); pb.rect(doorX + 19, H - 13, 1, 9, C.amber); pb.rect(doorX + 20, H - 14, 1, 10, C.tan);
    } else if (season === 0) {
      // potted tulips by the door
      pb.rect(doorX - 5, H - 8, 4, 4, C.terracotta);
      pb.set(doorX - 4, H - 10, C.rose); pb.set(doorX - 2, H - 10, C.butter); pb.set(doorX - 3, H - 9, C.leaf);
    }
  }
  // shop sign
  if (d.kind === 'shop') {
    pb.rect(doorX - 6, wallTop + 1, 22, 6, C.oak);
    pb.rect(doorX - 6, wallTop + 1, 22, 1, C.tan);
    pb.rect(doorX - 3, wallTop + 3, 16, 2, C.walnut);
  }
  pb.outline(C.ink);
  void groundY;
  return pb;
}

export function registerObjectSprites() {
  defSpriteFamily('o:', (name) => {
    const [, os, vs, ss] = name.split(':');
    return { w: 16, h: 16, draw: (ctx) => drawObj(+os as O, +vs, +ss).drawTo(ctx) };
  });
  defSpriteFamily('tree:', (name) => {
    const [, sp, st, ss, fr, vs] = name.split(':');
    return { w: 32, h: 48, ox: 16, oy: 46, draw: (ctx) => drawTree(sp, +st, +ss, +fr, +vs).drawTo(ctx) };
  });
  defSpriteFamily('bld:', (name) => {
    const [, id, ss, st] = name.split(':');
    const d = bldDescs.get(id);
    if (!d) return null;
    const W = d.w * 16, H = d.h * 16 + ROOF_H;
    return { w: W, h: H, ox: 0, oy: ROOF_H, draw: (ctx) => drawBuilding(d, +ss, +st).drawTo(ctx) };
  });
  // lamppost (tall): lamp:<lit>
  defSpriteFamily('lamp:', (name) => {
    const lit = name.endsWith('1');
    return {
      w: 16, h: 32, ox: 0, oy: 16,
      draw: (ctx) => {
        const pb = new PixBuf(16, 32);
        pb.rect(7, 8, 2, 23, C.bark);
        pb.rect(5, 29, 6, 3, C.slate);
        pb.rect(4, 3, 8, 7, C.ink);
        pb.rect(5, 4, 6, 5, lit ? C.amber : C.stone);
        pb.rect(6, 5, 2, 2, lit ? C.butter : C.pebble);
        pb.rect(3, 2, 10, 2, C.bark);
        pb.rect(7, 0, 2, 2, C.brass);
        pb.outline(C.ink);
        pb.drawTo(ctx);
      },
    };
  });
  // notice board (tall)
  defSpriteFamily('board:', () => ({
    w: 24, h: 28, ox: 4, oy: 12,
    draw: (ctx) => {
      const pb = new PixBuf(24, 28);
      pb.rect(3, 6, 2, 22, C.walnut); pb.rect(19, 6, 2, 22, C.walnut);
      pb.rect(1, 3, 22, 16, C.oak);
      pb.rect(2, 5, 20, 12, C.tan);
      pb.rect(4, 6, 6, 5, C.cream); pb.rect(12, 7, 7, 6, C.butter); pb.rect(6, 12, 5, 4, C.blush);
      pb.set(7, 6, C.rose); pb.set(15, 7, C.rose);
      pb.rect(0, 1, 24, 3, C.moss);
      pb.outline(C.ink);
      pb.drawTo(ctx);
    },
  }));
}
