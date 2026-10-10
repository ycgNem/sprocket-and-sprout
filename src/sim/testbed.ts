// The Sprocket Fair's test bed (ROADMAP.md 7.7, Phase 5). Bring a line as a blueprint and the
// square's 6x6 bed builds it in a throwaway world (`new Game({ blank })`: nothing in the real one
// changes), then runs it for a minute of works time:
// - every chest that feeds a machine starts with 99 of what that machine runs on (its locked
//   recipe's inputs, else the recipe it last ran, else the first one it can run);
// - fuel burners start with 20 coal, and the bed's own grid powers everything fully (power.ts
//   reads `sys.bedPower`);
// - your know-how comes along (research, era rewards, perks), so the line runs as it does at home.
// The score is the market value, at the real game's prices, of what the line finishes in that
// minute: goods made on the bed that sit in a shipping crate, in a chest at the end of the line or
// in the output of a machine nothing takes from, plus the share of the batch each last machine is
// cooking at the bell. A crock makes one pickle a minute, so without that share a two-crock line
// would score two pickles or none by a hair. Goods that only pass through (a chest of beans
// carried to a crate) count for nothing: the line didn't make them. Pure: no DOM.
import { ITEMS, matchesSpec } from '../data/items';
import { RECIPE_BY_ID } from '../data/recipes';
import { STRUCT_BY_ID } from '../data/structures';
import { applyBlueprintSettings, rotateBlueprint, type Blueprint, type BlueprintItem } from './blueprint';
import { canPlace, place, structFootprint } from './build';
import { fits } from './drafting';
import { DX, DY, type Ent } from './ents';
import { DT, Game } from './Game';
import { key, kIdx, type ItemKey } from './inventory';
import { takersOf } from './lines';
import { unitPrice } from './systems/economy';
import { availableRecipes } from './systems/machines';

/** the bed is 6 tiles square */
export const BED = 6;
/** a minute of works time, in ticks */
export const BED_TICKS = 60 * 60;
/** what each chest that feeds a machine starts with, of each thing the machine runs on */
export const BED_STOCK = 99;
/** what each fuel burner starts with */
export const BED_COAL = 20;

export interface BedGood {
  k: ItemKey;
  n: number;
  coins: number;
}

export interface BedRun {
  /** the throwaway world the line runs in */
  g: Game;
  /** the real game: only its prices are read */
  real: Game;
  /** ticks run so far (BED_TICKS is the whole minute) */
  ticks: number;
  /** pieces that can't stand on the bed (a water wheel wants a river, a drill an ore vein) */
  skipped: string[];
  /** the machines whose goods are the line's own: nothing downstream of them makes anything */
  finals: Ent[];
  prices: Map<ItemKey, number>;
}

/** where a blueprint sits on the bed: turned if it must be to fit, its pieces centred */
export function bedLayout(bp: Blueprint): { bp: Blueprint; ox: number; oy: number } {
  const b = bp.w <= BED && bp.h <= BED ? bp : fits(bp, BED, BED) ? rotateBlueprint(bp) : bp;
  // the pieces' own extent (a 2x2 machine can hang over the copied rectangle's edge)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of b.items) {
    const def = STRUCT_BY_ID.get(it.def);
    if (!def) continue;
    for (const t of structFootprint(def, it.dx, it.dy, def.rotatable ? it.rot : 0)) {
      x0 = Math.min(x0, t.x);
      y0 = Math.min(y0, t.y);
      x1 = Math.max(x1, t.x);
      y1 = Math.max(y1, t.y);
    }
  }
  if (!Number.isFinite(x0)) return { bp: b, ox: 0, oy: 0 };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // centred when the pieces fit; else the copied rectangle's corner on the bed's (what hangs over is left off)
  const ox = w <= BED ? Math.floor((BED - w) / 2) - x0 : 0;
  const oy = h <= BED ? Math.floor((BED - h) / 2) - y0 : 0;
  return { bp: b, ox, oy };
}

