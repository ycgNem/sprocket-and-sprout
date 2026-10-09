// Shops, their stock, services and opening hours.
import { CROPS } from './crops';
import { TREES } from './trees';
import type { ShopDef, ShopEntry, Stack } from './types';
import { FURNITURE } from './furniture';

const seeds = (seasonsFilter: (s: number[]) => boolean, exclude: string[] = []): ShopEntry[] =>
  CROPS.filter((c) => seasonsFilter(c.seasons) && !exclude.includes(c.id)).map((c) => ({ item: c.seed, price: c.seedPrice, seasons: c.seasons as any }));

const RARE = ['glowmelon', 'starpetal', 'cogbean', 'mooncap', 'coffee', 'tealeaf', 'sunbell', 'hops'];

export interface BuildingKit {
  id: string;
  price: number;
  materials: Stack[];
  upgradeOf?: string;
  days: number;
}

export const BUILDING_KITS: BuildingKit[] = [
  { id: 'coop_1', price: 3500, materials: [{ item: 'wood', n: 250 }, { item: 'stone', n: 80 }], days: 0 },
  { id: 'coop_2', price: 9000, materials: [{ item: 'wood', n: 350 }, { item: 'stone', n: 120 }, { item: 'plank', n: 40 }], upgradeOf: 'coop_1', days: 1 },
  { id: 'coop_3', price: 18000, materials: [{ item: 'beam', n: 30 }, { item: 'brick', n: 80 }, { item: 'brass_gear', n: 10 }], upgradeOf: 'coop_2', days: 1 },
  { id: 'barn_1', price: 5500, materials: [{ item: 'wood', n: 320 }, { item: 'stone', n: 120 }], days: 0 },
  { id: 'barn_2', price: 11000, materials: [{ item: 'wood', n: 420 }, { item: 'stone', n: 180 }, { item: 'plank', n: 60 }], upgradeOf: 'barn_1', days: 1 },
  { id: 'barn_3', price: 22000, materials: [{ item: 'beam', n: 40 }, { item: 'brick', n: 120 }, { item: 'brass_gear', n: 14 }], upgradeOf: 'barn_2', days: 1 },
  { id: 'silo', price: 150, materials: [{ item: 'stone', n: 90 }, { item: 'clay', n: 10 }, { item: 'copper_bar', n: 4 }], days: 0 },
  { id: 'well', price: 800, materials: [{ item: 'stone', n: 75 }], days: 0 },
];

/** Farmhouse renovations from the carpenter. Each sets a flag once built. */
export interface HomeUpgrade {
  id: string;
  name: string;
  desc: string;
  price: number;
  materials: Stack[];
  requires?: string;
}

export const HOME_UPGRADES: HomeUpgrade[] = [
  { id: 'home_kitchen', name: 'Farmhouse Kitchen', desc: 'Refits the old stove. Cook any recipe at home, instantly, from what is in your bag.', price: 2500, materials: [{ item: 'plank', n: 40 }, { item: 'stone', n: 60 }, { item: 'copper_bar', n: 5 }] },
  { id: 'home_featherbed', name: 'Featherbed', desc: 'Late nights cost half as much energy the next morning.', price: 1800, materials: [{ item: 'cloth', n: 4 }, { item: 'wool', n: 8 }] },
  { id: 'home_pantry', name: 'Root Cellar', desc: 'A cool cellar under the floorboards: 36 slots of storage that the kitchen can cook from.', price: 3500, materials: [{ item: 'plank', n: 60 }, { item: 'stone', n: 120 }, { item: 'clay', n: 10 }], requires: 'home_kitchen' },
  { id: 'home_hearth', name: 'Grand Hearth', desc: 'Warming up at the fireplace restores 40 energy instead of 10.', price: 4200, materials: [{ item: 'brick', n: 40 }, { item: 'iron_bar', n: 4 }] },
];

