// Structure art: machines, belts, arms, power, storage, farm buildings.
// Rustic steampunk: wood, brass, copper, brick, little gears and chimneys.
import { C, DARK, LIGHT } from '../../data/palette';
import { STRUCT_BY_ID } from '../../data/structures';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily, sprite, drawSprite } from '../atlas';
import { PixBuf } from './pixbuf';

/** extra pixels above the footprint for tall art */
export const EXTRA_TOP: Record<string, number> = {
  keg: 4, jar: 6, furnace: 8, oven: 12, cheese_press: 8, hand_loom: 8, seed_sifter: 4, compost_bin: 2, charcoal_kiln: 8,
  brick_kiln: 16, bee_skep: 4, lab: 10, mill: 20, sawmill: 12, steam_loom: 14, bottler: 14, assembler: 12, assembler_2: 14,
  blast_furnace: 22, crusher: 12, roaster: 10, kitchen: 16, harvester: 14, planter: 10, drill_steam: 16, drill_brass: 16,
  sprinkler_1: 2, sprinkler_2: 3, sprinkler_3: 4, mist_tower: 18, scarecrow: 14, lamp: 16, pole_wood: 20, pole_iron: 22,
  pole_tower: 40, waterwheel: 10, windmill: 30, steam_engine: 18, sunlens: 8, spring_battery: 6, chest_wood: 2, chest_iron: 2,
  chest_brass: 3, crate_out: 2, crate_req: 2, crate_store: 2, hive: 18, shipping_crate: 3, coop_1: 18, coop_2: 20, coop_3: 22,
  barn_1: 22, barn_2: 24, barn_3: 26, silo: 28, well: 8, construction_site: 16, freight_depot: 20, sign: 6, flower_pot: 4, fence_wood: 2, fence_stone: 0,
  gate: 2, tapper: 0, fish_trap: 0,
};

type Art = (pb: PixBuf, W: number, H: number, top: number, f: number, on: boolean, season: number) => void;

// ---------- helpers ----------
function plankBox(pb: PixBuf, x: number, y: number, w: number, h: number, wood = C.oak) {
  pb.rect(x, y, w, h, wood);
  for (let yy = y + 3; yy < y + h; yy += 4) pb.rect(x, yy, w, 1, DARK[wood]);
  pb.rect(x, y, w, 1, LIGHT[wood]);
  pb.rect(x, y + h - 1, w, 1, DARK[DARK[wood]]);
}
function brassBand(pb: PixBuf, x: number, y: number, w: number) {
  pb.rect(x, y, w, 1, C.brass);
  pb.rect(x, y + 1, w, 1, C.copper);
}
function gear(pb: PixBuf, cx: number, cy: number, r: number, col: number, f: number) {
  pb.disc(cx, cy, r, col);
  const n = Math.max(6, Math.round(r * 2));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + f * (Math.PI / n);
    pb.set(Math.round(cx + Math.cos(t) * (r + 1)), Math.round(cy + Math.sin(t) * (r + 1)), col);
  }
  pb.disc(cx, cy, Math.max(1, r * 0.4), DARK[col]);
  pb.set(Math.round(cx), Math.round(cy), C.ink);
}
function chimney(pb: PixBuf, x: number, y: number, h: number, col = C.brick) {
  pb.rect(x, y, 4, h, col);
  pb.rect(x - 1, y, 6, 2, C.slate);
  for (let yy = y + 3; yy < y + h; yy += 3) pb.rect(x, yy, 4, 1, DARK[col]);
}
function window(pb: PixBuf, x: number, y: number, w: number, h: number, on: boolean) {
  pb.rect(x, y, w, h, C.walnut);
  pb.rect(x + 1, y + 1, w - 2, h - 2, on ? C.amber : C.river);
  pb.set(x + 1, y + 1, on ? C.butter : C.sky);
}
function brickWall(pb: PixBuf, x: number, y: number, w: number, h: number) {
  pb.rect(x, y, w, h, C.brick);
  for (let yy = y; yy < y + h; yy += 3) {
    pb.rect(x, yy, w, 1, C.wine);
    for (let xx = x + ((yy / 3) % 2 ? 0 : 3); xx < x + w; xx += 6) pb.set(xx, yy + 1, C.wine), pb.set(xx, yy + 2, C.wine);
  }
}
function roofBand(pb: PixBuf, x: number, y: number, w: number, h: number, col: number, snow: boolean) {
  for (let yy = 0; yy < h; yy++) {
    const inset = Math.floor((h - yy) * 0.5);
    for (let xx = x - 1 + inset; xx < x + w + 1 - inset; xx++) {
      let c = yy % 3 === 2 ? DARK[col] : (xx + Math.floor(yy / 3) * 2) % 6 === 0 ? DARK[col] : col;
      if (snow && yy < h - 2 && yy % 3 !== 2) c = C.cream;
      pb.set(xx, y + yy, c);
    }
  }
}
function fire(pb: PixBuf, x: number, y: number, w: number, f: number, on: boolean) {
  pb.rect(x, y, w, 4, C.ink);
  if (!on) return;
  for (let i = 0; i < w; i++) {
    const h = 1 + Math.floor(hash2(i, f, 7) * 3);
    for (let k = 0; k < h; k++) pb.set(x + i, y + 3 - k, k === 0 ? C.terracotta : k === 1 ? C.amber : C.butter);
  }
}

