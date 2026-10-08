// The main game menu: Inventory, Crafting, Skills tabs.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { STRUCT_BY_ID } from '../../data/structures';
import { RESEARCH_BY_ID } from '../../data/research';
import type { RecipeDef } from '../../data/types';
import { SKILLS, XP_LEVELS } from '../../sim/Game';
import { craft, canCraft, HAND_RECIPES, maxCraftable } from '../../sim/crafting';
import { key, kDef } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame, invGrid, SLOT } from './common';
import type { WinState } from './index';
import { itemTooltip } from '../tooltips';
import { ICON } from '../font';

const TABS = ['inventory', 'crafting', 'skills'] as const;
const CATS = ['All', 'Logistics', 'Power', 'Machines', 'Farming', 'Parts', 'Research', 'Home'] as const;

export function recipeCategory(r: RecipeDef): string {
  const out = ITEM_BY_ID.get(r.out[0].item)!;
  if (out.cat === 'research') return 'Research';
  if (out.places) {
    const s = STRUCT_BY_ID.get(out.places)!;
    if (['belt', 'underground', 'splitter', 'arm', 'chest', 'hive', 'shipbin'].includes(s.kind)) return 'Logistics';
    if (['pole', 'generator', 'accumulator'].includes(s.kind)) return 'Power';
    if (['machine', 'lab', 'drill', 'beehouse', 'harvester', 'planter', 'tapper', 'fishtrap', 'megaproject'].includes(s.kind)) return 'Machines';
    if (['sprinkler', 'scarecrow'].includes(s.kind)) return 'Farming';
    return 'Home';
  }
  if (out.cat === 'fertilizer' || out.cat === 'bait') return 'Farming';
  if (out.id === 'bumblebot') return 'Logistics';
  return 'Parts';
}

export function drawMenu(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  if (!st.data.tab) st.data.tab = st.arg ?? 'inventory';
  const w = 360, h = 268;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, st.data.tab === 'crafting' ? 'Crafting' : st.data.tab === 'skills' ? 'Skills' : 'Backpack')) return false;
  // tabs
  TABS.forEach((t, i) => {
    if (ui.button('tab_' + t, x + 10 + i * 64, y + 10, 60, 14, t[0].toUpperCase() + t.slice(1), { active: st.data.tab === t })) st.data.tab = t;
  });
  ui.text(`${ICON.coin} ${g.player.money.toLocaleString()}`, x + w - 26, y + 14, C.walnut, { align: 'right' });
  const inv = g.player.inv;
  if (st.data.tab === 'inventory') {
    const gx = x + 14, gy = y + 34;
    ui.text('Hotbar', gx, gy - 1, C.walnut);
    invGrid(ui, play, inv, gx, gy + 8, 12, { start: 0, count: 12, selected: g.player.sel });
    ui.text('Bag', gx, gy + 36, C.walnut);
    invGrid(ui, play, inv, gx, gy + 46, 12, { start: 12, count: 24 });
    // trash + sort
    const by = gy + 46 + 2 * (SLOT + 2) + 8;
    if (ui.button('sort', gx, by, 50, 16, 'Sort', { tip: 'Sort your bag (hotbar stays put)' })) {
      const hot = inv.slots.slice(0, 12);
      const bag = inv.slots.slice(12);
      const tmp = new (inv.constructor as any)(24);
      tmp.slots = bag;
      tmp.sort();
      inv.slots = [...hot, ...tmp.slots];
    }
    const tx = gx + 56;
    const hov = ui.hover(tx, by - 2, SLOT, SLOT);
    ui.panel(tx, by - 2, SLOT, SLOT, 'slot', false);
    ui.text('X', tx + 7, by + 4, hov ? C.rose : C.walnut);
    if (hov) ui.tip([{ text: 'Trash: drop a held stack here to throw it away' }]);
    if (hov && ui.clicked && ui.hand) {
      ui.eat();
      if (kDef(ui.hand.k).tool) ui.sfx('error');
      else {
        ui.hand = null;
        ui.sfx('cut');
      }
    }
    // character card
    const cx = x + 14, cy = by + 26;
    ui.panel(cx, cy, w - 28, 54, 'inset', false);
    ui.text(`${g.player.name} of ${g.player.farmName} Farm`, cx + 6, cy + 5, C.ink);
    ui.text(`Year ${g.time.year}  -  Day ${g.daysPlayed + 1} in Thistlewick`, cx + 6, cy + 16, C.walnut);
    ui.text(`Favorite thing: ${g.player.favorite}`, cx + 6, cy + 27, C.walnut);
    ui.text(`Tools at the smithy: ${g.player.upgrading ? ITEM_BY_ID.get(g.player.upgrading.to)?.name + ` (${g.player.upgrading.days}d)` : 'none'}`, cx + 6, cy + 38, C.walnut);
    ui.text('Shift-click moves items. Right-click splits.', cx + w - 34, cy + 5, C.oak, { align: 'right' });
    return true;
  }
  if (st.data.tab === 'crafting') return craftingTab(ui, play, st, x, y, w, h);
  // skills
  const sx = x + 16;
  SKILLS.forEach((s, i) => {
    const yy = y + 36 + i * 30;
    const lvl = g.player.skills[s] ?? 0;
    const xp = g.player.xp[s] ?? 0;
    ui.text(s[0].toUpperCase() + s.slice(1), sx, yy, C.ink);
    for (let k = 0; k < 10; k++) ui.fill(sx + 80 + k * 12, yy - 1, 10, 9, k < lvl ? C.amber : C.tan);
    const next = XP_LEVELS[Math.min(10, lvl + 1)];
    const prev = XP_LEVELS[lvl];
    ui.bar(sx + 80, yy + 11, 118, 4, lvl >= 10 ? 1 : (xp - prev) / (next - prev), C.leaf);
    ui.text(SKILL_PERKS[s], sx + 210, yy, C.walnut);
    ui.text(`Lv ${lvl}`, sx + 210, yy + 10, C.oak);
  });
  return true;
}

