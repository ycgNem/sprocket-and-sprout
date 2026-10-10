// Arms (inserters): pick from the tile behind, swing, drop on the tile in front.
// Each arm reports its state (src/sim/mstate.ts): Starved when there is nothing behind it to
// take, Blocked when what it holds (or could take) has nowhere to go in front.
import type { Game } from '../Game';
import { ArmState, DX, DY, Ent } from '../ents';
import { ItemKey, kDef, kStack } from '../inventory';
import { isBusy, MState, offText, setHarvestWait, setQueued, setRefused, setState } from '../mstate';
import { rustTick } from '../rust';
import { lesson } from '../lessons';
import { FIELD_KINDS, fieldSource, harvestWaitText } from '../lines';
import { portAccept, portInsert, portPeek, portTake, portUses } from '../ports';

/** seconds of overwind from one turn of the key (F on a spring arm) */
export const WIND_TIME = 30;
/** how much faster a wound arm swings */
export const WIND_MUL = 2;

export function armTiles(e: Ent) {
  const a = e.arm!;
  return {
    px: e.x - DX[e.rot] * a.reach,
    py: e.y - DY[e.rot] * a.reach,
    dx: e.x + DX[e.rot] * a.reach,
    dy: e.y + DY[e.rot] * a.reach,
  };
}

/** spring arms (no power) can be wound by hand */
export function isSpringArm(e: Ent): boolean {
  return !!e.arm && !e.arm.powered;
}

/** what the winding verb works on: spring arms and gleaners */
export function isWindable(e: Ent): boolean {
  return isSpringArm(e) || e.def.kind === 'gleaner';
}

/**
 * The winding verb (ROADMAP.md 4.2): F on a spring arm gives it WIND_TIME seconds at WIND_MUL
 * speed. A juice verb, not a chore: arms never stop for lack of winding.
 */
export function windArm(g: Game, e: Ent): boolean {
  if (!isWindable(e)) return false;
  e.st.wind = WIND_TIME;
  lesson(g, 'wind');
  g.emit({ t: 'sfx', id: 'ratchet', x: e.x, y: e.y });
  g.emit({ t: 'fx', kind: 'wind', x: e.x + 0.5, y: e.y + 0.3 });
  g.count('arms_wound');
  return true;
}

const nameOf = (e: Ent | null) => (e ? e.def.name.toLowerCase() : 'nothing');

