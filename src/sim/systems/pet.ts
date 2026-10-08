// The farm pet: a stray cat or dog shows up early on. Adopt it, name it, fill its water bowl
// and give it a scratch every day; a happy pet follows you around and brings you little gifts.
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';
import { O, TileMap } from '../world/tilemap';
import { decorList, decorSolid, houseMap } from './house';
import { send } from './goals';
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';

export type PetKind = 'cat' | 'dog';
export const PET_COATS: Record<PetKind, string[]> = {
  cat: ['Ginger', 'Silver', 'Midnight', 'Calico'],
  dog: ['Golden', 'Chestnut', 'Patches', 'Sable'],
};
const DEFAULT_NAMES: Record<PetKind, string[]> = { cat: ['Biscuit', 'Pip', 'Marmalade', 'Soot'], dog: ['Pepper', 'Bramble', 'Scout', 'Mochi'] };

export interface PetState {
  stage: 'none' | 'stray' | 'adopted';
  kind: PetKind;
  coat: number;
  name: string;
  points: number;
  map: 'world' | 'house';
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  walkT: number;
  mode: 'idle' | 'wander' | 'follow' | 'sit' | 'sleep';
  tx: number;
  ty: number;
  t: number;
  petted: boolean;
  bowl: [number, number];
  bowlFull: boolean;
  emote: string | null;
  emoteT: number;
  declined: number;
}

export function petSys(g: Game): PetState {
  if (!g.sys.pet) {
    const kind: PetKind = g.rng.next() < 0.5 ? 'cat' : 'dog';
    const coat = g.rng.int(0, 3);
    g.sys.pet = {
      stage: 'none', kind, coat, name: DEFAULT_NAMES[kind][coat], points: 0, map: 'world', x: 0, y: 0, dir: 1, moving: false, walkT: 0,
      mode: 'idle', tx: 0, ty: 0, t: 0, petted: false, bowl: [0, 0], bowlFull: false, emote: null, emoteT: 0, declined: -1,
    } as PetState;
  }
  return g.sys.pet;
}

export function petHearts(p: PetState) {
  return Math.min(5, Math.floor(p.points / 200));
}

function mapOf(g: Game, p: PetState): TileMap {
  return p.map === 'house' ? houseMap(g) : g.map;
}

function free(g: Game, p: PetState, x: number, y: number): boolean {
  const m = mapOf(g, p);
  const tx = Math.floor(x), ty = Math.floor(y);
  if (!m.walkable(tx, ty)) return false;
  if (p.map === 'world') {
    const e = g.ents.at(tx, ty);
    if (e && !e.ghost && e.def.solid) return false;
  } else if (decorSolid(g, tx, ty)) return false;
  return true;
}

function placeBowl(g: Game, p: PetState) {
  const [dx, dy] = g.map.loc('farmhouse');
  for (const [ox, oy] of [[-2, 0], [-3, 0], [-2, 1], [2, 0], [-3, 1], [3, 1]]) {
    const x = dx + ox, y = dy + oy;
    if (g.map.walkable(x, y) && !g.map.o(x, y) && !g.ents.at(x, y)) { p.bowl = [x, y]; return; }
  }
  p.bowl = [dx - 2, dy];
  g.map.setO(dx - 2, dy, O.NONE);
}

function nearHome(g: Game): [number, number] {
  const [dx, dy] = g.map.loc('farmhouse');
  return [dx + 0.5, dy + 1.5];
}

/** the pet's preferred spot right now */
function wantsInside(g: Game): boolean {
  return g.time.min >= 20 * 60 || g.isRaining() || g.weather === 'snow';
}

function petBedSpot(g: Game): [number, number] {
  const bed = decorList(g).find((d) => d.id === 'f_petbed');
  return bed ? [bed.x + 0.5, bed.y + 0.75] : [5.5, 6.6];
}

function setEmote(p: PetState, e: string, t = 1.6) {
  p.emote = e;
  p.emoteT = t;
}

