// Writes art/factory/belts.json (sprites-import recipe, sheet "factory-belts") from the rects
// that gen/belts.mjs recorded. Usage: node art/factory/gen/belt-recipe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rects = JSON.parse(fs.readFileSync(path.resolve(HERE, '../belts/belts.json'), 'utf8'));
// claws are drawn centered on the hand point
const origins = JSON.parse(fs.readFileSync(path.resolve(HERE, '../belts/origins.json'), 'utf8'));
const sprites = Object.entries(rects).map(([match, r]) => ({ match, rect: r, frame: [r[2], r[3]], ...(match.startsWith('armh:') ? { origin: [4, 4] } : origins[match] ? { origin: origins[match] } : {}) }));
const recipe = {
  name: 'factory-belts',
  kind: 'sprites',
  meta: { note: 'Belts, undergrounds, splitters, arm bases. Drawn by art/factory/gen/belts.mjs (pixel-exact lanes and treads).' },
  defaults: { file: 'belts/belts.png', place: 'none', keepStrays: true, origin: [0, 0] },
  sprites,
};
fs.writeFileSync(path.resolve(HERE, '../belts.json'), JSON.stringify(recipe, null, 1));
console.log(`art/factory/belts.json: ${sprites.length} sprites`);
