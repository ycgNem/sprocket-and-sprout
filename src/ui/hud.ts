// Heads-up display layout: chronometer, factory pulse, minimap, buff, hotbar, toasts, pickups, quest tracker.
// The ornate pieces themselves live in hudparts.ts and pulse.ts.
import { C, PALETTE } from '../data/palette';
import { ITEMS } from '../data/items';
import { itemName, key } from '../sim/inventory';
import { BUFF_INFO } from '../data/buffs';
import { T, Z } from '../sim/world/tilemap';
import { curMap } from '../sim/systems/player';
import { wrapText, textWidth } from './font';
import type { UI } from './ui';
import type { PlayScreen } from '../app/play';
import { drawChronometer, drawHotbar, drawBuildBar, drawRushTracker } from './hudparts';
import { drawPulse } from './pulse';

export interface HudState {
  pickups: { k: number; n: number; t: number }[];
  toasts: { text: string; t: number; icon?: string; color?: number }[];
}

/** Seconds a toast stays up (it fades out over the last 0.7 s). Tips get longer to read. */
export function toastLife(text: string): number {
  return text.startsWith('Tip:') ? 7 : 4.5;
}

export function drawHud(ui: UI, play: PlayScreen, dt: number) {
  const g = play.g;
  const p = g.player;
  // ---- chronometer (top right) ----
  const cw = 120;
  const cx = ui.w - cw - 4, cy = 4;
  const ch0 = drawChronometer(ui, play, cx, cy, cw, dt);
  // ---- factory pulse (working / starved / blocked machines) ----
  const ph = drawPulse(ui, play, cx, cy + ch0 + 3, cw);
  const ch = ch0 + (ph ? ph + 3 : 0);

  // ---- minimap ----
  if (g.player.where !== 'house') drawMinimap(ui, play, ui.w - cw - 4, cy + ch + 4, cw, 70);
  // ---- food buff ----
  const buff = p.buff;
  if (buff) {
    const by = cy + ch + 4 + (p.where !== 'house' ? 74 : 0);
    const info = BUFF_INFO[buff.kind];
    ui.panel(cx, by, cw, 22, 'dark', false);
    ui.itemIcon(key(buff.src), cx + 4, by + 3, 16);
    ui.text(`${info.name} ${'I'.repeat(buff.lvl)}`, cx + 24, by + 4, info.color);
    const left = Math.max(0, Math.ceil(buff.left));
    ui.text(`${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m left`, cx + 24, by + 13, buff.left < 30 ? C.rose : C.pebble);
    if (ui.hover(cx, by, cw, 22)) ui.tip([{ text: `${info.name} ${'I'.repeat(buff.lvl)}`, color: info.color }, { text: info.per + (buff.lvl > 1 ? ` (x${buff.lvl})` : '') }, { text: 'From ' + itemName(key(buff.src)) + '. Sleeping ends it.', color: C.pebble }]);
  }

  // ---- hotbar + gauges ----
  drawHotbar(ui, play, dt);

  // ---- build toolbar (while placing or in an area mode) ----
  drawBuildBar(ui, play);

  // ---- pickups (left) ----
  play.hud.pickups.forEach((pk, i) => {
    const a = pk.t < 2.5 ? 1 : 1 - (pk.t - 2.5) * 2;
    const slide = Math.min(1, pk.t * 6);
    const x = 4 - (1 - slide) * 40, y = ui.h - 60 - i * 20;
    ui.ctx.globalAlpha = Math.max(0, a);
    ui.panel(x, y, 120, 18, 'paper', false);
    ui.itemIcon(pk.k, x + 2, y + 1, 16);
    ui.text(`${ITEMS[pk.k >> 2].name} x${pk.n}`, x + 22, y + 6, C.ink);
    ui.ctx.globalAlpha = 1;
  });

  // ---- toasts (top center) ----
  // toasts make room under an achievement banner
  let toastY = 28 + (play.achQ.length ? 44 : 0);
  // at most three on screen, newest kept; held (not drawn, not aging) while a window is open,
  // since windows cover the top of the screen
  for (const t of play.modalOpen ? [] : play.hud.toasts.slice(-3)) {
    const life = toastLife(t.text);
    const a = t.t < life - 0.7 ? 1 : 1 - (t.t - (life - 0.7)) / 0.7;
    ui.ctx.globalAlpha = Math.max(0, Math.min(1, a, t.t * 6));
    const lines = wrapText(t.text, Math.min(320, ui.w - 240));
    const w = Math.max(...lines.map((l) => textWidth(l))) + 14;
    const h = lines.length * 10 + 5;
    ui.panel(ui.w / 2 - w / 2, toastY, w, h, 'dark', false);
    lines.forEach((l, li) => ui.text(l, ui.w / 2, toastY + 4 + li * 10, t.color ?? C.cream, { align: 'center' }));
    ui.ctx.globalAlpha = 1;
    toastY += h + 2;
  }

  // ---- quest tracker (top left) ----
  const tracker: { title: string; lines: { text: string; done: boolean }[] }[] = g.sys.quests?.tracker?.(g) ?? [];
  let ty = 4;
  ty = drawRushTracker(ui, g, ty);
  for (const q of tracker.slice(0, 3)) {
    const lines = q.lines.flatMap((l) => wrapText((l.done ? '+ ' : '- ') + l.text, 150).map((t, i) => ({ t: i ? '  ' + t : t, done: l.done })));
    const h = 17 + lines.length * 10;
    ui.panel(4, ty, 160, h, 'dark', false);
    ui.fill(4, ty, 160, 1, C.brass);
    ui.text(q.title, 9, ty + 4, C.amber);
    // objective pips
    q.lines.forEach((l, i) => ui.fill(160 - (q.lines.length - i) * 6, ty + 5, 4, 4, l.done ? C.leaf : C.slate));
    lines.forEach((l, i) => ui.text(l.t, 9, ty + 15 + i * 10, l.done ? C.leaf : C.cream));
    ty += h + 3;
  }
  // mine floor
  if (p.where === 'mine') {
    ui.panel(4, ty, 70, 16, 'dark', false);
    ui.text(`Floor ${g.sys.mine?.floor ?? 1}`, 10, ty + 5, C.amber);
  }
}

