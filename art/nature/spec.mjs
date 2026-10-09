// What the nature build makes: which raw candidate becomes which sprite, and the material ramps.
// Raw refs are "<batch>/<slot>" under art/nature/raw/ (PixelLab batch ids: art/nature/batches.json; prompts are in the generation log of each object).

// ---- ramps (dark -> light), all Resurrect 64 ----
export const LEAF = {
  deep: ['#374e4a', '#165a4c', '#239063', '#91db69', '#cddf6c'], // oak, fruit trees: deep shade between clumps
  bright: ['#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'], // maple, willow
  birch: ['#165a4c', '#239063', '#91db69', '#cddf6c', '#fbff86'],
  pine: ['#313638', '#374e4a', '#165a4c', '#239063', '#91db69'],
  frost: ['#323353', '#0b5e65', '#0b8a8f', '#0eaf9b', '#8ff8e2'], // snowberry: frosted blue-green
  palm: ['#165a4c', '#239063', '#91db69', '#cddf6c'],
};
/** fall ramps, same length as the leaf ramp they replace */
export const FALL = {
  amber: ['#45293f', '#9e4539', '#cd683d', '#f79617', '#fbb954'], // oak
  red: ['#45293f', '#ae2334', '#e83b3b', '#f57d4a', '#fbb954'], // maple
  gold: ['#4c3e24', '#676633', '#a2a947', '#f9c22b', '#fbff86'], // birch
  olive: ['#4c3e24', '#676633', '#a2a947', '#d5e04b', '#fbff86'], // willow
  orchard: ['#45293f', '#9e4539', '#cd683d', '#e6904e', '#fbb954'], // fruit trees
};
/** spring: one step fresher */
export const SPRING = {
  fresh: ['#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'],
  freshBright: ['#165a4c', '#1ebc73', '#91db69', '#cddf6c', '#fbff86'],
  blossomPink: ['#753c54', '#a24b6f', '#cf657f', '#ed8099', '#fdcbb0'], // cherry in spring: all pink
};
export const WOOD = ['#45293f', '#7a3045', '#9e4539', '#cd683d'];
export const BARK = ['#9babb2', '#c7dcd0', '#ffffff'];

// fruit colors (3 shades dark -> light) and how many fruits per fruitN 1..3
const fr = (ramp, shape = 'round', count = [3, 5, 8]) => ({ ramp, shape, count });

const WHITE_BLOSSOM = { petals: ['#c7dcd0', '#ffffff', '#f9c22b'], count: 14 };
const PINK_BLOSSOM = { petals: ['#cf657f', '#ed8099', '#fdcbb0'], count: 14 };
/** clean orchard canopies (t5, generated with 'no fruit') dealt out so neighbouring species don't share a set */
const ORCH = (a, b, c) => [`t5/${a}`, `t5/${b}`, `t5/${c}`];
const ORCH_BARE = ['t4/15', 't4/8', 't4/9'];
export const SEED = 'b16/48';
export const LAMP = 'y32/28';
export const BOARD = 'y32/33';
// small stages, shared by tree type
const BROAD = { sapling: ['b16/52', 'b16/53', 'b16/54'], saplingBare: ['b16/63'], sprout: ['b16/49', 'b16/50'] };
const FRUIT_SMALL = { young: ['y32/16', 'y32/17', 'y32/39'], youngBare: ['y32/26', 'y32/22', 'y32/40'], sapling: ['b16/61', 'b16/53'], saplingBare: ['b16/63'], sprout: ['b16/49', 'b16/50'] };
const PINE_SMALL = { sapling: ['b16/55'], sprout: ['b16/51'] };

