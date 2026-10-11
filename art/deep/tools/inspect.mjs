// Zoomed view of one image with a pixel grid and coordinates every 5 px, for placing scripted
// moving parts. Usage: node art/deep/tools/inspect.mjs <png> <out.png> [scale=10] [--snap]
import { Img, digits } from './lib.mjs';

const [file, outFile, sc = '10'] = process.argv.slice(2);
const snap = process.argv.includes('--snap');
const im = Img.load(file, { snap });
const K = +sc, M = 12;
const out = new Img(im.w * K + M, im.h * K + M);
for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, '#1a1a1a');
for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
  const c = im.get(x, y) ?? (((x + y) & 1) ? '#5a5a5a' : '#4a4a4a');
  out.rect(M + x * K, M + y * K, K - 1, K - 1, c);
}
for (let x = 0; x < im.w; x += 5) { digits(out, String(x), M + x * K, 2, '#fbb954'); out.rect(M + x * K - 1, M, 1, im.h * K, '#f04f78'); }
for (let y = 0; y < im.h; y += 5) { digits(out, String(y), 0, M + y * K + 2, '#fbb954'); out.rect(M, M + y * K - 1, im.w * K, 1, '#f04f78'); }
out.save(outFile);
console.log(`${outFile}: ${im.w}x${im.h} at x${K}; colors: ${[...im.colors()].sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ':' + n).join(' ')}`);
