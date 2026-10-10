// Old Thorne's drawings of the old works (ROADMAP.md 7.6, Phase 5): blueprints he gives you for the
// drafting table's library (src/sim/drafting.ts), one at the end of his 2-Trust event and one each
// time the town wakes another of the old works' keystones. Every piece is a real structure; arms take
// from behind and drop in front (rot 0 north, 1 east, 2 south, 3 west). src/sim/people.ts gives them.
import type { Blueprint } from '../sim/blueprint';

export interface DrawingDef {
  id: string;
  /** its name in the library */
  name: string;
  /** the flag it waits for (his 2-Trust event, a town keystone) */
  after: string;
  /** what Thorne says, handing it over on a talk (the 2-Trust one is handed over in the event) */
  line: string;
  bp: Blueprint;
}

export const DRAWINGS: DrawingDef[] = [
  {
    // the keeper's own line, as Thorne drew it for them: chest, arm, crock, arm, crate in a row
    id: 'crock_line', name: "The keeper's crock line", after: 'heart_thorne_2',
    line: "The keeper's crock line, as I promised. Chest, arm, crock, arm, crate. The smallest works there is.",
    bp: {
      w: 5, h: 1,
      items: [
        { def: 'chest_wood', dx: 0, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 1, dy: 0, rot: 1 },
        { def: 'jar', dx: 2, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 3, dy: 0, rot: 1 },
        { def: 'shipping_crate', dx: 4, dy: 0, rot: 0 },
      ],
    },
  },
  {
    // a grain bin, a spring arm, the mill, a spring arm, a chest; a pole for the stones. Spring arms
    // draw no sparks, so the mill gets all of them (k9's lesson)
    id: 'mill_line', name: 'A mill line', after: 'town_mill',
    line: "The Town Mill turns, so here's how the old works ran a small one. Bin, arm, mill, arm, chest. Spring arms draw no sparks, so the stones get all of them. Put the pole on your grid.",
    bp: {
      w: 6, h: 2,
      items: [
        { def: 'chest_wood', dx: 0, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 1, dy: 0, rot: 1 },
        { def: 'mill', dx: 2, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 4, dy: 0, rot: 1 },
        { def: 'chest_wood', dx: 5, dy: 0, rot: 0 },
        { def: 'pole_wood', dx: 1, dy: 1, rot: 0 },
      ],
    },
  },
  {
    // ore in from the side, coal down from above, bars out the other side
    id: 'smelt_line', name: 'A smelting line', after: 'waterworks',
    line: "The Waterworks run, so you'll want brass by the bar. The old works' smelting line: ore in from the side, coal down from above. Ours never went out in forty years.",
    bp: {
      w: 5, h: 3,
      items: [
        { def: 'chest_wood', dx: 2, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 2, dy: 1, rot: 2 },
        { def: 'chest_wood', dx: 0, dy: 2, rot: 0 },
        { def: 'arm_basic', dx: 1, dy: 2, rot: 1 },
        { def: 'furnace', dx: 2, dy: 2, rot: 0 },
        { def: 'arm_basic', dx: 3, dy: 2, rot: 1 },
        { def: 'chest_wood', dx: 4, dy: 2, rot: 0 },
      ],
    },
  },
  {
    // brass bars into a tinker's bench locked on brass gears: the Clock wants forty
    id: 'gear_line', name: "The clock's gear line", after: 'tram',
    line: "The Tram runs. The Clock wants forty brass gears, so here's how we cut them by the hundred. Brass bars in, gears out, and a pole for the bench.",
    bp: {
      w: 6, h: 2,
      items: [
        { def: 'chest_wood', dx: 0, dy: 0, rot: 0 },
        { def: 'arm_basic', dx: 1, dy: 0, rot: 1 },
        { def: 'assembler', dx: 2, dy: 0, rot: 0, recipe: 'hand:brass_gear' },
        { def: 'arm_basic', dx: 4, dy: 0, rot: 1 },
        { def: 'chest_wood', dx: 5, dy: 0, rot: 0 },
        { def: 'pole_wood', dx: 1, dy: 1, rot: 0 },
      ],
    },
  },
];

export const DRAWING_BY_ID = new Map(DRAWINGS.map((d) => [d.id, d]));
