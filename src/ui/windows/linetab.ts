// The Lines tab of the Production window (ROADMAP.md 4.8): every line end, the chain that feeds
// it with each stage's rate and day split by state, and the diagnosis: the gap in numbers, with
// the fixes behind "?".
import { C } from '../../data/palette';
import { key, kId } from '../../sim/inventory';
import type { Ent } from '../../sim/ents';
import { diagnose, fmtRate, lineSinks } from '../../sim/lines';
import { MState, STATE_COUNT } from '../../sim/mstate';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import type { WinState } from './index';
import { ellipsize, wrapText } from '../font';
import { STATE_COL_PAPER } from '../statelines';
import { ITEM_BY_ID } from '../../data/items';

/** the item a line delivers: what its nearest maker makes, else what the end holds */
function lineItemOf(g: PlayScreen['g'], sink: Ent): string | null {
  const d = diagnose(g, sink);
  const maker = d.stages.filter((s) => s.e.mach?.recipe || s.e.def.kind === 'gleaner' || s.e.def.kind === 'harvester').sort((a, b) => a.depth - b.depth)[0];
  const out = maker?.e.mach?.recipe?.out[0].item;
  if (out) return out;
  const held = sink.inv?.slots.find(Boolean);
  return held ? ITEM_BY_ID.get(kId(held.k))?.id ?? null : null;
}

