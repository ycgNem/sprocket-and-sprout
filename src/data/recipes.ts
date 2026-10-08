// All crafting and processing recipes. `station: 'hand'` recipes appear in the
// crafting menu and can also be made by assemblers.
import { CROPS } from './crops';
import { FRUIT_LIST, VEG_LIST } from './items';
import type { RecipeDef, Stack } from './types';

const R: RecipeDef[] = [];
let auto = 0;
function s(item: string, n = 1, chance?: number): Stack {
  return chance === undefined ? { item, n } : { item, n, chance };
}
function rec(station: string, inp: Stack[], out: Stack[], time: number, unlock?: string, id?: string) {
  R.push({ id: id ?? `${station}:${out[0].item}:${auto++}`, station, in: inp, out, time, unlock });
}
/** hand recipe (also assembler-craftable) */
function hand(out: string, n: number, inp: [string, number][], unlock?: string, time = 2) {
  rec('hand', inp.map(([i, k]) => s(i, k)), [s(out, n)], time, unlock, `hand:${out}`);
}

// ---------------- Hand: basics ----------------
hand('chest_wood', 1, [['wood', 20]]);
hand('fence_wood', 4, [['wood', 3]]);
hand('gate', 1, [['wood', 6]]);
hand('path_stone', 2, [['stone', 1]]);
hand('path_wood', 2, [['wood', 1]]);
hand('sign', 1, [['wood', 5]]);
hand('scarecrow', 1, [['wood', 30], ['fiber', 10], ['coal', 1]]);
hand('lamp', 1, [['wood', 6], ['coal', 2]]);
hand('furnace', 1, [['stone', 25], ['copper_ore', 10]]);
hand('compost_bin', 1, [['wood', 15], ['fiber', 10]]);
hand('compost', 2, [['fiber', 6], ['sap', 1]]);
hand('bait', 5, [['fiber', 4], ['sap', 1]]);
hand('rope', 1, [['fiber', 3]]);
hand('plank', 1, [['wood', 2]]);
hand('beam', 1, [['hardwood', 2]]);
hand('flower_pot', 1, [['wood', 10], ['#flower', 2]]);
hand('lab', 1, [['wood', 50], ['copper_gear', 1], ['fiber', 10]], 'flag:lab');
hand('jar', 1, [['wood', 25], ['stone', 8], ['coal', 1]], 'r_preserves');
hand('keg', 1, [['wood', 30], ['copper_bar', 2]], 'r_brewing');
hand('bee_skep', 1, [['wood', 15], ['fiber', 30], ['sap', 2]], 'r_bees');
hand('tapper', 1, [['wood', 15], ['copper_bar', 1]], 'r_tapping');
hand('fish_trap', 1, [['wood', 25], ['rope', 2]], 'r_traps');
hand('deluxe_bait', 5, [['bait', 5], ['moth_dust', 1]], 'r_traps');
hand('charcoal_kiln', 1, [['wood', 20], ['stone', 10], ['clay', 2]], 'r_woodworking');
hand('brick_kiln', 1, [['stone', 30], ['clay', 15], ['copper_bar', 1]], 'r_masonry');
hand('fence_stone', 1, [['stone', 2]], 'r_masonry');
hand('path_brick', 2, [['brick', 1]], 'r_masonry');
hand('rich_compost', 2, [['compost', 2], ['slime_gel', 1]], 'r_fertilizer');
hand('grow_tonic', 2, [['sap', 2], ['fiber', 4], ['slime_gel', 1]], 'r_fertilizer');
hand('super_tonic', 2, [['grow_tonic', 2], ['moth_dust', 1]], 'r_fertilizer');
hand('damp_mulch', 3, [['fiber', 5], ['clay', 1]], 'r_fertilizer');
hand('deep_mulch', 2, [['damp_mulch', 2], ['kelp', 1]], 'r_fertilizer');
hand('seed_sifter', 1, [['wood', 15], ['stone', 10], ['copper_gear', 1]], 'r_seed_sifting');
hand('sprinkler_1', 1, [['copper_bar', 1], ['tin_bar', 1]], 'r_sprinklers');
hand('sprinkler_2', 1, [['brass_bar', 1], ['iron_bar', 1]], 'r_sprinkler2');
hand('sprinkler_3', 1, [['gold_bar', 1], ['brass_gear', 1], ['iron_plate', 1]], 'r_sprinkler3');
hand('mist_tower', 1, [['gold_bar', 2], ['spark_coil', 1], ['glass', 2], ['iron_plate', 4]], 'r_mist');

