// Farm automation: harvest cranes, seed sowers, ore drills, sap spigots, fish traps, silos.
import { CROP_BY_SEED, CROP_BY_ID } from '../../data/crops';
import { TREE_BY_ID } from '../../data/trees';
import { FISH } from '../../data/fish';
import { ITEM_BY_ID } from '../../data/items';
import { Game, registerSystem } from '../Game';
import { DX, DY, Ent } from '../ents';
import { key, kDef, kStack } from '../inventory';
import { takersOf, worksTally } from '../lines';
import { PORT_HANDLERS, portAccept, portInsert } from '../ports';
import { canPlant, canTill, cropTotal, fertilize, harvest, inGreenhouse, plant, till } from './farming';
import { fuelValue } from './machines';
import { O, T } from '../world/tilemap';
import { MState, offText, setState } from '../mstate';
import { rustTick } from '../rust';
import { dawnOn, fieldHand, fieldIdleText, fieldReach, gantryTick, gleanerTick, pickable } from './fieldworks';
import { ORE_TYPES } from '../world/tilemap';

function area(e: Ent, r: number) {
  const out: [number, number][] = [];
  for (let y = e.y - r; y <= e.y + e.h - 1 + r; y++) for (let x = e.x - r; x <= e.x + e.w - 1 + r; x++) if (!(x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)) out.push([x, y]);
  return out;
}

/**
 * A field machine with nothing ripe in reach is Idle, never Starved (crops grow on their own);
 * its line says when the next crop in reach ripens, counting only watered days.
 */
export function nextRipeText(g: Game, e: Ent, r: number): string {
  let best = Infinity, any = false;
  for (const [x, y] of area(e, r)) {
    if (!g.map.inb(x, y)) continue;
    const s = g.soil.get(g.map.idx(x, y));
    if (!s?.crop || s.crop.dead) continue;
    any = true;
    const cr = CROP_BY_ID.get(s.crop.id);
    if (!cr) continue;
    best = Math.min(best, Math.max(1, cropTotal(cr) - s.crop.days));
  }
  if (!any) return 'No crops in reach: plant around it';
  return best <= 1 ? 'Next ripe crop tomorrow' : `Next ripe crop in ${best} watered days`;
}

function containerState(g: Game, e: Ent) {
  const inv = e.inv!;
  const full = inv.slots.every((s) => s && s.n >= kStack(s.k));
  if (!full) {
    if (e.state !== MState.Idle || e.why) setState(e, MState.Idle, '', g.simTime);
    return;
  }
  if (e.def.kind === 'shipbin') setState(e, MState.Blocked, 'Full: the post comes at noon, 6pm and night', g.simTime);
  else if (takersOf(g, e).some((t) => t.state === MState.Working)) setState(e, MState.Idle, 'Full, and being emptied', g.simTime);
  else setState(e, MState.Blocked, 'Full: nothing takes from it', g.simTime);
}

