// Screenshot sweep + overlap audit: every screen and window in a scripted state, one PNG each.
// For each shot the UI's overlap audit (src/ui/audit.ts) lists texts that clash, overflow their
// panel/button or get painted over; shots with issues also get a <name>.issues.png with the
// problems boxed. Results: e2e/out/screens/ (report.md, report.json, PNGs). The previous run is
// kept in e2e/out/screens-prev/ for comparison.
//
// Usage: npm run screens                  (all shots, against http://localhost:5173/)
//        npm run screens -- title,crafting (only these)
//        BASE=http://127.0.0.1:5174/ npm run screens
//        VIEW=1366x620 npm run screens   (another window size; writes e2e/out/screens-1366x620/)
import { chromium } from 'playwright';
import fs from 'node:fs';

const only = process.argv[2]?.split(',');
const base = process.env.BASE ?? 'http://localhost:5173/';
const view = process.env.VIEW;
const [VW, VH] = (view ?? '1280x720').split('x').map(Number);
const out = view ? `e2e/out/screens-${view}` : 'e2e/out/screens', prev = out + '-prev';
if (!only && fs.existsSync(out)) {
  fs.rmSync(prev, { recursive: true, force: true });
  fs.renameSync(out, prev);
}
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
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
  window.__npcs = await import('/src/sim/systems/npcs.ts');
});

