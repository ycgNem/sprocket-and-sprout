// The 2.2 economy pass (DECISIONS #177, from the 2.1.1 playtest): no crop several times the next
// best, preserves that add a share of the crop's price and not a flat sum, exports at about the
// market's price with each port's keepsake and crate for a manifest loaded in full, the town's own
// works to spend coins on in the mid-game, and a Governor worth picking against the Engineer.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { CROPS } from '../src/data/crops';
import { ITEM_BY_ID, preservePrice } from '../src/data/items';
import { EXPORT_PORTS, EXPORT_PREMIUM, FULL_BONUS, HARBOR_RANKS, LINE_MACHINE_DAYS, LINE_VALUE, linesAt } from '../src/data/exports';
import { FURNITURE } from '../src/data/furniture';
import { PROJECT_BY_ID } from '../src/data/goals';
import { PERK_BY_ID } from '../src/data/perks';
import { exportsState, lineSize, manifest, manifestValue, premiumAt } from '../src/sim/systems/exports';
import { boardHandIn, orders, payFor, FREIGHT_BONUS, type Order } from '../src/sim/systems/orders';
import { satFactor, sellStack, unitPrice } from '../src/sim/systems/economy';
import { GOVERNOR_FUEL, GOVERNOR_SAT } from '../src/sim/systems/machines';
import { cropTable } from '../scripts/croptable';

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

describe('crops', () => {
  it('no crop is several times the next best, raw or preserved (cogbean was four times the field)', () => {
    const rows = cropTable();
    const raw = rows.map((r) => r.raw), kept = rows.filter((r) => r.keptAs).map((r) => r.kept);
    expect(Math.max(...raw)).toBeLessThan(median(raw) * 3);
    expect(Math.max(...kept)).toBeLessThan(median(kept) * 2.5);
    // every crop earns its seed back
    for (const r of rows) expect(r.raw, r.id).toBeGreaterThan(0);
    // the starter crop is a good one, not the only one: within a third of the next ordinary crop
    const by = [...rows].sort((a, b) => b.kept - a.kept);
    const cog = rows.find((r) => r.id === 'cogbean')!;
    const next = by.find((r) => r.id !== 'cogbean' && r.id !== 'glowmelon')!;
    expect(cog.kept).toBeLessThan(next.kept * 1.34);
  });

  it("a preserve adds a share of the crop's price (was a flat 40, which made cheap crops the best jars)", () => {
    expect(preservePrice(20)).toBe(53);
    expect(preservePrice(200)).toBe(395);
    for (const c of CROPS) {
      const p = ITEM_BY_ID.get(`pickles_${c.produce}`) ?? ITEM_BY_ID.get(`jam_${c.produce}`);
      if (!p) continue;
      expect(p.price, p.id).toBe(preservePrice(c.price));
      // always worth the crock: a jar sells for more than the crop in it
      expect(p.price).toBeGreaterThan(c.price * 1.5);
    }
  });
});

/** a late-game farm with the Harbor open and the ship in */
function harborFarm(seed = 4) {
  const g = new Game({ seed });
  g.flags.add('tram');
  for (const id of ['copper_bar', 'iron_bar', 'tin_bar', 'brass_bar', 'gold_bar', 'copper_gear', 'brass_gear', 'iron_plate', 'spring', 'glass', 'plank', 'rope', 'bread', 'cheese', 'pickles_cogbean', 'tea', 'cloth', 'ale'])
    g.stats.add(key(id), 50);
  g.flags.add('harbor');
  for (let i = 0; i < 61; i++) g.tick();
  sleep(g);
  return g;
}
function fill(g: Game, o: Order) {
  for (const l of o.lines) g.player.inv.add(key(l.spec), l.n - l.have);
  boardHandIn(g, o);
  expect(o.done).toBe(true);
}
const letters = (g: Game) => g.sys.goals.mail.concat(g.sys.goals.queue ?? []) as { id: string; title: string; items?: { item: string; n: number }[] }[];

