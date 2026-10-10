// The Deepworks (was the Old Mine; ROADMAP.md 7.2): 30 procedural levels in six strata of five
// (Earth, Clayworks, Frost, Ember, Crystal, Starfall: src/data/deepworks.ts). Each stratum has its
// own rock and ores, a hazard and a pest, and its fifth level is a works chamber: an abandoned
// machine to look at (`observed:<kind>`, which the research keystones read) and, for three of them,
// to restore in place with parts from the bag (the lift, the pump, the rail cart). Two works
// problems block the way down: level 6's collapsed gallery (20 beams) and level 10's flooded stair
// (the town's Waterworks). Pests never hurt you, hazards do. Levels regenerate daily from the seed
// and the day; `deepest` is saved, the chambers, the shoring and the drained flag are flags.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { MONSTERS } from '../../data/creatures';
import { CHAMBERS, CHAMBER_BY_KIND, STRATA, type ChamberKind, type StratumDef } from '../../data/deepworks';
import type { MonsterDef } from '../../data/types';
import { Rng } from '../../engine/rng';
import { Game, registerSystem } from '../Game';
import { key, kDef } from '../inventory';
import { O, ORE_TYPES, SOLID_OBJ, T, TileMap, Z } from '../world/tilemap';
import { dropsState, spawnDrop, type Drop } from './drops';
import { TOOL_POWER } from '../actions';

export const MAX_FLOOR = 30;
const MW = 48, MH = 40;
/** the old lift's level, the collapsed gallery's, the flooded stair's (the Frost below is under water) */
export const LIFT_LEVEL = 5, GALLERY_LEVEL = 6, FLOOD_LEVEL = 10;
export const BEAMS_TO_SHORE = 20;
/** the flags the Deepworks reads and sets (the Waterworks keystone sets `waterworks` in town) */
export const DEEP_FLAGS = { lift: 'chamber:lift', pump: 'chamber:pump', cart: 'chamber:cart', shored: 'gallery_shored', drained: 'waterworks' } as const;
export const FLOOD_TEXT = "The way down is under water. The town's old pump house could drain it.";
/** seconds between a cracked ceiling's rumble and the rocks coming down */
export const CRACK_FUSE = 1.5;
/** how long a star-shard's mark glows before the shard lands */
const SHARD_WARN = 1.2;

export interface Monster {
  id: string;
  def: MonsterDef;
  x: number;
  y: number;
  /** knockback */
  vx: number;
  vy: number;
  z: number;
  hp: number;
  maxHp: number;
  hurt: number;
  phase: number;
  t: number;
  /** mites: 0 ambling, 1 after a drop, 2 eating; crabs: 0 sitting, 2 scuttling off; wisps: 0 */
  state: number;
  cool: number;
  /** which way it faces (-1 left, 1 right) */
  face: number;
  /** a mite's heading while it ambles (radians) */
  aim: number;
  /** a crab's tile, a wisp's ladder */
  home?: [number, number];
  /** what a mite has eaten, given back when it's squashed */
  ate: { k: number; n: number }[];
  /** the ore drop a mite is after */
  target: Drop | null;
}

export interface PlacedChamber { kind: ChamberKind; x: number; y: number; w: number; h: number }

export type HazardKind = 'crack' | 'gas' | 'shard';
export interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  /** cracks come down and gas pockets burn off together, by group */
  group: number;
  /** 0 waiting, 1 going off (a crack rumbling, a shard's mark glowing), 2 spent */
  state: number;
  /** seconds left: a crack's fuse, a shard's wait or glow */
  t: number;
}

export interface MineLight { x: number; y: number; r: number; i: number; c?: number; flicker?: boolean; dyn?: boolean }

export interface MineState {
  floor: number;
  map: TileMap | null;
  /** the stratum: 0 Earth, 1 Clayworks, 2 Frost, 3 Ember, 4 Crystal, 5 Starfall */
  theme: number;
  /** this level's pests (the renderer's actors) */
  monsters: Monster[];
  lights: MineLight[];
  deepest: number;
  ladder: [number, number] | null;
  /** the rock hiding the ladder (tile index), or -1 */
  hidden: number;
  /** a wisp level's ladder: shown when its wisp is hit */
  wispLadder: [number, number] | null;
  /** rocks broken on this level: every one makes the ladder likelier */
  broken: number;
  rockHits: Map<number, number>;
  chambers: PlacedChamber[];
  hazards: Hazard[];
  /** level 6's gallery or level 10's stair */
  gallery: [number, number] | null;
  /** presentation: how dark it is, the lantern's reach (tiles), the colour of the dark */
  dark: number;
  lantern: number;
  tint: number;
  /** one-off notes already said on this visit */
  told: Set<string>;
  // api
  solid: (g: Game, x: number, y: number) => boolean;
  useTool: (g: Game, kind: string, tier: number, tx: number, ty: number) => void;
  attack: (g: Game, tx: number, ty: number, w: { dmg: number; speed: number; knock: number }) => void;
  interact: (g: Game, tx: number, ty: number) => boolean;
  enterPrompt: (g: Game) => void;
  enter: (g: Game, floor: number) => void;
  leave: (g: Game) => void;
  debugDescend: (g: Game, n: number) => void;
  /** the lift's stops below the entrance (chamber levels reached, the flood permitting) */
  lifts: (g: Game) => number[];
  chamberAt: (x: number, y: number) => PlacedChamber | null;
  restore: (g: Game, kind: ChamberKind) => 'done' | 'already' | 'missing' | 'none';
}

export function mine(g: Game): MineState {
  if (!g.sys.mine) {
    const st: MineState = {
      floor: 0, map: null, theme: 0, monsters: [], lights: [], deepest: 0, ladder: null, hidden: -1, wispLadder: null, broken: 0, rockHits: new Map(),
      chambers: [], hazards: [], gallery: null, dark: 0.62, lantern: 6, tint: C.ink, told: new Set(),
      solid: mineSolid, useTool: mineTool, attack, interact: mineInteract, enterPrompt, enter: enterFloor, leave, debugDescend,
      lifts: liftLevels, chamberAt: (x, y) => chamberAt(st, x, y), restore: restoreChamber,
    };
    g.sys.mine = st;
  }
  return g.sys.mine;
}

/** The stratum of a level: 0 Earth (1-5), 1 Clayworks, 2 Frost, 3 Ember, 4 Crystal, 5 Starfall (26-30). */
export function themeOf(floor: number) {
  return Math.max(0, Math.min(STRATA.length - 1, Math.floor((floor - 1) / 5)));
}

export function stratumOf(floor: number): StratumDef {
  return STRATA[themeOf(floor)];
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const isRock = (o: number) => o === O.ROCK || o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK;
/** a closed gallery or a flooded stair (solid); a shored gallery and a drained stair are ways down */
const galleryShut = (v: number) => v === 0 || v === 2;
const galleryOpen = (v: number) => v === 1 || v === 3;

function mineSolid(g: Game, x: number, y: number): boolean {
  const st = mine(g);
  const m = st.map;
  if (!m) return false;
  if (m.o(x, y) === O.GALLERY && galleryShut(m.objData[m.idx(x, y)])) return true;
  // a clatter-crab sitting in its gallery
  for (const mo of st.monsters) if (mo.def.behavior === 'block' && mo.state !== 2 && mo.home && mo.home[0] === x && mo.home[1] === y) return true;
  return false;
}

// ---------------- generation ----------------
/** Can you walk (or dig) through a tile? Rocks can be mined, so they count as open. */
function passable(m: TileMap, i: number): boolean {
  if (m.ground[i] !== T.MINEFLOOR) return false;
  const o = m.obj[i];
  return !(o === O.STALAGMITE || o === O.CRYSTAL || o === O.CHAMBER || o === O.TREASURE || o === O.GALLERY);
}

/** Path distances from the entry over open tiles (-1: out of reach). */
function pathDist(m: TileMap, entry: [number, number]): Int32Array {
  const d = new Int32Array(m.w * m.h).fill(-1);
  const s = m.idx(entry[0], entry[1]);
  d[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const u = q[h], ux = u % m.w, uy = (u - ux) / m.w;
    for (const [dx, dy] of N4) {
      const x = ux + dx, y = uy + dy;
      if (!m.inb(x, y)) continue;
      const v = m.idx(x, y);
      if (d[v] >= 0 || !passable(m, v)) continue;
      d[v] = d[u] + 1;
      q.push(v);
    }
  }
  return d;
}

/**
 * Every open floor tile in reach of the entry: a pool or a stalagmite that cuts a gallery gets a
 * causeway or comes down (a 0-1 search: open floor costs nothing, water, lava and standing decor 1).
 */
function connectAll(m: TileMap, entry: [number, number]) {
  const n = m.w * m.h;
  const cost = (i: number): number => {
    const t = m.ground[i];
    if (t === T.MINEWALL || t === T.VOID || m.obj[i] === O.CHAMBER) return -1;
    if (t === T.MINEWATER || t === T.LAVA || m.obj[i] === O.STALAGMITE || m.obj[i] === O.CRYSTAL) return 1;
    return 0;
  };
  const dist = new Int32Array(n).fill(1 << 30), par = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const s = m.idx(entry[0], entry[1]);
  dist[s] = 0;
  let cur = [s];
  while (cur.length) {
    const next: number[] = [];
    for (let q = 0; q < cur.length; q++) {
      const u = cur[q];
      if (done[u]) continue;
      done[u] = 1;
      const ux = u % m.w, uy = (u - ux) / m.w;
      for (const [dx, dy] of N4) {
        const x = ux + dx, y = uy + dy;
        if (!m.inb(x, y)) continue;
        const v = m.idx(x, y), c = cost(v);
        if (c < 0 || done[v] || dist[u] + c >= dist[v]) continue;
        dist[v] = dist[u] + c;
        par[v] = u;
        (c ? next : cur).push(v);
      }
    }
    cur = next;
  }
  const fixed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (cost(i) !== 0 || dist[i] === 0 || dist[i] >= 1 << 30) continue;
    for (let u = i; u >= 0 && dist[u] > 0 && !fixed[u]; u = par[u]) {
      fixed[u] = 1;
      if (cost(u) !== 1) continue;
      if (m.ground[u] !== T.MINEFLOOR) m.ground[u] = T.MINEFLOOR;
      else m.obj[u] = O.NONE;
    }
  }
}

