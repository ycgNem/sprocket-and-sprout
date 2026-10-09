// Side-by-side review of a raw batch: snapped (left) and outline-closed (right), on a slot
// background, x scale, with index labels. Usage: node art/icons/tools/preview.mjs <dir> <out.png> [--scale 5] [--cols 8] [--outer]
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { blank, blit } from '../../../scripts/lib/pixel.mjs';
import { load, closeOutline, copy, trimTips } from './lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [dir, out] = args;
const K = +opt('--scale', 5), COLS = +opt('--cols', 8), outer = args.includes('--outer'), trim = args.includes('--trim');
const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
const CW = 16 * 2 + 3, CH = 16 + 2;
const sheet = blank(COLS * CW, Math.ceil(files.length / COLS) * CH);
for (let i = 0; i < sheet.data.length; i += 4) {
  const x = (i / 4) % sheet.w, y = Math.floor(i / 4 / sheet.w);
  const cx = Math.floor(x / CW);
  const inA = x % CW >= 1 && x % CW < 17, inB = x % CW >= 18 && x % CW < 34;
  sheet.data.set(inA || inB ? (y % CH >= 1 && y % CH < 17 ? [0xe6, 0x90, 0x4e, 255] : [30, 24, 34, 255]) : [30, 24, 34, 255], i);
  void cx;
}
files.forEach((f, n) => {
  const { img } = load(path.join(dir, f));
  const b = copy(img);
  closeOutline(b, { outer });
  if (trim) trimTips(b);
  const ox = (n % COLS) * CW, oy = Math.floor(n / COLS) * CH + 1;
  blit(sheet, img, ox + 1, oy);
  blit(sheet, b, ox + 18, oy);
});
const big = blank(sheet.w * K, sheet.h * K);
for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) {
  const p = (Math.floor(y / K) * sheet.w + Math.floor(x / K)) * 4;
  big.data.set(sheet.data.subarray(p, p + 4), (y * big.w + x) * 4);
}
// index labels (3x5 digits)
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
files.forEach((f, n) => {
  const s = String(parseInt(f));
  const x0 = (n % COLS) * CW * K + 2, y0 = Math.floor(n / COLS) * CH * K + 2;
  [...s].forEach((ch, k) => { const g = DIG[+ch]; for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '1') for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) big.data.set([255, 255, 255, 255], ((y0 + y * 2 + yy) * big.w + x0 + (k * 4 + x) * 2 + xx) * 4); });
});
fs.writeFileSync(out, encodePNG(big.w, big.h, big.data));
console.log(out);
