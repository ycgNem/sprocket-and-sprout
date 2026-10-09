// Player actions: tool use on tiles, planting, eating, and interacting with things.
import { C } from '../data/palette';
import { stockPond } from './systems/ponds';
import { cartHere } from './systems/cart';
import { knowsRecipe, learnRecipe } from './systems/cookbook';
import { contractInsert } from './systems/contracts';
import { fillBowl, petAt, petInteract } from './systems/pet';
import { BUFF_INFO } from '../data/buffs';
import { CROP_BY_ID, CROP_BY_SEED } from '../data/crops';
import { ITEM_BY_ID } from '../data/items';
import { TREE_BY_ID } from '../data/trees';
import type { Game } from './Game';
import { key, kDef, kId, ItemKey } from './inventory';
import { O, T, Z } from './world/tilemap';
import { canTill, fertilize, harvest, harvestStreak, plant, plantSapling, shakeTree, sprinklerTiles, till, waterTile, canPlant } from './systems/farming';
import { spawnDrop } from './systems/drops';
import { deconstruct } from './build';
import { machInsert, setRecipe } from './systems/machines';
import { curMap } from './systems/player';
import { Ent } from './ents';
import { portInsert } from './ports';

export const TOOL_POWER = [1, 1.6, 2.4, 3.4, 5];
const BASE_COST: Record<string, number> = { hoe: 2, can: 2, axe: 2, pick: 2, scythe: 0, rod: 3, sword: 0 };

export function toolCost(g: Game, kind: string, tier: number): number {
  const skill = kind === 'hoe' || kind === 'can' ? 'farming' : kind === 'axe' ? 'foraging' : kind === 'pick' ? 'mining' : kind === 'rod' ? 'fishing' : 'combat';
  const lvl = g.player.skills[skill] ?? 0;
  const buff = (1 - 0.1 * g.buffLvl('stamina')) * (kind === 'hoe' || kind === 'can' ? 1 - 0.1 * g.buffLvl('farming') : kind === 'pick' ? 1 - 0.08 * g.buffLvl('mining') : 1);
  return Math.max(0, (BASE_COST[kind] * (1 - 0.12 * tier) - lvl * 0.1) * buff);
}

function anim(g: Game, kind: string, tx: number, ty: number, dur = 0.32) {
  const p = g.player;
  p.anim = { kind, t: 0, dur, tx, ty };
  p.busy = dur;
  // face the target
  const dx = tx + 0.5 - p.x, dy = ty + 0.5 - (p.y - 0.3);
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 1 : 3;
  else if (Math.abs(dy) > 0.1) p.dir = dy > 0 ? 2 : 0;
}

function drop(g: Game, id: string, n: number, x: number, y: number, q = 0) {
  if (n <= 0) return;
  spawnDrop(g, key(id, q), n, x + 0.5, y + 0.5);
}

function fx(g: Game, kind: string, x: number, y: number, c?: number, n?: number) {
  g.emit({ t: 'fx', kind, x: x + 0.5, y: y + 0.5, c, n });
}

/** Area of tiles affected by a charged tool. */
export function toolArea(kind: string, level: number, tx: number, ty: number, dir: number): [number, number][] {
  const out: [number, number][] = [];
  if (level <= 0) return [[tx, ty]];
  const fx = [0, 1, 0, -1][dir], fy = [-1, 0, 1, 0][dir];
  if (level === 1) for (let i = 0; i < 3; i++) out.push([tx + fx * i, ty + fy * i]);
  else if (level === 2) for (let i = 0; i < 5; i++) out.push([tx + fx * i, ty + fy * i]);
  else {
    const r = level === 3 ? 1 : 2;
    const cx = tx + fx * r, cy = ty + fy * r;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) out.push([x, y]);
  }
  void kind;
  return out;
}

