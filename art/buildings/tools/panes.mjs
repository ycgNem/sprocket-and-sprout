// Find window panes: connected blobs of the given colors (snapped, trimmed coords).
// Usage: panes.mjs <png> "#c1,#c2,..." [minSize=10] [y0=0]
import { loadArt, bbox, crop } from '../../../scripts/lib/pixel.mjs';
const [f, cols, min = 10, ymin = 0] = process.argv.slice(2);
const set = cols.split(',').map((s) => s.trim().toLowerCase());
const L = loadArt(f); const b = bbox(L.img); const a = crop(L.img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
const hx = (x, y) => { const p = (y * a.w + x) * 4; return a.data[p + 3] ? '#' + [0, 1, 2].map((i) => a.data[p + i].toString(16).padStart(2, '0')).join('') : null; };
const seen = new Uint8Array(a.w * a.h); const out = [];
for (let y = +ymin; y < a.h; y++) for (let x = 0; x < a.w; x++) {
  if (seen[y * a.w + x] || !set.includes(hx(x, y))) continue;
  const st = [[x, y]]; seen[y * a.w + x] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
  while (st.length) { const [cx, cy] = st.pop(); n++; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < +ymin || nx >= a.w || ny >= a.h || seen[ny * a.w + nx] || !set.includes(hx(nx, ny))) continue; seen[ny * a.w + nx] = 1; st.push([nx, ny]); } }
  if (n >= +min) out.push({ n, r: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], fill: (n / ((x1 - x0 + 1) * (y1 - y0 + 1))).toFixed(2) });
}
console.log(`${f}: art ${a.w}x${a.h}`);
for (const o of out) console.log(JSON.stringify(o.r), 'n', o.n, 'fill', o.fill);