function harvesterTick(g: Game, e: Ent, dt: number) {
  e.st.anim = Math.max(0, (e.st.anim ?? 0) - dt);
  const now = g.simTime;
  if (e.off) {
    e.working = false;
    setState(e, MState.Idle, offText(e), now);
    return;
  }
  if (e.sat <= 0.01) {
    e.working = false;
    setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
    return;
  }
  e.st.cd -= dt * e.sat * (e.def.speed ?? 1) * g.mods.machineSpeed;
  if (e.st.cd > 0) return;
  e.st.cd = 0.7;
  if (e.inv!.slots.every((s) => s && s.n >= 99)) {
    setState(e, MState.Blocked, 'Hopper full: an arm should empty it', now);
    e.working = false;
    return;
  }
  const m = g.map;
  for (const [x, y] of area(e, fieldReach(g, e))) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    const s = g.soil.get(i);
    if (!pickable(g, s?.crop, dawnOn(g, e))) continue;
    const out = harvest(g, i, g.rng, true);
    if (!out) continue;
    fieldHand(g, e, out);
    // every third pick leaves a little chaff (fiber) in the hopper
    e.st.chaff = (e.st.chaff ?? 0) + 1;
    if (e.st.chaff >= 3) {
      e.st.chaff = 0;
      out.push({ k: key('fiber'), n: 1 });
    }
    for (const st of out) {
      const left = e.inv!.add(st.k, st.n);
      if (left) g.sys.drops?.spawn?.(g, st.k, left, x + 0.5, y + 0.5);
      g.stats.add(st.k, st.n - left);
    }
    e.working = true;
    e.st.anim = 0.5;
    g.stats.states.moved(e, out.reduce((a, s) => a + s.n, 0));
    setState(e, e.sat < 0.25 ? MState.Unpowered : MState.Working, e.sat < 0.25 ? 'Crawling: the grid is short' : 'Harvesting', now);
    g.emit({ t: 'fx', kind: 'leaves', x: x + 0.5, y: y + 0.5, n: 4 });
    return;
  }
  e.working = false;
  setState(e, MState.Idle, fieldIdleText(g, area(e, fieldReach(g, e))), now);
}

function planterTick(g: Game, e: Ent, dt: number) {
  const now = g.simTime;
  if (e.off) {
    e.working = false;
    setState(e, MState.Idle, offText(e), now);
    return;
  }
  if (e.sat <= 0.01) {
    e.working = false;
    setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
    return;
  }
  e.st.cd -= dt * e.sat * (e.def.speed ?? 1) * g.mods.machineSpeed;
  if (e.st.cd > 0) return;
  e.st.cd = 0.9;
  const inv = e.inv!;
  const seeds = inv.slots.filter((s) => s && kDef(s.k).plant?.crop);
  if (!seeds.length) {
    setState(e, MState.Starved, 'Waiting for seeds in its hopper', now);
    e.want = 'seeds';
    e.working = false;
    return;
  }
  const m = g.map;
  for (const [x, y] of area(e, fieldReach(g, e))) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    let s = g.soil.get(i);
    if (!s) {
      if (!canTill(g, x, y)) continue;
      till(g, x, y);
      s = g.soil.get(i)!;
    }
    if (s.crop) continue;
    // fertilize first if there's fertilizer
    if (!s.fert) {
      const f = inv.slots.find((st) => st && kDef(st.k).fertilizer);
      if (f && !fertilize(g, i, kDef(f.k).id)) inv.remove(f.k, 1);
    }
    for (const st of seeds) {
      const cr = CROP_BY_SEED.get(kDef(st!.k).id);
      if (!cr || canPlant(g, cr, i)) continue;
      plant(g, cr, i);
      inv.remove(st!.k, 1);
      g.stats.use(st!.k, 1);
      e.working = true;
      setState(e, MState.Working, 'Sowing', now);
      g.emit({ t: 'fx', kind: 'seed', x: x + 0.5, y: y + 0.5 });
      return;
    }
  }
  e.working = false;
  setState(e, MState.Idle, 'Nothing to sow: every tile is planted, or the seeds are out of season', now);
}

export function drillOutputTile(e: Ent): [number, number] {
  switch (e.rot) {
    case 0: return [e.x, e.y - 1];
    case 1: return [e.x + e.w, e.y];
    case 2: return [e.x + 1, e.y + e.h];
    default: return [e.x - 1, e.y + 1];
  }
}

function drillOre(g: Game, e: Ent): string | null {
  const ores: string[] = [];
  for (let y = e.y; y < e.y + e.h; y++)
    for (let x = e.x; x < e.x + e.w; x++) {
      if (g.map.g(x, y) === T.ORE_VEIN) ores.push(ORE_TYPES[g.map.objData[g.map.idx(x, y)]] ?? 'stone');
    }
  if (!ores.length) return null;
  return ores[g.rng.int(0, ores.length - 1)];
}

