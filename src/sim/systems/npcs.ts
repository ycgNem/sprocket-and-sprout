// Villagers: daily schedules with A* pathing, dialogue selection, gifts, friendship, heart events.
import { shortName } from '../../data/cookbook';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import { ITEM_BY_ID, matchesSpec } from '../../data/items';
import type { DialogueLine, HeartEventDef, NPCDef, ScheduleDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { kDef } from '../inventory';
import { findPath } from '../world/path';

export const POINTS_PER_HEART = 250;
export const MAX_POINTS = 2500;

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
  points: number;
  talked: boolean;
  giftedToday: boolean;
  giftsWeek: number;
  met: boolean;
  seen: number[];
  recent: string[];
  emote: string | null;
  emoteT: number;
  /** waiting time at a stop before idling around */
  idleT: number;
  schedule: ScheduleDef | null;
  birthdayGift: boolean;
}

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
    id: d.id, x: 0, y: 0, dir: 2, moving: false, walkT: 0, visible: false, path: [], target: '', points: 0, talked: false, giftedToday: false,
    giftsWeek: 0, met: false, seen: [], recent: [], emote: null, emoteT: 0, idleT: 0, schedule: null, birthdayGift: false,
  };
}

export function hearts(n: NPCState) {
  return Math.min(10, Math.floor(n.points / POINTS_PER_HEART));
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

const walkCache = new Map<string, [number, number][] | null>();

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
  let path = walkCache.get(key);
  if (path === undefined) {
    path = findPath(g.map, sx, sy, gx, gy, npcWalkable(g), 40000);
    if (walkCache.size > 600) walkCache.clear();
    walkCache.set(key, path);
  }
  n.path = path ? [...path] : [];
  if (!path) {
    // can't reach: teleport discreetly
    n.x = gx + 0.5;
    n.y = gy + 0.9;
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
  const h = hearts(n);
  const tod = timeOfDay(g.time.min);
  const festival = !!g.sys.festivals?.today?.(g);
  const ok = (l: DialogueLine) =>
    (l.season === undefined || l.season === g.time.season) &&
    (l.weather === undefined || l.weather === g.weather) &&
    (l.minH === undefined || h >= l.minH) &&
    (l.maxH === undefined || h <= l.maxH) &&
    (l.weekday === undefined || l.weekday === g.weekday) &&
    (l.time === undefined || l.time === tod) &&
    (l.festival === undefined || l.festival === festival) &&
    (l.year === undefined || g.time.year >= l.year);
  const cands = d.dialogue.filter(ok).filter((l) => !n.recent.includes(l.text));
  const pool = cands.length ? cands : d.dialogue.filter(ok);
  if (!pool.length) return '...';
  // specific lines are more likely
  const weight = (l: DialogueLine) =>
    1 + (l.season !== undefined ? 1.5 : 0) + (l.weather !== undefined ? 3 : 0) + (l.minH !== undefined ? 1 + l.minH * 0.3 : 0) + (l.weekday !== undefined ? 2 : 0) + (l.time !== undefined ? 1.2 : 0) + (l.festival ? 6 : 0);
  const line = g.rng.weighted(pool, weight);
  n.recent.push(line.text);
  if (n.recent.length > 6) n.recent.shift();
  return line.text;
}

export type Taste = 'love' | 'like' | 'neutral' | 'dislike' | 'hate';

export function giftTaste(d: NPCDef, itemId: string): Taste {
  const def = ITEM_BY_ID.get(itemId)!;
  const order: Taste[] = ['love', 'hate', 'like', 'dislike'];
  // exact ids first, then tags
  for (const t of order) if ((d.gifts[t as 'love'] as string[]).includes(itemId)) return t;
  for (const t of order) if ((d.gifts[t as 'love'] as string[]).some((s) => s[0] === '#' && matchesSpec(def, s))) return t;
  if (def.cat === 'trash') return 'hate';
  return 'neutral';
}

const TASTE_POINTS: Record<Taste, number> = { love: 80, like: 45, neutral: 20, dislike: -20, hate: -40 };

export function isBirthday(g: Game, d: NPCDef) {
  return d.birthday.season === g.time.season && d.birthday.day === g.time.day;
}

export function addPoints(g: Game, n: NPCState, pts: number) {
  const before = hearts(n);
  n.points = Math.max(0, Math.min(MAX_POINTS, n.points + pts));
  const after = hearts(n);
  if (after > before) {
    g.emit({ t: 'sfx', id: 'heart' });
    g.toast(`${shortName(NPC_BY_ID.get(n.id)!.name)}: ${after} heart${after > 1 ? 's' : ''}!`, undefined, 28);
    g.sys.quests?.notify?.(g, 'friend', after, n.id);
  }
}

/** Player interacts: gift if holding a giftable item and allowed, otherwise talk. */
export function talkTo(g: Game, n: NPCState) {
  const d = NPC_BY_ID.get(n.id)!;
  const fest = g.sys.festivals?.active;
  if (fest && fest.host === n.id) {
    n.met = true;
    g.emit({ t: 'ui', open: 'festival', arg: fest.id });
    return;
  }
  const p = g.player;
  const held = p.inv.slots[p.sel];
  // quests that want a delivery to this NPC take priority
  if (held && g.sys.quests?.tryDeliver?.(g, n.id, held.k)) return;
  if (held && n.met) {
    const hd = kDef(held.k);
    const giftable = !hd.tool && !hd.weapon && hd.cat !== 'placeable' && hd.cat !== 'research' && hd.id !== 'heart_charm';
    if (giftable) {
      const bday = isBirthday(g, d);
      if (n.giftedToday) {
        openDialog(g, n, `${shortName(d.name)} smiles. "You already gave me something today, {player}."`);
        return;
      }
      if (n.giftsWeek >= 2 && !bday) {
        openDialog(g, n, `"That's very kind, but you've spoiled me enough this week!"`);
        return;
      }
      const taste = giftTaste(d, hd.id);
      const q = held.k & 3;
      let pts = TASTE_POINTS[taste] * (taste === 'love' || taste === 'like' ? 1 + q * 0.1 : 1);
      if (bday) pts *= 8;
      p.inv.remove(held.k, 1);
      n.giftedToday = true;
      n.giftsWeek++;
      if (!n.talked) {
        n.talked = true;
        pts += 20;
      }
      addPoints(g, n, Math.round(pts));
      const reps = d.giftReplies[taste];
      let text = bday ? d.giftReplies.birthday : reps[g.rng.int(0, reps.length - 1)];
      if (bday && (taste === 'dislike' || taste === 'hate')) text = reps[0];
      n.emote = taste === 'love' ? 'heart' : taste === 'like' ? 'happy' : taste === 'neutral' ? null : 'sad';
      n.emoteT = 2.5;
      g.emit({ t: 'fx', kind: taste === 'love' ? 'hearts' : 'sparkle', x: n.x, y: n.y - 1 });
      g.emit({ t: 'sfx', id: taste === 'love' || taste === 'like' ? 'heart' : 'talk' });
      g.count('gifts');
      openDialog(g, n, text, undefined, taste === 'love' || taste === 'like' ? 1 : taste === 'neutral' ? 0 : 2);
      return;
    }
  }
  let text = chooseLine(g, n, d);
  if (!n.met) n.met = true;
  if (!n.talked) {
    n.talked = true;
    addPoints(g, n, 20);
  }
  g.sys.quests?.notify?.(g, 'talk', 1, n.id);
  if (isBirthday(g, d) && !n.giftedToday) text += ` ...It's my birthday today, you know.`;
  openDialog(g, n, text);
}

export function openDialog(g: Game, n: NPCState, text: string, shopAfter?: string, mood?: number) {
  const d = NPC_BY_ID.get(n.id)!;
  g.sys.dialogue = { npc: n.id };
  g.emit({ t: 'ui', open: 'dialog', arg: { npc: n.id, name: d.name, pages: splitPages(fillTokens(g, text)), shop: shopAfter, hearts: hearts(n), mood: mood ?? (hearts(n) >= 3 && /!/.test(text) ? 1 : 0) } });
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

// ---------------- heart events ----------------
function checkHeartEvents(g: Game) {
  if (g.sys.cutscene || g.sys.dialogue || g.player.where !== 'world') return;
  const p = g.player;
  for (const n of npcSys(g).list) {
    const d = NPC_BY_ID.get(n.id)!;
    const h = hearts(n);
    for (const ev of d.heartEvents) {
      if (h < ev.hearts || n.seen.includes(ev.hearts)) continue;
      if (g.time.min < ev.window[0] || g.time.min >= ev.window[1]) continue;
      if (ev.weather === 'rain' && !g.isRaining()) continue;
      if (ev.weather === 'clear' && g.isRaining()) continue;
      const loc = g.map.locs.get(ev.loc);
      if (!loc) continue;
      if (Math.hypot(p.x - (loc[0] + 0.5), p.y - (loc[1] + 0.5)) > 5) continue;
      startHeartEvent(g, n, ev);
      return;
    }
  }
}

function startHeartEvent(g: Game, n: NPCState, ev: HeartEventDef) {
  n.seen.push(ev.hearts);
  const d = NPC_BY_ID.get(n.id)!;
  // bring the NPC next to the player
  n.visible = true;
  n.path = [];
  n.x = g.player.x + 1;
  n.y = g.player.y;
  n.dir = 3;
  g.sys.cutscene = { npc: n.id };
  g.emit({ t: 'sfx', id: 'chime' });
  g.emit({
    t: 'ui', open: 'event',
    arg: {
      npc: n.id, title: ev.title,
      lines: ev.lines.map((l) => ({ who: l.who === 'npc' ? d.name : l.who === 'player' ? g.player.name : l.who === 'narrator' ? '' : NPC_BY_ID.get(l.who)?.name ?? l.who, text: fillTokens(g, l.text), npcId: l.who === 'npc' ? n.id : NPC_BY_ID.has(l.who) ? l.who : null })),
      choice: ev.choice ? { prompt: fillTokens(g, ev.choice.prompt), options: ev.choice.options.map((o) => ({ text: fillTokens(g, o.text), reply: fillTokens(g, o.reply), friendship: o.friendship })) } : null,
    },
  });
}

export function finishHeartEvent(g: Game, npcId: string, friendship: number) {
  const n = npcSys(g).byId.get(npcId);
  if (n) addPoints(g, n, 60 + friendship);
  g.sys.cutscene = null;
  g.count('heart_events');
}

registerSystem({
  name: 'npcs',
  tick(g, dt) {
    if (g.map.w < 100) return;
    const s = npcSys(g);
    for (const n of s.list) stepNPC(g, n, dt);
    if (g.tickN % 30 === 0) checkHeartEvents(g);
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    const s = npcSys(g);
    for (const n of s.list) {
      const d = NPC_BY_ID.get(n.id)!;
      n.schedule = pickSchedule(g, d);
      n.target = n.schedule.at[0][1];
      placeAt(g, n, n.target);
      n.giftedToday = false;
      n.emote = null;
      if (g.weekday === 0) n.giftsWeek = 0;
    }
  },
  dayEnd(g) {
    for (const n of npcSys(g).list) {
      if (!n.talked && n.met && n.points > 0) n.points = Math.max(0, n.points - (hearts(n) >= 8 ? 1 : 2));
      n.talked = false;
    }
    g.sys.dialogue = null;
    g.sys.cutscene = null;
  },
  save(g) {
    return npcSys(g).list.map((n) => ({ id: n.id, points: n.points, met: n.met, seen: n.seen, giftsWeek: n.giftsWeek, talked: n.talked, giftedToday: n.giftedToday }));
  },
  load(g, d) {
    const s = npcSys(g);
    for (const r of d as any[]) {
      const n = s.byId.get(r.id);
      if (!n) continue;
      Object.assign(n, { points: r.points, met: r.met, seen: r.seen ?? [], giftsWeek: r.giftsWeek ?? 0, talked: !!r.talked, giftedToday: !!r.giftedToday });
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
