// The Keeper's Line (ROADMAP.md 6): the eight-beat opening on the keeper's rusted works.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interactStruct } from '../src/sim/actions';
import { canPlace, deconstruct, place, rotateStruct } from '../src/sim/build';
import { key } from '../src/sim/inventory';
import { MState } from '../src/sim/mstate';
import { OPENING, RIVER } from '../src/sim/opening';
import { consign, filled, orders } from '../src/sim/systems/orders';
import { powerState } from '../src/sim/systems/power';
import { RECIPES } from '../src/data/recipes';
import { setRecipe } from '../src/sim/systems/machines';
import { T, Z } from '../src/sim/world/tilemap';
import { questSys } from '../src/sim/systems/quests';
import { serialize, deserialize } from '../src/sim/save';
import { QUESTS } from '../src/data/goals';
import { LESSONS } from '../src/data/lessons';
import { Bot } from './bot';
import type { Dir } from '../src/sim/ents';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const at = (g: Game, xy: [number, number]) => g.ents.at(xy[0], xy[1])!;
const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
const put = (g: Game, id: string, xy: [number, number], rot: Dir) => {
  g.player.inv.add(key(id), 1);
  g.player.inv.removeSpec(id, 1);
  const e = place(g, id, xy[0], xy[1], rot);
  g.sys.quests.notify(g, 'build', 1, id);
  return e;
};
const step = (g: Game) => {
  const n = questSys(g).now(g, 1)[0];
  return n ? `${n.id}:${n.index}` : '';
};

describe("the Keeper's Line data", () => {
  it('every beat says why it matters, names its steps for the Now strip, and lives on the main path', () => {
    const chain = QUESTS.filter((q) => q.id.startsWith('k'));
    expect(chain.map((q) => q.id)).toEqual([
      'k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town', 'k8_river', 'k9_bed', 'k9_power', 'k10_mill',
      // each era hands over the next town keystone (the critic's Phase 3+4 C1): Steam, then Clockwork, then the Clock
      'k11_boiler', 'k12_steam', 'k13_waterworks', 'k14_spark', 'k15_lamps', 'k16_tram', 'k17_clock',
    ]);
    for (const q of chain) {
      expect(q.why, q.id).toBeTruthy();
      expect(q.main, q.id).toBe(true);
      expect(q.needFlag, q.id).toBe('keepers_line');
      for (const o of q.objectives) expect(o.label, `${q.id} ${o.t}`).toBeTruthy();
    }
    // no old tutorial quest is left
    expect(QUESTS.some((q) => q.id.startsWith('t_'))).toBe(false);
  });

  it('every lesson card has a title, two lines and a picture', () => {
    for (const l of LESSONS) {
      expect(l.title).toBeTruthy();
      expect(l.text.length).toBe(2);
      expect(l.pic).toBeTruthy();
    }
  });
});

describe('rust and restore', () => {
  it("a rusted piece does nothing, can't be picked up or broken, and F with its part brings it back", () => {
    const g = new Game({ seed: 11 });
    const arm = at(g, OPENING.armTile);
    expect(arm.st.rust).toBe(1);
    // a rusted arm never moves the jar's pickles
    secs(g, 30);
    expect(at(g, OPENING.jar).mach!.outBuf.length).toBeGreaterThan(0);
    expect(deconstruct(g, arm)).toBe(false);
    expect(at(g, OPENING.armTile)).toBe(arm);
    // no mainspring yet: F explains and leaves it rusted
    interactStruct(g, arm);
    expect(arm.st.rust).toBe(1);
    g.player.inv.add(key('spring'), 1);
    interactStruct(g, arm);
    expect(arm.st.rust).toBeUndefined();
    expect(g.player.inv.countId('spring')).toBe(0);
    expect(g.flags.has('lesson:rust')).toBe(true);
    secs(g, 10);
    expect(g.ents.get(g.shipBinId)!.inv!.countSpec('#preserve')).toBeGreaterThan(0);
  });

  it('restoring the desk lets you craft sprout bundles; rust survives a save', () => {
    const g = new Game({ seed: 12 });
    expect(g.flags.has('lab')).toBe(false);
    interactStruct(g, at(g, OPENING.desk));
    expect(g.flags.has('lab')).toBe(true);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(g2.ents.at(OPENING.gleaner[0], OPENING.gleaner[1])!.st.rust).toBe(1);
    expect(g2.ents.at(OPENING.desk[0], OPENING.desk[1])!.st.rust).toBeUndefined();
  });
});

