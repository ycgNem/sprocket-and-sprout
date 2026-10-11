// Procedural art for the town keystones (ROADMAP.md 7.5): the Town Mill and its wheel, the
// Waterworks' pump house, the square's fountain and twelve lamps, the tram's cart, track, stops and
// bin, and the town line's post at the farm gate. Resurrect 64 indices and STYLE.md's material
// ramps (light from the upper left, plum outline, no pure black); imported sheets can replace any
// of these by name later (the `town:` family, and `st:tram_bin:*`).
import { hash2 } from '../../engine/rng';
import { defSprite, defSpriteFamily } from '../atlas';
import { PixBuf } from './pixbuf';

// ---------- palette (indices into src/data/palette.ts) ----------
const INK = 0, SH = 49;
const WOOD = { s: 49, d: 19, m: 20, b: 21, l: 22 };
const BRASS = { d: 20, m: 21, b: 17, l: 18, h: 28 };
const COPPER = { d: 10, m: 11, b: 12, l: 13, h: 62 };
const STONE = { s: 1, d: 2, m: 3, b: 4, l: 8 };
const PLASTER = { d: 37, b: 38, l: 8 };
const ROOF = { s: 49, d: 54, m: 55, b: 56, l: 57 };
const SLATE = { s: 1, d: 5, m: 6, b: 7, l: 8 };
const WATER = { dd: 44, d: 45, m: 46, b: 47, l: 48, w: 9 };
const GLOW = { a: 23, g: 18, y: 28, p: 63 };
const MOSS = { d: 25, m: 26, l: 33 };
const LEAF = { d: 29, m: 30, b: 31, l: 32 };
const BRONZE = { d: 34, m: 35, b: 36, l: 37 };
const SNOW = { b: 8, l: 9 };
const FLOUR = { b: 4, l: 63 };

/** A palette-index pixel buffer (-1 = clear): shading and outlines can read what's under them. */
class Px {
  a: Int16Array;
  constructor(public w: number, public h: number) {
    this.a = new Int16Array(w * h).fill(-1);
  }
  set(x: number, y: number, c: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.a[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.a[y * this.w + x];
  }
  clear(x: number, y: number) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = -1;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  disc(cx: number, cy: number, r: number, c: number) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number | ((x: number, y: number, t: number) => number)) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const t = dx * dx + dy * dy;
        if (t <= 1) this.set(x, y, typeof c === 'number' ? c : c(x, y, t));
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, th = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    const o = (th - 1) / 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (let k = 0; k < th; k++) for (let j = 0; j < th; j++) this.set(Math.round(x - o + j), Math.round(y - o + k), c);
    }
  }
  /** STYLE.md's selective outline: plum-black on the bottom and right, the deep shade on the top and left */
  outline(top = SH, bottom = INK) {
    const src = this.a.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] >= 0) continue;
        if (at(x - 1, y) >= 0 || at(x, y - 1) >= 0) this.set(x, y, bottom);
        else if (at(x + 1, y) >= 0 || at(x, y + 1) >= 0) this.set(x, y, top);
      }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const pb = new PixBuf(this.w, this.h);
    for (let i = 0; i < this.a.length; i++) if (this.a[i] >= 0) pb.set(i % this.w, Math.floor(i / this.w), this.a[i]);
    pb.drawTo(ctx);
  }
}

// ---------- shared pieces ----------
/** a shingled roof slope from the ridge (y0, x xl0..xr0) to the eaves (y1, x xl1..xr1) */
function shingles(p: Px, xl0: number, xr0: number, y0: number, xl1: number, xr1: number, y1: number, r: typeof ROOF, seed: number, snow: boolean) {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const xl = Math.round(xl0 + (xl1 - xl0) * t), xr = Math.round(xr0 + (xr1 - xr0) * t);
    const row = Math.floor((y - y0) / 5), ry = (y - y0) % 5;
    for (let x = xl; x <= xr; x++) {
      const sx = (x + (row % 2 ? 3 : 0) + 600) % 7;
      let c = r.b;
      if (ry === 4) c = r.d;
      else if (sx === 0) c = r.m;
      else if (ry === 0 && sx === 1) c = r.l;
      else if (ry === 3) c = r.m;
      else if (hash2(x, y, seed) < 0.05) c = r.m;
      // the sun from the upper left: the right end of the slope a shade down, the eave row in shadow
      if (x > xl + (xr - xl) * 0.8 && c === r.b) c = r.m;
      if (y === y1) c = r.s;
      // winter: the slope under snow (as the town's other roofs), the courses showing faintly through
      if (snow) {
        c = ry === 4 && hash2(x, row, seed + 3) < 0.55 ? SNOW.b : hash2(x, y, seed + 5) < 0.05 ? SNOW.b : SNOW.l;
        if (x > xl + (xr - xl) * 0.8 && hash2(x, y, seed + 7) < 0.6) c = SNOW.b;
        if (y === y1) c = hash2(x, 1, seed) < 0.3 ? r.s : SNOW.b;
      }
      p.set(x, y, c);
    }
    // the hip ends' edges
    p.set(xl, y, r.d);
    p.set(xr, y, r.s);
  }
}

/** irregular fieldstone (light top-left edges, dark mortar) */
function fieldstone(p: Px, x0: number, y0: number, w: number, h: number, seed: number, mossy = false) {
  p.rect(x0, y0, w, h, STONE.d);
  let y = y0;
  let row = 0;
  while (y < y0 + h) {
    const sh = 4 + Math.floor(hash2(row, 7, seed) * 2);
    let x = x0 - Math.floor(hash2(row, 3, seed) * 5);
    let k = 0;
    while (x < x0 + w) {
      const sw = 5 + Math.floor(hash2(k, row, seed) * 5);
      const tone = hash2(k, row, seed + 1);
      const base = tone < 0.25 ? STONE.m : tone < 0.85 ? STONE.b : STONE.l;
      for (let yy = y; yy < Math.min(y + sh - 1, y0 + h); yy++)
        for (let xx = Math.max(x, x0); xx < Math.min(x + sw - 1, x0 + w); xx++) {
          let c = base;
          if (yy === y || xx === x) c = base === STONE.l ? STONE.l : base === STONE.b ? STONE.l : STONE.b;
          if (yy === y + sh - 2 || xx === x + sw - 2) c = STONE.m;
          if (mossy && yy === y && hash2(xx, yy, seed + 9) < 0.18) c = MOSS.d;
          p.set(xx, yy, c);
        }
      x += sw;
      k++;
    }
    y += sh;
    row++;
  }
}

