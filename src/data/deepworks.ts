// The Deepworks (ROADMAP.md 7.2, Phase 4): six strata of five levels, each with its own rock,
// ores, a hazard and a pest, and a works chamber on its fifth level. Pure data; the generator,
// hazards, pests and chambers live in src/sim/systems/mine.ts.
import { C } from './palette';

export type StratumId = 'earth' | 'clayworks' | 'frost' | 'ember' | 'crystal' | 'starfall';

export interface StratumDef {
  id: StratumId;
  name: string;
  /** first and last level */
  levels: [number, number];
  /** ore rocks: [ORE_TYPES index (src/sim/world/tilemap.ts), weight]; none = no ore rocks */
  ores: [number, number][];
  /** share of floor tiles holding a plain rock, an ore rock and a gem rock */
  rock: number;
  ore: number;
  gem: number;
  /** share of plain rocks that are ice (frost shards) */
  ice: number;
  /** what a plain rock gives besides stone: [item, chance] */
  extra: [string, number][];
  /** standing decoration (solid, never mined) and its share of floor tiles; crystals glow */
  decor: 'stalagmite' | 'crystal' | 'mixed';
  decorP: number;
  /** the ladder: chance per rock broken, plus this much more for every rock broken on the level */
  ladder: [number, number];
  /** terrain art class index: minefloor<art> / minewall<art> (the imported sheet's 0-2 are Earth, Frost and Ember) */
  art: number;
  /** how dark it is (0..1), the lantern's reach in tiles, the colour of the dark (palette index) */
  dark: number;
  lantern: number;
  tint: number;
  /** said once, the first time you reach the stratum */
  intro: string;
}

export const STRATA: StratumDef[] = [
  {
    id: 'earth', name: 'Earth', levels: [1, 5], ores: [[0, 6], [7, 3], [4, 3]], rock: 0.2, ore: 0.055, gem: 0.004, ice: 0,
    extra: [['coal', 0.08], ['clay', 0.05]], decor: 'stalagmite', decorP: 0.018, ladder: [0.06, 0.02], art: 0,
    dark: 0.6, lantern: 6, tint: C.ink,
    intro: 'The Deepworks: Earth (levels 1-5). Copper, clay and coal. Cracked ceilings come down if you linger under them.',
  },
  {
    id: 'clayworks', name: 'Clayworks', levels: [6, 10], ores: [[1, 6], [7, 4]], rock: 0.2, ore: 0.055, gem: 0.005, ice: 0,
    extra: [['clay', 0.12], ['coal', 0.04]], decor: 'stalagmite', decorP: 0.012, ladder: [0.05, 0.015], art: 3,
    dark: 0.56, lantern: 6, tint: C.ink,
    intro: 'The Clayworks (levels 6-10): the old works\' brick galleries. Tin and clay.',
  },
  {
    id: 'frost', name: 'Frost', levels: [11, 15], ores: [[2, 6]], rock: 0.2, ore: 0.05, gem: 0.006, ice: 0.45,
    extra: [['coal', 0.05]], decor: 'stalagmite', decorP: 0.016, ladder: [0.04, 0.012], art: 1,
    dark: 0.54, lantern: 6, tint: C.deepsea,
    intro: 'The Frost (levels 11-15): iron, and ice rocks full of frost shards. The old flood still stands in pools.',
  },
  {
    id: 'ember', name: 'Ember', levels: [16, 20], ores: [[3, 5], [4, 4]], rock: 0.19, ore: 0.06, gem: 0.008, ice: 0,
    extra: [['coal', 0.1]], decor: 'stalagmite', decorP: 0.01, ladder: [0.04, 0.012], art: 2,
    dark: 0.6, lantern: 6, tint: C.wine,
    intro: 'The Ember (levels 16-20): gold and coal. Firedamp hangs in pockets: a spark-coil lantern burns it off.',
  },
  {
    id: 'crystal', name: 'Crystal', levels: [21, 25], ores: [], rock: 0.2, ore: 0, gem: 0.05, ice: 0,
    extra: [['quartz', 0.25]], decor: 'crystal', decorP: 0.03, ladder: [0.04, 0.012], art: 4,
    dark: 0.84, lantern: 3.2, tint: C.deepsea,
    intro: 'The Crystal (levels 21-25): gems and quartz in dark galleries, lit only by the crystals. Wisps hide the ladders.',
  },
  {
    id: 'starfall', name: 'Starfall', levels: [26, 30], ores: [[5, 5]], rock: 0.19, ore: 0.05, gem: 0.02, ice: 0,
    extra: [['quartz', 0.1]], decor: 'mixed', decorP: 0.016, ladder: [0.04, 0.012], art: 5,
    dark: 0.72, lantern: 4.5, tint: C.bark,
    intro: 'Starfall (levels 26-30): starmetal. Shards of the fallen star still drop from the roof: keep off the glowing marks.',
  },
];

