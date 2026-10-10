// The Deepworks (ROADMAP.md 7.2): thirty levels in six strata, their hazards, pests and works chambers.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { O, ORE_TYPES, T, type TileMap } from '../src/sim/world/tilemap';
import {
  BEAMS_TO_SHORE, CRACK_FUSE, PROP_PLANKS, DEEP_FLAGS, FLOOD_TEXT, LAMP_LIGHT, MAX_FLOOR, VENT_HURT, generateFloor, liftLevels, mine, minePrompt, partsText, themeOf,
  type Hazard, type MineState, type Monster,
} from '../src/sim/systems/mine';
import { CHAMBERS, CHAMBER_BY_KIND, OBSERVATIONS, STRATA, VENT_CYCLE, VENT_ON, VENT_TELL, type ChamberKind } from '../src/data/deepworks';
import { MONSTERS } from '../src/data/creatures';
import { ITEM_BY_ID } from '../src/data/items';
import { RESEARCH_BY_ID } from '../src/data/research';
import { C } from '../src/data/palette';
import { useHeld } from '../src/sim/actions';
import { serialize, deserialize } from '../src/sim/save';
import { dropsState, spawnDrop } from '../src/sim/systems/drops';
import { questSys } from '../src/sim/systems/quests';

const SEEDS = [1, 7, 23, 404, 9001];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const run = (g: Game, sec: number) => { for (let i = 0; i < Math.round(sec * 60); i++) g.tick(); };
const toasts = (g: Game) => g.events.filter((e) => e.t === 'toast').map((e) => (e as { text: string }).text);
const opened = (g: Game, win: string) => g.events.filter((e) => e.t === 'ui' && (e as { open: string }).open === win) as { arg?: unknown }[];
/** the message cards opened (a chamber's study card) */
const cards = (g: Game) => opened(g, 'message').map((e) => e.arg as { title: string; text: string; icon?: string });
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** stand on a tile (the player's feet are a little below its middle) */
const stand = (g: Game, x: number, y: number) => { g.player.x = x + 0.5; g.player.y = y + 0.7; g.player.invuln = 0; };
const isRock = (o: number) => o === O.ROCK || o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK;

/** tiles you can walk or dig through (rocks can be mined): what the generator keeps in reach */
const passable = (m: TileMap, i: number) => m.ground[i] === T.MINEFLOOR && ![O.STALAGMITE, O.CRYSTAL, O.CHAMBER, O.TREASURE, O.GALLERY].includes(m.obj[i]);
function reach(m: TileMap, from: [number, number]): Int32Array {
  const d = new Int32Array(m.w * m.h).fill(-1);
  const s = m.idx(from[0], from[1]);
  d[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const u = q[h], ux = u % m.w, uy = (u - ux) / m.w;
    for (const [dx, dy] of N4) {
      const x = ux + dx, y = uy + dy;
      if (!m.inb(x, y)) continue;
      const v = m.idx(x, y);
      if (d[v] >= 0 || !passable(m, v)) continue;
      d[v] = d[u] + 1;
      q.push(v);
    }
  }
  return d;
}
const besideReach = (m: TileMap, d: Int32Array, x: number, y: number) => N4.some(([dx, dy]) => m.inb(x + dx, y + dy) && d[m.idx(x + dx, y + dy)] >= 0);

/** break every rock on the level with a gold pickaxe (pests set aside so none takes a hit) */
function breakAll(g: Game, st: MineState) {
  const keep = st.monsters;
  st.monsters = [];
  const m = st.map!;
  for (let i = 0; i < m.obj.length; i++) {
    const x = i % m.w, y = Math.floor(i / m.w);
    for (let k = 0; k < 20 && isRock(m.obj[i]); k++) st.useTool(g, 'pick', 4, x, y);
  }
  st.monsters = keep;
}

/** the first level from `levels` (on the first seed that has one) with a pest of this behaviour */
function levelWith(behavior: Monster['def']['behavior'], levels: number[]): { g: Game; st: MineState; mo: Monster } {
  for (const seed of SEEDS)
    for (const f of levels) {
      const g = new Game({ seed });
      const st = mine(g);
      st.enter(g, f);
      const mo = st.monsters.find((x) => x.def.behavior === behavior);
      if (mo) return { g, st, mo };
    }
  throw new Error('no level with a ' + behavior);
}

/** a gas pocket on level 17 with a clear floor tile beside it to walk in from */
function pocketLevel(perk?: string) {
  const g = new Game({ seed: 8 }), st = mine(g);
  if (perk) g.player.perks.push(perk);
  st.enter(g, 17);
  const m = st.map!, gas = st.hazards.filter((h) => h.kind === 'gas');
  const isGas = (x: number, y: number) => gas.some((h) => h.x === x && h.y === y);
  for (const h of gas)
    for (const [dx, dy] of N4) {
      const x = h.x + dx, y = h.y + dy;
      if (m.g(x, y) === T.MINEFLOOR && m.o(x, y) === O.NONE && !isGas(x, y) && !st.solid(g, x, y)) {
        const group = gas.filter((k) => k.group === h.group);
        const set = (state: number, t: number) => { for (const k of group) { k.state = state; k.t = t; } };
        return { g, st, pocket: h as Hazard, from: [x, y] as [number, number], group, set, isGas };
      }
    }
  throw new Error('no gas pocket with a clear side');
}
const tileOf = (g: Game) => [Math.floor(g.player.x), Math.floor(g.player.y - 0.2)];

describe('the Deepworks: thirty levels in six strata', () => {
  it('every level 1-30, on several seeds, keeps its floor, its way down, its chambers and its hazards in reach of the ladder up', () => {
    for (const seed of SEEDS) {
      const g = new Game({ seed });
      for (let f = 1; f <= MAX_FLOOR; f++) {
        const gen = generateFloor(g, f), m = gen.map, at = `seed ${seed} level ${f}`;
        expect(m.o(gen.entry[0], gen.entry[1]), at).toBe(O.MINE_EXIT);
        const d = reach(m, gen.entry);
        let lost = 0;
        for (let i = 0; i < d.length; i++) if (passable(m, i) && d[i] < 0) lost++;
        expect(lost, at + ': open tiles out of reach').toBe(0);
        // the way down: the gallery (6, 10), a wisp's ladder (21-29), a rock hiding the ladder (the rest); none on 30
        if (f === 6 || f === 10) {
          expect(gen.gallery, at).not.toBeNull();
          const [x, y] = gen.gallery!;
          expect(m.o(x, y), at).toBe(O.GALLERY);
          expect(d[m.idx(x, y + 1)], at).toBeGreaterThanOrEqual(0);
          expect(gen.hidden, at).toBe(-1);
        } else if (f > 20 && f < MAX_FLOOR) {
          expect(gen.wispLadder, at).not.toBeNull();
          expect(d[m.idx(gen.wispLadder![0], gen.wispLadder![1])], at).toBeGreaterThanOrEqual(0);
          expect(gen.monsters.some((mo) => mo.def.behavior === 'guard'), at).toBe(true);
        } else if (f < MAX_FLOOR) {
          expect(gen.hidden, at).toBeGreaterThanOrEqual(0);
          expect(isRock(m.obj[gen.hidden]), at).toBe(true);
          expect(d[gen.hidden], at).toBeGreaterThanOrEqual(0);
        } else {
          expect([gen.hidden, gen.wispLadder, gen.gallery], at).toEqual([-1, null, null]);
        }
        // works chambers on every fifth level, the machine against the clearing's back wall, a lift landing beside the entry
        expect(gen.chambers.map((c) => c.kind), at).toEqual(CHAMBERS.filter((c) => c.level === f).map((c) => c.kind));
        for (const c of gen.chambers) {
          for (let x = c.x; x < c.x + c.w; x++) expect(m.o(x, c.y), at).toBe(O.CHAMBER);
          expect(Array.from({ length: c.w }, (_, k) => d[m.idx(c.x + k, c.y + 1)]).some((v) => v >= 0), at + ' ' + c.kind).toBe(true);
        }
        expect(m.obj.includes(O.ELEVATOR), at).toBe(f % 5 === 0 && f !== 5);
        // hazards, pests and chests in reach
        for (const h of gen.hazards) expect(d[m.idx(h.x, h.y)], at + ' ' + h.kind).toBeGreaterThanOrEqual(0);
        for (const mo of gen.monsters) expect(d[m.idx(Math.floor(mo.x), Math.floor(mo.y))], at + ' ' + mo.id).toBeGreaterThanOrEqual(0);
        m.obj.forEach((o, i) => { if (o === O.TREASURE) expect(besideReach(m, d, i % m.w, Math.floor(i / m.w)), at + ' chest').toBe(true); });
      }
    }
  });

  it('six strata of five levels, each with its own ores; the bottom is level 30', () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 30].map(themeOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(STRATA.map((s) => s.levels)).toEqual([[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30]]);
    const want: Record<string, string[]> = {
      earth: ['copper_ore', 'clay', 'coal'], clayworks: ['tin_ore', 'clay'], frost: ['iron_ore'], ember: ['gold_ore', 'coal'], crystal: [], starfall: ['starmetal_ore'],
    };
    const games = SEEDS.slice(0, 3).map((seed) => new Game({ seed }));
    for (const S of STRATA) {
      const ores = new Set<string>();
      let ice = 0, gems = 0, crystals = 0;
      for (const g of games)
        for (let f = S.levels[0]; f <= S.levels[1]; f++) {
          const m = generateFloor(g, f).map;
          m.obj.forEach((o, i) => {
            if (o === O.ORE_ROCK) ores.add(ORE_TYPES[m.objData[i]]);
            if (o === O.ICE_ROCK) ice++;
            if (o === O.GEM_ROCK) gems++;
            if (o === O.CRYSTAL) crystals++;
          });
        }
      expect([...ores].sort(), S.id).toEqual([...want[S.id]].sort());
      if (S.id === 'frost') expect(ice, 'frost shards in the ice').toBeGreaterThan(20);
      else expect(ice, S.id).toBe(0);
      if (S.id === 'crystal' || S.id === 'starfall') expect(gems, S.id).toBeGreaterThan(10);
      if (S.id === 'crystal') expect(crystals).toBeGreaterThan(20);
    }
    const g = games[0], st = mine(g);
    st.enter(g, 45);
    expect(st.floor).toBe(MAX_FLOOR);
  });

  it('each stratum reads differently: its own art, darkness and light', () => {
    expect(new Set(STRATA.map((s) => s.art)).size).toBe(6);
    const g = new Game({ seed: 3 }), st = mine(g);
    st.enter(g, 3);
    const earth = { dark: st.dark, lantern: st.lantern };
    // the Crystal's galleries are dark: a short lantern, and the crystals give the light
    st.enter(g, 23);
    expect(st.dark).toBeGreaterThan(earth.dark);
    expect(st.lantern).toBeLessThan(earth.lantern);
    const crystals = st.map!.obj.filter((o) => o === O.CRYSTAL).length;
    expect(crystals).toBeGreaterThan(5);
    expect(st.lights.filter((l) => !l.dyn && l.c === C.lavender).length).toBe(crystals);
  });

  it('levels regenerate every day, and stay put within one', () => {
    const g = new Game({ seed: 9 });
    const a = generateFloor(g, 3).map.obj.join();
    expect(generateFloor(g, 3).map.obj.join()).toBe(a);
    g.time.day++;
    expect(generateFloor(g, 3).map.obj.join()).not.toBe(a);
  });

  it("drops stay with their level: what's within reach goes into the bag on the way down", () => {
    const g = new Game({ seed: 3 }), st = mine(g);
    st.enter(g, 2);
    const ore = g.player.inv.countId('copper_ore'), coal = g.player.inv.countId('coal');
    spawnDrop(g, key('copper_ore'), 2, g.player.x + 1, g.player.y, false, 'mine');
    spawnDrop(g, key('coal'), 5, g.player.x + 15, g.player.y, false, 'mine');
    st.enter(g, 3);
    expect(g.player.inv.countId('copper_ore')).toBe(ore + 2);
    expect(g.player.inv.countId('coal')).toBe(coal);
    expect(dropsState(g).list.some((d) => d.map === 'mine')).toBe(false);
  });

  it('a grand chest waits on levels 10, 20 and 30, once each', () => {
    for (const f of [10, 20, 30]) {
      const g = new Game({ seed: 6 }), st = mine(g);
      st.enter(g, f);
      const m = st.map!;
      const i = m.obj.findIndex((o, j) => o === O.TREASURE && m.objData[j] === 1);
      expect(i, 'level ' + f).toBeGreaterThanOrEqual(0);
      const money = g.player.money;
      st.interact(g, i % m.w, Math.floor(i / m.w));
      expect(g.flags.has('treasure_' + f)).toBe(true);
      expect(g.player.money).toBeGreaterThan(money);
      st.enter(g, f);
      expect(st.map!.obj.some((o, j) => o === O.TREASURE && st.map!.objData[j] === 1), 'level ' + f + ' again').toBe(false);
    }
  });
});