/** red brick in running bond with taupe mortar */
function brick(p: Px, x0: number, y0: number, w: number, h: number, seed: number) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor((y - y0) / 4), ry = (y - y0) % 4;
      const bx = (x - x0 + (row % 2 ? 4 : 0)) % 8;
      const id = Math.floor((x - x0 + (row % 2 ? 4 : 0)) / 8);
      let c = hash2(id, row, seed) < 0.3 ? WOOD.m : COPPER.m;
      if (ry === 3 || bx === 7) c = STONE.m;
      else if (ry === 0 && bx < 6) c = c === WOOD.m ? WOOD.b : COPPER.b;
      p.set(x, y, c);
    }
}

/** a framed window: lit (warm), dark, or day glass */
function windowPane(p: Px, x: number, y: number, w: number, h: number, mode: 'day' | 'lit' | 'dark', frame = WOOD.d) {
  p.rect(x, y, w, h, frame);
  const g = mode === 'lit' ? [GLOW.a, GLOW.g, GLOW.y] : mode === 'dark' ? [WATER.dd, WATER.dd, WATER.d] : [WATER.m, WATER.b, WATER.l];
  p.rect(x + 1, y + 1, w - 2, h - 2, g[0]);
  p.rect(x + 1, y + 1, w - 2, Math.ceil((h - 2) / 2), g[1]);
  p.set(x + 1, y + 1, g[2]);
  p.set(x + 2, y + 1, g[2]);
  p.set(x + 1, y + 2, g[2]);
  // mullions
  p.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, frame);
  p.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, frame);
  // sill
  p.rect(x - 1, y + h, w + 2, 1, WOOD.b);
}

/** plank shutters closed over a window */
function shutters(p: Px, x: number, y: number, w: number, h: number) {
  p.rect(x, y, w, h, WOOD.d);
  for (let xx = x + 1; xx < x + w - 1; xx += 3) p.rect(xx, y + 1, 2, h - 2, WOOD.m);
  p.line(x + 1, y + h - 2, x + w - 2, y + 1, WOOD.b);
  p.rect(x - 1, y + h, w + 2, 1, WOOD.b);
}

/** a cream flour sack (tied at the top) with its bottom at (x, y) */
function sack(p: Px, x: number, y: number) {
  p.ellipse(x + 3.5, y - 3.5, 3.5, 3.5, (xx, yy) => (xx > x + 4 || yy > y - 2 ? FLOUR.b : FLOUR.l));
  p.rect(x + 2, y - 8, 3, 2, FLOUR.b);
  p.set(x + 3, y - 9, WOOD.d);
  p.set(x + 2, y - 4, WOOD.b);
}