/** Use the held item on a tile (primary action). Returns true if something happened. */
export function useHeld(g: Game, tx: number, ty: number, charge = 0): boolean {
  const p = g.player;
  if (p.busy > 0.05 || g.sleeping) return false;
  const st = p.inv.slots[p.sel];
  if (!st) return false;
  const d = kDef(st.k);
  if (d.tool) return useTool(g, d.tool.kind, d.tool.tier, tx, ty, charge);
  if (d.tags?.includes('recipe_card')) {
    const out = d.id.slice(5);
    if (knowsRecipe(g, out)) g.toast('You already know this recipe.');
    else {
      learnRecipe(g, out, 'a recipe card');
      p.inv.remove(st.k, 1);
    }
    return true;
  }
  if (p.where === 'house') return false;
  if (d.weapon) {
    anim(g, 'sword', tx, ty, 0.28 / d.weapon.speed);
    g.emit({ t: 'sfx', id: 'swing' });
    g.sys.mine?.attack?.(g, tx, ty, d.weapon);
    if (p.where === 'world') {
      // swords also cut weeds and grass
      const m = g.map;
      if (m.o(tx, ty) === O.WEED || m.o(tx, ty) === O.TALLGRASS) clearPlant(g, tx, ty);
    }
    return true;
  }
  if (d.plant?.crop) return plantSeed(g, st.k, tx, ty);
  if (d.plant?.tree) {
    const err = plantSapling(g, tx, ty, d.plant.tree);
    if (err) g.toast(err);
    else {
      p.inv.remove(st.k, 1);
      g.emit({ t: 'sfx', id: 'plant' });
      fx(g, 'dust', tx, ty);
    }
    return !err;
  }
  if (d.fertilizer) {
    const i = g.map.idx(tx, ty);
    const err = fertilize(g, i, d.id);
    if (err) g.toast(err);
    else {
      p.inv.remove(st.k, 1);
      g.emit({ t: 'sfx', id: 'plant' });
      fx(g, 'sparkle', tx, ty);
    }
    return !err;
  }
  return false;
}

export function plantSeed(g: Game, k: ItemKey, tx: number, ty: number): boolean {
  const d = kDef(k);
  const cr = CROP_BY_SEED.get(d.id) ?? CROP_BY_ID.get(d.plant!.crop!);
  if (!cr || g.player.where !== 'world') return false;
  const i = g.map.idx(tx, ty);
  const err = canPlant(g, cr, i);
  if (err) {
    if (g.soil.has(i) || !canTill(g, tx, ty)) g.toast(err);
    return false;
  }
  plant(g, cr, i);
  g.player.inv.remove(k, 1);
  g.emit({ t: 'sfx', id: 'plant' });
  fx(g, 'seed', tx, ty);
  return true;
}

function clearPlant(g: Game, x: number, y: number) {
  const m = g.map;
  const o = m.o(x, y);
  if (o === O.WEED) {
    drop(g, 'fiber', 1 + (g.rng.next() < 0.4 ? 1 : 0), x, y);
    if (g.rng.next() < 0.03) drop(g, ['radish_seed', 'spinach_seed', 'tulip_seed', 'wheat_seed', 'pumpkin_seed', 'frostmint_seed'][g.time.season === 3 ? 5 : g.rng.int(0, 4)], 1, x, y);
  } else if (o === O.TALLGRASS) {
    const silo = g.ents.others.find((e) => e.def.id === 'silo');
    if (silo && g.rng.next() < 0.6) {
      const room = 240 * g.ents.others.filter((e) => e.def.id === 'silo').length - (g.sys.hay ?? 0);
      if (room > 0) {
        g.sys.hay = (g.sys.hay ?? 0) + 1;
        g.emit({ t: 'float', text: '+1 hay', x: x + 0.5, y, c: C.tan });
      }
    } else if (g.rng.next() < 0.3) drop(g, 'fiber', 1, x, y);
  }
  m.setO(x, y, O.NONE);
  fx(g, 'grass', x, y);
  g.emit({ t: 'sfx', id: 'cut' });
}

