import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END, DAY_START } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { CROP_BY_ID } from '../src/data/crops';
import { plant, till, harvest, waterTile } from '../src/sim/systems/farming';
import { place } from '../src/sim/build';
import { laneInsert } from '../src/sim/systems/belts';
import { serialize, deserialize, migrate, SAVE_VERSION } from '../src/sim/save';
import { unitPrice, sellStack } from '../src/sim/systems/economy';
import { mine } from '../src/sim/systems/mine';
import { npcSys, giftTaste } from '../src/sim/systems/npcs';
import { NPC_BY_ID } from '../src/data/npcs';
import { craft, HAND_RECIPES } from '../src/sim/crafting';
import { O, T } from '../src/sim/world/tilemap';
import { C } from '../src/data/palette';

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

describe('time', () => {
  it('rolls days, seasons and years', () => {
    const g = new Game({ seed: 3 });
    expect(g.time).toMatchObject({ day: 1, season: 0, year: 1 });
    for (let i = 0; i < 28; i++) sleep(g);
    expect(g.time).toMatchObject({ day: 1, season: 1, year: 1, min: DAY_START });
    for (let i = 0; i < 28 * 3; i++) sleep(g);
    expect(g.time).toMatchObject({ day: 1, season: 0, year: 2 });
    expect(g.weekday).toBe(g.dayIndex % 7);
  });

  it('passing out at 2am costs your morning and energy, not coins', () => {
    const g = new Game({ seed: 4 });
    g.player.money = 1000;
    g.time.min = DAY_END - 0.005;
    g.tick();
    expect(g.time.day).toBe(2);
    expect(g.player.money).toBe(1000);
    expect(g.time.min).toBe(600);
    expect(g.player.energy).toBeLessThan(g.player.maxEnergy);
  });

  it('cozy mode runs the clock at half speed and forgives passing out', () => {
    const g = new Game({ seed: 4, mode: 'cozy' });
    for (let i = 0; i < 60 * 7; i++) g.tick();
    expect(Math.round(g.time.min - DAY_START)).toBe(5);
    g.time.min = DAY_END - 0.001;
    g.tick();
    expect(g.time.min).toBe(DAY_START);
  });

  it('the clock slows to a quarter while building', () => {
    const g = new Game({ seed: 5 });
    g.slowClock = true;
    for (let i = 0; i < 60 * 28; i++) g.tick();
    expect(Math.round(g.time.min - DAY_START)).toBe(10);
  });

  it('a 10-minute game step takes 7 real seconds', () => {
    const g = new Game({ seed: 5 });
    for (let i = 0; i < 60 * 7; i++) g.tick();
    expect(Math.round(g.time.min - DAY_START)).toBe(10);
  });
});

