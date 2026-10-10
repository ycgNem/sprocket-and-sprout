// The canonical lines of ROADMAP.md 4.13: built headless, run, and checked for rates (±10%), the
// states every surface reads (src/sim/mstate.ts) and the diagnosis the Lines tab gives.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, NIGHT_SECS } from '../src/sim/Game';
import { place } from '../src/sim/build';
import { key } from '../src/sim/inventory';
import type { Ent } from '../src/sim/ents';
import { MState, isProblem } from '../src/sim/mstate';
import { diagnose } from '../src/sim/lines';
import { powerState, togglePole } from '../src/sim/systems/power';

function blank() {
  const g = new Game({ seed: 1, blank: { w: 40, h: 40 } });
  g.player.x = 39.5;
  g.player.y = 39.5;
  return g;
}
function run(g: Game, seconds: number, every?: (t: number) => void) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    g.tick();
    if (every && i % 60 === 0) every(i / 60);
  }
}
const count = (e: Ent, id: string) => e.inv!.countId(id);
/** structures that would show a glyph right now (a problem state at its root cause is enough here) */
const problems = (g: Game) => g.ents.all().filter((e) => !e.ghost && isProblem(e.state));

describe('L1: chest -> arm -> jar -> arm -> crate', () => {
  it('makes a pickle a minute, every stage keeps up, and nothing shows a glyph', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 2, 5, 0);
    chest.inv!.add(key('cogbean'), 200);
    place(g, 'arm_basic', 3, 5, 1);
    const jar = place(g, 'jar', 4, 5, 0);
    place(g, 'arm_basic', 5, 5, 1);
    const crate = place(g, 'shipping_crate', 6, 5, 0);
    run(g, 60);
    const before = count(crate, 'pickles_cogbean');
    run(g, 300);
    const made = count(crate, 'pickles_cogbean') - before;
    expect(made).toBeGreaterThanOrEqual(4.5);
    expect(made).toBeLessThanOrEqual(5.5);
    // the jar is the line's pace; the arm before it is a queue, the arm after it waits on the jar
    expect(jar.state).toBe(MState.Working);
    expect(problems(g)).toEqual([]);
    const d = diagnose(g, crate);
    expect(d.key).toBe('ok');
    expect(d.gap).toMatch(/preserving crock/i);
    expect(d.gap).toMatch(/17\/day|16\.8\/day/);
  });
});

describe('L2: two jars on one chest fed a bean a minute', () => {
  it('the second jar starves within a minute and the diagnosis names the shared chest', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 2, 5, 0);
    chest.inv!.add(key('cogbean'), 2);
    place(g, 'arm_basic', 3, 5, 1);
    place(g, 'jar', 4, 5, 0);
    place(g, 'arm_basic', 5, 5, 1);
    place(g, 'shipping_crate', 6, 5, 0);
    place(g, 'arm_basic', 2, 6, 2);
    const jar2 = place(g, 'jar', 2, 7, 0);
    place(g, 'arm_basic', 2, 8, 2);
    const crate2 = place(g, 'shipping_crate', 2, 9, 0);
    let starvedAt = -1;
    run(g, 360, (t) => {
      if (t % 60 === 0 && t > 0) chest.inv!.add(key('cogbean'), 1);
      if (starvedAt < 0 && jar2.state === MState.Starved && t > 5) starvedAt = t;
    });
    expect(starvedAt).toBeGreaterThan(0);
    expect(starvedAt).toBeLessThanOrEqual(130);
    expect(jar2.state).toBe(MState.Starved);
    const d = diagnose(g, crate2);
    expect(d.problem?.e).toBe(jar2);
    expect(d.key).toBe('starved:shared');
    expect(d.gap).toMatch(/share one wooden chest/);
    expect(d.fix.length).toBeGreaterThan(10);
  });
});

