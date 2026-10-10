// 2.0 Phase 5: the festivals' rework. The Sprocket Fair's test bed and its entries, the Harvest
// Haul's double pay and auction, Mags the freight broker (her stock, her Sunday lot, shortages), and
// a 1.x save's festival flags.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game, SYSTEMS } from '../src/sim/Game';
import { key, kDef } from '../src/sim/inventory';
import type { Blueprint, BlueprintItem } from '../src/sim/blueprint';
import { BED_COAL, BED_STOCK, BED_TICKS, bedScore, bedTally, scoreBlueprint, startBed, stepBed } from '../src/sim/testbed';
import { FAIR_ENTRIES, FAIR_TOP_YEAR, fairEntries, fairPlace, fairResult } from '../src/sim/fair';
import { FESTIVALS } from '../src/data/goals';
import { festivalToday, finishActivity } from '../src/sim/systems/festivals';
import { consign, handDeliver, haulToday, orders, payFor, SHORT_PAY, SHORT_SIZE, type Order } from '../src/sim/systems/orders';
import { STANDING_BY_ID } from '../src/data/orders';
import {
  auctionAt, CALL_SECS, canBid, closeLot, HAUL_LOTS, lotSold, newAuction, nextBid, OPEN_WAIT, playerBid, settle, SUNDAY_LOTS, tickAuction, venue, type Auction, type Lot,
} from '../src/sim/auction';
import { CART_PARTS, cart, shortStock, sundayLot } from '../src/sim/systems/cart';
import { ITEM_BY_ID } from '../src/data/items';
import { CROPS } from '../src/data/crops';
import { FURNITURE } from '../src/data/furniture';
import { questSys } from '../src/sim/systems/quests';
import { npcSys, talkTo } from '../src/sim/systems/npcs';
import { serialize, deserialize } from '../src/sim/save';
import { ACHIEVEMENTS } from '../src/sim/systems/achievements';

const LOOK = { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 } as const;

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

// ---------------- sample lines for the bed ----------------
const piece = (def: string, dx: number, dy: number, rot = 0, extra: Partial<BlueprintItem> = {}): BlueprintItem => ({ def, dx, dy, rot: rot as BlueprintItem['rot'], ...extra });
const bp = (items: BlueprintItem[]): Blueprint => ({ items, w: Math.max(...items.map((i) => i.dx)) + 1, h: Math.max(...items.map((i) => i.dy)) + 1 });
/** chest -> arm -> machine -> arm -> shipping crate, along row y (w: the machine's width) */
const row = (y: number, mach: string, extra: Partial<BlueprintItem> = {}, arm = 'arm_basic', w = 1): BlueprintItem[] => [
  piece('chest_wood', 0, y), piece(arm, 1, y, 1), piece(mach, 2, y, 0, extra), piece(arm, 2 + w, y, 1), piece('shipping_crate', 3 + w, y),
];
/** a crock that last ran pickled cogbeans at home (the blueprint keeps it) */
const PICKLES = { last: 'jar:pickles_cogbean' };
const MEAL = { recipe: 'mill:barley' };
const COPPER = { recipe: 'smelt:copper' };
const LINES = {
  crock1: bp(row(0, 'jar', PICKLES)),
  crock2: bp([0, 1].flatMap((y) => row(y, 'jar', PICKLES))),
  crock4: bp([0, 1, 2, 3].flatMap((y) => row(y, 'jar', PICKLES))),
  crock6: bp([0, 1, 2, 3, 4, 5].flatMap((y) => row(y, 'jar', PICKLES))),
  furnace4: bp([0, 1, 2, 3].flatMap((y) => row(y, 'furnace', COPPER))),
  // powered: grist mills (2x2) on the bed's grid, fed and emptied by Brass Arms
  mill2: bp([0, 2].flatMap((y) => row(y, 'mill', MEAL, 'arm_fast', 2))),
  mill3: bp([0, 2, 4].flatMap((y) => row(y, 'mill', MEAL, 'arm_fast', 2))),
  // nothing to feed it: a crock on its own, and a crock fed by a belt from nowhere
  lone: bp([piece('jar', 0, 0)]),
  belted: bp([piece('belt_1', 0, 0, 1), piece('belt_1', 1, 0, 1), piece('arm_basic', 2, 0, 1), piece('jar', 3, 0, 0, PICKLES), piece('arm_basic', 4, 0, 1), piece('shipping_crate', 5, 0)]),
  // a chest's goods carried straight to a crate: the line made nothing
  passthru: bp([piece('chest_wood', 0, 0), piece('arm_basic', 1, 0, 1), piece('shipping_crate', 2, 0)]),
  // a crock line whose chest also leaks its beans into a second crate: only the pickles count
  leak: bp([...row(0, 'jar', PICKLES), piece('arm_basic', 0, 1, 2), piece('shipping_crate', 0, 2)]),
};
const KNOW = ['r_arms', 'r_belts', 'r_preserves', 'r_brewing', 'r_power', 'r_milling', 'r_metallurgy', 'r_brass', 'r_glass', 'r_sawmill', 'r_spark', 'r_assembly', 'r_assembly2'];

