// Factory pulse: how many machines are working, starved for input, or blocked.
// Shown as three lamps under the chronometer; clicking a lamp highlights those machines.
import { C } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Ent } from '../sim/ents';
import type { UI } from './ui';
import type { PlayScreen } from '../app/play';

export type PulseKind = 'ok' | 'starved' | 'blocked';
export const PULSE_COL: Record<PulseKind, number> = { ok: C.leaf, starved: C.amber, blocked: C.rose };
const PULSE_NAME: Record<PulseKind, string> = { ok: 'working', starved: 'waiting for input', blocked: 'blocked (output full or no power)' };

export function machineState(e: Ent): PulseKind | null {
  const status: string = e.mach?.status ?? e.st.status ?? '';
  if (/full|power|blocked/i.test(status)) return 'blocked';
  if (e.working) return 'ok';
  if (/waiting|missing|needs|pick a recipe/i.test(status)) return 'starved';
  return null;
}

export function pulseEnts(g: Game): Ent[] {
  const seen = new Set<number>();
  const out: Ent[] = [];
  for (const e of [...g.ents.machines, ...g.ents.consumers]) {
    if (e.ghost || seen.has(e.id) || e.def.kind === 'pole' || e.def.kind === 'arm') continue;
    if (!e.mach && !/harvester|planter|drill|lab|tapper|fishtrap/.test(e.def.kind)) continue;
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
  if (!ents.length) return 0;
  const n: Record<PulseKind, number> = { ok: 0, starved: 0, blocked: 0 };
  const why: Record<PulseKind, Map<string, number>> = { ok: new Map(), starved: new Map(), blocked: new Map() };
  for (const e of ents) {
    const s = machineState(e);
    if (!s) continue;
    n[s]++;
    const label = `${e.def.name}: ${(e.mach?.status ?? e.st.status ?? '').toLowerCase()}`;
    why[s].set(label, (why[s].get(label) ?? 0) + 1);
  }
  const h = 15;
  ui.fill(x, y, w, h, C.ink, 0.88);
  ui.fill(x, y, w, 1, C.brass);
  ui.text('Factory', x + 4, y + 4, C.amber);
  const kinds: PulseKind[] = ['ok', 'starved', 'blocked'];
  const cellW = Math.floor((w - 44) / 3);
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
      const lines = [{ text: `${n[k]} machine${n[k] === 1 ? '' : 's'} ${PULSE_NAME[k]}`, color: PULSE_COL[k] }];
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
