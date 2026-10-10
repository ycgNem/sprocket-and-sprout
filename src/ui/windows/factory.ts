// Factory windows: research tree, production statistics with graphs, power grid overview.
import { C } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { ERA_KEYSTONE, ERA_NAMES, RESEARCH, RESEARCH_BY_ID, eraCol } from '../../data/research';
import { key } from '../../sim/inventory';
import { QUEST_BY_ID } from '../../data/goals';
import { nowLines } from '../../sim/systems/quests';
import { canResearch, researchUnits, setResearch, stageNext, stageObjMet, stageObjText, stages, unlocksOf } from '../../sim/systems/research';
import { keystoneOpen, keystoneQuest, townEra } from '../../sim/keystones';
import { powerState } from '../../sim/systems/power';
import { RES } from '../../sim/systems/stats';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { ICON, ellipsize, textWidth, wrapText } from '../font';
import { itemTooltip } from '../tooltips';
import { linesTab } from './linetab';
import { gridSentence } from '../../sim/systems/power';

// rows leave room for a keystone's pips and a two-line name under it (the sweep: 64 hid the second line)
const NODE_W0 = 34, NODE_H0 = 34, GAP_X0 = 62, GAP_Y0 = 72;
const ERA_TINT = [C.ink, C.leaf, C.river, C.copper, C.brass, C.lavender];
const ERA_BUNDLE = ['', 'bundle_green', 'bundle_copper', 'bundle_rose', 'bundle_brass', 'bundle_star'];

/**
 * Era bands: each era is a band of columns (its nodes' prerequisite depth inside the era), side by
 * side from Spring to Starlight; rows come from the data. Returns each node's cell and each band's
 * left edge and width (in node cells).
 */
function treeLayout() {
  const col = new Map<string, number>();
  const cols = [0, 0, 0, 0, 0, 0];
  for (const r of RESEARCH) {
    const c = eraCol(r.id);
    col.set(r.id, c);
    cols[r.era] = Math.max(cols[r.era], c + 1);
  }
  const start = [0, 0, 0, 0, 0, 0];
  for (let e = 2; e <= 5; e++) start[e] = start[e - 1] + cols[e - 1];
  const rows = Math.max(...RESEARCH.map((r) => r.row)) + 1;
  return { cell: (id: string) => { const r = RESEARCH_BY_ID.get(id)!; return [start[r.era] + col.get(id)!, r.row] as const; }, start, cols, total: start[5] + cols[5], rows };
}

/** the four pips of a keystone (observe, experiment, validate, apply): filled when done */
function keystonePips(ui: UI, g: PlayScreen['g'], id: string, x: number, y: number, w: number) {
  const s = stages(g, id);
  const done = g.research.done.has(id);
  // a studied keystone lights every stage it had (its stages read null once it's done)
  const k = RESEARCH_BY_ID.get(id)?.keystone;
  const pips = done ? [k?.observe ? true : null, k?.experiment?.length ? true : null, k?.validate ? true : null, true] : [s.observe, s.experiment, s.validate, false];
  const n = pips.length, pw = 5, gap = Math.max(1, Math.floor((w - n * pw) / (n - 1)));
  pips.forEach((p, i) => {
    const px = x + i * (pw + gap);
    ui.fill(px, y, pw, pw, C.ink);
    ui.fill(px + 1, y + 1, pw - 2, pw - 2, p === null ? C.pebble : p || done ? C.lime : C.stone);
  });
}

