// Standing orders (ROADMAP.md 7.4; Phase 2's minimal Orders board): a business's recurring need,
// posted on the board in town and in J -> Orders. Filled by hand at the villager, or by
// consignment: a crate tagged for the customer sends what fits their open order at each post,
// ahead of the market. src/sim/systems/orders.ts runs them.

export interface StandingDef {
  id: string;
  npc: string;
  /** the business, as the board and the crate's tag name it */
  place: string;
  spec: string;
  /** how many the first order wants; weekly orders grow by 2 per reputation point (to +10) */
  n: number;
  /** coins per item, paid on delivery (0: the reward pays instead) */
  unit: number;
  /** silver or better pays double */
  silver?: boolean;
  /** posted again every Monday once the first one is filled */
  weekly?: boolean;
  /** what filling it gives besides the per-item pay */
  reward?: { items?: { item: string; n: number }[]; money?: number; text: string };
  /** the villager's words on the board */
  text: string;
  /** a line when it's filled */
  thanks: string;
}

export const STANDING: StandingDef[] = [
  {
    id: 'rowan_pickles', npc: 'rowan', place: 'The Copper Kettle', spec: 'pickles_cogbean', n: 6, unit: 150, silver: true, weekly: true,
    text: 'Pickled cogbeans for the lunch crowd, every week. The silver ones go to the good tables: I pay double for those.',
    thanks: 'The lunch crowd will clear the jar by noon. Same again next week?',
  },
  {
    id: 'bram_oil', npc: 'bram', place: 'The Smithy', spec: 'cogbean_oil', n: 6, unit: 0,
    reward: { items: [{ item: 'copper_bar', n: 5 }, { item: 'arm_fast', n: 2 }], text: '5 copper bars and 2 Brass Arms' },
    text: "My bellows squeal like a kettle. Six bottles of cogbean oil and I'll forge the bars for the keeper's old wheel, with two of my brass arms for its mill.",
    thanks: "Quiet bellows at last. The bars will mend the old wheel's axle, and the arms want sparks: mind your grid.",
  },
];

export const STANDING_BY_ID = new Map(STANDING.map((s) => [s.id, s]));
