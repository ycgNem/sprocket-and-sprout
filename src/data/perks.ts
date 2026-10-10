// Professions: at skill levels 5 and 10 you choose one of two perks. Tinkering comes first and rises
// with what your machines make; farming's are about the field machines and the crock, not sell
// prices (the critic's Stardew test, Phases 3+4 re-check: "only the names changed"); foraging and
// mining each have one that runs their machines too (Sawyer, Drill Rigger, Furnace Hand). Each pair
// is a real trade-off (the critic's confirmation pass: arms are never a line's bottleneck, and a
// gleaner idles most of the afternoon): speed or brownout tolerance, yield or coverage. Fishing and
// combat were the last pairs to have no works answer (Phase 5): each is now hands or works, a fishing
// perk for you or for the ponds and traps, a combat perk for you or for what you build down below.
// Ids are kept from 1.x, so a save keeps its picks (with the new effects; Hard Hat's +25 health is
// taken back on load).
export interface PerkDef { id: string; skill: string; level: 5 | 10; name: string; desc: string }

export const PERKS: PerkDef[] = [
  { id: 'engineer', skill: 'tinkering', level: 5, name: 'Engineer', desc: 'Machines work 10% faster.' },
  { id: 'clockmaker', skill: 'tinkering', level: 5, name: 'Governor', desc: 'Powered machines keep full speed until the grid meets less than 75% of what they need.' },
  { id: 'industrialist', skill: 'tinkering', level: 10, name: 'Industrialist', desc: 'Machines work another 15% faster.' },
  { id: 'conservator', skill: 'tinkering', level: 10, name: 'Conservator', desc: 'Machines and arms draw 25% less power.' },
  { id: 'tiller', skill: 'farming', level: 5, name: 'Field Hand', desc: 'Gleaners, harvest cranes and the field gantry pick one crop extra every fourth pick.' },
  { id: 'rancher', skill: 'farming', level: 5, name: 'Long Reach', desc: 'Gleaners pick a 5x5 around them, not a 3x3; cranes and sowers reach a tile further.' },
  { id: 'artisan', skill: 'farming', level: 10, name: 'Crock Master', desc: 'Crocks, kegs and cheese presses work 20% faster.' },
  { id: 'agriculturist', skill: 'farming', level: 10, name: 'Seedwright', desc: 'All crops grow 10% faster.' },
  { id: 'lumberjack', skill: 'foraging', level: 5, name: 'Woodcutter', desc: 'Felled trees drop 25% more wood, and hardwood more often.' },
  { id: 'gatherer', skill: 'foraging', level: 5, name: 'Sawyer', desc: 'Sawmills and charcoal kilns work 25% faster.' },
  { id: 'botanist', skill: 'foraging', level: 10, name: 'Wildcrafter', desc: 'Forage is always at least gold quality.' },
  { id: 'tapper_pro', skill: 'foraging', level: 10, name: 'Woodwright', desc: 'Planks, beams and wood goods sell for 40% more.' },
  { id: 'miner', skill: 'mining', level: 5, name: 'Prospector', desc: '+1 ore from every ore rock.' },
  { id: 'geologist', skill: 'mining', level: 5, name: 'Drill Rigger', desc: 'Drills at the quarry work 25% faster.' },
  { id: 'blacksmith', skill: 'mining', level: 10, name: 'Furnace Hand', desc: 'Furnaces and blast furnaces smelt 25% faster.' },
  { id: 'excavator', skill: 'mining', level: 10, name: 'Delver', desc: 'Geodes and relics turn up twice as often.' },
  { id: 'angler', skill: 'fishing', level: 5, name: 'Pond Keeper', desc: 'Fish ponds grow their school and lay roe 50% faster.' },
  { id: 'trapper', skill: 'fishing', level: 5, name: 'Trap-setter', desc: 'Fish traps catch one extra shellfish each day.' },
  { id: 'steady', skill: 'fishing', level: 10, name: 'Net Rigger', desc: 'Fish traps catch without bait (bait still adds to the haul).' },
  { id: 'luremaster', skill: 'fishing', level: 10, name: 'Fly-tier', desc: 'Fish bite 40% sooner.' },
  { id: 'brute', skill: 'combat', level: 5, name: 'Crab-cracker', desc: 'Hit pests harder: a clatter-crab gives way in two hits.' },
  { id: 'defender', skill: 'combat', level: 5, name: 'Shorer', desc: 'A cracked ceiling takes one plank to prop, a caved-in gallery 10 beams to shore.' },
  { id: 'warrior', skill: 'combat', level: 10, name: 'Warrior', desc: 'Falling rock and star-shards hurt you 25% less.' },
  { id: 'scavenger', skill: 'combat', level: 10, name: 'Lampwright', desc: 'Lamps you set down in the Deepworks light 10 tiles around, not 7.' },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

export function perkChoices(skill: string, level: number): PerkDef[] {
  return PERKS.filter((p) => p.skill === skill && p.level === level);
}
