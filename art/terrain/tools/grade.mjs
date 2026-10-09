// Color grading for terrain art: maps PixelLab colors onto chosen Resurrect-64 ramps per material,
// so every terrain PNG handed to scripts/terrain-import.mjs is already palette-exact and the import
// snap changes nothing. A plain nearest-color snap turns PixelLab's lime grass pale and its dirt
// gray; grading keeps the light/dark structure of the generated art and picks the colors.
//
// Usage: node art/terrain/tools/grade.mjs art/terrain/grade.json [job-name …]
//
// grade.json:
//   materials: { name: { ladder: ["#dark", …, "#light"], cuts: [L1, …] | null, fractions: [f0, …],
//                        ref: "file.png" | {file, rect}, rules: [{ hue, sat, L, to }] } }
//     A pixel of a material gets ladder[i] where i = number of cuts below its source Lab lightness.
//     Without cuts, they are computed from `ref` so the ladder steps cover `fractions` of its pixels.
//     `map` { "#src": "#dst" } (material or job) is checked first, then `rules`: hue [lo, hi] in degrees (HSV), sat [lo, hi] 0..1, L [lo, hi] Lab.
//   jobs: [{ name, in, out, classify: [{ material, hue, sat, L }], fallback: material, copy: [files] }]
//     Each source color goes to the first classify entry it matches, else `fallback`.
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { lab, rgbOf, hex, crop, de2000, PAL } from '../../../scripts/lib/pixel.mjs';

export function hsv(r, g, b) {
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
const inR = (v, r) => !r || (r[0] <= r[1] ? v >= r[0] && v <= r[1] : v >= r[0] || v <= r[1]);
export function matches(rule, c) {
  return inR(c.h, rule.hue) && inR(c.s, rule.sat) && inR(c.L, rule.L);
}
export function describe(r, g, b) {
  const { h, s } = hsv(r, g, b);
  return { h, s, L: lab([r, g, b])[0] };
}

export function load(file, rect) {
  const raw = decodePNG(fs.readFileSync(file));
  return rect ? crop(raw, ...rect) : raw;
}

/** cuts so that ladder step i covers fractions[i] of the material's pixels in img */
export function autoCuts(img, test, fractions) {
  const Ls = [];
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    const c = describe(img.data[i], img.data[i + 1], img.data[i + 2]);
    if (test(c)) Ls.push(c.L);
  }
  Ls.sort((a, b) => a - b);
  const cuts = [];
  let acc = 0;
  for (let k = 0; k < fractions.length - 1; k++) {
    acc += fractions[k];
    const idx = Math.min(Ls.length - 1, Math.max(0, Math.round(acc * Ls.length)));
    // cut between distinct values
    const v = Ls[idx];
    let lo = idx;
    while (lo > 0 && Ls[lo - 1] === v) lo--;
    let cut = lo > 0 ? (Ls[lo - 1] + v) / 2 : v - 0.01;
    // never collapse two ladder steps onto one cut: move up to the next distinct lightness
    const prev = cuts.length ? cuts[cuts.length - 1] : -Infinity;
    if (cut <= prev) {
      const next = Ls.find((L) => L > prev);
      const after = next === undefined ? undefined : Ls.find((L) => L > next);
      cut = after === undefined ? prev + 0.01 : (next + after) / 2;
    }
    cuts.push(cut);
  }
  return cuts;
}

export function makeGrader(cfg, baseDir) {
  const M = {};
  for (const [name, m] of Object.entries(cfg.materials)) {
    let cuts = m.cuts;
    if (!cuts && m.ref) {
      const r = typeof m.ref === 'string' ? { file: m.ref } : m.ref;
      const img = load(path.resolve(baseDir, r.file), r.rect);
      const test = (c) => (m.refTest ? matches(m.refTest, c) : true) && !(m.rules ?? []).some((q) => matches(q, c));
      cuts = autoCuts(img, test, m.fractions);
    }
    M[name] = { ...m, cuts: cuts ?? [] };
  }
  return M;
}