// ---------------- Hand: metal parts ----------------
hand('copper_gear', 1, [['copper_bar', 1]], 'r_metallurgy', 1);
hand('copper_coil', 2, [['copper_bar', 1]], 'r_metallurgy', 1);
hand('iron_plate', 1, [['iron_bar', 1]], 'r_metallurgy', 1);
hand('spring', 1, [['iron_bar', 1]], 'r_metallurgy', 1);
hand('brass_gear', 1, [['brass_bar', 1]], 'r_brass', 1);
hand('lens', 1, [['glass', 1], ['brass_bar', 1]], 'r_glass', 2);
hand('spark_coil', 1, [['copper_coil', 2], ['glass', 1], ['iron_plate', 1]], 'r_spark', 3);
rec('assembler', [s('brass_gear', 4), s('spring', 2), s('spark_coil', 2)], [s('clockwork_core', 1)], 10, 'r_assembly2', 'asm:clockwork_core');
hand('concrete', 2, [['gravel', 2], ['sand', 1], ['clay', 1]], 'r_crusher');
rec('assembler', [s('cloth', 3), s('linen', 2)], [s('quilt', 1)], 30, 'r_weaving', 'asm:quilt');

// ---------------- Hand: research bundles ----------------
rec('hand', [s('fiber', 2), s('#crop', 1)], [s('bundle_green', 1)], 2, 'flag:lab', 'hand:bundle_green');
rec('hand', [s('fiber', 2), s('#fruit', 1)], [s('bundle_green', 1)], 2, 'flag:lab', 'hand:bundle_green_fruit');
rec('hand', [s('fiber', 2), s('#forage', 1)], [s('bundle_green', 1)], 2, 'flag:lab', 'hand:bundle_green_forage');
rec('hand', [s('copper_gear', 1), s('plank', 2)], [s('bundle_copper', 1)], 3, 'r_metallurgy', 'hand:bundle_copper');
rec('hand', [s('#preserve', 1), s('cloth', 1), s('#animal', 1)], [s('bundle_rose', 1)], 4, 'r_weaving', 'hand:bundle_rose');
rec('hand', [s('brass_gear', 1), s('arm_basic', 1), s('belt_1', 2), s('glass', 1)], [s('bundle_brass', 1)], 5, 'r_spark', 'hand:bundle_brass');
rec('hand', [s('#gem', 1), s('gold_bar', 1), s('#wine', 1), s('spark_coil', 1)], [s('bundle_star', 1)], 6, 'r_assembly2', 'hand:bundle_star');

