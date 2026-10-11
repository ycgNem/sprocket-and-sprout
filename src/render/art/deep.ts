// The Deepworks' machines and works problems (src/sim/systems/mine.ts), drawn in code until the
// art pass (ROADMAP.md 9): deep:<kind>:<restored>:<frame> stands on a chamber's footprint (anchor:
// the footprint's bottom-left corner), and the gallery / stair doorway is an `o:` object.
import { C, DARK, LIGHT } from '../../data/palette';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily } from '../atlas';
import { PixBuf } from './pixbuf';

/** footprint widths in tiles, as in src/data/deepworks.ts */
const FOOT: Record<string, number> = { lift: 2, boiler: 3, pump: 2, lampworks: 3, lockers: 3, cart: 2, star: 2 };
/** sprite size per machine and how far it overhangs the footprint on the left */
const SIZE: Record<string, [number, number, number]> = {
  lift: [40, 58, 4], boiler: [52, 44, 2], pump: [38, 54, 3], lampworks: [52, 40, 2], lockers: [50, 46, 1], cart: [38, 30, 3], star: [44, 40, 6],
};

function rust(pb: PixBuf, x0: number, y0: number, w: number, h: number, seed: number, p = 0.12) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!pb.get(x, y)) continue;
      const r = hash2(x >> 1, y >> 1, seed);
      if (r < p) pb.set(x, y, r < p / 3 ? C.berry : C.rust);
    }
}

function rivets(pb: PixBuf, x0: number, y: number, x1: number, step: number, c: number) {
  for (let x = x0; x <= x1; x += step) pb.set(x, y, c);
}

function drawLift(pb: PixBuf, on: boolean, f: number) {
  const W = pb.w, H = pb.h;
  // the headframe: two timber posts, a crossbeam and the sheave wheel on top
  pb.rect(4, 10, 4, H - 10, C.walnut); pb.rect(5, 10, 1, H - 10, C.oak);
  pb.rect(W - 8, 10, 4, H - 10, C.walnut); pb.rect(W - 7, 10, 1, H - 10, C.oak);
  pb.rect(2, 8, W - 4, 4, C.bark); pb.rect(2, 8, W - 4, 1, C.walnut);
  pb.disc(W / 2, 6, 5.5, C.slate); pb.disc(W / 2, 6, 3.5, on ? C.brass : C.stone); pb.disc(W / 2, 6, 1.2, C.ink);
  // the cage: up and clean when it runs, slumped and rusted when not
  const cy = on ? 18 : 26;
  pb.rect(10, cy, W - 20, H - cy - 6, C.ink);
  pb.rect(11, cy + 1, W - 22, H - cy - 8, C.plum);
  for (let x = 12; x < W - 11; x += 3) pb.rect(x, cy + 1, 1, H - cy - 8, on ? C.brass : C.stone);
  pb.rect(10, cy, W - 20, 2, on ? C.brass : C.stone);
  pb.rect(10, H - 8, W - 20, 2, on ? C.brass : C.stone);
  // the rope: taut to the wheel, or snapped and dangling
  if (on) pb.rect(W / 2, 11, 1, cy - 11, C.tan);
  else { pb.rect(W / 2, 11, 1, 6, C.tan); pb.set(W / 2 + 1, 17, C.tan); pb.set(W / 2 + 1, 18, C.oak); }
  // the winch drum on the left post
  pb.rect(0, H - 18, 6, 8, C.walnut); pb.disc(3, H - 14, 2.5, on ? C.copper : C.slate);
  // a lamp on the crossbeam
  pb.rect(W - 12, 12, 4, 4, C.ink); pb.rect(W - 11, 13, 2, 2, on ? (f ? C.butter : C.amber) : C.stone);
  // feet planks
  pb.rect(0, H - 3, W, 3, C.oak); pb.rect(0, H - 3, W, 1, C.tan);
  if (!on) { rust(pb, 10, cy, W - 20, H - cy - 6, 7, 0.2); pb.rect(14, H - 3, 6, 1, C.ink); }
}

