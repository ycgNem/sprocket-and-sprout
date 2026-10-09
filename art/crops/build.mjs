// Builds art/crops/sprites.json (the sprites-import recipe) from the picks table in picks.mjs, then
// run: node scripts/sprites-import.mjs art/crops/sprites.json
//
// Names drawn by the renderer (src/render/renderer.ts drawSoil, src/render/art/living.ts):
//   crop:<id>:<stage>:<ready>:<variant>:<dead>  stage 0..N-1 growing (ready 0), stage N ripe (ready 1),
//                                               variant = map deco % 3, dead 1 = withered
//   giant:<id>                                  48x48, origin [0, 0], 3x3 tiles
//   fert:<palette index>                        16x16 overlay on the soil tile
//
// Frame: 20x26, origin [2, 10]: the bottom 16 rows are the tile, the plant may rise 10 px above it
// and overhang 2 px left and right (PixelLab's size-24 canvas draws mature plants 18-20 px wide;
// smaller canvases lose the outline). Plant base (lowest art row) on frame row 23 = tile row 13.
// Seeds (stage 0) are one shared look; withered plants are a recolor onto the dry ramp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArt, hex, PAL, rgbOf, lab } from '../../scripts/lib/pixel.mjs';
import { PICKS, SEEDS, GIANTS, FERT } from './picks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');

// crop ids and stage counts straight from the game data
const src = fs.readFileSync(path.join(ROOT, 'src/data/crops.ts'), 'utf8');
const CROPS = [...src.matchAll(/crop\(\{ id: '(\w+)'[^]*?stages: \[([^\]]*)\]/g)].map((m) => ({ id: m[1], N: m[2].split(',').length }));

const FRAME = [20, 26], ORIGIN = [2, 10], AT = [10, 23];
const file = (ref) => `src/${ref}.png`; // "b1/12" -> src/b1/12.png (prep.mjs output of raw/b1/12.png)

// Withered: every color of the sprite onto a dry brown ramp by lightness; the outline stays.
const DRY = ['#45293f', '#4c3e24', '#676633', '#966c6c', '#ab947a'];
function witherMap(ref) {
  const L = loadArt(path.join(here, file(ref)), 'auto');
  const used = new Set();
  const d = L.img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) used.add(hex(d[i], d[i + 1], d[i + 2]));
  const map = {};
  for (const c of used) {
    if (c === '#2e222f') continue;
    const l = lab(rgbOf(c))[0];
    const to = l < 22 ? DRY[0] : l < 36 ? DRY[1] : l < 50 ? DRY[2] : l < 64 ? DRY[3] : DRY[4];
    if (to !== c) map[c] = to;
  }
  return map;
}

const sprites = [];
const add = (e) => sprites.push(e);

// seeds: one look for every crop (stage 0, alive or dead)
SEEDS.forEach((ref, v) => add({ match: `crop:*:0:*:${v}:*`, file: file(ref) }));

for (const { id, N } of CROPS) {
  const p = PICKS[id];
  if (!p) { console.warn(`no picks for ${id}`); continue; }
  // a take is "b1/12" or { ref: "b1/12", recolor: { "#from": "#to" } } (a palette swap at runtime)
  const entry = (match, t) => add({ match, file: file(t.ref ?? t), ...(t.recolor ? { recolor: t.recolor } : {}) });
  const series = (stage, ready, takes) => {
    if (!takes?.length) { console.warn(`${id}: no art for stage ${stage}`); return; }
    if (takes.length === 1) return entry(`crop:${id}:${stage}:${ready}:*:0`, takes[0]);
    for (let v = 0; v < 3; v++) entry(`crop:${id}:${stage}:${ready}:${v}:0`, takes[v % takes.length]);
  };
  for (let s = 1; s < N; s++) series(s, 0, p[s]);
  series(N, 1, p.ripe);
  // withered: the sprout dries as a sprout, anything bigger as the last growing stage
  const ref = (t) => t.ref ?? t;
  const sprout = ref(p[1][0]), late = ref((p.dead ?? p[N - 1])[0]);
  add({ match: `crop:${id}:1:*:*:1`, file: file(sprout), recolor: witherMap(sprout) });
  add({ match: `crop:${id}:*:*:*:1`, file: file(late), recolor: witherMap(late) });
}

for (const [id, ref] of Object.entries(GIANTS)) add({ match: `giant:${id}`, file: file(ref), frame: [48, 48], origin: [0, 0], at: [24, 46] });
for (const [idx, ref] of Object.entries(FERT)) add({ match: `fert:${idx}`, file: file(ref), frame: [16, 16], origin: [0, 0], place: 'center', keepStrays: true });

const recipe = {
  name: 'crops',
  kind: 'sprites',
  defaults: { frame: FRAME, origin: ORIGIN, at: AT },
  sprites,
};
// one sprite per line keeps the diffs readable
const head = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace(/\[\n\s*(\d+),\n\s*(\d+)\n\s*\]/g, '[$1, $2]');
fs.writeFileSync(path.join(here, 'sprites.json'), head.replace('"sprites": []', '"sprites": [\n' + sprites.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n ]') + '\n');
console.log(`art/crops/sprites.json: ${sprites.length} entries for ${CROPS.length} crops`);
