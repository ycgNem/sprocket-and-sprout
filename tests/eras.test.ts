// The one path past the Town Mill (the critic's Phase 3+4 review: C1, M1, M2, M4, M5): each era
// hands over the next town keystone, a keystone's stages count from its quest, its order is up from
// the first step and waits for its research, and the Works tab asks for what lines make.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { questSys, objText, nowLines } from '../src/sim/systems/quests';
import { stages } from '../src/sim/systems/research';
import { boardHandIn, openOrder, orders, postContracts } from '../src/sim/systems/orders';
import { tramBin, tramRun } from '../src/sim/systems/townworks';
import { QUEST_BY_ID, PROJECTS } from '../src/data/goals';
import { RECIPES } from '../src/data/recipes';
import { ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { SHOP_BY_ID } from '../src/data/shops';
import { STANDING_BY_ID } from '../src/data/orders';
import { RESEARCH_BY_ID } from '../src/data/research';
import { townEra } from '../src/sim/keystones';
import { serialize, deserialize } from '../src/sim/save';
import { Bot } from './bot';

const secs = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.tick(); };
const toasts = (g: Game) => g.events.filter((e) => e.t === 'toast').map((e) => (e as { text: string }).text);
/** put a main quest on, as the chain would (its objectives start from nothing) */
const q11 = (g: Game) => nowLines(g, 9).find((l) => l.id === 'k11_boiler')!;
const begin = (g: Game, id: string) => questSys(g).active.push({ id, prog: QUEST_BY_ID.get(id)!.objectives.map(() => 0), day: g.dayIndex });

describe('a keystone counts from its quest', () => {
  it("the meal the keeper's mill ground all spring isn't k10's try: the 20 count from the quest's start", () => {
    const g = new Game({ seed: 5 });
    g.research.done.add('r_power');
    g.counters['made:mill'] = 60;
    secs(g, 1.1);
    // not on the quest yet: nothing opened, nothing counted
    expect(g.flags.has('stages_open:r_milling')).toBe(false);
    begin(g, 'k10_mill');
    secs(g, 1.1);
    expect(g.flags.has('stages_open:r_milling')).toBe(true);
    expect(stages(g, 'r_milling').experiment).toBe(false);
    g.counters['made:mill'] += 19;
    expect(stages(g, 'r_milling').experiment).toBe(false);
    g.counters['made:mill'] += 1;
    expect(stages(g, 'r_milling').experiment).toBe(true);
  });

  it('the validate step shows the rate and the clock in the Now strip, and a run that breaks says so', () => {
    const g = new Game({ seed: 6 });
    g.research.done.add('r_power');
    begin(g, 'k10_mill');
    secs(g, 1.1);
    g.flags.add('observed:town_mill');
    g.counters['made:mill'] = (g.counters['made:mill'] ?? 0) + 25;
    g.research.valid.r_milling = 40;
    const a = questSys(g).active.find((x) => x.id === 'k10_mill')!;
    const def = QUEST_BY_ID.get('k10_mill')!;
    const line = objText(g, def.objectives[2], a.prog[2]);
    expect(line).toMatch(/a minute now, 0:40 of 2:00/);
    // nothing is being ground: the next second the run breaks, and the toast says it starts again
    g.events.length = 0;
    secs(g, 1.1);
    expect(g.research.valid.r_milling).toBe(0);
    expect(toasts(g).some((t) => /start again/.test(t))).toBe(true);
  });
});

describe("the Town Mill's order", () => {
  it("is up from k10's first step, takes everything early, and starts the works once Milling is studied", () => {
    const g = new Game({ seed: 7 });
    secs(g, 1.1);
    expect(openOrder(g, 'w_town_mill')).toBeNull();
    begin(g, 'k10_mill');
    secs(g, 1.1);
    const o = openOrder(g, 'w_town_mill')!;
    expect(o).toBeTruthy();
    expect(o.lines.find((l) => l.spec === '#flour')!.n).toBe(40);
    for (const l of o.lines) g.player.inv.add(key(l.spec === '#flour' ? 'barley_flour' : l.spec), l.n);
    g.events.length = 0;
    boardHandIn(g, o);
    expect(g.flags.has('town_mill')).toBe(false);
    expect(toasts(g).some((t) => /Everything for The Town Mill is in/.test(t))).toBe(true);
    // Milling studied: the works start, and the camera goes to watch the wheel
    g.research.done.add('r_milling');
    g.events.length = 0;
    secs(g, 1.1);
    expect(g.flags.has('town_mill')).toBe(true);
    expect(g.events.some((e) => e.t === 'scene')).toBe(true);
  });
});

