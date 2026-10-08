// Arms (inserters): pick from the tile behind, swing, drop on the tile in front.
import type { Game } from '../Game';
import { ArmState, DX, DY, Ent } from '../ents';
import { ItemKey, kStack } from '../inventory';
import { portAccept, portInsert, portTake } from '../ports';

export function armTiles(e: Ent) {
  const a = e.arm!;
  return {
    px: e.x - DX[e.rot] * a.reach,
    py: e.y - DY[e.rot] * a.reach,
    dx: e.x + DX[e.rot] * a.reach,
    dy: e.y + DY[e.rot] * a.reach,
  };
}

export function updateArms(g: Game, dt: number) {
  const clock = g.hasPerk('clockmaker');
  const ents = g.ents;
  const handBonus = g.mods.armHand;
  for (let i = 0; i < ents.arms.length; i++) {
    const e = ents.arms[i];
    const a = e.arm!;
    let mul = 1;
    if (a.powered) {
      mul = e.sat;
      if (mul <= 0.001) {
        e.working = a.state !== ArmState.Idle;
        continue;
      }
    }
    const step = dt * a.speed * 2 * mul * (clock ? 1.15 : 1);
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
          break;
        }
        const filt = a.filter;
        const want = (k: ItemKey) => (filt.length === 0 || filt.includes(k) || filt.includes(k & ~3)) && portAccept(g, dst, k, e.rot) > 0;
        const cap = a.hand + handBonus;
        // never grab more than the destination can hold right now
        const got = portTake(g, src, want, (k) => (dst.belt ? 1 : Math.max(1, Math.min(cap, portAccept(g, dst, k, e.rot)))));
        if (got) {
          a.held = got;
          a.state = ArmState.ToDrop;
          e.working = true;
        } else a.wait = 0.2;
        break;
      }
      case ArmState.ToDrop:
        e.working = true;
        a.t += step;
        if (a.t >= 1) {
          a.t = 1;
          a.state = ArmState.Dropping;
        }
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
          break;
        }
        const n = portInsert(g, dst, a.held.k, a.held.n, e.rot);
        a.held.n -= n;
        if (a.held.n <= 0) {
          a.held = null;
          a.state = ArmState.ToPick;
        } else a.wait = 0.1;
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
