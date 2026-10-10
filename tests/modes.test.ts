// Game modes, farm maps, the post collections and achievements.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { FARMS } from '../src/data/modes';
import { ITEM_INDEX } from '../src/data/items';
import { ACHIEVEMENTS, featsDone, unlockAch, SECRET_REWARD } from '../src/sim/systems/achievements';
import { modeState } from '../src/sim/systems/modes';
import { questSys } from '../src/sim/systems/quests';
import { O, T } from '../src/sim/world/tilemap';
import { PLAYER_START } from '../src/sim/world/worldgen';
import { OPENING } from '../src/sim/opening';
import { canPlace } from '../src/sim/build';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };

describe("the keeper's yard (ROADMAP.md 6.0)", () => {
  it('stays clear of weeds and storm debris on every seed, and every marked tile takes its piece', () => {
    const Y = OPENING.yard;
    const marked: [string, [number, number]][] = [
      ['arm_basic', OPENING.feedArm], ['jar', OPENING.jar2], ['chest_wood', OPENING.jar2Chest], ['arm_basic', OPENING.jar2Feed],
      ['arm_basic', OPENING.jar2Out], ['arm_basic', OPENING.shareArm], ...OPENING.jar2Belts.map(([x, y]) => ['belt_1', [x, y]] as [string, [number, number]]),
    ];
    for (let seed = 1; seed <= 150; seed++) {
      const g = new Game({ seed });
      for (let d = 0; d < 3; d++) {
        // no debris chores in the first hour (3.2 rule 2): not at the start, not after a night
        for (let y = Y.y; y < Y.y + Y.h; y++)
          for (let x = Y.x; x < Y.x + Y.w; x++) {
            const o = g.map.obj[g.map.idx(x, y)];
            expect(o === O.NONE || o === O.MAILBOX, `seed ${seed} day ${d} ${x},${y} has object ${o}`).toBe(true);
          }
        if (d === 0) for (const [id, [x, y]] of marked) expect(canPlace(g, id, x, y, 0).ok, `seed ${seed} ${id} at ${x},${y}`).toBe(true);
        g.time.min = DAY_END - 0.001;
        g.tick();
      }
    }
  });

  it("opens on the works: the jar running, the rest of the keeper's machines rusted", () => {
    const g = new Game({ seed: 3 });
    const at = (xy: [number, number]) => g.ents.at(xy[0], xy[1])!;
    expect(at(OPENING.jar).st.keeper).toBe(1);
    expect(at(OPENING.jar).mach!.inBuf.size).toBeGreaterThan(0);
    for (const xy of [OPENING.armTile, OPENING.gleanArm, OPENING.gleaner, OPENING.desk, ...OPENING.belts]) expect(at(xy).st.rust, `${xy}`).toBe(1);
    // the jar works from the first second, so the factory pulse reads "1 working"
    for (let i = 0; i < 60; i++) g.tick();
    expect(at(OPENING.jar).working).toBe(true);
  });
});

describe('farm maps', () => {
  for (const f of FARMS) {
    it(`${f.id}: generates, keeps the yard clear and survives a save`, () => {
      const g = new Game({ seed: 99, farm: f.id });
      const [px, py] = PLAYER_START;
      expect(g.map.walkable(Math.floor(px), Math.floor(py))).toBe(true);
      expect(g.map.walkable(Math.floor(g.player.x), Math.floor(g.player.y))).toBe(true);
      // the opening pieces exist on every map: the keeper's patch (8) and the gleaner's bed (3)
      expect(g.ents.machines.some((e) => e.def.id === 'jar')).toBe(true);
      expect([...g.soil.values()].filter((s) => s.crop?.id === 'cogbean').length).toBe(11);
      const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
      expect(g2.farmKind).toBe(f.id);
      expect(g2.map.ground).toEqual(g.map.ground);
    });
  }

  it('maps really differ: riverside has a farm stream, ruins a copper seam, highlands cliffs', () => {
    const count = (g: Game, t: T, x0 = 22, x1 = 93) => {
      let n = 0;
      for (let y = 16; y < 98; y++) for (let x = x0; x <= x1; x++) if (g.map.g(x, y) === t) n++;
      return n;
    };
    expect(count(new Game({ seed: 5, farm: 'riverside' }), T.RIVER, 22, 85)).toBeGreaterThan(100);
    expect(count(new Game({ seed: 5, farm: 'ruins' }), T.ORE_VEIN)).toBeGreaterThan(10);
    expect(count(new Game({ seed: 5, farm: 'highlands' }), T.CLIFF)).toBeGreaterThan(50);
    const trees = (g: Game) => g.map.obj.filter((o) => o === O.TREE).length;
    expect(trees(new Game({ seed: 5, farm: 'wildwood' }))).toBeGreaterThan(trees(new Game({ seed: 5 })) + 300);
  });
});

