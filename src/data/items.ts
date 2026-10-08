// The item registry. Hand-written items plus items generated from crops, trees,
// fish and structures. Runtime code refers to items by numeric index for speed.
import { C } from './palette';
import { CROPS } from './crops';
import { TREES } from './trees';
import { FISH } from './fish';
import { STRUCTURES, STRUCT_PRICE } from './structures';
import type { ItemDef, ItemCategory, IconSpec } from './types';
import { FOOD_BUFFS } from './buffs';
import { FURNITURE } from './furniture';

const list: ItemDef[] = [];
function add(d: ItemDef) {
  list.push(d);
  return d;
}
function it(id: string, name: string, cat: ItemCategory, price: number, icon: IconSpec, desc: string, extra: Partial<ItemDef> = {}) {
  return add({ id, name, cat, price, icon, desc, ...extra });
}

// ---------------- Tools ----------------
export const TIER_NAMES = ['Rusty', 'Copper', 'Iron', 'Gold', 'Starmetal'];
const TIER_COLORS = [C.stone, C.copper, C.pebble, C.brass, C.lavender];
const toolInfo: [string, string, string][] = [
  ['hoe', 'Hoe', 'Tills soil for planting. Upgrades till more tiles at once (hold to charge).'],
  ['can', 'Watering Can', 'Waters crops. Refill at any water. Upgrades hold more and water wider.'],
  ['axe', 'Axe', 'Chops trees, stumps and logs. Upgrades cut faster and split bigger logs.'],
  ['pick', 'Pickaxe', 'Breaks rocks and ore. Upgrades break harder stone faster.'],
  ['scythe', 'Scythe', 'Cuts grass into hay and harvests grain. Upgrades sweep wider.'],
  ['rod', 'Fishing Rod', 'Cast with the use button. Upgrades make the catch zone wider.'],
];
for (const [kind, name, desc] of toolInfo) {
  for (let t = 0; t < 5; t++) {
    it(`${kind}_${t}`, `${TIER_NAMES[t]} ${name}`, 'tool', 0, { t: kind, c: [TIER_COLORS[t]] }, desc, {
      stack: 1, tool: { kind: kind as any, tier: t },
    });
  }
}
const swords: [string, string, number, number, number, number][] = [
  ['sword_0', 'Driftwood Club', 6, 1.0, 1.0, C.oak],
  ['sword_1', 'Copper Blade', 12, 1.1, 1.0, C.copper],
  ['sword_2', 'Iron Sabre', 20, 1.15, 1.2, C.pebble],
  ['sword_3', 'Brass Cutlass', 32, 1.25, 1.3, C.brass],
  ['sword_4', 'Starmetal Edge', 50, 1.4, 1.5, C.lavender],
];
for (const [id, name, dmg, speed, knock, col] of swords)
  it(id, name, 'weapon', 0, { t: 'sword', c: [col] }, `A weapon for the mines. Deals ${dmg} damage.`, { stack: 1, weapon: { dmg, speed, knock } });

// ---------------- Crops: seeds + produce ----------------
for (const cr of CROPS) {
  const cat = cr.cat ?? 'crop';
  it(cr.produce, cr.name, cat, cr.price,
    { t: cr.icon, c: [cr.look.fruit, cr.look.fruit2 ?? -1, -1, cr.look.leaf] },
    cr.desc,
    { quality: true, tags: [...(cr.tags ?? []), cat], edible: cr.edible ? { energy: cr.edible, health: Math.round(cr.edible * 0.4) } : undefined });
  it(cr.seed, cr.seedName ?? `${cr.name} Seeds`, 'seed', Math.max(1, Math.floor(cr.seedPrice / 2)),
    { t: 'seeds', c: [cr.look.fruit, cr.look.leaf] },
    `Plant in tilled soil. ${seasonText(cr.seasons)} Matures in ${cr.stages.reduce((a, b) => a + b, 0)} days.${cr.regrow ? ` Keeps producing every ${cr.regrow} days.` : ''}${cr.trellis ? ' Grows on a trellis (blocks walking).' : ''}`,
    { plant: { crop: cr.id }, tags: ['seed'] });
}

function seasonText(s: number[]) {
  const names = ['Spring', 'Summer', 'Fall', 'Winter'];
  return 'Grows in ' + s.map((x) => names[x]).join(', ') + '.';
}