describe('the Deepworks: works problems in the way down', () => {
  it("level 6's collapsed gallery blocks the way until 20 beams shore it up, for good", () => {
    const g = new Game({ seed: 4 }), st = mine(g);
    st.enter(g, 6);
    expect(toasts(g).some((t) => t.includes('caved in'))).toBe(true);
    const [x, y] = st.gallery!;
    expect(st.solid(g, x, y)).toBe(true);
    // no ladder turns up under the rocks
    breakAll(g, st);
    expect(st.ladder).toBeNull();
    // not enough beams: nothing happens but a note
    g.player.inv.add(key('beam'), BEAMS_TO_SHORE - 8);
    g.events.length = 0;
    expect(st.interact(g, x, y)).toBe(true);
    expect(g.flags.has(DEEP_FLAGS.shored)).toBe(false);
    expect(g.player.inv.countId('beam')).toBe(BEAMS_TO_SHORE - 8);
    expect(toasts(g).some((t) => t.includes(`${BEAMS_TO_SHORE} hardwood beams`))).toBe(true);
    expect(st.floor).toBe(6);
    // enough: shored, and the beams are used
    g.player.inv.add(key('beam'), 10);
    st.interact(g, x, y);
    expect(g.flags.has(DEEP_FLAGS.shored)).toBe(true);
    expect(g.player.inv.countId('beam')).toBe(2);
    expect(st.solid(g, x, y)).toBe(false);
    // the gallery stays shored: tomorrow's level 6 is open, and F takes you down
    g.time.day++;
    st.enter(g, 6);
    const [x2, y2] = st.gallery!;
    expect(st.map!.objData[st.map!.idx(x2, y2)]).toBe(1);
    st.interact(g, x2, y2);
    expect(st.floor).toBe(7);
  });

  it('below level 10 is under water until the town drains it', () => {
    const g = new Game({ seed: 3 }), st = mine(g);
    st.enter(g, 10);
    expect(toasts(g)).toContain(FLOOD_TEXT);
    const [x, y] = st.gallery!;
    expect(st.map!.objData[st.map!.idx(x, y)]).toBe(2);
    expect(st.solid(g, x, y)).toBe(true);
    g.events.length = 0;
    st.interact(g, x, y);
    expect(st.floor).toBe(10);
    expect(toasts(g)).toContain(FLOOD_TEXT);
    breakAll(g, st);
    expect(st.ladder).toBeNull();
    // the Waterworks keystone drains it: the stair is open
    g.flags.add(DEEP_FLAGS.drained);
    st.enter(g, 10);
    const [x2, y2] = st.gallery!;
    expect(st.map!.objData[st.map!.idx(x2, y2)]).toBe(3);
    expect(st.solid(g, x2, y2)).toBe(false);
    st.interact(g, x2, y2);
    expect(st.floor).toBe(11);
  });
});

