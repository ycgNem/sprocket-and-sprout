// The Deepworks chambers in the running game, derelict and restored: each works chamber level
// (5 lift, 10 boiler, 15 pump, 20 lamp works, 25 lockers + rail cart, 30 star), the restorable
// machines (lift, pump, cart) once with their parts in and once without. Full screenshots and a
// close-up around the machines go to e2e/out/deep/chamber-<level>-<state>.png (+ -zoom.png).
// Usage: node art/deep/tools/shots.mjs [level ...]   (BASE=http://localhost:5173/ by default)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const want = process.argv.slice(2).map(Number);
fs.mkdirSync('e2e/out/deep', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => window.__app && window.__Game);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 24, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'mine']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  const A = await import('/src/render/atlas.ts');
  await A.artReady();
  window.S = { g };
  g.flags.add('waterworks');
  g.research.done.add('r_spark');
  g.time.min = 11 * 60;
});
// (the Waterworks flag fires its era banner and card a moment later: let them come and go)
await page.waitForTimeout(2500);
await page.evaluate(() => { const p = window.__app.screen; p.winQ.length = 0; while (p.win) p.closeWindow(); window.__app.renderer.juice.banners.length = 0; });

const SHOTS = [[5, 1], [15, 1], [25, 1], [5, 0], [10, 0], [15, 0], [20, 0], [25, 0], [30, 0]].filter(([l]) => !want.length || want.includes(l));
for (const [level, restored] of SHOTS) {
  const box = await page.evaluate(({ level, restored }) => {
    const { g } = window.S;
    const st = g.sys.mine;
    for (const k of ['lift', 'boiler', 'pump', 'lampworks', 'lockers', 'cart', 'star']) { g.flags.add('card:' + k); g.flags.add('observed:' + k); }
    for (const id of ['earth', 'clayworks', 'frost', 'ember', 'crystal', 'starfall']) g.flags.add('deep:' + id);
    for (const f of ['chamber:lift', 'chamber:pump', 'chamber:cart']) restored ? g.flags.add(f) : g.flags.delete(f);
    st.enter(g, level);
    const c = st.chambers[0], c2 = st.chambers[st.chambers.length - 1];
    g.player.x = (c.x + c2.x + c2.w) / 2;
    g.player.y = c.y + 3.2;
    return { x0: c.x - 1, x1: c2.x + c2.w + 1, y0: c.y - 3.2, y1: c.y + 4.2 };
  }, { level, restored });
  // let the level's events land, then clear toasts, banners, achievements and any card or queued window
  const quiet = () => page.evaluate(() => {
    const p = window.__app.screen, r = window.__app.renderer;
    p.hud.toasts.length = 0; p.achQ.length = 0; r.juice.banners.length = 0;
    if (p.winQ) p.winQ.length = 0;
    while (p.win) p.closeWindow();
  });
  await page.waitForTimeout(400);
  await quiet();
  await page.waitForTimeout(300);
  await quiet();
  await page.evaluate(() => { const { g } = window.S; const r = window.__app.renderer; r.cam.targetZoom = r.cam.zoom = 2; r.cam.x = g.player.x; r.cam.y = g.player.y - 2.2; });
  await page.waitForTimeout(600);
  const file = `e2e/out/deep/chamber-${level}-${restored ? 'restored' : 'derelict'}`;
  await quiet();
  await page.screenshot({ path: file + '.png' });
  // the close-up: the world at x4 around the machines
  await page.evaluate(() => { const { g } = window.S; const r = window.__app.renderer; r.cam.targetZoom = r.cam.zoom = 4; r.cam.x = g.player.x; r.cam.y = g.player.y - 2.2; });
  await page.waitForTimeout(500);
  const clip = await page.evaluate((b) => {
    const r = window.__app.renderer;
    const a = r.tileToScreen(b.x0, b.y0), z = r.tileToScreen(b.x1, b.y1);
    return { x: Math.max(0, a.x), y: Math.max(0, a.y), width: Math.min(1280, z.x) - Math.max(0, a.x), height: Math.min(720, z.y) - Math.max(0, a.y) };
  }, box);
  await quiet();
  await page.screenshot({ path: file + '-zoom.png', clip });
  console.log(file + '.png', JSON.stringify(clip));
}
// the works problems' doorways: level 6's gallery caved in and shored, level 10's stair flooded and drained
for (const [level, flag, on] of [[6, 'gallery_shored', 0], [6, 'gallery_shored', 1], [10, 'waterworks', 0], [10, 'waterworks', 1]].filter(([l]) => !want.length || want.includes(l))) {
  const at = await page.evaluate(({ level, flag, on }) => {
    const { g } = window.S;
    on ? g.flags.add(flag) : g.flags.delete(flag);
    g.sys.mine.enter(g, level);
    const [x, y] = g.sys.mine.gallery;
    g.player.x = x + 3.5; g.player.y = y + 3.5;
    const r = window.__app.renderer;
    r.cam.targetZoom = r.cam.zoom = 4; r.cam.x = x + 0.5; r.cam.y = y + 1;
    return [x, y];
  }, { level, flag, on });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = window.__app.screen; p.hud.toasts.length = 0; p.winQ.length = 0; while (p.win) p.closeWindow(); window.__app.renderer.juice.banners.length = 0; });
  await page.evaluate(([x, y]) => { const r = window.__app.renderer; r.cam.x = x + 0.5; r.cam.y = y + 1; }, at);
  await page.waitForTimeout(400);
  const clip = await page.evaluate(([x, y]) => { const r = window.__app.renderer; const a = r.tileToScreen(x - 3, y - 2), z = r.tileToScreen(x + 4, y + 3); return { x: a.x, y: a.y, width: z.x - a.x, height: z.y - a.y }; }, at);
  const file = `e2e/out/deep/gallery-${level}-${on ? 'open' : 'shut'}.png`;
  await page.evaluate(() => { const p = window.__app.screen; p.hud.toasts.length = 0; p.achQ.length = 0; window.__app.renderer.juice.banners.length = 0; });
  await page.screenshot({ path: file, clip });
  console.log(file);
}
await page.evaluate(() => window.S.g.flags.add('waterworks'));
console.log('console errors:', errors.length);
for (const e of errors.slice(0, 10)) console.log('  ' + e);
await browser.close();
