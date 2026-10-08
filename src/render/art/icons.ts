// Item icons: 16x16 templates recolored per item from palette slots.
import { furnArt } from './home';
import { C, DARK, LIGHT } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily, sprite } from '../atlas';
import { PixBuf } from './pixbuf';

type Draw = (pb: PixBuf, a: number, b: number, c: number, d: number) => void;

const shadeBody = (pb: PixBuf, cx: number, cy: number, r: number, a: number) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!pb.get(x, y)) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx + dy > r * 0.6) pb.set(x, y, DARK[a]);
    }
};

const T: Record<string, Draw> = {
  // ---------- tools ----------
  hoe: (pb, a) => { pb.line(3, 14, 11, 4, C.oak); pb.line(4, 14, 12, 4, C.walnut); pb.rect(10, 2, 4, 2, a); pb.rect(12, 4, 2, 3, a); pb.set(10, 2, LIGHT[a]); },
  can: (pb, a) => { pb.rect(3, 6, 8, 7, a); pb.rect(3, 6, 8, 1, LIGHT[a]); pb.rect(3, 12, 8, 1, DARK[a]); pb.line(11, 8, 14, 5, a); pb.rect(13, 4, 2, 2, DARK[a]); pb.line(4, 6, 6, 3, C.walnut); pb.line(6, 3, 9, 3, C.walnut); pb.line(9, 3, 10, 6, C.walnut); },
  axe: (pb, a) => { pb.line(4, 14, 11, 3, C.oak); pb.line(5, 14, 12, 3, C.walnut); pb.rect(8, 2, 5, 5, a); pb.rect(12, 3, 2, 3, LIGHT[a]); pb.rect(8, 2, 1, 5, DARK[a]); },
  pick: (pb, a) => { pb.line(4, 14, 10, 5, C.oak); pb.line(5, 14, 11, 5, C.walnut); pb.line(3, 5, 8, 2, a); pb.line(8, 2, 14, 6, a); pb.line(3, 6, 8, 3, DARK[a]); pb.line(9, 3, 14, 7, DARK[a]); },
  scythe: (pb, a) => { pb.line(5, 14, 9, 3, C.oak); pb.line(6, 14, 10, 3, C.walnut); for (let i = 0; i < 7; i++) { pb.set(9 - i, 3 + Math.floor(i * 0.4), a); pb.set(9 - i, 4 + Math.floor(i * 0.5), DARK[a]); } pb.set(2, 6, a); },
  rod: (pb, a) => { pb.line(2, 14, 13, 2, C.oak); pb.line(3, 14, 14, 2, a); pb.line(14, 2, 14, 10, C.pebble); pb.disc(5, 11, 1.6, DARK[a]); pb.set(14, 11, C.rose); },
  sword: (pb, a) => { pb.line(3, 13, 12, 4, a); pb.line(4, 13, 13, 4, LIGHT[a]); pb.line(4, 14, 13, 5, DARK[a]); pb.line(2, 10, 6, 14, C.brass); pb.rect(2, 13, 2, 2, C.walnut); },
  // ---------- produce ----------
  root: (pb, a, b, _c, d) => { pb.ellipse(8, 10, 4, 4, a); pb.line(8, 14, 8, 15, a); pb.line(6, 6, 4, 2, d); pb.line(8, 6, 8, 1, d); pb.line(10, 6, 12, 2, d); pb.set(6, 8, b >= 0 ? b : LIGHT[a]); shadeBody(pb, 8, 10, 4, a); },
  leafy: (pb, a, _b, _c, d) => { pb.disc(8, 9, 5.5, d >= 0 ? d : a); pb.disc(6, 8, 3, a); pb.disc(10, 8, 3, LIGHT[a]); pb.disc(8, 11, 3, DARK[a]); pb.line(8, 5, 8, 13, LIGHT[a]); },
  pod: (pb, a) => { for (let i = 0; i < 9; i++) { pb.rect(4 + i, 10 - Math.floor(Math.sin(i / 3) * 3), 2, 3, a); } for (let i = 0; i < 3; i++) pb.disc(6 + i * 3, 10 - Math.floor(Math.sin((i * 3 + 2) / 3) * 3) + 1, 1, LIGHT[a]); pb.line(4, 9, 3, 6, C.moss); },
  berry: (pb, a, b) => { pb.ellipse(8, 9, 4.5, 5, a); pb.line(6, 3, 10, 3, C.leaf); pb.set(8, 2, C.moss); for (const [x, y] of [[6, 8], [9, 7], [8, 11], [10, 10], [6, 11]]) pb.set(x, y, b >= 0 ? b : C.butter); shadeBody(pb, 8, 9, 4.5, a); },
  berries: (pb, a, b) => { for (const [x, y] of [[6, 7], [10, 8], [7, 11], [11, 12], [9, 5]]) { pb.disc(x, y, 2.2, a); pb.set(x - 1, y - 1, LIGHT[a]); pb.set(x + 1, y + 1, b >= 0 ? b : DARK[a]); } pb.line(9, 2, 9, 4, C.moss); },
  flower: (pb, a, b, _c, d) => { pb.line(8, 9, 8, 15, d >= 0 ? d : C.moss); pb.line(8, 12, 11, 10, d >= 0 ? d : C.moss); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; pb.disc(8 + Math.cos(t) * 3, 6 + Math.sin(t) * 3, 1.8, a); } pb.disc(8, 6, 1.5, b >= 0 ? b : C.butter); },
  tuber: (pb, a) => { pb.ellipse(8, 9, 6, 4.5, a); pb.set(5, 8, DARK[a]); pb.set(9, 7, DARK[a]); pb.set(11, 10, DARK[a]); pb.set(6, 7, LIGHT[a]); shadeBody(pb, 8, 9, 5, a); },
  round: (pb, a, _b, _c, d) => { pb.disc(8, 9, 5.5, a); pb.disc(6, 7, 1.5, LIGHT[a]); pb.line(8, 3, 8, 4, C.walnut); pb.line(8, 3, 11, 2, d >= 0 ? d : C.leaf); shadeBody(pb, 8, 9, 5.5, a); },
  stalk: (pb, a, _b, _c, d) => { for (let i = 0; i < 3; i++) { pb.rect(5 + i * 2, 3 + i, 2, 12 - i, i === 1 ? a : DARK[a]); } pb.line(5, 3, 3, 1, d >= 0 ? d : C.leaf); pb.line(10, 5, 13, 2, d >= 0 ? d : C.leaf); },
  grain: (pb, a) => { for (let i = 0; i < 3; i++) { const x = 5 + i * 3; pb.line(x, 15, x + 1, 6, C.lime); for (let y = 2; y < 8; y += 2) { pb.set(x, y + i % 2, a); pb.set(x + 1, y + 1 + (i % 2), DARK[a]); } } },
  cogbean: (pb, a) => { pb.disc(8, 8, 5, a); pb.disc(8, 8, 2, DARK[a]); for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; pb.set(8 + Math.round(Math.cos(t) * 6), 8 + Math.round(Math.sin(t) * 6), a); } pb.set(6, 6, LIGHT[a]); pb.line(8, 1, 10, 0, C.moss); },
  corn: (pb, a) => { pb.ellipse(8, 8, 3.5, 6, a); for (let y = 3; y < 14; y += 2) for (let x = 6; x < 11; x += 2) pb.set(x, y, DARK[a]); pb.line(4, 15, 6, 4, C.leaf); pb.line(12, 15, 10, 4, C.grass); },
  melon: (pb, a, b) => { pb.ellipse(8, 9, 6.5, 5.5, a); for (let x = 3; x < 14; x += 3) pb.line(x, 5, x + 1, 13, b >= 0 ? b : DARK[a]); pb.disc(5, 7, 1.2, LIGHT[a]); },
  pepper: (pb, a, b, _c, d) => { pb.ellipse(8, 9, 3, 5.5, a); pb.line(8, 3, 9, 1, d >= 0 ? d : C.moss); pb.rect(7, 3, 3, 1, d >= 0 ? d : C.moss); pb.set(7, 6, LIGHT[a]); pb.set(9, 13, b >= 0 ? b : DARK[a]); },
  sunflower: (pb, a, b) => { for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; pb.disc(8 + Math.cos(t) * 4.5, 8 + Math.sin(t) * 4.5, 1.8, a); } pb.disc(8, 8, 3, b >= 0 ? b : C.walnut); pb.set(7, 7, C.bark); pb.set(9, 9, C.bark); },
  hops: (pb, a) => { pb.ellipse(8, 9, 4, 5.5, a); for (let y = 5; y < 14; y += 2) pb.line(5, y, 11, y, DARK[a]); pb.line(8, 2, 8, 4, C.moss); },
  cane: (pb, a) => { for (let i = 0; i < 3; i++) { const x = 4 + i * 3; pb.rect(x, 2, 2, 13, i === 1 ? LIGHT[a] : a); for (let y = 4; y < 15; y += 4) pb.rect(x, y, 2, 1, DARK[a]); } },
  cotton: (pb, a) => { pb.line(8, 15, 8, 9, C.walnut); for (const [x, y] of [[6, 6], [10, 6], [8, 4], [8, 8]]) pb.disc(x, y, 2.5, a); pb.set(7, 5, LIGHT[a]); pb.set(9, 9, DARK[a]); },
  beans: (pb, a) => { for (const [x, y] of [[5, 6], [10, 7], [7, 11], [11, 12]]) { pb.ellipse(x, y, 2.2, 1.6, a); pb.set(x, y, DARK[a]); } },
  bell: (pb, a, b) => { pb.line(8, 1, 8, 4, C.moss); pb.ellipse(8, 9, 4.5, 5, a); pb.rect(3, 12, 11, 2, a); pb.set(8, 14, b >= 0 ? b : C.amber); pb.set(6, 7, LIGHT[a]); shadeBody(pb, 8, 9, 5, a); },
  pumpkin: (pb, a, b) => { pb.ellipse(8, 10, 6.5, 5, a); for (const x of [5, 8, 11]) pb.line(x, 6, x, 14, b >= 0 ? b : DARK[a]); pb.rect(7, 3, 2, 3, C.moss); pb.set(5, 8, LIGHT[a]); },
  eggplant: (pb, a) => { pb.ellipse(8, 10, 4, 5.5, a); pb.rect(6, 3, 4, 2, C.moss); pb.set(8, 2, C.moss); pb.set(6, 8, LIGHT[a]); shadeBody(pb, 8, 10, 5, a); },
  grapes: (pb, a, b) => { const pts = [[6, 5], [9, 5], [12, 5], [7, 8], [10, 8], [8, 11], [11, 11], [9, 14]]; for (const [x, y] of pts) { pb.disc(x - 1, y, 1.7, a); pb.set(x - 2, y - 1, b >= 0 ? b : LIGHT[a]); } pb.line(9, 1, 9, 3, C.walnut); pb.line(10, 2, 13, 1, C.leaf); },
  choke: (pb, a, b) => { for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) pb.disc(4 + i * 2, 12 - r * 2.5, 1.5, r % 2 ? a : DARK[a]); pb.disc(8, 3, 1.8, b >= 0 ? b : C.lavender); },
  mushroom: (pb, a, b) => { pb.rect(6, 8, 4, 7, b >= 0 ? b : C.cream); pb.ellipse(8, 7, 6, 3.5, a); pb.rect(2, 8, 13, 1, DARK[a]); pb.set(5, 5, LIGHT[a]); pb.set(10, 6, LIGHT[a]); },
  starflower: (pb, a, b) => { for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2 - Math.PI / 2; pb.line(8, 7, 8 + Math.round(Math.cos(t) * 6), 7 + Math.round(Math.sin(t) * 6), a); pb.disc(8 + Math.cos(t) * 3.5, 7 + Math.sin(t) * 3.5, 1.4, a); } pb.disc(8, 7, 1.5, b >= 0 ? b : C.butter); pb.line(8, 12, 8, 15, C.moss); },
  leaf: (pb, a, b) => { pb.ellipse(8, 8, 4, 6, a); pb.line(8, 3, 8, 15, DARK[a]); for (let y = 5; y < 13; y += 2) { pb.set(7, y, DARK[a]); pb.set(9, y + 1, DARK[a]); } if (b >= 0) { pb.disc(11, 4, 1.5, b); pb.disc(12, 7, 1.5, b); } },
  // ---------- seeds / saplings / tree products ----------
  seeds: (pb, a, b) => { pb.rect(3, 3, 10, 11, C.tan); pb.rect(3, 3, 10, 1, C.cream); pb.rect(3, 13, 10, 1, C.oak); pb.disc(8, 8, 2.5, a); pb.line(8, 10, 8, 12, b); pb.set(7, 7, LIGHT[a]); pb.rect(3, 2, 10, 1, C.oak); },
  sapling: (pb, a, b, _c, d) => { pb.rect(4, 11, 8, 4, C.terracotta); pb.rect(4, 11, 8, 1, C.apricot); pb.line(8, 11, 8, 6, b); pb.disc(6, 6, 2.2, a); pb.disc(10, 5, 2.2, a); pb.disc(8, 3, 2, LIGHT[a]); if (d >= 0) pb.set(10, 6, d); },
  fruit: (pb, a, _b, _c, d) => { pb.disc(8, 9, 5, a); pb.set(5, 7, LIGHT[a]); pb.set(6, 6, LIGHT[a]); pb.line(8, 4, 9, 2, C.walnut); pb.ellipse(11, 3, 2, 1, d >= 0 ? d : C.leaf); shadeBody(pb, 8, 9, 5, a); },
  cherry: (pb, a) => { pb.disc(5, 11, 2.8, a); pb.disc(11, 12, 2.8, a); pb.line(5, 8, 9, 2, C.moss); pb.line(11, 9, 9, 2, C.moss); pb.set(4, 10, LIGHT[a]); pb.set(10, 11, LIGHT[a]); },
  pear: (pb, a) => { pb.disc(8, 11, 4.5, a); pb.disc(8, 6, 2.8, a); pb.line(8, 2, 9, 1, C.walnut); pb.set(6, 9, LIGHT[a]); shadeBody(pb, 8, 10, 5, a); },
  coconut: (pb, a) => { pb.disc(8, 9, 5.5, C.walnut); for (let i = 0; i < 12; i++) pb.set(4 + Math.floor(hash2(i, 1, 2) * 9), 5 + Math.floor(hash2(1, i, 2) * 8), C.bark); pb.set(7, 6, C.ink); pb.set(9, 6, C.ink); pb.set(8, 8, C.ink); void a; },
  nut: (pb, a, b) => { pb.ellipse(8, 10, 4.5, 4, a); pb.ellipse(8, 6, 4, 2.2, b >= 0 ? b : DARK[a]); pb.set(8, 3, C.bark); pb.set(6, 9, LIGHT[a]); },
  wing: (pb, a, b) => { pb.ellipse(6, 10, 2, 2, b >= 0 ? b : DARK[a]); pb.ellipse(10, 6, 4, 2, a); pb.line(7, 9, 13, 4, DARK[a]); },
  cone: (pb, a, b) => { for (let r = 0; r < 5; r++) for (let x = -2 + Math.abs(r - 2) * 0.5; x <= 2 - Math.abs(r - 2) * 0.5; x++) pb.disc(8 + x * 1.5, 4 + r * 2.2, 1.3, r % 2 ? a : b >= 0 ? b : DARK[a]); },
  twig: (pb, a, b) => { pb.line(3, 13, 13, 3, a); pb.line(4, 13, 14, 3, b >= 0 ? b : DARK[a]); pb.line(8, 8, 5, 4, a); pb.set(5, 3, C.leaf); },
  // ---------- resources ----------
  log: (pb, a, b) => { pb.rect(2, 6, 12, 7, a); pb.rect(2, 6, 12, 1, LIGHT[a]); pb.ellipse(13, 9.5, 2, 3.5, LIGHT[a]); pb.set(13, 9, b >= 0 ? b : DARK[a]); for (let x = 3; x < 11; x += 3) pb.set(x, 10, b >= 0 ? b : DARK[a]); },
  stone: (pb, a) => { pb.ellipse(8, 10, 6, 4.5, a); pb.ellipse(6, 8, 3, 2, LIGHT[a]); shadeBody(pb, 8, 10, 5, a); },
  fiber: (pb, a, b) => { for (let i = 0; i < 6; i++) pb.line(4 + i, 14, 3 + i * 2, 3 + (i % 2) * 2, i % 2 ? a : b >= 0 ? b : DARK[a]); pb.rect(5, 10, 6, 2, C.tan); },
  drop: (pb, a) => { pb.disc(8, 10, 4, a); for (let y = 3; y < 8; y++) pb.rect(8 - Math.floor((y - 3) / 2), y, 1 + Math.floor((y - 3) / 2) * 2, 1, a); pb.set(7, 9, LIGHT[a]); },
  clay: (pb, a) => { pb.ellipse(8, 10, 6, 4, a); pb.ellipse(8, 8, 4, 2, LIGHT[a]); pb.set(5, 11, DARK[a]); pb.set(10, 10, DARK[a]); },
  pile: (pb, a, b) => { for (let y = 0; y < 7; y++) pb.rect(8 - y - 1, 7 + y, y * 2 + 2, 1, a); for (let i = 0; i < 8; i++) pb.set(3 + Math.floor(hash2(i, 3, 1) * 10), 9 + Math.floor(hash2(3, i, 1) * 5), b >= 0 ? b : DARK[a]); },
  coal: (pb, a, b) => { pb.ellipse(7, 10, 5, 4, a); pb.ellipse(11, 8, 3, 3, a); pb.set(6, 8, b >= 0 ? b : C.slate); pb.set(10, 7, C.stone); pb.set(8, 11, C.slate); },
  hay: (pb, a, b) => { pb.rect(3, 6, 10, 8, a); for (let x = 3; x < 13; x += 2) pb.line(x, 6, x + 1, 13, b >= 0 ? b : DARK[a]); pb.rect(3, 9, 10, 1, C.walnut); for (let x = 2; x < 14; x += 3) pb.set(x, 5, LIGHT[a]); },
  ore: (pb, a, b, c) => { pb.ellipse(8, 9, 6, 5, c >= 0 ? c : C.stone); for (const [x, y] of [[5, 7], [9, 6], [7, 11], [11, 10]]) { pb.disc(x, y, 1.4, a); pb.set(x, y - 1, LIGHT[a]); } if (b >= 0) pb.set(10, 12, b); },
  bar: (pb, a, _b, c) => { for (let y = 0; y < 6; y++) pb.rect(2 + y, 6 + y, 12 - y * 0 - 2, 1, y === 0 ? (c >= 0 ? c : LIGHT[a]) : a); pb.rect(2, 6, 10, 1, c >= 0 ? c : LIGHT[a]); pb.rect(7, 11, 7, 1, DARK[a]); pb.line(12, 6, 14, 11, DARK[a]); },
  gem: (pb, a) => { const pts: [number, number][] = [[8, 3], [13, 7], [8, 14], [3, 7]]; for (let y = 3; y <= 14; y++) { const w = y < 7 ? (y - 3) * 1.3 + 1 : (14 - y) * 0.75; pb.rect(Math.round(8 - w), y, Math.round(w * 2), 1, a); } pb.line(4, 7, 12, 7, LIGHT[a]); pb.line(6, 4, 8, 7, LIGHT[a]); pb.set(6, 8, C.cream); void pts; shadeBody(pb, 8, 8, 6, a); },
  mineral: (pb, a, b) => { pb.ellipse(8, 9, 5.5, 5, a); pb.line(4, 7, 11, 12, b); pb.line(5, 11, 10, 6, b); pb.set(6, 6, LIGHT[a]); },
  geode: (pb, a, b) => { pb.disc(8, 9, 5.5, a); pb.disc(8, 9, 3, b); pb.disc(8, 9, 2, C.lavender); pb.set(7, 8, C.frost); },
  relic: (pb, a, b) => { pb.disc(8, 8, 5, a); pb.disc(8, 8, 2.5, b); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; pb.rect(8 + Math.round(Math.cos(t) * 5.5) - 1, 8 + Math.round(Math.sin(t) * 5.5) - 1, 2, 2, a); } pb.set(8, 8, C.ink); pb.set(10, 5, C.moss); pb.set(5, 11, C.moss); },
  gel: (pb, a, b) => { pb.ellipse(8, 10, 5.5, 4, a); pb.rect(3, 10, 11, 3, a); pb.set(6, 8, b >= 0 ? b : LIGHT[a]); pb.set(5, 9, C.cream); },
  dust: (pb, a, b) => { for (let i = 0; i < 14; i++) pb.set(3 + Math.floor(hash2(i, 5, 2) * 10), 3 + Math.floor(hash2(5, i, 2) * 10), i % 3 ? a : b >= 0 ? b : C.cream); pb.disc(8, 8, 1.5, a); },
  essence: (pb, a, b) => { pb.rect(6, 3, 4, 2, C.walnut); pb.ellipse(8, 10, 4.5, 5, C.frost); pb.disc(8, 10, 3, a); pb.set(7, 9, b >= 0 ? b : C.cream); },
  shell: (pb, a, b) => { for (let i = 0; i < 5; i++) pb.line(8, 13, 3 + i * 2.5, 4 + Math.abs(i - 2), i % 2 ? a : b >= 0 ? b : LIGHT[a]); pb.ellipse(8, 9, 5, 4, a); for (let i = 0; i < 5; i++) pb.line(8, 13, 4 + i * 2, 6, DARK[a]); },
  coral: (pb, a, b) => { pb.line(8, 14, 8, 6, a); pb.line(8, 9, 4, 4, a); pb.line(8, 8, 12, 3, a); pb.line(5, 6, 3, 7, b); pb.line(11, 5, 13, 6, b); pb.rect(5, 14, 6, 1, C.tan); },
  kelp: (pb, a, b) => { for (let i = 0; i < 3; i++) for (let y = 2; y < 15; y++) pb.set(5 + i * 3 + Math.round(Math.sin(y / 2 + i) * 1), y, i === 1 ? b : a); },
  // ---------- components ----------
  plank: (pb, a, b) => { pb.rect(1, 6, 14, 5, a); pb.rect(1, 6, 14, 1, LIGHT[a]); pb.rect(1, 10, 14, 1, b); pb.set(4, 8, b); pb.set(11, 8, b); },
  gear: (pb, a, b) => { pb.disc(8, 8, 5, a); for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; pb.rect(8 + Math.round(Math.cos(t) * 5.5) - 1, 8 + Math.round(Math.sin(t) * 5.5) - 1, 2, 2, a); } pb.disc(8, 8, 2, b); pb.disc(8, 8, 1, C.ink); pb.set(6, 5, LIGHT[a]); },
  plate: (pb, a, b) => { pb.rect(2, 4, 12, 9, a); pb.rect(2, 4, 12, 1, LIGHT[a]); pb.rect(2, 12, 12, 1, b); for (const [x, y] of [[3, 5], [12, 5], [3, 11], [12, 11]]) pb.set(x, y, b); },
  coil: (pb, a, b) => { for (let i = 0; i < 5; i++) { pb.ellipse(4 + i * 2, 8, 2, 4, i % 2 ? a : b); } pb.rect(3, 6, 10, 4, C.walnut); for (let x = 3; x < 13; x++) pb.set(x, x % 2 ? 6 : 9, a); },
  spring: (pb, a, b) => { for (let y = 2; y < 15; y += 2) { pb.line(4, y, 12, y + 1, a); pb.set(4, y + 1, b); } },
  sparkcoil: (pb, a, b) => { pb.rect(5, 3, 6, 10, C.frost); pb.rect(5, 3, 6, 1, C.cream); pb.rect(4, 13, 8, 2, b); pb.rect(4, 2, 8, 1, b); pb.line(8, 4, 7, 7, a); pb.line(7, 7, 9, 9, a); pb.line(9, 9, 8, 12, LIGHT[a]); },
  core: (pb, a, b) => { pb.disc(8, 8, 6, a); pb.disc(8, 8, 4.5, DARK[a]); pb.disc(6, 7, 2, LIGHT[a]); pb.disc(10, 9, 2, a); pb.disc(8, 8, 1.5, b); pb.set(8, 8, C.cream); },
  lens: (pb, a, b) => { pb.disc(8, 8, 6, b); pb.disc(8, 8, 4.5, a); pb.set(6, 6, C.cream); pb.set(7, 5, C.cream); },
  glass: (pb, a, b) => { pb.rect(4, 3, 8, 11, a); pb.rect(4, 3, 8, 1, C.cream); pb.line(6, 5, 6, 11, C.cream); pb.rect(4, 13, 8, 1, b); },
  brick: (pb, a, b) => { pb.rect(2, 5, 12, 7, a); pb.rect(2, 5, 12, 1, b); pb.rect(2, 8, 12, 1, DARK[a]); pb.set(7, 6, DARK[a]); pb.set(5, 10, DARK[a]); pb.set(10, 10, DARK[a]); },
  rope: (pb, a, b) => { pb.ellipse(8, 8, 6, 5, a); pb.ellipse(8, 8, 3, 2, 0); pb.clear(8, 8); for (let i = 0; i < 10; i++) pb.set(3 + i, 5 + (i % 3), b); },
  cloth: (pb, a, b) => { pb.rect(2, 4, 12, 9, a); pb.rect(2, 4, 12, 2, LIGHT[a]); for (let x = 3; x < 13; x += 2) pb.set(x, 8, b); pb.rect(11, 10, 3, 3, b); },
  quilt: (pb, a, b) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) pb.rect(2 + x * 4, 3 + y * 4, 4, 4, (x + y) % 2 ? a : b); pb.rect(2, 15, 12, 1, C.cream); },
  bot: (pb, a, b) => { pb.ellipse(8, 9, 4, 3.5, a); for (let x = 5; x < 12; x += 2) pb.rect(x, 7, 1, 5, C.bark); pb.ellipse(5, 4, 3, 2, C.frost); pb.ellipse(11, 4, 3, 2, C.frost); pb.disc(12, 9, 1.5, b); pb.set(13, 9, C.ink); },
  bundle: (pb, a) => { pb.rect(3, 5, 10, 9, a); pb.rect(3, 5, 10, 1, LIGHT[a]); pb.rect(3, 13, 10, 1, DARK[a]); pb.rect(7, 5, 2, 9, C.cream); pb.rect(3, 8, 10, 2, C.cream); pb.disc(8, 4, 2, C.rose); pb.set(6, 3, C.rose); pb.set(10, 3, C.rose); },
  scroll: (pb, a, b) => { pb.rect(3, 4, 10, 9, a); pb.rect(2, 3, 2, 11, LIGHT[a] ?? a); pb.rect(12, 3, 2, 11, LIGHT[a] ?? a); for (let y = 6; y < 12; y += 2) pb.rect(5, y, 6, 1, C.pebble); pb.rect(7, 12, 2, 3, b); },
  pouch: (pb, a, b) => { pb.ellipse(8, 10, 5, 4.5, a); pb.rect(6, 4, 4, 3, a); pb.rect(5, 6, 6, 1, b); pb.set(6, 9, LIGHT[a]); },
  flask: (pb, a, b) => { pb.rect(7, 2, 2, 4, C.frost); pb.ellipse(8, 10, 5, 4.5, C.frost); pb.ellipse(8, 11, 4, 3, a); pb.set(6, 9, C.cream); pb.rect(6, 1, 4, 1, b); },
  bait: (pb, a, b) => { pb.rect(4, 5, 8, 9, b); pb.rect(4, 5, 8, 1, LIGHT[b]); for (let i = 0; i < 4; i++) pb.line(5 + i * 2, 4, 6 + i * 2, 1, a); },
  boot: (pb, a, b) => { pb.rect(5, 2, 5, 10, a); pb.rect(5, 10, 9, 4, a); pb.rect(5, 13, 9, 1, b); pb.set(7, 6, b); },
  tincan: (pb, a, b) => { pb.rect(4, 4, 8, 10, a); pb.ellipse(8, 4, 4, 1.5, LIGHT[a]); pb.rect(4, 7, 8, 3, b); },
  // ---------- animal & artisan ----------
  egg: (pb, a, b) => { pb.ellipse(8, 9, 4.5, 5.5, a); pb.set(6, 6, C.cream); pb.set(6, 7, C.cream); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pb.get(x, y) && x + y > 19) pb.set(x, y, b); },
  feather: (pb, a, b) => { pb.line(3, 14, 12, 2, b); for (let i = 0; i < 9; i++) { pb.line(4 + i, 13 - i * 1.3, 7 + i, 13 - i * 1.3, a); } pb.line(3, 14, 12, 2, b); },
  wool: (pb, a, b) => { for (const [x, y, r] of [[6, 7, 3], [10, 7, 3], [8, 10, 4], [5, 11, 2.5], [11, 11, 2.5]] as const) pb.disc(x, y, r, a); for (const [x, y] of [[6, 6], [10, 9], [8, 12]]) pb.set(x, y, b); },
  milk: (pb, a, b) => { pb.rect(5, 5, 6, 9, a); pb.rect(6, 2, 4, 3, a); pb.rect(5, 8, 6, 3, C.sky); pb.rect(6, 1, 4, 1, C.rose); pb.set(6, 6, C.cream); void b; },
  truffle: (pb, a, b) => { pb.disc(8, 9, 5, a); for (let i = 0; i < 10; i++) pb.set(4 + Math.floor(hash2(i, 9, 9) * 8), 5 + Math.floor(hash2(9, i, 9) * 8), b); },
  cheese: (pb, a, b) => { for (let y = 0; y < 8; y++) pb.rect(3, 6 + y, 2 + y * 1.3, 1, a); pb.rect(3, 6, 10, 1, LIGHT[a]); pb.rect(3, 6, 10, 8, a); pb.disc(6, 10, 1, b); pb.disc(10, 9, 1.2, b); pb.rect(3, 13, 10, 1, DARK[a]); },
  butter: (pb, a, b) => { pb.rect(2, 7, 12, 6, a); pb.rect(2, 7, 12, 1, LIGHT[a]); pb.rect(2, 12, 12, 1, b); pb.rect(1, 13, 14, 1, C.cream); },
  jar: (pb, a, _b, _c, d) => { pb.rect(4, 5, 8, 9, C.frost); pb.rect(5, 6, 6, 7, a); pb.rect(4, 3, 8, 2, d >= 0 ? d : C.walnut); pb.rect(5, 9, 6, 2, C.cream); pb.set(5, 6, LIGHT[a]); },
  bottle: (pb, a, _b, _c, d) => { pb.rect(6, 2, 4, 4, d >= 0 ? d : C.wine); pb.rect(5, 6, 6, 8, d >= 0 ? d : C.wine); pb.rect(6, 7, 4, 6, a); pb.rect(6, 9, 4, 2, C.cream); pb.rect(6, 1, 4, 1, C.tan); pb.set(6, 7, LIGHT[a]); },
  mug: (pb, a, b) => { pb.rect(4, 5, 7, 9, C.oak); pb.rect(5, 6, 5, 7, a); pb.rect(4, 3, 7, 3, b); pb.rect(11, 7, 2, 1, C.oak); pb.rect(12, 7, 1, 4, C.oak); pb.rect(11, 10, 2, 1, C.oak); },
  cup: (pb, a, b) => { pb.rect(4, 7, 8, 6, b); pb.rect(5, 7, 6, 2, a); pb.rect(12, 8, 2, 3, b); pb.rect(3, 13, 10, 1, C.pebble); pb.line(6, 5, 7, 2, C.pebble); pb.line(9, 5, 10, 2, C.pebble); },
  sack: (pb, a, b) => { pb.ellipse(8, 10, 5.5, 5, a); pb.rect(6, 3, 4, 3, a); pb.rect(5, 5, 6, 1, b); pb.rect(6, 9, 4, 3, b); },
  bread: (pb, a, b) => { pb.ellipse(8, 10, 6.5, 4, a); pb.ellipse(8, 8, 5.5, 3, LIGHT[a]); pb.line(5, 7, 6, 9, b); pb.line(8, 7, 9, 9, b); pb.line(11, 7, 12, 9, b); },
  bowl: (pb, a, b) => { pb.ellipse(8, 9, 6.5, 2.5, a); pb.set(6, 8, b); pb.set(9, 9, b); pb.set(10, 8, LIGHT[a]); for (let y = 0; y < 4; y++) pb.rect(2 + y, 10 + y, 12 - y * 2, 1, C.cream); pb.rect(5, 14, 6, 1, C.pebble); },
  pie: (pb, a, b) => { pb.ellipse(8, 10, 6.5, 4, b); pb.ellipse(8, 9, 5.5, 3, a); for (let x = 4; x < 13; x += 2) pb.set(x, 9, LIGHT[a]); pb.rect(2, 11, 13, 1, DARK[b]); },
  cake: (pb, a, b) => { pb.rect(3, 7, 10, 7, b); pb.rect(3, 7, 10, 2, a); pb.rect(3, 11, 10, 1, a); pb.set(8, 5, C.rose); pb.set(8, 6, C.cream); pb.rect(3, 14, 10, 1, C.pebble); },
  cookie: (pb, a, b) => { pb.disc(6, 9, 4, a); pb.disc(11, 8, 3, a); pb.set(5, 8, b); pb.set(7, 10, b); pb.set(11, 7, b); },
  dish: (pb, a, b) => { pb.ellipse(8, 10, 7, 3.5, C.cream); pb.ellipse(8, 9, 4.5, 2.5, a); pb.set(7, 8, b); pb.set(9, 9, LIGHT[a]); },
  ticket: (pb, a, b) => { pb.rect(2, 5, 12, 7, a); pb.rect(2, 5, 12, 1, LIGHT[a]); pb.rect(5, 7, 6, 3, b); pb.set(2, 8, 0); pb.clear(2, 8); pb.clear(13, 8); },
  locket: (pb, a, b) => { pb.line(8, 1, 4, 5, a); pb.line(8, 1, 12, 5, a); pb.disc(6, 9, 2.5, b); pb.disc(10, 9, 2.5, b); for (let y = 9; y < 14; y++) pb.rect(4 + (y - 9), y, 9 - (y - 9) * 2, 1, b); pb.set(6, 8, C.cream); },
};

