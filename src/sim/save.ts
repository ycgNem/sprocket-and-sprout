// Save / load with versioned migrations. Item keys are stored as [id, quality]
// so saves survive content additions. Maps are run-length encoded.
import { ITEM_INDEX } from '../data/items';
import { LEGACY32 } from '../data/palette';
import { CONTRACT_POOL } from '../data/contracts';
import { PROJECT_BY_ID } from '../data/goals';
import { BUSINESS_BY_NPC, STANDING_BY_ID } from '../data/orders';
import { PRUNED_IDS } from '../data/research';
import { RECIPE_BY_ID } from '../data/recipes';
import { STRUCT_BY_ID } from '../data/structures';
import type { NPCLook, Season, Weather } from '../data/types';
import { Game, SYSTEMS } from './Game';
import { ArmState, BeltKind, Dir, Ent } from './ents';
import { Inventory, ItemKey, key, kId, kQ, Stack } from './inventory';
import { TileMap } from './world/tilemap';
import { squareBridges } from './world/worldgen';

export const SAVE_VERSION = 5;
const PREFIX = 'sns_save_';
const MAX_SLOTS = 6;

type KJ = [string, number];
export const kj = (k: ItemKey): KJ => [kId(k), kQ(k)];
export const jk = (j: KJ): ItemKey | null => (ITEM_INDEX.has(j[0]) ? key(j[0], j[1]) : null);
const sj = (s: Stack | null | undefined) => (s ? [kId(s.k), kQ(s.k), s.n] : null);
const js = (d: any): Stack | null => (d && ITEM_INDEX.has(d[0]) ? { k: key(d[0], d[1]), n: d[2] } : null);

export interface SaveMeta {
  slot: number;
  name: string;
  farm: string;
  date: string;
  money: number;
  saved: number;
  mode: string;
  farmKind: string;
}

// ---------- RLE ----------
export function rle(a: Uint8Array): string {
  const out: number[] = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let n = 1;
    while (i + n < a.length && a[i + n] === v && n < 65535) n++;
    out.push(v, n);
    i += n;
  }
  return out.join(',');
}
export function unrle(s: string, len: number): Uint8Array {
  const a = new Uint8Array(len);
  const parts = s.split(',').map(Number);
  let i = 0;
  for (let p = 0; p + 1 < parts.length; p += 2) {
    a.fill(parts[p], i, i + parts[p + 1]);
    i += parts[p + 1];
  }
  return a;
}

function saveMap(m: TileMap) {
  return {
    ground: rle(m.ground),
    obj: rle(m.obj),
    objData: rle(m.objData),
    trees: [...m.trees].map(([i, t]) => [i, t.species, t.stage, t.days, t.fruit, t.tapped ? 1 : 0, t.hp]),
    forage: [...m.forage],
  };
}

function loadMap(m: TileMap, d: any) {
  const n = m.w * m.h;
  m.ground.set(unrle(d.ground, n));
  m.obj.set(unrle(d.obj, n));
  m.objData.set(unrle(d.objData, n));
  m.trees.clear();
  for (const [i, species, stage, days, fruit, tapped, hp] of d.trees) m.trees.set(i, { species, stage, days, fruit, tapped: !!tapped, hp: hp ?? 10 });
  m.forage = new Map(d.forage);
  m.dirtyChunks.clear();
  m.version++;
}

