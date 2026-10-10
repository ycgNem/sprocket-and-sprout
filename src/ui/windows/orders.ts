// The Orders board (ROADMAP.md 7.4, Phase 3): one board, three tabs. Today's asks, the businesses'
// standing orders (and the Trading Guild's contracts), and the town works (projects and keystones).
// It stands on the town square (F at it), opens from J -> Orders, and the clocktower's door opens
// its Works tab. Reading it is the Keeper's Line's B7 first step.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { PROJECTS, PROJECT_BY_ID } from '../../data/goals';
import { BUSINESS_BY_ID, KEYSTONE_WORKS, KEYSTONE_WORKS_BY_ID, REP_RANKS, STANDING_BY_ID } from '../../data/orders';
import { ERA_NAMES } from '../../data/research';
import { GUILD_BONUS_PER_RANK } from '../../data/contracts';
import { key } from '../../sim/inventory';
import {
  bagHelps, boardHandIn, custName, custNpc, daysLeftInWeek, dueText, fits, guildRank, keystoneWait, lineLeft, orderFull, orderTitle, orders, payWorks, rank, repOf,
  specLabel, villagerName, type Order,
} from '../../sim/systems/orders';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ICON, ellipsize, textWidth, wrapText } from '../font';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { portrait } from './town';
import { specIcon } from './menu';

type Tab = 'today' | 'standing' | 'works';
const TABS: [Tab, string][] = [['today', 'Today'], ['standing', 'Standing'], ['works', 'Works']];

/** an order's lines: icon, have/n, name (as many as fit on a row) */
function drawLines(ui: UI, o: Order, x: number, y: number, w: number) {
  let lx = x;
  const each = o.lines.length === 1 ? w - 16 : o.lines.length === 2 ? Math.floor(w / 2) - 16 : 64;
  for (const l of o.lines) {
    const label = `${Math.min(l.have, l.n)}/${l.n} ${o.lines.length > 2 ? '' : specLabel(l.spec)}`.trim();
    const lw = 16 + Math.min(each, textWidth(label) + 8);
    if (lx + lw > x + w) break;
    ui.itemIcon(key(l.spec[0] === '#' ? specIcon(l.spec) : l.spec), lx, y - 3, 12);
    ui.text(ellipsize(label, lw - 16), lx + 14, y, l.have >= l.n ? C.moss : C.oak);
    lx += lw;
  }
}

/** the reputation strip of a customer: its rank, and how far to the next */
function repStrip(ui: UI, g: PlayScreen['g'], cust: string, x: number, y: number, w: number) {
  const rep = repOf(g, cust);
  const r = rank(g, cust);
  const next = REP_RANKS[r + 1];
  const label = next ? `${REP_RANKS[r].name}  ${rep}/${next.rep}` : REP_RANKS[r].name;
  ui.text(label, x + w, y, C.ink, { align: 'right' });
  if (next) ui.bar(x + w - textWidth(label) - 48, y + 2, 40, 3, (rep - REP_RANKS[r].rep) / (next.rep - REP_RANKS[r].rep), C.moss);
}

function drawToday(ui: UI, play: PlayScreen, x: number, y: number, w: number): number {
  const g = play.g;
  const list = orders(g).open.filter((o) => o.kind === 'today');
  let yy = y;
  ui.text("Today's asks", x + 6, yy, C.ink);
  ui.text('Bring them by hand (F at them), or tag a crate for them: they end at midnight', x + w - 6, yy, C.oak, { align: 'right' });
  yy += 12;
  if (!list.length) {
    ui.panel(x + 4, yy, w - 8, 34, 'paper', false);
    const before = g.flags.has('keepers_line') && !g.sys.quests?.done?.includes('k9_bed');
    ui.para(before ? "The town's daily asks start once your works feed themselves (after \"A Second Bed\")." : 'No asks today. Check back tomorrow morning.', x + 12, yy + 8, w - 24, C.walnut, 9);
    return yy + 38 - y;
  }
  for (const o of list) {
    const npc = o.cust;
    ui.panel(x + 4, yy, w - 8, 40, 'paper', false);
    portrait(ui, npc, x + 8, yy + 4, 24, 0);
    const tx = x + 40;
    const biz = BUSINESS_BY_ID.get(npc);
    ui.text(villagerName(npc) + (biz ? `, ${biz.name}` : ''), tx, yy + 4, C.ink);
    ui.text(ellipsize(`"${o.text ?? ''}"`, w - 120), tx, yy + 14, C.walnut);
    drawLines(ui, o, tx, yy + 27, w - 170);
    ui.text(`${ICON.coin}${o.pay} + friendship${o.rep ? ', reputation' : ''}`, x + w - 12, yy + 27, C.oak, { align: 'right' });
    ui.text(o.done ? 'Done!' : dueText(g, o), x + w - 12, yy + 4, o.done ? C.moss : C.oak, { align: 'right' });
    if (ui.hover(x + 4, yy, w - 8, 40)) {
      ui.tip([
        { text: `${villagerName(npc)}: ${orderTitle(o)}`, color: C.amber },
        { text: `By hand: hold them and press F at ${villagerName(npc)}.` },
        { text: `By the post: tag a crate "Ship to: ${custName(npc)}" (F at the crate). At noon, 6pm and overnight the post takes what fits.` },
      ], 230);
    }
    yy += 43;
  }
  return yy - y;
}

