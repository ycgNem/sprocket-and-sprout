// Game modes (rule sets) and farm maps (layouts of the farm area), chosen on the new-game screen.

export type GameMode = 'story' | 'cozy' | 'rush' | 'sandbox';
export type FarmKind = 'classic' | 'riverside' | 'ruins' | 'highlands' | 'wildwood';

export interface ModeDef {
  id: GameMode;
  name: string;
  tag: string;
  lines: string[];
}

export const MODES: ModeDef[] = [
  {
    id: 'story', name: 'Story', tag: 'The full Thistlewick tale',
    lines: ['Revive the old keeper\'s clockwork farm', 'Quests, villagers, festivals, the Deepworks', 'Days end at 2am'],
  },
  {
    id: 'cozy', name: 'Cozy', tag: 'No rush, no penalties',
    lines: ['The clock runs at half speed', 'Passing out costs nothing', 'Crops never wilt at season\'s end'],
  },
  {
    id: 'rush', name: 'Clockwork Rush', tag: 'One season. Highest score wins.',
    lines: ['28 days to earn as much as you can', 'Starter factory kit, half-price research, Guild contracts every 3 days', 'Bronze 30k, Silver 55k, Gold 80k'],
  },
  {
    id: 'sandbox', name: 'Sandbox', tag: 'Build freely',
    lines: ['Every research done, 1,000,000 coins', 'Press G for the free build palette', 'No energy, no quests; the clock waits'],
  },
];
export const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));

export interface FarmDef {
  id: FarmKind;
  name: string;
  short: string;
  lines: string[];
}

export const FARMS: FarmDef[] = [
  { id: 'classic', name: 'Overgrown Homestead', short: 'Homestead', lines: ['Wide open fields and a farm pond', 'The balanced choice'] },
  { id: 'riverside', name: 'Riverside Mill', short: 'Riverside', lines: ['A stream runs through the farm', 'Water wheels and river fish at home; less soil', 'Starts with a fishing rod'] },
  { id: 'ruins', name: 'Tinker\'s Yard', short: 'Tinker\'s Yard', lines: ['A ruined workshop full of old cogs', 'A copper seam for ore drills', 'Starts with salvaged belts and arms'] },
  { id: 'highlands', name: 'Terraced Highlands', short: 'Highlands', lines: ['Plateaus split by cliffs and ramps', 'Windmills make 30% more power', 'Rocky; starts with a copper pickaxe'] },
  { id: 'wildwood', name: 'Wildwood', short: 'Wildwood', lines: ['A farm swallowed by the forest', 'Endless wood and mushrooms', 'Starts with a copper axe'] },
];
export const FARM_BY_ID = new Map(FARMS.map((f) => [f.id, f]));

/** Clockwork Rush medal thresholds (coins earned during the season) */
// bronze / silver / gold: about 0.6x / 1.1x / 1.6x the pace bot's 28-day Rush average (49.6k on 8
// seeds, 2026-11-26, after 2.2's crop and preserve prices; it was 66k and 40/75/110k): it plays the
// Keeper's Line and reaches the Town Mill, and silver asks for more than a script whose works stop
// growing after day 5 (DECISIONS #90, #97, #177). The mode card's line says the same numbers.
export const RUSH_MEDALS = [30000, 55000, 80000];
export const RUSH_DAYS = 28;
