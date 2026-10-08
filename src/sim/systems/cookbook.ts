// Learning recipes: villagers mail their recipes as friendship grows; the almanac teaches one
// unknown recipe every Sunday.
import { RECIPE_TEACHERS, recipeFlag, shortName } from '../../data/cookbook';
import { ITEM_BY_ID } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { C } from '../../data/palette';
import { Game, registerSystem } from '../Game';
import { send } from './goals';
import { hearts, npcSys } from './npcs';

export function knowsRecipe(g: Game, out: string) {
  return !RECIPE_TEACHERS[out] || g.flags.has(recipeFlag(out));
}

export function learnRecipe(g: Game, out: string, from?: string) {
  if (knowsRecipe(g, out)) return false;
  g.flags.add(recipeFlag(out));
  const name = ITEM_BY_ID.get(out)?.name ?? out;
  g.toast(`New recipe: ${name}${from ? ` (from ${from})` : ''}!`, out, C.amber);
  g.emit({ t: 'sfx', id: 'quest' });
  g.count('recipes');
  return true;
}

export function unknownRecipes(g: Game): string[] {
  return Object.keys(RECIPE_TEACHERS).filter((id) => !knowsRecipe(g, id));
}

/** called by the almanac: on Sundays, copy one new recipe into your notebook */
export function almanacRecipe(g: Game): string | null {
  if (g.weekday !== 6) return null;
  const week = Math.floor(g.dayIndex / 7);
  if (g.sys.cookbookWeek === week) return null;
  const left = unknownRecipes(g);
  if (!left.length) return null;
  g.sys.cookbookWeek = week;
  const id = left[(week * 7 + 3) % left.length];
  learnRecipe(g, id, 'the almanac');
  return id;
}

registerSystem({
  name: 'cookbook',
  dayStart(g) {
    // brand-new games use the cookbook; older saves get everything (see afterLoad)
    if (g.daysPlayed === 0) g.flags.add('cookbook_v1');
    if (!g.sys.npcs) return;
    for (const [out, t] of Object.entries(RECIPE_TEACHERS)) {
      if (knowsRecipe(g, out)) continue;
      const n = npcSys(g).byId.get(t.npc);
      if (!n || hearts(n) < t.hearts) continue;
      const who = shortName(NPC_BY_ID.get(t.npc)?.name ?? t.npc);
      send(g, 'recipe_' + out, { from: t.npc, title: `Recipe: ${ITEM_BY_ID.get(out)?.name}`, text: `${t.note}\n\nI copied it out for you. - ${who}` });
      learnRecipe(g, out, who);
    }
  },
  afterLoad(g) {
    if (g.flags.has('cookbook_v1')) return;
    for (const out of Object.keys(RECIPE_TEACHERS)) g.flags.add(recipeFlag(out));
    g.flags.add('cookbook_v1');
  },
});
