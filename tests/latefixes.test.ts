// The late game's dead ends (2.1.1): the Prism Shard the Starlight Beacon asks for comes from the
// bottom of the Deepworks, Master Angler counts the shellfish a trap brings up, the last quest asks
// for all three grand works, and every item the game asks for has somewhere to come from.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { key, kId } from '../src/sim/inventory';
import { O } from '../src/sim/world/tilemap';
import { MAX_FLOOR, mine } from '../src/sim/systems/mine';
import { dropsState } from '../src/sim/systems/drops';
import { ACHIEVEMENTS } from '../src/sim/systems/achievements';
import { applyMega, goals } from '../src/sim/systems/goals';
import { FISH } from '../src/data/fish';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { SHOPS, BUILDING_KITS, HOME_UPGRADES } from '../src/data/shops';
import { CROPS } from '../src/data/crops';
import { TREES } from '../src/data/trees';
import { ANIMALS, MONSTERS } from '../src/data/creatures';
import { QUESTS, PROJECTS, MEGAPROJECTS, REQUEST_POOL, TOKEN_SHOP } from '../src/data/goals';
import { STANDING, KEYSTONE_WORKS } from '../src/data/orders';
import { CONTRACT_POOL } from '../src/data/contracts';
import { RESEARCH } from '../src/data/research';
import { CHAMBERS } from '../src/data/deepworks';
import { EXPORT_PORTS } from '../src/data/exports';
import { SOURCE } from '../src/data/sources';

/** break the bottom's starstone and pick up what it dropped */
function breakStar(g: Game) {
  const st = mine(g);
  st.looted = { day: -1, got: [] };
  st.enter(g, MAX_FLOOR);
  const m = st.map!;
  const i = m.obj.findIndex((o, j) => o === O.GEM_ROCK && m.objData[j] === 6);
  expect(i).toBeGreaterThanOrEqual(0);
  st.monsters = [];
  const before = dropsState(g).list.length;
  for (let k = 0; k < 20 && m.obj[i] === O.GEM_ROCK; k++) st.useTool(g, 'pick', 4, i % m.w, Math.floor(i / m.w));
  const got = dropsState(g).list.slice(before).map((d) => kId(d.k));
  st.leave(g);
  return got;
}

