// The Sprocket Fair's rules (ROADMAP.md 7.7, Phase 5), around the test bed (src/sim/testbed.ts).
// Three entries to beat, the Professor's, Bram's and Juniper's lines, which grow each year. The
// prizes, once per save, are the old Founder's Day candle rewards under their old flags (`candle_1`
// to `candle_4`, so a 1.x save keeps what it won): beat one entry, two, all three, and (from the
// second year) the top one by half. Tokens and coins every year by the day's best result, as the
// festivals have always paid; a line that adds no value wins nothing. No system of its own: the
// Professor's window calls `fairResult` when a run ends.
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
  /** the value its line adds in the first year, coins a minute */
  base: number;
}

/**
 * Year 1 is tuned on the plate against the pacing bot's farms on spring 13 (seeds 2024, 7 and 99) and
 * sample lines (tests/fairs.test.ts records them): a crock of pickled cogbeans adds 68 coins a minute
 * (the keeper's line copied, a gleaner's crock line), two crocks 136, four 271; a furnace row of copper
 * 276 (its 99 ore last the run), six rows 1,656, six of tin 1,933; the keeper's river mill copied 373;
 * three grist mills on barley 1,119, on grain 2,138, on beets 2,366; six furnace rows of iron 2,522. So
 * any first line beats the Professor, a dense spring line (four crocks, a furnace row, the river mill)
 * beats Bram, and Juniper waits for the Mill era's lines (grist mills on grain or beets, sawmills) or a
 * smelting line on iron from the Frost.
 */
export const FAIR_ENTRIES: FairEntry[] = [
  { who: 'ottoline', what: 'pickled cogbeans from her old crock', base: 50 },
  { who: 'bram', what: 'copper bars from his furnace', base: 250 },
  { who: 'juniper', what: 'flour from their grist mills', base: 2000 },
];
/** each year the entries come back bigger, until the sixth */
export const FAIR_GROWTH = 1.25;
export const FAIR_TOP_YEAR = 6;
/** the Gilded Clock (the fourth candle: half again the top entry) is for the second year on */
export const CLOCK_YEAR = 2;

export const FAIR: FestivalDef = FESTIVALS.find((f) => f.id === 'f_fair')!;

/** this year's three entries, with their scores (the value their lines add, coins a minute) */
export function fairEntries(year: number): (FairEntry & { score: number })[] {
  const k = FAIR_GROWTH ** (Math.min(FAIR_TOP_YEAR, Math.max(1, year)) - 1);
  return FAIR_ENTRIES.map((e) => ({ ...e, score: Math.round((e.base * k) / 10) * 10 }));
}

/** can this year's run win the Gilded Clock (from the second year)? */
export const clockYear = (year: number) => year >= CLOCK_YEAR;

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
  /** this year's prize, paid now (what a better run adds to an earlier one's); none for a line that adds no value */
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
  const candles = claimCandles(g, beaten + (beaten >= 3 && byHalf && clockYear(year) ? 1 : 0));
  // the year's prize goes by the day's best run, paid once (a better run pays the difference); a save
  // that went to Kite Day this year (its flag maps to the Fair's) had its prize
  const paidKey = 'fair_paid_' + year;
  const paid = g.counters[paidKey] ?? (g.flags.has(`fest_f_fair_${year}`) ? 4 : 0);
  // a line that adds no value (or destroys it) wins nothing, not even the tokens for trying
  const tier = score > 0 ? Math.min(3, beaten) : -1;
  let tickets = 0, money = 0;
  if (tier >= 0 && tier + 1 > paid) {
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
  } else g.counters[paidKey] = paid; // kept: the day's flag below must not read as a Kite Day save's prize
  g.flags.add(`fest_f_fair_${year}`);
  // Festive Spirit counts each festival once
  if (!g.flags.has('fest_seen_f_fair')) {
    g.flags.add('fest_seen_f_fair');
    g.count('festivals');
  }
  if (beaten >= 3) g.count('fair_ribbons');
  const best = score > 0 && score > (g.counters.best_f_fair ?? 0);
  if (best) g.counters.best_f_fair = score;
  return { score, beaten, byHalf, candles, tickets, money, best };
}

/** the candle rewards' words ("The Founder's Lantern, for your farmhouse") */
export const candleText = (c: number) => CANDLE_REWARDS[c - 1] ?? '';
