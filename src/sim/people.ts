// The specialists' own talks (ROADMAP.md 7.6, Phase 5). Talking to three of the re-roled villagers
// can do more than chat:
// - Pip, the apprentice, asks a lesson card back (an echo: one a day, three answers), and on a fine
//   afternoon at your farm asks about the machine they're standing by, its real state among the answers.
// - Sable, the archivist, lends the old works' record of a chamber you saw before its keystone's quest
//   asked (it counts as the look), and files each new discovery you tell them about.
// - Old Thorne, the old works' last engineer, hands over his drawings for the drafting table's library.
// A pure module with no system of its own (import order is tick order, src/sim/index.ts): it hangs
// its talks on npcs.ts's TALK_HOOKS and EVENT_HOOKS when it's imported, and visits.ts asks it where
// Pip stands. The answers come back through the event window's choice (src/ui/windows/town.ts) to
// finishAsk.
import { DISCOVERIES, RECORDS, type DiscoveryDef } from '../data/archive';
import { CHAMBER_BY_KIND, type ChamberKind } from '../data/deepworks';
import { DRAWINGS, type DrawingDef } from '../data/drawings';
import { ECHO_BY_LESSON, type EchoDef } from '../data/echoes';
import { LESSON_BY_ID } from '../data/lessons';
import { NPC_BY_ID } from '../data/npcs';
import { C } from '../data/palette';
import { RESEARCH_BY_ID } from '../data/research';
import type { Game } from './Game';
import type { Ent } from './ents';
import { addBlueprint } from './drafting';
import { keystoneQuest } from './keystones';
import { lessonsSeen } from './lessons';
import { MState, isProblem } from './mstate';
import { addPoints, EVENT_HOOKS, fillTokens, npcSys, openDialog, TALK_HOOKS, type NPCState } from './systems/npcs';

/** Trust for an echo answered right (Pip) and for a discovery filed (Sable) */
export const ECHO_TRUST = 60;
export const FILE_TRUST = 60;

/** a question a villager asks you through the event window's choice */
export interface Ask {
  kind: 'echo' | 'machine' | 'record';
  /** the echo's lesson, the record's chamber, the machine's entity id */
  id: string;
  /** the right answer (echoes and machines) */
  right?: number;
}

interface AskLine {
  who: string;
  text: string;
}

