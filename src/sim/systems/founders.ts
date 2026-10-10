// The Founder's candle rewards. Founder's Day's yearly review (the Mayor's 18-point candle count
// on spring 1) was retired in 2.0 Phase 5: the Sprocket Fair's prizes are the year's review now
// (src/sim/fair.ts). They are the same four rewards, under the same flags, so a 1.x save keeps what
// its candles won: beat one entry, two, all three, and the top one by half.
import type { Game } from '../Game';
import { key } from '../inventory';

export const CANDLE_REWARDS = [
  'A purse of 2,500 coins',
  "The Founder's Lantern, for your farmhouse",
  "The Founder's Medal: +5% on everything you ship",
  'The Gilded Clock and 20,000 coins',
];

/** grant every candle reward reached and not yet claimed; returns the newly granted tiers */
export function claimCandles(g: Game, candles: number): number[] {
  const out: number[] = [];
  for (let c = 1; c <= candles; c++) {
    if (g.flags.has('candle_' + c)) continue;
    g.flags.add('candle_' + c);
    out.push(c);
    if (c === 1) { g.player.money += 2500; g.earned += 2500; }
    if (c === 2) g.give(key('f_lantern'), 1);
    if (c === 3) g.flags.add('founders_medal');
    if (c === 4) { g.give(key('f_gilded_clock'), 1); g.player.money += 20000; g.earned += 20000; }
  }
  return out;
}

/** the Founder's Medal: +5% on everything you ship */
export function foundersBonus(g: Game) {
  return g.flags.has('founders_medal') ? 0.05 : 0;
}
