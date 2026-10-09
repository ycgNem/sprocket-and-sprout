// Roxy Vane previews from the running game (http://localhost:5173/ unless BASE is set). Writes
// e2e/out/roxy/:
//   sheet-4x.png      every frame the sheet maps (rows up/right/down/left: walk 0-3, stand 4, idle
//                     i0-i7, greet g0-g3) as the game draws them (left mirrored back), x4 on grass
//                     with the renderer's shadow
//   portraits-4x.png  portrait:roxy:0..3 at x4 (1 is also the blink)
//   lineup-4x.png     Roxy standing next to villagers and the player, x4, for scale
//   ingame.png        a frozen game scene with Roxy and two villagers placed next to the player;
//   ingame-zoom.png   its center, x2 (nearest neighbor)
//   dialog.png        talking to her: the dialogue window with the 64x64 portrait
// Usage: node art/npcs/roxy/preview.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { decodePNG, encodePNG, upscale } from '../../../scripts/lib/png.mjs';

const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'e2e/out/roxy';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await page.evaluate(() => {
  const g = new window.__Game({ seed: 12345, name: 'Robin', farmName: 'Willow' });
  window.__app.startGame(g, { skin: 22, hair: 24, hairStyle: 'short', shirt: 25, pants: 46, accent: 56 });
});
await page.waitForTimeout(1200);

const shots = await page.evaluate(async () => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const K = 4, BG = '#239063', INK = '#2e222f', LABEL = '#fbb954';
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  /** draw a character sprite with its anchor at (ax, ay), shadow under it, at scale K */
  const drawChar = (ctx, name, ax, ay, flip) => {
    const sh = A.sprite('shadow:14');
    ctx.drawImage(sh.img, sh.x, sh.y, sh.w, sh.h, ax - sh.ox * K, ay - sh.oy * K, sh.w * K, sh.h * K);
    const s = A.sprite(name);
    ctx.save();
    if (flip) { ctx.translate(ax, 0); ctx.scale(-1, 1); ctx.translate(-ax, 0); }
    ctx.drawImage(s.img, s.x, s.y, s.w, s.h, ax - s.ox * K, ay - s.oy * K, s.w * K, s.h * K);
    ctx.restore();
    return s;
  };
  const res = {};

  // ---- sheet ----
  const toks = ['0', '1', '2', '3', '4', 'i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'g0', 'g1', 'g2', 'g3'];
  const dirs = ['up', 'right', 'down', 'left'];
  const CW = 48 * K + 4, CH = 48 * K + 22, LX = 70;
  {
    const [c, ctx] = canvas(LX + toks.length * CW, 24 + dirs.length * CH);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '14px monospace';
    ctx.fillStyle = LABEL;
    toks.forEach((t, i) => ctx.fillText(t.match(/^\d$/) ? (t === '4' ? 'stand 4' : 'walk ' + t) : t[0] === 'i' ? 'idle ' + t : 'greet ' + t, LX + i * CW + 6, 16));
    dirs.forEach((d, r) => {
      ctx.fillStyle = LABEL;
      ctx.fillText(d, 8, 24 + r * CH + CH / 2);
      toks.forEach((t, i) => {
        const x = LX + i * CW, y = 24 + r * CH;
        ctx.fillStyle = (i + r) % 2 ? BG : '#1e7a54';
        ctx.fillRect(x, y, CW - 4, CH - 6);
        drawChar(ctx, `ch:roxy:${r}:${t}`, x + (CW - 4) / 2, y + CH - 6 - 2 * K, r === 3);
      });
    });
    res.sheet = c.toDataURL('image/png');
  }

  // ---- portraits ----
  {
    const moods = ['0 neutral', '1 happy / blink', '2 sad', '3 surprised'];
    const [c, ctx] = canvas(moods.length * (64 * K + 12) + 12, 64 * K + 40);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '14px monospace';
    moods.forEach((m, i) => {
      const s = A.sprite(`portrait:roxy:${i}:0`);
      const x = 12 + i * (64 * K + 12);
      ctx.fillStyle = '#4a4250'; ctx.fillRect(x, 28, 64 * K, 64 * K);
      ctx.drawImage(s.img, s.x, s.y, s.w, s.h, x, 28, s.w * K, s.h * K);
      ctx.fillStyle = LABEL; ctx.fillText(`${m} (${s.w}x${s.h})`, x, 18);
    });
    res.portraits = c.toDataURL('image/png');
  }

  // ---- lineup ----
  {
    const who = [['roxy', 'Roxy (new)'], ['roxy:old', 'roxy 1.0'], ['hazel', 'Hazel'], ['marigold', 'Marigold'], ['bram', 'Bram'], ['thorne', 'Thorne'], ['player', 'player']];
    const W = 40 * K, [c, ctx] = canvas(who.length * W + 20, 52 * K + 30);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, c.width, c.height);
    // a tile grid for scale (16 px tiles)
    ctx.strokeStyle = 'rgba(46,34,47,0.25)';
    for (let x = 0; x < c.width; x += 16 * K) { ctx.beginPath(); ctx.moveTo(x + 0.5, 24); ctx.lineTo(x + 0.5, c.height); ctx.stroke(); }
    for (let y = c.height - 8 * K; y > 24; y -= 16 * K) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(c.width, y + 0.5); ctx.stroke(); }
    ctx.font = '14px monospace';
    who.forEach(([id, label], i) => {
      const old = id.endsWith(':old');
      const name = old ? `ch:${id.slice(0, -4)}:2:4:old` : `ch:${id}:2:4`;
      drawChar(ctx, name, 10 + i * W + W / 2, c.height - 8 * K, false);
      ctx.fillStyle = INK; ctx.fillText(label, 10 + i * W + 8, 18);
    });
    res.lineup = c.toDataURL('image/png');
  }
  return res;
});
for (const [k, url] of Object.entries(shots)) {
  const f = `${out}/${k === 'sheet' ? 'sheet-4x' : k === 'portraits' ? 'portraits-4x' : 'lineup-4x'}.png`;
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(f);
}

