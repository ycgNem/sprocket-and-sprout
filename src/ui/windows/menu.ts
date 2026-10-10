// The main game menu: Inventory, Crafting, Skills tabs.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { FARM_BY_ID } from '../../data/modes';
import { STRUCT_BY_ID } from '../../data/structures';
import { RESEARCH_BY_ID } from '../../data/research';
import type { RecipeDef } from '../../data/types';
import { SKILLS, XP_LEVELS } from '../../sim/Game';
import { pendingPerk, perksFor } from '../../sim/perks';
import { perkChoices } from '../../data/perks';
import { craft, canCraft, HAND_RECIPES, maxCraftable } from '../../sim/crafting';
import { key, kDef } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame, invGrid, SLOT } from './common';
import type { WinState } from './index';
import { itemTooltip } from '../tooltips';
import { ICON, ellipsize, wrapText } from '../font';

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
    // shift-click swaps rows: hotbar -> bag and bag -> hotbar
    invGrid(ui, play, inv, gx, gy + 8, 12, { start: 0, count: 12, selected: g.player.sel, target: (k, n) => n - inv.addRange(k, n, 12, 36) });
    ui.text('Bag', gx, gy + 36, C.walnut);
    invGrid(ui, play, inv, gx, gy + 46, 12, { start: 12, count: 24, target: (k, n) => n - inv.addRange(k, n, 0, 12) });
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
    ui.text(`${{ story: 'Story', cozy: 'Cozy', rush: 'Clockwork Rush', sandbox: 'Sandbox' }[g.mode]} on the ${FARM_BY_ID.get(g.farmKind)?.name ?? 'Homestead'}`, cx + 6, cy + 27, C.walnut);
    ui.text(`Tools at the smithy: ${g.player.upgrading ? ITEM_BY_ID.get(g.player.upgrading.to)?.name + ` (${g.player.upgrading.days}d)` : 'none'}`, cx + 6, cy + 38, C.walnut);
    ui.text('Shift-click: hotbar <-> bag. Right-click splits.', cx + w - 34, cy + 5, C.oak, { align: 'right' });
    return true;
  }
  if (st.data.tab === 'crafting') return craftingTab(ui, play, st, x, y, w, h);
  // skills: one card each (ROADMAP.md 10, bug 5): the level ring, XP to the next level, how to
  // raise it, what its levels give and the next perk
  const cw = Math.floor((w - 34) / 2), ch = 72;
  const pend = pendingPerk(g);
  SKILLS.forEach((s, i) => {
    const cx = x + 12 + (i % 2) * (cw + 10), cy = y + 30 + Math.floor(i / 2) * (ch + 3);
    skillCard(ui, play, s, cx, cy, cw, ch, pend?.skill === s);
  });
  return true;
}

/** what raises each skill and what its levels give (the numbers live in the systems that use them) */
const SKILL_INFO: Record<string, { icon: string; raise: string; gives: string }> = {
  farming: { icon: 'cogbean', raise: 'Harvest crops you grew', gives: 'Better crops, the odd extra one, cheaper hoeing' },
  foraging: { icon: 'wild_garlic', raise: 'Forage, chop trees', gives: 'Better-quality forage, cheaper axe swings' },
  mining: { icon: 'copper_ore', raise: 'Break rocks and ore', gives: 'More ore per rock, cheaper pickaxe swings' },
  fishing: { icon: 'silver_dart', raise: 'Catch fish', gives: 'A wider catch zone, cheaper casts' },
  combat: { icon: 'sword_1', raise: 'Fight in the mine', gives: 'More damage dealt, less taken' },
  tinkering: { icon: 'copper_gear', raise: 'Collect from machines, craft', gives: 'Its perks speed up machines and arms' },
};

function skillCard(ui: UI, play: PlayScreen, s: string, x: number, y: number, w: number, h: number, choose: boolean) {
  const g = play.g;
  const info = SKILL_INFO[s];
  const lvl = g.player.skills[s] ?? 0;
  const xp = g.player.xp[s] ?? 0;
  ui.panel(x, y, w, h, 'inset', false);
  // the level ring: ten pips around the skill's icon
  const rx = x + 16, ry = y + 17;
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    ui.fill(Math.round(rx + Math.cos(a) * 12) - 1, Math.round(ry + Math.sin(a) * 12) - 1, 3, 3, k < lvl ? C.amber : C.tan);
  }
  ui.itemIcon(key(info.icon), rx - 8, ry - 8, 16);
  const tx = x + 34, tw = w - 40;
  ui.text(s[0].toUpperCase() + s.slice(1), tx, y + 4, C.ink);
  ui.text(`Lv ${lvl}`, x + w - 6, y + 4, lvl >= 10 ? C.moss : C.walnut, { align: 'right' });
  const next = XP_LEVELS[Math.min(10, lvl + 1)], prev = XP_LEVELS[lvl];
  ui.bar(tx, y + 14, tw, 4, lvl >= 10 ? 1 : (xp - prev) / (next - prev), C.leaf);
  ui.text(lvl >= 10 ? 'Mastered' : `${next - xp} XP to Lv ${lvl + 1}`, tx, y + 21, C.oak);
  ui.text(ellipsize(info.raise, w - 12), x + 6, y + 33, C.walnut);
  wrapText(info.gives, w - 12).slice(0, 2).forEach((l, i) => ui.text(l, x + 6, y + 42 + i * 8, C.oak));
  // the next perk (levels 5 and 10), or the ones chosen
  const chosen = perksFor(g, s);
  const due = [5, 10].find((L) => !chosen.some((p) => p.level === L));
  const perkLine = choose ? '' : due ? `Lv ${due}: ${perkChoices(s, due as 5 | 10).map((p) => p.name).join(' or ')}` : chosen.map((p) => p.name).join(', ');
  if (perkLine) ui.text(ellipsize(perkLine, w - 12), x + 6, y + h - 10, due ? C.rust : C.moss);
  if (choose && ui.button('perkpick' + s, x + 6, y + h - 14, w - 12, 12, `Lv ${pendingPerk(g)?.level ?? ''}: choose a perk!`, { style: 'green' })) play.openWindow('perk');
  if (ui.hover(x, y, w, h)) {
    const lines = [{ text: `${s[0].toUpperCase() + s.slice(1)}, level ${lvl}`, color: C.amber }, { text: `Raise it: ${info.raise.toLowerCase()}.` }, { text: info.gives + '.' }];
    for (const L of [5, 10] as const) for (const p of perkChoices(s, L)) lines.push({ text: `Lv ${L} ${p.name}${chosen.includes(p) ? ' (yours)' : ''}: ${p.desc}`, color: chosen.includes(p) ? C.lime : C.pebble });
    ui.tip(lines, 240);
  }
}

