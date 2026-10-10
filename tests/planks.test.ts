// Plank decks (src/render/planks.ts): a bridge reads as one seamless deck (the owner's 2.0 playtest).
import { describe, expect, it } from 'vitest';
import { T, TileMap } from '../src/sim/world/tilemap';
import { deckHash, plankAxis, plankParts, plankVertex, PLANK_UNDER } from '../src/render/planks';

/** # planks, ~ river, = deep, p path, : sand, , dirt, . grass */
function map(rows: string[]) {
  const legend: Record<string, T> = { '#': T.PLANKS, '~': T.RIVER, '=': T.DEEP, p: T.PATH, ':': T.SAND, ',': T.DIRT, '.': T.GRASS };
  const m = new TileMap(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((c, x) => (m.ground[m.idx(x, y)] = legend[c] ?? T.GRASS)));
  return m;
}
const has = (list: string[], ...names: string[]) => names.every((n) => list.includes(n));

describe('plank decks', () => {
  // the north river bridge on every map: the bank cuts across it, dirt on its north-west side
  const bridge = map([
    ',,,~~~~..',
    'pp#####pp',
    'pp#####pp',
    'pp#####pp',
    '.~~~~~:..',
  ]);
  it('a bridge runs one way, with railings end to end on both long sides, over the banks too', () => {
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 6; x++) expect(plankAxis(bridge, x, y)).toBe('h');
    for (let x = 2; x <= 6; x++) {
      expect(plankParts(bridge, x, 1).ground).toContain('planks_rail_n');
      expect(plankParts(bridge, x, 3).front).toContain('planks_rail_s');
    }
    // the middle row has no railing or edge at all
    expect(plankParts(bridge, 4, 2)).toEqual({ ground: ['planks_h'], front: [] });
  });
  it('posts stand only where a railing stops: the four corners', () => {
    const posts = (x: number, y: number) => { const p = plankParts(bridge, x, y); return [...p.ground, ...p.front].filter((n) => n.startsWith('planks_post')); };
    expect(posts(2, 1)).toEqual(['planks_post_nw']);
    expect(posts(6, 1)).toEqual(['planks_post_ne']);
    expect(posts(2, 3)).toEqual(['planks_post_sw']);
    expect(posts(6, 3)).toEqual(['planks_post_se']);
    for (let x = 3; x <= 5; x++) { expect(posts(x, 1)).toEqual([]); expect(posts(x, 3)).toEqual([]); }
  });
  it('the deck lands on the road at both ends; the near railing and its posts stand in front (y-sorted)', () => {
    expect(has(plankParts(bridge, 2, 2).ground, 'planks_end_w')).toBe(true);
    expect(has(plankParts(bridge, 6, 2).ground, 'planks_end_e')).toBe(true);
    expect(plankParts(bridge, 2, 3).front).toEqual(['planks_rail_s', 'planks_post_sw']);
    expect(plankParts(bridge, 2, 1).front).toEqual([]);
  });
  it('a road joining the long side leaves an opening, with a post where the railing stops', () => {
    // the south bridge: the west street comes down onto its north side at its east end
    const m = map(['.~~~pp.', 'p#####p', 'p#####p', '.~~~~~.']);
    expect(plankParts(m, 4, 1).ground).toContain('planks_side_n');
    expect(plankParts(m, 4, 1).ground).not.toContain('planks_rail_n');
    expect(plankParts(m, 3, 1).ground).toEqual(expect.arrayContaining(['planks_rail_n', 'planks_post_ne']));
  });
  it('the pier runs north-south: railings over the beach and the sea, open at its tip', () => {
    const m = map(['.....', ':.#.:', '::#::', '~~#~~', '==#==', '=====']);
    for (let y = 1; y <= 4; y++) expect(plankAxis(m, 2, y)).toBe('v');
    for (let y = 1; y <= 4; y++) expect(plankParts(m, 2, y).ground).toEqual(expect.arrayContaining(['planks_rail_w', 'planks_rail_e']));
    expect(plankParts(m, 2, 1).ground).toContain('planks_end_n');
    expect(plankParts(m, 2, 4).ground).toContain('planks_end_s');
    expect(plankParts(m, 2, 4).front).toEqual(['planks_post_sw', 'planks_post_se']);
  });
  it('a Plank Walk on land has no railings; each arm of an L runs its own way', () => {
    const m = map(['.....', '.#...', '.#...', '.###.', '.....']);
    expect(plankAxis(m, 1, 1)).toBe('v');
    expect(plankAxis(m, 3, 3)).toBe('h');
    for (const [x, y] of [[1, 1], [1, 2], [1, 3], [2, 3], [3, 3]]) {
      const p = plankParts(m, x, y);
      expect([...p.ground, ...p.front].some((n) => n.includes('rail') || n.includes('post'))).toBe(false);
    }
    expect(plankParts(m, 2, 3).ground).toEqual(['planks_h', 'planks_side_n', 'planks_side_s']);
  });
  it('a walk beside water gets a railing on its water side only', () => {
    const m = map(['~~~~', '.##.', '....']);
    expect(plankParts(m, 1, 1).ground).toEqual(expect.arrayContaining(['planks_rail_n', 'planks_post_nw', 'planks_side_s']));
  });
  it('a board keeps its colours across the deck (the colouring follows the run)', () => {
    for (let x = 0; x < 20; x++) {
      const c = Math.floor(deckHash('h', x, 44) * 3);
      for (let y = 45; y < 48; y++) expect(Math.floor(deckHash('h', x, y) * 3)).toBe(c);
    }
    const c = Math.floor(deckHash('v', 138, 130) * 3);
    for (let x = 139; x <= 140; x++) expect(Math.floor(deckHash('v', x, 130) * 3)).toBe(c);
  });
});

describe('the ground under a deck', () => {
  const m = map([
    ',,,~~~~..',
    'pp#####pp',
    'pp#####pp',
    'pp#####pp',
    '.~~~~~:..',
  ]);
  /** the vertex at (vx, vy) with the classes beside it, deck corners resolved */
  const vertex = (vx: number, vy: number, cs: string[]) => { const c: (string | null)[] = cs.map((k) => (k === '#' ? PLANK_UNDER : k)); plankVertex(m, vx, vy, c); return c; };
  it('where the deck lands, the road runs on under it (no shore notching into the road)', () => {
    // west end, between the road (x 1) and the deck (x 2), rows 1-2
    expect(vertex(2, 2, ['path', '#', 'path', '#'])).toEqual(['path', 'path', 'path', 'path']);
    // the south-west corner: the road's edge runs straight on to the water
    expect(vertex(2, 4, ['path', '#', 'water', 'water'])).toEqual(['path', 'path', 'water', 'water']);
  });
  it('along a long side the bank runs straight on under the deck', () => {
    // north side, between the dirt bank (x 2) and the river (x 3)
    expect(vertex(3, 1, ['dirt', 'water', '#', '#'])).toEqual(['dirt', 'water', 'dirt', 'water']);
  });
  it('a vertex all under the deck takes water under a bridge', () => {
    expect(vertex(4, 2, ['#', '#', '#', '#'])).toEqual(['water', 'water', 'water', 'water']);
  });
});