describe('L3: a splitter feeding two jars', () => {
  it('both jars run, and the full belts in front of them are queues, not blocks', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 2, 5, 0);
    chest.inv!.add(key('cogbean'), 300);
    place(g, 'arm_basic', 3, 5, 1);
    place(g, 'belt_1', 4, 5, 1);
    place(g, 'splitter_1', 5, 5, 1);
    place(g, 'belt_1', 6, 5, 1);
    place(g, 'belt_1', 6, 6, 1);
    const jarA = place(g, 'jar', 7, 5, 0);
    const jarB = place(g, 'jar', 7, 6, 0);
    place(g, 'arm_basic', 8, 5, 1);
    place(g, 'arm_basic', 8, 6, 1);
    const crateA = place(g, 'shipping_crate', 9, 5, 0);
    const crateB = place(g, 'shipping_crate', 9, 6, 0);
    run(g, 60);
    const a0 = count(crateA, 'pickles_cogbean'), b0 = count(crateB, 'pickles_cogbean');
    run(g, 300);
    expect(count(crateA, 'pickles_cogbean') - a0).toBeGreaterThanOrEqual(4.5);
    expect(count(crateB, 'pickles_cogbean') - b0).toBeGreaterThanOrEqual(4.5);
    expect(jarA.state).toBe(MState.Working);
    expect(jarB.state).toBe(MState.Working);
    expect(problems(g)).toEqual([]);
    expect(diagnose(g, crateA).key).toBe('ok');
  });
});

describe('L4: a water wheel + poles + two sawmills (2x the demand)', () => {
  it('both run at half speed, the diagnosis names the gap, and the grid switch fixes it', () => {
    const g = blank();
    place(g, 'waterwheel', 2, 2, 0);
    place(g, 'pole_wood', 4, 2, 0);
    const poleB = place(g, 'pole_wood', 10, 2, 0);
    const sawA = place(g, 'sawmill', 5, 2, 0);
    const sawB = place(g, 'sawmill', 11, 2, 0);
    sawA.mach!.inBuf.set(key('wood'), 999);
    sawB.mach!.inBuf.set(key('wood'), 999);
    place(g, 'arm_basic', 7, 2, 1);
    const crateA = place(g, 'shipping_crate', 8, 2, 0);
    place(g, 'arm_basic', 13, 2, 1);
    place(g, 'shipping_crate', 14, 2, 0);
    run(g, 20);
    const net = powerState(g).nets.get(sawA.net)!;
    expect(net.sat).toBeGreaterThan(0.45);
    expect(net.sat).toBeLessThan(0.55);
    // planks: 2 per 2-second log at full speed = 60/min; at half speed 30/min
    const p0 = count(crateA, 'plank');
    run(g, 60);
    const perMin = count(crateA, 'plank') - p0;
    expect(perMin).toBeGreaterThanOrEqual(27);
    expect(perMin).toBeLessThanOrEqual(33);
    const d = diagnose(g, crateA);
    expect(d.key).toBe('power:brownout');
    expect(d.gap).toMatch(/60 sparks short/);
    expect(d.fix).toMatch(/generator/);
    // switch off the second sawmill's pole: the first runs at full speed
    togglePole(g, poleB);
    run(g, 5);
    expect(sawB.off).toBe(true);
    expect(sawB.state).toBe(MState.Idle);
    expect(powerState(g).nets.get(sawA.net)!.sat).toBeGreaterThan(0.99);
    // at full speed the sawmill makes a batch every 2 s...
    const m1 = sawA.mach!.made;
    run(g, 60);
    expect(sawA.mach!.made - m1).toBeGreaterThanOrEqual(27);
    // ...about 69 items a minute, more than one clockwork arm moves: the arm is now the bottleneck
    run(g, 300);
    expect(diagnose(g, crateA).key).toBe('slow:arm-out');
  });
});