function craftingTab(ui: UI, play: PlayScreen, st: WinState, x: number, y: number, w: number, h: number): boolean {
  const g = play.g;
  st.data.cat = st.data.cat ?? 'All';
  CATS.forEach((c, i) => {
    if (ui.button('cat_' + c, x + 10 + i * 43, y + 28, 41, 13, c, { active: st.data.cat === c, style: 'flat' })) st.data.cat = c;
  });
  const showLocked = st.data.showLocked ?? false;
  const list = HAND_RECIPES.filter((r) => (st.data.cat === 'All' || recipeCategory(r) === st.data.cat) && (showLocked || g.unlocked(r.unlock)))
    .filter((r, i, arr) => arr.findIndex((o) => o.out[0].item === r.out[0].item) === i || g.unlocked(r.unlock));
  list.sort((a, b) => (g.unlocked(b.unlock) ? 1 : 0) - (g.unlocked(a.unlock) ? 1 : 0));
  // labelled rows (icon + name), three to a line, under a header per category (ROADMAP.md 10, item 14)
  const gx = x + 12, gy = y + 46, gw = w - 24, cols = 3, colW = Math.floor((gw - 8) / cols), rowH = 15;
  const groups = (st.data.cat === 'All' ? CATS.slice(1) : [st.data.cat as string]).map((c) => ({ c, rs: list.filter((r) => recipeCategory(r) === c) })).filter((x) => x.rs.length);
  const lines: ({ head: string } | { rs: RecipeDef[] })[] = [];
  for (const gr of groups) {
    if (st.data.cat === 'All') lines.push({ head: `${gr.c} (${gr.rs.length})` });
    for (let i = 0; i < gr.rs.length; i += cols) lines.push({ rs: gr.rs.slice(i, i + cols) });
  }
  const areaH = 132;
  const lineH = (l: (typeof lines)[number]) => ('head' in l ? 11 : rowH);
  const off = ui.scrollOffset('craftlist', gx, gy, gw, areaH, lines.reduce((a, l) => a + lineH(l), 0));
  ui.clip(gx, gy, gw, areaH);
  let ly = gy - off;
  for (const l of lines) {
    const lh = lineH(l);
    if (ly > gy + areaH || ly + lh < gy) {
      ly += lh;
      continue;
    }
    if ('head' in l) {
      ui.text(l.head, gx + 2, ly + 2, C.walnut);
      ui.fill(gx + 2, ly + 9, gw - 12, 1, C.tan);
    } else
      l.rs.forEach((r, i) => {
        const rx = gx + i * colW, unlocked = g.unlocked(r.unlock), can = unlocked && canCraft(g, r);
        const sel = st.data.sel === r.id;
        const hov = ui.hover(rx, ly, colW - 2, rowH - 1);
        if (sel || hov) ui.fill(rx, ly, colW - 2, rowH - 1, sel ? C.butter : C.tan, sel ? 0.7 : 0.5);
        ui.itemIcon(key(r.out[0].item), rx + 1, ly + 1, 12, 0, can ? 1 : 0.45);
        const out = ITEM_BY_ID.get(r.out[0].item)!;
        ui.text(ellipsize(out.name + (r.out[0].n > 1 ? ` x${r.out[0].n}` : ''), colW - 20), rx + 16, ly + 4, can ? C.ink : unlocked ? C.oak : C.pebble);
        if (hov) {
          const tl = itemTooltip(g, key(r.out[0].item), 1);
          if (!unlocked) {
            const rn = r.unlock?.startsWith('r_') ? RESEARCH_BY_ID.get(r.unlock)?.name : r.unlock === 'flag:lab' ? "the keeper's study desk" : r.unlock;
            tl.push({ text: `Locked: research ${rn}`, color: C.rose });
          }
          ui.tip(tl.slice(0, 4));
          if (ui.clicked) {
            ui.eat();
            st.data.sel = r.id;
            if (can && ui.input.shift) craft(g, r, 5);
          }
          if (ui.rclicked) {
            ui.eatR();
            if (can) craft(g, r, 1);
          }
        }
      });
    ly += lh;
  }
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
