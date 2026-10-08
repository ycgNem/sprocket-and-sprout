// Founder's Day: every new year Mayor Tobias reviews the farm. Points light up to four candles,
// and each candle tier unlocks a one-time reward.
import { PROJECTS } from '../../data/goals';
import { C } from '../../data/palette';
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';
import { goals, send } from './goals';
import { hearts, npcSys } from './npcs';

export interface Criterion { label: string; pts: number; got: boolean }

export function evaluate(g: Game): { list: Criterion[]; score: number; max: number; candles: number } {
  const gs = goals(g);
  const npcs = npcSys(g).list;
  const skillTotal = Object.values(g.player.skills).reduce((a, b) => a + b, 0);
  const friends = npcs.filter((n) => hearts(n) >= 5).length;
  const list: Criterion[] = [
    { label: 'Earned 50,000 coins', pts: 1, got: g.earned >= 50000 },
    { label: 'Earned 100,000 coins', pts: 1, got: g.earned >= 100000 },
    { label: 'Earned 250,000 coins', pts: 2, got: g.earned >= 250000 },
    { label: 'Earned 1,000,000 coins', pts: 2, got: g.earned >= 1000000 },
    { label: '30 total skill levels', pts: 1, got: skillTotal >= 30 },
    { label: '50 total skill levels', pts: 1, got: skillTotal >= 50 },
    { label: '5 good friends (5+ hearts)', pts: 1, got: friends >= 5 },
    { label: '10 good friends (5+ hearts)', pts: 1, got: friends >= 10 },
    { label: '200 belts humming', pts: 1, got: g.ents.belts.length >= 200 },
    { label: '40 machines at work', pts: 1, got: g.ents.machines.length >= 40 },
    { label: '30 research topics studied', pts: 1, got: g.research.done.size >= 30 },
    { label: `Restored half the town (${Math.ceil(PROJECTS.length / 2)} projects)`, pts: 1, got: gs.doneProjects.length >= Math.ceil(PROJECTS.length / 2) },
    { label: 'Restored the whole town', pts: 1, got: gs.doneProjects.length >= PROJECTS.length },
    { label: 'Built a Grand Work', pts: 1, got: gs.mega.length >= 1 },
    { label: '20 museum donations', pts: 1, got: gs.museum.length >= 20 },
    { label: '20 kinds of fish caught', pts: 1, got: Object.keys(gs.fish).length >= 20 },
    { label: 'A pet who adores you', pts: 1, got: (g.sys.pet?.points ?? 0) >= 1000 },
    { label: 'A fully renovated farmhouse', pts: 1, got: ['home_kitchen', 'home_featherbed', 'home_pantry', 'home_hearth'].every((f) => g.flags.has(f)) },
  ];
  const score = list.reduce((a, c) => a + (c.got ? c.pts : 0), 0);
  const max = list.reduce((a, c) => a + c.pts, 0);
  const candles = score >= 17 ? 4 : score >= 12 ? 3 : score >= 7 ? 2 : score >= 3 ? 1 : 0;
  return { list, score, max, candles };
}

export const CANDLE_REWARDS = [
  'A purse of 2,500 coins',
  "The Founder's Lantern, for your farmhouse",
  "The Founder's Medal: +5% on everything you ship",
  'The Gilded Clock and 20,000 coins',
];

/** grant every candle reward reached and not yet claimed; returns the newly granted tiers */
export function claimCandles(g: Game, candles: number): number[] {
  const out: number[] = [];
  for (let c = 1; c <= candles; c++) {
    if (g.flags.has('candle_' + c)) continue;
    g.flags.add('candle_' + c);
    out.push(c);
    if (c === 1) { g.player.money += 2500; g.earned += 2500; }
    if (c === 2) g.give(key('f_lantern'), 1);
    if (c === 3) g.flags.add('founders_medal');
    if (c === 4) { g.give(key('f_gilded_clock'), 1); g.player.money += 20000; g.earned += 20000; }
  }
  return out;
}

registerSystem({
  name: 'founders',
  dayStart(g) {
    if (g.map.w < 100) return;
    // the morning of Spring 1, from the second year on
    if (g.time.year >= 2 && g.time.season === 0 && g.time.day === 1 && !g.flags.has('founders_y' + g.time.year)) {
      g.flags.add('founders_y' + g.time.year);
      g.flags.add('eval_pending');
      send(g, 'founders_' + g.time.year, {
        from: 'tobias', title: "Founder's Day",
        text: `Happy Founder's Day, ${g.player.name}! Every year on this morning, Thistlewick looks back on what its farmers have built. I've written up my review of ${g.player.farmName} Farm. Each candle we light is a year of good work.\n- Mayor Tobias`,
      });
    }
  },
});

export function foundersBonus(g: Game) {
  return g.flags.has('founders_medal') ? 0.05 : 0;
}

export function candleColor(lit: boolean) {
  return lit ? C.butter : C.stone;
}
