// The old keeper's workshop-home (ROADMAP.md 3.2, the screenshot test): a few clockwork details
// pixeled over the composed farmhouse (bld:farmhouse:<season>:<night>, 116 x 107, origin (2, 27)) so
// the biggest sprite in the first frame reads as the keeper's works, not a Stardew cottage. Drawn by
// script, 0 PixelLab generations; the frame, footprint, door and anchor stay exactly as composed.
//
//   - a brass cog on the front gable's apex, over the ridge's end and above the dormer (12 x 12)
//   - a copper downpipe from a rain head under the west eave, two brass straps and a collar, into a
//     copper water tank with brass hoops and a pressure gauge at the west corner
//   - a brass mushroom vent on the ridge east of the chimney (the chimney itself is untouched)
//
// The details are the same in every season (the roof's snow is the composer's, and brass stays
// bare like the chimney's cap) and use no glass key color, so the night frames stay a recolor of
// the day ones. tools/compose.mjs draws them too (buildings.json "post": "keeper.mjs"), so a full
// rebuild reproduces them.
//
//   node art/buildings/keeper.mjs        rebuilds out/farmhouse.s<0-3>.png (compose's build() plus
//                                        the details), review: e2e/out/keeper-build.png
//   node scripts/sprites-import.mjs art/buildings/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf, hex } from '../../scripts/lib/pixel.mjs';

const W = 116, H = 107;
const L = {
  a: '#2e222f', // outline
  // brass, shadow -> light
  s: '#cd683d', m: '#f79617', b: '#f9c22b', h: '#fbff86',
  // copper, shadow -> light
  k: '#6e2727', r: '#b33831', c: '#ea4f36', l: '#f57d4a', P: '#fca790',
  // the cog's recessed face, the vent's mouth, the gauge's dial and needle
  f: '#7a3045', F: '#45293f', g: '#fdcbb0', n: '#7a3045',
};
/** the night recolor's keys (compose.mjs glassKey): nothing here may use them */
export const GLASS_KEY = ['#323353', '#484a77', '#8fd3ff'];

// the cog: 8 teeth (4 axis, 4 corner), a dark face ring around a lit hub; light from the upper left
const COG = [
  '.....aa.....',
  '..aaahbaaa..',
  '.ahbabbabma.',
  '.abbbbbbbma.',
  '.aabbffmmaa.',
  'ahbbfhbFmssa',
  'abbbfbsFmssa',
  '.aabmFFssaa.',
  '.abmmmssssa.',
  '.amsassassa.',
  '..aaassaaa..',
  '.....aa.....',
];
// the rain head under the west eave (x 1-4, from the eave's outline row 63)
const RAIN_HEAD = [
  'aaaa',
  'aPlr',
  'alcr',
  '.alr',
];
// the downpipe's end, its collar and the tank (x 0-9, rows 90-106: the tank stands on the ground
// line of the season props, in front of the foundation's west end)
const TANK = [
  '..alr.....',
  '..alr.....',
  '..abs.....',
  '..alraaa..',
  '.aalrbbma.',
  'ahbbbbbmsa',
  'aaaaaaaaaa',
  'aclllccrka',
  'abhbbmmssa',
  'aclaaacrka',
  'acaggnarka',
  'acagngarka',
  'acagggarka',
  'aclaaacrka',
  'abhbbmmssa',
  'aclllccrka',
  '.aaaaaaaa.',
];
// the vent: cap, dark mouth, pipe, flange on the ridge's top outline (row 20)
const VENT = [
  '.aaaa.',
  'ahbbma',
  'aFFFFa',
  '.abma.',
  '.abma.',
  '.abma.',
  '.abma.',
  'asbmsa',
];

const at = (img, x, y) => (y * img.w + x) * 4;
function stamp(img, x0, y0, rows) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    if (!(ch in L)) throw new Error(`keeper: no color for "${ch}"`);
    const x = x0 + i, y = y0 + j;
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) throw new Error(`keeper: (${x}, ${y}) is outside the frame`);
    img.data.set([...rgbOf(L[ch]), 255], at(img, x, y));
  }));
}

/** Draw the keeper's details onto a composed farmhouse frame (in place). */
export default function drawKeeper(img, season) {
  if (img.w !== W || img.h !== H) throw new Error(`keeper: farmhouse frame is ${img.w}x${img.h}, expected ${W}x${H} (the coordinates below are frame px)`);
  void season; // the same in every season
  // the cog, centered on the ridge's end (x 57.5); its bottom outline stays a row clear of the dormer's
  stamp(img, 52, 33, COG);
  // the downpipe: rain head, pipe down the west corner (its right outline is the wall's), straps
  stamp(img, 1, 63, RAIN_HEAD);
  for (let y = 67; y < 90; y++) stamp(img, 2, y, [y === 72 || y === 82 ? 'abs' : 'alr']);
  stamp(img, 0, H - TANK.length, TANK);
  // the vent, standing on the ridge east of the chimney
  stamp(img, 94, 13, VENT);
  return img;
}

