// Professions: at skill levels 5 and 10 you choose one of two perks.
export interface PerkDef { id: string; skill: string; level: 5 | 10; name: string; desc: string }

export const PERKS: PerkDef[] = [
  { id: 'tiller', skill: 'farming', level: 5, name: 'Tiller', desc: 'Crops and fruit sell for 10% more.' },
  { id: 'rancher', skill: 'farming', level: 5, name: 'Rancher', desc: 'Animal products sell for 20% more.' },
  { id: 'artisan', skill: 'farming', level: 10, name: 'Artisan', desc: 'Artisan goods (wine, jam, cheese...) sell for 25% more.' },
  { id: 'agriculturist', skill: 'farming', level: 10, name: 'Agriculturist', desc: 'All crops grow 10% faster.' },
  { id: 'lumberjack', skill: 'foraging', level: 5, name: 'Lumberjack', desc: 'Felled trees drop 25% more wood, and hardwood more often.' },
  { id: 'gatherer', skill: 'foraging', level: 5, name: 'Gatherer', desc: '20% chance to gather double forage.' },
  { id: 'botanist', skill: 'foraging', level: 10, name: 'Botanist', desc: 'Forage is always at least gold quality.' },
  { id: 'tapper_pro', skill: 'foraging', level: 10, name: 'Woodwright', desc: 'Planks, beams and wood goods sell for 40% more.' },
  { id: 'miner', skill: 'mining', level: 5, name: 'Miner', desc: '+1 ore from every ore rock.' },
  { id: 'geologist', skill: 'mining', level: 5, name: 'Geologist', desc: 'Gems and minerals sell for 30% more.' },
  { id: 'blacksmith', skill: 'mining', level: 10, name: 'Blacksmith', desc: 'Metal bars sell for 40% more.' },
  { id: 'excavator', skill: 'mining', level: 10, name: 'Excavator', desc: 'Geodes and relics turn up twice as often.' },
  { id: 'angler', skill: 'fishing', level: 5, name: 'Angler', desc: 'Fish sell for 25% more.' },
  { id: 'trapper', skill: 'fishing', level: 5, name: 'Trapper', desc: 'Fish traps catch one extra shellfish each day.' },
  { id: 'steady', skill: 'fishing', level: 10, name: 'Steady Hands', desc: 'Your catch zone is 20% wider.' },
  { id: 'luremaster', skill: 'fishing', level: 10, name: 'Luremaster', desc: 'Fish bite 40% sooner.' },
  { id: 'brute', skill: 'combat', level: 5, name: 'Brute', desc: 'Hit pests harder: a clatter-crab gives way in two hits.' },
  { id: 'defender', skill: 'combat', level: 5, name: 'Defender', desc: '+25 maximum health.' },
  { id: 'warrior', skill: 'combat', level: 10, name: 'Warrior', desc: 'Falling rock and star-shards hurt you 25% less.' },
  { id: 'scavenger', skill: 'combat', level: 10, name: 'Scavenger', desc: 'Pests drop loot 50% more often.' },
  { id: 'engineer', skill: 'tinkering', level: 5, name: 'Engineer', desc: 'Machines work 10% faster.' },
  { id: 'clockmaker', skill: 'tinkering', level: 5, name: 'Clockmaker', desc: 'Arms swing 15% faster.' },
  { id: 'industrialist', skill: 'tinkering', level: 10, name: 'Industrialist', desc: 'Machines work another 15% faster.' },
  { id: 'conservator', skill: 'tinkering', level: 10, name: 'Conservator', desc: 'Machines and arms draw 25% less power.' },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

export function perkChoices(skill: string, level: number): PerkDef[] {
  return PERKS.filter((p) => p.skill === skill && p.level === level);
}
