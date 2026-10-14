// Exports at run time (2.1; data in src/data/exports.ts). Once the town has rebuilt the Harbor
// (the works project p_harbor sets `harbor`), the Copper Gull calls at the beach pier:
//  - it docks at dawn with a manifest from a port across the sea: three to five goods in season
//    that your farm has made, in quantities only a factory makes, each at its own export price
//    (an export order on the Orders board's Exports tab, customer 'harbor');
//  - goods go aboard by hand at the warehouse door (F), at the board (Hand in), or by the post from
//    a crate tagged for the Harbor (which holds its goods while the ship is away instead of selling
//    them). Each item pays as it's loaded; a manifest loaded in full pays a bonus on top and the
//    ship sails the next dawn, otherwise it sails a week after it docked with what's aboard;
//  - after three days at sea it calls again. Standing with the Harbor grows by manifest (all of it,
//    or at least half by value) and its ranks ask bigger manifests at better prices.
// src/render/harbor.ts draws the warehouse and the ship; the ship's place is shipView (below).
import { AT_SEA_DAYS, EXPORT_PORTS, EXPORT_PREMIUM, FULL_BONUS, HARBOR_RANKS, IN_PORT_DAYS, LINE_GROWTH, LINE_MAX, LINE_VALUE, linesAt, PORT_BY_ID, PREMIUM_RANK, REP_FULL, REP_HALF, SHIP_NAME, type ExportPort } from '../../data/exports';
import { ITEM_BY_ID } from '../../data/items';
import { C } from '../../data/palette';
import { Game, registerSystem } from '../Game';
import { key, kQ } from '../inventory';
import { inSeason } from '../seasonal';
import { HARBOR, SHIP_BERTH } from '../world/townworks';
import { send } from './goals';
import { deliver, fits, orderFull, orders, orderTitle, postManifest, specLabel, type Order, type OrderLine } from './orders';

export interface ExportsState {
  /** the ship at sea, or moored at the pier with its manifest on the board */
  ship: 'away' | 'port';
  /** the day it next docks (at sea) or sails at dawn (in port) */
  next: number;
  /** the days it last docked and last sailed (its arrival and departure on screen) */
  docked: number;
  sailed: number;
  /** the port of the manifest aboard, or of the last one */
  port: string;
  /** the Harbor's opening (its letter, the first call) has happened */
  opened: boolean;
  /** voyages sailed, manifests loaded in full, coins paid overseas */
  voyages: number;
  full: number;
  earned: number;
  /** goods carried overseas, all time (item id -> count) */
  shipped: Record<string, number>;
  /** the last voyages: port, the day it sailed, the share of its manifest aboard, the coins */
  log: { port: string; day: number; share: number; coins: number }[];
  /** the last rank the Harbormaster wrote about */
  rank: number;
}

export function exportsState(g: Game): ExportsState {
  if (!g.sys.exports) g.sys.exports = { ship: 'away', next: 0, docked: -1, sailed: -1, port: '', opened: false, voyages: 0, full: 0, earned: 0, shipped: {}, log: [], rank: 0 } as ExportsState;
  const s = g.sys.exports as ExportsState & Record<string, any>;
  // hooks for the orders system (a manifest loaded in full) and the warehouse door (townworks.ts)
  s.filled = filled;
  s.door = door;
  return s;
}

export const harborOpen = (g: Game) => g.flags.has('harbor');
export const harborRep = (g: Game) => orders(g).rep.harbor ?? 0;
export function harborRank(g: Game): number {
  const rep = harborRep(g);
  let r = 0;
  for (let i = 0; i < HARBOR_RANKS.length; i++) if (rep >= HARBOR_RANKS[i].rep) r = i;
  return r;
}
/** the export price a rank pays, as a multiple of the goods' base price */
export const premiumAt = (rank: number) => EXPORT_PREMIUM + PREMIUM_RANK * rank;

/** the manifest aboard (loaded in full or not), if the ship is in port */
export function manifest(g: Game): Order | null {
  return orders(g).open.find((o) => o.kind === 'export') ?? null;
}