// ---------------- Trees ----------------
const fruitInfo: Record<string, [string, number, string]> = {
  apple: ['Apple', 95, 'Crunchy and crisp.'],
  pear: ['Pear', 110, 'Buttery and sweet.'],
  cherry: ['Cherry', 80, 'Little red jewels in pairs.'],
  apricot: ['Apricot', 60, 'Velvety and golden.'],
  peach: ['Peach', 140, 'Fuzzy, fragrant, dripping.'],
  plum: ['Plum', 120, 'Dusky purple and tart near the skin.'],
  orange: ['Sunorange', 150, 'Bright as a summer noon.'],
  snowberry: ['Snowberry', 180, 'Pale berries that ripen in the cold.'],
  coconut: ['Coconut', 100, 'A hairy brown treasure from the beach palms.'],
};
for (const t of TREES) {
  if (!t.wild) {
    it(t.sapling, `${t.name.replace(' Tree', '')} Sapling`, 'seed', Math.floor(t.saplingPrice / 2), { t: 'sapling', c: [t.look.leaf, t.look.trunk, -1, t.look.fruit ?? C.rose] },
      `Plant on open ground with space around it. Matures in ${t.grow} days and fruits every ${['spring', 'summer', 'fall', 'winter'][t.season as number]}.`,
      { plant: { tree: t.id }, tags: ['seed', 'sapling'] });
  }
  if (t.fruit && fruitInfo[t.fruit]) {
    const [name, price, desc] = fruitInfo[t.fruit];
    it(t.fruit, name, 'fruit', price, { t: t.fruit === 'cherry' ? 'cherry' : t.fruit === 'pear' ? 'pear' : t.fruit === 'coconut' ? 'coconut' : 'fruit', c: [t.look.fruit ?? C.rose, -1, -1, C.leaf] }, desc,
      { quality: true, tags: ['fruit', 'tree_fruit'], edible: { energy: Math.round(price / 5), health: Math.round(price / 12) } });
  }
}
it('acorn', 'Acorn', 'seed', 5, { t: 'nut', c: [C.oak, C.walnut] }, 'Plant it and an oak will grow.', { plant: { tree: 'oak' }, tags: ['seed'] });
it('maple_seed', 'Maple Seed', 'seed', 5, { t: 'wing', c: [C.terracotta, C.oak] }, 'A spinning seed. Plant it for a maple.', { plant: { tree: 'maple' }, tags: ['seed'] });
it('pine_cone', 'Pine Cone', 'seed', 5, { t: 'cone', c: [C.walnut, C.bark] }, 'Plant it for a pine tree.', { plant: { tree: 'pine' }, tags: ['seed'] });
it('birch_seed', 'Birch Catkin', 'seed', 5, { t: 'wing', c: [C.tan, C.pebble] }, 'Plant it for a silver birch.', { plant: { tree: 'birch' }, tags: ['seed'] });
it('willow_twig', 'Willow Twig', 'seed', 5, { t: 'twig', c: [C.leaf, C.walnut] }, 'Push it into wet ground for a willow.', { plant: { tree: 'willow' }, tags: ['seed'] });

// ---------------- Forage ----------------
const forage: [string, string, string, number, IconSpec, number, string[]][] = [
  ['wild_garlic', 'Wild Garlic', 'Pungent spring greens from the woods.', 40, { t: 'stalk', c: [C.cream, -1, -1, C.leaf] }, 12, ['vegetable', 'spring_forage']],
  ['morel', 'Morel', 'A honeycombed mushroom. Highly prized.', 120, { t: 'mushroom', c: [C.tan, C.walnut] }, 15, ['mushroom', 'spring_forage']],
  ['meadow_daisy', 'Meadow Daisy', 'Simple and lovely.', 30, { t: 'flower', c: [C.cream, C.amber, -1, C.grass] }, 0, ['flower', 'spring_forage']],
  ['raspberry', 'Wild Raspberry', 'Tiny and intensely sweet.', 35, { t: 'berry', c: [C.rose, C.wine] }, 8, ['fruit', 'summer_forage']],
  ['elderflower', 'Elderflower', 'Frothy white blossoms with a summer scent.', 50, { t: 'flower', c: [C.cream, C.butter, -1, C.moss] }, 0, ['flower', 'summer_forage']],
  ['sea_fennel', 'Sea Fennel', 'Salty, crunchy beach herb.', 45, { t: 'leafy', c: [C.lime, -1, -1, C.grass] }, 8, ['herb', 'summer_forage']],
  ['chestnut', 'Chestnut', 'Roast it. Share it.', 60, { t: 'nut', c: [C.walnut, C.bark] }, 10, ['nut', 'fall_forage']],
  ['chanterelle', 'Chanterelle', 'Golden, frilly and smells of apricots.', 140, { t: 'mushroom', c: [C.amber, C.apricot] }, 15, ['mushroom', 'fall_forage']],
  ['rosehip', 'Rosehip', 'Bright red pods left after the roses fade.', 40, { t: 'berry', c: [C.terracotta, C.brick] }, 5, ['fruit', 'fall_forage']],
  ['holly', 'Holly Sprig', 'Glossy leaves and berries. Inedible, but festive.', 60, { t: 'leaf', c: [C.moss, C.rose] }, 0, ['winter_forage']],
  ['snow_lichen', 'Snow Lichen', 'A pale crust that grows on north-facing rocks.', 70, { t: 'leafy', c: [C.frost, -1, -1, C.aqua] }, 5, ['winter_forage']],
  ['ice_crocus', 'Ice Crocus', 'Blooms through the snow.', 90, { t: 'flower', c: [C.lavender, C.frost, -1, C.aqua] }, 0, ['flower', 'winter_forage']],
  ['seashell', 'Seashell', 'Still smells like the sea.', 30, { t: 'shell', c: [C.blush, C.cream] }, 0, ['beach']],
  ['coral', 'Coral', 'A branching pink skeleton.', 80, { t: 'coral', c: [C.rose, C.blush] }, 0, ['beach']],
  ['sea_glass', 'Sea Glass', 'Frosted green glass rounded by the waves.', 60, { t: 'gem', c: [C.aqua, C.leaf] }, 0, ['beach']],
  ['kelp', 'Kelp', 'Slippery ribbons of seaweed.', 20, { t: 'kelp', c: [C.moss, C.pine] }, 4, ['beach']],
  ['field_mushroom', 'Field Mushroom', 'A plain brown mushroom. Tasty fried.', 35, { t: 'mushroom', c: [C.tan, C.cream] }, 10, ['mushroom']],
];
for (const [id, name, desc, price, icon, energy, tags] of forage)
  it(id, name, 'forage', price, icon, desc, { quality: true, tags: ['forage', ...tags], edible: energy ? { energy, health: Math.round(energy / 3) } : undefined });

