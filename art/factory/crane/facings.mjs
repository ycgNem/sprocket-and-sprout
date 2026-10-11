// The Harvest Crane's facings in the factory sheet's sprites-import recipe (src/data/structures.ts
// `facings`): `st:harvester_r<rot>:<frame>:<on>:*`. Facing 0 is the plain `st:harvester` art (boom to
// the right); 2 is its mirror, flipped around the tile's center (anchor 0: the sheet loader and the
// atlas each turn a flipped anchor into w - o, so it lands as written); 1 (boom toward you) and 3 (boom
// away) are hand-pixeled by build.py. Frames 0-3 bob the claw like the original (3 reuses 1); the
// idle frame is frame 0.
//
// art/factory/gen/structs.mjs appends these when it writes the recipe. To add them to the recipe
// without rebuilding every structure: node art/factory/crane/facings.mjs
// then: node scripts/sprites-import.mjs art/factory/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = 'harvester';
const BOB = [0, 1, 2, 1];

export function craneFacings() {
  const out = [];
  for (const r of [1, 3]) {
    const own = (f) => ({ file: `crane/r${r}-f${f}.png`, frame: [17, 30], origin: [1, 14], place: 'none', keepStrays: true });
    BOB.forEach((f, i) => out.push({ match: `st:${ID}_r${r}:${i}:1:*`, ...own(f) }));
    out.push({ match: `st:${ID}_r${r}:*:0:*`, ...own(0) });
  }
  for (let i = 0; i < 4; i++) out.push({ match: `st:${ID}_r2:${i}:1:*`, like: `st:${ID}:${i}:1:*`, flipX: true, origin: [0, 14] });
  out.push({ match: `st:${ID}_r2:*:0:*`, like: `st:${ID}:*:0:*`, flipX: true, origin: [0, 14] });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../sprites.json');
  const recipe = JSON.parse(fs.readFileSync(file, 'utf8'));
  recipe.sprites = recipe.sprites.filter((s) => !s.match.startsWith(`st:${ID}_r`)).concat(craneFacings());
  fs.writeFileSync(file, JSON.stringify(recipe, null, 1));
  console.log(`crane facings: ${craneFacings().length} entries in ${path.relative(process.cwd(), file)}`);
}