function drillTick(g: Game, e: Ent, dt: number) {
  const inv = e.inv!;
  const now = g.simTime;
  const [ox, oy] = drillOutputTile(e);
  // push buffered output first
  const buf = inv.slots[0];
  if (buf) {
    const tgt = g.ents.rootAt(ox, oy);
    if (tgt && !tgt.ghost) {
      const n = portInsert(g, tgt, buf.k, 1, e.rot);
      if (n) {
        buf.n -= n;
        if (buf.n <= 0) inv.slots[0] = null;
      }
    }
    if (inv.slots[0] && inv.slots[0]!.n >= 20) {
      e.working = false;
      setState(e, MState.Blocked, 'Output blocked: nothing takes the ore in front', now);
      return;
    }
  }
  let rate = (e.def.speed ?? 0.5) * g.mods.machineSpeed * (g.hasPerk('geologist') ? 1.25 : 1);
  if (e.def.fuel) {
    if (e.st.burn <= 0) {
      const f = e.st.fuel;
      if (f && f.n > 0) {
        e.st.burn += fuelValue(f.k);
        g.stats.use(f.k, 1);
        f.n--;
        if (f.n <= 0) e.st.fuel = null;
      } else {
        e.working = false;
        setState(e, MState.NeedsFuel, 'Needs fuel: wood or coal', now);
        return;
      }
    }
    e.st.burn -= dt;
  } else {
    if (e.off) {
      e.working = false;
      setState(e, MState.Idle, offText(e), now);
      return;
    }
    rate *= e.sat;
    if (e.sat <= 0.01) {
      e.working = true; // keep demanding
      setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
      return;
    }
  }
  e.working = true;
  setState(e, MState.Working, 'Drilling', now);
  e.st.progress += (dt * rate) / 2;
  if (e.st.progress >= 1) {
    e.st.progress = 0;
    const ore = drillOre(g, e);
    if (!ore) return;
    const k = key(ore);
    g.stats.add(k, 1);
    g.stats.states.moved(e, 1);
    const tgt = g.ents.rootAt(ox, oy);
    if (tgt && !tgt.ghost && portAccept(g, tgt, k, e.rot) > 0 && portInsert(g, tgt, k, 1, e.rot)) return;
    inv.add(k, 1);
  }
}

function tapperTick(g: Game, e: Ent, dt: number) {
  const tr = g.map.trees.get(e.st.tree ?? g.map.idx(e.x, e.y));
  const def = tr ? TREE_BY_ID.get(tr.species) : null;
  if (!def?.tap || (tr && tr.stage < 4)) {
    setState(e, MState.Idle, 'Needs a mature tree that gives sap', g.simTime);
    return;
  }
  if (e.inv!.count(key(def.tap)) >= 5) {
    setState(e, MState.Blocked, 'Full: take the sap', g.simTime);
    return;
  }
  setState(e, MState.Working, 'Dripping', g.simTime);
  e.st.progress += dt / (g.time.season === 3 ? 400 : 240);
  if (e.st.progress >= 1) {
    e.st.progress = 0;
    e.inv!.add(key(def.tap), 1);
    g.stats.add(key(def.tap), 1);
  }
}

function trapDay(g: Game, e: Ent) {
  if (!e.st.bait) return;
  const m = g.map;
  const gr = m.g(e.x, e.y);
  const ocean = gr === T.OCEAN || gr === T.DEEP;
  const pool = FISH.filter((f) => f.trap && (ocean ? f.where.includes('ocean') : !f.where.includes('ocean') || f.where.length > 1)).filter((f) => ocean === f.where.includes('ocean'));
  const n = (e.st.bait >= 2 ? 2 : 1) + (g.hasPerk('trapper') ? 1 : 0);
  for (let i = 0; i < n; i++) {
    if (g.rng.next() < 0.1) e.inv!.add(key(g.rng.pick(['old_boot', 'tin_can', 'driftwood', 'kelp'])), 1);
    else {
      const f = g.rng.pick(pool.length ? pool : FISH.filter((x) => x.trap));
      e.inv!.add(key(f.id), 1);
      g.stats.add(key(f.id), 1);
    }
  }
  e.st.bait = 0;
}

