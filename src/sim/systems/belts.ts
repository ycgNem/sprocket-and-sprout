// Belt simulation: two lanes per tile, items keep a minimum spacing and hand off
// to the next segment. Processed downstream-first so queues compress cleanly.
import { BeltC, BeltKind, DX, DY, Dir, Ent, Ents, ITEM_SPACING, Lane, leftOf, opposite } from '../ents';

/** Recompute next pointers, curves, underground pairing lengths and update order. */
export function rebuildBelts(ents: Ents) {
  for (const e of ents.belts) {
    const b = e.belt!;
    b.next = null;
    b.nextMode = 0;
    b.curve = 0;
    b.len = 1;
  }
  // underground pairing lengths
  for (const e of ents.belts) {
    const b = e.belt!;
    if (b.kind === BeltKind.UnderIn && b.partner) {
      const p = b.partner;
      b.len = Math.max(1, Math.abs(p.x - e.x) + Math.abs(p.y - e.y));
      b.next = p;
      b.nextMode = 1;
    }
  }
  for (const e of ents.belts) {
    const b = e.belt!;
    if (b.kind === BeltKind.UnderIn) continue;
    const t = ents.at(e.x + DX[e.rot], e.y + DY[e.rot]);
    const mode = feedMode(ents, e, t);
    if (mode) {
      b.next = t;
      b.nextMode = mode;
    }
  }
  // curves: a belt with exactly one side feeder and no straight feeder
  for (const e of ents.belts) {
    const b = e.belt!;
    if (b.kind !== BeltKind.Belt) continue;
    const back = ents.at(e.x - DX[e.rot], e.y - DY[e.rot]);
    const straightFeed = !!(back && back.belt && back.belt.next === e && back.belt.nextMode === 1 && back.rot === e.rot);
    if (straightFeed) continue;
    const L = leftOf(e.rot);
    const lf = ents.at(e.x + DX[L], e.y + DY[L]);
    const rf = ents.at(e.x - DX[L], e.y - DY[L]);
    const fromL = !!(lf && lf.belt && lf.belt.next === e && lf.rot === opposite(L));
    const fromR = !!(rf && rf.belt && rf.belt.next === e && rf.rot === L);
    if (fromL !== fromR) {
      b.curve = fromL ? 1 : 2;
      const feeder = fromL ? lf! : rf!;
      feeder.belt!.nextMode = 1; // curves preserve lanes
    }
  }
  // downstream-first order (DFS post-order following next pointers)
  const order: Ent[] = [];
  const seen = new Set<number>();
  const visit = (start: Ent) => {
    const stack: [Ent, number][] = [[start, 0]];
    seen.add(start.id);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [e, state] = top;
      if (state === 0) {
        top[1] = 1;
        const outs = nextsOf(e);
        for (const n of outs) {
          if (!seen.has(n.id)) {
            seen.add(n.id);
            stack.push([n, 0]);
          }
        }
      } else {
        stack.pop();
        order.push(e);
      }
    }
  };
  for (const e of ents.belts) if (!seen.has(e.id)) visit(e);
  ents.beltOrder = order;
  ents.beltsDirty = false;
}

function nextsOf(e: Ent): Ent[] {
  const b = e.belt!;
  const out: Ent[] = [];
  if (b.next) out.push(b.next);
  if (b.kind === BeltKind.Splitter && b.partner?.belt?.next) out.push(b.partner.belt.next);
  return out;
}

/** How a belt `e` feeds into target `t` (0 = no connection). */
export function feedMode(ents: Ents, e: Ent, t: Ent | null): number {
  if (!t || !t.belt || t.ghost) return 0;
  const d = e.rot, td = t.rot;
  const tb = t.belt;
  if (tb.kind === BeltKind.UnderOut) return 0;
  if (tb.kind === BeltKind.UnderIn || tb.kind === BeltKind.Splitter) return td === d ? 1 : 0;
  if (td === d) return 1;
  if (td === opposite(d)) return 0;
  // perpendicular: side-load into the near lane
  const L = leftOf(td);
  const ox = e.x - t.x, oy = e.y - t.y;
  return ox === DX[L] && oy === DY[L] ? 2 : 3;
}

/** Try to put an item onto a lane at position `pos`. */
export function laneInsert(b: BeltC, lane: number, k: number, pos: number): boolean {
  const L = b.lanes[lane];
  const n = L.k.length;
  pos = Math.max(0, Math.min(pos, b.len));
  // find first index with p < pos
  let i = 0;
  while (i < n && L.p[i] >= pos) i++;
  if (i > 0 && L.p[i - 1] - pos < ITEM_SPACING - 1e-6) return false;
  if (i < n && pos - L.p[i] < ITEM_SPACING - 1e-6) return false;
  L.k.splice(i, 0, k);
  L.p.splice(i, 0, pos);
  return true;
}

export function laneCanInsert(b: BeltC, lane: number, pos: number): boolean {
  const L = b.lanes[lane];
  const n = L.k.length;
  let i = 0;
  while (i < n && L.p[i] >= pos) i++;
  if (i > 0 && L.p[i - 1] - pos < ITEM_SPACING - 1e-6) return false;
  if (i < n && pos - L.p[i] < ITEM_SPACING - 1e-6) return false;
  return true;
}

