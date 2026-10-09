// Buildings composer: turns chosen PixelLab candidates into final palette-snapped frames, one per
// sprite variant, and writes the sprites-import recipe (art/buildings/sprites.json).
//
// Full rebuild (from the repo root):
//   node art/buildings/tools/hand.mjs       hand-pixeled sprites (hand.json -> raw/)
//   node art/buildings/tools/mkconfig.mjs   per-building choices -> buildings.json
//   node art/buildings/tools/mega.mjs       megaproject stages + construction site -> out/
//   node art/buildings/tools/compose.mjs    buildings + structures -> out/, sprites.json
//   node scripts/sprites-import.mjs art/buildings/sprites.json   -> src/art/buildings.*
// Review: node art/buildings/tools/review.mjs e2e/out/x.png [ids] (day | night | winter | fall | spring)
//
//   node art/buildings/tools/compose.mjs            (all)   |   ... compose.mjs farmhouse well
//
// Config: art/buildings/buildings.json, one entry per building / structure:
//   kind      "bld" (bld:<id>:<season>:<state>), "st" (st:<id>:*:*:<season>), "cart" (cartw:*)
//   W, H, ox, oy  the frame the renderer expects (procedural size and origin); the art's bottom
//             row lands on row H-1 and its door center on doorTile (frame px). Art wider or taller
//             than the frame grows the frame and shifts the origin, so the footprint stays put.
//   src       candidate PNG (relative to art/buildings), rect [x,y,w,h] optional crop (raw px)
//   remap     {"#from": "#to"} on the whole art after snapping (material fixes)
//   erase     [[x,y,w,h]...] trimmed-art rects to clear (baked ground, stray grass)
//   paint     [[x,y,w,h,"#hex"]...] recolor the opaque pixels of trimmed-art rects
//   doorX     door center column in trimmed-art px; doorTile: frame px it must land on
//   dx, dy    extra nudge
//   glass     [[x,y,w,h]...] window rects (trimmed px): cool pixels inside become the glass key
//             ramp, so night is a recolor of three colors nothing else in the frame uses
//   glassKey  three palette colors (dark, mid, light) for the glass (default blues)
//   roof      [[x,y,w,h]...] roof rects: winter turns the roof colors inside them to snow
//   roofColors  colors that count as roof (default: the common colors in the roof rects)
//   props     [[prop, x, y, flip?]...] props from art/buildings/props/ pasted in every season,
//             bottom-center at frame px (x, y) of the footprint frame
//   decor     { "0": [[prop, x, y]...], "2": ..., "3": ... } the same per season
//   roof "auto"  finds the roof colors (upper band) and the eave row; roofY / roofExclude override
//   snowCap   n: the top n opaque pixels of every column turn to snow in winter (gable edges)
//   cutX      [[L, R]...] cut repeating spans out of a wide art (keeps [0,L) + [R,w)), no scaling
//   seasons   which seasons to build (default all four; [1] = one art for every season)
//   states    { "0": {overrides}, "1": {...} } for state-art buildings (clocktower, greenhouse)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, quantize, bbox, crop, blank, blit, rgbOf, dropStrays } from '../../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(here, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(base, 'buildings.json'), 'utf8'));
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
fs.mkdirSync(path.join(base, 'out'), { recursive: true });

const hexAt = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const p = (y * img.w + x) * 4;
  return img.data[p + 3] ? '#' + [0, 1, 2].map((k) => img.data[p + k].toString(16).padStart(2, '0')).join('') : null;
};
const setHex = (img, x, y, h) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const p = (y * img.w + x) * 4;
  if (!h) img.data.fill(0, p, p + 4);
  else img.data.set([...rgbOf(h), 255], p);
};
const lum = (h) => { const [r, g, b] = rgbOf(h); return 0.299 * r + 0.587 * g + 0.114 * b; };
const inRects = (rs, x, y) => (rs ?? []).some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh);
let glassSet = null;
const isCool = (h) => {
  if (glassSet) return glassSet.includes(h);
  const [r, g, b] = rgbOf(h);
  return b > r + 8 || (Math.abs(r - g) < 28 && Math.abs(g - b) < 28 && r > 130);
};

