// A steam drill takes its coal by hand (the owner after 2.0: "it takes coal but it wont take any,
// just open up the ui to pull ore out"): F with fuel in hand loads it, as an arm always could.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, SYSTEMS } from '../src/sim/Game';
import { key, kId } from '../src/sim/inventory';
import { interactStruct } from '../src/sim/actions';
import { promptAt } from '../src/sim/prompts';
import { DRILL_FUEL } from '../src/sim/ports';
import { MState } from '../src/sim/mstate';

const setup = () => {
  const g = new Game({ seed: 1, blank: { w: 40, h: 40 } });
  const e = g.ents.add('drill_steam', 5, 5, 0);
  return { g, e, hold: (id: string, n: number) => (g.player.inv.slots[g.player.sel] = { k: key(id), n }) };
};

describe('the steam drill by hand', () => {
  it('F with coal in hand fuels it, up to what it holds; the bubble says so', () => {
    const { g, e, hold } = setup();
    expect(promptAt(g, 5, 5)?.hint).toMatch(/Needs fuel/);
    hold('coal', 30);
    expect(promptAt(g, 5, 5)?.verb).toBe('Load Coal');
    interactStruct(g, e);
    expect(e.st.fuel && kId(e.st.fuel.k)).toBe('coal');
    expect(e.st.fuel.n).toBe(DRILL_FUEL);
    expect(g.player.inv.countId('coal')).toBe(30 - DRILL_FUEL);
    // full: nothing more goes in
    interactStruct(g, e);
    expect(g.player.inv.countId('coal')).toBe(30 - DRILL_FUEL);
    // another fuel waits for the first to be taken out
    hold('wood', 10);
    interactStruct(g, e);
    expect(g.player.inv.countId('wood')).toBe(10);
    expect(kId(e.st.fuel.k)).toBe('coal');
  });

  it('it burns the coal you gave it, and a collect with coal in hand also fuels it', () => {
    const { g, e, hold } = setup();
    hold('coal', 1);
    interactStruct(g, e);
    SYSTEMS.find((s) => s.name === 'automation')!.tick!(g, 0.1);
    expect(e.st.fuel).toBeNull();
    expect(e.st.burn).toBeGreaterThan(0);
    expect(e.state).toBe(MState.Working);
    // ore waiting and coal in hand: one press takes the ore and loads the coal
    e.inv!.add(key('copper_ore'), 3);
    hold('coal', 4);
    expect(promptAt(g, 5, 5)?.hint).toBe('and load Coal');
    interactStruct(g, e);
    expect(g.player.inv.countId('copper_ore')).toBe(3);
    expect(e.st.fuel.n).toBe(4);
  });
});