// ---------------- Raw resources ----------------
it('wood', 'Wood', 'resource', 2, { t: 'log', c: [C.oak, C.walnut] }, 'A sturdy length of timber. Useful for almost everything.', { fuel: 8 });
it('hardwood', 'Hardwood', 'resource', 15, { t: 'log', c: [C.walnut, C.bark] }, 'Dense, dark wood from old stumps.', { fuel: 20 });
it('stone', 'Stone', 'resource', 2, { t: 'stone', c: [C.stone, C.slate] }, 'A good honest rock.');
it('fiber', 'Plant Fiber', 'resource', 1, { t: 'fiber', c: [C.leaf, C.grass] }, 'Tough stringy stems. Cut weeds to collect it.', { fuel: 2 });
it('sap', 'Sap', 'resource', 2, { t: 'drop', c: [C.amber, C.brass] }, 'Sticky tree sap.');
it('clay', 'Clay', 'resource', 10, { t: 'clay', c: [C.terracotta, C.brick] }, 'Damp, workable earth. Fire it into bricks.');
it('sand', 'Sand', 'resource', 3, { t: 'pile', c: [C.butter, C.tan] }, 'Fine golden sand. Melt it into glass.');
it('gravel', 'Gravel', 'resource', 3, { t: 'pile', c: [C.stone, C.slate] }, 'Crushed stone. Makes good paths and concrete.');
it('coal', 'Coal', 'resource', 15, { t: 'coal', c: [C.ink, C.slate] }, 'Burns long and hot.', { fuel: 40 });
it('hay', 'Hay', 'resource', 0, { t: 'hay', c: [C.amber, C.tan] }, 'Dried grass. Animals eat one bundle a day.', { fuel: 3 });
it('sawdust', 'Sawdust', 'resource', 1, { t: 'pile', c: [C.tan, C.oak] }, 'Leftovers from the sawmill. Compost it or burn it.', { fuel: 4 });
const ores: [string, string, number, number, number][] = [
  ['copper', 'Copper', 5, C.copper, C.brick],
  ['tin', 'Tin', 6, C.pebble, C.stone],
  ['iron', 'Iron', 10, C.stone, C.slate],
  ['gold', 'Gold', 25, C.brass, C.amber],
  ['starmetal', 'Starmetal', 60, C.lavender, C.violet],
];
for (const [id, name, price, a, b] of ores) {
  it(`${id}_ore`, `${name} Ore`, 'ore', price, { t: 'ore', c: [a, b, C.stone] }, `Raw ${name.toLowerCase()} in rock. Smelt it into bars.`);
}
const bars: [string, string, number, number, number][] = [
  ['copper_bar', 'Copper Bar', 60, C.copper, C.apricot],
  ['tin_bar', 'Tin Bar', 70, C.pebble, C.cream],
  ['iron_bar', 'Iron Bar', 120, C.stone, C.pebble],
  ['brass_bar', 'Brass Bar', 200, C.brass, C.butter],
  ['gold_bar', 'Gold Bar', 250, C.amber, C.butter],
  ['starmetal_bar', 'Starmetal Bar', 600, C.lavender, C.frost],
];
for (const [id, name, price, a, b] of bars) it(id, name, 'bar', price, { t: 'bar', c: [a, -1, b] }, 'A smelted bar of metal.');

// gems & minerals
const gems: [string, string, number, number, string][] = [
  ['quartz', 'Quartz', 25, C.frost, 'A clear crystal. Common in the upper mines.'],
  ['amethyst', 'Amethyst', 100, C.violet, 'A purple crystal said to calm the mind.'],
  ['topaz', 'Topaz', 80, C.amber, 'A warm golden gem.'],
  ['jade', 'Jade', 200, C.leaf, 'Smooth green stone. Lucky, some say.'],
  ['ruby', 'Ruby', 250, C.rose, 'Glows like an ember.'],
  ['sapphire', 'Sapphire', 300, C.sky, 'Deep blue and very hard.'],
  ['opal', 'Fire Opal', 400, C.blush, 'Every color at once.'],
  ['starstone', 'Starstone', 800, C.lavender, 'A fragment of a fallen star. Warm to the touch.'],
  ['prism_shard', 'Prism Shard', 2000, C.cream, 'Light bends strangely around it.'],
  ['frost_shard', 'Frost Shard', 60, C.aqua, 'Never melts.'],
];
for (const [id, name, price, a, desc] of gems) it(id, name, 'gem', price, { t: 'gem', c: [a] }, desc, { tags: ['gem'] });
const minerals: [string, string, number, number, number, string][] = [
  ['mica', 'Mica', 40, C.pebble, C.butter, 'Flakes in thin glittering sheets.'],
  ['obsidian', 'Obsidian', 120, C.ink, C.violet, 'Volcanic glass, sharp as gossip.'],
  ['jasper', 'Jasper', 90, C.terracotta, C.brick, 'Banded red stone.'],
  ['fluorite', 'Fluorite', 140, C.lavender, C.aqua, 'Glows under moonlight.'],
  ['calcite', 'Calcite', 60, C.cream, C.butter, 'Soft, pale and fizzy in vinegar.'],
  ['geode', 'Geode', 50, C.stone, C.slate, 'Crack it open at the smithy to see what is inside.'],
];
for (const [id, name, price, a, b, desc] of minerals) it(id, name, 'mineral', price, { t: id === 'geode' ? 'geode' : 'mineral', c: [a, b] }, desc, { tags: ['mineral'] });