describe('the night shift (ROADMAP.md 4.14)', () => {
  it('runs the works for four hours at 2am, the same with fine and coarse steps', () => {
    const make = () => {
      const g = blank();
      const chest = place(g, 'chest_wood', 2, 5, 0);
      chest.inv!.add(key('cogbean'), 200);
      place(g, 'arm_basic', 3, 5, 1);
      place(g, 'jar', 4, 5, 0);
      place(g, 'arm_basic', 5, 5, 1);
      const out = place(g, 'chest_wood', 6, 5, 0);
      return { g, out };
    };
    const a = make();
    run(a.g, 30);
    const before = count(a.out, 'pickles_cogbean');
    a.g.runWorks(NIGHT_SECS);
    const night = count(a.out, 'pickles_cogbean') - before;
    // 168 s of night: about 2.8 pickles
    expect(night).toBeGreaterThanOrEqual(2);
    expect(night).toBeLessThanOrEqual(4);
    // fine steps against coarse: within 5% over a long stretch
    const b = make(), c = make();
    b.g.runWorks(600, 1);
    c.g.runWorks(600, 4);
    const fb = count(b.out, 'pickles_cogbean'), fc = count(c.out, 'pickles_cogbean');
    expect(Math.abs(fb - fc)).toBeLessThanOrEqual(Math.max(1, fb * 0.05));
  });

  it('endDay runs it before the day turns', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 2, 5, 0);
    chest.inv!.add(key('cogbean'), 50);
    place(g, 'arm_basic', 3, 5, 1);
    place(g, 'jar', 4, 5, 0);
    place(g, 'arm_basic', 5, 5, 1);
    const out = place(g, 'chest_wood', 6, 5, 0);
    run(g, 10);
    const t0 = g.simTime;
    g.endDay(false);
    expect(g.simTime - t0).toBeGreaterThanOrEqual(NIGHT_SECS - 0.1);
    expect(count(out, 'pickles_cogbean')).toBeGreaterThanOrEqual(2);
  });
});

describe('L5: a gleaner on a cogbean field -> arm -> jar -> arm -> crate', () => {
  it('the field is the limit: the jar waits for harvest (no glyph), and the diagnosis says so in numbers', async () => {
    const { till, plant, cropTotal } = await import('../src/sim/systems/farming');
    const { CROP_BY_ID } = await import('../src/data/crops');
    const g = blank();
    const gl = place(g, 'gleaner', 5, 5, 0);
    place(g, 'arm_basic', 6, 5, 1);
    const jar = place(g, 'jar', 7, 5, 0);
    place(g, 'arm_basic', 8, 5, 1);
    const crate = place(g, 'chest_wood', 9, 5, 0);
    const bean = CROP_BY_ID.get('cogbean')!;
    let plants = 0;
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) {
      if (g.ents.at(x, y)) continue;
      expect(till(g, x, y)).toBe(true);
      const i = g.map.idx(x, y);
      plant(g, bean, i);
      const c = g.soil.get(i)!.crop!;
      c.days = cropTotal(bean);
      c.ready = true;
      plants++;
    }
    expect(plants).toBe(7);
    run(g, 13 * 60);
    // the gleaner picked the field; the jar turned the beans into pickles, then ran out
    expect(crate.inv!.countId('pickles_cogbean')).toBeGreaterThanOrEqual(7);
    expect(jar.state).toBe(MState.Idle);
    expect(jar.fieldWait).toBe(true);
    expect(jar.why).toMatch(/Waiting for harvest/);
    expect(gl.state).toBe(MState.Idle);
    expect(gl.why).toMatch(/Next ripe crop/);
    // a healthy, field-limited line: not one warning glyph
    expect(problems(g)).toEqual([]);
    const d = diagnose(g, crate);
    expect(d.key).toBe('field');
    expect(d.gap).toMatch(/cogbean field gives 3\.5\/day; the preserving crock can use 17/);
    expect(d.fix).toMatch(/27 more cogbean plants within a picker/);
  });

  it('hand picks inside the gleaner\'s reach count toward the field, and the diagnosis says how many', async () => {
    const { till, plant, cropTotal, harvest } = await import('../src/sim/systems/farming');
    const { CROP_BY_ID } = await import('../src/data/crops');
    const g = blank();
    const gl = place(g, 'gleaner', 5, 5, 0);
    place(g, 'arm_basic', 6, 5, 1);
    place(g, 'jar', 7, 5, 0);
    place(g, 'arm_basic', 8, 5, 1);
    const crate = place(g, 'chest_wood', 9, 5, 0);
    const bean = CROP_BY_ID.get('cogbean')!;
    const tiles: number[] = [];
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) {
      if (g.ents.at(x, y)) continue;
      till(g, x, y);
      const i = g.map.idx(x, y);
      plant(g, bean, i);
      const c = g.soil.get(i)!.crop!;
      c.days = cropTotal(bean);
      c.ready = true;
      tiles.push(i);
    }
    // the hands get to three plants first (and one outside the reach counts for nothing)
    let hand = 0;
    for (const i of tiles.slice(0, 3)) hand += harvest(g, i)!.reduce((a, s) => a + s.n, 0);
    till(g, 20, 20);
    plant(g, bean, g.map.idx(20, 20));
    Object.assign(g.soil.get(g.map.idx(20, 20))!.crop!, { days: cropTotal(bean), ready: true });
    harvest(g, g.map.idx(20, 20));
    run(g, 13 * 60);
    const day = g.stats.states.day(gl, 'today');
    expect(day.handN).toBe(hand);
    const d = diagnose(g, crate);
    expect(d.key).toBe('field');
    expect(d.gap).toContain(`Your hands took ${hand} of the field's ${hand + day.outN}.`);
  });

  it('the morning belongs to the hands: a crop that ripened today waits for noon', async () => {
    const { till, plant, cropTotal } = await import('../src/sim/systems/farming');
    const { CROP_BY_ID } = await import('../src/data/crops');
    const g = blank();
    const gl = place(g, 'gleaner', 5, 5, 0);
    const i = g.map.idx(4, 4);
    till(g, 4, 4);
    plant(g, CROP_BY_ID.get('cogbean')!, i);
    const c = g.soil.get(i)!.crop!;
    c.days = cropTotal(CROP_BY_ID.get('cogbean')!);
    c.ready = true;
    c.ripeDay = g.dayIndex;
    g.time.min = 8 * 60;
    run(g, 5);
    expect(c.ready).toBe(true);
    expect(gl.why).toMatch(/picks at noon/);
    g.time.min = 12 * 60 + 1;
    run(g, 5);
    expect(g.soil.get(i)!.crop!.ready).toBe(false);
    expect(gl.inv!.countId('cogbean')).toBeGreaterThanOrEqual(1);
  });
});

