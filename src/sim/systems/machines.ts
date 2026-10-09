// Processing machines: input buffers, recipe selection, fuel, power-scaled progress.
import { recipesForStation } from '../../data/recipes';
import type { RecipeDef } from '../../data/types';
import type { Game } from '../Game';
import type { Ent, MachC } from '../ents';
import { ItemKey, kDef, kMatches, key, kStack, Stack } from '../inventory';

const OUT_CAP = 60;
const FUEL_CAP = 20;

const stationCache = new Map<string, RecipeDef[]>();
export function stationRecipes(station: string): RecipeDef[] {
  let r = stationCache.get(station);
  if (!r) {
    r = recipesForStation(station);
    stationCache.set(station, r);
  }
  return r;
}

export function fuelValue(k: ItemKey): number {
  return kDef(k).fuel ?? 0;
}

function specMatch(k: ItemKey, spec: string) {
  return kMatches(k, spec);
}

/** Recipes this machine may run right now (respecting lock + research). */
export function availableRecipes(g: Game, e: Ent): RecipeDef[] {
  const m = e.mach!;
  if (m.locked && m.recipe) return [m.recipe];
  return stationRecipes(m.station).filter((r) => g.unlocked(r.unlock) && (r.in.length <= 1 || e.def.kind === 'beehouse'));
}

function bufCountSpec(m: MachC, spec: string): number {
  let c = 0;
  for (const [k, n] of m.inBuf) if (specMatch(k, spec)) c += n;
  return c;
}

/** How many of item k this machine will accept (0 = refuse). */
export function machAccept(g: Game, e: Ent, k: ItemKey, manual = false): number {
  const m = e.mach!;
  if (e.def.kind === 'beehouse') return 0;
  // fuel
  if (e.def.fuel && fuelValue(k) > 0) {
    const isIngredient = availableRecipes(g, e).some((r) => r.in.some((i) => specMatch(k, i.item)));
    if (!isIngredient) {
      if (m.fuel && m.fuel.k !== k) return 0;
      return Math.max(0, (manual ? kStack(k) : FUEL_CAP) - (m.fuel?.n ?? 0));
    }
  }
  const recipes = availableRecipes(g, e);
  let best = 0;
  // in auto mode keep at most 2 distinct inputs buffered
  if (!m.locked && m.inBuf.size >= 2 && !m.inBuf.has(k)) return 0;
  for (const r of recipes) {
    for (const i of r.in) {
      if (!specMatch(k, i.item)) continue;
      const cap = i.n * (manual ? 10 : 2);
      const cur = bufCountSpec(m, i.item);
      best = Math.max(best, cap - cur);
    }
  }
  return Math.max(0, best);
}

export function machInsert(g: Game, e: Ent, k: ItemKey, n: number, manual = false): number {
  const m = e.mach!;
  const can = Math.min(n, machAccept(g, e, k, manual));
  if (can <= 0) return 0;
  if (e.def.fuel && fuelValue(k) > 0 && !availableRecipes(g, e).some((r) => r.in.some((i) => specMatch(k, i.item)))) {
    if (!m.fuel) m.fuel = { k, n: 0 };
    m.fuel.n += can;
    return can;
  }
  m.inBuf.set(k, (m.inBuf.get(k) ?? 0) + can);
  return can;
}

/** Take output items (arms / player). */
export function machTake(e: Ent, pred: (k: ItemKey) => boolean, max: number | ((k: ItemKey) => number)): Stack | null {
  const m = e.mach!;
  for (let i = 0; i < m.outBuf.length; i++) {
    const s = m.outBuf[i];
    if (!pred(s.k)) continue;
    const n = Math.min(typeof max === "number" ? max : max(s.k), s.n);
    if (n <= 0) continue;
    s.n -= n;
    if (s.n <= 0) m.outBuf.splice(i, 1);
    return { k: s.k, n };
  }
  return null;
}

function outCount(m: MachC) {
  let c = 0;
  for (const s of m.outBuf) c += s.n;
  return c;
}

function canCraft(m: MachC, r: RecipeDef): boolean {
  // greedy spec matching on a copy of the buffer
  const tmp = new Map(m.inBuf);
  for (const inp of r.in) {
    let need = inp.n;
    for (const [k, n] of tmp) {
      if (need <= 0) break;
      if (!specMatch(k, inp.item)) continue;
      const t = Math.min(n, need);
      tmp.set(k, n - t);
      need -= t;
    }
    if (need > 0) return false;
  }
  return true;
}

function consume(g: Game, m: MachC, r: RecipeDef) {
  let q = 0;
  for (const inp of r.in) {
    let need = inp.n;
    for (const [k, n] of m.inBuf) {
      if (need <= 0) break;
      if (!specMatch(k, inp.item)) continue;
      const t = Math.min(n, need);
      if (n - t <= 0) m.inBuf.delete(k);
      else m.inBuf.set(k, n - t);
      need -= t;
      q = Math.max(q, k & 3);
      g.stats.use(k, t);
    }
  }
  m.q = q;
}

export function pickRecipe(g: Game, e: Ent): RecipeDef | null {
  const m = e.mach!;
  if (m.locked) return m.recipe && canCraft(m, m.recipe) ? m.recipe : null;
  for (const r of availableRecipes(g, e)) if (canCraft(m, r)) return r;
  return null;
}

