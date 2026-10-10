// Generic item ports: how arms (and bots) insert into / take from any structure.
import type { Game } from './Game';
import { Dir, Ent } from './ents';
import { ItemKey, kDef, kId, kStack, Stack } from './inventory';
import { beltCanInsertFromSide, beltInsertFromSide, beltTake } from './systems/belts';
import { fuelValue, machAccept, machInsert, machTake, machUses } from './systems/machines';

type Pred = (k: ItemKey) => boolean;
export type MaxFn = number | ((k: ItemKey) => number);
const mx = (m: MaxFn, k: ItemKey) => (typeof m === "number" ? m : m(k));

/** Optional hooks registered by later systems (labs, buildings, megaprojects ...). */
export interface PortHandler {
  accept?: (g: Game, e: Ent, k: ItemKey) => number;
  /** does it take k at all, given room? (false = the wrong item for it); without it a refusal reads as full */
  uses?: (g: Game, e: Ent, k: ItemKey) => boolean;
  insert?: (g: Game, e: Ent, k: ItemKey, n: number) => number;
  take?: (g: Game, e: Ent, pred: Pred, max: MaxFn) => Stack | null;
}
export const PORT_HANDLERS: Record<string, PortHandler> = {};

/** How many of k can `e` accept from an arm facing `dir` (towards e). */
export function portAccept(g: Game, e: Ent, k: ItemKey, dir: Dir): number {
  if (e.ghost || e.st.rust) return 0;
  const h = PORT_HANDLERS[e.def.kind];
  if (h?.accept) return h.accept(g, e, k);
  if (e.belt) return beltCanInsertFromSide(e, dir) ? 1 : 0;
  if (e.mach) return machAccept(g, e, k);
  switch (e.def.kind) {
    case 'chest':
      if (e.def.id === 'crate_req' || e.def.id === 'crate_out' || e.def.id === 'crate_store') return e.inv!.space(k);
      return e.inv!.space(k);
    case 'shipbin':
      return kDef(k).price > 0 ? e.inv!.space(k) : 0;
    case 'generator':
      if (e.def.fuel && fuelValue(k) > 0 && (!e.gen!.fuel || e.gen!.fuel.k === k)) return 20 - (e.gen!.fuel?.n ?? 0);
      return 0;
    case 'drill':
      if (e.def.fuel && fuelValue(k) > 0 && (!e.st.fuel || e.st.fuel.k === k)) return 20 - (e.st.fuel?.n ?? 0);
      return 0;
  }
  return 0;
}

/**
 * Does `e` take k at all when it has room? false means the wrong item (a jar offered stone), which
 * the arms and belts name instead of calling the taker full (ROADMAP.md 4.2).
 */
export function portUses(g: Game, e: Ent, k: ItemKey): boolean {
  const h = PORT_HANDLERS[e.def.kind];
  if (h?.uses) return h.uses(g, e, k);
  if (h?.accept) return true;
  if (e.belt) return true;
  if (e.mach) return machUses(g, e, k);
  switch (e.def.kind) {
    case 'chest':
      return true;
    case 'shipbin':
      return kDef(k).price > 0;
    case 'generator':
    case 'drill':
      return !!e.def.fuel && fuelValue(k) > 0;
  }
  return false;
}

export function portInsert(g: Game, e: Ent, k: ItemKey, n: number, dir: Dir): number {
  const got = portInsertRaw(g, e, k, n, dir);
  // what arrives counts toward its rate (the Lines tab, the inspector); belts count at their ends
  if (got > 0 && !e.belt) g.stats.states.received(e, got);
  return got;
}

function portInsertRaw(g: Game, e: Ent, k: ItemKey, n: number, dir: Dir): number {
  if (e.ghost || e.st.rust || n <= 0) return 0;
  const h = PORT_HANDLERS[e.def.kind];
  if (h?.insert) return h.insert(g, e, k, n);
  if (e.belt) return beltInsertFromSide(e, k, dir) ? 1 : 0;
  if (e.mach) return machInsert(g, e, k, n);
  switch (e.def.kind) {
    case 'chest':
    case 'shipbin': {
      const can = Math.min(n, portAccept(g, e, k, dir));
      if (can <= 0) return 0;
      e.inv!.add(k, can);
      return can;
    }
    case 'generator': {
      const can = Math.min(n, portAccept(g, e, k, dir));
      if (can <= 0) return 0;
      if (!e.gen!.fuel) e.gen!.fuel = { k, n: 0 };
      e.gen!.fuel.n += can;
      return can;
    }
    case 'drill': {
      const can = Math.min(n, portAccept(g, e, k, dir));
      if (can <= 0) return 0;
      if (!e.st.fuel) e.st.fuel = { k, n: 0 };
      e.st.fuel.n += can;
      return can;
    }
  }
  return 0;
}

export function portTake(g: Game, e: Ent, pred: Pred, max: MaxFn): Stack | null {
  if (e.ghost || e.st.rust) return null;
  const h = PORT_HANDLERS[e.def.kind];
  if (h?.take) return h.take(g, e, pred, max);
  if (e.belt) {
    const k = beltTake(e, pred);
    return k === null ? null : { k, n: 1 };
  }
  if (e.mach) return machTake(e, pred, max);
  if (e.inv && e.def.kind !== 'shipbin') return invTake(e, pred, max);
  return null;
}

export function invTake(e: Ent, pred: Pred, max: MaxFn): Stack | null {
  const inv = e.inv!;
  for (let i = inv.slots.length - 1; i >= 0; i--) {
    const s = inv.slots[i];
    if (!s || !pred(s.k)) continue;
    const n = Math.min(mx(max, s.k), s.n);
    if (n <= 0) continue;
    s.n -= n;
    if (s.n <= 0) inv.slots[i] = null;
    return { k: s.k, n };
  }
  return null;
}

/** What an entity could currently provide (for arm previews / bots). */
export function portPeek(e: Ent): ItemKey[] {
  if (e.belt) return [...e.belt.lanes[0].k, ...e.belt.lanes[1].k];
  if (e.mach) return e.mach.outBuf.map((s) => s.k);
  if (e.inv) return e.inv.slots.filter((s) => s).map((s) => s!.k);
  return [];
}

export { kId, kStack };
