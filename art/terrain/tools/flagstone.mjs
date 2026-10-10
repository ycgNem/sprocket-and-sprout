// The flagstone path (ROADMAP 1.2 D6, bug 11): replaces the cobble look of T.PATH (the town's roads and
// the placeable path) with irregular flagstones edged in gravel.
//
// The slab layout is a Voronoi "crazy paving" on the 16 px torus, so it tiles with itself in both
// directions and every vertex tile of the dual grid (all on the same 16 px lattice) shows the same stones
// at the same place. Bases are that texture plus variants that only touch pixels inside the 1-px ring
// (a crack, a sunken slab, a slab of another stone, a missing slab with gravel showing, moss in the
// joints), so any variant sits next to any other. Moss uses the grass colors on purpose: the season maps
// turn it olive in fall and white (snow in the cracks) in winter.
//
// The transitions come from PixelLab Wang sets chained on one flagstone base (raw/flag-grass-c,
// raw/flag-dirt, raw/flag-sand): their grass / dirt / sand side and the shadow line are kept (graded with
// the materials of grade.json), every pixel on the path side is redrawn with the same texture, and the
// path pixels next to the edge become gravel: the "gravel edge".
//
// Writes bases/path/*.png and sets/path-{grass,dirt,sand}/tileset.png + tileset.json, plus a preview
// e2e/out/terrain/flagstone.png (a town square in spring and winter). Run from the repo root; build.sh
// runs it after compose.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { rgbOf, hex, lab, de2000, crop, blank, blit } from '../../../scripts/lib/pixel.mjs';
import { makeGrader, gradeImage } from './grade.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(here, '..');
const S = 16;

// ---- palette (STYLE.md stone ramp, warm) ----
const BODY = '#ab947a', ROSE = '#966c6c', JOINT_LIT = '#966c6c', JOINT_SHADE = '#625565', DEEP = '#3e3546', PALE = '#c7dcd0';
const MOSS = ['#165a4c', '#239063', '#1ebc73'];

// ---- the layout: Voronoi cells on the torus (seeds tuned by eye; no straight joint runs across a tile) ----
const SEEDS = [[3, 3], [11, 4], [7, 11], [15, 11.5], [1, 9]];
const wrap = (v) => ((v % S) + S) % S;
const CELL = [];
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    let best = 0, bd = Infinity;
    SEEDS.forEach(([sx, sy], i) => {
      const dx = Math.min(Math.abs(x + 0.5 - sx), S - Math.abs(x + 0.5 - sx)), dy = Math.min(Math.abs(y + 0.5 - sy), S - Math.abs(y + 0.5 - sy));
      const d = Math.sqrt(dx * dx + 1.1 * dy * dy);
      if (d < bd) { bd = d; best = i; }
    });
    CELL.push(best);
  }
