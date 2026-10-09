// UI skin sources: nine-slice frames for src/ui/skin.ts, drawn pixel by pixel from shape rules so
// every state of a button or slot is the same design with other colors (pixel-aligned variants).
//
// Usage: node art/ui/tools/build.mjs [--mock out.png]
//   writes art/ui/src/<name>.png (one PNG per sprite name, exact frame size) and, with --mock, a
//   labeled mock-up of every frame composed at real sizes with the game's bitmap font, x3.
//
// Frame rules (src/ui/skin.ts): the border is a third of the smaller side; corners are drawn 1:1,
// edges and the center are tiled in whole copies. So: edges are uniform or period-8 patterns that
// tile, centers are flat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, upscale } from '../../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SRC = path.resolve(HERE, '../src');

// ---- palette (Resurrect 64 entries used here) ----
const K = {
  O: '#2e222f', // outline plum-black
  p: '#3e3546', // plum
  s: '#625565', // slate
  d: '#45293f', // shadow tint
  r: '#7a3045', // wood dark
  w: '#9e4539', // wood base / brass darkest
  W: '#cd683d', // wood light / brass shade
  h: '#e6904e', // wood highlight
  b: '#f79617', // brass base
  B: '#f9c22b', // brass light
  y: '#fbff86', // brass glint
  A: '#fbb954', // amber / honey
  P: '#fdcbb0', // parchment
  q: '#fca790', // parchment shade
  Z: '#ffffff', // paper white
  t: '#ab947a', // taupe
  o: '#966c6c', // dusty wood
  k: '#7f708a', // stone
  e: '#c7dcd0', // pale
  g1: '#165a4c', g2: '#239063', g3: '#1ebc73', g4: '#91db69',
  R1: '#ae2334', R2: '#e83b3b', R3: '#f68181',
  c1: '#6e2727', c2: '#b33831', c3: '#ea4f36', c4: '#f57d4a', c5: '#fca790',
};
const col = (c) => (c == null ? null : K[c] ?? c);

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col(c); }
  clone() { const o = new Img(this.w, this.h); o.c = [...this.c]; return o; }
  rgba() {
    const d = new Uint8Array(this.w * this.h * 4);
    this.c.forEach((c, i) => { if (c) d.set([...[1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16)), 255], i * 4); });
    return { w: this.w, h: this.h, data: d };
  }
}

/** ring frame: sides.{top,left,bottom,right}[ring] colors from the outside in, then fill. Light
 * from the upper left: the top-right corner diagonal belongs to the right side, the bottom-left
 * one to the bottom side. */
function bevel(w, h, sides, fill, { chamfer = true } = {}) {
  const im = new Img(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dt = y, db = h - 1 - y, dl = x, dr = w - 1 - x, d = Math.min(dt, db, dl, dr);
      let side;
      if (d === dt && d === dl) side = 'top';
      else if (d === dt && d === dr) side = 'right';
      else if (d === db && d === dl) side = 'bottom';
      else if (d === db && d === dr) side = 'bottom';
      else if (d === dt) side = 'top';
      else if (d === db) side = 'bottom';
      else if (d === dl) side = 'left';
      else side = 'right';
      const arr = sides[side] ?? [];
      im.set(x, y, d < arr.length ? arr[d] : fill);
    }
  if (chamfer) for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) im.c[y * w + x] = null;
  return im;
}

/** a brass (or any) plate in each corner: mask(lx, ly) in top-left local coords, mirrored to the
 * other corners; shaded by neighbours so light stays upper-left in every corner. */
function cornerPlates(im, mask, size, ramp, { outline = 'O', rivet = null } = {}) {
  const { w, h } = im;
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const L = (x, y) => [fx ? w - 1 - x : x, fy ? h - 1 - y : y];
    const inM = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return false; const [lx, ly] = L(x, y); return lx < size && ly < size && mask(lx, ly); };
    const x0 = fx ? w - size : 0, y0 = fy ? h - size : 0;
    for (let y = y0; y < y0 + size; y++)
      for (let x = x0; x < x0 + size; x++) {
        if (inM(x, y)) {
          const lit = !inM(x - 1, y) || !inM(x, y - 1), dark = !inM(x + 1, y) || !inM(x, y + 1);
          im.set(x, y, lit && !dark ? ramp.hi : dark && !lit ? ramp.sh : ramp.base);
        } else if (outline && im.get(x, y) !== null && (inM(x - 1, y) || inM(x + 1, y) || inM(x, y - 1) || inM(x, y + 1))) im.set(x, y, outline);
      }
    if (rivet) {
      // rivet: a 2x2 dome at local (rx, ry), lit top-left in every corner
      const [rx, ry] = rivet.at;
      const gx = fx ? w - 1 - rx - 1 : rx, gy = fy ? h - 1 - ry - 1 : ry;
      im.set(gx, gy, rivet.c[0]); im.set(gx + 1, gy, rivet.c[1]);
      im.set(gx, gy + 1, rivet.c[2]); im.set(gx + 1, gy + 1, rivet.c[3]);
    }
  }
  return im;
}

