// Structure frames: picks the chosen PixelLab candidate (or hand-drawn prop) per structure, builds
// the off frame and the working frames (PixelLab v3 animation composited inside a mask so the rest
// of the sprite never boils, plus scripted effects from fx.mjs), places everything bottom-center in
// the frame the renderer expects (structSize), packs a sheet and writes the sprites-import recipe.
//
// Usage: node art/factory/gen/structs.mjs [--only id,id] (then run sprites-import on art/factory/sprites.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, preview } from './lib.mjs';
import { animate, FX } from './fx.mjs';
import { SPECS } from './specs.mjs';
import { loadArt, dropStrays } from '../../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = path.resolve(HERE, '..');
const ROOT = path.resolve(ART, '../..');

// ---- structure sizes, straight from the game data ----
const structsTs = fs.readFileSync(path.join(ROOT, 'src/render/art/structs.ts'), 'utf8');
const EXTRA_TOP = Object.fromEntries([...structsTs.slice(structsTs.indexOf('EXTRA_TOP'), structsTs.indexOf('};', structsTs.indexOf('EXTRA_TOP'))).matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], +m[2]]));
const dataTs = fs.readFileSync(path.join(ROOT, 'src/data/structures.ts'), 'utf8');
const SIZE = Object.fromEntries([...dataTs.matchAll(/id: '(\w+)'[^}]*?size: \[(\d), (\d)\]/g)].map((m) => [m[1], [+m[2], +m[3]]]));
export function structSize(id) {
  const [w, h] = SIZE[id];
  const top = EXTRA_TOP[id] ?? 4;
  return { W: w * 16, H: h * 16 + top, top };
}

/** load a PNG (PixelLab download or hand-drawn), undo upscaling, snap to the palette */
function load(rel) {
  const L = loadArt(path.join(ART, rel));
  dropStrays(L.img);
  const im = new Img(L.img.w, L.img.h);
  for (let i = 0; i < im.w * im.h; i++) if (L.img.data[i * 4 + 3]) im.px[i] = '#' + [0, 1, 2].map((k) => L.img.data[i * 4 + k].toString(16).padStart(2, '0')).join('');
  return im;
}

/** best offset of `fr` against `base` (pixels outside the mask must agree) */
function align(base, fr, masks) {
  let best = [0, 0], bestScore = Infinity;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    let s = 0;
    for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) {
      if (masks.some((m) => x >= m[0] && y >= m[1] && x < m[0] + m[2] && y < m[1] + m[3])) continue;
      const a = base.get(x, y), b = fr.get(x - dx, y - dy);
      if (!!a !== !!b) s += 2; else if (a !== b) s += 1;
    }
    if (s < bestScore) { bestScore = s; best = [dx, dy]; }
  }
  return best;
}

/** composite the mask region of each PixelLab animation frame onto the base */
function maskedFrames(base, dir, masks, pad = [0, 0, 0, 0]) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    let fr = load(path.join(dir, `${i}.png`));
    if (pad.some(Boolean)) { const p = new Img(fr.w + pad[0] + pad[2], fr.h + pad[1] + pad[3]); p.draw(fr, pad[0], pad[1]); fr = p; }
    const [dx, dy] = align(base, fr, masks);
    const im = base.clone();
    for (const m of masks)
      for (let y = m[1]; y < m[1] + m[3]; y++) for (let x = m[0]; x < m[0] + m[2]; x++) im.px[y * im.w + x] = fr.get(x - dx, y - dy);
    out.push(im);
  }
  return out;
}

function unionBox(frames) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const f of frames) { const b = f.bbox(); if (!b) continue; x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const only = process.argv.includes('--only') ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(',')) : null;
const built = []; // { name, im, origin, match }
const problems = [];

for (const [id, S] of Object.entries(SPECS)) {
  if (only && !only.has(id) && !id.startsWith('bot')) continue;
  let base = S.draw ? S.draw() : load(S.src);
  if (S.pad) { const [l, t, r, b] = S.pad; const p = new Img(base.w + l + r, base.h + t + b); p.draw(base, l, t); base = p; }
  if (S.edit) S.edit(base);
  // frames
  let off = base, on = [base, base, base, base];
  if (S.anim) {
    const anim = maskedFrames(base, S.anim.dir, S.anim.masks, S.pad);
    const fxd = animate(base, S.fx ?? []);
    off = fxd.off;
    on = anim.map((a, f) => { const im = a.clone(); for (const e of S.fx ?? []) if (!e.offOnly) FX[e.t](im, f, e, a); return im; });
  } else if (S.fx) {
    const a = animate(base, S.fx);
    off = a.off; on = a.on;
  }
  if (S.onlyOn) on = on.map((im, f) => (S.onlyOn.includes(f) ? im : on[0]));
  // the same crop for every frame keeps the silhouette still
  const box = unionBox([off, ...on]);
  const crop = (im) => im.crop(box.x0, box.y0, box.w, box.h);
  // frame and origin
  let W, H, top, ox = 0;
  if (S.frame) ({ W, H, top } = { W: S.frame[0], H: S.frame[1], top: S.frame[2] });
  else ({ W, H, top } = structSize(id));
  if (box.w > W) { const extra = box.w - W; if (extra <= (S.overhang ?? 0) * 2) { ox = Math.ceil(extra / 2); W = box.w; } else problems.push(`${id}: art ${box.w} px wide, frame ${W}`); }
  if (box.h > H) { top += box.h - H; H = box.h; }
  // machines never use pure white (STYLE: highlights are #fbff86 or #fdcbb0)
  const place = (im) => { const fr = new Img(W, H); fr.draw(crop(im), Math.floor((W - box.w) / 2) + (S.dx ?? 0), H - box.h + (S.dy ?? 0)); if (!S.keepWhite) fr.recolor({ "#ffffff": "#fdcbb0" }); return fr; };
  const origin = S.origin ?? [ox, top];
  const name = S.name ?? id;
  const frames = { off: place(off), on: on.map(place) };
  const seasonal = S.seasons ? Object.entries(S.seasons).map(([s, fn]) => ({ s, off: place(fn(off.clone(), -1)), on: on.map((im, f) => place(fn(im.clone(), f))) })) : [];
  // chimney mouth relative to the footprint's top-left (renderer smoke anchor)
  const smoke = S.smoke ? [S.smoke[0] - box.x0 + Math.floor((W - box.w) / 2) + (S.dx ?? 0) - origin[0], S.smoke[1] - box.y0 + (H - box.h) + (S.dy ?? 0) - origin[1]] : undefined;
  built.push({ id, name, S, frames, seasonal, origin, W, H, top, smoke });
}

