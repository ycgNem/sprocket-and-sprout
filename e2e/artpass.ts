// The 2.1.1 art pass's proofs (the critic's four weak spots): tilled soil as countable beds, the deep
// strata of the Deepworks, the Harbor warehouse, the seed packets. One PNG per state under
// e2e/out/artpass/, named <shot>-<tag>.png so a run before and a run after pair up.
//
//   node e2e/artpass.ts before            every shot, tagged "before"
//   node e2e/artpass.ts after soil,mine   only these sections (soil, mine, harbor, seeds)
//   BASE=http://localhost:5173/ (default)
import { chromium } from 'playwright';
import fs from 'node:fs';

declare const window: any;
const tag = process.argv[2] ?? 'after';
const only = process.argv[3]?.split(',');
const want = (s: string) => !only || only.includes(s);
const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/artpass';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => window.__app && window.__Game, null, { timeout: 60000 });
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 12345, name: 'Wren', farmName: 'Mossbell' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'mine', 'fish', 'home', 'stray', 'depot', 'furniture', 'perkhint', 'quickstack', 'bots']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
  const A = await import('/src/render/atlas.ts');
  await A.artReady();
  const I = await import('/src/data/items.ts');
  window.S = {
    g, T: (await import('/src/sim/world/tilemap.ts')).T, O: (await import('/src/sim/world/tilemap.ts')).O,
    F: await import('/src/sim/systems/farming.ts'), crops: (await import('/src/data/crops.ts')).CROPS,
    key: (id: string, q = 0) => I.ITEM_INDEX.get(id) * 4 + q, items: I.ITEMS,
    build: await import('/src/sim/build.ts'), FW: await import('/src/sim/systems/fieldworks.ts'),
  };
});
await page.waitForTimeout(600);
await page.keyboard.press('Enter');

