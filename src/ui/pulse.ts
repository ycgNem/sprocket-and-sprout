// Factory pulse: how many machines are working, and how many root causes are starved for input,
// blocked, or short of power or fuel (the machine contract's states, src/sim/mstate.ts). The
// problem lamps count what carries a glyph on the map (ROADMAP.md 4.3: root causes only), so the
// lamp and the map agree. Four lamps under the chronometer; clicking one rings those structures.
import { C } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import { MState, stateText } from '../sim/mstate';
import { glyphFor } from '../render/glyphs';
import type { UI } from './ui';
import type { PlayScreen } from '../app/play';

export type PulseKind = 'ok' | 'starved' | 'blocked' | 'power';
export const PULSE_COL: Record<PulseKind, number> = { ok: C.leaf, starved: C.amber, blocked: C.rose, power: C.sky };
const PULSE_NAME: Record<PulseKind, string> = { ok: 'working', starved: 'starved: where a wait for input starts', blocked: 'blocked: where goods have nowhere to go', power: 'short of power or fuel' };

export function machineState(e: Ent): PulseKind | null {
  switch (e.state) {
    case MState.Working: return e.def.powerUse && e.sat < 0.99 ? 'power' : 'ok';
    case MState.Starved: return 'starved';
    case MState.Blocked: return 'blocked';
    case MState.Unpowered:
    case MState.NeedsFuel: return 'power';
  }
  return null;
}

/** the makers the Working lamp counts */
function isMaker(e: Ent): boolean {
  return !!e.mach || /harvester|planter|drill|lab|tapper|fishtrap|gleaner|gantry/.test(e.def.kind);
}

/** what one structure adds to the lamps: a working maker, or a root-cause glyph (dots and sprouts count for nothing) */
export function pulseOf(g: Game, e: Ent): PulseKind | null {
  const k = glyphFor(g, e);
  if (k === 'starved') return 'starved';
  if (k === 'blocked') return 'blocked';
  if (k === 'power' || k === 'fuel') return 'power';
  if (k || e.state !== MState.Working || !isMaker(e)) return null;
  // a maker crawling on a short grid lights the power lamp (ROADMAP.md 4.7)
  return e.def.powerUse && e.sat < 0.99 ? 'power' : 'ok';
}

/** every structure the lamps look at */
export function pulseEnts(g: Game): Ent[] {
  const seen = new Set<number>();
  const out: Ent[] = [];
  for (const e of [...g.ents.machines, ...g.ents.consumers, ...g.ents.arms, ...g.ents.others, ...g.ents.gens, ...g.ents.belts]) {
    if (e.ghost || e.parent || seen.has(e.id) || e.def.kind === 'pole') continue;
    if (!e.mach && !e.arm && !e.belt && !e.inv && !e.gen && !isMaker(e)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/** Draw the lamp strip; returns its height (0 when there are no machines yet). */
export function drawPulse(ui: UI, play: PlayScreen, x: number, y: number, w: number): number {
  const g = play.g;
  if (g.player.where !== 'world') return 0;
  const ents = pulseEnts(g);
  if (!ents.some(isMaker)) return 0;
  const n: Record<PulseKind, number> = { ok: 0, starved: 0, blocked: 0, power: 0 };
  const why: Record<PulseKind, Map<string, number>> = { ok: new Map(), starved: new Map(), blocked: new Map(), power: new Map() };
  for (const e of ents) {
    const s = pulseOf(g, e);
    if (!s) continue;
    n[s]++;
    const label = `${e.def.name}: ${stateText(e).toLowerCase()}`;
    why[s].set(label, (why[s].get(label) ?? 0) + 1);
  }
  const h = 15;
  ui.fill(x, y, w, h, C.ink, 0.88);
  ui.fill(x, y, w, 1, C.brass);
  ui.text('Factory', x + 4, y + 4, C.amber);
  const kinds: PulseKind[] = ['ok', 'starved', 'blocked', 'power'];
  const cellW = Math.floor((w - 44) / 4);
  kinds.forEach((k, i) => {
    const cx = x + 42 + i * cellW;
    const lit = n[k] > 0;
    const blink = k !== 'ok' && lit && Math.sin(ui.time * 5) > 0.2;
    ui.fill(cx, y + 4, 7, 7, C.ink);
    ui.fill(cx + 1, y + 5, 5, 5, lit ? PULSE_COL[k] : C.slate);
    if (lit) ui.fill(cx + 2, y + 6, 1, 1, C.cream);
    if (blink) ui.fill(cx - 1, y + 3, 9, 1, PULSE_COL[k]);
    ui.text(String(n[k]), cx + 10, y + 4, lit ? C.cream : C.stone);
    if (ui.hover(cx - 2, y, cellW, h)) {
      const lines = [{ text: k === 'ok' ? `${n[k]} machine${n[k] === 1 ? '' : 's'} working` : `${n[k]} ${PULSE_NAME[k]}`, color: PULSE_COL[k] }];
      for (const [label, c] of [...why[k]].sort((a, b) => b[1] - a[1]).slice(0, 5)) lines.push({ text: `${c} x ${label}`, color: C.pebble });
      if (n[k]) lines.push({ text: 'Click to highlight them on the farm.', color: C.stone });
      ui.tip(lines);
      if (ui.clicked && n[k]) {
        ui.eat();
        play.pulseFocus = { kind: k, t: 4 };
        ui.sfx('click');
      }
    }
  });
  if (ui.hover(x, y, w, h)) ui.block(x, y, w, h);
  return h;
}