/** skip to a beat: everything before it done, the chain's quests started */
const skipTo = (g: Game, id: string) => {
  const q = questSys(g);
  const ids = QUESTS.filter((x) => x.id.startsWith('k')).map((x) => x.id);
  q.done.push(...ids.slice(0, ids.indexOf(id)));
  q.active = [];
  g.sys.quests.notify(g, 'sleep', 0);
  secs(g, 2);
};
/** run the clock to the next post (noon or 6pm) */
const toPost = (g: Game) => {
  const t = g.time.min < 720 ? 720 : 1080;
  g.time.min = t - 0.05;
  secs(g, 1);
};

describe('B7: the Orders board and consignment', () => {
  it("Rowan's standing order is posted with B7 and fills from a crate tagged for the inn, silver first", () => {
    const g = new Game({ seed: 41 });
    skipTo(g, 'k7_town');
    expect(step(g)).toBe('k7_town:0');
    expect(orders(g).open.filter((o) => o.kind === 'standing').map((o) => o.def)).toEqual(['rowan_pickles']);
    expect(g.flags.has('lesson:consign')).toBe(true);
    g.flags.add('board:read');
    secs(g, 2);
    expect(step(g)).toBe('k7_town:1');
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'rowan';
    bin.inv!.add(key('pickles_cogbean'), 4);
    bin.inv!.add(key('pickles_cogbean', 1), 4);
    const before = g.player.money;
    toPost(g);
    // six to Rowan (silver pays double), the other two to market
    expect(filled(g, 'rowan_pickles')).toBe(1);
    expect(orders(g).rep.rowan).toBe(1);
    expect(bin.inv!.isEmpty()).toBe(true);
    expect(g.player.money - before).toBeGreaterThanOrEqual(2 * 300 + 4 * 150);
    expect(questSys(g).done).toContain('k7_town');
    expect(g.flags.has('recipe_cogbean_oil')).toBe(true);
    secs(g, 1);
    expect(g.flags.has('lesson:recipes')).toBe(true);
  });

  it('a hand delivery at the inn fills it too; an untagged crate sells everything at market', () => {
    const g = new Game({ seed: 42 });
    skipTo(g, 'k7_town');
    const bin = g.ents.get(g.shipBinId)!;
    bin.inv!.add(key('pickles_cogbean'), 3);
    toPost(g);
    expect(orders(g).open.find((o) => o.def === 'rowan_pickles')!.lines[0].have).toBe(0);
    expect(bin.inv!.isEmpty()).toBe(true);
    g.player.inv.add(key('pickles_cogbean'), 7);
    expect(questSys(g).tryDeliver(g, 'rowan', key('pickles_cogbean'))).toBe(true);
    expect(filled(g, 'rowan_pickles')).toBe(1);
    expect(g.player.inv.countId('pickles_cogbean')).toBe(1);
  });
});

