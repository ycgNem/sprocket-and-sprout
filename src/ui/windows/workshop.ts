// Workshop HQ's windows (ROADMAP.md 7.8): the Ledger (the almanac's job now: yesterday's sales by
// customer, what's saturated at market, the week ahead) and the Drafting Table (the blueprint
// library: save the blueprint tool's copy under a name, load one back, rename, delete, see it drawn,
// and bench-test it on the Sprocket Fair's plate).
import { C } from '../../data/palette';
import { ITEMS } from '../../data/items';
import { SEASON_NAMES } from '../../data/types';
import { keyLabel } from '../../engine/input';
import type { Blueprint } from '../../sim/blueprint';
import { addBlueprint, cloneBlueprint, drafting, fits, LIB_MAX } from '../../sim/drafting';
import { kDef, key } from '../../sim/inventory';
import { BED } from '../../sim/testbed';
import { satFactor } from '../../sim/systems/economy';
import { ledgerDay, type AlmanacBits, type LedgerRow } from '../../sim/systems/house';
import { custName, villagerName } from '../../sim/systems/orders';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ellipsize, wrapText, ICON } from '../font';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { drawBlueprint, machinesOf } from './fair';

// ---------------- the ledger ----------------
type Line = { text: string; color: number; indent?: number; icon?: number };

/** yesterday's rows, grouped: each customer's order first (largest first), then the market */
function salesLines(rows: LedgerRow[], w: number): Line[] {
  const out: Line[] = [];
  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const g = groups.get(r.to) ?? [];
    g.push(r);
    groups.set(r.to, g);
  }
  const total = (rs: LedgerRow[]) => rs.reduce((a, r) => a + r.coins, 0);
  const order = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : total(groups.get(b)!) - total(groups.get(a)!)));
  for (const cust of order) {
    const rs = groups.get(cust)!.sort((a, b) => b.coins - a.coins);
    out.push({ text: `${cust ? custName(cust) : 'The market'}: ${ICON.coin}${total(rs).toLocaleString()}`, color: cust ? C.moss : C.ink });
    for (const r of rs.slice(0, 4)) out.push({ text: ellipsize(`${r.n} ${kDef(r.k).name}  ${ICON.coin}${r.coins.toLocaleString()}`, w - 24), color: C.walnut, indent: 18, icon: r.k });
    if (rs.length > 4) out.push({ text: `and ${rs.length - 4} more`, color: C.oak, indent: 18 });
  }
  return out;
}

/** the goods the market has seen too much of lately, most saturated first */
function saturated(play: PlayScreen): { idx: number; f: number }[] {
  const g = play.g;
  const sat = (g.sys.market?.sat ?? {}) as Record<number, number>;
  return Object.keys(sat).map(Number).filter((idx) => ITEMS[idx] && ITEMS[idx].price > 0)
    .map((idx) => ({ idx, f: satFactor(g, idx) })).filter((s) => s.f < 0.97).sort((a, b) => a.f - b.f).slice(0, 6);
}

function column(ui: UI, id: string, lines: Line[], x: number, y: number, w: number, h: number) {
  const lh = 11;
  const off = ui.scrollOffset(id, x, y, w, h, lines.length * lh + 4);
  ui.clip(x, y, w, h);
  lines.forEach((l, i) => {
    const ly = y + 2 + i * lh - off;
    if (ly < y - lh || ly > y + h) return;
    const ix = x + (l.indent ?? 0);
    if (l.icon !== undefined) ui.itemIcon(l.icon, ix - 13, ly - 1, 10);
    ui.text(l.text, ix, ly, l.color);
  });
  ui.unclip();
}

