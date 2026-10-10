// The Field Works (ROADMAP.md 4.9): machines that take from fields. A field is a source; a ripe
// crop is an item waiting in the ground. The gleaner (Spring, spring-wound) and the field gantry
// (Steam, rides its rails) live here; the harvest crane and seed sower are in automation.ts.
// The morning belongs to the hands: a crop that ripened today waits until noon for the machines.
import { CROP_BY_SEED, CROP_BY_ID } from '../../data/crops';
import type { CropState, Game } from '../Game';
import { DX, DY, Ent } from '../ents';
import { key, kDef, kStack, ItemKey } from '../inventory';
import { takersOf } from '../lines';
import { MState, setState } from '../mstate';
import { PORT_HANDLERS } from '../ports';
import { canPlant, canTill, cropTotal, harvest, plant, till } from './farming';

/** the hour (game minutes) field machines may pick a crop that ripened this morning */
export const PICK_FROM = 12 * 60;

/** Can a field machine pick this crop now? (Dawn Shift research + the machine's switch: from 6am.) */
export function pickable(g: Game, c: CropState | null | undefined, dawn = false): boolean {
  if (!c || !c.ready || c.dead || c.giant >= 0) return false;
  if (dawn) return true;
  return c.ripeDay === undefined || c.ripeDay < g.dayIndex || g.time.min >= PICK_FROM;
}

/** a field machine's Dawn Shift switch is on (and researched) */
export function dawnOn(g: Game, e: Ent): boolean {
  return !!e.st.dawn && g.research.done.has('r_dawn');
}

/** The Idle line of a field machine with nothing to pick: ripe-but-morning, or when the next ripens. */
export function fieldIdleText(g: Game, tiles: [number, number][]): string {
  let best = Infinity, any = false, morning = false;
  for (const [x, y] of tiles) {
    if (!g.map.inb(x, y)) continue;
    const s = g.soil.get(g.map.idx(x, y));
    if (!s?.crop || s.crop.dead) continue;
    any = true;
    if (s.crop.ready) {
      morning = true;
      continue;
    }
    const cr = CROP_BY_ID.get(s.crop.id);
    if (cr) best = Math.min(best, Math.max(1, cropTotal(cr) - s.crop.days));
  }
  if (morning) return 'Ripe: picks at noon (or pick them by hand)';
  if (!any) return 'No crops in reach: plant around it';
  return best <= 1 ? 'Next ripe crop tomorrow' : `Next ripe crop in ${best} watered days`;
}

const itemsIn = (e: Ent) => e.inv!.slots.reduce((a, s) => a + (s ? s.n : 0), 0);

/** a full basket or hopper: a queue while an arm is emptying it, else Blocked */
function fullState(g: Game, e: Ent, what: string) {
  if (takersOf(g, e).some((t) => t.state === MState.Working)) setState(e, MState.Working, `${what} full: the arm is emptying it`, g.simTime);
  else setState(e, MState.Blocked, `${what} full: an arm should empty it`, g.simTime);
}

// ---------------- the gleaner ----------------

/** the gleaner's basket holds this many crops */
export const GLEANER_BASKET = 12;
/** seconds between picks (half that while wound) */
export const GLEANER_PICK = 2;

function around(e: Ent): [number, number][] {
  const out: [number, number][] = [];
  for (let y = e.y - 1; y <= e.y + 1; y++) for (let x = e.x - 1; x <= e.x + 1; x++) if (x !== e.x || y !== e.y) out.push([x, y]);
  return out;
}

export function gleanerTick(g: Game, e: Ent, dt: number) {
  const now = g.simTime;
  let mul = 1;
  if (e.st.wind > 0) {
    e.st.wind = Math.max(0, e.st.wind - dt);
    mul = 2;
  }
  e.st.anim = Math.max(0, (e.st.anim ?? 0) - dt);
  e.st.cd = (e.st.cd ?? 0) - dt * mul;
  if (e.st.cd > 0) return;
  e.st.cd = GLEANER_PICK;
  if (itemsIn(e) >= GLEANER_BASKET) {
    e.working = false;
    fullState(g, e, 'Basket');
    return;
  }
  const dawn = dawnOn(g, e);
  for (const [x, y] of around(e)) {
    if (!g.map.inb(x, y)) continue;
    const i = g.map.idx(x, y);
    const s = g.soil.get(i);
    if (!pickable(g, s?.crop, dawn)) continue;
    const out = harvest(g, i, g.rng, true);
    if (!out) continue;
    let n = 0;
    // gleaners pick base quality only: gold and star are for the hands
    for (const st of out) {
      const left = e.inv!.add(st.k & ~3, st.n);
      if (left) g.sys.drops?.spawn?.(g, st.k & ~3, left, x + 0.5, y + 0.5);
      g.stats.add(st.k & ~3, st.n - left);
      n += st.n - left;
    }
    g.stats.states.moved(e, n);
    e.working = true;
    e.st.anim = 0.6;
    setState(e, MState.Working, 'Picking', now);
    g.emit({ t: 'fx', kind: 'leaves', x: x + 0.5, y: y + 0.5, n: 3 });
    return;
  }
  e.working = false;
  setState(e, MState.Idle, fieldIdleText(g, around(e)), now);
}

