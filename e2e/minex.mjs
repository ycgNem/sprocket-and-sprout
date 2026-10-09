import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
fs.mkdirSync('e2e/out/win', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 24, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'mine']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  window.S = { g };
  const { O } = await import('/src/sim/world/tilemap.ts');
  g.sys.mine.enter(g, 10);
  const m = g.sys.mine.map;
  for (let i = 0; i < m.obj.length; i++) if (m.obj[i] === O.TREASURE) { g.player.x = (i % m.w) + 1.5; g.player.y = Math.floor(i / m.w) + 1.2; }
  g.sys.mine.monsters = [];
});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'e2e/out/win/treasure.png' });
console.log('errors', errors.slice(0, 5));
await browser.close();
