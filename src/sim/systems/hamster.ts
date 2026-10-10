// The hamster (the owner's playtest: "add a hamster and make a sprite for it"). A Hamster Cage from
// the Mercantile comes with one: place it in the farmhouse, name it and pick its coat. A seed is its
// supper, once a day (F with a seed in hand), and it likes a scratch; hearts as the pet's. It sleeps
// the day away in its shavings and runs its wheel from dusk.
// The works' share: from a heart, a hamster fed today keeps the spring arms near its cage wound while
// it runs (its evening, and the night shift while you sleep), so the Workshop wing's arms swing at
// double speed. From three hearts it now and then saves you a few of the seeds you fed it. Shift+F
// at the cage lets it out in its ball to roll about the farmhouse; Shift+F again puts it back.
// Its whims use its own dice, never the world's: nothing it does moves the crops, the weather or
// the pacing bot (which never buys a cage).
import { Game, registerSystem } from '../Game';
import { Rng } from '../../engine/rng';
import { C } from '../../data/palette';
import { kDef, key } from '../inventory';
import { isRusted } from '../rust';
import { isSpringArm, WIND_TIME } from './arms';
import { DECOR_USE, decorList, decorSolid, houseMap, HOUSE_DOOR, type Decor } from './house';

export const CAGE = 'f_hamster_cage';
export const HAMSTER_COATS = ['Golden', 'Snow', 'Silver', 'Panda'];
export const DEFAULT_HAMSTER_NAMES = ['Nibbles', 'Mochi', 'Pippin', 'Domino'];
/** a seed (its supper, once a day) and a scratch */
export const FEED_POINTS = 25;
const PET_POINTS = 10;
/** from this many hearts a fed hamster's wheel winds the spring arms... */
export const WHEEL_HEARTS = 1;
/** ...within this many tiles of the cage */
export const WHEEL_REACH = 4;
/** it wakes for the wheel at dusk */
export const DUSK = 18 * 60;
/** where it does things in the cage: its feet, in the cage art's pixels from the cage's left (the
 * shavings it sleeps in, the dish end of its floor, the wheel; it potters about between 7 and 12) */
export const BED_X = 10, DISH_X = 7, WHEEL_X = 23;
const BALL_SPEED = 1.8;
/** the UI font's heart (src/ui/font.ts ICON.heart) */
const HEART = String.fromCharCode(1);

export interface HamsterState {
  /** named (it lives in the cage); until then F at the cage asks for a name */
  named: boolean;
  name: string;
  coat: number;
  points: number;
  fedDay: number;
  pettedDay: number;
  /** the seed it ate last: its stash is of these */
  seed: string | null;
  /** out in its ball, rolling about the farmhouse */
  ball: boolean;
  // the rest is live, not saved
  mode: 'sleep' | 'wheel' | 'nibble' | 'idle' | 'potter';
  t: number;
  /** what it walks over to do, how long, and where (cage pixels) */
  next: HamsterState['mode'];
  nextT: number;
  tcx: number;
  /** in the cage: its feet, in pixels from the cage's left */
  cx: number;
  /** in its ball: farmhouse tile coords */
  x: number;
  y: number;
  tx: number;
  ty: number;
  rolling: boolean;
  dir: number;
  moving: boolean;
  walkT: number;
  emote: string | null;
  emoteT: number;
  windT: number;
  /** spring-arm keys its wheel turned today */
  wound: number;
}

/** its own dice (never the world's: see the header) */
function hamRng(g: Game): Rng {
  return (g.sys.hamRng ??= new Rng((g.seed ^ 0x4a3b57e) >>> 0)) as Rng;
}

export function hamsterSys(g: Game): HamsterState {
  return (g.sys.hamster ??= {
    named: false, name: DEFAULT_HAMSTER_NAMES[0], coat: 0, points: 0, fedDay: -1, pettedDay: -1, seed: null, ball: false,
    mode: 'sleep', t: 2, next: 'sleep', nextT: 0, tcx: BED_X, cx: BED_X, x: 0, y: 0, tx: 0, ty: 0, rolling: false,
    dir: 1, moving: false, walkT: 0, emote: null, emoteT: 0, windT: 0, wound: 0,
  } as HamsterState);
}

