// Farmhouse review shots: the built-in room plus every placeable furniture item, at a chosen hour
// and season, cropped to the room and scaled x3 (art/home/zoom.mjs logic inline).
// Usage: node art/home/shot.mjs <out.png> [--hour 20] [--season 0] [--kitchen] [--old] [--empty]
//   --old    draw with ?art=old (procedural 1.0) for a side-by-side
//   --empty  only the built-in furniture
import { chromium } from 'playwright';
import fs from 'node:fs';
import { decodePNG, encodePNG } from '../../scripts/lib/png.mjs';

const args = process.argv.slice(2);
const out = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const hour = +opt('--hour', 20), season = +opt('--season', 0);
const base = (process.env.BASE ?? 'http://localhost:5173/') + (args.includes('--old') ? '?art=old' : '');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForFunction(() => window.__app?.screen);
await page.evaluate(async ({ hour, season, kitchen, empty }) => {
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((u) => new URL(u).pathname === p) ?? p);
  const g = new window.__Game({ seed: 3, name: 'Wren', farmName: 'Hollow' });
  for (const t of ['welcome', 'hoe', 'seeds', 'can', 'place', 'lab', 'belts', 'machine', 'power', 'blueprint', 'energy', 'night', 'house']) g.flags.add('tip_' + t);
  window.__app.startGame(g, { skin: 54, hair: 49, hairStyle: 'long', shirt: 56, pants: 46 });
  const I = await mod('/src/sim/inventory.ts');
  const H = await mod('/src/sim/systems/house.ts');
  if (kitchen) g.flags.add('home_kitchen');
  g.time.season = season;
  H.enterHouse(g);
  g.player.x = 7.5; g.player.y = 8.6;
  const put = (id, x, y) => { g.player.inv.add(I.key(id), 1); const e = H.placeDecor(g, id, x, y); if (e) console.log('place fail', id, e); };
  if (!empty) {
    // wall: paintings, trophies, tapestry, banner
    put('f_paint_meadow', 1, 1); put('f_paint_sea', 2, 1); put('f_paint_tower', 4, 1); put('f_trophy_thistlefin', 6, 1);
    put('f_trophy_clockjaw', 9, 1); put('f_trophy_tidemother', 11, 1); put('f_tapestry', 12, 1);
    // floor
    put('f_rug_green', 9, 3); put('f_armchair_rose', 9, 3); put('f_armchair_sage', 10, 3); put('f_lamp', 11, 4);
    put('f_tank', 1, 6); put('f_bookcase', 12, 7); put('f_pantry_shelf', 11, 7); put('f_fig', 3, 8); put('f_fern', 1, 5);
    put('f_petbed', 6, 3); put('f_rug_blue', 9, 7); put('f_lantern', 5, 8); put('f_gilded_clock', 3, 4);
    put('f_globe', 9, 8); put('f_telescope', 10, 8); put('f_musicbox', 12, 4);
  }
  g.time.min = hour * 60;
}, { hour, season, kitchen: args.includes('--kitchen'), empty: args.includes('--empty') });
await page.waitForTimeout(2500);
const shot = decodePNG(await page.screenshot());
// the room sits in the middle of the 1280x720 view; crop it and scale x3
const [x0, y0, w, h, s] = [430, 190, 420, 360, 3];
const data = new Uint8Array(w * s * h * s * 4);
for (let y = 0; y < h * s; y++)
  for (let x = 0; x < w * s; x++) {
    const p = ((y0 + Math.floor(y / s)) * shot.w + x0 + Math.floor(x / s)) * 4;
    data.set(shot.data.subarray(p, p + 4), (y * w * s + x) * 4);
  }
fs.writeFileSync(out, encodePNG(w * s, h * s, data));
console.log(out, errors.length ? 'errors: ' + errors.slice(0, 5).join(' | ') : '');
await browser.close();
