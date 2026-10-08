// Gentle, one-time contextual tips that teach the game as you play.
import { kDef } from '../sim/inventory';
import type { PlayScreen } from './play';

interface Tip {
  id: string;
  when: (p: PlayScreen) => boolean;
  title: string;
  text: string;
  /** show as a window (otherwise a long toast) */
  big?: boolean;
}

const held = (p: PlayScreen) => {
  const s = p.g.player.inv.slots[p.g.player.sel];
  return s ? kDef(s.k) : null;
};

export const TIPS: Tip[] = [
  {
    id: 'welcome', big: true, title: 'Welcome to Thistlewick!',
    when: (p) => p.g.dayIndex === 0 && p.playtime > 1.2,
    text: 'Move with WASD. Left-click uses the tool or item in your hand; right-click (or F) talks, harvests, opens and collects.\n\nPick hotbar slots with 1-0 or the mouse wheel. E opens your bag, C the crafting menu, J the journal. Esc pauses.\n\nYour first tasks are in the top-left corner. Take your time: the days are long and nobody is in a hurry here.',
  },
  { id: 'hoe', when: (p) => held(p)?.tool?.kind === 'hoe', title: '', text: 'Click grass or dirt near you to till it. Bare farm soil is the easiest to work.' },
  { id: 'seeds', when: (p) => held(p)?.cat === 'seed', title: '', text: 'Click tilled soil to plant. Seeds only grow in their season; the tooltip tells you which.' },
  { id: 'can', when: (p) => held(p)?.tool?.kind === 'can', title: '', text: 'Water each planted tile every day (rain does it for you). Click the farm pond to refill.' },
  { id: 'energy', when: (p) => p.g.player.energy < 60, title: '', text: 'Energy is getting low. Eat something (H) or head to bed. Passing out at 2am costs coins!' },
  { id: 'night', when: (p) => p.g.time.min > 21 * 60 && p.g.dayIndex < 3, title: '', text: 'It is getting late. Head inside the farmhouse and right-click the bed to sleep; the shipping crate pays out overnight.' },
  { id: 'place', when: (p) => !!held(p)?.places, title: '', text: 'Building: click to place, R rotates, drag to place a line. Right-click picks a structure back up.' },
  {
    id: 'lab', big: true, title: 'The Study Desk',
    when: (p) => p.g.ents.others.some((e) => e.def.kind === 'lab'),
    text: 'Research turns farm goods into know-how. Craft Sprout Bundles (1 fiber + 1 crop) and put them in the desk, then pick a topic in the research tree (T).\n\nConveyance and Clockwork Arms are the first steps toward a farm that runs itself.',
  },
  {
    id: 'belts', big: true, title: 'Belts and Arms',
    when: (p) => p.g.ents.belts.length > 0,
    text: 'Belts carry items on two lanes. Drag to place long lines; they curve on their own.\n\nA Clockwork Arm picks up from the tile behind it (green) and drops on the tile in front (gold). Chest -> arm -> machine -> arm -> belt is the basic recipe of every factory.\n\nHover a structure to see what it is doing. P opens production stats.',
  },
  { id: 'machine', when: (p) => p.g.ents.machines.length > 0, title: '', text: 'Right-click a machine with an item in hand to load it, or open it to pick a recipe. Finished goods wait inside.' },
  {
    id: 'power', big: true, title: 'Power',
    when: (p) => p.g.ents.gens.length > 0,
    text: 'Generators need poles to reach machines. Each pole powers the shaded square around it and wires itself to nearby poles.\n\nIf demand outgrows supply, every machine on that grid slows down. Open a pole to see the grid graph.',
  },
  { id: 'mine', when: (p) => p.g.player.where === 'mine', title: '', text: 'Break rocks to find ore and the ladder down. Every fifth floor has a lift. Watch your health (red bar)!' },
  { id: 'fish', when: (p) => held(p)?.tool?.kind === 'rod', title: '', text: 'Hold the mouse to charge a cast, release over water. When the bobber dips, click!' },
  { id: 'blueprint', when: (p) => p.g.ents.map.size > 30, title: '', text: 'Pro tip: V copies an area as a blueprint and B pastes it. X deconstructs an area. Q picks up the structure under the mouse.' },
  { id: 'bots', when: (p) => p.g.ents.others.some((e) => e.def.kind === 'hive') || p.g.ents.consumers.some((e) => e.def.kind === 'hive'), title: '', text: 'Bumblebots fly between bee crates within the hive\'s range. Set a wish list on a Request crate.' },
];

export function checkTips(p: PlayScreen) {
  if (p.win) return;
  for (const t of TIPS) {
    if (p.g.flags.has('tip_' + t.id)) continue;
    if (!t.when(p)) continue;
    p.g.flags.add('tip_' + t.id);
    if (t.big) p.openWindow('message', { title: t.title, text: t.text, icon: undefined });
    else p.toast('Tip: ' + t.text, undefined, 21);
    return;
  }
}
