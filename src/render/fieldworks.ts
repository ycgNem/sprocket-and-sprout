// Drawing the Field Works (ROADMAP.md 4.9): gantry rails, the field gantry (its car at the rail
// start, the bridge riding the rails, the picker head) and the blue drop over a dry crop.
// Imported sprites (`rail:<axis>`, `gantry:car:<axis>`, `gantry:beam:<axis>`, `gantry:head:<f>`,
// src/art/fieldworks.*) win; the code-drawn shapes here are the fallback.
import { C, PALETTE, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import { DX, DY, type Ent } from '../sim/ents';
import { defSpriteFamily, drawSprite, hasImage, sprite } from './atlas';
import type { Drawable } from './renderer';

const P = (c: number) => PALETTE[c];

/** code-drawn fallbacks, registered once */
export function registerFieldWorksSprites() {
  defSpriteFamily('rail:', (name) => {
    const axis = +name.split(':')[1];
    return {
      w: 16, h: 16, draw: (ctx) => {
        // dark timber sleepers under two iron rails
        ctx.fillStyle = P(C.bark);
        for (let k = 1; k < 16; k += 5) axis === 0 ? ctx.fillRect(2, k, 12, 3) : ctx.fillRect(k, 2, 3, 12);
        ctx.fillStyle = P(C.slate);
        if (axis === 0) { ctx.fillRect(4, 0, 2, 16); ctx.fillRect(10, 0, 2, 16); } else { ctx.fillRect(0, 4, 16, 2); ctx.fillRect(0, 10, 16, 2); }
        ctx.fillStyle = P(C.pebble);
        if (axis === 0) { ctx.fillRect(4, 0, 1, 16); ctx.fillRect(10, 0, 1, 16); } else { ctx.fillRect(0, 4, 16, 1); ctx.fillRect(0, 10, 16, 1); }
      },
    };
  });
  defSpriteFamily('gantry:', (name) => {
    const [, part, a] = name.split(':');
    const axis = +a;
    if (part === 'car') {
      const w = axis === 0 ? 112 : 20, h = axis === 0 ? 28 : 124;
      return {
        w, h, ox: axis === 0 ? 0 : 2, oy: 12, draw: (ctx) => {
          // a brass-banded hopper car with an iron frame
          ctx.fillStyle = P(C.ink);
          ctx.fillRect(0, 4, w, h - 4);
          ctx.fillStyle = P(C.walnut);
          ctx.fillRect(1, 5, w - 2, h - 6);
          ctx.fillStyle = P(C.brass);
          if (axis === 0) { ctx.fillRect(1, 5, w - 2, 2); ctx.fillRect(1, h - 4, w - 2, 1); } else { ctx.fillRect(1, 5, 2, h - 6); ctx.fillRect(w - 3, 5, 1, h - 6); }
          ctx.fillStyle = P(C.slate);
          for (let k = 8; k < (axis === 0 ? w : h) - 8; k += 16) axis === 0 ? ctx.fillRect(k, 9, 6, h - 14) : ctx.fillRect(5, k, w - 10, 6);
        },
      };
    }
    if (part === 'beam') {
      const w = axis === 0 ? 112 : 32, h = axis === 0 ? 24 : 124;
      return {
        w, h, ox: axis === 0 ? 0 : 8, oy: axis === 0 ? 20 : 12, draw: (ctx) => {
          ctx.fillStyle = P(C.ink);
          if (axis === 0) {
            // legs on the two rail tiles, the beam across
            ctx.fillRect(3, 2, 10, 22); ctx.fillRect(w - 13, 2, 10, 22); ctx.fillRect(0, 0, w, 8);
            ctx.fillStyle = P(C.brass);
            ctx.fillRect(4, 3, 8, 20); ctx.fillRect(w - 12, 3, 8, 20); ctx.fillRect(1, 1, w - 2, 6);
            ctx.fillStyle = P(C.amber);
            ctx.fillRect(1, 1, w - 2, 1);
            ctx.fillStyle = P(C.copper);
            for (let k = 16; k < w - 16; k += 8) ctx.fillRect(k, 3, 4, 2);
          } else {
            ctx.fillRect(0, 0, w, 12); ctx.fillRect(0, h - 12, w, 12); ctx.fillRect(12, 0, 8, h);
            ctx.fillStyle = P(C.brass);
            ctx.fillRect(1, 1, w - 2, 10); ctx.fillRect(1, h - 11, w - 2, 10); ctx.fillRect(13, 1, 6, h - 2);
            ctx.fillStyle = P(C.copper);
            for (let k = 16; k < h - 16; k += 8) ctx.fillRect(15, k, 2, 4);
          }
        },
      };
    }
    if (part === 'head') {
      const f = axis;
      return {
        w: 16, h: 16, draw: (ctx) => {
          ctx.fillStyle = P(C.ink);
          ctx.fillRect(5, 0, 6, 9);
          ctx.fillStyle = P(C.copper);
          ctx.fillRect(6, 1, 4, 7);
          // the picker's claws open and close
          ctx.fillStyle = P(C.slate);
          const o = f % 2 ? 1 : 0;
          ctx.fillRect(4 - o, 9, 2, 4);
          ctx.fillRect(10 + o, 9, 2, 4);
          ctx.fillStyle = rgba(C.aqua, 0.6);
          if (f >= 2) ctx.fillRect(6, 13, 4, 2);
        },
      };
    }
    return null;
  });
}

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
  D.push({ y: by + (axis === 0 ? 1.6 : e.h + 0.6), f: () => {
    drawSprite(ctx, sprite(`gantry:beam:${axis}`), Math.round(bx * 16), Math.round(by * 16));
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
