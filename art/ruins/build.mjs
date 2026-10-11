// Tinker's Yard wrecks (O.WRECK = 56): the old tinkers' machines, wrecked where they stood in the
// ruined halls of the ruins farm (src/sim/world/farms.ts); a pickaxe breaks them for salvage.
//
// Names: o:56:<v>:<season>, v 0-3, season 0 spring, 1 summer, 2 fall, 3 winter. Frame 24x24, anchor
// [4, 8]: drawn at the tile's top-left, so it overhangs 4 px each side and 8 px up; the base sits on
// the tile's bottom rows (art bottom-centre at frame 12, 23). The renderer draws the shadow.
//   v0 a toppled boiler, v1 a seized gear press, v2 a rusted clockwork arm on its plinth,
//   v3 a broken loom.
//
// One PixelLab candidate per wreck (raw/W2; both batches and the rejects in raw/batches.json) is
// graded onto the game's ramps by colour family (rust, dull brass, moss, canvas, iron), nearest
// shade in the ramp; lone pixels go, the outline is closed in plum-black, and every season is
// derived from it: summer is the graded art; spring freshens the moss and puts blossom on it; fall
// dries it and drops a few leaves on top; winter mutes it to sage and lays snow on the top
// surfaces. A pick can carry pixel patches (none needed so far). Derelict per STYLE.md "Machines":
// rust, missing plates, no glow.
//
// Usage: node art/ruins/build.mjs   -> art/ruins/sheet.png + art/ruins/sprites.json (recipe),
//                                    e2e/out/ruins-build.png (x4: seasons on cobbles, then on grass)
//        node art/ruins/build.mjs --review [batch:slot,...]   -> e2e/out/ruins-review.png (raw, graded)
// Then: node scripts/sprites-import.mjs art/ruins/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, INK, loadRaw, grade, hash, placeIn, tops } from './tools/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------------------------------------------------------------- ramps (Resurrect 64, dark -> light)
const RUST = ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'];
const BRASS = ['#9e4539', '#cd683d', '#e6904e', '#fbb954']; // old brass, dulled: no gold, no glow
const MOSS = ['#165a4c', '#239063', '#1ebc73', '#91db69'];
const CANVAS = ['#966c6c', '#ab947a', '#fdcbb0'];
const IRON = ['#2e222f', '#3e3546', '#625565', '#7f708a'];
const FAMILIES = [
  { name: 'moss', test: (c) => (c.h >= 58 && c.h < 180 && c.s > 0.2) || (c.h >= 45 && c.h < 58 && c.s > 0.35 && c.L < 48), ramp: MOSS },
  { name: 'canvas', test: (c) => (c.h >= 25 && c.h < 60 && c.s < 0.45 && c.L > 60) || (c.s < 0.28 && c.L > 55), ramp: CANVAS, stretch: true },
  { name: 'brass', test: (c) => c.h >= 31 && c.h < 58 && c.s > 0.35, ramp: BRASS },
  { name: 'iron', test: (c) => c.s < 0.3, ramp: IRON },
  { name: 'rust', test: () => true, ramp: RUST },
];

/** a candidate by 'W2:56' (batch:slot); a bare number is W1 */
const raw = (id) => { const [b, s] = String(id).includes(':') ? String(id).split(':') : ['W1', id]; return loadRaw(path.join(HERE, 'raw', b, s + '.png')); };

if (process.argv.includes('--review')) {
  // every shortlisted candidate raw and graded, x6, for picking
  const slots = (process.argv[process.argv.indexOf('--review') + 1] ?? '0,1,2,10,15,18,20,21,24,25,26,36,38,43,46,47,48,60').split(',');
  const K = +(process.env.K ?? 6), cw = 26;
  // top row: raw on grass; then graded on grass, on the hall's cobbles
  const sheet = new Img(slots.length * cw, cw * 3);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, y >= cw * 2 ? '#ab947a' : '#239063');
  slots.forEach((s, i) => {
    const r = raw(s);
    const ri = new Img(r.w, r.h);
    for (let p = 0; p < r.w * r.h; p++) if (r.data[p * 4 + 3]) ri.px[p] = '#' + [0, 1, 2].map((k) => r.data[p * 4 + k].toString(16).padStart(2, '0')).join('');
    const g = grade(r, FAMILIES, { nearest: true }).im;
    sheet.draw(ri, i * cw + 1, 1);
    sheet.draw(g, i * cw + 1, cw + 1);
    sheet.draw(g, i * cw + 1, cw * 2 + 1);
  });
  sheet.save(path.join(ROOT, 'e2e/out/ruins-review.png'), K);
  console.log('e2e/out/ruins-review.png:', slots.join(' '));
  process.exit(0);
}