function load(src, rect) {
  const raw = decodePNG(fs.readFileSync(path.resolve(base, src)));
  let img = downscale(raw, detectScale(raw)).img;
  quantize(img);
  if (rect) img = crop(img, ...rect);
  return img;
}
function trim(img) {
  const b = bbox(img);
  return crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
}
const propCache = new Map();
function prop(name) {
  if (!propCache.has(name)) propCache.set(name, trim(load(`props/${name}.png`)));
  return propCache.get(name);
}

const SNOW = ['#7f708a', '#9babb2', '#c7dcd0', '#ffffff'];
const GLASS_DEFAULT = ['#484a77', '#4d9be6', '#8fd3ff'];
const GLOW = ['#e6904e', '#fbb954', '#fbff86'];

export function build(e, season) {
  let art = load(e.src, e.rect);
  for (const [a, b] of Object.entries(e.remap ?? {}))
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (hexAt(art, x, y) === a) setHex(art, x, y, b);
  art = trim(art);
  for (const [x, y, w, h] of e.erase ?? []) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setHex(art, xx, yy, null);
  for (const [x, y, w, h, c] of e.fill ?? []) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setHex(art, xx, yy, c);
  for (const [[x, y, w, h], map] of e.remapPre ?? []) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const c = hexAt(art, xx, yy); if (c && map[c]) setHex(art, xx, yy, map[c]); }
  // cut repeating spans out of a wide art (cutX: [[L, R]...] keeps [0, L) + [R, w), rightmost first)
  for (const [L, R] of [...(e.cutX ?? [])].sort((p, q) => q[0] - p[0])) {
    const out = blank(art.w - (R - L), art.h);
    blit(out, crop(art, 0, 0, L, art.h), 0, 0);
    blit(out, crop(art, R, 0, art.w - R, art.h), L, 0);
    art = out;
  }
  if (e.cutX) art = trim(art);
  for (const [x, y, w, h, c] of e.paint ?? []) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (hexAt(art, xx, yy)) setHex(art, xx, yy, c);
  for (const [x, y, c] of e.pixels ?? []) setHex(art, x, y, c);
  for (const [[x, y, w, h], map] of e.remapIn ?? []) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const c = hexAt(art, xx, yy); if (c && map[c]) setHex(art, xx, yy, map[c]); }
  // the glass key ramp: cool pixels inside the window rects, ranked by lightness
  const gk = e.glassKey ?? GLASS_DEFAULT;
  glassSet = e.glassColors ?? null;
  if (e.glass) {
    const ls = [];
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) { const h = hexAt(art, x, y); if (h && inRects(e.glass, x, y) && isCool(h)) ls.push(lum(h)); }
    ls.sort((a, b) => a - b);
    const t1 = ls[Math.floor(ls.length * (e.glassSplit?.[0] ?? 0.3))] ?? 0, t2 = ls[Math.floor(ls.length * (e.glassSplit?.[1] ?? 0.8))] ?? 255;
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
      const h = hexAt(art, x, y);
      if (!h) continue;
      if (inRects(e.glass, x, y) && e.glassMap && e.glassMap[h] !== undefined) setHex(art, x, y, gk[e.glassMap[h]]);
      else if (inRects(e.glass, x, y) && !e.glassMap && isCool(h)) { const l = lum(h); setHex(art, x, y, l < t1 ? gk[0] : l < t2 ? gk[1] : gk[2]); }
      else if (gk.includes(h)) setHex(art, x, y, e.glassElse?.[h] ?? (h === gk[0] ? '#3e3546' : h === gk[1] ? '#7f708a' : '#c7dcd0'));
    }
    // glint: the top-left pane pixel of every window (and its right neighbour) becomes the light key
    if (e.glint) for (const [rx, ry, rw, rh] of e.glass) {
      let done = false;
      for (let y = ry; y < ry + rh && !done; y++) for (let x = rx; x < rx + rw && !done; x++) if (hexAt(art, x, y) === gk[1]) { setHex(art, x, y, gk[2]); if (hexAt(art, x + 1, y) === gk[1]) setHex(art, x + 1, y, gk[2]); done = true; }
    }
  }
  // winter: the roof colors inside the roof rects turn to snow, keeping their lightness order
  if (season === 3 && e.roof === 'auto') {
    // roof colors: the common colors of the upper band; eave: where they stop dominating the rows
    const y0 = Math.floor(art.h * (e.roofBand?.[0] ?? 0.12)), y1 = Math.floor(art.h * (e.roofBand?.[1] ?? 0.32));
    const n = new Map();
    for (let y = y0; y < y1; y++) for (let x = 0; x < art.w; x++) { const h = hexAt(art, x, y); if (h && h !== '#2e222f') n.set(h, (n.get(h) ?? 0) + 1); }
    const tot = [...n.values()].reduce((a, b) => a + b, 0);
    const rc = [];
    let acc = 0;
    for (const [h, c] of [...n].sort((p, q) => q[1] - p[1])) { if (acc >= tot * (e.roofCover ?? 0.85)) break; rc.push(h); acc += c; }
    let eave = art.h;
    for (let y = y1, low = 0; y < art.h; y++) {
      let o = 0, r = 0;
      for (let x = 0; x < art.w; x++) { const h = hexAt(art, x, y); if (h) { o++; if (rc.includes(h)) r++; } }
      if (o && r / o < 0.3) { if (++low === 3) { eave = y - 2; break; } } else low = 0;
    }
    e = { ...e, roof: [[0, 0, art.w, e.roofY ?? eave]], roofColors: e.roofColors ?? rc };
    if (process.env.ROOFDBG) console.log(`  roof auto: eave ${eave}, colors ${rc.join(' ')}`);
  }
  if (season === 3 && e.roof) {
    let rc = e.roofColors;
    if (!rc) {
      const n = new Map();
      for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) { const h = hexAt(art, x, y); if (h && h !== '#2e222f' && inRects(e.roof, x, y)) n.set(h, (n.get(h) ?? 0) + 1); }
      const tot = [...n.values()].reduce((a, b) => a + b, 0);
      rc = [...n].filter(([, c]) => c > tot * 0.03).map(([h]) => h);
    }
    // by pixel share: the darkest ~20% of the roof pixels become snow shadow, the next ~50% snow,
    // the lightest ~30% bright snow
    const cnt = new Map();
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) { const h = hexAt(art, x, y); if (h && rc.includes(h) && inRects(e.roof, x, y)) cnt.set(h, (cnt.get(h) ?? 0) + 1); }
    const ranks = [...rc].sort((a, b) => lum(a) - lum(b));
    const total = [...cnt.values()].reduce((a, b) => a + b, 0) || 1;
    const snowMap = new Map();
    let cum = 0;
    for (const h of ranks) { const c = cnt.get(h) ?? 0; const mid = (cum + c / 2) / total; snowMap.set(h, mid < (e.snowSplit?.[0] ?? 0.2) ? SNOW[1] : mid < (e.snowSplit?.[1] ?? 0.7) ? SNOW[2] : SNOW[3]); cum += c; }
    const snowOf = (h) => snowMap.get(h) ?? SNOW[2];
    for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
      const h = hexAt(art, x, y);
      if (h && rc.includes(h) && inRects(e.roof, x, y) && !inRects(e.roofExclude, x, y)) setHex(art, x, y, snowOf(h));
    }
  }
  // seasonal props
  if (season === 3 && e.snowCap) {
    for (let x = 0; x < art.w; x++) {
      let y = 0;
      while (y < art.h && !hexAt(art, x, y)) y++;
      if (y >= art.h || inRects(e.roofExclude, x, y)) continue;
      if (hexAt(art, x, y) === '#2e222f') y++;
      for (let k = 0; k < e.snowCap && y + k < art.h; k++) {
        if (!hexAt(art, x, y + k) || hexAt(art, x, y + k) === '#2e222f') break;
        setHex(art, x, y + k, k === 0 ? SNOW[3] : k === e.snowCap - 1 ? SNOW[1] : SNOW[2]);
      }
    }
  }
  dropStrays(art);
  // into the frame
  const W0 = e.W, H0 = e.H;
  const doorX = e.doorX ?? Math.floor(art.w / 2), doorTile = e.doorTile ?? Math.floor(W0 / 2);
  const x0 = doorTile - doorX + (e.dx ?? 0), y0 = H0 - art.h + (e.dy ?? 0);
  const growL = Math.max(0, -x0), growR = Math.max(0, x0 + art.w - W0), growT = Math.max(0, -y0);
  const img = blank(W0 + growL + growR, H0 + growT);
  blit(img, art, x0 + growL, y0 + growT);
  // props (every season) and seasonal decor, bottom-center at frame px (footprint frame, before growth)
  for (const [name, px, py, flip] of [...(e.props ?? []), ...(e.decor?.[String(season)] ?? [])]) {
    const p = prop(name);
    const lost = blit(img, p, px + growL - Math.floor(p.w / 2), py + growT - (p.h - 1), !!flip);
    if (lost) console.log('  warning: prop ' + name + ' clipped by ' + lost + ' px');
  }
  return { img, ox: (e.ox ?? 0) + growL, oy: (e.oy ?? 0) + growT, grow: [growL, growR, growT], art, x0, y0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const recipe = { name: 'buildings', kind: 'sprites', sprites: [] };
  const nightOf = (e) => Object.fromEntries((e.glassKey ?? GLASS_DEFAULT).map((g, i) => [g, GLOW[i]]));
  for (const [id, e0] of Object.entries(cfg)) {
    if (id.startsWith('_')) continue;
    const run = !only.length || only.includes(id);
    const variants = e0.states ? Object.entries(e0.states).map(([st, o]) => [st, { ...e0, ...o }]) : [['*', e0]];
    for (const [st, e] of variants) {
      const seasons = e.seasons ?? [0, 1, 2, 3];
      for (const s of seasons) {
        const file = `out/${id}${st === '*' ? '' : '.' + st}.s${s}.png`;
        let info;
        if (run) {
          const r = build(e, s);
          fs.writeFileSync(path.join(base, file), encodePNG(r.img.w, r.img.h, r.img.data));
          info = { frame: [r.img.w, r.img.h], origin: [r.ox, r.oy] };
          fs.writeFileSync(path.join(base, file + '.json'), JSON.stringify(info));
          if (r.grow.some(Boolean)) console.log(`  ${id}${st === '*' ? '' : '.' + st} s${s}: art ${r.art.w}x${r.art.h} grows the ${e.W}x${e.H} frame by L${r.grow[0]} R${r.grow[1]} T${r.grow[2]}`);
        } else {
          if (!fs.existsSync(path.join(base, file + '.json'))) { console.log(`  skip ${file} (not built yet)`); continue; }
          info = JSON.parse(fs.readFileSync(path.join(base, file + '.json'), 'utf8'));
        }
        const ent = (match, extra = {}) => recipe.sprites.push({ match, file, place: 'none', frame: info.frame, origin: info.origin, keepStrays: true, ...extra });
        const sk = seasons.length === 1 ? '*' : String(s);
        if (e.kind === 'bld') {
          if (st === '*') { ent(`bld:${id}:${sk}:0`); ent(`bld:${id}:${sk}:1`, e.glass ? { recolor: nightOf(e) } : {}); }
          else ent(`bld:${id}:${sk}:${st}`);
        } else if (e.kind === 'st' && e.glass) { ent(`st:${e.id ?? id}:*:0:${sk}`); ent(`st:${e.id ?? id}:*:1:${sk}`, { recolor: nightOf(e) }); }
        else if (e.kind === 'st') ent(`st:${e.id ?? id}:*:*:${sk}`);
        else if (e.kind === 'cart') ent('cartw:**');
      }
    }
  }
  for (const m of cfg._extra ?? []) recipe.sprites.push(m);
  const megaFile = path.join(base, 'out/mega.entries.json');
  if (fs.existsSync(megaFile)) recipe.sprites.push(...JSON.parse(fs.readFileSync(megaFile, 'utf8')));
  fs.writeFileSync(path.join(base, 'sprites.json'), JSON.stringify(recipe, null, 1));
  console.log(`wrote art/buildings/sprites.json (${recipe.sprites.length} entries)`);
}
