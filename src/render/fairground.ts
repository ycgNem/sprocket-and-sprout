// The Sprocket Fair on the square (ROADMAP.md 7.7): while it's on, the Professor's brass-rimmed 6x6
// plate lies on the plaza and the three entries run beside it, drawn with the structure sprites and
// their working frames. A blockout: where everything stands is src/sim/world/fairground.ts, and
// Phase 6's art pass replaces this drawing. The renderer calls drawFairPlate with the ground (under
// everything that stands) and pushFairground with its y-sorted drawables.
import { C, PALETTE } from '../data/palette';
import { STRUCT_BY_ID } from '../data/structures';
import type { Game } from '../sim/Game';
import { FAIR_ENTRY_LINES, FAIR_PLATE } from '../sim/world/fairground';
import { drawSprite, hasImage, sprite } from './atlas';
import type { Drawable, Renderer } from './renderer';

const T = 16;

/** the Fair is on and you're in the valley to see it */
export const fairShown = (g: Game) => g.sys.festivals?.active?.activity === 'fair' && g.player.where === 'world';

/** the Harvest Haul is on and you're in the valley to see it */
export const haulShown = (g: Game) => g.sys.festivals?.active?.activity === 'haul' && g.player.where === 'world';

/**
 * The Harvest Haul's market on the square (tiles): four stalls in the plaza's corners, clear of the
 * villagers' ring (x 127-139, y 57-65) and the benches, and the Mayor's auction podium by the
 * clocktower. Each is a 2x1 counter whose awning rises over the row behind it (src/art/fairs.*).
 */
export const HAUL_STALLS: { k: number; x: number; y: number }[] = [
  { k: 0, x: 123, y: 56 }, { k: 1, x: 141, y: 56 }, { k: 2, x: 123, y: 66 }, { k: 3, x: 141, y: 66 },
];
export const HAUL_PODIUM = { x: 129, y: 55 };
/** the Fair's banner: its bottom middle (it spans x 122-126 over rows 58-59, the plaza's west entrance) */
export const FAIR_BANNER = { x: 124, y: 60 };

/** the plate on the plaza: flagstones in a brass rim with corner rivets, on the ground layer */
export function drawFairPlate(ctx: CanvasRenderingContext2D, g: Game) {
  if (!fairShown(g)) return;
  const P = FAIR_PLATE, x0 = P.x * T, y0 = P.y * T, w = P.w * T, h = P.h * T;
  // the imported plate (102x102, its rim 3 px outside the 6x6 tiles)
  if (hasImage('fair:plate')) {
    drawSprite(ctx, sprite('fair:plate'), x0, y0);
    return;
  }
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

/** the three entries, running beside the plate, y-sorted with the villagers (and the Haul's stalls) */
export function pushFairground(g: Game, r: Renderer, D: Drawable[]) {
  if (haulShown(g)) return pushHaul(g, r, D);
  if (!fairShown(g)) return;
  const ctx = r.ctx;
  // the Fair's banner over the plaza's west entrance, where the road comes in from the farm (clear of
  // the clocktower's door above the plate)
  const bn = `fair:banner:${Math.floor(r.time * 1.5) % 3 === 0 ? 1 : 0}`;
  if (hasImage(bn)) D.push({ y: FAIR_BANNER.y - 0.1, f: () => drawSprite(ctx, sprite(bn), FAIR_BANNER.x * T, FAIR_BANNER.y * T) });
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

/** the Harvest Haul's stalls and podium, y-sorted with the villagers (drawn only once their art is in) */
function pushHaul(g: Game, r: Renderer, D: Drawable[]) {
  const ctx = r.ctx;
  // the awnings stir now and then, each on its own beat
  const f = (k: number) => (Math.floor(r.time * 1.5 + k * 0.7) % 3 === 0 ? 1 : 0);
  const put = (name: string, x: number, y: number) => {
    if (!hasImage(name)) return;
    D.push({ y: y + 0.98, f: () => {
      drawSprite(ctx, sprite('shadow:28'), x * T + 16, (y + 1) * T - 2);
      drawSprite(ctx, sprite(name), x * T, y * T);
    } });
  };
  for (const s of HAUL_STALLS) put(`haul:stall:${s.k}:${f(s.k)}`, s.x, s.y);
  put(`haul:podium:${f(4)}`, HAUL_PODIUM.x, HAUL_PODIUM.y);
}
