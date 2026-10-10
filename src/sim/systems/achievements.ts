// Achievements: long-term goals across every system, plus secret easter eggs.
// Most are polled from game state every couple of seconds; a few are unlocked by
// events (`unlockAch(g, id)`), including presentation-side ones like the Konami code.
// Old saves stored these as "feats": the ids of the original 37 are kept unchanged.
import { ITEMS, ITEM_INDEX } from '../../data/items';
import { FISH } from '../../data/fish';
import { RESEARCH } from '../../data/research';
import { CROPS } from '../../data/crops';
import { OBSERVATIONS } from '../../data/deepworks';
import { Game, registerSystem, SKILLS } from '../Game';
import { hearts } from './npcs';

export type AchCat = 'farm' | 'factory' | 'explore' | 'village' | 'home' | 'fortune' | 'challenge' | 'secret';
export const ACH_CATS: { id: AchCat; name: string }[] = [
  { id: 'farm', name: 'Farming' }, { id: 'factory', name: 'Factory' }, { id: 'explore', name: 'Explorer' },
  { id: 'village', name: 'Village' }, { id: 'home', name: 'Home & Life' }, { id: 'fortune', name: 'Fortune' },
  { id: 'challenge', name: 'Challenges' }, { id: 'secret', name: 'Secrets' },
];
/** 1 bronze, 2 silver, 3 gold */
export type AchTier = 1 | 2 | 3;
export const TIER_POINTS = [0, 10, 25, 50];
export const SECRET_POINTS = 30;
/** coins found with every secret achievement */
export const SECRET_REWARD = 250;

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  cat: AchCat;
  tier: AchTier;
  /** item id drawn on the medal */
  icon: string;
  /** hidden until unlocked; the hint is all the player sees */
  secret?: boolean;
  hint?: string;
  test?: (g: Game) => boolean;
  /** [current, goal] for a progress bar */
  prog?: (g: Game) => [number, number];
}
/** @deprecated old name, kept for older imports */
export type Feat = Achievement;

const c = (g: Game, k: string) => g.counters[k] ?? 0;
const madeCat = (g: Game, cat: string) => {
  let n = 0;
  for (const [idx, s] of g.stats.series) if (ITEMS[idx]?.cat === cat) n += s.totalProd;
  return n;
};
const npcs = (g: Game) => (g.sys.npcs?.list ?? []) as any[];
const keysWith = (g: Game, pre: string) => Object.keys(g.counters).filter((k) => k.startsWith(pre) && g.counters[k] > 0).length;
const made = (g: Game, id: string) => g.stats.series.get(ITEM_INDEX.get(id) ?? -1)?.totalProd ?? 0;
const kinds2 = (g: Game, id: string) => g.ents.all().filter((e) => !e.ghost && e.def.id === id).length;
const kinds = (g: Game, kind: string) => g.ents.all().filter((e) => !e.ghost && e.def.kind === kind).length;
/** restoration projects finished (the Orders board's Works) */
const projectsDone = (g: Game) => ((g.sys.orders?.worksDone ?? []) as string[]).filter((id) => id.startsWith('p_')).length;
const num = (k: string, goal: number) => ({ test: (gg: Game) => c(gg, k) >= goal, prog: (gg: Game): [number, number] => [c(gg, k), goal] });
const NON_LEGEND_FISH = FISH.filter((f: any) => !f.legendary).map((f: any) => f.id as string);

