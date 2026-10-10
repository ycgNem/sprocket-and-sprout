// When a research keystone's stages count (ROADMAP.md 7.3). Pure helpers with no system of their
// own, so the orders, the town works and the quests can ask without moving research's place in the
// tick order (src/sim/index.ts).
import { QUESTS } from '../data/goals';
import { RESEARCH, RESEARCH_BY_ID } from '../data/research';
import type { Game } from './Game';

export function canResearch(g: Game, id: string): boolean {
  const r = RESEARCH_BY_ID.get(id);
  if (!r || g.research.done.has(id)) return false;
  if (r.needFlag && !g.flags.has(r.needFlag)) return false;
  return r.prereq.every((p) => g.research.done.has(p));
}

/** the main quest that walks a keystone through its stages, if any */
export const keystoneQuest = (id: string) => QUESTS.find((q) => q.keystone === id);

/**
 * Do a keystone's stages count yet? On a Keeper's Line save a keystone with a main quest opens when
 * the quest starts (what you did before it asked, like walking past the town's mill on day 2 or the
 * meal the keeper's mill ground all spring, isn't the keystone's look or try); otherwise once it can
 * be studied.
 */
export function keystoneOpen(g: Game, id: string): boolean {
  if (g.research.done.has(id)) return false;
  const q = keystoneQuest(id);
  if (q && g.flags.has('keepers_line')) {
    const qs = g.sys.quests;
    return !!qs?.done?.includes(q.id) || !!qs?.active?.some((a: { id: string }) => a.id === q.id);
  }
  return canResearch(g, id);
}

/** does looking at this now count for the keystones that read the flag? */
export function lookCounts(g: Game, flag: string): boolean {
  const ks = RESEARCH.filter((r) => r.keystone?.observe?.flag === flag);
  if (!ks.length) return true;
  return ks.some((r) => !keystoneQuest(r.id) || !g.flags.has('keepers_line') || keystoneOpen(g, r.id));
}

/** a counter as a keystone's stage counts it: from when the keystone opened */
export function stageCount(g: Game, id: string | undefined, key: string): number {
  return Math.max(0, (g.counters[key] ?? 0) - (id ? g.research.base[`${id}|${key}`] ?? 0 : 0));
}
