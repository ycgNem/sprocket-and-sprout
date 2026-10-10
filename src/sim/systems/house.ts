// The farmhouse interior: a small cozy room with a bed, fireplace, kitchen, almanac.
import { shortName } from '../../data/cookbook';
import { Game, registerSystem, type DaySummary } from '../Game';
import { O, T, TileMap, Z } from '../world/tilemap';
import { C } from '../../data/palette';
import { SEASON_NAMES } from '../../data/types';
import { ITEM_BY_ID } from '../../data/items';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import { HOME_UPGRADES } from '../../data/shops';
import { FESTIVALS } from '../../data/goals';
import type { RecipeDef } from '../../data/types';
import { Inventory, key, kId, kQ } from '../inventory';
import { almanacRecipe } from './cookbook';
import { FURN_BY_ID, FurnDef } from '../../data/furniture';
import { loadLib, saveLib } from '../drafting';
import { HOUSE_DOOR, HOUSE_H, HOUSE_W, HOUSE_WIDE } from '../world/house';

export { HOUSE_W, HOUSE_H, HOUSE_DOOR, HOUSE_WIDE };
export const WAKE_POS: [number, number] = [3.5, 4.4];
/** the Workshop wing's first column (its stone floor); the drafting table stands in its far corner */
export const WING_X = HOUSE_W;
export const DRAFTING_AT: [number, number] = [19, 2];

export function houseMap(g: Game): TileMap {
  if (g.sys.house?.map) return g.sys.house.map;
  // the Workshop upgrade opens the east wall into a stone-floored wing (Workshop HQ, ROADMAP.md 7.8)
  const wide = g.flags.has('home_workshop');
  const W = wide ? HOUSE_WIDE : HOUSE_W;
  const m = new TileMap(W, HOUSE_H);
  m.indoors = true;
  m.zone.fill(Z.WILD);
  for (let y = 0; y < HOUSE_H; y++)
    for (let x = 0; x < W; x++) {
      const wall = y < 2 || x === 0 || x === W - 1 || y === HOUSE_H - 1;
      m.ground[m.idx(x, y)] = wall ? T.HOUSEWALL : wide && x >= WING_X ? T.PATH : T.WOODFLOOR;
      // walls: 3 = upper papered face, 0 = lower face with wainscot, 1 = timber top; floors get a variety value
      m.deco[m.idx(x, y)] = wall ? (x > 0 && x < W - 1 && y < 2 ? (y === 1 ? 0 : 3) : 1) : (x * 7 + y * 13) % 256;
    }
  // the door gap
  m.ground[m.idx(HOUSE_DOOR[0], HOUSE_DOOR[1])] = T.WOODFLOOR;
  const put = (x: number, y: number, o: O, d = 0) => {
    m.obj[m.idx(x, y)] = o;
    m.objData[m.idx(x, y)] = d;
  };
  put(3, 1, O.WINDOW);
  put(10, 1, O.WINDOW);
  put(5, 1, O.CLOCK);
  put(2, 2, O.BED, 0);
  put(2, 3, O.BED, 1);
  put(4, 2, O.DRESSER);
  put(7, 2, O.FIREPLACE, 0);
  put(8, 2, O.FIREPLACE, 1);
  put(10, 2, O.STOVE);
  put(11, 2, O.SHELF);
  put(12, 2, O.SHELF, 1);
  put(9, 6, O.TABLE);
  put(8, 6, O.CHAIR, 0);
  put(10, 6, O.CHAIR, 1);
  put(12, 5, O.ALMANAC);
  for (let y = 5; y <= 7; y++) for (let x = 4; x <= 6; x++) put(x, y, O.RUG, (y - 5) * 3 + (x - 4));
  put(1, 8, O.HOUSEPLANT);
  put(12, 8, O.HOUSEPLANT, 1);
  put(HOUSE_DOOR[0], HOUSE_DOOR[1] - 1, O.DOORMAT);
  if (wide) {
    // the wing: a workbench under its tool wall, a window, and the drafting table in the corner
    put(15, 1, O.TOOLWALL, 0);
    put(16, 1, O.TOOLWALL, 1);
    put(15, 2, O.WORKBENCH, 0);
    put(16, 2, O.WORKBENCH, 1);
    put(18, 1, O.WINDOW);
    if (g.flags.has('home_drafting')) {
      put(DRAFTING_AT[0], DRAFTING_AT[1], O.DRAFTING, 0);
      put(DRAFTING_AT[0] + 1, DRAFTING_AT[1], O.DRAFTING, 1);
    }
  }
  m.locs.set('door', HOUSE_DOOR);
  if (!g.sys.house) g.sys.house = {};
  Object.assign(g.sys.house, { map: m, enter: enterHouse, leave: leaveHouse, interact: houseInteract, hover: houseHover, decorAt, flatDecor: (id: string) => !!FURN_BY_ID.get(id)?.flat });
  return m;
}