// ---------------------------------------------------------------- the picks (raw/batches.json)
// v: [candidate, patches]; a patch is [x, y, colour | null] in the graded candidate's own 24x24
// space, applied before it is placed (fixes the generator's strays and gives a part its colour)
const PICKS = [
  { v: 0, id: 'W2:56', what: 'toppled boiler', patch: [] },
  { v: 1, id: 'W2:2', what: 'seized gear press', patch: [] },
  { v: 2, id: 'W2:32', what: 'clockwork arm on its plinth', patch: [] },
  { v: 3, id: 'W2:50', what: 'broken loom', patch: [] },
];

const W = 24, H = 24, ORIGIN = [4, 8], FOOT = [12, 23]; // art bottom-centre on the tile's bottom row
const PLANT = new Set(MOSS);
// season ramps for the moss and the vine (index-matched to MOSS)
const SPRING = ['#239063', '#1ebc73', '#91db69', '#cddf6c'];
const FALL = ['#4c3e24', '#676633', '#a2a947', '#d5e04b'];
const WINTER = ['#374e4a', '#547e64', '#92a984', '#b2ba90'];
const SNOW = '#ffffff', SNOW2 = '#c7dcd0';
const BLOSSOM = ['#fdcbb0', '#f68181'];
const LEAVES = ['#f9c22b', '#ea4f36', '#e6904e'];

function base(pick) {
  const { im } = grade(raw(pick.id), FAMILIES, { nearest: true });
  for (const [x, y, c] of pick.patch) im.set(x, y, c);
  // a lone pixel with no neighbour is generator noise
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (!im.get(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !im.get(x + dx, y + dy))) im.set(x, y, null);
  }
  // the silhouette's edge is plum-black all round (STYLE: small objects get a closed outline)
  const o = im.clone();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (im.get(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = im.get(x + dx, y + dy); return c && c !== INK; })) o.set(x, y, INK);
  }
  return placeIn(o, W, H, ...FOOT);
}

const recolor = (im, from, to) => { const m = new Map(from.map((c, i) => [c, to[i]])); im.px = im.px.map((c) => (c && m.has(c) ? m.get(c) : c)); return im; };

/** broad top surfaces: a top pixel (clear or outline above) with solid art two more pixels down,
 *  next to another such pixel (so a lone diagonal edge or a thin rod gets nothing) */
function caps(b, ok = () => true) {
  const solid = (x, y) => { const c = b.get(x, y); return c && c !== INK; };
  const top = (x, y) => solid(x, y) && ok(b.get(x, y)) && !solid(x, y - 1) && solid(x, y + 1) && solid(x, y + 2);
  const out = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (top(x, y) && (top(x - 1, y) || top(x + 1, y))) out.push([x, y]);
  return out;
}