function drawLedger(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const bits = st.arg as AlmanacBits | undefined;
  const W = Math.min(ui.w - 20, 460), H = Math.min(ui.h - 30, 290);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, 'The Ledger')) return false;
  const colW = Math.floor((W - 30) / 2);
  const lx = x + 10, rx = x + 20 + colW, top = y + 14, bodyH = H - 24;
  // left: yesterday's sales, by who bought them
  const L = ledgerDay(g);
  const left: Line[] = [];
  if (!L) left.push(...wrapText("The ledger starts tonight: tomorrow it shows what the day sold, and who bought it.", colW - 6).map((t) => ({ text: t, color: C.walnut })));
  else {
    left.push({ text: `${SEASON_NAMES[L.season]} ${L.day}: ${ICON.coin}${L.total.toLocaleString()}`, color: C.ink });
    if (!L.rows.length) left.push(...wrapText('Nothing went out that day. A tagged crate or a line to the crate earns while you sleep.', colW - 6).map((t) => ({ text: t, color: C.walnut })));
    else left.push(...salesLines(L.rows, colW));
  }
  ui.text('Yesterday', lx, top, C.amber);
  ui.panel(lx, top + 10, colW, bodyH - 14, 'inset', false);
  column(ui, 'ledger_l', left, lx + 4, top + 13, colW - 8, bodyH - 20);
  // right: the market now, then the almanac's page
  const right: Line[] = [];
  const sat = saturated(play);
  if (sat.length) {
    right.push({ text: 'Saturated at market (price now):', color: C.ink });
    for (const s of sat) right.push({ text: ellipsize(`${ITEMS[s.idx].name}  ${Math.round(s.f * 100)}%`, colW - 30), color: s.f < 0.7 ? C.brick : C.walnut, indent: 18, icon: s.idx * 4 });
  } else right.push({ text: 'Nothing saturated: every price is whole.', color: C.moss });
  if (bits) {
    const para = (t: string, color: number) => {
      if (!t) return;
      right.push({ text: '', color });
      for (const l of wrapText(t, colW - 10)) right.push({ text: l, color });
    };
    para(`In demand this week: ${bits.hot}.`, C.ink);
    para(`Tomorrow will be ${bits.tomorrow}.`, C.ink);
    para(`Coming up: ${bits.soon.length ? bits.soon.join('; ') : 'a quiet week'}.`, C.walnut);
    para(bits.season, C.walnut);
    para(bits.recipe, C.moss);
    para(`Keeper's note: ${bits.tip}`, C.oak);
  }
  ui.text('The market and the week', rx, top, C.amber);
  ui.panel(rx, top + 10, colW, bodyH - 14, 'inset', false);
  column(ui, 'ledger_r', right, rx + 4, top + 13, colW - 8, bodyH - 20);
  return true;
}

// ---------------- the drafting table ----------------
const describe = (bp: Blueprint) => `${bp.w}x${bp.h}, ${bp.items.length} piece${bp.items.length === 1 ? '' : 's'}${fits(bp, BED, BED) ? ", fits the Fair's plate" : ''}`;

/**
 * The drafting table: the blueprint tool's copy (save it under a name), the library, and the chosen
 * line drawn with the structure sprites at the largest whole scale that fits, with what you can do
 * with it: bench-test it on the Sprocket Fair's plate against this year's entries
 * (src/ui/windows/fair.ts), load it into the blueprint tool, or delete it. `st.arg.sel` reopens on
 * a line (the bench test's Back).
 */
