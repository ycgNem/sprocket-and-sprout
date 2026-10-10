// The auction window (ROADMAP.md 7.7 and 7.9, Phase 5): the Harvest Haul's lot, called by the Mayor
// with Roxy and Bram bidding, and Mags' Sunday lot at the cart, with Roxy and the Professor. You
// bid in steps; they answer; "Going once... going twice... Sold!". The rules: src/sim/auction.ts.
// Also the Haul's festival panel (F at the Mayor on fall 16): the lot, the double pay, the stall.
import { C } from '../../data/palette';
import { FESTIVALS } from '../../data/goals';
import { ITEM_BY_ID } from '../../data/items';
import type { FestivalDef } from '../../data/types';
import { auctionAt, canBid, closeLot, lotSold, nextBid, playerBid, tickAuction, venue, type Auction, type VenueId } from '../../sim/auction';
import { key } from '../../sim/inventory';
import { festivalName, finishActivity } from '../../sim/systems/festivals';
import { villagerName } from '../../sim/systems/orders';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ICON, ellipsize } from '../font';
import { centered, frame } from './common';
import { registerWindow, type WinState } from './index';
import { drawTokenStall } from './stall';
import { portrait } from './town';

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
const name = (id: string | null) => (id === 'you' ? 'you' : id === 'peddler' ? 'Mags' : id ? villagerName(id) : 'nobody');
const Name = (id: string | null) => {
  const s = name(id);
  return s[0].toUpperCase() + s.slice(1);
};

/** the lot's goods: icons with their counts */
function lotIcons(ui: UI, a: Auction | { lot: Auction['lot'] }, x: number, y: number) {
  a.lot.items.forEach((s, i) => ui.slot(x + i * 24, y, { k: key(s.item), n: s.n }));
}

/** what the caller says now */
function callLine(a: Auction): string {
  const lot = a.lot;
  const mags = a.caller === 'peddler';
  if (a.call === 'sold') return a.high ? `Sold! To ${name(a.high)} for ${n0(a.bid)} coins.` : 'No sale today.';
  if (a.call === 'once') return `${n0(a.bid)} from ${name(a.high)}. Going once...`;
  if (a.call === 'twice') return `${n0(a.bid)} from ${name(a.high)}. Going twice...`;
  if (a.high === null) {
    return mags ? `This week's lot from the far roads: ${lot.name}, worth about ${n0(lot.worth)}. Do I hear ${n0(a.bid)}?`
      : `This year's lot: ${lot.name}, worth a good ${n0(lot.worth)} coins! Who will open at ${n0(a.bid)}?`;
  }
  return `${n0(a.bid)} from ${name(a.high)}! Do I hear ${n0(nextBid(a))}?`;
}

