// Farming: soil, watering, crop growth, quality, regrowth, giant crops, trees, forage.
import { CROPS, CROP_BY_ID } from '../../data/crops';
import { TREE_BY_ID } from '../../data/trees';
import { ITEM_BY_ID } from '../../data/items';
import type { CropDef, Season } from '../../data/types';
import { Rng } from '../../engine/rng';
import { Game, registerSystem, Soil } from '../Game';
import { key } from '../inventory';
import { O, T, Z } from '../world/tilemap';
import { plantTree, spawnArtifact } from '../world/worldgen';
import { openingTile } from '../opening';
import { noteHandPick } from '../lines';

export const TILLABLE = new Set([T.GRASS, T.DIRT, T.TOWNGRASS]);

export function cropTotal(cr: CropDef) {
  return cr.stages.reduce((a, b) => a + b, 0);
}

export function stageOf(cr: CropDef, days: number): number {
  let acc = 0;
  for (let i = 0; i < cr.stages.length; i++) {
    acc += cr.stages[i];
    if (days < acc) return i;
  }
  return cr.stages.length;
}

/**
 * Under working glass: year-round crops, no rain. The derelict greenhouse (roof broken) is an
 * ordinary seasonal plot you can already farm; restoring it is the upgrade, not the unlock.
 */
export function inGreenhouse(g: Game, i: number) {
  return g.map.zone[i] === Z.GREENHOUSE && g.flags.has('greenhouse_fixed');
}

export function canTill(g: Game, x: number, y: number): boolean {
  const m = g.map;
  if (g.player.where !== 'world' || !m.inb(x, y)) return false;
  const pb = g.sys.pet?.stage === 'adopted' ? g.sys.pet.bowl : null;
  if (pb && pb[0] === x && pb[1] === y) return false;
  const i = m.idx(x, y);
  const z = m.zone[i];
  if (z !== Z.FARM && z !== Z.GREENHOUSE) return false;
  if (!TILLABLE.has(m.ground[i])) return false;
  const o = m.obj[i];
  if (o !== O.NONE && o !== O.TALLGRASS && o !== O.FLOWER) return false;
  if (m.buildingAt[i] || g.ents.at(x, y)) return false;
  return !g.soil.has(i);
}

export function till(g: Game, x: number, y: number): boolean {
  if (!canTill(g, x, y)) return false;
  const i = g.map.idx(x, y);
  if (g.map.obj[i]) g.map.setO(x, y, O.NONE);
  g.soil.set(i, { water: g.isRaining() && !inGreenhouse(g, i), fert: null, crop: null, idle: 0 });
  if (g.map.ground[i] !== T.DIRT) g.map.setG(x, y, T.DIRT);
  g.count('tilled');
  g.sys.quests?.notify?.(g, 'till', 1);
  return true;
}

export function waterTile(g: Game, x: number, y: number): boolean {
  const s = g.soil.get(g.map.idx(x, y));
  if (!s || s.water) return false;
  s.water = true;
  g.sys.quests?.notify?.(g, 'water', 1);
  g.emit({ t: 'hop', tile: g.map.idx(x, y) });
  return true;
}

/** Hand harvests less than 2 s apart build a streak; every 10th pick in a streak gives a bonus crop. */
export function harvestStreak(g: Game): { n: number; bonus: boolean } {
  const s = (g.sys.streak ??= { n: 0, last: -9999 }) as { n: number; last: number };
  s.n = g.tickN - s.last <= 120 ? s.n + 1 : 1;
  s.last = g.tickN;
  if (s.n > (g.counters.best_streak ?? 0)) g.counters.best_streak = s.n;
  return { n: s.n, bonus: s.n % 10 === 0 };
}

export function canPlant(g: Game, cr: CropDef, i: number): string | null {
  const s = g.soil.get(i);
  if (!s) return 'Till the soil first';
  if (s.crop) return 'Something is already planted';
  if (!cr.seasons.includes(g.time.season) && !inGreenhouse(g, i) && !g.sys.megaBonus?.beacon) return `${cr.name} won't grow in ${['spring', 'summer', 'fall', 'winter'][g.time.season]}`;
  return null;
}

