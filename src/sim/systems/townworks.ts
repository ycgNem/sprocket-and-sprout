// The town keystones at run time (ROADMAP.md 7.5, Phases 3-4): what the Works orders' flags do in
// the world. The Orders board sets the flags; this runs what they switch on, and
// src/render/townworks.ts draws it:
//  - `town_mill`: the Town Mill's wheel turns and the mill works again
//  - `waterworks`: the pump house runs and the square's fountain flows
//  - `lamps_hung`: the square's twelve lamps have glass and bulbs. They light after 6pm only on
//    the player's power: a pole whose wires reach the town line at the farm gate carries them, a
//    12-spark load on that pole's grid (PowerLoad, src/sim/systems/power.ts). The first night they
//    light sets `lamplighting`.
//  - `tram`: a cart bin at the quarry entrance; every morning the cart takes up to 20 ore from it to
//    town and sells it there for 30% over the market, without flooding the market
// It also notices looking (the keystones' observe stages): walking up to the mill (or hovering it)
// sets `observed:town_mill`, Roxy's airship `observed:airship`.
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { kDef, kIdx, type ItemKey } from '../inventory';
import { O, type BuildingInfo } from '../world/tilemap';
import { AIRSHIP } from '../world/worldgen';
import { FOUNTAIN, LANDMARK, LANDMARKS, layTownworks, PUMP_HOUSE, rectDist, SQUARE_LAMPS, TOWN_LINE, TOWN_MILL, TRAM, type Landmark } from '../world/townworks';
import { market, unitPrice } from './economy';
import { powerLoads, type PowerLoad } from './power';

/** what the square's lamps draw while lit (sparks) */
export const LAMP_DRAW = 12;
/** below this share of their draw the lamps stay dark (a deep brownout) */
const LAMP_MIN_SAT = 0.2;
/** the tram's cart: how much ore it takes each morning, and its premium over the market */
export const TRAM_LOAD = 20;
export const TRAM_PREMIUM = 1.3;
/** how near (tiles) walking up to a thing counts as looking at it */
const LOOK_MILL = 4, LOOK_AIRSHIP = 5;
/** Roxy's airship as drawn (its balloon rides above the footprint) */
const AIRSHIP_RECT: Landmark = { id: 'airship', name: 'The Brass Vixen', x0: AIRSHIP.x, y0: AIRSHIP.y - 4, x1: AIRSHIP.x + AIRSHIP.w, y1: AIRSHIP.y + AIRSHIP.h };

interface TownworksState {
  /** the square's lamps on the town line (a load on the player's grid; not saved, rebuilt) */
  load?: PowerLoad;
  /** the lamps are lit right now (not saved: recomputed every second) */
  lit: boolean;
  /** ore the cart carried to town this morning (its load on screen) */
  cart: number;
}

export function townworks(g: Game): TownworksState {
  if (!g.sys.townworks) g.sys.townworks = { lit: false, cart: 0 } as TownworksState;
  return g.sys.townworks;
}

/** the town line's load (created once, and put on the grid's load list) */
export function lampLoad(g: Game): PowerLoad {
  const s = townworks(g);
  const loads = powerLoads(g);
  if (!s.load) s.load = { x: TOWN_LINE[0] + 0.5, y: TOWN_LINE[1] + 0.5, draw: LAMP_DRAW, on: false, net: 0, sat: 0 };
  if (!loads.includes(s.load)) {
    loads.push(s.load);
    g.ents.powerDirty = true;
  }
  return s.load;
}

/** after 6pm (and before 6am), with the lamps hung, the square wants its light */
export function lampsWanted(g: Game): boolean {
  return g.flags.has('lamps_hung') && (g.time.min >= 18 * 60 || g.time.min < 6 * 60);
}

/** how bright the square's lamps burn: 0 dark, up to 1 on a grid with power to spare */
export function lampGlow(g: Game): number {
  const s = townworks(g);
  return s.lit ? Math.max(LAMP_MIN_SAT, s.load?.sat ?? 0) : 0;
}

/** the net the town line hangs on (0: no pole of yours reaches the farm gate) */
export function townLineNet(g: Game): number {
  return townworks(g).load?.net ?? 0;
}

// ---------------- looking ----------------
const LOOKABLE: Landmark[] = [...LANDMARKS, AIRSHIP_RECT];

