// Ornate HUD pieces: the sky chronometer (top right), the clockwork hotbar and the steam gauges.
// Everything is drawn from palette rects so it stays pixel-crisp at any UI scale.
import { C } from '../data/palette';
import { SEASON_NAMES, WEEKDAYS } from '../data/types';
import { itemName, kDef } from '../sim/inventory';
import { ICON, textWidth } from './font';
import { itemTooltip } from './tooltips';
import type { UI } from './ui';
import type { PlayScreen } from '../app/play';
import { unlockAch } from '../sim/systems/achievements';
import { RUSH_DAYS, RUSH_MEDALS } from '../data/modes';

/** per-PlayScreen animation state for the HUD */
interface HudFx {
  money: number;
  digits: { d: number; prev: number; t: number }[];
  deltas: { n: number; t: number }[];
  gearA: number;
  lastSel: number;
  selT: number;
  bubbles: { x: number; y: number; v: number }[];
  /** easter-egg state: sun pokes, wiggle timer, gear spin */
  pokes: number;
  wiggle: number;
  spin: number;
  spinV: number;
  gearClicks: number;
}

function fx(play: PlayScreen): HudFx {
  const h = play.hud as any;
  if (!h.fx) h.fx = { money: play.g.player.money, digits: [], deltas: [], gearA: 0, lastSel: play.g.player.sel, selT: 0, bubbles: [], pokes: 0, wiggle: 0, spin: 0, spinV: 0, gearClicks: 0 } as HudFx;
  return h.fx;
}

/** draw a small pixel bitmap; map chars -> palette index, '.' transparent */
export function pix(ui: UI, x: number, y: number, rows: string[], map: Record<string, number>) {
  rows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; xx++) {
      const c = map[r[xx]];
      if (c !== undefined) ui.fill(x + xx, y + yy, 1, 1, c);
    }
  });
}

function disc(ui: UI, cx: number, cy: number, r: number, c: number) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    ui.fill(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

/** a brass cog with `n` teeth, rotated by `a` radians */
export function gear(ui: UI, cx: number, cy: number, r: number, a: number, body = C.brass, shade = C.copper, n = 8) {
  const teeth: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = a + (i / n) * Math.PI * 2;
    teeth.push([Math.round(cx + Math.cos(t) * (r + 0.5)), Math.round(cy + Math.sin(t) * (r + 0.5))]);
  }
  for (const [tx, ty] of teeth) ui.fill(tx - 2, ty - 2, 4, 4, C.ink);
  disc(ui, cx, cy, r, C.ink);
  for (const [tx, ty] of teeth) ui.fill(tx - 1, ty - 1, 2, 2, body);
  disc(ui, cx, cy, r - 1, shade);
  disc(ui, cx - 1, cy - 1, r - 2, body);
  disc(ui, cx, cy, 2, C.ink);
  ui.fill(cx - 1, cy - 1, 2, 1, C.butter);
}

const SEASON_ICON: string[][] = [
  ['...g...', '..ggg..', '.gg.gg.', '...l...', '...l...', '..lll..', '.......'],
  ['...a...', '.a.a.a.', '..yyy..', 'aayyyaa', '..yyy..', '.a.a.a.', '...a...'],
  ['...t...', '.t.t.t.', '.ttttt.', 'ttttttt', '.ttttt.', '...w...', '...w...'],
  ['...f...', '.f.f.f.', '..fff..', 'fffcfff', '..fff..', '.f.f.f.', '...f...'],
];
const SEASON_MAP = { g: C.leaf, l: C.moss, a: C.amber, y: C.butter, t: C.terracotta, w: C.walnut, f: C.frost, c: C.cream };
/** season label colors, dark enough for the peach HUD plate (pine, rust, wine, deep blue: ≥ 4:1) */
export const SEASON_COL: C[] = [29 as C, 20 as C, 19 as C, 45 as C]; // #165a4c #9e4539 #7a3045 #484a77