export function petAt(g: Game, x: number, y: number): PetState | null {
  const p = g.sys.pet as PetState | undefined;
  if (!p || p.stage === 'none') return null;
  if (p.map !== g.player.where) return null;
  return Math.abs(p.x - x) < 0.8 && Math.abs(p.y - 0.3 - y) < 0.9 ? p : null;
}

export function petInteract(g: Game, p: PetState) {
  if (p.stage === 'stray') {
    g.emit({ t: 'ui', open: 'adopt' });
    g.emit({ t: 'sfx', id: p.kind === 'cat' ? 'meow' : 'bark' });
    return;
  }
  if (!p.petted) {
    p.petted = true;
    p.points = Math.min(1000, p.points + 12);
  }
  setEmote(p, 'heart');
  p.mode = 'sit';
  p.t = 2;
  p.moving = false;
  p.dir = g.player.x < p.x ? 3 : 1;
  g.emit({ t: 'sfx', id: p.kind === 'cat' ? 'meow' : 'bark' });
  g.emit({ t: 'fx', kind: 'hearts', x: p.x, y: p.y });
  const h = petHearts(p);
  const mood = h >= 4 ? (p.kind === 'cat' ? 'purrs like a little engine' : 'wags so hard the whole dog wiggles') : h >= 2 ? (p.kind === 'cat' ? 'leans into the scratch' : 'rolls over for a belly rub') : p.kind === 'cat' ? 'tolerates you. For now.' : 'licks your hand';
  g.toast(`${p.name} ${mood}.`);
}

export function adoptPet(g: Game, name: string, coat?: number) {
  const p = petSys(g);
  p.stage = 'adopted';
  p.name = name.trim().slice(0, 14) || DEFAULT_NAMES[p.kind][p.coat];
  if (coat !== undefined) p.coat = coat;
  p.points = 60;
  setEmote(p, 'heart', 2.5);
  g.flags.add('pet_adopted');
  g.toast(`${p.name} is part of the farm now! Keep the water bowl by the door filled.`, undefined, C.rose);
  g.emit({ t: 'sfx', id: 'quest' });
  g.count('pet');
}

export function declinePet(g: Game) {
  const p = petSys(g);
  p.declined = g.dayIndex;
  g.toast(`The ${p.kind} trots off, glancing back at you. It might come by again.`);
}

/** watering can on the bowl tile */
export function fillBowl(g: Game, tx: number, ty: number): boolean {
  const p = g.sys.pet as PetState | undefined;
  if (!p || p.stage !== 'adopted' || g.player.where !== 'world') return false;
  if (tx !== p.bowl[0] || ty !== p.bowl[1]) return false;
  if (p.bowlFull) {
    g.toast(`${p.name}'s bowl is already full.`);
    return true;
  }
  p.bowlFull = true;
  g.player.water = Math.max(0, g.player.water - 1);
  g.emit({ t: 'sfx', id: 'water' });
  g.emit({ t: 'fx', kind: 'splash', x: tx + 0.5, y: ty + 0.5 });
  g.toast(`You fill ${p.name}'s water bowl.`);
  return true;
}

function step(g: Game, p: PetState, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.15) { p.moving = false; return true; }
  const s = Math.min(d, speed * dt);
  const nx = p.x + (dx / d) * s, ny = p.y + (dy / d) * s;
  let moved = false;
  if (free(g, p, nx, ny)) { p.x = nx; p.y = ny; moved = true; }
  else if (free(g, p, nx, p.y)) { p.x = nx; moved = true; }
  else if (free(g, p, p.x, ny)) { p.y = ny; moved = true; }
  p.moving = moved;
  if (moved) {
    p.walkT += dt * speed;
    if (Math.abs(dx) > 0.05) p.dir = dx < 0 ? 3 : 1;
  }
  return !moved;
}

