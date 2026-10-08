// Farmhouse interior: day, night, kitchen window, almanac.
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
  window.__app.startGame(g, { skin: 2, hair: 9, hairStyle: 'long', shirt: 28, pants: 19 });
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
await ev(`(() => { const g = S.g; g.time.min = 13 * 60; g.weather = 'sun'; g.flags.add('home_kitchen'); g.flags.add('home_pantry');
  const I = g.player.inv; const { key } = window.__inv ?? {}; })()`);
await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); const g = S.g; g.player.inv.add(I.key('flour'), 6); g.player.inv.add(I.key('egg'), 4); g.player.inv.add(I.key('milk'), 3); g.player.inv.add(I.key('potato'), 3); g.player.inv.add(I.key('sugar'), 2); window.__app.screen.openWindow('cooking'); })()`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/kitchen.png` });
await ev(`(() => { const g = S.g; window.__app.screen.closeWindow?.(); g.sys.house.interact(g, 12, 5); })()`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/almanac.png` });
// exit through the door and sleep cycle
const res = await ev(`(() => { const g = S.g; window.__app.screen.closeWindow?.(); g.sys.house.leave(g); const a = g.player.where; g.sys.house.enter(g); return [a, g.player.where]; })()`);
console.log('leave then enter', res);
console.log('errors', errors.slice(0, 10));
await browser.close();
