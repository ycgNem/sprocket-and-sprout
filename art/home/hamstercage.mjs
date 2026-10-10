// The hamster cage (farmhouse furniture, 2x1 tiles): three layers on one 32x26 canvas, origin [0, 10]
// (the tile row's top-left sits 10 px below the sprite's top), drawn by rule and ASCII so they line up
// exactly. The renderer stacks them:
//   hf:hamstercage:0:*    the back: wooden tray, the shadowed inside with the back bars, wood-shaving
//                         bedding on the left, a copper food dish, a water bottle clipped to the bars,
//                         the wheel's stand and rim
//   hf:hamsterwheel:<f>:* the wheel's spokes and tread rungs at four turns (f 0-3), between the back and
//                         the hamster; draw frame 0 while nobody runs so the wheel keeps its spokes
//   (the hamster, pet:hamster:<coat>:<pose>)
//   hf:hamstercage:1:*    the front: roof bars, front rail and bars, corner posts, the tray's front lip
// Usage: node art/home/hamstercage.mjs → art/home/src/hamstercage0.png, hamstercage1.png,
//        hamsterwheel0-3.png (then node scripts/sprites-import.mjs art/home/sprites.json)
//
// Projection: the furniture's straight-on 3/4 (a box's front face as is, its top face above it), 7 px
// deep: the back top rail is row 0, the front top rail row 7, the tray's back rim row 14 and its front
// rim row 21, the floor contact row 25. The inside is shaded wine so the bedding, the wheel and the
// hamster read through the bars (the farmhouse floor's planks would show through otherwise).
// The hamster's spots (canvas pixels for its sprite origin, the bottom centre of its 16x16 frame):
// SPOTS.bed (10, 20) asleep or sitting on the bedding; FLOOR x 7..12, y 19..20 where it may potter
// (left of the wheel, over the dish at the left end); SPOTS.wheel (23, 19) running, frames 0 1 4 5,
// facing right as the wheel turns clockwise (frames 0-3; mirrored, play them 3-0). The wheel is 15 px
// across, centred on (23, 13), so the 10 px hamster fits inside it. The front bars sit at x 8, 16 and
// 23 so they miss the hamster's eyes at the bed spot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../scripts/lib/png.mjs';
import { PAL, rgbOf } from '../../scripts/lib/pixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W = 32, H = 26;

