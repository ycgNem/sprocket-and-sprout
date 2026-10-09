// Pixel helpers for the nature build (art/nature/build.mjs): load raw PixelLab frames, map their
// colors onto material ramps by lightness (instead of nearest-color snapping, which scrambles
// canopies and turns the outline gray), outline, snow caps and fruit. Everything works on
// { w, h, data: Uint8Array RGBA } images.
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';
import { detectScale, downscale, lab, rgbOf, hex, bbox, crop, blank, blit, de2000, PAL } from '../../scripts/lib/pixel.mjs';

export { bbox, crop, blank, blit, hex, rgbOf };

export function load(file) {
  const raw = decodePNG(fs.readFileSync(file));
  const img = downscale(raw, detectScale(raw)).img;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] < 128) img.data.fill(0, i, i + 4); else img.data[i + 3] = 255;
  return img;
}
export function save(file, img) {
  fs.writeFileSync(file, encodePNG(img.w, img.h, img.data));
}
export const ALL = PAL;
export const clone = (img) => ({ w: img.w, h: img.h, data: new Uint8Array(img.data) });
export const at = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.data[(y * img.w + x) * 4 + 3]);
export const get = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const p = (y * img.w + x) * 4;
  return img.data[p + 3] ? hex(img.data[p], img.data[p + 1], img.data[p + 2]) : null;
};
export function set(img, x, y, c) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const p = (y * img.w + x) * 4;
  if (c === null) img.data.fill(0, p, p + 4);
  else img.data.set([...rgbOf(c), 255], p);
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
 * Map colors onto ramps. families: [{ name, test({h,s,v,L}) -> bool, ramp: [dark..light], lo?, hi? }]
 * tested in order; pixels no family takes keep a nearest-L pick from the last family.
 * Each family's source lightness range (2nd..98th percentile, or lo/hi) is stretched onto its
 * ramp's lightness range and every pixel takes the ramp color nearest in lightness.
 * Edge pixels darker than `outlineL` (L*) become `outline`; darker interior pixels the family's
 * darkest shade.
 */
export function mapRamps(img, { families, outline = '#2e222f', outlineL = 22, edgeOnly = true }) {
  const n = img.w * img.h;
  const fam = new Int16Array(n).fill(-1), Ls = new Float32Array(n);
  const info = [];
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (!img.data[p + 3]) continue;
    const [r, g, b] = [img.data[p], img.data[p + 1], img.data[p + 2]];
    const c = { ...hsv(r, g, b), L: lab([r, g, b])[0] };
    Ls[i] = c.L;
    let f = families.findIndex((F) => F.test(c));
    if (f < 0) f = families.length - 1;
    fam[i] = f;
    info[i] = c;
  }
  const ranges = families.map((F, f) => {
    const v = [];
    for (let i = 0; i < n; i++) if (fam[i] === f && Ls[i] >= outlineL) v.push(Ls[i]);
    v.sort((a, b) => a - b);
    const q = (t) => (v.length ? v[Math.min(v.length - 1, Math.floor(t * v.length))] : 50);
    return F.among ? null : { lo: F.lo ?? q(0.02), hi: F.hi ?? q(0.98), rl: F.ramp.map(Lof) };
  });
  const out = clone(img);
  for (let i = 0; i < n; i++) {
    if (fam[i] < 0) continue;
    const x = i % img.w, y = Math.floor(i / img.w);
    const edge = !at(img, x - 1, y) || !at(img, x + 1, y) || !at(img, x, y - 1) || !at(img, x, y + 1);
    const F = families[fam[i]], R = ranges[fam[i]];
    if (Ls[i] < outlineL && (edge || !edgeOnly)) { set(out, x, y, outline); continue; }
    if (F.among) {
      // restricted nearest-color snap (accents: petals, gems, berries)
      const p = i * 4, L = lab([img.data[p], img.data[p + 1], img.data[p + 2]]);
      let best = F.among[0], bd = Infinity;
      for (const c of F.among) { const d = de2000(L, lab(rgbOf(c)), F.kL ?? 1); if (d < bd) { bd = d; best = c; } }
      set(out, x, y, best);
      continue;
    }
    if (Ls[i] < outlineL) { set(out, x, y, F.ramp[0]); continue; }
    const t = Math.max(0, Math.min(1, (Ls[i] - R.lo) / Math.max(1, R.hi - R.lo)));
    const target = R.rl[0] + t * (R.rl[R.rl.length - 1] - R.rl[0]);
    let best = 0;
    for (let k = 1; k < R.rl.length; k++) if (Math.abs(R.rl[k] - target) < Math.abs(R.rl[best] - target)) best = k;
    set(out, x, y, F.ramp[best]);
  }
  return out;
}