function pickWander(g: Game, p: PetState) {
  const m = mapOf(g, p);
  for (let i = 0; i < 8; i++) {
    let x: number, y: number;
    if (p.map === 'house') { x = 1.5 + g.rng.next() * (m.w - 3); y = 3.5 + g.rng.next() * (m.h - 5.5); }
    else {
      const [hx, hy] = nearHome(g);
      x = hx + (g.rng.next() - 0.5) * 12;
      y = hy + (g.rng.next() - 0.3) * 8;
    }
    if (free(g, p, x, y)) { p.tx = x; p.ty = y; return; }
  }
  p.tx = p.x; p.ty = p.y;
}

function moveToMap(g: Game, p: PetState, map: 'world' | 'house') {
  p.map = map;
  if (map === 'house') {
    // its own bed if you bought one, else the rug by the hearth
    const [bx, by] = petBedSpot(g);
    p.x = bx; p.y = by; p.mode = 'idle';
  } else {
    const [hx, hy] = nearHome(g);
    p.x = hx; p.y = hy; p.mode = 'idle';
  }
  p.t = 1;
}

function tickPet(g: Game, dt: number) {
  const p = g.sys.pet as PetState | undefined;
  if (!p || p.stage === 'none' || g.map.w < 100) return;
  if (p.emoteT > 0) { p.emoteT -= dt; if (p.emoteT <= 0) p.emote = null; }
  const pl = g.player;
  const inside = wantsInside(g);
  // strays never go indoors; adopted pets head in at night and in bad weather
  if (p.stage === 'adopted') {
    if (inside && p.map === 'world' && !(pl.where === 'world' && Math.hypot(pl.x - p.x, pl.y - p.y) < 6 && g.time.min < 20 * 60)) moveToMap(g, p, 'house');
    else if (!inside && p.map === 'house' && pl.where !== 'house') moveToMap(g, p, 'world');
  }
  const sameMap = pl.where === p.map;
  const dist = sameMap ? Math.hypot(pl.x - p.x, pl.y - p.y) : 99;
  p.t -= dt;
  if (p.stage === 'adopted' && sameMap && p.map === 'world' && petHearts(p) >= 1 && dist > 3 && dist < 14 && pl.moving && p.mode !== 'sleep') p.mode = 'follow';
  switch (p.mode) {
    case 'follow': {
      if (!sameMap || dist > 16) { p.mode = 'idle'; p.t = 1; break; }
      if (dist < 2.2) { p.mode = 'sit'; p.t = 2 + g.rng.next() * 3; p.moving = false; break; }
      // trail a little behind
      step(g, p, pl.x - Math.sign(pl.x - p.x) * 1.2, pl.y + 0.4, dist > 6 ? 6.5 : 5, dt);
      break;
    }
    case 'wander':
      if (step(g, p, p.tx, p.ty, 2.2, dt) || p.t <= 0) { p.mode = 'idle'; p.t = 1 + g.rng.next() * 3; p.moving = false; }
      break;
    case 'sit':
    case 'sleep':
      p.moving = false;
      if (p.t <= 0) { p.mode = 'idle'; p.t = 0.5; }
      break;
    default: {
      p.moving = false;
      if (p.t > 0) break;
      const r = g.rng.next();
      const night = g.time.min >= 21 * 60 || g.time.min < 7 * 60;
      if (p.map === 'house' && night) {
        const [bx, by] = petBedSpot(g);
        if (Math.hypot(p.x - bx, p.y - by) > 0.4) { p.tx = bx; p.ty = by; p.mode = 'wander'; p.t = 8; }
        else { p.mode = 'sleep'; p.t = 20; if (g.rng.next() < 0.5) setEmote(p, 'zzz', 3); }
      }
      else if (r < 0.45) { pickWander(g, p); p.mode = 'wander'; p.t = 6; }
      else if (r < 0.75) { p.mode = 'sit'; p.t = 2 + g.rng.next() * 5; }
      else if (r < 0.85) { p.mode = 'sleep'; p.t = 6 + g.rng.next() * 8; }
      else { p.mode = 'idle'; p.t = 1 + g.rng.next() * 2; if (sameMap && dist < 6 && g.rng.next() < 0.4) setEmote(p, p.stage === 'stray' ? '?' : 'note', 1.2); }
    }
  }
}

