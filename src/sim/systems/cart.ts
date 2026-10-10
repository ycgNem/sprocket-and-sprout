// Mags, the freight broker (ROADMAP.md 7.9, Phase 5): her cart parks by the town square on
// Fridays and Sundays (8am-7pm) with a week's stock from the far roads: rare components (brass
// gears, springs, spark coils, lenses, iron plates, lubricant, now and then a clockwork core), two
// or three seeds out of season (for the greenhouse), a sapling and one curio (a cart-only
// furniture piece or a recipe card). No gems or relics. When a business in town runs short (a
// shortage, src/sim/systems/orders.ts) she has its goods, or what they're made from, at a premium.
// On Sundays she auctions one lot at the cart (src/sim/auction.ts). The week's stock comes from its
// own seed; the world's random numbers go on as they did under the old peddler (worldDraws).
import { CROPS } from '../../data/crops';
import { FURNITURE } from '../../data/furniture';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../../data/items';
import { RECIPES } from '../../data/recipes';
import { RECIPE_TEACHERS } from '../../data/cookbook';
import type { ShopEntry } from '../../data/types';
import { Rng } from '../../engine/rng';
import { Game, registerSystem } from '../Game';

export interface CartState {
  stock: ShopEntry[];
  week: number;
  pos: [number, number] | null;
  /** the week whose Sunday lot has been sold (-1: none yet) */
  sold: number;
}

export const CART_OPEN = 8 * 60, CART_CLOSE = 19 * 60;

/** the components Mags brings, with her prices (above the Workshop's, below what a rush costs) */
export const CART_PARTS: [string, number][] = [
  ['brass_gear', 460], ['spring', 380], ['spark_coil', 980], ['lens', 440], ['iron_plate', 240], ['lubricant', 480],
];

export function cart(g: Game): CartState {
  if (!g.sys.cart) g.sys.cart = { stock: [], week: -1, pos: null, sold: -1 } as CartState;
  return g.sys.cart;
}

export function cartHere(g: Game): boolean {
  const c = g.sys.cart as CartState | undefined;
  if (!c?.pos || g.player.where !== 'world') return false;
  if (g.weekday !== 4 && g.weekday !== 6) return false;
  if (g.sys.festivals?.today?.(g)) return false;
  return g.time.min >= CART_OPEN && g.time.min < CART_CLOSE;
}

/** Sunday at the cart, and this week's lot not yet sold */
export const sundayLot = (g: Game) => cartHere(g) && g.weekday === 6 && cart(g).sold !== Math.floor(g.dayIndex / 7);

function findSpot(g: Game): [number, number] | null {
  const [sx, sy] = g.map.loc('square');
  for (let r = 3; r < 10; r++)
    for (const [dx, dy] of [[-r, 2], [r - 2, 2], [-r, -3], [r - 2, -3], [-1, r], [-1, -r]]) {
      const x = sx + dx, y = sy + dy;
      let ok = true;
      for (let yy = y; yy < y + 2 && ok; yy++) for (let xx = x; xx < x + 3 && ok; xx++) if (!g.map.walkable(xx, yy) || g.map.o(xx, yy)) ok = false;
      if (ok) return [x, y];
    }
  return null;
}

