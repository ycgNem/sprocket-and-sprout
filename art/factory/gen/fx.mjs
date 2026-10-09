// Animation effects for machine frames. Each effect edits a copy of the base art for one frame.
// Frame -1 is the "off" frame; 0..3 are the working frames. All colors are palette colors.
import { Img, INK } from './lib.mjs';

const h2 = (a, b, c = 0) => { let x = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

// fire ramp, dark -> bright; ember ramp for the cold state
export const FIRE = ['#6e2727', '#b33831', '#ea4f36', '#fb6b1d', '#f79617', '#f9c22b', '#fbff86'];
export const EMBER = { '#fbff86': '#7a3045', '#f9c22b': '#7a3045', '#fbb954': '#7a3045', '#f79617': '#6e2727', '#fb6b1d': '#6e2727', '#ea4f36': '#45293f', '#f57d4a': '#6e2727', '#e6904e': '#7a3045', '#b33831': '#45293f', '#fca790': '#7a3045', '#fdcbb0': '#9e4539' };
const GLOW = ['#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'];

function inRect(x, y, r) { return x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]; }

/** pixels of the given colors inside a rect */
function pick(im, rect, colors) {
  const set = new Set(colors), out = [];
  for (let y = rect[1]; y < rect[1] + rect[3]; y++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) { const c = im.get(x, y); if (c && set.has(c)) out.push([x, y, c]); }
  return out;
}

