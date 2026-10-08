// Blueprints: copy an area of structures (with settings), rotate, and paste.
// Missing items become ghost structures that get built when items are available.
import { STRUCT_BY_ID } from '../data/structures';
import { RECIPE_BY_ID } from '../data/recipes';
import type { Game } from './Game';
import { Dir } from './ents';
import { key } from './inventory';
import { canPlace, place, structFootprint } from './build';

export interface BlueprintItem {
  def: string;
  dx: number;
  dy: number;
  rot: Dir;
  recipe?: string;
  filter?: number[];
}

export interface Blueprint {
  items: BlueprintItem[];
  w: number;
  h: number;
}

export function copyBlueprint(g: Game, x0: number, y0: number, x1: number, y1: number): Blueprint {
  const items: BlueprintItem[] = [];
  const seen = new Set<number>();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const e = g.ents.rootAt(x, y);
      if (!e || seen.has(e.id) || e.st.fixed) continue;
      seen.add(e.id);
      if (e.def.kind === 'building' || e.def.kind === 'megaproject') continue;
      const it: BlueprintItem = { def: e.def.id, dx: e.x - x0, dy: e.y - y0, rot: e.rot };
      if (e.mach?.locked && e.mach.recipe) it.recipe = e.mach.recipe.id;
      if (e.arm?.filter.length) it.filter = [...e.arm.filter];
      items.push(it);
    }
  return { items, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Rotate 90 degrees clockwise around the blueprint origin. */
export function rotateBlueprint(bp: Blueprint): Blueprint {
  const items = bp.items.map((it) => {
    const def = STRUCT_BY_ID.get(it.def)!;
    // footprint after rotation
    const tiles = structFootprint(def, 0, 0, def.rotatable ? it.rot : 0);
    const w = Math.max(...tiles.map((t) => t.x)) + 1, h = Math.max(...tiles.map((t) => t.y)) + 1;
    const nrot = (def.rotatable ? (it.rot + 1) & 3 : 0) as Dir;
    let nx = bp.h - it.dy - h;
    let ny = it.dx;
    if (def.kind === 'splitter') {
      // splitter origin is its left half; after rotating the right half sits below
      nx = bp.h - 1 - it.dy;
      ny = it.dx;
    }
    void w;
    return { ...it, dx: nx, dy: ny, rot: nrot };
  });
  return { items, w: bp.h, h: bp.w };
}

export function blueprintCost(bp: Blueprint): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of bp.items) {
    const item = STRUCT_BY_ID.get(it.def)!.item;
    m.set(item, (m.get(item) ?? 0) + 1);
  }
  return m;
}

export function pasteBlueprint(g: Game, bp: Blueprint, ox: number, oy: number): { placed: number; ghosts: number } {
  let placed = 0, ghosts = 0;
  for (const it of bp.items) {
    const x = ox + it.dx, y = oy + it.dy;
    const chk = canPlace(g, it.def, x, y, it.rot, { ghostOk: true });
    if (!chk.ok) continue;
    const def = STRUCT_BY_ID.get(it.def)!;
    const k = key(def.item);
    const have = g.player.inv.count(k) > 0;
    if (have) g.player.inv.remove(k, 1);
    const e = place(g, it.def, x, y, it.rot, !have);
    if (have) placed++;
    else ghosts++;
    e.st.bpRecipe = it.recipe;
    e.st.bpFilter = it.filter;
    applyBlueprintSettings(g, e);
  }
  return { placed, ghosts };
}

export function applyBlueprintSettings(g: Game, e: any) {
  if (e.ghost) return;
  if (e.st.bpRecipe && e.mach) {
    const r = RECIPE_BY_ID.get(e.st.bpRecipe);
    if (r) {
      e.mach.recipe = r;
      e.mach.locked = true;
    }
  }
  if (e.st.bpFilter && e.arm) e.arm.filter = [...e.st.bpFilter];
  delete e.st.bpRecipe;
  delete e.st.bpFilter;
  void g;
}
