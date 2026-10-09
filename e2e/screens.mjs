// Screenshot sweep + overlap audit: every screen and window in a scripted state, one PNG each.
// For each shot the UI's overlap audit (src/ui/audit.ts) lists texts that clash, overflow their
// panel/button or get painted over; shots with issues also get a <name>.issues.png with the
// problems boxed. Results: e2e/out/screens/ (report.md, report.json, PNGs). The previous run is
// kept in e2e/out/screens-prev/ for comparison.
//
// Usage: npm run screens                  (all shots, against http://localhost:5173/)
//        npm run screens -- title,crafting (only these)
//        BASE=http://127.0.0.1:5174/ npm run screens
import { chromium } from 'playwright';
import fs from 'node:fs';

const only = process.argv[2]?.split(',');
const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/screens', prev = 'e2e/out/screens-prev';
if (!only && fs.existsSync(out)) {
  fs.rmSync(prev, { recursive: true, force: true });
  fs.renameSync(out, prev);
}
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const ev = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(base);
await page.waitForFunction(() => window.__app?.screen?.demo);
await ev(async () => {
  window.__app.ui.audit = true;
  window.__audit = await import('/src/ui/audit.ts');
  window.__itemIndex = (await import('/src/data/items.ts')).ITEM_INDEX;
  window.__build = await import('/src/sim/build.ts');
  window.__O = (await import('/src/sim/world/tilemap.ts')).O;
  window.__house = await import('/src/sim/systems/house.ts');
  window.__mine = await import('/src/sim/systems/mine.ts');
});

const report = [];
/** Screenshot the current state, run the overlap audit on the last frame, box any issues. */
async function shot(name) {
  await page.mouse.move(1279, 719); // park the mouse in a corner so hover tooltips stay out of the way
  await wait(450);
  await page.screenshot({ path: `${out}/${name}.png` });
  const { issues, k } = await ev(() => {
    const ui = window.__app.ui;
    return { issues: window.__audit.findIssues(ui.lastAudit, { w: ui.w, h: ui.h }), k: window.__app.uiScale / window.__app.dpr };
  });
  report.push({ name, issues });
  if (issues.length) {
    await ev(({ issues, k }) => {
      const root = document.createElement('div');
      root.id = '__auditOverlay';
      root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99';
      const col = { clash: '#ff2d55', overflow: '#ff9500', covered: '#00c7ff' };
      for (const i of issues)
        for (const [r, dashed] of [[i.rect, false], [i.otherRect, true]]) {
          if (!r) continue;
          const b = document.createElement('div');
          b.style.cssText = `position:absolute;left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px;outline:2px ${dashed ? 'dashed' : 'solid'} ${col[i.type]}`;
          root.appendChild(b);
        }
      document.body.appendChild(root);
    }, { issues, k });
    await page.screenshot({ path: `${out}/${name}.issues.png` });
    await ev(() => document.getElementById('__auditOverlay')?.remove());
  }
  console.log(`${issues.length ? '!' : ' '} ${name}${issues.length ? `  (${issues.length} issue${issues.length > 1 ? 's' : ''})` : ''}`);
}

const clearArea = `(x0, y0, x1, y1) => { const g = window.__game; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.map.setO(x, y, window.__O.NONE); }`;
const S = `window.S = { g: window.__game, play: window.__play, key: (id, q = 0) => window.__itemIndex.get(id) * 4 + q };`;
const ALL_TIPS = ['tip_welcome', 'tip_hoe', 'tip_seeds', 'tip_can', 'tip_place', 'tip_lab', 'tip_belts', 'tip_machine', 'tip_power', 'tip_mine', 'tip_fish', 'tip_blueprint', 'tip_energy', 'tip_night', 'tip_home', 'tip_stray', 'tip_depot', 'tip_furniture', 'tip_perkhint', 'tip_quickstack', 'tip_bots'];

