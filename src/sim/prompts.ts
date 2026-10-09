// What the interact key (F / right-click) would do on a tile, without doing it. The play screen
// shows the answer as a little key bubble ("F Enter", "F Harvest"...), so every usable thing
// announces itself the moment you face it. Mirrors the order of `interact` in actions.ts.
import { CROP_BY_ID } from '../data/crops';
import { NPC_BY_ID } from '../data/npcs';
import type { Game } from './Game';
import { kDef } from './inventory';
import { cartHere } from './systems/cart';
import { canTill } from './systems/farming';
import { petAt } from './systems/pet';
import { curMap } from './systems/player';
import { O } from './world/tilemap';

export interface Prompt {
  verb: string;
  /** where the bubble points (tile coords: the top centre of the thing) */
  x: number;
  y: number;
}

const first = (s: string) => s.split(' ')[0];

export function promptAt(g: Game, tx: number, ty: number): Prompt | null {
  const p = g.player;
  if (g.sleeping) return null;
  const m = curMap(g);
  if (!m.inb(tx, ty)) return null;
  const o = m.o(tx, ty);
  const top = (verb: string, lift = 0.1): Prompt => ({ verb, x: tx + 0.5, y: ty - lift });
  if (p.where === 'mine') {
    if (o === O.LADDER) return top('Climb down');
    if (o === O.SHAFT) return top('Jump down');
    if (o === O.MINE_EXIT) return top('Leave the mine');
    if (o === O.TREASURE) return top('Open');
    if (o === O.ELEVATOR) return top('Ride the lift');
    return null;
  }
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
    const name = first(NPC_BY_ID.get(npc.id)?.name ?? '');
    const gift = hd && !hd.tool && !hd.weapon && !hd.places && !npc.giftedToday;
    return { verb: gift ? `Give to ${name}` : npc.talked ? `Chat with ${name}` : `Talk to ${name}`, x: npc.x, y: npc.y - 2 };
  }
  const animal = g.sys.animals?.at?.(g, tx + 0.5, ty + 0.5);
  if (animal) return animal.petted ? null : { verb: 'Pet', x: animal.x, y: animal.y - 1.2 };
  const cp = g.sys.cart?.pos as [number, number] | undefined;
  if (cp && cartHere(g) && tx >= cp[0] - 1 && tx <= cp[0] + 3 && ty >= cp[1] - 1 && ty <= cp[1] + 2) return { verb: "Mags' cart", x: cp[0] + 1.5, y: cp[1] - 0.5 };
  const b = m.buildingAtTile(tx, ty) ?? m.buildingAtTile(tx, ty - 1);
  if (b && (ty === b.y + b.h - 1 || ty === b.y + b.h) && Math.abs(tx - b.door[0]) <= 1) {
    const verb = b.kind === 'farmhouse' ? 'Enter' : b.kind === 'mine' ? 'Enter the mine' : b.kind === 'tower' ? 'Clocktower' : b.kind === 'greenhouse' ? (g.flags.has('greenhouse_fixed') ? '' : 'Old greenhouse') : 'Enter ' + first(b.name);
    if (verb) return { verb, x: b.door[0] + 0.5, y: b.y + b.h - 1.2 };
  }
  if (b && b.id === 'greenhouse') return null;
  const e = g.ents.rootAt(tx, ty);
  if (e && !e.ghost) {
    const d = e.def;
    const at = (verb: string): Prompt => ({ verb, x: e.x + e.w / 2, y: e.y - 0.2 });
    if (d.kind === 'scarecrow') return at('Chat');
    if (e.mach?.outBuf.length) return at('Collect');
    const held = p.inv.slots[p.sel];
    if (d.kind === 'shipbin') return held && kDef(held.k).price > 0 && !kDef(held.k).tool ? at('Ship ' + kDef(held.k).name) : at('Open crate');
    if (d.kind === 'depot') return at(held ? 'Deliver' : 'Open');
    if (e.mach && d.kind !== 'beehouse') return at(e.mach.crafting ? 'Open' : 'Load');
    if ((d.kind === 'tapper' || d.kind === 'fishtrap' || d.kind === 'harvester' || d.kind === 'drill') && e.inv && !e.inv.isEmpty()) return at('Collect');
    if (d.kind === 'belt' || d.kind === 'underground' || d.kind === 'splitter' || d.kind === 'path' || d.kind === 'fence') return null;
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
