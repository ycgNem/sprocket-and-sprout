// In-game proof that the town's moving parts animate: captures the running wheel, the pump
// house's beam and the fountain at successive moments from the live canvas (zoom 3) and lays
// them out as strips, plus one full shot of the mill and the square at dusk with the lamps lit.
// Usage: node art/town/tools/shots.mjs   (BASE=http://localhost:5173/) -> e2e/out/town-motion.png, e2e/out/town-peek.png
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow' });
  window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
});
await page.waitForTimeout(1200);
for (let i = 0; i < 10 && await page.evaluate(() => !!window.__play.win); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
await page.evaluate(() => {
  const g = window.__game, p = window.__play;
  p.win = null; g.sys.dialogue = null; p.hud.toasts = [];
  for (const t of ['tip_machine', 'tip_move', 'tip_tools', 'tip_welcome']) g.flags.add(t);
  for (const f of ['town_mill', 'waterworks', 'lamplighting', 'tram', 'lamps_hung']) { g.flags.add('era_card:' + f); g.flags.add(f); }
  // the keeper's river works restored, so the square's lamps run on the player's power
  for (const e of g.ents.all()) if (e.st.rust && e.x >= 80 && e.x <= 95 && e.y >= 44 && e.y <= 52) { delete e.st.rust; delete e.st.need; delete e.st.needN; }
  g.ents.powerDirty = true;
  g.time.min = 600;
  const cam = window.__app.renderer.cam;
  cam.follow = function () { this.zoom = this.targetZoom; };
});
await page.mouse.move(1279, 719);

/** frame the camera on (x, y) tiles at zoom z and grab n canvas crops `ms` apart */
async function strip(x, y, z, n, ms, rect) {
  await page.evaluate(([x, y, z]) => { const r = window.__app.renderer; r.cam.zoom = r.cam.targetZoom = z; r.cam.x = x; r.cam.y = y; window.__play.hud.toasts = []; }, [x, y, z]);
  await page.waitForTimeout(700);
  const shots = [];
  for (let i = 0; i < n; i++) {
    shots.push(await page.screenshot({ clip: { x: rect[0], y: rect[1], width: rect[2], height: rect[3] } }));
    await page.waitForTimeout(ms);
  }
  return shots;
}
const wheel = await strip(96.5, 56.5, 3, 4, 125, [460, 220, 300, 260]);
const pump = await strip(118.5, 55.2, 3, 4, 250, [480, 120, 330, 250]);
const fountain = await strip(133.5, 66.6, 3, 4, 167, [520, 230, 240, 230]);

// lay the strips out in the page itself (no image library needed here)
const url = await page.evaluate(async (rows) => {
  const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
  const imgs = await Promise.all(rows.map((r) => Promise.all(r.map(load))));
  const W = Math.max(...imgs.map((r) => r.reduce((a, im) => a + im.width + 6, 6))), H = imgs.reduce((a, r) => a + Math.max(...r.map((im) => im.height)) + 6, 6);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#2e222f'; ctx.fillRect(0, 0, W, H);
  let y = 6;
  for (const r of imgs) { let x = 6; for (const im of r) { ctx.drawImage(im, x, y); x += im.width + 6; } y += Math.max(...r.map((im) => im.height)) + 6; }
  return c.toDataURL('image/png');
}, [wheel, pump, fountain].map((r) => r.map((b) => b.toString('base64'))));
const fs = await import('node:fs');
fs.writeFileSync('e2e/out/town-motion.png', Buffer.from(url.split(',')[1], 'base64'));

// the mill and the square at dusk, lamps lit on the player's power
await page.evaluate(() => { const g = window.__game, r = window.__app.renderer; g.time.min = 20 * 60 + 30; r.cam.zoom = r.cam.targetZoom = 2; r.cam.x = 112; r.cam.y = 59; window.__play.hud.toasts = []; });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'e2e/out/town-peek.png' });
console.log('e2e/out/town-motion.png (rows: wheel 1/8 s apart, pump beam 1/4 s, fountain 1/6 s), e2e/out/town-peek.png');
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
await browser.close();
