// The farmhouse interior: a small cozy room with a bed, fireplace, kitchen, almanac.
import { shortName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import { O, T, TileMap, Z } from '../world/tilemap';
import { C } from '../../data/palette';
import { SEASON_NAMES } from '../../data/types';
import { ITEM_BY_ID } from '../../data/items';
import { NPCS } from '../../data/npcs';
import { HOME_UPGRADES } from '../../data/shops';
import { FESTIVALS } from '../../data/goals';
import type { RecipeDef } from '../../data/types';
import { Inventory, key } from '../inventory';
import { almanacRecipe } from './cookbook';
import { FURN_BY_ID, FurnDef } from '../../data/furniture';

export const HOUSE_W = 14, HOUSE_H = 11;
export const HOUSE_DOOR: [number, number] = [7, 10];
export const WAKE_POS: [number, number] = [3.5, 4.4];

export function houseMap(g: Game): TileMap {
  if (g.sys.house?.map) return g.sys.house.map;
  const m = new TileMap(HOUSE_W, HOUSE_H);
  m.zone.fill(Z.WILD);
  for (let y = 0; y < HOUSE_H; y++)
    for (let x = 0; x < HOUSE_W; x++) {
      const wall = y < 2 || x === 0 || x === HOUSE_W - 1 || y === HOUSE_H - 1;
      m.ground[m.idx(x, y)] = wall ? T.HOUSEWALL : T.WOODFLOOR;
      // walls: 3 = upper papered face, 0 = lower face with wainscot, 1 = timber top; floors get a variety value
      m.deco[m.idx(x, y)] = wall ? (x > 0 && x < HOUSE_W - 1 && y < 2 ? (y === 1 ? 0 : 3) : 1) : (x * 7 + y * 13) % 256;
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
  m.locs.set('door', HOUSE_DOOR);
  if (!g.sys.house) g.sys.house = {};
  Object.assign(g.sys.house, { map: m, enter: enterHouse, leave: leaveHouse, interact: houseInteract, hover: houseHover });
  return m;
}

export function enterHouse(g: Game) {
  houseMap(g);
  g.player.where = 'house';
  g.player.x = HOUSE_DOOR[0] + 0.5;
  g.player.y = HOUSE_DOOR[1] - 1.2;
  g.player.dir = 0;
  g.emit({ t: 'sfx', id: 'door' });
  g.emit({ t: 'ui', open: 'fade' });
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

function almanacText(g: Game): string {
  const W: Record<string, string> = { sun: 'sunny', rain: 'rainy (crops water themselves)', storm: 'stormy - stay safe!', snow: 'snowy', wind: 'breezy (good for windmills)' };
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
    'Belts keep moving even while you sleep. Overnight the factory catches up on the whole night.',
    'Flooding the market with one product lowers its price. Diversify!',
    'Hover over any machine to see what it is doing.',
    'Quality fertilizer must go in before the seed sprouts.',
    'Ore veins in the quarry never run dry. Drills are your friend.',
    'Clockwork arms need no power. Brass arms are three times faster.',
    'Villagers love gifts that match their personality. The journal remembers what they think of your held item.',
    'A shipping crate fed by an arm sells everything overnight.',
    'Splitters share items evenly. Burrow belts tunnel under paths.',
    'Rain waters every outdoor crop. The greenhouse needs watering.',
  ];
  const rec = almanacRecipe(g);
  const recLine = rec ? `\n\nRecipe of the week: ${ITEM_BY_ID.get(rec)!.name}. You copy it into your notebook.` : g.weekday === 6 ? '' : '\n\nA new recipe appears in every Sunday edition.';
  return `Tomorrow will be ${W[g.tomorrow] ?? g.tomorrow}.\n\nIn demand at market this week: ${hot || 'nothing in particular'}.\n\nComing up: ${soon.length ? soon.join('; ') : 'a quiet week'}.\n\nAlmanac wisdom: ${tips[(g.dayIndex * 7 + 3) % tips.length]}${recLine}`;
}

const HOVER: Partial<Record<O, [string, string]>> = {
  [O.BED]: ['Bed', 'Right-click to sleep'],
  [O.STOVE]: ['Stove', 'Right-click to cook'],
  [O.ALMANAC]: ['Almanac', 'Forecast, market news and the week ahead'],
  [O.FIREPLACE]: ['Hearth', 'Warm yourself once a day'],
  [O.DOORMAT]: ['Front door', 'Walk out or right-click to leave'],
  [O.SHELF]: ['Shelf', ''],
  [O.DRESSER]: ['Dresser', ''],
  [O.CLOCK]: ['Clock', ''],
};

export function houseHover(g: Game, tx: number, ty: number): { text: string; color?: number }[] | null {
  const m = houseMap(g);
  const dc = decorAt(g, tx, ty);
  if (dc) {
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
        if (yy !== 1 || xx < 1 || xx > HOUSE_W - 2) return 'Paintings go on the wall.';
        if (m.o(xx, yy)) return 'Something is already on that wall.';
        if (decorList(g).some((d) => covers(d, xx, yy))) return 'Something is already on that wall.';
        continue;
      }
      if (yy < 2 || yy > HOUSE_H - 2 || xx < 1 || xx > HOUSE_W - 2) return 'That has to go on the floor.';
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
  decorList(g).push({ id, x, y });
  g.emit({ t: 'sfx', id: 'place' });
  g.count('decor');
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
  const list = decorList(g);
  list.splice(list.indexOf(d), 1);
  g.emit({ t: 'sfx', id: 'pickup_struct' });
  return true;
}

export function houseInteract(g: Game, tx: number, ty: number): boolean {
  const m = houseMap(g);
  if (decorAt(g, tx, ty)) return pickupDecor(g, tx, ty);
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
      g.emit({ t: 'ui', open: 'message', arg: { title: `The Thistlewick Almanac - ${SEASON_NAMES[g.time.season]} ${g.time.day}`, text: almanacText(g) } });
      g.emit({ t: 'sfx', id: 'open' });
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
  g.emit({ t: 'sfx', id: 'place' });
  g.toast(`Juniper fits your ${u.name}. Go and see it!`);
  return null;
}

registerSystem({
  name: 'house',
  save(g) {
    const p = g.sys.house?.pantry as Inventory | undefined;
    return { pantry: p ? p.toJSON() : undefined, decor: g.sys.house?.decor ?? [] };
  },
  load(g, d) {
    houseMap(g);
    if (d?.pantry) g.sys.house.pantry = Inventory.fromJSON(d.pantry, 36);
    g.sys.house.decor = (d?.decor ?? []).filter((x: Decor) => FURN_BY_ID.has(x.id));
  },
  tick(g) {
    if (g.player.where !== 'house') return;
    // walking out through the door
    if (g.player.y > HOUSE_DOOR[1] - 0.15 && Math.abs(g.player.x - (HOUSE_DOOR[0] + 0.5)) < 0.8) leaveHouse(g);
  },
  dayStart(g) {
    houseMap(g);
    g.sys.house.warmed = false;
    if (g.map.w > 100 && g.dayIndex > 0) {
      // wake up inside, next to the bed
      g.player.where = 'house';
      g.player.x = WAKE_POS[0];
      g.player.y = WAKE_POS[1];
      g.player.dir = 2;
    }
  },
});
