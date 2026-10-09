// Hand-drawn props whose geometry the game depends on: fences and gate (tile across), path tiles
// (build ghosts), power poles (wires attach 2 px below the frame top, from EXTRA_TOP), the copper
// tower. Writes art/factory/props/<name>.png (frame-sized) + a preview.
// Usage: node art/factory/gen/props.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, INK, WOOD, BRASS, COPPER, IRON, STONE, MOSS, preview } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../props');
const items = [];
const save = (name, im) => { im.save(path.join(OUT, name + '.png')); items.push({ name, im }); };

// ---------- wood fence (16x18, top 2): post in the middle, two rails across the whole tile ----------
{
  const im = new Img(16, 18);
  for (const ry of [6, 12]) {
    im.hline(0, 15, ry, WOOD[3]); im.hline(0, 15, ry + 1, WOOD[2]);
    for (const x of [2, 13]) im.set(x, ry + 1, WOOD[1]);
    im.set(4, ry, WOOD[4]); im.set(11, ry, WOOD[4]);
  }
  // post with a pointed cap
  im.vline(7, 2, 16, WOOD[4]); im.vline(8, 2, 16, WOOD[3]); im.vline(9, 2, 16, WOOD[2]);
  im.set(7, 1, WOOD[4]); im.set(8, 1, WOOD[3]); im.set(9, 1, WOOD[2]);
  im.set(8, 0, WOOD[3]);
  im.set(9, 5, WOOD[1]); im.set(9, 10, WOOD[1]); im.set(9, 15, WOOD[1]); im.set(8, 9, WOOD[2]);
  // brass nails where the rails meet the post
  im.set(8, 6, BRASS[3]); im.set(8, 12, BRASS[3]);
  im.outline();
  // the outline would cap the post top; keep it, but drop the outline at the ground row so it sits in the grass
  save('fence_wood', im);
}

// ---------- stone wall (16x16, top 0): low wall of warm taupe stones, moss on top ----------
{
  const im = new Img(16, 16);
  // top face (seen from above) y 5..7, front face y 8..15
  im.rect(0, 5, 16, 3, STONE[3]);
  im.hline(0, 15, 5, STONE[4]);
  im.rect(0, 8, 16, 8, STONE[2]);
  // two courses of stones on the front, staggered, mortar in plum-gray
  const course = (y, h, xs) => {
    im.hline(0, 15, y + h - 1, STONE[1]);
    for (const x of xs) im.vline(x, y, y + h - 2, STONE[1]);
    // light the top-left pixel of every stone, shade its bottom-right
    const edges = [-1, ...xs, 16];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i] + 1, b = edges[i + 1] - 1;
      if (a > b) continue;
      im.hline(a, b, y, STONE[3]);
      if (a >= 0 && a <= 15) im.set(a, y, STONE[4]);
      if (b >= 0 && b <= 15) im.set(b, y + h - 2, STONE[1]);
    }
  };
  course(8, 4, [4, 10]);
  course(12, 4, [1, 7, 13]);
  im.hline(0, 15, 7, STONE[1]); // lip shadow under the top face
  for (const x of [3, 8, 13]) im.set(x, 6, STONE[2]);
  // moss tufts on the cap
  for (const [x, y, c] of [[2, 4, MOSS[2]], [2, 5, MOSS[1]], [3, 5, MOSS[2]], [10, 5, MOSS[1]], [11, 4, MOSS[3]], [11, 5, MOSS[2]], [12, 5, MOSS[1]], [6, 8, MOSS[1]], [14, 12, MOSS[1]]]) im.set(x, y, c);
  im.outline();
  save('fence_stone', im);
}

