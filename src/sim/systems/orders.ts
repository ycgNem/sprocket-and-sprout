// Orders (ROADMAP.md 7.4, Phase 3): every ask in town, on one board with three tabs.
// - Today: three small asks a day from REQUEST_POOL (once "A Second Bed" is done). No accept step:
//   bring them by hand (F at the villager) or let a crate tagged for them carry them. They end at
//   midnight.
// - Standing: each business's recurring orders (src/data/orders.ts), weekly from Monday, growing
//   with reputation; and the Trading Guild's three weekly bulk contracts (filled at the Freight
//   Depot, by the post, or by hand at the board).
// - Works: the town works for the Council: the restoration projects and the keystones, filled by
//   hand at the board or by a crate tagged for the Council (the post fills keystones first).
// Reputation: six ranks per business, +1 a filled order (+2 a big one). A rank opens the business's
// next standing order and its special stock (shop entries with unlock 'rep:<business>:<rank>').
// Consignment: a crate's "Ship to" tag sends its goods to any open order of that customer at each
// post (noon, 6pm, overnight) before the market gets the rest. Orders pay above market and never
// saturate it.
import { CONTRACT_POOL, GUILD_BONUS_PER_RANK, type ContractDef } from '../../data/contracts';
import { PROJECTS, PROJECT_BY_ID, REQUEST_POOL } from '../../data/goals';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { C } from '../../data/palette';
import {
  BUSINESS_BY_ID, BUSINESS_BY_NPC, KEYSTONE_WORKS, KEYSTONE_WORKS_BY_ID, REP_RANKS, STANDING, STANDING_BY_ID, rankOf, type StandingDef,
} from '../../data/orders';
import { WEEKDAYS } from '../../data/types';
import { questName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { key, kDef, kQ, type ItemKey } from '../inventory';
import { lesson } from '../lessons';
import { PORT_HANDLERS } from '../ports';
import { addPoints, hearts, npcSys } from './npcs';
import { send } from './goals';

export type OrderKind = 'today' | 'standing' | 'guild' | 'works';

export interface OrderLine {
  spec: string;
  n: number;
  have: number;
}

export interface Order {
  uid: number;
  kind: OrderKind;
  /** its definition: a standing order's id, a contract's id, a project's or keystone's id, or 'req:<npc>:<item>' */
  def: string;
  /** who wants it: a business id (= its keeper's villager id), a villager, 'guild' or 'council' */
  cust: string;
  lines: OrderLine[];
  /** the day it was posted and the last day to fill it (dayIndex) */
  day: number;
  due: number;
  /** coins per item on delivery (standing orders) */
  unit?: number;
  /** coins when it's filled (today's asks, contracts) */
  pay?: number;
  /** silver or better pays double */
  silver?: boolean;
  /** reputation when it's filled */
  rep: number;
  /** filled: today's asks and contracts stay on the board as Done until they roll over */
  done?: boolean;
  /** today's asks: the villager's words */
  text?: string;
}

export interface OrdersState {
  open: Order[];
  /** times each order definition was filled */
  filled: Record<string, number>;
  /** reputation per customer */
  rep: Record<string, number>;
  /** customers who have posted (the crate can be tagged for them) */
  posted: string[];
  /** standing orders ever posted (a first order isn't posted twice) */
  seen: string[];
  uid: number;
  guild: { unlocked: boolean; week: number; completed: number };
  /** projects and keystones finished */
  worksDone: string[];
}

const NEVER = 1e9;

export function orders(g: Game): OrdersState {
  if (!g.sys.orders) {
    g.sys.orders = { open: [], filled: {}, rep: {}, posted: [], seen: [], uid: 1, guild: { unlocked: false, week: -1, completed: 0 }, worksDone: [] } as OrdersState;
  }
  const o = g.sys.orders as OrdersState & Record<string, any>;
  // cross-system hooks (quests.ts hands deliveries over, economy.ts runs consignment first)
  o.hand = handDeliver;
  o.consign = consign;
  return o;
}

// ---------------- reading ----------------
export const filled = (g: Game, id: string) => orders(g).filled[id] ?? 0;
export const openOf = (g: Game, kind: OrderKind) => orders(g).open.filter((o) => o.kind === kind);
/** an open (unfilled) order of a definition */
export const openOrder = (g: Game, def: string) => orders(g).open.find((o) => o.def === def && !o.done) ?? null;
export const standingDef = (o: Order): StandingDef | undefined => (o.kind === 'standing' ? STANDING_BY_ID.get(o.def) : undefined);
export const worksDone = (g: Game): string[] => orders(g).worksDone;
export const repOf = (g: Game, cust: string) => orders(g).rep[cust] ?? 0;
export const rank = (g: Game, cust: string) => rankOf(repOf(g, cust));

/** the customer's name on the board: a business, the Guild, the Council, or a villager */
export function custName(cust: string): string {
  const b = BUSINESS_BY_ID.get(cust);
  if (b) return b.name;
  const n = NPC_BY_ID.get(cust);
  return n ? questName(cust, n.name) : cust;
}

/** a villager's name as the town says it ("the Professor", "Rowan") */
export function villagerName(id: string): string {
  const n = NPC_BY_ID.get(id);
  return n ? questName(id, n.name) : custName(id);
}

/** the villager who stands for a customer (portraits, hand delivery) */
export const custNpc = (cust: string): string | undefined => BUSINESS_BY_ID.get(cust)?.npc ?? (NPC_BY_ID.has(cust) ? cust : undefined);

export const lineLeft = (l: OrderLine) => Math.max(0, l.n - l.have);
export const orderLeft = (o: Order) => o.lines.reduce((a, l) => a + lineLeft(l), 0);
export const orderFull = (o: Order) => o.lines.every((l) => l.have >= l.n);

/** the order's title: what it asks for, or the project's name */
export function orderTitle(o: Order): string {
  if (o.kind === 'works') return PROJECT_BY_ID.get(o.def)?.name ?? KEYSTONE_WORKS_BY_ID.get(o.def)?.name ?? o.def;
  if (o.kind === 'guild') return CONTRACT_POOL.find((c) => c.id === o.def)?.label ?? specLabel(o.lines[0].spec);
  return `${o.lines[0].n} ${specLabel(o.lines[0].spec)}`;
}

export function specLabel(spec: string): string {
  return spec[0] === '#' ? 'any ' + spec.slice(1) : ITEM_BY_ID.get(spec)?.name ?? spec;
}

/** "due Friday", "due tomorrow", "ends at midnight", "no rush" */
export function dueText(g: Game, o: Order): string {
  if (o.kind === 'today') return o.done ? 'done' : 'ends at midnight';
  if (o.due >= NEVER) return 'no rush';
  const d = o.due - g.dayIndex;
  if (d <= 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `due ${WEEKDAYS[(g.weekday + d) % 7]}`;
}

/** coins for n of item k on this order: silver or better pays double where the order says so */
export function payFor(o: Order, k: ItemKey, n: number): number {
  return (o.unit ?? 0) * n * (o.silver && kQ(k) >= 1 ? 2 : 1);
}

const fitsLine = (l: OrderLine, k: ItemKey) => l.have < l.n && matchesSpec(kDef(k), l.spec);
export const fits = (o: Order, k: ItemKey) => !o.done && o.lines.some((l) => fitsLine(l, k));

/** open orders of a customer that take item k (keystones first among the works) */
export function ordersFor(g: Game, cust: string, k?: ItemKey): Order[] {
  const list = orders(g).open.filter((o) => o.cust === cust && !o.done && (k === undefined || fits(o, k)));
  return list.sort((a, b) => keystoneFirst(a) - keystoneFirst(b));
}
const keystoneFirst = (o: Order) => (o.kind === 'works' && (KEYSTONE_WORKS_BY_ID.has(o.def) || o.def === 'p_clock') ? 0 : 1);

// ---------------- posting ----------------
function post(g: Game, o: Omit<Order, 'uid'>, quiet = false): Order {
  const os = orders(g);
  const full = { ...o, uid: os.uid++ } as Order;
  os.open.push(full);
  if (!os.posted.includes(o.cust)) os.posted.push(o.cust);
  if (!quiet) {
    const what = o.kind === 'works' ? orderTitle(full) : `${o.lines[0].n} ${specLabel(o.lines[0].spec)}`;
    g.toast(`${custName(o.cust)} posted an order on the board: ${what}.`, o.lines[0].spec[0] === '#' ? undefined : 'i:' + o.lines[0].spec, C.amber);
  }
  return full;
}

/** the next Friday at least two days away */
function nextFriday(g: Game): number {
  let d = (4 - g.weekday + 7) % 7;
  if (d < 2) d += 7;
  return g.dayIndex + d;
}

/** this week's Sunday (the Guild's contracts end on Sunday night) */
const sunday = (g: Game) => g.dayIndex + ((6 - g.weekday + 7) % 7);

/**
 * Does a condition hold? The unlock words (flag:, quest:, a research id) plus 'on:<quest>' (active
 * or done). Quest conditions only bind a Keeper's Line save: 1.x saves never had those quests.
 */
function holds(g: Game, c: string): boolean {
  const keeper = g.flags.has('keepers_line');
  if (c.startsWith('on:') || c.startsWith('quest:')) {
    if (!keeper) return true;
    const id = c.slice(c.indexOf(':') + 1);
    const q = g.sys.quests;
    const done = !!q?.done?.includes(id);
    return c.startsWith('quest:') ? done : done || !!q?.active?.some((a: { id: string }) => a.id === id);
  }
  return g.unlocked(c);
}

/** is this standing order on offer to this save right now (before weekly renewals)? */
function available(g: Game, def: StandingDef): boolean {
  if (g.map.w < 100 || g.mode === 'sandbox') return false;
  // 1.x saves (and Cozy and Rush) had Rowan's pickles from day 3
  if (def.id === 'rowan_pickles' && !g.flags.has('keepers_line')) return g.dayIndex >= 2;
  if (rank(g, def.biz) < (def.rank ?? 0)) return false;
  return (def.after ?? []).every((c) => holds(g, c));
}

function postStanding(g: Game, def: StandingDef) {
  const os = orders(g);
  const r = rank(g, def.biz);
  const n = def.weekly && filled(g, def.id) > 0 ? def.n + 2 * Math.min(5, r) : def.n;
  if (!os.seen.includes(def.id)) os.seen.push(def.id);
  post(g, {
    kind: 'standing', def: def.id, cust: def.biz, lines: [{ spec: def.spec, n, have: 0 }], day: g.dayIndex,
    due: def.weekly ? nextFriday(g) : NEVER, unit: def.unit, silver: def.silver, rep: def.big ? 2 : 1,
  });
  lesson(g, 'consign');
  // a crate still tagged for a customer with nothing open follows the new order, or its goods would
  // go to market unasked
  for (const b of g.ents.all()) {
    const t = b.st.tag as string | undefined;
    if (b.def.kind !== 'shipbin' || !t || t === def.biz || ordersFor(g, t).length) continue;
    b.st.tag = def.biz;
    g.toast(`Your crate ships to ${custName(def.biz)} now, for the new order.`, 'i:' + def.spec);
  }
}

/** post what's due: a first order the moment it's on offer, weekly ones each Monday */
function postDue(g: Game, monday: boolean) {
  const os = orders(g);
  for (const def of STANDING) {
    if (os.open.some((o) => o.def === def.id) || !available(g, def)) continue;
    const n = filled(g, def.id);
    if (n === 0 && !os.seen.includes(def.id)) postStanding(g, def);
    else if (def.weekly && n > 0 && monday) postStanding(g, def);
  }
}

/** today's three asks (after "A Second Bed"; 1.x saves from the first morning) */
function postToday(g: Game) {
  const os = orders(g);
  os.open = os.open.filter((o) => o.kind !== 'today');
  if (g.map.w < 100 || g.mode === 'sandbox' || g.mode === 'rush') return;
  if (g.flags.has('keepers_line') && !g.sys.quests?.done?.includes('k9_bed')) return;
  const pool = REQUEST_POOL.filter((r) => (!r.seasons || r.seasons.includes(g.time.season)) && ITEM_BY_ID.has(r.item));
  const used = new Set<string>();
  for (let tries = 0; tries < 30 && used.size < 3; tries++) {
    const r = g.rng.pick(pool);
    if (used.has(r.npc)) continue;
    used.add(r.npc);
    const price = ITEM_BY_ID.get(r.item)!.price;
    post(g, {
      kind: 'today', def: `req:${r.npc}:${r.item}`, cust: r.npc, lines: [{ spec: r.item, n: r.n, have: 0 }], day: g.dayIndex, due: g.dayIndex,
      pay: Math.round(price * r.n * 2.2 + 120), rep: BUSINESS_BY_NPC.has(r.npc) ? 1 : 0, text: r.text,
    }, true);
  }
}

/** the Guild's contracts: three each Monday (every 3 days in Clockwork Rush) */
export function postContracts(g: Game) {
  const os = orders(g);
  os.open = os.open.filter((o) => o.kind !== 'guild');
  const r = rank(g, 'guild');
  const maxTier = r >= 4 ? 2 : r >= 2 ? 1 : 0;
  const pool = CONTRACT_POOL.filter((c) => c.tier <= maxTier && specValid(c.spec));
  const top = pool.filter((c) => c.tier === maxTier);
  const picks: ContractDef[] = [];
  // one from the newest tier, the rest from anything unlocked
  if (top.length) picks.push(g.rng.pick(top));
  for (let tries = 0; picks.length < 3 && tries < 50; tries++) {
    const c = g.rng.pick(pool);
    if (!picks.includes(c)) picks.push(c);
  }
  for (const c of picks) {
    const need = Math.max(5, Math.round((c.n * (1 + 0.2 * r)) / 5) * 5);
    post(g, {
      kind: 'guild', def: c.id, cust: 'guild', lines: [{ spec: c.spec, n: need, have: 0 }], day: g.dayIndex,
      due: g.mode === 'rush' ? g.dayIndex + 2 : sunday(g), pay: Math.round((unitValue(c) * need * 1.5) / 10) * 10, rep: 1 + c.tier,
    }, true);
  }
  os.guild.week = Math.floor(g.dayIndex / 7);
}

function specValid(spec: string): boolean {
  if (spec[0] !== '#') return ITEM_BY_ID.has(spec);
  return ITEMS.some((d) => matchesSpec(d, spec));
}
const unitValue = (c: ContractDef) => c.unit ?? ITEM_BY_ID.get(c.spec)?.price ?? 50;

/** the works: every unfinished project, and each keystone once what it waits for is done */
function postWorks(g: Game, quiet = false) {
  if (g.map.w < 100 || g.mode === 'sandbox') return;
  const os = orders(g);
  const has = (id: string) => os.worksDone.includes(id) || os.open.some((o) => o.def === id);
  for (const k of KEYSTONE_WORKS) {
    if (has(k.id) || !k.after.every((c) => holds(g, c))) continue;
    post(g, { kind: 'works', def: k.id, cust: 'council', lines: k.items.map((i) => ({ spec: i.item, n: i.n, have: 0 })), day: g.dayIndex, due: NEVER, rep: 0 }, quiet);
    if (!quiet) {
      g.emit({ t: 'sfx', id: 'chime' });
      lesson(g, 'works');
    }
  }
  for (const p of PROJECTS) {
    // the Bakery Window opens once the town has flour of its own (the Town Mill)
    if (has(p.id) || (p.id === 'p_bakery' && !g.flags.has('bread_town'))) continue;
    post(g, { kind: 'works', def: p.id, cust: 'council', lines: p.items.map((i) => ({ spec: i.item, n: i.n, have: 0 })), day: g.dayIndex, due: NEVER, rep: 0 }, true);
  }
}

// ---------------- delivering ----------------
/**
 * Deliver up to n of item k to an order; returns how many it took and what they pay now. By hand
 * the coins are paid at once; by the post they join the post's total (economy.ts pays it).
 */
function deliver(g: Game, o: Order, k: ItemKey, n: number, via: 'hand' | 'post' | 'board'): { took: number; coins: number } {
  let took = 0;
  for (const l of o.lines) {
    if (took >= n || !fitsLine(l, k)) continue;
    const t = Math.min(n - took, l.n - l.have);
    l.have += t;
    took += t;
  }
  if (took <= 0) return { took: 0, coins: 0 };
  const coins = payFor(o, k, took);
  if (coins && via !== 'post') {
    g.player.money += coins;
    g.earned += coins;
  }
  g.stats.use(k, took);
  g.sys.collections?.shipped?.(g, k, took);
  if (orderFull(o)) {
    const money = o.kind === 'works' ? PROJECT_BY_ID.get(o.def)?.money ?? 0 : 0;
    if (money && g.player.money < money) g.toast(`All items are in! ${orderTitle(o)} also needs ${money} coins: pay at the board.`);
    else if (money && via === 'post') g.toast(`All items are in! ${orderTitle(o)} also needs ${money} coins: pay at the board.`);
    else complete(g, o, via, money);
  }
  return { took, coins };
}

/** the coins a finished Today ask or contract pays (by the post they join its total) */
let postBonus = 0;

function complete(g: Game, o: Order, via: 'hand' | 'post' | 'board', money = 0) {
  const os = orders(g);
  if (money) g.player.money -= money;
  os.filled[o.def] = (os.filled[o.def] ?? 0) + 1;
  const before = rank(g, o.cust);
  if (o.rep) os.rep[o.cust] = (os.rep[o.cust] ?? 0) + o.rep;
  if (o.pay) {
    if (via === 'post') postBonus += o.pay;
    else {
      g.player.money += o.pay;
      g.earned += o.pay;
    }
  }
  if (o.kind === 'today' || o.kind === 'guild') o.done = true;
  else os.open = os.open.filter((x) => x !== o);
  g.emit({ t: 'sfx', id: 'quest' });
  const npc = custNpc(o.cust);
  const ns = npc ? npcSys(g).byId.get(npc) : undefined;
  switch (o.kind) {
    case 'today':
      if (ns) addPoints(g, ns, 150);
      g.count('requests');
      if (via === 'post') g.toast(`${custName(o.cust)}'s ask filled by the post: ${o.pay} coins.`, 'i:' + o.lines[0].spec, C.lime);
      break;
    case 'standing': {
      const def = STANDING_BY_ID.get(o.def)!;
      for (const it of def.reward?.items ?? []) g.give(key(it.item), it.n);
      if (def.reward?.money) {
        g.player.money += def.reward.money;
        g.earned += def.reward.money;
      }
      if (ns) addPoints(g, ns, 60);
      g.count('orders');
      g.toast(`${custName(o.cust)}'s order filled${via === 'post' ? ' by the post' : ''}! Reputation ${repOf(g, o.cust)}${def.reward ? '. ' + def.reward.text : ''}`, 'i:' + def.spec, C.lime);
      break;
    }
    case 'guild':
      os.guild.completed++;
      g.count('contracts');
      g.emit({ t: 'sfx', id: 'coin' });
      g.toast(`Guild contract filled: ${orderTitle(o)}! +${o.pay} coins`, 'freight_depot', C.amber);
      break;
    case 'works':
      finishWorks(g, o.def);
      break;
  }
  const after = rank(g, o.cust);
  if (after > before) rankUp(g, o.cust, after);
  g.sys.quests?.notify?.(g, 'order', 1, o.def);
  // a rank can open a business's next standing order at once
  postDue(g, false);
}

function rankUp(g: Game, cust: string, r: number) {
  const name = REP_RANKS[r].name;
  lesson(g, 'reputation');
  if (cust === 'guild') {
    g.toast(`Guild rank up: ${name}! Shipping prices +${Math.round(r * GUILD_BONUS_PER_RANK * 100)}%`, undefined, C.lime);
    send(g, 'guild_rank_' + r, {
      from: 'The Trading Guild', title: `Guild rank: ${name}`,
      items: r === 3 ? [{ item: 'f_banner', n: 1 }] : undefined,
      text: `The Thistlewick Trading Guild is pleased to name you ${name}.${r === 3 ? ' Please accept the enclosed banner for your home.' : ''} Merchants up and down the river now pay a premium for goods from your farm (+${Math.round(r * GUILD_BONUS_PER_RANK * 100)}% on everything you ship).${r === 2 || r === 4 ? ' Larger, finer contracts will follow.' : ''}\n- Factor Hollis, Trading Guild`,
    });
    return;
  }
  const next = STANDING.find((d) => d.biz === cust && (d.rank ?? 0) === r);
  g.toast(`${custName(cust)}: you're a ${name} now.${next ? ' A new standing order, and new stock in the shop.' : ' New stock in the shop.'}`, undefined, C.lime);
  g.emit({ t: 'sfx', id: 'chime' });
}

/** a project's reward or a keystone's flag (src/sim/systems/goals.ts used to do the projects) */
function finishWorks(g: Game, id: string) {
  const os = orders(g);
  if (!os.worksDone.includes(id)) os.worksDone.push(id);
  const k = KEYSTONE_WORKS_BY_ID.get(id);
  if (k) {
    g.flags.add(k.flag);
    // the town's bread comes from its mill now: the Kettle and the Mercantile sell bread and flour
    if (k.id === 'w_town_mill') g.flags.add('bread_town');
    g.count('keystones');
    g.toast(`${k.name}: done! ${k.done}`, undefined, C.lime);
    g.emit({ t: 'sfx', id: 'chime' });
    g.emit({ t: 'fx', kind: 'magic', x: g.player.x, y: g.player.y - 1, n: 40 });
    g.emit({ t: 'ui', open: 'message', arg: { title: k.name, text: k.done, icon: 'construction_site' } });
    return;
  }
  const p = PROJECT_BY_ID.get(id);
  if (!p) return;
  for (const it of p.reward.items ?? []) g.give(key(it.item), it.n);
  if (p.reward.flag) g.flags.add(p.reward.flag);
  g.toast(`Restoration complete: ${p.name}! ${p.reward.text}`, undefined, 6);
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'fx', kind: 'magic', x: g.player.x, y: g.player.y - 1, n: 30 });
  g.count('projects');
  const area = PROJECTS.filter((x) => x.area === p.area);
  if (area.every((x) => os.worksDone.includes(x.id))) {
    g.toast(`The ${p.area} restoration is finished! The town feels brighter.`, undefined, 6);
    g.flags.add('area_' + p.area.toLowerCase());
    if (p.area === 'Fields') g.player.maxEnergy += 30;
  }
  if (id === 'p_clock') {
    send(g, 'clock', { from: 'tobias', title: 'The Clock Strikes!', text: 'For the first time in thirty years, the clocktower struck the hour this morning. The whole town gathered in the square. Thank you, from all of Thistlewick. Come see us. - Mayor Tobias Thistle' });
  }
}

