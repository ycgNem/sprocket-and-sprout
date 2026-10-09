// Economy check: the scripted bot (tests/bot.ts) plays 28 days on several seeds and prints what it
// earned. Rush medals (DECISIONS #44) are calibrated against the Rush average.
// Usage: npx vite-node scripts/pace.ts [story|rush|cozy ...] [--seeds 2024,7,99,1,2,3,4,5] [--days 28]
import '../src/sim';
import { Game } from '../src/sim/Game';
import type { GameMode } from '../src/data/modes';
import { Bot } from '../tests/bot';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const seeds = opt('--seeds', '2024,7,99,1,2,3,4,5').split(',').map(Number);
const days = Number(opt('--days', '28'));
const modes = (args.length ? args : ['story', 'rush']) as GameMode[];

for (const mode of modes) {
  const earned: number[] = [];
  const day1: number[] = [];
  for (const seed of seeds) {
    const g = new Game({ seed, name: 'Bot', farmName: 'Bolt', mode });
    const bot = new Bot(g);
    for (let d = 0; d < days; d++) bot.playDay();
    earned.push(Math.round(g.earned));
    day1.push(bot.log[0]?.earned ?? 0);
  }
  const avg = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  console.log(`${mode}: ${days} days, ${seeds.length} seeds: avg ${avg(earned)} (min ${Math.min(...earned)}, max ${Math.max(...earned)}); day 1 avg ${avg(day1)}`);
  console.log(`  per seed: ${seeds.map((s, i) => `${s}=${earned[i]}`).join('  ')}`);
}
