// In-game field check for the crop sheet: tills a block next to the farmhouse and plants one row per
// crop, columns = every growth stage, then ripe, then withered; a 3x3 ripe block per crop at the end
// shows how a dense field reads. Screenshot of the running game (dev server).
//
// Usage: node art/crops/field.mjs <out.png> <crop,crop,…> [--old] [--zoom 3] [--block]
//   --old    the procedural 1.0 crops (?art=old) for the before shot
//   --block  3x3 blocks of ripe crops; --giant the same blocks grown into giant crops
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [out = 'e2e/out/crops-field.png', list = 'radish,potato,cabbage,tomato,corn,pumpkin'] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--zoom');
const old = args.includes('--old'), zoom = +opt('--zoom', 3), block = args.includes('--block') || args.includes('--giant'), giant = args.includes('--giant');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto((process.env.BASE ?? 'http://localhost:5173/') + (old ? '?art=old' : ''));
await page.waitForFunction(() => window.__app?.screen);
await page.evaluate(() => {
  const app = window.__app;
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
});
await page.waitForTimeout(500);
const res = await page.evaluate(async ({ ids, zoom, block, giant }) => {
  const F = await import('/src/sim/systems/farming.ts');
  const { CROP_BY_ID } = await import('/src/data/crops.ts');
  const A = await import('/src/render/atlas.ts');
  await A.artReady();
  const app = window.__app, g = app.screen.g;
  const crops = ids.map((id) => CROP_BY_ID.get(id)).filter(Boolean);
  const W = block ? 3 * Math.min(crops.length, 3) + Math.min(crops.length, 3) - 1 : Math.max(...crops.map((c) => c.stages.length)) + 2;
  const H = block ? 3 * Math.ceil(crops.length / 3) + Math.ceil(crops.length / 3) - 1 : crops.length * 2 - 1;
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  // clear rocks, logs and trees on the farm so a big enough block exists
  const { O, Z } = await import('/src/sim/world/tilemap.ts');
  for (let y = py - 25; y < py + 25; y++) for (let x = px - 30; x < px + 30; x++) {
    if (!g.map.inb(x, y)) continue;
    const i = g.map.idx(x, y);
    if (g.map.zone[i] === Z.FARM && g.map.obj[i] !== O.NONE && !g.map.buildingAt[i]) g.map.setO(x, y, O.NONE);
  }
  // nearest block where every tile can be tilled
  let best = null;
  for (let r = 0; r < 40 && !best; r++)
    for (let dy = -r; dy <= r && !best; dy++)
      for (let dx = -r; dx <= r && !best; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x0 = px + dx, y0 = py + dy;
        let ok = true;
        for (let y = y0; y < y0 + H && ok; y++) for (let x = x0; x < x0 + W && ok; x++) ok = F.canTill(g, x, y);
        if (ok) best = [x0, y0];
      }
  if (!best) return { error: 'no tillable block' };
  const [x0, y0] = best, m = g.map;
  const plant = (x, y, id, stage, ready, dead) => {
    F.till(g, x, y);
    const s = g.soil.get(m.idx(x, y));
    s.water = (x + y) % 3 !== 0;
    s.crop = { id, days: 0, stage, ready, harvests: 0, dead, giant: -1, frac: 0 };
  };
  if (block) {
    crops.forEach((c, k) => {
      const bx = x0 + (k % 3) * 4, by = y0 + Math.floor(k / 3) * 4;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) plant(bx + x, by + y, c.id, c.stages.length, true, false);
      if (giant) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.soil.get(m.idx(bx + x, by + y)).crop.giant = m.idx(bx, by);
    });
  } else {
    crops.forEach((c, row) => {
      const N = c.stages.length;
      for (let s = 0; s < N; s++) plant(x0 + s, y0 + row * 2, c.id, s, false, false);
      plant(x0 + N, y0 + row * 2, c.id, N, true, false);
      plant(x0 + N + 1, y0 + row * 2, c.id, N - 1, false, true);
    });
  }
  // stand left of the field; the camera follows the player
  g.player.x = x0 - 1.5; g.player.y = y0 + H / 2;
  g.player.dir = 1;
  app.renderer.invalidateAll?.();
  app.renderer.cam.targetZoom = zoom; app.renderer.cam.zoom = zoom;
  // pin the camera on the field (the HUD covers the screen edges)
  const cam = app.renderer.cam, follow = cam.follow.bind(cam);
  cam.follow = (tx, ty, dt) => follow(x0 + W / 2, y0 + H / 2 - 0.5, dt, true);
  return { x0, y0, W, H };
}, { ids: list.split(','), zoom, block, giant });
console.log(JSON.stringify(res));
await page.waitForTimeout(800);
const r = await page.evaluate(({ x0, y0, W, H }) => {
  const R = window.__app.renderer, a = R.tileToScreen(x0 - 0.5, y0 - 1.5), b = R.tileToScreen(x0 + W + 0.5, y0 + H + 0.5);
  const dpr = window.devicePixelRatio || 1, c = window.__app.canvas.getBoundingClientRect(), k = c.width / R.W;
  return { x: Math.max(0, c.left + a.x * k), y: Math.max(0, c.top + a.y * k), w: (b.x - a.x) * k, h: (b.y - a.y) * k };
}, res);
await page.screenshot({ path: out });
await page.screenshot({ path: out.replace(/.png$/, '-zoom.png'), clip: { x: r.x, y: r.y, width: Math.min(r.w, 1280 - r.x), height: Math.min(r.h, 720 - r.y) } });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors', '->', out);
await browser.close();
