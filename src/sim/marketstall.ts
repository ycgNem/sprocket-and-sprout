// The odds table at the Thursday market (src/sim/townlife.ts): Hazel minds a stall for the shops
// whose keepers can't leave their counters. Each week it holds a few things from the Workshop, the
// Copper Kettle, the bait hut and the Brass Vixen, at the price the shop itself asks (the same
// entries, so a limit of so many a day is shared with the shop's own shelf). No state: the week's
// pick follows from the save's seed and the week. Kept apart from townlife.ts because this reads
// the shops' stock from the economy system, and townlife.ts must import no system.
import { SHOP_BY_ID } from '../data/shops';
import type { ShopDef, ShopEntry } from '../data/types';
import { Rng } from '../engine/rng';
import type { Game } from './Game';
import { shopStock } from './systems/economy';
import { MARKET_CLOSE, MARKET_OPEN } from './world/townlife';

/** the stall as the shop window sees it (it isn't in SHOPS: no door, no keeper's hours, nothing bought) */
export const ODDS_TABLE: ShopDef = {
  id: 'market', name: 'The Odds Table', owner: 'hazel', loc: 'square', open: MARKET_OPEN, close: MARKET_CLOSE, stock: [],
  greeting: "Odds from the shops that stayed in, at their own prices.",
};

/** the shops that send goods down, and how many things each */
const SENDERS: [string, number][] = [['workshop', 2], ['inn', 2], ['fisher', 1], ['airfreight', 1]];

/** this week's table: each sender's shelf in the week's own order, the first few you could buy there today */
export function oddsStock(g: Game): ShopEntry[] {
  const week = Math.floor(g.dayIndex / 7);
  const out: ShopEntry[] = [];
  SENDERS.forEach(([shopId, n], i) => {
    const shelf = SHOP_BY_ID.get(shopId)?.stock ?? [];
    const open = new Set(shopStock(g, shopId));
    const rng = new Rng((g.seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(i + 11, 0x85ebca6b)) >>> 0);
    let left = n;
    for (const e of rng.shuffle([...shelf])) {
      if (left <= 0) break;
      if (!open.has(e) || out.some((o) => o.item === e.item)) continue;
      out.push(e);
      left--;
    }
  });
  return out;
}
