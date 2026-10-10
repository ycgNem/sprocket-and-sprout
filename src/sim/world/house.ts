// The farmhouse's size (Workshop HQ, ROADMAP.md 7.8): the room is 14 tiles wide; the Workshop
// upgrade opens its east wall into a stone-floored wing, 22 wide. The house's entity store is made
// at the wide size from the start, so placed structures never need moving when the wing opens.
// Data only: src/sim/systems/house.ts builds the map.
export const HOUSE_W = 14;
export const HOUSE_WIDE = 22;
export const HOUSE_H = 11;
export const HOUSE_DOOR: [number, number] = [7, 10];
