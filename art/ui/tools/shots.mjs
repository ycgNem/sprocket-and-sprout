// UI skin check shots: node art/ui/tools/shots.mjs [out dir]   (dev server on :5173)
// Waits for every sheet, clears the skin's composed-frame cache (src/ui/skin.ts resetSkin: frames
// composed while ui.png was still loading would otherwise keep the missing-sprite checker), then
// shoots the title (plain + hovered button), the HUD plates and windows the screens sweep lacks.
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] ?? 'e2e/out/ui-skin';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const ev = (f) => page.evaluate(f);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await wait(400); await page.screenshot({ path: `${out}/${name}.png` }); console.log('  ' + name); };

await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen?.demo);
await ev(async () => {
  await (await import('/src/render/atlas.ts')).artReady();
  (await import('/src/ui/skin.ts')).resetSkin();
});
await page.mouse.move(5, 5);
await shot('title');
// hover the first title button (New Game, centered at 640, 343 in a 1280x720 viewport)
await page.mouse.move(640, 343);
await shot('title-hover');
await page.mouse.move(5, 5);
await ev(() => window.__app.startGame(new window.__Game({ seed: 999, name: 'Robin', farmName: 'Willowbrook' }), { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 }));
await wait(1500);
await ev(async () => (await import('/src/ui/skin.ts')).resetSkin());
await shot('welcome');
await ev(() => { const p = window.__play ?? window.__app.screen; p.closeWindow(); });
await ev(() => { const p = window.__app.screen; p.toast('Saved the day! The keg is happy.'); const k = (id) => window.__itemIndex?.get?.(id); });
await shot('hud');
await ev(() => { const p = window.__app.screen; p.openWindow('menu', 'crafting'); });
await shot('crafting');
await ev(() => { const p = window.__app.screen; p.openWindow('journal'); });
await shot('journal');
await ev(() => { const p = window.__app.screen; p.openWindow('mail'); });
await shot('mail');
await ev(() => { const p = window.__app.screen; p.g.player.skills.farming = 5; p.openWindow('perk'); });
await shot('perk');
await ev(() => { const p = window.__app.screen; p.openWindow('research'); });
await shot('research');
await ev(() => { const p = window.__app.screen; p.openWindow('achievements'); });
await shot('achievements');
console.log(errors.length ? 'console:\n' + errors.join('\n') : 'no console errors');
await browser.close();
