// Structure windows: chests, machines (recipe picker), arms (filters), power poles (grid stats), generators.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import type { RecipeDef } from '../../data/types';
import type { Ent } from '../../sim/ents';
import { Inventory, key, kDef, kId } from '../../sim/inventory';
import { availableRecipes, machInsert, setRecipe, stationRecipes } from '../../sim/systems/machines';
import { powerState } from '../../sim/systems/power';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame, invGrid, SLOT } from './common';
import type { WinState } from './index';
import { itemTooltip, stationName } from '../tooltips';
import { ICON } from '../font';
import { RESEARCH_BY_ID } from '../../data/research';

/** Extra struct panels registered by later systems (labs, buildings, hives, megaprojects...). */
export const STRUCT_PANELS: Record<string, (ui: UI, play: PlayScreen, e: Ent, x: number, y: number, w: number, st: WinState) => number> = {};

export function drawStruct(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const e = g.ents.get(st.arg);
  if (!e || e.ghost) return false;
  const p = g.player;
  if (Math.hypot(e.x + e.w / 2 - p.x, e.y + e.h / 2 - p.y) > 10) return false;
  const w = 340;
  const kind = e.def.kind;
  const playerGridH = 3 * (SLOT + 2) + 14;
  let topH = 100;
  if (e.inv && (kind === 'chest' || kind === 'shipbin' || kind === 'building' || kind === 'harvester' || kind === 'planter' || kind === 'fishtrap' || kind === 'tapper' || kind === 'drill'))
    topH = 24 + Math.ceil(e.inv.size / 12) * (SLOT + 2) + 16;
  if (e.mach) topH = 150;
  if (kind === 'pole' || kind === 'generator' || kind === 'accumulator') topH = 140;
  if (STRUCT_PANELS[kind]) topH = st.data.topH ?? 150;
  const h = topH + playerGridH + 24;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, e.def.name)) return false;
  const inv = p.inv;
  const top = y + 14;
  let target: Inventory | ((k: number, n: number) => number) | undefined;
  if (STRUCT_PANELS[kind]) {
    st.data.topH = STRUCT_PANELS[kind](ui, play, e, x, top, w, st);
  } else if (e.mach) {
    target = machinePanel(ui, play, e, x, top, w, st);
  } else if (kind === 'pole' || kind === 'generator' || kind === 'accumulator') {
    powerPanel(ui, play, e, x, top, w);
    if (e.gen && e.def.fuel) {
      target = (k, n) => {
        if (!kDef(k).fuel) return 0;
        if (e.gen!.fuel && e.gen!.fuel.k !== k) return 0;
        if (!e.gen!.fuel) e.gen!.fuel = { k, n: 0 };
        const t = Math.min(n, 50 - e.gen!.fuel.n);
        e.gen!.fuel.n += t;
        return t;
      };
    }
  } else if (e.inv) {
    const readonly = kind === 'harvester' || kind === 'fishtrap' || kind === 'tapper' || kind === 'drill' || (kind === 'building' && e.def.id !== 'silo');
    if (kind === 'shipbin') ui.text('Items here are sold overnight. Arms can feed this crate.', x + 14, top + 2, C.walnut);
    else if (kind === 'planter') ui.text('Seeds and fertilizer for sowing. Arms can refill it.', x + 14, top + 2, C.walnut);
    else ui.text(readonly ? 'Collected goods. Click to take, or use an arm.' : `${e.inv.slots.filter(Boolean).length}/${e.inv.size} stacks used. Shift-click to move.`, x + 14, top + 2, C.walnut);
    invGrid(ui, play, e.inv, x + 14, top + 14, 12, { target: inv, readonly, accept: kind === 'shipbin' ? (k) => kDef(k).price > 0 : undefined });
    if (!readonly) target = e.inv;
    if (kind === 'chest' && ui.button('csort', x + w - 60, top - 1, 46, 12, 'Sort', { style: 'flat' })) e.inv.sort();
    if (kind === 'shipbin') {
      let total = 0;
      for (const s of e.inv.slots) if (s) total += (g.sys.market?.priceOf?.(g, s.k) ?? kDef(s.k).price) * s.n;
      ui.text(`Estimated value: ${ICON.coin}${total}`, x + w - 14, top + 2, C.moss, { align: 'right' });
    }
  } else if (e.arm) {
    armPanel(ui, play, e, x, top, w);
  } else {
    ui.text(e.def.desc, x + 14, top + 4, C.ink);
  }
  // player inventory
  const py = y + h - playerGridH - 10;
  ui.text('Your bag (shift-click to move)', x + 14, py - 2, C.walnut);
  invGrid(ui, play, inv, x + 14, py + 8, 12, { target, count: 36 });
  return true;
}