/** the room changed shape (the Workshop wing, the drafting table): build its map again */
export function rebuildHouse(g: Game) {
  if (g.sys.house) g.sys.house.map = null;
  houseMap(g);
}

export function enterHouse(g: Game) {
  houseMap(g);
  g.player.where = 'house';
  g.player.x = HOUSE_DOOR[0] + 0.5;
  g.player.y = HOUSE_DOOR[1] - 1.2;
  g.player.dir = 0;
  g.emit({ t: 'sfx', id: 'door' });
  g.emit({ t: 'ui', open: 'fade' });
  // a quest that sends you indoors ("Housewarming": its gifts wait inside)
  g.sys.quests?.notify?.(g, 'visit', 1, 'farmhouse_in');
}

export function leaveHouse(g: Game) {
  const [x, y] = g.map.loc('farmhouse');
  g.player.where = 'world';
  g.player.x = x + 0.5;
  g.player.y = y + 0.9;
  g.player.dir = 2;
  g.emit({ t: 'sfx', id: 'door' });
  g.emit({ t: 'ui', open: 'fade' });
}

/** what the ledger's almanac page says (read when the ledger is opened: on a Sunday it teaches a recipe) */
export interface AlmanacBits { tomorrow: string; hot: string; soon: string[]; tip: string; season: string; recipe: string }

export function almanacBits(g: Game): AlmanacBits {
  const W: Record<string, string> = { sun: 'sunny', rain: 'rainy (crops water themselves)', storm: 'stormy: stay safe!', snow: 'snowy', wind: 'breezy (good for windmills)' };
  const hot = (g.sys.market?.hot ?? []).map((id: string) => ITEM_BY_ID.get(id)?.name).filter(Boolean).join(', ');
  const t = g.time;
  const soon: string[] = [];
  for (let d = 1; d <= 10; d++) {
    let day = t.day + d, season = t.season;
    if (day > 28) { day -= 28; season = (season + 1) % 4 as any; }
    for (const n of NPCS) if (n.birthday.season === season && n.birthday.day === day) soon.push(`${shortName(n.name)}'s birthday (${SEASON_NAMES[season]} ${day})`);
    const f = FESTIVALS.find((x) => x.season === season && x.day === day);
    if (f) soon.push(`${f.name} (${SEASON_NAMES[season]} ${day})`);
  }
  const tips = [
    'The night shift runs your works from 2am to 6am: stock a chest before bed and the night pays for it.',
    'Ship a lot of one thing and its price drops for a while. The ledger shows what is saturated.',
    'Hover over any machine to see what it is doing, or hold I to light up its line.',
    'A chest between two machines is a buffer: it evens out the flow.',
    'Ore veins in the quarry never run dry. Drills are your friend.',
    'Clockwork arms need no power. Brass arms are three times faster.',
    'Tag the crate for a customer and the post takes their order to them first.',
    'A machine indoors runs while you sleep, like the ones outside.',
    'Splitters share items evenly. Burrow belts tunnel under paths.',
    'Rain waters every outdoor crop. The greenhouse needs watering.',
  ];
  // the season notes that used to come as letters (DECISIONS #57)
  const SEAS = ['spring', 'summer', 'fall', 'winter'];
  const season = t.day <= 3 ? `It's early ${SEAS[t.season]}: new seeds are on the Mercantile's shelves.`
    : t.day >= 24 ? `${29 - t.day} days of ${SEAS[t.season]} left. Crops out of season wither when ${SEAS[(t.season + 1) % 4]} comes, so plan what you plant.` : '';
  const rec = almanacRecipe(g);
  const recipe = rec ? `Recipe of the week: ${ITEM_BY_ID.get(rec)!.name}. You copy it into your notebook.` : g.weekday === 6 ? '' : 'A new recipe appears in every Sunday edition.';
  return { tomorrow: W[g.tomorrow] ?? g.tomorrow, hot: hot || 'nothing in particular', soon, tip: tips[(g.dayIndex * 7 + 3) % tips.length], season, recipe };
}

