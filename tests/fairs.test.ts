// 2.0 Phase 5: the festivals' rework. The Sprocket Fair's test plate and its entries, the Harvest
// Haul's double pay and auction, Mags the freight broker (her stock, her Sunday lot, shortages), and
// a 1.x save's festival flags. The Fair as revised after the critic's Phase 5 review: five minutes
// scored by the value a line adds at base prices, baskets for gleaners and cranes, the entries tuned
// on sample lines and the pacing bot's spring-13 farms, the plate on the square and the Fair told
// ahead; the Haul on fall 15, a Monday.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game, SYSTEMS } from '../src/sim/Game';
import { key, kDef, sellPrice } from '../src/sim/inventory';
import { copyBlueprint, type Blueprint, type BlueprintItem } from '../src/sim/blueprint';
import { BED_COAL, BED_MINUTES, BED_STOCK, BED_TICKS, bedScore, bedTally, homeGoods, ranDry, scoreBlueprint, startBed, stepBed } from '../src/sim/testbed';
import { CLOCK_YEAR, FAIR_ENTRIES, FAIR_TOP_YEAR, fairEntries, fairPlace, fairResult } from '../src/sim/fair';
import { FESTIVALS } from '../src/data/goals';
import { NPCS } from '../src/data/npcs';
import { STRUCT_BY_ID } from '../src/data/structures';
import { festivalNotice, festivalToday, finishActivity } from '../src/sim/systems/festivals';
import { consign, handDeliver, haulToday, orders, payFor, SHORT_PAY, SHORT_SIZE, type Order } from '../src/sim/systems/orders';
import { STANDING_BY_ID } from '../src/data/orders';
import {
  auctionAt, CALL_SECS, canBid, closeLot, HAUL_LOTS, lotSold, newAuction, nextBid, OPEN_WAIT, playerBid, settle, SUNDAY_LOTS, tickAuction, venue, type Auction, type Lot,
} from '../src/sim/auction';
import { CART_PARTS, cart, shortStock, sundayLot } from '../src/sim/systems/cart';
import { ITEMS, ITEM_BY_ID } from '../src/data/items';
import { CROPS } from '../src/data/crops';
import { FURNITURE } from '../src/data/furniture';
import { questSys } from '../src/sim/systems/quests';
import { npcSys, talkTo } from '../src/sim/systems/npcs';
import { serialize, deserialize } from '../src/sim/save';
import { ACHIEVEMENTS } from '../src/sim/systems/achievements';
import { promptAt } from '../src/sim/prompts';
import { addBlueprint, drafting, loadLib, saveLib } from '../src/sim/drafting';
import { FAIR_ENTRY_LINES, FAIR_PLATE, FAIR_SPOTS, fairgroundTile } from '../src/sim/world/fairground';
import { OPENING, RIVER } from '../src/sim/opening';
import { goals } from '../src/sim/systems/goals';
import { market } from '../src/sim/systems/economy';
import { Bot } from './bot';

const LOOK = { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 } as const;

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

