// Villagers as specialists (ROADMAP.md 7.6), real input (keyboard F/Enter, mouse clicks) against a
// running dev server. For Juniper (the millwright) and Pip (the apprentice): the first meeting's intro,
// and a chat; then one of Pip's echoes answered by clicking the right choice (the notebook), and Pip's
// question at the farm about a machine, on a card beside the play: hovered, then answered by a click.
// Usage: BASE=http://127.0.0.1:5181/ node e2e/people.mjs   (prints PASS/FAIL lines; screenshots in e2e/out/)
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const ev = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);
const results = [];
const check = (ok, what) => { results.push((ok ? 'PASS ' : 'FAIL ') + what); };
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await ev(() => { const g = new window.__Game({ seed: 5150, name: 'Robin', farmName: 'Willow' }); window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 }); });
await wait(800);
// clear the opening's windows and tips
const calm = () => ev(() => { const g = window.__game, p = window.__play; p.win = null; g.sys.dialogue = null; g.sys.cutscene = null; p.hud.toasts = []; for (const t of ['tip_machine', 'tip_move', 'tip_tools']) g.flags.add(t); });
for (let i = 0; i < 12; i++) { await wait(300); if (await ev(() => window.__play.win?.id === 'dialog')) break; }
for (let i = 0; i < 8 && await ev(() => !!window.__play.win); i++) { await page.keyboard.press('Enter'); await wait(250); }
await calm();
// UI pixels to page pixels, and the event window's choice buttons (src/ui/windows/town.ts drawEvent)
const ui = await ev(() => ({ scale: window.__app.uiScale, w: window.__app.canvas.width, h: window.__app.canvas.height, dpr: window.__app.dpr }));
const S = ui.scale / ui.dpr, uw = Math.floor(ui.w / ui.scale), uh = Math.floor(ui.h / ui.scale);
const choiceAt = (i) => {
  const w = Math.min(440, uw - 20), h = 86;
  const x = Math.floor((uw - w) / 2), y = uh - h - 30;
  return { x: (x + 12 + (w - 24) / 2) * S, y: (y + 6 + i * 20 + 8) * S };
};
const win = () => ev(() => { const w = window.__play.win; return w ? { id: w.id, npc: w.arg?.npc, title: w.arg?.title, text: w.arg?.pages?.join(' '), choosing: w.id === 'event' && !w.data.reply && (w.data.i ?? 0) >= w.arg.lines.length && !!w.arg.choice, ask: w.arg?.ask } : null; });
/** a villager standing just east of you on the square, facing you, staying put (their target is where their day says) */
const beside = (id) => ev((id) => {
  const g = window.__game, p = window.__play;
  p.win = null; g.sys.dialogue = null; g.sys.cutscene = null;
  const [sx, sy] = g.map.loc('square');
  g.player.x = sx + 0.5; g.player.y = sy + 2.5; g.player.dir = 1;
  const n = g.sys.npcs.byId.get(id);
  let tgt = n.schedule.at[0][1];
  for (const [t, loc] of n.schedule.at) if (g.time.min >= t) tgt = loc;
  n.target = tgt; n.visible = true; n.path = []; n.x = g.player.x + 1; n.y = g.player.y;
}, id);
/** Enter through a window (clicking the first choice of a scene if it asks) until it closes */
async function finish() {
  for (let i = 0; i < 40; i++) {
    const w = await win();
    if (!w) return true;
    if (w.choosing) { const c = choiceAt(0); await page.mouse.click(c.x, c.y); }
    else await page.keyboard.press('Enter');
    await wait(200);
  }
  return !(await win());
}

const VILLAGERS = [
  { id: 'juniper', intro: /Millwright\. I build wheels/, },
  { id: 'pip', intro: /I'm Pip! I'm gonna be an engineer!/, },
];
let shot = 1;
for (const v of VILLAGERS) {
  // 1) the first meeting: the intro
  await ev(() => { const g = window.__game; g.time.min = 17 * 60 + 30; for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f); });
  await beside(v.id);
  await wait(300);
  await page.keyboard.press('KeyF'); await wait(500);
  const s1 = await win();
  const met = await ev((id) => window.__game.sys.npcs.byId.get(id).met, v.id);
  check(s1?.id === 'dialog' && s1.npc === v.id && v.intro.test(s1.text ?? '') && met, `${v.id}: first meeting's intro: ${JSON.stringify(s1)?.slice(0, 160)}`);
  await page.screenshot({ path: `e2e/out/people-${shot++}-${v.id}-intro.png` });
  await finish();
  // 2) a chat: a line of their own
  await beside(v.id);
  await wait(200);
  await page.keyboard.press('KeyF'); await wait(500);
  const s2 = await win();
  check(s2?.id === 'dialog' && s2.npc === v.id && !v.intro.test(s2.text ?? ''), `${v.id}: chat: ${JSON.stringify(s2)?.slice(0, 160)}`);
  await page.screenshot({ path: `e2e/out/people-${shot++}-${v.id}-chat.png` });
  await finish();
}

