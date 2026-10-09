// Structure-specific panels: study desk, coops/barns, hives, request crates, megaproject sites.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { MEGAPROJECTS, MEGA_BY_ID } from '../../data/goals';
import { RESEARCH_BY_ID } from '../../data/research';
import { ANIMAL_BY_ID } from '../../data/creatures';
import type { Ent } from '../../sim/ents';
import { key, kDef } from '../../sim/inventory';
import { researchUnits } from '../../sim/systems/research';
import { residents } from '../../sim/systems/animals';
import { hayCap } from '../../sim/systems/automation';
import { megaNeed, megaStage, startMega, goals } from '../../sim/systems/goals';
import { sprite, drawFit } from '../../render/atlas';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { invGrid } from './common';
import { STRUCT_PANELS } from './struct';
import { itemTooltip } from '../tooltips';
import { PORT_HANDLERS } from '../../sim/ports';
import { ICON } from '../font';
import { contractInsert, daysLeftInWeek, guild, guildRank, specLabel } from '../../sim/systems/contracts';
import { GUILD_BONUS_PER_RANK, GUILD_RANKS } from '../../data/contracts';
import { specIcon } from './menu';

STRUCT_PANELS.lab = (ui, play, e, x, y, w, st) => {
  const g = play.g;
  st.data.target = (k: number, n: number) => PORT_HANDLERS.lab.insert!(g, e, k, n);
  const cur = g.research.current ? RESEARCH_BY_ID.get(g.research.current) : null;
  ui.text(cur ? `Studying: ${cur.name}` : 'No research selected. Open the research tree (T).', x + 14, y + 2, cur ? C.ink : C.brick);
  if (cur) {
    ui.bar(x + 14, y + 13, w - 28, 5, (g.research.progress[cur.id] ?? 0) / researchUnits(cur.id, g), C.moss);
    ui.text(`${g.research.progress[cur.id] ?? 0}/${researchUnits(cur.id, g)} units  -  this desk: ${Math.round((e.st.progress ?? 0) * 100)}%`, x + 14, y + 21, C.walnut);
    ui.text('Each unit uses: ', x + 14, y + 33, C.oak);
    cur.cost.forEach((c, i) => ui.itemIcon(key(c.item), x + 90 + i * 16, y + 29, 14));
  }
  ui.text(e.st.status ?? '', x + w - 14, y + 2, C.oak, { align: 'right' });
  ui.text('Bundles in this desk (arms can fill it):', x + 14, y + 48, C.walnut);
  invGrid(ui, play, e.inv!, x + 14, y + 58, 12, { target: g.player.inv, accept: (k) => kDef(k).cat === 'research' });
  if (ui.button('openres', x + w - 100, y + 58, 86, 18, 'Research tree', {})) {
    play.win = null;
    play.openWindow('research');
  }
  return 92;
};

STRUCT_PANELS.building = (ui, play, e, x, y, w, st) => {
  const g = play.g;
  st.data.target = (k: number, n: number) => PORT_HANDLERS.building.insert!(g, e, k, n);
  if (e.def.id === 'silo') {
    ui.text(`Hay stored: ${g.sys.hay ?? 0} / ${hayCap(g)}`, x + 14, y + 4, C.ink);
    ui.para('Cut tall grass with your scythe to fill your silos. Coops and barns draw hay from here (Grand buildings automatically). Arms can take hay out.', x + 14, y + 16, w - 28, C.walnut);
    if (ui.button('takehay', x + 14, y + 52, 90, 16, 'Take 10 hay', { disabled: (g.sys.hay ?? 0) <= 0 })) {
      const n = Math.min(10, g.sys.hay);
      g.sys.hay -= n;
      g.give(key('hay'), n);
    }
    return 76;
  }
  if (e.def.id === 'well') {
    ui.text('A deep, cold well. Use your watering can on it to refill.', x + 14, y + 4, C.ink);
    return 30;
  }
  const res = residents(g, e);
  ui.text(`${res.length}/${e.def.capacity} animals  -  Feeder hay: ${e.st.hay ?? 0}/40`, x + 14, y + 2, C.ink);
  if (ui.button('addhay', x + w - 92, y - 1, 78, 13, 'Add hay', { style: 'flat', tip: 'Put hay from your bag into the feeder' })) {
    const have = g.player.inv.countId('hay');
    const n = Math.min(have, 40 - (e.st.hay ?? 0));
    if (n > 0) {
      g.player.inv.removeSpec('hay', n);
      e.st.hay = (e.st.hay ?? 0) + n;
    } else if ((g.sys.hay ?? 0) > 0) {
      const t = Math.min(g.sys.hay, 40 - (e.st.hay ?? 0));
      g.sys.hay -= t;
      e.st.hay = (e.st.hay ?? 0) + t;
    }
  }
  res.forEach((a, i) => {
    const def = ANIMAL_BY_ID.get(a.kind)!;
    const ax = x + 14 + (i % 4) * 78, ay = y + 14 + Math.floor(i / 4) * 24;
    const s = sprite(`an:${a.kind}:0:${a.baby ? 1 : 0}`);
    drawFit(ui.ctx, s, ax, ay, 22, 18);
    ui.text(a.name, ax + 24, ay + 2, C.ink);
    ui.text(a.baby ? 'baby' : ICON.heart.repeat(Math.max(1, Math.round(a.happy / 51))), ax + 24, ay + 11, C.rose);
    if (ui.hover(ax, ay, 76, 22)) ui.tip([{ text: `${a.name} the ${def.name}`, color: C.amber }, { text: def.desc }, { text: `Happiness ${a.happy}/255  Age ${a.age} days  Made ${a.made}`, color: C.pebble }, { text: a.petted ? 'Petted today' : 'Pet me today!', color: a.petted ? C.lime : C.blush }]);
  });
  const gy = y + 16 + Math.ceil(Math.max(1, res.length) / 4) * 24;
  ui.text('Products (click to collect; arms can take them):', x + 14, gy, C.walnut);
  invGrid(ui, play, e.inv!, x + 14, gy + 10, 12, { readonly: true });
  return gy - y + 36;
};

