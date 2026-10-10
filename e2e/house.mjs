// Farmhouse interior: day, night, kitchen window, the ledger; then Workshop HQ with real input: a
// chest and a crock placed indoors with the mouse, the crock fed by hand, the drafting table saving
// the blueprint tool's copy, a save, a reload and Continue. Prints PASS/FAIL lines.
// Usage: BASE=http://localhost:5173/ node e2e/house.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/house';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
const ev = (s) => page.evaluate(s);
await ev(`(async () => {
  const g = new window.__Game({ seed: 7, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night']) g.flags.add('tip_' + t);
  for (const q of g.sys.quests?.active ?? []) q.seen = true;
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  window.S = { g };
  g.time.min = 11 * 60;
  g.sys.house.enter(g);
})()`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/day.png` });
// walk around a bit and check collision
const pos = await ev(`(() => { const g = S.g; return [g.player.where, g.player.x.toFixed(2), g.player.y.toFixed(2)]; })()`);
console.log('pos', pos);
await ev(`(() => { const g = S.g; g.time.min = 22 * 60; g.weather = 'rain'; g.player.x = 6.5; g.player.y = 5; })()`);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/night.png` });
await ev(`(() => { const g = S.g; g.time.min = 13 * 60; g.weather = 'sun'; g.flags.add('home_kitchen'); g.flags.add('home_pantry'); })()`);
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); const g = S.g; g.player.inv.add(I.key('flour'), 6); g.player.inv.add(I.key('egg'), 4); g.player.inv.add(I.key('milk'), 3); g.player.inv.add(I.key('potato'), 3); g.player.inv.add(I.key('sugar'), 2); window.__app.screen.openWindow('cooking'); })()`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/kitchen.png` });
await ev(`(() => { const g = S.g; window.__app.screen.closeWindow?.(); g.sys.house.interact(g, 12, 5); })()`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/ledger-first.png` });
// exit through the door and sleep cycle
const res = await ev(`(() => { const g = S.g; window.__app.screen.closeWindow?.(); g.sys.house.leave(g); const a = g.player.where; g.sys.house.enter(g); return [a, g.player.where]; })()`);
console.log('leave then enter', res);
// a food buff outdoors, with the hotbar tooltip of a buff food
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); const A = await import('/src/sim/actions.ts'); const g = S.g; g.sys.house.leave(g); g.player.inv.slots[11] = { k: I.key('miners_pie'), n: 3 }; g.player.sel = 11; A.eatHeld(g); })()`);
await page.waitForTimeout(900);
const slot = await ev(`(() => { const h = window.__app.ui; return { w: h.w, h: h.h, s: window.__app.ui.scale ?? 2 }; })()`);
console.log('ui', slot);
await page.screenshot({ path: `${out}/buff.png` });

