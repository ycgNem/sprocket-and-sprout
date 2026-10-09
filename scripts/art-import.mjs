// Art import: turns generated or hand-drawn PNGs (PixelLab exports, Aseprite files) into a game
// sprite sheet. It undoes integer upscaling, checks the pixel grid, drops semi-transparent edge
// pixels, snaps every color to the game palette (src/data/palette.ts), aligns all frames on one
// anchor so the animation doesn't jitter, and writes src/art/<name>.png + <name>.json for
// src/render/art/sheets.ts. Rules it enforces: STYLE.md.
//
// Usage: node scripts/art-import.mjs art/player/recipe.json [--force]
//        node scripts/art-import.mjs --check some.png [more.png …]    (analyze only, write nothing)
//
// Recipe (paths relative to the recipe file):
//   name      output name                          "player"
//   frame     output frame size [w, h]             [32, 32]
//   anchor    pixel the art's bottom-center lands on, in every frame [x, y] (y = the feet's bottom row)
//   rows/cols row and column names of the sheet    ["up","right","down","left"], ["stand","stepA",…]
//   input     { row: [file per column] | "folder/" }  a folder means its PNGs in natural order;
//             a file may repeat, null leaves the frame empty
//   sheet     { file, frame: [w, h] }  alternative to input: cut one sheet laid out rows × cols
//   mirror    { row: otherRow }        build a row by mirroring another (left from right)
//   scale     "auto" (default) or the input's integer upscale factor
//   align     "feet" (default, one offset for all frames) | "feet-per-row" | "feet-per-frame"
//             (each frame's lowest pixel on the anchor row, canvas center on the anchor column:
//             PixelLab frames, whose canvases differ per animation) | "none"
//   height    [min, max] art height in px; outside the range is a warning (STYLE.md heights)
//   parts     { part: { from: ["#source", …], keys: ["#shadow", "#base", "#light"] } }  source colors
//             (as generated, before snapping) that belong to a look part; they become its keys by
//             lightness, and no other pixel may use a key color. Sets `keys` for the manifest.
//   remap     { "#from": "#to" }  applied after snapping: merge each part's colors onto its key ramp
//   keys      { part: ["#shadow", "#base", "#light"] }  palette-swap key colors, copied to the manifest
//   meta      anything else for the manifest (styles, source, notes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from './lib/png.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- palette (the game's own list is the source of truth) ----
const palSrc = fs.readFileSync(path.join(ROOT, 'src/data/palette.ts'), 'utf8');
const PAL = palSrc.slice(palSrc.indexOf('export const PALETTE = ['), palSrc.indexOf('] as const')).match(/#[0-9a-f]{6}/gi).map((h) => h.toLowerCase());
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function lab([r, g, b]) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const X = t((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), Y = t(R * 0.2126 + G * 0.7152 + B * 0.0722), Z = t((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const PAL_LAB = PAL.map((h) => lab(rgbOf(h)));
/**
 * CIEDE2000 with lightness weighted down (kL = 2 by default). Plain nearest-color matching keeps
 * lightness and lets hue drift (Resurrect's dark browns are plum, so brown hair turned purple);
 * this keeps the hue and accepts a lighter or darker step instead. `--kl 1` is the textbook formula.
 */
const KL = +(args[args.indexOf('--kl') + 1] || 0) || 2;
function de2000([L1, a1, b1], [L2, a2, b2], kL = KL) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1 = (Math.atan2(b1, a1p) / rad + 360) % 360, h2 = (Math.atan2(b2, a2p) / rad + 360) % 360;
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = C1p * C2p === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  let hm = h1 + h2;
  if (C1p * C2p !== 0) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T;
  const RT = -2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / (kL * SL)) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const nearCache = new Map();
/** palette indices reserved for palette-swap keys: only part pixels may use them */
let EXCLUDE = new Set();
/** recipe parts: source colors -> key ramp, set when a recipe has `parts` */
let PARTS = null;
function nearest(r, g, b) {
  const k = (r << 16) | (g << 8) | b;
  let n = nearCache.get(k);
  if (!n) {
    const L = lab([r, g, b]);
    let best = 0, bd = Infinity;
    // near-black stays near-black: outlines and pupils keep full lightness weight
    const kl = L[0] < 22 ? 1 : KL;
    PAL_LAB.forEach((p, i) => { if (EXCLUDE.has(i)) return; const d = de2000(L, p, kl); if (d < bd) { bd = d; best = i; } });
    // reported distance: textbook dE00; near-blacks snapping to the plum-black outline count as exact
    n = { i: best, d: L[0] < 22 && best === 0 ? 0 : de2000(L, PAL_LAB[best], 1) };
    nearCache.set(k, n);
  }
  return n;
}

// ---- per-image analysis ----
/** the largest k (≤ 8) for which the image is made of uniform k×k blocks */
function detectScale(img) {
  for (let k = 8; k >= 2; k--) {
    if (img.w % k || img.h % k) continue;
    let ok = true;
    for (let by = 0; by < img.h && ok; by += k)
      for (let bx = 0; bx < img.w && ok; bx += k) {
        const q = (by * img.w + bx) * 4;
        for (let y = by; y < by + k && ok; y++)
          for (let x = bx; x < bx + k; x++) {
            const p = (y * img.w + x) * 4;
            if (img.data[p] !== img.data[q] || img.data[p + 1] !== img.data[q + 1] || img.data[p + 2] !== img.data[q + 2] || (img.data[p + 3] >= 128) !== (img.data[q + 3] >= 128)) { ok = false; break; }
          }
      }
    if (ok) return k;
  }
  return 1;
}
/** sample block centers; returns the image and how many blocks were not uniform */
function downscale(img, k) {
  if (k === 1) return { img, offGrid: 0, blocks: img.w * img.h };
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k), out = new Uint8Array(w * h * 4);
  let offGrid = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = ((y * k + (k >> 1)) * img.w + x * k + (k >> 1)) * 4;
      out.set(img.data.subarray(c, c + 4), (y * w + x) * 4);
      let uniform = true;
      for (let yy = 0; yy < k && uniform; yy++)
        for (let xx = 0; xx < k; xx++) {
          const p = ((y * k + yy) * img.w + x * k + xx) * 4;
          if (Math.abs(img.data[p] - img.data[c]) + Math.abs(img.data[p + 1] - img.data[c + 1]) + Math.abs(img.data[p + 2] - img.data[c + 2]) > 24 || (img.data[p + 3] >= 128) !== (img.data[c + 3] >= 128)) { uniform = false; break; }
        }
      if (!uniform) offGrid++;
    }
  return { img: { w, h, data: out }, offGrid, blocks: w * h };
}
/** threshold alpha and snap colors to the palette, in place; returns stats */
function quantize(img) {
  let semi = 0, far = 0, opaque = 0, sumD = 0, maxD = 0;
  const colorsIn = new Set(), colorsOut = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3];
    if (a > 0 && a < 255) semi++;
    if (a < 128) { img.data.fill(0, i, i + 4); continue; }
    const [r, g, b] = img.data.subarray(i, i + 3);
    colorsIn.add((r << 16) | (g << 8) | b);
    const part = PARTS && partOf(r, g, b);
    if (part) {
      img.data.set([...rgbOf(part), 255], i);
      colorsOut.add(part);
      opaque++;
      continue;
    }
    const n = nearest(r, g, b);
    const [R, G, B] = rgbOf(PAL[n.i]);
    img.data.set([R, G, B, 255], i);
    colorsOut.add(PAL[n.i]);
    opaque++;
    sumD += n.d;
    maxD = Math.max(maxD, n.d);
    if (n.d > 15) far++;
  }
  return { semi, far, opaque, meanD: opaque ? sumD / opaque : 0, maxD, colorsIn: colorsIn.size, colorsOut };
}
/**
 * Part mapping for palette swaps: a source color within dE00 8 of one of a part's listed source
 * colors becomes one of that part's key shades, picked by lightness (the listed colors are split
 * into as many lightness bands as there are keys). Returns the key hex or null.
 */