function machinePanel(ui: UI, play: PlayScreen, e: Ent, x: number, y: number, w: number, st: WinState): (k: number, n: number) => number {
  const g = play.g;
  const m = e.mach!;
  ui.text(stationName(m.station) + (e.def.speed && e.def.speed !== 1 ? `  (speed x${e.def.speed})` : ''), x + 14, y + 2, C.walnut);
  const statusCol = m.status === 'Working' ? C.moss : m.status.includes('power') || m.status.includes('fuel') ? C.brick : C.oak;
  ui.text(m.status, x + w - 14, y + 2, statusCol, { align: 'right' });
  // input / output / fuel
  const iy = y + 16;
  ui.text('In', x + 14, iy + 6, C.oak);
  const ins = [...m.inBuf].slice(0, 4);
  for (let i = 0; i < 4; i++) {
    const s = ins[i] ? { k: ins[i][0], n: ins[i][1] } : null;
    const r = ui.slot(x + 30 + i * 22, iy, s);
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n));
    if ((r.click || r.rclick) && s && !ui.hand) {
      const back = g.player.inv.add(s.k, s.n);
      if (back) m.inBuf.set(s.k, back);
      else m.inBuf.delete(s.k);
    } else if (r.click && ui.hand) {
      const n = machInsert(g, e, ui.hand.k, ui.hand.n, true);
      ui.hand.n -= n;
      if (ui.hand.n <= 0) ui.hand = null;
    }
  }
  // progress arrow
  const ax = x + 124;
  ui.bar(ax, iy + 7, 40, 6, m.crafting ? m.progress : 0, C.lime);
  if (m.recipe && m.crafting) ui.text(`${Math.max(0, Math.ceil((1 - m.progress) * m.recipe.time / (m.speed * g.mods.machineSpeed)))}s`, ax + 20, iy - 2, C.oak, { align: 'center' });
  ui.text('Out', x + 172, iy + 6, C.oak);
  for (let i = 0; i < 3; i++) {
    const s = m.outBuf[i] ?? null;
    const r = ui.slot(x + 192 + i * 22, iy, s);
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n));
    if ((r.click || r.rclick) && s) {
      const left = g.player.inv.add(s.k, s.n);
      s.n = left;
      m.outBuf = m.outBuf.filter((o) => o.n > 0);
      ui.sfx('pickup');
    }
  }
  if (e.def.fuel) {
    ui.text('Fuel', x + 268, iy - 2, C.oak);
    const r = ui.slot(x + 268, iy + 6, m.fuel);
    if (r.hover) ui.tip([{ text: 'Fuel: wood, coal, sawdust, driftwood...' }, { text: `Burn left: ${Math.ceil(m.burn)}s`, color: C.pebble }]);
    if (r.click && ui.hand && kDef(ui.hand.k).fuel) {
      const n = machInsert(g, e, ui.hand.k, ui.hand.n, true);
      ui.hand.n -= n;
      if (ui.hand.n <= 0) ui.hand = null;
    } else if ((r.click || r.rclick) && m.fuel && !ui.hand) {
      const left = g.player.inv.add(m.fuel.k, m.fuel.n);
      m.fuel.n = left;
      if (!left) m.fuel = null;
    }
  }
  if (e.def.powerUse) {
    const sat = e.net ? Math.round(e.sat * 100) : 0;
    ui.text(`${ICON.bolt} ${e.def.powerUse} sparks  ${e.net ? `grid ${sat}%` : 'no pole nearby'}`, x + 14, iy + 26, sat >= 99 ? C.moss : C.brick);
  }
  ui.text(`Made so far: ${m.made}`, x + w - 14, iy + 26, C.oak, { align: 'right' });
  // recipe list
  const ry = iy + 40;
  const all = stationRecipes(m.station).filter((r) => g.unlocked(r.unlock));
  const locked = stationRecipes(m.station).length - all.length;
  ui.text(m.locked ? 'Recipe (locked in)' : all.some((r) => r.in.length > 1) ? 'Recipes (pick one for multi-ingredient goods)' : 'Recipes (picked automatically from inputs)', x + 14, ry, C.walnut);
  if (m.locked && ui.button('unlock', x + w - 70, ry - 3, 56, 12, 'Auto', { style: 'flat', tip: 'Let the machine pick recipes from its inputs' })) setRecipe(g, e, null);
  const cols = 13;
  const listY = ry + 10;
  const rows = Math.ceil(all.length / cols);
  const areaH = 2 * (SLOT + 2);
  const off = ui.scrollOffset('rec_' + e.id, x + 14, listY, cols * (SLOT + 2) + 6, areaH, rows * (SLOT + 2));
  ui.clip(x + 14, listY, cols * (SLOT + 2) + 6, areaH);
  all.forEach((r: RecipeDef, i) => {
    const sx = x + 14 + (i % cols) * (SLOT + 2), sy = listY + Math.floor(i / cols) * (SLOT + 2) - off;
    if (sy < listY - SLOT || sy > listY + areaH) return;
    const res = ui.slot(sx, sy, { k: key(r.out[0].item), n: r.out[0].n }, { selected: m.recipe?.id === r.id && m.locked });
    if (res.hover) {
      const ing = r.in.map((i) => `${i.n}x ${i.item[0] === '#' ? 'any ' + i.item.slice(1) : ITEM_BY_ID.get(i.item)!.name}`).join(' + ');
      ui.tip([{ text: ITEM_BY_ID.get(r.out[0].item)!.name, color: C.amber }, { text: ing || 'Nothing needed' }, { text: `${r.time}s per batch` + (r.out.length > 1 ? ', with bonus outputs' : ''), color: C.pebble }, { text: 'Click to lock this recipe in', color: C.pebble }]);
    }
    if (res.click) setRecipe(g, e, m.locked && m.recipe?.id === r.id ? null : r);
  });
  ui.unclip();
  if (locked) ui.text(`${locked} more recipe${locked > 1 ? 's' : ''} locked behind research`, x + 14, listY + areaH + 2, C.oak);
  void st;
  void availableRecipes;
  return (k, n) => {
    const t = machInsert(g, e, k, n, true);
    return t;
  };
}

