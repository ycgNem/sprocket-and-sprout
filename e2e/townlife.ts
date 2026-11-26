// Town life on screen (src/sim/townlife.ts, src/data/npcs.ts `stints`) against a running dev
// server: the square at noon on an ordinary weekday, villagers at the works once their keystones'
// flags are set, keepers out in front of their shops, the school's yard, and the Thursday market
// with a stall's shop open. The flags are set directly, as the Works orders would.
// Usage: BASE=http://localhost:5173/ npx tsx e2e/townlife.ts   (PASS/FAIL lines; screenshots in e2e/out/townlife/)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const OUT = 'e2e/out/townlife';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// (tsx names the functions it compiles with a helper the page doesn't have)
await page.addInitScript({ content: 'window.__name = (f) => f;' });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ev = <T, A = undefined>(f: (a: A) => T, a?: A): Promise<T> => page.evaluate(f as any, a as any) as Promise<T>;
const wait = (ms: number) => page.waitForTimeout(ms);
const results: string[] = [];
const check = (ok: boolean, what: string) => results.push((ok ? 'PASS ' : 'FAIL ') + what);

await page.goto(base);
await page.waitForFunction(() => (window as any).__app?.screen);
await ev(() => {
  const w = window as any;
  const g = new w.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow' });
  w.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
});
await wait(1200);
for (let i = 0; i < 10 && await ev(() => !!(window as any).__play.win); i++) { await page.keyboard.press('Escape'); await wait(200); }
await ev(() => {
  const w = window as any, g = w.__game, p = w.__play;
  p.win = null; g.sys.dialogue = null; p.hud.toasts = [];
  for (const t of ['tip_machine', 'tip_move', 'tip_tools', 'tip_welcome']) g.flags.add(t);
  for (const f of ['town_mill', 'waterworks', 'lamplighting', 'tram', 'harbor', 'clock_fixed']) g.flags.add('era_card:' + f);
  for (const n of g.sys.npcs.list) n.met = true;
  const cam = w.__app.renderer.cam;
  cam.follow = function () { this.zoom = this.targetZoom; };
});

interface Shot { x: number; y: number; zoom?: number; px?: number; py?: number; keepWin?: boolean }
/**
 * Sleep to the next day that is this weekday (dry), set the flags, run the clock to `min` with the
 * villagers walking, and leave the player out of the way.
 */