/** sky colors (top, bottom) for an hour of the day */
function skyCols(h: number, season: number): [number, number, number] {
  const dusk = season === 3 ? 17.5 : season === 1 ? 19.5 : 18.5;
  if (h < 5.5 || h >= dusk + 3) return [C.ink, C.deepsea, C.slate];
  if (h < 6.6) return [C.slate, C.violet, C.blush];
  if (h < 8) return [C.sky, C.aqua, C.butter];
  if (h < dusk) return [C.sky, C.sky, C.aqua];
  if (h < dusk + 1.5) return [C.violet, C.terracotta, C.apricot];
  return [C.deepsea, C.plum, C.wine];
}

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** the little window of sky: sun/moon arc, hills, farmhouse and live weather */
function skyWindow(ui: UI, play: PlayScreen, x: number, y: number, w: number, h: number) {
  const g = play.g;
  const F = fx(play);
  const hr = g.time.min / 60;
  if (g.player.where === 'mine') {
    // underground: rock, stalactites and a swinging lantern instead of the sky
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx += 2) ui.fill(x + xx, y + yy, 2, 1, (xx + yy) & 2 ? C.plum : C.ink);
    for (let i = 0; i < 9; i++) {
      const sx = x + 4 + Math.floor(hash(i + 3) * (w - 8)), len = 3 + Math.floor(hash(i + 9) * 7);
      for (let k = 0; k < len; k++) ui.fill(sx + Math.floor(k / 3), y + k, Math.max(1, 3 - Math.floor(k / 3)), 1, C.slate);
    }
    for (let i = 0; i < 6; i++) ui.fill(x + Math.floor(hash(i + 20) * w), y + h - 2 - Math.floor(hash(i + 30) * 4), 2, 2, i % 2 ? C.aqua : C.lavender);
    const lx = Math.round(x + w / 2 + Math.sin(ui.time * 1.6) * 6), ly = y + 12;
    ui.fill(x + w / 2, y, 1, 1, C.stone);
    for (let k = 0; k < 10; k++) ui.fill(Math.round(x + w / 2 + ((lx - x - w / 2) * k) / 10), y + k, 1, 1, C.stone);
    disc(ui, lx, ly + 2, 5, C.wine);
    disc(ui, lx, ly + 2, 3, C.amber);
    ui.fill(lx - 1, ly + 1, 2, 2, C.butter);
    ui.text(`Floor ${g.sys.mine?.floor ?? 1}`, x + w - 4, y + 3, C.amber, { align: 'right' });
    return;
  }
  const [top, mid, low] = skyCols(hr, g.time.season);
  // sky bands with checker dithering between them
  for (let yy = 0; yy < h; yy++) {
    const f = yy / h;
    for (let xx = 0; xx < w; xx += 2) {
      const odd = (xx + yy) & 2 ? 1 : 0;
      let c = top;
      if (f > 0.75) c = low;
      else if (f > 0.62) c = odd ? low : mid;
      else if (f > 0.4) c = mid;
      else if (f > 0.28) c = odd ? mid : top;
      ui.fill(x + xx, y + yy, 2, 1, c);
    }
  }
  const night = hr < 6 || hr >= 20;
  // stars
  if (g.daylight < 0.5) {
    for (let i = 0; i < 14; i++) {
      const sx = x + Math.floor(hash(i) * w), sy = y + Math.floor(hash(i + 40) * h * 0.6);
      const tw = Math.sin(ui.time * 2 + i * 1.7) > -0.3;
      if (tw) ui.fill(sx, sy, 1, 1, i % 3 ? C.cream : C.butter);
    }
  }
  // sun 6:00-20:00, moon 20:00-2:00
  const bodyFrac = night ? (hr >= 20 ? hr - 20 : hr + 4) / 6 : (hr - 6) / 14;
  F.wiggle = Math.max(0, F.wiggle - 1 / 60);
  const bx = Math.round(x + 6 + bodyFrac * (w - 12) + (F.wiggle > 0 ? Math.sin(ui.time * 50) * 2 : 0));
  const by = Math.round(y + h - 8 - Math.sin(bodyFrac * Math.PI) * (h - 14));
  // easter eggs: poke the sun, say goodnight to the moon
  if (ui.clicked && Math.hypot(ui.mx - bx, ui.my - by) <= 6) {
    ui.eat();
    F.wiggle = 0.35;
    if (night) {
      if (unlockAch(g, 'moon')) g.toast('Goodnight, moon.', undefined, C.lavender);
    } else if (++F.pokes >= 10) {
      if (unlockAch(g, 'sunpoke')) g.toast('The sun squints at you. Rude.', undefined, C.amber);
    } else ui.sfx('click');
  }
  if (night) {
    disc(ui, bx, by, 3, C.cream);
    disc(ui, bx + 2, by - 1, 2, top);
  } else {
    disc(ui, bx, by, 4, C.amber);
    disc(ui, bx, by, 2, C.butter);
    if (Math.floor(ui.time * 2) % 2) {
      ui.fill(bx - 7, by, 2, 1, C.amber);
      ui.fill(bx + 6, by, 2, 1, C.amber);
      ui.fill(bx, by - 7, 1, 2, C.amber);
    }
  }
  // clouds for wet weather
  const wet = g.weather === 'rain' || g.weather === 'storm' || g.weather === 'snow';
  if (wet || g.weather === 'wind') {
    const cc = g.weather === 'storm' ? C.slate : g.weather === 'snow' ? C.pebble : C.stone;
    for (let i = 0; i < 3; i++) {
      const cx = x + ((Math.floor(ui.time * 4 + i * 41) % (w + 30)) - 15);
      const cy = y + 3 + i * 3;
      ui.fill(cx, cy + 2, 16, 4, cc);
      ui.fill(cx + 3, cy, 9, 3, cc);
    }
  }
  // hills (season colored) and the farmhouse
  const hill1 = [C.leaf, C.grass, C.oak, C.frost][g.time.season];
  const hill2 = [C.grass, C.moss, C.terracotta, C.pebble][g.time.season];
  const dim = g.daylight < 0.4;
  for (let xx = 0; xx < w; xx++) {
    const hb = Math.round(6 + Math.sin(xx * 0.09 + 1) * 3 + Math.sin(xx * 0.23) * 1.5);
    const hf = Math.round(4 + Math.sin(xx * 0.06 + 3.5) * 2.5);
    ui.fill(x + xx, y + h - hb, 1, hb, dim ? C.pine : hill2);
    ui.fill(x + xx, y + h - hf, 1, hf, dim ? C.plum : hill1);
  }
  const fx0 = x + w - 26, fy0 = y + h - 12;
  pix(ui, fx0, fy0, ['..rrrrr..', '.rrrrrrr.', 'rrrrrrrrr', '.cwwcwwc.', '.cwwcwdc.', '.cccccdc.'], { r: C.brick, c: dim ? C.slate : C.cream, w: dim ? C.amber : C.sky, d: C.walnut });
  if (g.player.where === 'world' && g.ents.machines.some((m: any) => m.working)) {
    // chimney puff when the factory is busy
    const t = (ui.time * 0.8) % 1;
    ui.fill(fx0 + 6, Math.round(fy0 - 2 - t * 6), 2, 2, C.pebble);
  }
  // falling weather
  if (g.weather === 'rain' || g.weather === 'storm') {
    for (let i = 0; i < 16; i++) {
      const rx = x + Math.floor(hash(i * 3) * w);
      const ry = y + Math.floor((ui.time * 60 + hash(i) * h) % h);
      ui.fill(rx, ry, 1, 2, C.aqua);
    }
    if (g.weather === 'storm' && Math.sin(ui.time * 1.3) > 0.985) ui.fill(x, y, w, h, C.cream, 0.5);
  } else if (g.weather === 'snow') {
    for (let i = 0; i < 12; i++) {
      const rx = x + Math.floor((hash(i * 7) * w + Math.sin(ui.time + i) * 3 + w) % w);
      const ry = y + Math.floor((ui.time * 10 + hash(i) * h) % h);
      ui.fill(rx, ry, 1, 1, C.cream);
    }
  } else if (g.weather === 'wind') {
    for (let i = 0; i < 4; i++) {
      const rx = x + Math.floor((ui.time * 50 + hash(i) * w) % w);
      ui.fill(rx, y + 6 + i * 5, 5, 1, C.cream, 0.6);
    }
  }
}

