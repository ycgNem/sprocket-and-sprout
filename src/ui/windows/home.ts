// Home windows: the farmhouse kitchen (instant cooking) and the root cellar.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { recipesForStation } from '../../data/recipes';
import { key } from '../../sim/inventory';
import { canCookHome, cookHome, homeCount, maxCookHome, pantry } from '../../sim/systems/house';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame, invGrid } from './common';
import { registerWindow, WinState } from './index';
import { itemTooltip } from '../tooltips';
import { specIcon } from './menu';
import { RECIPE_TEACHERS, shortName } from '../../data/cookbook';
import { NPC_BY_ID } from '../../data/npcs';
import { adoptPet, declinePet, petSys, PET_COATS } from '../../sim/systems/pet';
import { DEFAULT_HAMSTER_NAMES, HAMSTER_COATS, hamsterSys, nameHamster } from '../../sim/systems/hamster';
import { sprite, drawFit } from '../../render/atlas';

const OVEN = recipesForStation('oven');

function drawCooking(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const pan = pantry(g);
  const W = 440, H = 318;
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, 'Farmhouse Kitchen')) return false;
  const tab: string = st.data.tab ?? 'Cook';
  const tabs = pan ? ['Cook', 'Cellar'] : ['Cook'];
  tabs.forEach((t, i) => { if (ui.button('ktab' + t, x + 12 + i * 62, y + 12, 58, 14, t, { active: tab === t })) st.data.tab = t; });
  if (tab === 'Cellar' && pan) {
    ui.text('Root cellar (the kitchen cooks from here too). Shift-click to move.', x + 12, y + 32, C.walnut);
    invGrid(ui, play, pan, x + 22, y + 44, 18, { target: g.player.inv });
    ui.text('Your bag', x + 12, y + 104, C.walnut);
    invGrid(ui, play, g.player.inv, x + 22, y + 116, 18, { target: pan });
    return true;
  }
  ui.text(pan ? 'Uses ingredients from your bag and the root cellar.' : 'Uses ingredients from your bag. Shift-click Cook to make five.', x + 12, y + H - 14, C.walnut);
  const onlyReady = !!st.data.ready;
  if (ui.button('kready', x + W - 104, y + 12, 90, 14, onlyReady ? 'Show all' : 'Can cook now', { style: 'flat' })) st.data.ready = !onlyReady;
  const list = OVEN.filter((r) => (!onlyReady || canCookHome(g, r))).sort((a, b) => (g.unlocked(a.unlock) ? 0 : 1) - (g.unlocked(b.unlock) ? 0 : 1));
  const colW = (W - 30) / 2;
  list.forEach((r, n) => {
    const col = n % 2, row = Math.floor(n / 2);
    const rx = x + 12 + col * (colW + 6), ry = y + 34 + row * 24;
    if (ry > y + H - 26) return;
    const can = canCookHome(g, r);
    const out = ITEM_BY_ID.get(r.out[0].item)!;
    if (!g.unlocked(r.unlock)) {
      // not learned yet: show who might teach it
      ui.fill(rx, ry, colW, 22, C.tan, 0.2);
      ui.itemIcon(key(out.id), rx + 3, ry + 3, 16, 0, 0.25);
      const t = RECIPE_TEACHERS[out.id];
      ui.text('Unknown recipe', rx + 22, ry + 2, C.oak);
      ui.text(t ? `${shortName(NPC_BY_ID.get(t.npc)?.name ?? t.npc)} may teach it at Trust ${t.hearts}` : 'Not learned yet', rx + 22, ry + 12, C.walnut, { maxW: colW - 26 });
      return;
    }
    ui.fill(rx, ry, colW, 22, can ? C.cream : C.tan, can ? 0.6 : 0.35);
    ui.itemIcon(key(out.id), rx + 3, ry + 3, 16);
    if (ui.hover(rx, ry, 20, 22)) ui.tip(itemTooltip(g, key(out.id), r.out[0].n));
    ui.text(out.name + (r.out[0].n > 1 ? ' x' + r.out[0].n : ''), rx + 22, ry + 2, can ? C.ink : C.walnut, { maxW: colW - 70 });
    r.in.forEach((i, k) => {
      const ix = rx + 22 + k * 34, iy = ry + 11;
      const have = homeCount(g, i.item);
      ui.itemIcon(key(i.item[0] === '#' ? specIcon(i.item) : i.item), ix, iy, 9);
      ui.text(`${Math.min(have, 99)}/${i.n}`, ix + 10, iy + 2, have >= i.n ? C.moss : C.brick);
      if (ui.hover(ix, iy, 32, 10)) ui.tip([{ text: i.item[0] === '#' ? 'Any ' + i.item.slice(1) : ITEM_BY_ID.get(i.item)!.name, color: C.amber }, { text: `You have ${have}`, color: C.pebble }]);
    });
    if (ui.button('cook' + r.id, rx + colW - 44, ry + 3, 40, 16, 'Cook', { style: 'green', disabled: !can })) {
      const made = cookHome(g, r, ui.input.shift ? Math.min(5, maxCookHome(g, r)) : 1);
      if (made) play.toast(`Cooked ${made > 1 ? made + 'x ' : ''}${out.name}!`);
    }
  });
  if (!list.length) ui.para('Nothing you can cook right now. Bring home some ingredients!', x + 20, y + 50, W - 40, C.walnut);
  return true;
}

