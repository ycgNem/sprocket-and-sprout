// The Old Mine: 60 procedural floors (earth, frost, ember), ores, gems, hidden ladders,
// elevators every 5 floors, monsters with simple AI, sword combat.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { MONSTERS, MONSTER_BY_ID } from '../../data/creatures';
import type { MonsterDef } from '../../data/types';
import { Rng } from '../../engine/rng';
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';
import { O, T, TileMap, Z } from '../world/tilemap';
import { spawnDrop } from './drops';
import { TOOL_POWER } from '../actions';

export const MAX_FLOOR = 60;
const MW = 48, MH = 40;

export interface Monster {
  id: string;
  def: MonsterDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  hp: number;
  maxHp: number;
  hurt: number;
  phase: number;
  t: number;
  state: number;
  cool: number;
}

export interface Bolt { x: number; y: number; vx: number; vy: number; t: number; dmg: number }

export interface MineState {
  floor: number;
  map: TileMap | null;
  theme: number;
  monsters: Monster[];
  bolts: Bolt[];
  lights: { x: number; y: number; r: number; i: number; c?: number; flicker?: boolean }[];
  deepest: number;
  ladder: [number, number] | null;
  hidden: number;
  /** monsters swarm this floor: the ladder appears once they are all defeated */
  infested: boolean;
  rockHits: Map<number, number>;
  // api
  solid: (g: Game, x: number, y: number) => boolean;
  useTool: (g: Game, kind: string, tier: number, tx: number, ty: number) => void;
  attack: (g: Game, tx: number, ty: number, w: { dmg: number; speed: number; knock: number }) => void;
  interact: (g: Game, tx: number, ty: number) => boolean;
  enterPrompt: (g: Game) => void;
  enter: (g: Game, floor: number) => void;
  leave: (g: Game) => void;
  debugDescend: (g: Game, n: number) => void;
}

export function mine(g: Game): MineState {
  if (!g.sys.mine) {
    g.sys.mine = {
      floor: 0, map: null, theme: 0, monsters: [], bolts: [], lights: [], deepest: 0, ladder: null, hidden: -1, infested: false, rockHits: new Map(),
      solid: mineSolid, useTool: mineTool, attack, interact: mineInteract, enterPrompt, enter: enterFloor, leave, debugDescend,
    } as MineState;
  }
  return g.sys.mine;
}

export function themeOf(floor: number) {
  return floor >= 40 ? 2 : floor >= 20 ? 1 : 0;
}

function mineSolid(g: Game, x: number, y: number): boolean {
  void g;
  void x;
  void y;
  return false;
}