/** the week's own random numbers (per save and week) */
export const weekRng = (g: Game, week: number, salt: number) => new Rng((g.seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0);

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

/**
 * What Mags brings in a shortage: what the goods are made from where a machine makes them out of a
 * crop, fruit or ore (pickles: cogbeans; copper bars: ore), else the goods themselves; at three
 * times their market price, enough of it a day for the doubled order.
 */
export function shortStock(spec: string, n: number): ShopEntry | null {
  const id = spec[0] === '#' ? ITEMS.find((d) => d.price > 0 && matchesSpec(d, spec))?.id : spec;
  if (!id || !ITEM_BY_ID.has(id)) return null;
  const r = RECIPES.find((x) => x.station !== 'hand' && x.out[0].item === id && x.in.length === 1 && x.in[0].item[0] !== '#');
  const raw = r && ['crop', 'fruit', 'ore'].includes(ITEM_BY_ID.get(r.in[0].item)?.cat ?? '') ? r.in[0].item : id;
  const per = raw === id ? 1 : r!.in[0].n / r!.out[0].n;
  return { item: raw, price: round10(ITEM_BY_ID.get(raw)!.price * 3), daily: Math.max(5, Math.ceil(n * per)) };
}

/**
 * The traveling peddler's weekly restock (1.x) drew ten or eleven numbers from the world's random
 * numbers, and every later roll (the weather, the crops, the pacing bot's numbers) follows from
 * them. The broker's stock has its own seed, so she draws and drops the same ones on the same day.
 */
function worldDraws(g: Game) {
  for (let i = 0; i < 9; i++) g.rng.next();
  if (g.rng.next() < 0.4) g.rng.next();
}

function restock(g: Game) {
  const c = cart(g);
  const week = Math.floor(g.dayIndex / 7);
  const rng = weekRng(g, week, 1);
  const out: ShopEntry[] = [];
  const add = (item: string, price: number, daily: number) => {
    if (ITEM_BY_ID.has(item) && !out.some((e) => e.item === item)) out.push({ item, price: round10(price), daily });
  };
  // four of the six rare components, and now and then a clockwork core
  for (const [id, price] of rng.shuffle([...CART_PARTS]).slice(0, 4)) add(id, price, 5);
  if (rng.next() < 0.3) add('clockwork_core', 2600, 1);
  // two or three seeds out of season, for the greenhouse
  const off = CROPS.filter((cr) => ITEM_BY_ID.has(cr.seed) && !cr.seasons.includes(g.time.season));
  for (const cr of rng.shuffle([...off]).slice(0, rng.next() < 0.5 ? 2 : 3)) add(cr.seed, cr.seedPrice * 2.5 + 40, 5);
  // a sapling
  const saps = ITEMS.filter((d) => d.id.endsWith('_sapling'));
  if (saps.length) add(rng.pick(saps).id, 1800, 1);
  // one curio: a piece of furniture only the cart has, or a recipe card you don't know yet
  const furn = FURNITURE.filter((f) => f.shop === 'cart');
  const cards = Object.keys(RECIPE_TEACHERS).filter((id) => !g.flags.has('recipe_' + id) && ITEM_BY_ID.has('card_' + id));
  if (cards.length && rng.next() < 0.5) add('card_' + rng.pick(cards), 1200, 1);
  else if (furn.length) {
    const f = rng.pick(furn);
    add(f.id, f.price, 1);
  }
  // a business that has run short this week (orders.ts posts it on Monday, before the cart restocks)
  const short = g.sys.orders?.short as { week: number; spec: string; n: number } | undefined;
  if (short && short.week === week) {
    const e = shortStock(short.spec, short.n);
    if (e && !out.some((x) => x.item === e.item)) out.push(e);
  }
  c.stock = out;
  c.week = week;
}

registerSystem({
  name: 'cart',
  dayStart(g) {
    if (g.map.w < 100) return;
    const c = cart(g);
    if (!c.pos) c.pos = findSpot(g);
    if (c.week !== Math.floor(g.dayIndex / 7)) {
      worldDraws(g);
      restock(g);
    }
    if ((g.weekday === 4 || g.weekday === 6) && c.pos && g.daysPlayed > 2 && !g.flags.has('cart_seen')) {
      g.flags.add('cart_seen');
      g.toast("Mags' freight cart is on the town square: rare parts from the far roads, Fridays and Sundays.");
    }
  },
  save(g) {
    const c = g.sys.cart as CartState | undefined;
    return c ? { v: 2, stock: c.stock, week: c.week, sold: c.sold } : null;
  },
  load(g, d) {
    if (!d) return;
    const c = cart(g);
    c.stock = (d.stock ?? []).filter((e: ShopEntry) => ITEM_BY_ID.has(e.item));
    c.week = d.week ?? -1;
    c.sold = d.sold ?? -1;
    // a save from before the broker had the traveling peddler's stock (gems, relics, tonics): this
    // week's comes from the far roads instead
    if (d.v !== 2 && g.map.w >= 100) restock(g);
  },
});