function drawBoiler(pb: PixBuf, on: boolean, f: number) {
  const W = pb.w, H = pb.h;
  // brick footings
  for (const x of [6, W - 16]) { pb.rect(x, H - 9, 10, 9, C.brick); for (let y = H - 8; y < H; y += 3) pb.rect(x, y, 10, 1, DARK[C.brick]); }
  // the drum: a riveted cylinder lying on its side
  pb.ellipse(W / 2, H - 20, W / 2 - 2, 11, C.copper);
  for (let y = H - 31; y < H - 9; y++) for (let x = 2; x < W - 2; x++) if (pb.get(x, y)) {
    const t = (y - (H - 31)) / 22;
    pb.set(x, y, t < 0.2 ? LIGHT[C.copper] : t > 0.75 ? C.rust : C.copper);
  }
  for (const x of [12, W / 2, W - 12]) pb.rect(x, H - 30, 1, 20, C.rust);
  rivets(pb, 6, H - 28, W - 6, 4, C.brass);
  // the firebox door and the stack up into the roof
  pb.rect(3, H - 24, 9, 9, C.ink); pb.rect(4, H - 23, 7, 7, on ? (f ? C.amber : C.ember) : C.plum);
  pb.rect(W - 12, 0, 6, H - 30, C.slate); pb.rect(W - 12, 0, 2, H - 30, C.stone); pb.rect(W - 13, 6, 8, 2, C.ink);
  // the gauge
  pb.disc(W / 2 + 6, H - 34, 3, C.ink); pb.disc(W / 2 + 6, H - 34, 2, C.cream); pb.set(W / 2 + 6, H - 35, C.rose);
  pb.rect(W / 2 + 5, H - 32, 2, 2, C.slate);
  rust(pb, 2, H - 31, W - 4, 22, 11, on ? 0.04 : 0.16);
}

function drawPump(pb: PixBuf, on: boolean, f: number) {
  const W = pb.w, H = pb.h;
  // the sump: water at the foot (dry once the pump works the galleries)
  pb.ellipse(W / 2, H - 4, W / 2 - 2, 4, C.ink);
  pb.ellipse(W / 2, H - 4, W / 2 - 4, 2.5, on ? C.slate : C.river);
  if (!on) { pb.set(W / 2 - 4, H - 5, C.sky); pb.set(W / 2 + 3, H - 4, C.sky); }
  // the cylinder and the A-frame
  pb.rect(W / 2 - 5, 18, 10, H - 24, C.slate); pb.rect(W / 2 - 5, 18, 3, H - 24, C.stone); pb.rect(W / 2 - 6, 18, 12, 2, C.ink);
  rivets(pb, W / 2 - 4, 22, W / 2 + 4, 3, C.pebble);
  pb.line(4, H - 6, W / 2, 8, C.walnut); pb.line(5, H - 6, W / 2 + 1, 8, C.oak);
  pb.line(W - 4, H - 6, W / 2, 8, C.walnut);
  // the rocking beam (it nods while the pump runs)
  const tilt = on ? (f ? 3 : -3) : 4;
  pb.line(2, 8 + tilt, W - 2, 8 - tilt, C.bark); pb.line(2, 9 + tilt, W - 2, 9 - tilt, C.walnut);
  pb.disc(W / 2, 8, 2, C.brass);
  pb.rect(W - 4, 8 - tilt, 2, 12, C.slate);
  // a pipe up the wall
  pb.rect(W / 2 + 6, 2, 3, 20, C.slate); pb.rect(W / 2 + 6, 2, 1, 20, C.stone);
  if (!on) rust(pb, W / 2 - 5, 18, 10, H - 24, 5, 0.22);
}

function drawLampworks(pb: PixBuf, on: boolean, f: number) {
  const W = pb.w, H = pb.h;
  // the bench
  pb.rect(1, H - 16, W - 2, 4, C.walnut); pb.rect(1, H - 16, W - 2, 1, C.oak);
  pb.rect(3, H - 12, 3, 12, C.bark); pb.rect(W - 6, H - 12, 3, 12, C.bark);
  // glass globes with coils inside: dead and dim, the odd one still glimmering
  for (let k = 0; k < 4; k++) {
    const x = 9 + k * 11, y = H - 24;
    pb.disc(x, y, 5, C.ink); pb.disc(x, y, 4, k === 2 ? C.aqua : C.deepsea);
    pb.line(x - 2, y + 2, x + 2, y - 2, k === 2 ? C.frost : C.slate);
    pb.set(x - 2, y - 2, C.frost);
    pb.rect(x - 2, y + 4, 5, 2, C.brass);
  }
  // the dynamo with its crank, wires to the globes
  pb.rect(W - 14, H - 34, 12, 10, C.slate); pb.disc(W - 8, H - 29, 3.5, C.copper); pb.disc(W - 8, H - 29, 1.5, C.ink);
  pb.line(W - 2, H - 29, W - 1, H - 36, C.stone);
  pb.line(W - 14, H - 30, 9, H - 30, C.copper);
  for (let x = 9; x < W - 14; x += 11) pb.rect(x, H - 30, 1, 2, C.copper);
  // spare coils in a crate
  pb.rect(8, H - 10, 12, 8, C.oak); pb.line(8, H - 10, 19, H - 3, C.walnut);
  if (on || f) pb.set(31, H - 26, C.cream);
  rust(pb, W - 14, H - 34, 12, 10, 3, 0.15);
}

