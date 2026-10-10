// What the interact key (F / right-click) would do on a tile, without doing it. The play screen
// shows the answer as a little key bubble ("F Enter", "F Harvest"...), so every usable thing
// announces itself the moment you face it. Mirrors the order of `interact` in actions.ts.
import { CROP_BY_ID } from '../data/crops';
import { NPC_BY_ID } from '../data/npcs';
import { questName } from '../data/cookbook';
import { QUEST_BY_ID } from '../data/goals';
import type { Game } from './Game';
import { kDef } from './inventory';
import { cartHere } from './systems/cart';
import { canTill } from './systems/farming';
import { machAccept, stationRecipes } from './systems/machines';
import { wouldGift } from './systems/npcs';
import { petAt } from './systems/pet';
import { shopOpen } from './systems/town';
import { SHOPS } from '../data/shops';
import { curMap } from './systems/player';
import { minePrompt } from './systems/mine';
import { O } from './world/tilemap';

export interface Prompt {
  verb: string;
  /** where the bubble points (tile coords: the top centre of the thing) */
  x: number;
  y: number;
  /** a second, smaller line: another key that does something here */
  hint?: string;
}

/** a machine with two known recipes for one input (the crock: pickles or oil) picks one by lock */
function recipeChoice(g: Game, station: string): boolean {
  const seen = new Set<string>();
  for (const r of stationRecipes(station)) {
    if (!g.unlocked(r.unlock) || r.in.length !== 1) continue;
    if (seen.has(r.in[0].item)) return true;
    seen.add(r.in[0].item);
  }
  return false;
}