const partCache = new Map();
function partOf(r, g, b) {
  const k = (r << 16) | (g << 8) | b;
  if (partCache.has(k)) return partCache.get(k);
  const L = lab([r, g, b]);
  let best = null, bd = 8;
  for (const p of PARTS) for (const q of p.probes) { const d = de2000(L, q, 1); if (d < bd) { bd = d; best = p; } }
  const hexKey = best ? best.keys[best.bounds.filter((t) => L[0] > t).length] : null;
  partCache.set(k, hexKey);
  return hexKey;
}
function setParts(parts) {
  PARTS = Object.entries(parts).map(([name, p]) => {
    const probes = p.from.map((h) => lab(rgbOf(h.toLowerCase()))).sort((a, b) => a[0] - b[0]);
    const n = p.keys.length;
    const bounds = [];
    for (let j = 1; j < n; j++) {
      const at = (j * probes.length) / n;
      bounds.push((probes[Math.floor(at) - 1][0] + probes[Math.min(probes.length - 1, Math.floor(at))][0]) / 2);
    }
    return { name, probes, bounds, keys: p.keys.map((h) => h.toLowerCase()) };
  });
  EXCLUDE = new Set(PARTS.flatMap((p) => p.keys.map((h) => PAL.indexOf(h))));
  nearCache.clear();
}
function bbox(img) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.data[(y * img.w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
/** opaque pixels with no opaque 4-neighbor (noise a generator left behind) */
function strays(img) {
  let n = 0;
  const on = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] > 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (on(x, y) && !on(x - 1, y) && !on(x + 1, y) && !on(x, y - 1) && !on(x, y + 1)) n++;
  return n;
}
function load(file, scale) {
  const raw = decodePNG(fs.readFileSync(file));
  const k = scale === 'auto' || scale === undefined ? detectScale(raw) : +scale;
  const ds = downscale(raw, k);
  const q = quantize(ds.img);
  return { file, raw, k, img: ds.img, offGrid: ds.offGrid, blocks: ds.blocks, q, box: bbox(ds.img), strays: strays(ds.img) };
}
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
function describe(L) {
  const b = L.box;
  return `${rel(L.file)}: ${L.raw.w}x${L.raw.h}` + (L.k > 1 ? ` = ${L.img.w}x${L.img.h} upscaled x${L.k}` : '') +
    (L.offGrid ? `, ${L.offGrid}/${L.blocks} blocks off the grid` : '') +
    `, art ${b ? `${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1} at (${b.x0},${b.y0})` : 'EMPTY'}` +
    `, ${L.q.colorsIn} colors -> ${L.q.colorsOut.size}, mean dE ${L.q.meanD.toFixed(1)} max ${L.q.maxD.toFixed(1)}` +
    (L.q.far ? `, ${L.q.far} px far (dE00 > 15)` : '') + (L.q.semi ? `, ${L.q.semi} semi-transparent px` : '') + (L.strays ? `, ${L.strays} stray px` : '');
}

// ---- --check: analyze only ----
if (args[0] === '--check') {
  // --preview out.png: every file as [original | snapped to the palette] at x6, one row each
  const pi = args.indexOf('--preview');
  const files = args.slice(1).filter((a, i) => !a.startsWith('--') && !(pi >= 0 && i + 1 === pi + 1));
  const rowsOut = [];
  for (const f of files) {
    const p = path.resolve(f);
    const L = load(p, 'auto');
    console.log(describe(L));
    if (pi >= 0) {
      const orig = decodePNG(fs.readFileSync(p));
      const o = L.k > 1 ? downscale(orig, L.k).img : orig;
      rowsOut.push([o, L.img]);
    }
  }
  if (pi >= 0) {
    const K = 6, W = Math.max(...rowsOut.map(([a]) => a.w)), H = Math.max(...rowsOut.map(([a]) => a.h));
    const out = { w: W * 2 * K + K, h: H * K * rowsOut.length, data: new Uint8Array((W * 2 * K + K) * H * K * rowsOut.length * 4) };
    for (let i = 0; i < out.data.length; i += 4) out.data.set((((i / 4) % out.w >> 3) + (((i / 4 / out.w) | 0) >> 3)) & 1 ? [58, 52, 64, 255] : [74, 66, 80, 255], i);
    rowsOut.forEach(([a, b], r) => [a, b].forEach((img, c) => {
      const u = upscale(img, K);
      for (let y = 0; y < u.h; y++) for (let x = 0; x < u.w; x++) {
        const s = (y * u.w + x) * 4;
        if (u.data[s + 3] >= 128) out.data.set(u.data.subarray(s, s + 4), ((r * H * K + y) * out.w + c * (W * K + K) + x) * 4);
      }
    }));
    fs.writeFileSync(args[pi + 1], encodePNG(out.w, out.h, out.data));
    console.log('preview: ' + args[pi + 1]);
  }
  process.exit(0);
}

// ---- recipe ----
const recipeFile = path.resolve(args.find((a) => !a.startsWith('--')) ?? '');
if (!fs.existsSync(recipeFile)) { console.error('usage: node scripts/art-import.mjs <recipe.json> [--force] | --check <png…>'); process.exit(2); }
const R = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
const base = path.dirname(recipeFile);
if (R.parts) {
  setParts(R.parts);
  R.keys ??= Object.fromEntries(Object.entries(R.parts).map(([k, p]) => [k, p.keys]));
}
const [FW, FH] = R.frame, [AX, AY] = R.anchor;
const rows = R.rows, cols = R.cols;
const problems = [], warnings = [];
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/** frames[row][col] = loaded image or null */
const frames = rows.map(() => cols.map(() => null));
if (R.sheet) {
  const L = load(path.resolve(base, R.sheet.file), R.scale);
  const [sw, sh] = R.sheet.frame.map((v) => v / L.k);
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < cols.length; c++) {
      if (R.mirror?.[rows[r]]) continue;
      const img = { w: sw, h: sh, data: new Uint8Array(sw * sh * 4) };
      for (let y = 0; y < sh; y++) img.data.set(L.img.data.subarray(((r * sh + y) * L.img.w + c * sw) * 4, ((r * sh + y) * L.img.w + (c + 1) * sw) * 4), y * sw * 4);
      frames[r][c] = { ...L, file: `${L.file}[${rows[r]}.${cols[c]}]`, img, box: bbox(img), strays: strays(img) };
    }
  console.log(describe(L));
} else {
  const memo = new Map();
  for (const [r, row] of rows.entries()) {
    if (R.mirror?.[row]) continue;
    let list = R.input?.[row];
    if (list === undefined) { problems.push(`no input for row "${row}"`); continue; }
    if (typeof list === 'string') {
      const dir = path.resolve(base, list);
      list = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort(natural).map((f) => path.join(dir, f));
    } else list = list.map((f) => (f ? path.resolve(base, f) : null));
    if (list.length < cols.length) warnings.push(`row "${row}": ${list.length} frames for ${cols.length} columns; the rest stay empty`);
    for (let c = 0; c < cols.length; c++) {
      const f = list[c];
      if (!f) continue;
      if (!memo.has(f)) { const L = load(f, R.scale); memo.set(f, L); console.log('  ' + describe(L)); }
      frames[r][c] = memo.get(f);
    }
  }
}