function drawLockers(pb: PixBuf, _on: boolean, _f: number) {
  const W = pb.w, H = pb.h;
  for (let k = 0; k < 3; k++) {
    const x = 1 + k * 16, open = k === 1;
    pb.rect(x, 4, 15, H - 4, C.ink);
    pb.rect(x + 1, 5, 13, H - 6, open ? C.plum : C.sage);
    if (open) {
      // rolled blueprints on the shelf, the door hanging ajar
      pb.rect(x + 2, 12, 11, 1, C.oak);
      for (let r = 0; r < 3; r++) { pb.rect(x + 3 + r * 3, 8, 2, 4, r === 1 ? C.sky : C.cream); pb.set(x + 3 + r * 3, 8, C.river); }
      pb.rect(x + 3, 16, 9, 6, C.cream); pb.line(x + 4, 18, x + 10, 18, C.river); pb.line(x + 4, 20, x + 8, 20, C.river);
      pb.rect(x + 14, 6, 3, H - 8, C.fern); pb.rect(x + 14, 6, 1, H - 8, C.sage);
    } else {
      for (let y = 8; y < 16; y += 2) pb.rect(x + 4, y, 7, 1, C.fern);
      pb.rect(x + 11, H / 2, 2, 4, C.brass);
      pb.rect(x + 2, 5, 11, 1, LIGHT[C.sage]);
    }
  }
  pb.rect(0, 2, W, 3, C.slate);
  rust(pb, 0, 4, W, H - 4, 9, 0.1);
}

function drawCart(pb: PixBuf, on: boolean, _f: number) {
  const W = pb.w, H = pb.h;
  // two rails and their sleepers
  for (let x = 0; x < W; x += 6) pb.rect(x, H - 5, 4, 5, on ? C.oak : C.walnut);
  pb.rect(0, H - 4, W, 1, C.stone); pb.rect(0, H - 1, W, 1, C.stone);
  // the tub
  pb.rect(5, H - 22, W - 10, 14, C.ink);
  pb.rect(6, H - 21, W - 12, 12, on ? C.oak : C.walnut);
  for (let y = H - 18; y < H - 9; y += 4) pb.rect(6, y, W - 12, 1, on ? C.walnut : C.bark);
  pb.rect(5, H - 22, W - 10, 2, on ? C.brass : C.slate);
  pb.rect(5, H - 10, W - 10, 2, on ? C.brass : C.slate);
  // wheels
  for (const x of [11, W - 11]) { pb.disc(x, H - 6, 3.5, C.ink); pb.disc(x, H - 6, 2.5, on ? C.stone : C.slate); pb.set(x, H - 6, C.ink); }
  if (!on) { rust(pb, 5, H - 22, W - 10, 14, 13, 0.2); pb.rect(14, H - 21, 3, 3, C.ink); }
  else pb.rect(7, H - 21, W - 14, 1, C.tan);
}

