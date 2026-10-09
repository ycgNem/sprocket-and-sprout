// Roxy Vane, real input (keyboard F/Enter) against a running dev server: door intro -> shop, chat, a loved gift, the 2-heart event (her day-4 card is in tests/roxy.test.ts).
// Usage: BASE=http://localhost:5173/ node e2e/roxy.mjs   (prints PASS/FAIL lines; screenshots in e2e/out/)
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const ev = (f) => page.evaluate(f);
const wait = (ms) => page.waitForTimeout(ms);
const results = [];
const check = (ok, what) => { results.push((ok ? 'PASS ' : 'FAIL ') + what); };
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await ev(() => { const g = new window.__Game({ seed: 4242, name: 'Robin', farmName: 'Willow' }); window.__app.startGame(g, { skin: 5, hair: 9, hairStyle: 'ponytail', shirt: 15, pants: 19, accent: 28 }); });
await wait(800);
// clear the opening's windows and tips
const calm = `(() => { const g = window.__game, p = window.__play; p.win = null; g.sys.dialogue = null; p.hud.toasts = []; for (const t of ['tip_machine','tip_move','tip_tools']) g.flags.add(t); })()`;
// let the opening's welcome appear, then dismiss it
for (let i = 0; i < 12; i++) { await wait(300); if (await ev(() => window.__play.win?.id === 'dialog')) break; }
for (let i = 0; i < 8 && await ev(() => !!window.__play.win); i++) { await page.keyboard.press('Enter'); await wait(250); }
await ev(calm);
// 1) the shop door at 11am on a Wednesday: first visit plays her intro, then the shop opens
await ev(() => { const g = window.__game; g.time.min = 11 * 60; g.dayIndex = 2; const r = g.sys.npcs.byId.get('roxy'); r.target = 'airship_in'; r.visible = false; r.path = []; const p = g.player; p.x = 179.5; p.y = 61.2; p.dir = 0; });
await wait(400);
const st0 = await ev(() => { const r = window.__game.sys.npcs.byId.get('roxy'); return { visible: r.visible, target: r.target, weekday: window.__game.weekday }; });
await page.keyboard.press('KeyF'); await wait(500);
const s1 = await ev(() => ({ win: window.__play.win?.id, npc: window.__play.win?.arg?.npc, page: window.__play.win?.arg?.pages?.[0], met: window.__game.sys.npcs.byId.get('roxy').met }));
check(s1.win === 'dialog' && s1.npc === 'roxy' && /Well, well/.test(s1.page ?? ''), `door intro: ${JSON.stringify({ st0, ...s1 })}`);
await page.screenshot({ path: 'e2e/out/roxy-play-1-intro.png' });
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await wait(250); }
const s2 = await ev(() => ({ win: window.__play.win?.id, shop: window.__play.win?.arg }));
check(s2.win === 'shop' && s2.shop === 'airfreight', `then her shop: ${JSON.stringify(s2)}`);
await page.screenshot({ path: 'e2e/out/roxy-play-2-shop.png' });
await page.keyboard.press('Escape'); await wait(300);
// second visit: straight to the shop
await ev(calm);
await page.keyboard.press('KeyF'); await wait(500);
const s3 = await ev(() => window.__play.win?.id);
check(s3 === 'shop', `second visit opens the shop directly: ${s3}`);
await page.keyboard.press('Escape'); await wait(300);
// 2) chat outside in the evening, then a gift she loves
await ev(() => { const g = window.__game, p = window.__play; p.win = null; g.sys.dialogue = null; g.time.min = 17 * 60 + 30; const r = g.sys.npcs.byId.get('roxy'); r.talked = false; r.visible = true; r.path = []; r.target = 'square_east'; r.x = g.player.x + 1; r.y = g.player.y; g.player.dir = 1; });
await wait(300);
await page.keyboard.press('KeyF'); await wait(500);
const s4 = await ev(() => ({ win: window.__play.win?.id, npc: window.__play.win?.arg?.npc, text: window.__play.win?.arg?.pages?.join(' ') }));
check(s4.win === 'dialog' && s4.npc === 'roxy', `chat: ${JSON.stringify(s4)}`);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await wait(200); }
await page.evaluate(async () => { const { key } = await import('/src/sim/inventory.ts'); const g = window.__game; g.player.inv.slots[0] = { k: key('ruby'), n: 1 }; g.player.sel = 0; });
await wait(200);
const before = await ev(() => window.__game.sys.npcs.byId.get('roxy').points);
await page.keyboard.press('KeyF'); await wait(500);
const s5 = await ev(() => ({ pts: window.__game.sys.npcs.byId.get('roxy').points, text: window.__play.win?.arg?.pages?.join(' ') }));
check(s5.pts > before + 60, `ruby is a loved gift: ${before} -> ${s5.pts} "${s5.text}"`);
await page.screenshot({ path: 'e2e/out/roxy-play-3-gift.png' });
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await wait(200); }
// 3) at 2 hearts, a morning at Skyhook Field starts "Engine Trouble"
await ev(() => { const g = window.__game, p = window.__play; p.win = null; g.sys.dialogue = null; const r = g.sys.npcs.byId.get('roxy'); r.points = 520; g.time.min = 8 * 60; g.player.x = 183.5; g.player.y = 60.5; });
await wait(1500);
const s6 = await ev(() => ({ win: window.__play.win?.id, title: window.__play.win?.arg?.title, flag: window.__game.flags.has('heart_roxy_2') }));
check(s6.win === 'event' && s6.title === 'Engine Trouble' && s6.flag, `2-heart event: ${JSON.stringify(s6)}`);
await page.screenshot({ path: 'e2e/out/roxy-play-4-event.png' });
await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
