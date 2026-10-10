// The town keystones in the world (ROADMAP.md 7.5, Phases 3-4): where the Town Mill, the
// Waterworks' pump house and fountain, the square's twelve lamps and the tram's stops stand, and
// how a world gets them. A new world lays them out in generateWorld; an old save (whose ground and
// objects are stored) gets the same layout on load (src/sim/systems/townworks.ts afterLoad), the
// way skyfield() patches in Skyhook Field. What the keystones' flags switch on is run by
// src/sim/systems/townworks.ts and drawn by src/render/townworks.ts.
import { C } from '../../data/palette';
import { BuildingInfo, O, T, TileMap, Z } from './tilemap';

/** BuildingInfo.kind of the keystones' buildings: looked at, not entered; they draw their own states */
export const LANDMARK = 'landmark';

/**
 * The Town Mill: a two-storey timber mill on the town's bank at the west end of Main Street. Its
 * door faces Main Street; the wheel stands in the river off its west wall (MILL_WHEEL).
 */
export const TOWN_MILL = { id: 'town_mill', name: 'The Town Mill', x: 98, y: 53, w: 7, h: 6, door: [101, 58] as [number, number] };
/** the wheel's hub and radius in tiles: its lower third in the river (x 93-98 on these rows on every map) */
export const MILL_WHEEL = { cx: 96.4, cy: 56.6, r: 1.75 };
/** the Waterworks' brick pump house, just west of the square on Main Street */
export const PUMP_HOUSE = { id: 'pump_house', name: 'The Waterworks', x: 116, y: 55, w: 5, h: 4, door: [118, 58] as [number, number] };
/**
 * The square's fountain, south of the clocktower facing it across the open half of the plaza.
 * Its tiles hold O.BUILDING (solid, drawn by nothing else). Kept clear of where villagers gather
 * ('square' at 133,63), the festival ring's south spots (132,65 and 134,65) and Mags' cart spot
 * (130-132 x 65-66, with Mags at 133,66).
 */
export const FOUNTAIN = { x: 132, y: 67, w: 3, h: 2 };
/** objData of an O.LAMPPOST that is one of the square's twelve lamps (a plain lamppost has 0) */
export const SQUARE_LAMP = 1;
/** the square's twelve lamps, round the plaza's edge (x 122-143, y 53-68), off its roads and seats */
export const SQUARE_LAMPS: [number, number][] = [
  [123, 53], [126, 53], [139, 53], [142, 53],
  [122, 57], [143, 57], [122, 64], [143, 64],
  [123, 68], [126, 68], [139, 68], [142, 68],
];
/** the oil lampposts the square had before (worldgen's square furniture): its lamps replace them */
const OLD_SQUARE_LAMPPOSTS: [number, number][] = [[124, 56], [124, 66], [141, 56], [141, 66]];
/** the plaza, and the ring of town grass round it where no oil lamppost stays lit */
const PLAZA = { x0: 122, y0: 53, x1: 143, y1: 68 };

/**
 * The tram (the Tram keystone): its cart bin at the quarry entrance (a structure the system places
 * once `tram` is set), and the track it runs: along the east road's middle from the quarry to the
 * north avenue, then down the avenue to its stop at the square's north edge. Points are in tiles.
 */
export const TRAM = {
  bin: [173, 39] as [number, number],
  route: [[173.6, 41], [129, 41], [129, 52.6]] as [number, number][],
  /** where the cart stands at each end (the route's ends, a little inside the buffers) */
  quarryStop: [172.4, 41] as [number, number],
  squareStop: [129, 51.6] as [number, number],
  /** the square stop's sign, on the grass east of the avenue */
  sign: [130, 52] as [number, number],
};

/** The town line: where the square's lamp cable meets the farm at the gate (m.locs 'farm_gate'). */
export const TOWN_LINE: [number, number] = [92, 45];

const bInfo = (b: { id: string; name: string; x: number; y: number; w: number; h: number; door: [number, number] }, roof: number, wall: number): BuildingInfo =>
  ({ id: b.id, kind: LANDMARK, name: b.name, x: b.x, y: b.y, w: b.w, h: b.h, door: [b.door[0], b.door[1]], roof, wall });

/** The keystones' buildings (added by generateWorld with the town's others, so they exist in every world). */
export function townworksBuildings(): BuildingInfo[] {
  return [bInfo(TOWN_MILL, C.wine, C.oak), bInfo(PUMP_HOUSE, C.slate, C.brick)];
}

/**
 * Lay out the keystones' ground: clear round the mill and the pump house and pave their doorsteps,
 * set the fountain's tiles, and put the square's twelve lamps where its four oil lampposts stood
 * (no oil lamp stays lit round the plaza: the square is dark until Lamplighting). Idempotent: old
 * saves run it on load. Returns true when it changed anything.
 */