const HOVER: Partial<Record<O, [string, string]>> = {
  [O.BED]: ['Bed', 'Right-click to sleep'],
  [O.STOVE]: ['Stove', 'Right-click to cook'],
  [O.ALMANAC]: ['The Ledger', "Yesterday's sales by customer, the market, tomorrow's weather"],
  [O.DRAFTING]: ['Drafting Table', 'Your blueprint library: save, name and load lines'],
  [O.WORKBENCH]: ['Workbench', 'F: craft (the crafting menu)'],
  [O.TOOLWALL]: ['Tool Wall', ''],
  [O.FIREPLACE]: ['Hearth', 'Warm yourself once a day'],
  [O.DOORMAT]: ['Front door', 'Walk out or right-click to leave'],
  [O.SHELF]: ['Shelf', ''],
  [O.DRESSER]: ['Dresser', ''],
  [O.CLOCK]: ['Clock', ''],
};

export function houseHover(g: Game, tx: number, ty: number): { text: string; color?: number }[] | null {
  const m = houseMap(g);
  if (g.sys.partnerHome?.(g) && Math.abs(tx + 0.5 - 8.5) < 0.8 && Math.abs(ty + 0.5 - 7.1) < 1) {
    const pid = [...g.flags].find((f) => f.startsWith('partner:'))!.slice(8);
    return [{ text: NPC_BY_ID.get(pid)?.name ?? pid, color: C.rose }, { text: 'Right-click to sit and talk', color: C.pebble }];
  }
  const dc = decorAt(g, tx, ty);
  if (dc) {
    const use = DECOR_USE.get(dc.id);
    if (use) return use.hover(g, dc);
    const f = FURN_BY_ID.get(dc.id)!;
    return [{ text: f.name, color: C.amber }, { text: 'Right-click to pick up', color: C.pebble }];
  }
  const o = m.o(tx, ty) as O;
  const h = HOVER[o];
  if (!h) return null;
  const sub = o === O.STOVE && !g.flags.has('home_kitchen') ? 'Needs a kitchen (Oakroot Joinery)' : o === O.FIREPLACE && g.sys.house.warmed ? 'Already warmed up today' : h[1];
  return sub ? [{ text: h[0], color: C.amber }, { text: sub, color: C.pebble }] : [{ text: h[0], color: C.amber }];
}

// ---------------- furniture ----------------
export interface Decor { id: string; x: number; y: number }

/**
 * Furniture with a use of its own (the hamster's cage: src/sim/systems/hamster.ts, which fills this
 * in so the farmhouse needn't import it). F or right-click uses it (false: picked up as any other),
 * its hover and its F bubble are its own, and Shift+right-click picks it up (src/app/play.ts).
 */
export interface DecorUse {
  use(g: Game, d: Decor): boolean;
  hover(g: Game, d: Decor): { text: string; color?: number }[];
  prompt?(g: Game, d: Decor): { verb: string; hint?: string } | null;
  placed?(g: Game, d: Decor): void;
  lifted?(g: Game, d: Decor): void;
}
export const DECOR_USE = new Map<string, DecorUse>();

export function decorList(g: Game): Decor[] {
  houseMap(g);
  if (!g.sys.house.decor) g.sys.house.decor = [];
  return g.sys.house.decor;
}

function covers(d: Decor, x: number, y: number) {
  const f = FURN_BY_ID.get(d.id);
  return !!f && x >= d.x && x < d.x + f.w && y >= d.y && y < d.y + f.h;
}

/** topmost decor on a tile (furniture before the rug under it) */
export function decorAt(g: Game, x: number, y: number): Decor | null {
  const list = decorList(g).filter((d) => covers(d, x, y));
  return list.find((d) => !FURN_BY_ID.get(d.id)!.flat) ?? list[0] ?? null;
}

export function decorSolid(g: Game, x: number, y: number): boolean {
  return decorList(g).some((d) => covers(d, x, y) && FURN_BY_ID.get(d.id)!.solid);
}

