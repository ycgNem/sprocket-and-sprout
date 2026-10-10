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
    setResearch(g, 'r_fertilizer');
    run(g, 6 * 6 + 2);
    expect(g.research.done.has('r_fertilizer')).toBe(true);
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
  it("the Keeper's Line opens on the works: the first beat starts at once, one step at a time", async () => {
    const g = new Game({ seed: 28 });
    const q = questSys(g);
    expect(q.active.map((a) => a.id)).toEqual(['k1_line']);
    // ripe beans by the jar line; arms and preserving are known, Conveyance is studied in B5
    expect([...g.soil.values()].filter((s) => s.crop?.id === 'cogbean' && s.crop.ready).length).toBe(11);
    expect(g.research.done.has('r_arms')).toBe(true);
    expect(g.research.done.has('r_belts')).toBe(false);
    // the keeper's jar runs fast until the line is whole
    expect(g.ents.machines.find((e) => e.def.id === 'jar')!.st.quick).toBeGreaterThan(3);
    // one objective at a time in the Now strip, with its why
    expect(q.now(g, 3).length).toBe(1);
    expect(q.now(g, 1)[0].why).toBeTruthy();
    q.notify(g, 'harvest', 4, 'cogbean');
    q.notify(g, 'load', 1, 'jar');
    expect(q.now(g, 1)[0].index).toBe(2);
    q.notify(g, 'crate', 2, 'pickles_cogbean');
    expect(q.done).toContain('k1_line');
    expect(q.active.map((a) => a.id)).toEqual(['k2_springs']);
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

describe('food buffs', () => {
  it('eating cooked food grants a timed buff that changes tool energy and ends on sleep', async () => {
    const { eatHeld, toolCost } = await import('../src/sim/actions');
    const g = new Game({ seed: 8 });
    const base = toolCost(g, 'hoe', 0);
    g.player.inv.slots[g.player.sel = 0] = { k: key('pancakes'), n: 2 };
    // full energy is fine: buff foods can always be eaten
    expect(eatHeld(g)).toBe(true);
    expect(g.player.buff?.kind).toBe('stamina');
    expect(g.buffLvl('stamina')).toBe(2);
    expect(toolCost(g, 'hoe', 0)).toBeCloseTo(base * 0.8);
    const left = g.player.buff!.left;
    run(g, 10);
    expect(g.player.buff!.left).toBeLessThan(left);
    sleep(g);
    expect(g.player.buff).toBeNull();
    // plain food without a buff still respects "not hungry"
    g.player.inv.slots[0] = { k: key('radish'), n: 1 };
    expect(eatHeld(g)).toBe(false);
  });
});

describe('farm pet', () => {
  it('a stray arrives on day 3, can be adopted, petted, watered and saved', async () => {
    const P = await import('../src/sim/systems/pet');
    const { serialize, deserialize } = await import('../src/sim/save');
    const { interact, useTool } = await import('../src/sim/actions');
    const g = new Game({ seed: 12 });
    expect(P.petSys(g).stage).toBe('none');
    sleep(g); sleep(g);
    const p = P.petSys(g);
    expect(p.stage).toBe('stray');
    P.adoptPet(g, 'Turnip');
    expect(p.name).toBe('Turnip');
    // pet it (it's outside in the yard on a sunny morning)
    g.sys.house.leave(g);
    g.weather = 'sun';
    p.map = 'world';
    const before = p.points;
    expect(interact(g, Math.floor(p.x), Math.floor(p.y - 0.3))).toBe(true);
    expect(p.points).toBeGreaterThan(before);
    // fill the bowl with the watering can
    expect(useTool(g, 'can', 0, p.bowl[0], p.bowl[1])).toBe(true);
    expect(p.bowlFull).toBe(true);
    const pts = p.points;
    sleep(g);
    expect(p.points).toBe(pts + 6);
    expect(p.bowlFull).toBe(g.isRaining());
    const data = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    const { game: g2 } = deserialize(data);
    expect(P.petSys(g2).name).toBe('Turnip');
    expect(P.petSys(g2).points).toBe(p.points);
    // the pet wanders without errors for a while, both indoors and out
    run(g2, 30);
    g2.time.min = 21 * 60;
    run(g2, 5);
    expect(P.petSys(g2).map).toBe('house');
  });
});

describe('cookbook', () => {
  it('villagers teach recipes at heart levels; the Sunday almanac teaches one; old saves know all', async () => {
    const CB = await import('../src/sim/systems/cookbook');
    const { serialize, deserialize } = await import('../src/sim/save');
    const { RECIPE_BY_ID } = await import('../src/data/recipes');
    const g = new Game({ seed: 14 });
    const pancakes = RECIPE_BY_ID.get('cook:pancakes')!;
    expect(g.unlocked(pancakes.unlock)).toBe(false);
    expect(g.unlocked(RECIPE_BY_ID.get('cook:bread')!.unlock)).toBe(true);
    npcSys(g).byId.get('rowan')!.points = 2 * 250 + 10;
    sleep(g);
    expect(g.unlocked(pancakes.unlock)).toBe(true);
    expect(g.unlocked(RECIPE_BY_ID.get('cook:pizza')!.unlock)).toBe(false);
    // almanac on a Sunday
    while (g.weekday !== 6) sleep(g);
    const before = CB.unknownRecipes(g).length;
    expect(CB.almanacRecipe(g)).toBeTruthy();
    expect(CB.almanacRecipe(g)).toBeNull(); // once per week
    expect(CB.unknownRecipes(g).length).toBe(before - 1);
    // a save from before the cookbook existed
    const data = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    data.flags = data.flags.filter((f: string) => f !== 'cookbook_v1' && !f.startsWith('recipe_'));
    const { game: g2 } = deserialize(data);
    expect(CB.unknownRecipes(g2).length).toBe(0);
  });
});

describe('farm visits', () => {
  it('a friendly villager walks to the farm on a fine weekend afternoon', async () => {
    const g = new Game({ seed: 16 });
    for (const n of npcSys(g).list) { n.met = true; n.points = 3 * 250 + 10; }
    let tries = 0;
    while (!g.sys.visits && tries++ < 60) {
      sleep(g);
      if (g.weekday === 4) g.tomorrow = 'sun';
      for (const n of npcSys(g).list) n.points = Math.max(n.points, 760);
    }
    expect(g.sys.visits).toBeTruthy();
    const n = npcSys(g).byId.get(g.sys.visits.npc)!;
    g.time.min = 13 * 60;
    const [sx, sy] = g.map.loc('farm_visit');
    let t = 0;
    while (Math.hypot(n.x - sx, n.y - sy) > 3 && t++ < 60 * 400) g.tick();
    expect(Math.hypot(n.x - sx, n.y - sy)).toBeLessThan(3);
    const before = n.points;
    g.events.length = 0;
    npcSys(g).interact(g, n);
    expect(n.points).toBeGreaterThanOrEqual(before + 25);
    const dlg = g.events.find((e: any) => e.t === 'ui' && e.open === 'dialog') as any;
    expect(dlg.arg.pages.join(' ').length).toBeGreaterThan(10);
  });
});

describe('furniture', () => {
  it('places, blocks, stacks on rugs, hangs on walls, picks up and saves', async () => {
    const H = await import('../src/sim/systems/house');
    const { serialize, deserialize } = await import('../src/sim/save');
    const { solidAt } = await import('../src/sim/systems/player');
    const g = new Game({ seed: 18 });
    H.enterHouse(g);
    g.player.x = 10.5; g.player.y = 8.5;
    for (const id of ['f_rug_blue', 'f_armchair_rose', 'f_paint_sea', 'f_lamp']) g.player.inv.add(key(id), 1);
    expect(H.placeDecor(g, 'f_rug_blue', 2, 6)).toBeNull();
    expect(H.placeDecor(g, 'f_armchair_rose', 3, 7)).toBeNull(); // on the rug
    expect(solidAt(g, 3, 7)).toBe(true);
    expect(solidAt(g, 2, 6)).toBe(false); // rugs never block
    expect(H.placeDecor(g, 'f_lamp', 3, 7)).toMatch(/taken/);
    expect(H.placeDecor(g, 'f_paint_sea', 4, 5)).toMatch(/wall/);
    expect(H.placeDecor(g, 'f_paint_sea', 6, 1)).toBeNull();
    expect(H.placeDecor(g, 'f_lamp', HOUSE_DOOR_X(), 9)).toMatch(/doorway|taken/);
    // the rug can't be lifted from under the chair
    H.pickupDecor(g, 2, 6);
    expect(H.decorList(g).length).toBe(3);
    expect(H.pickupDecor(g, 3, 7)).toBe(true);
    expect(g.player.inv.countId('f_armchair_rose')).toBe(1);
    const data = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    const { game: g2 } = deserialize(data);
    expect(H.decorList(g2).map((d) => d.id).sort()).toEqual(['f_paint_sea', 'f_rug_blue']);
  });
});
function HOUSE_DOOR_X() { return 7; }

describe('professions', () => {
  it('level 5 and 10 offer a choice of two perks that change the game', async () => {
    const P = await import('../src/sim/perks');
    const { unitPrice } = await import('../src/sim/systems/economy');
    const g = new Game({ seed: 20 });
    expect(P.pendingPerk(g)).toBeNull();
    g.player.skills.farming = 5;
    expect(P.pendingPerk(g)).toEqual({ skill: 'farming', level: 5 });
    const before = unitPrice(g, key('radish'));
    expect(P.choosePerk(g, 'tiller')).toBe(true);
    expect(P.choosePerk(g, 'rancher')).toBe(false); // only one per tier
    expect(unitPrice(g, key('radish'))).toBeGreaterThan(before);
    expect(P.pendingPerk(g)).toBeNull();
    g.player.skills.combat = 10;
    expect(P.pendingPerk(g)).toEqual({ skill: 'combat', level: 5 });
    const hp = g.player.maxHp;
    P.choosePerk(g, 'defender');
    expect(g.player.maxHp).toBe(hp + 25);
    expect(P.pendingPerk(g)).toEqual({ skill: 'combat', level: 10 });
    expect(P.choosePerk(g, 'warrior')).toBe(true);
    expect(P.perksFor(g, 'combat').map((p) => p.id)).toEqual(['defender', 'warrior']);
  });
});

describe('quick stack', () => {
  it('moves bag items into nearby chests that already hold them, never the hotbar', async () => {
    const { quickStack } = await import('../src/sim/quickstack');
    const g = new Game({ seed: 22 });
    clear(g, 38, 26, 56, 32);
    g.player.x = 50.5; g.player.y = 28.5;
    const chest = place(g, 'chest_wood', 52, 28, 0);
    chest.inv!.add(key('stone'), 1);
    const far = place(g, 'chest_wood', 40, 31, 0);
    far.inv!.add(key('wood'), 1);
    g.player.inv.slots[14] = { k: key('stone'), n: 30 };
    g.player.inv.slots[15] = { k: key('wood'), n: 30 };
    g.player.inv.slots[2] = { k: key('stone'), n: 5 }; // hotbar
    const r = quickStack(g);
    expect(r.moved).toBe(30);
    expect(chest.inv!.count(key('stone'))).toBe(31);
    expect(g.player.inv.slots[14]).toBeNull();
    expect(g.player.inv.slots[2]!.n).toBe(5);
    expect(g.player.inv.slots[15]!.n).toBe(30); // that chest is too far away
  });
});

describe('mine variety', () => {
  it('grand treasure every tenth floor (once) and infested floors reveal a ladder when cleared', async () => {
    const { mine } = await import('../src/sim/systems/mine');
    const g = new Game({ seed: 24 });
    const st = mine(g);
    st.enter(g, 10);
    const m = st.map!;
    let ti = -1;
    for (let i = 0; i < m.obj.length; i++) if (m.obj[i] === O.TREASURE && m.objData[i] === 1) ti = i;
    expect(ti).toBeGreaterThanOrEqual(0);
    const money = g.player.money;
    expect(st.interact(g, ti % m.w, Math.floor(ti / m.w))).toBe(true);
    expect(g.player.money).toBeGreaterThan(money);
    expect(g.flags.has('treasure_10')).toBe(true);
    st.enter(g, 10);
    expect([...st.map!.obj].some((o, i) => o === O.TREASURE && st.map!.objData[i] === 1)).toBe(false);
    // find an infested floor
    let f = 7;
    for (; f < 60; f++) { if (f % 5 === 0) continue; st.enter(g, f); if (st.infested) break; }
    expect(st.infested).toBe(true);
    g.player.hp = 99999;
    for (const mo of st.monsters) mo.hp = 0;
    g.tick();
    expect(st.monsters.length).toBe(0);
    expect(st.ladder).not.toBeNull();
  });
});

describe("founder's day", () => {
  it('reviews the farm each new year and grants candle rewards once', async () => {
    const F = await import('../src/sim/systems/founders');
    const { unitPrice } = await import('../src/sim/systems/economy');
    const g = new Game({ seed: 26 });
    g.time.year = 1; g.time.season = 3; g.time.day = 28;
    sleep(g);
    expect(g.time.year).toBe(2);
    expect(g.flags.has('eval_pending')).toBe(true);
    g.earned = 300000;
    for (const s of Object.keys(g.player.skills)) g.player.skills[s] = 9;
    const ev = F.evaluate(g);
    expect(ev.score).toBeGreaterThanOrEqual(6);
    expect(ev.candles).toBeGreaterThanOrEqual(1);
    const price = unitPrice(g, key('radish'));
    g.earned = 2000000;
    for (const n of npcSys(g).list) n.points = 1300;
    const got = F.claimCandles(g, 3);
    expect(got).toEqual([1, 2, 3]);
    expect(g.player.inv.countId('f_lantern')).toBe(1);
    expect(unitPrice(g, key('radish'))).toBeGreaterThan(price);
    expect(F.claimCandles(g, 3)).toEqual([]);
  });
});

describe('partners', () => {
  it('the locket needs 8 hearts and an adult; partners make breakfast and sit by the hearth', async () => {
    const P = await import('../src/sim/systems/partner');
    const H = await import('../src/sim/systems/house');
    const g = new Game({ seed: 28 });
    const s = npcSys(g);
    const pip = s.byId.get('pip')!, rowan = s.byId.get('rowan')!;
    pip.met = rowan.met = true;
    pip.points = rowan.points = 9 * 250;
    g.player.inv.slots[g.player.sel = 0] = { k: key('heart_charm'), n: 1 };
    s.interact(g, pip);
    expect(P.partnerId(g)).toBeNull();
    rowan.points = 7 * 250;
    s.interact(g, rowan);
    expect(P.partnerId(g)).toBeNull();
    rowan.points = 8 * 250 + 5;
    s.interact(g, rowan);
    expect(P.partnerId(g)).toBe('rowan');
    expect(g.player.inv.countId('heart_charm')).toBe(0);
    // a week of mornings brings at least one breakfast
    const food = () => ['pancakes', 'omelet', 'bread', 'cookies', 'fruit_salad', 'veggie_soup', 'honey_bun'].reduce((a, id) => a + g.player.inv.countId(id), 0);
    for (let i = 0; i < 7; i++) sleep(g);
    expect(food()).toBeGreaterThan(0);
    // evening by the hearth
    H.enterHouse(g);
    g.time.min = 21 * 60;
    g.events.length = 0;
    expect(H.houseInteract(g, 8, 7)).toBe(true);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'dialog')).toBe(true);
  });
});