// ---- sheet ----
const items = [];
for (const b of built) {
  items.push({ name: `${b.name}:off`, im: b.frames.off });
  b.frames.on.forEach((im, f) => items.push({ name: `${b.name}:on${f}`, im }));
  for (const s of b.seasonal) { items.push({ name: `${b.name}:s${s.s}:off`, im: s.off }); s.on.forEach((im, f) => items.push({ name: `${b.name}:s${s.s}:on${f}`, im })); }
}
// pack by rows of similar height
const sheetW = 1024;
let x = 0, y = 0, rowH = 0;
const rects = {};
const sorted = [...items].sort((a, b) => b.im.h - a.im.h || b.im.w - a.im.w);
for (const it of sorted) {
  if (x + it.im.w > sheetW) { x = 0; y += rowH + 1; rowH = 0; }
  rects[it.name] = [x, y, it.im.w, it.im.h];
  x += it.im.w + 1; rowH = Math.max(rowH, it.im.h);
}
const sheet = new Img(sheetW, y + rowH);
for (const it of items) sheet.draw(it.im, rects[it.name][0], rects[it.name][1]);
// identical frames share a rect
fs.mkdirSync(path.join(ART, 'structs'), { recursive: true });
sheet.save(path.join(ART, 'structs/structs.png'));

// ---- recipe ----
const sprites = [];
const entry = (match, key, b) => sprites.push({ match, rect: rects[key], frame: [rects[key][2], rects[key][3]], origin: b.origin });
for (const b of built) {
  const n = b.name;
  if (b.S.kind === 'bot') { b.frames.on.forEach((_, f) => sprites.push({ match: `bot:${f}`, rect: rects[`${n}:on${f}`], frame: [b.W, b.H], origin: b.origin })); continue; }
  for (const s of b.seasonal) {
    const mode = b.S.mode ?? "anim";
    if (mode === "static") entry(`st:${b.id}:*:*:${s.s}`, `${n}:s${s.s}:off`, b);
    else if (mode === "always") for (let f = 0; f < 4; f++) entry(`st:${b.id}:${f}:*:${s.s}`, `${n}:s${s.s}:on${f}`, b);
    else { for (let f = 0; f < 4; f++) entry(`st:${b.id}:${f}:1:${s.s}`, `${n}:s${s.s}:on${f}`, b); entry(`st:${b.id}:*:0:${s.s}`, `${n}:s${s.s}:off`, b); }
  }
  const mode = b.S.mode ?? 'anim';
  if (mode === 'static') entry(`st:${b.id}:*:*:*`, `${n}:off`, b);
  else if (mode === 'always') { for (let f = 0; f < 4; f++) entry(`st:${b.id}:${f}:*:*`, `${n}:on${f}`, b); }
  else {
    for (let f = 0; f < 4; f++) entry(`st:${b.id}:${f}:1:*`, `${n}:on${f}`, b);
    entry(`st:${b.id}:*:0:*`, `${n}:off`, b);
  }
}
const recipe = {
  name: 'factory',
  kind: 'sprites',
  meta: { smoke: Object.fromEntries(built.filter((b) => b.smoke).map((b) => [b.id, b.smoke])), note: 'Factory structures: PixelLab bases (art/factory/raw), working frames from PixelLab v3 animations composited inside a mask plus scripted effects (gen/fx.mjs); props drawn by gen/props.mjs. Rebuild: node art/factory/gen/structs.mjs' },
  defaults: { file: 'structs/structs.png', place: 'none', keepStrays: true },
  sprites,
};
fs.writeFileSync(path.join(ART, 'sprites.json'), JSON.stringify(recipe, null, 1));
preview(items.filter((i) => !only || [...only].some((o) => i.name.startsWith(o))), path.join(ROOT, 'e2e/out/factory-structs.png'), 3, 10);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(`structs: ${built.length} structures, ${items.length} frames, ${sprites.length} recipe entries; preview e2e/out/factory-structs.png`);
