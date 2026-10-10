// Shake amounts, kept small on purpose (1.2 playtest: "dampen the vigorous shaking").
// Trees and struck structures wobble a couple of world pixels; the camera never moves more than
// CAM_SHAKE_MAX screen pixels. The Screen shake setting turns both off.

/** widest tree / structure wobble, world pixels */
export const WOBBLE_PX = 2;
/** wobble speed, radians per second */
export const WOBBLE_RAD = 30;
/** the camera's widest kick, screen pixels */
export const CAM_SHAKE_MAX = 3;
/** a shake timer starts here (sim: g.sys.treeShake / structure hits) and counts down to 0 */
export const WOBBLE_START = 4;

/**
 * Horizontal wobble for a shake timer `v` (WOBBLE_START down to 0): an eased decay, so the hit
 * lands hardest and settles instead of stopping dead. Whole pixels only.
 */
export function wobbleOffset(v: number, time: number): number {
  if (v <= 0) return 0;
  const k = Math.min(1, v / WOBBLE_START);
  return Math.round(Math.sin(time * WOBBLE_RAD) * WOBBLE_PX * k * k);
}

/** The camera's kick for a shake amount (0.2-0.4 from the sim) and a random number in [0, 1). */
export function camShakeOffset(amt: number, rnd: number): number {
  if (amt <= 0) return 0;
  return Math.max(-CAM_SHAKE_MAX, Math.min(CAM_SHAKE_MAX, (rnd - 0.5) * amt * 3));
}