describe('modes', () => {
  it('sandbox: everything researched, free crafting, no energy cost, frozen clock', async () => {
    const { craft, HAND_RECIPES } = await import('../src/sim/crafting');
    const g = new Game({ seed: 3, mode: 'sandbox' });
    expect(g.player.money).toBe(1000000);
    expect(g.research.done.size).toBeGreaterThan(50);
    const r = HAND_RECIPES.find((x) => x.out[0].item === 'chest_wood')!;
    expect(craft(g, r, 3)).toBe(3);
    const e = g.player.energy;
    g.spend(50);
    expect(g.player.energy).toBe(e);
    const t = g.time.min;
    for (let i = 0; i < 600; i++) g.tick();
    expect(g.time.min).toBe(t);
  });

  it('sandbox applies every research effect from the first tick', () => {
    const g = new Game({ seed: 3, mode: 'sandbox' });
    expect(g.mods.machineSpeed).toBeCloseTo(1.25);
    expect(questSys(g).active.length).toBe(0);
  });

  it('rush research costs half, and stays half after a topic completes and after a reload', async () => {
    const { researchUnits } = await import('../src/sim/systems/research');
    const g = new Game({ seed: 8, mode: 'rush' });
    expect(researchUnits('r_fertilizer', g)).toBe(3);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(researchUnits('r_fertilizer', g2)).toBe(3);
    // Rush keeps only the tutorial: the Keeper's Line
    expect(questSys(g).active.every((a) => a.id.startsWith('k'))).toBe(true);
  });

  it('slowing time while building slows the factory too (no output exploit)', () => {
    const run = (slow: boolean) => {
      const g = new Game({ seed: 9 });
      const jar = g.ents.machines.find((e) => e.def.id === 'jar')!;
      jar.mach!.inBuf.set(key('cogbean'), 40);
      g.slowClock = slow;
      while (g.time.min < 8 * 60) g.tick();
      return jar.mach!.outBuf.reduce((a, s) => a + s.n, 0) + jar.mach!.made;
    };
    const fast = run(false), slow = run(true);
    expect(Math.abs(fast - slow)).toBeLessThanOrEqual(1);
  });

  it('right-clicking a machine loads its ingredient from anywhere in the bag', async () => {
    const { interactStruct } = await import('../src/sim/actions');
    const g = new Game({ seed: 10 });
    const jar = g.ents.machines.find((e) => e.def.id === 'jar')!;
    g.player.inv.slots[30] = { k: key('cogbean'), n: 5 };
    g.player.sel = 0; // holding the hoe
    expect(interactStruct(g, jar)).toBe(true);
    expect(g.player.inv.countId('cogbean')).toBe(0);
  });

  it('clockwork rush ends after 28 days with a medal', () => {
    const g = new Game({ seed: 4, mode: 'rush' });
    expect(g.player.inv.countId('belt_1')).toBeGreaterThanOrEqual(40);
    g.earned = 80000;
    for (let d = 0; d < 28; d++) {
      g.time.min = DAY_END - 0.001;
      g.tick();
    }
    const ms = modeState(g);
    expect(ms.done).toBe(true);
    expect(ms.medal).toBe(2);
    expect(ms.showResult).toBe(true);
  });
});

describe('the post', () => {
  it('collects the shipping crate at noon and still lists it in the day summary', () => {
    const g = new Game({ seed: 6 });
    const bin = g.ents.get(g.shipBinId)!;
    bin.inv!.add(key('radish'), 10);
    const before = g.player.money;
    g.time.min = 719.99;
    g.tick();
    g.tick();
    expect(g.player.money).toBeGreaterThan(before);
    expect(bin.inv!.slots.every((s) => !s)).toBe(true);
    g.events.length = 0;
    g.endDay(false);
    const ev = g.events.find((e) => e.t === 'dayEnd') as any;
    expect(ev.summary.total).toBeGreaterThan(0);
    expect(ev.summary.sold.some((s: any) => s.k === key('radish'))).toBe(true);
  });
});

describe('achievements', () => {
  it('have unique ids, real icons and hints for every secret', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id), a.id).toBe(false);
      ids.add(a.id);
      expect(ITEM_INDEX.has(a.icon), `${a.id} icon ${a.icon}`).toBe(true);
      if (a.secret) expect(a.hint, a.id).toBeTruthy();
    }
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(100);
    expect(ACHIEVEMENTS.filter((a) => a.secret).length).toBeGreaterThanOrEqual(25);
  });

  it('unlock once, pay secrets, and poll state-based ones', () => {
    const g = new Game({ seed: 7, farmName: 'Stardew' });
    const m = g.player.money;
    expect(unlockAch(g, 'konami')).toBe(true);
    expect(unlockAch(g, 'konami')).toBe(false);
    expect(g.player.money).toBe(m + SECRET_REWARD);
    for (let i = 0; i < 240; i++) g.tick();
    expect(featsDone(g).has('wrongvalley')).toBe(true);
    expect(featsDone(g).has('belt1')).toBe(false);
  });
});
