// The works' specialists' favors: something for the works each one gives as the town's story moves
// on, mailed once the morning after its keystone (flag `favor:<id>`, src/sim/systems/favors.ts).
// They were Trust rewards until 2.1.1 (DECISIONS #175: Trust is gone); Old Thorne's drawings come the
// same way (src/data/drawings.ts).
export interface Favor {
  id: string;
  npc: string;
  /** the town keystone it waits for (its flag: 'town_mill', 'waterworks', 'tram') */
  after: string;
  /** the letter's title */
  title: string;
  /** what it does, for the Journal's Town tab */
  name: string;
  /** the villager's letter */
  letter: string;
}

/** Juniper's trade price: the Joinery's wooden machines at 20% off */
export const TRADE_PRICE = 0.8;
/** Bram's blast furnace at cost */
export const AT_COST = 0.7;
/** the drafting library with Hazel's index: 24 drawings, not 12 */
export const INDEXED_LIB = 24;
/** Sable's catalogue: studies at the desk 15% faster */
export const CATALOGUE = 1.15;
/** the Joinery's wooden machines (Juniper's trade price) */
export const WOODEN_MACHINES = new Set(['gleaner', 'hand_loom', 'waterwheel', 'windmill', 'sawmill', 'thresher']);

export const FAVORS: Favor[] = [
  {
    id: 'juniper_trade', npc: 'juniper', after: 'town_mill', title: 'Trade price', name: 'Trade price: the Joinery\'s wooden machines 20% off',
    letter: "You've bought enough wheels and frames off me to know a true shaft from a bent one. From now on you pay what the trade pays: a fifth off every wooden machine at the Joinery. Gleaners, looms, wheels, windmills, saws, threshers.\n- Juniper",
  },
  {
    id: 'hazel_index', npc: 'hazel', after: 'town_mill', title: 'Your drafting table, indexed', name: "Hazel's index: your drafting library holds 24 drawings",
    letter: "I came by while you were out and re-ruled your drafting table's drawers. Indexed, labelled, cross-referenced. Your library holds twenty-four drawings now, not twelve. You're welcome. Please don't fold them.\n- Hazel",
  },
  {
    id: 'pip_watch', npc: 'pip', after: 'town_mill', title: "I'm watching your machines!", name: "Pip's watch: Pip comes running when a machine stops",
    letter: "I'M WATCHING YOUR MACHINES NOW. Not in a creepy way! In an engineer way. If one stops for a whole minute I'll run and tell you which one and why. Dad says I have to come home for supper though.\n- Pip",
  },
  {
    id: 'bram_cost', npc: 'bram', after: 'waterworks', title: 'At cost', name: 'At cost: a blast furnace for 4,550, not 6,500',
    letter: "You've kept my furnace fed and my orders filled. A blast furnace from the Anvil is yours at what it costs me to cast: 4,550. Don't tell the Guild.\n- Bram",
  },
  {
    id: 'sable_catalogue', npc: 'sable', after: 'waterworks', title: 'A catalogue for your desk', name: "Sable's catalogue: studies at your desks 15% faster",
    letter: "I've catalogued the old works' notes against your desk's topics: where the keeper's answers already are, and where to start. Your studies should go fifteen percent faster. I measured. Return the cards when you're done. I know you won't.\n- Sable",
  },
];

export const FAVOR_BY_ID = new Map(FAVORS.map((r) => [r.id, r]));