/** paint `c` where pred(x, y, ring, side) holds (for grain, studs …) */
function paint(im, pred, c) {
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.get(x, y) !== null && pred(x, y)) im.set(x, y, c);
  return im;
}

// ===================================================================== designs
const S = {}; // name -> Img

// ---- wood window: 24x24, 8 px border; visible frame 5 px (content in the game starts at +5) ----
function woodPanel() {
  const N = 40, B = 13; // 13 px corners, 14 px tiles: long enough for a grain that doesn't look dotted
  const top = ['O', 'W', 'w', 'r', 'O', 'q'];
  const left = ['O', 'W', 'w', 'r', 'O', 'q'];
  const bottom = ['O', 'r', 'w', 'W', 'O'];
  const right = ['O', 'r', 'w', 'W', 'O'];
  const im = bevel(N, N, { top, left, bottom, right }, 'P');
  // grain on the middle plank row, inside the tiled strip only (i = position in the 14 px tile)
  const i = (v) => v - B;
  const inTile = (v) => v >= B && v < N - B;
  paint(im, (x, y) => y === 2 && inTile(x) && i(x) >= 3 && i(x) <= 7, 'r');
  paint(im, (x, y) => y === 2 && inTile(x) && i(x) >= 10 && i(x) <= 11, 'W');
  paint(im, (x, y) => y === N - 3 && inTile(x) && i(x) >= 6 && i(x) <= 10, 'r');
  paint(im, (x, y) => x === 2 && inTile(y) && i(y) >= 4 && i(y) <= 8, 'r');
  paint(im, (x, y) => x === N - 3 && inTile(y) && i(y) >= 1 && i(y) <= 5, 'r');
  // brass L-brackets capping the beam ends (arms taper at the tip, after the PixelLab corner batch
  // art/ui/raw/corners #52/#59), a domed rivet in the corner and a pin near each arm end
  const L = (x, y) => (x >= 1 && x <= 9 && y >= 1 && y <= 3) || (x === 10 && y >= 1 && y <= 2)
    || (x >= 1 && x <= 3 && y >= 1 && y <= 9) || (y === 10 && x >= 1 && x <= 2);
  cornerPlates(im, L, B, { hi: 'B', base: 'b', sh: 'W' }, { rivet: { at: [1, 1], c: ['y', 'B', 'B', 'w'] } });
  for (const [x, y] of [[8, 2], [2, 8], [N - 9, 2], [N - 3, 8], [8, N - 3], [2, N - 9], [N - 9, N - 3], [N - 3, N - 9]]) im.set(x, y, 'w');
  return im;
}
S['ui:panel:wood'] = woodPanel();

// ---- paper note: 12x12, white sheet, peach shade bottom/right, dog-eared top-right ----
function paperPanel() {
  const im = bevel(12, 12, { top: ['O'], left: ['O'], bottom: ['O', 'q'], right: ['O', 'q'] }, 'Z');
  // dog-ear: cut the top-right corner, show the folded flap
  for (const [x, y] of [[10, 0], [11, 0], [11, 1]]) im.set(x, y, null), (im.c[y * 12 + x] = null);
  im.set(9, 0, 'O'); im.set(10, 1, 'O'); im.set(11, 2, 'O');
  im.set(9, 1, 'q'); im.set(9, 2, 'P'); im.set(10, 2, 'q');
  return im;
}
S['ui:panel:paper'] = paperPanel();

// ---- dark HUD plate: 12x12, opaque plum with a subtle lit lip and brass pins ----
function darkPanel() {
  const im = bevel(12, 12, { top: ['O', 's'], left: ['O', 'p'], bottom: ['O', 'O'], right: ['O', 'p'] }, 'p');
  for (const [x, y] of [[1, 1], [10, 1]]) im.set(x, y, 'W');
  return im;
}
S['ui:panel:dark'] = darkPanel();

