// Fences that connect (src/render/fences.ts): each fence, wall or gate picks the piece for the way it
// meets its neighbours, so a north-south run is drawn as one (the owner's 2.0 playtest).
import { describe, expect, it } from 'vitest';
import { Ents } from '../src/sim/ents';
import { O, TileMap } from '../src/sim/world/tilemap';
import { fenceMask, fenceSprite, gateVertical, mapFenceSprite, FENCE_N as N, FENCE_E as E, FENCE_S as S, FENCE_W as W } from '../src/render/fences';

/** a layout: w wood fence, s stone wall, g gate, . nothing; returns the structures by position */
function lay(rows: string[]) {
  const ents = new Ents(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === 'w') ents.add('fence_wood', x, y, 0);
    else if (c === 's') ents.add('fence_stone', x, y, 0);
    else if (c === 'g') ents.add('gate', x, y, 0);
  }));
  const name = (x: number, y: number) => fenceSprite(ents, ents.at(x, y)!);
  return { ents, name };
}

describe('connected fences', () => {
  it('a closed wood rectangle: corners turn, the sides run their own way', () => {
    const { name } = lay(['wwww', 'w..w', 'wwww']);
    expect(name(0, 0)).toBe(`fence:wood:${E | S}`);
    expect(name(3, 0)).toBe(`fence:wood:${S | W}`);
    expect(name(0, 2)).toBe(`fence:wood:${N | E}`);
    expect(name(3, 2)).toBe(`fence:wood:${N | W}`);
    expect(name(1, 0)).toBe(`fence:wood:${E | W}`);
    // the west and east sides are north-south pieces, not the east-west sprite turned sideways
    expect(name(0, 1)).toBe(`fence:wood:${N | S}`);
    expect(name(3, 1)).toBe(`fence:wood:${N | S}`);
  });
  it('an L, a T, a cross and a lone post', () => {
    const { name } = lay(['w.www.w..', 'w..w.www.', 'ww....w..', '.........', 'w........']);
    expect(name(0, 2)).toBe(`fence:wood:${N | E}`);
    expect(name(3, 0)).toBe(`fence:wood:${E | S | W}`);
    expect(name(6, 1)).toBe(`fence:wood:${N | E | S | W}`);
    expect(name(0, 4)).toBe('fence:wood:0');
  });
  it('a gate across an east-west run, and one hanging in a north-south run', () => {
    const { ents, name } = lay(['wgw..w', '.....g', '.....w']);
    expect(name(1, 0)).toBe('fence:gate:h');
    expect(name(0, 0)).toBe(`fence:wood:${E}`);
    expect(name(2, 0)).toBe(`fence:wood:${W}`);
    expect(gateVertical(ents, 5, 1)).toBe(true);
    // hangs from the post north of it; the run going on south covers its post below the face
    expect(name(5, 1)).toBe('fence:gate:v11');
    expect(name(5, 0)).toBe(`fence:wood:${S}`);
    expect(name(5, 2)).toBe(`fence:wood:${N}`);
  });
  it('a gate at the north end of a run has a hinge post of its own; alone it stands east-west', () => {
    const { name } = lay(['g.g', 'w..']);
    expect(name(0, 0)).toBe('fence:gate:v01');
    expect(name(2, 0)).toBe('fence:gate:h');
  });
  it('a stone wall takes a gate east-west; north-south the gate hangs in front of the wall’s end', () => {
    const { ents, name } = lay(['sgs..s', '.....g', '.....s']);
    expect(name(0, 0)).toBe(`fence:stone:${E}`);
    expect(name(2, 0)).toBe(`fence:stone:${W}`);
    expect(fenceMask(ents, 5, 0, 'stone')).toBe(0);
    expect(fenceMask(ents, 5, 2, 'stone')).toBe(0);
    // it hangs from the wall's end, and keeps its whole post: no wood run covers it
    expect(name(5, 1)).toBe('fence:gate:v10');
  });
  it('wood and stone are different families', () => {
    const { name } = lay(['wws', '..s']);
    expect(name(1, 0)).toBe(`fence:wood:${W}`);
    expect(name(2, 0)).toBe(`fence:stone:${S}`);
  });
  it('a blueprint ghost does not join', () => {
    const ents = new Ents(3, 1);
    ents.add('fence_wood', 0, 0, 0);
    ents.add('fence_wood', 1, 0, 0, true);
    expect(fenceSprite(ents, ents.at(0, 0)!)).toBe('fence:wood:0');
  });
  it('only fences have fence pieces', () => {
    const ents = new Ents(2, 1);
    ents.add('chest_wood', 0, 0, 0);
    expect(fenceSprite(ents, ents.at(0, 0)!)).toBeNull();
  });
  it('the paddock fence (the map O.FENCE) joins the fence objects around it, its look kept per tile', () => {
    const m = new TileMap(4, 4);
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) m.obj[m.idx(x, y)] = O.FENCE;
    m.obj[m.idx(3, 3)] = O.ROCK;
    m.deco[m.idx(0, 1)] = 1;
    expect(mapFenceSprite(m, 0, 0, 0)).toBe(`fence:map:${E | S}:0:0`);
    expect(mapFenceSprite(m, 1, 0, 2)).toBe(`fence:map:${E | W}:0:2`);
    expect(mapFenceSprite(m, 0, 1, 3)).toBe(`fence:map:${N | S}:1:3`);
    expect(mapFenceSprite(m, 0, 2, 0)).toBe(`fence:map:${N}:0:0`);
  });
});