function drawDrafting(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const lib = drafting(g).lib;
  const W = Math.min(ui.w - 20, 440), H = Math.min(ui.h - 30, 280);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, 'Drafting Table')) {
    ui.focus = null;
    return false;
  }
  st.data.btn = {};
  const binds = play.app.input.binds;
  const copyKey = keyLabel(binds.copy?.[0] ?? 'KeyV'), pasteKey = keyLabel(binds.paste?.[0] ?? 'KeyB');
  const bp = play.blueprint;
  // the chosen line: 'tool' (the blueprint tool's copy) or a library index
  if (st.data.sel === undefined) st.data.sel = st.arg?.sel ?? (lib.length || !bp?.items.length ? 0 : 'tool');
  if (st.data.sel === 'tool' && !bp?.items.length) st.data.sel = 0;
  if (typeof st.data.sel === 'number') st.data.sel = Math.max(0, Math.min(st.data.sel, lib.length - 1));
  // the blueprint tool's copy, and saving it under a name (clear of the frame's close button)
  ui.panel(x + 10, y + 20, W - 20, 40, 'inset', false);
  if (bp && bp.items.length) {
    const fx = x + W - 172;
    if (st.data.sel === 'tool') ui.fill(x + 10, y + 20, 2, 40, C.amber);
    ui.text('In the blueprint tool:', x + 16, y + 25, C.ink);
    ui.text(ellipsize(describe(bp), fx - x - 22), x + 16, y + 36, C.walnut);
    st.data.btn.tool = [x + 12, y + 22, fx - x - 16, 36];
    if (ui.hover(x + 12, y + 22, fx - x - 16, 36)) {
      ui.tip([{ text: "The blueprint tool's copy", color: C.amber }, { text: 'Click to see it drawn, and to bench-test it', color: C.pebble }]);
      if (ui.clicked) {
        ui.eat();
        st.data.sel = 'tool';
        ui.sfx('click');
      }
    }
    st.data.name ??= `Line ${lib.length + 1}`;
    st.data.name = ui.textField('bpname', fx, y + 26, 110, st.data.name, 18);
    const full = lib.length >= LIB_MAX;
    if (ui.button('bpsave', fx + 114, y + 26, 44, 16, 'Save', { style: 'green', disabled: full || !st.data.name.trim(), tip: full ? `The library holds ${LIB_MAX}: delete one first` : 'Save it in the library' })) {
      if (addBlueprint(g, st.data.name, bp)) {
        play.toast(`Saved "${lib[lib.length - 1].name}" in the library.`);
        ui.sfx('place');
        st.data.name = undefined;
        st.data.sel = lib.length - 1;
        ui.focus = null;
      }
    }
    if (full) ui.text(`The library is full (${LIB_MAX}).`, fx, y + 45, C.brick);
  } else {
    ui.para(`The blueprint tool is empty. Outside, ${copyKey} and a drag copy a line; come back to save it here.`, x + 16, y + 26, W - 32, C.walnut);
  }
  // the library (left) and the chosen line, drawn (right)
  const pw = 112, px = x + W - 10 - pw;
  const lx = x + 10, lw = px - 8 - lx;
  ui.text(`The library (${lib.length}/${LIB_MAX})`, lx + 2, y + 66, C.amber);
  const ly = y + 78, lh = H - 78 - 22;
  ui.panel(lx, ly - 2, lw, lh + 4, 'inset', false);
  if (!lib.length) ui.para('Saved lines are listed here, to load back into the blueprint tool and paste, to bench-test, or to bring to the Sprocket Fair.', lx + 6, ly + 4, lw - 12, C.walnut);
  const rowH = 24;
  const off = ui.scrollOffset('bplib', lx, ly, lw, lh, lib.length * rowH);
  ui.clip(lx, ly, lw, lh);
  lib.forEach((e, i) => {
    const ry = ly + i * rowH - off;
    if (ry < ly - rowH || ry > ly + lh) return;
    const sel = st.data.sel === i;
    st.data.btn['row' + i] = [lx + 2, ry, lw - 4, rowH - 1];
    const hov = ui.hover(lx + 2, ry, lw - 4, rowH - 1);
    if (sel) {
      ui.fill(lx + 2, ry, lw - 4, rowH - 1, C.amber, 0.4);
      ui.fill(lx + 2, ry, 2, rowH - 1, C.amber);
    } else if (hov || i % 2) ui.fill(lx + 2, ry, lw - 4, rowH - 1, C.tan, hov ? 0.55 : 0.3);
    // its machines, as icons
    const icons = machinesOf(e.bp).slice(0, 3);
    icons.forEach((id, k) => ui.itemIcon(key(id), lx + 6 + k * 13, ry + 6, 12));
    const tx = lx + 10 + Math.max(1, icons.length) * 13;
    const nameW = Math.min(150, lx + lw - tx - 6);
    if (st.data.edit === i) {
      e.name = ui.textField('bpren' + i, tx, ry + 2, nameW, e.name, 18) || e.name;
      if (ui.focus !== 'bpren' + i) st.data.edit = undefined;
    } else {
      ui.text(ellipsize(e.name + (e.from ? `  (${villagerName(e.from)}'s drawing)` : ''), lx + lw - tx - 6), tx, ry + 3, C.ink);
      if (sel && ui.hover(tx, ry + 1, nameW, 10)) ui.tip([{ text: e.name, color: C.amber }, { text: 'Click to rename', color: C.pebble }]);
    }
    if (st.data.edit !== i) ui.text(ellipsize(describe(e.bp), lx + lw - tx - 6), tx, ry + 13, C.walnut);
    if (hov && ui.clicked && st.data.edit !== i) {
      ui.eat();
      // a click on the chosen line's name renames it; anywhere else on a row chooses it
      if (sel && ui.hover(tx, ry + 1, nameW, 10)) {
        st.data.edit = i;
        ui.focus = 'bpren' + i;
      } else {
        st.data.sel = i;
        st.data.del = undefined;
        ui.sfx('click');
      }
    }
  });
  ui.unclip();
  // the chosen line, drawn, and what to do with it
  const tool = st.data.sel === 'tool';
  const chosen = tool ? (bp?.items.length ? { name: 'Your blueprint tool copy', bp } : null) : lib[st.data.sel as number] ?? null;
  const py = y + 78;
  if (chosen) {
    const sc = drawBlueprint(ui, play, chosen.bp, px, py, pw, pw);
    ui.text(sc ? `Drawn ${sc}:1` : 'Its corner, 1:1', px + pw, y + 66, C.oak, { align: 'right' });
    let by = py + pw + 4;
    const fair = fits(chosen.bp, BED, BED);
    st.data.btn.bench = [px, by, pw, 16];
    if (ui.button('bpbench', px, by, pw, 16, 'Bench test', { style: 'green', disabled: !fair, tip: fair ? "Runs it on the Sprocket Fair's 6x6 plate for five minutes and scores it against this year's entries" : `${chosen.bp.w}x${chosen.bp.h}: bigger than the Fair's 6x6 plate` })) {
      ui.focus = null;
      play.openWindow('bench', { name: chosen.name, bp: chosen.bp, sel: st.data.sel });
      return true;
    }
    by += 18;
    if (!tool) {
      const e = chosen as (typeof lib)[number];
      const i = st.data.sel as number;
      st.data.btn.load = [px, by, pw, 16];
      if (ui.button('bpload', px, by, pw, 16, 'Load', { tip: `Into the blueprint tool: outside, ${pasteKey} pastes it` })) {
        play.blueprint = cloneBlueprint(e.bp);
        play.toast(`"${e.name}" is in the blueprint tool. Outside, ${pasteKey} pastes it; missing pieces wait as ghosts.`);
        ui.sfx('open');
      }
      by += 18;
      const sure = st.data.del === i;
      if (ui.button('bpdel', px, by, pw, 16, sure ? 'Sure? Delete it' : 'Delete', { style: sure ? 'red' : 'flat' })) {
        if (sure) {
          lib.splice(i, 1);
          st.data.del = undefined;
          st.data.edit = undefined;
          st.data.sel = Math.max(0, i - 1);
          ui.sfx('pickup');
        } else st.data.del = i;
      }
    }
  } else ui.para('Choose a line to see it drawn.', px + 4, py + 4, pw - 8, C.walnut);
  ui.text(`Load puts a line in the blueprint tool; outside, ${pasteKey} pastes it.`, x + 12, y + H - 16, C.oak);
  return true;
}

registerWindow('ledger', { draw: drawLedger });
registerWindow('drafting', { draw: drawDrafting, onClose: (play) => { play.app.ui.focus = null; } });
