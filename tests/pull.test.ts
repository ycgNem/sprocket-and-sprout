// Pulling up a crop (the owner after 2.0: there was no way to get rid of one). Two swings of the axe
// or pickaxe pull a living crop up and the first only shakes it, so a stray swing never costs a crop.
// A ripe one drops its harvest, the soil stays tilled, and the hoe and scythe say how it's done.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { PULL_SWINGS, useTool } from '../src/sim/actions';
import { CROPS } from '../src/data/crops';
import { canTill, plant, till } from '../src/sim/systems/farming';
import { kId } from '../src/sim/inventory';
import { Z } from '../src/sim/world/tilemap';

/** a fresh game with a spring crop planted on open farmland */
function planted(seed = 7) {
  const g = new Game({ seed });
  g.player.where = 'world';
  const m = g.map;
  const cr = CROPS.find((c) => c.seasons.includes(0) && !c.giant)!;
  for (let y = 20; y < m.h - 20; y++)
    for (let x = 30; x < m.w - 30; x++) {
      const i = m.idx(x, y);
      if (m.zone[i] !== Z.FARM || !canTill(g, x, y)) continue;
      till(g, x, y);
      plant(g, cr, i);
      return { g, x, y, i, cr };
    }
  throw new Error('no farmland');
}
const toasts = (g: Game) => g.events.filter((e: any) => e.t === 'toast').map((e: any) => e.text as string);

describe('pulling up a crop', () => {
  it('two swings of the pickaxe pull a growing crop up; the soil stays tilled', () => {
    const { g, x, y, i, cr } = planted();
    expect(PULL_SWINGS).toBe(2);
    g.soil.get(i)!.crop!.days = 3;
    g.events.length = 0;
    useTool(g, 'pick', 0, x, y);
    expect(g.soil.get(i)!.crop).not.toBeNull();
    expect(toasts(g).some((t) => t.includes(`pull up the ${cr.name.toLowerCase()}`))).toBe(true);
    useTool(g, 'pick', 0, x, y);
    expect(g.soil.get(i)?.crop).toBeNull();
    expect(g.soil.has(i)).toBe(true);
    // a third swing at the bare soil untills it, as before
    useTool(g, 'pick', 0, x, y);
    expect(g.soil.has(i)).toBe(false);
  });

  it('the axe pulls one up too', () => {
    const { g, x, y, i } = planted(11);
    useTool(g, 'axe', 0, x, y);
    useTool(g, 'axe', 0, x, y);
    expect(g.soil.get(i)?.crop).toBeNull();
  });

  it('swings far apart only shake it', () => {
    const { g, x, y, i } = planted();
    useTool(g, 'pick', 0, x, y);
    for (let k = 0; k < 300; k++) g.tick();
    useTool(g, 'pick', 0, x, y);
    expect(g.soil.get(i)!.crop).not.toBeNull();
  });

  it('a ripe crop drops its harvest when pulled up', () => {
    const { g, x, y, i, cr } = planted();
    const c = g.soil.get(i)!.crop!;
    c.ready = true;
    c.days = 99;
    useTool(g, 'pick', 0, x, y);
    useTool(g, 'pick', 0, x, y);
    expect(g.soil.get(i)?.crop).toBeNull();
    const drops = (g.sys.drops?.list ?? []) as { k: number; n: number }[];
    expect(drops.some((d) => kId(d.k) === cr.produce && d.n > 0)).toBe(true);
  });

  it('the hoe and the scythe say how, once a day', () => {
    const { g, x, y, i } = planted();
    g.events.length = 0;
    useTool(g, 'hoe', 0, x, y);
    useTool(g, 'scythe', 0, x, y);
    expect(g.soil.get(i)!.crop).not.toBeNull();
    expect(toasts(g).filter((t) => /axe or pickaxe/.test(t)).length).toBe(1);
  });
});
