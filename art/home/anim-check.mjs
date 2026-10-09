// Composite check for the farmhouse animation frames: each base sprite is drawn the way the renderer
// draws it (drawSprite at the tile's px, py), then each animation frame at the position the renderer
// should use, one column per frame, x6. Proves the anchors before the renderer switches over.
// Usage: node art/home/anim-check.mjs [out.png]   (BASE=http://localhost:5173/)
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] ?? 'e2e/out/home-anim-check.png';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
const url = await page.evaluate(async () => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((u) => new URL(u).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const K = 6, CW = 40, CH = 56;
  // rows: [base sprite, frame name(i), frame count, draw position of the frame relative to the tile]
  const rows = [
    ['hf:fireplace:0:0', (i) => `hf:fire:${i}`, 6, (px, py) => [px, py]],
    ['hf:clock:0:0', (i) => `hf:pendulum:${i}`, 4, (px, py) => [px, py]],
    ['hf:gclock:0:0', (i) => `hf:gpend:${i}`, 4, (px, py) => [px, py]],
    ['hf:stove:1:0', (i) => `hf:steam:${i}`, 4, (px, py) => [px + 10, py - 2]],
    ['hf:tank:0:0', (i) => `hf:fish:${i % 3}:${i % 2}`, 4, (px, py, i) => [px + 6 + i * 5, py - 9 + (i % 3) * 2]],
  ];
  const c = document.createElement('canvas');
  c.width = 6 * CW * K; c.height = rows.length * CH * K;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2e222f'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(K, K);
  rows.forEach(([b, fn, n, at], r) => {
    for (let i = 0; i < n; i++) {
      const px = i * CW + 4, py = r * CH + 24; // tile origin in the cell
      ctx.fillStyle = '#9e4539'; ctx.fillRect(i * CW + 1, r * CH + 1, CW - 2, CH - 2);
      ctx.fillStyle = '#cd683d'; ctx.fillRect(px, py, 16, 16); // the tile
      A.drawSprite(ctx, A.sprite(b), px, py);
      const [fx, fy] = at(px, py, i);
      A.drawSprite(ctx, A.sprite(fn(i)), fx, fy);
    }
  });
  return c.toDataURL('image/png');
});
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(out);
await browser.close();
