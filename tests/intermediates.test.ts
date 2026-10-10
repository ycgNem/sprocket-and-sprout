// The crop intermediates and the thresher (ROADMAP.md 4.10, Phase 3): what each makes, and the two
// that change a machine (lubricant fitted with F, spirit in a fire box).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { place } from '../src/sim/build';
import { interactStruct } from '../src/sim/actions';
import { key, kDef } from '../src/sim/inventory';
import { machInsert, fuelValue } from '../src/sim/systems/machines';
import { RECIPES } from '../src/data/recipes';

const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
const outOf = (e: { mach?: { outBuf: { k: number; n: number }[] } }, id: string) => (e.mach?.outBuf ?? []).reduce((a, s) => a + (kDef(s.k).id === id ? s.n : 0), 0);

describe('the thresher', () => {
  it('beats a sheaf of wheat into two grain, with straw about half the time, on a powered grid', () => {
    const g = new Game({ seed: 11 });
    g.research.done.add('r_threshing');
    const x = 60, y = 36;
    place(g, 'waterwheel', 90, 36, 0);
    const th = place(g, 'thresher', x, y, 0);
    // a wheel's grid: poles from the wheel to the thresher
    for (const px of [89, 83, 77, 71, 65, 62]) place(g, 'pole_wood', px, y + 2, 0);
    for (let t = 0; t < 6; t++) {
      machInsert(g, th, key('wheat'), 20, true);
      secs(g, 10);
    }
    const grain = outOf(th, 'grain'), straw = outOf(th, 'straw');
    expect(grain).toBeGreaterThan(0);
    expect(grain % 2).toBe(0);
    expect(straw).toBeGreaterThan(0);
    expect(straw).toBeLessThan(grain / 2);
  });

  it('the mill grinds grain to flour, faster than a sheaf of wheat', () => {
    const grain = RECIPES.find((r) => r.id === 'mill:grain')!;
    const wheat = RECIPES.find((r) => r.id === 'mill:flour')!;
    expect(grain.out[0].item).toBe('flour');
    expect(grain.time).toBeLessThan(wheat.time);
  });
});

describe('lubricant', () => {
  it('F holding it fits it to a machine, once: 10% faster for good, and the bottle is used', () => {
    const g = new Game({ seed: 12 });
    const jar = place(g, 'jar', 60, 36, 0);
    g.player.x = 60.5;
    g.player.y = 37.6;
    g.player.inv.add(key('lubricant'), 2);
    g.player.sel = g.player.inv.slots.findIndex((s) => s && kDef(s.k).id === 'lubricant');
    interactStruct(g, jar);
    expect(jar.st.lubed).toBe(true);
    expect(g.player.inv.countId('lubricant')).toBe(1);
    // a second bottle isn't wasted on it
    interactStruct(g, jar);
    expect(g.player.inv.countId('lubricant')).toBe(1);
  });

  it('an oiled crock makes more than a plain one in the same time', () => {
    const g = new Game({ seed: 13 });
    const a = place(g, 'jar', 60, 36, 0), b = place(g, 'jar', 62, 36, 0);
    b.st.lubed = true;
    // fed and emptied all along (a crock holds a few beans at a time and stops when its output is full)
    for (let t = 0; t < 130; t++) {
      for (const e of [a, b]) {
        machInsert(g, e, key('cogbean'), 99, true);
        e.mach!.outBuf = [];
      }
      secs(g, 10);
    }
    const made = (e: typeof a) => e.mach!.made;
    expect(made(b)).toBeGreaterThan(made(a));
  });
});

describe('the other intermediates', () => {
  it('canvas makes belts, starch paste and pigment come from the crock, spirit from the keg', () => {
    const has = (station: string, input: string, output: string) =>
      RECIPES.some((r) => r.station === station && r.in.some((i) => i.item === input) && r.out.some((o) => o.item === output));
    expect(RECIPES.some((r) => r.station === 'hand' && r.in.some((i) => i.item === 'canvas') && r.out[0].item === 'belt_1')).toBe(true);
    expect(has('jar', 'potato', 'starch_paste')).toBe(true);
    expect(has('jar', 'beet', 'pigment')).toBe(true);
    expect(has('keg', 'barley', 'spirit')).toBe(true);
    expect(has('mill', 'rapeseed', 'oil')).toBe(true);
  });

  it('spirit burns for twice a coal', () => {
    expect(fuelValue(key('spirit'))).toBe(2 * fuelValue(key('coal')));
  });
});
