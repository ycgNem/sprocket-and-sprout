// Hand crafting from the player's inventory.
import { RECIPES } from '../data/recipes';
import type { RecipeDef } from '../data/types';
import type { Game } from './Game';
import { key } from './inventory';

export const HAND_RECIPES = RECIPES.filter((r) => r.station === 'hand');

export function canCraft(g: Game, r: RecipeDef, times = 1): boolean {
  if (!g.unlocked(r.unlock)) return false;
  // sandbox: everything is free to build
  if (g.mode === 'sandbox') return true;
  const inv = g.player.inv;
  // specs may overlap (e.g. '#crop' and a specific crop): check greedily on a copy
  const need = new Map<string, number>();
  for (const i of r.in) need.set(i.item, (need.get(i.item) ?? 0) + i.n * times);
  for (const [spec, n] of need) if (inv.countSpec(spec) < n) return false;
  return true;
}

export function maxCraftable(g: Game, r: RecipeDef): number {
  let n = 0;
  while (n < 999 && canCraft(g, r, n + 1)) n++;
  return n;
}

export function craft(g: Game, r: RecipeDef, times = 1): number {
  let made = 0;
  for (let t = 0; t < times; t++) {
    if (!canCraft(g, r, 1)) break;
    // specific ids first so tags don't eat them
    const ins = [...r.in].sort((a, b) => (a.item[0] === '#' ? 1 : 0) - (b.item[0] === '#' ? 1 : 0));
    if (g.mode !== 'sandbox') for (const i of ins) for (const s of g.player.inv.removeSpec(i.item, i.n)) g.stats.use(s.k, s.n);
    for (const o of r.out) {
      if (o.chance !== undefined && g.rng.next() >= o.chance) continue;
      g.give(key(o.item), o.n, t === times - 1);
    }
    made++;
  }
  if (made) {
    g.emit({ t: 'sfx', id: 'collect' });
    g.addXp('tinkering', made * 2);
    g.sys.quests?.notify?.(g, 'craft', made, r.out[0].item);
  }
  return made;
}
