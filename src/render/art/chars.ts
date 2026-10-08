// Code-drawn characters (player + NPCs). 16x24 px, 4 directions, walk + action frames.
import { C, DARK, LIGHT } from '../../data/palette';
import type { NPCLook } from '../../data/types';
import { defSpriteFamily } from '../atlas';
import { PixBuf } from './pixbuf';

const looks = new Map<string, NPCLook>();
export function registerLook(id: string, look: NPCLook) {
  looks.set(id, look);
}
export function getLook(id: string) {
  return looks.get(id);
}

export const CHAR_W = 16, CHAR_H = 24;

/**
 * frame: 0 stand, 1 step A, 2 stand, 3 step B, 4 action raise, 5 action strike
 * dir: 0 up, 1 right, 2 down, 3 left (left is drawn mirrored by the renderer)
 */
function drawChar(look: NPCLook, dir: number, frame: number): PixBuf {
  const pb = new PixBuf(CHAR_W, CHAR_H);
  const child = look.height === 'short';
  const tall = look.height === 'tall';
  const skin = look.skin, hair = look.hair, shirt = look.shirt, pants = look.pants;
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const yo = (child ? 3 : tall ? -1 : 0) + bob; // vertical offset of upper body
  const legTop = child ? 18 : 17;
  const side = dir === 1 || dir === 3;
  // ---- legs ----
  const shoe = C.bark;
  if (!side) {
    const lh = 4 - (child ? 1 : 0);
    const l1 = step > 0 ? 1 : 0, l2 = step < 0 ? 1 : 0;
    pb.rect(5, legTop, 3, lh - l1, pants);
    pb.rect(8, legTop, 3, lh - l2, pants);
    pb.rect(5, legTop + lh - l1, 3, 2, shoe);
    pb.rect(8, legTop + lh - l2, 3, 2, shoe);
  } else {
    const lh = 4 - (child ? 1 : 0);
    if (step === 0) {
      pb.rect(6, legTop, 4, lh, pants);
      pb.rect(6, legTop + lh, 5, 2, shoe);
    } else {
      pb.rect(5, legTop, 3, lh, DARK[pants]);
      pb.rect(4, legTop + lh, 4, 2, shoe);
      pb.rect(8, legTop, 3, lh, pants);
      pb.rect(9, legTop + lh, 4, 2, shoe);
    }
  }
  // ---- torso ----
  const tTop = 10 + yo;
  const tBot = legTop - 1;
  pb.rect(4, tTop, 8, tBot - tTop + 1, shirt);
  pb.rect(4, tTop, 8, 1, LIGHT[shirt] === C.cream ? shirt : LIGHT[shirt]);
  pb.rect(4, tBot, 8, 1, DARK[shirt]);
  if (look.apron && dir !== 0) {
    pb.rect(side ? 7 : 5, tTop + 1, side ? 4 : 6, tBot - tTop + 2, C.cream);
    pb.rect(side ? 7 : 5, tTop + 1, side ? 4 : 6, 1, C.pebble);
  }
  if (look.accent !== undefined && !look.apron && dir === 2) {
    // collar / scarf
    pb.rect(5, tTop, 6, 1, look.accent);
    pb.set(7, tTop + 1, look.accent);
  }
  // ---- arms ----
  const armSwing = side ? 0 : step;
  if (frame === 4 || frame === 5) {
    // tool raise / strike
    if (dir === 2) {
      pb.rect(3, tTop - (frame === 4 ? 3 : -1), 2, 4, shirt);
      pb.rect(11, tTop - (frame === 4 ? 3 : -1), 2, 4, shirt);
      pb.set(3, tTop - (frame === 4 ? 4 : -5), skin);
      pb.set(12, tTop - (frame === 4 ? 4 : -5), skin);
    } else if (dir === 0) {
      pb.rect(3, tTop - 2, 2, 4, shirt);
      pb.rect(11, tTop - 2, 2, 4, shirt);
    } else {
      const ay = frame === 4 ? tTop - 3 : tTop + 2;
      pb.rect(8, ay, 2, 4, shirt);
      pb.rect(10, ay + (frame === 4 ? 0 : 2), 2, 2, skin);
    }
  } else if (!side) {
    pb.rect(3, tTop + 1 + armSwing, 1, 5, shirt);
    pb.rect(12, tTop + 1 - armSwing, 1, 5, shirt);
    pb.set(3, tTop + 6 + armSwing, skin);
    pb.set(12, tTop + 6 - armSwing, skin);
  } else {
    const sw = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    pb.rect(7 + sw, tTop + 1, 2, 5, DARK[shirt]);
    pb.rect(7 + sw, tTop + 6, 2, 1, skin);
  }
  // ---- head ----
  const hTop = 2 + yo, hx = 4;
  pb.rect(hx, hTop, 8, 8, skin);
  pb.rect(hx, hTop + 7, 8, 1, DARK[skin]);
  if (dir === 2) {
    // face
    pb.rect(6, hTop + 4, 1, 2, C.ink);
    pb.rect(9, hTop + 4, 1, 2, C.ink);
    if (skin !== C.bark && skin !== C.walnut) {
      pb.set(5, hTop + 6, C.blush);
      pb.set(10, hTop + 6, C.blush);
    }
    pb.set(7, hTop + 6, DARK[skin]);
    pb.set(8, hTop + 6, DARK[skin]);
    if (look.glasses) {
      pb.rect(5, hTop + 3, 3, 1, C.ink); pb.rect(8, hTop + 3, 3, 1, C.ink);
      pb.set(5, hTop + 4, C.ink); pb.set(10, hTop + 4, C.ink);
    }
  } else if (side) {
    pb.rect(10, hTop + 4, 1, 2, C.ink);
    pb.set(12, hTop + 5, skin);
    if (skin !== C.bark && skin !== C.walnut) pb.set(10, hTop + 6, C.blush);
    if (look.glasses) { pb.rect(9, hTop + 3, 3, 1, C.ink); pb.set(9, hTop + 4, C.ink); }
  }
  // beard
  if (look.beard && dir !== 0) {
    if (side) pb.rect(8, hTop + 6, 4, 3, hair);
    else { pb.rect(5, hTop + 6, 6, 3, hair); pb.set(7, hTop + 6, DARK[skin]); pb.set(8, hTop + 6, DARK[skin]); }
  }
  // ---- hair ----
  const H = hair, Hd = DARK[hair];
  const top = () => { pb.rect(hx, hTop, 8, 3, H); pb.rect(hx, hTop, 8, 1, LIGHT[H] === C.cream ? H : LIGHT[H]); };
  switch (look.hairStyle) {
    case 'bald':
      if (dir !== 2) pb.rect(hx, hTop + 3, 8, 1, H);
      break;
    case 'short':
      top();
      if (dir === 2) { pb.set(hx, hTop + 3, H); pb.set(hx + 7, hTop + 3, H); pb.set(hx + 2, hTop + 3, H); }
      if (side) pb.rect(hx, hTop, 4, 6, H);
      if (dir === 0) pb.rect(hx, hTop, 8, 6, H);
      break;
    case 'spiky':
      top();
      for (let x = hx; x < hx + 8; x += 2) pb.set(x, hTop - 1, H);
      if (side) pb.rect(hx, hTop, 4, 6, H);
      if (dir === 0) pb.rect(hx, hTop, 8, 6, H);
      break;
    case 'curly':
      top();
      for (let x = hx - 1; x <= hx + 8; x += 2) pb.set(x, hTop, H);
      pb.rect(hx - 1, hTop + 1, 1, 5, H); pb.rect(hx + 8, hTop + 1, 1, 5, H);
      for (let y = hTop + 1; y < hTop + 6; y += 2) { pb.set(hx - 1, y, Hd); pb.set(hx + 8, y, Hd); }
      if (dir === 0) pb.rect(hx - 1, hTop, 10, 8, H);
      if (side) pb.rect(hx - 1, hTop, 5, 8, H);
      break;
    case 'long':
    case 'braids':
      top();
      if (dir !== 0) {
        pb.rect(hx - 1, hTop + 1, 2, look.hairStyle === 'braids' ? 3 : 10, H);
        pb.rect(hx + 7, hTop + 1, 2, look.hairStyle === 'braids' ? 3 : 10, H);
        if (look.hairStyle === 'braids') {
          for (let y = hTop + 4; y < hTop + 13; y++) { pb.set(hx - 1, y, y % 2 ? H : Hd); pb.set(hx + 8, y, y % 2 ? H : Hd); }
          pb.set(hx - 1, hTop + 13, look.accent ?? C.rose); pb.set(hx + 8, hTop + 13, look.accent ?? C.rose);
        }
      } else pb.rect(hx - 1, hTop, 10, 12, H);
      if (side) pb.rect(hx - 1, hTop, 5, 12, H);
      break;
    case 'bun':
      top();
      pb.disc(8, hTop - 1, 2.5, H);
      if (side) pb.rect(hx, hTop, 4, 6, H);
      if (dir === 0) pb.rect(hx, hTop, 8, 7, H);
      break;
    case 'ponytail':
      top();
      if (side) { pb.rect(hx, hTop, 4, 6, H); pb.rect(hx - 2, hTop + 2, 2, 7, H); }
      else if (dir === 0) { pb.rect(hx, hTop, 8, 7, H); pb.rect(7, hTop + 7, 2, 5, H); }
      else { pb.set(hx, hTop + 3, H); pb.set(hx + 7, hTop + 3, H); }
      break;
    case 'cap':
    case 'hat': {
      const hc = look.accent ?? C.brick;
      if (look.hairStyle === 'hat') {
        pb.rect(hx - 2, hTop + 2, 12, 1, DARK[hc]);
        pb.rect(hx, hTop - 2, 8, 4, hc);
        pb.rect(hx, hTop + 1, 8, 1, C.ink);
      } else {
        pb.rect(hx, hTop - 1, 8, 4, hc);
        if (dir === 2) pb.rect(hx, hTop + 2, 8, 1, DARK[hc]);
        if (side) pb.rect(hx + 6, hTop + 2, 4, 1, DARK[hc]);
      }
      pb.set(hx, hTop + 3, H); pb.set(hx + 7, hTop + 3, H);
      if (side) pb.rect(hx, hTop + 2, 3, 4, H);
      if (dir === 0) pb.rect(hx, hTop + 2, 8, 5, H);
      break;
    }
  }
  pb.outline(C.ink);
  return pb;
}

