// The title wordmark "Spr[gear]cket & Sprout", drawn by rule from the hand-pixeled glyphs: brass
// "Sprocket", a smaller cream "&", leafy "Sprout" with a two-leaf sprout growing off its t. Each
// face gets a top highlight row, a lighter upper band and a darker lower band (one horizon across
// the word), a dark bottom edge, then a 3D side below, a plum outline around everything and a
// 1 px drop shadow down-right. The O of "Sprocket" is an empty slot: the game draws the spinning
// logo:gear there, and the slot is sized from the union of all 8 gear frames so no frame touches
// a letter.
import { GLYPHS } from './glyphs.mjs';
import { PX } from './pal.mjs';

export const MATERIALS = {
  brass: { depth: 3, hi: PX.brass[5], up: PX.brass[4], lo: PX.brass[3], edge: PX.brass[2], side: [PX.brass[1], PX.brass[1], PX.brass[0]] },
  green: { depth: 3, hi: PX.leaf[4], up: PX.leaf[3], lo: PX.leaf[2], edge: PX.leaf[1], side: [PX.leaf[0], PX.leaf[0], PX.leaf[0]] },
  cream: { depth: 1, rightEdge: false, hi: PX.cream[3], up: PX.cream[2], lo: PX.cream[2], edge: PX.cream[1], side: [PX.cream[0], PX.cream[0], PX.cream[0]] },
  leaf: { depth: 1, side: [PX.leaf[0]] },
};

// the sprout on the t of "Sprout": L leaf, s stem; (0, 0) = this grid's top-left
export const SPROUT = {
  // pixeled by hand in leaf colours (h light, m mid, d shade, D dark; S/s stem light/dark)
  rows: [
    '..hhh..........hhh..',
    '.hhmmhh......hhmmmd.',
    'hmmmmmmh....hmmmmmmd',
    'hmmmmmmmh..hmmmmmmmd',
    '.dmmmmmmdSsdmmmmmdd.',
    '..ddddDDDSsDDDdddd..',
    '.........Ss.........',
    '.........Ss.........',
    '.........Ss.........',
  ],
  colors: { h: PX.leaf[4], m: PX.leaf[3], d: PX.leaf[2], D: PX.leaf[1], S: PX.leaf[3], s: PX.leaf[2] },
  // grid column 0 sits 5 px left of the T: the stem (columns 9-10) rises from the T's columns 4-5
  // and its last row touches the crossbar (row 7)
  dx: -5,
};

// rivet heads per glyph: [x from the glyph's left edge, word row]
export const RIVETS = { S: [[1, 20]], p: [[1, 26]], r: [[1, 20]], k: [[1, 3], [1, 20]], t: [[3, 18]] };

export const STYLE = {
  rivets: true,
  leftLight: true,
  split: 16, // first row of the lower (darker) band
  depth: 3, // 3D side, px below the face
  shadow: PX.plum, // drop shadow, 1 px down-right of the outline
  gap: 2, // empty columns between two letters' faces (each letter keeps its own outline)
  space: 10, // between words
};

/**
 * Lay out and render. `gearMask(x, y)` is true where any gear frame (face or side, centre at
 * 0,0) has a filled pixel; the O slot is placed so the gear clears its neighbours.
 * Returns { w, h, px, slot: [cx, cy] (gear centre, a pixel corner), boxes }.
 */