export type ChamberKind = 'lift' | 'boiler' | 'pump' | 'lampworks' | 'lockers' | 'cart' | 'star';

export interface ChamberDef {
  kind: ChamberKind;
  /** the works chamber level it stands on */
  level: number;
  name: string;
  /** footprint in tiles (the art stands taller) */
  w: number;
  /** what looking at it teaches (a toast); the flag is `observed:<kind>` */
  learned: string;
  /** restored in place with parts from the bag (F) */
  restore?: { parts: [string, number][]; flag: string; done: string; running: string };
}

export const CHAMBERS: ChamberDef[] = [
  {
    kind: 'lift', level: 5, name: 'the old lift', w: 2,
    learned: 'The old lift: a cage on a counterweight, wound by a hand winch. Restored, it would ride to every works chamber you reach.',
    restore: {
      parts: [['plank', 4], ['copper_gear', 2], ['rope', 1]], flag: 'chamber:lift',
      done: 'The old lift runs again! Ride it from the Deepworks entrance to any works chamber you have reached.',
      running: '',
    },
  },
  {
    kind: 'boiler', level: 10, name: 'the seized boiler', w: 3,
    learned: 'The seized boiler: coal heats water, steam pushes a piston, the piston turns a wheel. That is Steam Power.',
  },
  {
    kind: 'pump', level: 15, name: 'the old pump', w: 2,
    learned: 'The old pump: a beam engine that lifted the galleries\' water to the surface. Two iron plates and a mainspring would set it going.',
    restore: {
      parts: [['iron_plate', 2], ['spring', 1]], flag: 'chamber:pump',
      done: 'The old pump thumps away! The pools below level 10 drain, and the Frost and Ember ore rocks give one more ore each.',
      running: 'The old pump thumps away: the pools below level 10 are dry, the Frost and Ember ores come out cleaner.',
    },
  },
  {
    kind: 'lampworks', level: 20, name: 'the lamp works', w: 3,
    learned: 'The lamp works: sparks sealed in glass coils, wired to a little dynamo. A light that never needs oil: Spark Coils.',
  },
  {
    kind: 'lockers', level: 25, name: 'the old works\' lockers', w: 3,
    learned: 'The old works\' lockers: the engineers\' blueprints, still legible. Cores, escapements, gear trains: Clockwork Assembly.',
  },
  {
    kind: 'cart', level: 25, name: 'the rail cart', w: 2,
    learned: 'The old rail cart: it once ran ore from the Deepworks up to town. Its axles have seized and its planking is rotten.',
    restore: {
      parts: [['plank', 20], ['iron_bar', 10], ['brass_gear', 4]], flag: 'chamber:cart',
      done: 'The rail cart rolls again! With track to town it could carry ore every morning: the Tram.',
      running: 'The rail cart is sound again. It needs track to town: the Tram.',
    },
  },
  {
    kind: 'star', level: 30, name: 'the fallen star', w: 2,
    learned: 'The fallen star: a lump of starmetal still warm after centuries, humming with its own light. The Grand Works begin here.',
  },
];

export const CHAMBER_BY_KIND = new Map(CHAMBERS.map((c) => [c.kind, c]));

/** the observation flags the research keystones read, one per stratum's chamber */
export const OBSERVATIONS = ['lift', 'boiler', 'pump', 'lampworks', 'lockers', 'star'].map((k) => 'observed:' + k);
