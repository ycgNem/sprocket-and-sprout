// Ground transitions where terrains meet without a Wang set (1.2 playtest: "ground tiles don't
// connect"): the river bridges, a farm plot of tilled and watered soil against a path, sand and
// water, and the town square. Writes e2e/out/terrainshots/*.png.
//   BASE=http://localhost:5173/ node e2e/terrainshots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/terrainshots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
  window.__T = (await import('/src/sim/world/tilemap.ts')).T;
  window.__farm = await import('/src/sim/systems/farming.ts');
});
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
const shot = async (name, js) => {
  await page.evaluate(js);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const at = (x, y, extra = '') => `(() => { const g = window.__game, r = window.__app.renderer; window.__play.win = null; g.player.x = ${x}; g.player.y = ${y}; r.cam.x = ${x}; r.cam.y = ${y}; r.cam.zoom = r.cam.targetZoom = 3; ${extra} for (const c of r.chunks.values()) c.ver = -1; })()`;
// the first bridge plank on a row
const bridge = (y) => `(() => { const g = window.__game, T = window.__T; for (let x = 85; x < 125; x++) if (g.map.g(x, ${y}) === T.PLANKS) return x; return 100; })()`;
const bx = await page.evaluate(bridge(45));
await shot('bridge-north', at(bx + 1, 46));
const bx2 = await page.evaluate(bridge(89));
await shot('bridge-south', at(bx2 + 1, 90));
// a farm plot: tilled + watered soil against a flagstone path, sand, a pond edge and dirt
const FARM = `{ const g = window.__game, m = g.map, T = window.__T, F = window.__farm;
  for (let y = 30; y <= 40; y++) for (let x = 44; x <= 58; x++) { m.setO(x, y, 0); m.setG(x, y, T.GRASS); g.soil.delete(m.idx(x, y)); }
  for (let y = 31; y <= 39; y++) m.setG(51, y, T.PATH);
  for (let x = 44; x <= 58; x++) m.setG(x, 35, T.PATH);
  for (let y = 36; y <= 39; y++) for (let x = 53; x <= 56; x++) m.setG(x, y, T.SAND);
  for (let y = 31; y <= 33; y++) for (let x = 54; x <= 57; x++) m.setG(x, y, T.POND);
  for (let y = 36; y <= 39; y++) for (let x = 44; x <= 47; x++) m.setG(x, y, T.DIRT);
  const till = (x, y, w) => { if (F.till(g, x, y)) { const s = g.soil.get(m.idx(x, y)); if (s) s.water = w; } };
  for (let y = 31; y <= 34; y++) for (let x = 47; x <= 53; x++) if (m.g(x, y) !== T.PATH && m.g(x, y) !== T.POND) till(x, y, (x + y) % 3 === 0);
  for (let y = 36; y <= 38; y++) for (let x = 46; x <= 54; x++) if (m.g(x, y) !== T.PATH) till(x, y, x > 50); }`;
await shot('farm-plot', at(51, 35.5, FARM));
await shot('farm-plot-winter', at(51, 35.5, FARM + ' g.time.season = 3;'));
// an irregular plot of tilled soil against grass (the soil-grass set's own seams)
const PLOT = `{ const g = window.__game, m = g.map, T = window.__T, F = window.__farm;
  for (let y = 30; y <= 40; y++) for (let x = 44; x <= 58; x++) { m.setO(x, y, 0); m.setG(x, y, T.GRASS); g.soil.delete(m.idx(x, y)); }
  const cells = ['..XXX..XX...', '.XXXXX.XXX..', 'XXX.XXXX.X..', '.XX..XXXXXX.', '..XXX.X..XX.', '...XXXXX....', '.X..XXX..XX.', 'XXX..X...XXX'];
  cells.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') { F.till(g, 45 + i, 31 + j); const s = g.soil.get(m.idx(45 + i, 31 + j)); if (s) s.water = (i * 7 + j * 3) % 5 === 0; } })); }`;
await shot('farm-irregular', at(51, 35, PLOT + ' window.__game.time.season = 0;'));
await page.evaluate(async () => (await import('/src/render/blend.ts')).setBlendOverride(false));
await shot('farm-irregular-artset', at(51, 35, PLOT + ' window.__game.time.season = 0;'));
await page.evaluate(async () => (await import('/src/render/blend.ts')).setBlendOverride(true));await shot('town', at(133, 61));
console.log(`terrain shots in ${out}; errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(e);
await browser.close();