/** Cut tiles of the open floor (rooted at the entry), each with how many tiles it cuts off. */
function chokepoints(m: TileMap, entry: [number, number]): Map<number, number> {
  const n = m.w * m.h;
  const disc = new Int32Array(n).fill(-1), low = new Int32Array(n), size = new Int32Array(n);
  const cut = new Map<number, number>();
  const root = m.idx(entry[0], entry[1]);
  let time = 0;
  disc[root] = low[root] = time++;
  size[root] = 1;
  const stack: { u: number; it: number; parent: number }[] = [{ u: root, it: 0, parent: -1 }];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const u = top.u;
    if (top.it < 4) {
      const [dx, dy] = N4[top.it++];
      const x = (u % m.w) + dx, y = Math.floor(u / m.w) + dy;
      if (!m.inb(x, y)) continue;
      const v = m.idx(x, y);
      if (!passable(m, v)) continue;
      if (disc[v] < 0) {
        disc[v] = low[v] = time++;
        size[v] = 1;
        stack.push({ u: v, it: 0, parent: u });
      } else if (v !== top.parent) low[u] = Math.min(low[u], disc[v]);
    } else {
      stack.pop();
      const p = top.parent;
      if (p < 0) continue;
      low[p] = Math.min(low[p], low[u]);
      size[p] += size[u];
      if (p !== root && low[u] >= disc[p]) cut.set(p, (cut.get(p) ?? 0) + size[u]);
    }
  }
  return cut;
}

/** open floor among a tile's 8 neighbours */
function openAround(m: TileMap, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m.g(x + dx, y + dy) === T.MINEFLOOR) n++;
  return n;
}

interface Gen {
  map: TileMap;
  entry: [number, number];
  hidden: number;
  wispLadder: [number, number] | null;
  monsters: Monster[];
  chambers: PlacedChamber[];
  hazards: Hazard[];
  gallery: [number, number] | null;
}

function newPest(def: MonsterDef, x: number, y: number, rng: Rng, home?: [number, number]): Monster {
  return { id: def.id, def, x, y, vx: 0, vy: 0, z: 0, hp: def.hp, maxHp: def.hp, hurt: 0, phase: rng.next() * 4, t: rng.next() * 2, state: 0, cool: rng.next(), face: rng.next() < 0.5 ? -1 : 1, aim: rng.next() * Math.PI * 2, home, ate: [], target: null };
}

/** the clearing of a works chamber level */
const ROOM_W = 13, ROOM_H = 9;