// relics (collection)
const relics: [string, string, number, string][] = [
  ['old_cog', 'Ancient Cog', 150, 'A gear from some long-forgotten machine. The teeth are still sharp.'],
  ['clay_whistle', 'Clay Whistle', 120, 'Shaped like a bird. It still plays one note.'],
  ['fossil_shell', 'Fossil Shell', 200, 'A sea creature turned to stone, far from any sea.'],
  ['rusted_key', 'Rusted Key', 90, 'What did it open?'],
  ['tin_soldier', 'Tin Soldier', 180, 'A toy with a tiny wind-up key in its back.'],
  ['star_chart', 'Star Chart Scrap', 300, 'A fragment of an old map of the sky.'],
  ['brass_compass', 'Brass Compass', 250, 'Points at the clocktower no matter where you stand.'],
  ['painted_tile', 'Painted Tile', 140, 'Blue and white, from some grand old floor.'],
];
for (const [id, name, price, desc] of relics) it(id, name, 'misc', price, { t: 'relic', c: [C.brass, C.copper] }, desc, { tags: ['relic'] });

// monster drops
it('slime_gel', 'Dew Gel', 'monster', 8, { t: 'gel', c: [C.leaf, C.lime] }, 'Wobbly and cool. Makes excellent fertilizer.');
it('moth_dust', 'Moth Dust', 'monster', 15, { t: 'dust', c: [C.tan, C.cream] }, 'Shimmering wing scales.');
it('crab_shell', 'Crab Shell', 'monster', 25, { t: 'shell', c: [C.stone, C.pebble] }, 'Hard as a rock, because it was pretending to be one.');
it('wisp_essence', 'Wisp Essence', 'monster', 45, { t: 'essence', c: [C.amber, C.butter] }, 'A warm flicker in a bottle.', { fuel: 90 });

// ---------------- Components ----------------
const comp = (id: string, name: string, price: number, icon: IconSpec, desc: string, extra: Partial<ItemDef> = {}) =>
  it(id, name, 'component', price, icon, desc, extra);
comp('plank', 'Plank', 6, { t: 'plank', c: [C.tan, C.oak] }, 'A planed board. The sawmill makes them fast.', { fuel: 6 });
comp('beam', 'Hardwood Beam', 40, { t: 'plank', c: [C.walnut, C.bark] }, 'A strong beam for big builds.', { fuel: 25 });
comp('copper_gear', 'Copper Gear', 30, { t: 'gear', c: [C.copper, C.brick] }, 'The humble heart of every machine.');
comp('brass_gear', 'Brass Gear', 70, { t: 'gear', c: [C.brass, C.copper] }, 'A precise, shining gear.');
comp('iron_plate', 'Iron Plate', 50, { t: 'plate', c: [C.stone, C.slate] }, 'Hammered flat and riveted.');
comp('copper_coil', 'Copper Coil', 40, { t: 'coil', c: [C.copper, C.apricot] }, 'Wound wire that hums when power runs through.');
comp('spring', 'Mainspring', 60, { t: 'spring', c: [C.pebble, C.stone] }, 'A wound steel spring. Stores motion.');
comp('spark_coil', 'Spark Coil', 160, { t: 'sparkcoil', c: [C.aqua, C.brass] }, 'Coils and glass that make a tiny captured spark.');
comp('clockwork_core', 'Clockwork Core', 600, { t: 'core', c: [C.brass, C.aqua] }, 'Hundreds of tiny parts ticking in harmony.');
comp('lens', 'Brass Lens', 150, { t: 'lens', c: [C.frost, C.brass] }, 'A ground glass lens in a brass ring.');
comp('glass', 'Glass', 20, { t: 'glass', c: [C.frost, C.aqua] }, 'Clear, a little bubbly.');
comp('brick', 'Brick', 12, { t: 'brick', c: [C.brick, C.terracotta] }, 'Fired clay. Good for ovens and kilns.');
comp('rope', 'Rope', 12, { t: 'rope', c: [C.tan, C.oak] }, 'Twisted fiber.');
comp('cloth', 'Cloth', 180, { t: 'cloth', c: [C.cream, C.pebble] }, 'Soft woven fabric.');
comp('linen', 'Linen', 160, { t: 'cloth', c: [C.butter, C.tan] }, 'Cool, crisp cloth from flax.');
comp('fine_cloth', 'Fleece Weave', 600, { t: 'cloth', c: [C.tan, C.oak] }, 'Luxurious woven alpaca fleece.');
comp('quilt', 'Patchwork Quilt', 900, { t: 'quilt', c: [C.rose, C.sky] }, 'Cloth, linen and love. Fetches a fine price.');
comp('trellis', 'Trellis Stakes', 4, { t: 'twig', c: [C.oak, C.walnut] }, 'Used when crafting supports for climbing crops.');
comp('bumblebot', 'Bumblebot', 400, { t: 'bot', c: [C.brass, C.amber] }, 'A clockwork bee. Put it in a hive and it will carry and build for you.');
comp('concrete', 'Cobblecrete', 20, { t: 'brick', c: [C.stone, C.pebble] }, 'Gravel, sand and clay packed into blocks.');

