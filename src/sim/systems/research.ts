// Research: labs consume one of each bundle per unit; completing nodes unlocks recipes + effects.
import { RESEARCH, RESEARCH_BY_ID } from '../../data/research';
import { RECIPES } from '../../data/recipes';
import { ITEM_BY_ID } from '../../data/items';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { key, kDef, kId } from '../inventory';
import { PORT_HANDLERS } from '../ports';

export function researchUnits(id: string) {
  const r = RESEARCH_BY_ID.get(id)!;
  return r.cost[0]?.n ?? 1;
}

export function canResearch(g: Game, id: string): boolean {
  const r = RESEARCH_BY_ID.get(id);
  if (!r || g.research.done.has(id)) return false;
  return r.prereq.every((p) => g.research.done.has(p));
}

export function setResearch(g: Game, id: string | null) {
  if (id && !canResearch(g, id)) return;
  g.research.current = id;
}

/** Recipes and structures a node unlocks (for the tree UI). */
export function unlocksOf(id: string) {
  const recs = RECIPES.filter((r) => r.unlock === id);
  const items = [...new Set(recs.map((r) => r.out[0].item))];
  return { recipes: recs, items };
}

export function applyEffects(g: Game) {
  for (const id of g.research.done) {
    const r = RESEARCH_BY_ID.get(id);
    for (const e of r?.effects ?? []) {
      switch (e.t) {
        case 'armHand': g.mods.armHand += e.v; break;
        case 'machineSpeed': g.mods.machineSpeed += e.v; break;
        case 'labSpeed': g.mods.labSpeed += e.v; break;
        case 'energy': g.mods.energy += e.v; break;
        case 'droneSpeed': g.mods.droneSpeed += e.v; break;
        case 'droneCount': g.mods.droneCount += e.v; break;
        case 'reach': g.mods.reach += e.v; break;
        case 'marketBonus': g.mods.marketBonus += e.v; break;
      }
    }
  }
}

function complete(g: Game, id: string) {
  const r = RESEARCH_BY_ID.get(id)!;
  g.research.done.add(id);
  g.research.current = null;
  // re-apply mods from scratch
  g.mods = { armHand: 0, machineSpeed: 1, labSpeed: 1, energy: 0, droneSpeed: 1, droneCount: 0, reach: 0, marketBonus: 0 };
  applyEffects(g);
  const unl = unlocksOf(id).items.map((i) => ITEM_BY_ID.get(i)!.name);
  g.toast(`Research complete: ${r.name}!${unl.length ? ' Unlocked: ' + unl.slice(0, 3).join(', ') + (unl.length > 3 ? '...' : '') : ''}`, undefined, 6);
  g.emit({ t: 'research', id });
  g.emit({ t: 'fx', kind: 'magic', x: g.player.x, y: g.player.y - 1, n: 20 });
  g.sys.quests?.notify?.(g, 'research', 1, id);
  g.count('research');
  // auto-queue: keep going on the cheapest available node in the same branch? leave it to the player
}

function labAccept(g: Game, e: Ent, k: number): number {
  const d = kDef(k);
  if (d.cat !== 'research') return 0;
  const have = e.inv!.count(k);
  return Math.max(0, 10 - have);
}

function updateLabs(g: Game, dt: number) {
  const cur = g.research.current;
  if (!cur) {
    for (const e of g.ents.others) if (e.def.kind === 'lab') e.working = false;
    return;
  }
  const r = RESEARCH_BY_ID.get(cur)!;
  const units = researchUnits(cur);
  for (const e of g.ents.others) {
    if (e.def.kind !== 'lab' || e.ghost) continue;
    const inv = e.inv!;
    if (!e.st.unit) {
      // need one of each bundle type
      if (!r.cost.every((c) => inv.countId(c.item) >= 1)) {
        e.working = false;
        e.st.status = 'Needs ' + r.cost.filter((c) => inv.countId(c.item) < 1).map((c) => ITEM_BY_ID.get(c.item)!.name).join(', ');
        continue;
      }
      if ((g.research.progress[cur] ?? 0) + (g.sys.labsInFlight?.[cur] ?? 0) >= units) {
        e.working = false;
        continue;
      }
      for (const c of r.cost) {
        inv.remove(key(c.item), 1);
        g.stats.use(key(c.item), 1);
      }
      e.st.unit = cur;
      e.st.progress = 0;
      g.sys.labsInFlight = { ...(g.sys.labsInFlight ?? {}), [cur]: (g.sys.labsInFlight?.[cur] ?? 0) + 1 };
    }
    if (e.st.unit !== cur) {
      // research changed mid-unit: refund-free switch, unit applies to its own node
    }
    e.working = true;
    e.st.status = 'Studying';
    const speed = (e.def.speed ?? 1) * g.mods.labSpeed;
    e.st.progress += (dt * speed) / r.unitTime;
    if (e.st.progress >= 1) {
      const node = e.st.unit as string;
      e.st.unit = false;
      e.st.progress = 0;
      g.sys.labsInFlight[node] = Math.max(0, (g.sys.labsInFlight[node] ?? 1) - 1);
      g.research.progress[node] = (g.research.progress[node] ?? 0) + 1;
      if (g.research.progress[node] >= researchUnits(node) && !g.research.done.has(node)) complete(g, node);
    }
  }
}

registerSystem({
  name: 'research',
  tick(g, dt) {
    updateLabs(g, dt);
  },
  dayStart(g) {
    g.sys.applyResearch = applyEffects;
  },
});

PORT_HANDLERS.lab = {
  accept: labAccept,
  insert: (g, e, k, n) => {
    const can = Math.min(n, labAccept(g, e, k));
    if (can > 0) e.inv!.add(k, can);
    return can;
  },
  take: () => null,
};

export { RESEARCH, kId };
