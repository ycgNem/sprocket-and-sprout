// Exports (2.1, DECISIONS #173): the Harbor's works project, the Copper Gull's manifests in crazy
// quantities, loading by hand and by a crate tagged for the Harbor, the bonus for a full manifest,
// sailing with what's aboard, standing and ranks, and the state across a save.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { HARBOR_RANKS, IN_PORT_DAYS, AT_SEA_DAYS, LINE_VALUE, REP_FULL, REP_HALF, linesAt } from '../src/data/exports';
import { PROJECT_BY_ID } from '../src/data/goals';
import { exportsState, harborRank, loadFromBag, manifest, manifestValue, shipView } from '../src/sim/systems/exports';
import { boardHandIn, orders, tagChoices } from '../src/sim/systems/orders';
import { inSeason } from '../src/sim/seasonal';
import { shipAll } from '../src/sim/systems/economy';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
/** a late-game farm: the Tram runs, and its lines have made bars, gears, bread and preserves */
function lateFarm(seed = 4) {
  const g = new Game({ seed });
  g.flags.add('tram');
  for (const id of ['copper_bar', 'iron_bar', 'tin_bar', 'brass_bar', 'gold_bar', 'copper_gear', 'brass_gear', 'iron_plate', 'spring', 'glass', 'plank', 'rope', 'bread', 'cheese', 'pickles_cogbean', 'tea', 'cloth', 'ale'])
    g.stats.add(key(id), 50);
  return g;
}
/** open the Harbor as its works project would, and run to the ship's first call */
function openHarbor(g: Game) {
  g.flags.add('harbor');
  for (let i = 0; i < 61; i++) g.tick();
  expect(exportsState(g).opened).toBe(true);
  sleep(g);
  return manifest(g)!;
}

