// The Sprocket Fair's test bed (ROADMAP.md 7.7, Phase 5; scoring revised after the critic's Phase 5
// review). Bring a line as a blueprint and the square's 6x6 plate builds it in a throwaway world
// (`new Game({ blank })`: nothing in the real one changes), then runs it for five minutes of works
// time:
// - every chest that feeds a machine starts with 99 of what that machine runs on (its locked
//   recipe's inputs, else the recipe it last ran, else the first one it can run), if your farm has
//   some of it (in the bag, a chest, a crate or a machine, growing in a field, or ever shipped or
//   found) and it is worth something: the plate runs your line on your goods, not on ore you never
//   dug (and not on junk such as tin cans);
// - fuel burners start with 20 coal, and the plate's own grid powers everything fully (power.ts reads
//   `sys.bedPower`), so generators stand idle there;
// - a gleaner or a harvest crane picks from a basket of the crop it last picked at home, at its own
//   pick rate (fieldworks.ts and automation.ts ask `sys.bedBasket`), so a field-fed line comes as it is;
// - a machine whose goods go nowhere (no arm or belt carries them to a chest, a crate or another
//   machine) is left off: a line's goods count once they leave the machine that made them;
// - your know-how comes along (research, era rewards, perks), so the line runs as it does at home.
// The score is the value the line adds, a pure function of the goods (base price by quality, no
// market saturation, drift or hot goods): what it made, less the stocked inputs it used up (the
// chests' 99s, the coal, the baskets' crops), with the batches cooking at the bell counted by how far
// along they are. It is reported as coins a minute over the five. Goods that only pass through (a
// chest of beans carried to a crate) count for nothing, and a line that turns good crops into
// cheaper goods scores below zero. Pure: no DOM.
import { CROP_BY_ID } from '../data/crops';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../data/items';
import { RECIPE_BY_ID } from '../data/recipes';
import { STRUCT_BY_ID } from '../data/structures';
import type { RecipeDef } from '../data/types';
import { applyBlueprintSettings, rotateBlueprint, type Blueprint, type BlueprintItem } from './blueprint';
import { canPlace, place, structFootprint } from './build';
import { fits } from './drafting';
import { DX, DY, type Ent, type MachC } from './ents';
import { DT, Game } from './Game';
import { key, kId, kMatches, sellPrice, type ItemKey } from './inventory';
import { takersOf } from './lines';
import { MState, setState } from './mstate';
import { availableRecipes } from './systems/machines';

/** the plate is 6 tiles square */
export const BED = 6;
/** a run is five minutes of works time */
export const BED_MINUTES = 5;
/** the whole run, in ticks */
export const BED_TICKS = BED_MINUTES * 60 * 60;
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
  /** ticks run so far (BED_TICKS is the whole run) */
  ticks: number;
  /** pieces that can't stand on the plate (a water wheel wants a river, a drill an ore vein) */
  skipped: string[];
  /** machines left off because nothing carries their goods away (structure ids) */
  idle: string[];
  /** inputs the chests didn't get: none at home, or worth nothing (item ids) */
  missing: string[];
  /** gleaners and cranes with no crop to pick: they never picked one at home */
  noBasket: number;
  /** goods made and used up on the plate, by item key (quality kept), as the machines make and use them */
  made: Map<ItemKey, number>;
  used: Map<ItemKey, number>;
}

export interface BedTally {
  /** the value added so far: what the line made less the stocked inputs it used up, coins */
  coins: number;
  /** goods the line made (net of what it used again further down), most valuable first */
  made: BedGood[];
  /** stocked inputs it used up (n how many, coins below zero), most valuable first */
  used: BedGood[];
  /** batches cooking now: n is the share of a batch's goods (0.98 = nearly one) */
  cooking: BedGood[];
}

/** what a good is worth at the Fair: its base price by its quality, nothing from the market */
export const worth = (k: ItemKey) => sellPrice(k);

/** where a blueprint sits on the plate: turned if it must be to fit, its pieces centred */
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
  // centred when the pieces fit; else the copied rectangle's corner on the plate's (what hangs over is left off)
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

/** a recipe input's item: itself, or the first item that a tag names ("#flour" -> flour), one you have if you can */
function concrete(spec: string, home?: Set<string>): string | null {
  if (spec[0] !== '#') return spec;
  const all = ITEMS.filter((d) => d.price > 0 && matchesSpec(d, spec));
  return (all.find((d) => home?.has(d.id)) ?? all[0])?.id ?? null;
}