const ART: Record<string, Art> = {
  keg: (pb, W, H, t) => {
    pb.ellipse(8, t + 9, 6.5, 7, C.oak);
    for (let y = t + 3; y < t + 16; y += 3) pb.rect(2, y, 12, 1, C.walnut);
    pb.rect(2, t + 5, 12, 1, C.stone); pb.rect(2, t + 12, 12, 1, C.stone);
    pb.ellipse(8, t + 3, 5, 2, C.tan);
    pb.rect(12, t + 9, 3, 2, C.brass);
  },
  jar: (pb, W, H, t, f, on) => {
    pb.rect(3, t + 13, 10, 3, C.walnut);
    pb.rect(3, t + 1, 10, 13, C.frost);
    pb.rect(4, t + 4, 8, 9, on ? C.rose : C.blush);
    pb.rect(4, t + 4, 2, 9, C.cream);
    pb.rect(2, t - 2, 12, 3, C.brass);
    pb.rect(5, t + 7, 6, 3, C.cream);
  },
  furnace: (pb, W, H, t, f, on) => {
    pb.ellipse(8, t + 8, 7, 9, C.stone);
    for (let i = 0; i < 12; i++) pb.set(2 + Math.floor(hash2(i, 1, 1) * 12), t + Math.floor(hash2(1, i, 1) * 16), C.slate);
    pb.ellipse(8, t + 11, 4, 3, C.ink);
    fire(pb, 5, t + 9, 6, f, on);
    chimney(pb, 6, t - 8, 7, C.slate);
  },
  oven: (pb, W, H, t, f, on) => {
    brickWall(pb, 1, t + 2, W - 2, 14);
    pb.ellipse(W / 2, t + 2, W / 2 - 1, 5, C.brick);
    pb.ellipse(W / 2, t + 10, 6, 4, C.ink);
    fire(pb, W / 2 - 5, t + 9, 10, f, on);
    pb.rect(W / 2 - 7, t + 14, 14, 2, C.slate);
    chimney(pb, W - 9, t - 12, 12);
  },
  cheese_press: (pb, W, H, t, f) => {
    pb.rect(2, t, 2, 16, C.walnut); pb.rect(12, t, 2, 16, C.walnut);
    pb.rect(1, t - 2, 14, 3, C.oak);
    pb.rect(7, t - 8, 2, 12, C.stone);
    pb.rect(4, t - 8 + (f % 2), 8, 2, C.brass);
    pb.ellipse(8, t + 9, 5, 3, C.butter);
    pb.rect(3, t + 12, 10, 4, C.oak);
  },
  hand_loom: (pb, W, H, t, f, on) => {
    pb.rect(1, t - 6, 2, 22, C.walnut); pb.rect(W - 3, t - 6, 2, 22, C.walnut);
    pb.rect(1, t - 7, W - 2, 3, C.oak);
    pb.rect(3, t + 10, W - 6, 4, C.oak);
    for (let x = 4; x < W - 4; x += 2) pb.line(x, t - 4, x, t + 9, x % 4 ? C.cream : C.rose);
    pb.rect(3, t + 2 + (on ? f % 3 : 0), W - 6, 2, C.tan);
  },
  seed_sifter: (pb, W, H, t, f, on) => {
    plankBox(pb, 2, t + 4, 12, 12);
    pb.rect(1, t, 14, 4, C.stone);
    for (let x = 2; x < 14; x += 2) pb.set(x + (on ? f % 2 : 0), t + 1, C.ink);
    pb.rect(5, t + 9, 6, 3, C.walnut);
    pb.set(6, t + 10, C.leaf); pb.set(9, t + 10, C.amber);
  },
  compost_bin: (pb, W, H, t) => {
    pb.rect(2, t + 2, 12, 14, C.walnut);
    for (let x = 2; x < 14; x += 3) pb.rect(x, t + 2, 2, 14, C.oak);
    pb.rect(3, t, 10, 3, C.bark);
    pb.set(5, t + 1, C.leaf); pb.set(9, t + 1, C.grass);
  },
  charcoal_kiln: (pb, W, H, t, f, on) => {
    pb.ellipse(8, t + 10, 7.5, 7, C.walnut);
    pb.ellipse(8, t + 8, 6, 5, C.oak);
    pb.ellipse(8, t + 13, 3, 2, C.ink);
    if (on) pb.rect(6, t + 13, 4, 1, C.terracotta);
    chimney(pb, 6, t - 6, 6, C.stone);
  },
  brick_kiln: (pb, W, H, t, f, on) => {
    pb.ellipse(W / 2, t + 18, 14, 14, C.brick);
    brickWall(pb, 3, t + 12, W - 6, 20);
    pb.ellipse(W / 2, t + 24, 6, 6, C.ink);
    fire(pb, W / 2 - 5, t + 24, 10, f, on);
    chimney(pb, W - 10, t - 14, 16);
  },
  bee_skep: (pb, W, H, t, f) => {
    pb.rect(2, t + 12, 12, 4, C.walnut);
    for (let y = 0; y < 13; y++) {
      const w = Math.round(6 * Math.sqrt(1 - Math.pow((12 - y) / 13, 2)));
      pb.rect(8 - w, t - 2 + y, w * 2, 1, y % 3 === 0 ? C.brass : C.amber);
    }
    pb.ellipse(8, t + 9, 1.5, 1.2, C.ink);
    pb.set(3 + (f % 4), t - 3, C.ink); pb.set(12 - (f % 3), t, C.ink);
  },
  tapper: (pb, W, H, t) => {
    pb.rect(7, t + 7, 2, 2, C.stone);
    pb.rect(5, t + 10, 6, 5, C.oak);
    pb.rect(5, t + 10, 6, 1, C.tan);
    pb.rect(5, t + 12, 6, 1, C.stone);
  },
  fish_trap: (pb, W, H, t) => {
    pb.ellipse(8, t + 9, 6, 5, C.tan);
    for (let x = 3; x < 14; x += 2) pb.line(x, t + 5, x, t + 13, C.oak);
    pb.ellipse(8, t + 5, 4, 1.5, C.walnut);
    pb.rect(2, t + 12, 12, 2, C.river);
  },
  lab: (pb, W, H, t, f, on) => {
    plankBox(pb, 1, t + 10, W - 2, 22, C.walnut);
    pb.rect(0, t + 8, W, 3, C.oak);
    // books
    const bc = [C.rose, C.sky, C.leaf, C.amber, C.violet];
    for (let i = 0; i < 5; i++) pb.rect(3 + i * 3, t - 2 - (i % 2), 3, 10 + (i % 2), bc[i]);
    // globe
    pb.disc(W - 8, t + 2, 4, C.river);
    pb.set(W - 9, t + 1, C.leaf); pb.set(W - 7, t + 3, C.leaf);
    pb.rect(W - 9, t + 6, 2, 2, C.brass);
    // lamp
    pb.rect(W - 16, t + 2, 1, 6, C.brass);
    pb.rect(W - 18, t, 5, 3, on ? C.amber : C.brass);
    // scroll
    pb.rect(4, t + 13, 12, 6, C.cream);
    pb.line(5, t + 15, 14, 15 + t, C.stone);
    pb.line(5, t + 17, 12, 17 + t, C.stone);
  },
  mill: (pb, W, H, t, f, on, s) => {
    plankBox(pb, 2, t + 4, W - 4, H - t - 4, C.oak);
    roofBand(pb, 1, t - 8, W - 2, 12, C.terracotta, s === 3);
    gear(pb, W / 2, t + 14, 6, C.brass, on ? f : 0);
    pb.rect(W / 2 - 3, H - 9, 6, 8, C.walnut);
    pb.rect(4, t + 5, 4, 4, C.stone); pb.rect(W - 8, t + 5, 4, 4, C.stone);
    pb.ellipse(W / 2, t - 14, 4, 4, C.stone);
    pb.rect(W / 2 - 1, t - 14, 2, 8, C.walnut);
  },
  sawmill: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 8, W - 4, H - t - 8, C.walnut);
    pb.rect(1, t + 6, W - 2, 4, C.oak);
    pb.disc(W / 2, t + 4, 8, C.pebble);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + (on ? f * 0.25 : 0);
      pb.set(Math.round(W / 2 + Math.cos(a) * 9), Math.round(t + 4 + Math.sin(a) * 9), C.stone);
    }
    pb.disc(W / 2, t + 4, 2, C.slate);
    pb.rect(3, t + 11, W - 6, 4, C.tan);
    gear(pb, 7, H - 8, 4, C.copper, on ? f : 0);
  },
  steam_loom: (pb, W, H, t, f, on) => {
    pb.rect(2, t, W - 4, H - t, C.walnut);
    pb.rect(2, t, W - 4, 3, C.copper);
    for (let x = 5; x < W - 5; x += 2) pb.line(x, t + 4, x, t + 16, x % 4 ? C.cream : C.sky);
    pb.rect(4, t + 8 + (on ? f % 4 : 0), W - 8, 2, C.brass);
    pb.rect(4, H - 10, W - 8, 6, C.oak);
    chimney(pb, W - 8, t - 14, 14, C.copper);
    gear(pb, 6, t - 4, 3, C.brass, on ? f : 0);
  },
  bottler: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 6, W - 4, H - t - 6, C.copper);
    for (let y = t + 8; y < H; y += 5) brassBand(pb, 2, y, W - 4);
    pb.rect(4, t - 10, 8, 16, C.frost);
    pb.rect(5, t - 6, 6, 11, C.leaf);
    pb.rect(4, t - 12, 8, 2, C.brass);
    for (let i = 0; i < 3; i++) {
      const x = 15 + i * 5;
      pb.rect(x, t - 1, 3, 7, [C.wine, C.amber, C.leaf][(i + (on ? f : 0)) % 3]);
      pb.rect(x + 1, t - 3, 1, 2, C.tan);
    }
    window(pb, W - 12, t + 12, 8, 6, on);
  },
  assembler: (pb, W, H, t, f, on) => {
    pb.rect(1, t + 10, W - 2, H - t - 10, C.walnut);
    pb.rect(0, t + 8, W, 3, C.oak);
    pb.rect(3, t + 14, 6, 6, C.slate);
    gear(pb, W - 9, t + 18, 4, C.copper, on ? f : 0);
    // little arm
    const ang = on ? Math.sin(f * 1.5) * 0.6 : 0;
    pb.rect(W / 2 - 1, t - 6, 2, 14, C.brass);
    pb.line(W / 2, t - 6, Math.round(W / 2 + Math.cos(ang - 0.6) * 9), Math.round(t - 6 + Math.sin(ang + 0.9) * 6), C.copper);
    pb.disc(W / 2, t - 6, 2, C.brass);
    pb.rect(4, t + 2, 6, 6, C.tan);
  },
  assembler_2: (pb, W, H, t, f, on) => {
    pb.rect(1, t + 6, W - 2, H - t - 6, C.copper);
    for (let y = t + 8; y < H; y += 6) brassBand(pb, 1, y, W - 2);
    pb.rect(3, t - 6, W - 6, 12, C.walnut);
    gear(pb, 9, t, 4, C.brass, on ? f : 0);
    gear(pb, W - 9, t + 1, 3, C.brass, on ? -f : 0);
    window(pb, W / 2 - 5, t + 12, 10, 8, on);
    pb.disc(W / 2, t - 10, 2, on ? C.aqua : C.sky);
  },
  blast_furnace: (pb, W, H, t, f, on) => {
    brickWall(pb, 4, t - 12, W - 8, H - t + 12);
    pb.rect(2, t + 10, W - 4, H - t - 10, C.brick);
    brickWall(pb, 2, t + 10, W - 4, H - t - 10);
    pb.rect(W / 2 - 6, t + 16, 12, 10, C.ink);
    fire(pb, W / 2 - 5, t + 21, 10, f, on);
    pb.rect(1, t + 2, 3, 20, C.copper); pb.rect(W - 4, t, 3, 22, C.copper);
    brassBand(pb, 4, t - 4, W - 8);
    pb.rect(W / 2 - 3, t - 22, 6, 10, C.slate);
  },
  crusher: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 8, W - 4, H - t - 8, C.slate);
    pb.rect(2, t + 8, W - 4, 2, C.stone);
    for (let i = 0; i < 4; i++) pb.rect(4 + i * 6, t - 4 + (on && i % 2 === f % 2 ? 2 : 0), 4, 12, C.stone);
    pb.rect(2, t - 6, W - 4, 3, C.brass);
    gear(pb, W - 8, H - 8, 4, C.copper, on ? f : 0);
    pb.rect(5, H - 9, 10, 6, C.ink);
  },
  roaster: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 10, 12, 6, C.slate);
    pb.ellipse(8, t + 4, 6, 6, C.copper);
    pb.rect(2, t + 3, 12, 2, C.brass);
    pb.rect(12, t - 4, 3, 6, C.stone);
    if (on) fire(pb, 4, t + 11, 8, f, on);
  },
  kitchen: (pb, W, H, t, f, on) => {
    pb.rect(1, t + 6, W - 2, H - t - 6, C.copper);
    brassBand(pb, 1, t + 6, W - 2);
    pb.rect(3, t + 12, 12, 10, C.ink);
    fire(pb, 4, t + 18, 10, f, on);
    pb.rect(18, t + 10, 10, 6, C.slate);
    pb.ellipse(23, t + 8, 5, 2, C.stone);
    chimney(pb, W - 8, t - 14, 18, C.copper);
    pb.rect(3, t, 10, 6, C.pebble);
    pb.ellipse(8, t, 5, 2, C.stone);
  },
  harvester: (pb, W, H, t, f, on) => {
    pb.rect(3, t + 10, 10, 6, C.walnut);
    pb.rect(7, t - 10, 2, 22, C.copper);
    const ang = on ? (f % 4) * 0.4 : 0;
    pb.line(8, t - 10, Math.round(8 + Math.cos(ang) * 7), Math.round(t - 10 + Math.sin(ang) * 3 + 4), C.brass);
    pb.rect(Math.round(6 + Math.cos(ang) * 7), Math.round(t - 6 + Math.sin(ang) * 3), 4, 3, C.stone);
    pb.disc(8, t - 11, 2, C.brass);
    pb.rect(4, t + 12, 3, 2, C.leaf);
  },
  planter: (pb, W, H, t, f, on) => {
    pb.rect(3, t + 8, 10, 8, C.oak);
    for (let y = 0; y < 8; y++) pb.rect(1 + y / 2, t - 2 + y, 14 - y, 1, C.copper);
    pb.rect(2, t - 4, 12, 2, C.brass);
    pb.rect(7, t + 14, 2, 2, C.walnut);
    if (on) pb.set(8, t + 15 + (f % 2), C.amber);
  },
  drill_steam: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 6, W - 4, H - t - 6, C.walnut);
    pb.rect(2, t + 6, W - 4, 3, C.oak);
    pb.rect(W / 2 - 5, t - 10, 10, 18, C.slate);
    pb.rect(W / 2 - 5, t - 10, 10, 2, C.stone);
    chimney(pb, W - 9, t - 14, 12, C.slate);
    gear(pb, 8, H - 9, 4, C.copper, on ? f : 0);
    pb.rect(W / 2 - 2, H - 6 + (on ? f % 2 : 0), 4, 5, C.pebble);
  },
  drill_brass: (pb, W, H, t, f, on) => {
    pb.rect(2, t + 6, W - 4, H - t - 6, C.copper);
    for (let y = t + 8; y < H; y += 5) brassBand(pb, 2, y, W - 4);
    pb.rect(W / 2 - 6, t - 12, 12, 20, C.brass);
    pb.disc(W / 2, t - 4, 3, on ? C.aqua : C.river);
    gear(pb, 8, H - 9, 4, C.brass, on ? f : 0);
    pb.rect(W / 2 - 2, H - 6 + (on ? f % 2 : 0), 4, 5, C.pebble);
  },
  sprinkler_1: (pb, W, H, t) => { pb.rect(6, t + 8, 4, 6, C.stone); pb.disc(8, t + 7, 3, C.pebble); pb.set(8, t + 5, C.sky); },
  sprinkler_2: (pb, W, H, t) => { pb.rect(6, t + 8, 4, 6, C.copper); pb.disc(8, t + 6, 3.5, C.brass); pb.set(6, t + 4, C.sky); pb.set(10, t + 4, C.sky); },
  sprinkler_3: (pb, W, H, t) => { pb.rect(6, t + 8, 4, 6, C.brass); pb.disc(8, t + 5, 4, C.amber); pb.disc(8, t + 5, 2, C.aqua); },
  mist_tower: (pb, W, H, t, f, on) => {
    pb.rect(5, t - 14, 6, 30, C.copper);
    for (let y = t - 12; y < H; y += 5) brassBand(pb, 5, y, 6);
    pb.disc(8, t - 16, 4, C.brass);
    pb.disc(8, t - 16, 2, on ? C.aqua : C.river);
  },
  scarecrow: (pb, W, H, t) => {
    pb.rect(7, t - 6, 2, 22, C.walnut);
    pb.rect(2, t, 12, 2, C.walnut);
    pb.rect(4, t - 2, 8, 9, C.sky);
    pb.rect(4, t + 2, 8, 1, C.river);
    pb.disc(8, t - 7, 3.5, C.tan);
    pb.rect(3, t - 11, 10, 2, C.amber); pb.rect(5, t - 13, 6, 3, C.amber);
    pb.set(7, t - 7, C.ink); pb.set(9, t - 7, C.ink);
    pb.set(2, t + 1, C.amber); pb.set(13, t + 1, C.amber);
  },
  lamp: (pb, W, H, t, f, on) => {
    pb.rect(7, t - 8, 2, 23, C.bark);
    pb.rect(5, H - 3, 6, 3, C.slate);
    pb.rect(4, t - 14, 8, 7, C.ink);
    pb.rect(5, t - 13, 6, 5, on ? C.amber : C.stone);
    pb.rect(3, t - 15, 10, 2, C.bark);
  },
  pole_wood: (pb, W, H, t) => {
    pb.rect(7, t - 18, 3, 34, C.walnut);
    pb.rect(7, t - 18, 1, 34, C.oak);
    pb.rect(2, t - 16, 13, 2, C.oak);
    pb.set(3, t - 17, C.copper); pb.set(13, t - 17, C.copper);
  },
  pole_iron: (pb, W, H, t) => {
    pb.line(4, H - 1, 7, t - 18, C.stone); pb.line(12, H - 1, 9, t - 18, C.stone);
    for (let y = t - 14; y < H; y += 5) pb.line(5, y, 11, y + 3, C.slate);
    pb.rect(3, t - 20, 11, 2, C.slate);
    pb.set(3, t - 21, C.copper); pb.set(13, t - 21, C.copper);
  },
  pole_tower: (pb, W, H, t) => {
    pb.line(4, H - 1, 14, t - 38, C.copper); pb.line(W - 4, H - 1, W - 14, t - 38, C.copper);
    for (let y = t - 34; y < H; y += 6) pb.rect(Math.floor(4 + (H - y) * 0.2), y, Math.max(2, W - 8 - Math.floor((H - y) * 0.4)), 1, C.brick);
    pb.rect(8, t - 40, W - 16, 3, C.brass);
    pb.set(9, t - 41, C.aqua); pb.set(W - 10, t - 41, C.aqua);
  },
  waterwheel: (pb, W, H, t, f) => {
    pb.rect(0, t + 10, 6, H - t - 10, C.stone);
    const cx = W / 2 + 2, cy = t + 12, r = 13;
    pb.disc(cx, cy, r, C.walnut);
    pb.disc(cx, cy, r - 3, C.ink);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f * (Math.PI / 16);
      pb.line(cx, cy, Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), C.oak);
      pb.rect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3, C.tan);
    }
    pb.disc(cx, cy, 2.5, C.brass);
  },
  windmill: (pb, W, H, t) => {
    for (let y = t - 22; y < H; y++) {
      const w = Math.floor(6 + (y - (t - 22)) * 0.22);
      pb.rect(W / 2 - w, y, w * 2, 1, (y % 4 === 0) ? C.oak : C.tan);
    }
    pb.rect(W / 2 - 3, H - 8, 6, 8, C.walnut);
    window(pb, W / 2 - 2, t - 4, 4, 5, false);
    roofBand(pb, W / 2 - 8, t - 30, 16, 9, C.terracotta, false);
  },
  steam_engine: (pb, W, H, t, f, on) => {
    pb.ellipse(11, t + 10, 9, 12, C.copper);
    for (let y = t; y < t + 22; y += 5) brassBand(pb, 3, y, 16);
    pb.rect(4, H - 8, 12, 6, C.ink);
    fire(pb, 5, H - 7, 10, f, on);
    chimney(pb, 8, t - 16, 10, C.slate);
    gear(pb, W - 7, t + 14, 6, C.stone, on ? f : 0);
    pb.line(W - 7, t + 14, 16, t + 8 + (on ? (f % 2) * 2 : 0), C.brass);
  },
  sunlens: (pb, W, H, t, f, on) => {
    pb.rect(2, H - 8, W - 4, 7, C.walnut);
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 10;
      pb.rect(x - 1, t + 2, 2, H - t - 8, C.brass);
      pb.disc(x, t + 2, 5, C.brass);
      pb.disc(x, t + 2, 4, on ? C.butter : C.frost);
      pb.set(x - 2, t, C.cream);
    }
  },
  spring_battery: (pb, W, H, t, f, on) => {
    pb.rect(3, t + 10, 10, 6, C.walnut);
    pb.rect(4, t - 4, 8, 15, C.slate);
    for (let y = t - 3; y < t + 10; y += 2) pb.rect(4, y, 8, 1, C.brass);
    pb.rect(3, t - 6, 10, 2, C.copper);
  },
  chest_wood: (pb, W, H, t) => { plankBox(pb, 1, t + 4, 14, 12, C.oak); pb.rect(1, t, 14, 5, C.walnut); pb.rect(1, t, 14, 1, C.oak); pb.rect(7, t + 4, 2, 3, C.brass); brassBand(pb, 1, t + 4, 14); },
  chest_iron: (pb, W, H, t) => { pb.rect(1, t + 4, 14, 12, C.stone); pb.rect(1, t, 14, 5, C.slate); pb.rect(1, t, 14, 1, C.pebble); pb.rect(7, t + 4, 2, 3, C.copper); for (const x of [2, 13]) pb.rect(x, t, 1, 16, C.slate); },
  chest_brass: (pb, W, H, t) => { pb.rect(1, t + 4, 14, 12, C.brass); pb.rect(1, t - 1, 14, 6, C.copper); pb.rect(1, t - 1, 14, 1, C.amber); pb.disc(8, t + 6, 2, C.amber); pb.set(8, t + 6, C.ink); },
  crate_out: (pb, W, H, t) => { plankBox(pb, 1, t + 3, 14, 13, C.tan); pb.rect(1, t, 14, 4, C.rose); pb.disc(8, t + 9, 2.5, C.rose); },
  crate_req: (pb, W, H, t) => { plankBox(pb, 1, t + 3, 14, 13, C.tan); pb.rect(1, t, 14, 4, C.sky); pb.disc(8, t + 9, 2.5, C.sky); },
  crate_store: (pb, W, H, t) => { plankBox(pb, 1, t + 3, 14, 13, C.tan); pb.rect(1, t, 14, 4, C.amber); pb.disc(8, t + 9, 2.5, C.amber); },
  hive: (pb, W, H, t, f, on) => {
    pb.rect(4, H - 6, W - 8, 6, C.walnut);
    for (let i = 0; i < 4; i++) {
      const y = t - 16 + i * 9, w = W - 8 - Math.abs(i - 2) * 4;
      pb.rect(W / 2 - w / 2, y, w, 8, i % 2 ? C.brass : C.amber);
      pb.rect(W / 2 - w / 2, y + 7, w, 1, C.copper);
    }
    pb.ellipse(W / 2, t + 14, 3, 2, C.ink);
    pb.disc(W / 2, t - 18, 3, on ? C.aqua : C.copper);
  },
  shipping_crate: (pb, W, H, t) => { plankBox(pb, 0, t + 3, 16, 13, C.walnut); pb.rect(0, t - 1, 16, 5, C.oak); pb.rect(0, t - 1, 16, 1, C.tan); pb.rect(6, t + 7, 4, 4, C.brass); pb.line(1, t + 4, 14, t + 14, C.bark); },
  silo: (pb, W, H, t, f, on, s) => {
    pb.rect(3, t - 18, W - 6, H - t + 18, C.stone);
    for (let y = t - 16; y < H; y += 4) pb.rect(3, y, W - 6, 1, C.slate);
    pb.ellipse(W / 2, t - 18, W / 2 - 3, 6, s === 3 ? C.cream : C.terracotta);
    pb.rect(W / 2 - 3, H - 10, 6, 10, C.walnut);
  },
  well: (pb, W, H, t) => {
    pb.ellipse(W / 2, t + 22, 12, 7, C.stone);
    pb.ellipse(W / 2, t + 20, 9, 4, C.deepsea);
    pb.rect(5, t - 6, 2, 26, C.walnut); pb.rect(W - 7, t - 6, 2, 26, C.walnut);
    roofBand(pb, 2, t - 10, W - 4, 6, C.terracotta, false);
    pb.rect(W / 2 - 1, t, 2, 10, C.tan);
    pb.rect(W / 2 - 3, t + 8, 6, 4, C.oak);
  },
  freight_depot: (pb, W, H, t, f, on, s) => {
    // a timber freight shed in guild colors, with a loading door and a pennant
    pb.rect(1, t, W - 2, H - t - 1, C.oak);
    for (let x = 1; x < W - 1; x += 4) pb.rect(x, t, 1, H - t - 1, C.walnut);
    pb.rect(1, H - 3, W - 2, 2, C.bark);
    roofBand(pb, 0, t - 14, W, 16, C.wine, s === 3);
    // loading door with cross braces
    const dx = 14, dw = 20, dy = t + 8;
    pb.rect(dx, dy, dw, H - dy - 2, C.walnut);
    pb.line(dx, dy, dx + dw - 1, H - 3, C.bark); pb.line(dx + dw - 1, dy, dx, H - 3, C.bark);
    pb.rect(dx - 1, dy - 1, dw + 2, 1, C.tan);
    // guild sign
    pb.rect(dx + 4, t + 1, 12, 5, C.brass);
    pb.rect(dx + 5, t + 2, 10, 3, C.wine);
    pb.set(dx + 10, t + 3, C.butter);
    // crates stacked by the wall
    pb.rect(3, H - 12, 8, 9, C.tan); pb.line(3, H - 12, 10, H - 4, C.oak); pb.rect(3, H - 12, 8, 1, C.butter);
    pb.rect(W - 11, H - 10, 8, 7, C.tan); pb.line(W - 4, H - 10, W - 11, H - 4, C.oak); pb.rect(W - 11, H - 10, 8, 1, C.butter);
    // pennant on a pole
    pb.rect(W - 8, t - 22, 1, 12, C.bark);
    const wave = f % 2;
    pb.rect(W - 7, t - 22, 6, 2, C.wine); pb.rect(W - 7, t - 20, 4 + wave, 2, C.wine); pb.set(W - 6, t - 21, C.brass);
    void on;
  },
  construction_site: (pb, W, H, t) => {
    pb.rect(0, H - 8, W, 8, C.stone);
    for (let x = 2; x < W; x += 14) pb.rect(x, t - 12, 2, H - t + 4, C.oak);
    for (let y = t - 10; y < H - 8; y += 10) pb.rect(0, y, W, 2, C.walnut);
    pb.line(2, H - 9, W - 2, t - 10, C.tan);
    pb.rect(W / 2 - 6, H - 20, 12, 12, C.brick);
  },
  sign: (pb, W, H, t) => { pb.rect(7, t + 4, 2, 12, C.walnut); pb.rect(1, t - 4, 14, 10, C.oak); pb.rect(2, t - 3, 12, 8, C.tan); },
  flower_pot: (pb, W, H, t, f, on, s) => {
    pb.rect(2, t + 8, 12, 8, C.terracotta);
    pb.rect(2, t + 8, 12, 2, C.apricot);
    if (s !== 3) for (let i = 0; i < 5; i++) { pb.set(3 + i * 2, t + 6, C.moss); pb.disc(3 + i * 2.5, t + 4 - (i % 2) * 2, 1.4, [C.rose, C.butter, C.lavender, C.blush, C.sky][i]); }
  },
  fence_wood: (pb, W, H, t) => { pb.rect(6, t, 4, 16, C.oak); pb.rect(6, t, 4, 1, C.tan); pb.rect(0, t + 5, 16, 2, C.walnut); pb.rect(0, t + 10, 16, 2, C.walnut); },
  fence_stone: (pb, W, H, t) => { pb.rect(0, t + 5, 16, 11, C.stone); for (let i = 0; i < 8; i++) pb.set(Math.floor(hash2(i, 2, 2) * 16), t + 6 + Math.floor(hash2(2, i, 2) * 10), C.slate); pb.rect(0, t + 5, 16, 1, C.pebble); pb.set(3, t + 5, C.moss); pb.set(10, t + 5, C.moss); },
  gate: (pb, W, H, t) => { pb.rect(0, t, 3, 16, C.oak); pb.rect(13, t, 3, 16, C.oak); pb.rect(3, t + 5, 10, 2, C.tan); pb.rect(3, t + 10, 10, 2, C.tan); pb.line(3, t + 12, 12, t + 5, C.walnut); },
};