describe("B8: the keeper's river works", () => {
  it('stand rusted on the river by the farm gate on every map, the wheel half in the water', () => {
    const farms = ['classic', 'riverside', 'ruins', 'highlands', 'wildwood'];
    for (let seed = 1; seed <= 25; seed++) {
      const g = new Game({ seed, farm: farms[seed % farms.length] as any });
      const wheel = g.ents.at(RIVER.wheel[0], RIVER.wheel[1])!;
      expect(wheel?.def.id, `seed ${seed}`).toBe('waterwheel');
      expect(wheel.st.rust).toBe(1);
      expect(g.map.g(RIVER.wheel[0] + 1, RIVER.wheel[1])).toBe(T.RIVER);
      expect(g.map.g(RIVER.wheel[0] + 1, RIVER.wheel[1] + 1)).toBe(T.RIVER);
      expect(g.map.g(RIVER.wheel[0], RIVER.wheel[1])).not.toBe(T.RIVER);
      for (const xy of [...RIVER.poles, RIVER.mill, RIVER.bin]) expect(g.ents.at(xy[0], xy[1])?.st.rust, `seed ${seed} ${xy}`).toBe(1);
      expect(g.ents.at(RIVER.bin[0], RIVER.bin[1])!.inv!.countId('barley')).toBe(40);
      for (const xy of [RIVER.binArm, RIVER.outArm]) expect(canPlace(g, 'arm_fast', xy[0], xy[1], 1).ok, `seed ${seed}`).toBe(true);
    }
  });

  it('a rusted wheel and poles carry nothing; the mended wheel gives 35 in any weather, and the mill browns out', () => {
    const g = new Game({ seed: 51 });
    skipTo(g, 'k8_river');
    expect(orders(g).open.map((o) => o.def)).toContain('bram_oil');
    const wheel = g.ents.at(RIVER.wheel[0], RIVER.wheel[1])!;
    secs(g, 2);
    expect(wheel.gen!.cap).toBe(0);
    // the wheel needs Bram's five bars
    g.player.inv.add(key('copper_bar'), 3);
    interactStruct(g, wheel);
    expect(wheel.st.rust).toBe(1);
    g.player.inv.add(key('copper_bar'), 2);
    interactStruct(g, wheel);
    expect(wheel.st.rust).toBeUndefined();
    expect(g.player.inv.countId('copper_bar')).toBe(0);
    for (const xy of [...RIVER.poles, RIVER.mill, RIVER.bin]) interactStruct(g, g.ents.at(xy[0], xy[1])!);
    put(g, 'arm_fast', RIVER.binArm, 1);
    put(g, 'arm_fast', RIVER.outArm, 1);
    secs(g, 20);
    const mill = g.ents.at(RIVER.mill[0], RIVER.mill[1])!;
    const net = powerState(g).nets.get(mill.net)!;
    expect(net.cap).toBe(35);
    expect(mill.mach!.made).toBeGreaterThan(0);
    expect(mill.sat).toBeLessThan(0.8);
    expect(g.flags.has('lesson:brownout')).toBe(true);
    expect(g.ents.at(RIVER.meal[0], RIVER.meal[1])!.inv!.countId('barley_flour')).toBeGreaterThan(0);
  });

  it("Governor (the profession): the keeper's browned-out mill runs faster on the same short grid", () => {
    const run = (perk: boolean) => {
      const g = new Game({ seed: 51 });
      skipTo(g, 'k8_river');
      if (perk) g.player.perks.push('clockmaker');
      g.player.inv.add(key('copper_bar'), 5);
      interactStruct(g, g.ents.at(RIVER.wheel[0], RIVER.wheel[1])!);
      for (const xy of [...RIVER.poles, RIVER.mill, RIVER.bin]) interactStruct(g, g.ents.at(xy[0], xy[1])!);
      put(g, 'arm_fast', RIVER.binArm, 1);
      put(g, 'arm_fast', RIVER.outArm, 1);
      secs(g, 20);
      const mill = g.ents.at(RIVER.mill[0], RIVER.mill[1])!;
      return { sat: mill.sat, net: powerState(g).nets.get(mill.net)!.sat };
    };
    const plain = run(false), gov = run(true);
    expect(plain.sat).toBeLessThan(0.8);
    expect(gov.net).toBeLessThan(1);
    expect(gov.sat).toBeCloseTo(Math.min(1, gov.net / 0.75), 5);
    expect(gov.sat).toBeGreaterThan(plain.sat);
  });

  it("Bram's oil: a crock locked mid-batch takes the oil recipe when its batch ends", () => {
    const g = new Game({ seed: 52 });
    skipTo(g, 'k8_river');
    const crock = at(g, OPENING.jar);
    secs(g, 3);
    expect(crock.mach!.crafting).toBe(true);
    setRecipe(g, crock, RECIPES.find((r) => r.id === 'jar:cogbean_oil')!);
    expect(crock.mach!.pending).toBeTruthy();
    secs(g, 70);
    expect(crock.mach!.locked).toBe(true);
    expect(crock.mach!.recipe?.id).toBe('jar:cogbean_oil');
  });
});

