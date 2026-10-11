// Style references for the PixelLab batches: frames cut from the game's own sheets (src/art/),
// padded to the batch canvas (the largest style image sets create_1_direction_object's size), art
// bottom-centered. Writes art/town/raw/style/<size>/<name>.png and prints base64 per file.
//
// Usage: node art/town/tools/styleref.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './px.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const sheet = (n) => Img.load(path.join(ROOT, 'src/art', n + '.png'), { unscale: false });
const factory = sheet('factory'), buildings = sheet('buildings');

const SETS = {
  40: { lamp: [factory, 350, 171, 16, 32], pole_iron: [factory, 231, 171, 16, 38], well: [buildings, 908, 1004, 32, 40] },
  32: { lamp: [factory, 350, 171, 16, 32], compost: [factory, 891, 171, 16, 25], press: [factory, 147, 214, 17, 24], battery: [factory, 183, 214, 16, 23] },
  24: { keg: [factory, 200, 214, 16, 22], chest: [factory, 650, 214, 19, 19], crate: [factory, 687, 214, 17, 18], sign: [factory, 370, 214, 16, 22] },
};

for (const [size, set] of Object.entries(SETS)) {
  for (const [name, [src, x, y, w, h]] of Object.entries(set)) {
    const art = src.crop(x, y, w, h).trim();
    const o = new Img(+size, +size);
    o.blit(art, Math.floor((+size - art.w) / 2), +size - art.h);
    const f = path.join(HERE, '..', 'raw', 'style', size, name + '.png');
    o.save(f);
    console.log(`${size}/${name} ${art.w}x${art.h} ${o.toBase64().length}b`);
  }
}
