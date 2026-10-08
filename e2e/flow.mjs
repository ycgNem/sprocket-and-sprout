// End-to-end flow with real input: new game -> till/plant/water -> go inside, sleep in the bed ->
// morning summary -> autosave -> reload -> Continue from the title screen.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/flow';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

await page.goto(base);
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('sns_save_')) localStorage.removeItem(k); });
await page.reload();
await wait(1500);
const ui = await page.evaluate(() => ({ scale: window.__app.uiScale, w: window.__app.canvas.width, h: window.__app.canvas.height, dpr: window.__app.dpr }));
const S = ui.scale / ui.dpr, uw = ui.w / ui.scale, uh = ui.h / ui.scale;
await page.mouse.click(640, (Math.floor(uh * 0.45) + 10) * S);
await wait(300);
const fx = (Math.floor((uw - 340) / 2) + 150) * S, fy0 = (Math.floor((uh - 230) / 2) + 36 + 8) * S;
await page.mouse.click(fx, fy0); await wait(120); await page.keyboard.type('Wren2'); await wait(120);
await page.mouse.click(fx, fy0 + 22 * S); await wait(120); await page.keyboard.type('Bramble'); await wait(120);
await page.mouse.click((Math.floor((uw - 340) / 2) + 340 - 62) * S, (Math.floor((uh - 230) / 2) + 230 - 18) * S);
await wait(2200);
check(await page.evaluate(() => window.__game?.player.name === 'Wren2'), 'new game started with typed name');
await page.keyboard.press('Enter'); // close the welcome window
await wait(300);
const tileScreen = (dx, dy) => page.evaluate(([dx, dy]) => { const g = window.__game, r = window.__app.renderer; r.cam.x = g.player.x; r.cam.y = g.player.y - 0.6; const s = r.tileToScreen(Math.floor(g.player.x) + dx + 0.5, Math.floor(g.player.y) + dy + 0.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; }, [dx, dy]);
// walk down a bit to open ground
await page.keyboard.down('KeyS'); await wait(700); await page.keyboard.up('KeyS'); await wait(200);
// clear + till 3 tiles in front, plant, water
await page.keyboard.press('Digit1'); await wait(80);
for (const dx of [-1, 0, 1]) { const p = await tileScreen(dx, 1); await page.mouse.click(p.x, p.y); await wait(420); }
const tilled = await page.evaluate(() => window.__game.soil.size);
check(tilled >= 2, `tilled ${tilled} tiles by clicking`);
await page.keyboard.press('Digit7'); await wait(80);
for (const dx of [-1, 0, 1]) { const p = await tileScreen(dx, 1); await page.mouse.click(p.x, p.y); await wait(200); }
const planted = await page.evaluate(() => [...window.__game.soil.values()].filter((s) => s.crop).length);
check(planted >= 2, `planted ${planted} seeds`);
await page.keyboard.press('Digit2'); await wait(80);
for (const dx of [-1, 0, 1]) { const p = await tileScreen(dx, 1); await page.mouse.click(p.x, p.y); await wait(500); }
const watered = await page.evaluate(() => [...window.__game.soil.values()].filter((s) => s.water).length);
check(watered >= 2, `watered ${watered} tiles`);
await shot('01-planted');
// go to bed: teleport next to the door and right-click it
await page.evaluate(() => { const g = window.__game; g.player.x = 49.5; g.player.y = 23.3; g.player.dir = 0; });
await wait(300);
const door = await page.evaluate(() => { const r = window.__app.renderer; const g = window.__game; r.cam.x = g.player.x; r.cam.y = g.player.y - 0.6; const s = r.tileToScreen(49.5, 21.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; });
await page.mouse.click(door.x, door.y, { button: 'right' });
await wait(700);
check(await page.evaluate(() => window.__game.player.where === 'house'), 'went inside through the farmhouse door');
await shot('02-inside');
// walk up beside the bed and right-click it
await page.evaluate(() => { const g = window.__game; g.player.x = 3.5; g.player.y = 3.9; g.player.dir = 3; });
await wait(900);
const bed = await page.evaluate(() => { const r = window.__app.renderer; const s = r.tileToScreen(2.5, 3.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; });
await page.mouse.click(bed.x, bed.y, { button: 'right' });
await wait(400);
await shot('02-bed-prompt');
check(await page.evaluate(() => window.__play.win?.id === 'confirm'), 'bed prompt opened from the bed');
await page.keyboard.press('Enter');
await wait(500);
check(await page.evaluate(() => window.__game.sleeping || window.__game.time.day === 2), 'went to sleep');
// wait for morning
for (let i = 0; i < 60; i++) {
  if (await page.evaluate(() => window.__play.win?.id === 'summary')) break;
  await wait(500);
}
await shot('03-summary');
check(await page.evaluate(() => window.__game.time.day === 2), 'woke up on day 2');
check(await page.evaluate(() => window.__game.player.where === 'house'), 'woke up inside the farmhouse');
await page.keyboard.press('Enter');
await wait(600);
check(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sns_save_'))), 'autosaved');
const grew = await page.evaluate(() => [...window.__game.soil.values()].filter((s) => s.crop && s.crop.days >= 1).length);
check(grew >= 2, `watered crops grew overnight (${grew})`);
// reload and continue
await page.reload();
await wait(1500);
await shot('04-title-continue');
await page.mouse.click(640, (Math.floor(uh * 0.45) + 10) * S);
await wait(2000);
const loaded = await page.evaluate(() => ({ name: window.__game?.player.name, day: window.__game?.time.day, soil: window.__game?.soil.size, slot: window.__play?.slot }));
check(loaded.name === 'Wren2' && loaded.day === 2 && loaded.soil >= 2, `continue loaded the farm: ${JSON.stringify(loaded)}`);
await shot('05-loaded');
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
check(errors.length === 0, `no console errors (${errors.length})`);
for (const e of errors.slice(0, 10)) console.log(e);
await browser.close();