function hitTree(g: Game, x: number, y: number, power: number, tier: number) {
  const m = g.map;
  const i = m.idx(x, y);
  const t = m.trees.get(i);
  if (!t) return;
  if (!g.sys.treeShake) g.sys.treeShake = new Map();
  g.sys.treeShake.set(i, 4);
  const def = TREE_BY_ID.get(t.species);
  // tapped trees can't be chopped
  const ent = g.ents.at(x, y);
  if (ent && ent.def.kind === 'tapper') {
    g.toast('Remove the spigot first.');
    return;
  }
  if (t.stage <= 1) {
    m.setO(x, y, O.NONE);
    if (def && !def.wild) drop(g, def.sapling, 1, x, y);
    fx(g, 'leaves', x, y);
    return;
  }
  t.hp -= power;
  fx(g, 'chips', x, y);
  g.emit({ t: 'sfx', id: 'chop' });
  if (t.hp > 0) return;
  // tree falls
  const big = t.stage >= 4;
  const lj = g.hasPerk('lumberjack');
  const wood = Math.round((big ? (def?.wood ?? 8) + g.rng.int(-1, 3) + tier : t.stage === 3 ? 3 : 1) * (lj ? 1.25 : 1));
  drop(g, 'wood', wood, x, y);
  if (big && (t.species === 'oak' || t.species === 'maple') && g.rng.next() < (lj ? 0.6 : 0.3)) drop(g, 'hardwood', 1, x, y);
  if (big) drop(g, 'sap', g.rng.int(1, 3), x, y);
  if (big && def && g.rng.next() < 0.5) drop(g, def.sapling, 1, x, y);
  if (t.fruit > 0 && def?.fruit) drop(g, def.fruit, t.fruit, x, y);
  g.emit({ t: 'fx', kind: 'treefall', x: x + 0.5, y: y + 0.95, s: `tree:${t.species}:${t.stage}:${g.time.season}:0:${m.deco[i] % 3}`, dir: g.player.x < x + 0.5 ? 1 : -1 });
  m.setO(x, y, big && def?.wild ? O.STUMP : O.NONE);
  fx(g, 'leaves', x, y, def?.look.leaf, 30);
  g.emit({ t: 'shake', amt: 0.4 });
  g.emit({ t: 'sfx', id: 'treefall' });
  g.addXp('foraging', big ? 12 : 4);
  g.count('trees_chopped');
}

function rockDrops(g: Game, x: number, y: number, o: O, data: number) {
  const m = g.map;
  const quarry = m.z(x, y) === Z.QUARRY;
  if (o === O.ROCK) {
    drop(g, 'stone', g.rng.int(1, 2) + (quarry ? 1 : 0), x, y);
    if (g.rng.next() < (quarry ? 0.12 : 0.04)) drop(g, 'coal', 1, x, y);
    if (quarry && g.rng.next() < 0.04) drop(g, 'geode', 1, x, y);
    if (g.rng.next() < 0.02) drop(g, 'clay', 1, x, y);
  } else if (o === O.ORE_ROCK) {
    const ores = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore', 'coal', 'starmetal_ore', 'stone', 'clay'];
    drop(g, ores[data] ?? 'copper_ore', g.rng.int(1, 3), x, y);
    drop(g, 'stone', 1, x, y);
    if (g.rng.next() < 0.08) drop(g, 'geode', 1, x, y);
  } else if (o === O.BOULDER) {
    drop(g, 'stone', g.rng.int(8, 12), x, y);
    if (g.rng.next() < 0.3) drop(g, 'geode', 1, x, y);
  }
  g.addXp('mining', o === O.ORE_ROCK ? 5 : o === O.BOULDER ? 10 : 1);
}