// ---------------- Hand: logistics ----------------
hand('belt_1', 3, [['copper_gear', 1], ['plank', 1], ['fiber', 2]], 'r_belts');
hand('arm_basic', 1, [['copper_gear', 2], ['plank', 2], ['rope', 1]], 'r_arms');
hand('under_1', 2, [['belt_1', 5], ['plank', 4], ['copper_gear', 2]], 'r_logistics');
hand('splitter_1', 1, [['belt_1', 4], ['copper_gear', 2], ['copper_coil', 1], ['plank', 4]], 'r_logistics');
hand('belt_2', 1, [['belt_1', 1], ['brass_gear', 1]], 'r_belt2');
hand('under_2', 2, [['under_1', 2], ['brass_gear', 4]], 'r_belt2');
hand('splitter_2', 1, [['splitter_1', 1], ['brass_gear', 4], ['spring', 1]], 'r_belt2');
hand('belt_3', 2, [['belt_2', 2], ['gold_bar', 1], ['spark_coil', 1]], 'r_belt3');
hand('under_3', 2, [['under_2', 2], ['gold_bar', 2], ['spark_coil', 2]], 'r_belt3');
hand('splitter_3', 1, [['splitter_2', 1], ['gold_bar', 2], ['spark_coil', 2]], 'r_belt3');
hand('arm_fast', 1, [['arm_basic', 1], ['copper_coil', 1], ['brass_gear', 1]], 'r_fast_arm');
hand('arm_long', 1, [['arm_fast', 1], ['iron_plate', 1], ['brass_gear', 1]], 'r_long_arm');
hand('arm_filter', 1, [['arm_fast', 1], ['spark_coil', 1]], 'r_filter_arm');
hand('arm_bulk', 1, [['arm_fast', 1], ['brass_gear', 4], ['spring', 1], ['spark_coil', 2]], 'r_bulk_arm');
hand('chest_iron', 1, [['iron_bar', 4], ['plank', 4]], 'r_storage');
hand('chest_brass', 1, [['chest_iron', 1], ['brass_bar', 4]], 'r_storage');
hand('shipping_crate', 1, [['plank', 20], ['iron_bar', 2]], 'r_storage');
hand('crate_out', 1, [['chest_iron', 1], ['spark_coil', 1], ['brass_gear', 1]], 'r_bots');
hand('crate_req', 1, [['chest_iron', 1], ['spark_coil', 1], ['brass_gear', 2]], 'r_bots');
hand('crate_store', 1, [['chest_iron', 1], ['spark_coil', 1]], 'r_bots');
hand('hive', 1, [['brass_bar', 4], ['clockwork_core', 2], ['plank', 10], ['glass', 4]], 'r_bots', 6);
hand('bumblebot', 1, [['brass_gear', 2], ['spark_coil', 1], ['spring', 1], ['glass', 1]], 'r_bots', 4);

// ---------------- Hand: power ----------------
hand('pole_wood', 2, [['wood', 2], ['copper_coil', 1]], 'r_power');
hand('waterwheel', 1, [['plank', 20], ['copper_gear', 6], ['copper_coil', 4]], 'r_power', 5);
hand('windmill', 1, [['plank', 25], ['copper_gear', 6], ['rope', 4]], 'r_wind', 5);
hand('steam_engine', 1, [['iron_plate', 8], ['brass_gear', 4], ['brick', 10], ['copper_coil', 4]], 'r_steam', 5);
hand('pole_iron', 2, [['iron_bar', 2], ['copper_coil', 2]], 'r_steam');
hand('pole_tower', 1, [['iron_plate', 4], ['copper_coil', 4], ['beam', 2]], 'r_towers');
hand('sunlens', 1, [['lens', 10], ['brass_bar', 4], ['spark_coil', 2]], 'r_solar', 5);
hand('spring_battery', 1, [['spring', 4], ['iron_plate', 2], ['copper_coil', 2], ['brass_gear', 1]], 'r_battery', 4);

// ---------------- Hand: machines ----------------
hand('cheese_press', 1, [['wood', 25], ['stone', 10], ['copper_gear', 2]], 'r_dairy');
hand('hand_loom', 1, [['wood', 40], ['fiber', 20], ['copper_gear', 1], ['rope', 2]], 'r_weaving');
hand('oven', 1, [['brick', 30], ['iron_bar', 1], ['stone', 10]], 'r_cooking');
hand('mill', 1, [['plank', 20], ['stone', 10], ['copper_gear', 4], ['iron_bar', 1]], 'r_milling', 5);
hand('sawmill', 1, [['plank', 10], ['iron_plate', 4], ['copper_gear', 4]], 'r_sawmill', 5);
hand('steam_loom', 1, [['hand_loom', 1], ['iron_plate', 4], ['brass_gear', 4], ['copper_coil', 2]], 'r_steam_loom', 5);
hand('bottler', 1, [['glass', 8], ['iron_plate', 4], ['copper_gear', 4], ['copper_coil', 2]], 'r_bottling', 5);
hand('roaster', 1, [['iron_plate', 4], ['copper_coil', 2], ['brick', 10]], 'r_bottling', 4);
hand('assembler', 1, [['copper_gear', 4], ['iron_plate', 4], ['copper_coil', 4], ['plank', 10]], 'r_assembly', 5);
hand('assembler_2', 1, [['assembler', 1], ['clockwork_core', 1], ['brass_gear', 4]], 'r_assembly2', 6);
hand('blast_furnace', 1, [['brick', 20], ['iron_plate', 8], ['copper_coil', 4], ['spark_coil', 2]], 'r_blast', 6);
hand('crusher', 1, [['iron_plate', 8], ['brass_gear', 6], ['spring', 2]], 'r_crusher', 5);
hand('kitchen', 1, [['oven', 1], ['iron_plate', 6], ['spark_coil', 2], ['copper_coil', 4]], 'r_kitchen', 6);
hand('harvester', 1, [['iron_plate', 4], ['brass_gear', 4], ['copper_coil', 2], ['spring', 1]], 'r_harvester', 5);
hand('planter', 1, [['iron_plate', 4], ['brass_gear', 4], ['copper_coil', 2], ['plank', 2]], 'r_planter', 5);
hand('drill_steam', 1, [['iron_plate', 5], ['copper_gear', 6], ['brick', 10]], 'r_drills', 5);
hand('drill_brass', 1, [['drill_steam', 1], ['brass_gear', 4], ['spark_coil', 2], ['copper_coil', 4]], 'r_brass_drill', 6);
hand('construction_site', 1, [['beam', 50], ['brick', 50], ['iron_plate', 20]], 'r_grandworks', 10);

