// Rich tooltips for items and structures.
import { BUFF_INFO, buffText } from '../data/buffs';
import { C } from '../data/palette';
import { STRUCT_BY_ID } from '../data/structures';
import { CROP_BY_SEED } from '../data/crops';
import { recipesFor } from '../data/recipes';
import type { Game } from '../sim/Game';
import { itemName, kDef, QUALITY_NAMES, sellPrice } from '../sim/inventory';
import type { TipLine } from './ui';
import { ICON } from './font';

const CAT_NAMES: Record<string, string> = {
  tool: 'Tool', weapon: 'Weapon', seed: 'Seed', crop: 'Vegetable', fruit: 'Fruit', flower: 'Flower', forage: 'Forage', animal: 'Animal product',
  artisan: 'Artisan good', fish: 'Fish', mineral: 'Mineral', ore: 'Ore', bar: 'Metal bar', gem: 'Gem', resource: 'Resource', component: 'Part',
  food: 'Cooking', placeable: 'Structure', research: 'Research bundle', misc: 'Curio', monster: 'Monster loot', fertilizer: 'Fertilizer', bait: 'Bait', trash: 'Trash',
};
const Q_COL = [C.cream, C.pebble, C.amber, C.lavender];

export function marketPrice(g: Game, k: number): number {
  const base = sellPrice(k);
  const f = g.sys.market?.mult?.(g, k >> 2) ?? 1;
  return Math.max(base > 0 ? 1 : 0, Math.round(base * f * (1 + g.mods.marketBonus)));
}

export function itemTooltip(g: Game, k: number, n = 1, extra: TipLine[] = []): TipLine[] {
  const d = kDef(k);
  const q = k & 3;
  const lines: TipLine[] = [{ text: itemName(k), color: Q_COL[q] }, { text: CAT_NAMES[d.cat] ?? d.cat, color: C.pebble }, { text: d.desc, color: C.butter }];
  if (q) lines.push({ text: `${QUALITY_NAMES[q]} quality`, color: Q_COL[q] });
  if (d.edible) lines.push({ text: `${ICON.bolt} +${Math.round(d.edible.energy * [1, 1.4, 1.8, 2.5][q])} energy   ${ICON.heart} +${Math.round((d.edible.health ?? 0) * [1, 1.4, 1.8, 2.5][q])}`, color: C.lime });
  if (d.edible?.buff) lines.push({ text: buffText(d.edible.buff), color: BUFF_INFO[d.edible.buff.kind].color });
  if (d.plant?.crop) {
    const cr = CROP_BY_SEED.get(d.id);
    if (cr) lines.push({ text: `Sells for ${cr.price} when grown`, color: C.pebble });
  }
  if (d.places) {
    const s = STRUCT_BY_ID.get(d.places);
    if (s) {
      const bits: string[] = [];
      if (s.kind === 'belt' || s.kind === 'underground' || s.kind === 'splitter') bits.push(`${(s.speed! * 8).toFixed(0)} items/s`);
      if (s.kind === 'arm') bits.push(`${(s.speed! * (s.hand ?? 1) * 60).toFixed(0)} items/min`, s.reach! > 1 ? `reach ${s.reach}` : '');
      if (s.powerUse) bits.push(`uses ${s.powerUse} ${ICON.bolt}`);
      if (s.powerGen) bits.push(`makes ${s.powerGen} ${ICON.bolt}`);
      if (s.slots) bits.push(`${s.slots} slots`);
      if (s.speed && s.kind === 'machine') bits.push(`speed x${s.speed}`);
      if (s.fuel) bits.push('burns fuel');
      bits.push(`${s.size[0]}x${s.size[1]}`);
      lines.push({ text: bits.filter(Boolean).join(', '), color: C.aqua });
      if (s.rotatable) lines.push({ text: 'Press R to rotate before placing.', color: C.pebble });
    }
  }
  if (d.fuel) lines.push({ text: `Fuel: burns for ${d.fuel}s`, color: C.apricot });
  if (d.tool) lines.push({ text: `Tier ${d.tool.tier + 1} of 5`, color: C.pebble });
  if (d.weapon) lines.push({ text: `Damage ${d.weapon.dmg}  Speed ${d.weapon.speed}`, color: C.blush });
  const made = recipesFor(d.id).filter((r) => r.station !== 'hand' || d.places === undefined).slice(0, 2);
  if (made.length && d.cat !== 'seed') {
    const where = [...new Set(made.map((r) => (r.station === 'hand' ? 'crafting' : stationName(r.station))))].join(', ');
    lines.push({ text: `Made by: ${where}`, color: C.pebble });
  }
  const price = marketPrice(g, k);
  if (price > 0) {
    const base = sellPrice(k);
    const trend = price < base * 0.9 ? ' (flooded market)' : price > base * 1.1 ? ' (in demand!)' : '';
    lines.push({ text: `${ICON.coin}${price}${n > 1 ? `  (stack: ${price * n})` : ''}${trend}`, color: trend.includes('flood') ? C.rose : trend ? C.lime : C.amber });
  }
  return [...lines, ...extra];
}

export function stationName(st: string): string {
  const names: Record<string, string> = {
    keg: 'Keg', jar: 'Preserving Crock', smelter: 'Furnace', oven: 'Oven', press: 'Cheese Press', loom: 'Loom', seeds: 'Seed Sifter', compost: 'Compost Bin',
    charcoal: 'Charcoal Kiln', kiln: 'Brick Kiln', bees: 'Bee Skep', mill: 'Grist Mill', sawmill: 'Sawmill', bottler: 'Bottler', assembler: "Tinker's Bench",
    crusher: 'Rock Crusher', roaster: 'Bean Roaster',
  };
  return names[st] ?? st;
}