// research bundles
const bundles: [string, string, number, string][] = [
  ['bundle_green', 'Sprout Bundle', C.leaf, 'Fiber and fresh crops tied up with notes. Study it at a desk.'],
  ['bundle_copper', 'Tinker Bundle', C.copper, 'Gears and planks wrapped in sketches.'],
  ['bundle_rose', 'Harvest Bundle', C.rose, 'Preserves, cloth and eggs: the pantry, studied.'],
  ['bundle_brass', 'Brass Bundle', C.brass, 'Belts, arms and glass in a tidy crate.'],
  ['bundle_star', 'Starlight Bundle', C.lavender, 'Gems, gold and wine under a starry cloth.'],
];
for (const [id, name, col, desc] of bundles) it(id, name, 'research', 0, { t: 'bundle', c: [col] }, desc, { tags: ['bundle'] });

// fertilizer & bait
it('compost', 'Compost', 'fertilizer', 4, { t: 'pouch', c: [C.walnut, C.bark] }, 'Improves the chance of better-quality crops. Use on tilled soil.', { fertilizer: { quality: 1 } });
it('rich_compost', 'Rich Compost', 'fertilizer', 10, { t: 'pouch', c: [C.bark, C.amber] }, 'Greatly improves crop quality.', { fertilizer: { quality: 2 } });
it('grow_tonic', 'Grow Tonic', 'fertilizer', 6, { t: 'flask', c: [C.leaf, C.lime] }, 'Crops grow 10% faster.', { fertilizer: { speed: 0.1 } });
it('super_tonic', 'Super Tonic', 'fertilizer', 15, { t: 'flask', c: [C.aqua, C.sky] }, 'Crops grow 25% faster.', { fertilizer: { speed: 0.25 } });
it('damp_mulch', 'Damp Mulch', 'fertilizer', 4, { t: 'pouch', c: [C.moss, C.river] }, 'Soil has a 50% chance to stay watered overnight.', { fertilizer: { retain: 0.5 } });
it('deep_mulch', 'Deep Mulch', 'fertilizer', 8, { t: 'pouch', c: [C.river, C.deepsea] }, 'Soil stays watered overnight.', { fertilizer: { retain: 1 } });
it('bait', 'Bait', 'bait', 1, { t: 'bait', c: [C.blush, C.walnut] }, 'Fish bite sooner. Fish traps need it.');
it('deluxe_bait', 'Glow Bait', 'bait', 3, { t: 'bait', c: [C.aqua, C.walnut] }, 'Fish bite much sooner. Traps catch twice as much.');

// trash
it('old_boot', 'Waterlogged Boot', 'trash', 0, { t: 'boot', c: [C.walnut, C.bark] }, 'Someone lost it. Nobody wants it back.');
it('tin_can', 'Rusty Tin Can', 'trash', 0, { t: 'tincan', c: [C.stone, C.copper] }, 'Smelts down into a little tin.');
it('driftwood', 'Driftwood', 'trash', 0, { t: 'log', c: [C.pebble, C.stone] }, 'Bleached by the sea. Burns well enough.', { fuel: 6 });
it('tangled_line', 'Tangled Line', 'trash', 0, { t: 'fiber', c: [C.pebble, C.stone] }, 'A bird\'s nest of old fishing line.');

