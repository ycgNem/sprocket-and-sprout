import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/Game';
import { place } from '../src/sim/build';
import { key } from '../src/sim/inventory';
import { laneInsert, updateBelts, beltItemCount } from '../src/sim/systems/belts';
import { BeltKind, Dir } from '../src/sim/ents';

function blank() {
  const g = new Game({ seed: 1, blank: { w: 40, h: 40 } });
  g.player.x = 39.5;
  g.player.y = 39.5;
  return g;
}

function run(g: Game, seconds: number) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) g.tick();
}

describe('belts', () => {
  it('moves items along a straight line and hands off between tiles', () => {
    const g = blank();
    for (let x = 0; x < 10; x++) place(g, 'belt_1', x, 5, 1);
    const first = g.ents.at(0, 5)!;
    expect(laneInsert(first.belt!, 0, key('wood'), 0)).toBe(true);
    // belt_1 runs 1.5 tiles/s, so after 4 s the item should be about 6 tiles along
    for (let i = 0; i < 240; i++) updateBelts(g.ents, 1 / 60);
    let found = -1;
    for (let x = 0; x < 10; x++) if (beltItemCount(g.ents.at(x, 5)!) > 0) found = x;
    expect(found).toBeGreaterThanOrEqual(5);
    expect(found).toBeLessThanOrEqual(6);
  });

  it('compresses items at the end of a line with fixed spacing', () => {
    const g = blank();
    for (let x = 0; x < 3; x++) place(g, 'belt_1', x, 5, 1);
    const first = g.ents.at(0, 5)!;
    let inserted = 0;
    for (let t = 0; t < 600; t++) {
      if (laneInsert(first.belt!, 1, key('stone'), 0)) inserted++;
      updateBelts(g.ents, 1 / 60);
    }
    // global positions along the line must keep the minimum spacing
    const pos: number[] = [];
    for (let x = 0; x < 3; x++) for (const p of g.ents.at(x, 5)!.belt!.lanes[1].p) pos.push(x + p);
    pos.sort((a, b) => b - a);
    for (let i = 1; i < pos.length; i++) expect(pos[i - 1] - pos[i]).toBeGreaterThanOrEqual(0.2499);
    expect(pos.length).toBeGreaterThanOrEqual(12);
    expect(inserted).toBe(pos.length);
    const last = g.ents.at(2, 5)!.belt!.lanes[1];
    expect(last.p[0]).toBeCloseTo(1, 5);
    expect(last.p[0] - last.p[1]).toBeCloseTo(0.25, 5);
  });

  it('a belt that ends at a chest or crate delivers into it, and backs up when it is full', () => {
    const g = blank();
    for (let x = 0; x < 3; x++) place(g, 'belt_1', x, 5, 1);
    const chest = place(g, 'chest_wood', 3, 5, 0)!;
    const first = g.ents.at(0, 5)!;
    for (let i = 0; i < 6; i++) {
      laneInsert(first.belt!, i % 2, key('wood'), 0);
      run(g, 0.4);
    }
    run(g, 4);
    expect(chest.inv!.countId('wood')).toBe(6);
    expect(beltItemCount(first) + beltItemCount(g.ents.at(1, 5)!) + beltItemCount(g.ents.at(2, 5)!)).toBe(0);
    // a full chest blocks the line instead of eating goods
    for (let x = 0; x < 3; x++) place(g, 'belt_1', x, 9, 1);
    const full = place(g, 'chest_wood', 3, 9, 0)!;
    while (full.inv!.space(key('stone')) > 0) full.inv!.add(key('stone'), full.inv!.space(key('stone')));
    expect(full.inv!.space(key('wood'))).toBe(0);
    laneInsert(g.ents.at(0, 9)!.belt!, 0, key('wood'), 0);
    run(g, 4);
    expect(full.inv!.countId('wood')).toBe(0);
    expect(beltItemCount(g.ents.at(2, 9)!)).toBe(1);
  });

  it('curves preserve lanes and side-loading merges into the near lane', () => {
    const g = blank();
    // east-going line, then turn south at x=4
    for (let x = 0; x < 4; x++) place(g, 'belt_1', x, 5, 1);
    place(g, 'belt_1', 4, 5, 2);
    place(g, 'belt_1', 4, 6, 2);
    updateBelts(g.ents, 0);
    expect(g.ents.at(4, 5)!.belt!.curve).not.toBe(0);
    // side-load: a belt coming from the west into a straight south-going belt with a feeder behind
    place(g, 'belt_1', 3, 6, 1);
    updateBelts(g.ents, 0);
    const sideFeeder = g.ents.at(3, 6)!;
    expect(sideFeeder.belt!.nextMode).toBeGreaterThanOrEqual(2);
    laneInsert(sideFeeder.belt!, 0, key('wood'), 0.9);
    for (let i = 0; i < 30; i++) updateBelts(g.ents, 1 / 60);
    const target = g.ents.at(4, 6)!.belt!;
    // heading south, the west side is the right-hand lane (lane 1)
    expect(target.lanes[1].k.length + target.lanes[0].k.length).toBe(1);
    expect(target.lanes[1].k.length).toBe(1);
  });

  it('underground belts pair and tunnel items', () => {
    const g = blank();
    place(g, 'belt_1', 0, 10, 1);
    const a = place(g, 'under_1', 1, 10, 1);
    const b = place(g, 'under_1', 4, 10, 1);
    place(g, 'belt_1', 5, 10, 1);
    expect(a.belt!.kind).toBe(BeltKind.UnderIn);
    expect(b.belt!.kind).toBe(BeltKind.UnderOut);
    laneInsert(g.ents.at(0, 10)!.belt!, 0, key('wood'), 0);
    for (let i = 0; i < 60 * 5; i++) updateBelts(g.ents, 1 / 60);
    expect(beltItemCount(g.ents.at(5, 10)!)).toBe(1);
  });

  it('splitters alternate between outputs', () => {
    const g = blank();
    place(g, 'belt_1', 10, 12, 0); // feeder heading north into splitter left half
    place(g, 'splitter_1', 10, 11, 0 as Dir);
    for (let y = 5; y < 11; y++) {
      place(g, 'belt_1', 10, y, 0);
      place(g, 'belt_1', 11, y, 0);
    }
    const feeder = g.ents.at(10, 12)!;
    let n = 0;
    for (let t = 0; t < 60 * 8; t++) {
      if (n < 8 && laneInsert(feeder.belt!, 0, key('wood'), 0)) n++;
      updateBelts(g.ents, 1 / 60);
    }
    let left = 0, right = 0;
    for (let y = 5; y < 11; y++) {
      left += beltItemCount(g.ents.at(10, y)!);
      right += beltItemCount(g.ents.at(11, y)!);
    }
    expect(left + right).toBe(8);
    expect(left).toBe(4);
    expect(right).toBe(4);
  });
});