export function useTool(g: Game, kind: string, tier: number, tx: number, ty: number, charge = 0): boolean {
  const p = g.player;
  const m = curMap(g);
  const power = TOOL_POWER[tier];
  const cost = toolCost(g, kind, tier) * (1 + charge * 0.6);
  if (p.energy <= -15 && kind !== 'sword') {
    g.toast('Too tired to work. Get some rest!');
    return false;
  }
  if (kind === 'rod') {
    g.sys.fishing?.cast?.(g, tx, ty);
    return true;
  }
  if (p.where === 'house') {
    g.toast('Not indoors!');
    return false;
  }
  if (p.where === 'mine') {
    anim(g, kind, tx, ty);
    g.spend(cost);
    g.sys.mine?.useTool?.(g, kind, tier, tx, ty);
    return true;
  }
  const tiles = kind === 'hoe' || kind === 'can' ? toolArea(kind, Math.min(charge, tier), tx, ty, p.dir) : [[tx, ty] as [number, number]];
  anim(g, kind, tx, ty, kind === 'can' ? 0.4 : 0.32);
  let did = false;
  switch (kind) {
    case 'hoe':
      for (const [x, y] of tiles) {
        if (m.o(x, y) === O.ARTIFACT) {
          digArtifact(g, x, y);
          did = true;
          continue;
        }
        if (till(g, x, y)) {
          did = true;
          fx(g, 'dirt', x, y);
          if (g.rng.next() < 0.02) drop(g, 'clay', 1, x, y);
        }
      }
      if (did) g.emit({ t: 'sfx', id: 'hoe' });
      else g.emit({ t: 'sfx', id: 'thud' });
      g.spend(cost);
      if (did) g.addXp('farming', 1);
      return true;
    case 'can': {
      if (fillBowl(g, tx, ty)) return true;
      // refill at water
      if (m.isWater(tx, ty) || (g.ents.at(tx, ty)?.def.id === 'well')) {
        const cap = [40, 55, 70, 85, 100][tier];
        p.water = cap;
        g.emit({ t: 'sfx', id: 'refill' });
        fx(g, 'splash', tx, ty);
        g.toast('Watering can refilled.');
        return true;
      }
      if (p.water <= 0) {
        g.toast('The watering can is empty. Refill it at water.');
        g.emit({ t: 'sfx', id: 'thud' });
        return true;
      }
      let used = 0;
      for (const [x, y] of tiles) {
        if (p.water - used <= 0) break;
        if (waterTile(g, x, y)) used++;
        fx(g, 'splash', x, y);
      }
      p.water -= Math.max(1, used);
      if (used && g.isRaining() && p.where === 'world') g.count('rain_water');
      g.spend(cost);
      g.emit({ t: 'sfx', id: 'water' });
      if (used) g.addXp('farming', 1);
      return true;
    }
    case 'axe': {
      g.spend(cost);
      const o = m.o(tx, ty);
      const i = m.idx(tx, ty);
      if (o === O.TREE) hitTree(g, tx, ty, power, tier);
      else if (o === O.STUMP || o === O.LOG) {
        const need = o === O.LOG ? 2 : 1;
        if (tier < need) {
          g.toast(`You need a ${o === O.LOG ? 'iron' : 'copper'} axe or better to split this.`);
          g.emit({ t: 'sfx', id: 'clang' });
          return true;
        }
        m.objData[i] += Math.ceil(power);
        fx(g, 'chips', tx, ty);
        g.emit({ t: 'sfx', id: 'chop' });
        if (m.objData[i] >= (o === O.LOG ? 10 : 5)) {
          drop(g, 'hardwood', o === O.LOG ? 8 : 2, tx, ty);
          drop(g, 'wood', o === O.LOG ? 0 : 2, tx, ty);
          m.setO(tx, ty, O.NONE);
          g.addXp('foraging', o === O.LOG ? 25 : 8);
        }
      } else if (o === O.TWIG) {
        drop(g, 'wood', g.rng.int(1, 2), tx, ty);
        m.setO(tx, ty, O.NONE);
        fx(g, 'chips', tx, ty);
        g.emit({ t: 'sfx', id: 'chop' });
      } else if (o === O.WEED || o === O.BUSH && m.z(tx, ty) === Z.FARM) {
        clearPlant(g, tx, ty);
      } else {
        const s = g.soil.get(i);
        if (s?.crop?.dead) s.crop = null;
        else {
          const e = g.ents.at(tx, ty);
          if (e && !e.ghost) deconstruct(g, e);
          else {
            g.emit({ t: 'sfx', id: 'swing' });
            g.count('air_swings');
          }
        }
      }
      return true;
    }
    case 'pick': {
      g.spend(cost);
      const o = m.o(tx, ty);
      const i = m.idx(tx, ty);
      if (o === O.ROCK || o === O.ORE_ROCK || o === O.BOULDER || o === O.GEM_ROCK) {
        if (o === O.BOULDER && tier < 1) {
          g.toast('This boulder needs a copper pickaxe or better.');
          g.emit({ t: 'sfx', id: 'clang' });
          return true;
        }
        const hp = o === O.ROCK ? 2 : o === O.ORE_ROCK ? 4 : 8;
        g.sys.rockHits = g.sys.rockHits ?? new Map<number, number>();
        const hits = (g.sys.rockHits.get(i) ?? 0) + power;
        fx(g, 'rock', tx, ty);
        g.emit({ t: 'sfx', id: 'pick' });
        if (hits >= hp) {
          rockDrops(g, tx, ty, o, m.objData[i]);
          m.setO(tx, ty, O.NONE);
          g.sys.rockHits.delete(i);
          g.emit({ t: 'sfx', id: 'rockbreak' });
        } else g.sys.rockHits.set(i, hits);
        return true;
      }
      const e = g.ents.at(tx, ty);
      if (e && !e.ghost) {
        deconstruct(g, e);
        return true;
      }
      // untill soil / lift player paths
      const s = g.soil.get(i);
      if (s && !s.crop) {
        g.soil.delete(i);
        fx(g, 'dirt', tx, ty);
        g.emit({ t: 'sfx', id: 'hoe' });
        return true;
      }
      if (s?.crop?.dead) {
        s.crop = null;
        return true;
      }
      const gr = m.g(tx, ty);
      if (m.z(tx, ty) === Z.FARM && (gr === T.PATH || gr === T.PLANKS)) {
        const pathItem = gr === T.PATH ? (m.objData[i] === 2 ? 'path_brick' : 'path_stone') : 'path_wood';
        m.setG(tx, ty, T.DIRT);
        drop(g, pathItem, 1, tx, ty);
        return true;
      }
      g.emit({ t: 'sfx', id: 'thud' });
      return true;
    }
    case 'scythe': {
      // sweep an arc around the facing tile
      const r = tier >= 3 ? 2 : 1;
      let any = false;
      for (let y = ty - r; y <= ty + r; y++)
        for (let x = tx - r; x <= tx + r; x++) {
          if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > r + 1.6) continue;
          const o = m.o(x, y);
          if (o === O.WEED || o === O.TALLGRASS) {
            clearPlant(g, x, y);
            any = true;
          }
          const i = m.idx(x, y);
          const s = g.soil.get(i);
          if (s?.crop) {
            const cr = CROP_BY_ID.get(s.crop.id);
            if (s.crop.dead) {
              s.crop = null;
              any = true;
            } else if (cr?.scythe && s.crop.ready) {
              const out = harvest(g, i);
              out?.forEach((st) => spawnDrop(g, st.k, st.n, x + 0.5, y + 0.5));
              any = true;
            }
          }
        }
      g.emit({ t: 'sfx', id: any ? 'cut' : 'swing' });
      return true;
    }
  }
  return false;
}

