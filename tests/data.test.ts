import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { RESEARCH, RESEARCH_BY_ID } from '../src/data/research';
import { STRUCTURES } from '../src/data/structures';
import { CROPS } from '../src/data/crops';
import { FISH } from '../src/data/fish';
import { NPCS } from '../src/data/npcs';
import { SHOPS, BUILDING_KITS } from '../src/data/shops';
import { QUESTS, PROJECTS, MEGAPROJECTS, FESTIVALS, REQUEST_POOL } from '../src/data/goals';
import { ANIMALS, MONSTERS } from '../src/data/creatures';
import { generateWorld } from '../src/sim/world/worldgen';

const specOk = (s: string) => (s[0] === '#' ? ITEMS.some((d) => matchesSpec(d, s)) : ITEM_BY_ID.has(s));

describe('content data', () => {
  it('has the required breadth', () => {
    expect(CROPS.length).toBeGreaterThanOrEqual(30);
    expect(RESEARCH.length).toBeGreaterThanOrEqual(40);
    expect(NPCS.length).toBeGreaterThanOrEqual(10);
    expect(FISH.filter((f) => !f.trap).length).toBeGreaterThanOrEqual(20);
    expect(ANIMALS.length).toBeGreaterThanOrEqual(6);
    expect(FESTIVALS.map((f) => f.season).sort()).toEqual([0, 1, 2, 3]);
    expect(CROPS.filter((c) => c.regrow).length).toBeGreaterThanOrEqual(8);
    expect(CROPS.filter((c) => c.giant).length).toBeGreaterThanOrEqual(3);
  });

  it('every recipe references real items', () => {
    for (const r of RECIPES) {
      for (const i of r.in) expect(specOk(i.item), `${r.id} input ${i.item}`).toBe(true);
      for (const o of r.out) expect(ITEM_BY_ID.has(o.item), `${r.id} output ${o.item}`).toBe(true);
      if (r.unlock && r.unlock.startsWith('r_')) expect(RESEARCH_BY_ID.has(r.unlock), `${r.id} unlock ${r.unlock}`).toBe(true);
    }
  });

  it('recipe ids are unique', () => {
    const ids = new Set<string>();
    for (const r of RECIPES) {
      expect(ids.has(r.id), r.id).toBe(false);
      ids.add(r.id);
    }
  });

  it('research tree is acyclic, prereqs exist, costs are consistent', () => {
    for (const r of RESEARCH) {
      for (const p of r.prereq) expect(RESEARCH_BY_ID.has(p), `${r.id} prereq ${p}`).toBe(true);
      const ns = new Set(r.cost.map((c) => c.n));
      expect(ns.size).toBe(1);
      for (const c of r.cost) expect(ITEM_BY_ID.get(c.item)?.cat).toBe('research');
      expect(ITEM_BY_ID.has(r.icon), r.icon).toBe(true);
    }
    const seen = new Set<string>();
    const visiting = new Set<string>();
    const dfs = (id: string) => {
      if (seen.has(id)) return;
      expect(visiting.has(id), 'cycle at ' + id).toBe(false);
      visiting.add(id);
      for (const p of RESEARCH_BY_ID.get(id)!.prereq) dfs(p);
      visiting.delete(id);
      seen.add(id);
    };
    for (const r of RESEARCH) dfs(r.id);
  });

  it('every structure is craftable or purchasable', () => {
    const craftable = new Set(RECIPES.map((r) => r.out[0].item));
    const sold = new Set([...SHOPS.flatMap((s) => s.stock.map((e) => e.item)), ...BUILDING_KITS.map((k) => k.id)]);
    for (const s of STRUCTURES) {
      if (['construction_site', 'shipping_crate', 'tram_bin'].includes(s.id)) continue;
      expect(craftable.has(s.item) || sold.has(s.item) || s.kind === 'building', s.id).toBe(true);
    }
  });

  it('shops, quests, projects and NPC gifts reference real items', () => {
    for (const s of SHOPS) for (const e of s.stock) expect(ITEM_BY_ID.has(e.item), `${s.id}:${e.item}`).toBe(true);
    for (const q of QUESTS) {
      for (const o of q.objectives) if ('item' in o && o.item) expect(specOk(o.item), `${q.id}:${o.item}`).toBe(true);
      for (const it of q.reward.items ?? []) expect(ITEM_BY_ID.has(it.item), `${q.id} reward ${it.item}`).toBe(true);
      for (const a of q.after ?? []) expect(QUESTS.some((x) => x.id === a), `${q.id} after ${a}`).toBe(true);
    }
    for (const p of PROJECTS) for (const it of p.items) expect(specOk(it.item), `${p.id}:${it.item}`).toBe(true);
    for (const m of MEGAPROJECTS) for (const st of m.stages) for (const it of st.items) expect(specOk(it.item), `${m.id}:${it.item}`).toBe(true);
    for (const r of REQUEST_POOL) expect(ITEM_BY_ID.has(r.item), r.item).toBe(true);
    for (const n of NPCS) for (const list of Object.values(n.gifts)) for (const s of list) expect(specOk(s), `${n.id} gift ${s}`).toBe(true);
    for (const mo of MONSTERS) for (const d of mo.drops) expect(ITEM_BY_ID.has(d.item), d.item).toBe(true);
    for (const a of ANIMALS) expect(ITEM_BY_ID.has(a.product)).toBe(true);
  });

  it('NPC schedule locations exist in the generated world', () => {
    const m = generateWorld(1);
    for (const n of NPCS) {
      for (const s of n.schedules) for (const [, loc] of s.at) expect(m.locs.has(loc), `${n.id} -> ${loc}`).toBe(true);
      for (const e of n.heartEvents) expect(m.locs.has(e.loc), `${n.id} event ${e.loc}`).toBe(true);
    }
    for (const s of SHOPS) expect(m.locs.has(s.loc), s.loc).toBe(true);
  });
});

