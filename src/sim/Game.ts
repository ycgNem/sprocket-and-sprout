// GameState + ordered systems. Pure simulation: no DOM access in here.
import { Rng } from '../engine/rng';
import type { GameMode, FarmKind } from '../data/modes';
import type { Season, Weather, BuffKind } from '../data/types';
import { TileMap } from './world/tilemap';
import { generateWorld, PLAYER_START, WORLD_W, WORLD_H, SHIPBIN_POS } from './world/worldgen';
import { Ents } from './ents';
import { Inventory, key } from './inventory';
import { updateBelts } from './systems/belts';
import { updateArms } from './systems/arms';
import { updateMachines } from './systems/machines';
import { updatePower } from './systems/power';
import { Stats } from './systems/stats';

export const SEC_PER_MIN = 0.7;
export const DAY_START = 360; // 6:00
export const DAY_END = 1560; // 2:00 next day
export const DAYS_PER_SEASON = 28;
export const DT = 1 / 60;

export interface TimeState {
  min: number;
  day: number; // 1..28
  season: Season;
  year: number;
}

export interface CropState {
  id: string;
  days: number;
  stage: number;
  ready: boolean;
  harvests: number;
  dead: boolean;
  /** tile index of the giant crop's top-left, if part of one */
  giant: number;
  /** growth fraction carried for speed fertilizer */
  frac: number;
}

export interface Soil {
  water: boolean;
  fert: string | null;
  crop: CropState | null;
  /** days left untended before soil reverts */
  idle: number;
}

export interface Player {
  name: string;
  farmName: string;
  favorite: string;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3;
  moving: boolean;
  walkT: number;
  energy: number;
  maxEnergy: number;
  hp: number;
  maxHp: number;
  money: number;
  inv: Inventory;
  sel: number;
  /** busy with tool animation (seconds) */
  busy: number;
  anim: { kind: string; t: number; dur: number; tx: number; ty: number } | null;
  water: number;
  invuln: number;
  where: 'world' | 'mine' | 'house';
  exhausted: boolean;
  skills: Record<string, number>;
  xp: Record<string, number>;
  /** knockback velocity */
  kx: number;
  ky: number;
  /** tools currently at the blacksmith */
  upgrading: { tool: string; to: string; days: number } | null;
  /** inventory rows unlocked (12 per row) */
  rows: number;
  /** chosen professions */
  perks: string[];
  /** active food buff (game minutes left) */
  buff: { kind: BuffKind; lvl: number; left: number; src: string } | null;
}

export type GameEvent =
  | { t: 'sfx'; id: string; x?: number; y?: number; v?: number }
  | { t: 'toast'; text: string; icon?: string; color?: number }
  | { t: 'fx'; kind: string; x: number; y: number; n?: number; c?: number; c2?: number; s?: string; dir?: number }
  | { t: 'pickup'; k: number; n: number; x: number; y: number }
  | { t: 'shake'; amt: number }
  | { t: 'float'; text: string; x: number; y: number; c?: number }
  | { t: 'dayEnd'; summary: DaySummary }
  | { t: 'levelup'; skill: string; level: number }
  | { t: 'research'; id: string }
  | { t: 'ach'; id: string }
  | { t: 'ui'; open: string; arg?: any }
  /** a crop picked by hand: what it gave and the running harvest streak */
  | { t: 'harvest'; x: number; y: number; k: number; n: number; streak: number; bonus: boolean }
  /** a machine finished a batch (entity id, first output item) */
  | { t: 'made'; ent: number; item: string; x: number; y: number }
  /** a quest was completed (the reward is already given) */
  | { t: 'quest'; title: string; money: number; items: { item: string; n: number }[] }
  /** a crop (tile index) or structure (entity id) gives a little hop */
  | { t: 'hop'; tile?: number; ent?: number }
  /** an arm dropped goods in a shipping crate (the play screen shows what they'll fetch) */
  | { t: 'crated'; k: number; n: number; x: number; y: number; ent?: number }
  /** the post collected the crate at noon or 6pm */
  | { t: 'post'; label: string; total: number };

export interface DaySummary {
  day: number;
  season: Season;
  year: number;
  /** coins: the row's exact total (price is the rounded average per unit) */
  sold: { k: number; n: number; price: number; coins?: number }[];
  total: number;
  passedOut: boolean;
  penalty: number;
  /** the best day's shipping total before this one (for the "best day yet" stamp) */
  best?: number;
  /** titles of the quests completed today */
  quests?: string[];
}

