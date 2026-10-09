// Factory windows: research tree, production statistics with graphs, power grid overview.
import { C } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { RESEARCH, RESEARCH_BY_ID } from '../../data/research';
import { key } from '../../sim/inventory';
import { canResearch, researchUnits, setResearch, unlocksOf } from '../../sim/systems/research';
import { powerState } from '../../sim/systems/power';
import { RES } from '../../sim/systems/stats';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { ICON, wrapText } from '../font';
import { itemTooltip } from '../tooltips';

const NODE_W = 34, NODE_H = 34, GAP_X = 66, GAP_Y = 58;
const TIER_COL = ['bundle_green', 'bundle_copper', 'bundle_rose', 'bundle_brass', 'bundle_star'];

function nodeTier(id: string) {
  const r = RESEARCH_BY_ID.get(id)!;
  return Math.max(0, ...r.cost.map((c) => TIER_COL.indexOf(c.item)));
}

function drawResearch(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(ui.w - 20, 600), h = Math.min(ui.h - 30, 340);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Research')) return false;
  const vx = x + 8, vy = y + 14, vw = w - 170, vh = h - 22;
  ui.panel(vx, vy, vw, vh, 'inset', false);
  st.data.panX = st.data.panX ?? 0;
  st.data.panY = st.data.panY ?? 0;
  // drag to pan
  if (ui.hover(vx, vy, vw, vh)) {
    if (ui.input.mouse.down[2] || (ui.input.mouse.down[0] && ui.input.shift)) {
      st.data.panX += (ui.mx - (st.data.lmx ?? ui.mx));
      st.data.panY += (ui.my - (st.data.lmy ?? ui.my));
    }
    if (ui.input.mouse.wheel) {
      st.data.panY -= ui.input.mouse.wheel * 20;
      ui.input.mouse.wheel = 0;
    }
  }
  st.data.lmx = ui.mx;
  st.data.lmy = ui.my;
  const maxX = Math.max(...RESEARCH.map((r) => r.pos[0])) * GAP_X + NODE_W + 20;
  const maxY = Math.max(...RESEARCH.map((r) => r.pos[1])) * GAP_Y + NODE_H + 40;
  st.data.panX = Math.max(Math.min(0, vw - maxX), Math.min(0, st.data.panX));
  st.data.panY = Math.max(Math.min(0, vh - maxY), Math.min(0, st.data.panY));
  const ox = vx + 16 + st.data.panX, oy = vy + 20 + st.data.panY;
  const pos = (id: string) => {
    const r = RESEARCH_BY_ID.get(id)!;
    return [ox + r.pos[0] * GAP_X, oy + r.pos[1] * GAP_Y] as const;
  };
  ui.clip(vx + 1, vy + 1, vw - 2, vh - 2);
  // tier header: the bundle each column of the tree is paid with
  const cols = new Map<number, number>();
  for (const r of RESEARCH) cols.set(r.pos[0], Math.max(cols.get(r.pos[0]) ?? 0, nodeTier(r.id)));
  for (const [c, tier] of cols) ui.itemIcon(key(TIER_COL[tier]), ox + c * GAP_X + NODE_W / 2 - 6, oy - 16, 12);
  // connections
  for (const r of RESEARCH) {
    const [ax, ay] = pos(r.id);
    for (const p of r.prereq) {
      const [bx, by] = pos(p);
      const done = g.research.done.has(p);
      const col = done ? (g.research.done.has(r.id) ? C.moss : C.amber) : C.oak;
      // elbow line
      const mx = bx + NODE_W + (ax - bx - NODE_W) / 2;
      ui.fill(bx + NODE_W, by + NODE_H / 2, Math.max(1, mx - bx - NODE_W), 1, col);
      ui.fill(mx, Math.min(by, ay) + NODE_H / 2, 1, Math.abs(ay - by) + 1, col);
      ui.fill(mx, ay + NODE_H / 2, Math.max(1, ax - mx), 1, col);
    }
  }
  // nodes
  for (const r of RESEARCH) {
    const [nx, ny] = pos(r.id);
    if (nx > vx + vw || ny > vy + vh || nx + NODE_W < vx || ny + NODE_H < vy) continue;
    const done = g.research.done.has(r.id);
    const avail = canResearch(g, r.id);
    const cur = g.research.current === r.id;
    const sel = st.data.sel === r.id;
    const hov = ui.hover(nx, ny, NODE_W, NODE_H);
    // researched = brass frame, available = pulsing amber, locked = faded
    const pulse = avail && !cur && Math.sin(ui.time * 4) > 0;
    const rim = sel ? C.rose : done ? C.brass : cur || pulse ? C.amber : avail ? C.copper : C.slate;
    const bg = done ? C.butter : cur ? C.apricot : avail ? C.cream : C.pebble;
    ui.fill(nx - 2, ny - 2, NODE_W + 4, NODE_H + 4, C.ink);
    ui.fill(nx - 1, ny - 1, NODE_W + 2, NODE_H + 2, rim);
    ui.fill(nx + 1, ny + 1, NODE_W - 2, NODE_H - 2, bg);
    ui.fill(nx + 1, ny + 1, NODE_W - 2, 2, [C.leaf, C.copper, C.rose, C.brass, C.lavender][nodeTier(r.id)]);
    ui.itemIcon(key(r.icon), nx + 1, ny + 1, 32, 0, avail || done ? 1 : 0.4);
    if (done) ui.text(ICON.star, nx + NODE_W - 7, ny + NODE_H - 9, C.moss, { shadow: C.cream });
    // name under the node (two short lines)
    wrapText(r.name, GAP_X - 6).slice(0, 2).forEach((l, li) => ui.text(l, nx + NODE_W / 2, ny + NODE_H + 4 + li * 9, done ? C.moss : avail ? C.ink : C.stone, { align: 'center' }));
    const prog = g.research.progress[r.id] ?? 0;
    if (!done && prog > 0) ui.bar(nx + 2, ny + NODE_H - 4, NODE_W - 4, 3, prog / researchUnits(r.id, g), C.moss);
    if (hov) {
      ui.tip([{ text: r.name, color: C.amber }, { text: r.desc }, { text: `Cost: ${researchUnits(r.id, g)} x ${r.cost.map((c) => ITEM_BY_ID.get(c.item)?.name).join(' + ')}`, color: C.butter }, { text: done ? 'Researched' : avail ? 'Click to select, double-click to start' : 'Needs: ' + r.prereq.filter((p) => !g.research.done.has(p)).map((p) => RESEARCH_BY_ID.get(p)!.name).join(', '), color: done ? C.lime : avail ? C.pebble : C.rose }]);
      if (ui.clicked) {
        ui.eat();
        if (st.data.sel === r.id && avail) setResearch(g, r.id);
        st.data.sel = r.id;
      }
    }
  }
  ui.unclip();
  // info panel
  // starts below the frame's close button (y+5..y+17)
  const px = x + w - 158, py = y + 20, pw = 150;
  ui.panel(px, py, pw, h - 28, 'paper', false);
  const sel = RESEARCH_BY_ID.get(st.data.sel ?? g.research.current ?? '') ?? null;
  const labs = g.ents.others.filter((e) => e.def.kind === 'lab');
  ui.text(`Desks: ${labs.length}  (working ${labs.filter((l) => l.working).length})`, px + 6, py + 6, C.walnut);
  if (g.research.current) {
    const r = RESEARCH_BY_ID.get(g.research.current)!;
    ui.text('Researching:', px + 6, py + 18, C.oak);
    ui.text(r.name, px + 6, py + 28, C.ink);
    ui.bar(px + 6, py + 39, pw - 12, 5, (g.research.progress[r.id] ?? 0) / researchUnits(r.id, g), C.moss);
  } else ui.text(!labs.length ? 'Place a Study Desk first.' : sel ? 'Press "Research this" below.' : 'Pick a topic to study.', px + 6, py + 22, labs.length && sel ? C.moss : C.brick);
  if (!sel) {
    ui.para('Select a node to see what it unlocks. Right-drag or scroll to move around.', px + 6, py + 56, pw - 12, C.walnut);
    return true;
  }
  let yy = py + 54;
  ui.text(sel.name, px + 6, yy, C.ink);
  yy += 11;
  yy += ui.para(sel.desc, px + 6, yy, pw - 12, C.walnut) + 4;
  const units = researchUnits(sel.id, g);
  ui.text(`Cost: ${units} x`, px + 6, yy, C.oak);
  sel.cost.forEach((c, i) => ui.itemIcon(key(c.item), px + 56 + i * 15, yy - 4, 14));
  yy += 14;
  // what you have toward it (bag + desks), so a pick you can't afford yet says so up front
  const have = (id: string) => g.player.inv.countId(id) + labs.reduce((a, l) => a + (l.inv?.countId(id) ?? 0), 0);
  const short = sel.cost.filter((c) => have(c.item) < units);
  if (!g.research.done.has(sel.id)) {
    ui.text(short.length ? `You have ${short.map((c) => have(c.item)).join(' + ')} of ${units}: craft more (C)` : 'You have enough bundles', px + 6, yy, short.length ? C.brick : C.moss);
    yy += 12;
  }
  ui.text(`${sel.unitTime}s per unit per desk`, px + 6, yy, C.oak);
  yy += 12;
  const unl = unlocksOf(sel.id);
  if (unl.items.length) {
    ui.text('Unlocks:', px + 6, yy, C.oak);
    yy += 10;
    unl.items.slice(0, 14).forEach((id, i) => {
      const ix = px + 6 + (i % 7) * 20, iy = yy + Math.floor(i / 7) * 20;
      ui.slot(ix, iy, { k: key(id), n: 1 }, { size: 18 });
      if (ui.hover(ix, iy, 18, 18)) ui.tip(itemTooltip(g, key(id)).slice(0, 3));
    });
    yy += Math.ceil(Math.min(14, unl.items.length) / 7) * 20 + 2;
  }
  for (const e of sel.effects ?? []) {
    ui.text('+ ' + sel.desc.split('.')[0], px + 6, yy, C.moss);
    yy += 10;
    void e;
  }
  const done = g.research.done.has(sel.id);
  const avail = canResearch(g, sel.id);
  if (!done && ui.button('rstart', px + 6, py + h - 48, pw - 12, 16, g.research.current === sel.id ? 'Researching...' : avail ? 'Research this' : 'Locked', { disabled: !avail || g.research.current === sel.id, style: 'green' })) setResearch(g, sel.id);
  return true;
}

