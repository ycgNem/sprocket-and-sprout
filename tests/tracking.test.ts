// Tracked orders (DECISIONS #164): Track on an order puts its checklist under the Now strip. Up to
// MAX_TRACKED at once; a filled or gone order drops off; the list survives a save.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { serialize, deserialize } from '../src/sim/save';
import { MAX_TRACKED, isTracked, orders, toggleTrack, trackedOrders, type Order } from '../src/sim/systems/orders';

const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };

function addOrders(g: Game, n: number): Order[] {
  const os = orders(g);
  const out: Order[] = [];
  for (let i = 0; i < n; i++) {
    const o: Order = { uid: os.uid++, kind: 'today', def: `req:juniper:wood${i}`, cust: 'juniper', lines: [{ spec: 'wood', n: 5 + i, have: 0 }], day: g.dayIndex, due: g.dayIndex, pay: 100, rep: 1 };
    os.open.push(o);
    out.push(o);
  }
  return out;
}

describe('tracked orders', () => {
  it('Track toggles an order, up to the limit', () => {
    const g = new Game({ seed: 3 });
    const list = addOrders(g, MAX_TRACKED + 1);
    for (const o of list.slice(0, MAX_TRACKED)) expect(toggleTrack(g, o)).toBe(true);
    expect(trackedOrders(g).map((o) => o.uid)).toEqual(list.slice(0, MAX_TRACKED).map((o) => o.uid));
    // one too many: refused, the list unchanged
    expect(toggleTrack(g, list[MAX_TRACKED])).toBe(false);
    expect(isTracked(g, list[MAX_TRACKED])).toBe(false);
    // untrack one, then the last fits
    expect(toggleTrack(g, list[0])).toBe(true);
    expect(isTracked(g, list[0])).toBe(false);
    expect(toggleTrack(g, list[MAX_TRACKED])).toBe(true);
    expect(trackedOrders(g)).toHaveLength(MAX_TRACKED);
  });

  it('a filled order, or one gone from the board, drops off the list', () => {
    const g = new Game({ seed: 3 });
    const [a, b, c] = addOrders(g, 3);
    for (const o of [a, b, c]) toggleTrack(g, o);
    a.done = true;
    const os = orders(g);
    os.open = os.open.filter((o) => o !== b);
    expect(trackedOrders(g).map((o) => o.uid)).toEqual([c.uid]);
    expect(os.tracked).toEqual([c.uid]);
  });

  it('the tracked list survives a save and load', () => {
    const g = new Game({ seed: 3 });
    const [a, b] = addOrders(g, 2);
    toggleTrack(g, b);
    toggleTrack(g, a);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(trackedOrders(g2).map((o) => o.uid)).toEqual([b.uid, a.uid]);
  });
});