// ---------------- Workshop HQ (Phase 5), real input ----------------
const results = [];
const check = (ok, what) => { results.push((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
const wait = (ms) => page.waitForTimeout(ms);
const ui = await ev(`({ scale: window.__app.uiScale, w: window.__app.canvas.width, h: window.__app.canvas.height, dpr: window.__app.dpr })`);
const S = ui.scale / ui.dpr, uh = ui.h / ui.scale;
const tileAt = (x, y) => page.evaluate(([x, y]) => { const s = window.__app.renderer.tileToScreen(x + 0.5, y + 0.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; }, [x, y]);
// the UI's audit records every text it draws: click a label by its words
await ev(`(() => {
  window.__app.ui.audit = true;
  window.__calm = () => { const p = window.__play; p.win = null; p.hud.toasts = []; window.__game.sys.dialogue = null; };
})()`);
const clickText = async (label) => {
  const r = await page.evaluate((label) => (window.__app.ui.lastAudit ?? []).filter((a) => a.kind === 'text' && a.s === label).pop(), label);
  if (r) await page.mouse.click((r.x + (r.w || 12) / 2) * S, (r.y + (r.h || 8) / 2) * S);
  return !!r;
};
const texts = () => page.evaluate(() => (window.__app.ui.lastAudit ?? []).filter((a) => a.kind === 'text').map((a) => a.s).join(' | '));

// 1) a day's sales, then the night: the bed by right-click, Enter, the tally
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); const g = S.g; window.__calm();
  const bin = g.ents.get(g.shipBinId).inv; bin.add(I.key('pickles_cogbean'), 6); bin.add(I.key('stone'), 20);
  g.sys.house.enter(g); g.time.min = 21 * 60; g.player.x = 3.5; g.player.y = 3.9; g.player.dir = 3; })()`);
await wait(900);
const bed = await tileAt(2, 3);
await page.mouse.click(bed.x, bed.y, { button: 'right' });
await wait(400);
await page.keyboard.press('Enter');
for (let i = 0; i < 60 && !(await ev(`window.__play.win?.id === 'summary'`)); i++) await wait(500);
await page.keyboard.press('Enter'); await wait(300);
await page.keyboard.press('Enter'); await wait(600);
check(await ev(`S.g.time.day === 2 && S.g.player.where === 'house'`), 'slept and woke on day 2 in the farmhouse');

// 2) the ledger: F at the old almanac
await ev(`(() => { const g = S.g; window.__calm(); g.player.x = 12.5; g.player.y = 6.3; g.player.dir = 0; })()`);
await wait(500);
await page.keyboard.press('KeyF'); await wait(600);
const led = await ev(`(() => ({ win: window.__play.win?.id, rows: (S.g.sys.house.ledger?.rows ?? []).map((r) => r.n) }))()`);
check(led.win === 'ledger' && led.rows.includes(6), `F at the almanac opens the ledger with yesterday's sales: ${JSON.stringify(led)}`);
const ledText = await texts();
check(/Yesterday/.test(ledText) && /Pickle/i.test(ledText), 'the ledger lists the pickles');
await page.screenshot({ path: `${out}/ledger.png` });
await page.keyboard.press('Escape'); await wait(300);

// 3) a chest and a crock placed indoors with the mouse
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); const g = S.g; window.__calm();
  g.player.x = 5.5; g.player.y = 8.5; g.player.dir = 3;
  const sl = g.player.inv.slots; sl[0] = { k: I.key('chest_wood'), n: 1 }; sl[1] = { k: I.key('jar'), n: 1 }; sl[2] = { k: I.key('cogbean'), n: 4 }; g.player.sel = 5; })()`);
await wait(900);
await page.keyboard.press('Digit1'); await wait(150);
let t = await tileAt(3, 8);
await page.mouse.move(t.x, t.y); await wait(250);
await page.screenshot({ path: `${out}/workshop-ghost.png` });
await page.mouse.click(t.x, t.y); await wait(300);
await page.keyboard.press('Digit2'); await wait(150);
t = await tileAt(4, 7);
await page.mouse.move(t.x, t.y); await wait(200);
await page.mouse.click(t.x, t.y); await wait(300);
const placed = await ev(`(() => { const H = S.g.houseEnts; return [H.rootAt(3, 8)?.def.id, H.rootAt(4, 7)?.def.id, H.rootAt(4, 7)?.id >= 1e6, S.g.ents.all().some((e) => e.def.id === 'jar' && e.x === 4 && e.y === 7)]; })()`);
check(placed[0] === 'chest_wood' && placed[1] === 'jar' && placed[2] && !placed[3], `placed a chest and a crock indoors by clicking: ${JSON.stringify(placed)}`);
// a belt is refused indoors, with the reason
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); S.g.player.inv.slots[3] = { k: I.key('belt_1'), n: 2 }; })()`);
await page.keyboard.press('Digit4'); await wait(150);
t = await tileAt(5, 7);
await page.mouse.click(t.x, t.y); await wait(300);
check(await ev(`!S.g.houseEnts.rootAt(5, 7) && S.g.player.inv.countId('belt_1') === 2`), 'a belt stays in the bag indoors');

