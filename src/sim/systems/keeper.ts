// The Keeper's Line at run time (ROADMAP.md 6): Prof. Cogwhistle's visit with the mainsprings
// (B2), the lesson cards the works raise the first time they happen, and the safety nets that keep
// every step completable. The yard itself is laid out by src/sim/opening.ts.
import { NPC_BY_ID } from '../../data/npcs';
import { Game, registerSystem } from '../Game';
import { key, kDef } from '../inventory';
import { lesson } from '../lessons';
import { MState } from '../mstate';
import { buildRiverWorks, OPENING, RIVER } from '../opening';
import { questSys } from './quests';
import { npcSys, type NPCState } from './npcs';

const PROF = 'ottoline';
/** where she stands in the yard, beside the keeper's seized arm */
const VISIT_SPOT: [number, number] = [55, 22];
/** where she comes in from: the farm road east of the yard */
const VISIT_FROM: [number, number] = [65, 22];

interface KeeperState {
  /** the Professor's visit: 0 not yet, 1 walking in / waiting, 2 done */
  visit: number;
  /** the day the cellar last sent seeds for the gleaner's bed (once a day at most) */
  seedDay?: number;
  /** the day the Professor last sent a spare mainspring (once a day at most) */
  springDay?: number;
  /** the day B8's safety nets last topped something up (bars, barley, an arm) */
  riverDay?: number;
  /** the day the cellar last tipped beans into an empty crock for B2's arm (once a day at most) */
  beanDay?: number;
}

function keeper(g: Game): KeeperState {
  if (!g.sys.keeper) g.sys.keeper = { visit: 0 } as KeeperState;
  return g.sys.keeper;
}

const active = (g: Game, id: string) => questSys(g).active.some((a) => a.id === id);

function hooks(g: Game) {
  // while the visit is on, she walks to the yard (src/sim/systems/npcs.ts currentTarget)
  g.sys.visitSpot = (gg: Game, id: string) => (id === PROF && keeper(gg).visit === 1 ? 'prof_visit' : null);
  g.sys.visitTalk = profTalk;
  if (g.map.w > 100) {
    g.map.locs.set('prof_visit', VISIT_SPOT);
    g.map.locs.set('river_works', RIVER.spot);
  }
}

/** B2 begins: she comes in from the road east of the yard */
function startVisit(g: Game) {
  const n = npcSys(g).byId.get(PROF);
  if (!n) return;
  keeper(g).visit = 1;
  n.visible = true;
  n.path = [];
  n.target = '';
  n.x = VISIT_FROM[0] + 0.5;
  n.y = VISIT_FROM[1] + 0.9;
  g.toast('Prof. Cogwhistle is coming up the farm road.', undefined);
}

/** F at the Professor during her visit: a short scene and the two mainsprings */
function profTalk(g: Game, n: NPCState): boolean {
  const k = keeper(g);
  if (n.id !== PROF || k.visit !== 1) return false;
  k.visit = 2;
  n.met = true;
  n.talked = true;
  g.give(key('spring'), 2);
  g.sys.quests?.notify?.(g, 'talk', 1, PROF);
  const name = NPC_BY_ID.get(PROF)!.name;
  g.emit({
    t: 'ui', open: 'event',
    arg: {
      npc: PROF, title: "The Professor's Springs",
      lines: [
        { who: name, npcId: PROF, text: `So the keeper's arm finally seized. I'm not surprised: it carried for forty years without a day off.` },
        { who: name, npcId: PROF, text: 'Two mainsprings, fresh from my workshop. Fit one with F and it will carry for you again. The other suits the arm by the old gleaner.' },
        { who: name, npcId: PROF, text: `An arm does one thing: it takes from behind and drops in front. Everything this farm becomes is built from that. Off you go, ${g.player.name}!` },
      ],
      choice: null,
    },
  });
  g.emit({ t: 'sfx', id: 'chime' });
  return true;
}

/** a state that has lasted this long is worth a lesson card (a machine between batches isn't) */
const LESSON_AFTER = 4;

/**
 * The works' first stops raise their lesson cards (ROADMAP.md 6.4), on every save: the first
 * machine waiting for input, the first stop with nowhere to go, the first full output, no power,
 * no fuel, a brownout, a line waiting for its field.
 */
