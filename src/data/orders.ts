// Orders (ROADMAP.md 7.4, Phase 3): one board, three tabs. Every ask in town is an order: today's
// small asks, each business's standing orders (and the Trading Guild's weekly bulk contracts), and
// the town works for the Town Council (the restoration projects and the keystones). An order is
// filled by hand at the villager, by a crate tagged for its customer ("Ship to"), at the board, or
// (the Guild) at the Freight Depot. src/sim/systems/orders.ts runs them.
import type { Stack } from './types';

/** a customer on the board: a business (its id is its keeper's villager id), the Guild or the Council */
export interface BusinessDef {
  id: string;
  /** the villager who runs it (F at them hands its orders over) */
  npc?: string;
  name: string;
  /** what it orders, for the board */
  wants: string;
  /** its shop (the special stock that reputation opens) */
  shop?: string;
}

export const BUSINESSES: BusinessDef[] = [
  { id: 'rowan', npc: 'rowan', name: 'The Copper Kettle', wants: 'food for the inn', shop: 'inn' },
  { id: 'bram', npc: 'bram', name: 'The Anvil & Ember', wants: 'coal, bars and oil', shop: 'smithy' },
  { id: 'juniper', npc: 'juniper', name: 'Oakroot Joinery', wants: 'timber and canvas', shop: 'carpenter' },
  { id: 'ottoline', npc: 'ottoline', name: 'Cogwhistle Workshop', wants: 'parts', shop: 'workshop' },
  { id: 'ines', npc: 'ines', name: 'The Valley Clinic', wants: 'honey, herbs and tea', shop: 'clinic' },
  { id: 'wren', npc: 'wren', name: "Halloway's Bait & Tackle", wants: 'fish and rope', shop: 'fisher' },
  { id: 'marigold', npc: 'marigold', name: 'The Mercantile', wants: 'produce and preserves', shop: 'general' },
  { id: 'clem', npc: 'clem', name: 'Meadowlark Ranch', wants: 'hay and grain', shop: 'ranch' },
  { id: 'roxy', npc: 'roxy', name: 'Vane Air Freight', wants: 'anything, in bulk, at a premium', shop: 'airfreight' },
  { id: 'guild', name: 'The Trading Guild', wants: 'weekly bulk contracts' },
  { id: 'council', npc: 'tobias', name: 'The Town Council', wants: 'the town works' },
];
export const BUSINESS_BY_ID = new Map(BUSINESSES.map((b) => [b.id, b]));
/** the business a villager runs (the Council's mayor is not a business of his own) */
export const BUSINESS_BY_NPC = new Map(BUSINESSES.filter((b) => b.npc && b.id !== 'council').map((b) => [b.npc!, b]));

/** reputation ranks per business: +1 a filled order (+2 a big one) */
export const REP_RANKS = [
  { rep: 0, name: 'Associate' },
  { rep: 2, name: 'Supplier' },
  { rep: 5, name: 'Trusted Supplier' },
  { rep: 9, name: 'Purveyor' },
  { rep: 14, name: 'Master Purveyor' },
  { rep: 20, name: 'Partner' },
];

export function rankOf(rep: number): number {
  let r = 0;
  REP_RANKS.forEach((k, i) => { if (rep >= k.rep) r = i; });
  return r;
}

export interface StandingDef {
  id: string;
  /** the business that posts it */
  biz: string;
  spec: string;
  /** how many the first order wants; weekly orders grow by 2 a reputation rank (to +10) */
  n: number;
  /** coins per item, paid on delivery (0: the reward pays instead) */
  unit: number;
  /** silver or better pays double */
  silver?: boolean;
  /** posted again every Monday once the first one is filled */
  weekly?: boolean;
  /** the business's rank it waits for (an index into REP_RANKS: 1 Supplier, 2 Trusted Supplier, 3 Purveyor) */
  rank?: number;
  /**
   * what else it waits for, in the unlock words (`flag:`, `quest:` done, a research id) plus `on:<quest>`
   * (active or done). Quest conditions only apply to a Keeper's Line save; 1.x saves skip them.
   */
  after?: string[];
  /** +2 reputation */
  big?: boolean;
  /** what filling it gives besides the per-item pay */
  reward?: { items?: Stack[]; money?: number; text: string };
  /** the villager's words on the board */
  text: string;
  /** a line when it's filled */
  thanks: string;
}