export const hamsterHearts = (h: HamsterState) => Math.min(5, Math.floor(h.points / 200));

/** the cage it lives in: the first one placed (a second is an empty cage) */
export function cageOf(g: Game): Decor | null {
  return g.sys.house ? decorList(g).find((d) => d.id === CAGE) ?? null : null;
}

/** awake by its clock: dusk till you sleep */
export const awake = (g: Game) => g.time.min >= DUSK;

/** a fed hamster with a heart keeps the arms near its cage wound while it runs */
export const winds = (g: Game, h: HamsterState) => h.named && !h.ball && h.fedDay === g.dayIndex && hamsterHearts(h) >= WHEEL_HEARTS;

/** the hamster's ball at (x, y) in the farmhouse */
export function hamsterBallAt(g: Game, x: number, y: number): HamsterState | null {
  const h = g.sys.hamster as HamsterState | undefined;
  if (!h?.ball || g.player.where !== 'house') return null;
  return Math.abs(h.x - x) < 0.7 && Math.abs(h.y - 0.3 - y) < 0.7 ? h : null;
}

function setEmote(h: HamsterState, e: string, t = 1.6) {
  h.emote = e;
  h.emoteT = t;
}

/** where it is, in farmhouse tile coords (for the fx) */
function spot(g: Game, h: HamsterState): [number, number] {
  const c = cageOf(g);
  return h.ball || !c ? [h.x, h.y - 0.6] : [c.x + h.cx / 16, c.y + 0.2];
}

/** sit up for a moment where it is (a scratch, its supper), then on with its night or its nap */
function perk(h: HamsterState, t: number) {
  h.mode = 'nibble';
  h.t = t;
  h.moving = false;
}

export function nameHamster(g: Game, name: string, coat: number) {
  const h = hamsterSys(g);
  h.named = true;
  h.coat = Math.max(0, Math.min(3, coat | 0));
  h.name = name.trim().slice(0, 14) || DEFAULT_HAMSTER_NAMES[h.coat];
  h.points = 60;
  setEmote(h, 'heart', 2.5);
  g.flags.add('hamster');
  g.toast(`${h.name} has moved in! A seed for supper and a scratch each day. It sleeps by day and runs its wheel at night.`, undefined, C.rose);
  g.emit({ t: 'sfx', id: 'squeak' });
  g.emit({ t: 'sfx', id: 'quest' });
  g.count('hamster');
}

/** F with a seed in hand: its supper, once a day (true when F was the seed, or the "full" note) */
function feed(g: Game, h: HamsterState): boolean {
  const held = g.player.inv.slots[g.player.sel];
  if (!held || kDef(held.k).cat !== 'seed') return false;
  if (h.fedDay === g.dayIndex) {
    g.toast(`${h.name}'s cheeks are already full. Tomorrow!`);
    return true;
  }
  const d = kDef(held.k);
  g.player.inv.remove(held.k, 1);
  h.fedDay = g.dayIndex;
  h.seed = d.id;
  h.points = Math.min(1000, h.points + FEED_POINTS);
  if (!h.ball) perk(h, 4);
  setEmote(h, 'heart', 2.2);
  const [x, y] = spot(g, h);
  g.emit({ t: 'sfx', id: 'squeak' });
  g.emit({ t: 'fx', kind: 'hearts', x, y });
  g.toast(`${h.name} stuffs the ${d.name.toLowerCase()} into its cheeks${awake(g) || h.ball ? '' : ', then burrows back into the shavings'}.`);
  g.count('hamster_fed');
  return true;
}

function scratch(g: Game, h: HamsterState) {
  if (h.pettedDay !== g.dayIndex) {
    h.pettedDay = g.dayIndex;
    h.points = Math.min(1000, h.points + PET_POINTS);
  }
  const sleepy = !awake(g) && !h.ball;
  if (!h.ball) perk(h, sleepy ? 2.5 : 2);
  setEmote(h, 'heart');
  const [x, y] = spot(g, h);
  g.emit({ t: 'sfx', id: 'squeak' });
  g.emit({ t: 'fx', kind: 'hearts', x, y });
  const hh = hamsterHearts(h);
  g.toast(h.ball ? `You nudge ${h.name}'s ball. Off it rolls, legs going like a mill.`
    : sleepy ? `${h.name} blinks awake, sniffs your finger and burrows back into the shavings.`
    : hh >= 3 ? `${h.name} climbs onto your hand and washes its whiskers.`
    : hh >= 1 ? `${h.name} sniffs your finger and lets you stroke its back.`
    : `${h.name} sniffs your finger, not sure of you yet.`);
}

