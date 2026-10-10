// The full map (M): building names that don't overlap, a head for you and each villager, hovers.
// Writes e2e/out/mapshot/*.png.
//   BASE=http://localhost:5173/ node e2e/mapshot.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/mapshot';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
});
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
// about 11am on the first day: villagers about town (42 ticks a game minute)
const where = await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 42 * 300; i++) g.tick();
  window.__play.win = null;
  window.__play.openWindow('map');
  return g.time.min;
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/map.png` });
// hover the ranch and a villager: screen position of a map point = the window's map origin + tile * scale
const pt = await page.evaluate(() => {
  const g = window.__game, ui = window.__play.ui ?? window.__app.ui;
  const b = g.map.buildings.find((bb) => bb.id === 'ranch');
  const n = g.sys.npcs.list.find((nn) => nn.visible);
  return { b: b && [b.x + b.w / 2, b.y + b.h / 2], n: n && [n.x, n.y], name: n?.id, uw: ui?.w, uh: ui?.h };
});
// the map is centred: find its origin from the window frame size the same way drawMap does
const toScreen = async ([tx, ty]) => page.evaluate(([tx, ty]) => {
  const g = window.__game, m = g.map;
  const ui = window.__app.ui;
  const scale = Math.max(1, Math.min(Math.floor((ui.w - 40) / m.w), Math.floor((ui.h - 60) / m.h))) || 1;
  const fitRaw = Math.min((ui.w - 40) / m.w, (ui.h - 60) / m.h);
  const fit = fitRaw >= 1 ? Math.floor(fitRaw) : fitRaw;
  const s2 = scale >= 1 && m.w * scale < ui.w - 40 ? scale : fit;
  const w = Math.round(m.w * s2) + 16, h = Math.round(m.h * s2) + 30;
  const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2) - 10;
  const k = ui.ctx.canvas.clientWidth / ui.w;
  return [(x + 8 + tx * s2) * k, (y + 18 + ty * s2) * k];
}, [tx, ty]);
if (pt.b) {
  const [sx, sy] = await toScreen(pt.b);
  await page.mouse.move(sx - 5, sy - 5);
  await page.mouse.move(sx, sy, { steps: 4 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/map-hover-ranch.png` });
}
if (pt.n) {
  const [sx, sy] = await toScreen(pt.n);
  await page.mouse.move(sx - 5, sy - 5);
  await page.mouse.move(sx, sy, { steps: 4 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/map-hover-npc.png` });
}
console.log('map shots in', out, 'at minute', where, 'npc', pt.name, 'ui', pt.uw, pt.uh, '; errors:', errors.length);
for (const e of errors.slice(0, 5)) console.log('  ', e);
await browser.close();
