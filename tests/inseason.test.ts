// Orders ask for goods in season (DECISIONS #165): an item's seasons follow its recipes back to what
// grows (bread to the grain, pickled cogbeans to the cogbeans); today's asks, the Guild's contracts
// and a business's weekly renewals only ask for what's in season, and the board says who's waiting.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { REQUEST_POOL } from '../src/data/goals';
import { CONTRACT_POOL } from '../src/data/contracts';
import { inSeason, specMask } from '../src/sim/seasonal';
import { offSeason, orders, postContracts } from '../src/sim/systems/orders';

const SP = 0, SU = 1, FA = 2, WI = 3;
const seasons = (spec: string) => [SP, SU, FA, WI].filter((s) => inSeason(spec, s));

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

describe('goods in season', () => {
  it('follows recipes back to the crops, fish and forage they need', () => {
    expect(seasons('wheat')).toEqual([SU, FA]);
    // bread takes flour or meal: wheat and corn in summer and fall, barley in spring; none in winter
    expect(inSeason('bread', WI)).toBe(false);
    expect(inSeason('bread', SU)).toBe(true);
    expect(seasons('pickles_cogbean')).toEqual([SP, SU]);
    expect(seasons('chanterelle')).toEqual([FA]);
    // what isn't grown is had all year: ore, eggs, wool (so cloth too), coal
    for (const id of ['copper_bar', 'egg', 'cloth', 'coal', 'hay']) expect(specMask(id), id).toBe(0b1111);
    // a tag is in season when anything it takes is
    expect(inSeason('#flour', SP)).toBe(true);
    expect(inSeason('#flour', WI)).toBe(false);
  });

  it("winter's asks and contracts are all for goods in season", () => {
    const g = new Game({ seed: 12 });
    g.sys.quests.done.push('k9_bed');
    g.flags.add('town_mill');
    const os = orders(g);
    os.guild.unlocked = true;
    os.rep.guild = 500;
    g.time.season = WI;
    for (let d = 0; d < 10; d++) {
      g.time.day = 2 + d;
      sleep(g);
      postContracts(g);
      for (const o of os.open.filter((x) => x.kind === 'today' || x.kind === 'guild')) {
        const named = REQUEST_POOL.find((r) => o.def === `req:${r.npc}:${r.item}`)?.seasons;
        expect(named ? named.includes(WI) : inSeason(o.lines[0].spec, WI), o.def).toBe(true);
      }
    }
    // the pool still has winter contracts to offer, but not the bread one
    expect(CONTRACT_POOL.some((c) => c.spec === 'bread')).toBe(true);
    expect(os.open.some((o) => o.kind === 'guild')).toBe(true);
    expect(os.open.some((o) => o.kind !== 'standing' && o.lines[0].spec === 'bread')).toBe(false);
  });

  it("a business's weekly bread waits for its season, and the board says so; a first order never waits", () => {
    const g = new Game({ seed: 5 });
    g.flags.add('town_mill');
    const os = orders(g);
    // the Mill's first bread order is posted whatever the season
    g.time.season = WI;
    g.time.day = 3;
    sleep(g);
    expect(os.open.some((o) => o.def === 'rowan_bread')).toBe(true);
    // once it's been filled, the weekly renewal waits for spring
    os.open = os.open.filter((o) => o.def !== 'rowan_bread');
    os.filled.rowan_bread = 1;
    g.time.day = 7; // Sunday: the next morning is a Monday
    sleep(g);
    expect(g.weekday).toBe(0);
    expect(os.open.some((o) => o.def === 'rowan_bread')).toBe(false);
    expect(offSeason(g).map((d) => d.id)).toContain('rowan_bread');
    // the first Monday of spring it's back
    g.time.season = SP;
    g.time.year++;
    g.time.day = 7;
    sleep(g);
    expect(g.weekday).toBe(0);
    expect(os.open.some((o) => o.def === 'rowan_bread')).toBe(true);
    expect(offSeason(g).map((d) => d.id)).not.toContain('rowan_bread');
  });
});