export const SHOPS: ShopDef[] = [
  {
    id: 'cart', name: "Mags' Traveling Cart", owner: 'peddler', loc: 'square', open: 480, close: 1140,
    greeting: 'Rare goods from far roads! Fridays and Sundays only.',
    stock: [],
  },
  {
    id: 'general', name: 'Thistlewick Mercantile', owner: 'marigold', loc: 'store', open: 540, close: 1020, closedDays: [2],
    greeting: 'Seeds, staples and the latest gossip. What can I get you?',
    stock: [
      ...seeds(() => true, RARE),
      { item: 'compost', price: 40 }, { item: 'grow_tonic', price: 90, unlock: 'r_fertilizer' }, { item: 'damp_mulch', price: 60, unlock: 'r_fertilizer' },
      { item: 'apple_sapling' }, { item: 'cherry_sapling' }, { item: 'apricot_sapling' }, { item: 'peach_sapling' }, { item: 'pear_sapling' },
      { item: 'plum_sapling' }, { item: 'orange_sapling', seasons: [1, 2] }, { item: 'snowberry_sapling', seasons: [2, 3] },
      { item: 'bread', price: 140 }, { item: 'flour', price: 110 }, { item: 'sugar', price: 120 }, { item: 'oil', price: 220 },
      { item: 'chest_wood', price: 240 }, { item: 'scarecrow', price: 260 }, { item: 'sign', price: 40 },
      ...FURNITURE.filter((f) => f.shop === 'general').map((f) => ({ item: f.id, price: f.price })),
    ],
    buys: ['crop', 'fruit', 'flower', 'forage', 'seed', 'artisan', 'food', 'animal'],
  },
  {
    id: 'smithy', name: 'The Anvil & Ember', owner: 'bram', loc: 'smithy', open: 540, close: 960, closedDays: [6],
    greeting: 'Mind the sparks. Ore, bars, blades and upgrades.',
    stock: [
      { item: 'copper_ore', price: 75 }, { item: 'tin_ore', price: 90 }, { item: 'iron_ore', price: 150 }, { item: 'coal', price: 150 }, { item: 'gold_ore', price: 400 },
      { item: 'sword_1', price: 900 }, { item: 'sword_2', price: 3200 }, { item: 'sword_3', price: 9000 },
      { item: 'furnace', price: 600 },
    ],
    buys: ['ore', 'bar', 'gem', 'mineral'],
  },
  {
    id: 'carpenter', name: 'Oakroot Joinery', owner: 'juniper', loc: 'carpenter', open: 540, close: 1020, closedDays: [1],
    greeting: 'Every good farm starts with good timber. Buildings, lumber, and fine joinery.',
    stock: [
      { item: 'wood', price: 12 }, { item: 'stone', price: 18 }, { item: 'hardwood', price: 120, daily: 40 }, { item: 'plank', price: 40 }, { item: 'clay', price: 60 },
      { item: 'fence_wood', price: 15 }, { item: 'gate', price: 60 }, { item: 'path_wood', price: 8 }, { item: 'path_stone', price: 10 },
      { item: 'chest_wood', price: 220 }, { item: 'lamp', price: 240 },
      ...FURNITURE.filter((f) => f.shop === 'carpenter').map((f) => ({ item: f.id, price: f.price })),
    ],
    buys: ['resource'],
  },
  {
    id: 'workshop', name: 'Cogwhistle Workshop', owner: 'ottoline', loc: 'workshop', open: 600, close: 1080,
    greeting: 'Ah! A fellow enthusiast of things that turn. Parts, gizmos, and grand ideas.',
    stock: [
      { item: 'copper_gear', price: 160 }, { item: 'copper_coil', price: 120 }, { item: 'rope', price: 60 }, { item: 'spring', price: 300, unlock: 'r_metallurgy' },
      { item: 'lab', price: 1500, unlock: 'flag:lab' }, { item: 'belt_1', price: 60, unlock: 'r_belts' }, { item: 'arm_basic', price: 350, unlock: 'r_arms' }, { item: 'jar', price: 400, unlock: 'r_preserves' },
      { item: 'pole_wood', price: 90, unlock: 'r_power' }, { item: 'brass_gear', price: 380, unlock: 'r_brass' }, { item: 'glass', price: 120, unlock: 'r_glass' },
      { item: 'spark_coil', price: 900, unlock: 'r_spark' }, { item: 'bumblebot', price: 3000, unlock: 'r_bots' },
    ],
    buys: ['component', 'bar', 'research'],
  },
  {
    id: 'inn', name: 'The Copper Kettle', owner: 'rowan', loc: 'inn', open: 480, close: 1380,
    greeting: 'Sit, sit! Something warm for the road?',
    stock: [
      { item: 'bread', price: 160 }, { item: 'salad', price: 250 }, { item: 'veggie_soup', price: 340 }, { item: 'omelet', price: 300 },
      { item: 'pancakes', price: 420 }, { item: 'fish_stew', price: 420 }, { item: 'coffee_drink', price: 280 }, { item: 'tea', price: 220 },
      { item: 'pumpkin_pie', price: 600, seasons: [2] }, { item: 'berry_tart', price: 480, seasons: [0, 1] }, { item: 'chestnut_soup', price: 450, seasons: [3] },
    ],
    buys: ['food', 'artisan'],
  },
  {
    id: 'clinic', name: 'Valley Clinic', owner: 'ines', loc: 'clinic', open: 540, close: 900, closedDays: [5, 6],
    greeting: 'Sit down before you fall down. What hurts?',
    stock: [{ item: 'tea', price: 300 }, { item: 'salad', price: 300 }],
    buys: [],
  },
  {
    id: 'fisher', name: "Halloway's Bait & Tackle", owner: 'wren', loc: 'fisher_hut', open: 540, close: 1020,
    greeting: 'Tide waits for no one. Rods, bait, traps.',
    stock: [
      { item: 'rod_1', price: 1800 }, { item: 'rod_2', price: 5000 }, { item: 'rod_3', price: 12000 },
      { item: 'bait', price: 6 }, { item: 'deluxe_bait', price: 24, unlock: 'r_traps' }, { item: 'fish_trap', price: 900 },
    ],
    buys: ['fish', 'trash'],
  },
  {
    id: 'ranch', name: 'Meadowlark Ranch', owner: 'clem', loc: 'ranch', open: 540, close: 960, closedDays: [0, 1],
    greeting: 'Howdy. Looking for a new friend for the farm?',
    stock: [{ item: 'hay', price: 50 }],
    buys: ['animal'],
  },
  {
    id: 'hermit', name: "Thorne's Hollow", owner: 'thorne', loc: 'hermit_hut', open: 600, close: 1080, closedDays: [0, 1, 2, 3, 6],
    greeting: 'The forest gives. I merely pass it on.',
    stock: [
      ...CROPS.filter((c) => RARE.includes(c.id)).map((c) => ({ item: c.seed, price: Math.round(c.seedPrice * 1.5), seasons: c.seasons as any, daily: 10 })),
      ...TREES.filter((t) => t.wild).map((t) => ({ item: t.sapling, price: 80, daily: 5 })),
      { item: 'super_tonic', price: 160, daily: 20 }, { item: 'deep_mulch', price: 120, daily: 20 },
    ],
    buys: ['forage', 'gem', 'mineral'],
  },
];

export const SHOP_BY_ID = new Map(SHOPS.map((s) => [s.id, s]));

export const TOOL_UPGRADE_COST: [number, string, number][] = [
  // [coins, bar, bars needed] for tiers 1..4
  [1800, 'copper_bar', 6],
  [4500, 'iron_bar', 6],
  [11000, 'gold_bar', 6],
  [22000, 'starmetal_bar', 6],
];
