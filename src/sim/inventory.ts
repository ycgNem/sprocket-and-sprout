// Item keys and inventories. An item key packs item index + quality: key = idx * 4 + q.
import { ITEMS, ITEM_INDEX, maxStack, matchesSpec } from '../data/items';
import type { ItemDef } from '../data/types';

export type ItemKey = number;
export const QUALITY_NAMES = ['', 'Silver', 'Gold', 'Star'];
export const QUALITY_MULT = [1, 1.25, 1.5, 2];

export function key(id: string, q = 0): ItemKey {
  const i = ITEM_INDEX.get(id);
  if (i === undefined) throw new Error('unknown item ' + id);
  return i * 4 + q;
}
export function kIdx(k: ItemKey) {
  return k >> 2;
}
export function kQ(k: ItemKey) {
  return k & 3;
}
export function kDef(k: ItemKey): ItemDef {
  return ITEMS[k >> 2];
}
export function kId(k: ItemKey): string {
  return ITEMS[k >> 2].id;
}
export function kStack(k: ItemKey) {
  return maxStack(ITEMS[k >> 2]);
}
export function kMatches(k: ItemKey, spec: string) {
  return matchesSpec(ITEMS[k >> 2], spec);
}

export interface Stack {
  k: ItemKey;
  n: number;
}
export type Slot = Stack | null;

export class Inventory {
  slots: Slot[];
  constructor(size: number) {
    this.slots = new Array(size).fill(null);
  }

  get size() {
    return this.slots.length;
  }

  resize(n: number) {
    while (this.slots.length < n) this.slots.push(null);
  }

  /** How many of key `k` could be added. */
  space(k: ItemKey): number {
    const max = kStack(k);
    let s = 0;
    for (const sl of this.slots) {
      if (!sl) s += max;
      else if (sl.k === k) s += max - sl.n;
    }
    return s;
  }

  /** Add items; returns leftover count that didn't fit. */
  add(k: ItemKey, n: number): number {
    const max = kStack(k);
    for (const sl of this.slots) {
      if (n <= 0) break;
      if (sl && sl.k === k && sl.n < max) {
        const t = Math.min(n, max - sl.n);
        sl.n += t;
        n -= t;
      }
    }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      if (!this.slots[i]) {
        const t = Math.min(n, max);
        this.slots[i] = { k, n: t };
        n -= t;
      }
    }
    return n;
  }

  count(k: ItemKey): number {
    let c = 0;
    for (const sl of this.slots) if (sl && sl.k === k) c += sl.n;
    return c;
  }

  /** Count across all qualities of an item id. */
  countId(id: string): number {
    const idx = ITEM_INDEX.get(id);
    let c = 0;
    for (const sl of this.slots) if (sl && sl.k >> 2 === idx) c += sl.n;
    return c;
  }

  /** Count items matching a spec (id or #tag), any quality. */
  countSpec(spec: string): number {
    if (spec[0] !== '#') return this.countId(spec);
    let c = 0;
    for (const sl of this.slots) if (sl && kMatches(sl.k, spec)) c += sl.n;
    return c;
  }

  remove(k: ItemKey, n: number): number {
    let removed = 0;
    for (let i = this.slots.length - 1; i >= 0 && removed < n; i--) {
      const sl = this.slots[i];
      if (sl && sl.k === k) {
        const t = Math.min(sl.n, n - removed);
        sl.n -= t;
        removed += t;
        if (sl.n <= 0) this.slots[i] = null;
      }
    }
    return removed;
  }

  /** Remove n items matching spec (lowest quality first). Returns keys removed. */
  removeSpec(spec: string, n: number): Stack[] {
    const out: Stack[] = [];
    const idxs = this.slots
      .map((s, i) => [s, i] as const)
      .filter(([s]) => s && (spec[0] === '#' ? kMatches(s.k, spec) : kId(s.k) === spec))
      .sort((a, b) => kQ(a[0]!.k) - kQ(b[0]!.k));
    for (const [sl, i] of idxs) {
      if (n <= 0) break;
      const t = Math.min(sl!.n, n);
      sl!.n -= t;
      n -= t;
      const prev = out.find((o) => o.k === sl!.k);
      if (prev) prev.n += t;
      else out.push({ k: sl!.k, n: t });
      if (sl!.n <= 0) this.slots[i] = null;
    }
    return out;
  }

  firstMatching(pred: (k: ItemKey) => boolean): Slot {
    for (const sl of this.slots) if (sl && pred(sl.k)) return sl;
    return null;
  }

  isEmpty() {
    return this.slots.every((s) => !s);
  }

  /** Merge stacks and sort by category then id. */
  sort() {
    const all = new Map<ItemKey, number>();
    for (const sl of this.slots) if (sl) all.set(sl.k, (all.get(sl.k) ?? 0) + sl.n);
    this.slots.fill(null);
    const keys = [...all.keys()].sort((a, b) => {
      const da = kDef(a), db = kDef(b);
      return da.cat.localeCompare(db.cat) || da.name.localeCompare(db.name) || kQ(a) - kQ(b);
    });
    for (const k of keys) this.add(k, all.get(k)!);
  }

  toJSON(): ([string, number, number] | null)[] {
    return this.slots.map((s) => (s ? [kId(s.k), kQ(s.k), s.n] : null));
  }

  static fromJSON(data: ([string, number, number] | null)[], size?: number): Inventory {
    const inv = new Inventory(size ?? data.length);
    data.forEach((d, i) => {
      if (d && ITEM_INDEX.has(d[0]) && i < inv.slots.length) inv.slots[i] = { k: key(d[0], d[1]), n: d[2] };
    });
    return inv;
  }
}

export function sellPrice(k: ItemKey): number {
  const d = kDef(k);
  return Math.round(d.price * QUALITY_MULT[kQ(k)]);
}

export function itemName(k: ItemKey): string {
  const q = kQ(k);
  return (q ? QUALITY_NAMES[q] + ' ' : '') + kDef(k).name;
}