/** F at the hamster (the cage it lives in, or its ball): its supper with a seed in hand, else a scratch */
export function hamsterUse(g: Game) {
  const h = hamsterSys(g);
  if (!h.named) {
    g.emit({ t: 'ui', open: 'hamster' });
    return;
  }
  if (!feed(g, h)) scratch(g, h);
}

/** a free spot on the farmhouse floor for the ball */
function open(g: Game, x: number, y: number): boolean {
  const m = houseMap(g);
  const tx = Math.floor(x), ty = Math.floor(y);
  if (ty < 2 || ty >= HOUSE_DOOR[1] || !m.walkable(tx, ty) || decorSolid(g, tx, ty)) return false;
  const e = g.houseEnts.at(tx, ty);
  return !(e && !e.ghost && e.def.solid);
}

/** Shift+F at the cage or the ball: out in its ball, or back in the cage */
export function toggleBall(g: Game): boolean {
  const h = g.sys.hamster as HamsterState | undefined;
  const c = cageOf(g);
  if (!h?.named || !c) return false;
  if (h.ball) {
    h.ball = false;
    h.rolling = false;
    h.cx = BED_X + 4;
    perk(h, 1.5);
    g.emit({ t: 'sfx', id: 'squeak' });
    g.toast(`${h.name} is back in the cage.`);
    return true;
  }
  const at = [[c.x + 0.5, c.y + 1.6], [c.x + 1.5, c.y + 1.6], [c.x - 0.5, c.y + 0.6], [c.x + 2.5, c.y + 0.6], [c.x + 1, c.y + 2.6]].find(([x, y]) => open(g, x, y));
  if (!at) {
    g.toast(`There's no room by the cage for ${h.name}'s ball.`);
    return true;
  }
  h.ball = true;
  [h.x, h.y] = at;
  h.rolling = false;
  h.t = 0.4;
  h.moving = false;
  setEmote(h, '!', 1.2);
  g.emit({ t: 'sfx', id: 'squeak' });
  g.toast(`${h.name} pops into the ball and rolls off to explore. Shift+F at the ball or the cage puts it back.`);
  g.count('hamster_ball');
  return true;
}

/** does Shift+F at this farmhouse tile let the hamster out or put it back (its ball, or the cage it lives in)? */
export function ballToggleAt(g: Game, tx: number, ty: number): boolean {
  if (g.player.where !== 'house' || !(g.sys.hamster as HamsterState | undefined)?.named) return false;
  const c = cageOf(g);
  return (!!c && tx >= c.x && tx < c.x + 2 && ty === c.y) || !!hamsterBallAt(g, tx + 0.5, ty + 0.5);
}

/** its wheel turns the keys of the spring arms near the cage that have run down (one look a second) */
function windNear(g: Game, h: HamsterState, c: Decor, dt: number, fx: boolean) {
  h.windT -= dt;
  if (h.windT > 0) return;
  h.windT = 1;
  const cx = c.x + 1, cy = c.y + 0.5;
  for (const e of g.houseEnts.arms) {
    if (e.ghost || !isSpringArm(e) || isRusted(e) || e.st.wind > 0) continue;
    if (Math.hypot(e.x + 0.5 - cx, e.y + 0.5 - cy) > WHEEL_REACH) continue;
    e.st.wind = WIND_TIME;
    h.wound++;
    g.count('hamster_wound');
    if (fx && g.player.where === 'house') g.emit({ t: 'fx', kind: 'wind', x: e.x + 0.5, y: e.y + 0.3 });
  }
}

/** what it does next in the cage: by day, back to bed; by night mostly the wheel */
function choose(g: Game, h: HamsterState, rng: Rng) {
  const go = (m: HamsterState['mode'], x: number, t: number) => {
    h.next = m;
    h.nextT = t;
    h.tcx = x;
    h.mode = 'potter';
  };
  if (!awake(g)) return go('sleep', BED_X, 20 + rng.next() * 20);
  const r = rng.next();
  if (r < 0.65) go('wheel', WHEEL_X, 8 + rng.next() * 14);
  else if (r < 0.85) go('nibble', DISH_X, 3 + rng.next() * 3);
  else go('idle', 7 + rng.next() * 5, 1.5 + rng.next() * 2);
}

