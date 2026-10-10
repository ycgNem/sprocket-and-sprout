// Fishing's and combat's professions get works answers (Phase 5, the critic's leftovers): each pair
// is hands or works. Pond Keeper and Net Rigger work the ponds and traps; Shorer and Lampwright work
// what you build in the Deepworks. Hard Hat's +25 health is taken back from an old save.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, SYSTEMS, type DaySummary } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { choosePerk } from '../src/sim/perks';
import { stockPond } from '../src/sim/systems/ponds';
import { mine, minePrompt, BEAMS_TO_SHORE, DEEP_FLAGS, LAMP_LIGHT, PROP_PLANKS } from '../src/sim/systems/mine';
import { unitPrice } from '../src/sim/systems/economy';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const reload = (g: Game) => deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
const dayEnd = (g: Game, name: string) => {
  const s = SYSTEMS.find((x) => x.name === name)!;
  s.dayEnd!(g, { day: 1, season: 0, year: 1, sold: [], total: 0, passedOut: false, penalty: 0 } as DaySummary);
};

describe('fishing: hands or works', () => {
  it('Pond Keeper: a stocked pond grows and lays roe half again as fast; fish sell at the same price', () => {
    const run = (perk: boolean) => {
      let roe = 0, pop = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const g = new Game({ seed });
        if (perk) g.player.perks.push('angler');
        const e = g.ents.add('fish_pond', 5, 5, 0);
        stockPond(g, e, key('sardine'));
        for (let d = 0; d < 10; d++) dayEnd(g, 'ponds');
        roe += e.inv!.countId('roe');
        pop += e.st.pop;
      }
      return { roe, pop };
    };
    const plain = run(false), keeper = run(true);
    expect(keeper.roe).toBeGreaterThan(plain.roe * 1.3);
    expect(keeper.pop).toBeGreaterThan(plain.pop);
    // it was Fishmonger (+25% for fish): no price bonus any more
    const g = new Game({ seed: 3 });
    const before = unitPrice(g, key('sardine'));
    g.player.perks.push('angler');
    expect(unitPrice(g, key('sardine'))).toBe(before);
  });

  it('Net Rigger: a trap catches without bait, and bait still adds to the haul', () => {
    const haul = (perks: string[], bait: number) => {
      const g = new Game({ seed: 9 });
      g.player.perks.push(...perks);
      const e = g.ents.add('fish_trap', 5, 5, 0);
      e.st.bait = bait;
      dayEnd(g, 'automation');
      return e.inv!.slots.reduce((a, s) => a + (s?.n ?? 0), 0);
    };
    expect(haul([], 0)).toBe(0);
    expect(haul([], 1)).toBe(1);
    expect(haul(['steady'], 0)).toBe(1);
    expect(haul(['steady'], 1)).toBe(2);
    expect(haul(['steady', 'trapper'], 0)).toBe(2);
  });
});

describe('combat: hands or works', () => {
  it('Shorer: the caved-in gallery takes 10 beams, not 20', () => {
    const g = new Game({ seed: 4 }), st = mine(g);
    g.player.perks.push('defender');
    st.enter(g, 6);
    const [x, y] = st.gallery!;
    expect(minePrompt(g, x, y)?.hint).toBe('needs 10 hardwood beams');
    g.player.inv.add(key('beam'), 10);
    st.interact(g, x, y);
    expect(g.flags.has(DEEP_FLAGS.shored)).toBe(true);
    expect(g.player.inv.countId('beam')).toBe(0);
    expect(BEAMS_TO_SHORE).toBe(20);
  });

  it('Shorer: a cracked ceiling takes one plank, not two', () => {
    const g = new Game({ seed: 34 }), st = mine(g);
    g.player.perks.push('defender');
    st.enter(g, 2);
    const crack = st.hazards.find((h) => h.kind === 'crack')!;
    g.player.x = crack.x + 0.5;
    g.player.y = crack.y + 1.7;
    expect(minePrompt(g, crack.x, crack.y)?.hint).toBe('needs a plank');
    g.player.inv.add(key('plank'), 3);
    st.interact(g, crack.x, crack.y);
    expect(g.player.inv.countId('plank')).toBe(2);
    expect(st.hazards.filter((h) => h.kind === 'crack' && h.group === crack.group).every((h) => h.state === 4)).toBe(true);
    expect(PROP_PLANKS).toBe(2);
  });

  it('Lampwright: a lamp set down in the Deepworks lights 10 tiles round, not 7', () => {
    const g = new Game({ seed: 3 }), st = mine(g);
    g.player.perks.push('scavenger');
    st.enter(g, 22);
    g.player.inv.add(key('lamp'), 1);
    g.player.sel = g.player.inv.slots.findIndex((s) => s?.k === key('lamp'));
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
    let spot: [number, number] | null = null;
    for (let yy = py - 2; yy <= py + 2 && !spot; yy++)
      for (let xx = px - 2; xx <= px + 2 && !spot; xx++) {
        const pr = minePrompt(g, xx, yy);
        if (pr?.verb === 'Set lamp') spot = [Math.floor(pr.x), Math.round(pr.y + 0.1)];
      }
    expect(spot).not.toBeNull();
    expect(st.interact(g, spot![0], spot![1])).toBe(true);
    expect(st.lamps).toHaveLength(1);
    const [lx, ly] = st.lamps[0];
    expect(st.lights.find((l) => !l.dyn && l.x === lx + 0.5 && l.y === ly - 0.4)?.r).toBe(10);
    expect(LAMP_LIGHT).toBe(7);
  });

  it("Hard Hat's +25 health comes back off an old save, once; Shorer never adds health", () => {
    const g = new Game({ seed: 5 });
    g.player.perks.push('defender');
    g.player.maxHp = 125;
    g.player.hp = 120;
    const d = JSON.parse(JSON.stringify(serialize(g, look)));
    d.flags = d.flags.filter((f: string) => f !== 'hardhat_back');
    const g2 = deserialize(d).game;
    expect(g2.player.maxHp).toBe(100);
    expect(g2.player.hp).toBe(100);
    expect(reload(g2).player.maxHp).toBe(100);
    const g3 = new Game({ seed: 6 });
    g3.player.skills.combat = 5;
    expect(choosePerk(g3, 'defender')).toBe(true);
    expect(g3.player.maxHp).toBe(100);
    expect(reload(g3).player.maxHp).toBe(100);
  });
});