// farm buildings
function farmBuilding(pb: PixBuf, W: number, H: number, t: number, s: number, tier: number, barn: boolean) {
  const wall = barn ? C.brick : C.tan;
  const roof = barn ? C.slate : C.terracotta;
  pb.rect(1, t, W - 2, H - t, wall);
  for (let x = 1; x < W - 1; x += 4) pb.rect(x, t, 1, H - t, DARK[wall]);
  roofBand(pb, 0, t - (barn ? 22 : 18) + tier, W, (barn ? 24 : 20) - tier, roof, s === 3);
  // big door
  const dw = barn ? 16 : 10;
  pb.rect(W / 2 - dw / 2, H - 16, dw, 16, C.walnut);
  pb.line(W / 2 - dw / 2, H - 16, W / 2 + dw / 2 - 1, H - 1, C.bark);
  pb.line(W / 2 + dw / 2 - 1, H - 16, W / 2 - dw / 2, H - 1, C.bark);
  pb.rect(W / 2 - dw / 2 - 1, H - 17, dw + 2, 1, C.cream);
  window(pb, 6, t + 6, 8, 7, false);
  window(pb, W - 14, t + 6, 8, 7, false);
  // feeder hopper
  pb.rect(W - 10, H - 9, 8, 8, C.oak);
  pb.rect(W - 10, H - 9, 8, 2, C.amber);
  if (tier >= 2) { pb.rect(4, H - 7, 5, 6, C.copper); pb.rect(4, H - 7, 5, 1, C.brass); }
  if (tier >= 3) gear(pb, W / 2, t - 6, 3, C.brass, 0);
}
for (let tier = 1; tier <= 3; tier++) {
  ART['coop_' + tier] = (pb, W, H, t, f, on, s) => farmBuilding(pb, W, H, t, s, tier, false);
  ART['barn_' + tier] = (pb, W, H, t, f, on, s) => farmBuilding(pb, W, H, t, s, tier, true);
}