// ---------- the Town Mill ----------
export const MILL_TOP = 44;
/** the mill's house: town:mill:<season>:<state 0 silent, 1 running, 2 running at night> (112 x 140) */
function drawMill(season: number, state: number): Px {
  const W = 112, T = MILL_TOP, H = 96 + T;
  const p = new Px(W, H);
  const run = state > 0, night = state === 2, snow = season === 3;
  const seed = 31;
  // ---- the main roof: rose shingles, hipped, with a ridge cap ----
  shingles(p, 13, 98, 9, 1, 110, 62, ROOF, seed, snow);
  p.rect(13, 8, 86, 2, ROOF.s);
  p.rect(14, 8, 84, 1, ROOF.d);
  // moss creeping over the silent mill's roof
  if (!run && !snow) for (let i = 0; i < 28; i++) {
    const x = 6 + Math.floor(hash2(i, 1, 77) * 98), y = 24 + Math.floor(hash2(1, i, 77) * 36);
    if (p.get(x, y) >= 0 && (x < 36 || x > 76)) { p.set(x, y, MOSS.d); if (hash2(i, 2, 77) < 0.5) p.set(x + 1, y, MOSS.m); }
  }
  // a brass weathervane on the ridge (a wheat ear and a cockerel tail)
  p.rect(85, 0, 1, 9, BRASS.d);
  p.rect(82, 2, 7, 1, BRASS.b);
  p.set(81, 1, BRASS.l); p.set(81, 2, BRASS.l); p.set(80, 1, BRASS.b);
  p.set(89, 3, BRASS.m); p.set(88, 1, BRASS.m);
  p.rect(84, 4, 3, 1, BRASS.m);
  // ---- the walls ----
  // lower storey: fieldstone; the foundation's big stones; upper storey: timber frame and plaster
  fieldstone(p, 3, 101, 106, 33, 41, !run);
  p.rect(2, 134, 108, 6, STONE.s);
  for (let x = 2; x < 110; x += 9) { p.rect(x, 134, 8, 5, STONE.d); p.rect(x, 134, 8, 1, STONE.m); }
  // upper storey
  p.rect(3, 63, 106, 34, PLASTER.b);
  for (let y = 64; y < 96; y++) for (let x = 3; x < 109; x++) if (hash2(x, y, 5) < 0.03) p.set(x, y, PLASTER.l);
  const beam = (x: number, y: number, w: number, h: number) => { p.rect(x, y, w, h, WOOD.d); p.rect(x, y, Math.max(1, w > h ? w : 1), 1, WOOD.m); };
  beam(3, 63, 106, 3); // wall plate under the eaves
  for (const x of [3, 21, 39, 72, 90, 106]) { p.rect(x, 63, 3, 34, WOOD.d); p.rect(x, 63, 1, 34, WOOD.m); }
  // braces in the outer panels
  p.line(7, 94, 19, 68, WOOD.d, 2);
  p.line(104, 94, 93, 68, WOOD.d, 2);
  // plaster shade under the plate and beside the posts
  for (let x = 4; x < 108; x++) if (p.get(x, 66) === PLASTER.b) p.set(x, 66, PLASTER.d);
  // upper windows
  windowPane(p, 25, 71, 12, 13, night ? 'lit' : run ? 'day' : 'dark');
  windowPane(p, 76, 71, 12, 13, night ? 'lit' : run ? 'day' : 'dark');
  if (!run) { p.line(25, 71, 36, 83, WOOD.m); p.line(76, 83, 87, 71, WOOD.m); }
  // the sill beam between the storeys
  p.rect(2, 97, 108, 4, WOOD.d);
  p.rect(2, 97, 108, 1, WOOD.b);
  p.rect(2, 100, 108, 1, WOOD.s);
  // the axle's bearing plate on the west wall, where the wheel's shaft comes in
  p.rect(3, 101, 8, 7, WOOD.d);
  p.rect(4, 102, 6, 5, WOOD.m);
  p.set(5, 103, BRASS.b); p.set(8, 103, BRASS.b); p.set(5, 105, BRASS.b); p.set(8, 105, BRASS.b);
  // lower windows (shuttered while the mill is silent)
  for (const wx of [15, 86]) {
    if (run) {
      windowPane(p, wx, 110, 11, 11, night ? 'lit' : 'day');
      p.rect(wx - 4, 110, 3, 11, WOOD.m); p.rect(wx + 12, 110, 3, 11, WOOD.m);
      p.rect(wx - 4, 110, 1, 11, WOOD.b); p.rect(wx + 14, 110, 1, 11, WOOD.d);
      // flour dust on the sill
      p.set(wx + 2, 121, FLOUR.l); p.set(wx + 7, 121, FLOUR.l);
    } else shutters(p, wx, 110, 11, 11);
  }
  // the great door under a stone arch (the door tile is the building's door)
  const dx = 48, dw = 16, dy = 109;
  p.ellipse(dx + dw / 2, dy + 1, dw / 2 + 3, 6, (x, y) => (y < dy - 2 ? STONE.l : STONE.b));
  p.rect(dx, dy, dw, 134 - dy, WOOD.d);
  p.ellipse(dx + dw / 2, dy + 1, dw / 2, 4, WOOD.d);
  for (let x = dx + 1; x < dx + dw - 1; x += 3) p.rect(x, dy - 1, 2, 135 - dy, x === dx + 7 ? WOOD.s : WOOD.m);
  p.rect(dx + 7, dy - 2, 1, 136 - dy, WOOD.s);
  for (const y of [dy + 4, dy + 16]) p.rect(dx + 1, y, dw - 2, 1, STONE.s);
  p.set(dx + 5, dy + 11, BRASS.l); p.set(dx + 10, dy + 11, BRASS.l);
  // a stone step
  p.rect(dx - 2, 134, dw + 4, 3, STONE.b);
  p.rect(dx - 2, 134, dw + 4, 1, STONE.l);
  // ---- the lucam: the sack-hoist gable over the door ----
  const lx = 40, lw = 32;
  p.rect(lx + 2, 40, lw - 4, 58, WOOD.m);
  for (let y = 42; y < 97; y += 3) p.rect(lx + 2, y, lw - 4, 1, WOOD.d);
  p.rect(lx + 2, 40, 1, 57, WOOD.b);
  p.rect(lx + lw - 3, 40, 1, 57, WOOD.s);
  // its gable roof
  for (let y = 0; y < 22; y++) {
    const half = Math.round(4 + y * 0.82);
    for (let x = lx + lw / 2 - half; x <= lx + lw / 2 + half; x++) {
      const row = Math.floor(y / 4), sx = (x + (row % 2 ? 2 : 0)) % 5;
      let c = y % 4 === 3 ? ROOF.d : sx === 0 ? ROOF.m : x < lx + lw / 2 ? ROOF.b : ROOF.m;
      if (y % 4 === 0 && sx === 1) c = ROOF.l;
      if (snow) c = (y % 4 === 3 && hash2(x, y, 4) < 0.55) || (x > lx + lw / 2 && hash2(x, y, 6) < 0.5) ? SNOW.b : SNOW.l;
      p.set(x, 19 + y, c);
    }
  }
  p.line(lx + lw / 2 - 4, 19, lx - 2, 41, ROOF.s);
  p.line(lx + lw / 2 + 4, 19, lx + lw + 2, 41, ROOF.s);
  p.rect(lx - 2, 41, lw + 4, 1, ROOF.s);
  // the hoist beam and its pulley under the gable's peak
  p.rect(lx + lw / 2 - 2, 15, 4, 7, WOOD.d);
  p.rect(lx + lw / 2 - 2, 15, 4, 1, WOOD.b);
  p.disc(lx + lw / 2, 22, 2.5, BRASS.m);
  p.set(lx + lw / 2 - 1, 21, BRASS.l);
  // the loading door: shut and barred while silent, open (a sack on the hook) when it runs
  const ldx = lx + 8, ldy = 46, ldw = 16, ldh = 24;
  if (run) {
    p.rect(ldx, ldy, ldw, ldh, INK);
    p.rect(ldx + 1, ldy + 1, ldw - 2, ldh - 1, SH);
    p.rect(ldx + 2, ldy + 14, ldw - 4, 9, WOOD.s);
    sack(p, ldx + 3, ldy + 23);
    sack(p, ldx + 8, ldy + 23);
    // one leaf swung open against the wall
    p.rect(ldx + ldw, ldy, 3, ldh, WOOD.b);
    p.rect(ldx + ldw + 2, ldy, 1, ldh, WOOD.d);
  } else {
    p.rect(ldx, ldy, ldw, ldh, WOOD.d);
    for (let x = ldx + 1; x < ldx + ldw - 1; x += 3) p.rect(x, ldy + 1, 2, ldh - 2, WOOD.m);
    p.line(ldx + 1, ldy + ldh - 2, ldx + ldw - 2, ldy + 2, WOOD.b);
    p.rect(ldx - 1, ldy + 10, ldw + 2, 2, WOOD.s);
  }
  // the rope from the pulley, and its hook (with a sack hanging when it runs)
  const rx = lx + lw / 2 + 2;
  p.rect(rx, 24, 1, run ? 50 : 30, STONE.b);
  if (run) {
    p.rect(rx - 1, 74, 3, 1, STONE.s);
    sack(p, rx - 3, 84);
  } else p.set(rx + 1, 54, STONE.s);
  // ---- the sign over the door: a golden wheat sheaf (hanging crooked while the mill is silent) ----
  const sy0 = 96;
  if (run) {
    p.rect(dx - 3, sy0, dw + 6, 7, WOOD.s);
    p.rect(dx - 2, sy0 + 1, dw + 4, 5, WOOD.l);
    p.rect(dx - 2, sy0 + 1, dw + 4, 1, BRASS.h);
  } else {
    for (let i = 0; i < dw + 6; i++) { const yy = sy0 + Math.floor(i / 7); p.rect(dx - 3 + i, yy, 1, 7, WOOD.s); p.rect(dx - 3 + i, yy + 1, 1, 5, WOOD.m); }
  }
  const sheaf = (cx: number, cy: number, c: number, c2: number) => {
    p.rect(cx, cy - 1, 1, 4, c2);
    p.set(cx - 1, cy - 2, c); p.set(cx + 1, cy - 2, c); p.set(cx, cy - 3, c); p.set(cx - 2, cy - 1, c); p.set(cx + 2, cy - 1, c);
    p.set(cx - 1, cy + 1, c2); p.set(cx + 1, cy + 1, c2);
  };
  if (run) sheaf(dx + dw / 2, sy0 + 3, BRASS.l, BRASS.b);
  else sheaf(dx + dw / 2, sy0 + 4, BRASS.m, BRASS.d);
  // sacks waiting by the door, and a little flour on the step, when it runs; weeds while silent
  if (run) {
    sack(p, 70, 134); sack(p, 75, 134); sack(p, 72, 128);
    p.set(dx + 3, 135, FLOUR.l); p.set(dx + 9, 136, FLOUR.l); p.set(dx + 12, 135, FLOUR.b);
  } else if (!snow) {
    for (const wx of [8, 30, 79, 101]) { p.set(wx, 133, LEAF.m); p.set(wx + 1, 132, LEAF.b); p.set(wx - 1, 132, LEAF.d); }
  }
  if (snow) for (let x = 4; x < 108; x++) if (hash2(x, 3, 9) < 0.7) p.set(x, 97, SNOW.l);
  p.outline();
  return p;
}