/** a day's dice that never touch g.rng (a roll there would move every later roll, and the pace bot's numbers) */
export function dayHash(g: Game, salt: number): number {
  let h = (g.seed ^ Math.imul(g.dayIndex + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** open the event window with a choice that comes back to finishAsk (not a heart event: no 60, no count) */
function openAsk(g: Game, n: NPCState, title: string, lines: AskLine[], prompt: string, options: { text: string; reply: string }[], ask: Ask) {
  const d = NPC_BY_ID.get(n.id)!;
  // the villager stops walking while you answer (and no heart event starts over it)
  g.sys.dialogue = { npc: n.id };
  g.emit({ t: 'sfx', id: 'chime', v: 0.6 });
  g.emit({
    t: 'ui', open: 'event',
    arg: {
      npc: n.id, title,
      lines: lines.map((l) => ({ who: l.who === 'npc' ? d.name : l.who === 'player' ? g.player.name : '', text: fillTokens(g, l.text), npcId: l.who === 'npc' ? n.id : null })),
      choice: { prompt: fillTokens(g, prompt), options: options.map((o) => ({ text: fillTokens(g, o.text), reply: fillTokens(g, o.reply), friendship: 0 })) },
      ask,
    },
  });
}

/** the event window's answer (pick -1: closed without one, so nothing happens and it can be asked again) */
export function finishAsk(g: Game, ask: Ask, pick: number) {
  if (g.sys.dialogue) g.sys.dialogue = null;
  const pip = npcSys(g).byId.get('pip');
  switch (ask.kind) {
    case 'echo':
      if (pick < 0) return;
      // one a day, right or wrong
      if (pip) pip.askDay = g.dayIndex + 1;
      if (pick === ask.right) {
        g.flags.add('echo:' + ask.id);
        g.flags.delete('echo_miss:' + ask.id);
        if (pip) addPoints(g, pip, ECHO_TRUST);
        g.count('echoes');
        g.emit({ t: 'sfx', id: 'heart' });
      } else g.flags.add('echo_miss:' + ask.id);
      return;
    case 'machine':
      if (pick < 0) return;
      if (g.sys.visits?.npc === 'pip') g.sys.visits.asked = true;
      if (pick === ask.right && pip) {
        addPoints(g, pip, ECHO_TRUST);
        g.count('echoes');
        g.emit({ t: 'sfx', id: 'heart' });
      }
      return;
    case 'record':
      if (pick === 0) lendRecord(g, ask.id as ChamberKind);
      // "not today": Sable asks again tomorrow
      else if (pick > 0) g.sys.recordNo = g.dayIndex;
      return;
  }
}

// ---------------- Pip's echoes ----------------

/** the echo Pip asks next: a lesson card you've seen and Pip hasn't checked (one a day); a missed one comes back last */
export function echoDue(g: Game): EchoDef | null {
  const pip = npcSys(g).byId.get('pip');
  if (!pip?.met || (pip.askDay ?? 0) > g.dayIndex) return null;
  const open = lessonsSeen(g).filter((id) => ECHO_BY_LESSON.has(id) && !g.flags.has('echo:' + id));
  const id = open.find((x) => !g.flags.has('echo_miss:' + x)) ?? open[0];
  return id ? ECHO_BY_LESSON.get(id)! : null;
}

function askEcho(g: Game, n: NPCState, e: EchoDef) {
  const title = LESSON_BY_ID.get(e.lesson)?.title ?? 'a lesson';
  const lead = g.flags.has('echo_miss:' + e.lesson)
    ? `{player}! Remember the "${title}" card? I asked you before. Can I try again?`
    : `{player}! I copied the "${title}" card into my notebook. Can I test you on it?`;
  openAsk(g, n, "Pip's Question", [{ who: 'npc', text: lead }], e.q, e.answers.map((a, i) => ({ text: a, reply: i === e.right ? `${e.yes} I wrote it in my notebook!` : e.no })), { kind: 'echo', id: e.lesson, right: e.right });
}

// ---------------- Pip at the farm ----------------

/** a machine of yours Pip can stand by and ask about (machines and gleaners, not the town's fixtures) */
export function pipMachines(g: Game): Ent[] {
  return g.ents.all().filter((e) => !e.ghost && !e.parent && !e.st.rust && !e.st.fixed && (!!e.mach || e.def.kind === 'gleaner'));
}

/** a free tile beside a structure where Pip can stand: below it first, then its sides, then above */
export function standBy(g: Game, e: Ent): [number, number] | null {
  const spots: [number, number][] = [];
  for (let x = e.x; x < e.x + e.w; x++) spots.push([x, e.y + e.h]);
  for (let y = e.y; y < e.y + e.h; y++) spots.push([e.x - 1, y], [e.x + e.w, y]);
  for (let x = e.x; x < e.x + e.w; x++) spots.push([x, e.y - 1]);
  return spots.find(([x, y]) => g.map.walkable(x, y) && !g.ents.at(x, y)) ?? null;
}

/** what each state looks like when it isn't the answer (and the answer, for a state with no detail line) */
const STATE_GIST: Record<MState, string> = {
  [MState.Idle]: 'Nothing has asked it for anything',
  [MState.Working]: 'Busy making something',
  [MState.Starved]: 'Waiting for something to work on',
  [MState.Blocked]: 'Its goods have nowhere to go',
  [MState.Unpowered]: 'No sparks reach it',
  [MState.NeedsFuel]: 'Its fire has gone out',
};

/** "Why is this crock stopped?": the machine's own line now, among two other states' */
export function machineQuestion(g: Game, e: Ent): { q: string; answers: string[]; right: number; why: string } {
  const s = e.state ?? MState.Idle;
  const name = e.def.name.toLowerCase();
  let why = (e.why || STATE_GIST[s]).trim();
  if (why.length > 60) why = why.slice(0, why.lastIndexOf(' ', 57)) + '...';
  const q = s === MState.Working ? `What's this ${name} doing right now?` : isProblem(s) ? `Why is this ${name} stopped?` : `Why is this ${name} just sitting there?`;
  const h = dayHash(g, e.id * 7 + 3);
  // never a decoy that's nearly the answer: a gleaner waiting for its field isn't "starved", a queue isn't "blocked"
  const near = e.fieldWait ? MState.Starved : e.queued ? MState.Blocked : -1;
  const others = ([MState.Idle, MState.Working, MState.Starved, MState.Blocked, MState.Unpowered, MState.NeedsFuel] as MState[])
    .filter((x) => x !== s && x !== near && STATE_GIST[x] !== why);
  const a = others[h % others.length];
  const rest = others.filter((x) => x !== a);
  const b = rest[(h >>> 8) % rest.length];
  const right = (h >>> 16) % 3;
  const answers = [STATE_GIST[a], STATE_GIST[b]];
  answers.splice(right, 0, why);
  return { q, answers, right, why };
}

function askMachine(g: Game, n: NPCState, e: Ent) {
  const m = machineQuestion(g, e);
  const name = e.def.name.toLowerCase();
  openAsk(g, n, "Pip's Question", [{ who: 'npc', text: `Psst, {player}! I've been watching your ${name} all afternoon. Can I ask you about it?` }], m.q,
    m.answers.map((a, i) => ({ text: a, reply: i === m.right ? "That's what I thought! I checked it with the I key, like you do. I wrote it in my notebook!" : `Nope! Look, it says "${m.why}". Hover it, or hold I, and a machine always tells you why.` })),
    { kind: 'machine', id: String(e.id), right: m.right });
}

function pipTalk(g: Game, n: NPCState): boolean {
  // on a farm visit, by one of your machines: what is it doing right now?
  const v = g.sys.visits;
  if (v?.npc === 'pip' && v.ent !== undefined && !v.asked) {
    const e = g.ents.get(v.ent);
    if (e && !e.ghost && Math.hypot(n.x - (e.x + e.w / 2), n.y - (e.y + e.h / 2)) < 4) {
      askMachine(g, n, e);
      return true;
    }
  }
  const echo = echoDue(g);
  if (echo) {
    askEcho(g, n, echo);
    return true;
  }
  return false;
}

// ---------------- Sable's archive ----------------

/** a chamber Sable can lend the record of: its keystone's main quest is on, you saw it (its card) but the look didn't count */
export function recordDue(g: Game): ChamberKind | null {
  const active = (g.sys.quests?.active ?? []) as { id: string }[];
  for (const r of RECORDS) {
    if (g.flags.has('observed:' + r.kind) || !g.flags.has('card:' + r.kind)) continue;
    const teaches = CHAMBER_BY_KIND.get(r.kind)?.teaches;
    const q = teaches ? keystoneQuest(teaches) : undefined;
    if (q && active.some((a) => a.id === q.id)) return r.kind;
  }
  return null;
}

/** taking Sable's record: what the chamber's own look does (mine.ts observe), then the quest's look reads as done */
export function lendRecord(g: Game, kind: ChamberKind): boolean {
  const flag = 'observed:' + kind;
  if (g.flags.has(flag)) return false;
  g.flags.add(flag);
  g.count('chambers_observed');
  g.count('records_lent');
  g.emit({ t: 'sfx', id: 'chime', v: 0.7 });
  const c = CHAMBER_BY_KIND.get(kind);
  const r = c?.teaches ? RESEARCH_BY_ID.get(c.teaches) : undefined;
  g.toast(`Sable lends you the old works' record of ${c?.name ?? kind}${r ? `: ${r.name}'s look is done` : ''}.`, undefined, C.butter);
  // telling Sable about it files it too
  const d = DISCOVERIES.find((x) => x.id === kind);
  const sable = npcSys(g).byId.get('sable');
  if (d && sable && !g.flags.has('filed:' + d.id)) {
    g.flags.add('filed:' + d.id);
    g.count('filed');
    addPoints(g, sable, FILE_TRUST);
  }
  // the quest's look step reads the flag: check it now, not at the next poll
  g.sys.quests?.notify?.(g, 'flag', 1, flag);
  return true;
}

/** the next discovery to tell Sable about (one a talk), if any */
export function discoveryDue(g: Game): DiscoveryDef | null {
  return DISCOVERIES.find((d) => !g.flags.has('filed:' + d.id) && d.flags.some((f) => g.flags.has(f))) ?? null;
}

function sableTalk(g: Game, n: NPCState, shopAfter?: string): boolean {
  const rec = recordDue(g);
  if (rec && g.sys.recordNo !== g.dayIndex) {
    const offer = RECORDS.find((r) => r.kind === rec)!.offer;
    openAsk(g, n, 'The Archive', [{ who: 'npc', text: offer }], "Borrow the old works' record?",
      [{ text: 'Borrow it. Thank you, Sable.', reply: "Here. It's filed under its own name, and now under yours as well. Bring it back when you're done." },
        { text: "Not now. I'll go and look again myself.", reply: "Of course. It'll be here when you want it." }],
      { kind: 'record', id: rec });
    return true;
  }
  const d = discoveryDue(g);
  if (d) {
    g.flags.add('filed:' + d.id);
    g.count('filed');
    addPoints(g, n, FILE_TRUST);
    n.emote = 'happy';
    n.emoteT = 2;
    openDialog(g, n, d.line, shopAfter, 1);
    return true;
  }
  return false;
}

// ---------------- Thorne's drawings ----------------

/** the next drawing Thorne owes you (its flag is set, you haven't got it) */
export function drawingDue(g: Game): DrawingDef | null {
  return DRAWINGS.find((d) => g.flags.has(d.after) && !g.flags.has('drawing:' + d.id)) ?? null;
}

/** into the drafting table's library (false: the library is full, so it waits) */
export function giveDrawing(g: Game, d: DrawingDef): boolean {
  if (!addBlueprint(g, d.name, d.bp, 'thorne')) return false;
  g.flags.add('drawing:' + d.id);
  g.count('drawings');
  g.emit({ t: 'sfx', id: 'quest' });
  g.toast("Thorne's drawing is in your drafting table's library.", undefined, C.butter);
  return true;
}

function thorneTalk(g: Game, n: NPCState, shopAfter?: string): boolean {
  const d = drawingDue(g);
  if (!d) return false;
  if (giveDrawing(g, d)) {
    openDialog(g, n, d.line, shopAfter, 1);
    return true;
  }
  // a full library: he says so once a day, and brings it again
  if (n.talked) return false;
  openDialog(g, n, "I've a drawing for you, but your drafting table's full. Make room in its library and I'll bring it again.");
  return true;
}

// ---------------- hooks ----------------

// (a shop door passes its shop, to open after the line: Thorne's Hollow)
TALK_HOOKS.push((g, n, shopAfter) => (n.id === 'pip' ? pipTalk(g, n) : n.id === 'sable' ? sableTalk(g, n, shopAfter) : n.id === 'thorne' ? thorneTalk(g, n, shopAfter) : false));

// the end of Thorne's 2-Trust event hands over the drawing he showed you (the event said the words)
EVENT_HOOKS.push((g, npcId) => {
  if (npcId !== 'thorne') return;
  const d = drawingDue(g);
  if (d && d.after === 'heart_thorne_2') giveDrawing(g, d);
});
