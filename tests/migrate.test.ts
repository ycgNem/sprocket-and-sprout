// Save v5 (ROADMAP.md Phase 3/4 build spec): real saves from before the one Orders board load,
// keep what they had, play on, and save and load again. Fixtures: three 1.1.1 saves from the
// pre-merge review and two 2.0 beta saves from the bot (seed 2024, days 5 and 8), gzipped.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import '../src/sim';
import { deserialize, migrateV5, serialize, SAVE_VERSION } from '../src/sim/save';
import { orders } from '../src/sim/systems/orders';
import { PRUNED_IDS } from '../src/data/research';

const load = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))).toString('utf8'));
const FIXTURES = ['save111_story_d12_factory', 'save111_wildwood_d25', 'save111_everything', 'beta20_bot2024_day5', 'beta20_bot2024_day8'];

describe('save v5 migration', () => {
  for (const name of FIXTURES) {
    it(`${name}: loads, plays on, saves and loads again`, () => {
      const raw = load(name);
      const { game: g, look } = deserialize(structuredClone(raw));
      const os = orders(g);
      // the old state is gone from its old homes
      expect(g.sys.guild).toBeUndefined();
      expect((g.sys.goals as any).projects).toBeUndefined();
      expect((g.sys.quests as any).requests).toBeUndefined();
      // every order on the board is well formed
      for (const o of os.open) {
        expect(['today', 'standing', 'guild', 'works']).toContain(o.kind);
        expect(o.lines.length).toBeGreaterThan(0);
        for (const l of o.lines) expect(l.have).toBeLessThanOrEqual(l.n);
      }
      // the projects are on the Works tab
      expect(os.open.filter((o) => o.kind === 'works').length).toBeGreaterThanOrEqual(14);
      // a 1.1.1 save that had the Guild keeps it, with its contracts
      if (raw.sys.contracts?.unlocked) {
        expect(os.guild.unlocked).toBe(true);
        expect(os.open.filter((o) => o.kind === 'guild').length).toBe(raw.sys.contracts.list.length);
      }
      // the 2.0 beta's standing orders keep their place and their customers
      for (const o of raw.sys.orders?.open ?? []) expect(os.open.some((x) => x.kind === 'standing' && x.def === o.id)).toBe(true);
      expect(os.rep.rowan ?? 0).toBe(raw.sys.orders?.rep?.rowan ?? 0);
      // no retired research topic is "done"; its bonus is an era reward
      for (const id of g.research.done) expect(PRUNED_IDS.has(id)).toBe(false);
      for (const id of raw.research.done) if (PRUNED_IDS.has(id)) expect(g.research.rewards.has(id)).toBe(true);
      // play on a little, then round-trip
      for (let i = 0; i < 60 * 60; i++) g.tick();
      const again = deserialize(JSON.parse(JSON.stringify(serialize(g, look))));
      expect(again.game.sys.orders.open.length).toBe(orders(g).open.length);
      expect(JSON.stringify(serialize(again.game, look).sys.orders)).toBe(JSON.stringify(serialize(g, look).sys.orders));
    }, 60000);
  }

  it('moves an accepted request, project progress, the Guild rank and the mine onto v5', () => {
    const raw = load('save111_wildwood_d25');
    raw.sys.goals.projects = { p_spring: { tulip: 3, radish: 10 } };
    raw.sys.goals.doneProjects = ['p_river'];
    raw.sys.quests.current = 0;
    raw.sys.contracts.rep = 6;
    raw.research.done.push('r_lab_speed', 'r_tuning1');
    raw.research.current = 'r_market';
    raw.sys.mine = { deepest: 47 };
    raw.flags.push('elev_25', 'elev_45', 'treasure_10', 'treasure_20', 'treasure_40', 'treasure_50');
    let d = structuredClone(raw);
    while (d.v < 4) d = { ...d, v: d.v + 1 };
    d = migrateV5(d);
    expect(d.v).toBe(5);
    expect(SAVE_VERSION).toBe(5);
    const os = d.sys.orders;
    const spring = os.open.find((o: any) => o.def === 'p_spring');
    expect(spring.lines.find((l: any) => l.spec === 'tulip').have).toBe(3);
    expect(spring.lines.find((l: any) => l.spec === 'radish').have).toBe(10);
    expect(os.worksDone).toEqual(['p_river']);
    expect(os.open.find((o: any) => o.def === 'p_river')).toBeUndefined();
    const today = os.open.find((o: any) => o.kind === 'today');
    expect(today.cust).toBe(raw.sys.quests.requests[0].npc);
    expect(today.pay).toBe(raw.sys.quests.requests[0].reward);
    expect(os.rep.guild).toBe(6);
    expect(d.research.rewards).toEqual(expect.arrayContaining(['r_lab_speed', 'r_tuning1']));
    expect(d.research.done).not.toContain('r_lab_speed');
    expect(d.research.current).toBeNull();
    expect(d.sys.mine.deepest).toBe(24);
    expect(d.flags).toEqual(expect.arrayContaining(['elev_5', 'elev_15', 'elev_25', 'chamber:lift', 'bread_town']));
    expect(d.flags).not.toContain('elev_45');
    // the grand chests of floors 20 and 40 are the ones on levels 10 and 20
    expect(d.flags).toEqual(expect.arrayContaining(['treasure_10', 'treasure_20']));
    for (const f of ['treasure_30', 'treasure_40', 'treasure_50']) expect(d.flags).not.toContain(f);
  });
});
