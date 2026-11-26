// Town life (src/sim/townlife.ts, src/sim/world/townlife.ts, the villagers' `stints` in
// src/data/npcs.ts): enough of the town outdoors on an ordinary dry weekday and the square never
// empty at lunch; villagers at the works a keystone rebuilt, only once its flag is set; a keeper
// working out in front of the shop still keeps it open; the Thursday market on the square; and none
// of it saved, so an old save loads and gets it.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { NPCS, NPC_BY_ID } from '../src/data/npcs';
import { SHOPS, SHOP_BY_ID } from '../src/data/shops';
import { FESTIVALS } from '../src/data/goals';
import { deserialize, serialize } from '../src/sim/save';
import { npcSys, scheduled, type NPCState } from '../src/sim/systems/npcs';
import { keeperIn, shopOpen, shopStatus } from '../src/sim/systems/town';
import { exportsState } from '../src/sim/systems/exports';
import { almanacBits } from '../src/sim/systems/house';
import { lifeSpot, marketDay, marketNotice, marketOn, marketSpot, nextMarket, stallShop, stintFor } from '../src/sim/townlife';
import { ODDS_TABLE, oddsStock } from '../src/sim/marketstall';
import { generateWorld } from '../src/sim/world/worldgen';
import { O } from '../src/sim/world/tilemap';
import {
  layTownlife, marketBlocks, marketStallAt, MARKET_BELL, MARKET_CLOSE, MARKET_OPEN, MARKET_STALLS, MARKET_STROLL, MARKET_WEEKDAY,
} from '../src/sim/world/townlife';

const KEYS = ['town_mill', 'waterworks', 'lamps_hung', 'lamplighting', 'tram', 'clock_fixed', 'harbor'];
const SQUARE = (n: NPCState) => n.visible && n.x >= 121.5 && n.x <= 144.5 && n.y >= 52.5 && n.y <= 69.5;
/** outdoors east of the river: the town a player walks through */
const TOWN = (n: NPCState) => n.visible && n.x >= 94;

/** a dry night's sleep (bed at 10pm, so the morning starts at 6) */
function sleep(g: Game, weather: 'sun' | 'rain' = 'sun') {
  const d0 = g.dayIndex;
  g.tomorrow = weather;
  g.time.min = 1320;
  g.goToBed();
  while (g.dayIndex === d0) g.tick();
}
/** sleep to the next day that is this weekday, in the farm's second week or later */
function toWeekday(g: Game, wd: number, weather: 'sun' | 'rain' = 'sun', fromDay = 8) {
  for (let i = 0; i < 30; i++) {
    const next = (g.weekday + 1) % 7;
    sleep(g, next === wd && g.time.day >= fromDay - 1 ? weather : 'sun');
    if (g.weekday === wd && g.time.day >= fromDay) return;
  }
  throw new Error('no such weekday');
}
const runTo = (g: Game, min: number) => { while (g.time.min < min) g.tick(); };
const at = (g: Game, id: string, min: number) => {
  g.time.min = min;
  const n = npcSys(g).byId.get(id)!;
  return lifeSpot(g, id, scheduled(g, n))?.loc ?? null;
};
const near = (g: Game, id: string, loc: string, r = 1.6) => {
  const n = npcSys(g).byId.get(id)!, p = g.map.locs.get(loc)!;
  return n.visible && Math.hypot(n.x - (p[0] + 0.5), n.y - (p[1] + 0.9)) <= r;
};