export function generateFloor(g: Game, floor: number): Gen {
  const rng = new Rng(g.seed * 31 + floor * 977 + g.dayIndex * 13);
  const theme = themeOf(floor), S = STRATA[theme];
  const m = new TileMap(MW, MH);
  m.zone.fill(Z.MINE);
  // cellular automaton caves
  let cells = new Uint8Array(MW * MH);
  for (let i = 0; i < cells.length; i++) {
    const x = i % MW, y = Math.floor(i / MW);
    cells[i] = x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2 || rng.next() < 0.44 ? 1 : 0;
  }
  for (let it = 0; it < 5; it++) {
    const next = new Uint8Array(cells.length);
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= MW || yy >= MH || cells[yy * MW + xx]) n++;
        }
        next[y * MW + x] = n >= 5 || x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1 ? 1 : 0;
      }
    cells = next;
  }
  // biggest connected region
  const region = new Int32Array(cells.length).fill(-1);
  let best = -1, bestSize = 0, rid = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] || region[i] >= 0) continue;
    const stack = [i];
    region[i] = rid;
    let size = 0;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx = c % MW, cy = (c - cx) / MW;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const ni = ny * MW + nx;
        if (!cells[ni] && region[ni] < 0) {
          region[ni] = rid;
          stack.push(ni);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = rid;
    }
    rid++;
  }
  // a works chamber level: a clearing in the big cave, its machine against the back wall, the entry at its foot
  const clear = new Uint8Array(MW * MH);
  let room: { x0: number; y0: number; x1: number; y1: number; cx: number } | null = null;
  if (floor % 5 === 0) {
    const cand: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      const x = i % MW, y = Math.floor(i / MW);
      if (region[i] === best && x >= 8 && x <= MW - 9 && y >= 6 && y <= MH - 7) cand.push(i);
    }
    const c = cand.length ? rng.pick(cand) : Math.floor(MH / 2) * MW + Math.floor(MW / 2);
    const cx = c % MW, cy = Math.floor(c / MW);
    room = { x0: cx - (ROOM_W >> 1), y0: cy - (ROOM_H >> 1), x1: cx + (ROOM_W >> 1), y1: cy + (ROOM_H >> 1), cx };
    for (let y = room.y0; y <= room.y1; y++)
      for (let x = room.x0; x <= room.x1; x++) {
        if ((x === room.x0 || x === room.x1) && (y === room.y0 || y === room.y1)) continue;
        const i = y * MW + x;
        cells[i] = 0;
        region[i] = best;
        clear[i] = 1;
      }
    // (a cave that missed the middle band: dig a gallery from the clearing to it)
    if (!cand.length) {
      const from = new Int32Array(cells.length).fill(-2);
      const q = [c];
      from[c] = -1;
      for (let h = 0; h < q.length; h++) {
        const u = q[h];
        if (region[u] === best && !clear[u]) {
          for (let v = u; v >= 0; v = from[v]) { cells[v] = 0; region[v] = best; }
          break;
        }
        const ux = u % MW, uy = (u - ux) / MW;
        for (const [dx, dy] of N4) {
          const x = ux + dx, y = uy + dy;
          if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2 || from[y * MW + x] !== -2) continue;
          from[y * MW + x] = u;
          q.push(y * MW + x);
        }
      }
    }
  }
  const nearRoom = (i: number, r: number) => !!room && (i % MW) >= room.x0 - r && (i % MW) <= room.x1 + r && Math.floor(i / MW) >= room.y0 - r && Math.floor(i / MW) <= room.y1 + r;
  const open: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const isOpen = !cells[i] && region[i] === best;
    m.ground[i] = isOpen ? T.MINEFLOOR : T.MINEWALL;
    if (isOpen) open.push(i);
  }
  // pools: water now and then, always in the Frost (the old flood); lava in the Ember. The old pump
  // drains the water below level 10.
  const lava = theme === 3;
  let pools = floor % 3 === 1 ? 1 : 0;
  if (theme === 2) pools = 2;
  if (lava) pools = Math.max(1, pools);
  if (!lava && floor > FLOOD_LEVEL && g.flags.has(DEEP_FLAGS.pump)) pools = 0;
  for (let k = 0; k < pools; k++) {
    const cs = open.filter((i) => m.ground[i] === T.MINEFLOOR && !nearRoom(i, 3));
    if (!cs.length) break;
    const c = rng.pick(cs);
    const cx = c % MW, cy = Math.floor(c / MW);
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        if (!m.inb(x, y) || m.ground[m.idx(x, y)] !== T.MINEFLOOR || nearRoom(m.idx(x, y), 2)) continue;
        if (((x - cx) / 4) ** 2 + ((y - cy) / 3) ** 2 + (rng.next() - 0.5) * 0.3 < 1) m.ground[m.idx(x, y)] = lava ? T.LAVA : T.MINEWATER;
      }
  }
  // the entry (the ladder up): at the clearing's foot, or a floor tile with room around it
  const floors = open.filter((i) => m.ground[i] === T.MINEFLOOR);
  let entry: [number, number];
  if (room) entry = [room.cx, room.y1 - 2];
  else {
    const roomy = floors.filter((i) => { const x = i % MW, y = Math.floor(i / MW); return m.g(x, y + 1) === T.MINEFLOOR && m.g(x - 1, y) === T.MINEFLOOR && m.g(x + 1, y) === T.MINEFLOOR; });
    const list = roomy.length ? roomy : floors;
    const e = list[Math.floor(rng.next() * list.length)];
    entry = [e % MW, Math.floor(e / MW)];
  }
  // rocks, ores, gems and standing decoration
  const rocks: number[] = [];
  const gemTier = () => Math.min(6, Math.floor(rng.next() * (2 + floor / 5)));
  for (const i of floors) {
    if (m.ground[i] !== T.MINEFLOOR || clear[i]) continue;
    const x = i % MW, y = Math.floor(i / MW);
    if (Math.abs(x - entry[0]) + Math.abs(y - entry[1]) < 3) continue;
    const r = rng.next();
    if (r < S.rock) {
      m.obj[i] = rng.next() < S.ice ? O.ICE_ROCK : O.ROCK;
      rocks.push(i);
    } else if (r < S.rock + S.ore) {
      if (S.ores.length) {
        m.obj[i] = O.ORE_ROCK;
        m.objData[i] = rng.weighted(S.ores, (o) => o[1])[0];
      } else m.obj[i] = O.ROCK;
      rocks.push(i);
    } else if (r < S.rock + S.ore + S.gem) {
      m.obj[i] = O.GEM_ROCK;
      m.objData[i] = gemTier();
      rocks.push(i);
    } else if (r < S.rock + S.ore + S.gem + S.decorP && openAround(m, x, y) >= 7) {
      m.obj[i] = S.decor === 'crystal' || (S.decor === 'mixed' && rng.next() < 0.5) ? O.CRYSTAL : O.STALAGMITE;
    }
  }
  // the chamber's machines, the lift landing, the ladder up
  const chambers: PlacedChamber[] = [];
  if (room) {
    const defs = CHAMBERS.filter((c) => c.level === floor);
    const y = room.y0 + 1;
    defs.forEach((d, k) => {
      const x0 = defs.length > 1 ? (k === 0 ? room!.cx - 5 : room!.cx + 3) : room!.cx - (d.w >> 1);
      chambers.push({ kind: d.kind, x: x0, y, w: d.w, h: 1 });
      for (let dx = 0; dx < d.w; dx++) {
        const i = m.idx(x0 + dx, y);
        m.obj[i] = O.CHAMBER;
        m.objData[i] = CHAMBERS.indexOf(d);
      }
    });
    // every chamber level has a lift landing beside the entry (the old lift itself on level 5)
    if (floor !== LIFT_LEVEL) m.obj[m.idx(room.cx + 2, entry[1])] = O.ELEVATOR;
  }
  m.obj[m.idx(entry[0], entry[1])] = O.MINE_EXIT;
  m.objData[m.idx(entry[0], entry[1])] = 0;
  connectAll(m, entry);
  let dist = pathDist(m, entry);
  const reach = (d: Int32Array) => d.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0);
  /** does a solid thing on tile i keep everything else in reach? */
  const keepsReach = (i: number, o: O, data: number) => {
    const before = reach(dist);
    const [po, pd] = [m.obj[i], m.objData[i]];
    m.obj[i] = o;
    m.objData[i] = data;
    const d2 = pathDist(m, entry);
    if (reach(d2) >= before - 1) {
      dist = d2;
      return true;
    }
    m.obj[i] = po;
    m.objData[i] = pd;
    return false;
  };
  const free = (i: number) => m.ground[i] === T.MINEFLOOR && m.obj[i] === O.NONE && !clear[i] && dist[i] >= 0;
  // the way down
  let hidden = -1, wispLadder: [number, number] | null = null, gallery: [number, number] | null = null;
  if (floor === GALLERY_LEVEL || floor === FLOOD_LEVEL) {
    // a doorway in a wall face, far from the entry
    const state = floor === GALLERY_LEVEL ? (g.flags.has(DEEP_FLAGS.shored) ? 1 : 0) : g.flags.has(DEEP_FLAGS.drained) ? 3 : 2;
    const cand = floors.filter((i) => {
      const x = i % MW, y = Math.floor(i / MW);
      return dist[i] >= 0 && !clear[i] && (m.obj[i] === O.NONE || isRock(m.obj[i])) && m.g(x, y - 1) === T.MINEWALL && dist[m.idx(x, y + 1)] >= 0 &&
        Math.abs(x - entry[0]) + Math.abs(y - entry[1]) >= 4;
    }).sort((a, b) => dist[b] - dist[a]);
    // one of the farthest third, unless it would cut part of the level off (shut, it's solid; open,
    // stepping on it takes you down), so the level is the same either way
    for (const i of [...rng.shuffle(cand.slice(0, Math.max(1, Math.ceil(cand.length / 3)))), ...cand]) {
      if (!keepsReach(i, O.GALLERY, state)) continue;
      m.obj[i] = O.GALLERY;
      m.objData[i] = state;
      gallery = [i % MW, Math.floor(i / MW)];
      break;
    }
  } else if (floor > 20 && floor < MAX_FLOOR) {
    // the ladder a wisp keeps hidden: open floor, far from the entry
    const cand = floors.filter((i) => free(i) && dist[i] >= 10 && N4.every(([dx, dy]) => passable(m, i + dx + dy * MW)));
    const list = cand.length ? cand : floors.filter((i) => free(i) && dist[i] >= 4);
    if (list.length) {
      const i = rng.pick(list);
      wispLadder = [i % MW, Math.floor(i / MW)];
    }
  } else if (floor < MAX_FLOOR) {
    const far = rocks.filter((i) => isRock(m.obj[i]) && dist[i] >= 6);
    const list = far.length ? far : rocks.filter((i) => isRock(m.obj[i]));
    hidden = list.length ? rng.pick(list) : -1;
  }
  const wl = wispLadder ? m.idx(wispLadder[0], wispLadder[1]) : -1;
  // pests
  const monsters: Monster[] = [];
  const def = MONSTERS.find((d) => floor >= d.floors[0] && floor <= d.floors[1]);
  if (def?.behavior === 'mite') {
    const spots = floors.filter((i) => free(i) && dist[i] >= 6);
    const n = Math.min(4, 1 + Math.floor((floor + 1) / 3));
    for (let k = 0; k < n && spots.length; k++) {
      const i = spots.splice(Math.floor(rng.next() * spots.length), 1)[0];
      monsters.push(newPest(def, (i % MW) + 0.5, Math.floor(i / MW) + 0.7, rng));
    }
  } else if (def?.behavior === 'block') {
    // a clatter-crab sits where a gallery narrows: a tile that cuts part of the level off
    const cuts = [...chokepoints(m, entry)].filter(([i, n]) => n >= 16 && free(i) && dist[i] >= 5 && i !== wl).sort((a, b) => b[1] - a[1]);
    const narrow = floors.filter((i) => {
      if (!free(i) || dist[i] < 6) return false;
      const x = i % MW, y = Math.floor(i / MW);
      const w = (xx: number, yy: number) => m.g(xx, yy) === T.MINEWALL;
      return (w(x - 1, y) && w(x + 1, y) && !w(x, y - 1) && !w(x, y + 1)) || (w(x, y - 1) && w(x, y + 1) && !w(x - 1, y) && !w(x + 1, y));
    });
    // (an open cave without a true neck: where the walls close in most)
    const narrowish = floors.filter((i) => free(i) && dist[i] >= 6 && !narrow.includes(i) && openAround(m, i % MW, Math.floor(i / MW)) <= 4);
    const list = [...cuts.map(([i]) => i), ...rng.shuffle(narrow), ...rng.shuffle(narrowish)];
    const n = floor % 5 === 0 ? 1 : 1 + (rng.next() < 0.5 ? 1 : 0);
    const taken: number[] = [];
    for (const i of list) {
      if (taken.length >= n) break;
      if (taken.some((j) => Math.abs((j % MW) - (i % MW)) + Math.abs(Math.floor(j / MW) - Math.floor(i / MW)) < 6)) continue;
      taken.push(i);
      monsters.push(newPest(def, (i % MW) + 0.5, Math.floor(i / MW) + 0.7, rng, [i % MW, Math.floor(i / MW)]));
    }
  } else if (def?.behavior === 'guard' && wispLadder) {
    monsters.push(newPest(def, wispLadder[0] + 0.5, wispLadder[1] + 0.6, rng, [wispLadder[0], wispLadder[1]]));
  }
  // hazards
  const hazards: Hazard[] = [];
  const used = new Set<number>();
  const hzFree = (i: number) => free(i) && i !== wl && !used.has(i) && dist[i] >= 6 && openAround(m, i % MW, Math.floor(i / MW)) >= 6 &&
    !monsters.some((mo) => Math.floor(mo.x) === i % MW && Math.floor(mo.y) === Math.floor(i / MW));
  const groups = (count: number, lo: number, hi: number, kind: HazardKind) => {
    for (let gi = 0; gi < count; gi++) {
      const seeds = floors.filter((i) => hzFree(i) && ![...used].some((j) => Math.abs((j % MW) - (i % MW)) + Math.abs(Math.floor(j / MW) - Math.floor(i / MW)) < 4));
      if (!seeds.length) return;
      const want = rng.int(lo, hi), got = [rng.pick(seeds)];
      used.add(got[0]);
      for (let h = 0; h < got.length && got.length < want; h++)
        for (const [dx, dy] of N4) {
          const j = got[h] + dx + dy * MW;
          if (got.length < want && hzFree(j)) { got.push(j); used.add(j); }
        }
      for (const i of got) hazards.push({ kind, x: i % MW, y: Math.floor(i / MW), group: gi, state: 0, t: 0 });
    }
  };
  if (theme === 0) groups(3, 2, 4, 'crack');
  else if (theme === 3) groups(3 + (rng.next() < 0.5 ? 1 : 0), 3, 5, 'gas');
  else if (theme === 5) {
    const n = 4 + rng.int(0, 2);
    for (let k = 0; k < n; k++) {
      const cs = floors.filter(hzFree);
      if (!cs.length) break;
      const i = rng.pick(cs);
      used.add(i);
      hazards.push({ kind: 'shard', x: i % MW, y: Math.floor(i / MW), group: k, state: 0, t: 3 + k * 2.5 + rng.next() * 3 });
    }
  }
  const hzAt = new Set(hazards.map((h) => m.idx(h.x, h.y)));
  // treasure: a grand chest on levels 10, 20 and 30 (once), now and then a small one; the bottom's starstone
  const far = floors.filter((i) => free(i) && dist[i] > 10 && i !== wl && !hzAt.has(i) && openAround(m, i % MW, Math.floor(i / MW)) >= 6);
  const chest = (kind: number) => {
    while (far.length) {
      const i = far.splice(Math.floor(rng.next() * far.length), 1)[0];
      if (keepsReach(i, O.TREASURE, kind)) return true;
    }
    return false;
  };
  if (floor % 10 === 0 && !g.flags.has('treasure_' + floor)) chest(1);
  else if (rng.next() < 0.06) chest(0);
  if (floor === MAX_FLOOR && far.length) {
    const i = rng.pick(far);
    m.obj[i] = O.GEM_ROCK;
    m.objData[i] = 6;
  }
  for (let i = 0; i < m.deco.length; i++) m.deco[i] = Math.floor(rng.next() * 256);
  return { map: m, entry, hidden, wispLadder, monsters, chambers, hazards, gallery };
}

