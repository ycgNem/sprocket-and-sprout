// Villagers as specialists (ROADMAP.md 7.6, Phase 5): the six re-roles, Trust's numbers, Pip's
// echoes, Sable's lent records and filing, and Old Thorne's drawings for the drafting table.
import { describe, expect, it } from 'vitest';
import '../src/sim';
import { DAY_END, Game } from '../src/sim/Game';
import { NPC_BY_ID } from '../src/data/npcs';
import { ECHOES, ECHO_BY_LESSON } from '../src/data/echoes';
import { LESSONS } from '../src/data/lessons';
import { DRAWINGS } from '../src/data/drawings';
import { DISCOVERIES, RECORDS } from '../src/data/archive';
import { CHAMBER_BY_KIND } from '../src/data/deepworks';
import { QUEST_BY_ID, REQUEST_POOL } from '../src/data/goals';
import { SHOPS, SHOP_BY_ID } from '../src/data/shops';
import { STRUCT_BY_ID } from '../src/data/structures';
import { ITEM_BY_ID } from '../src/data/items';
import { RECIPE_BY_ID } from '../src/data/recipes';
import { generateWorld } from '../src/sim/world/worldgen';
import { key } from '../src/sim/inventory';
import { DX, DY } from '../src/sim/ents';
import { blueprintCost, pasteBlueprint } from '../src/sim/blueprint';
import { drafting, LIB_MAX } from '../src/sim/drafting';
import { keystoneQuest } from '../src/sim/keystones';
import { MState } from '../src/sim/mstate';
import { finishHeartEvent, hearts, npcSys, POINTS_PER_HEART, TASTE_POINTS } from '../src/sim/systems/npcs';
import { objDone, questSys } from '../src/sim/systems/quests';
import { handDeliver, orders, type Order } from '../src/sim/systems/orders';
import { stages } from '../src/sim/systems/research';
import {
  answerPip, discoveryDue, drawingDue, dropPipAsk, echoDue, ECHO_TRUST, FILE_TRUST, finishAsk, giveDrawing, kindLines, machineQuestion, pipAsk, pipAskLive,
  recordDue, standBy, type Ask,
} from '../src/sim/people';

const SIX = ['juniper', 'bram', 'sable', 'thorne', 'hazel', 'pip'];

/** the last 'event' window the sim asked for since the events were cleared */
function lastEvent(g: Game): any {
  return ([...g.events].reverse().find((e: any) => e.t === 'ui' && e.open === 'event') as any)?.arg ?? null;
}
function lastDialog(g: Game): any {
  return ([...g.events].reverse().find((e: any) => e.t === 'ui' && e.open === 'dialog') as any)?.arg ?? null;
}
/** talk to a villager as F does (no item in hand) */
function talk(g: Game, id: string) {
  const n = npcSys(g).byId.get(id)!;
  g.player.inv.slots[g.player.sel] = null;
  g.events.length = 0;
  npcSys(g).interact(g, n);
  g.sys.dialogue = null;
  return n;
}
function nextDay(g: Game) {
  g.time.min = DAY_END - 0.001;
  g.tick();
}
function met(g: Game, id: string) {
  const n = npcSys(g).byId.get(id)!;
  n.met = true;
  return n;
}
function startQuest(g: Game, id: string) {
  const def = QUEST_BY_ID.get(id)!;
  questSys(g).active.push({ id, prog: def.objectives.map(() => 0), day: g.dayIndex });
}