export function linesTab(ui: UI, play: PlayScreen, st: WinState, x: number, y: number, w: number, h: number): boolean {
  const g = play.g;
  const sinks = lineSinks(g);
  const lx = x + 10, ly = y + 30, lw = 150, lh = h - 40;
  ui.panel(lx, ly, lw, lh, 'inset', false);
  ui.text('Line ends', lx + 4, ly + 3, C.walnut);
  if (!sinks.length) {
    ui.para('No lines yet. A line ends where an arm or a belt delivers into a chest, the crate or a machine.', lx + 4, ly + 16, lw - 8, C.oak);
    return true;
  }
  if (!sinks.some((s) => s.id === st.data.sink)) st.data.sink = sinks[0].id;
  const rowH = 14;
  const off = ui.scrollOffset('linelist', lx, ly + 13, lw, lh - 13, sinks.length * rowH);
  ui.clip(lx, ly + 13, lw, lh - 13);
  sinks.forEach((s, i) => {
    const ry = ly + 14 + i * rowH - off;
    if (ry < ly - rowH || ry > ly + lh) return;
    const sel = st.data.sink === s.id;
    const hov = ui.hover(lx, ry, lw - 4, rowH);
    if (sel || hov) ui.fill(lx + 1, ry, lw - 5, rowH, sel ? C.butter : C.cream);
    // name a line end by what arrives there, so four chests read as four lines
    const item = lineItemOf(g, s);
    ui.itemIcon(key(item ?? s.def.item), lx + 3, ry + 1, 12);
    const r = g.stats.states.perDay(s, 'in');
    ui.text(ellipsize(item ? ITEM_BY_ID.get(item)?.name ?? item : s.def.name, 84), lx + 18, ry + 3, C.ink);
    ui.text(fmtRate(r), lx + lw - 8, ry + 3, r > 0 ? C.moss : C.oak, { align: 'right' });
    if (hov && ui.clicked) {
      ui.eat();
      st.data.sink = s.id;
      st.data.showFix = false;
    }
  });
  ui.unclip();
  // the chain and its diagnosis
  const sink = g.ents.get(st.data.sink);
  if (!sink) return true;
  const d = diagnose(g, sink);
  const gx = lx + lw + 8, gy = ly, gw = w - lw - 28, gh = lh;
  ui.panel(gx, gy, gw, gh, 'inset', false);
  const li = lineItemOf(g, sink);
  ui.text(ellipsize(`${sink.def.name}${li ? ' (' + (ITEM_BY_ID.get(li)?.name ?? li) + ')' : ''}: ${fmtRate(d.rate)}`, gw - 170), gx + 6, gy + 4, C.ink);
  ui.text('rate   could do   the day by state', gx + gw - 6, gy + 4, C.oak, { align: 'right' });
  // diagnosis box at the bottom
  const gapLines = wrapText(d.gap, gw - 44);
  const fixLines = st.data.showFix ? wrapText('Try: ' + d.fix, gw - 44) : [];
  const dh = 8 + (gapLines.length + fixLines.length) * 9;
  const dy = gy + gh - dh - 4;
  // stages, sources first
  const rows = d.stages.slice(-Math.max(1, Math.floor((dy - gy - 22) / 13)));
  rows.forEach((s, i) => {
    const ry = gy + 16 + i * 13;
    const e = s.e;
    const isProblem = d.problem?.e === e;
    if (isProblem) ui.fill(gx + 2, ry - 1, gw - 4, 12, C.blush);
    ui.itemIcon(key(e.def.item), gx + 4, ry, 10);
    const name = e.mach?.recipe ? `${e.def.name} (${ITEM_BY_ID.get(e.mach.recipe.out[0].item)?.name ?? ''})` : e.def.name;
    ui.text(ellipsize(name, gw - 190), gx + 17, ry + 2, isProblem ? C.brick : C.ink);
    const rate = s.capDay > 0 || e.arm ? s.outDay : s.inDay;
    ui.text(fmtRate(rate), gx + gw - 128, ry + 2, C.moss, { align: 'right' });
    ui.text(s.capDay > 0 ? fmtRate(s.capDay) : '-', gx + gw - 74, ry + 2, C.oak, { align: 'right' });
    // the day split by state, 60 px
    const bx = gx + gw - 66, bw = 60;
    ui.fill(bx - 1, ry, bw + 2, 9, C.ink);
    let cx = bx;
    for (let k = 0; k < STATE_COUNT; k++) {
      const share = k === MState.Idle && s.harvestWait > 0 ? s.shares[k] - s.harvestWait : s.shares[k];
      const pw = Math.round(share * bw);
      if (pw <= 0) continue;
      ui.fill(cx, ry + 1, Math.min(pw, bx + bw - cx), 7, STATE_COL_PAPER[k as MState]);
      cx += pw;
    }
    // waiting for harvest: green, not a warning
    if (s.harvestWait > 0) {
      const pw = Math.round(s.harvestWait * bw);
      ui.fill(cx, ry + 1, Math.max(0, Math.min(pw, bx + bw - cx)), 7, C.leaf);
    }
  });
  if (d.belts) ui.text(`+ ${d.belts} belt tile${d.belts === 1 ? '' : 's'}`, gx + 17, gy + 16 + rows.length * 13 + 1, C.oak);
  ui.panel(gx + 3, dy, gw - 6, dh, 'paper', false);
  gapLines.forEach((l, i) => ui.text(l, gx + 8, dy + 4 + i * 9, d.problem ? C.brick : C.moss));
  fixLines.forEach((l, i) => ui.text(l, gx + 8, dy + 4 + (gapLines.length + i) * 9, C.walnut));
  if (ui.button('linefix', gx + gw - 22, dy + 2, 14, 12, '?', { style: 'flat', active: !!st.data.showFix, tip: st.data.showFix ? 'Hide the fixes' : 'Show what would fix it' })) st.data.showFix = !st.data.showFix;
  // legend
  const lg: [number, string][] = [[STATE_COL_PAPER[MState.Working], 'working'], [STATE_COL_PAPER[MState.Starved], 'starved'], [STATE_COL_PAPER[MState.Blocked], 'blocked'], [STATE_COL_PAPER[MState.Unpowered], 'power'], [C.leaf, 'harvest']];
  let lx2 = gx + 6;
  for (const [col, t] of lg) {
    ui.fill(lx2, dy - 9, 5, 5, col);
    ui.text(t, lx2 + 7, dy - 10, C.oak);
    lx2 += 12 + t.length * 5;
  }
  return true;
}
