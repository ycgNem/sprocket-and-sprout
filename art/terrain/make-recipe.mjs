// Writes art/terrain/terrain.json (the scripts/terrain-import.mjs recipe) from the graded folders:
// sets/<lower>-<upper>/, bases/<class>/*.png, tiles/<class>/*.png, decals/<class or class_season>/*.png.
// Rebuild order: grade.mjs grade.json → grade.mjs grade-tiles.json → grade.mjs grade-decals.json →
// compose.mjs compose.json → extract-bases.mjs → compose.mjs compose-bases.json → this → terrain-import.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ls = (d) => fs.readdirSync(path.join(here, d)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const pngs = (d) => ls(d).filter((f) => f.endsWith('.png')).map((f) => `${d}/${f}`);
const dirs = (d) => ls(d).filter((f) => fs.statSync(path.join(here, d, f)).isDirectory());
const SET_ORDER = ['dirt-grass', 'path-grass', 'water-grass', 'sand-grass', 'water-sand', 'deep-water', 'soil-grass', 'soil-dirt', 'wet-soil', 'wet-grass', 'wet-dirt', 'path-dirt', 'water-dirt', 'path-sand'];
const sets = SET_ORDER.filter((s) => fs.existsSync(path.join(here, 'sets', s))).map((s) => { const [lower, upper] = s.split('-'); return { lower, upper, dir: `sets/${s}` }; });
const bases = Object.fromEntries(dirs('bases').map((c) => [c, pngs(`bases/${c}`)]));
const tiles = Object.fromEntries(dirs('tiles').map((c) => [c, pngs(`tiles/${c}`)]));
const decals = Object.fromEntries(dirs('decals').map((c) => [c.replace('_', '@'), pngs(`decals/${c}`)]));
const recipe = {
  name: 'terrain', kind: 'terrain', tile: 16, scale: 1,
  sets, baseFromSets: false, bases, tiles, decals,
  seasons: JSON.parse(fs.readFileSync(path.join(here, 'seasons.json'), 'utf8')),
};
fs.writeFileSync(path.join(here, 'terrain.json'), JSON.stringify(recipe, null, 1) + '\n');
console.log(`terrain.json: ${sets.length} sets, bases ${Object.entries(bases).map(([k, v]) => k + ' ' + v.length).join(', ')}; tiles ${Object.keys(tiles).length} classes; decals ${Object.entries(decals).map(([k, v]) => k + ' ' + v.length).join(', ')}`);