function digArtifact(g: Game, x: number, y: number) {
  const m = g.map;
  m.setO(x, y, O.NONE);
  // Tinker's Yard: the old workshop floor is full of salvage
  if (g.farmKind === 'ruins' && m.z(x, y) === Z.FARM && g.rng.next() < 0.5) {
    m.setO(x, y, O.NONE);
    drop(g, g.rng.next() < 0.7 ? 'copper_gear' : g.rng.pick(['spring', 'old_cog', 'copper_coil']), g.rng.int(1, 2), x, y);
    fx(g, 'dirt', x, y);
    g.emit({ t: 'sfx', id: 'dig' });
    g.count('dug');
    return;
  }
  const r = g.rng.next();
  const relics = ['old_cog', 'clay_whistle', 'fossil_shell', 'rusted_key', 'tin_soldier', 'star_chart', 'brass_compass', 'painted_tile'];
  if (r < 0.14) drop(g, g.rng.pick(relics), 1, x, y);
  else if (r < 0.5) drop(g, 'clay', g.rng.int(1, 3), x, y);
  else if (r < 0.65) drop(g, 'geode', 1, x, y);
  else if (r < 0.8) drop(g, g.rng.pick(['radish_seed', 'wheat_seed', 'tulip_seed', 'flax_seed', 'barley_seed', 'frostmint_seed']), g.rng.int(1, 4), x, y);
  else drop(g, 'stone', g.rng.int(2, 4), x, y);
  fx(g, 'dirt', x, y);
  g.emit({ t: 'sfx', id: 'dig' });
  g.addXp('foraging', 5);
  g.count('dug');
}

