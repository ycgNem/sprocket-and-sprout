import { describe, expect, it } from 'vitest';
import '../src/sim';
import { Game } from '../src/sim/Game';
import { Bot } from './bot';
import { questSys } from '../src/sim/systems/quests';

describe('pacing (scripted bot, first 3 weeks)', () => {
  it('earns money steadily and unlocks automation in weeks 2-3', () => {
    const g = new Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    const days = Number(process.env.BOT_DAYS ?? 21);
    for (let d = 0; d < days; d++) bot.playDay();
    const rows = bot.log.map((l) => `day ${String(l.day).padStart(2)}  money ${String(l.money).padStart(6)}  earned ${String(l.earned).padStart(6)}  soil ${String(l.soil).padStart(3)}  E-left ${String(l.energyLeft).padStart(4)}  mine ${String(l.mineDeep).padStart(2)}  quests ${l.quests}  research ${l.research.length}  ${l.notes.join('; ')}`);
    console.log(rows.join('\n'));
    console.log('quests done:', questSys(g).done.join(', '));
    console.log('active quests:', questSys(g).active.map((a) => a.id).join(', '));
    const beltDay = bot.log.find((l) => l.research.includes('r_belts'))?.day;
    const armDay = bot.log.find((l) => l.research.includes('r_arms'))?.day;
    console.log('belts researched on day', beltDay, 'arms on day', armDay);
    expect(bot.log[6].earned).toBeGreaterThan(300);
    expect(beltDay).toBeDefined();
    expect(beltDay!).toBeLessThanOrEqual(14);
    if (days >= 21) expect(armDay!).toBeLessThanOrEqual(21);
  }, 600000);
});

describe('mail (DECISIONS #57)', () => {
  it('a week of play brings at most seven letters, one a day', () => {
    const g = new Game({ seed: 77, name: 'Bot', farmName: 'Bolt' });
    const bot = new Bot(g);
    for (let d = 0; d < 7; d++) bot.playDay();
    const mail = (g.sys.goals?.mail ?? []) as { id: string; day: number }[];
    console.log('letters:', mail.map((m) => `${m.day}:${m.id}`).join(', '));
    expect(mail.length).toBeLessThanOrEqual(7);
    const perDay = new Map<number, number>();
    for (const m of mail) perDay.set(m.day, (perDay.get(m.day) ?? 0) + 1);
    expect(Math.max(0, ...perDay.values())).toBeLessThanOrEqual(1);
  }, 600000);
});