/** the landmark drawn at a world point (tiles), if any: the mill, the pump house, the fountain, the airship */
export function landmarkAt(g: Game, fx: number, fy: number): Landmark | null {
  if (g.player.where !== 'world' || g.map.w < 200) return null;
  return LOOKABLE.find((l) => fx >= l.x0 && fx < l.x1 && fy >= l.y0 && fy < l.y1) ?? null;
}

/** looking at a landmark (hover, its door) counts for a keystone's observe stage */
export function lookAt(g: Game, l: Landmark) {
  g.flags.add('observed:' + l.id);
}

/** walking up to the mill or the airship counts as looking at it */
function noticeNearby(g: Game) {
  const p = g.player;
  if (p.where !== 'world') return;
  if (!g.flags.has('observed:town_mill') && rectDist(p.x, p.y, LANDMARKS[0]) <= LOOK_MILL) g.flags.add('observed:town_mill');
  if (!g.flags.has('observed:airship') && rectDist(p.x, p.y, AIRSHIP_RECT) <= LOOK_AIRSHIP) g.flags.add('observed:airship');
}

/** the hover tooltip's lines for a landmark */
export function landmarkTip(g: Game, l: Landmark): { text: string; color?: number }[] {
  const AMBER = 23, PEBBLE = 7;
  const line = (on: boolean, yes: string, no: string) => ({ text: on ? yes : no, color: PEBBLE });
  switch (l.id) {
    case 'town_mill': return [{ text: l.name, color: AMBER }, line(g.flags.has('town_mill'), 'The wheel turns: the town grinds its flour here again.', "Silent: its wheel hasn't turned in years.")];
    case 'pump_house': return [{ text: l.name, color: AMBER }, line(g.flags.has('waterworks'), "Pumping: the square's fountain runs.", 'Shuttered: its pumps are seized.')];
    case 'fountain': return [{ text: l.name, color: AMBER }, line(g.flags.has('waterworks'), 'Running, fed by the Waterworks.', 'Dry and cracked: the Waterworks are shut.')];
    default: return [{ text: l.name, color: AMBER }, { text: "Roxy's airship, moored on Skyhook Field.", color: PEBBLE }];
  }
}

/** F at a landmark's door: what it is doing (they aren't entered), and it counts as looking */
function landmarkDoor(g: Game, b: BuildingInfo) {
  const l = LANDMARKS.find((x) => x.id === b.id);
  if (l) lookAt(g, l);
  if (b.id === TOWN_MILL.id) g.toast(g.flags.has('town_mill') ? 'The Town Mill. The wheel turns, and the stones grind the town\'s flour again.' : "The Town Mill. Its wheel hasn't turned since the old works closed, and the millstones are cold.");
  else if (b.id === PUMP_HOUSE.id) g.toast(g.flags.has('waterworks') ? "The Waterworks. The pumps thump away, and the square's fountain runs." : "The Waterworks. Shuttered: the pumps that fed the square's fountain are seized.");
  g.emit({ t: 'sfx', id: 'thud' });
}

// ---------------- the tram ----------------
/** an ore the tram carries: the ores (copper, tin, iron, gold, starmetal) */
export function isOre(k: ItemKey): boolean {
  const d = kDef(k);
  return d.cat === 'ore' || d.id.endsWith('_ore');
}

/** the market's price for one, before anything flooded it (the tram's sales never saturate) */
export function freshPrice(g: Game, k: ItemKey): number {
  const m = market(g), idx = kIdx(k), s0 = m.sat[idx];
  delete m.sat[idx];
  try {
    return unitPrice(g, k);
  } finally {
    if (s0 !== undefined) m.sat[idx] = s0;
  }
}

/** the tram's cart bin at the quarry, if the tram runs */
export function tramBin(g: Game): Ent | null {
  return g.ents.others.find((e) => e.def.id === 'tram_bin' && !e.ghost) ?? null;
}

/** put the cart bin at the quarry entrance (beside it if something of yours stands there) */
function placeTramBin(g: Game): Ent | null {
  const [bx, by] = TRAM.bin;
  const spots: [number, number][] = [[bx, by], [bx, by - 1], [bx + 1, by], [bx + 1, by - 1], [bx - 1, by - 1], [bx + 2, by], [bx + 2, by - 1], [bx, by - 2]];
  const spot = spots.find(([x, y]) => !g.ents.at(x, y) && !g.map.buildingAt[g.map.idx(x, y)]);
  if (!spot) return null;
  const [x, y] = spot;
  g.map.setO(x, y, O.NONE);
  const e = g.ents.add('tram_bin', x, y, 0);
  e.st.fixed = true;
  return e;
}

