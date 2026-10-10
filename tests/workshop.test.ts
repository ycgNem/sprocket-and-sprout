// Workshop HQ (ROADMAP.md 7.8, Phase 5): structures indoors in a second entity store, the Workshop
// wing, the drafting table's blueprint library, and the ledger.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { HOUSE_IDS } from '../src/sim/ents';
import { serialize, deserialize } from '../src/sim/save';
import { canPlaceIndoors, placeIndoors, goesIndoors } from '../src/sim/indoors';
import { deconstruct } from '../src/sim/build';
import { machInsert } from '../src/sim/systems/machines';
import { interact } from '../src/sim/actions';
import { solidAt } from '../src/sim/systems/player';
import * as H from '../src/sim/systems/house';
import { addBlueprint, drafting, LIB_MAX } from '../src/sim/drafting';
import type { Blueprint } from '../src/sim/blueprint';
import { O, T } from '../src/sim/world/tilemap';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const reload = (g: Game) => deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

/** a game standing in the farmhouse, away from where the tests build */
function indoors(seed = 31) {
  const g = new Game({ seed });
  H.enterHouse(g);
  g.player.x = 10.5;
  g.player.y = 8.5;
  return g;
}

describe('Workshop HQ: structures indoors', () => {
  it('takes chests, hand-era machines, spring arms, desks and lamps; belts and powered pieces stay outside', () => {
    const g = indoors();
    for (const id of ['chest_wood', 'jar', 'keg', 'furnace', 'arm_basic', 'arm_long', 'arm_filter', 'lab', 'lamp', 'sign']) expect(goesIndoors(id), id).toBe(true);
    expect(canPlaceIndoors(g, 'belt_1', 3, 8, 0).reason).toMatch(/Basement/);
    expect(canPlaceIndoors(g, 'arm_fast', 3, 8, 0).reason).toMatch(/power.*Spring arms work indoors/);
    expect(canPlaceIndoors(g, 'mill', 3, 7, 0).reason).toMatch(/power/);
    expect(canPlaceIndoors(g, 'crate_out', 3, 8, 0).reason).toMatch(/outdoors/);
    expect(canPlaceIndoors(g, 'sprinkler_1', 3, 8, 0).ok).toBe(false);
    expect(canPlaceIndoors(g, 'pole_wood', 3, 8, 0).ok).toBe(false);
  });

  it('goes on the floor only: not the walls, the bed, the doorway or under the player', () => {
    const g = indoors();
    expect(canPlaceIndoors(g, 'chest_wood', 3, 8, 0).ok).toBe(true);
    expect(canPlaceIndoors(g, 'chest_wood', 5, 6, 0).ok).toBe(true); // on the rug
    expect(canPlaceIndoors(g, 'chest_wood', 3, 1, 0).ok).toBe(false); // the wall
    expect(canPlaceIndoors(g, 'chest_wood', 2, 2, 0).reason).toMatch(/taken/); // the bed
    expect(canPlaceIndoors(g, 'chest_wood', H.HOUSE_DOOR[0], H.HOUSE_DOOR[1] - 1, 0).reason).toMatch(/doorway/);
    expect(canPlaceIndoors(g, 'chest_wood', 10, 8, 0).reason).toMatch(/standing/);
    expect(canPlaceIndoors(g, 'chest_wood', H.HOUSE_W + 2, 6, 0).ok).toBe(false); // no wing yet
    const e = placeIndoors(g, 'chest_wood', 3, 8, 0);
    expect(e.id).toBeGreaterThanOrEqual(HOUSE_IDS);
    expect(g.houseEnts.rootAt(3, 8)).toBe(e);
    expect(g.ents.get(e.id)).toBeNull();
    expect(canPlaceIndoors(g, 'jar', 3, 8, 0).reason).toMatch(/already/);
    // the chest blocks the way, like the furniture
    expect(solidAt(g, 3, 8)).toBe(true);
  });

  it('shares the floor with the furniture: neither stands on the other, both stand on a rug', () => {
    const g = indoors();
    g.player.inv.add(key('f_armchair_rose'), 1);
    g.player.inv.add(key('f_rug_blue'), 1);
    placeIndoors(g, 'chest_wood', 3, 8, 0);
    expect(H.placeDecor(g, 'f_armchair_rose', 3, 8)).toMatch(/taken/);
    expect(H.placeDecor(g, 'f_armchair_rose', 2, 8)).toBeNull();
    expect(canPlaceIndoors(g, 'jar', 2, 8, 0).reason).toMatch(/taken/);
    expect(H.placeDecor(g, 'f_rug_blue', 10, 3)).toBeNull();
    expect(canPlaceIndoors(g, 'jar', 10, 3, 0).ok).toBe(true);
  });

  it('a crock indoors pickles while you are out, F loads it, and the night shift runs it', () => {
    const g = indoors();
    const crock = placeIndoors(g, 'jar', 3, 7, 0);
    // F at the crock with beans in hand loads them (the farm's own F)
    g.player.x = 4.5;
    g.player.y = 7.5;
    g.player.inv.slots[(g.player.sel = 0)] = { k: key('cogbean'), n: 3 };
    expect(interact(g, 3, 7)).toBe(true);
    expect(g.player.inv.countId('cogbean')).toBe(0);
    // out on the farm, the indoor crock keeps working
    H.leaveHouse(g);
    expect(g.player.where).toBe('world');
    for (let i = 0; i < 62 * 60; i++) g.tick();
    expect(crock.mach!.made).toBeGreaterThanOrEqual(1);
    expect(crock.mach!.outBuf.some((s) => s.k === key('pickles_cogbean'))).toBe(true);
    // and overnight with the rest of the works: the night's batches count it
    machInsert(g, crock, key('cogbean'), 3, true);
    const before = crock.mach!.made;
    g.events.length = 0;
    sleep(g);
    expect(crock.mach!.made).toBeGreaterThan(before);
    const end = g.events.find((e: any) => e.t === 'dayEnd') as any;
    expect(end.summary.nightBatches).toBeGreaterThan(0);
  });

  it('spring arms tend them: chest, arm, crock, arm, chest runs while you are out and overnight', () => {
    const g = indoors();
    const line = [['chest_wood', 3], ['arm_basic', 4], ['jar', 5], ['arm_basic', 6], ['chest_wood', 7]] as const;
    for (const [id, x] of line) expect(canPlaceIndoors(g, id, x, 7, 1).ok, `${id} at ${x}`).toBe(true);
    const [inp, , crock, , out] = line.map(([id, x]) => placeIndoors(g, id, x, 7, 1));
    // fed by an arm with nothing to bring: waiting for its goods (not "waiting to be fed")
    H.leaveHouse(g);
    for (let i = 0; i < 3 * 60; i++) g.tick();
    expect(crock.why).toMatch(/^Waiting for /);
    inp.inv!.add(key('cogbean'), 4);
    for (let i = 0; i < 80 * 60; i++) g.tick();
    expect(out.inv!.countId('pickles_cogbean')).toBeGreaterThanOrEqual(1);
    // and on the night shift
    const before = crock.mach!.made;
    inp.inv!.add(key('cogbean'), 4);
    sleep(g);
    expect(crock.mach!.made).toBeGreaterThan(before);
  });

  it('saves and loads: the structures, their contents and their store', () => {
    const g = indoors();
    const chest = placeIndoors(g, 'chest_wood', 3, 8, 0);
    chest.inv!.add(key('cogbean'), 5);
    const crock = placeIndoors(g, 'jar', 3, 7, 0);
    crock.mach!.outBuf.push({ k: key('pickles_cogbean'), n: 2 });
    const worldCount = g.ents.all().length;
    const g2 = reload(g);
    expect(g2.ents.all().length).toBe(worldCount);
    const c2 = g2.houseEnts.rootAt(3, 8)!;
    const k2 = g2.houseEnts.rootAt(3, 7)!;
    expect(c2.def.id).toBe('chest_wood');
    expect(c2.id).toBeGreaterThanOrEqual(HOUSE_IDS);
    expect(c2.inv!.countId('cogbean')).toBe(5);
    expect(k2.def.id).toBe('jar');
    expect(k2.mach!.outBuf.find((s) => s.k === key('pickles_cogbean'))?.n).toBe(2);
    // a structure placed after the load still gets a farmhouse id
    H.enterHouse(g2);
    g2.player.x = 10.5;
    g2.player.y = 8.5;
    expect(placeIndoors(g2, 'chest_wood', 2, 8, 0).id).toBeGreaterThanOrEqual(HOUSE_IDS);
  });

  it('quick-stack fills the farmhouse chests that hold the same item', async () => {
    const { quickStack } = await import('../src/sim/quickstack');
    const g = indoors();
    const chest = placeIndoors(g, 'chest_wood', 8, 8, 0);
    chest.inv!.add(key('stone'), 1);
    g.player.inv.slots[14] = { k: key('stone'), n: 30 };
    const r = quickStack(g);
    expect(r).toEqual({ moved: 30, chests: 1, cellar: false });
    expect(chest.inv!.count(key('stone'))).toBe(31);
  });

  it('picking a structure up indoors gives it back with what it held', () => {
    const g = indoors();
    const chest = placeIndoors(g, 'chest_wood', 3, 8, 0);
    chest.inv!.add(key('stone'), 7);
    const stone = g.player.inv.countId('stone'), chests = g.player.inv.countId('chest_wood');
    expect(deconstruct(g, chest)).toBe(true);
    expect(g.houseEnts.rootAt(3, 8)).toBeNull();
    expect(g.player.inv.countId('chest_wood')).toBe(chests + 1);
    expect(g.player.inv.countId('stone')).toBe(stone + 7);
  });
});

