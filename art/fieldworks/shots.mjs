// The Field Works in the running game: two field gantries (one per axis) working ripe cogbean
// strips on their rails, a gleaner in its 3x3, with the imported art and with ?art=old.
// Writes e2e/out/fieldworks-game.png and e2e/out/fieldworks-game-old.png (+ close-ups).
//   BASE=http://localhost:5173/ node art/fieldworks/shots.mjs
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function shoot(query, suffix) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + query);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = new window.__Game({ seed: 777, name: 'Works', farmName: 'Brass' });
    for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy']) g.flags.add(id);
    window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    const g = window.__game;
    const B = await import('/src/sim/build.ts'), I = await import('/src/data/items.ts'), F = await import('/src/sim/systems/farming.ts'), C = await import('/src/data/crops.ts');
    const { O, T } = await import('/src/sim/world/tilemap.ts');
    const K = (id) => I.ITEM_INDEX.get(id) * 4;
    for (let y = 24; y <= 48; y++) for (let x = 36; x <= 70; x++) { g.map.setO(x, y, O.NONE); g.map.setG(x, y, T.GRASS); g.soil.delete(g.map.idx(x, y)); }
    const P = (id, x, y, r = 0) => B.place(g, id, x, y, r);
    const bean = C.CROP_BY_ID.get('cogbean'), total = F.cropTotal(bean);
    const crop = (x, y, ripe) => {
      if (g.ents.at(x, y)) return;
      F.till(g, x, y); F.plant(g, bean, g.map.idx(x, y));
      const s = g.soil.get(g.map.idx(x, y)); s.water = true;
      if (ripe) { s.crop.days = total; s.crop.ready = true; } else s.crop.days = 2;
    };
    g.research.done.add('r_gantry');
    // gantry A: car across x 40..46 at y 42, travelling north; rails x 40 and 46, rows 34..41
    P('waterwheel', 36, 44); P('pole_wood', 39, 44);
    const a = P('field_gantry', 40, 42, 0);
    for (let y = 34; y <= 41; y++) { P('rail', 40, y, 0); P('rail', 46, y, 0); for (let x = 41; x <= 45; x++) crop(x, y, true); }
    a.inv.add(K('cogbean_seed'), 30);
    // gantry B: car down x 50, y 28..34, travelling east; rails on rows 28 and 34, columns 51..60
    P('waterwheel', 50, 36); P('pole_wood', 49, 35);
    const b = P('field_gantry', 50, 28, 1);
    for (let x = 51; x <= 60; x++) { P('rail', x, 28, 1); P('rail', x, 34, 1); for (let y = 29; y <= 33; y++) crop(x, y, true); }
    b.inv.add(K('cogbean_seed'), 30);
    // a gleaner in its 3x3 of cogbeans
    P('gleaner', 64, 40);
    for (let y = 39; y <= 41; y++) for (let x = 63; x <= 65; x++) crop(x, y, true);
    P('gleaner', 66, 37);
    g.player.x = 48; g.player.y = 39; g.time.min = 13 * 60;
    for (let i = 0; i < 60 * 6; i++) g.tick();
    const r = window.__app.renderer; r.cam.x = 51; r.cam.y = 36; r.cam.zoom = r.cam.targetZoom = 2;
    window.__fw = { a, b };
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `e2e/out/fieldworks-game${suffix}.png` });
  // close-ups at zoom 4: gantry A, gantry B, the gleaner
  // the camera follows the player, so the player stands beside each subject
  for (const [name, x, y] of [['a', 47.5, 37], ['b', 55, 36.5], ['gleaner', 62.5, 41.5]]) {
    await page.evaluate(([x, y]) => { const g = window.__game, r = window.__app.renderer; g.player.x = x; g.player.y = y; r.cam.x = x; r.cam.y = y; r.cam.zoom = r.cam.targetZoom = 4; }, [x, y]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `e2e/out/fieldworks-game-${name}${suffix}.png` });
  }
  // the icons where players see them: hotbar slots 6-9, and the belt icons riding a short belt
  await page.evaluate(async () => {
    const g = window.__game, I = await import('/src/data/items.ts'), B = await import('/src/sim/build.ts'), BL = await import('/src/sim/systems/belts.ts');
    const K = (id) => I.ITEM_INDEX.get(id) * 4;
    ['gleaner', 'rail', 'field_gantry', 'cogbean_oil'].forEach((id, i) => { g.player.inv.slots[5 + i] = { k: K(id), n: 3 + i }; });
    const ids = ['gleaner', 'rail', 'field_gantry', 'cogbean_oil'];
    for (let x = 58; x <= 63; x++) B.place(g, 'belt_1', x, 44, 1);
    for (let x = 58; x <= 63; x++) { const e = g.ents.at(x, 44); BL.laneInsert(e.belt, 0, K(ids[x % 4]), 0.3); BL.laneInsert(e.belt, 1, K(ids[(x + 1) % 4]), 0.7); }
    g.player.x = 61; g.player.y = 42.5; const r = window.__app.renderer; r.cam.x = 61; r.cam.y = 43; r.cam.zoom = r.cam.targetZoom = 4;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `e2e/out/fieldworks-game-icons${suffix}.png` });
  const st = await page.evaluate(() => ({ a: { pos: window.__fw.a.st.pos, dir: window.__fw.a.st.dir, working: window.__fw.a.working }, b: { pos: window.__fw.b.st.pos, dir: window.__fw.b.st.dir, working: window.__fw.b.working } }));
  console.log(suffix || 'new', JSON.stringify(st));
  await page.close();
}

await shoot('', '');
await shoot('?art=old', '-old');
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(e);
await browser.close();