export function promptAt(g: Game, tx: number, ty: number): Prompt | null {
  const p = g.player;
  if (g.sleeping) return null;
  const m = curMap(g);
  if (!m.inb(tx, ty)) return null;
  const o = m.o(tx, ty);
  const top = (verb: string, lift = 0.1): Prompt => ({ verb, x: tx + 0.5, y: ty - lift });
  if (p.where === 'mine') return minePrompt(g, tx, ty);
  const pet = petAt(g, tx + 0.5, ty + 0.5);
  if (pet) return pet.stage === 'stray' ? { verb: 'Say hello', x: pet.x, y: pet.y - 1 } : pet.petted ? null : { verb: 'Pet ' + pet.name, x: pet.x, y: pet.y - 1 };
  if (p.where === 'house') {
    switch (o) {
      case O.BED: return top('Sleep', 0.6);
      case O.STOVE: return top(g.flags.has('home_kitchen') ? 'Cook' : 'Look');
      case O.ALMANAC: return top('Read the almanac');
      case O.FIREPLACE: return top('Warm up');
      case O.DOORMAT: return top('Go outside', -0.4);
    }
    return null;
  }
  const npc = g.sys.npcs?.at?.(g, tx + 0.5, ty + 0.5);
  if (npc) {
    const held = p.inv.slots[p.sel];
    const hd = held ? kDef(held.k) : null;
    const name = questName(npc.id, NPC_BY_ID.get(npc.id)?.name ?? '');
    // the same rules F follows (talkTo): the locket, then a gift, else a chat
    const verb = hd?.id === 'heart_charm' && npc.met ? 'Offer the locket' : hd && wouldGift(g, npc, hd) ? `Give to ${name}` : npc.talked ? `Chat with ${name}` : `Talk to ${name}`;
    return { verb, x: npc.x, y: npc.y - 2 };
  }
  const animal = g.sys.animals?.at?.(g, tx + 0.5, ty + 0.5);
  if (animal) return animal.petted ? null : { verb: 'Pet', x: animal.x, y: animal.y - 1.2 };
  const cp = g.sys.cart?.pos as [number, number] | undefined;
  if (cp && cartHere(g) && tx >= cp[0] - 1 && tx <= cp[0] + 3 && ty >= cp[1] - 1 && ty <= cp[1] + 2) return { verb: "Mags' cart", x: cp[0] + 1.5, y: cp[1] - 0.5 };
  const b = m.buildingAtTile(tx, ty) ?? m.buildingAtTile(tx, ty - 1);
  if (b && (ty === b.y + b.h - 1 || ty === b.y + b.h) && Math.abs(tx - b.door[0]) <= 1) {
    // the town keystones' landmarks (src/sim/systems/townworks.ts) are looked at, not entered
    const verb = b.kind === 'farmhouse' ? 'Enter' : b.kind === 'mine' ? 'Enter the Deepworks' : b.kind === 'tower' ? 'Clocktower' : b.kind === 'greenhouse' ? (g.flags.has('greenhouse_fixed') ? '' : 'Old greenhouse') : b.kind === 'landmark' ? 'Look' : 'Enter the ' + b.name.split(' ').pop();
    if (verb) return { verb, x: b.door[0] + 0.5, y: b.y + b.h - 1.2 };
  }
  if (b && b.id === 'greenhouse') return null;
  const e = g.ents.rootAt(tx, ty);
  if (e && !e.ghost) {
    const d = e.def;
    const at = (verb: string): Prompt => ({ verb, x: e.x + e.w / 2, y: e.y - 0.2 });
    if (e.st.rust) return at('Restore');
    if (d.kind === 'scarecrow') return at('Chat');
    const held = p.inv.slots[p.sel];
    // Shift+F opens any machine's window, where a recipe is locked in
    const choice = e.mach && d.kind !== 'beehouse' && recipeChoice(g, e.mach.station) ? 'Shift+F: recipes' : undefined;
    if (e.mach?.outBuf.length) return { ...at('Collect'), hint: choice };
    if (d.kind === 'shipbin') return held && kDef(held.k).price > 0 && !kDef(held.k).tool ? at('Ship ' + kDef(held.k).name) : at('Open crate');
    if (d.kind === 'depot') return at(held ? 'Deliver' : 'Open');
    if (e.mach && d.kind !== 'beehouse') {
      const loadable = p.inv.slots.some((sl) => sl && !kDef(sl.k).tool && !kDef(sl.k).weapon && !kDef(sl.k).fuel && machAccept(g, e, sl.k, true) > 0);
      return loadable ? { ...at('Load'), hint: choice } : at('Open');
    }
    if ((d.kind === 'tapper' || d.kind === 'fishtrap' || d.kind === 'harvester' || d.kind === 'drill') && e.inv && !e.inv.isEmpty()) return at('Collect');
    if (d.kind === 'belt' || d.kind === 'underground' || d.kind === 'splitter' || d.kind === 'path' || d.kind === 'fence' || d.kind === 'rail') return null;
    return at('Open');
  }
  const s = g.soil.get(m.idx(tx, ty));
  if (s?.crop?.ready) return top(CROP_BY_ID.get(s.crop.id)?.scythe ? 'Use the scythe' : 'Harvest', 0.5);
  if (s?.crop?.dead) return top('Clear');
  if (o === O.FORAGE) return top('Pick up');
  if (o === O.TREE) {
    const tr = m.trees.get(m.idx(tx, ty));
    return tr && tr.fruit > 0 ? top('Shake', 1.6) : null;
  }
  if (o === O.NOTICEBOARD) return top('Read the board', 0.8);
  if (o === O.MAILBOX) return top('Check the mail', 0.4);
  return null;
}

/** What a left click does with the item in hand on a tile (shown for the first few days). */
export function toolVerb(g: Game, tx: number, ty: number): string | null {
  const p = g.player;
  const m = g.map;
  if (p.where !== 'world' || !m.inb(tx, ty)) return null;
  const st = p.inv.slots[p.sel];
  if (!st) return null;
  const d = kDef(st.k);
  const i = m.idx(tx, ty);
  const s = g.soil.get(i);
  const o = m.obj[i];
  if (d.tool) {
    switch (d.tool.kind) {
      case 'hoe': return canTill(g, tx, ty) ? 'Till' : null;
      case 'can': return m.isWater(tx, ty) ? 'Refill' : s && !s.water ? 'Water' : null;
      case 'axe': return o === O.TREE || o === O.STUMP || o === O.LOG || o === O.TWIG ? 'Chop' : null;
      case 'pick': return o === O.ROCK || o === O.BOULDER || o === O.ORE_ROCK ? 'Break' : null;
      case 'scythe': return o === O.WEED || o === O.TALLGRASS ? 'Cut' : null;
    }
    return null;
  }
  if (d.cat === 'seed' && s && !s.crop) return 'Plant';
  return null;
}

