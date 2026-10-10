// The farm pet after the owner's playtest (src/sim/systems/pet.ts): stay or come along, F that
// doesn't land on the pet when something else is there, a fish treat, the crow guard, belt rides,
// and an adopted pet's own dice (a stray's, which the pacing bot sees, are the world's as ever).
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game, SYSTEMS } from '../src/sim/Game';
import { key } from '../src/sim/inventory';
import { place } from '../src/sim/build';
import { interact } from '../src/sim/actions';
import { promptAt } from '../src/sim/prompts';
import { adoptPet, petSys, togglePetStay, TREAT_POINTS, type PetState } from '../src/sim/systems/pet';
import { PET_GUARD } from '../src/sim/systems/farming';

function sleep(g: Game) {
  g.goToBed();
  g.time.min = DAY_END - 0.01;
  g.tick();
}

/** a game with an adopted pet out in the yard by the farmhouse, you beside it */
function withPet(seed = 12, points = 600): { g: Game; p: PetState } {
  const g = new Game({ seed });
  sleep(g);
  sleep(g);
  const p = petSys(g);
  adoptPet(g, 'Turnip');
  g.sys.house.leave(g);
  g.weather = 'sun';
  g.time.min = 10 * 60;
  p.map = 'world';
  p.points = points;
  return { g, p };
}

const petTick = SYSTEMS.find((s) => s.name === 'pet')!.tick!;

/** a ripe radish (or a growing one) as the soil holds it */
const radish = (ready: boolean) => ({ water: true, fert: null, idle: 0, crop: { id: 'radish', days: ready ? 9 : 1, stage: ready ? 4 : 0, ready, harvests: 0, dead: false, giant: -1, frac: 0 } });

/** a bare tile near you with nothing on it: no structure, object, building or crop */
function bareTile(g: Game): [number, number] {
  const m = g.map;
  for (let r = 2; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(g.player.x) + dx, y = Math.floor(g.player.y) + dy;
        const i = m.idx(x, y);
        if (m.walkable(x, y) && !g.ents.at(x, y) && !m.obj[i] && !g.soil.has(i) && !m.buildingAtTile(x, y) && !m.buildingAtTile(x, y - 1)) return [x, y];
      }
  throw new Error('no bare tile');
}

