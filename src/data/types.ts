// Shared typed shapes for all data-driven content.

export type Season = 0 | 1 | 2 | 3;
export const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weather = 'sun' | 'rain' | 'storm' | 'snow' | 'wind';

export type ItemCategory =
  | 'tool' | 'weapon' | 'seed' | 'crop' | 'fruit' | 'flower' | 'forage' | 'animal' | 'artisan'
  | 'fish' | 'mineral' | 'ore' | 'bar' | 'gem' | 'resource' | 'component' | 'food'
  | 'placeable' | 'research' | 'misc' | 'monster' | 'fertilizer' | 'bait' | 'trash' | 'furniture';

export type ToolKind = 'hoe' | 'can' | 'axe' | 'pick' | 'scythe' | 'rod' | 'sword';

/** Icon = template name + palette color slots (a=main, b=shade, c=highlight, d=accent). */
export interface IconSpec {
  t: string;
  c?: number[];
  /** sprite name for icons drawn from a furniture sprite */
  s?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  cat: ItemCategory;
  /** base sell price in coins (0 = cannot sell) */
  price: number;
  /** max stack (default 999; tools 1) */
  stack?: number;
  icon: IconSpec;
  edible?: { energy: number; health?: number; buff?: FoodBuff };
  /** structure placed by this item */
  places?: string;
  /** farmhouse furniture placed by this item */
  furniture?: string;
  tool?: { kind: ToolKind; tier: number };
  weapon?: { dmg: number; speed: number; knock: number };
  /** item supports quality tiers (silver/gold/star) */
  quality?: boolean;
  tags?: string[];
  /** fuel value in seconds of burn time */
  fuel?: number;
  plant?: { crop?: string; tree?: string };
  fertilizer?: { quality?: number; speed?: number; retain?: number };
}

export interface Stack {
  item: string;
  n: number;
  /** output only: probability (0..1) this output is produced */
  chance?: number;
}

export type CropStyle = 'leafy' | 'root' | 'stalk' | 'bush' | 'vine' | 'flower' | 'grain' | 'gourd' | 'cane' | 'tuber' | 'pod';

export interface CropDef {
  id: string;
  name: string;
  /** produce item id (generated from crop if missing) */
  produce: string;
  seed: string;
  seedName?: string;
  seasons: Season[];
  /** days spent in each growth stage (4-5 stages) */
  stages: number[];
  /** days to regrow after harvest (multi-harvest) */
  regrow?: number;
  yield?: [number, number];
  giant?: boolean;
  trellis?: boolean;
  /** harvested by scythe, like grains */
  scythe?: boolean;
  look: { style: CropStyle; leaf: number; fruit: number; fruit2?: number };
  /** produce sell price */
  price: number;
  seedPrice: number;
  /** produce icon template */
  icon: string;
  cat?: 'crop' | 'fruit' | 'flower';
  edible?: number;
  desc: string;
  tags?: string[];
}

export interface TreeDef {
  id: string;
  name: string;
  sapling: string;
  /** fruit item id; empty for wild trees */
  fruit: string;
  season: Season | -1;
  /** days from sapling to maturity */
  grow: number;
  wild?: boolean;
  /** wood dropped when chopped */
  wood: number;
  /** product when tapped */
  tap?: string;
  look: { leaf: number; leaf2: number; trunk: number; fruit?: number; shape: 'round' | 'pine' | 'tall' | 'palm' | 'willow' };
  saplingPrice: number;
}

export interface RecipeDef {
  id: string;
  /** 'hand' for the crafting menu, otherwise a machine station id */
  station: string;
  in: Stack[];
  out: Stack[];
  /** processing seconds at speed 1 (hand recipes are instant) */
  time: number;
  /** research node id that unlocks this recipe; omit = available from start; 'quest:x' or 'flag:x' also allowed */
  unlock?: string;
  /** output keeps the best input quality */
  keepQuality?: boolean;
  name?: string;
}