// fish shapes
const fishShape = (shape: string): Draw => (pb, a, b, c) => {
  const body = a, belly = b >= 0 ? b : LIGHT[a], fin = c >= 0 ? c : DARK[a];
  switch (shape) {
    case 'round': pb.ellipse(7, 8, 5, 4.5, body); break;
    case 'long': pb.ellipse(7, 8, 6.5, 2.5, body); break;
    case 'flat': pb.ellipse(7, 8, 5.5, 3.5, body); break;
    case 'eel': for (let x = 1; x < 13; x++) pb.rect(x, 7 + Math.round(Math.sin(x / 2) * 2), 1, 3, body); break;
    case 'spiny': pb.ellipse(7, 8, 5, 4, body); for (let x = 3; x < 12; x += 2) pb.set(x, 3, fin); break;
    default: pb.ellipse(7, 8, 6, 3, body);
  }
  if (shape !== 'eel') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pb.get(x, y) && y > 8) pb.set(x, y, belly);
    // tail
    pb.line(12, 8, 15, 5, fin); pb.line(12, 8, 15, 11, fin); pb.line(13, 8, 15, 7, fin); pb.line(13, 8, 15, 9, fin);
    pb.line(6, 4, 9, 3, fin);
  }
  pb.set(4, 7, C.ink);
  pb.set(4, 6, C.cream);
};
for (const s of ['slim', 'round', 'long', 'flat', 'eel', 'spiny']) T['fish_' + s] = fishShape(s);