export function canPlaceDecor(g: Game, f: FurnDef, x: number, y: number): string | null {
  const m = houseMap(g);
  for (let yy = y; yy < y + f.h; yy++)
    for (let xx = x; xx < x + f.w; xx++) {
      if (f.wall) {
        if (yy !== 1 || xx < 1 || xx > m.w - 2) return 'Paintings go on the wall.';
        if (m.o(xx, yy)) return 'Something is already on that wall.';
        if (decorList(g).some((d) => covers(d, xx, yy))) return 'Something is already on that wall.';
        continue;
      }
      if (yy < 2 || yy > HOUSE_H - 2 || xx < 1 || xx > m.w - 2) return 'That has to go on the floor.';
      // a structure indoors (Workshop HQ) holds its tiles
      if (!f.flat && g.houseEnts.at(xx, yy)) return 'That spot is taken.';
      const o = m.o(xx, yy);
      if (o && !(o === O.RUG && !f.flat)) return 'That spot is taken.';
      if (xx === HOUSE_DOOR[0] && yy >= HOUSE_DOOR[1] - 2) return 'Keep the doorway clear.';
      for (const d of decorList(g)) {
        if (!covers(d, xx, yy)) continue;
        const other = FURN_BY_ID.get(d.id)!;
        // furniture may stand on a rug, but not on other furniture
        if (!(other.flat && !f.flat)) return 'That spot is taken.';
      }
      if (f.solid && Math.floor(g.player.x) === xx && Math.floor(g.player.y) === yy) return 'You are standing there.';
    }
  return null;
}

export function placeDecor(g: Game, id: string, x: number, y: number): string | null {
  const f = FURN_BY_ID.get(id);
  if (!f) return 'Unknown';
  const err = canPlaceDecor(g, f, x, y);
  if (err) return err;
  if (g.player.inv.removeSpec(id, 1).length === 0) return 'You have none.';
  const d = { id, x, y };
  decorList(g).push(d);
  g.emit({ t: 'sfx', id: 'place' });
  g.count('decor');
  DECOR_USE.get(id)?.placed?.(g, d);
  return null;
}

export function pickupDecor(g: Game, x: number, y: number): boolean {
  const d = decorAt(g, x, y);
  if (!d) return false;
  const f = FURN_BY_ID.get(d.id)!;
  // a rug can't be lifted while furniture stands on it
  if (f.flat && decorList(g).some((o) => o !== d && !FURN_BY_ID.get(o.id)!.flat && !FURN_BY_ID.get(o.id)!.wall && [...Array(f.w * f.h).keys()].some((k) => covers(o, d.x + (k % f.w), d.y + Math.floor(k / f.w))))) {
    g.toast('Move the furniture off the rug first.');
    return true;
  }
  if (g.player.inv.add(key(d.id), 1) > 0) {
    g.toast('Your bag is full.');
    return true;
  }
  DECOR_USE.get(d.id)?.lifted?.(g, d);
  const list = decorList(g);
  list.splice(list.indexOf(d), 1);
  g.emit({ t: 'sfx', id: 'pickup_struct' });
  return true;
}