// ---------------- sample lines for the plate ----------------
const piece = (def: string, dx: number, dy: number, rot = 0, extra: Partial<BlueprintItem> = {}): BlueprintItem => ({ def, dx, dy, rot: rot as BlueprintItem['rot'], ...extra });
const bp = (items: BlueprintItem[]): Blueprint => ({ items, w: Math.max(...items.map((i) => i.dx)) + 1, h: Math.max(...items.map((i) => i.dy)) + 1 });
/** chest -> arm -> machine -> arm -> shipping crate, along row y (w: the machine's width) */
const row = (y: number, mach: string, extra: Partial<BlueprintItem> = {}, arm = 'arm_basic', w = 1): BlueprintItem[] => [
  piece('chest_wood', 0, y), piece(arm, 1, y, 1), piece(mach, 2, y, 0, extra), piece(arm, 2 + w, y, 1), piece('shipping_crate', 3 + w, y),
];
/** n such rows, one under another */
const rows = (n: number, mach: string, extra: Partial<BlueprintItem> = {}, arm = 'arm_basic', w = 1) => Array.from({ length: n }, (_, i) => row(i * w, mach, extra, arm, w)).flat();
/** a crock that last ran pickled cogbeans at home (the blueprint keeps it) */
const PICKLES = { last: 'jar:pickles_cogbean' };
/** a field machine's line: it picks from its basket into a crock, and an arm takes the pickles to a crate */
const picker = (def: string, crop?: string) => bp([piece(def, 0, 0, 0, crop ? { crop } : {}), piece('arm_basic', 1, 0, 1), piece('jar', 2, 0, 0, PICKLES), piece('arm_basic', 3, 0, 1), piece('shipping_crate', 4, 0)]);
const LINES = {
  crock1: bp(rows(1, 'jar', PICKLES)),
  crock2: bp(rows(2, 'jar', PICKLES)),
  crock3: bp(rows(3, 'jar', PICKLES)),
  crock4: bp(rows(4, 'jar', PICKLES)),
  crock6: bp(rows(6, 'jar', PICKLES)),
  // a gleaner that last picked cogbeans, and a harvest crane (on the plate's grid)
  gleaned: picker('gleaner', 'cogbean'),
  craned: picker('harvester', 'cogbean'),
  furnace1: bp(rows(1, 'furnace', { recipe: 'smelt:copper' })),
  furnace2: bp(rows(2, 'furnace', { recipe: 'smelt:copper' })),
  furnace6: bp(rows(6, 'furnace', { recipe: 'smelt:copper' })),
  tin6: bp(rows(6, 'furnace', { recipe: 'smelt:tin' })),
  iron6: bp(rows(6, 'furnace', { recipe: 'smelt:iron' })),
  gold6: bp(rows(6, 'furnace', { recipe: 'smelt:gold' })),
  tincan6: bp(rows(6, 'furnace', { recipe: 'smelt:tincan' })),
  // powered: grist mills (2x2) on the plate's grid, fed and emptied by Brass Arms
  mill1: bp(rows(1, 'mill', { recipe: 'mill:barley' }, 'arm_fast', 2)),
  mill3: bp(rows(3, 'mill', { recipe: 'mill:barley' }, 'arm_fast', 2)),
  mill3grain: bp(rows(3, 'mill', { recipe: 'mill:grain' }, 'arm_fast', 2)),
  // seed sifters turning good radishes into cheap seed: they destroy value
  sift6: bp(rows(6, 'seed_sifter', { recipe: 'seeds:radish' })),
  // the critic's rigs: six columns of machine / arm / chest / arm / machine, nothing taking the goods away
  rig12: bp([0, 1, 2, 3, 4, 5].flatMap((x) => [piece('furnace', x, 0), piece('arm_basic', x, 1, 0), piece('chest_wood', x, 2), piece('arm_basic', x, 3, 2), piece('furnace', x, 4)])),
  rig12sift: bp([0, 1, 2, 3, 4, 5].flatMap((x) => [piece('seed_sifter', x, 0), piece('arm_basic', x, 1, 0), piece('chest_wood', x, 2), piece('arm_basic', x, 3, 2), piece('seed_sifter', x, 4)])),
  // nothing to feed it: a crock on its own, and a crock fed by a belt from nowhere
  lone: bp([piece('jar', 0, 0)]),
  belted: bp([piece('belt_1', 0, 0, 1), piece('belt_1', 1, 0, 1), piece('arm_basic', 2, 0, 1), piece('jar', 3, 0, 0, PICKLES), piece('arm_basic', 4, 0, 1), piece('shipping_crate', 5, 0)]),
  // a chest's goods carried straight to a crate: the line made nothing
  passthru: bp([piece('chest_wood', 0, 0), piece('arm_basic', 1, 0, 1), piece('shipping_crate', 2, 0)]),
  // a crock line whose chest also leaks its beans into a second crate: only the pickles count
  leak: bp([...row(0, 'jar', PICKLES), piece('arm_basic', 0, 1, 2), piece('shipping_crate', 0, 2)]),
};
type LineName = keyof typeof LINES;
const KNOW = ['r_arms', 'r_belts', 'r_preserves', 'r_brewing', 'r_power', 'r_milling', 'r_metallurgy', 'r_brass', 'r_glass', 'r_sawmill', 'r_spark', 'r_assembly', 'r_assembly2', 'r_seed_sifting', 'r_harvester'];
/** what the sample farm has at home (the plate stocks a chest only with goods your farm has) */
const HOME = ['cogbean', 'copper_ore', 'tin_ore', 'iron_ore', 'barley', 'grain', 'radish', 'tin_can'];

