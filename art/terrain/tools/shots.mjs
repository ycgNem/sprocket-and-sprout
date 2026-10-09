// In-game terrain screenshots: farm in four seasons, beach, town, a mine floor, the farmhouse, and the
// farm with ?art=old for comparison. Needs the dev server (http://localhost:5173/).
// Usage: node art/terrain/tools/shots.mjs [out dir = e2e/out/terrain/game] [name …]
import fs from 'node:fs';
import { chromium } from 'playwright';

const [outDir = 'e2e/out/terrain/game', ...only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__app?.screen?.demo);
  await page.evaluate(async () => {
    window.__house = await import('/src/sim/systems/house.ts');
    window.__mine = await import('/src/sim/systems/mine.ts');
    const app = window.__app;
    const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
    app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
  });
  await page.waitForTimeout(800);
  // hide the HUD so the ground shows
  await page.evaluate(() => { const g = window.__game; for (const f of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_stray', 'tip_depot', 'tip_furniture', 'tip_perkhint', 'tip_quickstack', 'tip_bots']) g.flags.add(f); });
  return page;
}

const SCENES = {
  'farm-spring': `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60; g.player.x = 54; g.player.y = 31;`,
  'farm-summer': `g.time.season = 1; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60; g.player.x = 54; g.player.y = 31;`,
  'farm-fall': `g.time.season = 2; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60; g.player.x = 54; g.player.y = 31;`,
  'farm-winter': `g.time.season = 3; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60; g.player.x = 54; g.player.y = 31;`,
  'farm-plot': `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60; g.player.x = 44; g.player.y = 36;
    const sys = g.sys.farming ?? null;
    for (let y = 34; y < 40; y++) for (let x = 40; x < 48; x++) { const m = g.map; const i = m.idx(x, y); g.soil.set(i, { water: x >= 44, fert: null, crop: null, idle: 3 }); }`,
  // a 6x4 tilled plot (left half dry, right half watered) on the nearest dirt patch and on grass
  'plot-dirt': `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 10 * 60;
    const m = g.map, W = 6, H = 4;
    const all = (x0, y0, t) => { for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) if (m.g(x, y) !== t || m.obj[m.idx(x, y)]) return false; return true; };
    const find = (t) => { for (let r = 0; r < 30; r++) for (let y = 31 - r; y <= 31 + r; y++) for (let x = 54 - r; x <= 54 + r; x++) if (all(x, y, t)) return [x, y]; return null; };
    const d = find(2), gr = find(1);
    for (const p of [d, gr]) if (p) for (let y = p[1]; y < p[1] + H; y++) for (let x = p[0]; x < p[0] + W; x++) g.soil.set(m.idx(x, y), { water: x >= p[0] + 3, fert: null, crop: null, idle: 3 });
    g.player.x = d ? d[0] + 3 : 54; g.player.y = d ? d[1] + 5 : 31; window.__plots = [d, gr];`,
  beach: `g.time.season = 1; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 11 * 60; g.player.x = 128; g.player.y = 126;`,
  town: `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 11 * 60; g.player.x = 133; g.player.y = 64;`,
  river: `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 11 * 60; g.player.x = 90; g.player.y = 40;`,
  cliffs: `g.time.season = 0; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 11 * 60; g.player.x = 60; g.player.y = 14;`,
  mine: `g.time.min = 11 * 60; window.__mine.enterFloor(g, 3);`,
  'mine-mid': `g.time.min = 11 * 60; window.__mine.enterFloor(g, 25);`,
  'mine-deep': `g.time.min = 11 * 60; window.__mine.enterFloor(g, 45);`,
  house: `g.weather = 'sun'; g.time.min = 12 * 60; window.__house.enterHouse(g);`,
};

const names = only.length ? only : [...Object.keys(SCENES), 'farm-old'];
const page = await open(base);
for (const n of names) {
  if (n === 'farm-old') continue;
  await page.evaluate(`(() => { const g = window.__game; ${SCENES[n]} window.__app.renderer.invalidateAll(); })()`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/${n}.png` });
  console.log(`${outDir}/${n}.png`);
}
if (names.includes('farm-old')) {
  const p2 = await open(base + '?art=old');
  await p2.evaluate(`(() => { const g = window.__game; ${SCENES['farm-spring']} window.__app.renderer.invalidateAll(); })()`);
  await p2.waitForTimeout(900);
  await p2.screenshot({ path: `${outDir}/farm-old.png` });
  console.log(`${outDir}/farm-old.png`);
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'no console errors');
await browser.close();