describe('the farm pet', () => {
  it('Shift+F tells it to stay around the farmhouse, and again to come along', () => {
    const { g, p } = withPet();
    // walk off: it follows
    p.x = g.player.x - 6;
    p.y = g.player.y;
    p.mode = 'idle';
    g.player.moving = true;
    petTick(g, 1 / 60);
    expect(p.mode).toBe('follow');
    togglePetStay(g, p);
    expect(p.stay).toBe(true);
    expect(p.mode).not.toBe('follow');
    for (let i = 0; i < 60; i++) petTick(g, 1 / 60);
    expect(p.mode).not.toBe('follow');
    // and it's in the save
    togglePetStay(g, p);
    expect(p.stay).toBe(false);
    togglePetStay(g, p);
    const saved = SYSTEMS.find((s) => s.name === 'pet')!.save!(g);
    expect(saved.stay).toBe(true);
  });

  it('F at a ripe crop with the pet on it picks the crop; F at the pet alone pets it', () => {
    const { g, p } = withPet();
    const [tx, ty] = bareTile(g);
    g.player.x = tx - 0.5;
    g.player.y = ty + 0.5;
    g.soil.set(g.map.idx(tx, ty), radish(true) as any);
    p.x = tx + 0.5;
    p.y = ty + 0.8;
    const pts = p.points;
    expect(interact(g, tx, ty)).toBe(true);
    expect(g.player.inv.countId('radish')).toBeGreaterThan(0);
    expect(p.points).toBe(pts);
    // nothing else there now: F (and the bubble) are the pet's
    expect(promptAt(g, tx, ty)?.verb).toBe('Pet Turnip');
    expect(interact(g, tx, ty)).toBe(true);
    expect(p.points).toBeGreaterThan(pts);
  });

  it('a fish is its treat, once a day', () => {
    const { g, p } = withPet();
    p.x = g.player.x + 1.5;
    p.y = g.player.y + 0.3;
    const [tx, ty] = [Math.floor(p.x), Math.floor(p.y - 0.3)];
    g.player.inv.slots[(g.player.sel = 0)] = { k: key('sardine'), n: 2 };
    expect(promptAt(g, tx, ty)?.verb).toBe('Give a treat');
    const pts = p.points;
    expect(interact(g, tx, ty)).toBe(true);
    expect(p.points).toBe(pts + TREAT_POINTS);
    expect(g.player.inv.countId('sardine')).toBe(1);
    // not twice in a day
    expect(interact(g, tx, ty)).toBe(true);
    expect(g.player.inv.countId('sardine')).toBe(1);
    expect(p.points).toBe(pts + TREAT_POINTS);
  });

  it('from two hearts it keeps the crows off the crops by its bowl, and the dice fall as before', () => {
    const run = (guard: boolean) => {
      const { g, p } = withPet(14, guard ? 600 : 100);
      // a field by the bowl, and the same field far away
      const m = g.map;
      const [bx, by] = p.bowl;
      let planted = 0;
      for (let y = by - 4; y <= by + 4; y++)
        for (let x = bx - 6; x <= bx + 6; x++) {
          const i = m.idx(x, y);
          if (!m.walkable(x, y) || g.ents.at(x, y) || m.obj[i]) continue;
          g.soil.set(i, radish(false) as any);
          planted++;
        }
      g.events.length = 0;
      const before = g.rng.s;
      sleep(g);
      sleep(g);
      let left = 0;
      for (let y = by - 4; y <= by + 4; y++) for (let x = bx - 6; x <= bx + 6; x++) if (g.soil.get(m.idx(x, y))?.crop) left++;
      return { planted, left, rng: g.rng.s !== before, toasts: g.events.filter((e: any) => e.t === 'toast').map((e: any) => e.text) };
    };
    const open = run(false), guarded = run(true);
    expect(open.planted).toBeGreaterThan(40);
    expect(guarded.left).toBe(guarded.planted);
    expect(open.left).toBeLessThanOrEqual(open.planted);
    // as far as a scarecrow reaches (the critic's re-check: 14 covered the whole home field)
    expect(PET_GUARD).toBe(8);
  });

  it('a cat rides a belt along and hops off at its end', () => {
    const { g, p } = withPet();
    p.kind = 'cat';
    const y = Math.floor(g.player.y) + 3;
    const x0 = Math.floor(g.player.x) - 2;
    for (let x = x0; x < x0 + 4; x++) {
      const t = g.map.idx(x, y);
      g.map.obj[t] = 0;
      g.soil.delete(t);
      place(g, 'belt_1', x, y, 1);
    }
    p.x = x0 + 0.5;
    p.y = y + 0.6;
    p.mode = 'ride';
    p.t = 30;
    p.stay = true;
    for (let i = 0; i < 60 * 4; i++) petTick(g, 1 / 60);
    // carried east to the last belt, then off it
    expect(p.x).toBeGreaterThan(x0 + 2.5);
    expect(p.x).toBeLessThan(x0 + 4);
    expect(p.mode).not.toBe('ride');
  });

  it("an adopted pet's whims don't draw on the world's dice; a stray's do, as ever", () => {
    const stray = new Game({ seed: 12 });
    sleep(stray);
    sleep(stray);
    expect(petSys(stray).stage).toBe('stray');
    const { g, p } = withPet();
    p.stay = true;
    const s0 = g.rng.s, t0 = stray.rng.s;
    for (let i = 0; i < 60 * 30; i++) {
      petTick(g, 1 / 60);
      petTick(stray, 1 / 60);
    }
    expect(g.rng.s).toBe(s0);
    expect(stray.rng.s).not.toBe(t0);
  });
});
