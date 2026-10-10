// Fences that connect (the owner's 2.0 playtest: "the fences aren't rotated where they need to be").
// Every fence used to be one east-west sprite, so a north-south run showed sideways rails. This draws
// a piece for each way a fence can meet its neighbours, by rule and by hand, from the art the game
// already had (the same palette, plum outline and light from the upper left):
//   fence:wood:<mask>    the Wood Fence (st:fence_wood): a post with two rails to each side that joins
//   fence:stone:<mask>   the Stone Wall (st:fence_stone): a low mossy wall, its top running on
//   fence:gate:h         the Garden Gate (st:gate) across an east-west run, as before
//   fence:gate:v<n><s>   the gate in a north-south run: its leaf hangs between what stands north of
//                        it (n 1: a fence's post or a wall's end; n 0: a hinge post of its own) and
//                        its own post, which a wood run going on south covers below its face (s 1)
//   fence:map:<mask>:<v>:<season>   the ranch paddock's fence (the map's O.FENCE), v 0 plain or
//                        1 weathered, winter (3) with snow; baked flat into the ground, so 16x16
// mask = N 1 | E 2 | S 4 | W 8, the sides with a fence of the same family; a gate joins a wood fence
// along the way it hangs, a stone wall only east-west (src/render/fences.ts says who joins whom).
//
// Top-down 3/4 view, as the house and furniture are: a run going north-south shows each post's cap
// and upper face and, below it, the rails (or the wall's top) running on to the next post, the way
// they cover the post from the front; the run's south end shows its whole post (or the wall's face).
// The rails between two posts belong to the southern one, so a north-south piece reaches 12 px above
// its tile (frame 16x30, origin (0, 14)); the renderer y-sorts each piece at its tile, so the player
// still walks behind and in front of a fence exactly as before. The east-west pieces are the old
// sprites' pixels (fence:wood:10 is st:fence_wood, fence:stone:10 is st:fence_stone, an east-west
// gate is st:gate). The paddock fence's posts are short enough to show whole in a north-south run,
// with its rails between them (see mapFence).
//
//   node art/fences/build.mjs   then   node scripts/sprites-import.mjs art/fences/sprites.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, upscale } from '../../scripts/lib/png.mjs';
import { rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- palette (STYLE.md: wood, brass, stone, foliage, snow) ----
const O = '#2e222f', L = '#e6904e', B = '#cd683d', Dk = '#9e4539', K = '#7a3045', K2 = '#45293f';
const G = '#f9c22b', G2 = '#f79617';
const S9 = '#c7dcd0', Sb = '#ab947a', Sc = '#966c6c', Sd = '#625565', M1 = '#1ebc73', M2 = '#91db69', Ma = '#239063';
const SNOW = '#ffffff', SNOW2 = '#c7dcd0';

/** a frame w x h whose tile row 0 is frame row oy */
const frame = (w, h, oy) => ({ w, h, oy, px: new Array(w * h).fill(null) });
const put = (f, x, tr, c) => { const y = tr + f.oy; if (x >= 0 && x < f.w && y >= 0 && y < f.h) f.px[y * f.w + x] = c; };
const get = (f, x, tr) => { const y = tr + f.oy; return x >= 0 && x < f.w && y >= 0 && y < f.h ? f.px[y * f.w + x] : null; };
/** paint rows of a char grid (first row = tile row tr0) with a legend; '.' leaves the pixel alone */
function paint(f, rows, tr0, legend, cols = null) {
  rows.forEach((row, j) => [...row].forEach((ch, x) => {
    if (ch === '.' || (cols && !cols.includes(x))) return;
    put(f, x, tr0 + j, legend[ch]);
  }));
}
const N = 1, E = 2, S = 4, W = 8;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ============================================================ the Wood Fence
// st:fence_wood (16x18, origin (0, 2)): tile rows -2..15
const WOOD = [
  '.......010......', '......02130.....', '......02130.....', '......02130.....', '......02130.....',
  '0000000214000000', '1111211253121111', '3343333213333433', '0000000213000000', '......02330.....',
  '......02140.....', '0000000213000000', '1111211253121111', '3343333213333433', '0000000213000000',
  '......02140.....', '......02130.....', '.......000......'];
const WL = { '0': O, '1': B, '2': L, '3': Dk, '4': K, '5': G };
const RAIL_ROWS = [3, 4, 5, 6, 9, 10, 11, 12];
/** the post's face on a row with no rail through it */
const POST_ROW = (tr) => (tr === 7 ? [O, L, Dk, Dk, O] : tr === 8 || tr === 13 ? [O, L, B, K, O] : [O, L, B, Dk, O]);
/** a north-south run's rails between the post north of this tile and this tile's post (tile rows -12..-3) */
function railBand(f) {
  for (let tr = -12; tr <= -3; tr++) {
    const c = tr === -12 ? K : tr <= -8 ? L : tr === -5 ? K : B;
    put(f, 7, tr, O); put(f, 8, tr, c); put(f, 9, tr, O);
  }
}
function wood(mask) {
  const f = frame(16, 30, 14);
  const n = mask & N, e = mask & E, s = mask & S, w = mask & W;
  if (n) railBand(f);
  // rails to the sides (rows 3-6 and 9-12 of the old sprite), behind the post
  if (w) paint(f, WOOD.slice(5, 15), 3, WL, range(0, 6));
  if (e) paint(f, WOOD.slice(5, 15), 3, WL, range(10, 15));
  for (const tr of [7, 8]) { put(f, 6, tr, null); put(f, 10, tr, null); }
  // the post: whole, or (with the rails of a north-south run in front of it) its cap and upper face
  const bottom = s ? 3 : 15;
  for (let tr = -2; tr <= bottom; tr++) {
    const src = WOOD[tr + 2];
    for (let x = 6; x <= 10; x++) {
      let ch = src[x];
      const railRow = RAIL_ROWS.includes(tr);
      if (tr >= 0 && tr < 15 && !railRow) ch = '.';
      if (railRow) {
        // the outline columns show the rail where one passes, the post's outline where none does
        if (x === 6 && !w) ch = '0';
        if (x === 10 && !e) ch = '0';
        // the brass bolt only where a rail is nailed on
        if (x === 8 && ch === '5' && !(w || e)) ch = '1';
      }
      if (ch !== '.') put(f, x, tr, WL[ch]);
      else if (tr >= 0 && tr < 15) put(f, x, tr, POST_ROW(tr)[x - 6]);
    }
  }
  if (s) { put(f, 7, 3, L); put(f, 8, 3, B); put(f, 9, 3, Dk); if (!w) put(f, 6, 3, O); if (!e) put(f, 10, 3, O); }
  return f;
}

// ============================================================ the Stone Wall
// st:fence_stone (16x16, origin (0, 0)): tile rows 3..15
const STONE = [
  '..0........0....', '0070000000080000', '99a7999999a7a999', 'bbbcbbbbcbbbbcbb', 'dddddddddddddddd',
  '9bbbd9abbbd9bbbb', 'ccccdcccccdccccc', 'cccddccccddccccd', 'dddddddddddddddd', '9d9bbbbd9bbbbdab',
  'cdcccccdcccccdcc', 'ddccccddccccddcd', 'dddddddddddddddd'];
const SL = { '0': O, '7': M1, '8': M2, '9': S9, 'a': Ma, 'b': Sb, 'c': Sc, 'd': Sd };
// the wall's core (x 4-11) stands in every wall tile; the sides reach the tile's edges where it joins
const CORE = range(4, 11), WEST = range(0, 3), EAST = range(12, 15);
/** the top of a north-south wall seen from above, 6 px wide (x 5-10), one tile's worth (16 rows) */
const STRIP = [
  '9999bc', '9bbbbc', 'cccccd', 'ddd9dd', '9bbcb9', '9bbcbc', 'ccdccc', 'dddddd',
  '99b999', '9bbabc', 'bcbbbc', 'ddddcd', '9b9999', '9bbbbc', 'cccccd', 'dddddd'];
const STRIP_MOSS = { 1: [[3, M1]], 9: [[3, M1], [4, Ma]], 12: [[1, M2]] };
function stoneTop(f, tr0, tr1) {
  for (let tr = tr0; tr <= tr1; tr++) {
    const row = STRIP[((tr % 16) + 16) % 16];
    [...row].forEach((ch, i) => put(f, 5 + i, tr, SL[ch]));
    for (const [i, c] of STRIP_MOSS[((tr % 16) + 16) % 16] ?? []) put(f, 5 + i, tr, c);
    put(f, 4, tr, O); put(f, 11, tr, O);
  }
}
function stone(mask) {
  const f = frame(16, 30, 14);
  const n = mask & N, e = mask & E, s = mask & S, w = mask & W;
  // the wall along the tile's south edge: the core, and the sides that join
  const cols = [...CORE, ...(w ? WEST : []), ...(e ? EAST : [])];
  paint(f, STONE, 3, SL, cols);
  // ends: the plum line down the end, the top's corner rounded off
  if (!w) { for (let tr = 4; tr <= 15; tr++) put(f, 4, tr, O); put(f, 4, 4, null); put(f, 5, 4, O); put(f, 4, 3, null); put(f, 5, 5, get(f, 5, 5) === M1 ? M1 : S9); }
  if (!e) { for (let tr = 4; tr <= 15; tr++) put(f, 11, tr, O); put(f, 11, 4, null); put(f, 10, 4, O); put(f, 11, 3, null); }
  // a tuft of moss on the core of a lone pillar or an end
  if (!w && !e && !n) { put(f, 7, 3, O); put(f, 7, 4, M1); put(f, 8, 4, M2); put(f, 8, 3, O); }
  // north-south: the wall's top runs on from the tile north of this one down to this tile's top
  if (n) {
    stoneTop(f, -9, 6);
    // joining the east-west top of this tile: no edge between them
    if (w) { put(f, 4, 5, S9); put(f, 4, 6, Sb); put(f, 4, 4, O); }
    if (e) { put(f, 11, 5, S9); put(f, 11, 6, Sc); put(f, 11, 4, O); }
  }
  // the core's face below its top is covered by the wall running south (drawn by the next tile)
  if (s) for (let tr = 7; tr <= 15; tr++) for (const x of range(5, 10)) put(f, x, tr, null);
  if (s) for (let tr = 7; tr <= 15; tr++) { if (!w) put(f, 4, tr, null); if (!e) put(f, 11, tr, null); }
  if (s && !n) {
    // the north end of a north-south wall: its top edge rounded, a tuft of moss
    stoneTop(f, 4, 6);
    for (const x of range(5, 10)) put(f, x, 3, O);
    put(f, 4, 3, null); put(f, 11, 3, null); put(f, 4, 4, w ? O : null); put(f, 11, 4, e ? O : null);
    if (!w) put(f, 5, 4, O);
    if (!e) put(f, 10, 4, O);
    put(f, 7, 2, O); put(f, 7, 3, M1); put(f, 8, 3, M2); put(f, 8, 2, O);
  }
  return f;
}

// ============================================================ the Garden Gate
// st:gate (16x18, origin (0, 2)): an east-west gate between its two posts
const GATE = [
  '000..........000', '1110........0111', '21300.0.0.0.0213', '2130202020200213', '2130131313130213',
  '2130131313130213', '2145222222222214', '2133333333333213', '2130131313440213', '2130131344135213',
  '2130134413136213', '2130441313130213', '2145222222222214', '2133333333333213', '2130131313130213',
  '2130131313130213', '2130000000000213', '000..........000'];
const GL = { '0': O, '1': B, '2': L, '3': Dk, '4': K, '5': G, '6': G2 };
/** a gate across an east-west run: st:gate's pixels */
function gateH() {
  const f = frame(16, 30, 14);
  paint(f, GATE, -2, GL);
  return f;
}
/**
 * a gate in a north-south run: its leaf seen from above (the slats' tops, ribbed, wider than the
 * rails, brass hinges at its north end and the latch at its south end), hung from what stands north of
 * it (n) or from a hinge post of its own; then its own post, cut below its face when a wood run goes
 * on south (s), whose rails cover it
 */
function gateV(n, s) {
  const f = frame(16, 30, 14);
  const top = n ? -12 : -11;
  for (let tr = top; tr <= -3; tr++) {
    const row = tr === top ? [O, K, K, K, O] : tr === -3 ? [O, Dk, Dk, K, O] : (tr - top) % 2 ? [O, L, B, Dk, O] : [O, B, Dk, K, O];
    row.forEach((c, i) => put(f, 6 + i, tr, c));
  }
  for (const tr of [top + 1, top + 4]) { put(f, 5, tr, O); put(f, 6, tr, G); }
  for (const tr of [-6, -5]) { put(f, 11, tr, O); put(f, 10, tr, tr === -6 ? G : G2); }
  if (!n) {
    // a hinge post of its own: cap and a sliver of face above the leaf
    paint(f, ['.......010......', '......02130.....'], -14, WL);
    [O, L, B, Dk, O].forEach((c, i) => put(f, 6 + i, -12, c));
  }
  const bottom = s ? 3 : 15;
  for (let tr = -2; tr <= bottom; tr++) {
    const src = WOOD[tr + 2];
    for (let x = 6; x <= 10; x++) {
      if (tr >= 0 && tr < 15) put(f, x, tr, POST_ROW(tr)[x - 6]);
      else if (src[x] !== '.') put(f, x, tr, WL[src[x]]);
    }
  }
  // the latch's keeper on its post
  put(f, 10, 1, G2);
  return f;
}

// ============================================================ the paddock fence (map O.FENCE)
// thin rustic posts and rails (o:14:*), baked flat into the ground: every piece stays inside its tile.
// Its posts are short (rows 2-13), so a north-south run shows each whole post, as the east-west sides
// do, and the rails between them from one post's foot to the next one's cap (rows 14-15 and 0-1): their
// lit tops, narrower than the posts, a shadow beside them. (The Wood Fence's posts are taller than a
// tile, so there the rails cover the lower posts instead.)
function mapFence(mask, v, winter) {
  const f = frame(16, 16, 0);
  const n = mask & N, e = mask & E, s = mask & S, w = mask & W;
  const RL = [L, L, L, Dk, Dk, B, L, L, Dk, L, L, Dk, Dk, B, L, L]; // the rails' grain along x
  const RL2 = [B, B, Dk, B, B, B, Dk, Dk, B, B, B, B, Dk, Dk, B, B];
  const rail = (xs) => {
    for (const x of xs) {
      put(f, x, 5, O); put(f, x, 6, RL[x]); put(f, x, 7, O);
      put(f, x, 9, O); put(f, x, 10, RL2[x]); put(f, x, 11, O);
    }
  };
  if (w) rail(range(0, 7));
  if (e) rail(range(9, 15));
  // the rails of a north-south run, between this post and the next one north (n) or south (s)
  if (n) { put(f, 8, 0, L); put(f, 9, 0, K2); put(f, 8, 1, B); put(f, 9, 1, K2); }
  if (s) { put(f, 8, 14, L); put(f, 9, 14, K2); put(f, 8, 15, L); put(f, 9, 15, K2); }
  // the post (x 7-9): cap at row 2, face to row 12, plum foot at 13
  put(f, 8, 2, O);
  for (let tr = 3; tr <= 12; tr++) {
    const core = tr === 4 ? L : tr === 11 ? Dk : B;
    const railRow = tr >= 5 && tr <= 7 || tr >= 9 && tr <= 11;
    put(f, 7, tr, railRow && w ? K2 : O); put(f, 8, tr, core); put(f, 9, tr, railRow && e ? K2 : O);
  }
  for (const x of [7, 8, 9]) put(f, x, 13, O);
  if (v === 1) {
    // weathered: an old darker stretch of rail, a crack down the post
    const xs = e ? [11, 12, 13] : w ? [2, 3, 4] : [];
    for (const x of xs) { put(f, x, 6, x === xs[1] ? K : Dk); put(f, x, 10, K); }
    put(f, 8, 8, K); put(f, 8, 9, Dk);
  }
  if (winter) {
    // snow on the cap and along the rails' tops
    put(f, 8, 2, SNOW2); put(f, 8, 3, SNOW);
    for (const x of [...(w ? [1, 2, 5] : []), ...(e ? [10, 13, 14] : [])]) if (get(f, x, 5)) put(f, x, 5, x % 3 ? SNOW2 : SNOW);
    if (s) { put(f, 8, 14, SNOW); put(f, 8, 15, SNOW2); }
    if (n) put(f, 8, 0, SNOW2);
  }
  return f;
}

// ============================================================ write
const entries = [];
function save(name, f, file, origin) {
  const data = new Uint8Array(f.w * f.h * 4);
  f.px.forEach((c, i) => { if (c) data.set([...rgbOf(c), 255], i * 4); });
  fs.writeFileSync(path.join(OUT, file), encodePNG(f.w, f.h, data));
  entries.push({ match: name, file: `frames/${file}`, frame: [f.w, f.h], origin });
}
const pieces = { wood: [], stone: [], gate: {}, map: {} };
for (let m = 0; m < 16; m++) {
  pieces.wood[m] = wood(m); save(`fence:wood:${m}`, pieces.wood[m], `wood-${m}.png`, [0, 14]);
  pieces.stone[m] = stone(m); save(`fence:stone:${m}`, pieces.stone[m], `stone-${m}.png`, [0, 14]);
}
pieces.gate.h = gateH(); save('fence:gate:h', pieces.gate.h, 'gate-h.png', [0, 14]);
for (const n of [0, 1]) for (const sc of [0, 1]) { const k = `v${n}${sc}`; pieces.gate[k] = gateV(n, sc); save(`fence:gate:${k}`, pieces.gate[k], `gate-${k}.png`, [0, 14]); }
// the map fence: winter first (the sheet's first match wins), then every other season
for (let m = 0; m < 16; m++) for (const v of [0, 1]) {
  const sw = mapFence(m, v, true), ss = mapFence(m, v, false);
  pieces.map[`${m}:${v}:3`] = sw; pieces.map[`${m}:${v}:0`] = ss;
  save(`fence:map:${m}:${v}:3`, sw, `map-${m}-${v}-winter.png`, [0, 0]);
  save(`fence:map:${m}:${v}:*`, ss, `map-${m}-${v}.png`, [0, 0]);
}
const recipe = {
  name: 'fences', kind: 'sprites',
  meta: { note: 'Fences that connect: art/fences/build.mjs (fence:<wood|stone>:<mask>, fence:gate:<h|v<n><s>>, fence:map:<mask>:<v>:<season>; mask N1 E2 S4 W8; src/render/fences.ts picks them). The east-west pieces are the st:fence_wood / st:fence_stone / st:gate pixels.' },
  defaults: { place: 'none', keepStrays: true },
  sprites: entries,
};
fs.writeFileSync(path.join(HERE, 'sprites.json'), JSON.stringify(recipe, null, 1) + '\n');

// ---- the old sprites, pixel for pixel: the east-west pieces must equal them ----
{
  const same = (f, rows, tr0, legend) => rows.every((row, j) => [...row].every((ch, x) => (ch === '.' ? !get(f, x, tr0 + j) : get(f, x, tr0 + j) === legend[ch])));
  const problems = [];
  if (!same(pieces.wood[E | W], WOOD, -2, WL)) problems.push('fence:wood:10 differs from st:fence_wood');
  if (!same(pieces.stone[E | W], STONE, 3, SL)) problems.push('fence:stone:10 differs from st:fence_stone');
  if (!same(pieces.gate.h, GATE, -2, GL)) problems.push('fence:gate:h differs from st:gate');
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) process.exit(1);
}

