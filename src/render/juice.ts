// Reward feedback ("juice"): the layer that answers every action within a frame or two.
// World parts (sprite effects, confetti, rings, entity and crop hops) draw in world pixels
// right after the particles; flights (items into their hotbar slot, coins into the odometer),
// the streak counter and banners draw in UI space above the HUD. Sprite names come from the
// juice sheet (src/art/juice.*); every effect has a code-drawn fallback while a name is missing.
// Everything stays on whole pixels: motion is integer offsets and frames, never fractional scaling.
import { C, PALETTE, rgba } from '../data/palette';
import { drawItemIcon, drawSprite, hasImage, sprite } from './atlas';
import { drawText, ellipsize, textWidth } from '../ui/font';
import type { UI } from '../ui/ui';

/** A pentatonic ladder: repeated sounds climb it, so streaks and coin showers play a rising tune. */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export function ladderPitch(step: number) {
  return Math.pow(2, LADDER[Math.max(0, Math.min(step, LADDER.length - 1))] / 12);
}

/** frames per effect name, used when the sheet is missing too */
const FRAMES: Record<string, number> = { 'fx:coin': 6, 'fx:star': 4, 'fx:puff': 5, 'fx:glint': 4, 'fx:heart': 2, 'fx:streak': 3, 'fx:arrow': 4, 'fx:gust': 4, 'fx:pile': 4, 'fx:chest': 3, 'fx:compass': 8, 'fx:ring': 9, 'fx:scroll': 4, 'fx:seal': 3 };
export const fxFrames = (name: string) => FRAMES[name] ?? 1;

const disc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: number) => {
  ctx.fillStyle = PALETTE[c];
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
};

