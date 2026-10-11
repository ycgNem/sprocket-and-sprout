// The Harvest Crane turns (the owner after 2.0: some things "cant be rotated ... im specifically
// concerned about the harvest crane"): R turns its look through four facings, each with its own art,
// and what it picks stays the same.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { STRUCTURES } from '../src/data/structures';
import { rotateStruct } from '../src/sim/build';
import { matchSprite } from '../src/render/art/match';

const factory = JSON.parse(fs.readFileSync('src/art/factory.json', 'utf8')) as { sprites: { match: string; r: number[]; flipX?: boolean }[] };
const art = (name: string) => factory.sprites.find((s) => matchSprite(s.match, name));

describe('structures with facings', () => {
  it('the crane is one, and every facing has art of its own, idle and working', () => {
    const turned = STRUCTURES.filter((d) => d.facings);
    expect(turned.map((d) => d.id)).toContain('harvester');
    for (const d of turned) {
      expect(d.rotatable, d.id).toBe(true);
      for (const r of [1, 2, 3]) for (let f = 0; f < 4; f++) for (const on of [0, 1]) expect(art(`st:${d.id}_r${r}:${f}:${on}:2`), `${d.id} r${r} f${f} on${on}`).toBeTruthy();
    }
    // facing 2 is facing 0 mirrored; 1 and 3 are drawn apart from it
    expect(art('st:harvester_r2:0:1:0')!.flipX).toBe(true);
    expect(art('st:harvester_r1:0:1:0')!.r).not.toEqual(art('st:harvester:0:1:0')!.r);
    expect(art('st:harvester_r3:0:1:0')!.r).not.toEqual(art('st:harvester_r1:0:1:0')!.r);
  });

  it('R turns a placed crane through its four facings and back', () => {
    const g = new Game({ seed: 1, blank: { w: 40, h: 40 } });
    const e = g.ents.add('harvester', 5, 5, 0);
    const seen = [e.rot];
    for (let i = 0; i < 4; i++) {
      rotateStruct(g, e);
      seen.push(e.rot);
    }
    expect(seen).toEqual([0, 1, 2, 3, 0]);
  });
});
