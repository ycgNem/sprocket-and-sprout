// Processing machines: input buffers, recipe selection, fuel, power-scaled progress.
import { recipesForStation } from '../../data/recipes';
import type { RecipeDef } from '../../data/types';
import type { Game } from '../Game';
import type { Ent, MachC } from '../ents';
import { ITEM_BY_ID } from '../../data/items';
import { MState, offText, setHarvestWait, setState } from '../mstate';
import { rustTick } from '../rust';
import { feedersOf, fieldSource, harvestWaitText, hasFeeder } from '../lines';
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

/** is k an ingredient of a recipe it may run (or a fuel it burns)? false = the wrong input */
export function machUses(g: Game, e: Ent, k: ItemKey): boolean {
  if (e.def.kind === 'beehouse') return false;
  if (e.def.fuel && fuelValue(k) > 0) return true;
  return availableRecipes(g, e).some((r) => r.in.some((i) => specMatch(k, i.item)));
}

const CAT_WORD: Record<string, string> = { crop: 'crop', fruit: 'fruit', forage: 'forage', animal: 'animal product', flower: 'flower', resource: 'resource', fish: 'fish' };

/**
 * What a machine takes, in words, from the recipes it may run: a few items by name ("wood,
 * hardwood or driftwood"), a long list by its kinds ("any crop or fruit").
 */
export function machTakesText(g: Game, e: Ent): string {
  const specs = [...new Set(availableRecipes(g, e).flatMap((r) => r.in.map((i) => i.item)))];
  const name = (s: string) => (s[0] === '#' ? 'any ' + s.slice(1) : (ITEM_BY_ID.get(s)?.name ?? s).toLowerCase());
  const or = (names: string[]) => (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]);
  if (!specs.length) return 'nothing yet';
  if (specs.length <= 3) return or(specs.map(name));
  const cats = new Map<string, number>();
  for (const s of specs) {
    const c = s[0] === '#' ? '' : ITEM_BY_ID.get(s)?.cat ?? '';
    if (CAT_WORD[c]) cats.set(c, (cats.get(c) ?? 0) + 1);
  }
  const top = [...cats].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (top.reduce((a, [, n]) => a + n, 0) >= specs.length * 0.8) return 'any ' + top.map(([c]) => CAT_WORD[c]).join(' or ');
  return `${name(specs[0])}, ${name(specs[1])} and ${specs.length - 2} more`;
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

/**
 * Use up a batch's inputs. The batch remembers the lowest input quality: artisan goods keep it
 * (ROADMAP.md 4.9, quality survives the works), so a gold tomato makes gold pickles.
 */
function consume(g: Game, m: MachC, r: RecipeDef) {
  let q = 3, any = false;
  for (const inp of r.in) {
    let need = inp.n;
    for (const [k, n] of m.inBuf) {
      if (need <= 0) break;
      if (!specMatch(k, inp.item)) continue;
      const t = Math.min(n, need);
      if (n - t <= 0) m.inBuf.delete(k);
      else m.inBuf.set(k, n - t);
      need -= t;
      q = Math.min(q, k & 3);
      any = true;
      g.stats.use(k, t);
    }
  }
  m.q = any ? q : 0;
}

export function pickRecipe(g: Game, e: Ent): RecipeDef | null {
  const m = e.mach!;
  if (m.locked) return m.recipe && canCraft(m, m.recipe) ? m.recipe : null;
  for (const r of availableRecipes(g, e)) if (canCraft(m, r)) return r;
  return null;
}

/** the thing a starved machine waits for, in words: a locked recipe's missing input, else what its feeders carry */
function wantedInput(g: Game, e: Ent): string {
  const m = e.mach!;
  const name = (spec: string) => (spec[0] === '#' ? 'any ' + spec.slice(1) : (ITEM_BY_ID.get(spec)?.name ?? spec).toLowerCase());
  if (m.locked && m.recipe) {
    for (const inp of m.recipe.in) if (bufCountSpec(m, inp.item) < inp.n) return name(inp.item);
  }
  // a part-filled buffer: more of what's in it
  for (const [k] of m.inBuf) return kDef(k).name.toLowerCase();
  // what the arms aimed at it last carried
  for (const f of feedersOf(g, e)) if (f.lastK !== undefined) return kDef(f.lastK).name.toLowerCase();
  // never fed: name what it last made from, else what it takes
  return m.recipe ? name(m.recipe.in[0].item) : machTakesText(g, e);
}