const cell = (x, y) => CELL[wrap(y) * S + wrap(x)];
/** a 1-px joint on the right/bottom side of every boundary between two cells */
const isJoint = (x, y) => cell(x, y) !== cell(x + 1, y) || cell(x, y) !== cell(x, y + 1);
const hash = (x, y, s) => { let h = (wrap(x) * 374761393 + wrap(y) * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ring = (x, y) => x === 0 || y === 0 || x === S - 1 || y === S - 1;
// the one slab that touches no ring pixel (cell 2): the variants may recolor or remove it whole
const INNER = 2;

/** gravel: dark ground with light and rose pebbles, periodic like the slabs */
function gravel(x, y) {
  const h = hash(x, y, 17);
  return h < 0.16 ? BODY : h < 0.36 ? ROSE : h < 0.56 ? DEEP : JOINT_SHADE;
}

/**
 * One pixel of the texture. `kind(x, y)` overrides per variant: 'gravel', 'moss0..2', 'crack',
 * 'rose', 'sunk' or null. `open(x, y)` is true where a neighbor is not stone (gravel or another
 * terrain): stone next to it is shaded like a slab edge.
 */
function stone(x, y, kind = () => null, open = () => false, seed = 0) {
  // glints and pits on the ring always use seed 0, so every variant keeps the same edge pixels
  const sd = ring(x, y) ? 0 : seed;
  const k = kind(x, y);
  // a ring pixel never looks at the variant's changes next to it (the ring is the same in every variant)
  const nk = ring(x, y) ? () => null : kind;
  if (k === 'gravel') return gravel(x, y);
  if (k?.startsWith('moss')) return MOSS[+k.slice(4)];
  if (k === 'crack') return JOINT_SHADE;
  const jointAt = (xx, yy) => isJoint(xx, yy) || open(xx, yy) || nk(xx, yy) === 'gravel';
  if (isJoint(x, y)) {
    // the joint under/right of a slab lies in its shadow (light from the upper left)
    const shade = (!isJoint(x, y - 1) && !open(x, y - 1)) || (!isJoint(x - 1, y) && !open(x - 1, y));
    return shade ? JOINT_SHADE : JOINT_LIT;
  }
  const tone = k === 'rose' ? 'rose' : k === 'sunk' ? 'sunk' : 'body';
  // slab pixels at the bottom/right edge next to gravel or another terrain take the joint's shadow
  if (open(x + 1, y) || open(x, y + 1) || nk(x + 1, y) === 'gravel' || nk(x, y + 1) === 'gravel') return tone === 'body' ? ROSE : JOINT_SHADE;
  if (tone === 'rose') return jointAt(x, y - 1) && !jointAt(x, y + 1) ? BODY : ROSE;
  if (tone === 'sunk') return jointAt(x, y - 1) ? JOINT_SHADE : ROSE;
  // a pale glint on the top-left corner pixel of a slab, a few pits
  if (jointAt(x, y - 1) && jointAt(x - 1, y) && !jointAt(x + 1, y) && !jointAt(x, y + 1) && hash(x, y, 3 + sd * 10) < 0.3) return PALE;
  if (!jointAt(x, y - 1) && !jointAt(x, y + 1) && !jointAt(x - 1, y) && !jointAt(x + 1, y) && hash(x, y, 4 + sd * 10) < 0.045) return ROSE;
  return BODY;
}

const tileImg = (fn) => { const img = blank(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img.data.set([...rgbOf(fn(x, y)), 255], (y * S + x) * 4); return img; };
const save = (img, file) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, encodePNG(img.w, img.h, img.data)); };

// ---- variants (only pixels off the ring change) ----
const inner = (x, y) => !ring(x, y);
const pts = (list) => { const m = new Map(list.map(([x, y, k]) => [`${x},${y}`, k])); return (x, y) => (inner(x, y) ? m.get(`${wrap(x)},${wrap(y)}`) ?? null : null); };
/** moss on the joint pixels nearest to (cx, cy), n of them */
function mossAt(cx, cy, n, seed) {
  const js = [];
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) if (isJoint(x, y)) js.push([x, y, (x - cx) ** 2 + (y - cy) ** 2]);
  js.sort((a, b) => a[2] - b[2]);
  return js.slice(0, n).map(([x, y], i) => [x, y, `moss${i === 0 ? 2 : hash(x, y, seed) < 0.5 ? 1 : 0}`]);
}
const slabPixels = (c) => { const out = []; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (cell(x, y) === c && !isJoint(x, y) && inner(x, y)) out.push([x, y]); return out; };
const VARIANTS = [
  // plain stone, glints and pits in other places: most of a big square is plain
  ['0', () => null, 0],
  ['1', () => null, 1],
  ['2', () => null, 2],
  ['3', () => null, 3],
  ['4', () => null, 4],
  ['5', pts(mossAt(10, 7, 2, 7)), 5],
  // a crack across the big top slab, moss in a joint
  ['6', pts([[9, 1, 'crack'], [10, 2, 'crack'], [10, 3, 'crack'], [11, 4, 'crack'], ...mossAt(4, 6, 3, 5)]), 0],
  // a crack in the left slab, moss along a joint (snow in the cracks in winter)
  ['7', pts([[2, 2, 'crack'], [3, 3, 'crack'], [3, 4, 'crack'], ...mossAt(3, 14, 3, 9)]), 1],
  // moss in two other joints (the rose-stone slab tried here read as polka dots across the square)
  ['8', pts([...mossAt(13, 13, 2, 13), ...mossAt(6, 9, 2, 15)]), 2],
  // the inner slab gone: gravel shows
  ['9', (x, y) => (cell(x, y) === INNER && inner(x, y) && !(isJoint(x, y) && cell(x + 1, y) !== INNER && cell(x, y + 1) !== INNER) ? 'gravel' : null), 3],
  // a chipped corner on the right slab: a little gravel where the stone broke off
  ['10', pts([[12, 9, 'gravel'], [13, 9, 'gravel'], [12, 10, 'gravel'], [13, 10, 'gravel'], [12, 11, 'gravel'], ...mossAt(5, 4, 2, 11)]), 4],
];
const colorAt = (img, x, y) => { const p = (y * img.w + x) * 4; return hex(img.data[p], img.data[p + 1], img.data[p + 2]); };
const baseFiles = [];
for (const f of fs.existsSync(path.join(T, 'bases/path')) ? fs.readdirSync(path.join(T, 'bases/path')) : []) fs.unlinkSync(path.join(T, 'bases/path', f));
const BASES = VARIANTS.map(([name, kind, seed]) => {
  const img = tileImg((x, y) => stone(x, y, kind, () => false, seed));
  const file = path.join(T, 'bases/path', `${name}.png`);
  save(img, file);
  baseFiles.push(file);
  return img;
});
if (slabPixels(INNER).length < 12) throw new Error('flagstone: the inner slab is gone; retune SEEDS or INNER');
// every variant keeps the ring of the plain tile
for (const [i, b] of BASES.entries()) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (ring(x, y) && colorAt(b, x, y) !== colorAt(BASES[0], x, y)) throw new Error(`flagstone: variant ${i} changes the edge pixel ${x},${y}`);

