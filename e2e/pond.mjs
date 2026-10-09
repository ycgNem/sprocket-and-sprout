import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 31, name: 'QA', farmName: 'QA' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'short', shirt: 30, pants: 46 });
  const B = await import('/src/sim/build.ts');
  const I = await import('/src/sim/inventory.ts');
  const { O, Z } = await import('/src/sim/world/tilemap.ts');
  for (let y = 26; y < 40; y++) for (let x = 50; x < 66; x++) { g.map.setO(x, y, O.NONE); g.map.zone[g.map.idx(x, y)] = Z.FARM; g.soil.delete(g.map.idx(x, y)); }
  const p = B.place(g, 'fish_pond', 55, 29, 0);
  p.st.fish = 'woodland_koi'; p.st.pop = 7; p.inv.add(I.key('roe'), 4);
  B.place(g, 'arm_basic', 58, 30, 1); B.place(g, 'jar', 59, 30, 0);
  g.player.x = 57; g.player.y = 34;
  window.__pond = p.id;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e/out/win/pond.png' });
await page.evaluate(() => window.__app.screen.openWindow('struct', window.__pond));
await page.waitForTimeout(500);
await page.screenshot({ path: 'e2e/out/win/pondpanel.png' });
console.log('errors', errors);
await browser.close();
