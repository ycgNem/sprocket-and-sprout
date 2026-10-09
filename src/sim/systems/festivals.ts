// Seasonal festivals: villagers gather in the decorated square; talk to the host to play.
import { FESTIVALS } from '../../data/goals';
import { NPCS } from '../../data/npcs';
import type { FestivalDef, Season } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';

export function festivalOn(season: Season | number, day: number): FestivalDef | null {
  return FESTIVALS.find((f) => f.season === season && f.day === day) ?? null;
}

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
  // count distinct festivals, not repeat visits
  if (!g.flags.has('fest_seen_' + f.id)) {
    g.flags.add('fest_seen_' + f.id);
    g.count('festivals');
  }
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
    if (f) g.toast(`Today is ${f.name}! ${f.desc}`, undefined, 6);
  },
});

export { FESTIVALS };
