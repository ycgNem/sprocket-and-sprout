// Download Roxy's PixelLab sources from their public URLs (no token needed; the URLs carry the ids).
// The URLs come from get_character / get_image (see pixellab.json and art/portraits-roxy/moods.mjs).
//   node art/npcs/roxy/dl.mjs rot <character base url ending in /<id>/> <outdir>
//       saves <outdir>/rotations/<dir>.png for the 8 directions
//   node art/npcs/roxy/dl.mjs anim <frame url with {dir} and {i}> <dirs comma list> <count> <outdir>
//       saves <outdir>/<dir>/<i>.png
//   node art/npcs/roxy/dl.mjs many <image job url with {i}> <count> <outdir>
//       a create_image_pro batch (…/download?index={i}): saves <outdir>/<i>.png
//   node art/npcs/roxy/dl.mjs url <url> <file>
import fs from 'node:fs';
import path from 'node:path';
const [cmd, a, b, c, d] = process.argv.slice(2);
async function get(url, file) {
  for (let t = 0; t < 6; t++) {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.status === 423 || res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2500 * (t + 1))); continue; }
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return;
  }
  throw new Error('not ready ' + url);
}
const DIRS = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];
if (cmd === 'rot') {
  await Promise.all(DIRS.map((dir) => get(`${a}rotations/${dir}.png`, path.join(b, 'rotations', dir + '.png'))));
  console.log('saved 8 rotations to ' + b);
} else if (cmd === 'anim') {
  const jobs = [];
  for (const dir of b.split(',')) for (let i = 0; i < +c; i++) jobs.push(get(a.replace('{dir}', dir).replace('{i}', i), path.join(d, dir, i + '.png')));
  await Promise.all(jobs);
  console.log(`saved ${jobs.length} frames to ${d}`);
} else if (cmd === 'many') {
  // 8 at a time: the image server answers 429 to bigger bursts
  for (let i = 0; i < +b; i += 8) await Promise.all(Array.from({ length: Math.min(8, +b - i) }, (_, k) => get(a.replace('{i}', i + k), path.join(c, `${i + k}.png`))));
  console.log(`saved ${b} images to ${c}`);
} else if (cmd === 'url') {
  await get(a, b);
  console.log('saved ' + b);
} else {
  console.error('usage: node art/npcs/roxy/dl.mjs rot|anim|many|url …');
  process.exit(2);
}