describe('the Deepworks: hazards', () => {
  it("Earth: planks prop a cracked ceiling for good, from beside it (the critic's placed fix)", () => {
    const g = new Game({ seed: 34 }), st = mine(g);
    st.enter(g, 2);
    const crack = st.hazards.find((h) => h.kind === 'crack')!;
    const group = st.hazards.filter((h) => h.kind === 'crack' && h.group === crack.group);
    // beside it: nothing comes down
    stand(g, crack.x, crack.y + 1);
    run(g, 0.5);
    expect(group.every((h) => h.state === 0)).toBe(true);
    // no planks: it says what it needs
    g.events.length = 0;
    expect(st.interact(g, crack.x, crack.y)).toBe(true);
    expect(group.every((h) => h.state === 0)).toBe(true);
    expect(g.events.some((e) => e.t === 'toast' && /planks would prop it/.test((e as { text: string }).text))).toBe(true);
    // two planks: the whole crack is propped, and walking under it brings nothing down
    g.player.inv.add(key('plank'), 3);
    st.interact(g, crack.x, crack.y);
    expect(g.player.inv.countId('plank')).toBe(3 - PROP_PLANKS);
    expect(group.every((h) => h.state === 4)).toBe(true);
    const hp = g.player.hp;
    stand(g, crack.x, crack.y);
    run(g, CRACK_FUSE + 1);
    expect(g.player.hp).toBe(hp);
    for (const h of group) expect(st.map!.o(h.x, h.y)).not.toBe(O.ROCK);
  });

  it('Earth: a cracked ceiling rumbles when you come near and comes down 1.5 s later, on you if you stay', () => {
    const g = new Game({ seed: 34 }), st = mine(g);
    st.enter(g, 2);
    const crack = st.hazards.find((h) => h.kind === 'crack')!;
    expect(crack).toBeTruthy();
    const group = st.hazards.filter((h) => h.kind === 'crack' && h.group === crack.group);
    expect(group.length).toBeGreaterThanOrEqual(2);
    stand(g, crack.x, crack.y);
    const hp = g.player.hp;
    g.events.length = 0;
    run(g, 0.1);
    expect(group.every((h) => h.state === 1)).toBe(true);
    expect(g.events.some((e) => e.t === 'shake')).toBe(true);
    run(g, CRACK_FUSE - 0.4);
    expect(g.player.hp).toBe(hp);
    run(g, 0.6);
    expect(g.player.hp).toBeLessThan(hp);
    expect(st.hazards.includes(crack)).toBe(false);
    // the fallen rock stays where you weren't
    for (const h of group) if (h !== crack) expect(st.map!.o(h.x, h.y)).toBe(O.ROCK);
  });

  it('Ember: each gas pocket vents on its own 7-9 s clock, and the pockets start apart', () => {
    for (const seed of SEEDS)
      for (const f of [16, 18, 20]) {
        const g = new Game({ seed }), st = mine(g), at = `seed ${seed} level ${f}`;
        st.enter(g, f);
        const gas = st.hazards.filter((h) => h.kind === 'gas');
        expect(gas.length, at).toBeGreaterThan(0);
        const groups = [...new Set(gas.map((h) => h.group))];
        for (const gi of groups) {
          const tiles = gas.filter((h) => h.group === gi);
          // a pocket's tiles share one clock; everyone starts quiet
          expect(new Set(tiles.map((h) => `${h.period}:${h.t}:${h.state}`)).size, at).toBe(1);
          expect(tiles[0].state, at).toBe(0);
          expect(tiles[0].period!, at).toBeGreaterThanOrEqual(VENT_CYCLE[0]);
          expect(tiles[0].period!, at).toBeLessThanOrEqual(VENT_CYCLE[1]);
          expect(tiles[0].period! - VENT_TELL - VENT_ON, at + ': the quiet spell').toBeGreaterThanOrEqual(3);
        }
        expect(new Set(groups.map((gi) => gas.find((h) => h.group === gi)!.t)).size, at).toBe(groups.length);
      }
  });

  it('Ember: a quiet pocket is safe, its tell hisses, its vent costs health once and shoves you back out, never up a level', () => {
    const { g, st, pocket, from, group, set, isGas } = pocketLevel();
    const ventLight = () => st.lights.some((l) => l.dyn && l.c === C.lime && l.x === group[0].x + 0.5 && l.r >= 2.5);
    // walk in from the side while it's quiet: nothing happens
    set(0, 3);
    stand(g, from[0], from[1]);
    run(g, 0.1);
    stand(g, pocket.x, pocket.y);
    const hp = g.player.hp;
    g.events.length = 0;
    run(g, 1);
    expect(g.player.hp).toBe(hp);
    expect(ventLight()).toBe(false);
    // the tell: a hiss and building puffs, still harmless
    set(0, 0.05);
    run(g, 0.6);
    expect(pocket.state).toBe(1);
    expect(g.events.some((e) => e.t === 'sfx' && (e as { id: string }).id === 'hiss')).toBe(true);
    expect(g.player.hp).toBe(hp);
    // it vents: one blow, a shove back out the way you came, and you're still on level 17
    run(g, VENT_TELL);
    expect(pocket.state).toBe(3);
    expect(ventLight()).toBe(true);
    expect(hp - g.player.hp).toBe(VENT_HURT);
    expect(toasts(g).some((t) => t.startsWith('Firedamp'))).toBe(true);
    run(g, 0.6);
    const [tx, ty] = tileOf(g);
    expect(isGas(tx, ty), `pushed out to ${tx},${ty}`).toBe(false);
    expect(Math.abs(tx - from[0]) + Math.abs(ty - from[1])).toBeLessThanOrEqual(1);
    expect([st.floor, g.player.where]).toEqual([17, 'mine']);
    // once a vent: back in the plume, it doesn't hurt again
    const after = g.player.hp;
    stand(g, pocket.x, pocket.y);
    run(g, 0.3);
    expect(pocket.state).toBe(3);
    expect(g.player.hp).toBe(after);
    // the vent dies down and the pocket is quiet again; its next vent costs you again
    run(g, VENT_ON);
    expect(pocket.state).toBe(0);
    expect(pocket.hit).toBe(false);
    stand(g, pocket.x, pocket.y);
    run(g, pocket.t + VENT_TELL + 0.1);
    expect(pocket.state).toBe(3);
    expect(g.player.hp).toBeLessThan(after);
    expect([st.floor, g.player.where]).toEqual([17, 'mine']);
  });

  it('Ember: a spark-coil lantern burns a pocket off for good, at any point in its cycle', () => {
    const { g, st, pocket, set } = pocketLevel();
    g.research.done.add('r_spark');
    set(3, 2);
    stand(g, pocket.x, pocket.y);
    const hp = g.player.hp;
    run(g, 0.1);
    expect(g.player.hp).toBe(hp);
    expect(st.floor).toBe(17);
    expect(st.hazards.some((h) => h.kind === 'gas' && h.group === pocket.group)).toBe(false);
    expect(st.hazards.some((h) => h.kind === 'gas')).toBe(true);
  });

  it("Starfall: a star-shard's mark glows, then the shard lands: it hurts, and leaves starmetal", () => {
    const g = new Game({ seed: 11 }), st = mine(g);
    st.enter(g, 27);
    const shards = st.hazards.filter((h) => h.kind === 'shard');
    expect(shards.length).toBeGreaterThanOrEqual(2);
    const [a, b] = shards;
    a.t = b.t = 0.05;
    stand(g, a.x, a.y);
    run(g, 0.1);
    expect([a.state, b.state]).toEqual([1, 1]);
    const hp = g.player.hp;
    run(g, 1.3);
    expect(g.player.hp).toBeLessThan(hp);
    expect(st.map!.o(b.x, b.y)).toBe(O.ORE_ROCK);
    expect(ORE_TYPES[st.map!.objData[st.map!.idx(b.x, b.y)]]).toBe('starmetal_ore');
    expect(st.map!.o(a.x, a.y)).toBe(O.NONE);
  });
});