export function plant(g: Game, cr: CropDef, i: number): boolean {
  if (canPlant(g, cr, i)) return false;
  const s = g.soil.get(i)!;
  s.crop = { id: cr.id, days: 0, stage: 0, ready: false, harvests: 0, dead: false, giant: -1, frac: 0 };
  s.idle = 0;
  g.sys.quests?.notify?.(g, 'plant', 1);
  g.emit({ t: 'hop', tile: i });
  return true;
}

export function fertilize(g: Game, i: number, id: string): string | null {
  const s = g.soil.get(i);
  if (!s) return 'Till the soil first';
  if (s.fert) return 'Already fertilized';
  const f = ITEM_BY_ID.get(id)?.fertilizer;
  if (!f) return 'Not a fertilizer';
  if (f.quality && s.crop && s.crop.days > 0) return 'Quality fertilizer must go in before the crop grows';
  s.fert = id;
  return null;
}

/** Roll the quality of a harvested crop. */
export function rollQuality(g: Game, s: Soil, rng: Rng): number {
  const lvl = g.player.skills.farming ?? 0;
  const fq = (s.fert && ITEM_BY_ID.get(s.fert)?.fertilizer?.quality) || 0;
  const gold = 0.2 * (lvl / 10) + 0.2 * fq * ((lvl + 2) / 12) + 0.01 + g.buffLvl('farming') * 0.03 + g.buffLvl('luck') * 0.04;
  const star = fq >= 2 ? gold / 3 : 0;
  const r = rng.next();
  if (r < star) return 3;
  if (r < gold) return 2;
  if (r < Math.min(0.75, gold * 2 + 0.05 + lvl * 0.01)) return 1;
  return 0;
}

/** Harvest a ripe crop. Returns item stacks (key, n). Leaves regrowing plants. */
/** `machine`: picked by a harvest crane, capped at silver quality and worth no farming XP */
export function harvest(g: Game, i: number, rng = g.rng, machine = false): { k: number; n: number }[] | null {
  const s = g.soil.get(i);
  if (!s?.crop) return null;
  const c = s.crop;
  if (c.dead) {
    s.crop = null;
    return [];
  }
  if (!c.ready) return null;
  const cr = CROP_BY_ID.get(c.id)!;
  const out: { k: number; n: number }[] = [];
  if (c.giant >= 0) {
    // giant crop yields big pile; clear all 9 tiles
    const gx = c.giant % g.map.w, gy = Math.floor(c.giant / g.map.w);
    for (let y = gy; y < gy + 3; y++) for (let x = gx; x < gx + 3; x++) {
      const ss = g.soil.get(g.map.idx(x, y));
      if (ss) ss.crop = null;
    }
    out.push({ k: key(cr.produce, 1 + (rng.next() < 0.5 ? 1 : 0)), n: 15 + rng.int(0, 6) });
    g.count('harvested', out[0].n);
    g.count('h_' + cr.id);
    g.count('harvest_s' + g.time.season);
    return out;
  }
  const [lo, hi] = cr.yield ?? [1, 1];
  let n = rng.int(lo, hi);
  if (rng.next() < 0.02 * (g.player.skills.farming ?? 0)) n++;
  const q = machine ? Math.min(1, rollQuality(g, s, rng)) : rollQuality(g, s, rng);
  out.push({ k: key(cr.produce, q), n: 1 });
  if (n > 1) out.push({ k: key(cr.produce, 0), n: n - 1 });
  // sunflowers drop a few of their own seeds
  if (cr.id === 'sunflower') out.push({ k: key('sunflower_seed'), n: rng.int(1, 2) });
  c.harvests++;
  if (cr.regrow) {
    c.ready = false;
    c.days = cropTotal(cr) - cr.regrow;
    c.stage = stageOf(cr, c.days);
  } else {
    s.crop = null;
    // quality fertilizer is used up; speed/retain persists like soil amendments
    if (s.fert && ITEM_BY_ID.get(s.fert)?.fertilizer?.quality) s.fert = null;
  }
  if (!machine) {
    g.addXp('farming', Math.max(2, Math.round(Math.sqrt(cr.price) * 0.9)));
    noteHandPick(g, i, out.reduce((a, s) => a + s.n, 0));
  } else g.count('crane_harvests');
  g.count('harvested', n);
  g.count('h_' + cr.id);
  g.count('harvest_s' + g.time.season);
  if (q === 3) g.count('harvest_star');
  g.sys.quests?.notify?.(g, 'harvest', n, cr.produce);
  return out;
}

