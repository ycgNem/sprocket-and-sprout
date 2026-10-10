// Crops. Seed + produce items are generated from these entries in items.ts.
import { C } from './palette';
import type { CropDef } from './types';

const SP = 0, SU = 1, FA = 2, WI = 3;

function crop(d: Omit<CropDef, 'seed' | 'produce'> & { seed?: string; produce?: string }): CropDef {
  return { seed: d.seed ?? d.id + '_seed', produce: d.produce ?? d.id, ...d } as CropDef;
}

export const CROPS: CropDef[] = [
  // ---------------- Spring ----------------
  crop({ id: 'radish', name: 'Radish', seasons: [SP], stages: [1, 1, 1, 1], price: 38, seedPrice: 18, icon: 'root',
    look: { style: 'root', leaf: C.leaf, fruit: C.rose, fruit2: C.cream }, edible: 12, desc: 'Crisp and peppery. Ready in no time.', tags: ['vegetable'] }),
  crop({ id: 'spinach', name: 'Spinach', seasons: [SP], stages: [1, 1, 2, 1], price: 52, seedPrice: 22, icon: 'leafy',
    look: { style: 'leafy', leaf: C.moss, fruit: C.grass }, edible: 15, desc: 'Dark tender leaves. Good for a long day.', tags: ['vegetable', 'greens'] }),
  crop({ id: 'pea', name: 'Sweet Pea', seasons: [SP], stages: [1, 2, 2, 2], regrow: 3, trellis: true, price: 28, seedPrice: 40, icon: 'pod', yield: [2, 3],
    look: { style: 'pod', leaf: C.leaf, fruit: C.lime }, edible: 8, desc: 'Climbs a trellis and keeps giving all spring.', tags: ['vegetable'] }),
  crop({ id: 'strawberry', name: 'Strawberry', seasons: [SP], stages: [1, 1, 2, 2, 2], regrow: 4, price: 70, seedPrice: 90, icon: 'berry',
    look: { style: 'bush', leaf: C.grass, fruit: C.rose, fruit2: C.butter }, edible: 20, cat: 'fruit', desc: 'Sweet, red and loved by nearly everyone.', tags: ['fruit'] }),
  crop({ id: 'tulip', name: 'Tulip', seasons: [SP], stages: [1, 1, 2, 2], price: 34, seedPrice: 20, icon: 'flower',
    look: { style: 'flower', leaf: C.grass, fruit: C.rose, fruit2: C.amber }, cat: 'flower', desc: 'A cheerful cup of color.', tags: ['flower'] }),
  crop({ id: 'potato', name: 'Potato', seasons: [SP], stages: [1, 1, 1, 2, 1], price: 64, seedPrice: 50, icon: 'tuber', yield: [1, 3],
    look: { style: 'tuber', leaf: C.moss, fruit: C.tan }, edible: 14, desc: 'Lumpy and dependable. Sometimes there are extras.', tags: ['vegetable'] }),
  crop({ id: 'cabbage', name: 'Cabbage', seasons: [SP], stages: [1, 2, 3, 3, 2], giant: true, price: 160, seedPrice: 80, icon: 'round',
    look: { style: 'leafy', leaf: C.leaf, fruit: C.lime }, edible: 25, desc: 'A heavy, squeaky head of leaves.', tags: ['vegetable', 'greens'] }),
  crop({ id: 'rhubarb', name: 'Rhubarb', seasons: [SP], stages: [2, 2, 2, 3, 3], price: 210, seedPrice: 100, icon: 'stalk',
    look: { style: 'cane', leaf: C.grass, fruit: C.rose }, desc: 'Tart red stalks. Wonderful in pies.', tags: ['vegetable'] }),
  crop({ id: 'flax', name: 'Flax', seasons: [SP, SU], stages: [1, 2, 2, 2], scythe: true, price: 30, seedPrice: 15, icon: 'grain', yield: [1, 2],
    look: { style: 'grain', leaf: C.grass, fruit: C.sky }, desc: 'Blue-flowered stems. A loom turns it into linen.', tags: ['fiber'] }),
  crop({ id: 'cogbean', name: 'Cogbean', seasons: [SP, SU], stages: [1, 1, 1, 1], regrow: 2, trellis: true, price: 46, seedPrice: 60, icon: 'cogbean', yield: [1, 2],
    look: { style: 'pod', leaf: C.moss, fruit: C.brass }, edible: 6, desc: 'An odd bean with toothed pods. Tinkerers love it.', tags: ['vegetable'] }),

  // ---------------- Summer ----------------
  crop({ id: 'tomato', name: 'Tomato', seasons: [SU], stages: [2, 2, 2, 2, 3], regrow: 4, price: 60, seedPrice: 50, icon: 'round',
    look: { style: 'vine', leaf: C.grass, fruit: C.terracotta }, edible: 12, desc: 'Sun-warm and juicy.', tags: ['vegetable'] }),
  crop({ id: 'corn', name: 'Corn', seasons: [SU, FA], stages: [2, 3, 3, 3, 3], regrow: 4, price: 50, seedPrice: 140, icon: 'corn',
    look: { style: 'stalk', leaf: C.leaf, fruit: C.amber }, edible: 10, desc: 'Tall and rustling. Grows into autumn.', tags: ['vegetable', 'grain'] }),
  crop({ id: 'melon', name: 'Melon', seasons: [SU], stages: [1, 2, 3, 3, 3], giant: true, price: 250, seedPrice: 80, icon: 'melon',
    look: { style: 'gourd', leaf: C.grass, fruit: C.leaf, fruit2: C.moss }, edible: 40, cat: 'fruit', desc: 'A big striped melon, cool inside.', tags: ['fruit'] }),
  crop({ id: 'blueberry', name: 'Blueberry', seasons: [SU], stages: [1, 3, 3, 4, 2], regrow: 4, yield: [3, 3], price: 50, seedPrice: 80, icon: 'berries',
    look: { style: 'bush', leaf: C.moss, fruit: C.sky, fruit2: C.violet }, edible: 10, cat: 'fruit', desc: 'Clusters of dusty-blue berries.', tags: ['fruit'] }),
  crop({ id: 'emberpepper', name: 'Ember Pepper', seasons: [SU], stages: [1, 1, 1, 1, 1], regrow: 3, price: 40, seedPrice: 40, icon: 'pepper',
    look: { style: 'bush', leaf: C.grass, fruit: C.terracotta, fruit2: C.amber }, edible: 5, cat: 'fruit', desc: 'Glows faintly orange. Hot enough to warm a winter.', tags: ['fruit', 'spicy'] }),
  crop({ id: 'sunflower', name: 'Sunflower', seasons: [SU, FA], stages: [1, 2, 3, 2], price: 80, seedPrice: 60, icon: 'sunflower',
    look: { style: 'flower', leaf: C.grass, fruit: C.amber, fruit2: C.walnut }, cat: 'flower', desc: 'Follows the sun all day long.', tags: ['flower'] }),
  crop({ id: 'wheat', name: 'Wheat', seasons: [SU, FA], stages: [1, 1, 1, 1], scythe: true, price: 25, seedPrice: 10, icon: 'grain',
    look: { style: 'grain', leaf: C.lime, fruit: C.amber }, desc: 'Golden grain. Mill it into flour.', tags: ['grain'] }),
  crop({ id: 'hops', name: 'Hops', seasons: [SU], stages: [1, 1, 2, 3, 4], regrow: 1, trellis: true, price: 25, seedPrice: 60, icon: 'hops',
    look: { style: 'pod', leaf: C.grass, fruit: C.lime }, desc: 'Fragrant cones. Brewers want every one.', tags: ['brew'] }),
  crop({ id: 'sweetcane', name: 'Sweetcane', seasons: [SU], stages: [1, 2, 2, 2, 2], scythe: true, price: 55, seedPrice: 30, icon: 'cane',
    look: { style: 'cane', leaf: C.leaf, fruit: C.lime }, desc: 'Chewy reeds full of sugar. A mill crushes them sweet.', tags: ['sugar'] }),
  crop({ id: 'cotton', name: 'Cotton', seasons: [SU, FA], stages: [2, 2, 2, 2], regrow: 3, price: 40, seedPrice: 45, icon: 'cotton',
    look: { style: 'bush', leaf: C.moss, fruit: C.cream }, desc: 'Soft white bolls. A loom spins it into cloth.', tags: ['fiber'] }),
  crop({ id: 'coffee', name: 'Coffee Cherry', seasons: [SU], stages: [1, 2, 2, 2, 3], regrow: 2, yield: [2, 4], price: 15, seedPrice: 120, icon: 'beans',
    look: { style: 'bush', leaf: C.pine, fruit: C.brick }, desc: 'Roast the beans for a morning that sparkles.', tags: ['brew'] }),
  crop({ id: 'rapeseed', name: 'Rapeseed', seasons: [SU], stages: [1, 1, 2, 2], scythe: true, price: 18, seedPrice: 20, icon: 'grain', yield: [2, 3],
    look: { style: 'grain', leaf: C.leaf, fruit: C.butter }, desc: 'A sea of yellow flowers, then pods of tiny black seeds. A mill presses them to oil.', tags: ['oilseed'] }),
  crop({ id: 'sunbell', name: 'Sunbell', seasons: [SU], stages: [2, 2, 2, 3], price: 140, seedPrice: 70, icon: 'bell',
    look: { style: 'flower', leaf: C.leaf, fruit: C.butter, fruit2: C.amber }, cat: 'flower', desc: 'A drooping bell that chimes in the breeze. Bees adore it.', tags: ['flower'] }),

  // ---------------- Fall ----------------
  crop({ id: 'pumpkin', name: 'Pumpkin', seasons: [FA], stages: [1, 2, 3, 4, 3], giant: true, price: 320, seedPrice: 100, icon: 'pumpkin',
    look: { style: 'gourd', leaf: C.grass, fruit: C.apricot, fruit2: C.terracotta }, edible: 20, desc: 'Round, ribbed and proud.', tags: ['vegetable'] }),
  crop({ id: 'cranberry', name: 'Cranberry', seasons: [FA], stages: [1, 2, 1, 1, 2], regrow: 5, yield: [2, 2], price: 75, seedPrice: 240, icon: 'berries',
    look: { style: 'bush', leaf: C.moss, fruit: C.rose, fruit2: C.wine }, edible: 8, cat: 'fruit', desc: 'Tart little gems from the bog.', tags: ['fruit'] }),
  crop({ id: 'eggplant', name: 'Eggplant', seasons: [FA], stages: [1, 1, 1, 1, 1], regrow: 5, price: 60, seedPrice: 20, icon: 'eggplant',
    look: { style: 'bush', leaf: C.moss, fruit: C.violet }, edible: 10, desc: 'Glossy purple and smooth as a pebble.', tags: ['vegetable'] }),
  crop({ id: 'grape', name: 'Grape', seasons: [FA], stages: [1, 1, 2, 3, 3], regrow: 3, trellis: true, price: 80, seedPrice: 60, icon: 'grapes',
    look: { style: 'pod', leaf: C.grass, fruit: C.violet, fruit2: C.lavender }, edible: 10, cat: 'fruit', desc: 'Heavy bunches that beg to become wine.', tags: ['fruit'] }),
  crop({ id: 'beet', name: 'Beet', seasons: [FA], stages: [1, 1, 2, 2], price: 100, seedPrice: 20, icon: 'root',
    look: { style: 'root', leaf: C.moss, fruit: C.wine, fruit2: C.rose }, edible: 12, desc: 'Earthy, deep red, and surprisingly sweet.', tags: ['vegetable', 'sugar'] }),
  crop({ id: 'yam', name: 'Yam', seasons: [FA], stages: [1, 3, 3, 3], price: 160, seedPrice: 60, icon: 'tuber',
    look: { style: 'tuber', leaf: C.grass, fruit: C.brick }, edible: 20, desc: 'A sturdy orange root for cold evenings.', tags: ['vegetable'] }),
  crop({ id: 'artichoke', name: 'Thistlechoke', seasons: [FA], stages: [2, 2, 1, 2, 1], price: 160, seedPrice: 30, icon: 'choke',
    look: { style: 'stalk', leaf: C.moss, fruit: C.grass, fruit2: C.lavender }, edible: 12, desc: 'The flower bud of a giant thistle. The town is named for it.', tags: ['vegetable'] }),
  crop({ id: 'barley', name: 'Barley', seasons: [SP, FA], stages: [1, 1, 2, 1], scythe: true, price: 30, seedPrice: 12, icon: 'grain',
    look: { style: 'grain', leaf: C.lime, fruit: C.tan }, desc: 'Bearded grain for brewing and baking.', tags: ['grain', 'brew'] }),
  crop({ id: 'glowmelon', name: 'Glowmelon', seasons: [FA], stages: [2, 3, 3, 4, 4], giant: true, price: 650, seedPrice: 250, icon: 'melon',
    look: { style: 'gourd', leaf: C.moss, fruit: C.aqua, fruit2: C.frost }, edible: 60, cat: 'fruit', desc: 'It hums softly and lights up at dusk. Worth a fortune.', tags: ['fruit', 'rare'] }),
  crop({ id: 'mooncap', name: 'Mooncap', seasons: [FA, WI], stages: [2, 2, 2, 2], price: 130, seedPrice: 60, icon: 'mushroom',
    look: { style: 'leafy', leaf: C.slate, fruit: C.lavender, fruit2: C.cream }, edible: 15, desc: 'A pale mushroom that sprouts in long shadows.', tags: ['vegetable', 'mushroom'] }),

  // ---------------- Winter ----------------
  crop({ id: 'frostmint', name: 'Frostmint', seasons: [WI], stages: [1, 1, 2, 2], regrow: 3, price: 55, seedPrice: 40, icon: 'leafy',
    look: { style: 'leafy', leaf: C.aqua, fruit: C.frost }, edible: 10, desc: 'Cool leaves that grow happily under snow.', tags: ['vegetable', 'greens', 'herb'] }),
  crop({ id: 'kale', name: 'Snow Kale', seasons: [WI], stages: [1, 2, 2, 1], price: 90, seedPrice: 35, icon: 'leafy',
    look: { style: 'leafy', leaf: C.moss, fruit: C.violet }, edible: 15, desc: 'Curly and frost-sweetened.', tags: ['vegetable', 'greens'] }),
  crop({ id: 'snowroot', name: 'Snowroot', seasons: [WI], stages: [1, 2, 2, 2], price: 120, seedPrice: 50, icon: 'root',
    look: { style: 'root', leaf: C.grass, fruit: C.frost, fruit2: C.cream }, edible: 18, desc: 'A white winter root that tastes like chestnuts.', tags: ['vegetable'] }),
  crop({ id: 'starpetal', name: 'Starpetal', seasons: [WI], stages: [2, 3, 3, 4], price: 400, seedPrice: 200, icon: 'starflower',
    look: { style: 'flower', leaf: C.pine, fruit: C.lavender, fruit2: C.butter }, cat: 'flower', desc: 'Its petals catch the starlight and keep it.', tags: ['flower', 'rare'] }),
  crop({ id: 'tealeaf', name: 'Tea Leaf', seasons: [SP, SU, FA], stages: [2, 2, 2, 2], regrow: 2, price: 30, seedPrice: 90, icon: 'leaf',
    look: { style: 'bush', leaf: C.moss, fruit: C.leaf }, desc: 'Pick the tips daily. Dry them for tea.', tags: ['herb', 'brew'] }),
];

export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]));
export const CROP_BY_SEED = new Map(CROPS.map((c) => [c.seed, c]));
