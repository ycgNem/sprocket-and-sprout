// Tracked orders: Track on an order in the Orders board puts a small checklist of it under the Now
// strip, one card an order: who wants it, then a box per line, ticked when that line is all in.
// Clicking a card opens the board on its tab; x stops tracking it. A filled order drops off.
import { C } from '../data/palette';
import type { PlayScreen } from '../app/play';
import { custName, dueText, lineLeft, orderTitle, specLabel, toggleTrack, trackedOrders, villagerName, type Order } from '../sim/systems/orders';
import { ellipsize, textWidth } from './font';
import type { UI } from './ui';

const MAX_W = 250;

/** the card's heading: whose order it is (a single item reads on its line already) */
function heading(o: Order): string {
  if (o.kind === 'today') return `${villagerName(o.cust)}'s ask`;
  if (o.kind === 'standing') return custName(o.cust);
  return orderTitle(o);
}

/** a 7x7 tick box, filled with a check when done */
function box(ui: UI, x: number, y: number, done: boolean) {
  ui.fill(x, y, 7, 7, done ? C.leaf : C.pebble);
  ui.fill(x + 1, y + 1, 5, 5, done ? C.moss : C.ink);
  if (done) {
    ui.fill(x + 1, y + 3, 1, 1, C.cream);
    ui.fill(x + 2, y + 4, 1, 1, C.cream);
    ui.fill(x + 3, y + 3, 1, 1, C.cream);
    ui.fill(x + 4, y + 2, 1, 1, C.cream);
    ui.fill(x + 5, y + 1, 1, 1, C.cream);
  }
}

/** Draw the tracked orders from y, stopping above maxY; returns the y below them. */
export function drawTrackedOrders(ui: UI, play: PlayScreen, y: number, maxY: number): number {
  const g = play.g;
  // the quest ribbon owns the top of the screen for a moment, as for the Now strip
  if (play.app.renderer.juice.banners.length) return y;
  const list = trackedOrders(g);
  let yy = y;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    const title = heading(o);
    const due = o.kind === 'works' ? '' : dueText(g, o);
    const rows = o.lines.map((l) => `${Math.min(l.have, l.n)}/${l.n} ${specLabel(l.spec)}`);
    const w = Math.min(MAX_W, Math.max(120, textWidth(title) + (due ? textWidth(due) + 10 : 0) + 22, ...rows.map((r) => textWidth(r) + 26)));
    const h = 15 + rows.length * 10;
    // no room left above the hotbar: say how many more there are
    if (yy + h > maxY) {
      const more = `+${list.length - i} more tracked (J, Orders)`;
      ui.panel(4, yy, textWidth(more) + 12, 13, 'dark', false);
      ui.text(more, 10, yy + 3, C.pebble);
      return yy + 16;
    }
    ui.panel(4, yy, w, h, 'dark', false);
    ui.fill(4, yy, w, 1, C.copper);
    const tw = w - 22 - (due ? textWidth(due) + 6 : 0);
    ui.text(ellipsize(title, tw), 9, yy + 4, C.amber);
    if (due) ui.text(due, 4 + w - 16, yy + 4, due === 'due today' || due === 'ends at midnight' ? C.blush : C.pebble, { align: 'right' });
    o.lines.forEach((l, li) => {
      const done = lineLeft(l) === 0;
      box(ui, 9, yy + 14 + li * 10, done);
      ui.text(ellipsize(rows[li], w - 26), 20, yy + 14 + li * 10, done ? C.lime : C.cream);
    });
    const xHit = ui.button('trx' + o.uid, 4 + w - 13, yy + 3, 9, 9, 'x', { style: 'flat', tip: 'Stop tracking it' });
    if (xHit) toggleTrack(g, o);
    else if (ui.hover(4, yy, w, h)) {
      ui.block(4, yy, w, h);
      if (ui.hoverId !== 'trx' + o.uid) ui.tip([{ text: o.kind === 'works' || o.kind === 'export' ? title : `${heading(o)}: ${orderTitle(o)}`, color: C.amber }, { text: 'Click to see it on the Orders board.' }]);
      if (ui.clicked) {
        ui.eat();
        play.openWindow('board', o.kind === 'today' ? 'today' : o.kind === 'works' ? 'works' : o.kind === 'export' ? 'exports' : 'standing');
      }
    }
    yy += h + 2;
  }
  return yy === y ? y : yy + 1;
}
