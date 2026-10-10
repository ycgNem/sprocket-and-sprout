// State glyphs (ROADMAP.md 4.3): one 7 px mark over the structure that causes a stop, a faint dot
// over the ones that only suffer from it, a sprout over a field machine waiting for its crops.
// Imported sprites `fx:state:<kind>` win; until Phase 6 the marks are drawn here in code.
import { C, PALETTE, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import { FIELD_KINDS, feedersOf, takersOf } from '../sim/lines';
import { MState, glyphDelay, isProblem, stateAge } from '../sim/mstate';
import { drawSprite, hasImage, sprite } from './atlas';
import { EXTRA_TOP } from './art/structs';
import { RESEARCH } from '../data/research';
import { ITEM_BY_ID, matchesSpec } from '../data/items';
import { keystoneOpen } from '../sim/keystones';
import { stages } from '../sim/systems/research';

export type GlyphKind = 'starved' | 'blocked' | 'power' | 'fuel' | 'sprout' | 'dot';

const KIND_OF: Partial<Record<MState, GlyphKind>> = {
  [MState.Starved]: 'starved',
  [MState.Blocked]: 'blocked',
  [MState.Unpowered]: 'power',
  [MState.NeedsFuel]: 'fuel',
};

/** a stage's problem comes from its neighbour (so the neighbour carries the glyph) */
function isSymptom(g: Game, e: Ent): boolean {
  // starved because its feeder is starved, unpowered, or stopped by an item this one can't use
  if (e.state === MState.Starved) return feedersOf(g, e).some((f) => f.state === MState.Starved || f.state === MState.Unpowered || f.state === MState.NeedsFuel || (f.state === MState.Blocked && f.refused !== undefined));
  if (e.state === MState.Blocked) return takersOf(g, e).some((t) => t.state === MState.Blocked);
  return false;
}

/** What to draw over a structure right now (null = nothing). */
export function glyphFor(g: Game, e: Ent): GlyphKind | null {
  if (e.ghost) return null;
  if (FIELD_KINDS.has(e.def.kind) && e.state === MState.Idle && /^(Next ripe|Ripe|No crops)/.test(e.why)) return 'sprout';
  if (!isProblem(e.state)) return null;
  if (stateAge(e, g.simTime) < glyphDelay(e)) return null;
  if (isSymptom(g, e)) return 'dot';
  return KIND_OF[e.state] ?? null;
}

/** where a structure's glyph hangs (world px, top-left of a 9 px box) */
export function glyphPos(e: Ent): { x: number; y: number } {
  const top = e.arm ? 8 : e.belt ? 2 : EXTRA_TOP[e.def.id] ?? 4;
  return { x: Math.round(e.x * 16 + e.w * 8 - 4), y: Math.round(e.y * 16 - top - 11) };
}

/** Draw one glyph at world px (x, y) = the top-left of its 9x9 box. */
export function drawGlyph(ctx: CanvasRenderingContext2D, kind: GlyphKind, x: number, y: number, time: number) {
  const bob = kind === 'dot' ? 0 : Math.round(Math.sin(time * 4) * 0.8);
  y += bob;
  const name = `fx:state:${kind}`;
  if (hasImage(name)) {
    drawSprite(ctx, sprite(name), x, y);
    return;
  }
  const px = (xx: number, yy: number, w: number, h: number, c: number, a = 1) => {
    ctx.fillStyle = a >= 1 ? PALETTE[c] : rgba(c, a);
    ctx.fillRect(x + xx, y + yy, w, h);
  };
  if (kind === 'dot') {
    px(3, 5, 3, 3, C.ink, 0.35);
    px(4, 6, 1, 1, C.cream, 0.5);
    return;
  }
  if (kind === 'sprout') {
    // a seedling on a mound in a pale ink-rimmed badge: "growing, come back later" (reads on soil)
    px(1, 0, 7, 9, C.ink);
    px(0, 1, 9, 7, C.ink);
    px(1, 1, 7, 7, C.cream);
    px(2, 6, 5, 2, C.walnut);
    px(4, 3, 1, 3, C.moss);
    px(2, 2, 2, 2, C.leaf);
    px(5, 2, 2, 2, C.leaf);
    return;
  }
  const fill = kind === 'starved' ? C.amber : kind === 'blocked' ? C.brick : kind === 'power' ? C.sky : C.stone;
  // a rounded 9x9 badge with an ink rim
  px(1, 0, 7, 9, C.ink);
  px(0, 1, 9, 7, C.ink);
  px(1, 1, 7, 7, fill);
  px(1, 1, 7, 1, kind === 'blocked' ? C.terracotta : kind === 'starved' ? C.butter : kind === 'power' ? C.aqua : C.pebble);
  switch (kind) {
    case 'starved':
      // an open mouth waiting for something: a down arrow into a cup
      px(4, 2, 1, 3, C.ink);
      px(3, 4, 3, 1, C.ink);
      px(2, 6, 1, 1, C.ink);
      px(6, 6, 1, 1, C.ink);
      px(2, 7, 5, 1, C.ink);
      break;
    case 'blocked':
      px(2, 4, 5, 2, C.cream);
      break;
    case 'power':
      // a bolt
      px(5, 2, 1, 2, C.ink);
      px(4, 3, 1, 2, C.ink);
      px(3, 4, 3, 1, C.ink);
      px(4, 5, 1, 2, C.ink);
      px(3, 6, 1, 1, C.ink);
      break;
    case 'fuel':
      // a flame
      px(4, 2, 1, 1, C.ember);
      px(3, 3, 3, 2, C.ember);
      px(3, 5, 3, 2, C.amber);
      px(4, 6, 1, 1, C.butter);
      break;
  }
}

/**
 * A keystone's validate stage on screen (the critic's M1): a ring over each machine making its item,
 * filling as the minutes are held, so "keep it running" is something you can watch.
 */
function drawValidateRings(ctx: CanvasRenderingContext2D, g: Game, visible: (e: Ent) => boolean, time: number) {
  for (const r of RESEARCH) {
    const v = r.keystone?.validate;
    if (!v || g.flags.has('validated:' + r.id) || !keystoneOpen(g, r.id)) continue;
    const s = stages(g, r.id);
    if (s.observe === false || s.experiment === false || !s.need) continue;
    const k = s.held / s.need;
    for (const e of g.ents.machines) {
      const out = e.mach?.recipe?.out[0]?.item;
      const def = out ? ITEM_BY_ID.get(out) : undefined;
      if (e.ghost || !visible(e) || !def || !matchesSpec(def, v.item)) continue;
      // a pixel gauge on the machine itself, at its footprint's top edge (not a smooth arc floating
      // over the roof: the critic): twelve 2x2 pips, lit clockwise from the top as the minutes are
      // held, and a pulse in the middle while it's counting
      const cx = Math.round(e.x * 16 + e.w * 8), cy = Math.round(e.y * 16 + 4);
      const lit = Math.round(k * 12);
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * 5) - 1, y = Math.round(cy + Math.sin(a) * 5) - 1;
        ctx.fillStyle = rgba(C.ink, 0.7);
        ctx.fillRect(x - 1, y - 1, 4, 4);
        ctx.fillStyle = i < lit ? PALETTE[C.lime] : rgba(C.pebble, 0.8);
        ctx.fillRect(x, y, 2, 2);
      }
      if (k > 0) {
        ctx.fillStyle = rgba(C.lime, 0.45 + 0.3 * Math.sin(time * 5));
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
  }
}

/** All glyphs over the visible works (called by the renderer after the sorted sprites). */
export function drawStateGlyphs(ctx: CanvasRenderingContext2D, g: Game, tx0: number, ty0: number, tx1: number, ty1: number, time: number) {
  const visible = (e: Ent) => e.x + e.w >= tx0 && e.x <= tx1 && e.y + e.h >= ty0 && e.y <= ty1 + 2;
  drawValidateRings(ctx, g, visible, time);
  const lists = [g.ents.machines, g.ents.arms, g.ents.others, g.ents.gens, g.ents.belts];
  for (const list of lists)
    for (const e of list) {
      if (e.parent || !visible(e)) continue;
      // belts show only real blocks (a queue is Working)
      if (e.belt && e.state !== MState.Blocked) continue;
      const k = glyphFor(g, e);
      // a backed-up belt run shows one glyph at its cause, not a dot on every tile
      if (!k || (e.belt && k === 'dot')) continue;
      const p = glyphPos(e);
      drawGlyph(ctx, k, p.x, p.y, time + e.id * 0.37);
    }
}
