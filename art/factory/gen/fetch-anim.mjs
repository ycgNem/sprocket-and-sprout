// Download a PixelLab object's base image and one 4-frame animation into art/factory/raw/anim/<name>/
// Usage: node art/factory/gen/fetch-anim.mjs <name> <object id> <animation id> [frames=4]
// (ids from get_object: .../objects/<owner>/<object id>/animations/<animation id>/unknown/{i}.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [name, obj, anim, n = '4'] = process.argv.slice(2);
const OWNER = '859e3c7d-c1c3-4eee-9e06-c95bf333277b';
const base = `https://backblaze.pixellab.ai/file/pixellab-characters/objects/${OWNER}/${obj}`;
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../raw/anim', name);
fs.mkdirSync(dir, { recursive: true });
async function get(url, file) {
  for (let t = 0; t < 5; t++) {
    const r = await fetch(url);
    if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return; }
    await new Promise((res) => setTimeout(res, 2000 * (t + 1)));
  }
  throw new Error('failed ' + url);
}
await get(`${base}/rotations/unknown.png`, path.join(dir, 'base.png'));
for (let i = 0; i < +n; i++) await get(`${base}/animations/${anim}/unknown/${i}.png`, path.join(dir, `${i}.png`));
fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ object: obj, animation: anim }, null, 1));
console.log(`saved ${dir}`);
