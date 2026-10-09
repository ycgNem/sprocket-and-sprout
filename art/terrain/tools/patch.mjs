// Tiling preview for terrain work in progress: draws small made-up maps with the game's dual-grid
// rule (one tile per vertex, Wang corner sets, minority class gives way) from tileset dirs and base
// files, without importing anything.
//
// Usage: node art/terrain/tools/patch.mjs --out e2e/out/terrain/x.png [--scale 3] [--season-map grade.json:2]
//          --set <dir>:<lower>:<upper> … [--base <class>:<file>[@x,y] …] [--maps blob,farm,beach,base:grass]
//   blob      12x12: every set's lower class as a blob inside its upper class
//   farm      12x12: grass with a dirt blob, a path crossing, a pond with a sand shore, a tilled plot
//             with a watered half
//   beach     12x12: grass, sand, water, deep
//   base:<c>  8x8 of class c only (shows base variant repetition)
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { crop, blank, blit, hex, rgbOf } from '../../../scripts/lib/pixel.mjs';

const args = process.argv.slice(2);
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const opt = (k, d) => all(k)[0] ?? d;
const TS = 16;
const out = opt('--out', 'patch.png'), K = +opt('--scale', 3);
const sets = [], bases = {};
const add = (c, img) => { (bases[c] ??= []); if (!bases[c].some((b) => b.data.every((v, i) => v === img.data[i]))) bases[c].push(img); };
for (const s of all('--set')) {
  const [dir, lower, upper] = s.split(/:(?![\\/])/);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const img = decodePNG(fs.readFileSync(path.join(dir, 'tileset.png')));
  const k = img.w / (meta.tileset_data?.tileset_image?.dimensions?.width ?? meta.tileset_image?.dimensions?.width ?? img.w) || 1;
  const st = { lower, upper, tiles: {} };
  for (const t of meta.tileset_data?.tiles ?? meta.tiles) {
    const c = t.corners;
    const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
    const bb = t.bounding_box;
    const tile = crop(img, bb.x * k, bb.y * k, TS, TS);
    (st.tiles[mask] ??= []).push(tile);
    if (mask === 0) add(lower, tile);
    if (mask === 15) add(upper, tile);
  }
  sets.push(st);
}
for (const b of all('--base')) {
  const m = b.match(/^([^:]+):(.+?)(?:@(\d+),(\d+))?$/);
  if (fs.statSync(m[2]).isDirectory()) {
    for (const f of fs.readdirSync(m[2]).filter((f) => /\.png$/i.test(f)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })))
      add(m[1], crop(decodePNG(fs.readFileSync(path.join(m[2], f))), 0, 0, TS, TS));
    continue;
  }
  const img = decodePNG(fs.readFileSync(m[2]));
  if (m[3] !== undefined) add(m[1], crop(img, +m[3], +m[4], TS, TS));
  else for (let y = 0; y + TS <= img.h; y += TS) for (let x = 0; x + TS <= img.w; x += TS) add(m[1], crop(img, x, y, TS, TS));
}
let recolor = null;
const sm = opt('--season-map');
if (sm) {
  const [f, s] = sm.split(/:(?=\d+$)/);
  const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
  const map = cfg.seasons?.[s] ?? {};
  recolor = new Map(Object.entries(map).map(([a, b]) => [a.toLowerCase(), rgbOf(b.toLowerCase())]));
}
const rc = (img) => {
  if (!recolor) return img;
  const o = { ...img, data: new Uint8Array(img.data) };
  for (let i = 0; i < o.data.length; i += 4) { const to = recolor.get(hex(o.data[i], o.data[i + 1], o.data[i + 2])); if (to) o.data.set(to, i); }
  return o;
};

const PRIO = { deep: 0, water: 1, sand: 2, dirt: 3, path: 4, soil: 5, wet: 6, grass: 7 };
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
    const lo = kinds[0], hi = kinds[kinds.length - 1];
    cs = cs.map((c) => (c === lo ? hi : c));
  }
  return null;
}
function render(map, MW, MH) {
  const at = (x, y) => map[Math.max(0, Math.min(MH - 1, y)) * MW + Math.max(0, Math.min(MW - 1, x))];
  const img = blank(MW * TS, MH * TS);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
  for (let vy = 0; vy <= MH; vy++)
    for (let vx = 0; vx <= MW; vx++) {
      const t = vertexTile([at(vx - 1, vy - 1), at(vx, vy - 1), at(vx - 1, vy), at(vx, vy)], hash(vx, vy, 7));
      if (t) blit(img, rc(t), vx * TS - TS / 2, vy * TS - TS / 2);
    }
  return img;
}
const MAPS = {
  blob(st) {
    const N = 12, m = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = st.upper;
      if ((x - 4.5) ** 2 / 9 + (y - 4) ** 2 / 6 < 1) c = st.lower;
      if (x >= 7 && x <= 10 && y >= 7 && y <= 10 && !(x === 10 && y === 7)) c = st.lower;
      if (x === 2 && y >= 8) c = st.lower;
      if (y === 10 && x >= 1 && x <= 4) c = st.lower;
      m.push(c);
    }
    return [m, N, N];
  },
  farm() {
    const N = 12, m = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = 'grass';
      if ((x - 2.5) ** 2 / 4 + (y - 2) ** 2 / 3 < 1) c = 'dirt';
      if (y === 5 || x === 6) c = 'path';
      if (x >= 8 && x <= 11 && y >= 7 && y <= 10) c = y >= 9 ? 'wet' : 'soil';
      if ((x - 2.5) ** 2 + (y - 9) ** 2 < 5.5) c = 'sand';
      if ((x - 2.5) ** 2 + (y - 9) ** 2 < 2.5) c = 'water';
      m.push(c);
    }
    return [m, N, N];
  },
  beach() {
    const N = 12, m = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = y + Math.sin(x * 0.9) * 0.8;
      m.push(d < 4 ? 'grass' : d < 6.5 ? 'sand' : d < 9 ? 'water' : 'deep');
    }
    return [m, N, N];
  },
};
const panels = [];
for (const name of opt('--maps', 'blob').split(',')) {
  if (name === 'blob') for (const st of sets) panels.push(render(...MAPS.blob(st)));
  else if (name.startsWith('base:')) { const c = name.slice(5); panels.push(render(new Array(64).fill(c), 8, 8)); }
  else panels.push(render(...MAPS[name]()));
}
const W = panels.reduce((a, p) => a + p.w + 4, 0), H = Math.max(...panels.map((p) => p.h));
const sheet = blank(W, H);
for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([46, 34, 47, 255], i);
let x = 0;
for (const p of panels) { blit(sheet, p, x, 0); x += p.w + 4; }
const u = upscale(sheet, K);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, encodePNG(u.w, u.h, u.data));
console.log(`${out}: ${panels.length} panel(s); bases ${Object.entries(bases).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
