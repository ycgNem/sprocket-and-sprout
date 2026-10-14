// Quick look while drawing (art/harbor/build.mjs writes the real frames):
//   node art/harbor/tools/preview.mjs   -> e2e/out/harbor/warehouse.png (x5) and -1x.png
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineup } from './px.mjs';
import { buildWarehouse } from './warehouse.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fr = buildWarehouse();
lineup(fr, { k: 5, bg: '#fbb954' }).save(path.join(ROOT, 'e2e/out/harbor/warehouse.png'));
lineup(fr, { k: 1, bg: '#fbb954' }).save(path.join(ROOT, 'e2e/out/harbor/warehouse-1x.png'));
console.log('ok');

const { buildShip } = await import('./ship.mjs');
const sh = buildShip();
lineup([...sh.moored, ...sh.sail], { k: 3, bg: '#4d9be6', cols: 2 }).save(path.join(ROOT, 'e2e/out/harbor/ship.png'));
lineup([...sh.moored, ...sh.sail], { k: 1, bg: '#4d9be6', cols: 4 }).save(path.join(ROOT, 'e2e/out/harbor/ship-1x.png'));
console.log('ship ok');

const { buildCargo } = await import('./cargo.mjs');
const cg = buildCargo();
lineup(cg, { k: 6, bg: '#9e4539' }).save(path.join(ROOT, 'e2e/out/harbor/cargo.png'));
console.log('cargo ok');