const SKILL_PERKS: Record<string, string> = {
  farming: 'Better crops, cheaper watering',
  foraging: 'Better forage, stronger chops',
  mining: 'More ore, cheaper swings',
  fishing: 'Wider catch zone',
  combat: 'More health and damage',
  tinkering: 'Machines & crafting know-how',
};

function craftingTab(ui: UI, play: PlayScreen, st: WinState, x: number, y: number, w: number, h: number): boolean {
  const g = play.g;
  st.data.cat = st.data.cat ?? 'All';
  CATS.forEach((c, i) => {
    if (ui.button('cat_' + c, x + 10 + i * 43, y + 28, 41, 13, c, { active: st.data.cat === c, style: 'flat' })) st.data.cat = c;
  });
  const showLocked = st.data.showLocked ?? true;
  const list = HAND_RECIPES.filter((r) => (st.data.cat === 'All' || recipeCategory(r) === st.data.cat) && (showLocked || g.unlocked(r.unlock)))
    .filter((r, i, arr) => arr.findIndex((o) => o.out[0].item === r.out[0].item) === i || g.unlocked(r.unlock));
  list.sort((a, b) => (g.unlocked(b.unlock) ? 1 : 0) - (g.unlocked(a.unlock) ? 1 : 0));
  const gx = x + 12, gy = y + 46, cols = 12;
  const rows = Math.ceil(list.length / cols);
  const areaH = 132;
  const off = ui.scrollOffset('craftlist', gx, gy, cols * (SLOT + 2) + 6, areaH, rows * (SLOT + 2));
  ui.clip(gx, gy, cols * (SLOT + 2) + 6, areaH);
  list.forEach((r, i) => {
    const sx = gx + (i % cols) * (SLOT + 2), sy = gy + Math.floor(i / cols) * (SLOT + 2) - off;
    if (sy < gy - SLOT || sy > gy + areaH) return;
    const unlocked = g.unlocked(r.unlock);
    const can = unlocked && canCraft(g, r);
    const res = ui.slot(sx, sy, { k: key(r.out[0].item), n: r.out[0].n }, { dim: !can, selected: st.data.sel === r.id });
    if (res.hover) {
      const lines = itemTooltip(g, key(r.out[0].item), 1);
      if (!unlocked) {
        const rn = r.unlock?.startsWith('r_') ? RESEARCH_BY_ID.get(r.unlock)?.name : r.unlock === 'flag:lab' ? 'the tutorial (Professor Cogwhistle)' : r.unlock;
        lines.push({ text: `Locked: research ${rn}`, color: C.rose });
      }
      ui.tip(lines.slice(0, 4));
    }
    if (res.click) {
      st.data.sel = r.id;
      if (can && ui.input.shift) craft(g, r, 5);
    }
    if (res.rclick && can) craft(g, r, 1);
  });
  ui.unclip();
  // detail panel
  const r = HAND_RECIPES.find((rr) => rr.id === st.data.sel);
  const dy = gy + areaH + 6;
  ui.panel(x + 12, dy, w - 24, h - (dy - y) - 10, 'inset', false);
  if (!r) {
    ui.text('Pick a recipe. Right-click an icon to craft one, shift-click for five.', x + 20, dy + 8, C.walnut);
    if (ui.button('locked', x + w - 110, dy + 22, 90, 14, showLocked ? 'Hide locked' : 'Show locked', { style: 'flat' })) st.data.showLocked = !showLocked;
    return true;
  }
  const out = ITEM_BY_ID.get(r.out[0].item)!;
  ui.itemIcon(key(out.id), x + 20, dy + 6, 16);
  ui.text(`${out.name}${r.out[0].n > 1 ? ' x' + r.out[0].n : ''}`, x + 40, dy + 7, C.ink);
  ui.text(recipeCategory(r), x + 40, dy + 16, C.oak);
  r.in.forEach((i, n) => {
    const have = g.player.inv.countSpec(i.item);
    const ix = x + 20 + n * 62, iy = dy + 28;
    const spec = i.item;
    const icon = spec[0] === '#' ? specIcon(spec) : spec;
    ui.itemIcon(key(icon), ix, iy, 12);
    const name = spec[0] === '#' ? 'any ' + spec.slice(1) : ITEM_BY_ID.get(spec)!.name;
    ui.text(`${Math.min(have, 999)}/${i.n}`, ix + 14, iy + 3, have >= i.n ? C.moss : C.brick);
    if (ui.hover(ix, iy, 50, 12)) ui.tip([{ text: name }]);
  });
  const unlocked = g.unlocked(r.unlock);
  const max = unlocked ? maxCraftable(g, r) : 0;
  if (ui.button('craft1', x + w - 132, dy + 6, 54, 16, 'Craft', { style: 'green', disabled: max < 1 })) craft(g, r, 1);
  if (ui.button('craft5', x + w - 74, dy + 6, 54, 16, max >= 5 ? 'x5' : 'Max', { disabled: max < 1 })) craft(g, r, Math.min(5, max));
  if (!unlocked) ui.text('Locked - see the research tree (T)', x + w - 22, dy + 30, C.brick, { align: 'right' });
  return true;
}

export function specIcon(spec: string): string {
  const t = spec.slice(1);
  const map: Record<string, string> = { crop: 'radish', fruit: 'strawberry', forage: 'wild_garlic', flower: 'tulip', preserve: 'jam_strawberry', animal: 'egg', gem: 'amethyst', wine: 'wine_grape', fish: 'silver_dart', greens: 'spinach', vegetable: 'potato', egg: 'egg', milk: 'milk', honey: 'honey', mushroom: 'field_mushroom' };
  return map[t] ?? 'fiber';
}