STRUCT_PANELS.hive = (ui, play, e, x, y, w) => {
  const g = play.g;
  const flying = (g.sys.bots?.list ?? []).filter((b: any) => b.hive === e.id).length;
  ui.text(`Bumblebots: ${e.st.bots ?? 0} resting, ${flying} flying  -  range ${e.def.reach} tiles`, x + 14, y + 2, C.ink);
  ui.text(e.net ? `Power ${Math.round(e.sat * 100)}%${e.sat < 0.5 ? ' (bots fly slowly)' : ''}` : 'No power: bots fly slowly', x + 14, y + 13, e.sat >= 0.5 ? C.moss : C.brick);
  ui.para('Bots carry items from Outbox and Storage crates to Request crates in range, and build blueprint ghosts using crate stock. Click with Bumblebots in hand to add them.', x + 14, y + 26, w - 28, C.walnut);
  if (ui.button('addbots', x + 14, y + 58, 90, 16, 'Add bumblebots', { disabled: g.player.inv.countId('bumblebot') <= 0 })) {
    const n = g.player.inv.countId('bumblebot');
    g.player.inv.removeSpec('bumblebot', n);
    e.st.bots = (e.st.bots ?? 0) + n;
  }
  if (ui.button('takebots', x + 110, y + 58, 90, 16, 'Take one back', { disabled: (e.st.bots ?? 0) <= 0 })) {
    e.st.bots--;
    g.give(key('bumblebot'), 1);
  }
  return 82;
};

function requestPanel(ui: UI, play: PlayScreen, e: Ent, x: number, y: number, w: number) {
  const g = play.g;
  const reqs: { k: number; n: number }[] = (e.st.requests ??= []);
  ui.text('Wish list (bots bring these). Click with an item to add, right-click to remove, wheel to change amount.', x + 14, y + 2, C.walnut);
  for (let i = 0; i < 6; i++) {
    const sx = x + 14 + i * 50, sy = y + 14;
    const r = reqs[i];
    const res = ui.slot(sx, sy, r ? { k: r.k, n: r.n } : null);
    if (r) ui.text(`have ${e.inv!.count(r.k)}`, sx, sy + 22, C.oak);
    if (res.click) {
      const held = ui.hand ?? g.player.inv.slots[g.player.sel];
      if (held && !r) reqs.push({ k: held.k & ~3, n: Math.min(200, Math.max(10, held.n)) });
      else if (held && r) reqs[i] = { k: held.k & ~3, n: r.n };
    }
    if (res.rclick && r) reqs.splice(i, 1);
    if (res.hover && r) {
      if (ui.input.mouse.wheel) {
        r.n = Math.max(1, Math.min(999, r.n + (ui.input.mouse.wheel < 0 ? 10 : -10)));
        ui.input.mouse.wheel = 0;
      }
      ui.tip([{ text: kDef(r.k).name, color: C.amber }, { text: `Keep ${r.n} here. Scroll to adjust.`, color: C.pebble }]);
    }
  }
  ui.text('Contents:', x + 14, y + 40, C.walnut);
  invGrid(ui, play, e.inv!, x + 14, y + 50, 12, { target: g.player.inv });
  return 50 + Math.ceil(e.inv!.size / 12) * 22 + 6;
}

