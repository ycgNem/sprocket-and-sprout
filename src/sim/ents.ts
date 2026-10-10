// Placed structures ("entities") with optional components, plus a tile index.
// Systems iterate the per-component lists kept here.
import { STRUCT_BY_ID } from '../data/structures';
import type { RecipeDef, StructureDef } from '../data/types';
import { Inventory, ItemKey, Stack } from './inventory';
import { MState } from './mstate';

export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opposite = (d: Dir) => ((d + 2) & 3) as Dir;
export const leftOf = (d: Dir) => ((d + 3) & 3) as Dir;
export const rightOf = (d: Dir) => ((d + 1) & 3) as Dir;

export const ITEM_SPACING = 0.25;

/** a structure's name: its own title where it has one (the keeper's cellar chest, the grain bin), else its kind's */
export const entName = (e: Ent): string => (e.st?.title as string | undefined) ?? e.def.name;

export interface Lane {
  k: number[];
  /** positions along the lane, index 0 = front (highest) */
  p: number[];
}

export enum BeltKind { Belt = 0, UnderIn = 1, UnderOut = 2, Splitter = 3 }

export interface BeltC {
  kind: BeltKind;
  speed: number;
  len: number;
  lanes: [Lane, Lane];
  next: Ent | null;
  /** 0 none, 1 straight (lane i -> i), 2 side-load into lane 0, 3 side-load into lane 1 */
  nextMode: number;
  partner: Ent | null;
  /** rendering: 0 straight, 1 curve from left, 2 curve from right */
  curve: number;
  /** splitter alternation per lane */
  toggle: [number, number];
  /** splitter (root only): items of this key go left, all others right (-1 = off) */
  sFilter?: number;
  /** splitter (root only): 0 alternate, 1 prefer left, 2 prefer right */
  sPrio?: number;
  /** set during topology: items need to keep moving (render anim) */
  moving: boolean;
  /** seconds the front item has been stuck (3 s = Blocked) */
  stuck: number;
}

export enum ArmState { Idle = 0, ToDrop = 1, Dropping = 2, ToPick = 3 }

export interface ArmC {
  reach: number;
  speed: number;
  hand: number;
  held: Stack | null;
  state: ArmState;
  /** swing progress 0 (pick side) .. 1 (drop side) */
  t: number;
  filter: ItemKey[];
  /** stop filling a container once it holds this many of the item (0 = no limit) */
  limit: number;
  powered: boolean;
  /** retry cooldown when nothing to do */
  wait: number;
}

export interface MachC {
  station: string;
  speed: number;
  recipe: RecipeDef | null;
  locked: boolean;
  inBuf: Map<ItemKey, number>;
  outBuf: Stack[];
  crafting: boolean;
  progress: number;
  /** remaining burn seconds */
  burn: number;
  fuel: Stack | null;
  /** quality carried from inputs */
  q: number;
  /** cumulative products (for UI) */
  made: number;
  /** a recipe picked mid-batch: it takes over when the batch is done (null = back to auto) */
  pending?: { r: RecipeDef | null };
}

export interface GenC {
  /** max output now (sparks) */
  cap: number;
  /** current output */
  out: number;
  burn: number;
  fuel: Stack | null;
}

export interface Ent {
  id: number;
  def: StructureDef;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: Dir;
  ghost?: boolean;
  /** secondary tile of a multi-entity structure (splitter right half) */
  parent?: Ent;
  child?: Ent;
  belt?: BeltC;
  arm?: ArmC;
  mach?: MachC;
  inv?: Inventory;
  gen?: GenC;
  /** power network id (consumers, generators, poles) */
  net: number;
  /** power satisfaction applied this tick */
  sat: number;
  working: boolean;
  /** the machine contract's state (src/sim/mstate.ts), its detail line and when it began (sim seconds) */
  state: MState;
  why: string;
  since: number;
  /** a consumer on a switched-off pole (the grid switch): draws no power and does nothing */
  off?: boolean;
  /** off only because its pole runs the night shift only (so it says so); not saved */
  offNight?: boolean;
  /** what a Starved machine waits for (item name, for the advice); not saved */
  want?: string;
  /** waiting for its field to ripen (Idle, not Starved): ROADMAP.md 4.2; not saved */
  fieldWait?: boolean;
  /** Working only as a queue in front of a busy taker (setQueued), not moving goods; not saved */
  queued?: boolean;
  /** a field gantry's strip tiles (refreshed as it ticks); not saved */
  strip?: [number, number][];
  /** the last item an arm carried (names what a starved machine waits for); not saved */
  lastK?: number;
  /** an arm or belt stopped by an item its taker can't use at all (the wrong input); not saved */
  refused?: number;
  /** when an idle arm last worked out why (sim seconds); not saved */
  whyAt?: number;
  /** generic per-kind state bag (labs, drills, hives, buildings, ...) */
  st: any;
}

