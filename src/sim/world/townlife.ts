// Town life in the world: the places villagers stand once the town's works run (beside the Town
// Mill's wheel, the pump house, the fountain, under the square's lamps, at the tram's stops, the
// clocktower and the Harbor), the spot in front of each shop where its keeper works outdoors on a
// dry day, the school's yard, the lunch spots on the square, and the Thursday market's stalls.
// Places are named locations (m.locs) like the schedules' own; a new world gets them in
// generateWorld, and the villagers lay them again each morning and on load (a tree may have grown
// on one, and an old save's world is its own), so nothing here is saved. Who stands where and when
// is data on the villagers (`stints`, src/data/npcs.ts), read by src/sim/townlife.ts.
import { O, TileMap } from './tilemap';
import { FOUNTAIN, HARBOR, PUMP_HOUSE, TOWN_MILL, TRAM } from './townworks';

type Dir = 0 | 1 | 2 | 3;

/** a named place and the tile it would like (it steps aside if something stands there) */
const SPOTS: [string, number, number][] = [
  // the Town Mill: by the wheel, at the door (flour for the Kettle), across the street (a good view of the wheel)
  ['mill_yard', TOWN_MILL.x + 1, TOWN_MILL.y + TOWN_MILL.h], ['mill_door', TOWN_MILL.door[0] - 1, TOWN_MILL.door[1] + 1], ['mill_bank', TOWN_MILL.x + TOWN_MILL.w, TOWN_MILL.y + TOWN_MILL.h + 1],
  // the Waterworks: the pump house's yard, and either side of the fountain
  ['pump_yard', PUMP_HOUSE.door[0] + 1, PUMP_HOUSE.door[1] + 1], ['fountain_w', FOUNTAIN.x - 1, FOUNTAIN.y], ['fountain_e', FOUNTAIN.x + FOUNTAIN.w, FOUNTAIN.y + 1],
  // the square's lamps: a round of six of the twelve, from under each
  ['lamp_nw', 123, 54], ['lamp_ne', 142, 54], ['lamp_e', 142, 64], ['lamp_se', 139, 67], ['lamp_sw', 126, 67], ['lamp_w', 123, 64],
  // the tram: either side of the square stop (its sign's tile stays clear), and the quarry stop
  ['tram_stop', TRAM.sign[0] - 3, TRAM.sign[1]], ['tram_stop_e', TRAM.sign[0] + 1, TRAM.sign[1]], ['tram_quarry', 170, 42],
  // the clocktower: where its face is best seen from, clear of the door
  ['clock_view', 132, 61], ['clock_view_e', 135, 61],
  // the Harbor: on the sand between the warehouse and the sea, the ship's berth to the south-east
  ['harbor_quay', HARBOR.x, HARBOR.y + HARBOR.h + 2], ['harbor_yard', HARBOR.x + 3, HARBOR.y + HARBOR.h + 2],
  // the school's yard beside the library (lessons outdoors on a dry morning)
  ['school_yard', 144, 79], ['school_desk', 146, 79],
  // lunch on the square: by its benches and round the middle
  ['lunch_a', 128, 58], ['lunch_b', 137, 58], ['lunch_c', 131, 63], ['lunch_d', 135, 63], ['lunch_e', 128, 66], ['lunch_f', 137, 66], ['lunch_g', 133, 62],
];

/** the keepers' shops (BuildingInfo ids): '<id>_front' is where each works outdoors, two tiles from the step */
const SHOP_FRONTS = ['store', 'smithy', 'carpenter', 'workshop', 'inn', 'clinic', 'fisher_hut', 'ranch', 'hermit_hut', 'airship'];

// ---------------- the Thursday market ----------------
/** Thursday: no shop's closed day, not Mags' (Friday, Sunday), and no festival falls on one */
export const MARKET_WEEKDAY = 3;
export const MARKET_OPEN = 9 * 60, MARKET_CLOSE = 16 * 60;

export interface MarketStall {
  /** the villager behind it */
  who: string;
  /** what F opens: their own shop's id, or 'market' (the odds table, src/sim/marketstall.ts) */
  shop: string;
  /** which of the Harvest Haul's stall sprites (haul:stall:<k>) */
  k: number;
  /** the 2x1 counter's left tile; the awning rises over the row behind */
  x: number;
  y: number;
  /** where the keeper stands, beside it */
  stand: [number, number];
}