// ---------------- Animal products ----------------
const animal: [string, string, number, IconSpec, string, number][] = [
  ['egg', 'Egg', 50, { t: 'egg', c: [C.cream, C.pebble] }, 'Still warm.', 20],
  ['large_egg', 'Large Egg', 95, { t: 'egg', c: [C.butter, C.tan] }, 'A hefty golden-brown egg from a very happy hen.', 30],
  ['duck_egg', 'Duck Egg', 95, { t: 'egg', c: [C.aqua, C.sky] }, 'A pale blue-green egg.', 25],
  ['duck_feather', 'Duck Feather', 250, { t: 'feather', c: [C.cream, C.sky] }, 'Glossy and soft.', 0],
  ['rabbit_fluff', 'Rabbit Fluff', 340, { t: 'wool', c: [C.cream, C.tan] }, 'A soft cloud from a happy rabbit.', 0],
  ['lucky_foot', 'Lucky Clover', 560, { t: 'leaf', c: [C.leaf, C.lime] }, 'The rabbits keep finding these. Supposedly brings luck.', 0],
  ['milk', 'Milk', 125, { t: 'milk', c: [C.cream, C.pebble] }, 'Fresh and creamy.', 25],
  ['large_milk', 'Large Milk', 190, { t: 'milk', c: [C.butter, C.tan] }, 'Extra creamy, from an extra happy cow.', 40],
  ['goat_milk', 'Goat Milk', 225, { t: 'milk', c: [C.frost, C.pebble] }, 'Rich and tangy.', 30],
  ['large_goat_milk', 'Large Goat Milk', 345, { t: 'milk', c: [C.butter, C.pebble] }, 'A big pail of goat milk.', 45],
  ['wool', 'Wool', 340, { t: 'wool', c: [C.cream, C.pebble] }, 'Soft and warm. A loom turns it into cloth.', 0],
  ['truffle', 'Truffle', 625, { t: 'truffle', c: [C.walnut, C.bark] }, 'An earthy prize sniffed out by pigs.', 10],
  ['alpaca_fleece', 'Alpaca Fleece', 420, { t: 'wool', c: [C.tan, C.oak] }, 'Silky and warm.', 0],
];
for (const [id, name, price, icon, desc, energy] of animal)
  it(id, name, 'animal', price, icon, desc, { quality: true, tags: ['animal', ...(id.includes('egg') ? ['egg'] : []), ...(id.includes('milk') ? ['milk'] : [])], edible: energy ? { energy, health: energy / 2 } : undefined });

// ---------------- Artisan goods ----------------
const art = (id: string, name: string, price: number, icon: IconSpec, desc: string, tags: string[] = [], energy = 0) =>
  it(id, name, 'artisan', price, icon, desc, { tags: ['artisan', ...tags], quality: false, edible: energy ? { energy, health: Math.round(energy / 2) } : undefined });

art('cheese', 'Cheese', 230, { t: 'cheese', c: [C.butter, C.amber] }, 'A golden wheel of cheese.', ['dairy'], 50);
art('goat_cheese', 'Goat Cheese', 400, { t: 'cheese', c: [C.cream, C.pebble] }, 'Soft and tangy.', ['dairy'], 50);
art('butter', 'Butter', 160, { t: 'butter', c: [C.butter, C.amber] }, 'Churned smooth.', ['dairy'], 20);
art('mayo', 'Egg Custard', 190, { t: 'jar', c: [C.butter, C.cream] }, 'Silky and sweet.', ['dairy'], 30);
art('honey', 'Wildflower Honey', 100, { t: 'jar', c: [C.amber, C.brass] }, 'Gold in a jar.', ['honey'], 20);
for (const [fl, nm, mult] of [['tulip', 'Tulip', 1.4], ['sunflower', 'Sunflower', 1.6], ['sunbell', 'Sunbell', 2.2], ['starpetal', 'Starpetal', 4], ['meadow_daisy', 'Daisy', 1.2], ['elderflower', 'Elderflower', 1.5], ['ice_crocus', 'Crocus', 2]] as const)
  art(`honey_${fl}`, `${nm} Honey`, Math.round(100 * mult), { t: 'jar', c: [C.amber, C.brass, -1, C.rose] }, `Honey flavored by ${nm.toLowerCase()} blossoms.`, ['honey'], 25);
art('mead', 'Mead', 300, { t: 'bottle', c: [C.amber, C.brass] }, 'Honey wine. Sweet and strong.', ['drink'], 25);
art('ale', 'Wheat Ale', 200, { t: 'mug', c: [C.amber, C.cream] }, 'Golden and foamy.', ['drink'], 25);
art('stout', 'Barley Stout', 240, { t: 'mug', c: [C.bark, C.tan] }, 'Dark, roasty and rich.', ['drink'], 30);
art('pale_ale', 'Hop Ale', 300, { t: 'mug', c: [C.butter, C.cream] }, 'Bright and bitter.', ['drink'], 25);
art('roasted_beans', 'Roasted Beans', 75, { t: 'beans', c: [C.bark, C.walnut] }, 'Ready for brewing.');
art('dried_tea', 'Dried Tea', 60, { t: 'leaf', c: [C.moss, C.pine] }, 'Curled, dried leaves.');
art('coffee_drink', 'Coffee', 150, { t: 'cup', c: [C.bark, C.cream] }, 'Puts a skip in your step.', ['drink'], 5);
art('tea', 'Green Tea', 120, { t: 'cup', c: [C.leaf, C.cream] }, 'Calm in a cup.', ['drink'], 10);
art('flour', 'Flour', 50, { t: 'sack', c: [C.cream, C.tan] }, 'Finely milled wheat.');
art('barley_flour', 'Barley Meal', 55, { t: 'sack', c: [C.tan, C.oak] }, 'Nutty, coarse meal.');
art('cornmeal', 'Cornmeal', 80, { t: 'sack', c: [C.amber, C.tan] }, 'Golden and gritty.');
art('sugar', 'Sugar', 60, { t: 'sack', c: [C.cream, C.pebble] }, 'Sweet crystals from cane or beets.');
art('oil', 'Sunflower Oil', 120, { t: 'bottle', c: [C.butter, C.amber] }, 'Pressed from sunflower seeds.');
art('truffle_oil', 'Truffle Oil', 1100, { t: 'bottle', c: [C.tan, C.walnut] }, 'A few drops transform a dish.');
art('maple_syrup', 'Maple Syrup', 200, { t: 'jar', c: [C.terracotta, C.brick] }, 'Liquid sunshine from a maple.', ['syrup'], 20);
art('oak_resin', 'Oak Resin', 150, { t: 'jar', c: [C.amber, C.walnut] }, 'Sticky, aromatic resin.');
art('pine_tar', 'Pine Tar', 100, { t: 'jar', c: [C.bark, C.ink] }, 'Thick black tar. Waterproofs anything.');
art('birch_sap', 'Birch Water', 120, { t: 'bottle', c: [C.frost, C.pebble] }, 'Faintly sweet tree water.', ['drink'], 10);
art('caviar', 'Roe Jar', 500, { t: 'jar', c: [C.apricot, C.terracotta] }, 'Preserved fish roe.', [], 10);
art('smoked_fish', 'Smoked Fish', 200, { t: 'fish_slim', c: [C.walnut, C.tan, C.bark] }, 'Smoky and long-keeping.', [], 30);

