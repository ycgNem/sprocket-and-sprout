// The Harbor (late game: the export warehouse at the foot of the beach pier, the merchant steam
// clipper The Copper Gull, export cargo on the pier deck): writes every frame and the sprites-import
// recipe.
//
//   node art/harbor/build.mjs                                  -> art/harbor/out/*.png, sprites.json,
//                                                                 e2e/out/harbor/build.png (review)
//   node scripts/sprites-import.mjs art/harbor/sprites.json    -> src/art/harbor.png + .json
//   node art/harbor/tools/contact.mjs                          -> e2e/out/harbor/contact.png (the
//                                                                 imported sheet, every frame 1x + 3x)
//
// Sprites (drawn with drawSprite at the footprint's top-left; origin = how far the art overhangs the
// footprint to the left (ox) and above it (oy)):
//   harbor:warehouse:<0 derelict | 1 restored>  69x71, origin (5, 23): footprint 4x3 tiles (64x48);
//        the crane overhangs the pier to the west by 5 px, the roof and crane rise 23 px above
//   harbor:warehouse:<0|1>:winter  the same with snow on the roof (the town buildings' winter rule)
//   harbor:ship:<0-3>         160x91, origin (0, 27): moored, sails furled; footprint 10x4 tiles
//        (160x64), waterline foam on the footprint's bottom rows; frames bob 1 px (2-3) and puff smoke
//   harbor:ship:sail:<0-3>    160x91, origin (0, 27): under way (sails set, smoke streaming aft,
//        bow wave and wake), bow east
//   harbor:ship:sail:west:<0-3>  the same mirrored (bow west), for the passage in from the east
//   harbor:cargo:<0-3>        32x40, origin (0, 8): footprint 2x2 tiles; 0 empty pallet .. 3 full
//        stack under a cargo net
//
// Sources and what was done to each: tools/warehouse.mjs, tools/ship.mjs, tools/cargo.mjs;
// generations: raw/batches.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineup } from './tools/px.mjs';
import { buildWarehouse, WAREHOUSE } from './tools/warehouse.mjs';
import { buildShip, SHIP } from './tools/ship.mjs';
import { buildCargo, CARGO } from './tools/cargo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const sprites = [];
const add = (match, file, img, { w, h, ox, oy }) => {
  if (img.w !== w || img.h !== h) throw new Error(`${match}: ${img.w}x${img.h}, expected ${w}x${h}`);
  img.save(path.join(OUT, file));
  sprites.push({ match, file: 'out/' + file, frame: [w, h], origin: [ox, oy] });
};

const wh = buildWarehouse();
wh.forEach((img, n) => add(`harbor:warehouse:${n % 2}${n >= 2 ? ':winter' : ''}`, `warehouse_${n % 2}${n >= 2 ? '_winter' : ''}.png`, img, WAREHOUSE));
const ship = buildShip();
ship.moored.forEach((img, f) => add(`harbor:ship:${f}`, `ship_${f}.png`, img, SHIP));
ship.sail.forEach((img, f) => add(`harbor:ship:sail:${f}`, `ship_sail_${f}.png`, img, SHIP));
// westbound (coming in from the east): the under-way frames mirrored, so the bow leads, the smoke
// and the wake stream east; same frame and origin (the frame is exactly the footprint's width)
for (let f = 0; f < 4; f++) sprites.push({ match: `harbor:ship:sail:west:${f}`, like: `harbor:ship:sail:${f}`, flipX: true });
const cargo = buildCargo();
cargo.forEach((img, n) => add(`harbor:cargo:${n}`, `cargo_${n}.png`, img, CARGO));

const recipe = {
  name: 'harbor',
  kind: 'sprites',
  scale: 1,
  _note: 'Built by art/harbor/build.mjs (frames composed at their exact size, so place "none"). Rerun it, then node scripts/sprites-import.mjs art/harbor/sprites.json.',
  defaults: { place: 'none', keepStrays: true },
  sprites,
};
fs.writeFileSync(path.join(HERE, 'sprites.json'), JSON.stringify(recipe, null, 1) + '\n');

// review: everything at 2x on the colors it stands on (sand, sea, pier planks)
fs.mkdirSync(path.join(ROOT, 'e2e/out/harbor'), { recursive: true });
lineup(wh, { k: 3, bg: '#fbb954' }).save(path.join(ROOT, 'e2e/out/harbor/build-warehouse.png'));
lineup([...ship.moored, ...ship.sail], { k: 2, bg: '#4d9be6', cols: 4 }).save(path.join(ROOT, 'e2e/out/harbor/build-ship.png'));
lineup(cargo, { k: 4, bg: '#9e4539' }).save(path.join(ROOT, 'e2e/out/harbor/build-cargo.png'));
console.log(`harbor: ${sprites.length} frames -> art/harbor/out, art/harbor/sprites.json`);
