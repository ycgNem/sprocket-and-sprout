// Shift-click with real input (1.2 playtest bug 1): 20 shift-clicks each way on a chest, the
// shipping crate, a jar, a study desk and the Guild depot, plus ctrl-click (move one) and
// double-click (move every stack of that kind). Expect 0 failures.
//   BASE=http://localhost:5173/ node e2e/shift.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/shift';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
let fails = 0, passes = 0;
const check = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL ' + msg); } };
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(base);
await wait(1200);
await page.evaluate(async () => {
  const g = new window.__Game({ seed: 4242, name: 'Shift', farmName: 'Click' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
});
await wait(600);
await page.keyboard.press('Enter'); // welcome
await wait(200);
await page.evaluate(async () => {
  const items = await import('/src/data/items.ts');
  window.__I = items.ITEM_INDEX;
  window.__build = await import('/src/sim/build.ts');
  window.__O = (await import('/src/sim/world/tilemap.ts')).O;
  window.K = (id, q = 0) => window.__I.get(id) * 4 + q;
  const g = window.__game;
  for (let y = 24; y <= 40; y++) for (let x = 40; x <= 66; x++) { g.map.setO(x, y, window.__O.NONE); g.soil.delete(g.map.idx(x, y)); }
  g.research.done.add('r_preserves');
  g.flags.add('lab');
  const gs = (g.sys.guild ??= { unlocked: true, rep: 0, list: [] });
  gs.unlocked = true;
  gs.list = [{ id: 'test', spec: 'stone', label: 'Test stone', need: 99999, have: 0, reward: 1, rep: 0, done: false }];
});

// UI geometry of the struct window (mirrors drawStruct / the panels): screen px of a slot
const geo = () => page.evaluate(() => {
  const ui = window.__app.ui, play = window.__play, st = play.win, g = window.__game;
  const e = g.ents.get(st.arg);
  const SLOT = 20, w = 340, kind = e.def.kind;
  const playerGridH = 3 * (SLOT + 2) + 14;
  let topH = 100;
  // the crate adds a row for its "Ship to:" tags
  if (e.inv && ['chest', 'shipbin', 'building', 'harvester', 'planter', 'fishtrap', 'tapper', 'drill', 'gleaner', 'gantry'].includes(kind)) topH = 24 + Math.ceil(e.inv.size / 12) * (SLOT + 2) + 16 + (kind === 'shipbin' ? 30 : 0);
  if (e.mach) topH = 150;
  if (['lab', 'chest', 'depot', 'building', 'megaproject', 'pond', 'hive', 'splitter', 'decor'].includes(kind)) topH = st.data.topH ?? 150;
  const h = topH + playerGridH + 24;
  const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2) - 10;
  const top = y + 14, py = y + h - playerGridH - 10;
  const s = ui.scale / window.__app.dpr;
  const at = (ux, uy) => ({ x: (ux + 10) * s, y: (uy + 10) * s });
  const bag = (i) => at(x + 14 + (i % 12) * (SLOT + 2), py + 8 + Math.floor(i / 12) * (SLOT + 2));
  // the structure's own slot 0 (chest/crate grid, desk bundles, jar out slot)
  const own = kind === 'lab' ? at(x + 14, top + 58) : e.mach ? at(x + 192, top + 16) : at(x + 14, top + 14);
  return { bag: [...Array(36)].map((_, i) => bag(i)), own };
});

async function open(id, x, y) {
  await page.evaluate(([id, x, y]) => {
    const g = window.__game, play = window.__play;
    play.win = null;
    let e = id === 'crate' ? g.ents.get(g.shipBinId) : g.ents.at(x, y);
    if (!e) e = window.__build.place(g, id, x, y, 0);
    g.player.x = e.x + e.w / 2; g.player.y = e.y + e.h + 0.6; g.player.where = 'world';
    play.openWindow('struct', e.id);
  }, [id, x, y]);
  await wait(250); // the window's pop-in
}
const bagSet = (i, item, n) => page.evaluate(([i, item, n]) => { window.__game.player.inv.slots[i] = n ? { k: window.K(item), n } : null; }, [i, item, n]);
const bagN = (i) => page.evaluate((i) => window.__game.player.inv.slots[i]?.n ?? 0, i);
const shiftClick = async (p, mod = 'Shift') => { await page.keyboard.down(mod); await page.mouse.click(p.x, p.y); await page.keyboard.up(mod); await wait(60); };

// bag -> structure, 20 times each
const CASES = [
  { id: 'chest_wood', x: 44, y: 26, item: 'wood', has: () => page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); return e.inv.countId('wood'); }) },
  { id: 'crate', item: 'radish', has: () => page.evaluate(() => window.__game.ents.get(window.__game.shipBinId).inv.countId('radish')) },
  { id: 'jar', x: 48, y: 26, item: 'cogbean', has: () => page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); let n = 0; for (const [k, v] of e.mach.inBuf) n += v; return n + (e.mach.crafting ? 1 : 0); }) },
  { id: 'lab', x: 52, y: 26, item: 'bundle_green', has: () => page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); return e.inv.countId('bundle_green'); }) },
  { id: 'freight_depot', x: 58, y: 26, item: 'stone', has: () => page.evaluate(() => window.__game.sys.guild.list[0].have) },
];
for (const c of CASES) {
  await open(c.id, c.x, c.y);
  const G = await geo();
  for (let t = 0; t < 20; t++) {
    const slot = 12 + (t % 12);
    // the jar only holds a batch's worth: one bean at a time keeps it from filling up
    const n = c.id === 'jar' ? 1 : 3;
    await bagSet(slot, c.item, n);
    // the jar holds a batch and the desk ten bundles: empty them so each click has room
    if (c.id === 'jar') await page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); e.mach.inBuf.clear(); });
    if (c.id === 'lab') await page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); e.inv.slots.fill(null); });
    const before = await c.has();
    await shiftClick(G.bag[slot]);
    const after = await c.has();
    check((await bagN(slot)) === 0 && after > before, `${c.id}: bag -> ${c.id} shift-click #${t + 1} (slot ${slot}: ${await bagN(slot)} left, ${before} -> ${after})`);
  }
  await page.screenshot({ path: `${out}/${c.id}.png` });
}

