// The auction (ROADMAP.md 7.7 and 7.9, Phase 5): one lot, a caller, and two villagers bidding
// against you up to hidden limits around the lot's worth. You bid in steps (5% of its worth); they
// answer after a moment, and outbid each other too; when nobody raises, "Going once... going
// twice... Sold!". Win and you pay your bid and the lot goes in your bag; lose and it costs
// nothing. The Harvest Haul's lot (the Mayor calls it, Roxy and Bram bid) and Mags' Sunday lot at
// the cart (Roxy and the Professor) both run on it. A pure state and a clock the window advances;
// the limits and the answers' timing come from a seed, so each lot plays out the same on a save.
import type { Stack } from '../data/types';
import { Rng } from '../engine/rng';
import type { Game } from './Game';
import { key } from './inventory';

export interface Lot {
  /** how the caller names it ("a Clockwork Assembler from the city") */
  name: string;
  items: Stack[];
  /** about what it would cost to buy or make: the bidders' limits sit around it */
  worth: number;
}

export interface Bidder {
  id: string;
  /** the most they'll bid (hidden) */
  limit: number;
}

/** open: taking bids; once and twice: the caller's countdown; sold */
export type Call = 'open' | 'once' | 'twice' | 'sold';

export interface Auction {
  lot: Lot;
  /** the villager calling it: 'tobias' at the Haul, 'peddler' (Mags) at the cart */
  caller: string;
  bidders: Bidder[];
  /** the opening price until someone bids, then the standing bid */
  bid: number;
  /** who holds the standing bid: 'you', a bidder's id, or null before anyone has bid */
  high: string | null;
  step: number;
  call: Call;
  /** seconds since the last bid or call */
  t: number;
  /** a bidder about to raise, and when (on t) */
  answer: { who: string; at: number } | null;
  log: { who: string; amt: number }[];
  /** you bid at least once */
  youBid: boolean;
  /** paid and handed over (or lost) */
  settled: boolean;
  rng: Rng;
  /** which lot this is ('haul:<year>', 'cart:<week>'): a new year or week calls a new one */
  key?: string;
}

/** seconds between "Going once", "going twice" and "Sold!" */
export const CALL_SECS = 2;
/** seconds before a bidder opens a lot nobody has bid on */
export const OPEN_WAIT = 4;

export function newAuction(seed: number, lot: Lot, caller: string, bidders: string[]): Auction {
  const rng = new Rng(seed);
  const step = Math.max(10, Math.round((lot.worth * 0.05) / 10) * 10);
  const open = Math.max(step, Math.round((lot.worth * 0.5) / step) * step);
  return {
    lot, caller, step, bid: open, high: null, call: 'open', t: 0, answer: null, log: [], youBid: false, settled: false, rng,
    // between three quarters of its worth and a fifth over it
    bidders: bidders.map((id) => ({ id, limit: Math.round((lot.worth * (0.75 + 0.45 * rng.next())) / step) * step })),
  };
}

/** what the next bid would be: the opening price, then a step over the standing bid */
export const nextBid = (a: Auction) => (a.high === null ? a.bid : a.bid + a.step);

/** can you bid now with this much money? (not over your own bid) */
export const canBid = (a: Auction, money: number) => a.call !== 'sold' && a.high !== 'you' && money >= nextBid(a);

/** the bidders still in it at the next price */
const keen = (a: Auction) => a.bidders.filter((b) => b.id !== a.high && b.limit >= nextBid(a));

function raise(a: Auction, who: string) {
  a.bid = nextBid(a);
  a.high = who;
  a.log.push({ who, amt: a.bid });
  a.call = 'open';
  a.t = 0;
  a.answer = null;
  const k = keen(a);
  if (k.length) a.answer = { who: k[Math.floor(a.rng.next() * k.length)].id, at: 0.8 + a.rng.next() * 1.2 };
}

/** You raise by a step. False if you can't (sold, your own bid standing, or not enough money). */
export function playerBid(a: Auction, money: number): boolean {
  if (!canBid(a, money)) return false;
  a.youBid = true;
  raise(a, 'you');
  return true;
}

/** the auction's clock: bidders answer, the caller counts down */
export function tickAuction(a: Auction, dt: number) {
  if (a.call === 'sold') return;
  a.t += dt;
  if (a.high === null) {
    // nobody has bid: the keener bidder opens it
    if (a.t >= OPEN_WAIT) {
      const b = [...a.bidders].sort((x, y) => y.limit - x.limit)[0];
      if (b) raise(a, b.id);
    }
    return;
  }
  if (a.answer) {
    if (a.t >= a.answer.at) raise(a, a.answer.who);
    return;
  }
  if (a.t >= CALL_SECS) {
    a.t = 0;
    a.call = a.call === 'open' ? 'once' : a.call === 'once' ? 'twice' : 'sold';
  }
}

/**
 * Sold: if it's yours, pay your bid and take the lot (into the bag; what doesn't fit drops at your
 * feet). Returns 'won' or 'lost' the first time, null before it's sold or once settled.
 */
