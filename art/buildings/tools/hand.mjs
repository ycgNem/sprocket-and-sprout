// Render the hand-pixeled sprites in art/buildings/hand.json to art/buildings/raw/<name>.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../../scripts/lib/pixel.mjs';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = JSON.parse(fs.readFileSync(path.join(base, 'hand.json'), 'utf8'));
for (const [name, s] of Object.entries(H)) {
  if (name.startsWith('_')) continue;
  const h = s.rows.length, w = Math.max(...s.rows.map((r) => r.length));
  const bad = s.rows.map((r, i) => [i, r.length]).filter(([, l]) => l !== w);
  if (bad.length) console.log(`${name}: rows of uneven width: ${bad.map(([i, l]) => `#${i}=${l}`).join(' ')} (width ${w})`);
  for (const c of Object.values(s.legend)) if (!PAL.includes(c.toLowerCase())) throw new Error(`${name}: ${c} is not a palette color`);
  const data = new Uint8Array(w * h * 4);
  s.rows.forEach((r, y) => [...r].forEach((ch, x) => { const c = s.legend[ch]; if (c) data.set([...rgbOf(c), 255], (y * w + x) * 4); }));
  const out = path.join(base, 'raw', name + '.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(w, h, data));
  console.log('wrote', path.relative(base, out), `${w}x${h}`);
}
