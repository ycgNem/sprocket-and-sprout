// Seasonal festivals: villagers gather in the decorated square; talk to the host to take part.
// Four (DECISIONS #53): the Sprocket Fair (spring 13: the Professor's test bed, src/sim/fair.ts
// and testbed.ts), Lantern Night (summer 20), the Harvest Haul (fall 16: the Mayor's auction,
// src/sim/auction.ts, and double pay for standing orders, orders.ts) and Frostlight Skate (winter 24).
// Kite Day and the Pumpkin Roll were retired in 2.0; a save that went to them keeps its count.
import { FESTIVALS } from '../../data/goals';
import { NPCS } from '../../data/npcs';
import type { FestivalDef, Season } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';

export function festivalOn(season: Season | number, day: number): FestivalDef | null {
  return FESTIVALS.find((f) => f.season === season && f.day === day) ?? null;
}

/** a festival's name in a sentence: "the Sprocket Fair", "Lantern Night" (start: "The Sprocket Fair") */
export const festivalName = (f: FestivalDef, start = false) => (f.the ? (start ? 'The ' : 'the ') : '') + f.name;

export function festivalToday(g: Game): FestivalDef | null {
  // Clockwork Rush is all business: no festivals
  if (g.mode === 'rush') return null;
  const f = festivalOn(g.time.season, g.time.day);
  if (!f) return null;
  return f;
}

export function festivalActive(g: Game): FestivalDef | null {
  const f = festivalToday(g);
  if (!f || g.time.min < f.start || g.time.min >= f.end) return null;
  return f;
}

/** spots around the square for each villager during a festival */
function spots(g: Game): Map<string, string> {
  const out = new Map<string, string>();
  const [cx, cy] = g.map.loc('square');
  NPCS.forEach((n, i) => {
    const a = (i / NPCS.length) * Math.PI * 2;
    const id = `fest_${n.id}`;
    const x = Math.round(cx + Math.cos(a) * 6), y = Math.round(cy - 2 + Math.sin(a) * 4);
    g.map.locs.set(id, [x, y]);
    out.set(n.id, id);
  });
  return out;
}

/** count a festival as taken part in (Festive Spirit counts each one once) */
function seen(g: Game, f: FestivalDef) {
  if (g.flags.has('fest_seen_' + f.id)) return;
  g.flags.add('fest_seen_' + f.id);
  g.count('festivals');
}

/**
 * A festival's activity is over with this score: its prize tier, once a year (Lantern Night's
 * fireflies, Frostlight Skate's lights; the Harvest Haul's auction scores 1 for bidding, 2 for
 * winning). The Sprocket Fair pays through src/sim/fair.ts.
 */
export function finishActivity(g: Game, f: FestivalDef, score: number) {
  const year = g.time.year;
  const flag = `fest_${f.id}_${year}`;
  if (g.flags.has(flag)) return { prize: null as null | FestivalDef['prizes'][number], first: false };
  g.flags.add(flag);
  let prize: FestivalDef['prizes'][number] | null = null;
  for (const p of f.prizes) if (score >= p.score) prize = p;
  if (prize) {
    g.player.money += prize.money;
    g.earned += prize.money;
    for (const it of prize.items) g.give(key(it.item), it.n);
  } else g.give(key('ticket'), 2);
  const best = g.counters['best_' + f.id] ?? 0;
  if (score > best) g.counters['best_' + f.id] = score;
  seen(g, f);
  return { prize, first: true };
}

registerSystem({
  name: 'festivals',
  realtime: true,
  tick(g) {
    if (g.tickN % 30 !== 0) return;
    const fs = g.sys.festivals;
    const f = festivalActive(g);
    fs.active = f;
    if (f) {
      // lanterns / string lights around the square for the lighting pass
      if (!g.sys.festivalLights?.length) {
        const [cx, cy] = g.map.loc('square');
        const L = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          L.push({ x: cx + 0.5 + Math.cos(a) * 9, y: cy - 1.5 + Math.sin(a) * 6, r: 2.5, i: 0.85, c: [28, 6, 21, 31][i % 4], flicker: true });
        }
        g.sys.festivalLights = L;
      }
    } else g.sys.festivalLights = [];
  },
  dayStart(g) {
    const sp = g.map.w > 100 ? spots(g) : new Map();
    g.sys.festivals = {
      list: FESTIVALS,
      active: null,
      isFestival: (s: Season, d: number) => g.mode !== 'rush' && !!festivalOn(s, d),
      today: (gg: Game) => festivalToday(gg),
      npcSpot: (gg: Game, id: string) => {
        const f = festivalActive(gg);
        return f ? sp.get(id) ?? null : null;
      },
    };
    const f = festivalToday(g);
    if (f) g.toast(`Today is ${festivalName(f)}! ${f.desc}`, undefined, 6);
  },
  afterLoad(g) {
    // 2.0 Phase 5: Kite Day is the Sprocket Fair and the Pumpkin Roll the Harvest Haul. A save that
    // went to one counts it as the new one (Festive Spirit's count stays as it was, so nothing is lost
    // or counted twice) and keeps its year's prize; the old best scores (a kite's seconds, a roll's
    // points) go
    for (const [from, to] of [['f_kite', 'f_fair'], ['f_pumpkin', 'f_haul']]) {
      if (g.flags.delete('fest_seen_' + from)) g.flags.add('fest_seen_' + to);
      for (const fl of [...g.flags]) {
        if (!fl.startsWith(`fest_${from}_`)) continue;
        g.flags.delete(fl);
        g.flags.add(`fest_${to}_${fl.slice(`fest_${from}_`.length)}`);
      }
      delete g.counters['best_' + from];
    }
    // Founder's Day's review is retired (the Fair's prizes are the year's review): a pending one goes
    g.flags.delete('eval_pending');
  },
});

export { FESTIVALS };