describe('one name for the Professor (DECISIONS #55)', () => {
  it('no quest title, text, hint or objective says "Ottoline"', async () => {
    const { Game } = await import('../src/sim/Game');
    await import('../src/sim');
    const { objText } = await import('../src/sim/systems/quests');
    const g = new Game({ seed: 1 });
    for (const q of QUESTS) {
      for (const s of [q.title, q.desc, q.hint ?? '']) expect(s, q.id).not.toMatch(/Ottoline/);
      for (const o of q.objectives) expect(objText(g, o, 0), q.id).not.toMatch(/Ottoline/);
    }
  });
});

describe('the machine contract (ROADMAP.md 4.1)', () => {
  it('every structure that handles items declares what it takes, gives and holds', async () => {
    const { ioOf, PORT_KINDS } = await import('../src/data/contract');
    for (const s of STRUCTURES) {
      if (!PORT_KINDS.includes(s.kind)) continue;
      const io = ioOf(s);
      expect(io, s.id).toBeTruthy();
      expect(io!.note.length, s.id).toBeGreaterThan(5);
      if (s.kind === 'machine') {
        expect(Array.isArray(io!.in) && io!.in.length, s.id).toBeTruthy();
        expect(Array.isArray(io!.out) && io!.out.length, s.id).toBeTruthy();
        expect(io!.time, s.id).toBeTruthy();
      }
    }
  });

  it('every advice case fills without leftover placeholders', async () => {
    const { ADVICE, adviceText } = await import('../src/data/advice');
    const vars = { name: 'jar', pct: 50, item: 'cogbeans', src: 'chest', dst: 'crate', need: 40, n: 2, s: 's', have: 4, can: 17, more: 26, crop: 'cogbean' };
    for (const k of Object.keys(ADVICE)) {
      const t = adviceText(k, vars);
      expect(t.gap, k).not.toMatch(/\{|\}/);
      expect(t.fix, k).not.toMatch(/\{|\}/);
    }
  });
});

describe('item indices (saves from 1.1.1)', () => {
  it("every 1.1.1 item keeps its index; newer items come after them", async () => {
    // a blueprint ghost's arm and splitter filters are saved as raw item keys (index * 4 + quality)
    const { ITEMS_AFTER_1_1 } = await import('../src/data/items');
    const old = ITEMS.slice(0, ITEMS.length - ITEMS_AFTER_1_1.length).map((d) => d.id);
    expect(old.length).toBe(533);
    expect(ITEMS.slice(old.length).map((d) => d.id)).toEqual(ITEMS_AFTER_1_1);
    // FNV-1a of the 1.1.1 id list, in order: an item inserted mid-list changes it (add new items to ITEMS_AFTER_1_1)
    let h = 0x811c9dc5;
    for (const c of new TextEncoder().encode(old.join(','))) h = Math.imul(h ^ c, 0x01000193) >>> 0;
    expect(h).toBe(0x560de8);
  });
});