function saveEnt(e: Ent): any {
  const o: any = { i: e.id, d: e.def.id, x: e.x, y: e.y, r: e.rot };
  if (e.ghost) o.g = 1;
  if (e.parent) return null; // saved through the root
  if (e.belt) {
    o.b = [e.belt.lanes[0].k.map((k) => kj(k)), e.belt.lanes[0].p, e.belt.lanes[1].k.map((k) => kj(k)), e.belt.lanes[1].p];
    if (e.child) o.bc = [e.child.belt!.lanes[0].k.map((k) => kj(k)), e.child.belt!.lanes[0].p, e.child.belt!.lanes[1].k.map((k) => kj(k)), e.child.belt!.lanes[1].p];
    if (e.def.kind === 'underground') {
      o.uk = e.belt.kind;
      o.up = e.belt.partner?.id ?? 0;
    }
  }
  if (e.arm) o.a = [sj(e.arm.held), e.arm.state, e.arm.t, e.arm.filter.map((k) => kj(k)), e.arm.limit || 0];
  if (e.belt && (e.belt.sFilter ?? -1) >= 0) o.sf = kj(e.belt.sFilter!);
  if (e.belt?.sPrio) o.sp = e.belt.sPrio;
  if (e.mach) {
    const m = e.mach;
    // pending: a recipe picked mid-batch ('' = back to auto), taken when the batch ends
    o.m = [m.recipe?.id ?? null, m.locked ? 1 : 0, [...m.inBuf].map(([k, n]) => [kj(k), n]), m.outBuf.map(sj), m.crafting ? 1 : 0, m.progress, m.burn, sj(m.fuel), m.made, m.pending ? m.pending.r?.id ?? '' : null];
  }
  if (e.gen) o.gn = [sj(e.gen.fuel), e.gen.burn];
  if (e.inv) o.v = e.inv.toJSON();
  const st: any = {};
  for (const [k, v] of Object.entries(e.st)) {
    if (k === 'fuel') st.fuel = sj(v as Stack);
    else if (k === 'requests') st.requests = (v as Stack[]).map(sj);
    else if (k === 'k') st.k = v === null || v === undefined ? null : kj(v as number);
    else if (typeof v !== 'object' || v === null || Array.isArray(v)) st[k] = v;
    else st[k] = JSON.parse(JSON.stringify(v));
  }
  o.s = st;
  return o;
}

function loadEnt(g: Game, o: any, idMap: Map<number, Ent>) {
  if (!STRUCT_BY_ID.has(o.d)) return;
  const e = g.ents.add(o.d, o.x, o.y, o.r as Dir, !!o.g);
  idMap.set(o.i, e);
  const lanes = (b: any, ent: Ent) => {
    if (!b || !ent.belt) return;
    for (let li = 0; li < 2; li++) {
      const ks: KJ[] = b[li * 2], ps: number[] = b[li * 2 + 1];
      ks.forEach((kk, j) => {
        const k = jk(kk);
        if (k !== null) {
          ent.belt!.lanes[li].k.push(k);
          ent.belt!.lanes[li].p.push(ps[j]);
        }
      });
    }
  };
  lanes(o.b, e);
  if (e.child) lanes(o.bc, e.child);
  if (e.belt && o.sf !== undefined) e.belt.sFilter = jk(o.sf) ?? -1;
  if (e.belt && o.sp) e.belt.sPrio = o.sp;
  if (e.belt && o.uk !== undefined) {
    e.belt.kind = o.uk as BeltKind;
    e.st._up = o.up;
  }
  if (e.arm && o.a) {
    e.arm.held = js(o.a[0]);
    e.arm.state = o.a[1] as ArmState;
    e.arm.t = o.a[2];
    e.arm.filter = (o.a[3] as KJ[]).map(jk).filter((k): k is number => k !== null);
    e.arm.limit = (o.a[4] as number) ?? 0;
    if (!e.arm.held && (e.arm.state === ArmState.ToDrop || e.arm.state === ArmState.Dropping)) e.arm.state = ArmState.ToPick;
  }
  if (e.mach && o.m) {
    const m = e.mach;
    const [rid, locked, inBuf, outBuf, crafting, progress, burn, fuel, made, pending] = o.m;
    m.recipe = rid ? RECIPE_BY_ID.get(rid) ?? null : null;
    m.locked = !!locked && !!m.recipe;
    for (const [kk, n] of inBuf) {
      const k = jk(kk);
      if (k !== null) m.inBuf.set(k, n);
    }
    m.outBuf = outBuf.map(js).filter((s: Stack | null): s is Stack => !!s);
    m.crafting = !!crafting && !!m.recipe;
    m.progress = progress;
    m.burn = burn;
    m.fuel = js(fuel);
    m.made = made ?? 0;
    if (typeof pending === 'string' && m.crafting) {
      const r = pending ? RECIPE_BY_ID.get(pending) : null;
      if (r !== undefined) m.pending = { r };
    }
  }
  if (e.gen && o.gn) {
    e.gen.fuel = js(o.gn[0]);
    e.gen.burn = o.gn[1];
  }
  if (e.inv && o.v) {
    const inv = Inventory.fromJSON(o.v, e.inv.size);
    e.inv.slots = inv.slots;
  }
  if (o.s) {
    for (const [k, v] of Object.entries(o.s)) {
      if (k === 'fuel') e.st.fuel = js(v);
      else if (k === 'requests') e.st.requests = (v as any[]).map(js).filter(Boolean);
      else if (k === 'k') e.st.k = v ? jk(v as KJ) : null;
      else e.st[k] = v;
    }
  }
}

