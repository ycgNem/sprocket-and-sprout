// The Orders board (ROADMAP.md 7.4, Phase 2's minimal board): standing orders from the town's
// businesses and today's asks, on the noticeboard in the square and in J -> Orders. Reading it is
// the Keeper's Line's B7 first step.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { key } from '../../sim/inventory';
import { acceptRequest, questSys } from '../../sim/systems/quests';
import { dueText, orderDef, orders } from '../../sim/systems/orders';
import { questName } from '../../data/cookbook';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ICON, ellipsize, wrapText } from '../font';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { portrait } from './town';

const ROW_S = 50, ROW_T = 40;

/** the board's two lists, drawn into a box (the board window and the journal's tab share it) */
export function drawOrders(ui: UI, play: PlayScreen, x: number, y: number, w: number, h: number) {
  const g = play.g;
  // the Keeper's Line's B7: the town's orders have been read
  g.flags.add('board:read');
  const q = questSys(g);
  const os = orders(g);
  const contentH = 14 + Math.max(1, os.open.length) * (ROW_S + 3) + 16 + Math.max(1, q.requests.length) * (ROW_T + 3);
  const off = ui.scrollOffset('orders_list', x, y, w, h, contentH);
  ui.clip(x, y, w, h);
  let yy = y + 3 - off;
  ui.text('Standing orders', x + 6, yy, C.ink);
  ui.text('Hand them over, or tag a crate (F at it): the post delivers', x + w - 6, yy, C.oak, { align: 'right' });
  yy += 12;
  if (!os.open.length) {
    ui.panel(x + 4, yy, w - 8, ROW_S, 'paper', false);
    ui.para('No standing orders yet. The businesses in town post them here as they get to know your works.', x + 12, yy + 10, w - 24, C.walnut, 9);
    yy += ROW_S + 3;
  }
  for (const o of os.open) {
    const def = orderDef(o);
    const d = NPC_BY_ID.get(def.npc);
    ui.panel(x + 4, yy, w - 8, ROW_S, 'paper', false);
    portrait(ui, def.npc, x + 8, yy + 5, 32, 0);
    const tx = x + 52, tw = w - 60;
    ui.text(`${questName(def.npc, d?.name ?? def.npc)}, ${def.place}`, tx, yy + 4, C.ink);
    ui.text(`${dueText(g, o)}  -  reputation ${os.rep[def.npc] ?? 0}`, x + w - 10, yy + 4, C.oak, { align: 'right' });
    const all = wrapText(`"${def.text}"`, tw - 4);
    all.slice(0, 2).forEach((l, i) => ui.text(i === 1 && all.length > 2 ? ellipsize(l + ' ' + all.slice(2).join(' '), tw - 4) : l, tx, yy + 14 + i * 9, C.walnut));
    ui.itemIcon(key(def.spec), tx, yy + 33, 14);
    const pay = def.unit ? `${ICON.coin}${def.unit} each${def.silver ? `, silver ${def.unit * 2}` : ''}` : def.reward?.text ?? '';
    ui.text(`${o.have}/${o.n} ${ITEM_BY_ID.get(def.spec)?.name ?? def.spec}   ${pay}`, tx + 18, yy + 37, o.have >= o.n ? C.moss : C.oak);
    if (ui.hover(x + 4, yy, w - 8, ROW_S)) {
      ui.tip([
        { text: `${def.place}: ${ITEM_BY_ID.get(def.spec)?.name}`, color: C.amber },
        { text: 'By hand: hold them and press F at ' + questName(def.npc, d?.name ?? def.npc) + '.' },
        { text: `By the post: F at your crate, "Ship to" ${def.place}. At noon, 6pm and overnight the post takes what fits this order there first.` },
        { text: 'Orders pay above the market and never flood it.', color: C.pebble },
      ], 230);
    }
    yy += ROW_S + 3;
  }
  yy += 4;
  ui.text('Today', x + 6, yy, C.ink);
  ui.text('Accept one at a time, bring it to them', x + w - 6, yy, C.oak, { align: 'right' });
  yy += 12;
  if (!q.requests.length) {
    ui.text('No requests today.', x + 10, yy + 4, C.oak);
    yy += 16;
  }
  q.requests.forEach((r, i) => {
    const d = NPC_BY_ID.get(r.npc)!;
    ui.panel(x + 4, yy, w - 8, ROW_T, 'paper', false);
    portrait(ui, r.npc, x + 8, yy + 4, 24, 0);
    const tx = x + 44;
    ui.text(d.name, tx, yy + 4, C.ink);
    ui.text(ellipsize(`"${r.text}"`, w - 130), tx, yy + 14, C.walnut);
    ui.itemIcon(key(r.item), tx, yy + 24, 12);
    ui.text(`${r.n} x ${ITEM_BY_ID.get(r.item)!.name}   ${ICON.coin}${r.reward} + friendship`, tx + 15, yy + 27, C.oak);
    if (r.done) ui.text('Done!', x + w - 12, yy + 5, C.moss, { align: 'right' });
    else if (q.current === i) ui.text('Accepted', x + w - 12, yy + 5, C.amber, { align: 'right' });
    else if (ui.button('acc' + i, x + w - 66, yy + 4, 56, 14, 'Accept', { style: 'green' })) {
      const err = acceptRequest(g, i);
      if (err) play.toast(err);
    }
    yy += ROW_T + 3;
  });
  ui.unclip();
}

function drawBoard(ui: UI, play: PlayScreen, st: WinState): boolean {
  const w = Math.min(ui.w - 20, 420), h = Math.min(ui.h - 30, 290);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Orders')) return false;
  // below the frame's close button
  ui.panel(x + 8, y + 18, w - 16, h - 26, 'inset', false);
  drawOrders(ui, play, x + 10, y + 20, w - 20, h - 30);
  void st;
  return true;
}

registerWindow('board', { draw: drawBoard });
