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

/** Where the opening's pieces sit (all inside the farmhouse yard on every map). */
export const OPENING = {
  beans: { x: 42, y: 26, w: 4, h: 2 }, jar: [54, 23] as [number, number], armTile: [54, 22] as [number, number],
  /** bare dirt beside the beans that "Room to Grow" points at (6 tiles: till, plant, water) */
  plot: { x: 42, y: 29, w: 3, h: 2 },
  /** the keeper's bean chest below the jar, and where "Hands Free" puts the arm that feeds the jar */
  chest: [54, 25] as [number, number], feedArm: [54, 24] as [number, number],
};

/**
 * The clockwork opening: the old keeper left ripe cogbeans and a working preserves jar
 * by the shipping crate, and you arrive with arms, belts and a study desk. Belts, arms
 * and preserving are known from minute one, so the first automation happens in minutes.
 */
function tinkerStart(g: Game) {
  const p = g.player;
  const give = (id: string, n: number) => p.inv.add(key(id), n);
  for (const r of ['r_belts', 'r_arms', 'r_preserves']) g.research.done.add(r);
  g.flags.add('lab');
  g.flags.add('tinker_start');
  give('arm_basic', 2);
  give('belt_1', 12);
  give('chest_wood', 1);
  give('lab', 1);
  give('bundle_green', 6);
  // the keeper's bean patch, ripe and ready
  const B = OPENING.beans;
  for (let y = B.y; y < B.y + B.h; y++)
    for (let x = B.x; x < B.x + B.w; x++) {
      const i = g.map.idx(x, y);
      g.map.obj[i] = O.NONE;
      g.map.trees.delete(i);
      g.map.ground[i] = T.DIRT;
      g.soil.set(i, { water: true, fert: null, idle: 0, crop: { id: 'cogbean', days: 8, stage: 4, ready: true, harvests: 0, dead: false, giant: -1, frac: 0 } });
    }
  // a clear patch of dirt for the first planting
  const P = OPENING.plot;
  for (let y = P.y; y < P.y + P.h; y++)
    for (let x = P.x; x < P.x + P.w; x++) {
      const i = g.map.idx(x, y);
      g.map.obj[i] = O.NONE;
      g.map.trees.delete(i);
      g.map.ground[i] = T.DIRT;
    }
  const [jx, jy] = OPENING.jar;
  for (const [x, y] of [OPENING.jar, OPENING.armTile, OPENING.chest, OPENING.feedArm]) {
    g.map.obj[g.map.idx(x, y)] = O.NONE;
    g.map.trees.delete(g.map.idx(x, y));
  }
  // the keeper's jar runs its first three batches at 4x: the first pickle in ~15 s
  g.ents.add('jar', jx, jy, 0).st.quick = 3;
  // the keeper's cellar: a dozen cogbeans for an arm to feed the jar with ("Hands Free")
  g.ents.add('chest_wood', OPENING.chest[0], OPENING.chest[1], 0).inv?.add(key('cogbean'), 12);
  // these tutorial steps are covered by the opening
  const q = questSys(g);
  for (const id of ['t_research', 't_belts', 't_factory']) if (!q.done.includes(id)) q.done.push(id);
  g.flags.add('tutorial_done');
}

function startKit(g: Game) {
  const p = g.player;
  const give = (id: string, n: number) => p.inv.add(key(id), n);
  if (g.mode === 'sandbox') {
    const q = questSys(g);
    for (const d of QUESTS) if (d.tutorial && !q.done.includes(d.id)) q.done.push(d.id);
    g.flags.add('tutorial_done');
  } else tinkerStart(g);
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
  const order = ['tool:hoe', 'tool:can', 'tool:axe', 'tool:pick', 'arm_basic', 'belt_1', 'chest_wood', 'lab', 'bundle_green', 'radish_seed'];
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
