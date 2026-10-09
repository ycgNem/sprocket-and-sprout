// Prints id, name and description of the items in the given categories (icon briefing).
// node node_modules/vite-node/vite-node.mjs art/icons/tools/list-desc.ts placeable furniture
import { ITEMS } from '../../../src/data/items';
const cats = new Set(process.argv.slice(2));
for (const d of ITEMS) if (!cats.size || cats.has(d.cat)) console.log(`${d.id} | ${d.name} | ${d.desc}`);
