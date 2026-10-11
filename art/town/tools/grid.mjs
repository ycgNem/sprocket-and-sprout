// Print an image as a character grid with a color legend (snapped to the palette unless --raw),
// for reading generated art pixel by pixel before editing it in a script.
// Usage: node art/town/tools/grid.mjs <file.png> [--raw] [--trim] [--rect x y w h]
import { Img, PAL } from './px.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && /\.png$/i.test(a));
let im = Img.load(file);
if (!args.includes('--raw')) im.snap();
const ri = args.indexOf('--rect');
if (ri >= 0) im = im.crop(...args.slice(ri + 1, ri + 5).map(Number));
if (args.includes('--trim')) im = im.trim();
const CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=?';
const legend = new Map();
const rows = [];
for (let y = 0; y < im.h; y++) {
  let s = '';
  for (let x = 0; x < im.w; x++) {
    const c = im.get(x, y);
    if (!c) { s += '.'; continue; }
    if (!legend.has(c)) legend.set(c, CH[legend.size]);
    s += legend.get(c);
  }
  rows.push(String(y).padStart(3) + ' ' + s);
}
console.log('    ' + Array.from({ length: im.w }, (_, x) => (x % 10)).join(''));
console.log(rows.join('\n'));
console.log([...legend].map(([c, ch]) => `${ch}=${c}${PAL.includes(c) ? '(' + PAL.indexOf(c) + ')' : ''}`).join(' '));