/** a year-1 farm that knows the machines (the bed brings its know-how and reads its prices) */
function farm(seed = 1): Game {
  const g = new Game({ seed });
  for (const r of KNOW) g.research.done.add(r);
  return g;
}

describe('the Sprocket Fair test bed', () => {
  const real = farm();
  const score = Object.fromEntries(Object.entries(LINES).map(([n, b]) => [n, scoreBlueprint(real, b)])) as Record<keyof typeof LINES, number>;

  it('scores a crock line and a powered line, the same every time and however the minute is stepped', () => {
    expect(score.crock2).toBeGreaterThan(0);
    expect(score.mill3).toBeGreaterThan(0);
    expect(score.furnace4).toBeGreaterThan(0);
    // more machines, more goods
    expect(score.crock4).toBeGreaterThan(score.crock2);
    expect(score.mill3).toBeGreaterThan(score.mill2);
    // deterministic for the same blueprint
    for (const n of ['crock2', 'mill3'] as const) expect(scoreBlueprint(real, LINES[n])).toBe(score[n]);
    // the Professor's window steps the minute in small chunks: the same score
    const run = startBed(real, LINES.mill3);
    while (run.ticks < BED_TICKS) stepBed(run, 17);
    expect(run.ticks).toBe(BED_TICKS);
    expect(bedScore(run)).toBe(score.mill3);
    // a whole minute and no more
    stepBed(run, 600);
    expect(run.ticks).toBe(BED_TICKS);
  });

  it('stocks the chests that feed machines, stokes the burners and powers the bed', () => {
    const run = startBed(real, LINES.furnace4);
    const chests = run.g.ents.all().filter((e) => e.def.kind === 'chest');
    expect(chests.length).toBe(4);
    for (const c of chests) expect(c.inv!.count(key('copper_ore'))).toBe(BED_STOCK);
    for (const f of run.g.ents.machines) expect(f.mach!.fuel?.n).toBe(BED_COAL);
    const crocks = startBed(real, LINES.crock2);
    for (const c of crocks.g.ents.all().filter((e) => e.def.kind === 'chest')) expect(c.inv!.count(key('cogbean'))).toBe(BED_STOCK);
    const mills = startBed(real, LINES.mill3);
    expect(mills.skipped).toEqual([]);
    stepBed(mills, 120);
    for (const m of mills.g.ents.machines) expect(m.sat).toBe(1);
    // the crock line's pickles take a minute a batch: the score counts the batch cooking at the bell
    stepBed(crocks, BED_TICKS);
    const t = bedTally(crocks);
    expect(t.cooking.length).toBe(1);
    expect(kDef(t.cooking[0].k).id).toBe('pickles_cogbean');
    expect(t.cooking[0].n).toBeGreaterThan(1.5);
    expect(t.cooking[0].n).toBeLessThanOrEqual(2);
  });

  it('scores nothing for a line with nothing to feed it, or goods it only carried', () => {
    expect(score.lone).toBe(0);
    expect(score.belted).toBe(0);
    expect(score.passthru).toBe(0);
    const run = startBed(real, LINES.leak);
    stepBed(run, BED_TICKS);
    const crate = run.g.ents.all().find((e) => e.def.kind === 'shipbin' && e.y === run.g.ents.all().find((c) => c.def.kind === 'chest')!.y + 2)!;
    expect(crate.inv!.count(key('cogbean'))).toBeGreaterThan(0);
    expect(score.leak).toBe(score.crock1);
  });

  it('leaves the real game untouched', () => {
    const g = farm(5);
    g.player.money = 1234;
    // the save as it stands (but for its timestamp)
    const snap = () => JSON.stringify({ ...serialize(g, LOOK), saved: 0 });
    const before = snap();
    const evs = g.events.length, tickN = g.tickN, ents = g.ents.all().length;
    const run = startBed(g, LINES.mill3);
    stepBed(run, BED_TICKS);
    expect(bedScore(run)).toBeGreaterThan(0);
    expect(run.g).not.toBe(g);
    expect(snap()).toBe(before);
    expect(g.events.length).toBe(evs);
    expect(g.tickN).toBe(tickN);
    expect(g.ents.all().length).toBe(ents);
    expect(g.player.money).toBe(1234);
  });

  it("tunes the year's entries to the sample lines", () => {
    const [prof, bram, juniper] = fairEntries(1).map((e) => e.score);
    expect(fairEntries(1).map((e) => e.who)).toEqual(['ottoline', 'bram', 'juniper']);
    // a modest two-crock line beats the Professor's pickles (one crock doesn't)
    expect(score.crock1).toBeLessThan(prof);
    expect(score.crock2).toBeGreaterThan(prof);
    // a line of four to six machines beats Bram's copper (two crocks don't)
    expect(score.crock2).toBeLessThan(bram);
    expect(score.crock4).toBeGreaterThan(bram);
    expect(score.furnace4).toBeGreaterThan(bram);
    // a strong powered line beats Juniper's meal (two mills, or six crocks, don't)
    expect(score.mill2).toBeLessThan(juniper);
    expect(score.crock6).toBeLessThan(juniper);
    expect(score.mill3).toBeGreaterThan(juniper);
    expect(fairPlace(1, score.mill3)).toEqual({ beaten: 3, byHalf: false });
    // the entries come back bigger each year, until the sixth
    for (let y = 2; y <= FAIR_TOP_YEAR; y++) fairEntries(y).forEach((e, i) => expect(e.score).toBeGreaterThan(fairEntries(y - 1)[i].score));
    expect(fairEntries(FAIR_TOP_YEAR + 3)).toEqual(fairEntries(FAIR_TOP_YEAR));
    expect(FAIR_ENTRIES.every((e) => e.what.length > 0)).toBe(true);
  });

  it('pays the candle rewards once a save and a prize each year', () => {
    const g = new Game({ seed: 9 });
    const m0 = g.player.money, fest0 = g.counters.festivals ?? 0;
    const tickets = () => g.player.inv.count(key('ticket'));
    // beat the Professor: the purse (2,500) and the year's first tier (5 tokens, 300 coins)
    const r1 = fairResult(g, 200);
    expect(r1).toMatchObject({ beaten: 1, candles: [1], tickets: 5, money: 300, best: true });
    expect(g.player.money).toBe(m0 + 2500 + 300);
    expect(g.counters.festivals).toBe(fest0 + 1);
    // all three: the Lantern and the Medal, and what the top tier adds to the first
    const r2 = fairResult(g, 2000);
    expect(r2).toMatchObject({ beaten: 3, candles: [2, 3], tickets: 15, money: 1200 });
    expect(tickets()).toBe(20);
    expect(g.flags.has('founders_medal')).toBe(true);
    expect(g.player.inv.count(key('f_lantern'))).toBe(1);
    // the same again pays nothing; half again the top entry wins the Gilded Clock
    expect(fairResult(g, 2000)).toMatchObject({ candles: [], tickets: 0, money: 0, best: false });
    const r4 = fairResult(g, 2600);
    expect(r4).toMatchObject({ byHalf: true, candles: [4], tickets: 0, money: 0 });
    expect(g.player.inv.count(key('f_gilded_clock'))).toBe(1);
    expect(g.counters.fair_ribbons).toBe(3);
    expect(g.counters.festivals).toBe(fest0 + 1);
    // next year: no candles left, the prize again
    g.time.year = 2;
    expect(fairResult(g, 300)).toMatchObject({ beaten: 1, candles: [], tickets: 5, money: 300 });
    // the Blue Ribbon and Going, Going, Gone are achievements with icons that exist
    for (const id of ['fair_ribbon', 'auction_win', 'festivals']) {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      expect(a).toBeTruthy();
      expect(ITEM_BY_ID.has(a.icon)).toBe(true);
    }
  });
});