// ---------- garden gate (16x18, top 2): posts on both edges, plank door with a brace and latch ----------
{
  const im = new Img(16, 18);
  for (const x0 of [0, 13]) {
    im.vline(x0, 2, 16, WOOD[4]); im.vline(x0 + 1, 2, 16, WOOD[3]); im.vline(x0 + 2, 2, 16, WOOD[2]);
    im.hline(x0, x0 + 2, 1, WOOD[3]);
    im.set(x0 + 2, 6, WOOD[1]); im.set(x0 + 2, 12, WOOD[1]);
  }
  // pickets
  for (const x of [4, 6, 8, 10]) { im.vline(x, 4, 15, WOOD[3]); im.vline(x + 1, 4, 15, WOOD[2]); im.set(x, 3, WOOD[4]); }
  // rails and brace
  im.hline(3, 12, 6, WOOD[4]); im.hline(3, 12, 7, WOOD[2]);
  im.hline(3, 12, 12, WOOD[4]); im.hline(3, 12, 13, WOOD[2]);
  im.line(4, 11, 11, 8, WOOD[1]);
  // brass hinges and latch
  im.set(3, 6, BRASS[3]); im.set(3, 12, BRASS[3]); im.set(12, 9, BRASS[3]); im.set(12, 10, BRASS[2]);
  im.outline();
  save('gate', im);
}

// ---------- path tiles (build ghosts and icons; 16x20 frame, art on the bottom 16x16) ----------
{
  // cobbles
  const im = new Img(16, 20);
  im.rect(0, 4, 16, 16, STONE[1]);
  const cob = [[1, 5, 5, 4], [7, 5, 4, 3], [12, 5, 4, 4], [0, 10, 3, 4], [4, 9, 5, 4], [10, 9, 5, 5], [1, 15, 4, 4], [6, 14, 5, 5], [12, 15, 4, 4], [7, 9, 2, 2]];
  for (const [x, y, w, h] of cob) {
    im.rect(x, y, w, h, STONE[2]);
    im.hline(x, x + w - 2, y, STONE[3]); im.set(x, y, STONE[4]);
    im.hline(x + 1, x + w - 1, y + h - 1, STONE[1] === im.get(x, y + h) ? STONE[2] : '#7a3045');
    im.set(x + w - 1, y + h - 1, STONE[1]);
  }
  save('path_stone', im);
}
{
  // red bricks, running bond
  const im = new Img(16, 20);
  im.rect(0, 4, 16, 16, '#7a3045');
  for (let row = 0; row < 4; row++) {
    const y = 4 + row * 4, off = row % 2 ? 4 : 0;
    for (let x = -off; x < 16; x += 8) {
      const a = Math.max(0, x), b = Math.min(15, x + 6);
      im.rect(a, y, b - a + 1, 3, '#b33831');
      im.hline(a, b, y, '#ea4f36');
      if (x >= 0) im.set(a, y, '#f57d4a');
      im.set(b, y + 2, '#6e2727');
    }
  }
  save('path_brick', im);
}
{
  // planks running across, nailed
  const im = new Img(16, 20);
  for (let row = 0; row < 4; row++) {
    const y = 4 + row * 4;
    im.rect(0, y, 16, 3, WOOD[3]);
    im.hline(0, 15, y, WOOD[4]);
    im.hline(0, 15, y + 3, WOOD[1]);
    const seam = row % 2 ? 5 : 11;
    im.vline(seam, y, y + 2, WOOD[1]);
    im.set(seam - 2, y + 1, BRASS[1]); im.set(seam + 2, y + 1, BRASS[1]);
    im.set((seam + 8) % 16, y + 2, WOOD[2]);
  }
  save('path_wood', im);
}

// ---------- wooden power pole (16x36, top 20): wire at (8, 2) ----------
{
  const im = new Img(16, 36);
  im.vline(7, 3, 34, WOOD[4]); im.vline(8, 3, 34, WOOD[3]); im.vline(9, 3, 34, WOOD[2]);
  for (const y of [10, 17, 25]) im.set(8, y, WOOD[2]);
  for (const y of [13, 21, 29]) im.set(9, y, WOOD[1]);
  // crossbar with a brace
  im.hline(2, 13, 5, WOOD[3]); im.hline(2, 13, 6, WOOD[1]); im.set(2, 5, WOOD[4]);
  im.line(5, 7, 7, 9, WOOD[1]); im.line(12, 7, 10, 9, WOOD[1]);
  // copper insulators and the brass cap the wire hangs from
  for (const x of [3, 12]) { im.set(x, 3, COPPER[3]); im.set(x, 4, COPPER[2]); }
  im.set(8, 2, BRASS[3]); im.set(7, 2, BRASS[4]); im.set(9, 2, BRASS[2]);
  // iron foot band
  im.hline(7, 9, 31, IRON[1]); im.set(7, 31, IRON[2]);
  im.outline();
  save('pole_wood', im);
}