const WEATHER_NAME: Record<string, string> = { sun: 'Sunny', rain: 'Rain', storm: 'Storm', snow: 'Snow', wind: 'Breezy' };

function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor((min % 60) / 10) * 10;
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

/** brass-framed panel used by the chronometer and gauges */
export function brassFrame(ui: UI, x: number, y: number, w: number, h: number) {
  ui.fill(x + 2, y + h, w - 2, 2, C.ink, 0.4);
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, C.copper);
  ui.fill(x + 1, y + 1, w - 2, 1, C.amber);
  ui.fill(x + 1, y + 1, 1, h - 2, C.brass);
  ui.fill(x + 2, y + h - 2, w - 3, 1, C.brick);
  for (const [rx, ry] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) {
    ui.fill(rx, ry, 2, 2, C.butter);
    ui.fill(rx + 1, ry + 1, 1, 1, C.brick);
  }
}

/** The top-right chronometer: sky window, date plate and the rolling coin counter. Returns its height. */
export function drawChronometer(ui: UI, play: PlayScreen, x: number, y: number, w: number, dt: number): number {
  const g = play.g, p = g.player, F = fx(play);
  const h = 70;
  brassFrame(ui, x, y, w, h);
  // sky window
  const sx = x + 5, sy = y + 5, sw = w - 10, sh = 30;
  ui.fill(sx - 1, sy - 1, sw + 2, sh + 2, C.ink);
  ui.clip(sx, sy, sw, sh);
  skyWindow(ui, play, sx, sy, sw, sh);
  ui.unclip();
  // time on a small plaque over the sky
  const tstr = fmtTime(g.time.min);
  const tw = textWidth(tstr) + 8;
  ui.fill(sx, sy + sh - 10, tw, 10, C.ink, 0.7);
  ui.text(tstr, sx + 4, sy + sh - 9, g.time.min >= 1440 ? C.rose : C.cream);
  // the clock is slowed (building / cozy) or stopped (sandbox)
  const rate = g.clockRate;
  if (rate < 1 && !g.sleeping) {
    const lbl = rate === 0 ? 'paused' : rate === 0.5 ? 'x1/2' : rate === 0.25 ? 'x1/4' : 'x1/8';
    const lw = textWidth(lbl) + 6;
    ui.fill(sx + tw, sy + sh - 10, lw, 10, C.ink, 0.7);
    ui.text(lbl, sx + tw + 3, sy + sh - 9, C.amber);
  }
  if (ui.hover(sx, sy, sw, sh)) ui.tip([{ text: `${tstr}  -  ${WEATHER_NAME[g.weather]}` }, { text: `Tomorrow: ${WEATHER_NAME[g.tomorrow]}`, color: C.pebble }, { text: `Wind: ${Math.round(g.wind * 100)}%`, color: C.pebble }, { text: 'You pass out at 2am.', color: C.pebble }]);
  // date plate
  const dy = sy + sh + 3;
  ui.fill(sx - 1, dy, sw + 2, 12, C.ink);
  ui.fill(sx, dy + 1, sw, 10, C.butter);
  ui.fill(sx, dy + 1, sw, 1, C.cream);
  ui.text(`${WEEKDAYS[g.weekday]} ${g.time.day}`, sx + 3, dy + 3, C.walnut);
  pix(ui, sx + sw - 9, dy + 3, SEASON_ICON[g.time.season], SEASON_MAP);
  ui.text(SEASON_NAMES[g.time.season], sx + sw - 12, dy + 3, SEASON_COL[g.time.season], { align: 'right' });
  if (g.time.year > 1) ui.text('Y' + g.time.year, sx + 40, dy + 3, C.oak);
  // odometer
  const oy = dy + 14;
  drawOdometer(ui, play, F, sx - 1, oy, sw + 2, dt);
  if (ui.hover(x, y, w, h)) {
    ui.block(x, y, w, h);
    if (!ui.tooltip) ui.tip([{ text: `Year ${g.time.year}, ${SEASON_NAMES[g.time.season]} ${g.time.day}` }, { text: `Money: ${p.money.toLocaleString()}` }, { text: `Earned in total: ${g.earned.toLocaleString()}`, color: C.pebble }]);
  }
  return h;
}

