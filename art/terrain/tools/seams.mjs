// Seam fix for the Wang transition sets (2.0 Phase 6, the seam audit: e2e/seams.mjs). PixelLab draws every
// tile of a set on its own, so two tiles that sit side by side in the dual grid (they share the two corner
// classes of the edge between them) cross that edge at different places: the soil's rim starts at row 3 of
// one tile's right edge (soil-grass mask 4) and at row 6 of the next tile's left edge (mask 13). The audit
// calls that a shape mismatch (it started at 165 offenders, all of them this).
//
// For every set and every kind of two-class edge (vertical or horizontal, which class comes first) this
// reads where each tile crosses the edge: a = the first row that is not the first class, b = one past the
// last row that is not the second class, so [0, a) is the first class, [a, b) the rim between, [b, 16) the
// second. A kind of edge on which the audit finds an offending pair (MIN mismatched pixels, the audit's rule
// replicated here) gets the smallest change that clears it: every tile's crossing is moved the fewest
// pixels into a window two rows wide (a in A0..A0+1, b in B0..B0+1; two tiles in such a window differ by at
// most one row, which the audit accepts); the window that changes the fewest pixels wins, a window one row
// wide (every tile alike) is the fallback. A tile already inside the window is not touched, and a kind of
// edge without an offending pair is left as drawn (--strict lines every pair up completely instead).
// Moving a crossing redraws the tile's edge:
//   depth 0 (the edge line)  the pixels between the old and the new crossing change class;
//   depth 1..K-1             the rim moves by a share of the same shift that shrinks to zero by depth K,
//                            so the line bends into the tile instead of kinking at the edge.
// A pixel that has to change class takes the commonest color of that class within 3 px of it in the same
// tile (rim pixels: the commonest rim color), so only the pixels between the old and the new line change,
// no color is invented and a lone highlight (the foam line, a tuft tip) is not copied along. Pure edges (both
// corners one class) lose the rim pixels that poke onto them. Pixels both classes own (moss in the path,
// shared browns) never count: they match anything, as in the audit. Idempotent: a second run changes nothing.
//
// Usage: node art/terrain/tools/seams.mjs [set …] [--depth 4] [--min 2] [--strict] [--exact] [--check] [--dry] [--report]
//   (run from the repo root; build.sh runs it after the diagonal masks are rebuilt; no set = every set)
//   --check   only count the mismatched pixels per kind of edge, write nothing
//   --report  the crossing (a, b) of every tile edge and where the plan moves it
//   --strict  line every pair up completely (about twice the edits) instead of only below --min
//   --exact   every tile gets the same crossing (window one row wide)
// Reads art/terrain/bases/* (what each class's colors are), rewrites art/terrain/sets/<set>/tileset.png and
// keeps the tileset as it was in art/terrain/try/seams-before/<set>/ for tools/seams-diff.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from '../../../scripts/lib/png.mjs';
import { hex, rgbOf } from '../../../scripts/lib/pixel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(here, '..');
const S = 16;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const K = +opt('--depth', 4);
const MIN = +opt('--min', 2); // a pair with this many mismatched pixels is an offender (the audit's --min)
const STRICT = args.includes('--strict');
const EXACT = args.includes('--exact'), CHECK = args.includes('--check'), DRY = args.includes('--dry') || CHECK, REPORT = args.includes('--report') || CHECK;
const named = args.filter((a, i) => !a.startsWith('--') && !['--depth', '--min'].includes(args[i - 1]));