export function structSize(id: string, rot: number): { W: number; H: number; top: number } {
  const def = STRUCT_BY_ID.get(id)!;
  let [w, h] = def.size;
  if (def.kind !== 'splitter' && (rot === 1 || rot === 3)) [w, h] = [h, w];
  const top = EXTRA_TOP[id] ?? 4;
  return { W: w * 16, H: h * 16 + top, top };
}

function drawStruct(id: string, frame: number, on: boolean, season: number): PixBuf {
  const { W, H, top } = structSize(id, 0);
  const pb = new PixBuf(W, H);
  const art = ART[id];
  if (art) art(pb, W, H, top, frame, on, season);
  else {
    plankBox(pb, 1, top, W - 2, H - top - 1);
    gear(pb, W / 2, top + (H - top) / 2, 4, C.brass, frame);
  }
  pb.outline(C.ink);
  return pb;
}

// ---------- belts ----------
const BELT_COLORS = [
  { rail: C.walnut, rail2: C.oak, surf: C.tan, stripe: C.oak, mark: C.cream },
  { rail: C.copper, rail2: C.brass, surf: C.walnut, stripe: C.bark, mark: C.amber },
  { rail: C.brass, rail2: C.butter, surf: C.wine, stripe: C.plum, mark: C.blush },
];