/**
 * The mill's wheel: town:wheel:<on>:<frame 0-3>, 72 x 72 with its hub at (36, 36). The river runs
 * under it: below the waterline (hub + 13) nothing is drawn but foam, so its own water shows. A
 * stone pier on its east side carries the axle to the mill's wall.
 */
export const WHEEL_SIZE = 72, WHEEL_HUB = 36, WHEEL_WATER = 13;
function drawWheel(on: boolean, f: number): Px {
  const S = WHEEL_SIZE, c = WHEEL_HUB, wl = c + WHEEL_WATER;
  const p = new Px(S, S);
  const rot = on ? (f * Math.PI) / 24 : 0.11;
  // the pier and the axle (behind the wheel's rim on the east side)
  for (let y = c - 4; y <= wl + 1; y++) for (let x = 62; x < S; x++) {
    const tone = hash2(Math.floor((x - 62) / 4), Math.floor(y / 3), 13);
    p.set(x, y, y === c - 4 ? STONE.l : (x - 62) % 4 === 3 || y % 3 === 2 ? STONE.d : tone < 0.5 ? STONE.b : STONE.m);
  }
  p.rect(62, c - 6, 10, 2, STONE.l);
  // the rim, the iron band and the inner ring
  const wheel = new Px(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy);
      const lit = dx + dy < -6, dark = dx + dy > 10;
      if (r >= 23.5 && r < 27.5) wheel.set(x, y, r < 24.5 ? WOOD.d : r >= 25.5 && r < 26.5 ? STONE.d : lit ? WOOD.l : dark ? WOOD.m : WOOD.b);
      else if (r >= 12.5 && r < 14.5) wheel.set(x, y, lit ? WOOD.b : WOOD.m);
    }
  // spokes (six) and paddles (twelve; two lost while it stood silent)
  for (let k = 0; k < 6; k++) {
    const a = rot + (k * Math.PI) / 3;
    const ca = Math.cos(a), sa = Math.sin(a);
    wheel.line(c + ca * 5, c + sa * 5, c + ca * 24, c + sa * 24, WOOD.d, 2);
    wheel.line(c + ca * 5 - sa * 0.5, c + sa * 5 + ca * 0.5, c + ca * 23 - sa * 0.5, c + sa * 23 + ca * 0.5, ca * 0.7 + sa * 0.7 < 0 ? WOOD.l : WOOD.b);
  }
  for (let k = 0; k < 12; k++) {
    if (!on && (k === 3 || k === 8)) continue;
    const a = rot + (k * Math.PI) / 6 + Math.PI / 12;
    const ca = Math.cos(a), sa = Math.sin(a);
    // a plank from the inner edge of the rim out past it, three pixels thick
    for (let r = 21; r <= 31; r += 0.5)
      for (let w = -1.5; w <= 1.5; w += 0.5) {
        const x = c + ca * r - sa * w, y = c + sa * r + ca * w;
        const edge = w <= -1.25 ? WOOD.l : w >= 1.25 ? WOOD.s : r > 30 ? WOOD.d : WOOD.m;
        wheel.set(x, y, edge);
      }
  }
  // the hub
  wheel.disc(c, c, 5, BRASS.m);
  wheel.disc(c - 0.5, c - 0.5, 3.6, BRASS.b);
  wheel.disc(c, c, 1.6, BRASS.d);
  wheel.set(c - 3, c - 3, BRASS.h);
  wheel.set(c - 2, c - 3, BRASS.l);
  for (let k = 0; k < 4; k++) wheel.set(c + Math.cos(rot * 2 + (k * Math.PI) / 2) * 3.6, c + Math.sin(rot * 2 + (k * Math.PI) / 2) * 3.6, BRASS.d);
  // moss and weed on the silent wheel's lower half
  if (!on) for (let y = c; y < wl; y++) for (let x = 0; x < S; x++) {
    const v = wheel.get(x, y);
    if (v >= 0 && v !== BRASS.m && v !== BRASS.b && hash2(x, y, 5) < 0.3) wheel.set(x, y, hash2(x, y, 6) < 0.6 ? MOSS.d : MOSS.m);
  }
  // nothing of the wheel shows under the water
  for (let y = wl; y < S; y++) for (let x = 0; x < S; x++) wheel.clear(x, y);
  wheel.outline();
  // the axle across the hub to the pier
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = wheel.get(x, y); if (v >= 0) p.set(x, y, v); }
  p.rect(c + 4, c - 2, S - c - 4, 4, WOOD.d);
  p.rect(c + 4, c - 2, S - c - 4, 1, WOOD.b);
  p.rect(c + 4, c + 1, S - c - 4, 1, WOOD.s);
  p.rect(c + 16, c - 3, 2, 6, STONE.d);
  p.rect(S - 6, c - 4, 6, 8, WOOD.s);
  p.set(S - 5, c - 3, BRASS.b); p.set(S - 2, c + 2, BRASS.b);
  // the waterline: churning foam when it turns, a still dark line with the moss's reflection when not
  for (let x = c - 30; x <= S - 1; x++) {
    if (on) {
      const k = (x + f * 3) % 7;
      if (x > c + 27) { if (k < 3) p.set(x, wl, WATER.l); continue; }
      p.set(x, wl, k === 0 ? WATER.b : WATER.w);
      if (k < 4) p.set(x, wl + 1, WATER.l);
      if (k === 2 && x % 2) p.set(x, wl - 1, WATER.w);
    } else if (x >= c - 27 && x <= c + 27) {
      p.set(x, wl, WATER.d);
      if (hash2(x, 3, 3) < 0.3) p.set(x, wl + 1, MOSS.d);
    }
  }
  // the wake downstream (south) of a turning wheel
  if (on) for (let y = wl + 2; y < S - 2; y++) for (let x = c - 22; x <= c + 26; x++) {
    const h = hash2(x, Math.floor((y - f * 2) / 2), 21);
    if (h < 0.06 * (1 - (y - wl) / (S - wl))) p.set(x, y, h < 0.02 ? WATER.w : WATER.l);
  }
  return p;
}

