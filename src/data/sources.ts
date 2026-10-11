// Where a raw material or a common part comes from, for its tooltip and the crafting window's
// ingredients (the owner's playtest: "it doesn't tell you how to get plant fiber for the bundle"; the
// critic's 2.0 pass: the gleaner's planks, gears and rope, and the wheel's coils, said nothing). Each
// line is what the game does (src/sim/actions.ts, src/data/recipes.ts, src/data/shops.ts): change one
// when its source changes.
export const SOURCE: Record<string, string> = {
  fiber: 'Cut weeds with the scythe or the axe (tall grass gives some too).',
  wood: 'Chop trees with the axe.',
  sap: 'Chop down a full-grown tree with the axe.',
  hardwood: 'Split stumps (copper axe) and big logs (iron axe); full-grown oaks and maples drop some.',
  stone: 'Break rocks with the pickaxe.',
  clay: 'Hoe the dig spots in the ground; rocks and the Deepworks give a little.',
  coal: "Coal rocks in the Deepworks (levels 1-5 and 16-20); plain rocks drop some, the quarry's more.",
  copper_ore: 'Break ore rocks with the pickaxe in the Deepworks, levels 1-5 (the Earth).',
  tin_ore: 'Break ore rocks with the pickaxe in the Deepworks, levels 6-10 (the Clayworks).',
  iron_ore: 'Break ore rocks with the pickaxe in the Deepworks, levels 11-15 (the Frost).',
  gold_ore: 'Break ore rocks with the pickaxe in the Deepworks, levels 16-20 (the Ember).',
  kelp: 'Washes up on the beach every morning. Fish traps set in the sea catch some too.',
  // parts
  plank: 'Craft it from 2 wood (C), or buy it at the Joinery.',
  rope: 'Craft it from 3 plant fiber (C), or buy it at the Workshop.',
  copper_gear: 'Craft it from a copper bar (C), or buy it at the Workshop.',
  copper_coil: 'Craft two from a copper bar (C, after Metalwork), or buy them at the Workshop.',
  copper_bar: 'Smelt 3 copper ore in a furnace, with wood or coal to burn. The Smithy sells ore and furnaces.',
};