describe('the Deepworks: pests, not monsters', () => {
  it('pests live by stratum and keep the old drops', () => {
    expect(MONSTERS.map((m) => [m.id, m.floors])).toEqual([['rust_mite', [1, 10]], ['clatter_crab', [11, 20]], ['wisp', [21, 30]]]);
    const drops = new Set(MONSTERS.flatMap((m) => m.drops.map((d) => d.item)));
    for (const id of ['slime_gel', 'moth_dust', 'crab_shell', 'wisp_essence']) expect(drops.has(id), id).toBe(true);
    expect(MONSTERS.every((m) => m.dmg === 0)).toBe(true);
  });

  it('rust-mites eat ore left lying about (not what you stand by) and give it back when squashed', () => {
    const { g, st, mo: mite } = levelWith('mite', [4, 2, 8]);
    st.monsters = [mite];
    const ore = key('copper_ore');
    spawnDrop(g, ore, 3, mite.x, mite.y - 0.1, false, 'mine');
    const drop = dropsState(g).list[dropsState(g).list.length - 1];
    // you stand by it: the mite leaves it alone (and doesn't hurt you)
    g.player.x = drop.x + 2.35;
    g.player.y = drop.y + 0.3;
    const hp = g.player.hp;
    run(g, 2);
    expect(dropsState(g).list.includes(drop)).toBe(true);
    expect(mite.ate.length).toBe(0);
    // you walk off: the mite eats it
    g.player.x = drop.x + 12;
    mite.x = drop.x;
    mite.y = drop.y + 0.1;
    run(g, 1.5);
    expect(dropsState(g).list.includes(drop)).toBe(false);
    expect(mite.ate).toEqual([{ k: ore, n: 3 }]);
    expect(g.player.hp).toBe(hp);
    // squash it with the pickaxe and the ore comes back
    g.player.x = mite.x;
    g.player.y = mite.y + 1.2;
    g.player.dir = 0;
    st.useTool(g, 'pick', 0, Math.floor(mite.x), Math.floor(mite.y - 0.3));
    expect(st.monsters.includes(mite)).toBe(false);
    expect(dropsState(g).list.some((d) => d.k === ore && d.n === 3)).toBe(true);
    expect([g.counters.monsters, g.counters.slain_rust_mite]).toEqual([1, 1]);
  });

  it('clatter-crabs sit in a narrow gallery, never chase, and scuttle off after three hits (pickaxe or sword)', () => {
    const { g, st, mo: crab } = levelWith('block', [12, 13, 17, 14, 18]);
    const [hx, hy] = crab.home!;
    expect(st.solid(g, hx, hy)).toBe(true);
    const at = [crab.x, crab.y];
    g.player.x = crab.x;
    g.player.y = crab.y + 1.2;
    g.player.dir = 0;
    const hp = g.player.hp;
    run(g, 3);
    expect([crab.x, crab.y]).toEqual(at);
    expect(g.player.hp).toBe(hp);
    st.useTool(g, 'pick', 0, hx, hy);
    st.useTool(g, 'pick', 0, hx, hy);
    expect(crab.hp).toBe(1);
    expect(st.solid(g, hx, hy)).toBe(true);
    st.attack(g, hx, hy, { dmg: 5, speed: 1, knock: 1 });
    expect(crab.state).toBe(2);
    expect(st.solid(g, hx, hy)).toBe(false);
    expect(g.counters.slain_clatter_crab).toBe(1);
    run(g, 1.5);
    expect(st.monsters.includes(crab)).toBe(false);
  });

  it('the combat perks still count: Brute fells a clatter-crab in two hits, Warrior takes the edge off falling rock', () => {
    const { g, st, mo: crab } = levelWith('block', [12, 13, 17, 14, 18]);
    g.player.perks.push('brute');
    const [hx, hy] = crab.home!;
    st.useTool(g, 'pick', 0, hx, hy);
    expect(crab.state).toBe(0);
    st.useTool(g, 'pick', 0, hx, hy);
    expect(crab.state).toBe(2);
    // the same crack, with and without Warrior
    const hurt = (perk: boolean) => {
      const g2 = new Game({ seed: 34 }), st2 = mine(g2);
      if (perk) g2.player.perks.push('warrior');
      st2.enter(g2, 2);
      const crack = st2.hazards.find((h) => h.kind === 'crack')!;
      stand(g2, crack.x, crack.y);
      const hp = g2.player.hp;
      run(g2, CRACK_FUSE + 0.3);
      return hp - g2.player.hp;
    };
    const plain = hurt(false), warrior = hurt(true);
    expect(warrior).toBeGreaterThan(0);
    expect(warrior).toBeLessThan(plain);
    // and off a vent of firedamp
    const vent = (perk: boolean) => {
      const { g: g3, pocket, set } = pocketLevel(perk ? 'warrior' : undefined);
      set(3, 2);
      stand(g3, pocket.x, pocket.y);
      const hp = g3.player.hp;
      run(g3, 0.1);
      return hp - g3.player.hp;
    };
    expect(vent(false)).toBe(VENT_HURT);
    expect(vent(true)).toBe(Math.round(VENT_HURT * 0.75));
  });

  it('a wisp hides the ladder: no rock turns it up, one hit shows it', () => {
    const { g, st, mo: wisp } = levelWith('guard', [24, 22, 27]);
    expect(st.ladder).toBeNull();
    breakAll(g, st);
    expect(st.ladder).toBeNull();
    // it never hurts you either
    const hp = g.player.hp;
    g.player.x = wisp.x;
    g.player.y = wisp.y;
    run(g, 2);
    expect(g.player.hp).toBe(hp);
    g.player.y = wisp.y + 1.2;
    g.player.dir = 0;
    st.attack(g, Math.floor(wisp.x), Math.floor(wisp.y - 0.3), { dmg: 1, speed: 1, knock: 1 });
    expect(st.monsters.includes(wisp)).toBe(false);
    expect(st.ladder).toEqual(st.wispLadder);
    expect(st.map!.o(st.wispLadder![0], st.wispLadder![1])).toBe(O.LADDER);
  });
});