function armPanel(ui: UI, play: PlayScreen, e: Ent, x: number, y: number, w: number) {
  const g = play.g;
  const a = e.arm!;
  const rate = a.speed * 60 * (a.hand + g.mods.armHand);
  ui.text(`Moves up to ${Math.round(rate)} items per minute${a.reach > 1 ? `, reach ${a.reach}` : ''}.`, x + 14, y + 2, C.ink);
  ui.text(a.powered ? `${ICON.bolt} ${e.def.powerUse} sparks while swinging  ${e.net ? `grid ${Math.round(e.sat * 100)}%` : 'no pole nearby!'}` : 'Spring-wound: no power needed.', x + 14, y + 13, a.powered && (!e.net || e.sat < 0.99) ? C.brick : C.moss);
  ui.text('Picks up from the green square, drops onto the gold one. R rotates.', x + 14, y + 24, C.walnut);
  if (e.def.filter) {
    ui.text('Filter (only these items). Click with an item, right-click to clear:', x + 14, y + 40, C.walnut);
    for (let i = 0; i < 5; i++) {
      const k = a.filter[i];
      const r = ui.slot(x + 14 + i * 22, y + 52, k !== undefined ? { k, n: 1 } : null);
      if (r.click && ui.hand) {
        a.filter[i] = ui.hand.k & ~3;
        a.filter = a.filter.filter((v) => v !== undefined);
      } else if (r.click && !ui.hand) {
        // pick from the hotbar selection
        const held = g.player.inv.slots[g.player.sel];
        if (held) a.filter[i] = held.k & ~3;
      }
      if (r.rclick) a.filter.splice(i, 1);
      if (r.hover && k !== undefined) ui.tip([{ text: kDef(k).name }]);
    }
  }
  if (a.held) {
    ui.text('Holding:', x + 200, y + 52, C.oak);
    ui.itemIcon(a.held.k, x + 240, y + 48, 16, a.held.n);
  }
}

