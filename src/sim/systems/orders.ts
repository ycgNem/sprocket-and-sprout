// Orders (ROADMAP.md 7.4, Phase 2's minimal board): the town's standing orders, filled by hand at
// the villager or by consignment. A crate tagged for a customer (`st.tag` = their id) sends what
// fits their open order at each post (noon, 6pm, overnight) before the market gets the rest:
// orders pay above market and never saturate it. The daily asks ("Today") are still the requests
// in src/sim/systems/quests.ts; the board shows both. Phase 3 folds contracts and projects in.
import { ITEM_BY_ID, matchesSpec } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { C } from '../../data/palette';
import { STANDING, STANDING_BY_ID, type StandingDef } from '../../data/orders';
import { WEEKDAYS } from '../../data/types';
import { questName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { key, kDef, kQ, type ItemKey } from '../inventory';
import { lesson } from '../lessons';
import { addPoints, hearts, npcSys } from './npcs';

export interface Order {
  id: string;
  n: number;
  have: number;
  /** the last day (dayIndex) to fill it */
  due: number;
  /** the day it was posted */
  day: number;
}

export interface OrdersState {
  open: Order[];
  /** times each standing order was filled */
  filled: Record<string, number>;
  /** reputation per customer (villager id): +1 per filled order */
  rep: Record<string, number>;
  /** standing orders ever posted (the crate can be tagged for their customers) */
  posted: string[];
}

export function orders(g: Game): OrdersState {
  if (!g.sys.orders) g.sys.orders = { open: [], filled: {}, rep: {}, posted: [] } as OrdersState;
  const o = g.sys.orders as OrdersState & Record<string, any>;
  o.hand = handDeliver;
  o.consign = consign;
  return o;
}

export const orderDef = (o: Order): StandingDef => STANDING_BY_ID.get(o.id)!;
export const filled = (g: Game, id: string) => orders(g).filled[id] ?? 0;
export const openOrder = (g: Game, id: string) => orders(g).open.find((o) => o.id === id) ?? null;

/** "by Friday", "by tomorrow", "today" */
export function dueText(g: Game, o: Order): string {
  if (!orderDef(o).weekly) return 'no rush';
  const d = o.due - g.dayIndex;
  if (d <= 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `due ${WEEKDAYS[(g.weekday + d) % 7]}`;
}

/** coins for n of item k on this order: silver or better pays double where the order says so */
export function payFor(def: StandingDef, k: ItemKey, n: number): number {
  return def.unit * n * (def.silver && kQ(k) >= 1 ? 2 : 1);
}

/** the next Friday at least two days away */
function nextFriday(g: Game): number {
  let d = (4 - g.weekday + 7) % 7;
  if (d < 2) d += 7;
  return g.dayIndex + d;
}

function post(g: Game, def: StandingDef) {
  const os = orders(g);
  const rep = os.rep[def.npc] ?? 0;
  const n = def.weekly && filled(g, def.id) > 0 ? def.n + 2 * Math.min(5, rep) : def.n;
  os.open.push({ id: def.id, n, have: 0, due: def.weekly ? nextFriday(g) : g.dayIndex + 365, day: g.dayIndex });
  if (!os.posted.includes(def.id)) os.posted.push(def.id);
  const who = questName(def.npc, NPC_BY_ID.get(def.npc)?.name ?? def.npc);
  g.toast(`${who} posted an order on the board: ${n} ${ITEM_BY_ID.get(def.spec)?.name ?? def.spec}.`, 'i:' + def.spec, C.amber);
  lesson(g, 'consign');
}

/** is this standing order on offer to this save right now (before weekly renewals)? */
function available(g: Game, def: StandingDef): boolean {
  if (g.map.w < 100 || g.mode === 'sandbox') return false;
  const q = g.sys.quests;
  const on = (id: string) => !!q?.active?.some((a: { id: string }) => a.id === id) || !!q?.done?.includes(id);
  const keeper = g.flags.has('keepers_line');
  if (def.id === 'rowan_pickles') return keeper ? on('k7_town') : g.dayIndex >= 2;
  if (def.id === 'bram_oil') return keeper && on('k8_river');
  return false;
}

/** post what's due: a first order the moment it's on offer, weekly ones each Monday */
function postDue(g: Game, monday: boolean) {
  const os = orders(g);
  for (const def of STANDING) {
    if (os.open.some((o) => o.id === def.id) || !available(g, def)) continue;
    const n = filled(g, def.id);
    if (n === 0 && !os.posted.includes(def.id)) post(g, def);
    else if (def.weekly && n > 0 && monday) post(g, def);
  }
}

function complete(g: Game, o: Order, via: 'hand' | 'post') {
  const os = orders(g);
  const def = orderDef(o);
  os.open = os.open.filter((x) => x !== o);
  os.filled[o.id] = (os.filled[o.id] ?? 0) + 1;
  os.rep[def.npc] = (os.rep[def.npc] ?? 0) + 1;
  for (const it of def.reward?.items ?? []) g.give(key(it.item), it.n);
  if (def.reward?.money) {
    g.player.money += def.reward.money;
    g.earned += def.reward.money;
  }
  const n = npcSys(g).byId.get(def.npc);
  if (n) addPoints(g, n, 60);
  g.count('orders');
  g.emit({ t: 'sfx', id: 'quest' });
  g.toast(`${def.place}'s order filled${via === 'post' ? ' by the post' : ''}! Reputation ${os.rep[def.npc]}${def.reward ? '. ' + def.reward.text : ''}`, 'i:' + def.spec, C.lime);
  g.sys.quests?.notify?.(g, 'order', 1, o.id);
}

/**
 * Deliver up to n of item k to an order; returns how many it took and what they pay. By hand the
 * coins are paid now; by the post they join the post's total (economy.ts pays it).
 */
function deliver(g: Game, o: Order, k: ItemKey, n: number, via: 'hand' | 'post'): { took: number; coins: number } {
  const def = orderDef(o);
  const took = Math.min(n, o.n - o.have);
  if (took <= 0) return { took: 0, coins: 0 };
  o.have += took;
  const coins = payFor(def, k, took);
  if (coins && via === 'hand') {
    g.player.money += coins;
    g.earned += coins;
  }
  g.stats.use(k, took);
  g.sys.collections?.shipped?.(g, k, took);
  if (o.have >= o.n) complete(g, o, via);
  return { took, coins };
}

const fits = (o: Order, k: ItemKey) => matchesSpec(kDef(k), orderDef(o).spec);

/** open orders of a customer that take item k */
export function ordersFor(g: Game, npc: string, k?: ItemKey): Order[] {
  return orders(g).open.filter((o) => orderDef(o).npc === npc && (k === undefined || fits(o, k)));
}

/**
 * F at a villager holding something their open order wants: the bag's matching goods go in,
 * silver first (it pays double), up to what the order still needs.
 */
export function handDeliver(g: Game, npc: string, k: ItemKey): boolean {
  const list = ordersFor(g, npc, k);
  if (!list.length) return false;
  const o = list[0];
  const def = orderDef(o);
  const inv = g.player.inv;
  let coins = 0, took = 0;
  const stacks = inv.slots.map((s, i) => ({ s, i })).filter((x) => x.s && fits(o, x.s.k)).sort((a, b) => kQ(b.s!.k) - kQ(a.s!.k));
  for (const { s } of stacks) {
    if (o.have >= o.n || !s) break;
    const r = deliver(g, o, s.k, s.n, 'hand');
    s.n -= r.took;
    took += r.took;
    coins += r.coins;
  }
  inv.slots = inv.slots.map((s) => (s && s.n > 0 ? s : null));
  if (!took) return false;
  const nState = npcSys(g).byId.get(npc);
  const name = NPC_BY_ID.get(npc)!.name;
  const left = o.n - o.have;
  const line = o.have >= o.n ? def.thanks : `That's ${o.have} of ${o.n}. The rest ${dueText(g, o).replace('due ', 'by ')}, if you can.`;
  g.emit({ t: 'sfx', id: 'coin' });
  g.emit({ t: 'fx', kind: 'coins', x: g.player.x, y: g.player.y - 1 });
  g.emit({ t: 'ui', open: 'dialog', arg: { npc, name, pages: [(coins ? `${coins} coins for ${took}. ` : '') + line], hearts: nState ? hearts(nState) : 0 } });
  void left;
  return true;
}

/**
 * The post's consignment pass (economy.ts shipAll calls it before selling): each tagged crate's
 * goods that fit its customer's open orders go to them. Returns rows for the post's summary.
 */
export function consign(g: Game, bins: Ent[]): { sold: { k: number; n: number; price: number }[]; total: number } {
  const sold: { k: number; n: number; price: number }[] = [];
  let total = 0;
  for (const b of bins) {
    const tag = b.st.tag as string | undefined;
    if (!tag || !b.inv) continue;
    for (let i = 0; i < b.inv.slots.length; i++) {
      const s = b.inv.slots[i];
      if (!s) continue;
      for (const o of ordersFor(g, tag, s.k)) {
        const r = deliver(g, o, s.k, s.n, 'post');
        if (!r.took) continue;
        s.n -= r.took;
        total += r.coins;
        // an order paid in goods (Bram's bars) isn't a sale in the post's summary
        if (r.coins) sold.push({ k: s.k, n: r.took, price: Math.round(r.coins / r.took) });
        if (s.n <= 0) break;
      }
      if (s.n <= 0) b.inv.slots[i] = null;
    }
  }
  return { sold, total };
}

/** who a crate can be tagged for: every customer whose standing order has been posted */
export function tagChoices(g: Game): { npc: string; place: string }[] {
  const out: { npc: string; place: string }[] = [];
  for (const id of orders(g).posted) {
    const def = STANDING_BY_ID.get(id);
    if (def && !out.some((o) => o.npc === def.npc)) out.push({ npc: def.npc, place: def.place });
  }
  return out;
}

/** the place a crate is tagged for ('' = the market) */
export function tagPlace(g: Game, e: Ent): string {
  const t = e.st.tag as string | undefined;
  return t ? STANDING.find((s) => s.npc === t)?.place ?? '' : '';
}

registerSystem({
  name: 'orders',
  tick(g) {
    if (g.tickN % 60 === 0) postDue(g, false);
  },
  dayStart(g) {
    const os = orders(g);
    // a weekly order past its day lapses; the first one (the Keeper's Line's B7) waits another week
    for (const o of [...os.open]) {
      if (g.dayIndex <= o.due) continue;
      if (filled(g, o.id) === 0) o.due += 7;
      else {
        os.open = os.open.filter((x) => x !== o);
        g.toast(`${orderDef(o).place}'s order lapsed (${o.have}/${o.n}). A new one comes on Monday.`);
      }
    }
    postDue(g, g.weekday === 0);
  },
  save(g) {
    return orders(g);
  },
  load(g, d) {
    const os = orders(g);
    os.open = (d?.open ?? []).filter((o: Order) => STANDING_BY_ID.has(o.id));
    os.filled = d?.filled ?? {};
    os.rep = d?.rep ?? {};
    os.posted = d?.posted ?? [];
  },
});
