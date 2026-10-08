import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { Bot } from './bot';
import { serialize, deserialize } from '../src/sim/save';

// A whole year with the scripted bot: no exceptions, every system's day hooks keep working,
// and the save still round-trips. Run with LONG=1 (takes a minute).
describe.skipIf(!process.env.LONG)('long run', () => {
  it('survives a full year and saves cleanly', () => {
    const g = new Game({ seed: 77, name: 'Bot', farmName: 'Year' });
    const bot = new Bot(g);
    for (let d = 0; d < 112; d++) bot.playDay();
    expect(g.time.year).toBe(2);
    const json = JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 }));
    console.log('save size', (json.length / 1024).toFixed(1), 'KB; earned', g.earned, 'pet', g.sys.pet?.stage, 'guild', g.sys.guild?.unlocked, 'evaluation pending', g.flags.has('eval_pending'));
    const { game: g2 } = deserialize(JSON.parse(json));
    expect(g2.time.year).toBe(2);
    for (let i = 0; i < 600; i++) g2.tick();
    expect(json.length).toBeLessThan(3_000_000);
  }, 900000);
});