// 3) Pip's echo: a lesson card seen, asked back with three answers; the right one clicked
await ev(() => { const g = window.__game; g.time.min = 17 * 60 + 30; for (const f of [...g.flags]) if (f.startsWith('lesson:')) g.flags.delete(f); g.flags.add('lesson:arm'); g.sys.npcs.byId.get('pip').askDay = 0; });
await beside('pip');
await wait(300);
await page.keyboard.press('KeyF'); await wait(500);
const e1 = await win();
check(e1?.id === 'event' && e1.title === "Pip's Question" && e1.ask?.kind === 'echo' && e1.ask.id === 'arm', `pip: asks the arm card back: ${JSON.stringify(e1)?.slice(0, 200)}`);
for (let i = 0; i < 6 && !(await win())?.choosing; i++) { await page.keyboard.press('Enter'); await wait(250); }
const e2 = await win();
await page.screenshot({ path: `e2e/out/people-${shot++}-pip-echo.png` });
const p0 = await ev(() => window.__game.counters.echoes ?? 0);
const right = e2?.ask?.right ?? 1;
const c = choiceAt(right);
await page.mouse.click(c.x, c.y); await wait(400);
const reply = await ev(() => window.__play.win?.data?.reply ?? '');
check(e2?.choosing && /I wrote it in my notebook!/.test(reply), `pip: the right answer clicked: "${reply}"`);
await page.screenshot({ path: `e2e/out/people-${shot++}-pip-notebook.png` });
for (let i = 0; i < 6 && await win(); i++) { await page.keyboard.press('Enter'); await wait(250); }
const end = await ev(() => { const g = window.__game; return { echoes: g.counters.echoes ?? 0, flag: g.flags.has('echo:arm'), win: window.__play.win?.id ?? null, cutscene: !!g.sys.cutscene }; });
check(end.flag && end.echoes === p0 + 1 && !end.win && !end.cutscene, `pip: the notebook: ${JSON.stringify({ p0, ...end })}`);

// 4) Pip at the farm: a question about the crock Pip stands by, on a card beside the play (no
// window): the crock's own line shows on hover while it's up, and clicking that line is right
await ev(() => { window.__app.ui.audit = true; });
const setup = await ev(async () => {
  const g = window.__game, p = window.__play;
  p.win = null; g.sys.dialogue = null; g.sys.cutscene = null; p.hud.toasts = [];
  const P = await import('/src/sim/people.ts');
  g.time.min = 15 * 60 + 30;
  const crock = g.ents.all().find((e) => e.def.id === 'jar');
  crock.st.rust = false;
  const [sx, sy] = P.standBy(g, crock);
  g.map.locs.set('pip_visit', [sx, sy]);
  const pip = g.sys.npcs.byId.get('pip');
  pip.talked = true;
  pip.schedule = { ...pip.schedule, at: [[0, 'pip_visit']] };
  pip.target = 'pip_visit'; pip.path = []; pip.visible = true;
  pip.x = sx + 0.5; pip.y = sy + 0.9;
  g.sys.visits = { npc: 'pip', talked: false, ent: crock.id, asked: false };
  g.player.x = sx + 1.5; g.player.y = sy + 0.9; g.player.dir = 3;
  return { id: crock.id, x: crock.x, y: crock.y };
});
await wait(400);
const p1 = await ev(() => window.__game.counters.echoes ?? 0);
await page.keyboard.press('KeyF'); await wait(500);
const ask = await ev(() => { const a = window.__game.sys.pipAsk; return a ? { q: a.q, answers: a.answers, right: a.right, win: window.__play.win?.id ?? null } : null; });
check(!!ask && !ask.win && /preserving crock/i.test(ask.q) && ask.answers.length === 3, `pip at the farm: the question on a card, no window: ${JSON.stringify(ask)}`);
await page.screenshot({ path: `e2e/out/people-${shot++}-pip-machine.png` });
const tile = await ev(({ x, y }) => { const s = window.__app.renderer.tileToScreen(x + 0.5, y + 0.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; }, setup);
await page.mouse.move(tile.x, tile.y); await wait(300);
const line = await ev(async (id) => { const P = await import('/src/sim/people.ts'); return P.machineLine(window.__game.ents.get(id)); }, setup.id);
const tipText = await ev(() => (window.__app.ui.lastAudit ?? []).filter((a) => a.kind === 'text').map((a) => a.s).join(' | '));
check(tipText.includes('Preserving Crock') && tipText.includes(line) && !!(await ev(() => window.__game.sys.pipAsk)), `pip at the farm: hovering the crock shows its tooltip ("${line}") with the question still up`);
await page.screenshot({ path: `e2e/out/people-${shot++}-pip-machine-hover.png` });
await page.mouse.move(20, 700); await wait(250);
const now = await ev(async (id) => { const P = await import('/src/sim/people.ts'); return P.machineLine(window.__game.ents.get(id)); }, setup.id);
const at = await ev((now) => (window.__app.ui.lastAudit ?? []).filter((a) => a.kind === 'text' && a.x < 240 && a.s.length > 3 && (a.s === now || now.startsWith(a.s))).shift(), now);
if (at) await page.mouse.click((at.x + 4) * S, (at.y + 3) * S);
await wait(400);
const done = await ev(() => { const g = window.__game, a = g.sys.pipAsk; return { ok: a?.ok, reply: a?.reply, asked: g.sys.visits?.asked, echoes: g.counters.echoes ?? 0, win: window.__play.win?.id ?? null }; });
check(!!at && done.ok === true && /notebook/.test(done.reply ?? '') && done.asked && done.echoes === p1 + 1 && !done.win, `pip at the farm: clicked "${now}": ${JSON.stringify({ p1, ...done })}`);
await page.screenshot({ path: `e2e/out/people-${shot++}-pip-machine-reply.png` });

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
