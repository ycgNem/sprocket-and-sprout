// Phase 3: the sim side of the juice and the first-session fixes (harvest streaks, the
// farmable derelict greenhouse, key prompts, reward events).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interact } from '../src/sim/actions';
import { kDef, key } from '../src/sim/inventory';
import { canTill, inGreenhouse, till } from '../src/sim/systems/farming';
import { promptAt, toolVerb } from '../src/sim/prompts';
import { OPENING } from '../src/sim/systems/modes';
import { GREENHOUSE } from '../src/sim/world/worldgen';

const bean = (g: Game, n: number): [number, number] => [OPENING.beans.x + (n % OPENING.beans.w), OPENING.beans.y + Math.floor(n / OPENING.beans.w)];

describe('harvest streak', () => {
  it('chains hand harvests less than 2 s apart and resets after a pause', () => {
    const g = new Game({ seed: 3 });
    const streaks: number[] = [];
    for (let n = 0; n < 4; n++) {
      const [x, y] = bean(g, n);
      expect(interact(g, x, y)).toBe(true);
      const ev = g.events.filter((e) => e.t === 'harvest').pop() as { streak: number } | undefined;
      streaks.push(ev!.streak);
      g.tickN += 30; // half a second between picks
    }
    expect(streaks).toEqual([1, 2, 3, 4]);
    g.tickN += 200;
    const [x, y] = bean(g, 4);
    interact(g, x, y);
    expect((g.events.filter((e) => e.t === 'harvest').pop() as { streak: number }).streak).toBe(1);
  });

  it('every 10th pick in a streak gives a bonus crop', () => {
    const g = new Game({ seed: 3 });
    // ten ripe radishes in a row on fresh soil
    const y = OPENING.beans.y + 4;
    for (let i = 0; i < 10; i++) {
      const x = 30 + i;
      g.map.obj[g.map.idx(x, y)] = 0;
      g.soil.set(g.map.idx(x, y), { water: true, fert: null, idle: 0, crop: { id: 'radish', days: 9, stage: 9, ready: true, harvests: 0, dead: false, giant: -1, frac: 0 } });
    }
    let bonus = 0;
    for (let i = 0; i < 10; i++) {
      g.events.length = 0;
      interact(g, 30 + i, y);
      const ev = g.events.find((e) => e.t === 'harvest') as { bonus: boolean; streak: number } | undefined;
      if (ev?.bonus) bonus++;
      g.tickN += 20;
    }
    expect(bonus).toBe(1);
    expect(g.counters.best_streak).toBe(10);
  });
});

describe('derelict greenhouse', () => {
  it('can be tilled before it is restored, but only grows in season until then', () => {
    const g = new Game({ seed: 4 });
    const x = GREENHOUSE.x + 2, y = GREENHOUSE.y + 3;
    expect(canTill(g, x, y)).toBe(true);
    till(g, x, y);
    const i = g.map.idx(x, y);
    expect(g.soil.has(i)).toBe(true);
    expect(inGreenhouse(g, i)).toBe(false);
    g.flags.add('greenhouse_fixed');
    expect(inGreenhouse(g, i)).toBe(true);
  });
});

describe('key prompts', () => {
  it('names what F does: harvest ripe beans, enter the farmhouse, open or load the crock', () => {
    const g = new Game({ seed: 5 });
    const [bx, by] = bean(g, 0);
    expect(promptAt(g, bx, by)?.verb).toBe('Harvest');
    const door = g.map.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(promptAt(g, door.door[0], door.y + door.h - 1)?.verb).toBe('Enter');
    // F opens the crock's window until you carry something it takes; then F loads it
    expect(promptAt(g, OPENING.jar[0], OPENING.jar[1])?.verb).toBe('Open');
    g.player.inv.add(key('cogbean'), 2);
    expect(promptAt(g, OPENING.jar[0], OPENING.jar[1])?.verb).toBe('Load');
  });

  it('names what a left click does with the tool in hand', () => {
    const g = new Game({ seed: 5 });
    g.player.sel = g.player.inv.slots.findIndex((s) => !!s && kDef(s.k).tool?.kind === 'hoe');
    const x = GREENHOUSE.x + 4, y = GREENHOUSE.y + 4;
    expect(toolVerb(g, x, y)).toBe('Till');
  });
});


describe('first session after the replay review', () => {
  it("picking Conveyance at the desk completes B5's study step at once (no wait for the study)", async () => {
    const { questSys } = await import('../src/sim/systems/quests');
    const { setResearch } = await import('../src/sim/systems/research');
    const g = new Game({ seed: 6 });
    const q = questSys(g);
    q.active.push({ id: 'k5_desk', prog: [0, 0, 0, 0, 0, 0, 0], day: 0 });
    g.flags.add('lab');
    setResearch(g, 'r_belts');
    for (let i = 0; i < 61; i++) g.tick();
    expect(q.now(g, 1)[0].index).not.toBe(2);
    expect(g.flags.has('study:r_belts')).toBe(true);
  });

  it("the keeper's cellar chest sits below the jar with two dozen beans, and B3's arm tile is free", async () => {
    const g = new Game({ seed: 6 });
    const chest = g.ents.at(OPENING.chest[0], OPENING.chest[1])!;
    expect(chest.def.id).toBe('chest_wood');
    expect(chest.inv!.countId('cogbean')).toBe(24);
    expect(g.ents.at(OPENING.feedArm[0], OPENING.feedArm[1])).toBeFalsy();
  });

  it('F at the jar takes its pickles and asks what to load: the beans go in only when picked', async () => {
    const { interactStruct, loadChoices, loadChosen } = await import('../src/sim/actions');
    const g = new Game({ seed: 6 });
    const jar = g.ents.at(OPENING.jar[0], OPENING.jar[1])!;
    while (!jar.mach!.outBuf.length) g.tick();
    g.player.inv.add(key('cogbean'), 3);
    g.events.length = 0;
    interactStruct(g, jar);
    expect(g.player.inv.countSpec('#preserve')).toBeGreaterThan(0);
    // nothing taken unasked (the owner's playtest): the chooser opens, the beans first
    expect(g.player.inv.countId('cogbean')).toBe(3);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'loadpick' && e.arg === jar.id)).toBe(true);
    expect(loadChoices(g, jar)[0].k).toBe(key('cogbean'));
    expect(loadChosen(g, jar, key('cogbean'))).toBe(3);
    expect(g.player.inv.countId('cogbean')).toBe(0);
  });
});

describe('shake caps (1.2 playtest: dampen the shaking)', () => {
  it('trees and struck structures wobble at most 2 px and the camera at most 3 px', async () => {
    const { wobbleOffset, camShakeOffset, WOBBLE_START, CAM_SHAKE_MAX } = await import('../src/render/shake');
    let maxW = 0, maxC = 0;
    for (let i = 0; i < 400; i++) {
      maxW = Math.max(maxW, Math.abs(wobbleOffset(WOBBLE_START * (i % 7) / 6, i * 0.013)));
      maxC = Math.max(maxC, Math.abs(camShakeOffset(10, (i % 100) / 100)));
    }
    expect(maxW).toBeLessThanOrEqual(2);
    expect(maxC).toBeLessThanOrEqual(CAM_SHAKE_MAX);
    expect(CAM_SHAKE_MAX).toBeLessThanOrEqual(3);
    // the wobble eases out: a nearly spent timer barely moves
    for (let t = 0; t < 2; t += 0.01) expect(Math.abs(wobbleOffset(0.5, t))).toBe(0);
  });
});