// ---------- iron pylon (16x38, top 22): tapering lattice, brass crossarm, wire at (8, 2) ----------
{
  // open lattice: legs are 2 px (outline side + lit side), braces 1 px, no outline inside the frame
  const im = new Img(16, 38);
  const L = (y) => Math.round(5 - ((y - 6) / 31) * 3.2), R = (y) => 15 - L(y);
  for (let y = 6; y < 37; y += 7) {
    const y2 = Math.min(36, y + 7);
    im.line(L(y) + 1, y, R(y2) - 1, y2, IRON[1]);
    im.line(R(y) - 1, y, L(y2) + 1, y2, IRON[1]);
    im.hline(L(y) + 1, R(y) - 1, y, IRON[2]);
  }
  for (let y = 6; y <= 37; y++) {
    im.set(L(y), y, INK); im.set(L(y) + 1, y, '#966c6c');
    im.set(R(y), y, INK); im.set(R(y) - 1, y, IRON[1]);
  }
  im.hline(L(37), R(37), 37, INK);
  for (let y = 6; y < 37; y += 7) { im.set(L(y) + 1, y, BRASS[3]); im.set(R(y) - 1, y, BRASS[2]); }
  // brass crossarm and copper insulators, outlined on their own
  const arm = new Img(16, 38);
  arm.hline(1, 14, 4, BRASS[3]); arm.hline(1, 14, 5, BRASS[1]); arm.set(1, 4, BRASS[4]);
  arm.rect(6, 6, 4, 1, BRASS[1]);
  for (const x of [2, 13]) { arm.set(x, 2, COPPER[3]); arm.set(x, 3, COPPER[2]); }
  arm.set(7, 2, BRASS[4]); arm.set(8, 2, BRASS[3]); arm.set(7, 3, BRASS[3]); arm.set(8, 3, BRASS[2]);
  arm.outline();
  im.draw(arm);
  save('pole_iron', im);
}

// ---------- copper tower (32x72, top 40): tall copper lattice, platform, wire at (16, 2) ----------
{
  const im = new Img(32, 72);
  const L = (y) => Math.round(11 - ((y - 8) / 63) * 9), R = (y) => 31 - L(y);
  for (let y = 8; y <= 71; y++) { im.set(L(y), y, COPPER[3]); im.set(L(y) + 1, y, COPPER[2]); im.set(R(y), y, COPPER[1]); im.set(R(y) - 1, y, COPPER[2]); }
  for (let y = 10; y < 70; y += 10) {
    const y2 = Math.min(70, y + 10);
    im.line(L(y) + 2, y, R(y2) - 2, y2, COPPER[2]);
    im.line(R(y) - 2, y, L(y2) + 2, y2, COPPER[1]);
    im.hline(L(y) + 1, R(y) - 1, y, COPPER[1]);
    im.hline(L(y) + 2, R(y) - 2, y - 1, COPPER[3]);
    im.set(L(y), y, BRASS[3]); im.set(R(y), y, BRASS[2]);
  }
  // base plinth of warm stone
  im.rect(L(68) - 1, 68, 4, 4, STONE[2]); im.hline(L(68) - 1, L(68) + 2, 68, STONE[3]);
  im.rect(R(68) - 2, 68, 4, 4, STONE[2]); im.hline(R(68) - 2, R(68) + 1, 68, STONE[3]);
  // platform and crossarm
  im.rect(6, 6, 20, 2, BRASS[2]); im.hline(6, 25, 6, BRASS[3]); im.hline(6, 25, 8, BRASS[0]);
  im.hline(2, 29, 4, BRASS[3]); im.hline(2, 29, 5, BRASS[1]); im.set(2, 4, BRASS[4]);
  for (const x of [3, 9, 22, 28]) { im.set(x, 2, '#0eaf9b'); im.set(x, 3, '#0b8a8f'); }
  // finial and the wire cap at (16, 2)
  im.rect(15, 1, 2, 3, BRASS[3]); im.set(15, 1, BRASS[4]); im.set(16, 0, BRASS[2]);
  im.outline();
  save('pole_tower', im);
}

preview(items, path.resolve(HERE, '../../../e2e/out/factory-props.png'), 4, 8);
console.log(`props: ${items.map((i) => i.name).join(', ')}`);
