// Placing and removing structures: validation, pairing, refunds.
import { STRUCT_BY_ID } from '../data/structures';
import type { StructureDef } from '../data/types';
import type { Game } from './Game';
import { BeltKind, DX, DY, Dir, Ent, footprint, opposite, rightOf, storeOf } from './ents';
import { key, Stack } from './inventory';
import { O, T, Z, WATER_TERRAIN } from './world/tilemap';

export const BUILD_ZONES = new Set([Z.FARM, Z.QUARRY, Z.GREENHOUSE]);
const CLEAR_OBJ = new Set([O.NONE, O.FLOWER, O.TALLGRASS, O.FORAGE]);

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

export function structFootprint(def: StructureDef, x: number, y: number, rot: Dir): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  if (def.kind === 'splitter') {
    tiles.push({ x, y });
    tiles.push({ x: x + DX[rightOf(rot)], y: y + DY[rightOf(rot)] });
    return tiles;
  }
  const [w, h] = footprint(def, rot);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) tiles.push({ x: xx, y: yy });
  return tiles;
}

export function canPlace(g: Game, defId: string, x: number, y: number, rot: Dir, opts: { ignoreZone?: boolean; ghostOk?: boolean } = {}): PlaceCheck {
  const def = STRUCT_BY_ID.get(defId);
  if (!def) return { ok: false, reason: 'Unknown' };
  if (g.player.where !== 'world') return { ok: false, reason: 'Not here' };
  const m = g.map;
  const tiles = structFootprint(def, x, y, def.rotatable ? rot : 0);
  let riverTiles = 0, waterTiles = 0, oreTiles = 0, treeTiles = 0;
  for (const t of tiles) {
    if (!m.inb(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
    const i = m.idx(t.x, t.y);
    const zone = m.zone[i];
    const ground = m.ground[i];
    if (!opts.ignoreZone && !BUILD_ZONES.has(zone) && !(def.kind === 'fishtrap' || def.id === 'waterwheel')) return { ok: false, reason: 'You can only build on your farm or in the quarry' };
    if (m.buildingAt[i]) return { ok: false, reason: 'Blocked by a building' };
    const existing = g.ents.at(t.x, t.y);
    if (existing && !(opts.ghostOk && existing.ghost)) return { ok: false, reason: 'Something is already here' };
    const water = WATER_TERRAIN.has(ground);
    if (water) waterTiles++;
    if (ground === T.RIVER) riverTiles++;
    if (ground === T.ORE_VEIN) oreTiles++;
    const ob = m.obj[i];
    if (ob === O.TREE) treeTiles++;
    if (def.kind === 'tapper') continue;
    if (water && def.kind !== 'fishtrap' && def.id !== 'waterwheel') return { ok: false, reason: 'Can\'t build on water' };
    if (ground === T.CLIFF || ground === T.CLIFFTOP || ground === T.DEEP) return { ok: false, reason: 'Too steep' };
    if (!CLEAR_OBJ.has(ob)) return { ok: false, reason: 'Clear the ground first' };
    const soil = g.soil.get(i);
    if (soil?.crop && !soil.crop.dead) return { ok: false, reason: 'A crop is growing here' };
  }
  if (def.kind === 'fishtrap' && waterTiles < tiles.length) return { ok: false, reason: 'Place it in water' };
  if (def.id === 'waterwheel') {
    if (riverTiles < 2) return { ok: false, reason: 'Must sit in flowing river water (2+ tiles)' };
    if (riverTiles === tiles.length) return { ok: false, reason: 'Must touch the riverbank' };
    // the land half must be in a build zone
    const landOk = tiles.some((t) => BUILD_ZONES.has(m.zone[m.idx(t.x, t.y)]) || [0, 1, 2, 3].some((d) => BUILD_ZONES.has(m.z(t.x + DX[d], t.y + DY[d]))));
    if (!landOk && !opts.ignoreZone) return { ok: false, reason: 'Build it beside your farm' };
  }
  if (def.kind === 'drill' && oreTiles === 0) return { ok: false, reason: 'Place it over an ore vein' };
  if (def.kind === 'tapper') {
    if (treeTiles !== 1) return { ok: false, reason: 'Place it on a mature wild tree' };
    const tr = m.trees.get(m.idx(x, y));
    if (!tr || tr.stage < 4) return { ok: false, reason: 'The tree must be fully grown' };
    if (!STRUCT_BY_ID.has('tapper')) return { ok: false };
  }
  // don't trap the player inside a solid structure
  if (def.solid) {
    const p = g.player;
    for (const t of tiles) if (Math.abs(p.x - (t.x + 0.5)) < 0.8 && Math.abs(p.y - (t.y + 0.5)) < 0.7) return { ok: false, reason: 'You are standing there' };
  }
  return { ok: true };
}

/** Place a structure (assumes the item was already consumed). */
export function place(g: Game, defId: string, x: number, y: number, rot: Dir, ghost = false): Ent {
  const def = STRUCT_BY_ID.get(defId)!;
  const r: Dir = def.rotatable ? rot : 0;
  // remove any ghost occupying the footprint
  for (const t of structFootprint(def, x, y, r)) {
    const ex = g.ents.at(t.x, t.y);
    if (ex?.ghost) g.ents.remove(ex);
    const i = g.map.idx(t.x, t.y);
    const ob = g.map.obj[i];
    if (!ghost && (ob === O.FLOWER || ob === O.TALLGRASS || ob === O.FORAGE)) g.map.setO(t.x, t.y, O.NONE);
    if (!ghost) g.soil.delete(i);
  }
  const e = g.ents.add(defId, x, y, r, ghost);
  if (!ghost) afterPlace(g, e);
  return e;
}

export function afterPlace(g: Game, e: Ent) {
  // a path is ground, not a structure: it becomes a path or plank tile (the pickaxe lifts it again)
  if (e.def.kind === 'path') {
    g.ents.remove(e);
    g.map.setG(e.x, e.y, e.def.id === 'path_wood' ? T.PLANKS : T.PATH);
    g.map.objData[g.map.idx(e.x, e.y)] = e.def.id === 'path_brick' ? 2 : 0;
    g.emit({ t: 'sfx', id: 'place', x: e.x, y: e.y });
    return;
  }
  if (e.def.kind === 'underground' && e.belt) pairUnderground(g, e);
  if (e.def.kind === 'tapper') e.st.tree = g.map.idx(e.x, e.y);
  g.emit({ t: 'fx', kind: 'dust', x: e.x + e.w / 2, y: e.y + e.h / 2, n: 8 });
  g.emit({ t: 'sfx', id: 'place', x: e.x, y: e.y });
}

export function pairUnderground(g: Game, e: Ent) {
  const b = e.belt!;
  const reach = e.def.reach ?? 4;
  const back = opposite(e.rot);
  for (let d = 1; d <= reach + 1; d++) {
    const o = g.ents.at(e.x + DX[back] * d, e.y + DY[back] * d);
    if (!o || o.def.id !== e.def.id || o.ghost) continue;
    if (o.rot === e.rot && o.belt!.kind === BeltKind.UnderIn && !o.belt!.partner) {
      b.kind = BeltKind.UnderOut;
      b.partner = o;
      o.belt!.partner = e;
      g.ents.beltsDirty = true;
      return;
    }
    if (o.rot === e.rot) break; // an intervening paired/out piece blocks
  }
  b.kind = BeltKind.UnderIn;
  g.ents.beltsDirty = true;
}

/** Everything inside a structure (returned to the player on removal). */
export function contents(e: Ent): Stack[] {
  const out: Stack[] = [];
  const push = (s: Stack | null | undefined) => {
    if (!s || s.n <= 0) return;
    const ex = out.find((o) => o.k === s.k);
    if (ex) ex.n += s.n;
    else out.push({ k: s.k, n: s.n });
  };
  const all = e.child ? [e, e.child] : [e];
  for (const r of all) {
    if (r.belt) for (const L of r.belt.lanes) for (const k of L.k) push({ k, n: 1 });
    if (r.arm?.held) push(r.arm.held);
    if (r.mach) {
      for (const [k, n] of r.mach.inBuf) push({ k, n });
      for (const s of r.mach.outBuf) push(s);
      push(r.mach.fuel);
      if (r.mach.crafting && r.mach.recipe) for (const i of r.mach.recipe.in) if (i.item[0] !== '#') push({ k: key(i.item), n: i.n });
    }
    if (r.inv) for (const s of r.inv.slots) push(s);
    if (r.gen?.fuel) push(r.gen.fuel);
    if (r.st?.fuel) push(r.st.fuel);
    if (r.def.kind === 'hive' && r.st.bots) push({ k: key('bumblebot'), n: r.st.bots });
  }
  return out;
}

/** Remove a structure, refunding it and its contents to the player. */
export function deconstruct(g: Game, e: Ent, refund = true): boolean {
  const root = e.parent ?? e;
  if (root.st.fixed) {
    g.toast("That can't be moved.");
    return false;
  }
  if (root.st.rust && refund) {
    g.toast(`The keeper's ${root.def.name.toLowerCase()} is rusted solid. Press F to restore it first.`);
    return false;
  }
  // the farm's structures, or the farmhouse's (Workshop HQ)
  const store = storeOf(g, root);
  if (root.ghost) {
    store.remove(root);
    return true;
  }
  if (refund) {
    for (const s of contents(root)) g.give(s.k, s.n, false);
    g.give(key(root.def.item), 1);
  }
  store.remove(root);
  g.count('decon');
  g.sys.onRemove?.forEach?.((f: (g: Game, e: Ent) => void) => f(g, root));
  g.emit({ t: 'fx', kind: 'dust', x: root.x + root.w / 2, y: root.y + root.h / 2, n: 10 });
  g.emit({ t: 'sfx', id: 'pickup_struct', x: root.x, y: root.y });
  return true;
}

/** Rotate a placed rotatable structure in place. */
export function rotateStruct(g: Game, e: Ent) {
  const root = e.parent ?? e;
  if (!root.def.rotatable || root.ghost) return;
  if (root.def.kind === 'splitter' || root.def.kind === 'drill') return; // footprint would change
  root.rot = ((root.rot + 1) & 3) as Dir;
  if (root.belt) {
    g.ents.beltsDirty = true;
    if (root.def.kind === 'underground') {
      // flip entrance/exit when rotating an underground: keep pairing simple
      if (root.belt.partner) {
        root.belt.partner.belt!.partner = null;
        pairUnderground(g, root.belt.partner);
      }
      root.belt.partner = null;
      pairUnderground(g, root);
    }
  }
  storeOf(g, root).version++;
  g.emit({ t: 'sfx', id: 'rotate', x: root.x, y: root.y });
}
