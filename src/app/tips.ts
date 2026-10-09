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
    // the professor greets you in three short lines; the key bubbles teach the rest as you go
    id: 'welcome', big: true, title: 'Welcome to Thistlewick!',
    when: (p) => p.g.dayIndex === 0 && p.playtime > 1.2,
    text: 'Welcome to Thistlewick, {name}! I\'m Professor Cogwhistle. The old keeper left you this farm, and their clockwork still ticks!\n\nTheir cogbeans are ripe, right beside the house. Walk over with WASD and press F to pick them. Follow the bouncing arrow!\n\nThen feed them to the preserves jar by the shipping crate. Beans make pickles, pickles make coins, coins make machines. Esc shows every control. Off you go!',
  },
  { id: 'hoe', when: (p) => held(p)?.tool?.kind === 'hoe' && !p.g.sys.quests?.active?.some((a: { id: string }) => a.id === 't_welcome'), title: '', text: 'Click grass or dirt near you to till it. Bare farm soil is the easiest to work.' },
  { id: 'seeds', when: (p) => held(p)?.cat === 'seed', title: '', text: 'Click tilled soil to plant. Seeds only grow in their season; the tooltip tells you which.' },
  { id: 'can', when: (p) => held(p)?.tool?.kind === 'can', title: '', text: 'Water each planted tile every day (rain does it for you). Click the farm pond to refill.' },
  { id: 'energy', when: (p) => p.g.player.energy < 60, title: '', text: 'Energy is getting low. Eat something (H) or head to bed. Pass out at 2am and you sleep in until 10.' },
  { id: 'night', when: (p) => p.g.time.min > 21 * 60 && p.g.dayIndex < 3, title: '', text: 'It is getting late. Head inside the farmhouse and right-click the bed to sleep; the shipping crate pays out overnight.' },
  { id: 'home', when: (p) => p.g.player.where === 'house', title: '', text: 'Home sweet home. Right-click the bed to sleep, the almanac for the forecast and market news, and the hearth to warm up. Juniper at the Joinery can renovate.' },
  { id: 'stray', when: (p) => p.g.sys.pet?.stage === 'stray' && p.g.player.where === 'world' && Math.hypot(p.g.sys.pet.x - p.g.player.x, p.g.sys.pet.y - p.g.player.y) < 8, title: '', text: 'A stray is hanging around your farmhouse. Right-click it to say hello!' },
  { id: 'depot', when: (p) => p.g.player.inv.countId('freight_depot') > 0, title: '', text: 'Place the Freight Depot anywhere on your farm. Deliver the weekly Guild contracts by hand or let arms feed it.' },
  { id: 'furniture', when: (p) => !!held(p)?.furniture, title: '', text: 'Furniture goes inside your farmhouse: click a floor tile (or the wall, for paintings). Right-click a piece to pick it back up.' },
  { id: 'perkhint', when: (p) => Object.values(p.g.player.skills).some((l) => l >= 4), title: '', text: 'At skill level 5 and 10 you choose a profession: a permanent perk for that skill.' },
  { id: 'quickstack', when: (p) => p.g.player.inv.slots.slice(12).filter(Boolean).length >= 18 && p.g.ents.others.some((e) => e.def.kind === 'chest'), title: '', text: 'Bag getting full? Stand near your chests and press K to quick-stack matching items into them.' },
  { id: 'place', when: (p) => !!held(p)?.places, title: '', text: 'Building: click to place, R rotates, drag to place a line. Right-click picks a structure back up.' },
  {
    id: 'lab', big: true, title: 'The Study Desk',
    when: (p) => p.g.ents.others.some((e) => e.def.kind === 'lab'),
    text: 'Research turns farm goods into know-how. Put Sprout Bundles (1 fiber + 1 crop, or 3 crops) in the desk, then pick a topic in the research tree (T).',
  },
  {
    id: 'belts', big: true, title: 'Belts and Arms',
    when: (p) => p.g.ents.belts.length > 0,
    text: 'Belts carry items on two lanes. Drag to place long lines; they curve on their own.\n\nA Clockwork Arm picks up from the tile behind it (green) and drops on the tile in front (gold). Chest -> arm -> machine -> arm -> belt is the basic recipe of every factory.\n\nHover a structure to see what it is doing. P opens production stats.',
  },
  { id: 'machine', when: (p) => p.g.ents.machines.length > 0, title: '', text: 'Right-click a machine to load it: it takes what you hold, or a matching ingredient from your bag. Finished goods wait inside.' },
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
  if (p.hud.toasts.some((t) => t.text.startsWith('Tip:'))) return;
  for (const t of TIPS) {
    if (p.g.flags.has('tip_' + t.id)) continue;
    // nothing else pops up before the welcome on the first morning
    if (t.id !== 'welcome' && p.g.dayIndex === 0 && !p.g.flags.has('tip_welcome')) continue;
    if (!t.when(p)) continue;
    p.g.flags.add('tip_' + t.id);
    // only the welcome is a window; everything else is a short toast, one at a time
    if (t.id === 'welcome') p.openWindow('dialog', { npc: 'ottoline', name: 'Professor Cogwhistle', hearts: -1, pages: t.text.replace('{name}', p.g.player.name).split('\n\n') });
    else p.toast('Tip: ' + (t.title ? t.title + ': ' : '') + t.text.split('\n\n')[0], undefined, 21);
    return;
  }
}
