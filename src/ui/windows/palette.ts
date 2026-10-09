// Sandbox build palette: every placeable structure, free. Click one to put a stack in your hands.
import { C } from '../../data/palette';
import { STRUCTURES } from '../../data/structures';
import { ITEM_INDEX } from '../../data/items';
import { key } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { itemTooltip } from '../tooltips';

const KINDS: [string, string[]][] = [
  ['Logistics', ['belt', 'underground', 'splitter', 'arm', 'chest', 'hive', 'shipbin', 'depot']],
  ['Power', ['pole', 'generator', 'accumulator']],
  ['Machines', ['machine', 'lab', 'beehouse', 'tapper', 'fishtrap', 'pond']],
  ['Farm', ['harvester', 'planter', 'drill', 'sprinkler', 'scarecrow', 'building']],
  ['Decor', ['lamp', 'fence', 'gate', 'path', 'decor', 'megaproject']],
];

function drawPalette(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(420, ui.w - 20), h = Math.min(290, ui.h - 40);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Build palette')) return false;
  ui.text('Sandbox: everything is free. Click to take a stack of 50 into your hands.', x + 12, y + 12, C.walnut);
  const tab: number = st.data.tab ?? 0;
  KINDS.forEach(([name], i) => {
    if (ui.button('pal' + i, x + 12 + i * 78, y + 24, 74, 15, name, { active: tab === i })) st.data.tab = i;
  });
  const list = STRUCTURES.filter((s) => KINDS[tab][1].includes(s.kind) && ITEM_INDEX.has(s.item));
  const S = 22, cols = Math.floor((w - 24) / S);
  const gy = y + 46;
  ui.panel(x + 10, gy, w - 20, h - 56, 'inset', false);
  list.forEach((s, i) => {
    const sx = x + 14 + (i % cols) * S, sy = gy + 4 + Math.floor(i / cols) * S;
    const k = key(s.item);
    const r = ui.slot(sx, sy, { k, n: 1 });
    if (r.hover) ui.tip(itemTooltip(g, k, 1));
    if (r.click) {
      const p = g.player;
      const left = p.inv.add(k, 50);
      const idx = p.inv.slots.findIndex((q) => q && q.k === k);
      if (idx >= 12) {
        // swap it into the selected hotbar slot
        const cur = p.inv.slots[p.sel];
        p.inv.slots[p.sel] = p.inv.slots[idx];
        p.inv.slots[idx] = cur;
      } else if (idx >= 0) p.sel = idx;
      if (left) play.toast('Your bag is full.');
      ui.sfx('pickup');
    }
  });
  return true;
}

registerWindow('palette', { draw: drawPalette });
