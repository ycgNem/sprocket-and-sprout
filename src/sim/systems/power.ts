// Power grids: poles link into networks, generators supply, consumers draw.
// Satisfaction = supply / demand (capped at 1) scales machine speed.
import type { Game } from '../Game';
import type { Ent } from '../ents';
import { MState, setState } from '../mstate';
import { fuelValue } from './machines';
import { rustTick } from '../rust';

export interface NetStats {
  id: number;
  demand: number;
  supply: number;
  cap: number;
  sat: number;
  stored: number;
  storeCap: number;
  /** history of [demand, supply] samples (every second, 60 samples) */
  hist: { d: number[]; s: number[] };
  poles: number;
  consumers: number;
  gens: number;
}

export interface PowerState {
  nets: Map<number, NetStats>;
  wires: [Ent, Ent][];
  /** tile -> net id of supply coverage */
  cover: Int32Array;
  histAcc: number;
}

export function powerState(g: Game): PowerState {
  let p = g.sys.power as PowerState | undefined;
  if (!p || p.cover.length !== g.map.w * g.map.h) {
    p = { nets: new Map(), wires: [], cover: new Int32Array(g.map.w * g.map.h), histAcc: 0 };
    g.sys.power = p;
  }
  return p;
}

function center(e: Ent): [number, number] {
  return [e.x + e.w / 2, e.y + e.h / 2];
}

export function rebuildPower(g: Game) {
  const ps = powerState(g);
  const ents = g.ents;
  // a rusted pole carries nothing until it's restored (ROADMAP.md 6.0)
  const poles = ents.poles.filter((p) => !p.st.rust);
  for (const p of ents.poles) if (p.st.rust) p.net = 0;
  const parent = poles.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  ps.wires = [];
  // connect poles within reach (each pole wires to a few nearest)
  for (let i = 0; i < poles.length; i++) {
    const [ax, ay] = center(poles[i]);
    const ra = poles[i].def.reach ?? 7;
    for (let j = i + 1; j < poles.length; j++) {
      const [bx, by] = center(poles[j]);
      const r = Math.min(ra, poles[j].def.reach ?? 7);
      const dx = ax - bx, dy = ay - by;
      if (dx * dx + dy * dy <= r * r + 0.01) {
        const a = find(i), b = find(j);
        if (a !== b) parent[a] = b;
        ps.wires.push([poles[i], poles[j]]);
      }
    }
  }
  // dedupe excessive wires: keep a spanning-ish subset (all wires drawn are real connections)
  const old = ps.nets;
  ps.nets = new Map();
  ps.cover.fill(0);
  const netOf = new Map<number, number>();
  poles.forEach((p, i) => {
    const root = find(i);
    let id = netOf.get(root);
    if (id === undefined) {
      id = netOf.size + 1;
      netOf.set(root, id);
    }
    p.net = id;
    const s = p.def.supply ?? 2;
    for (let y = p.y - s; y < p.y + p.h + s; y++)
      for (let x = p.x - s; x < p.x + p.w + s; x++) {
        if (!g.map.inb(x, y)) continue;
        const ti = y * g.map.w + x;
        if (!ps.cover[ti]) ps.cover[ti] = id;
      }
  });
  for (let id = 1; id <= netOf.size; id++) {
    const prev = [...old.values()].find((n) => n.id === id);
    ps.nets.set(id, {
      id, demand: 0, supply: 0, cap: 0, sat: 1, stored: 0, storeCap: 0,
      hist: prev?.hist ?? { d: [], s: [] }, poles: 0, consumers: 0, gens: 0,
    });
  }
  for (const p of poles) ps.nets.get(p.net)!.poles++;
  const assign = (e: Ent) => {
    e.net = 0;
    for (let y = e.y; y < e.y + e.h && !e.net; y++)
      for (let x = e.x; x < e.x + e.w; x++) {
        const id = ps.cover[y * g.map.w + x];
        if (id) {
          e.net = id;
          break;
        }
      }
  };
  // the grid switch: consumers inside a switched-off pole's area are off (no demand, no work)
  const offPoles = poles.filter((p) => poleOff(g, p));
  for (const e of ents.consumers) {
    assign(e);
    if (e.net) ps.nets.get(e.net)!.consumers++;
    const over = offPoles.filter((p) => {
      const s = p.def.supply ?? 2;
      return e.x < p.x + p.w + s && e.x + e.w > p.x - s && e.y < p.y + p.h + s && e.y + e.h > p.y - s;
    });
    e.off = over.length > 0;
    e.offNight = e.off && over.every((p) => p.st.sw === 2);
  }
  for (const e of ents.gens) {
    assign(e);
    if (e.net) ps.nets.get(e.net)!.gens++;
  }
  ents.powerDirty = false;
}

