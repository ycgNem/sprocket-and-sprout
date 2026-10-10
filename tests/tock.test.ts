// Tock (Phase 5, the stretch): the Professor's clockwork helper after the Tram follows you and
// winds the spring arms and gleaners it passes that have run down.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, DAY_END } from '../src/sim/Game';
import { serialize, deserialize } from '../src/sim/save';
import { place } from '../src/sim/build';
import { O } from '../src/sim/world/tilemap';
import { tockSys, tockAt } from '../src/sim/systems/tock';
import { interact } from '../src/sim/actions';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const run = (g: Game, sec: number) => { for (let i = 0; i < sec * 60; i++) g.tick(); };
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}
function clear(g: Game, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    g.map.setO(x, y, O.NONE);
    g.soil.delete(g.map.idx(x, y));
  }
}

/** a morning after the Tram's first run: Tock at the door, the player out on the farm */
function withTock(seed = 51) {
  const g = new Game({ seed });
  g.flags.add('tram');
  sleep(g);
  g.sys.house.leave(g);
  g.time.min = 9 * 60;
  return g;
}

describe('Tock', () => {
  it("comes the morning after the Tram, with the Professor's letter; not before", () => {
    const g = new Game({ seed: 50 });
    sleep(g);
    expect(tockSys(g).here).toBe(false);
    g.flags.add('tram');
    sleep(g);
    expect(tockSys(g).here).toBe(true);
    // (a letter waits its turn if another came today)
    const letters = [...g.sys.goals.mail, ...(g.sys.goals.queue ?? [])] as { id: string; from: string }[];
    expect(letters.some((m) => m.id === 'tock' && m.from === 'ottoline')).toBe(true);
  });

  it('follows you, and winds a run-down spring arm it passes (its turns, not yours)', () => {
    const g = withTock();
    const k = tockSys(g);
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
    clear(g, px - 6, py - 4, px + 6, py + 4);
    for (const e of g.ents.all()) if (Math.abs(e.x - px) < 7 && Math.abs(e.y - py) < 5 && !e.st.fixed) g.ents.remove(e);
    const arm = place(g, 'arm_basic', px + 2, py, 1);
    expect(arm.st.wind ?? 0).toBe(0);
    // it trots over from the door
    k.x = px - 4.5;
    k.y = py + 0.5;
    g.player.moving = true;
    run(g, 4);
    expect(arm.st.wind).toBeGreaterThan(0);
    expect(k.today).toBe(1);
    expect(g.counters.tock_wound).toBe(1);
    expect(g.counters.arms_wound ?? 0).toBe(0);
    // a wound arm isn't wound again until it runs down
    run(g, 2);
    expect(k.today).toBe(1);
    // a rusted one is the keeper's to restore, not Tock's to wind
    arm.st.wind = 0;
    arm.st.rust = true;
    run(g, 3);
    expect(k.today).toBe(1);
  });

  it('F says how it is getting on; indoors it waits by the door; it keeps its count through a save', () => {
    const g = withTock(52);
    const k = tockSys(g);
    k.x = g.player.x + 1;
    k.y = g.player.y;
    k.wound = 7;
    expect(tockAt(g, Math.floor(k.x) + 0.5, Math.floor(k.y - 0.3) + 0.5)).toBe(k);
    g.events.length = 0;
    expect(interact(g, Math.floor(k.x), Math.floor(k.y - 0.3))).toBe(true);
    expect(g.events.some((e) => e.t === 'toast' && /Tock/.test((e as { text: string }).text))).toBe(true);
    g.sys.house.enter(g);
    run(g, 6);
    const [dx, dy] = g.map.loc('farmhouse');
    expect(Math.hypot(k.x - (dx + 1.6), k.y - (dy + 1.5))).toBeLessThan(0.5);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(tockSys(g2).here).toBe(true);
    expect(tockSys(g2).wound).toBe(7);
  });
});