/** coins a manifest's goods pay in all, and what's aboard so far */
export function manifestValue(o: Order): { total: number; aboard: number } {
  let total = 0, aboard = 0;
  for (const l of o.lines) {
    total += (l.unit ?? 0) * l.n;
    aboard += (l.unit ?? 0) * Math.min(l.have, l.n);
  }
  return { total, aboard };
}

// ---------------- a manifest ----------------
/** has the farm ever made this? (a manifest asks only for goods your lines have made) */
const madeHere = (g: Game, id: string) => (g.stats.series.get(key(id) >> 2)?.totalProd ?? 0) > 0;

/** a nice round count: 4,150 -> 4,200, 862 -> 860, 47 -> 45 */
function roundNice(n: number): number {
  const step = n >= 1000 ? 100 : n >= 200 ? 10 : 5;
  return Math.max(step, Math.round(n / step) * step);
}

/** The manifest's lines: goods the port buys, in season, that the farm has made (else any it buys in season). */
export function manifestLines(g: Game, port: ExportPort, rank: number): OrderLine[] {
  const season = g.time.season;
  const known = (id: string) => ITEM_BY_ID.has(id) && (ITEM_BY_ID.get(id)!.price > 0) && inSeason(id, season);
  const n = linesAt(rank);
  let pool = port.wants.filter((id) => known(id) && madeHere(g, id));
  // too few of its own: what any port buys that you've made, then what it buys at all
  if (pool.length < n) pool = [...new Set([...pool, ...EXPORT_PORTS.flatMap((p) => p.wants).filter((id) => known(id) && madeHere(g, id))])];
  if (pool.length < n) pool = [...new Set([...pool, ...port.wants.filter(known)])];
  const picks: string[] = [];
  const bag = [...pool];
  while (picks.length < n && bag.length) picks.push(bag.splice(g.rng.int(0, bag.length - 1), 1)[0]);
  const value = LINE_VALUE * (1 + LINE_GROWTH * rank);
  const premium = premiumAt(rank);
  return picks.map((id) => {
    const price = ITEM_BY_ID.get(id)!.price;
    return { spec: id, n: Math.min(LINE_MAX, roundNice(value / price)), have: 0, unit: Math.max(1, Math.round(price * premium)) };
  });
}

/** the ship docks: a manifest from the next port (never the last one twice running) */
export function arrive(g: Game): Order {
  const s = exportsState(g);
  const ports = EXPORT_PORTS.filter((p) => p.id !== s.port);
  const port = ports[g.rng.int(0, ports.length - 1)];
  const rank = harborRank(g);
  const lines = manifestLines(g, port, rank);
  const total = lines.reduce((a, l) => a + (l.unit ?? 0) * l.n, 0);
  const o = postManifest(g, {
    kind: 'export', def: `export:${port.id}`, cust: 'harbor', port: port.id, lines, day: g.dayIndex,
    due: g.dayIndex + IN_PORT_DAYS - 1, pay: Math.round(total * FULL_BONUS), rep: REP_FULL,
  });
  s.ship = 'port';
  s.port = port.id;
  s.docked = g.dayIndex;
  s.next = g.dayIndex + IN_PORT_DAYS;
  g.emit({ t: 'sfx', id: 'chime' });
  g.toast(`${SHIP_NAME} has docked at the Harbor with a manifest from ${port.name}: ${lines.map((l) => `${l.n.toLocaleString()} ${specLabel(l.spec)}`).join(', ')}. It sails in a week.`, 'i:' + lines[0]?.spec, C.amber);
  return o;
}

