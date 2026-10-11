// The kelp check (DECISIONS #150): the beach keeps its own count of finds, so the woods filling the
// map's forage never leave it bare (it did, within a week, and kelp ran dry), kelp is one beach find
// in four, a trap set in the sea brings up kelp for half its junk, and kelp says where to get it.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { place } from '../src/sim/build';
import { BEACH, BEACH_CAP } from '../src/sim/systems/farming';
import { SEA_JUNK } from '../src/sim/systems/automation';
import { kId } from '../src/sim/inventory';
import { SOURCE } from '../src/data/sources';
import { O, T, Z } from '../src/sim/world/tilemap';

const finds = (g: Game) => {
  let beach = 0, inland = 0;
  for (const [i] of g.map.forage) {
    if (g.map.zone[i] === Z.BEACH) beach++;
    else inland++;
  }
  return { beach, inland };
};
/** pick up everything on the beach; what was there */
const comb = (g: Game) => {
  const m = g.map, got: string[] = [];
  for (const [i, id] of [...m.forage]) {
    if (m.zone[i] !== Z.BEACH) continue;
    got.push(id);
    m.setO(i % m.w, Math.floor(i / m.w), O.NONE);
  }
  return got;
};

describe('the kelp check', () => {
  it('the beach washes up 2-3 finds a morning however full the woods are', () => {
    const g = new Game({ seed: 7 });
    for (let d = 0; d < 21; d++) g.endDay(false);
    expect(finds(g).inland).toBeGreaterThanOrEqual(55);
    expect(finds(g).beach).toBe(BEACH_CAP);
    comb(g);
    for (let d = 0; d < 10; d++) {
      g.endDay(false);
      const n = comb(g).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(finds(g).inland).toBeGreaterThanOrEqual(55);
  });

  it('kelp is about one beach find in four', () => {
    expect(BEACH.find(([id]) => id === 'kelp')![1] / BEACH.reduce((a, [, w]) => a + w, 0)).toBe(0.25);
    const g = new Game({ seed: 11 });
    const got: string[] = [];
    for (let d = 0; d < 100; d++) {
      g.endDay(false);
      got.push(...comb(g));
    }
    expect(got.length).toBeGreaterThan(200);
    const share = got.filter((id) => id === 'kelp').length / got.length;
    expect(share).toBeGreaterThan(0.17);
    expect(share).toBeLessThan(0.33);
  });

  it('a trap set in the sea brings up kelp for half its junk', () => {
    expect(SEA_JUNK.filter((id) => id === 'kelp').length * 2).toBe(SEA_JUNK.length);
    const g = new Game({ seed: 3 });
    const m = g.map;
    const sea: [number, number][] = [];
    for (let y = 0; y < m.h && sea.length < 12; y++)
      for (let x = 20; x < m.w - 20 && sea.length < 12; x += 9) if (m.g(x, y) === T.OCEAN && !g.ents.at(x, y)) sea.push([x, y]);
    const traps = sea.map(([x, y]) => place(g, 'fish_trap', x, y, 0));
    expect(traps.length).toBe(12);
    const got = new Map<string, number>();
    for (let d = 0; d < 50; d++) {
      for (const t of traps) t.st.bait = 1;
      g.endDay(false);
      for (const t of traps) {
        for (const s of t.inv!.slots) if (s) got.set(kId(s.k), (got.get(kId(s.k)) ?? 0) + s.n);
        t.inv!.slots.fill(null);
      }
    }
    const junk = ['old_boot', 'tin_can', 'driftwood', 'kelp'].reduce((a, id) => a + (got.get(id) ?? 0), 0);
    const kelp = got.get('kelp') ?? 0;
    expect(junk).toBeGreaterThan(30);
    expect(kelp / junk).toBeGreaterThan(0.3);
  });

  it('kelp says where to get it', () => {
    expect(SOURCE.kelp).toMatch(/beach/);
    expect(SOURCE.kelp).toMatch(/traps/);
  });
});
