// Builds the item icon source sheet and the sprites-import recipe from the picks.
//
//   node node_modules/vite-node/vite-node.mjs art/icons/tools/list-items.ts > art/icons/items.tsv   (when items change)
//   node art/icons/tools/build.mjs            -> art/icons/src.png, art/icons/sprites.json, e2e/out/icons-build.png
//   node scripts/sprites-import.mjs art/icons/sprites.json   -> src/art/icons.png + .json
//
// art/icons/picks.json:
//   "<item id>": "B/12"                      raw candidate art/icons/raw/B/12.png (batch/slot)
//   "<item id>": { "src": "B/12", ... }      with options:
//       nudge  [dx, dy]   move the art inside the 16x16 frame after centering
//       kL     number     palette snap lightness weight (default 2)
//       ink    false      keep the generator's outline as is (default: close it in #2e222f)
//       map    {"#a": "#b"}  palette fix-ups applied before the outline pass (whole sprite)
//       px     [[x, y, "#hex" | null], …]  single-pixel touch-ups in final frame coordinates
//       flipX  true       mirror
//       inkEdge true      every edge pixel becomes the outline (art with a light rim)
//       trim   false      keep tips that overflow the 14x14 art box (default: trim thin tips)
//       thin   n          trim lines of up to n opaque pixels (default 2)
//   "<item id>": { "like": "<item id>", "recolor": {"#a": "#b"} }
//       same drawing as another icon with a palette swap; written as a runtime recolor entry
//       (`like` + `recolor` in the recipe), so the family shares one frame in the sheet
//   "<item id>": { "like": "<item id>", "recolor": {...}, "region": [x, y, w, h] }
//       swap limited to a rectangle of the frame (the contents of a jar, not its lid): baked
//       into its own frame
// Families under "families" (see picks.json):
//   { base: "<item id>", key: [colors], members: { id: "<ramp>" } }   runtime recolor: key[i] -> ramp[i]
//       (tool tiers, recipe cards)
//   { src: "B/12", mask: {...} | [{...}, …], members: { id: "<ramp>" | [ramp|null per mask] | null } }
//       baked: the masked pixels (region/colors/inkInterior, see maskOf) map onto the ramp by
//       lightness rank (jam/wine/juice/pickle contents, ore chunks, bar metal, belt tiers…)
// Ramps (shadow -> light, palette colors only) live under "ramps".
// Every item in src/data/items.ts must have a pick; the build lists the missing ones.
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, blank, blit, bbox, rgbOf } from '../../../scripts/lib/pixel.mjs';
import { load, closeOutline, center, copy, px, put, INK, trimTips, lum, inkEdge } from './lib.mjs';

const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const ROOT = path.resolve(HERE, '../..');
const P = JSON.parse(fs.readFileSync(path.join(HERE, 'picks.json'), 'utf8'));

// ---- the item list (id order of src/data/items.ts) ----
const tsv = path.join(HERE, 'items.tsv');
const items = fs.readFileSync(tsv, 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t')[0]);

// ---- expand families: { base, members: { id: { "#a": "#b" } }, region? } ----
const picks = { ...P.icons };
for (const [fname, f] of Object.entries(P.families ?? {})) {
  for (const [id, rc] of Object.entries(f.members)) {
    if (picks[id]) throw new Error(`${id} is picked twice (family ${fname})`);
    if (f.src) picks[id] = { family: fname, ramps: rc };
    else picks[id] = id === f.base ? undefined : { like: f.base, recolor: expandRamp(rc, f), ...(f.region ? { region: f.region } : {}) };
  }
}

// ---- masked families: { src, mask: spec | [spec…], members: { id: ramp | [ramp|null…] | null } } ----
// A mask picks the pixels that change (the jam in the jar, not the lid): region [x, y, w, h] of the
// final frame, colors (default: every non-outline color), inkInterior (also outline-colored pixels
// with four opaque neighbors: dark glass). The masked colors, sorted by lightness, map onto the
// member's ramp by rank, so every member keeps the base's shading. With key: [colors] instead,
// key[i] maps to ramp[i] (tool tiers: the same gray always lands on the same tier shade).
const famBase = new Map();
function maskOf(img, m) {
  const [rx, ry, rw, rh] = m.region ?? [0, 0, 16, 16];
  const set = [];
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    const c = px(img, x, y);
    if (!c) continue;
    if (c === INK) {
      if (m.inkInterior && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => px(img, x + dx, y + dy))) set.push([x, y, c]);
      continue;
    }
    if (!(m.key ?? m.colors) || (m.key ?? m.colors).includes(c)) set.push([x, y, c]);
  }
  return set;
}
function rankRecolor(img, m, ramp) {
  const set = maskOf(img, m);
  if (m.key) { // keyed: key[i] -> ramp[i], whatever the base uses
    for (const [x, y, c] of set) put(img, x, y, ramp[m.key.indexOf(c)] ?? c);
    return set.length;
  }
  const cols = [...new Set(set.map((p) => p[2]))].sort((a, b) => lum(a) - lum(b));
  const n = ramp.length, k = cols.length;
  const to = new Map(cols.map((c, i) => [c, ramp[k === 1 ? Math.round((n - 1) * 0.66) : Math.round((i * (n - 1)) / (k - 1))]]));
  for (const [x, y, c] of set) put(img, x, y, to.get(c));
  return set.length;
}
function familyFrame(id, fname, rc) {
  const f = P.families[fname];
  if (!famBase.has(fname)) famBase.set(fname, fromRaw(fname, typeof f.src === 'string' ? { src: f.src, ...(f.opts ?? {}) } : f.src));
  const base = famBase.get(fname);
  if (!base) return null;
  const img = copy(base);
  const masks = Array.isArray(f.mask) ? f.mask : [f.mask ?? {}];
  const list = Array.isArray(rc) ? rc : [rc];
  masks.forEach((m, i) => {
    const r = list[i];
    if (r === null || r === undefined) return;
    const ramp = typeof r === 'string' ? P.ramps[r] : r;
    if (!ramp) { problems.push(`${id}: unknown ramp ${r}`); return; }
    for (const c of ramp) if (!PAL.includes(c)) problems.push(`${id}: ramp color ${c} is off the palette`);
    if (!rankRecolor(img, m, ramp)) problems.push(`${id}: mask ${i} of family ${fname} selects no pixel`);
  });
  return img;
}
/** a member may give a ramp name instead of a map: the family's `key` ramp maps onto it */
function expandRamp(rc, f) {
  if (typeof rc !== 'string') return rc;
  const to = P.ramps[rc];
  if (!to) throw new Error(`unknown ramp ${rc}`);
  const map = {};
  f.key.forEach((k, i) => { if (k !== to[i]) map[k] = to[i]; });
  return map;
}

