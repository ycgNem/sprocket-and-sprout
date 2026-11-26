// The second half's ledger (DECISIONS #178): what every gate from the Town Mill to the megaprojects
// asks for, worked back through the recipes to machine time and raw goods. The pacing bot
// (tests/bot.ts) stops at the Waterworks, so nothing measured Steam to Harbor; this is the
// arithmetic of it, not a player: a gate that needs many times the machine-days or coins of the
// one before it shows here. `npx tsx scripts/latepace.ts`.
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { KEYSTONE_WORKS } from '../src/data/orders';
import { MEGAPROJECTS, PROJECTS } from '../src/data/goals';
import { RESEARCH } from '../src/data/research';
import { EXPORT_PORTS, linesAt } from '../src/data/exports';
import { lineSize } from '../src/sim/systems/exports';
import type { RecipeDef, Stack } from '../src/data/types';

/** real seconds in a game day (src/sim/systems/stats.ts) */
const DAY_SECS = 1200 * 0.7 + 240 * 0.7;

// one recipe per item: a machine's before a hand recipe, the cheapest inputs first
const value = (st: Stack[]) => st.reduce((a, s) => a + (ITEM_BY_ID.get(s.item)?.price ?? 20) * s.n, 0);
const byOut = new Map<string, RecipeDef>();
for (const r of [...RECIPES].sort((a, b) => (a.station === 'hand' ? 1 : 0) - (b.station === 'hand' ? 1 : 0) || value(a.in) - value(b.in)))
  for (const o of r.out) if (!byOut.has(o.item)) byOut.set(o.item, r);

/** a '#tag' spec as the cheapest item that fits it and can be made (else the cheapest of all) */
function resolve(spec: string): string {
  if (spec[0] !== '#') return spec;
  const fits = ITEMS.filter((d) => matchesSpec(d, spec) && d.price > 0).sort((a, b) => a.price - b.price);
  return (fits.find((d) => byOut.has(d.id)) ?? fits[0])?.id ?? spec;
}

const RAW = new Set(['crop', 'fruit', 'veg', 'flower', 'forage', 'resource', 'seed', 'fish', 'mineral', 'gem', 'animal']);

export interface Ledger { secs: Map<string, number>; raw: Map<string, number>; coins: number; value: number }
const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

function expand(L: Ledger, spec: string, n: number, path: string[] = []) {
  const id = resolve(spec);
  const r = byOut.get(id);
  // what grows, is dug or is gathered is a raw good, whatever odd recipe also gives it (a seed maker's)
  const rawCat = RAW.has(ITEM_BY_ID.get(id)?.cat ?? '');
  if (!r || rawCat || path.includes(id) || path.length > 9) {
    add(L.raw, id, n);
    return;
  }
  const outN = r.out.find((o) => o.item === id)?.n ?? 1;
  const batches = Math.ceil(n / outN);
  if (r.station !== 'hand') add(L.secs, r.station, batches * r.time);
  for (const i of r.in) expand(L, i.item, i.n * batches, [...path, id]);
}

export function ledger(items: Stack[], coins = 0): Ledger {
  const L: Ledger = { secs: new Map(), raw: new Map(), coins, value: items.reduce((a, s) => a + (ITEM_BY_ID.get(resolve(s.item))?.price ?? 0) * s.n, 0) };
  for (const s of items) expand(L, s.item, s.n);
  return L;
}

export const machineDays = (L: Ledger) => [...L.secs.values()].reduce((a, b) => a + b, 0) / DAY_SECS;

export interface Gate { name: string; when: string; L: Ledger }

export function gates(): Gate[] {
  const out: Gate[] = [];
  for (const k of KEYSTONE_WORKS) out.push({ name: k.name, when: `era ${k.era} keystone`, L: ledger(k.items) });
  for (const p of PROJECTS) out.push({ name: p.name, when: (p.after ?? []).join(' ') || 'start', L: ledger(p.steady ? p.items.map((i) => ({ item: i.item, n: i.n * p.steady! })) : p.items, p.money ?? 0) });
  for (const m of MEGAPROJECTS) out.push({ name: m.name, when: 'megaproject', L: ledger(m.stages.flatMap((s) => s.items)) });
  // research, an era at a time: every topic's bundles
  for (let era = 1; era <= 5; era++) {
    const cost = new Map<string, number>();
    for (const r of RESEARCH.filter((x) => x.era === era)) for (const c of r.cost) add(cost, c.item, c.n);
    out.push({ name: `All era ${era} research`, when: `era ${era}`, L: ledger([...cost].map(([item, n]) => ({ item, n }))) });
  }
  // a first manifest for each port, a line each
  for (const p of EXPORT_PORTS) {
    // (its slowest three, the worst a manifest can ask)
    const picks = p.wants.filter((id) => ITEM_BY_ID.has(id)).sort((a, b) => machineDays(ledger([{ item: b, n: lineSize(b, 0) }])) - machineDays(ledger([{ item: a, n: lineSize(a, 0) }]))).slice(0, linesAt(0));
    out.push({ name: `${p.name}: first manifest`, when: 'the Harbor', L: ledger(picks.map((id) => ({ item: id, n: lineSize(id, 0) }))) });
  }
  return out;
}

if (process.argv[1]?.includes('latepace')) {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  console.log('gate'.padEnd(34), 'value'.padStart(9), 'coins'.padStart(8), 'mach-days'.padStart(10), ' busiest station (days)      raw goods');
  for (const g of gates()) {
    const top = [...g.L.secs].sort((a, b) => b[1] - a[1])[0];
    const raw = [...g.L.raw].sort((a, b) => b[1] * (ITEM_BY_ID.get(b[0])?.price ?? 1) - a[1] * (ITEM_BY_ID.get(a[0])?.price ?? 1)).slice(0, 4).map(([id, n]) => `${fmt(n)} ${id}`).join(', ');
    console.log(g.name.slice(0, 33).padEnd(34), fmt(g.L.value).padStart(9), fmt(g.L.coins).padStart(8), machineDays(g.L).toFixed(1).padStart(10), ' ' + (top ? `${top[0]} ${(top[1] / DAY_SECS).toFixed(1)}` : '-').padEnd(27), raw);
  }
}
