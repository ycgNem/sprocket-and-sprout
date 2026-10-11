// The town works sheet (src/art/town.*): every sprite src/render/art/townworks.ts answers (the
// `town:` family and st:tram_bin:*), composed from PixelLab art, scripted frames and the baked
// procedural buildings, then handed to scripts/sprites-import.mjs.
//
// Usage (from the repo root; the dev server must run for the bake step):
//   node art/town/tools/bake.mjs           procedural sprites -> art/town/baked/ (mill, rails, pump base)
//   node art/town/build.mjs                -> art/town/out/*.png + art/town/sprites.json (+ e2e/out/town-build.png)
//   node scripts/sprites-import.mjs art/town/sprites.json   -> src/art/town.png + .json
//
// What comes from where (generation records in art/town/raw/batches.json):
//   mill            baked as drawn (it already reads well; DECISIONS: spend nothing on it)
//   wheel           tools/wheel.mjs: drawn by rule after PixelLab map object w2 (8-fold, 4 frames)
//   pump            tools/pump.mjs: the baked house + a scripted walking-beam engine, ivy, moss
//   fountain        tools/fountain.mjs: PixelLab map object f1 (graded) + scripted water frames
//   lamp            tools/lamp.mjs: PixelLab batch d3a36762 slot 8, three states
//   cart            tools/cart.mjs: PixelLab batch 44b7f08c slots 40 + 48, scripted ore heap
//   tram bin, sign  tools/props.mjs: batch d3a36762 slots 32 and 40
//   townline, buffer  tools/props.mjs: hand-pixeled after the batches
//   rails           baked as drawn (their geometry must meet the straight runs and the bend exactly)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, lineup } from './tools/px.mjs';
import { drawWheel } from './tools/wheel.mjs';
import { drawFountain } from './tools/fountain.mjs';
import { drawLamp } from './tools/lamp.mjs';
import { drawCart } from './tools/cart.mjs';
import { drawPump } from './tools/pump.mjs';
import { drawBin, drawSign, drawTownLine, drawBuffer } from './tools/props.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const baked = (n) => Img.load(path.join(HERE, 'baked', n + '.png'), { unscale: false });

const sprites = [];
const files = new Map(); // png name -> image (deduplicated by name)
function add(match, file, img, frame, origin) {
  if (img.w !== frame[0] || img.h !== frame[1]) throw new Error(`${match}: image ${img.w}x${img.h} != frame ${frame}`);
  if (img.offPalette()) throw new Error(`${match}: ${img.offPalette()} colors off the palette`);
  if (!files.has(file)) { files.set(file, img); img.save(path.join(OUT, file + '.png')); }
  sprites.push({ match, file: 'out/' + file + '.png', frame, origin });
}
const seasonKey = (s) => (s === 3 ? 'w' : 'g'); // only winter differs (snow)

// ---- the Town Mill: baked; town:mill:<season>:<state> ----
for (let s = 0; s < 4; s++) for (let st = 0; st < 3; st++) add(`town:mill:${s}:${st}`, `mill_${seasonKey(s)}_${st}`, baked(`town_mill_${s === 3 ? 3 : 0}_${st}`), [112, 140], [0, 44]);

// ---- the wheel: town:wheel:1:<frame>, town:wheel:0:* ----
for (let f = 0; f < 4; f++) add(`town:wheel:1:${f}`, `wheel_on_${f}`, drawWheel(true, f), [72, 72], [36, 36]);
add('town:wheel:0:*', 'wheel_off', drawWheel(false, 0), [72, 72], [36, 36]);

// ---- the pump house: town:pump:<season>:<state>[:<frame>] (the 4-segment name is frame 0) ----
for (let s = 0; s < 4; s++) for (let st = 0; st < 3; st++) {
  const k = `${seasonKey(s)}_${st}`;
  add(`town:pump:${s}:${st}`, `pump_${k}_0`, drawPump(s === 3 ? 3 : 0, st, 0), [80, 102], [0, 38]);
  if (st === 0) add(`town:pump:${s}:0:*`, `pump_${k}_0`, drawPump(s === 3 ? 3 : 0, 0, 0), [80, 102], [0, 38]);
  else for (let f = 0; f < 4; f++) add(`town:pump:${s}:${st}:${f}`, `pump_${k}_${f}`, drawPump(s === 3 ? 3 : 0, st, f), [80, 102], [0, 38]);
}

// ---- the fountain: town:fountain:<on>:<frame>:<season> ----
for (let s = 0; s < 4; s++) {
  for (let f = 0; f < 4; f++) add(`town:fountain:1:${f}:${s}`, `fountain_on_${f}_${seasonKey(s)}`, drawFountain(true, f, s === 3 ? 3 : 0), [48, 58], [0, 26]);
  add(`town:fountain:0:*:${s}`, `fountain_dry_${seasonKey(s)}`, drawFountain(false, 0, s === 3 ? 3 : 0), [48, 58], [0, 26]);
}

// ---- the square's lamps: town:lamp:<state> ----
for (let st = 0; st < 3; st++) add(`town:lamp:${st}`, `lamp_${st}`, drawLamp(st), [16, 44], [0, 28]);

// ---- the tram: cart, rails, buffers, stop sign, the quarry's bin ----
for (const l of [0, 1]) for (const f of [0, 1]) {
  add(`town:cart:h:${l}:${f}`, `cart_h_${l}_${f}`, drawCart('h', l, f), [24, 23], [12, 22]);
  add(`town:cart:v:${l}:${f}`, `cart_v_${l}_${f}`, drawCart('v', l, f), [16, 22], [8, 21]);
}
add('town:rail:h', 'rail_h', baked('town_rail_h'), [16, 12], [0, 6]);
add('town:rail:v', 'rail_v', baked('town_rail_v'), [12, 16], [6, 0]);
add('town:rail:c', 'rail_c', baked('town_rail_c'), [16, 16], [0, 0]);
add('town:buffer', 'buffer', drawBuffer(), [12, 14], [6, 12]);
add('town:sign', 'sign', drawSign(), [12, 30], [6, 29]);
add('town:townline', 'townline', drawTownLine(), [10, 26], [5, 25]);
add('st:tram_bin:*:*:3', 'tram_bin_w', drawBin(3), [18, 31], [1, 15]);
add('st:tram_bin:**', 'tram_bin', drawBin(0), [18, 31], [1, 15]);

const recipe = {
  name: 'town',
  kind: 'sprites',
  scale: 1,
  _note: 'Built by art/town/build.mjs (frames composed at their exact size, so place "none"). Rerun it, then node scripts/sprites-import.mjs art/town/sprites.json.',
  defaults: { place: 'none', keepStrays: true },
  sprites: sprites.map(({ match, file, frame, origin }) => ({ match, file, frame, origin })),
};
const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + recipe.sprites.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n ]');
fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');

// review image: one of each kind, x2 on grass
const pick = ['mill_g_1', 'wheel_on_0', 'wheel_off', 'pump_g_1_0', 'pump_g_0_0', 'fountain_on_0_g', 'fountain_dry_g', 'fountain_dry_w', 'lamp_0', 'lamp_1', 'lamp_2', 'cart_h_1_0', 'cart_v_1_0', 'tram_bin', 'sign', 'townline', 'buffer'];
lineup(pick.map((p) => files.get(p)), { k: 2, gap: 6, bg: '#239063', cols: 9 }).save(path.join(HERE, '..', '..', 'e2e', 'out', 'town-build.png'));
console.log(`${sprites.length} sprite entries, ${files.size} images -> art/town/out/, recipe art/town/sprites.json; review e2e/out/town-build.png`);