export const ACHIEVEMENTS: Achievement[] = [
  // ---------------- Farming ----------------
  { id: 'harvest1', name: 'First Fruits', desc: 'Harvest your very first crop.', cat: 'farm', tier: 1, icon: 'radish', ...num('harvested', 1) },
  { id: 'harvest100', name: 'Green Thumb', desc: 'Harvest 100 crops.', cat: 'farm', tier: 1, icon: 'pea', ...num('harvested', 100) },
  { id: 'harvest1000', name: 'Bountiful', desc: 'Harvest 1,000 crops.', cat: 'farm', tier: 2, icon: 'pumpkin', ...num('harvested', 1000) },
  { id: 'harvest10k', name: 'Breadbasket of the Valley', desc: 'Harvest 10,000 crops.', cat: 'farm', tier: 3, icon: 'wheat', ...num('harvested', 10000) },
  { id: 'tilled500', name: 'Tiller of the Soil', desc: 'Till 500 tiles of soil.', cat: 'farm', tier: 1, icon: 'hoe_1', ...num('tilled', 500) },
  { id: 'seasons4', name: 'Four Seasons', desc: 'Harvest a crop in every season.', cat: 'farm', tier: 2, icon: 'sunflower', test: (g) => [0, 1, 2, 3].every((s) => c(g, 'harvest_s' + s) > 0), prog: (g) => [[0, 1, 2, 3].filter((s) => c(g, 'harvest_s' + s) > 0).length, 4] },
  { id: 'crops10', name: 'Seed Collector', desc: 'Harvest 10 different kinds of crop.', cat: 'farm', tier: 1, icon: 'tulip_seed', test: (g) => keysWith(g, 'h_') >= 10, prog: (g) => [keysWith(g, 'h_'), 10] },
  { id: 'crops_all', name: 'Master Botanist', desc: 'Harvest every kind of crop in the valley.', cat: 'farm', tier: 3, icon: 'starpetal', test: (g) => keysWith(g, 'h_') >= CROPS.length, prog: (g) => [keysWith(g, 'h_'), CROPS.length] },
  { id: 'giant', name: 'Gargantuan', desc: 'Grow a giant crop.', cat: 'farm', tier: 2, icon: 'melon', ...num('giant', 1) },
  { id: 'starq', name: 'Star Quality', desc: 'Harvest a star-quality crop.', cat: 'farm', tier: 2, icon: 'strawberry', ...num('harvest_star', 1) },
  { id: 'trees100', name: 'Timber!', desc: 'Chop down 100 trees.', cat: 'farm', tier: 2, icon: 'axe_2', ...num('trees_chopped', 100) },
  { id: 'greenhouse', name: 'Glass Half Full', desc: 'Restore the old greenhouse.', cat: 'farm', tier: 2, icon: 'glass', test: (g) => (g.sys.orders?.worksDone ?? []).includes('p_greenhouse') },
  { id: 'rancher', name: 'Rancher', desc: 'Raise 10 animals.', cat: 'farm', tier: 2, icon: 'egg', test: (g) => (g.sys.animals?.list?.length ?? 0) >= 10, prog: (g) => [g.sys.animals?.list?.length ?? 0, 10] },
  { id: 'animalpets', name: 'Petting Zoo', desc: 'Pet your animals 100 times.', cat: 'farm', tier: 1, icon: 'wool', ...num('animal_pets', 100) },

  // ---------------- Factory ----------------
  { id: 'belt1', name: 'Conveyance', desc: 'Place your first conveyor belt.', cat: 'factory', tier: 1, icon: 'belt_1', test: (g) => g.ents.belts.some((e) => !e.st.rust) },
  { id: 'arm1', name: 'A Helping Hand', desc: 'Place your first clockwork arm.', cat: 'factory', tier: 1, icon: 'arm_basic', test: (g) => g.ents.arms.some((e) => !e.st.rust) },
  { id: 'belts100', name: 'Conveyor Fan', desc: 'Have 100 belts placed.', cat: 'factory', tier: 1, icon: 'belt_2', test: (g) => g.ents.belts.length >= 100, prog: (g) => [g.ents.belts.length, 100] },
  { id: 'belts1000', name: 'Belt Baron', desc: 'Have 1,000 belts placed.', cat: 'factory', tier: 3, icon: 'belt_3', test: (g) => g.ents.belts.length >= 1000, prog: (g) => [g.ents.belts.length, 1000] },
  { id: 'arms50', name: 'Many Hands', desc: 'Have 50 arms placed.', cat: 'factory', tier: 2, icon: 'arm_fast', test: (g) => g.ents.arms.length >= 50, prog: (g) => [g.ents.arms.length, 50] },
  { id: 'machines100', name: 'Workshop of Wonders', desc: 'Have 100 machines placed.', cat: 'factory', tier: 3, icon: 'assembler', test: (g) => g.ents.machines.length + g.houseEnts.machines.length >= 100, prog: (g) => [g.ents.machines.length + g.houseEnts.machines.length, 100] },
  { id: 'power', name: 'It Hums!', desc: 'Power a machine with a generator.', cat: 'factory', tier: 1, icon: 'waterwheel', test: (g) => g.ents.consumers.some((e) => e.net && e.sat > 0.5 && e.working) },
  { id: 'grid1000', name: 'Grid Master', desc: 'Have 1,000 sparks of generation on one grid.', cat: 'factory', tier: 3, icon: 'steam_engine', test: (g) => [...(g.sys.power?.nets?.values?.() ?? [])].some((n: any) => n.cap >= 1000) },
  { id: 'research10', name: 'Curious Mind', desc: 'Complete 10 research topics.', cat: 'factory', tier: 1, icon: 'lab', test: (g) => g.research.done.size >= 10, prog: (g) => [g.research.done.size, 10] },
  { id: 'research40', name: 'Scholar', desc: 'Complete 40 research topics.', cat: 'factory', tier: 2, icon: 'bundle_brass', test: (g) => g.research.done.size >= 40, prog: (g) => [g.research.done.size, 40] },
  { id: 'research_all', name: 'Omniscient', desc: 'Complete the entire research tree.', cat: 'factory', tier: 3, icon: 'bundle_star', test: (g) => g.research.done.size >= RESEARCH.length, prog: (g) => [g.research.done.size, RESEARCH.length] },
  { id: 'throughput', name: 'Throughput!', desc: 'Produce 120 of one item per minute.', cat: 'factory', tier: 3, icon: 'splitter_3', test: (g) => [...g.stats.series.keys()].some((i) => g.stats.rate(i, 1, 'prod') >= 120) },
  { id: 'blueprint', name: 'Copycat', desc: 'Paste a blueprint.', cat: 'factory', tier: 1, icon: 'sign', ...num('pastes', 1) },
  { id: 'handsfree', name: 'Hands-Free Farming', desc: 'Build a harvest crane and a seed sower.', cat: 'factory', tier: 2, icon: 'harvester', test: (g) => kinds(g, 'harvester') > 0 && kinds(g, 'planter') > 0 },
  { id: 'drills5', name: 'Drill Sergeant', desc: 'Have 5 ore drills running.', cat: 'factory', tier: 2, icon: 'drill_steam', test: (g) => kinds(g, 'drill') >= 5, prog: (g) => [kinds(g, 'drill'), 5] },
  { id: 'bots', name: 'Hive Mind', desc: 'Have 20 bumblebots buzzing.', cat: 'factory', tier: 3, icon: 'bumblebot', test: (g) => g.ents.consumers.filter((e) => e.def.kind === 'hive').reduce((a, e) => a + (e.st.bots ?? 0), 0) + (g.sys.bots?.list?.length ?? 0) >= 20 },
  { id: 'artisan100', name: 'Artisan', desc: 'Make 100 artisan goods.', cat: 'factory', tier: 2, icon: 'keg', test: (g) => madeCat(g, 'artisan') >= 100, prog: (g) => [Math.floor(madeCat(g, 'artisan')), 100] },
  { id: 'decon100', name: 'Change of Plans', desc: 'Pick up 100 placed structures.', cat: 'factory', tier: 1, icon: 'chest_wood', ...num('decon', 100) },
  { id: 'mega', name: 'Grand Works', desc: 'Complete a megaproject.', cat: 'factory', tier: 3, icon: 'construction_site', test: (g) => (g.sys.goals?.mega?.length ?? 0) >= 1 },

  // ---------------- Explorer ----------------
  // (the ids keep the Old Mine's floors 20/40/60: the Deepworks has 30 levels, and old saves' depth halved)
  { id: 'floor20', name: 'Spelunker', desc: 'Reach level 10 of the Deepworks.', cat: 'explore', tier: 1, icon: 'pick_1', test: (g) => (g.sys.mine?.deepest ?? 0) >= 10, prog: (g) => [g.sys.mine?.deepest ?? 0, 10] },
  { id: 'floor40', name: 'Deep Diver', desc: 'Reach level 20 of the Deepworks.', cat: 'explore', tier: 2, icon: 'pick_2', test: (g) => (g.sys.mine?.deepest ?? 0) >= 20, prog: (g) => [g.sys.mine?.deepest ?? 0, 20] },
  { id: 'floor60', name: 'Rock Bottom', desc: 'Reach the bottom of the Deepworks, level 30.', cat: 'explore', tier: 3, icon: 'pick_3', test: (g) => (g.sys.mine?.deepest ?? 0) >= 30, prog: (g) => [g.sys.mine?.deepest ?? 0, 30] },
  { id: 'deep_lift', name: 'Going Up', desc: 'Restore the old lift on level 5 of the Deepworks.', cat: 'explore', tier: 1, icon: 'rope', test: (g) => g.flags.has('chamber:lift') },
  { id: 'deep_shored', name: 'Shored Up', desc: 'Shore up the collapsed gallery on level 6 with hardwood beams.', cat: 'explore', tier: 2, icon: 'beam', test: (g) => g.flags.has('gallery_shored') },
  { id: 'deep_pump', name: 'Pumped Dry', desc: 'Restore the old pump on level 15 of the Deepworks.', cat: 'explore', tier: 2, icon: 'iron_plate', test: (g) => g.flags.has('chamber:pump') },
  { id: 'deep_cart', name: 'All Aboard', desc: 'Restore the rail cart on level 25 of the Deepworks.', cat: 'explore', tier: 3, icon: 'brass_gear', test: (g) => g.flags.has('chamber:cart') },
  { id: 'deep_chambers', name: 'Industrial Archaeologist', desc: 'Study the machine in every works chamber of the Deepworks.', cat: 'explore', tier: 3, icon: 'old_cog', test: (g) => OBSERVATIONS.every((f) => g.flags.has(f)), prog: (g) => [OBSERVATIONS.filter((f) => g.flags.has(f)).length, OBSERVATIONS.length] },
  { id: 'monsters100', name: 'Pest Control', desc: 'Clear 100 pests out of the Deepworks.', cat: 'explore', tier: 2, icon: 'sword_1', ...num('monsters', 100) },
  { id: 'monsters1000', name: 'Exterminator', desc: 'Clear 1,000 pests out of the Deepworks.', cat: 'explore', tier: 3, icon: 'sword_3', ...num('monsters', 1000) },
  { id: 'treasure10', name: 'Treasure Hunter', desc: 'Open 10 treasure chests in the Deepworks.', cat: 'explore', tier: 2, icon: 'gold_bar', ...num('treasures', 10) },
  { id: 'fish1', name: 'Bite!', desc: 'Catch your first fish.', cat: 'explore', tier: 1, icon: 'bluegill', ...num('fish_caught', 1) },
  { id: 'fish25', name: 'Angler', desc: 'Catch 25 fish.', cat: 'explore', tier: 1, icon: 'rod_1', ...num('fish_caught', 25) },
  { id: 'fish_all', name: 'Master Angler', desc: 'Catch every ordinary fish in the valley.', cat: 'explore', tier: 3, icon: 'rod_3', test: (g) => NON_LEGEND_FISH.every((f) => c(g, 'caught_' + f) > 0), prog: (g) => [NON_LEGEND_FISH.filter((f) => c(g, 'caught_' + f) > 0).length, NON_LEGEND_FISH.length] },
  { id: 'legend', name: 'Legendary', desc: 'Land a legendary fish.', cat: 'explore', tier: 3, icon: 'thistlefin', test: (g) => ['thistlefin', 'clockjaw', 'tidemother'].some((f) => c(g, 'caught_' + f) > 0) },
  { id: 'dig25', name: 'Archaeologist', desc: 'Dig up 25 artifact spots.', cat: 'explore', tier: 1, icon: 'old_cog', ...num('dug', 25) },
  { id: 'museum', name: 'Curator', desc: 'Donate 20 items to the museum.', cat: 'explore', tier: 2, icon: 'fossil_shell', test: (g) => (g.sys.goals?.museum?.length ?? 0) >= 20, prog: (g) => [g.sys.goals?.museum?.length ?? 0, 20] },
  { id: 'forage100', name: 'Gatherer', desc: 'Forage 100 wild items.', cat: 'explore', tier: 1, icon: 'morel', ...num('foraged', 100) },
  { id: 'walk10k', name: 'Wanderer', desc: 'Walk 10,000 tiles.', cat: 'explore', tier: 2, icon: 'brass_compass', ...num('walked', 10000) },
  { id: 'marathon', name: 'Marathon Farmer', desc: 'Walk 42,195 tiles. That\'s a marathon (if a tile is a metre).', cat: 'explore', tier: 3, icon: 'star_chart', ...num('walked', 42195) },

  // ---------------- Village ----------------
  { id: 'talkall', name: 'Social Butterfly', desc: 'Talk to every villager.', cat: 'village', tier: 1, icon: 'tea', test: (g) => npcs(g).length > 0 && npcs(g).every((n) => c(g, 'talk_' + n.id) > 0), prog: (g) => [npcs(g).filter((n) => c(g, 'talk_' + n.id) > 0).length, npcs(g).length || 13] },
  { id: 'friends5', name: 'Neighborly', desc: 'Reach 4 hearts with 5 villagers.', cat: 'village', tier: 2, icon: 'cookies', test: (g) => npcs(g).filter((n) => hearts(n) >= 4).length >= 5, prog: (g) => [npcs(g).filter((n) => hearts(n) >= 4).length, 5] },
  { id: 'friend10', name: 'Kindred Spirit', desc: 'Reach 10 hearts with anyone.', cat: 'village', tier: 3, icon: 'cake', test: (g) => npcs(g).some((n) => hearts(n) >= 10) },
  { id: 'gifts', name: 'Thoughtful', desc: 'Give 50 gifts.', cat: 'village', tier: 1, icon: 'tulip', ...num('gifts', 50) },
  { id: 'heartevents', name: 'Open Book', desc: 'See 8 heart events.', cat: 'village', tier: 2, icon: 'f_paint_meadow', ...num('heart_events', 8) },
  { id: 'partner', name: 'The Brass Locket', desc: 'Find a partner to share your farm with.', cat: 'village', tier: 3, icon: 'heart_charm', ...num('partner', 1) },
  { id: 'requests20', name: 'Good Neighbor', desc: 'Complete 20 town requests from the notice board.', cat: 'village', tier: 2, icon: 'bread', ...num('requests', 20) },
  { id: 'quests15', name: 'Story Time', desc: 'Complete 15 quests.', cat: 'village', tier: 2, icon: 'f_bookcase', ...num('quests', 15) },
  { id: 'festivals', name: 'Festive Spirit', desc: 'Take part in all four festivals.', cat: 'village', tier: 2, icon: 'ticket', ...num('festivals', 4) },
  { id: 'contracts5', name: 'Reliable Supplier', desc: 'Fill 5 Trading Guild contracts.', cat: 'village', tier: 1, icon: 'crate_out', ...num('contracts', 5) },
  { id: 'guild5', name: 'Guild Partner', desc: 'Reach the top Trading Guild rank.', cat: 'village', tier: 3, icon: 'f_banner', test: (g) => (g.sys.orders?.rep?.guild ?? 0) >= 20, prog: (g) => [g.sys.orders?.rep?.guild ?? 0, 20] },
  { id: 'projects8', name: 'Restorer', desc: 'Complete 8 restoration projects.', cat: 'village', tier: 2, icon: 'brick', test: (g) => projectsDone(g) >= 8, prog: (g) => [projectsDone(g), 8] },
  { id: 'clock', name: 'The Clock Strikes', desc: 'Restart the town clocktower.', cat: 'village', tier: 3, icon: 'clockwork_core', test: (g) => g.flags.has('clock_fixed') },

  // ---------------- Home & Life ----------------
  { id: 'pet', name: 'Best Friend', desc: 'Reach 5 hearts with your pet.', cat: 'home', tier: 2, icon: 'f_petbed', test: (g) => (g.sys.pet?.points ?? 0) >= 1000, prog: (g) => [Math.floor((g.sys.pet?.points ?? 0) / 200), 5] },
  { id: 'homecook', name: 'Home Cooking', desc: 'Cook 25 dishes in your farmhouse kitchen.', cat: 'home', tier: 2, icon: 'omelet', ...num('cooked', 25) },
  { id: 'chef', name: 'Hearth Chef', desc: 'Make 25 dishes in total (any kitchen or machine).', cat: 'home', tier: 1, icon: 'pancakes', test: (g) => madeCat(g, 'food') >= 25, prog: (g) => [Math.floor(madeCat(g, 'food')), 25] },
  { id: 'recipes15', name: 'Recipe Box', desc: 'Learn 15 recipes.', cat: 'home', tier: 2, icon: 'card_cake', ...num('recipes', 15) },
  { id: 'decor15', name: 'Interior Designer', desc: 'Place 15 pieces of furniture.', cat: 'home', tier: 1, icon: 'f_armchair_rose', ...num('decor', 15) },
  { id: 'skill10', name: 'Master of One', desc: 'Reach level 10 in any skill.', cat: 'home', tier: 3, icon: 'bundle_star', test: (g) => SKILLS.some((s) => (g.player.skills[s] ?? 0) >= 10) },
  { id: 'allskills5', name: 'Jack of All Trades', desc: 'Reach level 5 in every skill.', cat: 'home', tier: 2, icon: 'bundle_rose', test: (g) => SKILLS.every((s) => (g.player.skills[s] ?? 0) >= 5), prog: (g) => [SKILLS.filter((s) => (g.player.skills[s] ?? 0) >= 5).length, SKILLS.length] },
  { id: 'year2', name: 'Seasoned', desc: 'Reach your second year in Thistlewick.', cat: 'home', tier: 2, icon: 'maple_seed', test: (g) => g.time.year >= 2 },
  { id: 'year3', name: 'Old Hand', desc: 'Reach your third year.', cat: 'home', tier: 3, icon: 'f_gilded_clock', test: (g) => g.time.year >= 3 },

  // ---------------- Fortune ----------------
  { id: 'earn1k', name: 'First Coins', desc: 'Earn 1,000 coins.', cat: 'fortune', tier: 1, icon: 'copper_bar', test: (g) => g.earned >= 1000, prog: (g) => [g.earned, 1000] },
  { id: 'earn10k', name: 'Comfortable', desc: 'Earn 10,000 coins.', cat: 'fortune', tier: 1, icon: 'tin_bar', test: (g) => g.earned >= 10000, prog: (g) => [g.earned, 10000] },
  { id: 'earn50k', name: 'Prosperous', desc: 'Earn 50,000 coins.', cat: 'fortune', tier: 2, icon: 'iron_bar', test: (g) => g.earned >= 50000, prog: (g) => [g.earned, 50000] },
  { id: 'earn1m', name: 'Valley Tycoon', desc: 'Earn 1,000,000 coins.', cat: 'fortune', tier: 3, icon: 'gold_bar', test: (g) => g.earned >= 1000000, prog: (g) => [g.earned, 1000000] },
  { id: 'hold100k', name: 'Money Bin', desc: 'Hold 100,000 coins at once.', cat: 'fortune', tier: 3, icon: 'starmetal_bar', test: (g) => g.player.money >= 100000, prog: (g) => [Math.max(0, g.player.money), 100000] },
  { id: 'ship1k', name: 'Shipping Magnate', desc: 'Ship 1,000 items.', cat: 'fortune', tier: 2, icon: 'shipping_crate', ...num('shipped', 1000) },
  { id: 'ship1day', name: 'Payday', desc: 'Earn 5,000 coins from a single night of shipping.', cat: 'fortune', tier: 2, icon: 'brass_bar', ...num('best_day', 5000) },

  // ---------------- Challenges (game modes & farm maps) ----------------
  { id: 'rush_bronze', name: 'Clockwork Rush: Bronze', desc: 'Finish a Clockwork Rush with a bronze medal or better.', cat: 'challenge', tier: 1, icon: 'copper_gear', test: (g) => (g.sys.mode?.medal ?? 0) >= 1 },
  { id: 'rush_silver', name: 'Clockwork Rush: Silver', desc: 'Finish a Clockwork Rush with a silver medal or better.', cat: 'challenge', tier: 2, icon: 'iron_plate', test: (g) => (g.sys.mode?.medal ?? 0) >= 2 },
  { id: 'rush_gold', name: 'Clockwork Rush: Gold', desc: 'Win a gold medal in Clockwork Rush.', cat: 'challenge', tier: 3, icon: 'brass_gear', test: (g) => (g.sys.mode?.medal ?? 0) >= 3 },
  { id: 'cozy_season', name: 'Slow and Steady', desc: 'Play a full season in Cozy mode.', cat: 'challenge', tier: 1, icon: 'tealeaf', test: (g) => g.mode === 'cozy' && g.daysPlayed >= 28 },
  { id: 'sandbox500', name: 'Tinkerer Unbound', desc: 'Have 500 structures placed in Sandbox mode.', cat: 'challenge', tier: 1, icon: 'copper_coil', test: (g) => g.mode === 'sandbox' && g.ents.all().length >= 500 },
  { id: 'map_riverside', name: 'Mill Wright', desc: 'Run 2 water wheels on the stream through your Riverside Mill farm.', cat: 'challenge', tier: 2, icon: 'waterwheel', test: (g) => g.farmKind === 'riverside' && g.ents.all().filter((e) => !e.ghost && e.def.id === 'waterwheel' && e.x >= 22 && e.x <= 93).length >= 2 },
  { id: 'map_ruins', name: 'Salvage King', desc: 'Mine 500 copper ore on the Tinker\'s Yard farm (the seam is waiting for drills).', cat: 'challenge', tier: 2, icon: 'copper_ore', test: (g) => g.farmKind === 'ruins' && made(g, 'copper_ore') >= 500, prog: (g) => [Math.floor(made(g, 'copper_ore')), 500] },
  { id: 'map_highlands', name: 'King of the Hill', desc: 'Turn 3 windmills on the windy Terraced Highlands farm.', cat: 'challenge', tier: 2, icon: 'windmill', test: (g) => g.farmKind === 'highlands' && kinds2(g, 'windmill') >= 3 },
  { id: 'map_wildwood', name: 'Into the Woods', desc: 'Chop 300 trees on the Wildwood farm.', cat: 'challenge', tier: 2, icon: 'pine_cone', test: (g) => g.farmKind === 'wildwood' && c(g, 'trees_chopped') >= 300, prog: (g) => [c(g, 'trees_chopped'), 300] },

  // ---------------- Secrets & easter eggs ----------------
  { id: 'konami', name: 'Up Up Down Down', desc: 'Entered the old cheat code. The valley approves.', cat: 'secret', tier: 2, icon: 'tin_soldier', secret: true, hint: 'Some codes never go out of style.' },
  { id: 'sunpoke', name: 'Don\'t Touch the Sun', desc: 'Poked the sun in the sky window ten times.', cat: 'secret', tier: 1, icon: 'sunbell', secret: true, hint: 'The little sky in the corner is more than decoration.' },
  { id: 'moon', name: 'Goodnight Moon', desc: 'Said goodnight to the moon in the sky window.', cat: 'secret', tier: 1, icon: 'mooncap', secret: true, hint: 'Something up there likes a goodnight.' },
  { id: 'gearhead', name: 'Gear Head', desc: 'Spun the hotbar gears 25 times.', cat: 'secret', tier: 1, icon: 'brass_gear', secret: true, hint: 'Those cogs on the toolbar look loose.' },
  { id: 'nightowl', name: 'Night Owl', desc: 'Still awake at 1:50 in the morning.', cat: 'secret', tier: 1, icon: 'f_lantern', secret: true, hint: 'Bedtime is a suggestion.', test: (g) => g.time.min >= 1550 && !g.sleeping },
  { id: 'faceplant', name: 'Faceplant', desc: 'Passed out at 2am. The floor was comfy.', cat: 'secret', tier: 1, icon: 'hay', secret: true, hint: 'Push yourself a little too far.', ...num('passed_out', 1) },
  { id: 'sleepyhead', name: 'Sleepyhead', desc: 'Went to bed before 5pm.', cat: 'secret', tier: 1, icon: 'quilt', secret: true, hint: 'Early to bed...' },
  { id: 'dizzy', name: 'Dizzy Spell', desc: 'Walked in circles until the world spun.', cat: 'secret', tier: 1, icon: 'f_globe', secret: true, hint: 'Round and round and round...' },
  { id: 'shadowbox', name: 'Shadowboxer', desc: 'Swung your tools at thin air 50 times.', cat: 'secret', tier: 1, icon: 'sword_0', secret: true, hint: 'The air had it coming.', ...num('air_swings', 50) },
  { id: 'rainwater', name: 'Overachiever', desc: 'Watered crops in the rain 20 times.', cat: 'secret', tier: 1, icon: 'can_0', secret: true, hint: 'The sky is doing it already.', ...num('rain_water', 20) },
  { id: 'midnightsnack', name: 'Midnight Snack', desc: 'Ate something after midnight.', cat: 'secret', tier: 1, icon: 'cookies', secret: true, hint: 'The kitchen never closes.' },
  { id: 'glutton', name: 'Bottomless Stomach', desc: 'Ate 15 things in one day.', cat: 'secret', tier: 2, icon: 'pizza', secret: true, hint: 'Just one more bite.' },
  { id: 'broke', name: 'Flat Broke', desc: 'Had exactly zero coins.', cat: 'secret', tier: 1, icon: 'rusted_key', secret: true, hint: 'Spend it all.', test: (g) => g.player.money === 0 && g.daysPlayed >= 1 },
  { id: 'lucky7', name: 'Jackpot', desc: 'Had exactly 777 coins.', cat: 'secret', tier: 1, icon: 'lucky_foot', secret: true, hint: 'A lucky number in your purse.', test: (g) => g.player.money === 777 },
  { id: 'packrat', name: 'Pack Rat', desc: 'Filled every slot in your backpack.', cat: 'secret', tier: 1, icon: 'chest_iron', secret: true, hint: 'There is no such thing as too much stuff.', test: (g) => g.player.inv.slots.slice(0, g.player.rows * 12).every((s) => !!s) },
  { id: 'beltride', name: 'Conveyor Commute', desc: 'Rode the belts for 30 tiles.', cat: 'secret', tier: 2, icon: 'belt_1', secret: true, hint: 'Why walk when the floor can do it?', ...num('belt_ride', 30) },
  { id: 'scarecrow', name: 'Scarecrow Whisperer', desc: 'Had a heart-to-heart with a scarecrow.', cat: 'secret', tier: 1, icon: 'scarecrow', secret: true, hint: 'Someone in the fields looks lonely.' },
  { id: 'wrongvalley', name: 'Wrong Valley', desc: 'Named your farm after another valley\'s farm town.', cat: 'secret', tier: 1, icon: 'old_boot', secret: true, hint: 'Pick a farm name you\'ve heard somewhere else.', test: (g) => /stardew|pelican|harvest moon|zuzu|mistria|ember|sunny ?side/i.test(g.player.farmName) },
  { id: 'namesake', name: 'Namesake', desc: 'Named yourself or your farm Sprocket or Sprout.', cat: 'secret', tier: 1, icon: 'copper_gear', secret: true, hint: 'Look at the title screen for inspiration.', test: (g) => /sprocket|sprout/i.test(g.player.name + ' ' + g.player.farmName) },
  { id: 'treehugger', name: 'Tree Hugger', desc: 'Shook 100 trees.', cat: 'secret', tier: 1, icon: 'apple', secret: true, hint: 'Some trees just need a hug.', ...num('shakes', 100) },
  { id: 'loop', name: 'Merry-Go-Round', desc: 'Built a closed belt loop with something riding it forever.', cat: 'secret', tier: 2, icon: 'belt_2', secret: true, hint: 'Where does a belt go when it comes back?' },
  { id: 'starfall', name: 'Starfall', desc: 'A meteorite landed on your farm.', cat: 'secret', tier: 2, icon: 'starstone', secret: true, hint: 'Keep an eye on the night sky.', ...num('meteorites', 1) },
  { id: 'fairy', name: 'Fairy Godfarmer', desc: 'A crop fairy visited your fields.', cat: 'secret', tier: 2, icon: 'wisp_essence', secret: true, hint: 'Some nights, something small and bright drops by.', ...num('fairies', 1) },
  { id: 'birdseye', name: 'Bird\'s Eye View', desc: 'Zoomed all the way out and all the way in.', cat: 'secret', tier: 1, icon: 'lens', secret: true, hint: 'Look at the farm from every distance.' },
  { id: 'butterfingers', name: 'Butterfingers', desc: 'Dropped 50 items on the ground.', cat: 'secret', tier: 1, icon: 'tin_can', secret: true, hint: 'Oops. Oops. Oops.', ...num('dropped', 50) },
  { id: 'tide', name: 'Offering to the Tide', desc: 'Dropped something into the sea. It seemed like the right thing to do.', cat: 'secret', tier: 1, icon: 'sea_glass', secret: true, hint: 'The ocean accepts gifts.' },
  { id: 'floor13', name: 'Unlucky Thirteen', desc: 'Went down to level 13 of the Deepworks on a Friday.', cat: 'secret', tier: 1, icon: 'moth_dust', secret: true, hint: 'Some levels are worse on certain days.', test: (g) => g.player.where === 'mine' && g.sys.mine?.floor === 13 && g.weekday === 4 },
  { id: 'highnoon', name: 'High Noon', desc: 'Stood by the restored clocktower as it struck twelve.', cat: 'secret', tier: 2, icon: 'f_gilded_clock', secret: true, hint: 'Hear the old clock strike midday.', test: (g) => { if (!g.flags.has('clock_fixed') || g.player.where !== 'world' || g.time.min < 720 || g.time.min >= 735) return false; const [cx, cy] = g.map.loc('clocktower'); return Math.hypot(g.player.x - cx, g.player.y - cy) < 4; } },
  { id: 'mascot', name: 'Brand Loyalty', desc: 'Named your pet Sprocket or Sprout.', cat: 'secret', tier: 1, icon: 'f_petbed', secret: true, hint: 'A pet deserves a name with a ring to it.', test: (g) => /sprocket|sprout/i.test(g.sys.pet?.stage !== 'none' ? g.sys.pet?.name ?? '' : '') },
  { id: 'regift', name: 'Regifter', desc: 'Gave someone a Waterlogged Boot. They were thrilled. (They were not.)', cat: 'secret', tier: 1, icon: 'old_boot', secret: true, hint: 'One person\'s trash is... still trash.' },
  { id: 'sentimental', name: 'Sentimental', desc: 'Still carried the Rusty Hoe in your second year.', cat: 'secret', tier: 1, icon: 'hoe_0', secret: true, hint: 'Never forget where you came from.', test: (g) => g.time.year >= 2 && g.player.inv.countId('hoe_0') > 0 },
  { id: 'club', name: 'Club to a Knife Fight', desc: 'Cleared a pest on level 25 of the Deepworks or deeper with the Driftwood Club.', cat: 'secret', tier: 3, icon: 'sword_0', secret: true, hint: 'Your very first weapon has one more fight in it.' },
  { id: 'graveyard', name: 'Graveyard Shift', desc: 'Caught a fish after 1am in a thunderstorm.', cat: 'secret', tier: 2, icon: 'moon_squid', secret: true, hint: 'The fish bite strangest in the worst weather.' },
  { id: 'spin', name: 'You Spin Me Round', desc: 'Rotated one structure 20 times in a row.', cat: 'secret', tier: 1, icon: 'arm_fast', secret: true, hint: 'R is a very satisfying key.' },
  { id: 'trashpanda', name: 'Trash Panda', desc: 'Reeled in every kind of junk.', cat: 'secret', tier: 1, icon: 'tangled_line', secret: true, hint: 'Not everything on the end of the line is a fish.', test: (g) => ['old_boot', 'tin_can', 'driftwood', 'tangled_line', 'kelp'].every((t) => (g.counters['trash_' + t] ?? 0) > 0) },
  { id: 'devotee', name: 'Completionist', desc: 'Unlocked 75 other achievements.', cat: 'secret', tier: 3, icon: 'f_trophy_clockjaw', secret: true, hint: 'Collect them all. Well, most of them.' },
];
/** kept for older imports (journal) */
export const FEATS = ACHIEVEMENTS;
export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));


