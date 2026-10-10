// Lesson cards (ROADMAP.md 6.4): two lines and a picture, shown the first time a situation
// happens, never modal, kept in the Keeper's Notebook. The sim asks for one with
// `g.sys.lesson(g, id)` (src/sim/lessons.ts); the play screen draws it (src/ui/lessoncard.ts).

export interface LessonDef {
  id: string;
  title: string;
  /** two short lines */
  text: [string, string];
  /** a sprite name for the 24x24 picture */
  pic: string;
  /** a state glyph drawn on the picture's corner */
  glyph?: 'starved' | 'blocked' | 'power' | 'fuel' | 'sprout';
}

export const LESSONS: LessonDef[] = [
  { id: 'rust', title: "The keeper's works", pic: 'rust:i:arm_basic',
    text: ['The old machines rusted while the farm stood empty.', 'F brings one back. Arms need a mainspring.'] },
  { id: 'arm', title: 'Arms take from behind', pic: 'i:arm_basic',
    text: ['An arm picks up from the green square behind it', 'and drops on the gold square in front. That is all.'] },
  { id: 'line', title: 'A line', pic: 'st:jar:0:1:0',
    text: ['Chest, arm, jar, arm, crate: goods move with nobody', 'carrying them. It runs while you sleep, too.'] },
  { id: 'post', title: 'The post', pic: 'st:shipping_crate:0:0:0',
    text: ['The post empties the crate at noon, 6pm and overnight,', 'and pays for everything in it.'] },
  { id: 'field', title: 'A field is a source', pic: 'st:gleaner:0:1:0',
    text: ['A gleaner picks what ripens in the 3x3 around it.', 'The morning harvest is yours: machines pick from noon.'] },
  { id: 'belt', title: 'Belt ends deliver', pic: 'i:belt_1',
    text: ['A belt carries goods along and drops them into', 'whatever it runs into: a jar, a chest, the crate.'] },
  { id: 'stages', title: 'Research stages', pic: 'st:lab:0:1:0',
    text: ['A keystone wants you to look, then try, then study.', 'You don\'t research what you haven\'t touched.'] },
  { id: 'starved', title: 'Starved', pic: 'st:jar:0:0:0', glyph: 'starved',
    text: ['An amber mark: this machine waits for its input.', 'Hover it, or hold I, to see what it waits for and why.'] },
  { id: 'harvest', title: 'Waiting for harvest', pic: 'st:gleaner:0:0:0', glyph: 'sprout',
    text: ['A line fed by a field waits for crops to ripen.', "That's healthy: plant more where a picker reaches."] },
  { id: 'blocked', title: 'Blocked', pic: 'i:belt_1', glyph: 'blocked',
    text: ['A red bar: goods here have nowhere to go.', 'Something after it is full, stopped or missing.'] },
  { id: 'full', title: 'Output full', pic: 'st:jar:0:0:0', glyph: 'blocked',
    text: ['A machine holds 60 finished goods, then stops.', 'An arm or a belt has to take them away.'] },
  { id: 'unpowered', title: 'Unpowered', pic: 'st:pole_wood:0:0:0', glyph: 'power',
    text: ['A blue bolt: no grid, or far too little power.', 'Poles carry sparks from a wheel to its machines.'] },
  { id: 'fuel', title: 'Needs fuel', pic: 'st:furnace:0:0:0', glyph: 'fuel',
    text: ['A grey flame: this machine burns fuel.', 'Coal or wood, by hand or by an arm.'] },
  { id: 'brownout', title: 'Brownout', pic: 'st:waterwheel:0:1:0', glyph: 'power',
    text: ['More demand than supply: everything on the grid slows.', 'Switch something off at a pole, or add power.'] },
  { id: 'buffer', title: 'A chest is a buffer', pic: 'st:chest_wood:0:0:0',
    text: ['A chest between two machines evens out the flow,', 'and keeps a line fed through the night shift.'] },
  { id: 'saturation', title: 'Saturation', pic: 'st:shipping_crate:0:0:0',
    text: ['Ship a lot of one thing and its price drops for a while.', 'The crate\'s price tag shows it. Ship more kinds.'] },
  { id: 'consign', title: 'Consignment', pic: 'st:shipping_crate:0:0:0',
    text: ['Tag the crate for a customer: at each post, goods that', 'fit their order go to them first.'] },
  { id: 'night', title: 'The night shift', pic: 'st:jar:0:1:0',
    text: ['From 2am to 6am the works keeps running without you.', 'Stock a chest before bed and the night pays for it.'] },
  { id: 'quality', title: 'Quality', pic: 'i:cogbean',
    text: ['Hand-picked crops can be silver or gold. Machines pick', 'base or silver. A jar keeps its beans\' quality.'] },
  { id: 'wind', title: 'The spring key', pic: 'i:spring',
    text: ['Right-click a spring arm or a gleaner to wind it:', 'twice as fast for 30 seconds. Never a chore.'] },
  { id: 'undo', title: 'Undo', pic: 'i:arm_basic',
    text: ['Placed something in the wrong spot? Ctrl+Z takes it back', 'within 10 seconds, with a full refund.'] },
];

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