export function gradeImage(img, job, M) {
  const out = { w: img.w, h: img.h, data: new Uint8Array(img.data) };
  const stats = {};
  const cache = new Map();
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] < 128) { out.data.fill(0, i, i + 4); continue; }
    out.data[i + 3] = 255;
    const key = (out.data[i] << 16) | (out.data[i + 1] << 8) | out.data[i + 2];
    let res = cache.get(key);
    if (!res) {
      const c = describe(out.data[i], out.data[i + 1], out.data[i + 2]);
      const srcHex0 = hex(out.data[i], out.data[i + 1], out.data[i + 2]);
      const cls = job.assign?.[srcHex0] ? { material: job.assign[srcHex0] } : (job.classify ?? []).find((q) => matches(q, c));
      const mat = cls ? cls.material : job.fallback;
      const m = M[mat];
      if (!m) throw new Error(`job ${job.name}: no material ${mat}`);
      const srcHex = hex(out.data[i], out.data[i + 1], out.data[i + 2]);
      const rule = (m.rules ?? []).find((q) => matches(q, c));
      let to;
      if (job.map?.[srcHex]) to = job.map[srcHex];
      else if (m.map?.[srcHex]) to = m.map[srcHex];
      else if (rule) to = rule.to;
      else if (m.nearest) {
        // nearest color among an allowed list ("all" = the whole palette minus m.except)
        const list = (m.nearest === 'all' ? PAL : m.nearest).filter((h) => !(m.except ?? []).includes(h));
        const L0 = lab([out.data[i], out.data[i + 1], out.data[i + 2]]);
        to = list.reduce((b, h) => (de2000(L0, lab(rgbOf(h)), 2) < de2000(L0, lab(rgbOf(b)), 2) ? h : b), list[0]);
      }
      else {
        let k = 0;
        while (k < m.cuts.length && c.L > m.cuts[k]) k++;
        to = m.ladder[Math.min(k, m.ladder.length - 1)];
      }
      res = to === 'none' ? { to: null, mat, toHex: 'none' } : { to: rgbOf(to.toLowerCase()), mat, toHex: to.toLowerCase() };
      cache.set(key, res);
    }
    if (res.to) out.data.set(res.to, i);
    else out.data.fill(0, i, i + 4);
    stats[res.mat] ??= {};
    stats[res.mat][res.toHex] = (stats[res.mat][res.toHex] ?? 0) + 1;
  }
  return { img: out, stats };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const [cfgFile, ...only] = process.argv.slice(2);
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  const baseDir = path.dirname(path.resolve(cfgFile));
  const M = makeGrader(cfg, baseDir);
  for (const [n, m] of Object.entries(M)) if (m.cuts.length) console.log(`  ${n}: cuts ${m.cuts.map((c) => c.toFixed(1)).join(' ')}`);
  const inherit = (job) => (job.like ? { ...inherit(cfg.jobs.find((j) => j.name === job.like)), ...job, like: undefined } : job);
  for (const job0 of cfg.jobs) {
    if (only.length && !only.includes(job0.name)) continue;
    const job = inherit(job0);
    const src = typeof job.in === 'string' ? { file: job.in } : job.in;
    const inPath = path.resolve(baseDir, src.file);
    // a directory in → every PNG in it, written to the out directory under the same name
    const pairs = fs.statSync(inPath).isDirectory()
      ? fs.readdirSync(inPath).filter((f) => /\.png$/i.test(f)).map((f) => [path.join(inPath, f), path.resolve(baseDir, job.out, f)])
      : [[inPath, path.resolve(baseDir, job.out)]];
    const stats = {};
    for (const [inFile, outFile] of pairs) {
      const img = load(inFile, src.rect);
      const r = gradeImage(img, job, M);
      for (const [mat, s] of Object.entries(r.stats)) for (const [h, n] of Object.entries(s)) { stats[mat] ??= {}; stats[mat][h] = (stats[mat][h] ?? 0) + n; }
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, encodePNG(r.img.w, r.img.h, r.img.data));
    }
    const outFile = path.resolve(baseDir, job.out);
    for (const c of job.copy ?? []) fs.copyFileSync(path.resolve(baseDir, c), path.join(path.dirname(outFile), path.basename(c)));
    const total = Object.values(stats).reduce((a, s) => a + Object.values(s).reduce((x, y) => x + y, 0), 0);
    const summary = Object.entries(stats).map(([mat, s]) => `${mat} ${Object.entries(s).sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h}:${((100 * n) / total).toFixed(0)}%`).join(' ')}`).join(' | ');
    console.log(`${job.name}: ${job.out}${pairs.length > 1 ? ` (${pairs.length} files)` : ''}  ${summary}`);
  }
}