function season(b, s, v) {
  const im = b.clone();
  if (s === 1) return im;
  if (s === 0) {
    // spring: fresher moss, and a few of the plant's upper pixels in blossom
    recolor(im, MOSS, SPRING);
    const tips = tops(b, (c) => PLANT.has(c));
    tips.sort((p, q) => hash(p[0], p[1], 11 + v) - hash(q[0], q[1], 11 + v)).slice(0, 3).forEach(([x, y], i) => im.set(x, y, BLOSSOM[i % 2]));
    return im;
  }
  if (s === 2) {
    // fall: the moss and vine dry to olive and gold; a few two-pixel leaves lie on the machine's tops
    recolor(im, MOSS, FALL);
    const spots = caps(b, (c) => !PLANT.has(c)).filter(([x, y]) => caps(b).some(([qx, qy]) => qx === x + 1 && qy === y));
    spots.sort((p, q) => hash(p[0], p[1], 21 + v) - hash(q[0], q[1], 21 + v));
    const used = [];
    for (const [x, y] of spots) {
      if (used.length >= 3) break;
      if (used.some(([ux, uy]) => Math.abs(ux - x) + Math.abs(uy - y) < 5)) continue;
      const [a, c] = [[LEAVES[0], '#cd683d'], [LEAVES[1], '#9e4539'], [LEAVES[2], '#9e4539']][used.length % 3];
      im.set(x, y, a); im.set(x + 1, y, c);
      used.push([x, y]);
    }
    return im;
  }
  // winter: the plants go sage; snow on every top surface at least three pixels deep (as the
  // nature sheet's rocks and stumps have it: art/nature/lib.mjs snowcap), shaded on the right quarter
  recolor(im, MOSS, WINTER);
  const bb = b.bbox();
  const right = bb.x1 - Math.floor(bb.w / 4);
  const solid = (x, y) => { const c = b.get(x, y); return c && c !== INK; };
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!solid(x, y) || solid(x, y - 1) || !solid(x, y + 1) || !solid(x, y + 2)) continue;
    im.set(x, y, x > right ? SNOW2 : SNOW);
    if (hash(x, y, 31 + v) < 0.55 && solid(x, y + 3)) im.set(x, y + 1, SNOW2);
  }
  return im;
}

const out = []; // { name, im, origin }
for (const pick of PICKS) {
  const b = base(pick);
  for (let s = 0; s < 4; s++) out.push({ name: `o:56:${pick.v}:${s}`, im: season(b, s, pick.v), origin: ORIGIN });
}
export { out };

// ---------------------------------------------------------------- output
function preview(file, k = 4) {
  // rows: the four wrecks; columns: seasons on the hall's cobbles, then on grass; a 16 px tile
  // outline marks the footprint the anchor puts them on
  const cw = W + 4, ch = H + 4;
  const sheet = new Img(cw * 8, ch * 4);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) {
    const col = Math.floor(x / cw);
    const cob = (x % 9 === 0) || ((y + (Math.floor(x / 9) % 2) * 4) % 8 === 0);
    sheet.set(x, y, col < 4 ? (cob ? '#625565' : '#ab947a') : ['#239063', '#239063', '#676633', '#c7dcd0'][col - 4]);
  }
  for (const [i, o] of out.entries()) {
    const v = Math.floor(i / 4), s = i % 4;
    for (const half of [0, 1]) sheet.draw(o.im, (s + half * 4) * cw + 2, v * ch + 2);
  }
  sheet.save(file, k);
}

function writeSheet() {
  const cols = 8, gap = 1;
  const sheet = new Img(cols * (W + gap), Math.ceil(out.length / cols) * (H + gap));
  const recipe = {
    name: 'ruins',
    kind: 'sprites',
    meta: { note: "Tinker's Yard wrecks (o:56:<v>:<season>): PixelLab candidates graded and given their seasons by art/ruins/build.mjs (raw/batches.json); do not edit by hand." },
    scale: 1,
    defaults: { file: 'sheet.png', place: 'none', keepStrays: true },
    sprites: [],
  };
  out.forEach((o, i) => {
    const x = (i % cols) * (W + gap), y = Math.floor(i / cols) * (H + gap);
    sheet.draw(o.im, x, y);
    recipe.sprites.push({ match: o.name, rect: [x, y, W, H], frame: [W, H], origin: o.origin });
  });
  sheet.save(path.join(HERE, 'sheet.png'));
  const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + recipe.sprites.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n ]');
  fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSheet();
  preview(path.join(ROOT, 'e2e/out/ruins-build.png'), +(process.argv.includes('--k') ? process.argv[process.argv.indexOf('--k') + 1] : 4));
  console.log(`${out.length} sprites: ${PICKS.map((p) => `v${p.v} ${p.what} (${p.id})`).join(', ')}`);
}