// ---- checks over all inputs ----
const all = frames.flat().filter(Boolean);
const uniq = [...new Set(all)];
// recipe remap: merge snapped colors onto the part ramps ({ "#from": "#to" }, after snapping)
if (R.remap) {
  const map = new Map(Object.entries(R.remap).map(([a, b]) => [a.toLowerCase(), rgbOf(b.toLowerCase())]));
  for (const [a, b] of Object.entries(R.remap)) if (!PAL.includes(b.toLowerCase())) problems.push(`remap target ${b} (from ${a}) is not a palette color`);
  const seen = new Set();
  for (const L of uniq) {
    if (seen.has(L.img)) continue;
    seen.add(L.img);
    for (let i = 0; i < L.img.data.length; i += 4) {
      if (!L.img.data[i + 3]) continue;
      const to = map.get(hex(L.img.data[i], L.img.data[i + 1], L.img.data[i + 2]));
      if (to) L.img.data.set(to, i);
    }
  }
}
for (const L of uniq) {
  const tag = rel(L.file);
  if (!L.box) problems.push(`${tag}: empty frame`);
  if (L.offGrid / L.blocks > 0.1) problems.push(`${tag}: ${Math.round((100 * L.offGrid) / L.blocks)}% of blocks off the pixel grid (anti-aliased or resized by a non-integer factor)`);
  else if (L.offGrid) warnings.push(`${tag}: ${L.offGrid} blocks off the pixel grid`);
  const farPct = (100 * L.q.far) / Math.max(1, L.q.opaque);
  if (farPct > 10) problems.push(`${tag}: ${L.q.far} px (${farPct.toFixed(1)}%) more than dE00 15 from any palette color; regenerate in warmer colors, map them with parts, or repaint`);
  else if (farPct > 2) warnings.push(`${tag}: ${farPct.toFixed(1)}% of pixels moved more than dE00 15 when snapped; check the preview`);
  if (L.q.semi / Math.max(1, L.q.opaque) > 0.05) warnings.push(`${tag}: ${L.q.semi} semi-transparent px were thresholded (soft edges); check the silhouette`);
  if (L.strays > 3) warnings.push(`${tag}: ${L.strays} stray single pixels`);
}
if (new Set(uniq.map((L) => `${L.img.w}x${L.img.h}`)).size > 1) warnings.push('inputs have different canvas sizes; alignment uses each canvas on its own');

