// Terrain import: PixelLab Wang tilesets, base-tile variants, per-tile classes and decals → one
// terrain sheet (src/art/<name>.png + .json) for the renderer's dual-grid ground (see
// src/render/art/sheets.ts, TerrainMeta). Colors snap to the palette.
//
// Usage: node scripts/terrain-import.mjs art/terrain/terrain.json [--force]
//
// Recipe (paths relative to the recipe file):
//   name, kind: "terrain", tile: 16
//   sets         [{ lower, upper, dir }]  dir holds tileset.png + tileset.json (scripts/pl-fetch.mjs
//                tileset). Several sets for the same pair add variants.
//   bases        { class: [file | {file, rect}] }  pure tiles of a class (16x16 each)
//   baseFromSets true: each set's all-lower / all-upper tiles are also base variants
//   tiles        { class: [file | {file, rect}] }  per-tile classes (cliff, planks, woodfloor …)
//   decals       { class | "class@season": [file | {file, rect}] }  small overlays, trimmed to the art
//   seasons      { "2": { "#from": "#to" }, "3": { … } }  recolor of every terrain tile per season
//
// Classes the renderer knows: grass dirt path sand water deep soil wet (Wang) and planks cliff
// cliff_top cliff_base rock ore0-7 minefloor0-2 minewall0-2 lava woodfloor wall wall_upper wall_top.
// Preview: e2e/out/art/<name>.preview.png (every tile) and <name>.demo.png (a made-up map drawn
// with the game's dual-grid rule, in all four seasons).
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG, upscale } from './lib/png.mjs';
import { ROOT, PAL, loadArt, bbox, crop, blank, blit, sameImage, pack, hex, rgbOf } from './lib/pixel.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const recipeFile = path.resolve(args.find((a) => !a.startsWith('--')) ?? '');
if (!fs.existsSync(recipeFile)) { console.error('usage: node scripts/terrain-import.mjs <recipe.json> [--force]'); process.exit(2); }
const R = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
const base = path.dirname(recipeFile);
const TS = R.tile ?? 16;
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
const problems = [], warnings = [];

const memo = new Map();
function art(file) {
  const f = path.resolve(base, file);
  if (!memo.has(f)) {
    const L = loadArt(f, R.scale ?? 'auto');
    const farPct = (100 * L.q.far) / Math.max(1, L.q.opaque);
    if (farPct > 10) problems.push(`${rel(f)}: ${farPct.toFixed(1)}% of pixels far from the palette`);
    else if (farPct > 3) warnings.push(`${rel(f)}: ${farPct.toFixed(1)}% of pixels moved far when snapped`);
    if (L.offGrid / L.blocks > 0.1) problems.push(`${rel(f)}: off the pixel grid`);
    memo.set(f, L);
  }
  return memo.get(f);
}
/** a source entry (file or {file, rect}) as an image */
function cut(src, { trim = false, tag }) {
  const s = typeof src === 'string' ? { file: src } : src;
  const L = art(s.file);
  let img = s.rect ? crop(L.img, ...s.rect) : L.img;
  if (trim) {
    const b = bbox(img);
    if (!b) { problems.push(`${tag}: empty`); return null; }
    img = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  } else if (img.w !== TS || img.h !== TS) {
    if (img.w < TS || img.h < TS) { problems.push(`${tag}: ${img.w}x${img.h}, needs ${TS}x${TS} (give a rect)`); return null; }
    warnings.push(`${tag}: ${img.w}x${img.h} cut to its top-left ${TS}x${TS}; give a rect`);
    img = crop(img, 0, 0, TS, TS);
  }
  return img;
}
function opaque(img) {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) return false;
  return true;
}

// ---- collect ----
const tiles = []; // { img }
const tileOf = (img) => { let t = tiles.find((q) => sameImage(q.img, img)); if (!t) { t = { img }; tiles.push(t); } return t; };
const sets = []; // { lower, upper, tiles: {mask: [tile]} }
const bases = {}; // class -> [tile]
const perTile = {};
const decals = {};
const addTo = (o, k, t) => { (o[k] ??= []); if (!o[k].includes(t)) o[k].push(t); };