describe('farming', () => {
  function farmTile(g: Game): [number, number] {
    for (let y = 30; y < 60; y++)
      for (let x = 30; x < 90; x++) {
        const i = g.map.idx(x, y);
        if ((g.map.ground[i] === T.GRASS || g.map.ground[i] === T.DIRT) && !g.map.obj[i] && !g.map.buildingAt[i] && !g.ents.at(x, y)) return [x, y];
      }
    throw new Error('no tile');
  }

  it('crops only grow on watered days and become harvestable', () => {
    const g = new Game({ seed: 7 });
    g.weather = 'sun';
    g.tomorrow = 'sun';
    const [x, y] = farmTile(g);
    expect(till(g, x, y)).toBe(true);
    const i = g.map.idx(x, y);
    expect(plant(g, CROP_BY_ID.get('radish')!, i)).toBe(true);
    // a dry day: no growth
    g.tomorrow = 'sun';
    sleep(g);
    expect(g.soil.get(i)!.crop!.days).toBe(0);
    for (let d = 0; d < 4; d++) {
      waterTile(g, x, y);
      g.tomorrow = 'sun';
      sleep(g);
    }
    const c = g.soil.get(i)!.crop!;
    expect(c.ready).toBe(true);
    const out = harvest(g, i)!;
    expect(out[0].k >> 2).toBe(key('radish') >> 2);
    expect(g.soil.get(i)!.crop).toBeNull();
  });

  it('multi-harvest crops regrow', () => {
    const g = new Game({ seed: 8 });
    const [x, y] = farmTile(g);
    till(g, x, y);
    const i = g.map.idx(x, y);
    plant(g, CROP_BY_ID.get('strawberry')!, i);
    const c = g.soil.get(i)!.crop!;
    c.days = 99;
    c.ready = true;
    harvest(g, i);
    expect(g.soil.get(i)!.crop).not.toBeNull();
    expect(g.soil.get(i)!.crop!.ready).toBe(false);
  });

  it('out-of-season crops die at the season change', () => {
    const g = new Game({ seed: 9 });
    const [x, y] = farmTile(g);
    till(g, x, y);
    const i = g.map.idx(x, y);
    plant(g, CROP_BY_ID.get('radish')!, i);
    g.time.day = 28;
    sleep(g);
    expect(g.time.season).toBe(1);
    expect(g.soil.get(i)?.crop?.dead).toBe(true);
  });
});

describe('economy', () => {
  it('flooding the market lowers the price, and it recovers', () => {
    const g = new Game({ seed: 10 });
    const k = key('radish');
    const before = unitPrice(g, k);
    sellStack(g, k, 600);
    const after = unitPrice(g, k);
    expect(after).toBeLessThan(before * 0.6);
    for (let d = 0; d < 20; d++) sleep(g);
    expect(unitPrice(g, k)).toBeGreaterThan(after);
  });

  it('shipping crate contents are sold overnight', () => {
    const g = new Game({ seed: 11 });
    const bin = g.ents.get(g.shipBinId)!;
    bin.inv!.add(key('wood'), 10);
    const m0 = g.player.money;
    sleep(g);
    expect(g.player.money).toBeGreaterThan(m0);
    expect(bin.inv!.isEmpty()).toBe(true);
  });
});

describe('crafting', () => {
  it('hand crafting consumes ingredients and respects unlocks', () => {
    const g = new Game({ seed: 12 });
    // the clockwork opening already knows belts and carries a chest: reset for this test
    g.research.done.delete('r_belts');
    g.player.inv.remove(key('chest_wood'), g.player.inv.countId('chest_wood'));
    g.player.inv.add(key('wood'), 40);
    const chest = HAND_RECIPES.find((r) => r.out[0].item === 'chest_wood')!;
    expect(craft(g, chest, 1)).toBe(1);
    expect(g.player.inv.countId('wood')).toBe(20);
    expect(g.player.inv.countId('chest_wood')).toBe(1);
    const belt = HAND_RECIPES.find((r) => r.out[0].item === 'belt_1')!;
    g.player.inv.add(key('copper_gear'), 5);
    g.player.inv.add(key('plank'), 5);
    g.player.inv.add(key('fiber'), 10);
    expect(craft(g, belt, 1)).toBe(0);
    g.research.done.add('r_belts');
    expect(craft(g, belt, 1)).toBe(1);
  });
});

describe('npcs', () => {
  it('gift tastes prefer exact ids over tags', () => {
    const d = NPC_BY_ID.get('ottoline')!;
    expect(giftTaste(d, 'brass_gear')).toBe('love');
    expect(giftTaste(d, 'old_boot')).toBe('hate');
  });

  it('villagers follow their schedules out of their homes', () => {
    const g = new Game({ seed: 13 });
    g.time.min = 11 * 60;
    for (let i = 0; i < 60 * 30; i++) g.tick();
    const visible = npcSys(g).list.filter((n) => n.visible).length;
    expect(visible).toBeGreaterThan(2);
  });
});

