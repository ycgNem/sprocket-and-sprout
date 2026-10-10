// The works' specialists' Trust rewards (src/data/trust.ts, src/sim/systems/trust.ts; the critic's
// Phase 5 review: "Trust is hearts with new labels"): letters at their levels and what each does,
// Pip's watch, the soups gone to the villagers who cook, Mags' Tuesday in a shortage week and
// Hazel's asks waiting for Dyes & Pastes.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game } from '../src/sim/Game';
import { REQUEST_POOL } from '../src/data/goals';
import { RECIPE_TEACHERS } from '../src/data/cookbook';
import { SHOP_BY_ID } from '../src/data/shops';
import { AT_COST, CATALOGUE, INDEXED_LIB, TRADE_PRICE, TRUST_REWARDS, WOODEN_MACHINES } from '../src/data/trust';
import { place } from '../src/sim/build';
import { libMax, LIB_MAX } from '../src/sim/drafting';
import { key } from '../src/sim/inventory';
import { npcSys, POINTS_PER_HEART } from '../src/sim/systems/npcs';
import { entryPrice } from '../src/sim/systems/economy';
import { cartDay, cartHere } from '../src/sim/systems/cart';
import { askNow } from '../src/sim/systems/orders';
import { deskSpeed } from '../src/sim/systems/research';
import { PIP_WAIT } from '../src/sim/systems/trust';

const SIX = ['juniper', 'bram', 'sable', 'thorne', 'hazel', 'pip'];

function nextDay(g: Game) {
  g.time.min = DAY_END - 0.001;
  g.tick();
}
const letters = (g: Game) => [...g.sys.goals.mail, ...(g.sys.goals.queue ?? [])] as { id: string; from: string; title: string }[];
const ticks = (g: Game, secs: number) => {
  for (let i = 0; i < secs * 60; i++) g.tick();
};

describe("the specialists' Trust rewards", () => {
  it('are works things, one letter each the morning after the level, never twice', () => {
    expect(TRUST_REWARDS.map((r) => r.npc).sort()).toEqual(['bram', 'hazel', 'juniper', 'pip', 'sable']);
    const g = new Game({ seed: 51 });
    const at = (lvl: (t: number) => number) => {
      for (const r of TRUST_REWARDS) {
        const n = npcSys(g).byId.get(r.npc)!;
        n.met = true;
        // (a little over: a day without a talk costs a couple of points)
        n.points = lvl(r.trust) * POINTS_PER_HEART + 20;
      }
    };
    at((t) => t - 1);
    nextDay(g);
    for (const r of TRUST_REWARDS) expect(g.flags.has('trust:' + r.id), r.id).toBe(false);
    at((t) => t);
    nextDay(g);
    for (const r of TRUST_REWARDS) {
      expect(g.flags.has('trust:' + r.id), r.id).toBe(true);
      const mine = letters(g).filter((l) => l.id === 'trust_' + r.id);
      expect(mine.length, r.id).toBe(1);
      expect(mine[0].from).toBe(r.npc);
      expect(mine[0].title).toContain(r.title);
    }
    nextDay(g);
    for (const r of TRUST_REWARDS) expect(letters(g).filter((l) => l.id === 'trust_' + r.id).length).toBe(1);
  });

  it("Juniper's trade price, Bram's furnace at cost, Hazel's index and Sable's catalogue", () => {
    const g = new Game({ seed: 52 });
    const joinery = SHOP_BY_ID.get('carpenter')!.stock;
    const wooden = joinery.filter((e) => WOODEN_MACHINES.has(e.item));
    expect(wooden.map((e) => e.item).sort()).toEqual([...WOODEN_MACHINES].sort());
    const before = wooden.map((e) => entryPrice(g, e));
    const plank = joinery.find((e) => e.item === 'plank')!;
    const plank0 = entryPrice(g, plank);
    g.flags.add('trust:juniper_trade');
    wooden.forEach((e, i) => expect(entryPrice(g, e), e.item).toBe(Math.round(before[i] * TRADE_PRICE)));
    // timber isn't a machine: the market's price
    expect(entryPrice(g, plank)).toBe(plank0);
    const furnace = SHOP_BY_ID.get('smithy')!.stock.find((e) => e.item === 'blast_furnace')!;
    expect(entryPrice(g, furnace)).toBe(6500);
    g.flags.add('trust:bram_cost');
    expect(entryPrice(g, furnace)).toBe(Math.round(6500 * AT_COST));
    expect(TRUST_REWARDS.find((r) => r.id === 'bram_cost')!.name).toContain((6500 * AT_COST).toLocaleString('en-US'));
    // Hazel: the drafting library holds 24
    expect(libMax(g)).toBe(LIB_MAX);
    g.flags.add('trust:hazel_index');
    expect(libMax(g)).toBe(INDEXED_LIB);
    // Sable: a desk studies 15% faster
    const t = new Game({ seed: 53, blank: { w: 12, h: 12 } });
    const desk = place(t, 'lab', 2, 2, 0);
    const s0 = deskSpeed(t, desk);
    t.flags.add('trust:sable_catalogue');
    expect(deskSpeed(t, desk)).toBeCloseTo(s0 * CATALOGUE);
    expect(CATALOGUE).toBeCloseTo(1.15);
  });
});