const chestPanel = STRUCT_PANELS.chest;
STRUCT_PANELS.chest = (ui, play, e, x, y, w, st) => {
  if (e.def.id === 'crate_req') return requestPanel(ui, play, e, x, y, w);
  if (chestPanel) return chestPanel(ui, play, e, x, y, w, st);
  // generic chest
  ui.text(e.def.id === 'crate_out' ? 'Outbox: bumblebots take from here.' : e.def.id === 'crate_store' ? 'Storage: bumblebots keep spares here.' : `${e.inv!.slots.filter(Boolean).length}/${e.inv!.size} stacks used. Shift-click to move.`, x + 14, y + 2, C.walnut);
  invGrid(ui, play, e.inv!, x + 14, y + 14, 12, { target: play.g.player.inv });
  if (ui.button('csort', x + w - 60, y - 1, 46, 12, 'Sort', { style: 'flat' })) e.inv!.sort();
  return 24 + Math.ceil(e.inv!.size / 12) * 22 + 6;
};

STRUCT_PANELS.megaproject = (ui, play, e, x, y, w, st) => {
  const g = play.g;
  st.data.target = (k: number, n: number) => PORT_HANDLERS.megaproject.insert!(g, e, k, n);
  if (!e.st.project) {
    ui.text('Choose a megaproject to build here:', x + 14, y + 2, C.ink);
    MEGAPROJECTS.forEach((m, i) => {
      const done = goals(g).mega.includes(m.id);
      const yy = y + 14 + i * 34;
      ui.panel(x + 14, yy, w - 28, 32, 'paper', false);
      ui.text(m.name + (done ? ' (built!)' : ''), x + 20, yy + 3, C.ink);
      ui.para(m.desc, x + 20, yy + 12, w - 120, C.walnut, 9);
      if (!done && ui.button('mega' + i, x + w - 80, yy + 8, 60, 16, 'Begin', { style: 'green' })) startMega(g, e, m.id);
    });
    return 120;
  }
  const def = MEGA_BY_ID.get(e.st.project)!;
  if (e.st.complete) {
    ui.text(`${def.name}: complete!`, x + 14, y + 2, C.moss);
    ui.para(def.reward, x + 14, y + 14, w - 28, C.walnut);
    return 50;
  }
  const stage = megaStage(e)!;
  ui.text(`${def.name}  -  Stage ${e.st.stage + 1}/${def.stages.length}: ${stage.name}`, x + 14, y + 2, C.ink);
  stage.items.forEach((it, i) => {
    const need = megaNeed(e, it.item);
    const iy = y + 16 + i * 18;
    const icon = it.item[0] === '#' ? ({ '#wine': 'wine_grape', '#preserve': 'jam_apple' } as any)[it.item] : it.item;
    ui.itemIcon(key(icon), x + 14, iy, 14);
    ui.text(it.item[0] === '#' ? 'Any ' + it.item.slice(1) : ITEM_BY_ID.get(it.item)!.name, x + 32, iy + 3, C.ink);
    ui.bar(x + 150, iy + 3, 110, 7, (it.n - need) / it.n, C.moss);
    ui.text(`${it.n - need}/${it.n}`, x + w - 14, iy + 3, C.walnut, { align: 'right' });
  });
  const gy = y + 20 + stage.items.length * 18;
  ui.text('Feed it with arms and belts, or shift-click items in your bag below.', x + 14, gy, C.oak);
  ui.text('Reward: ' + def.reward, x + 14, gy + 10, C.moss);
  return gy - y + 24;
};