/** a project whose items are in but whose coins aren't: pay at the board */
export function payWorks(g: Game, o: Order): boolean {
  const money = PROJECT_BY_ID.get(o.def)?.money ?? 0;
  if (!orderFull(o) || !money || g.player.money < money || o.kind !== 'works') return false;
  complete(g, o, 'board', money);
  return true;
}

/**
 * F at a villager holding something their open order wants: the bag's matching goods go in,
 * silver first (it pays double), up to what the order still needs.
 */
export function handDeliver(g: Game, npc: string, k: ItemKey): boolean {
  const list = ordersFor(g, npc, k).filter((o) => o.kind === 'today' || o.kind === 'standing');
  if (!list.length) return false;
  const o = list[0];
  const inv = g.player.inv;
  let coins = 0, took = 0;
  const payBefore = g.player.money;
  const stacks = inv.slots.map((s, i) => ({ s, i })).filter((x) => x.s && fits(o, x.s.k)).sort((a, b) => kQ(b.s!.k) - kQ(a.s!.k));
  for (const { s } of stacks) {
    if (o.done || orderFull(o) || !s) break;
    const r = deliver(g, o, s.k, s.n, 'hand');
    s.n -= r.took;
    took += r.took;
    coins += r.coins;
  }
  inv.slots = inv.slots.map((s) => (s && s.n > 0 ? s : null));
  if (!took) return false;
  const nState = npcSys(g).byId.get(npc);
  const name = NPC_BY_ID.get(npc)!.name;
  const def = standingDef(o);
  const finished = o.done || !orders(g).open.includes(o);
  const paid = g.player.money - payBefore;
  let line: string;
  if (o.kind === 'today') line = finished ? `You're a lifesaver, ${g.player.name}! Here: ${o.pay} coins, as promised.` : `That's ${o.lines[0].have} of ${o.lines[0].n}. The rest before midnight, if you can.`;
  else line = (coins ? `${coins} coins for ${took}. ` : '') + (finished ? def?.thanks ?? 'Thank you!' : `That's ${o.lines[0].have} of ${o.lines[0].n}. The rest ${dueText(g, o).replace('due ', 'by ')}, if you can.`);
  void paid;
  g.emit({ t: 'sfx', id: 'coin' });
  g.emit({ t: 'fx', kind: 'coins', x: g.player.x, y: g.player.y - 1 });
  g.emit({ t: 'ui', open: 'dialog', arg: { npc, name, pages: [line], hearts: nState ? hearts(nState) : 0 } });
  return true;
}