export function iconExists(t: string) {
  return !!T[t];
}

export function registerIconSprites(structIcon: (structId: string, ctx: CanvasRenderingContext2D) => void) {
  defSpriteFamily('i:', (name) => {
    const id = name.slice(2);
    const d = ITEM_BY_ID.get(id);
    if (!d) return null;
    return {
      w: 16, h: 16,
      draw: (ctx) => {
        if (d.icon.t === 'struct' && d.places) {
          structIcon(d.places, ctx);
          return;
        }
        if (d.icon.t === 'furn' && d.icon.s) {
          // shrink the furniture sprite to fit the 16x16 icon
          const f = furnArt(d.icon.s);
          if (f) {
            const c = document.createElement('canvas');
            c.width = f.w; c.height = f.h;
            f.pb.drawTo(c.getContext('2d')!);
            const sc = Math.min(1, 16 / Math.max(f.w, f.h));
            const w = Math.round(f.w * sc), h = Math.round(f.h * sc);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(c, Math.floor((16 - w) / 2), Math.floor((16 - h) / 2), w, h);
          }
          return;
        }
        const pb = new PixBuf(16, 16);
        const c = d.icon.c ?? [];
        const a = c[0] ?? C.stone;
        const f = T[d.icon.t] ?? T.stone;
        f(pb, a, c[1] ?? -1, c[2] ?? -1, c[3] ?? -1);
        pb.outline(C.ink);
        pb.drawTo(ctx);
      },
    };
  });
  // quality stars: q:<1..3>
  defSpriteFamily('q:', (name) => {
    const q = +name.slice(2);
    const col = [0, C.pebble, C.amber, C.lavender][q];
    return {
      w: 7, h: 7,
      draw: (ctx) => {
        const pb = new PixBuf(7, 7);
        pb.set(3, 0, col); pb.rect(2, 1, 3, 1, col); pb.rect(0, 2, 7, 2, col); pb.rect(1, 4, 5, 1, col); pb.set(1, 5, col); pb.set(5, 5, col); pb.set(0, 6, col); pb.set(6, 6, col);
        pb.set(3, 2, LIGHT[col]);
        pb.outline(C.ink);
        pb.drawTo(ctx);
      },
    };
  });
}

/** Ensure every item resolves to a known template (dev check). */
export function missingIconTemplates(): string[] {
  return ITEMS.filter((d) => d.icon.t !== 'struct' && !T[d.icon.t]).map((d) => d.id + ':' + d.icon.t);
}

export { sprite };
