// The town keystones on screen (ROADMAP.md 7.5): the renderer hands its drawable list here
// (pushTownworks) and the lighting pass asks for their lights (townworksLights). What runs is
// src/sim/systems/townworks.ts; the art is src/render/art/townworks.ts (the `town:` sprites).
import { C, PALETTE } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import { isOre, lampGlow, townLineNet, townworks, tramBin } from '../sim/systems/townworks';
import { FOUNTAIN, isSquareLamp, MILL_WHEEL, PUMP_HOUSE, SQUARE_LAMPS, TOWN_LINE, TOWN_MILL, TRAM } from '../sim/world/townworks';
import { drawSprite, sprite } from './atlas';
import { FOUNTAIN_TOP, MILL_TOP, PUMP_TOP } from './art/townworks';
import { EXTRA_TOP } from './art/structs';
import type { Drawable, Renderer } from './renderer';

const T = 16;

/** the tram's track in world pixels: the east road's line (y 41), the bend, the avenue's line (x 129) */
const TRACK = { y: 41 * T, x: 129 * T, bend: [129 * T + 10, 41 * T + 10] as [number, number], r: 10, east: Math.round(TRAM.route[0][0] * T), south: Math.round(TRAM.route[2][1] * T) };
/** the cart's path, quarry stop to square stop: [x, y] px, with each leg's view */
function cartAt(s: number): { x: number; y: number; view: 'h' | 'v' } {
  const ax = TRAM.quarryStop[0] * T, bx = TRACK.bend[0];
  const arc = (Math.PI / 2) * TRACK.r, ey = TRAM.squareStop[1] * T, dy = TRACK.bend[1];
  const l1 = ax - bx, l3 = ey - dy, total = l1 + arc + l3;
  let d = Math.max(0, Math.min(1, s)) * total;
  if (d <= l1) return { x: ax - d, y: TRACK.y, view: 'h' };
  d -= l1;
  if (d <= arc) {
    const t = d / arc; // 0 at the east end of the bend, 1 at its south end
    const a = -Math.PI / 2 - t * (Math.PI / 2);
    return { x: TRACK.bend[0] + Math.cos(a) * TRACK.r, y: TRACK.bend[1] + Math.sin(a) * TRACK.r, view: t < 0.5 ? 'h' : 'v' };
  }
  d -= arc;
  return { x: TRACK.x, y: dy + d, view: 'v' };
}

/**
 * Where the tram's cart is (pure function of the clock): from 6am to 6pm it shuttles every two hours
 * (45 minutes, about 30 s of play, each way, a quarter hour at each stop), so it's on the road most
 * of the day; the 6am run carries the morning's load. It waits at the quarry overnight.
 */
export function tramCart(g: Game): { x: number; y: number; view: 'h' | 'v'; moving: boolean; loaded: boolean } {
  const m = g.time.min, RUN = 45, CYCLE = 120;
  if (m < 360 || m >= 1080) return { ...cartAt(0), moving: false, loaded: false };
  const c = (m - 360) % CYCLE;
  const s = c < RUN ? c / RUN : c < 60 ? 1 : c < 60 + RUN ? 1 - (c - 60) / RUN : 0;
  const moving = c < RUN || (c >= 60 && c < 60 + RUN);
  return { ...cartAt(s), moving, loaded: m < 360 + RUN && townworks(g).cart > 0 };
}

/** the pole the town line hangs on (the same rule as src/sim/systems/power.ts: the nearest that reaches) */
function townLinePole(g: Game): Ent | null {
  const net = townLineNet(g);
  if (!net) return null;
  let best: Ent | null = null, bd = Infinity;
  for (const p of g.ents.poles) {
    if (p.st.rust || p.net !== net) continue;
    const d = Math.hypot(p.x + p.w / 2 - TOWN_LINE[0] - 0.5, p.y + p.h / 2 - TOWN_LINE[1] - 0.5);
    if (d <= (p.def.reach ?? 7) + 0.01 && d < bd) [best, bd] = [p, d];
  }
  return best;
}

/** a sagging copper wire, as the renderer draws its pole wires */
function wire(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) {
  ctx.fillStyle = PALETTE[C.copper];
  const n = Math.max(4, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 6), 1, 1);
  }
}