const problems = [], notes = [];
const entries = []; // recipe entries in item order

function fromRaw(id, spec) {
  const s = typeof spec === 'string' ? { src: spec } : spec;
  const file = path.join(HERE, 'raw', s.src + '.png');
  if (!fs.existsSync(file)) { problems.push(`${id}: missing ${s.src}.png`); return null; }
  const { img, q } = load(file, s.kL ?? 2);
  if (s.map) for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = px(img, x, y); if (c && s.map[c] !== undefined) put(img, x, y, s.map[c]); }
  if (s.inkEdge) inkEdge(img);
  if (s.ink !== false) closeOutline(img);
  if (s.trim !== false) trimTips(img, 14, s.thin ?? 2);
  let { img: out, w, h, fits } = center(img, 16, 16, s.nudge ?? [0, 0]);
  if (s.flipX) { const f = blank(16, 16); blit(f, out, 0, 0, true); out = f; }
  for (const [x, y, c] of s.px ?? []) put(out, x, y, c);
  if (!fits) problems.push(`${id}: art ${w}x${h} does not fit 16x16 after the nudge`);
  const b = bbox(out);
  if (b && (b.x0 < 1 || b.y0 < 1 || b.x1 > 14 || b.y1 > 14)) notes.push(`${id}: art ${w}x${h} touches the frame edge (no 1 px margin)`);
  const farPct = (100 * q.far) / Math.max(1, q.opaque);
  if (farPct > 25) notes.push(`${id}: ${farPct.toFixed(0)}% of pixels snapped far (${s.src}); check the hue`);
  return out;
}

function recolored(img, map, region) {
  const o = copy(img);
  const [rx, ry, rw, rh] = region ?? [0, 0, 16, 16];
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    const c = px(o, x, y);
    if (c && map[c.toLowerCase()] !== undefined) put(o, x, y, map[c.toLowerCase()]);
  }
  return o;
}

// ---- resolve every item ----
const resolved = new Map();
function resolve(id, stack = []) {
  if (resolved.has(id)) return resolved.get(id);
  if (stack.includes(id)) throw new Error('cycle: ' + stack.join(' > '));
  const spec = picks[id];
  let r = null;
  if (spec === undefined || spec === null) {
    // a family base is picked under "icons"; a member that names itself as base is an error
    if (P.icons[id] === undefined) { problems.push(`${id}: no pick`); resolved.set(id, null); return null; }
  }
  const s = spec ?? P.icons[id];
  if (s.family) {
    const img = familyFrame(id, s.family, s.ramps);
    r = img ? { img, own: true } : null;
  } else if (typeof s === 'string' || s.src) {
    const img = fromRaw(id, s);
    r = img ? { img, own: true } : null;
  } else if (s.like) {
    const base = resolve(s.like, [...stack, id]);
    if (!base) { problems.push(`${id}: base ${s.like} unresolved`); r = null; }
    else {
      const map = Object.fromEntries(Object.entries(s.recolor ?? {}).map(([a, b]) => [a.toLowerCase(), b.toLowerCase()]));
      for (const [a, b] of Object.entries(map)) if (!PAL.includes(a) || !PAL.includes(b)) problems.push(`${id}: recolor ${a} -> ${b} is off the palette`);
      const used = new Set();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = px(base.img, x, y); if (c) used.add(c); }
      const unused = Object.keys(map).filter((a) => !used.has(a));
      if (unused.length && Object.keys(map).length === unused.length) problems.push(`${id}: recolor touches no color of ${s.like}`);
      const img = recolored(base.img, map, s.region);
      // a whole-frame swap of an own-frame base stays a runtime recolor; anything else is baked
      if (!s.region && base.own && !base.recolor) r = { img, like: s.like, ...(Object.keys(map).length ? { recolor: map } : {}) };
      else r = { img, own: true };
    }
  }
  resolved.set(id, r);
  return r;
}
for (const id of items) resolve(id);
for (const id of Object.keys(picks)) if (!items.includes(id)) notes.push(`pick for unknown item ${id}`);

