// The keeper's yard (ROADMAP.md 6.0): where the Keeper's Line's pieces sit and how a new game
// lays them out. Kept apart from the systems so farming and the night events can check
// `openingTile` without importing a system (which would change the registration order in
// src/sim/index.ts).
import type { Game } from './Game';
import type { Dir } from './ents';
import { key } from './inventory';
import { rustStruct } from './rust';
import { O, T } from './world/tilemap';

type XY = [number, number];

/** Where the opening's pieces sit (inside the farmhouse yard on every map). */
export const OPENING = {
  /** the keeper's jar, still running at minute 0 */
  jar: [54, 23] as XY,
  /** the keeper's arm between the jar and the crate: rusted, its spring snapped (B2) */
  armTile: [54, 22] as XY,
  /** the keeper's cellar chest below the jar, and where B3's arm goes (chest -> jar) */
  chest: [54, 25] as XY,
  feedArm: [54, 24] as XY,
  /** the keeper's dead belt run into the jar from the east (B5), the gleaner's arm and the gleaner */
  belts: [[55, 23], [56, 23], [57, 23], [58, 23]] as XY[],
  gleanArm: [59, 23] as XY,
  gleaner: [60, 23] as XY,
  /** the gleaner's bed: four tiles to till and plant (B4) and the keeper's three ripe plants */
  bed: [[59, 22], [60, 22], [59, 24], [60, 24]] as XY[],
  bedRipe: [[61, 22], [61, 23], [61, 24]] as XY[],
  /** the keeper's ripe bean patch (B1) */
  beans: { x: 56, y: 26, w: 4, h: 2 },
  /** the keeper's study desk (2x2, B5) */
  desk: [49, 25] as XY,
  /** where a new game starts, facing the jar */
  start: [53, 23] as XY,
  /** B6: the second jar west of the cellar chest, fed from your kit chest below it by an arm, its
   *  out-arm and its four belts to the crate; `shareArm` is the fix that feeds it from the cellar */
  jar2: [52, 25] as XY,
  jar2Chest: [52, 27] as XY,
  jar2Feed: [52, 26] as XY,
  jar2Out: [52, 24] as XY,
  shareArm: [53, 25] as XY,
  jar2Belts: [[52, 23, 0], [52, 22, 1], [53, 22, 0], [53, 21, 1]] as [number, number, Dir][],
  /** the whole yard: no weed, stone, twig or stump starts here or lands here later */
  yard: { x: 47, y: 20, w: 17, h: 10 },
};

const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/**
 * A tile of the keeper's yard. Daily weeds and storm debris never land there, or a step of the
 * Keeper's Line could say "Clear the ground first" (and 3.2 rule 2: no debris chores).
 */
export function openingTile(g: Game, x: number, y: number): boolean {
  if (!g.flags.has('keepers_line') && !g.flags.has('tinker_start')) return false;
  return inRect(OPENING.yard, x, y);
}

/** clear a tile of objects and trees, leaving the ground as it was (or as `ground`) */
function clearTile(g: Game, x: number, y: number, ground?: T) {
  const i = g.map.idx(x, y);
  g.map.obj[i] = O.NONE;
  g.map.trees.delete(i);
  if (ground !== undefined) g.map.ground[i] = ground;
}

/** a ripe cogbean plant; `before` = ripe since before today, so a machine may pick it at once */
function ripeBean(g: Game, x: number, y: number, before: boolean) {
  clearTile(g, x, y, T.DIRT);
  g.soil.set(g.map.idx(x, y), {
    water: true, fert: null, idle: 0,
    crop: { id: 'cogbean', days: 4, stage: 4, ready: true, harvests: 0, dead: false, giant: -1, frac: 0, ripeDay: before ? -1 : undefined },
  });
}

/**
 * The keeper's yard for a new game: the jar running on its last beans, the crate, and the rest of
 * the old works in rust (ROADMAP.md 6.0). Every map shares the farmhouse yard, so this works on all.
 */
export function buildYard(g: Game) {
  const Y = OPENING.yard;
  for (let y = Y.y; y < Y.y + Y.h; y++)
    for (let x = Y.x; x < Y.x + Y.w; x++) {
      const i = g.map.idx(x, y);
      if (g.map.buildingAt[i]) continue;
      clearTile(g, x, y);
      // the yard is trodden earth and grass, never last year's tilled soil
      g.soil.delete(i);
    }
  const B = OPENING.beans;
  for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) ripeBean(g, x, y, false);
  for (const [x, y] of OPENING.bedRipe) ripeBean(g, x, y, true);
  for (const [x, y] of OPENING.bed) clearTile(g, x, y, T.DIRT);
  // the keeper's jar runs at 4x (a pickle about every 15 s) until the line is whole (B3), starting
  // on its last three beans
  const jar = g.ents.add('jar', OPENING.jar[0], OPENING.jar[1], 0);
  jar.st.keeper = 1;
  jar.st.quick = 99;
  jar.mach?.inBuf.set(key('cogbean'), 3);
  // the keeper's cellar: two dozen beans, so day 1's line never runs dry (the cellar sends a
  // dozen more each morning through day 4)
  g.ents.add('chest_wood', OPENING.chest[0], OPENING.chest[1], 0).inv?.add(key('cogbean'), 24);
  // the rest of the works, rusted
  rustStruct(g.ents.add('arm_basic', OPENING.armTile[0], OPENING.armTile[1], 0), 'spring');
  for (const [x, y] of OPENING.belts) rustStruct(g.ents.add('belt_1', x, y, 3));
  rustStruct(g.ents.add('arm_basic', OPENING.gleanArm[0], OPENING.gleanArm[1], 3), 'spring');
  // the gleaner still holds the keeper's last pick, for the belt run to carry once it's restored (B5)
  const gl = g.ents.add('gleaner', OPENING.gleaner[0], OPENING.gleaner[1], 0);
  rustStruct(gl);
  gl.inv?.add(key('cogbean'), 6);
  const desk = g.ents.add('lab', OPENING.desk[0], OPENING.desk[1], 0);
  rustStruct(desk);
  // the keeper's last sprout bundle, still in the desk
  desk.inv?.add(key('bundle_green'), 1);
  for (const e of g.ents.all()) if (e.st.rust || e.st.keeper) e.st.yard = 1;
  // start beside the jar, facing it
  g.player.x = OPENING.start[0] + 0.5;
  g.player.y = OPENING.start[1] + 0.8;
  g.player.dir = 1;
}