/** F or right-click at a farmhouse tile (`critter`: the pet or the hamster's ball is on it, so a rug yields to it) */
export function houseInteract(g: Game, tx: number, ty: number, critter = false): boolean {
  const m = houseMap(g);
  if (g.sys.partnerAt?.(g, tx, ty)) return true;
  const dc = decorAt(g, tx, ty);
  if (dc && !(critter && FURN_BY_ID.get(dc.id)!.flat)) return DECOR_USE.get(dc.id)?.use(g, dc) || pickupDecor(g, tx, ty);
  const o = m.o(tx, ty);
  switch (o) {
    case O.BED:
      g.emit({
        t: 'ui', open: 'confirm',
        arg: { text: g.time.min >= 18 * 60 ? 'Climb into bed and end the day?' : 'Take an early night?', yesLabel: 'Sleep', noLabel: 'Not yet', yes: () => { g.goToBed(); g.emit({ t: 'sfx', id: 'sleep' }); } },
      });
      return true;
    case O.STOVE:
      if (g.flags.has('home_kitchen')) g.emit({ t: 'ui', open: 'cooking' });
      else g.toast('A cold old stove. Juniper at Oakroot Joinery could fit a proper kitchen.');
      return true;
    case O.ALMANAC:
      // the almanac is the works' ledger now (Workshop HQ, ROADMAP.md 7.8: src/ui/windows/home.ts)
      g.emit({ t: 'ui', open: 'ledger', arg: almanacBits(g) });
      g.emit({ t: 'sfx', id: 'open' });
      return true;
    case O.DRAFTING:
      g.emit({ t: 'ui', open: 'drafting' });
      g.emit({ t: 'sfx', id: 'open' });
      return true;
    case O.WORKBENCH:
      g.emit({ t: 'ui', open: 'menu', arg: 'crafting' });
      g.emit({ t: 'sfx', id: 'open' });
      return true;
    case O.TOOLWALL:
      g.toast('Every tool has its hook, and every hook its outline. The keeper was tidier than you.');
      return true;
    case O.FIREPLACE:
      g.toast(g.time.season === 3 ? 'The fire crackles. Toasty!' : 'The embers glow softly.');
      if (!g.sys.house.warmed) {
        g.sys.house.warmed = true;
        const gain = g.flags.has('home_hearth') ? 40 : 10;
        g.player.energy = Math.min(g.player.maxEnergy + g.mods.energy, g.player.energy + gain);
        g.emit({ t: 'float', text: `+${gain}`, x: g.player.x, y: g.player.y - 2, c: C.lime });
      }
      return true;
    case O.DOORMAT:
      leaveHouse(g);
      return true;
    case O.SHELF:
      g.toast(m.objData[m.idx(tx, ty)] ? 'A shelf of seed catalogs and a tin of buttons.' : 'Old farming books. Someone underlined "patience" twice.');
      return true;
    case O.DRESSER:
      g.toast('Your clothes, neatly folded. Mostly.');
      return true;
    case O.CLOCK:
      g.toast('Tick, tock. The clock agrees with the town hall. Mostly.');
      return true;
  }
  if (ty >= HOUSE_DOOR[1]) {
    leaveHouse(g);
    return true;
  }
  return false;
}

// ---------------- pantry + home cooking ----------------
export function pantry(g: Game): Inventory | null {
  if (!g.flags.has('home_pantry')) return null;
  houseMap(g);
  if (!g.sys.house.pantry) g.sys.house.pantry = new Inventory(36);
  return g.sys.house.pantry;
}

export function homeCount(g: Game, spec: string): number {
  return g.player.inv.countSpec(spec) + (pantry(g)?.countSpec(spec) ?? 0);
}

export function canCookHome(g: Game, r: RecipeDef, times = 1): boolean {
  if (!g.unlocked(r.unlock)) return false;
  const need = new Map<string, number>();
  for (const i of r.in) need.set(i.item, (need.get(i.item) ?? 0) + i.n * times);
  for (const [spec, n] of need) if (homeCount(g, spec) < n) return false;
  return true;
}

export function maxCookHome(g: Game, r: RecipeDef): number {
  let n = 0;
  while (n < 99 && canCookHome(g, r, n + 1)) n++;
  return n;
}

/** Cook from the bag first, then the root cellar. Returns how many were made. */
export function cookHome(g: Game, r: RecipeDef, times = 1): number {
  const pan = pantry(g);
  let made = 0;
  for (let t = 0; t < times; t++) {
    if (!canCookHome(g, r, 1)) break;
    const ins = [...r.in].sort((a, b) => (a.item[0] === '#' ? 1 : 0) - (b.item[0] === '#' ? 1 : 0));
    for (const i of ins) {
      const fromBag = Math.min(i.n, g.player.inv.countSpec(i.item));
      for (const st of g.player.inv.removeSpec(i.item, fromBag)) g.stats.use(st.k, st.n);
      if (fromBag < i.n && pan) for (const st of pan.removeSpec(i.item, i.n - fromBag)) g.stats.use(st.k, st.n);
    }
    for (const o of r.out) g.give(key(o.item), o.n, t === times - 1);
    made++;
  }
  if (made) {
    g.emit({ t: 'sfx', id: 'collect' });
    g.addXp('foraging', made * 3);
    g.count('cooked', made);
    g.sys.quests?.notify?.(g, 'craft', made, r.out[0].item);
  }
  return made;
}