function lightsFor(g: Game, st: MineState) {
  const m = st.map!;
  st.lights = st.lights.filter((l) => l.dyn);
  for (let i = 0; i < m.obj.length; i++) {
    if (m.obj[i] === O.CRYSTAL) st.lights.push({ x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.4, r: 2.5, i: 0.8, c: C.lavender });
    if (m.ground[i] === T.LAVA && i % 3 === 0) st.lights.push({ x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5, r: 2, i: 0.7, c: C.amber, flicker: true });
  }
  for (const c of st.chambers) {
    const x = c.x + c.w / 2, y = c.y + 0.3;
    if (c.kind === 'star') st.lights.push({ x, y: y - 0.5, r: 4.5, i: 1, c: C.butter, flicker: true });
    else if (c.kind === 'lampworks') st.lights.push({ x, y: y - 1, r: 1.8, i: 0.55, c: C.aqua, flicker: true });
    else if (c.kind === 'lift' && g.flags.has(DEEP_FLAGS.lift)) st.lights.push({ x, y: y - 1.6, r: 3.2, i: 0.9, c: C.amber, flicker: true });
    else if (c.kind === 'pump' && g.flags.has(DEEP_FLAGS.pump)) st.lights.push({ x, y: y - 1.2, r: 2.6, i: 0.8, c: C.amber, flicker: true });
    else if (c.kind === 'boiler') st.lights.push({ x: c.x + 0.6, y, r: 1.4, i: 0.4, c: C.terracotta, flicker: true });
    // (a miner's lamp left hanging on the lockers: the Crystal's dark would hide them otherwise)
    else if (c.kind === 'lockers') st.lights.push({ x, y: y - 1.2, r: 3.4, i: 0.75, c: C.apricot, flicker: true });
    else if (c.kind === 'cart') st.lights.push({ x, y: y - 0.6, r: 2.4, i: 0.55, c: C.apricot, flicker: true });
  }
  for (const h of st.hazards) {
    if (h.kind === 'gas') st.lights.push({ x: h.x + 0.5, y: h.y + 0.5, r: 1.3, i: 0.3, c: C.lime });
    else if (h.kind === 'shard') st.lights.push({ x: h.x + 0.5, y: h.y + 0.5, r: 1.1, i: 0.45, c: C.butter, flicker: true });
  }
}

/** lights that move: wisps, a shard's mark about to be hit */
function dynLights(st: MineState) {
  st.lights = st.lights.filter((l) => !l.dyn);
  for (const mo of st.monsters) if (mo.def.behavior === 'guard') st.lights.push({ x: mo.x, y: mo.y - 0.7, r: 2.6, i: 0.95, c: C.aqua, flicker: true, dyn: true });
  for (const h of st.hazards) if (h.kind === 'shard' && h.state === 1) st.lights.push({ x: h.x + 0.5, y: h.y + 0.5, r: 2.4, i: 1, c: C.butter, flicker: true, dyn: true });
}

/**
 * Leaving a level: what lies within reach goes into the bag on the way (ore from the rock that hid
 * the ladder), the rest stays behind with the level. (Drops used to follow you down a level and turn
 * up at the same spot, often in a wall, where a rust-mite could eat them.)
 */
function sweepDrops(g: Game) {
  const ds = dropsState(g), p = g.player;
  if (p.where !== 'mine') return;
  ds.list = ds.list.filter((d) => {
    if (d.map !== 'mine') return true;
    if (Math.hypot(d.x - p.x, d.y - p.y) < 4) {
      const got = d.n - p.inv.add(d.k, d.n);
      if (got > 0) {
        g.stats.add(d.k, got);
        g.emit({ t: 'pickup', k: d.k, n: got, x: p.x, y: p.y - 1 });
        g.sys.collections?.found?.(g, d.k);
      }
    }
    return false;
  });
}

export function enterFloor(g: Game, floor: number) {
  const st = mine(g);
  floor = Math.max(1, Math.min(MAX_FLOOR, Math.floor(floor)));
  sweepDrops(g);
  const gen = generateFloor(g, floor);
  st.floor = floor;
  st.map = gen.map;
  st.theme = themeOf(floor);
  const S = STRATA[st.theme];
  st.monsters = gen.monsters;
  st.chambers = gen.chambers;
  st.hazards = gen.hazards;
  st.gallery = gen.gallery;
  st.hidden = gen.hidden;
  st.wispLadder = gen.wispLadder;
  st.ladder = null;
  st.broken = 0;
  st.rockHits.clear();
  st.dark = S.dark;
  st.lantern = S.lantern;
  st.tint = S.tint;
  st.told = new Set();
  st.lights = [];
  lightsFor(g, st);
  dynLights(st);
  const p = g.player;
  p.where = 'mine';
  p.x = gen.entry[0] + 0.5;
  p.y = gen.entry[1] + 1.4;
  p.kx = p.ky = 0;
  if (st.map.g(gen.entry[0], gen.entry[1] + 1) !== T.MINEFLOOR) p.y = gen.entry[1] + 0.9;
  if (floor > st.deepest) {
    st.deepest = floor;
    g.sys.quests?.notify?.(g, 'floor', floor);
  }
  // every works chamber down to here counts as reached: a lift stop once the old lift runs
  // (including chambers a tumble carried you past; see the owner's "mine floors don't save")
  const firstHere = floor % 5 === 0 && !g.flags.has('elev_' + floor);
  for (let f = 5; f <= floor; f += 5) g.flags.add('elev_' + f);
  if (!g.flags.has('deep:' + S.id)) {
    g.flags.add('deep:' + S.id);
    g.toast(S.intro, undefined, C.amber);
  }
  if (firstHere) {
    const names = st.chambers.map((c) => CHAMBER_BY_KIND.get(c.kind)!.name);
    const lift = g.flags.has(DEEP_FLAGS.lift) && floor !== LIFT_LEVEL ? ' The lift stops here now.' : '';
    g.toast(`Level ${floor}: a works chamber. ${cap(names.join(' and '))} ${names.length > 1 ? 'stand' : 'stands'} in the clearing.${lift}`, undefined, C.butter);
  }
  if (floor === GALLERY_LEVEL && !g.flags.has(DEEP_FLAGS.shored))
    g.toast(`The gallery down has caved in: there's no way deeper until it's shored up. ${BEAMS_TO_SHORE} hardwood beams would do it for good (F at the collapse).`);
  if (floor === FLOOD_LEVEL && !g.flags.has(DEEP_FLAGS.drained)) g.toast(FLOOD_TEXT);
  g.emit({ t: 'sfx', id: 'door' });
  g.emit({ t: 'ui', open: 'fade' });
}