// fruit and veg artisan items, generated
const FRUITS: [string, string, number][] = [];
const VEG: [string, string, number][] = [];
for (const cr of CROPS) {
  if ((cr.cat ?? 'crop') === 'fruit') FRUITS.push([cr.produce, cr.name, cr.price]);
  else if ((cr.cat ?? 'crop') === 'crop' && cr.tags?.includes('vegetable')) VEG.push([cr.produce, cr.name, cr.price]);
}
for (const t of TREES) if (t.fruit && fruitInfo[t.fruit]) FRUITS.push([t.fruit, fruitInfo[t.fruit][0], fruitInfo[t.fruit][1]]);
FRUITS.push(['raspberry', 'Raspberry', 35], ['rosehip', 'Rosehip', 40]);
export const FRUIT_LIST = FRUITS;
export const VEG_LIST = VEG;

const colorOf = (id: string): number => {
  const cr = CROPS.find((c) => c.produce === id);
  if (cr) return cr.look.fruit;
  const tr = TREES.find((t) => t.fruit === id);
  if (tr) return tr.look.fruit ?? C.rose;
  return id === 'raspberry' ? C.rose : C.terracotta;
};
for (const [id, name, price] of FRUITS) {
  art(`wine_${id}`, `${name} Wine`, Math.round(price * 3), { t: 'bottle', c: [colorOf(id), -1, -1, C.wine] }, `Wine made from ${name.toLowerCase()}. Better with age.`, ['drink', 'wine'], 20);
  art(`jam_${id}`, `${name} Jam`, Math.round(price * 2 + 50), { t: 'jar', c: [colorOf(id), -1, -1, C.cream] }, `Sweet ${name.toLowerCase()} preserves.`, ['preserve'], 25);
}
for (const [id, name, price] of VEG) {
  art(`pickles_${id}`, `Pickled ${name}`, Math.round(price * 2 + 50), { t: 'jar', c: [colorOf(id), -1, -1, C.lime] }, `Crunchy, briny ${name.toLowerCase()}.`, ['preserve'], 20);
  art(`juice_${id}`, `${name} Juice`, Math.round(price * 2.25), { t: 'bottle', c: [colorOf(id), -1, -1, C.lime] }, `Fresh-pressed ${name.toLowerCase()} juice.`, ['drink', 'juice'], 25);
}

// ---------------- Fish ----------------
for (const f of FISH) {
  it(f.id, f.name, 'fish', f.price, { t: 'fish_' + f.look.shape, c: [f.look.body, f.look.belly, f.look.fin] }, f.desc,
    { quality: !f.trap, tags: ['fish', ...(f.trap ? ['shellfish'] : []), ...(f.legendary ? ['legendary'] : [])], edible: { energy: Math.round(f.price / 6) + 5, health: Math.round(f.price / 15) } });
}

