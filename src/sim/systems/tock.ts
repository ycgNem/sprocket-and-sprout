// Tock (ROADMAP.md Phase 5, the stretch): a knee-high clockwork automaton the Professor sends once
// the Tram runs. It walks the farm at your heels on the pet's steering (src/sim/systems/pet.ts) and
// turns the key of every spring arm and gleaner it passes that has run down: the winding verb, done
// for you while you work. Indoors, down the Deepworks and at night it waits by the farmhouse door.
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { isRusted } from '../rust';
import { isWindable, WIND_TIME } from './arms';
import { send } from './goals';

export interface TockState {
  here: boolean;
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  walkT: number;
  mode: 'wait' | 'follow' | 'wind' | 'sit';
  /** the arm or gleaner it's walking over to wind (entity id) */
  target: number;
  t: number;
  /** seconds until it looks round for another run-down key */
  look: number;
  /** keys turned today, and ever */
  today: number;
  wound: number;
}

/** tiles round Tock it notices a run-down arm in, and how close it gets to turn the key */
export const TOCK_SEES = 5;
const REACH = 1.4;

export function tockSys(g: Game): TockState {
  if (!g.sys.tock) {
    g.sys.tock = { here: false, x: 0, y: 0, dir: 1, moving: false, walkT: 0, mode: 'wait', target: 0, t: 0, look: 0, today: 0, wound: 0 } as TockState;
  }
  return g.sys.tock;
}

/** where Tock waits: on the step by the farmhouse door */
function doorSpot(g: Game): [number, number] {
  const [dx, dy] = g.map.locs.get('farmhouse') ?? [g.player.x, g.player.y];
  return [dx + 1.6, dy + 1.5];
}

function free(g: Game, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (!g.map.walkable(tx, ty)) return false;
  const e = g.ents.at(tx, ty);
  return !(e && !e.ghost && e.def.solid);
}

/** the pet's step: toward a point, sliding along what's in the way; true when it's there (or stuck) */
function step(g: Game, k: TockState, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
  if (d < 0.15) {
    k.moving = false;
    return true;
  }
  const s = Math.min(d, speed * dt);
  const nx = k.x + (dx / d) * s, ny = k.y + (dy / d) * s;
  let moved = false;
  if (free(g, nx, ny)) { k.x = nx; k.y = ny; moved = true; }
  else if (free(g, nx, k.y)) { k.x = nx; moved = true; }
  else if (free(g, k.x, ny)) { k.y = ny; moved = true; }
  k.moving = moved;
  if (moved) {
    k.walkT += dt * speed;
    if (Math.abs(dx) > 0.05) k.dir = dx < 0 ? 3 : 1;
  }
  return !moved;
}

const runDown = (e: Ent) => !e.ghost && isWindable(e) && !isRusted(e) && !(e.st.wind > 0);

/** the nearest run-down spring arm or gleaner Tock can see */
function nearestKey(g: Game, k: TockState): Ent | null {
  let best: Ent | null = null, bd = TOCK_SEES;
  const r = Math.ceil(TOCK_SEES);
  for (let y = Math.floor(k.y) - r; y <= Math.floor(k.y) + r; y++)
    for (let x = Math.floor(k.x) - r; x <= Math.floor(k.x) + r; x++) {
      const e = g.ents.rootAt(x, y);
      if (!e || !runDown(e)) continue;
      const d = Math.hypot(e.x + e.w / 2 - k.x, e.y + e.h / 2 - k.y);
      if (d < bd) { bd = d; best = e; }
    }
  return best;
}

/** a turn of the key, as F gives (but Tock's turns are its own count, not yours) */
function windIt(g: Game, k: TockState, e: Ent) {
  e.st.wind = WIND_TIME;
  k.today++;
  k.wound++;
  g.count('tock_wound');
  k.dir = e.x + e.w / 2 < k.x ? 3 : 1;
  g.emit({ t: 'sfx', id: 'ratchet', x: e.x, y: e.y });
  g.emit({ t: 'fx', kind: 'wind', x: e.x + 0.5, y: e.y + 0.3 });
}