export interface Mods {
  armHand: number;
  machineSpeed: number;
  labSpeed: number;
  energy: number;
  droneSpeed: number;
  droneCount: number;
  reach: number;
  marketBonus: number;
}

export const SKILLS = ['farming', 'foraging', 'mining', 'fishing', 'combat', 'tinkering'] as const;
export const XP_LEVELS = [0, 150, 450, 900, 1600, 2600, 4000, 6000, 8500, 12000, 16000];

export interface GameOptions {
  seed?: number;
  name?: string;
  farmName?: string;
  favorite?: string;
  /** small empty map for tests */
  blank?: { w: number; h: number };
  mode?: GameMode;
  farm?: FarmKind;
  /** constructing a game that a save is about to overwrite: skip new-game setup */
  loading?: boolean;
}

/** Systems added by later modules register here (keeps Game decoupled). */
export type System = {
  name: string;
  tick?: (g: Game, dt: number) => void;
  dayStart?: (g: Game) => void;
  dayEnd?: (g: Game, s: DaySummary) => void;
  /** ticks with real time even while the world is slowed (the player, pickups, minigames, the mine) */
  realtime?: boolean;
  /** one-time setup of a brand-new game (not called when loading) */
  init?: (g: Game) => void;
  save?: (g: Game) => any;
  load?: (g: Game, d: any) => void;
  afterLoad?: (g: Game) => void;
};
export const SYSTEMS: System[] = [];
export function registerSystem(s: System) {
  const i = SYSTEMS.findIndex((x) => x.name === s.name);
  if (i >= 0) SYSTEMS[i] = s;
  else SYSTEMS.push(s);
}

export class Game {
  seed: number;
  rng: Rng;
  map: TileMap;
  ents: Ents;
  time: TimeState = { min: DAY_START, day: 1, season: 0, year: 1 };
  weather: Weather = 'sun';
  tomorrow: Weather = 'sun';
  /** 0..2 wind strength factor */
  wind = 1;
  player: Player;
  soil = new Map<number, Soil>();
  flags = new Set<string>();
  research = { done: new Set<string>(), current: null as string | null, progress: {} as Record<string, number> };
  mods: Mods = { armHand: 0, machineSpeed: 1, labSpeed: 1, energy: 0, droneSpeed: 1, droneCount: 0, reach: 0, marketBonus: 0 };
  stats = new Stats();
  events: GameEvent[] = [];
  tickN = 0;
  /** sim seconds elapsed in total */
  simTime = 0;
  paused = false;
  sleeping = false;
  /** extra state bags for later systems (npcs, animals, market, quests, mine, ...) */
  sys: Record<string, any> = {};
  /** total money ever earned */
  earned = 0;
  shipBinId = 0;
  daysPlayed = 0;
  /** move intent from input, set by presentation layer each frame */
  moveX = 0;
  moveY = 0;
  walkSlow = false;
  /** rule set (story, cozy, rush, sandbox) and farm layout; both fixed for the save's life */
  mode: GameMode = 'story';
  farmKind: FarmKind = 'classic';

  constructor(opts: GameOptions = {}) {
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    this.mode = opts.mode ?? 'story';
    this.farmKind = opts.farm ?? 'classic';
    this.rng = new Rng(this.seed ^ 0x5bd1e995);
    if (opts.blank) {
      this.map = new TileMap(opts.blank.w, opts.blank.h);
      this.map.ground.fill(1);
      this.map.zone.fill(1);
    } else {
      this.map = generateWorld(this.seed, this.farmKind);
    }
    this.ents = new Ents(this.map.w, this.map.h);
    this.player = {
      name: opts.name ?? 'Farmer', farmName: opts.farmName ?? 'Sprout', favorite: opts.favorite ?? 'Tea',
      x: PLAYER_START[0], y: PLAYER_START[1], dir: 2, moving: false, walkT: 0,
      energy: 220, maxEnergy: 220, hp: 100, maxHp: 100, money: 500,
      inv: new Inventory(36), sel: 0, busy: 0, anim: null, water: 40, invuln: 0, where: 'world', exhausted: false,
      skills: Object.fromEntries(SKILLS.map((s) => [s, 0])), xp: Object.fromEntries(SKILLS.map((s) => [s, 0])),
      kx: 0, ky: 0, upgrading: null, rows: 3, buff: null, perks: [],
    };
    if (opts.blank) {
      this.player.x = 1.5;
      this.player.y = 1.5;
    } else {
      // starting kit
      const inv = this.player.inv;
      for (const id of ['hoe_0', 'can_0', 'axe_0', 'pick_0', 'scythe_0', 'sword_0']) inv.add(key(id), 1);
      inv.add(key('radish_seed'), 15);
      // the fixed shipping bin next to the farmhouse
      const bin = this.ents.add('shipping_crate', SHIPBIN_POS[0], SHIPBIN_POS[1], 0);
      bin.st.fixed = true;
      bin.st.mainBin = true;
      this.shipBinId = bin.id;
    }
    void WORLD_W;
    void WORLD_H;
    if (!opts.blank && !opts.loading) for (const s of SYSTEMS) s.init?.(this);
    for (const s of SYSTEMS) s.dayStart?.(this);
  }