describe('the eight beats', () => {
  it("the bot plays the whole Keeper's Line, B1-B8, by day 5 on the eight pacing seeds", () => {
    for (const seed of [2024, 7, 99, 1, 2, 3, 4, 5]) {
      const g = new Game({ seed, name: 'Bot', farmName: 'Bolt' });
      const bot = new Bot(g);
      for (let d = 0; d < 5 && !questSys(g).done.includes('k8_river'); d++) bot.playDay();
      const done = questSys(g).done;
      for (const id of ['k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town', 'k8_river']) expect(done, `seed ${seed} ${id}`).toContain(id);
    }
  }, 600000);

  it('3.2 rule 5: by day 5 the farm is more works than tilled rows', () => {
    const g = new Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    for (let d = 0; d < 5; d++) bot.playDay();
    const farm = (i: number) => g.map.zone[i] === Z.FARM;
    let works = 0;
    for (const e of g.ents.all()) if (!e.ghost && !e.parent && farm(g.map.idx(e.x, e.y))) works += e.w * e.h;
    const tilled = [...g.soil.keys()].filter(farm).length;
    expect(works).toBeGreaterThan(tilled);
  }, 120000);

  it("B6: the second jar on its own empty chest starves within a minute, on every seed and map", () => {
    const farms = ['classic', 'riverside', 'ruins', 'highlands', 'wildwood'];
    for (let seed = 1; seed <= 150; seed++) {
      const g = new Game({ seed, farm: farms[seed % farms.length] as any });
      // B3's arm feeds the keeper's jar from the cellar (without it the keeper's jar starves too: its
      // only other feeder is the rusted belt run, which carries nothing)
      put(g, 'arm_basic', OPENING.feedArm, 0);
      for (const [id, xy, rot] of [['jar', OPENING.jar2, 0], ['chest_wood', OPENING.jar2Chest, 0], ['arm_basic', OPENING.jar2Feed, 0]] as [string, [number, number], Dir][]) {
        expect(canPlace(g, id, xy[0], xy[1], rot).ok, `seed ${seed} ${id}`).toBe(true);
        put(g, id, xy, rot);
      }
      secs(g, 60);
      const jar2 = at(g, OPENING.jar2);
      expect(jar2.state, `seed ${seed}: ${jar2.why}`).toBe(MState.Starved);
      // the keeper's own jar keeps running on the cellar's beans
      expect(at(g, OPENING.jar).state, `seed ${seed}`).not.toBe(MState.Starved);
    }
  }, 120000);

  it('wreck the yard: picking up everything you placed mid-chain never blocks a step', () => {
    const g = new Game({ seed: 21 });
    const q = questSys(g);
    // skip to B3 with the Professor's springs
    q.done.push('k1_line', 'k2_springs');
    q.active = [];
    g.player.inv.add(key('spring'), 1);
    interactStruct(g, at(g, OPENING.armTile));
    g.sys.quests.notify(g, 'sleep', 0);
    for (let i = 0; i < 61; i++) g.tick();
    expect(step(g)).toBe('k3_hands:0');
    // place B3's arm, then wreck everything you own in the yard
    put(g, 'arm_basic', OPENING.feedArm, 0);
    for (const e of g.ents.all()) if (!e.st.rust && !e.st.fixed && !e.st.keeper && e.def.id !== 'chest_wood') deconstruct(g, e);
    expect(g.ents.at(OPENING.feedArm[0], OPENING.feedArm[1])).toBeNull();
    // ... and the step can still be done by placing them again (the restored arm went too)
    put(g, 'arm_basic', OPENING.armTile, 0);
    put(g, 'arm_basic', OPENING.feedArm, 0);
    secs(g, 120);
    expect(q.done).toContain('k3_hands');
  });

  it('saves from 1.x never enter the Keeper\'s Line and keep their desk', () => {
    const g = new Game({ seed: 31 });
    const data = JSON.parse(JSON.stringify(serialize(g, look)));
    // an old save: no Keeper's Line flag, no k quests, an old tutorial id done
    data.flags = data.flags.filter((f: string) => f !== 'keepers_line' && f !== 'lab');
    const g2 = deserialize(data).game;
    const q2 = questSys(g2);
    q2.active = [];
    q2.done = ['t_factory'];
    g2.time.min = 26 * 60 - 0.01;
    g2.tick();
    for (let i = 0; i < 61; i++) g2.tick();
    expect(q2.active.some((a) => a.id.startsWith('k'))).toBe(false);
    expect(g2.flags.has('lab')).toBe(true);
  });
});