describe('the four festivals', () => {
  it('are on their days with their hosts (none in Clockwork Rush)', () => {
    const by = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));
    expect(FESTIVALS.map((f) => f.id).sort()).toEqual(['f_fair', 'f_firefly', 'f_haul', 'f_skate']);
    expect(by.f_fair).toMatchObject({ name: 'Sprocket Fair', season: 0, day: 13, start: 540, end: 1080, host: 'ottoline', activity: 'fair' });
    expect(by.f_firefly).toMatchObject({ name: 'Lantern Night', season: 1, day: 20, host: 'sable', activity: 'firefly' });
    expect(by.f_haul).toMatchObject({ name: 'Harvest Haul', season: 2, day: 16, start: 540, end: 1080, host: 'tobias', activity: 'haul' });
    expect(by.f_skate).toMatchObject({ name: 'Frostlight Skate', season: 3, day: 24, host: 'marigold', activity: 'skate' });
    // the game's voice: no em dashes
    const emDash = String.fromCharCode(0x2014);
    for (const f of FESTIVALS) expect((f.desc + f.intro).includes(emDash)).toBe(false);
    const g = new Game({ seed: 3 });
    g.time.season = 0;
    g.time.day = 13;
    expect(festivalToday(g)?.id).toBe('f_fair');
    g.mode = 'rush';
    expect(festivalToday(g)).toBe(null);
  });

  it("opens the Fair at the Professor once she's had her word, and at the Mayor as Kite Day did", () => {
    const g = new Game({ seed: 3 });
    g.time.season = 0;
    g.time.day = 13;
    g.time.min = 10 * 60;
    for (let i = 0; i < 31; i++) g.tick();
    expect(g.sys.festivals.active?.id).toBe('f_fair');
    const opened = () => g.events.some((e) => e.t === 'ui' && e.open === 'festival' && e.arg === 'f_fair');
    const prof = npcSys(g).byId.get('ottoline')!, mayor = npcSys(g).byId.get('tobias')!;
    g.player.sel = g.player.inv.slots.findIndex((s) => !s);
    // the Mayor opens it straight away, without a chat (as he opened Kite Day)
    g.events.length = 0;
    talkTo(g, mayor);
    expect(opened()).toBe(true);
    expect(mayor.talked).toBe(false);
    // the Professor's first F is the day's chat, the next opens her bed
    g.events.length = 0;
    g.sys.dialogue = null;
    talkTo(g, prof);
    expect(opened()).toBe(false);
    expect(prof.talked).toBe(true);
    expect(g.events.some((e) => e.t === 'ui' && e.open === 'dialog')).toBe(true);
    g.sys.dialogue = null;
    talkTo(g, prof);
    expect(opened()).toBe(true);
    // the Haul's Mayor opens it at once
    g.events.length = 0;
    g.time.season = 2;
    g.time.day = 16;
    for (let i = 0; i < 31; i++) g.tick();
    talkTo(g, mayor);
    expect(g.events.some((e) => e.t === 'ui' && e.open === 'festival' && e.arg === 'f_haul')).toBe(true);
  });

  it('remaps a 1.x save: Kite Day counts as the Fair, the Pumpkin Roll as the Haul', () => {
    const g = new Game({ seed: 4 });
    for (const f of ['fest_seen_f_kite', 'fest_seen_f_pumpkin', 'fest_seen_f_firefly', 'fest_f_kite_1', 'fest_f_pumpkin_1', 'eval_pending']) g.flags.add(f);
    g.counters.festivals = 3;
    g.counters.best_f_kite = 41;
    g.counters.best_f_pumpkin = 12;
    const { game: g2 } = deserialize(JSON.parse(JSON.stringify(serialize(g, LOOK))));
    for (const f of ['fest_seen_f_fair', 'fest_seen_f_haul', 'fest_seen_f_firefly', 'fest_f_fair_1', 'fest_f_haul_1']) expect(g2.flags.has(f)).toBe(true);
    for (const f of ['fest_seen_f_kite', 'fest_seen_f_pumpkin', 'fest_f_kite_1', 'fest_f_pumpkin_1', 'eval_pending']) expect(g2.flags.has(f)).toBe(false);
    expect(g2.counters.best_f_kite).toBeUndefined();
    expect(g2.counters.best_f_pumpkin).toBeUndefined();
    expect(g2.counters.festivals).toBe(3);
    // Kite Day's prize this year was paid: a Fair run still wins its candle, not the year's prize again
    const r = fairResult(g2, 200);
    expect(r).toMatchObject({ candles: [1], tickets: 0, money: 0 });
    expect(g2.counters.festivals).toBe(3);
  });
});

