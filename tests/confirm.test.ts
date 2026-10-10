// The critic's confirmation pass of the owner's playtest changes, and the owner's notes before the
// 2.0 beta: "Load which?" puts coal before wood and a hand fuel load is ten minutes of burn, a better
// fuel takes a worse one's place, a collect never opens the chooser, hand loads are about ten
// minutes' work (a sawmill 150 wood, the owner: "make it a reasonable amount"), the hamster's wheel
// gives the machines by its cage an hour's more work on the night shift, palms take turns, and the
// pets come with a small early quest ("Housewarming"), not on the first morning.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import '../src/sim';
import { DAY_END, Game } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { interactStruct, loadChoices, loadChosen } from '../src/sim/actions';
import { handBatches, handFuel, machAccept, machInsert, WHEEL_BOOST } from '../src/sim/systems/machines';
import { RECIPES } from '../src/data/recipes';
import { QUEST_BY_ID } from '../src/data/goals';
import { SHOP_BY_ID } from '../src/data/shops';
import { questSys } from '../src/sim/systems/quests';
import * as H from '../src/sim/systems/house';
import { FURN_BY_ID } from '../src/data/furniture';
import { canPlaceIndoors, placeIndoors } from '../src/sim/indoors';
import { CAGE, cageOf, hamsterSys, nameHamster, WHEEL_REACH } from '../src/sim/systems/hamster';
import { palmSets } from '../src/sim/systems/farming';
import { deserialize } from '../src/sim/save';
import type { Ent } from '../src/sim/ents';

const run = (g: Game, sec: number) => { for (let i = 0; i < sec * 60; i++) g.tick(); };
function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

/** a structure on open farm ground near the farmhouse */
function place(g: Game, id: string): Ent {
  const [hx, hy] = g.map.loc('farmhouse');
  for (let r = 3; r < 30; r++)
    for (let y = hy + 2; y < hy + 2 + r; y++)
      for (let x = hx - r; x < hx + r; x++) {
        let ok = true;
        for (let dy = 0; dy < 2 && ok; dy++) for (let dx = 0; dx < 2 && ok; dx++) ok = g.map.walkable(x + dx, y + dy) && !g.ents.at(x + dx, y + dy) && !g.map.obj[g.map.idx(x + dx, y + dy)];
        if (ok) return g.ents.add(id, x, y, 0);
      }
  throw new Error('no room for ' + id);
}

describe('hand loads (the owner: "how much wood can you put in a sawmill")', () => {
  it('is about ten minutes of work: a sawmill 150 wood, a furnace still 150 ore, never fewer than before', () => {
    const saw = RECIPES.find((r) => r.station === 'sawmill' && r.in[0].item === 'wood')!;
    expect(saw.in[0].n * handBatches(saw)).toBe(150);
    const bar = RECIPES.find((r) => r.station === 'smelter' && r.in.some((i) => i.item === 'copper_ore'))!;
    expect(bar.in[0].n * handBatches(bar)).toBe(150);
    for (const r of RECIPES) {
      if (!r.station || r.station === 'hand' || !r.in.length) continue;
      expect(handBatches(r)).toBeGreaterThanOrEqual(Math.max(10, Math.min(50, Math.ceil(600 / Math.max(1, r.time)))));
    }
    const g = new Game({ seed: 3 });
    const e = place(g, 'sawmill');
    g.player.inv.add(key('wood'), 400);
    expect(machAccept(g, e, key('wood'), true)).toBe(150);
    expect(loadChosen(g, e, key('wood'))).toBe(150);
    expect(g.player.inv.countId('wood')).toBe(250);
  });
});

