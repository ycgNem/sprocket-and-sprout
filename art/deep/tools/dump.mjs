// Print an image as a character grid (one char per palette color, legend first), for reading
// exact pixel positions. Usage: node art/deep/tools/dump.mjs <png> [x0 y0 w h] [--snap]
import { Img } from './lib.mjs';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const im0 = Img.load(args[0], { snap: process.argv.includes('--snap') });
const [x0, y0, w, h] = args.length > 1 ? args.slice(1).map(Number) : [0, 0, im0.w, im0.h];
const im = im0.crop(x0, y0, w, h);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const cols = [...im.colors()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
const key = new Map(cols.map((c, i) => [c, chars[i]]));
console.log(cols.map((c) => key.get(c) + '=' + c).join(' '));
let hdr = '    ';
for (let x = 0; x < w; x++) hdr += (x0 + x) % 10 === 0 ? String(((x0 + x) / 10) % 10) : ' ';
console.log(hdr);
for (let y = 0; y < h; y++) {
  let s = String(y0 + y).padStart(3) + ' ';
  for (let x = 0; x < w; x++) { const c = im.get(x, y); s += c ? key.get(c) : '.'; }
  console.log(s);
}