// ---------------- generation ----------------
function generateFloor(g: Game, floor: number): { map: TileMap; entry: [number, number]; hidden: number; monsters: Monster[]; infested: boolean } {
  const rng = new Rng(g.seed * 31 + floor * 977 + g.dayIndex * 13);
  const m = new TileMap(MW, MH);
  const theme = themeOf(floor);
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
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
  const open: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const isOpen = !cells[i] && region[i] === best;
    m.ground[i] = isOpen ? T.MINEFLOOR : T.MINEWALL;
    if (isOpen) open.push(i);
  }
  // pools
  if (floor % 3 === 1 || theme === 2) {
    const c = rng.pick(open);
    const cx = c % MW, cy = Math.floor(c / MW);
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        if (!m.inb(x, y) || m.ground[m.idx(x, y)] !== T.MINEFLOOR) continue;
        if (((x - cx) / 4) ** 2 + ((y - cy) / 3) ** 2 + (rng.next() - 0.5) * 0.3 < 1) m.ground[m.idx(x, y)] = theme === 2 && floor >= 45 ? T.LAVA : T.MINEWATER;
      }
  }
  // entry: a floor tile far from the pool, with space
  const floors = open.filter((i) => m.ground[i] === T.MINEFLOOR);
  const entryI = floors[Math.floor(rng.next() * floors.length)];
  const entry: [number, number] = [entryI % MW, Math.floor(entryI / MW)];
  // rocks & ores
  const ores = (): [number, number][] => {
    // [ore type index (ORE_TYPES), weight]
    const w: [number, number][] = [[0, floor < 20 ? 6 : 1], [1, floor < 25 ? 4 : 1], [4, 3]];
    if (floor >= 8) w.push([2, floor < 40 ? 5 : 3]);
    if (floor >= 25) w.push([3, floor >= 40 ? 5 : 2]);
    if (floor >= 45) w.push([5, 2]);
    return w;
  };
  const oreW = ores();
  const rocks: number[] = [];
  for (const i of floors) {
    const x = i % MW, y = Math.floor(i / MW);
    if (Math.abs(x - entry[0]) + Math.abs(y - entry[1]) < 3) continue;
    const r = rng.next();
    if (r < 0.2) {
      m.obj[i] = theme === 1 && rng.next() < 0.4 ? O.ICE_ROCK : O.ROCK;
      rocks.push(i);
    } else if (r < 0.255) {
      m.obj[i] = O.ORE_ROCK;
      m.objData[i] = rng.weighted(oreW, (o) => o[1])[0];
      rocks.push(i);
    } else if (r < 0.262) {
      m.obj[i] = O.GEM_ROCK;
      m.objData[i] = Math.min(6, Math.floor(rng.next() * (2 + floor / 10)));
      rocks.push(i);
    } else if (r < 0.28) m.obj[i] = theme === 2 ? O.CRYSTAL : O.STALAGMITE;
  }
  m.obj[entryI] = O.MINE_EXIT;
  // elevator floors get an elevator near the entry
  if (floor % 5 === 0) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [2, 0]]) {
      const ex = entry[0] + dx, ey = entry[1] + dy;
      if (m.g(ex, ey) === T.MINEFLOOR) {
        m.obj[m.idx(ex, ey)] = O.ELEVATOR;
        m.objData[m.idx(ex, ey)] = 0;
        break;
      }
    }
  }
  const infested = floor > 6 && floor % 5 !== 0 && floor < MAX_FLOOR && rng.next() < 0.1;
  const hidden = floor >= MAX_FLOOR || infested ? -1 : rocks.length ? rng.pick(rocks) : -1;
  // monsters
  const monsters: Monster[] = [];
  const pool = MONSTERS.filter((d) => floor >= d.floors[0] && floor <= d.floors[1]);
  const count = Math.min(infested ? 26 : 16, (3 + Math.floor(floor / 5)) * (infested ? 2 : 1));
  for (let n = 0; n < count && pool.length; n++) {
    const i = rng.pick(floors);
    const x = i % MW, y = Math.floor(i / MW);
    if (Math.abs(x - entry[0]) + Math.abs(y - entry[1]) < 8 || m.obj[i]) continue;
    const def = rng.pick(pool);
    const hp = Math.round(def.hp * (1 + (floor - def.floors[0]) * 0.02));
    monsters.push({ id: def.id, def, x: x + 0.5, y: y + 0.7, vx: 0, vy: 0, z: 0, hp, maxHp: hp, hurt: 0, phase: rng.next() * 4, t: rng.next() * 2, state: 0, cool: 1 });
  }
  // the bottom floor holds a starstone treasure
  if (floor === MAX_FLOOR) {
    const i = rng.pick(floors.filter((f) => Math.abs((f % MW) - entry[0]) > 6));
    m.obj[i] = O.GEM_ROCK;
    m.objData[i] = 6;
  }
  // treasure: a grand chest every tenth floor (once), and now and then a small one
  const far = floors.filter((f) => Math.abs((f % MW) - entry[0]) + Math.abs(Math.floor(f / MW) - entry[1]) > 10 && !m.obj[f]);
  if (far.length) {
    if (floor % 10 === 0 && floor < MAX_FLOOR && !g.flags.has('treasure_' + floor)) {
      const i = rng.pick(far);
      m.obj[i] = O.TREASURE;
      m.objData[i] = 1;
    } else if (rng.next() < 0.06) {
      const i = rng.pick(far);
      m.obj[i] = O.TREASURE;
      m.objData[i] = 0;
    }
  }
  for (let i = 0; i < m.deco.length; i++) m.deco[i] = Math.floor(rng.next() * 256);
  return { map: m, entry, hidden, monsters, infested };
}