/** the goods your farm has: in the bag, in any structure (indoors too), growing in its fields, or ever shipped or found */
export function homeGoods(real: Game): Set<string> {
  const s = new Set<string>();
  for (const sl of real.player.inv.slots) if (sl) s.add(kId(sl.k));
  for (const store of [real.ents, real.houseEnts]) {
    for (const e of store.all()) {
      if (e.ghost) continue;
      for (const sl of e.inv?.slots ?? []) if (sl) s.add(kId(sl.k));
      if (!e.mach) continue;
      for (const [k] of e.mach.inBuf) s.add(kId(k));
      for (const o of e.mach.outBuf) s.add(kId(o.k));
    }
  }
  for (const soil of real.soil.values()) {
    const cr = soil.crop && !soil.crop.dead ? CROP_BY_ID.get(soil.crop.id) : undefined;
    if (cr) s.add(cr.produce);
  }
  const gs = real.sys.goals as { shipped?: Record<string, number>; found?: string[] } | undefined;
  for (const id of Object.keys(gs?.shipped ?? {})) s.add(id);
  for (const id of gs?.found ?? []) s.add(id);
  return s;
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

/** do a machine's goods go somewhere: does an arm or a belt carry them to a chest, a crate or another machine? */
function delivers(g: Game, m: Ent): boolean {
  const seen = new Set<number>([m.id]);
  let frontier = takersOf(g, m);
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: Ent[] = [];
    for (const e of frontier) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.arm || e.belt) next.push(...takersOf(g, e));
      else if (e.mach || e.inv) return true;
    }
    frontier = next;
  }
  return false;
}

/** fill the chests that feed machines with what your farm has, and stoke the burners (the plate's grid powers the rest) */
function stock(run: BedRun, home: Set<string>) {
  const g = run.g;
  for (const e of g.ents.all()) {
    if (e.ghost || e.def.kind !== 'chest' || !e.inv) continue;
    const want: string[] = [];
    for (const m of fedMachines(g, e)) {
      const mc = m.mach!;
      const r = mc.locked && mc.recipe ? mc.recipe : availableRecipes(g, m)[0];
      for (const i of r?.in ?? []) {
        const id = concrete(i.item, home);
        if (id && !want.includes(id)) want.push(id);
      }
    }
    for (const id of want) {
      if (home.has(id) && (ITEM_BY_ID.get(id)?.price ?? 0) > 0) e.inv.add(key(id), BED_STOCK);
      else if (!run.missing.includes(id)) run.missing.push(id);
    }
  }
  const coal = key('coal');
  for (const e of g.ents.machines) if (e.def.fuel) e.mach!.fuel = { k: coal, n: BED_COAL };
}

/**
 * The basket a gleaner or crane picks from on the plate: the crop it last picked at home, its usual
 * yield a pick (steady: the average, and Field Hand's extra one in four), at its own pick rate (the
 * machine's tick calls this where it would look for a ripe crop). The crops are stock, not goods
 * made: the line's score pays for what it uses of them.
 */
function basketPick(g: Game, e: Ent): boolean {
  const cr = CROP_BY_ID.get(e.st.bedCrop as string);
  if (!cr || !e.inv) return false;
  const [lo, hi] = cr.yield ?? [1, 1];
  e.st.bedAcc = ((e.st.bedAcc as number) ?? 0) + (lo + hi) / 2 + (g.hasPerk('tiller') ? 0.25 : 0);
  const n = Math.floor(e.st.bedAcc);
  e.st.bedAcc -= n;
  if (n > 0) e.inv.add(key(cr.produce), n);
  e.working = true;
  e.st.anim = 0.6;
  setState(e, MState.Working, `Picking ${(ITEM_BY_ID.get(cr.produce)?.name ?? cr.name).toLowerCase()} from its basket`, g.simTime);
  return true;
}

