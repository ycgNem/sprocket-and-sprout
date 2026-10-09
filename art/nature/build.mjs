// Nature build: raw PixelLab candidates (art/nature/raw/<batch>/<slot>.png) -> palette-exact,
// anchored frames (art/nature/frames/*.png) + the sprites-import recipe (art/nature/sprites.json).
//
//   node art/nature/build.mjs            then   node scripts/sprites-import.mjs art/nature/sprites.json
//
// Why a build step instead of plain recipe entries: PixelLab's greens and browns sit between
// Resurrect 64's ramps, and nearest-color snapping scrambles canopies (clumps lose their shading,
// the outline turns sage). Each source is mapped onto material ramps by lightness (lib.mjs
// mapRamps), trees are anchored on their trunk base (not the bbox center), and the seasonal and
// fruit variants are derived from the same drawing (snow caps, fruit, blossoms) so a tree keeps its
// shape all year. Seasons that are a pure palette swap stay runtime `recolor` entries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, save, mapRamps, outlineInner, outlineOuter, snowcap, stamp, trunkBase, place, recolor, bbox, crop, blank, blit, at, get, set, hash, clone, colorsOf } from './lib.mjs';
import { TREES, LEAF, FALL, SPRING, WOOD, BARK, OBJECTS, STONE, MOSS, WOOD5, PLANT, DRY, SEED, LAMP, BOARD, STICKS, STICK_KEY } from './spec.mjs';
import { ALL, cleanCanopy } from './lib.mjs';
import { dropStrays } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(HERE, 'raw'), OUT = path.join(HERE, 'frames');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const entries = [];
const notes = [];
const frameFile = (id) => `frames/${id}.png`;
function writeFrame(id, img) {
  save(path.join(OUT, id + '.png'), img);
  return frameFile(id);
}
const raw = (ref) => load(path.join(RAW, ref + '.png'));

// ---------------------------------------------------------------- trees
const isLeaf = (c) => c.h >= 50 && c.h <= 200 && c.s > 0.16;
const isWood = (c) => (c.h < 50 || c.h > 300) && c.s > 0.14;
const any = () => true;

/** map a tree drawing onto its ramps */
function mapTree(img, t, { bare = false } = {}) {
  const snowFam = { name: 'snow', test: (c) => c.s < 0.16 && c.L > 72, ramp: ['#c7dcd0', '#ffffff'] };
  if (bare) {
    const fams = t.birch
      ? [snowFam, { name: 'bark', test: (c) => c.s < 0.2 && c.L > 45, ramp: BARK }, { name: 'wood', test: isWood, ramp: t.wood ?? WOOD }, { name: 'dark', test: any, ramp: ['#3e3546', '#625565'] }]
      : [snowFam, { name: 'wood', test: any, ramp: t.wood ?? WOOD }];
    return mapRamps(img, { families: fams, outlineL: 20 });
  }
  if (t.frost) {
    // everything but the brown trunk is frosted needles
    const trunk = (c) => (c.h < 60 || c.h > 300) && c.s > 0.25 && c.L < 55;
    return mapRamps(img, { families: [{ name: 'wood', test: trunk, ramp: t.wood ?? WOOD }, { name: 'leaf', test: any, ramp: t.leaf }], outlineL: 20 });
  }
  const fams = t.birch
    ? [
        { name: 'leaf', test: isLeaf, ramp: t.leaf },
        { name: 'bark', test: (c) => c.s < 0.2 && c.L > 45, ramp: BARK },
        { name: 'wood', test: isWood, ramp: t.wood ?? WOOD },
        { name: 'dark', test: any, ramp: ['#3e3546', '#625565'] },
      ]
    : [
        { name: 'leaf', test: isLeaf, ramp: t.leaf },
        { name: 'wood', test: any, ramp: t.wood ?? WOOD },
      ];
  return mapRamps(img, { families: fams, outlineL: 20 });
}