function lightsFor(st: MineState) {
  const m = st.map!;
  st.lights = [];
  for (let i = 0; i < m.obj.length; i++) {
    if (m.obj[i] === O.CRYSTAL) st.lights.push({ x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.4, r: 2.5, i: 0.8, c: 31 });
    if (m.ground[i] === T.LAVA && i % 3 === 0) st.lights.push({ x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5, r: 2, i: 0.7, c: 6, flicker: true });
  }
}

export function enterFloor(g: Game, floor: number) {
  const st = mine(g);
  floor = Math.max(1, Math.min(MAX_FLOOR, floor));
  const gen = generateFloor(g, floor);
  st.floor = floor;
  st.map = gen.map;
  st.theme = themeOf(floor);
  st.monsters = gen.monsters;
  st.bolts = [];
  st.hidden = gen.hidden;
  st.infested = gen.infested;
  st.ladder = null;
  st.rockHits.clear();
  lightsFor(st);
  g.player.where = 'mine';
  g.player.x = gen.entry[0] + 0.5;
  g.player.y = gen.entry[1] + 1.4;
  if (st.map.g(gen.entry[0], gen.entry[1] + 1) !== T.MINEFLOOR) g.player.y = gen.entry[1] + 0.9;
  if (floor > st.deepest) {
    st.deepest = floor;
    g.sys.quests?.notify?.(g, 'floor', floor);
  }
  if (floor % 5 === 0 && !g.flags.has('elev_' + floor)) {
    g.flags.add('elev_' + floor);
    g.toast(`Floor ${floor}: the old lift works here! You can ride down to this floor from the entrance.`);
  }
  if (st.infested) g.toast('Monsters swarm this floor! Defeat them all to find the way down.', undefined, C.rose);
  g.emit({ t: 'sfx', id: 'door' });
  g.emit({ t: 'ui', open: 'fade' });
}

function leave(g: Game) {
  const st = mine(g);
  st.map = null;
  st.monsters = [];
  g.player.where = 'world';
  const [x, y] = g.map.loc('mine_entrance');
  g.player.x = x + 0.5;
  g.player.y = y + 0.9;
  g.player.dir = 2;
  g.emit({ t: 'sfx', id: 'door' });
}

function enterPrompt(g: Game) {
  const floors = [1];
  for (let f = 5; f <= MAX_FLOOR; f += 5) if (g.flags.has('elev_' + f)) floors.push(f);
  g.emit({ t: 'ui', open: 'elevator', arg: floors });
}

function debugDescend(g: Game, n: number) {
  const st = mine(g);
  enterFloor(g, (g.player.where === 'mine' ? st.floor : 0) + n);
}

// ---------------- interaction ----------------
function mineInteract(g: Game, tx: number, ty: number): boolean {
  const st = mine(g);
  const m = st.map!;
  const o = m.o(tx, ty);
  if (o === O.LADDER) {
    enterFloor(g, st.floor + 1);
    return true;
  }
  if (o === O.SHAFT) {
    const drop = 3 + Math.floor(g.rng.next() * 5);
    g.player.hp = Math.max(1, g.player.hp - 10);
    g.toast(`You tumble down ${drop} floors!`);
    enterFloor(g, Math.min(MAX_FLOOR, st.floor + drop));
    return true;
  }
  if (o === O.MINE_EXIT) {
    leave(g);
    return true;
  }
  if (o === O.TREASURE) return openTreasure(g, st, tx, ty);
  if (o === O.ELEVATOR) {
    enterPrompt(g);
    return true;
  }
  return false;
}

function revealLadderNear(g: Game, st: MineState) {
  const m = st.map!;
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  for (let r = 2; r < 12; r++)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = Math.round(px + Math.cos(a) * r), y = Math.round(py + Math.sin(a) * r);
      if (m.g(x, y) !== T.MINEFLOOR || m.o(x, y)) continue;
      m.setO(x, y, O.LADDER);
      st.ladder = [x, y];
      g.emit({ t: 'sfx', id: 'chime' });
      g.toast('The floor falls quiet... a ladder is revealed!');
      return;
    }
}

