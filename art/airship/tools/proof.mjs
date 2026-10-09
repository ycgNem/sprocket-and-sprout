// In-game proof for the Brass Vixen: screenshots of Skyhook Field from the running game (dev server)
// with the imported sheet, in summer day / night, fall and winter, plus the procedural fallback
// (?art=old) for comparison, and a frame strip read back from the atlas.
//
// Usage (repo root, dev server on http://localhost:5173/):
//   node art/airship/tools/proof.mjs          -> e2e/out/airship/game-*.png
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/airship';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });

async function session(url, shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.screen?.demo);
  await page.evaluate(async () => {
    const app = window.__app;
    const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
    app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
    const p = '/src/render/atlas.ts';
    const A = await import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
    await A.artReady();
  });
  await page.waitForTimeout(800);
  for (const [name, setup] of shots) {
    await page.evaluate(setup);
    await page.mouse.move(1279, 719);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(`${out}/${name}.png`);
  }
  if (errors.length) console.log('console errors:\n' + errors.join('\n'));
  return page;
}

// the player stands on the path below the gangplank; the camera is pinned on the ship (the play
// screen's follow is switched off for the shot, in this page only)
const at = (season, min, zoom = 3) => `(() => {
  const app = window.__app, G = window.__game;
  G.time.season = ${season}; G.time.min = ${min}; G.weather = 'sun';
  G.player.where = 'world'; G.player.x = 179.5; G.player.y = 61.9; G.player.dir = 2;
  const r = app.renderer;
  r.cam.follow = function () { this.zoom = this.targetZoom; };
  r.cam.zoom = r.cam.targetZoom = ${zoom}; r.cam.x = 179; r.cam.y = ${zoom >= 3 ? 57 : 58};
  r.invalidateAll();
})()`;

const page = await session(base, [
  ['game-summer-day', at(1, 12 * 60)],
  ['game-summer-night', at(1, 22 * 60)],
  ['game-fall-day', at(2, 12 * 60)],
  ['game-winter-day', at(3, 12 * 60)],
  ['game-wide', at(1, 15 * 60, 2)],
]);
// the four frames as the atlas cuts them (bld:airship:1:0:f and :1:1:f), x3
const url = await page.evaluate(async () => {
  // the module instance the app loaded (Vite may serve it with a ?t= suffix), as e2e/sprites.mjs does
  const p = '/src/render/atlas.ts';
  const A = await import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  await A.artReady();
  const K = 3, c = document.createElement('canvas');
  const s0 = A.sprite('bld:airship:1:0:0');
  c.width = 4 * (s0.w + 4) * K; c.height = 2 * (s0.h + 4) * K;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#239063'; ctx.fillRect(0, 0, c.width, c.height);
  for (let n = 0; n < 2; n++) for (let f = 0; f < 4; f++) {
    const s = A.sprite(`bld:airship:1:${n}:${f}`);
    ctx.drawImage(s.img, s.x, s.y, s.w, s.h, f * (s0.w + 4) * K, n * (s0.h + 4) * K, s.w * K, s.h * K);
  }
  return c.toDataURL('image/png');
});
fs.writeFileSync(`${out}/game-atlas-frames.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${out}/game-atlas-frames.png`);
await session(base + '?art=old', [['game-old-summer-day', at(1, 12 * 60)]]);
await browser.close();