// ---------- the Waterworks ----------
export const PUMP_TOP = 34;
/** town:pump:<season>:<state 0 shuttered, 1 running, 2 running at night>[:<frame 0-3>] (80 x 98; this art ignores the frame, the imported sheet rocks its beam) */
function drawPump(season: number, state: number): Px {
  const W = 80, T = PUMP_TOP, H = 64 + T;
  const p = new Px(W, H);
  const run = state > 0, night = state === 2, snow = season === 3;
  // the chimney stack (behind the roof's right half)
  brick(p, 60, 0, 10, 46, 17);
  p.rect(58, 0, 14, 3, STONE.s);
  p.rect(58, 0, 14, 1, STONE.m);
  p.rect(60, 7, 10, 2, BRASS.b);
  p.rect(60, 7, 10, 1, BRASS.l);
  if (!run) for (let y = 3; y < 7; y++) p.set(61 + (y % 3) * 3, y, MOSS.d);
  // a hipped slate roof with a vent on the ridge
  shingles(p, 12, 67, 20, 1, 78, 50, SLATE, 23, snow);
  p.rect(12, 19, 56, 2, SLATE.s);
  p.rect(34, 13, 12, 7, COPPER.m);
  p.rect(34, 13, 12, 1, COPPER.l);
  p.rect(33, 12, 14, 1, COPPER.d);
  for (let x = 36; x < 45; x += 3) p.rect(x, 15, 2, 4, run ? SH : COPPER.d);
  // brick walls and a stone plinth
  brick(p, 3, 51, 74, 41, 29);
  p.rect(2, 92, 76, 6, STONE.d);
  p.rect(2, 92, 76, 1, STONE.l);
  for (let x = 2; x < 78; x += 7) p.rect(x, 93, 1, 5, STONE.s);
  p.rect(2, 51, 76, 2, STONE.b);
  p.rect(2, 51, 76, 1, STONE.l);
  // arched windows
  const arch = (x: number, y: number, w: number, h: number) => {
    p.ellipse(x + w / 2, y + 2, w / 2 + 1.5, 4, STONE.b);
    p.rect(x - 1, y + 2, w + 2, h, STONE.b);
    p.ellipse(x + w / 2, y + 2, w / 2, 3, WOOD.d);
    if (run) {
      windowPane(p, x, y + 2, w, h - 2, night ? 'lit' : 'day', WOOD.d);
      p.ellipse(x + w / 2, y + 2, w / 2 - 1, 2, night ? GLOW.g : WATER.l);
    } else {
      shutters(p, x, y + 1, w, h - 1);
      p.line(x - 2, y + 4, x + w + 1, y + h - 3, WOOD.b, 2);
    }
  };
  arch(9, 60, 12, 18);
  arch(59, 60, 12, 18);
  // the double door under its arch and the brass plaque
  p.ellipse(40, 69, 10, 6, STONE.b);
  p.rect(30, 69, 20, 23, STONE.b);
  p.ellipse(40, 69, 8.5, 5, WOOD.d);
  p.rect(31.5, 69, 17, 23, WOOD.d);
  for (let x = 32; x < 48; x += 3) p.rect(x, 66, 2, 26, WOOD.m);
  p.rect(39, 64, 2, 28, WOOD.s);
  if (!run) { p.line(31, 89, 49, 72, WOOD.b, 2); p.line(31, 72, 49, 89, WOOD.b, 2); }
  p.set(37, 81, BRASS.l); p.set(42, 81, BRASS.l);
  p.rect(32, 55, 16, 6, BRASS.d);
  p.rect(33, 56, 14, 4, run ? BRASS.b : BRASS.m);
  for (let x = 35; x < 46; x += 2) p.set(x, 58, BRASS.d);
  // the main: a copper pipe down the west wall into the ground, with its valve wheel and a gauge
  p.rect(4, 58, 3, 40, run ? COPPER.b : COPPER.m);
  p.rect(4, 58, 1, 40, run ? COPPER.h : COPPER.l);
  p.rect(3, 64, 5, 2, COPPER.d);
  p.rect(3, 84, 5, 2, COPPER.d);
  p.disc(9, 74, 3, BRASS.m);
  p.disc(9, 74, 1.5, BRASS.d);
  p.set(8, 72, BRASS.l);
  p.disc(25, 58.5, 2.5, STONE.l);
  p.set(25, 58, run ? COPPER.b : STONE.d);
  p.set(26, 57, run ? COPPER.b : STONE.d);
  if (!run) { p.set(5, 70, COPPER.d); p.set(6, 77, MOSS.d); }
  if (snow) for (let x = 3; x < 77; x++) if (hash2(x, 5, 2) < 0.6) p.set(x, 51, SNOW.l);
  p.outline();
  return p;
}

