// The critic's Phase 2 acceptance check (C1, widened by the Phase 2 re-check): on seeds 2024, 7, 99
// (Story), days 5-12, per day: income, pickles made against the crocks' capacity (a crock makes 17
// a day at its 60 s pace on a 17-hour day), and the mill's output. The re-check's bar: no zero day,
// pickles >= 40% of capacity on average over days 5-12, the mill producing on most days.
//   npx vite-node scripts/accept.ts [seeds] [days]
import '../src/sim';
import { Game } from '../src/sim/Game';
import { Bot } from '../tests/bot';

const seeds = (process.argv[2] ?? '2024,7,99').split(',').map(Number);
const days = Number(process.argv[3] ?? 12);
const CROCK_DAY = 17;
for (const seed of seeds) {
  const g = new Game({ seed, name: 'Bot', farmName: 'Bolt', mode: 'story' } as any);
  const bot = new Bot(g);
  const rows: string[] = [];
  let last = 0, capSum = 0, madeSum = 0, zero = 0, millDays = 0;
  const made = (id: string) => g.ents.all().filter((e) => e.def.id === id).reduce((a, e) => a + (e.mach?.made ?? 0), 0);
  for (let d = 0; d < days; d++) {
    const jarsBefore = made('jar'), millBefore = made('mill');
    bot.playDay();
    const crocks = g.ents.all().filter((e) => e.def.id === 'jar' && !e.st.rust && !e.ghost).length;
    const pickles = made('jar') - jarsBefore, mill = made('mill') - millBefore;
    const inc = Math.round(g.earned - last);
    last = g.earned;
    const cap = crocks * CROCK_DAY;
    if (d >= 4) {
      capSum += cap;
      madeSum += pickles;
      if (inc <= 0) zero++;
      if (mill > 0) millDays++;
    }
    rows.push(`d${d + 1}: +${inc} pickles ${pickles}/${cap} (${cap ? Math.round((100 * pickles) / cap) : 0}%) mill +${mill}`);
  }
  console.log(`${seed}: days 5-${days} pickles ${capSum ? Math.round((100 * madeSum) / capSum) : 0}% of capacity, ${zero} zero-income days, mill on ${millDays}/${days - 4} days`);
  console.log('   ' + rows.join('\n   '));
}
