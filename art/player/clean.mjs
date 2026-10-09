// Position-based part tagging for the player sheets, run before scripts/art-import.mjs.
//
// PixelLab draws the boots and the tool handles (and the fishing rod) in the same dark browns as the
// hair, so color rules alone would let the look system recolor them with the hair (orange boots for
// blonde hair, a pink rod for rose hair) or leave dark specks in light hair. This pass decides by
// position and writes tag colors that only the `boots` / `wood` parts list:
//   feet  every frame: in the lowest 4 rows, within 7 px of the feet center, pixels the recipe would
//         give to hair (or dark unclaimed browns) become boots (tag colors, dark / light)
//   wood  tool-swing frames (<kind>/<dir>/<n>.png): the hair is the largest blob of hair colors in the
//         animation's reference frame 0, found again in each frame by template matching (the head
//         moves a few px in a swing); hair-colored pixels outside it (dilated by the recipe's
//         meta.cleanGrow px, default 1; more for hair that swings, like a ponytail) become wood
// A recipe lists its inputs as clean/<raw path>; this script writes them from <raw path>.
//
// Usage: node art/player/clean.mjs art/player/recipe.json [more recipes…]
//        then node scripts/art-import.mjs <recipe>
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';
import { lab, de2000, rgbOf } from '../../scripts/lib/pixel.mjs';

const FEET_ROWS = 4, FEET_HALF = 7, SHIFT = 4;
const hex = (d, i) => '#' + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, '0')).join('');
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

for (const recipeFile of process.argv.slice(2)) {
  const R = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
  const dir = path.dirname(recipeFile);
  // the same rule as scripts/art-import.mjs: nearest listed source color within dE00 8 (tags excluded)
  const probes = Object.entries(R.parts).filter(([p]) => p !== 'boots' && p !== 'wood').flatMap(([part, p]) => p.from.map((c) => ({ part, L: lab(rgbOf(c.toLowerCase())) })));
  const memo = new Map();
  const partOf = (h) => {
    if (!memo.has(h)) { const L = lab(rgbOf(h)); let best = null, bd = 8; for (const q of probes) { const d = de2000(L, q.L, 1); if (d < bd) { bd = d; best = q.part; } } memo.set(h, best); }
    return memo.get(h);
  };
  const [bootDark, bootLight] = R.parts.boots.from;
  const wood = R.parts.wood?.from;
  const isHair = (h) => partOf(h) === 'hair';
  const GROW = R.meta?.cleanGrow ?? 1;
  const raws = [...new Set(Object.values(R.input).flat().filter((p) => p && p.startsWith('clean/')))].map((p) => p.slice(6));
  let feet = 0, handles = 0;
  const refBlob = new Map(); // animation dir -> hair blob of frame 0
  for (const raw of raws) {
    const img = decodePNG(fs.readFileSync(path.join(dir, raw)));
    const W = img.w, H = img.h;
    const px = (x, y) => hex(img.data, (y * W + x) * 4);
    const on = (x, y) => img.data[(y * W + x) * 4 + 3] >= 128;
    // ---- wood (tool-swing frames) ----
    const m = raw.match(/^(.*\/(?:tool_swing|hoe|axe|pick|can|scythe|rod|sword)\/[a-z-]+)\/\d+\.png$/);
    if (m && wood) {
      if (!refBlob.has(m[1])) {
        const ref = decodePNG(fs.readFileSync(path.join(dir, m[1], '0.png')));
        const mask = new Uint8Array(ref.w * ref.h);
        for (let p = 0; p < mask.length; p++) if (ref.data[p * 4 + 3] >= 128 && isHair(hex(ref.data, p * 4))) mask[p] = 1;
        // largest 8-connected component
        const seen = new Uint8Array(mask.length);
        let best = [];
        for (let s = 0; s < mask.length; s++) {
          if (!mask[s] || seen[s]) continue;
          const comp = [], st = [s];
          seen[s] = 1;
          while (st.length) {
            const p = st.pop();
            comp.push(p);
            const x = p % ref.w, y = (p / ref.w) | 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, yy = y + dy, q = yy * ref.w + xx;
                if (xx >= 0 && yy >= 0 && xx < ref.w && yy < ref.h && mask[q] && !seen[q]) { seen[q] = 1; st.push(q); }
              }
          }
          if (comp.length > best.length) best = comp;
        }
        refBlob.set(m[1], best.map((p) => [p % ref.w, (p / ref.w) | 0]));
      }
      const blob = refBlob.get(m[1]);
      let bx = 0, by = 0, bs = -1;
      for (let dy = -SHIFT; dy <= SHIFT; dy++)
        for (let dx = -SHIFT; dx <= SHIFT; dx++) {
          let s = 0;
          for (const [x, y] of blob) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && on(xx, yy) && isHair(px(xx, yy))) s++; }
          if (s > bs || (s === bs && Math.abs(dx) + Math.abs(dy) < Math.abs(bx) + Math.abs(by))) { bs = s; bx = dx; by = dy; }
        }
      const keep = new Uint8Array(W * H);
      for (const [x, y] of blob)
        for (let ey = -GROW; ey <= GROW; ey++)
          for (let ex = -GROW; ex <= GROW; ex++) { const xx = x + bx + ex, yy = y + by + ey; if (xx >= 0 && yy >= 0 && xx < W && yy < H) keep[yy * W + xx] = 1; }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!on(x, y) || keep[y * W + x]) continue;
          const h = px(x, y);
          if (!isHair(h)) continue;
          img.data.set(rgbOf(luma(rgbOf(h)) < 70 ? wood[0] : wood[1]), (y * W + x) * 4);
          handles++;
        }
    }
    // ---- feet (every frame) ----
    let yb = -1;
    for (let y = H - 1; y >= 0 && yb < 0; y--) for (let x = 0; x < W; x++) if (on(x, y)) { yb = y; break; }
    const xs = [];
    for (let y = yb - 5; y <= yb; y++) for (let x = 0; x < W; x++) if (on(x, y)) xs.push(x);
    xs.sort((a, b) => a - b);
    const cx = xs[xs.length >> 1];
    for (let y = Math.max(0, yb - FEET_ROWS + 1); y <= yb; y++)
      for (let x = Math.max(0, cx - FEET_HALF); x <= Math.min(W - 1, cx + FEET_HALF); x++) {
        if (!on(x, y)) continue;
        const h = px(x, y), c = rgbOf(h), part = partOf(h);
        const L = luma(c);
        const brownish = !part && L >= 12 && L < 90 && c[0] >= c[2]; // dark warm, unclaimed
        if (part !== 'hair' && !brownish) continue;
        img.data.set(rgbOf(L < 40 ? bootDark : bootLight), (y * W + x) * 4);
        feet++;
      }
    const out = path.join(dir, 'clean', raw);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, encodePNG(W, H, img.data));
  }
  console.log(`${path.basename(recipeFile)}: ${raws.length} frames, ${feet} boot px and ${handles} handle px tagged -> ${path.relative(process.cwd(), path.join(dir, 'clean'))}`);
}
