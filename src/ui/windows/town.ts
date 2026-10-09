// Town windows: NPC dialogue with portraits, heart-event cutscenes, shops.
import { shortName } from '../../data/cookbook';
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { SHOP_BY_ID, BUILDING_KITS, HOME_UPGRADES } from '../../data/shops';
import { buyHomeUpgrade, canBuyHomeUpgrade } from '../../sim/systems/house';
import { ANIMALS } from '../../data/creatures';
import { STRUCT_BY_ID } from '../../data/structures';
import { key, kDef } from '../../sim/inventory';
import { buy, buyKit, canAffordKit, crackGeode, dailyLeft, entryPrice, sellToShop, shopBuys, shopStock, startUpgrade, unitPrice, upgradeOptions } from '../../sim/systems/economy';
import { finishHeartEvent, hearts, npcSys } from '../../sim/systems/npcs';
import { sprite, drawFit } from '../../render/atlas';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { wrapText, ICON, ellipsize } from '../font';
import { centered, frame, invGrid, SLOT } from './common';
import { registerWindow, WinState } from './index';
import { itemTooltip } from '../tooltips';

function portrait(ui: UI, npcId: string, x: number, y: number, size = 48, mood = 0) {
  ui.panel(x, y, size + 8, size + 8, 'inset', false);
  if (size < 32) {
    // tiny: crop the walking sprite's head
    const ch = sprite(`ch:${npcId}:2:0`);
    ui.ctx.save();
    ui.ctx.beginPath();
    ui.ctx.rect(x + 4, y + 4, size, size);
    ui.ctx.clip();
    const k = Math.max(1, Math.floor(size / 16));
    ui.ctx.drawImage(ch.img, ch.x, ch.y, 16, 16, x + 4 + Math.floor((size - 16 * k) / 2), y + 6, 16 * k, 16 * k);
    ui.ctx.restore();
    return;
  }
  const elder = NPC_BY_ID.get(npcId)?.age === 'elder';
  // a gentle blink every few seconds
  const blink = mood !== 1 && Math.floor(ui.time * 10 + npcId.length * 7) % 47 === 0;
  const s = sprite(`portrait:${npcId}:${blink ? 1 : mood}:${elder ? 1 : 0}`);
  const sz = Math.floor(size / 32) * 32 || size;
  ui.ctx.drawImage(s.img, s.x, s.y, 32, 32, x + 4 + Math.floor((size - sz) / 2), y + 4 + Math.floor((size - sz) / 2), sz, sz);
}

function heartsRow(ui: UI, h: number, x: number, y: number) {
  for (let i = 0; i < 10; i++) ui.text(ICON.heart, x + i * 7, y, i < h ? C.rose : C.tan);
}

function drawDialog(ui: UI, play: PlayScreen, st: WinState): boolean {
  const a = st.arg as { npc: string; name: string; pages: string[]; shop?: string; hearts: number; mood?: number };
  st.data.page = st.data.page ?? 0;
  st.data.chars = (st.data.chars ?? 0) + 1.6;
  const text = a.pages[st.data.page] ?? '';
  const w = Math.min(440, ui.w - 20), h = 86;
  const x = Math.floor((ui.w - w) / 2), y = ui.h - h - 46;
  ui.panel(x, y, w, h);
  portrait(ui, a.npc, x + 8, y + 7, 64, a.mood ?? 0);
  ui.panel(x + 8, y - 12, Math.max(70, a.name.length * 6 + 12), 14, 'brass', false);
  ui.text(a.name, x + 14, y - 8, C.ink);
  heartsRow(ui, a.hearts, x + w - 82, y - 8);
  const shown = text.slice(0, Math.floor(st.data.chars));
  if (Math.floor(st.data.chars) % 3 === 0 && st.data.chars < text.length) ui.sfx('talk');
  wrapText(shown, w - 104).forEach((l, i) => ui.text(l, x + 86, y + 12 + i * 11, C.ink));
  const done = st.data.chars >= text.length;
  if (done && Math.floor(ui.time * 2) % 2) ui.text(ICON.down, x + w - 14, y + h - 14, C.walnut);
  const adv = ui.clicked || ui.input.keyPressed('Space') || ui.input.keyPressed('Enter') || ui.input.wasPressed('interact');
  ui.block(0, 0, ui.w, ui.h);
  if (adv) {
    ui.eat();
    ui.input.consume('interact');
    if (!done) st.data.chars = text.length;
    else if (st.data.page < a.pages.length - 1) {
      st.data.page++;
      st.data.chars = 0;
    } else {
      play.g.sys.dialogue = null;
      if (a.shop) {
        play.win = null;
        play.openWindow('shop', a.shop);
        return true;
      }
      return false;
    }
  }
  if (ui.input.wasPressed('pause')) {
    ui.input.consume('pause');
    play.g.sys.dialogue = null;
    return false;
  }
  return true;
}