/** 0: the bag can finish a line of it now, 1: the bag can help, 2: nothing in the bag for it */
function readiness(g: PlayScreen['g'], o: Order): number {
  if (o.done) return 3;
  const inv = g.player.inv;
  const have = (l: Order['lines'][number]) => inv.slots.reduce((a, s) => a + (s && fits({ ...o, lines: [l] }, s.k) ? s.n : 0), 0);
  if (o.lines.some((l) => lineLeft(l) > 0 && have(l) >= lineLeft(l))) return 0;
  return bagHelps(g, o) ? 1 : 2;
}

function drawStanding(ui: UI, play: PlayScreen, x: number, y: number, w: number): number {
  const g = play.g;
  const os = orders(g);
  let yy = y;
  ui.text('Standing orders', x + 6, yy, C.ink);
  ui.text('Hand them over, or tag a crate (F at it): the post delivers', x + w - 6, yy, C.oak, { align: 'right' });
  yy += 12;
  // the businesses whose orders the bag can fill first, and their fillable orders first
  const standing = os.open.filter((o) => o.kind === 'standing').sort((a, b) => readiness(g, a) - readiness(g, b));
  const custs = [...new Set(standing.map((o) => o.cust))];
  if (!custs.length && !os.guild.unlocked) {
    ui.panel(x + 4, yy, w - 8, 34, 'paper', false);
    ui.para('No standing orders yet. The businesses in town post them here as they get to know your works.', x + 12, yy + 8, w - 24, C.walnut, 9);
    yy += 38;
  }
  for (const cust of custs) {
    // the business: its name and its rank
    ui.fill(x + 4, yy, w - 8, 13, C.tan);
    ui.fill(x + 4, yy + 12, w - 8, 1, C.oak);
    ui.text(custName(cust), x + 9, yy + 3, C.ink);
    repStrip(ui, g, cust, x + 4, yy + 3, w - 14);
    yy += 16;
    for (const o of standing.filter((x) => x.cust === cust)) {
      const def = STANDING_BY_ID.get(o.def)!;
      const npc = custNpc(cust);
      // the customer's portrait at full size (a 16 px head floated in its frame), the quote on three lines
      ui.panel(x + 4, yy, w - 8, 52, 'paper', false);
      if (npc) portrait(ui, npc, x + 8, yy + 4, 32, 0);
      const tx = x + 54, tw = w - 62;
      const all = wrapText(`"${def.text}"`, tw - 70);
      all.slice(0, 3).forEach((l, i) => ui.text(i === 2 && all.length > 3 ? ellipsize(l + ' ' + all.slice(3).join(' '), tw - 70) : l, tx, yy + 4 + i * 9, C.walnut));
      ui.text(dueText(g, o), x + w - 10, yy + 4, C.oak, { align: 'right' });
      drawLines(ui, o, tx, yy + 39, tw - 120);
      const pay = def.unit ? `${ICON.coin}${def.unit} each${def.silver ? `, silver ${def.unit * 2}` : ''}` : def.reward?.text ?? '';
      ui.text(ellipsize(pay, 140), x + w - 10, yy + 39, orderFull(o) ? C.moss : C.oak, { align: 'right' });
      if (ui.hover(x + 4, yy, w - 8, 52)) {
        ui.tip([
          { text: `${custName(cust)}: ${ITEM_BY_ID.get(def.spec)?.name ?? specLabel(def.spec)}`, color: C.amber },
          { text: 'By hand: hold them and press F at ' + (npc ? villagerName(npc) : custName(cust)) + '.' },
          { text: `By the post: F at your crate, "Ship to" ${custName(cust)}. At noon, 6pm and overnight the post takes what fits this order there first.` },
          { text: `Reputation +${o.rep} when it's filled: ${REP_RANKS[Math.min(5, rank(g, cust) + 1)].name} opens their next order and new stock.`, color: C.pebble },
        ], 240);
      }
      yy += 55;
    }
  }
  // the Trading Guild's contracts
  if (os.guild.unlocked) {
    const r = guildRank(g);
    ui.fill(x + 4, yy, w - 8, 13, C.tan);
    ui.fill(x + 4, yy + 12, w - 8, 1, C.oak);
    ui.text(`${custName('guild')}  (+${Math.round(r * GUILD_BONUS_PER_RANK * 100)}% on all shipping)`, x + 9, yy + 3, C.ink);
    repStrip(ui, g, 'guild', x + 4, yy + 3, w - 14);
    yy += 16;
    ui.text(`New contracts every Monday: ${daysLeftInWeek(g) === 1 ? 'last day this week!' : daysLeftInWeek(g) + ' days left.'} The Freight Depot, a crate tagged for the Guild, or Hand in here.`, x + 8, yy + 1, daysLeftInWeek(g) === 1 ? C.brick : C.oak);
    yy += 11;
    for (const o of os.open.filter((x) => x.kind === 'guild')) {
      ui.panel(x + 4, yy, w - 8, 30, 'paper', false);
      ui.itemIcon(key(o.lines[0].spec[0] === '#' ? 'freight_depot' : o.lines[0].spec), x + 8, yy + 7, 16);
      ui.text(orderTitle(o), x + 28, yy + 4, C.ink);
      drawLines(ui, o, x + 28, yy + 17, w - 200);
      ui.text(`${ICON.coin}${o.pay}`, x + w - 74, yy + 17, C.oak, { align: 'right' });
      if (o.done) ui.text('Done!', x + w - 12, yy + 10, C.moss, { align: 'right' });
      else if (ui.button('gh' + o.uid, x + w - 64, yy + 8, 54, 14, 'Hand in', { style: 'green', disabled: !bagHelps(g, o), tip: 'Takes what your bag has toward it' })) boardHandIn(g, o);
      yy += 33;
    }
  }
  return yy - y;
}

