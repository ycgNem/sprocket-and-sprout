// Tilled soil as countable beds (2.1.2, the critic: "soft blobs, you can't see the planting grid").
// Every tilled map tile is drawn as its own bed: a lit rim along its top and left, three short furrow
// crests, and a darker groove along its bottom and right, so a row of beds counts off at a glance
// without turning into a checkerboard (the groove is one shade down the soil ramp, the corners are
// left open). Watered soil is the same bed one step down the ramp.
//
// The ground is a dual grid: one 16 px tile per map-grid vertex, centred on it, so a vertex tile's
// pixel (px, py) lies in a map tile at ((px + 8) % 16, (py + 8) % 16). BED below is written in
// map-tile coordinates; everything this tool writes is that pattern seen through the vertex offset,
// so any two tiles (bases, Wang tiles, the renderer's painted transitions in src/render/blend.ts,
// which copy base pixels) agree on where each bed's rim, furrows and groove are.
//
//   bases/soil/0-3.png, bases/wet/0-3.png   four variants each (furrow breaks and a crumb differ)
//   sets/wet-soil/tileset.png               every tile cut square on the map-tile boundary: a watered
//                                           bed is a whole bed, not a blob over its neighbours
//   sets/{soil,wet}-{grass,dirt}/tileset.png  the soil side of every tile redrawn as beds (the rim
//                                           and the grass or dirt side stay as generated)
//
// Usage (repo root; art/terrain/build.sh runs it after tools/seams.mjs):
//   node art/terrain/tools/beds.ts           -> rewrites the files above, e2e/out/art/beds.png (review)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, hex, rgbOf } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(HERE, '..');
const ROOT = path.resolve(T, '../..');
const S = 16;

// ---- the bed, in map-tile coordinates: '.' body, 'c' crest / lit rim, 'g' groove ----
const BED: string[][] = [
  [
    '..ccccccccccc...',
    '.c.............g',
    '.c.............g',
    '....ccccccc....g',
    '...............g',
    '...............g',
    '...............g',
    '...ccccccccc...g',
    '...............g',
    '...............g',
    '...............g',
    '....ccccccc....g',
    '...............g',
    '...............g',
    '..ggggggggggggg.',
    '................',
  ],
  [
    '..cccccccccc....',
    '.c.............g',
    '.c.............g',
    '...cccccc.c....g',
    '...............g',
    '............c..g',
    '...............g',
    '....cccc.cccc..g',
    '...............g',
    '...............g',
    '...............g',
    '...cccccccc....g',
    '...............g',
    '...............g',
    '..ggggggggggggg.',
    '................',
  ],
  [
    '...cccccccccc...',
    '.c.............g',
    '...............g',
    '.....ccccccc...g',
    '...............g',
    '...............g',
    '...............g',
    '...cccccccc....g',
    '...............g',
    '..c............g',
    '...............g',
    '.....ccc.cccc..g',
    '...............g',
    '...............g',
    '..ggggggggggggg.',
    '................',
  ],
  [
    '..cccc.cccccc...',
    '.c.............g',
    '.c.............g',
    '....ccc.cccc...g',
    '...............g',
    '...............g',
    '...............g',
    '...ccccccccc...g',
    '...............g',
    '...............g',
    '...............g',
    '....cccccc.....g',
    '...........c...g',
    '...............g',
    '..ggggggggggggg.',
    '................',
  ],
];
/** soil ramps, a watered bed one step down: body, crest, groove */
const RAMP = {
  soil: { '.': '#7a3045', c: '#9e4539', g: '#45293f' },
  wet: { '.': '#45293f', c: '#7a3045', g: '#2e222f' },
} as const;
type Kind = keyof typeof RAMP;
for (const r of Object.values(RAMP)) for (const c of Object.values(r)) if (!PAL.includes(c)) throw new Error('beds: off-palette ' + c);
for (const b of BED) if (b.length !== S || b.some((r) => r.length !== S)) throw new Error('beds: a pattern is not 16x16');

/** the pattern character a vertex tile's pixel shows */
const bedAt = (v: number, px: number, py: number) => BED[v % BED.length][(py + 8) & 15][(px + 8) & 15] as '.' | 'c' | 'g';

type Img = { w: number; h: number; data: Uint8Array };
const blank = (w: number, h: number): Img => ({ w, h, data: new Uint8Array(w * h * 4) });
const get = (im: Img, x: number, y: number) => { const i = (y * im.w + x) * 4; return hex(im.data[i], im.data[i + 1], im.data[i + 2]); };
const set = (im: Img, x: number, y: number, c: string) => { const i = (y * im.w + x) * 4; im.data.set([...rgbOf(c), 255], i); };
const save = (f: string, im: Img) => fs.writeFileSync(f, encodePNG(im.w, im.h, im.data));
const load = (f: string): Img => { const im = decodePNG(fs.readFileSync(f)); return { w: im.w, h: im.h, data: new Uint8Array(im.data) }; };

