// Quick stack: move bag items into nearby chests that already hold the same item.
import type { Game } from './Game';
import type { Ents } from './ents';
import type { Inventory } from './inventory';

export const STACK_RANGE = 7;

export function quickStack(g: Game): { moved: number; chests: number; cellar: boolean } {
  const p = g.player;
  const targets: Inventory[] = [];
  const near = (store: Ents) => {
    for (const e of store.others) {
      if (e.def.kind !== 'chest' || e.ghost || !e.inv) continue;
      if (e.def.id === 'crate_out' || e.def.id === 'crate_req') continue;
      if (Math.hypot(e.x + e.w / 2 - p.x, e.y + e.h / 2 - p.y) > STACK_RANGE) continue;
      targets.push(e.inv);
    }
  };
  const pantry: Inventory | undefined = p.where === 'house' ? g.sys.house?.pantry : undefined;
  if (p.where === 'world') near(g.ents);
  else if (p.where === 'house') {
    // the root cellar first, then the chests in the farmhouse (Workshop HQ)
    if (pantry) targets.push(pantry);
    near(g.houseEnts);
  }
  let moved = 0;
  const used = new Set<Inventory>();
  // only the bag rows: the hotbar stays as it is
  for (let i = 12; i < p.inv.slots.length; i++) {
    const st = p.inv.slots[i];
    if (!st) continue;
    for (const inv of targets) {
      if (!inv.slots.some((s) => s && s.k === st.k)) continue;
      const left = inv.add(st.k, st.n);
      const n = st.n - left;
      if (n > 0) {
        moved += n;
        used.add(inv);
        st.n = left;
      }
      if (st.n <= 0) break;
    }
    if (st.n <= 0) p.inv.slots[i] = null;
  }
  return { moved, chests: used.size, cellar: !!pantry && used.has(pantry) };
}