/** local frame heading north; rotate pixel coordinates by rot */
function rotPx(x: number, y: number, rot: number): [number, number] {
  for (let r = 0; r < rot; r++) [x, y] = [15 - y, x];
  return [x, y];
}

function drawBelt(tier: number, rot: number, curve: number, frame: number): PixBuf {
  const pb = new PixBuf(16, 16);
  const col = BELT_COLORS[tier - 1];
  const put = (x: number, y: number, c: number) => {
    const [rx, ry] = rotPx(x, y, rot);
    pb.set(rx, ry, c);
  };
  if (curve === 0) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let c = col.surf;
        if (x <= 1 || x >= 14) c = x === 0 || x === 15 ? col.rail : col.rail2;
        else if ((y + frame * 2) % 8 === 0) c = col.stripe;
        else if ((y + frame * 2) % 8 === 4 && (x === 7 || x === 8)) c = col.mark;
        if ((x === 0 || x === 15) && (y + frame) % 4 === 0) c = C.ink;
        put(x, y, c);
      }
  } else {
    // quarter ring centered at the corner (0,0) for curve-from-left, (16,0) for curve-from-right
    const cx = curve === 1 ? 0 : 16;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5);
        if (d > 16) continue;
        let c = col.surf;
        if (d < 2 || d > 14) c = d < 1 || d > 15 ? col.rail : col.rail2;
        else {
          const ang = Math.atan2(y + 0.5, curve === 1 ? x + 0.5 : cx - x - 0.5);
          const s = Math.floor((ang / (Math.PI / 2)) * 16 - frame * 2 + 64) % 8;
          if (s === 0) c = col.stripe;
        }
        put(x, y, c);
      }
  }
  return pb;
}