// ---- rebuild the farmhouse frames and a review image ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(base, '../..');
  // compose.mjs is imported here, not at the top: it imports this module for its "post" step
  const { build } = await import(pathToFileURL(path.join(base, 'tools/compose.mjs')).href);
  const cfg = JSON.parse(fs.readFileSync(path.join(base, 'buildings.json'), 'utf8')).farmhouse;
  if (cfg.post !== 'keeper.mjs') console.log('  note: buildings.json farmhouse has no "post": "keeper.mjs"; compose.mjs would drop the details');
  const pairs = [];
  for (let s = 0; s < 4; s++) {
    const r = build(cfg, s);
    const before = { w: r.img.w, h: r.img.h, data: new Uint8Array(r.img.data) };
    drawKeeper(r.img, s);
    // checks: same frame and anchor, palette only, opaque only, no glass key among the new pixels
    if (r.img.w !== W || r.img.h !== H || r.ox !== 2 || r.oy !== 27) throw new Error(`farmhouse s${s}: frame ${r.img.w}x${r.img.h} origin ${r.ox},${r.oy} (expected ${W}x${H}, 2,27)`);
    let changed = 0;
    for (let i = 0; i < r.img.data.length; i += 4) {
      const a = r.img.data[i + 3];
      if (a && a !== 255) throw new Error(`farmhouse s${s}: semi-transparent pixel`);
      if (!a) continue;
      const c = hex(r.img.data[i], r.img.data[i + 1], r.img.data[i + 2]);
      if (!PAL.includes(c)) throw new Error(`farmhouse s${s}: ${c} is not a palette color`);
      const was = before.data[i + 3] ? hex(before.data[i], before.data[i + 1], before.data[i + 2]) : null;
      if (c !== was) {
        changed++;
        if (GLASS_KEY.includes(c)) throw new Error(`farmhouse s${s}: the details use the glass key ${c} (it would glow at night)`);
      }
    }
    const file = path.join(base, `out/farmhouse.s${s}.png`);
    fs.writeFileSync(file, encodePNG(r.img.w, r.img.h, r.img.data));
    fs.writeFileSync(file + '.json', JSON.stringify({ frame: [r.img.w, r.img.h], origin: [r.ox, r.oy] }));
    console.log(`  farmhouse s${s}: ${changed} px of clockwork, frame ${r.img.w}x${r.img.h}, origin ${r.ox},${r.oy}`);
    pairs.push([before, r.img]);
  }
  // review: before | after per season (spring, summer, fall, winter), day on grass and night on
  // dusk (the sheet's night recolor), at 1x and 3x
  const NIGHT = Object.fromEntries(GLASS_KEY.map((g, i) => [g, ['#e6904e', '#fbb954', '#fbff86'][i]]));
  const night = (im) => {
    const o = { w: im.w, h: im.h, data: new Uint8Array(im.data) };
    for (let i = 0; i < o.data.length; i += 4) {
      if (!o.data[i + 3]) continue;
      const to = NIGHT[hex(o.data[i], o.data[i + 1], o.data[i + 2])];
      if (to) o.data.set(rgbOf(to), i);
    }
    return o;
  };
  const rows = [pairs.flatMap(([b, a]) => [[b, [35, 144, 99]], [a, [35, 144, 99]]]), pairs.flatMap(([b, a]) => [[night(b), [22, 58, 64]], [night(a), [22, 58, 64]]])];
  const gap = 4, cols = rows[0].length;
  const block = (k) => ({ w: cols * (W * k + gap) + gap, h: rows.length * (H * k + gap) + gap });
  const b1 = block(1), b3 = block(3);
  const out = { w: Math.max(b1.w, b3.w), h: b1.h + b3.h, data: null };
  out.data = new Uint8Array(out.w * out.h * 4);
  for (let i = 0; i < out.data.length; i += 4) out.data.set([46, 34, 47, 255], i);
  const draw = (k, oy) => rows.forEach((row, ri) => row.forEach(([im, bg], ci) => {
    for (let y = 0; y < H * k; y++) for (let x = 0; x < W * k; x++) {
      const s = at(im, (x / k) | 0, (y / k) | 0);
      const p = ((oy + gap + ri * (H * k + gap) + y) * out.w + gap + ci * (W * k + gap) + x) * 4;
      out.data.set(im.data[s + 3] ? [im.data[s], im.data[s + 1], im.data[s + 2], 255] : [...bg, 255], p);
    }
  }));
  draw(1, 0);
  draw(3, b1.h);
  const rev = path.join(root, 'e2e/out/keeper-build.png');
  fs.mkdirSync(path.dirname(rev), { recursive: true });
  fs.writeFileSync(rev, encodePNG(out.w, out.h, out.data));
  console.log('review: e2e/out/keeper-build.png (before | after, spring summer fall winter; day, night; 1x then 3x)');
}