for (const s of R.sets ?? []) {
  const dir = path.resolve(base, s.dir);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const list = meta.tileset_data?.tiles ?? meta.tiles ?? meta.data?.tiles;
  if (!Array.isArray(list)) { problems.push(`${s.dir}: tileset.json has no tile list`); continue; }
  const L = art(path.join(s.dir, 'tileset.png'));
  let st = sets.find((q) => q.lower === s.lower && q.upper === s.upper);
  if (!st) { st = { lower: s.lower, upper: s.upper, tiles: {} }; sets.push(st); }
  let n = 0;
  for (const t of list) {
    const c = t.corners ?? {};
    if (Object.values(c).some((v) => v !== 'upper' && v !== 'lower')) { warnings.push(`${s.dir}: tile ${t.id} has a "${Object.values(c).find((v) => v !== 'upper' && v !== 'lower')}" corner, skipped`); continue; }
    const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
    const bb = t.bounding_box ?? { x: 0, y: 0, width: TS, height: TS };
    const k = L.k;
    const img = crop(L.img, bb.x / k, bb.y / k, bb.width / k, bb.height / k);
    if (img.w !== TS || img.h !== TS) { problems.push(`${s.dir}: tile ${t.id} is ${img.w}x${img.h}`); continue; }
    if (!opaque(img)) warnings.push(`${s.dir}: tile ${t.id} (mask ${mask}) has transparent pixels`);
    const tile = tileOf(img);
    (st.tiles[mask] ??= []).push(tile);
    if (R.baseFromSets && mask === 0) addTo(bases, s.lower, tile);
    if (R.baseFromSets && mask === 15) addTo(bases, s.upper, tile);
    n++;
  }
  const missing = [...Array(16).keys()].filter((m) => !st.tiles[m]);
  if (missing.length) problems.push(`${s.lower}->${s.upper} (${s.dir}): no tile for corner masks ${missing.join(', ')}`);
  console.log(`  set ${s.lower} -> ${s.upper}: ${n} tiles from ${rel(dir)}`);
}
for (const [cls, list] of Object.entries(R.bases ?? {})) list.forEach((src, i) => { const img = cut(src, { tag: `bases.${cls}[${i}]` }); if (img) addTo(bases, cls, tileOf(img)); });
for (const [cls, list] of Object.entries(R.tiles ?? {})) list.forEach((src, i) => { const img = cut(src, { tag: `tiles.${cls}[${i}]` }); if (img) addTo(perTile, cls, tileOf(img)); });
for (const [cls, list] of Object.entries(R.decals ?? {})) list.forEach((src, i) => { const img = cut(src, { trim: true, tag: `decals.${cls}[${i}]` }); if (img) { if (img.w > TS || img.h > TS) problems.push(`decals.${cls}[${i}]: ${img.w}x${img.h} is bigger than a tile`); else addTo(decals, cls, tileOf(img)); } });
for (const [s, map] of Object.entries(R.seasons ?? {}))
  for (const [a, b] of Object.entries(map)) if (!PAL.includes(a.toLowerCase()) || !PAL.includes(b.toLowerCase())) problems.push(`seasons.${s}: ${a} -> ${b} is not palette -> palette`);

// coverage report
const WANG = ['grass', 'dirt', 'path', 'sand', 'water', 'deep', 'soil', 'wet'];
const WANTED = [['dirt', 'grass'], ['path', 'grass'], ['water', 'grass'], ['sand', 'grass'], ['water', 'sand'], ['deep', 'water'], ['soil', 'grass'], ['soil', 'dirt'], ['wet', 'soil'], ['wet', 'grass'], ['wet', 'dirt']];
for (const [a, b] of WANTED) if (!sets.some((s) => (s.lower === a && s.upper === b) || (s.lower === b && s.upper === a))) warnings.push(`no set for ${a} <-> ${b} (falls back to a hard edge)`);
for (const c of WANG) if (!bases[c]?.length) warnings.push(`no base tile for ${c}`);
console.log(`  bases: ${Object.entries(bases).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none'}`);
console.log(`  tiles: ${Object.entries(perTile).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none'}`);
console.log(`  decals: ${Object.entries(decals).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none'}`);

