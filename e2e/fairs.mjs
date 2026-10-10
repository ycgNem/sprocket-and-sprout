// The Sprocket Fair and the Harvest Haul, real input (keyboard F, mouse clicks on the windows'
// buttons) against a running dev server:
// 1) spring 13 at the square: her key bubble says "Enter the Sprocket Fair" and the first F at the
//    Professor opens it; pick the 6x6 crock line from the drafting table's library, Run, watch the
//    first minute and the fast four, read the score (the sim's own for that line) and the prize;
// 2) the drafting table's Bench test: click the line, Bench test, the same score and no prize;
// 3) fall 15, a new day: F at the Mayor opens the Haul; to the auction; bid by clicking until the lot
//    is yours, and check it's in the bag.
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
  window.__testbed = await import('/src/sim/testbed.ts');
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
  // to bed on the evening of spring 12: the Fair's morning comes as the game runs it
  g.time.season = 0; g.time.day = 12; g.time.min = 22 * 60;
  g.goToBed();
  g.time.min = 1559.99;
  g.tick();
});
await wait(900);
await calm();
await ev(() => {
  const g = window.__game;
  g.time.min = 10 * 60; g.weather = 'sun';
  window.__app.renderer.invalidateAll?.();
});
await wait(600);
await calm();
const m1 = await meet('ottoline');
check(m1.spot.join() === '133,66', `on Fair day the Professor waits by the plate's south edge: ${JSON.stringify(m1)}`);
await ev(() => { window.__app.renderer.juice.banners.length = 0; });
await wait(300);
// the key bubble over her says what F does, and the first F (no chat first) opens her plate
const bubble = await ev(() => window.__play.promptKey);
check(/Enter the Sprocket Fair/.test(bubble), `her key bubble: ${JSON.stringify(bubble)}`);
await page.keyboard.press('KeyF');
await wait(500);
const f1 = await ev(() => ({ win: window.__play.win?.id, arg: window.__play.win?.arg, active: window.__game.sys.festivals?.active?.id, talked: window.__game.sys.npcs.byId.get('ottoline').talked }));
check(f1.win === 'festival' && f1.arg === 'f_fair' && !f1.talked, `the first F at the Professor on spring 13 opens the Sprocket Fair: ${JSON.stringify({ ...m1, ...f1 })}`);
await page.screenshot({ path: 'e2e/out/fairs-1-pick.png' });
// pick the library's pickle row, then Run
const picked = (await clickBtn('row1')) && (await wait(250), await ev(() => window.__play.win?.data?.sel));
check(picked === 1, `clicked the library's Pickle row: sel=${picked}`);
await clickBtn('run');
await wait(400);
const r0 = await ev(() => ({ mode: window.__play.win?.data?.mode, name: window.__play.win?.data?.name, ticks: window.__play.win?.data?.run?.ticks }));
check(r0.mode === 'run' && r0.name === 'Pickle row', `Run builds it on the plate: ${JSON.stringify(r0)}`);
await wait(7000);
const mid = await ev(() => { const r = window.__play.win?.data?.run; return { ticks: r?.ticks, skipped: r?.skipped, idle: r?.idle, missing: r?.missing }; });
await page.screenshot({ path: 'e2e/out/fairs-2-run.png' });
check(mid.ticks > 600 && mid.ticks < 3600 && !mid.skipped.length && !mid.idle.length && !mid.missing.length, `the first minute plays out on the plate (about 12 s of the 15): ${mid.ticks} ticks after 7.4 s, nothing left off`);
let res = null;
for (let i = 0; i < 40 && !res; i++) { await wait(500); res = await ev(() => (window.__play.win?.data?.mode === 'done' ? window.__play.win.data.res : null)); }
const st1 = await ev(() => ({ money: window.__game.player.money, tickets: window.__game.player.inv.countId('ticket'), candles: [1, 2, 3, 4].filter((c) => window.__game.flags.has('candle_' + c)), lantern: window.__game.player.inv.countId('f_lantern'), entries: window.__fairEntries }));
// four crocks of pickles add about 270 coins a minute: past the Professor's 50 and Bram's 250
const sim = await ev(() => window.__testbed.scoreBlueprint(window.__game, window.__drafting.drafting(window.__game).lib.find((e) => e.name === 'Pickle row').bp));
check(!!res && res.score > 0 && res.score === sim && res.beaten === 2, `score and place: ${JSON.stringify(res)} (the sim scores the line ${sim})`);
const want = res && res.score > 0 ? [2, 5, 10, 20][res.beaten] : 0;
check(!!res && res.candles.join() === st1.candles.join() && res.candles.length === res.beaten && st1.tickets === want && res.tickets === want, `prizes: candles ${JSON.stringify(res?.candles)} (${st1.lantern ? "the purse and the Founder's Lantern" : 'the purse'}), ${st1.tickets} tokens and ${res?.money} coins`);
await page.screenshot({ path: 'e2e/out/fairs-3-result.png' });
await clickBtn('done');
await wait(300);
check(!(await ev(() => window.__play.win)), 'Done closes the Fair');

