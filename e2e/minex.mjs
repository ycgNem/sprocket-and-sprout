// The Deepworks in the real game: one level per stratum (each with its hazard or pest in view),
// a works chamber before and after restoring it, every chamber level's machines, and the lift's
// window. Screenshots go to e2e/out/win/; console errors are printed (0 expected).
// Usage: BASE=http://127.0.0.1:5177/ node e2e/minex.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
fs.mkdirSync('e2e/out/win', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => window.__app && window.__Game);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 24, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'mine']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  const A = await import('/src/render/atlas.ts');
  await A.artReady();
  window.S = { g, key: (await import('/src/sim/inventory.ts')).key };
  // the way below level 10 is drained; Spark Coils would burn off a gas pocket a shot stood in
  // (the shots stand below them, to show one venting)
  g.flags.add('waterworks');
  g.research.done.add('r_spark');
  g.time.min = 11 * 60;
});

const snap = (dy = -0.8) => page.evaluate((dy) => { const { g } = window.S; const r = window.__app.renderer; r.cam.x = g.player.x; r.cam.y = g.player.y + dy; }, dy);
/** let the HUD take this level's events, then clear its toasts and achievement banners (each shot shows its own level) */
const quiet = async () => { await page.waitForTimeout(300); await page.evaluate(() => { const p = window.__app.screen; p.hud.toasts.length = 0; p.achQ.length = 0; }); };

/** go to a level and stand a little below its most telling thing; returns what's in view */
const visit = (level) => page.evaluate((level) => {
  const { g } = window.S;
  const st = g.sys.mine;
  // (each stratum's first-visit note shows once in play; keep these shots clear of it)
  for (const id of ['earth', 'clayworks', 'frost', 'ember', 'crystal', 'starfall']) g.flags.add('deep:' + id);
  window.S.hold = null;
  st.enter(g, level);
  const pick = (kind) => st.hazards.find((h) => h.kind === kind);
  const pest = (b) => st.monsters.find((mo) => mo.def.behavior === b);
  let at = null, what = 'the ladder up';
  const theme = st.theme;
  if (theme === 0 && pick('crack')) { const h = pick('crack'); at = [h.x + 0.5, h.y + 3.2]; what = 'a cracked ceiling'; }
  else if (theme === 1 && st.gallery) { at = [st.gallery[0] + 0.5, st.gallery[1] + 2.6]; what = 'the collapsed gallery'; }
  else if (theme === 1 && pest('mite')) { const mo = pest('mite'); at = [mo.x, mo.y + 2.2]; what = 'a rust-mite'; }
  else if (theme === 2 && pest('block')) { const mo = pest('block'); at = [mo.x, mo.y + 2.2]; what = 'a clatter-crab'; }
  else if (theme === 3 && pick('gas')) {
    // (its whole pocket mid-vent: S.hold puts it back there just before the shot, since a vent
    // only lasts 2.5 s and its plume fades in and out with it)
    const h = pick('gas');
    window.S.hold = () => { for (const k of st.hazards) if (k.kind === 'gas' && k.group === h.group) { k.state = 3; k.t = 1.6; } };
    at = [h.x + 0.5, h.y + 3.2]; what = 'a gas pocket venting';
  }
  else if (theme === 4 && pest('guard')) { const mo = pest('guard'); at = [mo.x, mo.y + 2.4]; what = 'a wisp over its ladder'; }
  else if (theme === 5 && pick('shard')) { const h = pick('shard'); h.state = 1; h.t = 99; at = [h.x + 0.5, h.y + 3]; what = "a star-shard's mark"; }
  if (at) { g.player.x = at[0]; g.player.y = at[1]; }
  return { level, stratum: ['Earth', 'Clayworks', 'Frost', 'Ember', 'Crystal', 'Starfall'][theme], what, dark: st.dark, lantern: st.lantern, pests: st.monsters.length, hazards: st.hazards.length };
}, level);