/** a weekly standing order on the board (Rowan's pickles: 150 coins each, 300 in silver) */
function standing(g: Game, n = 6): Order {
  const os = orders(g);
  const o = { uid: os.uid++, kind: 'standing', def: 'rowan_pickles', cust: 'rowan', lines: [{ spec: 'pickles_cogbean', n, have: 0 }], day: g.dayIndex, due: g.dayIndex + 4, unit: 150, silver: true, rep: 1 } as Order;
  os.open.push(o);
  if (!os.posted.includes('rowan')) os.posted.push('rowan');
  return o;
}

describe('the Harvest Haul', () => {
  it('doubles every standing order on its day only, by hand and by the post', () => {
    const g = new Game({ seed: 6 });
    const pickle = key('pickles_cogbean');
    const o = standing(g, 40);
    const day = (season: number, d: number) => { g.time.season = season as Game['time']['season']; g.time.day = d; };
    day(2, 16);
    expect(haulToday(g)).toBe(true);
    expect(payFor(g, o, pickle, 3)).toBe(900);
    // silver doubles on top
    expect(payFor(g, o, key('pickles_cogbean', 1), 1)).toBe(600);
    // a Today ask isn't a standing order
    expect(payFor(g, { ...o, kind: 'today' }, pickle, 3)).toBe(450);
    for (const [s, d] of [[2, 15], [2, 17], [0, 13], [1, 16]]) {
      day(s, d);
      expect(haulToday(g)).toBe(false);
      expect(payFor(g, o, pickle, 3)).toBe(450);
    }
    // by hand, at Rowan's
    day(2, 16);
    g.player.inv.add(pickle, 4);
    const m0 = g.player.money;
    expect(handDeliver(g, 'rowan', pickle)).toBe(true);
    expect(g.player.money - m0).toBe(4 * 300);
    day(2, 17);
    g.player.inv.add(pickle, 4);
    const m1 = g.player.money;
    handDeliver(g, 'rowan', pickle);
    expect(g.player.money - m1).toBe(4 * 150);
    // by the post: a crate tagged for Rowan
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'rowan';
    day(2, 16);
    bin.inv!.add(pickle, 5);
    expect(consign(g, [bin]).total).toBe(5 * 300);
    day(2, 18);
    bin.inv!.add(pickle, 5);
    expect(consign(g, [bin]).total).toBe(5 * 150);
    // Clockwork Rush has no festivals
    day(2, 16);
    g.mode = 'rush';
    expect(haulToday(g)).toBe(false);
  });
});