function drawOdometer(ui: UI, play: PlayScreen, F: HudFx, x: number, y: number, w: number, dt: number) {
  const J = play.app.renderer.juice;
  const real = Math.max(0, Math.floor(play.g.player.money));
  if (real !== F.money) {
    F.deltas.push({ n: real - F.money, t: 0 });
    if (F.deltas.length > 3) F.deltas.shift();
    F.money = real;
  }
  // coins still flying toward the counter haven't arrived yet: the digits roll as they land
  const money = Math.max(0, real - Math.floor(J.moneyHeld));
  J.anchors.money = { x: x + 8, y: y + 7 };
  const bump = J.moneyBump < 0.12;
  const str = String(money);
  const nd = Math.max(5, str.length);
  const padded = str.padStart(nd, ' ');
  while (F.digits.length < nd) F.digits.unshift({ d: -1, prev: -1, t: 1 });
  while (F.digits.length > nd) F.digits.shift();
  ui.fill(x, y, w, 14, C.ink);
  ui.fill(x + 1, y + 1, w - 2, 12, C.plum);
  // coin (it flashes and jumps a pixel as each flying coin lands)
  const cy = y + 7 - (bump ? 1 : 0);
  disc(ui, x + 8, cy, 4, bump ? C.butter : C.brass);
  disc(ui, x + 8, cy, 2, bump ? C.cream : C.amber);
  ui.fill(x + 8, cy - 2, 1, 4, C.copper);
  const cw = 7;
  const x0 = x + w - 3 - nd * cw;
  for (let i = 0; i < nd; i++) {
    const ch = padded[i];
    const d = ch === ' ' ? -1 : +ch;
    const cell = F.digits[i];
    if (cell.d !== d) {
      cell.prev = cell.d;
      cell.d = d;
      cell.t = 0;
    }
    cell.t = Math.min(1, cell.t + dt * 7);
    const cx = x0 + i * cw;
    ui.fill(cx, y + 2, cw - 1, 10, C.ink);
    ui.clip(cx, y + 2, cw - 1, 10);
    const off = Math.round((1 - cell.t) * 10);
    if (cell.d >= 0) ui.text(String(cell.d), cx + 1, y + 4 + off, C.cream);
    else ui.text('0', cx + 1, y + 4, C.plum);
    if (cell.t < 1 && cell.prev >= 0) ui.text(String(cell.prev), cx + 1, y + 4 + off - 10, C.pebble);
    ui.unclip();
    // glass shine
    ui.fill(cx, y + 2, cw - 1, 1, C.slate);
  }
  // the latest change rises out of the strip, left of the digits
  F.deltas = F.deltas.filter((d) => (d.t += dt) < 1.6);
  const d = F.deltas[F.deltas.length - 1];
  if (d) {
    const a = d.t < 1.1 ? 1 : 1 - (d.t - 1.1) / 0.5;
    ui.ctx.globalAlpha = Math.max(0, a);
    const s = (d.n > 0 ? '+' : '') + d.n.toLocaleString();
    ui.clip(x + 14, y + 1, x0 - x - 16, 12);
    ui.text(s, x0 - 3, y + 4 + Math.round(Math.max(0, 0.25 - d.t) * 32), d.n > 0 ? C.lime : C.blush, { align: 'right' });
    ui.unclip();
    ui.ctx.globalAlpha = 1;
  }
}

