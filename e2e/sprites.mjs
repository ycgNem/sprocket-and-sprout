// Sprite gallery from the running game: each sprite name drawn with the imported art (new) next to
// its procedural 1.0 version (`name:old`), at x4 on a grass-colored backdrop, labeled. Use it to
// check imported sheets against what they replace without setting up a game state.
//
// Usage: node e2e/sprites.mjs <name> [name …] [--out e2e/out/sprites.png] [--scale 4] [--cols 6] [--bg #239063]
//        names can come from a file: --list names.txt (one per line)
// BASE=http://localhost:5173/ by default.
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const skip = new Set(['--out', '--scale', '--cols', '--bg', '--list'].flatMap((k) => { const i = args.indexOf(k); return i >= 0 ? [i, i + 1] : []; }));
let names = args.filter((a, i) => !skip.has(i) && !a.startsWith('--'));
if (opt('--list')) names = names.concat(fs.readFileSync(opt('--list'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
const out = opt('--out', 'e2e/out/sprites.png'), K = +opt('--scale', 4), COLS = +opt('--cols', 6), BG = opt('--bg', '#239063');
if (!names.length) { console.error('usage: node e2e/sprites.mjs <sprite name> … [--out file.png]'); process.exit(2); }

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
const url = await page.evaluate(async ({ names, K, COLS, BG }) => {
  // the module instance the app loaded (after hot updates Vite serves it as ?t=… URLs)
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const pairs = names.map((n) => [A.sprite(n), A.sprite(n + ':old')]);
  const cw = Math.max(...pairs.flat().map((s) => s.w)) * K, ch = Math.max(...pairs.flat().map((s) => s.h)) * K;
  const cellW = cw * 2 + 12, cellH = ch + 22;
  const c = document.createElement('canvas');
  c.width = COLS * cellW;
  c.height = Math.ceil(names.length / COLS) * cellH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2e222f';
  ctx.fillRect(0, 0, c.width, c.height);
  pairs.forEach(([nw, old], i) => {
    const x = (i % COLS) * cellW, y = Math.floor(i / COLS) * cellH;
    ctx.fillStyle = BG;
    ctx.fillRect(x + 2, y + 18, cw, ch);
    ctx.fillRect(x + cw + 8, y + 18, cw, ch);
    for (const [s, ox] of [[nw, x + 2], [old, x + cw + 8]]) ctx.drawImage(s.img, s.x, s.y, s.w, s.h, ox, y + 18 + ch - s.h * K, s.w * K, s.h * K);
    ctx.fillStyle = '#fbb954';
    ctx.font = '11px monospace';
    ctx.fillText(names[i].slice(0, Math.floor(cellW / 6.6)), x + 3, y + 12);
  });
  return c.toDataURL('image/png');
}, { names, K, COLS, BG });
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${out}: ${names.length} sprites (left: imported, right: procedural 1.0)`);
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
await browser.close();