// ---------------- production stats ----------------
function drawStats(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(ui.w - 20, 520), h = Math.min(ui.h - 30, 320);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Production')) return false;
  st.data.res = st.data.res ?? 1;
  st.data.tab = st.data.tab ?? 'items';
  const labels = ['1 min', '10 min', '1 hour'];
  RES.forEach((_, i) => { if (ui.button('res' + i, x + 10 + i * 46, y + 10, 44, 14, labels[i], { active: st.data.res === i })) st.data.res = i; });
  if (ui.button('tItems', x + w - 160, y + 10, 70, 14, 'Items', { active: st.data.tab === 'items' })) st.data.tab = 'items';
  if (ui.button('tPower', x + w - 86, y + 10, 70, 14, 'Power', { active: st.data.tab === 'power' })) st.data.tab = 'power';
  if (st.data.tab === 'power') return powerTab(ui, play, x, y, w, h);
  const res = st.data.res;
  const rows = [...g.stats.series.entries()]
    .map(([idx]) => ({ idx, p: g.stats.rate(idx, res, 'prod'), c: g.stats.rate(idx, res, 'cons') }))
    .filter((r) => r.p > 0.01 || r.c > 0.01)
    .sort((a, b) => b.p + b.c - (a.p + a.c));
  const lx = x + 10, ly = y + 30, lw = 250, lh = h - 40;
  ui.panel(lx, ly, lw, lh, 'inset', false);
  ui.text('Item', lx + 24, ly + 3, C.walnut);
  ui.text('made/min', lx + 150, ly + 3, C.moss, { align: 'right' });
  ui.text('used/min', lx + 210, ly + 3, C.brick, { align: 'right' });
  const rowH = 14;
  const off = ui.scrollOffset('statlist', lx, ly + 12, lw, lh - 12, rows.length * rowH);
  ui.clip(lx, ly + 12, lw, lh - 12);
  rows.forEach((r, i) => {
    const ry = ly + 13 + i * rowH - off;
    if (ry < ly - rowH || ry > ly + lh) return;
    const hov = ui.hover(lx, ry, lw - 4, rowH);
    if (hov || st.data.sel === r.idx) ui.fill(lx + 1, ry, lw - 5, rowH, st.data.sel === r.idx ? C.butter : C.cream);
    ui.itemIcon(r.idx * 4, lx + 3, ry, 12);
    ui.text(ITEMS[r.idx].name.slice(0, 20), lx + 18, ry + 3, C.ink);
    ui.text(fmtRate(r.p), lx + 150, ry + 3, C.moss, { align: 'right' });
    ui.text(fmtRate(r.c), lx + 210, ry + 3, C.brick, { align: 'right' });
    // mini sparkline
    const hist = g.stats.history(r.idx, res, 'prod');
    const mx = Math.max(1, ...hist);
    for (let j = 0; j < hist.length; j += 3) ui.fill(lx + 214 + j / 3, ry + 11 - Math.round((hist[j] / mx) * 8), 1, 1, C.moss);
    if (hov && ui.clicked) {
      ui.eat();
      st.data.sel = r.idx;
    }
  });
  ui.unclip();
  if (!rows.length) ui.para('Nothing produced yet. Machines, harvesters, drills and your own hands all count.', lx + 8, ly + 20, lw - 16, C.walnut);
  // big graph
  const gx = lx + lw + 8, gy = ly, gw = w - lw - 28, gh = lh;
  ui.panel(gx, gy, gw, gh, 'inset', false);
  const sel = st.data.sel ?? rows[0]?.idx;
  if (sel !== undefined && ITEMS[sel]) {
    ui.itemIcon(sel * 4, gx + 4, gy + 4, 16);
    ui.text(ITEMS[sel].name, gx + 24, gy + 9, C.ink);
    const hp = g.stats.history(sel, res, 'prod');
    const hc = g.stats.history(sel, res, 'cons');
    const mx = Math.max(1, ...hp, ...hc) * 1.15;
    const ax = gx + 26, ay = gy + 28, aw = gw - 34, ah = gh - 50;
    ui.fill(ax, ay + ah, aw, 1, C.oak);
    ui.fill(ax, ay, 1, ah, C.oak);
    ui.text(fmtRate(mx), ax - 2, ay - 2, C.oak, { align: 'right' });
    ui.text('0', ax - 2, ay + ah - 6, C.oak, { align: 'right' });
    const plot = (arr: number[], col: number) => {
      for (let i = 1; i < arr.length; i++) {
        const x0 = ax + ((i - 1) / (arr.length - 1)) * aw, x1 = ax + (i / (arr.length - 1)) * aw;
        const y0 = ay + ah - (arr[i - 1] / mx) * ah, y1 = ay + ah - (arr[i] / mx) * ah;
        const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) + Math.abs(y1 - y0)));
        for (let s = 0; s <= n; s++) ui.fill(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n), 1, 1, col);
      }
    };
    plot(hc, C.rose);
    plot(hp, C.moss);
    ui.text('made', gx + 6, gy + gh - 14, C.moss);
    ui.text('used', gx + 40, gy + gh - 14, C.brick);
    const tot = g.stats.series.get(sel)!;
    ui.text(`all-time: ${Math.round(tot.totalProd)} made, ${Math.round(tot.totalCons)} used`, gx + gw - 6, gy + gh - 14, C.walnut, { align: 'right' });
    ui.text(`per minute, ${labels[res]} window`, gx + gw - 6, gy + 9, C.oak, { align: 'right' });
  }
  return true;
}

