// The hamster (the owner's playtest, src/sim/systems/hamster.ts): a cage from the Mercantile, a name
// and a coat, a seed for supper and a scratch, the wheel that winds the spring arms near its cage
// (its evening and the night shift), the ball, its cheek-pouch seeds, and its own dice.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { serialize, deserialize } from '../src/sim/save';
import { canPlaceIndoors, placeIndoors } from '../src/sim/indoors';
import { interact } from '../src/sim/actions';
import { promptAt } from '../src/sim/prompts';
import * as H from '../src/sim/systems/house';
import { FURN_BY_ID } from '../src/data/furniture';
import { SHOP_BY_ID } from '../src/data/shops';
import { adoptPet, petSys } from '../src/sim/systems/pet';
import { ballToggleAt, CAGE, cageOf, FEED_POINTS, hamsterBallAt, hamsterSys, nameHamster, toggleBall, WHEEL_REACH, type HamsterState } from '../src/sim/systems/hamster';
import type { Ent } from '../src/sim/ents';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
const run = (g: Game, sec: number) => { for (let i = 0; i < sec * 60; i++) g.tick(); };
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

/** a free spot for a piece of furniture, scanning the farmhouse floor from (x0, y0) */
function spotFor(g: Game, id: string, x0 = 1, y0 = 3): [number, number] {
  const f = FURN_BY_ID.get(id)!;
  for (let y = y0; y < 9; y++) for (let x = x0; x < 13; x++) if (!H.canPlaceDecor(g, f, x, y)) return [x, y];
  throw new Error('no spot for ' + id);
}

/** a game in the farmhouse with the cage placed (and its hamster named, unless `name` is false) */
function withCage(seed = 41, name = true): { g: Game; h: HamsterState; cage: H.Decor } {
  const g = new Game({ seed });
  H.enterHouse(g);
  g.player.x = 10.5;
  g.player.y = 8.5;
  g.player.inv.add(key(CAGE), 1);
  const [x, y] = spotFor(g, CAGE);
  g.events.length = 0;
  expect(H.placeDecor(g, CAGE, x, y)).toBeNull();
  if (name) nameHamster(g, 'Nibbles', 2);
  return { g, h: hamsterSys(g), cage: cageOf(g)! };
}

/** a spring arm indoors within the wheel's reach of the cage */
function armNear(g: Game, cage: H.Decor): Ent {
  for (let y = 3; y < 9; y++)
    for (let x = 1; x < 13; x++) {
      if (Math.hypot(x + 0.5 - (cage.x + 1), y + 0.5 - (cage.y + 0.5)) > WHEEL_REACH - 0.5) continue;
      if (canPlaceIndoors(g, 'arm_basic', x, y, 1).ok) return placeIndoors(g, 'arm_basic', x, y, 1);
    }
  throw new Error('no room for an arm');
}

const seedInHand = (g: Game, n = 3) => (g.player.inv.slots[(g.player.sel = 0)] = { k: key('radish_seed'), n });