/** Current maximum output of a generator. */
export function genCapacity(g: Game, e: Ent): number {
  // the keeper's old wheel is worn: st.cap (40) instead of a new wheel's 60
  const base = (e.st.cap as number | undefined) ?? e.def.powerGen ?? 0;
  switch (e.def.id) {
    case 'waterwheel':
      return base * (g.time.season === 3 ? 0.6 : g.isRaining() ? 1.25 : 1);
    case 'windmill': {
      const gust = 0.85 + 0.15 * Math.sin(g.simTime * 0.37 + e.x) + 0.1 * Math.sin(g.simTime * 1.13 + e.y);
      return base * g.wind * gust * (g.farmKind === 'highlands' ? 1.3 : 1);
    }
    case 'sunlens': {
      const d = g.daylight;
      return base * Math.max(0, d) * (g.isRaining() ? 0.35 : g.weather === 'snow' ? 0.6 : 1);
    }
    case 'steam_engine':
      return e.gen!.burn > 0 || (e.gen!.fuel && e.gen!.fuel.n > 0) ? base : 0;
  }
  return base;
}

export function updatePower(g: Game, dt: number) {
  const powerMul = g.hasPerk('conservator') ? 0.75 : 1;
  if (g.ents.powerDirty) rebuildPower(g);
  const ps = powerState(g);
  for (const n of ps.nets.values()) {
    n.demand = 0;
    n.cap = 0;
    n.stored = 0;
    n.storeCap = 0;
  }
  for (const e of g.ents.consumers) {
    if (!e.net) {
      e.sat = 0;
      continue;
    }
    const n = ps.nets.get(e.net);
    if (!n) continue;
    if (e.off || e.st.rust) continue;
    n.demand += (e.working ? e.def.powerUse ?? 0 : e.def.powerIdle ?? 0) * powerMul;
  }
  for (const e of g.ents.gens) {
    if (e.st.rust) {
      if (e.gen) e.gen.cap = e.gen.out = 0;
      rustTick(e, g.simTime);
      continue;
    }
    if (!e.net) {
      if (e.gen) setState(e, MState.Idle, 'Not wired to a pole', g.simTime);
      continue;
    }
    const n = ps.nets.get(e.net);
    if (!n) continue;
    if (e.def.kind === 'accumulator') {
      n.stored += e.st.stored;
      n.storeCap += e.st.cap;
      continue;
    }
    const c = genCapacity(g, e);
    e.gen!.cap = c;
    n.cap += c;
  }
  for (const n of ps.nets.values()) {
    const fromStore = Math.min(n.stored / Math.max(dt, 1e-6), 200 * (n.storeCap / 3000));
    const avail = n.cap + fromStore;
    n.sat = n.demand > 0 ? Math.min(1, avail / n.demand) : 1;
    n.supply = Math.min(n.demand, avail);
    const load = n.cap > 0 ? Math.min(1, n.demand / n.cap) : 0;
    // batteries: charge with surplus, discharge to cover deficit
    const surplus = n.cap - n.demand;
    for (const e of g.ents.gens) {
      if (e.net !== n.id) continue;
      if (e.st.rust) continue;
      if (e.def.kind === 'accumulator') {
        const share = e.st.cap / Math.max(1, n.storeCap);
        if (surplus > 0) e.st.stored = Math.min(e.st.cap, e.st.stored + Math.min(surplus, 150) * share * dt);
        else e.st.stored = Math.max(0, e.st.stored + surplus * share * dt);
        continue;
      }
      const gen = e.gen!;
      gen.out = gen.cap * load;
      e.working = gen.out > 0.01;
      if (e.def.id === 'steam_engine' && gen.cap <= 0) setState(e, MState.NeedsFuel, 'Needs fuel: wood or coal', g.simTime);
      else if (e.working) setState(e, MState.Working, `Making ${Math.round(gen.out)} of ${Math.round(gen.cap)} sparks`, g.simTime);
      else setState(e, MState.Idle, gen.cap > 0 ? 'Nothing on its grid needs power' : 'No output right now', g.simTime);
      if (e.def.id === 'steam_engine' && load > 0) {
        if (gen.burn <= 0 && gen.fuel && gen.fuel.n > 0) {
          gen.burn += fuelValue(gen.fuel.k) * 0.5;
          g.stats.use(gen.fuel.k, 1);
          if (--gen.fuel.n <= 0) gen.fuel = null;
        }
        gen.burn -= dt * load;
      }
    }
  }
  for (const e of g.ents.consumers) {
    if (!e.net || e.off) {
      e.sat = 0;
      continue;
    }
    e.sat = ps.nets.get(e.net)?.sat ?? 0;
  }
  // history once per second
  ps.histAcc += dt;
  if (ps.histAcc >= 1) {
    ps.histAcc -= 1;
    for (const n of ps.nets.values()) {
      n.hist.d.push(n.demand);
      n.hist.s.push(n.cap);
      if (n.hist.d.length > 60) {
        n.hist.d.shift();
        n.hist.s.shift();
      }
    }
  }
}

