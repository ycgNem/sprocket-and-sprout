// Who teaches which recipe. Recipes not listed here are known from the start.
// Each villager mails the recipe once you reach the Trust level; the ledger's almanac page also
// teaches one unknown recipe every Sunday. The villagers who cook teach the cooking: the works'
// specialists reward Trust with works things instead (src/data/trust.ts; the critic's Phase 5
// review found Bram's, Thorne's, Hazel's and Pip's rewards were soup).
export interface RecipeTeacher { npc: string; hearts: number; note: string }

export const RECIPE_TEACHERS: Record<string, RecipeTeacher> = {
  pancakes: { npc: 'rowan', hearts: 2, note: "My Sunday pancakes. The secret is patience: don't flip until the bubbles pop." },
  pizza: { npc: 'rowan', hearts: 4, note: 'Hearth pizza, the way my grandmother made it in the old brick oven.' },
  mushroom_risotto: { npc: 'rowan', hearts: 6, note: 'My risotto. I have never written this down for anyone. Stir like you mean it.' },
  berry_tart: { npc: 'marigold', hearts: 2, note: 'My berry tart. Folks ask for it at every church supper.' },
  cake: { npc: 'marigold', hearts: 5, note: 'The celebration cake. For birthdays, harvests, and bad days that need fixing.' },
  fried_fish: { npc: 'wren', hearts: 2, note: 'How we fry the catch down at the hut. Hot oil, cold batter.' },
  fish_stew: { npc: 'wren', hearts: 4, note: 'Fisher\'s stew. Whatever came up in the net, simmered with love.' },
  corn_chowder: { npc: 'clem', hearts: 3, note: 'Corn chowder for cold mornings at the ranch. Use good milk.' },
  miners_pie: { npc: 'clem', hearts: 5, note: "Miner's pie, the way the quarry crews liked it. Good beef, good crust, no fuss." },
  chestnut_soup: { npc: 'marigold', hearts: 3, note: 'Chestnut soup. The forest gives, if you ask politely.' },
  glow_sorbet: { npc: 'ines', hearts: 6, note: 'Glow sorbet. A very old recipe, and good for a fever. Serve it under the stars.' },
  stuffed_peppers: { npc: 'roxy', hearts: 3, note: 'Stuffed ember peppers. City folk pay double for anything that burns, and this is the dish they mean.' },
  roast_yam: { npc: 'ines', hearts: 2, note: 'A simple, nourishing dish. Doctor\'s orders: eat your vegetables.' },
  pumpkin_pie: { npc: 'tobias', hearts: 4, note: 'The official pumpkin pie of the Thistlewick Harvest. Mayor-approved.' },
  honey_bun: { npc: 'rowan', hearts: 3, note: "Honey buns. Pip says they invented them. Pip did not, but don't tell them I said so." },
};

export const recipeFlag = (out: string) => 'recipe_' + out;

/** "Mayor Tobias Fenwick" -> "Tobias", "Dr. Ines Marrow" -> "Ines" */
export function shortName(name: string): string {
  const w = name.split(' ');
  return (['Mayor', 'Dr.', 'Old', 'Professor', 'Granny', 'Captain'].includes(w[0]) && w[1] ? w[1] : w[0]);
}

/** Villagers whose quest name isn't their first name (DECISIONS #55: the playtest got lost between "Ottoline" and "the Professor"). */
const QUEST_NAMES: Record<string, string> = { ottoline: 'Prof. Cogwhistle' };

/** How quests, guide arrows, the tracker and the map name a villager. Friends' dialogue keeps first names. */
export function questName(id: string, name: string): string {
  return QUEST_NAMES[id] ?? shortName(name);
}
