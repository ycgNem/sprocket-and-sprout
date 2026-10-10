// A scripted "player" that plays through the sim API with realistic time costs.
// Used by the pacing test (Node) and the Playwright bot (browser).
import type { Game } from '../src/sim/Game';
import type { Ent } from '../src/sim/ents';
import { CROPS, CROP_BY_ID } from '../src/data/crops';
import { ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { key, kDef } from '../src/sim/inventory';
import { till, plant, waterTile, harvest, canTill } from '../src/sim/systems/farming';
import { interactStruct, useTool } from '../src/sim/actions';
import { POST_TIMES, buy, shopStock, entryPrice } from '../src/sim/systems/economy';
import { craft, canCraft } from '../src/sim/crafting';
import { canPlace, place } from '../src/sim/build';
import { machInsert, setRecipe } from '../src/sim/systems/machines';
import { npcSys } from '../src/sim/systems/npcs';
import { mine } from '../src/sim/systems/mine';
import { O, T, Z } from '../src/sim/world/tilemap';
import { setResearch, canResearch, stages, researchUnits } from '../src/sim/systems/research';
import { RESEARCH, RESEARCH_BY_ID } from '../src/data/research';
import { boardHandIn, openOrder, worksDone } from '../src/sim/systems/orders';
import { powerState, rebuildPower } from '../src/sim/systems/power';
import { questSys } from '../src/sim/systems/quests';
import { shopOpen } from '../src/sim/systems/town';
import { OPENING } from '../src/sim/systems/modes';
import { RIVER } from '../src/sim/opening';

export interface DayLog {
  day: number;
  money: number;
  earned: number;
  shipped: number;
  soil: number;
  energyLeft: number;
  research: string[];
  quests: number;
  mineDeep: number;
  notes: string[];
}

const SECOND = 60; // ticks
/** the keeper's yard is the Keeper's Line's: the bot's own fields and builds stay out of it */
const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const inYard = (x: number, y: number) => inRect(OPENING.yard, x, y) || inRect(RIVER.rect, x, y);
/** what the bot keeps in its bag for the works (tests/bot.ts works()) */
const WORKS_PARTS = new Set(['jar', 'arm_basic', 'chest_wood', 'gleaner', 'splitter_1', 'belt_1', 'plank', 'rope', 'copper_gear', 'copper_coil', 'bundle_copper', 'waterwheel', 'pole_wood']);

export class Bot {
  g: Game;
  log: DayLog[] = [];
  notes: string[] = [];
  plot: [number, number][] = [];
  constructor(g: Game) {
    this.g = g;
  }

  /** advance game time by real seconds */
  wait(sec: number) {
    const n = Math.round(sec * SECOND);
    for (let i = 0; i < n; i++) {
      this.g.tick();
      if (this.g.sleeping) break;
    }
  }

  walkTo(x: number, y: number) {
    const p = this.g.player;
    if (p.where === 'house') this.g.sys.house.leave(this.g);
    const d = Math.hypot(p.x - x, p.y - y);
    if (this.g.player.where !== 'world') return;
    this.wait(d / 4.8);
    p.x = x + 0.5;
    p.y = y + 0.8;
  }

  energyOk(reserve = 20) {
    return this.g.player.energy > reserve;
  }

  sel(id: string) {
    const inv = this.g.player.inv;
    const i = inv.slots.findIndex((s) => s && kDef(s.k).id === id);
    if (i >= 0) this.g.player.sel = i;
    return i >= 0;
  }

  toolId(kind: string) {
    const s = this.g.player.inv.slots.find((s) => s && kDef(s.k).tool?.kind === kind);
    return s ? kDef(s.k).id : null;
  }

  use(kind: string, x: number, y: number) {
    const id = this.toolId(kind);
    if (!id) return false;
    this.sel(id);
    const t = kDef(key(id)).tool!.tier;
    this.g.player.busy = 0;
    if (this.g.player.where === 'world') {
      this.g.player.x = x + 0.5;
      this.g.player.y = y + 1.6;
    }
    useTool(this.g, kind, t, x, y);
    this.wait(0.45);
    return true;
  }

  findPlot(n: number) {
    // a compact plot south-east of the house
    const g = this.g;
    const out: [number, number][] = [];
    for (let y = 26; y < 60 && out.length < n; y++)
      for (let x = 44; x < 70 && out.length < n; x++) {
        const i = g.map.idx(x, y);
        if (g.map.zone[i] !== Z.FARM || g.map.buildingAt[i] || g.ents.at(x, y) || inYard(x, y)) continue;
        if (g.map.ground[i] === T.PATH || g.map.ground[i] === T.POND) continue;
        if (Math.abs(x - 49) <= 1 && y <= 23) continue;
        out.push([x, y]);
      }
    return out;
  }

  clearAndTill(x: number, y: number): boolean {
    const g = this.g;
    const o = g.map.o(x, y);
    if (o === O.TREE) {
      for (let k = 0; k < 12 && g.map.o(x, y) === O.TREE && this.energyOk(); k++) this.use('axe', x, y);
    }
    if (g.map.o(x, y) === O.STUMP || g.map.o(x, y) === O.LOG || g.map.o(x, y) === O.BOULDER) return false;
    if (g.map.o(x, y) === O.ROCK) for (let k = 0; k < 3 && g.map.o(x, y) === O.ROCK; k++) this.use('pick', x, y);
    if (g.map.o(x, y) === O.WEED || g.map.o(x, y) === O.TWIG) this.use(g.map.o(x, y) === O.TWIG ? 'axe' : 'scythe', x, y);
    if (g.soil.has(g.map.idx(x, y))) return true;
    if (!canTill(g, x, y)) return false;
    return this.use('hoe', x, y) && g.soil.has(g.map.idx(x, y));
  }

  collectDrops() {
    const d = this.g.sys.drops?.list ?? [];
    for (const it of [...d]) {
      if (it.map !== this.g.player.where) continue;
      this.g.player.inv.add(it.k, it.n);
      this.g.stats.add(it.k, it.n);
    }
    if (this.g.sys.drops) this.g.sys.drops.list = this.g.sys.drops.list.filter((x: any) => x.map !== this.g.player.where);
  }

  bestSeed(): string | null {
    const g = this.g;
    const season = g.time.season;
    const daysLeft = 28 - g.time.day;
    const stocked = new Set(shopStock(g, 'general').map((e) => e.item));
    const opts = CROPS.filter((c) => stocked.has(c.seed) && c.seasons.includes(season) && c.stages.reduce((a, b) => a + b, 0) <= daysLeft && !c.trellis)
      .map((c) => ({ c, roi: (c.price * ((c.yield?.[0] ?? 1) + (c.yield?.[1] ?? 1)) / 2 * (c.regrow ? Math.max(1, Math.floor((daysLeft - c.stages.reduce((a, b) => a + b, 0)) / c.regrow) + 1) : 1) - c.seedPrice) }))
      .map((o) => ({ ...o, total: Math.min(this.emptyTiles() + 4, Math.floor(Math.max(0, g.player.money - 100) / o.c.seedPrice)) * o.roi }))
      .sort((a, b) => b.total - a.total);
    return opts[0]?.c.seed ?? null;
  }

  emptyTiles() {
    const g = this.g;
    return this.plot.filter(([x, y]) => g.soil.get(g.map.idx(x, y)) && !g.soil.get(g.map.idx(x, y))!.crop).length;
  }

  /** crocks the bot feeds from its own beds (and the keeper's cellar chest, last) */
  crockFeeds(): { chest: Ent; beansOnly: boolean }[] {
    const g = this.g;
    const out: { chest: Ent; beansOnly: boolean }[] = [];
    const add = (chestId: number | null | undefined, crockXY?: [number, number]) => {
      const c = chestId !== null && chestId !== undefined ? g.ents.get(chestId) : null;
      if (!c?.inv) return;
      const crock = crockXY ? g.ents.at(crockXY[0], crockXY[1]) : null;
      out.push({ chest: c, beansOnly: !!crock?.mach?.locked });
    };
    const j2 = g.ents.at(OPENING.jar2[0], OPENING.jar2[1]);
    if (j2?.def.id === 'jar') add(g.ents.at(OPENING.jar2Chest[0], OPENING.jar2Chest[1])?.id, OPENING.jar2);
    add(this.lineIn);
    if (this.pairOut.length) add(this.pairOut[0]);
    // the keeper's cellar last: its dozen a day keeps that crock busy through day 7
    if (g.flags.has('keepers_line')) add(g.ents.at(OPENING.chest[0], OPENING.chest[1])?.id, OPENING.jar);
    return out;
  }

  /**
   * How many plot tiles grow cogbeans for the works (critic, Phase 2 C1: the line needs a supply
   * after the cellar stops): about a dozen per crock the bot feeds, once the desk is restored.
   */
  beanTarget(): number {
    const g = this.g;
    if (!g.flags.has('keepers_line') || !questSys(g).done.includes('k4_grow')) return 0;
    const crocks = this.crockFeeds().filter((f) => !(f.chest.x === OPENING.chest[0] && f.chest.y === OPENING.chest[1])).length;
    // the gleaner beds grow beans for the crocks too: the plot grows the rest
    const beds = this.beds.reduce((a, b) => a + b.tiles.length, 0);
    return Math.min(Math.floor(this.plot.length * 0.75), Math.max(8, 12 * Math.max(1, crocks) + 4 - beds));
  }

  /** plot tiles that grow barley for the keeper's mill once it turns (B8): it grinds what you sow */
  grainTarget(): number {
    const g = this.g;
    if (!questSys(g).done.includes('k8_river') || ![0, 2].includes(g.time.season)) return 0;
    // the chain heads for the Town Mill (80 sacks of meal, and a batch to keep the mill busy): from the
    // river works on, barley takes much of what the beans leave
    const q = questSys(g);
    const cap = worksDone(g).includes('w_town_mill') ? 16 : q.done.includes('k9_bed') ? 56 : 32;
    return Math.min(cap, Math.max(0, this.plot.length - this.beanTarget() - 4));
  }

  /** k10's validate stage is next: barley waits in the bag for a batch big enough to keep the mill busy */
  holdBarley(): boolean {
    const g = this.g;
    return questSys(g).active.some((a) => a.id === 'k10_mill') && g.research.done.has('r_power') && g.flags.has('observed:town_mill') && !g.flags.has('validated:r_milling');
  }

  /** k10: meal is kept for the Town Mill's order from More Power on, until the order is filled */
  hoardMeal(): boolean {
    const g = this.g;
    return questSys(g).done.includes('k9_power') && !worksDone(g).includes('w_town_mill');
  }

  /** plot tiles growing a crop now */
  private growing(crop: string): number {
    const g = this.g;
    return this.plot.filter(([x, y]) => g.soil.get(g.map.idx(x, y))?.crop?.id === crop).length;
  }

  /**
   * What the plot's empty tiles are for, in order: the works' cogbeans, the mill's barley, then cash
   * crops. By count, not by place: a strawberry patch regrows all season, so the works take
   * whichever tiles come free.
   */
  plan(): { bean: number; grain: number; cash: number } {
    const empty = this.emptyTiles();
    const bean = Math.min(empty, Math.max(0, this.beanTarget() - this.growing('cogbean')));
    const grain = Math.min(empty - bean, Math.max(0, this.grainTarget() - this.growing('barley')));
    return { bean, grain, cash: empty - bean - grain };
  }

  /** buy seeds for empty tiles of a role (cogbeans, barley) at the Mercantile */
  private buyFor(role: 'bean' | 'grain', seed: string) {
    const g = this.g;
    const e = shopStock(g, 'general').find((s) => s.item === seed);
    if (!e) return;
    const bare = ([x, y]: [number, number]) => !!g.soil.get(g.map.idx(x, y)) && !g.soil.get(g.map.idx(x, y))!.crop;
    const empty = this.plan()[role] + (role === 'bean' ? this.beds.flatMap((b) => b.tiles).filter(bare).length : 0);
    const want = Math.max(0, Math.min(empty + 2 - g.player.inv.countId(seed), Math.floor((g.player.money - 150) / entryPrice(g, e))));
    if (want > 0) {
      const got = buy(g, e, want);
      if (got) this.notes.push(`bought ${got} ${ITEM_BY_ID.get(seed)!.name}`);
    }
  }

  shop() {
    const g = this.g;
    if (!shopOpen(g, 'general').open) return;
    // the works' supply first: cogbeans for the crocks, barley for the mill
    if (this.beanTarget()) this.buyFor('bean', 'cogbean_seed');
    if (this.grainTarget()) this.buyFor('grain', 'barley_seed');
    const seed = this.bestSeed();
    if (!seed) { this.notes.push('no seed'); return; }
    const e = shopStock(g, 'general').find((s) => s.item === seed);
    if (!e) { this.notes.push('not stocked ' + seed); return; }
    const empty = this.plan().cash;
    const have = g.player.inv.countId(seed);
    const want = Math.max(0, Math.min(empty + 6 - have, Math.floor((g.player.money - 150) / entryPrice(g, e))));
    if (want > 0) {
      const got = buy(g, e, want);
      if (got) this.notes.push(`bought ${got} ${ITEM_BY_ID.get(seed)!.name}`);
    }
  }

  farmMorning() {
    const g = this.g;
    // harvest + ship (the keeper's bean patch too: it regrows every 3 days)
    const bin = g.ents.get(g.shipBinId)!;
    const B = OPENING.beans;
    const keeperPatch: [number, number][] = [];
    if (g.flags.has('keepers_line')) for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) keeperPatch.push([x, y]);
    for (const [x, y] of [...keeperPatch, ...this.plot]) {
      const i = g.map.idx(x, y);
      const s = g.soil.get(i);
      if (s?.crop?.ready) {
        const cr = CROP_BY_ID.get(s.crop.id)!;
        if (cr.scythe) this.use('scythe', x, y);
        else {
          const out = harvest(g, i);
          for (const st of out ?? []) g.player.inv.add(st.k, st.n);
          this.wait(0.3);
        }
      } else if (s?.crop?.dead) s.crop = null;
    }
    this.collectDrops();
    // barley goes to the keeper's grain bin once the mill turns (it grinds what you sow)
    const grainBin = questSys(g).done.includes('k8_river') ? g.ents.at(RIVER.bin[0], RIVER.bin[1]) : null;
    if (grainBin?.inv && !grainBin.st.rust) {
      // Milling's validate stage wants 3 a minute for 2 minutes: a batch of 30 tipped in at once
      // (the mill grinds 15 a minute), so the bag holds the barley until it has one
      const n = g.player.inv.countId('barley');
      if (n && (!this.holdBarley() || n >= 30)) g.player.inv.removeSpec('barley', n - grainBin.inv.add(key('barley'), n));
      // and the meal chest emptied, so the mill never backs up (the meal is sold, or kept for the Town Mill)
      const meal = g.ents.at(RIVER.meal[0], RIVER.meal[1]);
      if (meal?.inv) {
        for (let i = 0; i < meal.inv.slots.length; i++) {
          const sl = meal.inv.slots[i];
          if (!sl) continue;
          const left = g.player.inv.add(sl.k, sl.n);
          meal.inv.slots[i] = left ? { k: sl.k, n: left } : null;
        }
      }
    }
    // keep a few crops for bundles/quests, ship the rest
    const feeds = this.crockFeeds();
    const stock = (c: Ent) => c.inv!.slots.reduce((a, s) => a + (s && ['crop', 'fruit'].includes(kDef(s.k).cat) ? s.n : 0), 0);
    // share the cellar's beans out: the keeper's crock has the gleaner's belt as well, so a cellar
    // chest that holds more than the other crocks' chests gives the difference to them (a player
    // carries them over, or adds the arm from the cellar chest that B6 suggests)
    const cellar = feeds.find((f) => f.chest.x === OPENING.chest[0] && f.chest.y === OPENING.chest[1])?.chest;
    if (cellar?.inv) {
      for (const f of feeds) {
        if (f.chest === cellar) continue;
        const move = Math.floor((cellar.inv.countId('cogbean') - stock(f.chest)) / 2);
        if (move <= 0) continue;
        cellar.inv.removeSpec('cogbean', move);
        const left = f.chest.inv!.add(key('cogbean'), move);
        if (left) cellar.inv.add(key('cogbean'), left);
      }
    }
    for (const sl of g.player.inv.slots) {
      if (!sl) continue;
      const d = kDef(sl.k);
      if ((d.cat === 'crop' || d.cat === 'fruit' || d.cat === 'flower' || d.cat === 'forage' || d.cat === 'fish' || d.cat === 'artisan') && d.price > 0) {
        if (this.hoardMeal() && d.tags?.includes('flour')) continue;
        if (d.id === 'barley' && this.holdBarley()) continue;
        const researching = g.flags.has('lab') && !!g.research.current;
        const keep = d.cat === 'crop' || d.cat === 'fruit' ? (researching ? 8 : 3) : 0;
        // the works first: every crock's chest takes up to two days' worth of vegetables and fruit (beds ripen
        // together, so a harvest day carries the next),
        // the emptiest first (a crock locked to oil takes cogbeans only: anything else jams its arm)
        if ((d.cat === 'crop' || d.cat === 'fruit') && d.id !== 'barley') {
          while (sl.n > keep) {
            const f = feeds.filter((f) => (!f.beansOnly || d.id === "cogbean") && stock(f.chest) < 34).sort((a, b) => stock(a.chest) - stock(b.chest))[0];
            if (!f || f.chest.inv!.add(sl.k, 1) > 0) break;
            sl.n--;
          }
        }
        const n = Math.max(0, sl.n - keep);
        if (n > 0) {
          bin.inv!.add(sl.k, n);
          sl.n -= n;
          g.sys.quests?.notify?.(g, 'ship', n, d.id);
        }
      }
    }
    g.player.inv.slots = g.player.inv.slots.map((s) => (s && s.n > 0 ? s : null));
    // plant: the works' tiles get their crop (cogbeans, barley), the rest the best seed in the bag
    const grows = (s: { k: number } | null) => !!s && !!kDef(s.k).plant?.crop && CROP_BY_ID.get(kDef(s.k).plant!.crop!)!.seasons.includes(g.time.season);
    const slotOf = (id: string) => g.player.inv.slots.find((s) => s && s.n > 0 && kDef(s.k).id === id && grows(s)) ?? null;
    const cash = () => g.player.inv.slots.find((s) => s && s.n > 0 && grows(s) && !['cogbean_seed', 'barley_seed'].includes(kDef(s.k).id)) ?? slotOf('cogbean_seed');
    const want = this.plan();
    this.plot.forEach(([x, y]) => {
      const i = g.map.idx(x, y);
      const s = g.soil.get(i);
      if (!s || s.crop) return;
      // a works tile with no seed for it waits for tomorrow's shopping (a cash crop would hold it all season)
      const role = want.bean > 0 ? 'bean' : want.grain > 0 ? 'grain' : 'cash';
      want[role]--;
      const seed = role === 'bean' ? slotOf('cogbean_seed') : role === 'grain' ? slotOf('barley_seed') : cash();
      if (!seed || seed.n <= 0) return;
      const cr = CROP_BY_ID.get(kDef(seed.k).plant!.crop!)!;
      if (plant(g, cr, i)) {
        g.player.inv.remove(seed.k, 1);
        this.wait(0.25);
      }
    });
    // the gleaner beds: cogbeans in every tile (the gleaners pick them from noon)
    for (const [x, y] of this.beds.flatMap((b) => b.tiles)) {
      const i = g.map.idx(x, y);
      const s = g.soil.get(i);
      if (s?.crop?.dead) s.crop = null;
      if (!s || s.crop) continue;
      const seed = slotOf('cogbean_seed');
      if (!seed) break;
      if (plant(g, CROP_BY_ID.get('cogbean')!, i)) {
        g.player.inv.remove(seed.k, 1);
        this.wait(0.25);
      }
    }
    // then water: seeds sown this morning grow today
    const can = this.toolId('can');
    const yardBeds = keeperPatch.length ? [...keeperPatch, ...OPENING.bed, ...OPENING.bedRipe] : [];
    for (const [x, y] of [...yardBeds, ...this.plot, ...this.beds.flatMap((b) => b.tiles)]) {
      const s = g.soil.get(g.map.idx(x, y));
      if (!s || s.water || !s.crop || g.isRaining()) continue;
      if (g.player.water <= 0) {
        // refill at the farm pond
        this.walkTo(78, 30);
        g.player.water = 40;
        this.wait(1);
      }
      if (can && this.energyOk(5)) {
        this.use('can', x, y);
        void waterTile;
      }
    }
  }

  expandPlot(target: number) {
    const g = this.g;
    if (this.plot.length >= target) return;
    const cand = this.findPlot(target + 30);
    for (const [x, y] of cand) {
      if (this.plot.length >= target || !this.energyOk(60)) break;
      if (this.plot.some(([a, b]) => a === x && b === y)) continue;
      if (this.clearAndTill(x, y)) this.plot.push([x, y]);
    }
    this.collectDrops();
  }

  gather() {
    // chop and break things around the farm for wood + stone
    const g = this.g;
    for (let y = 30; y < 80 && this.energyOk(30); y++)
      for (let x = 30; x < 90 && this.energyOk(30); x++) {
        const o = g.map.o(x, y);
        if (o === O.TREE && g.map.trees.get(g.map.idx(x, y))!.stage >= 4 && g.player.inv.countId('wood') < 150) {
          this.walkTo(x, y + 1);
          for (let k = 0; k < 12 && g.map.o(x, y) === O.TREE; k++) this.use('axe', x, y);
        } else if (o === O.ROCK && g.player.inv.countId('stone') < 120) {
          this.walkTo(x, y + 1);
          for (let k = 0; k < 3 && g.map.o(x, y) === O.ROCK; k++) this.use('pick', x, y);
        } else if ((o === O.WEED || o === O.TALLGRASS) && g.player.inv.countId('fiber') < 60) {
          this.use('scythe', x, y);
        }
      }
    this.collectDrops();
  }

  /**
   * A trip down the Deepworks (ROADMAP.md 7.2): level by level, rocks until the ladder shows (ore
   * first), a look at every works chamber on the way, the old lift on level 5 restored once the bag
   * holds its parts (4 planks, 2 copper gears and a rope: made from the bag before setting out, the
   * gears bought at the Workshop when short), and from then on the lift down to the deepest chamber
   * reached. It keeps out from under cracked ceilings and out of gas, pops a wisp to find its ladder,
   * shores level 6's gallery when it has the beams, and turns back at the flood.
   */
  mineTrip() {
    const g = this.g;
    const m = mine(g);
    const inv = g.player.inv;
    if (!this.energyOk(70)) return;
    const lifted = () => g.flags.has('chamber:lift');
    const LIFT_PARTS: [string, number][] = [['plank', 4], ['rope', 1], ['copper_gear', 2]];
    const handCraft = (id: string, n: number) => {
      const r = RECIPES.find((r) => r.station === 'hand' && r.out[0].item === id);
      for (let made = 0; r && made < n && canCraft(g, r, 1); made += r.out[0].n) craft(g, r, 1);
    };
    if (!lifted()) {
      for (const [id, n] of LIFT_PARTS) if (inv.countId(id) < n) handCraft(id, n - inv.countId(id));
      const short = 2 - inv.countId('copper_gear');
      const e = shopStock(g, 'workshop').find((s) => s.item === 'copper_gear');
      if (short > 0 && e && shopOpen(g, 'workshop').open && g.player.money > entryPrice(g, e) * short + 300) {
        const [wx, wy] = g.map.loc('workshop');
        this.walkTo(wx, wy + 1);
        buy(g, e, short);
      }
    }
    const [ex, ey] = g.map.loc('mine_entrance');
    this.walkTo(ex, ey + 1);
    // the lift to the deepest chamber reached once it runs (its window's choice); the ladder to level 1 until then
    const stops = m.lifts(g);
    if (lifted() && stops.length) m.enter(g, stops[stops.length - 1]);
    else m.enterPrompt(g);
    const here = () => g.player.where === 'mine' && !!m.map;
    const tier = () => { const id = this.toolId('pick'); return id ? kDef(key(id)).tool!.tier : 0; };
    const swing = (x: number, y: number) => {
      this.sel(this.toolId('pick')!);
      g.player.busy = 0;
      useTool(g, 'pick', tier(), x, y);
      this.wait(0.4);
    };
    const isRock = (o: number) => o === O.ORE_ROCK || o === O.ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK;
    let levels = 0;
    while (here() && this.energyOk(20) && g.time.min < 21 * 60 && levels < 8) {
      const mm = m.map!, floor = m.floor;
      // a look at every works chamber here (and the old lift restored once the bag has its parts)
      for (const c of m.chambers) {
        g.player.x = c.x + c.w / 2;
        g.player.y = c.y + 2.2;
        this.wait(0.3);
        if (c.kind === 'lift' && !lifted() && LIFT_PARTS.every(([id, n]) => inv.countId(id) >= n)) {
          m.interact(g, c.x, c.y);
          this.notes.push('restored the old lift');
        }
      }
      // level 6's collapsed gallery: shored up with 20 beams, if the bag (or its hardwood) has them
      const gallery = m.gallery;
      const galleryState = () => (gallery ? mm.objData[mm.idx(gallery[0], gallery[1])] : -1);
      if (gallery && galleryState() === 0) {
        if (inv.countId('beam') < 20) handCraft('beam', 20 - inv.countId('beam'));
        if (inv.countId('beam') >= 20) {
          g.player.x = gallery[0] + 0.5;
          g.player.y = gallery[1] + 1.5;
          m.interact(g, gallery[0], gallery[1]);
        }
      }
      // a wisp hides this level's ladder: one hit and it shows
      for (const mo of [...m.monsters]) {
        if (mo.def.behavior !== 'guard' || !here()) continue;
        g.player.x = mo.x;
        g.player.y = mo.y + 1.2;
        g.player.dir = 0;
        swing(Math.floor(mo.x), Math.floor(mo.y - 0.3));
      }
      const wayDown = () => !!m.ladder || galleryState() === 1 || galleryState() === 3;
      // rocks, ore first, never under a cracked ceiling, in a gas pocket or on a star-shard's mark
      const safe = (x: number, y: number) => !m.hazards.some((h) => h.state !== 2 && (h.kind === 'crack' ? Math.hypot(x - h.x, y + 1 - h.y) < 2.8 : Math.abs(x - h.x) + Math.abs(y + 1 - h.y) <= 1));
      const rocks: [number, number, number][] = [];
      for (let i = 0; i < mm.obj.length; i++) if (isRock(mm.obj[i])) rocks.push([i % mm.w, Math.floor(i / mm.w), mm.obj[i] === O.ORE_ROCK ? 0 : 1]);
      rocks.sort((a, b) => a[2] - b[2]);
      for (const [x, y] of rocks.slice(0, 40)) {
        if (wayDown() || !this.energyOk(20) || !here() || m.floor !== floor) break;
        if (!isRock(mm.o(x, y)) || !safe(x, y)) continue;
        g.player.x = x + 0.5;
        g.player.y = y + 1.5;
        this.wait(0.3);
        for (let k = 0; k < 10 && here() && m.floor === floor && isRock(mm.o(x, y)); k++) swing(x, y);
        // picked up as it goes, before a rust-mite gets to it
        if (here()) this.collectDrops();
      }
      if (!here() || m.floor !== floor) continue; // fainted, or puffed up a level by gas
      if (!wayDown() || floor >= 30) break;
      m.enter(g, floor + 1);
      levels++;
    }
    this.collectDrops();
    if (here()) m.leave(g);
  }

  crafting() {
    const g = this.g;
    const tryCraft = (id: string, n = 1) => {
      const r = RECIPES.find((r) => r.station === 'hand' && r.out[0].item === id);
      if (r && canCraft(g, r, n)) {
        craft(g, r, n);
        this.notes.push(`crafted ${id}`);
        return true;
      }
      return false;
    };
    if (!g.ents.machines.some((e) => e.def.id === 'furnace') && g.player.inv.countId('furnace') === 0) tryCraft('furnace');
    if (g.player.inv.countId('furnace') > 0) this.placeNearHouse('furnace');
    // smelt copper
    const furnace = g.ents.machines.find((e) => e.def.id === 'furnace');
    if (furnace) {
      for (const s of furnace.mach!.outBuf) g.player.inv.add(s.k, s.n);
      furnace.mach!.outBuf = [];
      const ore = g.player.inv.countId('copper_ore');
      if (ore >= 3) {
        const n = machInsert(g, furnace, key('copper_ore'), ore, true);
        g.player.inv.remove(key('copper_ore'), n);
      }
      const fuel = g.player.inv.countId('coal') > 0 ? 'coal' : 'wood';
      if ((furnace.mach!.fuel?.n ?? 0) < 4 && g.player.inv.countId(fuel) > 5) {
        const n = machInsert(g, furnace, key(fuel), 5, true);
        g.player.inv.remove(key(fuel), n);
      }
    }
    if (g.player.inv.countId('lab') > 0) this.placeNearHouse('lab');
    if (g.player.inv.countId('chest_wood') > 0 && !g.ents.others.some((e) => e.def.id === 'chest_wood')) this.placeNearHouse('chest_wood');
    // research bundles
    if (g.flags.has('lab')) {
      // while Bram's oil order is open (k8) the beans are the oil's: keep them out of the bundles
      // (and barley is the mill's: it never goes in a bundle)
      const hold = questSys(g).active.some((a) => a.id === 'k8_river') ? g.player.inv.countId('cogbean') : 0;
      const grain = g.player.inv.countId('barley');
      if (hold) g.player.inv.removeSpec('cogbean', hold);
      if (grain) g.player.inv.removeSpec('barley', grain);
      for (let i = 0; i < 20; i++) if (!tryCraft('bundle_green')) break;
      if (hold) g.player.inv.add(key('cogbean'), hold);
      if (grain) g.player.inv.add(key('barley'), grain);
      const lab = g.ents.others.find((e) => e.def.kind === 'lab');
      if (lab) {
        const n = g.player.inv.countId('bundle_green');
        if (n) {
          const got = Math.min(n, 20 - lab.inv!.countId('bundle_green'));
          g.player.inv.remove(key('bundle_green'), got);
          lab.inv!.add(key('bundle_green'), got);
        }
        // the main chain's topics first (More Power, the Town Mill), each once its keystone stages are
        // done; sprout-only topics fill the gaps (copper bundles come from bought gears and planks)
        const chain = ['r_belts', 'r_arms', 'r_preserves', 'r_gleaning', 'r_metallurgy', 'r_power', 'r_milling'];
        const side = ['r_brewing', 'r_fertilizer', 'r_woodworking'];
        const payable = (id: string) => RESEARCH_BY_ID.get(id)!.cost.every((c) => c.item === 'bundle_green' || (c.item === 'bundle_copper' && g.research.done.has('r_metallurgy')));
        const ready = (id: string) => canResearch(g, id) && stages(g, id).ready && payable(id);
        const next = chain.find(ready) ?? side.find(ready) ?? RESEARCH.find((r) => ready(r.id) && r.cost.every((c) => c.item === 'bundle_green'))?.id;
        const cur = g.research.current;
        if (next && next !== cur && (!cur || (chain.includes(next) && !chain.includes(cur)))) {
          setResearch(g, next);
          this.notes.push(`researching ${next}`);
        }
        // copper bundles for a Water topic: a gear and two planks each, up to twenty on the desk
        const wanted = this.copperWanted();
        if (wanted > 0) {
          while (lab.inv!.countId('bundle_copper') + g.player.inv.countId('bundle_copper') < wanted && g.player.inv.countId('copper_gear') > this.gearReserve()) {
            if (g.player.inv.countId('plank') < 2 && g.player.inv.countId('wood') >= 2) tryCraft('plank');
            if (!tryCraft('bundle_copper')) break;
          }
          const got = Math.min(g.player.inv.countId('bundle_copper'), 20 - lab.inv!.countId('bundle_copper'));
          if (got > 0) {
            g.player.inv.remove(key('bundle_copper'), got);
            lab.inv!.add(key('bundle_copper'), got);
          }
        }
      }
    }
    // metal parts for automation
    // keep 3 bars for Bram's furnace quest before turning bars into gears
    const keepBars = questSys(g).done.includes('t_furnace') ? 2 : 5;
    if (g.research.done.has('r_metallurgy') && g.player.inv.countId('copper_bar') >= keepBars) tryCraft('copper_gear');
    if (g.research.done.has('r_belts') && g.player.inv.countId('belt_1') < 6) tryCraft('belt_1');
  }

  /** the works the bot keeps (ROADMAP.md 4.13): L1, a gleaner beside its plot, then L3 */
  lineIn: number | null = null;
  lineOut: number | null = null;
  gleanOut: number | null = null;
  pairOut: number[] = [];
  /** k9 "A Second Bed": two gleaners, each in the middle of a 3x3 of cogbeans */
  beds: { gl: number; tiles: [number, number][] }[] = [];

  /** a free run of n tiles in a row (x..x+n-1, y), clear of the plot */
  private freeRun(n: number, rows = 2): [number, number] | null {
    const g = this.g;
    for (let y = 20; y < 46; y++)
      for (let x = 38; x < 70 - n; x++) {
        let ok = true;
        for (let r = 0; r < rows && ok; r++)
          for (let k = 0; k < n && ok; k++) {
            const tx = x + k, ty = y + r;
            if (this.plot.some(([a, b]) => Math.abs(a - tx) <= 1 && Math.abs(b - ty) <= 1) || inYard(tx, ty)) ok = false;
            else if (!canPlace(g, 'chest_wood', tx, ty, 0).ok) ok = false;
          }
        if (ok) return [x, y];
      }
    return null;
  }

  private bedSite(): [number, number] | null {
    const g = this.g;
    const taken = new Set([...this.plot, ...this.beds.flatMap((b) => b.tiles)].map(([x, y]) => x + ',' + y));
    for (let y = 28; y < 70; y++)
      for (let x = 30; x < 80; x++) {
        let ok = canPlace(g, 'gleaner', x, y, 0).ok;
        for (let dy = -2; dy <= 2 && ok; dy++)
          for (let dx = -2; dx <= 2 && ok; dx++) {
            const tx = x + dx, ty = y + dy, i = g.map.idx(tx, ty);
            if (taken.has(tx + ',' + ty) || inYard(tx, ty) || g.ents.at(tx, ty)) ok = false;
            else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy) && (g.map.zone[i] !== Z.FARM || g.map.buildingAt[i] || g.map.ground[i] === T.PATH || g.map.ground[i] === T.POND || (!g.soil.has(i) && !canTill(g, tx, ty) && g.map.o(tx, ty) !== O.WEED && g.map.o(tx, ty) !== O.TWIG && g.map.o(tx, ty) !== O.ROCK))) ok = false;
          }
        if (ok) return [x, y];
      }
    return null;
  }

  private placeAt(id: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0) {
    const g = this.g;
    if (g.player.inv.countId(id) <= 0 || !canPlace(g, id, x, y, rot).ok) return null;
    g.player.inv.removeSpec(id, 1);
    const e = place(g, id, x, y, rot);
    g.sys.quests?.notify?.(g, 'build', 1, id);
    return e;
  }

  works() {
    const g = this.g;
    const tryCraft = (id: string, n = 1) => {
      const r = RECIPES.find((r) => r.station === 'hand' && r.out[0].item === id);
      if (r && canCraft(g, r, n)) {
        craft(g, r, n);
        return true;
      }
      return false;
    };
    const have = (id: string, n: number) => {
      while (g.player.inv.countId(id) < n && tryCraft(id));
      return g.player.inv.countId(id) >= n;
    };
    if (!g.research.done.has('r_arms') || !g.research.done.has('r_preserves')) return;
    // the parts' parts: planks from wood, rope from fiber
    while (g.player.inv.countId('plank') < 10 && g.player.inv.countId('wood') >= 30 && tryCraft('plank'));
    while (g.player.inv.countId('rope') < 4 && g.player.inv.countId('fiber') >= 12 && tryCraft('rope'));
    // L1: chest -> arm -> jar -> arm -> chest, fed from the bot's surplus crops
    if (this.lineIn === null && have('jar', 1) && have('arm_basic', 2) && have('chest_wood', 2)) {
      const at = this.freeRun(5, 1);
      if (at) {
        const [x, y] = at;
        const a = this.placeAt('chest_wood', x, y);
        this.placeAt('arm_basic', x + 1, y, 1);
        this.placeAt('jar', x + 2, y);
        this.placeAt('arm_basic', x + 3, y, 1);
        const b = this.placeAt('chest_wood', x + 4, y);
        if (a && b) {
          this.lineIn = a.id;
          this.lineOut = b.id;
          this.notes.push('built L1');
        }
      }
    }
    // a gleaner beside the plot: gleaner -> arm -> chest, emptied into L1 each day
    if (this.lineIn !== null && this.gleanOut === null && g.research.done.has('r_gleaning') && have('gleaner', 1) && have('arm_basic', 1) && have('chest_wood', 1)) {
      const inPlot = (x: number, y: number) => this.plot.some(([a, b]) => a === x && b === y);
      search: for (const [px, py] of this.plot)
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const tx = px + dx, ty = py + dy;
          if (inPlot(tx, ty) || !canPlace(g, 'gleaner', tx, ty, 0).ok) continue;
          let near = 0;
          for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) if (inPlot(xx, yy)) near++;
          if (near < 3) continue;
          for (const [rot, ox, oy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]] as const) {
            const ax = tx + ox, ay = ty + oy, cx = tx + 2 * ox, cy = ty + 2 * oy;
            if (inPlot(ax, ay) || inPlot(cx, cy) || !canPlace(g, 'arm_basic', ax, ay, rot).ok || !canPlace(g, 'chest_wood', cx, cy, 0).ok) continue;
            this.placeAt('gleaner', tx, ty);
            this.placeAt('arm_basic', ax, ay, rot);
            const c = this.placeAt('chest_wood', cx, cy);
            if (c) {
              this.gleanOut = c.id;
              this.notes.push('placed a gleaner');
            }
            break search;
          }
        }
    }
    // k9 "A Second Bed" without a spare arm: the gleaner alone amid the bean tiles, its basket
    // emptied into the line by hand each day (an arm and a chest come later)
    if (this.gleanOut === null && g.research.done.has('r_gleaning') && questSys(g).active.some((a) => a.id === 'k9_bed') && have('gleaner', 1)) {
      const inPlot = (x: number, y: number) => this.plot.some(([a, b]) => a === x && b === y);
      let best: [number, number] | null = null, bestN = 0;
      for (const [px, py] of this.plot.slice(0, Math.max(8, this.beanTarget())))
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const tx = px + dx, ty = py + dy;
          if (inPlot(tx, ty) || !canPlace(g, 'gleaner', tx, ty, 0).ok) continue;
          let near = 0;
          for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) if (inPlot(xx, yy)) near++;
          if (near > bestN) [best, bestN] = [[tx, ty], near];
        }
      const gl = best && bestN >= 3 ? this.placeAt('gleaner', best[0], best[1]) : null;
      if (gl) {
        this.gleanOut = gl.id;
        this.notes.push('placed a gleaner in the bean bed');
      }
    }
    // k9's beds: a gleaner in the middle of eight cogbean tiles, twice (the step's 16 in reach)
    const k9 = questSys(g).active.some((a) => a.id === 'k9_bed') || questSys(g).done.includes('k9_bed');
    while (k9 && this.beds.length < 2 && g.research.done.has('r_gleaning') && have('gleaner', 1)) {
      const site = this.bedSite();
      if (!site) break;
      const gl = this.placeAt('gleaner', site[0], site[1]);
      if (!gl) break;
      const tiles: [number, number][] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.clearAndTill(site[0] + dx, site[1] + dy)) tiles.push([site[0] + dx, site[1] + dy]);
      this.beds.push({ gl: gl.id, tiles });
      this.notes.push('placed a gleaner bed');
    }
    // L3: chest -> arm -> belt -> splitter -> two belts -> two jars -> arms -> chests
    if (this.lineIn !== null && !this.pairOut.length && g.research.done.has('r_logistics') && have('splitter_1', 1) && have('belt_1', 3) && have('jar', 2) && have('arm_basic', 3) && have('chest_wood', 3)) {
      const at = this.freeRun(7, 2);
      if (at) {
        const [x, y] = at;
        const a = this.placeAt('chest_wood', x, y);
        this.placeAt('arm_basic', x + 1, y, 1);
        this.placeAt('belt_1', x + 2, y, 1);
        this.placeAt('splitter_1', x + 3, y, 1);
        this.placeAt('belt_1', x + 4, y, 1);
        this.placeAt('belt_1', x + 4, y + 1, 1);
        this.placeAt('jar', x + 5, y);
        this.placeAt('jar', x + 5, y + 1);
        this.placeAt('arm_basic', x + 6, y, 1);
        this.placeAt('arm_basic', x + 6, y + 1, 1);
        const b = this.placeAt('chest_wood', x + 7, y), c = this.placeAt('chest_wood', x + 7, y + 1);
        if (a && b && c) {
          this.pairOut = [a.id, b.id, c.id];
          this.notes.push('built L3');
        }
      }
    }
    // carry: the gleaner's chest into L1, the lines' goods to the crate
    const lineIn = this.lineIn !== null ? g.ents.get(this.lineIn) : null;
    const gl = this.gleanOut !== null ? g.ents.get(this.gleanOut) : null;
    if (lineIn?.inv && gl?.inv) for (const s of gl.inv.slots) if (s) s.n = lineIn.inv.add(s.k, s.n);
    if (gl?.inv) gl.inv.slots = gl.inv.slots.map((s) => (s && s.n > 0 ? s : null));
    for (const b of this.beds) {
      const basket = g.ents.get(b.gl);
      if (!basket?.inv) continue;
      for (const s of basket.inv.slots) {
        if (!s) continue;
        const f = this.crockFeeds().sort((x, y) => x.chest.inv!.countId('cogbean') - y.chest.inv!.countId('cogbean'))[0];
        if (f) s.n = f.chest.inv!.add(s.k, s.n);
        if (s.n) s.n = g.player.inv.add(s.k, s.n);
      }
      basket.inv.slots = basket.inv.slots.map((s) => (s && s.n > 0 ? s : null));
    }
    const bin = g.ents.get(g.shipBinId);
    for (const id of [this.lineOut, ...this.pairOut.slice(1)]) {
      const out = id !== null ? g.ents.get(id) : null;
      if (!out?.inv || !bin?.inv) continue;
      for (let i = 0; i < out.inv.slots.length; i++) {
        const s = out.inv.slots[i];
        if (!s) continue;
        const left = bin.inv.add(s.k, s.n);
        out.inv.slots[i] = left ? { k: s.k, n: left } : null;
      }
    }
  }

  /** k9 "A Second Bed": the gleaner wants 2 copper gears; the Workshop sells them (the step's hint) */
  buyGleanerParts() {
    const g = this.g;
    const q = questSys(g);
    if (!q.active.some((a) => a.id === 'k9_bed') || !g.research.done.has('r_gleaning')) return;
    const need = 2 * Math.max(0, 2 - this.beds.length - g.player.inv.countId('gleaner'));
    if (!need || g.player.inv.countId('copper_gear') >= need || g.player.money < 600) return;
    if (g.time.min < 600) this.wait((600 - g.time.min) * 0.7 + 1);
    if (!shopOpen(g, 'workshop').open) return;
    const e = shopStock(g, 'workshop').find((x) => x.item === 'copper_gear');
    if (e && buy(g, e, need - g.player.inv.countId('copper_gear'))) this.notes.push('bought copper gears');
  }

  /** wheels on the river that turn (the keeper's, restored, and any built) */
  private wheels(): number {
    return this.g.ents.all().filter((e) => e.def.id === 'waterwheel' && !e.ghost && !e.st.rust).length;
  }

  private craftHand(id: string): boolean {
    const r = RECIPES.find((r) => r.station === 'hand' && r.out[0].item === id);
    if (!r || !canCraft(this.g, r, 1)) return false;
    craft(this.g, r, 1);
    return true;
  }

  /**
   * More Power and the Town Mill (k9_power, k10): what the chain still wants from town. Copper
   * bundles for the topic on the desk (a gear and two planks each), the second wheel (6 gears, 4
   * coils, 20 planks) and a pole's coil, and the Town Mill order's planks and gears.
   */
  /** gears the bag keeps for other parts of the chain: k9's gleaners, the second wheel, the Town Mill's order */
  private gearReserve(): number {
    const g = this.g;
    const q = questSys(g);
    let n = 0;
    if (q.active.some((a) => a.id === 'k9_bed')) n += 2 * Math.max(0, 2 - this.beds.length - g.player.inv.countId('gleaner'));
    if (g.research.done.has('r_power') && this.wheels() < 2 && !g.player.inv.countId('waterwheel')) n += 6;
    const o = openOrder(g, 'w_town_mill');
    if (o) for (const l of o.lines) if (l.spec === 'copper_gear') n += l.n - l.have;
    return n;
  }

  /**
   * Copper bundles the desk should hold: the Water topic on it, or Milling's 20 ahead of time while
   * its keystone stages run (so the desk starts the moment the mill is validated)
   */
  private copperWanted(): number {
    const g = this.g;
    const topic = g.research.current ? RESEARCH_BY_ID.get(g.research.current) : undefined;
    if (topic?.cost.some((c) => c.item === 'bundle_copper')) return Math.min(20, researchUnits(topic.id, g) - (g.research.progress[topic.id] ?? 0));
    if (g.research.done.has('r_power') && !g.research.done.has('r_milling')) return researchUnits('r_milling', g) - (g.research.progress.r_milling ?? 0);
    return 0;
  }

  private powerNeeds(): { gear: number; coil: number; plank: number } {
    const g = this.g;
    const inv = g.player.inv;
    let gear = 0, coil = 0, plank = 0;
    const lab = g.ents.others.find((e) => e.def.kind === 'lab');
    const n = Math.max(0, this.copperWanted() - (lab?.inv?.countId('bundle_copper') ?? 0) - inv.countId('bundle_copper'));
    gear += n;
    plank += 2 * n;
    if (g.research.done.has('r_power') && this.wheels() < 2 && !inv.countId('waterwheel')) {
      gear += 6;
      coil += 5;
      plank += 20;
    }
    const o = openOrder(g, 'w_town_mill');
    if (o) for (const l of o.lines) {
      if (l.spec === 'plank') plank += l.n - l.have;
      if (l.spec === 'copper_gear') gear += l.n - l.have;
    }
    // wood the bag can saw into planks first
    plank -= Math.floor(Math.max(0, inv.countId('wood') - 20) / 2);
    return { gear: Math.max(0, gear - inv.countId('copper_gear')), coil: Math.max(0, coil - inv.countId('copper_coil')), plank: Math.max(0, plank - inv.countId('plank')) };
  }

  buyPowerParts() {
    const g = this.g;
    const q = questSys(g);
    if (!q.active.some((a) => a.id === 'k9_power' || a.id === 'k10_mill')) return;
    const need = this.powerNeeds();
    if (!need.gear && !need.coil && !need.plank) return;
    const get = (shopId: string, id: string, n: number) => {
      if (n <= 0 || !shopOpen(g, shopId).open) return;
      const e = shopStock(g, shopId).find((x) => x.item === id);
      if (!e) return;
      const afford = Math.floor((g.player.money - 800) / entryPrice(g, e));
      const got = afford > 0 ? buy(g, e, Math.min(n, afford)) : 0;
      if (got) this.notes.push(`bought ${got} ${ITEM_BY_ID.get(id)!.name}`);
    };
    get('carpenter', 'plank', need.plank);
    if ((need.gear || need.coil) && g.time.min < 600) this.wait((600 - g.time.min) * 0.7 + 1);
    get('workshop', 'copper_gear', need.gear);
    get('workshop', 'copper_coil', need.coil);
  }

  /**
   * More Power's second wheel: on the river beside the keeper's, its land half on the farm, in reach
   * of the keeper's poles (or with a pole of its own that wires into them).
   */
  secondWheel() {
    const g = this.g;
    if (!g.research.done.has('r_power') || this.wheels() >= 2) return;
    const inv = g.player.inv;
    while (inv.countId('plank') < 20 && inv.countId('wood') >= 2 && this.craftHand('plank'));
    if (!inv.countId('waterwheel')) this.craftHand('waterwheel');
    if (!inv.countId('waterwheel')) return;
    if (g.ents.powerDirty) rebuildPower(g);
    const ps = powerState(g);
    const pole = g.ents.at(RIVER.poles[0][0], RIVER.poles[0][1]);
    const net = pole?.net ?? 0;
    // stand on the farm side while placing (never on the footprint)
    this.walkTo(RIVER.spot[0], RIVER.spot[1]);
    let best: { x: number; y: number; covered: boolean; score: number } | null = null;
    for (let y = RIVER.wheel[1] - 10; y <= RIVER.wheel[1] + 10; y++)
      for (let x = RIVER.wheel[0] - 6; x <= RIVER.wheel[0] + 6; x++) {
        if (!canPlace(g, 'waterwheel', x, y, 0).ok) continue;
        const covered = !!net && [[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) => ps.cover[g.map.idx(x + dx, y + dy)] === net);
        const score = Math.hypot(x - RIVER.wheel[0], y - RIVER.wheel[1]) + (covered ? 0 : 6);
        if (!best || score < best.score) best = { x, y, covered, score };
      }
    if (!best) {
      this.notes.push('no spot for a second wheel');
      return;
    }
    if (!best.covered) {
      // a pole beside the wheel whose wires reach a pole of the keeper's grid
      if (!inv.countId('pole_wood')) this.craftHand('pole_wood');
      if (!inv.countId('pole_wood')) return;
      const poles = g.ents.poles.filter((p) => !p.st.rust && p.net === net);
      let spot: [number, number] | null = null;
      for (let y = best.y - 2; y <= best.y + 3 && !spot; y++)
        for (let x = best.x - 2; x <= best.x + 3 && !spot; x++) {
          if (x >= best.x && x <= best.x + 1 && y >= best.y && y <= best.y + 1) continue;
          if (!canPlace(g, 'pole_wood', x, y, 0).ok) continue;
          if (poles.some((p) => Math.hypot(p.x - x, p.y - y) <= Math.min(7, p.def.reach ?? 7))) spot = [x, y];
        }
      if (!spot) {
        this.notes.push('no pole spot for the second wheel');
        return;
      }
      this.placeAt('pole_wood', spot[0], spot[1]);
    }
    if (this.placeAt('waterwheel', best.x, best.y, 0)) this.notes.push(`placed a second water wheel at ${best.x},${best.y}`);
  }

  /** k10: look at the town's silent mill (walking up to it counts), and fill the Town Mill's order at the board */
  townMill() {
    const g = this.g;
    const q = questSys(g);
    if (!q.active.some((a) => a.id === 'k10_mill')) return;
    if (!g.flags.has('observed:town_mill')) {
      const [x, y] = g.map.loc('town_mill');
      this.walkTo(x, y);
      this.wait(0.5);
      if (g.flags.has('observed:town_mill')) this.notes.push('looked at the town mill');
    }
    const o = openOrder(g, 'w_town_mill');
    if (o && g.player.inv.slots.some((s) => s && o.lines.some((l) => l.have < l.n && matchesSpec(kDef(s.k), l.spec)))) {
      const [bx, by] = g.map.loc('board');
      this.walkTo(bx, by + 1);
      const n = boardHandIn(g, o);
      if (n) this.notes.push(`handed in ${n} for the Town Mill`);
    }
  }

  /**
   * The Town Mill's order by the post: the crate tagged for the Town Council with the meal, planks and
   * gears in it (the overnight post carries them to the order); back to the Copper Kettle once it's filled
   */
  consignTownMill() {
    const g = this.g;
    const bin = g.ents.get(g.shipBinId);
    if (!bin?.inv) return;
    const o = openOrder(g, 'w_town_mill');
    if (!o) {
      if (bin.st.tag === 'council') bin.st.tag = 'rowan';
      return;
    }
    let moved = 0;
    for (let i = 0; i < g.player.inv.slots.length; i++) {
      const sl = g.player.inv.slots[i];
      if (!sl) continue;
      const l = o.lines.find((l) => l.have < l.n && matchesSpec(kDef(sl.k), l.spec));
      if (!l) continue;
      const n = Math.min(sl.n, l.n - l.have);
      const left = bin.inv.add(sl.k, n);
      moved += n - left;
      sl.n -= n - left;
      if (sl.n <= 0) g.player.inv.slots[i] = null;
    }
    if (moved) {
      bin.st.tag = 'council';
      this.notes.push(`crated ${moved} for the Town Mill`);
    }
  }

  /** once the Keeper's Line has its second crock, buy the parts of the bot's own L1 line in town */
  buyLineParts() {
    const g = this.g;
    if (this.lineIn !== null || !questSys(g).done.includes('k6_bottleneck') || g.player.money < 2500) return;
    const get = (shopId: string, id: string, n: number) => {
      if (g.player.inv.countId(id) >= n || !shopOpen(g, shopId).open) return;
      const e = shopStock(g, shopId).find((x) => x.item === id);
      if (e) buy(g, e, n - g.player.inv.countId(id));
    };
    get('general', 'jar', 1);
    // the Workshop opens at 10
    if (g.time.min < 600 && g.player.inv.countId('arm_basic') < 2) this.wait((600 - g.time.min) * 0.7 + 1);
    get('workshop', 'arm_basic', 2);
  }

  placeNearHouse(id: string) {
    const g = this.g;
    for (let y = 24; y < 34; y++)
      for (let x = 40; x < 60; x++) {
        if (this.plot.some(([a, b]) => Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1) || inYard(x, y)) continue;
        if (canPlace(g, id, x, y, 0).ok) {
          g.player.inv.removeSpec(id, 1);
          place(g, id, x, y, 0);
          g.sys.quests?.notify?.(g, 'build', 1, id);
          this.notes.push(`placed ${id}`);
          return true;
        }
      }
    return false;
  }

  /** keep the bag tidy: stash materials in chests by the house */
  stash() {
    const g = this.g;
    // tools, and the parts of the works the bot is still building
    // the keeper's chests (the cellar, the river works) and the B6 crock's feed chest are lines, not storage
    const lines = new Set([this.lineIn, this.lineOut, this.gleanOut, ...this.pairOut]);
    const store = (e: { id: number; def: { id: string }; st: Record<string, any>; x: number; y: number }) => e.def.id === 'chest_wood' && !e.st.yard && !lines.has(e.id) && !(e.x === OPENING.jar2Chest[0] && e.y === OPENING.jar2Chest[1]);
    let chests = g.ents.others.filter(store);
    if (g.player.inv.slots.filter(Boolean).length > 24 && g.player.inv.countId('wood') >= 20) {
      const r = RECIPES.find((x) => x.out[0].item === 'chest_wood')!;
      if (canCraft(g, r)) {
        craft(g, r, 1);
        this.placeNearHouse('chest_wood');
        chests = g.ents.others.filter(store);
      }
    }
    const essentials = new Set(['copper_ore', 'copper_bar', 'coal', 'fiber', 'bundle_green', 'copper_gear', 'plank', 'wood', 'stone']);
    for (let i = 0; i < g.player.inv.slots.length; i++) {
      const sl = g.player.inv.slots[i];
      if (!sl) continue;
      const d = kDef(sl.k);
      if (d.tool || d.weapon || d.plant || WORKS_PARTS.has(d.id)) continue;
      if (this.hoardMeal() && d.tags?.includes('flour')) continue;
      if (d.id === 'barley' && this.holdBarley()) continue;
      const cap = essentials.has(d.id) ? 120 : 0;
      const n = sl.n - cap;
      if (n <= 0) continue;
      for (const c of chests) {
        const left = c.inv!.add(sl.k, n);
        sl.n -= n - left;
        if (left === 0) break;
      }
      if (sl.n <= 0) g.player.inv.slots[i] = null;
    }
  }

  talk() {
    const g = this.g;
    const want = ['marigold', 'tobias', 'ottoline', 'bram', 'juniper', 'rowan'];
    for (const id of want) {
      const n = npcSys(g).byId.get(id)!;
      if (n.talked && !questSys(g).active.some((a) => a.id === 't_professor')) continue;
      npcSys(g).interact(g, n);
      g.sys.dialogue = null;
      this.wait(1.5);
    }
  }

  /** the crate holds goods for a customer's order: wait for the next post (noon or 6pm) before bed */
  private waitForPost(): boolean {
    const g = this.g;
    const bin = g.ents.get(g.shipBinId);
    if (!bin?.inv || bin.inv.isEmpty() || !bin.st.tag || g.sleeping) return false;
    const next = POST_TIMES.find((t) => t > g.time.min);
    if (next === undefined) return false;
    this.wait((next - g.time.min) * 0.7 + 2);
    return true;
  }

  sleep() {
    const g = this.g;
    this.walkTo(49, 22);
    if (!g.sleeping) g.goToBed();
    let n = 0;
    while (g.sleeping && n++ < 60 * 60 * 30) g.tick();
    this.collectDrops();
  }

  /** the Keeper's Line step the Now strip shows ("k3_hands:1"), or '' when the chain is done */
  private step(): string {
    const n = questSys(this.g).now(this.g, 1)[0];
    return n && n.id.startsWith('k') ? `${n.id}:${n.index}` : '';
  }

  /** wait (in 1 s ticks, up to `max` s) until the chain leaves `step` */
  private waitPast(step: string, max: number) {
    for (let t = 0; t < max && this.step() === step && !this.g.sleeping; t++) this.wait(1);
  }

  /** F at a structure in the yard, standing beside it */
  private F(xy: [number, number]) {
    const e = this.g.ents.at(xy[0], xy[1]);
    if (!e) return false;
    this.walkTo(xy[0], xy[1] + 1);
    interactStruct(this.g, e);
    this.wait(0.3);
    return true;
  }

  private put(id: string, xy: [number, number], rot: 0 | 1 | 2 | 3) {
    if (this.g.ents.at(xy[0], xy[1])) return null;
    this.walkTo(xy[0], xy[1] + 1);
    return this.placeAt(id, xy[0], xy[1], rot);
  }

  /**
   * The Keeper's Line (ROADMAP.md 6), played the way a player would: one step at a time, walking
   * to each piece. Called through the day; it does what the current step needs and moves on.
   * B6's jar comes from the Mercantile, so the town part waits for the shop's hours.
   */
  keeperLine(town = false) {
    const g = this.g;
    if (!g.flags.has('keepers_line')) return;
    const q = questSys(g);
    for (let guard = 0; guard < 40 && !g.sleeping; guard++) {
      const s = this.step();
      if (!s) return;
      switch (s) {
        case 'k1_line:0': {
          const B = OPENING.beans;
          this.walkTo(B.x, B.y);
          let picked = 0;
          for (let y = B.y; y < B.y + B.h && picked < 4; y++)
            for (let x = B.x; x < B.x + B.w && picked < 4; x++) {
              for (const st of harvest(g, g.map.idx(x, y)) ?? []) {
                g.player.inv.add(st.k, st.n);
                picked += st.n;
              }
              this.wait(0.3);
            }
          break;
        }
        case 'k1_line:1':
          this.F(OPENING.jar);
          break;
        case 'k1_line:2': {
          this.wait(8);
          this.F(OPENING.jar);
          const i = g.player.inv.slots.findIndex((sl) => sl && kDef(sl.k).tags?.includes('preserve'));
          if (i >= 0) {
            g.player.sel = i;
            this.F([g.ents.get(g.shipBinId)!.x, g.ents.get(g.shipBinId)!.y]);
          }
          break;
        }
        case 'k2_springs:0': {
          // the Professor walks in from the road: meet her by the jar
          const n = npcSys(g).byId.get('ottoline')!;
          for (let t = 0; t < 40 && (g.sys.keeper?.visit !== 1 || n.path.length); t++) this.wait(0.5);
          this.walkTo(Math.floor(n.x), Math.floor(n.y));
          npcSys(g).interact(g, n);
          g.sys.dialogue = null;
          this.wait(4);
          break;
        }
        case 'k2_springs:1':
          this.F(OPENING.armTile);
          break;
        case 'k2_springs:2':
          this.waitPast(s, 90);
          break;
        case 'k3_hands:0':
          this.put('arm_basic', OPENING.feedArm, 0);
          break;
        case 'k3_hands:1':
        case 'k3_hands:2':
          this.waitPast(s, 120);
          break;
        case 'k4_grow:0':
          for (const [x, y] of OPENING.bed) this.use('hoe', x, y);
          break;
        case 'k4_grow:1': {
          const cr = CROP_BY_ID.get('cogbean')!;
          for (const [x, y] of OPENING.bed)
            if (g.player.inv.countId('cogbean_seed') > 0 && plant(g, cr, g.map.idx(x, y))) {
              g.player.inv.removeSpec('cogbean_seed', 1);
              this.wait(0.25);
            }
          break;
        }
        case 'k4_grow:2':
          for (const [x, y] of OPENING.bed) this.use('can', x, y);
          break;
        case 'k4_grow:3':
          this.F(OPENING.gleaner);
          break;
        case 'k5_desk:0':
          this.F(OPENING.desk);
          break;
        case 'k5_desk:1': {
          // 3 cogbeans make a bundle: from the bag, else from the cellar chest
          const chest = g.ents.at(OPENING.chest[0], OPENING.chest[1]);
          const need = 3 - g.player.inv.countId('cogbean');
          if (need > 0 && chest?.inv) {
            const n = Math.min(need, chest.inv.countId('cogbean'));
            chest.inv.removeSpec('cogbean', n);
            g.player.inv.add(key('cogbean'), n);
          }
          const r = RECIPES.find((x) => x.id === 'hand:bundle_green_3crop')!;
          if (canCraft(g, r)) craft(g, r, 1);
          else this.wait(30);
          break;
        }
        case 'k5_desk:2':
          this.F(OPENING.desk);
          setResearch(g, 'r_belts');
          break;
        case 'k5_desk:3':
          // looking over the belt run (a player hovers it)
          this.walkTo(OPENING.belts[1][0], OPENING.belts[1][1] + 1);
          g.flags.add('observed:belt_1');
          break;
        case 'k5_desk:4':
          for (const xy of OPENING.belts) if (g.ents.at(xy[0], xy[1])?.st.rust) this.F(xy);
          break;
        case 'k5_desk:5':
          this.F(OPENING.gleanArm);
          break;
        case 'k5_desk:6':
          this.waitPast(s, 120);
          break;
        case 'k6_bottleneck:0': {
          if (g.player.inv.countId('jar') === 0) {
            if (!town || !shopOpen(g, 'general').open) return;
            const e = shopStock(g, 'general').find((x) => x.item === 'jar');
            if (!e || !buy(g, e, 1)) return;
            this.notes.push('bought the second jar');
            this.walkTo(OPENING.jar2[0], OPENING.jar2[1] + 1);
          }
          this.put('jar', OPENING.jar2, 0);
          break;
        }
        case 'k6_bottleneck:1':
          if (g.player.inv.countId('chest_wood') === 0) {
            const r = RECIPES.find((x) => x.station === 'hand' && x.out[0].item === 'chest_wood');
            if (r && canCraft(g, r)) craft(g, r, 1);
          }
          this.put('chest_wood', OPENING.jar2Chest, 0);
          this.put('arm_basic', OPENING.jar2Feed, 0);
          if (this.step() === s) return;
          break;
        case 'k6_bottleneck:2':
          // it starves: the bot reads why (a player hovers it or holds I)
          this.wait(12);
          g.flags.add('read:starved');
          break;
        case 'k6_bottleneck:3': {
          // the fix: beans into its chest (from the bag, or carried over from the cellar chest)
          const box = g.ents.at(OPENING.jar2Chest[0], OPENING.jar2Chest[1]);
          const cellar = g.ents.at(OPENING.chest[0], OPENING.chest[1]);
          if (box?.inv && cellar?.inv) {
            const n = Math.min(6, cellar.inv.countId('cogbean'));
            cellar.inv.removeSpec('cogbean', n);
            box.inv.add(key('cogbean'), n);
            const mine = Math.min(6, g.player.inv.countId('cogbean'));
            g.player.inv.removeSpec('cogbean', mine);
            box.inv.add(key('cogbean'), mine);
          }
          this.waitPast(s, 300);
          if (this.step() === s) return;
          break;
        }
        case 'k6_bottleneck:4': {
          this.put('arm_basic', OPENING.jar2Out, 0);
          for (const [x, y, rot] of OPENING.jar2Belts) this.put('belt_1', [x, y], rot);
          if (this.step() === s) return;
          break;
        }
        case 'k7_town:0':
          // the Orders board: J opens it anywhere (a player at the square reads the noticeboard)
          if (town) this.walkTo(126, 65);
          g.flags.add('board:read');
          break;
        case 'k7_town:1': {
          // consignment: tag the crate for the Copper Kettle and let the posts carry the line's
          // pickles there; pickles in the bag go in the crate too
          const bin = g.ents.get(g.shipBinId)!;
          if (bin.st.tag !== 'rowan') {
            this.F([bin.x, bin.y]);
            g.sys.dialogue = null;
            bin.st.tag = 'rowan';
          }
          for (let i = 0; i < g.player.inv.slots.length; i++) {
            const sl = g.player.inv.slots[i];
            if (!sl || kDef(sl.k).id !== 'pickles_cogbean') continue;
            const left = bin.inv!.add(sl.k, sl.n);
            g.player.inv.slots[i] = left ? { k: sl.k, n: left } : null;
          }
          return;
        }
        case 'k8_river:0': {
          // Bram's oil: both crocks locked to the oil recipe, the second fed from the cellar, the
          // crate tagged for the Smithy
          const oil = RECIPES.find((r) => r.id === 'jar:cogbean_oil')!;
          for (const xy of [OPENING.jar, OPENING.jar2]) {
            const e = g.ents.at(xy[0], xy[1]);
            if (!e?.mach || (e.mach.locked && e.mach.recipe?.id === oil.id) || e.mach.pending?.r?.id === oil.id) continue;
            // Shift+F opens its window; the oil recipe is clicked in (mid-batch it takes over next batch)
            this.walkTo(xy[0], xy[1] + 1);
            setRecipe(g, e, oil);
          }
          const box = g.ents.at(OPENING.jar2Chest[0], OPENING.jar2Chest[1]);
          const cellar = g.ents.at(OPENING.chest[0], OPENING.chest[1]);
          if (box?.inv && cellar?.inv && box.inv.countId('cogbean') < 6) {
            const n = Math.min(8, Math.floor(cellar.inv.countId('cogbean') / 2));
            cellar.inv.removeSpec('cogbean', n);
            box.inv.add(key('cogbean'), n);
          }
          const bin = g.ents.get(g.shipBinId)!;
          if (bin.st.tag !== 'bram') bin.st.tag = 'bram';
          return;
        }
        case 'k8_river:1':
          // Bram's order is filled: the crocks go back to pickles (more coins per bean) and the crate
          // back to the Copper Kettle's weekly order
          for (const xy of [OPENING.jar, OPENING.jar2]) {
            const e = g.ents.at(xy[0], xy[1]);
            if (e?.mach?.locked) setRecipe(g, e, null);
          }
          g.ents.get(g.shipBinId)!.st.tag = 'rowan';
          this.F(RIVER.wheel);
          if (this.step() === s) return;
          break;
        case 'k8_river:2':
          for (const xy of [...RIVER.poles, RIVER.mill, RIVER.bin]) if (g.ents.at(xy[0], xy[1])?.st.rust) this.F(xy);
          break;
        case 'k8_river:3':
          this.put('arm_fast', RIVER.binArm, 1);
          this.put('arm_fast', RIVER.outArm, 1);
          if (this.step() === s) return;
          break;
        case 'k8_river:4':
          this.waitPast(s, 240);
          if (this.step() === s) return;
          break;
        default:
          // the steps after the Keeper's Line are left to the rest of the bot's day
          return;
      }
    }
  }

  playDay() {
    const g = this.g;
    this.notes = [];
    const day = g.dayIndex;
    // you wake up inside the farmhouse
    if (g.player.where === 'house') g.sys.house.leave(g);
    this.keeperLine();
    this.farmMorning();
    // the works first (ROADMAP.md 3.2 rule 5): the plot grows slowly until the bot's own line is up
    // more ground once the chain heads for the Town Mill: its barley comes on top of the beans and the cash crops
    this.expandPlot(Math.min(questSys(g).done.includes('k9_bed') ? 104 : 80, day < 5 ? 12 + day * 3 : 12 + day * 6));
    this.farmMorning();
    // afternoon in town
    if (g.time.min < 9 * 60) this.wait(Math.max(0, (9 * 60 - g.time.min) * 0.7));
    this.walkTo(120, 60);
    this.talk();
    this.shop();
    this.buyLineParts();
    this.buyGleanerParts();
    this.buyPowerParts();
    this.townMill();
    this.keeperLine(true);
    this.walkTo(56, 30);
    this.keeperLine();
    this.farmMorning();
    if (g.player.inv.countId('fiber') < 20) this.gather();
    if (day >= 2 && (g.player.inv.countId('copper_ore') < 15 || day % 3 === 0)) this.mineTrip();
    else this.gather();
    this.crafting();
    this.works();
    this.secondWheel();
    this.consignTownMill();
    this.stash();
    // goods in a tagged crate go to their order at the next post: stay up for it, then carry on
    if (this.waitForPost()) this.keeperLine();
    const deep = mine(g).deepest;
    const eLeft = Math.round(g.player.energy);
    this.sleep();
    this.log.push({
      day: day + 1, money: g.player.money, earned: g.earned, shipped: 0, soil: g.soil.size, energyLeft: eLeft,
      research: [...g.research.done], quests: questSys(g).done.length, mineDeep: deep, notes: this.notes,
    });
  }
}