export function achPoints(a: Achievement) {
  return a.secret ? SECRET_POINTS : TIER_POINTS[a.tier];
}

export function featsDone(g: Game): Set<string> {
  if (!(g.sys.feats instanceof Set)) g.sys.feats = new Set<string>(g.sys.feats ?? []);
  return g.sys.feats;
}

/** Unlock an achievement now (no-op if already unlocked or unknown). */
export function unlockAch(g: Game, id: string): boolean {
  const done = featsDone(g);
  if (done.has(id) || !ACH_BY_ID.has(id)) return false;
  // in Sandbox everything is free, so only its own challenges and the easter eggs count
  const cat = ACH_BY_ID.get(id)!.cat;
  if (g.mode === 'sandbox' && cat !== 'challenge' && cat !== 'secret') return false;
  done.add(id);
  g.emit({ t: 'ach', id });
  // secrets pay a little: curiosity should be rewarded
  if (ACH_BY_ID.get(id)!.secret) g.player.money += SECRET_REWARD;
  if (done.size >= 76 && !done.has('devotee')) unlockAch(g, 'devotee');
  return true;
}

/** Belt loop with cargo: a cycle in the belt `next` graph that carries at least one item. */
function hasCargoLoop(g: Game): boolean {
  const state = new Map<number, number>(); // 1 = on stack, 2 = done
  for (const start of g.ents.belts) {
    if (state.has(start.id)) continue;
    const path: any[] = [];
    let e: any = start;
    while (e && e.belt && !state.has(e.id)) {
      state.set(e.id, 1);
      path.push(e);
      e = e.belt.next;
    }
    if (e && state.get(e.id) === 1) {
      const i = path.indexOf(e);
      const cyc = path.slice(i);
      if (cyc.length >= 4 && cyc.some((b) => b.belt.lanes[0].k.length + b.belt.lanes[1].k.length > 0)) return true;
    }
    for (const b of path) state.set(b.id, 2);
  }
  return false;
}

export function achSys(g: Game) {
  if (!g.sys.achUnlock) g.sys.achUnlock = unlockAch;
  return featsDone(g);
}

registerSystem({
  name: 'achievements',
  dayStart(g) {
    g.counters.eaten_day = 0;
    g.sys.achUnlock = unlockAch;
  },
  afterLoad(g) {
    g.sys.achUnlock = unlockAch;
  },
  tick(g) {
    if (g.tickN % 120 !== 7 || g.map.w < 100) return;
    const done = achSys(g);
    for (const a of ACHIEVEMENTS) {
      if (done.has(a.id) || !a.test) continue;
      if (a.test(g)) unlockAch(g, a.id);
    }
    if (!done.has('loop') && g.tickN % 600 === 7 && hasCargoLoop(g)) unlockAch(g, 'loop');
  },
  save(g) {
    return [...featsDone(g)];
  },
  load(g, d) {
    g.sys.feats = new Set(d ?? []);
  },
});