registerSystem({
  name: 'automation',
  works: true,
  tick(g, dt) {
    // chests and crates: Blocked only when full and nothing is emptying them (ROADMAP.md 4.2)
    if (g.tickN % 30 === 0) for (const e of g.ents.others) if (!e.ghost && e.inv && (e.def.kind === 'chest' || e.def.kind === 'shipbin')) containerState(g, e);
    for (const e of g.ents.others) {
      if (e.ghost || rustTick(e, g.simTime)) continue;
      switch (e.def.kind) {
        case 'harvester': harvesterTick(g, e, dt); break;
        case 'planter': planterTick(g, e, dt); break;
        case 'drill': drillTick(g, e, dt); break;
        case 'tapper': tapperTick(g, e, dt); break;
        case 'gleaner': gleanerTick(g, e, dt); break;
        case 'gantry': gantryTick(g, e, dt); break;
      }
    }
  },
  dayStart(g) {
    // the night tally's bottleneck line (src/sim/lines.ts), reached through a hook to keep Game.ts free of lines
    g.sys.worksTally = worksTally;
  },
  dayEnd(g) {
    for (const e of g.ents.others) if (e.def.kind === 'fishtrap' && !e.ghost) trapDay(g, e);
  },
});

// ---------------- ports ----------------
PORT_HANDLERS.planter = {
  uses: (_g, _e, k) => !!kDef(k).plant?.crop || !!kDef(k).fertilizer,
  accept: (_g, e, k) => {
    const d = kDef(k);
    if (!d.plant?.crop && !d.fertilizer) return 0;
    return Math.min(40, e.inv!.space(k));
  },
  insert: (_g, e, k, n) => {
    const d = kDef(k);
    if (!d.plant?.crop && !d.fertilizer) return 0;
    const can = Math.min(n, e.inv!.space(k), Math.max(0, 99 - e.inv!.count(k)));
    e.inv!.add(k, can);
    return can;
  },
};
PORT_HANDLERS.fishtrap = {
  uses: (_g, _e, k) => kDef(k).cat === 'bait',
  accept: (_g, e, k) => (kDef(k).cat === 'bait' && !e.st.bait ? 1 : 0),
  insert: (_g, e, k, n) => {
    if (kDef(k).cat !== 'bait' || e.st.bait || n < 1) return 0;
    e.st.bait = kDef(k).id === 'deluxe_bait' ? 2 : 1;
    return 1;
  },
};
PORT_HANDLERS.tapper = { accept: () => 0, uses: () => false };
PORT_HANDLERS.harvester = { accept: () => 0, uses: () => false };

// silo is a hay store shared across all silos
export function hayCap(g: Game) {
  return g.ents.others.filter((e) => e.def.id === 'silo' && !e.ghost).length * 240;
}
export const siloPort = {
  accept: (g: Game, _e: Ent, k: number) => (kDef(k).id === 'hay' || kDef(k).id === 'straw' ? Math.max(0, hayCap(g) - (g.sys.hay ?? 0)) : 0),
  insert: (g: Game, e: Ent, k: number, n: number) => {
    const can = Math.min(n, siloPort.accept(g, e, k));
    g.sys.hay = (g.sys.hay ?? 0) + can;
    return can;
  },
  take: (g: Game, _e: Ent, pred: (k: number) => boolean, max: any) => {
    const k = key('hay');
    if (!pred(k) || (g.sys.hay ?? 0) <= 0) return null;
    const m = typeof max === 'number' ? max : max(k);
    const n = Math.min(m, g.sys.hay);
    g.sys.hay -= n;
    return { k, n };
  },
};

export { CROP_BY_ID, inGreenhouse, O, DX, DY, ITEM_BY_ID };
