// The drafting table's blueprint library (ROADMAP.md 7.8, Phase 5): blueprints saved under a
// name, to load back into the blueprint tool and paste outside, or to bring to the Sprocket Fair's
// test bed. Thorne's old works drawings arrive here too. A pure module: house.ts saves and loads
// it (sys.house.lib), so any system can add to it without moving the tick order.
import { CROP_BY_ID } from '../data/crops';
import { ITEM_INDEX } from '../data/items';
import { RECIPE_BY_ID } from '../data/recipes';
import { INDEXED_LIB } from '../data/trust';
import { STRUCT_BY_ID } from '../data/structures';
import type { Game } from './Game';
import type { Blueprint, BlueprintItem } from './blueprint';
import { key, kId, kQ } from './inventory';

export interface LibEntry {
  name: string;
  bp: Blueprint;
  /** who drew it: '' for your own, a villager's id for a gift (Thorne's old works drawings) */
  from: string;
  /** the day it was saved (dayIndex) */
  day: number;
}

export const LIB_MAX = 12;
/** the library's size: 12, or 24 with Hazel's index (a Trust reward, src/data/trust.ts) */
export const libMax = (g: Game) => (g.flags.has('trust:hazel_index') ? INDEXED_LIB : LIB_MAX);

export interface DraftingState {
  lib: LibEntry[];
}

export function drafting(g: Game): DraftingState {
  if (!g.sys.drafting) g.sys.drafting = { lib: [] } as DraftingState;
  return g.sys.drafting;
}

/** a deep copy, so later edits to the tool's copy don't change the saved one */
export const cloneBlueprint = (bp: Blueprint): Blueprint => JSON.parse(JSON.stringify(bp));

/**
 * Add a blueprint to the library under a name (a second one of the same name gets a number).
 * Returns false when the library is full (LIB_MAX) and nothing was added.
 */
export function addBlueprint(g: Game, name: string, bp: Blueprint, from = ''): boolean {
  const d = drafting(g);
  if (d.lib.length >= libMax(g) || !bp.items.length) return false;
  let n = name.trim() || 'A line';
  if (d.lib.some((e) => e.name === n)) {
    let i = 2;
    while (d.lib.some((e) => e.name === `${n} ${i}`)) i++;
    n = `${n} ${i}`;
  }
  d.lib.push({ name: n, bp: cloneBlueprint(bp), from, day: g.dayIndex });
  return true;
}

/** does a library entry (or any blueprint) fit a w x h area, either way round? */
export const fits = (bp: Blueprint, w: number, h: number) => (bp.w <= w && bp.h <= h) || (bp.h <= w && bp.w <= h);

// item keys are indexes into the item list, which grows: the library saves [id, quality] pairs
type KJ = [string, number];
const kj = (k: number): KJ => [kId(k), kQ(k)];
const jk = (j: unknown): number | null => (Array.isArray(j) && ITEM_INDEX.has(j[0]) ? key(j[0], j[1] ?? 0) : null);

const saveItem = (it: BlueprintItem) => ({ ...it, filter: it.filter?.map(kj), sf: it.sf === undefined ? undefined : kj(it.sf) });
function loadItem(it: any): BlueprintItem {
  const out: BlueprintItem = { def: it.def, dx: it.dx, dy: it.dy, rot: it.rot };
  // (a locked recipe, the one an unlocked machine last ran and a gleaner's crop, for the Sprocket Fair's bed)
  if (RECIPE_BY_ID.has(it.recipe)) out.recipe = it.recipe;
  if (RECIPE_BY_ID.has(it.last)) out.last = it.last;
  if (CROP_BY_ID.has(it.crop)) out.crop = it.crop;
  if (it.limit) out.limit = it.limit;
  if (it.sp) out.sp = it.sp;
  if (Array.isArray(it.filter)) out.filter = it.filter.map(jk).filter((k: number | null): k is number => k !== null);
  const sf = jk(it.sf);
  if (sf !== null) out.sf = sf;
  return out;
}

/** the library's save shape */
export const saveLib = (g: Game) => drafting(g).lib.map((e) => ({ ...e, bp: { w: e.bp.w, h: e.bp.h, items: e.bp.items.map(saveItem) } }));

export function loadLib(g: Game, d: unknown) {
  const list = Array.isArray(d) ? d : [];
  drafting(g).lib = list.filter((e: any) => e && typeof e.name === 'string' && e.bp && Array.isArray(e.bp.items)).slice(0, INDEXED_LIB)
    // a structure retired since it was saved drops out of the drawing
    .map((e: any) => ({ name: e.name, bp: { w: e.bp.w, h: e.bp.h, items: e.bp.items.filter((it: any) => STRUCT_BY_ID.has(it?.def)).map(loadItem) }, from: e.from ?? '', day: e.day ?? 0 }));
}