export function updateArms(g: Game, dt: number) {
  const clock = g.hasPerk('clockmaker');
  const ents = g.ents;
  const handBonus = g.mods.armHand;
  const now = g.simTime;
  for (let i = 0; i < ents.arms.length; i++) {
    const e = ents.arms[i];
    const a = e.arm!;
    if (rustTick(e, now)) continue;
    let mul = 1;
    if (a.powered) {
      if (e.off) {
        e.working = false;
        setState(e, MState.Idle, offText(e), now);
        continue;
      }
      mul = e.sat;
      if (mul <= 0.001) {
        e.working = a.state !== ArmState.Idle;
        setState(e, MState.Unpowered, e.net ? 'Not enough power' : 'No power: place a pole nearby', now);
        continue;
      }
    }
    if (e.st.wind > 0) {
      e.st.wind = Math.max(0, e.st.wind - dt);
      mul *= WIND_MUL;
    }
    const step = dt * a.speed * 2 * mul * (clock ? 1.15 : 1);
    // a powered arm crawling on a starved grid says so, whatever it's doing
    const weak = a.powered && e.sat < 0.25;
    switch (a.state) {
      case ArmState.Idle: {
        e.working = false;
        if (a.wait > 0) {
          a.wait -= dt;
          break;
        }
        const t = armTiles(e);
        const src = ents.rootAt(t.px, t.py);
        const dst = ents.rootAt(t.dx, t.dy);
        if (!src || !dst || src === dst) {
          a.wait = 0.5;
          if (!src && !dst) setState(e, MState.Idle, 'Nothing behind or in front', now);
          else if (!src) setState(e, MState.Starved, 'Nothing behind it to pick up from', now);
          else setState(e, MState.Blocked, 'Nothing in front to drop onto', now);
          break;
        }
        const filt = a.filter;
        // stock limit: only top a container up to `limit` of each item
        const room = (k: ItemKey) => (a.limit > 0 && dst.inv && !dst.belt && !dst.mach ? a.limit - dst.inv.count(k) : Infinity);
        const want = (k: ItemKey) => (filt.length === 0 || filt.includes(k) || filt.includes(k & ~3)) && room(k) > 0 && portAccept(g, dst, k, e.rot) > 0;
        const cap = a.hand + handBonus;
        // never grab more than the destination can hold right now
        const got = portTake(g, src, want, (k) => (dst.belt ? 1 : Math.max(1, Math.min(cap, room(k), portAccept(g, dst, k, e.rot)))));
        if (got) {
          a.held = got;
          e.lastK = got.k;
          a.state = ArmState.ToDrop;
          e.working = true;
          setState(e, weak ? MState.Unpowered : MState.Working, weak ? 'Crawling: the grid is short of power' : '', now);
        } else {
          a.wait = 0.2;
          // something there but nowhere to put it: a queue if what's in front is busy (or the
          // player's stock limit is met), else blocked. Nothing there: waiting on a busy machine
          // or a field is healthy; anything else is starved (ROADMAP.md 4.2)
          const avail = portPeek(src).filter((k) => filt.length === 0 || filt.includes(k) || filt.includes(k & ~3));
          if (avail.length) {
            const full = a.limit > 0 && avail.every((k) => room(k) <= 0);
            // only items the taker can't use at all: the wrong input, named; else it's full
            const usable = avail.some((k) => portUses(g, dst, k));
            if (full) setState(e, MState.Working, `Queued: stock limit reached in the ${nameOf(dst)}`, now);
            else if (!usable) setRefused(e, dst, avail[0], kDef(avail[0]).name.toLowerCase(), now);
            else if (isBusy(dst)) setQueued(e, dst, now);
            else setState(e, MState.Blocked, `The ${nameOf(dst)} is full`, now);
          } else if (src.mach && isBusy(src)) setState(e, MState.Idle, `Waiting for the ${nameOf(src)} to finish`, now);
          else if ((e.state !== MState.Starved && !e.fieldWait) || now - (e.whyAt ?? -1) >= 0.5) {
            // the reason is worked out on entering the state and every half second after that
            e.whyAt = now;
            const field = FIELD_KINDS.has(src.def.kind) ? src : fieldSource(g, src);
            if (field) setHarvestWait(e, harvestWaitText(field), now);
            else setState(e, MState.Starved, `Waiting: the ${nameOf(src)} has nothing to take`, now);
          }
        }
        break;
      }
      case ArmState.ToDrop:
        e.working = true;
        a.t += step;
        if (a.t >= 1) {
          a.t = 1;
          a.state = ArmState.Dropping;
        }
        setState(e, weak ? MState.Unpowered : MState.Working, weak ? 'Crawling: the grid is short of power' : '', now);
        break;
      case ArmState.Dropping: {
        e.working = true;
        if (a.wait > 0) {
          a.wait -= dt;
          break;
        }
        const t = armTiles(e);
        const dst = ents.rootAt(t.dx, t.dy);
        if (!dst || !a.held) {
          // destination vanished: keep holding until something appears
          a.wait = 0.5;
          if (!a.held) a.state = ArmState.ToPick;
          else setState(e, MState.Blocked, 'Holding an item with nothing in front', now);
          break;
        }
        const n = portInsert(g, dst, a.held.k, a.held.n, e.rot);
        // goods an arm drops in the shipping crate show what they'll fetch: automation = coins
        if (n > 0 && dst.def.kind === 'shipbin') {
          g.emit({ t: 'crated', k: a.held.k, n, x: dst.x + 0.5, y: dst.y - 0.1, ent: dst.id });
          g.sys.quests?.notify?.(g, 'crate', n, kDef(a.held.k).id, { auto: true });
        } else if (n > 0 && dst.mach) g.sys.quests?.notify?.(g, 'armload', n, dst.def.id);
        if (n > 0) {
          g.stats.states.moved(e, n);
          lesson(g, 'arm');
        }
        a.held.n -= n;
        if (a.held.n <= 0) {
          a.held = null;
          a.state = ArmState.ToPick;
        } else {
          a.wait = 0.1;
          if (n === 0) {
            if (!portUses(g, dst, a.held.k)) setRefused(e, dst, a.held.k, kDef(a.held.k).name.toLowerCase(), now);
            else if (isBusy(dst)) setQueued(e, dst, now);
            else setState(e, MState.Blocked, `The ${nameOf(dst)} is full`, now);
          }
        }
        break;
      }
      case ArmState.ToPick:
        e.working = true;
        a.t -= step;
        if (a.t <= 0) {
          a.t = 0;
          a.state = ArmState.Idle;
        }
        break;
    }
  }
}

/** Throughput estimate for tooltips: items per minute. */
export function armRate(e: Ent, handBonus: number): number {
  const a = e.arm!;
  return a.speed * 60 * (a.hand + handBonus);
}

export { kStack };
