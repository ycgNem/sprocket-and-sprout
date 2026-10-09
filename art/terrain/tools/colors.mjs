// List the colors of a PNG (or a rect of it) with count, HSV hue/sat and Lab L, sorted by L.
// Usage: node art/terrain/tools/colors.mjs file.png [x,y,w,h]
import { load, describe } from './grade.mjs';
import { hex } from '../../../scripts/lib/pixel.mjs';
const [f, r] = process.argv.slice(2);
const img = load(f, r ? r.split(',').map(Number) : undefined);
const m = new Map();
for (let i = 0; i < img.data.length; i += 4) { if (img.data[i + 3] < 128) continue; const k = hex(img.data[i], img.data[i + 1], img.data[i + 2]); m.set(k, (m.get(k) ?? 0) + 1); }
const rows = [...m].map(([k, n]) => { const [R, G, B] = [1, 3, 5].map((j) => parseInt(k.slice(j, j + 2), 16)); return { k, n, ...describe(R, G, B) }; }).sort((a, b) => a.L - b.L);
for (const c of rows) console.log(`${c.k} n=${String(c.n).padStart(4)} h=${c.h.toFixed(0).padStart(3)} s=${c.s.toFixed(2)} L=${c.L.toFixed(1)}`);
