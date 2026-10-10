// The works seen from the play screen (ROADMAP.md 4.3-4.6): the line inspector (hold I), the
// state sounds, the fix ping and the chest fill bar. Kept out of play.ts on purpose.
import { C, PALETTE, rgba } from '../data/palette';
import { ITEM_BY_ID } from '../data/items';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import { diagnose, fmtRate, lineOf, type Diagnosis } from '../sim/lines';
import { MState } from '../sim/mstate';
import { glyphFor, glyphPos } from '../render/glyphs';
import { TILE } from '../render/art/terrain';
import type { PlayScreen } from './play';
import { textWidth, wrapText } from '../ui/font';

interface Ping { sink: number; before: number; at: number; item: string }

export class WorksView {
  /** the line under the cursor while Inspect is held */
  private line: { ver: number; id: number; members: Ent[]; diags: Diagnosis[]; t: number } | null = null;
  /** structure id -> sim time of its last stop sound */
  private sounded = new Map<number, number>();
  private soundT = 0;
  private pings: Ping[] = [];

  // ---------------- the inspector ----------------

  /** the line around `e` (re-walked when the works change, re-diagnosed twice a second) */
  private lineAt(g: Game, e: Ent) {
    const root = e.parent ?? e;
    const L = this.line;
    if (L && L.id === root.id && L.ver === g.ents.version && g.simTime - L.t < 0.5) return L;
    if (L && L.ver === g.ents.version && L.members.includes(root) && g.simTime - L.t < 0.5) return L;
    const { members, sinks } = lineOf(g, root);
    const diags = sinks.slice(0, 4).map((s) => diagnose(g, s));
    this.line = { ver: g.ents.version, id: root.id, members, diags, t: g.simTime };
    return this.line;
  }

