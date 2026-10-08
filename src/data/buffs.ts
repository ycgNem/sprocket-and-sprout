// Food buffs: one active at a time, measured in game minutes. Cleared when you sleep.
import { C } from './palette';
import type { FoodBuff, BuffKind } from './types';

export const BUFF_INFO: Record<BuffKind, { name: string; color: number; per: string; icon: string }> = {
  speed: { name: 'Swift', color: C.sky, per: '+8% walking speed', icon: 'coffee_drink' },
  stamina: { name: 'Hearty', color: C.lime, per: '-10% tool energy', icon: 'pancakes' },
  fishing: { name: 'Angler', color: C.aqua, per: 'wider catch zone', icon: 'fish_stew' },
  mining: { name: 'Prospector', color: C.copper, per: '+8% extra ore, -8% pick energy', icon: 'miners_pie' },
  luck: { name: 'Lucky', color: C.butter, per: '+4% better harvest quality, more forage', icon: 'cake' },
  defense: { name: 'Sturdy', color: C.stone, per: '-12% damage taken', icon: 'chestnut_soup' },
  farming: { name: 'Green Thumb', color: C.leaf, per: '-10% hoe/can energy, +3% quality', icon: 'corn_chowder' },
};

const b = (kind: BuffKind, lvl: number, hours: number): FoodBuff => ({ kind, lvl, min: hours * 60 });

export const FOOD_BUFFS: Record<string, FoodBuff> = {
  salad: b('speed', 1, 3),
  veggie_soup: b('defense', 2, 5),
  fish_stew: b('fishing', 2, 5),
  pumpkin_pie: b('luck', 2, 6),
  berry_tart: b('speed', 1, 4),
  omelet: b('stamina', 1, 4),
  pancakes: b('stamina', 2, 5),
  cake: b('luck', 3, 8),
  cookies: b('speed', 1, 2),
  pizza: b('stamina', 2, 6),
  baked_potato: b('defense', 1, 3),
  corn_chowder: b('farming', 2, 6),
  fried_fish: b('fishing', 1, 4),
  stuffed_peppers: b('mining', 2, 5),
  honey_bun: b('speed', 2, 4),
  fruit_salad: b('luck', 1, 4),
  roast_yam: b('farming', 1, 4),
  mushroom_risotto: b('mining', 2, 8),
  miners_pie: b('mining', 3, 8),
  glow_sorbet: b('speed', 3, 10),
  chestnut_soup: b('defense', 3, 8),
  coffee_drink: b('speed', 2, 2),
  tea: b('stamina', 1, 3),
};

export function buffText(fb: FoodBuff): string {
  const info = BUFF_INFO[fb.kind];
  return `${info.name} ${'I'.repeat(fb.lvl)}: ${info.per}${fb.lvl > 1 ? ` (x${fb.lvl})` : ''}, ${fb.min / 60}h`;
}
