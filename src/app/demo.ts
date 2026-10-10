// A tiny pre-built farm-factory shown behind the title screen: 2.0's look (ROADMAP.md 3.2, the
// factory is the face). The keeper's yard and river works restored and running, three gleaner beds
// whose arms feed a belt to a pair of crocks and their pickles on to a chest, and a field gantry
// riding its rails over a strip of cogbeans on a windmill's power.
import type { Game } from '../sim/Game';
import { place } from '../sim/build';
import { key } from '../sim/inventory';
import { O } from '../sim/world/tilemap';
import { plant } from '../sim/systems/farming';
import { CROP_BY_ID } from '../data/crops';
import { RIVER } from '../sim/opening';

export function buildDemoFactory(g: Game) {
  const m = g.map;
  const clear = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) m.setO(x, y, O.NONE);
  };
  // the keeper's yard (north of row 28) keeps its own layout
  clear(52, 28, 82, 47);
  g.research.done = new Set(['r_belts', 'r_arms', 'r_preserves', 'r_gleaning', 'r_metallurgy', 'r_power', 'r_milling', 'r_gantry']);
  // the keeper's works, restored: the yard's line and the river works run
  for (const e of g.ents.all()) {
    delete e.st.rust;
    delete e.st.need;
    delete e.st.needN;
    delete e.st.after;
  }
  g.ents.powerDirty = true;
  g.ents.version++;
  place(g, 'arm_fast', RIVER.binArm[0], RIVER.binArm[1], 1);
  place(g, 'arm_fast', RIVER.outArm[0], RIVER.outArm[1], 1);
  g.ents.at(RIVER.bin[0], RIVER.bin[1])?.inv?.add(key('barley'), 200);
  // a cogbean on a tile, ripe or nearly
  const bean = CROP_BY_ID.get('cogbean')!;
  const grow = (x: number, y: number, ripe: boolean) => {
    const i = m.idx(x, y);
    g.soil.set(i, { water: true, fert: null, crop: null, idle: 0 });
    plant(g, bean, i);
    const c = g.soil.get(i)?.crop;
    if (!c) return;
    c.days = 6;
    c.ready = ripe;
    c.stage = ripe ? bean.stages.length : bean.stages.length - 1;
  };
  // three gleaner beds: each gleaner's arm (in its bed's south tile) lifts the basket onto the belt
  for (const cx of [56, 60, 64]) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !(dx === 0 && dy === 1)) grow(cx + dx, 31 + dy, (cx + dx + dy) % 3 !== 0);
    place(g, 'gleaner', cx, 31, 0);
    place(g, 'arm_basic', cx, 32, 2);
  }
  // the belt east to the crocks; two arms lift beans into them, two more lift the pickles out
  for (let x = 55; x <= 70; x++) place(g, 'belt_1', x, 33, 1);
  place(g, 'chest_wood', 71, 33, 0);
  for (const x of [66, 69]) {
    place(g, 'arm_basic', x, 34, 2);
    place(g, 'jar', x, 35, 0);
    place(g, 'arm_basic', x, 36, 2);
  }
  // the pickles' belt west to a chest by the field
  for (let x = 70; x >= 61; x--) place(g, 'belt_1', x, 37, 3);
  place(g, 'chest_wood', 60, 37, 0);
  // a field gantry over a five-wide strip between its rails (south of the farm pond), on a windmill
  // and a pole
  for (let y = 38; y <= 43; y++) {
    place(g, 'rail', 73, y, 0);
    place(g, 'rail', 79, y, 0);
    for (let x = 74; x <= 78; x++) grow(x, y, (x + y) % 2 === 0);
  }
  const gan = place(g, 'field_gantry', 73, 44, 0);
  gan.inv?.add(key('cogbean_seed'), 30);
  place(g, 'windmill', 75, 45, 0);
  place(g, 'pole_wood', 78, 45, 0);
  // lamps for the evening the title shows
  place(g, 'lamp', 58, 35, 0);
  place(g, 'lamp', 72, 36, 0);
  // beans already on their way, and the crocks busy
  for (const e of g.ents.machines) if (e.def.id === 'jar') e.mach!.inBuf.set(key('cogbean'), 8);
}