export type StructKind =
  | 'belt' | 'underground' | 'splitter' | 'arm' | 'machine' | 'chest' | 'pole' | 'generator' | 'lab'
  | 'harvester' | 'planter' | 'sprinkler' | 'drill' | 'hive' | 'fence' | 'path' | 'lamp' | 'scarecrow'
  | 'shipbin' | 'fishtrap' | 'building' | 'decor' | 'tapper' | 'beehouse' | 'accumulator' | 'gate' | 'megaproject' | 'depot' | 'pond'
  | 'gleaner' | 'gantry' | 'rail';

export interface StructureDef {
  id: string;
  name: string;
  kind: StructKind;
  size: [number, number];
  /** item that places it (and is refunded on removal) */
  item: string;
  rotatable?: boolean;
  solid?: boolean;
  /** drawn flat on the ground under actors */
  floor?: boolean;
  /** power draw when working (sparks) */
  powerUse?: number;
  /** idle drain (sparks) */
  powerIdle?: number;
  /** power output (sparks) */
  powerGen?: number;
  /** crafting speed / belt tiles per second / arm turns per second */
  speed?: number;
  station?: string;
  /** burns fuel items */
  fuel?: boolean;
  /** arm reach in tiles / pole wire reach / harvester radius / underground max distance */
  reach?: number;
  /** pole supply-area radius (tiles from center) */
  supply?: number;
  filter?: boolean;
  /** items moved per swing */
  hand?: number;
  /** chest slot count */
  slots?: number;
  light?: { r: number; color: number };
  /** belt tier 1..3 */
  tier?: number;
  desc: string;
  /** structure must be placed on/next to something */
  requires?: 'water' | 'ore' | 'tree' | 'river';
  /** animal capacity for coops/barns */
  capacity?: number;
  /** buildings: which animal type they house */
  houses?: 'coop' | 'barn';
}

export type LocationId = string;

export interface DialogueLine {
  text: string;
  season?: Season;
  weather?: Weather;
  minH?: number;
  maxH?: number;
  weekday?: number;
  time?: 'morning' | 'afternoon' | 'evening' | 'night';
  /** spoken only on festival days */
  festival?: boolean;
  /** only after this year */
  year?: number;
}

export interface ScheduleDef {
  when?: { season?: Season; weather?: 'rain' | 'clear'; weekdays?: number[] };
  /** [minutes since 00:00, location id]; NPC walks there starting at that time */
  at: [number, LocationId][];
}

export interface HeartEventLine {
  /** 'npc' = this NPC, 'player', or another npc id, or 'narrator' */
  who: string;
  text: string;
}

export interface HeartEventDef {
  hearts: number;
  title: string;
  /** location to trigger near */
  loc: LocationId;
  /** hour window [from, to) in minutes since midnight */
  window: [number, number];
  weather?: 'rain' | 'clear';
  lines: HeartEventLine[];
  choice?: { prompt: string; options: { text: string; reply: string; friendship: number }[] };
}

export interface NPCLook {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'curly' | 'ponytail' | 'spiky' | 'braids' | 'cap' | 'hat';
  shirt: number;
  pants: number;
  accent?: number;
  beard?: boolean;
  glasses?: boolean;
  height?: 'short' | 'tall' | 'normal';
  apron?: boolean;
}

export interface NPCDef {
  id: string;
  name: string;
  age: 'child' | 'teen' | 'adult' | 'elder';
  pronoun: 'she' | 'he' | 'they';
  job: string;
  personality: string;
  bio: string;
  look: NPCLook;
  birthday: { season: Season; day: number };
  gifts: { love: string[]; like: string[]; dislike: string[]; hate: string[] };
  schedules: ScheduleDef[];
  intro: string;
  dialogue: DialogueLine[];
  giftReplies: { love: string[]; like: string[]; neutral: string[]; dislike: string[]; hate: string[]; birthday: string };
  heartEvents: HeartEventDef[];
  /** optional shop this NPC runs */
  shop?: string;
}

export interface FishDef {
  id: string;
  name: string;
  price: number;
  where: ('river' | 'lake' | 'ocean' | 'pond' | 'mine')[];
  seasons: Season[];
  /** active hours [from, to) in hours (6..26) */
  hours: [number, number];
  weather?: 'rain' | 'sun';
  /** 1..100 */
  difficulty: number;
  behavior: 'calm' | 'dart' | 'sink' | 'float' | 'erratic';
  look: { body: number; belly: number; fin: number; shape: 'slim' | 'round' | 'long' | 'flat' | 'eel' | 'spiny' };
  legendary?: boolean;
  desc: string;
  /** trap-only crustacean */
  trap?: boolean;
}