function drawStar(pb: PixBuf, _on: boolean, f: number) {
  const W = pb.w, H = pb.h;
  // the crater it made
  pb.ellipse(W / 2, H - 7, W / 2 - 1, 7, C.ink);
  pb.ellipse(W / 2, H - 7, W / 2 - 3, 5, C.plum);
  pb.ellipse(W / 2, H - 8, W / 2 - 7, 3, C.bark);
  // the star: a jagged lump of starmetal, warm and humming
  const cx = W / 2, cy = H - 17;
  pb.ellipse(cx, cy, 9, 8, C.violet);
  pb.ellipse(cx - 1, cy - 1, 7, 6, C.lavender);
  pb.ellipse(cx - 2, cy - 2, 4, 3, LIGHT[C.lavender]);
  for (const [dx, dy] of [[-9, -2], [8, -4], [0, -9], [-5, 6], [6, 5]]) pb.line(cx, cy, cx + dx, cy + dy, C.violet);
  pb.set(cx - 3, cy - 3, C.cream); pb.set(cx - 2, cy - 4, C.cream);
  // twinkles
  const tw = [[4, 6], [W - 6, 10], [8, H - 16], [W - 9, H - 20], [W / 2 + 3, 2]];
  tw.forEach(([x, y], k) => { if ((k + f) % 2 === 0) { pb.set(x, y, C.gold); pb.set(x - 1, y, C.amber); pb.set(x + 1, y, C.amber); pb.set(x, y - 1, C.amber); pb.set(x, y + 1, C.amber); } });
}

const DRAW: Record<string, (pb: PixBuf, on: boolean, f: number) => void> = {
  lift: drawLift, boiler: drawBoiler, pump: drawPump, lampworks: drawLampworks, lockers: drawLockers, cart: drawCart, star: drawStar,
};

/** the doorway of a works problem: 0 collapsed gallery, 1 shored, 2 flooded stair, 3 drained stair (16x16) */
export function drawGallery(pb: PixBuf, v: number) {
  if (v === 0) {
    // a heap of fallen rock and snapped timbers against a dark mouth
    pb.rect(2, 0, 12, 10, C.ink);
    pb.line(1, 2, 14, 9, C.walnut); pb.line(1, 3, 14, 10, C.oak);
    pb.line(13, 1, 4, 11, C.walnut);
    for (const [x, y, r, c] of [[4, 12, 3.2, C.stone], [10, 12, 3.6, C.slate], [7, 9, 3, C.pebble], [12, 8, 2.2, C.stone], [3, 8, 2, C.slate]] as const) pb.disc(x, y, r, c);
    pb.set(6, 8, C.frost); pb.set(9, 11, C.pebble);
    pb.outline(C.ink);
    return;
  }
  // a timber-framed mouth with steps going down
  pb.rect(3, 1, 10, 15, C.ink);
  for (let k = 0; k < 4; k++) pb.rect(4, 4 + k * 3, 8, 1, v === 2 ? C.slate : k % 2 ? C.slate : C.stone);
  if (v === 2) {
    // the flood: water to the top step
    pb.rect(4, 6, 8, 10, C.river);
    for (let x = 4; x < 12; x += 2) pb.set(x, 6, C.sky);
    pb.set(6, 9, C.aqua); pb.set(9, 12, C.aqua);
  } else if (v === 3) for (let x = 5; x < 11; x += 3) pb.set(x, 11, C.river);
  pb.rect(1, 0, 3, 16, C.walnut); pb.rect(12, 0, 3, 16, C.walnut);
  pb.rect(2, 0, 1, 16, C.oak); pb.rect(13, 0, 1, 16, C.oak);
  pb.rect(0, 0, 16, 3, C.bark); pb.rect(0, 0, 16, 1, C.walnut);
  if (v === 1) { pb.rect(1, 6, 14, 2, C.oak); pb.rect(1, 6, 14, 1, C.tan); }
  pb.outline(C.ink);
}

export function registerDeepSprites() {
  defSpriteFamily('deep:', (name) => {
    const [, kind, on, fs] = name.split(':');
    const sz = SIZE[kind], draw = DRAW[kind];
    if (!sz || !draw) return null;
    const [w, h, pad] = sz;
    return {
      w, h, ox: pad, oy: h,
      draw: (ctx) => {
        const pb = new PixBuf(w, h);
        draw(pb, on === '1', +(fs ?? 0));
        pb.outline(C.ink);
        pb.drawTo(ctx);
      },
    };
  });
  void FOOT;
}

/** how many animation frames a machine's sprite has (restored or not); the imported sheet
 *  (art/deep/build.mjs) draws a 4-frame working loop, the derelict lamp works' glimmer and the
 *  lockers' hanging lamp in 2, the star's twinkle in 4 */
export function deepFrames(kind: string, on: boolean): number {
  if (kind === 'star') return 4;
  if (kind === 'lockers') return 2;
  if (kind === 'lampworks') return on ? 4 : 2;
  return on && (kind === 'pump' || kind === 'lift' || kind === 'boiler' || kind === 'cart') ? 4 : 1;
}