/** The keystones' drawables for this frame (the renderer y-sorts them with everything else). */
export function pushTownworks(g: Game, r: Renderer, D: Drawable[]) {
  if (g.player.where !== 'world' || g.map.w < 200) return;
  const ctx = r.ctx, v = r.view, time = r.time, season = g.time.season, m = g.map;
  const vis = (x0: number, y0: number, x1: number, y1: number) => x1 * T >= v.x0 - 8 && x0 * T <= v.x1 + 8 && y1 * T >= v.y0 - 8 && y0 * T <= v.y1 + 8;
  const night = g.daylight < 0.55;
  const P = r.particles;

  // ---- the Town Mill: a still, mossy wheel until `town_mill`; then it turns, splashes and mills ----
  const mill = g.flags.has('town_mill');
  if (vis(MILL_WHEEL.cx - 2.4, TOWN_MILL.y - MILL_TOP / T, TOWN_MILL.x + TOWN_MILL.w, TOWN_MILL.y + TOWN_MILL.h + 1)) {
    const house = sprite(`town:mill:${season}:${mill ? (night ? 2 : 1) : 0}`);
    D.push({ y: TOWN_MILL.y + TOWN_MILL.h - 0.05, f: () => drawSprite(ctx, house, TOWN_MILL.x * T, TOWN_MILL.y * T) });
    const wheel = sprite(`town:wheel:${mill ? 1 : 0}:${mill ? Math.floor(time * 8) % 4 : 0}`);
    const hx = Math.round(MILL_WHEEL.cx * T), hy = Math.round(MILL_WHEEL.cy * T);
    D.push({ y: MILL_WHEEL.cy + 1.4, f: () => drawSprite(ctx, wheel, hx, hy) });
    if (mill) {
      // spray off the paddles rising out of the river (the west side), flour from the loading door
      if (Math.random() < 0.4) P.burst(hx - 26 + Math.random() * 12, hy + 11, 1, [C.aqua, C.cream, C.sky], { speed: 22, up: 34, g: 150, life: 0.45, size: 1 });
      if (Math.random() < 0.15) P.burst(hx - 18 + Math.random() * 40, hy + 13, 1, [C.cream, C.aqua], { speed: 10, up: 12, g: 90, life: 0.3, size: 1 });
      if (Math.random() < 0.06) P.burst(TOWN_MILL.x * T + 50 + Math.random() * 12, TOWN_MILL.y * T - MILL_TOP + 56 + Math.random() * 14, 1, [C.cream, C.butter, C.tan], { speed: 5, up: 3, g: -5, life: 1.8, size: 1 });
    }
  }

  // ---- the Waterworks: the pump house shuttered, the fountain dry, until `waterworks` ----
  const water = g.flags.has('waterworks');
  if (vis(PUMP_HOUSE.x, PUMP_HOUSE.y - PUMP_TOP / T - 2, PUMP_HOUSE.x + PUMP_HOUSE.w, PUMP_HOUSE.y + PUMP_HOUSE.h)) {
    const s = sprite(`town:pump:${season}:${water ? (night ? 2 : 1) : 0}`);
    D.push({ y: PUMP_HOUSE.y + PUMP_HOUSE.h - 0.05, f: () => drawSprite(ctx, s, PUMP_HOUSE.x * T, PUMP_HOUSE.y * T) });
    if (water) {
      // the boiler's smoke from the stack, a breath of steam from the roof vent
      if (Math.random() < 0.07) P.smoke(PUMP_HOUSE.x * T + 65, PUMP_HOUSE.y * T - PUMP_TOP + 1);
      if (Math.random() < 0.02) P.smoke(PUMP_HOUSE.x * T + 40, PUMP_HOUSE.y * T - PUMP_TOP + 13);
    }
  }
  if (vis(FOUNTAIN.x, FOUNTAIN.y - FOUNTAIN_TOP / T, FOUNTAIN.x + FOUNTAIN.w, FOUNTAIN.y + FOUNTAIN.h)) {
    const s = sprite(`town:fountain:${water ? 1 : 0}:${water ? Math.floor(time * 6) % 4 : 0}:${season}`);
    const fx = FOUNTAIN.x * T, fy = FOUNTAIN.y * T;
    D.push({ y: FOUNTAIN.y + FOUNTAIN.h - 0.05, f: () => drawSprite(ctx, s, fx, fy) });
    if (water && Math.random() < 0.3) {
      const side = Math.random() < 0.5 ? -8.5 : 8.5;
      P.burst(fx + 24 + side, fy - FOUNTAIN_TOP + 40, 1, [C.aqua, C.cream], { speed: 12, up: 18, g: 120, life: 0.35, size: 1 });
    }
  }

  // ---- the square's twelve lamps: bare posts, then glass and bulbs (`lamps_hung`), lit on your power ----
  const hung = g.flags.has('lamps_hung'), glow = lampGlow(g);
  for (const [x, y] of SQUARE_LAMPS) {
    if (!vis(x, y - 2, x + 1, y + 1) || !isSquareLamp(m, x, y)) continue;
    const s = sprite(`town:lamp:${!hung ? 0 : glow > 0 ? 2 : 1}`);
    D.push({ y: y + 0.9, f: () => drawSprite(ctx, s, x * T, y * T) });
  }
  // the town line's post at the farm gate, and the wire from the pole of yours that carries it
  if (hung && vis(TOWN_LINE[0] - 12, TOWN_LINE[1] - 14, TOWN_LINE[0] + 2, TOWN_LINE[1] + 12)) {
    const post = sprite('town:townline');
    const px = TOWN_LINE[0] * T + 4, py = (TOWN_LINE[1] - 1) * T + 6;
    D.push({ y: TOWN_LINE[1] - 0.6, f: () => drawSprite(ctx, post, px, py) });
    const pole = townLinePole(g);
    if (pole) {
      const ax = (pole.x + pole.w / 2) * T, ay = pole.y * T - (EXTRA_TOP[pole.def.id] ?? 16) + 2;
      D.push({ y: 9999, f: () => wire(ctx, ax, ay, px - 3, py - 21) });
    }
  }

  // ---- the tram (`tram`): rails along the road, its stops, the cart and the ore in its bin ----
  if (!g.flags.has('tram')) return;
  if (vis(128, 40, TRAM.route[0][0] + 1, TRAM.route[2][1] + 1)) {
    D.push({ y: -1e6, f: () => {
      const h = sprite('town:rail:h'), vv = sprite('town:rail:v');
      for (let x = TRACK.bend[0]; x < TRACK.east; x += T) if (x + T >= v.x0 && x <= v.x1 && TRACK.y + 6 >= v.y0 && TRACK.y - 6 <= v.y1) {
        const w = Math.min(T, TRACK.east - x);
        ctx.drawImage(h.img, h.x, h.y, w, h.h, x, TRACK.y - h.oy, w, h.h);
      }
      for (let y = TRACK.bend[1]; y < TRACK.south; y += T) if (y + T >= v.y0 && y <= v.y1 && TRACK.x + 6 >= v.x0 && TRACK.x - 6 <= v.x1) {
        const hh = Math.min(T, TRACK.south - y);
        ctx.drawImage(vv.img, vv.x, vv.y, vv.w, hh, TRACK.x - vv.ox, y, vv.w, hh);
      }
      drawSprite(ctx, sprite('town:rail:c'), TRACK.bend[0] - 16, TRACK.bend[1] - 16);
    } });
    const buf = sprite('town:buffer');
    D.push({ y: TRACK.y / T + 0.2, f: () => drawSprite(ctx, buf, TRACK.east + 4, TRACK.y + 6) });
    D.push({ y: TRACK.south / T + 0.4, f: () => drawSprite(ctx, buf, TRACK.x, TRACK.south + 8) });
    const sign = sprite('town:sign');
    D.push({ y: TRAM.sign[1] + 0.9, f: () => drawSprite(ctx, sign, TRAM.sign[0] * T + 8, TRAM.sign[1] * T + 15) });
    const c = tramCart(g);
    const cs = sprite(`town:cart:${c.view}:${c.loaded ? 1 : 0}:${c.moving ? Math.floor(time * 8) % 2 : 0}`);
    const cy = c.view === 'h' ? c.y + 6 : c.y + 7;
    D.push({ y: cy / T, f: () => drawSprite(ctx, cs, Math.round(c.x), Math.round(cy)) });
  }
  const bin = tramBin(g);
  if (bin?.inv && vis(bin.x, bin.y - 1, bin.x + 1, bin.y + 1)) {
    // the ore waiting in the hopper's mouth
    const ores = bin.inv.slots.filter((sl) => sl && isOre(sl.k)).length;
    if (ores) D.push({ y: bin.y + 0.99, f: () => {
      const n = Math.min(10, 3 + ores * 2);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = PALETTE[[C.copper, C.stone, C.brick, C.pebble][i % 4]];
        ctx.fillRect(bin.x * T + 3 + ((i * 5) % 10), bin.y * T - 13 + (i % 2), 2, 1);
      }
    } });
  }
}