// ---------------- Smelting (furnace, blast furnace) ----------------
rec('smelter', [s('copper_ore', 3)], [s('copper_bar', 1)], 8, undefined, 'smelt:copper');
rec('smelter', [s('tin_ore', 3)], [s('tin_bar', 1)], 8, undefined, 'smelt:tin');
rec('smelter', [s('iron_ore', 3)], [s('iron_bar', 1)], 12, undefined, 'smelt:iron');
rec('smelter', [s('gold_ore', 3)], [s('gold_bar', 1)], 16, undefined, 'smelt:gold');
rec('smelter', [s('starmetal_ore', 3)], [s('starmetal_bar', 1)], 30, 'r_starmetal', 'smelt:starmetal');
rec('smelter', [s('tin_can', 2)], [s('tin_bar', 1)], 6, undefined, 'smelt:tincan');
rec('smelter', [s('copper_bar', 2), s('tin_bar', 1)], [s('brass_bar', 2)], 10, 'r_brass', 'smelt:brass');
rec('smelter', [s('sand', 2)], [s('glass', 1)], 6, 'r_glass', 'smelt:glass');

// ---------------- Kilns ----------------
rec('kiln', [s('clay', 2)], [s('brick', 1)], 10, undefined, 'kiln:brick');
rec('kiln', [s('sand', 2)], [s('glass', 1)], 8, 'r_glass', 'kiln:glass');
rec('kiln', [s('gravel', 2), s('sand', 1), s('clay', 1)], [s('concrete', 3)], 10, 'r_crusher', 'kiln:concrete');
rec('charcoal', [s('wood', 6)], [s('coal', 1)], 30, undefined, 'charcoal:wood');
rec('charcoal', [s('sawdust', 10)], [s('coal', 1)], 20, undefined, 'charcoal:sawdust');
rec('charcoal', [s('driftwood', 3)], [s('coal', 1)], 20, undefined, 'charcoal:driftwood');

// ---------------- Compost ----------------
rec('compost', [s('fiber', 8)], [s('compost', 2)], 30, undefined, 'compost:fiber');
rec('compost', [s('sawdust', 4)], [s('compost', 1)], 20, undefined, 'compost:sawdust');
rec('compost', [s('#crop', 1)], [s('compost', 1)], 20, undefined, 'compost:crop');
rec('compost', [s('compost', 3), s('slime_gel', 1)], [s('rich_compost', 3)], 40, 'r_fertilizer', 'compost:rich');
rec('compost', [s('kelp', 2), s('fiber', 4)], [s('damp_mulch', 3)], 30, 'r_fertilizer', 'compost:mulch');

// ---------------- Keg ----------------
for (const [id] of FRUIT_LIST) rec('keg', [s(id, 1)], [s(`wine_${id}`, 1)], 180, undefined, `keg:wine_${id}`);
rec('keg', [s('wheat', 3)], [s('ale', 1)], 90, undefined, 'keg:ale');
rec('keg', [s('barley', 3)], [s('stout', 1)], 100, undefined, 'keg:stout');
rec('keg', [s('hops', 2)], [s('pale_ale', 1)], 120, undefined, 'keg:pale_ale');
rec('keg', [s('#honey', 1)], [s('mead', 1)], 120, undefined, 'keg:mead');