/** "Hand in" at the board (the works and the Guild's contracts): what the bag has that it wants */
export function boardHandIn(g: Game, o: Order): number {
  if (o.done || (o.kind !== 'works' && o.kind !== 'guild')) return 0;
  const inv = g.player.inv;
  let took = 0;
  for (const s of inv.slots) {
    if (!s || o.done || orderFull(o) || !fits(o, s.k)) continue;
    const r = deliver(g, o, s.k, s.n, 'board');
    s.n -= r.took;
    took += r.took;
  }
  inv.slots = inv.slots.map((s) => (s && s.n > 0 ? s : null));
  if (took) g.emit({ t: 'sfx', id: 'insert' });
  return took;
}

/** can the bag help this order at all? (the board's Hand in button) */
export const bagHelps = (g: Game, o: Order) => !o.done && g.player.inv.slots.some((s) => s && fits(o, s.k));

/**
 * The post's consignment pass (economy.ts shipAll calls it before selling): each tagged crate's
 * goods that fit its customer's open orders go to them. Returns rows for the post's summary.
 */
export function consign(g: Game, bins: Ent[]): { sold: { k: number; n: number; price: number; to?: string }[]; total: number } {
  const sold: { k: number; n: number; price: number; to?: string }[] = [];
  let total = 0;
  postBonus = 0;
  for (const b of bins) {
    const tag = b.st.tag as string | undefined;
    if (!tag || !b.inv) continue;
    // best quality first, as by hand: silver pays double, so it fills the order before plain goods
    const idx = b.inv.slots.map((_, i) => i).sort((x, y) => kQ(b.inv!.slots[y]?.k ?? 0) - kQ(b.inv!.slots[x]?.k ?? 0));
    for (const i of idx) {
      const s = b.inv.slots[i];
      if (!s) continue;
      for (const o of ordersFor(g, tag, s.k)) {
        const r = deliver(g, o, s.k, s.n, 'post');
        if (!r.took) continue;
        s.n -= r.took;
        total += r.coins;
        // an order paid in goods (Bram's bars) or on completion isn't a per-item sale in the summary
        // (its own row in the day's summary: "Pickled Cogbeans x12, Rowan's order", not a market sale)
        if (r.coins) sold.push({ k: s.k, n: r.took, price: Math.round(r.coins / r.took), to: o.cust });
        if (s.n <= 0) break;
      }
      if (s.n <= 0) b.inv.slots[i] = null;
    }
  }
  total += postBonus;
  postBonus = 0;
  return { sold, total };
}