describe('mine', () => {
  it('generates every floor with an exit and ore', () => {
    const g = new Game({ seed: 14 });
    for (const f of [1, 5, 12, 20, 33, 47, 60]) {
      mine(g).enter(g, f);
      const m = mine(g).map!;
      expect(m.obj.includes(O.MINE_EXIT)).toBe(true);
      let rocks = 0;
      for (const o of m.obj) if (o === O.ROCK || o === O.ORE_ROCK || o === O.ICE_ROCK) rocks++;
      expect(rocks).toBeGreaterThan(20);
      expect(g.player.where).toBe('mine');
      if (f % 5 === 0) expect(g.flags.has('elev_' + f)).toBe(true);
    }
    mine(g).leave(g);
    expect(g.player.where).toBe('world');
  });
});

describe('save/load', () => {
  it('round-trips the world, factory, inventory and relationships', () => {
    const g = new Game({ seed: 15, name: 'Test', farmName: 'Sprout' });
    g.player.money = 4321;
    g.player.inv.add(key('strawberry', 2), 7);
    g.research.done.add('r_belts');
    g.flags.add('lab');
    // a little factory
    for (let x = 60; x < 65; x++) {
      g.map.setO(x, 40, O.NONE);
      place(g, 'belt_1', x, 40, 1);
    }
    laneInsert(g.ents.at(60, 40)!.belt!, 0, key('wood'), 0.2);
    g.map.setO(66, 40, O.NONE);
    const keg = place(g, 'keg', 66, 41, 0);
    keg.mach!.inBuf.set(key('grape'), 2);
    npcSys(g).byId.get('rowan')!.points = 777;
    const data = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    const { game: g2, look } = deserialize(data);
    expect(look).toEqual({ skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 });
    expect(g2.player.money).toBe(4321);
    expect(g2.player.inv.count(key('strawberry', 2))).toBe(7);
    expect(g2.research.done.has('r_belts')).toBe(true);
    expect(g2.ents.belts.length).toBe(g.ents.belts.length);
    expect(g2.ents.at(60, 40)!.belt!.lanes[0].k.length).toBe(1);
    expect(g2.ents.rootAt(66, 41)!.mach!.inBuf.get(key('grape'))).toBe(2);
    expect(npcSys(g2).byId.get('rowan')!.points).toBe(777);
    expect(g2.map.obj[g2.map.idx(61, 40)]).toBe(O.NONE);
  });

  it('migrates old save versions', () => {
    const v1 = { v: 1, player: { name: 'x', farmName: 'y', money: 1 }, map: {} };
    const d = migrate(v1);
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.player.rows).toBe(3);
    expect(() => migrate({ v: 999 })).toThrow();
  });

  it('moves v2 look colors from the 32-color palette to Resurrect 64', () => {
    // 1.0 indices: apricot skin, walnut hair, moss shirt, river pants, rose accent
    const d = migrate({ v: 2, player: { name: 'x', farmName: 'y' }, look: { skin: 5, hair: 10, hairStyle: 'short', shirt: 14, pants: 19, accent: 28 } });
    expect(d.look).toEqual({ skin: C.apricot, hair: C.walnut, hairStyle: 'short', shirt: C.moss, pants: C.river, accent: C.rose });
  });
});

describe('walkability (1.2 playtest bug 12)', () => {
  it('weeds and twigs are walkable; bushes, logs and rocks are not', () => {
    const g = new Game({ seed: 5 });
    const m = g.map;
    const x = 44, y = 34;
    m.setG(x, y, T.GRASS);
    for (const [o, ok] of [[O.WEED, true], [O.TWIG, true], [O.TALLGRASS, true], [O.BUSH, false], [O.LOG, false], [O.ROCK, false]] as const) {
      m.setO(x, y, o);
      expect(m.walkable(x, y), `object ${o}`).toBe(ok);
    }
  });
});