// ---- quality stars (hand-pixeled 7x7, see stars.txt) ----
const starsTxt = fs.readFileSync(path.join(HERE, 'stars.txt'), 'utf8');
const stars = parseStars(starsTxt);

// ---- pack own frames into src.png (16 per row, item order), write the recipe ----
const own = items.filter((id) => resolved.get(id)?.own);
const COLS = 16;
const rows = Math.ceil(own.length / COLS) + 1;
const sheet = blank(COLS * 16, rows * 16);
const rect = new Map();
own.forEach((id, i) => {
  const x = (i % COLS) * 16, y = Math.floor(i / COLS) * 16;
  blit(sheet, resolved.get(id).img, x, y);
  rect.set(id, [x, y, 16, 16]);
});
const starY = (rows - 1) * 16;
stars.forEach((s, i) => blit(sheet, s, i * 8, starY));
fs.writeFileSync(path.join(HERE, 'src.png'), encodePNG(sheet.w, sheet.h, sheet.data));

for (const id of items) {
  const r = resolved.get(id);
  if (!r) continue;
  if (r.own) entries.push({ match: 'i:' + id, rect: rect.get(id) });
  else entries.push({ match: 'i:' + id, like: 'i:' + r.like, ...(r.recolor ? { recolor: r.recolor } : {}) });
}
stars.forEach((_, i) => entries.push({ match: 'q:' + (i + 1), rect: [i * 8, starY, 7, 7], frame: [7, 7] }));
// own frames first, so every like follows its base
entries.sort((a, b) => (a.like ? 1 : 0) - (b.like ? 1 : 0));
const recipe = {
  name: 'icons',
  kind: 'sprites',
  meta: { note: 'Item icons (i:<item id>) and quality stars (q:1..3). Built by art/icons/tools/build.mjs from art/icons/picks.json; do not edit by hand.' },
  scale: 1,
  defaults: { file: 'src.png', frame: [16, 16], place: 'none', keepStrays: true },
  sprites: entries,
};
const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + entries.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n ]');
fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');

// ---- review image: every item in order, x3, on an inventory-slot tan, 24 per row ----
const K = 3, C2 = 24, cell = 18;
const prev = blank(C2 * cell, Math.ceil(items.length / C2) * cell);
for (let i = 0; i < prev.data.length; i += 4) {
  const x = (i / 4) % prev.w, y = Math.floor(i / 4 / prev.w);
  const inner = x % cell >= 1 && x % cell <= 16 && y % cell >= 1 && y % cell <= 16;
  prev.data.set(inner ? rgbOf('#ab947a').concat(255) : [46, 34, 47, 255], i);
}
items.forEach((id, i) => { const r = resolved.get(id); if (r) blit(prev, r.img, (i % C2) * cell + 1, Math.floor(i / C2) * cell + 1); });
const big = blank(prev.w * K, prev.h * K);
for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) { const p = (Math.floor(y / K) * prev.w + Math.floor(x / K)) * 4; big.data.set(prev.data.subarray(p, p + 4), (y * big.w + x) * 4); }
fs.mkdirSync(path.join(ROOT, 'e2e/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'e2e/out/icons-build.png'), encodePNG(big.w, big.h, big.data));

const nOwn = own.length, nLike = entries.filter((e) => e.like).length;
for (const n of notes) console.log('  note: ' + n);
for (const p of problems) console.log('  PROBLEM: ' + p);
console.log(`${items.length} items: ${nOwn} own frames, ${nLike} recolors, ${items.length - nOwn - nLike} missing; art/icons/src.png ${sheet.w}x${sheet.h}; review e2e/out/icons-build.png (24 per row, item order)`);
if (problems.length) process.exit(1);

function parseStars(txt) {
  // blocks of 7 lines of 7 chars; legend line "x=#hex" pairs before each block
  const out = [];
  const blocks = txt.split(/\r?\n\s*\r?\n/).map((b) => b.split(/\r?\n/).filter((l) => !l.startsWith('//')).join('\n').trim()).filter(Boolean);
  for (const b of blocks) {
    const lines = b.split(/\r?\n/).filter((l) => !l.startsWith('//'));
    const legend = Object.fromEntries(lines[0].trim().split(/\s+/).map((p) => p.split('=')));
    const img = blank(7, 7);
    lines.slice(1, 8).forEach((l, y) => [...l.padEnd(7, '.')].slice(0, 7).forEach((ch, x) => { if (ch !== '.') put(img, x, y, legend[ch]); }));
    out.push(img);
  }
  return out;
}
