// Seam audit for the dual-grid ground (ROADMAP 1.2, bug 3). Pure Node: reads the imported terrain
// sheet (src/art/terrain.json + .png, what scripts/terrain-import.mjs wrote), no dev server needed.
//
// The game draws one 16 px tile per grid vertex, picked from the classes of the four map tiles that
// meet there (src/render/art/match.ts pickVertex): a base variant when all four agree, else the Wang
// tile of the pair's set for its corner mask (NW 8, NE 4, SW 2, SE 1 = upper). So a set's masks 0 and
// 15 are never drawn; the class's base variants stand in for them. Two vertex tiles sit side by side
// when they share the two corners of the edge between them (left tile's NE/SE = right tile's NW/SW;
// upper tile's SW/SE = lower tile's NW/NE), within one set, across sets (an all-grass edge of
// path-grass next to an all-grass edge of dirt-grass) and against base variants.
//
// For every such pair (every variant of each) the audit compares the two pixel lines that touch:
//   shape  each edge pixel is labelled by which of the edge's classes owns its color (the colors of
//          that class's base variants; a color both own is a wildcard; anything else is "rim", e.g.
//          a shore outline). A pixel mismatches when no pixel within one row across the seam has a
//          compatible label: the boundary between the classes (or a rim) doesn't line up.
//   tone   on an edge of one class (both corners alike), the mean color of each tile's 2-px band is
//          compared with the mean of the class's base variants at the same pixel positions; more than
//          TONE (CIEDE2000) off marks the edge as mismatched (a set graded a shade off from the bases).
// mismatch % = mismatched edge pixels / 16. A tile pair whose worst variant combination reaches
// --min (default 2 pixels, 12.5 %) is an offender.
//
// Usage: node e2e/seams.mjs [--sheet src/art/terrain] [--out e2e/out/seams] [--min 2] [--top 40] [--tone 9]
//        [--only <text>]  (the contact image shows only pairs whose tile ids contain the text, e.g. path-sand)
// Writes <out>.md (ranked offenders) and <out>.png (the worst pairs at x4, seam marks in red).
// Always exits 0; prints the offender count.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../scripts/lib/png.mjs';
import { lab, rgbOf, de2000, hex, crop, blank, blit } from '../scripts/lib/pixel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHEET = path.resolve(ROOT, opt('--sheet', 'src/art/terrain'));
const OUT = path.resolve(ROOT, opt('--out', 'e2e/out/seams'));
const MIN = +opt('--min', 2), TOP = +opt('--top', 40), TONE = +opt('--tone', 9), ONLY = opt('--only', null);

const M = JSON.parse(fs.readFileSync(SHEET + '.json', 'utf8'));
const sheet = decodePNG(fs.readFileSync(SHEET + '.png'));
const T = M.tile ?? 16;
const cut = (xy) => crop(sheet, xy[0], xy[1], T, T);
const px = (img, x, y) => { const p = (y * img.w + x) * 4; return hex(img.data[p], img.data[p + 1], img.data[p + 2]); };

// ---- the vertex tiles the game can draw ----
/** groups: { id, set, mask, corners [nw, ne, sw, se], vars: [img] } */
const groups = [];
for (const [cls, list] of Object.entries(M.bases ?? {})) if (list.length) groups.push({ id: `base:${cls}`, set: `base ${cls}`, mask: 15, corners: [cls, cls, cls, cls], vars: list.map(cut) });
M.sets.forEach((s) => {
  for (let mask = 1; mask < 15; mask++) {
    const list = s.tiles[String(mask)];
    if (!list?.length) continue;
    groups.push({ id: `${s.lower}-${s.upper}:${mask}`, set: `${s.lower}-${s.upper}`, mask, corners: [8, 4, 2, 1].map((b) => (mask & b ? s.upper : s.lower)), vars: list.map(cut) });
  }
});
// the colors each class's base variants use
const colorsOf = {};
for (const [cls, list] of Object.entries(M.bases ?? {})) {
  const set = (colorsOf[cls] = new Set());
  for (const xy of list) { const img = cut(xy); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set.add(px(img, x, y)); }
}
const labCache = new Map();
const labOf = (h) => { let v = labCache.get(h); if (!v) labCache.set(h, (v = lab(rgbOf(h)))); return v; };