// ---------------- Preserves jar ----------------
for (const [id] of FRUIT_LIST) rec('jar', [s(id, 1)], [s(`jam_${id}`, 1)], 60, undefined, `jar:jam_${id}`);
for (const [id] of VEG_LIST) rec('jar', [s(id, 1)], [s(`pickles_${id}`, 1)], 60, undefined, `jar:pickles_${id}`);
rec('jar', [s('#fish', 3)], [s('caviar', 1)], 90, undefined, 'jar:caviar');

// ---------------- Cheese press ----------------
rec('press', [s('milk', 1)], [s('cheese', 1)], 40, undefined, 'press:cheese');
rec('press', [s('large_milk', 1)], [s('cheese', 2)], 40, undefined, 'press:cheese2');
rec('press', [s('goat_milk', 1)], [s('goat_cheese', 1)], 50, undefined, 'press:goat');
rec('press', [s('large_goat_milk', 1)], [s('goat_cheese', 2)], 50, undefined, 'press:goat2');
rec('press', [s('#egg', 1)], [s('mayo', 1)], 30, undefined, 'press:mayo');
rec('press', [s('milk', 2)], [s('butter', 3)], 30, undefined, 'press:butter');

// ---------------- Looms ----------------
rec('loom', [s('cotton', 3)], [s('cloth', 1)], 20, undefined, 'loom:cotton');
rec('loom', [s('wool', 1)], [s('cloth', 2)], 20, undefined, 'loom:wool');
rec('loom', [s('rabbit_fluff', 1)], [s('cloth', 2)], 20, undefined, 'loom:fluff');
rec('loom', [s('flax', 4)], [s('linen', 1)], 20, undefined, 'loom:linen');
rec('loom', [s('alpaca_fleece', 1)], [s('fine_cloth', 1)], 30, undefined, 'loom:fleece');
rec('loom', [s('fiber', 6)], [s('rope', 2)], 8, undefined, 'loom:rope');

// ---------------- Seed sifter ----------------
for (const cr of CROPS) rec('seeds', [s(cr.produce, 1)], [s(cr.seed, 2), s('fiber', 1, 0.3)], 10, undefined, `seeds:${cr.id}`);

// ---------------- Mill ----------------
rec('mill', [s('wheat', 1)], [s('flour', 1)], 4, undefined, 'mill:flour');
rec('mill', [s('barley', 1)], [s('barley_flour', 1)], 4, undefined, 'mill:barley');
rec('mill', [s('corn', 1)], [s('cornmeal', 1)], 4, undefined, 'mill:cornmeal');
rec('mill', [s('sweetcane', 1)], [s('sugar', 1)], 4, undefined, 'mill:sugar');
rec('mill', [s('beet', 1)], [s('sugar', 2)], 5, undefined, 'mill:beet');
rec('mill', [s('sunflower', 1)], [s('oil', 1)], 6, undefined, 'mill:oil');

// ---------------- Sawmill ----------------
rec('sawmill', [s('wood', 1)], [s('plank', 2), s('sawdust', 1, 0.3)], 2, undefined, 'saw:plank');
rec('sawmill', [s('hardwood', 1)], [s('beam', 2), s('sawdust', 1, 0.5)], 4, undefined, 'saw:beam');
rec('sawmill', [s('driftwood', 1)], [s('plank', 1)], 2, undefined, 'saw:drift');

// ---------------- Bottler / roaster ----------------
for (const [id] of VEG_LIST) rec('bottler', [s(id, 1)], [s(`juice_${id}`, 1)], 20, undefined, `bottle:juice_${id}`);
rec('bottler', [s('roasted_beans', 5)], [s('coffee_drink', 1)], 10, undefined, 'bottle:coffee');
rec('bottler', [s('dried_tea', 1)], [s('tea', 1)], 10, undefined, 'bottle:tea');
rec('bottler', [s('truffle', 1)], [s('truffle_oil', 1)], 30, undefined, 'bottle:truffle');
rec('roaster', [s('coffee', 5)], [s('roasted_beans', 5)], 30, undefined, 'roast:coffee');
rec('roaster', [s('tealeaf', 3)], [s('dried_tea', 1)], 20, undefined, 'roast:tea');
rec('roaster', [s('#fish', 1)], [s('smoked_fish', 1)], 30, undefined, 'roast:fish');