function drawMinimap(ui: UI, play: PlayScreen, x: number, y: number, w: number, h: number) {
  const g = play.g;
  const m = curMap(g);
  const p = g.player;
  ui.panel(x, y, w, h, 'wood');
  const ix = x + 5, iy = y + 5, iw = w - 10, ih = h - 10;
  const scale = 2; // tiles per minimap pixel
  const ox = Math.floor(p.x - (iw * scale) / 2), oy = Math.floor(p.y - (ih * scale) / 2);
  const cache = play.hud as any;
  const key = `${m === g.map ? 'w' : 'm'}:${Math.floor(ox / 4)}:${Math.floor(oy / 4)}:${g.time.season}:${Math.floor(m.version / 50)}:${g.ents.version >> 4}`;
  if (cache.mmKey !== key || !cache.mm) {
    cache.mmKey = key;
    const c: HTMLCanvasElement = cache.mm ?? document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const cx = c.getContext('2d')!;
    const img = cx.createImageData(iw, ih);
    const snapX = Math.floor(ox / 4) * 4, snapY = Math.floor(oy / 4) * 4;
    cache.mmOx = snapX;
    cache.mmOy = snapY;
    for (let py = 0; py < ih; py++)
      for (let px = 0; px < iw; px++) {
        const tx = snapX + px * scale, ty = snapY + py * scale;
        let col = C.ink;
        if (m.inb(tx, ty)) col = tileColor(g, m, tx, ty);
        const hex = PALETTE[col];
        const i = (py * iw + px) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    cx.putImageData(img, 0, 0);
    cache.mm = c;
  }
  const dx = Math.round((cache.mmOx - ox) / scale), dy = Math.round((cache.mmOy - oy) / scale);
  ui.clip(ix, iy, iw, ih);
  ui.ctx.drawImage(cache.mm, ix + dx, iy + dy);
  // npcs
  if (m === g.map) for (const n of g.sys.npcs?.list ?? []) {
    if (!n.visible) continue;
    const nx = ix + (n.x - ox) / scale, ny = iy + (n.y - oy) / scale;
    ui.fill(Math.round(nx), Math.round(ny), 2, 2, C.lavender);
  }
  ui.fill(ix + iw / 2 - 1, iy + ih / 2 - 1, 3, 3, C.ink);
  ui.fill(ix + iw / 2, iy + ih / 2, 1, 1, C.rose);
  ui.unclip();
  if (ui.hover(x, y, w, h)) {
    ui.tip([{ text: 'Minimap  (M for the full map)' }]);
    if (ui.clicked) {
      ui.eat();
      play.openWindow('map');
    }
  }
}

export function tileColor(g: any, m: any, tx: number, ty: number): number {
  const i = m.idx(tx, ty);
  if (m.buildingAt[i]) return C.brick;
  const e = m === g.map ? g.ents.at(tx, ty) : null;
  if (e) return e.belt ? C.amber : e.def.kind === 'arm' ? C.brass : e.def.kind === 'pole' ? C.copper : C.slate;
  if (m === g.map && g.soil.has(i)) return g.soil.get(i).crop ? C.leaf : C.walnut;
  const o = m.obj[i];
  if (o === 1) return C.pine;
  const t = m.ground[i];
  switch (t) {
    case T.GRASS: case T.TOWNGRASS: return g.time.season === 3 ? C.frost : m.zone[i] === Z.FOREST ? C.moss : C.grass;
    case T.DIRT: return C.oak;
    case T.SAND: return C.butter;
    case T.RIVER: case T.LAKE: case T.POND: case T.OCEAN: return C.river;
    case T.DEEP: return C.deepsea;
    case T.PATH: return C.pebble;
    case T.PLANKS: return C.walnut;
    case T.CLIFF: return C.slate;
    case T.CLIFFTOP: return C.pine;
    case T.ROCK: return C.stone;
    case T.ORE_VEIN: return C.copper;
    case T.MINEFLOOR: return C.walnut;
    case T.MINEWALL: return C.ink;
    case T.LAVA: return C.terracotta;
    case T.GARDEN: return C.bark;
    default: return C.ink;
  }
}