function scanLessons(g: Game) {
  const now = g.simTime;
  const long = (e: { since: number }) => now - (e.since ?? 0) >= LESSON_AFTER;
  // until the keeper's line is whole (B3) you are its arm: its crock running dry is the chain's
  // first step ("feed the crock"), not the Starved lesson (that one belongs to B6's second crock)
  const handFed = g.flags.has('keepers_line') && !questSys(g).done.includes('k3_hands');
  for (const e of g.ents.machines) {
    if (e.ghost || e.st.rust || (handFed && e.st.keeper)) continue;
    if (e.fieldWait) lesson(g, 'harvest');
    if (!long(e)) continue;
    if (e.state === MState.Starved) lesson(g, 'starved');
    else if (e.state === MState.Blocked) lesson(g, e.why.startsWith('Output full') ? 'full' : 'blocked');
    else if (e.state === MState.Unpowered) lesson(g, 'unpowered');
    else if (e.state === MState.NeedsFuel) lesson(g, 'fuel');
    else if (e.state === MState.Working && e.def.powerUse && e.sat < 0.8) lesson(g, 'brownout');
  }
  for (const e of g.ents.arms) if (!e.st.rust && e.state === MState.Blocked && long(e)) lesson(g, 'blocked');
  for (const e of g.ents.others) if (e.def.kind === 'gleaner' && !e.st.rust && e.working) lesson(g, 'field');
}

/**
 * B8's safety nets (ROADMAP.md 6.5: no step can be made unwinnable), at most once a day: Bram's
 * bars spent before the wheel was mended, the grain bin emptied or its barley sold, Bram's arms lost.
 */
function riverNets(g: Game, k: KeeperState) {
  if (!active(g, 'k8_river') || k.riverDay === g.dayIndex) return;
  const wheel = g.ents.at(RIVER.wheel[0], RIVER.wheel[1]);
  const bramDone = (g.sys.orders?.filled?.bram_oil ?? 0) > 0;
  const inv = g.player.inv;
  if (bramDone && wheel?.st.rust && inv.countId('copper_bar') < (wheel.st.needN ?? 5)) {
    k.riverDay = g.dayIndex;
    g.give(key('copper_bar'), (wheel.st.needN ?? 5) - inv.countId('copper_bar'));
    g.toast(`Bram sent over bars for the old wheel's axle. "Don't melt these ones down!"`, 'i:copper_bar');
    return;
  }
  const mill = g.ents.at(RIVER.mill[0], RIVER.mill[1]);
  const bin = g.ents.at(RIVER.bin[0], RIVER.bin[1]);
  if (bramDone && mill && !mill.st.rust && bin?.inv && !bin.st.rust) {
    const barley = (bin.inv.countId('barley')) + (mill.mach ? [...mill.mach.inBuf].reduce((a, [kk, n]) => a + (kDef(kk).id === 'barley' ? n : 0), 0) : 0) + inv.countId('barley');
    if (barley < 5) {
      k.riverDay = g.dayIndex;
      bin.inv.add(key('barley'), 10);
      g.toast("There was another sack of barley at the bottom of the keeper's grain bin.", 'i:barley');
      return;
    }
    const brass = g.ents.arms.filter((e) => e.def.id === 'arm_fast' && !e.ghost).length + inv.countId('arm_fast');
    if (brass === 0) {
      k.riverDay = g.dayIndex;
      g.give(key('arm_fast'), 1);
      g.toast('Bram sent another brass arm for the mill. "Mind where you put this one."', 'i:arm_fast');
    }
  }
}

/** the second jar, if one has been placed (any jar that isn't the keeper's) */
function secondJar(g: Game) {
  return g.ents.machines.find((e) => e.def.id === 'jar' && !e.st.keeper && !e.ghost) ?? null;
}

