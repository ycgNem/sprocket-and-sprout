// In-game proof for the logo sheet: opens the title screen of the running dev server and swaps the
// title screen's drawLogo for one that draws logo:word + the spinning logo:gear from the real atlas
// (a runtime patch in the page only; no source file changes). Shots:
//   e2e/out/logo/title-ingame.png       the title with the new logo, gear frame by time
//   e2e/out/logo/title-ingame-f<0..7>.png  crops of the logo area, one per gear frame
//   e2e/out/logo/title-clean.png        the same title with no logo at all (background for mocks)
//   e2e/out/logo/title-mock.png         title-clean cropped around the logo, wordmark + gear frame 0 at
//                                       x2 composited offline from art/logo/src (what the sheet holds)
// Usage: node art/logo/ingame.mjs  (BASE=http://localhost:5173/ by default)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'e2e/out/logo');
const layout = JSON.parse(fs.readFileSync(path.join(HERE, 'layout.json'), 'utf8'));
const [slotX, slotY] = layout['logo:word'].oSlotCentre;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen?.drawLogo);
const info = await page.evaluate(async ({ slotX, slotY }) => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const scr = window.__app.screen;
  window.__logoMode = 'new';
  window.__logoFrame = -1; // -1: by time
  const orig = scr.drawLogo.bind(scr);
  scr.drawLogo = function (ui, cx, y) {
    if (window.__logoMode === 'old') return orig(ui, cx, y);
    if (window.__logoMode === 'none') return;
    const w = A.sprite('logo:word');
    const x0 = cx - Math.floor(w.w / 2), y0 = y - 6;
    ui.ctx.drawImage(w.img, w.x, w.y, w.w, w.h, x0, y0, w.w, w.h);
    const f = window.__logoFrame >= 0 ? window.__logoFrame : Math.floor(this.t * 10) % 8;
    const g = A.sprite('logo:gear:' + f);
    ui.ctx.drawImage(g.img, g.x, g.y, g.w, g.h, x0 + slotX - g.ox, y0 + slotY - g.oy, g.w, g.h);
    window.__logoBox = [x0, y0, w.w, w.h];
  };
  const s = A.sprite('logo:word'), g = A.sprite('logo:gear:0'), u = A.sprite('ui:sprocket:0');
  return { word: [s.w, s.h, s.ox, s.oy], gear: [g.w, g.h, g.ox, g.oy], sprocket: [u.w, u.h, u.ox, u.oy], uiScale: window.__app.uiScale };
}, { slotX, slotY });
console.log('atlas:', JSON.stringify(info));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'title-ingame.png') });
const box = await page.evaluate(() => window.__logoBox);
const k = info.uiScale;
for (let f = 0; f < 8; f++) {
  await page.evaluate((f) => (window.__logoFrame = f), f);
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT, `title-ingame-f${f}.png`), clip: { x: (box[0] - 8) * k, y: (box[1] - 8) * k, width: (box[2] + 16) * k, height: (box[3] + 16) * k } });
}
await page.evaluate(() => (window.__logoMode = 'none'));
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(OUT, 'title-clean.png') });
await browser.close();
if (errors.length) console.log('console errors:\n' + errors.join('\n'));

// offline composite: the wordmark and gear frame 0 from art/logo/src at x2 over the clean background
const bg = decodePNG(fs.readFileSync(path.join(OUT, 'title-clean.png')));
const word = decodePNG(fs.readFileSync(path.join(HERE, 'src/logo_word.png')));
const gear = decodePNG(fs.readFileSync(path.join(HERE, 'src/logo_gear_0.png')));
const [gox, goy] = layout['logo:gear:0..7'].origin;
const S = 2, X0 = box[0] * k, Y0 = box[1] * k; // same spot the in-game patch used
const blit = (src, dx, dy) => {
  for (let y = 0; y < src.h * S; y++) for (let x = 0; x < src.w * S; x++) {
    const s = (Math.floor(y / S) * src.w + Math.floor(x / S)) * 4;
    if (!src.data[s + 3]) continue;
    bg.data.set(src.data.subarray(s, s + 4), ((dy + y) * bg.w + dx + x) * 4);
  }
};
blit(word, X0, Y0);
blit(gear, X0 + (slotX - gox) * S, Y0 + (slotY - goy) * S);
const cx0 = Math.max(0, X0 - 140), cy0 = 0, cw = Math.min(bg.w - cx0, word.w * S + 280), ch = Math.min(bg.h, Y0 + word.h * S + 260);
const crop = new Uint8Array(cw * ch * 4);
for (let y = 0; y < ch; y++) crop.set(bg.data.subarray(((cy0 + y) * bg.w + cx0) * 4, ((cy0 + y) * bg.w + cx0 + cw) * 4), y * cw * 4);
fs.writeFileSync(path.join(OUT, 'title-mock.png'), encodePNG(cw, ch, crop));
console.log('e2e/out/logo/title-ingame.png, title-ingame-f0..7.png, title-clean.png, title-mock.png');