const GRAND_LOOT: Record<number, [string, number][]> = {
  10: [['copper_bar', 8], ['geode', 4], ['sprinkler_2', 2]],
  20: [['iron_bar', 6], ['geode', 5], ['super_tonic', 10]],
  30: [['gold_bar', 4], ['sword_3', 1], ['geode', 6]],
  40: [['gold_bar', 8], ['starpetal_seed', 6], ['geode', 8]],
  50: [['starmetal_bar', 3], ['geode', 10], ['spark_coil', 4]],
};

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
    const ores = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore'];
    const ore = ores[Math.min(3, Math.floor(floor / 15))];
    const roll = g.rng.next();
    if (roll < 0.35) d(ore, 4 + g.rng.int(0, 4));
    else if (roll < 0.6) d('geode', 2);
    else if (roll < 0.8) d('coal', 6);
    else d(g.rng.pick(['quartz', 'amethyst', 'topaz', 'jade']), 2);
    d('bread', 1);
    g.toast('A dusty old chest!');
  }
  m.objData[i] = 2;
  m.setO(x, y, O.TREASURE);
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({ t: 'fx', kind: 'sparkle', x: x + 0.5, y: y + 0.5 });
  g.count('treasures');
  return true;
}

function rockDrops(g: Game, st: MineState, x: number, y: number, o: O, data: number) {
  const floor = st.floor;
  const d = (id: string, n = 1) => spawnDrop(g, key(id), n, x + 0.5, y + 0.5);
  const lvl = g.player.skills.mining ?? 0;
  if (o === O.ROCK || o === O.ICE_ROCK) {
    d('stone', 1 + (g.rng.next() < 0.3 ? 1 : 0));
    if (g.rng.next() < 0.08) d('coal');
    const exc = g.hasPerk('excavator') ? 2 : 1;
    if (g.rng.next() < (0.03 + floor * 0.001) * exc) d('geode');
    if (o === O.ICE_ROCK && g.rng.next() < 0.15) d('frost_shard');
    if (g.rng.next() < 0.015 * exc) d(g.rng.pick(['old_cog', 'fossil_shell', 'clay_whistle', 'star_chart']));
    if (g.rng.next() < 0.04) d('clay');
  } else if (o === O.ORE_ROCK) {
    const ores = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore', 'coal', 'starmetal_ore'];
    d(ores[data] ?? 'copper_ore', 1 + g.rng.int(0, 2) + (g.rng.next() < lvl * 0.05 ? 1 : 0) + (g.rng.next() < g.buffLvl('mining') * 0.08 ? 1 : 0) + (g.hasPerk('miner') ? 1 : 0));
  } else if (o === O.GEM_ROCK) {
    const gems = ['amethyst', 'topaz', 'jade', 'ruby', 'sapphire', 'opal', 'starstone'];
    d(gems[data] ?? 'quartz');
    if (g.rng.next() < 0.3) d('quartz');
  }
  g.addXp('mining', o === O.ORE_ROCK ? 4 + Math.floor(floor / 10) : o === O.GEM_ROCK ? 12 : 1);
  // ladder reveal
  const i = st.map!.idx(x, y);
  const rocksLeft = st.map!.obj.reduce((a, v) => a + (v === O.ROCK || v === O.ORE_ROCK || v === O.GEM_ROCK || v === O.ICE_ROCK ? 1 : 0), 0);
  const monstersLeft = st.monsters.length;
  if (!st.ladder && !st.infested && floor < MAX_FLOOR && (i === st.hidden || g.rng.next() < 0.025 + (monstersLeft === 0 ? 0.04 : 0) || rocksLeft < 8)) {
    const deep = floor >= 30 && g.rng.next() < 0.12;
    st.map!.setO(x, y, deep ? O.SHAFT : O.LADDER);
    st.ladder = [x, y];
    g.emit({ t: 'sfx', id: 'chime' });
    g.toast(deep ? 'A deep shaft opens up!' : 'You found the ladder down!');
    return true;
  }
  return false;
}

