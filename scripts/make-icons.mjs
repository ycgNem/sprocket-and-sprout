// Renders the app icon (a brass cog with a sprout) at several sizes into public/ and build/.
// Usage: node scripts/make-icons.mjs   (needs Playwright + Chrome, like the e2e scripts)
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const sizes = [[192, 'public/icon-192.png'], [512, 'public/icon-512.png'], [512, 'public/icon-maskable-512.png', true], [256, 'build/icon.png'], [180, 'public/apple-touch-icon.png'], [32, 'public/favicon-32.png']];
for (const [size, file, maskable] of sizes) {
  const url = await page.evaluate(([size, maskable]) => {
    const N = 32; // design grid
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const P = { ink: '#1a1220', plum: '#3b2a3a', brass: '#d9a440', amber: '#f4b860', butter: '#fbe5a0', copper: '#a8582e', leaf: '#8cbf4e', grass: '#5d8a3c', moss: '#3e5a34', sky: '#4a90a8', aqua: '#86c6c9' };
    const s = size / N;
    const px = (gx, gy, col) => { x.fillStyle = col; x.fillRect(Math.floor(gx * s), Math.floor(gy * s), Math.ceil(s), Math.ceil(s)); };
    // background: rounded plum tile (full bleed when maskable)
    x.fillStyle = P.plum;
    if (maskable) x.fillRect(0, 0, size, size);
    else { const r = size * 0.18; x.beginPath(); x.roundRect(0, 0, size, size, r); x.fill(); }
    const pad = maskable ? 4 : 0; // keep the art inside the maskable safe zone
    const scale = (N - pad * 2) / N;
    const g = (v) => pad + v * scale;
    const disc = (cx, cy, r, col) => { for (let yy = -r; yy <= r; yy += 0.5) for (let xx = -r; xx <= r; xx += 0.5) if (xx * xx + yy * yy <= r * r) px(g(cx + xx), g(cy + yy), col); };
    // gear teeth
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; disc(16 + Math.cos(a) * 11, 17 + Math.sin(a) * 11, 2.6, P.ink); }
    disc(16, 17, 11, P.ink);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; disc(16 + Math.cos(a) * 11, 17 + Math.sin(a) * 11, 1.8, P.brass); }
    disc(16, 17, 10, P.copper);
    disc(15.5, 16.5, 9, P.brass);
    disc(14, 14.5, 3, P.amber);
    disc(16, 17, 5, P.ink);
    disc(16, 17, 4, P.moss);
    // sprout
    for (let yy = 9; yy <= 19; yy++) px(g(15.5), g(yy), P.grass);
    disc(12.5, 10, 3, P.leaf); disc(19, 8.5, 3.3, P.leaf);
    disc(12, 9.5, 1.2, P.butter);
    return c.toDataURL('image/png');
  }, [size, !!maskable]);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', file);
}
await browser.close();
