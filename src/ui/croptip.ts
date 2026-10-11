// A crop's hover tip (the owner after 2.0: "make it so you know what you have planted if you hover
// over plant"): what it is, when it's ripe, whether it's watered today, and its seasons.
import { CROP_BY_ID } from '../data/crops';
import { ITEM_BY_ID } from '../data/items';
import { C } from '../data/palette';
import { SEASON_NAMES } from '../data/types';
import type { Game } from '../sim/Game';
import { daysToRipe, inGreenhouse } from '../sim/systems/farming';
import type { TipLine } from './ui';

/** "spring", "spring and summer", "summer, fall and winter" */
const seasonList = (ss: number[]) => {
  const n = ss.map((s) => SEASON_NAMES[s].toLowerCase());
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0] ?? '';
};

/** the tip for the crop on tile i, or null when nothing grows there */
export function cropTip(g: Game, i: number): TipLine[] | null {
  const s = g.soil.get(i);
  const c = s?.crop;
  const cr = c && CROP_BY_ID.get(c.id);
  if (!s || !c || !cr) return null;
  const lines: TipLine[] = [{ text: (c.giant >= 0 ? 'Giant ' : '') + cr.name, color: C.amber }];
  if (c.dead) {
    lines.push({ text: 'Withered. F clears it', color: C.pebble });
    return lines;
  }
  if (c.ready) lines.push({ text: cr.scythe ? 'Ripe: cut it with the scythe' : 'Ripe: F to harvest', color: C.lime });
  else {
    const n = daysToRipe(g, s);
    lines.push({ text: c.harvests ? `Grows back in ${n} day${n === 1 ? '' : 's'} if watered` : n === 1 ? 'Ripe tomorrow if watered' : `Ripe in ${n} days if watered`, color: C.cream });
    lines.push(s.water ? { text: 'Watered today', color: C.aqua } : { text: 'Needs water today', color: C.amber });
  }
  const grows = inGreenhouse(g, i) ? 'Under glass: grows all year' : `Grows in ${seasonList(cr.seasons)}`;
  lines.push({ text: grows + (cr.regrow ? `, regrows every ${cr.regrow} days` : ''), color: C.pebble });
  const fert = s.fert && ITEM_BY_ID.get(s.fert)?.name;
  if (fert) lines.push({ text: `Fertilized: ${fert}`, color: C.pebble });
  return lines;
}