export interface AnimalDef {
  id: string;
  name: string;
  building: 'coop' | 'barn';
  /** minimum building tier (1 basic, 2 big, 3 deluxe) */
  tier: number;
  price: number;
  product: string;
  /** better product at high happiness */
  deluxe?: string;
  /** days between products */
  every: number;
  look: { body: number; body2: number; accent: number; kind: 'chicken' | 'duck' | 'rabbit' | 'cow' | 'goat' | 'sheep' | 'pig' | 'alpaca' };
  desc: string;
}

/** A Deepworks pest (src/sim/systems/mine.ts). Pests never hurt you: they get in the way. */
export interface MonsterDef {
  id: string;
  name: string;
  /** hits it takes (a pickaxe or a sword: one hit each) */
  hp: number;
  dmg: number;
  speed: number;
  /** the levels it lives on */
  floors: [number, number];
  /** a mite eats ore left on the floor, a crab sits in a gallery until hit, a wisp hides the ladder until hit */
  behavior: 'mite' | 'block' | 'guard';
  drops: { item: string; chance: number; n?: [number, number] }[];
  look: { body: number; body2: number; eye: number; kind: 'blob' | 'moth' | 'crab' | 'wisp' | 'mole' | 'golem' | 'mite' };
  xp: number;
}

export interface FestivalDef {
  id: string;
  name: string;
  season: Season;
  day: number;
  /** minutes */
  start: number;
  end: number;
  host: string;
  activity: 'kite' | 'firefly' | 'pumpkin' | 'skate';
  desc: string;
  intro: string;
  prizes: { score: number; items: Stack[]; money: number }[];
}

/** every objective may name itself for the Now strip and say why it matters (ROADMAP.md 6.2) */
export interface ObjectiveBase {
  /** the Now strip's wording ("Pick the keeper's cogbeans"); the progress count is added */
  label?: string;
  /** overrides the quest's why line while this objective is the current one */
  why?: string;
  /** where to go for it while it's the current step: a villager's id or a map location */
  goto?: string;
}

export type ObjectiveDef = ObjectiveBase & (
  | { t: 'have'; item: string; n: number }
  | { t: 'deliver'; item: string; n: number; to: string }
  | { t: 'ship'; item: string; n: number }
  /** met: having already met them counts */
  | { t: 'talk'; npc: string; met?: boolean }
  | { t: 'build'; struct: string; n: number }
  /** fresh: only items crafted after the quest started count (not ones you already own) */
  | { t: 'craft'; item: string; n: number; fresh?: boolean }
  /** load a machine of this kind by hand (F / right-click) */
  | { t: 'load'; struct: string; n: number }
  | { t: 'research'; id: string }
  | { t: 'floor'; n: number }
  | { t: 'catch'; n: number; fish?: string }
  | { t: 'till'; n: number }
  /** seeds planted; `crop`: only that crop */
  | { t: 'plant'; n: number; crop?: string }
  /** plants of a crop standing in reach of your own gleaners (not the keeper's), right now */
  | { t: 'gleaned'; crop: string; n: number }
  | { t: 'water'; n: number }
  | { t: 'harvest'; n: number; item?: string }
  | { t: 'money'; n: number }
  | { t: 'sleep' }
  | { t: 'visit'; loc: LocationId }
  | { t: 'friend'; npc: string; hearts: number }
  | { t: 'produce'; item: string; perMin: number }
  /** goods put into the shipping crate (deposit time, not the post's); `auto`: only by arm or belt,
   *  and a hand load of a machine starts the count again (the line must run by itself) */
  | { t: 'crate'; item: string; n: number; auto?: boolean }
  /** a rusted structure brought back: the one at a tile, every rusted one of a kind, or all in a rect (x, y, w, h) */
  | { t: 'restore'; struct?: string; at?: [number, number]; rect?: [number, number, number, number] }
  /** a flag the sim or the UI sets when something happens (read the diagnosis, a bean rode a belt) */
  | { t: 'flag'; flag: string }
  /** batches finished by machines of a kind; `other`: not the keeper's own (st.keeper); `full`: at full power */
  | { t: 'made'; struct: string; n: number; other?: boolean; full?: boolean }
  /** a machine of a kind with an arm or belt aimed at it; `other`: not the keeper's own */
  | { t: 'feeds'; struct: string; other?: boolean }
  /** items an arm has put into a machine of a kind (B3: the arm, not the hands, fed the jar) */
  | { t: 'armload'; struct: string; n: number }
  /** a standing order filled (src/sim/systems/orders.ts), by hand or by the post */
  | { t: 'order'; id: string }
  /** a machine of this kind (switched on) whose grid can power everything on it at once: no brownout */
  | { t: 'grid'; struct: string }
  /** a game counter reached (g.counters: 'made:<structure>', 'crafted:<item>', ...) */
  | { t: 'count'; key: string; n: number });

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  desc: string;
  objectives: ObjectiveDef[];
  reward: { money?: number; items?: Stack[]; friendship?: [string, number]; flag?: string };
  /** quest ids that must be complete first */
  after?: string[];
  /** auto-start on this day index (0-based absolute day) */
  startDay?: number;
  /** only offered when this flag is set (e.g. the clockwork opening) */
  needFlag?: string;
  /** on the very first day, don't start before this hour (it still starts by bedtime) */
  firstDayFrom?: number;
  tutorial?: boolean;
  hint?: string;
  /** the one line under the title in the Now strip and the Notebook: what this step is for */
  why?: string;
  /** on the main path (the Keeper's Line and the keystones): the Now strip shows it first */
  main?: boolean;
}

