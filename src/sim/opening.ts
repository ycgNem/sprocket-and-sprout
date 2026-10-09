// Where the clockwork opening's pieces sit, and the tiles it points the player at. Kept apart from
// systems/modes.ts so farming and the night events can check it without importing a system (which
// would change the registration order in src/sim/index.ts).
import type { Game } from './Game';

/** Where the opening's pieces sit (all inside the farmhouse yard on every map). */
export const OPENING = {
  beans: { x: 42, y: 26, w: 4, h: 2 }, jar: [54, 23] as [number, number], armTile: [54, 22] as [number, number],
  /** bare dirt beside the beans that "Room to Grow" points at (6 tiles: till, plant, water) */
  plot: { x: 42, y: 29, w: 3, h: 2 },
  /** the keeper's bean chest below the jar, and where "Hands Free" puts the arm that feeds the jar */
  chest: [54, 25] as [number, number], feedArm: [54, 24] as [number, number],
};

/**
 * A tile the clockwork opening marks for the player (the beans, the first plot, the jar, the chest
 * and both arm spots). Daily weeds and storm debris never land there, or the tutorial's next
 * step could say "Clear the ground first".
 */
export function openingTile(g: Game, x: number, y: number): boolean {
  if (!g.flags.has('tinker_start')) return false;
  const inRect = (r: { x: number; y: number; w: number; h: number }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  if (inRect(OPENING.beans) || inRect(OPENING.plot)) return true;
  return [OPENING.jar, OPENING.armTile, OPENING.chest, OPENING.feedArm].some(([tx, ty]) => tx === x && ty === y);
}
