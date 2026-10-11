// The pause menu's Statistics page: time played and the farm's running totals, from the counters the
// sim keeps anyway (g.count) and the play screen's `play_secs` (real seconds in a farm).
import { C } from '../../data/palette';
import { STRUCT_BY_ID } from '../../data/structures';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { ellipsize, textWidth } from '../font';

/** 1234567 -> "1,234,567" */
const num = (n: number) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "3h 25m", "12m", "under a minute" */
function played(secs: number): string {
  const m = Math.floor(secs / 60);
  if (m < 1) return 'under a minute';
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

type Row = [string, string] | string;

function rows(play: PlayScreen): [Row[], Row[]] {
  const g = play.g;
  const c = (k: string) => g.counters[k] ?? 0;
  const sum = (prefix: string) => Object.entries(g.counters).reduce((a, [k, v]) => (k.startsWith(prefix) ? a + v : a), 0);
  // the machine kind with the most batches behind it
  let busy = '', most = 0;
  for (const [k, v] of Object.entries(g.counters)) {
    if (k.startsWith('made:') && v > most) [busy, most] = [k.slice(5), v];
  }
  const busiest = most ? `${STRUCT_BY_ID.get(busy)?.name ?? busy} (${num(most)})` : 'none yet';
  return [
    [
      'The farm',
      ['Time played', played(c('play_secs'))],
      ['Days on the farm', num(g.dayIndex + 1)],
      ['Coins earned', num(g.earned)],
      ['Goods shipped', num(c('shipped'))],
      ['Crops harvested', num(c('harvested'))],
      ['Tiles tilled', num(c('tilled'))],
      ['Trees chopped', num(c('trees_chopped'))],
      ['Fish caught', num(c('fish_caught'))],
      ['Things foraged', num(c('foraged'))],
      'The town',
      ['Quests done', num(c('quests'))],
      ['Orders filled', num(c('orders'))],
      ['Gifts given', num(c('gifts'))],
    ],
    [
      'The works',
      ['Machine batches made', num(sum('made:'))],
      ['Busiest machine', busiest],
      ['Goods made by hand', num(sum('crafted:'))],
      ['Machines restored', num(c('restored'))],
      ['Arms wound', num(c('arms_wound'))],
      'Oddities',
      ['Tiles walked', num(c('walked'))],
      ['Tiles ridden on belts', num(c('belt_ride'))],
      ['Swings at thin air', num(c('air_swings'))],
      ['Trees shaken', num(c('shakes'))],
      ['Snacks eaten', num(c('eaten'))],
      ['Pets and pats', num(c('pet') + c('animal_pets'))],
      ['Times passed out', num(c('passed_out'))],
    ],
  ];
}

/** the page inside the pause window; false once Back is pressed */
export function drawStatistics(ui: UI, play: PlayScreen): boolean {
  const w = 440, h = 222;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Statistics')) return false;
  const colW = (w - 36) / 2;
  rows(play).forEach((list, col) => {
    const cx = x + 14 + col * (colW + 8);
    let yy = y + 16;
    for (const r of list) {
      if (typeof r === 'string') {
        if (yy > y + 16) yy += 3;
        ui.text(r, cx, yy, C.copper);
        ui.fill(cx, yy + 9, colW, 1, C.tan);
        yy += 12;
        continue;
      }
      ui.text(r[0], cx, yy, C.ink);
      ui.text(ellipsize(r[1], colW - textWidth(r[0]) - 10), cx + colW, yy, C.walnut, { align: 'right' });
      yy += 11;
    }
  });
  return !ui.button('sback', x + w / 2 - 30, y + h - 22, 60, 16, 'Back');
}