export function footprint(def: StructureDef, rot: Dir): [number, number] {
  const [w, h] = def.size;
  return rot === 1 || rot === 3 ? [h, w] : [w, h];
}

export class Ents {
  w: number;
  h: number;
  grid: Int32Array;
  map = new Map<number, Ent>();
  nextId = 1;
  belts: Ent[] = [];
  arms: Ent[] = [];
  machines: Ent[] = [];
  gens: Ent[] = [];
  poles: Ent[] = [];
  consumers: Ent[] = [];
  others: Ent[] = [];
  /** set when belt topology changes */
  beltsDirty = true;
  powerDirty = true;
  beltOrder: Ent[] = [];
  version = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.grid = new Int32Array(w * h);
  }

  at(x: number, y: number): Ent | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const id = this.grid[y * this.w + x];
    return id ? this.map.get(id)! : null;
  }

  /** Root entity (resolving splitter halves) */
  rootAt(x: number, y: number): Ent | null {
    const e = this.at(x, y);
    return e?.parent ?? e;
  }

  get(id: number) {
    return this.map.get(id) ?? null;
  }

  add(defId: string, x: number, y: number, rot: Dir, ghost = false): Ent {
    const def = STRUCT_BY_ID.get(defId);
    if (!def) throw new Error('unknown structure ' + defId);
    if (def.kind === 'splitter') {
      // two linked halves, each 1x1
      const a = this.addRaw(def, x, y, rot, 1, 1, ghost);
      const [ox, oy] = [DX[rightOf(rot)], DY[rightOf(rot)]];
      const b = this.addRaw(def, x + ox, y + oy, rot, 1, 1, ghost);
      b.parent = a;
      a.child = b;
      if (!ghost) {
        a.belt!.partner = b;
        b.belt!.partner = a;
      }
      return a;
    }
    const [w, h] = footprint(def, rot);
    return this.addRaw(def, x, y, rot, w, h, ghost);
  }

  private addRaw(def: StructureDef, x: number, y: number, rot: Dir, w: number, h: number, ghost: boolean): Ent {
    const e: Ent = { id: this.nextId++, def, x, y, w, h, rot, net: 0, sat: 1, working: false, state: MState.Idle, why: '', since: 0, st: {} };
    if (ghost) e.ghost = true;
    else initComponents(e);
    this.map.set(e.id, e);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.grid[yy * this.w + xx] = e.id;
    if (!ghost) this.index(e);
    this.version++;
    return e;
  }

  private index(e: Ent) {
    if (e.belt) {
      this.belts.push(e);
      this.beltsDirty = true;
    }
    if (e.arm) this.arms.push(e);
    if (e.mach) this.machines.push(e);
    if (e.gen || e.def.kind === 'accumulator') this.gens.push(e);
    if (e.def.kind === 'pole') this.poles.push(e);
    if (e.def.powerUse) this.consumers.push(e);
    if (!e.belt && !e.arm && !e.mach && !e.gen && e.def.kind !== 'pole') this.others.push(e);
    if (e.def.powerUse || e.gen || e.def.kind === 'pole' || e.def.kind === 'accumulator') this.powerDirty = true;
    // neighbors of arms/belts can change
    this.beltsDirty = this.beltsDirty || !!e.belt;
  }

  remove(e: Ent) {
    const root = e.parent ?? e;
    const all = root.child ? [root, root.child] : [root];
    for (const r of all) {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
        if (this.grid[yy * this.w + xx] === r.id) this.grid[yy * this.w + xx] = 0;
      }
      this.map.delete(r.id);
      const drop = (arr: Ent[]) => {
        const i = arr.indexOf(r);
        if (i >= 0) arr.splice(i, 1);
      };
      if (r.belt) {
        drop(this.belts);
        this.beltsDirty = true;
        if (r.belt.partner && r.def.kind === 'underground') {
          r.belt.partner.belt!.partner = null;
        }
      }
      drop(this.arms);
      drop(this.machines);
      drop(this.gens);
      drop(this.poles);
      drop(this.consumers);
      drop(this.others);
      if (r.def.powerUse || r.gen || r.def.kind === 'pole' || r.def.kind === 'accumulator') this.powerDirty = true;
    }
    this.version++;
  }

  /** convert a ghost into a real entity */
  materialize(e: Ent) {
    if (!e.ghost) return;
    const all = e.child ? [e, e.child] : [e];
    for (const r of all) {
      delete r.ghost;
      initComponents(r);
      this.index(r);
    }
    if (e.child) {
      e.belt!.partner = e.child;
      e.child.belt!.partner = e;
    }
    this.version++;
  }

  all(): Ent[] {
    return [...this.map.values()];
  }
}

