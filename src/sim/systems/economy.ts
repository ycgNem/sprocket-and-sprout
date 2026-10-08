// Economy: dynamic market prices (supply saturation, weekly demand, daily drift),
// overnight shipping, shop buying/selling, tool upgrades and building kits.
import type { ItemDef } from '../../data/types';
import { guildBonus } from './contracts';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { BUILDING_KITS, SHOP_BY_ID, TOOL_UPGRADE_COST } from '../../data/shops';
import type { ItemCategory, ShopEntry } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { Inventory, key, kDef, kIdx, QUALITY_MULT, Stack } from '../inventory';
import { TIER_NAMES } from '../../data/items';

export interface Market {
  /** item index -> recent units sold (decays daily) */
  sat: Record<number, number>;
  /** category -> daily drift multiplier */
  drift: Record<string, number>;
  /** this week's in-demand item ids */
  hot: string[];
  /** price history per item index (last 14 days multipliers) */
  hist: Record<number, number[]>;
  /** shop purchase counts today (entry key -> n) */
  bought: Record<string, number>;
  /** total units of an item shipped ever */
  shipped: Record<string, number>;
}

export function market(g: Game): Market {
  if (!g.sys.market) g.sys.market = {};
  const m = g.sys.market as any;
  m.sat ??= {};
  m.drift ??= {};
  m.hot ??= [];
  m.hist ??= {};
  m.bought ??= {};
  m.shipped ??= {};
  m.mult = (gg: Game, idx: number) => priceMult(gg, idx);
  m.priceOf = (gg: Game, k: number) => unitPrice(gg, k);
  return m as Market;
}

/** Units sold that halve the price (cheap goods saturate slower). */
function satScale(price: number) {
  return Math.max(25, Math.round(5000 / Math.max(1, price)));
}

export function priceMult(g: Game, idx: number): number {
  const m = market(g);
  const d = ITEMS[idx];
  if (!d) return 1;
  const s = m.sat[idx] ?? 0;
  const sat = 1 / (1 + s / satScale(d.price));
  const drift = m.drift[d.cat] ?? 1;
  const hot = m.hot.includes(d.id) ? 1.4 : 1;
  return Math.max(0.3, sat * drift * hot);
}

/** profession price bonuses by category */
function perkPrice(g: Game, d: ItemDef): number {
  const pk = g.player.perks;
  if (!pk.length) return 1;
  let m = 1;
  if ((d.cat === 'crop' || d.cat === 'fruit') && pk.includes('tiller')) m *= 1.1;
  if (d.cat === 'animal' && pk.includes('rancher')) m *= 1.2;
  if (d.cat === 'artisan' && pk.includes('artisan')) m *= 1.25;
  if ((d.id === 'plank' || d.id === 'beam' || d.id === 'hardwood' || d.id === 'resin' || d.id === 'syrup') && pk.includes('tapper_pro')) m *= 1.4;
  if ((d.cat === 'gem' || d.cat === 'mineral') && pk.includes('geologist')) m *= 1.3;
  if (d.cat === 'bar' && pk.includes('blacksmith')) m *= 1.4;
  if (d.cat === 'fish' && pk.includes('angler')) m *= 1.25;
  return m;
}

export function unitPrice(g: Game, k: number): number {
  const d = kDef(k);
  if (d.price <= 0) return 0;
  return Math.max(1, Math.round(d.price * QUALITY_MULT[k & 3] * priceMult(g, kIdx(k)) * perkPrice(g, d) * (1 + g.mods.marketBonus + (g.sys.megaBonus?.market ?? 0) + guildBonus(g))));
}