function powerPanel(ui: UI, play: PlayScreen, e: Ent, x: number, y: number, w: number) {
  const g = play.g;
  const ps = powerState(g);
  const n = e.net ? ps.nets.get(e.net) : undefined;
  if (e.gen) {
    const cap = e.gen.cap;
    ui.text(`Output now: ${Math.round(e.gen.out)} / ${Math.round(cap)} sparks`, x + 14, y + 2, C.ink);
    if (e.def.id === 'windmill') ui.text(`Wind today: ${Math.round(g.wind * 100)}%`, x + 200, y + 2, C.walnut);
    if (e.def.id === 'sunlens') ui.text(`Daylight: ${Math.round(Math.max(0, g.daylight) * 100)}%`, x + 200, y + 2, C.walnut);
    if (e.def.fuel) {
      ui.text('Fuel', x + 270, y + 14, C.oak);
      const r = ui.slot(x + 270, y + 22, e.gen.fuel);
      if ((r.click || r.rclick) && e.gen.fuel && !ui.hand) {
        const left = g.player.inv.add(e.gen.fuel.k, e.gen.fuel.n);
        e.gen.fuel.n = left;
        if (!left) e.gen.fuel = null;
      } else if (r.click && ui.hand && kDef(ui.hand.k).fuel && (!e.gen.fuel || e.gen.fuel.k === ui.hand.k)) {
        if (!e.gen.fuel) e.gen.fuel = { k: ui.hand.k, n: 0 };
        e.gen.fuel.n += ui.hand.n;
        ui.hand = null;
      }
    }
  }
  if (e.def.kind === 'accumulator') ui.text(`Stored: ${Math.round(e.st.stored)} / ${e.st.cap} spark-seconds`, x + 14, y + 2, C.ink);
  if (!n) {
    ui.text(e.def.kind === 'pole' ? 'Not connected to anything yet.' : 'Not connected to a pole! Place a pole nearby.', x + 14, y + 16, C.brick);
    return;
  }
  ui.text(`Grid #${n.id}: ${n.poles} poles, ${n.gens} generators, ${n.consumers} machines`, x + 14, y + 16, C.walnut);
  const satCol = n.sat >= 0.99 ? C.moss : n.sat > 0.5 ? C.amber : C.brick;
  ui.text(`Demand ${Math.round(n.demand)}   Supply ${Math.round(n.cap)}   Satisfaction ${Math.round(n.sat * 100)}%`, x + 14, y + 27, satCol);
  if (n.storeCap) ui.text(`Batteries ${Math.round(n.stored)} / ${n.storeCap}`, x + w - 14, y + 27, C.walnut, { align: 'right' });
  // graph
  const gx = x + 14, gy = y + 40, gw = w - 28, gh = 70;
  ui.panel(gx, gy, gw, gh, 'inset', false);
  const hd = n.hist.d, hs = n.hist.s;
  const max = Math.max(10, ...hd, ...hs) * 1.1;
  const plot = (arr: number[], col: number) => {
    for (let i = 1; i < arr.length; i++) {
      const x0 = gx + 2 + ((i - 1) / 59) * (gw - 4), x1 = gx + 2 + (i / 59) * (gw - 4);
      const y0 = gy + gh - 2 - (arr[i - 1] / max) * (gh - 4), y1 = gy + gh - 2 - (arr[i] / max) * (gh - 4);
      const steps = Math.max(1, Math.ceil(Math.abs(x1 - x0)));
      for (let s = 0; s <= steps; s++) ui.fill(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 1, 1, col);
    }
  };
  plot(hs, C.leaf);
  plot(hd, C.rose);
  ui.text('supply', gx + 4, gy + 3, C.moss);
  ui.text('demand', gx + 40, gy + 3, C.brick);
  ui.text(`${Math.round(max)}`, gx + gw - 4, gy + 3, C.oak, { align: 'right' });
  ui.text('last 60s', gx + gw - 4, gy + gh - 10, C.oak, { align: 'right' });
  void kId;
  void RESEARCH_BY_ID;
}
