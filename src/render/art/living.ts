// Crops (growth stages, giant crops) and creatures (farm animals, the Deepworks' pests).
import { C, DARK, LIGHT } from '../../data/palette';
import { CROP_BY_ID } from '../../data/crops';
import { ANIMAL_BY_ID, MONSTER_BY_ID } from '../../data/creatures';
import { hash2 } from '../../engine/rng';
import { defSpriteFamily } from '../atlas';
import { PixBuf } from './pixbuf';

/** crop:<id>:<stage>:<ready>:<variant>  16x24 anchored bottom (stage == stages.length means mature) */
function drawCrop(id: string, stage: number, ready: boolean, v: number, dead: boolean): PixBuf {
  const pb = new PixBuf(16, 24);
  const cr = CROP_BY_ID.get(id);
  if (!cr) return pb;
  const { style, leaf, fruit } = cr.look;
  const fruit2 = cr.look.fruit2 ?? DARK[fruit];
  const N = cr.stages.length;
  const t = Math.min(1, stage / N); // growth fraction
  const L = dead ? C.walnut : leaf, Ld = dead ? C.bark : DARK[leaf], Ll = dead ? C.oak : LIGHT[leaf] === C.cream ? leaf : LIGHT[leaf];
  const by = 22; // base y
  if (stage === 0) {
    for (const [x, y] of [[5, 20], [9, 19], [11, 21], [7, 21]]) pb.set(x, y, C.tan);
    return pb;
  }
  if (stage === 1) {
    pb.line(8, by, 8, by - 3, Ld);
    pb.set(7, by - 4, L); pb.set(6, by - 4, Ll); pb.set(9, by - 4, L); pb.set(10, by - 5, Ll);
    pb.outline(C.ink);
    return pb;
  }
  const h = Math.round(4 + t * 10);
  switch (style) {
    case 'leafy':
    case 'root':
    case 'tuber': {
      const r = 2 + t * 4.5;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + v;
        pb.ellipse(8 + Math.cos(a) * r * 0.6, by - 3 - r * 0.4 + Math.sin(a) * r * 0.35, r * 0.55, r * 0.4, i % 2 ? L : Ld);
      }
      if (style === 'leafy') {
        if (ready) { pb.disc(8, by - 4, 3.5, fruit); pb.set(7, by - 6, LIGHT[fruit] === C.cream ? fruit : LIGHT[fruit]); }
        else pb.disc(8, by - 4, 1.5 + t * 1.5, Ll);
      } else if (style === 'root') {
        for (let i = 0; i < 3; i++) pb.line(8, by - 2, 5 + i * 3, by - 5 - h * 0.4, i % 2 ? Ll : L);
        if (ready) { pb.ellipse(8, by - 1, 3, 2, fruit); pb.set(7, by - 2, fruit2); }
      } else if (ready) for (const [x, y] of [[6, by - 8], [10, by - 7]]) { pb.set(x, y, C.cream); pb.set(x + 1, y, C.lavender); }
      break;
    }
    case 'stalk':
    case 'cane':
    case 'grain': {
      const tall = style === 'grain' ? h + 2 : h + 6;
      const n = style === 'grain' ? 4 : style === 'cane' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 8 : 4 + i * (8 / (n - 1 || 1));
        const hh = tall - (i % 2) * 2;
        pb.line(Math.round(x), by, Math.round(x + (i - n / 2) * 0.3), by - hh, style === 'cane' ? (i % 2 ? L : Ll) : L);
        if (style === 'cane') for (let y = by - 3; y > by - hh; y -= 4) pb.set(Math.round(x), y, Ld);
        if (style === 'grain' && ready) { pb.rect(Math.round(x) - 1, by - hh - 2, 2, 4, fruit); pb.set(Math.round(x), by - hh - 3, fruit2); }
      }
      if (style === 'stalk') {
        for (let y = by - 3; y > by - tall + 2; y -= 4) { pb.line(8, y, 4, y - 2, L); pb.line(8, y - 1, 12, y - 3, Ld); }
        if (ready) { pb.ellipse(10, by - tall * 0.55, 1.6, 3, fruit); pb.set(10, by - tall * 0.55 - 3, fruit2); pb.ellipse(6, by - tall * 0.45, 1.4, 2.5, fruit); }
        if (cr.id === 'artichoke' && ready) pb.disc(8, by - tall, 2.5, fruit2);
      }
      break;
    }
    case 'bush':
    case 'vine': {
      const r = 2.5 + t * 3.8;
      if (style === 'vine') { pb.rect(12, by - 16, 1, 16, C.oak); pb.rect(3, by - 16, 1, 16, C.oak); }
      pb.disc(8, by - r - 1, r, L);
      pb.disc(6, by - r, r * 0.6, Ld);
      pb.disc(9.5, by - r * 1.4, r * 0.55, Ll);
      if (style === 'vine') for (let y = by; y > by - 14 * t; y -= 2) { pb.set(4, y, L); pb.set(11, y - 1, L); }
      if (ready) {
        const pts = [[5, by - 4], [10, by - 6], [7, by - 8], [11, by - 3], [4, by - 8]];
        for (const [x, y] of pts) { pb.disc(x, y, cr.id === 'cotton' ? 1.6 : 1.2, fruit); pb.set(x - 1, y - 1, LIGHT[fruit] === C.cream ? fruit : LIGHT[fruit]); }
      } else if (t > 0.6 && cr.look.fruit2) pb.set(7, by - 6, C.cream);
      break;
    }
    case 'flower': {
      pb.line(8, by, 8, by - h, L);
      pb.line(8, by - 3, 5, by - 6, L);
      pb.line(8, by - 5, 11, by - 8, Ld);
      if (ready) {
        if (cr.id === 'sunflower') {
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pb.disc(8 + Math.cos(a) * 3.5, by - h - 2 + Math.sin(a) * 3.5, 1.5, fruit); }
          pb.disc(8, by - h - 2, 2.2, fruit2);
        } else if (cr.id === 'sunbell') {
          pb.ellipse(8, by - h + 1, 3, 3.5, fruit);
          pb.rect(5, by - h + 3, 7, 1, fruit2);
        } else {
          for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; pb.disc(8 + Math.cos(a) * 2.2, by - h - 1 + Math.sin(a) * 2.2, 1.4, fruit); }
          pb.disc(8, by - h - 1, 1.1, fruit2);
        }
      } else pb.ellipse(8, by - h, 1.4, 2, t > 0.6 ? fruit : Ll);
      break;
    }
    case 'gourd': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + v;
        pb.ellipse(8 + Math.cos(a) * 4 * t, by - 3 + Math.sin(a) * 1.5, 2 + t * 1.5, 1.5 + t, i % 2 ? L : Ld);
      }
      pb.line(2, by - 1, 14, by - 2, Ld);
      if (ready) {
        pb.ellipse(8, by - 5, 5, 4, fruit);
        pb.line(5, by - 8, 5, by - 2, fruit2); pb.line(8, by - 9, 8, by - 1, fruit2); pb.line(11, by - 8, 11, by - 2, fruit2);
        pb.set(6, by - 7, LIGHT[fruit] === C.cream ? fruit : LIGHT[fruit]);
      } else if (t > 0.5) pb.disc(9, by - 3, 1.5 + t, fruit);
      break;
    }
    case 'pod': {
      // trellis
      pb.rect(3, by - 18, 1, 18, C.oak); pb.rect(12, by - 18, 1, 18, C.oak);
      for (let y = by - 16; y < by; y += 5) pb.rect(3, y, 10, 1, C.walnut);
      const vh = Math.round(4 + t * 14);
      for (let y = by; y > by - vh; y--) {
        const x = 8 + Math.round(Math.sin(y / 2 + v) * 3);
        pb.set(x, y, L);
        if (y % 2 === 0) { pb.set(x + 1, y, Ll); pb.set(x - 1, y - 1, Ld); }
      }
      if (ready) for (const [x, y] of [[5, by - 6], [10, by - 10], [6, by - 13], [10, by - 4]]) {
        if (cr.id === 'grape') { pb.disc(x, y, 1.6, fruit); pb.set(x, y + 1, fruit2); }
        else if (cr.id === 'cogbean') { pb.disc(x, y, 1.5, fruit); pb.set(x, y, DARK[fruit]); }
        else { pb.rect(x, y, 2, 3, fruit); }
      }
      break;
    }
  }
  pb.outline(C.ink);
  return pb;
}

