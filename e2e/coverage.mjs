// Art coverage: every sprite name the game can ask for, checked against the imported sheets.
// Prints, per family, how many names have imported art and lists the ones that still fall back
// to the procedural generators (src/render/art/). Writes e2e/out/coverage.json.
//
// Usage: node e2e/coverage.mjs [--list family]   (BASE=http://localhost:5173/ by default)
import { chromium } from 'playwright';
import fs from 'node:fs';

const listFam = process.argv.includes('--list') ? process.argv[process.argv.indexOf('--list') + 1] : null;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__app?.screen);
const res = await page.evaluate(async () => {
  // the module instance the app loaded (after hot updates Vite serves it as ?t=… URLs)
  const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
  const A = await mod('/src/render/atlas.ts');
  await A.artReady();
  const { CROPS } = await import('/src/data/crops.ts');
  const { TREES } = await import('/src/data/trees.ts');
  const { STRUCTURES } = await import('/src/data/structures.ts');
  const { NPCS } = await import('/src/data/npcs.ts');
  const { ANIMALS, MONSTERS } = await import('/src/data/creatures.ts');
  const { ITEMS } = await import('/src/data/items.ts');
  const { FURNITURE } = await import('/src/data/furniture.ts');
  const { MEGAPROJECTS } = await import('/src/data/goals.ts');
  const { O } = await import('/src/sim/world/tilemap.ts');
  const { PET_COATS } = await import('/src/sim/systems/pet.ts');
  const fam = {};
  const add = (f, n) => (fam[f] ??= []).push(n);
  const R = (n) => [...Array(n).keys()];
  for (const c of CROPS) {
    const N = c.stages.length;
    for (const st of R(N + 1)) for (const v of R(3)) for (const dead of [0, 1]) add('crop', `crop:${c.id}:${st}:${st === N ? 1 : 0}:${v}:${dead}`);
    if (c.giant) add('giant', 'giant:' + c.id);
  }
  for (const t of TREES) for (const st of R(5)) for (const s of R(4)) for (const fr of st === 4 && t.fruit ? R(4) : [0]) for (const v of R(3)) add('tree', `tree:${t.id}:${st}:${s}:${fr}:${v}`);
  const FLAT = ['ROCK', 'WEED', 'TWIG', 'STUMP', 'LOG', 'TALLGRASS', 'BUSH', 'FLOWER', 'ORE_ROCK', 'ARTIFACT', 'FENCE', 'BENCH', 'BARREL', 'GEM_ROCK', 'LADDER', 'SHAFT', 'REEDS', 'LILYPAD', 'MUSHROOM', 'SIGNPOST', 'WELL', 'MAILBOX', 'FLOWERBED', 'HEDGE', 'CRATE', 'ELEVATOR', 'MINE_EXIT', 'ICE_ROCK', 'STALAGMITE', 'CRYSTAL', 'BOULDER', 'TREASURE'];
  for (const k of FLAT) {
    const vs = k === 'FLOWER' || k === 'FLOWERBED' ? R(6) : k === 'ORE_ROCK' ? R(8) : k === 'GEM_ROCK' ? R(4) : k === 'TREASURE' ? R(3) : R(3);
    for (const v of vs) for (const s of R(4)) add('object', `o:${O[k]}:${v}:${s}`);
  }
  add('object', 'lamp:0'); add('object', 'lamp:1'); add('object', 'board:0');
  for (const d of STRUCTURES) {
    if (d.kind === 'belt') { for (const r of R(4)) for (const cv of R(3)) for (const f of R(4)) add('belt', `belt:${d.tier}:${r}:${cv}:${f}`); continue; }
    if (d.kind === 'underground') { for (const r of R(4)) for (const io of [0, 1]) for (const f of R(4)) add('belt', `ug:${d.tier}:${r}:${io}:${f}`); continue; }
    if (d.kind === 'splitter') { for (const f of R(4)) add('belt', `split:${d.tier}:${f}`); continue; }
    if (d.kind === 'arm') { add('structure', `armb:${d.id}`); continue; }
    if (d.kind === 'megaproject' || d.kind === 'path') continue;
    for (const f of R(4)) for (const on of [0, 1]) for (const s of R(4)) add('structure', `st:${d.id}:${f}:${on}:${s}`);
  }
  for (const mp of MEGAPROJECTS) for (const q of R(9)) for (const f of R(2)) add('mega', `mega:${mp.id}:${q}:${f}`);
  for (const id of [...NPCS.map((n) => n.id), 'peddler']) {
    for (const d of R(4)) for (const f of R(7)) add('character', `ch:${id}:${d}:${f}`);
    for (const mood of R(4)) add('portrait', `portrait:${id}:${mood}:${NPCS.find((n) => n.id === id)?.age === 'elder' ? 1 : 0}`);
  }
  for (const a of ANIMALS) for (const f of R(2)) for (const b of [0, 1]) add('creature', `an:${a.id}:${f}:${b}`);
  for (const m of MONSTERS) for (const f of R(4)) add('creature', `mon:${m.id}:${f}`);
  for (const [k, coats] of Object.entries(PET_COATS)) for (const c of R(coats.length)) for (const p of R(4)) add('creature', `pet:${k}:${c}:${p}`);
  add('creature', 'bowl:0'); add('creature', 'bowl:1');
  for (const n of ['bed:0:0', 'bed:1:0', 'dresser:0:0', 'fireplace:0:0', 'stove:0:0', 'stove:1:0', 'shelf:0:0', 'shelf:1:0', 'shelf:2:0', 'chair:0:0', 'almanac:0:0', 'plant:0:0', 'plant:1:0', 'plant:2:0', 'clock:0:0', 'rug:0:0', 'doormat:0:0'])
    add('home', 'hf:' + n);
  for (const s of R(4)) { add('home', `hf:table:0:${s}`); add('home', `hf:window:0:${s}`); add('home', `hf:window:1:${s}`); }
  for (const f of FURNITURE) for (const s of R(4)) add('home', `hf:${f.sprite}:${s}`);
  for (const it of ITEMS) add('icon', 'i:' + it.id);
  for (const q of [1, 2, 3]) add('icon', 'q:' + q);
  const out = {};
  for (const [f, names] of Object.entries(fam)) {
    const miss = [...new Set(names)].filter((n) => !A.hasImage(n));
    out[f] = { total: new Set(names).size, missing: miss };
  }
  return out;
});
await browser.close();
let tot = 0, have = 0;
for (const [f, r] of Object.entries(res)) {
  tot += r.total;
  have += r.total - r.missing.length;
  const pct = Math.round((100 * (r.total - r.missing.length)) / r.total);
  console.log(`${f.padEnd(10)} ${String(r.total - r.missing.length).padStart(5)} / ${String(r.total).padEnd(5)} ${String(pct).padStart(3)}%` + (r.missing.length && r.missing.length <= 6 ? `  missing: ${r.missing.join(' ')}` : ''));
  if (listFam === f) console.log(r.missing.join('\n'));
}
console.log(`${'all'.padEnd(10)} ${String(have).padStart(5)} / ${tot}  ${Math.round((100 * have) / tot)}%   (terrain, ui, fx hooks and buildings are checked separately)`);
fs.mkdirSync('e2e/out', { recursive: true });
fs.writeFileSync('e2e/out/coverage.json', JSON.stringify(res, null, 1));