describe('Workshop HQ: the wing and the drafting table', () => {
  it('the Workshop opens a stone-floored wing; the drafting table stands in it; both survive a load', () => {
    const g = indoors();
    expect(H.houseMap(g).w).toBe(H.HOUSE_W);
    g.player.money = 10_000;
    g.player.inv.add(key('plank'), 80);
    g.player.inv.add(key('stone'), 60);
    g.player.inv.add(key('copper_bar'), 4);
    expect(H.buyHomeUpgrade(g, 'home_drafting')).toMatch(/first/);
    expect(H.buyHomeUpgrade(g, 'home_workshop')).toBeNull();
    const m = H.houseMap(g);
    expect(m.w).toBe(H.HOUSE_WIDE);
    expect(m.g(H.WING_X + 2, 6)).toBe(T.PATH);
    expect(m.g(H.HOUSE_WIDE - 1, 6)).toBe(T.HOUSEWALL);
    expect(canPlaceIndoors(g, 'keg', H.WING_X + 3, 6, 0).ok).toBe(true);
    placeIndoors(g, 'keg', H.WING_X + 3, 6, 0);
    expect(H.buyHomeUpgrade(g, 'home_drafting')).toBeNull();
    expect(H.houseMap(g).o(H.DRAFTING_AT[0], H.DRAFTING_AT[1])).toBe(O.DRAFTING);
    // the drafting table opens the library; the ledger opens from the old almanac
    g.events.length = 0;
    H.houseInteract(g, H.DRAFTING_AT[0], H.DRAFTING_AT[1]);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'drafting')).toBe(true);
    H.houseInteract(g, 12, 5);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'ledger')).toBe(true);
    const g2 = reload(g);
    expect(H.houseMap(g2).w).toBe(H.HOUSE_WIDE);
    expect(H.houseMap(g2).o(H.DRAFTING_AT[0], H.DRAFTING_AT[1])).toBe(O.DRAFTING);
    expect(g2.houseEnts.rootAt(H.WING_X + 3, 6)?.def.id).toBe('keg');
  });

  it('the library keeps up to twelve named blueprints, numbers repeats, and survives a load', () => {
    const g = new Game({ seed: 32 });
    const bp: Blueprint = {
      w: 3, h: 1,
      items: [
        { def: 'chest_wood', dx: 0, dy: 0, rot: 0 },
        { def: 'arm_filter', dx: 1, dy: 0, rot: 1, filter: [key('cogbean')] },
        { def: 'jar', dx: 2, dy: 0, rot: 0, recipe: 'jar:pickles_cogbean' },
        { def: 'keg', dx: 3, dy: 0, rot: 0, last: 'keg:ale' },
      ],
    };
    expect(addBlueprint(g, 'Pickle line', bp)).toBe(true);
    expect(addBlueprint(g, 'Pickle line', bp)).toBe(true);
    expect(drafting(g).lib.map((e) => e.name)).toEqual(['Pickle line', 'Pickle line 2']);
    expect(addBlueprint(g, 'Empty', { w: 1, h: 1, items: [] })).toBe(false);
    // the saved copy doesn't follow later edits to the tool's
    bp.items.pop();
    expect(drafting(g).lib[0].bp.items).toHaveLength(4);
    addBlueprint(g, 'Thorne: the old press', bp, 'thorne');
    const g2 = reload(g);
    const lib = drafting(g2).lib;
    expect(lib.map((e) => e.name)).toEqual(['Pickle line', 'Pickle line 2', 'Thorne: the old press']);
    expect(lib[2].from).toBe('thorne');
    expect(lib[0].bp.items[1].filter).toEqual([key('cogbean')]);
    expect(lib[0].bp.items[2].recipe).toBe('jar:pickles_cogbean');
    // the recipe an unlocked machine last ran rides along, for the Sprocket Fair's bed
    expect(lib[0].bp.items[3].last).toBe('keg:ale');
    // the item keys are saved as names, so a longer item list later doesn't scramble them
    const raw = JSON.parse(JSON.stringify(serialize(g, look)));
    expect(raw.sys.house.lib[0].bp.items[1].filter).toEqual([['cogbean', 0]]);
    for (let i = lib.length; i < LIB_MAX; i++) expect(addBlueprint(g2, `Line ${i}`, lib[0].bp)).toBe(true);
    expect(addBlueprint(g2, 'One too many', lib[0].bp)).toBe(false);
    expect(drafting(g2).lib).toHaveLength(LIB_MAX);
  });
});

describe('Workshop HQ: the ledger', () => {
  it("records yesterday's sales by customer and keeps them through a load", () => {
    const g = new Game({ seed: 33 });
    expect(H.ledgerDay(g)).toBeNull();
    const bin = g.ents.get(g.shipBinId)!;
    bin.inv!.add(key('pickles_cogbean'), 6);
    sleep(g);
    const L = H.ledgerDay(g)!;
    expect(L).toBeTruthy();
    expect(L.day).toBe(1);
    const row = L.rows.find((r) => r.k === key('pickles_cogbean'));
    expect(row?.n).toBe(6);
    expect(row!.coins).toBeGreaterThan(0);
    expect(L.total).toBeGreaterThan(0);
    const L2 = H.ledgerDay(reload(g))!;
    expect(L2.rows.find((r) => r.k === key('pickles_cogbean'))?.n).toBe(6);
    expect(L2.total).toBe(L.total);
    // the almanac's page: tomorrow, the week ahead, a tip
    const bits = H.almanacBits(g);
    expect(bits.tomorrow).toBeTruthy();
    expect(bits.tip).toBeTruthy();
  });
});
