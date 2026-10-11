// In-game views of the places this group's art goes: the square on Sprocket Fair day (spring 13,
// the Professor's test plate) and on Harvest Haul day (fall 15), and a Tinker's Yard hall (the
// ruins farm). With --overlay it also draws this group's imported sprites into the live frame
// where the renderer will put them (for a look before the renderer is wired: the plate on the
// ground, stalls and the podium along the square's north side, wrecks in a hall), so the art can
// be judged in place. Usage:
//   node art/fairs/tools/shots.mjs [--overlay]   (BASE=http://localhost:5173/)
//   -> e2e/out/fairs-fair.png, e2e/out/fairs-haul.png, e2e/out/ruins-hall.png (+ -overlay variants)
import { chromium } from 'playwright';

const overlay = process.argv.includes('--overlay');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const errors = [];

async function open(opts) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.BASE ?? 'http://localhost:5173/');
  await page.waitForFunction(() => window.__app?.screen);
  await page.evaluate((opts) => {
    const g = new window.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow', ...opts });
    window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
  }, opts);
  await page.waitForFunction(() => window.__play && window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 10 && await page.evaluate(() => !!window.__play?.win); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await page.waitForFunction(() => window.__play && window.__game, null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__game, p = window.__play;
    p.win = null; g.sys.dialogue = null; p.hud.toasts = [];
    for (const t of ['tip_machine', 'tip_move', 'tip_tools', 'tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can']) g.flags.add(t);
    const cam = window.__app.renderer.cam;
    cam.follow = function () { this.zoom = this.targetZoom; };
  });
  await page.mouse.move(1279, 719);
  return page;
}

/** draw named sprites into the world after each frame: items [{ name, x, y }] in world px */
const hook = (page, items) => page.evaluate(async (items) => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const r = window.__app.renderer;
  const orig = r.draw.bind(r);
  r.draw = (g, dt) => {
    orig(g, dt);
    const ctx = r.ctx, cam = r.cam, z = cam.zoom;
    const ox = Math.round(r.W / 2 - Math.round(cam.x * 16) * z), oy = Math.round(r.H / 2 - Math.round(cam.y * 16) * z);
    ctx.save();
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = false;
    const t = Math.floor(performance.now() / 250);
    for (const it of items) {
      const name = it.name.replace('{f}', String(t % (it.n ?? 2)));
      if (it.shadow) A.drawSprite(ctx, A.sprite(`shadow:${it.shadow}`), it.sx, it.sy);
      A.drawSprite(ctx, A.sprite(name), it.x, it.y);
    }
    ctx.restore();
  };
}, items);

const frame = (page, x, y, z, min) => page.evaluate(([x, y, z, min]) => {
  const g = window.__game, r = window.__app.renderer;
  if (min != null) g.time.min = min;
  r.cam.zoom = r.cam.targetZoom = z; r.cam.x = x; r.cam.y = y; window.__play.hud.toasts = [];
}, [x, y, z, min]);

// ---- the Sprocket Fair: spring 13, 10am, on the square
{
  const page = await open({});
  await page.evaluate(() => { const g = window.__game; g.time.season = 0; g.time.day = 13; g.time.min = 600; g.player.where = 'world'; g.player.x = 133.5; g.player.y = 67.5; });
  await page.waitForTimeout(1500);
  if (overlay) await hook(page, [{ name: 'fair:plate', x: 130 * 16, y: 60 * 16 }, { name: 'fair:banner:{f}', x: 133 * 16, y: 60 * 16 - 4, n: 2 }]);
  await frame(page, 133, 62, 3);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `e2e/out/fairs-fair${overlay ? '-overlay' : ''}.png` });
  await page.close();
}

// ---- the Harvest Haul: fall 15, 10am; stalls in a row along the square's west side (a guess at
// where the renderer puts them, to judge the art in place)
{
  const page = await open({});
  await page.evaluate(() => { const g = window.__game; g.time.season = 2; g.time.day = 15; g.time.min = 600; g.player.where = 'world'; g.player.x = 133.5; g.player.y = 67.5; });
  await page.waitForTimeout(1500);
  if (overlay) {
    const items = [];
    const stalls = [[124, 57, 0], [124, 60, 1], [140, 57, 2], [140, 60, 3]];
    for (const [x, y, k] of stalls) items.push({ name: `haul:stall:${k}:{f}`, x: x * 16, y: y * 16, shadow: 26, sx: x * 16 + 16, sy: y * 16 + 14 });
    items.push({ name: 'haul:podium:{f}', x: 132 * 16, y: 61 * 16, shadow: 26, sx: 133 * 16, sy: 61 * 16 + 14 });
    await hook(page, items);
  }
  await frame(page, 133, 61, 3);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `e2e/out/fairs-haul${overlay ? '-overlay' : ''}.png` });
  await page.close();
}

// ---- Tinker's Yard: the first hall (x 60-73, y 25-35) in each season
for (const season of [0, 2, 3]) {
  const page = await open({ farm: 'ruins' });
  await page.evaluate((season) => { const g = window.__game; g.time.season = season; g.time.day = 5; g.time.min = 600; g.player.where = 'world'; g.player.x = 66.5; g.player.y = 37.5; }, season);
  await page.waitForTimeout(1200);
  if (overlay) {
    const items = [];
    const spots = await page.evaluate(() => {
      // open hall floor tiles without an object, spread out, for a look at the wrecks in place
      const g = window.__game, m = g.map, out = [];
      for (const [x, y] of [[62, 27], [66, 28], [70, 27], [63, 31], [67, 32], [71, 31], [65, 34]]) if (!m.obj[m.idx(x, y)]) out.push([x, y]);
      return out;
    });
    spots.forEach(([x, y], i) => items.push({ name: `o:56:${i % 4}:${season}`, x: x * 16, y: y * 16, shadow: 18, sx: x * 16 + 8, sy: y * 16 + 14 }));
    await hook(page, items);
  }
  await frame(page, 66.5, 30.5, 3);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `e2e/out/ruins-hall-${season}${overlay ? '-overlay' : ''}.png` });
  await page.close();
}

console.log('e2e/out/fairs-fair*.png, e2e/out/fairs-haul*.png, e2e/out/ruins-hall-<season>*.png');
console.log(errors.length ? 'console errors:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'no console errors');
await browser.close();
