// List a candidate's colors with hue, saturation, value and L* (to set the grading families).
// Usage: node art/ruins/tools/colors.mjs art/ruins/raw/W1/1.png [...]
import { loadRaw } from './lib.mjs';
import { lab } from '../../../scripts/lib/pixel.mjs';
for (const f of process.argv.slice(2)) {
  const im = loadRaw(f);
  const m = new Map();
  for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3]) { const k = [im.data[i], im.data[i + 1], im.data[i + 2]].join(','); m.set(k, (m.get(k) ?? 0) + 1); }
  console.log(f, m.size, 'colors');
  const rows = [...m].map(([k, n]) => {
    const [r, g, b] = k.split(',').map(Number);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return { hex: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''), n, h: Math.round(h), s: +(mx ? d / mx : 0).toFixed(2), v: +(mx / 255).toFixed(2), L: Math.round(lab([r, g, b])[0]) };
  }).sort((a, b) => a.h - b.h);
  for (const r of rows) console.log(`  ${r.hex} n${String(r.n).padStart(3)} h${String(r.h).padStart(3)} s${r.s} v${r.v} L${r.L}`);
}