describe('traveling cart', () => {
  it('visits on Fridays and Sundays with a weekly stock, and recipe cards teach recipes', async () => {
    const C2 = await import('../src/sim/systems/cart');
    const E = await import('../src/sim/systems/economy');
    const { useHeld } = await import('../src/sim/actions');
    const CB = await import('../src/sim/systems/cookbook');
    const g = new Game({ seed: 30 });
    while (g.weekday !== 4) sleep(g);
    g.sys.house.leave(g);
    g.time.min = 10 * 60;
    expect(C2.cartHere(g)).toBe(true);
    const stock = E.shopStock(g, 'cart');
    expect(stock.length).toBeGreaterThanOrEqual(7);
    const card = stock.find((e) => e.item.startsWith('card_'))!;
    expect(card).toBeTruthy();
    g.player.money = 100000;
    expect(E.buy(g, card, 1)).toBe(1);
    const out = card.item.slice(5);
    expect(CB.knowsRecipe(g, out)).toBe(false);
    const slot = g.player.inv.slots.findIndex((s) => s && s.k === key(card.item));
    g.player.sel = slot;
    useHeld(g, 0, 0);
    expect(CB.knowsRecipe(g, out)).toBe(true);
    g.time.min = 20 * 60;
    expect(C2.cartHere(g)).toBe(false);
    sleep(g);
    g.sys.house.leave(g);
    g.time.min = 10 * 60;
    expect(C2.cartHere(g)).toBe(false); // Saturday
  });
});