// structure -> bag, 20 times each (the depot and the crate's buyer only take)
for (const c of [{ id: 'chest_wood', x: 44, y: 26, item: 'copper_ore' }, { id: 'crate', item: 'radish' }, { id: 'lab', x: 52, y: 26, item: 'bundle_green' }, { id: 'jar', x: 48, y: 26, item: 'pickles_cogbean' }]) {
  await open(c.id, c.x, c.y);
  const G = await geo();
  await page.evaluate(() => { const inv = window.__game.player.inv; for (let i = 12; i < 36; i++) inv.slots[i] = null; });
  for (let t = 0; t < 20; t++) {
    await page.evaluate(([item]) => {
      const e = window.__game.ents.get(window.__play.win.arg);
      if (e.mach) e.mach.outBuf = [{ k: window.K(item), n: 2 }];
      else e.inv.slots[0] = { k: window.K(item), n: 2 };
    }, [c.item]);
    const before = await page.evaluate(([item]) => window.__game.player.inv.countId(item), [c.item]);
    await shiftClick(G.own);
    const after = await page.evaluate(([item]) => window.__game.player.inv.countId(item), [c.item]);
    check(after === before + 2, `${c.id}: ${c.id} -> bag shift-click #${t + 1} (${before} -> ${after})`);
  }
}

// ctrl-click moves one; double-click moves every stack of that kind
await open('chest_wood', 44, 26);
{
  const G = await geo();
  await page.evaluate(() => { const e = window.__game.ents.get(window.__play.win.arg); e.inv.slots.fill(null); });
  await bagSet(12, 'fiber', 10);
  await shiftClick(G.bag[12], 'Control');
  check((await bagN(12)) === 9, `ctrl-click moved one (${await bagN(12)} left of 10)`);
  for (const i of [13, 14, 20]) await bagSet(i, 'fiber', 5);
  await page.mouse.dblclick(G.bag[13].x, G.bag[13].y);
  await wait(100);
  const left = await page.evaluate(() => window.__game.player.inv.countId('fiber'));
  check(left === 0, `double-click moved every fiber stack (${left} left in the bag)`);
  check(await page.evaluate(() => !window.__app.ui.hand), 'nothing left in the hand after a double-click');
}
// the backpack: shift-click swaps hotbar and bag rows
await page.evaluate(() => { window.__play.win = null; window.__play.openWindow('menu', 'inventory'); });
await wait(250);
{
  const pos = await page.evaluate(() => {
    const ui = window.__app.ui, s = ui.scale / window.__app.dpr;
    const x = Math.floor((ui.w - 360) / 2), y = Math.floor((ui.h - 268) / 2) - 10;
    const gx = x + 14, gy = y + 34;
    return { hot: { x: (gx + 11 * 22 + 10) * s, y: (gy + 8 + 10) * s }, bag: { x: (gx + 5 * 22 + 10) * s, y: (gy + 46 + 22 + 10) * s } };
  });
  await page.evaluate(() => { const inv = window.__game.player.inv; inv.slots[11] = { k: window.K('clay'), n: 4 }; for (let i = 12; i < 36; i++) inv.slots[i] = null; inv.slots[29] = { k: window.K('coal'), n: 6 }; });
  await shiftClick(pos.hot);
  check(await page.evaluate(() => !window.__game.player.inv.slots[11] && window.__game.player.inv.slots.slice(12).some((s) => s && s.n === 4)), 'backpack: hotbar -> bag');
  await shiftClick(pos.bag);
  check(await page.evaluate(() => !window.__game.player.inv.slots[29] && window.__game.player.inv.slots.slice(0, 12).some((s) => s && s.n === 6)), 'backpack: bag -> hotbar');
  await page.screenshot({ path: `${out}/backpack.png` });
}

console.log(`shift-click: ${passes} passed, ${fails} failed; console errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(e);
if (fails || errors.length) process.exitCode = 1;
await browser.close();
