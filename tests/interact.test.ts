// Who answers one F when several things could (the owner's playtest: the Professor beside the
// keeper's water wheel took the F meant for it; src/sim/near.ts). What stands on the faced tile
// comes first, then the tile's own things, then a villager only near it; a villager arriving for a
// scene stands on a clear tile beside you.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { interact } from '../src/sim/actions';
import { key } from '../src/sim/inventory';
import { RIVER } from '../src/sim/opening';
import { tilePrompt } from '../src/sim/prompts';

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

  it("the Professor's farm-gate scene puts her on a clear tile beside you, not on the wheel you face", () => {
    const g = new Game({ seed: 82, name: 'P', farmName: 'P' });
    secs(g, 1);
    const n = prof(g);
    n.points = 600; // two Trust
    g.time.min = 1100;
    // west of the wheel, facing it (east): the old placement (one tile right) was the wheel itself
    const [wx, wy] = RIVER.wheel;
    g.player.x = wx - 0.5; g.player.y = wy + 1.5; g.player.dir = 1;
    secs(g, 1);
    expect(g.sys.cutscene?.npc).toBe('ottoline');
    const tx = Math.floor(n.x), ty = Math.floor(n.y);
    expect([tx, ty]).not.toEqual([wx, wy + 1]);
    expect(g.map.walkable(tx, ty)).toBe(true);
    expect(g.ents.at(tx, ty)?.def.solid ?? false).toBe(false);
  });
});
