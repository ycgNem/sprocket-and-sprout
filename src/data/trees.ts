// Wild and fruit trees.
import { C } from './palette';
import type { TreeDef } from './types';

export const TREES: TreeDef[] = [
  // wild
  { id: 'oak', name: 'Oak', sapling: 'acorn', fruit: '', season: -1, grow: 12, wild: true, wood: 10, tap: 'oak_resin', saplingPrice: 0,
    look: { leaf: C.grass, leaf2: C.moss, trunk: C.walnut, shape: 'round' } },
  { id: 'maple', name: 'Maple', sapling: 'maple_seed', fruit: '', season: -1, grow: 10, wild: true, wood: 10, tap: 'maple_syrup', saplingPrice: 0,
    look: { leaf: C.leaf, leaf2: C.grass, trunk: C.oak, shape: 'round' } },
  { id: 'pine', name: 'Pine', sapling: 'pine_cone', fruit: '', season: -1, grow: 10, wild: true, wood: 12, tap: 'pine_tar', saplingPrice: 0,
    look: { leaf: C.moss, leaf2: C.pine, trunk: C.bark, shape: 'pine' } },
  { id: 'birch', name: 'Silver Birch', sapling: 'birch_seed', fruit: '', season: -1, grow: 9, wild: true, wood: 8, tap: 'birch_sap', saplingPrice: 0,
    look: { leaf: C.lime, leaf2: C.leaf, trunk: C.pebble, shape: 'tall' } },
  { id: 'willow', name: 'Willow', sapling: 'willow_twig', fruit: '', season: -1, grow: 12, wild: true, wood: 9, saplingPrice: 0,
    look: { leaf: C.leaf, leaf2: C.grass, trunk: C.walnut, shape: 'willow' } },
  { id: 'palm', name: 'Beach Palm', sapling: 'coconut', fruit: 'coconut', season: 1, grow: 20, wild: true, wood: 6, saplingPrice: 0,
    look: { leaf: C.grass, leaf2: C.moss, trunk: C.tan, shape: 'palm', fruit: C.walnut } },
  // fruit
  { id: 'apple', name: 'Apple Tree', sapling: 'apple_sapling', fruit: 'apple', season: 2, grow: 28, wood: 8, saplingPrice: 2000,
    look: { leaf: C.grass, leaf2: C.moss, trunk: C.walnut, fruit: C.rose, shape: 'round' } },
  { id: 'pear', name: 'Pear Tree', sapling: 'pear_sapling', fruit: 'pear', season: 1, grow: 28, wood: 8, saplingPrice: 2200,
    look: { leaf: C.leaf, leaf2: C.grass, trunk: C.walnut, fruit: C.lime, shape: 'round' } },
  { id: 'cherry', name: 'Cherry Tree', sapling: 'cherry_sapling', fruit: 'cherry', season: 0, grow: 28, wood: 8, saplingPrice: 1800,
    look: { leaf: C.blush, leaf2: C.rose, trunk: C.wine, fruit: C.rose, shape: 'round' } },
  { id: 'apricot', name: 'Apricot Tree', sapling: 'apricot_sapling', fruit: 'apricot', season: 0, grow: 28, wood: 8, saplingPrice: 1600,
    look: { leaf: C.leaf, leaf2: C.grass, trunk: C.oak, fruit: C.apricot, shape: 'round' } },
  { id: 'peach', name: 'Peach Tree', sapling: 'peach_sapling', fruit: 'peach', season: 1, grow: 28, wood: 8, saplingPrice: 3000,
    look: { leaf: C.grass, leaf2: C.moss, trunk: C.walnut, fruit: C.blush, shape: 'round' } },
  { id: 'plum', name: 'Plum Tree', sapling: 'plum_sapling', fruit: 'plum', season: 2, grow: 28, wood: 8, saplingPrice: 2600,
    look: { leaf: C.moss, leaf2: C.pine, trunk: C.bark, fruit: C.violet, shape: 'round' } },
  { id: 'orange', name: 'Sunorange Tree', sapling: 'orange_sapling', fruit: 'orange', season: 1, grow: 28, wood: 8, saplingPrice: 3200,
    look: { leaf: C.leaf, leaf2: C.grass, trunk: C.oak, fruit: C.amber, shape: 'round' } },
  { id: 'snowberry', name: 'Snowberry Tree', sapling: 'snowberry_sapling', fruit: 'snowberry', season: 3, grow: 28, wood: 8, saplingPrice: 3600,
    look: { leaf: C.aqua, leaf2: C.sky, trunk: C.slate, fruit: C.cream, shape: 'pine' } },
];

export const TREE_BY_ID = new Map(TREES.map((t) => [t.id, t]));
export const TREE_BY_SAPLING = new Map(TREES.map((t) => [t.sapling, t]));
