// Contact sheet of the imported juice sheet (src/art/juice.png + .json): every frame at 4x on the
// grounds it flies over (grass and dirt tiles cut from src/art/terrain.png) and on the dark HUD
// plums (#2e222f, #45293f), one band per background, then a strip of the main markers on every
// ground class. Reads the manifest, so it shows exactly what the game registers.
//
// Usage: node art/juice/contact.mjs [--origins] [--out e2e/out/juice/contact.png] [--scale 4]
//   --fams coin,star   only these families; --bands 0,2  only these backgrounds (grass, dirt, plum, plum2); --nostrip
//   --origins  marks each frame's origin pixel with a 1 px tick under/left of the cell
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const K = +opt('--scale', 4), OUT = path.resolve(ROOT, opt('--out', 'e2e/out/juice/contact.png')), ORIG = args.includes('--origins');

const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art/juice.json'), 'utf8'));
const sheet = decodePNG(fs.readFileSync(path.join(ROOT, 'src/art', man.file)));
const terr = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/art/terrain.json'), 'utf8'));
const tpng = decodePNG(fs.readFileSync(path.join(ROOT, 'src/art', terr.file)));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// families in order: name prefix -> frames
const fam = new Map();
for (const s of man.sprites) {
  const m = s.match.match(/^(.*):(\d+)$/);
  const key = m ? m[1] : s.match;
  if (!fam.has(key)) fam.set(key, []);
  fam.get(key).push(s);
}
const ONLY = opt('--fams', null)?.split(',');
const FAMS = [...fam.entries()].filter(([k]) => !ONLY || ONLY.includes(k.replace(/^fx:/, '')));

// backgrounds: a function (x, y) -> rgb in 1x pixels
const tile = (cls, n = 0) => { const [tx, ty] = terr.bases[cls][n % terr.bases[cls].length]; return (x, y) => { const p = ((ty + (y & 15)) * tpng.w + tx + (x & 15)) * 4; return [tpng.data[p], tpng.data[p + 1], tpng.data[p + 2]]; }; };
const flat = (h) => { const c = rgb(h); return () => c; };
const BSEL = opt('--bands', null)?.split(',');
const BANDS = [['grass', tile('grass')], ['dirt', tile('dirt')], ['hud #2e222f', flat('#2e222f')], ['hud #45293f', flat('#45293f')]].filter((b, i) => !BSEL || BSEL.includes(String(i)));
const NOSTRIP = args.includes('--nostrip');

// ---- tiny 3x5 font for labels ----
const GL = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111', f: '111100110100100',
  g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111',
  m: '101111111101101', n: '110101101101101', o: '010101101101010', p: '110101110100100', q: '010101101110011', r: '110101110101101',
  s: '011100010001110', t: '111010010010010', u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101',
  y: '101101010010010', z: '111001010100111', ':': '000010000010000', '#': '101111101111101', ' ': '000000000000000', '.': '000000000000010',
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', x_: '000101010101000', '-': '000000111000000',
};

const CW = 22 * K, CH = 18 * K; // cell: largest frame (20x16) + 1 px margin
const PER_ROW = 2; // families side by side in a band
const MAXF = Math.max(...FAMS.map(([, f]) => f.length));
const LABW = 30 * K / 2;
const famW = LABW + MAXF * CW;
const bandRows = Math.ceil(FAMS.length / PER_ROW);
const TITLE = 8 * 2;
const bandH = TITLE + bandRows * CH;
// ground strip: markers on every class
const GROUNDS = ['grass', 'dirt', 'path', 'sand', 'soil', 'wet', 'water', 'deep'].filter((g) => terr.bases[g]);
const STRIP = ['fx:arrow:0', 'fx:coin:0', 'fx:star:1', 'fx:glint:2', 'fx:puff:2', 'fx:heart:0', 'fx:streak:0', 'fx:gust:1'];
const stripH = NOSTRIP ? 0 : TITLE + GROUNDS.length * CH;
const W = PER_ROW * famW + 8, H = BANDS.length * bandH + stripH + 8;
const img = new Uint8Array(W * H * 4);
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) img.set([...c, 255], (y * W + x) * 4); };
const fillRect = (x0, y0, w, h, f) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x0 + x, y0 + y, f(Math.floor(x / K), Math.floor(y / K))); };
function text(s, x0, y0, c = [255, 236, 170], S = 2) {
  let x = x0;
  for (const ch of s.toLowerCase()) {
    const g = GL[ch] ?? GL[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) set(x + i * S + xx, y0 + j * S + yy, c);
    x += 4 * S;
  }
}
function blitFrame(s, cx, cy) {
  const [sx, sy, w, h] = s.r;
  const ox = cx + Math.floor((CW / K - w) / 2) * K, oy = cy + Math.floor((CH / K - h) / 2) * K;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = ((sy + y) * sheet.w + sx + x) * 4;
    if (!sheet.data[p + 3]) continue;
    for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) set(ox + x * K + xx, oy + y * K + yy, [sheet.data[p], sheet.data[p + 1], sheet.data[p + 2]]);
  }
  if (ORIG) { // origin tick: a small mark left of and under the origin pixel's row/column
    const [ox0, oy0] = s.o;
    for (let k = 0; k < K; k++) { set(ox - 3, oy + oy0 * K + k, [255, 60, 60]); set(ox + ox0 * K + k, oy + h * K + 2, [255, 60, 60]); }
  }
}

fillRect(0, 0, W, H, () => [20, 16, 24]);
BANDS.forEach(([label, bg], b) => {
  const y0 = 4 + b * bandH;
  text(label, 8, y0 + 2);
  FAMS.forEach(([key, frames], n) => {
    const fx = 4 + (n % PER_ROW) * famW, fy = y0 + TITLE + Math.floor(n / PER_ROW) * CH;
    fillRect(fx, fy, famW - 4, CH - 2, (x, y) => bg(x, y));
    text(key.replace(/^fx:/, ''), fx + 4, fy + 4, b < 2 ? [46, 34, 47] : [255, 236, 170]);
    frames.forEach((s, i) => blitFrame(s, fx + LABW + i * CW, fy));
  });
});
if (!NOSTRIP) {
  const y0 = 4 + BANDS.length * bandH;
  text('markers on every ground', 8, y0 + 2);
  const byName = new Map(man.sprites.map((s) => [s.match, s]));
  GROUNDS.forEach((g, j) => {
    const fy = y0 + TITLE + j * CH, bg = tile(g);
    fillRect(4, fy, PER_ROW * famW - 4, CH - 2, (x, y) => bg(x, y));
    text(g, 8, fy + 4, [46, 34, 47]);
    STRIP.forEach((nm, i) => { const s = byName.get(nm); if (s) blitFrame(s, 4 + LABW + i * CW, fy); });
  });
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodePNG(W, H, img));
console.log(`${path.relative(ROOT, OUT)}: ${man.sprites.length} frames in ${FAMS.length} families, x${K}, ${W}x${H}`);
