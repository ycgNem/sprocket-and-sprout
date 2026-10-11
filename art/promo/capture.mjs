// The "then and now" pair in What's new, PATCHNOTES.md and the README: the first playable build
// (v0.9, commit 9a72b2a, all its art drawn in code) and today's game at the same moment, a new
// game's first morning at 10am, 1280x720, scaled to 960x540 WebP (smoothed: they are photos of the
// screen, not sprites). Both builds are served from disk through Playwright, so no server runs.
//
// Build the old version outside the repo first (never inside it), with this repo's packages:
//   git worktree add ../sns-v0 9a72b2a
//   cmd /c mklink /J ..\sns-v0\node_modules node_modules
//   cd ../sns-v0 && npx vite build && cd -
// and today's with `npm run build`. Then: node art/promo/capture.mjs
// (afterwards remove the junction before the worktree: `cmd /c rmdir ..\sns-v0\node_modules`,
// then `git worktree remove ../sns-v0`, or the removal empties this repo's node_modules)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '../..');
const shots = [
  { tag: 'v0', dist: path.resolve(root, '../sns-v0/dist'), out: 'then-0.9.webp' },
  { tag: 'v2', dist: path.resolve(root, 'dist'), out: 'now-2.0.webp' },
];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route(`http://${s.tag}.test/**`, (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p === '/') p = '/index.html';
    const f = path.join(s.dist, decodeURIComponent(p));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: mime[path.extname(f)] ?? 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`http://${s.tag}.test/`);
  await page.waitForFunction(() => window.__app?.screen);
  await page.mouse.move(1279, 719);
  await page.waitForTimeout(2000);
  // both versions expose the app and the Game class for the e2e scripts
  await page.evaluate(() => window.__app.startGame(new window.__Game({ seed: 7, name: 'Wren', farmName: 'Cogsbury' }), { skin: 22, hair: 49, hairStyle: 'short', shirt: 30, pants: 46 }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const p = window.__app.screen; p.closeWindow?.(); if (p.g) p.g.time.min = 10 * 60; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__app.screen.closeWindow?.());
  await page.waitForTimeout(500);
  const png = await page.screenshot();
  const webp = await page.evaluate(async (d) => {
    const img = new Image();
    img.src = d;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 540;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, 960, 540);
    return c.toDataURL('image/webp', 0.9);
  }, 'data:image/png;base64,' + png.toString('base64'));
  fs.writeFileSync(path.join(here, s.out), Buffer.from(webp.split(',')[1], 'base64'));
  console.log(s.out, fs.statSync(path.join(here, s.out)).size, 'bytes');
  await ctx.close();
}
await browser.close();