/** Outer 1 px outline around the silhouette (grows the art by 1 px; 4-neighbourhood). */
export function outlineOuter(img, color = '#2e222f') {
  const out = clone(img);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (at(img, x, y)) continue;
      if (at(img, x - 1, y) || at(img, x + 1, y) || at(img, x, y - 1) || at(img, x, y + 1)) set(out, x, y, color);
    }
  return out;
}

/** Inner outline: silhouette edge pixels become `color` (keeps the size). Thin parts stay readable with `minRun`. */
export function outlineInner(img, color = '#2e222f', { sides = 'all' } = {}) {
  const out = clone(img);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (!at(img, x, y)) continue;
      const l = !at(img, x - 1, y), r = !at(img, x + 1, y), u = !at(img, x, y - 1), d = !at(img, x, y + 1);
      const hit = sides === 'all' ? l || r || u || d : sides === 'shadow' ? r || d : false;
      if (hit) set(out, x, y, color);
    }
  return out;
}

/** Replace colors by a map (exact hex). */
export function recolor(img, map) {
  const out = clone(img);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = get(img, x, y);
      if (c && map[c]) set(out, x, y, map[c]);
    }
  return out;
}

export function colorsOf(img) {
  const m = new Map();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = get(img, x, y); if (c) m.set(c, (m.get(c) ?? 0) + 1); }
  return m;
}

/** Deterministic hash in [0, 1). */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Snow on the top surfaces: every pixel of `on` colors whose pixel above is transparent or
 * outline becomes snow, and the one below it too with chance `deep`.
 */
export function snowcap(img, { on, outline = '#2e222f', snow = '#ffffff', shade = '#c7dcd0', deep = 0.55, seed = 1, maxY = Infinity, thick = 3 } = {}) {
  const out = clone(img);
  const ok = (c) => c && c !== outline && (!on || on.includes(c));
  const bb = bbox(img);
  const right = bb ? bb.x1 - Math.floor((bb.x1 - bb.x0 + 1) / 4) : img.w;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (y > maxY) continue;
      const c = get(img, x, y);
      if (!ok(c)) continue;
      const up = y > 0 ? get(img, x, y - 1) : null;
      if (up !== null && up !== outline) continue;
      // only on surfaces at least `thick` px deep (a 1 px stick or stem stays bare)
      let deepEnough = true;
      for (let k = 1; k < thick; k++) if (!ok(get(img, x, y + k) ?? null)) deepEnough = false;
      if (!deepEnough) continue;
      // the cap is white; the art's right (shadow) quarter gets the shaded snow
      set(out, x, y, x > right ? shade : snow);
      if (y + 1 < img.h && ok(get(img, x, y + 1)) && hash(x, y, seed) < deep) set(out, x, y + 1, shade);
    }
  return out;
}

/** Composite a small sprite (rows of chars, '.' transparent) with a color key at (x, y). */
export function stamp(img, x0, y0, rows, key) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && key[ch]) set(img, x0 + x, y0 + y, key[ch]); }));
}

/** Where the trunk base is: center column of the opaque run in the lowest rows of the art. */
export function trunkBase(img) {
  const b = bbox(img);
  let best = null;
  for (let y = b.y1; y >= Math.max(b.y0, b.y1 - 3) && !best; y--) {
    const xs = [];
    for (let x = b.x0; x <= b.x1; x++) if (at(img, x, y)) xs.push(x);
    if (xs.length) best = { x: Math.round((xs[0] + xs[xs.length - 1]) / 2), y: b.y1 };
  }
  return best;
}

/** Put art (cropped to its bbox) into a w x h frame so that point (px, py) of the source lands on (ox, oy). */
export function place(img, w, h, px, py, ox, oy) {
  const out = blank(w, h);
  const clipped = blit(out, img, ox - px, oy - py);
  return { img: out, clipped };
}

/**
 * Remove specks inside a canopy (fruit the generator drew, autumn flecks): a non-leaf pixel with at
 * least `need` leaf pixels among its 8 neighbours takes the most common of them. Runs `passes` times.
 */
export function cleanCanopy(img, leafSet, { need = 5, passes = 2, outline = '#2e222f' } = {}) {
  let cur = img;
  for (let p = 0; p < passes; p++) {
    const out = clone(cur);
    for (let y = 0; y < cur.h; y++)
      for (let x = 0; x < cur.w; x++) {
        const c = get(cur, x, y);
        if (!c || leafSet.has(c) || c === outline) continue;
        const cnt = new Map();
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const k = get(cur, x + dx, y + dy);
            if (k && leafSet.has(k)) { n++; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
          }
        if (n >= need) set(out, x, y, [...cnt].sort((a, b) => b[1] - a[1])[0][0]);
      }
    cur = out;
  }
  return cur;
}
