// Heads-up display: clock & weather, money, energy/health, hotbar, toasts, pickups, minimap, quest tracker.
import { C, PALETTE } from '../data/palette';
import { SEASON_NAMES, WEEKDAYS } from '../data/types';
import { ITEMS } from '../data/items';
import { itemName, kDef, key } from '../sim/inventory';
import { BUFF_INFO } from '../data/buffs';
import { T, Z } from '../sim/world/tilemap';
import { curMap } from '../sim/systems/player';
import { ICON, wrapText, textWidth } from './font';
import { itemTooltip } from './tooltips';
import type { UI } from './ui';
import type { PlayScreen } from '../app/play';

export interface HudState {
  pickups: { k: number; n: number; t: number }[];
  toasts: { text: string; t: number; icon?: string; color?: number }[];
}

export function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor((min % 60) / 10) * 10;
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

const WEATHER_COL: Record<string, number> = { sun: C.amber, rain: C.sky, storm: C.slate, snow: C.frost, wind: C.leaf };
const WEATHER_NAME: Record<string, string> = { sun: 'Sunny', rain: 'Rain', storm: 'Storm', snow: 'Snow', wind: 'Breezy' };

function weatherIcon(ui: UI, x: number, y: number, w: string) {
  const f = (xx: number, yy: number, ww: number, hh: number, c: number) => ui.fill(x + xx, y + yy, ww, hh, c);
  if (w === 'sun') {
    f(3, 3, 6, 6, C.amber);
    f(5, 0, 2, 12, C.amber);
    f(0, 5, 12, 2, C.amber);
    f(4, 4, 4, 4, C.butter);
  } else if (w === 'rain' || w === 'storm') {
    f(1, 2, 10, 5, w === 'storm' ? C.slate : C.pebble);
    f(3, 0, 6, 3, w === 'storm' ? C.slate : C.pebble);
    f(2, 8, 1, 2, C.sky);
    f(5, 9, 1, 2, C.sky);
    f(8, 8, 1, 2, C.sky);
    if (w === 'storm') { f(6, 7, 2, 2, C.amber); f(5, 9, 2, 2, C.amber); }
  } else if (w === 'snow') {
    f(5, 1, 2, 10, C.frost);
    f(1, 5, 10, 2, C.frost);
    f(2, 2, 2, 2, C.cream);
    f(8, 8, 2, 2, C.cream);
  } else {
    f(0, 3, 9, 1, C.leaf);
    f(2, 6, 10, 1, C.leaf);
    f(0, 9, 7, 1, C.leaf);
  }
}

