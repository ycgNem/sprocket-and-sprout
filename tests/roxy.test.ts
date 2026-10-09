// Roxy Vane and Skyhook Field (1.1): she can reach her airship, her shop opens, and saves from
// before the field get their meadow cleared on load.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { rle, serialize, deserialize, unrle } from '../src/sim/save';
import { npcSys } from '../src/sim/systems/npcs';
import { NPC_BY_ID } from '../src/data/npcs';
import { SHOP_BY_ID } from '../src/data/shops';
import { REQUEST_POOL } from '../src/data/goals';
import { generateWorld, AIRSHIP, skyfield } from '../src/sim/world/worldgen';
import { findPath } from '../src/sim/world/path';
import { O, T } from '../src/sim/world/tilemap';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };

describe('Roxy Vane', () => {
  it('is a full villager with a shop on her airship', () => {
    const r = NPC_BY_ID.get('roxy')!;
    expect(r.age).toBe('adult');
    expect(r.heartEvents.map((e) => e.hearts)).toEqual([2, 4, 6, 8]);
    expect(r.dialogue.length).toBeGreaterThanOrEqual(30);
    const shop = SHOP_BY_ID.get('airfreight')!;
    expect(shop.owner).toBe('roxy');
    expect(shop.loc).toBe('airship');
    expect(REQUEST_POOL.some((q) => q.npc === 'roxy')).toBe(true);
    // off-season seeds: every listed season is one the crop can't be bought in elsewhere
    for (const e of shop.stock.filter((e) => e.item.endsWith('_seed'))) expect(e.seasons?.length).toBeGreaterThan(0);
  });

  it('can walk from the town square to the gangplank and her field', () => {
    for (const seed of [1, 7, 42]) {
      const m = generateWorld(seed);
      const [sx, sy] = m.loc('square');
      for (const loc of ['airship', 'skyfield']) {
        const [gx, gy] = m.loc(loc);
        expect(m.walkable(gx, gy), `${loc} walkable (seed ${seed})`).toBe(true);
        expect(findPath(m, sx, sy, gx, gy, (x, y) => m.walkable(x, y), 40000), `${loc} reachable (seed ${seed})`).not.toBeNull();
      }
      // the airship's door is the footprint's bottom-center tile
      expect(m.loc('airship_in')).toEqual([AIRSHIP.x + Math.floor(AIRSHIP.w / 2), AIRSHIP.y + AIRSHIP.h - 1]);
    }
  });

  it('a save from before 1.1 loads with Roxy, her field and her shop', () => {
    const g = new Game({ seed: 5 });
    const d = JSON.parse(JSON.stringify(serialize(g, look)));
    // what a 1.0 save looks like: no Roxy in the villager list, a tree where the gangplank lands
    const npcs = d.sys.npcs as { id: string }[];
    npcs.splice(npcs.findIndex((r) => r.id === 'roxy'), 1);
    const [dx, dy] = g.map.loc('airship');
    const obj = unrle(d.map.obj, g.map.w * g.map.h);
    obj[g.map.idx(dx, dy + 1)] = O.BUSH;
    d.map.obj = rle(obj);
    const g2 = deserialize(d).game;
    expect(g2.map.obj[g2.map.idx(dx, dy + 1)]).toBe(O.NONE);
    const roxy = npcSys(g2).byId.get('roxy')!;
    expect(roxy.points).toBe(0);
    expect(roxy.met).toBe(false);
    // the door of her shop is a building door on the map
    expect(g2.map.buildingAtTile(dx, dy - 1)?.id).toBe('airship');
  });

  it('clears the meadow on saves from before the airship', () => {
    const m = generateWorld(3);
    expect(skyfield(m)).toBe(false); // a new world is already clear
    // an old save had a tree and a rock in front of the gangplank, and grass on the lane
    const [dx, dy] = m.loc('airship');
    m.obj[m.idx(dx, dy + 2)] = O.TREE;
    m.trees.set(m.idx(dx, dy + 2), { species: 'oak', stage: 4, days: 0, fruit: 0, tapped: false, hp: 10 });
    m.obj[m.idx(dx + 3, dy)] = O.ROCK;
    m.ground[m.idx(172, 60)] = T.GRASS;
    expect(skyfield(m)).toBe(true);
    expect(m.obj[m.idx(dx, dy + 2)]).toBe(O.NONE);
    expect(m.trees.has(m.idx(dx, dy + 2))).toBe(false);
    expect(m.obj[m.idx(dx + 3, dy)]).toBe(O.NONE);
    expect(m.ground[m.idx(172, 60)]).toBe(T.PATH);
  });
});