function drawAuction(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const id = (st.arg === 'cart' ? 'cart' : 'haul') as VenueId;
  st.data.btn = {};
  const W = Math.min(ui.w - 16, 340), H = Math.min(ui.h - 28, 232);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, id === 'haul' ? 'The Harvest Haul auction' : "Mags' Sunday lot")) return false;
  const a: Auction | null = st.data.a ?? (st.data.a = auctionAt(g, id));
  if (!a) {
    const v = venue(g, id);
    ui.para(lotSold(g, id) ? `${v.lot.name[0].toUpperCase() + v.lot.name.slice(1)} has gone under the hammer already. ${id === 'haul' ? 'Next year brings another lot.' : 'Mags has a new lot next Sunday.'}` : 'No lot on the block right now.', x + 14, y + 16, W - 28, C.walnut);
    if (ui.button('auc_done', x + W - 82, y + H - 26, 70, 18, 'Done', { style: 'green' })) return false;
    return true;
  }
  // the clock (a short frame cap keeps a stutter from skipping the calls)
  const before = a.log.length;
  tickAuction(a, Math.min(0.1, ui.dt));
  if (a.log.length > before && a.log[a.log.length - 1].who !== 'you') ui.sfx('coin');
  // sold: pay and hand it over (or not); the Haul counts as taken part, with its tokens
  if (a.call === 'sold' && !a.settled) {
    const r = closeLot(g, id, a);
    if (r && id === 'haul') {
      const f = FESTIVALS.find((x) => x.activity === 'haul')!;
      st.data.prize = finishActivity(g, f, r === 'won' ? 2 : a.youBid ? 1 : 0).prize;
    }
    if (r === 'won') play.toast(`Yours: ${a.lot.name}, for ${n0(a.bid)} coins. It's in your bag.`, 'i:' + a.lot.items[0].item, C.amber);
    play.app.audio.sfx(r === 'won' ? 'levelup' : 'collect');
    st.data.result = r;
  }
  // the caller and what they say
  portrait(ui, a.caller, x + 12, y + 14, 32, a.call === 'sold' ? 1 : 0);
  ui.panel(x + 58, y + 14, W - 70, 40, 'paper', false);
  ui.para(callLine(a), x + 64, y + 19, W - 82, C.ink, 9);
  // the lot
  lotIcons(ui, a, x + 14, y + 62);
  const lx = x + 18 + a.lot.items.length * 24;
  ui.text(ellipsize(a.lot.name, x + W - 14 - lx), lx, y + 64, C.ink);
  ui.text(`Worth about ${n0(a.lot.worth)} coins`, lx, y + 74, C.walnut);
  // the bidders, and the standing bid
  let bx = x + 14;
  for (const b of a.bidders) {
    portrait(ui, b.id, bx, y + 92, 16, 0);
    const last = [...a.log].reverse().find((l) => l.who === b.id);
    ui.text(Name(b.id), bx + 28, y + 95, a.high === b.id ? C.amber : C.ink);
    ui.text(last ? n0(last.amt) : '-', bx + 28, y + 105, C.walnut);
    bx += 92;
  }
  const mine = [...a.log].reverse().find((l) => l.who === 'you');
  ui.text('You', bx + 4, y + 95, a.high === 'you' ? C.amber : C.ink);
  ui.text(mine ? n0(mine.amt) : '-', bx + 4, y + 105, C.walnut);
  ui.text(a.high ? `Standing bid: ${n0(a.bid)} (${name(a.high)})` : `Opening at ${n0(a.bid)}`, x + 14, y + 124, C.ink, { scale: 2 });
  const by = y + H - 26;
  if (a.call !== 'sold') {
    const can = canBid(a, g.player.money);
    st.data.btn.bid = [x + 14, by, 110, 18];
    const why = a.high === 'you' ? 'Yours is the standing bid' : g.player.money < nextBid(a) ? `You have ${n0(g.player.money)} coins` : `${n0(a.step)} over the standing bid`;
    if (ui.button('auc_bid', x + 14, by, 110, 18, `Bid ${n0(nextBid(a))}`, { style: 'green', disabled: !can, tip: why }) && playerBid(a, g.player.money)) ui.sfx('coin');
    ui.text(`${ICON.coin}${n0(g.player.money)}`, x + 132, by + 5, g.player.money >= nextBid(a) ? C.walnut : C.brick);
    ui.text('Close to step away', x + W - 14, by + 5, C.pebble, { align: 'right' });
  } else {
    const won = st.data.result === 'won' || a.high === 'you';
    const prize = st.data.prize as FestivalDef['prizes'][number] | null | undefined;
    const tokens = prize?.items.find((i) => i.item === 'ticket')?.n;
    ui.para(won ? `It's yours, for ${n0(a.bid)} coins: ${a.lot.items.map((s) => `${s.n} ${ITEM_BY_ID.get(s.item)?.name ?? s.item}`).join(' and ')} in your bag.${tokens ? ` And ${tokens} festival tokens.` : ''}`
      : `${Name(a.high)} takes it for ${n0(a.bid)}. It cost you nothing.${tokens ? ` ${tokens} festival tokens for bidding.` : ''}`, x + 14, y + 146, W - 28, won ? C.moss : C.walnut, 9);
    st.data.btn.done = [x + W - 82, by, 70, 18];
    if (ui.button('auc_done', x + W - 82, by, 70, 18, 'Done', { style: 'green' })) return false;
  }
  return true;
}

/** the Harvest Haul's panel (F at the Mayor): double pay today, the year's lot, the stall */
export function drawHaul(ui: UI, play: PlayScreen, st: WinState, f: FestivalDef): boolean {
  const g = play.g;
  st.data.btn = {};
  const W = Math.min(ui.w - 16, 330), H = Math.min(ui.h - 28, 232);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, festivalName(f, true))) return false;
  if (st.data.mode === 'stall') {
    drawTokenStall(ui, play, x + 14, y + 16, f.host);
    if (ui.button('haul_back', x + 14, y + H - 28, 70, 18, 'Back')) st.data.mode = null;
    return true;
  }
  let yy = y + 14;
  yy += ui.para(f.intro, x + 12, yy, W - 24, C.walnut) + 4;
  yy += ui.para('Standing orders pay double today, by hand and by the noon, 6pm and overnight posts.', x + 12, yy, W - 24, C.amber) + 6;
  const v = venue(g, 'haul');
  const sold = lotSold(g, 'haul');
  lotIcons(ui, v, x + 14, yy);
  const lx = x + 18 + v.lot.items.length * 24;
  ui.text(ellipsize(v.lot.name, x + W - 14 - lx), lx, yy + 2, C.ink);
  ui.text(`Worth about ${n0(v.lot.worth)} coins. Bidding: Roxy and Bram`, lx, yy + 12, C.walnut);
  const by = y + H - 26;
  st.data.btn.auction = [x + 12, by, 110, 18];
  if (ui.button('haul_auction', x + 12, by, 110, 18, sold ? 'Lot sold' : 'To the auction', { style: 'green', disabled: sold, tip: sold ? 'This year\'s lot has gone under the hammer' : 'The Mayor calls the lot: bid against Roxy and Bram' })) {
    play.openWindow('auction', 'haul');
    return true;
  }
  if (ui.button('haul_stall', x + 130, by, 90, 18, 'Token stall')) st.data.mode = 'stall';
  return true;
}

registerWindow('auction', { draw: drawAuction });