export function drawHud(ui: UI, play: PlayScreen, dt: number) {
  const g = play.g;
  const p = g.player;
  void dt;
  // ---- clock panel (top right) ----
  const cw = 104, ch = 54;
  const cx = ui.w - cw - 4, cy = 4;
  ui.panel(cx, cy, cw, ch, 'wood');
  const day = `${WEEKDAYS[g.weekday]}. ${g.time.day}`;
  ui.text(day, cx + 10, cy + 9, C.walnut);
  ui.text(SEASON_NAMES[g.time.season], cx + cw - 10, cy + 9, [C.leaf, C.amber, C.terracotta, C.sky][g.time.season], { align: 'right' });
  ui.text(fmtTime(g.time.min), cx + 10, cy + 21, C.ink);
  weatherIcon(ui, cx + cw - 22, cy + 19, g.weather);
  if (ui.hover(cx + cw - 24, cy + 17, 16, 16)) ui.tip([{ text: `Today: ${WEATHER_NAME[g.weather]}` }, { text: `Tomorrow: ${WEATHER_NAME[g.tomorrow]}`, color: C.pebble }, { text: `Wind: ${Math.round(g.wind * 100)}%`, color: C.pebble }]);
  // sun/moon dial
  const frac = Math.min(1, (g.time.min - 360) / 1200);
  ui.fill(cx + 10, cy + 31, cw - 20, 3, C.walnut);
  ui.fill(cx + 10, cy + 31, Math.round((cw - 20) * frac), 3, frac > 0.7 ? C.violet : C.amber);
  ui.fill(cx + 6, cy + 38, cw - 12, 11, C.tan);
  ui.text(`${ICON.coin} ${p.money.toLocaleString()}`, cx + cw - 10, cy + 40, C.ink, { align: 'right' });
  if (ui.hover(cx, cy, cw, ch)) {
    ui.block(cx, cy, cw, ch);
    if (!ui.tooltip) ui.tip([{ text: `Year ${g.time.year}, ${SEASON_NAMES[g.time.season]} ${g.time.day}` }, { text: `Earned in total: ${g.earned.toLocaleString()}`, color: C.pebble }]);
  }

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

  // ---- energy / health ----
  const maxE = p.maxEnergy + g.mods.energy;
  const bh = 70;
  const ex = ui.w - 18, ey = ui.h - bh - 8;
  ui.fill(ex - 1, ey - 1, 12, bh + 2, C.ink);
  ui.fill(ex, ey, 10, bh, C.walnut);
  const ef = Math.max(0, p.energy / maxE);
  const ecol = ef > 0.5 ? C.leaf : ef > 0.2 ? C.amber : C.rose;
  ui.fill(ex + 2, ey + 2 + Math.round((bh - 4) * (1 - ef)), 6, Math.round((bh - 4) * ef), ecol);
  ui.text('E', ex + 3, ey - 10, C.cream, { shadow: C.ink });
  if (ui.hover(ex - 2, ey - 2, 14, bh + 4)) ui.tip([{ text: `Energy ${Math.max(0, Math.round(p.energy))} / ${maxE}` }, { text: 'Tools use energy. Eat food or sleep to recover.', color: C.pebble }]);
  if (p.where === 'mine' || p.hp < p.maxHp) {
    const hx = ex - 16;
    ui.fill(hx - 1, ey - 1, 12, bh + 2, C.ink);
    ui.fill(hx, ey, 10, bh, C.walnut);
    const hf = Math.max(0, p.hp / p.maxHp);
    ui.fill(hx + 2, ey + 2 + Math.round((bh - 4) * (1 - hf)), 6, Math.round((bh - 4) * hf), C.rose);
    ui.text(ICON.heart, hx + 2, ey - 10, C.rose, { shadow: C.ink });
    if (ui.hover(hx - 2, ey - 2, 14, bh + 4)) ui.tip([{ text: `Health ${Math.round(p.hp)} / ${p.maxHp}` }]);
  }

  // ---- hotbar ----
  const S = 20, gap = 2;
  const hw = 12 * (S + gap) + 8;
  const hx = Math.floor((ui.w - hw) / 2), hy = ui.h - S - 12;
  ui.panel(hx, hy - 4, hw, S + 8 + 4, 'wood');
  for (let i = 0; i < 12; i++) {
    const sx = hx + 5 + i * (S + gap);
    const st = p.inv.slots[i];
    const r = ui.slot(sx, hy + 1, st, { selected: p.sel === i });
    if (i < 10) ui.text(String((i + 1) % 10), sx + 1, hy + 1, C.walnut);
    if (r.click) p.sel = i;
    if (r.hover && st) ui.tip(itemTooltip(g, st.k, st.n));
  }
  // watering can level / charge
  const sel = p.inv.slots[p.sel];
  if (sel && kDef(sel.k).tool?.kind === 'can') {
    const cap = [40, 55, 70, 85, 100][kDef(sel.k).tool!.tier];
    ui.bar(hx + 5 + p.sel * (S + gap), hy - 6, S, 4, p.water / cap, C.sky);
  }
  if (play.charge > 0) ui.text('x'.repeat(play.charge), hx + 5 + p.sel * (S + gap) + S / 2, hy - 14, C.amber, { align: 'center', shadow: C.ink });
  // selected item name
  if (sel) {
    const name = itemName(sel.k);
    ui.text(name, ui.w / 2, hy - 16, C.cream, { align: 'center', shadow: C.ink });
  }

  // ---- build mode banner ----
  if (play.mode !== 'normal') {
    const msg = play.mode === 'decon' ? 'DECONSTRUCT: drag a box to pick up structures  (Esc to cancel)' : play.mode === 'copy' ? 'COPY: drag a box to copy a blueprint  (Esc to cancel)' : 'PASTE: click to place, R to rotate  (Esc to cancel)';
    ui.panel(ui.w / 2 - 150, 6, 300, 16, 'dark', false);
    ui.text(msg, ui.w / 2, 11, play.mode === 'decon' ? C.blush : C.aqua, { align: 'center' });
  }

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
  let toastY = 28;
  for (const t of play.hud.toasts) {
    const life = t.text.startsWith('Tip:') ? 9 : 4.5;
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
  for (const q of tracker.slice(0, 2)) {
    const h = 14 + q.lines.length * 10;
    ui.panel(4, ty, 150, h, 'dark', false);
    ui.text(q.title, 9, ty + 4, C.amber);
    q.lines.forEach((l, i) => ui.text((l.done ? '+ ' : '- ') + l.text, 9, ty + 14 + i * 10, l.done ? C.leaf : C.cream));
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