/** undergrounds go down last and upstream first, so each exit finds its entrance behind it */
function buildOrder(items: BlueprintItem[]): BlueprintItem[] {
  const ug = (it: BlueprintItem) => STRUCT_BY_ID.get(it.def)?.kind === 'underground';
  const along = (it: BlueprintItem) => it.dx * DX[it.rot] + it.dy * DY[it.rot];
  return [...items.filter((it) => !ug(it)), ...items.filter(ug).sort((a, b) => along(a) - along(b))];
}

/** a recipe input's item: itself, or the first item that a tag names ("#flour" -> flour) */
function concrete(spec: string): string | null {
  if (spec[0] !== '#') return spec;
  return ITEMS.find((d) => d.price > 0 && matchesSpec(d, spec))?.id ?? null;
}

/** the machines a structure feeds, past arms and belts (a chest's arm, its belt run, a splitter) */
function fedMachines(g: Game, src: Ent): Ent[] {
  const out: Ent[] = [];
  const seen = new Set<number>([src.id]);
  let frontier = takersOf(g, src);
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const e of frontier) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.mach) {
        if (e.def.kind !== 'beehouse') out.push(e);
      } else if (e.arm || e.belt) next.push(...takersOf(g, e));
    }
    frontier = next;
  }
  return out;
}

/** does anything downstream of a machine (past arms, belts and chests) make something? */
function feedsAMachine(g: Game, m: Ent): boolean {
  const seen = new Set<number>([m.id]);
  let frontier = takersOf(g, m);
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const e of frontier) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.mach) return true;
      if (e.arm || e.belt || e.def.kind === 'chest') next.push(...takersOf(g, e));
    }
    frontier = next;
  }
  return false;
}

/** fill the chests that feed machines and stoke the burners */
function stock(g: Game) {
  for (const e of g.ents.all()) {
    if (e.ghost || e.def.kind !== 'chest' || !e.inv) continue;
    const want: string[] = [];
    for (const m of fedMachines(g, e)) {
      const mc = m.mach!;
      const r = mc.locked && mc.recipe ? mc.recipe : availableRecipes(g, m)[0];
      for (const i of r?.in ?? []) {
        const id = concrete(i.item);
        if (id && !want.includes(id)) want.push(id);
      }
    }
    for (const id of want) e.inv.add(key(id), BED_STOCK);
  }
  const coal = key('coal');
  for (const e of g.ents.machines) if (e.def.fuel) e.mach!.fuel = { k: coal, n: BED_COAL };
  for (const e of g.ents.gens) if (e.def.fuel && e.gen) e.gen.fuel = { k: coal, n: BED_COAL };
}

/** Build a blueprint on a fresh bed, stocked and powered, ready to run (nothing in `real` changes). */
export function startBed(real: Game, blueprint: Blueprint): BedRun {
  const { bp, ox, oy } = bedLayout(blueprint);
  const g = new Game({ blank: { w: BED, h: BED }, seed: 1 });
  // the player's know-how and machine speed come along: recipes, era rewards, perks
  g.research.done = new Set(real.research.done);
  g.research.rewards = new Set(real.research.rewards);
  g.flags = new Set(real.flags);
  g.mods = { ...real.mods };
  g.player.perks = [...real.player.perks];
  if (real.sys.megaBonus) g.sys.megaBonus = { ...real.sys.megaBonus };
  // off the bed, so nothing is refused for standing where the player stands
  g.player.x = g.player.y = -10;
  g.sys.bedPower = true;
  const skipped: string[] = [];
  for (const it of buildOrder(bp.items)) {
    const x = ox + it.dx, y = oy + it.dy;
    if (!STRUCT_BY_ID.has(it.def) || !canPlace(g, it.def, x, y, it.rot, { ignoreZone: true }).ok) {
      skipped.push(it.def);
      continue;
    }
    const e = place(g, it.def, x, y, it.rot);
    e.st.bpRecipe = it.recipe;
    e.st.bpFilter = it.filter;
    if (it.limit || it.sf !== undefined || it.sp) e.st.bpExtra = [it.limit ?? 0, it.sf ?? -1, it.sp ?? 0];
    applyBlueprintSettings(g, e);
    if (!e.mach) continue;
    // machines run only recipes you know (a drawing can name one you haven't studied yet)
    if (e.mach.locked && !g.unlocked(e.mach.recipe?.unlock)) {
      e.mach.locked = false;
      e.mach.recipe = null;
    }
    // a machine that picks on its own runs what it last ran at home
    const last = it.last ? RECIPE_BY_ID.get(it.last) : undefined;
    if (!e.mach.locked && last && last.station === e.mach.station && g.unlocked(last.unlock)) {
      e.mach.recipe = last;
      e.mach.locked = true;
    }
  }
  stock(g);
  g.events.length = 0;
  const finals = g.ents.machines.filter((m) => !m.ghost && m.def.kind !== 'beehouse' && !feedsAMachine(g, m));
  return { g, real, ticks: 0, skipped, finals, prices: new Map() };
}

