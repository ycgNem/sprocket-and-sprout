// Scripted Playwright playthrough: creates a farmer via the UI, then lets the bot
// (tests/bot.ts) play N days in the real browser build, screenshotting each morning.
import { chromium } from 'playwright';
import fs from 'node:fs';

const days = Number(process.argv[2] ?? 14);
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/bot';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(base);
await page.waitForTimeout(1500);
// start through the real UI
const ui = await page.evaluate(() => ({ scale: window.__app.uiScale, w: window.__app.canvas.width, h: window.__app.canvas.height, dpr: window.__app.dpr }));
const S = ui.scale / ui.dpr, uw = ui.w / ui.scale, uh = ui.h / ui.scale;
const hasSave = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sns_save_')));
await page.mouse.click(640, (Math.floor(uh * 0.45) + 10 + (hasSave ? 26 : 0)) * S);
await page.waitForTimeout(400);
const fx = (Math.floor((uw - 340) / 2) + 150) * S, fy0 = (Math.floor((uh - 230) / 2) + 36 + 8) * S;
await page.mouse.click(fx, fy0); await page.waitForTimeout(150); await page.keyboard.type('Botley'); await page.waitForTimeout(150);
await page.mouse.click(fx, fy0 + 22 * S); await page.waitForTimeout(150); await page.keyboard.type('Gearfield'); await page.waitForTimeout(150);
await page.mouse.click((Math.floor((uw - 340) / 2) + 340 - 62) * S, (Math.floor((uh - 230) / 2) + 230 - 18) * S);
await page.waitForTimeout(1500);
const started = await page.evaluate(() => !!window.__game && window.__game.player.name);
console.log('started as', started);
await page.evaluate(async () => {
  const { Bot } = await import('/tests/bot.ts');
  window.__bot = new Bot(window.__game);
});
const report = [];
for (let d = 0; d < days; d++) {
  const r = await page.evaluate(() => {
    const play = window.__play;
    play.win = null;
    window.__game.paused = false;
    window.__app.loop.fastForward = null;
    const t0 = performance.now();
    window.__bot.playDay();
    const ms = performance.now() - t0;
    const g = window.__game;
    const l = window.__bot.log[window.__bot.log.length - 1];
    // show the farm in the morning
    g.player.x = 52; g.player.y = 32;
    return { ...l, ms: Math.round(ms), time: g.time };
  });
  report.push(r);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/day-${String(d + 1).padStart(2, '0')}.png` });
  console.log(`day ${r.day}: money ${r.money} earned ${r.earned} soil ${r.soil} research ${r.research.length} quests ${r.quests} (${r.ms}ms) ${r.notes.slice(0, 3).join('; ')}`);
}
// also check that saving + loading the bot's farm works in the browser
const saved = await page.evaluate(() => window.__play.save(true));
console.log('saved:', saved);
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log('errors:', errors.length);
for (const e of errors.slice(0, 20)) console.log(e);
await browser.close();