/** Sell a stack right now (shipping or shops). Returns coins earned; updates saturation per unit. */
export function sellStack(g: Game, k: number, n: number, factor = 1): number {
  const m = market(g);
  const idx = kIdx(k);
  let total = 0;
  // sell in chunks so saturation rises during big sales
  const chunk = Math.max(1, Math.ceil(n / 20));
  let left = n;
  while (left > 0) {
    const c = Math.min(chunk, left);
    total += unitPrice(g, k) * c * factor;
    m.sat[idx] = (m.sat[idx] ?? 0) + c;
    left -= c;
  }
  const id = ITEMS[idx].id;
  m.shipped[id] = (m.shipped[id] ?? 0) + n;
  g.stats.use(k, n);
  g.sys.collections?.shipped?.(g, k, n);
  g.sys.quests?.notify?.(g, 'ship', n, id);
  return Math.round(total);
}

function rollWeek(g: Game) {
  const m = market(g);
  const pool = ITEMS.filter((d) => d.price > 20 && ['crop', 'fruit', 'artisan', 'animal', 'fish', 'food', 'component', 'flower'].includes(d.cat) && !d.id.startsWith('juice_'));
  m.hot = [];
  for (let i = 0; i < 4; i++) m.hot.push(g.rng.pick(pool).id);
}

function rollDrift(g: Game) {
  const m = market(g);
  const cats: ItemCategory[] = ['crop', 'fruit', 'flower', 'forage', 'animal', 'artisan', 'fish', 'mineral', 'ore', 'bar', 'gem', 'resource', 'component', 'food'];
  for (const c of cats) {
    const prev = m.drift[c] ?? 1;
    // mean-reverting random walk
    m.drift[c] = Math.max(0.8, Math.min(1.25, prev + (1 - prev) * 0.3 + (g.rng.next() - 0.5) * 0.08));
  }
  // seasonal flavor: winter crops scarce, fruit dear in spring
  if (g.time.season === 3) m.drift.crop = Math.min(1.3, (m.drift.crop ?? 1) + 0.1);
}

export function shipAll(g: Game): { sold: { k: number; n: number; price: number }[]; total: number } {
  const bins = g.ents.others.filter((e) => e.def.kind === 'shipbin' && e.inv);
  const agg = new Map<number, number>();
  for (const b of bins) {
    for (const s of b.inv!.slots) if (s) agg.set(s.k, (agg.get(s.k) ?? 0) + s.n);
    b.inv!.slots.fill(null);
  }
  const sold: { k: number; n: number; price: number }[] = [];
  let total = 0;
  for (const [k, n] of agg) {
    const coins = sellStack(g, k, n);
    total += coins;
    sold.push({ k, n, price: Math.round(coins / n) });
  }
  sold.sort((a, b) => b.price * b.n - a.price * a.n);
  return { sold, total };
}

// ---------------- shops ----------------
export function entryPrice(g: Game, e: ShopEntry): number {
  const d = ITEM_BY_ID.get(e.item)!;
  const base = e.price ?? Math.max(10, d.price * 2);
  const m = market(g);
  const bought = m.bought[e.item] ?? 0;
  // the general store adjusts prices: early-season seed discounts, and stock you clear out gets pricier
  let f = 1 + Math.min(0.3, bought * 0.004);
  if (d.cat === 'seed' && g.time.day <= 7) f *= 0.9;
  if (d.cat === 'seed' && g.time.day >= 22) f *= 1.1;
  return Math.max(1, Math.round(base * f));
}

export function shopStock(g: Game, shopId: string): ShopEntry[] {
  const s = SHOP_BY_ID.get(shopId);
  if (!s) return [];
  return s.stock.filter((e) => (!e.seasons || e.seasons.includes(g.time.season)) && g.unlocked(e.unlock) && ITEM_BY_ID.has(e.item));
}

export function dailyLeft(g: Game, e: ShopEntry): number {
  if (!e.daily) return Infinity;
  return e.daily - (market(g).bought['d:' + e.item] ?? 0);
}