const LEVELS = [3, 6, 12, 18, 23, 28];
for (const [i, level] of LEVELS.entries()) {
  const info = await visit(level);
  await quiet();
  await snap();
  await page.waitForTimeout(900);
  if (await page.evaluate(() => { window.S.hold?.(); return !!window.S.hold; })) await page.waitForTimeout(250);
  await page.screenshot({ path: `e2e/out/win/stratum-${i + 1}.png` });
  console.log(`stratum-${i + 1}.png`, JSON.stringify(info));
}

// the Crystal's dark galleries, lit by two lamps set down on the floor beside the wisp's ladder
await visit(23);
const lit = await page.evaluate(() => {
  const { g, key } = window.S;
  const st = g.sys.mine;
  g.player.inv.add(key('lamp'), 2);
  g.player.sel = g.player.inv.slots.findIndex((s) => s && s.k === key('lamp'));
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 0], [2, 0], [-1, -2], [1, -2], [-2, 1], [2, 1]]) if (st.lamps.length < 2) st.setLamp(g, px + dx, py + dy);
  return { lamps: st.lamps.length, lantern: st.lantern };
});
await quiet();
await snap();
await page.waitForTimeout(700);
await page.screenshot({ path: 'e2e/out/win/crystal-lamps.png' });
console.log('crystal-lamps.png', JSON.stringify(lit));

// every works chamber level's machines (5, 10, 15, 20, 25, 30), their study cards already seen
for (const level of [5, 10, 15, 20, 25, 30]) {
  await page.evaluate((level) => {
    const { g } = window.S;
    const st = g.sys.mine;
    st.enter(g, level);
    const c = st.chambers[0], c2 = st.chambers[st.chambers.length - 1];
    g.player.x = (c.x + c2.x + c2.w) / 2;
    g.player.y = c.y + 3.4;
  }, level);
  await quiet();
  await snap(-2.6);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `e2e/out/win/chamber-${level}.png` });
}

// the old lift on level 5: F with the parts missing, F with them, then F to ride it
const c = await page.evaluate(() => {
  const { g } = window.S;
  const st = g.sys.mine;
  // (seen afresh: the observation toast shows in this shot)
  g.flags.delete('observed:lift');
  st.enter(g, 5);
  const c = st.chambers.find((x) => x.kind === 'lift');
  g.player.x = c.x + 1;
  g.player.y = c.y + 2.2;
  g.player.dir = 0;
  st.interact(g, c.x, c.y);
  return { x: c.x, y: c.y, before: g.flags.has('chamber:lift') };
});
await page.evaluate(() => { window.__app.screen.achQ.length = 0; });
await snap(-1.4);
await page.waitForTimeout(700);
await page.screenshot({ path: 'e2e/out/win/chamber-lift-parts.png' });
await page.evaluate((c) => {
  const { g, key } = window.S;
  for (const [id, n] of [['plank', 4], ['copper_gear', 2], ['rope', 1]]) g.player.inv.add(key(id), n);
  g.sys.mine.interact(g, c.x, c.y);
}, c);
await page.waitForTimeout(600);
await page.screenshot({ path: 'e2e/out/win/chamber-lift-restored.png' });
const after = await page.evaluate((c) => {
  const { g } = window.S;
  g.sys.mine.interact(g, c.x, c.y);
  return { lift: g.flags.has('chamber:lift'), stops: g.sys.mine.lifts(g) };
}, c);
await page.waitForTimeout(500);
const win = await page.evaluate(() => window.__app.screen.win?.id ?? null);
await page.screenshot({ path: 'e2e/out/win/lift-window.png' });
console.log('lift', JSON.stringify({ before: c.before, ...after, window: win }));

console.log('console errors:', errors.length);
for (const e of errors.slice(0, 10)) console.log('  ' + e);
if (warnings.length) console.log('warnings:', warnings.length, warnings.slice(0, 3));
await browser.close();
