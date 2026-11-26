// Town life: where a villager is when the day's schedule isn't the whole story. Pure (no system is
// imported here, so importing this never reorders the ticks; cross-system state is read through
// g.sys hooks). Three things, in this order (src/sim/systems/npcs.ts currentTarget):
//  - the Thursday market on the square (9am to 4pm on a dry Thursday, never in Clockwork Rush or on
//    a festival's day): five villagers stand at stalls, the Mayor at his bell, others stroll. A
//    keeper's stall is their shop for the day (F on them or on the counter), Hazel's odds table has
//    its own few things (src/sim/marketstall.ts);
//  - stints (`stints` on a villager, src/data/npcs.ts): part of a dry day at a town works once its
//    keystone's flag is set, out in front of the shop they keep (the door still opens), in the
//    school's yard, or at lunch on the square;
//  - otherwise the schedule.
// Nothing here is saved: it follows from the day, the weather and the flags.
import { NPC_BY_ID } from '../data/npcs';
import { SHOPS } from '../data/shops';
import type { NPCDef, StintDef } from '../data/types';
import type { Game } from './Game';
import { MARKET_CLOSE, MARKET_OPEN, MARKET_STALLS, MARKET_STROLL, MARKET_WEEKDAY, type MarketStall } from './world/townlife';

type Dir = 0 | 1 | 2 | 3;

/** a place to be, the way to face there and a bubble for now and then */
export interface Spot { loc: string; face?: Dir; emote?: string }

// ---------------- the market ----------------
/** is today a market day (a dry Thursday in the valley, no festival, not in Clockwork Rush)? */
export function marketDay(g: Game): boolean {
  return g.weekday === MARKET_WEEKDAY && g.map.w >= 200 && g.mode !== 'rush' && !g.isRaining() && !g.sys.festivals?.today?.(g);
}

/** the market is on right now (its stalls stand on the square) */
export function marketOn(g: Game): boolean {
  return marketDay(g) && g.time.min >= MARKET_OPEN && g.time.min < MARKET_CLOSE;
}

/** the Orders board's notice on market day (a festival's own notice comes first, src/ui/windows/orders.ts) */
export function marketNotice(g: Game): string | null {
  return marketDay(g) ? "Market day on the square, 9am to 4pm: the shopkeepers' stalls and the odds table." : null;
}

/** the next market day's date from tomorrow on, as [season, day] (the ledger's "coming up") */
export function nextMarket(g: Game): [number, number] {
  const ahead = ((MARKET_WEEKDAY - g.weekday + 6) % 7) + 1;
  let day = g.time.day + ahead, season: number = g.time.season;
  if (day > 28) {
    day -= 28;
    season = (season + 1) % 4;
  }
  return [season, day];
}

/** who strolls the market, and when ([from, to) minutes): the school all day, the Mayor between his bells, the doctor at lunch and after the clinic */
const STROLLERS: { who: string; spans: [number, number][] }[] = [
  { who: 'sable', spans: [[MARKET_OPEN, MARKET_CLOSE]] },
  { who: 'pip', spans: [[MARKET_OPEN, MARKET_CLOSE]] },
  { who: 'tobias', spans: [[MARKET_OPEN + 40, MARKET_CLOSE - 30]] },
  { who: 'ines', spans: [[15 * 60 + 5, MARKET_CLOSE]] },
  { who: 'ottoline', spans: [[MARKET_OPEN, MARKET_OPEN + 30]] },
  { who: 'thorne', spans: [[11 * 60 + 20, 13 * 60 + 20]] },
];
/** minutes a stroller stays at one stall before moving on */
const STROLL_STAY = 35;

export const stallOf = (id: string): MarketStall | undefined => MARKET_STALLS.find((s) => s.who === id);

/** where the market has this villager right now, if it does */
export function marketSpot(g: Game, id: string): Spot | null {
  if (!marketOn(g)) return null;
  const min = g.time.min;
  if (stallOf(id)) return { loc: 'mkt_' + id, face: 2 };
  // the Mayor rings it open and shut from his bell stand
  if (id === 'tobias' && (min < MARKET_OPEN + 40 || min >= MARKET_CLOSE - 30)) return { loc: 'mkt_bell', face: 2, emote: 'note' };
  const i = STROLLERS.findIndex((s) => s.who === id);
  if (i < 0 || !STROLLERS[i].spans.some(([a, b]) => min >= a && min < b)) return null;
  // Thorne comes to town only once the tram he ran is running again
  if (id === 'thorne' && !g.flags.has('tram')) return null;
  // each on their own round of the stalls: the same step for everyone, so no two share a spot
  const step = Math.floor((min - MARKET_OPEN) / STROLL_STAY);
  const k = (i + step * 3) % MARKET_STROLL.length;
  return { loc: 'mkt_s' + k, face: MARKET_STROLL[k][2] };
}

/** a shop's opening hours hold right now (its closed day and the clock; a festival shuts it) */
function inHours(g: Game, shopId: string): boolean {
  const s = SHOPS.find((x) => x.id === shopId);
  return !!s && !s.closedDays?.includes(g.weekday) && g.time.min >= s.open && g.time.min < s.close;
}

/**
 * The shop a villager trades from where they stand on market day: a keeper with a stall sells their
 * own shop's goods from it (and on the way there and back, within the shop's hours), Hazel the odds
 * table while the market is on. Null otherwise.
 */
export function stallShop(g: Game, n: { id: string; visible: boolean }): string | null {
  if (!n.visible || !marketDay(g)) return null;
  const st = stallOf(n.id);
  if (!st) return null;
  if (st.shop === 'market') return marketOn(g) ? 'market' : null;
  return g.time.min >= MARKET_OPEN && inHours(g, st.shop) ? st.shop : null;
}

/** is this shop's keeper away at their market stall today (the door says so)? */
export function atMarket(g: Game, shopId: string): boolean {
  if (!marketDay(g) || g.time.min < MARKET_OPEN || g.time.min >= MARKET_CLOSE) return false;
  return MARKET_STALLS.some((s) => s.shop === shopId);
}

// ---------------- stints ----------------
/** the stint a villager is on right now, given where the schedule has them */
export function stintFor(g: Game, d: NPCDef, scheduled: string): StintDef | null {
  if (!d.stints || g.map.w < 200 || g.isRaining()) return null;
  const min = g.time.min, wd = g.weekday;
  for (const s of d.stints) {
    if (min < s.from || min >= s.to) continue;
    if (s.flag && !g.flags.has(s.flag)) continue;
    if (s.noFlag && g.flags.has(s.noFlag)) continue;
    if (s.weekdays && !s.weekdays.includes(wd)) continue;
    if (s.ship && g.sys.exports?.ship !== 'port') continue;
    if (s.while && s.while !== scheduled) continue;
    if (!g.map.locs.has(s.at)) continue;
    return s;
  }
  return null;
}

/** where the market or a stint has this villager instead of the schedule's place, if either does */
export function lifeSpot(g: Game, id: string, scheduled: string): Spot | null {
  const mk = marketSpot(g, id);
  if (mk) return mk;
  const d = NPC_BY_ID.get(id);
  const st = d ? stintFor(g, d, scheduled) : null;
  return st ? { loc: st.at, face: st.face, emote: st.emote } : null;
}

/** the place in front of a shop where its keeper works outdoors ('<building>_front'; the schedules' short names too) */
export function frontOf(shopLoc: string): string {
  return shopLoc + '_front';
}
