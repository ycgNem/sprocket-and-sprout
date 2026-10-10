// The works' specialists' Trust rewards (src/data/trust.ts): each villager's letter the morning after
// you reach the level, and Pip's watch. Once Pip trusts you (Trust 3), a machine on the farm or in
// the farmhouse that has stood stopped for a minute (starved, blocked, out of fuel or power) brings
// Pip running with which one and why, once each time it stops. No random numbers: the world's dice
// are untouched.
import { Game, registerSystem } from '../Game';
import { NPC_BY_ID } from '../../data/npcs';
import { shortName } from '../../data/cookbook';
import { C } from '../../data/palette';
import { TRUST_REWARDS } from '../../data/trust';
import { entName } from '../ents';
import { MState } from '../mstate';
import { isRusted } from '../rust';
import { hearts, npcSys } from './npcs';
import { send } from './goals';

export const hasTrust = (g: Game, id: string) => g.flags.has('trust:' + id);

/** how long a machine stands stopped before Pip comes running (works seconds) */
export const PIP_WAIT = 60;
/** and at most one of Pip's reports in this long */
const PIP_GAP = 20;

const STOPPED = new Set<MState>([MState.Starved, MState.Blocked, MState.NeedsFuel, MState.Unpowered]);

function pipWatch(g: Game) {
  if (!hasTrust(g, 'pip_watch') || g.sleeping || g.nightShift || g.player.where === 'mine') return;
  const now = g.simTime;
  const w = (g.sys.trust ??= { told: -PIP_GAP }) as { told: number };
  if (now - w.told < PIP_GAP) return;
  for (const list of [g.ents.machines, g.houseEnts.machines])
    for (const e of list) {
      if (e.ghost || isRusted(e) || !STOPPED.has(e.state) || now - e.since < PIP_WAIT || e.st.pipTold === e.since) continue;
      e.st.pipTold = e.since;
      w.told = now;
      g.toast(`Pip: "Your ${entName(e).toLowerCase()} stopped! ${e.why}."`, 'i:' + e.def.item, C.butter);
      g.emit({ t: 'hop', ent: e.id });
      return;
    }
}

registerSystem({
  name: 'trust',
  tick(g) {
    if (g.tickN % 60 === 0) pipWatch(g);
  },
  dayStart(g) {
    if (!g.sys.npcs || g.map.w < 100) return;
    for (const r of TRUST_REWARDS) {
      if (hasTrust(g, r.id)) continue;
      const n = npcSys(g).byId.get(r.npc);
      if (!n || hearts(n) < r.trust) continue;
      g.flags.add('trust:' + r.id);
      send(g, 'trust_' + r.id, { from: r.npc, title: `${shortName(NPC_BY_ID.get(r.npc)?.name ?? r.npc)}: ${r.title}`, text: r.letter });
    }
  },
});
