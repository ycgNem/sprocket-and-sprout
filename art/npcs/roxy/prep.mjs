// Roxy Vane prep: raw PixelLab frames -> palette-exact 48x48 frames in art/npcs/roxy/src/, ready for
// scripts/art-import.mjs (recipe.json, align "none"). Rerun after editing prep.config.mjs:
//
//   node art/npcs/roxy/prep.mjs [--sheet e2e/out/roxy/prep.png]
//
// Why a prep step (same reasons as art/creatures/prep.mjs):
// - colors: the plain nearest-color snap turns her wine-red hair rose-pink (#c32454) and her brown
//   jacket into the hair's reds. Here every source color snaps only to the material ramps in
//   `pal`, with explicit `srcMap` overrides for the big clusters (hair, jacket, skin, fleece).
// - head lock: PixelLab redraws the face in animation frames (the idle turns her head and changes
//   her expression). Every frame listed with `lock` gets the standing pose's head rect pasted at
//   the offset where it matches the frame best, so only the body, the hanging hair and the arms
//   move and the face never flickers.
// - placement: every frame lands on one 48x48 canvas, feet (lowest opaque row) on row `anchor[1]`
//   and the source canvas center on column `anchor[0]` (PixelLab grows canvases evenly around
//   the body), so art-import can copy the frames as they are.
//
// prep.config.mjs (default export { canvas, anchor, pal, srcMap, map, heads, frames }):
//   pal     allowed palette colors for the snap
//   srcMap  { "#source": "#palette" } exact source colors, before snapping
//   map     { "#palette": "#palette" } after snapping (all frames)
//   heads   { dir: { from: <frame out name>, band: [x0, y0, x1, y1] } } the head rect in canvas coordinates
//   frames  [{ out, src, dir?, lock?, flipX?, map?, ops?, shift? }]  out = src/<out>.png
//           lock: paste the head band of heads[dir] (search window ±3 x, ±3 y)
//           ops: [{ set: [[x, y, "#hex"|null], ...] }] edits in canvas coordinates after the lock
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';
import { PAL, PAL_LAB, lab, de2000, rgbOf, hex, detectScale, downscale, bbox, blank, dropStrays } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const cfg = (await import('./prep.config.mjs?' + Date.now())).default;
const [CW, CH] = cfg.canvas, [AX, AY] = cfg.anchor;
const OUT = path.join(HERE, 'src');
fs.mkdirSync(OUT, { recursive: true });

const allowed = cfg.pal.map((h) => { const i = PAL.indexOf(h.toLowerCase()); if (i < 0) throw new Error(h + ' is not a palette color'); return i; });
const lower = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([a, b]) => [a.toLowerCase(), b === null ? null : b.toLowerCase()]));
const SRC = lower(cfg.srcMap), MAP = lower(cfg.map);
const cache = new Map();
const unmapped = new Map();
function snapHex(h) {
  if (h in SRC) return SRC[h];
  if (!cache.has(h)) {
    const L = lab(rgbOf(h));
    let best = allowed[0], bd = Infinity;
    for (const j of allowed) { const d = de2000(L, PAL_LAB[j], cfg.kL ?? 1); if (d < bd) { bd = d; best = j; } }
    cache.set(h, PAL[best]);
  }
  return cache.get(h);
}
const get = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const p = (y * img.w + x) * 4;
  return img.data[p + 3] ? hex(img.data[p], img.data[p + 1], img.data[p + 2]) : null;
};
const set = (img, x, y, h) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const p = (y * img.w + x) * 4;
  if (h === null) img.data.fill(0, p, p + 4);
  else img.data.set([...rgbOf(h), 255], p);
};

function load(file, flipX, extraMap) {
  const png = decodePNG(fs.readFileSync(path.resolve(HERE, file)));
  const img = downscale(png, detectScale(png)).img;
  const out = blank(img.w, img.h);
  const xm = lower(extraMap);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const p = (y * img.w + x) * 4;
      if (img.data[p + 3] < 128) continue;
      const h = hex(img.data[p], img.data[p + 1], img.data[p + 2]);
      if (!(h in SRC)) unmapped.set(h, (unmapped.get(h) ?? 0) + 1);
      let to = snapHex(h);
      if (to === null) continue;
      to = MAP[to] ?? to;
      to = xm[to] ?? to;
      set(out, flipX ? img.w - 1 - x : x, y, to);
    }
  return out;
}

