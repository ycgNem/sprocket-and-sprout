// Save procedural 1.0 sprites from the running game as PNGs (img2img seeds and references).
// Usage: node art/home/grab-old.mjs <outdir> <sprite name> …   (BASE=http://localhost:5173/)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [dir, ...names] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
for (const n of names) {
  const url = await page.evaluate(async (n) => {
    // the page's own module instance (a bare import would create a second, empty atlas after hot updates)
    const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((u) => new URL(u).pathname === p) ?? p);
    const A = await mod('/src/render/atlas.ts');
    await A.artReady();
    const s = A.sprite(n + ':old');
    const c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    c.getContext('2d').drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    return c.toDataURL('image/png');
  }, n);
  fs.writeFileSync(path.join(dir, n.replace(/:/g, '_') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('saved', n);
}
await browser.close();
