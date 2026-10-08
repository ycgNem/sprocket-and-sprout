// Partners: give the Brass Locket to a villager you love (8+ hearts). Your partner makes you
// breakfast, helps with the morning chores, visits the farm and spends evenings by your hearth.
import { NPC_BY_ID } from '../../data/npcs';
import { ITEM_BY_ID } from '../../data/items';
import { C } from '../../data/palette';
import { shortName } from '../../data/cookbook';
import { Game, registerSystem } from '../Game';
import { key } from '../inventory';
import { addPoints, hearts, npcSys, NPCState, openDialog } from './npcs';
import { send } from './goals';

export const PARTNER_SPOT: [number, number] = [8.5, 7.5];
const EVENING = 20 * 60;

export function partnerId(g: Game): string | null {
  for (const f of g.flags) if (f.startsWith('partner:')) return f.slice(8);
  return null;
}

export function canPartner(id: string) {
  return NPC_BY_ID.get(id)?.age === 'adult';
}

/** the player offers the locket to a villager */
export function offerLocket(g: Game, n: NPCState): void {
  const d = NPC_BY_ID.get(n.id)!;
  const name = shortName(d.name);
  const current = partnerId(g);
  if (current === n.id) {
    openDialog(g, n, `"You already gave me your heart, {player}. I keep it right here." ${name} taps the locket.`, undefined, 1);
    return;
  }
  if (current) {
    openDialog(g, n, `"I think someone else is wearing your locket, {player}."`, undefined, 2);
    return;
  }
  if (!canPartner(n.id)) {
    openDialog(g, n, `${name} looks at the locket, then at you, kindly. "That's very sweet. But I think you meant this for someone else."`);
    return;
  }
  if (hearts(n) < 8) {
    openDialog(g, n, `${name} blushes. "Oh! I'm flattered, truly. But let's get to know each other a little better first."`, undefined, 1);
    return;
  }
  g.player.inv.removeSpec('heart_charm', 1);
  g.flags.add('partner:' + n.id);
  g.flags.add('partner_since:' + g.dayIndex);
  addPoints(g, n, 250);
  n.emote = 'heart';
  n.emoteT = 4;
  g.emit({ t: 'sfx', id: 'heart' });
  g.emit({ t: 'fx', kind: 'hearts', x: n.x, y: n.y - 1 });
  g.count('partner');
  openDialog(g, n, `${name} holds the locket for a long moment. "Yes. Yes! I was hoping you'd ask, {player}." ... "I'll come by the farm, and I'll keep the fire going on cold nights. Let's build something good together."`, undefined, 1);
  send(g, 'partner_' + n.id, { from: n.id, title: 'Us', text: `I keep opening the locket just to look at it. I'll see you at the farmhouse tonight. - ${name}` });
}

function breakfast(g: Game, n: NPCState) {
  const name = shortName(NPC_BY_ID.get(n.id)!.name);
  const r = g.rng.next();
  if (r < 0.5) {
    const dish = g.rng.pick(['pancakes', 'omelet', 'bread', 'cookies', 'fruit_salad', 'veggie_soup', 'honey_bun'].filter((id) => ITEM_BY_ID.has(id)));
    g.give(key(dish), 1, false);
    g.toast(`${name} made you ${ITEM_BY_ID.get(dish)!.name} for breakfast.`, dish, C.rose);
  } else if (r < 0.75 && !g.isRaining()) {
    // morning chores: water some of the crops nearest the house
    const [hx, hy] = g.map.loc('farmhouse');
    const dry = [...g.soil.entries()].filter(([, s]) => s.crop && !s.crop.dead && !s.water).map(([i]) => i);
    dry.sort((a, b) => Math.hypot((a % g.map.w) - hx, Math.floor(a / g.map.w) - hy) - Math.hypot((b % g.map.w) - hx, Math.floor(b / g.map.w) - hy));
    const n2 = Math.min(dry.length, 24);
    for (let i = 0; i < n2; i++) g.soil.get(dry[i])!.water = true;
    if (n2) g.toast(`${name} watered ${n2} of your crops before you woke up.`, undefined, C.rose);
  }
}

const EVENING_LINES = [
  'Long day? Sit with me a while. The fire is warm.',
  'Tell me one good thing that happened today.',
  "I counted your belts on the walk over. You have too many. I love it.",
  "{player}, I'm glad I said yes.",
  'The house sounds different with two people in it. Better.',
  "Don't stay up too late. The crops will still be there in the morning.",
  'I made the bed. Badly, but I made it.',
  "Listen to that rain on the roof... or is it the wind? Either way, I'm staying in.",
];

export function partnerHome(g: Game): boolean {
  const id = partnerId(g);
  return !!id && g.player.where === 'house' && (g.time.min >= EVENING || g.time.min < 6 * 60) && !g.sys.festivals?.active;
}

/** right-click on the partner by the hearth */
export function partnerAt(g: Game, tx: number, ty: number): boolean {
  if (!partnerHome(g)) return false;
  if (Math.abs(tx + 0.5 - PARTNER_SPOT[0]) > 0.8 || Math.abs(ty + 0.5 - (PARTNER_SPOT[1] - 0.4)) > 1) return false;
  const n = npcSys(g).byId.get(partnerId(g)!)!;
  const line = EVENING_LINES[(g.dayIndex + (n.talked ? 3 : 0)) % EVENING_LINES.length];
  if (!n.talked) {
    n.talked = true;
    addPoints(g, n, 25);
  }
  openDialog(g, n, `"${line}"`, undefined, 1);
  g.emit({ t: 'sfx', id: 'talk' });
  return true;
}

registerSystem({
  name: 'partner',
  dayStart(g) {
    g.sys.offerLocket = offerLocket;
    g.sys.partnerAt = partnerAt;
    g.sys.partnerHome = partnerHome;
    const id = partnerId(g);
    if (!id || g.map.w < 100 || g.daysPlayed === 0) return;
    const n = npcSys(g).byId.get(id);
    if (n && g.rng.next() < 0.75) breakfast(g, n);
  },
});
