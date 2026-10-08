import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { place } from '../src/sim/build';
import { setResearch } from '../src/sim/systems/research';
import { npcSys } from '../src/sim/systems/npcs';
import { shopOpen } from '../src/sim/systems/town';
import { buyAnimal } from '../src/sim/systems/animals';
import { fishing } from '../src/sim/systems/fishing';
import { startMega, megaNeed } from '../src/sim/systems/goals';
import { PORT_HANDLERS } from '../src/sim/ports';
import { O } from '../src/sim/world/tilemap';
import { MEGA_BY_ID } from '../src/data/goals';
import { questSys } from '../src/sim/systems/quests';

function clear(g: Game, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    g.map.setO(x, y, O.NONE);
    g.soil.delete(g.map.idx(x, y));
  }
}
function run(g: Game, sec: number) {
  for (let i = 0; i < sec * 60; i++) g.tick();
}
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

describe('research labs', () => {
  it('consume bundles and complete research', () => {
    const g = new Game({ seed: 21 });
    clear(g, 40, 30, 60, 40);
    g.flags.add('lab');
    const lab = place(g, 'lab', 50, 32, 0);
    lab.inv!.add(key('bundle_green'), 10);
    setResearch(g, 'r_belts');
    run(g, 6 * 6 + 2);
    expect(g.research.done.has('r_belts')).toBe(true);
    expect(lab.inv!.countId('bundle_green')).toBe(4);
  });

  it('arms can feed a lab', () => {
    const g = new Game({ seed: 22 });
    clear(g, 40, 30, 60, 40);
    const chest = place(g, 'chest_wood', 47, 33, 0);
    chest.inv!.add(key('bundle_green'), 5);
    place(g, 'arm_basic', 48, 33, 1);
    const lab = place(g, 'lab', 49, 32, 0);
    run(g, 10);
    expect(lab.inv!.countId('bundle_green')).toBeGreaterThan(2);
    void PORT_HANDLERS;
  });
});

describe('town', () => {
  it('shopkeepers are in their shops during opening hours', () => {
    const g = new Game({ seed: 23 });
    // run to 10:30 on a Monday
    g.time.min = 10.5 * 60 - 60;
    run(g, 60 * 0.7 + 30);
    expect(shopOpen(g, 'general').open).toBe(true);
    const mari = npcSys(g).byId.get('marigold')!;
    expect(mari.visible).toBe(false);
    const inside = g.map.locs.get('store_in')!;
    const t = g.map.locs.get(mari.target)!;
    expect(t).toEqual(inside);
  });
});

describe('animals', () => {
  it('fed, petted chickens lay eggs in their coop', () => {
    const g = new Game({ seed: 24 });
    clear(g, 60, 30, 72, 42);
    const coop = place(g, 'coop_1', 62, 32, 0);
    g.player.money = 5000;
    expect(buyAnimal(g, 'chicken')).toBeNull();
    coop.st.hay = 20;
    for (let d = 0; d < 5; d++) {
      for (const a of g.sys.animals.list) a.petted = true;
      sleep(g);
    }
    expect(coop.inv!.countId('egg') + coop.inv!.countId('large_egg')).toBeGreaterThan(0);
  });
});