  /** lifetime counters (tilled, fish caught, ...) */
  counters: Record<string, number> = {};
  hasPerk(id: string): boolean {
    return this.player.perks.includes(id);
  }

  /** level of the active food buff of this kind (0 = none) */
  buffLvl(kind: BuffKind): number {
    const b = this.player.buff;
    return b && b.kind === kind ? b.lvl : 0;
  }

  count(k: string, n = 1) {
    this.counters[k] = (this.counters[k] ?? 0) + n;
  }

  emit(e: GameEvent) {
    this.events.push(e);
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
  }

  toast(text: string, icon?: string, color?: number) {
    this.emit({ t: 'toast', text, icon, color });
  }

  get dayIndex() {
    return (this.time.year - 1) * 112 + this.time.season * 28 + (this.time.day - 1);
  }
  get weekday() {
    return this.dayIndex % 7;
  }
  get hour() {
    return Math.floor(this.time.min / 60);
  }
  /** 0 = full night, 1 = full day */
  get daylight(): number {
    const h = this.time.min / 60;
    const dusk = this.time.season === 3 ? 17.5 : this.time.season === 1 ? 19.5 : 18.5;
    if (h < 6.5) return 0.55 + (h - 6) * 0.9;
    if (h < dusk) return 1;
    if (h < dusk + 2.5) return 1 - (h - dusk) / 2.5;
    return 0;
  }

  /** Is a recipe/structure unlock satisfied? */
  unlocked(u: string | undefined): boolean {
    if (!u) return true;
    if (u.startsWith('flag:')) return this.flags.has(u.slice(5));
    if (u.startsWith('quest:')) return this.flags.has('quest_done:' + u.slice(6));
    return this.research.done.has(u);
  }

  addXp(skill: string, n: number) {
    const p = this.player;
    p.xp[skill] = (p.xp[skill] ?? 0) + n;
    // a big XP gain can cross several levels at once
    while ((p.skills[skill] ?? 0) < 10 && p.xp[skill] >= XP_LEVELS[(p.skills[skill] ?? 0) + 1]) {
      const lvl = (p.skills[skill] = (p.skills[skill] ?? 0) + 1);
      this.emit({ t: 'levelup', skill, level: lvl });
      this.emit({ t: 'sfx', id: 'levelup' });
    }
  }

  /** Give the player items; overflow drops at their feet. Returns amount added to inventory. */
  give(k: number, n: number, fx = true): number {
    const left = this.player.inv.add(k, n);
    const added = n - left;
    if (added > 0) {
      this.stats.add(k, added);
      if (fx) this.emit({ t: 'pickup', k, n: added, x: this.player.x, y: this.player.y - 1 });
    }
    if (left > 0) {
      this.sys.drops?.spawn?.(this, k, left, this.player.x, this.player.y);
      this.toast('Inventory full!');
    }
    return added;
  }

  spend(energy: number) {
    if (this.mode === 'sandbox') return;
    const p = this.player;
    p.energy = Math.max(-20, p.energy - energy);
    if (p.energy <= 0 && !p.exhausted) {
      p.exhausted = true;
      this.toast("You're exhausted... time for bed.");
    }
  }

  tick() {
    this.tickN++;
    if (this.paused) return;
    // the whole world (clock, machines, crops, villagers) runs at simRate; you always move in real time,
    // so slowing time while building buys thinking time without changing what a game day produces
    const dt = DT;
    const sdt = DT * this.simRate;
    this.simTime += sdt;
    this.advanceClock(dt);
    if (sdt > 0) {
      if (this.ents.powerDirty || this.tickN % 2 === 0) updatePower(this, sdt * (this.ents.powerDirty ? 1 : 2));
      updateBelts(this.ents, sdt);
      updateArms(this, sdt);
      updateMachines(this, sdt);
    }
    for (const s of SYSTEMS) if (s.tick && (s.realtime || sdt > 0)) s.tick(this, s.realtime ? dt : sdt);
    this.stats.tick(this, sdt);
  }