/** Build a blueprint on a fresh plate, stocked and powered, ready to run (nothing in `real` changes). */
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
  // off the plate, so nothing is refused for standing where the player stands
  g.player.x = g.player.y = -10;
  g.sys.bedPower = true;
  g.sys.bedBasket = basketPick;
  const run: BedRun = { g, ticks: 0, skipped: [], idle: [], missing: [], noBasket: 0, made: new Map(), used: new Map() };
  for (const it of buildOrder(bp.items)) {
    const x = ox + it.dx, y = oy + it.dy;
    if (!STRUCT_BY_ID.has(it.def) || !canPlace(g, it.def, x, y, it.rot, { ignoreZone: true }).ok) {
      run.skipped.push(it.def);
      continue;
    }
    const e = place(g, it.def, x, y, it.rot);
    e.st.bpRecipe = it.recipe;
    e.st.bpFilter = it.filter;
    if (it.limit || it.sf !== undefined || it.sp) e.st.bpExtra = [it.limit ?? 0, it.sf ?? -1, it.sp ?? 0];
    applyBlueprintSettings(g, e);
    if (e.def.kind === 'gleaner' || e.def.kind === 'harvester') {
      if (it.crop && CROP_BY_ID.has(it.crop)) e.st.bedCrop = it.crop;
      else run.noBasket++;
    }
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
  // a machine whose goods go nowhere is left off (and then what fed only it may go nowhere either)
  for (let pass = 0; pass < 8; pass++) {
    const dead = g.ents.machines.filter((m) => !m.ghost && m.def.kind !== 'beehouse' && !delivers(g, m));
    if (!dead.length) break;
    for (const m of dead) {
      run.idle.push(m.def.id);
      g.ents.remove(m);
    }
  }
  stock(run, homeGoods(real));
  g.events.length = 0;
  // the plate's own books: every good its machines make and use, quality kept
  const stats = g.stats, add = stats.add.bind(stats), use = stats.use.bind(stats);
  stats.add = (k: ItemKey, n: number) => {
    add(k, n);
    run.made.set(k, (run.made.get(k) ?? 0) + n);
  };
  stats.use = (k: ItemKey, n: number) => {
    use(k, n);
    run.used.set(k, (run.used.get(k) ?? 0) + n);
  };
  return run;
}

/** run the plate on by `ticks` (at most to the end of its five minutes) */
export function stepBed(run: BedRun, ticks: number) {
  const n = Math.min(ticks, BED_TICKS - run.ticks);
  if (n <= 0) return;
  run.g.runWorks(n * DT, 1);
  run.ticks += n;
  // nothing listens to the plate's events
  run.g.events.length = 0;
}

export const bedDone = (run: BedRun) => run.ticks >= BED_TICKS;

/** the item a batch used for one of its recipe's inputs (a tag's: what the machine is being fed) */
function inputKey(m: MachC, spec: string): ItemKey | null {
  if (spec[0] !== '#') return key(spec, m.q ?? 0);
  for (const [k] of m.inBuf) if (kMatches(k, spec)) return k;
  const id = concrete(spec);
  return id ? key(id) : null;
}

/** artisan goods (and recipes marked keepQuality) carry their input's quality, as at home */
const outKey = (r: RecipeDef, m: MachC, item: string) => key(item, r.keepQuality || ITEM_BY_ID.get(item)?.cat === 'artisan' ? m.q ?? 0 : 0);

/** What the line has done so far: the value it added, the goods it made and used, what is cooking. */
export function bedTally(run: BedRun): BedTally {
  const g = run.g;
  let coins = 0;
  const made: BedGood[] = [], used: BedGood[] = [];
  for (const k of new Set([...run.made.keys(), ...run.used.keys()])) {
    const n = (run.made.get(k) ?? 0) - (run.used.get(k) ?? 0);
    if (!n) continue;
    const c = n * worth(k);
    coins += c;
    (n > 0 ? made : used).push({ k, n: Math.abs(n), coins: c });
  }
  // a batch at the bell has used its inputs and not yet made its goods: it counts by how far along it is
  const cooking = new Map<ItemKey, BedGood>();
  for (const m of g.ents.machines) {
    const mc = m.mach!;
    if (m.ghost || !mc.crafting || !mc.recipe) continue;
    const p = Math.min(1, Math.max(0, mc.progress));
    for (const inp of mc.recipe.in) {
      const k = inputKey(mc, inp.item);
      if (k !== null) coins += (1 - p) * inp.n * worth(k);
    }
    for (const o of mc.recipe.out) {
      const k = outKey(mc.recipe, mc, o.item);
      const n = p * o.n * (o.chance ?? 1), c = n * worth(k);
      const row = cooking.get(k) ?? { k, n: 0, coins: 0 };
      row.n += n;
      row.coins += c;
      cooking.set(k, row);
      coins += c;
    }
  }
  made.sort((a, b) => b.coins - a.coins);
  used.sort((a, b) => a.coins - b.coins);
  return { coins, made, used, cooking: [...cooking.values()].filter((c) => c.n > 0.005).sort((a, b) => b.coins - a.coins) };
}

/** the line's score: the value it added, in coins a minute over the run (below zero if it destroys value) */
export const bedScore = (run: BedRun) => Math.round(bedTally(run).coins / BED_MINUTES);

/** build, stock and run a blueprint for its five minutes on a fresh plate: its score in coins a minute */
export function scoreBlueprint(real: Game, bp: Blueprint): number {
  const run = startBed(real, bp);
  stepBed(run, BED_TICKS);
  return bedScore(run);
}