// ---- edges ----
// side: 'E' right column, 'W' left column, 'S' bottom row, 'N' top row; depth 0 = the edge line itself
function line(img, side, depth) {
  const out = [];
  for (let i = 0; i < T; i++) {
    const [x, y] = side === 'E' ? [T - 1 - depth, i] : side === 'W' ? [depth, i] : side === 'S' ? [i, T - 1 - depth] : [i, depth];
    out.push(px(img, x, y));
  }
  return out;
}
/** the two corner classes along a side, in edge order (top→bottom or left→right) */
const sideCorners = (c, side) => (side === 'E' ? [c[1], c[3]] : side === 'W' ? [c[0], c[2]] : side === 'S' ? [c[2], c[3]] : [c[0], c[1]]);

/** label of a color on an edge whose corner classes are [c0, c1]: a class, '*' (both own it) or 'x' (rim / foreign) */
function labelOf(h, [c0, c1]) {
  const a = colorsOf[c0]?.has(h), b = colorsOf[c1]?.has(h);
  if (c0 === c1) return a ? c0 : 'x';
  if (a && b) return '*';
  return a ? c0 : b ? c1 : 'x';
}
const compatible = (p, q) => p === '*' || q === '*' || p === q;

const addLab = (s, l) => { s[0] += l[0]; s[1] += l[1]; s[2] += l[2]; };
/** per class and side: the mean Lab color at each edge position (depth 0 and 1) over the class's base variants */
const refBand = {};
for (const [cls, list] of Object.entries(M.bases ?? {})) {
  refBand[cls] = {};
  for (const side of ['E', 'W', 'S', 'N'])
    refBand[cls][side] = [0, 1].map((d) => {
      const acc = Array.from({ length: T }, () => [0, 0, 0]);
      for (const xy of list) line(cut(xy), side, d).forEach((h, i) => addLab(acc[i], labOf(h)));
      return acc.map((s) => s.map((v) => v / list.length));
    });
}
/**
 * How far (dE00) a tile's class-c pixels along one side are from what the class's bases have at the
 * same positions. Comparing with the bases at the same positions (not with the other tile's band)
 * keeps a patterned texture (mortar courses, plank seams) from reading as a tone shift.
 */
function toneOff(c, side, bands, cls) {
  const got = [0, 0, 0], want = [0, 0, 0];
  let n = 0;
  bands.forEach((L, d) => L.forEach((h, i) => {
    if (labelOf(h, cls) !== c) return;
    addLab(got, labOf(h)); addLab(want, refBand[c][side][d][i]); n++;
  }));
  if (n < 6) return 0;
  return de2000(got.map((v) => v / n), want.map((v) => v / n), 1);
}

/** compare tile a's side sa with tile b's opposite side; returns { bad: bool[16], shape, tone } */
function compare(a, sa, b, sb, cls) {
  const A0 = line(a, sa, 0), A1 = line(a, sa, 1), B0 = line(b, sb, 0), B1 = line(b, sb, 1);
  const la = A0.map((h) => labelOf(h, cls)), lb = B0.map((h) => labelOf(h, cls));
  const bad = new Array(T).fill(false);
  let shape = 0, tone = 0;
  const near = (l, i, other) => [i - 1, i, i + 1].some((j) => j >= 0 && j < T && compatible(l, other[j]));
  for (let i = 0; i < T; i++) if (!near(la[i], i, lb) || !near(lb[i], i, la)) { bad[i] = true; shape++; }
  // tone only along an edge of one class: on a two-class edge the lip/rim shading next to the boundary is part of the art
  if (cls[0] === cls[1]) for (const c of [cls[0]]) {
    if (!refBand[c]) continue;
    const ta = toneOff(c, sa, [A0, A1], cls), tb = toneOff(c, sb, [B0, B1], cls);
    if (ta > TONE || tb > TONE) for (let i = 0; i < T; i++) if ((la[i] === c || lb[i] === c) && !bad[i]) { bad[i] = true; tone++; }
  }
  return { bad, shape, tone, n: bad.filter(Boolean).length };
}