/** the ship sails at dawn with what's aboard; standing for a manifest at least half loaded */
export function sail(g: Game) {
  const s = exportsState(g);
  const os = orders(g);
  const o = manifest(g);
  s.ship = 'away';
  s.sailed = g.dayIndex;
  s.next = g.dayIndex + AT_SEA_DAYS;
  if (!o) return;
  os.open = os.open.filter((x) => x !== o);
  const { total, aboard } = manifestValue(o);
  const share = total ? aboard / total : 0;
  for (const l of o.lines) if (l.have > 0) s.shipped[l.spec] = (s.shipped[l.spec] ?? 0) + Math.min(l.have, l.n);
  const coins = aboard + (o.done ? o.pay ?? 0 : 0);
  s.earned += coins;
  s.voyages++;
  s.log.unshift({ port: o.port ?? '', day: g.dayIndex, share, coins });
  s.log.length = Math.min(s.log.length, 6);
  const port = PORT_BY_ID.get(o.port ?? '')?.name ?? 'overseas';
  if (o.done) g.toast(`${SHIP_NAME} sailed for ${port} with its manifest in full. It calls again in ${AT_SEA_DAYS} days.`, undefined, C.lime);
  else {
    if (share >= 0.5) os.rep.harbor = (os.rep.harbor ?? 0) + REP_HALF;
    g.toast(`${SHIP_NAME} sailed for ${port} with ${Math.round(share * 100)}% of its manifest aboard${share >= 0.5 ? '' : ': under half, so no standing this time'}. It calls again in ${AT_SEA_DAYS} days.`, undefined, share >= 0.5 ? C.amber : C.blush);
  }
  checkRank(g);
}

/** a manifest loaded in full (the orders system pays its bonus and standing): it sails at dawn */
function filled(g: Game, o: Order, via: 'hand' | 'post' | 'board') {
  const s = exportsState(g);
  s.full++;
  s.next = g.dayIndex + 1;
  g.count('exports_full');
  g.emit({ t: 'sfx', id: 'coin' });
  g.toast(`${orderTitle(o)} loaded in full${via === 'post' ? ' by the post' : ''}! A bonus of ${(o.pay ?? 0).toLocaleString()} coins, and ${SHIP_NAME} sails at dawn.`, undefined, C.lime);
  checkRank(g);
}

/** a new rank: the Harbormaster writes, with coins */
function checkRank(g: Game) {
  const s = exportsState(g);
  const r = harborRank(g);
  if (r <= s.rank) return;
  for (let i = s.rank + 1; i <= r; i++) {
    const rk = HARBOR_RANKS[i];
    g.player.money += rk.coins;
    g.earned += rk.coins;
    send(g, 'harbor_rank_' + i, {
      from: 'Harbormaster Penwick', title: `The Harbor: ${rk.name}`,
      text: `Captains up and down the coast know your farm's name now: the Harbor counts you a ${rk.name}. Enclosed, ${rk.coins.toLocaleString()} coins from the merchants' purse. Expect bigger manifests from here on, at ${Math.round(premiumAt(i) * 100)}% of the goods' price${i === 2 || i === 4 ? ', and one more line on every one' : ''}.${i === HARBOR_RANKS.length - 1 ? ' There is no higher name a harbor can give.' : ''}\n- Harbormaster Ada Penwick`,
    });
  }
  g.toast(`Harbor rank: ${HARBOR_RANKS[r].name}! Bigger manifests, better prices.`, undefined, C.lime);
  g.emit({ t: 'sfx', id: 'chime' });
  s.rank = r;
}

/** the Harbor opens: the Harbormaster's letter, and the ship calls the next morning */
function open(g: Game) {
  const s = exportsState(g);
  s.opened = true;
  if (!manifest(g)) {
    s.ship = 'away';
    s.next = g.dayIndex + 1;
  }
  send(g, 'harbor_open', {
    from: 'Harbormaster Penwick', title: 'Ships call at Thistlewick again',
    text: `The warehouse is sound, the crane swings and the pier's lamps are lit: thank you. ${SHIP_NAME} calls tomorrow at dawn. Each time it docks it brings a manifest from a port across the sea, and those cities buy in quantities no village shop could dream of. Load what you can in the week it stays: everything pays as it goes aboard, well above the market, and a manifest loaded in full pays a handsome bonus and sends the ship off a day early. Bring goods to the warehouse door, hand them in at the Orders board, or tag a shipping crate for the Harbor and the post will carry them down (a crate tagged for us keeps its goods while the ship is at sea).\n- Harbormaster Ada Penwick`,
  });
  g.emit({ t: 'scene', x: HARBOR.x + HARBOR.w / 2, y: SHIP_BERTH.y, title: 'The Harbor', text: `The old warehouse stands sound again and its crane swings. ${SHIP_NAME} calls tomorrow at dawn for your exports.`, icon: 'construction_site' });
}