export const FX = {
  /** fire or furnace mouth: off = embers, on = flickering brightness per pixel */
  fire(im, f, { rect, colors = FIRE.concat(['#fbb954', '#f57d4a', '#e6904e', '#fca790', '#fdcbb0']), ember = EMBER }, base) {
    const px = pick(base, rect, colors);
    for (const [x, y, c] of px) {
      if (f < 0) { im.set(x, y, ember[c] ?? '#45293f'); continue; }
      let k = FIRE.indexOf(c);
      if (k < 0) k = c === '#fbb954' ? 5 : c === '#f57d4a' || c === '#e6904e' ? 3 : c === '#fca790' || c === '#fdcbb0' ? 6 : 3;
      const d = Math.round((h2(x, y, f) - 0.5) * 2.2) + (f % 2 ? 1 : 0) - (y < rect[1] + rect[3] / 2 && f === 3 ? 1 : 0);
      im.set(x, y, FIRE[Math.max(1, Math.min(FIRE.length - 1, k + d))]);
    }
  },
  /** extra flame tips licking above a fire line (y = top row of the mouth) */
  flames(im, f, { x0, x1, y }) {
    if (f < 0) return;
    for (let x = x0; x <= x1; x++) {
      const hgt = Math.floor(h2(x, f, 7) * 3);
      for (let k = 0; k < hgt; k++) if (im.get(x, y - k)) im.set(x, y - k, k === hgt - 1 ? '#f9c22b' : '#fb6b1d');
    }
  },
  /** glass or lamp: off = dark glass, on = glow, pulsing a little */
  light(im, f, { rect, colors, off = {} }, base) {
    const px = pick(base, rect, colors);
    for (const [x, y, c] of px) {
      if (f < 0) { im.set(x, y, off[c] ?? '#45293f'); continue; }
      const k = Math.max(0, GLOW.indexOf(c));
      const d = f === 1 || f === 2 ? 1 : 0;
      im.set(x, y, GLOW[Math.min(GLOW.length - 1, k + d)]);
    }
  },
  /** paint fixed pixels: { px: [[x, y, color], …], frames: [-1, 0, 1, 2, 3] } */
  paint(im, f, { px, frames }) {
    if (frames && !frames.includes(f)) return;
    for (const [x, y, c] of px) im.set(x, y, c);
  },
  /** indicator lamps: alternate between lit colors on working frames, dark when off */
  blink(im, f, { px, on = ['#fbff86', '#f79617'], off = '#45293f' }) {
    px.forEach(([x, y], i) => im.set(x, y, f < 0 ? off : on[(f + i) % on.length]));
  },
  /** move a rectangular part by dy[f] (dx[f]); the uncovered pixels are filled from `fill`, or with
   *  `fill: 'edge'` from the base row/column just outside the rect (continues cloth or a wall behind) */
  move(im, f, { rect, dy = [0, 0, 0, 0], dx = [0, 0, 0, 0], fill = null }, base) {
    if (f < 0) return;
    const oy = dy[f], ox = dx[f];
    if (!oy && !ox) return;
    const part = base.crop(rect[0], rect[1], rect[2], rect[3]);
    for (let y = rect[1]; y < rect[1] + rect[3]; y++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) {
      let c = fill === 'edge' ? null : fill;
      if (fill === 'edge') c = oy > 0 ? base.get(x, rect[1] - 1) : oy < 0 ? base.get(x, rect[1] + rect[3]) : ox > 0 ? base.get(rect[0] - 1, y) : base.get(rect[0] + rect[2], y);
      im.set(x, y, c);
    }
    im.draw(part, rect[0] + ox, rect[1] + oy);
  },
  /** cycle the colors inside a rect along an axis (screw or globe turning); the silhouette stays */
  scroll(im, f, { rect, axis = 'y', step = 1 }, base) {
    if (f < 0) return;
    const [x0, y0, w, h] = rect;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = base.get(x, y);
      if (!t || t === '#2e222f') continue;
      let sx = x, sy = y;
      if (axis === 'y') sy = y0 + ((((y - y0 - f * step) % h) + h) % h); else sx = x0 + ((((x - x0 - f * step) % w) + w) % w);
      const c = base.get(sx, sy);
      if (c && c !== '#2e222f') im.set(x, y, c);
    }
  },
  /** spokes turning inside a round part: redraw the disc interior with n spokes rotated per frame */
  spin(im, f, { cx, cy, r, spoke, fillC, hub, n = 4, inner = 1.2, turn = 1 }) {
    const a0 = f < 0 ? 0 : (f * turn * Math.PI) / (2 * n);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > r) continue;
        if (d < inner) { im.set(x, y, hub); continue; }
        const a = Math.atan2(dy, dx) - a0;
        const per = (Math.PI * 2) / n;
        const m = ((a % per) + per) % per;
        const w = 0.55 / Math.max(1, d);
        im.set(x, y, m < w + 0.18 || m > per - w - 0.18 ? spoke : fillC);
      }
  },
  /** teeth around a gear rim: n teeth of color c at radius r, rotating with the frame */
  teeth(im, f, { cx, cy, r, n = 8, c, bg = null, step = 1 }) {
    const a0 = f < 0 ? 0 : (f * step * Math.PI) / n / 2;
    // clear the tooth ring first so old teeth don't stay
    if (bg) for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * r - 0.5), y = Math.round(cy + Math.sin(a) * r - 0.5); if (im.get(x, y)) im.set(x, y, bg); }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + a0;
      im.set(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), c);
    }
  },
  /** a glint that travels across a glass/lens rect diagonally */
  glint(im, f, { rect, c = '#fbff86', c2 = '#fdcbb0' }) {
    if (f < 0) return;
    const t = f / 3;
    const x = Math.round(rect[0] + t * (rect[2] - 1)), y = Math.round(rect[1] + t * (rect[3] - 1));
    if (im.get(x, y)) im.set(x, y, c);
    if (im.get(x + 1, y)) im.set(x + 1, y, c2);
    if (im.get(x, y + 1)) im.set(x, y + 1, c2);
  },
  /** a small puff of steam drifting up from (x, y) over the 4 frames (inside the frame) */
  steam(im, f, { x, y, c = '#fdcbb0', c2 = '#ab947a' }) {
    if (f < 0) return;
    const P = [[[0, 0]], [[0, -1], [1, -1], [0, -2]], [[0, -3], [1, -3], [-1, -3], [0, -4]], [[1, -5], [0, -5]]][f];
    for (const [dx, dy] of P) im.set(x + dx, y + dy, dy === P[0][1] && f > 1 ? c2 : c);
  },
  /** recolor a set of colors inside a rect (e.g. jam darkening while it ferments) */
  recolor(im, f, { rect, map, frames }) {
    if (frames && !frames.includes(f)) return;
    for (let y = rect[1]; y < rect[1] + rect[3]; y++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) { const c = im.get(x, y); if (c && map[c]) im.set(x, y, map[c]); }
  },
  /** windmill sails: 4 lattice blades around (cx, cy), turning 22.5 degrees a frame (off: still at 45) */
  sails(im, f, { cx, cy, r = 15, w = 4.6, cloth = ['#fdcbb0', '#e6904e', '#cd683d'], spar = '#7a3045' }) {
    const a0 = f < 0 ? Math.PI / 4 : (f * Math.PI) / 8;
    const layer = new Img(im.w, im.h);
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i * Math.PI) / 2;
          const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
          if (u < 0 || u > r) continue;
          if (Math.abs(v) <= 0.75) { layer.set(x, y, spar); break; }
          if (u >= 3.5 && v > 0.75 && v <= w) {
            const lat = Math.floor(u) % 3 === 0 || v > w - 1;
            // cloth facing the light is paler: blades on the upper left half
            const lit = Math.cos(a) + Math.sin(a) < 0.3;
            layer.set(x, y, lat ? cloth[2] : lit ? cloth[0] : cloth[1]);
            break;
          }
        }
      }
    layer.outline();
    im.draw(layer);
    // brass hub
    for (const [x, y, c] of [[0, 0, '#f9c22b'], [-1, 0, '#f79617'], [0, -1, '#fbff86'], [-1, -1, '#f9c22b'], [-1, 1, '#cd683d'], [0, 1, '#cd683d'], [1, 0, '#cd683d'], [1, -1, '#f79617'], [-2, 0, '#2e222f'], [1, 1, '#9e4539']]) im.set(Math.floor(cx) + x, Math.floor(cy) + y, c);
  },
  /** fill the dark pixels of an opening (colors) with flickering fire on working frames */
  glowfill(im, f, { rect, colors = ['#2e222f', '#45293f'], off = null }, base) {
    const px = pick(base, rect, colors);
    for (const [x, y] of px) {
      if (f < 0) { if (off) im.set(x, y, off); continue; }
      // brighter toward the bottom of the opening, flickering per pixel
      const depth = (y - rect[1]) / Math.max(1, rect[3] - 1);
      const k = Math.round(2 + depth * 3 + (h2(x, y, f) - 0.5) * 2.4);
      im.set(x, y, FIRE[Math.max(1, Math.min(FIRE.length - 1, k))]);
    }
  },
  /** a few bees (dark + gold pixels) buzzing around (cx, cy) on working frames */
  bees(im, f, { pts }) {
    if (f < 0) return;
    for (const p of pts) {
      const [x, y] = p[f % p.length];
      im.set(x, y, '#2e222f'); im.set(x + 1, y, '#f9c22b');
    }
  },
  /** a drop falling from (x, y0) one step per frame */
  drip(im, f, { x, y0, c = '#fbb954', c2 = '#e6904e', len = 4 }) {
    if (f < 0) return;
    const y = y0 + f;
    if (f < len) { im.set(x, y, c); if (f > 0) im.set(x, y - 1, c2); }
  },
  /** mist droplets spraying from a nozzle at (cx, cy) on working frames */
  mist(im, f, { cx, cy, c = '#8fd3ff', c2 = '#c7dcd0' }) {
    if (f < 0) return;
    const P = [
      [[-2, -1], [2, -1], [-3, 0], [3, 0]],
      [[-3, -2], [3, -2], [-4, 0], [4, 0], [0, -2]],
      [[-4, -1], [4, -1], [-2, -3], [2, -3], [-5, 1], [5, 1]],
      [[-5, 0], [5, 0], [-3, -3], [3, -3], [0, -3]],
    ][f];
    P.forEach(([dx, dy], i) => im.set(cx + dx, cy + dy, i % 2 ? c2 : c));
  },
  /** bubbles rising inside a liquid rect */
  bubbles(im, f, { rect, c = '#fdcbb0', n = 3 }, base) {
    if (f < 0) return;
    for (let i = 0; i < n; i++) {
      const bx = rect[0] + Math.floor(h2(i, 3, 9) * rect[2]);
      const by = rect[1] + rect[3] - 1 - ((Math.floor(h2(i, 5, 1) * rect[3]) + f * 2) % rect[3]);
      if (base.get(bx, by)) im.set(bx, by, c);
    }
  },
};

/** Build the off frame and 4 working frames from a base image and a list of effects. */
export function animate(base, fx = []) {
  const frames = [];
  for (const f of [-1, 0, 1, 2, 3]) {
    const im = base.clone();
    for (const e of fx) FX[e.t](im, f, e, base);
    frames.push(im);
  }
  return { off: frames[0], on: frames.slice(1) };
}

export { h2, INK, Img, inRect };