/** anchor a mapped tree on its trunk base in a w x h frame at (ox, oy) */
function anchor(img, w, h, ox, oy, tag) {
  const b = bbox(img);
  const cut = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  const tb = trunkBase(cut);
  // keep the trunk on the origin unless the canopy would be cut off: then slide it (and say so)
  let px = tb.x;
  const left = ox - px, right = left + cut.w;
  if (left < 0) px += left;
  else if (right > w) px += right - w;
  if (px !== tb.x) notes.push(`${tag}: trunk ${px - tb.x > 0 ? 'left' : 'right'} of the origin by ${Math.abs(px - tb.x)} px so the canopy fits`);
  const r = place(cut, w, h, px, tb.y, ox, oy);
  if (r.clipped) notes.push(`${tag}: ${r.clipped} px clipped (art ${cut.w}x${cut.h} in ${w}x${h})`);
  return r.img;
}

/** fruit stamps: 3x3 round fruit, highlight top-left, dark bottom-right */
const FRUIT_ROWS = {
  round: ['.ab.', 'abbc', 'bbcc', '.cc.'],
  pear: ['.a.', '.b.', 'abb', 'bbc', '.c.'],
  small: ['.d..', 'ab.d', 'bcab', '..bc'], // a pair of cherries on a stem
  berry: ['ab', 'bc'],
  coconut: ['.ab.', 'abbc', 'bbcc', '.cc.'],
};
const BLOSSOM_ROWS = ['.a.', 'aba', '.a.'];
function addFruit(img, leafSet, fruit, n, seed, rowsOverride, keyOverride) {
  const out = clone(img);
  const rows = rowsOverride ?? FRUIT_ROWS[fruit.shape ?? 'round'];
  const fw = rows[0].length, fh = rows.length;
  const b = bbox(img);
  // candidate spots: fully inside the leafy canopy (fruit sits on leaves, never on the trunk or the edge)
  const spots = [];
  for (let y = b.y0 + 2; y <= b.y1 - fh - 1; y++)
    for (let x = b.x0 + 1; x <= b.x1 - fw; x++) {
      let ok = true;
      for (let dy = -1; dy <= fh && ok; dy++)
        for (let dx = -1; dx <= fw && ok; dx++) if (!leafSet.has(get(img, x + dx, y + dy))) ok = false;
      if (ok) spots.push([x, y]);
    }
  // spread them out: greedy farthest-first from a seeded order, lower canopy preferred
  spots.sort((p, q) => hash(p[0], p[1], seed) - hash(q[0], q[1], seed));
  const picked = [];
  const minD = fruit.spacing ?? 6;
  for (const [x, y] of spots) {
    if (picked.length >= n) break;
    if (picked.every(([px, py]) => Math.abs(px - x) + Math.abs(py - y) >= minD)) picked.push([x, y]);
  }
  for (const [x, y] of picked) stamp(out, x, y, rows, keyOverride ?? { a: fruit.ramp[2], b: fruit.ramp[1], c: fruit.ramp[0], d: '#45293f' });
  return { img: out, placed: picked.length };
}

/** blossoms: little 5-petal flowers (3x3) scattered over the upper canopy, spaced apart */
function addBlossom(img, leafSet, petals, count, seed) {
  const r = addFruit(img, leafSet, { shape: 'blossom', spacing: 5 }, count, seed, BLOSSOM_ROWS, { a: petals[1], b: petals[2] });
  return r.img;
}

/** evergreens in winter: the lit (lightest) needles turn to snow, and every tier edge gets a cap */
function evergreenSnow(img, leaf, v, thick = 3) {
  const capped = snowcap(img, { on: leaf, seed: v + 3, deep: 0.85, thick });
  return recolor(capped, { [leaf[leaf.length - 1]]: '#ffffff', [leaf[leaf.length - 2]]: hashPick(leaf) });
}
const hashPick = (leaf) => (leaf.includes('#8ff8e2') ? '#c7dcd0' : leaf[leaf.length - 2]);

/** a light dusting of snow on bare branches: tops of near-horizontal branch runs */
function snowDust(img, { on, chance = 0.75, seed = 1 }) {
  const out = clone(img);
  const ok = (x, y) => on.includes(get(img, x, y)) || get(img, x, y) === '#2e222f';
  for (let y = 1; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (!ok(x, y) || get(img, x, y - 1)) continue;
      // horizontal-ish: a neighbour on the same row is branch with open sky above as well
      const run = (ok(x - 1, y) && !get(img, x - 1, y - 1)) || (ok(x + 1, y) && !get(img, x + 1, y - 1));
      if (!run || hash(x, y, seed) > chance) continue;
      set(out, x, y - 1, '#ffffff');
      if (hash(x, y, seed + 1) < 0.5) set(out, x, y, '#c7dcd0');
    }
  return out;
}

