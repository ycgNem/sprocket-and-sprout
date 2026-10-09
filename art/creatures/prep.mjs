// Creature prep: raw PixelLab PNGs -> palette-exact, frame-sized PNGs in art/creatures/src/, ready
// for scripts/sprites-import.mjs (entries with place "none"). Rerun after editing prep.config.mjs:
//
//   node art/creatures/prep.mjs [--only <out prefix>] [--sheet out.png [--scale 4] [--cols 8]]
//
// Why a prep step: the automatic palette snap turns PixelLab's warm creams into sage green and
// keeps the reddish outlines of small sprites. Here every sprite snaps only to the palette colors
// its material ramps allow (`pal`), with explicit fixes; animation frames are derived from the
// chosen pose in frame coordinates (or aligned to it), so cycles never jitter.
//
// prep.config.mjs (default export { ramps, items }):
//   ramps   { name: ["#hex", ...] }   named palette subsets (`pal` may mix names and hexes)
//   items   in order. Two kinds:
//   A) from a source PNG
//     out      output name (art/creatures/src/<out>.png)
//     src      raw PNG, relative to art/creatures/ (integer upscaling is undone)
//     like     start from an earlier source item's fields (src, pal, srcMap, map, …); fields here win
//     flipX    mirror the source first
//     pal      allowed palette colors (ramp names or hexes); default: whole palette
//     kL       snap lightness weight (default 1: textbook CIEDE2000, keeps light and dark apart)
//     srcMap   { "#source hex": "#palette hex" | "none" } exact source colors, before snapping
//     map      { "#palette": "#palette" } after snapping
//     minPart  drop detached 8-connected bits smaller than this many pixels
//     outline  true: every opaque pixel touching transparency (4-neighbors) becomes #2e222f
//     ops      edits in source coordinates, after snapping and outline (see OPS)
//     canvas   [w, h] output size
//     anchor   [x, y] where the art's bottom-center lands (x = center column, y = lowest row)
//     alignTo  out name of an earlier source item: reuse its translation (same source canvas)
//     autoAlign  with alignTo: feet on the base's ground line, x where the upper body (top 60%,
//              or this fraction) overlaps the base best
//     shift    [dx, dy] extra translation
//     post     edits in output (frame) coordinates, after placement (see OPS)
//   B) derived: { out, from: <earlier out>, post: [...] }  copy that output and edit it in frame
//      coordinates (walk frames, coat markings, open/closed eyes)
//
// OPS
//   { set: [[x, y, "#hex" | null], ...] }
//   { move: [x, y, w, h], by: [dx, dy] }            cut a rectangle, paste it moved
//   { patch: [cx, cy, r], on: ["#hex"...], to: "#hex" }  paint a disc over the listed colors only
//   { recolor: { "#from": "#to" } }
//   { strays: true }                                 drop isolated single pixels
//   { shiftAll: [dx, dy] }                           move everything
//   { sink: { at, by } }            rows above `at` move down `by` and hide behind row `at`
//   { dupRow: y } / { delRow: y }   stretch / squash: repeat or drop row y, rows above it move
//   { dupCol: x } / { delCol: x }   widen / narrow: repeat or drop column x, columns left of it move
//   { walk: { at, legs: [[x0, x1], ...], dx: [..], bob } }
//        rows >= at are legs: pixels with x in legs[i] move by dx[i]; everything else (body, and
//        leg-row pixels outside every leg) rises by bob, and each leg's top row repeats upward to
//        meet it. dx defaults to 0, bob to 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../scripts/lib/png.mjs';
import { PAL, PAL_LAB, lab, de2000, rgbOf, hex, detectScale, downscale, bbox, blank, blit, dropStrays } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only');
const cfg = (await import('./prep.config.mjs?' + Date.now())).default;
const OUT = path.join(HERE, 'src');
fs.mkdirSync(OUT, { recursive: true });