// ---------------- Crusher ----------------
rec('crusher', [s('stone', 2)], [s('gravel', 1), s('copper_ore', 1, 0.06), s('tin_ore', 1, 0.05), s('iron_ore', 1, 0.04), s('gold_ore', 1, 0.015)], 3, undefined, 'crush:stone');
rec('crusher', [s('gravel', 1)], [s('sand', 1)], 3, undefined, 'crush:gravel');
rec('crusher', [s('geode', 1)], [s('quartz', 1, 0.5), s('mica', 1, 0.25), s('topaz', 1, 0.15), s('jasper', 1, 0.12), s('amethyst', 1, 0.1), s('calcite', 1, 0.2), s('fluorite', 1, 0.05), s('jade', 1, 0.04)], 6, undefined, 'crush:geode');

// ---------------- Cooking (oven, kitchen) ----------------
const cook = (out: string, inp: [string, number][], time: number, n = 1) =>
  rec('oven', inp.map(([i, k]) => s(i, k)), [s(out, n)], time, undefined, `cook:${out}`);
cook('bread', [['flour', 2]], 30);
cook('salad', [['#greens', 2], ['radish', 1]], 20);
cook('veggie_soup', [['#vegetable', 3]], 40);
cook('fish_stew', [['#fish', 2], ['#vegetable', 1]], 40);
cook('pumpkin_pie', [['pumpkin', 1], ['flour', 1], ['sugar', 1], ['#milk', 1]], 60);
cook('berry_tart', [['#fruit', 2], ['flour', 1], ['sugar', 1]], 45);
cook('omelet', [['#egg', 2], ['#milk', 1]], 20);
cook('pancakes', [['flour', 2], ['#egg', 1], ['#milk', 1]], 30);
cook('cake', [['flour', 2], ['sugar', 2], ['#egg', 2], ['butter', 1]], 60);
cook('cookies', [['flour', 1], ['sugar', 1], ['#egg', 1]], 30, 3);
cook('pizza', [['flour', 2], ['tomato', 1], ['cheese', 1]], 45);
cook('baked_potato', [['potato', 1]], 20);
cook('corn_chowder', [['corn', 2], ['#milk', 1]], 40);
cook('fried_fish', [['#fish', 1], ['flour', 1], ['oil', 1]], 30);
cook('stuffed_peppers', [['emberpepper', 2], ['cheese', 1]], 40);
cook('honey_bun', [['flour', 1], ['#honey', 1], ['butter', 1]], 40);
cook('fruit_salad', [['#fruit', 3]], 20);
cook('roast_yam', [['yam', 1], ['butter', 1]], 30);
cook('mushroom_risotto', [['#mushroom', 2], ['barley_flour', 1], ['butter', 1]], 60);
cook('miners_pie', [['flour', 2], ['#vegetable', 2], ['butter', 1]], 60);
cook('glow_sorbet', [['glowmelon', 1], ['sugar', 1], ['frost_shard', 1]], 60);
cook('chestnut_soup', [['chestnut', 3], ['#milk', 1]], 40);

// ---------------- Bees (special timing) ----------------
rec('bees', [], [s('honey', 1)], 420, undefined, 'bees:honey');

export const RECIPES: RecipeDef[] = R;
export const RECIPE_BY_ID = new Map(R.map((r) => [r.id, r]));

/** Recipes runnable at a machine station. Assemblers also run hand recipes. */
export function recipesForStation(station: string): RecipeDef[] {
  return R.filter((r) => r.station === station || (station === 'assembler' && r.station === 'hand'));
}

/** Recipes producing a given item (for "how to make" tooltips). */
export function recipesFor(itemId: string): RecipeDef[] {
  return R.filter((r) => r.out.some((o) => o.item === itemId));
}