export function serialize(g: Game, look: NPCLook): any {
  const p = g.player;
  const sys: Record<string, any> = {};
  for (const s of SYSTEMS) if ((s as any).save) sys[s.name] = (s as any).save(g);
  return {
    v: SAVE_VERSION,
    seed: g.seed,
    mode: g.mode,
    farmKind: g.farmKind,
    saved: Date.now(),
    look,
    time: g.time,
    weather: g.weather,
    tomorrow: g.tomorrow,
    wind: g.wind,
    player: {
      name: p.name, farmName: p.farmName, favorite: p.favorite,
      // saving underground puts you back at the mine entrance
      x: p.where === 'mine' ? g.map.loc('mine_entrance')[0] + 0.5 : p.x,
      y: p.where === 'mine' ? g.map.loc('mine_entrance')[1] + 0.9 : p.y,
      dir: p.dir,
      where: p.where === 'house' ? 'house' : undefined,
      buff: p.buff ?? undefined,
      perks: p.perks,
      energy: p.energy, maxEnergy: p.maxEnergy, hp: p.hp, maxHp: p.maxHp, money: p.money,
      inv: p.inv.toJSON(), sel: p.sel, water: p.water, skills: p.skills, xp: p.xp, upgrading: p.upgrading, rows: p.rows,
    },
    flags: [...g.flags],
    research: { done: [...g.research.done], current: g.research.current, progress: g.research.progress, rewards: [...g.research.rewards], valid: g.research.valid },
    soil: [...g.soil].map(([i, s]) => [i, s.water ? 1 : 0, s.fert, s.idle, s.crop ? [s.crop.id, s.crop.days, s.crop.stage, s.crop.ready ? 1 : 0, s.crop.harvests, s.crop.dead ? 1 : 0, s.crop.giant, s.crop.frac] : null]),
    map: saveMap(g.map),
    ents: g.ents.all().map(saveEnt).filter(Boolean),
    counters: g.counters,
    earned: g.earned,
    daysPlayed: g.daysPlayed,
    stats: g.stats.totals().map((t) => [kId(t.idx * 4), t.prod, t.cons]),
    sys,
  };
}

/** Ordered migrations: MIGRATIONS[v] upgrades a v save to v+1. */
export const MIGRATIONS: Record<number, (d: any) => any> = {
  1: (d) => {
    // v1 -> v2: counters + per-system bags were introduced
    d.counters = d.counters ?? {};
    d.sys = d.sys ?? {};
    d.player.rows = d.player.rows ?? 3;
    d.v = 2;
    return d;
  },
  2: (d) => {
    // v2 -> v3: the palette went from 32 colors to Resurrect 64; look colors are palette indices
    if (d.look) for (const k of ['skin', 'hair', 'shirt', 'pants', 'accent']) if (typeof d.look[k] === 'number') d.look[k] = LEGACY32[d.look[k]] ?? d.look[k];
    d.v = 3;
    return d;
  },
  3: (d) => {
    // v3 -> v4 (2.0): nothing to convert, new state starts from its defaults on load; the bump makes
    // 1.1.x refuse a 2.0 save cleanly instead of loading research topics and structures it doesn't know
    d.v = 4;
    return d;
  },
  4: (d) => migrateV5(d),
};