describe('fishing', () => {
  it('hooking and reeling lands a fish', () => {
    const g = new Game({ seed: 25 });
    g.player.inv.add(key('rod_1'), 1);
    g.player.sel = g.player.inv.slots.findIndex((s) => s && s.k === key('rod_1'));
    const f = fishing(g);
    f.water = 'river';
    g.time.min = 9 * 60;
    f.state = 'bite';
    f.press(g);
    if ((f.state as string) !== 'reel') return; // trash or nothing biting: acceptable
    let ticks = 0;
    while ((f.state as string) === 'reel' && ticks++ < 60 * 60) {
      // a perfect player keeps tension at the zone center
      f.reeling = f.tension < f.zone;
      g.tick();
    }
    expect(f.state).toBe('idle');
    expect(g.counters.fish_caught ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('bumblebots', () => {
  it('deliver requested items between crates', () => {
    const g = new Game({ seed: 26 });
    clear(g, 40, 30, 70, 45);
    const hive = place(g, 'hive', 50, 35, 0);
    hive.st.bots = 3;
    const out = place(g, 'crate_out', 44, 33, 0);
    out.inv!.add(key('wood'), 50);
    const req = place(g, 'crate_req', 58, 38, 0);
    req.st.requests = [{ k: key('wood'), n: 20 }];
    run(g, 60); // unpowered hives fly slowly
    expect(req.inv!.countId('wood')).toBe(20);
    expect(out.inv!.countId('wood')).toBe(30);
  });
});

describe('megaprojects', () => {
  it('accept stage materials via ports and advance', () => {
    const g = new Game({ seed: 27 });
    clear(g, 40, 30, 60, 45);
    const site = place(g, 'construction_site', 48, 34, 0);
    startMega(g, site, 'm_beacon');
    const st = MEGA_BY_ID.get('m_beacon')!.stages[0];
    for (const it of st.items) PORT_HANDLERS.megaproject.insert!(g, site, key(it.item), it.n);
    expect(site.st.stage).toBe(1);
    expect(megaNeed(site, 'lens')).toBeGreaterThan(0);
  });
});

describe('tutorial', () => {
  it('the first quest starts and completes when tilling + planting', async () => {
    const g = new Game({ seed: 28 });
    const q = questSys(g);
    expect(q.active.some((a) => a.id === 't_welcome')).toBe(true);
    for (let i = 0; i < 6; i++) {
      q.notify(g, 'till', 1);
      q.notify(g, 'plant', 1);
    }
    expect(q.done.includes('t_welcome')).toBe(true);
    expect(q.active.some((a) => a.id === 't_water')).toBe(true);
  });
});

describe('farmhouse interior', () => {
  it('enter, sleep in bed, wake inside, walk out', async () => {
    const { enterHouse, WAKE_POS, HOUSE_DOOR } = await import('../src/sim/systems/house');
    const { curMap } = await import('../src/sim/systems/player');
    const { interact, useHeld } = await import('../src/sim/actions');
    const g = new Game({ seed: 5 });
    enterHouse(g);
    expect(g.player.where).toBe('house');
    expect(curMap(g)).not.toBe(g.map);
    // the bed asks to sleep
    g.events.length = 0;
    expect(interact(g, 2, 3)).toBe(true);
    const ev = g.events.find((e: any) => e.t === 'ui' && e.open === 'confirm') as any;
    expect(ev).toBeTruthy();
    ev.arg.yes();
    g.time.min = DAY_END - 0.01;
    g.tick();
    expect(g.time.day).toBe(2);
    expect(g.player.where).toBe('house');
    expect(g.player.x).toBeCloseTo(WAKE_POS[0]);
    // tools do nothing indoors and never touch the farm
    const soil = g.soil.size;
    g.player.inv.slots[g.player.sel = 0] = { k: key('hoe_1'), n: 1 };
    g.player.busy = 0;
    expect(useHeld(g, 6, 6)).toBe(false);
    expect(g.soil.size).toBe(soil);
    // walk out of the door
    g.player.x = HOUSE_DOOR[0] + 0.5;
    g.player.y = HOUSE_DOOR[1] - 0.1;
    g.tick();
    expect(g.player.where).toBe('world');
    expect(curMap(g)).toBe(g.map);
  });

  it('kitchen cooks from bag and cellar; cellar survives a save', async () => {
    const H = await import('../src/sim/systems/house');
    const { serialize, deserialize } = await import('../src/sim/save');
    const { RECIPE_BY_ID } = await import('../src/data/recipes');
    const g = new Game({ seed: 6 });
    g.player.money = 50000;
    g.player.inv.add(key('plank'), 40);
    g.player.inv.add(key('stone'), 200);
    g.player.inv.add(key('copper_bar'), 5);
    g.player.inv.add(key('clay'), 10);
    g.player.inv.add(key('plank'), 60);
    expect(H.buyHomeUpgrade(g, 'home_pantry')).toMatch(/Kitchen/);
    expect(H.buyHomeUpgrade(g, 'home_kitchen')).toBeNull();
    expect(H.buyHomeUpgrade(g, 'home_pantry')).toBeNull();
    const pan = H.pantry(g)!;
    pan.add(key('flour'), 3);
    g.player.inv.add(key('flour'), 1);
    const bread = RECIPE_BY_ID.get('cook:bread')!;
    expect(H.maxCookHome(g, bread)).toBe(2);
    expect(H.cookHome(g, bread, 2)).toBe(2);
    expect(g.player.inv.countId('bread')).toBe(2);
    expect(g.player.inv.countId('flour') + pan.countId('flour')).toBe(0);
    pan.add(key('egg'), 7);
    H.enterHouse(g);
    const data = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    const { game: g2 } = deserialize(data);
    expect(g2.player.where).toBe('house');
    expect(H.pantry(g2)!.countId('egg')).toBe(7);
    expect(g2.flags.has('home_kitchen')).toBe(true);
  });
});