registerSystem({
  name: 'keeper',
  init(g) {
    keeper(g);
    hooks(g);
  },
  afterLoad(g) {
    hooks(g);
    // saves from 1.x never enter the Keeper's Line; their old tutorial quests are gone, so the desk
    // they would have been lent is theirs (the Workshop sells desks, bundles can be crafted)
    if (!g.flags.has('keepers_line') && g.map.w > 100) g.flags.add('lab');
    // a Keeper's Line save from before the river works existed gets them now (B8 needs them)
    if (g.flags.has('keepers_line') && g.map.w > 100) buildRiverWorks(g);
  },
  dayStart(g) {
    hooks(g);
    // saves from before the keeper's chests had their own names get them
    if (g.flags.has('keepers_line'))
      for (const [xy, t] of [[OPENING.chest, 'Cellar Chest'], [RIVER.bin, 'Grain Bin']] as const) {
        const c = g.ents.at(xy[0], xy[1]);
        if (c?.def.id === 'chest_wood' && !c.st.title) c.st.title = t;
      }
    // a visit that never got its scene (the day ended) starts again
    if (keeper(g).visit === 1) keeper(g).visit = 0;
    // days 2-7: the keeper's granary tops the grain bin up to 20 barley, so the restored mill has
    // something to grind until barley you sow ripens (the cellar does the same for the crocks' beans)
    const bin = g.flags.has('keepers_line') && g.dayIndex >= 1 && g.dayIndex <= 6 ? g.ents.at(RIVER.bin[0], RIVER.bin[1]) : null;
    const short = bin?.inv && bin.def.kind === 'chest' ? 20 - bin.inv.countId('barley') : 0;
    if (bin && short > 0 && bin.inv!.add(key('barley'), short) < short && !bin.st.rust)
      g.toast(g.dayIndex === 6 ? "The granary's last sack of barley came down for the mill. Sow barley of your own: it takes 5 days." : "The keeper's granary sent down barley for the mill.", 'i:barley');
  },
  tick(g) {
    if (g.tickN % 30 !== 0 || g.map.w < 100) return;
    scanLessons(g);
    if (!g.flags.has('keepers_line')) return;
    const k = keeper(g);
    const q = questSys(g);
    if (k.visit === 0 && active(g, 'k2_springs') && g.player.where === 'world') startVisit(g);
    // the keeper's jar runs at 4x until the line is whole (B3)
    const jar = g.ents.at(OPENING.jar[0], OPENING.jar[1]);
    if (jar?.st.keeper && jar.st.quick > 3 && q.done.includes('k3_hands')) jar.st.quick = 0;
    // safety nets: a mainspring sold or dropped before its arm was restored comes again, and so do
    // seeds planted somewhere other than the gleaner's bed
    const armNeedsSpring = (xy: [number, number]) => !!g.ents.at(xy[0], xy[1])?.st.rust;
    const springsWanted = (k.visit === 2 && active(g, 'k2_springs') && armNeedsSpring(OPENING.armTile)) || (active(g, 'k5_desk') && armNeedsSpring(OPENING.gleanArm));
    // once a day: a spring stashed in a chest (or dropped from a full bag) isn't lost, so no stream of them
    if (springsWanted && g.player.inv.countId('spring') === 0 && k.springDay !== g.dayIndex) {
      k.springDay = g.dayIndex;
      g.give(key('spring'), 1);
      g.toast('Prof. Cogwhistle sent another mainspring over. "Try to keep this one!"', 'i:spring');
    }
    // B2's arm restored over an empty crock has nothing to carry: the cellar tips a few beans in
    // (the critic's Phase 2 Minor: the step waited for a pickle that could never come)
    if (active(g, 'k2_springs') && jar?.mach && !armNeedsSpring(OPENING.armTile) && k.beanDay !== g.dayIndex
      && ![...jar.mach.inBuf.values()].some((n) => n > 0) && !jar.mach.outBuf.length && !jar.working && g.player.inv.countId('cogbean') === 0) {
      k.beanDay = g.dayIndex;
      jar.mach.inBuf.set(key('cogbean'), 3);
      g.toast("The Professor tipped three beans from the keeper's cellar into the crock: watch the arm.", 'i:cogbean');
    }
    const bedBare = OPENING.bed.some(([x, y]) => !g.soil.get(g.map.idx(x, y))?.crop);
    if (active(g, 'k4_grow') && bedBare && g.player.inv.countId('cogbean_seed') === 0 && k.seedDay !== g.dayIndex) {
      k.seedDay = g.dayIndex;
      g.give(key('cogbean_seed'), 4);
      g.toast("The keeper's cellar sent up 4 cogbean seeds for the gleaner's bed.", 'i:cogbean_seed');
    }
    // Rush starts with Conveyance known: B5's "pick the topic" step is already done
    if (g.research.done.has('r_belts')) g.flags.add('study:r_belts');
    if (q.done.includes('k3_hands')) lesson(g, 'line');
    // Rowan's thanks for B7 is the cogbean oil recipe: one input, two recipes
    if (q.done.includes('k7_town')) lesson(g, 'recipes');
    riverNets(g, k);
    if (g.flags.has('study:r_belts')) lesson(g, 'stages');
    // B6's "find out why it stopped": a second jar that never starved (its chest had beans to
    // spare) has nothing to read, so making its pickles counts instead
    const j2 = secondJar(g);
    if (active(g, 'k6_bottleneck') && j2 && (j2.mach?.made ?? 0) >= 3) g.flags.add('read:starved');
    // B5's "watch a bean ride the belt": if the gleaner's basket and the belts are empty once
    // everything is restored, there is nothing to ride; don't hold the chain on it
    if (active(g, 'k5_desk') && !g.flags.has('belt_into:jar')) {
      const at = (xy: [number, number]) => g.ents.at(xy[0], xy[1]);
      const ready = [OPENING.gleanArm, ...OPENING.belts].every((xy) => at(xy) && !at(xy)!.st.rust);
      const gl = at(OPENING.gleaner);
      const moving = OPENING.belts.some((xy) => (at(xy)?.belt?.lanes.some((l) => l.k.length) ?? false)) || !!at(OPENING.gleanArm)?.arm?.held;
      if (ready && !moving && (!gl?.inv || gl.inv.isEmpty())) g.flags.add('belt_into:jar');
    }
  },
  save(g) {
    return keeper(g);
  },
  load(g, d) {
    g.sys.keeper = { ...keeper(g), ...d };
  },
});
