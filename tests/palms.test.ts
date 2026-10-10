// The beach palms after the owner's playtest ("nerf coconut trees, they can be abused"): a wild tree
// gives its seed to one shake a day (a palm's seed is a coconut), a palm holds one coconut and sets
// the next every other summer day, planted palms need the open space fruit trees do, and no palm
// fruits under the greenhouse glass.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game } from '../src/sim/Game';
import { serialize, deserialize } from '../src/sim/save';
import { interact } from '../src/sim/actions';
import { PALM_FRUIT, plantSapling, shakeTree } from '../src/sim/systems/farming';
import { O, Z } from '../src/sim/world/tilemap';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
/** a grown beach palm (its tile index) */
const palmOf = (g: Game) => [...g.map.trees].find(([, t]) => t.species === 'palm' && t.stage >= 4)![0];

describe('beach palms', () => {
  it('shaking a bare palm over and over shakes down at most one coconut a day', () => {
    const g = new Game({ seed: 7 });
    const i = palmOf(g);
    const t = g.map.trees.get(i)!;
    t.fruit = 0;
    let got = 0;
    for (let k = 0; k < 200; k++) for (const o of shakeTree(g, i)) got += o.n;
    expect(got).toBeLessThanOrEqual(1);
    // the day's try is in the save
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(g2.map.trees.get(i)!.shook).toBe(g.dayIndex);
    // F at it is still a shake (a rustle), it just has nothing more today
    const [x, y] = [i % g.map.w, Math.floor(i / g.map.w)];
    expect(interact(g, x, y)).toBe(true);
  });

  it('in summer a palm holds one coconut and sets the next every other day', () => {
    const g = new Game({ seed: 7 });
    g.time.season = 1;
    const i = palmOf(g);
    const t = g.map.trees.get(i)!;
    t.fruit = 0;
    let set = 0;
    for (let d = 0; d < 8; d++) {
      sleep(g);
      g.time.season = 1;
      expect(t.fruit).toBeLessThanOrEqual(PALM_FRUIT);
      set += t.fruit;
      t.fruit = 0;
    }
    expect(set).toBeGreaterThanOrEqual(3);
    expect(set).toBeLessThanOrEqual(5);
  });

  it('a coconut planted on the farm needs open space around it, as a fruit tree does; an acorn does not', () => {
    const g = new Game({ seed: 7 });
    const m = g.map;
    // a clear farm patch
    let spot: [number, number] | null = null;
    for (let y = 10; y < m.h - 10 && !spot; y++)
      for (let x = 10; x < m.w - 10 && !spot; x++) {
        let ok = true;
        for (let yy = y - 1; yy <= y + 1 && ok; yy++)
          for (let xx = x - 1; xx <= x + 2 && ok; xx++) {
            const j = m.idx(xx, yy);
            ok = m.zone[j] === Z.FARM && !m.obj[j] && !g.ents.at(xx, yy) && !m.buildingAt[j];
          }
        if (ok && !plantSapling(g, x, y, 'oak')) spot = [x, y];
      }
    expect(spot).not.toBeNull();
    const [x, y] = spot!;
    // an oak beside an oak: fine; a palm beside a tree: no room
    expect(plantSapling(g, x + 1, y, 'oak')).toBeNull();
    m.setO(x + 1, y, O.NONE);
    m.trees.delete(m.idx(x + 1, y));
    expect(plantSapling(g, x + 1, y, 'palm')).toMatch(/open space/);
  });

  it('a palm in the restored greenhouse bears nothing out of its season; an orchard tree there does', () => {
    const g = new Game({ seed: 7 });
    g.flags.add('greenhouse_fixed');
    const m = g.map;
    const gh = [...Array(m.w * m.h).keys()].filter((j) => m.zone[j] === Z.GREENHOUSE && !m.obj[j]);
    expect(gh.length).toBeGreaterThan(4);
    const put = (j: number, species: string) => m.trees.set(j, { species, stage: 4, days: 2, fruit: 0, tapped: false, hp: 10 });
    put(gh[0], 'palm');
    put(gh[3], 'apple');
    g.time.season = 3;
    for (let d = 0; d < 4; d++) {
      sleep(g);
      g.time.season = 3;
    }
    expect(m.trees.get(gh[0])!.fruit).toBe(0);
    expect(m.trees.get(gh[3])!.fruit).toBeGreaterThan(0);
  });
});