// ---- alignment ----
function union(list) {
  const bs = list.map((L) => L.box).filter(Boolean);
  if (!bs.length) return null;
  return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) };
}
const offsets = rows.map((_, r) => {
  const align = R.align ?? 'feet';
  const set = align === 'feet' ? all : frames[r].filter(Boolean);
  if (align === 'feet-per-frame') {
    // every frame's lowest pixel (the planted foot) on the anchor row, the canvas center on the
    // anchor column (PixelLab grows the canvas evenly around the body for tools and poses)
    return (L) => [AX - Math.floor(L.img.w / 2), L.box ? AY - L.box.y1 : 0];
  }
  const u = union(set);
  if (!u || align === 'none') return (L) => [Math.round((FW - L.img.w) / 2), Math.round((FH - L.img.h) / 2)];
  const dx = AX - Math.floor((u.x0 + u.x1 + 1) / 2), dy = AY - u.y1;
  return () => [dx, dy];
});
const U = union(all);
let artHeight = 0;
if (U) {
  // the median frame height: tools raised overhead or a jump frame don't count
  const hs = uniq.filter((L) => L.box).map((L) => L.box.y1 - L.box.y0 + 1).sort((p, q) => p - q);
  const h = hs[hs.length >> 1];
  artHeight = h;
  console.log(`  art box over all frames: ${U.x1 - U.x0 + 1}x${U.y1 - U.y0 + 1}, median frame height ${h}`);
  if (R.height && (h < R.height[0] || h > R.height[1])) warnings.push(`art is ${h} px tall (median frame); STYLE.md wants ${R.height[0]}-${R.height[1]}`);
}

