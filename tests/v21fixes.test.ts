// 2.1's fixes from the owner's notes (DECISIONS #168, #169): the field gantry's seed bin has no
// limit, and a drill brings up rare ores slower than common ones.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, SYSTEMS } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { PORT_HANDLERS, portAccept } from '../src/sim/ports';
import { GANTRY_HOPPER, seedBin } from '../src/sim/systems/fieldworks';
import { DRILL_YIELD } from '../src/sim/systems/automation';
import { T, ORE_TYPES } from '../src/sim/world/tilemap';

const blank = () => new Game({ seed: 1, blank: { w: 40, h: 40 } });

describe('the field gantry takes any number of seeds', () => {
  it('an arm (or your hands) can put thousands in, and the hopper keeps its room for crops', () => {
    const g = blank();
    const gan = g.ents.add('field_gantry', 10, 30, 0);
    const k = key('cogbean_seed');
    expect(portAccept(g, gan, k, 0)).toBeGreaterThan(1e6);
    for (let i = 0; i < 50; i++) expect(PORT_HANDLERS.gantry.insert!(g, gan, k, 100)).toBe(100);
    expect(PORT_HANDLERS.gantry.insert!(g, gan, key('wheat_seed'), 2500)).toBe(2500);
    expect(seedBin(gan)).toEqual({ cogbean_seed: 5000, wheat_seed: 2500 });
    // the hopper's slots are all still free for the crops it picks
    expect(gan.inv!.slots.every((s) => s === null)).toBe(true);
    expect(gan.inv!.space(key('cogbean'))).toBeGreaterThanOrEqual(GANTRY_HOPPER);
    // crops still don't go in
    expect(portAccept(g, gan, key('cogbean'), 0)).toBe(0);
  });

  it("a save's seeds in the hopper (before the bin) move into the bin", () => {
    const g = blank();
    const gan = g.ents.add('field_gantry', 10, 30, 0);
    delete gan.st.seeds;
    gan.inv!.add(key('cogbean_seed'), 40);
    gan.inv!.add(key('cogbean'), 7);
    expect(seedBin(gan)).toEqual({ cogbean_seed: 40 });
    expect(gan.inv!.countId('cogbean_seed')).toBe(0);
    expect(gan.inv!.countId('cogbean')).toBe(7);
  });
});

describe('a drill brings up rare ores slower', () => {
  it('copper at the full rate, gold at a fraction of it, in the order of their rarity', () => {
    expect(DRILL_YIELD.copper_ore).toBe(1);
    const order = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore', 'starmetal_ore'];
    for (let i = 1; i < order.length; i++) expect(DRILL_YIELD[order[i]], order[i]).toBeLessThan(DRILL_YIELD[order[i - 1]]);
  });

  it('a drill on gold takes about seven times as long a cycle as one on copper', () => {
    const count = (ore: string) => {
      const g = blank();
      const idx = ORE_TYPES.indexOf(ore as (typeof ORE_TYPES)[number]);
      for (let y = 5; y < 7; y++)
        for (let x = 5; x < 7; x++) {
          g.map.setG(x, y, T.ORE_VEIN);
          g.map.objData[g.map.idx(x, y)] = idx;
        }
      const e = g.ents.add('drill_steam', 5, 5, 0);
      const auto = SYSTEMS.find((s) => s.name === 'automation')!;
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        e.st.fuel = { k: key('coal'), n: 20 };
        auto.tick!(g, 0.1);
        const s = e.inv!.slots[0];
        if (s) {
          n += s.n;
          e.inv!.slots[0] = null;
        }
      }
      return n;
    };
    const copper = count('copper_ore'), gold = count('gold_ore');
    expect(copper).toBeGreaterThan(40);
    expect(gold).toBeGreaterThan(0);
    expect(copper / gold).toBeGreaterThan(5);
    expect(copper / gold).toBeLessThan(8);
  });
});

describe('arms keep loading a machine that is working', () => {
  it('an arm feeds a busy crock past two batches (it queued behind every one before)', async () => {
    const { place } = await import('../src/sim/build');
    const g = blank();
    g.player.x = 39.5;
    g.player.y = 39.5;
    const chest = place(g, 'chest_wood', 10, 10, 0);
    place(g, 'arm_basic', 11, 10, 1);
    const jar = place(g, 'jar', 12, 10, 0);
    chest.inv!.add(key('radish'), 50);
    for (let i = 0; i < 20 * 60; i++) g.tick();
    expect(jar.mach!.crafting).toBe(true);
    // twenty seconds in, the crock is working and holds far more than two radishes to come
    expect([...jar.mach!.inBuf.values()].reduce((a, n) => a + n, 0)).toBeGreaterThanOrEqual(8);
    expect(chest.inv!.countId('radish')).toBeLessThanOrEqual(41);
  });
});
