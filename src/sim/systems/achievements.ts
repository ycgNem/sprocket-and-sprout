// Feats: long-term achievements across every system, checked periodically.
import { ITEMS } from '../../data/items';
import { Game, registerSystem } from '../Game';
import { hearts } from './npcs';

export interface Feat {
  id: string;
  name: string;
  desc: string;
  test: (g: Game) => boolean;
  /** progress text for the journal */
  prog?: (g: Game) => string;
}

const c = (g: Game, k: string) => g.counters[k] ?? 0;
const madeCat = (g: Game, cat: string) => {
  let n = 0;
  for (const [idx, s] of g.stats.series) if (ITEMS[idx]?.cat === cat) n += s.totalProd;
  return n;
};
const npcs = (g: Game) => (g.sys.npcs?.list ?? []) as any[];

export const FEATS: Feat[] = [
  { id: 'contracts5', name: 'Reliable Supplier', desc: 'Fill 5 Trading Guild contracts.', test: (g) => c(g, 'contracts') >= 5, prog: (g) => `${c(g, 'contracts')}/5` },
  { id: 'guild5', name: 'Guild Partner', desc: 'Reach the top Trading Guild rank.', test: (g) => (g.sys.guild?.rep ?? 0) >= 20, prog: (g) => `${g.sys.guild?.rep ?? 0}/20 rep` },
  { id: 'pet', name: 'Best Friend', desc: 'Reach 5 hearts with your pet.', test: (g) => (g.sys.pet?.points ?? 0) >= 1000, prog: (g) => `${Math.floor((g.sys.pet?.points ?? 0) / 200)}/5 hearts` },
  { id: 'homecook', name: 'Home Cooking', desc: 'Cook 25 dishes in your farmhouse kitchen.', test: (g) => c(g, 'cooked') >= 25, prog: (g) => `${c(g, 'cooked')}/25` },
  { id: 'harvest100', name: 'Green Thumb', desc: 'Harvest 100 crops.', test: (g) => c(g, 'harvested') >= 100, prog: (g) => `${c(g, 'harvested')}/100` },
  { id: 'harvest1000', name: 'Bountiful', desc: 'Harvest 1,000 crops.', test: (g) => c(g, 'harvested') >= 1000, prog: (g) => `${c(g, 'harvested')}/1000` },
  { id: 'earn1k', name: 'First Coins', desc: 'Earn 1,000 coins.', test: (g) => g.earned >= 1000, prog: (g) => `${g.earned}/1000` },
  { id: 'earn50k', name: 'Prosperous', desc: 'Earn 50,000 coins.', test: (g) => g.earned >= 50000, prog: (g) => `${g.earned}/50000` },
  { id: 'earn1m', name: 'Valley Tycoon', desc: 'Earn 1,000,000 coins.', test: (g) => g.earned >= 1000000, prog: (g) => `${g.earned}/1000000` },
  { id: 'belts100', name: 'Conveyor Fan', desc: 'Have 100 belts placed.', test: (g) => g.ents.belts.length >= 100, prog: (g) => `${g.ents.belts.length}/100` },
  { id: 'belts1000', name: 'Belt Baron', desc: 'Have 1,000 belts placed.', test: (g) => g.ents.belts.length >= 1000, prog: (g) => `${g.ents.belts.length}/1000` },
  { id: 'arms50', name: 'Many Hands', desc: 'Have 50 arms placed.', test: (g) => g.ents.arms.length >= 50, prog: (g) => `${g.ents.arms.length}/50` },
  { id: 'machines100', name: 'Workshop of Wonders', desc: 'Have 100 machines placed.', test: (g) => g.ents.machines.length >= 100, prog: (g) => `${g.ents.machines.length}/100` },
  { id: 'power', name: 'It Hums!', desc: 'Power a machine with a generator.', test: (g) => g.ents.consumers.some((e) => e.net && e.sat > 0.5 && e.working) },
  { id: 'grid1000', name: 'Grid Master', desc: 'Have 1,000 sparks of generation on one grid.', test: (g) => [...(g.sys.power?.nets?.values?.() ?? [])].some((n: any) => n.cap >= 1000) },
  { id: 'research10', name: 'Curious Mind', desc: 'Complete 10 research topics.', test: (g) => g.research.done.size >= 10, prog: (g) => `${g.research.done.size}/10` },
  { id: 'research40', name: 'Scholar', desc: 'Complete 40 research topics.', test: (g) => g.research.done.size >= 40, prog: (g) => `${g.research.done.size}/40` },
  { id: 'fish25', name: 'Angler', desc: 'Catch 25 fish.', test: (g) => c(g, 'fish_caught') >= 25, prog: (g) => `${c(g, 'fish_caught')}/25` },
  { id: 'legend', name: 'Legendary', desc: 'Land a legendary fish.', test: (g) => ['thistlefin', 'clockjaw', 'tidemother'].some((f) => c(g, 'caught_' + f) > 0) },
  { id: 'floor20', name: 'Spelunker', desc: 'Reach floor 20 of the mine.', test: (g) => (g.sys.mine?.deepest ?? 0) >= 20 },
  { id: 'floor40', name: 'Deep Diver', desc: 'Reach floor 40 of the mine.', test: (g) => (g.sys.mine?.deepest ?? 0) >= 40 },
  { id: 'floor60', name: 'Rock Bottom', desc: 'Reach the bottom of the mine.', test: (g) => (g.sys.mine?.deepest ?? 0) >= 60 },
  { id: 'monsters100', name: 'Pest Control', desc: 'Defeat 100 monsters.', test: (g) => c(g, 'monsters') >= 100, prog: (g) => `${c(g, 'monsters')}/100` },
  { id: 'friends5', name: 'Neighborly', desc: 'Reach 4 hearts with 5 villagers.', test: (g) => npcs(g).filter((n) => hearts(n) >= 4).length >= 5, prog: (g) => `${npcs(g).filter((n) => hearts(n) >= 4).length}/5` },
  { id: 'friend10', name: 'Kindred Spirit', desc: 'Reach 10 hearts with anyone.', test: (g) => npcs(g).some((n) => hearts(n) >= 10) },
  { id: 'gifts', name: 'Thoughtful', desc: 'Give 50 gifts.', test: (g) => c(g, 'gifts') >= 50, prog: (g) => `${c(g, 'gifts')}/50` },
  { id: 'artisan100', name: 'Artisan', desc: 'Make 100 artisan goods.', test: (g) => madeCat(g, 'artisan') >= 100, prog: (g) => `${Math.floor(madeCat(g, 'artisan'))}/100` },
  { id: 'chef', name: 'Hearth Chef', desc: 'Cook 25 dishes.', test: (g) => madeCat(g, 'food') >= 25, prog: (g) => `${Math.floor(madeCat(g, 'food'))}/25` },
  { id: 'throughput', name: 'Throughput!', desc: 'Produce 120 of one item per minute.', test: (g) => [...g.stats.series.keys()].some((i) => g.stats.rate(i, 1, 'prod') >= 120) },
  { id: 'projects8', name: 'Restorer', desc: 'Complete 8 restoration projects.', test: (g) => (g.sys.goals?.doneProjects?.length ?? 0) >= 8, prog: (g) => `${g.sys.goals?.doneProjects?.length ?? 0}/8` },
  { id: 'clock', name: 'The Clock Strikes', desc: 'Restart the town clocktower.', test: (g) => g.flags.has('clock_fixed') },
  { id: 'mega', name: 'Grand Works', desc: 'Complete a megaproject.', test: (g) => (g.sys.goals?.mega?.length ?? 0) >= 1 },
  { id: 'festivals', name: 'Festive Spirit', desc: 'Take part in all four festivals.', test: (g) => c(g, 'festivals') >= 4, prog: (g) => `${c(g, 'festivals')}/4` },
  { id: 'rancher', name: 'Rancher', desc: 'Raise 10 animals.', test: (g) => (g.sys.animals?.list?.length ?? 0) >= 10, prog: (g) => `${g.sys.animals?.list?.length ?? 0}/10` },
  { id: 'bots', name: 'Hive Mind', desc: 'Have 20 bumblebots buzzing.', test: (g) => g.ents.consumers.filter((e) => e.def.kind === 'hive').reduce((a, e) => a + (e.st.bots ?? 0), 0) + (g.sys.bots?.list?.length ?? 0) >= 20 },
  { id: 'museum', name: 'Curator', desc: 'Donate 20 items to the museum.', test: (g) => (g.sys.goals?.museum?.length ?? 0) >= 20, prog: (g) => `${g.sys.goals?.museum?.length ?? 0}/20` },
  { id: 'year2', name: 'Seasoned', desc: 'Reach your second year in Thistlewick.', test: (g) => g.time.year >= 2 },
];

export function featsDone(g: Game): Set<string> {
  if (!g.sys.feats) g.sys.feats = new Set<string>();
  return g.sys.feats;
}

registerSystem({
  name: 'achievements',
  tick(g) {
    if (g.tickN % 120 !== 7 || g.map.w < 100) return;
    const done = featsDone(g);
    for (const f of FEATS) {
      if (done.has(f.id)) continue;
      if (f.test(g)) {
        done.add(f.id);
        g.toast(`Feat unlocked: ${f.name}!`, undefined, 6);
        g.emit({ t: 'sfx', id: 'levelup' });
      }
    }
  },
  save(g) {
    return [...featsDone(g)];
  },
  load(g, d) {
    g.sys.feats = new Set(d ?? []);
  },
});
