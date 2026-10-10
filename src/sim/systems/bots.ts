// Bumblebots: clockwork bees living in hives. They fly items from Outbox/Storage crates to
// Request crates within range, and build blueprint ghosts using crate stock.
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { key, Stack } from '../inventory';
import { afterPlace } from '../build';
import { applyBlueprintSettings } from '../blueprint';

export interface Bot {
  id: number;
  hive: number;
  x: number;
  y: number;
  phase: 'toSrc' | 'toDst' | 'home';
  src: number;
  dst: number;
  k: number;
  n: number;
  carry: Stack | null;
  ghost: boolean;
}

export function botSys(g: Game): { list: Bot[]; next: number; reserved: Map<string, number>; cd: number } {
  if (!g.sys.bots) g.sys.bots = { list: [], next: 1, reserved: new Map(), cd: 0 };
  return g.sys.bots;
}

function hives(g: Game) {
  return g.ents.consumers.filter((e) => e.def.kind === 'hive' && !e.ghost);
}

function inRange(h: Ent, e: Ent) {
  const r = h.def.reach ?? 14;
  return Math.abs(e.x + e.w / 2 - (h.x + 1)) <= r && Math.abs(e.y + e.h / 2 - (h.y + 1)) <= r;
}

function crates(g: Game, h: Ent, id: string) {
  return g.ents.others.filter((e) => e.def.id === id && !e.ghost && inRange(h, e));
}

function incomingKey(dst: number, k: number) {
  return dst + ':' + k;
}

function findSource(g: Game, h: Ent, k: number, exclude = -1): Ent | null {
  for (const id of ['crate_out', 'crate_store']) {
    for (const c of crates(g, h, id)) if (c.id !== exclude && c.inv!.count(k) > 0) return c;
  }
  return null;
}

function assign(g: Game, h: Ent) {
  const s = botSys(g);
  const flying = s.list.filter((b) => b.hive === h.id).length;
  const idle = h.st.bots ?? 0;
  if (idle <= 0) return;
  void flying;
  // 1) construction ghosts
  for (const e of g.ents.all()) {
    if (!e.ghost || e.parent || !inRange(h, e) || e.st.botClaimed) continue;
    const k = key(e.def.item);
    const src = findSource(g, h, k);
    if (!src) continue;
    e.st.botClaimed = true;
    launch(g, h, src, e, k, 1, true);
    return;
  }
  // 2) requests
  for (const req of crates(g, h, 'crate_req')) {
    for (const r of (req.st.requests ?? []) as Stack[]) {
      const have = req.inv!.count(r.k);
      const inc = s.reserved.get(incomingKey(req.id, r.k)) ?? 0;
      const want = r.n - have - inc;
      if (want <= 0) continue;
      const src = findSource(g, h, r.k, req.id);
      if (!src) continue;
      const n = Math.min(want, 4 + Math.floor(g.mods.droneCount / 2), src.inv!.count(r.k));
      launch(g, h, src, req, r.k, n, false);
      return;
    }
  }
  // 3) tidy: outbox items nobody asked for go to storage when the outbox is getting full
  for (const out of crates(g, h, 'crate_out')) {
    const used = out.inv!.slots.filter(Boolean).length;
    if (used < out.inv!.size * 0.75) continue;
    const st = out.inv!.slots.find(Boolean)!;
    const store = crates(g, h, 'crate_store').find((c) => c.inv!.space(st.k) > 0);
    if (!store) continue;
    launch(g, h, out, store, st.k, Math.min(4, st.n), false);
    return;
  }
}

function launch(g: Game, h: Ent, src: Ent, dst: Ent, k: number, n: number, ghost: boolean) {
  const s = botSys(g);
  h.st.bots--;
  s.list.push({ id: s.next++, hive: h.id, x: h.x + 1, y: h.y + 0.5, phase: 'toSrc', src: src.id, dst: dst.id, k, n, carry: null, ghost });
  if (!ghost) s.reserved.set(incomingKey(dst.id, k), (s.reserved.get(incomingKey(dst.id, k)) ?? 0) + n);
}

