// Hand-drawn micro sprites for the farmhouse animations, written as ASCII so they stay editable:
//   steam<0-3>.png  5x8 stove steam wisp rising (hf:steam:<f>)
//   fish<k>_<f>.png 5x3 goldfish facing right, two tail frames, three colourings (hf:fish:<k>:<f>)
// Usage: node art/home/tiny.mjs → art/home/src/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
function write(name, rows, key) {
  const h = rows.length, w = rows[0].length, data = new Uint8Array(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    const c = key[ch];
    if (!PAL.includes(c)) throw new Error(`${name}: ${c} not in the palette`);
    data.set([...rgbOf(c), 255], (y * w + x) * 4);
  }));
  fs.writeFileSync(path.join(HERE, 'src', name + '.png'), encodePNG(w, h, data));
}

// steam: soft pale puffs drifting up and to the side; the renderer may draw it at ~60% alpha
const S = { a: '#c7dcd0', b: '#9babb2' };
const steam = [
  ['...a.', '..a..', '.....', '.aa..', '.ab..', '..b..', '..a..', '..a..'],
  ['..a..', '.....', '..aa.', '..ab.', '..b..', '.a...', '.a...', '.....'],
  ['.....', '.aa..', '.ab..', '..b..', '..a..', '..a..', '.....', '..a..'],
  ['.a...', '..a..', '..b..', '...a.', '...a.', '.....', '..a..', '..a..'],
];
steam.forEach((r, f) => write(`steam${f}`, r, S));

// goldfish facing right: t tail, b body, h highlight, d belly shade, e eye
const COATS = [
  { b: '#f79617', h: '#f9c22b', d: '#cd683d', t: '#fb6b1d', e: '#2e222f' }, // amber
  { b: '#f9c22b', h: '#fbff86', d: '#f79617', t: '#fbb954', e: '#2e222f' }, // butter
  { b: '#fdcbb0', h: '#fbff86', d: '#fb6b1d', t: '#ea4f36', e: '#2e222f' }, // calico
];
const FISH = [
  ['t.hh.', 'tbbeb', 't.dd.'],
  ['.thh.', '.tbeb', '.tdd.'],
];
COATS.forEach((k, i) => FISH.forEach((r, f) => write(`fish${i}_${f}`, r, k)));
console.log('wrote steam0-3, fish0-2_0-1');