/** glass tube gauge with bubbling liquid */
function tubeGauge(ui: UI, x: number, y: number, h: number, frac: number, col: number, icon: string, iconCol: number, t: number) {
  const w = 10;
  ui.fill(x - 1, y - 1, w + 2, h + 2, C.ink);
  ui.fill(x, y, w, h, C.plum);
  const fh = Math.round((h - 4) * Math.max(0, Math.min(1, frac)));
  const fy = y + h - 2 - fh;
  ui.fill(x + 2, fy, w - 4, fh, col);
  if (fh > 2) {
    ui.fill(x + 2, fy, w - 4, 1, C.cream);
    // bubbles
    for (let i = 0; i < 3; i++) {
      const by = y + h - 3 - ((t * 9 + i * 11) % Math.max(1, fh - 2));
      if (by > fy + 1) ui.fill(x + 3 + ((i * 2) % 4), Math.round(by), 1, 1, C.cream);
    }
  }
  // glass shine + brass caps
  ui.fill(x + 1, y + 2, 1, h - 4, C.slate);
  ui.fill(x - 1, y - 3, w + 2, 3, C.ink);
  ui.fill(x, y - 2, w, 2, C.brass);
  ui.fill(x - 1, y + h, w + 2, 3, C.ink);
  ui.fill(x, y + h, w, 2, C.brass);
  ui.text(icon, x + 2, y - 12, iconCol, { shadow: C.ink });
}