const palOf = (list) => {
  if (!list) return PAL.map((_, i) => i);
  const hexes = list.flatMap((n) => (n.startsWith('#') ? [n] : cfg.ramps[n] ?? (() => { throw new Error('unknown ramp ' + n); })()));
  return [...new Set(hexes.map((h) => { const i = PAL.indexOf(h.toLowerCase()); if (i < 0) throw new Error(h + ' is not a palette color'); return i; }))];
};
const copy = (img) => ({ w: img.w, h: img.h, data: new Uint8Array(img.data) });
const idx = (img, x, y) => (x >= 0 && y >= 0 && x < img.w && y < img.h ? (y * img.w + x) * 4 : -1);
const setPx = (img, x, y, h) => {
  const p = idx(img, x, y);
  if (p < 0) return;
  if (h === null) img.data.fill(0, p, p + 4);
  else img.data.set([...rgbOf(h), 255], p);
};
const getHex = (img, x, y) => {
  const p = idx(img, x, y);
  return p >= 0 && img.data[p + 3] ? hex(img.data[p], img.data[p + 1], img.data[p + 2]) : null;
};

/** remove 8-connected opaque components smaller than n pixels (sparks, specks) */
function dropSmallParts(img, n) {
  const seen = new Uint8Array(img.w * img.h);
  for (let s = 0; s < img.w * img.h; s++) {
    if (seen[s] || !img.data[s * 4 + 3]) continue;
    const comp = [s], st = [s];
    seen[s] = 1;
    while (st.length) {
      const p = st.pop(), x = p % img.w, y = (p - x) / img.w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, q = Y * img.w + X;
        if (X < 0 || Y < 0 || X >= img.w || Y >= img.h || seen[q] || !img.data[q * 4 + 3]) continue;
        seen[q] = 1; comp.push(q); st.push(q);
      }
    }
    if (comp.length < n) for (const p of comp) img.data.fill(0, p * 4, p * 4 + 4);
  }
}

function walkFrame(img, { at, legs, dx = [], bob = 0 }) {
  const out = blank(img.w, img.h);
  const legOf = (x) => legs.findIndex(([a, b]) => x >= a && x <= b);
  const put = (x, y, p) => { const q = idx(out, x, y); if (q >= 0) out.data.set(img.data.subarray(p, p + 4), q); };
  // body first, then legs on top
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const p = idx(img, x, y);
      if (!img.data[p + 3]) continue;
      if (y < at || legOf(x) < 0) put(x, y - bob, p);
    }
  for (let y = at; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const p = idx(img, x, y), i = legOf(x);
      if (!img.data[p + 3] || i < 0) continue;
      const d = dx[i] ?? 0;
      put(x + d, y, p);
      if (y === at) for (let k = 1; k <= bob; k++) { const q = idx(out, x + d, y - k); if (q >= 0 && !out.data[q + 3]) out.data.set(img.data.subarray(p, p + 4), q); }
    }
  return out;
}