function drawEvent(ui: UI, play: PlayScreen, st: WinState): boolean {
  const a = st.arg as { npc: string; title: string; lines: { who: string; text: string; npcId: string | null }[]; choice: { prompt: string; options: { text: string; reply: string; friendship: number }[] } | null };
  st.data.i = st.data.i ?? 0;
  st.data.chars = (st.data.chars ?? 0) + 1.5;
  // letterbox
  ui.fill(0, 0, ui.w, 22, C.ink);
  ui.fill(0, ui.h - 22, ui.w, 22, C.ink);
  ui.text(a.title, ui.w / 2, 7, C.amber, { align: 'center' });
  ui.block(0, 0, ui.w, ui.h);
  const g = play.g;
  let line: { who: string; text: string; npcId: string | null } | undefined;
  let choosing = false;
  if (st.data.reply) line = { who: NPC_BY_ID.get(a.npc)!.name, text: st.data.reply, npcId: a.npc };
  else if (st.data.i < a.lines.length) line = a.lines[st.data.i];
  else if (a.choice) choosing = true;
  const w = Math.min(440, ui.w - 20), h = 86;
  const x = Math.floor((ui.w - w) / 2), y = ui.h - h - 30;
  if (choosing && a.choice) {
    ui.panel(x, y - 20, w, h + 20);
    ui.text(a.choice.prompt, x + 12, y - 10, C.ink);
    a.choice.options.forEach((o, i) => {
      if (ui.button('ch' + i, x + 12, y + 6 + i * 20, w - 24, 17, o.text, { style: 'flat' })) {
        st.data.reply = o.reply;
        st.data.friend = o.friendship;
        st.data.chars = 0;
      }
    });
    return true;
  }
  if (!line) {
    finishHeartEvent(g, a.npc, st.data.friend ?? 0);
    return false;
  }
  ui.panel(x, y, w, h);
  const emo = /!|haha|laugh|smile|grin/i.test(line.text) ? 1 : /sorry|sigh|sad|miss|alone|.../i.test(line.text) ? 2 : 0;
  if (line.npcId) portrait(ui, line.npcId, x + 8, y + 7, 64, emo);
  else if (line.who === g.player.name) portrait(ui, 'player', x + 8, y + 7, 64, emo);
  if (line.who) {
    ui.panel(x + 8, y - 12, Math.max(70, line.who.length * 6 + 12), 14, 'brass', false);
    ui.text(line.who, x + 14, y - 8, C.ink);
  }
  const shown = line.text.slice(0, Math.floor(st.data.chars));
  wrapText(shown, w - 104).forEach((l, i) => ui.text(l, x + 86, y + 12 + i * 11, line!.who ? C.ink : C.walnut));
  const adv = ui.clicked || ui.input.keyPressed('Space') || ui.input.keyPressed('Enter') || ui.input.wasPressed('interact');
  if (adv) {
    ui.eat();
    ui.input.consume('interact');
    if (st.data.chars < line.text.length) st.data.chars = line.text.length;
    else if (st.data.reply) {
      st.data.reply = null;
      st.data.i = a.lines.length + 1;
      a.choice = null;
    } else {
      st.data.i++;
      st.data.chars = 0;
    }
  }
  return true;
}

