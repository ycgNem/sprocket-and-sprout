import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.BASE ?? 'http://127.0.0.1:5173/');
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const { NPCS } = await import('/src/data/npcs.ts');
  const { sprite } = await import('/src/render/atlas.ts');
  window.__app.loop.stop();
  const c = window.__app.canvas, ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#c99a68'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  NPCS.forEach((n, i) => {
    for (let m = 0; m < 4; m++) {
      const s = sprite(`portrait:${n.id}:${m}:${n.age === 'elder' ? 1 : 0}`);
      ctx.drawImage(s.img, s.x, s.y, 32, 32, 10 + (i % 7) * 180 + m * 42, 10 + Math.floor(i / 7) * 120, 64 * 0.62, 64 * 0.62);
    }
    const w = sprite(`ch:${n.id}:2:0`);
    ctx.drawImage(w.img, w.x, w.y, 16, 24, 10 + (i % 7) * 180 + 40, 60 + Math.floor(i / 7) * 120, 32, 48);
  });
});
await page.screenshot({ path: 'e2e/out/qa/portraits.png' });
await browser.close();