// ---------------- Cooked food ----------------
const food: [string, string, number, string, IconSpec, number][] = [
  ['bread', 'Country Loaf', 120, 'A crusty, golden loaf.', { t: 'bread', c: [C.tan, C.oak] }, 50],
  ['salad', 'Garden Salad', 160, 'Crisp leaves and radish coins.', { t: 'bowl', c: [C.leaf, C.rose] }, 60],
  ['veggie_soup', 'Hearty Soup', 220, 'Warms you right down to your boots.', { t: 'bowl', c: [C.terracotta, C.apricot] }, 90],
  ['fish_stew', 'Fisher\'s Stew', 260, 'Whatever came up in the net, simmered with love.', { t: 'bowl', c: [C.apricot, C.cream] }, 100],
  ['pumpkin_pie', 'Pumpkin Pie', 380, 'Spiced and perfect.', { t: 'pie', c: [C.apricot, C.tan] }, 110],
  ['berry_tart', 'Berry Tart', 300, 'Jammy and buttery.', { t: 'pie', c: [C.rose, C.tan] }, 80],
  ['omelet', 'Omelet', 180, 'Fluffy and quick.', { t: 'dish', c: [C.butter, C.amber] }, 70],
  ['pancakes', 'Pancake Stack', 260, 'With syrup, naturally.', { t: 'dish', c: [C.tan, C.terracotta] }, 90],
  ['cake', 'Celebration Cake', 450, 'For birthdays and harvests.', { t: 'cake', c: [C.blush, C.cream] }, 120],
  ['cookies', 'Oat Cookies', 140, 'A little jar of happiness.', { t: 'cookie', c: [C.tan, C.walnut] }, 40],
  ['pizza', 'Hearth Pizza', 400, 'Cheese, tomato and a smoky crust.', { t: 'pie', c: [C.terracotta, C.butter] }, 130],
  ['baked_potato', 'Baked Potato', 150, 'Fluffy inside, crackly outside.', { t: 'tuber', c: [C.tan, C.oak] }, 70],
  ['corn_chowder', 'Corn Chowder', 280, 'Thick, creamy, sweet with corn.', { t: 'bowl', c: [C.butter, C.amber] }, 100],
  ['fried_fish', 'Crispy Fish', 220, 'Golden batter, flaky inside.', { t: 'fish_slim', c: [C.amber, C.butter, C.tan] }, 80],
  ['stuffed_peppers', 'Ember Peppers', 300, 'Stuffed and roasted. Spicy!', { t: 'pepper', c: [C.terracotta, C.amber, -1, C.grass] }, 90],
  ['honey_bun', 'Honey Bun', 240, 'Sticky and sweet.', { t: 'bread', c: [C.amber, C.brass] }, 70],
  ['fruit_salad', 'Fruit Salad', 300, 'All the colors of summer.', { t: 'bowl', c: [C.rose, C.amber] }, 90],
  ['roast_yam', 'Roast Yam', 260, 'Caramelized edges.', { t: 'tuber', c: [C.brick, C.terracotta] }, 85],
  ['mushroom_risotto', 'Mushroom Risotto', 420, 'Creamy, earthy and slow-cooked.', { t: 'bowl', c: [C.cream, C.tan] }, 130],
  ['miners_pie', 'Miner\'s Pie', 350, 'A sturdy pie that keeps you going underground.', { t: 'pie', c: [C.walnut, C.tan] }, 150],
  ['glow_sorbet', 'Glowmelon Sorbet', 1200, 'Faintly luminous and very refreshing.', { t: 'bowl', c: [C.aqua, C.frost] }, 200],
  ['chestnut_soup', 'Chestnut Soup', 260, 'Velvety and warming.', { t: 'bowl', c: [C.walnut, C.tan] }, 100],
];
for (const [id, name, price, desc, icon, energy] of food)
  it(id, name, 'food', price, icon, desc, { tags: ['cooking'], edible: { energy, health: Math.round(energy / 2) } });

// ---------------- Misc ----------------
it('ticket', 'Festival Token', 'misc', 0, { t: 'ticket', c: [C.rose, C.butter] }, 'Spend at festival stalls.');
it('heart_charm', 'Brass Locket', 'misc', 0, { t: 'locket', c: [C.brass, C.rose] }, 'Give it to someone you love very much (needs 8 hearts).');
it('elevator_key', 'Lift Token', 'misc', 0, { t: 'ticket', c: [C.slate, C.brass] }, 'Unused.');

// ---------------- Structures ----------------
for (const s of STRUCTURES) {
  if (list.some((d) => d.id === s.item)) continue;
  it(s.item, s.name, 'placeable', Math.round((STRUCT_PRICE.get(s.id) ?? 0) / 2), { t: 'struct', c: [] }, s.desc, { places: s.id, tags: ['placeable'], stack: s.kind === 'building' ? 1 : 999 });
}

// ---------------- Furniture ----------------
for (const f of FURNITURE)
  it(f.id, f.name, 'furniture', Math.round(f.price * 0.25), { t: 'furn', s: f.sprite }, f.desc + (f.wall ? ' Hangs on a wall.' : ' Place it inside your farmhouse.'), { furniture: f.id, tags: ['furniture'], stack: 99 });

// ---------------- Index ----------------
export const ITEMS: ItemDef[] = list;
export const ITEM_BY_ID = new Map<string, ItemDef>();
export const ITEM_INDEX = new Map<string, number>();
list.forEach((d, i) => {
  if (ITEM_BY_ID.has(d.id)) throw new Error('duplicate item id ' + d.id);
  ITEM_BY_ID.set(d.id, d);
  ITEM_INDEX.set(d.id, i);
  if (d.edible && FOOD_BUFFS[d.id]) d.edible.buff = FOOD_BUFFS[d.id];
});

export function item(id: string): ItemDef {
  const d = ITEM_BY_ID.get(id);
  if (!d) throw new Error('unknown item ' + id);
  return d;
}

export function itemIdx(id: string): number {
  const i = ITEM_INDEX.get(id);
  if (i === undefined) throw new Error('unknown item ' + id);
  return i;
}

export function maxStack(d: ItemDef): number {
  if (d.stack) return d.stack;
  return 999;
}

/** Does item match a recipe ingredient spec ("id" or "#tag" / "#cat:fish")? */
export function matchesSpec(d: ItemDef, spec: string): boolean {
  if (spec[0] !== '#') return d.id === spec;
  const tag = spec.slice(1);
  if (tag.startsWith('cat:')) return d.cat === tag.slice(4);
  return d.cat === tag || (d.tags?.includes(tag) ?? false);
}
