// Pixel helpers for the Tinker's Yard wrecks (art/ruins/build.mjs): load a PixelLab candidate, grade
// its colors onto the game's material ramps by family and lightness (a plain nearest-color snap
// turns the moss khaki and the rust muddy), outline, and the season passes (blossom, dry leaves,
// snow). Images are the factory kit's Img (palette hex per pixel, null = clear).
import fs from 'node:fs';
import { decodePNG } from '../../../scripts/lib/png.mjs';
import { detectScale, downscale, lab, rgbOf, de2000 } from '../../../scripts/lib/pixel.mjs';
import { Img, INK } from '../../factory/gen/lib.mjs';

export { Img, INK };

/** a raw candidate as { w, h, data } with hard alpha, integer upscaling undone */
export function loadRaw(file) {
  const raw = decodePNG(fs.readFileSync(file));
  const img = downscale(raw, detectScale(raw)).img;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] < 128) img.data.fill(0, i, i + 4); else img.data[i + 3] = 255;
  return img;
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx / 255 };
}
const Lof = (c) => lab(rgbOf(c))[0];

/**
 * Grade a raw image onto ramps: families [{ name, test({h,s,v,L}), ramp: [dark..light], lo?, hi? }]
 * are tried in order (the last takes the rest). Each family's lightness range (2nd..98th
 * percentile, or lo/hi) is stretched onto its ramp; edge pixels darker than outlineL become INK.
 * Returns { im, fam } (fam: family name per pixel, for the season passes).
 */
export function grade(raw, families, { outlineL = 20, holeL = 12, nearest = false } = {}) {
  const n = raw.w * raw.h, fam = new Array(n).fill(null), Ls = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (!raw.data[p + 3]) continue;
    const [r, g, b] = [raw.data[p], raw.data[p + 1], raw.data[p + 2]];
    const c = { ...hsv(r, g, b), L: lab([r, g, b])[0] };
    Ls[i] = c.L;
    let f = families.findIndex((F) => F.test(c));
    if (f < 0) f = families.length - 1;
    fam[i] = f;
  }
  const ranges = families.map((F, f) => {
    const v = [];
    for (let i = 0; i < n; i++) if (fam[i] === f && Ls[i] >= outlineL) v.push(Ls[i]);
    v.sort((a, b) => a - b);
    const q = (t) => (v.length ? v[Math.min(v.length - 1, Math.floor(t * v.length))] : 50);
    return { lo: F.lo ?? q(0.02), hi: F.hi ?? q(0.98), rl: F.ramp.map(Lof) };
  });
  const im = new Img(raw.w, raw.h);
  const opaque = (x, y) => x >= 0 && y >= 0 && x < raw.w && y < raw.h && raw.data[(y * raw.w + x) * 4 + 3];
  const names = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (fam[i] === null) continue;
    const x = i % raw.w, y = Math.floor(i / raw.w);
    const edge = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
    const F = families[fam[i]], R = ranges[fam[i]];
    // the darkest pixels: the outline at the silhouette's edge, and inside it a hole (an open end,
    // a gap between parts) in the outline's plum-black, the rest the family's darkest shade
    if (Ls[i] < outlineL) { const ink = edge || Ls[i] < holeL; im.set(x, y, ink ? INK : F.ramp[0]); names[i] = ink ? 'ink' : F.name; continue; }
    let best = 0;
    if (nearest && !F.stretch) {
      // the ramp colour closest to the source (CIEDE2000, lightness at half weight): keeps the
      // values of a candidate that is already close to the palette
      const p = i * 4, L = lab([raw.data[p], raw.data[p + 1], raw.data[p + 2]]);
      let bd = Infinity;
      F.ramp.forEach((c, k) => { const d = de2000(L, lab(rgbOf(c)), 2); if (d < bd) { bd = d; best = k; } });
    } else {
      // the family's lightness range stretched onto the ramp
      const t = Math.max(0, Math.min(1, (Ls[i] - R.lo) / Math.max(1, R.hi - R.lo)));
      const target = R.rl[0] + t * (R.rl[R.rl.length - 1] - R.rl[0]);
      for (let k = 1; k < R.rl.length; k++) if (Math.abs(R.rl[k] - target) < Math.abs(R.rl[best] - target)) best = k;
    }
    im.set(x, y, F.ramp[best]);
    names[i] = F.name;
  }
  return { im, fam: names };
}

/** deterministic hash in [0, 1) */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** trim to the art and paste into a w x h frame with the art's bottom-centre at (cx, by) */
export function placeIn(im, w, h, cx, by) {
  const b = im.bbox();
  const art = im.crop(b.x0, b.y0, b.w, b.h);
  const o = new Img(w, h);
  const dx = cx - Math.floor(b.w / 2), dy = by - (b.h - 1);
  if (dx < 0 || dy < 0 || dx + b.w > w || dy + b.h > h) throw new Error(`art ${b.w}x${b.h} does not fit ${w}x${h} at bottom-centre ${cx},${by}`);
  o.draw(art, dx, dy);
  return o;
}

/** isolated pixels (no 4-neighbour of the same color family) are noise from the generator */
export function dropLonely(im, keep = () => false) {
  const o = im.clone();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = im.get(x, y);
    if (!c || keep(c, x, y)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => im.get(x + dx, y + dy));
    if (n.every((q) => !q)) o.set(x, y, null);
  }
  im.px = o.px;
  return im;
}

/** close the outline: a clear pixel next to art becomes INK (4-neighbourhood) */
export function closeOutline(im) {
  return im.outline(INK);
}

/** pixels whose upward neighbour is clear or outline: the top surfaces (snow, fallen leaves) */
export function tops(im, ok = () => true) {
  const out = [];
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = im.get(x, y);
    if (!c || c === INK || !ok(c, x, y)) continue;
    const up = im.get(x, y - 1);
    if (!up || up === INK) out.push([x, y]);
  }
  return out;
}