function drawUnder(tier: number, rot: number, isIn: boolean, frame: number): PixBuf {
  const pb = drawBelt(tier, rot, 0, frame);
  const col = BELT_COLORS[tier - 1];
  const put = (x: number, y: number, c: number) => {
    const [rx, ry] = rotPx(x, y, rot);
    pb.set(rx, ry, c);
  };
  // hood over the tunnel end: entrance hood at the front (top), exit hood at the back
  const y0 = isIn ? 0 : 7, y1 = isIn ? 9 : 16;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < 16; x++) {
      let c = col.rail;
      if (x > 1 && x < 14) c = (isIn ? y < 2 : y > 13) ? C.ink : y % 3 === 0 ? DARK[col.rail] : col.rail2;
      put(x, y, c);
    }
  for (let x = 3; x < 13; x++) put(x, isIn ? 8 : 7, C.ink);
  return pb;
}

function drawSplitter(tier: number, frame: number): PixBuf {
  const pb = new PixBuf(32, 16);
  const col = BELT_COLORS[tier - 1];
  pb.rect(1, 4, 30, 9, col.rail2);
  pb.rect(1, 4, 30, 2, LIGHT[col.rail2]);
  pb.rect(1, 12, 30, 1, col.rail);
  gear(pb, 16, 8, 3, C.brass, frame);
  pb.rect(4, 6, 6, 4, C.ink);
  pb.rect(22, 6, 6, 4, C.ink);
  pb.set(7, 7, C.aqua);
  pb.set(25, 7, C.aqua);
  pb.outline(C.ink);
  return pb;
}