describe('the pre-merge review (2.0 beta)', () => {
  it('B5 never waits on a rusted belt that is gone: restoring the belts early counts as looking at them', () => {
    const g = new Game({ seed: 61 });
    for (const xy of OPENING.belts) interactStruct(g, at(g, xy));
    for (const xy of OPENING.belts) expect(at(g, xy).st.rust).toBeFalsy();
    skipTo(g, 'k5_desk');
    interactStruct(g, at(g, OPENING.desk));
    g.sys.quests.notify(g, 'craft', 1, 'bundle_green');
    g.flags.add('study:r_belts');
    secs(g, 2);
    // look (3) and try (4) are already met: the strip moves on to the gleaner's arm
    expect(step(g)).toBe('k5_desk:5');
  });

  it('a recipe picked mid-batch survives a save and still takes when the batch ends', () => {
    const g = new Game({ seed: 62 });
    skipTo(g, 'k8_river');
    const crock = at(g, OPENING.jar);
    secs(g, 3);
    expect(crock.mach!.crafting).toBe(true);
    setRecipe(g, crock, RECIPES.find((r) => r.id === 'jar:cogbean_oil')!);
    const { game: g2 } = deserialize(JSON.parse(JSON.stringify(serialize(g, look))));
    const c2 = at(g2, OPENING.jar);
    expect(c2.mach!.pending?.r?.id).toBe('jar:cogbean_oil');
    secs(g2, 70);
    expect(c2.mach!.recipe?.id).toBe('jar:cogbean_oil');
    expect(c2.mach!.locked).toBe(true);
  });

  it("B2's arm restored over an empty crock: the cellar tips three beans in, once a day", () => {
    const g = new Game({ seed: 64 });
    skipTo(g, 'k2_springs');
    const jar = at(g, OPENING.jar);
    jar.mach!.inBuf.clear();
    jar.mach!.outBuf = [];
    delete at(g, OPENING.armTile).st.rust;
    g.player.inv.removeSpec('cogbean', g.player.inv.countId('cogbean'));
    secs(g, 1);
    const beans = () => [...jar.mach!.inBuf.entries()].reduce((a, [k, n]) => a + (k === key('cogbean') ? n : 0), 0);
    expect(beans() + (jar.working ? 1 : 0)).toBeGreaterThan(0);
    // not again the same day
    jar.mach!.inBuf.clear();
    jar.mach!.outBuf = [];
    jar.working = false;
    secs(g, 1);
    expect(beans()).toBe(0);
  });

  it("the Professor's spare mainspring comes once a day, not every half second", () => {
    const g = new Game({ seed: 63 });
    skipTo(g, 'k5_desk');
    expect(at(g, OPENING.gleanArm).st.rust).toBeTruthy();
    // skipping past B2 left the bag without the Professor's springs: the net sent one
    expect(g.player.inv.countId('spring')).toBe(1);
    // stashed in a chest it isn't lost: no stream of springs the same day
    g.player.inv.removeSpec('spring', 1);
    at(g, OPENING.chest).inv!.add(key('spring'), 1);
    secs(g, 20);
    expect(g.player.inv.countId('spring')).toBe(0);
    // the next morning, one more
    g.goToBed();
    for (let n = 0; g.sleeping && n < 60 * 60 * 30; n++) g.tick();
    secs(g, 1);
    expect(g.player.inv.countId('spring')).toBe(1);
  });

  it('the post fills an order silver first, as a hand delivery does', () => {
    const g = new Game({ seed: 64 });
    skipTo(g, 'k7_town');
    const bin = g.ents.get(g.shipBinId)!;
    bin.st.tag = 'rowan';
    bin.inv!.add(key('pickles_cogbean'), 4);
    bin.inv!.add(key('pickles_cogbean', 1), 4);
    const r = consign(g, [bin]);
    expect(r.total).toBe(4 * 300 + 2 * 150);
    expect(bin.inv!.count(key('pickles_cogbean', 1))).toBe(0);
    expect(bin.inv!.count(key('pickles_cogbean'))).toBe(2);
  });
});