function fmtRate(v: number) {
  return v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function powerTab(ui: UI, play: PlayScreen, x: number, y: number, w: number, h: number): boolean {
  const g = play.g;
  const ps = powerState(g);
  const nets = [...ps.nets.values()];
  ui.text(`${nets.length} power grid${nets.length === 1 ? '' : 's'}`, x + 12, y + 32, C.walnut);
  nets.slice(0, 6).forEach((n, i) => {
    const ry = y + 46 + i * 44;
    ui.panel(x + 10, ry, w - 20, 40, 'inset', false);
    const col = n.sat >= 0.99 ? C.moss : n.sat > 0.5 ? C.amber : C.brick;
    ui.text(`Grid #${n.id}: ${n.gens} generators, ${n.consumers} machines, ${n.poles} poles`, x + 16, ry + 4, C.ink);
    ui.text(`${ICON.bolt} demand ${Math.round(n.demand)}  supply ${Math.round(n.cap)}  satisfaction ${Math.round(n.sat * 100)}%`, x + 16, ry + 15, col);
    if (n.storeCap) ui.text(`batteries ${Math.round(n.stored)}/${n.storeCap}`, x + w - 16, ry + 15, C.walnut, { align: 'right' });
    ui.bar(x + 16, ry + 27, w - 40, 6, n.cap > 0 ? Math.min(1, n.demand / n.cap) : 1, n.demand > n.cap ? C.brick : C.leaf);
  });
  if (!nets.length) ui.para('No power grids yet. Research Water Power, then connect generators and machines with poles.', x + 12, y + 48, w - 24, C.walnut);
  return true;
}

registerWindow('research', { draw: drawResearch });
registerWindow('stats', { draw: drawStats, pause: false });

export { ITEM_BY_ID };