// 4) feed the crock by hand: the beans selected, right-click the crock
await page.keyboard.press('Digit3'); await wait(150);
t = await tileAt(4, 7);
await page.mouse.click(t.x, t.y, { button: 'right' }); await wait(400);
const fed = await ev(`(() => { const e = S.g.houseEnts.rootAt(4, 7); return { bag: S.g.player.inv.countId('cogbean'), crafting: !!e.mach.crafting || e.mach.inBuf.size > 0 }; })()`);
check(fed.bag < 4 && fed.crafting, `right-click fed the crock: ${JSON.stringify(fed)}`);
// the works runs a minute (as the night shift does): pickles come out indoors
await ev(`S.g.runWorks(70)`);
await wait(500);
const pick = await ev(`(() => S.g.houseEnts.rootAt(4, 7).mach.outBuf.map((s) => s.n).reduce((a, b) => a + b, 0))()`);
check(pick >= 1, `the indoor crock made pickles: ${pick}`);
// something in the chest, to ride through the save
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); S.g.houseEnts.rootAt(3, 8).inv.add(I.key('stone'), 9); })()`);
await page.screenshot({ path: `${out}/workshop-placed.png` });

// 5) the Workshop wing and the drafting table: F opens it, Save keeps the blueprint tool's copy
await ev(`(async () => { const H = await import('/src/sim/systems/house.ts'); const g = S.g; g.flags.add('home_workshop'); g.flags.add('home_drafting'); H.rebuildHouse(g);
  g.player.x = 19.5; g.player.y = 3.4; g.player.dir = 0;
  window.__play.blueprint = { w: 3, h: 1, items: [{ def: 'chest_wood', dx: 0, dy: 0, rot: 0 }, { def: 'arm_basic', dx: 1, dy: 0, rot: 1 }, { def: 'jar', dx: 2, dy: 0, rot: 0 }] }; })()`);
await wait(900);
await page.screenshot({ path: `${out}/workshop-wing.png` });
await page.keyboard.press('KeyF'); await wait(600);
check(await ev(`window.__play.win?.id === 'drafting'`), 'F at the drafting table opens it');
check(await clickText('Save'), 'found the Save button');
await wait(400);
const lib = await ev(`(() => (S.g.sys.drafting?.lib ?? []).map((e) => e.name))()`);
check(lib.length === 1, `saved the blueprint tool's copy: ${JSON.stringify(lib)}`);
await page.screenshot({ path: `${out}/drafting.png` });
// Load puts it back in the (emptied) tool
await ev(`window.__play.blueprint = null`);
await wait(200);
check(await clickText('Load'), 'found the Load button');
await wait(300);
check(await ev(`window.__play.blueprint?.items?.length === 3`), 'Load puts the line back in the blueprint tool');
await page.keyboard.press('Escape'); await wait(300);

// 6) save, reload the page, Continue: the wing, the structures, their contents, the library
check(await ev(`window.__play.save(true)`), 'saved');
await page.reload();
await wait(1500);
await page.mouse.click(640, (Math.floor(uh * 0.45) + 10) * S);
await wait(2000);
const back = await ev(`(() => { const g = window.__game; if (!g) return null; const H = g.houseEnts; const c = H.rootAt(3, 8), k = H.rootAt(4, 7);
  return { chest: c?.def.id, stone: c?.inv.countId('stone'), crock: k?.def.id, pickles: (k?.mach.outBuf ?? []).reduce((a, s) => a + s.n, 0), wide: g.sys.house.map.w, lib: (g.sys.drafting?.lib ?? []).length, ledger: !!g.sys.house.ledger }; })()`);
check(back && back.chest === 'chest_wood' && back.stone === 9 && back.crock === 'jar' && back.pickles >= 1 && back.wide === 22 && back.lib === 1 && back.ledger, `after a reload and Continue: ${JSON.stringify(back)}`);
await ev(`(() => { const g = window.__game; window.__play.win = null; g.sys.house.enter(g); g.player.x = 6.5; g.player.y = 8.5; })()`);
await wait(1000);
await page.screenshot({ path: `${out}/workshop-reloaded.png` });

console.log(results.join('\n'));
console.log('errors', errors.slice(0, 10));
if (errors.length) process.exitCode = 1;
await browser.close();
