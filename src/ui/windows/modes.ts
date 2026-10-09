// Clockwork Rush results: the medal, the score and the best runs on this computer.
import { C } from '../../data/palette';
import { RUSH_MEDALS } from '../../data/modes';
import { modeState } from '../../sim/systems/modes';
import { loadProfile, recordRush } from '../../app/profile';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { ICON } from '../font';

const MEDAL = ['No medal', 'Bronze', 'Silver', 'Gold'];
const MEDAL_COL = [C.stone, C.copper, C.pebble, C.brass];

function drawRush(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const ms = modeState(g);
  if (!st.data.recorded) {
    st.data.recorded = true;
    ms.showResult = false;
    recordRush(ms.score, ms.medal, g.player.farmName);
    st.data.best = loadProfile().rush.slice(0, 5);
  }
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.45);
  const w = 300, h = 220;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Clockwork Rush')) return false;
  ui.text('The season is over!', x + w / 2, y + 16, C.walnut, { align: 'center', scale: 2 });
  // medal
  const cx = x + w / 2, cy = y + 62;
  const col = MEDAL_COL[ms.medal];
  for (let dy = -14; dy <= 14; dy++) {
    const half = Math.floor(Math.sqrt(196 - dy * dy));
    ui.fill(cx - half, cy + dy, half * 2 + 1, 1, dy < -10 || dy > 10 ? C.ink : col);
  }
  ui.text(ICON.star, cx - 3, cy - 4, C.cream, { shadow: C.ink });
  ui.text(MEDAL[ms.medal], cx, cy + 20, MEDAL_COL[ms.medal] === C.pebble ? C.slate : MEDAL_COL[ms.medal], { align: 'center' });
  ui.text(`Coins earned in 28 days: ${ms.score.toLocaleString()}`, cx, cy + 34, C.ink, { align: 'center' });
  const next = RUSH_MEDALS.find((m) => ms.score < m);
  ui.text(next ? `${(next - ms.score).toLocaleString()} short of ${MEDAL[RUSH_MEDALS.indexOf(next) + 1]}` : 'You beat every target!', cx, cy + 45, C.oak, { align: 'center' });
  // best runs
  ui.text('Best runs on this computer', x + 16, y + 128, C.walnut);
  (st.data.best as { score: number; medal: number; farm: string }[]).forEach((r, i) => {
    ui.text(`${i + 1}. ${r.farm} Farm`, x + 20, y + 140 + i * 10, C.bark);
    ui.text(`${r.score.toLocaleString()} ${MEDAL[r.medal]}`, x + w - 20, y + 140 + i * 10, C.bark, { align: 'right' });
  });
  if (ui.button('rush_keep', x + 16, y + h - 26, 120, 18, 'Keep playing', { style: 'green', tip: 'Continue this farm with normal rules' })) return false;
  if (ui.button('rush_title', x + w - 116, y + h - 26, 100, 18, 'Title screen')) {
    play.save(true);
    play.app.toTitle();
    return false;
  }
  return true;
}

registerWindow('rush', { draw: drawRush });
