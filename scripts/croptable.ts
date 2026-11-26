// Coins per tile per day for every crop, raw and preserved, over the seasons it grows in a row
// (a 28-day season; a plant sown on day 1, watered every day). `npx tsx scripts/croptable.ts`.
// The economy's first check: no crop should be several times the next best (DECISIONS #177).
import { CROPS } from '../src/data/crops';
import { ITEM_BY_ID } from '../src/data/items';

export interface CropRow { id: string; raw: number; kept: number; keptAs: string; days: number; harvests: number }

/** harvests of one plant in `days` days: the first after its stages, then one each regrow */
export function harvestsIn(stages: number[], regrow: number | undefined, days: number): number {
  const first = stages.reduce((a, b) => a + b, 0);
  if (first >= days) return 0;
  // a crop with no regrow is sown again the day it's picked
  return regrow ? 1 + Math.floor((days - 1 - first) / regrow) : Math.floor((days - 1) / first);
}

export function cropTable(): CropRow[] {
  return CROPS.map((c) => {
    // seasons in a row from its first (a crop of spring and fall counts one season at a time)
    let run = 1;
    for (let i = 1; i < c.seasons.length && c.seasons[i] === c.seasons[i - 1] + 1; i++) run++;
    const days = 28 * run;
    const h = harvestsIn(c.stages, c.regrow, days);
    const y = c.yield ? (c.yield[0] + c.yield[1]) / 2 : 1;
    const seeds = c.regrow ? 1 : h;
    const raw = (h * y * c.price - seeds * c.seedPrice) / days;
    const forms = [`pickles_${c.produce}`, `jam_${c.produce}`].map((id) => ITEM_BY_ID.get(id)).filter(Boolean);
    const best = forms.sort((a, b) => b!.price - a!.price)[0];
    const kept = best ? (h * y * best.price - seeds * c.seedPrice) / days : raw;
    return { id: c.id, raw, kept, keptAs: best?.id.split('_')[0] ?? '', days, harvests: h };
  });
}

if (process.argv[1]?.includes('croptable')) {
  const rows = cropTable().sort((a, b) => b.kept - a.kept);
  console.log('crop'.padEnd(14), 'raw/tile/day', 'kept/tile/day', 'harvests');
  for (const r of rows) console.log(r.id.padEnd(14), r.raw.toFixed(1).padStart(8), r.kept.toFixed(1).padStart(12), (r.keptAs || '-').padStart(8), String(r.harvests).padStart(4));
}
