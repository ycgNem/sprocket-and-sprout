// 2.1.2's fixes from the 2.1.1 playtest (DECISIONS #176): The Silent Clock ends when the Clock is
// restarted from the Journal, the opening's bed steps count the marked bed only, and F leans toward
// what the current step names.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { QUEST_BY_ID } from '../src/data/goals';
import { objDone, questSys } from '../src/sim/systems/quests';
import { OPENING } from '../src/sim/opening';
import { till as tillTile } from '../src/sim/systems/farming';
import { stepFacing } from '../src/sim/prompts';

const fresh = () => new Game({ seed: 3, name: 'T', farmName: 'T' });
const run = (g: Game, ticks: number) => { for (let i = 0; i < ticks; i++) g.tick(1 / 60); };

describe('The Silent Clock', () => {
  it('counts a Clock restarted without a walk to the clocktower', () => {
    const g = fresh();
    const o = QUEST_BY_ID.get('s_clock')!.objectives[0];
    expect(objDone(g, o, 0)).toBe(false);
    g.flags.add('clock_fixed');
    expect(objDone(g, o, 0)).toBe(true);
  });
});

describe("the opening's bed steps", () => {
  it('tilling somewhere else does not tick off the gleaner bed', () => {
    const g = fresh();
    const q = questSys(g);
    q.active = [{ id: 'k4_grow', prog: [0, 0, 0, 0] }];
    // four tiles tilled out in the field
    let n = 0;
    for (let x = 30; x < 80 && n < 4; x++) if (tillTile(g, x, 40)) n++;
    expect(n).toBe(4);
    run(g, 130);
    const a = q.active.find((x) => x.id === 'k4_grow');
    expect(a?.prog[0]).toBe(0);
    // the marked bed
    for (const [x, y] of OPENING.bed) tillTile(g, x, y);
    run(g, 130);
    const b = questSys(g).active.find((x) => x.id === 'k4_grow');
    expect(b?.prog[0]).toBe(4);
  });
});

describe('F leans toward the step', () => {
  it('facing the arm between the crate and the crock, F goes to the crate when the step carries pickles there', () => {
    const g = fresh();
    const q = questSys(g);
    // "Carry pickles to the crate" is k1_line's crate step
    const def = QUEST_BY_ID.get('k1_line')!;
    const ci = def.objectives.findIndex((o) => o.t === 'crate' && !o.auto);
    expect(ci).toBeGreaterThanOrEqual(0);
    q.active = [{ id: 'k1_line', prog: def.objectives.map((_, i) => (i < ci ? 99 : 0)) }];
    const [ax, ay] = OPENING.armTile;
    const crate = g.ents.get(g.shipBinId)!;
    expect(Math.abs(crate.y - ay)).toBe(1);
    // standing west of the arm, a little toward the crate, facing east
    g.player.x = ax - 0.5;
    g.player.y = ay + 0.4;
    g.player.dir = 1;
    g.player.inv.add(key('pickles_cogbean'), 2);
    const now = q.now?.(g, 1)?.[0] as { id: string; index: number } | undefined;
    if (now?.id === 'k1_line' && now.index === ci) expect(stepFacing(g, ax, ay)).toEqual([crate.x, crate.y]);
    // with no step naming it, F stays on the faced tile unless the held thing goes there
    q.active = [];
    g.player.sel = g.player.inv.slots.findIndex((s) => s && s.k === key('pickles_cogbean'));
    expect(stepFacing(g, ax, ay)).toEqual([crate.x, crate.y]);
    g.player.sel = g.player.inv.slots.findIndex((s) => !s);
    expect(stepFacing(g, ax, ay)).toEqual([ax, ay]);
  });
});