// ---- 1. base tiles ----
function baseTile(kind: Kind, v: number): Img {
  const im = blank(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(im, x, y, RAMP[kind][bedAt(v, x, y)]);
  return im;
}
for (const kind of ['soil', 'wet'] as const) {
  const dir = path.join(T, 'bases', kind);
  const n = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).length;
  for (let v = 0; v < n; v++) save(path.join(dir, v + '.png'), baseTile(kind, v));
}

// ---- 2. the sets ----
type TileMeta = { corners: Record<'NW' | 'NE' | 'SW' | 'SE', 'upper' | 'lower'>; bounding_box: { x: number; y: number } };
function eachTile(set: string, f: (sheet: Img, ox: number, oy: number, corner: (qx: number, qy: number) => 'upper' | 'lower', n: number) => void) {
  const dir = path.join(T, 'sets', set);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const sheet = load(path.join(dir, 'tileset.png'));
  (meta.tileset_data.tiles as TileMeta[]).forEach((t, n) => {
    const c = t.corners;
    f(sheet, t.bounding_box.x, t.bounding_box.y, (qx, qy) => c[(qy ? 'S' : 'N') + (qx ? 'E' : 'W') as 'NW'], n);
  });
  save(path.join(dir, 'tileset.png'), sheet);
}
// wet (lower) against soil (upper): square on the map-tile boundary
eachTile('wet-soil', (sheet, ox, oy, corner, n) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(sheet, ox + x, oy + y, RAMP[corner(x >> 3, y >> 3) === 'upper' ? 'soil' : 'wet'][bedAt(n, x, y)]);
});
// soil or wet (lower) against grass or dirt: the soil side, found by flooding from the soil corners
// through the soil's own colors, is redrawn as beds; crests keep 2 px clear of the other side's rim
for (const [setName, kind] of [['soil-grass', 'soil'], ['soil-dirt', 'soil'], ['wet-grass', 'wet'], ['wet-dirt', 'wet']] as const) {
  const own = new Set<string>(kind === 'soil' ? ['#7a3045', '#9e4539'] : ['#45293f', '#7a3045']);
  eachTile(setName, (sheet, ox, oy, corner, n) => {
    const inR = new Uint8Array(S * S);
    const stack: number[] = [];
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (corner(qx, qy) === 'lower') stack.push((qy * 15) * S + qx * 15);
    while (stack.length) {
      const i = stack.pop()!;
      if (inR[i]) continue;
      const x = i % S, y = (i / S) | 0;
      if (!own.has(get(sheet, ox + x, oy + y))) continue;
      inR[i] = 1;
      if (x > 0) stack.push(i - 1);
      if (x < S - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - S);
      if (y < S - 1) stack.push(i + S);
    }
    const deep = (x: number, y: number) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
        if (!inR[yy * S + xx]) return false;
      }
      return true;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!inR[y * S + x]) continue;
      const ch = bedAt(n, x, y);
      set(sheet, ox + x, oy + y, RAMP[kind][ch === 'c' && !deep(x, y) ? '.' : ch]);
    }
    // where the generated rim crosses the tile's edge in the outline color, it takes the groove's
    // shade: the next tile's rim crosses there in that shade, and the seam audit (e2e/seams.mjs)
    // reads the two as one line
    if (kind === 'soil') for (let i = 0; i < S; i++) for (const [x, y] of [[i, 0], [i, S - 1], [0, i], [S - 1, i]]) {
      if (get(sheet, ox + x, oy + y) === '#2e222f') set(sheet, ox + x, oy + y, RAMP.soil.g);
    }
  });
}

// ---- review: a plot of beds, dry and watered, at 3x ----
{
  const K = 3, W = 12, H = 6;
  const out = blank(W * S * K, H * S * K);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const kind: Kind = tx >= 6 !== (tx === 2 && ty === 2) && !(tx === 8 && ty === 3) ? 'wet' : 'soil';
    const v = (tx * 7 + ty * 3) % BED.length;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = RAMP[kind][BED[v][y][x] as '.'];
      for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) set(out, (tx * S + x) * K + xx, (ty * S + y) * K + yy, c);
    }
  }
  fs.mkdirSync(path.join(ROOT, 'e2e/out/art'), { recursive: true });
  save(path.join(ROOT, 'e2e/out/art/beds.png'), out);
}
console.log('beds: bases/soil, bases/wet, sets/wet-soil and the soil side of soil-grass, soil-dirt, wet-grass, wet-dirt');
