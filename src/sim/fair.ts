// The Sprocket Fair's rules (ROADMAP.md 7.7, Phase 5), around the test bed (src/sim/testbed.ts).
// Three entries to beat, the Professor's, Bram's and Juniper's lines, which grow each year. The
// prizes, once per save, are the old Founder's Day candle rewards under their old flags (`candle_1`
// to `candle_4`, so a 1.x save keeps what it won): beat one entry, two, all three, and the top one
// by half. Tokens and coins every year by the day's best result, as the festivals have always paid.
// No system of its own: the Professor's window calls `fairResult` when a run ends.
import { FESTIVALS } from '../data/goals';
import type { FestivalDef } from '../data/types';
import type { Game } from './Game';
import { key } from './inventory';
import { CANDLE_REWARDS, claimCandles } from './systems/founders';

export interface FairEntry {
  /** the villager whose line it is */
  who: string;
  /** what the line makes, for the board ("pickled cogbeans from her crocks") */
  what: string;
  /** coins of goods a minute in the first year */
  base: number;
}

/**
 * Year 1 is tuned on the bed with sample lines (tests/fairs.test.ts): two crocks of pickled cogbeans
 * make about 220 coins a minute, four crocks 450, a furnace row of copper bars 370 a furnace, a grist
 * mill on barley about 800, three mills with Brass Arms 2,400.
 */
export const FAIR_ENTRIES: FairEntry[] = [
  { who: 'ottoline', what: 'pickled cogbeans from her crocks', base: 140 },
  { who: 'bram', what: 'copper bars from his furnace', base: 380 },
  { who: 'juniper', what: 'barley meal from their grist mills', base: 1700 },
];
/** each year the entries come back bigger, until the sixth */
export const FAIR_GROWTH = 1.6;
export const FAIR_TOP_YEAR = 6;

export const FAIR: FestivalDef = FESTIVALS.find((f) => f.id === 'f_fair')!;

/** this year's three entries, with their scores (coins of goods a minute) */
export function fairEntries(year: number): (FairEntry & { score: number })[] {
  const k = FAIR_GROWTH ** (Math.min(FAIR_TOP_YEAR, Math.max(1, year)) - 1);
  return FAIR_ENTRIES.map((e) => ({ ...e, score: Math.round((e.base * k) / 10) * 10 }));
}

/** how many of the year's entries a score beats, and whether it beats the top one by half */
export function fairPlace(year: number, score: number): { beaten: number; byHalf: boolean } {
  const es = fairEntries(year);
  const beaten = es.filter((e) => score > e.score).length;
  const top = Math.max(...es.map((e) => e.score));
  return { beaten, byHalf: score >= top * 1.5 };
}

export interface FairResult {
  score: number;
  beaten: number;
  byHalf: boolean;
  /** candle rewards won by this run (1-4: the purse, the Lantern, the Medal, the Gilded Clock) */
  candles: number[];
  /** this year's prize, paid now (what a better run adds to an earlier one's) */
  tickets: number;
  money: number;
  /** a best score for this save */
  best: boolean;
}

/** the year's tokens and coins by its best result: 0 for trying, then one, two, three entries beaten */
function yearPrize(tier: number): { tickets: number; money: number } {
  if (tier <= 0) return { tickets: 2, money: 0 };
  const p = FAIR.prizes[Math.min(tier, FAIR.prizes.length) - 1];
  return { tickets: p.items.find((i) => i.item === 'ticket')?.n ?? 0, money: p.money };
}

/** A run ended with this score: the candles it wins, the year's prize, and the festival counted. */
export function fairResult(g: Game, score: number): FairResult {
  const year = g.time.year;
  const { beaten, byHalf } = fairPlace(year, score);
  const candles = claimCandles(g, beaten + (beaten >= 3 && byHalf ? 1 : 0));
  // the year's prize goes by the day's best run, paid once (a better run pays the difference); a save
  // that went to Kite Day this year (its flag maps to the Fair's) had its prize
  const paidKey = 'fair_paid_' + year;
  const paid = g.counters[paidKey] ?? (g.flags.has(`fest_f_fair_${year}`) ? 4 : 0);
  const tier = Math.min(3, beaten);
  let tickets = 0, money = 0;
  if (tier + 1 > paid) {
    const before = paid > 0 ? yearPrize(paid - 1) : { tickets: 0, money: 0 };
    const now = yearPrize(tier);
    tickets = now.tickets - before.tickets;
    money = now.money - before.money;
    g.counters[paidKey] = tier + 1;
    if (tickets > 0) g.give(key('ticket'), tickets);
    if (money > 0) {
      g.player.money += money;
      g.earned += money;
    }
  }
  g.flags.add(`fest_f_fair_${year}`);
  // Festive Spirit counts each festival once
  if (!g.flags.has('fest_seen_f_fair')) {
    g.flags.add('fest_seen_f_fair');
    g.count('festivals');
  }
  if (beaten >= 3) g.count('fair_ribbons');
  const best = score > (g.counters.best_f_fair ?? 0);
  if (best) g.counters.best_f_fair = score;
  return { score, beaten, byHalf, candles, tickets, money, best };
}

/** the candle rewards' words ("The Founder's Lantern, for your farmhouse") */
export const candleText = (c: number) => CANDLE_REWARDS[c - 1] ?? '';
