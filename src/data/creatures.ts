// Farm animals and the Deepworks' pests.
import { C } from './palette';
import type { AnimalDef, MonsterDef } from './types';

export const ANIMALS: AnimalDef[] = [
  { id: 'chicken', name: 'Chicken', building: 'coop', tier: 1, price: 600, product: 'egg', deluxe: 'large_egg', every: 1,
    look: { body: C.cream, body2: C.pebble, accent: C.rose, kind: 'chicken' }, desc: 'Lays an egg most mornings. Clucks at sunrise.' },
  { id: 'duck', name: 'Duck', building: 'coop', tier: 2, price: 1100, product: 'duck_egg', deluxe: 'duck_feather', every: 2,
    look: { body: C.cream, body2: C.tan, accent: C.amber, kind: 'duck' }, desc: 'Waddles everywhere. Leaves eggs and the odd feather.' },
  { id: 'rabbit', name: 'Rabbit', building: 'coop', tier: 3, price: 2400, product: 'rabbit_fluff', deluxe: 'lucky_foot', every: 3,
    look: { body: C.tan, body2: C.cream, accent: C.blush, kind: 'rabbit' }, desc: 'Sheds the softest fluff. Thumps when happy.' },
  { id: 'cow', name: 'Cow', building: 'barn', tier: 1, price: 1500, product: 'milk', deluxe: 'large_milk', every: 1,
    look: { body: C.cream, body2: C.bark, accent: C.blush, kind: 'cow' }, desc: 'Gentle, patient and full of milk.' },
  { id: 'goat', name: 'Goat', building: 'barn', tier: 2, price: 2000, product: 'goat_milk', deluxe: 'large_goat_milk', every: 2,
    look: { body: C.pebble, body2: C.stone, accent: C.walnut, kind: 'goat' }, desc: 'Climbs anything. Eats nearly everything.' },
  { id: 'sheep', name: 'Sheep', building: 'barn', tier: 2, price: 3000, product: 'wool', every: 3,
    look: { body: C.cream, body2: C.pebble, accent: C.ink, kind: 'sheep' }, desc: 'A walking cloud. Shear-free: the wool simply falls off.' },
  { id: 'pig', name: 'Pig', building: 'barn', tier: 3, price: 5000, product: 'truffle', every: 1,
    look: { body: C.blush, body2: C.rose, accent: C.wine, kind: 'pig' }, desc: 'Snuffles out truffles on fair days.' },
  { id: 'alpaca', name: 'Alpaca', building: 'barn', tier: 3, price: 4500, product: 'alpaca_fleece', every: 2,
    look: { body: C.tan, body2: C.butter, accent: C.walnut, kind: 'alpaca' }, desc: 'Fluffy, dignified, and a little judgmental.' },
];

export const ANIMAL_BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

// The Deepworks' pests (ROADMAP.md 7.2) replaced the Old Mine's monsters: they never hurt you, they
// get in the way, and one hit with a pickaxe or a sword is one hit (combat stays optional). Their
// drops keep the old monster drops obtainable (dew gel and moth dust feed the compost and tonics).
// The imported art reuses the old monster frames with a recolor (art/creatures/build-recipe.mjs).
export const MONSTERS: MonsterDef[] = [
  { id: 'rust_mite', name: 'Rust-mite', hp: 1, dmg: 0, speed: 1.7, floors: [1, 10], behavior: 'mite', xp: 3,
    drops: [{ item: 'slime_gel', chance: 0.8, n: [1, 2] }, { item: 'moth_dust', chance: 0.3 }],
    look: { body: C.copper, body2: C.rust, eye: C.butter, kind: 'mite' } },
  { id: 'clatter_crab', name: 'Clatter-crab', hp: 3, dmg: 0, speed: 3, floors: [11, 20], behavior: 'block', xp: 8,
    drops: [{ item: 'crab_shell', chance: 0.85 }, { item: 'iron_ore', chance: 0.35, n: [1, 3] }, { item: 'moth_dust', chance: 0.15 }],
    look: { body: C.pebble, body2: C.brass, eye: C.ink, kind: 'crab' } },
  { id: 'wisp', name: 'Wisp', hp: 1, dmg: 0, speed: 1.4, floors: [21, 30], behavior: 'guard', xp: 10,
    drops: [{ item: 'wisp_essence', chance: 0.7 }, { item: 'moth_dust', chance: 0.5, n: [1, 2] }],
    look: { body: C.aqua, body2: C.sky, eye: C.ink, kind: 'wisp' } },
];

export const MONSTER_BY_ID = new Map(MONSTERS.map((m) => [m.id, m]));
