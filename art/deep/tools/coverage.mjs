// Every name the Deepworks art answers (deep:<kind>:<on>:<frame> up to deepFrames, and the gallery
// doorways o:<O.GALLERY>:<state>:<season>) must resolve to the imported sheet in the running game.
// Usage: node art/deep/tools/coverage.mjs   (BASE=http://localhost:5173/ by default)
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  // the module instances the app loaded (after hot updates Vite serves them as ?t=… URLs)
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const { deepFrames } = await mod('/src/render/art/deep.ts');
  const { O } = await mod('/src/sim/world/tilemap.ts');
  const KINDS = ['lift', 'boiler', 'pump', 'lampworks', 'lockers', 'cart', 'star'];
  const names = [];
  for (const k of KINDS) for (const on of [0, 1]) for (let f = 0; f < Math.max(4, deepFrames(k, !!on)); f++) names.push(`deep:${k}:${on}:${f}`);
  for (let v = 0; v < 4; v++) for (let s = 0; s < 4; s++) names.push(`o:${O.GALLERY}:${v}:${s}`);
  return {
    names: names.length,
    missing: names.filter((n) => !A.hasImage(n)),
    gallery: O.GALLERY,
    frames: Object.fromEntries(KINDS.map((k) => [k, { derelict: deepFrames(k, false), restored: deepFrames(k, true) }])),
  };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
process.exit(res.missing.length ? 1 : 0);