describe('the town outdoors on an ordinary dry weekday', () => {
  for (const [name, wd, flags] of [['a Monday before any keystone', 0, []], ['a Wednesday with every works running', 2, KEYS]] as [string, number, string[]][]) {
    it(`${name}: 8 of the 14 outdoors in town from 9 to 6, the square never empty at lunch, every open shop usable`, () => {
      const g = new Game({ seed: 4242 });
      for (const f of flags) g.flags.add(f);
      toWeekday(g, wd);
      expect(g.isRaining()).toBe(false);
      let least = 99, when = 0, lunch = 99;
      const shut: string[] = [];
      for (let t = 9 * 60; t <= 18 * 60; t += 10) {
        runTo(g, t);
        const L = npcSys(g).list;
        const out = L.filter(TOWN).length;
        if (out < least) { least = out; when = t; }
        if (t >= 11 * 60 + 30 && t <= 13 * 60 + 30) lunch = Math.min(lunch, L.filter(SQUARE).length);
        // a shop within its hours has its keeper at the door (inside, or out in front)
        for (const s of SHOPS) if (s.id !== 'cart' && shopOpen(g, s.id).open && !keeperIn(g, s.id)) shut.push(`${s.id}@${t}`);
      }
      expect(least, `fewest outdoors in town (at ${Math.floor(when / 60)}:${String(when % 60).padStart(2, '0')})`).toBeGreaterThanOrEqual(8);
      expect(lunch, 'fewest on the square, 11:30 to 13:30').toBeGreaterThanOrEqual(1);
      expect(shut, 'open shops with no keeper').toEqual([]);
    }, 120000);
  }

  it('lunch brings a gathering to the square, and nobody shares a tile there', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, 0);
    runTo(g, 12 * 60 + 30);
    const there = npcSys(g).list.filter(SQUARE);
    expect(there.length).toBeGreaterThanOrEqual(4);
    const tiles = there.filter((n) => !n.moving).map((n) => `${Math.floor(n.x)},${Math.floor(n.y - 0.1)}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  }, 60000);

  it('rain sends everyone back to the schedule: no stints, no market', () => {
    const g = new Game({ seed: 4242 });
    for (const f of KEYS) g.flags.add(f);
    toWeekday(g, MARKET_WEEKDAY, 'rain');
    expect(g.isRaining()).toBe(true);
    expect(marketDay(g)).toBe(false);
    for (const t of [450, 600, 720, 900, 1080]) for (const d of NPCS) expect(at(g, d.id, t), `${d.id} at ${t}`).toBeNull();
  }, 60000);
});

describe('villagers at the works a keystone rebuilt', () => {
  // [who, minute, weekday, the place, the keystone's flag]
  const CASES: [string, number, number, string, string][] = [
    ['juniper', 7 * 60 + 30, 0, 'mill_yard', 'town_mill'],
    ['rowan', 6 * 60 + 50, 0, 'mill_door', 'town_mill'],
    ['hazel', 9 * 60 + 30, 0, 'mill_bank', 'town_mill'],
    ['bram', 7 * 60 + 30, 0, 'pump_yard', 'waterworks'],
    ['ines', 15 * 60 + 30, 0, 'fountain_w', 'waterworks'],
    ['pip', 15 * 60 + 30, 0, 'fountain_e', 'waterworks'],
    ['sable', 17 * 60 + 45, 0, 'lamp_nw', 'lamps_hung'],
    ['sable', 19 * 60 + 50, 0, 'lamp_w', 'lamps_hung'],
    ['thorne', 8 * 60, 0, 'tram_quarry', 'tram'],
    ['thorne', 12 * 60, 0, 'tram_stop', 'tram'],
    ['tobias', 8 * 60 + 50, 0, 'tram_stop', 'tram'],
    ['tobias', 12 * 60, 0, 'clock_view', 'clock_fixed'],
    ['hazel', 12 * 60, 0, 'clock_view_e', 'clock_fixed'],
  ];
  it('each stands there only once the flag is set', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, 0);
    for (const [who, min, , loc, flag] of CASES) {
      expect(at(g, who, min), `${who} before ${flag}`).not.toBe(loc);
      g.flags.add(flag);
      expect(at(g, who, min), `${who} with ${flag}`).toBe(loc);
      g.flags.delete(flag);
    }
  }, 60000);

  it('Wren and Roxy come down to the Harbor only while the ship is in port', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, 1);
    g.flags.add('harbor');
    exportsState(g).ship = 'away';
    expect(at(g, 'wren', 7 * 60)).not.toBe('harbor_quay');
    expect(at(g, 'roxy', 17 * 60)).not.toBe('harbor_yard');
    exportsState(g).ship = 'port';
    expect(at(g, 'wren', 7 * 60)).toBe('harbor_quay');
    expect(at(g, 'roxy', 17 * 60)).toBe('harbor_yard');
    g.flags.delete('harbor');
    expect(at(g, 'wren', 7 * 60)).not.toBe('harbor_quay');
  }, 60000);

  it('they walk there: Juniper by the mill wheel and Bram at the pump house before their shops open, both back by 9', () => {
    const g = new Game({ seed: 4242 });
    for (const f of KEYS) g.flags.add(f);
    // (a Wednesday: on Tuesdays the Joinery is shut and Juniper stays by the wheel)
    toWeekday(g, 2);
    runTo(g, 7 * 60 + 50);
    expect(near(g, 'juniper', 'mill_yard')).toBe(true);
    expect(near(g, 'bram', 'pump_yard')).toBe(true);
    runTo(g, 9 * 60 + 5);
    expect(keeperIn(g, 'carpenter')).toBe(true);
    expect(keeperIn(g, 'smithy')).toBe(true);
    // the Mayor under the clock as it strikes noon, Sable on the lamp round at dusk
    runTo(g, 12 * 60 + 5);
    expect(near(g, 'tobias', 'clock_view')).toBe(true);
    runTo(g, 18 * 60 + 40);
    const sable = npcSys(g).byId.get('sable')!;
    expect(SQUARE(sable)).toBe(true);
    expect(sable.target.startsWith('lamp_')).toBe(true);
  }, 120000);

  it('every stint names a place the world has, and a line spoken only at a place names one too', () => {
    const g = new Game({ seed: 4242 });
    const fronts = new Set(SHOPS.map((s) => s.loc + '_front'));
    for (const d of NPCS) {
      for (const s of d.stints ?? []) {
        expect(g.map.locs.has(s.at), `${d.id}: ${s.at}`).toBe(true);
        expect(s.from).toBeLessThan(s.to);
        if (s.while) expect(d.schedules.some((sc) => sc.at.some((st) => st[1] === s.while)), `${d.id}: while ${s.while}`).toBe(true);
        if (s.flag) expect(KEYS, `${d.id}: flag ${s.flag}`).toContain(s.flag);
      }
      for (const l of d.dialogue) {
        if (!l.at) continue;
        const ok = l.at === 'market' || g.map.locs.has(l.at) || fronts.has(l.at) || [...g.map.locs.keys()].some((k) => k.startsWith(l.at!.replace(/\*$/, '')));
        expect(ok, `${d.id}: at ${l.at}`).toBe(true);
      }
    }
    // each of the six works has somebody
    for (const f of ['town_mill', 'waterworks', 'lamps_hung', 'tram', 'clock_fixed', 'harbor']) {
      expect(NPCS.some((d) => d.stints?.some((s) => s.flag === f)), f).toBe(true);
      expect(NPCS.some((d) => d.dialogue.some((l) => l.flag === f && l.at)), `a line at the ${f} works`).toBe(true);
    }
  });
});

describe('a keeper out in front of the shop', () => {
  it('Marigold works outside the Mercantile mid-morning and the door still opens', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, 0);
    runTo(g, 10 * 60 + 20);
    const m = npcSys(g).byId.get('marigold')!;
    m.met = true;
    expect(m.visible).toBe(true);
    expect(near(g, 'marigold', 'store_front')).toBe(true);
    expect(keeperIn(g, 'general')).toBe(true);
    expect(shopStatus(g, 'general').open).toBe(true);
    g.events.length = 0;
    g.sys.town.door(g, g.map.buildings.find((b) => b.id === 'store')!);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'shop' && e.arg === 'general')).toBe(true);
  }, 60000);

  it('no two keepers are out of their doors at the same minute of the lunch hour', () => {
    // (lunch on the square is for those without a counter, and one keeper a day: Marigold on Wednesday, Clem on Monday and Tuesday)
    const away = (id: string, min: number, wd: number) => (NPC_BY_ID.get(id)!.stints ?? []).some((s) => s.at.startsWith('lunch_') && min >= s.from && min < s.to && (!s.weekdays || s.weekdays.includes(wd)));
    const keepers = [...new Set(SHOPS.map((s) => s.owner))].filter((id) => NPC_BY_ID.has(id));
    for (let wd = 0; wd < 5; wd++) for (let min = 11 * 60; min <= 14 * 60; min += 5) {
      expect(keepers.filter((id) => away(id, min, wd)).length, `weekday ${wd} at ${min}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('the Thursday market', () => {
  it('is a Thursday, 9 to 4, clear of every closed day and festival', () => {
    expect(MARKET_WEEKDAY).toBe(3);
    for (const st of MARKET_STALLS) if (st.shop !== 'market') expect(SHOP_BY_ID.get(st.shop)!.closedDays ?? []).not.toContain(MARKET_WEEKDAY);
    // (a festival on a Thursday would take the day: the market stands down for it)
    const g = new Game({ seed: 4242 });
    toWeekday(g, MARKET_WEEKDAY);
    expect(marketDay(g)).toBe(true);
    const fest = g.sys.festivals.today;
    g.sys.festivals.today = () => FESTIVALS[0];
    expect(marketDay(g)).toBe(false);
    g.sys.festivals.today = fest;
    const mode = g.mode;
    g.mode = 'rush';
    expect(marketDay(g)).toBe(false);
    g.mode = mode;
    g.time.min = MARKET_OPEN - 1;
    expect(marketOn(g)).toBe(false);
    g.time.min = MARKET_OPEN;
    expect(marketOn(g)).toBe(true);
    g.time.min = MARKET_CLOSE;
    expect(marketOn(g)).toBe(false);
  }, 60000);

  it('is announced: the morning toast, the Orders board and the almanac', () => {
    const g = new Game({ seed: 4242 });
    // (the third week of spring: the Sprocket Fair's notice has the board in the second)
    toWeekday(g, MARKET_WEEKDAY - 1, 'sun', 15);
    const [s, d] = nextMarket(g);
    expect([s, d]).toEqual([g.time.season, g.time.day + 1]);
    expect(almanacBits(g).soon.some((x: string) => x.startsWith('Market day on the square'))).toBe(true);
    expect(marketNotice(g)).toBeNull();
    g.events.length = 0;
    const d0 = g.dayIndex;
    g.tomorrow = 'sun'; g.time.min = 1320; g.goToBed();
    const toasts: string[] = [];
    while (g.dayIndex === d0 || g.time.min < 6 * 60 + 5) { g.tick(); for (const e of g.events as any[]) if (e.t === 'toast') toasts.push(e.text); g.events.length = 0; }
    expect(toasts.some((t) => t.startsWith('Market day'))).toBe(true);
    expect(marketNotice(g)).toContain('Market day on the square');
    // from a Thursday the next is a week on, across the season's end too
    expect(nextMarket(g)).toEqual(g.time.day + 7 > 28 ? [(g.time.season + 1) % 4, g.time.day + 7 - 28] : [g.time.season, g.time.day + 7]);
  }, 60000);

  it('fills the square: keepers at their stalls, the Mayor at his bell, the rest strolling', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, MARKET_WEEKDAY);
    runTo(g, 9 * 60 + 30);
    expect(near(g, 'tobias', 'mkt_bell', 2)).toBe(true);
    runTo(g, 11 * 60);
    for (const st of MARKET_STALLS) expect(near(g, st.who, 'mkt_' + st.who), `${st.who} at the stall`).toBe(true);
    const there = npcSys(g).list.filter(SQUARE);
    expect(there.length).toBeGreaterThanOrEqual(8);
    const tiles = there.filter((n) => !n.moving).map((n) => `${Math.floor(n.x)},${Math.floor(n.y - 0.1)}`);
    expect(new Set(tiles).size).toBe(tiles.length);
    // nobody stands in a stall
    for (const n of there) expect(marketBlocks(Math.floor(n.x), Math.floor(n.y - 0.1)), n.id).toBe(false);
    // a keeper's stall is their shop: its goods at its prices, and the door on Main Street says where they are
    const marigold = npcSys(g).byId.get('marigold')!;
    expect(stallShop(g, marigold)).toBe('general');
    expect(shopStatus(g, 'general').text).toContain('at the market on the square');
    g.events.length = 0;
    marigold.met = true; marigold.talked = true;
    npcSys(g).interact(g, marigold);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'shop' && e.arg === 'general')).toBe(true);
    // the strollers don't share a stop, at any hour
    for (let t = MARKET_OPEN; t < MARKET_CLOSE; t += 5) {
      g.time.min = t;
      const spots = NPCS.map((d) => marketSpot(g, d.id)?.loc).filter(Boolean);
      expect(new Set(spots).size, `at ${t}`).toBe(spots.length);
    }
    // after four the stalls are gone and the keepers are back at their counters by half past
    g.time.min = 11 * 60;
    runTo(g, 16 * 60 + 40);
    expect(marketOn(g)).toBe(false);
    for (const st of MARKET_STALLS) if (st.shop !== 'market' && shopOpen(g, st.shop).open) expect(keeperIn(g, st.shop), `${st.who} back`).toBe(true);
  }, 120000);

  it('the odds table holds a few things from the shops that stayed in, at their own entries', () => {
    const g = new Game({ seed: 4242 });
    toWeekday(g, MARKET_WEEKDAY);
    g.time.min = 11 * 60;
    expect(stallShop(g, { id: 'hazel', visible: true })).toBe(ODDS_TABLE.id);
    expect(SHOP_BY_ID.has(ODDS_TABLE.id)).toBe(false);
    const stock = oddsStock(g);
    expect(stock.length).toBeGreaterThanOrEqual(3);
    expect(stock.length).toBeLessThanOrEqual(6);
    const shelves = ['workshop', 'inn', 'fisher', 'airfreight'].flatMap((id) => SHOP_BY_ID.get(id)!.stock);
    for (const e of stock) expect(shelves).toContain(e);
    expect(new Set(stock.map((e) => e.item)).size).toBe(stock.length);
    // the same all day
    expect(oddsStock(g)).toEqual(stock);
  }, 60000);

  it('its stalls stand on clear paving on every seed, and the places are laid again without moving', () => {
    for (const seed of [1, 7, 2024, 4242]) {
      const m = generateWorld(seed);
      const clear = (x: number, y: number) => m.walkable(x, y) && m.o(x, y) === O.NONE;
      for (const st of MARKET_STALLS) {
        expect(clear(st.x, st.y) && clear(st.x + 1, st.y), `seed ${seed}: ${st.who}'s counter`).toBe(true);
        expect(clear(st.stand[0], st.stand[1]), `seed ${seed}: ${st.who}'s stand`).toBe(true);
        expect(marketStallAt(st.x + 1, st.y)).toBe(st);
        expect(marketBlocks(st.stand[0], st.stand[1])).toBe(false);
      }
      expect(clear(MARKET_BELL.x, MARKET_BELL.y) && clear(MARKET_BELL.stand[0], MARKET_BELL.stand[1])).toBe(true);
      for (const [x, y] of MARKET_STROLL) expect(clear(x, y) && !marketBlocks(x, y), `seed ${seed}: stroll ${x},${y}`).toBe(true);
      for (const id of ['mill_yard', 'pump_yard', 'fountain_w', 'lamp_nw', 'tram_stop', 'clock_view', 'harbor_quay', 'school_yard', 'lunch_a', 'store_front', 'smithy_front', 'mkt_marigold', 'mkt_bell', 'mkt_s0']) {
        const p = m.locs.get(id);
        expect(p, `seed ${seed}: ${id}`).toBeTruthy();
        expect(m.walkable(p![0], p![1]), `seed ${seed}: ${id} walkable`).toBe(true);
      }
      const before = JSON.stringify([...m.locs]);
      layTownlife(m);
      expect(JSON.stringify([...m.locs])).toBe(before);
    }
  }, 60000);
});

