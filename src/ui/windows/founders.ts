// Founder's Day review: criteria, candles and rewards.
import { C, PALETTE } from '../../data/palette';
import { CANDLE_REWARDS, claimCandles, evaluate } from '../../sim/systems/founders';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';

function drawCandle(ui: UI, x: number, y: number, lit: boolean, t: number) {
  ui.fill(x, y + 8, 8, 16, lit ? C.cream : C.pebble);
  ui.fill(x, y + 8, 8, 1, lit ? C.butter : C.stone);
  ui.fill(x + 3, y + 5, 2, 3, C.ink);
  if (lit) {
    const f = Math.sin(t * 9 + x) > 0 ? 1 : 0;
    ui.fill(x + 2, y - 1 + f, 4, 6, C.amber);
    ui.fill(x + 3, y + 1 + f, 2, 3, C.butter);
  }
  void PALETTE;
}

function drawEvaluation(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const ev = st.data.ev ?? (st.data.ev = evaluate(g));
  const W = 420, H = 300;
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, `Founder's Day, Year ${g.time.year}`)) {
    if (!st.data.claimed) claimCandles(g, ev.candles);
    g.flags.delete('eval_pending');
    return false;
  }
  ui.text(`Mayor Tobias reviews ${g.player.farmName} Farm:`, x + 14, y + 14, C.walnut);
  ev.list.forEach((c: any, i: number) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = x + 14 + col * 200, cy = y + 28 + row * 13;
    ui.text(`${c.got ? '+' : '-'} ${c.label}${c.pts > 1 ? ` (${c.pts})` : ''}`, cx, cy, c.got ? C.moss : C.oak);
  });
  const by = y + 28 + Math.ceil(ev.list.length / 2) * 13 + 8;
  ui.text(`Score: ${ev.score} / ${ev.max}`, x + 14, by, C.ink);
  for (let k = 0; k < 4; k++) drawCandle(ui, x + 120 + k * 18, by - 8, k < ev.candles, ui.time);
  CANDLE_REWARDS.forEach((r, k) => {
    const got = g.flags.has('candle_' + (k + 1));
    ui.text(`${k + 1} candle${k ? 's' : ''}: ${r}${got && !st.data.fresh?.includes(k + 1) ? '  (received)' : ''}`, x + 14, by + 22 + k * 11, k < ev.candles ? C.ink : C.pebble);
  });
  if (!st.data.claimed) {
    if (ui.button('candles', x + W / 2 - 60, y + H - 30, 120, 18, ev.candles ? 'Light the candles' : 'Maybe next year', { style: 'green' })) {
      st.data.fresh = claimCandles(g, ev.candles);
      st.data.claimed = true;
      g.flags.delete('eval_pending');
      if (st.data.fresh.length) play.toast(`Founder's Day rewards: ${st.data.fresh.map((c: number) => CANDLE_REWARDS[c - 1]).join('; ')}`);
    }
  } else ui.text(st.data.fresh?.length ? 'Your rewards are in your bag!' : 'Thank you for another year, neighbor.', x + W / 2, y + H - 24, C.moss, { align: 'center' });
  return true;
}

registerWindow('evaluation', { draw: drawEvaluation });