/** who a crate can be tagged for: every customer who has posted, and the Council once it has works open */
export function tagChoices(g: Game): { cust: string; place: string }[] {
  const os = orders(g);
  const out: { cust: string; place: string }[] = [];
  for (const c of os.posted) {
    if (c === 'council' || out.some((o) => o.cust === c)) continue;
    // a villager without a business only while they have an ask open
    if (!BUSINESS_BY_ID.has(c) && !ordersFor(g, c).length) continue;
    out.push({ cust: c, place: custName(c) });
  }
  if (os.open.some((o) => o.kind === 'works')) out.push({ cust: 'council', place: custName('council') });
  return out;
}

/** the place a crate is tagged for ('' = the market) */
export function tagPlace(_g: Game, e: Ent): string {
  const t = e.st.tag as string | undefined;
  return t ? custName(t) : '';
}

// ---------------- the Guild ----------------
export const guildRank = (g: Game) => rank(g, 'guild');
/** shipping price bonus from the Guild's rank */
export const guildBonus = (g: Game) => (orders(g).guild.unlocked ? guildRank(g) * GUILD_BONUS_PER_RANK : 0);

export function unlockGuild(g: Game, letter = true) {
  const os = orders(g);
  if (os.guild.unlocked) return;
  os.guild.unlocked = true;
  if (!os.posted.includes('guild')) os.posted.push('guild');
  if (letter) {
    send(g, 'guild_intro', {
      from: 'The Trading Guild', title: 'A proposal from the Trading Guild',
      text: `Word of your clockwork arms has reached us downriver. The Trading Guild posts three bulk contracts every Monday on the town's Orders board. Fill them at the enclosed Freight Depot (by hand or by arm), by tagging a crate for the Guild, or at the board itself, for well above market prices and without flooding the local market. Contracts expire on Sunday night. Loyal suppliers rise in rank, and every rank earns a premium on everything you ship.\n- Factor Hollis, Trading Guild`,
      items: [{ item: 'freight_depot', n: 1 }],
    });
    g.toast('A letter from the Trading Guild is in your mailbox!', undefined, C.amber);
  }
  postContracts(g);
}

