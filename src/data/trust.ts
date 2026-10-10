// What the works' specialists give as their Trust grows (ROADMAP.md 7.6; the critic's Phase 5 review:
// "Trust is hearts with new labels" while Bram's, Thorne's, Hazel's and Pip's rewards were soup
// recipes, which went to the villagers who cook, src/data/cookbook.ts). Each is something for the
// works, mailed once when you reach the level (flag `trust:<id>`, src/sim/systems/trust.ts). Old
// Thorne's are his drawings at Trust 2, 4, 6 and 8 (src/data/drawings.ts).
export interface TrustReward {
  id: string;
  npc: string;
  trust: number;
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

export const TRUST_REWARDS: TrustReward[] = [
  {
    id: 'juniper_trade', npc: 'juniper', trust: 3, title: 'Trade price', name: 'Trade price: the Joinery\'s wooden machines 20% off',
    letter: "You've bought enough wheels and frames off me to know a true shaft from a bent one. From now on you pay what the trade pays: a fifth off every wooden machine at the Joinery. Gleaners, looms, wheels, windmills, saws, threshers.\n- Juniper",
  },
  {
    id: 'hazel_index', npc: 'hazel', trust: 3, title: 'Your drafting table, indexed', name: "Hazel's index: your drafting library holds 24 drawings",
    letter: "I came by while you were out and re-ruled your drafting table's drawers. Indexed, labelled, cross-referenced. Your library holds twenty-four drawings now, not twelve. You're welcome. Please don't fold them.\n- Hazel",
  },
  {
    id: 'pip_watch', npc: 'pip', trust: 3, title: "I'm watching your machines!", name: "Pip's watch: Pip comes running when a machine stops",
    letter: "I'M WATCHING YOUR MACHINES NOW. Not in a creepy way! In an engineer way. If one stops for a whole minute I'll run and tell you which one and why. Dad says I have to come home for supper though.\n- Pip",
  },
  {
    id: 'bram_cost', npc: 'bram', trust: 4, title: 'At cost', name: 'At cost: a blast furnace for 4,550, not 6,500',
    letter: "You've kept my furnace fed and my orders filled. A blast furnace from the Anvil is yours at what it costs me to cast: 4,550. Don't tell the Guild.\n- Bram",
  },
  {
    id: 'sable_catalogue', npc: 'sable', trust: 4, title: 'A catalogue for your desk', name: "Sable's catalogue: studies at your desks 15% faster",
    letter: "I've catalogued the old works' notes against your desk's topics: where the keeper's answers already are, and where to start. Your studies should go fifteen percent faster. I measured. Return the cards when you're done. I know you won't.\n- Sable",
  },
];

export const TRUST_REWARD_BY_ID = new Map(TRUST_REWARDS.map((r) => [r.id, r]));