describe('arms and machines', () => {
  it('a clockwork arm moves items from a chest into a furnace and smelts', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 5, 5, 0);
    chest.inv!.add(key('copper_ore'), 9);
    place(g, 'arm_basic', 6, 5, 1); // facing east: picks from chest (west), drops into furnace (east)
    const furnace = place(g, 'furnace', 7, 5, 0);
    furnace.mach!.fuel = { k: key('coal'), n: 5 };
    run(g, 40);
    const bars = furnace.mach!.outBuf.find((s) => s.k === key('copper_bar'))?.n ?? 0;
    expect(bars).toBeGreaterThanOrEqual(2);
    expect(chest.inv!.count(key('copper_ore'))).toBeLessThan(9);
  });

  it('arms take finished products out of machines onto belts', () => {
    const g = blank();
    const keg = place(g, 'keg', 5, 5, 0);
    keg.mach!.outBuf.push({ k: key('wine_strawberry'), n: 3 });
    place(g, 'arm_basic', 5, 6, 2); // facing south: from keg (north) to belt (south)
    for (let x = 3; x < 9; x++) place(g, 'belt_1', x, 7, 1);
    run(g, 6);
    let onBelt = 0;
    for (let x = 3; x < 9; x++) onBelt += beltItemCount(g.ents.at(x, 7)!);
    expect(onBelt).toBeGreaterThanOrEqual(2);
  });

  it('auto-recipe machines refuse items they cannot use', () => {
    const g = blank();
    const keg = place(g, 'keg', 5, 5, 0);
    const chest = place(g, 'chest_wood', 3, 5, 0);
    chest.inv!.add(key('stone'), 5);
    place(g, 'arm_basic', 4, 5, 1);
    run(g, 5);
    expect(chest.inv!.count(key('stone'))).toBe(5);
    expect(keg.mach!.inBuf.size).toBe(0);
  });

  it('powered machines slow down when the grid is short on power', () => {
    const g = blank();
    g.research.done.add('r_milling');
    const mill = place(g, 'mill', 10, 10, 0);
    const mill2 = place(g, 'mill', 13, 10, 0);
    mill.mach!.inBuf.set(key('wheat'), 2);
    mill2.mach!.inBuf.set(key('wheat'), 2);
    place(g, 'pole_wood', 12, 12, 0);
    // a windmill: wind 1 => 45 sparks vs 100 demand
    g.wind = 1;
    const wm = place(g, 'windmill', 12, 13, 0);
    run(g, 1);
    const ps = g.sys.power;
    const net = ps.nets.get(mill.net);
    expect(mill.net).toBeGreaterThan(0);
    expect(wm.net).toBe(mill.net);
    expect(net.sat).toBeLessThan(1);
    expect(net.sat).toBeGreaterThan(0.2);
    // with satisfaction ~0.45 a 4 s recipe takes ~9 s
    run(g, 5);
    expect(mill.mach!.outBuf.length).toBe(0);
    run(g, 10);
    expect(mill.mach!.outBuf.find((s) => s.k === key('flour'))?.n ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('unpowered machines with no pole have no power', () => {
    const g = blank();
    const mill = place(g, 'mill', 10, 10, 0);
    mill.mach!.inBuf.set(key('wheat'), 1);
    run(g, 6);
    expect(mill.mach!.outBuf.length).toBe(0);
    expect(mill.mach!.status).toBe('No power');
  });

  it('steam engines burn fuel only when there is load', () => {
    const g = blank();
    const eng = place(g, 'steam_engine', 5, 5, 0);
    place(g, 'pole_wood', 7, 5, 0);
    eng.gen!.fuel = { k: key('coal'), n: 3 };
    run(g, 5);
    expect(eng.gen!.fuel!.n).toBe(3);
    g.research.done.add('r_milling');
    const mill = place(g, 'mill', 8, 4, 0);
    mill.mach!.inBuf.set(key('wheat'), 2);
    run(g, 5);
    expect(eng.gen!.fuel!.n).toBeLessThan(3);
    expect(mill.mach!.outBuf.find((s) => s.k === key('flour'))?.n ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('guild contracts', () => {
  it('an arm feeds the freight depot, completing a contract pays and raises rank', async () => {
    const C = await import('../src/sim/systems/contracts');
    const g = blank();
    const gs = C.guild(g);
    gs.unlocked = true;
    C.postContracts(g);
    expect(gs.list.length).toBe(3);
    // replace with a known contract for the test
    gs.list[0] = { id: 'c_test', spec: 'plank', label: 'Test planks', need: 20, have: 0, reward: 1000, rep: 2, done: false };
    const chest = place(g, 'chest_wood', 5, 5, 0);
    chest.inv!.add(key('plank'), 30);
    chest.inv!.add(key('stone'), 10);
    place(g, 'arm_basic', 6, 5, 1);
    place(g, 'freight_depot', 7, 4, 0);
    const money = g.player.money;
    run(g, 90);
    expect(gs.list[0].done).toBe(true);
    expect(g.player.money).toBe(money + 1000);
    expect(chest.inv!.count(key('plank'))).toBe(10);
    // the depot refuses things no contract wants
    expect(chest.inv!.count(key('stone'))).toBe(10);
    expect(C.guildRank(g)).toBe(1);
    expect(C.guildBonus(g)).toBeCloseTo(0.03);
  });
});

describe('logistics settings', () => {
  it('arm stock limit tops a chest up to N and stops', () => {
    const g = blank();
    const src = place(g, 'chest_wood', 5, 5, 0);
    src.inv!.add(key('stone'), 100);
    const arm = place(g, 'arm_basic', 6, 5, 1);
    arm.arm!.limit = 25;
    const dst = place(g, 'chest_wood', 7, 5, 0);
    run(g, 120);
    expect(dst.inv!.count(key('stone'))).toBe(25);
  });

  it('a filtered splitter sends one item left and the rest right', () => {
    const g = blank();
    // belts heading north into a splitter at (5,5)-(6,5)
    place(g, 'belt_1', 5, 7, 0);
    place(g, 'belt_1', 5, 6, 0);
    const sp = place(g, 'splitter_1', 5, 5, 0);
    for (let y = 4; y >= 0; y--) { place(g, 'belt_1', 5, y, 0); place(g, 'belt_1', 6, y, 0); }
    sp.belt!.sFilter = key('stone');
    const feed = g.ents.at(5, 7)!;
    for (let i = 0; i < 12; i++) {
      laneInsert(feed.belt!, 0, i % 2 ? key('stone') : key('wood'), 0.1);
      run(g, 0.6);
    }
    run(g, 10);
    const count = (x: number, k: number) => { let n = 0; for (let y = 0; y <= 4; y++) { const b = g.ents.at(x, y)!.belt!; for (const L of b.lanes) n += L.k.filter((v) => v === k).length; } return n; };
    expect(count(5, key('stone'))).toBeGreaterThan(0);
    expect(count(6, key('stone'))).toBe(0);
    expect(count(5, key('wood'))).toBe(0);
    expect(count(6, key('wood'))).toBeGreaterThan(0);
  });
});

describe('fish ponds', () => {
  it('arms stock a pond; it grows, lays roe, and a jar turns roe into a roe jar', async () => {
    await import('../src/sim/systems/ponds');
    const g = blank();
    const chest = place(g, 'chest_wood', 5, 6, 0);
    chest.inv!.add(key('bluegill'), 3);
    chest.inv!.add(key('thistlefin'), 1);
    place(g, 'arm_basic', 6, 6, 1);
    const pond = place(g, 'fish_pond', 7, 5, 0);
    run(g, 30);
    expect(pond.st.fish).toBe('bluegill');
    expect(pond.st.pop).toBe(3);
    expect(chest.inv!.count(key('thistlefin'))).toBe(1); // legends stay out
    for (let d = 0; d < 6; d++) for (const s of (await import('../src/sim/Game')).SYSTEMS) if (s.name === 'ponds') s.dayEnd!(g, {} as any);
    expect(pond.st.pop).toBeGreaterThan(3);
    expect(pond.inv!.count(key('roe'))).toBeGreaterThan(0);
    const jar = place(g, 'jar', 12, 12, 0);
    jar.mach!.inBuf.set(key('roe'), 5);
    run(g, 100);
    expect(jar.mach!.outBuf.find((s) => s.k === key('caviar'))?.n ?? 0).toBeGreaterThanOrEqual(1);
  });
});
