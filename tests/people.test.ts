// Villagers as specialists (ROADMAP.md 7.6, Phase 5): the six re-roles, no Trust left anywhere (2.1.1,
// DECISIONS #175), Pip's echoes, Sable's lent records and filing, and Old Thorne's drawings for the
// drafting table, one as each keystone wakes.
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
import { npcSys } from '../src/sim/systems/npcs';
import { objDone, questSys } from '../src/sim/systems/quests';
import { handDeliver, orders, type Order } from '../src/sim/systems/orders';
import { stages } from '../src/sim/systems/research';
import {
  answerPip, discoveryDue, drawingDue, dropPipAsk, echoDue, finishAsk, giveDrawing, kindLines, machineQuestion, pipAsk, pipAskLive,
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
      // conditions spread over the lines: seasons and the town's keystones
      expect(d.dialogue.some((l) => l.season !== undefined), `${id} seasonal`).toBe(true);
      expect(d.dialogue.some((l) => l.flag !== undefined || l.noFlag !== undefined), `${id} keystone-aware`).toBe(true);
      // the house style: no em dashes anywhere they speak
      const all = [d.intro, d.bio, ...d.dialogue.map((l) => l.text)];
      for (const t of all) expect(t.includes('—'), `${id}: ${t.slice(0, 40)}`).toBe(false);
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

describe('no Trust', () => {
  it('orders, quests and talks give no points, and nothing a villager keeps counts friendship', () => {
    const g = new Game({ seed: 3 });
    const b = met(g, 'bram');
    const os = orders(g);
    const o: Order = { uid: os.uid++, kind: 'standing', def: 'bram_coal', cust: 'bram', lines: [{ spec: 'coal', n: 30, have: 0 }], day: g.dayIndex, due: g.dayIndex + 7, unit: 1, rep: 1 };
    os.open.push(o);
    g.player.inv.slots[g.player.sel = 0] = { k: key('coal'), n: 30 };
    expect(handDeliver(g, 'bram', key('coal'))).toBe(true);
    talk(g, 'bram');
    for (const k of ['points', 'giftedToday', 'giftsWeek', 'seen', 'birthdayGift']) expect(k in b, k).toBe(false);
    for (const d of NPC_BY_ID.values()) for (const k of ['gifts', 'giftReplies', 'heartEvents', 'birthday']) expect(k in d, `${d.id} ${k}`).toBe(false);
    // what you hold stays yours: there are no gifts
    const j = met(g, 'juniper');
    g.player.inv.slots[g.player.sel] = { k: key('old_boot'), n: 1 };
    g.events.length = 0;
    npcSys(g).interact(g, j);
    expect(g.player.inv.countId('old_boot')).toBe(1);
  });

  it("an older save's Trust loads and is left behind", async () => {
    const { serialize, deserialize } = await import('../src/sim/save');
    const g = new Game({ seed: 4 });
    met(g, 'rowan');
    const d = JSON.parse(JSON.stringify(serialize(g, { skin: 1, hair: 2, hairStyle: 'short', shirt: 3, pants: 4 })));
    const r = d.sys.npcs.find((x: { id: string }) => x.id === 'rowan');
    Object.assign(r, { points: 2000, seen: [2, 4], giftsWeek: 1, giftedToday: true });
    d.flags.push('partner:rowan', 'heart_rowan_2');
    const g2 = deserialize(d).game;
    const n = npcSys(g2).byId.get('rowan')!;
    expect(n.met).toBe(true);
    expect('points' in n).toBe(false);
    nextDay(g2);
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

  it('asks a seen card back: right is the notebook', () => {
    const g = new Game({ seed: 11 });
    for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f);
    const pip = met(g, 'pip');
    // nothing seen, nothing asked: an ordinary chat
    talk(g, 'pip');
    expect(lastEvent(g)).toBeNull();
    expect(lastDialog(g)).not.toBeNull();
    g.flags.add('lesson:arm');
    pip.talked = true;
    talk(g, 'pip');
    const ev = lastEvent(g);
    expect(ev.title).toBe("Pip's Question");
    const ask = ev.ask as Ask;
    expect(ask).toEqual({ kind: 'echo', id: 'arm', right: 1 });
    expect(ev.choice.options.length).toBe(3);
    expect(ev.choice.options[1].reply).toMatch(/I wrote it in my notebook!/);
    finishAsk(g, ask, 1);
    expect(g.flags.has('echo:arm')).toBe(true);
    expect(g.counters.echoes).toBe(1);
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
    talk(g, 'pip');
    const ev = lastEvent(g);
    const ask = ev.ask as Ask;
    expect(ask.id).toBe('rust');
    const wrong = ask.right === 0 ? 1 : 0;
    expect(ev.choice.options[wrong].reply).toBe(ECHO_BY_LESSON.get('rust')!.no);
    finishAsk(g, ask, wrong);
    expect(g.counters.echoes ?? 0).toBe(0);
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
    expect(g.counters.echoes).toBe(1);
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
    talk(g, 'pip');
    const a = pipAsk(g)!;
    answerPip(g, (a.right + 1) % 3);
    expect(a.ok).toBe(false);
    expect(a.reply).toContain('"Output full: nothing takes its goods away"');
    expect(g.counters.echoes ?? 0).toBe(0);
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

  it('files each new discovery once', () => {
    const g = new Game({ seed: 23 });
    const sable = met(g, 'sable');
    sable.talked = true;
    for (const f of [...g.flags]) if (DISCOVERIES.some((d) => d.flags.includes(f))) g.flags.delete(f);
    expect(discoveryDue(g)).toBeNull();
    g.flags.add('observed:belt_1');
    g.flags.add('town_mill');
    talk(g, 'sable');
    expect(lastDialog(g).pages.join(' ')).toMatch(/belt run/);
    talk(g, 'sable');
    expect(lastDialog(g).pages.join(' ')).toMatch(/Town Mill turns/);
    expect(g.counters.filed).toBe(2);
    // filed: an ordinary chat now
    talk(g, 'sable');
    expect(g.counters.filed).toBe(2);
    expect(g.flags.has('filed:belt_1') && g.flags.has('filed:k_mill')).toBe(true);
  });
});

describe("Thorne's drawings", () => {
  it('each pastes whole into a blank map: real pieces, arms between their ends', () => {
    expect(DRAWINGS.map((d) => d.after)).toEqual([undefined, 'town_mill', 'waterworks', 'tram']);
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

  it('the first once you have met him, the rest as the town wakes; all in the library', () => {
    const g = new Game({ seed: 31 });
    const lib = () => drafting(g).lib;
    // not met: nothing yet (the first talk is his introduction)
    talk(g, 'thorne');
    expect(lib().length).toBe(0);
    g.events.length = 0;
    talk(g, 'thorne');
    expect(lastDialog(g).pages.join(' ')).toMatch(/Chest, arm, crock, arm, crate/);
    expect(lib().map((e) => [e.name, e.from])).toEqual([["The keeper's crock line", 'thorne']]);
    // (no drafting table yet: the toast says where one comes from)
    expect(g.events.some((e: any) => e.t === 'toast' && /Juniper can build a drafting table/.test(e.text))).toBe(true);
    talk(g, 'thorne');
    expect(lib().length).toBe(1);
    g.flags.add('town_mill');
    talk(g, 'thorne');
    expect(lastDialog(g).pages.join(' ')).toMatch(/Bin, arm, mill, arm, chest/);
    expect(lib().map((e) => e.name)).toEqual(["The keeper's crock line", 'A mill line']);
    g.flags.add('waterworks');
    g.flags.add('tram');
    talk(g, 'thorne');
    talk(g, 'thorne');
    expect(lib().map((e) => e.name)).toEqual(["The keeper's crock line", 'A mill line', 'A smelting line', "The clock's gear line"]);
    expect(drawingDue(g)).toBeNull();
  });

  it('a full library keeps the drawing for later', () => {
    const g = new Game({ seed: 32 });
    const t = met(g, 'thorne');
    g.flags.add('drawing:crock_line');
    const lib = drafting(g).lib;
    while (lib.length < LIB_MAX) lib.push({ name: 'Mine ' + lib.length, bp: DRAWINGS[0].bp, from: '', day: 0 });
    g.flags.add('town_mill');
    expect(giveDrawing(g, drawingDue(g)!)).toBe(false);
    t.talked = false;
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
    met(g, 'thorne');
    talk(g, 'thorne');
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, look)))).game;
    expect(npcSys(g2).byId.get('pip')!.askDay).toBe(pip.askDay);
    expect(g2.flags.has('echo:arm')).toBe(true);
    expect(drafting(g2).lib.map((e) => [e.name, e.from])).toEqual([["The keeper's crock line", 'thorne']]);
    expect(drawingDue(g2)).toBeNull();
  });
});
