// Lists every item: id, name, cat, icon template, colors (palette hex). Run:
// node node_modules/vite-node/vite-node.mjs art/icons/tools/list-items.ts > art/icons/items.tsv
import { ITEMS } from '../../../src/data/items';
import { PALETTE } from '../../../src/data/palette';
for (const d of ITEMS) {
  const c = (d.icon.c ?? []).map((x: number) => (x >= 0 ? PALETTE[x] : '-')).join(',');
  console.log([d.id, d.name, d.cat, d.icon.t, (d.icon as any).s ?? '', c, (d as any).places ?? ''].join('\t'));
}