describe('the hamster', () => {
  it('the Mercantile sells its cage; placing the first one asks for a name and a coat', () => {
    expect(SHOP_BY_ID.get('general')!.stock.some((e) => e.item === CAGE)).toBe(true);
    const { g, h } = withCage(41, false);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'hamster')).toBe(true);
    expect(h.named).toBe(false);
    // F at the cage asks again until it has a name
    const c = cageOf(g)!;
    g.events.length = 0;
    expect(promptAt(g, c.x, c.y)?.verb).toBe('Name your hamster');
    expect(interact(g, c.x, c.y)).toBe(true);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'hamster')).toBe(true);
    nameHamster(g, 'Domino', 3);
    expect(h.named).toBe(true);
    expect(h.coat).toBe(3);
    expect(g.flags.has('hamster')).toBe(true);
  });

  it('a seed is its supper once a day, and it likes a scratch', () => {
    const { g, h, cage } = withCage();
    const pts = h.points;
    seedInHand(g);
    const seeds = g.player.inv.countId('radish_seed');
    expect(promptAt(g, cage.x, cage.y)?.verb).toBe('Feed Nibbles');
    expect(interact(g, cage.x, cage.y)).toBe(true);
    expect(h.fedDay).toBe(g.dayIndex);
    expect(h.seed).toBe('radish_seed');
    expect(h.points).toBe(pts + FEED_POINTS);
    expect(g.player.inv.countId('radish_seed')).toBe(seeds - 1);
    // not twice in a day
    interact(g, cage.x, cage.y);
    expect(g.player.inv.countId('radish_seed')).toBe(seeds - 1);
    // with nothing it eats in hand: a scratch (once a day for its hearts)
    g.player.inv.slots[0] = null;
    expect(promptAt(g, cage.x, cage.y)?.verb).toBe('Pet Nibbles');
    interact(g, cage.x, cage.y);
    expect(h.pettedDay).toBe(g.dayIndex);
    const after = h.points;
    interact(g, cage.x, cage.y);
    expect(h.points).toBe(after);
    // the cage isn't picked up by F any more, but Shift+right-click (pickupDecor) still lifts it
    expect(cageOf(g)).not.toBeNull();
  });

  it("from a heart, a fed hamster's wheel winds the spring arms near its cage in the evening; not by day, not unfed", () => {
    const { g, h, cage } = withCage();
    const arm = armNear(g, cage);
    h.points = 300;
    // by day it's asleep in its shavings
    g.time.min = 10 * 60;
    seedInHand(g);
    interact(g, cage.x, cage.y);
    run(g, 20);
    expect(arm.st.wind ?? 0).toBe(0);
    expect(h.mode === 'wheel').toBe(false);
    // dusk: on its wheel, and the arm beside it wound
    g.time.min = 19 * 60;
    let wound = false;
    for (let s = 0; s < 120 && !wound; s++) {
      run(g, 1);
      wound = (arm.st.wind ?? 0) > 0;
    }
    expect(wound).toBe(true);
    expect(g.counters.hamster_wound).toBeGreaterThan(0);
    // unfed, it runs but turns no keys
    const u = withCage(42);
    const arm2 = armNear(u.g, u.cage);
    u.h.points = 300;
    u.g.time.min = 19 * 60;
    run(u.g, 90);
    expect(arm2.st.wind ?? 0).toBe(0);
  });

  it('its wheel turns the keys through the night shift while you sleep', () => {
    const night = (fed: boolean) => {
      const { g, h, cage } = withCage(43);
      armNear(g, cage);
      h.points = 300;
      if (fed) {
        seedInHand(g);
        interact(g, cage.x, cage.y);
      }
      sleep(g);
      return g.counters.hamster_wound ?? 0;
    };
    expect(night(true)).toBeGreaterThan(0);
    expect(night(false)).toBe(0);
  });

  it('Shift+F lets it out in its ball to roll about the farmhouse, and puts it back; the morning finds it in the cage', () => {
    const { g, h, cage } = withCage();
    expect(ballToggleAt(g, cage.x, cage.y)).toBe(true);
    expect(toggleBall(g)).toBe(true);
    expect(h.ball).toBe(true);
    const [x0, y0] = [h.x, h.y];
    run(g, 8);
    expect(Math.hypot(h.x - x0, h.y - y0)).toBeGreaterThan(0.3);
    // F at the ball: a scratch
    h.rolling = false;
    h.t = 99;
    const [bx, by] = [Math.floor(h.x), Math.floor(h.y - 0.3)];
    expect(hamsterBallAt(g, bx + 0.5, by + 0.5)).toBe(h);
    expect(interact(g, bx, by)).toBe(true);
    expect(h.pettedDay).toBe(g.dayIndex);
    // back in the cage
    expect(ballToggleAt(g, bx, by)).toBe(true);
    toggleBall(g);
    expect(h.ball).toBe(false);
    toggleBall(g);
    sleep(g);
    expect(h.ball).toBe(false);
    expect(h.mode).toBe('sleep');
  });

  it('from three hearts it now and then saves you some of the seeds you fed it', () => {
    const { g, h } = withCage(44);
    h.points = 800;
    let saved = false;
    for (let d = 0; d < 25 && !saved; d++) {
      h.fedDay = g.dayIndex;
      h.seed = 'radish_seed';
      g.events.length = 0;
      sleep(g);
      saved = g.events.some((e: any) => e.t === 'toast' && /cheek pouches/.test(e.text));
    }
    expect(saved).toBe(true);
  });

  it('keeps its name, coat and hearts through a save; its whims never touch the world\'s dice', () => {
    const { g, h } = withCage(45);
    h.points = 420;
    h.fedDay = g.dayIndex;
    toggleBall(g);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    const h2 = hamsterSys(g2);
    expect(h2.named).toBe(true);
    expect(h2.name).toBe('Nibbles');
    expect(h2.coat).toBe(2);
    expect(h2.points).toBe(420);
    expect(h2.ball).toBe(false);
    // the same day with a hamster and without: the world's dice fall the same
    const a = withCage(46), b = withCage(46, false);
    g.events.length = 0;
    a.g.time.min = b.g.time.min = 19 * 60;
    toggleBall(a.g);
    run(a.g, 30);
    run(b.g, 30);
    expect(a.g.rng.s).toBe(b.g.rng.s);
  });

  it('a pet on a rug: F pets it (a rug yields to who stands on it); F at the bare rug picks it up', () => {
    const g = new Game({ seed: 12 });
    sleep(g);
    sleep(g);
    adoptPet(g, 'Turnip');
    const p = petSys(g);
    H.enterHouse(g);
    g.player.inv.add(key('f_rug_blue'), 1);
    const [rx, ry] = spotFor(g, 'f_rug_blue', 2, 3);
    expect(H.placeDecor(g, 'f_rug_blue', rx, ry)).toBeNull();
    p.map = 'house';
    p.x = rx + 0.5;
    p.y = ry + 0.8;
    p.mode = 'sit';
    p.t = 99;
    const pts = p.points;
    expect(interact(g, rx, ry)).toBe(true);
    expect(p.points).toBeGreaterThan(pts);
    expect(H.decorAt(g, rx, ry)?.id).toBe('f_rug_blue');
    p.x = 50;
    expect(interact(g, rx, ry)).toBe(true);
    expect(H.decorAt(g, rx, ry)).toBeNull();
    expect(g.player.inv.countId('f_rug_blue')).toBe(1);
  });
});
