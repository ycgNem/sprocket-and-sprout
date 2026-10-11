// Style references for the PixelLab batches: machines cut from the sheets already in the game
// (src/art/factory.png), padded to the batch's canvas (the largest style image sets the size).
// Usage: node art/deep/tools/style.mjs   -> art/deep/style/<name>.png + e2e/out/deep/style.png
import path from 'node:path';
import { Img, DEEP, ROOT, sheet } from './lib.mjs';

const F = Img.load(path.join(ROOT, 'src/art/factory.png'));
const CUTS = {
  steam_engine: [768, 0, 33, 50], blast_furnace: [165, 0, 32, 54], brick_kiln: [264, 73, 32, 48], waterwheel: [769, 124, 32, 42],
  drill_steam: [99, 73, 32, 48], lab: [901, 124, 32, 42], mill: [330, 0, 33, 52], sunlens: [66, 171, 32, 40], oven: [401, 171, 32, 31],
  hand_loom: [566, 171, 32, 31], kitchen: [429, 73, 32, 48], drill_brass: [594, 73, 32, 48], steam_loom: [759, 73, 33, 46], assembler: [604, 124, 32, 44],
};
const out = [];
for (const [name, r] of Object.entries(CUTS)) {
  const im = F.crop(...r).trim();
  im.save(path.join(DEEP, 'style', name + '.png'));
  out.push(im);
  console.log(name, im.w + 'x' + im.h);
}
sheet(out, path.join(ROOT, 'e2e/out/deep/style.png'), { k: 4, cols: 7 });
