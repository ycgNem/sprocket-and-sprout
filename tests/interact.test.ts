// Who answers one F when several things could (the owner's playtest: the Professor beside the
// keeper's water wheel took the F meant for it; src/sim/near.ts). What stands on the faced tile
// comes first, then the tile's own things, then a villager only near it.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interact } from '../src/sim/actions';
import { key } from '../src/sim/inventory';
import { RIVER } from '../src/sim/opening';
import { tilePrompt } from '../src/sim/prompts';
import { CROP_BY_ID } from '../src/data/crops';
import { plant, till } from '../src/sim/systems/farming';
import { GREENHOUSE } from '../src/sim/world/worldgen';

const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
const prof = (g: Game) => (g.sys.npcs as any).byId.get('ottoline');

describe('one F, several answers', () => {
  it('a villager only beside the water wheel lets F restore the wheel; one on the faced tile is talked to', () => {
    const g = new Game({ seed: 81, name: 'P', farmName: 'P' });
    secs(g, 1);
    const [wx, wy] = RIVER.wheel;
    const wheel = g.ents.at(wx, wy)!;
    expect(wheel.st.rust).toBeTruthy();
    g.player.inv.add(key(wheel.st.need), wheel.st.needN ?? 1);
    // the player north of the wheel, facing it; the Professor beside it, close enough to be "near"
    g.player.x = wx + 0.5; g.player.y = wy - 0.4; g.player.dir = 2;
    const n = prof(g);
    n.visible = true; n.path = []; n.x = wx + 1.3; n.y = wy + 1.4;
    expect((g.sys.npcs as any).at(g, wx + 0.5, wy + 0.5)).toBe(n);
    expect(tilePrompt(g, wx, wy)?.verb).toBe('Restore');
    expect(interact(g, wx, wy)).toBe(true);
    expect(wheel.st.rust).toBeFalsy();
    expect(n.talked).toBeFalsy();
    // standing on the faced tile itself, she answers
    const [px, py] = [wx - 3, wy - 1];
    n.x = px + 0.5; n.y = py + 0.9;
    expect(tilePrompt(g, px, py)?.verb).toMatch(/Talk to|Chat with/);
    interact(g, px, py);
    expect(n.talked).toBe(true);
  });
});

describe('the greenhouse back wall', () => {
  // the owner after 2.0: hops planted against the greenhouse wall couldn't be picked. The wall is a
  // two-row building and F counted the row under it as its door's step, since the first build.
  it('a ripe crop in a bed along the wall is picked with F, by the door too; an empty bed by the door still says why the roof matters', () => {
    const g = new Game({ seed: 7 });
    g.player.where = 'world';
    g.time.season = 1;
    const y = GREENHOUSE.y + 2;
    const door = GREENHOUSE.x + Math.floor(GREENHOUSE.w / 2);
    const hops = CROP_BY_ID.get('hops')!;
    for (const x of [GREENHOUSE.x + 1, door]) {
      const i = g.map.idx(x, y);
      expect(till(g, x, y)).toBe(true);
      expect(plant(g, hops, i)).toBe(true);
      const c = g.soil.get(i)!.crop!;
      c.ready = true;
      c.days = 11;
      c.stage = 4;
      expect(tilePrompt(g, x, y)?.verb).toBe('Harvest');
      const had = g.player.inv.countId('hops');
      expect(interact(g, x, y)).toBe(true);
      expect(g.player.inv.countId('hops')).toBeGreaterThan(had);
      // hops regrow: the plant stays on its trellis
      expect(g.soil.get(i)!.crop?.id).toBe('hops');
    }
    g.events.length = 0;
    expect(interact(g, door + 1, y)).toBe(true);
    expect(g.events.some((e: any) => e.t === 'toast' && /glass roof is broken/.test(e.text))).toBe(true);
  });
});