function drawAdopt(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const p = petSys(g);
  const W = 300, H = 170;
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, `A stray ${p.kind}`)) return false;
  if (st.data.name === undefined) { st.data.name = p.name; ui.focus = 'petname'; }
  // portrait: the pet sitting, scaled up
  ui.fill(x + 14, y + 16, 76, 76, C.tan, 0.6);
  const s = sprite(`pet:${p.kind}:${p.coat}:${Math.floor(ui.time * 1.5) % 6 === 0 ? 0 : 2}`);
  drawFit(ui.ctx, s, x + 19, y + 24, 66, 60);
  ui.para(`A ${PET_COATS[p.kind][p.coat].toLowerCase()} ${p.kind} sits by your door, looking at you hopefully. It seems to have decided this is its farm now.`, x + 100, y + 18, W - 112, C.ink);
  ui.text('Name:', x + 100, y + 82, C.walnut);
  st.data.name = ui.textField('petname', x + 132, y + 78, 120, st.data.name, 14);
  if (ui.button('adopt', x + 100, y + 110, 90, 20, 'Adopt ' + (st.data.name || ''), { style: 'green', disabled: !st.data.name?.trim() }) || (ui.input.keyPressed('Enter') && st.data.name?.trim())) {
    ui.focus = null;
    st.data.done = true;
    adoptPet(g, st.data.name);
    return false;
  }
  if (ui.button('notnow', x + 200, y + 110, 70, 20, 'Not now', { style: 'flat' })) {
    ui.focus = null;
    st.data.done = true;
    declinePet(g);
    return false;
  }
  ui.text('Fill its water bowl and give it a scratch every day.', x + 14, y + H - 22, C.oak);
  return true;
}

/** the hamster's cage, placed: a name and a coat (src/sim/systems/hamster.ts) */
function drawHamster(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const h = hamsterSys(g);
  if (h.named) return false;
  const W = 300, H = 178;
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, 'A hamster for the cage')) return false;
  if (st.data.name === undefined) {
    st.data.name = h.name;
    st.data.coat = h.coat;
    ui.focus = 'hamname';
  }
  const coat: number = st.data.coat;
  // portrait: sitting up with a seed, now and then a look about
  ui.fill(x + 14, y + 16, 76, 76, C.tan, 0.6);
  drawFit(ui.ctx, sprite(`pet:hamster:${coat}:${Math.floor(ui.time * 1.5) % 5 === 0 ? 0 : 2}`), x + 19, y + 22, 66, 64);
  ui.para('A little hamster blinks up at you from the shavings, cheeks full. It needs a name.', x + 100, y + 18, W - 112, C.ink);
  ui.text('Coat:', x + 100, y + 53, C.walnut);
  HAMSTER_COATS.forEach((c, i) => {
    const bx = x + 132 + i * 38;
    if (ui.button('hamcoat' + i, bx, y + 45, 34, 20, '', { active: coat === i, style: 'flat', tip: c })) {
      st.data.coat = i;
      if (DEFAULT_HAMSTER_NAMES.includes(st.data.name)) st.data.name = DEFAULT_HAMSTER_NAMES[i];
    }
    drawFit(ui.ctx, sprite(`pet:hamster:${i}:0`), bx + 9, y + 46, 16, 16);
  });
  ui.text(HAMSTER_COATS[coat], x + 132, y + 68, C.oak);
  ui.text('Name:', x + 100, y + 86, C.walnut);
  st.data.name = ui.textField('hamname', x + 132, y + 82, 120, st.data.name, 14);
  if (ui.button('hamok', x + 100, y + 112, 120, 20, 'Welcome ' + (st.data.name || ''), { style: 'green', disabled: !st.data.name?.trim() }) || (ui.input.keyPressed('Enter') && st.data.name?.trim())) {
    ui.focus = null;
    nameHamster(g, st.data.name, coat);
    return false;
  }
  ui.text('A seed a day for its supper, and a scratch.', x + 14, y + H - 30, C.oak);
  ui.text('It sleeps by day and runs its wheel at night.', x + 14, y + H - 20, C.oak);
  return true;
}

registerWindow('cooking', { draw: drawCooking });
registerWindow('hamster', { draw: drawHamster, onClose: (play) => (play.app.ui.focus = null) });
registerWindow('adopt', { draw: drawAdopt, onClose: (play, st) => { play.app.ui.focus = null; if (!st.data.done) declinePet(play.g); } });