// ---- in game: Roxy and two villagers next to the player, the sim frozen ----
await page.evaluate(() => (window.__app.loop.speed = 0));
await page.evaluate(() => {
  const g = window.__game, p = g.player;
  window.__play.closeWindow?.();
  g.time.season = 1; g.weather = 'sun'; g.time.min = 11 * 60;
  p.x = 133.5; p.y = 66; p.dir = 2;
  const put = (id, dx, dy, dir) => { const n = g.sys.npcs.byId.get(id); if (!n) return; n.visible = true; n.path = []; n.moving = false; n.x = p.x + dx; n.y = p.y + dy; n.dir = dir; };
  put('roxy', 1.4, 0, 2);
  put('hazel', -1.4, 0, 2);
  put('bram', 2.8, 0.1, 2);
  window.__app.renderer.cam.x = p.x + 0.7; window.__app.renderer.cam.y = p.y - 0.6;
  window.__app.renderer.invalidateAll?.();
});
await page.mouse.move(1279, 719);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/ingame.png` });
const shot = decodePNG(fs.readFileSync(`${out}/ingame.png`));
// center crop 480x270, x2
const cw = 480, ch = 270, x0 = (shot.w - cw) >> 1, y0 = (shot.h - ch) >> 1;
const crop = { w: cw, h: ch, data: new Uint8Array(cw * ch * 4) };
for (let y = 0; y < ch; y++) crop.data.set(shot.data.subarray(((y0 + y) * shot.w + x0) * 4, ((y0 + y) * shot.w + x0 + cw) * 4), y * cw * 4);
const z = upscale(crop, 2);
fs.writeFileSync(`${out}/ingame-zoom.png`, encodePNG(z.w, z.h, z.data));
console.log(`${out}/ingame.png, ${out}/ingame-zoom.png`);

// ---- the dialogue window with her 64x64 portrait ----
await page.evaluate(() => {
  const g = window.__game, n = g.sys.npcs.byId.get('roxy');
  window.__app.loop.speed = 1;
  if (n) g.sys.npcs.interact(g, n);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/dialog.png` });
console.log(`${out}/dialog.png`);
if (errors.length) console.log('console errors:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
