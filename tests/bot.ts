// A scripted "player" that plays through the sim API with realistic time costs.
// Used by the pacing test (Node) and the Playwright bot (browser).
import type { Game } from '../src/sim/Game';
import { CROPS, CROP_BY_ID } from '../src/data/crops';
import { ITEM_BY_ID } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { key, kDef } from '../src/sim/inventory';
import { till, plant, waterTile, harvest, canTill } from '../src/sim/systems/farming';
import { useTool } from '../src/sim/actions';
import { buy, shopStock, entryPrice } from '../src/sim/systems/economy';
import { craft, canCraft } from '../src/sim/crafting';
import { canPlace, place } from '../src/sim/build';
import { machInsert } from '../src/sim/systems/machines';
import { npcSys } from '../src/sim/systems/npcs';
import { mine } from '../src/sim/systems/mine';
import { O, T, Z } from '../src/sim/world/tilemap';
import { setResearch, canResearch } from '../src/sim/systems/research';
import { RESEARCH } from '../src/data/research';
import { questSys } from '../src/sim/systems/quests';
import { shopOpen } from '../src/sim/systems/town';
import { OPENING } from '../src/sim/systems/modes';

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
        if (g.map.zone[i] !== Z.FARM || g.map.buildingAt[i] || g.ents.at(x, y)) continue;
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
    // harvest + ship
    const bin = g.ents.get(g.shipBinId)!;
    for (const [x, y] of this.plot) {
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
        const n = Math.max(0, sl.n - keep);
        if (n > 0) {
          bin.inv!.add(sl.k, n);
          sl.n -= n;
          g.sys.quests?.notify?.(g, 'ship', n, d.id);
        }
      }
    }
    g.player.inv.slots = g.player.inv.slots.map((s) => (s && s.n > 0 ? s : null));
    // water
    const can = this.toolId('can');
    for (const [x, y] of this.plot) {
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
          const order = ['r_belts', 'r_arms', 'r_preserves', 'r_metallurgy', 'r_brewing', 'r_fertilizer', 'r_sprinklers', 'r_woodworking'];
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
    if (g.research.done.has('r_belts')) tryCraft('belt_1');
  }

  placeNearHouse(id: string) {
    const g = this.g;
    for (let y = 24; y < 34; y++)
      for (let x = 40; x < 60; x++) {
        if (this.plot.some(([a, b]) => Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1)) continue;
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
    const keep = new Set(['hoe', 'can', 'axe', 'pick', 'scythe', 'rod', 'sword']);
    let chests = g.ents.others.filter((e) => e.def.id === 'chest_wood');
    if (g.player.inv.slots.filter(Boolean).length > 24 && g.player.inv.countId('wood') >= 20) {
      const r = RECIPES.find((x) => x.out[0].item === 'chest_wood')!;
      if (canCraft(g, r)) {
        craft(g, r, 1);
        this.placeNearHouse('chest_wood');
        chests = g.ents.others.filter((e) => e.def.id === 'chest_wood');
      }
    }
    const essentials = new Set(['copper_ore', 'copper_bar', 'coal', 'fiber', 'bundle_green', 'copper_gear', 'plank', 'wood', 'stone']);
    for (let i = 0; i < g.player.inv.slots.length; i++) {
      const sl = g.player.inv.slots[i];
      if (!sl) continue;
      const d = kDef(sl.k);
      if (d.tool || d.weapon || d.plant || keep.has(d.id)) continue;
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

  /** the clockwork opening: pick the keeper's beans, feed the jar, place an arm into the crate */
  opening() {
    const g = this.g;
    if (!g.flags.has('tinker_start') || this.openingDone) return;
    this.openingDone = true;
    const B = OPENING.beans;
    this.walkTo(B.x + 1, B.y);
    for (let y = B.y; y < B.y + B.h; y++)
      for (let x = B.x; x < B.x + B.w; x++) {
        for (const st of harvest(g, g.map.idx(x, y)) ?? []) g.player.inv.add(st.k, st.n);
        this.wait(0.3);
      }
    const jar = g.ents.machines.find((e) => e.def.id === 'jar');
    this.walkTo(OPENING.jar[0], OPENING.jar[1] + 1);
    if (jar) {
      for (const sl of g.player.inv.slots) {
        if (!sl || kDef(sl.k).id !== 'cogbean') continue;
        const n = machInsert(g, jar, sl.k, sl.n, true);
        sl.n -= n;
      }
      g.player.inv.slots = g.player.inv.slots.map((s) => (s && s.n > 0 ? s : null));
    }
    const [ax, ay] = OPENING.armTile;
    if (canPlace(g, 'arm_basic', ax, ay, 0).ok && g.player.inv.countId('arm_basic') > 0) {
      g.player.inv.removeSpec('arm_basic', 1);
      place(g, 'arm_basic', ax, ay, 0);
      g.sys.quests?.notify?.(g, 'build', 1, 'arm_basic');
      this.notes.push('opening line built');
    }
  }

  openingDone = false;

  playDay() {
    const g = this.g;
    this.notes = [];
    const day = g.dayIndex;
    // you wake up inside the farmhouse
    if (g.player.where === 'house') g.sys.house.leave(g);
    this.opening();
    this.farmMorning();
    this.expandPlot(Math.min(80, 12 + day * 6));
    this.farmMorning();
    // afternoon in town
    if (g.time.min < 9 * 60) this.wait(Math.max(0, (9 * 60 - g.time.min) * 0.7));
    this.walkTo(120, 60);
    this.talk();
    this.shop();
    this.walkTo(56, 30);
    this.farmMorning();
    if (g.player.inv.countId('fiber') < 20) this.gather();
    if (day >= 2 && (g.player.inv.countId('copper_ore') < 15 || day % 3 === 0)) this.mineTrip();
    else this.gather();
    this.crafting();
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
