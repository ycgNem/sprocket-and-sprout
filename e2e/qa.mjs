// Visual QA: a belt test bench and a contact sheet of every item icon.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/qa';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 31, name: 'QA', farmName: 'QA' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'short', shirt: 15, pants: 19 });
  const B = await import('/src/sim/build.ts');
  const I = await import('/src/sim/inventory.ts');
  const { O, Z } = await import('/src/sim/world/tilemap.ts');
  const { laneInsert } = await import('/src/sim/systems/belts.ts');
  for (let y = 26; y < 50; y++) for (let x = 40; x < 76; x++) { g.map.setO(x, y, O.NONE); g.map.zone[g.map.idx(x, y)] = Z.FARM; g.soil.delete(g.map.idx(x, y)); }
  const P = (id, x, y, r) => B.place(g, id, x, y, r);
  // a loop with curves
  for (let x = 44; x < 54; x++) P('belt_1', x, 30, 1);
  for (let y = 30; y < 36; y++) P('belt_1', 54, y, 2);
  for (let x = 54; x > 44; x--) P('belt_1', x, 36, 3);
  for (let y = 36; y > 30; y--) P('belt_1', 44, y, 0);
  // side-load into a brass line
  for (let x = 58; x < 70; x++) P('belt_2', x, 33, 1);
  for (let y = 28; y < 33; y++) P('belt_1', 62, y, 2);
  for (let y = 38; y > 33; y--) P('belt_1', 65, y, 0);
  // underground + splitter on a gilded line
  for (let x = 44; x < 48; x++) P('belt_3', x, 42, 1);
  P('under_3', 48, 42, 1); P('under_3', 52, 42, 1);
  for (let x = 53; x < 57; x++) P('belt_3', x, 42, 1);
  P('belt_3', 57, 42, 0); P('splitter_3', 57, 41, 0);
  for (let y = 36; y < 41; y++) { P('belt_3', 57, y, 0); P('belt_3', 58, y, 0); }
  // arms around a chest and a keg
  g.research.done.add('r_brewing');
  const chest = P('chest_wood', 66, 40, 0); chest.inv.add(I.key('grape'), 99);
  P('arm_basic', 67, 40, 1); P('keg', 68, 40, 0); P('arm_fast', 68, 41, 2); P('arm_long', 70, 40, 3); P('arm_filter', 66, 41, 2); P('arm_bulk', 69, 42, 1);
  const goods = ['strawberry', 'wood', 'stone', 'copper_ore', 'grape', 'egg', 'wine_grape', 'cheese'];
  let n = 0;
  for (const e of g.ents.belts) laneInsert(e.belt, n % 2, I.key(goods[n++ % goods.length]), 0.1 + (n % 3) * 0.25);
  g.player.x = 56; g.player.y = 46; g.time.min = 12 * 60;
  window.__app.renderer.cam.x = 57; window.__app.renderer.cam.y = 36;
  window.__fixCam = setInterval(() => { window.__app.renderer.cam.x = 57; window.__app.renderer.cam.y = 36; }, 5);
  window.__app.renderer.cam.targetZoom = 3;
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/belts.png` });
console.log('shot belts');
// icon contact sheet drawn straight onto the canvas
await page.evaluate(async () => {
  const { ITEMS } = await import('/src/data/items.ts');
  const { sprite } = await import('/src/render/atlas.ts');
  window.__app.loop.stop();
  const c = window.__app.canvas;
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fbe5a0';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  const cols = 40;
  ITEMS.forEach((d, i) => {
    const s = sprite('i:' + d.id);
    const x = (i % cols) * 32, y = Math.floor(i / cols) * 32;
    ctx.drawImage(s.img, s.x, s.y, 16, 16, x + 2, y + 2, 28, 28);
  });
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/icons.png` });
console.log('shot icons, count', await page.evaluate(async () => (await import('/src/data/items.ts')).ITEMS.length));
console.log('errors', errors.slice(0, 10));
await browser.close();