/** run the bed on by `ticks` (at most to the end of its minute) */
export function stepBed(run: BedRun, ticks: number) {
  const n = Math.min(ticks, BED_TICKS - run.ticks);
  if (n <= 0) return;
  run.g.runWorks(n * DT, 1);
  run.ticks += n;
  // nothing listens to the bed's events
  run.g.events.length = 0;
}

export const bedDone = (run: BedRun) => run.ticks >= BED_TICKS;

function priceOf(run: BedRun, k: ItemKey): number {
  let p = run.prices.get(k);
  if (p === undefined) run.prices.set(k, (p = unitPrice(run.real, k)));
  return p;
}

/**
 * What the line has finished so far and its worth, with the share of the batches its last machines
 * are cooking (`cooking`: n is how much of a batch's goods, 0.98 = nearly one).
 */
export function bedTally(run: BedRun): { coins: number; goods: BedGood[]; cooking: BedGood[] } {
  const g = run.g;
  // goods made on the bed and not used up there count; what only passed through doesn't
  const budget = new Map<number, number>();
  for (const [idx, s] of g.stats.series) if (s.totalProd > 0) budget.set(idx, s.totalProd);
  const got = new Map<ItemKey, number>();
  const count = (k: ItemKey, n: number) => {
    const left = budget.get(kIdx(k)) ?? 0;
    const t = Math.min(left, n);
    if (t <= 0) return;
    budget.set(kIdx(k), left - t);
    got.set(k, (got.get(k) ?? 0) + t);
  };
  for (const e of g.ents.all()) {
    if (e.ghost || e.parent) continue;
    if (e.inv && (e.def.kind === 'shipbin' || (e.def.kind === 'chest' && !takersOf(g, e).length))) {
      for (const s of e.inv.slots) if (s) count(s.k, s.n);
    } else if (e.mach && !takersOf(g, e).length) for (const s of e.mach.outBuf) count(s.k, s.n);
  }
  const goods: BedGood[] = [];
  let coins = 0;
  for (const [k, n] of got) {
    const c = priceOf(run, k) * n;
    goods.push({ k, n, coins: c });
    coins += c;
  }
  // the batches the last machines are cooking at the bell, by how far along they are
  const cooking = new Map<ItemKey, BedGood>();
  for (const m of run.finals) {
    const mc = m.mach!;
    if (!mc.crafting || !mc.recipe) continue;
    const share = Math.min(1, mc.progress);
    for (const o of mc.recipe.out) {
      const k = key(o.item);
      const n = share * o.n * (o.chance ?? 1), c = n * priceOf(run, k);
      const row = cooking.get(k) ?? { k, n: 0, coins: 0 };
      row.n += n;
      row.coins += c;
      cooking.set(k, row);
      coins += c;
    }
  }
  goods.sort((a, b) => b.coins - a.coins);
  return { coins, goods, cooking: [...cooking.values()].sort((a, b) => b.coins - a.coins) };
}

/** the line's score so far: coins of goods (a whole minute's run is coins a minute) */
export const bedScore = (run: BedRun) => Math.round(bedTally(run).coins);

/** build, stock and run a blueprint for its minute on a fresh bed: its score in coins a minute */
export function scoreBlueprint(real: Game, bp: Blueprint): number {
  const run = startBed(real, bp);
  stepBed(run, BED_TICKS);
  return bedScore(run);
}