/** Arm base: armb:<id> */
function drawArmBase(id: string): PixBuf {
  const pb = new PixBuf(16, 16);
  const col = id === 'arm_basic' ? C.oak : id === 'arm_fast' ? C.copper : id === 'arm_long' ? C.rose : id === 'arm_filter' ? C.violet : C.sky;
  pb.ellipse(8, 9, 5.5, 4.5, C.slate);
  pb.ellipse(8, 8, 4.5, 3.5, col);
  pb.disc(8, 8, 2, C.brass);
  pb.set(8, 8, C.ink);
  pb.outline(C.ink);
  return pb;
}

/** Megaproject monuments (64x~110), drawn over the 4x4 site. stage: 0..n, done = finished look. */
function drawMega(id: string, progress: number, frame: number): PixBuf {
  const W = 64, H = 112, top = H - 64;
  const pb = new PixBuf(W, H);
  const done = progress >= 1;
  // shared plinth
  pb.rect(2, H - 10, W - 4, 10, C.stone);
  pb.rect(2, H - 10, W - 4, 2, C.pebble);
  for (let x = 4; x < W - 4; x += 6) pb.rect(x, H - 7, 1, 6, C.slate);
  const levels = Math.ceil(progress * 4);
  if (id === 'm_orrery') {
    pb.rect(W / 2 - 3, top - 30, 6, H - top + 20, C.brass);
    pb.rect(W / 2 - 3, top - 30, 2, H - top + 20, C.amber);
    if (levels >= 2 || done) for (let r = 0; r < 3; r++) {
      const rad = 14 + r * 7;
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        pb.set(W / 2 + Math.cos(t) * rad, top - 18 + Math.sin(t) * rad * 0.35, r % 2 ? C.copper : C.brass);
      }
    }
    if (levels >= 3 || done) {
      const planets: [number, number, number][] = [[0.3, 14, C.rose], [1.6, 21, C.sky], [3.6, 28, C.amber]];
      for (const [ph, rad, col] of planets) {
        const t = ph + frame * 0.2;
        pb.disc(W / 2 + Math.cos(t) * rad, top - 18 + Math.sin(t) * rad * 0.35, 3, col);
      }
    }
    if (done) { pb.disc(W / 2, top - 34, 5, C.butter); pb.disc(W / 2, top - 34, 3, C.cream); }
  } else if (id === 'm_skyship') {
    for (let y = top - 10; y < H - 10; y++) {
      const w = 6 + Math.floor((y - top + 10) * 0.12);
      pb.rect(W / 2 - w, y, 2, 1, C.walnut);
      pb.rect(W / 2 + w - 2, y, 2, 1, C.walnut);
      if (y % 6 === 0) pb.rect(W / 2 - w, y, w * 2, 1, C.oak);
    }
    if (levels >= 2 || done) { pb.ellipse(W / 2, top - 30, 24, 12, C.cream); pb.ellipse(W / 2, top - 32, 20, 8, C.pebble); for (let x = 10; x < W - 10; x += 8) pb.line(x, top - 38, x, top - 22, C.tan); }
    if (levels >= 3 || done) { pb.rect(W / 2 - 10, top - 16, 20, 6, C.copper); pb.rect(W / 2 - 10, top - 16, 20, 1, C.brass); pb.line(W / 2 - 14, top - 24, W / 2 - 8, top - 16, C.ink); pb.line(W / 2 + 14, top - 24, W / 2 + 8, top - 16, C.ink); }
    if (done) for (let i = 0; i < 5; i++) pb.set(10 + i * 10 + (frame % 2), top - 44, [C.rose, C.amber, C.sky, C.leaf, C.lavender][i]);
  } else {
    // lighthouse beacon
    for (let y = top - 36; y < H - 10; y++) {
      const w = 7 + Math.floor((y - top + 36) * 0.08);
      pb.rect(W / 2 - w, y, w * 2, 1, Math.floor(y / 8) % 2 ? C.cream : C.rose);
    }
    pb.rect(W / 2 - 9, top - 46, 18, 10, levels >= 2 || done ? C.frost : C.slate);
    pb.rect(W / 2 - 11, top - 48, 22, 3, C.brass);
    pb.ellipse(W / 2, top - 52, 8, 4, C.copper);
    if (done) { pb.disc(W / 2, top - 41, 4, frame % 2 ? C.butter : C.lavender); }
  }
  // scaffolding while unfinished
  if (!done) {
    for (let x = 4; x < W - 2; x += 14) pb.rect(x, top - 40 + Math.floor((1 - progress) * 30), 2, H - top + 30, C.oak);
    for (let y = top - 30; y < H - 10; y += 12) pb.rect(2, y, W - 4, 2, C.walnut);
  }
  pb.outline(C.ink);
  return pb;
}