describe("the critic's end-of-Phase-2 fixes", () => {
  it('M1a: the keeper\'s crock run dry at minute 1 is starved (the rusted belt carries nothing), not "waiting for harvest"', () => {
    const g = new Game({ seed: 7 });
    const jar = at(g, OPENING.jar);
    // its last three beans run out in about 45 s at the opening's quick pace
    secs(g, 70);
    expect(jar.state).toBe(MState.Starved);
    expect(jar.why).toBe('Waiting for cogbean');
    expect(jar.fieldWait).toBeFalsy();
  });

  it('C1e: B6\'s second crock waits for cogbeans, like the keeper\'s', () => {
    const g = new Game({ seed: 3 });
    put(g, 'arm_basic', OPENING.feedArm, 0);
    for (const [id, xy, rot] of [['jar', OPENING.jar2, 0], ['chest_wood', OPENING.jar2Chest, 0], ['arm_basic', OPENING.jar2Feed, 0]] as [string, [number, number], Dir][]) put(g, id, xy, rot);
    secs(g, 60);
    expect(at(g, OPENING.jar2).why).toBe('Waiting for cogbean');
  });
});

describe("the owner's notes on the opening (Phase 6)", () => {
  it('B3 counts an arm that takes from the cellar chest into the crock, not an arm anywhere', () => {
    const g = new Game({ seed: 71 });
    skipTo(g, 'k3_hands');
    // an arm put down elsewhere doesn't do B3's job
    put(g, 'arm_basic', OPENING.shareArm, 1);
    secs(g, 1);
    expect(step(g)).toBe('k3_hands:0');
    // on the tile but facing away from the crock, nor does it
    const a = put(g, 'arm_basic', OPENING.feedArm, 2)!;
    secs(g, 1);
    expect(step(g)).toBe('k3_hands:0');
    // turned to face the crock (R), it does
    rotateStruct(g, a);
    rotateStruct(g, a);
    secs(g, 1);
    expect(step(g)).toBe('k3_hands:1');
  });

  it("B3's arm drops into a crock filled by hand at once, not minutes later", () => {
    const g = new Game({ seed: 72 });
    skipTo(g, 'k3_hands');
    at(g, OPENING.jar).mach!.inBuf.set(key('cogbean'), 8);
    put(g, 'arm_basic', OPENING.feedArm, 0);
    secs(g, 10);
    const a = questSys(g).active.find((x) => x.id === 'k3_hands')!;
    expect(a.prog[1]).toBeGreaterThanOrEqual(2);
  });

  it('B3 with every arm placed elsewhere: a spare comes, once a day', () => {
    const g = new Game({ seed: 73 });
    skipTo(g, 'k3_hands');
    g.player.inv.removeSpec('arm_basic', g.player.inv.countId('arm_basic'));
    secs(g, 1);
    expect(g.player.inv.countId('arm_basic')).toBe(1);
    g.player.inv.removeSpec('arm_basic', 1);
    secs(g, 2);
    expect(g.player.inv.countId('arm_basic')).toBe(0);
  });

  it("B5: the gleaner's arm restored and then moved still counts as restored", () => {
    const g = new Game({ seed: 74 });
    for (const xy of OPENING.belts) interactStruct(g, at(g, xy));
    g.player.inv.add(key('spring'), 1);
    interactStruct(g, at(g, OPENING.gleanArm));
    expect(at(g, OPENING.gleanArm).st.rust).toBeFalsy();
    deconstruct(g, at(g, OPENING.gleanArm));
    skipTo(g, 'k5_desk');
    interactStruct(g, at(g, OPENING.desk));
    g.sys.quests.notify(g, 'craft', 1, 'bundle_green');
    g.flags.add('study:r_belts');
    secs(g, 2);
    expect(step(g)).toBe('k5_desk:6');
  });
});
