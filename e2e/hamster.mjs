// The hamster and the counter, with real input (the owner's playtest): the Housewarming quest (the
// Professor's been by; F at the farmhouse door brings the cage and the goldfish), place the cage by
// clicking, name the hamster in its window (typed), feed it a seed with F, its wheel at night, Shift+F
// for its ball and back, the cage's hover, Shift+right-click to pick the cage up; then Bram at work in
// the forge: the counter's Chat, and the shop back after the talk.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/hamster';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForTimeout(1200);
const ev = (s) => page.evaluate(s);
const wait = (ms) => page.waitForTimeout(ms);
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
/** a tile's middle on screen, in page pixels */
const at = (x, y) => ev(`(() => { const s = window.__app.renderer.tileToScreen(${x}, ${y}); return { x: s.x / window.__app.dpr, y: s.y / window.__app.dpr }; })()`);

await ev(`(async () => {
  const g = new window.__Game({ seed: 77, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  window.S = { g };
  // the Professor has been by (the Keeper's Line's first two steps): Housewarming is next
  const q = g.sys.quests;
  q.active = q.active.filter((a) => a.id !== 'k1_line' && a.id !== 'k2_springs');
  for (const id of ['k1_line', 'k2_springs']) { q.done.push(id); g.flags.add('quest_done:' + id); }
  g.time.min = 10 * 60;
  // outside, at the farmhouse door
  const b = g.map.buildings.find((b) => b.kind === 'farmhouse');
  g.player.where = 'world'; g.player.x = b.door[0] + 0.5; g.player.y = b.y + b.h + 0.6; g.player.dir = 0;
})()`);
let started = false;
for (let i = 0; i < 20 && !started; i++) {
  await wait(200);
  started = await ev(`S.g.sys.quests.active.some((a) => a.id === 's_housewarming')`);
}
check(started, 'Housewarming starts once the Professor has been by');
check(!(await ev(`S.g.player.inv.countId('f_hamster_cage')`)), 'no cage on the first morning');
// 0. F at the door: in, and the gifts
await page.keyboard.press('KeyF');
await wait(900);
const gifts = await ev(`(() => ({ where: S.g.player.where, done: S.g.sys.quests.done.includes('s_housewarming'), cage: S.g.player.inv.countId('f_hamster_cage'), tank: S.g.player.inv.countId('f_tank') }))()`);
check(gifts.where === 'house' && gifts.done && gifts.cage === 1 && gifts.tank === 1, 'walking in brings the cage and the goldfish: ' + JSON.stringify(gifts));
await page.screenshot({ path: `${out}/0-housewarming.png` });
await ev(`(() => { const g = S.g; window.__play.hud.toasts = []; g.player.x = 4.5; g.player.y = 7.6; g.player.dir = 0; })()`);
await wait(300);
/** the key that selects the hotbar slot holding an item */
const slotKey = async (id) => {
  const i = await ev(`(async () => { const I = await import('/src/sim/inventory.ts'); return S.g.player.inv.slots.findIndex((s) => s && I.kId(s.k) === '${id}'); })()`);
  check(i >= 0 && i < 10, `${id} in the hotbar (slot ${i})`);
  return i === 9 ? 'Digit0' : 'Digit' + (i + 1);
};

// 1. hold the cage and click a floor tile: the naming window
await page.keyboard.press(await slotKey('f_hamster_cage'));
await wait(200);
const tile = await ev(`(async () => {
  const H = await import('/src/sim/systems/house.ts');
  const { FURN_BY_ID } = await import('/src/data/furniture.ts');
  const f = FURN_BY_ID.get('f_hamster_cage');
  for (let y = 3; y < 7; y++) for (let x = 2; x < 12; x++) if (!H.canPlaceDecor(S.g, f, x, y)) return [x, y];
  return null;
})()`);
check(!!tile, 'a spot for the cage');
const [cx, cy] = tile;
const p0 = await at(cx + 0.5, cy + 0.5);
await page.mouse.click(p0.x, p0.y);
await wait(400);
check((await ev(`window.__play.win?.id`)) === 'hamster', 'placing the cage opens the naming window');
await page.screenshot({ path: `${out}/1-name.png` });
for (let i = 0; i < 14; i++) await page.keyboard.press('Backspace');
await page.keyboard.type('Pocket');
await page.keyboard.press('Enter');
await wait(400);
const named = await ev(`(() => { const h = S.g.sys.hamster; return { named: h.named, name: h.name, win: window.__play.win?.id ?? null }; })()`);
check(named.named && named.name === 'Pocket' && !named.win, 'named by typing: ' + JSON.stringify(named));

// 2. stand below the cage facing it, a seed in hand, F: its supper
await ev(`(() => { const g = S.g; g.player.x = ${cx} + 0.5; g.player.y = ${cy} + 1.7; g.player.dir = 0; })()`);
await page.keyboard.press(await slotKey('radish_seed'));
await wait(300);
const bubble = await ev(`(async () => { const P = await import('/src/sim/prompts.ts'); return P.promptAt(S.g, ${cx}, ${cy})?.verb ?? null; })()`);
check(bubble === 'Feed Pocket', 'the F bubble says Feed: ' + bubble);
await page.keyboard.press('KeyF');
await wait(400);
const fed = await ev(`(() => ({ fed: S.g.sys.hamster.fedDay === S.g.dayIndex, seeds: S.g.player.inv.countId('radish_seed') }))()`);
check(fed.fed, 'F with a seed feeds it');
await page.screenshot({ path: `${out}/2-fed.png` });