/** town:fountain:<on>:<frame 0-3>:<season>: the square's fountain (48 x 58; its footprint is the bottom 3x2 tiles) */
export const FOUNTAIN_TOP = 26;
function drawFountain(on: boolean, f: number, season: number): Px {
  const W = 48, T = FOUNTAIN_TOP, H = 32 + T;
  const p = new Px(W, H);
  const cx = 24, by = 44, snow = season === 3;
  // the basin: a stone rim round the water (or dry, cracked stone)
  p.ellipse(cx, by, 23, 12.5, (x, y) => (y > by + 6 ? STONE.m : STONE.b));
  p.ellipse(cx, by - 1, 22, 11, (x, y) => (y < by - 8 ? STONE.l : STONE.b));
  p.ellipse(cx, by - 1, 18.5, 8, STONE.d);
  if (on) {
    p.ellipse(cx, by, 18, 7.5, (x, y, t) => (y < by - 4 ? WATER.m : t > 0.7 ? WATER.m : WATER.b));
    // ripples spreading from where the falls land
    for (let k = 0; k < 2; k++) {
      const r = ((f + k * 2) % 4) * 3 + 6;
      for (let a = 0; a < 40; a++) {
        const t = (a / 40) * Math.PI * 2;
        const x = cx + Math.cos(t) * r * 1.3, y = by + 1 + Math.sin(t) * r * 0.5;
        if (((x - cx) / 18) ** 2 + ((y - by) / 7.5) ** 2 < 0.92 && p.get(x, y) !== STONE.d) p.set(x, y, WATER.l);
      }
    }
    for (const [x, y] of [[cx - 12, by - 1], [cx + 9, by + 3], [cx - 5, by + 4]] as const) if ((x + f) % 3) p.set(x, y, WATER.w);
  } else {
    p.ellipse(cx, by, 18, 7.5, (x, y) => (y < by - 4 ? STONE.s : STONE.d));
    // cracks, dead leaves and a dry stain
    p.line(cx - 14, by - 2, cx - 8, by + 2, SH); p.line(cx - 8, by + 2, cx - 4, by + 1, SH);
    p.line(cx + 6, by - 4, cx + 11, by + 1, SH); p.line(cx + 11, by + 1, cx + 15, by + 2, SH);
    if (!snow) for (const [x, y, c] of [[cx - 10, by + 4, WOOD.m], [cx + 3, by + 5, MOSS.d], [cx + 13, by - 2, WOOD.b], [cx - 2, by - 3, WOOD.d]] as const) { p.set(x, y, c); p.set(x + 1, y, c); }
  }
  if (snow && !on) p.ellipse(cx, by + 1, 14, 5, SNOW.b);
  // the column and its bowl, and the finial the water rises from
  p.rect(cx - 3, 16, 6, by - 16, STONE.b);
  p.rect(cx - 3, 16, 2, by - 16, STONE.l);
  p.rect(cx + 2, 16, 1, by - 16, STONE.m);
  p.ellipse(cx, by - 4, 5, 2, STONE.m);
  p.ellipse(cx, 17, 10, 3.5, (x, y) => (y < 16 ? STONE.l : STONE.b));
  p.ellipse(cx, 16, 8, 2, on ? WATER.b : STONE.d);
  p.rect(cx - 1, 8, 2, 8, BRASS.b);
  p.rect(cx - 1, 8, 1, 8, BRASS.l);
  p.disc(cx, 8, 2, BRASS.b);
  p.set(cx - 1, 7, BRASS.h);
  if (!on) p.line(cx + 4, 18, cx + 7, 20, SH);
  if (snow) { p.ellipse(cx, 15, 9, 1.5, SNOW.l); p.set(cx, 6, SNOW.l); }
  p.outline();
  if (on) {
    // the jet from the finial, and the curtains falling from the bowl's lip into the basin
    for (let y = 0; y < 7; y++) p.set(cx + ((y + f) % 2 ? 0 : -1), y, y < 2 ? WATER.w : WATER.l);
    p.set(cx - 2, 2 + (f % 2), WATER.l); p.set(cx + 1, 3 - (f % 2), WATER.l);
    for (const sx of [cx - 9, cx - 8, cx + 8, cx + 9])
      for (let y = 19; y < by - 3; y++) {
        const k = (y - f * 2 + sx) % 4;
        p.set(sx, y, k === 0 ? WATER.w : k === 1 ? WATER.l : WATER.b);
      }
    for (const sx of [cx - 9, cx + 8]) { p.set(sx - 1, by - 3, WATER.w); p.set(sx + 2, by - 3, WATER.w); p.set(sx + (f % 2 ? -2 : 3), by - 4, WATER.l); }
  }
  return p;
}