// ---- the transition sets ----
const grade = JSON.parse(fs.readFileSync(path.join(T, 'grade.json'), 'utf8'));
const M = makeGrader({ materials: grade.materials }, T);
const SETS = [
  { out: 'path-grass', raw: 'raw/flag-grass-c', job: { classify: [{ material: 'rim', L: [0, 30] }, { material: 'grass', hue: [40, 200] }], fallback: 'grass' } },
  { out: 'path-dirt', raw: 'raw/flag-dirt', job: { classify: [{ material: 'rim', L: [0, 22] }], fallback: 'earth' } },
  { out: 'path-sand', raw: 'raw/flag-sand', job: { classify: [{ material: 'rim', L: [0, 45] }], fallback: 'sand' } },
];
for (const s of SETS) {
  const meta = JSON.parse(fs.readFileSync(path.join(T, s.raw, 'tileset.json'), 'utf8'));
  const raw = decodePNG(fs.readFileSync(path.join(T, s.raw, 'tileset.png')));
  const graded = gradeImage(raw, s.job, M).img;
  const list = meta.tileset_data.tiles;
  const maskOf = (t) => (t.corners.NW === 'upper' ? 8 : 0) | (t.corners.NE === 'upper' ? 4 : 0) | (t.corners.SW === 'upper' ? 2 : 0) | (t.corners.SE === 'upper' ? 1 : 0);
  const box = (m) => list.find((t) => maskOf(t) === m).bounding_box;
  const b0 = box(0), b15 = box(15);
  const pathCols = new Set(), upperCols = new Set();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { pathCols.add(colorAt(raw, b0.x + x, b0.y + y)); upperCols.add(colorAt(raw, b15.x + x, b15.y + y)); }
  const nearest = (c, set) => Math.min(...[...set].map((h) => de2000(lab(rgbOf(c)), lab(rgbOf(h)), 1)));
  const out = { w: raw.w, h: raw.h, data: new Uint8Array(graded.data) };
  for (const t of list) {
    const { x: bx, y: by } = t.bounding_box;
    const m = maskOf(t);
    // which pixels are path: the same as the set's own path tile there, else closer to its colors
    const isPath = (x, y) => {
      if (m === 0) return true;
      if (m === 15) return false;
      const c = colorAt(raw, bx + x, by + y);
      if (c === colorAt(raw, b0.x + x, b0.y + y) && pathCols.has(c)) return true;
      if (c === colorAt(raw, b15.x + x, b15.y + y)) return false;
      if (lab(rgbOf(c))[0] < 33) return false; // the shadow line under the edge stays
      return nearest(c, pathCols) < nearest(c, upperCols);
    };
    let P = [];
    const dark = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { P.push(isPath(x, y)); dark.push(m !== 0 && m !== 15 && lab(rgbOf(colorAt(raw, bx + x, by + y)))[0] < 33); }
    // clean the speckled edge PixelLab leaves (dirt flecks in the gravel, stray stones in the dirt): a
    // majority vote over the 3x3 neighborhood, twice; the dark shadow line under the edge is left alone
    for (let pass = 0; pass < 2 && m !== 0 && m !== 15; pass++) {
      const Q = P.slice();
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          if (dark[y * S + x]) continue;
          let n = 0, k = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
            k++; if (P[yy * S + xx]) n++;
          }
          if (n >= Math.ceil(k * 0.7)) Q[y * S + x] = true;
          else if (n <= Math.floor(k * 0.25)) Q[y * S + x] = false;
        }
      P = Q;
    }
    const at = (x, y) => P[Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))];
    // distance (Chebyshev, inside the tile; the tile's own edge pixel stands in beyond it) to the nearest non-path pixel
    const dist = (x, y) => { for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!at(x + dx, y + dy)) return r; return 9; };
    const kind = (x, y) => { if (!at(x, y)) return null; const d = dist(x, y); return d === 1 || (d === 2 && hash(x, y, 23) < 0.45) ? 'gravel' : null; };
    const open = (x, y) => !at(x, y);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!P[y * S + x]) continue;
        out.data.set([...rgbOf(stone(x, y, kind, open)), 255], ((by + y) * out.w + bx + x) * 4);
      }
  }
  const dir = path.join(T, 'sets', s.out);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tileset.png'), encodePNG(out.w, out.h, out.data));
  fs.copyFileSync(path.join(T, s.raw, 'tileset.json'), path.join(dir, 'tileset.json'));
}