describe('the one path past the Mill (C1)', () => {
  it('finishing the Town Mill puts the Steam era first in the Now strip, not a side quest', () => {
    const g = new Game({ seed: 9 });
    const q = questSys(g);
    for (const id of ['k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town', 'k8_river', 'k9_bed', 'k9_power']) q.done.push(id);
    q.active = q.active.filter((a) => !q.done.includes(a.id));
    begin(g, 'k10_mill');
    secs(g, 1.1);
    g.flags.add('observed:town_mill');
    g.counters['made:mill'] = (g.counters['made:mill'] ?? 0) + 25;
    g.flags.add('validated:r_milling');
    g.research.done.add('r_power');
    g.research.done.add('r_milling');
    orders(g).filled.w_town_mill = 1;
    secs(g, 1.1);
    expect(q.done).toContain('k10_mill');
    expect(q.active.some((a) => a.id === 'k11_boiler')).toBe(true);
    expect(q.now(g, 1)[0].id).toBe('k11_boiler');
  });

  it('walks from k11 to k17: each step comes up in the Now strip in turn, and each quest hands over the next', () => {
    const g = new Game({ seed: 13 });
    const q = questSys(g);
    for (const id of ['k1_line', 'k2_springs', 'k3_hands', 'k4_grow', 'k5_desk', 'k6_bottleneck', 'k7_town', 'k8_river', 'k9_bed', 'k9_power', 'k10_mill']) q.done.push(id);
    q.active = q.active.filter((a) => !q.done.includes(a.id));
    for (const id of ['r_power', 'r_milling', 'r_woodworking', 'r_metallurgy', 'r_preserves', 'r_masonry']) g.research.done.add(id);
    g.flags.add('town_mill');
    orders(g).worksDone.push('w_town_mill');
    begin(g, 'k11_boiler');
    secs(g, 1.1);
    const os = orders(g);
    // what each step needs, done the way the game would see it
    const doStep = (id: string, i: number) => {
      const o = QUEST_BY_ID.get(id)!.objectives[i];
      switch (o.t) {
        case 'research': g.research.done.add(o.id); break;
        case 'made': q.notify(g, 'made', o.n, o.struct, { other: true, full: true }); break;
        case 'flag': g.flags.add(o.flag); break;
        case 'visit': { const l = g.map.locs.get(o.loc)!; g.player.x = l[0] + 0.5; g.player.y = l[1] + 0.5; break; }
        case 'order': os.filled[o.id] = 1; if (o.id === 'p_clock') g.flags.add('clock_fixed'); break;
        case 'stage': {
          const k = (RESEARCH_BY_ID.get(o.id)!.keystone)!;
          if (o.stage === 'observe') g.flags.add(k.observe!.flag);
          else if (o.stage === 'experiment') for (const e of k.experiment ?? []) { if (e.t === 'count') g.counters[e.key] = (g.counters[e.key] ?? 0) + e.n; }
          else g.flags.add('validated:' + o.id);
          break;
        }
        default: throw new Error(`no way to do ${o.t} in ${id}`);
      }
    };
    const chain = ['k11_boiler', 'k12_steam', 'k13_waterworks', 'k14_spark', 'k15_lamps', 'k16_tram', 'k17_clock'];
    for (const id of chain) {
      const def = QUEST_BY_ID.get(id)!;
      expect(q.active.some((a) => a.id === id), id).toBe(true);
      for (let i = 0; i < def.objectives.length; i++) {
        const now = q.now(g, 1)[0];
        expect(`${now.id}:${now.index}`, `${id} step ${i}`).toBe(`${id}:${i}`);
        doStep(id, i);
        secs(g, 1.1);
      }
      expect(q.done, id).toContain(id);
    }
  });

  it('every main quest after the Mill names a step, and every keystone order belongs to a main quest', () => {
    for (const id of ['k11_boiler', 'k12_steam', 'k13_waterworks', 'k14_spark', 'k15_lamps', 'k16_tram', 'k17_clock']) {
      const d = QUEST_BY_ID.get(id)!;
      expect(d.main).toBe(true);
      expect(d.objectives.length).toBeGreaterThan(0);
      for (const o of d.objectives) expect(o.label).toBeTruthy();
    }
    for (const id of ['w_town_mill', 'w_waterworks', 'w_lamps', 'w_tram', 'p_clock']) {
      expect([...QUEST_BY_ID.values()].some((d) => d.main && d.objectives.some((o) => o.t === 'order' && o.id === id))).toBe(true);
    }
  });
});