/** 540 -> "9am", 1080 -> "6pm" */
const clock = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}${min % 60 ? ':' + String(min % 60).padStart(2, '0') : ''}${min < 720 ? 'am' : 'pm'}`;

/**
 * Where the current quest wants you to go, for the guide arrow and the off-screen compass:
 * among the quests the tracker shows, the nearest villager you still need to talk to who you
 * can reach now (outdoors, or in their open shop), else the first one with when they open, or
 * a place you still need to visit. Null when nothing needs walking to.
 */
/** what the guide arrow and the compass call a quest's places */
const LOC_LABEL: Record<string, string> = { board: 'Orders board', river_works: "The keeper's wheel", mine_entrance: 'The Deepworks', town_mill: 'The Town Mill', pump_house: 'The Waterworks' };

export function questTarget(g: Game): { x: number; y: number; label: string; npc?: string } | null {
  if (g.player.where !== 'world') return null;
  const q = g.sys.quests;
  if (!q?.active) return null;
  const p = g.player;
  // the same quests the tracker shows: tutorial steps first, at most three
  const shown = [...(q.active as { id: string; prog: number[] }[])]
    .sort((a, b) => (QUEST_BY_ID.get(b.id)?.tutorial ? 1 : 0) - (QUEST_BY_ID.get(a.id)?.tutorial ? 1 : 0))
    .slice(0, 3);
  let best: { x: number; y: number; label: string; score: number; npc?: string } | null = null;
  const consider = (x: number, y: number, label: string, score: number, npc?: string) => {
    if (!best || score < best.score) best = { x, y, label, score, npc };
  };
  // the Now strip's current step may say where to go for it (a villager or a place)
  const now = (q.now?.(g, 1) ?? [])[0] as { id: string; index: number } | undefined;
  const go = now ? QUEST_BY_ID.get(now.id)?.objectives[now.index]?.goto : undefined;
  for (const a of shown) {
    const def = QUEST_BY_ID.get(a.id);
    if (!def) continue;
    def.objectives.forEach((o0, i) => {
      let o = o0;
      const goHere = !!go && a.id === now!.id && i === now!.index;
      if (goHere && !g.sys.npcs?.byId?.get(go)) {
        const l = g.map.locs.get(go!);
        if (l) consider(l[0] + 0.5, l[1] - 0.5, LOC_LABEL[go!] ?? go![0].toUpperCase() + go!.slice(1), Math.hypot(l[0] - p.x, l[1] - p.y) + 2);
        return;
      }
      // a step that sends you to a villager (to buy, to deliver) points at them like a talk
      if (goHere) o = { t: 'talk', npc: go! };
      else if (a.prog[i] >= 1) return;
      if (o.t === 'talk') {
        const n = g.sys.npcs?.byId?.get(o.npc);
        if (!n || (o.met && n.met)) return;
        const name = questName(o.npc, NPC_BY_ID.get(o.npc)?.name ?? '');
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (n.visible) return consider(n.x, n.y - 1.6, name, d, o.npc);
        // indoors: point at the door they went in by, saying when the shop opens if it's shut
        const shop = SHOPS.find((s) => s.owner === o.npc);
        const open = !!shop && shopOpen(g, shop.id).open;
        consider(n.x, n.y - 0.6, shop && !open ? `${name} (opens ${clock(shop.open)})` : `${name} (inside)`, d + (open || !shop ? 4 : 500));
      } else if (o.t === 'visit') {
        const l = g.map.locs.get(o.loc);
        if (l) consider(l[0] + 0.5, l[1] - 0.5, o.loc[0].toUpperCase() + o.loc.slice(1), Math.hypot(l[0] - p.x, l[1] - p.y) + 2);
      }
    });
  }
  return best;
}
