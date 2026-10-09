// Art overhaul comparison shots: the procedural 1.0 player next to the imported sheets, in the
// running game. Writes e2e/out/art-compare/:
//   lineup.png  every character sheet side by side (1.0, player sheet, candidates), standing in
//               4 directions, walking and swinging the hoe, labeled
//   new.png     the farm with the imported art      old.png  the same scene with ?art=old
// Usage: node e2e/artcompare.mjs   (BASE=http://localhost:5173/ by default)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { decodePNG, encodePNG, upscale } from '../scripts/lib/png.mjs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/art-compare';
fs.mkdirSync(out, { recursive: true });

// candidate sheets in the order the game registers them (import.meta.glob sorts by path)
const sheets = fs.readdirSync('src/art').filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync('src/art/' + f, 'utf8')));
const player = sheets.find((m) => m.ids?.includes('player'));
const cands = sheets.filter((m) => m.kind === 'character' && !m.ids?.includes('player'));
const short = (m) => (m.source ?? m.name).replace(/^PixelLab create_character /, '').split(/[(;]/)[0].trim();
const labels = ['1.0 (old)', player?.label ?? 'player', ...cands.map((m) => m.label ?? m.name)];
const legend = [player, ...cands].filter(Boolean).map((m) => `${m.label ?? m.name}: ${short(m)}`).join('  ·  ');

const LOOK = { skin: 22, hair: 24, hairStyle: 'short', shirt: 25, pants: 46, accent: 56 }; // the new-game default
const TIPS = ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_stray', 'tip_depot', 'tip_furniture', 'tip_perkhint', 'tip_quickstack', 'tip_bots'];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const errors = [];

async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.screen?.demo);
  await page.evaluate(({ LOOK, TIPS }) => {
    const g = new window.__Game({ seed: 999, name: 'Robin', farmName: 'Willowbrook' });
    window.__app.startGame(g, LOOK);
    for (const t of TIPS) g.flags.add(t);
  }, { LOOK, TIPS });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__game, p = g.player;
    window.__play.closeWindow();
    g.time.season = 1; g.weather = 'sun'; g.time.min = 10 * 60;
    p.x = 54; p.y = 31; p.dir = 2; p.sel = 0; // slot 0 holds the hoe
    window.__app.renderer.invalidateAll();
  });
  await page.mouse.move(1279, 719);
  await page.waitForTimeout(900);
  await page.evaluate(() => (window.__app.loop.speed = 0)); // freeze the sim; poses are set by hand
  return page;
}

// ---- full-screen shots, same scene ----
for (const [name, url] of [['new', base], ['old', base + (base.includes('?') ? '&' : '?') + 'art=old']]) {
  const page = await open(url);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}

// ---- lineup ----
const page = await open(base);
await page.evaluate(() => (window.__app.renderer.compareArt = true));
const n = cands.length;
const poses = [
  ['standing, down', { dir: 2 }], ['standing, right', { dir: 1 }], ['standing, up', { dir: 0 }], ['standing, left', { dir: 3 }],
  ['walking, down', { dir: 2, walk: 1 }], ['walking, right', { dir: 1, walk: 3 }],
  ['hoe raised, down', { dir: 2, hoe: 0.1 }], ['hoe strike, right', { dir: 1, hoe: 0.8 }],
];
const strips = [];
for (const [label, pose] of poses) {
  const clip = await page.evaluate(({ pose, n, labels, label }) => {
    const p = window.__game.player, r = window.__app.renderer, dpr = window.__app.dpr;
    p.dir = pose.dir;
    p.moving = !!pose.walk;
    p.walkT = pose.walk ? (pose.walk + 0.3) / 1.6 : 0;
    p.anim = pose.hoe !== undefined ? { kind: 'hoe', t: pose.hoe * 0.32, dur: 0.32, tx: Math.floor(p.x), ty: Math.floor(p.y) + 1 } : null;
    const a = r.tileToScreen(p.x - 2.4, p.y - 2.5), b = r.tileToScreen(p.x + 1.5 * n + 0.9, p.y + 0.5);
    const clip = { x: Math.round(a.x / dpr), y: Math.round(a.y / dpr), width: Math.round((b.x - a.x) / dpr), height: Math.round((b.y - a.y) / dpr) };
    // labels: the pose at the top left, each character's name under its feet
    document.getElementById('__cmp')?.remove();
    const root = document.createElement('div');
    root.id = '__cmp';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99;font:600 12px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000';
    const put = (text, x, y, center) => { const d = document.createElement('div'); d.textContent = text; d.style.cssText = `position:absolute;left:${x}px;top:${y}px;white-space:nowrap;${center ? 'transform:translateX(-50%)' : ''}`; root.appendChild(d); };
    put(label, clip.x + 6, clip.y + 4, false);
    const xs = [p.x - 1.5, p.x, ...Array.from({ length: n }, (_, i) => p.x + 1.5 * (i + 1))];
    xs.forEach((x, i) => { const s = r.tileToScreen(x, p.y + 0.05); put(labels[i], s.x / dpr, s.y / dpr, true); });
    document.body.appendChild(root);
    return clip;
  }, { pose, n, labels, label });
  await page.waitForTimeout(150);
  strips.push(decodePNG(await page.screenshot({ clip })));
}
// stack the strips into one image
const W = Math.max(...strips.map((s) => s.w)), H = strips.reduce((h, s) => h + s.h + 2, 0);
const img = new Uint8Array(W * H * 4).fill(255);
let y0 = 0;
for (const s of strips) {
  for (let y = 0; y < s.h; y++) img.set(s.data.subarray(y * s.w * 4, (y + 1) * s.w * 4), ((y0 + y) * W) * 4);
  y0 += s.h + 2;
}
// x3 with square pixels, so the sprites can be judged without zooming
const big = upscale({ w: W, h: H, data: img }, 3);
fs.writeFileSync(`${out}/lineup.png`, encodePNG(big.w, big.h, big.data));
fs.writeFileSync(`${out}/lineup.txt`, legend + '\n');
await browser.close();
console.log(`wrote ${out}/new.png, old.png, lineup.png (${strips.length} poses x ${labels.length} characters)\n${legend}`);
if (errors.length) console.log('console errors:\n  ' + errors.join('\n  '));