function worksRow(ui: UI, play: PlayScreen, o: Order, x: number, y: number, w: number): number {
  const g = play.g;
  const ks = KEYSTONE_WORKS_BY_ID.get(o.def);
  const p = PROJECT_BY_ID.get(o.def);
  const keystone = !!ks || o.def === 'p_clock';
  const wait = keystoneWait(g, o.def);
  const h = keystone ? (wait ? 64 : 54) : 42;
  ui.panel(x + 4, y, w - 8, h, 'paper', false);
  if (keystone) {
    ui.fill(x + 4, y, 3, h, C.copper);
    ui.text(`${orderTitle(o)}`, x + 12, y + 4, C.ink);
    ui.text(`${ERA_NAMES[ks?.era ?? 5]} keystone`, x + w - 12, y + 4, C.copper, { align: 'right' });
    ui.para(ks?.desc ?? p?.desc ?? '', x + 12, y + 14, w - 90, C.walnut, 9);
    // its goods can go in now; the works start once its research (or its chamber) is done
    if (wait) ui.text(ellipsize(`Its goods can go in now. The works start once ${wait}.`, w - 90), x + 12, y + h - 24, C.oak);
  } else {
    ui.text(orderTitle(o), x + 12, y + 4, C.ink);
    ui.text(ellipsize(p?.desc ?? '', w - 160), x + 12, y + 14, C.walnut);
    ui.text(ellipsize(p?.reward.text ?? '', 130), x + w - 12, y + 4, C.oak, { align: 'right' });
  }
  const money = p?.money ?? 0;
  drawLines(ui, o, x + 12, y + h - 12, w - 90 - (money ? 70 : 0));
  if (money) ui.text(`+ ${ICON.coin}${money}`, x + w - 74, y + h - 12, g.player.money >= money ? C.oak : C.brick, { align: 'right' });
  if (orderFull(o) && money) {
    if (ui.button('wp' + o.uid, x + w - 64, y + h - 18, 54, 14, `Pay ${money}`, { style: 'green', disabled: g.player.money < money })) payWorks(g, o);
  } else if (ui.button('wh' + o.uid, x + w - 64, y + h - 18, 54, 14, 'Hand in', { style: 'green', disabled: !bagHelps(g, o), tip: 'Takes what your bag has toward it' })) boardHandIn(g, o);
  return h + 3;
}