// ---------------- renovations ----------------
export function canBuyHomeUpgrade(g: Game, id: string): string | null {
  const u = HOME_UPGRADES.find((x) => x.id === id);
  if (!u) return 'Unknown';
  if (g.flags.has(id)) return 'Already built.';
  if (u.requires && !g.flags.has(u.requires)) return `Needs the ${HOME_UPGRADES.find((x) => x.id === u.requires)?.name} first.`;
  if (g.player.money < u.price) return 'Not enough coins.';
  for (const m of u.materials) if (g.player.inv.countId(m.item) < m.n) return `You need ${m.n} ${ITEM_BY_ID.get(m.item)?.name}.`;
  return null;
}

export function buyHomeUpgrade(g: Game, id: string): string | null {
  const err = canBuyHomeUpgrade(g, id);
  if (err) return err;
  const u = HOME_UPGRADES.find((x) => x.id === id)!;
  g.player.money -= u.price;
  for (const m of u.materials) g.player.inv.removeSpec(m.item, m.n);
  g.flags.add(id);
  // the Workshop wing and the drafting table change the room itself
  rebuildHouse(g);
  g.emit({ t: 'sfx', id: 'place' });
  g.toast(`Juniper fits your ${u.name}. Go and see it!`);
  return null;
}

// ---------------- the ledger (the almanac's job now: Workshop HQ, ROADMAP.md 7.8) ----------------
/** a row of a day's sales: what, how many, the coins, and whose order it went to ('' = market) */
export interface LedgerRow { k: number; n: number; coins: number; to: string }
export interface LedgerDay { day: number; season: number; year: number; rows: LedgerRow[]; total: number }

/** yesterday's sales as the ledger shows them (null on the first morning) */
export const ledgerDay = (g: Game): LedgerDay | null => g.sys.house?.ledger ?? null;

registerSystem({
  name: 'house',
  save(g) {
    const p = g.sys.house?.pantry as Inventory | undefined;
    const L = ledgerDay(g);
    return {
      pantry: p ? p.toJSON() : undefined, decor: g.sys.house?.decor ?? [], lib: saveLib(g),
      ledger: L ? { ...L, rows: L.rows.map((r) => [kId(r.k), kQ(r.k), r.n, r.coins, r.to]) } : undefined,
    };
  },
  load(g, d) {
    // the room's shape follows the save's upgrades (the constructor built it before its flags)
    rebuildHouse(g);
    if (d?.pantry) g.sys.house.pantry = Inventory.fromJSON(d.pantry, 36);
    g.sys.house.decor = (d?.decor ?? []).filter((x: Decor) => FURN_BY_ID.has(x.id));
    // the drafting table's blueprint library (src/sim/drafting.ts)
    loadLib(g, d?.lib);
    const L = d?.ledger;
    g.sys.house.ledger = L ? {
      ...L, rows: (L.rows ?? []).filter((r: any[]) => ITEM_BY_ID.has(r[0])).map((r: any[]) => ({ k: key(r[0], r[1]), n: r[2], coins: r[3], to: r[4] ?? '' })),
    } : null;
  },
  dayEnd(g, s) {
    // the summary fills as the day's systems end it; the next morning copies what it says
    if (g.sys.house) g.sys.house.ending = s;
  },
  afterLoad(g) {
    rebuildHouse(g);
  },
  tick(g) {
    if (g.player.where !== 'house') return;
    // walking out through the door
    if (g.player.y > HOUSE_DOOR[1] - 0.15 && Math.abs(g.player.x - (HOUSE_DOOR[0] + 0.5)) < 0.8) leaveHouse(g);
  },
  dayStart(g) {
    houseMap(g);
    g.sys.house.warmed = false;
    const s = g.sys.house.ending as DaySummary | undefined;
    if (s) {
      g.sys.house.ledger = {
        day: s.day, season: s.season, year: s.year, total: s.total,
        rows: s.sold.map((r) => ({ k: r.k, n: r.n, coins: r.coins ?? r.price * r.n, to: r.to ?? '' })),
      } as LedgerDay;
      g.sys.house.ending = undefined;
    }
    if (g.map.w > 100 && g.dayIndex > 0) {
      // wake up inside, next to the bed
      g.player.where = 'house';
      g.player.x = WAKE_POS[0];
      g.player.y = WAKE_POS[1];
      g.player.dir = 2;
    }
  },
});
