// Phase 3: the sim side of the juice and the first-session fixes (harvest streaks, the
// farmable derelict greenhouse, key prompts, reward events).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interact } from '../src/sim/actions';
import { kDef } from '../src/sim/inventory';
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
  it('names what F does: harvest ripe beans, enter the farmhouse, load the jar', () => {
    const g = new Game({ seed: 5 });
    const [bx, by] = bean(g, 0);
    expect(promptAt(g, bx, by)?.verb).toBe('Harvest');
    const door = g.map.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(promptAt(g, door.door[0], door.y + door.h - 1)?.verb).toBe('Enter');
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
  it('the desk quest completes when a topic is started, not finished (no soft-lock)', async () => {
    const { questSys } = await import('../src/sim/systems/quests');
    const g = new Game({ seed: 6 });
    const q = questSys(g);
    q.active.push({ id: 't_desk', prog: [0, 0], day: 0 });
    g.ents.add('lab', 40, 32, 0);
    g.research.current = 'r_brewing';
    for (let i = 0; i < 61; i++) g.tick();
    expect(q.done).toContain('t_desk');
  });

  it("the keeper's bean chest sits below the jar, with a dozen cogbeans for the feeding arm", async () => {
    const g = new Game({ seed: 6 });
    const chest = g.ents.at(OPENING.chest[0], OPENING.chest[1])!;
    expect(chest.def.id).toBe('chest_wood');
    expect(chest.inv!.countId('cogbean')).toBe(12);
    expect(g.ents.at(OPENING.feedArm[0], OPENING.feedArm[1])).toBeFalsy();
  });

  it('"Meet the Neighbors" counts villagers you already met', async () => {
    const { questSys } = await import('../src/sim/systems/quests');
    const g = new Game({ seed: 6 });
    const q = questSys(g);
    for (const id of ['marigold', 'tobias', 'ottoline']) g.sys.npcs.byId.get(id).met = true;
    q.active.push({ id: 't_town', prog: [0, 0, 0], day: 1 });
    for (let i = 0; i < 61; i++) g.tick();
    expect(q.done).toContain('t_town');
  });
});