// ---- compose ----
const SW = FW * cols.length, SH = FH * rows.length;
const sheet = { w: SW, h: SH, data: new Uint8Array(SW * SH * 4) };
const put = (L, r, c, mirror) => {
  const [dx, dy] = offsets[r](L);
  let clipped = 0;
  for (let y = 0; y < L.img.h; y++)
    for (let x = 0; x < L.img.w; x++) {
      const p = (y * L.img.w + x) * 4;
      if (!L.img.data[p + 3]) continue;
      let tx = x + dx;
      const ty = y + dy;
      if (mirror) tx = FW - 1 - tx;
      if (tx < 0 || ty < 0 || tx >= FW || ty >= FH) { clipped++; continue; }
      sheet.data.set(L.img.data.subarray(p, p + 4), ((r * FH + ty) * SW + c * FW + tx) * 4);
    }
  if (clipped) problems.push(`${rows[r]}.${cols[c]}: ${clipped} px fall outside the ${FW}x${FH} frame; enlarge the frame or move the anchor`);
};
for (let r = 0; r < rows.length; r++) {
  const from = R.mirror?.[rows[r]];
  const src = from !== undefined ? rows.indexOf(from) : r;
  if (src < 0) { problems.push(`mirror source "${from}" is not a row`); continue; }
  for (let c = 0; c < cols.length; c++) {
    const L = frames[src][c];
    if (!L) continue;
    // a mirrored row keeps the source row's offset, then flips around the frame
    if (from !== undefined) { const o = offsets[r]; offsets[r] = offsets[src]; put(L, r, c, true); offsets[r] = o; }
    else put(L, r, c, false);
  }
}