export const STANDING: StandingDef[] = [
  // ---- The Copper Kettle (Rowan): food ----
  {
    id: 'rowan_pickles', biz: 'rowan', spec: 'pickles_cogbean', n: 6, unit: 150, silver: true, weekly: true, after: ['on:k7_town'],
    text: 'Pickled cogbeans for the lunch crowd, every week. The silver ones go to the good tables: I pay double for those.',
    thanks: 'The lunch crowd will clear the jar by noon. Same again next week?',
  },
  {
    // the keeper's mill gets a customer once it turns (B8): meal sells for 55 at market, 80 here
    id: 'rowan_meal', biz: 'rowan', spec: 'barley_flour', n: 10, unit: 80, weekly: true, after: ['on:k9_bed'],
    text: "Barley meal for the bread ovens, ten sacks a week. The old keeper's mill used to grind it for us.",
    thanks: 'Bread for the whole square again. Same again next week?',
  },
  {
    // bread bakes from any flour or meal: the farmhouse kitchen or an oven (the critic's M1)
    id: 'rowan_bread', biz: 'rowan', spec: 'bread', n: 8, unit: 170, weekly: true, after: ['flag:town_mill'],
    text: "The mill turns and the town wants loaves again. Eight country loaves a week, baked from your flour or meal in your kitchen or an oven, and I'll keep my ovens for the pies.",
    thanks: 'Warm bread on every table. The square smells like it used to.',
  },
  {
    id: 'rowan_cheese', biz: 'rowan', spec: 'cheese', n: 5, unit: 320, weekly: true, rank: 1, after: ['r_dairy'],
    text: 'A wheel of cheese for every soup. Five a week, if your press is willing.',
    thanks: 'The soup has its cheese. You have a regular table here, you know.',
  },
  {
    id: 'rowan_soup', biz: 'rowan', spec: 'veggie_soup', n: 6, unit: 300, weekly: true, rank: 2, after: ['r_cooking'],
    text: 'Travellers off the river road want soup ready when they walk in. Six pots a week.',
    thanks: 'Six pots, gone by supper. You feed half the valley now.',
  },
  {
    id: 'rowan_feast', biz: 'rowan', spec: '#cooking', n: 12, unit: 330, weekly: true, rank: 3, big: true, after: ['r_cooking'],
    text: "Feast nights at the Kettle: twelve hearty dishes a week, whatever your kitchen's best at.",
    thanks: 'The whole town came. They toasted the farm, you know.',
  },
  // ---- The Anvil & Ember (Bram): metal ----
  {
    id: 'bram_oil', biz: 'bram', spec: 'cogbean_oil', n: 6, unit: 0, after: ['on:k8_river'],
    reward: { items: [{ item: 'copper_bar', n: 5 }, { item: 'arm_fast', n: 2 }], text: '5 copper bars and 2 Brass Arms' },
    text: "My bellows squeal like a kettle. Six bottles of cogbean oil and I'll forge the bars for the keeper's old wheel, with two of my brass arms for its mill.",
    thanks: "Quiet bellows at last. The bars will mend the old wheel's axle, and the arms want sparks: mind your grid.",
  },
  {
    id: 'bram_coal', biz: 'bram', spec: 'coal', n: 30, unit: 22, weekly: true, after: ['quest:k8_river'],
    text: 'Thirty coal a week keeps the forge hot. Kiln it from wood or dig it, I pay the same.',
    thanks: 'Hot forge, happy smith. Same again Monday.',
  },
  {
    id: 'bram_copper', biz: 'bram', spec: 'copper_bar', n: 20, unit: 85, weekly: true, rank: 1,
    text: "Twenty copper bars a week: the river towns want wire and I can't smelt fast enough.",
    thanks: 'Good clean bars. The wire works will be pleased.',
  },
  {
    id: 'bram_lube', biz: 'bram', spec: 'lubricant', n: 6, unit: 230, weekly: true, rank: 2, after: ['r_milling'],
    text: 'Six flasks of lubricant a week. My hammers run sweeter on it, and so would yours.',
    thanks: "Not a squeak in the shop. You've spoiled me.",
  },
  {
    id: 'bram_iron', biz: 'bram', spec: 'iron_bar', n: 20, unit: 170, weekly: true, rank: 3, big: true,
    text: 'Twenty iron bars a week for the bridge commission. Big order, bigger pay.',
    thanks: "The bridge will stand a hundred years. Your iron's in it.",
  },
  // ---- Oakroot Joinery (Juniper): wood ----
  {
    id: 'juniper_planks', biz: 'juniper', spec: 'plank', n: 60, unit: 9, weekly: true, after: ['on:k9_bed'],
    text: 'Sixty planks a week for fences and floors. Saw them by hand or by mill.',
    thanks: 'Straight and true. Thank you kindly.',
  },
  {
    id: 'juniper_hardwood', biz: 'juniper', spec: 'hardwood', n: 20, unit: 22, weekly: true, rank: 1,
    text: 'Hardwood for the cabinets: twenty pieces a week.',
    thanks: "Lovely grain on these. I'll make something worthy of it.",
  },
  {
    id: 'juniper_canvas', biz: 'juniper', spec: 'canvas', n: 8, unit: 85, weekly: true, rank: 2, after: ['r_weaving'],
    text: 'Canvas for chair seats and awnings, eight lengths a week.',
    thanks: 'Every porch in town will have an awning by summer.',
  },
  {
    id: 'juniper_paste', biz: 'juniper', spec: 'starch_paste', n: 10, unit: 110, weekly: true, rank: 2, after: ['r_pastes'],
    text: 'Starch paste for veneers and wallpaper: ten pots a week. Mine always goes lumpy.',
    thanks: 'Smooth as cream. The new parlour walls will never peel.',
  },
  {
    id: 'juniper_beams', biz: 'juniper', spec: 'beam', n: 20, unit: 58, weekly: true, rank: 3, big: true, after: ['r_sawmill'],
    text: 'Twenty beams a week. The town hall roof is next and it is very large.',
    thanks: 'The hall has its roof. Look up next time you pass.',
  },
  // ---- Cogwhistle Workshop (the Professor): parts ----
  {
    id: 'prof_gears', biz: 'ottoline', spec: 'copper_gear', n: 12, unit: 100, weekly: true, after: ['r_power'],
    text: 'Gears! Twelve a week, for experiments I promise are mostly safe.',
    thanks: 'Splendid teeth on these. Mostly safe, as promised.',
  },
  {
    id: 'prof_coils', biz: 'ottoline', spec: 'copper_coil', n: 24, unit: 58, weekly: true, rank: 1, after: ['r_metallurgy'],
    text: 'Copper coils, two dozen a week. The telegraph to the river towns needs miles of them.',
    thanks: 'The telegraph clicks! We spoke to Millbrook this morning.',
  },
  {
    id: 'prof_glass', biz: 'ottoline', spec: 'glass', n: 20, unit: 30, weekly: true, rank: 2, after: ['r_glass'],
    text: 'I broke all my beakers again. Twenty glass a week, please, until I learn.',
    thanks: 'Twenty beakers. I shall be careful. Relatively.',
  },
  {
    id: 'prof_spark', biz: 'ottoline', spec: 'spark_coil', n: 6, unit: 230, weekly: true, rank: 3, big: true, after: ['r_spark'],
    text: 'Six spark coils a week for the observatory. The stars will not study themselves.',
    thanks: 'We saw a comet! Well, I think it was a comet.',
  },
  // ---- The Valley Clinic (Ines): tea, herbs ----
  {
    id: 'ines_honey', biz: 'ines', spec: '#honey', n: 4, unit: 150, weekly: true, after: ['flag:town_mill'],
    text: 'Honey for sore throats: four jars a week.',
    thanks: 'Half the valley has a cough. You have the other half covered.',
  },
  {
    id: 'ines_herbs', biz: 'ines', spec: '#herb', n: 10, unit: 60, weekly: true, rank: 1,
    text: 'Ten bunches of herbs a week, tea leaves or mint, for the poultices.',
    thanks: 'Fresh and fragrant. My patients thank you.',
  },
  {
    id: 'ines_dried', biz: 'ines', spec: 'dried_tea', n: 6, unit: 90, weekly: true, rank: 2, after: ['r_bottling'],
    text: 'Dried tea keeps all winter. Six packets a week for the waiting room.',
    thanks: 'The waiting room has never been so calm.',
  },
  {
    id: 'ines_tea', biz: 'ines', spec: 'tea', n: 8, unit: 170, weekly: true, rank: 3, big: true, after: ['r_bottling'],
    text: 'Bottled tea for the night shift: eight a week.',
    thanks: 'The night nurses send their love. And their thanks.',
  },
  // ---- Halloway's Bait & Tackle (Wren): fish, rope ----
  {
    id: 'wren_rope', biz: 'wren', spec: 'rope', n: 15, unit: 18, weekly: true, after: ['flag:town_mill'],
    text: 'Fifteen rope a week for nets and moorings.',
    thanks: 'Good rope. The boats stay put.',
  },
  {
    id: 'wren_fish', biz: 'wren', spec: '#fish', n: 10, unit: 60, weekly: true, rank: 1,
    text: "Ten fish a week for the smokehouse. I'm too busy selling rods to catch them.",
    thanks: 'The smokehouse is full. Smells like home.',
  },
  {
    id: 'wren_smoked', biz: 'wren', spec: 'smoked_fish', n: 6, unit: 280, weekly: true, rank: 2, after: ['r_bottling'],
    text: 'Smoked fish for the riverboats, six a week. They pay well and complain more.',
    thanks: 'Not one complaint this week. A miracle.',
  },
  {
    id: 'wren_caviar', biz: 'wren', spec: 'caviar', n: 2, unit: 700, weekly: true, rank: 3, big: true,
    text: 'Roe jars for the capital: two a week. Very fancy people, very fancy prices.',
    thanks: 'The capital wants more. Of course they do.',
  },
  // ---- The Mercantile (Marigold): produce, preserves ----
  {
    id: 'mari_produce', biz: 'marigold', spec: '#vegetable', n: 20, unit: 65, weekly: true, after: ['on:k9_bed'],
    text: 'Twenty vegetables a week for the shelves, any kind. The town eats what you grow.',
    thanks: 'Shelves full of color again. Lovely!',
  },
  {
    id: 'mari_jam', biz: 'marigold', spec: '#preserve', n: 10, unit: 200, weekly: true, rank: 1,
    text: 'Ten jars of preserves a week. They fly off the shelf before winter.',
    thanks: 'Gone in a day. Everyone asks whose farm they came from.',
  },
  {
    id: 'mari_cloth', biz: 'marigold', spec: 'cloth', n: 4, unit: 250, weekly: true, rank: 2, after: ['r_weaving'],
    text: 'Four bolts of cloth a week for the quilting circle.',
    thanks: 'The quilting circle made you an honorary member.',
  },
  {
    id: 'mari_wine', biz: 'marigold', spec: '#wine', n: 6, unit: 300, weekly: true, rank: 3, big: true, after: ['r_brewing'],
    text: 'Six bottles of wine a week for the cellar shelf.',
    thanks: "The cellar shelf is the talk of the river. Don't let it go to your head.",
  },
  // ---- Meadowlark Ranch (Clem): hay, grain ----
  {
    id: 'clem_hay', biz: 'clem', spec: 'hay', n: 40, unit: 8, weekly: true, after: ['r_power'],
    text: 'Forty hay a week. The herd eats more than I can cut.',
    thanks: "Full mangers. The cows say thanks. Well, they moo.",
  },
  {
    id: 'clem_wheat', biz: 'clem', spec: 'wheat', n: 20, unit: 36, weekly: true, rank: 1,
    text: 'Twenty wheat a week for the horses and the hens.',
    thanks: 'Fat hens, shiny horses. Much obliged.',
  },
  {
    id: 'clem_grain', biz: 'clem', spec: 'grain', n: 40, unit: 20, weekly: true, rank: 2, after: ['r_threshing'],
    text: 'Threshed grain, forty a week. Saves me beating it by hand.',
    thanks: "My arms thank you. Clean grain, no chaff.",
  },
  {
    id: 'clem_milk', biz: 'clem', spec: 'large_milk', n: 10, unit: 240, weekly: true, rank: 3, big: true, after: ['r_dairy'],
    text: 'Ten pails of the good milk a week, for the creamery deal I just shook on.',
    thanks: "The creamery's happy, so I'm happy.",
  },
  // ---- Vane Air Freight (Roxy): anything, bulk, premium ----
  {
    id: 'roxy_bulk', biz: 'roxy', spec: '#crop', n: 80, unit: 50, weekly: true, after: ['flag:mail_roxy'],
    text: 'Eighty crops a week, any kind, sugar. The city eats like a furnace and pays like a duchess.',
    thanks: "Loaded and lifted. The city's already asking for more.",
  },
  {
    id: 'roxy_preserve', biz: 'roxy', spec: '#preserve', n: 30, unit: 190, weekly: true, rank: 1, big: true,
    text: 'Thirty jars a week for the city markets. Fill my hold and I fill your purse.',
    thanks: 'Not a jar broken all the way to the city. My best run yet.',
  },
  {
    id: 'roxy_parts', biz: 'roxy', spec: 'brass_gear', n: 30, unit: 100, weekly: true, rank: 2, big: true, after: ['r_brass'],
    text: 'Thirty brass gears a week. The city clockmakers have heard about your works.',
    thanks: "The clockmakers want to meet you. I told them you're shy.",
  },
  {
    id: 'roxy_cores', biz: 'roxy', spec: 'clockwork_core', n: 3, unit: 850, weekly: true, rank: 3, big: true, after: ['r_assembly2'],
    text: 'Three clockwork cores a week. Do not ask what the buyer wants them for. I did not.',
    thanks: "Delivered, paid, and no questions asked. My kind of trade.",
  },
];
export const STANDING_BY_ID = new Map(STANDING.map((s) => [s.id, s]));

