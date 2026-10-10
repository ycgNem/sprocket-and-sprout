// The machine contract (ROADMAP.md 4.1): what every structure that handles items takes, gives,
// holds and runs on. Processing machines derive it from their station's recipes; everything else
// is declared here by kind. The structure window leads with it; tests/data.test.ts checks every
// port-capable kind has one.
import { recipesForStation } from './recipes';
import type { StructKind, StructureDef } from './types';

export interface IOContract {
  /** item ids or tags it takes; 'any' for containers and arms; 'field' for crops in the ground */
  in: string[] | 'any' | 'field';
  out: string[] | 'any' | 'field';
  /** seconds a batch (processing machines: the range of its recipes) */
  time?: [number, number];
  buffer: { in: number; out: number };
  power?: number;
  fuel?: boolean;
  /** one line of what it is for */
  note: string;
}

/** kinds that move or hold items through ports: each must have a contract */
export const PORT_KINDS: StructKind[] = ['arm', 'belt', 'underground', 'splitter', 'chest', 'shipbin', 'machine', 'lab', 'drill', 'harvester', 'planter', 'gleaner', 'gantry', 'generator', 'depot', 'megaproject', 'tapper', 'fishtrap', 'beehouse', 'pond', 'building'];

const BY_KIND: Partial<Record<StructKind, (d: StructureDef) => IOContract>> = {
  arm: (d) => ({ in: 'any', out: 'any', buffer: { in: d.hand ?? 1, out: d.hand ?? 1 }, power: d.powerUse, note: d.filter ? 'Moves only the items you choose, from behind it to in front.' : 'Moves items from the tile behind it to the tile in front.' }),
  belt: () => ({ in: 'any', out: 'any', buffer: { in: 8, out: 8 }, note: 'Carries items; at its end it delivers into whatever it runs into.' }),
  underground: (d) => ({ in: 'any', out: 'any', buffer: { in: 8, out: 8 }, note: `Tunnels items under up to ${d.reach ?? 4} tiles.` }),
  splitter: () => ({ in: 'any', out: 'any', buffer: { in: 8, out: 8 }, note: 'Shares items between two belts: alternate, prefer one side, or filter.' }),
  chest: (d) => ({ in: 'any', out: 'any', buffer: { in: d.slots ?? 18, out: d.slots ?? 18 }, note: 'The only buffer: holds goods between stages.' }),
  shipbin: (d) => ({ in: 'any', out: [], buffer: { in: d.slots ?? 36, out: 0 }, note: 'The post takes what is in it at noon, 6pm and night.' }),
  lab: () => ({ in: ['#research'], out: [], buffer: { in: 5, out: 0 }, note: 'Turns bundles into research units.' }),
  drill: (d) => ({ in: [], out: 'any', buffer: { in: 0, out: 20 }, power: d.powerUse, fuel: d.fuel, note: 'Digs ore from the vein under it and pushes it out the front.' }),
  harvester: (d) => ({ in: 'field', out: 'any', buffer: { in: 0, out: 8 }, power: d.powerUse, note: 'Picks ripe crops in a 7x7 around it (from noon), up to silver quality.' }),
  planter: (d) => ({ in: ['#seed'], out: 'field', buffer: { in: 8, out: 0 }, power: d.powerUse, note: 'Tills and plants the 7x7 around it from its hopper.' }),
  gleaner: () => ({ in: 'field', out: 'any', buffer: { in: 0, out: 12 }, note: 'Picks ripe crops in the 3x3 around it (from noon), base quality. Right-click winds it.' }),
  gantry: (d) => ({ in: 'field', out: 'any', buffer: { in: 40, out: 60 }, power: d.powerUse, note: 'Rides its rails over a 5-wide strip: waters, picks and resows it.' }),
  generator: (d) => ({ in: d.fuel ? ['#fuel'] : [], out: [], buffer: { in: d.fuel ? 20 : 0, out: 0 }, fuel: d.fuel, note: `Makes up to ${d.powerGen ?? 0} sparks.` }),
  depot: () => ({ in: 'any', out: [], buffer: { in: 999, out: 0 }, note: 'Takes the goods the Guild contracts ask for.' }),
  megaproject: () => ({ in: 'any', out: [], buffer: { in: 999, out: 0 }, note: 'Takes the materials of its current stage.' }),
  tapper: () => ({ in: [], out: 'any', buffer: { in: 0, out: 5 }, note: 'Drips sap from the tree it sits on.' }),
  fishtrap: () => ({ in: ['#bait'], out: 'any', buffer: { in: 1, out: 4 }, note: 'With bait, catches shellfish overnight.' }),
  beehouse: () => ({ in: [], out: ['honey'], buffer: { in: 0, out: 5 }, note: 'Bees make honey, flavoured by flowers nearby.' }),
  pond: (d) => ({ in: ['#fish'], out: 'any', buffer: { in: 1, out: d.slots ?? 6 }, note: 'A stocked pond lays roe every night.' }),
  building: () => ({ in: ['hay'], out: 'any', buffer: { in: 40, out: 12 }, note: 'Its animals make goods; arms can take them.' }),
};

const cache = new Map<string, IOContract | null>();

/** The contract of a structure, or null for kinds that don't handle items (fences, paths, lamps). */
export function ioOf(d: StructureDef): IOContract | null {
  if (cache.has(d.id)) return cache.get(d.id)!;
  let io: IOContract | null = null;
  if (d.kind === 'machine' && d.station) {
    const rs = recipesForStation(d.station);
    const ins = new Set<string>(), outs = new Set<string>();
    for (const r of rs) {
      for (const i of r.in) ins.add(i.item);
      for (const o of r.out) outs.add(o.item);
    }
    const times = rs.map((r) => r.time);
    io = {
      in: [...ins], out: [...outs], time: times.length ? [Math.min(...times), Math.max(...times)] : undefined,
      buffer: { in: 2, out: 60 }, power: d.powerUse, fuel: d.fuel, note: d.desc,
    };
  } else io = BY_KIND[d.kind]?.(d) ?? null;
  cache.set(d.id, io);
  return io;
}