// ---------------- shops ----------------
function drawShop(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const shop = SHOP_BY_ID.get(st.arg)!;
  const w = 380, h = 280;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, shop.name)) return false;
  const owner = NPC_BY_ID.get(shop.owner) ?? { name: 'Mags' };
  const tabs: string[] = ['Buy'];
  if (shop.buys?.length) tabs.push('Sell');
  if (shop.id === 'smithy') tabs.push('Upgrades', 'Geodes');
  if (shop.id === 'carpenter') tabs.push('Buildings', 'Home');
  if (shop.id === 'ranch') tabs.push('Animals');
  st.data.tab = st.data.tab ?? 'Buy';
  tabs.forEach((t, i) => { if (ui.button('stab' + t, x + 10 + i * 62, y + 10, 58, 14, t, { active: st.data.tab === t })) st.data.tab = t; });
  ui.text(`${ICON.coin} ${g.player.money.toLocaleString()}`, x + w - 26, y + 14, C.walnut, { align: 'right' });
  portrait(ui, shop.owner, x + w - 58, y + 30, 32, 1);
  ui.text(shortName(owner.name), x + w - 38, y + 74, C.walnut, { align: 'center' });
  const listX = x + 10, listY = y + 30, listW = w - 86, listH = 150;
  if (st.data.tab === 'Buy') {
    if (shop.id === 'cart' && !g.sys.cart?.stock?.length) ui.text('Sold out! Mags restocks every Monday.', listX, listY + 4, C.walnut);
    ui.para(shop.greeting, listX, y + h - 96, listW, C.walnut);
    const stock = shopStock(g, shop.id);
    const rowH = 18;
    const off = ui.scrollOffset('shop_' + shop.id, listX, listY, listW, listH, stock.length * rowH);
    ui.clip(listX, listY, listW, listH);
    stock.forEach((e, i) => {
      const ry = listY + i * rowH - off;
      if (ry < listY - rowH || ry > listY + listH) return;
      const d = ITEM_BY_ID.get(e.item)!;
      const price = entryPrice(g, e);
      const left = dailyLeft(g, e);
      const hov = ui.hover(listX, ry, listW - 6, rowH - 1);
      ui.fill(listX, ry, listW - 6, rowH - 1, hov ? C.butter : i % 2 ? C.tan : C.oak, hov ? 1 : 0.35);
      ui.itemIcon(key(e.item), listX + 2, ry + 1, 16);
      ui.text(d.name + (left !== Infinity ? `  (${left} left today)` : ''), listX + 22, ry + 5, left <= 0 ? C.stone : C.ink);
      ui.text(`${ICON.coin}${price}`, listX + listW - 12, ry + 5, g.player.money >= price ? C.moss : C.brick, { align: 'right' });
      if (hov) {
        ui.tip(itemTooltip(g, key(e.item), 1, [{ text: 'Click to buy one, shift-click for five, right-click for ten.', color: C.pebble }]));
        if (ui.clicked) {
          ui.eat();
          buy(g, e, ui.input.shift ? 5 : 1);
        }
        if (ui.rclicked) {
          ui.eatR();
          buy(g, e, 10);
        }
      }
    });
    ui.unclip();
  } else if (st.data.tab === 'Sell') {
    ui.text(`${shortName(owner.name)} buys: ${shop.buys!.join(', ')}. Click an item to sell the stack.`, listX, listY, C.walnut);
    ui.text('(Shipping it overnight pays about 10% more.)', listX, listY + 10, C.oak);
  } else if (st.data.tab === 'Upgrades') {
    const opts = upgradeOptions(g);
    if (g.player.upgrading) ui.para(`Bram is working on your ${ITEM_BY_ID.get(g.player.upgrading.to)!.name}. Come back in ${g.player.upgrading.days} day(s).`, listX, listY, listW, C.ink);
    else if (!opts.length) ui.text('Bring me a tool to upgrade (it must be in your bag).', listX, listY, C.ink);
    opts.forEach((o, i) => {
      const ry = listY + 20 + i * 22;
      ui.itemIcon(key(o.from), listX, ry, 16);
      ui.text(ICON.right, listX + 20, ry + 5, C.walnut);
      ui.itemIcon(key(o.to), listX + 30, ry, 16);
      ui.text(`${ITEM_BY_ID.get(o.to)!.name}: ${ICON.coin}${o.coins} + ${o.bars} ${ITEM_BY_ID.get(o.bar)!.name}`, listX + 50, ry + 5, C.ink);
      if (ui.button('up' + i, listX + listW - 50, ry, 44, 16, 'Order', { disabled: !!g.player.upgrading, style: 'green' })) {
        const err = startUpgrade(g, o);
        play.toast(err ?? `Bram takes your tool. "Two days. Don't rush art."`);
      }
    });
  } else if (st.data.tab === 'Geodes') {
    ui.text(`Geodes in bag: ${g.player.inv.countId('geode')}. Cracking costs ${ICON.coin}25.`, listX, listY, C.ink);
    if (ui.button('crack', listX, listY + 16, 90, 18, 'Crack one!', { style: 'green', disabled: g.player.inv.countId('geode') < 1 })) {
      const msg = crackGeode(g);
      if (msg) st.data.geode = msg;
    }
    if (st.data.geode) ui.text(st.data.geode, listX, listY + 42, C.moss);
  } else if (st.data.tab === 'Buildings') {
    BUILDING_KITS.forEach((k, i) => {
      const ry = listY + i * 19;
      const def = STRUCT_BY_ID.get(k.id)!;
      const ok = canAffordKit(g, k.id);
      ui.itemIcon(key(k.id), listX, ry, 16);
      ui.text(def.name + (k.upgradeOf ? ' (upgrade)' : ''), listX + 20, ry + 1, C.ink);
      // the cost stops short of the Buy button; the tooltip has it in full
      const cost = `${ICON.coin}${k.price} + ` + k.materials.map((m) => `${m.n} ${ITEM_BY_ID.get(m.item)!.name}`).join(', ');
      ui.text(ellipsize(cost, listW - 46 - 20 - 4), listX + 20, ry + 10, ok ? C.walnut : C.brick);
      if (ui.hover(listX, ry, listW - 60, 18)) ui.tip([{ text: def.name, color: C.amber }, { text: def.desc }, { text: cost, color: ok ? C.butter : C.rose }]);
      if (ui.button('kit' + i, listX + listW - 46, ry + 1, 40, 15, 'Buy', { disabled: !ok, style: 'green' })) {
        const err = buyKit(g, k.id);
        if (err) play.toast(err);
      }
    });
  } else if (st.data.tab === 'Home') {
    ui.text('Farmhouse renovations. Juniper fits them the same day.', listX, listY, C.walnut);
    HOME_UPGRADES.forEach((u, i) => {
      const ry = listY + 14 + i * 30;
      const built = g.flags.has(u.id);
      const err = built ? null : canBuyHomeUpgrade(g, u.id);
      ui.text(u.name + (built ? '  (built)' : ''), listX, ry, built ? C.moss : C.ink);
      ui.text(`${ICON.coin}${u.price} + ` + u.materials.map((m) => `${m.n} ${ITEM_BY_ID.get(m.item)!.name}`).join(', '), listX, ry + 9, err ? C.brick : C.walnut);
      ui.text(u.desc, listX, ry + 18, C.oak, { maxW: listW - 60 });
      if (ui.hover(listX, ry, listW - 60, 28)) ui.tip([{ text: u.name, color: C.amber }, { text: u.desc }, ...(err ? [{ text: err, color: C.rose }] : [])]);
      if (!built && ui.button('home' + i, listX + listW - 46, ry + 4, 40, 15, 'Build', { disabled: !!err, style: 'green' })) {
        const e2 = buyHomeUpgrade(g, u.id);
        if (e2) play.toast(e2);
      }
    });
  } else if (st.data.tab === 'Animals') {
    ANIMALS.forEach((a, i) => {
      const ry = listY + i * 19;
      const s = sprite(`an:${a.id}:0:0`);
      drawFit(ui.ctx, s, listX, ry, 18, 16);
      ui.text(`${a.name}  (${a.building === 'coop' ? 'Coop' : 'Barn'} tier ${a.tier}+)`, listX + 22, ry + 1, C.ink);
      ui.text(`${ICON.coin}${a.price}  -  makes ${ITEM_BY_ID.get(a.product)!.name}`, listX + 22, ry + 10, C.walnut);
      if (ui.button('anim' + i, listX + listW - 46, ry + 1, 40, 15, 'Buy', { style: 'green', disabled: g.player.money < a.price })) {
        const err = g.sys.animals?.buy?.(g, a.id);
        play.toast(err ?? `A new ${a.name.toLowerCase()} is waiting at your ${a.building}!`);
      }
    });
  }
  // player inventory (click to sell in Sell tab)
  const py = y + h - 76;
  ui.text(st.data.tab === 'Sell' ? 'Your bag: click a stack to sell it' : 'Your bag', x + 10, py - 1, C.walnut);
  const inv = g.player.inv;
  for (let i = 0; i < 36; i++) {
    const sx = x + 10 + (i % 18) * 20, sy = py + 9 + Math.floor(i / 18) * 20;
    const s = inv.slots[i];
    const sellable = s && st.data.tab === 'Sell' && shopBuys(shop.id, s.k);
    const r = ui.slot(sx, sy, s, { size: 19, dim: st.data.tab === 'Sell' && !!s && !sellable });
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n, sellable ? [{ text: `Sell here: ${ICON.coin}${Math.round(unitPrice(g, s.k) * 0.9)} each`, color: C.lime }] : []));
    if (r.click && sellable && s) {
      const n = ui.input.shift ? s.n : s.n;
      const coins = sellToShop(g, s.k, n);
      inv.remove(s.k, n);
      play.toast(`Sold for ${ICON.coin}${coins}.`);
    }
  }
  void invGrid;
  void SLOT;
  void kDef;
  return true;
}

registerWindow('dialog', { draw: drawDialog, onClose: (play) => (play.g.sys.dialogue = null) });
registerWindow('event', { draw: drawEvent, onClose: (play, st) => { if (play.g.sys.cutscene) finishHeartEvent(play.g, st.arg.npc, st.data.friend ?? 0); } });
registerWindow('shop', { draw: drawShop });

export { hearts, npcSys, heartsRow, portrait };