export function initComponents(e: Ent) {
  const d = e.def;
  switch (d.kind) {
    case 'belt':
    case 'underground':
    case 'splitter':
      e.belt = {
        kind: d.kind === 'belt' ? BeltKind.Belt : d.kind === 'splitter' ? BeltKind.Splitter : BeltKind.UnderIn,
        speed: d.speed ?? 1.5,
        len: 1,
        lanes: [{ k: [], p: [] }, { k: [], p: [] }],
        next: null,
        nextMode: 0,
        partner: null,
        curve: 0,
        toggle: [0, 0],
        moving: false,
        stuck: 0,
      };
      break;
    case 'arm':
      e.arm = {
        reach: d.reach ?? 1, speed: d.speed ?? 1, hand: d.hand ?? 1, held: null, state: ArmState.Idle, t: 0,
        filter: [], limit: 0, powered: !!d.powerUse, wait: 0,
      };
      break;
    case 'machine':
    case 'beehouse':
      e.mach = newMach(d);
      break;
    case 'generator':
      e.gen = { cap: d.powerGen ?? 0, out: 0, burn: 0, fuel: null };
      break;
    case 'pond':
      e.inv = new Inventory(d.slots ?? 6);
      e.st.pop = 0;
      break;
    case 'chest':
    case 'shipbin':
      e.inv = new Inventory(d.slots ?? 18);
      if (d.id === 'crate_req') e.st.requests = [] as Stack[];
      break;
    case 'harvester':
    case 'planter':
      e.inv = new Inventory(8);
      e.st.cd = 0;
      e.st.anim = 0;
      break;
    case 'drill':
      e.inv = new Inventory(1);
      e.st.progress = 0;
      e.gen = undefined;
      e.st.burn = 0;
      e.st.fuel = null;
      break;
    case 'lab':
      e.inv = new Inventory(5);
      e.st.progress = 0;
      e.st.unit = false;
      break;
    case 'hive':
      e.st.bots = 0;
      e.st.charge = 1;
      break;
    case 'fishtrap':
      e.inv = new Inventory(4);
      e.st.bait = 0;
      break;
    case 'tapper':
      e.inv = new Inventory(1);
      e.st.progress = 0;
      break;
    case 'accumulator':
      e.st.stored = 0;
      e.st.cap = 3000;
      break;
    case 'building':
      e.inv = new Inventory(d.id === 'silo' ? 1 : 12);
      e.st.hay = 0;
      break;
    case 'megaproject':
      e.inv = new Inventory(12);
      e.st.project = null;
      e.st.stage = 0;
      e.st.delivered = {};
      break;
    case 'decor':
      e.st.k = null;
      break;
    case 'gleaner':
      // its basket (12 crops)
      e.inv = new Inventory(4);
      e.st.cd = 0;
      break;
    case 'gantry':
      // the hopper car: crops out, seeds in
      e.inv = new Inventory(16);
      e.st.pos = 0;
      e.st.dir = 0;
      break;
  }
}

export function newMach(d: StructureDef): MachC {
  return {
    station: d.station ?? '', speed: d.speed ?? 1, recipe: null, locked: false, inBuf: new Map(), outBuf: [],
    crafting: false, progress: 0, burn: 0, fuel: null, q: 0, made: 0,
  };
}