for (const w of warnings) console.log('  warning: ' + w);
for (const p of problems) console.log('  PROBLEM: ' + p);
if (problems.length && !force) { console.log(`REJECT ${R.name}: ${problems.length} problem(s). Fix them or pass --force.`); process.exit(1); }

// ---- pack ----
const width = Math.max(128, 2 ** Math.ceil(Math.log2(Math.sqrt(tiles.length * (TS + 1) * (TS + 1)) * 1.2)));
const { pos, height } = pack(tiles.map((t) => t.img), width);
const sheet = blank(width, Math.max(1, height));
tiles.forEach((t, i) => { t.x = pos[i].x; t.y = pos[i].y; blit(sheet, t.img, t.x, t.y); });
const xy = (t) => [t.x, t.y];
const manifest = {
  name: R.name, kind: 'terrain', file: R.name + '.png', palette: 'Resurrect 64', tile: TS,
  bases: Object.fromEntries(Object.entries(bases).map(([k, v]) => [k, v.map(xy)])),
  sets: sets.map((s) => ({ lower: s.lower, upper: s.upper, tiles: Object.fromEntries(Object.entries(s.tiles).map(([m, v]) => [m, v.map(xy)])) })),
  tiles: Object.fromEntries(Object.entries(perTile).map(([k, v]) => [k, v.map(xy)])),
  decals: Object.fromEntries(Object.entries(decals).map(([k, v]) => [k, v.map((t) => [t.x, t.y, t.img.w, t.img.h])])),
  seasons: R.seasons ?? {},
};
const outDir = path.resolve(ROOT, R.out ?? 'src/art');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, R.name + '.png'), encodePNG(sheet.w, sheet.h, sheet.data));
fs.writeFileSync(path.join(outDir, R.name + '.json'), JSON.stringify(manifest) + '\n');