/** a year-1 farm that knows the machines and has the goods (the plate brings its know-how and stocks from its goods) */
function farm(seed = 1): Game {
  const g = new Game({ seed });
  for (const r of KNOW) g.research.done.add(r);
  for (const id of HOME) g.player.inv.add(key(id), 1);
  return g;
}

/** within 5% (and 3 coins) of a recorded score */
const near = (v: number, want: number) => expect(Math.abs(v - want), `${v} vs ${want}`).toBeLessThanOrEqual(Math.max(3, Math.abs(want) * 0.05));

describe('the Sprocket Fair test plate', () => {
  const real = farm();
  const score = Object.fromEntries(Object.entries(LINES).map(([n, b]) => [n, scoreBlueprint(real, b)])) as Record<LineName, number>;

  it('scores a line by the value it adds, in coins a minute over five minutes, the same however the run is stepped', () => {
    expect(BED_MINUTES).toBe(5);
    expect(BED_TICKS).toBe(5 * 60 * 60);
    for (const n of ['crock2', 'mill3', 'furnace2', 'gleaned', 'craned'] as const) expect(score[n], n).toBeGreaterThan(0);
    // more machines, more value
    expect(score.crock4).toBeGreaterThan(score.crock2);
    expect(score.mill3).toBeGreaterThan(score.mill1);
    // deterministic for the same blueprint
    for (const n of ['crock2', 'mill3'] as const) expect(scoreBlueprint(real, LINES[n])).toBe(score[n]);
    // the Professor's window steps the run in small chunks: the same score
    const run = startBed(real, LINES.mill3);
    while (run.ticks < BED_TICKS) stepBed(run, 17);
    expect(run.ticks).toBe(BED_TICKS);
    expect(bedScore(run)).toBe(score.mill3);
    // five minutes and no more
    stepBed(run, 600);
    expect(run.ticks).toBe(BED_TICKS);
  });

  it('counts what the line made less the stock it used up, at base prices by quality', () => {
    const run = startBed(real, LINES.crock2);
    stepBed(run, BED_TICKS);
    const t = bedTally(run);
    const pickle = key('pickles_cogbean'), bean = key('cogbean');
    const pickles = t.made.find((x) => x.k === pickle)!, beans = t.used.find((x) => x.k === bean)!;
    expect(pickles.coins).toBe(pickles.n * sellPrice(pickle));
    expect(beans.coins).toBe(-beans.n * sellPrice(bean));
    // two crocks, a minute a batch: four batches each done and the fifth nearly, its bean used
    expect(pickles.n).toBe(8);
    expect(beans.n).toBe(10);
    expect(t.cooking.length).toBe(1);
    expect(t.cooking[0].k).toBe(pickle);
    expect(t.cooking[0].n).toBeGreaterThan(1.9);
    // the batch cooking at the bell counts by how far along it is: its pickle done so far, its bean the rest
    const p = t.cooking[0].n / 2;
    const want = pickles.coins + beans.coins + 2 * (p * sellPrice(pickle) + (1 - p) * sellPrice(bean));
    expect(Math.abs(t.coins - want)).toBeLessThan(0.01);
    expect(bedScore(run)).toBe(Math.round(t.coins / 5));
    // the base price by quality: silver a quarter more (an artisan good keeps its input's quality)
    expect(sellPrice(key('pickles_cogbean', 1))).toBe(Math.round(sellPrice(pickle) * 1.25));
  });

  it("is a pure function of the goods: the market's saturation, drift and hot goods don't touch it", () => {
    const flooded = farm();
    const m = market(flooded);
    for (const id of ['pickles_cogbean', 'cogbean', 'copper_bar', 'copper_ore', 'barley_flour', 'barley']) m.sat[ITEMS.findIndex((d) => d.id === id)] = 900;
    for (const d of ITEMS) m.drift[d.cat] = 0.5;
    m.hot = ['pickles_cogbean', 'copper_bar', 'barley_flour'];
    for (const n of ['crock2', 'furnace2', 'mill3'] as const) expect(scoreBlueprint(flooded, LINES[n]), n).toBe(score[n]);
  });

  it("stocks the chests from the farm's goods, stokes the burners and powers the plate", () => {
    const run = startBed(real, LINES.furnace2);
    const chests = run.g.ents.all().filter((e) => e.def.kind === 'chest');
    expect(chests.length).toBe(2);
    for (const c of chests) expect(c.inv!.count(key('copper_ore'))).toBe(BED_STOCK);
    for (const f of run.g.ents.machines) expect(f.mach!.fuel?.n).toBe(BED_COAL);
    const mills = startBed(real, LINES.mill3);
    expect(mills.skipped).toEqual([]);
    stepBed(mills, 120);
    for (const m of mills.g.ents.machines) expect(m.sat).toBe(1);
    // a stack a chest: a furnace on copper (3 ore every 8 s) runs it dry before the bell, and the result says so
    stepBed(run, BED_TICKS);
    expect(ranDry(run)).toEqual(['copper_ore']);
    stepBed(mills, BED_TICKS);
    expect(ranDry(mills)).toEqual([]);
    // gold ore the farm never dug isn't stocked (the furnaces locked to gold make nothing), nor junk worth nothing
    expect(score.gold6).toBe(0);
    expect(startBed(real, LINES.gold6).missing).toEqual(['gold_ore']);
    expect(score.tincan6).toBe(0);
    expect(startBed(real, LINES.tincan6).missing).toEqual(['tin_can']);
    // ...but a farm with some gold has its gold line run
    const rich = farm();
    rich.player.inv.add(key('gold_ore'), 1);
    expect(scoreBlueprint(rich, LINES.gold6)).toBeGreaterThan(score.iron6);
    // the farm's goods: the bag, its structures, its fields, and what it ever shipped or found
    const g = new Game({ seed: 2 });
    const home = homeGoods(g);
    expect(home.has('cogbean')).toBe(true); // the keeper's beans
    expect(home.has('barley')).toBe(true); // the river works' grain bin
    expect(home.has('gold_ore')).toBe(false);
    goals(g).shipped.gold_ore = 1;
    expect(homeGoods(g).has('gold_ore')).toBe(true);
  });

  it('a gleaner or a crane picks from a basket of the crop it last picked, and the line pays for it', () => {
    // the keeper's gleaner, never yet restored, holds his last pick: a copy carries that crop
    const g = farm(3);
    const gl = g.ents.rootAt(OPENING.gleaner[0], OPENING.gleaner[1])!;
    expect(gl.def.kind).toBe('gleaner');
    expect(copyBlueprint(g, gl.x, gl.y, gl.x, gl.y).items[0].crop).toBe('cogbean');
    // working, it remembers the crop it last picked, basket or no
    delete gl.st.rust;
    gl.inv!.remove(key('cogbean'), 99);
    for (let i = 0; i < 600 && !gl.st.lastCrop; i++) g.tick();
    expect(gl.st.lastCrop).toBe('cogbean');
    gl.inv!.remove(key('cogbean'), 99);
    const copy = copyBlueprint(g, gl.x - 1, gl.y, gl.x, gl.y);
    expect(copy.items.find((it) => it.def === 'gleaner')?.crop).toBe('cogbean');
    // the drafting table keeps it through a save
    expect(addBlueprint(g, 'Gleaner', copy)).toBe(true);
    loadLib(g, JSON.parse(JSON.stringify(saveLib(g))));
    expect(drafting(g).lib.at(-1)!.bp.items.find((it) => it.def === 'gleaner')?.crop).toBe('cogbean');
    // on the plate it picks at its own rate into the crock, and the beans it used are paid for
    const run = startBed(real, LINES.gleaned);
    expect(run.noBasket).toBe(0);
    stepBed(run, BED_TICKS);
    const t = bedTally(run);
    expect(t.used.find((x) => kDef(x.k).id === 'cogbean')?.n).toBe(5);
    expect(t.made.find((x) => kDef(x.k).id === 'pickles_cogbean')?.n).toBe(4);
    expect(score.gleaned).toBe(score.crock1);
    // a crane does the same on the plate's power
    expect(score.craned).toBe(score.crock1);
    // one that never picked has no basket: its line makes nothing
    const none = startBed(real, picker('gleaner'));
    expect(none.noBasket).toBe(1);
    stepBed(none, BED_TICKS);
    expect(bedScore(none)).toBe(0);
  });

  it('scores nothing for goods only carried; leaves off a machine whose goods go nowhere; scores below zero for destroying value', () => {
    expect(score.lone).toBe(0);
    expect(score.belted).toBe(0);
    expect(score.passthru).toBe(0);
    const run = startBed(real, LINES.leak);
    stepBed(run, BED_TICKS);
    const crate = run.g.ents.all().find((e) => e.def.kind === 'shipbin' && e.y === run.g.ents.all().find((c) => c.def.kind === 'chest')!.y + 2)!;
    expect(crate.inv!.count(key('cogbean'))).toBeGreaterThan(0);
    expect(score.leak).toBe(score.crock1);
    // the critic's rigs: twelve furnaces or sifters, nothing taking their goods away, are left off
    for (const n of ['rig12', 'rig12sift'] as const) {
      expect(score[n], n).toBe(0);
      expect(startBed(real, LINES[n]).idle.length).toBe(12);
    }
    expect(startBed(real, LINES.lone).idle).toEqual(['jar']);
    // sifters turning radishes into seed, arms taking the seed away: they destroy value, and the score says so
    expect(score.sift6).toBeLessThan(0);
    // seed is stock, not goods: cranberry seed (worth more than the berry at the shop) scores nothing either
    const berries = farm(5);
    berries.player.inv.add(key('cranberry'), 1);
    expect(scoreBlueprint(berries, bp(rows(6, 'seed_sifter', { recipe: 'seeds:cranberry' })))).toBeLessThan(0);
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
    // the sample lines' scores (coins a minute of value added, year 1, no perks), as recorded in src/sim/fair.ts
    const recorded: Partial<Record<LineName, number>> = {
      crock1: 68, crock2: 136, crock3: 204, crock4: 271, crock6: 407, gleaned: 68, craned: 68,
      furnace1: 276, furnace2: 552, furnace6: 1656, tin6: 1933, iron6: 2522,
      mill1: 373, mill3: 1119, mill3grain: 2138, sift6: -1355,
    };
    for (const [n, v] of Object.entries(recorded)) near(score[n as LineName], v);
    const [prof, bram, juniper] = fairEntries(1).map((e) => e.score);
    expect(fairEntries(1).map((e) => e.who)).toEqual(['ottoline', 'bram', 'juniper']);
    expect([prof, bram, juniper]).toEqual([50, 250, 2000]);
    // any first real line beats the Professor: one crock, a gleaner's crock
    expect(score.crock1).toBeGreaterThan(prof);
    expect(score.gleaned).toBeGreaterThan(prof);
    // a dense spring line beats Bram: four crocks, a furnace row, a grist mill (three crocks don't)
    expect(score.crock3).toBeLessThan(bram);
    for (const n of ['crock4', 'furnace1', 'mill1'] as const) expect(score[n], n).toBeGreaterThan(bram);
    // Juniper waits for the Mill era: grist mills on grain (or six furnaces on iron from the Frost); no
    // crock line, copper or tin, or barley mills beat Juniper
    for (const n of ['crock6', 'furnace6', 'tin6', 'mill3'] as const) expect(score[n], n).toBeLessThan(juniper);
    for (const n of ['mill3grain', 'iron6'] as const) expect(score[n], n).toBeGreaterThan(juniper);
    expect(fairPlace(1, score.mill3grain)).toEqual({ beaten: 3, byHalf: false });
    // the entries come back bigger each year, until the sixth
    for (let y = 2; y <= FAIR_TOP_YEAR; y++) fairEntries(y).forEach((e, i) => expect(e.score).toBeGreaterThan(fairEntries(y - 1)[i].score));
    expect(fairEntries(FAIR_TOP_YEAR + 3)).toEqual(fairEntries(FAIR_TOP_YEAR));
    expect(FAIR_ENTRIES.every((e) => e.what.length > 0)).toBe(true);
  });

  it("places the pacing bot's own spring-13 lines as the entries mean to", () => {
    // seed 2024 (seeds 7 and 99 score the same windows alike)
    const g = new Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    for (let d = 0; d < 12; d++) bot.playDay();
    expect([g.time.season, g.time.day]).toEqual([0, 13]);
    const [prof, bram, juniper] = fairEntries(1).map((e) => e.score);
    const copy = (x: number, y: number, w = 6, h = 6) => scoreBlueprint(g, copyBlueprint(g, x, y, x + w - 1, y + h - 1));
    // the keeper's line copied round its crocks (the farm's crate comes along as a crate)
    const keeper = copy(OPENING.jar[0] - 5, OPENING.jar[1] - 3);
    // the keeper's river mill copied with its bin and meal chest (the wheel stays: it wants the river)
    const river = copy(RIVER.bin[0], RIVER.mill[1] - 2);
    // the bot's own first line: chest, arm, crock, arm, chest
    const l1 = g.ents.get(bot.lineIn!)!;
    const own = copy(l1.x, l1.y, 5, 1);
    near(keeper, 68);
    near(river, 373);
    near(own, 68);
    for (const s of [keeper, river, own]) {
      expect(s).toBeGreaterThan(prof);
      expect(s).toBeLessThan(juniper);
    }
    expect(own).toBeLessThan(bram);
    expect(river).toBeGreaterThan(bram);
  }, 120000);

  it('pays the candle rewards once a save and a prize each year, the Gilded Clock from year 2, and nothing for no value', () => {
    const g = new Game({ seed: 9 });
    const m0 = g.player.money, fest0 = g.counters.festivals ?? 0;
    const tickets = () => g.player.inv.count(key('ticket'));
    const [prof, , juniper] = fairEntries(1).map((e) => e.score);
    // a line that adds no value, or destroys it, wins nothing (not even the tokens for trying)
    expect(fairResult(g, -708)).toMatchObject({ beaten: 0, candles: [], tickets: 0, money: 0, best: false });
    expect(fairResult(g, 0)).toMatchObject({ candles: [], tickets: 0, money: 0, best: false });
    expect(g.player.money).toBe(m0);
    expect(tickets()).toBe(0);
    expect(g.counters.best_f_fair).toBeUndefined();
    // a better run the same day: the purse (2,500) and the year's first tier (5 tokens, 300 coins)
    const r1 = fairResult(g, prof + 10);
    expect(r1).toMatchObject({ beaten: 1, candles: [1], tickets: 5, money: 300, best: true });
    expect(g.player.money).toBe(m0 + 2500 + 300);
    expect(g.counters.festivals).toBe(fest0 + 1);
    // all three: the Lantern and the Medal, and what the top tier adds to the first
    const r2 = fairResult(g, juniper + 10);
    expect(r2).toMatchObject({ beaten: 3, candles: [2, 3], tickets: 15, money: 1200 });
    expect(tickets()).toBe(20);
    expect(g.flags.has('founders_medal')).toBe(true);
    expect(g.player.inv.count(key('f_lantern'))).toBe(1);
    // half again the top entry wins no Gilded Clock in the first year, and the same prize pays nothing again
    expect(CLOCK_YEAR).toBe(2);
    expect(fairResult(g, juniper * 2)).toMatchObject({ beaten: 3, byHalf: true, candles: [], tickets: 0, money: 0 });
    expect(g.flags.has('candle_4')).toBe(false);
    expect(g.counters.fair_ribbons).toBe(2);
    expect(g.counters.festivals).toBe(fest0 + 1);
    // the next year: the year's prize again, and half again the top entry wins the Gilded Clock and 20,000
    g.time.year = 2;
    const top2 = Math.max(...fairEntries(2).map((e) => e.score));
    const m2 = g.player.money;
    expect(fairResult(g, Math.ceil(top2 * 1.5))).toMatchObject({ beaten: 3, byHalf: true, candles: [4], tickets: 20, money: 1500 });
    expect(g.player.inv.count(key('f_gilded_clock'))).toBe(1);
    expect(g.player.money).toBe(m2 + 20000 + 1500);
    // the Blue Ribbon and Going, Going, Gone are achievements with icons that exist
    for (const id of ['fair_ribbon', 'auction_win', 'festivals']) {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      expect(a).toBeTruthy();
      expect(ITEM_BY_ID.has(a.icon)).toBe(true);
    }
  });
});