// ---- preview: a town square with roads, in spring and winter, the bases in a row on top ----
{
  const setImg = (name) => {
    const meta = JSON.parse(fs.readFileSync(path.join(T, 'sets', name, 'tileset.json'), 'utf8'));
    const img = decodePNG(fs.readFileSync(path.join(T, 'sets', name, 'tileset.png')));
    const tiles = {};
    for (const t of meta.tileset_data.tiles) {
      const c = t.corners, m = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
      tiles[m] = crop(img, t.bounding_box.x, t.bounding_box.y, S, S);
    }
    return tiles;
  };
  const pg = setImg('path-grass');
  const grassB = fs.readdirSync(path.join(T, 'bases/grass')).filter((f) => f.endsWith('.png')).map((f) => decodePNG(fs.readFileSync(path.join(T, 'bases/grass', f))));
  const MW = 26, MH = 16;
  const isP = (x, y) => (x >= 3 && x <= 22 && y >= 2 && y <= 12) || (y >= 6 && y <= 7) || (x >= 11 && x <= 12) || (x === 1 && y === 14);
  const winter = JSON.parse(fs.readFileSync(path.join(T, 'seasons.json'), 'utf8'))['3'];
  const panel = (season) => {
    const img = blank(MW * S, MH * S);
    for (let vy = 0; vy <= MH; vy++)
      for (let vx = 0; vx <= MW; vx++) {
        const up = (x, y) => (isP(x, y) ? 0 : 1);
        const mask = (up(vx - 1, vy - 1) << 3) | (up(vx, vy - 1) << 2) | (up(vx - 1, vy) << 1) | up(vx, vy);
        const h = hash(vx, vy, 7);
        const t = mask === 0 ? BASES[Math.floor(h * BASES.length)] : mask === 15 ? grassB[Math.floor(h * grassB.length)] : pg[mask];
        blit(img, t, vx * S - 8, vy * S - 8);
      }
    if (season === 3) for (let i = 0; i < img.data.length; i += 4) { const to = winter[hex(img.data[i], img.data[i + 1], img.data[i + 2])]; if (to) img.data.set(rgbOf(to), i); }
    return img;
  };
  const a = panel(0), b = panel(3);
  const row = blank(BASES.length * (S + 2), S);
  BASES.forEach((t, i) => blit(row, t, i * (S + 2), 0));
  const img = blank(a.w, a.h * 2 + 4 + S + 4);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([46, 34, 47, 255], i);
  blit(img, row, 0, 0); blit(img, a, 0, S + 4); blit(img, b, 0, S + 4 + a.h + 4);
  save(upscale(img, 2), path.resolve(T, '../../e2e/out/terrain/flagstone.png'));
  const close = crop(a, 0, 0, 12 * S, 8 * S);
  const row2 = blank(close.w, S + 4 + close.h);
  blit(row2, row, 0, 0); blit(row2, close, 0, S + 4);
  save(upscale(row2, 4), path.resolve(T, '../../e2e/out/terrain/flagstone-close.png'));
}
console.log(`flagstone: ${BASES.length} path bases, sets ${SETS.map((s) => s.out).join(', ')} redrawn; previews e2e/out/terrain/flagstone.png, flagstone-close.png`);

// ---- the placeable Flagstone Path's item icon (i:path_stone) and build-ghost sprite (st:path_stone:*) ----
// Same stones as the ground: the icon is a 14 px swatch in the plum outline like the other path icons;
// the structure sprite is 16x20 drawn 4 px above its tile (origin [0, 4], as the procedural one), so its
// top 4 rows are the tile's bottom rows (the texture wraps). Imported by art/terrain/items.json.
{
  const src = BASES[0];
  const icon = blank(S, S);
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++) {
      const corner = (x === 1 || x === S - 2) && (y === 1 || y === S - 2);
      if (corner) continue;
      const rim = x === 1 || y === 1 || x === S - 2 || y === S - 2;
      icon.data.set(rim ? [...rgbOf('#2e222f'), 255] : src.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (y * S + x) * 4);
    }
  save(icon, path.join(T, 'items/i_path_stone.png'));
  const st = blank(S, S + 4);
  for (let y = 0; y < S + 4; y++) for (let x = 0; x < S; x++) { const sy = (y + S - 4) % S; st.data.set(src.data.subarray((sy * S + x) * 4, (sy * S + x) * 4 + 4), (y * S + x) * 4); }
  save(st, path.join(T, 'items/st_path_stone.png'));
}
