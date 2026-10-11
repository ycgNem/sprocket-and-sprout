// The field gantry's turning wheels (ROADMAP 4.11: "the gantry's wheels turn on the rail"), drawn
// by rule into the bridge frames gantry:beam:<axis>:<f> by art/fieldworks/build.mjs. Only the
// wheels change between frames; frame 0 is the idle pose. Frame order is the roll toward +x
// (axis 1, the bridge riding east) and +y (axis 0, riding south); play it backwards the other way.
//
// axis 1 (the bridge spans north-south and rides east-west rails): the wheels are seen from the side,
//   one flanged iron wheel per leg foot, 7 px across, on the near rail; three spokes turn 30 degrees
//   a frame (one spoke period in four frames, so the loop is seamless) round a brass hub.
// axis 0 (the bridge spans east-west and rides north-south rails): the wheels are seen edge-on from
//   the south, a 2 px iron tread on each rail line with its flange on the inside of the track; a
//   dark seam on the tread rolls down a row a frame (four rows, one turn of the loop).
import { Img, INK, BRASS, IRON } from '../factory/gen/lib.mjs';

// ---------------------------------------------------------------- side view (axis 1)
const R = 3.5; // the disc: pixel centres within R of the centre (3.5, 3.5) of a 7x7 box
const inDisc = (x, y) => Math.hypot(x + 0.5 - 3.5, y + 0.5 - 3.5) <= R - 0.25;
/** a 7x7 side-view wheel at frame f: iron tyre lit upper left, dark web, brass spokes, brass hub */
export function sideWheel(f, { spokes = 3, spoke = BRASS[2], web = IRON[0] } = {}) {
  const im = new Img(7, 7);
  const rim = (x, y) => inDisc(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inDisc(x + dx, y + dy));
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    if (!inDisc(x, y)) continue;
    if (rim(x, y)) {
      // tyre: lit on the upper left, shaded lower right (light from the upper left)
      const t = (x - 3) + (y - 3);
      im.set(x, y, t < -2 ? IRON[3] : t < 1 ? IRON[2] : IRON[1]);
    } else im.set(x, y, web); // the dark between the spokes
  }
  // spokes: clockwise 360/spokes/4 degrees a frame; frame 0 has one spoke straight up
  const step = 360 / spokes / 4;
  for (let k = 0; k < spokes; k++) {
    const a = ((-90 + f * step + (k * 360) / spokes) * Math.PI) / 180;
    for (let s = 0.9; s <= 2.6; s += 0.25) {
      const x = Math.floor(3.5 + Math.cos(a) * s), y = Math.floor(3.5 + Math.sin(a) * s);
      if (inDisc(x, y) && !rim(x, y)) im.set(x, y, spoke);
    }
  }
  im.set(3, 3, BRASS[4]); // hub
  return im;
}

// ---------------------------------------------------------------- edge-on (axis 0)
/** a tread 2 px wide, `h` rows tall, flange on the `inner` side ('l' or 'r'): 3 x h image */
export function edgeWheel(f, inner, h = 4) {
  const im = new Img(3, h);
  const tx = inner === 'r' ? 0 : 1; // tread columns tx, tx+1; flange beside them on the inner side
  const fx = inner === 'r' ? 2 : 0;
  for (let y = 0; y < h; y++) {
    // the tread: dark iron, the top row catching the light; the left column lit (light from the left)
    im.set(tx, y, y === 0 ? IRON[2] : IRON[1]); im.set(tx + 1, y, y === 0 ? IRON[1] : IRON[0]);
    // a bright rib on the tread rolls down a row a frame
    if (y === f % h) { im.set(tx, y, IRON[3]); im.set(tx + 1, y, IRON[2]); }
    im.set(fx, y, IRON[0]); // the flange, beside the tread on the inside of the track
  }
  return im;
}

/** review image: every frame of each design at x12 on rails */
export function reviewStrip() {
  const items = [];
  for (const spokes of [3, 4]) for (let f = 0; f < 4; f++) items.push(sideWheel(f, { spokes }).clone().outline(INK));
  for (let f = 0; f < 4; f++) items.push(sideWheel(f, { spokes: 4, spoke: IRON[3] }).clone().outline(INK));
  for (let f = 0; f < 4; f++) {
    const im = new Img(9, 6);
    im.draw(edgeWheel(f, 'r'), 0, 0); im.draw(edgeWheel(f, 'l'), 5, 0);
    items.push(im);
  }
  return items;
}
