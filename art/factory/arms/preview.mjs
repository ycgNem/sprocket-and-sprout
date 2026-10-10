// Preview of every arm part at a big scale on grass: node art/factory/arms/preview.mjs [out.png] [scale]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../../scripts/lib/png.mjs';
import { ARM, drawArmBase, drawClaw, drawKey, drawSideKey, drawCoil, get } from '../gen/arms.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.resolve(HERE, '../../../e2e/out/armfix/parts.png');
const K = +(process.argv[3] ?? 8);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const items = [];
for (const id of Object.keys(ARM)) items.push(drawArmBase(id));
for (const id of Object.keys(ARM)) for (const s of [0, 1]) for (let d = 0; d < 4; d++) items.push(drawClaw(id, s, d));
for (let f = 0; f < 4; f++) items.push(drawKey(f));
for (const side of [1, 3]) for (let f = 0; f < 4; f++) items.push(drawSideKey(f, side));
for (let f = 0; f < 4; f++) items.push(drawCoil(f));
const CELL = 18, COLS = 8;
const W = COLS * CELL * K, H = Math.ceil(items.length / COLS) * CELL * K;
const data = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) data.set([0x2e, 0x22, 0x2f, 255], i * 4);
items.forEach((im, n) => {
  const ox = (n % COLS) * CELL, oy = Math.floor(n / COLS) * CELL;
  for (let y = 0; y < CELL - 1; y++) for (let x = 0; x < CELL - 1; x++) {
    const ix = x - Math.floor((CELL - 1 - im.w) / 2), iy = y - Math.floor((CELL - 1 - im.h) / 2);
    const c = get(im, ix, iy) ?? '#239063';
    const [r, g, b] = rgb(c);
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) data.set([r, g, b, 255], (((oy + y) * K + j) * W + (ox + x) * K + i) * 4);
  }
});
fs.writeFileSync(out, encodePNG(W, H, data));
console.log(out, items.length, 'parts');
