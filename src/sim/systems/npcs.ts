// Villagers: daily schedules with A* pathing, talk and dialogue selection. (Trust, gifts, birthdays
// and heart events were taken out in 2.1.1, DECISIONS #175: the town is about its works.)
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import type { DialogueLine, NPCDef, ScheduleDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { findPath } from '../world/path';

export interface NPCState {
  id: string;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3;
  moving: boolean;
  walkT: number;
  visible: boolean;
  path: [number, number][];
  target: string;
  /** talked today (the day's first chat, "Chat with" once you have) */
  talked: boolean;
  met: boolean;
  recent: string[];
  emote: string | null;
  emoteT: number;
  /** waiting time at a stop before idling around */
  idleT: number;
  schedule: ScheduleDef | null;
  /** the first day this villager asks you a question again (Pip's echoes, src/sim/people.ts) */
  askDay?: number;
}

/**
 * A villager's own talk instead of a chat line (src/sim/people.ts: Pip's echoes, Sable's archive,
 * Thorne's drawings); true when it opened something. People.ts adds to these when it's imported, so
 * the specialists need no system of their own (import order is tick order).
 */
export const TALK_HOOKS: ((g: Game, n: NPCState, shopAfter?: string) => boolean)[] = [];

export interface NPCSys {
  list: NPCState[];
  byId: Map<string, NPCState>;
  at: (g: Game, x: number, y: number) => NPCState | null;
  interact: (g: Game, n: NPCState) => void;
}

export function npcSys(g: Game): NPCSys {
  if (!g.sys.npcs) {
    const list: NPCState[] = NPCS.map((d) => newState(d));
    g.sys.npcs = { list, byId: new Map(list.map((n) => [n.id, n])), at: npcAt, interact: talkTo } as NPCSys;
  }
  return g.sys.npcs;
}

function newState(d: NPCDef): NPCState {
  return {
    id: d.id, x: 0, y: 0, dir: 2, moving: false, walkT: 0, visible: false, path: [], target: '', talked: false, met: false,
    recent: [], emote: null, emoteT: 0, idleT: 0, schedule: null,
  };
}

function npcAt(g: Game, x: number, y: number): NPCState | null {
  if (g.player.where !== 'world') return null;
  let best: NPCState | null = null, bd = 1.1;
  for (const n of npcSys(g).list) {
    if (!n.visible) continue;
    const d = Math.hypot(n.x - x, n.y - 0.4 - y);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

function pickSchedule(g: Game, d: NPCDef): ScheduleDef {
  const raining = g.isRaining() || g.weather === 'snow' && false;
  for (const s of d.schedules) {
    const w = s.when;
    if (!w) return s;
    if (w.season !== undefined && w.season !== g.time.season) continue;
    if (w.weather === 'rain' && !raining) continue;
    if (w.weather === 'clear' && raining) continue;
    if (w.weekdays && !w.weekdays.includes(g.weekday)) continue;
    return s;
  }
  return d.schedules[d.schedules.length - 1];
}

/** Location where the NPC should be right now (festival overrides). */
function currentTarget(g: Game, n: NPCState): string {
  // a scripted visit (the Professor walking into the keeper's yard, src/sim/systems/keeper.ts)
  const visit = g.sys.visitSpot?.(g, n.id);
  if (visit) return visit;
  const fest = g.sys.festivals?.npcSpot?.(g, n.id);
  if (fest) return fest;
  const s = n.schedule;
  if (!s) return '';
  let tgt = s.at[0][1];
  for (const [t, loc] of s.at) if (g.time.min >= t) tgt = loc;
  return tgt;
}

function locTile(g: Game, loc: string): [number, number] | null {
  return g.map.locs.get(loc) ?? null;
}

/**
 * Paths the villagers walk, per world: a new game or a loaded save starts its own (a path from
 * another seed's map walks through its trees, and made the sim differ by what ran before it), and
 * a placed or removed structure starts it again.
 */
const walkCaches = new WeakMap<object, { ver: number; paths: Map<string, [number, number][] | null> }>();
function walkCache(g: Game) {
  let c = walkCaches.get(g.map);
  if (!c || c.ver !== g.ents.version) {
    c = { ver: g.ents.version, paths: new Map() };
    walkCaches.set(g.map, c);
  }
  return c.paths;
}

function npcWalkable(g: Game) {
  return (x: number, y: number) => {
    if (!g.map.walkable(x, y)) return false;
    const e = g.ents.at(x, y);
    if (e && e.def.solid && !e.ghost) return false;
    return true;
  };
}

function planPath(g: Game, n: NPCState, loc: string) {
  const dst = locTile(g, loc);
  if (!dst) return;
  let [gx, gy] = dst;
  const inside = loc.endsWith('_in');
  if (inside) {
    // walk to the doorstep (one tile below the door), then vanish
    gy = gy + 1;
  }
  const sx = Math.floor(n.x), sy = Math.floor(n.y);
  const key = `${sx},${sy}>${gx},${gy}`;
  const cache = walkCache(g);
  let path = cache.get(key);
  if (path === undefined) {
    path = findPath(g.map, sx, sy, gx, gy, npcWalkable(g), 40000);
    if (cache.size > 600) cache.clear();
    cache.set(key, path);
  }
  n.path = path ? [...path] : [];
  if (!path) {
    // can't reach: teleport discreetly
    n.x = gx + 0.5;
    n.y = gy + 0.9;
  }
  // already on the doorstep (a keeper who waited out front first) or put there: step straight in.
  // Without this the keeper stays outside all day and the shop never opens.
  if (inside && !n.path.length) {
    n.visible = false;
    n.moving = false;
  }
}

function placeAt(g: Game, n: NPCState, loc: string) {
  const t = locTile(g, loc);
  if (!t) return;
  const inside = loc.endsWith('_in');
  n.x = t[0] + 0.5;
  n.y = t[1] + (inside ? 1.9 : 0.9);
  n.visible = !inside;
  n.path = [];
}

function stepNPC(g: Game, n: NPCState, dt: number) {
  const tgt = currentTarget(g, n);
  if (tgt && tgt !== n.target) {
    const wasInside = n.target.endsWith('_in') && !n.visible;
    n.target = tgt;
    if (wasInside) {
      // step out of the door
      const t = locTile(g, n.target === tgt ? lastInside(n) : n.target);
      void t;
      n.visible = true;
    }
    planPath(g, n, tgt);
  }
  if (n.emoteT > 0) {
    n.emoteT -= dt;
    if (n.emoteT <= 0) n.emote = null;
  }
  if (!n.visible && !n.path.length) return;
  // pause while chatting with the player
  if (g.sys.dialogue?.npc === n.id) {
    n.moving = false;
    return;
  }
  if (n.path.length) {
    const [px, py] = n.path[0];
    const tx = px + 0.5, ty = py + 0.9;
    const dx = tx - n.x, dy = ty - n.y;
    const d = Math.hypot(dx, dy);
    const sp = 2.3 * dt;
    if (d <= sp) {
      n.x = tx;
      n.y = ty;
      n.path.shift();
      if (!n.path.length && n.target.endsWith('_in')) {
        n.visible = false;
        n.moving = false;
      }
    } else {
      n.x += (dx / d) * sp;
      n.y += (dy / d) * sp;
      if (Math.abs(dx) > Math.abs(dy)) n.dir = dx > 0 ? 1 : 3;
      else n.dir = dy > 0 ? 2 : 0;
    }
    n.moving = true;
    n.walkT += dt * 2.3;
  } else {
    n.moving = false;
    // idle: look around, occasionally face the player if near
    n.idleT += dt;
    const p = g.player;
    if (Math.hypot(p.x - n.x, p.y - n.y) < 2.2) {
      const dx = p.x - n.x, dy = p.y - n.y;
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    } else if (n.idleT > 4) {
      n.idleT = 0;
      n.dir = g.rng.int(0, 3) as 0 | 1 | 2 | 3;
    }
  }
}

function lastInside(n: NPCState) {
  return n.target;
}

// ---------------- dialogue ----------------
function timeOfDay(min: number) {
  if (min < 720) return 'morning';
  if (min < 1080) return 'afternoon';
  if (min < 1320) return 'evening';
  return 'night';
}

export function fillTokens(g: Game, s: string) {
  return s.replace(/\{player\}/g, g.player.name).replace(/\{farm\}/g, g.player.farmName + ' Farm').replace(/\{fav\}/g, g.player.favorite);
}

export function chooseLine(g: Game, n: NPCState, d: NPCDef): string {
  if (!n.met) return d.intro;
  const tod = timeOfDay(g.time.min);
  const festival = !!g.sys.festivals?.today?.(g);
  const ok = (l: DialogueLine) =>
    (l.season === undefined || l.season === g.time.season) &&
    (l.weather === undefined || l.weather === g.weather) &&
    (l.weekday === undefined || l.weekday === g.weekday) &&
    (l.time === undefined || l.time === tod) &&
    (l.festival === undefined || l.festival === festival) &&
    (l.year === undefined || g.time.year >= l.year) &&
    (l.flag === undefined || g.flags.has(l.flag)) &&
    (l.noFlag === undefined || !g.flags.has(l.noFlag));
  const cands = d.dialogue.filter(ok).filter((l) => !n.recent.includes(l.text));
  const pool = cands.length ? cands : d.dialogue.filter(ok);
  if (!pool.length) return '...';
  // specific lines are more likely (a line about the town's keystones, too)
  const weight = (l: DialogueLine) =>
    1 + (l.season !== undefined ? 1.5 : 0) + (l.weather !== undefined ? 3 : 0) + (l.weekday !== undefined ? 2 : 0) + (l.time !== undefined ? 1.2 : 0) + (l.festival ? 6 : 0) + (l.flag !== undefined ? 2 : 0);
  const line = g.rng.weighted(pool, weight);
  n.recent.push(line.text);
  if (n.recent.length > 6) n.recent.shift();
  return line.text;
}

/**
 * The villagers inside the building whose door is `loc` (the schedules' '<loc>_in'): a shop's keeper
 * at work, and anyone in with them (the counter, src/ui/windows/town.ts)
 */
export function insideAt(g: Game, loc: string): NPCState[] {
  const tile = g.map.locs.get(loc + '_in');
  if (!tile) return [];
  return npcSys(g).list.filter((n) => {
    const t = !n.visible && g.map.locs.get(n.target);
    return !!t && t[0] === tile[0] && t[1] === tile[1];
  });
}

/**
 * Player interacts: hand over what a quest asked them for, otherwise talk. From a shop's counter (a
 * villager at work inside, src/ui/windows/town.ts) `shopAfter` brings the shop back once the talk is
 * done, and `chat` talks without handing over what you hold.
 */
export function talkTo(g: Game, n: NPCState, shopAfter?: string, chat = false) {
  const d = NPC_BY_ID.get(n.id)!;
  g.count('talk_' + n.id);
  // a scripted visit plays its own scene
  if (g.sys.visitTalk?.(g, n)) return;
  const fest = g.sys.festivals?.active;
  // the host (or co-host) opens the day's activity; a host who chats first does once you've talked today
  if (fest && (fest.cohost === n.id || fest.host === n.id)) {
    n.met = true;
    g.emit({ t: 'ui', open: 'festival', arg: fest.id });
    return;
  }
  const p = g.player;
  const held = chat ? null : p.inv.slots[p.sel];
  // quests that want a delivery to this NPC take priority
  if (held && g.sys.quests?.tryDeliver?.(g, n.id, held.k, shopAfter)) return;
  // a specialist's own talk (an echo, a record, a drawing) instead of a chat line
  if (n.met && specialTalk(g, n, shopAfter)) return;
  const visit: string | null = n.met ? g.sys.visitLine?.(g, n) ?? null : null;
  const text = visit ?? chooseLine(g, n, d);
  if (visit && !g.sys.visits.talked) {
    // a visit to the farm is a good chat
    g.sys.visits.talked = true;
    n.emote = 'happy';
    n.emoteT = 2;
  }
  n.met = true;
  n.talked = true;
  g.sys.quests?.notify?.(g, 'talk', 1, n.id);
  openDialog(g, n, text, shopAfter);
}

/**
 * Run the talk hooks; when one opens something it counts as the talk (the day's first chat, a
 * quest's "talk to"). Also for doors: a shop or the library can open on its keeper's own talk.
 */
export function specialTalk(g: Game, n: NPCState, shopAfter?: string): boolean {
  if (!TALK_HOOKS.some((h) => h(g, n, shopAfter))) return false;
  n.met = true;
  n.talked = true;
  g.sys.quests?.notify?.(g, 'talk', 1, n.id);
  return true;
}

export function openDialog(g: Game, n: NPCState, text: string, shopAfter?: string, mood?: number) {
  const d = NPC_BY_ID.get(n.id)!;
  g.sys.dialogue = { npc: n.id };
  g.emit({ t: 'ui', open: 'dialog', arg: { npc: n.id, name: d.name, pages: splitPages(fillTokens(g, text)), shop: shopAfter, mood: mood ?? 0 } });
}

export function splitPages(text: string): string[] {
  // split long text into pages at sentence boundaries (~150 chars)
  const out: string[] = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((cur + ' ' + s).length > 150 && cur) {
      out.push(cur);
      cur = s;
    } else cur = cur ? cur + ' ' + s : s;
  }
  if (cur) out.push(cur);
  return out;
}

registerSystem({
  name: 'npcs',
  tick(g, dt) {
    if (g.map.w < 100) return;
    const s = npcSys(g);
    for (const n of s.list) stepNPC(g, n, dt);
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    const s = npcSys(g);
    for (const n of s.list) {
      const d = NPC_BY_ID.get(n.id)!;
      n.schedule = pickSchedule(g, d);
      n.target = n.schedule.at[0][1];
      placeAt(g, n, n.target);
      n.emote = null;
    }
  },
  dayEnd(g) {
    for (const n of npcSys(g).list) n.talked = false;
    g.sys.dialogue = null;
    g.sys.cutscene = null;
  },
  save(g) {
    return npcSys(g).list.map((n) => ({ id: n.id, met: n.met, talked: n.talked, ...(n.askDay ? { askDay: n.askDay } : {}) }));
  },
  load(g, d) {
    const s = npcSys(g);
    for (const r of d as any[]) {
      const n = s.byId.get(r.id);
      if (!n) continue;
      // (an older save's points, gifts and heart events are left behind: Trust is gone, #175)
      Object.assign(n, { met: !!r.met, talked: !!r.talked, askDay: r.askDay ?? 0 });
    }
  },
  afterLoad(g) {
    // put everyone where their schedule says
    const s = npcSys(g);
    for (const n of s.list) {
      const d = NPC_BY_ID.get(n.id)!;
      n.schedule = pickSchedule(g, d);
      const tgt = currentTarget(g, n);
      n.target = tgt;
      placeAt(g, n, tgt);
    }
  },
});

export { NPCS };