function drawGiant(id: string): PixBuf {
  const pb = new PixBuf(48, 48);
  const cr = CROP_BY_ID.get(id)!;
  const f = cr.look.fruit, f2 = cr.look.fruit2 ?? DARK[f];
  pb.ellipse(24, 28, 21, 17, f);
  for (let x = 8; x < 42; x += 7) pb.line(x, 14, x + 1, 43, f2);
  pb.ellipse(16, 20, 5, 3, LIGHT[f] === C.cream ? f : LIGHT[f]);
  pb.rect(22, 6, 4, 6, C.moss);
  pb.line(24, 7, 33, 4, C.leaf);
  for (let i = 0; i < 6; i++) pb.ellipse(8 + i * 6.5, 44, 4, 2, i % 2 ? cr.look.leaf : DARK[cr.look.leaf]);
  pb.outline(C.ink);
  return pb;
}

// ---------- animals (side view, facing right) ----------
function drawAnimal(id: string, frame: number, baby: boolean): PixBuf {
  const a = ANIMAL_BY_ID.get(id)!;
  const { body, body2, accent, kind } = a.look;
  const big = a.building === 'barn';
  const W = big ? 24 : 16, H = big ? 20 : 16;
  const pb = new PixBuf(W, H);
  const step = frame % 2;
  const s = baby ? 0.7 : 1;
  const by = H - 1;
  if (!big) {
    if (kind === 'rabbit') {
      pb.ellipse(7, by - 4, 5 * s, 3.5 * s, body);
      pb.disc(11, by - 7 * s, 3 * s, body);
      pb.rect(10, by - 13 * s, 1, 5 * s, body); pb.rect(12, by - 13 * s, 1, 5 * s, body);
      pb.set(10, by - 12 * s, accent); pb.set(12, by - 12 * s, accent);
      pb.set(12, by - 7 * s, C.ink);
      pb.disc(2, by - 5, 1.5, body2);
      pb.rect(5 + step, by - 1, 2, 1, DARK[body]); pb.rect(9 - step, by - 1, 2, 1, DARK[body]);
    } else {
      // birds
      const duck = kind === 'duck';
      pb.ellipse(7, by - 5, 5 * s, 4 * s, body);
      pb.disc(11, by - 9 * s, 2.5 * s, body);
      pb.rect(13, by - 9 * s, 2, 1, duck ? C.amber : C.amber);
      if (duck) pb.rect(13, by - 8 * s, 2, 1, C.amber);
      pb.set(11, by - 10 * s, C.ink);
      if (!duck) { pb.set(11, by - 12 * s, accent); pb.set(10, by - 12 * s, accent); pb.set(12, by - 8 * s, accent); }
      pb.ellipse(6, by - 5, 3 * s, 2 * s, body2);
      pb.rect(1, by - 8 * s, 2, 3 * s, body);
      pb.rect(6 + step, by - 1, 1, 2, C.amber); pb.rect(8 - step, by - 1, 1, 2, C.amber);
    }
  } else {
    const legH = Math.round(5 * s);
    const bodyW = (kind === 'pig' ? 8 : 9) * s, bodyH = (kind === 'alpaca' ? 4 : 5) * s;
    const cy = by - legH - bodyH + 1;
    pb.ellipse(11, cy, bodyW, bodyH, body);
    // spots
    if (kind === 'cow') for (const [x, y] of [[7, cy - 1], [13, cy + 1], [10, cy - 3]]) pb.disc(x, y, 1.8 * s, body2);
    if (kind === 'sheep' || kind === 'alpaca') for (let i = 0; i < 8; i++) pb.disc(4 + i * 2, cy - bodyH + 1 + (i % 2), 1.6 * s, LIGHT[body] === C.cream ? body : LIGHT[body]);
    // legs
    for (const [x, ph] of [[5, 0], [8, 1], [14, 0], [17, 1]] as const) {
      const off = (ph + step) % 2;
      pb.rect(x * s + (1 - s) * 11, by - legH + 1 + off, 2, legH - off, kind === 'sheep' ? C.ink : DARK[body]);
    }
    // head
    const hx = 11 + bodyW, hy = kind === 'alpaca' ? cy - 7 * s : cy - 2 * s;
    if (kind === 'alpaca') pb.rect(hx - 2, hy, 3, 8 * s, body);
    pb.ellipse(hx, hy, (kind === 'pig' ? 3.5 : 3) * s, 3 * s, kind === 'sheep' ? C.ink : body);
    if (kind === 'pig') { pb.rect(hx + 2, hy, 2, 2, accent); pb.set(hx + 3, hy, C.ink); }
    else if (kind === 'cow' || kind === 'goat') pb.rect(hx + 1, hy + 1, 3, 2, accent);
    pb.set(hx, hy - 1, kind === 'sheep' ? C.cream : C.ink);
    // ears / horns
    if (kind === 'goat') { pb.line(hx - 1, hy - 3, hx - 3, hy - 5, C.tan); }
    if (kind === 'cow') { pb.set(hx - 2, hy - 3, C.cream); pb.set(hx + 1, hy - 3, C.cream); }
    pb.set(hx - 2, hy - 2, kind === 'pig' ? accent : DARK[body]);
    // tail
    pb.line(11 - bodyW, cy - 1, 11 - bodyW - 2, cy + 2, kind === 'pig' ? accent : DARK[body]);
  }
  pb.outline(C.ink);
  return pb;
}