// ---- every adjacent pair ----
const key2 = (p) => p.join('|');
const bySide = (side) => { const m = new Map(); for (const g of groups) { const k = key2(sideCorners(g.corners, side)); (m.get(k) ?? m.set(k, []).get(k)).push(g); } return m; };
const results = [];
for (const [sa, sb, dir] of [['E', 'W', 'E'], ['S', 'N', 'S']]) {
  const right = bySide(sb);
  for (const A of groups) {
    const cls = sideCorners(A.corners, sa);
    for (const B of right.get(key2(cls)) ?? []) {
      if (A.id.startsWith('base:') && B.id.startsWith('base:') && A.id !== B.id) continue; // different classes never share an edge
      let worst = null, sum = 0, n = 0, bad = 0;
      A.vars.forEach((va, ia) => B.vars.forEach((vb, ib) => {
        const r = compare(va, sa, vb, sb, cls);
        sum += r.n; n++;
        if (r.n >= MIN) bad++;
        if (!worst || r.n > worst.n) worst = { ...r, ia, ib };
      }));
      results.push({ A, B, dir, cls, worst, mean: sum / n, combos: n, badCombos: bad });
    }
  }
}
const offenders = results.filter((r) => r.worst.n >= MIN).sort((p, q) => q.worst.n - p.worst.n || q.mean - p.mean || q.badCombos - p.badCombos);
const pct = (n) => `${Math.round((100 * n) / T)}%`;
const where = (r) => (r.A.set === r.B.set ? r.A.set : `${r.A.set} / ${r.B.set}`);
const mk = (g) => (g.id.startsWith('base:') ? `base ${g.id.slice(5)}` : `${g.mask}`);

// per set: offenders that involve it (a cross-set pair counts for both)
const perSet = new Map();
for (const r of offenders) for (const s of new Set([r.A.set, r.B.set])) perSet.set(s, (perSet.get(s) ?? 0) + 1);

// per tile: how many offending pairs each vertex tile takes part in (the tile to fix first)
const perTile = new Map();
for (const r of offenders) for (const g of new Set([r.A.id, r.B.id])) perTile.set(g, (perTile.get(g) ?? 0) + 1);

// ---- report ----
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
let md = `# Seam audit\n\n${now}. \`node e2e/seams.mjs\` on \`${path.relative(ROOT, SHEET).replace(/\\/g, '/')}.json\`: ${groups.length} vertex-tile groups ` +
  `(${M.sets.length} sets x 14 transition masks + ${Object.keys(M.bases ?? {}).length} base classes), ${results.length} adjacent pairs ` +
  `(${results.reduce((a, r) => a + r.combos, 0)} variant combinations).\n\n` +
  `**${offenders.length} offenders** (pairs whose worst variant combination has ${MIN}+ of ${T} edge pixels mismatched; ` +
  `${offenders.reduce((a, r) => a + r.badCombos, 0)} offending variant combinations).\n\n` +
  `How to read it: \`A | B\` is the left/upper tile and the right/lower tile; a number is a Wang corner mask of the set ` +
  `(NW 8, NE 4, SW 2, SE 1 = upper class), \`base x\` the base variants of class x (the game draws those for masks 0 and 15). ` +
  `Edge E = A's right column against B's left column; S = A's bottom row against B's top row. ` +
  `shape = pixels whose class (or rim) doesn't line up within 1 px; tone = pixels of a one-class edge whose 2-px band is more than ` +
  `dE00 ${TONE} off the class's base variants at the same positions. Worst = the worst variant combination (indices), mean = mean mismatched pixels over all combinations.\n\n` +
  `## Offenders per set\n\n| set | offending pairs |\n|---|---|\n` +
  [...perSet].sort((a, b) => b[1] - a[1]).map(([s, n]) => `| ${s} | ${n} |`).join('\n') +
  `\n\n## Offenders per tile (fix these first)\n\n| tile | offending pairs |\n|---|---|\n` +
  [...perTile].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([g, n]) => `| ${g} | ${n} |`).join('\n') +
  `\n\n## Ranked offenders\n\n| # | set | A | B | edge | edge classes | worst | shape | tone | worst variants | mean | bad combos |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n` +
  offenders.map((r, i) => `| ${i + 1} | ${where(r)} | ${mk(r.A)} | ${mk(r.B)} | ${r.dir} | ${r.cls.join(' → ')} | ${pct(r.worst.n)} | ${r.worst.shape} | ${r.worst.tone} | ${r.worst.ia}/${r.worst.ib} | ${r.mean.toFixed(1)} px | ${r.badCombos}/${r.combos} |`).join('\n') + '\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT + '.md', md);