STRUCT_PANELS.depot = (ui, play, e, x, y, w, st) => {
  const g = play.g;
  const gs = guild(g);
  st.data.target = (k: number, n: number) => contractInsert(g, k, n);
  const rank = guildRank(g);
  const next = GUILD_RANKS[rank + 1];
  ui.text(`Guild rank: ${GUILD_RANKS[rank].name}  (+${Math.round(rank * GUILD_BONUS_PER_RANK * 100)}% shipping)`, x + 14, y + 2, C.ink);
  if (next) {
    ui.bar(x + 14, y + 12, 150, 4, (gs.rep - GUILD_RANKS[rank].rep) / (next.rep - GUILD_RANKS[rank].rep), C.amber);
    ui.text(`${gs.rep}/${next.rep} rep to ${next.name}`, x + 170, y + 10, C.walnut);
  }
  const left = daysLeftInWeek(g);
  ui.text(`New contracts every Monday. ${left === 1 ? 'Last day this week!' : left + ' days left this week.'}`, x + 14, y + 20, left === 1 ? C.brick : C.oak);
  if (!gs.unlocked) {
    ui.para('The Guild has not posted any contracts yet.', x + 14, y + 34, w - 28, C.walnut);
    return 60;
  }
  gs.list.forEach((c, i) => {
    const yy = y + 32 + i * 30;
    ui.panel(x + 12, yy, w - 24, 28, 'paper', false);
    const icon = c.spec[0] === '#' ? specIcon(c.spec) : c.spec;
    ui.itemIcon(key(icon), x + 17, yy + 6, 16);
    ui.text(c.label, x + 38, yy + 3, c.done ? C.moss : C.ink);
    ui.text(`${specLabel(c.spec)}: ${c.have}/${c.need}`, x + 38, yy + 12, C.walnut);
    ui.bar(x + 38, yy + 21, w - 140, 4, c.have / c.need, c.done ? C.leaf : C.moss);
    ui.text(c.done ? 'Filled!' : `${ICON.coin}${c.reward.toLocaleString()}`, x + w - 18, yy + 4, c.done ? C.moss : C.amber, { align: 'right' });
    ui.text(`+${c.rep} rep`, x + w - 18, yy + 14, C.oak, { align: 'right' });
    if (ui.hover(x + 12, yy, w - 24, 28)) ui.tip([{ text: c.label, color: C.amber }, { text: `Deliver ${c.need} ${specLabel(c.spec).toLowerCase()}` }, { text: 'Arms can feed the depot directly. Shift-click items in your bag below, or right-click the depot while holding them.', color: C.pebble }]);
  });
  return 32 + gs.list.length * 30 + 4;
};

STRUCT_PANELS.splitter = (ui, play, e, x, y, w) => {
  const g = play.g;
  const root = e.parent ?? e;
  const b = root.belt!;
  ui.text('Splits items evenly between its two outputs, lane by lane.', x + 14, y + 2, C.ink);
  ui.text('Output:', x + 14, y + 18, C.walnut);
  const modes: [number, string][] = [[0, 'Alternate'], [1, 'Prefer left'], [2, 'Prefer right']];
  modes.forEach(([m, label], i) => { if (ui.button('sprio' + m, x + 60 + i * 74, y + 15, 70, 14, label, { active: (b.sPrio ?? 0) === m && (b.sFilter ?? -1) < 0, style: 'flat' })) { b.sPrio = m; b.sFilter = -1; } });
  ui.text('Filter:', x + 14, y + 40, C.walnut);
  const fk = b.sFilter ?? -1;
  const r = ui.slot(x + 60, y + 34, fk >= 0 ? { k: fk, n: 1 } : null);
  if (r.click) {
    const held = ui.hand ?? g.player.inv.slots[g.player.sel];
    if (held) b.sFilter = held.k & ~3;
  }
  if (r.rclick) b.sFilter = -1;
  if (r.hover) ui.tip(fk >= 0 ? [{ text: kDef(fk).name, color: C.amber }, { text: 'Right-click to clear', color: C.pebble }] : [{ text: 'Click while holding an item to filter it' }]);
  ui.para(fk >= 0 ? `${kDef(fk).name} goes left; everything else goes right.` : 'Set a filter to sort one item out of a mixed belt (left = the side to your left when facing along the belt).', x + 86, y + 36, w - 100, C.oak, 9);
  return 64;
};

STRUCT_PANELS.pond = (ui, play, e, x, y, w, st) => {
  const g = play.g;
  st.data.target = (k: number, n: number) => (n > 0 && PORT_HANDLERS.pond.insert!(g, e, k, 1)) || 0;
  const fish = e.st.fish ? ITEM_BY_ID.get(e.st.fish) : null;
  if (fish) {
    ui.itemIcon(key(fish.id), x + 14, y + 2, 16);
    ui.text(`${fish.name}: ${e.st.pop}/10 fish`, x + 36, y + 3, C.ink);
    ui.bar(x + 36, y + 13, 150, 4, (e.st.pop ?? 0) / 10, C.aqua);
    ui.text('Lays roe every night. A crowded pond sometimes breeds a fish.', x + 14, y + 24, C.walnut);
  } else ui.para('Empty. Right-click the pond holding a fish (or shift-click one below) to stock it. Legendary fish refuse to live in ponds.', x + 14, y + 2, w - 28, C.walnut);
  ui.text('Pond basket (click to take):', x + 14, y + 38, C.oak);
  invGrid(ui, play, e.inv!, x + 14, y + 48, 6, { readonly: true });
  return 76;
};

STRUCT_PANELS.decor = (ui, play, e, x, y, w) => {
  ui.text(e.def.desc, x + 14, y + 4, C.ink);
  if (e.def.id === 'sign') ui.text('Right-click the sign while holding an item to show it.', x + 14, y + 16, C.walnut);
  void play;
  void w;
  return 30;
};

export { itemTooltip };
