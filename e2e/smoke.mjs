// Playwright smoke test: title -> new game -> walk around -> screenshots + console errors.
// Usage: node e2e/smoke.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));

const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
};
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(base);
await wait(2500);
await shot('01-title');

// open new game
const ui = await page.evaluate(() => {
  const a = window.__app;
  return { scale: a.uiScale, w: a.canvas.width, h: a.canvas.height, dpr: a.dpr };
});
console.log('ui', ui);
const S = ui.scale / ui.dpr;
const cx = 640;
// "New Game" is the first button when there are no saves: y = 0.45*h(ui) .. compute from ui px
const uh = ui.h / ui.scale;
const btnY = (Math.floor(uh * 0.45) + 10) * S;
await page.mouse.click(cx, btnY);
await wait(500);
await shot('02-newgame');
// fill name fields by clicking them then typing
const uw = ui.w / ui.scale;
const fx = (Math.floor((uw - 340) / 2) + 150) * S;
const fy0 = (Math.floor((uh - 230) / 2) + 36 + 8) * S;
await page.mouse.click(fx, fy0);
await wait(150);
await page.keyboard.type('Robin');
await wait(150);
await page.mouse.click(fx, fy0 + 22 * S);
await wait(150);
await page.keyboard.type('Willow');
await wait(200);
await shot('03-newgame-filled');
// Begin button
const bx = (Math.floor((uw - 340) / 2) + 340 - 110 + 48) * S;
const by = (Math.floor((uh - 230) / 2) + 230 - 28 + 10) * S;
await page.mouse.click(bx, by);
await wait(500);
await shot('03b-mode-map');
// step 2: game mode + farm map -> Begin!
const w2 = Math.min(460, uw - 16), h2 = Math.min(272, uh - 16);
await page.mouse.click((Math.floor((uw - w2) / 2) + w2 - 62) * S, (Math.floor((uh - h2) / 2) + h2 - 18) * S);
await wait(2000);
await shot('04-farm');
await page.keyboard.press('Enter');
await wait(300);
// walk around
await page.keyboard.down('KeyD');
await wait(900);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyS');
await wait(900);
await page.keyboard.up('KeyS');
await wait(300);
await shot('05-walked');
// open inventory
await page.keyboard.press('KeyE');
await wait(400);
await shot('06-inventory');
await page.keyboard.press('KeyE');
await wait(150);
await page.keyboard.press('KeyC');
await wait(400);
await shot('07-crafting');
await page.keyboard.press('Escape');
await wait(300);
// till + plant with hoe (slot 1)
await page.keyboard.press('Digit1');
await wait(100);
for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1]]) {
  const p = await page.evaluate(([dx, dy]) => { const g = window.__game, r = window.__app.renderer; const s = r.tileToScreen(Math.floor(g.player.x) + dx + 0.5, Math.floor(g.player.y) + dy + 0.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; }, [dx, dy]);
  await page.mouse.click(p.x, p.y);
  await wait(450);
}
await page.keyboard.press('Digit7');
await wait(100);
{
  const p = await page.evaluate(() => { const g = window.__game, r = window.__app.renderer; const s = r.tileToScreen(Math.floor(g.player.x) + 0.5, Math.floor(g.player.y) + 1.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; });
  await page.mouse.click(p.x, p.y);
  await wait(300);
}
await shot('08-tool');
const state = await page.evaluate(() => {
  const g = window.__game;
  return { x: g.player.x, y: g.player.y, energy: g.player.energy, soil: g.soil.size, time: g.time };
});
console.log('state', JSON.stringify(state));

fs.writeFileSync(`${out}/console.txt`, errors.join('\n'));
console.log('console errors/warnings:', errors.length);
for (const e of errors.slice(0, 30)) console.log(e);
await browser.close();