/** 32x32 dialogue portraits with moods: 0 neutral, 1 happy, 2 sad, 3 surprised */
function drawPortrait(look: NPCLook, mood: number, elder: boolean): PixBuf {
  const pb = new PixBuf(32, 32);
  const S = look.skin, Sd = DARK[look.skin], Sl = LIGHT[look.skin] === C.cream && look.skin === C.cream ? C.cream : LIGHT[look.skin];
  const H = look.hair, Hd = DARK[look.hair], Hl = LIGHT[look.hair] === C.cream && look.hair !== C.cream ? H : LIGHT[look.hair];
  const child = look.height === 'short';
  const hx = child ? 9 : 8, hw = child ? 14 : 16, hy = child ? 9 : 6, hh = child ? 16 : 18;
  // hair behind the head (long styles)
  if (look.hairStyle === 'long' || look.hairStyle === 'curly') pb.rect(hx - 2, hy + 4, hw + 4, hh + 4, Hd);
  if (look.hairStyle === 'braids') {
    for (let y = hy + 10; y < 31; y++) {
      pb.set(hx - 1, y, y % 2 ? H : Hd);
      pb.set(hx, y, y % 2 ? Hd : H);
      pb.set(hx + hw - 1, y, y % 2 ? H : Hd);
      pb.set(hx + hw, y, y % 2 ? Hd : H);
    }
  }
  // shoulders + shirt
  pb.ellipse(16, 31, 14, 6, look.shirt);
  pb.rect(4, 28, 24, 4, look.shirt);
  pb.rect(4, 28, 24, 1, LIGHT[look.shirt] === C.cream ? look.shirt : LIGHT[look.shirt]);
  if (look.apron) { pb.rect(10, 27, 12, 5, C.cream); pb.rect(10, 27, 1, 5, C.pebble); pb.rect(21, 27, 1, 5, C.pebble); }
  if (look.accent !== undefined && !look.apron) { pb.rect(12, 26, 8, 2, look.accent); pb.set(15, 28, look.accent); pb.set(16, 28, look.accent); }
  // neck
  pb.rect(13, hy + hh - 2, 6, 4, Sd);
  // head
  pb.rect(hx + 1, hy, hw - 2, hh, S);
  pb.rect(hx, hy + 2, hw, hh - 4, S);
  pb.rect(hx + hw - 2, hy + 3, 1, hh - 6, Sd);
  pb.rect(hx + 2, hy + hh - 1, hw - 4, 1, Sd);
  pb.rect(hx + 2, hy + 2, 3, 2, Sl);
  // ears
  pb.rect(hx - 1, hy + 8, 2, 4, S);
  pb.rect(hx + hw - 1, hy + 8, 2, 4, S);
  // eyes
  const ey = hy + (child ? 8 : 9);
  const exL = hx + 3, exR = hx + hw - 6;
  if (mood === 1) {
    // happy closed arcs
    for (const ex of [exL, exR]) { pb.set(ex, ey + 1, C.ink); pb.set(ex + 1, ey, C.ink); pb.set(ex + 2, ey + 1, C.ink); }
  } else {
    for (const ex of [exL, exR]) {
      pb.rect(ex, ey, 3, child ? 4 : 3, C.cream);
      pb.rect(ex + 1, ey, 2, child ? 4 : 3, C.ink);
      pb.set(ex + 1, ey, C.cream);
    }
  }
  // brows
  const by = ey - 2;
  if (mood === 2) { pb.line(exL, by, exL + 2, by + 1, Hd); pb.line(exR, by + 1, exR + 2, by, Hd); }
  else if (mood === 3) { pb.rect(exL, by - 1, 3, 1, Hd); pb.rect(exR, by - 1, 3, 1, Hd); }
  else { pb.rect(exL, by, 3, 1, Hd); pb.rect(exR, by, 3, 1, Hd); }
  // nose + cheeks
  pb.set(16, ey + 3, Sd);
  pb.set(16, ey + 4, Sd);
  if (S !== C.bark && S !== C.walnut) { pb.rect(exL - 1, ey + 4, 2, 1, C.blush); pb.rect(exR + 2, ey + 4, 2, 1, C.blush); }
  // mouth
  const my = ey + 6;
  if (mood === 1) { pb.rect(14, my, 4, 1, C.ink); pb.set(13, my - 1, C.ink); pb.set(18, my - 1, C.ink); pb.rect(14, my + 1, 4, 1, C.rose); }
  else if (mood === 2) { pb.rect(14, my + 1, 4, 1, C.ink); pb.set(13, my + 2, C.ink); pb.set(18, my + 2, C.ink); }
  else if (mood === 3) { pb.rect(15, my, 2, 2, C.ink); }
  else { pb.rect(14, my, 4, 1, Sd); pb.set(14, my, C.ink); pb.set(17, my, C.ink); }
  if (elder) { pb.set(exL - 1, ey + 2, Sd); pb.set(exR + 3, ey + 2, Sd); pb.rect(13, my + 3, 6, 1, Sd); }
  // beard
  if (look.beard) {
    pb.rect(hx + 1, my - 1, hw - 2, hh - (my - hy) + 2, H);
    pb.rect(14, my, 4, 1, mood === 1 ? C.rose : C.ink);
    for (let x = hx + 2; x < hx + hw - 2; x += 2) pb.set(x, hy + hh, Hd);
  }
  // glasses
  if (look.glasses) {
    for (const ex of [exL, exR]) { pb.rect(ex - 1, ey - 1, 5, 1, C.ink); pb.rect(ex - 1, ey + 3, 5, 1, C.ink); pb.set(ex - 1, ey + 1, C.ink); pb.set(ex + 3, ey + 1, C.ink); }
    pb.rect(exL + 4, ey, exR - exL - 5, 1, C.ink);
  }
  // hair on top
  const top = () => {
    pb.rect(hx, hy - 1, hw, 5, H);
    pb.rect(hx + 1, hy - 2, hw - 2, 1, H);
    pb.rect(hx + 2, hy - 1, hw - 6, 1, Hl);
    pb.rect(hx - 1, hy + 2, 2, 6, H);
    pb.rect(hx + hw - 1, hy + 2, 2, 6, H);
  };
  switch (look.hairStyle) {
    case 'bald':
      pb.rect(hx - 1, hy + 6, 2, 5, H);
      pb.rect(hx + hw - 1, hy + 6, 2, 5, H);
      pb.set(hx + 4, hy + 1, Sl);
      break;
    case 'short':
      top();
      pb.rect(hx + 3, hy + 4, 4, 1, H);
      break;
    case 'spiky':
      top();
      for (let x = hx; x < hx + hw; x += 3) { pb.set(x + 1, hy - 3, H); pb.set(x + 1, hy - 4, Hd); }
      break;
    case 'curly':
      top();
      for (let x = hx - 2; x < hx + hw + 2; x += 3) pb.disc(x + 1, hy - 1, 2, H);
      for (let y = hy; y < hy + 16; y += 3) { pb.disc(hx - 2, y, 2, H); pb.disc(hx + hw + 1, y, 2, H); }
      break;
    case 'long':
      top();
      pb.rect(hx - 2, hy + 2, 3, 18, H);
      pb.rect(hx + hw - 1, hy + 2, 3, 18, H);
      break;
    case 'braids':
      top();
      pb.set(hx - 1, 30, look.accent ?? C.rose);
      pb.set(hx + hw, 30, look.accent ?? C.rose);
      break;
    case 'bun':
      top();
      pb.disc(16, hy - 4, 4, H);
      pb.disc(15, hy - 5, 1.5, Hl);
      break;
    case 'ponytail':
      top();
      pb.rect(hx + hw, hy + 3, 3, 12, H);
      pb.set(hx + hw + 1, hy + 15, Hd);
      break;
    case 'cap':
    case 'hat': {
      const hc = look.accent ?? C.brick;
      pb.rect(hx - 1, hy + 2, 2, 6, H);
      pb.rect(hx + hw - 1, hy + 2, 2, 6, H);
      if (look.hairStyle === 'hat') {
        pb.rect(hx - 4, hy + 2, hw + 8, 2, DARK[hc]);
        pb.rect(hx + 1, hy - 5, hw - 2, 7, hc);
        pb.rect(hx + 1, hy + 0, hw - 2, 1, C.ink);
      } else {
        pb.rect(hx, hy - 3, hw, 6, hc);
        pb.rect(hx + 1, hy - 4, hw - 2, 1, hc);
        pb.rect(hx + hw - 4, hy + 2, 8, 2, DARK[hc]);
      }
      break;
    }
  }
  pb.outline(C.ink);
  return pb;
}

