// In-game proof that the field gantry's wheels turn (gantry:beam:<axis>:<f>): two working gantries on
// cogbean strips (as art/fieldworks/shots.mjs sets them up), the camera on each bridge's leg feet at
// zoom 4, four captures 1/8 s apart per axis laid out as strips, plus one wide shot.
//   node art/fieldworks/wheelshots.mjs   (BASE=http://localhost:5173/)
//   -> e2e/out/gantry-wheels-game.png (strips), e2e/out/gantry-wheels-wide.png
import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 777, name: 'Works', farmName: 'Brass' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
});
await page.waitForFunction(() => window.__play && window.__game, null, { timeout: 30000 });
await page.waitForTimeout(800);
for (let i = 0; i < 8 && await page.evaluate(() => !!window.__play?.win); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
await page.evaluate(async () => {
  const g = window.__game, p = window.__play;
  p.win = null; g.sys.dialogue = null; p.hud.toasts = [];
  const B = await import('/src/sim/build.ts'), I = await import('/src/data/items.ts'), F = await import('/src/sim/systems/farming.ts'), C = await import('/src/data/crops.ts');
  const { O, T } = await import('/src/sim/world/tilemap.ts');
  const K = (id) => I.ITEM_INDEX.get(id) * 4;
  for (let y = 24; y <= 48; y++) for (let x = 36; x <= 70; x++) { g.map.setO(x, y, O.NONE); g.map.setG(x, y, T.GRASS); g.soil.delete(g.map.idx(x, y)); }
  const P = (id, x, y, r = 0) => B.place(g, id, x, y, r);
  const bean = C.CROP_BY_ID.get('cogbean'), total = F.cropTotal(bean);
  const crop = (x, y) => {
    if (g.ents.at(x, y)) return;
    F.till(g, x, y); F.plant(g, bean, g.map.idx(x, y));
    const s = g.soil.get(g.map.idx(x, y)); s.water = true; s.crop.days = total; s.crop.ready = true;
  };
  g.research.done.add('r_gantry');
  P('waterwheel', 36, 44); P('pole_wood', 39, 44);
  const a = P('field_gantry', 40, 42, 0);
  for (let y = 34; y <= 41; y++) { P('rail', 40, y, 0); P('rail', 46, y, 0); for (let x = 41; x <= 45; x++) crop(x, y); }
  a.inv.add(K('cogbean_seed'), 30);
  P('waterwheel', 50, 36); P('pole_wood', 49, 35);
  const b = P('field_gantry', 50, 28, 1);
  for (let x = 51; x <= 60; x++) { P('rail', x, 28, 1); P('rail', x, 34, 1); for (let y = 29; y <= 33; y++) crop(x, y); }
  b.inv.add(K('cogbean_seed'), 30);
  g.player.x = 48; g.player.y = 39; g.time.min = 13 * 60;
  for (let i = 0; i < 60 * 3; i++) g.tick();
  window.__fw = { a, b };
  const cam = window.__app.renderer.cam;
  cam.follow = function () { this.zoom = this.targetZoom; };
});
await page.mouse.move(1279, 719);

/** the bridge's leg feet: world px of the beam's drawn position + an offset; zoom 4 */
async function strip(axis, n, ms) {
  const shots = [];
  for (let i = 0; i < n; i++) {
    const c = await page.evaluate((axis) => {
      const e = window.__fw[axis === 0 ? 'a' : 'b'];
      const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
      const pos = e.st.pos ?? 0, bx = e.x + DX[e.rot] * pos, by = e.y + DY[e.rot] * pos;
      // axis 0: the left leg's foot (bridge tile row, its first column); axis 1: the north feet
      const fx = axis === 0 ? bx + 0.5 : bx + 0.5, fy = axis === 0 ? by + 0.1 : by + 0.4;
      const r = window.__app.renderer; r.cam.zoom = r.cam.targetZoom = 4; r.cam.x = fx; r.cam.y = fy;
      window.__play.hud.toasts = [];
      return { working: e.working, dir: e.st.dir, pos };
    }, axis);
    await page.waitForTimeout(60);
    shots.push(await page.screenshot({ clip: { x: 640 - 110, y: 360 - 80, width: 220, height: 150 } }));
    if (i === 0) console.log(`axis ${axis}:`, JSON.stringify(c));
    await page.waitForTimeout(ms);
  }
  return shots;
}
const s0 = await strip(0, 6, 125), s1 = await strip(1, 6, 125);
const url = await page.evaluate(async (rows) => {
  const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
  const imgs = await Promise.all(rows.map((r) => Promise.all(r.map(load))));
  const W = Math.max(...imgs.map((r) => r.reduce((a, im) => a + im.width + 6, 6))), H = imgs.reduce((a, r) => a + Math.max(...r.map((im) => im.height)) + 6, 6);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#2e222f'; ctx.fillRect(0, 0, W, H);
  let y = 6;
  for (const r of imgs) { let x = 6; for (const im of r) { ctx.drawImage(im, x, y); x += im.width + 6; } y += Math.max(...r.map((im) => im.height)) + 6; }
  return c.toDataURL('image/png');
}, [s0, s1].map((r) => r.map((b) => b.toString('base64'))));
fs.writeFileSync('e2e/out/gantry-wheels-game.png', Buffer.from(url.split(',')[1], 'base64'));
await page.evaluate(() => { const r = window.__app.renderer; r.cam.zoom = r.cam.targetZoom = 2; r.cam.x = 51; r.cam.y = 36; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'e2e/out/gantry-wheels-wide.png' });
console.log('e2e/out/gantry-wheels-game.png (rows: axis 0 feet, axis 1 feet; 1/8 s apart), e2e/out/gantry-wheels-wide.png');
console.log(errors.length ? 'console errors:\n' + [...new Set(errors)].slice(0, 8).join('\n') : 'no console errors');
await browser.close();
