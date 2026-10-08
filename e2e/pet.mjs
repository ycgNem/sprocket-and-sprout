// Farm pet: stray, adoption window (typed name), outdoors following, asleep by the hearth.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/pet';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
const ev = (s) => page.evaluate(s);
const results = [];
for (const kind of ['cat', 'dog']) {
  await ev(`(async () => {
    const g = new window.__Game({ seed: ${kind === 'cat' ? 3 : 4}, name: 'Wren', farmName: 'Hollow' });
    for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night']) g.flags.add('tip_' + t);
    window.__app.startGame(g, { skin: 2, hair: 9, hairStyle: 'long', shirt: 28, pants: 19 });
    window.S = { g };
    const P = await import('/src/sim/systems/pet.ts');
    const p = P.petSys(g);
    p.kind = '${kind}'; p.coat = ${kind === 'cat' ? 3 : 0};
    const [hx, hy] = g.map.loc('farmhouse');
    p.stage = 'stray'; p.map = 'world'; p.x = hx - 1.5; p.y = hy + 2.5; p.mode = 'sit'; p.t = 30;
    g.weather = 'sun'; g.time.min = 9 * 60;
    if (g.player.where === 'house') g.sys.house.leave(g);
    g.player.x = p.x + 2; g.player.y = p.y; g.player.dir = 3;
  })()`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/${kind}-stray.png` });
  // right-click the stray with the real mouse
  const pos = await ev(`(() => { const r = window.__app.renderer; const p = S.g.sys.pet; const s = r.tileToScreen(p.x, p.y - 0.4); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; })()`);
  await page.mouse.click(pos.x, pos.y, { button: 'right' });
  await page.waitForTimeout(500);
  const open = await ev(`window.__play.win?.id`);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type(kind === 'cat' ? 'Turnip' : 'Waffles');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${kind}-adopt.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const st = await ev(`(() => { const p = S.g.sys.pet; return { stage: p.stage, name: p.name, win: window.__play.win?.id ?? null, inv: S.g.player.inv.slots.filter(Boolean).length }; })()`);
  // walk away: the pet follows once it trusts you a little
  await ev(`(() => { S.g.sys.pet.points = 400; })()`);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1600); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${kind}-follow.png` });
  const follow = await ev(`(() => { const g = S.g, p = g.sys.pet; return +Math.hypot(p.x - g.player.x, p.y - g.player.y).toFixed(1); })()`);
  // night: asleep by the hearth
  await ev(`(() => { const g = S.g; g.time.min = 22 * 60; g.sys.house.enter(g); })()`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${kind}-night.png` });
  const night = await ev(`(() => { const p = S.g.sys.pet; return [p.map, p.mode]; })()`);
  results.push({ kind, open, ...st, follow, night });
}
console.log(JSON.stringify(results));
console.log('errors', errors.slice(0, 10));
await browser.close();
