// The Harbor's export warehouse, rebuilt as a grand works (2.1.2, the critic: "a small shed for a
// 30,000-coin project"): harbor:warehouse:<0 derelict | 1 restored>[:winter]. One PixelLab pick
// (raw/grand/a3.png: create_image_pro 80x120, Resurrect 64, styled on the old warehouse, the workshop
// and the clocktower; raw/batches.json) fitted to the 4x3-tile footprint and given its states by
// rule, so all four frames share one silhouette (STYLE.md, "Restored vs. derelict").
//
// Frame 80x120, origin (7, 72): the footprint (64x48) is frame x 7..70, rows 72..119. Three storeys
// over the cargo doors, the crane built into the west end of the roof (its jib and rope hang out
// over the pier, 70 px up), a cupola with the harbor's pennant, a lantern either side of the doors,
// cargo stacked against the west wall.
//
//   fit       the crates the pick stacked outside the west wall move 7 px in against it (nothing at
//             ground level stands on the pier's planks), the ones past the east wall are cut off
//             (2 px of wall is all that overhangs the sand); the ground-floor window gives way to
//             plain planks, where the second lantern hangs
//   restored  a brighter pennant, the second lantern (the pick's own, mirrored)
//   derelict  sun-bleached planks, rusted brass, the roofs a faded red under moss with two holes;
//             the crane's jib fallen against the mast with a frayed rope end; boards across the
//             doors, the windows and the loft; a blank, cracked sign; one dark lantern and an empty
//             hook; a torn pennant; the top crate gone, the rest grey
//   winter    snow on the side roofs, the gable's rakes and the cupola by the town buildings' rule
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, PAL } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const O = '#2e222f';
type Im = InstanceType<typeof Img>;

export const WAREHOUSE = { w: 80, h: 120, ox: 7, oy: 72 };
/** where the two door lanterns' glass is, in frame pixels (src/render/lighting.ts lights them) */
export const LANTERNS = [[22, 101], [65, 101]];

/** rows of a character grid onto img at (x, y); ' ' or '.' = leave, '_' = clear */
function stamp(img: Im, x: number, y: number, rows: string[], key: Record<string, string | null>) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === ' ' || ch === '.') return;
    img.set(x + i, y + j, ch === '_' ? null : key[ch]);
  }));
}
function paintRect(img: Im, x: number, y: number, w: number, h: number, map: Record<string, string>) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const c = img.get(xx, yy);
    if (c && map[c]) img.set(xx, yy, map[c]);
  }
}

// ------------------------------------------------------------------ fit to the footprint
/** the right edge of the crates stacked outside the west wall, per row (source coords) */
const stackEdge = (y: number) => (y < 97 ? -1 : y <= 105 ? 13 : y <= 111 ? 18 : y === 112 ? 22 : 23);
const SHIFT = 7;

function fit(src: Im, { topCrate = true } = {}): Im {
  const img = src.clone();
  // the ground-floor window (x 59..67, rows 97..106) becomes plain wall: the same rows of planks
  // from the wall west of the doors (x 25..33)
  for (let y = 97; y <= 106; y++) for (let i = 0; i < 9; i++) img.set(59 + i, y, src.get(25 + i, y));
  // without the top crate (derelict): its rows keep only the corner post's outline
  if (!topCrate) for (let y = 97; y <= 103; y++) for (let x = 5; x <= 12; x++) img.set(x, y, null);
  // the west stack moves in against the wall
  const from = topCrate ? 97 : 104;
  const stack = new Img(src.w, src.h);
  for (let y = from; y < src.h; y++) for (let x = 0; x <= stackEdge(y); x++) { stack.set(x, y, img.get(x, y)); img.set(x, y, null); }
  img.blit(stack, SHIFT, 0);
  // nothing past the east wall at ground level: the crates east of x 73 go, the wall's edge closes
  for (let y = 100; y < src.h; y++) {
    let any = false;
    for (let x = 74; x < src.w; x++) { if (img.get(x, y)) any = true; img.set(x, y, null); }
    if (any && img.get(73, y)) img.set(73, y, O);
  }
  return img;
}

// the pick's lantern (x 20..25, rows 94..104), kept as generated; the second one is this, mirrored
const LANTERN = [
  '..O%O.',
  '..bOO.',
  '.cOpO.',
  '.O#O#.',
  '.Oc#O.',
  'OnnkkO',
  'OOkfO.',
  '.OqbO.',
  '.OqnO.',
  '.kkka.',
  '.OOO..',
];
const LKEY = { O, '%': '#ab947a', b: '#fbb954', c: '#cd683d', p: '#b2ba90', '#': '#9e4539', n: '#f9c22b', k: '#a2a947', f: '#676633', q: '#ffffff', a: '#4c3e24' };