// ---- palette-swap keys ----
const used = new Set();
for (let i = 0; i < sheet.data.length; i += 4) if (sheet.data[i + 3]) used.add(hex(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]));
if (R.keys) {
  const owner = new Map();
  for (const [part, ks] of Object.entries(R.keys))
    for (const k of ks) {
      const kk = k.toLowerCase();
      if (!PAL.includes(kk)) problems.push(`key ${part} ${k} is not a palette color`);
      if (owner.has(kk)) problems.push(`key ${k} is in both ${owner.get(kk)} and ${part}; a palette swap would recolor both`);
      owner.set(kk, part);
      if (!used.has(kk)) warnings.push(`key ${part} ${k} does not appear in the sheet`);
    }
  console.log('  keys: ' + Object.entries(R.keys).map(([p, ks]) => `${p} ${ks.filter((k) => used.has(k.toLowerCase())).length}/${ks.length}`).join(', '));
}

// ---- write ----
const outDir = path.resolve(ROOT, R.out ?? 'src/art');
const prevDir = path.join(ROOT, 'e2e/out/art');
fs.mkdirSync(prevDir, { recursive: true });
for (const w of warnings) console.log('  warning: ' + w);
for (const p of problems) console.log('  PROBLEM: ' + p);
if (problems.length && !force) {
  console.log(`REJECT ${R.name}: ${problems.length} problem(s). Fix them or pass --force.`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, R.name + '.png'), encodePNG(SW, SH, sheet.data));
const manifest = { name: R.name, file: R.name + '.png', palette: 'Resurrect 64', frame: R.frame, anchor: R.anchor, artHeight, rows, cols, ...(R.keys ? { keys: R.keys } : {}), ...(R.meta ?? {}), colors: [...used].sort() };
fs.writeFileSync(path.join(outDir, R.name + '.json'), JSON.stringify(manifest, null, 2) + '\n');
// previews: the sheet at x4 on a checkerboard, and with every swap key painted a loud color so leaks show
const checker = (img) => {
  const o = { ...img, data: new Uint8Array(img.data) };
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const p = (y * o.w + x) * 4; if (!o.data[p + 3]) o.data.set(((x >> 2) + (y >> 2)) & 1 ? [58, 52, 64, 255] : [74, 66, 80, 255], p); }
  return o;
};
fs.writeFileSync(path.join(prevDir, R.name + '.preview.png'), (({ w, h, data }) => encodePNG(w, h, data))(checker(upscale(sheet, 4))));
if (R.keys) {
  const LOUD = [[255, 0, 255], [0, 255, 255], [255, 255, 0], [0, 255, 0], [255, 128, 0], [0, 128, 255]];
  const swap = new Map();
  Object.values(R.keys).forEach((ks, i) => ks.forEach((k, j) => swap.set(k.toLowerCase(), LOUD[i % LOUD.length].map((v) => Math.round(v * (0.55 + 0.225 * j))))));
  const t = { ...sheet, data: new Uint8Array(sheet.data) };
  for (let i = 0; i < t.data.length; i += 4) if (t.data[i + 3]) { const s = swap.get(hex(t.data[i], t.data[i + 1], t.data[i + 2])); if (s) t.data.set(s, i); }
  fs.writeFileSync(path.join(prevDir, R.name + '.swaptest.png'), (({ w, h, data }) => encodePNG(w, h, data))(checker(upscale(t, 4))));
}
console.log(`${problems.length ? 'FORCED' : 'OK'} ${R.name}: ${rel(path.join(outDir, R.name + '.png'))} (${SW}x${SH}, ${rows.length}x${cols.length} frames of ${FW}x${FH}, ${used.size} colors), previews in e2e/out/art/`);