export function renderWord(gearFill, gearR) {
  const M = 8; // working margin
  const items = []; // { ch, mat, x, y }
  const text = [['S', 'brass'], ['p', 'brass'], ['r', 'brass'], ['O', 'gear'], ['c', 'brass'], ['k', 'brass'], ['e', 'brass'], ['t', 'brass'], [' '], ['&', 'cream'], [' '], ['S', 'green'], ['p', 'green'], ['r', 'green'], ['o', 'green'], ['u', 'green'], ['T', 'green']];
  // face cells by (x, y) -> material, filled as we go so the gear can be placed against them
  const face = new Map();
  const key = (x, y) => x + ',' + y;
  let x = M, slot = null, prev = null;
  // a letter's solid cells: its face plus the 3D side below it
  const solidOf = (rows, top, gx, mat) => {
    const out = new Set(), d = MATERIALS[mat].depth;
    rows.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') for (let k = 0; k <= d; k++) out.add(key(gx + i, top + j + M + k)); }));
    return out;
  };
  const near = (set, x0, y0, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r + Math.abs(dy); dx <= r - Math.abs(dy); dx++) if (set.has(key(x0 + dx, y0 + dy))) return true;
    return false;
  };
  const placed = new Set(); // every letter cell so far (face and side)
  for (const [ch, mat] of text) {
    if (ch === ' ') { x += STYLE.space; prev = null; continue; }
    if (ch === 'O') {
      // smallest centre x whose gear (fill and side, all 8 frames) stays 3 px from every letter cell
      // so far: the letter's outline and drop shadow fit between, so the gear can be drawn over or
      // under the word
      const cy = 16 + M;
      let cx = x;
      while (gearFill.some(([gx, gy]) => near(placed, cx + gx, cy + gy, 2))) cx++;
      slot = [cx, cy];
      prev = { gear: true, cx, cy };
      continue;
    }
    const g = GLYPHS[ch];
    const w = g.rows[0].length;
    let gx = x;
    if (prev?.gear) {
      // nearest x right of the gear with the same 3 px: the gear's own drop shadow (1 px right of its
      // outline) then falls on this letter's outline, never on its face
      const gearCells = new Set(gearFill.map(([a, b]) => key(prev.cx + a, prev.cy + b)));
      gx = prev.cx - gearR;
      while ([...solidOf(g.rows, g.top, gx, mat)].some((k) => { const [a, b] = k.split(',').map(Number); return near(gearCells, a, b, 2); })) gx++;
    }
    g.rows.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') face.set(key(gx + i, g.top + j + M), { mat, item: items.length }); }));
    for (const k of solidOf(g.rows, g.top, gx, mat)) placed.add(k);
    items.push({ ch, mat, x: gx, y: M, w });
    x = gx + w + STYLE.gap;
    prev = { ch };
  }
  // the sprout on the last t
  const t = items[items.length - 1];
  const sx = t.x + SPROUT.dx, sy = M + GLYPHS.T.top - SPROUT.rows.length;
  SPROUT.rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== '.') face.set(key(sx + i, sy + j), { mat: 'leaf', item: -1, col: SPROUT.colors[c] });
  }));
  // bounds
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of face.keys()) { const [a, b] = k.split(',').map(Number); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  // include the gear's reach so the canvas covers the slot (the gear itself is not drawn here)
  for (const [gx, gy] of gearFill) { x0 = Math.min(x0, slot[0] + gx); y0 = Math.min(y0, slot[1] + gy); x1 = Math.max(x1, slot[0] + gx); y1 = Math.max(y1, slot[1] + gy); }
  // canvas: 1 px outline all round, depth below, 1 px drop shadow right/below
  const ox = x0 - 1, oy = y0 - 1;
  const W = x1 - x0 + 1 + 2 + 1, H = y1 - y0 + 1 + 2 + STYLE.depth + 1;
  const px = new Array(W * H).fill(null);
  const fAt = (fx, fy) => face.get(key(fx, fy));
  for (const [k, v] of face) {
    const [fx, fy] = k.split(',').map(Number);
    const m = MATERIALS[v.mat];
    const same = (dx, dy) => fAt(fx + dx, fy + dy)?.mat === v.mat;
    const yy = fy - M;
    let col;
    if (v.col) col = v.col;
    else if (!same(0, -1)) col = m.hi;
    else if (!same(0, 1)) col = m.edge;
    else if (!same(1, 0) && yy >= STYLE.split && m.rightEdge !== false) col = m.edge;
    else if (!same(-1, 0) && STYLE.leftLight && m.rightEdge !== false) col = yy < STYLE.split ? m.hi : m.up; // lit left edge
    else col = yy < STYLE.split ? m.up : m.lo;
    px[(fy - oy) * W + (fx - ox)] = col;
  }
  // rivets on the brass stems: a butter head with a copper shadow down-right
  if (STYLE.rivets) for (const it of items) {
    const spots = RIVETS[it.ch];
    if (!spots || it.mat !== 'brass') continue;
    for (const [rx, ry] of spots) {
      const X = it.x + rx - ox, Y = it.y + ry - oy;
      px[Y * W + X] = PX.brass[5];
      px[Y * W + X + 1] = PX.brass[4];
      px[(Y + 1) * W + X] = PX.brass[4];
      px[(Y + 1) * W + X + 1] = PX.brass[1];
    }
  }
  // 3D side: the face pushed down `depth` px, in the side colours of the face above it
  const sideOf = new Array(W * H).fill(null);
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      if (px[yy * W + xx]) continue;
      for (let k = 1; k <= STYLE.depth; k++) {
        const f = fAt(xx + ox, yy + oy - k);
        if (f) { if (k <= MATERIALS[f.mat].depth) sideOf[yy * W + xx] = MATERIALS[f.mat].side[k - 1]; break; }
      }
    }
  sideOf.forEach((c, i) => { if (c) px[i] = c; });
  // outline (4-neighbour) around face + side
  const solid = px.map((p) => p !== null);
  const on = (a, b) => a >= 0 && b >= 0 && a < W && b < H && solid[b * W + a];
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++)
      if (!solid[yy * W + xx] && (on(xx - 1, yy) || on(xx + 1, yy) || on(xx, yy - 1) || on(xx, yy + 1))) px[yy * W + xx] = PX.ink;
  // drop shadow 1 px down-right
  const inked = px.map((p) => p !== null);
  for (let yy = H - 1; yy > 0; yy--)
    for (let xx = W - 1; xx > 0; xx--)
      if (!inked[yy * W + xx] && inked[(yy - 1) * W + xx - 1]) px[yy * W + xx] = STYLE.shadow;
  return { w: W, h: H, px, slot: [slot[0] - ox, slot[1] - oy], items: items.map((it) => ({ ...it, x: it.x - ox, y: it.y - oy })) };
}
