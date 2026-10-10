// In-game shots for the flagstone path and the plank decks (ROADMAP 1.2 bugs 3 and 11): the town square,
// the river bridges, the lake dock, the pier, a flagstone path and a Plank Walk laid on the farm, in
// spring and winter, plus the same places with ?art=old. Needs the dev server (http://localhost:5173/).
//
// --hook: until renderer.ts calls src/render/planks.ts, this serves the page a renderer.ts with the two
// proposed hook lines added (the request is rewritten in the browser only; no file changes), so the
// plank set can be judged in the game before it is wired.
// --before: serve the committed terrain sheet (git HEAD) instead of the working copy (the 'before' shots).
// Usage: node art/terrain/tools/path-shots.mjs [--hook] [--before] [--old] [out dir = e2e/out/terrain/game] [scene …]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const hook = args.includes('--hook'), withOld = args.includes('--old'), before = args.includes('--before');
const headPng = before ? execSync('git show HEAD:src/art/terrain.png', { maxBuffer: 1 << 26 }) : null;
const headJson = before ? execSync('git show HEAD:src/art/terrain.json', { maxBuffer: 1 << 26 }).toString() : null;
const [outDir = 'e2e/out/terrain/game', ...only] = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  if (hook)
    await page.route(/\/src\/render\/renderer\.ts(\?.*)?$/, async (route) => {
      const res = await route.fetch();
      let src = await res.text();
      const a = 'wang[(ly + 1) * N + lx + 1] = wangOf(k);', b = 'const h = hash2(x, y, 9);';
      if (!src.includes(a) || !src.includes(b)) { errors.push('hook: renderer.ts anchors not found'); return route.fulfill({ response: res, body: src }); }
      src = 'import { drawPlanks, planksUnder } from "/src/render/planks.ts";\n' + src
        .replace(a, "wang[(ly + 1) * N + lx + 1] = k === 'planks' ? planksUnder(m, x0 + lx, y0 + ly) : wangOf(k);")
        .replace(b, "if (k === 'planks' && drawPlanks(m, x, y, season, (n) => sp(n, lx * TILE, ly * TILE))) { oldTiles.delete(ly * CH + lx); continue; }\n        " + b);
      await route.fulfill({ response: res, body: src });
    });
  if (before) {
    // the image itself, not the `?import&url` module that names it
    await page.route((u) => /\/src\/art\/terrain\.png$/.test(u.pathname) && !/[?&](url|import)\b/.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: headPng }));
    await page.route(/\/src\/art\/terrain\.json(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default ' + headJson.trim() + ';' }));
  }
  await page.goto(url);
  await start(page);
  return page;
}
// (re)start a game: other agents' file writes can make Vite reload the page mid-run
async function start(page) {
  await page.waitForFunction(() => window.__app?.screen);
  await page.evaluate(async () => {
    const app = window.__app;
    const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
    app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
    window.__T = (await import('/src/sim/world/tilemap.ts')).T;
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const g = window.__game;
    for (const f of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_stray', 'tip_depot', 'tip_furniture', 'tip_perkhint', 'tip_quickstack', 'tip_bots']) g.flags.add(f);
  });
}

// the first T.PLANKS tile on row y between x0 and x1 (a bridge), so the shot is centered on it
const findPlanks = (y, x0, x1) => `(() => { const m = g.map, T = window.__T; for (let x = ${x0}; x <= ${x1}; x++) if (m.g(x, ${y}) === T.PLANKS) return x; return ${(x0 + x1) >> 1}; })()`;
const at = (season, x, y, extra = '') => `g.time.season = ${season}; g.player.where = 'world'; g.weather = 'sun'; g.time.min = 11 * 60; ${extra} g.player.x = ${x}; g.player.y = ${y};`;
// a flagstone path and a Plank Walk laid on the farm (what placing them should do: the ground turns into
// T.PATH / T.PLANKS), next to the farmhouse yard
const FARM = `const m = g.map, T = window.__T;
  for (let y = 32; y <= 41; y++) for (let x = 40; x <= 62; x++) { m.setO(x, y, 0); if (m.g(x, y) !== T.GRASS) m.setG(x, y, T.GRASS); g.soil.delete(m.idx(x, y)); }
  for (let x = 42; x <= 60; x++) m.setG(x, 34, T.PATH);
  for (let y = 35; y <= 40; y++) m.setG(50, y, T.PATH);
  for (let y = 37; y <= 38; y++) for (let x = 51; x <= 55; x++) m.setG(x, y, T.PATH);
  for (let x = 42; x <= 47; x++) m.setG(x, 38, T.PLANKS);
  m.setG(44, 40, T.PLANKS);
  for (let x = 57; x <= 59; x++) for (let y = 37; y <= 39; y++) m.setG(x, y, T.PLANKS);`;
const SCENES = {
  'town-spring': at(0, 133, 61),
  'town-winter': at(3, 133, 61),
  'bridge-north-spring': `const bx = ${findPlanks(45, 85, 125)}; ${at(0, 'bx + 1', 46)}`,
  'bridge-north-winter': `const bx = ${findPlanks(45, 85, 125)}; ${at(3, 'bx + 1', 46)}`,
  'bridge-south-spring': `const bx = ${findPlanks(89, 95, 125)}; ${at(0, 'bx + 1', 90)}`,
  'dock-spring': at(0, 153, 29),
  'pier-summer': at(1, 139, 130),
  'farm-path-spring': at(0, 51, 36, FARM),
  'farm-path-winter': at(3, 51, 36, FARM),
};

const names = only.length ? only : Object.keys(SCENES);
const playing = (page) => page.evaluate(() => !!window.__game && !!window.__T && window.__app?.screen?.constructor?.name !== 'TitleScreen' && !window.__app?.screen?.demo).catch(() => false);
const shoot = async (page, n, file) => {
  for (let tries = 0; tries < 3; tries++) {
    if (!(await playing(page))) await start(page);
    await page.evaluate(`(() => { const g = window.__game; ${SCENES[n]} window.__app.renderer.invalidateAll(); })()`).catch(() => {});
    await page.waitForTimeout(900);
    if (!(await playing(page))) continue; // the page reloaded under us: again
    await page.screenshot({ path: file });
    console.log(file);
    return;
  }
  errors.push(`${n}: the page kept reloading`);
};
const page = await open(base);
for (const n of names) await shoot(page, n, `${outDir}/${n}.png`);
if (withOld) {
  const p2 = await open(base + '?art=old');
  for (const n of names) await shoot(p2, n, `${outDir}/${n}.old.png`);
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'no console errors');
await browser.close();
