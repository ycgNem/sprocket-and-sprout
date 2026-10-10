// Creature art check in the running game: every farm animal (adult and baby, standing and mid-step),
// the pet in each pose with its bowl, next to the player on the farm; then the Deepworks' pests.
// Screenshots with the imported art and with ?art=old.
// Usage: node art/creatures/scene.mjs [zoom=3]   -> e2e/out/creatures-farm-{new,old}.png, creatures-mine-{new,old}.png
import { chromium } from 'playwright';
const zoom = +(process.argv[2] ?? 3);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const scene of ['farm', 'mine']) for (const mode of ['new', 'old']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto((process.env.BASE ?? 'http://localhost:5173/') + (mode === 'old' ? '?art=old' : ''));
  await page.waitForFunction(() => window.__app?.screen && window.__Game);
  await page.evaluate(async ({ zoom, scene }) => {
    const app = window.__app;
    const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
    for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'mine']) g.flags.add('tip_' + t);
    app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 });
    const A = await import('/src/render/atlas.ts');
    await A.artReady();
    const { O } = await import('/src/sim/world/tilemap.ts');
    g.time.min = 660;
    if (scene === 'farm') {
      const x0 = Math.floor(g.player.x) - 9, y0 = Math.floor(g.player.y) + 3;
      for (let y = y0 - 1; y <= y0 + 9; y++) for (let x = x0 - 1; x <= x0 + 20; x++) { g.map.setO(x, y, O.NONE); const e = g.ents.at(x, y); if (e && e.def.kind !== 'building') g.ents.remove(e); }
      const s = g.sys.animals ?? (g.sys.animals = { list: [], next: 1 });
      const kinds = ['cow', 'goat', 'sheep', 'pig', 'alpaca', 'chicken', 'duck', 'rabbit'];
      let uid = 1;
      const add = (kind, x, y, baby, moving, walkT, dir) => s.list.push({ uid: uid++, kind, name: kind, home: -1, x, y, dir, moving, walkT, visible: true, age: 5, happy: 200, fed: true, petted: false, baby, tx: x, ty: y, wait: 1e9, emote: null, emoteT: 0, made: 0 });
      kinds.forEach((k, i) => {
        const x = x0 + 1 + i * 2.2;
        add(k, x, y0 + 1, false, false, 0, 1);
        add(k, x, y0 + 3, false, true, 0.6, 1); // frame 1
        add(k, x, y0 + 5, true, false, 0, 1);
        add(k, x, y0 + 6.6, true, true, 0.6, 3); // baby mid-step, facing left
      });
      const PS = await import('/src/sim/systems/pet.ts');
      Object.assign(PS.petSys(g), { stage: 'adopted', map: 'world', x: x0 + 10.6, y: y0 + 4.4, kind: window.PET_KIND ?? 'cat', coat: 0, mode: 'sit', bowl: [x0 + 11, y0 + 5], bowlFull: true, moving: false });
      g.player.x = x0 + 8.7; g.player.y = y0 + 4.2;
    } else {
      g.sys.mine.enter(g, +(window.MINE_FLOOR ?? 12));
      const m = g.sys.mine.map;
      // the Deepworks' pests: a rust-mite, a clatter-crab (tucked in, then hit once), a wisp
      const ids = ['rust_mite', 'clatter_crab', 'wisp'];
      const { MONSTER_BY_ID } = await import('/src/data/creatures.ts');
      // find an open floor area near the player
      const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
      const floorT = m.g(px, py);
      for (let y = py - 4; y <= py + 5; y++) for (let x = px - 10; x <= px + 10; x++) { try { m.setG(x, y, floorT); m.setO(x, y, O.NONE); } catch {} }
      g.sys.mine.monsters = ids.flatMap((id, i) => [0, 1].map((r) => {
        const def = MONSTER_BY_ID.get(id);
        const x = px - 4 + i * 4, y = py - 2 + r * 3;
        // (mites stand still, crabs sit until hit, wisps circle a spot)
        return { id, def, x, y, vx: 0, vy: 0, z: 0, hp: r ? Math.max(1, def.hp - 1) : def.hp, maxHp: def.hp, hurt: 0, phase: r * 2, t: 0, state: 0, cool: 99, face: r ? -1 : 1, aim: NaN, home: [Math.floor(x), Math.floor(y)], ate: [], target: null };
      }));
      g.player.y = py + 3;
    }
    const r = app.renderer; r.cam.x = g.player.x; r.cam.y = g.player.y;
    r.cam.targetZoom = r.cam.zoom = zoom;
    window.__g = g;
  }, { zoom, scene });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `e2e/out/creatures-${scene}-${mode}.png` });
  if (errors.length) console.log(scene, mode, 'errors:\n' + errors.slice(0, 10).join('\n'));
  await page.close();
}
console.log('e2e/out/creatures-{farm,mine}-{new,old}.png');
await browser.close();
