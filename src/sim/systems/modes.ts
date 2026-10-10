// Game-mode rules and per-map starting kits. Story is the default rule set; the others
// tweak the clock, penalties, crafting and the opening inventory. Clockwork Rush also
// scores the first 28 days and awards a medal.
import { RESEARCH } from '../../data/research';
import { RUSH_DAYS, RUSH_MEDALS } from '../../data/modes';
import { Game, registerSystem } from '../Game';
import { key, kDef } from '../inventory';
import { O, T } from '../world/tilemap';
import { questSys } from './quests';
import { applyEffects } from './research';
import { QUESTS } from '../../data/goals';

export interface ModeState {
  /** Clockwork Rush: 0 none, 1 bronze, 2 silver, 3 gold */
  medal: number;
  score: number;
  done: boolean;
  /** result window waiting to be shown */
  showResult: boolean;
}

export function modeState(g: Game): ModeState {
  if (!g.sys.mode) g.sys.mode = { medal: 0, score: 0, done: false, showResult: false } as ModeState;
  return g.sys.mode;
}

export function rushMedal(score: number) {
  return RUSH_MEDALS.filter((m) => score >= m).length;
}

/** clock speed multiplier: cozy runs at half speed, sandbox only moves while you sleep */
export function clockFactor(g: Game) {
  if (g.mode === 'cozy') return 0.5;
  if (g.mode === 'sandbox') return g.sleeping ? 1 : 0;
  return 1;
}

export const forgiving = (g: Game) => g.mode === 'cozy' || g.mode === 'sandbox';

function swap(g: Game, from: string, to: string) {
  const inv = g.player.inv;
  const i = inv.slots.findIndex((s) => s && s.k === key(from));
  if (i >= 0) inv.slots[i] = { k: key(to), n: 1 };
}

export { OPENING } from '../opening';
import { OPENING, buildYard } from '../opening';

/**
 * The Keeper's Line (ROADMAP.md 6): the old keeper's works, rusted, with the jar still running on
 * its last beans. You arrive with your tools, two arms and a few cogbean seeds; Preserving and
 * Clockwork Arms are in the keeper's notes, Conveyance is studied in B5.
 */
function keeperStart(g: Game) {
  const p = g.player;
  const give = (id: string, n: number) => p.inv.add(key(id), n);
  for (const r of ['r_arms', 'r_preserves']) g.research.done.add(r);
  g.flags.add('keepers_line');
  give('arm_basic', 2);
  give('cogbean_seed', 4);
  give('chest_wood', 1);
  buildYard(g);
}

function startKit(g: Game) {
  const p = g.player;
  const give = (id: string, n: number) => p.inv.add(key(id), n);
  if (g.mode === 'sandbox') {
    const q = questSys(g);
    for (const d of QUESTS) if (d.tutorial && !q.done.includes(d.id)) q.done.push(d.id);
    g.flags.add('tutorial_done');
  } else keeperStart(g);
  switch (g.farmKind) {
    case 'riverside':
      give('rod_0', 1);
      break;
    case 'ruins':
      // salvage from the old workshop: enough for a first little production line
      give('belt_1', 12);
      give('arm_basic', 2);
      give('chest_wood', 1);
      give('copper_gear', 4);
      break;
    case 'highlands':
      swap(g, 'pick_0', 'pick_1');
      give('stone', 25);
      break;
    case 'wildwood':
      swap(g, 'axe_0', 'axe_1');
      give('morel', 3);
      break;
  }
  switch (g.mode) {
    case 'rush':
      p.money = 1500;
      g.research.done.add('r_belts');
      g.research.done.add('r_arms');
      give('belt_1', 40);
      give('arm_basic', 6);
      give('chest_wood', 2);
      give('jar', 2);
      give('radish_seed', 25);
      give('potato_seed', 10);
      break;
    case 'sandbox':
      p.money = 1000000;
      for (const r of RESEARCH) g.research.done.add(r.id);
      g.flags.add('lab');
      applyEffects(g);
      break;
  }
  if (g.mode !== 'sandbox') arrangeHotbar(g);
}

/**
 * Hotbar for the opening: the tools and pieces it uses, then two free slots so the first
 * harvest lands within reach. The scythe, club and any extras wait in the bag.
 */
function arrangeHotbar(g: Game) {
  const p = g.player;
  const order = ['tool:hoe', 'tool:can', 'tool:axe', 'tool:pick', 'arm_basic', 'cogbean_seed', 'belt_1', 'chest_wood', 'jar', 'radish_seed'];
  const all = p.inv.slots.filter(Boolean) as { k: number; n: number }[];
  const pick = (m: string) => {
    const i = all.findIndex((s) => (m.startsWith('tool:') ? kDef(s.k).tool?.kind === m.slice(5) : s.k === key(m)));
    return i >= 0 ? all.splice(i, 1)[0] : null;
  };
  const hot = order.map(pick);
  p.inv.slots = [...hot, null, null, ...all];
  while (p.inv.slots.length < 36) p.inv.slots.push(null);
  p.sel = 0;
}

registerSystem({
  name: 'mode',
  init(g) {
    modeState(g);
    startKit(g);
  },
  dayStart(g) {
    // days 2-7: the keeper's cellar sends up a dozen cogbeans, so the crock line runs until beds you
    // planted ripen (B6's second jar starves on its own chest, not this one)
    if ((!g.flags.has('tinker_start') && !g.flags.has('keepers_line')) || g.dayIndex < 1 || g.dayIndex > 6) return;
    const chest = g.ents.at(OPENING.chest[0], OPENING.chest[1]);
    if (chest?.def.kind === 'chest' && chest.inv && chest.inv.space(key('cogbean')) >= 12) chest.inv.add(key('cogbean'), 12);
    else g.give(key('cogbean'), 12);
    g.toast("The keeper's cellar sent up another dozen cogbeans.", 'i:cogbean');
  },
  dayEnd(g) {
    if (g.mode !== 'rush') return;
    const st = modeState(g);
    if (st.done || g.daysPlayed + 1 < RUSH_DAYS) return;
    st.done = true;
    st.score = g.earned;
    st.medal = rushMedal(g.earned);
    st.showResult = true;
  },
  save(g) {
    return modeState(g);
  },
  load(g, d) {
    g.sys.mode = { ...modeState(g), ...d };
  },
});