// ---------------- the field gantry ----------------

/** the gantry's hopper car holds this many crops, and this many seeds */
export const GANTRY_HOPPER = 60;
export const GANTRY_SEEDS = 40;

/** The gantry's rails: how far the strip runs from the car, and its tiles (ROADMAP.md 4.9.1). */
export function gantryStrip(g: Game, e: Ent): { len: number; rows: [number, number][][] } {
  const maxLen = g.research.done.has('r_long_rails') ? 24 : 12;
  // the car spans 7 tiles across the direction of travel; rails run from both outer tiles
  const fx = DX[e.rot], fy = DY[e.rot];
  const across: [number, number][] = [];
  for (let k = 0; k < 7; k++) across.push(e.rot % 2 === 0 ? [e.x + k, e.y] : [e.x, e.y + k]);
  const rows: [number, number][][] = [];
  for (let r = 1; r <= maxLen; r++) {
    const [ax, ay] = across[0], [bx, by] = across[6];
    const ra = g.ents.at(ax + fx * r, ay + fy * r), rb = g.ents.at(bx + fx * r, by + fy * r);
    if (ra?.def.kind !== 'rail' || rb?.def.kind !== 'rail' || ra.ghost || rb.ghost) break;
    rows.push(across.slice(1, 6).map(([x, y]) => [x + fx * r, y + fy * r] as [number, number]));
  }
  return { len: rows.length, rows };
}

function seedsIn(e: Ent): number {
  return e.inv!.slots.reduce((a, s) => a + (s && kDef(s.k).plant?.crop ? s.n : 0), 0);
}
function cropsIn(e: Ent): number {
  return e.inv!.slots.reduce((a, s) => a + (s && !kDef(s.k).plant?.crop && !kDef(s.k).fertilizer ? s.n : 0), 0);
}

/** is there anything for a pass to do: water, pick, sow? (and is sowing all it lacks seeds for) */
function gantryWork(g: Game, e: Ent, rows: [number, number][][]): { any: boolean; needSeeds: boolean } {
  const dawn = dawnOn(g, e);
  const seeds = seedsIn(e) > 0;
  let any = false, needSeeds = false;
  for (const row of rows)
    for (const [x, y] of row) {
      if (!g.map.inb(x, y)) continue;
      const s = g.soil.get(g.map.idx(x, y));
      if (s?.crop && !s.crop.dead) {
        if (!s.water && !g.isRaining() && !s.crop.ready) any = true;
        if (pickable(g, s.crop, dawn)) any = true;
      } else if (s || canTill(g, x, y)) {
        if (seeds) any = true;
        else needSeeds = true;
      }
    }
  return { any, needSeeds };
}

/** work one row of the strip: water, pick, till and sow */
function gantryRow(g: Game, e: Ent, row: [number, number][]) {
  const dawn = dawnOn(g, e);
  for (const [x, y] of row) {
    if (!g.map.inb(x, y)) continue;
    const i = g.map.idx(x, y);
    let s = g.soil.get(i);
    if (s?.crop && !s.crop.dead) {
      if (!s.crop.ready) s.water = true;
      if (pickable(g, s.crop, dawn) && cropsIn(e) < GANTRY_HOPPER) {
        const out = harvest(g, i, g.rng, true);
        let n = 0;
        for (const st of out ?? []) {
          const left = e.inv!.add(st.k, st.n);
          if (left) g.sys.drops?.spawn?.(g, st.k, left, x + 0.5, y + 0.5);
          g.stats.add(st.k, st.n - left);
          n += st.n - left;
        }
        if (n) g.stats.states.moved(e, n);
        if (s.crop && !s.crop.ready) s.water = true;
      }
      continue;
    }
    // sow: till bare ground first, then plant the first seed that fits the season
    const seed = e.inv!.slots.find((st) => st && kDef(st.k).plant?.crop);
    if (!seed) continue;
    if (!s) {
      if (!canTill(g, x, y)) continue;
      till(g, x, y);
      s = g.soil.get(i);
      if (!s) continue;
    }
    if (s.crop) continue;
    const cr = CROP_BY_SEED.get(kDef(seed.k).id);
    if (!cr || canPlant(g, cr, i)) continue;
    plant(g, cr, i);
    s.water = true;
    e.inv!.remove(seed.k, 1);
    g.stats.use(seed.k, 1);
  }
}