export function settle(g: Game, a: Auction): 'won' | 'lost' | null {
  if (a.call !== 'sold' || a.settled) return null;
  a.settled = true;
  if (a.high !== 'you') return 'lost';
  // a bid you can no longer cover goes to the last bidder before you
  if (g.player.money < a.bid) {
    const before = [...a.log].reverse().find((l) => l.who !== 'you');
    a.high = before?.who ?? null;
    return 'lost';
  }
  g.player.money -= a.bid;
  for (const s of a.lot.items) g.give(key(s.item), s.n);
  g.count('auction_wins');
  g.emit({ t: 'sfx', id: 'quest' });
  return 'won';
}

/** the Harvest Haul's lots, one a year in turn */
export const HAUL_LOTS: Lot[] = [
  { name: 'a Clockwork Assembler from the city', items: [{ item: 'assembler_2', n: 1 }], worth: 9000 },
  { name: 'a crate of brass gears and spark coils', items: [{ item: 'brass_gear', n: 20 }, { item: 'spark_coil', n: 8 }], worth: 14000 },
  { name: 'five starmetal bars from the Starfall galleries', items: [{ item: 'starmetal_bar', n: 5 }], worth: 12000 },
  { name: 'two dozen Gilded Express Belts', items: [{ item: 'belt_3', n: 24 }], worth: 8000 },
];

/** Mags' Sunday lots at the cart, one a week (seeded) */
export const SUNDAY_LOTS: Lot[] = [
  { name: 'a clockwork core', items: [{ item: 'clockwork_core', n: 1 }], worth: 2200 },
  { name: 'a pair of Gilded Sprinklers', items: [{ item: 'sprinkler_3', n: 2 }], worth: 2400 },
  { name: 'a Bulk Arm', items: [{ item: 'arm_bulk', n: 1 }], worth: 3600 },
  { name: 'eight brass lenses', items: [{ item: 'lens', n: 8 }], worth: 3000 },
  { name: 'a Brass Vault', items: [{ item: 'chest_brass', n: 1 }], worth: 2400 },
  { name: 'a Spring Coil Battery', items: [{ item: 'spring_battery', n: 1 }], worth: 2000 },
  { name: 'a Mist Tower', items: [{ item: 'mist_tower', n: 1 }], worth: 3200 },
  { name: 'a starmetal bar', items: [{ item: 'starmetal_bar', n: 1 }], worth: 2600 },
];

/** the open auctions, by venue ('haul', 'cart'): not saved (a reload starts the lot again) */
export function auctions(g: Game): Record<string, Auction | undefined> {
  return (g.sys.auctions ??= {});
}

export type VenueId = 'haul' | 'cart';

/** a lot's own seed: per save, venue and year or week */
const seedOf = (g: Game, salt: number, n: number) => (g.seed ^ Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(salt, 0x27d4eb2f)) >>> 0;

/**
 * Where a lot is called. The Harvest Haul: the Mayor, Roxy and Bram bidding, one lot a year from
 * HAUL_LOTS in turn. Mags' Sunday lot at the cart: Roxy and the Professor bidding, a lot a week.
 */
export function venue(g: Game, id: VenueId): { lot: Lot; caller: string; bidders: string[]; seed: number; key: string } {
  if (id === 'haul') {
    const y = g.time.year;
    return { lot: HAUL_LOTS[(y - 1) % HAUL_LOTS.length], caller: 'tobias', bidders: ['roxy', 'bram'], seed: seedOf(g, 1, y), key: 'haul:' + y };
  }
  const w = Math.floor(g.dayIndex / 7);
  return { lot: new Rng(seedOf(g, 2, w)).pick(SUNDAY_LOTS), caller: 'peddler', bidders: ['roxy', 'ottoline'], seed: seedOf(g, 3, w), key: 'cart:' + w };
}

/** has this venue's lot gone (the Haul's this year, the cart's this week)? */
export function lotSold(g: Game, id: VenueId): boolean {
  if (id === 'haul') return g.flags.has('haul_sold_' + g.time.year);
  return (g.sys.cart?.sold ?? -1) === Math.floor(g.dayIndex / 7);
}

/** the venue's auction: the one under way, or a fresh one; null once its lot is sold */
export function auctionAt(g: Game, id: VenueId): Auction | null {
  const v = venue(g, id);
  const all = auctions(g);
  const a = all[id];
  if (a && a.key === v.key) return a;
  if (lotSold(g, id)) return null;
  const fresh = newAuction(v.seed, v.lot, v.caller, v.bidders);
  fresh.key = v.key;
  return (all[id] = fresh);
}

/** Sold: settle it and mark its lot gone. Returns 'won' or 'lost' the first time, else null. */
export function closeLot(g: Game, id: VenueId, a: Auction): 'won' | 'lost' | null {
  const r = settle(g, a);
  if (!r) return null;
  if (id === 'haul') g.flags.add('haul_sold_' + g.time.year);
  else if (g.sys.cart) g.sys.cart.sold = Math.floor(g.dayIndex / 7);
  return r;
}
