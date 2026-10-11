// Style references for the wreck batch (art/ruins/raw/batches.json): frames cut from the game's own
// sheets (src/art/), recoloured with the game's rust ramp (src/render/rust.ts: the keeper's derelict
// machines) so PixelLab sees rusted machines in the game's style, padded to 24x24, art bottom-centred.
// Writes art/ruins/raw/style/<name>.png and prints each file's base64 (for the MCP call).
// Usage: node art/ruins/tools/styleref.mjs [--b64]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, rgb } from '../../factory/gen/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const sheets = {};
const sheet = (n) => (sheets[n] ??= { im: Img.load(path.join(ROOT, 'src/art', n + '.png')), m: JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art', n + '.json'), 'utf8')) });
/** a sprite by its manifest match, trimmed to its art */
function cut(name, match) {
  const s = sheet(name);
  const e = s.m.sprites.find((q) => q.match === match);
  if (!e) throw new Error(`${name}: no ${match}`);
  const im = s.im.crop(...e.r);
  const b = im.bbox();
  return im.crop(b.x0, b.y0, b.w, b.h);
}
// src/render/rust.ts: brightness bands -> plum-black, dark plum-brown, rust red, rust, dusty rose, taupe
const BANDS = [[45, '#2e222f'], [80, '#45293f'], [110, '#7a3045'], [145, '#9e4539'], [185, '#966c6c'], [256, '#ab947a']];
function rust(im) {
  const o = im.clone();
  o.px = o.px.map((c, p) => {
    if (!c) return c;
    const [r, g, b] = rgb(c);
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    let k = BANDS.find(([max]) => lum < max)[1];
    if ((k === '#9e4539' || k === '#966c6c') && ((p * 2654435761) >>> 0) % 9 === 0) k = '#cd683d';
    return k;
  });
  return o;
}
// the Deepworks' derelict (art/deep/build.mjs): every material one shade down, then rust blotches
const TARNISH = {
  '#fbff86': '#e6904e', '#f9c22b': '#cd683d', '#fbb954': '#cd683d', '#f79617': '#9e4539', '#fb6b1d': '#9e4539',
  '#e6904e': '#cd683d', '#cd683d': '#9e4539', '#9e4539': '#7a3045',
  '#fca790': '#cd683d', '#f57d4a': '#9e4539', '#ea4f36': '#b33831', '#b33831': '#6e2727',
  '#c7dcd0': '#7f708a', '#9babb2': '#625565', '#7f708a': '#625565', '#ab947a': '#966c6c', '#fdcbb0': '#ab947a',
};
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function tarnish(im, seed = 1) {
  const o = im.clone();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = im.get(x, y);
    if (!c || c === '#2e222f') continue;
    let k = TARNISH[c] ?? c;
    const r = hash(x >> 1, y >> 1, seed);
    if (r < 0.16 && !['#2e222f', '#45293f', '#3e3546'].includes(c)) k = r < 0.06 ? '#7a3045' : r < 0.12 ? '#9e4539' : '#45293f';
    o.set(x, y, k);
  }
  return o;
}
const SET = {
  press: tarnish(cut('factory', 'st:cheese_press:*:0:*'), 3),
  keg: rust(cut('factory', 'st:keg:*:0:*')),
  battery: tarnish(cut('factory', 'st:spring_battery:*:*:*'), 5),
  boulder: cut('nature', 'o:5:0:*'),
};
const S = 24;
for (const [name, art] of Object.entries(SET)) {
  const o = new Img(S, S);
  o.draw(art, Math.floor((S - art.w) / 2), S - art.h);
  const f = path.join(HERE, '..', 'raw', 'style', name + '.png');
  o.save(f);
  const b64 = fs.readFileSync(f).toString('base64');
  console.log(`${name} ${art.w}x${art.h} ${b64.length}b`);
  if (process.argv.includes('--b64')) console.log(b64);
}
