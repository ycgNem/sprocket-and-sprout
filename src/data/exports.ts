// Exports (2.1, the owner: "for late game add a thing where you can ship goods off, export goods,
// but they ask for crazy quantities"). Once the town rebuilds the Harbor (a works project after the
// Tram), the Copper Gull calls at the beach pier: each voyage brings a manifest from a port across
// the sea, three to five goods in quantities only a factory makes, and it sails a week later with
// whatever is loaded. The run-time is src/sim/systems/exports.ts; the Orders board's Exports tab
// shows the manifest (src/ui/windows/orders.ts); src/render/harbor.ts draws the ship and warehouse.

/** the merchant ship that calls at the Harbor */
export const SHIP_NAME = 'The Copper Gull';
/** days the ship stays in port (the manifest's week), and days at sea before it calls again */
export const IN_PORT_DAYS = 7;
export const AT_SEA_DAYS = 3;
/** a manifest line's size: about this many coins of goods at their base price, at the first rank */
export const LINE_VALUE = 30000;
/**
 * and at most what one machine makes of it in this many days, at the first rank (2.2): by value
 * alone a line of honey was 125 machine-days and one of copper bars 4 (scripts/latepace.ts), so a
 * manifest with a slow good on it could not be filled in its week
 */
export const LINE_MACHINE_DAYS = 16;
/** each rank asks for this much more a line (rank 5: four times the first) */
export const LINE_GROWTH = 0.6;
/**
 * export price: the goods' base price times this, plus PREMIUM_RANK a rank. 2.1 paid 140% and a 40%
 * bonus, and the first manifest (235,000) out-earned the whole first year (the 2.1.1 playtest): a
 * ship now pays the market's price for quantities the market could never take, and what makes a
 * full manifest worth the week is what the port sends back (each port's keepsake and crate, below)
 */
export const EXPORT_PREMIUM = 1.0, PREMIUM_RANK = 0.04;
/** a manifest loaded in full pays this share of what its goods paid, on top */
export const FULL_BONUS = 0.15;
/** standing for a manifest loaded in full, and for one at least half loaded (by value) */
export const REP_FULL = 3, REP_HALF = 1;
/** a line asks for at most this many */
export const LINE_MAX = 9999;

export interface HarborRank {
  rep: number;
  name: string;
  /** coins the Harbormaster's letter carries on reaching it */
  coins: number;
}
/** standing with the Harbor: each rank asks bigger manifests and pays a better premium */
export const HARBOR_RANKS: HarborRank[] = [
  { rep: 0, name: 'Dockhand', coins: 0 },
  { rep: 3, name: 'Shipper', coins: 10000 },
  { rep: 9, name: 'Merchant', coins: 20000 },
  { rep: 18, name: 'Trader', coins: 30000 },
  { rep: 30, name: 'Magnate', coins: 40000 },
  { rep: 45, name: 'Merchant Prince', coins: 50000 },
];
/** lines on a manifest at a rank: three, a fourth from Merchant, a fifth from Magnate */
export const linesAt = (rank: number) => 3 + (rank >= 2 ? 1 : 0) + (rank >= 4 ? 1 : 0);

export interface ExportPort {
  id: string;
  name: string;
  /** a line for the board and the arrival note */
  about: string;
  /** what its merchants buy (item ids); a manifest takes the ones in season that your farm has made */
  wants: string[];
  /** its thanks for the first manifest loaded in full: a piece for the farmhouse found nowhere else */
  keepsake: string;
  /** a crate of its own goods, sent with every manifest loaded in full */
  crate: { item: string; n: number }[];
  /** the line its merchants write with the crate */
  thanks: string;
}

export const EXPORT_PORTS: ExportPort[] = [
  {
    id: 'brassmouth', name: 'Brassmouth', about: 'A foundry city whose furnaces never cool. It buys metal and parts by the shipload.',
    wants: ['copper_bar', 'tin_bar', 'iron_bar', 'brass_bar', 'gold_bar', 'copper_gear', 'brass_gear', 'iron_plate', 'spring', 'copper_coil', 'spark_coil', 'glass', 'lens'],
    keepsake: 'f_keep_brassmouth', crate: [{ item: 'clockwork_core', n: 2 }, { item: 'arm_fast', n: 4 }],
    thanks: 'The foundry guild sends clockwork from its own benches.',
  },
  {
    id: 'verdance', name: 'Port Verdance', about: 'A market port of a hundred kitchens. It buys bread, cheese and every kind of preserve.',
    wants: ['bread', 'cookies', 'cake', 'cheese', 'butter', 'flour', 'cornmeal', 'sugar', 'pumpkin_pie', 'berry_tart', 'pickles_cogbean', 'pickles_tomato', 'pickles_cabbage', 'pickles_beet', 'jam_strawberry', 'jam_blueberry', 'jam_grape', 'jam_apple'],
    keepsake: 'f_keep_verdance', crate: [{ item: 'starpetal_seed', n: 12 }, { item: 'glowmelon_seed', n: 12 }],
    thanks: "The market's seed merchants send what no shop in the valley stocks.",
  },
  {
    id: 'ember', name: 'The Ember Isles', about: 'Warm islands that pay well for luxuries: wine, ale, coffee and the finest oils.',
    wants: ['wine_grape', 'wine_strawberry', 'wine_cherry', 'wine_apple', 'ale', 'stout', 'pale_ale', 'mead', 'coffee_drink', 'tea', 'truffle_oil', 'caviar', 'smoked_fish', 'goat_cheese'],
    keepsake: 'f_keep_ember', crate: [{ item: 'super_tonic', n: 6 }, { item: 'sunbell_seed', n: 12 }],
    thanks: 'The islanders send their tonic and a packet of sun-loving seed.',
  },
  {
    id: 'saltspire', name: 'Saltspire', about: 'A shipyard town on the cold coast. It buys timber, rope, canvas and oil to build its fleets.',
    wants: ['plank', 'beam', 'rope', 'canvas', 'cloth', 'linen', 'lubricant', 'oil', 'iron_plate', 'brick', 'concrete'],
    keepsake: 'f_keep_saltspire', crate: [{ item: 'starmetal_bar', n: 3 }, { item: 'hardwood', n: 60 }],
    thanks: 'The shipwrights send keel timber and a little of the metal they will not name.',
  },
  {
    id: 'kettleholm', name: 'Kettleholm', about: 'A northern city of tea rooms and bakeries, cold for half the year.',
    wants: ['tea', 'dried_tea', 'honey', 'bread', 'cookies', 'honey_bun', 'butter', 'cheese', 'jam_cherry', 'jam_pear', 'quilt', 'fine_cloth', 'cloth'],
    keepsake: 'f_keep_kettleholm', crate: [{ item: 'snowberry_sapling', n: 1 }, { item: 'frostmint_seed', n: 12 }],
    thanks: 'The tea rooms send a sapling from the cold coast and their own mint.',
  },
];
export const PORT_BY_ID = new Map(EXPORT_PORTS.map((p) => [p.id, p]));
