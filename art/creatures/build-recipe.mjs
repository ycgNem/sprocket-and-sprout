// Writes art/creatures/sprites.json (the sprites-import recipe) from the prepped frames in src/.
// Run after prep.mjs:  node art/creatures/build-recipe.mjs && node scripts/sprites-import.mjs art/creatures/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const has = (f) => fs.existsSync(path.join(HERE, 'src', f + '.png'));
const sprites = [];
const add = (match, file, frame, origin) => { if (!has(file)) throw new Error('missing src/' + file + '.png'); sprites.push({ match, file: `src/${file}.png`, frame, origin }); };

// an:<kind>:<frame>:<baby>  (frames 0-3: 0 stands, the game alternates 0/1 while walking; 2-3 finish a 4-frame cycle)
const BARN = ['cow', 'goat', 'sheep', 'pig', 'alpaca'], COOP = ['chicken', 'duck', 'rabbit'];
for (const k of BARN) for (let f = 0; f < 4; f++) {
  add(`an:${k}:${f}:0`, `an_${k}_0_${f}`, [28, 26], [14, 25]);
  add(`an:${k}:${f}:1`, `an_${k}_1_${f}`, [20, 18], [10, 17]);
}
for (const k of COOP) for (let f = 0; f < 4; f++) for (const b of [0, 1]) add(`an:${k}:${f}:${b}`, `an_${k}_${b}_${f}`, [16, 16], [8, 15]);

// pet:<kind>:<coat>:<pose>  (0 stand, 1 walk, 2 sit, 3 sleep; extras: 4-5 finish a 4-frame walk, 6 sleep breathing in)
for (const k of ['cat', 'dog']) for (let c = 0; c < 4; c++) for (let p = 0; p < 7; p++) if (has(`pet_${k}_${c}_${p}`)) add(`pet:${k}:${c}:${p}`, `pet_${k}_${c}_${p}`, [22, 20], [11, 19]);

// bowl:<full>  (drawn at the tile's top-left corner)
for (const b of [0, 1]) if (has(`bowl_${b}`)) add(`bowl:${b}`, `bowl_${b}`, [16, 16], [0, 0]);

// mon:<id>:<frame>  (0-3 cycle at 6 fps; 4 = hidden pose where the monster has one)
for (const id of ['dew_blob', 'cave_moth', 'pebble_crab', 'frost_blob', 'burrow_mole', 'ember_wisp', 'dusk_moth', 'rust_golem'])
  for (let f = 0; f < 5; f++) if (has(`mon_${id}_${f}`)) add(`mon:${id}:${f}`, `mon_${id}_${f}`, [20, 20], [10, 18]);

const recipe = { name: 'creatures', kind: 'sprites', defaults: { place: 'none', keepStrays: true }, sprites };
const json = JSON.stringify({ ...recipe, sprites: [] }, null, 1).replace('"sprites": []', '"sprites": [\n' + sprites.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n ]');
fs.writeFileSync(path.join(HERE, 'sprites.json'), json + '\n');
console.log(`sprites.json: ${sprites.length} entries`);