export const TREES = {
  oak: { leaf: LEAF.deep, fall: 'amber', spring: 'fresh', mature: ['t1/0', 't1/15', 't1/1'], bare: ['t4/0', 't4/14', 't4/1'], young: ['y32/0', 'y32/1', 'y32/48'], youngBare: ['y32/22', 'y32/41', 'y32/21'], ...BROAD },
  maple: { leaf: LEAF.bright, fall: 'red', spring: 'freshBright', clean: true, mature: ['t2/6', 't2/7', 't2/5'], bare: ['t4/5', 't4/6', 't4/3'], young: ['y32/3', 'y32/36', 'y32/51'], youngBare: ['y32/40', 'y32/20', 'y32/21'], ...BROAD },
  birch: { leaf: LEAF.birch, birch: true, fall: 'gold', mature: ['t1/7', 't1/8', 't3/14'], bare: ['t3/8', 't3/9', 't3/10'], young: ['y32/5', 'y32/6', 'y32/37'], youngBare: ['y32/23', 'y32/24', 'y32/54'], sapling: ['b16/57', 'b16/58'], saplingBare: ['b16/63'], sprout: ['b16/49', 'b16/50'] },
  willow: { leaf: LEAF.deep, fall: 'olive', spring: 'fresh', mature: ['t1/10', 't2/14', 't2/15'], bare: ['t4/12', 't4/11', 't4/13'], young: ['y32/7', 'y32/8', 'y32/45'], youngBare: ['y32/25'], ...BROAD },
  pine: { leaf: LEAF.pine, snow: true, mature: ['t1/12', 't1/13', 't1/14'], young: ['y32/9', 'y32/10', 'y32/38'], ...PINE_SMALL },
  palm: { leaf: LEAF.palm, wood: ['#45293f', '#7a3045', '#966c6c', '#ab947a', '#e6904e'], mature: ['t3/0', 't3/3', 't3/2'], young: ['y32/12', 'y32/13', 'y32/47'], sapling: ['b16/59', 'b16/60'], sprout: ['b16/49', 'b16/50'], fruit: fr(['#45293f', '#7a3045', '#9e4539'], 'coconut', [2, 3, 4]) },
  snowberry: { leaf: LEAF.frost, frost: true, snow: true, mature: ['t3/4', 't3/5', 't3/6'], young: ['y32/14', 'y32/15', 'y32/46'], ...PINE_SMALL, saplingT: { frost: false }, fruit: fr(['#cd683d', '#fbb954', '#fdcbb0'], 'round', [3, 5, 8]) },
  apple: { leaf: LEAF.deep, fall: 'orchard', blossom: WHITE_BLOSSOM, mature: ORCH(0, 3, 12), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#ae2334', '#e83b3b', '#f68181']) },
  pear: { leaf: LEAF.deep, fall: 'orchard', blossom: WHITE_BLOSSOM, mature: ORCH(4, 10, 15), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#9e4539', '#f9c22b', '#fbff86'], 'pear') },
  cherry: { leaf: LEAF.deep, fall: 'orchard', spring: 'blossomPink', mature: ORCH(5, 2, 0), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#831c5d', '#c32454', '#f04f78'], 'small', [3, 5, 8]) },
  apricot: { leaf: LEAF.bright, fall: 'orchard', blossom: PINK_BLOSSOM, mature: ORCH(3, 8, 4), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#cd683d', '#f79617', '#fbb954']) },
  peach: { leaf: LEAF.deep, fall: 'orchard', blossom: PINK_BLOSSOM, mature: ORCH(12, 0, 5), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#cf657f', '#f68181', '#fca790']) },
  plum: { leaf: LEAF.pine, fall: 'orchard', blossom: WHITE_BLOSSOM, mature: ORCH(10, 2, 13), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#6b3e75', '#905ea9', '#a884f3']) },
  orange: { leaf: LEAF.deep, fall: 'orchard', blossom: WHITE_BLOSSOM, mature: ORCH(8, 15, 3), bare: ORCH_BARE, ...FRUIT_SMALL, fruit: fr(['#cd683d', '#fb6b1d', '#f9c22b']) },
};

// ---------------------------------------------------------------- flat objects (o:<O>:<variant>:<season>)
export const STONE = ['#3e3546', '#625565', '#966c6c', '#ab947a'];
export const MOSS = ['#165a4c', '#239063', '#91db69'];
export const WOOD5 = ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'];
export const PLANT = LEAF.deep;
/** winter-dry plants (tall grass, weeds, reeds): same drawing, straw and frost colors */
export const DRY = ['#3e3546', '#694f62', '#966c6c', '#ab947a', '#c7dcd0'];
export const OFALL = { amber: FALL.amber, olive: FALL.olive, red: FALL.red };

/**
 * Per object (O enum name): mat (color mapping), v = raw refs per variant (deco % 3, or objData
 * for flowers/ores/gems/treasure), and what the seasons do: undefined = same as summer,
 * { fall: 'amber' } = runtime recolor of the plant ramp, 'snow' = baked snow cap,
 * { ref: 'a2/63' } = other art. `fit` = how the art sits in the 16x16 frame.
 */
export const PETAL = {
  red: ['#ae2334', '#e83b3b', '#f68181', '#fca790'],
  yellow: ['#cd683d', '#f79617', '#f9c22b', '#fbff86'],
  purple: ['#45293f', '#6b3e75', '#905ea9', '#a884f3'],
  white: ['#7f708a', '#9babb2', '#c7dcd0', '#ffffff'],
  pink: ['#753c54', '#cf657f', '#ed8099', '#fdcbb0'],
  blue: ['#484a77', '#4d65b4', '#4d9be6', '#8fd3ff'],
};
const SNOW = { winter: 'snow' };
/**
 * Fallen sticks, drawn by hand on the 16x16 grid: one main stick at a shallow diagonal with a lit
 * top edge, a short side twig, end grain on the cut end. The build adds the #2e222f outline.
 * e end grain, h highlight, L lit top edge, M body, D knot / shade, g/G leaf.
 */
export const STICKS = {
  long: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....L...........',
    '.....L.......LL.',
    '......L...hLLMM.',
    '.......LhLMMM...',
    '....LLLMDM......',
    '.eLhMMM.........',
    '.eMM............',
    '................',
    '................',
    '................',
    '................',
  ],
  short: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........gG....',
    '.........Lg.....',
    '....eLhLLM......',
    '....eMMDMM..L...',
    '.........MLLM...',
    '...........M....',
    '................',
    '................',
    '................',
  ],
};
export const STICK_KEY = { e: '#e6904e', h: '#e6904e', L: '#cd683d', M: '#9e4539', D: '#7a3045', g: '#239063', G: '#91db69' };
const PLANT_SEASONS = (fall = 'amber') => ({ fall, winter: 'dry' });
export const OBJECTS = {
  ROCK: { mat: 'stone', v: ['a2/0', 'a2/2', 'a2/3'], ...SNOW },
  BOULDER: { mat: 'stone', v: ['a2/6', 'a2/7', 'a2/8'], ...SNOW },
  WEED: { mat: 'plant', v: ['a2/9', 'a2/10', 'a2/12'], ...PLANT_SEASONS('amber') },
  // hand-pixeled (STICKS below): the generated twigs read as crossed red X marks at 1x
  TWIG: { v: [{ draw: 'long' }, { draw: 'long', flipX: true }, { draw: 'short' }], winter: 'snowThin' },
  TALLGRASS: { mat: 'plant', v: ['a2/21', 'a2/22', 'a2/24'], spring: 'fresh', ...PLANT_SEASONS('olive') },
  BUSH: { mat: 'plant', v: ['a2/28', 'a2/27', 'a2/29'], fall: 'red', winter: 'snow' },
  FLOWER: { mat: 'plant', v: [{ ref: 'a2/31', petal: PETAL.red }, { ref: 'a2/32', petal: PETAL.yellow }, { ref: 'a2/36', petal: PETAL.purple, flipX: true }, { ref: 'a2/35', petal: PETAL.white }, { ref: 'a2/60', petal: PETAL.pink }, { ref: 'a2/36', petal: PETAL.blue }], fall: 'olive', winter: { ref: 'a2/63', mat: 'wood' } },
  STUMP: { mat: 'wood', v: ['a2/37', 'a2/38', 'a2/39'], ...SNOW },
  LOG: { mat: 'wood', v: ['a2/40', 'a2/41', 'a2/42'], ...SNOW },
  MUSHROOM: { mat: 'plant', v: ['a2/43', 'a2/44', 'a16/39'], ...SNOW },
  REEDS: { mat: 'plant', v: ['a2/46', 'a2/47', 'a16/44'], ...PLANT_SEASONS('olive') },
  LILYPAD: { mat: 'plant', v: ['a2/48', 'a2/49', 'a16/47'], fall: 'olive' },
  HEDGE: { mat: 'plant', v: ['b16/56', 'b16/62', 'a16/48'], ...SNOW },
  FENCE: { mat: 'wood', v: ['a2/52', 'a2/53', 'a2/52'], ...SNOW },
  ARTIFACT: { mat: 'wood', v: ['a2/54', 'a2/55', 'a2/54'] },
  // ---- mine (season is always 0 underground; ore rocks also sit in the overworld quarry) ----
  ORE_ROCK: { mat: 'ore', byData: true, v: [
    { ref: 'b16/0', accent: ['#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790'] }, // copper
    { ref: 'b16/1', accent: ['#7f708a', '#9babb2', '#c7dcd0', '#ffffff'] }, // tin
    { ref: 'b16/2', accent: ['#45293f', '#7a3045', '#9e4539', '#cd683d'] }, // iron
    { ref: 'b16/3', accent: ['#9e4539', '#f79617', '#f9c22b', '#fbff86'] }, // gold
    { ref: 'b16/4' }, // coal
    { ref: 'b16/5', accent: ['#484a77', '#905ea9', '#a884f3', '#eaaded'] }, // starmetal
    { ref: 'b16/6' }, // stone
    { ref: 'b16/7', mat: 'whole', ramp: ['#6e2727', '#9e4539', '#cd683d', '#e6904e'] }, // clay
  ], ...SNOW },
  GEM_ROCK: { mat: 'ore', byData: true, v: [
    { ref: 'b16/8', accent: ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'] }, // amethyst
    { ref: 'b16/9', accent: ['#9e4539', '#f79617', '#f9c22b', '#fbff86'] }, // topaz
    { ref: 'b16/10', accent: ['#165a4c', '#239063', '#1ebc73', '#91db69'] }, // jade
    { ref: 'b16/11', accent: ['#6e2727', '#ae2334', '#e83b3b', '#f68181'] }, // ruby
    { ref: 'b16/12', accent: ['#323353', '#4d65b4', '#4d9be6', '#8fd3ff'] }, // sapphire
    { ref: 'b16/13', accent: ['#cf657f', '#eaaded', '#c7dcd0', '#ffffff'] }, // opal
    { ref: 'b16/14', accent: ['#cd683d', '#f9c22b', '#fbff86', '#ffffff'] }, // starstone
  ] },
  ICE_ROCK: { mat: 'whole', ramp: ['#323353', '#4d65b4', '#4d9be6', '#8fd3ff', '#ffffff'], v: ['b16/15', 'b16/16', 'b16/15'] },
  CRYSTAL: { mat: 'ore', v: [
    { ref: 'b16/17', accent: ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'] },
    { ref: 'b16/18', accent: ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'] },
    { ref: 'b16/17', accent: ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'], flipX: true },
  ] },
  STALAGMITE: { mat: 'stone', v: ['b16/19', 'b16/20', 'b16/19'] },
  LADDER: { mat: 'free', v: ['b16/21'] },
  SHAFT: { mat: 'free', v: ['b16/23'] },
  ELEVATOR: { mat: 'free', v: ['b16/24'] },
  MINE_EXIT: { mat: 'free', v: ['b16/26'] },
  TREASURE: { mat: 'free', byData: true, v: ['b16/28', 'b16/29', 'b16/30'] },
  // ---- town and farm props ----
  FLOWERBED: { mat: 'bed', byData: true, v: [
    { ref: 'b16/31', petal: PETAL.red }, { ref: 'b16/32', petal: PETAL.yellow }, { ref: 'b16/33', petal: PETAL.purple },
    { ref: 'b16/34', petal: PETAL.white }, { ref: 'b16/35', petal: PETAL.pink }, { ref: 'b16/36', petal: PETAL.blue },
  ], winter: { ref: 'b16/37', mat: 'free' } },
  BENCH: { mat: 'free', v: ['b16/38', 'b16/39', 'b16/38'], ...SNOW },
  BARREL: { mat: 'free', v: ['b16/40'], ...SNOW },
  CRATE: { mat: 'free', v: ['b16/41'], ...SNOW },
  SIGNPOST: { mat: 'free', v: ['b16/42', 'b16/43', 'b16/42'], ...SNOW },
  WELL: { mat: 'free', v: ['b16/44', 'b16/45', 'b16/44'], ...SNOW },
  MAILBOX: { mat: 'free', v: ['b16/46'], ...SNOW },
};