function leave(g: Game) {
  const st = mine(g);
  sweepDrops(g);
  st.map = null;
  st.monsters = [];
  st.hazards = [];
  st.chambers = [];
  g.player.where = 'world';
  const [x, y] = g.map.loc('mine_entrance');
  g.player.x = x + 0.5;
  g.player.y = y + 0.9;
  g.player.dir = 2;
  g.emit({ t: 'sfx', id: 'door' });
}

/** The lift's stops below the entrance: every works chamber reached, none under the flood until it's drained. */
export function liftLevels(g: Game): number[] {
  const st = mine(g);
  const out: number[] = [];
  for (let f = 5; f <= MAX_FLOOR; f += 5) {
    if (!g.flags.has('elev_' + f) && f > st.deepest) continue;
    if (f > FLOOD_LEVEL && !g.flags.has(DEEP_FLAGS.drained)) continue;
    out.push(f);
  }
  return out;
}

/** The entrance (or a lift landing): the lift's window once the old lift runs, else the ladder to level 1. */
function enterPrompt(g: Game) {
  if (!g.flags.has(DEEP_FLAGS.lift)) {
    if (g.player.where === 'mine') {
      g.toast('This lift landing is dead: the old lift on level 5 needs restoring first.');
      g.emit({ t: 'sfx', id: 'thud' });
      return;
    }
    enterFloor(g, 1);
    return;
  }
  g.emit({ t: 'ui', open: 'elevator', arg: [1, ...liftLevels(g)] });
}

function debugDescend(g: Game, n: number) {
  const st = mine(g);
  enterFloor(g, (g.player.where === 'mine' ? st.floor : 0) + n);
}

function descend(g: Game) {
  const st = mine(g);
  if (st.floor < MAX_FLOOR) enterFloor(g, st.floor + 1);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "4 planks", "a rope", "2 more copper gears" */
function partText(id: string, n: number, more = false): string {
  const name = (ITEM_BY_ID.get(id)?.name ?? id).toLowerCase();
  if (n === 1) return (more ? 'one more ' : /^[aeiou]/.test(name) ? 'an ' : 'a ') + name;
  return `${n} ${more ? 'more ' : ''}${name}s`;
}
const andList = (xs: string[]) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] ?? '');
/** the parts a restorable chamber takes, in words */
export function partsText(kind: ChamberKind): string {
  return andList((CHAMBER_BY_KIND.get(kind)?.restore?.parts ?? []).map(([id, n]) => partText(id, n)));
}

// ---------------- interaction ----------------
export function chamberAt(st: MineState, x: number, y: number): PlacedChamber | null {
  return st.chambers.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) ?? null;
}

/** Looking at a chamber's machine: the observation a research keystone reads. True when it's new. */
function observe(g: Game, c: PlacedChamber): boolean {
  const flag = 'observed:' + c.kind;
  if (g.flags.has(flag)) return false;
  g.flags.add(flag);
  g.toast(CHAMBER_BY_KIND.get(c.kind)!.learned, undefined, C.butter);
  g.emit({ t: 'sfx', id: 'chime', v: 0.7 });
  g.emit({ t: 'fx', kind: 'sparkle', x: c.x + c.w / 2, y: c.y - 0.5 });
  g.count('chambers_observed');
  return true;
}

/** Restore a chamber's machine with parts from the bag (F at it). */
export function restoreChamber(g: Game, kind: ChamberKind): 'done' | 'already' | 'missing' | 'none' {
  const d = CHAMBER_BY_KIND.get(kind);
  if (!d?.restore) return 'none';
  if (g.flags.has(d.restore.flag)) return 'already';
  const inv = g.player.inv;
  const missing = d.restore.parts.filter(([id, n]) => inv.countId(id) < n);
  if (missing.length) {
    const need = missing.map(([id, n]) => partText(id, n - inv.countId(id), inv.countId(id) > 0));
    // (the whole list again only when the bag already holds some of it)
    const none = missing.length === d.restore.parts.length && missing.every(([id]) => inv.countId(id) === 0);
    g.toast(`${cap(d.name)} needs ${andList(need)} to run again${none ? '' : ` (in all: ${partsText(kind)})`}.`);
    g.emit({ t: 'sfx', id: 'error' });
    return 'missing';
  }
  for (const [id, n] of d.restore.parts) inv.removeSpec(id, n);
  g.flags.add(d.restore.flag);
  g.flags.add('observed:' + kind);
  g.count('chambers_restored');
  g.toast(d.restore.done, undefined, C.butter);
  g.emit({ t: 'sfx', id: 'place' });
  g.emit({ t: 'sfx', id: 'chime', v: 0.8 });
  const st = mine(g);
  const c = st.map ? st.chambers.find((x) => x.kind === kind) : undefined;
  if (c) g.emit({ t: 'restored', ent: -1, x: c.x + c.w / 2, y: c.y });
  // the pump drains the pools at once (and on every level below 10 from now on)
  if (kind === 'pump' && st.map && st.floor > FLOOD_LEVEL) {
    const m = st.map;
    for (let i = 0; i < m.ground.length; i++) if (m.ground[i] === T.MINEWATER) m.setG(i % m.w, Math.floor(i / m.w), T.MINEFLOOR);
    g.emit({ t: 'sfx', id: 'splash' });
  }
  if (st.map) lightsFor(g, st);
  return 'done';
}

function chamberInteract(g: Game, c: PlacedChamber): boolean {
  const d = CHAMBER_BY_KIND.get(c.kind)!;
  const fresh = observe(g, c);
  if (!d.restore) {
    if (!fresh) g.toast(d.learned);
    return true;
  }
  if (g.flags.has(d.restore.flag)) {
    if (c.kind === 'lift') g.emit({ t: 'ui', open: 'elevator', arg: [1, ...liftLevels(g)] });
    else g.toast(d.restore.running);
    return true;
  }
  restoreChamber(g, c.kind);
  return true;
}

function galleryInteract(g: Game, st: MineState, x: number, y: number): boolean {
  const m = st.map!;
  const v = m.objData[m.idx(x, y)];
  if (galleryOpen(v)) {
    descend(g);
    return true;
  }
  if (v === 2) {
    g.toast(FLOOD_TEXT);
    g.emit({ t: 'sfx', id: 'splash' });
    return true;
  }
  const have = g.player.inv.countId('beam');
  if (have < BEAMS_TO_SHORE) {
    g.toast(`The gallery down has caved in. Shoring it up takes ${BEAMS_TO_SHORE} hardwood beams (you have ${have}): the sawmill cuts them from hardwood.`);
    g.emit({ t: 'sfx', id: 'error' });
    return true;
  }
  g.player.inv.removeSpec('beam', BEAMS_TO_SHORE);
  g.flags.add(DEEP_FLAGS.shored);
  m.setO(x, y, O.GALLERY, 1);
  g.toast(`You shore up the gallery with ${BEAMS_TO_SHORE} hardwood beams. The way down is open, for good.`, undefined, C.butter);
  g.emit({ t: 'restored', ent: -1, x: x + 0.5, y: y + 0.5 });
  g.emit({ t: 'fx', kind: 'dust', x: x + 0.5, y: y + 0.8 });
  g.emit({ t: 'sfx', id: 'place' });
  g.emit({ t: 'sfx', id: 'chime', v: 0.7 });
  return true;
}

function mineInteract(g: Game, tx: number, ty: number): boolean {
  const st = mine(g);
  const m = st.map;
  if (!m) return false;
  const o = m.o(tx, ty);
  switch (o) {
    case O.LADDER:
    case O.SHAFT:
      descend(g);
      return true;
    case O.MINE_EXIT:
      leave(g);
      return true;
    case O.TREASURE:
      return openTreasure(g, st, tx, ty);
    case O.ELEVATOR:
      enterPrompt(g);
      return true;
    case O.GALLERY:
      return galleryInteract(g, st, tx, ty);
    case O.CHAMBER: {
      const c = chamberAt(st, tx, ty);
      return c ? chamberInteract(g, c) : false;
    }
  }
  return false;
}

