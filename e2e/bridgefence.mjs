// Bridges and fences on screen (the owner's 2.0 playtest: "go over all the bridges and make sure they
// are seamless ... as well as the fences: they aren't rotated where they need to be"). Shoots every
// plank run on the world map (both river bridges, the lake dock, the pier, the riverside farm's four
// bridges), Plank Walks on land and at the pond, the ranch paddock's fence, and a test layout of
// placed wood fences, stone walls and gates (a closed rectangle with a gate in a horizontal and a
// vertical side, an L, a T, a cross, a lone post), at the game's zoom for 1280x720 (2) and close up (4).
//   BASE=http://localhost:5173/ OUT=e2e/out/bridges-fences/after node e2e/bridgefence.mjs
// Each shot is the whole window; `<name>.crop.png` is the middle 640x440 of a close-up (zoom 4).
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = process.env.OUT ?? 'e2e/out/bridges-fences/shots';
const only = process.argv[2]?.split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await page.waitForTimeout(800);

const LOOK = { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 };
const TIPS = ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_stray', 'tip_depot', 'tip_furniture', 'tip_perkhint', 'tip_quickstack', 'tip_bots'];
/** start a fresh game on this farm kind, at noon in spring, with the opening's cards out of the way */
async function newGame(farm) {
  await page.evaluate(async ({ farm, LOOK, TIPS }) => {
    const g = new window.__Game({ seed: 1, name: 'Robin', farmName: 'Willow', farm });
    for (const t of TIPS) g.flags.add(t);
    window.__app.startGame(g, LOOK);
    window.__T = (await import('/src/sim/world/tilemap.ts')).T;
    window.__O = (await import('/src/sim/world/tilemap.ts')).O;
    window.__build = await import('/src/sim/build.ts');
  }, { farm, LOOK, TIPS });
  await page.waitForTimeout(900);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}