  /** set by the presentation layer while building: the clock slows to a quarter */
  slowClock = false;

  /** speed of the world sim: cozy runs at half speed, building at a quarter */
  get simRate() {
    if (this.sleeping) return 1;
    return (this.mode === 'cozy' ? 0.5 : 1) * (this.slowClock && this.mode !== 'sandbox' ? 0.25 : 1);
  }

  /** speed of the day clock: the sim rate, except sandbox, whose clock only moves while you sleep */
  get clockRate() {
    if (this.mode === 'sandbox') return this.sleeping ? 1 : 0;
    return this.simRate;
  }

  advanceClock(dt: number) {
    const t = this.time;
    t.min += (dt / SEC_PER_MIN) * this.clockRate;
    if (t.min >= DAY_END) {
      t.min = DAY_END;
      this.endDay(!this.sleeping);
    }
  }

  /** Called when sleeping ends the day or the player passes out at 2am. */
  endDay(passedOut: boolean) {
    const summary: DaySummary = { day: this.time.day, season: this.time.season, year: this.time.year, sold: [], total: 0, passedOut, penalty: 0 };
    for (const s of SYSTEMS) s.dayEnd?.(this, summary);
    const p = this.player;
    // passing out costs your morning, not your coins (cozy mode forgives it entirely)
    const sleptIn = passedOut && this.mode !== 'cozy' && this.mode !== 'sandbox';
    if (passedOut) this.count('passed_out');
    // advance date
    const t = this.time;
    const lateness = this.sleepMin ?? DAY_END;
    t.min = sleptIn ? 600 : DAY_START;
    t.day++;
    if (t.day > DAYS_PER_SEASON) {
      t.day = 1;
      t.season = ((t.season + 1) % 4) as Season;
      if (t.season === 0) t.year++;
    }
    this.daysPlayed++;
    // energy recovery
    const maxE = p.maxEnergy + this.mods.energy;
    if (sleptIn) p.energy = Math.round(maxE * 0.6);
    else if (lateness > 1440) p.energy = Math.round(maxE * (1 - ((lateness - 1440) / 120) * (this.flags.has('home_featherbed') ? 0.25 : 0.5)));
    else p.energy = maxE;
    p.exhausted = false;
    p.buff = null;
    p.hp = p.maxHp;
    if (this.map.w > 100) {
      // wake up at home
      p.where = 'world';
      p.x = PLAYER_START[0];
      p.y = PLAYER_START[1];
      p.dir = 2;
      p.kx = p.ky = 0;
    }
    this.sleeping = false;
    this.sleepMin = undefined;
    // weather
    this.weather = this.tomorrow;
    this.tomorrow = this.rollWeather();
    this.wind = this.weather === 'storm' ? 1.8 : this.weather === 'wind' ? 1.5 : this.weather === 'rain' ? 1.1 : this.weather === 'snow' ? 0.9 : 0.6 + this.rng.next() * 0.4;
    for (const s of SYSTEMS) s.dayStart?.(this);
    this.emit({ t: 'dayEnd', summary });
  }

  sleepMin?: number;

  /** Begin sleeping: the sim fast-forwards until the day ends. */
  goToBed() {
    if (this.sleeping) return;
    this.sleeping = true;
    this.sleepMin = this.time.min;
    // before 5pm (the tutorial sends everyone to bed at 6pm on day one, which shouldn't count)
    if (this.time.min < 17 * 60) this.sys.achUnlock?.(this, 'sleepyhead');
  }

  rollWeather(): Weather {
    const t = this.time;
    // tomorrow's date
    let day = t.day + 1, season = t.season;
    if (day > 28) { day = 1; season = ((season + 1) % 4) as Season; }
    if (day === 1) return 'sun';
    if (this.sys.festivals?.isFestival?.(season, day)) return 'sun';
    const r = this.rng.next();
    switch (season) {
      case 0: return r < 0.22 ? 'rain' : r < 0.28 ? 'storm' : r < 0.36 ? 'wind' : 'sun';
      case 1: return r < 0.13 ? 'rain' : r < 0.22 ? 'storm' : r < 0.26 ? 'wind' : 'sun';
      case 2: return r < 0.2 ? 'rain' : r < 0.24 ? 'storm' : r < 0.4 ? 'wind' : 'sun';
      default: return r < 0.4 ? 'snow' : r < 0.5 ? 'wind' : 'sun';
    }
  }

  isRaining() {
    return this.weather === 'rain' || this.weather === 'storm';
  }
}
