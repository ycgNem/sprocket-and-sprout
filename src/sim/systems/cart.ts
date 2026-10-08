// Mags' Traveling Cart: parks by the town square on Fridays and Sundays with a weekly stock
// of rare seeds, saplings, gems, recipe cards and furniture you can't buy anywhere else.
import { CROPS } from '../../data/crops';
import { FURNITURE } from '../../data/furniture';
import { ITEM_BY_ID } from '../../data/items';
import { RECIPE_TEACHERS } from '../../data/cookbook';
import type { ShopEntry } from '../../data/types';
import { Game, registerSystem } from '../Game';

export interface CartState {
  stock: ShopEntry[];
  week: number;
  pos: [number, number] | null;
}

export const CART_OPEN = 8 * 60, CART_CLOSE = 19 * 60;

export function cart(g: Game): CartState {
  if (!g.sys.cart) g.sys.cart = { stock: [], week: -1, pos: null } as CartState;
  return g.sys.cart;
}

export function cartHere(g: Game): boolean {
  const c = g.sys.cart as CartState | undefined;
  if (!c?.pos || g.player.where !== 'world') return false;
  if (g.weekday !== 4 && g.weekday !== 6) return false;
  if (g.sys.festivals?.today?.(g)) return false;
  return g.time.min >= CART_OPEN && g.time.min < CART_CLOSE;
}

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

function restock(g: Game) {
  const c = cart(g);
  const rng = g.rng;
  const pick = <T,>(a: T[]) => a[Math.floor(rng.next() * a.length)];
  const out: ShopEntry[] = [];
  const add = (item: string, price: number, daily: number) => {
    if (ITEM_BY_ID.has(item) && !out.some((e) => e.item === item)) out.push({ item, price: Math.round(price / 10) * 10, daily });
  };
  // rare and out-of-season seeds
  const seeds = CROPS.filter((cr) => ITEM_BY_ID.has(cr.seed));
  for (let i = 0; i < 3; i++) {
    const cr = pick(seeds);
    add(cr.seed, cr.seedPrice * 2.5 + 40, 5);
  }
  // a sapling
  const saps = [...ITEM_BY_ID.values()].filter((d) => d.id.endsWith('_sapling'));
  if (saps.length) add(pick(saps).id, 1800, 1);
  // a gem or relic
  add(pick(['ruby', 'sapphire', 'opal', 'jade', 'topaz', 'amethyst', 'fossil_shell', 'star_chart']), 900, 1);
  // a recipe card you don't know yet (or any)
  const cards = Object.keys(RECIPE_TEACHERS).filter((id) => !g.flags.has('recipe_' + id));
  const card = cards.length ? pick(cards) : pick(Object.keys(RECIPE_TEACHERS));
  add('card_' + card, 1200, 1);
  // two pieces of furniture, cart exclusives first
  const furn = FURNITURE.filter((f) => f.shop === 'cart');
  const f1 = pick(furn), f2 = pick(FURNITURE.filter((f) => f.price > 0 && f !== f1));
  add(f1.id, f1.price, 1);
  add(f2.id, Math.round(f2.price * 1.2), 1);
  // now and then something special
  if (rng.next() < 0.3) add('heart_charm', 6000, 1);
  if (rng.next() < 0.4) add(pick(['super_tonic', 'grow_tonic', 'geode']), 300, 5);
  c.stock = out;
  c.week = Math.floor(g.dayIndex / 7);
}

registerSystem({
  name: 'cart',
  dayStart(g) {
    if (g.map.w < 100) return;
    const c = cart(g);
    if (!c.pos) c.pos = findSpot(g);
    if (c.week !== Math.floor(g.dayIndex / 7)) restock(g);
    if ((g.weekday === 4 || g.weekday === 6) && c.pos && g.daysPlayed > 2 && !g.flags.has('cart_seen')) {
      g.flags.add('cart_seen');
      g.toast("A traveling cart has rolled into the town square! It visits on Fridays and Sundays.");
    }
  },
  save(g) {
    const c = g.sys.cart as CartState | undefined;
    return c ? { stock: c.stock, week: c.week } : null;
  },
  load(g, d) {
    if (!d) return;
    const c = cart(g);
    c.stock = (d.stock ?? []).filter((e: ShopEntry) => ITEM_BY_ID.has(e.item));
    c.week = d.week ?? -1;
  },
});
