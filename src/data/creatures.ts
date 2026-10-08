// Farm animals and mine monsters.
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

export const MONSTERS: MonsterDef[] = [
  { id: 'dew_blob', name: 'Dew Blob', hp: 24, dmg: 5, speed: 1.2, floors: [1, 25], behavior: 'hop', xp: 3,
    drops: [{ item: 'slime_gel', chance: 0.8, n: [1, 2] }, { item: 'copper_ore', chance: 0.15 }],
    look: { body: C.leaf, body2: C.grass, eye: C.ink, kind: 'blob' } },
  { id: 'cave_moth', name: 'Cave Moth', hp: 18, dmg: 6, speed: 2.2, floors: [4, 35], behavior: 'fly', xp: 4,
    drops: [{ item: 'moth_dust', chance: 0.7 }, { item: 'fiber', chance: 0.3 }],
    look: { body: C.tan, body2: C.walnut, eye: C.amber, kind: 'moth' } },
  { id: 'pebble_crab', name: 'Pebble Crab', hp: 60, dmg: 9, speed: 1.4, floors: [10, 45], behavior: 'chase', xp: 7,
    drops: [{ item: 'crab_shell', chance: 0.7 }, { item: 'iron_ore', chance: 0.3, n: [1, 3] }],
    look: { body: C.stone, body2: C.slate, eye: C.rose, kind: 'crab' } },
  { id: 'frost_blob', name: 'Frost Blob', hp: 70, dmg: 10, speed: 1.4, floors: [20, 40], behavior: 'hop', xp: 8,
    drops: [{ item: 'slime_gel', chance: 0.9, n: [2, 3] }, { item: 'frost_shard', chance: 0.25 }],
    look: { body: C.aqua, body2: C.sky, eye: C.ink, kind: 'blob' } },
  { id: 'burrow_mole', name: 'Burrow Mole', hp: 85, dmg: 12, speed: 1.8, floors: [22, 52], behavior: 'burrow', xp: 10,
    drops: [{ item: 'clay', chance: 0.6, n: [1, 3] }, { item: 'gold_ore', chance: 0.25 }],
    look: { body: C.walnut, body2: C.bark, eye: C.blush, kind: 'mole' } },
  { id: 'ember_wisp', name: 'Ember Wisp', hp: 70, dmg: 14, speed: 2.4, floors: [30, 60], behavior: 'shoot', xp: 12,
    drops: [{ item: 'wisp_essence', chance: 0.6 }, { item: 'coal', chance: 0.5, n: [1, 2] }],
    look: { body: C.amber, body2: C.terracotta, eye: C.cream, kind: 'wisp' } },
  { id: 'dusk_moth', name: 'Dusk Moth', hp: 90, dmg: 16, speed: 2.8, floors: [40, 60], behavior: 'fly', xp: 13,
    drops: [{ item: 'moth_dust', chance: 0.8, n: [1, 2] }, { item: 'amethyst', chance: 0.08 }],
    look: { body: C.violet, body2: C.plum, eye: C.lime, kind: 'moth' } },
  { id: 'rust_golem', name: 'Rust Golem', hp: 220, dmg: 22, speed: 1.0, floors: [45, 60], behavior: 'chase', xp: 25,
    drops: [{ item: 'iron_bar', chance: 0.5 }, { item: 'brass_gear', chance: 0.4, n: [1, 2] }, { item: 'starmetal_ore', chance: 0.2 }],
    look: { body: C.copper, body2: C.brick, eye: C.aqua, kind: 'golem' } },
];

export const MONSTER_BY_ID = new Map(MONSTERS.map((m) => [m.id, m]));
