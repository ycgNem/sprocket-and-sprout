// The automation core on screen (ROADMAP.md 4.3-4.9): root-cause glyphs, a healthy queued line,
// a field-limited gleaner line, a field gantry, a brownout, the line inspector (hold I) and the
// Lines tab. Writes e2e/out/works/*.png; fails on console errors.
//   BASE=http://localhost:5173/ node e2e/works.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/works';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 777, name: 'Works', farmName: 'Brass' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
});
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.evaluate(async () => {
  const g = window.__game;
  const B = await import('/src/sim/build.ts'), I = await import('/src/data/items.ts'), F = await import('/src/sim/systems/farming.ts'), C = await import('/src/data/crops.ts');
  const { O, T } = await import('/src/sim/world/tilemap.ts');
  const K = (id) => I.ITEM_INDEX.get(id) * 4;
  window.__q = { g, B, K, F, C };
  for (let y = 26; y <= 44; y++) for (let x = 38; x <= 66; x++) { g.map.setO(x, y, O.NONE); g.map.setG(x, y, T.GRASS); g.soil.delete(g.map.idx(x, y)); }
  const P = (id, x, y, r = 0) => B.place(g, id, x, y, r);
  // line A (healthy): chest -> arm -> jar -> arm -> chest
  const a = P('chest_wood', 40, 28); a.inv.add(K('cogbean'), 200);
  P('arm_basic', 41, 28, 1); P('jar', 42, 28); P('arm_basic', 43, 28, 1); P('chest_wood', 44, 28);
  // line B (starved): an empty chest -> arm -> jar -> arm -> crate
  P('chest_wood', 40, 31); P('arm_basic', 41, 31, 1); const jb = P('jar', 42, 31); jb.mach.made = 1; P('arm_basic', 43, 31, 1); P('chest_wood', 44, 31);
  // line C (blocked): chest -> arm -> jar -> arm -> a full chest
  const c = P('chest_wood', 40, 34); c.inv.add(K('cogbean'), 200);
  P('arm_basic', 41, 34, 1); P('jar', 42, 34); P('arm_basic', 43, 34, 1); const full = P('chest_wood', 44, 34);
  for (let i = 0; i < full.inv.size; i++) full.inv.slots[i] = { k: K('stone'), n: 999 };
  // line D (field-limited): a gleaner on cogbeans -> arm -> jar -> arm -> chest
  const gl = P('gleaner', 50, 29);
  P('arm_basic', 51, 29, 1); P('jar', 52, 29); P('arm_basic', 53, 29, 1); P('chest_wood', 54, 29);
  const bean = C.CROP_BY_ID.get('cogbean');
  for (let y = 28; y <= 30; y++) for (let x = 49; x <= 51; x++) {
    if (g.ents.at(x, y)) continue;
    F.till(g, x, y); F.plant(g, bean, g.map.idx(x, y)); const s = g.soil.get(g.map.idx(x, y)); s.water = true;
    s.crop.days = 2;
  }
  // a field gantry over a 5x6 strip with rails, on a water wheel's grid
  g.research.done.add('r_gantry');
  P('waterwheel', 64, 40); P('pole_wood', 60, 41); P('pole_wood', 56, 42);
  const gan = P('field_gantry', 50, 42, 0);
  for (let y = 36; y <= 41; y++) { P('rail', 50, y, 0); P('rail', 56, y, 0); }
  gan.inv.add(K('cogbean_seed'), 30);
  // a brownout: two sawmills on one water wheel
  P('waterwheel', 64, 30); P('pole_wood', 62, 32); P('pole_wood', 58, 33);
  const sa = P('sawmill', 59, 30), sb = P('sawmill', 59, 34);
  sa.mach.inBuf.set(K('wood'), 500); sb.mach.inBuf.set(K('wood'), 500);
  g.player.x = 50; g.player.y = 36; g.time.min = 13 * 60;
  for (let i = 0; i < 60 * 70; i++) g.tick();
  const r = window.__app.renderer; r.cam.x = 51; r.cam.y = 35; r.cam.zoom = r.cam.targetZoom = 2;
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/01-works.png` });
// hover the starved jar's line with I held: the inspector
const toScreen = (x, y) => page.evaluate(([x, y]) => { const r = window.__app.renderer; const s = r.tileToScreen(x, y); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; }, [x, y]);
let p = await toScreen(41.5, 31.5);
await page.mouse.move(p.x, p.y);
await page.keyboard.down('KeyI');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/02-inspect-starved.png` });
p = await toScreen(51.5, 29.5);
await page.mouse.move(p.x, p.y);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/03-inspect-field.png` });
await page.keyboard.up('KeyI');
// hover tooltip on the field-limited jar
p = await toScreen(52.5, 29.5);
await page.mouse.move(p.x, p.y);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/04-tooltip-field.png` });
// the Lines tab
await page.evaluate(() => { const play = window.__play; play.openWindow('stats'); play.win.data.tab = 'lines'; });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/05-lines-tab.png` });
// pick the line ends in turn, with the fixes shown
const sinks = await page.evaluate(async () => (await import('/src/sim/lines.ts')).lineSinks(window.__game).map((e) => e.id));
for (const [i, id] of sinks.slice(0, 5).entries()) {
  await page.evaluate((id) => { window.__play.win.data.sink = id; window.__play.win.data.showFix = true; }, id);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/06-line-${i}.png` });
}
await page.evaluate(() => { window.__play.win = null; });
// the pole window: the grid sentence and the switch
await page.evaluate(() => { const g = window.__game; const pole = g.ents.at(62, 32); g.player.x = 62; g.player.y = 33.5; window.__play.openWindow('struct', pole.id); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/07-pole.png` });
console.log(`works shots in ${out}; console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(e);
if (errors.length) process.exitCode = 1;
await browser.close();