/**
 * v4 -> v5 (2.0 Phases 3 and 4): one Orders board (the daily requests, the Guild's state and the
 * restoration projects move into it), the research eras (the retired flat-buff nodes become era
 * rewards) and the Deepworks (60 floors became 30 levels).
 */
export function migrateV5(d: any): any {
  const sys = (d.sys ??= {});
  const old = sys.orders ?? {};
  const day = Math.max(0, (d.time?.year ?? 1) - 1) * 112 + (d.time?.season ?? 0) * 28 + Math.max(0, (d.time?.day ?? 1) - 1);
  const os: any = { open: [], filled: { ...(old.filled ?? {}) }, rep: { ...(old.rep ?? {}) }, posted: [], seen: [], uid: 1, guild: { unlocked: false, week: -1, completed: 0 }, worksDone: [] };
  const push = (o: any) => os.open.push({ ...o, uid: os.uid++ });
  // Phase 2's standing orders keep their place (an order then held its def id in `id` and one count)
  for (const o of old.open ?? []) {
    const def = STANDING_BY_ID.get(o.id);
    if (!def) continue;
    push({ kind: 'standing', def: def.id, cust: def.biz, lines: [{ spec: def.spec, n: o.n ?? def.n, have: o.have ?? 0 }], day: o.day ?? day, due: o.due ?? day + 7, unit: def.unit, silver: def.silver, rep: def.big ? 2 : 1 });
  }
  for (const id of old.posted ?? []) {
    const def = STANDING_BY_ID.get(id);
    if (!def) continue;
    if (!os.seen.includes(id)) os.seen.push(id);
    if (!os.posted.includes(def.biz)) os.posted.push(def.biz);
  }
  // the Trading Guild: its rank and this week's contracts
  const gs = sys.contracts;
  if (gs) {
    os.guild = { unlocked: !!gs.unlocked, week: gs.week ?? -1, completed: gs.completed ?? 0 };
    if (gs.rep) os.rep.guild = gs.rep;
    if (gs.unlocked) os.posted.push('guild');
    const sunday = day + ((6 - (day % 7)) + 7) % 7;
    for (const c of gs.list ?? []) {
      if (!c?.spec) continue;
      const tier = CONTRACT_POOL.find((x) => x.id === c.id)?.tier ?? 0;
      push({ kind: 'guild', def: c.id, cust: 'guild', lines: [{ spec: c.spec, n: c.need, have: Math.min(c.need, c.have ?? 0) }], day, due: sunday, pay: c.reward, rep: c.rep ?? 1 + tier, done: !!c.done });
    }
    delete sys.contracts;
  }
  // the restoration projects: their progress and the finished ones are the Works now
  const goals = sys.goals;
  if (goals) {
    os.worksDone = [...(goals.doneProjects ?? [])].filter((id: string) => PROJECT_BY_ID.has(id));
    for (const [pid, prog] of Object.entries((goals.projects ?? {}) as Record<string, Record<string, number>>)) {
      const p = PROJECT_BY_ID.get(pid);
      if (!p || os.worksDone.includes(pid)) continue;
      push({ kind: 'works', def: pid, cust: 'council', lines: p.items.map((it) => ({ spec: it.item, n: it.n, have: Math.min(it.n, prog?.[it.item] ?? 0) })), day, due: 1e9, rep: 0 });
    }
    delete goals.projects;
    delete goals.doneProjects;
  }
  // today's requests: an accepted, unfinished one stays on the board as a Today ask until midnight
  const q = sys.quests;
  if (q) {
    const r = q.current >= 0 ? q.requests?.[q.current] : null;
    if (r && !r.done && r.item) {
      push({ kind: 'today', def: `req:${r.npc}:${r.item}`, cust: r.npc, lines: [{ spec: r.item, n: r.n, have: 0 }], day, due: day, pay: r.reward, rep: BUSINESS_BY_NPC.has(r.npc) ? 1 : 0, text: r.text });
      if (!os.posted.includes(r.npc)) os.posted.push(r.npc);
    }
    delete q.requests;
    delete q.current;
  }
  sys.orders = os;
  // a crate tagged for a customer keeps its tag (customers are still the villagers' ids)
  // research: the retired flat-buff nodes are era rewards now, kept under their old ids
  const res = d.research;
  if (res) {
    const done: string[] = res.done ?? [];
    res.rewards = [...new Set([...(res.rewards ?? []), ...done.filter((id) => PRUNED_IDS.has(id))])];
    res.done = done.filter((id) => !PRUNED_IDS.has(id));
    if (res.current && PRUNED_IDS.has(res.current)) res.current = null;
    for (const id of Object.keys(res.progress ?? {})) if (PRUNED_IDS.has(id)) delete res.progress[id];
  }
  const flags: string[] = (d.flags ??= []);
  // 1.x saves never had the Town Mill keystone: their bread kept coming
  if (!flags.includes('keepers_line') && !flags.includes('bread_town')) flags.push('bread_town');
  // the Deepworks: 60 floors became 30 levels, lifts every 5 (a lift ridden before is the old lift, restored)
  const mine = sys.mine;
  if (mine?.deepest) mine.deepest = Math.ceil(mine.deepest / 2);
  const lifts = flags.filter((f) => /^elev_\d+$/.test(f));
  if (lifts.length) {
    const next = new Set(flags.filter((f) => !/^elev_\d+$/.test(f)));
    for (const f of lifts) next.add('elev_' + Math.max(5, Math.round(Number(f.slice(5)) / 10) * 5));
    next.add('chamber:lift');
    d.flags = [...next];
  }
  d.v = 5;
  return d;
}

