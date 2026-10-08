// The profession choice: two cards, pick one.
import { C } from '../../data/palette';
import { perkChoices } from '../../data/perks';
import { choosePerk, pendingPerk } from '../../sim/perks';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { key } from '../../sim/inventory';

const SKILL_ICON: Record<string, string> = { farming: 'hoe_2', foraging: 'axe_2', mining: 'pick_2', fishing: 'rod_2', combat: 'sword_2', tinkering: 'copper_gear' };

function drawPerk(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const pend = pendingPerk(g);
  if (!pend) return false;
  const W = 340, H = 170;
  const { x, y } = centered(ui, W, H);
  const title = `${pend.skill[0].toUpperCase() + pend.skill.slice(1)} level ${pend.level}!`;
  if (!frame(ui, x, y, W, H, title)) {
    play.perkSnooze = g.dayIndex;
    return false;
  }
  ui.text('Choose a profession. This choice is permanent.', x + W / 2, y + 16, C.walnut, { align: 'center' });
  const opts = perkChoices(pend.skill, pend.level);
  opts.forEach((p, i) => {
    const cx = x + 14 + i * ((W - 28) / 2 + 0), cw = (W - 28) / 2 - 6;
    const hov = ui.hover(cx, y + 30, cw, 108);
    ui.panel(cx, y + 30, cw, 108, hov ? 'brass' : 'paper', false);
    const icon = SKILL_ICON[pend.skill];
    if (icon) ui.itemIcon(key(icon), cx + cw / 2 - 8, y + 38, 16);
    ui.text(p.name, cx + cw / 2, y + 60, C.ink, { align: 'center' });
    ui.para(p.desc, cx + 8, y + 74, cw - 16, C.walnut, 9);
    if (ui.button('perk' + p.id, cx + cw / 2 - 30, y + 116, 60, 16, 'Choose', { style: 'green' })) {
      choosePerk(g, p.id);
      void st;
    }
  });
  ui.text('Close to decide later (from the Skills tab).', x + W / 2, y + H - 16, C.oak, { align: 'center' });
  return true;
}

registerWindow('perk', { draw: drawPerk });