describe('exports', () => {
  it("pay about the market's price: a first manifest in full is no longer worth a year of farming", () => {
    expect(EXPORT_PREMIUM).toBe(1);
    expect(premiumAt(HARBOR_RANKS.length - 1)).toBeLessThanOrEqual(1.25);
    const g = harborFarm();
    const o = manifest(g)!;
    const { total } = manifestValue(o);
    expect(total).toBeLessThan(LINE_VALUE * linesAt(0) * 1.1);
    expect(o.pay!).toBe(Math.round(total * FULL_BONUS));
    expect(total + o.pay!).toBeLessThan(120000);
    for (const l of o.lines) expect(Math.abs(l.unit! - ITEM_BY_ID.get(l.spec)!.price)).toBeLessThanOrEqual(1);
  });

  it('a line is never more than a few machines can make in the week (honey was 125 machine-days, copper 4)', () => {
    const DAY = 1200 * 0.7 + 240 * 0.7;
    // fast goods are sized by value, as before
    expect(lineSize('copper_bar', 0)).toBe(Math.round(LINE_VALUE / ITEM_BY_ID.get('copper_bar')!.price));
    // slow ones by the machine time: honey takes 420 s a jar
    expect(lineSize('honey', 0) * 420).toBeLessThanOrEqual(LINE_MACHINE_DAYS * DAY * 1.05);
    expect(lineSize('honey', 0)).toBeGreaterThan(20);
    expect(lineSize('wine_grape', 0) * 180).toBeLessThanOrEqual(LINE_MACHINE_DAYS * DAY * 1.05);
    // and every line grows with the rank
    for (const id of ['copper_bar', 'honey', 'pickles_cogbean', 'bread']) expect(lineSize(id, 5), id).toBeGreaterThan(lineSize(id, 0) * 3);
  });

  it('every port has a keepsake found nowhere else and a crate of real goods', () => {
    const keeps = new Set<string>();
    for (const p of EXPORT_PORTS) {
      const f = FURNITURE.find((x) => x.id === p.keepsake);
      expect(f, p.id).toBeTruthy();
      expect(f!.price).toBe(0);
      expect(f!.shop).toBeUndefined();
      keeps.add(p.keepsake);
      expect(p.crate.length).toBeGreaterThan(0);
      for (const c of p.crate) expect(ITEM_BY_ID.has(c.item), c.item).toBe(true);
      expect(p.thanks.length).toBeGreaterThan(10);
    }
    expect(keeps.size).toBe(EXPORT_PORTS.length);
  });

  it("a manifest loaded in full brings the port's keepsake once, and its crate every time", () => {
    const g = harborFarm();
    const s = exportsState(g);
    const o = manifest(g)!;
    const port = EXPORT_PORTS.find((p) => p.id === o.port)!;
    fill(g, o);
    expect(s.gifts).toEqual([port.id]);
    const first = letters(g).filter((m) => m.id.startsWith('harbor_thanks_' + port.id));
    expect(first.length).toBe(1);
    expect(first[0].items!.some((i) => i.item === port.keepsake)).toBe(true);
    for (const c of port.crate) expect(first[0].items!.some((i) => i.item === c.item && i.n === c.n)).toBe(true);
    expect(g.counters.port_keepsakes).toBe(1);
    // the same port again (as if it called a second time): the crate, not a second keepsake
    s.ship = 'away';
    orders(g).open = orders(g).open.filter((x) => x !== o);
    const again = { ...o, uid: o.uid + 1000, done: false, lines: o.lines.map((l) => ({ ...l, have: 0 })) } as Order;
    orders(g).open.push(again);
    s.ship = 'port';
    fill(g, again);
    expect(s.gifts).toEqual([port.id]);
    const all = letters(g).filter((m) => m.id.startsWith('harbor_thanks_' + port.id));
    expect(all.length).toBe(2);
    expect(all[1].items!.some((i) => i.item === port.keepsake)).toBe(false);
    expect(all[1].items!.length).toBe(port.crate.length);
  });
});

describe("the town's own works", () => {
  it('one after each town keystone, each mostly coins', () => {
    const want: [string, string, number][] = [['p_market', 'flag:town_mill', 10000], ['p_freight', 'flag:waterworks', 20000], ['p_guildhall', 'flag:tram', 40000]];
    for (const [id, after, money] of want) {
      const p = PROJECT_BY_ID.get(id)!;
      expect(p, id).toBeTruthy();
      expect(p.after).toEqual([after]);
      expect(p.money!).toBeGreaterThanOrEqual(money);
      expect(p.reward.flag).toBeTruthy();
      for (const i of p.items) expect(ITEM_BY_ID.has(i.item), i.item).toBe(true);
    }
  });

  it('the Market Hall: the same shipment sags the price less', () => {
    const sag = (hall: boolean) => {
      const g = new Game({ seed: 2 });
      if (hall) g.flags.add('market_hall');
      const k = key('pickles_cogbean');
      const before = unitPrice(g, k);
      sellStack(g, k, 150);
      return { before, f: satFactor(g, k >> 2) };
    };
    const plain = sag(false), hall = sag(true);
    expect(plain.f).toBeLessThan(1);
    expect(hall.f).toBeGreaterThan(plain.f);
    expect(hall.before).toBe(plain.before);
  });

  it('the Freight Office: standing orders pay 15% more, and nothing else does', () => {
    const g = new Game({ seed: 2 });
    const standing = { kind: 'standing', unit: 100, lines: [{ spec: 'bread', n: 10, have: 0 }] } as unknown as Order;
    const today = { kind: 'today', unit: 100, lines: [{ spec: 'bread', n: 10, have: 0 }] } as unknown as Order;
    const k = key('bread');
    expect(payFor(g, standing, k, 10)).toBe(1000);
    g.flags.add('freight_office');
    expect(payFor(g, standing, k, 10)).toBe(Math.round(100 * (1 + FREIGHT_BONUS)) * 10);
    expect(payFor(g, today, k, 10)).toBe(1000);
  });
});

describe('the Governor', () => {
  it('is the thrifty pick: a third more from fuel, full speed down to 60% power', () => {
    expect(GOVERNOR_FUEL).toBeCloseTo(4 / 3);
    expect(GOVERNOR_SAT).toBe(0.6);
    expect(PERK_BY_ID.get('clockmaker')!.desc).toMatch(/fuel/);
    expect(PERK_BY_ID.get('clockmaker')!.desc).toMatch(/60%/);
  });
});