/** What F does on a Deepworks tile, for the key bubble (src/sim/prompts.ts). */
export function minePrompt(g: Game, tx: number, ty: number): { verb: string; x: number; y: number; hint?: string } | null {
  const st = mine(g);
  const m = st.map;
  if (!m || !m.inb(tx, ty)) return null;
  const top = (verb: string, lift = 0.1, hint?: string) => ({ verb, x: tx + 0.5, y: ty - lift, hint });
  switch (m.o(tx, ty)) {
    case O.LADDER: return top('Climb down');
    case O.SHAFT: return top('Jump down');
    case O.MINE_EXIT: return top('Leave the Deepworks');
    case O.TREASURE: return m.objData[m.idx(tx, ty)] === 2 ? null : top('Open');
    case O.ELEVATOR: return top(g.flags.has(DEEP_FLAGS.lift) ? 'Ride the lift' : 'Lift landing', 0.1, g.flags.has(DEEP_FLAGS.lift) ? undefined : 'dead until the old lift runs');
    case O.GALLERY: {
      const v = m.objData[m.idx(tx, ty)];
      if (v === 0) return top('Shore up', 0.3, `needs ${BEAMS_TO_SHORE} hardwood beams`);
      if (v === 2) return top('Flooded', 0.3, 'the town could drain it');
      return top('Climb down', 0.3);
    }
    case O.CHAMBER: {
      const c = chamberAt(st, tx, ty);
      if (!c) return null;
      const d = CHAMBER_BY_KIND.get(c.kind)!;
      const at = (verb: string, hint?: string) => ({ verb, x: c.x + c.w / 2, y: c.y - 1.6, hint });
      if (d.restore && !g.flags.has(d.restore.flag)) return at('Restore ' + d.name, 'needs ' + partsText(c.kind));
      if (c.kind === 'lift') return at('Ride the lift');
      return at(g.flags.has('observed:' + c.kind) ? 'Look' : 'Study');
    }
  }
  return null;
}

const GRAND_LOOT: Record<number, [string, number][]> = {
  10: [['copper_bar', 8], ['iron_bar', 3], ['geode', 4], ['sprinkler_2', 2]],
  20: [['gold_bar', 4], ['iron_bar', 6], ['geode', 6], ['super_tonic', 10], ['sword_3', 1]],
  30: [['starmetal_bar', 3], ['gold_bar', 8], ['starpetal_seed', 6], ['geode', 10], ['spark_coil', 4]],
};
/** what a small chest's ore is, by stratum */
const CHEST_ORE = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore', 'gold_ore', 'starmetal_ore'];

function openTreasure(g: Game, st: MineState, x: number, y: number): boolean {
  const m = st.map!;
  const i = m.idx(x, y);
  const kind = m.objData[i];
  if (kind === 2) {
    g.toast('Empty. Someone got here first. (You.)');
    return true;
  }
  const d = (id: string, n = 1) => { if (ITEM_BY_ID.has(id)) spawnDrop(g, key(id), n, x + 0.5, y + 0.6); };
  const floor = st.floor;
  if (kind === 1) {
    for (const [id, n] of GRAND_LOOT[floor] ?? [['geode', 5]]) d(id, n);
    const coins = floor * 60;
    g.player.money += coins;
    g.earned += coins;
    g.flags.add('treasure_' + floor);
    g.toast(`A grand treasure chest! +${coins} coins`, undefined, C.amber);
    g.emit({ t: 'sfx', id: 'quest' });
  } else {
    const roll = g.rng.next();
    if (roll < 0.35) d(CHEST_ORE[st.theme] ?? 'copper_ore', 4 + g.rng.int(0, 4));
    else if (roll < 0.6) d('geode', 2);
    else if (roll < 0.8) d('coal', 6);
    else d(g.rng.pick(['quartz', 'amethyst', 'topaz', 'jade']), 2);
    d('bread', 1);
    g.toast('A dusty old chest!');
  }
  m.objData[i] = 2;
  m.setO(x, y, O.TREASURE, 2);
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'fx', kind: 'sparkle', x: x + 0.5, y: y + 0.5 });
  g.count('treasures');
  return true;
}

/** Can the ladder turn up under a broken rock here? (Not where a works problem or a wisp keeps the way.) */
const ladderByRocks = (st: MineState) => st.floor < MAX_FLOOR && st.floor !== GALLERY_LEVEL && st.floor !== FLOOD_LEVEL && !st.wispLadder;

function rockDrops(g: Game, st: MineState, x: number, y: number, o: O, data: number) {
  const floor = st.floor, S = STRATA[st.theme];
  const d = (id: string, n = 1) => spawnDrop(g, key(id), n, x + 0.5, y + 0.5);
  const lvl = g.player.skills.mining ?? 0;
  if (o === O.ROCK || o === O.ICE_ROCK) {
    d('stone', 1 + (g.rng.next() < 0.3 ? 1 : 0));
    for (const [id, p] of S.extra) if (g.rng.next() < p) d(id);
    const exc = g.hasPerk('excavator') ? 2 : 1;
    if (g.rng.next() < (0.03 + floor * 0.002) * exc) d('geode');
    if (o === O.ICE_ROCK && g.rng.next() < (st.theme === 2 ? 0.35 : 0.15)) d('frost_shard');
    if (g.rng.next() < 0.015 * exc) d(g.rng.pick(['old_cog', 'fossil_shell', 'clay_whistle', 'star_chart']));
  } else if (o === O.ORE_ROCK) {
    // the old pump keeps the Frost and Ember galleries dry: their ore comes out cleaner
    const pumped = g.flags.has(DEEP_FLAGS.pump) && (st.theme === 2 || st.theme === 3) ? 1 : 0;
    d(ORE_TYPES[data] ?? 'copper_ore', 1 + g.rng.int(0, 2) + (g.rng.next() < lvl * 0.05 ? 1 : 0) + (g.rng.next() < g.buffLvl('mining') * 0.08 ? 1 : 0) + (g.hasPerk('miner') ? 1 : 0) + pumped);
  } else if (o === O.GEM_ROCK) {
    const gems = ['amethyst', 'topaz', 'jade', 'ruby', 'sapphire', 'opal', 'starstone'];
    d(gems[data] ?? 'quartz');
    if (g.rng.next() < 0.3) d('quartz');
  }
  g.addXp('mining', o === O.ORE_ROCK ? 4 + Math.floor(floor / 5) : o === O.GEM_ROCK ? 12 : 1);
  st.broken++;
  if (st.ladder || !ladderByRocks(st)) return false;
  // the ladder: under the rock that hides it, or by luck (likelier with every rock), or the last few
  const m = st.map!;
  const i = m.idx(x, y);
  let rocksLeft = 0;
  for (const v of m.obj) if (isRock(v)) rocksLeft++;
  const [p0, dp] = S.ladder;
  if (i === st.hidden || g.rng.next() < p0 + dp * (st.broken - 1) || rocksLeft < 8) {
    m.setO(x, y, O.LADDER);
    st.ladder = [x, y];
    g.emit({ t: 'sfx', id: 'chime' });
    g.toast('You found the ladder down!');
    return true;
  }
  return false;
}

function mineTool(g: Game, kind: string, tier: number, tx: number, ty: number) {
  const st = mine(g);
  // a faint (or the day ending) can carry you out between a swing and its hit
  if (!st.map || g.player.where !== 'mine') return;
  const m = st.map;
  if (kind === 'pick') {
    // a pest in the way takes the hit: the pickaxe deals with pests too (combat is optional)
    const p = g.player;
    if (hitPest(g, st, tx + 0.5, ty + 0.5, 0.95, [0, 1, 0, -1][p.dir], [-1, 0, 1, 0][p.dir])) return;
    const o = m.o(tx, ty);
    if (isRock(o)) {
      const i = m.idx(tx, ty);
      const hard = 1 + Math.floor((st.floor * 2) / 15);
      const hp = (o === O.ROCK || o === O.ICE_ROCK ? 2 : o === O.ORE_ROCK ? 4 : 6) * hard;
      const hits = (st.rockHits.get(i) ?? 0) + TOOL_POWER[tier] * 1.4;
      g.emit({ t: 'fx', kind: 'rock', x: tx + 0.5, y: ty + 0.5 });
      g.emit({ t: 'sfx', id: 'pick' });
      if (hits >= hp) {
        st.rockHits.delete(i);
        const data = m.objData[i];
        m.setO(tx, ty, O.NONE);
        if (!rockDrops(g, st, tx, ty, o, data)) g.emit({ t: 'sfx', id: 'rockbreak' });
      } else st.rockHits.set(i, hits);
    } else g.emit({ t: 'sfx', id: 'thud' });
  } else if (kind === 'hoe') {
    if (g.rng.next() < 0.2 && m.g(tx, ty) === T.MINEFLOOR && !m.o(tx, ty)) {
      spawnDrop(g, key(g.rng.next() < 0.5 ? 'clay' : 'stone'), 1, tx + 0.5, ty + 0.5);
    }
    g.emit({ t: 'sfx', id: 'dig' });
  }
}

// ---------------- pests ----------------
/** One hit on the pest nearest (cx, cy) within reach. True when a pest took it. */
function hitPest(g: Game, st: MineState, cx: number, cy: number, reach: number, fx: number, fy: number): boolean {
  let best: Monster | null = null, bd = reach;
  for (const mo of st.monsters) {
    if (mo.def.behavior === 'block' && mo.state === 2) continue;
    const d = Math.hypot(mo.x - cx, mo.y - 0.3 - cy);
    if (d < bd) [best, bd] = [mo, d];
  }
  if (!best) return false;
  strike(g, st, best, fx, fy);
  return true;
}