const report = [];
/** Screenshot the current state, run the overlap audit on the last frame, box any issues. */
async function shot(name) {
  await page.mouse.move(VW - 1, VH - 1); // park the mouse in a corner so hover tooltips stay out of the way
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
// the Orders board (2.0 Phase 3): two standing orders part filled, a Today ask, Rowan a rank up
const ORDERS = `(() => { const os = S.g.sys.orders; const d = S.g.dayIndex; if (!os.open.some((o) => o.kind === 'standing')) {
  os.open.push({ uid: os.uid++, kind: 'standing', def: 'rowan_pickles', cust: 'rowan', lines: [{ spec: 'pickles_cogbean', n: 6, have: 4 }], day: d, due: d + 2, unit: 150, silver: true, rep: 1 },
    { uid: os.uid++, kind: 'standing', def: 'bram_oil', cust: 'bram', lines: [{ spec: 'cogbean_oil', n: 6, have: 1 }], day: d, due: d + 365, unit: 0, rep: 1 },
    { uid: os.uid++, kind: 'today', def: 'req:juniper:wood', cust: 'juniper', lines: [{ spec: 'wood', n: 20, have: 0 }], day: d, due: d, pay: 300, rep: 1, text: 'Twenty logs for the joinery, if you have them.' });
  for (const c of ['rowan', 'bram', 'juniper']) if (!os.posted.includes(c)) os.posted.push(c);
  os.rep.rowan = 3; } })()`;
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
    await ev(() => window.__app.startGame(new window.__Game({ seed: 999, name: 'Robin', farmName: 'Willowbrook' }), { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 }));
    await wait(1500);
    await ev(S);
  },
  'first-morning': async () => ev(`(() => { S.play.closeWindow(); })()`),
  // the Keeper's Line: a lesson card under the Now strip (the first restore raises "The keeper's works")
  'lesson-card': async () => {
    await ev(`(() => { S.g.flags.add('lesson:rust'); S.g.emit({ t: 'lesson', id: 'rust' }); })()`);
    await wait(400);
  },
  // ---- Phase 3 overlays (the ribbon and streak are drawn through the UI kit, so audited) ----
  // facing down at a ripe bean: the key bubble hangs below it, clear of the player
  'prompt-harvest': async () => ev(`(() => { for (const t of ${JSON.stringify(ALL_TIPS)}) S.g.flags.add(t); S.play.hud.toasts = []; S.play.lessons.q = []; const g = S.g; g.player.x = 57.5; g.player.y = 25.9; g.player.dir = 2; })()`),
  // facing the keeper's crock with beans in the bag once oil is known: "F Load" with "Shift+F: recipes"
  'prompt-recipes': async () => ev(`(() => { const g = S.g; g.flags.add('recipe_cogbean_oil'); g.player.inv.add(S.key('cogbean'), 6); g.player.x = 54.5; g.player.y = 24.8; g.player.dir = 0; })()`),
  // zoomed in, a quest ribbon and a running harvest streak at the same time
  'streak-ribbon': async () => {
    await ev(`(() => { const r = S.play.app.renderer; window.__z = r.cam.targetZoom; r.cam.zoom = r.cam.targetZoom = 4; S.g.emit({ t: 'quest', title: 'Things That Move Themselves', money: 300, items: [] }); })()`);
    await wait(300);
    await ev(`(() => { S.play.app.renderer.juice.streak = { n: 7, t: 0, punch: 9 }; })()`);
  },
  // the longest research line, next to the quest tracker
  'ribbon-discovery': async () => {
    await ev(`(() => { const r = S.play.app.renderer; r.cam.zoom = r.cam.targetZoom = window.__z ?? 2; r.juice.banners = []; S.g.emit({ t: 'research', id: 'r_assembly2' }); })()`);
    await wait(300);
  },
  'toast-over-window': async () => ev(`(() => { const J = S.play.app.renderer.juice; J.banners = []; J.streak.t = 9; S.play.toast('Tip: Right-click a machine to load it: it takes what you hold, or a matching ingredient from your bag.'); S.play.openWindow('menu', 'crafting'); })()`),
  // from here on, no tutorial tips (shots stay deterministic)
  inventory: async () => ev(`(() => { S.play.closeWindow(); for (const t of ${JSON.stringify(ALL_TIPS)}) S.g.flags.add(t); S.g.player.inv.add(S.key('wood'), 120); S.g.player.inv.add(S.key('strawberry', 2), 7); S.g.player.inv.add(S.key('copper_ore'), 33); S.play.openWindow('menu', 'inventory'); })()`),
  crafting: async () => ev(`(() => { S.g.player.inv.add(S.key('stone'), 100); S.play.openWindow('menu', 'crafting'); S.play.win.data.sel = 'hand:chest_wood'; })()`),
  skills: async () => ev(`(() => { S.g.player.skills.farming = 3; S.g.player.xp.farming = 900; S.play.openWindow('menu', 'skills'); })()`),
  // the Keeper's Notebook: lessons seen so far, the Journal's first tab
  notebook: async () => ev(`(() => { for (const l of ['rust', 'arm', 'line', 'post', 'field', 'belt', 'starved']) S.g.flags.add('lesson:' + l); S.play.closeWindow(); S.play.openWindow('journal', 'notebook'); })()`),
  'notebook-machines': async () => ev(`(() => { S.play.win.data.page = 'machines'; })()`),
  // ---- structures ----
  machine: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_brewing'); const e = window.__build.place(g, 'keg', 52, 27, 0); e.mach.inBuf.set(S.key('strawberry'), 2); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  oven: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); g.research.done.add('r_cooking'); const e = window.__build.place(g, 'oven', 52, 27, 0); g.player.x = 52.5; g.player.y = 29.5; S.play.openWindow('struct', e.id); })()`),
  chest: async () => ev(`(() => { const g = S.g; (${clearArea})(50, 26, 56, 30); const e = window.__build.place(g, 'chest_wood', 54, 27, 0); e.inv.add(S.key('wood'), 300); e.inv.add(S.key('copper_ore'), 40); e.inv.add(S.key('strawberry', 2), 12); g.player.x = 54.5; g.player.y = 29; S.play.openWindow('struct', e.id); })()`),
  lab: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 34); g.flags.add('lab'); const e = window.__build.place(g, 'lab', 50, 28, 0); e.inv.add(S.key('bundle_green'), 6); g.research.current = 'r_belts'; g.player.x = 51; g.player.y = 31; S.play.openWindow('struct', e.id); })()`),
  power: async () => ev(`(() => { const g = S.g; (${clearArea})(44, 26, 60, 36); g.research.done.add('r_milling'); window.__build.place(g, 'windmill', 46, 28, 0); window.__build.place(g, 'pole_wood', 49, 29, 0); const mill = window.__build.place(g, 'mill', 50, 29, 0); mill.mach.inBuf.set(S.key('wheat'), 2); g.player.x = 48; g.player.y = 33; for (let i = 0; i < 300; i++) g.tick(); S.play.openWindow('struct', g.ents.at(49, 29).id); })()`),
  // the crate's "Ship to" tag (consignment) and its price tag on a flooded item
  'crate-tag': async () => ev(`(() => { const g = S.g; ${ORDERS}; const bin = g.ents.get(g.shipBinId); bin.st.tag = 'rowan'; bin.inv.add(S.key('pickles_cogbean'), 12); bin.inv.add(S.key('radish'), 5); g.sys.market.sat[window.__itemIndex.get('pickles_cogbean')] = 90; g.player.x = bin.x + 0.5; g.player.y = bin.y + 1.8; S.play.openWindow('struct', bin.id); })()`),
  // a crock locked to oil mid-batch: "Next batch: Cogbean Oil"
  'crock-oil': async () => ev(`(async () => { const g = S.g; const { RECIPES } = await import('/src/data/recipes.ts'); const M = await import('/src/sim/systems/machines.ts'); const e = g.ents.at(54, 23); e.mach.inBuf.set(S.key('cogbean'), 4); for (let i = 0; i < 120 && !e.mach.crafting; i++) g.tick(); M.setRecipe(g, e, RECIPES.find((r) => r.id === 'jar:cogbean_oil')); g.player.x = 54.5; g.player.y = 24.8; S.play.openWindow('struct', e.id); })()`),
  coop: async () => ev(`(() => { const g = S.g; (${clearArea})(60, 26, 72, 40); const e = window.__build.place(g, 'coop_1', 62, 28, 0); g.player.money = 99999; g.sys.animals.buy(g, 'chicken'); g.sys.animals.buy(g, 'chicken'); e.st.hay = 12; e.inv.add(S.key('egg', 1), 3); g.time.min = 11 * 60; for (let i = 0; i < 120; i++) g.tick(); g.player.x = 64; g.player.y = 33; S.play.openWindow('struct', e.id); })()`),
  build: async () => {
    await ev(`(() => { const g = S.g; S.play.closeWindow(); (${clearArea})(48, 26, 60, 32); g.research.done.add('r_belts'); g.player.inv.slots[11] = { k: S.key('belt_1'), n: 50 }; g.player.sel = 11; g.player.x = 52; g.player.y = 30; const r = window.__app.renderer; r.cam.x = g.player.x; r.cam.y = g.player.y - 0.6; })()`);
    await wait(100);
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
  // Roxy (1.1): her shop on the airship, her field in the morning, and a chat with her 64 px portrait
  airfreight: async () => ev(`(() => { S.play.openWindow('shop', 'airfreight'); })()`),
  skyfield: async () => ev(`(() => { const g = S.g; S.play.closeWindow(); g.time.min = 8 * 60; g.player.x = 182.5; g.player.y = 60.6; g.player.dir = 1; const n = g.sys.npcs.byId.get('roxy'); n.x = 184.5; n.y = 60.9; n.visible = true; n.path = []; n.dir = 3; })()`),
  'roxy-chat': async () => ev(`(() => { const g = S.g; const n = g.sys.npcs.byId.get('roxy'); n.met = true; n.points = 900; window.__npcs.openDialog(g, n, "Evening, gorgeous. Yes, I mean you. Don't look behind you, there's nobody there.", undefined, 0); })()`),
  map: async () => ev(`(() => { S.play.openWindow('map'); })()`),
  // the Works tab: k10 on, so the Town Mill's order is up and part filled, waiting for Milling
  restoration: async () => ev(`(() => { const g = S.g; S.play.closeWindow(); g.paused = false; const q = g.sys.quests; if (!q.active.some((a) => a.id === 'k10_mill')) q.active.push({ id: 'k10_mill', prog: [0, 0, 0, 0, 0], day: g.dayIndex }); for (let i = 0; i < 70; i++) g.tick(); const o = g.sys.orders.open.find((x) => x.def === 'w_town_mill'); if (o) { o.lines[0].have = 24; o.lines[1].have = 40; } S.play.openWindow('restoration'); })()`),
  // today's asks (the restoration shot is the Works tab)
  'board-today': async () => ev(`(() => { ${ORDERS}; S.play.openWindow('board', 'today'); })()`),
  // the Orders board: two standing orders and today's asks
  board: async () => ev(`(() => { ${ORDERS}; S.play.openWindow('board'); })()`),
  museum: async () => ev(`(() => { S.g.player.inv.add(S.key('amethyst'), 1); S.g.player.inv.add(S.key('old_cog'), 1); S.play.openWindow('museum'); })()`),
  friends: async () => ev(`(() => { let i = 0; for (const n of S.g.sys.npcs.list) { n.met = true; n.points = (i++ * 377) % 1500; } S.play.openWindow('journal'); S.play.win.data.tab = 'friends'; })()`),
  collections: async () => ev(`(() => { S.play.openWindow('journal'); S.play.win.data.tab = 'collect'; S.play.win.data.sub = 'fish'; })()`),
  journal: async () => ev(`(() => { S.play.openWindow('journal'); })()`),
  'journal-orders': async () => ev(`(() => { ${ORDERS}; S.play.openWindow('journal', 'orders'); S.play.win.data.tab = 'orders'; })()`),
  achievements: async () => ev(`(() => { S.play.openWindow('achievements'); })()`),
  mail: async () => ev(`(() => { S.play.openWindow('mail'); })()`),
  stats: async () => ev(`(() => { const g = S.g; for (let i = 0; i < 400; i++) { g.stats.add(S.key('wood'), 1); g.stats.add(S.key('stone'), 2); g.stats.use(S.key('wood'), 1); g.tick(); } S.play.openWindow('stats'); })()`),
  research: async () => ev(`(() => { S.g.research.done.add('r_belts'); S.g.research.done.add('r_preserves'); S.play.openWindow('research'); S.play.win.data.sel = 'r_arms'; })()`),
  // 1.2 bug 10: every topic reachable (scrolled to the far corners, and the Fit overview)
  // the keystone pips (Milling: observed, experiment done, validate running) and the Starlight band
  'research-keystone': async () => ev(`(() => { const g = S.g; for (const id of ['r_belts', 'r_arms', 'r_preserves', 'r_metallurgy', 'r_power']) g.research.done.add(id); g.research.done.delete('r_milling'); g.flags.delete('validated:r_milling'); g.research.valid.r_milling = 75; g.flags.add('observed:town_mill'); g.counters['made:mill'] = 25; g.research.current = null; S.play.openWindow('research'); S.play.win.data.focus = 'r_milling'; })()`),
  'research-bots': async () => ev(`(() => { S.play.openWindow('research'); S.play.win.data.focus = 'r_bots'; })()`),
  'research-fit': async () => ev(`(() => { S.play.openWindow('research'); S.play.win.data.fit = true; })()`),
  // 1.2 Phase 1: the automation core and the Field Works
  'works-lines': async () => ev(`(async () => { const g = S.g; S.play.closeWindow(); (${clearArea})(38, 26, 60, 36); const B = window.__build;
    const a = B.place(g, 'chest_wood', 40, 28, 0); a.inv.add(S.key('cogbean'), 200); B.place(g, 'arm_basic', 41, 28, 1); B.place(g, 'jar', 42, 28, 0); B.place(g, 'arm_basic', 43, 28, 1); B.place(g, 'chest_wood', 44, 28, 0);
    B.place(g, 'chest_wood', 40, 31, 0); B.place(g, 'arm_basic', 41, 31, 1); B.place(g, 'jar', 42, 31, 0); B.place(g, 'arm_basic', 43, 31, 1); B.place(g, 'chest_wood', 44, 31, 0);
    for (let i = 0; i < 60 * 90; i++) g.tick(); S.play.openWindow('stats'); S.play.win.data.tab = 'lines';
    const L = await import('/src/sim/lines.ts'); const s = L.lineSinks(g)[1]; if (s) S.play.win.data.sink = s.id; S.play.win.data.showFix = true; })()`),
  'works-field': async () => ev(`(() => { const g = S.g; S.play.closeWindow(); (${clearArea})(44, 26, 62, 44); const B = window.__build; g.research.done.add('r_gantry');
    B.place(g, 'gleaner', 48, 29, 0); B.place(g, 'arm_basic', 49, 29, 1); B.place(g, 'jar', 50, 29, 0);
    const gan = B.place(g, 'field_gantry', 50, 40, 0); for (let y = 34; y <= 39; y++) { B.place(g, 'rail', 50, y, 0); B.place(g, 'rail', 56, y, 0); } gan.inv.add(S.key('cogbean_seed'), 20);
    g.player.x = 52; g.player.y = 33; g.time.min = 13 * 60; for (let i = 0; i < 60 * 8; i++) g.tick();
    const empty = g.player.inv.slots.findIndex((sl, i) => i < 12 && !sl); if (empty >= 0) g.player.sel = empty; })()`),
  'works-pole': async () => ev(`(() => { const g = S.g; S.play.closeWindow(); (${clearArea})(44, 26, 60, 36); const B = window.__build; g.research.done.add('r_milling');
    B.place(g, 'windmill', 46, 28, 0); const p = B.place(g, 'pole_wood', 49, 29, 0); const m1 = B.place(g, 'mill', 50, 29, 0); m1.mach.inBuf.set(S.key('wheat'), 50); const m2 = B.place(g, 'mill', 50, 31, 0); m2.mach.inBuf.set(S.key('wheat'), 50);
    g.player.x = 48; g.player.y = 33; for (let i = 0; i < 300; i++) g.tick(); S.play.openWindow('struct', p.id); })()`),
  // B8: the keeper's river works by the farm gate, rusted, from the gate road
  'river-works': async () => ev(`(() => { const g = S.g; S.play.closeWindow(); S.play.lessons.q = []; g.player.sel = 0; g.time.min = 10 * 60; g.player.where = 'world'; g.player.x = 87.5; g.player.y = 46.7; g.player.dir = 2; })()`),
  // restored, with Bram's Brass Arms: the mill turns slowly in a brownout (and the card says so)
  'river-brownout': async () => {
    await ev(`(() => { const g = S.g; for (let y = 47; y < 53; y++) for (let x = 83; x < 92; x++) { const e = g.ents.rootAt(x, y); if (e) { delete e.st.rust; delete e.st.need; delete e.st.needN; } } g.ents.powerDirty = true; g.ents.version++; window.__build.place(g, 'arm_fast', 85, 50, 1); window.__build.place(g, 'arm_fast', 88, 50, 1); for (let i = 0; i < 60 * 15; i++) g.tick(); })()`);
    await wait(600);
  },
  perk: async () => ev(`(() => { S.g.player.skills.farming = 5; S.play.openWindow('perk'); })()`),
  pause: async () => ev(`(() => { S.play.openWindow('pause'); })()`),
  settings: async () => ev(`(() => { S.play.openWindow('pause'); S.play.win.data.settings = true; })()`),
  help: async () => ev(`(() => { S.play.openWindow('pause'); S.play.win.data.help = true; })()`),
  // ---- places, seasons, weather ----
  // farming back under 5 so the profession prompt from the perk shot doesn't cover the farm
  'farm-summer': async () => ev(`(() => { const g = S.g; S.play.closeWindow(); g.player.skills.farming = 4; g.time.season = 1; g.weather = 'sun'; g.player.x = 54; g.player.y = 31; g.time.min = 10 * 60; window.__app.renderer.invalidateAll(); window.__app.renderer.juice.banners.length = 0; })()`),
  'farm-fall': async () => ev(`(() => { const g = S.g; g.time.season = 2; window.__app.renderer.invalidateAll(); })()`),
  'farm-winter': async () => ev(`(() => { const g = S.g; g.time.season = 3; g.weather = 'snow'; window.__app.renderer.invalidateAll(); })()`),
  'farm-night': async () => ev(`(() => { const g = S.g; g.time.season = 0; g.weather = 'sun'; g.time.min = 22 * 60; window.__app.renderer.invalidateAll(); })()`),
  'town-storm': async () => ev(`(() => { const g = S.g; g.weather = 'storm'; g.player.x = 133; g.player.y = 64; g.time.min = 15 * 60; })()`),
  // the town keystones done (2.0 Phases 3-4): the Town Mill's wheel turning at dusk, the pump house, the lit square
  // (the keeper's river works restored carry the town line, so the square's lamps light after dark;
  // the era cards the flags raise are put away)
  'town-mill': async () => ev(`(async () => { const g = S.g; g.weather = 'sun'; for (let y = 47; y < 53; y++) for (let x = 83; x < 92; x++) { const e = g.ents.rootAt(x, y); if (e) delete e.st.rust; } g.ents.powerDirty = true; for (const f of ['town_mill', 'waterworks', 'lamps_hung']) g.flags.add(f); g.player.where = 'world'; g.player.x = 104.5; g.player.y = 61; g.time.min = 21 * 60 + 30; for (let i = 0; i < 180; i++) g.tick(); for (let k = 0; k < 8; k++) { await new Promise((r) => setTimeout(r, 120)); if (S.play.win) S.play.closeWindow(); } window.__app.renderer.juice.banners.length = 0; })()`),
  house: async () => ev(`(() => { const g = S.g; g.weather = 'sun'; g.time.min = 19 * 60; window.__house.enterHouse(g); window.__app.renderer.juice.banners.length = 0; })()`),
  // Workshop HQ (Phase 5): the flagstone wing with a chest, a crock, a keg and a desk placed indoors
  workshop: async () => ev(`(async () => { const g = S.g, H = window.__house; const I = await import('/src/sim/indoors.ts'); g.flags.add('home_workshop'); g.flags.add('home_drafting'); H.rebuildHouse(g); H.enterHouse(g); g.player.x = 17.5; g.player.y = 7.5; g.time.min = 17 * 60; for (const [id, x, y] of [['chest_wood', 15, 4], ['jar', 16, 4], ['keg', 17, 4], ['lab', 19, 5]]) if (I.canPlaceIndoors(g, id, x, y, 0).ok) I.placeIndoors(g, id, x, y, 0); window.__app.renderer.juice.banners.length = 0; })()`),
  // the ledger: yesterday's sales by customer, the market and the week
  ledger: async () => ev(`(() => { const g = S.g; g.sys.house.ledger = { day: 11, season: 0, year: 1, total: 1786, rows: [{ k: S.key('pickles_cogbean'), n: 12, coins: 900, to: 'rowan' }, { k: S.key('cogbean_oil'), n: 4, coins: 480, to: 'bram' }, { k: S.key('radish'), n: 20, coins: 300, to: '' }, { k: S.key('wood'), n: 30, coins: 60, to: '' }, { k: S.key('stone'), n: 23, coins: 46, to: '' }] }; S.play.openWindow('ledger', window.__house.almanacBits(g)); })()`),
  // the drafting table: the blueprint tool's copy and a library of three (one of Thorne's drawings)
  drafting: async () => ev(`(async () => { const g = S.g; const D = await import('/src/sim/drafting.ts'); S.play.closeWindow(); const bp = { w: 5, h: 3, items: [{ def: 'chest_wood', dx: 0, dy: 1, rot: 0 }, { def: 'arm_basic', dx: 1, dy: 1, rot: 1 }, { def: 'jar', dx: 2, dy: 1, rot: 0 }, { def: 'arm_basic', dx: 3, dy: 1, rot: 1 }, { def: 'chest_wood', dx: 4, dy: 1, rot: 0 }] }; D.addBlueprint(g, 'Pickle line', bp); D.addBlueprint(g, 'Two crocks off one chest of beans, with a long name', bp); D.addBlueprint(g, 'The old press', bp, 'thorne'); S.play.blueprint = bp; S.play.openWindow('drafting'); })()`),
  mine: async () => ev(`(() => { const g = S.g; S.play.closeWindow(); g.time.min = 11 * 60; window.__mine.enterFloor(g, 3); window.__app.renderer.juice.banners.length = 0; })()`),
  // the Deepworks (Phase 4): the Frost's pools and the dark Crystal galleries under the HUD
  'deep-frost': async () => ev(`(() => { window.__mine.enterFloor(S.g, 12); window.__app.renderer.juice.banners.length = 0; })()`),
  'deep-crystal': async () => ev(`(() => { window.__mine.enterFloor(S.g, 23); window.__app.renderer.juice.banners.length = 0; })()`),
  summary: async () => ev(`(() => { const g = S.g; g.player.where = 'world'; g.player.x = 54; g.player.y = 31; const bin = g.ents.get(g.shipBinId); bin.inv.add(S.key('radish'), 20); bin.inv.add(S.key('strawberry', 2), 5); bin.inv.add(S.key('wine_grape'), 2); g.goToBed(); g.time.min = 1559.99; g.tick(); })()`),
  // the tally once it has counted up
  'summary-end': async () => ev(`(() => { S.play.win.t = 9; })()`),
  // a record day with more than ten kinds sold, a quest done and two teaser lines
  'summary-record': async () => ev(`(() => { S.play.closeWindow(); const ids = ['radish', 'strawberry', 'wine_grape', 'wood', 'stone', 'copper_ore', 'cogbean', 'egg', 'wheat', 'amethyst', 'old_cog', 'bundle_green']; const sold = ids.map((id, i) => ({ k: S.key(id), n: 3 + i, price: 20 + i * 7, coins: (3 + i) * (20 + i * 7) })); const total = sold.reduce((a, s) => a + s.coins, 0); S.play.openWindow('summary', { season: 0, day: 12, year: 1, sold, total, best: 1000, passedOut: false, penalty: 0, quests: ['Double the Line'] }); S.play.win.data.tease = ['12 crops are ripe and ready to pick.', 'Your machines made 4 goods overnight.']; S.play.win.t = 9; })()`),
  // 3.2 rule 5: the pace bot's farm on day 5 should read as a works (structures over tilled rows)
  'day5-farm': async () => {
    await ev(`(async () => {
      const { Bot } = await import('/tests/bot.ts');
      const g = new window.__Game({ seed: 2024, name: 'Bot', farmName: 'Bolt' });
      for (const t of ${JSON.stringify(ALL_TIPS)}) g.flags.add(t);
      const bot = new Bot(g);
      for (let d = 0; d < 5; d++) bot.playDay();
      if (g.player.where === 'house') g.sys.house.leave(g);
      g.time.min = 11 * 60; g.weather = 'sun';
      window.__app.startGame(g, { skin: 22, hair: 49, hairStyle: 'braids', shirt: 30, pants: 46, accent: 56 });
    })()`);
    await wait(1200);
    await ev(`(() => { ${S} S.play.closeWindow(); S.play.hud.toasts = []; S.play.hud.pickups = []; S.play.lessons.q = []; const g = S.g; g.player.sel = 0; g.player.x = 63.5; g.player.y = 31.5; const r = window.__app.renderer; r.juice.banners = []; r.cam.zoom = r.cam.targetZoom = 2; })()`);
    await wait(800);
  },
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
