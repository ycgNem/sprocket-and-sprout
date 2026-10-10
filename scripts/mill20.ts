// The Phase 3 check (ROADMAP.md Phase 3 "done when"): does the scripted bot reach the Town Mill by
// day 20? Per seed: the day each main quest finished, and the open main quest's objectives at the end.
//   npx vite-node scripts/mill20.ts [seeds] [days]
import '../src/sim';
import { Game } from '../src/sim/Game';
import { Bot } from '../tests/bot';
import { QUESTS } from '../src/data/goals';
import { objText, objDone } from '../src/sim/systems/quests';

const seeds = (process.argv[2] ?? '2024,7,99,1,2,3,4,5').split(',').map(Number);
const days = Number(process.argv[3] ?? 20);
const verbose = !!process.env.V;
let reached = 0;
for (const seed of seeds) {
  const g = new Game({ seed, name: 'Bot', farmName: 'Bolt', mode: 'story' } as any);
  const bot = new Bot(g);
  const when: Record<string, number> = {};
  for (let d = 0; d < days; d++) {
    bot.playDay();
    for (const id of g.sys.quests.done as string[]) if (!(id in when)) when[id] = d + 1;
    if (verbose) console.log(`  d${d + 1} $${g.player.money} research ${[...g.research.done].join(',')} cur ${g.research.current ?? '-'} | ${bot.notes.filter((n) => !n.startsWith('crafted bundle')).slice(0, 12).join('; ')}`);
  }
  const mains = QUESTS.filter((q) => q.main).map((q) => q.id);
  const ok = 'k10_mill' in when;
  if (ok) reached++;
  const open = (g.sys.quests.active as any[]).filter((a) => mains.includes(a.id));
  const objs = open.map((a) => `${a.id}: ` + QUESTS.find((q) => q.id === a.id)!.objectives.map((o, i) => (objDone(g, o, a.prog[i]) ? '[x] ' : '[ ] ') + objText(g, o, a.prog[i])).join(' | ')).join('\n      ');
  console.log(`${seed}: ${ok ? 'MILL day ' + when.k10_mill : 'no mill'}  ${mains.filter((m) => m in when).map((m) => `${m}@${when[m]}`).join(' ')}  $${g.player.money}`);
  if (objs) console.log('      ' + objs);
}
console.log(`reached the Mill by day ${days}: ${reached}/${seeds.length}`);
