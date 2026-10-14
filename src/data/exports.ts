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
export const LINE_VALUE = 40000;
/** each rank asks for this much more a line (rank 5: four times the first) */
export const LINE_GROWTH = 0.6;
/** export price: the goods' base price times this, plus PREMIUM_RANK a rank */
export const EXPORT_PREMIUM = 1.4, PREMIUM_RANK = 0.08;
/** a manifest loaded in full pays this share of what its goods paid, on top */
export const FULL_BONUS = 0.4;
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
}

export const EXPORT_PORTS: ExportPort[] = [
  {
    id: 'brassmouth', name: 'Brassmouth', about: 'A foundry city whose furnaces never cool. It buys metal and parts by the shipload.',
    wants: ['copper_bar', 'tin_bar', 'iron_bar', 'brass_bar', 'gold_bar', 'copper_gear', 'brass_gear', 'iron_plate', 'spring', 'copper_coil', 'spark_coil', 'glass', 'lens'],
  },
  {
    id: 'verdance', name: 'Port Verdance', about: 'A market port of a hundred kitchens. It buys bread, cheese and every kind of preserve.',
    wants: ['bread', 'cookies', 'cake', 'cheese', 'butter', 'flour', 'cornmeal', 'sugar', 'pumpkin_pie', 'berry_tart', 'pickles_cogbean', 'pickles_tomato', 'pickles_cabbage', 'pickles_beet', 'jam_strawberry', 'jam_blueberry', 'jam_grape', 'jam_apple'],
  },
  {
    id: 'ember', name: 'The Ember Isles', about: 'Warm islands that pay well for luxuries: wine, ale, coffee and the finest oils.',
    wants: ['wine_grape', 'wine_strawberry', 'wine_cherry', 'wine_apple', 'ale', 'stout', 'pale_ale', 'mead', 'coffee_drink', 'tea', 'truffle_oil', 'caviar', 'smoked_fish', 'goat_cheese'],
  },
  {
    id: 'saltspire', name: 'Saltspire', about: 'A shipyard town on the cold coast. It buys timber, rope, canvas and oil to build its fleets.',
    wants: ['plank', 'beam', 'rope', 'canvas', 'cloth', 'linen', 'lubricant', 'oil', 'iron_plate', 'brick', 'concrete'],
  },
  {
    id: 'kettleholm', name: 'Kettleholm', about: 'A northern city of tea rooms and bakeries, cold for half the year.',
    wants: ['tea', 'dried_tea', 'honey', 'bread', 'cookies', 'honey_bun', 'butter', 'cheese', 'jam_cherry', 'jam_pear', 'quilt', 'fine_cloth', 'cloth'],
  },
];
export const PORT_BY_ID = new Map(EXPORT_PORTS.map((p) => [p.id, p]));
