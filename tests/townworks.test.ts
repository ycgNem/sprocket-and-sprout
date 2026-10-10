// The town keystones in the world (ROADMAP.md 7.5, Phases 3-4): the Town Mill, the Waterworks,
// Lamplighting and the Tram, keyed only on their flags (src/sim/systems/townworks.ts).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interact } from '../src/sim/actions';
import { key, kIdx } from '../src/sim/inventory';
import { deserialize, serialize } from '../src/sim/save';
import { FARMS } from '../src/data/modes';
import { O, T } from '../src/sim/world/tilemap';
import { generateWorld } from '../src/sim/world/worldgen';
import { FOUNTAIN, MILL_WHEEL, PUMP_HOUSE, SQUARE_LAMPS, TOWN_LINE, TOWN_MILL, TRAM, isSquareLamp } from '../src/sim/world/townworks';
import { freshPrice, lampGlow, lampLoad, LAMP_DRAW, townworks, tramBin, TRAM_LOAD, TRAM_PREMIUM } from '../src/sim/systems/townworks';
import { market } from '../src/sim/systems/economy';
import { powerState } from '../src/sim/systems/power';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
const reload = (g: Game) => deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
const toasts = (g: Game) => g.events.filter((e) => e.t === 'toast').map((e) => (e as { text: string }).text);