describe("Pip's watch", () => {
  it('a machine stopped a minute brings Pip running with which and why, once a stop', () => {
    const g = new Game({ seed: 54, blank: { w: 16, h: 16 } });
    g.player.x = 14.5;
    g.player.y = 14.5;
    const crock = place(g, 'jar', 4, 4, 0);
    // its goods have nowhere to go
    crock.mach!.outBuf.push({ k: key('pickles_cogbean'), n: 60 });
    const told = () => g.events.filter((e: any) => e.t === 'toast' && /^Pip:/.test(e.text)) as { text: string }[];
    ticks(g, PIP_WAIT + 5);
    expect(told().length).toBe(0);
    g.flags.add('trust:pip_watch');
    g.events.length = 0;
    ticks(g, 3);
    // the minute counts from when it stopped, so Pip's already late
    expect(told().length).toBe(1);
    expect(told()[0].text).toMatch(/preserving crock stopped! Output full/i);
    g.events.length = 0;
    ticks(g, PIP_WAIT + 5);
    expect(told().length).toBe(0);
    // emptied, then full again: a new stop, told again a minute later
    crock.mach!.outBuf.length = 0;
    ticks(g, 2);
    crock.mach!.outBuf.push({ k: key('pickles_cogbean'), n: 60 });
    g.events.length = 0;
    ticks(g, PIP_WAIT - 10);
    expect(told().length).toBe(0);
    ticks(g, 15);
    expect(told().length).toBe(1);
  });
});

describe('the soups went to the cooks', () => {
  it('no works specialist teaches a recipe; every teacher is a villager', () => {
    for (const [id, t] of Object.entries(RECIPE_TEACHERS)) expect(SIX.includes(t.npc), `${id}: ${t.npc}`).toBe(false);
    for (const t of Object.values(RECIPE_TEACHERS)) expect(npcSys(new Game({ seed: 1 })).byId.has(t.npc), t.npc).toBe(true);
  });
});

describe("Mags in a shortage week", () => {
  it('comes on the Tuesday too, so the goods are bought before Friday', () => {
    const g = new Game({ seed: 55 });
    // a Tuesday: no cart, unless a business ran short this week
    while (g.weekday !== 1) nextDay(g);
    g.time.min = 12 * 60;
    expect(cartDay(g)).toBe(false);
    g.sys.orders.short = { week: Math.floor(g.dayIndex / 7), cust: 'rowan', spec: 'pickles_cogbean', n: 12 };
    expect(cartDay(g)).toBe(true);
    g.player.where = 'world';
    if (!g.sys.festivals?.today?.(g)) expect(cartHere(g)).toBe(true);
    // last week's shortage doesn't bring her
    g.sys.orders.short.week -= 1;
    expect(cartDay(g)).toBe(false);
  });
});

describe("Hazel's asks", () => {
  it('ask for paste and pigment only once Dyes & Pastes is known; before, for what they are made from', () => {
    const g = new Game({ seed: 56 });
    const later = REQUEST_POOL.filter((r) => r.after);
    expect(later.map((r) => r.item).sort()).toEqual(['pigment', 'starch_paste']);
    for (const r of later) {
      expect(g.unlocked(r.after)).toBe(false);
      const now = askNow(g, r);
      expect(now.item).toBe(r.before!.item);
      expect(now.text).toBe(r.before!.text);
      expect(now.npc).toBe('hazel');
    }
    g.research.done.add('r_pastes');
    for (const r of later) expect(askNow(g, r).item).toBe(r.item);
  });
});