describe('old saves', () => {
  const load = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))).toString('utf8'));
  for (const name of ['save111_everything', 'beta20_bot2024_day8']) {
    it(`${name}: loads, gets the town's places, and plays through a market day`, () => {
      const raw = load(name);
      expect(JSON.stringify(raw)).not.toContain('mill_yard');
      const { game: g, look } = deserialize(structuredClone(raw));
      for (const id of ['mill_yard', 'store_front', 'lunch_a', 'mkt_marigold']) expect(g.map.locs.has(id), id).toBe(true);
      for (let i = 0; i < 9 && g.weekday !== MARKET_WEEKDAY; i++) sleep(g);
      expect(g.weekday).toBe(MARKET_WEEKDAY);
      if (marketDay(g)) {
        runTo(g, 11 * 60);
        expect(npcSys(g).list.filter(SQUARE).length).toBeGreaterThanOrEqual(6);
      }
      runTo(g, 17 * 60);
      // nothing of it is saved: the villagers' saved state has no new field, and the save loads again
      const out = JSON.parse(JSON.stringify(serialize(g, look)));
      expect(Object.keys(out.sys)).not.toContain('townlife');
      expect(Object.keys(out.sys)).not.toContain('market_day');
      const again = deserialize(out);
      expect(again.game.dayIndex).toBe(g.dayIndex);
      expect(npcSys(again.game).list.length).toBe(npcSys(g).list.length);
    }, 120000);
  }
});

describe('no friendship anywhere in it', () => {
  it("the new lines and stints ask for nothing but a flag, a place and the clock", () => {
    for (const d of NPCS) {
      for (const s of d.stints ?? []) expect(Object.keys(s).every((k) => ['from', 'to', 'at', 'flag', 'noFlag', 'weekdays', 'ship', 'while', 'face', 'emote'].includes(k))).toBe(true);
      for (const l of d.dialogue) if (l.at) expect(Object.keys(l).some((k) => /heart|trust|friend|gift/i.test(k))).toBe(false);
    }
    expect(stintFor).toBeTypeOf('function');
  });
});