/** F at the warehouse door: what the bag has for the manifest goes aboard, then the Exports tab */
function door(g: Game) {
  if (!harborOpen(g)) {
    g.toast('The old harbor warehouse: boarded up, its crane rusted. The town works could rebuild it (the Works tab, once the tram runs).');
    g.emit({ t: 'sfx', id: 'thud' });
    return;
  }
  const o = manifest(g);
  if (!o || o.done) {
    const s = exportsState(g);
    g.toast(o ? `The manifest is loaded in full: ${SHIP_NAME} sails at dawn.` : `${SHIP_NAME} is at sea: it calls again in ${Math.max(1, s.next - g.dayIndex)} day${s.next - g.dayIndex === 1 ? '' : 's'}.`);
    g.emit({ t: 'ui', open: 'board', arg: 'exports' });
    return;
  }
  const took = loadFromBag(g, o);
  if (took) g.toast(`${took.toLocaleString()} loaded aboard ${SHIP_NAME}.`, undefined, C.lime);
  g.emit({ t: 'ui', open: 'board', arg: 'exports' });
}

/** the bag's goods for the manifest go aboard (silver first, as everywhere); returns how many */
export function loadFromBag(g: Game, o: Order): number {
  const inv = g.player.inv;
  let took = 0;
  const stacks = inv.slots.filter((s) => s && fits(o, s.k)).sort((a, b) => kQ(b!.k) - kQ(a!.k));
  for (const s of stacks) {
    if (!s || o.done || orderFull(o)) break;
    const r = deliver(g, o, s.k, s.n, 'hand');
    s.n -= r.took;
    took += r.took;
  }
  inv.slots = inv.slots.map((s) => (s && s.n > 0 ? s : null));
  if (took) g.emit({ t: 'sfx', id: 'insert' });
  return took;
}

// ---------------- the ship on screen ----------------
/** game minutes the ship takes to come in from the east, or to leave (6am to 8am) */
const PASSAGE = 120;
/**
 * Where the ship is drawn (tiles, its footprint's top-left), and whether its sails are set: moored
 * at the berth beside the pier, coming in from the east on the morning it docks, leaving that way
 * on the morning it sails. Null while it's at sea.
 */
export function shipView(g: Game): { x: number; y: number; sailing: boolean; west?: boolean } | null {
  if (!harborOpen(g) || g.map.w < 200) return null;
  const s = exportsState(g);
  const t = (g.time.min - 360) / PASSAGE;
  const off = (f: number) => (g.map.w - SHIP_BERTH.x + 2) * Math.max(0, Math.min(1, f));
  if (s.ship === 'port') {
    if (s.docked === g.dayIndex && t < 1) return { x: SHIP_BERTH.x + off(1 - t), y: SHIP_BERTH.y, sailing: true, west: true };
    return { x: SHIP_BERTH.x, y: SHIP_BERTH.y, sailing: false };
  }
  if (s.sailed === g.dayIndex && t < 1) return { x: SHIP_BERTH.x + off(t), y: SHIP_BERTH.y, sailing: true };
  return null;
}

registerSystem({
  name: 'exports',
  tick(g) {
    if (g.tickN % 60 !== 0 || g.map.w < 200 || !harborOpen(g)) return;
    if (!exportsState(g).opened) open(g);
  },
  dayStart(g) {
    if (g.map.w < 200 || !harborOpen(g)) return;
    const s = exportsState(g);
    if (!s.opened) open(g);
    if (s.ship === 'port' && g.dayIndex >= s.next) sail(g);
    else if (s.ship === 'away' && g.dayIndex >= s.next) arrive(g);
  },
  save(g) {
    const { filled: _f, door: _d, ...rest } = exportsState(g) as ExportsState & Record<string, any>;
    return rest;
  },
  load(g, d) {
    if (!d) return;
    Object.assign(exportsState(g), d);
  },
});