/**
 * The grid's one sentence (pole tooltip and window, the Power tab): "Demand 180 / supply 120:
 * add a generator or switch off two machines".
 */
export function gridSentence(g: Game, net: number): string {
  const n = powerState(g).nets.get(net);
  if (!n) return 'Not connected to anything yet.';
  const d = Math.round(n.demand), s = Math.round(n.cap);
  if (n.demand <= n.cap + 0.5) return n.demand > 0 ? `Demand ${d} / supply ${s}: enough power, ${Math.round(n.cap - n.demand)} spare.` : `Supply ${s}: nothing is drawing power right now.`;
  let over = n.demand - n.cap, k = 0;
  const draws = g.ents.consumers.filter((e) => e.net === net && !e.off).map((e) => (e.working ? e.def.powerUse ?? 0 : e.def.powerIdle ?? 0)).sort((a, b) => b - a);
  for (const x of draws) {
    if (over <= 0) break;
    over -= x;
    k++;
  }
  return `Demand ${d} / supply ${s}: add a generator or switch off ${k} machine${k === 1 ? '' : 's'}.`;
}

/** the grid switch's positions: 0 on, 1 off, 2 night shift only (ROADMAP.md 4.7) */
export const POLE_SWITCH = ['On', 'Off', 'Night shift only'] as const;

/** is this pole's area switched off right now? */
export function poleOff(g: Game, p: Ent): boolean {
  const sw = p.st.sw ?? 0;
  return sw === 1 || (sw === 2 && !g.nightShift);
}

/** Turn a pole's grid switch to the next position (on → off → night shift only → on). */
export function togglePole(g: Game, pole: Ent, to?: number) {
  pole.st.sw = to ?? ((pole.st.sw ?? 0) + 1) % 3;
  g.ents.powerDirty = true;
  g.emit({ t: 'sfx', id: pole.st.sw === 0 ? 'switch_on' : 'switch_off', x: pole.x, y: pole.y });
}