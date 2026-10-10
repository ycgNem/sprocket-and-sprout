// Farmhouse furniture: bought from shops or received as gifts, placed inside the farmhouse.
import { C } from './palette';

export interface FurnDef {
  id: string;
  name: string;
  /** shop price (0 = gift only) */
  price: number;
  desc: string;
  /** sprite name under hf: (without the season suffix) */
  sprite: string;
  w: number;
  h: number;
  /** hangs on the wall row instead of standing on the floor */
  wall?: boolean;
  /** lies flat: can sit under other furniture, never blocks walking */
  flat?: boolean;
  solid: boolean;
  light?: { r: number; c: number };
  shop?: 'carpenter' | 'general' | 'cart';
  /** the shop stocks it only once this holds (Game.unlocked: 'flag:...') */
  unlock?: string;
}

export const FURNITURE: FurnDef[] = [
  { id: 'f_armchair_rose', name: 'Rose Armchair', price: 650, desc: 'Deep cushions in dusty rose.', sprite: 'armchair:0', w: 1, h: 1, solid: true, shop: 'carpenter' },
  { id: 'f_armchair_sage', name: 'Sage Armchair', price: 650, desc: 'A green velvet chair that has seen things.', sprite: 'armchair:1', w: 1, h: 1, solid: true, shop: 'carpenter' },
  { id: 'f_lamp', name: 'Reading Lamp', price: 480, desc: 'A brass floor lamp with a fringed shade.', sprite: 'lamp:0', w: 1, h: 1, solid: true, light: { r: 3, c: C.butter }, shop: 'carpenter' },
  { id: 'f_bookcase', name: 'Tall Bookcase', price: 900, desc: 'Room for every almanac you will ever own.', sprite: 'shelf:0', w: 1, h: 1, solid: true, shop: 'carpenter' },
  { id: 'f_pantry_shelf', name: 'Pantry Shelf', price: 700, desc: 'Jars of jam and pickles, and a stack of plates.', sprite: 'shelf:1', w: 1, h: 1, solid: true, shop: 'carpenter' },
  { id: 'f_rug_blue', name: 'Braided Rug', price: 800, desc: 'A round braided rug in river blues.', sprite: 'rug2:0', w: 2, h: 2, flat: true, solid: false, shop: 'carpenter' },
  { id: 'f_rug_green', name: 'Meadow Rug', price: 800, desc: 'A square rug woven with meadow flowers.', sprite: 'rug2:1', w: 2, h: 2, flat: true, solid: false, shop: 'carpenter' },
  { id: 'f_tank', name: 'Fish Tank', price: 1600, desc: 'A glass tank with three very calm goldfish.', sprite: 'tank:0', w: 2, h: 1, solid: true, light: { r: 2.2, c: C.aqua }, shop: 'carpenter' },
  { id: 'f_fig', name: 'Fiddle Fig', price: 350, desc: 'Big leaves, big personality.', sprite: 'plant:0', w: 1, h: 1, solid: true, shop: 'general' },
  { id: 'f_fern', name: 'Potted Fern', price: 300, desc: 'Happy in any corner.', sprite: 'plant:1', w: 1, h: 1, solid: true, shop: 'general' },
  // the hamster comes in its cage from the Professor ("Housewarming", src/data/goals.ts); the Mercantile
  // keeps a spare cage after that, should yours go astray
  { id: 'f_hamster_cage', name: 'Hamster Cage', price: 1000, desc: "A brass-barred cage with a wheel, a water bottle and a deep bed of shavings: a hamster's whole world.", sprite: 'hamstercage:0', w: 2, h: 1, solid: true, shop: 'general', unlock: 'flag:housewarming' },
  { id: 'f_petbed', name: 'Pet Bed', price: 400, desc: 'A plump cushion. Your pet will sleep here at night.', sprite: 'petbed:0', w: 1, h: 1, flat: true, solid: false, shop: 'general' },
  { id: 'f_paint_meadow', name: 'Painting: Meadow at Dawn', price: 0, desc: 'A gift from Hazel. Soft light over wet grass.', sprite: 'painting:0', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_paint_sea', name: 'Painting: Stormy Sea', price: 0, desc: 'A gift from Hazel. You can almost hear the waves.', sprite: 'painting:1', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_paint_tower', name: 'Painting: Clocktower at Dusk', price: 0, desc: 'A gift from Hazel. The town you helped restore.', sprite: 'painting:2', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_trophy_thistlefin', name: 'Mounted Thistlefin', price: 0, desc: 'Proof you landed the Golden Thistlefin.', sprite: 'trophy:0', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_trophy_clockjaw', name: 'Mounted Clockjaw', price: 0, desc: 'Old Clockjaw, still ticking (in spirit).', sprite: 'trophy:1', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_trophy_tidemother', name: 'Mounted Tidemother', price: 0, desc: 'The Tidemother herself. Wren wept.', sprite: 'trophy:2', w: 1, h: 1, wall: true, solid: false },
  { id: 'f_lantern', name: "Founder's Lantern", price: 0, desc: "The Sprocket Fair's prize for a line that beat two of the town's best. It never seems to burn down.", sprite: 'lantern:0', w: 1, h: 1, solid: true, light: { r: 3.5, c: C.amber } },
  { id: 'f_gilded_clock', name: 'Gilded Clock', price: 0, desc: "A towering clock for a line half again as good as the Sprocket Fair's best entry.", sprite: 'gclock:0', w: 1, h: 1, solid: true },
  { id: 'f_globe', name: 'Brass Globe', price: 1800, desc: 'Somewhere on it, very small, is Thistlewick.', sprite: 'globe:0', w: 1, h: 1, solid: true, shop: 'cart' },
  { id: 'f_telescope', name: 'Telescope', price: 2400, desc: 'Points at the stars, or at the neighbors. Your choice.', sprite: 'telescope:0', w: 1, h: 1, solid: true, shop: 'cart' },
  { id: 'f_musicbox', name: 'Music Box', price: 1200, desc: 'Plays a little tune when nobody is looking.', sprite: 'musicbox:0', w: 1, h: 1, solid: true, shop: 'cart' },
  { id: 'f_tapestry', name: 'Faraway Tapestry', price: 1500, desc: 'Woven in a land with purple mountains.', sprite: 'tapestry:0', w: 1, h: 1, wall: true, solid: false, shop: 'cart' },
  { id: 'f_banner', name: 'Guild Banner', price: 0, desc: 'Awarded by the Trading Guild to its Purveyors.', sprite: 'banner:0', w: 1, h: 1, wall: true, solid: false },
];

export const FURN_BY_ID = new Map(FURNITURE.map((f) => [f.id, f]));

/** Paintings Hazel sends as friendship grows. */
export const HAZEL_PAINTINGS: [number, string][] = [[2, 'f_paint_meadow'], [4, 'f_paint_sea'], [6, 'f_paint_tower']];