const layer = () => Array.from({ length: H }, () => Array(W).fill(null));
const set = (L, x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) L[y][x] = c; };
const hline = (L, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(L, x, y, c); };
const vline = (L, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(L, x, y, c); };
const patch = (L, x0, y0, rows, key) => rows.forEach((r, y) => [...r].forEach((ch, x) => {
  if (ch === '.') return;
  if (!(ch in key)) throw new Error(`patch: no key for "${ch}"`);
  set(L, x0 + x, y0 + y, key[ch]);
}));
function line(L, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) { set(L, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
const angDist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// palette (STYLE.md ramps)
const INK = '#2e222f', PLUM = '#45293f';
const WOOD = { d: '#45293f', D: '#7a3045', s: '#9e4539', m: '#cd683d', l: '#e6904e' };
const BRASS = { S: '#9e4539', s: '#cd683d', m: '#f79617', g: '#f9c22b', G: '#fbff86' };

export const DEFAULTS = {
  frontBars: [8, 16, 23],
  backBars: [4, 8, 12, 16, 20, 24, 28],
  inside: '#45293f', // the shadowed inside (back wall)
  backBar: '#7a3045',
  wheel: { cx: 23, cy: 13, r: 7.5 },
};
const EDGE = '#6e2727'; // the furniture's silhouette edge (the drafting table's), ink on the bottom

export function build(o = DEFAULTS) {
  const { cx, cy, r } = o.wheel;
  const inW = (x, y, rr = r) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr;

  // ---------------- the back ----------------
  const back = layer();
  {
    const L = back;
    hline(L, 1, 30, 0, EDGE);
    // the back top rail, the shadowed back wall and its bars
    hline(L, 1, 30, 1, BRASS.s);
    for (let y = 2; y <= 13; y++) hline(L, 2, 29, y, o.inside);
    for (const x of o.backBars) vline(L, x, 2, 13, o.backBar);
    // the tray: back rim, floor between the rims (dark wood strewn with shavings)
    hline(L, 2, 29, 14, WOOD.D);
    for (let y = 15; y <= 20; y++) hline(L, 2, 29, y, WOOD.s);
    for (const [x, y] of [[17, 17], [20, 19], [27, 16], [29, 19], [15, 20], [25, 20], [18, 15], [28, 17], [16, 16]]) set(L, x, y, '#fdcbb0');
    // wood-shaving bedding heaped in the back-left corner: pale aspen curls, taupe in the folds
    const BED = { w: '#ffffff', c: '#fdcbb0', t: '#ab947a', T: '#966c6c' };
    patch(L, 2, 12, [
      '..cc.tcw.ct...',
      '.cwcctwccctcc.',
      'cwcctcwcctcwct',
      'ctcwcctcwcctcT',
      'cwctwccctcwctT',
      'tcctccwtcctcTt',
      'TtcTtTctTtcTt.',
      '.TtTtTtTtTtT..',
    ], BED);
    // a copper food dish with seeds, tucked in the front-left corner beside the bedding
    patch(L, 1, 18, [
      '.kSk.',
      'cCCCr',
      'orrro',
    ], { o: INK, k: '#3e3546', S: '#c7dcd0', c: '#fca790', C: '#ea4f36', r: '#b33831' });
    // the water bottle clipped to the back bars above the bedding: brass cap, glass, water, spout
    patch(L, 3, 2, [
      '.gm.',
      'ogmo',
      'oWbo',
      'oLbo',
      'oLBo',
      'oLBo',
      'obBo',
      'oomo',
      '..s.',
      '..i.',
    ], { o: INK, g: BRASS.g, m: BRASS.m, s: BRASS.s, W: '#ffffff', L: '#8fd3ff', b: '#4d9be6', B: '#4d65b4', i: '#9babb2' });
    // the wheel's stand: an A-frame from the hub down to two feet on the floor, behind the wheel
    for (const [x, y] of [[22, 14], [22, 15], [21, 16], [21, 17], [20, 18], [20, 19]]) set(L, x, y, BRASS.s);
    for (const [x, y] of [[24, 14], [24, 15], [25, 16], [25, 17], [26, 18], [26, 19]]) set(L, x, y, BRASS.S);
    set(L, 19, 20, BRASS.s); set(L, 20, 20, BRASS.m); set(L, 26, 20, BRASS.s); set(L, 27, 20, BRASS.S); // its feet
    // the wheel: a dark tread band inside a brass rim lit from the upper left
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!inW(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy), a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI; // 0 right, 90 down
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([p, q]) => !inW(x + p, y + q));
        if (edge) set(L, x, y, a < -95 && a > -175 ? BRASS.g : a > 20 && a < 160 ? BRASS.s : BRASS.m);
        else if (d > r - 2.2) set(L, x, y, INK);
        else set(L, x, y, WOOD.D); // the drum's back plate, so a running hamster of any coat stands out
      }
  }

  // ---------------- the wheel's turning parts ----------------
  const tread = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inside = inW(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([p, q]) => inW(x + p, y + q));
    if (inside && Math.hypot(x - cx, y - cy) > r - 2.2) tread.push([x, y, (Math.atan2(y - cy, x - cx) * 180) / Math.PI]);
  }
  const wheel = [0, 1, 2, 3].map((f) => {
    const L = layer();
    const turn = f * 22.5; // clockwise on screen: the hamster runs right, the tread slides back under it
    for (const [x, y, a] of tread) if ([0, 1, 2, 3, 4, 5, 6, 7].some((k) => angDist(a, k * 45 + turn) < 8)) set(L, x, y, BRASS.m);
    for (let k = 0; k < 4; k++) {
      const t = ((k * 90 + turn + 45) * Math.PI) / 180;
      line(L, cx, cy, Math.round(cx + Math.cos(t) * (r - 2.4)), Math.round(cy + Math.sin(t) * (r - 2.4)), BRASS.m);
    }
    patch(L, cx - 1, cy - 1, ['gm.', 'mSs', '.s.'], { g: BRASS.g, m: BRASS.m, s: BRASS.s, S: BRASS.S });
    return L;
  });

  // ---------------- the front ----------------
  const front = layer();
  {
    const L = front;
    // roof bars (the lit top face) between the back rail (row 1) and the front rail (row 7)
    for (const x of o.frontBars) vline(L, x, 2, 6, BRASS.m);
    // front bars from the front rail down to the tray's rim, catching the light at the top
    for (const x of o.frontBars) { vline(L, x, 8, 20, BRASS.m); vline(L, x, 8, 9, BRASS.g); vline(L, x, 18, 20, BRASS.s); }
    // the front top rail
    hline(L, 1, 30, 7, BRASS.g); hline(L, 2, 8, 7, BRASS.G);
    // corner posts: lit on the left, shaded on the right, inside the silhouette edge
    vline(L, 1, 1, 20, BRASS.g); set(L, 1, 1, BRASS.G); vline(L, 30, 1, 20, BRASS.s); set(L, 30, 1, BRASS.m);
    vline(L, 0, 0, 24, EDGE); vline(L, 31, 0, 25, INK);
    // the tray's front lip: lit rim, plank face, ink bottom
    hline(L, 1, 30, 21, WOOD.m);
    hline(L, 1, 30, 22, WOOD.s); hline(L, 1, 30, 23, WOOD.s); hline(L, 1, 30, 24, WOOD.D);
    for (const x of [9, 22]) { set(L, x, 22, WOOD.D); set(L, x, 23, WOOD.D); }
    hline(L, 1, 30, 25, INK); set(L, 0, 25, null);
    // brass corner brackets and a little nameplate
    patch(L, 1, 22, ['mg', 'm.'], { m: BRASS.m, g: BRASS.g });
    patch(L, 29, 22, ['gm', '.s'], { m: BRASS.m, g: BRASS.g, s: BRASS.s });
    patch(L, 14, 22, ['GggG', 'mssm'], { G: BRASS.G, g: BRASS.g, m: BRASS.m, s: BRASS.s });
  }
  return { back, front, wheel };
}

export const toImg = (L) => {
  const data = new Uint8Array(W * H * 4);
  L.forEach((row, y) => row.forEach((c, x) => {
    if (!c) return;
    if (!PAL.includes(c)) throw new Error(`${c} at ${x},${y} is not a palette color`);
    data.set([...rgbOf(c), 255], (y * W + x) * 4);
  }));
  return { w: W, h: H, data };
};
export const SPOTS = { bed: [10, 20], wheel: [23, 19] };
export const FLOOR = { x: [7, 12], y: [19, 20] };
export const { back, front, wheel } = build();

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(HERE, 'src');
  fs.mkdirSync(out, { recursive: true });
  const files = { hamstercage0: back, hamstercage1: front, ...Object.fromEntries(wheel.map((L, f) => ['hamsterwheel' + f, L])) };
  for (const [name, L] of Object.entries(files)) { const im = toImg(L); fs.writeFileSync(path.join(out, name + '.png'), encodePNG(im.w, im.h, im.data)); }
  console.log('hamster cage: ' + Object.keys(files).join(', ') + ' → art/home/src/');
}