export function migrate(d: any): any {
  let v = d.v ?? 1;
  while (v < SAVE_VERSION) {
    const f = MIGRATIONS[v];
    if (!f) throw new Error('no migration from v' + v);
    d = f(d);
    v = d.v;
  }
  if (v > SAVE_VERSION) throw new Error('save is from a newer version');
  return d;
}

export function deserialize(raw: any): { game: Game; look: NPCLook } {
  const d = migrate(raw);
  const g = new Game({ seed: d.seed, name: d.player.name, farmName: d.player.farmName, favorite: d.player.favorite, mode: d.mode ?? 'story', farm: d.farmKind ?? 'classic', loading: true });
  // remove the starting entities the constructor made
  for (const e of g.ents.all()) g.ents.remove(e);
  g.time = { ...d.time, season: d.time.season as Season };
  g.weather = d.weather as Weather;
  g.tomorrow = d.tomorrow as Weather;
  g.wind = d.wind ?? 1;
  const p = g.player;
  const dp = d.player;
  Object.assign(p, {
    x: dp.x, y: dp.y, dir: dp.dir, energy: dp.energy, maxEnergy: dp.maxEnergy, hp: dp.hp, maxHp: dp.maxHp, money: dp.money,
    sel: dp.sel, water: dp.water, skills: { ...p.skills, ...dp.skills }, xp: { ...p.xp, ...dp.xp }, upgrading: dp.upgrading ?? null, rows: dp.rows ?? 3,
  });
  p.inv = Inventory.fromJSON(dp.inv, 36);
  p.where = dp.where === 'house' ? 'house' : 'world';
  p.buff = dp.buff ?? null;
  p.perks = dp.perks ?? [];
  g.flags = new Set(d.flags);
  g.research.done = new Set(d.research.done);
  g.research.current = d.research.current;
  g.research.progress = d.research.progress ?? {};
  g.research.rewards = new Set(d.research.rewards ?? []);
  g.research.valid = d.research.valid ?? {};
  g.soil.clear();
  for (const [i, w, fert, idle, c] of d.soil) {
    g.soil.set(i, {
      water: !!w, fert, idle: idle ?? 0,
      crop: c ? { id: c[0], days: c[1], stage: c[2], ready: !!c[3], harvests: c[4], dead: !!c[5], giant: c[6] ?? -1, frac: c[7] ?? 0 } : null,
    });
  }
  loadMap(g.map, d.map);
  const idMap = new Map<number, Ent>();
  for (const o of d.ents) loadEnt(g, o, idMap);
  // re-link underground pairs
  for (const e of g.ents.belts) {
    if (e.st._up) {
      const partner = idMap.get(e.st._up);
      if (partner) e.belt!.partner = partner;
      delete e.st._up;
    }
    if (e.st.mainBin) g.shipBinId = e.id;
  }
  for (const e of g.ents.others) if (e.st.mainBin) g.shipBinId = e.id;
  // older worlds were generated with L-shaped bridge decks: square them (never over soil or a structure)
  squareBridges(g.map, (x, y) => !g.soil.has(g.map.idx(x, y)) && !g.ents.at(x, y));
  g.ents.beltsDirty = true;
  g.ents.powerDirty = true;
  g.counters = d.counters ?? {};
  g.earned = d.earned ?? 0;
  g.daysPlayed = d.daysPlayed ?? 0;
  g.stats.load((d.stats ?? []).filter((s: any) => ITEM_INDEX.has(s[0])).map((s: any) => ({ idx: ITEM_INDEX.get(s[0])!, prod: s[1], cons: s[2] })));
  for (const s of SYSTEMS) if ((s as any).load && d.sys?.[s.name] !== undefined) (s as any).load(g, d.sys[s.name]);
  for (const s of SYSTEMS) (s as any).afterLoad?.(g);
  applyResearchMods(g);
  return { game: g, look: d.look };
}