describe('orders and keystones (Phase 3)', () => {
  const cond = async () => {
    const { STRUCT_BY_ID } = await import('../src/data/structures');
    const { BUSINESS_BY_ID } = await import('../src/data/orders');
    return (c: string) => {
      if (c.startsWith('flag:')) return c.length > 5;
      if (c.startsWith('quest:') || c.startsWith('on:')) return QUESTS.some((q) => q.id === c.slice(c.indexOf(':') + 1));
      if (c.startsWith('rep:')) {
        const [, biz, r] = c.split(':');
        return BUSINESS_BY_ID.has(biz) && Number(r) >= 0 && Number(r) <= 5;
      }
      if (c.startsWith('made:')) return STRUCT_BY_ID.has(c.slice(5));
      if (c.startsWith('crafted:')) return ITEM_BY_ID.has(c.slice(8));
      return RESEARCH_BY_ID.has(c);
    };
  };

  it('every standing order names a business, a real item, its pay and words; ids are unique', async () => {
    const { STANDING, BUSINESS_BY_ID, REP_RANKS } = await import('../src/data/orders');
    const ok = await cond();
    const ids = new Set<string>();
    for (const s of STANDING) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(BUSINESS_BY_ID.has(s.biz), `${s.id} biz`).toBe(true);
      expect(specOk(s.spec), `${s.id} spec ${s.spec}`).toBe(true);
      expect(s.n, s.id).toBeGreaterThan(0);
      expect(s.unit > 0 || !!s.reward, `${s.id} pays`).toBe(true);
      expect(s.rank ?? 0, s.id).toBeLessThan(REP_RANKS.length);
      for (const c of s.after ?? []) expect(ok(c), `${s.id} after ${c}`).toBe(true);
      for (const it of s.reward?.items ?? []) expect(ITEM_BY_ID.has(it.item), `${s.id} reward ${it.item}`).toBe(true);
      expect(s.text.length && s.thanks.length, s.id).toBeTruthy();
      // an order pays at least what the market would (orders never saturate it, and ask more of you)
      if (s.unit && s.spec[0] !== '#') expect(s.unit, `${s.id} pays over market`).toBeGreaterThanOrEqual(ITEM_BY_ID.get(s.spec)!.price);
    }
    // every business but the Guild and the Council has a first order and one for each of the next three ranks
    for (const b of ['rowan', 'bram', 'juniper', 'ottoline', 'ines', 'wren', 'marigold', 'clem', 'roxy'])
      for (const r of [0, 1, 2, 3]) expect(STANDING.some((s) => s.biz === b && (s.rank ?? 0) === r), `${b} rank ${r}`).toBe(true);
  });

  it('every keystone works order and project asks for real items; keystones wait on real things and set a flag', async () => {
    const { KEYSTONE_WORKS } = await import('../src/data/orders');
    const ok = await cond();
    for (const k of KEYSTONE_WORKS) {
      for (const i of k.items) expect(specOk(i.item), `${k.id} ${i.item}`).toBe(true);
      for (const c of k.after) expect(ok(c), `${k.id} after ${c}`).toBe(true);
      expect(k.flag, k.id).toBeTruthy();
      expect(k.era, k.id).toBeGreaterThanOrEqual(2);
    }
    for (const p of PROJECTS) for (const i of p.items) expect(specOk(i.item), `${p.id} ${i.item}`).toBe(true);
    for (const r of REQUEST_POOL) expect(ITEM_BY_ID.has(r.item) && NPCS.some((n) => n.id === r.npc), `${r.npc} ${r.item}`).toBe(true);
    const { CONTRACT_POOL } = await import('../src/data/contracts');
    for (const c of CONTRACT_POOL) expect(specOk(c.spec), c.id).toBe(true);
  });

  it('every research keystone has stages that can happen: a flag to look, real counters to try, a real item to hold', async () => {
    const ok = await cond();
    const keys = RESEARCH.filter((r) => r.keystone);
    expect(keys.map((r) => r.id).sort()).toEqual(['r_assembly2', 'r_belts', 'r_bots', 'r_grandworks', 'r_milling', 'r_power', 'r_spark', 'r_steam']);
    for (const r of keys) {
      const k = r.keystone!;
      expect(k.observe?.flag.startsWith('observed:'), `${r.id} observe`).toBe(true);
      for (const o of k.experiment ?? []) {
        if (o.t === 'count') expect(ok(o.key), `${r.id} ${o.key}`).toBe(true);
        expect(o.label, r.id).toBeTruthy();
      }
      if (k.validate) {
        expect(specOk(k.validate.item), `${r.id} validate ${k.validate.item}`).toBe(true);
        expect(k.validate.perMin, r.id).toBeGreaterThan(0);
        expect(k.validate.minutes, r.id).toBeGreaterThan(0);
      }
    }
    // every era has bands with nodes, and only its own bundles or fewer
    for (const r of RESEARCH) expect(r.era, r.id).toBeGreaterThanOrEqual(1);
  });

  it("shop entries opened by reputation name a business and a rank", async () => {
    const ok = await cond();
    for (const s of SHOPS) for (const e of s.stock) if (e.unlock?.startsWith('rep:')) expect(ok(e.unlock), `${s.id} ${e.item} ${e.unlock}`).toBe(true);
  });
});
