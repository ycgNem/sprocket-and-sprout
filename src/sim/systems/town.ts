// Town doors: shops (open when the keeper is in), homes, the farmhouse bed, clocktower, mine.
import { shortName } from '../../data/cookbook';
import { enterHouse } from './house';
import { SHOPS } from '../../data/shops';
import { NPC_BY_ID } from '../../data/npcs';
import { WEEKDAYS } from '../../data/types';
import { Game, registerSystem } from '../Game';
import type { BuildingInfo } from '../world/tilemap';
import { skyfield } from '../world/worldgen';
import { addPoints, npcSys, openDialog, specialTalk } from './npcs';

function fmt(min: number) {
  const h = Math.floor(min / 60);
  return `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
}

export function shopFor(buildingId: string) {
  const loc = buildingId === 'fisher_hut' ? 'fisher_hut' : buildingId === 'hermit_hut' ? 'hermit_hut' : buildingId;
  return SHOPS.find((s) => s.loc === loc);
}

export function shopOpen(g: Game, shopId: string): { open: boolean; why?: string } {
  const s = SHOPS.find((x) => x.id === shopId)!;
  if (s.closedDays?.includes(g.weekday)) return { open: false, why: `Closed on ${WEEKDAYS[g.weekday]}s.` };
  if (g.time.min < s.open || g.time.min >= s.close) return { open: false, why: `Open ${fmt(s.open)} to ${fmt(s.close)}.` };
  if (g.sys.festivals?.today?.(g)) return { open: false, why: 'Closed for the festival!' };
  return { open: true };
}

/** is a shop's keeper inside it right now (the door opens only then)? */
export function keeperIn(g: Game, shopId: string): boolean {
  const shop = SHOPS.find((x) => x.id === shopId)!;
  const keeper = npcSys(g).byId.get(shop.owner);
  const inside = g.map.locs.get(shop.loc + '_in');
  const kt = keeper ? g.map.locs.get(keeper.target) : undefined;
  return !!keeper && !keeper.visible && !!inside && !!kt && kt[0] === inside[0] && kt[1] === inside[1];
}

/** what the door would say, in one line (the map's hover) */
export function shopStatus(g: Game, shopId: string): { open: boolean; text: string } {
  const shop = SHOPS.find((x) => x.id === shopId)!;
  const st = shopOpen(g, shop.id);
  if (!st.open) return { open: false, text: st.why ?? 'Closed.' };
  if (!keeperIn(g, shop.id)) return { open: false, text: `${shortName(NPC_BY_ID.get(shop.owner)?.name ?? '') ?? 'The keeper'} isn't in right now.` };
  return { open: true, text: `Open until ${fmt(shop.close)}.` };
}

export function door(g: Game, b: BuildingInfo) {
  switch (b.kind) {
    case 'farmhouse':
      // step inside: the bed, hearth, almanac and kitchen are in there
      enterHouse(g);
      return;
    case 'tower':
      // the clocktower's door opens the Orders board's Works tab (the town works)
      g.emit({ t: 'ui', open: 'board', arg: 'works' });
      g.emit({ t: 'sfx', id: 'door' });
      return;
    case 'mine':
      g.sys.mine?.enterPrompt?.(g);
      return;
    case 'greenhouse':
      if (!g.flags.has('greenhouse_fixed')) g.toast('The glass roof is broken, so beds in here follow the seasons for now. Restore it at the clocktower to grow all year.');
      return;
    case 'landmark':
      // the town keystones' buildings (the Town Mill, the pump house) are looked at, not entered:
      // src/sim/systems/townworks.ts
      g.sys.townworksDoor?.(g, b);
      return;
  }
  const shop = shopFor(b.id);
  if (shop) {
    const st = shopOpen(g, shop.id);
    const keeper = npcSys(g).byId.get(shop.owner);
    const keeperHome = keeperIn(g, shop.id);
    if (!st.open || !keeperHome) {
      const who = shortName(NPC_BY_ID.get(shop.owner)?.name ?? '') ?? 'The keeper';
      g.toast(`${shop.name}: ${st.open ? `${who} isn't in right now.` : st.why}`);
      g.emit({ t: 'sfx', id: 'thud' });
      return;
    }
    g.emit({ t: 'sfx', id: 'door' });
    if (shop.id === 'clinic') g.player.hp = g.player.maxHp;
    // stepping into a keeper's shop counts as saying hello (quests that say "talk to" them), with
    // the day's chat friendship; the first visit is the introduction, then the counter
    g.sys.quests?.notify?.(g, 'talk', 1, shop.owner);
    if (keeper) {
      const firstVisit = !keeper.met;
      keeper.met = true;
      if (!keeper.talked) {
        keeper.talked = true;
        addPoints(g, keeper, 20);
      }
      if (firstVisit) {
        openDialog(g, keeper, NPC_BY_ID.get(keeper.id)!.intro, shop.id);
        return;
      }
      // a keeper with something of their own says it at the counter, then the shop opens (Thorne's drawings)
      if (specialTalk(g, keeper, shop.id)) return;
    }
    g.emit({ t: 'ui', open: 'shop', arg: shop.id });
    return;
  }
  if (b.id === 'library') {
    // Sable at work in the archive: a record to lend or a discovery to file comes first
    const sable = npcSys(g).byId.get('sable');
    const inside = g.map.locs.get('library_in'), st = sable ? g.map.locs.get(sable.target) : undefined;
    if (sable?.met && !sable.visible && inside && st && st[0] === inside[0] && st[1] === inside[1] && specialTalk(g, sable)) {
      g.emit({ t: 'sfx', id: 'door' });
      return;
    }
    if (g.time.min >= 540 && g.time.min < 1080) {
      g.emit({ t: 'ui', open: 'museum' });
      g.emit({ t: 'sfx', id: 'door' });
      return;
    }
    g.toast('Library & Schoolhouse: open 9am to 6pm.');
    return;
  }
  // homes: say hi if someone is inside
  const doorIn = g.map.locs.get(b.id + '_in');
  const inside = npcSys(g).list.filter((n) => { const l = g.map.locs.get(n.target); return !n.visible && !!l && !!doorIn && l[0] === doorIn[0] && l[1] === doorIn[1]; });
  if (inside.length) {
    const n = inside[0];
    openDialog(g, n, `${shortName(NPC_BY_ID.get(n.id)!.name)} calls through the door: "Just a minute! ...Actually, I'll see you in town, {player}!"`);
  } else g.toast(`${b.name}. Nobody seems to be home.`);
  g.emit({ t: 'sfx', id: 'door' });
}

registerSystem({
  name: 'town',
  dayStart(g) {
    g.sys.town = { door };
  },
  afterLoad(g) {
    // saves from before Skyhook Field keep their own ground and objects: clear the airship's meadow
    if (g.map.w >= 100) skyfield(g.map);
  },
});
