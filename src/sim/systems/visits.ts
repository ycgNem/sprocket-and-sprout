// Farm visits: on fine weekend afternoons a villager who likes you strolls over to see the farm.
// Talking to them there gives a farm-aware line and a little extra Trust. On a fine afternoon with
// no other visitor, Pip may come after school and stand by one of your machines to ask about it
// (ROADMAP.md 7.6; the question is src/sim/people.ts).
import { NPC_BY_ID } from '../../data/npcs';
import { SHOPS } from '../../data/shops';
import { shortName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import { dayHash, pipMachines, standBy } from '../people';
import { hearts, npcSys, NPCState } from './npcs';

const ARRIVE = 13 * 60, LEAVE = 16 * 60 + 30;
/** Pip, after school (school lets out at 3pm), home before dark */
const PIP_ARRIVE = 15 * 60, PIP_LEAVE = 18 * 60;
/** the chance of Pip's visit on a fine day with no other visitor */
export const PIP_VISIT_CHANCE = 0.4;

function visitSpot(g: Game): [number, number] {
  const [hx, hy] = g.map.loc('farmhouse');
  for (const [dx, dy] of [[3, 2], [4, 2], [2, 3], [5, 3], [3, 4], [-3, 3]]) {
    const x = hx + dx, y = hy + dy;
    if (g.map.walkable(x, y) && !g.ents.at(x, y)) return [x, y];
  }
  return [hx, hy + 2];
}

function locAt(at: [number, string][], t: number): string {
  let loc = at[0][1];
  for (const [tt, l] of at) if (t >= tt) loc = l;
  return loc;
}

function keepsShopToday(g: Game, id: string): boolean {
  const s = SHOPS.find((x) => x.owner === id);
  return !!s && !s.closedDays?.includes(g.weekday);
}

/** Pip by one of your machines, once the question's been asked (people.ts asks it first) */
function pipVisitLine(g: Game, n: NPCState): string | null {
  const v = g.sys.visits;
  const spot = g.map.locs.get('pip_visit');
  if (!spot || g.time.min < PIP_ARRIVE || g.time.min > PIP_LEAVE + 60 || Math.hypot(n.x - spot[0], n.y - spot[1]) > 6) return null;
  const name = g.ents.get(v.ent)?.def.name.toLowerCase() ?? 'machine';
  const lines = [
    `I'm gonna watch your ${name} till the lamps come on. Then I'll go home. Probably.`,
    `I drew your ${name} in my notebook. From the side, from the top and from underneath. Underneath was hard.`,
    `Your works never stop, {player}. Not even when you go inside. That's the best bit.`,
    `I timed your ${name} with my counting. It's very regular. I'm going to be that regular one day.`,
  ];
  return lines[(g.dayIndex + (v.talked ? 1 : 0)) % lines.length];
}

export function visitLine(g: Game, n: NPCState): string | null {
  const v = g.sys.visits;
  if (v?.npc === n.id && v.ent !== undefined) return pipVisitLine(g, n);
  if (!v || v.npc !== n.id || g.time.min < ARRIVE || g.time.min > LEAVE + 60) return null;
  const [sx, sy] = g.map.loc('farm_visit') ?? [0, 0];
  if (Math.hypot(n.x - sx, n.y - sy) > 10) return null;
  const name = shortName(NPC_BY_ID.get(n.id)!.name);
  const lines: string[] = [];
  const belts = g.ents.belts.length, machines = g.ents.machines.length;
  const crops = [...g.soil.values()].filter((s) => s.crop && !s.crop.dead).length;
  const animals = (g.sys.animals?.list ?? []).length;
  const pet = g.sys.pet;
  if (pet?.stage === 'adopted') lines.push(`Oh! Is this ${pet.name}? Hello, ${pet.name}! ...${pet.kind === 'cat' ? 'They gave me a very slow blink. I think that means we\'re friends.' : 'Ha! That tail could power a windmill.'}`);
  if (belts >= 60) lines.push(`I can hear your belts humming from the road. ${belts} of them? It's like the whole farm is breathing.`);
  else if (machines >= 6) lines.push(`All these machines puffing away! Ottoline must be so proud. Or jealous. Probably both.`);
  if (crops >= 80) lines.push(`Look at all these crops! ${crops} plants, and every one of them looks cared for.`);
  else if (crops >= 20) lines.push(`Your fields are coming along nicely. It's good to see this land growing again.`);
  if (animals >= 4) lines.push(`Your animals look so content. You can always tell a happy farm by its animals.`);
  if (g.flags.has('greenhouse_fixed')) lines.push(`The greenhouse sparkles in the sun now. I remember when it was all broken glass.`);
  if (g.flags.has('home_kitchen')) lines.push(`Something smells wonderful. Have you been cooking in that new kitchen?`);
  lines.push(`I thought I'd walk over and see how you're settling in. It's lovely out here, {player}.`);
  lines.push(`What a day for a stroll. Thanks for letting me poke around {farm}!`);
  // farm-specific remarks first; the two generic lines are a fallback
  const specific = lines.slice(0, -2);
  const pool = specific.length ? specific : lines.slice(-2);
  return pool[(g.dayIndex + n.id.length + (v.talked ? 1 : 0)) % pool.length] ?? `${name} waves.`;
}

registerSystem({
  name: 'visits',
  dayStart(g) {
    g.sys.visits = null;
    g.sys.visitLine = visitLine;
    if (g.map.w < 100 || g.daysPlayed < 5) return;
    if (g.isRaining() || g.weather === 'snow' || g.weather === 'storm') return;
    if (g.sys.festivals?.today?.(g)) return;
    // your partner drops by most fine days; others only at weekends
    const pid = [...g.flags].find((f) => f.startsWith('partner:'))?.slice(8);
    const partner = pid ? npcSys(g).byId.get(pid) : undefined;
    let n: NPCState | undefined;
    // (the rolls here are the same as before Pip's visits: they never roll g.rng themselves)
    if (partner && partner.schedule && !keepsShopToday(g, partner.id) && g.rng.next() < 0.7) n = partner;
    else {
      if (g.weekday !== 5 && g.weekday !== 6) return pipVisit(g);
      const cands = npcSys(g).list.filter((x) => x.met && hearts(x) >= 3 && !keepsShopToday(g, x.id) && x.schedule && x !== partner);
      if (!cands.length || g.rng.next() > 0.6) return pipVisit(g);
      n = g.rng.pick(cands);
    }
    if (!g.map.locs.has('farm_visit')) g.map.locs.set('farm_visit', visitSpot(g));
    const at = n.schedule!.at as [number, string][];
    const back = locAt(at, LEAVE);
    const plan: [number, string][] = [...at.filter(([t]) => t < ARRIVE), [ARRIVE, 'farm_visit'], [LEAVE, back], ...at.filter(([t]) => t > LEAVE)];
    n.schedule = { ...n.schedule!, at: plan };
    g.sys.visits = { npc: n.id, talked: false };
    g.toast(`${shortName(NPC_BY_ID.get(n.id)!.name)} might drop by the farm this afternoon.`);
  },
});

/**
 * Pip's afternoon at your works: a fine day with no other visitor, a met Pip and a machine to watch.
 * Pip stands beside it from 3pm and asks about it when you talk (src/sim/people.ts). Its dice are the
 * day's hash, never g.rng, so a save's other rolls don't move.
 */
function pipVisit(g: Game) {
  const pip = npcSys(g).byId.get('pip');
  if (!pip?.met || !pip.schedule) return;
  const h = dayHash(g, 0x9f1);
  if ((h % 1000) / 1000 >= PIP_VISIT_CHANCE) return;
  const ms = pipMachines(g);
  if (!ms.length) return;
  // the machine Pip watches: a different one most days
  const e = ms[(h >>> 10) % ms.length];
  const spot = standBy(g, e);
  if (!spot) return;
  g.map.locs.set('pip_visit', spot);
  const at = pip.schedule.at as [number, string][];
  const back = locAt(at, PIP_LEAVE);
  const plan: [number, string][] = [...at.filter(([t]) => t < PIP_ARRIVE), [PIP_ARRIVE, 'pip_visit'], [PIP_LEAVE, back], ...at.filter(([t]) => t > PIP_LEAVE)];
  pip.schedule = { ...pip.schedule, at: plan };
  g.sys.visits = { npc: 'pip', talked: false, ent: e.id, asked: false };
  g.toast(`Pip might come by after school to watch your ${e.def.name.toLowerCase()}.`);
}
