// Prints a candidate as a character grid with its palette legend (after snap + outline pass).
// Usage: node art/icons/tools/colors.mjs <batch/slot> [...]   (e.g. t16/0)  [--raw] skip the outline pass
import path from 'node:path';
import { load, closeOutline, center, px, trimTips } from './lib.mjs';
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const args = process.argv.slice(2);
const raw = args.includes('--raw');
for (const a of args.filter((x) => !x.startsWith('--'))) {
  const { img } = load(path.join(HERE, 'raw', a + '.png'));
  if (!raw) { closeOutline(img); trimTips(img); }
  const { img: c } = center(img);
  const keys = new Map();
  const sym = '#abcdefghijmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const lines = [];
  for (let y = 0; y < 16; y++) {
    let l = '';
    for (let x = 0; x < 16; x++) {
      const h = c && px(c, x, y);
      if (!h) { l += '.'; continue; }
      if (!keys.has(h)) keys.set(h, h === '#2e222f' ? '#' : sym[keys.size + (keys.has('#2e222f') ? 0 : 1)]);
      l += keys.get(h);
    }
    lines.push(l);
  }
  console.log(`== ${a}`);
  const leg = [...keys].map(([h, s]) => `${s}=${h}`);
  lines.forEach((l, i) => console.log(l + '   ' + (leg[i] ?? '')));
}
