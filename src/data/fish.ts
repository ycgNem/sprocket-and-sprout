// Fish, by location, season, hours and weather. Items are generated in items.ts.
import { C } from './palette';
import type { FishDef } from './types';

const ALL = [0, 1, 2, 3] as const;

export const FISH: FishDef[] = [
  // ---- river ----
  { id: 'silver_dart', name: 'Silver Dart', price: 30, where: ['river', 'lake'], seasons: [...ALL], hours: [6, 26], difficulty: 12, behavior: 'calm',
    look: { body: C.pebble, belly: C.cream, fin: C.stone, shape: 'slim' }, desc: 'A quick little fish that flashes in the shallows.' },
  { id: 'brook_trout', name: 'Brook Trout', price: 65, where: ['river'], seasons: [0, 2], hours: [6, 19], difficulty: 30, behavior: 'dart',
    look: { body: C.moss, belly: C.blush, fin: C.grass, shape: 'slim' }, desc: 'Speckled and strong. Loves cold, fast water.' },
  { id: 'rosy_perch', name: 'Rosy Perch', price: 55, where: ['river'], seasons: [1], hours: [6, 20], difficulty: 25, behavior: 'calm',
    look: { body: C.blush, belly: C.butter, fin: C.rose, shape: 'round' }, desc: 'Blushing pink stripes. Summer favorite.' },
  { id: 'mud_catfish', name: 'Mud Catfish', price: 140, where: ['river'], seasons: [0, 2], hours: [18, 26], weather: 'rain', difficulty: 60, behavior: 'sink',
    look: { body: C.walnut, belly: C.tan, fin: C.bark, shape: 'long' }, desc: 'Whiskered and stubborn. Bites on rainy nights.' },
  { id: 'frost_char', name: 'Frost Char', price: 90, where: ['river'], seasons: [3], hours: [6, 18], difficulty: 45, behavior: 'dart',
    look: { body: C.aqua, belly: C.frost, fin: C.sky, shape: 'slim' }, desc: 'Lives under the ice and swims like a needle.' },
  { id: 'river_sculpin', name: 'Stone Sculpin', price: 40, where: ['river'], seasons: [...ALL], hours: [6, 26], difficulty: 20, behavior: 'sink',
    look: { body: C.stone, belly: C.pebble, fin: C.slate, shape: 'flat' }, desc: 'Hides under river stones. Looks like one too.' },
  // ---- lake ----
  { id: 'copper_carp', name: 'Copperscale Carp', price: 50, where: ['lake', 'pond'], seasons: [...ALL], hours: [6, 26], difficulty: 18, behavior: 'calm',
    look: { body: C.copper, belly: C.amber, fin: C.terracotta, shape: 'round' }, desc: 'Scales like old pennies.' },
  { id: 'lantern_pike', name: 'Lantern Pike', price: 180, where: ['lake'], seasons: [1, 2], hours: [20, 26], difficulty: 70, behavior: 'erratic',
    look: { body: C.moss, belly: C.butter, fin: C.amber, shape: 'long' }, desc: 'A lure on its forehead glows at night.' },
  { id: 'reed_bream', name: 'Reed Bream', price: 45, where: ['lake'], seasons: [0, 1], hours: [6, 20], difficulty: 20, behavior: 'float',
    look: { body: C.tan, belly: C.butter, fin: C.oak, shape: 'flat' }, desc: 'Lingers among the reeds in spring.' },
  { id: 'bluegill', name: 'Bluegill', price: 35, where: ['lake', 'pond'], seasons: [1, 2], hours: [6, 20], difficulty: 15, behavior: 'calm',
    look: { body: C.sky, belly: C.amber, fin: C.river, shape: 'round' }, desc: 'Friendly and curious.' },
  { id: 'ice_whitefish', name: 'Ice Whitefish', price: 85, where: ['lake'], seasons: [3], hours: [6, 26], difficulty: 40, behavior: 'sink',
    look: { body: C.frost, belly: C.cream, fin: C.aqua, shape: 'slim' }, desc: 'Pale as snow. Best caught through a hole in the ice.' },
  // ---- ocean ----
  { id: 'sardine', name: 'Sardine', price: 30, where: ['ocean'], seasons: [...ALL], hours: [6, 19], difficulty: 14, behavior: 'dart',
    look: { body: C.sky, belly: C.frost, fin: C.river, shape: 'slim' }, desc: 'Schools of them sparkle off the pier.' },
  { id: 'saltjack', name: 'Saltjack', price: 95, where: ['ocean'], seasons: [1], hours: [6, 20], difficulty: 50, behavior: 'dart',
    look: { body: C.river, belly: C.pebble, fin: C.amber, shape: 'slim' }, desc: 'A muscular summer runner.' },
  { id: 'flounder', name: 'Harbor Flounder', price: 100, where: ['ocean'], seasons: [0, 1], hours: [6, 20], difficulty: 45, behavior: 'sink',
    look: { body: C.tan, belly: C.cream, fin: C.walnut, shape: 'flat' }, desc: 'Both eyes on one side. It looks unimpressed.' },
  { id: 'tidal_eel', name: 'Tidal Eel', price: 160, where: ['ocean'], seasons: [2, 3], hours: [16, 26], weather: 'rain', difficulty: 65, behavior: 'erratic',
    look: { body: C.slate, belly: C.stone, fin: C.violet, shape: 'eel' }, desc: 'Slippery and long. Comes ashore on stormy evenings.' },
  { id: 'driftbass', name: 'Driftbass', price: 75, where: ['ocean'], seasons: [0, 2], hours: [6, 26], difficulty: 35, behavior: 'calm',
    look: { body: C.stone, belly: C.pebble, fin: C.slate, shape: 'round' }, desc: 'Follows the currents and the driftwood.' },
  { id: 'coral_snapper', name: 'Coral Snapper', price: 120, where: ['ocean'], seasons: [1], hours: [9, 17], weather: 'sun', difficulty: 55, behavior: 'float',
    look: { body: C.terracotta, belly: C.apricot, fin: C.rose, shape: 'round' }, desc: 'Bright as a sunset. Only bites in sunshine.' },
  { id: 'moon_squid', name: 'Moon Squid', price: 150, where: ['ocean'], seasons: [3], hours: [18, 26], difficulty: 60, behavior: 'float',
    look: { body: C.lavender, belly: C.frost, fin: C.violet, shape: 'long' }, desc: 'Rises to the surface on long winter nights.' },
  { id: 'puffer', name: 'Bloatfish', price: 200, where: ['ocean'], seasons: [1], hours: [12, 16], weather: 'sun', difficulty: 75, behavior: 'erratic',
    look: { body: C.butter, belly: C.cream, fin: C.amber, shape: 'spiny' }, desc: 'Puffs into a prickly ball when startled.' },
  // ---- forest pond ----
  { id: 'pond_goby', name: 'Pond Goby', price: 25, where: ['pond'], seasons: [...ALL], hours: [6, 26], difficulty: 10, behavior: 'calm',
    look: { body: C.grass, belly: C.lime, fin: C.moss, shape: 'slim' }, desc: 'A round-eyed little pond dweller.' },
  { id: 'woodland_koi', name: 'Woodland Koi', price: 130, where: ['pond'], seasons: [0, 1], hours: [6, 18], difficulty: 50, behavior: 'float',
    look: { body: C.cream, belly: C.cream, fin: C.terracotta, shape: 'round' }, desc: 'Patterned like a painted bowl. Very old, very calm.' },
  // ---- mine ----
  { id: 'blindfish', name: 'Cave Blindfish', price: 110, where: ['mine'], seasons: [...ALL], hours: [6, 26], difficulty: 40, behavior: 'sink',
    look: { body: C.pebble, belly: C.cream, fin: C.blush, shape: 'slim' }, desc: 'Never saw daylight. Never needed to.' },
  { id: 'glimmer_guppy', name: 'Glimmer Guppy', price: 160, where: ['mine'], seasons: [...ALL], hours: [6, 26], difficulty: 55, behavior: 'dart',
    look: { body: C.aqua, belly: C.lavender, fin: C.violet, shape: 'slim' }, desc: 'Absorbs light from crystals and glows.' },
  { id: 'magma_minnow', name: 'Magma Minnow', price: 260, where: ['mine'], seasons: [...ALL], hours: [6, 26], difficulty: 80, behavior: 'erratic',
    look: { body: C.terracotta, belly: C.amber, fin: C.brick, shape: 'spiny' }, desc: 'Warm to the touch. Lives in the deepest pools.' },
  // ---- legendary ----
  { id: 'thistlefin', name: 'Golden Thistlefin', price: 1500, where: ['river'], seasons: [0], hours: [6, 12], difficulty: 92, behavior: 'erratic', legendary: true,
    look: { body: C.brass, belly: C.butter, fin: C.amber, shape: 'spiny' }, desc: 'The fish on the town crest. Said to be a single, ageless fish.' },
  { id: 'clockjaw', name: 'Old Clockjaw', price: 1800, where: ['lake'], seasons: [2], hours: [20, 26], difficulty: 95, behavior: 'sink', legendary: true,
    look: { body: C.slate, belly: C.brass, fin: C.copper, shape: 'long' }, desc: 'Its jaw ticks. Nobody knows why.' },
  { id: 'tidemother', name: 'Tidemother', price: 2000, where: ['ocean'], seasons: [1], hours: [18, 24], weather: 'rain', difficulty: 97, behavior: 'float', legendary: true,
    look: { body: C.deepsea, belly: C.aqua, fin: C.sky, shape: 'round' }, desc: 'The fishers whisper that she brings the summer storms.' },
  // ---- trap catches ----
  { id: 'crayfish', name: 'Crayfish', price: 60, where: ['river', 'lake'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.brick, belly: C.terracotta, fin: C.wine, shape: 'spiny' }, desc: 'A tiny freshwater lobster.' },
  { id: 'periwinkle', name: 'Periwinkle', price: 20, where: ['river', 'lake', 'pond'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.slate, belly: C.lavender, fin: C.stone, shape: 'round' }, desc: 'A spiral snail shell, still occupied.' },
  { id: 'mussel', name: 'Mussel', price: 35, where: ['ocean'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.deepsea, belly: C.slate, fin: C.violet, shape: 'flat' }, desc: 'Dark shells that cling to the pier posts.' },
  { id: 'shrimp', name: 'Shrimp', price: 55, where: ['ocean'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.blush, belly: C.apricot, fin: C.rose, shape: 'eel' }, desc: 'Curled and pink.' },
  { id: 'lobster', name: 'Lobster', price: 140, where: ['ocean'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.rose, belly: C.terracotta, fin: C.wine, shape: 'spiny' }, desc: 'A prize from the deep rocks.' },
  { id: 'shore_crab', name: 'Shore Crab', price: 90, where: ['ocean'], seasons: [...ALL], hours: [6, 26], difficulty: 0, behavior: 'calm', trap: true,
    look: { body: C.terracotta, belly: C.amber, fin: C.brick, shape: 'flat' }, desc: 'Scuttles sideways, pinches forwards.' },
];

export const FISH_BY_ID = new Map(FISH.map((f) => [f.id, f]));