export function updateMachines(g: Game, dt: number) {
  const speedMod = g.mods.machineSpeed + (g.sys.megaBonus?.machine ?? 0) + (g.hasPerk('engineer') ? 0.1 : 0) + (g.hasPerk('industrialist') ? 0.15 : 0);
  const now = g.simTime;
  for (const e of g.ents.machines) {
    const m = e.mach!;
    if (e.def.kind === 'beehouse') {
      updateBees(g, e, dt);
      continue;
    }
    if (rustTick(e, now)) continue;
    if (e.off) {
      e.working = false;
      setState(e, MState.Idle, offText(e), now);
      continue;
    }
    if (!m.crafting) {
      if (outCount(m) >= OUT_CAP) {
        setState(e, MState.Blocked, 'Output full: nothing takes its goods away', now);
        e.working = false;
        continue;
      }
      const r = pickRecipe(g, e);
      if (!r) {
        e.working = false;
        if (!m.locked && !availableRecipes(g, e).length) setState(e, MState.Idle, 'Pick a recipe', now);
        else if (m.inBuf.size || hasFeeder(g, e)) {
          // the reason is worked out on entering the state and once a second after that
          if ((e.state !== MState.Starved && !e.fieldWait) || g.tickN % 60 === e.id % 60) {
            e.want = wantedInput(g, e);
            // supply that traces back to a field with nothing ripe: waiting for harvest, not starved
            const field = m.inBuf.size ? null : fieldSource(g, e);
            if (field) setHarvestWait(e, harvestWaitText(field), now);
            else setState(e, MState.Starved, `Waiting for ${e.want}`, now);
          }
        } else setState(e, MState.Idle, m.made ? 'Nothing feeds it any more' : 'Waiting to be fed', now);
        continue;
      }
      if (e.def.fuel && m.burn <= 0 && !m.fuel) {
        setState(e, MState.NeedsFuel, 'Needs fuel: wood or coal', now);
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
        setState(e, MState.NeedsFuel, 'Out of fuel: wood or coal', now);
        e.working = false;
        continue;
      }
    }
    // the keeper's jar runs its first few batches fast, so the opening's first pickle comes quickly;
    // lubricant (an oiled machine) runs a fifth faster until morning
    let sp = m.speed * speedMod * (e.st.quick > 0 ? 4 : 1) * (e.st.lube > 0 ? 1.2 : 1);
    if (e.def.powerUse) {
      sp *= e.sat;
      if (e.sat <= 0.001) {
        setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
        e.working = true; // still demands power
        continue;
      }
    }
    e.working = true;
    if (e.def.powerUse && e.sat < 0.25) setState(e, MState.Unpowered, `Crawling at ${Math.round(e.sat * 100)}%: the grid is short`, now);
    else if (e.def.powerUse && e.sat < 0.99) setState(e, MState.Working, `Running at ${Math.round(e.sat * 100)}%: the grid is short`, now);
    else setState(e, MState.Working, '', now);
    if (m.progress < 1) {
      m.progress += (dt * sp) / Math.max(0.05, r.time);
      if (e.def.fuel) m.burn -= dt * Math.min(1, sp);
    }
    if (m.progress >= 1) {
      if (outCount(m) >= OUT_CAP) {
        setState(e, MState.Blocked, 'Output full: nothing takes its goods away', now);
        e.working = false;
        continue;
      }
      let made = 0;
      for (const o of r.out) {
        if (o.chance !== undefined && g.rng.next() >= o.chance) continue;
        const k = key(o.item, keepsQuality(r, o.item) ? m.q : 0);
        addOut(m, k, o.n);
        g.stats.add(k, o.n);
        made += o.n;
      }
      g.stats.states.moved(e, made);
      m.made++;
      if (e.st.quick > 0) e.st.quick--;
      m.crafting = false;
      m.progress = 0;
      g.emit({ t: 'fx', kind: 'puff', x: e.x + e.w / 2, y: e.y });
      // the play screen turns this into a hop, an output pop and a note (each machine has its own)
      g.emit({ t: 'made', ent: e.id, item: r.out[0].item, x: e.x + e.w / 2, y: e.y });
      g.sys.quests?.notify?.(g, 'made', 1, e.def.id, { other: !e.st.keeper });
    }
  }
}
/** artisan goods (and recipes marked keepQuality) carry their input's quality */
function keepsQuality(r: RecipeDef, item: string): boolean {
  return !!r.keepQuality || ITEM_BY_ID.get(item)?.cat === 'artisan';
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
    setState(e, MState.Idle, g.time.season === 3 ? 'Bees are sleeping' : 'Bees hide from the rain', g.simTime);
    return;
  }
  if (outCount(m) >= 5) {
    setState(e, MState.Blocked, 'Full of honey', g.simTime);
    return;
  }
  setState(e, MState.Working, 'Buzzing', g.simTime);
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
