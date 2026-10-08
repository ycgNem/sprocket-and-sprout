// Items lying on the ground that pop out, bounce, and get vacuumed toward the player.
import { Game, registerSystem } from '../Game';

export interface Drop {
  k: number;
  n: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  map: 'world' | 'mine' | 'house';
}

export function dropsState(g: Game): { list: Drop[]; spawn: typeof spawnDrop } {
  if (!g.sys.drops) g.sys.drops = { list: [], spawn: spawnDrop };
  return g.sys.drops;
}

export function spawnDrop(g: Game, k: number, n: number, x: number, y: number, pop = true) {
  const s = dropsState(g);
  const a = g.rng.next() * Math.PI * 2;
  const sp = pop ? 1.2 + g.rng.next() * 1.5 : 0;
  s.list.push({ k, n, x, y, z: pop ? 0.2 : 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: pop ? 3 + g.rng.next() * 2 : 0, t: 0, map: g.player.where });
}

registerSystem({
  name: 'drops',
  tick(g, dt) {
    const s = g.sys.drops as { list: Drop[] } | undefined;
    if (!s || !s.list.length) return;
    const p = g.player;
    for (let i = s.list.length - 1; i >= 0; i--) {
      const d = s.list[i];
      d.t += dt;
      if (d.map !== p.where) continue;
      // bounce
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 18 * dt;
        d.z += d.vz * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.z <= 0) {
          d.z = 0;
          d.vz = Math.abs(d.vz) > 1.5 ? -d.vz * 0.35 : 0;
          d.vx *= 0.5;
          d.vy *= 0.5;
        }
      }
      if (d.t < 0.45) continue;
      const dx = p.x - d.x, dy = p.y - 0.3 - d.y;
      const dist = Math.hypot(dx, dy);
      const magnet = 2.2;
      if (dist < magnet && p.inv.space(d.k) > 0) {
        const sp = 6 + (magnet - dist) * 8;
        d.x += (dx / Math.max(dist, 0.01)) * sp * dt;
        d.y += (dy / Math.max(dist, 0.01)) * sp * dt;
        if (dist < 0.35) {
          const left = p.inv.add(d.k, d.n);
          const got = d.n - left;
          if (got > 0) {
            g.stats.add(d.k, got);
            g.emit({ t: 'pickup', k: d.k, n: got, x: p.x, y: p.y - 1 });
            g.emit({ t: 'sfx', id: 'pickup' });
            g.sys.collections?.found?.(g, d.k);
          }
          if (left <= 0) s.list.splice(i, 1);
          else d.n = left;
        }
      }
      // very old drops despawn after a long time (items left in the mines)
      if (d.t > 600 && d.map === 'mine') s.list.splice(i, 1);
    }
  },
  dayStart(g) {
    const s = dropsState(g);
    s.list = s.list.filter((d) => d.map === 'world');
  },
});
