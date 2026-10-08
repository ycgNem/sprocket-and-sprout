// Town doors: shops (open when the keeper is in), homes, the farmhouse bed, clocktower, mine.
import { SHOPS } from '../../data/shops';
import { NPC_BY_ID } from '../../data/npcs';
import { WEEKDAYS } from '../../data/types';
import { Game, registerSystem } from '../Game';
import type { BuildingInfo } from '../world/tilemap';
import { npcSys, openDialog } from './npcs';

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

export function door(g: Game, b: BuildingInfo) {
  switch (b.kind) {
    case 'farmhouse': {
      const late = g.time.min >= 18 * 60;
      g.emit({
        t: 'ui', open: 'confirm',
        arg: {
          text: late ? 'Go to bed and end the day?' : `It's only ${fmt(g.time.min)}. Go to bed early anyway?`,
          yesLabel: 'Sleep', noLabel: 'Not yet',
          yes: () => {
            g.goToBed();
            g.emit({ t: 'sfx', id: 'sleep' });
          },
        },
      });
      g.emit({ t: 'sfx', id: 'door' });
      return;
    }
    case 'tower':
      g.emit({ t: 'ui', open: 'restoration' });
      g.emit({ t: 'sfx', id: 'door' });
      return;
    case 'mine':
      g.sys.mine?.enterPrompt?.(g);
      return;
    case 'greenhouse':
      if (!g.flags.has('greenhouse_fixed')) g.toast('The old greenhouse is broken. The town restoration board could fix it...');
      return;
  }
  const shop = shopFor(b.id);
  if (shop) {
    const st = shopOpen(g, shop.id);
    const keeper = npcSys(g).byId.get(shop.owner);
    const keeperHome = keeper && !keeper.visible && keeper.target === shop.loc + '_in';
    if (!st.open || !keeperHome) {
      const who = NPC_BY_ID.get(shop.owner)?.name.split(' ')[0] ?? 'The keeper';
      g.toast(`${shop.name}: ${st.open ? `${who} isn't in right now.` : st.why}`);
      g.emit({ t: 'sfx', id: 'thud' });
      return;
    }
    g.emit({ t: 'sfx', id: 'door' });
    if (shop.id === 'clinic') g.player.hp = g.player.maxHp;
    g.emit({ t: 'ui', open: 'shop', arg: shop.id });
    return;
  }
  if (b.id === 'library') {
    const sable = npcSys(g).byId.get('sable');
    if (g.time.min >= 540 && g.time.min < 1080) {
      g.emit({ t: 'ui', open: 'museum' });
      g.emit({ t: 'sfx', id: 'door' });
      return;
    }
    void sable;
    g.toast('Library & Schoolhouse: open 9am to 6pm.');
    return;
  }
  // homes: say hi if someone is inside
  const inside = npcSys(g).list.filter((n) => !n.visible && n.target === b.id + '_in');
  if (inside.length) {
    const n = inside[0];
    openDialog(g, n, `${NPC_BY_ID.get(n.id)!.name.split(' ')[0]} calls through the door: "Just a minute! ...Actually, I'll see you in town, {player}!"`);
  } else g.toast(`${b.name}. Nobody seems to be home.`);
  g.emit({ t: 'sfx', id: 'door' });
}

registerSystem({
  name: 'town',
  dayStart(g) {
    g.sys.town = { door };
  },
});