function tickTock(g: Game, dt: number) {
  const k = g.sys.tock as TockState | undefined;
  if (!k?.here || g.map.w < 100) return;
  const pl = g.player;
  const night = g.time.min >= 22 * 60;
  // indoors, down the Deepworks and at night: it waits on the step by the door
  if (pl.where !== 'world' || night) {
    const [sx, sy] = doorSpot(g);
    if (Math.hypot(k.x - sx, k.y - sy) > 12) { k.x = sx; k.y = sy; }
    if (step(g, k, sx, sy, 3, dt)) k.mode = 'wait';
    return;
  }
  k.look -= dt;
  if (k.mode !== 'wind' && k.look <= 0) {
    k.look = 0.5;
    const e = nearestKey(g, k);
    if (e) {
      k.mode = 'wind';
      k.target = e.id;
      k.t = 6;
    }
  }
  const dist = Math.hypot(pl.x - k.x, pl.y - k.y);
  switch (k.mode) {
    case 'wind': {
      const e = g.ents.get(k.target);
      k.t -= dt;
      if (!e || !runDown(e) || k.t <= 0) { k.mode = 'follow'; break; }
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (Math.hypot(cx - k.x, cy - k.y) <= REACH) {
        windIt(g, k, e);
        k.mode = 'follow';
        k.moving = false;
        k.look = 0.8;
        break;
      }
      // up beside it: the side toward Tock
      step(g, k, cx + Math.sign(k.x - cx || 1) * 0.9, cy + 0.3, 4, dt);
      break;
    }
    case 'sit':
      k.moving = false;
      if (dist > 3) k.mode = 'follow';
      break;
    default: {
      if (dist > 20) {
        // left far behind (a ride on the Tram, a long run): it catches up
        k.x = pl.x - 1;
        k.y = pl.y + 0.5;
      }
      if (dist < 2) { k.mode = 'sit'; k.moving = false; break; }
      k.mode = 'follow';
      step(g, k, pl.x - Math.sign(pl.x - k.x) * 1.3, pl.y + 0.5, dist > 6 ? 6.5 : 4.5, dt);
    }
  }
}

/** Tock under a point (for F and the hover), or null */
export function tockAt(g: Game, x: number, y: number): TockState | null {
  const k = g.sys.tock as TockState | undefined;
  if (!k?.here || g.player.where !== 'world') return null;
  return Math.abs(k.x - x) < 0.7 && Math.abs(k.y - 0.4 - y) < 0.8 ? k : null;
}

export function tockInteract(g: Game, k: TockState) {
  k.mode = 'sit';
  k.dir = g.player.x < k.x ? 3 : 1;
  g.emit({ t: 'sfx', id: 'ratchet', x: k.x, y: k.y });
  g.toast(k.today ? `Tock ticks proudly. ${k.today} key${k.today > 1 ? 's' : ''} turned today.` : 'Tock whirrs and looks about for a spring arm that has run down.');
}

registerSystem({
  name: 'tock',
  tick: tickTock,
  dayStart(g) {
    if (g.map.w < 100) return;
    const k = tockSys(g);
    k.today = 0;
    if (!k.here && g.flags.has('tram')) {
      // the Professor's gift, the morning after the Tram's first run
      k.here = true;
      send(g, 'tock', {
        from: 'ottoline', title: 'Tock',
        text: "My dear farmer! The Tram runs, and the quarry road sings with it! I had parts left over (I always have parts left over), so I built you a friend: Tock. It's knee-high, it has a mainspring for a heart, and it will follow you about your works and turn the key of any spring arm or gleaner it finds run down. It's waiting at your door. Say hello!\n- Professor Ottoline Cogwhistle",
      });
    }
    if (k.here) {
      [k.x, k.y] = doorSpot(g);
      k.mode = 'wait';
    }
  },
  save(g) {
    const k = g.sys.tock as TockState | undefined;
    return k?.here ? { here: true, wound: k.wound } : null;
  },
  load(g, d) {
    if (!d?.here) return;
    const k = tockSys(g);
    k.here = true;
    k.wound = d.wound ?? 0;
    [k.x, k.y] = doorSpot(g);
  },
});
