// Which seasons an item can be had in from what grows then (the owner: "make sure they ask for items
// in season, like bread needs wheat which is seasonal"). The orders board asks only for these
// (src/sim/systems/orders.ts). An item's seasons come from its sources:
// - a crop's produce: the crop's seasons; a fruit tree's fruit: its season; a fish: its seasons;
//   forage: the season the woods grow it (or its season tag);
// - anything made: the seasons any one of its recipes has all its inputs in (a tag input, such as
//   "#flour", is in season when any item it matches is);
// - everything else (wood, ore, coal, eggs and milk, honey, shop goods): every season.
// Stored goods carry over, but the board doesn't count on them: a loaf waits for the wheat.
import { CROPS } from '../data/crops';
import { FISH } from '../data/fish';
import { ITEMS, matchesSpec } from '../data/items';
import { RECIPES } from '../data/recipes';
import { TREES } from '../data/trees';
import { FORAGE } from './systems/farming';

const ALL = 0b1111;
const SEASON_TAG = ['spring_forage', 'summer_forage', 'fall_forage', 'winter_forage'];
/** categories that are gathered, mined, caught or bought, not made: every season unless a source above says otherwise */
const RAW = new Set(['resource', 'mineral', 'ore', 'gem', 'animal', 'forage', 'fish', 'fruit', 'flower', 'crop', 'seed', 'monster', 'trash', 'misc', 'bait', 'fertilizer']);

let masks: Map<string, number> | null = null;

/** every item's seasons (bit s = season s), worked out once */
function all(): Map<string, number> {
  if (masks) return masks;
  const m = new Map<string, number>();
  // what grows or is caught, by its seasons
  const add = (id: string, mask: number) => m.set(id, (m.get(id) ?? 0) | mask);
  for (const c of CROPS) add(c.produce, c.seasons.reduce((a: number, s) => a | (1 << s), 0));
  for (const t of TREES) if (t.fruit && t.season >= 0) add(t.fruit, 1 << t.season);
  for (const f of FISH) add(f.id, f.seasons.reduce((a: number, s) => a | (1 << s), 0));
  for (const [s, ids] of Object.entries(FORAGE)) for (const id of ids) add(id, 1 << Number(s));
  for (const d of ITEMS) SEASON_TAG.forEach((t, s) => { if (d.tags?.includes(t)) add(d.id, 1 << s); });
  // the rest of the raw goods, and anything no recipe makes: every season
  const made = new Map<string, typeof RECIPES>();
  for (const r of RECIPES) for (const o of r.out) if (o.chance === undefined) made.set(o.item, [...(made.get(o.item) ?? []), r]);
  for (const d of ITEMS) if (!m.has(d.id) && (RAW.has(d.cat) || !made.has(d.id))) m.set(d.id, ALL);
  // the made goods: start at none and add what each recipe allows until nothing changes (a loop of
  // recipes, a thing made from itself, adds nothing)
  const tagItems = new Map<string, string[]>();
  const spec = (s: string): number => {
    if (s[0] !== '#') return m.get(s) ?? ALL;
    let ids = tagItems.get(s);
    if (!ids) tagItems.set(s, (ids = ITEMS.filter((d) => matchesSpec(d, s)).map((d) => d.id)));
    return ids.reduce((a, id) => a | (m.get(id) ?? 0), 0);
  };
  const todo = ITEMS.filter((d) => !m.has(d.id)).map((d) => d.id);
  for (const id of todo) m.set(id, 0);
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of todo) {
      const now = made.get(id)!.reduce((a, r) => a | r.in.reduce((b, i) => b & spec(i.item), ALL), 0);
      if (now !== m.get(id)) {
        m.set(id, now);
        changed = true;
      }
    }
  }
  // made only through a loop: every season, rather than never
  for (const id of todo) if (!m.get(id)) m.set(id, ALL);
  masks = m;
  return m;
}

/** an order line's spec, an item or "#tag" (a tag is in season when any item it matches is): its seasons as bits */
export function specMask(spec: string): number {
  const m = all();
  if (spec[0] !== '#') return m.get(spec) ?? ALL;
  let out = 0;
  for (const d of ITEMS) if (matchesSpec(d, spec)) out |= m.get(d.id) ?? ALL;
  return out || ALL;
}

/** can this be had in this season (0 spring ... 3 winter)? */
export const inSeason = (spec: string, season: number) => (specMask(spec) & (1 << season)) !== 0;
