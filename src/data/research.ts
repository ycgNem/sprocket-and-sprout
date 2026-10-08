// The research tree. Labs consume one of each listed bundle per research unit.
// Unlocked recipes reference these ids via RecipeDef.unlock.
import type { ResearchDef, Stack } from './types';

const G = 'bundle_green', CU = 'bundle_copper', R = 'bundle_rose', B = 'bundle_brass', S = 'bundle_star';
const cost = (n: number, ...b: string[]): Stack[] => b.map((item) => ({ item, n }));

export const RESEARCH: ResearchDef[] = [
  // ---- Tier 1: Sprout bundles ----
  { id: 'r_preserves', name: 'Preserving', desc: 'Jars of summer for the winter.', icon: 'jar', cost: cost(5, G), unitTime: 6, prereq: [], pos: [0, 0] },
  { id: 'r_belts', name: 'Conveyance', desc: 'A canvas belt on rollers. Items that move themselves!', icon: 'belt_1', cost: cost(6, G), unitTime: 6, prereq: [], pos: [0, 2] },
  { id: 'r_fertilizer', name: 'Soil Science', desc: 'Richer composts, tonics and mulches.', icon: 'rich_compost', cost: cost(6, G), unitTime: 6, prereq: [], pos: [0, 4] },
  { id: 'r_metallurgy', name: 'Metalwork', desc: 'Coils, plates and springs from smelted bars.', icon: 'copper_coil', cost: cost(5, G), unitTime: 6, prereq: [], pos: [0, 6] },
  { id: 'r_woodworking', name: 'Woodcraft', desc: 'Charcoal kilns and finer joinery.', icon: 'charcoal_kiln', cost: cost(6, G), unitTime: 6, prereq: [], pos: [0, 8] },
  { id: 'r_brewing', name: 'Brewing', desc: 'Kegs for wine, ale and mead.', icon: 'keg', cost: cost(12, G), unitTime: 8, prereq: ['r_preserves'], pos: [1, 0] },
  { id: 'r_arms', name: 'Clockwork Arms', desc: 'Spring-wound arms that move items for you. No power needed!', icon: 'arm_basic', cost: cost(8, G), unitTime: 8, prereq: ['r_belts'], pos: [1, 2] },
  { id: 'r_sprinklers', name: 'Irrigation', desc: 'Sprinklers that water crops every morning.', icon: 'sprinkler_1', cost: cost(10, G), unitTime: 8, prereq: ['r_fertilizer'], pos: [1, 4] },
  { id: 'r_seed_sifting', name: 'Seed Sifting', desc: 'Turn a crop back into seeds.', icon: 'seed_sifter', cost: cost(10, G), unitTime: 8, prereq: ['r_fertilizer'], pos: [1, 5] },
  { id: 'r_masonry', name: 'Masonry', desc: 'Brick kilns, stone walls and brick paths.', icon: 'brick_kiln', cost: cost(10, G), unitTime: 8, prereq: ['r_woodworking'], pos: [1, 8] },
  { id: 'r_bees', name: 'Apiary', desc: 'Bee skeps for honey. Flowers nearby flavor it.', icon: 'bee_skep', cost: cost(10, G), unitTime: 8, prereq: ['r_preserves'], pos: [1, 1] },
  { id: 'r_tapping', name: 'Tapping', desc: 'Spigots for collecting tree sap and syrup.', icon: 'tapper', cost: cost(10, G), unitTime: 8, prereq: ['r_woodworking'], pos: [1, 9] },
  { id: 'r_traps', name: 'Trapcraft', desc: 'Wicker fish traps and glowing bait.', icon: 'fish_trap', cost: cost(10, G), unitTime: 8, prereq: ['r_woodworking'], pos: [1, 10] },

  // ---- Tier 2: Tinker bundles ----
  { id: 'r_logistics', name: 'Logistics', desc: 'Splitters and burrow belts for tidy factories.', icon: 'splitter_1', cost: cost(15, G, CU), unitTime: 10, prereq: ['r_arms', 'r_metallurgy'], pos: [2, 2] },
  { id: 'r_power', name: 'Water Power', desc: 'Water wheels and wooden poles. Power for the first machines.', icon: 'waterwheel', cost: cost(15, G, CU), unitTime: 10, prereq: ['r_metallurgy'], pos: [2, 6] },
  { id: 'r_dairy', name: 'Dairy', desc: 'Cheese presses for milk and eggs.', icon: 'cheese_press', cost: cost(10, G, CU), unitTime: 10, prereq: ['r_brewing'], pos: [2, 0] },
  { id: 'r_weaving', name: 'Weaving', desc: 'A hand loom for cotton, flax and wool.', icon: 'hand_loom', cost: cost(12, G, CU), unitTime: 10, prereq: ['r_preserves', 'r_metallurgy'], pos: [2, 1] },
  { id: 'r_cooking', name: 'Hearth Cooking', desc: 'A brick oven for bread, pies and hearty meals.', icon: 'oven', cost: cost(12, G, CU), unitTime: 10, prereq: ['r_masonry'], pos: [2, 8] },
  { id: 'r_glass', name: 'Glassblowing', desc: 'Melt sand into glass in furnaces and kilns.', icon: 'glass', cost: cost(12, G, CU), unitTime: 10, prereq: ['r_masonry'], pos: [2, 9] },
  { id: 'r_brass', name: 'Brass Working', desc: 'Alloy copper and tin into brass, then brass gears.', icon: 'brass_gear', cost: cost(15, G, CU), unitTime: 10, prereq: ['r_metallurgy'], pos: [2, 7] },
  { id: 'r_storage', name: 'Iron Storage', desc: 'Iron chests and shipping crates.', icon: 'chest_iron', cost: cost(10, G, CU), unitTime: 10, prereq: ['r_metallurgy'], pos: [2, 5] },
  { id: 'r_wind', name: 'Wind Power', desc: 'Windmills that turn breeze into power.', icon: 'windmill', cost: cost(20, G, CU), unitTime: 12, prereq: ['r_power'], pos: [3, 6] },
  { id: 'r_milling', name: 'Milling', desc: 'A powered grist mill for flour, sugar and oil.', icon: 'mill', cost: cost(20, G, CU), unitTime: 12, prereq: ['r_power'], pos: [3, 5] },
  { id: 'r_sawmill', name: 'Sawmilling', desc: 'A powered sawmill: twice the planks from every log.', icon: 'sawmill', cost: cost(20, G, CU), unitTime: 12, prereq: ['r_power', 'r_woodworking'], pos: [3, 7] },
  { id: 'r_fast_arm', name: 'Steam Arms', desc: 'Powered arms, three times quicker.', icon: 'arm_fast', cost: cost(20, G, CU), unitTime: 12, prereq: ['r_power', 'r_arms'], pos: [3, 3] },
  { id: 'r_assembly', name: 'Assembly', desc: 'A tinker\'s bench that crafts parts, bundles and machines by itself.', icon: 'assembler', cost: cost(25, G, CU), unitTime: 12, prereq: ['r_power'], pos: [3, 4] },
  { id: 'r_drills', name: 'Ore Drilling', desc: 'Steam drills that dig ore veins in the quarry.', icon: 'drill_steam', cost: cost(25, G, CU), unitTime: 12, prereq: ['r_logistics', 'r_brass'], pos: [3, 2] },
  { id: 'r_energy', name: 'Hearty Living', desc: 'Good habits: +40 max energy.', icon: 'salad', cost: cost(20, G, CU), unitTime: 12, prereq: ['r_cooking'], pos: [3, 8], effects: [{ t: 'energy', v: 40 }] },

  // ---- Tier 3: Harvest bundles ----
  { id: 'r_long_arm', name: 'Reaching Arms', desc: 'Arms that reach two tiles.', icon: 'arm_long', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_fast_arm'], pos: [4, 3] },
  { id: 'r_filter_arm', name: 'Sorting Arms', desc: 'Arms that only move what you tell them to.', icon: 'arm_filter', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_fast_arm', 'r_assembly'], pos: [4, 4] },
  { id: 'r_harvester', name: 'Harvest Cranes', desc: 'Powered cranes that pick ripe crops around them.', icon: 'harvester', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_assembly', 'r_sprinklers'], pos: [4, 5] },
  { id: 'r_planter', name: 'Seed Sowers', desc: 'Machines that till and plant seeds around them.', icon: 'planter', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_harvester', 'r_seed_sifting'], pos: [5, 5] },
  { id: 'r_sprinkler2', name: 'Brass Sprinklers', desc: 'Sprinklers that water a 3x3 square.', icon: 'sprinkler_2', cost: cost(20, G, CU, R), unitTime: 15, prereq: ['r_sprinklers', 'r_brass'], pos: [4, 6] },
  { id: 'r_steam', name: 'Steam Power', desc: 'Fuel-burning steam engines and iron pylons.', icon: 'steam_engine', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_wind', 'r_brass'], pos: [4, 7] },
  { id: 'r_bottling', name: 'Bottling', desc: 'Bottlers for juice, tea and coffee, plus bean roasters.', icon: 'bottler', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_assembly', 'r_glass'], pos: [4, 9] },
  { id: 'r_belt2', name: 'Brass Belts', desc: 'Belts, splitters and burrows twice as fast.', icon: 'belt_2', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_logistics', 'r_brass'], pos: [4, 2] },
  { id: 'r_crusher', name: 'Rock Crushing', desc: 'Rock crushers make gravel, sand and stray ore.', icon: 'crusher', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_drills'], pos: [4, 1] },
  { id: 'r_spark', name: 'Spark Coils', desc: 'Capture a spark in glass. The heart of advanced machines.', icon: 'spark_coil', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_glass', 'r_assembly'], pos: [4, 8] },
  { id: 'r_steam_loom', name: 'Steam Weaving', desc: 'A loom four times faster than by hand.', icon: 'steam_loom', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_weaving', 'r_steam'], pos: [5, 1] },
  { id: 'r_lab_speed', name: 'Scholarship', desc: 'Desks research 30% faster.', icon: 'lab', cost: cost(30, G, CU, R), unitTime: 15, prereq: ['r_assembly'], pos: [5, 4], effects: [{ t: 'labSpeed', v: 0.3 }] },
  { id: 'r_market', name: 'Market Savvy', desc: 'Sell everything for 5% more.', icon: 'shipping_crate', cost: cost(25, G, CU, R), unitTime: 15, prereq: ['r_storage'], pos: [3, 9], effects: [{ t: 'marketBonus', v: 0.05 }] },

  // ---- Tier 4: Brass bundles ----
  { id: 'r_brass_drill', name: 'Brass Drills', desc: 'Powered drills, twice as fast.', icon: 'drill_brass', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_crusher', 'r_steam'], pos: [6, 1] },
  { id: 'r_blast', name: 'Blast Furnace', desc: 'Smelts fast without fuel.', icon: 'blast_furnace', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_steam', 'r_spark'], pos: [6, 7] },
  { id: 'r_kitchen', name: 'Steam Kitchen', desc: 'Cooks fast without fuel.', icon: 'kitchen', cost: cost(35, G, CU, R, B), unitTime: 20, prereq: ['r_steam', 'r_cooking'], pos: [6, 8] },
  { id: 'r_sprinkler3', name: 'Gilded Sprinklers', desc: 'Sprinklers that water a 5x5 square.', icon: 'sprinkler_3', cost: cost(35, G, CU, R, B), unitTime: 20, prereq: ['r_sprinkler2'], pos: [6, 6] },
  { id: 'r_bulk_arm', name: 'Bulk Arms', desc: 'Arms that grab six items at once.', icon: 'arm_bulk', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_filter_arm', 'r_spark'], pos: [6, 4] },
  { id: 'r_grip1', name: 'Arm Grip I', desc: 'All arms carry one more item per swing.', icon: 'arm_fast', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_filter_arm'], pos: [6, 3], effects: [{ t: 'armHand', v: 1 }] },
  { id: 'r_assembly2', name: 'Clockwork Assembly', desc: 'Clockwork cores and the faster clockwork assembler.', icon: 'clockwork_core', cost: cost(45, G, CU, R, B), unitTime: 20, prereq: ['r_spark', 'r_steam'], pos: [6, 5] },
  { id: 'r_solar', name: 'Sun Lenses', desc: 'Lens arrays that turn sunlight into power.', icon: 'sunlens', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_spark', 'r_steam'], pos: [7, 7] },
  { id: 'r_battery', name: 'Spring Batteries', desc: 'Wind spare power into springs for later.', icon: 'spring_battery', cost: cost(35, G, CU, R, B), unitTime: 20, prereq: ['r_steam'], pos: [5, 7] },
  { id: 'r_towers', name: 'Copper Towers', desc: 'Tall poles whose wires stretch 26 tiles.', icon: 'pole_tower', cost: cost(30, G, CU, R, B), unitTime: 20, prereq: ['r_steam'], pos: [5, 6] },
  { id: 'r_tuning1', name: 'Fine Tuning', desc: 'All machines work 10% faster.', icon: 'copper_gear', cost: cost(50, G, CU, R, B), unitTime: 20, prereq: ['r_assembly2'], pos: [7, 5], effects: [{ t: 'machineSpeed', v: 0.1 }] },

  // ---- Tier 5: Starlight bundles ----
  { id: 'r_bots', name: 'Bumblebots', desc: 'Clockwork bees, hives and bee crates. Logistics on wings!', icon: 'bumblebot', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_assembly2'], pos: [8, 5] },
  { id: 'r_belt3', name: 'Gilded Belts', desc: 'The fastest belts in the valley.', icon: 'belt_3', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_belt2', 'r_assembly2'], pos: [8, 2] },
  { id: 'r_mist', name: 'Mist Towers', desc: 'Powered towers that keep a 9x9 area watered.', icon: 'mist_tower', cost: cost(50, G, CU, R, B, S), unitTime: 25, prereq: ['r_sprinkler3', 'r_assembly2'], pos: [8, 6] },
  { id: 'r_grip2', name: 'Arm Grip II', desc: 'All arms carry one more item per swing.', icon: 'arm_bulk', cost: cost(70, G, CU, R, B, S), unitTime: 25, prereq: ['r_grip1', 'r_bulk_arm'], pos: [8, 3], effects: [{ t: 'armHand', v: 1 }] },
  { id: 'r_tuning2', name: 'Precision Tuning', desc: 'All machines work another 15% faster.', icon: 'brass_gear', cost: cost(80, G, CU, R, B, S), unitTime: 25, prereq: ['r_tuning1'], pos: [8, 4], effects: [{ t: 'machineSpeed', v: 0.15 }] },
  { id: 'r_bot_speed', name: 'Swift Wings', desc: 'Bumblebots fly 40% faster.', icon: 'bumblebot', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_bots'], pos: [9, 5], effects: [{ t: 'droneSpeed', v: 0.4 }] },
  { id: 'r_bot_count', name: 'Busy Hives', desc: 'Each hive keeps 4 more bumblebots buzzing.', icon: 'hive', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_bots'], pos: [9, 6], effects: [{ t: 'droneCount', v: 4 }] },
  { id: 'r_starmetal', name: 'Starmetal Smelting', desc: 'Smelt the ore of fallen stars.', icon: 'starmetal_bar', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_blast'], pos: [8, 7] },
  { id: 'r_grandworks', name: 'Grand Works', desc: 'Foundations for the valley\'s great megaprojects.', icon: 'construction_site', cost: cost(80, G, CU, R, B, S), unitTime: 30, prereq: ['r_bots', 'r_starmetal'], pos: [9, 7] },
  { id: 'r_lab_speed2', name: 'Grand Scholarship', desc: 'Desks research another 50% faster.', icon: 'lab', cost: cost(70, G, CU, R, B, S), unitTime: 25, prereq: ['r_lab_speed', 'r_tuning1'], pos: [8, 8], effects: [{ t: 'labSpeed', v: 0.5 }] },
  { id: 'r_market2', name: 'Trade Routes', desc: 'Sell everything for another 10% more.', icon: 'gold_bar', cost: cost(60, G, CU, R, B, S), unitTime: 25, prereq: ['r_market', 'r_bots'], pos: [9, 8], effects: [{ t: 'marketBonus', v: 0.1 }] },
  { id: 'r_reach', name: 'Long Arms', desc: 'You can reach and build 3 tiles further.', icon: 'arm_long', cost: cost(40, G, CU, R, B), unitTime: 20, prereq: ['r_long_arm'], pos: [5, 3], effects: [{ t: 'reach', v: 3 }] },
];

export const RESEARCH_BY_ID = new Map(RESEARCH.map((r) => [r.id, r]));