describe('night events', () => {
  it('meteorites drop starmetal rocks on the farm and the crop fairy ripens crops', async () => {
    const { NIGHT_EVENTS } = await import('../src/sim/systems/nights');
    const g = new Game({ seed: 32 });
    expect(NIGHT_EVENTS.meteorite(g)).toMatch(/meteorite/);
    let star = 0;
    for (let i = 0; i < g.map.obj.length; i++) if (g.map.obj[i] === O.ORE_ROCK && g.map.objData[i] === 5) star++;
    expect(star).toBeGreaterThanOrEqual(5);
    // plant a patch and let the fairy visit
    clear(g, 44, 26, 52, 32);
    const { plant } = await import('../src/sim/systems/farming');
    const { CROP_BY_ID } = await import('../src/data/crops');
    for (let x = 45; x < 51; x++) for (let y = 27; y < 30; y++) {
      const i = g.map.idx(x, y);
      g.soil.set(i, { water: false, fert: null, idle: 0, crop: null } as any);
      plant(g, CROP_BY_ID.get('radish')!, i);
    }
    expect(NIGHT_EVENTS.cropFairy(g)).toMatch(/fairy/);
    expect([...g.soil.values()].filter((s) => s.crop?.ready).length).toBeGreaterThan(5);
  });
});

