// Workshop HQ's windows (ROADMAP.md 7.8): the Ledger (the almanac's job now: yesterday's sales by
// customer, what's saturated at market, the week ahead) and the Drafting Table (the blueprint
// library: save the blueprint tool's copy under a name, load one back, rename, delete).
import { C } from '../../data/palette';
import { ITEMS } from '../../data/items';
import { SEASON_NAMES } from '../../data/types';
import { STRUCT_BY_ID } from '../../data/structures';
import { keyLabel } from '../../engine/input';
import type { Blueprint } from '../../sim/blueprint';
import { addBlueprint, cloneBlueprint, drafting, fits, LIB_MAX } from '../../sim/drafting';
import { kDef } from '../../sim/inventory';
import { satFactor } from '../../sim/systems/economy';
import { ledgerDay, type AlmanacBits, type LedgerRow } from '../../sim/systems/house';
import { custName, villagerName } from '../../sim/systems/orders';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ellipsize, wrapText, ICON } from '../font';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';

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
/** a blueprint's tiny plan: one dot per tile, coloured by what stands there */
function thumb(ui: UI, bp: Blueprint, x: number, y: number, size: number) {
  ui.fill(x, y, size, size, C.ink);
  ui.fill(x + 1, y + 1, size - 2, size - 2, C.deepsea);
  const px = Math.max(1, Math.floor((size - 2) / Math.max(bp.w, bp.h)));
  const ox = x + 1 + Math.floor((size - 2 - px * bp.w) / 2), oy = y + 1 + Math.floor((size - 2 - px * bp.h) / 2);
  for (const it of bp.items) {
    const d = STRUCT_BY_ID.get(it.def);
    if (!d) continue;
    const [w, h] = d.rotatable && (it.rot === 1 || it.rot === 3) ? [d.size[1], d.size[0]] : d.size;
    const col = d.kind === 'belt' || d.kind === 'underground' || d.kind === 'splitter' ? C.brass : d.kind === 'arm' ? C.gold : d.kind === 'chest' ? C.oak
      : d.kind === 'shipbin' ? C.rose : d.kind === 'machine' || d.kind === 'lab' ? C.mauve : d.kind === 'pole' || d.kind === 'generator' ? C.copper : C.stone;
    ui.fill(ox + it.dx * px, oy + it.dy * px, Math.max(1, w * px), Math.max(1, h * px), col);
  }
}

const describe = (bp: Blueprint) => `${bp.w}x${bp.h}, ${bp.items.length} piece${bp.items.length === 1 ? '' : 's'}${fits(bp, 6, 6) ? ', fits the Fair\'s bed' : ''}`;

function drawDrafting(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const lib = drafting(g).lib;
  const W = Math.min(ui.w - 20, 400), H = Math.min(ui.h - 30, 280);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, 'Drafting Table')) {
    ui.focus = null;
    return false;
  }
  const binds = play.app.input.binds;
  const copyKey = keyLabel(binds.copy?.[0] ?? 'KeyV'), pasteKey = keyLabel(binds.paste?.[0] ?? 'KeyB');
  const bp = play.blueprint;
  // the blueprint tool's copy, and saving it under a name
  ui.panel(x + 10, y + 14, W - 20, 40, 'inset', false);
  if (bp && bp.items.length) {
    thumb(ui, bp, x + 14, y + 18, 32);
    ui.text('In the blueprint tool:', x + 52, y + 19, C.ink);
    ui.text(describe(bp), x + 52, y + 30, C.walnut);
    st.data.name ??= `Line ${lib.length + 1}`;
    const fx = x + W - 172;
    st.data.name = ui.textField('bpname', fx, y + 20, 110, st.data.name, 18);
    const full = lib.length >= LIB_MAX;
    if (ui.button('bpsave', fx + 114, y + 20, 44, 16, 'Save', { style: 'green', disabled: full || !st.data.name.trim(), tip: full ? `The library holds ${LIB_MAX}: delete one first` : 'Save it in the library' })) {
      if (addBlueprint(g, st.data.name, bp)) {
        play.toast(`Saved "${lib[lib.length - 1].name}" in the library.`);
        ui.sfx('place');
        st.data.name = undefined;
        ui.focus = null;
      }
    }
    if (full) ui.text(`The library is full (${LIB_MAX}).`, fx, y + 39, C.brick);
  } else {
    ui.para(`The blueprint tool is empty. Outside, ${copyKey} and a drag copy a line; come back to save it here.`, x + 16, y + 20, W - 32, C.walnut);
  }
  // the library
  ui.text(`The library (${lib.length}/${LIB_MAX})`, x + 12, y + 60, C.amber);
  const ly = y + 72, lh = H - 72 - 22;
  ui.panel(x + 10, ly - 2, W - 20, lh + 4, 'inset', false);
  if (!lib.length) ui.para('Saved lines are listed here, to load back into the blueprint tool and paste, or to bring to the Sprocket Fair.', x + 16, ly + 4, W - 32, C.walnut);
  const rowH = 26;
  const off = ui.scrollOffset('bplib', x + 10, ly, W - 20, lh, lib.length * rowH);
  ui.clip(x + 10, ly, W - 20, lh);
  lib.forEach((e, i) => {
    const ry = ly + i * rowH - off;
    if (ry < ly - rowH || ry > ly + lh) return;
    if (i % 2) ui.fill(x + 12, ry, W - 24, rowH - 1, C.tan, 0.3);
    thumb(ui, e.bp, x + 14, ry + 2, 22);
    if (st.data.edit === i) {
      e.name = ui.textField('bpren' + i, x + 40, ry + 2, 150, e.name, 18) || e.name;
      if (ui.focus !== 'bpren' + i) st.data.edit = undefined;
    } else {
      ui.text(ellipsize(e.name + (e.from ? `  (${villagerName(e.from)}'s drawing)` : ''), W - 190), x + 40, ry + 3, C.ink);
      if (ui.hover(x + 40, ry + 1, 150, 10)) ui.tip([{ text: e.name, color: C.amber }, { text: 'Click to rename', color: C.pebble }]);
      if (ui.clicked && ui.hover(x + 40, ry + 1, 150, 10)) {
        ui.eat();
        st.data.edit = i;
        ui.focus = 'bpren' + i;
      }
    }
    ui.text(describe(e.bp), x + 40, ry + 14, C.walnut);
    if (ui.button('bpload' + i, x + W - 110, ry + 4, 44, 16, 'Load', { style: 'green', tip: `Into the blueprint tool: outside, ${pasteKey} pastes it` })) {
      play.blueprint = cloneBlueprint(e.bp);
      play.toast(`"${e.name}" is in the blueprint tool. Outside, ${pasteKey} pastes it; missing pieces wait as ghosts.`);
      ui.sfx('open');
    }
    const sure = st.data.del === i;
    if (ui.button('bpdel' + i, x + W - 62, ry + 4, 44, 16, sure ? 'Sure?' : 'Delete', { style: sure ? 'red' : 'flat' })) {
      if (sure) {
        lib.splice(i, 1);
        st.data.del = undefined;
        st.data.edit = undefined;
        ui.sfx('pickup');
      } else st.data.del = i;
    }
  });
  ui.unclip();
  ui.text(`Load puts a line in the blueprint tool; outside, ${pasteKey} pastes it.`, x + 12, y + H - 16, C.oak);
  return true;
}

registerWindow('ledger', { draw: drawLedger });
registerWindow('drafting', { draw: drawDrafting, onClose: (play) => { play.app.ui.focus = null; } });