function transferOut(e: Ent, lane: number, k: number, overflow: number): boolean {
  const b = e.belt!;
  if (b.kind === BeltKind.Splitter) {
    // alternation is shared by both halves, per lane
    const root = e.parent ?? e;
    const tog = root.belt!.toggle;
    const outs = [root.belt!.next, root.child?.belt?.next ?? null];
    const pref = tog[lane];
    for (const attempt of [pref, 1 - pref]) {
      const c = outs[attempt];
      if (!c) continue;
      if (laneInsert(c.belt!, lane, k, Math.min(overflow, 0.2))) {
        tog[lane] = 1 - attempt;
        return true;
      }
    }
    return false;
  }
  const t = b.next;
  if (!t) return false;
  const tb = t.belt!;
  switch (b.nextMode) {
    case 1:
      return laneInsert(tb, lane, k, Math.min(overflow, 0.2));
    case 2:
      return laneInsert(tb, 0, k, 0.5);
    case 3:
      return laneInsert(tb, 1, k, 0.5);
  }
  return false;
}

/** Advance all belts by dt seconds. Returns number of item moves (for perf stats). */
export function updateBelts(ents: Ents, dt: number) {
  if (ents.beltsDirty) rebuildBelts(ents);
  const order = ents.beltOrder;
  for (let oi = 0; oi < order.length; oi++) {
    const e = order[oi];
    const b = e.belt;
    if (!b) continue;
    const adv = b.speed * dt;
    for (let li = 0; li < 2; li++) {
      const L = b.lanes[li];
      if (L.k.length === 0) continue;
      advanceLane(e, b, L, li, adv);
    }
  }
}

function advanceLane(e: Ent, b: BeltC, L: Lane, li: number, adv: number) {
  const len = b.len;
  // keep spacing across the tile boundary with the next lane's last item
  let cap = len;
  if (b.nextMode === 1 && b.next && b.kind !== BeltKind.Splitter) {
    const NL = b.next.belt!.lanes[li];
    const n = NL.p.length;
    if (n) cap = Math.min(len, len + NL.p[n - 1] - ITEM_SPACING);
  }
  const old = L.p[0];
  const np = old + adv;
  if (np >= len && transferOut(e, li, L.k[0], np - len)) {
    L.k.shift();
    L.p.shift();
    if (L.k.length === 0) return;
    // the new front stays at least one spacing behind the item that just left
    L.p[0] = Math.min(L.p[0] + adv, len, np - ITEM_SPACING);
  } else {
    L.p[0] = Math.max(old, Math.min(np, cap));
  }
  for (let i = 1; i < L.k.length; i++) {
    const lim = L.p[i - 1] - ITEM_SPACING;
    const p = L.p[i] + adv;
    L.p[i] = p < lim ? p : lim > L.p[i] ? lim : L.p[i];
  }
}

/** Remove and return the front-most item matching pred (arms picking up). */
export function beltTake(e: Ent, pred: (k: number) => boolean): number | null {
  const b = e.belt!;
  let best = -1, bestLane = -1, bestP = -1;
  for (let li = 0; li < 2; li++) {
    const L = b.lanes[li];
    for (let i = 0; i < L.k.length; i++) {
      if (L.p[i] > 1.0001 && b.kind === BeltKind.UnderIn) continue; // hidden in tunnel
      if (L.p[i] > bestP && pred(L.k[i])) {
        best = i;
        bestLane = li;
        bestP = L.p[i];
        break;
      }
    }
  }
  if (best < 0) return null;
  const L = b.lanes[bestLane];
  const k = L.k[best];
  L.k.splice(best, 1);
  L.p.splice(best, 1);
  return k;
}

/** Arm drop: Factorio-style onto the far lane, mid-tile. `armDir` = direction arm faces (towards belt). */
export function beltInsertFromSide(e: Ent, k: number, armDir: Dir): boolean {
  const b = e.belt!;
  // arm sits at e - armDir; if that is the belt's left side the far lane is lane 1
  const L = leftOf(e.rot);
  const ax = -DX[armDir], ay = -DY[armDir];
  let lane = 1;
  if (ax === -DX[L] && ay === -DY[L]) lane = 0;
  if (ax === DX[L] && ay === DY[L]) lane = 1;
  if (laneInsert(b, lane, k, 0.5)) return true;
  return false;
}

export function beltCanInsertFromSide(e: Ent, armDir: Dir): boolean {
  const b = e.belt!;
  const L = leftOf(e.rot);
  const ax = -DX[armDir], ay = -DY[armDir];
  let lane = 1;
  if (ax === -DX[L] && ay === -DY[L]) lane = 0;
  return laneCanInsert(b, lane, 0.5);
}

export function beltItemCount(e: Ent): number {
  return e.belt ? e.belt.lanes[0].k.length + e.belt.lanes[1].k.length : 0;
}

/** World position (tile units) of an item on a belt lane. */
export function itemPos(e: Ent, lane: number, p: number, out: { x: number; y: number }) {
  const b = e.belt!;
  const t = Math.min(1, p / b.len);
  let lx: number, ly: number;
  if (b.curve === 0 || b.len !== 1) {
    const off = lane === 0 ? 0.28 : 0.72;
    lx = off;
    ly = 1 - (b.kind === BeltKind.UnderIn ? Math.min(p, 0.5) : t);
  } else if (b.curve === 1) {
    const r = lane === 0 ? 0.28 : 0.72;
    const th = (1 - t) * Math.PI * 0.5;
    lx = r * Math.cos(th);
    ly = r * Math.sin(th);
  } else {
    const r = lane === 0 ? 0.72 : 0.28;
    const th = Math.PI * 0.5 + t * Math.PI * 0.5;
    lx = 1 + r * Math.cos(th);
    ly = r * Math.sin(th);
  }
  // rotate local frame (heading north) by e.rot quarter turns clockwise
  for (let r = 0; r < e.rot; r++) {
    const nx = 1 - ly;
    ly = lx;
    lx = nx;
  }
  out.x = e.x + lx;
  out.y = e.y + ly;
}