describe("the era you're in", () => {
  it("follows the town's keystones on the Keeper's Line, not the oldest unstudied topic", () => {
    const g = new Game({ seed: 14 });
    expect(g.flags.has('keepers_line')).toBe(true);
    expect(townEra(g)).toBe(1);
    g.flags.add('quest_done:k9_power');
    expect(townEra(g)).toBe(2);
    g.flags.add('town_mill');
    // Gleaning and the rest of Spring are still unstudied: the town is in the Steam era all the same
    expect(townEra(g)).toBe(3);
    g.flags.add('waterworks');
    expect(townEra(g)).toBe(3);
    g.flags.add('lamplighting');
    expect(townEra(g)).toBe(4);
    g.flags.add('tram');
    g.flags.add('clock_fixed');
    expect(townEra(g)).toBe(5);
  });
});

describe('the Works tab (M5)', () => {
  it("has no crop, fish, forage or gem baskets, opens works as their eras come, and keeps the Clock for after the Tram", () => {
    expect(PROJECTS.map((p) => p.id)).not.toEqual(expect.arrayContaining(['p_spring']));
    for (const id of ['p_spring', 'p_summer', 'p_fall', 'p_river', 'p_sea', 'p_lake', 'p_forage', 'p_mine']) expect(PROJECTS.some((p) => p.id === id)).toBe(false);
    const g = new Game({ seed: 10 });
    secs(g, 1.1);
    const works = () => orders(g).open.filter((o) => o.kind === 'works').map((o) => o.def);
    expect(works()).toEqual([]);
    g.flags.add('town_mill');
    secs(g, 1.1);
    expect(works()).toEqual(expect.arrayContaining(['p_gears', 'p_preserves']));
    expect(works()).not.toContain('p_clock');
    g.flags.add('tram');
    secs(g, 1.1);
    expect(works()).toContain('p_clock');
  });

  it('a standing order waits for the know-how that makes its goods', () => {
    expect(STANDING_BY_ID.get('rowan_cheese')!.after).toContain('r_dairy');
    expect(STANDING_BY_ID.get('rowan_soup')!.after).toContain('r_cooking');
    expect(STANDING_BY_ID.get('mari_cloth')!.after).toContain('r_weaving');
    expect(STANDING_BY_ID.get('juniper_paste')!.after).toContain('r_pastes');
  });
});

describe('goods and their makers (M1, M3, M4)', () => {
  it("bread bakes from barley meal; shop bread costs more than Rowan's order pays", () => {
    const bread = RECIPES.find((r) => r.id === 'cook:bread')!;
    expect(matchesSpec(ITEM_BY_ID.get('barley_flour')!, bread.in[0].item)).toBe(true);
    for (const shop of ['general', 'inn']) {
      const e = SHOP_BY_ID.get(shop)!.stock.find((s) => s.item === 'bread')!;
      expect(e.price).toBeGreaterThan(STANDING_BY_ID.get('rowan_bread')!.unit);
    }
  });

  it('oil is pressed, not bought; beams come from a sawmill; a Harvest Bundle can come from the works', () => {
    expect(SHOP_BY_ID.get('general')!.stock.some((s) => s.item === 'oil')).toBe(false);
    expect(RECIPES.some((r) => r.station === 'hand' && r.out.some((o) => o.item === 'beam'))).toBe(false);
    expect(RECIPES.some((r) => r.station === 'sawmill' && r.out.some((o) => o.item === 'beam'))).toBe(true);
    const works = RECIPES.find((r) => r.id === 'hand:bundle_rose_works')!;
    expect(works.in.map((i) => i.item)).toEqual(['#preserve', 'canvas', 'copper_coil']);
  });

  it("paste and pigment are worth what goes in, and starch paste has customers", () => {
    for (const r of RECIPES.filter((x) => x.station === 'jar' && (x.out[0].item === 'starch_paste' || x.out[0].item === 'pigment'))) {
      const inV = r.in.reduce((a, i) => a + (ITEM_BY_ID.get(i.item)?.price ?? 0) * i.n, 0);
      const outV = (ITEM_BY_ID.get(r.out[0].item)!.price) * r.out[0].n;
      expect(outV, r.id).toBeGreaterThanOrEqual(inV);
    }
    expect(STANDING_BY_ID.get('juniper_paste')!.spec).toBe('starch_paste');
  });

  it('the tram carries bars too: a smelting line beats tipping ore in', () => {
    const g = new Game({ seed: 12 });
    g.flags.add('tram');
    secs(g, 1.1);
    const bin = tramBin(g)!;
    bin.inv!.add(key('iron_bar'), 12);
    bin.inv!.add(key('copper_ore'), 12);
    const r = tramRun(g);
    expect(r.n).toBe(20);
    expect(bin.inv!.countId('iron_bar') + bin.inv!.countId('copper_ore')).toBe(4);
  });
});