/** every morning: the cart takes up to 20 ore from its bin to town and sells it at a premium */
export function tramRun(g: Game): { n: number; coins: number } {
  const s = townworks(g);
  s.cart = 0;
  const bin = g.flags.has('tram') ? tramBin(g) : null;
  if (!bin?.inv) return { n: 0, coins: 0 };
  const took = new Map<ItemKey, number>();
  let left = TRAM_LOAD;
  for (let i = 0; i < bin.inv.slots.length && left > 0; i++) {
    const sl = bin.inv.slots[i];
    if (!sl || !isOre(sl.k)) continue;
    const t = Math.min(left, sl.n);
    sl.n -= t;
    left -= t;
    if (sl.n <= 0) bin.inv.slots[i] = null;
    took.set(sl.k, (took.get(sl.k) ?? 0) + t);
  }
  if (!took.size) return { n: 0, coins: 0 };
  const m = market(g);
  let coins = 0, n = 0;
  const parts: string[] = [];
  for (const [k, c] of took) {
    coins += Math.round(freshPrice(g, k) * TRAM_PREMIUM * c);
    n += c;
    const id = kDef(k).id;
    // sold like a shipment (stats, collections, quests), but the market isn't flooded by it
    m.shipped[id] = (m.shipped[id] ?? 0) + c;
    g.stats.use(k, c);
    g.sys.collections?.shipped?.(g, k, c);
    g.sys.quests?.notify?.(g, 'ship', c, id);
    parts.push(`${c} ${kDef(k).name.toLowerCase()}`);
  }
  g.player.money += coins;
  g.earned += coins;
  s.cart = n;
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  g.toast(`The tram sold ${list} in town: ${coins} coins`, 'i:' + kDef([...took.keys()][0]).id);
  g.emit({ t: 'sfx', id: 'coin' });
  return { n, coins };
}

// ---------------- the lamps ----------------
function lampsTick(g: Game) {
  const s = townworks(g);
  const load = lampLoad(g);
  // on now; the grid's share for it is known at the next power update (sat stays 0 until then)
  const was = load.on;
  load.on = lampsWanted(g);
  s.lit = was && load.on && load.sat >= LAMP_MIN_SAT;
  if (s.lit && !g.flags.has('lamplighting')) {
    g.flags.add('lamplighting');
    g.toast("The square's lamps are lit, on your power.", 'i:lamp');
    g.emit({ t: 'sfx', id: 'chime' });
  }
}

/** A loaded game standing inside a landmark (the world changed under the save) steps out front. */
function stepOutside(g: Game) {
  const p = g.player;
  if (p.where !== 'world') return;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const b = g.map.buildingAtTile(tx, ty);
  const inFountain = tx >= FOUNTAIN.x && tx < FOUNTAIN.x + FOUNTAIN.w && ty >= FOUNTAIN.y && ty < FOUNTAIN.y + FOUNTAIN.h;
  const onLamp = SQUARE_LAMPS.some(([x, y]) => x === tx && y === ty);
  if (b?.kind === LANDMARK) {
    p.x = b.door[0] + 0.5;
    p.y = b.y + b.h + 0.9;
  } else if (inFountain) p.y = FOUNTAIN.y - 0.1;
  else if (onLamp) p.y += 1;
}

registerSystem({
  name: 'townworks',
  init(g) {
    if (g.map.w >= 200) lampLoad(g);
  },
  dayStart(g) {
    if (g.map.w < 200) return;
    lampLoad(g);
    g.sys.townworksDoor = landmarkDoor;
    tramRun(g);
  },
  tick(g) {
    if (g.map.w < 200 || g.tickN % 60 !== 0) return;
    noticeNearby(g);
    lampsTick(g);
    if (g.flags.has('tram') && !tramBin(g) && placeTramBin(g)) g.toast("The tram's cart bin stands at the quarry entrance: ore left in it goes to town with the morning cart.", 'i:copper_ore');
  },
  save(g) {
    return { cart: townworks(g).cart };
  },
  load(g, d) {
    townworks(g).cart = d?.cart ?? 0;
  },
  afterLoad(g) {
    if (g.map.w < 200) return;
    // saves from before the keystones keep their own ground and objects: lay the mill's, the pump
    // house's and the fountain's ground and the square's lamps (the buildings come with the world)
    layTownworks(g.map);
    stepOutside(g);
    lampLoad(g);
    g.sys.townworksDoor = landmarkDoor;
  },
});