/** a fresh game on a festival day at a time, its festival's morning run and the festival ticked on */
function onDay(seed: number, season: number, day: number, min = 10 * 60): Game {
  const g = new Game({ seed });
  g.time.season = season as Game['time']['season'];
  g.time.day = day;
  g.time.min = min;
  SYSTEMS.find((s) => s.name === 'festivals')!.dayStart!(g);
  for (let i = 0; i < 31; i++) g.tick();
  return g;
}

describe('the four festivals', () => {
  it('are on their days with their hosts (none in Clockwork Rush)', () => {
    const by = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));
    expect(FESTIVALS.map((f) => f.id).sort()).toEqual(['f_fair', 'f_firefly', 'f_haul', 'f_skate']);
    expect(by.f_fair).toMatchObject({ name: 'Sprocket Fair', season: 0, day: 13, start: 540, end: 1080, host: 'ottoline', activity: 'fair' });
    expect(by.f_firefly).toMatchObject({ name: 'Lantern Night', season: 1, day: 20, host: 'sable', activity: 'firefly' });
    expect(by.f_haul).toMatchObject({ name: 'Harvest Haul', season: 2, day: 15, start: 540, end: 1080, host: 'tobias', activity: 'haul' });
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

  it("puts the Harvest Haul on fall 15, a Monday every year (the day the week's standing orders go up), with nothing else that day", () => {
    const g = new Game({ seed: 3 });
    for (const year of [1, 2, 5]) {
      g.time.year = year;
      g.time.season = 2;
      g.time.day = 15;
      expect(g.weekday, `year ${year}`).toBe(0);
      expect(festivalToday(g)?.id).toBe('f_haul');
    }
    expect(FESTIVALS.filter((f) => f.season === 2 && f.day === 15).length).toBe(1);
    expect(NPCS.filter((n) => n.birthday.season === 2 && n.birthday.day === 15)).toEqual([]);
  });

  it('opens the Fair at the first F at the Professor, and her key bubble says so; the Mayor opens it too', () => {
    const g = onDay(3, 0, 13);
    expect(g.sys.festivals.active?.id).toBe('f_fair');
    const opened = () => g.events.some((e) => e.t === 'ui' && e.open === 'festival' && e.arg === 'f_fair');
    const prof = npcSys(g).byId.get('ottoline')!, mayor = npcSys(g).byId.get('tobias')!;
    // at her place by the plate: the bubble over her names the Fair, whatever you hold
    g.player.where = 'world';
    g.player.sel = 0;
    prof.visible = true;
    [prof.x, prof.y] = [FAIR_SPOTS.ottoline[0] + 0.5, FAIR_SPOTS.ottoline[1] + 0.5];
    expect(promptAt(g, FAIR_SPOTS.ottoline[0], FAIR_SPOTS.ottoline[1])?.verb).toBe('Enter the Sprocket Fair');
    // the first F, before any chat today, opens her plate (no chat first)
    g.events.length = 0;
    expect(prof.talked).toBe(false);
    talkTo(g, prof);
    expect(opened()).toBe(true);
    expect(g.events.some((e) => e.t === 'ui' && e.open === 'dialog')).toBe(false);
    // the Mayor opens it straight away too (as he opened Kite Day)
    g.events.length = 0;
    talkTo(g, mayor);
    expect(opened()).toBe(true);
    expect(mayor.talked).toBe(false);
    // the Haul's Mayor opens it at once, on fall 15
    const h = onDay(3, 2, 15);
    talkTo(h, npcSys(h).byId.get('tobias')!);
    expect(h.events.some((e) => e.t === 'ui' && e.open === 'festival' && e.arg === 'f_haul')).toBe(true);
  });

  it('stands on the square: the plate and the entries clear of everything, the hosts by them and nobody on them', () => {
    const g = onDay(4, 0, 13);
    const sq = g.map.loc('square');
    // every tile the plate and the entries take: on the plaza, in the open, and taken once
    const taken = new Map<string, number>();
    const take = (x: number, y: number) => taken.set(`${x},${y}`, (taken.get(`${x},${y}`) ?? 0) + 1);
    for (let y = FAIR_PLATE.y; y < FAIR_PLATE.y + FAIR_PLATE.h; y++) for (let x = FAIR_PLATE.x; x < FAIR_PLATE.x + FAIR_PLATE.w; x++) take(x, y);
    for (const l of FAIR_ENTRY_LINES)
      for (const p of l.pieces) {
        const [w, h] = STRUCT_BY_ID.get(p.def)!.size;
        for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + w; x++) take(x, y);
      }
    expect(taken.size).toBe(36 + 4 + 4 + 1 + 1 + 1 + 1 + 1);
    for (const [xy, n] of taken) {
      const [x, y] = xy.split(',').map(Number);
      expect(n, xy).toBe(1);
      expect(fairgroundTile(x, y), xy).toBe(true);
      expect(g.map.buildingAt[g.map.idx(x, y)], xy).toBeFalsy();
      expect(g.map.obj[g.map.idx(x, y)], xy).toBeFalsy();
      expect(Math.abs(x - sq[0]) <= 11 && Math.abs(y - sq[1]) <= 8, xy).toBe(true);
    }
    expect(FAIR_ENTRY_LINES.map((l) => l.who).sort()).toEqual(['bram', 'juniper', 'ottoline']);
    // on Fair day the Professor waits by the plate, the Mayor by her, Bram and Juniper by their lines, and nobody stands on them
    for (const [id, xy] of Object.entries(FAIR_SPOTS)) expect(g.map.loc('fest_' + id)).toEqual(xy);
    for (const n of NPCS) {
      const [x, y] = g.map.loc('fest_' + n.id);
      expect(fairgroundTile(x, y), n.id).toBe(false);
    }
    // on another festival's day the ring is as it always was
    const other = onDay(4, 1, 20, 19 * 60);
    expect(other.map.loc('fest_ottoline')).not.toEqual(FAIR_SPOTS.ottoline);
  });

  it('is told ahead: the Professor writes from spring 9 and the Orders board says so; the Haul from fall 12', () => {
    const g = new Game({ seed: 5, name: 'Robin', farmName: 'Willow' });
    const letters = () => [...goals(g).mail, ...(goals(g).queue ?? [])];
    while (g.dayIndex < 7) sleep(g);
    expect([g.time.season, g.time.day]).toEqual([0, 8]);
    expect(letters().some((m) => m.id === 'fair_1')).toBe(false);
    expect(festivalNotice(g)).toBe(null);
    sleep(g);
    const letter = letters().find((m) => m.id === 'fair_1')!;
    expect(letter).toBeTruthy();
    expect(letter.from).toBe('ottoline');
    expect(letter.text).toContain('6x6 plate, chests at its start');
    expect(letter.text).toContain(fairEntries(1)[2].score.toLocaleString('en-US'));
    expect(letter.text.includes(String.fromCharCode(0x2014))).toBe(false);
    expect(festivalNotice(g)).toBe('The Sprocket Fair on the 13th: bring a line that fits a 6x6 plate, chests at its start.');
    // one letter a year, however many mornings it's in the window
    for (let i = 0; i < 3; i++) sleep(g);
    expect(letters().filter((m) => m.id === 'fair_1').length).toBe(1);
    sleep(g);
    expect(g.time.day).toBe(13);
    expect(festivalNotice(g)).toContain('is on today');
    sleep(g);
    expect(festivalNotice(g)).toBe(null);
    // the Haul: from fall 12, on the Monday
    g.time.season = 2;
    g.time.day = 11;
    expect(festivalNotice(g)).toBe(null);
    g.time.day = 12;
    expect(festivalNotice(g)).toBe('The Harvest Haul on Monday the 15th: every standing order pays double that day.');
    g.time.day = 15;
    expect(festivalNotice(g)).toContain('every standing order pays double');
    g.time.day = 16;
    expect(festivalNotice(g)).toBe(null);
    // none in Clockwork Rush
    g.time.season = 0;
    g.time.day = 10;
    g.mode = 'rush';
    expect(festivalNotice(g)).toBe(null);
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
    const r = fairResult(g2, fairEntries(1)[0].score + 10);
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
    day(2, 15);
    expect(haulToday(g)).toBe(true);
    expect(payFor(g, o, pickle, 3)).toBe(900);
    // silver doubles on top
    expect(payFor(g, o, key('pickles_cogbean', 1), 1)).toBe(600);
    // a Today ask isn't a standing order
    expect(payFor(g, { ...o, kind: 'today' }, pickle, 3)).toBe(450);
    for (const [s, d] of [[2, 14], [2, 16], [0, 13], [1, 15]]) {
      day(s, d);
      expect(haulToday(g)).toBe(false);
      expect(payFor(g, o, pickle, 3)).toBe(450);
    }
    // by hand, at Rowan's
    day(2, 15);
    g.player.inv.add(pickle, 4);
    const m0 = g.player.money;
    expect(handDeliver(g, 'rowan', pickle)).toBe(true);
    expect(g.player.money - m0).toBe(4 * 300);
    day(2, 16);
    g.player.inv.add(pickle, 4);
    const m1 = g.player.money;
    handDeliver(g, 'rowan', pickle);
    expect(g.player.money - m1).toBe(4 * 150);
    // by the post: a crate tagged for Rowan
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'rowan';
    day(2, 15);
    bin.inv!.add(pickle, 5);
    expect(consign(g, [bin]).total).toBe(5 * 300);
    day(2, 18);
    bin.inv!.add(pickle, 5);
    expect(consign(g, [bin]).total).toBe(5 * 150);
    // Clockwork Rush has no festivals
    day(2, 15);
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