const toTime = async (weekday: number | null, min: number, flags: string[] = [], ship = false) => {
  await ev(({ weekday, min, flags, ship }) => {
    const w = window as any, g = w.__game, p = w.__play;
    for (const f of flags) g.flags.add(f);
    const sleep = () => { const d0 = g.dayIndex; g.tomorrow = 'sun'; g.time.min = 1320; g.goToBed(); while (g.dayIndex === d0) g.tick(); };
    if (weekday !== null && (g.weekday !== weekday || g.time.min > min)) for (let i = 0; i < 9; i++) { sleep(); if (g.weekday === weekday) break; }
    if (ship && g.sys.exports) { g.sys.exports.ship = 'port'; g.sys.exports.next = g.dayIndex + 5; }
    // out of everyone's way (a villager near you turns to look at you)
    g.player.where = 'world'; g.player.x = 60.5; g.player.y = 30.5;
    while (g.time.min < min) g.tick();
    g.events.length = 0;
    p.win = null; p.winQ = []; g.sys.dialogue = null; p.hud.toasts = [];
  }, { weekday, min, flags, ship });
};
const shot = async (name: string, s: Shot) => {
  await ev((s) => {
    const w = window as any, g = w.__game, p = w.__play, r = w.__app.renderer;
    if (!s.keepWin) { p.win = null; p.winQ = []; g.sys.dialogue = null; }
    p.hud.toasts = [];
    if (s.px !== undefined) { g.player.x = s.px; g.player.y = s.py; }
    r.cam.zoom = r.cam.targetZoom = s.zoom ?? 3;
    r.cam.x = s.x; r.cam.y = s.y;
  }, s);
  await page.mouse.move(1279, 719);
  await ev(() => { const m = (window as any).__app.input.mouse; m.x = -9999; m.y = -9999; });
  await wait(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const who = (box: [number, number, number, number]) => ev((b) => (window as any).__game.sys.npcs.list.filter((n: any) => n.visible && n.x >= b[0] && n.x <= b[2] && n.y >= b[1] && n.y <= b[3]).map((n: any) => n.id), box);
const SQUARE: [number, number, number, number] = [121.5, 52.5, 144.5, 69.5];

// ---- an ordinary Monday, no keystones yet ----
await toTime(0, 10 * 60);
await shot('school-yard', { x: 147, y: 77, zoom: 3 });
check((await who([141, 76, 150, 82])).length >= 2, `the school is out in its yard at 10: ${await who([141, 76, 150, 82])}`);
await shot('store-front', { x: 111, y: 55, zoom: 3 });
await toTime(null, 12 * 60 + 30);
const noon = await who(SQUARE);
check(noon.length >= 3, `the square at 12:30 on a Monday: ${noon}`);
await shot('square-noon', { x: 133, y: 60.4, zoom: 2 });
await shot('square-noon-close', { x: 132.5, y: 61, zoom: 3 });
const outdoors = await ev(() => (window as any).__game.sys.npcs.list.filter((n: any) => n.visible && n.x >= 94).length);
check(outdoors >= 8, `outdoors on the town's side at 12:30: ${outdoors} of 14`);
await toTime(null, 14 * 60);
await shot('main-street-2pm', { x: 118, y: 62, zoom: 2 });
await shot('smithy-front', { x: 159, y: 68, zoom: 3 });

// ---- the works, once their keystones are in ----
const KEYS = ['town_mill', 'waterworks', 'lamps_hung', 'lamplighting', 'tram', 'clock_fixed', 'harbor'];
await toTime(1, 7 * 60 + 50, KEYS, true);
await shot('mill-juniper', { x: 100, y: 56.5, zoom: 3 });
check((await who([97, 58, 103, 61])).includes('juniper'), 'Juniper is at the Town Mill before the Joinery opens');
await shot('pump-bram', { x: 118, y: 57.5, zoom: 3 });
check((await who([115, 58, 122, 61])).includes('bram'), 'Bram is at the pump house');
await shot('harbor-wren', { x: 143, y: 131, zoom: 2 });
check((await who([138, 128, 148, 133])).includes('wren'), 'Wren is at the Harbor with the ship in');
await toTime(null, 8 * 60 + 52);
await shot('tram-tobias', { x: 129, y: 51, zoom: 3 });
await toTime(null, 9 * 60 + 40);
await shot('mill-hazel', { x: 102, y: 57.5, zoom: 3 });
await toTime(null, 12 * 60 + 5);
await shot('clock-noon', { x: 133, y: 59, zoom: 3 });
check((await who([130, 60, 137, 63])).includes('tobias'), 'the Mayor is under the clock at noon');
await toTime(null, 12 * 60 + 50);
await shot('tram-thorne', { x: 129, y: 52, zoom: 3 });
check((await who([124, 50, 133, 54])).includes('thorne'), 'Thorne is at the tram stop at lunch');
await shot('square-noon-works', { x: 133, y: 60.4, zoom: 2 });
await toTime(null, 15 * 60 + 40);
await shot('fountain', { x: 133, y: 66, zoom: 3 });
await toTime(null, 17 * 60);
await shot('harbor-roxy', { x: 143, y: 131, zoom: 2 });
await toTime(null, 18 * 60 + 40);
await shot('lamps-sable', { x: 133, y: 60.4, zoom: 2 });
check((await who(SQUARE)).includes('sable'), "Sable is on the round of the square's lamps at dusk");

// ---- market day ----
await toTime(3, 11 * 60, KEYS);
const mkt = await who(SQUARE);
check(mkt.length >= 8, `the market at 11: ${mkt.length} on the square (${mkt})`);
const toasts = await ev(() => (window as any).__game.weekday);
check(toasts === 3, 'market day is a Thursday');
await shot('market', { x: 133, y: 60.4, zoom: 2 });
await shot('market-west', { x: 127, y: 61, zoom: 3 });
await shot('market-east', { x: 139, y: 61, zoom: 3 });
// F at Marigold's counter: her talk first, then the Mercantile's shelves
await ev(() => {
  const w = window as any, g = w.__game;
  g.player.x = 124.5; g.player.y = 63.9; g.player.dir = 0;
  g.sys.npcs.byId.get('marigold').talked = true;
});
await wait(300);
await shot('market-prompt', { x: 127, y: 62, zoom: 3 });
await page.keyboard.press('f');
await wait(600);
const win = await ev(() => { const p = (window as any).__play; return p.win ? `${p.win.id}:${p.win.arg}` : ''; });
check(win === 'shop:general', `F at Marigold's stall opens the Mercantile: ${win}`);
await shot('market-stall-shop', { x: 127, y: 62, zoom: 3, keepWin: true });
// the odds table
await ev(() => { const p = (window as any).__play; p.win = null; p.openWindow('shop', 'market'); });
await wait(400);
await shot('market-odds-table', { x: 127, y: 62, zoom: 3, keepWin: true });
// the Orders board pins the day's notice
await ev(() => { const p = (window as any).__play; p.win = null; p.openWindow('board', 'standing'); });
await wait(400);
await shot('market-board', { x: 127, y: 62, zoom: 3, keepWin: true });
// the Mercantile's door says where she is
await ev(() => { const w = window as any, g = w.__game, p = w.__play; p.win = null; g.events.length = 0; g.sys.town.door(g, g.map.buildings.find((b: any) => b.id === 'store')); });
await wait(300);
await ev(() => { const w = window as any; w.__game.player.x = 110.5; w.__game.player.y = 56.9; });
await wait(500);
await page.screenshot({ path: `${OUT}/market-door.png` });

check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