describe('the six re-roles', () => {
  it('keep their people and gain a works trade, each with ~40 lines', () => {
    const jobs: Record<string, RegExp> = { juniper: /millwright/i, bram: /foundry/i, sable: /archivist/i, thorne: /engineer/i, hazel: /draughtswoman/i, pip: /apprentice/i };
    for (const id of SIX) {
      const d = NPC_BY_ID.get(id)!;
      expect(d.job, id).toMatch(jobs[id]);
      expect(d.dialogue.length, `${id} lines`).toBeGreaterThanOrEqual(38);
      // conditions spread over the lines: seasons, Trust, the town's keystones
      expect(d.dialogue.some((l) => l.season !== undefined), `${id} seasonal`).toBe(true);
      expect(d.dialogue.some((l) => l.minH !== undefined), `${id} trust-gated`).toBe(true);
      expect(d.dialogue.some((l) => l.flag !== undefined || l.noFlag !== undefined), `${id} keystone-aware`).toBe(true);
      // the house style: no em dashes anywhere they speak
      const all = [d.intro, d.bio, ...d.dialogue.map((l) => l.text), ...Object.values(d.giftReplies).flat(), ...d.heartEvents.flatMap((e) => e.lines.map((l) => l.text))];
      for (const t of all) expect(t.includes('—'), `${id}: ${t.slice(0, 40)}`).toBe(false);
      // gifts lean to the works: every id a real item
      for (const list of Object.values(d.gifts)) for (const s of list) if (s[0] !== '#') expect(ITEM_BY_ID.has(s), `${id} gift ${s}`).toBe(true);
    }
  });

  it("have new 2- and 4-Trust events at real places, in sensible windows", () => {
    const titles: Record<string, [string, string]> = {
      juniper: ['True on the Shaft', "Elsbeth's Wheel"], bram: ['Reading the Flame', 'The Old Foundry'], sable: ['The Back Room', 'The Last Entry'],
      thorne: ['The Drawing Chest', 'The Night the Fires Went Out'], hazel: ['Leading Lines', 'The Drafting Table'], pip: ['The Spoon Wheel', "The Apprentice's Notebook"],
    };
    const maps = [1, 7, 42].map((s) => generateWorld(s));
    for (const id of SIX) {
      const d = NPC_BY_ID.get(id)!;
      for (const [i, h] of [2, 4].entries()) {
        const ev = d.heartEvents.find((e) => e.hearts === h)!;
        expect(ev.title, `${id} ${h}`).toBe(titles[id][i]);
        for (const m of maps) expect(m.locs.has(ev.loc), `${id} ${h} at ${ev.loc}`).toBe(true);
        expect(ev.window[0], `${id} ${h} opens`).toBeGreaterThanOrEqual(360);
        expect(ev.window[1] - ev.window[0], `${id} ${h} window`).toBeGreaterThanOrEqual(120);
        expect(ev.window[1], `${id} ${h} closes`).toBeLessThanOrEqual(1440);
        expect(ev.lines.length, `${id} ${h} lines`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('sell the works: the Joinery its wooden machines, the foundry a blast furnace; Hazel asks for pigment', () => {
    for (const m of ['waterwheel', 'windmill', 'hand_loom', 'gleaner', 'sawmill', 'thresher']) {
      const where = SHOPS.filter((s) => s.stock.some((e) => e.item === m)).map((s) => s.id);
      expect(where, m).toEqual(['carpenter']);
    }
    expect(SHOP_BY_ID.get('smithy')!.stock.find((e) => e.item === 'blast_furnace')?.unlock).toBe('rep:bram:3');
    expect(QUEST_BY_ID.get('k10_mill')!.giver).toBe('juniper');
    expect(QUEST_BY_ID.get('k11_boiler')!.giver).toBe('thorne');
    expect([...QUEST_BY_ID.values()].find((q) => q.id.startsWith('k16'))!.giver).toBe('thorne');
    const hazel = REQUEST_POOL.filter((r) => r.npc === 'hazel').map((r) => r.item);
    expect(hazel).toContain('pigment');
    expect(hazel).toContain('starch_paste');
  });
});

describe('Trust', () => {
  it('a loved gift is 27, a standing order 100 (150 a big one), a Today ask 120', () => {
    expect(TASTE_POINTS).toEqual({ love: 27, like: 15, neutral: 7, dislike: -7, hate: -13 });
    const g = new Game({ seed: 3 });
    const j = met(g, 'juniper');
    j.talked = true;
    g.player.inv.slots[g.player.sel = 0] = { k: key('beam'), n: 1 };
    g.events.length = 0;
    npcSys(g).interact(g, j);
    expect(j.points).toBe(27);
    // a standing order, filled by hand
    const b = met(g, 'bram');
    const os = orders(g);
    const post = (def: string, spec: string, n: number) => {
      const o: Order = { uid: os.uid++, kind: 'standing', def, cust: 'bram', lines: [{ spec, n, have: 0 }], day: g.dayIndex, due: g.dayIndex + 7, unit: 1, rep: 1 };
      os.open.push(o);
      g.player.inv.slots[g.player.sel] = { k: key(spec), n };
      expect(handDeliver(g, 'bram', key(spec))).toBe(true);
    };
    post('bram_coal', 'coal', 30);
    expect(b.points).toBe(100);
    post('bram_iron', 'iron_bar', 20);
    expect(b.points).toBe(250);
    expect(hearts(b)).toBe(1);
    // a Today ask
    const h = met(g, 'hazel');
    os.open.push({ uid: os.uid++, kind: 'today', def: 'req:hazel:pigment', cust: 'hazel', lines: [{ spec: 'pigment', n: 3, have: 0 }], day: g.dayIndex, due: g.dayIndex, pay: 100, rep: 0 });
    g.player.inv.slots[g.player.sel] = { k: key('pigment'), n: 3 };
    expect(handDeliver(g, 'hazel', key('pigment'))).toBe(true);
    expect(h.points).toBe(120);
  });

  it('a main quest gives its giver 100, not twice when its reward already gives them Trust', () => {
    const g = new Game({ seed: 5 });
    const q = QUEST_BY_ID.get('k11_boiler')!;
    expect(q.main && !q.reward.friendship).toBe(true);
    const t = met(g, 'thorne');
    questSys(g).active.push({ id: q.id, prog: q.objectives.map(() => 1e6), day: 0 });
    g.research.done.add('r_sawmill');
    g.research.done.add('r_steam');
    g.flags.add('gallery_shored');
    questSys(g).notify(g, 'tick', 0);
    expect(questSys(g).done).toContain(q.id);
    expect(t.points).toBe(100);
  });
});

describe("Pip's echoes", () => {
  it('one echo per lesson card, three answers, a right one', () => {
    expect(ECHOES.length).toBe(LESSONS.length);
    for (const l of LESSONS) expect(ECHO_BY_LESSON.has(l.id), l.id).toBe(true);
    for (const e of ECHOES) {
      expect(new Set(e.answers).size).toBe(3);
      expect([0, 1, 2]).toContain(e.right);
    }
  });

  it('asks a seen card back: right is +60 Trust and the notebook, not a heart event', () => {
    const g = new Game({ seed: 11 });
    for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f);
    const pip = met(g, 'pip');
    // nothing seen, nothing asked: an ordinary chat
    talk(g, 'pip');
    expect(lastEvent(g)).toBeNull();
    expect(lastDialog(g)).not.toBeNull();
    g.flags.add('lesson:arm');
    pip.talked = true;
    const before = pip.points;
    talk(g, 'pip');
    const ev = lastEvent(g);
    expect(ev.title).toBe("Pip's Question");
    const ask = ev.ask as Ask;
    expect(ask).toEqual({ kind: 'echo', id: 'arm', right: 1 });
    expect(ev.choice.options.length).toBe(3);
    expect(ev.choice.options[1].reply).toMatch(/I wrote it in my notebook!/);
    finishAsk(g, ask, 1);
    expect(g.flags.has('echo:arm')).toBe(true);
    expect(pip.points).toBe(before + ECHO_TRUST);
    // not a heart event: none counted or seen, no cutscene, no 60 + friendship
    expect(g.counters.heart_events ?? 0).toBe(0);
    expect(pip.seen).toEqual([]);
    expect(g.sys.cutscene ?? null).toBeNull();
    // one a day: another card seen today waits for tomorrow
    g.flags.add('lesson:belt');
    talk(g, 'pip');
    expect(lastEvent(g)).toBeNull();
    nextDay(g);
    expect(echoDue(g)?.lesson).toBe('belt');
  });

  it('wrong: Pip explains, nothing is lost, and it comes back another day', () => {
    const g = new Game({ seed: 12 });
    for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f);
    const pip = met(g, 'pip');
    pip.talked = true;
    g.flags.add('lesson:rust');
    const before = pip.points;
    talk(g, 'pip');
    const ev = lastEvent(g);
    const ask = ev.ask as Ask;
    expect(ask.id).toBe('rust');
    const wrong = ask.right === 0 ? 1 : 0;
    expect(ev.choice.options[wrong].reply).toBe(ECHO_BY_LESSON.get('rust')!.no);
    finishAsk(g, ask, wrong);
    expect(pip.points).toBe(before);
    expect(g.flags.has('echo:rust')).toBe(false);
    expect(g.flags.has('echo_miss:rust')).toBe(true);
    expect(echoDue(g)).toBeNull();
    // closing the window without an answer changes nothing at all (a card the night showed aside)
    nextDay(g);
    for (const f of [...g.flags]) if (f.startsWith('lesson:') && f !== 'lesson:rust') g.flags.delete(f);
    talk(g, 'pip');
    finishAsk(g, lastEvent(g).ask, -1);
    expect(g.flags.has('echo:rust')).toBe(false);
    expect(echoDue(g)?.lesson).toBe('rust');
    // a fresh card comes before the missed one
    g.flags.add('lesson:post');
    expect(echoDue(g)?.lesson).toBe('post');
  });

  it("at the farm, Pip asks what one of your machines is doing: its line among two others it could show", () => {
    const g = new Game({ seed: 13 });
    for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f);
    const crock = g.ents.all().find((e) => e.def.id === 'jar')!;
    crock.st.rust = false;
    crock.state = MState.Starved;
    crock.why = 'Waiting for cogbean';
    const m = machineQuestion(g, crock);
    expect(m.q).toMatch(/stopped/);
    expect(m.answers.length).toBe(3);
    expect(m.answers[m.right]).toBe('Waiting for cogbean');
    expect(new Set(m.answers).size).toBe(3);
    // every answer is a line a crock shows, one of them another input it could be waiting for; never
    // a fire or the grid (a crock has neither), never "waiting to be fed" against "waiting for cogbeans"
    const lines = kindLines(g, crock);
    for (const a of m.answers) expect(lines, a).toContain(a);
    expect(m.answers.filter((a) => a.startsWith('Waiting for ')).length).toBe(2);
    expect(m.answers.some((a) => /fuel|power|grid|to be fed/.test(a))).toBe(false);
    // the same for every state a crock can be in, on any day
    for (const why of ['Output full: nothing takes its goods away', 'Waiting to be fed', 'Working: Pickled Cogbean']) {
      crock.why = why;
      for (let d = 0; d < 6; d++) {
        g.time.day = 1 + d;
        const k = machineQuestion(g, crock);
        expect(k.answers[k.right]).toBe(why);
        expect(new Set(k.answers).size).toBe(3);
        for (const a of k.answers) expect(lines, a).toContain(a);
      }
    }
    g.time.day = 1;
    crock.why = 'Waiting for cogbean';
    // a furnace's include its fire, a gleaner's its field
    expect(kindLines(g, { def: STRUCT_BY_ID.get('furnace'), mach: { station: 'smelter' } } as any)).toContain('Needs fuel: wood or coal');
    expect(kindLines(g, { def: STRUCT_BY_ID.get('gleaner') } as any)).toContain('No crops in reach: plant around it');
    // standing beside it on a free tile, and asked there: on a card beside the play, not a window
    const spot = standBy(g, crock)!;
    expect(spot).not.toBeNull();
    const pip = met(g, 'pip');
    pip.talked = true;
    pip.x = spot[0] + 0.5;
    pip.y = spot[1] + 0.9;
    g.sys.visits = { npc: 'pip', talked: false, ent: crock.id, asked: false };
    const before = pip.points;
    talk(g, 'pip');
    expect(lastEvent(g)).toBeNull();
    const a = pipAsk(g)!;
    expect(a.q).toMatch(/preserving crock/i);
    expect(a.answers).toEqual(m.answers);
    expect(pipAskLive(g)).toBe(true);
    // put away: asked again on the next talk
    dropPipAsk(g);
    expect(pipAsk(g)).toBeNull();
    talk(g, 'pip');
    expect(pipAsk(g)!.answers).toEqual(m.answers);
    // the crock moved on while you looked: the line it shows now is right too
    const other = a.answers.findIndex((x, i) => i !== a.right && x.startsWith('Waiting for '));
    crock.why = pipAsk(g)!.answers[other];
    answerPip(g, other);
    expect(pipAsk(g)!.ok).toBe(true);
    expect(pipAsk(g)!.reply).toMatch(/notebook/);
    expect(pip.points).toBe(before + ECHO_TRUST);
    expect(g.sys.visits.asked).toBe(true);
    // asked once a visit: then the visit's own line
    dropPipAsk(g);
    talk(g, 'pip');
    expect(pipAsk(g)).toBeNull();
    expect(lastEvent(g)).toBeNull();
  });

  it("a wrong answer gets the machine's own line back, and the card goes when you leave the farm", () => {
    const g = new Game({ seed: 14 });
    const crock = g.ents.all().find((e) => e.def.id === 'jar')!;
    crock.st.rust = false;
    crock.state = MState.Blocked;
    crock.why = 'Output full: nothing takes its goods away';
    const pip = met(g, 'pip');
    pip.talked = true;
    const spot = standBy(g, crock)!;
    pip.x = spot[0] + 0.5;
    pip.y = spot[1] + 0.9;
    g.sys.visits = { npc: 'pip', talked: false, ent: crock.id, asked: false };
    const before = pip.points;
    talk(g, 'pip');
    const a = pipAsk(g)!;
    answerPip(g, (a.right + 1) % 3);
    expect(a.ok).toBe(false);
    expect(a.reply).toContain('"Output full: nothing takes its goods away"');
    expect(pip.points).toBe(before);
    // a second visit's question, then you go indoors: it's put away
    g.sys.visits.asked = false;
    dropPipAsk(g);
    talk(g, 'pip');
    expect(pipAskLive(g)).toBe(true);
    g.player.where = 'house';
    expect(pipAskLive(g)).toBe(false);
    expect(pipAsk(g)).toBeNull();
  });
;
});

describe("Sable's archive", () => {
  it('lends the record of a chamber seen before its quest asked, only while that quest is on', () => {
    expect(RECORDS.map((r) => r.kind).sort()).toEqual(['boiler', 'lampworks', 'lockers', 'star']);
    // the fallen star's keystone has no main quest yet (its look counts at the chamber), so its record waits for one
    expect(RECORDS.filter((r) => keystoneQuest(CHAMBER_BY_KIND.get(r.kind)!.teaches!)?.main).map((r) => r.kind)).toEqual(['boiler', 'lampworks', 'lockers']);
    const g = new Game({ seed: 21 });
    const sable = met(g, 'sable');
    sable.talked = true;
    // seen (its card), but Down to the Boiler isn't on: no record, and the look isn't taken
    g.flags.add('card:boiler');
    expect(recordDue(g)).toBeNull();
    talk(g, 'sable');
    expect(lastEvent(g)).toBeNull();
    expect(g.flags.has('observed:boiler')).toBe(false);
    // the quest on: Sable offers it, and taking it is the look
    startQuest(g, 'k11_boiler');
    expect(recordDue(g)).toBe('boiler');
    talk(g, 'sable');
    const ev = lastEvent(g);
    expect(ev.title).toBe('The Archive');
    expect(ev.ask).toEqual({ kind: 'record', id: 'boiler' });
    finishAsk(g, ev.ask, 0);
    expect(g.flags.has('observed:boiler')).toBe(true);
    expect(stages(g, 'r_steam').observe).toBe(true);
    const step = QUEST_BY_ID.get('k11_boiler')!.objectives.find((o) => o.t === 'stage')!;
    expect(objDone(g, step, 0)).toBe(true);
    expect(recordDue(g)).toBeNull();
  });

  it('"not now" waits a day; never a chamber you have not seen', () => {
    const g = new Game({ seed: 22 });
    const sable = met(g, 'sable');
    sable.talked = true;
    startQuest(g, 'k11_boiler');
    expect(recordDue(g)).toBeNull();
    g.flags.add('card:boiler');
    talk(g, 'sable');
    finishAsk(g, lastEvent(g).ask, 1);
    expect(g.flags.has('observed:boiler')).toBe(false);
    talk(g, 'sable');
    expect(lastEvent(g)).toBeNull();
    nextDay(g);
    talk(g, 'sable');
    expect(lastEvent(g)?.ask?.id).toBe('boiler');
  });

  it('files each new discovery once, +60 Trust a time', () => {
    const g = new Game({ seed: 23 });
    const sable = met(g, 'sable');
    sable.talked = true;
    for (const f of [...g.flags]) if (DISCOVERIES.some((d) => d.flags.includes(f))) g.flags.delete(f);
    expect(discoveryDue(g)).toBeNull();
    g.flags.add('observed:belt_1');
    g.flags.add('town_mill');
    const before = sable.points;
    talk(g, 'sable');
    expect(lastDialog(g).pages.join(' ')).toMatch(/belt run/);
    expect(sable.points).toBe(before + FILE_TRUST);
    talk(g, 'sable');
    expect(lastDialog(g).pages.join(' ')).toMatch(/Town Mill turns/);
    expect(sable.points).toBe(before + 2 * FILE_TRUST);
    // filed: an ordinary chat now
    talk(g, 'sable');
    expect(sable.points).toBe(before + 2 * FILE_TRUST);
    expect(g.flags.has('filed:belt_1') && g.flags.has('filed:k_mill')).toBe(true);
  });
});

describe("Thorne's drawings", () => {
  it('each pastes whole into a blank map: real pieces, arms between their ends', () => {
    expect(DRAWINGS.map((d) => d.after)).toEqual(['heart_thorne_2', 'town_mill', 'waterworks', 'tram']);
    for (const d of DRAWINGS) {
      const bp = d.bp;
      // every arm takes from a piece behind it and drops onto one in front
      const covers = (x: number, y: number) => bp.items.some((it) => {
        const s = STRUCT_BY_ID.get(it.def)!;
        return s.kind !== 'arm' && x >= it.dx && x < it.dx + s.size[0] && y >= it.dy && y < it.dy + s.size[1];
      });
      for (const it of bp.items.filter((i) => STRUCT_BY_ID.get(i.def)!.kind === 'arm')) {
        expect(covers(it.dx - DX[it.rot], it.dy - DY[it.rot]), `${d.id} arm at ${it.dx},${it.dy} takes`).toBe(true);
        expect(covers(it.dx + DX[it.rot], it.dy + DY[it.rot]), `${d.id} arm at ${it.dx},${it.dy} drops`).toBe(true);
      }
      for (const it of bp.items) if (it.recipe) expect(RECIPE_BY_ID.has(it.recipe), it.recipe).toBe(true);
      const g = new Game({ seed: 1, blank: { w: 20, h: 20 } });
      g.player.x = 19.5;
      g.player.y = 19.5;
      for (const [item, n] of blueprintCost(bp)) g.player.inv.add(key(item), n);
      const r = pasteBlueprint(g, bp, 3, 3);
      expect(r, d.id).toEqual({ placed: bp.items.length, ghosts: 0 });
      for (const it of bp.items) {
        const e = g.ents.at(3 + it.dx, 3 + it.dy)!;
        expect(e?.def.id, `${d.id} ${it.def}`).toBe(it.def);
        if (it.recipe) expect(e.mach?.recipe?.id === it.recipe && e.mach.locked, `${d.id} locked on ${it.recipe}`).toBe(true);
      }
    }
  });

  it('the first at the end of his 2-Trust event, the rest as the town wakes and his Trust grows; all in the library', () => {
    expect(DRAWINGS.map((d) => d.trust)).toEqual([2, 4, 6, 8]);
    const g = new Game({ seed: 31 });
    const t = met(g, 'thorne');
    t.talked = true;
    t.points = 2 * POINTS_PER_HEART;
    expect(drawingDue(g)).toBeNull();
    // the event's own flag is set when it starts; the drawing comes when it ends
    g.flags.add('heart_thorne_2');
    g.events.length = 0;
    finishHeartEvent(g, 'thorne', 0);
    const lib = () => drafting(g).lib;
    expect(lib().map((e) => [e.name, e.from])).toEqual([["The keeper's crock line", 'thorne']]);
    // (no drafting table yet: the toast says where one comes from)
    expect(g.events.some((e: any) => e.t === 'toast' && /Juniper can build a drafting table/.test(e.text))).toBe(true);
    // a keystone done, but the mill line waits for Trust 4; then his next talk brings it
    g.flags.add('town_mill');
    talk(g, 'thorne');
    expect(lib().length).toBe(1);
    t.points = 4 * POINTS_PER_HEART;
    talk(g, 'thorne');
    expect(lastDialog(g).pages.join(' ')).toMatch(/Bin, arm, mill, arm, chest/);
    expect(lib().map((e) => e.name)).toEqual(["The keeper's crock line", 'A mill line']);
    talk(g, 'thorne');
    expect(lib().length).toBe(2);
    g.flags.add('waterworks');
    g.flags.add('tram');
    t.points = 6 * POINTS_PER_HEART;
    talk(g, 'thorne');
    talk(g, 'thorne');
    expect(lib().map((e) => e.name)).toEqual(["The keeper's crock line", 'A mill line', 'A smelting line']);
    t.points = 8 * POINTS_PER_HEART;
    talk(g, 'thorne');
    expect(lib().map((e) => e.name)).toEqual(["The keeper's crock line", 'A mill line', 'A smelting line', "The clock's gear line"]);
    expect(drawingDue(g)).toBeNull();
  });

  it('a full library keeps the drawing for later', () => {
    const g = new Game({ seed: 32 });
    met(g, 'thorne').points = 4 * POINTS_PER_HEART;
    const lib = drafting(g).lib;
    while (lib.length < LIB_MAX) lib.push({ name: 'Mine ' + lib.length, bp: DRAWINGS[0].bp, from: '', day: 0 });
    g.flags.add('town_mill');
    expect(giveDrawing(g, drawingDue(g)!)).toBe(false);
    talk(g, 'thorne');
    expect(lastDialog(g).pages.join(' ')).toMatch(/drafting table's full/);
    lib.pop();
    talk(g, 'thorne');
    expect(lib[lib.length - 1].name).toBe('A mill line');
  });
});

describe('saves', () => {
  it("keep Pip's next question day, the notebook, the filing and Thorne's drawings", async () => {
    const { serialize, deserialize } = await import('../src/sim/save');
    const look = { skin: 1, hair: 2, hairStyle: 'short' as const, shirt: 3, pants: 4 };
    const g = new Game({ seed: 41 });
    for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f);
    const pip = met(g, 'pip');
    g.flags.add('lesson:arm');
    talk(g, 'pip');
    finishAsk(g, lastEvent(g).ask, 1);
    met(g, 'thorne').points = 2 * POINTS_PER_HEART;
    g.flags.add('heart_thorne_2');
    finishHeartEvent(g, 'thorne', 0);
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(npcSys(g2).byId.get('pip')!.askDay).toBe(pip.askDay);
    expect(g2.flags.has('echo:arm')).toBe(true);
    expect(drafting(g2).lib.map((e) => [e.name, e.from])).toEqual([["The keeper's crock line", 'thorne']]);
    expect(drawingDue(g2)).toBeNull();
  });
});
