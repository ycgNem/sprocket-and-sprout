// Farm automation: harvest cranes, seed sowers, ore drills, sap spigots, fish traps, silos.
import { CROP_BY_SEED, CROP_BY_ID } from '../../data/crops';
import { TREE_BY_ID } from '../../data/trees';
import { FISH } from '../../data/fish';
import { ITEM_BY_ID } from '../../data/items';
import { Game, registerSystem } from '../Game';
import { DX, DY, Ent } from '../ents';
import { key, kDef } from '../inventory';
import { PORT_HANDLERS, portAccept, portInsert } from '../ports';
import { canPlant, canTill, fertilize, harvest, inGreenhouse, plant, till } from './farming';
import { fuelValue } from './machines';
import { O, T } from '../world/tilemap';
import { ORE_TYPES } from '../world/tilemap';

function area(e: Ent, r: number) {
  const out: [number, number][] = [];
  for (let y = e.y - r; y <= e.y + e.h - 1 + r; y++) for (let x = e.x - r; x <= e.x + e.w - 1 + r; x++) if (!(x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)) out.push([x, y]);
  return out;
}

function harvesterTick(g: Game, e: Ent, dt: number) {
  e.st.anim = Math.max(0, (e.st.anim ?? 0) - dt);
  if (e.sat <= 0.01) {
    e.working = false;
    e.st.status = e.net ? 'Not enough power' : 'No power';
    return;
  }
  e.st.cd -= dt * e.sat * (e.def.speed ?? 1) * g.mods.machineSpeed;
  if (e.st.cd > 0) return;
  e.st.cd = 0.7;
  if (e.inv!.slots.every((s) => s && s.n >= 99)) {
    e.st.status = 'Hopper full';
    e.working = false;
    return;
  }
  const m = g.map;
  for (const [x, y] of area(e, e.def.reach ?? 3)) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    const s = g.soil.get(i);
    if (!s?.crop?.ready || s.crop.giant >= 0) continue;
    const out = harvest(g, i, g.rng, true);
    if (!out) continue;
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
    e.st.status = 'Harvesting';
    g.emit({ t: 'fx', kind: 'leaves', x: x + 0.5, y: y + 0.5, n: 4 });
    return;
  }
  e.working = false;
  e.st.status = 'Waiting for ripe crops';
}

function planterTick(g: Game, e: Ent, dt: number) {
  if (e.sat <= 0.01) {
    e.working = false;
    e.st.status = e.net ? 'Not enough power' : 'No power';
    return;
  }
  e.st.cd -= dt * e.sat * (e.def.speed ?? 1) * g.mods.machineSpeed;
  if (e.st.cd > 0) return;
  e.st.cd = 0.9;
  const inv = e.inv!;
  const seeds = inv.slots.filter((s) => s && kDef(s.k).plant?.crop);
  if (!seeds.length) {
    e.st.status = 'Hopper needs seeds';
    e.working = false;
    return;
  }
  const m = g.map;
  for (const [x, y] of area(e, e.def.reach ?? 3)) {
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
      e.st.status = 'Sowing';
      g.emit({ t: 'fx', kind: 'seed', x: x + 0.5, y: y + 0.5 });
      return;
    }
  }
  e.working = false;
  e.st.status = seeds.length ? 'Nothing to sow (wrong season or no space)' : 'Hopper needs seeds';
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
      e.st.status = 'Output blocked';
      return;
    }
  }
  let rate = (e.def.speed ?? 0.5) * g.mods.machineSpeed;
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
        e.st.status = 'Needs fuel';
        return;
      }
    }
    e.st.burn -= dt;
  } else {
    rate *= e.sat;
    if (e.sat <= 0.01) {
      e.working = true; // keep demanding
      e.st.status = e.net ? 'Not enough power' : 'No power';
      return;
    }
  }
  e.working = true;
  e.st.status = 'Drilling';
  e.st.progress += (dt * rate) / 2;
  if (e.st.progress >= 1) {
    e.st.progress = 0;
    const ore = drillOre(g, e);
    if (!ore) return;
    const k = key(ore);
    g.stats.add(k, 1);
    const tgt = g.ents.rootAt(ox, oy);
    if (tgt && !tgt.ghost && portAccept(g, tgt, k, e.rot) > 0 && portInsert(g, tgt, k, 1, e.rot)) return;
    inv.add(k, 1);
  }
}

function tapperTick(g: Game, e: Ent, dt: number) {
  const tr = g.map.trees.get(e.st.tree ?? g.map.idx(e.x, e.y));
  const def = tr ? TREE_BY_ID.get(tr.species) : null;
  if (!def?.tap || (tr && tr.stage < 4)) {
    e.st.status = 'Needs a mature tree that gives sap';
    return;
  }
  if (e.inv!.count(key(def.tap)) >= 5) {
    e.st.status = 'Full';
    return;
  }
  e.st.status = 'Dripping';
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
  tick(g, dt) {
    for (const e of g.ents.others) {
      if (e.ghost) continue;
      switch (e.def.kind) {
        case 'harvester': harvesterTick(g, e, dt); break;
        case 'planter': planterTick(g, e, dt); break;
        case 'drill': drillTick(g, e, dt); break;
        case 'tapper': tapperTick(g, e, dt); break;
      }
    }
  },
  dayEnd(g) {
    for (const e of g.ents.others) if (e.def.kind === 'fishtrap' && !e.ghost) trapDay(g, e);
  },
});

// ---------------- ports ----------------
PORT_HANDLERS.planter = {
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
  accept: (_g, e, k) => (kDef(k).cat === 'bait' && !e.st.bait ? 1 : 0),
  insert: (_g, e, k, n) => {
    if (kDef(k).cat !== 'bait' || e.st.bait || n < 1) return 0;
    e.st.bait = kDef(k).id === 'deluxe_bait' ? 2 : 1;
    return 1;
  },
};
PORT_HANDLERS.tapper = { accept: () => 0 };
PORT_HANDLERS.harvester = { accept: () => 0 };

// silo is a hay store shared across all silos
export function hayCap(g: Game) {
  return g.ents.others.filter((e) => e.def.id === 'silo' && !e.ghost).length * 240;
}
export const siloPort = {
  accept: (g: Game, _e: Ent, k: number) => (kDef(k).id === 'hay' ? Math.max(0, hayCap(g) - (g.sys.hay ?? 0)) : 0),
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