export function registerStructSprites() {
  defSpriteFamily('mega:', (name) => {
    const [, id, ps, fs] = name.split(':');
    return { w: 64, h: 112, ox: 0, oy: 112 - 64, draw: (ctx) => drawMega(id, +ps / 8, +fs).drawTo(ctx) };
  });
  // st:<id>:<frame>:<on>:<season>
  defSpriteFamily('st:', (name) => {
    const [, id, fs, os, ss] = name.split(':');
    if (!STRUCT_BY_ID.has(id)) return null;
    const { W, H, top } = structSize(id, 0);
    return { w: W, h: H, ox: 0, oy: top, draw: (ctx) => drawStruct(id, +fs, os === '1', +ss).drawTo(ctx) };
  });
  defSpriteFamily('belt:', (name) => {
    const [, ts, rs, cs, fs] = name.split(':');
    return { w: 16, h: 16, draw: (ctx) => drawBelt(+ts, +rs, +cs, +fs).drawTo(ctx) };
  });
  defSpriteFamily('ug:', (name) => {
    const [, ts, rs, is, fs] = name.split(':');
    return { w: 16, h: 16, draw: (ctx) => drawUnder(+ts, +rs, is === '1', +fs).drawTo(ctx) };
  });
  defSpriteFamily('split:', (name) => {
    const [, ts, fs] = name.split(':');
    return { w: 32, h: 16, draw: (ctx) => drawSplitter(+ts, +fs).drawTo(ctx) };
  });
  defSpriteFamily('armb:', (name) => ({ w: 16, h: 16, draw: (ctx) => drawArmBase(name.slice(5)).drawTo(ctx) }));
}

/** Icon for a structure item: its art scaled into 16x16. */
export function structIcon(id: string, ctx: CanvasRenderingContext2D) {
  const def = STRUCT_BY_ID.get(id)!;
  let s;
  if (def.kind === 'belt') s = sprite(`belt:${def.tier}:0:0:0`);
  else if (def.kind === 'underground') s = sprite(`ug:${def.tier}:0:1:0`);
  else if (def.kind === 'splitter') s = sprite(`split:${def.tier}:0`);
  else if (def.kind === 'arm') {
    const b = sprite(`armb:${id}`);
    ctx.drawImage(b.img, b.x, b.y, 16, 16, 0, 2, 16, 16);
    ctx.fillStyle = '#1a1220';
    ctx.fillRect(7, 1, 3, 8);
    ctx.fillStyle = '#d9a440';
    ctx.fillRect(8, 2, 1, 7);
    ctx.fillRect(6, 1, 5, 2);
    return;
  } else s = sprite(`st:${id}:0:0:1`);
  const sc = Math.min(16 / s.w, 16 / s.h, 1);
  const w = Math.max(1, Math.round(s.w * sc)), h = Math.max(1, Math.round(s.h * sc));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, s.x, s.y, s.w, s.h, Math.floor((16 - w) / 2), Math.floor((16 - h) / 2), w, h);
}

export { drawSprite };