/** put the player somewhere out of the way and the camera on (x, y) at this zoom, then shoot */
async function shot(name, x, y, zoom, season = 0) {
  if (only && !only.some((o) => name.startsWith(o))) return;
  await page.mouse.move(1279, 719); // park the mouse in a corner so hover tooltips stay out of the way
  await page.evaluate(({ x, y, zoom, season }) => {
    const g = window.__game, r = window.__app.renderer, play = window.__play;
    play.win = null;
    play.hud.toasts = [];
    play.lessons.q = [];
    g.time.min = 12 * 60;
    g.time.season = season;
    g.player.x = x + 0.5; g.player.y = y - 30; // off screen (the camera does not follow while we hold it)
    r.cam.x = x; r.cam.y = y; r.cam.zoom = r.cam.targetZoom = zoom;
    window.__hold = { x, y, zoom };
    r.invalidateAll();
  }, { x, y, zoom, season });
  await page.waitForTimeout(500);
  // hold the camera (the play screen's follow would pull it back to the player)
  await page.evaluate(() => { const r = window.__app.renderer, h = window.__hold; r.cam.x = h.x; r.cam.y = h.y; r.cam.zoom = r.cam.targetZoom = h.zoom; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (zoom >= 4) await page.screenshot({ path: `${out}/${name}.crop.png`, clip: { x: 320, y: 140, width: 640, height: 440 } });
}
// the camera follows the player each frame: freeze it on the held point
await page.evaluate(() => {
  const r = window.__app.renderer;
  const follow = r.cam.follow.bind(r.cam);
  r.cam.follow = (tx, ty, dt, snap) => { const h = window.__hold; if (h) { r.cam.x = h.x; r.cam.y = h.y; r.cam.zoom = r.cam.targetZoom = h.zoom; return; } follow(tx, ty, dt, snap); };
});

// ---- the classic map: both river bridges, the lake dock, the pier, the ranch paddock ----
await newGame('classic');
const runs = [
  ['bridge-north', 94.5, 45.5],
  ['bridge-south', 102.5, 89.5],
  ['dock', 153, 29],
  ['pier-top', 139.5, 127.5],
  ['pier-end', 139.5, 139],
];
for (const [n, x, y] of runs) {
  await shot(`${n}-z2`, x, y, 2);
  await shot(`${n}-z4`, x, y, 4);
}
await shot('pier-z2-whole', 139.5, 133, 2);
await shot('bridge-north-winter-z4', 94.5, 45.5, 4, 3);
await shot('paddock-z2', 164.5, 96, 2);
await shot('paddock-z4-west', 160.5, 95.5, 4);
await shot('paddock-z4-east', 168.5, 95.5, 4);
await shot('paddock-winter-z4-west', 160.5, 95.5, 4, 3);

// ---- placed fences, walls and gates, and Plank Walks (on the classic farm) ----
await page.evaluate(() => {
  const g = window.__game, m = g.map, T = window.__T, O = window.__O, B = window.__build;
  for (let y = 48; y <= 80; y++) for (let x = 56; x <= 90; x++) {
    const i = m.idx(x, y);
    if (m.ground[i] === T.POND) continue;
    m.setO(x, y, O.NONE); m.trees.delete(i); g.soil.delete(i); m.setG(x, y, T.GRASS);
    const e = g.ents.at(x, y); if (e) g.ents.remove(e);
  }
  const put = (id, pts) => { for (const [x, y] of pts) B.place(g, id, x, y, 0); };
  const rect = (x0, y0, x1, y1) => { const p = []; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x === x0 || x === x1 || y === y0 || y === y1) p.push([x, y]); return p; };
  for (const [fam, oy] of [['fence_wood', 50], ['fence_stone', 59]]) {
    // a closed rectangle with a gate in its top (horizontal) side and one in its left (vertical) side
    put(fam, rect(58, oy, 63, oy + 5).filter(([x, y]) => !(x === 60 && y === oy) && !(x === 58 && y === oy + 2)));
    put('gate', [[60, oy], [58, oy + 2]]);
    // an L, a T, a cross, a lone post
    put(fam, [[66, oy], [66, oy + 1], [66, oy + 2], [67, oy + 2], [68, oy + 2]]);
    put(fam, [[70, oy], [71, oy], [72, oy], [73, oy], [74, oy], [72, oy + 1], [72, oy + 2]]);
    put(fam, [[76, oy + 2], [77, oy + 2], [78, oy + 2], [79, oy + 2], [80, oy + 2], [78, oy], [78, oy + 1], [78, oy + 3], [78, oy + 4]]);
    put(fam, [[83, oy + 2]]);
    // a long vertical run with a gate in it, and two gates side by side in a horizontal run
    put(fam, [[86, oy], [86, oy + 1], [86, oy + 3], [86, oy + 4], [86, oy + 5]]);
    put('gate', [[86, oy + 2]]);
    put(fam, [[66, oy + 5], [67, oy + 5], [70, oy + 5], [71, oy + 5]]);
    put('gate', [[68, oy + 5], [69, oy + 5]]);
  }
  // Plank Walks on grass (a lone tile, a line, an L, a 2x3 patch) and a jetty off the farm pond
  const walk = (pts) => { for (const [x, y] of pts) m.setG(x, y, T.PLANKS); };
  walk([[58, 69]]);
  walk([[61, 69], [62, 69], [63, 69], [64, 69]]);
  walk([[67, 68], [67, 69], [67, 70], [68, 70], [69, 70]]);
  walk([[72, 68], [73, 68], [72, 69], [73, 69], [72, 70], [73, 70]]);
  walk([[76, 68], [76, 69], [76, 70], [76, 71], [76, 72]]);
  window.__app.renderer.invalidateAll();
});
await shot('placed-z2', 72, 57.5, 2);
await shot('placed-wood-z4', 64, 52.5, 4);
await shot('placed-wood2-z4', 78, 52.5, 4);
await shot('placed-stone-z4', 64, 61.5, 4);
await shot('placed-stone2-z4', 78, 61.5, 4);
await shot('placed-walks-z4', 67, 70, 4);
await shot('placed-winter-z4', 64, 52.5, 4, 3);
// the farm pond's edge: a Plank Walk jetty out over the water
const pond = await page.evaluate(() => {
  const g = window.__game, m = g.map, T = window.__T;
  let best = null;
  for (let y = 24; y < 38; y++) for (let x = 74; x < 92; x++) if (m.g(x, y) === T.POND && m.g(x, y + 1) !== T.POND && !best) best = [x, y];
  if (!best) return null;
  const [x, y] = best;
  for (let k = -1; k <= 3; k++) m.setG(x, y + 1 - k, T.PLANKS);
  m.setO(x, y + 2, 0); m.setO(x, y + 3, 0);
  window.__app.renderer.invalidateAll();
  return best;
});
if (pond) await shot('pond-jetty-z4', pond[0] + 0.5, pond[1] + 0.5, 4);

// ---- the riverside farm's four bridges over its stream ----
await newGame('riverside');
for (const [n, x, y] of [['riverside-30', 64.5, 31], ['riverside-57', 68, 58], ['riverside-84', 65, 85], ['riverside-110', 71, 111]]) {
  await shot(`${n}-z2`, x, y, 2);
  await shot(`${n}-z4`, x, y, 4);
}
console.log(`bridge and fence shots in ${out}; errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(e);
await browser.close();
