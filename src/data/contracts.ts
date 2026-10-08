// The Trading Guild's weekly bulk contracts. Big orders that reward factories without
// flooding the local market. `n` is the base amount; it grows with guild rank.
export interface ContractDef {
  id: string;
  spec: string; // item id or #tag
  n: number;
  tier: 0 | 1 | 2;
  label: string;
  /** a typical unit value used for the payout when the spec is a tag */
  unit?: number;
}

export const CONTRACT_POOL: ContractDef[] = [
  // tier 0: early factory goods
  { id: 'c_preserve', spec: '#preserve', n: 40, tier: 0, label: 'Jars for the city markets', unit: 110 },
  { id: 'c_flour', spec: 'flour', n: 60, tier: 0, label: 'Flour for the river bakeries' },
  { id: 'c_copper', spec: 'copper_bar', n: 40, tier: 0, label: 'Copper for the wire works' },
  { id: 'c_plank', spec: 'plank', n: 120, tier: 0, label: 'Planks for the harbor docks' },
  { id: 'c_crop', spec: '#crop', n: 250, tier: 0, label: 'Fresh produce for the canal towns', unit: 45 },
  { id: 'c_egg', spec: '#egg', n: 60, tier: 0, label: 'Eggs for the hotel kitchens', unit: 50 },
  { id: 'c_coal', spec: 'coal', n: 80, tier: 0, label: 'Coal for the riverboats' },
  { id: 'c_bread', spec: 'bread', n: 25, tier: 0, label: 'Loaves for the railway crews' },
  { id: 'c_gear', spec: 'copper_gear', n: 30, tier: 0, label: 'Gears for the clockmakers' },
  { id: 'c_rope', spec: 'rope', n: 40, tier: 0, label: 'Rope for the shipyards' },
  // tier 1: mid game
  { id: 'c_wine', spec: '#wine', n: 30, tier: 1, label: 'Wine for the capital cellars', unit: 300 },
  { id: 'c_cheese', spec: 'cheese', n: 30, tier: 1, label: 'Cheese wheels for the fair' },
  { id: 'c_brass', spec: 'brass_gear', n: 25, tier: 1, label: 'Brass gears for the observatory' },
  { id: 'c_glass', spec: 'glass', n: 50, tier: 1, label: 'Glass for the conservatory' },
  { id: 'c_cooking', spec: '#cooking', n: 40, tier: 1, label: 'Meals for the mountain inns', unit: 250 },
  { id: 'c_iron', spec: 'iron_bar', n: 60, tier: 1, label: 'Iron for the bridge builders' },
  { id: 'c_honey', spec: '#honey', n: 40, tier: 1, label: 'Honey for the apothecaries', unit: 120 },
  { id: 'c_brick', spec: 'brick', n: 100, tier: 1, label: 'Bricks for the new library' },
  { id: 'c_cloth', spec: 'cloth', n: 30, tier: 1, label: 'Cloth for the tailors\' guild' },
  { id: 'c_coil', spec: 'copper_coil', n: 40, tier: 1, label: 'Coils for the telegraph line' },
  // tier 2: late game
  { id: 'c_spark', spec: 'spark_coil', n: 20, tier: 2, label: 'Spark coils for the lighthouse' },
  { id: 'c_gold', spec: 'gold_bar', n: 25, tier: 2, label: 'Gold for the royal mint' },
  { id: 'c_fine', spec: 'fine_cloth', n: 15, tier: 2, label: 'Fleece weave for the opera house' },
  { id: 'c_beam', spec: 'beam', n: 40, tier: 2, label: 'Beams for the great hall' },
  { id: 'c_plate', spec: 'iron_plate', n: 60, tier: 2, label: 'Plates for the airship hangar' },
  { id: 'c_gem', spec: '#gem', n: 20, tier: 2, label: 'Gems for the jewelers\' row', unit: 400 },
  { id: 'c_star', spec: 'starmetal_bar', n: 10, tier: 2, label: 'Starmetal for the Guild charter' },
];

/** reputation needed for each rank (index = rank) */
export const GUILD_RANKS = [
  { rep: 0, name: 'Associate' },
  { rep: 2, name: 'Supplier' },
  { rep: 5, name: 'Trusted Supplier' },
  { rep: 9, name: 'Purveyor' },
  { rep: 14, name: 'Master Purveyor' },
  { rep: 20, name: 'Guild Partner' },
];

/** extra shipping price per guild rank */
export const GUILD_BONUS_PER_RANK = 0.03;