describe('the field gantry (ROADMAP.md 4.9.1)', () => {
  it('shuttles its rails: waters, picks into its car, sows from its seed bin, and comes back to unload', async () => {
    const { CROP_BY_ID } = await import('../src/data/crops');
    const { cropTotal } = await import('../src/sim/systems/farming');
    const g = blank();
    g.research.done.add('r_gantry');
    place(g, 'waterwheel', 20, 30, 0);
    place(g, 'pole_wood', 13, 31, 0);
    place(g, 'pole_wood', 19, 31, 0);
    // the car across x 10..16 at y 30, travelling north; rails on x 10 and x 16, rows 29..24
    const gan = place(g, 'field_gantry', 10, 30, 0);
    for (let y = 24; y <= 29; y++) {
      place(g, 'rail', 10, y, 0);
      place(g, 'rail', 16, y, 0);
    }
    gan.inv!.add(key('cogbean_seed'), 20);
    run(g, 3);
    expect(gan.st.len).toBe(6);
    expect(gan.strip!.length).toBe(30);
    run(g, 20);
    // one pass sowed the bare strip (it tills the grass first) and watered it
    const sown = gan.strip!.filter(([x, y]) => g.soil.get(g.map.idx(x, y))?.crop).length;
    expect(sown).toBe(20);
    expect(gan.inv!.countId('cogbean_seed')).toBe(0);
    // now ripen the crops: the next pass picks them into the car
    for (const [x, y] of gan.strip!) {
      const c = g.soil.get(g.map.idx(x, y))?.crop;
      if (c) { c.days = cropTotal(CROP_BY_ID.get('cogbean')!); c.ready = true; }
    }
    run(g, 30);
    expect(gan.inv!.countId('cogbean')).toBeGreaterThanOrEqual(20);
    expect(gan.st.dir).toBe(0);
    expect(gan.st.pos).toBe(0);
    // empty seed bin with bare soil left to sow: starved
    run(g, 5);
    expect([MState.Starved, MState.Idle]).toContain(gan.state);
  });

  it('parks instead of shuttling when all it could do is sow out of season or over a dead plant', async () => {
    const { CROP_BY_ID } = await import('../src/data/crops');
    const { till, plant } = await import('../src/sim/systems/farming');
    const g = blank();
    g.research.done.add('r_gantry');
    place(g, 'waterwheel', 20, 30, 0);
    place(g, 'pole_wood', 13, 31, 0);
    place(g, 'pole_wood', 19, 31, 0);
    const gan = place(g, 'field_gantry', 10, 30, 0);
    for (let y = 28; y <= 29; y++) {
      place(g, 'rail', 10, y, 0);
      place(g, 'rail', 16, y, 0);
    }
    // a strip of watered, growing cogbeans but one dead plant, and only winter seeds out of season
    for (let y = 28; y <= 29; y++) for (let x = 11; x <= 15; x++) {
      till(g, x, y);
      const i = g.map.idx(x, y);
      plant(g, CROP_BY_ID.get('cogbean')!, i);
      g.soil.get(i)!.water = true;
    }
    g.soil.get(g.map.idx(13, 28))!.crop!.dead = true;
    const off = [...CROP_BY_ID.values()].find((c) => !c.seasons.includes(g.time.season))!;
    gan.inv!.add(key(off.seed), 5);
    run(g, 30);
    expect(gan.st.dir).toBe(0);
    expect(gan.state).toBe(MState.Idle);
    // with a seed that grows now, the next pass tills the dead plant under and sows it
    gan.inv!.add(key('cogbean_seed'), 1);
    run(g, 20);
    expect(g.soil.get(g.map.idx(13, 28))!.crop?.dead).toBe(false);
    expect(gan.inv!.countId('cogbean_seed')).toBe(0);
  });
});