describe('shopkeepers (owner playtest: the ranch never opened)', () => {
  it('every keeper is inside for most of the shop\'s opening hours, Clem included', async () => {
    const { SHOPS } = await import('../src/data/shops');
    const { shopOpen } = await import('../src/sim/systems/town');
    const g = new Game({ seed: 5, name: 'T', farmName: 'T' });
    while (g.weekday !== 4) g.endDay(false);
    const open = new Map<string, number>(), home = new Map<string, number>();
    for (let i = 0; i < 60 * 60 * 14; i++) {
      g.tick();
      if (i % 300) continue;
      for (const s of SHOPS) {
        const k = npcSys(g).byId.get(s.owner);
        if (!k || !shopOpen(g, s.id).open) continue;
        open.set(s.id, (open.get(s.id) ?? 0) + 1);
        const inside = g.map.locs.get(s.loc + '_in'), kt = g.map.locs.get(k.target);
        if (!k.visible && inside && kt && kt[0] === inside[0] && kt[1] === inside[1]) home.set(s.id, (home.get(s.id) ?? 0) + 1);
      }
    }
    expect(open.get('ranch')).toBeGreaterThan(0);
    const short = [...open].filter(([id, n]) => (home.get(id) ?? 0) / n < 0.85).map(([id, n]) => ` %`);
    expect(short).toEqual([]);
  });
});

describe('mine lifts (owner playtest: "mine floors don\'t save")', () => {
  it('a shaft past a lift floor unlocks it, and the deepest floor reached unlocks lifts in old saves', () => {
    const g = new Game({ seed: 5, name: 'T', farmName: 'T' });
    mine(g as any);
    const m = g.sys.mine!;
    m.enter(g, 4);
    m.enter(g, 8); // a shaft from 4 drops past 5
    expect(g.flags.has('elev_5')).toBe(true);
    // an old save that tumbled past 10 and 15 without the flags
    m.deepest = 17;
    g.flags.delete('elev_5');
    const evs: any[] = [];
    const emit = g.emit.bind(g);
    g.emit = (ev: any) => { evs.push(ev); return emit(ev); };
    m.enterPrompt(g);
    expect(evs.find((ev) => ev.t === 'ui' && ev.open === 'elevator')?.arg).toEqual([1, 5, 10, 15]);
  });
});

describe('bridges (owner playtest: L-shaped decks)', () => {
  it('every plank deck on every farm layout is a rectangle, and old saves are squared on load', async () => {
    const { generateWorld, squareBridges } = await import('../src/sim/world/worldgen');
    const rects = (m: any) => {
      const seen = new Uint8Array(m.w * m.h);
      const bad: string[] = [];
      for (let i = 0; i < m.w * m.h; i++) {
        if (seen[i] || m.ground[i] !== T.PLANKS) continue;
        const st = [i];
        seen[i] = 1;
        let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        while (st.length) {
          const j = st.pop()!;
          n++;
          const x = j % m.w, y = Math.floor(j / m.w);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = m.idx(x + dx, y + dy);
            if (m.inb(x + dx, y + dy) && !seen[k] && m.ground[k] === T.PLANKS) { seen[k] = 1; st.push(k); }
          }
        }
        if (n !== (x1 - x0 + 1) * (y1 - y0 + 1)) bad.push(`${x0},${y0}`);
      }
      return bad;
    };
    for (const farm of ['classic', 'riverside', 'ruins', 'highlands', 'wildwood'] as const) expect(rects(generateWorld(12345, farm))).toEqual([]);
    // an old world's L-shaped deck and its riverside sliver
    const m = generateWorld(12345);
    m.setG(103, 88, T.PATH);
    m.setG(104, 88, T.PATH);
    for (let y = 85; y <= 87; y++) m.setG(103, y, T.PLANKS);
    expect(rects(m).length).toBeGreaterThan(0);
    squareBridges(m);
    expect(rects(m)).toEqual([]);
    expect(m.g(103, 86)).toBe(T.PATH);
  });
});