const MATURE = { w: 48, h: 64, o: [24, 62] };
/** the widest canopies (big oaks, a spreading willow): approved 2026-10-09, the renderer only needs the trunk on the origin */
const WIDE = { w: 56, h: 64, o: [28, 62] };
const YOUNG = { w: 32, h: 32, o: [16, 31] };
const SAPLING = { w: 16, h: 16, o: [8, 15] };

function rampMap(from, to) {
  const m = {};
  from.forEach((c, i) => { if (to[i] && to[i] !== c) m[c] = to[i]; });
  return m;
}

for (const [sp, t] of Object.entries(TREES)) {
  const leaf = t.leaf;
  const leafSet = new Set(leaf);
  const fallMap = t.fall ? rampMap(leaf, FALL[t.fall]) : null;
  const springMap = t.spring ? rampMap(leaf, SPRING[t.spring] ?? t.spring) : null;
  // ---- mature (stage 4) ----
  (t.mature ?? []).forEach((ref, v) => {
    let mapped = mapTree(raw(ref), t);
    if (t.clean) mapped = cleanCanopy(mapped, leafSet);
    const mb = bbox(mapped);
    const FR = mb.x1 - mb.x0 + 1 > MATURE.w ? WIDE : MATURE;
    const base = anchor(mapped, FR.w, FR.h, FR.o[0], FR.o[1], `${sp} mature ${ref}`);
    const id = `tree-${sp}-4-v${v}`;
    const file = writeFrame(id, base);
    const E = (match, extra) => entries.push({ match, file, frame: [FR.w, FR.h], origin: FR.o, place: 'none', ...extra });
    let winterFile = null;
    if (t.bare?.[v] ?? t.bare?.[0]) {
      const bref = t.bare[v] ?? t.bare[v % t.bare.length];
      const bm = mapTree(raw(bref), t, { bare: true });
      dropStrays(bm); // loose twig-tip pixels
      let bare = anchor(bm, FR.w, FR.h, FR.o[0], FR.o[1], `${sp} bare ${bref}`);
      bare = snowDust(bare, { on: t.birch ? [...(t.wood ?? WOOD), '#3e3546', '#625565'] : t.wood ?? WOOD, seed: v + 21 });
      winterFile = writeFrame(`tree-${sp}-4-bare-v${v}`, bare);
    } else if (t.snow) {
      winterFile = writeFrame(`tree-${sp}-4-snow-v${v}`, evergreenSnow(base, leaf, v));
    }
    // fruit variants
    const fruitFiles = [null];
    if (t.fruit) {
      for (let f = 1; f <= 3; f++) {
        const r = addFruit(base, leafSet, t.fruit, t.fruit.count[f - 1], 11 + v);
        if (r.placed < t.fruit.count[f - 1]) notes.push(`${sp} v${v} fruit ${f}: only ${r.placed}/${t.fruit.count[f - 1]} placed`);
        fruitFiles.push(writeFrame(`tree-${sp}-4-v${v}-f${f}`, r.img));
      }
    }
    let blossomFile = null;
    if (t.blossom) blossomFile = writeFrame(`tree-${sp}-4-blossom-v${v}`, addBlossom(base, leafSet, t.blossom.petals, t.blossom.count, 5 + v));
    const add = (match, f, extra = {}) => entries.push({ match, file: f, frame: [FR.w, FR.h], origin: FR.o, place: 'none', ...extra });
    // winter: bare (deciduous) or snowy (evergreen); fruit on a winter tree (greenhouse, snowberry) keeps leaves
    if (t.fruit) {
      for (let f = 1; f <= 3; f++) {
        if (fallMap) add(`tree:${sp}:4:2:${f}:${v}`, fruitFiles[f], { recolor: fallMap });
        if (t.snow && winterFile) add(`tree:${sp}:4:3:${f}:${v}`, writeFrame(`tree-${sp}-4-snow-v${v}-f${f}`, evergreenSnow(fromFile(fruitFiles[f]), leaf, v)));
        add(`tree:${sp}:4:*:${f}:${v}`, fruitFiles[f]);
      }
    }
    if (winterFile) add(`tree:${sp}:4:3:*:${v}`, winterFile);
    if (blossomFile) add(`tree:${sp}:4:0:*:${v}`, blossomFile);
    else if (springMap) add(`tree:${sp}:4:0:*:${v}`, file, { recolor: springMap });
    if (fallMap) add(`tree:${sp}:4:2:*:${v}`, file, { recolor: fallMap });
    add(`tree:${sp}:4:*:*:${v}`, file);
    void E;
  });

  // ---- young (3), sapling (2), sprout (1): same seasons logic on smaller drawings ----
  const small = (stage, refs, bareRefs, F, opts = {}) => {
    if (!refs?.length) return;
    [0, 1, 2].map((v) => refs[v % refs.length]).forEach((ref, v) => {
      const tt = opts.t ?? t;
      let m = mapTree(raw(ref), tt);
      if (tt.clean) m = cleanCanopy(m, new Set(tt.leaf));
      const img = anchor(m, F.w, F.h, F.o[0], F.o[1], `${sp} stage ${stage} ${ref}`);
      const file = writeFrame(`tree-${sp}-${stage}-v${v}`, img);
      const add = (match, f, extra = {}) => entries.push({ match, file: f, frame: [F.w, F.h], origin: F.o, place: 'none', ...extra });
      const vv = `${v}`;
      if (bareRefs?.length) {
        const bref = bareRefs[v % bareRefs.length];
        const bm = mapTree(raw(bref), tt, { bare: true });
        dropStrays(bm);
        let b = anchor(bm, F.w, F.h, F.o[0], F.o[1], `${sp} stage ${stage} bare ${bref}`);
        add(`tree:${sp}:${stage}:3:*:${vv}`, writeFrame(`tree-${sp}-${stage}-bare-v${v}`, b));
      } else if (tt.snow || opts.snow) add(`tree:${sp}:${stage}:3:*:${vv}`, writeFrame(`tree-${sp}-${stage}-snow-v${v}`, evergreenSnow(img, tt.leaf, v, 2)));
      if (springMap && !opts.noSeason) add(`tree:${sp}:${stage}:0:*:${vv}`, file, { recolor: springMap });
      if (fallMap && !opts.noSeason) add(`tree:${sp}:${stage}:2:*:${vv}`, file, { recolor: fallMap });
      add(`tree:${sp}:${stage}:*:*:${vv}`, file);
    });
  };
  small(3, t.young, t.youngBare, YOUNG);
  small(2, t.sapling, t.saplingBare, SAPLING, { t: t.saplingT ? { ...t, ...t.saplingT } : t });
  small(1, t.sprout, null, SAPLING, { noSeason: true, t: t.saplingT ? { ...t, ...t.saplingT } : t });
}
function fromFile(f) { return load(path.join(HERE, f)); }

