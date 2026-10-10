// The critic's Phase 2 acceptance check (C1): on seeds 2024, 7, 99 (Story), crocks Working >= 50% of
// awake samples on days 5-7, day-6 income > 0, the mill still producing on day 6.
//   npx vite-node scripts/accept.ts [seeds]
import '../src/sim';
import { Game } from '../src/sim/Game';
import { Bot } from '../tests/bot';
import { MState } from '../src/sim/mstate';

const seeds = (process.argv[2] ?? '2024,7,99').split(',').map(Number);
for (const seed of seeds) {
  const g = new Game({ seed, name: 'Bot', farmName: 'Bolt', mode: 'story' } as any);
  const bot = new Bot(g);
  const rows: string[] = [];
  let last = 0;
  for (let d = 0; d < 8; d++) {
    // sample the crocks every in-game 10 minutes while the bot plays the day
    let work = 0, n = 0;
    const millBefore = g.ents.all().filter((e) => e.def.id === 'mill').reduce((a, e) => a + (e.mach?.made ?? 0), 0);
    const orig = g.tick.bind(g);
    let t = 0;
    (g as any).tick = () => {
      orig();
      if (++t % 420 === 0 && !g.sleeping && g.time.min >= 360 && g.time.min < 1440) {
        for (const e of g.ents.all()) if (e.def.id === 'jar' && !e.st.rust) { n++; if (e.state === MState.Working) work++; }
      }
    };
    bot.playDay();
    (g as any).tick = orig;
    const millAfter = g.ents.all().filter((e) => e.def.id === 'mill').reduce((a, e) => a + (e.mach?.made ?? 0), 0);
    const inc = Math.round(g.earned - last);
    last = g.earned;
    rows.push(`d${d + 1}: +${inc} crocks ${n ? Math.round((100 * work) / n) : 0}% mill +${millAfter - millBefore}`);
  }
  console.log(seed, rows.join(' | '));
}
