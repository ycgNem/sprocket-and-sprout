// Fish ponds: stock one species; the school grows daily, lays roe and now and then a new fish.
import { ITEM_BY_ID } from '../../data/items';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { ItemKey, kDef, key } from '../inventory';
import { PORT_HANDLERS } from '../ports';

export const POND_CAP = 10;

export function pondAccepts(e: Ent, k: ItemKey): boolean {
  const d = kDef(k);
  if (d.cat !== 'fish' || d.tags?.includes('legendary')) return false;
  if ((e.st.pop ?? 0) >= POND_CAP) return false;
  return !e.st.fish || e.st.fish === d.id;
}

export function stockPond(g: Game, e: Ent, k: ItemKey): boolean {
  if (!pondAccepts(e, k)) return false;
  e.st.fish = kDef(k).id;
  e.st.pop = (e.st.pop ?? 0) + 1;
  g.emit({ t: 'fx', kind: 'splash', x: e.x + 1.5, y: e.y + 1.5 });
  return true;
}

PORT_HANDLERS.pond = {
  accept: (_g, e, k) => (pondAccepts(e, k) ? 1 : 0),
  insert: (g, e, k, n) => (n > 0 && stockPond(g, e, k) ? 1 : 0),
  take: (_g, e, pred, max) => {
    for (const s of e.inv!.slots) {
      if (!s || !pred(s.k)) continue;
      const m = typeof max === 'number' ? max : max(s.k);
      const n = Math.min(s.n, Math.max(1, m));
      e.inv!.remove(s.k, n);
      return { k: s.k, n };
    }
    return null;
  },
};

function pondDay(g: Game, e: Ent) {
  const fish = e.st.fish as string | undefined;
  const pop = e.st.pop ?? 0;
  if (!fish || pop <= 0) return;
  // Pond Keeper (fishing 5): the school grows and lays roe half again as fast
  const keeper = g.hasPerk('angler') ? 1.5 : 1;
  // the school grows
  if (pop < POND_CAP && g.rng.next() < 0.5 * keeper) e.st.pop = pop + 1;
  // roe: more fish, more roe
  const laid = ((g.rng.next() < 0.7 ? 1 : 0) + Math.floor(pop / 4)) * keeper;
  const roe = Math.floor(laid) + (g.rng.next() < laid % 1 ? 1 : 0);
  if (roe) e.inv!.add(key('roe'), roe);
  // a crowded pond sometimes spawns a fish you can take out
  if (pop >= 8 && g.rng.next() < 0.2 && ITEM_BY_ID.has(fish)) e.inv!.add(key(fish), 1);
}

registerSystem({
  name: 'ponds',
  dayEnd(g) {
    for (const e of g.ents.others) if (e.def.kind === 'pond' && !e.ghost) pondDay(g, e);
  },
});