function applyOps(img, ops, tag) {
  for (const op of ops ?? []) {
    if (op.set) for (const [x, y, h] of op.set) setPx(img, x, y, h);
    else if (op.move) {
      const [x0, y0, w, h] = op.move, [dx, dy] = op.by;
      const cut = [];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { cut.push([x, y, getHex(img, x, y)]); setPx(img, x, y, null); }
      for (const [x, y, c] of cut) if (c) setPx(img, x + dx, y + dy, c);
    } else if (op.patch) {
      const [cx, cy, r] = op.patch, on = new Set(op.on.map((h) => h.toLowerCase()));
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.01 && on.has(getHex(img, x, y))) setPx(img, x, y, op.to);
    } else if (op.recolor) {
      const m = Object.fromEntries(Object.entries(op.recolor).map(([a, b]) => [a.toLowerCase(), b.toLowerCase()]));
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = getHex(img, x, y); if (c && m[c]) setPx(img, x, y, m[c]); }
    } else if (op.strays) dropStrays(img);
    else if (op.shiftAll) { const o = blank(img.w, img.h); blit(o, img, op.shiftAll[0], op.shiftAll[1]); img.data.set(o.data); }
    else if (op.walk) img.data.set(walkFrame(img, op.walk).data);
    else if (op.sink) {
      // rows above `at` move down by `by` and vanish behind row `at` (a mole sinking into its hole)
      const { at, by } = op.sink, o = blank(img.w, img.h);
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < img.w; x++) {
          const p = idx(img, x, y);
          if (!img.data[p + 3]) continue;
          if (y >= at) { o.data.set(img.data.subarray(p, p + 4), p); continue; }
          if (y + by >= at) continue;
          const q = idx(o, x, y + by);
          if (!o.data[q + 3]) o.data.set(img.data.subarray(p, p + 4), q);
        }
      // the hole rim stays in front
      for (let y = at; y < img.h; y++) for (let x = 0; x < img.w; x++) { const p = idx(img, x, y); if (img.data[p + 3]) o.data.set(img.data.subarray(p, p + 4), p); }
      img.data.set(o.data);
    }
    else if (op.dupRow !== undefined || op.delRow !== undefined || op.dupCol !== undefined || op.delCol !== undefined) {
      // squash and stretch, bottom and right edge fixed: rows above / columns left of the line move
      const o = blank(img.w, img.h), row = op.dupRow ?? op.delRow, col = op.dupCol ?? op.delCol;
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < img.w; x++) {
          const p = idx(img, x, y);
          if (!img.data[p + 3]) continue;
          let tx = x, ty = y;
          if (op.dupRow !== undefined && y <= row) ty = y - 1;
          if (op.delRow !== undefined) { if (y === row) continue; if (y < row) ty = y + 1; }
          if (op.dupCol !== undefined && x <= col) tx = x - 1;
          if (op.delCol !== undefined) { if (x === col) continue; if (x < col) tx = x + 1; }
          const q = idx(o, tx, ty);
          if (q >= 0) o.data.set(img.data.subarray(p, p + 4), q);
          if (op.dupRow !== undefined && y === row) { const r = idx(o, tx, y); if (r >= 0) o.data.set(img.data.subarray(p, p + 4), r); }
          if (op.dupCol !== undefined && x === col) { const r = idx(o, x, ty); if (r >= 0) o.data.set(img.data.subarray(p, p + 4), r); }
        }
      img.data.set(o.data);
    }
    else throw new Error(`${tag}: unknown op ${JSON.stringify(op)}`);
  }
}

function fromSource(it) {
  const png = decodePNG(fs.readFileSync(path.resolve(HERE, it.src)));
  let img = copy(downscale(png, detectScale(png)).img);
  if (it.flipX) { const f = blank(img.w, img.h); blit(f, img, 0, 0, true); img = f; }
  const allowed = palOf(it.pal), kL = it.kL ?? 1;
  const srcMap = Object.fromEntries(Object.entries(it.srcMap ?? {}).map(([a, b]) => [a.toLowerCase(), b.toLowerCase()]));
  const cache = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) { img.data.fill(0, i, i + 4); continue; }
    const h = hex(img.data[i], img.data[i + 1], img.data[i + 2]);
    let to = srcMap[h];
    if (to === 'none') { img.data.fill(0, i, i + 4); continue; }
    if (!to) {
      if (!cache.has(h)) {
        const L = lab(rgbOf(h));
        let best = allowed[0], bd = Infinity;
        for (const j of allowed) { const d = de2000(L, PAL_LAB[j], kL); if (d < bd) { bd = d; best = j; } }
        cache.set(h, PAL[best]);
      }
      to = cache.get(h);
    }
    to = (it.map ?? {})[to] ?? to;
    img.data.set([...rgbOf(to), 255], i);
  }
  if (it.minPart) dropSmallParts(img, it.minPart);
  if (it.outline) {
    const edge = [];
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++)
        if (getHex(img, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !getHex(img, x + a, y + b))) edge.push([x, y]);
    for (const [x, y] of edge) setPx(img, x, y, '#2e222f');
  }
  applyOps(img, it.ops, it.out);
  return img;
}