/** Draw frame `f` of an effect centred (or bottom-anchored, per the sheet) at x,y. */
export function drawFx(ctx: CanvasRenderingContext2D, name: string, f: number, x: number, y: number) {
  const n = fxFrames(name);
  f = ((f % n) + n) % n;
  x = Math.round(x);
  y = Math.round(y);
  const full = `${name}:${f}`;
  if (hasImage(full)) return drawSprite(ctx, sprite(full), x, y);
  // code-drawn stand-ins
  const px = (dx: number, dy: number, w: number, h: number, c: number) => {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  switch (name) {
    case 'fx:coin': {
      const w = [4, 3, 1, 0, 1, 3][f];
      px(-w - 1, -4, w * 2 + 3, 9, C.ink);
      px(-w, -3, w * 2 + 1, 7, C.amber);
      if (w > 1) px(-w + 1, -3, 1, 4, C.butter);
      px(0, -2, 1, 5, C.brass);
      break;
    }
    case 'fx:star': {
      const r = [2, 4, 5, 6][f];
      const c = f < 2 ? C.cream : C.butter;
      px(-r, 0, r * 2 + 1, 1, c);
      px(0, -r, 1, r * 2 + 1, c);
      if (f < 3) {
        const d = Math.floor(r * 0.6);
        px(-d, -d, 1, 1, C.butter); px(d, -d, 1, 1, C.butter); px(-d, d, 1, 1, C.butter); px(d, d, 1, 1, C.butter);
      }
      if (f === 0) px(-1, -1, 3, 3, C.cream);
      break;
    }
    case 'fx:puff': {
      const r = [2, 3, 4, 5, 5][f];
      ctx.globalAlpha *= f >= 3 ? 0.5 : 0.85;
      disc(ctx, x - 1, y, r, C.pebble);
      disc(ctx, x + 1, y - 1, r - 1, C.cream);
      ctx.globalAlpha /= f >= 3 ? 0.5 : 0.85;
      break;
    }
    case 'fx:glint': {
      const r = [1, 3, 4, 2][f];
      px(-r, 0, r * 2 + 1, 1, C.cream);
      px(0, -r, 1, r * 2 + 1, C.cream);
      px(0, 0, 1, 1, C.butter);
      break;
    }
    case 'fx:heart':
      px(-3, -2, 2, 1, C.rose); px(1, -2, 2, 1, C.rose);
      px(-4, -1, 8, 2, C.rose); px(-3, 1, 6, 1, C.rose); px(-2, 2, 4, 1, C.rose); px(-1, 3, 2, 1, C.rose);
      px(-3, -1, 1, 1, C.blush);
      break;
    case 'fx:streak': {
      const h = [9, 11, 10][f];
      px(-3, -h + 3, 6, h - 3, C.terracotta);
      px(-2, -h + 1, 4, h - 2, C.amber);
      px(-1, -h + 4, 2, h - 5, C.butter);
      px(-4, -3, 8, 3, C.terracotta);
      break;
    }
    case 'fx:arrow': {
      const bob = [0, -1, -2, -1][f];
      const rows = ['ooooooo', 'oaaaaao', '.oaaao.', '..oao..', '...o...'];
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') px(i - 3, j - 5 + bob, 1, 1, r[i] === 'o' ? C.ink : C.amber); });
      break;
    }
    case 'fx:gust': {
      ctx.globalAlpha *= 0.6;
      const o = f * 2;
      px(-8 + o, -2, 7, 1, C.cream); px(-4 + o, 1, 9, 1, C.frost);
      ctx.globalAlpha /= 0.6;
      break;
    }
    case 'fx:pile': {
      const w = 3 + f * 2;
      for (let i = 0; i <= f; i++) px(-w + i * 2, -2 - i * 2, (w - i * 2) * 2, 2, i % 2 ? C.butter : C.amber);
      break;
    }
    case 'fx:compass': {
      // a stubby pointer: a dot with its tip pushed out toward direction f (0 up, clockwise)
      const ux = [0, 1, 1, 1, 0, -1, -1, -1][f], uy = [-1, -1, 0, 1, 1, 1, 0, -1][f];
      px(-2, -2, 5, 5, C.ink); px(-1, -1, 3, 3, C.amber);
      px(ux * 3 - 1, uy * 3 - 1, 3, 3, C.ink); px(ux * 3, uy * 3, 1, 1, C.butter);
      break;
    }
    case 'fx:ring': {
      px(-4, -4, 9, 9, C.ink);
      px(-3, -3, 7, 7, C.plum);
      const n = Math.round((f / 8) * 7);
      if (n) px(-3, 3, n, 1, C.lime);
      break;
    }
    case 'fx:chest':
      px(-6, -9, 12, 9, C.walnut); px(-6, -9, 12, 2, C.oak); px(-1, -6, 2, 2, C.brass);
      if (f > 0) px(-5, -12, 10, 3, f > 1 ? C.butter : C.amber);
      break;
    default:
      px(-1, -1, 3, 3, C.cream);
  }
}

interface Anim { name: string; x: number; y: number; vx: number; vy: number; g: number; t: number; life: number; fps: number; loop: boolean }
interface Icon { id: string; x: number; y: number; vy: number; t: number; life: number }
interface Bit { x: number; y: number; vx: number; vy: number; t: number; life: number; c: number; w: number; h: number; ph: number }
interface Ring { x: number; y: number; t: number; max: number; r0: number; r1: number; c: number }
interface Pop { text: string; x: number; y: number; t: number; c: number; scale: number }
/** the post courier: flies in (0), perches on the crate and grabs the parcel (1), flies off (2) */
interface Courier { x0: number; y0: number; tx: number; ty: number; x: number; y: number; t: number; phase: 0 | 1 | 2; flip: boolean }
const C_ARRIVE = 0.7, C_PERCH = 0.45, C_LEAVE = 1.6;
export interface Pt { x: number; y: number }
export interface Flight {
  kind: 'item' | 'coin';
  id?: string;
  x0: number; y0: number;
  /** Bezier control point (UI px) */
  cx: number; cy: number;
  t: number; dur: number; delay: number;
  to: () => Pt;
  land?: () => void;
}
export interface Banner { title: string; sub: string; color: number; icon?: string; t: number; items: { id: string; n: number }[]; /** seconds before it drops in */ wait?: number }

/** a little arc of integer offsets: up, hang, land with a one-pixel dip */
const HOP = [0, -2, -3, -4, -4, -3, -2, -1, 0, 1, 1, 0];

export class Juice {
  // ---- world space ----
  anims: Anim[] = [];
  icons: Icon[] = [];
  bits: Bit[] = [];
  rings: Ring[] = [];
  pops: Pop[] = [];
  couriers: Courier[] = [];
  private hops = new Map<number, number>();
  private tileHops = new Map<number, number>();
  // ---- UI space ----
  flights: Flight[] = [];
  uiBits: Bit[] = [];
  banners: Banner[] = [];
  /** coins on their way to the odometer: the odometer shows money minus this */
  moneyHeld = 0;
  /** HUD anchors, refreshed every frame the HUD draws */
  anchors: { money: Pt; slots: Pt[]; bag: Pt } = { money: { x: 0, y: 0 }, slots: [], bag: { x: 0, y: 0 } };
  /** time since a hotbar slot / the odometer last received something (for the bump) */
  slotBump: number[] = [];
  moneyBump = 9;
  streak = { n: 0, t: 9, punch: 9 };
  time = 0;
  /** sound hook (set by the play screen) */
  sfx: (id: string, v?: number, pitch?: number) => void = () => {};

  // ------------------------------------------------------------------ spawners
  /** a sprite effect at world px x,y; it plays its frames once (or loops for `life`) */
  fx(name: string, x: number, y: number, o: { vx?: number; vy?: number; g?: number; fps?: number; life?: number; loop?: boolean } = {}) {
    if (this.anims.length > 400) return;
    const fps = o.fps ?? 14;
    this.anims.push({ name, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, t: 0, fps, loop: !!o.loop, life: o.life ?? fxFrames(name) / fps });
  }

  /** an item icon popping up out of a machine or crate (world px) */
  iconPop(id: string, x: number, y: number) {
    if (this.icons.length > 60) this.icons.shift();
    this.icons.push({ id, x, y, vy: -28, t: 0, life: 1.1 });
  }

  /** a burst of paper confetti (world px, or UI px with ui = true) */
  confetti(x: number, y: number, n: number, ui = false, spread = 60) {
    const cols = [C.rose, C.amber, C.butter, C.leaf, C.sky, C.lavender, C.cream];
    const list = ui ? this.uiBits : this.bits;
    if (list.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = spread * (0.5 + Math.random() * 0.8);
      list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 1 + Math.random() * 0.8, c: cols[i % cols.length], w: Math.random() < 0.5 ? 2 : 1, h: Math.random() < 0.5 ? 1 : 2, ph: Math.random() * 6 });
    }
  }

  /** the brass mail-bird lands on the crate at (tx, ty) (world px, its feet), grabs the parcel and leaves */
  courier(tx: number, ty: number) {
    this.couriers.push({ x0: tx - 70, y0: ty - 64, tx, ty, x: tx - 70, y: ty - 64, t: 0, phase: 0, flip: false });
  }

  /** seconds until a courier spawned now grabs the parcel (coins burst then) */
  static readonly COURIER_GRAB = C_ARRIVE + C_PERCH * 0.5;

  /** a big number that pops up and hangs for a moment (world px; whole-pixel text scale) */
  pop(text: string, x: number, y: number, c = C.butter, scale = 2) {
    if (this.pops.length > 30) this.pops.shift();
    this.pops.push({ text, x, y, t: 0, c, scale });
  }

  /** a ribbon that jumps the queue (it plays next, after the one already showing) */
  bannerNext(b: Omit<Banner, 't'>) {
    const i = this.banners.length && this.banners[0].t > 0 ? 1 : 0;
    this.banners.splice(i, 0, { ...b, t: 0 });
  }

  ring(x: number, y: number, c = C.butter, r1 = 18, max = 0.45) {
    this.rings.push({ x, y, t: 0, max, r0: 2, r1, c });
  }

  /** a structure (by entity id) or a crop (by tile index) hops */
  hop(id: number) { this.hops.set(id, 0); }
  hopTile(i: number) { this.tileHops.set(i, 0); }
  hopOf(id: number) { const t = this.hops.get(id); return t === undefined ? 0 : HOP[Math.min(HOP.length - 1, Math.floor(t * 40))]; }
  tileHopOf(i: number) { const t = this.tileHops.get(i); return t === undefined ? 0 : HOP[Math.min(HOP.length - 1, Math.floor(t * 40))]; }

  /** an item flies from a UI point into the hotbar slot that holds it (or the bag) */
  flyItem(id: string, from: Pt, slot: number, delay = 0, land?: () => void) {
    if (this.flights.length > 80) return;
    const to = () => (slot >= 0 && this.anchors.slots[slot]) || this.anchors.bag;
    this.flights.push({ kind: 'item', id, x0: from.x, y0: from.y, cx: from.x + (Math.random() - 0.5) * 30, cy: from.y - 46, t: 0, dur: 0.6, delay, to, land: () => {
      if (slot >= 0) this.slotBump[slot] = 0;
      land?.();
    } });
  }

  /** a shower of coins from a UI point into the odometer, carrying `amount` between them */
  coins(from: Pt, amount: number, wait = 0) {
    if (amount <= 0) return;
    const n = Math.max(3, Math.min(14, 2 + Math.floor(Math.log2(amount + 1))));
    let left = amount;
    for (let i = 0; i < n; i++) {
      const share = i === n - 1 ? left : Math.floor(amount / n);
      left -= share;
      this.moneyHeld += share;
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 26;
      this.flights.push({
        kind: 'coin', x0: from.x, y0: from.y, cx: from.x + Math.cos(a) * r, cy: from.y + Math.sin(a) * r * 0.6 - 30,
        t: 0, dur: 0.55 + Math.random() * 0.15, delay: wait + i * 0.055, to: () => this.anchors.money,
        land: () => {
          this.moneyHeld = Math.max(0, this.moneyHeld - share);
          this.moneyBump = 0;
          this.sfx('coin_tick', 0.8, ladderPitch(i % 9));
        },
      });
    }
  }

  banner(b: Omit<Banner, 't'>) {
    this.banners.push({ ...b, t: 0 });
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    this.time += dt;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      a.vy += a.g * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.t >= a.life) this.anims.splice(i, 1);
    }
    for (let i = this.icons.length - 1; i >= 0; i--) {
      const c = this.icons[i];
      c.t += dt;
      c.vy *= Math.pow(0.02, dt);
      c.y += c.vy * dt;
      if (c.t >= c.life) this.icons.splice(i, 1);
    }
    for (const list of [this.bits, this.uiBits])
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.t += dt;
        b.vy += 90 * dt;
        b.vx *= Math.pow(0.15, dt);
        b.vy = Math.min(b.vy, 26);
        b.x += (b.vx + Math.sin(b.t * 9 + b.ph) * 8) * dt;
        b.y += b.vy * dt;
        if (b.t >= b.life) list.splice(i, 1);
      }
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) >= this.rings[i].max) this.rings.splice(i, 1);
    for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) >= 1.3) this.pops.splice(i, 1);
    for (let i = this.couriers.length - 1; i >= 0; i--) {
      const c = this.couriers[i];
      c.t += dt;
      if (c.phase === 0) {
        const k = Math.min(1, c.t / C_ARRIVE), e = 1 - (1 - k) * (1 - k);
        c.x = c.x0 + (c.tx - c.x0) * e;
        c.y = c.y0 + (c.ty - c.y0) * e;
        c.flip = false;
        if (k >= 1) { c.phase = 1; c.t = 0; }
      } else if (c.phase === 1) {
        if (c.t >= C_PERCH) { c.phase = 2; c.t = 0; }
      } else {
        const k = c.t / C_LEAVE;
        c.x = c.tx + 90 * k * k + 20 * k;
        c.y = c.ty - 80 * k * k - 10 * k;
        if (k >= 1) this.couriers.splice(i, 1);
      }
    }
    for (const m of [this.hops, this.tileHops])
      for (const [k, t] of m) {
        if (t + dt > HOP.length / 40) m.delete(k);
        else m.set(k, t + dt);
      }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt;
      if (f.t >= f.dur) {
        this.flights.splice(i, 1);
        f.land?.();
      }
    }
    if (!this.flights.some((f) => f.kind === 'coin')) this.moneyHeld = 0;
    for (let i = 0; i < this.slotBump.length; i++) if (this.slotBump[i] !== undefined) this.slotBump[i] += dt;
    this.moneyBump += dt;
    this.streak.t += dt;
    this.streak.punch += dt;
  }

  /** integer lift for a hotbar slot that just caught something */
  slotLift(i: number) {
    const t = this.slotBump[i];
    return t === undefined || t > 0.25 ? 0 : HOP[Math.min(HOP.length - 1, Math.floor(t * 48))];
  }

  // ------------------------------------------------------------------ draw
  /** world layer: call with the world transform set */
  drawWorld(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      const k = r.t / r.max;
      const rad = Math.round(r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)));
      ctx.fillStyle = rgba(r.c, 1 - k);
      const steps = Math.max(12, Math.ceil(rad * 7));
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        ctx.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.7), 1, 1);
      }
    }
    for (const a of this.anims) {
      const n = fxFrames(a.name);
      const f = a.loop ? Math.floor(a.t * a.fps) % n : Math.min(n - 1, Math.floor(a.t * a.fps));
      drawFx(ctx, a.name, f, a.x, a.y);
    }
    for (const c of this.icons) {
      ctx.globalAlpha = c.t > c.life - 0.3 ? Math.max(0, (c.life - c.t) / 0.3) : 1;
      drawItemIcon(ctx, c.id, Math.round(c.x - 5), Math.round(c.y - 5), 10);
      ctx.globalAlpha = 1;
    }
    for (const c of this.couriers) {
      const fr = Math.floor(this.time * 12) % 6;
      const name = c.phase === 1 ? `courier:perch:${c.t > C_PERCH * 0.35 && c.t < C_PERCH * 0.8 ? 1 : 0}` : c.phase === 0 ? `courier:fly:${fr}` : `courier:carry:${fr}`;
      const x = Math.round(c.x), y = Math.round(c.y);
      if (hasImage(name)) drawSprite(ctx, sprite(name), x, y, 1, c.flip);
      else {
        // stand-in: a brass body with flapping copper wings
        ctx.fillStyle = PALETTE[C.ink]; ctx.fillRect(x - 4, y - 8, 9, 7);
        ctx.fillStyle = PALETTE[C.brass]; ctx.fillRect(x - 3, y - 7, 7, 5);
        ctx.fillStyle = PALETTE[C.amber]; ctx.fillRect(x + 2, y - 6, 1, 1);
        if (c.phase !== 1) { ctx.fillStyle = PALETTE[C.copper]; ctx.fillRect(x - 6, y - 9 - (fr % 2) * 2, 4, 2); ctx.fillRect(x + 3, y - 9 - (fr % 2) * 2, 4, 2); }
        if (c.phase === 2) { ctx.fillStyle = PALETTE[C.oak]; ctx.fillRect(x - 2, y - 1, 5, 4); }
      }
    }
    for (const p of this.pops) {
      const k = Math.min(1, p.t / 0.3);
      const lift = Math.round(12 * (1 - (1 - k) * (1 - k)));
      ctx.globalAlpha = p.t > 1 ? Math.max(0, (1.3 - p.t) / 0.3) : 1;
      const sc = p.t < 0.06 ? p.scale + 1 : p.scale;
      drawText(ctx, p.text, Math.round(p.x - (textWidth(p.text) * sc) / 2), Math.round(p.y - lift - 9 * sc), PALETTE[p.c], sc, PALETTE[C.ink]);
      ctx.globalAlpha = 1;
    }
    this.drawBits(ctx, this.bits);
  }

  private drawBits(ctx: CanvasRenderingContext2D, list: Bit[]) {
    for (const b of list) {
      ctx.globalAlpha = b.t > b.life - 0.3 ? Math.max(0, (b.life - b.t) / 0.3) : 1;
      ctx.fillStyle = PALETTE[b.c];
      const flip = Math.sin(b.t * 14 + b.ph) > 0;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), flip ? b.w : b.h, flip ? b.h : b.w);
    }
    ctx.globalAlpha = 1;
  }

  /** where the current ribbon sits (UI px), so other overlays can keep clear of it */
  bannerRect(uiW: number, uiH: number): { x: number; y: number; w: number; h: number } | null {
    const b = this.banners[0];
    if (!b || (b.wait ?? 0) > 0) return null;
    const w = this.bannerW(b, uiW);
    return { x: Math.round(uiW / 2 - w / 2) - 10, y: Math.round(Math.max(72, uiH * 0.24)), w: w + 20, h: 44 };
  }

  /** ribbons stay between the quest tracker (left) and the chronometer column (right) */
  private bannerW(b: Banner, uiW: number) {
    const maxW = Math.max(200, uiW - 328);
    return Math.min(maxW, Math.max(200, Math.max(textWidth(b.title) * 2, textWidth(b.sub)) + 64));
  }

  /**
   * UI layer: flights, streak counter, banners. `head` = the player's head in UI px. Drawn
   * through the UI kit (fill/text) so the overlap audit sees the streak and the ribbons.
   */
  drawUI(ui: UI, head: Pt | null, modal: boolean, dt: number) {
    const ctx = ui.ctx;
    for (const f of this.flights) {
      if (f.delay > 0) continue;
      const to = f.to();
      const k = Math.min(1, f.t / f.dur);
      const e = k * k * (1.4 - 0.4 * k); // linger near the start, then zip in
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * f.cx + e * e * to.x;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * f.cy + e * e * to.y;
      if (f.kind === 'coin') drawFx(ctx, 'fx:coin', Math.floor(this.time * 16 + f.x0), x, y);
      else if (f.id) drawItemIcon(ctx, f.id, Math.round(x - 8), Math.round(y - 8), 16);
    }
    this.drawBits(ctx, this.uiBits);
    // harvest streak over the player's head (beside it while a ribbon holds the middle)
    const s = this.streak;
    if (head && s.n >= 3 && s.t < 1.8 && !modal) {
      const a = s.t > 1.4 ? (1.8 - s.t) / 0.4 : 1;
      ctx.globalAlpha = a;
      const big = s.punch < 0.08;
      const sc = big ? 3 : 2;
      const txt = 'x' + s.n;
      const w = textWidth(txt) * sc + 14;
      const br = this.bannerRect(ui.w, ui.h);
      let x = Math.round(head.x - w / 2), y = Math.round(head.y - 22 - (big ? 2 : 0));
      if (br && y < br.y + br.h + 2) {
        x = Math.round(head.x + 12);
        y = Math.max(Math.round(head.y - 4), br.y + br.h + 4);
      }
      // a soft ink pill keeps the number readable over golden crops at any UI scale
      ui.fill(x + 9, y - 2, w - 7, 9 * sc + 2, C.ink, 0.55);
      drawFx(ctx, 'fx:streak', Math.floor(this.time * 10), x + 5, y + 9 * sc - 2);
      ui.text(txt, x + 12, y, s.n >= 25 ? C.rose : s.n >= 10 ? C.butter : C.cream, { scale: sc, shadow: C.ink });
      ctx.globalAlpha = 1;
    }
    // banners wait for a modal window to close, like toasts
    if (this.banners.length && !modal) this.drawBanner(ui, this.banners[0], dt);
  }

  /** the ribbon drops in below the toast and achievement lane, above the player */
  private drawBanner(ui: UI, b: Banner, dt: number) {
    if ((b.wait ?? 0) > 0) {
      b.wait! -= dt;
      return;
    }
    const ctx = ui.ctx;
    const HOLD = 3.2;
    const w = this.bannerW(b, ui.w), h = 44;
    const sub = ellipsize(b.sub, w - 48);
    const x = Math.round(ui.w / 2 - w / 2);
    const k = b.t < 0.25 ? b.t / 0.25 : b.t > HOLD ? 1 - (b.t - HOLD) / 0.3 : 1;
    const y = Math.round(Math.max(72, ui.h * 0.24) - 16 * (1 - k) * (1 - k));
    ctx.globalAlpha = Math.min(1, k * 1.5);
    // ribbon: dark outline, coloured body, brass trim, folded tails
    ui.fill(x - 10, y + 8, 12, h - 12, C.ink); ui.fill(x + w - 2, y + 8, 12, h - 12, C.ink);
    ui.fill(x - 9, y + 9, 10, h - 14, C.wine); ui.fill(x + w - 1, y + 9, 10, h - 14, C.wine);
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 2, b.color);
    ui.fill(x + 1, y + 1, w - 2, 2, C.butter);
    ui.fill(x + 1, y + h - 3, w - 2, 2, C.copper);
    ui.fill(x + 3, y + 4, w - 6, 1, C.brass);
    ui.text(b.title, ui.w / 2, y + 8, C.cream, { scale: 2, shadow: C.ink, align: 'center' });
    ui.text(sub, ui.w / 2 + 8, y + 29, C.butter, { shadow: C.ink, align: 'center' });
    const chestF = b.t < 0.35 ? 0 : b.t < 0.5 ? 1 : 2;
    drawFx(ctx, 'fx:chest', chestF, x + 18, y + h - 8);
    if (chestF === 2 && Math.floor(this.time * 6) % 3 === 0) drawFx(ctx, 'fx:glint', Math.floor(this.time * 12), x + 18 + Math.round(Math.sin(this.time * 7) * 5), y + h - 22);
    ctx.globalAlpha = 1;
    b.t += dt;
    if (b.t > HOLD + 0.3) this.banners.shift();
  }
}