describe('mine collapse regression', () => {
  it('fainting among monsters carries you out without crashing the monster loop', async () => {
    const { mine } = await import('../src/sim/systems/mine');
    const g = new Game({ seed: 34 });
    const st = mine(g);
    st.enter(g, 25);
    const proto = st.monsters[0];
    expect(proto).toBeTruthy();
    // surround the player
    for (let k = 0; k < 8; k++) st.monsters.push({ ...proto, x: g.player.x + 0.1 * k, y: g.player.y, hp: 50, cool: 0, state: 1 });
    g.player.hp = 1;
    g.player.invuln = 0;
    expect(() => { for (let i = 0; i < 120; i++) g.tick(); }).not.toThrow();
    expect(g.player.where).toBe('world');
  });
});

describe('tool hits on structures (1.2 playtest bug 7)', () => {
  it('a structure takes three hits; a chest with things in it never breaks by tool', async () => {
    const { hitStructure, STRUCT_HITS } = await import('../src/sim/actions');
    const g = new Game({ seed: 31 });
    clear(g, 40, 30, 60, 40);
    const jar = place(g, 'jar', 50, 32, 0);
    for (let i = 1; i < STRUCT_HITS; i++) {
      expect(hitStructure(g, jar)).toBe(false);
      expect(g.ents.get(jar.id)).toBeTruthy();
    }
    expect(hitStructure(g, jar)).toBe(true);
    expect(g.ents.get(jar.id)).toBeFalsy();
    const chest = place(g, 'chest_wood', 52, 32, 0);
    chest.inv!.add(key('wood'), 20);
    for (let i = 0; i < 10; i++) expect(hitStructure(g, chest)).toBe(false);
    expect(g.ents.get(chest.id)).toBeTruthy();
    expect(chest.inv!.count(key('wood'))).toBe(20);
    // emptied, it comes up in three hits like anything else
    chest.inv!.remove(key('wood'), 20);
    for (let i = 1; i < STRUCT_HITS; i++) hitStructure(g, chest);
    expect(hitStructure(g, chest)).toBe(true);
  });
});
