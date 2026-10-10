// The town keystones on screen (src/render/townworks.ts, src/sim/systems/townworks.ts) against a
// running dev server: the Town Mill still and turning, the square by day and lit at night on the
// player's power (the keeper's river works restored carry the town line), the dry and running
// fountain, and the tram's cart. The flags are set directly, as the Works orders would.
// Usage: BASE=http://localhost:5173/ node e2e/townworks.mjs   (PASS/FAIL lines; screenshots in e2e/out/townworks/)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:5173/';
const OUT = 'e2e/out/townworks';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const ev = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);
const results = [];
const check = (ok, what) => results.push((ok ? 'PASS ' : 'FAIL ') + what);

await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await ev(() => { const g = new window.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow' }); window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 }); });
await wait(1200);
for (let i = 0; i < 10 && await ev(() => !!window.__play.win); i++) { await page.keyboard.press('Escape'); await wait(200); }
await ev(() => {
  const g = window.__game, p = window.__play;
  p.win = null; g.sys.dialogue = null; p.hud.toasts = [];
  for (const t of ['tip_machine', 'tip_move', 'tip_tools', 'tip_welcome']) g.flags.add(t);
  // the keystones' era cards (src/sim/systems/research.ts) would cover the shots: seen already
  for (const f of ['town_mill', 'waterworks', 'lamplighting', 'tram']) g.flags.add('era_card:' + f);
  // the camera stays where a shot puts it (it follows the player otherwise)
  const cam = window.__app.renderer.cam;
  cam.follow = function () { this.zoom = this.targetZoom; };
});

/** frame a spot (camera x, y in tiles), set the clock and flags, wait, and screenshot it */
const shot = async (name, s) => {
  await ev((s) => {
    const g = window.__game, p = window.__play, r = window.__app.renderer;
    p.win = null; g.sys.dialogue = null;
    if (!s.keepToasts) p.hud.toasts = [];
    for (const f of s.flags ?? []) g.flags.add(f);
    for (const f of s.unflags ?? []) g.flags.delete(f);
    if (s.min !== undefined) g.time.min = s.min;
    if (s.px !== undefined) { g.player.x = s.px; g.player.y = s.py; }
    r.cam.zoom = r.cam.targetZoom = s.zoom ?? 3;
    r.cam.x = s.x; r.cam.y = s.y;
  }, s);
  if (s.hover) {
    const pt = await ev(([x, y]) => window.__app.renderer.tileToScreen(x, y), s.hover);
    await page.mouse.move(pt.x, pt.y);
  } else {
    // no hover tooltip or tile box: the pointer is off the world
    await page.mouse.move(1279, 719);
    await ev(() => { const m = window.__app.input.mouse; m.x = -9999; m.y = -9999; });
  }
  await wait(s.wait ?? 800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

// ---- the Town Mill ----
const blds = await ev(() => window.__game.map.buildings.filter((b) => b.kind === 'landmark').map((b) => b.id));
check(blds.includes('town_mill') && blds.includes('pump_house'), `the mill and the pump house stand in the world: ${blds}`);
await shot('mill-still', { x: 100, y: 55.6, min: 600, px: 101.5, py: 61, unflags: ['town_mill'] });
check(await ev(() => window.__game.flags.has('observed:town_mill')), 'walking up to the mill counts as looking at it');
await shot('mill-turning', { x: 100, y: 55.6, min: 600, flags: ['town_mill'] });
await shot('mill-night', { x: 100, y: 55.6, min: 21 * 60 });
// hovering the mill from across town counts too
await ev(() => window.__game.flags.delete('observed:town_mill'));
await shot('mill-hover', { x: 100, y: 55.6, min: 600, px: 133.5, py: 63.5, unflags: ['town_mill'], hover: [99.5, 54], wait: 500 });
check(await ev(() => window.__game.flags.has('observed:town_mill')), 'hovering the mill counts as looking at it');
await shot('mill-from-square', { x: 113, y: 58, zoom: 2, min: 600, px: 124.5, py: 60.5, flags: ['town_mill'] });

// ---- the square: before, by day with the keystones in, dark at night without power, lit on it ----
await shot('square-day-before', { x: 133, y: 60.4, zoom: 2, min: 600, px: 133.5, py: 63.4, unflags: ['lamps_hung', 'waterworks', 'tram'] });
await shot('square-day', { x: 133, y: 60.4, zoom: 2, min: 600, flags: ['lamps_hung', 'waterworks'] });
await shot('square-night-unpowered', { x: 133, y: 60.4, zoom: 2, min: 21 * 60, wait: 2600 });
check(await ev(() => !window.__game.flags.has('lamplighting')), 'with no pole of yours at the farm gate the lamps stay dark');
// restore the keeper's river works: its pole by the farm gate carries the town line
const restored = await ev(() => {
  const g = window.__game;
  let n = 0;
  for (const e of g.ents.all()) if (e.st.rust && e.x >= 80 && e.x <= 95 && e.y >= 44 && e.y <= 52) { delete e.st.rust; delete e.st.need; delete e.st.needN; n++; }
  g.ents.powerDirty = true;
  return n;
});
await shot('square-night-lit', { x: 133, y: 60.4, zoom: 2, min: 21 * 60, wait: 2600, keepToasts: true });
const lit = await ev(async () => {
  const tw = await import('/src/sim/systems/townworks.ts');
  const g = window.__game;
  return { lit: tw.townworks(g).lit, glow: tw.lampGlow(g), flag: g.flags.has('lamplighting'), toast: window.__play.hud.toasts.map((t) => t.text ?? t.msg ?? '').join(' | ') };
});
check(restored >= 3 && lit.lit && lit.flag, `restoring the keeper's works lights the square's lamps (${restored} restored): ${JSON.stringify(lit)}`);
await shot('square-night-lit-close', { x: 133, y: 58, zoom: 3, min: 21 * 60 + 30 });
await shot('town-line', { x: 91, y: 46.4, zoom: 4, min: 21 * 60 + 30 });
await shot('town-line-day', { x: 91, y: 46.4, zoom: 4, min: 16 * 60 });

// ---- the fountain and the pump house ----
await shot('fountain-dry', { x: 133.5, y: 66.6, zoom: 4, min: 600, unflags: ['waterworks'] });
await shot('fountain-running', { x: 133.5, y: 66.6, zoom: 4, min: 600, flags: ['waterworks'] });
await shot('pump-house-shut', { x: 118.5, y: 56, zoom: 4, min: 600, unflags: ['waterworks'] });
await shot('pump-house-running', { x: 118.5, y: 56, zoom: 4, min: 600, flags: ['waterworks'], wait: 1800 });

// ---- the tram ----
await ev(() => window.__game.flags.add('tram'));
await wait(1500);
const bin = await ev(async () => {
  const tw = await import('/src/sim/systems/townworks.ts');
  const inv = await import('/src/sim/inventory.ts');
  const g = window.__game, b = tw.tramBin(g);
  if (b) { b.inv.add(inv.key('copper_ore'), 25); b.inv.add(inv.key('iron_ore'), 6); }
  return b ? { x: b.x, y: b.y } : null;
});
check(!!bin, `the tram's cart bin stands at the quarry entrance: ${JSON.stringify(bin)}`);
await shot('tram-quarry', { x: 170, y: 40.4, zoom: 3, min: 15 * 60 });
// the morning run: the cart takes 20 ore to town and sells it
const run = await ev(async () => {
  const tw = await import('/src/sim/systems/townworks.ts');
  const g = window.__game, m0 = g.player.money;
  window.__play.hud.toasts = [];
  const r = tw.tramRun(g);
  return { ...r, gained: g.player.money - m0, left: tw.tramBin(g).inv.slots.filter(Boolean).map((s) => s.n) };
});
check(run.n === 20 && run.gained === run.coins && run.coins > 0, `the morning cart sells 20 ore: ${JSON.stringify(run)}`);
// 6:38am: the loaded cart on the avenue, nearly at the square
const cart = await ev(async () => {
  const rt = await import('/src/render/townworks.ts');
  window.__game.time.min = 6 * 60 + 38;
  return rt.tramCart(window.__game);
});
check(cart.loaded && cart.moving && cart.view === 'v', `the morning cart runs loaded down the avenue at 6:38: ${JSON.stringify(cart)}`);
await shot('tram-run', { x: 130.5, y: 46, zoom: 3, min: 6 * 60 + 38, keepToasts: true, wait: 600 });
await shot('tram-square', { x: 130, y: 49.4, zoom: 3, min: 10 * 60 });

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 20).join('\n') : 'no console errors');
