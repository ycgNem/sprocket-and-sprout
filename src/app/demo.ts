// A tiny pre-built farm-factory shown behind the title screen.
import type { Game } from '../sim/Game';
import { place } from '../sim/build';
import { key } from '../sim/inventory';
import { O } from '../sim/world/tilemap';
import { plant } from '../sim/systems/farming';
import { CROP_BY_ID } from '../data/crops';
import { laneInsert } from '../sim/systems/belts';

export function buildDemoFactory(g: Game) {
  const m = g.map;
  const clear = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) m.setO(x, y, O.NONE);
  };
  clear(52, 26, 80, 46);
  g.research.done = new Set(['r_belts', 'r_arms', 'r_preserves', 'r_brewing', 'r_power', 'r_milling', 'r_metallurgy']);
  // crop field
  const crops = ['strawberry', 'cabbage', 'potato', 'tulip'];
  for (let y = 30; y < 38; y++)
    for (let x = 54; x < 62; x++) {
      const i = m.idx(x, y);
      g.soil.set(i, { water: true, fert: null, crop: null, idle: 0 });
      const cr = CROP_BY_ID.get(crops[(y - 30) >> 1])!;
      plant(g, cr, i);
      const c = g.soil.get(i)!.crop!;
      c.days = 20;
      c.ready = (x + y) % 3 !== 0;
      c.stage = c.ready ? cr.stages.length : cr.stages.length - 1;
    }
  // a belt loop feeding kegs and jars
  for (let x = 63; x < 76; x++) place(g, 'belt_1', x, 32, 1);
  for (let y = 32; y < 38; y++) place(g, 'belt_1', 76, y, 2);
  for (let x = 76; x > 63; x--) place(g, 'belt_1', x, 38, 3);
  for (let y = 38; y > 32; y--) place(g, 'belt_1', 63, y, 0);
  const goods = ['strawberry', 'potato', 'cabbage', 'wheat'];
  let n = 0;
  for (const e of g.ents.belts) {
    if (n++ % 2) continue;
    laneInsert(e.belt!, n % 2, key(goods[n % 4]), 0.3);
  }
  for (let x = 65; x < 75; x += 3) {
    place(g, 'arm_basic', x, 31, 0);
    place(g, x % 2 ? 'keg' : 'jar', x, 30, 0);
    place(g, 'arm_basic', x, 39, 2);
    place(g, 'furnace', x, 40, 0);
  }
  place(g, 'windmill', 69, 34, 0);
  place(g, 'pole_wood', 71, 35, 0);
  place(g, 'lamp', 62, 29, 0);
  place(g, 'lamp', 77, 39, 0);
  place(g, 'scarecrow', 58, 39, 0);
  for (const e of g.ents.machines) {
    if (e.mach!.station === 'smelter') {
      e.mach!.fuel = { k: key('coal'), n: 20 };
      e.mach!.inBuf.set(key('copper_ore'), 30);
    }
  }
}
