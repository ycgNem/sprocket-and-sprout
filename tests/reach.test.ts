// What a structure reaches, as the hover and placing shade shows it (the owner after 2.0: "in order
// to see the radius for the scarecrow or harvest crane i need to break it and hover before i put it
// down"): the shape each one really uses.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { STRUCTURES, STRUCT_BY_ID } from '../src/data/structures';
import { REACH_KINDS, reachTiles } from '../src/ui/reach';

const g = new Game({ seed: 1, blank: { w: 60, h: 60 } });
const at = (id: string) => reachTiles(g, STRUCT_BY_ID.get(id)!, 30, 30);
const has = (t: Set<number>, x: number, y: number) => t.has(y * 4096 + x);

describe('reach shapes', () => {
  it('a tin sprinkler reaches the four tiles beside it', () => {
    const t = at('sprinkler_1');
    expect(t.size).toBe(4);
    for (const [x, y] of [[29, 30], [31, 30], [30, 29], [30, 31]]) expect(has(t, x, y)).toBe(true);
  });

  it("the scarecrow's is a circle of 8, not a square", () => {
    const t = at('scarecrow');
    expect(has(t, 38, 30)).toBe(true);
    expect(has(t, 30, 22)).toBe(true);
    expect(has(t, 38, 38)).toBe(false);
    expect(has(t, 36, 36)).toBe(false);
  });

  it("a crane's is the square around it, one wider with Long Reach", () => {
    expect(at('harvester').size).toBe(49);
    g.player.perks.push('rancher');
    expect(at('harvester').size).toBe(81);
    g.player.perks.length = 0;
  });

  it('every kind that shows a reach has a shape', () => {
    for (const k of REACH_KINDS) {
      const def = STRUCTURES.find((d) => d.kind === k)!;
      expect(def, k).toBeTruthy();
      expect(reachTiles(g, def, 30, 30).size, k).toBeGreaterThan(0);
    }
  });
});