export const daysLeftInWeek = (g: Game) => 7 - (g.dayIndex % 7);

PORT_HANDLERS.depot = {
  accept: (g, _e, k) => (orders(g).guild.unlocked ? ordersFor(g, 'guild', k).reduce((a, o) => a + o.lines.reduce((b, l) => b + (fitsLine(l, k) ? lineLeft(l) : 0), 0), 0) : 0),
  insert: (g, _e, k, n) => {
    let used = 0;
    for (const o of ordersFor(g, 'guild', k)) {
      if (used >= n) break;
      used += deliver(g, o, k, n - used, 'board').took;
    }
    return used;
  },
  take: () => null,
};

/** F at the depot holding goods a contract wants */
export function depotInsert(g: Game, k: ItemKey, n: number): number {
  return PORT_HANDLERS.depot.insert!(g, null as any, k, n);
}

// ---------------- the system ----------------
registerSystem({
  name: 'orders',
  tick(g) {
    if (g.tickN % 60 === 0) {
      postDue(g, false);
      postWorks(g);
    }
  },
  dayStart(g) {
    const os = orders(g);
    // a weekly order past its day lapses; the first one (the Keeper's Line's B7) waits another week
    for (const o of [...os.open]) {
      if (o.kind !== 'standing' || g.dayIndex <= o.due) continue;
      if (filled(g, o.def) === 0) o.due += 7;
      else {
        os.open = os.open.filter((x) => x !== o);
        g.toast(`${custName(o.cust)}'s order lapsed (${o.lines[0].have}/${o.lines[0].n}). A new one comes on Monday.`);
      }
    }
    postDue(g, g.weekday === 0);
    postToday(g);
    postWorks(g, true);
    // the Guild writes once you have arms and a few days behind you (from day 1 in Clockwork Rush)
    if (!os.guild.unlocked) {
      if (g.map.w >= 100 && g.mode !== 'sandbox' && (g.mode === 'rush' || (g.research.done.has('r_arms') && g.dayIndex >= 2))) unlockGuild(g);
    } else {
      const fresh = g.mode === 'rush' ? g.dayIndex % 3 === 0 : g.weekday === 0;
      if (fresh || !os.open.some((o) => o.kind === 'guild') || os.guild.week < Math.floor(g.dayIndex / 7) - 1) postContracts(g);
    }
  },
  afterLoad(g) {
    // works whose time has come (a save from before the board had them) go up quietly
    postWorks(g, true);
  },
  save(g) {
    const { hand, consign: _c, ...rest } = orders(g) as any;
    void hand;
    return rest;
  },
  load(g, d) {
    const os = orders(g) as OrdersState & Record<string, any>;
    const valid = (o: Order) =>
      o && Array.isArray(o.lines) && o.lines.every((l) => specValid(l.spec)) &&
      (o.kind === 'standing' ? STANDING_BY_ID.has(o.def) : o.kind === 'works' ? PROJECT_BY_ID.has(o.def) || KEYSTONE_WORKS_BY_ID.has(o.def) : true);
    os.open = (d?.open ?? []).filter(valid);
    os.filled = d?.filled ?? {};
    os.rep = d?.rep ?? {};
    os.posted = d?.posted ?? [];
    os.uid = Math.max(d?.uid ?? 1, ...os.open.map((o) => o.uid + 1));
    os.guild = { unlocked: false, week: -1, completed: 0, ...(d?.guild ?? {}) };
    os.worksDone = d?.worksDone ?? [];
    os.seen = d?.seen ?? [...new Set(os.open.filter((o) => o.kind === 'standing').map((o) => o.def).concat(Object.keys(os.filled).filter((id) => STANDING_BY_ID.has(id))))];
  },
});