function strike(g: Game, st: MineState, mo: Monster, fx: number, fy: number) {
  // the Brute perk hits harder: a clatter-crab gives way in two
  const dmg = g.hasPerk('brute') ? 1.5 : 1;
  mo.hp -= dmg;
  mo.hurt = 0.25;
  if (mo.def.behavior === 'mite') {
    mo.vx = fx * 5;
    mo.vy = fy * 5;
  }
  g.emit({ t: 'fx', kind: 'hit', x: mo.x, y: mo.y - 0.5, n: 6 });
  g.emit({ t: 'sfx', id: mo.def.behavior === 'block' ? 'clang' : 'hit' });
  if (mo.def.behavior === 'block' && mo.hp > 0) {
    const left = Math.ceil(mo.hp / dmg);
    g.emit({ t: 'float', text: left === 1 ? 'one more!' : `${left} more`, x: mo.x, y: mo.y - 1.4, c: C.cream });
  }
  if (mo.hp <= 0) defeatPest(g, st, mo);
}

function defeatPest(g: Game, st: MineState, mo: Monster) {
  for (const d of mo.def.drops) if (g.rng.next() < d.chance * (g.hasPerk('scavenger') ? 1.5 : 1)) spawnDrop(g, key(d.item), d.n ? g.rng.int(d.n[0], d.n[1]) : 1, mo.x, mo.y);
  // a squashed mite gives back the ore it ate
  for (const a of mo.ate) spawnDrop(g, a.k, a.n, mo.x, mo.y);
  mo.ate = [];
  g.addXp('combat', mo.def.xp);
  g.count('monsters');
  g.count('slain_' + mo.id);
  const held = g.player.inv.slots[g.player.sel];
  if (held && kDef(held.k).id === 'sword_0' && st.floor >= 25) g.sys.achUnlock?.(g, 'club');
  g.emit({ t: 'sfx', id: 'monster_die' });
  g.emit({ t: 'fx', kind: 'magic', x: mo.x, y: mo.y - 0.3, n: 14 });
  if (mo.def.behavior === 'block') {
    // the crab gives up its gallery and scuttles off
    mo.state = 2;
    mo.cool = 1;
    mo.aim = Math.atan2(mo.y - g.player.y, mo.x - g.player.x);
    if (!st.told.has('crab')) {
      st.told.add('crab');
      g.toast('The clatter-crab scuttles off and the gallery is clear.');
    }
    return;
  }
  const i = st.monsters.indexOf(mo);
  if (i >= 0) st.monsters.splice(i, 1);
  if (mo.def.behavior === 'guard') revealWispLadder(g, st);
}

function revealWispLadder(g: Game, st: MineState) {
  const at = st.wispLadder;
  const m = st.map;
  if (!at || !m || st.ladder) return;
  m.setO(at[0], at[1], O.LADDER);
  st.ladder = [at[0], at[1]];
  // (standing on it already: a moment to see it before you drop)
  g.sys.ladderCool = Math.max(g.sys.ladderCool ?? 0, 1.2);
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'fx', kind: 'sparkle', x: at[0] + 0.5, y: at[1] + 0.5, c: C.aqua });
  g.toast('The wisp pops, and the ladder it was hiding shimmers into view!', undefined, C.aqua);
}

function attack(g: Game, tx: number, ty: number, w: { dmg: number; speed: number; knock: number }) {
  const st = mine(g);
  if (g.player.where !== 'mine' || !st.map) return;
  const p = g.player;
  const fx = [0, 1, 0, -1][p.dir], fy = [-1, 0, 1, 0][p.dir];
  const cx = p.x + fx * 0.9, cy = p.y - 0.3 + fy * 0.9;
  for (const mo of [...st.monsters]) {
    if (mo.def.behavior === 'block' && mo.state === 2) continue;
    if (Math.hypot(mo.x - cx, mo.y - 0.3 - cy) > 1.2) continue;
    strike(g, st, mo, fx, fy);
  }
  void tx;
  void ty;
  void w;
}

/** can a walking pest stand at (x, y)? */
function pestCanStand(st: MineState, x: number, y: number): boolean {
  const m = st.map!;
  const tx = Math.floor(x), ty = Math.floor(y);
  if (m.g(tx, ty) !== T.MINEFLOOR) return false;
  const o = m.o(tx, ty);
  if (SOLID_OBJ.has(o)) return false;
  return !(o === O.GALLERY && galleryShut(m.objData[m.idx(tx, ty)]));
}

function movePest(st: MineState, mo: Monster, dx: number, dy: number): boolean {
  let moved = false;
  if (pestCanStand(st, mo.x + dx, mo.y)) { mo.x += dx; moved = true; } else mo.vx = -mo.vx * 0.5;
  if (pestCanStand(st, mo.x, mo.y + dy)) { mo.y += dy; moved = true; } else mo.vy = -mo.vy * 0.5;
  return moved;
}

/** ore the player isn't next to (a mite leaves alone what's being picked up) */
function unattended(g: Game, d: Drop) {
  return Math.hypot(d.x - g.player.x, d.y - g.player.y) > 2.5;
}
const isOreDrop = (d: Drop) => { const def = kDef(d.k); return def.cat === 'ore' || def.id === 'coal'; };

function tickMite(g: Game, st: MineState, mo: Monster, dt: number) {
  if (mo.state === 2) {
    if (mo.cool <= 0) {
      mo.state = 0;
      mo.cool = 1;
    }
    return;
  }
  const drops = dropsState(g).list;
  if (mo.target && (!drops.includes(mo.target) || !unattended(g, mo.target))) mo.target = null;
  // it looks about for ore left lying around twice a second
  if (!mo.target && Math.floor(mo.t * 2) !== Math.floor((mo.t - dt) * 2)) {
    let best: Drop | null = null, bd = 6;
    for (const d of drops) {
      if (d.map !== 'mine' || d.t < 0.6 || !isOreDrop(d) || !unattended(g, d)) continue;
      const dd = Math.hypot(d.x - mo.x, d.y - mo.y);
      if (dd < bd) [best, bd] = [d, dd];
    }
    mo.target = best;
    mo.state = best ? 1 : 0;
  }
  const sp = mo.def.speed;
  if (mo.target) {
    const d = mo.target, dx = d.x - mo.x, dy = d.y - mo.y, dist = Math.hypot(dx, dy);
    if (dist < 0.4) {
      drops.splice(drops.indexOf(d), 1);
      mo.ate.push({ k: d.k, n: d.n });
      mo.target = null;
      mo.state = 2;
      mo.cool = 0.8;
      g.emit({ t: 'sfx', id: 'bite', x: mo.x, y: mo.y, v: 0.7 });
      g.emit({ t: 'fx', kind: 'dust', x: mo.x, y: mo.y, n: 4 });
      if (!st.told.has('mite')) {
        st.told.add('mite');
        g.toast('A rust-mite is eating the ore you left on the floor! Squash it to get the ore back.', undefined, C.copper);
      }
      return;
    }
    mo.face = dx < 0 ? -1 : 1;
    if (!movePest(st, mo, (dx / dist) * sp * dt, (dy / dist) * sp * dt)) mo.target = null;
    return;
  }
  // amble: a slow walk with a new heading every couple of seconds, and the odd pause
  if (mo.cool <= 0) {
    mo.cool = 1.5 + g.rng.next() * 1.5;
    mo.aim = g.rng.next() < 0.3 ? NaN : g.rng.next() * Math.PI * 2;
  }
  if (!Number.isNaN(mo.aim)) {
    const dx = Math.cos(mo.aim) * sp * 0.35 * dt, dy = Math.sin(mo.aim) * sp * 0.35 * dt;
    if (Math.abs(dx) > 1e-4) mo.face = dx < 0 ? -1 : 1;
    if (!movePest(st, mo, dx, dy)) mo.aim += Math.PI / 2;
  }
}