// ---------- monsters ----------
function drawMonster(id: string, frame: number): PixBuf {
  const m = MONSTER_BY_ID.get(id)!;
  const { body, body2, eye, kind } = m.look;
  const pb = new PixBuf(20, 20);
  const f = frame % 4;
  switch (kind) {
    case 'blob': {
      const sq = f === 1 ? 1 : f === 3 ? -1 : 0;
      pb.ellipse(10, 14 - (f === 2 ? 3 : 0), 7 + sq, 5 - sq, body);
      pb.ellipse(8, 12 - (f === 2 ? 3 : 0), 3, 2, LIGHT[body] === C.cream ? body : LIGHT[body]);
      pb.rect(7, 13 - (f === 2 ? 3 : 0), 1, 2, eye); pb.rect(12, 13 - (f === 2 ? 3 : 0), 1, 2, eye);
      pb.set(10, 17 - (f === 2 ? 3 : 0), body2);
      break;
    }
    case 'moth': {
      const up = f % 2 === 0;
      pb.ellipse(10, 10, 2, 5, body2);
      pb.ellipse(5, up ? 7 : 11, 4, up ? 5 : 3, body);
      pb.ellipse(15, up ? 7 : 11, 4, up ? 5 : 3, body);
      pb.set(4, up ? 6 : 11, body2); pb.set(16, up ? 6 : 11, body2);
      pb.set(9, 6, eye); pb.set(11, 6, eye);
      pb.line(9, 5, 7, 2, body2); pb.line(11, 5, 13, 2, body2);
      break;
    }
    case 'crab': {
      pb.ellipse(10, 13, 7, 4, body);
      for (let i = 0; i < 4; i++) pb.ellipse(4 + i * 4, 9 + (i % 2), 2.5, 2, body2);
      pb.line(3, 14, 1, 17 - (f % 2), DARK[body]); pb.line(17, 14, 19, 17 - ((f + 1) % 2), DARK[body]);
      pb.disc(3, 11, 2, body); pb.disc(17, 11, 2, body);
      pb.set(8, 11, eye); pb.set(12, 11, eye);
      break;
    }
    case 'wisp': {
      const fl = f % 2;
      pb.disc(10, 10, 6, body2);
      pb.disc(10, 9, 4.5, body);
      pb.disc(10, 8, 2.5, LIGHT[body]);
      for (let i = 0; i < 4; i++) pb.set(6 + i * 3, 16 + ((i + fl) % 2), body2);
      pb.set(8, 9, eye); pb.set(12, 9, eye);
      break;
    }
    case 'mole': {
      const up = f !== 0;
      pb.ellipse(10, 17, 8, 2, C.walnut);
      if (up) {
        pb.ellipse(10, 12, 5, 5, body);
        pb.ellipse(10, 14, 3, 2, body2);
        pb.set(8, 10, eye); pb.set(12, 10, eye);
        pb.rect(9, 13, 2, 1, C.blush);
        pb.rect(4, 14, 3, 2, C.blush); pb.rect(13, 14, 3, 2, C.blush);
      } else for (let i = 0; i < 5; i++) pb.set(6 + i * 2, 15 + (i % 2), C.oak);
      break;
    }
    case 'mite': {
      // a round little ore-eater: a rusty shell on six busy legs, feelers up front
      const step = f % 2;
      for (let i = 0; i < 3; i++) {
        const lx = 6 + i * 4;
        pb.line(lx, 14, lx - 2, 17 - ((i + step) % 2), DARK[body2]);
        pb.line(lx + 2, 14, lx + 4, 17 - ((i + step + 1) % 2), DARK[body2]);
      }
      pb.ellipse(10, 12, 6, 4.5, body2);
      pb.ellipse(10, 11, 5, 3.5, body);
      pb.line(7, 10, 13, 10, LIGHT[body]);
      pb.line(4, 11, 2, 8 - step, body2); pb.line(5, 12, 1, 11, body2);
      pb.set(5, 12, eye); pb.set(6, 13, eye);
      break;
    }
    case 'golem': {
      pb.rect(5, 4, 10, 10, body);
      pb.rect(5, 4, 10, 2, LIGHT[body]);
      for (let i = 0; i < 3; i++) pb.set(7 + i * 3, 9, body2);
      pb.rect(2, 6 + (f % 2), 3, 7, body2); pb.rect(15, 6 + ((f + 1) % 2), 3, 7, body2);
      pb.rect(6, 14, 3, 5 - (f % 2), DARK[body]); pb.rect(11, 14, 3, 4 + (f % 2), DARK[body]);
      pb.rect(7, 6, 2, 2, eye); pb.rect(11, 6, 2, 2, eye);
      break;
    }
  }
  pb.outline(C.ink);
  return pb;
}