// ------------------------------------------------------------------ winter
// The town's rule (art/buildings/tools/compose.mjs): a roof's colors turn to snow keeping their
// lightness order, by pixel share: the darkest ~20% snow shadow, the next ~50% snow, the rest bright.
const SNOW = ['#9babb2', '#c7dcd0', '#ffffff'];
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
/** the gable's rakes: the outline runs x = 53 - y (west) and x = y + 33 (east), rows 14..46 */
const rakeW = (y: number) => 53 - y, rakeE = (y: number) => y + 33;
/** is (x, y) on a shingled roof: the side roofs either side of the gable, or the cupola's cap */
function onRoof(x: number, y: number): boolean {
  if (y >= 23 && y <= 32) return (x >= 10 && x < rakeW(y)) || (x > rakeE(y) && x <= 76);
  if (y >= 7 && y <= 13) return x >= 55 && x <= 67;
  return false;
}
function snow(img: Im) {
  const cnt = new Map<string, number>();
  const each = (f: (x: number, y: number, c: string) => void) => {
    for (let y = 0; y < 34; y++) for (let x = 0; x < img.w; x++) { const c = img.get(x, y); if (c && c !== O && onRoof(x, y)) f(x, y, c); }
  };
  each((_x, _y, c) => cnt.set(c, (cnt.get(c) ?? 0) + 1));
  const total = [...cnt.values()].reduce((a, b) => a + b, 0);
  const map = new Map<string, string>();
  let cum = 0;
  for (const c of [...cnt.keys()].sort((a, b) => lum(a) - lum(b))) {
    const mid = (cum + cnt.get(c)! / 2) / total;
    map.set(c, mid < 0.2 ? SNOW[0] : mid < 0.7 ? SNOW[1] : SNOW[2]);
    cum += cnt.get(c)!;
  }
  each((x, y, c) => img.set(x, y, map.get(c)!));
  // snow lying on the rakes: the two boards under each rake's outline, bright on the lit west side
  for (let y = 12; y <= 46; y++) {
    for (const [x, c] of [[rakeW(y) + 1, SNOW[2]], [rakeW(y) + 2, SNOW[1]], [rakeE(y) - 1, SNOW[1]], [rakeE(y) - 2, SNOW[0]]] as const) {
      const was = img.get(x, y);
      if (was && was !== O) img.set(x, y, c);
    }
  }
  // and a cap on the cupola's sill and the stack's top crate
  for (let x = 56; x <= 66; x++) if (img.get(x, 14) === O && img.get(x, 13)) img.set(x, 13, SNOW[1]);
}

// ------------------------------------------------------------------ restored
function restored(src: Im, winter = false): Im {
  const img = fit(src);
  // the second lantern, east of the doors (mirrored, so both face the doors)
  LANTERN.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') img.set(67 - i, 94 + j, LKEY[ch as 'O']); }));
  // pennant: from roof red to a brighter red, so it reads against the sky and the trees
  paintRect(img, 62, 0, 14, 3, { '#9e4539': '#ea4f36', '#6e2727': '#b33831', '#b33831': '#ea4f36' });
  if (winter) snow(img);
  return img;
}

// ------------------------------------------------------------------ derelict
const FADE: Record<string, string> = {
  '#9e4539': '#966c6c', // plank base -> sun-bleached
  '#6e2727': '#694f62', // plank shade
  '#cd683d': '#ab947a', // lit edges, the sign
  '#e6904e': '#ab947a',
  '#fca790': '#ab947a',
  '#fdcbb0': '#ab947a',
  '#fbb954': '#9e4539', // brass -> rust
  '#f9c22b': '#9e4539',
  '#a2a947': '#676633',
  '#ffffff': '#625565', // lantern glass, dark
  '#b2ba90': '#7f708a',
  '#753c54': '#625565',
  '#7a3045': '#625565',
  '#b33831': '#694f62',
};
/** a board nailed across (x, y) .. (x + w - 1, y + 1) */
function board(img: Im, x: number, y: number, w: number, tilt = 0) {
  for (let i = 0; i < w; i++) {
    const yy = y + Math.round((i / (w - 1) - 0.5) * tilt);
    img.set(x + i, yy - 1, O); img.set(x + i, yy, '#ab947a'); img.set(x + i, yy + 1, '#966c6c'); img.set(x + i, yy + 2, O);
  }
  img.set(x, y, O); img.set(x + w - 1, y, O);
  img.set(x + 1, y + 1 - Math.round(tilt / 2), O); img.set(x + w - 2, y + 1 + Math.round(tilt / 2), O); // nails
}

