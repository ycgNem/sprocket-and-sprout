// The counter (the owner's playtest: "make it so you can interact with the npcs when they are in
// their workshop so you can complete quests"): a villager at work indoors, and anyone in with them,
// can be chatted with, given what you hold, and handed what their asks and orders want from the bag,
// and the shop comes back once the talk is done (src/ui/windows/town.ts).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { insideAt, npcSys, talkTo } from '../src/sim/systems/npcs';
import { counterAsks, handIn } from '../src/sim/systems/quests';
import { orders, type Order } from '../src/sim/systems/orders';
import { keeperIn } from '../src/sim/systems/town';

/** Bram at work in the forge, and Hazel in with him */
function atWork(seed = 61) {
  const g = new Game({ seed });
  g.time.min = 11 * 60;
  const ns = npcSys(g);
  for (const id of ['bram', 'hazel']) {
    const n = ns.byId.get(id)!;
    n.target = 'smithy_in';
    n.visible = false;
    n.path = [];
    n.met = true;
  }
  return { g, bram: ns.byId.get('bram')!, hazel: ns.byId.get('hazel')! };
}

const dialogs = (g: Game) => g.events.filter((e: any) => e.t === 'ui' && e.open === 'dialog').map((e: any) => e.arg);

describe('the counter', () => {
  it('knows who is in: the keeper at work and anyone in with them', () => {
    const { g } = atWork();
    expect(keeperIn(g, 'smithy')).toBe(true);
    expect(insideAt(g, 'smithy').map((n) => n.id).sort()).toEqual(['bram', 'hazel']);
    expect(insideAt(g, 'store').some((n) => n.id === 'bram')).toBe(false);
  });

  it("hands over what today's ask wants from the bag (nothing held), and the shop comes back after", () => {
    const { g } = atWork();
    const ask: Order = { uid: 9001, kind: 'today', def: 'req:bram:copper_bar', cust: 'bram', lines: [{ spec: 'copper_bar', n: 3, have: 0 }], day: g.dayIndex, due: g.dayIndex, pay: 120, rep: 1 };
    orders(g).open.push(ask);
    expect(counterAsks(g, 'bram')).toEqual([expect.objectContaining({ ok: false, k: null })]);
    g.player.inv.add(key('copper_bar'), 5);
    g.player.sel = 9;
    g.player.inv.slots[9] = null;
    const a = counterAsks(g, 'bram');
    expect(a.length).toBe(1);
    expect(a[0].ok).toBe(true);
    g.events.length = 0;
    const money = g.player.money;
    expect(handIn(g, 'bram', 'smithy')).toBe(true);
    expect(g.player.inv.countId('copper_bar')).toBe(2);
    expect(ask.lines[0].have).toBe(3);
    expect(g.player.money).toBeGreaterThan(money);
    expect(dialogs(g).at(-1)?.shop).toBe('smithy');
    // nothing more to hand in
    expect(counterAsks(g, 'bram').some((x) => x.ok)).toBe(false);
    expect(handIn(g, 'bram', 'smithy')).toBe(false);
  });

  it("Chat talks without handing over what you hold; Give gifts it; either way the shop comes back", () => {
    const { g, bram, hazel } = atWork();
    g.player.inv.slots[(g.player.sel = 0)] = { k: key('copper_bar'), n: 2 };
    g.events.length = 0;
    talkTo(g, bram, 'smithy', true);
    expect(g.player.inv.countId('copper_bar')).toBe(2);
    expect(bram.giftedToday).toBe(false);
    expect(dialogs(g).at(-1)?.shop).toBe('smithy');
    // someone else in the shop: the same
    g.events.length = 0;
    talkTo(g, hazel, 'smithy');
    expect(hazel.giftedToday).toBe(true);
    expect(g.player.inv.countId('copper_bar')).toBe(1);
    expect(dialogs(g).at(-1)?.shop).toBe('smithy');
  });
});