export function registerLivingSprites() {
  defSpriteFamily('crop:', (name) => {
    const [, id, st, rd, vs, dd] = name.split(':');
    return { w: 16, h: 24, ox: 0, oy: 8, draw: (ctx) => drawCrop(id, +st, rd === '1', +vs, dd === '1').drawTo(ctx) };
  });
  defSpriteFamily('giant:', (name) => ({ w: 48, h: 48, ox: 0, oy: 0, draw: (ctx) => drawGiant(name.slice(6)).drawTo(ctx) }));
  defSpriteFamily('an:', (name) => {
    const [, id, fs, bs] = name.split(':');
    const a = ANIMAL_BY_ID.get(id);
    if (!a) return null;
    const big = a.building === 'barn';
    const W = big ? 24 : 16, H = big ? 20 : 16;
    return { w: W, h: H, ox: W / 2, oy: H - 1, draw: (ctx) => drawAnimal(id, +fs, bs === '1').drawTo(ctx) };
  });
  defSpriteFamily('mon:', (name) => {
    const [, id, fs] = name.split(':');
    if (!MONSTER_BY_ID.has(id)) return null;
    return { w: 20, h: 20, ox: 10, oy: 18, draw: (ctx) => drawMonster(id, +fs).drawTo(ctx) };
  });
  // weather + fx particles: px:<color>:<size>
  defSpriteFamily('px:', (name) => {
    const [, cs, ss] = name.split(':');
    const n = +ss;
    return { w: n, h: n, ox: n / 2, oy: n / 2, draw: (ctx) => { const pb = new PixBuf(n, n); pb.disc(n / 2, n / 2, n / 2, +cs); pb.drawTo(ctx); } };
  });
  void hash2;
}