/** The clockwork hotbar with gear end-caps and steam gauges. */
export function drawHotbar(ui: UI, play: PlayScreen, dt: number) {
  const g = play.g, p = g.player, F = fx(play);
  const S = 20, gap = 3, N = 12;
  const inner = N * (S + gap) - gap;
  const capW = 16;
  const hw = inner + capW * 2 + 8;
  const hx = Math.floor((ui.w - hw) / 2), hy = ui.h - S - 17;
  if (F.lastSel !== p.sel) {
    F.lastSel = p.sel;
    F.selT = 0;
  }
  F.selT += dt;
  // gears turn toward the selected slot
  const targetA = p.sel * (Math.PI / 4);
  F.gearA += (targetA - F.gearA) * Math.min(1, dt * 10);
  F.spin += F.spinV * dt;
  F.spinV *= Math.pow(0.25, dt);
  // housing
  const by = hy - 5, bh = S + 16;
  ui.fill(hx + 2, by + bh, hw - 2, 2, C.ink, 0.4);
  ui.fill(hx, by, hw, bh, C.ink);
  ui.fill(hx + 1, by + 1, hw - 2, bh - 2, C.bark);
  ui.fill(hx + 1, by + 1, hw - 2, 2, C.walnut);
  ui.fill(hx + 1, by + 3, hw - 2, 1, C.brass);
  ui.fill(hx + 1, by + bh - 3, hw - 2, 1, C.copper);
  // end caps with turning gears
  for (const side of [0, 1]) {
    const cx = side ? hx + hw - capW / 2 - 3 : hx + capW / 2 + 3;
    const gy = by + Math.floor(bh / 2);
    const ang = F.gearA + F.spin;
    gear(ui, cx, gy, 6, side ? -ang : ang);
    if (ui.clicked && ui.hover(cx - 8, gy - 8, 16, 16)) {
      ui.eat();
      F.spinV += 9;
      ui.sfx('rotate');
      if (++F.gearClicks >= 25) unlockAch(g, 'gearhead');
    }
  }
  const slotsX = hx + capW + 4;
  const block = ui.hover(hx, by, hw, bh);
  if (block) ui.block(hx, by, hw, bh);
  const J = play.app.renderer.juice;
  J.anchors.bag = { x: hx + hw - capW / 2 - 3, y: by + Math.floor(bh / 2) };
  for (let i = 0; i < N; i++) {
    const sx = slotsX + i * (S + gap);
    const sel = p.sel === i;
    // a slot hops when a harvested crop or a reward lands in it
    const lift = (sel ? -2 : 0) + J.slotLift(i);
    J.anchors.slots[i] = { x: sx + S / 2, y: hy + 1 + S / 2 };
    const st = p.inv.slots[i];
    if (sel) {
      // glow frame
      const pulse = Math.sin(ui.time * 4) > 0 ? C.butter : C.amber;
      ui.fill(sx - 2, hy + lift - 1, S + 4, S + 4, C.ink);
      ui.fill(sx - 1, hy + lift, S + 2, S + 2, pulse);
    }
    const r = ui.slot(sx, hy + 1 + lift, st, { selected: false });
    if (!sel && !st) ui.fill(sx + 1, hy + 2, S - 2, S - 2, C.oak, 0.35);
    // brass key tag below each slot
    if (i < 10) {
      const lbl = String((i + 1) % 10);
      ui.text(lbl, sx + S / 2, hy + S + 2, sel ? C.amber : C.oak, { align: 'center' });
    }
    if (r.click) p.sel = i;
    if (r.hover && st) ui.tip(itemTooltip(g, st.k, st.n));
  }
  // selection pointer
  const px = slotsX + p.sel * (S + gap) + S / 2;
  const bob = Math.round(Math.sin(ui.time * 5));
  pix(ui, px - 3, hy - 11 + bob, ['ooooooo', 'oaaaaao', '.oaaao.', '..oao..', '...o...'], { o: C.ink, a: C.amber });
  const sel = p.inv.slots[p.sel];
  // watering can level
  if (sel && kDef(sel.k).tool?.kind === 'can') {
    const cap = [40, 55, 70, 85, 100][kDef(sel.k).tool!.tier];
    ui.bar(slotsX + p.sel * (S + gap), hy + S - 3, S, 4, p.water / cap, C.sky);
  }
  if (play.charge > 0) ui.text('x'.repeat(play.charge), px, hy - 20, C.amber, { align: 'center', shadow: C.ink });
  // item name ribbon: shows for a moment after switching, or while hovering the bar
  if (sel && (F.selT < 2.4 || block)) {
    const name = itemName(sel.k);
    const a = block ? 1 : F.selT < 2 ? 1 : 1 - (F.selT - 2) / 0.4;
    const nw = textWidth(name) + 14;
    const ny = hy - 26 - (play.charge > 0 ? 8 : 0);
    ui.ctx.globalAlpha = Math.max(0, a);
    ui.fill(ui.w / 2 - nw / 2 - 1, ny - 1, nw + 2, 13, C.ink);
    ui.fill(ui.w / 2 - nw / 2, ny, nw, 11, C.walnut);
    ui.fill(ui.w / 2 - nw / 2, ny, nw, 1, C.oak);
    ui.fill(ui.w / 2 - nw / 2 - 3, ny + 3, 3, 5, C.walnut);
    ui.fill(ui.w / 2 + nw / 2, ny + 3, 3, 5, C.walnut);
    ui.text(name, ui.w / 2, ny + 2, C.cream, { align: 'center' });
    ui.ctx.globalAlpha = 1;
  }
  // gauges: energy on the right of the bar, health on the left when it matters
  const maxE = p.maxEnergy + g.mods.energy;
  const gh = 52;
  const gx = hx + hw + 6, gy = ui.h - gh - 6;
  const ef = Math.max(0, p.energy / maxE);
  const ecol = ef > 0.5 ? C.leaf : ef > 0.2 ? C.amber : C.rose;
  const lowE = ef < 0.2 && Math.sin(ui.time * 8) > 0;
  tubeGauge(ui, gx, gy, gh, ef, ecol, ICON.bolt, lowE ? C.rose : C.amber, ui.time);
  if (ui.hover(gx - 2, gy - 12, 14, gh + 16)) ui.tip([{ text: `Energy ${Math.max(0, Math.round(p.energy))} / ${maxE}` }, { text: 'Tools use energy. Eat food or sleep to recover.', color: C.pebble }]);
  if (p.where === 'mine' || p.hp < p.maxHp) {
    const hx2 = hx - 16;
    tubeGauge(ui, hx2, gy, gh, p.hp / p.maxHp, C.rose, ICON.heart, C.rose, ui.time + 3);
    if (ui.hover(hx2 - 2, gy - 12, 14, gh + 16)) ui.tip([{ text: `Health ${Math.round(p.hp)} / ${p.maxHp}` }]);
  }
  void ICON;
}