export function applyResearchMods(g: Game) {
  // recompute effects from completed research
  const mods = g.mods;
  mods.armHand = 0; mods.machineSpeed = 1; mods.labSpeed = 1; mods.energy = 0; mods.droneSpeed = 1; mods.droneCount = 0; mods.reach = 0; mods.marketBonus = 0;
  g.sys.applyResearch?.(g);
}

// ---------- storage ----------
function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function metaOf(d: any, slot: number): SaveMeta {
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  return {
    slot, name: d.player.name, farm: d.player.farmName,
    date: `${seasons[d.time.season]} ${d.time.day}, Year ${d.time.year}`, money: d.player.money, saved: d.saved ?? 0,
    mode: d.mode ?? 'story', farmKind: d.farmKind ?? 'classic',
  };
}

export function listSaves(): SaveMeta[] {
  const s = store();
  if (!s) return [];
  const out: SaveMeta[] = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const raw = s.getItem(PREFIX + i);
    if (!raw) continue;
    try {
      out.push(metaOf(JSON.parse(raw), i));
    } catch {
      /* corrupt slot */
    }
  }
  return out.sort((a, b) => b.saved - a.saved);
}

export function freeSlot(): number {
  const s = store();
  for (let i = 1; i <= MAX_SLOTS; i++) if (!s?.getItem(PREFIX + i)) return i;
  // overwrite the oldest
  const all = listSaves();
  return all.length ? all[all.length - 1].slot : 1;
}

export function saveGame(g: Game, look: NPCLook, slot: number): boolean {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(PREFIX + slot, JSON.stringify(serialize(g, look)));
    // ask the browser not to evict our saves under storage pressure (best effort)
    try {
      (globalThis as any).navigator?.storage?.persist?.();
    } catch {
      /* not supported */
    }
    return true;
  } catch (err) {
    console.error('save failed', err);
    return false;
  }
}

export function loadGame(slot: number): { game: Game; look: NPCLook; slot: number } | null {
  const s = store();
  const raw = s?.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const r = deserialize(JSON.parse(raw));
    return { ...r, slot };
  } catch (err) {
    console.error('load failed', err);
    return null;
  }
}

export function deleteSave(slot: number) {
  store()?.removeItem(PREFIX + slot);
}

export function exportSaveJSON(g: Game, look: NPCLook): string {
  return JSON.stringify(serialize(g, look));
}

export function importSaveJSON(txt: string): { ok: boolean; slot?: number; error?: string } {
  try {
    const d = migrate(JSON.parse(txt));
    if (!d.player || !d.map) return { ok: false, error: 'not a Sprocket & Sprout save' };
    const slot = freeSlot();
    store()?.setItem(PREFIX + slot, JSON.stringify(d));
    return { ok: true, slot };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'invalid file' };
  }
}
