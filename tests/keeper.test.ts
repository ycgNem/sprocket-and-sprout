// The Keeper's Line (ROADMAP.md 6): the eight-beat opening on the keeper's rusted works.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interactStruct } from '../src/sim/actions';
import { canPlace, deconstruct, place } from '../src/sim/build';
import { key } from '../src/sim/inventory';
import { MState } from '../src/sim/mstate';
import { OPENING } from '../src/sim/opening';
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
    expect(chain.map((q) => q.id)).toEqual(['k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town', 'k8_deeper']);
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

describe('the eight beats', () => {
  it('the bot plays B1-B7 on its own within three days', () => {
    const g = new Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    for (let d = 0; d < 3 && !questSys(g).done.includes('k7_town'); d++) bot.playDay();
    const done = questSys(g).done;
    for (const id of ['k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town']) expect(done, id).toContain(id);
  }, 120000);

  it("B6: the second jar on its own empty chest starves within a minute, on every seed and map", () => {
    const farms = ['classic', 'riverside', 'ruins', 'highlands', 'wildwood'];
    for (let seed = 1; seed <= 150; seed++) {
      const g = new Game({ seed, farm: farms[seed % farms.length] as any });
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