function tickPests(g: Game, st: MineState, dt: number) {
  const list = st.monsters;
  for (let i = list.length - 1; i >= 0; i--) {
    const mo = list[i];
    if (!mo) continue;
    mo.t += dt;
    mo.hurt = Math.max(0, mo.hurt - dt);
    mo.cool -= dt;
    // knockback
    if (mo.def.behavior === 'mite' && Math.abs(mo.vx) + Math.abs(mo.vy) > 0.05) {
      movePest(st, mo, mo.vx * dt, mo.vy * dt);
      mo.vx *= Math.pow(0.02, dt);
      mo.vy *= Math.pow(0.02, dt);
    }
    switch (mo.def.behavior) {
      case 'mite':
        tickMite(g, st, mo, dt);
        break;
      case 'block':
        if (mo.state === 2) {
          const sp = mo.def.speed * dt;
          if (!movePest(st, mo, Math.cos(mo.aim) * sp, Math.sin(mo.aim) * sp)) mo.aim += 0.9;
          mo.face = Math.cos(mo.aim) < 0 ? -1 : 1;
          if (mo.cool <= 0) list.splice(i, 1);
        }
        break;
      case 'guard': {
        // a wisp drifts in slow loops over the ladder it hides
        const [hx, hy] = mo.home!;
        const a = mo.t * 1.2 + mo.phase;
        const nx = hx + 0.5 + Math.cos(a) * 1.15, ny = hy + 0.6 + Math.sin(a) * 0.7;
        mo.face = nx < mo.x ? -1 : 1;
        mo.x = nx;
        mo.y = ny;
        mo.z = 6 + Math.sin(mo.t * 3) * 2;
        break;
      }
    }
  }
}

// ---------------- hazards ----------------
function hurtPlayer(g: Game, dmg: number, fromX: number, fromY: number) {
  const p = g.player;
  if (p.invuln > 0) return;
  // the combat skill, the Warrior perk and a defense buff soften the blow
  const def = (1 - Math.min(0.5, (p.skills.combat ?? 0) * 0.03)) * (g.hasPerk('warrior') ? 0.75 : 1) * (1 - 0.12 * g.buffLvl('defense'));
  const n = Math.max(1, Math.round(dmg * def));
  p.hp -= n;
  p.invuln = 1;
  const dx = p.x - fromX, dy = p.y - fromY, d = Math.hypot(dx, dy) || 1;
  p.kx = (dx / d) * 7;
  p.ky = (dy / d) * 7;
  g.emit({ t: 'sfx', id: 'hurt' });
  g.emit({ t: 'shake', amt: 0.3 });
  g.emit({ t: 'float', text: `-${n}`, x: p.x, y: p.y - 1.8, c: C.rose });
  if (p.hp <= 0) faint(g);
}

function faint(g: Game) {
  const p = g.player;
  const lost = Math.min(800, Math.floor(p.money * 0.1));
  p.money -= lost;
  leave(g);
  const [cx, cy] = g.map.loc('clinic');
  p.x = cx + 0.5;
  p.y = cy + 1;
  p.hp = Math.round(p.maxHp * 0.5);
  p.energy = Math.max(10, p.energy * 0.5);
  g.time.min = Math.min(1500, g.time.min + 120);
  g.emit({ t: 'ui', open: 'message', arg: { title: 'Valley Clinic', text: `You collapsed in the Deepworks and were carried to the clinic. Dr. Marrow patched you up. (Bill: ${lost} coins)` } });
}

/** does the player stand on (or over) a tile? */
function onTile(g: Game, x: number, y: number, r = 0.8) {
  return Math.abs(g.player.x - (x + 0.5)) < r && Math.abs(g.player.y - 0.2 - (y + 0.5)) < r;
}

function tickHazards(g: Game, st: MineState, dt: number) {
  if (!st.hazards.length) return;
  const m = st.map!, p = g.player;
  const ptx = Math.floor(p.x), pty = Math.floor(p.y - 0.2);
  let changed = false;
  for (const h of st.hazards) {
    if (h.state === 2) continue;
    if (h.kind === 'crack') {
      if (h.state === 0 && Math.hypot(p.x - (h.x + 0.5), p.y - (h.y + 0.5)) < 2) {
        // the ceiling over this group groans: a rumble, then the rocks come down
        for (const k of st.hazards) if (k.kind === 'crack' && k.group === h.group && k.state === 0) { k.state = 1; k.t = CRACK_FUSE; g.emit({ t: 'fx', kind: 'dust', x: k.x + 0.5, y: k.y + 0.3, n: 4 }); }
        g.emit({ t: 'sfx', id: 'thunder', v: 0.35 });
        g.emit({ t: 'shake', amt: 0.12 });
        if (!st.told.has('crack')) {
          st.told.add('crack');
          g.toast('The cracked ceiling rumbles! Step clear of the cracks.', undefined, C.apricot);
        }
      } else if (h.state === 1) {
        h.t -= dt;
        if (h.t > 0) continue;
        h.state = 2;
        changed = true;
        g.emit({ t: 'fx', kind: 'rock', x: h.x + 0.5, y: h.y + 0.5, n: 10 });
        g.emit({ t: 'sfx', id: 'rockbreak', x: h.x, y: h.y });
        if (onTile(g, h.x, h.y)) {
          hurtPlayer(g, 6, h.x + 0.5, h.y + 0.5);
          if (!st.map || g.player.where !== 'mine') return;
        } else if (m.obj[m.idx(h.x, h.y)] === O.NONE) m.setO(h.x, h.y, O.ROCK, 0);
      }
    } else if (h.kind === 'gas') {
      if (h.state !== 0 || ptx !== h.x || pty !== h.y) continue;
      if (g.research.done.has('r_spark')) {
        // the spark-coil lantern burns the pocket off
        for (const k of st.hazards) if (k.kind === 'gas' && k.group === h.group) { k.state = 2; g.emit({ t: 'fx', kind: 'sparkle', x: k.x + 0.5, y: k.y + 0.5, c: C.amber }); }
        g.emit({ t: 'sfx', id: 'switch_on', v: 0.6 });
        changed = true;
        if (!st.told.has('gas')) {
          st.told.add('gas');
          g.toast('Your spark-coil lantern burns the firedamp off harmlessly.', undefined, C.amber);
        }
      } else {
        const up = st.floor - 1;
        g.toast(`Firedamp! The gas puffs you back up to level ${up}. (A spark-coil lantern burns it off: research Spark Coils.)`, undefined, C.rose);
        g.emit({ t: 'sfx', id: 'thud' });
        enterFloor(g, up);
        return;
      }
    } else if (h.kind === 'shard') {
      h.t -= dt;
      if (h.t > 0) continue;
      if (h.state === 0) {
        h.state = 1;
        h.t = SHARD_WARN;
        g.emit({ t: 'sfx', id: 'cast', x: h.x, y: h.y, v: 0.5 });
        continue;
      }
      // the shard lands: it hurts, and it leaves starmetal behind
      h.state = 2;
      changed = true;
      g.emit({ t: 'fx', kind: 'magic', x: h.x + 0.5, y: h.y + 0.5, n: 12 });
      g.emit({ t: 'sfx', id: 'rockbreak', x: h.x, y: h.y });
      g.emit({ t: 'shake', amt: 0.1 });
      const hit = onTile(g, h.x, h.y, 0.9);
      if (!hit && m.obj[m.idx(h.x, h.y)] === O.NONE) m.setO(h.x, h.y, O.ORE_ROCK, 5);
      if (hit) {
        hurtPlayer(g, 10, h.x + 0.5, h.y + 0.5);
        if (!st.map || g.player.where !== 'mine') return;
      }
    }
  }
  if (changed) {
    st.hazards = st.hazards.filter((h) => h.state !== 2);
    lightsFor(g, st);
  }
}

function tickMine(g: Game, dt: number) {
  const st = mine(g);
  const m = st.map;
  if (!m) return;
  const p = g.player;
  // looking at a chamber's machine: walking within 3 tiles of it is enough
  for (const c of st.chambers) {
    if (g.flags.has('observed:' + c.kind)) continue;
    const nx = Math.max(c.x, Math.min(c.x + c.w, p.x));
    if (Math.hypot(p.x - nx, p.y - (c.y + 0.6)) <= 3) observe(g, c);
  }
  tickPests(g, st, dt);
  tickHazards(g, st, dt);
  if (st.map !== m || g.player.where !== 'mine') return;
  dynLights(st);
  // step onto a ladder (or an open gallery) and you go down
  const tx = Math.floor(p.x), ty = Math.floor(p.y - 0.2);
  const o = m.o(tx, ty);
  const down = o === O.LADDER || (o === O.GALLERY && galleryOpen(m.objData[m.idx(tx, ty)]));
  if (down && (g.sys.ladderCool ?? 0) <= 0) {
    g.sys.ladderCool = 1;
    descend(g);
    return;
  }
  g.sys.ladderCool = Math.max(0, (g.sys.ladderCool ?? 0) - dt);
}

registerSystem({
  name: 'mine',
  realtime: true,
  tick(g, dt) {
    if (g.player.where === 'mine') tickMine(g, dt);
  },
  dayStart(g) {
    const st = mine(g);
    if (g.player.where === 'mine') {
      // you always wake up at home
      st.map = null;
      st.monsters = [];
      st.hazards = [];
      st.chambers = [];
      g.player.where = 'world';
    }
  },
  save(g) {
    return { deepest: mine(g).deepest };
  },
  load(g, d) {
    // (old saves' 60 floors are halved by the save migration; anything deeper is the bottom)
    mine(g).deepest = Math.min(MAX_FLOOR, d?.deepest ?? 0);
  },
});

export { MONSTERS };