// ---------- the square's lamps ----------
export const LAMP_TOP = 28;
/** town:lamp:<state 0 bare post, 1 hung but dark, 2 lit> (16 x 44): bronze posts with brass lanterns */
function drawLamp(state: number): Px {
  const W = 16, H = 16 + LAMP_TOP;
  const p = new Px(W, H);
  // base, fluted post and the lamplighter's crossbar
  p.rect(4, 38, 8, 5, BRONZE.m);
  p.rect(4, 38, 8, 1, BRONZE.l);
  p.rect(5, 36, 6, 2, BRONZE.b);
  p.rect(7, 12, 2, 25, BRONZE.m);
  p.rect(7, 12, 1, 25, BRONZE.l);
  p.rect(3, 14, 10, 1, BRONZE.m);
  p.set(3, 13, BRONZE.l); p.set(12, 13, BRONZE.l);
  p.rect(6, 24, 4, 1, BRASS.m);
  if (state === 0) {
    // an empty bracket where the lantern goes
    p.rect(6, 9, 4, 3, BRONZE.m);
    p.rect(7, 6, 2, 3, BRONZE.b);
    p.set(9, 5, BRONZE.m); p.set(10, 6, BRONZE.m);
  } else {
    const lit = state === 2;
    // the lantern: a brass cap, glass panes round a bulb, a brass foot
    p.rect(5, 11, 6, 2, BRASS.m);
    p.rect(4, 3, 8, 8, BRASS.d);
    p.rect(5, 4, 6, 6, lit ? GLOW.g : WATER.d);
    p.rect(5, 4, 2, 6, lit ? GLOW.y : WATER.m);
    p.rect(7, 6, 2, 3, lit ? GLOW.p : WATER.dd);
    p.set(7, 6, lit ? 9 : WATER.l);
    p.rect(8, 4, 1, 6, BRASS.d);
    p.rect(3, 1, 10, 2, BRASS.b);
    p.rect(3, 1, 10, 1, BRASS.l);
    p.rect(6, 0, 4, 1, BRASS.m);
  }
  p.outline();
  return p;
}

// ---------- the tram ----------
/** town:cart:<h side view | v front view>:<loaded 0/1>:<frame 0/1> (24 x 18 / 16 x 18), anchored at its wheels' ground line */
function drawCart(view: string, loaded: boolean, f: number): Px {
  const side = view === 'h';
  const W = side ? 24 : 16, H = 18;
  const p = new Px(W, H);
  const x0 = side ? 2 : 2, w = side ? 20 : 12;
  // the ore heaped in the bucket
  if (loaded) for (let i = 0; i < w - 2; i++) {
    const hgt = 2 + Math.round(Math.sin((i / (w - 2)) * Math.PI) * 2 + hash2(i, 1, 5));
    for (let k = 0; k < hgt; k++) p.set(x0 + 1 + i, 4 - k, [COPPER.m, STONE.m, COPPER.b, STONE.b, WOOD.m][Math.floor(hash2(i, k, 9) * 5)]);
  }
  // the copper bucket with brass bands
  p.rect(x0, 4, w, 7, COPPER.m);
  p.rect(x0, 4, w, 1, COPPER.l);
  p.rect(x0, 10, w, 1, COPPER.d);
  for (const bx of side ? [x0 + 3, x0 + w - 4] : [x0 + 2, x0 + w - 3]) p.rect(bx, 4, 1, 7, BRASS.b);
  p.rect(x0 + 1, 5, 1, 4, COPPER.h);
  // the chassis and wheels
  p.rect(x0 - 1, 11, w + 2, 2, WOOD.d);
  p.rect(x0 - 1, 11, w + 2, 1, WOOD.m);
  const wheel = (cx: number) => {
    p.disc(cx, 14.5, 2.6, STONE.s);
    p.disc(cx, 14.5, 1.4, STONE.b);
    p.set(cx + (f ? 1 : 0) - 1, 14 + (f ? 0 : 1), STONE.l);
  };
  if (side) { wheel(x0 + 4); wheel(x0 + w - 4); } else { wheel(x0 + 1.5); wheel(x0 + w - 1.5); }
  if (!side) { p.rect(x0 + 4, 6, 4, 3, COPPER.d); p.set(x0 + 5, 7, BRASS.l); }
  p.outline();
  return p;
}

/** town:rail:<h|v|c>: the track's pieces, centred on the track line (h 16 x 12, v 12 x 16, c 16 x 16) */
function drawRail(kind: string): Px {
  const W = kind === 'v' ? 12 : 16, H = kind === 'h' ? 12 : 16;
  const p = new Px(W, H);
  if (kind === 'h') {
    for (let x = 1; x < 16; x += 4) p.rect(x, 1, 2, 10, x % 8 === 1 ? WOOD.d : WOOD.s);
    for (const y of [2, 8]) { p.rect(0, y, 16, 2, STONE.d); p.rect(0, y, 16, 1, STONE.l); }
  } else if (kind === 'v') {
    for (let y = 1; y < 16; y += 4) p.rect(1, y, 10, 2, y % 8 === 1 ? WOOD.d : WOOD.s);
    for (const x of [2, 8]) { p.rect(x, 0, 2, 16, STONE.d); p.rect(x, 0, 1, 16, STONE.l); }
  } else {
    // the bend from the east road into the avenue: the north-west quarter of two circles round the
    // piece's bottom-right corner, the track's line at radius 10 (rails at 7 and 13, as the straight
    // pieces' rails sit 3 px either side of it, with their light edge outside)
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * (Math.PI / 2);
      if (a % 5 === 2) p.line(16 - Math.cos(t) * 5.5, 16 - Math.sin(t) * 5.5, 16 - Math.cos(t) * 14.5, 16 - Math.sin(t) * 14.5, WOOD.d, 2);
    }
    for (let a = 0; a <= 40; a++) {
      const t = (a / 40) * (Math.PI / 2);
      for (const r of [7, 13]) {
        p.set(16 - Math.cos(t) * r, 16 - Math.sin(t) * r, STONE.d);
        p.set(16 - Math.cos(t) * (r + 1), 16 - Math.sin(t) * (r + 1), STONE.l);
      }
    }
  }
  return p;
}

