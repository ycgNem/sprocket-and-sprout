// Quick visual check: start a game directly and capture scenes / scripted scenarios.
// Usage: node e2e/shots.mjs [scene,scene,...]
import { chromium } from 'playwright';
import fs from 'node:fs';

const scenes = (process.argv[2] ?? 'farm,town,beach,quarry,forest,night,winter').split(',');
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const app = window.__app;
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  app.startGame(g, { skin: 22, hair: 49, hairStyle: 'ponytail', shirt: 30, pants: 46, accent: 56 });
});
await page.waitForTimeout(800);
const PLACES = {
  farm: [49.5, 24.5], town: [133.5, 66], beach: [139.5, 128], quarry: [180, 30], forest: [14, 62], lake: [155, 33], mine: [128.5, 16],
  night: [133.5, 64], winter: [49.5, 30], fall: [20, 70], summer: [133.5, 70],
};
const ev = (f, arg) => page.evaluate(f, arg);
const SCRIPTS = {
  npcs: async () => {
    await ev(() => { const g = window.__game; g.player.x = 133.5; g.player.y = 66; g.time.min = 8 * 60; window.__app.loop.speed = 16; });
    await page.waitForTimeout(3500);
    await ev(() => { window.__app.loop.speed = 1; });
  },
  minefloor: async () => { await ev(() => { const g = window.__game; g.sys.mine.enter(g, 12); }); await page.waitForTimeout(900); },
  minedeep: async () => { await ev(() => { const g = window.__game; g.sys.mine.enter(g, 47); }); await page.waitForTimeout(900); },
  minefrost: async () => { await ev(() => { const g = window.__game; g.sys.mine.enter(g, 27); }); await page.waitForTimeout(900); },
  factory: async () => {
    await ev(async () => {
      const g = window.__game;
      if (g.player.where === 'mine') g.sys.mine.leave(g);
      const m = await import('/src/app/demo.ts');
      m.buildDemoFactory(g);
      g.player.x = 66; g.player.y = 36; g.time.min = 14 * 60;
    });
    await page.waitForTimeout(2500);
  },
  research: async () => { await ev(() => window.__play.openWindow('research')); await page.waitForTimeout(400); },
  stats: async () => { await ev(() => window.__play.openWindow('stats')); await page.waitForTimeout(400); },
  journal: async () => { await ev(() => window.__play.openWindow('journal')); await page.waitForTimeout(400); },
  shop: async () => { await ev(() => window.__play.openWindow('shop', 'general')); await page.waitForTimeout(400); },
  map: async () => { await ev(() => window.__play.openWindow('map')); await page.waitForTimeout(400); },
  board: async () => { await ev(() => window.__play.openWindow('restoration')); await page.waitForTimeout(400); },
  dialog: async () => {
    await ev(() => { const g = window.__game; const n = g.sys.npcs.byId.get('marigold'); n.visible = true; n.x = g.player.x + 1; n.y = g.player.y; g.sys.npcs.interact(g, n); });
    await page.waitForTimeout(1200);
  },
};
for (const sc of scenes) {
  if (SCRIPTS[sc]) {
    await ev(() => { if (window.__play.win) window.__play.closeWindow(); });
    await SCRIPTS[sc]();
  } else {
    const pos = PLACES[sc] ?? PLACES.farm;
    await ev(([sc, x, y]) => {
      const g = window.__game;
      if (g.player.where === 'mine') g.sys.mine.leave(g);
      g.player.x = x; g.player.y = y;
      g.time.min = sc === 'night' ? 21.5 * 60 : 11 * 60;
      g.time.season = sc === 'winter' ? 3 : sc === 'fall' ? 2 : sc === 'summer' ? 1 : 0;
      window.__app.renderer.cam.x = x; window.__app.renderer.cam.y = y - 0.6;
    }, [sc, pos[0], pos[1]]);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/scene-${sc}.png` });
  console.log('shot', sc);
}
fs.writeFileSync(`${out}/console-shots.txt`, errors.join('\n'));
console.log('errors:', errors.length);
for (const e of errors.slice(0, 20)) console.log(e);
await browser.close();