describe('the late game has no dead ends', () => {
  it("the first starstone broken at the bottom of the Deepworks holds a Prism Shard; later ones now and then", () => {
    const g = new Game({ seed: 7 });
    const first = breakStar(g);
    expect(first).toContain('starstone');
    expect(first).toContain('prism_shard');
    expect(g.flags.has('prism_found')).toBe(true);
    let more = 0;
    for (let d = 0; d < 60; d++) if (breakStar(g).includes('prism_shard')) more++;
    // about one in ten after the first
    expect(more).toBeGreaterThan(0);
    expect(more).toBeLessThan(20);
    expect(SOURCE.prism_shard).toMatch(/level 30/);
  });

  it('Master Angler counts the shellfish a fish trap brings up (they never bite a line)', () => {
    const g = new Game({ seed: 3 });
    const angler = ACHIEVEMENTS.find((a) => a.id === 'fish_all')!;
    for (const f of FISH) if (!f.legendary && !f.trap) g.counters['caught_' + f.id] = 1;
    expect(angler.test!(g)).toBe(false);
    for (const f of FISH) if (f.trap) g.stats.add(key(f.id), 1);
    expect(angler.test!(g)).toBe(true);
  });

  it('the last quest asks for all three grand works, and older farms count the ones they finished', () => {
    const q = QUESTS.find((x) => x.id === 's_wonders')!;
    expect(q.after).toEqual(['s_grand']);
    const flags = q.objectives.map((o) => (o as { flag: string }).flag);
    expect(flags.sort()).toEqual(MEGAPROJECTS.map((m) => 'wonder:' + m.id).sort());
    const g = new Game({ seed: 3 });
    goals(g).mega.push('m_orrery', 'm_beacon');
    applyMega(g);
    expect(g.flags.has('wonder:m_orrery') && g.flags.has('wonder:m_beacon')).toBe(true);
    expect(g.flags.has('wonder:m_skyship')).toBe(false);
    const three = ACHIEVEMENTS.find((a) => a.id === 'mega3')!;
    expect(three.test!(g)).toBe(false);
    goals(g).mega.push('m_skyship');
    expect(three.test!(g)).toBe(true);
  });

  it('every item a project, quest, order, research, recipe or export asks for has a source', () => {
    const have = new Set<string>();
    const add = (id?: string) => { if (id && ITEM_BY_ID.has(id)) have.add(id); };
    for (const s of SHOPS) for (const e of s.stock) add(e.item);
    for (const t of TOKEN_SHOP) add(t.item);
    for (const a of ANIMALS) { add(a.product); add(a.deluxe); }
    for (const m of MONSTERS) for (const d of m.drops) add(d.item);
    for (const f of FISH) add(f.id);
    for (const q of QUESTS) for (const s of q.reward.items ?? []) add(s.item);
    for (const p of PROJECTS) for (const s of p.reward.items ?? []) add(s.item);
    for (const t of TREES) if (t.wild) { add(t.sapling); add(t.tap); }
    // drops, forage, finds and letters name their items in the simulation's code
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/['"`]([a-z0-9_]+)['"`]/g)) add(m[1]);
      }
    };
    walk(path.join(__dirname, '../src/sim'));
    const ok = (spec: string) => (spec[0] === '#' ? [...have].some((id) => matchesSpec(ITEM_BY_ID.get(id)!, spec)) : have.has(spec));
    for (let pass = 0; pass < 50; pass++) {
      const n0 = have.size;
      for (const c of CROPS) { if (have.has(c.seed)) add(c.produce ?? c.id); if (have.has(c.produce ?? c.id)) add(c.seed); }
      for (const t of TREES) if (have.has(t.sapling)) { add(t.fruit); add(t.tap); }
      for (const r of RECIPES) if (r.in.every((s) => ok(s.item))) for (const o of r.out) add(o.item);
      if (have.size === n0) break;
    }
    const asks: [string, string][] = [];
    for (const p of PROJECTS) for (const s of p.items) asks.push([s.item, p.id]);
    for (const m of MEGAPROJECTS) for (const st of m.stages) for (const s of st.items) asks.push([s.item, `${m.id} ${st.name}`]);
    for (const q of QUESTS) for (const o of q.objectives as { t: string; item?: string }[]) if (o.item && ['have', 'deliver', 'ship', 'craft'].includes(o.t)) asks.push([o.item, q.id]);
    for (const r of REQUEST_POOL) asks.push([r.item, 'request ' + r.npc]);
    for (const s of STANDING) asks.push([s.spec, s.id]);
    for (const k of KEYSTONE_WORKS) for (const s of k.items) asks.push([s.item, k.id]);
    for (const c of CONTRACT_POOL) asks.push([c.spec, c.id]);
    for (const r of RESEARCH) for (const s of r.cost) asks.push([s.item, r.id]);
    for (const c of CHAMBERS) for (const [id] of c.restore?.parts ?? []) asks.push([id, 'chamber ' + c.kind]);
    for (const p of EXPORT_PORTS) for (const id of p.wants) asks.push([id, 'export ' + p.id]);
    for (const b of BUILDING_KITS) for (const s of b.materials) asks.push([s.item, b.id]);
    for (const h of HOME_UPGRADES) for (const s of h.materials) asks.push([s.item, h.id]);
    for (const r of RECIPES) for (const s of r.in) asks.push([s.item, r.id]);
    const missing = asks.filter(([spec]) => !ok(spec)).map(([spec, by]) => `${spec} (${by})`);
    expect(missing).toEqual([]);
    expect(have.size).toBeGreaterThan(ITEMS.length * 0.8);
  });
});