/**
 * The market on the plaza (x 122-143, y 53-68): four stalls in a row either side of the open middle
 * just south of Main Street's line, one by the clocktower, and the Mayor's bell stand across from
 * it. Clear of the clocktower's door, the Orders board (126,64, drawn up to row 63), the flowerbeds
 * (123/142 x 60), the benches (127/138 x 58/66), the lamps and the fountain.
 */
export const MARKET_STALLS: MarketStall[] = [
  { who: 'marigold', shop: 'general', k: 0, x: 124, y: 62, stand: [126, 62] },
  { who: 'hazel', shop: 'market', k: 1, x: 128, y: 62, stand: [130, 62] },
  { who: 'bram', shop: 'smithy', k: 2, x: 136, y: 62, stand: [135, 62] },
  { who: 'juniper', shop: 'carpenter', k: 2, x: 140, y: 62, stand: [139, 62] },
  { who: 'clem', shop: 'ranch', k: 3, x: 124, y: 57, stand: [126, 57] },
];
/** the Mayor's bell stand (the Haul's podium sprite), and where he rings the market open and shut */
export const MARKET_BELL = { x: 139, y: 57, stand: [141, 57] as [number, number] };

/** where the market's strollers stop, and the way they face there (at a stall's counter, or about the middle) */
export const MARKET_STROLL: [number, number, Dir][] = [
  [124, 63, 0], [133, 64, 2], [141, 63, 0], [125, 58, 0], [129, 63, 0], [135, 65, 3], [137, 63, 0], [131, 60, 2], [140, 58, 0], [130, 65, 1],
];

/** the stall whose counter this tile is part of (F there opens it) */
export function marketStallAt(tx: number, ty: number): MarketStall | null {
  return MARKET_STALLS.find((s) => ty === s.y && (tx === s.x || tx === s.x + 1)) ?? null;
}

/** a stall's counter or the bell stand: nobody walks through them while the market is on */
export function marketBlocks(tx: number, ty: number): boolean {
  return !!marketStallAt(tx, ty) || (ty === MARKET_BELL.y && (tx === MARKET_BELL.x || tx === MARKET_BELL.x + 1));
}

// ---------------- laying the places ----------------
const NEAR: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];

/** a tile to stand on: walkable, nothing on it, nobody's doorstep */
function free(m: TileMap, x: number, y: number, taken: Set<number>): boolean {
  return m.inb(x, y) && m.walkable(x, y) && m.o(x, y) === O.NONE && !taken.has(m.idx(x, y));
}

/**
 * Name the places (idempotent: the same tiles while they stay clear, the nearest clear tile
 * otherwise). Only on the valley's map.
 */
export function layTownlife(m: TileMap) {
  if (m.w < 200 || m.h < 100) return;
  const taken = new Set<number>();
  // doorsteps stay clear (F at a door faces the step)
  for (const b of m.buildings) taken.add(m.idx(b.door[0], b.y + b.h));
  const put = (id: string, x: number, y: number, tries: [number, number][] = NEAR) => {
    for (const [dx, dy] of tries) {
      if (!free(m, x + dx, y + dy, taken)) continue;
      taken.add(m.idx(x + dx, y + dy));
      m.locs.set(id, [x + dx, y + dy]);
      return;
    }
    // nowhere clear (a thicket grew round it): the wanted tile, and the villager is put there
    m.locs.set(id, [x, y]);
  };
  for (const [id, x, y] of SPOTS) put(id, x, y);
  // a shop's front: beside the step, east first, then west, then a row down
  const FRONT: [number, number][] = [[2, 0], [-2, 0], [2, 1], [-2, 1], [3, 0], [-3, 0], [3, 1], [-3, 1], [1, 1], [-1, 1]];
  for (const id of SHOP_FRONTS) {
    const b = m.buildings.find((x) => x.id === id);
    if (b) put(id + '_front', b.door[0], b.y + b.h, FRONT);
  }
  // the market's own places are fixed on the plaza's paving
  for (const s of MARKET_STALLS) m.locs.set('mkt_' + s.who, s.stand);
  m.locs.set('mkt_bell', MARKET_BELL.stand);
  MARKET_STROLL.forEach(([x, y], i) => m.locs.set('mkt_s' + i, [x, y]));
}