function mineTool(g: Game, kind: string, tier: number, tx: number, ty: number) {
  const st = mine(g);
  const m = st.map!;
  if (kind === 'pick') {
    const o = m.o(tx, ty);
    if (o === O.ROCK || o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK) {
      const i = m.idx(tx, ty);
      const hard = 1 + Math.floor(st.floor / 15);
      const hp = (o === O.ROCK || o === O.ICE_ROCK ? 2 : o === O.ORE_ROCK ? 4 : 6) * hard;
      const hits = (st.rockHits.get(i) ?? 0) + TOOL_POWER[tier] * 1.4;
      g.emit({ t: 'fx', kind: 'rock', x: tx + 0.5, y: ty + 0.5 });
      g.emit({ t: 'sfx', id: 'pick' });
      if (hits >= hp) {
        st.rockHits.delete(i);
        const data = m.objData[i];
        m.setO(tx, ty, O.NONE);
        if (!rockDrops(g, st, tx, ty, o, data)) g.emit({ t: 'sfx', id: 'rockbreak' });
        // pebble crabs hide as rocks
        if (st.floor >= 10 && g.rng.next() < 0.03) {
          const def = MONSTER_BY_ID.get('pebble_crab')!;
          st.monsters.push({ id: def.id, def, x: tx + 0.5, y: ty + 0.7, vx: 0, vy: 0, z: 0, hp: def.hp, maxHp: def.hp, hurt: 0, phase: 0, t: 0, state: 1, cool: 0.5 });
          g.toast('The rock was a crab!');
        }
      } else st.rockHits.set(i, hits);
    } else g.emit({ t: 'sfx', id: 'thud' });
  } else if (kind === 'hoe') {
    if (g.rng.next() < 0.2 && m.g(tx, ty) === T.MINEFLOOR && !m.o(tx, ty)) {
      spawnDrop(g, key(g.rng.next() < 0.5 ? 'clay' : 'stone'), 1, tx + 0.5, ty + 0.5);
    }
    g.emit({ t: 'sfx', id: 'dig' });
  }
}

function attack(g: Game, tx: number, ty: number, w: { dmg: number; speed: number; knock: number }) {
  const st = mine(g);
  if (g.player.where !== 'mine') return;
  const p = g.player;
  const fx = [0, 1, 0, -1][p.dir], fy = [-1, 0, 1, 0][p.dir];
  const cx = p.x + fx * 0.9, cy = p.y - 0.3 + fy * 0.9;
  const lvl = p.skills.combat ?? 0;
  for (const mo of st.monsters) {
    if (mo.def.behavior === 'burrow' && mo.state === 0) continue;
    if (Math.hypot(mo.x - cx, mo.y - 0.3 - cy) > 1.2) continue;
    const crit = g.rng.next() < 0.05 + lvl * 0.01;
    const dmg = Math.round(w.dmg * (1 + lvl * 0.05) * (g.hasPerk('brute') ? 1.15 : 1) * (g.hasPerk('warrior') ? 1.25 : 1) * (0.85 + g.rng.next() * 0.3) * (crit ? 2 : 1));
    mo.hp -= dmg;
    mo.hurt = 0.25;
    const kb = 6 * w.knock;
    mo.vx = fx * kb;
    mo.vy = fy * kb;
    g.emit({ t: 'float', text: String(dmg), x: mo.x, y: mo.y - 1.4, c: crit ? 6 : 8 });
    g.emit({ t: 'fx', kind: 'hit', x: mo.x, y: mo.y - 0.5, n: 6 });
    g.emit({ t: 'sfx', id: 'hit' });
    if (crit) g.emit({ t: 'shake', amt: 0.25 });
  }
  void tx;
  void ty;
}

// ---------------- monsters ----------------
function walkableFor(m: TileMap, x: number, y: number, fly: boolean) {
  const t = m.g(Math.floor(x), Math.floor(y));
  if (t === T.MINEWALL || t === T.VOID) return false;
  if (fly) return true;
  if (t === T.MINEWATER || t === T.LAVA) return false;
  const o = m.o(Math.floor(x), Math.floor(y));
  return !(o === O.ROCK || o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK || o === O.STALAGMITE || o === O.CRYSTAL);
}