export function eatHeld(g: Game): boolean {
  const p = g.player;
  const st = p.inv.slots[p.sel];
  if (!st) return false;
  const d = kDef(st.k);
  if (!d.edible) return false;
  const q = st.k & 3;
  const mult = [1, 1.4, 1.8, 2.5][q];
  const maxE = p.maxEnergy + g.mods.energy;
  const fb = d.edible.buff;
  if (p.energy >= maxE && p.hp >= p.maxHp && !fb) {
    g.toast("You're not hungry right now.");
    return false;
  }
  p.inv.remove(st.k, 1);
  p.energy = Math.min(maxE, p.energy + d.edible.energy * mult);
  p.hp = Math.min(p.maxHp, p.hp + (d.edible.health ?? 0) * mult);
  if (p.energy > 0) p.exhausted = false;
  if (fb) {
    const had = p.buff;
    p.buff = { kind: fb.kind, lvl: fb.lvl, left: fb.min, src: d.id };
    const info = BUFF_INFO[fb.kind];
    g.toast(`${info.name} ${'I'.repeat(fb.lvl)} for ${fb.min / 60}h: ${info.per}${fb.lvl > 1 ? ` (x${fb.lvl})` : ''}${had && had.src !== d.id ? ' (replaces your last buff)' : ''}`, d.id, info.color);
  }
  g.emit({ t: 'sfx', id: 'eat' });
  g.count('eaten');
  g.count('eaten_day');
  if (g.time.min >= 1440) g.sys.achUnlock?.(g, 'midnightsnack');
  if ((g.counters.eaten_day ?? 0) >= 15) g.sys.achUnlock?.(g, 'glutton');
  g.emit({ t: 'float', text: `+${Math.round(d.edible.energy * mult)}`, x: p.x, y: p.y - 2, c: C.lime });
  g.stats.use(st.k, 1);
  return true;
}

/** Secondary action (right click / F): talk, harvest, open, collect, insert. */
export function interact(g: Game, tx: number, ty: number): boolean {
  const p = g.player;
  if (g.sleeping) return false;
  const m = curMap(g);
  if (p.where === 'mine') return g.sys.mine?.interact?.(g, tx, ty) ?? false;
  const pet = petAt(g, tx + 0.5, ty + 0.5);
  if (pet) {
    petInteract(g, pet);
    return true;
  }
  if (p.where === 'house') return g.sys.house?.interact?.(g, tx, ty) ?? false;
  // NPCs near the target
  const npc = g.sys.npcs?.at?.(g, tx + 0.5, ty + 0.5);
  if (npc) {
    g.sys.npcs.interact(g, npc);
    return true;
  }
  const animal = g.sys.animals?.at?.(g, tx + 0.5, ty + 0.5);
  if (animal) {
    g.sys.animals.pet(g, animal);
    return true;
  }
  const i = m.idx(tx, ty);
  // Mags' traveling cart
  const cp = g.sys.cart?.pos as [number, number] | undefined;
  if (cp && cartHere(g) && tx >= cp[0] - 1 && tx <= cp[0] + 3 && ty >= cp[1] - 1 && ty <= cp[1] + 2) {
    g.emit({ t: 'ui', open: 'shop', arg: 'cart' });
    g.emit({ t: 'sfx', id: 'open' });
    return true;
  }
  // buildings (doors)
  const b = m.buildingAtTile(tx, ty) ?? m.buildingAtTile(tx, ty - 1);
  if (b && (ty === b.y + b.h - 1 || ty === b.y + b.h) && Math.abs(tx - b.door[0]) <= 1) {
    g.sys.town?.door?.(g, b);
    return true;
  }
  if (b && b.id === 'greenhouse') return false;
  // structures
  const e = g.ents.rootAt(tx, ty);
  if (e && !e.ghost) return interactStruct(g, e);
  // crops
  const s = g.soil.get(i);
  if (s?.crop?.ready) {
    const cr = CROP_BY_ID.get(s.crop.id)!;
    if (cr.scythe) {
      g.toast('Use a scythe to harvest grain.');
      return true;
    }
    const out = harvest(g, i);
    if (out?.length) {
      const streak = harvestStreak(g);
      if (streak.bonus) out.push({ k: key(cr.produce, 0), n: 1 });
      for (const st of out) g.give(st.k, st.n);
      g.emit({ t: 'fx', kind: 'leaves', x: tx + 0.5, y: ty + 0.5, c: cr.look.leaf, n: 6 });
      // the play screen plays the (streak-pitched) pick sound and flies the crop to its slot
      g.emit({ t: 'harvest', x: tx + 0.5, y: ty + 0.5, k: out[0].k, n: out.reduce((a, s) => a + s.n, 0), streak: streak.n, bonus: streak.bonus });
    }
    return true;
  }
  if (s?.crop?.dead) {
    s.crop = null;
    g.emit({ t: 'sfx', id: 'cut' });
    return true;
  }
  const o = m.obj[i];
  if (o === O.FORAGE) {
    const id = m.forage.get(i);
    m.setO(tx, ty, O.NONE);
    if (id) {
      const lvl = p.skills.foraging ?? 0;
      const luck = g.buffLvl('luck');
      const q = g.hasPerk('botanist') ? 2 : g.rng.next() < lvl * 0.05 + luck * 0.04 ? 2 : g.rng.next() < lvl * 0.08 + 0.1 ? 1 : 0;
      g.give(key(id, ITEM_BY_ID.get(id)?.quality ? q : 0), g.rng.next() < luck * 0.1 + (g.hasPerk('gatherer') ? 0.2 : 0) ? 2 : 1);
      g.addXp('foraging', 7);
      g.count('foraged');
      g.emit({ t: 'sfx', id: 'pickup' });
    }
    return true;
  }
  if (o === O.TREE) {
    const out = shakeTree(g, i);
    if (!g.sys.treeShake) g.sys.treeShake = new Map();
    g.sys.treeShake.set(i, 3);
    g.count('shakes');
    g.emit({ t: 'sfx', id: 'rustle' });
    for (const st of out) spawnDrop(g, st.k, st.n, tx + 0.5, ty + 0.8);
    return true;
  }
  if (o === O.NOTICEBOARD) {
    g.emit({ t: 'ui', open: 'board' });
    return true;
  }
  if (o === O.MAILBOX) {
    g.emit({ t: 'ui', open: 'mail' });
    return true;
  }
  return false;
}

