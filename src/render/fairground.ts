// The Sprocket Fair on the square (ROADMAP.md 7.7): while it's on, the Professor's brass-rimmed 6x6
// plate lies on the plaza and the three entries run beside it, drawn with the structure sprites and
// their working frames. A blockout: where everything stands is src/sim/world/fairground.ts, and
// Phase 6's art pass replaces this drawing. The renderer calls drawFairPlate with the ground (under
// everything that stands) and pushFairground with its y-sorted drawables.
import { C, PALETTE } from '../data/palette';
import { STRUCT_BY_ID } from '../data/structures';
import type { Game } from '../sim/Game';
import { FAIR_ENTRY_LINES, FAIR_PLATE } from '../sim/world/fairground';
import { drawSprite, sprite } from './atlas';
import type { Drawable, Renderer } from './renderer';

const T = 16;

/** the Fair is on and you're in the valley to see it */
export const fairShown = (g: Game) => g.sys.festivals?.active?.activity === 'fair' && g.player.where === 'world';

/** the plate on the plaza: flagstones in a brass rim with corner rivets, on the ground layer */
export function drawFairPlate(ctx: CanvasRenderingContext2D, g: Game) {
  if (!fairShown(g)) return;
  const P = FAIR_PLATE, x0 = P.x * T, y0 = P.y * T, w = P.w * T, h = P.h * T;
  const fill = (x: number, y: number, ww: number, hh: number, c: number) => {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(x, y, ww, hh);
  };
  // a dark edge and a brass rim, lit along the top, shadowed along the bottom
  fill(x0 - 3, y0 - 3, w + 6, h + 6, C.ink);
  fill(x0 - 2, y0 - 2, w + 4, h + 4, C.brass);
  fill(x0 - 2, y0 - 2, w + 4, 1, C.amber);
  fill(x0 - 2, y0 + h + 1, w + 4, 1, C.copper);
  // the plates: stone-grey squares lit along their top and left edges, a slate seam between them (as
  // the Professor's window draws the plate)
  for (let ty = 0; ty < P.h; ty++)
    for (let tx = 0; tx < P.w; tx++) {
      const x = x0 + tx * T, y = y0 + ty * T;
      fill(x, y, T, T, C.stone);
      fill(x, y, T - 1, 1, C.pebble);
      fill(x, y, 1, T - 1, C.pebble);
      fill(x, y + T - 1, T, 1, C.slate);
      fill(x + T - 1, y, 1, T, C.slate);
    }
  // rivets on the rim
  for (const [rx, ry] of [[x0 - 2, y0 - 2], [x0 + w, y0 - 2], [x0 - 2, y0 + h], [x0 + w, y0 + h]]) fill(rx, ry, 2, 2, C.butter);
}

/** the three entries, running beside the plate, y-sorted with the villagers */
export function pushFairground(g: Game, r: Renderer, D: Drawable[]) {
  if (!fairShown(g)) return;
  const ctx = r.ctx;
  const season = g.time.season, frame = Math.floor(r.time * 8) % 4;
  for (const line of FAIR_ENTRY_LINES)
    for (const p of line.pieces) {
      const def = STRUCT_BY_ID.get(p.def);
      if (!def) continue;
      const [w, h] = def.size;
      const on = def.kind === 'machine';
      const s = sprite(`st:${def.id}:${on ? frame : 0}:${on ? 1 : 0}:${season}`);
      const shadow = sprite(`shadow:${Math.round(w * T * 0.8)}`);
      D.push({ y: p.y + h - 0.02, f: () => {
        drawSprite(ctx, shadow, p.x * T + w * 8, (p.y + h) * T - 2);
        drawSprite(ctx, s, p.x * T, p.y * T);
      } });
    }
}