const run = (a: Auction, secs: number) => {
  for (let t = 0; t < secs; t += 0.1) tickAuction(a, 0.1);
};
const LOT: Lot = { name: 'a test lot', items: [{ item: 'brass_gear', n: 3 }], worth: 2000 };

describe('the auction', () => {
  it('opens at half the worth, steps by 5% and hides limits around the worth, the same for a seed', () => {
    const a = newAuction(77, LOT, 'tobias', ['roxy', 'bram']);
    expect(a.step).toBe(100);
    expect(a.bid).toBe(1000);
    expect(nextBid(a)).toBe(1000);
    for (const b of a.bidders) {
      expect(b.limit).toBeGreaterThanOrEqual(1500);
      expect(b.limit).toBeLessThanOrEqual(2400);
      expect(b.limit % a.step).toBe(0);
    }
    expect(newAuction(77, LOT, 'tobias', ['roxy', 'bram']).bidders).toEqual(a.bidders);
    // across seeds, the limits spread
    const lims = new Set(Array.from({ length: 30 }, (_, i) => newAuction(i, LOT, 'tobias', ['roxy', 'bram']).bidders[0].limit));
    expect(lims.size).toBeGreaterThan(4);
  });

  it('is won by outbidding: you pay your bid and the lot goes in your bag', () => {
    const g = new Game({ seed: 8 });
    g.player.money = 50000;
    const a = newAuction(5, LOT, 'tobias', ['roxy', 'bram']);
    // the bidders answer after a moment
    expect(playerBid(a, g.player.money)).toBe(true);
    expect(a.high).toBe('you');
    expect(canBid(a, g.player.money)).toBe(false);
    expect(a.answer?.at).toBeGreaterThanOrEqual(0.8);
    expect(a.answer?.at).toBeLessThanOrEqual(2);
    for (let i = 0; i < 20000 && a.call !== 'sold'; i++) {
      if (canBid(a, g.player.money)) playerBid(a, g.player.money);
      tickAuction(a, 0.1);
    }
    expect(a.call).toBe('sold');
    expect(a.high).toBe('you');
    const top = Math.max(...a.bidders.map((b) => b.limit));
    expect(a.bid).toBeGreaterThan(top - a.step);
    expect(a.bid).toBeLessThanOrEqual(top + a.step);
    expect(a.log.some((l) => l.who === 'roxy') || a.log.some((l) => l.who === 'bram')).toBe(true);
    const m0 = g.player.money;
    expect(settle(g, a)).toBe('won');
    expect(settle(g, a)).toBe(null);
    expect(g.player.money).toBe(m0 - a.bid);
    expect(g.player.inv.count(key('brass_gear'))).toBe(3);
    expect(g.counters.auction_wins).toBe(1);
  });

  it('costs nothing to lose, and calls "going once, going twice, sold" on a clock', () => {
    const g = new Game({ seed: 8 });
    g.player.money = 50000;
    const a = newAuction(5, LOT, 'tobias', ['roxy', 'bram']);
    // nobody bids for a while: the keener bidder opens
    run(a, OPEN_WAIT - 0.5);
    expect(a.high).toBe(null);
    run(a, 1);
    expect(a.high).not.toBe(null);
    // they bid each other up to the lower limit, then the caller counts down
    run(a, 60);
    expect(a.call).toBe('sold');
    const [lo, hi] = a.bidders.map((b) => b.limit).sort((x, y) => x - y);
    expect(a.bid).toBeGreaterThan(lo - a.step);
    expect(a.bid).toBeLessThanOrEqual(Math.min(hi, lo + a.step));
    const m0 = g.player.money;
    expect(settle(g, a)).toBe('lost');
    expect(g.player.money).toBe(m0);
    expect(g.player.inv.count(key('brass_gear'))).toBe(0);
    // the countdown: once, twice, sold, CALL_SECS apart after the last bid
    const b = newAuction(5, { ...LOT, worth: 200 }, 'tobias', []);
    expect(playerBid(b, 1000)).toBe(true);
    run(b, CALL_SECS + 0.05);
    expect(b.call).toBe('once');
    run(b, CALL_SECS);
    expect(b.call).toBe('twice');
    run(b, CALL_SECS);
    expect(b.call).toBe('sold');
    // not enough money: no bid
    const c = newAuction(5, LOT, 'tobias', ['roxy']);
    expect(canBid(c, 500)).toBe(false);
    expect(playerBid(c, 500)).toBe(false);
    // a winning bid you can no longer cover goes to the bidder before you
    const d = newAuction(5, LOT, 'tobias', ['roxy', 'bram']);
    for (let i = 0; i < 20000 && d.call !== 'sold'; i++) {
      if (canBid(d, 50000)) playerBid(d, 50000);
      tickAuction(d, 0.1);
    }
    g.player.money = 10;
    expect(settle(g, d)).toBe('lost');
    expect(g.player.money).toBe(10);
  });

  it("runs the Haul's lot once a year and Mags' on Sundays, with lots that exist", () => {
    for (const l of [...HAUL_LOTS, ...SUNDAY_LOTS]) for (const s of l.items) expect(ITEM_BY_ID.has(s.item), s.item).toBe(true);
    const g = new Game({ seed: 12 });
    g.player.money = 99999;
    const v = venue(g, 'haul');
    expect(v).toMatchObject({ caller: 'tobias', bidders: ['roxy', 'bram'], lot: HAUL_LOTS[0] });
    const a = auctionAt(g, 'haul')!;
    expect(auctionAt(g, 'haul')).toBe(a);
    for (let i = 0; i < 20000 && a.call !== 'sold'; i++) {
      if (canBid(a, g.player.money)) playerBid(a, g.player.money);
      tickAuction(a, 0.1);
    }
    expect(closeLot(g, 'haul', a)).toBe('won');
    expect(g.player.inv.count(key('assembler_2'))).toBe(1);
    expect(lotSold(g, 'haul')).toBe(true);
    // a new auction object for the same year finds the lot gone
    g.sys.auctions = {};
    expect(auctionAt(g, 'haul')).toBe(null);
    // next year, the next lot
    g.time.year = 2;
    expect(auctionAt(g, 'haul')?.lot).toBe(HAUL_LOTS[1]);
    // Mags calls a lot from her list, Roxy and the Professor bidding
    const c = venue(g, 'cart');
    expect(c.caller).toBe('peddler');
    expect(c.bidders).toEqual(['roxy', 'ottoline']);
    expect(SUNDAY_LOTS).toContain(c.lot);
  });
});

