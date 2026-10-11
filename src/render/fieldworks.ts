// Drawing the Field Works (ROADMAP.md 4.9): gantry rails, the field gantry (its car at the rail
// start, the bridge riding the rails, the picker head) and the blue drop over a dry crop.
// The sprites (`rail:<axis>`, `gantry:car:<axis>`, `gantry:beam:<axis>[:<f>]`, `gantry:head:<f>`) are
// imported (src/art/fieldworks.*).
import { C, PALETTE, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import { DX, DY, type Ent } from '../sim/ents';
import { drawSprite, hasImage, sprite } from './atlas';
import type { Drawable } from './renderer';

const P = (c: number) => PALETTE[c];

/** Rails sit flat on the ground. */
export function drawRail(ctx: CanvasRenderingContext2D, e: Ent) {
  drawSprite(ctx, sprite(`rail:${e.rot % 2}`), e.x * 16, e.y * 16);
}

/**
 * The gantry: its car is the entity (where arms unload it); the bridge rides the rails at
 * `st.pos` rows from the car, drawn over whatever walks under it.
 */
export function pushGantry(g: Game, e: Ent, D: Drawable[], ctx: CanvasRenderingContext2D, time: number) {
  const axis = e.rot % 2;
  // the car heaps up with crops once its hopper is half full
  const crops = e.inv?.slots.reduce((a, s) => a + (s ? s.n : 0), 0) ?? 0;
  const car = crops >= 30 && hasImage(`gantry:car:${axis}:full`) ? `gantry:car:${axis}:full` : `gantry:car:${axis}`;
  D.push({ y: e.y + e.h - 0.02, f: () => drawSprite(ctx, sprite(car), e.x * 16, e.y * 16) });
  const pos = e.st.pos ?? 0;
  const fx = DX[e.rot], fy = DY[e.rot];
  // the bridge's top-left tile (world tiles, fractional along the rails)
  const bx = e.x + fx * pos, by = e.y + fy * pos;
  const working = e.working && (e.st.dir ?? 0) !== 0;
  // its wheels turn on the rails while it rides (frame 0 is the idle pose); the frames roll toward +y
  // (a bridge across x) or +x (a bridge across y), so riding the other way plays them backward
  const f = Math.floor(time * 8) % 4;
  const v = (e.st.dir ?? 0) * (axis === 0 ? DY[e.rot] : DX[e.rot]);
  const wf = working ? (v >= 0 ? f : (4 - f) % 4) : 0;
  const beam = hasImage(`gantry:beam:${axis}:${wf}`) ? `gantry:beam:${axis}:${wf}` : `gantry:beam:${axis}`;
  D.push({ y: by + (axis === 0 ? 1.6 : e.h + 0.6), f: () => {
    drawSprite(ctx, sprite(beam), Math.round(bx * 16), Math.round(by * 16));
    // the picker head slides across the five strip tiles while it works
    const k = working ? 1 + Math.floor(((Math.sin(time * 1.7) + 1) / 2) * 4.99) : 3;
    const hx = axis === 0 ? bx + k : bx, hy = axis === 0 ? by : by + k;
    drawSprite(ctx, sprite(`gantry:head:${working ? Math.floor(time * 6) % 4 : 0}`), Math.round(hx * 16), Math.round(hy * 16 - (axis === 0 ? 4 : 0)));
  } });
}

/** a blue drop over a crop that still needs water after noon (help for the hands) */
export function drawDryDrops(ctx: CanvasRenderingContext2D, g: Game, tx0: number, ty0: number, tx1: number, ty1: number, time: number) {
  if (g.time.min < 12 * 60 || g.isRaining() || g.player.where !== 'world') return;
  const m = g.map;
  const bob = Math.round(Math.sin(time * 3) * 0.8);
  for (const [i, s] of g.soil) {
    if (!s.crop || s.crop.dead || s.crop.ready || s.water) continue;
    const x = i % m.w, y = Math.floor(i / m.w);
    if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
    const px = x * 16 + 6, py = y * 16 - 8 + bob;
    ctx.fillStyle = P(C.ink);
    ctx.fillRect(px + 1, py, 2, 1);
    ctx.fillRect(px, py + 1, 4, 3);
    ctx.fillRect(px + 1, py + 4, 2, 1);
    ctx.fillStyle = P(C.sky);
    ctx.fillRect(px + 1, py + 1, 2, 3);
    ctx.fillStyle = P(C.aqua);
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }
}
