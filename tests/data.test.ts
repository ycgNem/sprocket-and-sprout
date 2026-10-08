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
      if (['construction_site', 'shipping_crate'].includes(s.id)) continue;
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
