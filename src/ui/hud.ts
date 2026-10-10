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
import { drawNowStrip } from './nowstrip';

export interface HudState {
  pickups: { k: number; n: number; t: number }[];
  toasts: { text: string; t: number; icon?: string; color?: number }[];
  /** screen areas the HUD drew this frame (tracker, toasts, pickups, right column, hotbar), for overlays to avoid */
  occupied?: { x: number; y: number; w: number; h: number }[];
  /** the bottom of the top-left column (Rush tracker + Now strip), where lesson cards hang */
  leftY?: number;
  /** too narrow between the left and right columns (the 960x600 embed): the achievement banner and
   *  toasts stack up from `lowY`, above the hotbar and the build bar, instead of over the Now strip */
  narrow?: boolean;
  lowY?: number;
}

/** Seconds a toast stays up (it fades out over the last 0.7 s). Tips get longer to read. */
export function toastLife(text: string): number {
  return text.startsWith('Tip:') ? 7 : 4.5;
}

export function drawHud(ui: UI, play: PlayScreen, dt: number) {
  const g = play.g;
  const p = g.player;
  const occ: { x: number; y: number; w: number; h: number }[] = (play.hud.occupied = []);
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

  occ.push({ x: cx - 2, y: 0, w: cw + 6, h: cy + ch + 4 + (p.where !== 'house' ? 74 : 0) + (buff ? 26 : 0) });
  // ---- hotbar + gauges ----
  drawHotbar(ui, play, dt);
  occ.push({ x: 0, y: ui.h - 52, w: ui.w, h: 52 });

  // ---- build toolbar (while placing or in an area mode) ----
  drawBuildBar(ui, play);

  // ---- pickups (left) ----
  play.hud.pickups.forEach((pk, i) => {
    const a = pk.t < 2.5 ? 1 : 1 - (pk.t - 2.5) * 2;
    const slide = Math.min(1, pk.t * 6);
    const x = 4 - (1 - slide) * 40, y = ui.h - 60 - i * 20;
    ui.ctx.globalAlpha = Math.max(0, a);
    ui.panel(x, y, 120, 18, 'paper', false);
    occ.push({ x, y, w: 120, h: 18 });
    ui.itemIcon(pk.k, x + 2, y + 1, 16);
    ui.text(`${ITEMS[pk.k >> 2].name} x${pk.n}`, x + 22, y + 6, C.ink);
    ui.ctx.globalAlpha = 1;
  });

  // ---- the Now strip (top left): the one current step and its why (ROADMAP.md 6.2) ----
  let ty = 4;
  ty = drawRushTracker(ui, g, ty);
  const stripTop = ty;
  ty = drawNowStrip(ui, play, ty);
  const leftW = ty > stripTop ? 258 : ty > 4 ? 168 : 0;
  if (ty > 4) occ.push({ x: 0, y: 0, w: leftW, h: ty });
  // lesson cards hang under it (src/ui/lessoncard.ts)
  play.hud.leftY = ty;

  // ---- toasts (top, between the left column and the right one) ----
  // toasts make room under an achievement banner
  let toastY = 28 + (play.achQ.length ? 44 : 0);
  const colL = Math.max(leftW, play.lessons.q.length ? 244 : 0) + 4, colR = cx - 6;
  const midX = colR - colL >= 200 ? Math.round((colL + colR) / 2) : Math.round(ui.w / 2);
  const maxW = colR - colL >= 200 ? Math.min(320, colR - colL) : Math.min(320, ui.w - 240);
  // at most three on screen, oldest first; the rest wait their turn (play.ts ages only these three).
  // Held (not drawn, not aging) while a window is open, since windows cover the top of the screen;
  // a quest ribbon owns the middle of the screen for a moment: toasts wait for it
  // too narrow between the columns (the 960x600 embed): they stack up from above the hotbar (and the
  // build bar, and an achievement banner), clear of the Now strip
  const narrow = colR - colL < 200;
  const buildBar = play.mode !== 'normal' || (!play.win && !!play.heldPlaceable());
  play.hud.narrow = narrow;
  play.hud.lowY = ui.h - 66 - (buildBar ? 36 : 0);
  let lowY = play.hud.lowY - (play.achQ.length ? 42 : 0);
  for (const t of play.modalOpen || play.app.renderer.juice.banners.length ? [] : play.hud.toasts.slice(0, 3)) {
    const life = toastLife(t.text);
    const a = t.t < life - 0.7 ? 1 : 1 - (t.t - (life - 0.7)) / 0.7;
    ui.ctx.globalAlpha = Math.max(0, Math.min(1, a, t.t * 6));
    const lines = wrapText(t.text, maxW - 14);
    const w = Math.max(...lines.map((l) => textWidth(l))) + 14;
    const h = lines.length * 10 + 5;
    const y = narrow ? lowY - h : toastY;
    ui.panel(midX - Math.round(w / 2), y, w, h, 'dark', false);
    occ.push({ x: midX - Math.round(w / 2), y, w, h });
    lines.forEach((l, li) => ui.text(l, midX, y + 4 + li * 10, t.color ?? C.cream, { align: 'center' }));
    ui.ctx.globalAlpha = 1;
    if (narrow) lowY = y - 2;
    else toastY += h + 2;
  }
  // the Deepworks level
  if (p.where === 'mine') {
    ui.panel(4, ty, 70, 16, 'dark', false);
    ui.text(`Level ${g.sys.mine?.floor ?? 1}`, 10, ty + 5, C.amber);
    play.hud.leftY = ty + 20;
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
        let tx = snapX + px * scale, ty = snapY + py * scale;
        // past the overworld's edge, the edge terrain carries on (no black void beside the town)
        if (m === g.map) {
          tx = Math.max(0, Math.min(m.w - 1, tx));
          ty = Math.max(0, Math.min(m.h - 1, ty));
        }
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

/** Map and minimap color of a tile: the terrain sheet's own colors (Resurrect indices). */
export function tileColor(g: any, m: any, tx: number, ty: number): number {
  const i = m.idx(tx, ty);
  if (m.buildingAt[i]) return C.brick;
  const e = m === g.map ? g.ents.at(tx, ty) : null;
  if (e) return e.belt ? C.brass : e.def.kind === 'arm' ? C.gold : e.def.kind === 'pole' ? C.copper : C.mauve;
  if (m === g.map && g.soil.has(i)) return g.soil.get(i).crop ? C.leaf : C.berry;
  const o = m.obj[i];
  const season = g.time.season;
  if (o === 1) return season === 3 ? C.sage : C.fern;
  const t = m.ground[i];
  const grass = season === 3 ? C.frost : season === 2 ? C.moss : C.grass;
  switch (t) {
    case T.GRASS: case T.TOWNGRASS: case T.CLIFFTOP: return m.zone[i] === Z.FOREST && season !== 3 ? C.jade : grass;
    case T.DIRT: return C.apricot;
    case T.SAND: return C.amber;
    case T.RIVER: case T.LAKE: case T.POND: case T.OCEAN: return C.sky;
    case T.DEEP: return C.dusk;
    case T.PATH: return C.oak;
    case T.PLANKS: return C.rust;
    case T.CLIFF: return C.slate;
    case T.ROCK: return C.oak;
    case T.ORE_VEIN: return C.copper;
    case T.MINEFLOOR: return C.rust;
    case T.MINEWALL: return C.ink;
    case T.LAVA: return C.ember;
    case T.GARDEN: return C.berry;
    default: return C.ink;
  }
}
