// Find the best place to cut a repeating span out of a wide sprite (no scaling): keeps [0,L) and
// [R,w) where columns L..L+k look like R..R+k. Usage: seam.mjs <png> <remove min> <remove max> [rows y0 y1]
import { loadArt, bbox, crop } from '../../../scripts/lib/pixel.mjs';
const [f, a, b, y0 = 0, y1 = 9999] = process.argv.slice(2);
const L0 = loadArt(f); const bb = bbox(L0.img); const img = crop(L0.img, bb.x0, bb.y0, bb.x1 - bb.x0 + 1, bb.y1 - bb.y0 + 1);
const px = (x, y) => { const p = (y * img.w + x) * 4; return img.data[p + 3] ? (img.data[p] << 16) | (img.data[p + 1] << 8) | img.data[p + 2] : -1; };
const colDiff = (x1, x2) => { let d = 0; for (let y = +y0; y < Math.min(img.h, +y1); y++) if (px(x1, y) !== px(x2, y)) d++; return d; };
const res = [];
const lmin = +(process.env.LMIN ?? 20), lmax = +(process.env.LMAX ?? 9999);
for (let k = +a; k <= +b; k++) for (let L = lmin; L + k < img.w - 2 && L <= lmax; L++) {
  const R = L + k;
  const d = colDiff(L, R) * 2 + colDiff(L - 1, R - 1) + colDiff(L + 1, R + 1);
  res.push({ L, R, k, d });
}
res.sort((p, q) => p.d - q.d);
console.log(`art ${img.w}x${img.h}`);
for (const r of res.slice(0, 15)) console.log(`cut [${r.L}, ${r.R}) remove ${r.k} -> width ${img.w - r.k}, mismatch ${r.d}`);