describe('the Deepworks: works chambers', () => {
  /** the research each chamber's study card names */
  const TEACHES: Partial<Record<ChamberKind, string>> = { boiler: 'Steam Power', lampworks: 'Spark Coils', lockers: 'Clockwork Assembly', star: 'Grand Works' };

  it('walking up to a chamber records what its machine teaches and opens its study card, once a kind; F opens it again', () => {
    const g = new Game({ seed: 2 }), st = mine(g);
    // the keystones' quests are on (a keystone walked by a main quest counts its look from the quest)
    for (const id of ['k11_boiler', 'k14_spark', 'k16_tram']) questSys(g).active.push({ id, prog: [0, 0, 0, 0, 0, 0], day: 0 });
    // (the Tram's order goes up with its quest: its toast comes now, not during a walk-up)
    run(g, 1.1);
    for (const f of [5, 10, 15, 20, 25, 30]) {
      st.enter(g, f);
      for (const c of st.chambers) {
        const d = CHAMBER_BY_KIND.get(c.kind)!;
        // the entry is too far to see from
        expect(g.flags.has('observed:' + c.kind), `${c.kind} from the entry`).toBe(false);
        g.player.x = c.x + c.w / 2;
        g.player.y = c.y + 3.2;
        g.events.length = 0;
        run(g, 0.05);
        expect(g.flags.has('observed:' + c.kind), c.kind).toBe(true);
        // the card: the machine's name, what it is, the research it teaches, the parts it takes
        expect(cards(g).length, c.kind).toBe(1);
        const [card] = cards(g);
        expect(card.title).toBe(cap(d.name));
        expect(card.text.toLowerCase()).toContain(d.learned.replace(/^[^:]*:\s*/, '').toLowerCase());
        expect(ITEM_BY_ID.has(card.icon!), c.kind + ' icon').toBe(true);
        if (TEACHES[c.kind]) {
          expect(card.text, c.kind).toContain(TEACHES[c.kind]);
          // (the keystone that reads this chamber's look is the one the card names)
          expect(RESEARCH_BY_ID.get(d.teaches!)?.name).toBe(TEACHES[c.kind]);
          expect(RESEARCH_BY_ID.get(d.teaches!)?.keystone?.observe?.flag).toBe('observed:' + c.kind);
        } else expect(d.teaches, c.kind).toBeUndefined();
        if (d.restore) expect(card.text).toContain(`Restoring it takes ${partsText(c.kind)}.`);
        // once a kind on its own; F at the machine opens it every time
        g.events.length = 0;
        run(g, 0.5);
        expect(cards(g).length, c.kind + ' again').toBe(0);
        st.interact(g, c.x, c.y);
        expect(cards(g).map((x) => x.title), c.kind + ' on F').toEqual([cap(d.name)]);
        expect(toasts(g).length).toBe(0);
      }
    }
    expect(OBSERVATIONS.every((f) => g.flags.has(f))).toBe(true);
    expect(g.counters.chambers_observed).toBe(7);
    // tomorrow's walk-up doesn't open them again
    g.time.day++;
    st.enter(g, 10);
    const boiler = st.chambers[0];
    g.player.x = boiler.x + boiler.w / 2;
    g.player.y = boiler.y + 3.2;
    g.events.length = 0;
    run(g, 0.1);
    expect(cards(g).length).toBe(0);
  });

  it("the boiler seen before \"Down to the Boiler\" isn't Steam Power's look; its card says to come back, and once the quest asks the walk-up counts", () => {
    const g = new Game({ seed: 3 }), st = mine(g);
    st.enter(g, 10);
    const boiler = st.chambers.find((c) => c.kind === 'boiler')!;
    g.player.x = boiler.x + boiler.w / 2;
    g.player.y = boiler.y + 3.2;
    g.events.length = 0;
    run(g, 0.1);
    expect(g.flags.has('observed:boiler')).toBe(false);
    expect(cards(g)[0].text).toContain('Come back to study it once "Down to the Boiler" begins, or borrow its record from Sable at the library then.');
    questSys(g).active.push({ id: 'k11_boiler', prog: [0, 0, 0, 0], day: g.dayIndex });
    run(g, 0.1);
    expect(g.flags.has('observed:boiler')).toBe(true);
  });

  const RESTORES: [ChamberKind, string][] = [['lift', DEEP_FLAGS.lift], ['pump', DEEP_FLAGS.pump], ['cart', DEEP_FLAGS.cart]];
  it.each(RESTORES)('the %s takes its parts from the bag and sets %s (nothing taken when some are missing)', (kind, flag) => {
    const d = CHAMBER_BY_KIND.get(kind)!;
    const parts = d.restore!.parts;
    for (const [id] of parts) expect(ITEM_BY_ID.has(id), id).toBe(true);
    const g = new Game({ seed: 21 }), st = mine(g), inv = g.player.inv;
    st.enter(g, d.level);
    const c = st.chambers.find((x) => x.kind === kind)!;
    for (const [id, n] of parts) inv.add(key(id), Math.floor(n / 2));
    g.events.length = 0;
    expect(st.interact(g, c.x, c.y)).toBe(true);
    expect(g.flags.has(flag)).toBe(false);
    for (const [id, n] of parts) expect(inv.countId(id), id).toBe(Math.floor(n / 2));
    // the study card says what it takes and what's still to find
    expect(cards(g).length).toBe(1);
    expect(cards(g)[0].text).toContain(`Restoring it takes ${partsText(kind)}.`);
    expect(cards(g)[0].text).toContain('Still to find: ');
    expect(minePrompt(g, c.x, c.y)?.verb).not.toMatch(/^Restore/);
    expect(g.flags.has('observed:' + kind)).toBe(true);
    for (const [id, n] of parts) inv.add(key(id), n - Math.floor(n / 2) + 1);
    // every part in the bag: F restores it
    expect(minePrompt(g, c.x, c.y)?.verb).toBe('Restore ' + d.name);
    g.events.length = 0;
    st.interact(g, c.x, c.y);
    expect(g.flags.has(flag)).toBe(true);
    expect(toasts(g)).toContain(d.restore!.done);
    for (const [id] of parts) expect(inv.countId(id), id).toBe(1);
    // running: F again takes nothing more (the lift rides; the others show their card)
    g.events.length = 0;
    st.interact(g, c.x, c.y);
    for (const [id] of parts) expect(inv.countId(id), id).toBe(1);
    if (kind === 'lift') expect(opened(g, 'elevator').length).toBe(1);
    else expect(cards(g)[0].text).toContain(d.restore!.running);
    expect(st.restore(g, kind)).toBe('already');
  });

  it('the old pump drains the pools below level 10 and Frost and Ember ore comes out cleaner', () => {
    const g = new Game({ seed: 21 }), st = mine(g);
    const water = () => st.map!.ground.filter((t) => t === T.MINEWATER).length;
    st.enter(g, 15);
    expect(water()).toBeGreaterThan(0);
    g.player.inv.add(key('iron_plate'), 2);
    g.player.inv.add(key('spring'), 1);
    expect(st.restore(g, 'pump')).toBe('done');
    expect(water()).toBe(0);
    st.enter(g, 12);
    expect(water()).toBe(0);
    st.enter(g, 18);
    expect(st.map!.ground.includes(T.LAVA)).toBe(true);
    st.enter(g, 4);
    expect(water()).toBeGreaterThan(0);
    // an iron ore rock on level 12 gives at least two ore with the pump running
    st.enter(g, 12);
    st.monsters = [];
    const m = st.map!;
    for (let k = 0; k < 3; k++) {
      const i = m.obj.findIndex((o) => o === O.ORE_ROCK);
      const before = dropsState(g).list.length;
      for (let n = 0; n < 20 && m.obj[i] === O.ORE_ROCK; n++) st.useTool(g, 'pick', 4, i % m.w, Math.floor(i / m.w));
      const ore = dropsState(g).list.slice(before).find((d) => d.k === key('iron_ore'));
      expect(ore?.n).toBeGreaterThanOrEqual(2);
    }
  });

  it('no lift until the old lift on level 5 runs; then it stops at every chamber reached, none under the flood', () => {
    const g = new Game({ seed: 2 }), st = mine(g);
    // the entrance: the ladder straight down to level 1
    st.enterPrompt(g);
    expect(st.floor).toBe(1);
    expect(opened(g, 'elevator').length).toBe(0);
    // a chamber level's lift landing is dead
    st.enter(g, 10);
    const m = st.map!;
    const li = m.obj.indexOf(O.ELEVATOR);
    expect(li).toBeGreaterThanOrEqual(0);
    g.events.length = 0;
    st.interact(g, li % m.w, Math.floor(li / m.w));
    expect(opened(g, 'elevator').length).toBe(0);
    expect(st.floor).toBe(10);
    // the lift restored, it stops at the chambers reached: 5 and 10, then 15 and 20 once the flood's drained
    g.flags.add(DEEP_FLAGS.lift);
    st.deepest = 22;
    expect(liftLevels(g)).toEqual([5, 10]);
    g.flags.add(DEEP_FLAGS.drained);
    expect(liftLevels(g)).toEqual([5, 10, 15, 20]);
    g.events.length = 0;
    st.interact(g, li % m.w, Math.floor(li / m.w));
    expect(opened(g, 'elevator').map((e) => e.arg)).toEqual([[1, 5, 10, 15, 20]]);
    // and from the entrance
    st.leave(g);
    g.events.length = 0;
    st.enterPrompt(g);
    expect(g.player.where).toBe('world');
    expect(opened(g, 'elevator').map((e) => e.arg)).toEqual([[1, 5, 10, 15, 20]]);
  });
});

