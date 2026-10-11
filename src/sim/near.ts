// Who answers one F when several things could (the owner's playtest: the Professor standing beside
// the water wheel took the F meant for it). What stands on the faced tile comes first, then the
// tile's own things, then a villager or animal only near it: src/sim/actions.ts (interactTile) and
// src/sim/prompts.ts (the key bubble) follow the same order. A pure module: no system imports.

/** a villager or animal standing on a tile (its feet on it), not just near it */
export const onTile = (c: { x: number; y: number }, tx: number, ty: number) => Math.floor(c.x) === tx && Math.floor(c.y) === ty;