function roll(g: Game, h: HamsterState, dt: number, rng: Rng) {
  if (h.rolling) {
    const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
    h.t -= dt;
    if (d > 0.1 && h.t > 0) {
      const s = Math.min(d, BALL_SPEED * dt);
      const nx = h.x + (dx / d) * s, ny = h.y + (dy / d) * s;
      if (open(g, nx, ny)) {
        h.x = nx;
        h.y = ny;
        h.walkT += s;
        h.moving = true;
        if (Math.abs(dx) > 0.05) h.dir = dx < 0 ? 3 : 1;
        return;
      }
      // bonk
      if (rng.next() < 0.3) setEmote(h, '!', 0.8);
    }
    h.rolling = false;
    h.moving = false;
    h.t = 0.5 + rng.next() * 1.5;
    return;
  }
  h.moving = false;
  if ((h.t -= dt) > 0) return;
  const p = g.player;
  for (let i = 0; i < 8; i++) {
    // now and then over to you, else anywhere close
    const toYou = p.where === 'house' && rng.next() < 0.35;
    const x = toYou ? p.x + (rng.next() - 0.5) * 2 : h.x + (rng.next() - 0.5) * 7;
    const y = toYou ? p.y + 0.6 + (rng.next() - 0.5) : h.y + (rng.next() - 0.5) * 5;
    if (!open(g, x, y)) continue;
    h.tx = x;
    h.ty = y;
    h.rolling = true;
    h.t = 6;
    return;
  }
  h.t = 1;
}

function tickHamster(g: Game, dt: number) {
  const h = g.sys.hamster as HamsterState | undefined;
  if (!h?.named) return;
  const c = cageOf(g);
  if (!c) {
    h.ball = false;
    return;
  }
  if (g.nightShift) {
    // it runs all night while you sleep (and rolls home first)
    h.ball = false;
    h.mode = 'wheel';
    h.cx = WHEEL_X;
    if (winds(g, h)) windNear(g, h, c, dt, false);
    return;
  }
  if (h.emoteT > 0 && (h.emoteT -= dt) <= 0) h.emote = null;
  const rng = hamRng(g);
  if (h.ball) {
    // it rolls about only while you're in to see it
    if (g.player.where === 'house') roll(g, h, dt, rng);
    return;
  }
  if (h.mode === 'wheel' && winds(g, h)) windNear(g, h, c, dt, true);
  if (h.mode === 'potter') {
    const d = h.tcx - h.cx;
    if (Math.abs(d) > 0.5) {
      h.cx += Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
      h.dir = d < 0 ? 3 : 1;
      h.moving = true;
      h.walkT += dt * 1.6;
      return;
    }
    h.moving = false;
    h.mode = h.next;
    h.t = h.nextT;
    if (h.mode === 'wheel') h.dir = 1;
  }
  h.t -= dt;
  if (h.t > 0) return;
  choose(g, h, rng);
}