describe('the Deepworks: lamps light the dark', () => {
  /** hold the bag's lamps */
  const holdLamps = (g: Game, n: number) => {
    g.player.inv.add(key('lamp'), n);
    g.player.sel = g.player.inv.slots.findIndex((s) => s?.k === key('lamp'));
  };
  /** the floor tiles round the player where F would set a lamp down (the key prompt points at them) */
  const lampSpots = (g: Game) => {
    const out: [number, number][] = [];
    const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
    for (let y = py - 2; y <= py + 2; y++)
      for (let x = px - 2; x <= px + 2; x++) {
        const pr = minePrompt(g, x, y);
        if (pr?.verb !== 'Set lamp') continue;
        const at: [number, number] = [Math.floor(pr.x), Math.round(pr.y + 0.1)];
        if (!out.some(([a, b]) => a === at[0] && b === at[1])) out.push(at);
      }
    return out;
  };
  /** a tile of the level where `pred` holds */
  const tileWhere = (m: TileMap, pred: (i: number) => boolean): [number, number] => {
    const i = m.obj.findIndex((_, j) => pred(j));
    expect(i).toBeGreaterThanOrEqual(0);
    return [i % m.w, Math.floor(i / m.w)];
  };

  it('a lamp set down on a Crystal floor lights a wide pool, F picks it up, and leaving the level brings the lamps back', () => {
    expect(STRATA[4].intro).toContain('lamps');
    const g = new Game({ seed: 3 }), st = mine(g), inv = g.player.inv;
    st.enter(g, 22);
    holdLamps(g, 3);
    const spots = lampSpots(g);
    expect(spots.length).toBeGreaterThan(1);
    const [a, b] = spots;
    // F on the floor: one lamp from the bag, a light far wider than your lantern down here
    expect(st.interact(g, a[0], a[1])).toBe(true);
    expect(st.lamps).toEqual([a]);
    expect(inv.countId('lamp')).toBe(2);
    expect(st.lights.find((l) => !l.dyn && l.x === a[0] + 0.5 && l.y === a[1] - 0.4)?.r).toBe(LAMP_LIGHT);
    expect(LAMP_LIGHT).toBeGreaterThan(st.lantern * 2);
    expect(st.solid(g, a[0], a[1])).toBe(true);
    expect(minePrompt(g, a[0], a[1])?.verb).toBe('Pick up');
    // a click with one in hand sets another down
    expect(useHeld(g, b[0], b[1])).toBe(true);
    expect(st.lamps).toEqual([a, b]);
    expect(inv.countId('lamp')).toBe(1);
    // never on a wall, a pool, the ladder up, a rock or another lamp (and nothing leaves the bag)
    const m = st.map!;
    const wall = tileWhere(m, (i) => m.ground[i] === T.MINEWALL), pool = tileWhere(m, (i) => m.ground[i] === T.MINEWATER);
    const exit = tileWhere(m, (i) => m.obj[i] === O.MINE_EXIT), rock = tileWhere(m, (i) => m.obj[i] === O.ROCK);
    for (const [x, y] of [wall, pool, exit, rock, a]) {
      expect(st.setLamp(g, x, y), `${x},${y}`).toBe(false);
      expect(minePrompt(g, x, y)?.verb, `${x},${y}`).not.toBe('Set lamp');
    }
    expect(inv.countId('lamp')).toBe(1);
    // F on a lamp picks it up again, and its light goes
    expect(st.interact(g, a[0], a[1])).toBe(true);
    expect(st.lamps).toEqual([b]);
    expect(inv.countId('lamp')).toBe(2);
    expect(st.lights.some((l) => l.x === a[0] + 0.5 && l.y === a[1] - 0.4)).toBe(false);
    // down a level: the lamps left behind come back to the bag, however far off they stand
    g.player.x += 8;
    st.enter(g, 23);
    expect(st.lamps).toEqual([]);
    expect(inv.countId('lamp')).toBe(3);
    // and out of the Deepworks
    const c = lampSpots(g)[0];
    st.interact(g, c[0], c[1]);
    expect(inv.countId('lamp')).toBe(2);
    st.leave(g);
    expect(st.lamps).toEqual([]);
    expect(inv.countId('lamp')).toBe(3);
  });

  it('facing down from the top of a tile (still under your feet), F sets the lamp on the next one on', () => {
    const g = new Game({ seed: 3 }), st = mine(g), inv = g.player.inv;
    st.enter(g, 22);
    holdLamps(g, 1);
    const m = st.map!;
    const open = (x: number, y: number) => m.g(x, y) === T.MINEFLOOR && m.o(x, y) === O.NONE && !st.hazards.some((h) => h.x === x && h.y === y);
    const i = m.obj.findIndex((_, j) => open(j % m.w, Math.floor(j / m.w)) && open(j % m.w, Math.floor(j / m.w) + 1) && !st.monsters.some((mo) => Math.floor(mo.x) === j % m.w));
    const x = i % m.w, y = Math.floor(i / m.w);
    g.player.x = x + 0.5;
    g.player.y = y + 0.3;
    g.player.dir = 2;
    // (the tile you face is your own: src/sim/systems/player.ts facingTile)
    expect(Math.floor(g.player.y - 0.2 + 0.75)).toBe(y);
    expect(minePrompt(g, x, y)).toMatchObject({ verb: 'Set lamp', x: x + 0.5 });
    expect(st.interact(g, x, y)).toBe(true);
    expect(st.lamps).toEqual([[x, y + 1]]);
    expect(inv.countId('lamp')).toBe(0);
    // and F there picks it back up
    expect(minePrompt(g, x, y)?.verb).toBe('Pick up');
    st.interact(g, x, y);
    expect(st.lamps).toEqual([]);
    expect(inv.countId('lamp')).toBe(1);
  });

  it('never on a chamber or a gallery; a lamp left out overnight or in a save comes home', () => {
    const g = new Game({ seed: 3 }), st = mine(g), inv = g.player.inv;
    holdLamps(g, 2);
    st.enter(g, 25);
    const chamber = tileWhere(st.map!, (i) => st.map!.obj[i] === O.CHAMBER);
    expect(st.setLamp(g, chamber[0], chamber[1])).toBe(false);
    st.enter(g, 6);
    expect(st.setLamp(g, st.gallery![0], st.gallery![1])).toBe(false);
    expect(inv.countId('lamp')).toBe(2);
    // a save underground puts you at the entrance: the lamp set down counts as in the bag
    const [x, y] = lampSpots(g)[0];
    st.interact(g, x, y);
    expect(inv.countId('lamp')).toBe(1);
    const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(g2.player.inv.countId('lamp')).toBe(2);
    // passing out in the Deepworks: you wake at home, and so do your lamps
    g.endDay(true);
    expect(g.player.where).not.toBe('mine');
    expect(st.lamps).toEqual([]);
    expect(inv.countId('lamp')).toBe(2);
  });
});

