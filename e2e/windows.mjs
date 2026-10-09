// Screenshot every major window/interaction in a scripted state.
import { chromium } from 'playwright';
import fs from 'node:fs';

const only = process.argv[2]?.split(',');
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = 'e2e/out/win';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(base);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 999, name: 'Robin', farmName: 'Willow' });
  for (const id of ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy']) g.flags.add(id);
  window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
});
await page.waitForTimeout(600);
const ev = (f, a) => page.evaluate(f, a);
const setup = `
  window.S = {
    g: window.__game, play: window.__play,
    key: (id, q = 0) => { const I = window.__itemIndex; return I.get(id) * 4 + q; },
  };`;
await ev(setup);
await ev(async () => {
  const items = await import('/src/data/items.ts');
  window.__itemIndex = items.ITEM_INDEX;
  window.__build = await import('/src/sim/build.ts');
  window.__O = (await import('/src/sim/world/tilemap.ts')).O;
});
const clearArea = `(x0, y0, x1, y1) => { const g = window.__game; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.map.setO(x, y, window.__O.NONE); }`;
const SC = {
  machine: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_brewing'); const e = window.__build.place(g, 'keg', 52, 27, 0); e.mach.inBuf.set(S.key('strawberry'), 2); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  oven: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_cooking'); const e = window.__build.place(g, 'oven', 52, 27, 0); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  chest: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); const e = window.__build.place(g, 'chest_wood', 54, 27, 0); e.inv.add(S.key('wood'), 300); e.inv.add(S.key('copper_ore'), 40); e.inv.add(S.key('strawberry', 2), 12); g.player.x = 54.5; g.player.y = 29; S.play.openWindow('struct', e.id); })()`),
  lab: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 34); g.flags.add('lab'); const e = window.__build.place(g, 'lab', 50, 28, 0); e.inv.add(S.key('bundle_green'), 6); g.research.current = 'r_belts'; g.player.x = 51; g.player.y = 31; S.play.openWindow('struct', e.id); })()`),
  power: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 36); g.research.done.add('r_milling'); window.__build.place(g, 'windmill', 46, 28, 0); window.__build.place(g, 'pole_wood', 49, 29, 0); const mill = window.__build.place(g, 'mill', 50, 29, 0); mill.mach.inBuf.set(S.key('wheat'), 2); g.player.x = 48; g.player.y = 33; for (let i = 0; i < 300; i++) g.tick(); const p = g.ents.at(49, 29); S.play.openWindow('struct', p.id); })()`),
  coop: async () => ev(`(() => { const g = S.g; (${clearArea})(60, 26, 72, 40); const e = window.__build.place(g, 'coop_1', 62, 28, 0); g.player.money = 99999; g.sys.animals.buy(g, 'chicken'); g.sys.animals.buy(g, 'chicken'); e.st.hay = 12; e.inv.add(S.key('egg', 1), 3); g.time.min = 11 * 60; for (let i = 0; i < 120; i++) g.tick(); g.player.x = 64; g.player.y = 33; S.play.openWindow('struct', e.id); })()`),
  coopworld: async () => ev(`(() => { const g = S.g; S.play.win = null; g.player.x = 64; g.player.y = 34; g.time.min = 11 * 60; })()`),
  shop: async () => ev(`(() => { S.play.openWindow('shop', 'general'); })()`),
  smithy: async () => ev(`(() => { const w = S.play.openWindow('shop', 'smithy'); S.play.win.data.tab = 'Upgrades'; })()`),
  carpenter: async () => ev(`(() => { S.play.openWindow('shop', 'carpenter'); S.play.win.data.tab = 'Buildings'; })()`),
  ranch: async () => ev(`(() => { S.play.openWindow('shop', 'ranch'); S.play.win.data.tab = 'Animals'; })()`),
  map: async () => ev(`(() => { S.play.openWindow('map'); })()`),
  restoration: async () => ev(`(() => { S.play.openWindow('restoration'); })()`),
  board: async () => ev(`(() => { S.play.openWindow('board'); })()`),
  museum: async () => ev(`(() => { S.g.player.inv.add(S.key('amethyst'), 1); S.g.player.inv.add(S.key('old_cog'), 1); S.play.openWindow('museum'); })()`),
  friends: async () => ev(`(() => { for (const n of S.g.sys.npcs.list) { n.met = true; n.points = Math.floor(Math.random() * 1500); } S.play.openWindow('journal'); S.play.win.data.tab = 'friends'; })()`),
  collections: async () => ev(`(() => { S.play.openWindow('journal'); S.play.win.data.tab = 'collect'; S.play.win.data.sub = 'fish'; })()`),
  mail: async () => ev(`(() => { S.play.openWindow('mail'); })()`),
  stats: async () => ev(`(() => { const g = S.g; for (let i = 0; i < 400; i++) { g.stats.add(S.key('wood'), 1); g.stats.add(S.key('stone'), 2); g.stats.use(S.key('wood'), 1); g.tick(); } S.play.openWindow('stats'); })()`),
  research: async () => ev(`(() => { S.g.research.done.add('r_belts'); S.g.research.done.add('r_preserves'); S.play.openWindow('research'); S.play.win.data.sel = 'r_arms'; })()`),
  crafting: async () => ev(`(() => { S.g.player.inv.add(S.key('wood'), 100); S.g.player.inv.add(S.key('stone'), 100); S.play.openWindow('menu', 'crafting'); S.play.win.data.sel = 'hand:chest_wood'; })()`),
  skills: async () => ev(`(() => { S.g.player.skills.farming = 3; S.g.player.xp.farming = 900; S.play.openWindow('menu', 'skills'); })()`),
  pause: async () => ev(`(() => { S.play.openWindow('pause'); })()`),
  settings: async () => ev(`(() => { S.play.openWindow('pause'); S.play.win.data.settings = true; })()`),
  summary: async () => ev(`(() => { const g = S.g; const bin = g.ents.get(g.shipBinId); bin.inv.add(S.key('radish'), 20); bin.inv.add(S.key('strawberry', 2), 5); bin.inv.add(S.key('wine_grape'), 2); g.goToBed(); g.time.min = 1559.99; g.tick(); })()`),
  fishing: async () => {
    await ev(`(() => { const g = S.g; S.play.win = null; g.player.x = 80; g.player.y = 34.5; g.player.dir = 0; const f = g.sys.fishing; f.water = 'pond'; f.state = 'bite'; f.bx = 82; f.by = 31; g.player.inv.add(S.key('rod_1'), 1); const i = g.player.inv.slots.findIndex((s) => s && s.k === S.key('rod_1')); g.player.sel = i; f.press(g); })()`);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(300);
  },
  festival: async () => {
    await ev(`(() => { const g = S.g; S.play.win = null; S.play.openWindow('festival', 'f_kite'); S.play.win.data.mode = 'play'; })()`);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(600);
  },
  skate: async () => {
    await ev(`(() => { S.play.win = null; S.play.openWindow('festival', 'f_skate'); S.play.win.data.mode = 'play'; })()`);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyD');
  },
  build: async () => {
    await ev(`(() => { const g = S.g; S.play.win = null; (${clearArea})(48, 26, 60, 32); g.research.done.add('r_belts'); g.player.inv.slots[11] = { k: S.key('belt_1'), n: 50 }; g.player.sel = 11; g.player.x = 52; g.player.y = 30; })()`);
    const p = await ev(`(() => { const r = window.__app.renderer; const s = r.tileToScreen(50.5, 28.5); const e = r.tileToScreen(57.5, 28.5); return { s, e, d: window.__app.dpr }; })()`);
    await page.mouse.move(p.s.x / p.d, p.s.y / p.d);
    await page.mouse.down();
    await page.mouse.move(p.e.x / p.d, p.e.y / p.d, { steps: 6 });
    await page.waitForTimeout(300);
  },
  rain: async () => ev(`(() => { const g = S.g; S.play.win = null; g.weather = 'storm'; g.player.x = 133; g.player.y = 64; g.time.min = 15 * 60; })()`),
  snowtown: async () => ev(`(() => { const g = S.g; g.weather = 'snow'; g.time.season = 3; g.player.x = 133; g.player.y = 70; g.time.min = 13 * 60; window.__app.renderer.invalidateAll(); })()`),
  festivalday: async () => ev(`(() => { const g = S.g; g.weather = 'sun'; g.time.season = 0; g.time.day = 13; g.time.min = 10 * 60; g.player.x = 133; g.player.y = 66; for (const s of window.__sysList ?? []) void s; window.__app.renderer.invalidateAll(); g.sys.festivals.active = null; g.endDay; })()`),
};
for (const [name, fn] of Object.entries(SC)) {
  if (only && !only.includes(name)) continue;
  try {
    await page.mouse.up().catch(() => {});
    await ev(`(() => { if (S.play.win && !['summary'].includes('${name}')) S.play.win = null; })()`);
    await fn();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log('shot', name);
  } catch (e) {
    console.log('FAILED', name, e.message.split('\n')[0]);
  }
}
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log('errors:', errors.length);
for (const e of errors.slice(0, 20)) console.log(e);
await browser.close();
