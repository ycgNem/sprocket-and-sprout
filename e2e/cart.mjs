import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 30, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'home']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  window.S = { g };
  // jump to a Friday morning
  while (g.weekday !== 4) { g.goToBed(); g.time.min = 1559.99; g.tick(); }
  window.__app.screen.closeWindow?.();
  if (g.player.where === 'house') g.sys.house.leave(g);
  g.time.min = 10 * 60; g.weather = 'sun';
  const [x, y] = g.sys.cart.pos;
  g.player.x = x + 1.5; g.player.y = y + 3.2; g.player.dir = 0;
});
await page.waitForTimeout(800);
await page.evaluate(() => window.__app.screen.closeWindow?.());
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e/out/win/cart.png' });
const pos = await page.evaluate(() => { const r = window.__app.renderer; const [x, y] = S.g.sys.cart.pos; const s = r.tileToScreen(x + 1.5, y + 0.5); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; });
await page.mouse.click(pos.x, pos.y, { button: 'right' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'e2e/out/win/cartshop.png' });
console.log('win', await page.evaluate(() => window.__play.win?.id), 'errors', errors.slice(0, 5));
await browser.close();
