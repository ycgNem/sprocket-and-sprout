// Which art each structure uses and how it animates. Coordinates are in the source canvas
// (e.g. 42x42 for the 2x2 machines); `node art/factory/gen/inspect.mjs <png> out.png 9 --snap`
// draws that grid. Modes: 'anim' (off + 4 working frames, default), 'static' (one frame for all),
// 'always' (frames 0-3 whatever the on flag, e.g. the water wheel).
//
//   src     base image (art/factory/…)
//   anim    { dir, masks }: PixelLab v3 working frames, only the mask rects are taken from them
//   fx      scripted effects (gen/fx.mjs), applied to the off frame (f = -1) and each working frame
//   edit    (im) => void, fixes on the base before anything else
//   seasons { 3: (offFrame) => image } extra art for one season (e.g. winter)
import { Img } from './lib.mjs';
import { FIRE } from './fx.mjs';

const fireOff = (rect) => ({ t: 'fire', rect, offOnly: true });

/** winter: the topmost opaque pixels of each column above row y1 turn to snow (2 px deep, lit) */
export function snowRoof(im, y0, y1, x0 = 0, x1 = im.w - 1) {
  const SNOW = ['#c7dcd0', '#9babb2'];
  for (let x = x0; x <= x1; x++) {
    let y = y0;
    while (y < y1 && !im.get(x, y)) y++;
    if (y >= y1) continue;
    // keep the outline pixel on top, snow under it
    const top = im.get(x, y) === '#2e222f' ? y + 1 : y;
    for (let k = 0; k < 2; k++) if (im.get(x, top + k) && im.get(x, top + k) !== '#2e222f') im.set(x, top + k, SNOW[k]);
  }
  return im;
}
const noWhite = (im) => im.recolor({ '#ffffff': '#fdcbb0' });

/** repeat the pixel rows [y0, y1) `times` more times below themselves (makes a tower taller);
 *  everything under the band moves down, so the canvas needs that much empty space at the bottom */
export function repeatRows(im, y0, y1, times) {
  const band = y1 - y0, k = band * times;
  const src = im.clone();
  for (let y = im.h - 1; y >= y1 + k; y--) for (let x = 0; x < im.w; x++) im.px[y * im.w + x] = src.get(x, y - k);
  for (let y = y1; y < y1 + k; y++) for (let x = 0; x < im.w; x++) im.px[y * im.w + x] = src.get(x, y0 + ((y - y1) % band));
  return im;
}

/** recolor inside a rect (base edits) */
export function recolorRect(im, [x0, y0, w, h], map) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = im.get(x, y); if (c && map[c]) im.set(x, y, map[c]); }
  return im;
}

/** paint pixels: [[x, y, color], …] */
export function paint(im, px) { for (const [x, y, c] of px) im.set(x, y, c); return im; }

/** delete whole pixel columns (to narrow a sprite along plain panels); keeps the canvas width */
export function dropCols(im, cols) {
  const keep = [...Array(im.w).keys()].filter((x) => !cols.includes(x));
  const o = new Img(im.w, im.h);
  keep.forEach((sx, dx) => { for (let y = 0; y < im.h; y++) o.set(dx + Math.floor(cols.length / 2), y, im.get(sx, y)); });
  im.px = o.px;
  return im;
}

/** winter: roof colors inside rect turn to snow by lightness, except the eaves rows at the bottom */
export function snowCover(im, rect, map = { '#6e2727': '#9babb2', '#ae2334': '#c7dcd0', '#ea4f36': '#c7dcd0', '#45293f': '#7f708a', '#9e4539': '#9babb2', '#7a3045': '#7f708a', '#831c5d': '#7f708a', '#c32454': '#c7dcd0', '#e83b3b': '#c7dcd0', '#b33831': '#9babb2' }, eaves = 2) {
  const [x0, y0, w, h] = rect;
  for (let x = x0; x < x0 + w; x++) {
    // lowest roof row in this column, to keep its eaves
    let low = -1;
    for (let y = y0; y < y0 + h; y++) if (map[im.get(x, y)]) low = y;
    for (let y = y0; y < y0 + h; y++) { const c = im.get(x, y); if (map[c] && y <= low - eaves) im.set(x, y, map[c]); }
  }
  return im;
}