describe('the Town Mill', () => {
  it('stands on the river at the west end of Main Street on every farm map', () => {
    for (const f of FARMS) {
      const m = generateWorld(11, f.id);
      const b = m.buildings.find((x) => x.id === 'town_mill');
      expect(b, f.id).toBeTruthy();
      expect(b!.kind, f.id).toBe('landmark');
      expect(b!.name).toBe('The Town Mill');
      // the whole footprint is the building's, nothing grows on it
      for (let y = b!.y; y < b!.y + b!.h; y++)
        for (let x = b!.x; x < b!.x + b!.w; x++) {
          expect(m.buildingAtTile(x, y)?.id, `${f.id} ${x},${y}`).toBe('town_mill');
          expect(m.trees.has(m.idx(x, y))).toBe(false);
        }
      // its wheel's hub stands in the river, the doorstep is paved to Main Street's west end
      expect(m.g(Math.floor(MILL_WHEEL.cx), Math.floor(MILL_WHEEL.cy)), f.id).toBe(T.RIVER);
      expect(m.g(TOWN_MILL.door[0], TOWN_MILL.door[1] + 1)).toBe(T.PATH);
      expect(m.g(103, 60)).toBe(T.PATH);
      // clear of the keeper's wheel by the farm gate and of both bridges
      expect(b!.x).toBeGreaterThan(93);
      expect(b!.y).toBeGreaterThan(47);
      expect(b!.y + b!.h).toBeLessThan(88);
      // the pump house, the fountain and the square's twelve lamps too
      expect(m.buildings.some((x) => x.id === 'pump_house' && x.kind === 'landmark')).toBe(true);
      for (let y = FOUNTAIN.y; y < FOUNTAIN.y + FOUNTAIN.h; y++) for (let x = FOUNTAIN.x; x < FOUNTAIN.x + FOUNTAIN.w; x++) expect(m.o(x, y)).toBe(O.BUILDING);
      expect(SQUARE_LAMPS.filter(([x, y]) => isSquareLamp(m, x, y)).length).toBe(12);
      // the square's oil lampposts are gone (it is dark until Lamplighting)
      for (let y = 51; y <= 70; y++) for (let x = 120; x <= 145; x++) if (m.o(x, y) === O.LAMPPOST) expect(isSquareLamp(m, x, y), `${x},${y}`).toBe(true);
    }
  });

  it("an old save gets the mill, the pump house, the fountain and the square's lamps on load", () => {
    const g = new Game({ seed: 7 });
    const m = g.map;
    // put the world back the way a save from before the keystones stored it
    const plant = (x: number, y: number) => { const i = m.idx(x, y); m.obj[i] = O.TREE; m.trees.set(i, { species: 'oak', stage: 4, days: 0, fruit: 0, tapped: false, hp: 10 }); };
    plant(100, 55);
    m.obj[m.idx(TOWN_MILL.x + 4, TOWN_MILL.y + 2)] = O.FLOWER;
    plant(PUMP_HOUSE.x + 1, PUMP_HOUSE.y + 1);
    for (const [x, y] of SQUARE_LAMPS) m.obj[m.idx(x, y)] = O.NONE;
    for (const [x, y] of [[124, 56], [124, 66], [141, 56], [141, 66]]) { m.obj[m.idx(x, y)] = O.LAMPPOST; m.objData[m.idx(x, y)] = 0; }
    for (let x = FOUNTAIN.x; x < FOUNTAIN.x + FOUNTAIN.w; x++) m.obj[m.idx(x, FOUNTAIN.y)] = O.NONE;
    m.ground[m.idx(TOWN_MILL.door[0], TOWN_MILL.door[1] + 1)] = T.GRASS;
    // and the player saved standing where the mill now is
    g.player.x = 101.5;
    g.player.y = 55.5;
    const g2 = reload(g);
    const m2 = g2.map;
    expect(m2.buildings.find((b) => b.id === 'town_mill')?.kind).toBe('landmark');
    expect(m2.buildings.find((b) => b.id === 'pump_house')?.kind).toBe('landmark');
    expect(m2.o(100, 55)).toBe(O.NONE);
    expect(m2.trees.has(m2.idx(100, 55))).toBe(false);
    expect(m2.o(TOWN_MILL.x + 4, TOWN_MILL.y + 2)).toBe(O.NONE);
    expect(m2.trees.has(m2.idx(PUMP_HOUSE.x + 1, PUMP_HOUSE.y + 1))).toBe(false);
    expect(SQUARE_LAMPS.filter(([x, y]) => isSquareLamp(m2, x, y)).length).toBe(12);
    expect(m2.o(124, 56)).toBe(O.NONE);
    for (let x = FOUNTAIN.x; x < FOUNTAIN.x + FOUNTAIN.w; x++) expect(m2.o(x, FOUNTAIN.y)).toBe(O.BUILDING);
    expect(m2.g(TOWN_MILL.door[0], TOWN_MILL.door[1] + 1)).toBe(T.PATH);
    // the player steps out onto the mill's doorstep
    expect(m2.buildingAtTile(Math.floor(g2.player.x), Math.floor(g2.player.y))).toBeNull();
    expect(Math.floor(g2.player.y)).toBe(TOWN_MILL.y + TOWN_MILL.h);
  });

  it("walking up to the silent mill (or the airship) counts as looking at it; F at its door says what it's doing", () => {
    const g = new Game({ seed: 3 });
    g.player.x = 60.5;
    g.player.y = 30.5;
    secs(g, 1.1);
    expect(g.flags.has('observed:town_mill')).toBe(false);
    expect(g.flags.has('observed:airship')).toBe(false);
    // the end of Main Street, a few tiles from the mill's door
    g.player.x = 104.5;
    g.player.y = 61.5;
    secs(g, 1.1);
    expect(g.flags.has('observed:town_mill')).toBe(true);
    expect(g.flags.has('observed:airship')).toBe(false);
    // Skyhook Field's lane, within 5 tiles of the Brass Vixen
    g.player.x = 179.5;
    g.player.y = 64.5;
    secs(g, 1.1);
    expect(g.flags.has('observed:airship')).toBe(true);
    // F at the mill's door: it isn't entered, it says it is silent (and later that it runs)
    g.flags.delete('observed:town_mill');
    g.events.length = 0;
    g.player.x = TOWN_MILL.door[0] + 0.5;
    g.player.y = TOWN_MILL.door[1] + 1.5;
    expect(interact(g, TOWN_MILL.door[0], TOWN_MILL.door[1])).toBe(true);
    expect(g.flags.has('observed:town_mill')).toBe(true);
    expect(toasts(g).some((t) => /Town Mill.*hasn't turned/.test(t))).toBe(true);
    g.flags.add('town_mill');
    g.events.length = 0;
    interact(g, TOWN_MILL.door[0], TOWN_MILL.door[1]);
    expect(toasts(g).some((t) => /The wheel turns/.test(t))).toBe(true);
  });
});

describe('Lamplighting', () => {
  /** a pole of yours at (x, y) and, with `gen`, a new water wheel in its area */
  const grid = (g: Game, x: number, y: number, gen: boolean) => {
    const pole = g.ents.add('pole_wood', x, y, 0);
    if (gen) g.ents.add('waterwheel', x - 2, y - 1, 0);
    return pole;
  };

  it("the square's lamps light after 6pm only on your power, through a pole that reaches the town line", () => {
    const g = new Game({ seed: 3 });
    g.time.min = 19 * 60;
    // lamps not hung: dark, even on a grid
    grid(g, TOWN_LINE[0] - 2, TOWN_LINE[1] - 2, true);
    secs(g, 2.1);
    expect(townworks(g).lit).toBe(false);
    // hung: lit, on the pole's grid, drawing 12 sparks
    g.flags.add('lamps_hung');
    g.events.length = 0;
    secs(g, 2.1);
    expect(townworks(g).lit).toBe(true);
    expect(lampGlow(g)).toBeGreaterThan(0.9);
    expect(g.flags.has('lamplighting')).toBe(true);
    expect(toasts(g)).toContain("The square's lamps are lit, on your power.");
    const load = lampLoad(g);
    expect(load.net).toBeGreaterThan(0);
    const net = powerState(g).nets.get(load.net)!;
    expect(net.demand).toBeGreaterThanOrEqual(LAMP_DRAW);
    // by day they are out and draw nothing
    g.time.min = 12 * 60;
    secs(g, 2.1);
    expect(townworks(g).lit).toBe(false);
    expect(powerState(g).nets.get(load.net)!.demand).toBeLessThan(LAMP_DRAW);
  });

  it('unpowered, or with no pole reaching the farm gate, they stay dark (and lamplighting waits)', () => {
    const g = new Game({ seed: 4 });
    g.flags.add('lamps_hung');
    g.time.min = 20 * 60;
    // no pole of yours anywhere near the gate (the keeper's river works are still rusted)
    secs(g, 2.1);
    expect(townworks(g).lit).toBe(false);
    expect(lampLoad(g).net).toBe(0);
    // a powered grid whose nearest pole is out of wire reach of the town line
    grid(g, TOWN_LINE[0] - 12, TOWN_LINE[1] - 2, true);
    g.ents.powerDirty = true;
    secs(g, 2.1);
    expect(lampLoad(g).net).toBe(0);
    expect(townworks(g).lit).toBe(false);
    // a pole in reach on a grid with no generator: still dark
    grid(g, TOWN_LINE[0] - 1, TOWN_LINE[1] - 3, false);
    secs(g, 2.1);
    expect(lampLoad(g).net).toBeGreaterThan(0);
    expect(townworks(g).lit).toBe(false);
    expect(g.flags.has('lamplighting')).toBe(false);
  });

  it("the keeper's river works, once restored, carry the town line (their pole stands by the farm gate)", () => {
    const g = new Game({ seed: 8 });
    g.flags.add('lamps_hung');
    g.time.min = 21 * 60;
    secs(g, 2.1);
    expect(townworks(g).lit).toBe(false);
    // bring back the keeper's wheel and poles by the gate (as restoring them with their parts does)
    let n = 0;
    for (const e of g.ents.all()) if (e.st.rust && Math.hypot(e.x - TOWN_LINE[0], e.y - TOWN_LINE[1]) < 10) { delete e.st.rust; delete e.st.need; delete e.st.needN; n++; }
    expect(n).toBeGreaterThanOrEqual(2);
    g.ents.powerDirty = true;
    secs(g, 2.1);
    expect(lampLoad(g).net).toBeGreaterThan(0);
    expect(townworks(g).lit).toBe(true);
    expect(g.flags.has('lamplighting')).toBe(true);
  });
});

describe('the Tram', () => {
  it('each morning the cart takes at most 20 ore from its quarry bin and sells it at 1.3x, without flooding the market', () => {
    const g = new Game({ seed: 5 });
    secs(g, 1.1);
    expect(tramBin(g)).toBeNull();
    g.flags.add('tram');
    secs(g, 1.1);
    const bin = tramBin(g)!;
    expect(bin).toBeTruthy();
    expect([bin.x, bin.y]).toEqual(TRAM.bin);
    expect(bin.st.fixed).toBe(true);
    bin.inv!.add(key('copper_ore'), 30);
    bin.inv!.add(key('stone'), 5);
    bin.inv!.add(key('iron_ore'), 3);
    const cu = key('copper_ore');
    const money0 = g.player.money, earned0 = g.earned;
    g.events.length = 0;
    g.endDay(false);
    const price = freshPrice(g, cu);
    const coins = Math.round(price * TRAM_PREMIUM * TRAM_LOAD);
    expect(g.player.money - money0).toBe(coins);
    expect(g.earned - earned0).toBe(coins);
    expect(bin.inv!.countId('copper_ore')).toBe(10);
    expect(bin.inv!.countId('iron_ore')).toBe(3);
    expect(bin.inv!.countId('stone')).toBe(5);
    expect(market(g).sat[kIdx(cu)] ?? 0).toBe(0);
    expect(toasts(g)).toContain(`The tram sold 20 copper ore in town: ${coins} coins`);
    expect(townworks(g).cart).toBe(20);
    // the next morning: what's left of the ore (13), never the stone
    g.endDay(false);
    expect(bin.inv!.countId('copper_ore') + bin.inv!.countId('iron_ore')).toBe(0);
    expect(bin.inv!.countId('stone')).toBe(5);
    expect(townworks(g).cart).toBe(13);
    // and an empty bin sells nothing
    const m2 = g.player.money;
    g.endDay(false);
    expect(g.player.money).toBe(m2);
    expect(townworks(g).cart).toBe(0);
  });

  it("a save keeps the cart bin with its ore, the keystones' flags and the lamps' link", () => {
    const g = new Game({ seed: 6 });
    for (const f of ['tram', 'town_mill', 'waterworks', 'lamps_hung', 'lamplighting']) g.flags.add(f);
    secs(g, 1.1);
    tramBin(g)!.inv!.add(key('tin_ore'), 7);
    const g2 = reload(g);
    for (const f of ['tram', 'town_mill', 'waterworks', 'lamps_hung', 'lamplighting']) expect(g2.flags.has(f), f).toBe(true);
    const bin = tramBin(g2)!;
    expect([bin.x, bin.y]).toEqual(TRAM.bin);
    expect(bin.inv!.countId('tin_ore')).toBe(7);
    expect(bin.st.fixed).toBe(true);
    secs(g2, 2.1);
    expect(g2.ents.others.filter((e) => e.def.id === 'tram_bin').length).toBe(1);
    // the town line is back on the grid's loads after a load
    expect(g2.sys.powerLoads).toContain(lampLoad(g2));
    // the morning after the load the cart still runs
    g2.endDay(false);
    expect(bin.inv!.countId('tin_ore')).toBe(0);
  });
});

// Phase 4's "done when": the Tram runs on a saved and reloaded game, end to end from the Works tab
describe('the Tram, from its order to a reloaded game', () => {
  it('the rail cart restored and Clockwork Assembly II studied post the order; filled at the board it runs, and runs again after a reload', async () => {
    const { openOrder, boardHandIn } = await import('../src/sim/systems/orders');
    const g = new Game({ seed: 8 });
    secs(g, 1.1);
    expect(openOrder(g, 'w_tram')).toBeNull();
    g.research.done.add('r_assembly2');
    secs(g, 1.1);
    // the cart in the Crystal galleries isn't restored yet: no order
    expect(openOrder(g, 'w_tram')).toBeNull();
    g.flags.add('chamber:cart');
    secs(g, 1.1);
    const o = openOrder(g, 'w_tram')!;
    expect(o).toBeTruthy();
    for (const l of o.lines) g.player.inv.add(key(l.spec), l.n);
    boardHandIn(g, o);
    secs(g, 1.1);
    expect(g.flags.has('tram')).toBe(true);
    tramBin(g)!.inv!.add(key('copper_ore'), 25);
    const g2 = reload(g);
    expect(g2.flags.has('tram')).toBe(true);
    const bin = tramBin(g2)!;
    expect(bin.inv!.countId('copper_ore')).toBe(25);
    const money = g2.player.money;
    g2.endDay(false);
    expect(bin.inv!.countId('copper_ore')).toBe(5);
    expect(g2.player.money).toBeGreaterThan(money);
    expect(townworks(g2).cart).toBe(20);
  });
});
