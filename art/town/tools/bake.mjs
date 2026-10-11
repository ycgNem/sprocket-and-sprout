// Bake the procedural town sprites (src/render/art/townworks.ts, the `town:` family and
// `st:tram_bin:*`) to PNGs from the running game: the baseline the imported sheet is compared
// against, and the source of the pieces kept as drawn (the mill's house, the pump house's walls).
//
// Usage: node art/town/tools/bake.mjs [outdir]   (default art/town/baked; BASE=http://localhost:5173/)
// Each name is saved as <name with ':' -> '_'>.png, e.g. town_mill_0_1.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2] ?? path.join(HERE, '..', 'baked'));
fs.mkdirSync(dir, { recursive: true });

/** every name the generator answers that the renderer asks for */
export function townNames() {
  const n = [];
  for (let s = 0; s < 4; s++) for (let st = 0; st < 3; st++) n.push(`town:mill:${s}:${st}`, `town:pump:${s}:${st}`);
  for (const on of [0, 1]) for (let f = 0; f < 4; f++) n.push(`town:wheel:${on}:${f}`);
  for (const on of [0, 1]) for (let f = 0; f < 4; f++) for (let s = 0; s < 4; s++) n.push(`town:fountain:${on}:${f}:${s}`);
  for (let st = 0; st < 3; st++) n.push(`town:lamp:${st}`);
  for (const v of ['h', 'v']) for (const l of [0, 1]) for (const f of [0, 1]) n.push(`town:cart:${v}:${l}:${f}`);
  for (const k of ['h', 'v', 'c']) n.push(`town:rail:${k}`);
  n.push('town:buffer', 'town:sign', 'town:townline');
  for (let s = 0; s < 4; s++) n.push(`st:tram_bin:0:0:${s}`);
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = townNames();
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto(process.env.BASE ?? 'http://localhost:5173/');
  await page.waitForFunction(() => window.__app?.screen);
  const out = await page.evaluate(async (names) => {
    // the page's own module instance (a bare import would create a second, empty atlas after hot updates)
    const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((u) => new URL(u).pathname === p) ?? p);
    const A = await mod('/src/render/atlas.ts');
    await A.artReady();
    const res = {};
    for (const n of names) {
      const s = A.sprite(n + ':old');
      const c = document.createElement('canvas');
      c.width = s.w; c.height = s.h;
      c.getContext('2d').drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      res[n] = { url: c.toDataURL('image/png'), w: s.w, h: s.h, ox: s.ox, oy: s.oy };
    }
    return res;
  }, names);
  const meta = {};
  for (const [n, r] of Object.entries(out)) {
    fs.writeFileSync(path.join(dir, n.replace(/:/g, '_') + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
    meta[n] = { w: r.w, h: r.h, ox: r.ox, oy: r.oy };
  }
  fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(meta, null, 1) + '\n');
  console.log(`baked ${names.length} sprites to ${path.relative(process.cwd(), dir)}`);
  await browser.close();
}
