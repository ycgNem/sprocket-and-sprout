// Farmhouse furniture fix-ups: derives the PNGs the import reads (art/home/src/<name>.png) from the
// raw PixelLab downloads (art/home/raw/…), so every hand touch-up is written down and repeatable.
//
// Usage: node art/home/fixups.mjs            (all entries of fixups.json)
//        node art/home/fixups.mjs <name> …   (only these)
//
// fixups.json: { "<name>": { src, rect?, map?, px?, fill?, cutCols?, erase?, flipX? } }
//   src      raw PNG (relative to art/home); upscaling undone, colors snapped to the palette
//   rect     [x, y, w, h] crop (after unscaling), default: the art's bounding box
//   map      { "#from": "#to" } palette recolor of the whole sprite (e.g. the cream gap:
//            "#ab947a": "#fdcbb0")
//   mapRect  [x, y, w, h] limits `map` to this rectangle (after the crop)
//   maps     [{ rect, map }, …] more region-limited recolors, applied after `map`
//   cutCols  [[x, n], …] remove n columns starting at x (narrows a symmetric front face);
//            applied right-to-left so the x values refer to the uncut image
//   repeatRows [y, n] repeat rows y..y+n-1 once (lengthens a uniform middle), after cutCols
//   px       [[x, y, "#hex" | null], …] single pixels (null = transparent), after cutCols
//   fill     [[x, y, w, h, "#hex" | null], …] rectangles, after cutCols
//   erase    [[x, y, w, h], …] like fill with null
//   flipX    mirror the result
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArt, bbox, crop, blank, PAL, rgbOf, hex } from '../../scripts/lib/pixel.mjs';
import { encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = JSON.parse(fs.readFileSync(path.join(HERE, 'fixups.json'), 'utf8'));
const only = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'src'), { recursive: true });

const pal = (h, tag) => {
  if (h === null) return null;
  h = h.toLowerCase();
  if (!PAL.includes(h)) throw new Error(`${tag}: ${h} is not a palette color`);
  return rgbOf(h);
};
function put(img, x, y, c) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const p = (y * img.w + x) * 4;
  if (c === null) img.data[p + 3] = 0;
  else img.data.set([...c, 255], p);
}

for (const [name, e] of Object.entries(F)) {
  if (name.startsWith('_') || (only.length && !only.includes(name))) continue;
  const L = loadArt(path.join(HERE, e.src), 'auto');
  let img = L.img;
  const r = e.rect ?? (() => { const b = bbox(img); return [b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1]; })();
  img = crop(img, ...r);
  for (const mm of [...(e.map ? [{ map: e.map, rect: e.mapRect }] : []), ...(e.maps ?? [])]) {
    const m = new Map(Object.entries(mm.map).map(([a, b]) => [pal(a, name).join(), pal(b, name)]));
    const [rx, ry, rw, rh] = mm.rect ?? [0, 0, img.w, img.h];
    for (let i = 0; i < img.data.length; i += 4) {
      const x = (i / 4) % img.w, y = Math.floor(i / 4 / img.w);
      if (img.data[i + 3] < 128 || x < rx || y < ry || x >= rx + rw || y >= ry + rh) continue;
      const to = m.get([img.data[i], img.data[i + 1], img.data[i + 2]].join());
      if (to) img.data.set(to, i);
    }
  }
  for (const [x0, n] of [...(e.cutCols ?? [])].sort((a, b) => b[0] - a[0])) {
    const out = blank(img.w - n, img.h);
    for (let y = 0; y < img.h; y++)
      for (let x = 0, ox = 0; x < img.w; x++) {
        if (x >= x0 && x < x0 + n) continue;
        out.data.set(img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * out.w + ox++) * 4);
      }
    img = out;
  }
  if (e.repeatRows) {
    // [y, n]: repeat rows y..y+n-1 once more right after themselves (lengthens a uniform middle)
    const [y0, n] = e.repeatRows;
    const out = blank(img.w, img.h + n), row = img.w * 4;
    out.data.set(img.data.subarray(0, (y0 + n) * row), 0);
    out.data.set(img.data.subarray(y0 * row, (y0 + n) * row), (y0 + n) * row);
    out.data.set(img.data.subarray((y0 + n) * row), (y0 + 2 * n) * row);
    img = out;
  }
  for (const [x, y, w, h, c] of [...(e.fill ?? []), ...(e.erase ?? []).map((a) => [...a, null])])
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(img, xx, yy, pal(c, name));
  for (const [x, y, c] of e.px ?? []) put(img, x, y, pal(c, name));
  if (e.flipX) {
    const out = blank(img.w, img.h);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++)
      out.data.set(img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + img.w - 1 - x) * 4);
    img = out;
  }
  // trim to the art again (cuts and erases can leave empty borders)
  const b = bbox(img);
  img = crop(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
  const used = new Set();
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] >= 128) used.add(hex(img.data[i], img.data[i + 1], img.data[i + 2]));
  fs.writeFileSync(path.join(HERE, 'src', name + '.png'), encodePNG(img.w, img.h, img.data));
  console.log(`${name}: ${img.w}x${img.h}, ${used.size} colors`);
}