// ---- brass nameplate: 12x12, gold plate with four rivets ----
function brassPanel() {
  const im = bevel(12, 12, { top: ['O', 'B'], left: ['O', 'B'], bottom: ['O', 'W'], right: ['O', 'W'] }, 'b');
  for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) { im.set(x, y, 'w'); }
  for (const [x, y] of [[1, 1], [10, 1], [1, 10]]) im.set(x, y, 'y');
  return im;
}
S['ui:panel:brass'] = brassPanel();

// ---- inset: recessed well in the parchment ----
function insetPanel(fill) {
  return bevel(12, 12, { top: ['o', 'q'], left: ['o', 'q'], bottom: ['o'], right: ['o'] }, fill, { chamfer: false });
}
S['ui:panel:inset'] = insetPanel('P');
// mock-only alternative: salmon floor
const MOCK_ONLY = { 'ui:panel:inset2': bevel(12, 12, { top: ['o', 'W'], left: ['o', 'W'], bottom: ['o', 'q'], right: ['o', 'q'] }, 'q', { chamfer: false }) };

// ---- slots: 12x12, recessed taupe cup; hover lighter; selected with a brass glow rim ----
function slot(state) {
  // rim, inner shadow (top/left), inner lip (bottom/right), floor
  const [rim, shade, lip, fill] = [
    ['o', 'o', 't', 't'], // 0: dusty-wood rim, 2 px soft shadow top-left, taupe floor
    ['W', 'h', 'q', 'q'], // 1: hover, warm rim, lighter floor
    ['b', 'B', 'A', 't'], // 2: selected, brass glow rim around the normal floor
  ][state];
  return bevel(12, 12, { top: [rim, shade], left: [rim, shade], bottom: [rim, lip], right: [rim, lip] }, fill);
}
for (const st of [0, 1, 2]) S[`ui:slot:${st}`] = slot(st);
S['ui:panel:slot'] = slot(0);

// ---- buttons: 12x12, 4 px border; label area flat ----
const BTN = {
  //            outline, top/left light, center, bottom/right dark
  wood: [
    ['O', 'W', 'w', 'r'], // 0 normal
    ['O', 'h', 'W', 'w'], // 1 hover
    ['O', 'r', 'w', 'w'], // 2 pressed: shadow on the top edge
    ['s', 'e', 't', 'o'], // 3 disabled: warm stone
    ['O', 'B', 'W', 'b'], // 4 active: copper-lit wood in a brass ring
  ],
  green: [
    ['O', 'g3', 'g2', 'g1'],
    ['O', 'g4', 'g3', 'g2'],
    ['O', 'g1', 'g2', 'g2'],
    ['s', 'e', 't', 'o'],
    ['O', 'B', 'W', 'b'],
  ],
  red: [
    ['O', 'R2', 'R1', 'c1'],
    ['O', 'R3', 'R2', 'R1'],
    ['O', 'c1', 'R1', 'R1'],
    ['s', 'e', 't', 'o'],
    ['O', 'B', 'W', 'b'],
  ],
  flat: [
    ['o', 'Z', 'P', 'q'],
    ['W', 'Z', 'Z', 'P'],
    ['o', 'q', 'P', 'P'],
    ['o', 'e', 't', 't'],
    ['W', 'y', 'A', 'b'],
  ],
};
function button(style, state) {
  const [o, hi, c, sh] = BTN[style][state];
  const im = bevel(12, 12, { top: [o, hi], left: [o, hi], bottom: [o, sh], right: [o, sh] }, c);
  return im;
}
for (const style of Object.keys(BTN)) for (let st = 0; st < 5; st++) S[`ui:button:${style}:${st}`] = button(style, st);