const quiet = () => page.evaluate(() => { const p = window.__play; p.hud.toasts.length = 0; if (p.achQ) p.achQ.length = 0; if (p.lessons) p.lessons.q = []; const J = window.__app.renderer.juice; if (J?.banners) J.banners = []; });
const shot = async (name: string, wait = 900) => {
  await page.mouse.move(1279, 719);
  await quiet();
  await page.waitForTimeout(wait);
  await quiet();
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${name}-${tag}.png` });
  console.log(`${out}/${name}-${tag}.png`);
};
/** pin the camera on a tile at a whole zoom */
const cam = (x: number, y: number, zoom: number) => page.evaluate(([x, y, zoom]) => {
  const r = window.__app.renderer;
  r.cam.follow = function () { this.zoom = this.targetZoom; };
  r.cam.zoom = r.cam.targetZoom = zoom; r.cam.x = x; r.cam.y = y;
  r.invalidateAll();
}, [x, y, zoom]);

// ------------------------------------------------------------------ 1. tilled soil
if (want('soil')) {
  await page.evaluate(() => {
    const { g, T, O, F, crops } = window.S;
    const m = g.map;
    g.time.min = 11 * 60; g.weather = 'sun';
    for (let y = 28; y <= 44; y++) for (let x = 40; x <= 64; x++) { m.setO(x, y, O.NONE); m.setG(x, y, T.GRASS); g.soil.delete(m.idx(x, y)); }
    // a patch of bare dirt under the right-hand beds
    for (let y = 30; y <= 36; y++) for (let x = 55; x <= 62; x++) m.setG(x, y, T.DIRT);
    const till = (x: number, y: number, w: boolean) => { if (F.till(g, x, y)) { const s = g.soil.get(m.idx(x, y)); if (s) s.water = w; } };
    // A: 5x4 dry on grass.  B: 5x4 watered on grass.  C: 6x5 on dirt, half watered.
    for (let y = 31; y <= 34; y++) for (let x = 42; x <= 46; x++) till(x, y, false);
    for (let y = 31; y <= 34; y++) for (let x = 48; x <= 52; x++) till(x, y, true);
    for (let y = 31; y <= 35; y++) for (let x = 56; x <= 61; x++) till(x, y, x >= 59);
    // D: an L and single tiles, watered in a scatter.  E: a row of 7 and a 1x1, 2x1, 3x1.
    const cells = ['XXX....X.X', 'X.XX...XX.', 'XXXX.X....', '..XXXX.XXX'];
    cells.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') till(42 + i, 37 + j, (i * 7 + j * 3) % 4 === 0); }));
    for (let x = 54; x <= 60; x++) till(x, 38, x % 2 === 0);
    till(54, 40, false); till(56, 40, false); till(57, 40, false); till(59, 40, true); till(60, 40, true); till(61, 40, true);
    // crops on part of A and B (seedlings, mid-growth, ripe), so the beds are judged under plants too
    const ids = ['radish', 'potato', 'cogbean', 'wheat'];
    let n = 0;
    for (const [x0, x1] of [[42, 44], [48, 50]]) for (let y = 31; y <= 34; y++) for (let x = x0; x <= x1; x++) {
      const cr = crops.find((c: any) => c.id === ids[(y - 31) % ids.length]);
      const s = g.soil.get(m.idx(x, y));
      if (!cr || !s) continue;
      s.crop = { id: cr.id, days: 0, stage: (n++ % 3 === 0) ? 0 : Math.min(cr.stages.length - 1, 1 + (n % 3)), ready: false, dead: false, giant: -1, q: 0, regrow: 0 };
    }
    g.player.x = 53.5; g.player.y = 36.5; g.player.dir = 2;
  });
  for (const [season, name] of [[0, 'spring'], [1, 'summer'], [2, 'fall'], [3, 'winter']] as const) {
    await page.evaluate((s) => { window.S.g.time.season = s; }, season);
    await cam(52, 36, 3);
    await shot(`soil-${name}-z3`);
  }
  await page.evaluate(() => { window.S.g.time.season = 0; });
  await cam(52, 36, 2);
  await shot('soil-spring-z2');
  await cam(47.5, 33.5, 4);
  await shot('soil-spring-z4');
}

// ------------------------------------------------------------------ 2. the deep strata
if (want('mine')) {
  await page.evaluate(() => {
    const { g } = window.S;
    g.flags.add('waterworks'); g.research.done.add('r_spark'); g.time.min = 11 * 60;
    for (const id of ['earth', 'clayworks', 'frost', 'ember', 'crystal', 'starfall']) g.flags.add('deep:' + id);
  });
  for (const level of [3, 18, 20, 23, 25, 28, 30]) {
    const info = await page.evaluate((level) => {
      const { g } = window.S;
      const st = g.sys.mine;
      window.S.hold = null;
      st.enter(g, level);
      const m = st.map;
      const walk = (x: number, y: number) => m.inb(x, y) && !st.solid(g, x, y) && !m.o(x, y);
      // stand two tiles below (else beside) the level's first hazard, so the mark, the player, a
      // ladder or ore and the floor are all in one view
      const h = st.hazards.find((k: any) => k.kind !== 'gas' || true);
      let at: [number, number] | null = null;
      if (h) for (const [dx, dy] of [[0, 2], [1, 2], [-1, 2], [2, 1], [-2, 1], [2, 0], [-2, 0], [0, -2], [1, 1], [-1, 1]]) if (walk(h.x + dx, h.y + dy)) { at = [h.x + dx + 0.5, h.y + dy + 0.6]; break; }
      if (at) { g.player.x = at[0]; g.player.y = at[1]; }
      if (h?.kind === 'gas') window.S.hold = () => { for (const k of st.hazards) if (k.kind === 'gas' && k.group === h.group) { k.state = 0; k.t = 3; } };
      if (h?.kind === 'shard') window.S.hold = () => { for (const k of st.hazards) if (k.kind === 'shard') { k.state = 0; k.t = 99; } };
      return { level, theme: st.theme, dark: st.dark, tint: st.tint, lantern: st.lantern, hazards: st.hazards.map((k: any) => k.kind).join(','), pests: st.monsters.length, at, mapW: m.w, mapH: m.h };
    }, level);
    console.log(JSON.stringify(info));
    const p = await page.evaluate(() => { window.S.hold?.(); const { g } = window.S; if (window.__play.win) window.__play.closeWindow(); return [g.player.x, g.player.y]; });
    await cam(p[0], p[1] - 0.8, 3);
    await page.evaluate(() => window.S.hold?.());
    await shot(`mine-${level}-z3`, 700);
    await cam(info.mapW / 2, info.mapH / 2, 1);
    await page.evaluate(() => window.S.hold?.());
    await shot(`mine-${level}-z1`, 700);
    await cam(p[0], p[1] - 0.8, 2);
    await page.evaluate(() => window.S.hold?.());
    await shot(`mine-${level}-z2`, 700);
  }
  await page.evaluate(() => { const { g } = window.S; g.sys.mine.leave(g); });
}

// ------------------------------------------------------------------ 3. the Harbor
if (want('harbor')) {
  const at = ({ open, ship, min = 12 * 60, cx, cy, zoom = 3, season = 1, aboard = 0 }: { open: boolean; ship: string | null; min?: number; cx: number; cy: number; zoom?: number; season?: number; aboard?: number }) => page.evaluate(([open, ship, min, season, aboard]) => {
    const G = window.S.g;
    G.time.season = season; G.time.min = min; G.weather = 'sun';
    if (open) G.flags.add('harbor'); else G.flags.delete('harbor');
    G.sys.exports = { ship: 'away', next: G.dayIndex + 99, docked: -1, sailed: -1, port: '', opened: true, voyages: 1, full: 0, earned: 0, shipped: {}, log: [], rank: 0 };
    const s = G.sys.exports;
    if (ship === 'moored') { s.ship = 'port'; s.docked = G.dayIndex - 1; }
    // a manifest part loaded, so the cargo stack stands by the warehouse
    const os = G.sys.orders;
    if (os) {
      os.open = os.open.filter((o: any) => o.kind !== 'export');
      if (open && aboard >= 0) os.open.push({ uid: os.uid++, kind: 'export', def: 'x', cust: 'harbor', lines: [{ spec: 'wood', n: 100, have: aboard, unit: 10 }], day: G.dayIndex, due: G.dayIndex + 3, pay: 0, rep: 0 });
    }
    G.player.where = 'world'; G.player.x = 143.5; G.player.y = 129.6; G.player.dir = 0;
  }, [open, ship, min, season, aboard] as const).then(() => cam(cx, cy, zoom));
  await at({ open: false, ship: null, cx: 143, cy: 127.5 });
  await shot('harbor-derelict-z3');
  await at({ open: true, ship: null, cx: 143, cy: 127.5, aboard: 60 });
  await shot('harbor-restored-z3');
  await at({ open: true, ship: 'moored', cx: 145, cy: 131, zoom: 2, aboard: 100 });
  await shot('harbor-moored-z2');
  await at({ open: true, ship: 'moored', cx: 145, cy: 131, zoom: 1, aboard: 100 });
  await shot('harbor-moored-z1');
  await at({ open: true, ship: 'moored', cx: 143, cy: 127.5, season: 3, aboard: 30 });
  await shot('harbor-restored-winter-z3');
  await at({ open: false, ship: null, cx: 143, cy: 127.5, season: 3 });
  await shot('harbor-derelict-winter-z3');
  await at({ open: true, ship: 'moored', min: 21 * 60, cx: 143, cy: 127.5, aboard: 60 });
  await shot('harbor-restored-night-z3');
  // the player walking behind and beside it: nothing walkable hidden but what the roof covers
  await at({ open: true, ship: null, cx: 143, cy: 127.5, aboard: 60 });
  await page.evaluate(() => { const G = window.S.g; G.player.x = 142.5; G.player.y = 125.8; });
  await shot('harbor-behind-z3');
  await page.evaluate(() => { const G = window.S.g; G.time.season = 1; G.flags.delete('harbor'); });
}

// ------------------------------------------------------------------ 4. seed packets
if (want('seeds')) {
  await page.evaluate(() => {
    const { g, key, items } = window.S;
    g.time.season = 0; g.time.min = 11 * 60;
    g.player.where = 'world'; g.player.x = 52.5; g.player.y = 30.5;
    const inv = g.player.inv;
    for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = null;
    const seeds = items.filter((it: any) => it.id.endsWith('_seed')).map((it: any) => it.id);
    window.S.seeds = seeds;
    seeds.slice(0, inv.slots.length).forEach((id: string, n: number) => inv.add(key(id), 3 + (n * 7) % 40));
    window.__play.openWindow('menu', 'inventory');
  });
  await cam(52, 30, 3);
  await shot('seeds-bag');
  await page.evaluate(() => {
    const { g, key, O, build, FW } = window.S;
    window.__play.closeWindow();
    for (let y = 30; y <= 40; y++) for (let x = 44; x <= 60; x++) { g.map.setO(x, y, O.NONE); g.soil.delete(g.map.idx(x, y)); }
    const e = build.place(g, 'field_gantry', 50, 34, 0);
    for (const [id, n] of [['cogbean_seed', 1200], ['wheat_seed', 800], ['barley_seed', 640], ['potato_seed', 300], ['radish_seed', 250], ['corn_seed', 2000], ['pumpkin_seed', 90], ['strawberry_seed', 75], ['cotton_seed', 410], ['tomato_seed', 33], ['melon_seed', 12], ['flax_seed', 64]] as const) FW.binSeeds(e, key(id), n);
    g.player.x = 51; g.player.y = 37;
    window.__play.openWindow('struct', e.id);
  });
  await shot('seeds-gantry');
  await page.evaluate(() => window.__play.closeWindow());
}

console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(e);
await browser.close();
