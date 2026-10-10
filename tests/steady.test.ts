// Steady supply (Phase 5, the critic's leftover): the Kettle's Cellar, Dairy Day and the Bakery
// Window were one-off baskets; now each asks for a day's share on each of three days, at most one a
// day, which a line feeding a crate tagged for the Council fills by the post.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { FRUIT_LIST } from '../src/data/items';
import { PROJECT_BY_ID } from '../src/data/goals';
import { boardHandIn, bagHelps, openOrder, orders, shareIn, steadyOf, worksDone } from '../src/sim/systems/orders';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
const wine = `wine_${FRUIT_LIST[0][0]}`;

describe('steady supply works', () => {
  it('the three last baskets are steady supply; the rest of the works are not', () => {
    for (const id of ['p_preserves', 'p_dairy', 'p_bakery']) expect(PROJECT_BY_ID.get(id)?.steady, id).toBe(3);
    for (const id of ['p_greenhouse', 'p_gears', 'p_metals', 'p_clock', 'p_quarry']) expect(PROJECT_BY_ID.get(id)?.steady, id).toBeUndefined();
  });

  it("the Kettle's Cellar: a day's share by the post, then by hand, then the post again: done on the third day", () => {
    const g = new Game({ seed: 41 });
    g.flags.add('town_mill');
    secs(g, 1.1);
    const o = openOrder(g, 'p_preserves')!;
    expect(o).toBeTruthy();
    expect(steadyOf(o)).toBe(3);
    const share = Object.fromEntries(o.lines.map((l) => [l.spec, l.n]));
    expect(share).toEqual({ '#preserve': 8, '#wine': 2 });
    // day 1: a crate tagged for the Council, the overnight post
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'council';
    bin.inv!.add(key('pickles_cogbean'), 12);
    bin.inv!.add(key(wine), 3);
    sleep(g);
    expect(o.shares).toBe(1);
    // the share is used up overnight: today's starts empty
    expect(o.lines.every((l) => l.have === 0)).toBe(true);
    expect(shareIn(g, o)).toBe(false);
    // day 2: by hand at the board; a second share the same day doesn't go in
    g.player.inv.add(key('pickles_cogbean'), 20);
    g.player.inv.add(key(wine), 5);
    expect(boardHandIn(g, o)).toBe(10);
    expect(o.shares).toBe(2);
    expect(shareIn(g, o)).toBe(true);
    expect(bagHelps(g, o)).toBe(false);
    expect(boardHandIn(g, o)).toBe(0);
    expect(g.player.inv.countId('pickles_cogbean')).toBe(12);
    // day 3: a part share carries over until it's whole, and the third share finishes it
    sleep(g);
    const pickles = g.player.inv.countId('pickles_cogbean');
    g.player.inv.removeSpec(wine, g.player.inv.countId(wine));
    expect(boardHandIn(g, o)).toBe(8);
    expect(o.shares).toBe(2);
    expect(g.player.inv.countId('pickles_cogbean')).toBe(pickles - 8);
    const kegs = g.player.inv.countId('keg');
    g.player.inv.add(key(wine), 2);
    expect(boardHandIn(g, o)).toBe(2);
    expect(worksDone(g)).toContain('p_preserves');
    expect(openOrder(g, 'p_preserves')).toBeNull();
    expect(g.player.inv.countId('keg')).toBe(kegs + 4);
  });

  it('keeps its shares through a save, and an old save\'s basket takes the new lines', () => {
    const g = new Game({ seed: 42 });
    g.flags.add('town_mill');
    secs(g, 1.1);
    const o = openOrder(g, 'p_preserves')!;
    g.player.inv.add(key('pickles_cogbean'), 8);
    g.player.inv.add(key(wine), 2);
    boardHandIn(g, o);
    expect(o.shares).toBe(1);
    const d = JSON.parse(JSON.stringify(serialize(g, look)));
    const o2 = openOrder(deserialize(d).game, 'p_preserves')!;
    expect(o2.shares).toBe(1);
    // a basket from before Phase 5 (10 preserves, 3 wine, 3 honey) with part of it in
    const raw = d.sys.orders.open.find((x: any) => x.def === 'p_preserves');
    raw.lines = [{ spec: '#preserve', n: 10, have: 6 }, { spec: '#wine', n: 3, have: 0 }, { spec: 'honey', n: 3, have: 3 }];
    delete raw.shares;
    delete raw.shareDay;
    const g3 = deserialize(d).game;
    const o3 = openOrder(g3, 'p_preserves')!;
    expect(o3.lines.map((l) => [l.spec, l.n, l.have])).toEqual([['#preserve', 8, 6], ['#wine', 2, 0]]);
    expect(orders(g3).open.filter((x) => x.def === 'p_preserves')).toHaveLength(1);
  });
});