// ---- what each class owns ----
const owns = {};
for (const cls of fs.readdirSync(path.join(T, 'bases'))) {
  const dir = path.join(T, 'bases', cls);
  if (!fs.statSync(dir).isDirectory()) continue;
  const set = (owns[cls] = new Set());
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.png'))) {
    const img = decodePNG(fs.readFileSync(path.join(dir, f)));
    for (let i = 0; i < img.data.length; i += 4) set.add(hex(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
}
/** a color along an edge whose corner classes are [c0, c1]: P (the first class's), Q (the second's), * (both own it), x (neither: the rim) */
function labelOf(h, [c0, c1]) {
  const a = owns[c0]?.has(h), b = owns[c1]?.has(h);
  if (c0 === c1) return a ? 'P' : 'x';
  if (a && b) return '*';
  return a ? 'P' : b ? 'Q' : 'x';
}
const compat = (label, want) => label === want || label === '*';
/** the audit's rule (e2e/seams.mjs compare): a pixel mismatches when no pixel within one row across the seam has a compatible label */
function mismatches(la, lb) {
  let n = 0;
  const near = (l, i, other) => [i - 1, i, i + 1].some((j) => j >= 0 && j < S && (l === '*' || other[j] === '*' || l === other[j]));
  for (let i = 0; i < S; i++) if (!near(la[i], i, lb) || !near(lb[i], i, la)) n++;
  return n;
}

// ---- sets ----
const setNames = named.length ? named : fs.readdirSync(path.join(T, 'sets')).sort();
function loadSet(name) {
  const [lower, upper] = name.split('-');
  const dir = path.join(T, 'sets', name);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json'), 'utf8'));
  const img = decodePNG(fs.readFileSync(path.join(dir, 'tileset.png')));
  const tiles = {};
  for (const t of meta.tileset_data.tiles) {
    const c = t.corners;
    const mask = (c.NW === 'upper' ? 8 : 0) | (c.NE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 1 : 0);
    const b = t.bounding_box;
    const px = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const p = ((b.y + y) * img.w + b.x + x) * 4; px.push(hex(img.data[p], img.data[p + 1], img.data[p + 2])); }
    tiles[mask] = { mask, bb: b, px, orig: px.slice(), corners: [8, 4, 2, 1].map((bit) => (mask & bit ? upper : lower)) };
  }
  return { name, lower, upper, dir, img, tiles };
}

// ---- edge geometry: depth d from the edge line, i along it (top to bottom on E/W, left to right on N/S) ----
const AT = { E: (d, i) => [S - 1 - d, i], W: (d, i) => [d, i], S: (d, i) => [i, S - 1 - d], N: (d, i) => [i, d] };
const sideClasses = (c, side) => (side === 'E' ? [c[1], c[3]] : side === 'W' ? [c[0], c[2]] : side === 'S' ? [c[2], c[3]] : [c[0], c[1]]);
const orientOf = (side) => (side === 'E' || side === 'W' ? 'V' : 'H');
const SIDES = ['N', 'E', 'S', 'W'];
const FAR = { V: 'E', H: 'S' }; // the side of the left / upper tile of a pair; the other tile meets it with W / N
const column = (tile, side, pair, d) => Array.from({ length: S }, (_, i) => { const [x, y] = AT[side](d, i); return labelOf(tile.px[y * S + x], pair); });

/** a: first row that is not the first class (nor a wildcard); b: one past the last row that is not the second class; ok when a <= b */
function profile(L) {
  let a = L.findIndex((l) => l === 'Q' || l === 'x');
  if (a < 0) a = S;
  let b = 0;
  for (let i = S - 1; i >= 0; i--) if (L[i] === 'P' || L[i] === 'x') { b = i + 1; break; }
  return { a, b, ok: a <= b };
}
/** which rows between the old and the new crossing change, and to what */
function sweep(L, p, a2, b2) {
  const out = [];
  for (let i = 0; i < S; i++) {
    const swept = (i >= Math.min(p.a, a2) && i < Math.max(p.a, a2)) || (i >= Math.min(p.b, b2) && i < Math.max(p.b, b2));
    if (!swept) continue;
    const want = i < a2 ? 'P' : i >= b2 ? 'Q' : 'x';
    if (!compat(L[i], want)) out.push([i, want]);
  }
  return out;
}
const apply = (L, list) => { const o = L.slice(); for (const [i, want] of list) o[i] = want; return o; };

// ---- colors for a pixel that changes class: the nearest pixel of the wanted label (not itself changing) ----
const rimOf = new Map();
function rimColor(set) {
  if (rimOf.has(set.name)) return rimOf.get(set.name);
  const n = new Map();
  for (const t of Object.values(set.tiles)) for (const h of t.orig) if (!owns[set.lower]?.has(h) && !owns[set.upper]?.has(h)) n.set(h, (n.get(h) ?? 0) + 1);
  const best = [...n].sort((p, q) => q[1] - p[1])[0]?.[0] ?? null;
  rimOf.set(set.name, best);
  return best;
}
/**
 * Repaint [x, y, label] pixels of a tile in place; returns how many changed. A pixel takes the commonest color
 * of the wanted class within 3 px (the nearest one breaks a tie), so a lone highlight or the foam line next to
 * the rim is not copied along; with none that near it takes the nearest pixel of the class.
 */
function paint(set, tile, pair, todo) {
  if (!todo.length) return 0;
  const changed = new Set(todo.map(([x, y]) => y * S + x));
  const lab = tile.px.map((h) => labelOf(h, pair));
  const out = tile.px.slice();
  let n = 0;
  for (const [x, y, want] of todo) {
    let nearest = -1, nd = Infinity;
    const votes = new Map();
    for (let q = 0; q < S * S; q++) {
      if (changed.has(q) || lab[q] !== want) continue;
      const d2 = ((q % S) - x) ** 2 + (((q / S) | 0) - y) ** 2;
      if (d2 < nd) { nd = d2; nearest = q; }
      if (d2 <= 10) { const v = votes.get(tile.px[q]) ?? { n: 0, d: Infinity }; v.n++; v.d = Math.min(v.d, d2); votes.set(tile.px[q], v); }
    }
    const top = [...votes].sort((p, q) => q[1].n - p[1].n || p[1].d - q[1].d)[0];
    const c = top ? top[0] : nearest >= 0 ? tile.px[nearest] : want === 'x' ? rimColor(set) : null;
    if (c && c !== out[y * S + x]) { out[y * S + x] = c; n++; }
  }
  tile.px = out;
  return n;
}

// ---- the edge groups of a set ----
function groupsOf(set) {
  const groups = new Map();
  for (const t of Object.values(set.tiles)) {
    if (t.mask === 0 || t.mask === 15) continue;
    for (const side of SIDES) {
      const pair = sideClasses(t.corners, side);
      if (pair[0] === pair[1]) continue;
      const key = `${orientOf(side)} ${pair[0]}>${pair[1]}`;
      if (!groups.has(key)) groups.set(key, { key, orient: orientOf(side), pair, edges: [] });
      const L = column(t, side, pair, 0);
      groups.get(key).edges.push({ tile: t, side, pair, L, p: profile(L), far: side === FAR[orientOf(side)] });
    }
  }
  return groups;
}
/** every pair that sits side by side across this kind of edge: a far-side edge (E / S) of one tile, a near-side edge (W / N) of another */
function pairMismatches(edges, Ls = edges.map((e) => e.L)) {
  let total = 0, worst = 0, pairs = 0, offenders = 0;
  edges.forEach((a, i) => { if (!a.far) return; edges.forEach((b, j) => { if (b.far) return; const m = mismatches(Ls[i], Ls[j]); total += m; worst = Math.max(worst, m); pairs++; if (m >= MIN) offenders++; }); });
  return { total, worst, pairs, offenders };
}
/**
 * The window (a in A0..A0+w, b in B0..B0+w) that lines the group up with the fewest changed pixels; returns the
 * target [a, b] of every edge. A group none of whose pairs is an offender is left as drawn (--strict: every
 * pair must line up completely).
 */
function plan(group) {
  const target = new Map(group.edges.map((e) => [e, [e.p.a, e.p.b]]));
  const state = pairMismatches(group.edges);
  const bad = (m) => (STRICT ? m.total : m.offenders);
  if (!group.edges.some((e) => e.p.ok) || !bad(state)) return { target, cost: 0, edits: 0, left: state.total, window: null };
  const to = (e, A0, B0, w) => { const a2 = Math.min(A0 + w, Math.max(A0, e.p.a)); return [a2, Math.max(a2, Math.min(B0 + w, Math.max(B0, e.p.b)))]; };
  let best = null;
  for (const w of EXACT ? [0] : [1, 0]) {
    for (let A0 = 0; A0 + w <= S; A0++) for (let B0 = A0; B0 + w <= S; B0++) {
      let edits = 0, cost = 0;
      const Ls = group.edges.map((e) => {
        if (!e.p.ok) return e.L;
        const [a2, b2] = to(e, A0, B0, w), list = sweep(e.L, e.p, a2, b2);
        edits += list.length; cost += Math.abs(a2 - e.p.a) + Math.abs(b2 - e.p.b);
        return apply(e.L, list);
      });
      const m = pairMismatches(group.edges, Ls);
      const cand = { bad: bad(m), left: m.total, edits, cost, w, A0, B0 };
      // no offender first, then the fewest changed pixels, the shortest moves, the fewest leftover mismatches, the narrowest window
      const better = !best || cand.bad < best.bad || (cand.bad === best.bad && (cand.edits < best.edits || (cand.edits === best.edits && (cand.cost < best.cost || (cand.cost === best.cost && (cand.left < best.left || (cand.left === best.left && cand.w < best.w)))))));
      if (better) best = cand;
    }
    if (best && best.bad === 0) break; // a two-row window that lines everything up is enough
  }
  for (const e of group.edges) if (e.p.ok) target.set(e, to(e, best.A0, best.B0, best.w));
  return { target, cost: best.cost, edits: best.edits, left: best.left, window: best };
}

// ---- run ----
const sets = setNames.map(loadSet);
const report = [];
let totalChanged = 0, totalTiles = 0, residual = 0;
for (const set of sets) {
  const before = groupsOf(set);
  for (const g of before.values()) {
    const m = pairMismatches(g.edges);
    if (CHECK) report.push(`${set.name} ${g.key}: ${g.edges.map((e) => `${e.tile.mask}${e.side}(${e.p.a},${e.p.b})`).join(' ')} | ${m.pairs} pairs, ${m.offenders} offenders, ${m.total} mismatched pixels, worst ${m.worst}`);
  }
  if (!CHECK) {
    // 1. a plan per kind of edge, from the tiles as drawn
    const plans = new Map([...before].map(([k, g]) => [k, plan(g)]));
    for (const [k, g] of before) {
      const pl = plans.get(k);
      report.push(`${set.name} ${k}: ${g.edges.map((e) => `${e.tile.mask}${e.side}(${e.p.a},${e.p.b})${pl.target.get(e).join(',') === `${e.p.a},${e.p.b}` ? '' : `>(${pl.target.get(e).join(',')})`}`).join(' ')} | window ${pl.window ? `a ${pl.window.A0}..${pl.window.A0 + pl.window.w} b ${pl.window.B0}..${pl.window.B0 + pl.window.w}` : 'none needed'}, moves ${pl.cost}, edits ${pl.edits}, mismatched ${pl.left}`);
    }
    // 2. redraw each tile's edges
    for (const t of Object.values(set.tiles)) {
      if (t.mask === 0 || t.mask === 15) continue;
      for (const side of SIDES) {
        const pair = sideClasses(t.corners, side);
        if (pair[0] === pair[1]) {
          // a pure edge: no rim pixel on the line
          const L0 = column(t, side, pair, 0);
          paint(set, t, pair, L0.flatMap((l, i) => (l === 'x' ? [[...AT[side](0, i), 'P']] : [])));
          continue;
        }
        const g = before.get(`${orientOf(side)} ${pair[0]}>${pair[1]}`);
        const e = g.edges.find((q) => q.tile === t && q.side === side);
        const [a2, b2] = plans.get(g.key).target.get(e);
        const sa = a2 - e.p.a, sb = b2 - e.p.b;
        if (!e.p.ok || (!sa && !sb)) continue;
        const L = Array.from({ length: K }, (_, d) => column(t, side, pair, d));
        const P = L.map(profile);
        const todo = sweep(L[0], P[0], a2, b2).map(([i, want]) => [...AT[side](0, i), want]);
        let prev = (P[0].a + P[0].b) / 2;
        for (let d = 1; d < K; d++) {
          const pd = P[d];
          // the line stops bending where the column no longer has the crossing (the arc has turned away)
          if (!pd.ok || pd.a >= S || pd.b <= 0 || Math.abs((pd.a + pd.b) / 2 - prev) > 4) break;
          prev = (pd.a + pd.b) / 2;
          const w = (K - d) / K;
          const bd = Math.max(0, Math.min(S, Math.round(pd.b + sb * w)));
          const ad = Math.max(0, Math.min(bd, Math.round(pd.a + sa * w)));
          for (const [i, want] of sweep(L[d], pd, ad, bd)) todo.push([...AT[side](d, i), want]);
        }
        paint(set, t, pair, todo);
      }
    }
    // 3. the later edges can disturb the earlier ones at the corners: a pure edge stays clean
    for (const t of Object.values(set.tiles)) {
      if (t.mask === 0 || t.mask === 15) continue;
      for (const side of SIDES) {
        const pair = sideClasses(t.corners, side);
        if (pair[0] !== pair[1]) continue;
        const L0 = column(t, side, pair, 0);
        paint(set, t, pair, L0.flatMap((l, i) => (l === 'x' ? [[...AT[side](0, i), 'P']] : [])));
      }
    }
  }
  // 4. what is left, by the audit's rule
  let left = 0, offenders = 0;
  for (const g of groupsOf(set).values()) { const m = pairMismatches(g.edges); left += m.total; offenders += m.offenders; }
  residual += left;
  // 5. count and write
  let changed = 0, tiles = 0;
  for (const t of Object.values(set.tiles)) { const n = t.px.filter((h, i) => h !== t.orig[i]).length; if (n) tiles++; changed += n; }
  totalChanged += changed; totalTiles += tiles;
  console.log(`seams: ${set.name}: ${CHECK ? '' : `${changed} pixels in ${tiles} tiles, `}${offenders} offending pairs, ${left} mismatched edge pixels over all pairs`);
  if (changed && !DRY) {
    const keep = path.join(T, 'try', 'seams-before', set.name);
    fs.mkdirSync(keep, { recursive: true });
    for (const f of ['tileset.png', 'tileset.json']) fs.copyFileSync(path.join(set.dir, f), path.join(keep, f));
    for (const t of Object.values(set.tiles)) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set.img.data.set([...rgbOf(t.px[y * S + x]), 255], ((t.bb.y + y) * set.img.w + t.bb.x + x) * 4);
    }
    fs.writeFileSync(path.join(set.dir, 'tileset.png'), encodePNG(set.img.w, set.img.h, set.img.data));
  }
}
if (REPORT) console.log(report.join('\n'));
console.log(`seams: ${totalChanged} pixels in ${totalTiles} tiles over ${sets.length} sets${DRY ? ' (nothing written)' : ''}; ${residual} mismatched edge pixels left`);