describe('fuel by hand (the critic: the chooser burned 40 wood with coal in the bag)', () => {
  it('coal comes first, fuel lines say how many go in, a hand load is ten minutes of burn', () => {
    const g = new Game({ seed: 4 });
    const f = place(g, 'furnace');
    g.player.inv.add(key('wood'), 40);
    g.player.inv.add(key('coal'), 30);
    g.player.inv.add(key('copper_ore'), 200);
    const first = loadChoices(g, f);
    expect(first[0].k).toBe(key('copper_ore'));
    const fuels = first.filter((c) => c.fuel).map((c) => c.k);
    expect(fuels).toEqual([key('coal'), key('wood')]);
    expect(loadChosen(g, f, key('copper_ore'))).toBe(150);
    // ore in, no fuel: the best fuel leads now, and takes 15 (about 600 s of burn)
    const next = loadChoices(g, f);
    expect(next[0].k).toBe(key('coal'));
    expect(next[0].takes).toBe(handFuel(key('coal')));
    expect(handFuel(key('coal'))).toBe(15);
    expect(handFuel(key('wood'))).toBe(75);
    expect(loadChosen(g, f, key('coal'))).toBe(15);
    expect(g.player.inv.countId('coal')).toBe(15);
  });

  it('a better fuel by hand takes a worse one\'s place (the worse back in the bag); an arm only tops up', () => {
    const g = new Game({ seed: 5 });
    const f = place(g, 'furnace');
    g.player.inv.add(key('wood'), 40);
    g.player.inv.add(key('coal'), 5);
    expect(loadChosen(g, f, key('wood'))).toBe(40);
    expect(f.mach!.fuel).toEqual({ k: key('wood'), n: 40 });
    // an arm can't swap it
    expect(machAccept(g, f, key('coal'))).toBe(0);
    // by hand, the better fuel is offered while the worse one burns
    expect(loadChoices(g, f).some((c) => c.k === key('coal'))).toBe(true);
    expect(loadChosen(g, f, key('coal'))).toBe(5);
    expect(f.mach!.fuel).toEqual({ k: key('coal'), n: 5 });
    expect(g.player.inv.countId('wood')).toBe(40);
    expect(machAccept(g, f, key('wood'), true)).toBe(0);
  });

  it('a collect is the whole press; holding the input, F collects and loads it', () => {
    const g = new Game({ seed: 6 });
    const f = place(g, 'furnace');
    g.player.inv.add(key('copper_ore'), 30);
    g.player.inv.add(key('coal'), 5);
    f.mach!.outBuf.push({ k: key('copper_bar'), n: 2 });
    g.player.sel = 11;
    g.player.inv.slots[11] = null;
    g.events.length = 0;
    expect(interactStruct(g, f)).toBe(true);
    expect(g.player.inv.countId('copper_bar')).toBe(2);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'loadpick')).toBe(false);
    expect(g.player.inv.countId('copper_ore')).toBe(30);
    // the next F asks
    interactStruct(g, f);
    expect(g.events.some((e: any) => e.t === 'ui' && e.open === 'loadpick' && e.arg === f.id)).toBe(true);
    // with the ore in hand: collect and load, one press
    f.mach!.outBuf.push({ k: key('copper_bar'), n: 1 });
    g.player.sel = g.player.inv.slots.findIndex((s) => s?.k === key('copper_ore'));
    interactStruct(g, f);
    expect(g.player.inv.countId('copper_bar')).toBe(3);
    expect(g.player.inv.countId('copper_ore')).toBe(0);
  });
});

describe('the hamster\'s wheel (the critic: winding arms alone changed nothing)', () => {
  it('on the night shift the machines by its cage run a quarter faster, and the morning says so', () => {
    const night = (fed: boolean) => {
      const g = new Game({ seed: 41 });
      H.enterHouse(g);
      g.player.x = 10.5;
      g.player.y = 8.5;
      g.player.inv.add(key(CAGE), 1);
      const f = FURN_BY_ID.get(CAGE)!;
      let at: [number, number] | null = null;
      for (let y = 3; y < 9 && !at; y++) for (let x = 1; x < 12 && !at; x++) if (!H.canPlaceDecor(g, f, x, y)) at = [x, y];
      expect(H.placeDecor(g, CAGE, at![0], at![1])).toBeNull();
      nameHamster(g, 'Nibbles', 1);
      const h = hamsterSys(g);
      h.points = 300;
      if (fed) h.fedDay = g.dayIndex;
      const c = cageOf(g)!;
      // a crock in reach, well stocked
      let jar: Ent | null = null;
      for (let y = 2; y < 9 && !jar; y++)
        for (let x = 1; x < 13 && !jar; x++)
          if (Math.hypot(x + 0.5 - (c.x + 1), y + 0.5 - (c.y + 0.5)) <= WHEEL_REACH && canPlaceIndoors(g, 'jar', x, y, 0).ok) jar = placeIndoors(g, 'jar', x, y, 0);
      expect(jar).toBeTruthy();
      machInsert(g, jar!, key('cogbean'), 60, true);
      g.events.length = 0;
      const made = jar!.mach!.made;
      sleep(g);
      return { made: jar!.mach!.made - made, toast: g.events.some((e: any) => e.t === 'toast' && /ran its wheel all night/.test(e.text)) };
    };
    const plain = night(false), wheel = night(true);
    expect(WHEEL_BOOST).toBe(1.25);
    expect(wheel.made).toBeGreaterThan(plain.made);
    expect(wheel.toast).toBe(true);
    expect(plain.toast).toBe(false);
  });
});