function drawWorks(ui: UI, play: PlayScreen, x: number, y: number, w: number): number {
  const g = play.g;
  const os = orders(g);
  let yy = y;
  ui.text('The town works', x + 6, yy, C.ink);
  ui.text('Hand in here, or tag a crate for the Council', x + w - 6, yy, C.oak, { align: 'right' });
  yy += 12;
  const works = os.open.filter((o) => o.kind === 'works');
  // the keystones first: what the town is waiting on next
  const era = (o: Order) => KEYSTONE_WORKS_BY_ID.get(o.def)?.era ?? 5;
  const keys = works.filter((o) => KEYSTONE_WORKS_BY_ID.has(o.def) || o.def === 'p_clock').sort((a, b) => era(a) - era(b));
  for (const o of keys) yy += worksRow(ui, play, o, x, yy, w);
  const doneKeys = KEYSTONE_WORKS.filter((k) => os.worksDone.includes(k.id));
  if (doneKeys.length) {
    ui.text(`Done: ${doneKeys.map((k) => k.name).join(', ')}`, x + 8, yy + 2, C.moss);
    yy += 12;
  }
  // the other works, by area, as their eras come (an area shows once it has one up or done)
  for (const area of [...new Set(PROJECTS.map((p) => p.area))]) {
    const list = works.filter((o) => PROJECT_BY_ID.get(o.def)?.area === area && o.def !== 'p_clock');
    const done = PROJECTS.filter((p) => p.area === area && p.id !== 'p_clock' && os.worksDone.includes(p.id)).length;
    if (!list.length && !done) continue;
    ui.text(`${area}${done ? `  (${done} done)` : ''}`, x + 8, yy + 2, C.walnut);
    yy += 12;
    for (const o of list) yy += worksRow(ui, play, o, x, yy, w);
  }
  const later = PROJECTS.filter((p) => !os.worksDone.includes(p.id) && !works.some((o) => o.def === p.id)).length;
  if (later) {
    ui.text(`${later} more works open as the town's keystones are built.`, x + 8, yy + 2, C.pebble);
    yy += 12;
  }
  return yy - y;
}

/** the board's tabs and list, drawn into a box (the board window and the journal's tab share it) */
export function drawOrders(ui: UI, play: PlayScreen, x: number, y: number, w: number, h: number, st?: WinState) {
  const g = play.g;
  // the Keeper's Line's B7: the town's orders have been read
  g.flags.add('board:read');
  const data = st?.data ?? (play as any)._ordersTab ?? ((play as any)._ordersTab = {});
  data.otab = data.otab ?? (st?.arg === 'works' || st?.arg === 'today' || st?.arg === 'standing' ? st.arg : 'standing');
  const os = orders(g);
  const counts: Record<Tab, number> = {
    today: os.open.filter((o) => o.kind === 'today' && !o.done).length,
    standing: os.open.filter((o) => (o.kind === 'standing' || o.kind === 'guild') && !o.done).length,
    works: os.open.filter((o) => o.kind === 'works').length,
  };
  const tw = Math.floor((w - 8) / 3);
  TABS.forEach(([id, label], i) => {
    if (ui.button('otab' + id, x + 4 + i * tw, y + 2, tw - 4, 14, `${label} (${counts[id]})`, { active: data.otab === id })) data.otab = id;
  });
  const ly = y + 20, lh = h - 20;
  const est = data.otab === 'today' ? 14 + Math.max(1, counts.today) * 43 + 40
    : data.otab === 'standing' ? 14 + os.open.filter((o) => o.kind !== 'today' && o.kind !== 'works').length * 47 + 16 * 12 + 60
    : 14 + counts.works * 57 + 6 * 12 + 30;
  const off = ui.scrollOffset('orders_' + data.otab, x, ly, w, lh, data.contentH ?? est);
  ui.clip(x, ly, w, lh);
  const used = data.otab === 'today' ? drawToday(ui, play, x, ly + 3 - off, w - 4)
    : data.otab === 'standing' ? drawStanding(ui, play, x, ly + 3 - off, w - 4)
    : drawWorks(ui, play, x, ly + 3 - off, w - 4);
  data.contentH = used + 8;
  ui.unclip();
}

function drawBoard(ui: UI, play: PlayScreen, st: WinState): boolean {
  const w = Math.min(ui.w - 20, 460), h = Math.min(ui.h - 30, 310);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Orders')) return false;
  // below the frame's close button
  ui.panel(x + 8, y + 18, w - 16, h - 26, 'inset', false);
  drawOrders(ui, play, x + 10, y + 20, w - 20, h - 30, st);
  return true;
}

registerWindow('board', { draw: drawBoard });
// the clocktower's old restoration board is the Works tab now
registerWindow('restoration', { draw: (ui, play, st) => { st.arg = st.arg ?? 'works'; return drawBoard(ui, play, st); } });
