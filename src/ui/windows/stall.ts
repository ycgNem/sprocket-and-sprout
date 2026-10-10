// The festival token stall: TOKEN_SHOP's goods in slots, a click buys one. Every festival's window
// has it (Lantern Night and Frostlight Skate under their intro, the Fair and the Haul behind a button).
import { shortName } from '../../data/cookbook';
import { TOKEN_SHOP } from '../../data/goals';
import { ITEM_BY_ID } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { C } from '../../data/palette';
import { key } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';

/** the stall's header line and two rows of four slots (about 280 x 82) */
export function drawTokenStall(ui: UI, play: PlayScreen, x: number, y: number, host: string) {
  const g = play.g;
  const name = shortName(NPC_BY_ID.get(host)?.name ?? host);
  ui.text(`Token stall (${name}): you have ${g.player.inv.countId('ticket')} tokens`, x, y, C.ink);
  TOKEN_SHOP.forEach((t, i) => {
    const sx = x + (i % 4) * 70, sy = y + 14 + Math.floor(i / 4) * 34;
    const r = ui.slot(sx, sy, { k: key(t.item), n: 1 });
    ui.text(`${t.tickets}`, sx + 24, sy + 6, C.walnut);
    if (r.hover) ui.tip([{ text: ITEM_BY_ID.get(t.item)!.name, color: C.amber }, { text: `${t.tickets} festival tokens`, color: C.pebble }]);
    if (r.click) {
      if (g.player.inv.countId('ticket') >= t.tickets) {
        g.player.inv.removeSpec('ticket', t.tickets);
        g.give(key(t.item), 1);
        ui.sfx('buy');
      } else ui.sfx('error');
    }
  });
}
