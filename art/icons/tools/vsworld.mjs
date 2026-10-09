// Icon vs world sprite: each item icon (i:<id>, x4) next to its placed sprite fitted at a whole
// scale into the same box, from the running game. Usage:
//   node art/icons/tools/vsworld.mjs <out.png> <id>[=<world sprite name>] … [--cols 8]
// Default world sprite: st:<id>:0:1:1. BASE=http://localhost:5173/
import { chromium } from 'playwright';
import fs from 'node:fs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const skip = new Set(['--cols'].flatMap((k) => { const i = args.indexOf(k); return i >= 0 ? [i, i + 1] : []; }));
const [out, ...ids] = args.filter((a, i) => !skip.has(i) && !a.startsWith('--'));
const COLS = +opt('--cols', 8);
const pairs = ids.map((s) => { const [id, w] = s.split('='); return [id, w ?? `st:${id}:0:1:1`]; });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
const url = await page.evaluate(async ({ pairs, COLS }) => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const B = 72, cellW = B * 2 + 14, cellH = B + 20;
  const c = document.createElement('canvas');
  c.width = COLS * cellW; c.height = Math.ceil(pairs.length / COLS) * cellH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2e222f'; ctx.fillRect(0, 0, c.width, c.height);
  pairs.forEach(([id, wn], i) => {
    const x = (i % COLS) * cellW, y = Math.floor(i / COLS) * cellH;
    ctx.fillStyle = '#ab947a'; ctx.fillRect(x + 2, y + 16, B, B);
    ctx.fillStyle = '#239063'; ctx.fillRect(x + B + 8, y + 16, B, B);
    const ic = A.sprite('i:' + id);
    ctx.drawImage(ic.img, ic.x, ic.y, 16, 16, x + 2 + (B - 64) / 2, y + 16 + (B - 64) / 2, 64, 64);
    const w = A.sprite(wn);
    const k = Math.max(1, Math.floor(B / Math.max(w.w, w.h)));
    ctx.drawImage(w.img, w.x, w.y, w.w, w.h, x + B + 8 + Math.floor((B - w.w * k) / 2), y + 16 + B - w.h * k, w.w * k, w.h * k);
    ctx.fillStyle = '#fbb954'; ctx.font = '11px monospace'; ctx.fillText(id.slice(0, 22), x + 3, y + 12);
  });
  return c.toDataURL('image/png');
}, { pairs, COLS });
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${out}: ${pairs.length} pairs (icon x4 left, world sprite right)`);
await browser.close();
