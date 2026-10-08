import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(1200);
for (const season of [2, 3]) {
  await page.evaluate((season) => {
    const g = new window.__Game({ seed: 3, name: 'Wren', farmName: 'Hollow' });
    for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'energy']) g.flags.add('tip_' + t);
    window.__app.startGame(g, { skin: 2, hair: 9, hairStyle: 'long', shirt: 28, pants: 19 });
    g.time.season = season; g.time.min = 12 * 60;
    g.player.y += 2;
    window.__app.renderer.cam.targetZoom = 4;
    window.__app.renderer.invalidateAll();
  }, season);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `e2e/out/win/house_s${season}.png`, clip: { x: 340, y: 120, width: 600, height: 420 } });
}
console.log('errors', errors);
await browser.close();