function growDay(g: Game, i: number, s: Soil) {
  const c = s.crop;
  if (!c || c.dead || c.ready) return;
  const cr = CROP_BY_ID.get(c.id);
  if (!cr) return;
  if (!s.water) return;
  const sp = (s.fert && ITEM_BY_ID.get(s.fert)?.fertilizer?.speed) || 0;
  c.frac += 1 + sp + (g.player.skills.farming >= 6 ? 0.1 : 0) + (g.hasPerk('agriculturist') ? 0.1 : 0);
  while (c.frac >= 1) {
    c.frac -= 1;
    c.days++;
  }
  c.stage = stageOf(cr, c.days);
  if (c.days >= cropTotal(cr)) {
    c.ready = true;
    c.ripeDay = g.dayIndex;
    c.stage = cr.stages.length;
  }
}

function tryGiant(g: Game) {
  const m = g.map;
  for (const [i, s] of g.soil) {
    const c = s.crop;
    if (!c?.ready || c.giant >= 0) continue;
    const cr = CROP_BY_ID.get(c.id);
    if (!cr?.giant) continue;
    const x = i % m.w, y = Math.floor(i / m.w);
    // i is the top-left of a candidate 3x3
    let ok = true;
    for (let yy = y; yy < y + 3 && ok; yy++)
      for (let xx = x; xx < x + 3 && ok; xx++) {
        const ss = g.soil.get(m.idx(xx, yy));
        if (!ss?.crop || ss.crop.id !== c.id || !ss.crop.ready || ss.crop.giant >= 0) ok = false;
      }
    if (!ok || g.rng.next() > 0.05) continue;
    for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) g.soil.get(m.idx(xx, yy))!.crop!.giant = i;
    g.toast(`A giant ${cr.name.toLowerCase()} grew overnight!`);
    g.count('giant');
  }
}

export function sprinklerTiles(reach: number, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  if (reach === 0) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.push([x + dx, y + dy]);
  } else {
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (dx || dy) out.push([x + dx, y + dy]);
  }
  return out;
}

export function morningWater(g: Game) {
  const m = g.map;
  // rain waters everything outdoors
  if (g.isRaining()) for (const [i, s] of g.soil) if (!inGreenhouse(g, i)) s.water = true;
  // sprinklers
  for (const e of g.ents.others) {
    if (e.def.kind !== 'sprinkler' || e.def.powerUse) continue;
    for (const [x, y] of sprinklerTiles((e.def.reach ?? 0) + (g.sys.megaBonus?.beacon ? 1 : 0), e.x, e.y)) {
      if (!m.inb(x, y)) continue;
      const s = g.soil.get(m.idx(x, y));
      if (s) s.water = true;
    }
  }
}

function seasonChange(g: Game, newSeason: Season) {
  if (g.sys.megaBonus?.beacon) return;
  for (const [i, s] of g.soil) {
    if (!s.crop || inGreenhouse(g, i)) continue;
    const cr = CROP_BY_ID.get(s.crop.id);
    // cozy and sandbox crops keep growing through the change of season
    if (cr && !cr.seasons.includes(newSeason) && g.mode !== 'cozy' && g.mode !== 'sandbox') s.crop.dead = true;
  }
}