/**
 * The town keystones on the Works tab (ROADMAP.md 7.3): each goes up when its main quest starts (so
 * you see what it wants from the first step: the critic's M2), takes deliveries by hand at the board
 * or by a crate tagged for the Town Council, and is finished once what it waits for is done. Then it
 * sets its flag (the town's own buildings answer to it). The Clock is the restoration project p_clock.
 */
export interface KeystoneWorksDef {
  id: string;
  name: string;
  era: number;
  desc: string;
  items: Stack[];
  /** the main quest that posts it (a save without the Keeper's Line posts it when `after`'s research can be studied) */
  quest: string;
  /** unlock words that must hold before it can be finished (its research, a restored chamber) */
  after: string[];
  /** set when it's filled */
  flag: string;
  /** a line when it's done */
  done: string;
}

export const KEYSTONE_WORKS: KeystoneWorksDef[] = [
  {
    id: 'w_town_mill', name: 'The Town Mill', era: 2, quest: 'k10_mill', after: ['r_milling'], flag: 'town_mill',
    desc: "The town's old mill on the river at the west end of Main Street: new paddles, a mended gear train and its first sacks to grind.",
    items: [{ item: '#flour', n: 40 }, { item: 'plank', n: 40 }, { item: 'copper_gear', n: 8 }],
    done: "The Town Mill's wheel turns again! The Kettle and the Mercantile sell bread and flour from it, and Rowan wants loaves every week.",
  },
  {
    id: 'w_waterworks', name: 'The Waterworks', era: 3, quest: 'k13_waterworks', after: ['r_steam'], flag: 'waterworks',
    desc: 'The pump house by the square: brass for the pumps, coils for their motors, oil for the bearings, plates for the tank and starch paste to seal the joints.',
    items: [{ item: 'brass_bar', n: 20 }, { item: 'copper_coil', n: 10 }, { item: 'oil', n: 50 }, { item: 'iron_plate', n: 4 }, { item: 'starch_paste', n: 20 }],
    done: "The Waterworks run! The fountain plays, the deep galleries drain, and the pressure in the pipes will drive mist towers.",
  },
  {
    id: 'w_lamps', name: 'Lamplighting', era: 3, quest: 'k15_lamps', after: ['r_spark'], flag: 'lamps_hung',
    desc: "Twelve lamps for the square, and the coils to wire them. They'll light on your power, through the keeper's old pole at the farm gate.",
    items: [{ item: 'lamp', n: 12 }, { item: 'copper_coil', n: 6 }],
    done: "The square's lamps are hung. They light at dusk on your power, while your grid reaches the farm gate with 12 sparks to spare.",
  },
  {
    id: 'w_tram', name: 'The Tram', era: 4, quest: 'k16_tram', after: ['r_assembly2', 'flag:chamber:cart'], flag: 'tram',
    desc: 'The old rail cart from the Crystal galleries, set on the quarry road: sleepers and rails, brass for the bogies and pigment for its livery.',
    items: [{ item: 'plank', n: 300 }, { item: 'brass_gear', n: 40 }, { item: 'pigment', n: 20 }],
    done: 'The Tram runs! Every morning it carries 20 of the ore, bars or gems you leave in its quarry bin to town, and sells them at a premium.',
  },
];
export const KEYSTONE_WORKS_BY_ID = new Map(KEYSTONE_WORKS.map((k) => [k.id, k]));
