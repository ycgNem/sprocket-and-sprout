// The "where to get it" lines (src/data/sources.ts) say what the game does: every line names a real
// item, and the parts' lines match their recipes and the shops that stock them (the critic's 2.0
// pass: nothing said the Workshop sells coils and rope, or that a rope is 3 fiber).
import { describe, expect, it } from 'vitest';
import { ITEM_BY_ID } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { SHOPS } from '../src/data/shops';
import { SOURCE } from '../src/data/sources';

const handRecipe = (id: string) => RECIPES.find((r) => r.id === `hand:${id}`);
const sells = (shop: string, item: string) => !!SHOPS.find((s) => s.id === shop)?.stock.some((x) => x.item === item);

describe('where to get it', () => {
  it('names real items, in the UI font', () => {
    for (const [id, line] of Object.entries(SOURCE)) {
      expect(ITEM_BY_ID.has(id), id).toBe(true);
      expect(/^[\x20-\x7e]+$/.test(line) && !/[$_]/.test(line), id).toBe(true);
    }
  });

  it("the parts' lines match their recipes and shops", () => {
    expect(handRecipe('rope')?.in).toEqual([{ item: 'fiber', n: 3 }]);
    expect(handRecipe('plank')?.in).toEqual([{ item: 'wood', n: 2 }]);
    expect(handRecipe('copper_gear')?.in).toEqual([{ item: 'copper_bar', n: 1 }]);
    expect(handRecipe('copper_coil')?.in).toEqual([{ item: 'copper_bar', n: 1 }]);
    expect(handRecipe('copper_coil')?.out[0].n).toBe(2);
    expect(handRecipe('copper_coil')?.unlock).toBe('r_metallurgy');
    expect(RECIPES.find((r) => r.id === 'smelt:copper')?.in).toEqual([{ item: 'copper_ore', n: 3 }]);
    for (const id of ['rope', 'copper_gear', 'copper_coil']) expect(sells('workshop', id), id).toBe(true);
    expect(sells('carpenter', 'plank')).toBe(true);
    expect(sells('smithy', 'copper_ore') && sells('smithy', 'furnace')).toBe(true);
  });
});
