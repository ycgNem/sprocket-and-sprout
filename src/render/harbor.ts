// The Harbor on screen (2.1, exports): the warehouse at the foot of the beach pier (derelict until
// the town rebuilds it), the Copper Gull moored beside the pier or coming and going across the sea
// (src/sim/systems/exports.ts shipView), and the export cargo stacked by the warehouse as the
// manifest loads. The art is the `harbor:` sprites (art/harbor/); a frame that isn't in the atlas
// yet is drawn as plain shapes so the place still reads.
import { C, PALETTE } from '../data/palette';
import type { Game } from '../sim/Game';
import { harborOpen, manifest, manifestValue, shipView } from '../sim/systems/exports';
import { HARBOR, SHIP_BERTH } from '../sim/world/townworks';
import { drawSprite, hasImage, sprite } from './atlas';
import type { Drawable, Renderer } from './renderer';

const T = 16;
/** where the cargo stands: on the sand east of the warehouse (2x2 tiles) */
const CARGO = { x: HARBOR.x + HARBOR.w, y: HARBOR.y + 1 };

export function pushHarbor(g: Game, r: Renderer, D: Drawable[]) {
  if (g.map.w < 200) return;
  const ctx = r.ctx, time = r.time;
  const open = harborOpen(g);
  // the warehouse
  D.push({
    y: HARBOR.y + HARBOR.h - 0.05,
    f: () => {
      const name = `harbor:warehouse:${open ? 1 : 0}`;
      if (hasImage(name)) drawSprite(ctx, sprite(name), HARBOR.x * T, HARBOR.y * T);
      else warehouseShape(ctx, open);
    },
  });
  // the cargo stacked for the ship: none, a few crates, half a stack, a full one under a net
  const o = open ? manifest(g) : null;
  if (o) {
    const { total, aboard } = manifestValue(o);
    const stage = total ? Math.min(3, Math.floor((aboard / total) * 4)) : 0;
    D.push({
      y: CARGO.y + 1.95,
      f: () => {
        const name = `harbor:cargo:${stage}`;
        if (hasImage(name)) drawSprite(ctx, sprite(name), CARGO.x * T, CARGO.y * T);
        else cargoShape(ctx, stage);
      },
    });
  }
  // the ship, moored or under way
  const v = shipView(g);
  if (v) {
    const frame = Math.floor(time * (v.sailing ? 4 : 2)) % 4;
    D.push({
      y: v.y + SHIP_BERTH.h - 0.05,
      f: () => {
        const name = v.sailing ? `harbor:ship:sail:${frame}` : `harbor:ship:${frame}`;
        const x = Math.round(v.x * T), y = v.y * T;
        if (hasImage(name)) drawSprite(ctx, sprite(name), x, y);
        else shipShape(ctx, x, y, v.sailing, frame);
      },
    });
  }
}

// ---------------- stand-ins until the art is in the atlas ----------------
function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(x, y, w, h);
}

function warehouseShape(ctx: CanvasRenderingContext2D, open: boolean) {
  const x = HARBOR.x * T, y = HARBOR.y * T, w = HARBOR.w * T, h = HARBOR.h * T;
  fill(ctx, x, y - 14, w, 22, open ? C.brick : C.stone);
  fill(ctx, x + 2, y + 8, w - 4, h - 8, open ? C.oak : C.walnut);
  fill(ctx, x + w / 2 - 6, y + h - 16, 12, 16, C.bark);
  if (!open) for (let i = 0; i < 3; i++) fill(ctx, x + 6 + i * 18, y + 16, 12, 2, C.tan);
  else fill(ctx, x + 6, y + 14, 10, 8, C.butter);
}

function cargoShape(ctx: CanvasRenderingContext2D, stage: number) {
  const x = CARGO.x * T, y = CARGO.y * T;
  fill(ctx, x + 2, y + 26, 28, 4, C.walnut);
  for (let i = 0; i < stage * 2; i++) fill(ctx, x + 3 + (i % 2) * 13, y + 16 - Math.floor(i / 2) * 9, 12, 10, i % 3 ? C.tan : C.oak);
}

function shipShape(ctx: CanvasRenderingContext2D, x: number, y: number, sailing: boolean, frame: number) {
  const bob = frame % 2;
  fill(ctx, x + 4, y + 30 + bob, SHIP_BERTH.w * T - 16, 22, C.walnut);
  fill(ctx, x + 4, y + 48 + bob, SHIP_BERTH.w * T - 16, 4, C.copper);
  fill(ctx, x + SHIP_BERTH.w * T - 14, y + 34 + bob, 10, 14, C.walnut);
  for (const mx of [44, 108]) {
    fill(ctx, x + mx, y - 40 + bob, 3, 72, C.bark);
    if (sailing) fill(ctx, x + mx - 14, y - 34 + bob, 30, 40, C.cream);
  }
  fill(ctx, x + 72, y - 6 + bob, 8, 36, C.brass);
}
