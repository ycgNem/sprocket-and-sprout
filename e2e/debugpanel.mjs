import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 3, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
});
await page.waitForTimeout(800);
await page.keyboard.press('Backquote');
await page.waitForTimeout(500);
await page.screenshot({ path: 'e2e/out/win/debug.png' });
console.log('errors', errors);
await browser.close();