// ---------------- 2) the drafting table's bench test ----------------
await ev(() => window.__play.openWindow('drafting'));
await wait(400);
await clickBtn('row0');
await wait(250);
const dsel = await ev(() => ({ win: window.__play.win?.id, sel: window.__play.win?.data?.sel, bench: !!window.__play.win?.data?.btn?.bench }));
await page.screenshot({ path: 'e2e/out/fairs-6-drafting.png' });
check(dsel.win === 'drafting' && dsel.sel === 0 && dsel.bench, `the drafting table, the Pickle row chosen: ${JSON.stringify(dsel)}`);
const before = await ev(() => ({ money: window.__game.player.money, tickets: window.__game.player.inv.countId('ticket'), best: window.__game.counters.best_f_fair, paid: window.__game.counters.fair_paid_1 }));
await clickBtn('bench');
await wait(400);
const b0 = await ev(() => ({ win: window.__play.win?.id, mode: window.__play.win?.data?.mode, name: window.__play.win?.data?.name }));
check(b0.win === 'bench' && b0.mode === 'run' && b0.name === 'Pickle row', `Bench test runs it on the plate: ${JSON.stringify(b0)}`);
let bres = null;
for (let i = 0; i < 50 && !bres; i++) { await wait(500); bres = await ev(() => (window.__play.win?.data?.mode === 'done' ? { score: window.__testbed.bedScore(window.__play.win.data.run), res: window.__play.win.data.res ?? null } : null)); }
await page.screenshot({ path: 'e2e/out/fairs-7-bench.png' });
const after = await ev(() => ({ money: window.__game.player.money, tickets: window.__game.player.inv.countId('ticket'), best: window.__game.counters.best_f_fair, paid: window.__game.counters.fair_paid_1 }));
check(!!bres && bres.score === sim && bres.res === null && JSON.stringify(after) === JSON.stringify(before), `the bench test scores it ${bres?.score} and pays nothing: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
await clickBtn('done');
await wait(300);
const back = await ev(() => ({ win: window.__play.win?.id, sel: window.__play.win?.data?.sel }));
check(back.win === 'drafting' && back.sel === 0, `Back returns to the drafting table on the same line: ${JSON.stringify(back)}`);
await ev(() => window.__play.closeWindow());
await wait(200);

// ---------------- 3) the Harvest Haul ----------------
// a new day: to bed on the evening of fall 14, and the Haul's morning comes as the game runs it
await ev(() => {
  const g = window.__game;
  g.time.season = 2; g.time.day = 14; g.time.min = 22 * 60;
  g.player.money = 60000;
  g.goToBed();
  g.time.min = 1559.99;
  g.tick();
});
await wait(900);
await calm();
const morning = await ev(() => { const g = window.__game; return { season: g.time.season, day: g.time.day, min: Math.round(g.time.min), weekday: g.weekday }; });
check(morning.season === 2 && morning.day === 15 && morning.weekday === 0, `slept into fall 15, a Monday: ${JSON.stringify(morning)}`);
await ev(() => {
  const g = window.__game;
  g.time.min = 10 * 60; g.weather = 'sun';
  window.__app.renderer.invalidateAll?.();
});
await wait(900);
await calm();
const m2 = await meet('tobias');
await wait(150);
await page.keyboard.press('KeyF');
await wait(500);
const h1 = await ev(() => ({ win: window.__play.win?.id, arg: window.__play.win?.arg }));
check(h1.win === 'festival' && h1.arg === 'f_haul', `F at the Mayor on fall 15 (a ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][await ev(() => window.__game.weekday)]}) opens the Harvest Haul: ${JSON.stringify({ ...m2, ...h1 })}`);
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