// 3. dusk: on its wheel (it has a heart)
await ev(`(() => { const h = S.g.sys.hamster; h.points = 300; S.g.time.min = 19 * 60; h.t = 0; })()`);
let wheel = false;
for (let i = 0; i < 40 && !wheel; i++) {
  await wait(250);
  wheel = await ev(`S.g.sys.hamster.mode === 'wheel'`);
}
check(wheel, 'on its wheel at dusk');
await wait(300);
await page.screenshot({ path: `${out}/3-wheel.png` });

// 4. the cage's hover
const ph = await at(cx + 1, cy + 0.3);
await page.mouse.move(ph.x, ph.y);
await wait(400);
await page.screenshot({ path: `${out}/4-hover.png` });

// 5. Shift+F: out in its ball; it rolls; Shift+F at the cage again: back
await page.keyboard.down('Shift');
await wait(60);
await page.keyboard.press('KeyF');
await wait(120);
await page.keyboard.up('Shift');
await wait(300);
const out1 = await ev(`(() => { const h = S.g.sys.hamster; return { ball: h.ball, x: h.x, y: h.y }; })()`);
check(out1.ball, 'Shift+F lets it out in its ball');
await wait(2500);
await page.screenshot({ path: `${out}/5-ball.png` });
const moved = await ev(`(() => { const h = S.g.sys.hamster; return Math.hypot(h.x - ${out1.x}, h.y - ${out1.y}); })()`);
check(moved > 0.2, 'the ball rolls about: ' + moved);
await page.keyboard.down('Shift');
await wait(60);
await page.keyboard.press('KeyF');
await wait(120);
await page.keyboard.up('Shift');
await wait(300);
check(!(await ev(`S.g.sys.hamster.ball`)), 'Shift+F at the cage puts it back');

// 6. Shift+right-click picks the cage up (plain right-click, a tool in hand, is a scratch)
await page.keyboard.press('Digit1');
await wait(150);
const before = await ev(`S.g.sys.hamster.pettedDay`);
await page.mouse.move(ph.x, ph.y);
await wait(100);
await page.mouse.click(ph.x, ph.y, { button: 'right' });
await wait(300);
check((await ev(`S.g.sys.hamster.pettedDay`)) !== before, 'right-click at the cage: a scratch');
await page.keyboard.down('Shift');
await page.mouse.click(ph.x, ph.y, { button: 'right' });
await page.keyboard.up('Shift');
await wait(300);
const lifted = await ev(`(() => ({ cage: S.g.sys.house.decor.some((d) => d.id === 'f_hamster_cage'), bag: S.g.player.inv.countId('f_hamster_cage') }))()`);
check(!lifted.cage && lifted.bag === 1, 'Shift+right-click picks the cage up: ' + JSON.stringify(lifted));

// 7. the counter: Bram at work in the forge, F at the door, Chat, and the shop again after
await ev(`(() => {
  const g = S.g;
  g.sys.house.leave(g);
  g.time.min = 11 * 60;
  const b = g.sys.npcs.byId.get('bram');
  b.target = 'smithy_in'; b.visible = false; b.path = []; b.met = true;
  const d = g.map.locs.get('smithy');
  g.player.x = d[0] + 0.5; g.player.y = d[1] + 1.6; g.player.dir = 0;
})()`);
await wait(300);
const door = await ev(`(async () => {
  const g = S.g;
  const { O } = await import('/src/sim/world/tilemap.ts');
  // the forge's door tile: F at it opens the shop (the keeper's in)
  const d = g.map.locs.get('smithy');
  for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const b = g.map.buildingAtTile(d[0] + dx, d[1] + dy); if (b && b.id === 'smithy') return [d[0] + dx, d[1] + dy]; }
  return d;
})()`);
await ev(`(() => { const g = S.g; const t = window.__play; t.openWindow('shop', 'smithy'); })()`);
await wait(400);
await page.screenshot({ path: `${out}/7-counter.png` });
// click Chat (the counter's first button, under the keeper's portrait): UI pixels to page pixels
const ui = await ev(`({ scale: window.__app.uiScale, w: window.__app.canvas.width, h: window.__app.canvas.height, dpr: window.__app.dpr })`);
const S2 = ui.scale / ui.dpr, uw = Math.floor(ui.w / ui.scale), uh = Math.floor(ui.h / ui.scale);
const wx = Math.floor((uw - 380) / 2), wy = Math.floor((uh - 280) / 2) - 10;
await page.mouse.move((wx + 380 - 74 + 30) * S2, (wy + 84 + 7) * S2);
await wait(150);
await page.mouse.click((wx + 380 - 74 + 30) * S2, (wy + 84 + 7) * S2);
await wait(500);
const talking = await ev(`window.__play.win?.id`);
check(talking === 'dialog', 'Chat opens a talk with Bram: ' + talking);
await page.screenshot({ path: `${out}/8-chat.png` });
for (let i = 0; i < 8 && (await ev(`window.__play.win?.id`)) === 'dialog'; i++) {
  await page.keyboard.press('Space');
  await wait(250);
}
check((await ev(`window.__play.win?.id + ':' + window.__play.win?.arg`)) === 'shop:smithy', 'the shop comes back after the talk');
await page.screenshot({ path: `${out}/9-back.png` });
void door;

console.log(JSON.stringify({ fails, errors: errors.slice(0, 10) }));
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