// ---- contact image of the worst pairs ----
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  '-': '000000111000000', ':': '000010000010000', '|': '010010010010010', '%': '101001010100101', '.': '000000000000010', '/': '001001010100100', ' ': '000000000000000',
};
const K = 4, CELL_W = 2 * T * K + 16, CELL_H = 2 * T * K + 22, COLS = 4;
const shown = offenders.filter((r) => !ONLY || r.A.id.includes(ONLY) || r.B.id.includes(ONLY)).slice(0, TOP);
const img = blank(COLS * CELL_W, Math.max(1, Math.ceil(shown.length / COLS)) * CELL_H);
const fill = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data.set([...c, 255], (y * img.w + x) * 4); };
fill(0, 0, img.w, img.h, [46, 34, 47]);
const text = (s, x0, y0, c = [253, 203, 176]) => {
  [...s.toUpperCase()].forEach((ch, k) => {
    const g = FONT[ch] ?? FONT[' '];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '1') fill(x0 + k * 4 + x, y0 + y, 1, 1, c);
  });
};
const big = (t, x0, y0) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const p = (y * T + x) * 4; fill(x0 + x * K, y0 + y * K, K, K, [t.data[p], t.data[p + 1], t.data[p + 2]]); } };
shown.forEach((r, i) => {
  const ox = (i % COLS) * CELL_W + 4, oy = Math.floor(i / COLS) * CELL_H + 4;
  text(`${i + 1}. ${where(r)}`.slice(0, 32), ox, oy);
  text(`${mk(r.A)} | ${mk(r.B)} ${r.dir} ${pct(r.worst.n)}`.slice(0, 32), ox, oy + 7);
  const ty = oy + 16;
  const a = r.A.vars[r.worst.ia], b = r.B.vars[r.worst.ib];
  if (r.dir === 'E') {
    big(a, ox + 4, ty); big(b, ox + 4 + T * K, ty);
    r.worst.bad.forEach((bd, j) => bd && (fill(ox, ty + j * K, 3, K, [232, 59, 59]), fill(ox + 5 + 2 * T * K, ty + j * K, 3, K, [232, 59, 59])));
  } else {
    big(a, ox + 4, ty); big(b, ox + 4, ty + T * K);
    r.worst.bad.forEach((bd, j) => bd && (fill(ox + 4 + j * K, ty - 3, K, 2, [232, 59, 59]), fill(ox + 4 + j * K, ty + 2 * T * K + 1, K, 2, [232, 59, 59])));
    // the seam line, marked beside the pair
    fill(ox + 4 + T * K + 2, ty + T * K - 1, 3, 2, [232, 59, 59]);
  }
});
fs.writeFileSync(OUT + '.png', encodePNG(img.w, img.h, img.data));
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
console.log(`seams: ${offenders.length} offenders (of ${results.length} adjacent tile pairs; ${offenders.reduce((a, r) => a + r.badCombos, 0)} bad variant combinations) -> ${rel(OUT)}.md, ${rel(OUT)}.png`);
for (const [s, n] of [...perSet].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${s}: ${n}`);
process.exit(0);