export function interactStruct(g: Game, e: Ent): boolean {
  const p = g.player;
  const held = p.inv.slots[p.sel];
  const d = e.def;
  if (d.kind === 'scarecrow') {
    const lines = ['The scarecrow stares into the middle distance.', 'You tell the scarecrow about your day. It seems to listen.', "The scarecrow's button eyes look... grateful?", 'A crow lands on the scarecrow, sees you, and leaves.'];
    g.toast(lines[(g.counters.scare_talk = (g.counters.scare_talk ?? 0) + 1) % lines.length]);
    if (g.counters.scare_talk >= 3) g.sys.achUnlock?.(g, 'scarecrow');
    return true;
  }
  // collect machine output first
  if (e.mach && e.mach.outBuf.length) {
    let got = 0;
    for (const s of [...e.mach.outBuf]) {
      const added = g.give(s.k, s.n);
      s.n -= added;
      got += added;
    }
    e.mach.outBuf = e.mach.outBuf.filter((s) => s.n > 0);
    if (got) {
      g.emit({ t: 'sfx', id: 'collect' });
      g.addXp('tinkering', 2);
      return true;
    }
  }
  // quick insert held item into machines
  if (e.mach && held && d.kind !== 'beehouse') {
    const hd = kDef(held.k);
    if (!hd.tool && !hd.weapon) {
      const n = machInsert(g, e, held.k, held.n, true);
      if (n > 0) {
        p.inv.remove(held.k, n);
        g.sys.quests?.notify?.(g, 'load', 1, d.id);
        g.emit({ t: 'hop', ent: e.id });
        g.emit({ t: 'sfx', id: 'insert' });
        g.emit({ t: 'float', text: `+${n}`, x: e.x + e.w / 2, y: e.y, c: C.cream });
        return true;
      }
    }
  }
  // nothing loadable in hand: load the first ingredient the machine takes from anywhere in the bag
  // (fuel stays put: hold it to add fuel on purpose)
  if (e.mach && d.kind !== 'beehouse') {
    let loaded = 0, what = '';
    for (const s of p.inv.slots) {
      if (!s) continue;
      const sd = kDef(s.k);
      if (sd.tool || sd.weapon || sd.fuel || (what && sd.id !== what)) continue;
      const n = machInsert(g, e, s.k, s.n, true);
      if (n > 0) {
        p.inv.remove(s.k, n);
        loaded += n;
        what = sd.id;
      }
    }
    if (loaded) {
      g.sys.quests?.notify?.(g, 'load', 1, d.id);
      g.emit({ t: 'hop', ent: e.id });
      g.emit({ t: 'sfx', id: 'insert' });
      g.emit({ t: 'float', text: `+${loaded}`, x: e.x + e.w / 2, y: e.y, c: C.cream });
      g.toast(`Loaded ${loaded} ${ITEM_BY_ID.get(what)?.name ?? what} from your bag.`);
      return true;
    }
  }
  // the study desk: F loads research bundles from the bag, then (if no topic is picked) opens
  // the research tree, so the first study is one key away
  if (d.kind === 'lab') {
    let loaded = 0;
    for (const s of [...p.inv.slots]) {
      if (!s || kDef(s.k).cat !== 'research') continue;
      const n = portInsert(g, e, s.k, s.n, 0);
      if (n > 0) {
        p.inv.remove(s.k, n);
        loaded += n;
      }
    }
    if (loaded) {
      g.emit({ t: 'hop', ent: e.id });
      g.emit({ t: 'sfx', id: 'insert' });
      g.emit({ t: 'float', text: `+${loaded}`, x: e.x + e.w / 2, y: e.y, c: C.cream });
    }
    if (loaded && !g.research.current) {
      g.emit({ t: 'ui', open: 'research' });
      return true;
    }
    if (loaded) return true;
  }
  if (d.kind === 'pond' && held && kDef(held.k).cat === 'fish') {
    if (stockPond(g, e, held.k)) {
      p.inv.remove(held.k, 1);
      g.emit({ t: 'sfx', id: 'splash' });
      g.toast(`You release a ${kDef(held.k).name} into the pond (${e.st.pop}/10).`);
    } else g.toast(e.st.fish && e.st.fish !== kDef(held.k).id ? `This pond is for ${ITEM_BY_ID.get(e.st.fish)?.name}.` : kDef(held.k).tags?.includes('legendary') ? 'A legend belongs in the wild.' : 'The pond is full.');
    return true;
  }
  if (d.kind === 'depot' && held) {
    const used = contractInsert(g, held.k, held.n);
    if (used) {
      p.inv.remove(held.k, used);
      g.emit({ t: 'sfx', id: 'ship' });
      g.emit({ t: 'float', text: `Delivered ${used}`, x: e.x + 1.5, y: e.y, c: C.butter });
      return true;
    }
  }
  if (d.kind === 'shipbin' && held) {
    const hd = kDef(held.k);
    if (hd.price > 0 && !hd.tool && !hd.weapon) {
      const left = e.inv!.add(held.k, held.n);
      const n = held.n - left;
      p.inv.remove(held.k, n);
      if (n) {
        g.emit({ t: 'sfx', id: 'ship' });
        // the play screen pops what they'll fetch, like goods an arm drops in
        g.emit({ t: 'crated', k: held.k, n, x: e.x + 0.5, y: e.y - 0.1, ent: e.id });
      }
      return true;
    }
  }
  if (d.kind === 'tapper' || d.kind === 'fishtrap' || d.kind === 'harvester' || d.kind === 'drill') {
    // collect contents directly
    if (e.inv && !e.inv.isEmpty()) {
      for (let i = 0; i < e.inv.slots.length; i++) {
        const s = e.inv.slots[i];
        if (!s) continue;
        const added = g.give(s.k, s.n);
        s.n -= added;
        if (s.n <= 0) e.inv.slots[i] = null;
      }
      g.emit({ t: 'sfx', id: 'collect' });
      return true;
    }
    if (d.kind === 'fishtrap' && held && kDef(held.k).cat === 'bait') {
      p.inv.remove(held.k, 1);
      e.st.bait = kId(held.k) === 'deluxe_bait' ? 2 : 1;
      g.emit({ t: 'sfx', id: 'insert' });
      g.toast('Trap baited.');
      return true;
    }
  }
  if (d.kind === 'hive' && held && kId(held.k) === 'bumblebot') {
    e.st.bots += held.n;
    p.inv.remove(held.k, held.n);
    g.emit({ t: 'sfx', id: 'insert' });
    return true;
  }
  if (d.kind === 'decor' && d.id === 'sign') {
    e.st.k = held ? held.k : null;
    return true;
  }
  g.emit({ t: 'ui', open: 'struct', arg: e.id });
  return true;
}

export { setRecipe, sprinklerTiles };
