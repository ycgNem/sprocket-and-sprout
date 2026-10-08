// Farm visits: on fine weekend afternoons a villager who likes you strolls over to see the farm.
// Talking to them there gives a farm-aware line and a little extra friendship.
import { NPC_BY_ID } from '../../data/npcs';
import { SHOPS } from '../../data/shops';
import { shortName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import { hearts, npcSys, NPCState } from './npcs';

const ARRIVE = 13 * 60, LEAVE = 16 * 60 + 30;

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

export function visitLine(g: Game, n: NPCState): string | null {
  const v = g.sys.visits;
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
    if (g.weekday !== 5 && g.weekday !== 6) return;
    if (g.isRaining() || g.weather === 'snow' || g.weather === 'storm') return;
    if (g.sys.festivals?.today?.(g)) return;
    const cands = npcSys(g).list.filter((n) => n.met && hearts(n) >= 3 && !keepsShopToday(g, n.id) && n.schedule);
    if (!cands.length || g.rng.next() > 0.6) return;
    const n = g.rng.pick(cands);
    if (!g.map.locs.has('farm_visit')) g.map.locs.set('farm_visit', visitSpot(g));
    const at = n.schedule!.at as [number, string][];
    const back = locAt(at, LEAVE);
    const plan: [number, string][] = [...at.filter(([t]) => t < ARRIVE), [ARRIVE, 'farm_visit'], [LEAVE, back], ...at.filter(([t]) => t > LEAVE)];
    n.schedule = { ...n.schedule!, at: plan };
    g.sys.visits = { npc: n.id, talked: false };
    g.toast(`${shortName(NPC_BY_ID.get(n.id)!.name)} might drop by the farm this afternoon.`);
  },
});
