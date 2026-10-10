// The drafting table's blueprint library (ROADMAP.md 7.8, Phase 5): blueprints saved under a
// name, to load back into the blueprint tool and paste outside, or to bring to the Sprocket Fair's
// test bed. Thorne's old works drawings arrive here too. A pure module: house.ts saves and loads
// it (sys.house.lib), so any system can add to it without moving the tick order.
import { STRUCT_BY_ID } from '../data/structures';
import type { Game } from './Game';
import type { Blueprint } from './blueprint';

export interface LibEntry {
  name: string;
  bp: Blueprint;
  /** who drew it: '' for your own, a villager's id for a gift (Thorne's old works drawings) */
  from: string;
  /** the day it was saved (dayIndex) */
  day: number;
}

export const LIB_MAX = 12;

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
  if (d.lib.length >= LIB_MAX || !bp.items.length) return false;
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

/** the library's save shape (blueprints keep their raw item keys, as blueprint ghosts do) */
export const saveLib = (g: Game) => drafting(g).lib.map((e) => ({ ...e, bp: cloneBlueprint(e.bp) }));

export function loadLib(g: Game, d: unknown) {
  const list = Array.isArray(d) ? d : [];
  drafting(g).lib = list.filter((e: any) => e && typeof e.name === 'string' && e.bp && Array.isArray(e.bp.items)).slice(0, LIB_MAX)
    // a structure retired since it was saved drops out of the drawing
    .map((e: any) => ({ name: e.name, bp: { ...e.bp, items: e.bp.items.filter((it: any) => STRUCT_BY_ID.has(it.def)) } as Blueprint, from: e.from ?? '', day: e.day ?? 0 }));
}