// ---- previews ----
const prevDir = path.join(ROOT, 'e2e/out/art');
fs.mkdirSync(prevDir, { recursive: true });
const recolor = (img, map) => {
  if (!map) return img;
  const m = new Map(Object.entries(map).map(([a, b]) => [a.toLowerCase(), rgbOf(b.toLowerCase())]));
  const o = { ...img, data: new Uint8Array(img.data) };
  for (let i = 0; i < o.data.length; i += 4) { if (!o.data[i + 3]) continue; const to = m.get(hex(o.data[i], o.data[i + 1], o.data[i + 2])); if (to) o.data.set(to, i); }
  return o;
};
// 1) every set by mask (4x4) plus bases and tiles in rows
{
  const rows = [];
  for (const s of sets) rows.push([`${s.lower}->${s.upper}`, [...Array(16).keys()].map((m) => s.tiles[m]?.[0]).filter(Boolean)]);
  for (const [k, v] of Object.entries(bases)) rows.push([`base ${k}`, v]);
  for (const [k, v] of Object.entries(perTile)) rows.push([`tile ${k}`, v]);
  for (const [k, v] of Object.entries(decals)) rows.push([`decal ${k}`, v]);
  const W = Math.max(...rows.map((r) => r[1].length)) * (TS + 2), img = blank(W, rows.length * (TS + 2));
  for (let i = 0; i < img.data.length; i += 4) img.data.set([46, 34, 47, 255], i);
  rows.forEach(([, list], r) => list.forEach((t, c) => blit(img, t.img, c * (TS + 2) + 1, r * (TS + 2) + 1)));
  const u = upscale(img, 3);
  fs.writeFileSync(path.join(prevDir, R.name + '.preview.png'), encodePNG(u.w, u.h, u.data));
  console.log(`  preview rows: ${rows.map((r) => r[0]).join(' | ')}`);
}
// 2) a made-up 28x18 map drawn with the dual-grid rule (same as the game), one panel per season
{
  const MW = 28, MH = 18;
  const map = [];
  const PRIO = { deep: 0, water: 1, sand: 2, dirt: 3, path: 4, soil: 5, wet: 6, grass: 7 };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let c = 'grass';
    if ((x - 6) ** 2 / 16 + (y - 5) ** 2 / 9 < 1) c = 'dirt';
    if (y === 11 || (x === 14 && y < 11)) c = 'path';
    if (x >= 20 && y >= 3 && y <= 8 && x <= 25) c = x < 23 ? 'soil' : 'wet';
    if (y >= 14) c = x + y * 0.4 < 14 ? 'sand' : y >= 16 && x > 18 ? 'deep' : 'water';
    if (y === 13 && x > 4 && x < 24) c = 'sand';
    if ((x - 6) ** 2 + (y - 15) ** 2 < 5) c = 'water';
    map.push(c);
  }
  const at = (x, y) => map[Math.max(0, Math.min(MH - 1, y)) * MW + Math.max(0, Math.min(MW - 1, x))];
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const pickV = (list, h) => list[Math.min(list.length - 1, Math.floor(h * list.length))];
  function vertexTile(cs, h) {
    cs = [...cs];
    for (let g = 0; g < 4; g++) {
      const kinds = [...new Set(cs)];
      if (kinds.length === 1) return bases[kinds[0]]?.length ? pickV(bases[kinds[0]], h) : null;
      if (kinds.length === 2) {
        const [a, b] = kinds;
        let st = sets.find((s) => s.lower === a && s.upper === b), up = b;
        if (!st) { st = sets.find((s) => s.lower === b && s.upper === a); up = a; }
        if (st) {
          const mask = (cs[0] === up ? 8 : 0) | (cs[1] === up ? 4 : 0) | (cs[2] === up ? 2 : 0) | (cs[3] === up ? 1 : 0);
          if (st.tiles[mask]) return pickV(st.tiles[mask], h);
        }
      }
      const count = (k) => cs.filter((c) => c === k).length;
      kinds.sort((a, b) => count(a) - count(b) || (PRIO[a] ?? 0) - (PRIO[b] ?? 0));
      const KIN = { soil: 'wet', wet: 'soil', water: 'deep', deep: 'water' };
      const lo = kinds[0], hi = KIN[lo] && kinds.includes(KIN[lo]) ? KIN[lo] : kinds[kinds.length - 1];
      cs = cs.map((c) => (c === lo ? hi : c));
    }
    return null;
  }
  const panels = [0, 1, 2, 3].map((season) => {
    const img = blank(MW * TS, MH * TS);
    for (let vy = 0; vy <= MH; vy++)
      for (let vx = 0; vx <= MW; vx++) {
        const t = vertexTile([at(vx - 1, vy - 1), at(vx, vy - 1), at(vx - 1, vy), at(vx, vy)], hash(vx, vy, 7));
        if (t) blit(img, recolor(t.img, R.seasons?.[String(season)]), vx * TS - TS / 2, vy * TS - TS / 2);
      }
    // decals on tiles whose 3x3 neighborhood is one class
    for (let y = 1; y < MH - 1; y++)
      for (let x = 1; x < MW - 1; x++) {
        const c = at(x, y);
        let same = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== c) same = false;
        const list = decals[`${c}@${season}`] ?? decals[c];
        if (!same || !list?.length || hash(x, y, 3) > 0.22) continue;
        const d = pickV(list, hash(x, y, 5));
        blit(img, recolor(d.img, R.seasons?.[String(season)]), x * TS + Math.floor(hash(x, y, 9) * (TS - d.img.w + 1)), y * TS + Math.floor(hash(x, y, 11) * (TS - d.img.h + 1)));
      }
    return img;
  });
  const demo = blank(MW * TS * 2 + 4, MH * TS * 2 + 4);
  panels.forEach((p, i) => blit(demo, p, (i % 2) * (MW * TS + 4), Math.floor(i / 2) * (MH * TS + 4)));
  const u = upscale(demo, 2);
  fs.writeFileSync(path.join(prevDir, R.name + '.demo.png'), encodePNG(u.w, u.h, u.data));
}
console.log(`${problems.length ? 'FORCED' : 'OK'} ${R.name}: ${rel(path.join(outDir, R.name + '.png'))} (${sheet.w}x${sheet.h}, ${tiles.length} unique tiles); previews e2e/out/art/${R.name}.preview.png and ${R.name}.demo.png (spring, summer / fall, winter)`);
