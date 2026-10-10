// The research tree in five eras (ROADMAP.md 7.3, 8). A desk consumes one of each listed bundle per
// research unit; unlocked recipes reference these ids via RecipeDef.unlock. Keystones carry stages
// (observe, experiment, validate) that come before the bundles (apply); the 12 flat-buff nodes of
// 1.x are era rewards now (ERA_REWARDS), granted when an era's town keystone completes.
import type { ResearchDef, ResearchEffect, Stack } from './types';

const G = 'bundle_green', CU = 'bundle_copper', R = 'bundle_rose', B = 'bundle_brass', S = 'bundle_star';
const cost = (n: number, ...b: string[]): Stack[] => b.map((item) => ({ item, n }));
const E1 = [G], E2 = [G, CU], E3 = [G, CU, R], E4 = [G, CU, R, B], E5 = [G, CU, R, B, S];

export const ERA_NAMES = ['', 'Spring', 'Water', 'Steam', 'Clockwork', 'Starlight'] as const;
/** the town keystone(s) each era builds toward, for the research window's era headers */
export const ERA_KEYSTONE = ['', "The Keeper's Line", 'The Town Mill', 'The Waterworks, Lamplighting', 'The Tram', 'The Clock'] as const;

export const RESEARCH: ResearchDef[] = [
  // ---- Era 1, Spring: sprout bundles ----
  { id: 'r_belts', name: 'Conveyance', desc: 'A canvas belt on rollers. Items that move themselves!', icon: 'belt_1', cost: cost(2, ...E1), unitTime: 45, prereq: [], era: 1, row: 0,
    keystone: {
      observe: { flag: 'observed:belt_1', label: "Look over the keeper's belt run (hover it, or hold I over it)" },
      experiment: [{ t: 'flag', flag: 'belt_into:jar', label: 'Get a bean riding a belt into a crock' }],
    } },
  { id: 'r_arms', name: 'Clockwork Arms', desc: 'Spring-wound arms that move items for you. No power needed!', icon: 'arm_basic', cost: cost(8, ...E1), unitTime: 8, prereq: ['r_belts'], era: 1, row: 0 },
  { id: 'r_gleaning', name: 'Gleaning', desc: 'A spring-wound picker on a post: it gathers the ripe crops around it.', icon: 'gleaner', cost: cost(8, ...E1), unitTime: 8, prereq: ['r_arms'], era: 1, row: 1 },
  { id: 'r_preserves', name: 'Preserving', desc: 'Crocks that keep summer for the winter.', icon: 'jar', cost: cost(5, ...E1), unitTime: 6, prereq: [], era: 1, row: 2 },
  { id: 'r_brewing', name: 'Brewing', desc: 'Kegs for wine, ale and mead.', icon: 'keg', cost: cost(12, ...E1), unitTime: 8, prereq: ['r_preserves'], era: 1, row: 2 },
  { id: 'r_bees', name: 'Apiary', desc: 'Bee skeps for honey. Flowers nearby flavor it.', icon: 'bee_skep', cost: cost(10, ...E1), unitTime: 8, prereq: ['r_preserves'], era: 1, row: 3 },
  { id: 'r_fertilizer', name: 'Soil Science', desc: 'Richer composts, tonics and mulches.', icon: 'rich_compost', cost: cost(6, ...E1), unitTime: 6, prereq: [], era: 1, row: 4 },
  { id: 'r_metallurgy', name: 'Metalwork', desc: 'Coils, plates and springs from smelted bars.', icon: 'copper_coil', cost: cost(5, ...E1), unitTime: 6, prereq: [], era: 1, row: 5 },
  { id: 'r_woodworking', name: 'Woodcraft', desc: 'Charcoal kilns and finer joinery.', icon: 'charcoal_kiln', cost: cost(6, ...E1), unitTime: 6, prereq: [], era: 1, row: 6 },
  { id: 'r_tapping', name: 'Tapping', desc: 'Spigots for collecting tree sap and syrup.', icon: 'tapper', cost: cost(10, ...E1), unitTime: 8, prereq: ['r_woodworking'], era: 1, row: 6 },
  { id: 'r_traps', name: 'Trapcraft', desc: 'Wicker fish traps, fish ponds and glowing bait.', icon: 'fish_trap', cost: cost(10, ...E1), unitTime: 8, prereq: ['r_woodworking'], era: 1, row: 7 },

  // ---- Era 2, Water: + copper bundles ----
  { id: 'r_power', name: 'Water Power', desc: 'Water wheels and wooden poles. Power for the first machines.', icon: 'waterwheel', cost: cost(15, ...E2), unitTime: 10, prereq: ['r_metallurgy'], era: 2, row: 0,
    keystone: {
      observe: { flag: 'observed:waterwheel', label: "Look at the keeper's water wheel by the farm gate" },
      experiment: [{ t: 'count', key: 'made:mill', n: 5, label: 'Grind 5 meal on the wheel\'s power' }],
    } },
  { id: 'r_milling', name: 'Milling', desc: 'Grist mills of your own, and the know-how to run the town\'s.', icon: 'mill', cost: cost(20, ...E2), unitTime: 12, prereq: ['r_power'], era: 2, row: 0,
    keystone: {
      observe: { flag: 'observed:town_mill', label: "Look at the town's silent mill (on the river, west of Main Street)" },
      experiment: [{ t: 'count', key: 'made:mill', n: 20, label: 'Grind 20 meal or flour' }],
      validate: { item: '#flour', perMin: 3, minutes: 2, label: 'Keep a mill making 3 a minute for 2 minutes' },
    } },
  { id: 'r_sawmill', name: 'Sawmilling', desc: 'A powered sawmill: twice the planks from every log.', icon: 'sawmill', cost: cost(20, ...E2), unitTime: 12, prereq: ['r_power', 'r_woodworking'], era: 2, row: 1 },
  { id: 'r_logistics', name: 'Logistics', desc: 'Splitters and burrow belts for tidy factories.', icon: 'splitter_1', cost: cost(15, ...E2), unitTime: 10, prereq: ['r_arms', 'r_metallurgy'], era: 2, row: 2 },
  { id: 'r_long_arm', name: 'Reaching Arms', desc: 'Spring arms that reach two tiles.', icon: 'arm_long', cost: cost(15, ...E2), unitTime: 10, prereq: ['r_logistics'], era: 2, row: 2 },
  { id: 'r_filter_arm', name: 'Sorting Arms', desc: 'Spring arms that only move what you tell them to.', icon: 'arm_filter', cost: cost(18, ...E2), unitTime: 10, prereq: ['r_logistics'], era: 2, row: 3 },
  { id: 'r_brass', name: 'Brass Working', desc: 'Alloy copper and tin into brass, then brass gears.', icon: 'brass_gear', cost: cost(15, ...E2), unitTime: 10, prereq: ['r_metallurgy'], era: 2, row: 4 },
  { id: 'r_storage', name: 'Iron Storage', desc: 'Iron chests and shipping crates.', icon: 'chest_iron', cost: cost(10, ...E2), unitTime: 10, prereq: ['r_metallurgy'], era: 2, row: 5 },
  { id: 'r_sprinklers', name: 'Irrigation', desc: 'Sprinklers that water crops every morning.', icon: 'sprinkler_1', cost: cost(10, ...E2), unitTime: 8, prereq: ['r_fertilizer'], era: 2, row: 6 },
  { id: 'r_harvester', name: 'Harvest Cranes', desc: 'Powered cranes that pick ripe crops in a 7x7 around them.', icon: 'harvester', cost: cost(20, ...E2), unitTime: 12, prereq: ['r_power', 'r_sprinklers'], era: 2, row: 6 },
  { id: 'r_seed_sifting', name: 'Seed Sifting', desc: 'Turn a crop back into seeds.', icon: 'seed_sifter', cost: cost(10, ...E2), unitTime: 8, prereq: ['r_fertilizer'], era: 2, row: 7 },
  { id: 'r_weaving', name: 'Weaving', desc: 'A hand loom for cotton, flax and wool, and canvas for belts.', icon: 'hand_loom', cost: cost(12, ...E2), unitTime: 10, prereq: ['r_preserves', 'r_metallurgy'], era: 2, row: 8 },
  { id: 'r_dairy', name: 'Dairy', desc: 'Cheese presses for milk and eggs.', icon: 'cheese_press', cost: cost(10, ...E2), unitTime: 10, prereq: ['r_brewing'], era: 2, row: 9 },
  { id: 'r_pastes', name: 'Dyes & Pastes', desc: 'Starch paste and pigment from the crock: glue for the works, colour for the town.', icon: 'pigment', cost: cost(10, ...E2), unitTime: 10, prereq: ['r_preserves'], era: 2, row: 10 },
  { id: 'r_masonry', name: 'Masonry', desc: 'Brick kilns, stone walls and brick paths.', icon: 'brick_kiln', cost: cost(10, ...E2), unitTime: 8, prereq: ['r_woodworking'], era: 2, row: 11 },
  { id: 'r_glass', name: 'Glassblowing', desc: 'Melt sand into glass in furnaces and kilns.', icon: 'glass', cost: cost(12, ...E2), unitTime: 10, prereq: ['r_masonry'], era: 2, row: 11 },

  // ---- Era 3, Steam: + rose bundles ----
  { id: 'r_steam', name: 'Steam Power', desc: 'Fuel-burning steam engines and iron pylons.', icon: 'steam_engine', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_power', 'r_brass'], era: 3, row: 0,
    keystone: {
      observe: { flag: 'observed:boiler', label: 'Study the seized boiler in the Deepworks (level 10)' },
      experiment: [{ t: 'count', key: 'made:charcoal_kiln', n: 5, label: 'Burn 5 coal in a charcoal kiln' }],
    } },
  { id: 'r_towers', name: 'Copper Towers', desc: 'Tall poles whose wires stretch 26 tiles.', icon: 'pole_tower', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_steam'], era: 3, row: 0 },
  { id: 'r_battery', name: 'Spring Batteries', desc: 'Wind spare power into springs for later.', icon: 'spring_battery', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_steam'], era: 3, row: 1 },
  { id: 'r_wind', name: 'Wind Power', desc: 'Windmills that turn breeze into power.', icon: 'windmill', cost: cost(20, ...E3), unitTime: 12, prereq: ['r_power'], era: 3, row: 2 },
  { id: 'r_fast_arm', name: 'Brass Arms', desc: 'Powered arms, three times quicker than spring arms.', icon: 'arm_fast', cost: cost(20, ...E3), unitTime: 12, prereq: ['r_power', 'r_brass'], era: 3, row: 3 },
  { id: 'r_assembly', name: 'Assembly', desc: 'A tinker\'s bench that crafts parts, bundles and machines by itself.', icon: 'assembler', cost: cost(25, ...E3), unitTime: 12, prereq: ['r_brass'], era: 3, row: 4 },
  { id: 'r_spark', name: 'Spark Coils', desc: 'Capture a spark in glass. The heart of advanced machines, and a lantern for the deep.', icon: 'spark_coil', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_glass', 'r_assembly'], era: 3, row: 4,
    keystone: {
      observe: { flag: 'observed:lampworks', label: 'Study the old lamp works in the Deepworks (level 20)' },
      experiment: [{ t: 'count', key: 'crafted:copper_coil', n: 6, label: 'Wind 6 copper coils (C)' }],
      validate: { item: 'glass', perMin: 1, minutes: 2, label: 'Keep a kiln making a glass a minute for 2 minutes' },
    } },
  { id: 'r_bottling', name: 'Bottling', desc: 'Bottlers for juice, tea and coffee, plus bean roasters.', icon: 'bottler', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_assembly', 'r_glass'], era: 3, row: 5 },
  { id: 'r_drills', name: 'Ore Drilling', desc: 'Steam drills that dig ore veins in the quarry.', icon: 'drill_steam', cost: cost(25, ...E3), unitTime: 12, prereq: ['r_logistics', 'r_brass'], era: 3, row: 6 },
  { id: 'r_crusher', name: 'Rock Crushing', desc: 'Rock crushers make gravel, sand and stray ore.', icon: 'crusher', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_drills'], era: 3, row: 6 },
  { id: 'r_sprinkler2', name: 'Brass Sprinklers', desc: 'Sprinklers that water a 3x3 square.', icon: 'sprinkler_2', cost: cost(20, ...E3), unitTime: 15, prereq: ['r_sprinklers', 'r_brass'], era: 3, row: 7 },
  { id: 'r_planter', name: 'Seed Sowers', desc: 'Machines that till and plant seeds around them.', icon: 'planter', cost: cost(30, ...E3), unitTime: 15, prereq: ['r_harvester', 'r_seed_sifting'], era: 3, row: 8 },
  { id: 'r_gantry', name: 'Field Gantry', desc: 'A brass gantry on rails that waters, picks and resows a whole strip.', icon: 'field_gantry', cost: cost(30, ...E3), unitTime: 15, prereq: ['r_planter', 'r_assembly'], era: 3, row: 8 },
  { id: 'r_threshing', name: 'Threshing', desc: 'A powered thresher: a sheaf of wheat, barley or corn becomes two grain and some straw.', icon: 'thresher', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_milling', 'r_assembly'], era: 3, row: 9 },
  { id: 'r_cooking', name: 'Hearth Cooking', desc: 'A brick oven for bread, pies and hearty meals.', icon: 'oven', cost: cost(20, ...E3), unitTime: 12, prereq: ['r_masonry'], era: 3, row: 10 },
  { id: 'r_steam_loom', name: 'Steam Weaving', desc: 'A loom four times faster than by hand.', icon: 'steam_loom', cost: cost(25, ...E3), unitTime: 15, prereq: ['r_weaving', 'r_steam'], era: 3, row: 11 },

  // ---- Era 4, Clockwork: + brass bundles ----
  { id: 'r_assembly2', name: 'Clockwork Assembly', desc: 'Clockwork cores and the faster clockwork assembler.', icon: 'clockwork_core', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_spark', 'r_steam'], era: 4, row: 0,
    keystone: {
      observe: { flag: 'observed:lockers', label: "Open the old works' lockers in the Deepworks (level 25)" },
      experiment: [{ t: 'count', key: 'made:assembler', n: 10, label: 'Have an assembler finish 10 jobs' }],
      validate: { item: 'brass_gear', perMin: 2, minutes: 3, label: 'Keep a line making 2 brass gears a minute for 3 minutes' },
    } },
  { id: 'r_blast', name: 'Blast Furnace', desc: 'Smelts fast without fuel.', icon: 'blast_furnace', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_steam', 'r_spark'], era: 4, row: 1 },
  { id: 'r_solar', name: 'Sun Lenses', desc: 'Lens arrays that turn sunlight into power.', icon: 'sunlens', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_spark', 'r_steam'], era: 4, row: 2 },
  { id: 'r_bulk_arm', name: 'Bulk Arms', desc: 'Arms that grab six items at once.', icon: 'arm_bulk', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_filter_arm', 'r_spark'], era: 4, row: 3 },
  { id: 'r_belt2', name: 'Brass Belts', desc: 'Belts, splitters and burrows twice as fast.', icon: 'belt_2', cost: cost(30, ...E4), unitTime: 15, prereq: ['r_logistics', 'r_brass'], era: 4, row: 4 },
  { id: 'r_brass_drill', name: 'Brass Drills', desc: 'Powered drills, twice as fast.', icon: 'drill_brass', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_crusher', 'r_steam'], era: 4, row: 5 },
  { id: 'r_sprinkler3', name: 'Gilded Sprinklers', desc: 'Sprinklers that water a 5x5 square.', icon: 'sprinkler_3', cost: cost(35, ...E4), unitTime: 20, prereq: ['r_sprinkler2'], era: 4, row: 6 },
  { id: 'r_long_rails', name: 'Long Rails', desc: 'Gantry rails up to 24 tiles long.', icon: 'rail', cost: cost(40, ...E4), unitTime: 20, prereq: ['r_gantry'], era: 4, row: 7 },
  { id: 'r_dawn', name: 'Dawn Shift', desc: 'A switch on field machines to pick from 6am instead of noon.', icon: 'harvester', cost: cost(30, ...E4), unitTime: 20, prereq: ['r_gantry'], era: 4, row: 8 },
  { id: 'r_kitchen', name: 'Steam Kitchen', desc: 'Cooks fast without fuel.', icon: 'kitchen', cost: cost(35, ...E4), unitTime: 20, prereq: ['r_steam', 'r_cooking'], era: 4, row: 9 },

  // ---- Era 5, Starlight: + star bundles ----
  { id: 'r_bots', name: 'Bumblebots', desc: 'Clockwork bees, hives and bee crates. Logistics on wings!', icon: 'bumblebot', cost: cost(60, ...E5), unitTime: 25, prereq: ['r_assembly2'], era: 5, row: 0,
    keystone: {
      observe: { flag: 'observed:airship', label: "Look over Roxy's airship on Skyhook Field: a machine that flies" },
      experiment: [{ t: 'count', key: 'made:assembler_2', n: 5, label: 'Have a clockwork assembler finish 5 jobs' }],
      validate: { item: 'clockwork_core', perMin: 0.5, minutes: 4, label: 'Keep making a clockwork core every 2 minutes, for 4 minutes' },
    } },
  { id: 'r_belt3', name: 'Gilded Belts', desc: 'The fastest belts in the valley.', icon: 'belt_3', cost: cost(60, ...E5), unitTime: 25, prereq: ['r_belt2', 'r_assembly2'], era: 5, row: 1 },
  { id: 'r_mist', name: 'Mist Towers', desc: 'Powered towers that keep a 9x9 area watered, on the Waterworks\' pressure.', icon: 'mist_tower', cost: cost(50, ...E5), unitTime: 25, prereq: ['r_sprinkler3', 'r_assembly2'], needFlag: 'waterworks', era: 5, row: 2 },
  { id: 'r_starmetal', name: 'Starmetal Smelting', desc: 'Smelt the ore of fallen stars.', icon: 'starmetal_bar', cost: cost(60, ...E5), unitTime: 25, prereq: ['r_blast'], era: 5, row: 3 },
  { id: 'r_grandworks', name: 'Grand Works', desc: 'Foundations for the valley\'s great megaprojects.', icon: 'construction_site', cost: cost(80, ...E5), unitTime: 30, prereq: ['r_bots', 'r_starmetal'], era: 5, row: 3,
    keystone: {
      observe: { flag: 'observed:star', label: 'Stand before the fallen star in the Deepworks (level 30)' },
      experiment: [{ t: 'count', key: 'made:blast_furnace', n: 10, label: 'Have a blast furnace finish 10 smelts' }],
      validate: { item: 'starmetal_bar', perMin: 0.3, minutes: 4, label: 'Keep starmetal coming, a bar every 3 minutes, for 4 minutes' },
    } },
];

export const RESEARCH_BY_ID = new Map(RESEARCH.map((r) => [r.id, r]));

/**
 * The column of a node inside its era band: how many of its prerequisites (in the same era) stand
 * before it. The window lays an era out as columns by this depth and rows by `row`.
 */
export function eraCol(id: string, seen = new Set<string>()): number {
  const r = RESEARCH_BY_ID.get(id);
  if (!r || seen.has(id)) return 0;
  seen.add(id);
  let d = 0;
  for (const p of r.prereq) {
    const pr = RESEARCH_BY_ID.get(p);
    if (pr && pr.era === r.era) d = Math.max(d, eraCol(p, seen) + 1);
  }
  return d;
}

/**
 * Era rewards (ROADMAP.md 7.3): what an era's town keystone grants, in one card. Each piece keeps the
 * id of the 1.x node it replaces, so a save that had researched one keeps that bonus.
 */
export interface RewardPiece {
  id: string;
  name: string;
  text: string;
  effects: ResearchEffect[];
}

export const REWARD_PIECES: RewardPiece[] = [
  { id: 'r_energy', name: 'Hearty Living', text: '+40 max energy', effects: [{ t: 'energy', v: 40 }] },
  { id: 'r_lab_speed', name: 'Scholarship', text: 'Desks research 30% faster', effects: [{ t: 'labSpeed', v: 0.3 }] },
  { id: 'r_grip1', name: 'Arm Grip I', text: 'Arms carry one more item a swing', effects: [{ t: 'armHand', v: 1 }] },
  { id: 'r_market', name: 'Market Savvy', text: 'Everything sells for 5% more', effects: [{ t: 'marketBonus', v: 0.05 }] },
  { id: 'r_tuning1', name: 'Fine Tuning', text: 'Machines work 10% faster', effects: [{ t: 'machineSpeed', v: 0.1 }] },
  { id: 'r_reach', name: 'Long Arms', text: 'You reach and build 3 tiles further', effects: [{ t: 'reach', v: 3 }] },
  { id: 'r_grip2', name: 'Arm Grip II', text: 'Arms carry one more item a swing', effects: [{ t: 'armHand', v: 1 }] },
  { id: 'r_tuning2', name: 'Precision Tuning', text: 'Machines work another 15% faster', effects: [{ t: 'machineSpeed', v: 0.15 }] },
  { id: 'r_lab_speed2', name: 'Grand Scholarship', text: 'Desks research another 50% faster', effects: [{ t: 'labSpeed', v: 0.5 }] },
  { id: 'r_market2', name: 'Trade Routes', text: 'Everything sells for another 10% more', effects: [{ t: 'marketBonus', v: 0.1 }] },
  { id: 'r_bot_speed', name: 'Swift Wings', text: 'Bumblebots fly 40% faster', effects: [{ t: 'droneSpeed', v: 0.4 }] },
  { id: 'r_bot_count', name: 'Busy Hives', text: 'Each hive keeps 4 more bumblebots', effects: [{ t: 'droneCount', v: 4 }] },
];
export const REWARD_BY_ID = new Map(REWARD_PIECES.map((p) => [p.id, p]));

export interface EraReward {
  era: number;
  /** the flag the town keystone sets (or the quest it ends with, as quest_done:<id>) */
  flag: string;
  title: string;
  pieces: string[];
}

export const ERA_REWARDS: EraReward[] = [
  { era: 1, flag: 'quest_done:k9_power', title: "The Keeper's Line runs", pieces: ['r_energy', 'r_lab_speed'] },
  { era: 2, flag: 'town_mill', title: 'The Town Mill turns', pieces: ['r_grip1', 'r_market'] },
  { era: 3, flag: 'waterworks', title: 'The Waterworks flow', pieces: ['r_tuning1'] },
  { era: 3, flag: 'lamplighting', title: 'The square is lit', pieces: ['r_reach'] },
  { era: 4, flag: 'tram', title: 'The Tram runs', pieces: ['r_grip2', 'r_tuning2', 'r_lab_speed2'] },
  { era: 5, flag: 'clock_fixed', title: 'The Clock strikes', pieces: ['r_market2', 'r_bot_speed', 'r_bot_count'] },
];

/** research ids that 1.x saves may hold and 2.0 retired into era rewards */
export const PRUNED_IDS = new Set(REWARD_PIECES.map((p) => p.id));