export const SPECS = {
  blast_furnace: {
    smoke: [20, 1],
    src: 'raw/anim/blast/base.png',
    anim: { dir: 'raw/anim/blast', masks: [[17, 29, 10, 9]] },
    fx: [fireOff([17, 29, 10, 9])],
  },
  sawmill: {
    src: 'raw/anim/sawmill/base.png',
    anim: { dir: 'raw/anim/sawmill', masks: [[30, 24, 12, 14], [10, 28, 20, 9]] },
    overhang: 1,
  },
  crusher: {
    src: 'raw/anim/crusher/base.png',
    anim: { dir: 'raw/anim/crusher', masks: [[18, 20, 16, 12]] },
    overhang: 1,
  },
  steam_engine: {
    smoke: [20, 1],
    src: 'raw/anim/steam_engine/base.png',
    anim: { dir: 'raw/anim/steam_engine', masks: [[22, 23, 17, 17], [5, 21, 8, 12]] },
    overhang: 1,
  },
  mill: {
    src: 'raw/anim/mill/base.png',
    anim: { dir: 'raw/anim/mill', masks: [[5, 23, 26, 16]] },
    overhang: 1,
    // snow on the roof in winter
    seasons: { 3: (im) => snowCover(im, [0, 0, 42, 22]) },
  },
  steam_loom: {
    smoke: [29, 16],
    src: 'raw/anim/steam_loom/base.png',
    anim: { dir: 'raw/anim/steam_loom', masks: [[3, 5, 23, 32]] },
    overhang: 1,
  },
  bottler: {
    src: 'raw/anim/bottler/base.png',
    anim: { dir: 'raw/anim/bottler', masks: [[10, 2, 17, 15]] },
  },
  assembler_2: {
    src: 'raw/anim/assembler_2/base.png',
    anim: { dir: 'raw/anim/assembler_2', masks: [[10, 20, 21, 18]] },
    // the porthole is dark when idle and pulses while it works
    fx: [
      { t: 'recolor', rect: [11, 10, 11, 11], map: { '#8ff8e2': '#0b5e65', '#30e1b9': '#0b5e65', '#0eaf9b': '#323353', '#c7dcd0': '#0b8a8f', '#ffffff': '#0b8a8f', '#9babb2': '#0b5e65' }, frames: [-1] },
      { t: 'recolor', rect: [11, 10, 11, 11], map: { '#30e1b9': '#8ff8e2', '#0eaf9b': '#30e1b9' }, frames: [1, 3] },
    ],
  },
  drill_steam: {
    smoke: [34, 22],
    src: 'raw/anim/drill_steam/base.png',
    anim: { dir: 'raw/anim/drill_steam', masks: [[18, 29, 8, 12], [29, 22, 10, 18]] },
  },
  waterwheel: {
    // turns whenever it touches the river (frames 0-3 whatever the on flag)
    src: 'raw/anim/waterwheel/base.png', mode: 'always',
    anim: { dir: 'raw/anim/waterwheel', masks: [[7, 8, 33, 24]] },
    edit: (im) => im.recolor({ '#9babb2': '#ab947a', '#7f708a': '#966c6c' }),
  },
  brick_kiln: {
    smoke: [20, 2],
    src: 'raw/anim/brick_kiln/base.png',
    anim: { dir: 'raw/anim/brick_kiln', masks: [[14, 25, 15, 10]] },
    fx: [{ t: 'fire', rect: [14, 25, 15, 10], offOnly: true }],
  },
  windmill: {
    // tower from PixelLab, sails drawn on top (the renderer no longer draws sails over imported art)
    src: 'raw/E/39.png',
    // the tower is stretched by repeating the plank band under the window, so it stands ~3 tiles tall
    pad: [6, 4, 6, 12], edit: (im) => repeatRows(im, 30, 35, 2),
    fx: [{ t: 'sails', cx: 33.5, cy: 18.5, r: 14.5 }],
  },
  assembler: {
    src: 'raw/anim/assembler/base.png',
    anim: { dir: 'raw/anim/assembler', masks: [[6, 0, 32, 13]] },
    edit: noWhite,
  },

  // ---------------- 1x1 machines (batch G at 21 px, D at 24 px), scripted working frames ----------------
  furnace: {
    smoke: [10, 1],
    src: 'raw/G/38.png', overhang: 1,
    // signature: the mouth always glows (embers when idle, flames when working)
    fx: [{ t: 'fire', rect: [7, 14, 7, 4], ember: { '#fbff86': '#ea4f36', '#f9c22b': '#ea4f36', '#fbb954': '#b33831', '#f79617': '#b33831', '#fb6b1d': '#b33831', '#ea4f36': '#6e2727', '#c7dcd0': '#ea4f36' } }, { t: 'flames', x0: 8, x1: 12, y: 15 }],
  },
  cheese_press: {
    src: 'raw/G/1.png', overhang: 1,
    // signature: a pale cream cheese wheel
    edit: (im) => recolorRect(im, [6, 9, 10, 6], { '#f9c22b': '#fdcbb0', '#fbb954': '#fdcbb0', '#f79617': '#fca790', '#cd683d': '#e6904e' }),
    // the press head screws down onto the cheese
    fx: [{ t: 'move', rect: [5, 1, 12, 9], dy: [0, 1, 1, 0] }],
  },
  seed_sifter: {
    src: 'raw/G/5.png', overhang: 1,
    // signature: a green sieve mesh
    edit: (im) => recolorRect(im, [3, 1, 16, 9], { '#fbb954': '#91db69', '#f9c22b': '#cddf6c', '#e6904e': '#1ebc73', '#cd683d': '#239063' }),
    fx: [{ t: 'move', rect: [3, 1, 16, 9], dx: [0, 1, 0, -1] }],
  },
  compost_bin: {
    src: 'raw/G/6.png', pad: [0, 4, 0, 0],
    // signature: fresh green scraps on dark soil (coordinates include the 4 px top pad)
    edit: (im) => recolorRect(im, [5, 7, 12, 5], { '#e6904e': '#91db69', '#cd683d': '#1ebc73', '#9e4539': '#239063', '#d5e04b': '#cddf6c', '#f9c22b': '#cddf6c' }),
    fx: [{ t: 'bubbles', rect: [5, 7, 12, 4], c: '#91db69', n: 3 }, { t: 'steam', x: 11, y: 5 }],
  },
  charcoal_kiln: {
    smoke: [9, 1],
    src: 'raw/G/48.png', overhang: 1,
    // signature: the dome smoulders, its joints glow red and pulse while it bakes
    edit: (im) => recolorRect(im, [2, 1, 17, 11], { '#6e2727': '#ae2334' }),
    fx: [{ t: 'glowfill', rect: [7, 12, 7, 6] }, { t: 'recolor', rect: [2, 1, 17, 11], map: { '#ae2334': '#ea4f36' }, frames: [1, 3] }],
  },
  bee_skep: {
    src: 'raw/G/51.png', overhang: 1,
    fx: [{ t: 'bees', pts: [[[13, 13], [14, 11], [15, 13], [14, 15]], [[5, 11], [4, 13], [5, 15], [6, 12]], [[10, 9], [8, 8], [11, 7], [12, 9]]] }],
  },
  roaster: {
    src: 'raw/G/56.png',
    // signature: a red enamel drum
    edit: (im) => recolorRect(im, [4, 1, 11, 14], { '#9e4539': '#ae2334', '#cd683d': '#e83b3b', '#e6904e': '#f68181' }),
    fx: [{ t: 'fire', rect: [7, 15, 5, 2] }, { t: 'move', rect: [15, 8, 5, 5], dy: [0, -1, 0, 1] }],
  },
  harvester: {
    src: 'raw/G/57.png', overhang: 1,
    // signature: a green sprout held in the claw
    edit: (im) => paint(im, [[16, 12, '#239063'], [17, 12, '#1ebc73'], [16, 11, '#91db69']]),
    fx: [{ t: 'move', rect: [14, 7, 6, 7], dy: [0, 1, 2, 1] }, { t: 'paint', px: [[16, 7, '#45293f'], [16, 8, '#45293f']], frames: [1, 2, 3] }],
  },
  planter: {
    src: 'raw/G/4.png',
    // signature: green seeds heaped in the hopper
    edit: (im) => recolorRect(im, [6, 1, 9, 3], { '#6e2727': '#239063', '#9e4539': '#1ebc73', '#cd683d': '#91db69', '#b33831': '#239063', '#ea4f36': '#91db69' }),
    fx: [{ t: 'bubbles', rect: [7, 2, 7, 3], c: '#91db69', n: 3 }],
  },
  keg: {
    src: 'raw/D/7.png',
    // signature: a brass-rimmed porthole of purple wine, brass fittings
    edit: (im) => paint(im.recolor({ '#966c6c': '#f79617', '#ab947a': '#f9c22b' }), [
      [10, 4, '#2e222f'], [11, 4, '#f9c22b'], [12, 4, '#f9c22b'], [13, 4, '#2e222f'],
      [10, 5, '#f79617'], [11, 5, '#a884f3'], [12, 5, '#905ea9'], [13, 5, '#cd683d'],
      [10, 6, '#f79617'], [11, 6, '#905ea9'], [12, 6, '#6b3e75'], [13, 6, '#cd683d'],
      [10, 7, '#2e222f'], [11, 7, '#cd683d'], [12, 7, '#cd683d'], [13, 7, '#2e222f']]),
    fx: [{ t: 'drip', x: 11, y0: 15, len: 3, c: '#905ea9', c2: '#6b3e75' }, { t: 'recolor', rect: [11, 5, 2, 2], map: { '#a884f3': '#eaaded', '#905ea9': '#a884f3' }, frames: [1, 3] }],
  },
  jar: {
    src: 'raw/D/5.png',
    // signature: bright raspberry jam behind the glass
    edit: (im) => recolorRect(im, [8, 8, 10, 11], { '#7a3045': '#c32454', '#45293f': '#831c5d', '#ea4f36': '#f04f78' }),
    fx: [{ t: 'bubbles', rect: [9, 9, 7, 8], c: '#f68181', n: 3 }],
  },

  // ---------------- batch H (34 px): 2x1 machines, compact 2x2, lamp, mist tower ----------------
  oven: {
    smoke: [16, 1],
    src: 'raw/H/50.png',
    fx: [{ t: 'fire', rect: [11, 15, 11, 8] }, { t: 'fire', rect: [11, 26, 11, 5] }],
  },
  hand_loom: {
    src: 'raw/H/1.png',
    // the shuttle bar beats down the weft, the cloth behind continues
    fx: [{ t: 'move', rect: [10, 18, 17, 6], dy: [0, -1, -2, -1], fill: 'edge' }],
  },
  kitchen: {
    smoke: [22, 2],
    src: 'raw/H/41.png',
    fx: [{ t: 'fire', rect: [14, 22, 12, 6] }, { t: 'steam', x: 11, y: 8 }],
  },
  lab: {
    src: 'raw/H/40.png',
    // research lights the oil lamp; the globe turns while it works
    fx: [
      { t: 'light', rect: [19, 13, 4, 7], colors: ['#f9c22b', '#fbb954', '#f79617', '#fbff86'], off: { '#f9c22b': '#cd683d', '#fbb954': '#cd683d', '#f79617': '#9e4539', '#fbff86': '#e6904e' } },
      { t: 'scroll', rect: [23, 7, 6, 6], axis: 'x' },
    ],
  },
  sunlens: {
    src: 'raw/H/42.png',
    // lenses turn golden while they gather sun, a glint sweeps across each
    fx: [
      { t: 'recolor', rect: [0, 0, 34, 22], map: { '#9babb2': '#fbb954', '#c7dcd0': '#fbff86', '#7f708a': '#f79617', '#ffffff': '#fbff86' }, frames: [0, 1, 2, 3] },
      { t: 'glint', rect: [5, 13, 6, 6] }, { t: 'glint', rect: [13, 7, 6, 6] }, { t: 'glint', rect: [24, 13, 6, 6] },
    ],
  },
  hive: {
    src: 'raw/B/16.png',
    fx: [
      { t: 'blink', px: [[19, 2], [20, 2]], on: ['#fbff86', '#f9c22b'], off: '#9e4539' },
      { t: 'bees', pts: [[[30, 12], [32, 15], [30, 18], [28, 14]], [[10, 20], [8, 17], [11, 15], [12, 18]], [[24, 6], [26, 8], [23, 9], [21, 7]]] },
    ],
  },
  drill_brass: {
    src: 'raw/H/48.png',
    fx: [
      { t: 'scroll', rect: [14, 24, 6, 9], axis: 'y' },
      { t: 'recolor', rect: [10, 1, 14, 10], map: { '#9babb2': '#fbb954', '#c7dcd0': '#fbff86', '#ffffff': '#fbff86', '#7f708a': '#f79617' }, frames: [0, 2] },
      { t: 'recolor', rect: [10, 1, 14, 10], map: { '#9babb2': '#f79617', '#c7dcd0': '#fbb954', '#ffffff': '#fbff86', '#7f708a': '#cd683d' }, frames: [1, 3] },
    ],
  },
  lamp: {
    src: 'raw/H/4.png',
    fx: [{ t: 'light', rect: [8, 12, 6, 8], colors: ['#f9c22b', '#fbb954', '#f79617', '#fbff86', '#e6904e'], off: { '#f9c22b': '#9e4539', '#fbb954': '#9e4539', '#f79617': '#7a3045', '#fbff86': '#cd683d', '#e6904e': '#7a3045' } }],
  },
  mist_tower: {
    src: 'raw/H/21.png', pad: [0, 3, 0, 0],
    fx: [{ t: 'mist', cx: 16, cy: 5 }],
  },

  // ---------------- storage and props (one frame) ----------------
  // small plain wooden chest (tier 1), bigger strapped iron chest (tier 2), gold vault (tier 3)
  chest_wood: { src: 'raw/A/2.png', mode: 'static' },
  chest_iron: { src: 'raw/G/37.png', mode: 'static', edit: (im) => dropCols(im, [2, 3, 17, 18]).recolor({ '#323353': '#3e3546', '#484a77': '#625565', '#4d65b4': '#625565', '#4d9be6': '#7f708a' }) },
  chest_brass: { src: 'raw/G/63.png', mode: 'static', overhang: 2 },
  crate_out: { src: 'raw/G/34.png', mode: 'static', overhang: 1 },
  crate_req: { src: 'raw/G/35.png', mode: 'static', overhang: 1 },
  crate_store: { src: 'raw/G/36.png', mode: 'static', overhang: 1 },
  sign: { src: 'raw/A/17.png', mode: 'static' },
  flower_pot: {
    src: 'raw/A/18.png', mode: 'static',
    // winter: the blooms are gone, a dusting of snow on the soil
    seasons: { 3: (im) => im.recolor({ '#fb6b1d': '#c7dcd0', '#b33831': '#9babb2', '#c32454': '#9babb2', '#e83b3b': '#c7dcd0', '#91db69': '#547e64', '#1ebc73': '#547e64', '#239063': '#374e4a', '#cddf6c': '#c7dcd0', '#fbb954': '#c7dcd0' }) },
  },
  fish_pond: {
    // the renderer draws the school swimming around (24, 26) of the footprint
    src: 'raw/P/9.png', mode: 'static',
    // winter: the water freezes over, the lily pads go dull
    seasons: { 3: (im) => im.recolor({ '#4d9be6': '#8fd3ff', '#4d65b4': '#9babb2', '#9babb2': '#c7dcd0', '#a2a947': '#92a984', '#676633': '#547e64', '#ed8099': '#c7dcd0', '#cf657f': '#9babb2', '#0b5e65': '#7f708a' }) },
  },
  sprinkler_1: { src: 'raw/G/45.png', mode: 'static' },
  sprinkler_2: { src: 'raw/G/43.png', mode: 'static' },
  sprinkler_3: { src: 'raw/G/44.png', mode: 'static' },
  spring_battery: { src: 'raw/D/6.png', mode: 'static' },
  tapper: { src: 'raw/G/46.png', mode: 'static' },
  fish_trap: { src: 'raw/A/36.png', mode: 'static' },
  scarecrow: { src: 'raw/G/9.png', mode: 'static', overhang: 1 },
  fence_wood: { src: 'props/fence_wood.png', mode: 'static' },
  fence_stone: { src: 'props/fence_stone.png', mode: 'static' },
  gate: { src: 'props/gate.png', mode: 'static' },
  path_stone: { src: 'props/path_stone.png', mode: 'static' },
  path_brick: { src: 'props/path_brick.png', mode: 'static' },
  path_wood: { src: 'props/path_wood.png', mode: 'static' },
  pole_wood: { src: 'props/pole_wood.png', mode: 'static' },
  pole_iron: { src: 'props/pole_iron.png', mode: 'static' },
  pole_tower: { src: 'props/pole_tower.png', mode: 'static' },

  // ---------------- bumblebot: bot:<frame>, wings flapping ----------------
  bot: {
    kind: 'bot', src: 'raw/A/48.png',
    frame: [16, 14, 0], origin: [8, 14],
    fx: [{ t: 'move', rect: [1, 2, 10, 5], dy: [0, 1, 2, 1] }],
  },
};

export { Img, FIRE };
