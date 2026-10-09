// Ripe-stage glow check: how many #fbff86 / #fdcbb0 / #ffffff pixels each ripe take has.
// node art/crops/glints.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArt, hex } from '../../scripts/lib/pixel.mjs';
import { PICKS } from './picks.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const GLOW = ['#fbff86', '#fdcbb0', '#ffffff'];
for (const [id, p] of Object.entries(PICKS)) {
  const row = p.ripe.map((ref) => {
    const L = loadArt(path.join(here, 'src', ref + '.png'), 1);
    const n = GLOW.map(() => 0);
    for (let i = 0; i < L.img.data.length; i += 4) if (L.img.data[i + 3]) { const k = GLOW.indexOf(hex(L.img.data[i], L.img.data[i + 1], L.img.data[i + 2])); if (k >= 0) n[k]++; }
    return `${ref}[${n.join('/')}]`;
  });
  console.log(id.padEnd(12), row.join(' '));
}