export function buy(g: Game, e: ShopEntry, n: number): number {
  const p = g.player;
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (dailyLeft(g, e) <= 0) break;
    const price = entryPrice(g, e);
    if (p.money < price) {
      if (!got) g.toast("You can't afford that.");
      break;
    }
    const k = key(e.item);
    if (p.inv.space(k) <= 0) {
      g.toast('Your bag is full.');
      break;
    }
    p.money -= price;
    p.inv.add(k, 1);
    const m = market(g);
    m.bought[e.item] = (m.bought[e.item] ?? 0) + 1;
    if (e.daily) m.bought['d:' + e.item] = (m.bought['d:' + e.item] ?? 0) + 1;
    got++;
  }
  if (got) {
    g.emit({ t: 'sfx', id: 'buy' });
    g.sys.quests?.notify?.(g, 'have', 0);
  }
  return got;
}

export function shopBuys(shopId: string, k: number): boolean {
  const s = SHOP_BY_ID.get(shopId);
  const d = kDef(k);
  return !!s?.buys?.includes(d.cat) && d.price > 0;
}

/** sell to a shop directly: 90% of market price, paid now */
export function sellToShop(g: Game, k: number, n: number): number {
  const coins = sellStack(g, k, n, 0.9);
  g.player.money += coins;
  g.earned += coins;
  g.emit({ t: 'sfx', id: 'sell' });
  return coins;
}

// ---------------- smithy services ----------------
export const TOOL_KINDS = ['hoe', 'can', 'axe', 'pick', 'scythe'];

export function upgradeOptions(g: Game) {
  const inv = g.player.inv;
  const out: { slot: number; from: string; to: string; tier: number; coins: number; bar: string; bars: number }[] = [];
  inv.slots.forEach((s, i) => {
    if (!s) return;
    const d = kDef(s.k);
    if (!d.tool || !TOOL_KINDS.includes(d.tool.kind) || d.tool.tier >= 4) return;
    const [coins, bar, bars] = TOOL_UPGRADE_COST[d.tool.tier];
    out.push({ slot: i, from: d.id, to: `${d.tool.kind}_${d.tool.tier + 1}`, tier: d.tool.tier + 1, coins, bar, bars });
  });
  return out;
}

export function startUpgrade(g: Game, opt: ReturnType<typeof upgradeOptions>[number]): string | null {
  const p = g.player;
  if (p.upgrading) return 'Bram is already working on one of your tools.';
  if (p.money < opt.coins) return 'Not enough coins.';
  if (p.inv.countId(opt.bar) < opt.bars) return `You need ${opt.bars} ${ITEM_BY_ID.get(opt.bar)!.name}s.`;
  p.money -= opt.coins;
  p.inv.removeSpec(opt.bar, opt.bars);
  p.inv.slots[opt.slot] = null;
  p.upgrading = { tool: opt.from, to: opt.to, days: 2 };
  g.emit({ t: 'sfx', id: 'clang' });
  return null;
}

export function crackGeode(g: Game): string | null {
  const p = g.player;
  if (p.money < 25) return 'It costs 25 coins.';
  const n = p.inv.removeSpec('geode', 1);
  if (!n.length) return 'You have no geodes.';
  p.money -= 25;
  const table: [string, number][] = [['quartz', 30], ['mica', 18], ['calcite', 14], ['jasper', 10], ['topaz', 9], ['amethyst', 8], ['fluorite', 5], ['obsidian', 4], ['jade', 3], ['ruby', 2], ['sapphire', 1.5], ['opal', 1], ['starstone', 0.4], ['old_cog', 1]];
  const id = g.rng.weighted(table, (t) => t[1])[0];
  g.give(key(id), 1);
  g.emit({ t: 'sfx', id: 'rockbreak' });
  return `Inside: ${ITEM_BY_ID.get(id)!.name}!`;
}

// ---------------- carpenter ----------------
export function kitCost(id: string) {
  return BUILDING_KITS.find((k) => k.id === id);
}