/** Build toolbar: shown above the hotbar while placing or in an area mode; replaces the old text banner. */
export function drawBuildBar(ui: UI, play: PlayScreen) {
  const placing = !play.win && !!play.heldPlaceable();
  if (play.mode === 'normal' && !placing) return;
  const tools: { id: 'rotate' | 'decon' | 'copy' | 'paste'; key: string; label: string }[] = [
    { id: 'rotate', key: 'R', label: 'Rotate' },
    { id: 'decon', key: 'X', label: 'Remove' },
    { id: 'copy', key: 'V', label: 'Copy' },
    { id: 'paste', key: 'B', label: 'Paste' },
  ];
  const bw = 62, gap = 3;
  const w = tools.length * (bw + gap) - gap + 8;
  const x = Math.floor(ui.w / 2 - w / 2), y = ui.h - 20 - 17 - 46;
  ui.fill(x, y, w, 22, C.ink, 0.88);
  ui.fill(x, y, w, 1, C.brass);
  tools.forEach((t, i) => {
    const active = play.mode === t.id;
    const disabled = t.id === 'paste' && !play.blueprint;
    if (ui.button('bb_' + t.id, x + 4 + i * (bw + gap), y + 4, bw, 15, `${t.key} ${t.label}`, { active, disabled, style: 'flat' })) {
      if (t.id === 'rotate') play.rotateAction();
      else {
        play.mode = active ? 'normal' : t.id;
        play.rectStart = null;
      }
    }
  });
  const msg = play.mode === 'decon' ? 'Drag a box to pick structures back up' : play.mode === 'copy' ? 'Drag a box to copy it as a blueprint' : play.mode === 'paste' ? 'Click to paste, R rotates' : 'Click to place, drag for a line. Time runs slow while you build.';
  ui.text(msg, ui.w / 2, y - 10, play.mode === 'decon' ? C.blush : C.cream, { align: 'center', shadow: C.ink });
  if (ui.hover(x, y, w, 22)) ui.block(x, y, w, 22);
}