function morningGift(g: Game, p: PetState) {
  const h = petHearts(p);
  if (h < 3 || g.rng.next() > 0.12 + h * 0.06) return;
  const season = g.time.season;
  const forage = [['wild_garlic', 'leek', 'daffodil', 'morel'], ['blackberry', 'sweet_pea', 'spice_berry', 'grape'], ['chanterelle', 'hazelnut', 'blackberry', 'wild_plum'], ['holly', 'winter_root', 'crystal_fruit', 'snow_yam']][season]
    .filter((id) => ITEM_BY_ID.has(id));
  const rare = ['geode', 'old_cog', 'fossil_shell', 'clay_whistle', 'feather', 'duck_feather'].filter((id) => ITEM_BY_ID.has(id));
  const pool = g.rng.next() < 0.2 && rare.length ? rare : forage.length ? forage : ['fiber'];
  const id = g.rng.pick(pool);
  const [dx, dy] = g.map.loc('farmhouse');
  g.sys.drops?.spawn?.(g, key(id), 1, dx + 1.5, dy + 1.1, false, 'world');
  g.sys.pet.giftNote = `${p.name} left a ${ITEM_BY_ID.get(id)!.name} by the door!`;
}

registerSystem({
  name: 'pet',
  tick: tickPet,
  dayEnd(g) {
    const p = g.sys.pet as PetState | undefined;
    if (!p || p.stage !== 'adopted') return;
    if (p.bowlFull || g.isRaining()) p.points = Math.min(1000, p.points + 6);
    if (!p.petted && !p.bowlFull) p.points = Math.max(0, p.points - 4);
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    const p = petSys(g);
    if (!p.bowl[0]) placeBowl(g, p);
    p.petted = false;
    p.bowlFull = g.isRaining();
    p.mode = 'idle';
    p.t = 1;
    if (p.stage === 'none' && g.daysPlayed >= 2) {
      p.stage = 'stray';
      const [hx, hy] = nearHome(g);
      p.map = 'world'; p.x = hx - 2; p.y = hy + 1;
      send(g, 'pet_stray', {
        from: 'marigold', title: 'A little visitor',
        text: `Morning, neighbor! A scruffy ${p.coat ? PET_COATS[p.kind][p.coat].toLowerCase() : 'ginger'} ${p.kind} has been sniffing around your farmhouse. Nobody in town is missing one. It looks like it's chosen you. Give it a scratch and see what happens! - Marigold`,
      });
    } else if (p.stage === 'stray' && p.declined >= 0 && g.dayIndex - p.declined < 2) {
      p.map = 'world'; p.x = -50; p.y = -50; // wandered off for a bit
    } else if (p.stage === 'stray') {
      const [hx, hy] = nearHome(g);
      p.map = 'world'; p.x = hx - 2; p.y = hy + 1;
    } else if (p.stage === 'adopted') {
      // morning: the pet slept by the hearth, so it's inside with you
      p.map = 'house';
      [p.x, p.y] = petBedSpot(g);
      p.mode = 'sleep'; p.t = 4;
      morningGift(g, p);
      if (g.sys.pet.giftNote) { g.toast(g.sys.pet.giftNote, undefined, C.amber); g.sys.pet.giftNote = null; }
    }
  },
  save(g) {
    const p = g.sys.pet as PetState | undefined;
    if (!p) return null;
    return { stage: p.stage, kind: p.kind, coat: p.coat, name: p.name, points: p.points, bowl: p.bowl, bowlFull: p.bowlFull, petted: p.petted, map: p.map, x: p.x, y: p.y, declined: p.declined };
  },
  load(g, d) {
    if (!d) return;
    const p = petSys(g);
    Object.assign(p, d);
    p.mode = 'idle';
    p.t = 1;
  },
});

