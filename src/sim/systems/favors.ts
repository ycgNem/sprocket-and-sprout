// The works' specialists' favors (src/data/favors.ts): each villager's letter the morning after its
// keystone, and Pip's watch. Once the Town Mill turns, a machine on the farm or in the farmhouse that
// has stood stopped for a minute (starved, blocked, out of fuel or power) brings Pip running with
// which one and why, once each time it stops. No random numbers: the world's dice are untouched.
import { Game, registerSystem } from '../Game';
import { NPC_BY_ID } from '../../data/npcs';
import { shortName } from '../../data/cookbook';
import { C } from '../../data/palette';
import { FAVORS } from '../../data/favors';
import { entName } from '../ents';
import { MState } from '../mstate';
import { isRusted } from '../rust';
import { send } from './goals';

export const hasFavor = (g: Game, id: string) => g.flags.has('favor:' + id);

/** how long a machine stands stopped before Pip comes running (works seconds) */
export const PIP_WAIT = 60;
/** and at most one of Pip's reports in this long */
const PIP_GAP = 20;

const STOPPED = new Set<MState>([MState.Starved, MState.Blocked, MState.NeedsFuel, MState.Unpowered]);

function pipWatch(g: Game) {
  if (!hasFavor(g, 'pip_watch') || g.sleeping || g.nightShift || g.player.where === 'mine') return;
  const now = g.simTime;
  const w = (g.sys.favors ??= { told: -PIP_GAP }) as { told: number };
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
  name: 'favors',
  tick(g) {
    if (g.tickN % 60 === 0) pipWatch(g);
  },
  dayStart(g) {
    if (g.map.w < 100) return;
    for (const r of FAVORS) {
      if (hasFavor(g, r.id) || !g.flags.has(r.after)) continue;
      g.flags.add('favor:' + r.id);
      send(g, 'favor_' + r.id, { from: r.npc, title: `${shortName(NPC_BY_ID.get(r.npc)?.name ?? r.npc)}: ${r.title}`, text: r.letter });
    }
  },
  afterLoad(g) {
    // a farm from before 2.1.1 earned these by Trust (flag 'trust:<id>'): it keeps them
    for (const r of FAVORS) if (g.flags.delete('trust:' + r.id)) g.flags.add('favor:' + r.id);
  },
});