function moveMon(m: TileMap, mo: Monster, dx: number, dy: number, fly: boolean) {
  if (walkableFor(m, mo.x + dx, mo.y, fly)) mo.x += dx;
  else mo.vx = -mo.vx * 0.5;
  if (walkableFor(m, mo.x, mo.y + dy, fly)) mo.y += dy;
  else mo.vy = -mo.vy * 0.5;
}

function hurtPlayer(g: Game, dmg: number, fromX: number, fromY: number) {
  const p = g.player;
  if (p.invuln > 0) return;
  const def = (1 - Math.min(0.5, (p.skills.combat ?? 0) * 0.03)) * (1 - 0.12 * g.buffLvl('defense'));
  p.hp -= Math.round(dmg * def);
  p.invuln = 1;
  const dx = p.x - fromX, dy = p.y - fromY, d = Math.hypot(dx, dy) || 1;
  p.kx = (dx / d) * 7;
  p.ky = (dy / d) * 7;
  g.emit({ t: 'sfx', id: 'hurt' });
  g.emit({ t: 'shake', amt: 0.35 });
  g.emit({ t: 'float', text: `-${Math.round(dmg * def)}`, x: p.x, y: p.y - 1.8, c: 28 });
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
  g.emit({ t: 'ui', open: 'message', arg: { title: 'Valley Clinic', text: `You collapsed in the mine and were carried to the clinic. Dr. Marrow patched you up. (Bill: ${lost} coins)` } });
}

