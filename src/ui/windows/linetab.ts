// The Lines tab of the Production window (ROADMAP.md 4.8): every line end, the chain that feeds
// it with each stage's rate and day split by state, and the diagnosis: the gap in numbers, with
// the fixes behind "?".
import { C } from '../../data/palette';
import { key, kId } from '../../sim/inventory';
import type { Ent } from '../../sim/ents';
import { diagnose, fmtRateIn, lineSinks, perMinUnit, type Diagnosis } from '../../sim/lines';
import { entName } from '../../sim/ents';
import { MState, STATE_COUNT } from '../../sim/mstate';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import type { WinState } from './index';
import { ellipsize, wrapText } from '../font';
import { STATE_COL_PAPER } from '../statelines';
import { ITEM_BY_ID } from '../../data/items';

/** the item a line delivers: what its nearest maker makes, else what the end holds */
function lineItemOf(g: PlayScreen['g'], sink: Ent, d = diagnose(g, sink)): string | null {
  const maker = d.stages.filter((s) => s.e.mach?.recipe || s.e.def.kind === 'gleaner' || s.e.def.kind === 'harvester').sort((a, b) => a.depth - b.depth)[0];
  const out = maker?.e.mach?.recipe?.out[0].item;
  if (out) return out;
  const held = sink.inv?.slots.find(Boolean);
  return held ? ITEM_BY_ID.get(kId(held.k))?.id ?? null : null;
}

/** a line's marker in the list: the colour of its problem (a field-limited line is green, healthy none) */
function markerOf(d: Diagnosis): number | null {
  if (!d.problem) return null;
  if (d.key === 'field') return C.leaf;
  return STATE_COL_PAPER[d.problem.e.state as MState] ?? C.brick;
}

export function linesTab(ui: UI, play: PlayScreen, st: WinState, x: number, y: number, w: number, h: number): boolean {
  const g = play.g;
  // problem lines first (field-limited ones are healthy), then by rate; names made unique
  const rowsAll = lineSinks(g).map((s) => {
    const d = diagnose(g, s);
    const item = lineItemOf(g, s, d);
    return { s, d, item, label: item ? ITEM_BY_ID.get(item)?.name ?? item : s.def.name };
  });
  const bad = (r: { d: Diagnosis }) => (r.d.problem && r.d.key !== 'field' ? 0 : 1);
  rowsAll.sort((a, b) => bad(a) - bad(b));
  const seenName = new Map<string, number>();
  for (const r of rowsAll) {
    const n = (seenName.get(r.label) ?? 0) + 1;
    seenName.set(r.label, n);
    if (n > 1) r.label += ` ${n}`;
  }
  const sinks = rowsAll.map((r) => r.s);
  const lx = x + 10, ly = y + 30, lw = 150, lh = h - 40;
  ui.panel(lx, ly, lw, lh, 'inset', false);
  ui.text('Line ends', lx + 4, ly + 3, C.walnut);
  if (!sinks.length) {
    ui.para('No lines yet. A line ends where an arm or a belt delivers into a chest, the crate or a machine.', lx + 4, ly + 16, lw - 8, C.oak);
    return true;
  }
  if (!sinks.some((s) => s.id === st.data.sink)) st.data.sink = sinks[0].id;
  const rowH = 14;
  const listMin = perMinUnit(sinks.map((s) => g.stats.states.perDay(s, 'in')));
  const off = ui.scrollOffset('linelist', lx, ly + 13, lw, lh - 13, sinks.length * rowH);
  ui.clip(lx, ly + 13, lw, lh - 13);
  rowsAll.forEach(({ s, d: ds, item, label }, i) => {
    const ry = ly + 14 + i * rowH - off;
    if (ry < ly - rowH || ry > ly + lh) return;
    const sel = st.data.sink === s.id;
    const hov = ui.hover(lx, ry, lw - 4, rowH);
    if (hov && !sel) ui.fill(lx + 1, ry, lw - 5, rowH, C.cream);
    if (sel) {
      // a walnut frame reads on the peach panel (butter doesn't)
      ui.fill(lx + 1, ry, lw - 5, rowH, C.tan, 0.35);
      ui.fill(lx + 1, ry, lw - 5, 1, C.walnut);
      ui.fill(lx + 1, ry + rowH - 1, lw - 5, 1, C.walnut);
      ui.fill(lx + 1, ry, 1, rowH, C.walnut);
      ui.fill(lx + lw - 5, ry, 1, rowH, C.walnut);
    }
    // name a line end by what arrives there, so four chests read as four lines
    ui.itemIcon(key(item ?? s.def.item), lx + 3, ry + 1, 12);
    const r = g.stats.states.perDay(s, 'in');
    ui.text(ellipsize(label, 76), lx + 18, ry + 3, C.ink);
    ui.text(fmtRateIn(r, listMin), lx + lw - 14, ry + 3, r > 0 ? C.moss : C.oak, { align: 'right' });
    // the line's problem, in its state's colour
    const mk = markerOf(ds);
    if (mk !== null) {
      ui.fill(lx + lw - 12, ry + 3, 6, 6, C.ink);
      ui.fill(lx + lw - 11, ry + 4, 4, 4, mk);
    }
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
  const li = lineItemOf(g, sink, d);
  const stageRate = (s: Diagnosis['stages'][number]) => (s.capDay > 0 || s.e.arm ? s.outDay : s.inDay);
  const unitMin = perMinUnit([d.rate, ...d.stages.flatMap((s) => [stageRate(s), s.capDay])]);
  // the rate first, so a long name never clips it
  ui.text(ellipsize(`${fmtRateIn(d.rate, unitMin)} into the ${entName(sink).toLowerCase()}${li ? ' (' + (ITEM_BY_ID.get(li)?.name ?? li) + ')' : ''}`, gw - 160), gx + 6, gy + 4, C.ink);
  ui.text('rate  could do  day by state', gx + gw - 6, gy + 4, C.oak, { align: 'right' });
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
    const name = e.mach?.recipe ? `${entName(e)} (${ITEM_BY_ID.get(e.mach.recipe.out[0].item)?.name ?? ''})` : entName(e);
    ui.text(ellipsize(name, gw - 190), gx + 17, ry + 2, isProblem ? C.brick : C.ink);
    ui.text(fmtRateIn(stageRate(s), unitMin), gx + gw - 128, ry + 2, C.moss, { align: 'right' });
    ui.text(s.capDay > 0 ? fmtRateIn(s.capDay, unitMin) : '-', gx + gw - 74, ry + 2, C.oak, { align: 'right' });
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