function flyTo(b: Bot, tx: number, ty: number, sp: number): boolean {
  const dx = tx - b.x, dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  if (d <= sp) {
    b.x = tx;
    b.y = ty;
    return true;
  }
  b.x += (dx / d) * sp;
  b.y += (dy / d) * sp;
  return false;
}

function finish(g: Game, b: Bot) {
  const s = botSys(g);
  if (!b.ghost) {
    const kk = incomingKey(b.dst, b.k);
    s.reserved.set(kk, Math.max(0, (s.reserved.get(kk) ?? 0) - b.n));
  }
}

registerSystem({
  name: 'bots',
  works: true,
  tick(g, dt) {
    const s = g.sys.bots as ReturnType<typeof botSys> | undefined;
    const hs = hives(g);
    if (!hs.length && !s?.list.length) return;
    const sys = botSys(g);
    for (const h of hs) h.working = (h.st.bots ?? 0) > 0 || sys.list.some((b) => b.hive === h.id);
    sys.cd -= dt;
    if (sys.cd <= 0) {
      sys.cd = 0.25;
      for (const h of hs) assign(g, h);
    }
    for (let i = sys.list.length - 1; i >= 0; i--) {
      const b = sys.list[i];
      const hive = g.ents.get(b.hive);
      if (!hive) {
        sys.list.splice(i, 1);
        continue;
      }
      const powered = hive.sat >= 0.5 ? 1 : 0.35;
      const sp = 5 * g.mods.droneSpeed * powered * dt;
      if (b.phase === 'toSrc') {
        const src = g.ents.get(b.src);
        if (!src) { b.phase = 'home'; finish(g, b); continue; }
        if (flyTo(b, src.x + 0.5, src.y + 0.3, sp)) {
          const got = src.inv!.remove(b.k, b.n);
          if (!got) { b.phase = 'home'; finish(g, b); if (b.ghost) { const gh = g.ents.get(b.dst); if (gh) gh.st.botClaimed = false; } continue; }
          b.carry = { k: b.k, n: got };
          b.phase = 'toDst';
        }
      } else if (b.phase === 'toDst') {
        const dst = g.ents.get(b.dst);
        if (!dst) {
          // destination vanished: return the items to the source
          const src = g.ents.get(b.src);
          if (src && b.carry) src.inv!.add(b.carry.k, b.carry.n);
          b.carry = null;
          b.phase = 'home';
          finish(g, b);
          continue;
        }
        if (flyTo(b, dst.x + dst.w / 2, dst.y + 0.3, sp)) {
          if (b.ghost) {
            if (dst.ghost) {
              g.ents.materialize(dst);
              afterPlace(g, dst);
              applyBlueprintSettings(g, dst);
              delete dst.st.botClaimed;
              g.stats.use(b.k, 1);
            } else {
              const src = g.ents.get(b.src);
              src?.inv!.add(b.k, 1);
            }
          } else if (b.carry) {
            const left = dst.inv!.add(b.carry.k, b.carry.n);
            if (left) g.ents.get(b.src)?.inv!.add(b.carry.k, left);
          }
          b.carry = null;
          b.phase = 'home';
          finish(g, b);
        }
      } else if (flyTo(b, hive.x + 1, hive.y + 0.5, sp)) {
        hive.st.bots = (hive.st.bots ?? 0) + 1;
        sys.list.splice(i, 1);
      }
    }
  },
  dayEnd(g) {
    // bots sleep in their hives overnight
    const sys = botSys(g);
    for (const b of sys.list) {
      const h = g.ents.get(b.hive);
      if (h) h.st.bots = (h.st.bots ?? 0) + 1;
      if (b.carry) g.ents.get(b.src)?.inv!.add(b.carry.k, b.carry.n);
    }
    sys.list = [];
    sys.reserved.clear();
    for (const e of g.ents.all()) if (e.ghost) delete e.st.botClaimed;
  },
});