function tickMonsters(g: Game, dt: number) {
  const st = mine(g);
  const m = st.map;
  if (!m) return;
  const p = g.player;
  const list = st.monsters;
  for (let i = list.length - 1; i >= 0; i--) {
    // collapsing (hurtPlayer) carries you out of the mine and clears the floor mid-loop
    if (st.monsters !== list || g.player.where !== 'mine') return;
    const mo = list[i];
    if (!mo) continue;
    mo.t += dt;
    mo.hurt = Math.max(0, mo.hurt - dt);
    mo.cool -= dt;
    const dx = p.x - mo.x, dy = p.y - mo.y;
    const dist = Math.hypot(dx, dy);
    const aware = dist < 9;
    const sp = mo.def.speed;
    const fly = mo.def.behavior === 'fly' || mo.def.behavior === 'shoot';
    // knockback decay
    if (Math.abs(mo.vx) + Math.abs(mo.vy) > 0.05) {
      moveMon(m, mo, mo.vx * dt, mo.vy * dt, fly);
      mo.vx *= Math.pow(0.02, dt);
      mo.vy *= Math.pow(0.02, dt);
    }
    switch (mo.def.behavior) {
      case 'hop':
        if (mo.z > 0 || mo.state === 1) {
          mo.z = Math.max(0, mo.z + (mo.state === 1 ? 1 : -1) * dt * 20);
          if (mo.z >= 8) mo.state = 2;
          if (mo.z <= 0 && mo.state === 2) mo.state = 0;
        }
        if (aware && mo.cool <= 0) {
          mo.cool = 1.2 + g.rng.next();
          mo.state = 1;
          mo.vx = (dx / dist) * sp * 2.2;
          mo.vy = (dy / dist) * sp * 2.2;
        }
        break;
      case 'fly': {
        if (aware) {
          const wob = Math.sin(mo.t * 3 + mo.phase) * 0.8;
          moveMon(m, mo, ((dx / dist) * sp + -dy / dist * wob) * dt, ((dy / dist) * sp + dx / dist * wob) * dt, true);
        }
        mo.z = 6 + Math.sin(mo.t * 4) * 2;
        break;
      }
      case 'chase':
        if (mo.state === 1 && dist > 2.5) break; // disguised crab
        mo.state = 0;
        if (aware) moveMon(m, mo, (dx / dist) * sp * dt, (dy / dist) * sp * dt, false);
        break;
      case 'shoot':
        mo.z = 4 + Math.sin(mo.t * 2) * 2;
        if (aware) {
          const want = dist < 4 ? -1 : dist > 6 ? 1 : 0;
          moveMon(m, mo, (dx / dist) * sp * want * dt, (dy / dist) * sp * want * dt, true);
          if (mo.cool <= 0) {
            mo.cool = 2.2;
            st.bolts.push({ x: mo.x, y: mo.y - 0.3, vx: (dx / dist) * 5, vy: (dy / dist) * 5, t: 0, dmg: mo.def.dmg });
            g.emit({ t: 'sfx', id: 'cast', v: 0.4 });
          }
        }
        break;
      case 'burrow':
        // underground (state 0) until near, then pops up for a while
        if (mo.state === 0 && dist < 3) {
          mo.state = 1;
          mo.cool = 3;
        } else if (mo.state === 1) {
          if (mo.cool <= 0) {
            mo.state = 0;
            const a = g.rng.next() * Math.PI * 2;
            const nx = p.x + Math.cos(a) * 4, ny = p.y + Math.sin(a) * 4;
            if (walkableFor(m, nx, ny, false)) { mo.x = nx; mo.y = ny; }
          } else if (aware) moveMon(m, mo, (dx / dist) * sp * 0.6 * dt, (dy / dist) * sp * 0.6 * dt, false);
        } else if (aware) moveMon(m, mo, (dx / dist) * sp * dt, (dy / dist) * sp * dt, false);
        break;
    }
    // contact damage
    const hidden = (mo.def.behavior === 'burrow' && mo.state === 0) || (mo.def.behavior === 'chase' && mo.state === 1);
    if (!hidden && dist < 0.7) hurtPlayer(g, mo.def.dmg, mo.x, mo.y);
    if (mo.hp <= 0) {
      for (const d of mo.def.drops) if (g.rng.next() < d.chance * (g.hasPerk('scavenger') ? 1.5 : 1)) spawnDrop(g, key(d.item), d.n ? g.rng.int(d.n[0], d.n[1]) : 1, mo.x, mo.y);
      g.addXp('combat', mo.def.xp);
      g.count('monsters');
      g.count('slain_' + mo.id);
      g.emit({ t: 'sfx', id: 'monster_die' });
      g.emit({ t: 'fx', kind: 'magic', x: mo.x, y: mo.y - 0.3, n: 14 });
      st.monsters.splice(i, 1);
      if (st.infested && !st.monsters.length && !st.ladder) revealLadderNear(g, st);
    }
  }
  for (let i = st.bolts.length - 1; i >= 0; i--) {
    const b = st.bolts[i];
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (Math.hypot(p.x - b.x, p.y - 0.4 - b.y) < 0.5) {
      hurtPlayer(g, b.dmg, b.x, b.y);
      st.bolts.splice(i, 1);
      continue;
    }
    if (b.t > 3 || m.g(Math.floor(b.x), Math.floor(b.y)) === T.MINEWALL) st.bolts.splice(i, 1);
  }
  // light follows bolts
  st.lights = st.lights.filter((l) => !(l as any).bolt);
  for (const b of st.bolts) st.lights.push({ x: b.x, y: b.y, r: 1.5, i: 0.8, c: 6, bolt: true } as any);
  // auto-step on ladders
  const o = m.o(Math.floor(p.x), Math.floor(p.y - 0.2));
  if (o === O.LADDER && (g.sys.ladderCool ?? 0) <= 0) {
    g.sys.ladderCool = 1;
    enterFloor(g, st.floor + 1);
  }
  g.sys.ladderCool = Math.max(0, (g.sys.ladderCool ?? 0) - dt);
}

registerSystem({
  name: 'mine',
  tick(g, dt) {
    if (g.player.where === 'mine') tickMonsters(g, dt);
  },
  dayStart(g) {
    const st = mine(g);
    if (g.player.where === 'mine') {
      // you always wake up at home
      st.map = null;
      st.monsters = [];
      g.player.where = 'world';
    }
  },
  save(g) {
    return { deepest: mine(g).deepest };
  },
  load(g, d) {
    mine(g).deepest = d.deepest ?? 0;
  },
});

export { MONSTERS };