// ---- preview: a test layout per family, y-sorted the way the renderer draws them ----
function layoutPreview(file, cells, pick, scale = 3) {
  const h = cells.length, w = cells[0].length;
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? cells[y][x] : '.');
  const img = { w: w * 16, h: h * 16, data: new Uint8Array(w * 16 * h * 16 * 4) };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) img.data.set(((x >> 4) + (y >> 4)) % 2 ? [35, 144, 99, 255] : [32, 134, 92, 255], (y * img.w + x) * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y);
    if (c === '.') continue;
    // the renderer's rules (src/render/fences.ts)
    const fam = (q) => (q === '.' ? null : q);
    const DXY = [[0, -1], [1, 0], [0, 1], [-1, 0]], BIT = [N, E, S, W];
    const isGate = (q) => q === 'g';
    const gateVert = (gx, gy) => { const any = DXY.map(([dx, dy]) => !!fam(at(gx + dx, gy + dy))); return (any[0] || any[2]) && !(any[1] || any[3]); };
    let mask = 0, name;
    if (isGate(c)) {
      const nb = DXY.map(([dx, dy]) => fam(at(x + dx, y + dy)));
      if (!gateVert(x, y)) name = 'h';
      else name = `v${nb[0] ? 1 : 0}${nb[2] === 'w' || nb[2] === 'g' ? 1 : 0}`;
    } else DXY.forEach(([dx, dy], d) => {
      const q = fam(at(x + dx, y + dy));
      if (!q) return;
      const ns = d === 0 || d === 2;
      if (q === c || (isGate(q) && c !== 'm' && (c === 'w' ? ns === gateVert(x + dx, y + dy) : !ns && !gateVert(x + dx, y + dy)))) mask |= BIT[d];
    });
    const f = pick(c, isGate(c) ? name : mask, x, y);
    for (let fy = 0; fy < f.h; fy++) for (let fx = 0; fx < f.w; fx++) {
      const col = f.px[fy * f.w + fx];
      if (!col) continue;
      const px = x * 16 + fx, py = y * 16 + fy - f.oy;
      if (py < 0 || py >= img.h) continue;
      img.data.set([...rgbOf(col), 255], (py * img.w + px) * 4);
    }
  }
  const u = upscale(img, scale);
  const dir = path.join(HERE, '..', '..', 'e2e', 'out', 'art');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), encodePNG(u.w, u.h, u.data));
}
const LAYOUT = [
  '..............................',
  '.xxgxxx...x...xxxxx...x.......',
  '.x....x...x.....x.....x....x..',
  '.g....x...xxx...x...xxxxx..g..',
  '.x....x...............x....x..',
  '.xxxxxx.......x.......x....x..',
  '..............................',
  '..xxggxx......xxxxx...........',
  '..............x...x...........',
  '..............xxxxx...........',
  '..............................',
];
const mk = (ch) => LAYOUT.map((r) => r.replace(/x/g, ch));
layoutPreview('fences-wood.png', mk('w'), (c, m) => (c === 'g' ? pieces.gate[m] : pieces.wood[m]));
layoutPreview('fences-stone.png', mk('s'), (c, m) => (c === 'g' ? pieces.gate[m] : pieces.stone[m]));
layoutPreview('fences-wood-x6.png', mk('w').map((r) => r.slice(0, 8)).slice(0, 7), (c, m) => (c === 'g' ? pieces.gate[m] : pieces.wood[m]), 6);
layoutPreview('fences-stone-x6.png', mk('s').map((r) => r.slice(0, 8)).slice(0, 7), (c, m) => (c === 'g' ? pieces.gate[m] : pieces.stone[m]), 6);
layoutPreview('fences-map.png', mk('m').map((r) => r.replace(/g/g, '.')), (c, m, x, y) => pieces.map[`${m}:${(x * 7 + y * 3) % 3 === 1 ? 1 : 0}:0`]);
layoutPreview('fences-map-winter.png', mk('m').map((r) => r.replace(/g/g, '.')), (c, m, x, y) => pieces.map[`${m}:${(x * 7 + y * 3) % 3 === 1 ? 1 : 0}:3`]);
console.log(`fences: ${entries.length} frames -> art/fences/frames, recipe art/fences/sprites.json; previews e2e/out/art/fences-*.png`);