function derelict(src: Im, winter = false): Im {
  const img = fit(src, { topCrate: false });
  // 1. the crane: the jib, its stays, the rope and the hook go; the mast stays
  for (let y = 0; y < 46; y++) for (let x = 0; x < (y < 22 ? 21 : y < 34 ? 9 : 3); x++) img.set(x, y, null);
  for (let y = 9; y < 22; y++) if (img.get(21, y)) img.set(21, y, O);
  // 2. bleach the walls, the mast and the crates, rust the brass; the roofs keep a faded red
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const c = img.get(x, y);
    if (!c) continue;
    if (onRoof(x, y)) { if (c === '#6e2727') img.set(x, y, '#7a3045'); else if (c === '#cd683d' || c === '#e6904e') img.set(x, y, '#966c6c'); }
    else if (FADE[c]) img.set(x, y, FADE[c]);
  }
  // 3. pennant: a torn scrap on the bare pole
  for (let y = 0; y < 3; y++) for (let x = 63; x < 76; x++) img.set(x, y, null);
  stamp(img, 62, 0, ['Oab', 'Ob.'], { O, a: '#694f62', b: '#966c6c' });
  // 4. the fallen jib: hinged at the mast head, lying down across the west roof
  const jib: [number, number][] = [];
  {
    let x0 = 22, y0 = 11;
    const x1 = 8, y1 = 29;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let err = dx - dy;
    for (;;) {
      jib.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 -= 1; }
      if (e2 < dx) { err += dx; y0 += 1; }
    }
  }
  const body = new Set<string>();
  for (const [x, y] of jib) { body.add(x + ',' + y); body.add(x + 1 + ',' + y); }
  for (const k of body) {
    const [x, y] = k.split(',').map(Number);
    for (const [ax, ay] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!body.has(x + ax + ',' + (y + ay))) img.set(x + ax, y + ay, O);
  }
  for (const [x, y] of jib) { img.set(x, y, '#ab947a'); img.set(x + 1, y, '#694f62'); }
  for (const [x, y] of jib.filter((_, i) => i % 4 === 2)) img.set(x + 1, y, '#9e4539'); // rust streaks
  stamp(img, 5, 28, ['.OOO.', 'OcdcO', 'OdOdO', 'OcdcO', '.OOO.'], { O, c: '#7a3045', d: '#9e4539' }); // a seized pulley
  stamp(img, 6, 33, ['a', 'b', '.a', 'b', '.a'], { a: '#ab947a', b: '#966c6c' }); // a frayed rope end
  if (winter) snow(img);
  // 5. holes in the side roofs (dark loft, a rafter across, broken shingle ends lit on the near rim)
  const HK = { O, j: '#45293f', r: '#694f62', h: '#ab947a' };
  stamp(img, 13, 25, ['.OOOO..', 'OjOOOO.', 'OrrrrrO', '.OOjOO.', '..hh.h.'], HK);
  stamp(img, 62, 25, ['...OOOO...', '.OOjOOOOO.', 'OrrrrrrrrO', 'OjOOOOOOjO', '.OOOjOOO..', '..hh.hh.h.'], HK);
  // moss on the roofs, the rakes' feet and the base stones
  const MOSS = ['#4c3e24', '#676633', '#676633', '#a2a947'];
  for (const [mx, my] of winter ? [] : [[24, 30], [56, 31], [72, 28], [11, 31], [60, 9], [30, 45], [52, 46]]) {
    for (const [dx, dy, k] of [[0, 0, 1], [1, 0, 2], [-1, 1, 0], [0, 1, 1], [1, 1, 1], [2, 1, 0], [0, -1, 3]]) {
      const c = img.get(mx + dx, my + dy);
      if (c && c !== O) img.set(mx + dx, my + dy, MOSS[k]);
    }
  }
  // 6. boards across the cargo doors, the four windows and the loft's hoist door
  board(img, 33, 104, 24, 2);
  board(img, 33, 112, 24, -2);
  for (const [x, y] of [[20, 56], [58, 56], [20, 74], [58, 74]]) board(img, x, y, 9);
  board(img, 35, 55, 13, 2);
  // 7. the sign: a blank, sun-bleached board with a crack, its east end sagging
  for (let y = 88; y <= 93; y++) for (let x = 36; x <= 55; x++) { const c = img.get(x, y); if (c && c !== O) img.set(x, y, '#ab947a'); }
  for (const [x, y] of [[49, 89], [48, 90], [48, 91], [47, 92], [46, 93]]) img.set(x, y, '#694f62');
  // 8. one dark lantern west of the doors (its glass faded above), an empty hook east of them
  stamp(img, 64, 94, ['.OO', 'O.O', '.O.'], { O });
  // 9. gaps between the planks
  for (const [x, y, w] of [[15, 61, 4], [64, 70, 5], [27, 80, 6], [60, 90, 5], [18, 109, 4]]) for (let i = 0; i < w; i++) if (img.get(x + i, y)) img.set(x + i, y, O);
  return img;
}

/** [derelict, restored, derelict in winter, restored in winter] */
export function buildWarehouse(): Im[] {
  const src = Img.load(path.join(HERE, '../raw/grand/a3.png'), { unscale: false });
  if (src.w !== WAREHOUSE.w || src.h !== WAREHOUSE.h) throw new Error(`warehouse: source is ${src.w}x${src.h}`);
  const frames = [derelict(src), restored(src), derelict(src, true), restored(src, true)];
  for (const f of frames) for (const c of f.colors().keys()) if (!PAL.includes(c)) throw new Error('warehouse: off-palette ' + c);
  return frames;
}
