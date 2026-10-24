// Who teaches which recipe. Recipes not listed here are known from the start.
// Each villager mails their recipe the morning after the town keystone it waits for (`after`); one
// sold at a shop (`sold`) comes as a recipe card instead, and the traveling cart sells any card you
// don't know. The ledger's almanac page also teaches one unknown recipe every Sunday. (Until 2.1.1
// they came with Trust, DECISIONS #175.)
export interface RecipeTeacher {
  npc: string;
  /** the keystone flag after which they mail it ('town_mill', 'waterworks', 'tram') */
  after?: string;
  /** a shop that sells its recipe card instead (Thorne's Hollow sells the glow sorbet) */
  sold?: string;
  note: string;
}

/** how the cookbook says when a keystone's recipes come */
export const KEYSTONE_WHEN: Record<string, string> = { town_mill: 'once the Town Mill turns', waterworks: 'once the Waterworks flow', tram: 'once the Tram runs' };

export const RECIPE_TEACHERS: Record<string, RecipeTeacher> = {
  pancakes: { npc: 'rowan', after: 'town_mill', note: "My Sunday pancakes. The secret is patience: don't flip until the bubbles pop." },
  pizza: { npc: 'rowan', after: 'waterworks', note: 'Hearth pizza, the way my grandmother made it in the old brick oven.' },
  mushroom_risotto: { npc: 'rowan', after: 'tram', note: 'My risotto. I have never written this down for anyone. Stir like you mean it.' },
  berry_tart: { npc: 'marigold', after: 'town_mill', note: 'My berry tart. Folks ask for it at every church supper.' },
  cake: { npc: 'marigold', after: 'waterworks', note: 'The celebration cake. For birthdays, harvests, and bad days that need fixing.' },
  fried_fish: { npc: 'wren', after: 'town_mill', note: 'How we fry the catch down at the hut. Hot oil, cold batter.' },
  fish_stew: { npc: 'wren', after: 'waterworks', note: 'Fisher\'s stew. Whatever came up in the net, simmered with love.' },
  corn_chowder: { npc: 'clem', after: 'town_mill', note: 'Corn chowder for cold mornings at the ranch. Use good milk.' },
  miners_pie: { npc: 'clem', after: 'tram', note: "Miner's pie, the way the quarry crews liked it. Good beef, good crust, no fuss." },
  chestnut_soup: { npc: 'marigold', after: 'town_mill', note: 'Chestnut soup. The forest gives, if you ask politely.' },
  glow_sorbet: { npc: 'thorne', sold: 'hermit', note: "Glow sorbet, from the old works' glasshouse kitchen. Glowmelon, sugar and a frost shard: it keeps a worker cool by a furnace all night." },
  stuffed_peppers: { npc: 'roxy', after: 'waterworks', note: 'Stuffed ember peppers. City folk pay double for anything that burns, and this is the dish they mean.' },
  roast_yam: { npc: 'ines', after: 'town_mill', note: 'A simple, nourishing dish. Doctor\'s orders: eat your vegetables.' },
  pumpkin_pie: { npc: 'tobias', after: 'waterworks', note: 'The official pumpkin pie of the Thistlewick Harvest. Mayor-approved.' },
  honey_bun: { npc: 'rowan', after: 'town_mill', note: "Honey buns. Pip says they invented them. Pip did not, but don't tell them I said so." },
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