// name -> async setup. Run in order; each starts from where the previous left off.
const SC = {
  // ---- title and new game ----
  title: async () => {},
  'title-settings': async () => ev(() => { window.__app.screen.mode = 'settings'; }),
  'newgame-who': async () => ev(() => { const s = window.__app.screen; s.mode = 'new'; s.newGame.name = 'Robin'; s.newGame.farm = 'Willowbrook'; }),
  'newgame-where': async () => ev(() => { window.__app.screen.newGame.step = 'where'; }),
  // ---- first morning, as a new player sees it ----
  welcome: async () => {
    await ev(() => window.__app.startGame(new window.__Game({ seed: 999, name: 'Robin', farmName: 'Willowbrook' }), { skin: 5, hair: 9, hairStyle: 'braids', shirt: 15, pants: 19, accent: 28 }));
    await wait(1500);
    await ev(S);
  },
  'first-morning': async () => ev(`(() => { S.play.closeWindow(); })()`),
  'toast-over-window': async () => ev(`(() => { S.play.toast('Tip: Right-click a machine to load it: it takes what you hold, or a matching ingredient from your bag.'); S.play.openWindow('menu', 'crafting'); })()`),
  // from here on, no tutorial tips (shots stay deterministic)
  inventory: async () => ev(`(() => { S.play.closeWindow(); for (const t of ${JSON.stringify(ALL_TIPS)}) S.g.flags.add(t); S.g.player.inv.add(S.key('wood'), 120); S.g.player.inv.add(S.key('strawberry', 2), 7); S.g.player.inv.add(S.key('copper_ore'), 33); S.play.openWindow('menu', 'inventory'); })()`),
  crafting: async () => ev(`(() => { S.g.player.inv.add(S.key('stone'), 100); S.play.openWindow('menu', 'crafting'); S.play.win.data.sel = 'hand:chest_wood'; })()`),
  skills: async () => ev(`(() => { S.g.player.skills.farming = 3; S.g.player.xp.farming = 900; S.play.openWindow('menu', 'skills'); })()`),
  // ---- structures ----
  machine: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_brewing'); const e = window.__build.place(g, 'keg', 52, 27, 0); e.mach.inBuf.set(S.key('strawberry'), 2); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  oven: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_cooking'); const e = window.__build.place(g, 'oven', 52, 27, 0); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  chest: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); const e = window.__build.place(g, 'chest_wood', 54, 27, 0); e.inv.add(S.key('wood'), 300); e.inv.add(S.key('copper_ore'), 40); e.inv.add(S.key('strawberry', 2), 12); g.player.x = 54.5; g.player.y = 29; S.play.openWindow('struct', e.id); })()`),
  lab: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 34); g.flags.add('lab'); const e = window.__build.place(g, 'lab', 50, 28, 0); e.inv.add(S.key('bundle_green'), 6); g.research.current = 'r_belts'; g.player.x = 51; g.player.y = 31; S.play.openWindow('struct', e.id); })()`),
  power: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 36); g.research.done.add('r_milling'); window.__build.place(g, 'windmill', 46, 28, 0); window.__build.place(g, 'pole_wood', 49, 29, 0); const mill = window.__build.place(g, 'mill', 50, 29, 0); mill.mach.inBuf.set(S.key('wheat'), 2); g.player.x = 48; g.player.y = 33; for (let i = 0; i < 300; i++) g.tick(); S.play.openWindow('struct', g.ents.at(49, 29).id); })()`),
  coop: async () => ev(`(() => { const g = S.g; (${clearArea})(60, 26, 72, 40); const e = window.__build.place(g, 'coop_1', 62, 28, 0); g.player.money = 99999; g.sys.animals.buy(g, 'chicken'); g.sys.animals.buy(g, 'chicken'); e.st.hay = 12; e.inv.add(S.key('egg', 1), 3); g.time.min = 11 * 60; for (let i = 0; i < 120; i++) g.tick(); g.player.x = 64; g.player.y = 33; S.play.openWindow('struct', e.id); })()`),
  build: async () => {
    await ev(`(() => { const g = S.g; S.play.closeWindow(); (${clearArea})(48, 26, 60, 32); g.research.done.add('r_belts'); g.player.inv.slots[11] = { k: S.key('belt_1'), n: 50 }; g.player.sel = 11; g.player.x = 52; g.player.y = 30; })()`);
    const p = await ev(() => { const r = window.__app.renderer; return { s: r.tileToScreen(50.5, 28.5), e: r.tileToScreen(57.5, 28.5), d: window.__app.dpr }; });
    await page.mouse.move(p.s.x / p.d, p.s.y / p.d);
    await page.mouse.down();
    await page.mouse.move(p.e.x / p.d, p.e.y / p.d, { steps: 6 });
    await page.screenshot({ path: `${out}/build.png` }); // mid-drag; shot() would release the mouse
    await page.mouse.up();
  },
  // ---- town and menus ----
  shop: async () => ev(`(() => { S.play.openWindow('shop', 'general'); })()`),
  smithy: async () => ev(`(() => { S.play.openWindow('shop', 'smithy'); S.play.win.data.tab = 'Upgrades'; })()`),
  carpenter: async () => ev(`(() => { S.play.openWindow('shop', 'carpenter'); S.play.win.data.tab = 'Buildings'; })()`),
  ranch: async () => ev(`(() => { S.play.openWindow('shop', 'ranch'); S.play.win.data.tab = 'Animals'; })()`),
  map: async () => ev(`(() => { S.play.openWindow('map'); })()`),
  restoration: async () => ev(`(() => { S.play.openWindow('restoration'); })()`),
  board: async () => ev(`(() => { S.play.openWindow('board'); })()`),
  museum: async () => ev(`(() => { S.g.player.inv.add(S.key('amethyst'), 1); S.g.player.inv.add(S.key('old_cog'), 1); S.play.openWindow('museum'); })()`),
  friends: async () => ev(`(() => { let i = 0; for (const n of S.g.sys.npcs.list) { n.met = true; n.points = (i++ * 377) % 1500; } S.play.openWindow('journal'); S.play.win.data.tab = 'friends'; })()`),
  collections: async () => ev(`(() => { S.play.openWindow('journal'); S.play.win.data.tab = 'collect'; S.play.win.data.sub = 'fish'; })()`),
  journal: async () => ev(`(() => { S.play.openWindow('journal'); })()`),
  achievements: async () => ev(`(() => { S.play.openWindow('achievements'); })()`),
  mail: async () => ev(`(() => { S.play.openWindow('mail'); })()`),
  stats: async () => ev(`(() => { const g = S.g; for (let i = 0; i < 400; i++) { g.stats.add(S.key('wood'), 1); g.stats.add(S.key('stone'), 2); g.stats.use(S.key('wood'), 1); g.tick(); } S.play.openWindow('stats'); })()`),
  research: async () => ev(`(() => { S.g.research.done.add('r_belts'); S.g.research.done.add('r_preserves'); S.play.openWindow('research'); S.play.win.data.sel = 'r_arms'; })()`),
  perk: async () => ev(`(() => { S.g.player.skills.farming = 5; S.play.openWindow('perk'); })()`),
  pause: async () => ev(`(() => { S.play.openWindow('pause'); })()`),
  settings: async () => ev(`(() => { S.play.openWindow('pause'); S.play.win.data.settings = true; })()`),
  help: async () => ev(`(() => { S.play.openWindow('pause'); S.play.win.data.help = true; })()`),
  // ---- places, seasons, weather ----
  'farm-summer': async () => ev(`(() => { const g = S.g; S.play.closeWindow(); g.time.season = 1; g.weather = 'sun'; g.player.x = 54; g.player.y = 31; g.time.min = 10 * 60; window.__app.renderer.invalidateAll(); })()`),
  'farm-fall': async () => ev(`(() => { const g = S.g; g.time.season = 2; window.__app.renderer.invalidateAll(); })()`),
  'farm-winter': async () => ev(`(() => { const g = S.g; g.time.season = 3; g.weather = 'snow'; window.__app.renderer.invalidateAll(); })()`),
  'farm-night': async () => ev(`(() => { const g = S.g; g.time.season = 0; g.weather = 'sun'; g.time.min = 22 * 60; window.__app.renderer.invalidateAll(); })()`),
  'town-storm': async () => ev(`(() => { const g = S.g; g.weather = 'storm'; g.player.x = 133; g.player.y = 64; g.time.min = 15 * 60; })()`),
  house: async () => ev(`(() => { const g = S.g; g.weather = 'sun'; g.time.min = 19 * 60; window.__house.enterHouse(g); })()`),
  mine: async () => ev(`(() => { const g = S.g; g.time.min = 11 * 60; window.__mine.enterFloor(g, 3); })()`),
  summary: async () => ev(`(() => { const g = S.g; g.player.where = 'world'; g.player.x = 54; g.player.y = 31; const bin = g.ents.get(g.shipBinId); bin.inv.add(S.key('radish'), 20); bin.inv.add(S.key('strawberry', 2), 5); bin.inv.add(S.key('wine_grape'), 2); g.goToBed(); g.time.min = 1559.99; g.tick(); })()`),
};

for (const [name, fn] of Object.entries(SC)) {
  if (only && !only.includes(name) && !['welcome'].includes(name)) continue;
  try {
    await fn();
    if (name !== 'build') await shot(name);
    else console.log('  build (mid-drag, not audited)');
  } catch (e) {
    console.log(`x ${name}: FAILED ${e.message.split('\n')[0]}`);
    report.push({ name, failed: e.message.split('\n')[0] });
  }
}

// ---- report ----
const count = (t) => report.reduce((n, r) => n + (r.issues?.filter((i) => i.type === t).length ?? 0), 0);
const lines = [
  `# Screens sweep`,
  ``,
  `${report.length} shots, ${count('clash')} clash, ${count('overflow')} overflow, ${count('covered')} covered, ${errors.length} console errors/warnings.`,
  ``,
  `clash: two texts overlap. overflow: text runs past the panel/button it starts in. covered: something drawn later paints over the text.`,
  `Boxes in *.issues.png: red = clash, orange = overflow, blue = covered; dashed = the other element.`,
  ``,
];
for (const r of report) {
  if (r.failed) { lines.push(`## ${r.name}: FAILED`, '', r.failed, ''); continue; }
  if (!r.issues.length) continue;
  lines.push(`## ${r.name} (${r.issues.length})`, '');
  for (const i of r.issues) lines.push(`- **${i.type}** "${i.text}" at ${i.rect.x},${i.rect.y}${i.other ? ` vs ${i.type === 'clash' ? `"${i.other}"` : i.other}${i.otherRect ? ` at ${i.otherRect.x},${i.otherRect.y}` : ''}` : ''}`);
  lines.push('');
}
if (errors.length) lines.push('## Console', '', ...errors.slice(0, 40).map((e) => '- ' + e.split('\n')[0]), '');
fs.writeFileSync(`${out}/report.md`, lines.join('\n'));
fs.writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 1));
console.log(`\n${lines[2]}\nReport: ${out}/report.md`);
await browser.close();