/** Clockwork Rush progress box at the top of the quest column; returns the next y. */
export function drawRushTracker(ui: UI, g: PlayScreen['g'], y: number): number {
  if (g.mode !== 'rush' || g.sys.mode?.done) return y;
  const names = ['Bronze', 'Silver', 'Gold'];
  const next = RUSH_MEDALS.findIndex((m) => g.earned < m);
  const day = Math.min(RUSH_DAYS, g.daysPlayed + 1);
  // projected season total from the pace so far (today counts by the fraction of it that has passed)
  const elapsed = g.daysPlayed + Math.max(0.05, (g.time.min - 360) / 1200);
  const projected = Math.round((g.earned / elapsed) * RUSH_DAYS);
  const paceMedal = RUSH_MEDALS.filter((m) => projected >= m).length;
  ui.panel(4, y, 160, 46, 'dark', false);
  ui.fill(4, y, 160, 1, C.brass);
  ui.text(`Clockwork Rush  -  day ${day}/${RUSH_DAYS}`, 9, y + 4, C.amber);
  ui.text(`Earned ${g.earned.toLocaleString()}`, 9, y + 14, C.cream);
  const goal = next >= 0 ? RUSH_MEDALS[next] : RUSH_MEDALS[2];
  const prev = next > 0 ? RUSH_MEDALS[next - 1] : 0;
  ui.bar(9, y + 25, 100, 6, next >= 0 ? (g.earned - prev) / (goal - prev) : 1, next === 0 ? C.copper : next === 1 ? C.pebble : C.brass, C.plum);
  ui.text(next >= 0 ? `${names[next]} ${(goal / 1000).toFixed(0)}k` : 'Gold!', 114, y + 24, C.butter);
  ui.text(paceMedal ? `On pace for ${names[paceMedal - 1]}` : 'Not on pace for a medal yet', 9, y + 34, paceMedal ? C.lime : C.blush);
  return y + 49;
}
