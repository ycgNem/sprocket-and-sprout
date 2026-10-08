// Debug: spawn a large factory (1000+ belts, 200+ machines) to measure performance.
import type { PlayScreen } from './play';
import { place, canPlace } from '../sim/build';
import { key } from '../sim/inventory';
import { O, Z } from '../sim/world/tilemap';
import { laneInsert } from '../sim/systems/belts';
import type { Game } from '../sim/Game';

export function buildPerfFactory(g: Game, x0 = 24, y0 = 50, rows = 10) {
  const m = g.map;
  for (let y = y0 - 1; y < y0 + rows * 4 + 2; y++)
    for (let x = x0 - 1; x < x0 + 68; x++) {
      if (!m.inb(x, y)) continue;
      m.setO(x, y, O.NONE);
      m.zone[m.idx(x, y)] = Z.FARM;
      g.soil.delete(m.idx(x, y));
    }
  for (const r of ['r_metallurgy', 'r_power', 'r_milling', 'r_belts', 'r_arms', 'r_brewing', 'r_preserves']) g.research.done.add(r);
  let belts = 0, machines = 0;
  g.player.x = x0 + 34; g.player.y = y0 - 3;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * 4;
    // a long east-west belt loop per row
    for (let x = x0; x < x0 + 64; x++) if (canPlace(g, 'belt_1', x, y, 1).ok) { place(g, 'belt_1', x, y, 1); belts++; }
    place(g, 'belt_1', x0 + 64, y, 2); place(g, 'belt_1', x0 + 64, y + 1, 2);
    for (let x = x0 + 64; x > x0; x--) if (canPlace(g, 'belt_1', x, y + 2, 3).ok) { place(g, 'belt_1', x, y + 2, 3); belts++; }
    place(g, 'belt_1', x0, y + 2, 0); place(g, 'belt_1', x0, y + 1, 0);
    belts += 4;
    // furnaces fed by arms from the loop
    for (let x = x0 + 2; x < x0 + 62; x += 3) {
      if (canPlace(g, 'arm_basic', x, y + 3, 2).ok) {
        place(g, 'arm_basic', x, y + 3, 2);
      }
    }
    for (let x = x0 + 2; x < x0 + 62; x += 3) {
      if (r % 2 === 0 && canPlace(g, 'keg', x + 1, y + 1, 0).ok) { place(g, 'keg', x + 1, y + 1, 0); machines++; }
    }
  }
  // load items
  const goods = ['strawberry', 'apple', 'grape', 'blueberry'];
  let i = 0;
  for (const e of g.ents.belts) {
    for (let li = 0; li < 2; li++) for (let p = 0; p < 1; p += 0.5) laneInsert(e.belt!, li, key(goods[i++ % 4]), p);
  }
  // a block of furnaces with coal to count as machines
  for (let k = 0; k < 160; k++) {
    const x = x0 + (k % 40) * 1.5 | 0, y = y0 + rows * 4 + 1 + Math.floor(k / 40);
    if (!m.inb(x, y)) continue;
    m.setO(x, y, O.NONE); m.zone[m.idx(x, y)] = Z.FARM;
    if (canPlace(g, 'furnace', x, y, 0).ok) {
      const e = place(g, 'furnace', x, y, 0);
      e.mach!.fuel = { k: key('coal'), n: 20 };
      e.mach!.inBuf.set(key('copper_ore'), 6);
      machines++;
    }
  }
  return { belts: g.ents.belts.length, machines: g.ents.machines.length };
}

export function runPerfScene(play: PlayScreen) {
  const res = buildPerfFactory(play.g);
  play.toast(`Perf scene: ${res.belts} belts, ${res.machines} machines.`);
}
