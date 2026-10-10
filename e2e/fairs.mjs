// The Sprocket Fair and the Harvest Haul, real input (keyboard F, mouse clicks on the windows'
// buttons) against a running dev server:
// 1) spring 13 at the square: F at the Professor opens the Fair; pick the 6x6 crock line from the
//    drafting table's library, Run, watch the minute, read the score and the prize;
// 2) fall 16: F at the Mayor opens the Haul; to the auction; bid by clicking until the lot is yours,
//    and check it's in the bag.
// Usage: BASE=http://127.0.0.1:5182/ node e2e/fairs.mjs   (prints PASS/FAIL lines; screenshots in e2e/out/)
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
await ev(() => { const g = new window.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow' }); window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 }); });
await wait(800);
// let the opening's welcome appear, then dismiss it
for (let i = 0; i < 12; i++) { await wait(300); if (await ev(() => window.__play.win?.id === 'dialog')) break; }
for (let i = 0; i < 8 && await ev(() => !!window.__play.win); i++) { await page.keyboard.press('Enter'); await wait(250); }
await ev(async () => {
  window.__drafting = await import('/src/sim/drafting.ts');
  window.__inv = await import('/src/sim/inventory.ts');
});
const calm = () => ev(() => {
  const g = window.__game, p = window.__play;
  p.closeWindow?.();
  p.win = null;
  g.sys.dialogue = null;
  p.hud.toasts = [];
  p.lessons && (p.lessons.q = []);
  for (const t of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_move', 'tip_tools']) g.flags.add(t);
});
await calm();

/** click a window button by the rectangle it records (UI pixels) */
async function clickBtn(name) {
  const r = await ev((name) => {
    const w = window.__play.win, b = w?.data?.btn?.[name];
    if (!b) return null;
    const k = window.__app.uiScale / window.__app.dpr;
    return { x: (b[0] + b[2] / 2) * k, y: (b[1] + b[3] / 2) * k };
  }, name);
  if (!r) return false;
  await page.mouse.click(r.x, r.y);
  return true;
}

/** put a festival host on their spot on the square and the player beside them, facing them */
const meet = (id) => ev((id) => {
  const g = window.__game;
  g.player.where = 'world';
  const [sx, sy] = g.map.loc('fest_' + id);
  const n = g.sys.npcs.byId.get(id);
  n.x = sx + 0.5; n.y = sy + 0.9; n.visible = true; n.path = []; n.target = 'fest_' + id; n.moving = false; n.dir = 3;
  g.player.x = sx - 0.5; g.player.y = sy + 0.9; g.player.dir = 1;
  const r = window.__app.renderer; r.cam.x = g.player.x; r.cam.y = g.player.y;
  return { spot: [sx, sy], active: g.sys.festivals?.active?.id ?? null };
}, id);

// ---------------- 1) the Sprocket Fair ----------------
// the farm's lines, drawn: a four-crock pickle row in the drafting table's library, and a smaller
// copy in the blueprint tool (the Professor lists both)
await ev(() => {
  const g = window.__game, p = window.__play;
  const it = (def, dx, dy, rot = 0, extra = {}) => ({ def, dx, dy, rot, ...extra });
  const row = (y) => [it('chest_wood', 0, y), it('arm_basic', 1, y, 1), it('jar', 2, y, 0, { last: 'jar:pickles_cogbean' }), it('arm_basic', 3, y, 1), it('shipping_crate', 4, y)];
  p.blueprint = { items: [...row(0), ...row(1)], w: 5, h: 2 };
  window.__drafting.addBlueprint(g, 'Pickle row', { items: [0, 1, 2, 3].flatMap(row), w: 5, h: 4 });
  g.weather = 'sun';
  g.time.season = 0; g.time.day = 13; g.time.min = 10 * 60;
  window.__app.renderer.invalidateAll?.();
});
await wait(900);
await calm();
const m1 = await meet('ottoline');
await wait(150);
// she has a word with you first (your chat for the day), then F again opens her test bed
await page.keyboard.press('KeyF');
await wait(500);
const f0 = await ev(() => ({ win: window.__play.win?.id, npc: window.__play.win?.arg?.npc, line: window.__play.win?.arg?.pages?.[0], talked: window.__game.sys.npcs.byId.get('ottoline').talked }));
check(f0.win === 'dialog' && f0.npc === 'ottoline' && f0.talked, `F at the Professor on spring 13: her word first: ${JSON.stringify(f0)}`);
for (let i = 0; i < 6 && await ev(() => window.__play.win?.id === 'dialog'); i++) { await page.keyboard.press('Enter'); await wait(250); }
await meet('ottoline');
await wait(150);
await page.keyboard.press('KeyF');
await wait(500);
const f1 = await ev(() => ({ win: window.__play.win?.id, arg: window.__play.win?.arg, active: window.__game.sys.festivals?.active?.id }));
check(f1.win === 'festival' && f1.arg === 'f_fair', `then F opens the Sprocket Fair: ${JSON.stringify({ ...m1, ...f1 })}`);
await page.screenshot({ path: 'e2e/out/fairs-1-pick.png' });
// pick the library's pickle row, then Run
const picked = (await clickBtn('row1')) && (await wait(250), await ev(() => window.__play.win?.data?.sel));
check(picked === 1, `clicked the library's Pickle row: sel=${picked}`);
await clickBtn('run');
await wait(400);
const r0 = await ev(() => ({ mode: window.__play.win?.data?.mode, name: window.__play.win?.data?.name, ticks: window.__play.win?.data?.run?.ticks }));
check(r0.mode === 'run' && r0.name === 'Pickle row', `Run builds it on the bed: ${JSON.stringify(r0)}`);
await wait(7000);
const mid = await ev(() => ({ ticks: window.__play.win?.data?.run?.ticks, skipped: window.__play.win?.data?.run?.skipped }));
await page.screenshot({ path: 'e2e/out/fairs-2-run.png' });
check(mid.ticks > 600 && mid.ticks < 3600 && mid.skipped.length === 0, `the minute plays out on the bed (about 15 s): ${mid.ticks} ticks after 7.4 s, nothing left off`);
let res = null;
for (let i = 0; i < 40 && !res; i++) { await wait(500); res = await ev(() => (window.__play.win?.data?.mode === 'done' ? window.__play.win.data.res : null)); }
const st1 = await ev(() => ({ money: window.__game.player.money, tickets: window.__game.player.inv.countId('ticket'), candles: [1, 2, 3, 4].filter((c) => window.__game.flags.has('candle_' + c)), lantern: window.__game.player.inv.countId('f_lantern'), entries: window.__fairEntries }));
// four crocks of pickles make about 450 coins a minute: past the Professor's 140 and Bram's 380
check(!!res && res.score > 0 && res.beaten >= 1, `score and place: ${JSON.stringify(res)}`);
const want = [0, 5, 10, 20][res?.beaten ?? 0];
check(!!res && res.candles.join() === st1.candles.join() && res.candles.length === res.beaten && st1.tickets === want && res.tickets === want, `prizes: candles ${JSON.stringify(res?.candles)} (${st1.lantern ? "the purse and the Founder's Lantern" : 'the purse'}), ${st1.tickets} tokens and ${res?.money} coins`);
await page.screenshot({ path: 'e2e/out/fairs-3-result.png' });
await clickBtn('done');
await wait(300);
check(!(await ev(() => window.__play.win)), 'Done closes the Fair');

// ---------------- 2) the Harvest Haul ----------------
await ev(() => {
  const g = window.__game;
  g.time.season = 2; g.time.day = 16; g.time.min = 10 * 60; g.weather = 'sun';
  g.player.money = 60000;
  window.__app.renderer.invalidateAll?.();
});
await wait(900);
await calm();
const m2 = await meet('tobias');
await wait(150);
await page.keyboard.press('KeyF');
await wait(500);
const h1 = await ev(() => ({ win: window.__play.win?.id, arg: window.__play.win?.arg }));
check(h1.win === 'festival' && h1.arg === 'f_haul', `F at the Mayor on fall 16 opens the Harvest Haul: ${JSON.stringify({ ...m2, ...h1 })}`);
await page.screenshot({ path: 'e2e/out/fairs-4-haul.png' });
await clickBtn('auction');
await wait(400);
const a0 = await ev(() => { const w = window.__play.win, a = w?.data?.a; return { win: w?.id, arg: w?.arg, lot: a?.lot?.name, bid: a?.bid, step: a?.step }; });
check(a0.win === 'auction' && a0.arg === 'haul' && !!a0.lot, `to the auction: ${JSON.stringify(a0)}`);
const money0 = await ev(() => window.__game.player.money);
let clicks = 0, state = null;
for (let i = 0; i < 400; i++) {
  state = await ev(() => { const a = window.__play.win?.data?.a; return a ? { call: a.call, high: a.high, bid: a.bid, log: a.log.length } : null; });
  if (!state || state.call === 'sold') break;
  if (state.high !== 'you') { await clickBtn('bid'); clicks++; }
  await wait(250);
}
await page.screenshot({ path: 'e2e/out/fairs-5-auction.png' });
const end = await ev(() => {
  const w = window.__play.win, a = w?.data?.a, g = window.__game;
  return { call: a?.call, high: a?.high, bid: a?.bid, result: w?.data?.result, settled: a?.settled, rivals: a?.log.filter((l) => l.who !== 'you').length, money: g.player.money, assemblers: g.player.inv.countId('assembler_2'), tickets: g.player.inv.countId('ticket'), wins: g.counters.auction_wins };
});
check(end.call === 'sold' && end.high === 'you' && end.result === 'won' && end.settled, `bid by clicking until it sold to you: ${clicks} clicks, ${JSON.stringify(end)}`);
check(end.rivals > 0, `Roxy and Bram bid against you: ${end.rivals} bids`);
check(end.assemblers === 1 && end.money === money0 - end.bid && end.wins === 1, `the lot is in the bag and paid for: ${money0} - ${end.bid} = ${end.money}`);
check(end.tickets === st1.tickets + 20, `the Haul's 20 tokens for winning: ${st1.tickets} -> ${end.tickets}`);
await clickBtn('done');
await wait(300);
check(!(await ev(() => window.__play.win)), 'Done closes the auction');

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? `ERRORS (${errors.length}):\n` + errors.join('\n') : 'no console errors');