export function updateMachines(g: Game, dt: number) {
  const speedMod = g.mods.machineSpeed + (g.sys.megaBonus?.machine ?? 0) + (g.hasPerk('engineer') ? 0.1 : 0) + (g.hasPerk('industrialist') ? 0.15 : 0);
  for (const e of g.ents.machines) {
    const m = e.mach!;
    if (e.def.kind === 'beehouse') {
      updateBees(g, e, dt);
      continue;
    }
    if (!m.crafting) {
      if (outCount(m) >= OUT_CAP) {
        m.status = 'Output full';
        e.working = false;
        continue;
      }
      const r = pickRecipe(g, e);
      if (!r) {
        m.status = m.locked || availableRecipes(g, e).length ? (m.inBuf.size ? 'Missing ingredients' : 'Waiting for input') : 'Pick a recipe';
        e.working = false;
        continue;
      }
      if (e.def.fuel && m.burn <= 0 && !m.fuel) {
        m.status = 'Needs fuel';
        e.working = false;
        continue;
      }
      consume(g, m, r);
      m.recipe = r;
      m.crafting = true;
      m.progress = 0;
    }
    const r = m.recipe!;
    // fuel
    if (e.def.fuel && m.burn <= 0) {
      if (m.fuel && m.fuel.n > 0) {
        m.burn += fuelValue(m.fuel.k);
        g.stats.use(m.fuel.k, 1);
        if (--m.fuel.n <= 0) m.fuel = null;
      } else {
        m.status = 'Needs fuel';
        e.working = false;
        continue;
      }
    }
    let sp = m.speed * speedMod;
    if (e.def.powerUse) {
      sp *= e.sat;
      if (e.sat <= 0.001) {
        m.status = e.net ? 'Not enough power' : 'No power';
        e.working = true; // still demands power
        continue;
      }
    }
    e.working = true;
    m.status = 'Working';
    if (m.progress < 1) {
      m.progress += (dt * sp) / Math.max(0.05, r.time);
      if (e.def.fuel) m.burn -= dt * Math.min(1, sp);
    }
    if (m.progress >= 1) {
      if (outCount(m) >= OUT_CAP) {
        m.status = 'Output full';
        e.working = false;
        continue;
      }
      for (const o of r.out) {
        if (o.chance !== undefined && g.rng.next() >= o.chance) continue;
        const k = key(o.item, 0);
        addOut(m, k, o.n);
        g.stats.add(k, o.n);
      }
      m.made++;
      m.crafting = false;
      m.progress = 0;
      g.emit({ t: 'fx', kind: 'puff', x: e.x + e.w / 2, y: e.y });
      // the play screen turns this into a hop, an output pop and a note (each machine has its own)
      g.emit({ t: 'made', ent: e.id, item: r.out[0].item, x: e.x + e.w / 2, y: e.y });
    }
  }
}

function addOut(m: MachC, k: ItemKey, n: number) {
  const s = m.outBuf.find((o) => o.k === k);
  if (s) s.n += n;
  else m.outBuf.push({ k, n });
}

/** Bee skep: makes honey on fair days, flavored by flowers growing nearby. */
function updateBees(g: Game, e: Ent, dt: number) {
  const m = e.mach!;
  if (g.time.season === 3 || g.isRaining()) {
    m.status = g.time.season === 3 ? 'Bees are sleeping' : 'Bees hide from the rain';
    return;
  }
  if (outCount(m) >= 5) {
    m.status = 'Full of honey';
    return;
  }
  m.status = 'Buzzing';
  m.progress += dt / 420;
  if (m.progress >= 1) {
    m.progress = 0;
    const flower = nearbyFlower(g, e.x, e.y, 5);
    const k = key(flower ? `honey_${flower}` : 'honey');
    addOut(m, k, 1);
    g.stats.add(k, 1);
  }
}

const HONEY_FLOWERS = new Set(['tulip', 'sunflower', 'sunbell', 'starpetal']);
function nearbyFlower(g: Game, x: number, y: number, r: number): string | null {
  let best: string | null = null;
  let bestD = 1e9;
  for (let yy = y - r; yy <= y + r; yy++)
    for (let xx = x - r; xx <= x + r; xx++) {
      if (!g.map.inb(xx, yy)) continue;
      const s = g.soil.get(g.map.idx(xx, yy));
      if (s?.crop && s.crop.ready && HONEY_FLOWERS.has(s.crop.id)) {
        const d = Math.abs(xx - x) + Math.abs(yy - y);
        if (d < bestD) {
          bestD = d;
          best = s.crop.id;
        }
      }
    }
  return best;
}

/** Player selects a recipe in the machine UI. */
export function setRecipe(g: Game, e: Ent, r: RecipeDef | null) {
  const m = e.mach!;
  if (m.crafting) return;
  m.recipe = r;
  m.locked = !!r;
  // return incompatible buffered items to the player
  if (r) {
    for (const [k, n] of [...m.inBuf]) {
      if (!r.in.some((i) => specMatch(k, i.item))) {
        m.inBuf.delete(k);
        g.give(k, n);
      }
    }
  }
}