export function canAffordKit(g: Game, id: string): boolean {
  const k = kitCost(id);
  if (!k) return false;
  if (g.player.money < k.price) return false;
  return k.materials.every((m) => g.player.inv.countId(m.item) >= m.n);
}

export function buyKit(g: Game, id: string): string | null {
  const k = kitCost(id);
  if (!k) return 'Unknown';
  if (!canAffordKit(g, id)) return 'You need more coins or materials.';
  if (k.upgradeOf) {
    const b = g.ents.others.find((e) => e.def.id === k.upgradeOf);
    if (!b) return `You need a ${ITEM_BY_ID.get(k.upgradeOf)!.name} first.`;
  }
  g.player.money -= k.price;
  for (const m of k.materials) g.player.inv.removeSpec(m.item, m.n);
  if (k.upgradeOf) {
    // upgrade in place: swap the def, keep animals & storage
    const b = g.ents.others.find((e) => e.def.id === k.upgradeOf)!;
    g.sys.buildings?.upgrade?.(g, b, id);
    g.toast(`Juniper will have your ${ITEM_BY_ID.get(id)!.name} ready by morning!`);
  } else {
    g.give(key(id), 1);
    g.toast(`You received a ${ITEM_BY_ID.get(id)!.name} kit. Place it on your farm!`);
  }
  g.emit({ t: 'sfx', id: 'buy' });
  return null;
}

registerSystem({
  name: 'economy',
  dayEnd(g, summary) {
    const res = shipAll(g);
    summary.sold = res.sold;
    summary.total = res.total;
    g.player.money += res.total;
    g.earned += res.total;
    const m = market(g);
    // saturation decays ~18% a day so the market recovers over a week or two
    for (const k of Object.keys(m.sat)) {
      const v = m.sat[+k] * (g.sys.megaBonus?.market ? 0.67 : 0.82);
      if (v < 0.5) delete m.sat[+k];
      else m.sat[+k] = v;
    }
    m.bought = Object.fromEntries(Object.entries(m.bought).filter(([k]) => !k.startsWith('d:')).map(([k, v]) => [k, Math.floor(v * 0.7)]));
    // tool upgrades
    const p = g.player;
    if (p.upgrading) {
      p.upgrading.days--;
      if (p.upgrading.days <= 0) {
        const to = p.upgrading.to;
        p.upgrading = null;
        g.sys.mail?.send?.(g, 'smithy_done', { tool: to });
        const left = p.inv.add(key(to), 1);
        if (left) g.sys.pendingGifts = [...(g.sys.pendingGifts ?? []), to];
        g.toast(`Your ${ITEM_BY_ID.get(to)!.name} is ready! (${TIER_NAMES[+to.split('_')[1]]})`);
      }
    }
  },
  dayStart(g) {
    const m = market(g);
    rollDrift(g);
    if (g.weekday === 0 || !m.hot.length) rollWeek(g);
    for (let i = 0; i < ITEMS.length; i++) {
      if (!(m.sat[i] || m.hist[i])) continue;
      const h = (m.hist[i] ??= []);
      h.push(priceMult(g, i));
      if (h.length > 14) h.shift();
    }
  },
  save(g: Game) {
    const m = market(g);
    const idToSat: Record<string, number> = {};
    for (const [k, v] of Object.entries(m.sat)) idToSat[ITEMS[+k].id] = v;
    return { sat: idToSat, drift: m.drift, hot: m.hot, bought: m.bought, shipped: m.shipped };
  },
  load(g: Game, d: any) {
    const m = market(g);
    m.sat = {};
    for (const [id, v] of Object.entries(d.sat ?? {})) {
      const idx = ITEMS.findIndex((i) => i.id === id);
      if (idx >= 0) m.sat[idx] = v as number;
    }
    m.drift = d.drift ?? {};
    m.hot = d.hot ?? [];
    m.bought = d.bought ?? {};
    m.shipped = d.shipped ?? {};
  },
});

export { Inventory };
export type { Stack };
