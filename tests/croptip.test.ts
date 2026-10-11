// Hovering a crop says what it is and when it's ripe (the owner after 2.0: "make it so you know what
// you have planted if you hover over plant"); the countdown is the one growth really follows.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game, SYSTEMS, type DaySummary } from '../src/sim/Game';
import { CROP_BY_ID } from '../src/data/crops';
import { daysToRipe, harvest, plant } from '../src/sim/systems/farming';
import { cropTip } from '../src/ui/croptip';

const farmingDay = (g: Game) => SYSTEMS.find((s) => s.name === 'farming')!.dayEnd!(g, { day: 1, season: 0, year: 1, sold: [], total: 0, passedOut: false, penalty: 0 } as DaySummary);
const bed = (g: Game, x: number, y: number, fert: string | null = null) => {
  const i = g.map.idx(x, y);
  g.soil.set(i, { water: false, fert, crop: null, idle: 0 });
  return i;
};
const texts = (g: Game, i: number) => cropTip(g, i)?.map((l) => l.text) ?? null;

describe('the crop hover tip', () => {
  it('names the crop, counts the watered days to ripe, and says whether it is watered', () => {
    const g = new Game({ seed: 1, blank: { w: 40, h: 40 } });
    const i = bed(g, 5, 5);
    expect(cropTip(g, i)).toBeNull();
    plant(g, CROP_BY_ID.get('rhubarb')!, i);
    expect(texts(g, i)).toEqual(['Rhubarb', 'Ripe in 12 days if watered', 'Needs water today', 'Grows in spring']);
    g.soil.get(i)!.water = true;
    expect(texts(g, i)![2]).toBe('Watered today');
  });

  it('the countdown matches real growth, with speed fertilizer and a regrowing crop', () => {
    for (const [crop, fert] of [['rhubarb', null], ['rhubarb', 'grow_tonic'], ['cogbean', 'grow_tonic'], ['strawberry', null]] as const) {
      const g = new Game({ seed: 2, blank: { w: 40, h: 40 } });
      const i = bed(g, 5, 5, fert);
      plant(g, CROP_BY_ID.get(crop)!, i);
      for (let round = 0; round < 2; round++) {
        const s = g.soil.get(i)!;
        const said = daysToRipe(g, s);
        let days = 0;
        while (!s.crop!.ready && days < 60) {
          expect(daysToRipe(g, s), `${crop} ${fert} day ${days}`).toBe(said - days);
          s.water = true;
          farmingDay(g);
          days++;
        }
        expect(days, `${crop} ${fert}`).toBe(said);
        expect(texts(g, i)![1]).toMatch(/^Ripe: /);
        if (!CROP_BY_ID.get(crop)!.regrow) break;
        harvest(g, i);
        expect(texts(g, i)![1]).toMatch(/^Grows back in \d+ days? if watered$/);
      }
    }
  });

  it('a regrowing crop says how often, and a withered one says F clears it', () => {
    const g = new Game({ seed: 3, blank: { w: 40, h: 40 } });
    const i = bed(g, 5, 5);
    plant(g, CROP_BY_ID.get('cogbean')!, i);
    expect(texts(g, i)![3]).toBe('Grows in spring and summer, regrows every 2 days');
    g.soil.get(i)!.crop!.dead = true;
    expect(texts(g, i)).toEqual(['Cogbean', 'Withered. F clears it']);
  });
});