  /** world-space part: a brass outline on every member, the problem ringed */
  overlay(play: PlayScreen, ctx: CanvasRenderingContext2D, hover: Ent | null) {
    if (!hover || !play.app.input.isDown('inspect')) return;
    const L = this.lineAt(play.g, hover);
    const blink = 0.55 + 0.3 * Math.sin(play.playtime * 6);
    ctx.lineWidth = 1;
    for (const m of L.members) {
      ctx.strokeStyle = rgba(C.brass, m.belt ? 0.5 : 0.85);
      ctx.strokeRect(m.x * TILE + 0.5, m.y * TILE + 0.5, m.w * TILE - 1, m.h * TILE - 1);
    }
    for (const d of L.diags) {
      if (!d.problem) continue;
      const p = d.problem.e;
      ctx.strokeStyle = rgba(C.rose, blink + 0.15);
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x * TILE - 1, p.y * TILE - 1, p.w * TILE + 2, p.h * TILE + 2);
      ctx.lineWidth = 1;
    }
  }

  /** UI-space part: each sink's rate per day and the diagnosis beside the problem */
  labels(play: PlayScreen, ui: any, hover: Ent | null) {
    if (!hover || !play.app.input.isDown('inspect')) return;
    const L = this.lineAt(play.g, hover);
    const box = (text: string[], x: number, y: number, col: number) => {
      const w = Math.max(...text.map((t) => textWidth(t))) + 8, h = text.length * 9 + 4;
      const bx = Math.round(Math.max(2, Math.min(ui.w - w - 2, x - w / 2))), by = Math.round(Math.max(2, Math.min(ui.h - 70, y - h)));
      ui.fill(bx, by, w, h, C.ink, 0.88);
      ui.fill(bx, by, w, 1, col);
      text.forEach((t, i) => ui.text(t, bx + 4, by + 3 + i * 9, i === 0 ? col : C.cream));
    };
    for (const d of L.diags) {
      const s = d.sink;
      const at = play.toUI(s.x + s.w / 2, s.y);
      box([`${s.def.name}: ${fmtRate(d.rate)}`], at.x, at.y - 4, C.amber);
      if (d.problem) {
        const p = d.problem.e;
        const pa = play.toUI(p.x + p.w / 2, p.y + p.h + 0.2);
        box([...wrapText(d.gap, 180), 'Production (P), Lines: the fixes'], pa.x, pa.y + 40, C.rose);
      }
    }
    if (!L.diags.length) {
      const at = play.toUI(hover.x + hover.w / 2, hover.y);
      box(['This line has no end yet: aim it at a chest or the crate.'], at.x, at.y - 4, C.pebble);
    }
  }

  // ---------------- sounds and the fix ping ----------------

  update(play: PlayScreen, dt: number) {
    const g = play.g;
    this.soundT += dt;
    if (this.soundT >= 0.25 && g.player.where === 'world' && !g.sleeping) {
      this.soundT = 0;
      // one sound when a stop's glyph appears near you (at most once per structure per 30 s)
      const p = g.player;
      for (const list of [g.ents.machines, g.ents.arms, g.ents.others]) {
        for (const e of list) {
          if (Math.abs(e.x - p.x) > 8 || Math.abs(e.y - p.y) > 8) continue;
          const k = glyphFor(g, e);
          if (k !== 'starved' && k !== 'blocked') continue;
          const last = this.sounded.get(e.id) ?? -1e9;
          if (g.simTime - last < 30 || g.simTime - e.since > 6) continue;
          this.sounded.set(e.id, g.simTime);
          play.app.audio.sfx(k === 'starved' ? 'state_starved' : 'state_blocked', 0.7);
        }
      }
    }
    // the fix ping: a sink near a change that got faster
    for (const pg of [...this.pings]) {
      if (g.simTime - pg.at < 60) continue;
      this.pings.splice(this.pings.indexOf(pg), 1);
      const s = g.ents.get(pg.sink);
      if (!s) continue;
      const after = nominal(g, s);
      if (after >= pg.before * 1.25 && after - pg.before >= 1) {
        play.app.renderer.juice.bannerNext({ title: 'Line faster!', sub: `${pg.item}: ${fmtRate(pg.before)} -> ${fmtRate(after)}`, color: C.moss, items: [] });
        play.app.audio.sfx('chime', 0.6);
      }
    }
  }

  /** a structure was placed, removed or rotated at (x, y): remember the lines around it */
  changed(g: Game, x: number, y: number) {
    const seen = new Set<number>();
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const e = g.ents.rootAt(x + dx, y + dy);
        if (!e || e.ghost) continue;
        for (const s of lineOf(g, e).sinks) {
          if (seen.has(s.id) || this.pings.some((p) => p.sink === s.id)) continue;
          seen.add(s.id);
          if (this.pings.length < 6) this.pings.push({ sink: s.id, before: nominal(g, s), at: g.simTime, item: sinkItemName(g, s) });
        }
      }
  }

  // ---------------- the chest fill bar ----------------

  fillBar(ctx: CanvasRenderingContext2D, e: Ent | null) {
    if (!e || e.ghost || !e.inv || (e.def.kind !== 'chest' && e.def.kind !== 'shipbin')) return;
    const used = e.inv.slots.filter(Boolean).length / e.inv.size;
    const x = e.x * TILE + 1, y = (e.y + e.h) * TILE + 1, w = e.w * TILE - 2;
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x - 1, y, w + 2, 4);
    ctx.fillStyle = PALETTE[used >= 1 ? C.brick : used > 0.75 ? C.amber : C.leaf];
    ctx.fillRect(x, y + 1, Math.max(used > 0 ? 1 : 0, Math.round(w * used)), 2);
  }
}

/**
 * A sink's nominal rate a works day (ROADMAP.md 4.3, the fix ping): for the makers nearest it,
 * what they can make flat out times the share of the last minute they spent working.
 */
function nominal(g: Game, sink: Ent): number {
  const d = diagnose(g, sink);
  const makers = d.stages.filter((s) => s.capDay > 0);
  if (!makers.length) return d.rate;
  const near = Math.min(...makers.map((s) => s.depth));
  return makers.filter((s) => s.depth === near).reduce((a, s) => a + s.capDay * g.stats.states.shares(s.e)[MState.Working], 0);
}

function sinkItemName(g: Game, s: Ent): string {
  const d = diagnose(g, s);
  const maker = d.stages.filter((x) => x.e.mach?.recipe).sort((a, b) => a.depth - b.depth)[0];
  const id = maker?.e.mach?.recipe?.out[0].item;
  return id ? ITEM_BY_ID.get(id)?.name ?? 'Goods' : 'Goods';
}

export { glyphPos };