export interface ProjectDef {
  id: string;
  name: string;
  area: string;
  desc: string;
  items: Stack[];
  money?: number;
  reward: { items?: Stack[]; flag?: string; text: string };
}

export interface MegaprojectDef {
  id: string;
  name: string;
  desc: string;
  stages: { name: string; items: Stack[] }[];
  reward: string;
  unlock?: string;
}

export interface ResearchEffect {
  t: 'armHand' | 'machineSpeed' | 'beltSpeed' | 'labSpeed' | 'energy' | 'droneSpeed' | 'droneCount' | 'reach' | 'marketBonus';
  v: number;
}

export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  /** item id for the node icon */
  icon: string;
  /** total bundles consumed */
  cost: Stack[];
  /** seconds of lab work per research unit (one of each bundle in cost) */
  unitTime: number;
  prereq: string[];
  effects?: ResearchEffect[];
  /** structure/recipe unlocks are derived from RecipeDef.unlock; extra text */
  note?: string;
  /** the era it belongs to (1 Spring .. 5 Starlight): its band in the research window */
  era: number;
  /** its row in the era band (the column is its prerequisite depth inside the era) */
  row: number;
  /** a keystone: stages before the bundles (ROADMAP.md 7.3) */
  keystone?: KeystoneDef;
  /** also needs this flag (a town keystone, e.g. the Waterworks for mist towers) */
  needFlag?: string;
}

/**
 * A keystone's stages, shown as four pips with the bundles (Apply): look at something, try it, keep
 * it running. A desk on a keystone takes no bundles until the first three are done.
 */
export interface KeystoneDef {
  observe?: { flag: string; label: string };
  experiment?: ObjectiveDef[];
  /** an item (or #tag) made at perMin or more, held for `minutes` sim minutes */
  validate?: { item: string; perMin: number; minutes: number; label: string };
}

export interface ShopEntry {
  item: string;
  /** buy price override; default = item.price * 2 (seeds: seedPrice) */
  price?: number;
  seasons?: Season[];
  unlock?: string;
  /** limited per day */
  daily?: number;
}

export interface ShopDef {
  id: string;
  name: string;
  owner: string;
  /** location of counter */
  loc: LocationId;
  open: number;
  close: number;
  closedDays?: number[];
  stock: ShopEntry[];
  /** this shop buys items of these categories */
  buys?: ItemCategory[];
  greeting: string;
}

export type BuffKind = 'speed' | 'stamina' | 'fishing' | 'mining' | 'luck' | 'defense' | 'farming';
export interface FoodBuff { kind: BuffKind; lvl: number; min: number }