describe('the Harbor', () => {
  it('is a works project after the Tram, and opening it brings a letter and the ship next dawn', () => {
    const p = PROJECT_BY_ID.get('p_harbor')!;
    expect(p.after).toEqual(['flag:tram']);
    expect(p.reward.flag).toBe('harbor');
    expect(p.money).toBeGreaterThanOrEqual(20000);
    const g = lateFarm();
    // the board posts it once the tram runs
    sleep(g);
    expect(orders(g).open.some((o) => o.kind === 'works' && o.def === 'p_harbor')).toBe(true);
    expect(manifest(g)).toBeNull();
    g.flags.add('harbor');
    for (let i = 0; i < 61; i++) g.tick();
    const s = exportsState(g);
    expect(s.opened).toBe(true);
    expect(s.ship).toBe('away');
    expect(g.sys.goals.mail.concat(g.sys.goals.queue ?? []).some((m: { id: string }) => m.id === 'harbor_open')).toBe(true);
    sleep(g);
    expect(s.ship).toBe('port');
    expect(manifest(g)).not.toBeNull();
    expect(shipView(g)).not.toBeNull();
    // the crate can be tagged for the Harbor, ship in or not
    expect(tagChoices(g).some((c) => c.cust === 'harbor')).toBe(true);
  });

  it("a manifest asks for crazy quantities of goods in season that the farm has made, at a premium", () => {
    const g = lateFarm();
    const o = openHarbor(g);
    expect(o.kind).toBe('export');
    expect(o.lines.length).toBe(linesAt(0));
    expect(new Set(o.lines.map((l) => l.spec)).size).toBe(o.lines.length);
    for (const l of o.lines) {
      expect(inSeason(l.spec, g.time.season), l.spec).toBe(true);
      expect((g.stats.series.get(key(l.spec) >> 2)?.totalProd ?? 0) > 0, l.spec).toBe(true);
      // about LINE_VALUE coins of goods at their base price: hundreds or thousands of them
      const base = (l.unit ?? 0) / 1.4;
      expect(l.n * base).toBeGreaterThan(LINE_VALUE * 0.8);
      expect(l.n).toBeGreaterThanOrEqual(80);
      expect(l.unit!).toBeGreaterThan(base);
    }
    expect(o.due).toBe(g.dayIndex + IN_PORT_DAYS - 1);
    expect(o.pay!).toBeGreaterThan(0);
  });

  it('goods pay as they go aboard (by hand and by a tagged crate); a full manifest pays its bonus and sails at dawn', () => {
    const g = lateFarm();
    const o = openHarbor(g);
    const os = orders(g);
    const [a, b, ...rest] = o.lines;
    // by hand: half of the first line from the bag
    g.player.inv.add(key(a.spec), Math.floor(a.n / 2));
    const money0 = g.player.money;
    expect(loadFromBag(g, o)).toBe(Math.floor(a.n / 2));
    expect(g.player.money - money0).toBe(a.unit! * Math.floor(a.n / 2));
    // by the post: a crate tagged for the Harbor
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'harbor';
    bin.inv!.add(key(b.spec), b.n + 7);
    const post = shipAll(g);
    expect(b.have).toBe(b.n);
    expect(post.total).toBeGreaterThanOrEqual(b.unit! * b.n);
    // what the manifest didn't take stays in the crate (it never goes to market)
    expect(bin.inv!.countId(b.spec)).toBe(7);
    // the rest by the board's Hand in, and the first line's other half
    g.player.inv.add(key(a.spec), a.n);
    for (const l of rest) g.player.inv.add(key(l.spec), l.n);
    const before = g.player.money;
    boardHandIn(g, o);
    expect(o.done).toBe(true);
    const { total } = manifestValue(o);
    expect(manifestValue(o).aboard).toBe(total);
    // the bonus came with the last of it
    expect(g.player.money - before).toBeGreaterThan(o.pay!);
    expect(os.rep.harbor).toBe(REP_FULL);
    expect(harborRank(g)).toBe(1);
    // it sails the next dawn, then calls again after its days at sea
    sleep(g);
    const s = exportsState(g);
    expect(s.ship).toBe('away');
    expect(manifest(g)).toBeNull();
    expect(s.full).toBe(1);
    expect(s.voyages).toBe(1);
    expect(s.log[0].share).toBe(1);
    for (let d = 0; d < AT_SEA_DAYS; d++) sleep(g);
    expect(s.ship).toBe('port');
    expect(manifest(g)!.port).not.toBe(s.log[0].port);
  });

  it('a manifest not loaded in full sails after its week with what is aboard: standing for half of it', () => {
    const g = lateFarm(9);
    const o = openHarbor(g);
    const os = orders(g);
    // a bit over half of it by value
    for (const l of o.lines) l.have = Math.ceil(l.n * 0.55);
    for (let d = 0; d < IN_PORT_DAYS - 1; d++) {
      sleep(g);
      expect(manifest(g)).toBe(o);
    }
    sleep(g);
    expect(manifest(g)).toBeNull();
    expect(os.rep.harbor).toBe(REP_HALF);
    expect(exportsState(g).log[0].share).toBeGreaterThan(0.5);
    // a crate tagged for the Harbor holds its goods while the ship is at sea
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'harbor';
    bin.inv!.add(key('copper_bar'), 30);
    shipAll(g);
    expect(bin.inv!.countId('copper_bar')).toBe(30);
  });

  it('a new rank writes a letter with coins, and asks bigger manifests with more lines', () => {
    const g = lateFarm();
    openHarbor(g);
    const os = orders(g);
    const money0 = g.player.money;
    os.rep.harbor = HARBOR_RANKS[2].rep;
    // standing moves at a full manifest or a sailing: run one sailing
    for (let d = 0; d < IN_PORT_DAYS; d++) sleep(g);
    expect(harborRank(g)).toBe(2);
    expect(g.player.money - money0).toBeGreaterThanOrEqual(HARBOR_RANKS[1].coins + HARBOR_RANKS[2].coins);
    const mail = g.sys.goals.mail.concat(g.sys.goals.queue ?? []).map((m: { id: string }) => m.id);
    expect(mail).toContain('harbor_rank_1');
    expect(mail).toContain('harbor_rank_2');
    for (let d = 0; d < AT_SEA_DAYS; d++) sleep(g);
    const o = manifest(g)!;
    expect(o.lines.length).toBe(linesAt(2));
    expect(linesAt(2)).toBe(4);
  });

  it('keeps its ship, manifest and record across a save', () => {
    const g = lateFarm();
    const o = openHarbor(g);
    o.lines[0].have = 12;
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    const s2 = exportsState(g2);
    expect(s2.ship).toBe('port');
    expect(s2.opened).toBe(true);
    const o2 = manifest(g2)!;
    expect(o2.port).toBe(o.port);
    expect(o2.lines.map((l) => [l.spec, l.n, l.unit])).toEqual(o.lines.map((l) => [l.spec, l.n, l.unit]));
    expect(o2.lines[0].have).toBe(12);
  });
});
