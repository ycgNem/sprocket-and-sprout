// A scripted "player" that plays through the sim API with realistic time costs.
// Used by the pacing test (Node) and the Playwright bot (browser).
import type { Game } from '../src/sim/Game';
import { CROPS, CROP_BY_ID } from '../src/data/crops';
import { ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { key, kDef } from '../src/sim/inventory';
import { till, plant, waterTile, harvest, canTill } from '../src/sim/systems/farming';
import { interactStruct, useTool } from '../src/sim/actions';
import { buy, shopStock, entryPrice } from '../src/sim/systems/economy';
import { craft, canCraft } from '../src/sim/crafting';
import { canPlace, place } from '../src/sim/build';
import { machInsert, setRecipe } from '../src/sim/systems/machines';
import { npcSys } from '../src/sim/systems/npcs';
import { mine } from '../src/sim/systems/mine';
import { O, T, Z } from '../src/sim/world/tilemap';
import { setResearch, canResearch } from '../src/sim/systems/research';
import { RESEARCH } from '../src/data/research';
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
const WORKS_PARTS = new Set(['jar', 'arm_basic', 'chest_wood', 'gleaner', 'splitter_1', 'belt_1', 'plank', 'rope', 'copper_gear']);

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

  shop() {
    const g = this.g;
    if (!shopOpen(g, 'general').open) return;
    const seed = this.bestSeed();
    if (!seed) { this.notes.push('no seed'); return; }
    const e = shopStock(g, 'general').find((s) => s.item === seed);
    if (!e) { this.notes.push('not stocked ' + seed); return; }
    const empty = this.plot.filter(([x, y]) => g.soil.get(g.map.idx(x, y)) && !g.soil.get(g.map.idx(x, y))!.crop).length;
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
    // keep a few crops for bundles/quests, ship the rest
    for (const sl of g.player.inv.slots) {
      if (!sl) continue;
      const d = kDef(sl.k);
      if ((d.cat === 'crop' || d.cat === 'fruit' || d.cat === 'flower' || d.cat === 'forage' || d.cat === 'fish' || d.cat === 'artisan') && d.price > 0) {
        const researching = g.flags.has('lab') && !!g.research.current;
        const keep = d.cat === 'crop' || d.cat === 'fruit' ? (researching ? 8 : 3) : 0;
        // the works first: the L1 jar line takes up to a day's worth of vegetables and fruit
        const lineIn = this.lineIn !== null ? g.ents.get(this.lineIn) : g.ents.at(OPENING.chest[0], OPENING.chest[1]);
        // the keeper's crock locked to oil (B8) takes cogbeans only: anything else would jam its arm
        const crock = g.ents.at(OPENING.jar[0], OPENING.jar[1]);
        const beansOnly = this.lineIn === null && !!crock?.mach?.locked;
        if (lineIn?.inv && (d.cat === 'crop' || d.cat === 'fruit') && sl.n > keep && (!beansOnly || d.id === 'cogbean')) {
          const room = Math.max(0, 17 - lineIn.inv.slots.reduce((a, s) => a + (s ? s.n : 0), 0));
          const give = Math.min(room, sl.n - keep);
          sl.n -= give - lineIn.inv.add(sl.k, give);
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
    // water (the keeper's patch and the gleaner's bed feed the line: unwatered, it starves for days)
    const can = this.toolId('can');
    const yardBeds = keeperPatch.length ? [...keeperPatch, ...OPENING.bed, ...OPENING.bedRipe] : [];
    for (const [x, y] of [...yardBeds, ...this.plot]) {
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
    // plant
    const seed = g.player.inv.slots.find((s) => s && kDef(s.k).plant?.crop && CROP_BY_ID.get(kDef(s.k).plant!.crop!)!.seasons.includes(g.time.season));
    for (const [x, y] of this.plot) {
      const i = g.map.idx(x, y);
      const s = g.soil.get(i);
      if (!s || s.crop || !seed || seed.n <= 0) continue;
      const cr = CROP_BY_ID.get(kDef(seed.k).plant!.crop!)!;
      if (plant(g, cr, i)) {
        g.player.inv.remove(seed.k, 1);
        g.sys.quests?.notify?.(g, 'plant', 1);
        this.wait(0.25);
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

  mineTrip() {
    const g = this.g;
    if (!this.energyOk(70)) return;
    this.walkTo(128, 14);
    const m = mine(g);
    const start = Math.max(1, Math.floor((m.deepest) / 5) * 5);
    m.enter(g, start);
    let floors = 0;
    while (this.energyOk(25) && g.time.min < 22 * 60 && floors < 6) {
      const mm = m.map!;
      // break ore rocks first, then normal rocks until a ladder shows
      const rocks: [number, number, number][] = [];
      for (let i = 0; i < mm.obj.length; i++) {
        const o = mm.obj[i];
        if (o === O.ORE_ROCK || o === O.ROCK || o === O.GEM_ROCK || o === O.ICE_ROCK) rocks.push([i % mm.w, Math.floor(i / mm.w), o === O.ORE_ROCK ? 0 : 1]);
      }
      rocks.sort((a, b) => a[2] - b[2]);
      let found = false;
      for (const [x, y] of rocks.slice(0, 40)) {
        if (!this.energyOk(25)) break;
        g.player.x = x + 0.5;
        g.player.y = y + 1.5;
        this.wait(0.6);
        if (g.player.where !== 'mine') break;
        for (let k = 0; k < 4 && mm.o(x, y) !== O.NONE && mm.o(x, y) !== O.LADDER && mm.o(x, y) !== O.SHAFT; k++) {
          this.sel(this.toolId('pick')!);
          g.player.busy = 0;
          g.spend(1.6);
          m.useTool(g, 'pick', kDef(key(this.toolId('pick')!)).tool!.tier, x, y);
          this.wait(0.4);
          if (g.player.where !== 'mine') break;
        }
        if (g.player.where !== 'mine') break;
        if (m.ladder) {
          found = true;
          break;
        }
      }
      this.collectDrops();
      if (g.player.where !== 'mine') break;
      if (!found) break;
      m.enter(g, m.floor + 1);
      floors++;
    }
    this.collectDrops();
    if (g.player.where === 'mine') m.leave(g);
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
      for (let i = 0; i < 12; i++) if (!tryCraft('bundle_green')) break;
      const lab = g.ents.others.find((e) => e.def.kind === 'lab');
      if (lab) {
        const n = g.player.inv.countId('bundle_green');
        if (n) {
          const got = Math.min(n, 10 - lab.inv!.countId('bundle_green'));
          g.player.inv.remove(key('bundle_green'), got);
          lab.inv!.add(key('bundle_green'), got);
        }
        if (!g.research.current) {
          const order = ['r_belts', 'r_arms', 'r_preserves', 'r_gleaning', 'r_metallurgy', 'r_brewing', 'r_fertilizer', 'r_sprinklers', 'r_woodworking'];
          const next = order.find((id) => canResearch(g, id)) ?? RESEARCH.find((r) => canResearch(g, r.id) && r.cost.every((c) => c.item === 'bundle_green'))?.id;
          if (next) {
            setResearch(g, next);
            this.notes.push(`researching ${next}`);
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
    const store = (e: { def: { id: string }; st: Record<string, any>; x: number; y: number }) => e.def.id === 'chest_wood' && !e.st.yard && !(e.x === OPENING.jar2Chest[0] && e.y === OPENING.jar2Chest[1]);
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
              g.sys.quests?.notify?.(g, 'plant', 1);
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
    this.expandPlot(Math.min(80, day < 5 ? 12 + day * 3 : 12 + day * 6));
    this.farmMorning();
    // afternoon in town
    if (g.time.min < 9 * 60) this.wait(Math.max(0, (9 * 60 - g.time.min) * 0.7));
    this.walkTo(120, 60);
    this.talk();
    this.shop();
    this.buyLineParts();
    this.keeperLine(true);
    this.walkTo(56, 30);
    this.keeperLine();
    this.farmMorning();
    if (g.player.inv.countId('fiber') < 20) this.gather();
    if (day >= 2 && (g.player.inv.countId('copper_ore') < 15 || day % 3 === 0)) this.mineTrip();
    else this.gather();
    this.crafting();
    this.works();
    this.stash();
    const deep = mine(g).deepest;
    const eLeft = Math.round(g.player.energy);
    this.sleep();
    this.log.push({
      day: day + 1, money: g.player.money, earned: g.earned, shipped: 0, soil: g.soil.size, energyLeft: eLeft,
      research: [...g.research.done], quests: questSys(g).done.length, mineDeep: deep, notes: this.notes,
    });
  }
}