describe("the critic's re-check of Phases 3+4", () => {
  it('a loaded save shows no news from its first morning: no orders posted again, no quests started again, no lesson cards', () => {
    const g = new Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    for (let d = 0; d < 5; d++) bot.playDay();
    const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    const news = g2.events.filter((e) => e.t === 'lesson' || (e.t === 'toast' && /posted an order|New quest/.test((e as { text: string }).text)));
    expect(news).toEqual([]);
    expect(questSys(g2).active.map((a) => a.id)).toEqual(questSys(g).active.map((a) => a.id));
  }, 120000);

  it("the next town keystone is on the Works tab from the era's first quest: the Waterworks with k11, Lamplighting with k14", () => {
    const g = new Game({ seed: 15 });
    secs(g, 1.1);
    expect(openOrder(g, 'w_waterworks')).toBeNull();
    begin(g, 'k11_boiler');
    secs(g, 1.1);
    expect(openOrder(g, 'w_waterworks')).toBeTruthy();
    // and k11's first step is to go and look at it
    const now = q11(g);
    expect(now.text).toMatch(/pump house/);
    expect(now.title).toBe('Down to the Boiler');
    expect(now.steps).toBe(QUEST_BY_ID.get('k11_boiler')!.objectives.length);
    expect(openOrder(g, 'w_lamps')).toBeNull();
    begin(g, 'k14_spark');
    secs(g, 1.1);
    expect(openOrder(g, 'w_lamps')).toBeTruthy();
  });

  it("any oil fills the Waterworks: the crock's cogbean oil counts, so it needn't wait for summer's sunflowers", () => {
    const g = new Game({ seed: 16 });
    begin(g, 'k11_boiler');
    secs(g, 1.1);
    const o = openOrder(g, 'w_waterworks')!;
    const oil = o.lines.find((l) => l.spec === '#oil')!;
    expect(oil.n).toBe(50);
    g.player.inv.add(key('cogbean_oil'), 30);
    g.player.inv.add(key('oil'), 20);
    boardHandIn(g, o);
    expect(oil.have).toBe(50);
  });

  it('the Guild asks for bread only once the town has flour and you have an oven, as standing orders wait', () => {
    const g = new Game({ seed: 18 });
    const asked = new Set<string>();
    for (let i = 0; i < 60; i++) {
      postContracts(g);
      for (const o of orders(g).open) if (o.kind === 'guild') asked.add(o.def);
    }
    expect(asked.has('c_bread')).toBe(false);
    expect(asked.size).toBeGreaterThan(3);
    g.flags.add('town_mill');
    g.research.done.add('r_cooking');
    for (let i = 0; i < 60 && !asked.has('c_bread'); i++) {
      postContracts(g);
      for (const o of orders(g).open) if (o.kind === 'guild') asked.add(o.def);
    }
    expect(asked.has('c_bread')).toBe(true);
  });

  it('a saved quest whose steps changed since loads with its progress sized to the steps it has now', () => {
    const g = new Game({ seed: 17 });
    const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
    const d = JSON.parse(JSON.stringify(serialize(g, look)));
    d.sys.quests.active.push({ id: 'k11_boiler', prog: [0, 4, 0, 0], day: 3 });
    const g2 = deserialize(d).game;
    const a = questSys(g2).active.find((x) => x.id === 'k11_boiler')!;
    expect(a.prog).toHaveLength(QUEST_BY_ID.get('k11_boiler')!.objectives.length);
    expect(a.prog.every((n) => Number.isFinite(n))).toBe(true);
  });
});