describe("the Deepworks' chests and starstone (the owner's playtest)", () => {
  it('a chest opened stays opened all day: leaving and coming back no longer fills it again; a save keeps it', () => {
    // a level with a small chest today
    let found: { g: Game; floor: number } | null = null;
    for (const seed of SEEDS) {
      for (let floor = 1; floor < MAX_FLOOR && !found; floor++) {
        if (floor % 10 === 0) continue;
        const g = new Game({ seed });
        const m = generateFloor(g, floor).map;
        if (m.obj.some((o, i) => o === O.TREASURE && m.objData[i] === 0)) found = { g, floor };
      }
      if (found) break;
    }
    expect(found).not.toBeNull();
    const { g, floor } = found!;
    const st = mine(g);
    st.enter(g, floor);
    const m = st.map!;
    const i = m.obj.findIndex((o, j) => o === O.TREASURE && m.objData[j] === 0);
    const [x, y] = [i % m.w, Math.floor(i / m.w)];
    const before = dropsState(g).list.length;
    expect(st.interact(g, x, y)).toBe(true);
    expect(dropsState(g).list.length).toBeGreaterThan(before);
    // up and back down: the same level, its chest still open
    st.leave(g);
    st.enter(g, floor);
    expect(st.map!.obj[i]).toBe(O.TREASURE);
    expect(st.map!.objData[i]).toBe(2);
    g.events.length = 0;
    const n = dropsState(g).list.length;
    st.interact(g, x, y);
    expect(dropsState(g).list.length).toBe(n);
    expect(toasts(g).some((t) => /Empty/.test(t))).toBe(true);
    // through a save the same day
    const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    mine(g2).enter(g2, floor);
    expect(mine(g2).map!.objData[i]).toBe(2);
    // and the next day the level is a new one with its own luck
    expect(mine(g).looted.got).toContain('chest:' + floor);
  });

  it("the bottom's starstone, once broken, isn't there again when you come back that day", () => {
    const g = new Game({ seed: 7 });
    const st = mine(g);
    st.enter(g, MAX_FLOOR);
    const star = () => st.map!.obj.findIndex((o, j) => o === O.GEM_ROCK && st.map!.objData[j] === 6);
    expect(star()).toBeGreaterThanOrEqual(0);
    st.looted = { day: g.dayIndex, got: ['star:' + MAX_FLOOR] };
    st.leave(g);
    st.enter(g, MAX_FLOOR);
    expect(star()).toBe(-1);
    // a new day, a new level
    st.looted = { day: g.dayIndex - 1, got: ['star:' + MAX_FLOOR] };
    st.enter(g, MAX_FLOOR);
    expect(star()).toBeGreaterThanOrEqual(0);
  });
});
