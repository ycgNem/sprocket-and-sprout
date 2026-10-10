// Performance check: build the debug perf scene (1000+ belts, 200+ machines) and measure.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 77, name: 'Perf', farmName: 'Perf' });
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'short', shirt: 30, pants: 46 });
});
await page.waitForTimeout(500);
const res = await page.evaluate(async () => {
  const m = await import('/src/app/perf.ts');
  const r = m.buildPerfFactory(window.__game, 24, 50, 10);
  // more machines: kegs fed by arms already; add furnaces counted in result
  return { ...r, ents: window.__game.ents.map.size };
});
console.log('scene', res);
// measure sim tick cost directly
const sim = await page.evaluate(() => {
  const g = window.__game;
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) g.tick();
  const t1 = performance.now();
  let items = 0;
  for (const e of g.ents.belts) items += e.belt.lanes[0].k.length + e.belt.lanes[1].k.length;
  return { msPerTick: (t1 - t0) / 600, items };
});
console.log('sim', sim);
// the night shift (ROADMAP.md 4.14): 4 game hours of the works in coarse steps; budget 3 s
const night = await page.evaluate(async () => {
  const g = window.__game;
  const { NIGHT_SECS } = await import('/src/sim/Game.ts');
  const t0 = performance.now();
  g.runWorks(NIGHT_SECS);
  return { nightShiftMs: Math.round(performance.now() - t0) };
});
console.log('night', night, night.nightShiftMs <= 3000 ? 'within the 3 s budget' : 'OVER the 3 s budget');
if (night.nightShiftMs > 3000 || sim.msPerTick > 1) process.exitCode = 1;
// measure frames for 5 seconds with the camera over the factory
await page.evaluate(() => { const g = window.__game; g.player.x = 58; g.player.y = 66; window.__app.renderer.cam.targetZoom = 2; });
await page.waitForTimeout(1500);
const fps = await page.evaluate(() => new Promise((resolve) => {
  const L = window.__app.loop;
  const samples = [];
  let n = 0;
  let last = performance.now();
  const f = () => {
    const now = performance.now();
    samples.push(now - last);
    last = now;
    if (++n < 300) requestAnimationFrame(f);
    else {
      samples.sort((a, b) => a - b);
      resolve({ avgFrameMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95: samples[Math.floor(samples.length * 0.95)], tickMs: L.tickMs, drawMs: L.frameMs, drawables: window.__app.renderer.drawCount });
    }
  };
  requestAnimationFrame(f);
}));
console.log('frames', fps);
await page.screenshot({ path: 'e2e/out/perf.png' });
fs.writeFileSync('e2e/out/perf.json', JSON.stringify({ res, sim, fps }, null, 1));
console.log('errors', errors);
await browser.close();