describe('beach palms take turns', () => {
  it('neighbouring palms set their coconuts on alternate days', () => {
    for (let d = 0; d < 6; d++) expect(palmSets(d, 100)).not.toBe(palmSets(d, 101));
    expect(palmSets(0, 100)).not.toBe(palmSets(1, 100));
  });
});

describe('Housewarming (the owner: the pets as a small early quest, not on the first morning)', () => {
  it("a new farm starts with no hamster, cage or goldfish, and the Mercantile doesn't stock the cage", () => {
    const g = new Game({ seed: 8 });
    expect(g.player.inv.countId(CAGE)).toBe(0);
    expect(g.player.inv.countId('f_tank')).toBe(0);
    expect(hamsterSys(g).named).toBe(false);
    const entry = SHOP_BY_ID.get('general')!.stock.find((s) => s.item === CAGE)!;
    expect(g.unlocked(entry.unlock)).toBe(false);
    expect(questSys(g).active.some((a) => a.id === 's_housewarming')).toBe(false);
  });

  it('comes once the Professor has been by; walking into the farmhouse brings the cage, the tank and seeds', () => {
    const g = new Game({ seed: 8 });
    const q = questSys(g);
    expect(QUEST_BY_ID.get('s_housewarming')!.after).toEqual(['k2_springs']);
    // the Professor's springs done: it starts
    q.active = q.active.filter((a) => a.id !== 'k1_line' && a.id !== 'k2_springs');
    q.done.push('k1_line', 'k2_springs');
    g.flags.add('quest_done:k1_line');
    g.flags.add('quest_done:k2_springs');
    run(g, 2);
    expect(q.active.some((a) => a.id === 's_housewarming')).toBe(true);
    g.events.length = 0;
    H.enterHouse(g);
    run(g, 1);
    expect(q.done).toContain('s_housewarming');
    expect(g.player.inv.countId(CAGE)).toBe(1);
    expect(g.player.inv.countId('f_tank')).toBe(1);
    expect(g.player.inv.countId('radish_seed')).toBeGreaterThanOrEqual(5);
    expect(g.events.some((e: any) => e.t === 'toast' && /set it down/.test(e.text))).toBe(true);
    // the Mercantile keeps a spare from now on
    const entry = SHOP_BY_ID.get('general')!.stock.find((s) => s.item === CAGE)!;
    expect(g.unlocked(entry.unlock)).toBe(true);
  });

  it('a 1.1.1 farm gets it on load too, even with three story quests on the go (it takes no story slot)', () => {
    const raw = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/save111_story_d12_factory.json.gz', import.meta.url))).toString('utf8'));
    const { game: g } = deserialize(raw);
    const q = questSys(g);
    expect(q.active.some((a) => a.id === 's_housewarming')).toBe(true);
    expect(q.active.filter((a) => a.id.startsWith('s_') && a.id !== 's_housewarming').length).toBe(3);
    H.enterHouse(g);
    run(g, 1);
    expect(q.done).toContain('s_housewarming');
    expect(g.player.inv.countId(CAGE)).toBe(1);
  });

  it('sandbox (no quests) stocks the cage from the start; Clockwork Rush has no such quest', () => {
    const sb = new Game({ seed: 9, mode: 'sandbox' } as any);
    expect(sb.flags.has('housewarming')).toBe(true);
    const rush = new Game({ seed: 9, mode: 'rush' } as any);
    const q = questSys(rush);
    q.done.push('k1_line', 'k2_springs');
    run(rush, 2);
    expect(q.active.some((a) => a.id === 's_housewarming')).toBe(false);
  });
});
