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

export function registerCharSprites() {
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