// ---- seed (stage 0): one planted-seed mound for every species ----
{
  const img = anchor(mapRamps(raw(SEED), { families: [{ name: 'leaf', test: isLeaf, ramp: MOSS }, { name: 'soil', test: any, ramp: WOOD5 }], outlineL: 22 }), SAPLING.w, SAPLING.h, SAPLING.o[0], SAPLING.o[1], 'seed');
  entries.push({ match: 'tree:*:0:**', file: writeFrame('tree-seed', img), frame: [SAPLING.w, SAPLING.h], origin: SAPLING.o, place: 'none' });
}

// ---------------------------------------------------------------- flat objects
// O enum values straight from the game source, so a reordered enum can't silently shift names
const tilemapSrc = fs.readFileSync(path.join(HERE, '../../src/sim/world/tilemap.ts'), 'utf8');
const enumBody = tilemapSrc.slice(tilemapSrc.indexOf('export enum O {') + 15, tilemapSrc.indexOf('}', tilemapSrc.indexOf('export enum O {')));
const O = Object.fromEntries(enumBody.replace(/\/\/.*$/gm, '').split(',').map((s) => s.trim()).filter(Boolean).map((n, i) => [n, i]));

const isGreen = (c) => c.h >= 55 && c.h <= 175 && c.s > 0.2;
const isBrown = (c) => (c.h < 50 || c.h > 330) && c.s > 0.3 && c.v < 0.72;
const accent = { name: 'accent', test: (c) => c.s > 0.3, among: ALL.filter((c) => !['#2e222f'].includes(c)), kL: 2 };
const MATS = {
  stone: [
    { name: 'moss', test: isGreen, ramp: MOSS },
    { name: 'stone', test: any, ramp: STONE },
  ],
  wood: [
    { name: 'leaf', test: isGreen, ramp: MOSS },
    { name: 'wood', test: (c) => (c.h < 60 || c.h > 300) && c.s > 0.12, ramp: WOOD5 },
    { name: 'rest', test: any, ramp: STONE },
  ],
  plant: [
    { name: 'leaf', test: isGreen, ramp: PLANT },
    { name: 'wood', test: isBrown, ramp: WOOD5 },
    accent,
    { name: 'rest', test: any, ramp: STONE },
  ],
  free: [
    { name: 'wood', test: isBrown, ramp: WOOD5 },
    { name: 'any', test: any, among: ALL, kL: 2 },
  ],
  // rock with a mineral: the rock body takes the stone ramp, the bright or saturated bits the accent
  ore: [
    { name: 'stone', test: (c) => c.s < 0.3 && c.L < 70, ramp: STONE },
    { name: 'accent', test: any, among: ALL, kL: 2 },
  ],
  bed: [
    { name: 'leaf', test: isGreen, ramp: PLANT },
    { name: 'wood', test: isBrown, ramp: WOOD5 },
    { name: 'petal', test: any, ramp: ['#9babb2', '#c7dcd0', '#ffffff'] },
  ],
};