// ---------------- the cage, as the farmhouse's furniture sees it ----------------
function cageHover(g: Game, d: Decor): { text: string; color?: number }[] {
  const h = g.sys.hamster as HamsterState | undefined;
  if (!h?.named) return [{ text: 'Hamster Cage', color: C.amber }, { text: 'F: welcome its hamster (a name and a coat)', color: C.pebble }, { text: 'Shift+right-click to pick up', color: C.pebble }];
  if (d !== cageOf(g)) return [{ text: 'Hamster Cage', color: C.amber }, { text: `An empty cage: ${h.name} lives in the other one`, color: C.pebble }, { text: 'Right-click to pick up', color: C.pebble }];
  const hh = hamsterHearts(h);
  const fed = h.fedDay === g.dayIndex;
  return [
    { text: h.name, color: C.amber },
    { text: `Your hamster (${HAMSTER_COATS[h.coat].toLowerCase()})  ` + HEART.repeat(hh) + '.'.repeat(5 - hh), color: C.rose },
    { text: h.ball ? 'Out in its ball' : h.mode === 'wheel' ? 'Running its wheel' : awake(g) ? 'Up and about' : 'Asleep in its shavings: it wakes at dusk', color: C.butter },
    { text: fed ? 'Had its seed today' : 'Hold a seed and press F: its supper, once a day', color: fed ? C.moss : C.pebble },
    { text: h.pettedDay === g.dayIndex ? 'Petted today' : 'F or right-click for a scratch', color: C.pebble },
    { text: hh < WHEEL_HEARTS ? 'From a heart, its wheel winds the spring arms by the cage' : fed ? `Its wheel winds the spring arms within ${WHEEL_REACH} tiles while it runs` : 'Fed, its wheel winds the spring arms by the cage', color: hh >= WHEEL_HEARTS && fed ? C.moss : C.pebble },
    ...(hh >= 3 ? [{ text: 'Now and then saves you some of its seeds', color: C.moss }] : []),
    { text: h.ball ? 'Shift+F: back in the cage' : 'Shift+F: out in its ball', color: C.pebble },
    { text: 'Shift+right-click to pick up the cage', color: C.pebble },
  ];
}

DECOR_USE.set(CAGE, {
  use(g, d) {
    const h = hamsterSys(g);
    // a second cage is just a cage (F picks it up as any furniture)
    if (h.named && d !== cageOf(g)) return false;
    hamsterUse(g);
    return true;
  },
  hover: cageHover,
  prompt(g, d) {
    const h = g.sys.hamster as HamsterState | undefined;
    if (!h?.named) return { verb: 'Name your hamster' };
    if (d !== cageOf(g)) return null;
    const held = g.player.inv.slots[g.player.sel];
    const hint = h.ball ? 'Shift+F: back in the cage' : 'Shift+F: the ball';
    if (held && kDef(held.k).cat === 'seed' && h.fedDay !== g.dayIndex) return { verb: `Feed ${h.name}`, hint };
    return h.pettedDay === g.dayIndex ? null : { verb: `Pet ${h.name}`, hint };
  },
  placed(g) {
    if (!(g.sys.hamster as HamsterState | undefined)?.named) g.emit({ t: 'ui', open: 'hamster' });
  },
  lifted(g, d) {
    const h = g.sys.hamster as HamsterState | undefined;
    if (h && d === cageOf(g)) h.ball = false;
  },
});

registerSystem({
  name: 'hamster',
  // its wheel runs through the night shift (src/sim/Game.ts runWorks)
  works: true,
  tick: tickHamster,
  dayEnd(g) {
    const h = g.sys.hamster as HamsterState | undefined;
    if (!h?.named || !cageOf(g)) return;
    if (h.fedDay === g.dayIndex) h.points = Math.min(1000, h.points + 6);
    else if (h.pettedDay !== g.dayIndex) h.points = Math.max(0, h.points - 4);
  },
  dayStart(g) {
    const h = g.sys.hamster as HamsterState | undefined;
    if (!h?.named) return;
    h.ball = false;
    h.rolling = false;
    h.mode = 'sleep';
    h.cx = BED_X;
    h.t = 10;
    h.wound = 0;
    const c = cageOf(g);
    const hh = hamsterHearts(h);
    // its cheek pouches: a few of yesterday's seeds, saved for you
    if (c && h.seed && hh >= 3 && h.fedDay === g.dayIndex - 1) {
      const rng = hamRng(g);
      if (rng.next() < 0.2 + hh * 0.05) {
        const n = rng.int(1, 3);
        g.sys.drops?.spawn?.(g, key(h.seed), n, c.x + 1, c.y + 1.4, false, 'house');
        g.toast(`${h.name} saved you ${n} ${kDef(key(h.seed)).name} from its cheek pouches: they're by the cage.`, undefined, C.amber);
      }
    }
  },
  save(g) {
    const h = g.sys.hamster as HamsterState | undefined;
    if (!h?.named) return null;
    return { name: h.name, coat: h.coat, points: h.points, fedDay: h.fedDay, pettedDay: h.pettedDay, seed: h.seed };
  },
  load(g, d) {
    if (!d) return;
    Object.assign(hamsterSys(g), d, { named: true, ball: false, mode: 'sleep', cx: BED_X, t: 2 });
  },
});