export function registerCharSprites() {
  defSpriteFamily('portrait:', (name) => {
    const [, id, ms, es] = name.split(':');
    const look = looks.get(id);
    if (!look) return null;
    return { w: 32, h: 32, draw: (ctx) => drawPortrait(look, +ms, es === '1').drawTo(ctx) };
  });
  defSpriteFamily('ch:', (name) => {
    const [, id, ds, fs] = name.split(':');
    const look = looks.get(id);
    if (!look) return null;
    return { w: CHAR_W, h: CHAR_H, ox: 8, oy: 23, draw: (ctx) => drawChar(look, +ds === 3 ? 1 : +ds, +fs).drawTo(ctx) };
  });
  // soft round shadow
  defSpriteFamily('shadow:', (name) => {
    const w = +name.split(':')[1];
    return {
      w, h: Math.max(3, Math.round(w / 3)), ox: w / 2, oy: Math.max(3, Math.round(w / 3)) / 2,
      draw: (ctx) => {
        const h = Math.max(3, Math.round(w / 3));
        ctx.fillStyle = 'rgba(26,18,32,0.28)';
        for (let y = 0; y < h; y++) {
          const t = 1 - Math.pow((y + 0.5 - h / 2) / (h / 2), 2);
          const ww = Math.round((w / 2) * Math.sqrt(Math.max(0, t)));
          ctx.fillRect(w / 2 - ww, y, ww * 2, 1);
        }
      },
    };
  });
}