export function layTownworks(m: TileMap): boolean {
  if (m.w < 200 || m.h < 100) return false;
  let changed = false;
  const setObj = (x: number, y: number, o: O, d = 0) => {
    const i = m.idx(x, y);
    if (m.obj[i] === o && m.objData[i] === d && !m.trees.has(i) && !m.forage.has(i)) return;
    m.obj[i] = o;
    m.objData[i] = d;
    m.trees.delete(i);
    m.forage.delete(i);
    m.markDirty(x, y);
    changed = true;
  };
  const setGround = (x: number, y: number, t: T) => {
    const i = m.idx(x, y);
    if (m.ground[i] === t) return;
    m.ground[i] = t;
    m.markDirty(x, y);
    changed = true;
  };
  // town-side land only (the farm across the river is the player's)
  const land = (x: number, y: number) => {
    const g = m.g(x, y);
    return g !== T.RIVER && g !== T.CLIFF && g !== T.CLIFFTOP && g !== T.VOID && m.z(x, y) !== Z.FARM;
  };
  // the mill and its wheel: nothing grows on the footprint, round the wheel or in the gap to the
  // Mercantile; the doorstep is paved to Main Street's west end
  for (let y = TOWN_MILL.y - 2; y <= TOWN_MILL.y + TOWN_MILL.h + 2; y++)
    for (let x = Math.floor(MILL_WHEEL.cx - MILL_WHEEL.r); x <= TOWN_MILL.x + TOWN_MILL.w; x++) if (land(x, y)) setObj(x, y, O.NONE);
  for (let y = TOWN_MILL.door[1] + 1; y <= TOWN_MILL.door[1] + 3; y++)
    for (let x = TOWN_MILL.door[0] - 1; x <= TOWN_MILL.door[0] + 1; x++) if (land(x, y)) setGround(x, y, T.PATH);
  // the pump house
  for (let y = PUMP_HOUSE.y - 2; y <= PUMP_HOUSE.y + PUMP_HOUSE.h; y++)
    for (let x = PUMP_HOUSE.x - 2; x <= PUMP_HOUSE.x + PUMP_HOUSE.w; x++) if (land(x, y)) setObj(x, y, O.NONE);
  for (let x = PUMP_HOUSE.door[0] - 1; x <= PUMP_HOUSE.door[0] + 1; x++) setGround(x, PUMP_HOUSE.door[1] + 1, T.PATH);
  // the fountain: solid, drawn by src/render/townworks.ts
  for (let y = FOUNTAIN.y; y < FOUNTAIN.y + FOUNTAIN.h; y++)
    for (let x = FOUNTAIN.x; x < FOUNTAIN.x + FOUNTAIN.w; x++) {
      setGround(x, y, T.PATH);
      setObj(x, y, O.BUILDING);
    }
  // the square's lamps replace its oil lampposts, and none stays lit on the grass round the plaza
  for (const [x, y] of OLD_SQUARE_LAMPPOSTS) if (m.o(x, y) === O.LAMPPOST && m.objData[m.idx(x, y)] !== SQUARE_LAMP) setObj(x, y, O.NONE);
  for (let y = PLAZA.y0 - 2; y <= PLAZA.y1 + 2; y++)
    for (let x = PLAZA.x0 - 2; x <= PLAZA.x1 + 2; x++) {
      const inside = x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
      if (!inside && m.o(x, y) === O.LAMPPOST && m.objData[m.idx(x, y)] !== SQUARE_LAMP) setObj(x, y, O.NONE);
    }
  for (const [x, y] of SQUARE_LAMPS) setObj(x, y, O.LAMPPOST, SQUARE_LAMP);
  // the tram's square stop: its sign's tile stays clear
  setObj(TRAM.sign[0], TRAM.sign[1], O.NONE);
  return changed;
}

/** Is this tile one of the square's lamps? */
export function isSquareLamp(m: TileMap, x: number, y: number): boolean {
  return m.o(x, y) === O.LAMPPOST && m.objData[m.idx(x, y)] === SQUARE_LAMP;
}

/** a landmark's rect in tiles, as drawn (for looking at it: hover, walking up to it) */
export interface Landmark { id: string; name: string; x0: number; y0: number; x1: number; y1: number }

/** the things in town a keystone's observe stage can ask you to look at */
export const LANDMARKS: Landmark[] = [
  // the mill with its roof and the wheel in the river
  { id: 'town_mill', name: TOWN_MILL.name, x0: MILL_WHEEL.cx - MILL_WHEEL.r, y0: TOWN_MILL.y - 2.5, x1: TOWN_MILL.x + TOWN_MILL.w, y1: TOWN_MILL.y + TOWN_MILL.h },
  { id: 'pump_house', name: PUMP_HOUSE.name, x0: PUMP_HOUSE.x, y0: PUMP_HOUSE.y - 2, x1: PUMP_HOUSE.x + PUMP_HOUSE.w, y1: PUMP_HOUSE.y + PUMP_HOUSE.h },
  { id: 'fountain', name: 'The Fountain', x0: FOUNTAIN.x, y0: FOUNTAIN.y - 1.5, x1: FOUNTAIN.x + FOUNTAIN.w, y1: FOUNTAIN.y + FOUNTAIN.h },
];

/** distance in tiles from a point to a rect (0 inside it) */
export function rectDist(px: number, py: number, r: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = Math.max(r.x0 - px, 0, px - r.x1), dy = Math.max(r.y0 - py, 0, py - r.y1);
  return Math.hypot(dx, dy);
}
