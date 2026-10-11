// Pad style references to an n x n canvas (bottom-centered) and print them as base64 for the
// PixelLab style_images field. Usage: node art/deep/tools/pad.mjs <n> <name> [name ...]
import path from 'node:path';
import fs from 'node:fs';
import { Img, DEEP } from './lib.mjs';

const [n, ...names] = process.argv.slice(2);
const N = +n;
for (const name of names) {
  const im = Img.load(path.join(DEEP, 'style', name + '.png'));
  const out = new Img(N, N);
  out.blit(im, Math.floor((N - im.w) / 2), N - im.h - 1);
  const file = path.join(DEEP, 'style', `${name}.${N}.png`);
  out.save(file);
  console.log(name, fs.readFileSync(file).toString('base64').length);
}