/** The keystones' lights at night: the square's lamps on your power, the mill's and pump house's windows. */
export function townworksLights(g: Game): { x: number; y: number; r: number; i: number; c?: number; flicker?: boolean }[] {
  const out: { x: number; y: number; r: number; i: number; c?: number; flicker?: boolean }[] = [];
  if (g.map.w < 200) return out;
  const glow = lampGlow(g);
  // twelve pools round the plaza (dimmer in a brownout), leaving its middle in a warm dusk
  if (glow > 0) for (const [x, y] of SQUARE_LAMPS) if (isSquareLamp(g.map, x, y)) out.push({ x: x + 0.5, y: y - 0.4, r: 4.2, i: 0.3 + 0.55 * glow, c: C.amber, flicker: true });
  if (g.daylight < 0.55) {
    if (g.flags.has('town_mill')) out.push({ x: TOWN_MILL.x + TOWN_MILL.w / 2, y: TOWN_MILL.y + TOWN_MILL.h - 0.8, r: 3.6, i: 0.75, c: C.amber, flicker: true });
    if (g.flags.has('waterworks')) out.push({ x: PUMP_HOUSE.x + PUMP_HOUSE.w / 2, y: PUMP_HOUSE.y + PUMP_HOUSE.h - 0.8, r: 3, i: 0.7, c: C.apricot, flicker: true });
  }
  return out;
}