function crows(g: Game) {
  if (g.dayIndex < 5) return;
  const m = g.map;
  const scare = g.ents.others.filter((e) => e.def.kind === 'scarecrow');
  const unprotected: number[] = [];
  for (const [i, s] of g.soil) {
    if (!s.crop || s.crop.dead || inGreenhouse(g, i)) continue;
    const x = i % m.w, y = Math.floor(i / m.w);
    if (scare.some((e) => Math.hypot(e.x - x, e.y - y) <= (e.def.reach ?? 8))) continue;
    unprotected.push(i);
  }
  const attacks = Math.floor(unprotected.length / 20);
  let eaten = 0;
  for (let k = 0; k < attacks; k++) {
    if (g.rng.next() > 0.4) continue;
    const i = g.rng.pick(unprotected);
    const s = g.soil.get(i);
    if (s?.crop && !s.crop.dead) {
      s.crop = null;
      eaten++;
    }
  }
  if (eaten) g.toast(`Crows nibbled ${eaten} crop${eaten > 1 ? 's' : ''} overnight. A scarecrow would help!`);
}

const FORAGE: Record<number, string[]> = {
  0: ['wild_garlic', 'morel', 'meadow_daisy', 'field_mushroom'],
  1: ['raspberry', 'elderflower', 'sea_fennel'],
  2: ['chestnut', 'chanterelle', 'rosehip', 'field_mushroom'],
  3: ['holly', 'snow_lichen', 'ice_crocus'],
};
const BEACH = ['seashell', 'coral', 'sea_glass', 'kelp', 'seashell'];

function spawnForage(g: Game) {
  const m = g.map;
  let count = 0;
  for (const [, id] of m.forage) if (id) count++;
  const want = 60;
  for (let n = 0; n < 30 && count < want; n++) {
    const x = g.rng.int(1, m.w - 2), y = g.rng.int(14, m.h - 14);
    const i = m.idx(x, y);
    if (m.obj[i] || m.buildingAt[i] || g.ents.at(x, y)) continue;
    const z = m.zone[i], gr = m.ground[i];
    let id: string | null = null;
    if (gr === T.SAND && z === Z.BEACH) id = g.rng.pick(BEACH);
    else if ((z === Z.FOREST || z === Z.WILD) && gr === T.GRASS) id = g.rng.pick(FORAGE[g.time.season]);
    else if (z === Z.TOWN && gr === T.TOWNGRASS && g.rng.next() < 0.2) id = g.rng.pick(FORAGE[g.time.season]);
    if (!id) continue;
    m.setO(x, y, O.FORAGE);
    m.forage.set(i, id);
    count++;
  }
}

function farmDebris(g: Game) {
  // a little regrowth of weeds on untended farmland keeps chores cozy
  if (g.time.season === 3) return;
  const m = g.map;
  for (let n = 0; n < 6; n++) {
    const x = g.rng.int(23, 92), y = g.rng.int(17, 97);
    const i = m.idx(x, y);
    if (m.zone[i] !== Z.FARM || m.obj[i] || g.soil.has(i) || g.ents.at(x, y) || m.ground[i] !== T.GRASS || openingTile(g, x, y)) continue;
    m.setO(x, y, n % 3 === 0 ? O.TALLGRASS : O.WEED, n % 3);
  }
  // quarry rocks respawn
  let placed = 0;
  for (let n = 0; n < 40 && placed < 8; n++) {
    const x = g.rng.int(173, 195), y = g.rng.int(7, 49);
    const i = m.idx(x, y);
    if (m.ground[i] !== T.ROCK || m.obj[i] || g.ents.at(x, y)) continue;
    const r = g.rng.next();
    m.setO(x, y, r < 0.6 ? O.ROCK : O.ORE_ROCK, r < 0.6 ? 0 : [0, 1, 2, 4, 0, 1][g.rng.int(0, 5)]);
    placed++;
  }
}

function treesDay(g: Game) {
  const m = g.map;
  const season = g.time.season;
  for (const [i, t] of m.trees) {
    const def = TREE_BY_ID.get(t.species);
    if (!def) continue;
    if (t.stage < 4) {
      if (season === 3 && def.wild && t.species !== 'pine') continue;
      t.days++;
      const per = Math.max(1, Math.round(def.grow / 4));
      if (t.days >= per) {
        t.days = 0;
        t.stage++;
        m.markDirty(i % m.w, Math.floor(i / m.w));
      }
    } else {
      t.days++;
    }
    if (t.stage < 4) continue;
    if (def.fruit && (def.season === season || inGreenhouse(g, i))) {
      if (t.fruit < 3) t.fruit++;
    } else if (def.fruit && def.season !== season) t.fruit = 0;
  }
}