/** map + outline + fit into a 16x16 frame (bottom at row 14 for small art, else centered) */
function objFrame(src, mat, tag, extraRamp) {
  if (src.draw) {
    // hand-pixeled: fills from the spec, closed outline added here
    let img = blank(16, 16);
    stamp(img, 0, 0, STICKS[src.draw], STICK_KEY);
    img = outlineOuter(img);
    return src.flipX ? flip(img) : img;
  }
  const ref = typeof src === 'string' ? src : src.ref;
  mat = src.mat ?? mat;
  let fams = MATS[mat];
  if (mat === 'whole') fams = [{ name: 'whole', test: any, ramp: src.ramp ?? extraRamp }];
  // { ref, petal: ramp }: everything that isn't leaf takes the petal ramp (one drawing, any flower color)
  if (src.petal && mat === 'bed') fams = fams.map((F) => (F.name === 'petal' ? { ...F, ramp: src.petal } : F));
  else if (src.petal) fams = [MATS.plant[0], { name: 'petal', test: any, ramp: src.petal }];
  // { ref, accent: ramp }: the saturated accents (berries, caps) take that ramp
  if (src.accent) fams = fams.map((F) => (F.name === 'accent' ? { name: 'accent', test: F.test, ramp: src.accent } : F));
  let img = mapRamps(raw(ref), { families: fams, outlineL: 26 });
  if (src.flipX) img = flip(img);
  const b = bbox(img);
  const cut = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  if (cut.w > 16 || cut.h > 16) notes.push(`${tag}: ${cut.w}x${cut.h} does not fit 16x16`);
  const out = blank(16, 16);
  const dx = Math.floor((16 - cut.w) / 2);
  const dy = cut.h <= 13 ? 14 - cut.h : Math.floor((16 - cut.h) / 2) + (16 - cut.h) % 2;
  blit(out, cut, dx, dy);
  return out;
}

// preview mode: node art/nature/build.mjs --preview <batch> <mat> <outdir>  (every slot of a batch mapped as one material)
if (process.argv[2] === '--preview') {
  const [, , , batch, mat, outDir] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(RAW, batch))) if (f.endsWith('.png')) save(path.join(outDir, f), objFrame(mat.startsWith('petal:') ? { ref: `${batch}/${f.slice(0, -4)}`, petal: JSON.parse(mat.slice(6)) } : `${batch}/${f.slice(0, -4)}`, mat.startsWith('petal:') ? 'plant' : mat, f));
  console.log('preview written');
  process.exit(0);
}

function flip(img) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = get(img, x, y); if (c) set(out, img.w - 1 - x, y, c); }
  return out;
}

