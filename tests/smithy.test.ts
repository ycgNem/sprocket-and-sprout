// Bram's tool upgrades: a finished tool is never lost to a full bag, and a farm that lost one gets it back.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { goals, readMail } from '../src/sim/systems/goals';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
const has = (g: Game, id: string) => g.player.inv.countId(id) > 0;

describe("Bram's tool upgrades", () => {
  it('a finished tool that does not fit the bag comes by post, and the letter hands it over', () => {
    const g = new Game({ seed: 81 });
    g.player.inv.removeSpec('can_0', 1);
    g.player.upgrading = { tool: 'can_0', to: 'can_1', days: 1 };
    const inv = g.player.inv;
    for (let i = 0; i < inv.slots.length; i++) if (!inv.slots[i]) inv.slots[i] = { k: key('stone'), n: 1 };
    sleep(g);
    expect(g.player.upgrading).toBeNull();
    expect(has(g, 'can_1')).toBe(false);
    const gs = goals(g);
    const letter = [...gs.mail, ...(gs.queue ?? [])].find((m) => m.items?.some((it) => it.item === 'can_1'));
    expect(letter).toBeTruthy();
    // a free slot, then reading the letter takes the can
    inv.slots[inv.slots.findIndex((s) => s && s.k === key('stone'))] = null;
    readMail(g, letter!);
    expect(has(g, 'can_1')).toBe(true);
  });

  it('a farm with no watering can anywhere gets one back from the forge, once, at its best tool tier', () => {
    const g = new Game({ seed: 82 });
    g.player.inv.removeSpec('can_0', 1);
    // a Copper hoe says what the player had paid for
    g.player.inv.removeSpec('hoe_0', 1);
    g.player.inv.add(key('hoe_1'), 1);
    const { game: g2 } = deserialize(JSON.parse(JSON.stringify(serialize(g, look))));
    expect(has(g2, 'can_1')).toBe(true);
    expect(has(g2, 'hoe_1')).toBe(true);
    // once per farm: a can thrown away after this doesn't come back on the next load
    g2.player.inv.removeSpec('can_1', 1);
    const { game: g3 } = deserialize(JSON.parse(JSON.stringify(serialize(g2, look))));
    expect(g3.player.inv.countId('can_1')).toBe(0);
  });

  it('a tool still at the forge is not handed back twice', () => {
    const g = new Game({ seed: 83 });
    g.player.inv.removeSpec('can_0', 1);
    g.player.upgrading = { tool: 'can_0', to: 'can_1', days: 2 };
    const { game: g2 } = deserialize(JSON.parse(JSON.stringify(serialize(g, look))));
    expect(g2.player.inv.countId('can_0') + g2.player.inv.countId('can_1')).toBe(0);
    expect(g2.player.upgrading?.to).toBe('can_1');
  });
});