describe("Mags' freight cart", () => {
  const cartSys = SYSTEMS.find((s) => s.name === 'cart')!;

  it('brings rare parts, off-season seeds, a sapling and a curio, never gems or relics', () => {
    const g = new Game({ seed: 14 });
    const parts = new Set(CART_PARTS.map(([id]) => id));
    let cores = 0, weeks = 0;
    for (let season = 0; season < 4; season++)
      for (let w = 0; w < 4; w++) {
        g.time.season = season as Game['time']['season'];
        g.time.day = 1 + w * 7;
        cartSys.dayStart!(g);
        const stock = cart(g).stock;
        weeks++;
        for (const e of stock) {
          const d = ITEM_BY_ID.get(e.item)!;
          expect(d, e.item).toBeTruthy();
          expect(d.cat).not.toBe('gem');
          expect(d.tags ?? []).not.toContain('relic');
          expect(e.price).toBeGreaterThan(0);
        }
        expect(stock.filter((e) => parts.has(e.item)).length).toBe(4);
        if (stock.some((e) => e.item === 'clockwork_core')) cores++;
        const seeds = stock.filter((e) => ITEM_BY_ID.get(e.item)!.cat === 'seed' && !e.item.endsWith('_sapling'));
        expect(seeds.length).toBeGreaterThanOrEqual(2);
        expect(seeds.length).toBeLessThanOrEqual(3);
        for (const s of seeds) expect(CROPS.find((c) => c.seed === s.item)!.seasons).not.toContain(season);
        expect(stock.filter((e) => e.item.endsWith('_sapling')).length).toBe(1);
        const curios = stock.filter((e) => e.item.startsWith('card_') || FURNITURE.some((f) => f.id === e.item && f.shop === 'cart'));
        expect(curios.length).toBe(1);
      }
    // now and then a clockwork core
    expect(cores).toBeGreaterThan(0);
    expect(cores).toBeLessThan(weeks);
  });

  it('auctions a lot at the cart on Sundays until it sells', () => {
    const g = new Game({ seed: 15 });
    while (g.weekday !== 6) sleep(g);
    if (g.player.where === 'house') g.sys.house.leave(g);
    g.time.min = 10 * 60;
    expect(sundayLot(g)).toBe(true);
    const a = auctionAt(g, 'cart')!;
    run(a, 120);
    expect(closeLot(g, 'cart', a)).toBe('lost');
    expect(closeLot(g, 'cart', a)).toBe(null);
    expect(sundayLot(g)).toBe(false);
    // the window still shows the sold lot; once it's gone (a reload), no new one this week
    expect(auctionAt(g, 'cart')).toBe(a);
    g.sys.auctions = {};
    expect(auctionAt(g, 'cart')).toBe(null);
  });

  it('a shortage doubles a weekly order at 25% more an item, Mags stocks it, and it ends with the week', () => {
    // seed 11 runs short in its second week and not its third (the roll is per save and week)
    const g = new Game({ seed: 11 });
    g.flags.add('town_mill');
    const q = questSys(g);
    if (!q.done.includes('k7_town')) q.done.push('k7_town');
    const os = orders(g);
    // Rowan's pickles, a regular now
    os.filled.rowan_pickles = 1;
    const def = STANDING_BY_ID.get('rowan_pickles')!;
    // the first week's order lapses on Saturday; on Monday the new one is short
    while (g.weekday !== 0 || g.dayIndex === 0) sleep(g);
    const week = Math.floor(g.dayIndex / 7);
    expect(week).toBe(1);
    const o = os.open.find((x) => x.def === 'rowan_pickles')!;
    expect(o.short).toBe(true);
    expect(o.lines[0].n).toBe(def.n * SHORT_SIZE);
    expect(o.unit).toBe(Math.round(def.unit * SHORT_PAY));
    expect(payFor(g, o, key('pickles_cogbean'), 2)).toBe(2 * 188);
    expect(os.short).toEqual({ week, cust: 'rowan', spec: 'pickles_cogbean', n: def.n * SHORT_SIZE });
    expect(g.events.some((e) => e.t === 'toast' && /run short/.test(e.text))).toBe(true);
    // Mags has the beans the pickles are made from, dear, and enough a day for the order
    const want = shortStock('pickles_cogbean', o.lines[0].n)!;
    expect(want.item).toBe('cogbean');
    expect(want.price).toBeGreaterThan(ITEM_BY_ID.get('cogbean')!.price * 2);
    expect(want.daily).toBeGreaterThanOrEqual(o.lines[0].n);
    expect(cart(g).stock).toContainEqual(want);
    // it survives a save
    const { game: g2 } = deserialize(JSON.parse(JSON.stringify(serialize(g, LOOK))));
    expect(orders(g2).short).toEqual(os.short);
    expect(orders(g2).open.find((x) => x.def === 'rowan_pickles')?.short).toBe(true);
    // a week on, the order is its usual size and price, and Mags' stock is back to normal
    for (let i = 0; i < 7; i++) sleep(g);
    const next = os.open.find((x) => x.def === 'rowan_pickles')!;
    expect(next.short).toBeFalsy();
    expect(next.lines[0].n).toBe(def.n);
    expect(next.unit).toBe(def.unit);
    expect(cart(g).stock.some((e) => e.item === 'cogbean' && e.price === want.price)).toBe(false);
  });

  it('has no shortages before the Town Mill, in Sandbox or in Clockwork Rush', () => {
    for (const mode of ['story', 'sandbox', 'rush'] as const) {
      const g = new Game({ seed: 3 });
      g.mode = mode;
      if (mode !== 'story') g.flags.add('town_mill');
      orders(g).filled.rowan_pickles = 1;
      const q = questSys(g);
      if (!q.done.includes('k7_town')) q.done.push('k7_town');
      for (let i = 0; i < 7 * 5; i++) sleep(g);
      expect(orders(g).short, mode).toBeUndefined();
    }
  });
});

// the Haul's own prize, by bidding or winning (src/ui/windows/auction.ts calls it)
describe('the Haul prize', () => {
  it('pays 10 tokens for bidding and 20 for winning, once a year', () => {
    const g = new Game({ seed: 16 });
    const f = FESTIVALS.find((x) => x.id === 'f_haul')!;
    expect(finishActivity(g, f, 2).first).toBe(true);
    expect(g.player.inv.count(key('ticket'))).toBe(20);
    expect(finishActivity(g, f, 2).first).toBe(false);
    expect(g.flags.has('fest_seen_f_haul')).toBe(true);
  });
});
