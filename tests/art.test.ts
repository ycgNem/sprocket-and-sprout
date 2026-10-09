import { describe, expect, it } from 'vitest';
import { matchSprite, pickVertex, TerrainIndex } from '../src/render/art/match';

describe('sprite name patterns', () => {
  it('matches exact names and one-segment wildcards', () => {
    expect(matchSprite('crop:radish:2:0:1:0', 'crop:radish:2:0:1:0')).toBe(true);
    expect(matchSprite('crop:radish:2:*:*:0', 'crop:radish:2:0:2:0')).toBe(true);
    expect(matchSprite('crop:radish:2:*:*:0', 'crop:radish:2:0:2:1')).toBe(false);
    expect(matchSprite('crop:radish:2:*', 'crop:radish:2:0:2:0')).toBe(false);
  });
  it('matches the rest of the name with a final **', () => {
    expect(matchSprite('tree:oak:4:**', 'tree:oak:4:1:0:2')).toBe(true);
    expect(matchSprite('tree:oak:**', 'tree:oak')).toBe(true);
    expect(matchSprite('tree:oak:4:**', 'tree:pine:4:1:0:2')).toBe(false);
  });
});

describe('terrain dual grid', () => {
  const t = (n: number) => Array(n).fill(0);
  const m: TerrainIndex = {
    bases: { grass: t(3), dirt: t(2), water: t(1) },
    sets: [{ lower: 'dirt', upper: 'grass', tiles: Object.fromEntries([...Array(16).keys()].map((k) => [String(k), t(1)])) }],
  };
  it('uses a base tile when all corners agree, the variant picked by the hash', () => {
    expect(pickVertex(m, ['grass', 'grass', 'grass', 'grass'], 0.9)).toEqual({ base: 'grass', v: 2 });
  });
  it('uses the pair set with upper corners as mask bits (NW 8, NE 4, SW 2, SE 1)', () => {
    expect(pickVertex(m, ['grass', 'dirt', 'dirt', 'grass'], 0)).toEqual({ set: 0, mask: 9, v: 0 });
    expect(pickVertex(m, ['dirt', 'dirt', 'dirt', 'grass'], 0)).toEqual({ set: 0, mask: 1, v: 0 });
  });
  it('lets the rarest class give way when its pair has no set', () => {
    // water has no set with grass here: the single water corner becomes grass
    expect(pickVertex(m, ['grass', 'grass', 'water', 'grass'], 0)).toEqual({ base: 'grass', v: 0 });
    // three classes reduce to the pair that has a set
    expect(pickVertex(m, ['grass', 'dirt', 'water', 'grass'], 0)).toEqual({ set: 0, mask: 9 | 2, v: 0 });
  });
  it('keeps dry and watered soil together where a plot meets grass', () => {
    const soil: TerrainIndex = {
      bases: { grass: t(1), soil: t(1), wet: t(1) },
      sets: ['soil|grass', 'wet|grass', 'wet|soil'].map((p) => ({ lower: p.split('|')[0], upper: p.split('|')[1], tiles: Object.fromEntries([...Array(16).keys()].map((k) => [String(k), t(1)])) })),
    };
    // grass above, dry soil bottom-left, watered soil bottom-right: no grass gap between the two
    expect(pickVertex(soil, ['grass', 'grass', 'soil', 'wet'], 0)).toEqual({ set: 1, mask: 12, v: 0 });
  });
  it('returns null when a class has no art at all', () => {
    expect(pickVertex(m, ['sand', 'sand', 'sand', 'sand'], 0)).toBeNull();
  });
});