export function shakeTree(g: Game, i: number): { k: number; n: number }[] {
  const t = g.map.trees.get(i);
  if (!t || t.stage < 4) return [];
  const def = TREE_BY_ID.get(t.species);
  const out: { k: number; n: number }[] = [];
  if (def?.fruit && t.fruit > 0) {
    const q = t.days > 112 ? 2 : t.days > 56 ? 1 : 0;
    out.push({ k: key(def.fruit, q), n: t.fruit });
    t.fruit = 0;
  } else if (def?.wild && g.rng.next() < 0.1) {
    out.push({ k: key(def.sapling), n: 1 });
  }
  return out;
}

export function plantSapling(g: Game, x: number, y: number, treeId: string): string | null {
  const m = g.map;
  if (!m.inb(x, y)) return 'No room';
  const i = m.idx(x, y);
  const z = m.zone[i];
  if (z !== Z.FARM && z !== Z.GREENHOUSE) return 'Plant trees on your farm';
  if (!TILLABLE.has(m.ground[i]) || m.obj[i] || g.ents.at(x, y) || m.buildingAt[i]) return 'Clear the ground first';
  const def = TREE_BY_ID.get(treeId)!;
  if (!def.wild) {
    for (let yy = y - 1; yy <= y + 1; yy++)
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx === x && yy === y) continue;
        if (m.o(xx, yy) === O.TREE || g.ents.at(xx, yy)) return 'Fruit trees need open space around them';
      }
  }
  g.soil.delete(i);
  plantTree(m, x, y, treeId, 0);
  m.markDirty(x, y);
  return null;
}

registerSystem({
  name: 'farming',
  dayEnd(g) {
    // grow
    for (const [i, s] of g.soil) {
      growDay(g, i, s);
      // dry out
      const retain = (s.fert && ITEM_BY_ID.get(s.fert)?.fertilizer?.retain) || 0;
      if (s.water && retain > 0 && g.rng.next() < retain) s.water = true;
      else s.water = false;
      if (!s.crop) {
        s.idle++;
        if (s.idle > 3 && !inGreenhouse(g, i) && g.rng.next() < 0.25 && !s.fert) g.soil.delete(i);
      }
    }
    tryGiant(g);
    treesDay(g);
    const nextDay = g.time.day + 1;
    if (nextDay > 28) seasonChange(g, ((g.time.season + 1) % 4) as Season);
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    morningWater(g);
    crows(g);
    spawnForage(g);
    farmDebris(g);
    if (g.rng.next() < 0.6) spawnArtifact(g.map, g.rng);
  },
  tick(g, dt) {
    // powered mist towers keep their area wet
    if (g.tickN % 30 !== 0) return;
    for (const e of g.ents.consumers) {
      if (e.def.id !== 'mist_tower') continue;
      e.working = true;
      if (e.sat < 0.5) continue;
      for (const [x, y] of sprinklerTiles(e.def.reach ?? 4, e.x, e.y)) {
        if (!g.map.inb(x, y)) continue;
        const s = g.soil.get(g.map.idx(x, y));
        if (s) s.water = true;
      }
    }
    // tree shake timers for the renderer: 4 -> 0 in half a second (src/render/shake.ts eases it)
    const ts: Map<number, number> | undefined = g.sys.treeShake;
    if (ts) for (const [k, v] of ts) { if (v - dt * 8 <= 0) ts.delete(k); else ts.set(k, v - dt * 8); }
    // and the wobble of a structure struck by a tool (actions.ts hitStructure), keyed by entity id
    const ss: Map<number, number> | undefined = g.sys.structShake;
    if (ss) for (const [k, v] of ss) { if (v - dt * 8 <= 0) ss.delete(k); else ss.set(k, v - dt * 8); }
  },
});

export { CROPS };