// ===================================================================== output
fs.mkdirSync(SRC, { recursive: true });
const fileOf = (name) => name.replace(/^ui:/, '').replace(/:/g, '-') + '.png';
for (const [name, im] of Object.entries(S)) {
  const r = im.rgba();
  fs.writeFileSync(path.join(SRC, fileOf(name)), encodePNG(r.w, r.h, r.data));
}
// the import recipe (node scripts/sprites-import.mjs art/ui/sprites.json): copied 1:1, no trimming
const entries = Object.keys(S).map((n) => '  ' + JSON.stringify({ match: n, file: 'src/' + fileOf(n), frame: [S[n].w, S[n].h] }));
fs.writeFileSync(path.join(HERE, '../sprites.json'), `{
 "name": "ui",
 "kind": "sprites",
 "meta": { "note": "nine-slice skin frames for src/ui/skin.ts; generated by art/ui/tools/build.mjs" },
 "defaults": { "place": "none", "origin": [0, 0], "scale": 1, "keepStrays": true },
 "sprites": [
${entries.join(',\n')}
 ]
}
`);
console.log(`wrote ${Object.keys(S).length} sources to ${path.relative(ROOT, SRC)} and art/ui/sprites.json`);

// ===================================================================== mock-up
const mockArg = process.argv.indexOf('--mock');
if (mockArg > 0) {
  const out = path.resolve(process.argv[mockArg + 1] ?? path.join(ROOT, 'e2e/out/art/ui-mock.png'));
  // the game's bitmap font
  const fsrc = fs.readFileSync(path.join(ROOT, 'src/ui/font.ts'), 'utf8');
  const G = new Map();
  for (const m of fsrc.matchAll(/^\s*(?:'(.)'|"(.)"|([A-Za-z0-9]))\s*:\s*'([.#|]+)'/gm)) G.set(m[1] ?? m[2] ?? m[3], m[4].split('|'));
  const canvas = new Img(420, 300);
  const fillR = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) canvas.set(x + i, y + j, c); };
  // grass-ish backdrop, 2-tone checker so frame edges are judged on a busy ground
  for (let y = 0; y < canvas.h; y++) for (let x = 0; x < canvas.w; x++) canvas.set(x, y, ((x >> 3) + (y >> 3)) & 1 ? '#239063' : '#165a4c');
  const text = (s, x, y, c, shadow) => {
    let cx = x;
    for (const ch of s) {
      const g = G.get(ch) ?? (ch === ' ' ? ['..', '..'] : G.get('?') ?? ['###']);
      g.forEach((row, j) => [...row].forEach((p, i) => {
        if (p !== '#') return;
        if (shadow) canvas.set(cx + i, y + j + 1, shadow);
        canvas.set(cx + i, y + j, c);
      }));
      cx += g[0].length + 1;
    }
    return cx - x;
  };
  const tw = (s) => [...s].reduce((a, ch) => a + (G.get(ch)?.[0].length ?? 2) + 1, 0);
  const nine = (name, x, y, w, h) => {
    const s = S[name];
    const b = Math.floor(Math.min(s.w, s.h) / 3), mw = s.w - 2 * b, mh = s.h - 2 * b;
    const bw = Math.min(b, Math.floor(w / 2)), bh = Math.min(b, Math.floor(h / 2));
    const put = (sx, sy, dx, dy) => { const c = s.get(sx, sy); if (c) canvas.set(dx, dy, c); };
    const tile = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) put(sx + (i % sw), sy + (j % sh), dx + i, dy + j);
    };
    tile(b, b, mw, mh, x + bw, y + bh, w - 2 * bw, h - 2 * bh);
    tile(b, 0, mw, b, x + bw, y, w - 2 * bw, bh);
    tile(b, s.h - b, mw, b, x + bw, y + h - bh, w - 2 * bw, bh);
    tile(0, b, b, mh, x, y + bh, bw, h - 2 * bh);
    tile(s.w - b, b, b, mh, x + w - bw, y + bh, bw, h - 2 * bh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      put(i, j, x + i, y + j); put(s.w - bw + i, j, x + w - bw + i, y + j);
      put(i, s.h - bh + j, x + i, y + h - bh + j); put(s.w - bw + i, s.h - bh + j, x + w - bw + i, y + h - bh + j);
    }
  };
  // a window
  nine('ui:panel:wood', 8, 16, 250, 200);
  fillR(10, 216, 248, 2, '#45293f');
  nine('ui:panel:brass', 83, 8, 100, 16);
  text('Backpack', 133 - Math.floor(tw('Backpack') / 2), 13, K.O);
  nine('ui:button:red:0', 240 - 18 + 18 - 18, 21, 12, 12);
  text('x', 240 - 18 + 18 - 18 + 4, 23, K.Z, K.d);
  // tabs
  const btn = (style, st, x, y, w, h, label) => {
    nine(`ui:button:${style}:${st}`, x, y, w, h);
    const flat = style === 'flat', dis = st === 3;
    const c = dis ? K.s : flat ? K.O : K.Z;
    text(label, x + Math.floor(w / 2) - Math.floor(tw(label) / 2), y + Math.floor((h - 7) / 2) + (st === 2 ? 1 : 0), c, flat || dis ? null : K.d);
  };
  btn('wood', 4, 18, 26, 56, 14, 'Inventory');
  btn('wood', 0, 78, 26, 56, 14, 'Crafting');
  btn('wood', 1, 138, 26, 40, 14, 'Skills');
  text('Hotbar', 18, 46, K.O);
  for (let i = 0; i < 9; i++) nine(`ui:slot:${i === 0 ? 2 : i === 3 ? 1 : 0}`, 18 + i * 22, 56, 20, 20);
  // fake item icons (a little radish)
  for (const i of [0, 1, 4]) { const x = 18 + i * 22 + 4, y = 56 + 4; fillR(x + 3, y + 3, 6, 6, '#2e222f'); fillR(x + 4, y + 4, 4, 4, '#e83b3b'); fillR(x + 5, y, 2, 3, '#239063'); }
  text('Robin of Willowbrook', 22, 88, K.O);
  // inset with the common text colors
  nine('ui:panel:inset', 16, 84, 230, 54);
  text('Robin of Willowbrook Farm', 22, 89, K.O);
  text('Logistics (oak hint)', 22, 99, K.o);
  text('120/20 moss', 22, 109, '#676633');
  text('walnut  brick  bark', 22, 119, '#4c3e24');
  text('brick', 140, 119, '#b33831'); text('bark', 175, 119, '#45293f');
  text('On parchment: ink', 18, 142, K.O);
  text('oak hint', 120, 142, K.o); text('moss', 170, 142, '#676633'); text('brick', 200, 142, '#b33831');
  // buttons row: every style x state
  const styles = ['wood', 'green', 'red', 'flat'];
  styles.forEach((style, si) => [0, 1, 2, 3, 4].forEach((st) => btn(style, st, 18 + st * 46, 154 + si * 15, 44, 14, ['Normal', 'Hover', 'Press', 'Off', 'On'][st])));
  // paper + dark plates on the grass
  nine('ui:panel:paper', 270, 16, 120, 18);
  text('Radish x3', 292, 22, K.O);
  nine('ui:panel:paper', 270, 40, 140, 40);
  text('Dear farmer,', 276, 46, K.O); text('the bridge is fixed.', 276, 56, K.O); text('- Marigold', 276, 66, '#4c3e24');
  nine('ui:panel:dark', 270, 88, 140, 37);
  fillR(270, 88, 140, 1, K.b);
  text('Tend the garden', 275, 92, K.A); text('- Water 9 crops', 275, 103, K.Z); text('+ Till soil', 275, 113, '#91db69');
  nine('ui:panel:dark', 270, 130, 120, 15);
  text('Saved the day!', 330 - Math.floor(tw('Saved the day!') / 2), 134, K.Z);
  nine('ui:panel:brass', 270, 150, 120, 40);
  text('Quest done', 276, 156, K.O); text('Reward 120', 276, 166, '#4c3e24');
  // hotbar housing with slots
  fillR(262, 200, 150, 36, '#2e222f'); fillR(263, 201, 148, 34, '#45293f');
  for (let i = 0; i < 6; i++) nine(`ui:slot:${i === 1 ? 2 : i === 4 ? 1 : 0}`, 268 + i * 23, 208, 20, 20);
  // minimap-style wood panel with content at +5
  nine('ui:panel:wood', 8, 228, 90, 64);
  fillR(13, 233, 80, 54, '#239063');
  nine('ui:panel:wood', 110, 228, 60, 30);
  nine('ui:panel:slot', 180, 236, 18, 18);
  nine('ui:panel:inset', 210, 236, 40, 30);
  S['ui:panel:inset2'] = MOCK_ONLY['ui:panel:inset2'];
  nine('ui:panel:inset2', 262, 240, 150, 52);
  text('Logistics (oak hint)', 268, 246, K.o); text('120/20 moss', 268, 256, '#676633'); text('Robin ink', 268, 266, K.O);
  const big = upscale(canvas.rgba(), 3);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(big.w, big.h, big.data));
  console.log('mock: ' + path.relative(ROOT, out));
}
