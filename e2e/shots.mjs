// Quick visual check: start a game directly and capture scenes.
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
  app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
});
await page.waitForTimeout(800);
const PLACES = {
  farm: [49.5, 24.5], town: [133.5, 66], beach: [139.5, 128], quarry: [180, 30], forest: [14, 62], lake: [155, 33], mine: [128.5, 16],
  night: [133.5, 64], winter: [49.5, 30], fall: [20, 70], summer: [133.5, 70],
};
for (const sc of scenes) {
  const pos = PLACES[sc] ?? PLACES.farm;
  await page.evaluate(([sc, x, y]) => {
    const g = window.__game;
    g.player.x = x; g.player.y = y;
    g.time.min = sc === 'night' ? 21.5 * 60 : 11 * 60;
    if (sc === 'winter') g.time.season = 3;
    else if (sc === 'fall') g.time.season = 2;
    else if (sc === 'summer') g.time.season = 1;
    else g.time.season = 0;
    window.__app.renderer.cam.x = x; window.__app.renderer.cam.y = y - 0.6;
  }, [sc, pos[0], pos[1]]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/scene-${sc}.png` });
  console.log('shot', sc);
}
fs.writeFileSync(`${out}/console-shots.txt`, errors.join('\n'));
console.log('errors:', errors.length);
for (const e of errors.slice(0, 20)) console.log(e);
await browser.close();