/** town:buffer: the timber buffer stop at the track's ends (12 x 14) */
function drawBuffer(): Px {
  const p = new Px(12, 14);
  p.rect(1, 6, 10, 6, WOOD.m);
  p.rect(1, 6, 10, 1, WOOD.l);
  p.rect(2, 2, 2, 10, WOOD.d); p.rect(8, 2, 2, 10, WOOD.d);
  p.rect(0, 3, 12, 3, COPPER.m);
  p.rect(0, 3, 12, 1, COPPER.l);
  p.outline();
  return p;
}

/** town:sign: the tram stop's sign, a brass roundel with a cart on it (12 x 30) */
function drawSign(): Px {
  const p = new Px(12, 30);
  p.rect(5, 8, 2, 21, WOOD.d);
  p.rect(5, 8, 1, 21, WOOD.m);
  p.rect(3, 27, 6, 2, STONE.b);
  p.disc(6, 6, 5.5, BRASS.b);
  p.disc(6, 6, 4.2, WOOD.l);
  p.rect(3, 5, 6, 3, COPPER.m);
  p.rect(3, 5, 6, 1, COPPER.l);
  p.set(4, 8, STONE.s); p.set(7, 8, STONE.s);
  p.set(4, 2, BRASS.h);
  p.outline();
  return p;
}

/** the tram's cart bin at the quarry: a hopper on legs whose chute leans to the cart (16 x 30) */
function drawTramBin(season: number): Px {
  const p = new Px(16, 30);
  // legs
  p.rect(2, 18, 2, 12, WOOD.d); p.rect(12, 18, 2, 12, WOOD.d);
  p.rect(2, 18, 1, 12, WOOD.m);
  p.line(3, 28, 13, 20, WOOD.s);
  // the hopper (wider at the top), with brass bands
  for (let y = 4; y < 19; y++) {
    const inset = Math.floor((y - 4) / 4);
    for (let x = 1 + inset; x < 15 - inset; x++) p.set(x, y, (y - 4) % 5 === 4 ? WOOD.d : x === 1 + inset ? WOOD.l : x >= 14 - inset ? WOOD.m : WOOD.b);
  }
  p.rect(1, 4, 14, 1, WOOD.l);
  p.rect(1, 9, 14, 1, BRASS.b);
  p.rect(3, 17, 10, 1, BRASS.b);
  // its open mouth, and the chute
  p.rect(2, 2, 12, 3, SH);
  p.rect(2, 2, 12, 1, WOOD.d);
  p.rect(6, 19, 4, 4, COPPER.m);
  p.rect(6, 19, 4, 1, COPPER.l);
  // a little cart plate on the front
  p.rect(5, 11, 6, 3, COPPER.m);
  p.set(6, 14, STONE.s); p.set(9, 14, STONE.s);
  if (season === 3) p.rect(2, 1, 12, 1, SNOW.l);
  p.outline();
  return p;
}

/** town:townline: the town line's post at the farm gate, where the square's lamp cable comes in (10 x 26) */
function drawTownLine(): Px {
  const p = new Px(10, 26);
  p.rect(4, 4, 2, 21, WOOD.d);
  p.rect(4, 4, 1, 21, WOOD.m);
  p.rect(1, 5, 8, 2, WOOD.m);
  p.rect(1, 5, 8, 1, WOOD.l);
  p.rect(1, 3, 2, 2, COPPER.b); p.rect(7, 3, 2, 2, COPPER.b);
  p.set(1, 3, COPPER.h); p.set(7, 3, COPPER.h);
  p.rect(3, 12, 4, 5, BRASS.m);
  p.rect(3, 12, 4, 1, BRASS.l);
  p.set(5, 14, INK);
  p.rect(3, 23, 4, 2, STONE.b);
  p.outline();
  return p;
}

// ---------- registration ----------
/** a sprite generator of a known size, anchored at (ox, oy) */
const gen = (w: number, h: number, ox: number, oy: number, px: () => Px) => ({ w, h, ox, oy, draw: (ctx: CanvasRenderingContext2D) => px().draw(ctx) });

defSpriteFamily('town:', (name) => {
  const [, kind, a, b, c] = name.split(':');
  switch (kind) {
    case 'mill': return gen(112, 96 + MILL_TOP, 0, MILL_TOP, () => drawMill(+a, +b));
    case 'wheel': return gen(WHEEL_SIZE, WHEEL_SIZE, WHEEL_HUB, WHEEL_HUB, () => drawWheel(a === '1', +b));
    case 'pump': return gen(80, 64 + PUMP_TOP, 0, PUMP_TOP, () => drawPump(+a, +b));
    case 'fountain': return gen(48, 32 + FOUNTAIN_TOP, 0, FOUNTAIN_TOP, () => drawFountain(a === '1', +b, +c));
    case 'lamp': return gen(16, 16 + LAMP_TOP, 0, LAMP_TOP, () => drawLamp(+a));
    case 'cart': return a === 'h' ? gen(24, 18, 12, 17, () => drawCart(a, b === '1', +c)) : gen(16, 18, 8, 17, () => drawCart(a, b === '1', +c));
    case 'rail': return a === 'h' ? gen(16, 12, 0, 6, () => drawRail(a)) : a === 'v' ? gen(12, 16, 6, 0, () => drawRail(a)) : gen(16, 16, 0, 0, () => drawRail(a));
    case 'buffer': return gen(12, 14, 6, 12, drawBuffer);
    case 'sign': return gen(12, 30, 6, 29, drawSign);
    case 'townline': return gen(10, 26, 5, 25, drawTownLine);
  }
  return null;
});

// the bin is a structure: the renderer asks for st:tram_bin:<frame>:<on>:<season>, which a named
// generator answers ahead of the generic st: family (src/render/art/structs.ts has no art for it)
for (let s = 0; s < 4; s++)
  for (let f = 0; f < 4; f++)
    for (const on of [0, 1]) defSprite(`st:tram_bin:${f}:${on}:${s}`, gen(16, 30, 0, 14, () => drawTramBin(s)));