/** source canvas center on the anchor column, lowest opaque row on the anchor row */
function place(img, shift = [0, 0]) {
  const b = bbox(img);
  const dx = AX - Math.floor(img.w / 2) + shift[0], dy = AY - b.y1 + shift[1];
  const out = blank(CW, CH);
  let clipped = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = get(img, x, y);
      if (!c) continue;
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= CW || ty >= CH) { clipped++; continue; }
      set(out, tx, ty, c);
    }
  return { img: out, clipped };
}

/** paste the head rect [x0, y0, x1, y1] of `head` (a placed frame) onto `img` where it matches best */
function lockHead(img, head, [x0, y0, x1, y1]) {
  let best = [0, 0], bs = -Infinity;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      let sc = 0;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const p = get(head, x, y), q = get(img, x + dx, y + dy);
          if (p && q) sc += p === q ? 2 : 0;
          else if (p || q) sc -= 1;
        }
      if (sc > bs || (sc === bs && Math.abs(dx) + Math.abs(dy) < Math.abs(best[0]) + Math.abs(best[1]))) { bs = sc; best = [dx, dy]; }
    }
  const [dx, dy] = best;
  for (let y = y0 + dy; y <= y1 + dy; y++) for (let x = x0 + dx; x <= x1 + dx; x++) set(img, x, y, null);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = get(head, x, y); if (c) set(img, x + dx, y + dy, c); }
  return best;
}

const done = new Map();
const report = [];
for (const f of cfg.frames) {
  let img;
  if (f.from) img = { w: CW, h: CH, data: Uint8Array.from(done.get(f.from).data) };
  else {
    const r = place(load(f.src, f.flipX, f.map), f.shift);
    img = r.img;
    if (r.clipped) report.push(`${f.out}: CLIPPED ${r.clipped}px`);
  }
  let lock = '';
  if (f.lock) {
    const h = cfg.heads[f.dir];
    if (!h) throw new Error(`${f.out}: no head for ${f.dir}`);
    const head = done.get(h.from);
    if (!head) throw new Error(`${f.out}: head ${h.from} is not an earlier frame`);
    lock = ` head ${lockHead(img, head, h.band).join(',')}`;
  }
  for (const op of f.ops ?? []) if (op.set) for (const [x, y, c] of op.set) set(img, x, y, c);
  // isolated single pixels (hair-wisp tips that only touch diagonally) go, as in every sheet
  dropStrays(img);
  done.set(f.out, img);
  const b = bbox(img);
  report.push(`${f.out}: art ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1} at ${b.x0},${b.y0}${lock}`);
  fs.mkdirSync(path.dirname(path.join(OUT, f.out + '.png')), { recursive: true });
  fs.writeFileSync(path.join(OUT, f.out + '.png'), encodePNG(CW, CH, img.data));
}
console.log(report.join('\n'));
if (args.includes('--unmapped')) console.log('snapped by nearest (not in srcMap):\n' + [...unmapped.entries()].sort((a, b) => b[1] - a[1]).map(([h, n]) => `  ${h} ${n} -> ${snapHex(h)}`).join('\n'));

// review sheet: frames in config order, rows broken at `row` boundaries, on grass and soil cells
const sheetFile = opt('--sheet');
if (sheetFile) {
  const rows = [];
  for (const f of cfg.frames) {
    const r = f.out.split('/')[0];
    if (!rows.length || rows[rows.length - 1].name !== r) rows.push({ name: r, list: [] });
    rows[rows.length - 1].list.push(done.get(f.out));
  }
  const cols = Math.max(...rows.map((r) => r.list.length));
  const K = +(opt('--scale') ?? 4);
  const g = blank(cols * (CW + 2), rows.length * (CH + 2));
  for (let i = 0; i < g.data.length; i += 4) {
    const x = (i / 4) % g.w, y = Math.floor(i / 4 / g.w);
    g.data.set((Math.floor(x / (CW + 2)) + Math.floor(y / (CH + 2))) % 2 ? [0x23, 0x90, 0x63, 255] : [0x9e, 0x45, 0x39, 255], i);
  }
  rows.forEach((r, ri) => r.list.forEach((img, ci) => {
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = get(img, x, y); if (c) set(g, ci * (CW + 2) + 1 + x, ri * (CH + 2) + 1 + y, c); }
  }));
  const u = upscale(g, K);
  fs.writeFileSync(path.resolve(sheetFile), encodePNG(u.w, u.h, u.data));
  console.log('sheet ' + sheetFile);
}
