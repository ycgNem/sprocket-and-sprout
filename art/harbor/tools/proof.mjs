// In-game proof for the harbor sheet: reads every harbor: frame back from the game's atlas (size,
// origin, drawn through drawSprite on sand / sea / planks) and screenshots the beach pier with the
// warehouse derelict and restored, the Copper Gull moored, coming in from the east and leaving.
//
// Usage (repo root, dev server running; BASE defaults to http://127.0.0.1:5173/):
//   node art/harbor/tools/proof.mjs          -> e2e/out/harbor/game-*.png, atlas-frames.png
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/harbor';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen?.demo, null, { timeout: 60000 });
await page.evaluate(async () => {
  const app = window.__app;
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
  const p = '/src/render/atlas.ts';
  const A = await import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  await A.artReady();
  window.__A = A;
});
await page.waitForTimeout(800);

// 1. every frame from the atlas
const NAMES = [
  'harbor:warehouse:0', 'harbor:warehouse:1', 'harbor:warehouse:0:winter', 'harbor:warehouse:1:winter',
  ...[0, 1, 2, 3].map((f) => `harbor:ship:${f}`),
  ...[0, 1, 2, 3].map((f) => `harbor:ship:sail:${f}`),
  ...[0, 1, 2, 3].map((f) => `harbor:ship:sail:west:${f}`),
  ...[0, 1, 2, 3].map((f) => `harbor:cargo:${f}`),
];
const atlas = await page.evaluate(async (names) => {
  const A = window.__A;
  const info = names.map((n) => {
    const has = A.hasImage(n);
    const s = has ? A.sprite(n) : null;
    return { n, has, w: s?.w, h: s?.h, ox: s?.ox, oy: s?.oy };
  });
  // draw each at 2x with drawSprite at its footprint's top-left; a red box marks the footprint
  const K = 2, pad = 24, colW = 170 * K;
  const cv = document.createElement('canvas');
  cv.width = colW * 4 + pad; cv.height = 6 * 120 * K;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#c7dcd0'; ctx.fillRect(0, 0, cv.width, cv.height);
  let y = pad, col = 0, rowH = 0;
  for (const { n, has } of info) {
    if (!has) continue;
    const s = A.sprite(n);
    const fw = n.includes('warehouse') ? 64 : n.includes('cargo') ? 32 : 160, fh = n.includes('warehouse') ? 48 : n.includes('cargo') ? 32 : 64;
    const x = pad + col * colW + s.ox * K, top = y + s.oy * K;
    ctx.fillStyle = n.includes('ship') ? '#4d9be6' : n.includes('cargo') ? '#9e4539' : '#fbb954';
    ctx.fillRect(x - s.ox * K, top - s.oy * K, s.w * K, s.h * K);
    A.drawSprite(ctx, s, x, top, K);
    ctx.strokeStyle = '#e83b3b'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, top + 0.5, fw * K - 1, fh * K - 1);
    ctx.fillStyle = '#2e222f'; ctx.font = '12px monospace'; ctx.fillText(n, x - s.ox * K, top - s.oy * K - 4);
    rowH = Math.max(rowH, s.h * K + 20);
    if (++col === 4) { col = 0; y += rowH; rowH = 0; }
  }
  return { info, png: cv.toDataURL('image/png') };
}, NAMES);
fs.writeFileSync(`${out}/atlas-frames.png`, Buffer.from(atlas.png.split(',')[1], 'base64'));
for (const i of atlas.info) console.log(`${i.has ? 'ok ' : 'MISSING'} ${i.n} ${i.w}x${i.h} origin (${i.ox},${i.oy})`);

// 2. the pier in the game (camera pinned, this page only)
const shot = async (name, setup) => {
  await page.evaluate(setup);
  await page.mouse.move(1279, 719);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${out}/${name}.png`);
};
const at = ({ open, ship, min, cx, cy, zoom = 3, season = 1 }) => `(() => {
  const app = window.__app, G = window.__game;
  G.time.season = ${season}; G.time.min = ${min}; G.weather = 'sun';
  ${open ? "G.flags.add('harbor');" : "G.flags.delete('harbor');"}
  G.sys.exports = { ship: 'away', next: G.dayIndex + 99, docked: -1, sailed: -1, port: '', opened: true, voyages: 1, full: 0, earned: 0, shipped: {}, log: [], rank: 0 };
  const s = G.sys.exports;
  if (${JSON.stringify(ship)} === 'moored') { s.ship = 'port'; s.docked = G.dayIndex - 1; }
  if (${JSON.stringify(ship)} === 'arriving') { s.ship = 'port'; s.docked = G.dayIndex; }
  if (${JSON.stringify(ship)} === 'leaving') { s.ship = 'away'; s.sailed = G.dayIndex; }
  G.player.where = 'world'; G.player.x = 139.5; G.player.y = 131.5; G.player.dir = 2;
  const r = app.renderer;
  r.cam.follow = function () { this.zoom = this.targetZoom; };
  r.cam.zoom = r.cam.targetZoom = ${zoom}; r.cam.x = ${cx}; r.cam.y = ${cy};
  r.invalidateAll();
})()`;
await shot('game-derelict', at({ open: false, ship: null, min: 12 * 60, cx: 143, cy: 130 }));
await shot('game-restored', at({ open: true, ship: null, min: 12 * 60, cx: 143, cy: 130 }));
await shot('game-moored', at({ open: true, ship: 'moored', min: 12 * 60, cx: 146, cy: 134.5 }));
await shot('game-wide', at({ open: true, ship: 'moored', min: 15 * 60, cx: 146, cy: 132, zoom: 2 }));
await shot('game-winter', at({ open: true, ship: 'moored', min: 12 * 60, cx: 146, cy: 132, zoom: 2, season: 3 }));
await shot('game-winter-derelict', at({ open: false, ship: null, min: 12 * 60, cx: 143, cy: 130, season: 3 }));
// coming in from the east: 6:00 + 100 min of the 120-min passage
const mapW = await page.evaluate(() => window.__game.map.w);
const arriveX = 141 + (mapW - 141 + 2) * (1 - 100 / 120);
await shot('game-arriving', at({ open: true, ship: 'arriving', min: 360 + 100, cx: arriveX + 5, cy: 134.5 }));
const leaveX = 141 + (mapW - 141 + 2) * (15 / 120);
await shot('game-leaving', at({ open: true, ship: 'leaving', min: 360 + 15, cx: leaveX + 5, cy: 134.5 }));
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
await browser.close();