function drawResearch(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(ui.w - 20, 620), h = Math.min(ui.h - 30, 350);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Research')) return false;
  const vx = x + 8, vy = y + 14, vw = w - 176, vh = h - 22;
  ui.panel(vx, vy, vw, vh, 'inset', false);
  st.data.panX = st.data.panX ?? 0;
  st.data.panY = st.data.panY ?? 0;
  const L = treeLayout();
  // Fit: the whole tree at small size (icons only), so every topic is one glance away
  const fit = !!st.data.fit;
  const HEAD = fit ? 14 : 24;
  const NODE_W = fit ? 16 : NODE_W0, NODE_H = fit ? 16 : NODE_H0;
  const GAP_X = fit ? Math.max(NODE_W + 4, Math.min(36, Math.floor((vw - 24) / L.total))) : GAP_X0;
  const GAP_Y = fit ? Math.max(NODE_H + 6, Math.min(26, Math.floor((vh - HEAD - 16) / L.rows))) : GAP_Y0;
  const BAND_PAD = fit ? 4 : 10;
  const maxX = L.total * GAP_X + 5 * BAND_PAD + 16;
  const maxY = HEAD + L.rows * GAP_Y + (fit ? 8 : 24);
  const SB = 5; // scrollbar thickness
  // drag to pan (right button, or shift + left); the wheel pans down, shift + wheel (or a sideways wheel) across
  if (ui.hover(vx, vy, vw, vh)) {
    if (ui.input.mouse.down[2] || (ui.input.mouse.down[0] && ui.input.shift && !st.data.bar)) {
      st.data.panX += (ui.mx - (st.data.lmx ?? ui.mx));
      st.data.panY += (ui.my - (st.data.lmy ?? ui.my));
    }
    if (ui.input.mouse.wheel || ui.input.mouse.wheelX) {
      if (ui.input.shift) st.data.panX -= ui.input.mouse.wheel * 30;
      else st.data.panY -= ui.input.mouse.wheel * 20;
      st.data.panX -= ui.input.mouse.wheelX * 30;
      ui.input.mouse.wheel = 0;
      ui.input.mouse.wheelX = 0;
    }
  }
  st.data.lmx = ui.mx;
  st.data.lmy = ui.my;
  // scrollbars on both axes, so it's plain there is more to the right and below; drag or click them
  const spanX = Math.max(0, maxX - vw), spanY = Math.max(0, maxY - vh);
  const barX = { x: vx + 2, y: vy + vh - SB - 1, w: vw - SB - 5, h: SB }, barY = { x: vx + vw - SB - 1, y: vy + 2, w: SB, h: vh - SB - 5 };
  if (!ui.input.mouse.down[0]) st.data.bar = null;
  else if (ui.clicked && spanX && ui.hover(barX.x, barX.y - 1, barX.w, barX.h + 2)) { st.data.bar = 'x'; ui.eat(); }
  else if (ui.clicked && spanY && ui.hover(barY.x - 1, barY.y, barY.w + 2, barY.h)) { st.data.bar = 'y'; ui.eat(); }
  if (st.data.bar === 'x') st.data.panX = -Math.max(0, Math.min(1, (ui.mx - barX.x) / barX.w)) * spanX;
  if (st.data.bar === 'y') st.data.panY = -Math.max(0, Math.min(1, (ui.my - barY.y) / barY.h)) * spanY;
  // the first visit opens on the Now step's topic when it's one to study (k11's "Study Sawmilling"
  // is a Water topic in the Steam era: the critic), else on the topic being studied, else on the
  // era the player is in
  if (st.data.panX === 0 && st.data.firstEra === undefined) {
    const now = nowLines(g, 1)[0];
    const o = now ? QUEST_BY_ID.get(now.id)?.objectives[now.index] : undefined;
    const topic = o && (o.t === 'research' || o.t === 'stage') && !g.research.done.has(o.id) ? o.id : null;
    if (topic && !st.data.focus && RESEARCH_BY_ID.has(topic)) st.data.focus = topic;
    else {
      const era = Math.min(5, RESEARCH_BY_ID.get(g.research.current ?? '')?.era ?? townEra(g));
      st.data.firstEra = era;
      if (era > 1) st.data.panX = -(L.start[era] * GAP_X + (era - 1) * BAND_PAD);
    }
  }
  // a topic to show (st.data.focus, e.g. from the screenshot sweep): picked, and scrolled to the middle
  if (st.data.focus && RESEARCH_BY_ID.has(st.data.focus)) {
    const [c, r] = L.cell(st.data.focus);
    const era = RESEARCH_BY_ID.get(st.data.focus)!.era;
    st.data.panX = -(c * GAP_X + (era - 1) * BAND_PAD - vw / 2 + NODE_W);
    st.data.panY = -(r * GAP_Y - vh / 2 + NODE_H);
    st.data.sel = st.data.focus;
    st.data.firstEra = era;
    st.data.focus = undefined;
  }
  st.data.panX = Math.max(-spanX, Math.min(0, st.data.panX));
  st.data.panY = Math.max(-spanY, Math.min(0, st.data.panY));
  const ox = vx + 10 + st.data.panX, oy = vy + 6 + HEAD + st.data.panY;
  const bandX = (era: number) => ox + L.start[era] * GAP_X + (era - 1) * BAND_PAD - BAND_PAD / 2;
  const pos = (id: string) => {
    const [c, r] = L.cell(id);
    const era = RESEARCH_BY_ID.get(id)!.era;
    return [ox + c * GAP_X + (era - 1) * BAND_PAD, oy + r * GAP_Y] as const;
  };
  // the tree stops short of the scrollbars, so nothing hides under them
  ui.clip(vx + 1, vy + 1, vw - (spanY ? SB + 4 : 2), vh - (spanX ? SB + 4 : 2));
  // era bands: a tinted column per era with its name, its bundles and its keystone
  // "(now)" marks the era the player is in (townEra: the town's next keystone on the Keeper's Line)
  const nowEra = townEra(g);
  for (let era = 1; era <= 5; era++) {
    const bx = bandX(era), bw = L.cols[era] * GAP_X + BAND_PAD - (fit ? 2 : 6);
    ui.fill(bx, vy + 1, bw, vh - 2, ERA_TINT[era], 0.1);
    ui.fill(bx, vy + 1, bw, fit ? 11 : 21, ERA_TINT[era], 0.35);
    const now = era === nowEra;
    if (fit) ui.text(ellipsize(ERA_NAMES[era], bw - 4), bx + 2, vy + 3, C.ink);
    else {
      ui.itemIcon(key(ERA_BUNDLE[era]), bx + 3, vy + 4, 10);
      ui.text(ERA_NAMES[era] + (now ? ' (now)' : ''), bx + 16, vy + 4, C.ink);
      ui.text(ellipsize(ERA_KEYSTONE[era], bw - 8), bx + 4, vy + 13, C.walnut);
    }
  }
  // connections: a line from another era is faint unless its node is picked, so the bands stay readable
  for (const r of RESEARCH) {
    const [ax, ay] = pos(r.id);
    for (const p of r.prereq) {
      const pr = RESEARCH_BY_ID.get(p);
      if (!pr) continue;
      const [bx, by] = pos(p);
      const done = g.research.done.has(p);
      const col = done ? (g.research.done.has(r.id) ? C.moss : C.amber) : C.stone;
      const a = pr.era === r.era || st.data.sel === r.id || st.data.sel === p ? 1 : 0.35;
      // elbow line
      const mx = bx + NODE_W + Math.max(2, (ax - bx - NODE_W) / 2);
      ui.fill(bx + NODE_W, by + NODE_H / 2, Math.max(1, mx - bx - NODE_W), 1, col, a);
      ui.fill(mx, Math.min(by, ay) + NODE_H / 2, 1, Math.abs(ay - by) + 1, col, a);
      ui.fill(Math.min(mx, ax), ay + NODE_H / 2, Math.max(1, Math.abs(ax - mx)), 1, col, a);
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
    // researched = moss, studying = apricot, available = cream with a pulsing amber rim, locked = dim slate
    const pulse = avail && !cur && Math.sin(ui.time * 4) > 0;
    const rim = sel ? C.rose : done ? C.moss : cur || pulse ? C.amber : avail ? C.copper : C.stone;
    const bg = done ? C.lime : cur ? C.apricot : avail ? C.cream : C.slate;
    if (r.keystone) {
      // a keystone wears a copper double frame (brass once studied)
      const k = fit ? 4 : 5;
      ui.fill(nx - k, ny - k, NODE_W + k * 2, NODE_H + k * 2, C.ink);
      ui.fill(nx - k + 1, ny - k + 1, NODE_W + k * 2 - 2, NODE_H + k * 2 - 2, done ? C.brass : C.copper);
    }
    ui.fill(nx - 2, ny - 2, NODE_W + 4, NODE_H + 4, C.ink);
    ui.fill(nx - 1, ny - 1, NODE_W + 2, NODE_H + 2, rim);
    ui.fill(nx + 1, ny + 1, NODE_W - 2, NODE_H - 2, bg);
    ui.itemIcon(key(r.icon), nx + 1, ny + 1, fit ? 14 : 32, 0, avail || done ? 1 : 0.35);
    if (done && !fit) ui.text(ICON.star, nx + NODE_W - 7, ny + NODE_H - 9, C.moss, { shadow: C.cream });
    // name under the node (two short lines); Fit shows names on hover only
    if (!fit) {
      const nameY = ny + NODE_H + (r.keystone ? 13 : 4);
      // on a backing of the panel's own colour, so the lines between nodes never run through a name
      const names = wrapText(r.name, GAP_X - 4).slice(0, 2);
      names.forEach((l, li) => ui.fill(nx + NODE_W / 2 - textWidth(l) / 2 - 1, nameY + li * 9 - 1, textWidth(l) + 2, 9, C.tan, 0.85));
      names.forEach((l, li) => ui.text(l, nx + NODE_W / 2, nameY + li * 9, done ? C.moss : avail ? C.ink : C.stone, { align: 'center' }));
      if (r.keystone) keystonePips(ui, g, r.id, nx - 2, ny + NODE_H + 7, NODE_W + 4);
    }
    const prog = g.research.progress[r.id] ?? 0;
    if (!done && prog > 0) ui.bar(nx + 2, ny + NODE_H - 4, NODE_W - 4, 3, prog / researchUnits(r.id, g), C.moss);
    if (hov && !st.data.bar) {
      const next = avail ? stageNext(g, r.id) : null;
      ui.tip([
        { text: r.name + (r.keystone ? '  (keystone)' : ''), color: C.amber },
        { text: r.desc },
        { text: `Cost: ${researchUnits(r.id, g)} x ${r.cost.map((c) => ITEM_BY_ID.get(c.item)?.name).join(' + ')}`, color: C.butter },
        ...(next ? [{ text: 'First: ' + next, color: C.apricot }] : []),
        { text: done ? 'Researched' : avail ? 'Click to select, double-click to start' : 'Needs: ' + missingFor(g, r.id).join(', '), color: done ? C.lime : avail ? C.pebble : C.rose },
      ]);
      if (ui.clicked) {
        ui.eat();
        if (st.data.sel === r.id && avail) setResearch(g, r.id);
        else ui.sfx('click');
        st.data.sel = r.id;
      }
    }
  }
  ui.unclip();
  // the scrollbars (track + thumb sized to the visible share)
  const thumb = (bar: { x: number; y: number; w: number; h: number }, span: number, pan: number, horiz: boolean, vis: number, total: number) => {
    if (!span) return;
    ui.fill(bar.x, bar.y, bar.w, bar.h, C.tan);
    const len = Math.max(12, Math.round((horiz ? bar.w : bar.h) * vis / total));
    const at = Math.round((-pan / span) * ((horiz ? bar.w : bar.h) - len));
    const hot = st.data.bar === (horiz ? 'x' : 'y') || ui.hover(bar.x, bar.y, bar.w, bar.h);
    if (horiz) ui.fill(bar.x + at, bar.y, len, bar.h, hot ? C.copper : C.walnut);
    else ui.fill(bar.x, bar.y + at, bar.w, len, hot ? C.copper : C.walnut);
  };
  thumb(barX, spanX, st.data.panX, true, vw, maxX);
  thumb(barY, spanY, st.data.panY, false, vh, maxY);
  // Fit / full size: the overview shows every topic at once
  // (above the tree, on the frame, so it never covers a topic: the sweep found it over a node)
  if (ui.button('rfit', vx + vw - 46, y + 3, 44, 10, fit ? 'Zoom' : 'Fit', { style: 'flat', tip: fit ? 'Back to full size' : 'Show the whole tree' })) {
    st.data.fit = !fit;
    st.data.panX = 0;
    st.data.panY = 0;
  }
  // info panel: starts below the frame's close button (y+5..y+17) and never covers a node
  const px = x + w - 164, py = y + 20, pw = 156;
  ui.panel(px, py, pw, h - 28, 'paper', false);
  const sel = RESEARCH_BY_ID.get(st.data.sel ?? g.research.current ?? '') ?? null;
  const labs = g.ents.others.filter((e) => e.def.kind === 'lab');
  ui.text(`Desks: ${labs.length}  (working ${labs.filter((l) => l.working).length})`, px + 6, py + 6, C.walnut);
  if (g.research.current) {
    const r = RESEARCH_BY_ID.get(g.research.current)!;
    ui.text('Researching:', px + 6, py + 18, C.oak);
    ui.text(ellipsize(r.name, pw - 12), px + 6, py + 28, C.ink);
    ui.bar(px + 6, py + 39, pw - 12, 5, (g.research.progress[r.id] ?? 0) / researchUnits(r.id, g), C.moss);
  } else {
    // a locked pick names what it waits for, in red, where the "press Research this" line sits
    const missing = sel && !g.research.done.has(sel.id) ? missingFor(g, sel.id) : [];
    if (labs.length && missing.length) ui.para('Needs: ' + missing.join(', '), px + 6, py + 18, pw - 12, C.brick);
    else ui.text(!labs.length ? 'Place a Study Desk first.' : sel ? (g.research.done.has(sel.id) ? 'Researched.' : 'Press "Research this" below.') : 'Pick a topic to study.', px + 6, py + 22, labs.length && sel ? C.moss : C.brick);
  }
  if (!sel) {
    ui.para('Five eras, left to right. Each era has a keystone (the copper frames): look, try, keep it running, then study it. Scroll to move down, shift + scroll to move across. Fit shows the whole tree.', px + 6, py + 56, pw - 12, C.walnut);
    return true;
  }
  let yy = py + 54;
  ui.text(ellipsize(sel.name, pw - 12), px + 6, yy, C.ink);
  ui.text(ERA_NAMES[sel.era], px + pw - 6, yy, C.oak, { align: 'right' });
  yy += 11;
  yy += ui.para(sel.desc, px + 6, yy, pw - 12, C.walnut) + 3;
  // a keystone's stages (look, try, keep it up), each with its check; the study is the fourth
  if (sel.keystone && !g.research.done.has(sel.id)) {
    const s = stages(g, sel.id), k = sel.keystone;
    ui.text('Keystone: before the study', px + 6, yy, C.oak);
    yy += 10;
    // a keystone walked by a main quest counts from that quest (looking early isn't the look)
    const kq = keystoneQuest(sel.id);
    if (kq && g.flags.has('keepers_line') && !keystoneOpen(g, sel.id)) yy += ui.para(`Its stages count from the quest "${kq.title}".`, px + 6, yy, pw - 12, C.pebble) + 1;
    const line = (ok: boolean | null, text: string) => {
      if (ok === null) return;
      ui.text(ok ? ICON.star : '-', px + 6, yy, ok ? C.moss : C.brick);
      yy += ui.para(text, px + 14, yy, pw - 20, ok ? C.moss : C.ink) + 1;
    };
    line(s.observe, k.observe?.label ?? '');
    if (k.experiment) for (const o of k.experiment) line(stageObjMet(g, o, sel.id), stageObjText(g, o, sel.id));
    if (k.validate) line(s.validate, `${k.validate.label} (${Math.floor(s.held / 60)}:${String(Math.floor(s.held % 60)).padStart(2, '0')})`);
    yy += 2;
  }
  const units = researchUnits(sel.id, g);
  // "15 of each" when a topic takes several bundles: the critic read "15 x [green][copper]" as 15 in all
  const costText = `Cost: ${units} ${sel.cost.length > 1 ? 'of each' : 'x'}`;
  ui.text(costText, px + 6, yy, C.oak);
  sel.cost.forEach((c, i) => ui.itemIcon(key(c.item), px + 10 + textWidth(costText) + i * 15, yy - 4, 14));
  yy += 14;
  // what you have toward it (bag + desks), so a pick you can't afford yet says so up front
  const have = (id: string) => g.player.inv.countId(id) + labs.reduce((a, l) => a + (l.inv?.countId(id) ?? 0), 0);
  const short = sel.cost.filter((c) => have(c.item) < units);
  if (!g.research.done.has(sel.id)) {
    yy += ui.para(short.length ? `You have ${short.map((c) => `${have(c.item)} ${ITEM_BY_ID.get(c.item)?.name.split(' ')[0].toLowerCase()}`).join(', ')} of ${units}: craft more (C)` : 'You have enough bundles', px + 6, yy, pw - 12, short.length ? C.brick : C.moss) + 2;
  }
  const unl = unlocksOf(sel.id);
  if (unl.items.length && yy < py + h - 90) {
    ui.text('Unlocks:', px + 6, yy, C.oak);
    yy += 10;
    unl.items.slice(0, 14).forEach((id, i) => {
      const ix = px + 6 + (i % 7) * 20, iy = yy + Math.floor(i / 7) * 20;
      ui.slot(ix, iy, { k: key(id), n: 1 }, { size: 18 });
      if (ui.hover(ix, iy, 18, 18)) ui.tip(itemTooltip(g, key(id)).slice(0, 3));
    });
  }
  const done = g.research.done.has(sel.id);
  const avail = canResearch(g, sel.id);
  if (!done && ui.button('rstart', px + 6, py + h - 48, pw - 12, 16, g.research.current === sel.id ? 'Researching...' : avail ? 'Research this' : 'Locked', { disabled: !avail || g.research.current === sel.id, style: 'green' })) setResearch(g, sel.id);
  return true;
}

/** what a node still needs: its missing prerequisites and the town keystone it waits on */
function missingFor(g: PlayScreen['g'], id: string): string[] {
  const r = RESEARCH_BY_ID.get(id)!;
  const out = r.prereq.filter((p) => !g.research.done.has(p)).map((p) => RESEARCH_BY_ID.get(p)?.name ?? p);
  if (r.needFlag && !g.flags.has(r.needFlag)) out.push(r.needFlag === 'waterworks' ? 'the Waterworks' : r.needFlag);
  return out;
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
  // the time windows apply to the item graphs, not to the Lines tab (it reads the day)
  if (st.data.tab !== 'lines') RES.forEach((_, i) => { if (ui.button('res' + i, x + 10 + i * 46, y + 10, 44, 14, labels[i], { active: st.data.res === i })) st.data.res = i; });
  if (ui.button('tLines', x + w - 234, y + 10, 70, 14, 'Lines', { active: st.data.tab === 'lines', tip: 'Every line end: what feeds it and why it stops' })) st.data.tab = 'lines';
  if (ui.button('tItems', x + w - 160, y + 10, 70, 14, 'Items', { active: st.data.tab === 'items' })) st.data.tab = 'items';
  if (ui.button('tPower', x + w - 86, y + 10, 70, 14, 'Power', { active: st.data.tab === 'power' })) st.data.tab = 'power';
  if (st.data.tab === 'power') return powerTab(ui, play, x, y, w, h);
  if (st.data.tab === 'lines') return linesTab(ui, play, st, x, y, w, h);
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
  nets.slice(0, 5).forEach((n, i) => {
    const ry = y + 46 + i * 46;
    ui.panel(x + 10, ry, w - 20, 42, 'inset', false);
    const col = n.sat >= 0.99 ? C.moss : n.sat > 0.5 ? C.amber : C.brick;
    ui.text(`Grid #${n.id}: ${n.gens} generators, ${n.consumers} machines, ${n.poles} poles`, x + 16, ry + 4, C.ink);
    ui.text(`${ICON.bolt} demand ${Math.round(n.demand)}  supply ${Math.round(n.cap)}  satisfaction ${Math.round(n.sat * 100)}%`, x + 16, ry + 15, col);
    if (n.storeCap) ui.text(`batteries ${Math.round(n.stored)}/${n.storeCap}`, x + w - 16, ry + 15, C.walnut, { align: 'right' });
    ui.bar(x + 16, ry + 27, w - 40, 4, n.cap > 0 ? Math.min(1, n.demand / n.cap) : 1, n.demand > n.cap ? C.brick : C.leaf);
    ui.text(ellipsize(gridSentence(g, n.id), w - 40), x + 16, ry + 32, n.demand > n.cap + 0.5 ? C.brick : C.walnut);
  });
  if (!nets.length) ui.para('No power grids yet. Research Water Power, then connect generators and machines with poles.', x + 12, y + 48, w - 24, C.walnut);
  return true;
}

registerWindow('research', { draw: drawResearch });
registerWindow('stats', { draw: drawStats, pause: false });

export { ITEM_BY_ID };