const OFALLMAP = { amber: FALL.amber, olive: FALL.olive, red: FALL.red, gold: FALL.gold };
for (const [oname, spec] of Object.entries(OBJECTS)) {
  const o = O[oname];
  if (o === undefined) { notes.push(`unknown object ${oname}`); continue; }
  const ramp = spec.ramp ?? PLANT;
  const vs = spec.byData || spec.v.length >= 3 ? spec.v : [0, 1, 2].map((k) => spec.v[k % spec.v.length]);
  vs.forEach((ref, v) => {
    const id = `o-${oname.toLowerCase()}-v${v}`;
    const img = objFrame(ref, spec.mat, `${oname} v${v} ${ref.ref ?? ref.draw ?? ref}`, spec.ramp);
    const file = writeFrame(id, img);
    const add = (match, f, extra = {}) => entries.push({ match, file: f, frame: [16, 16], origin: [0, 0], place: 'none', ...extra });
    // winter
    const w = spec.winter;
    if (w === 'snow') add(`o:${o}:${v}:3`, writeFrame(id + '-snow', snowcap(img, { seed: v + o })));
    else if (w === 'snowThin') add(`o:${o}:${v}:3`, writeFrame(id + '-snow', snowcap(img, { seed: v + o, thick: 2, deep: 0, on: ['#cd683d', '#e6904e', '#9e4539'] })));
    else if (w === 'dry') add(`o:${o}:${v}:3`, file, { recolor: rampMap(ramp, DRY) });
    else if (w?.ref) {
      if (v === 0) add(`o:${o}:*:3`, writeFrame(`o-${oname.toLowerCase()}-winter`, objFrame(w.ref, w.mat ?? spec.mat, `${oname} winter`)));
    }
    if (spec.fall) add(`o:${o}:${v}:2`, file, { recolor: rampMap(ramp, OFALLMAP[spec.fall]) });
    if (spec.spring === 'fresh') add(`o:${o}:${v}:0`, file, { recolor: rampMap(ramp, SPRING.fresh) });
    add(`o:${o}:${v}:*`, file);
  });
}

// ---------------------------------------------------------------- lamp post and notice board (y-sorted)
function fitAt(img, w, h, cx, bottom, tag) {
  const b = bbox(img);
  const cut = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  const out = blank(w, h);
  const clipped = blit(out, cut, cx - Math.floor(cut.w / 2), bottom - (cut.h - 1));
  if (clipped) notes.push(`${tag}: ${clipped} px clipped (art ${cut.w}x${cut.h} in ${w}x${h})`);
  return out;
}
{
  const GLASS = ['#9babb2', '#c7dcd0', '#ffffff'];
  const lamp = mapRamps(raw(LAMP), { families: [
    { name: 'glass', test: (c) => c.s < 0.25 && c.L > 55, ramp: GLASS },
    { name: 'brass', test: (c) => c.h >= 15 && c.h <= 60 && c.s > 0.35 && c.L > 45, ramp: ['#9e4539', '#cd683d', '#f79617', '#f9c22b'] },
    { name: 'post', test: any, ramp: ['#45293f', '#7a3045', '#9e4539'] },
  ], outlineL: 22 });
  const file = writeFrame('lamp', fitAt(lamp, 16, 32, 8, 31, 'lamp'));
  // lit: the same lamp with its glass glowing (runtime recolor; the renderer adds the light pool)
  entries.push({ match: 'lamp:1', file, frame: [16, 32], origin: [0, 16], place: 'none', recolor: { '#9babb2': '#f79617', '#c7dcd0': '#f9c22b', '#ffffff': '#fbff86' } });
  entries.push({ match: 'lamp:*', file, frame: [16, 32], origin: [0, 16], place: 'none' });
  const board = mapRamps(raw(BOARD), { families: MATS.free, outlineL: 22 });
  // 32 wide (the art is 30): origin moves with it so the board stays centered on its tile
  entries.push({ match: 'board:*', file: writeFrame('board', fitAt(board, 32, 28, 16, 27, 'board')), frame: [32, 28], origin: [8, 12], place: 'none' });
}

// ---------------------------------------------------------------- recipe
const recipe = {
  name: 'nature',
  kind: 'sprites',
  defaults: { keepStrays: true },
  sprites: entries,
};
fs.writeFileSync(path.join(HERE, 'sprites.json'), JSON.stringify(recipe, null, 1).replace(/\n\s+("[^"]+": )?\[\n?\s*([^\]\[{}]*?)\s*\]/g, (m) => m.replace(/\s*\n\s*/g, ' ')) + '\n');
for (const n of notes) console.log('note: ' + n);
console.log(`${entries.length} entries, ${fs.readdirSync(OUT).length} frames`);