describe('the wrong input (critic, Phase 1 build review)', () => {
  it('a chest of stone behind a jar: the arm names it, one glyph, and the diagnosis never says "ran dry"', async () => {
    const { glyphFor } = await import('../src/render/glyphs');
    const g = blank();
    const chest = place(g, 'chest_wood', 5, 5, 0);
    chest.inv!.add(key('stone'), 50);
    const arm = place(g, 'arm_basic', 6, 5, 1);
    const jar = place(g, 'jar', 7, 5, 0);
    place(g, 'arm_basic', 8, 5, 1);
    const crate = place(g, 'chest_wood', 9, 5, 0);
    run(g, 20);
    expect(arm.state).toBe(MState.Blocked);
    expect(arm.why).toBe("The preserving crock can't use stone");
    expect(glyphFor(g, arm)).toBe('blocked');
    expect(glyphFor(g, jar)).toBe('dot');
    const d = diagnose(g, crate);
    expect(d.key).toBe('wrong:arm');
    expect(d.gap).toMatch(/can't use stone/);
    expect(d.gap).not.toMatch(/ran dry/);
    expect(d.fix).toMatch(/takes any crop or fruit/);
  });

  it('stone belted into a jar: the belt names it and the arm loading the belt says the belt is full', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 3, 5, 0);
    chest.inv!.add(key('stone'), 50);
    const arm = place(g, 'arm_basic', 4, 5, 1);
    place(g, 'belt_1', 5, 5, 1);
    const end = place(g, 'belt_1', 6, 5, 1);
    place(g, 'jar', 7, 5, 0);
    place(g, 'arm_basic', 8, 5, 1);
    const crate = place(g, 'chest_wood', 9, 5, 0);
    run(g, 40);
    expect(end.state).toBe(MState.Blocked);
    expect(end.why).toBe("The preserving crock can't use stone");
    expect(arm.why).not.toMatch(/won't take|can't use/);
    const d = diagnose(g, crate);
    expect(d.key).toBe('wrong:belt');
    expect(d.gap).toMatch(/can't use stone/);
  });

  it('a machine never fed names what it takes, not a guess', () => {
    const g = blank();
    const chest = place(g, 'chest_wood', 5, 5, 0);
    place(g, 'arm_basic', 6, 5, 1);
    const jar = place(g, 'jar', 7, 5, 0);
    run(g, 5);
    expect(jar.state).toBe(MState.Starved);
    expect(jar.why).not.toBe('Waiting for input');
    expect(jar.why).toBe('Waiting for any crop or fruit');
    void chest;
  });
});