export function gantryTick(g: Game, e: Ent, dt: number) {
  const now = g.simTime;
  const { len, rows } = gantryStrip(g, e);
  e.strip = rows.flat();
  e.st.len = len;
  e.st.pos = Math.min(e.st.pos ?? 0, len);
  if (e.off) {
    e.working = false;
    setState(e, MState.Idle, 'Switched off at its pole', now);
    return;
  }
  if (!len) {
    e.working = false;
    setState(e, MState.Idle, 'No rails: lay two runs of rails from its outer ends, 5 tiles apart', now);
    return;
  }
  const dir = e.st.dir ?? 0;
  if (dir !== 0 && e.sat <= 0.001) {
    e.working = true; // keeps demanding
    setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
    return;
  }
  if (dir === 0) {
    // parked at the car: unload, then decide whether a pass is worth it
    e.working = false;
    if (cropsIn(e) >= GANTRY_HOPPER) return fullState(g, e, 'Hopper');
    e.st.idleT = (e.st.idleT ?? 0) - dt;
    if (e.st.idleT > 0) return;
    e.st.idleT = 2;
    const w = gantryWork(g, e, rows);
    if (w.any) {
      if (!e.net || e.sat <= 0.001) {
        setState(e, MState.Unpowered, e.net ? 'No power: the grid has nothing to give' : 'No power: place a pole within reach', now);
        e.working = true;
        return;
      }
      e.st.dir = 1;
      e.st.row = 0;
      setState(e, MState.Working, 'Out on the strip', now);
    } else if (w.needSeeds) {
      e.want = 'seeds';
      setState(e, MState.Starved, 'Seed bin empty: feed it seeds with an arm', now);
    } else setState(e, MState.Idle, fieldIdleText(g, e.strip), now);
    return;
  }
  e.working = true;
  const speed = (e.def.speed ?? 1) * Math.max(0, e.sat) * (dir < 0 ? 1.5 : 1);
  if (dir > 0) {
    e.st.pos += dt * speed;
    // work each row as the gantry reaches it
    while ((e.st.row ?? 0) < Math.min(len, Math.floor(e.st.pos))) {
      e.st.row = (e.st.row ?? 0) + 1;
      gantryRow(g, e, rows[e.st.row - 1]);
      g.emit({ t: 'fx', kind: 'splash', x: e.x + 0.5, y: e.y + 0.5, n: 0 });
    }
    if (cropsIn(e) >= GANTRY_HOPPER || e.st.pos >= len) {
      e.st.dir = -1;
      setState(e, MState.Working, 'Returning to unload', now);
    } else setState(e, e.sat < 0.25 ? MState.Unpowered : MState.Working, e.sat < 0.25 ? 'Crawling: the grid is short' : 'Out on the strip', now);
  } else {
    e.st.pos -= dt * speed;
    if (e.st.pos <= 0) {
      e.st.pos = 0;
      e.st.dir = 0;
      e.st.idleT = 0;
    }
    setState(e, MState.Working, 'Returning to unload', now);
  }
}

// ---------------- ports ----------------

// the gleaner's basket: arms take, nothing goes in
PORT_HANDLERS.gleaner = { accept: () => 0, insert: () => 0 };

// the gantry's car: crops come out, seeds (and fertilizer) go in
PORT_HANDLERS.gantry = {
  accept: (_g, e, k) => {
    const d = kDef(k);
    if (!d.plant?.crop) return 0;
    return Math.max(0, Math.min(GANTRY_SEEDS - seedsIn(e), e.inv!.space(k)));
  },
  insert: (_g, e, k, n) => {
    const d = kDef(k);
    if (!d.plant?.crop) return 0;
    const can = Math.min(n, GANTRY_SEEDS - seedsIn(e), e.inv!.space(k));
    if (can <= 0) return 0;
    e.inv!.add(k, can);
    return can;
  },
  take: (_g, e, pred, max) => {
    const inv = e.inv!;
    for (let i = inv.slots.length - 1; i >= 0; i--) {
      const s = inv.slots[i];
      if (!s || kDef(s.k).plant?.crop || !pred(s.k)) continue;
      const n = Math.min(typeof max === 'number' ? max : max(s.k), s.n);
      if (n <= 0) continue;
      s.n -= n;
      if (s.n <= 0) inv.slots[i] = null;
      return { k: s.k, n };
    }
    return null;
  },
};

export { key, kStack };
export type { ItemKey };