const done = new Map(); // out -> { item, t, img (frame), pre (source coords) }
const report = [];
for (const raw of cfg.items) {
  let out, it;
  if (raw.from) {
    const f = done.get(raw.from);
    if (!f) throw new Error(`${raw.out}: from ${raw.from} is not an earlier item`);
    it = raw;
    out = copy(f.img);
    applyOps(out, raw.post, raw.out);
    done.set(raw.out, { item: { ...f.item, ...raw }, t: f.t, img: out, pre: f.pre });
  } else {
    const base = raw.like ? done.get(raw.like)?.item : null;
    if (raw.like && !base) throw new Error(`${raw.out}: like ${raw.like} is not an earlier item`);
    it = { ...(base ?? {}), post: undefined, alignTo: undefined, autoAlign: undefined, shift: undefined, ...raw };
    const img = fromSource(it);
    let t;
    if (it.alignTo) {
      const a = done.get(it.alignTo);
      if (!a) throw new Error(`${it.out}: alignTo ${it.alignTo} is not an earlier item`);
      t = [...a.t];
      if (it.autoAlign) {
        const bb = bbox(a.pre), b = bbox(img), dy = bb.y1 - b.y1;
        const top = bb.y0, bot = bb.y0 + Math.round((bb.y1 - bb.y0) * (it.autoAlign === true ? 0.6 : it.autoAlign));
        let best = 0, bs = -Infinity;
        for (let dx = -4; dx <= 4; dx++) {
          let sc = 0;
          for (let y = top; y <= bot; y++)
            for (let x = 0; x < img.w; x++) {
              const p = getHex(a.pre, x, y), q = getHex(img, x - dx, y - dy);
              if (p && q) sc += p === q ? 2 : 1;
              else if (p || q) sc -= 1;
            }
          if (sc > bs || (sc === bs && Math.abs(dx) < Math.abs(best))) { bs = sc; best = dx; }
        }
        t = [t[0] + best, t[1] + dy];
      }
    } else {
      const b = bbox(img);
      if (!b) throw new Error(`${it.out}: empty`);
      const [ax, ay] = it.anchor ?? [Math.floor((it.canvas?.[0] ?? img.w) / 2), (it.canvas?.[1] ?? img.h) - 1];
      t = [ax - Math.floor((b.x0 + b.x1 + 1) / 2), ay - b.y1];
    }
    const [sx, sy] = it.shift ?? [0, 0];
    const [cw, ch] = it.canvas ?? [img.w, img.h];
    out = blank(cw, ch);
    const clipped = blit(out, img, t[0] + sx, t[1] + sy);
    if (clipped) report.push(`  ${it.out}: CLIPPED ${clipped}px`);
    applyOps(out, it.post, it.out);
    done.set(it.out, { item: it, t, img: out, pre: img });
  }
  const colors = new Set();
  for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3]) colors.add(hex(out.data[i], out.data[i + 1], out.data[i + 2]));
  const ob = bbox(out);
  report.push(`${raw.out}: ${out.w}x${out.h}, art ${ob ? `${ob.x1 - ob.x0 + 1}x${ob.y1 - ob.y0 + 1} at ${ob.x0},${ob.y0}` : 'empty'}, ${colors.size} colors`);
  if (!only || raw.out.startsWith(only)) fs.writeFileSync(path.join(OUT, raw.out + '.png'), encodePNG(out.w, out.h, out.data));
}
console.log(report.filter((r) => !only || r.trim().startsWith(only)).join('\n'));

// review sheet: every (filtered) item on alternating grass and soil cells, in order
const sheetFile = opt('--sheet');
if (sheetFile) {
  const items = [...done.entries()].filter(([k]) => !only || k.startsWith(only)).map(([, d]) => d);
  const K = +(opt('--scale') ?? 4), COLS = +(opt('--cols') ?? 8);
  const cw = Math.max(...items.map((d) => d.img.w)) + 2, chh = Math.max(...items.map((d) => d.img.h)) + 2;
  const g = blank(COLS * cw, Math.ceil(items.length / COLS) * chh);
  for (let i = 0; i < g.data.length; i += 4) {
    const x = (i / 4) % g.w, y = Math.floor(i / 4 / g.w);
    const cell = Math.floor(x / cw) + Math.floor(y / chh);
    g.data.set(cell % 2 ? [0x23, 0x90, 0x63, 255] : [0x9e, 0x45, 0x39, 255], i);
  }
  items.forEach((d, i) => blit(g, d.img, (i % COLS) * cw + 1, Math.floor(i / COLS) * chh + 1));
  const u = upscale(g, K);
  fs.writeFileSync(path.resolve(sheetFile), encodePNG(u.w, u.h, u.data));
  console.log('sheet ' + sheetFile);
}
