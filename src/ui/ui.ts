// Immediate-mode UI kit drawn on canvas in "UI pixels" (screen / uiScale).
import { C, PALETTE, rgba } from '../data/palette';
import type { Input } from '../engine/input';
import { sprite, drawFit, drawItemIcon } from '../render/atlas';
import { drawText, textWidth, wrapText, LINE_H, FONT_H } from './font';
import { ITEMS } from '../data/items';
import type { AuditRec, AuditKind } from './audit';

export interface Rect { x: number; y: number; w: number; h: number }
export interface TipLine { text: string; color?: number; icon?: string }

export type PanelStyle = 'wood' | 'paper' | 'dark' | 'slot' | 'brass' | 'inset';

export class UI {
  ctx!: CanvasRenderingContext2D;
  input!: Input;
  scale = 2;
  w = 0;
  h = 0;
  mx = 0;
  my = 0;
  /** mouse is over some UI element this frame */
  captured = false;
  private blocks: Rect[] = [];
  private prevBlocks: Rect[] = [];
  tooltip: TipLine[] | null = null;
  tipWidth = 180;
  time = 0;
  /** the stack being dragged with the mouse */
  hand: { k: number; n: number } | null = null;
  clicked = false;
  rclicked = false;
  /** key -> scroll offset */
  scroll = new Map<string, number>();
  focus: string | null = null;
  hoverId: string | null = null;
  sfx: (id: string) => void = () => {};
  /** debug: record what each frame draws for the overlap audit (src/ui/audit.ts, npm run screens) */
  audit = false;
  /** the last complete frame's records, while audit is on */
  lastAudit: AuditRec[] = [];
  private auditLog: AuditRec[] = [];
  private auditLayer: AuditRec['layer'] = 'ui';
  private clips: Rect[] = [];

  private rec(kind: AuditKind, x: number, y: number, w: number, h: number, s?: string) {
    this.auditLog.push({ kind, x, y, w, h, s, clip: this.clips[this.clips.length - 1], layer: this.auditLayer, seq: this.auditLog.length });
  }

  begin(ctx: CanvasRenderingContext2D, input: Input, scale: number, dt: number) {
    this.ctx = ctx;
    this.input = input;
    this.scale = scale;
    this.w = Math.floor(ctx.canvas.width / scale);
    this.h = Math.floor(ctx.canvas.height / scale);
    this.mx = Math.floor(input.mouse.x * (ctx.canvas.width / ctx.canvas.clientWidth || 1) / scale);
    this.my = Math.floor(input.mouse.y * (ctx.canvas.height / ctx.canvas.clientHeight || 1) / scale);
    this.time += dt;
    this.tooltip = null;
    this.prevBlocks = this.blocks;
    this.blocks = [];
    this.captured = this.prevBlocks.some((b) => this.inside(b));
    this.clicked = input.mouse.pressed[0];
    this.rclicked = input.mouse.pressed[2];
    this.hoverId = null;
    if (this.audit) {
      this.lastAudit = this.auditLog;
      this.auditLog = [];
      this.clips = [];
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  /** mouse captured by UI drawn this frame (call after drawing) */
  get overUI() {
    return this.blocks.some((b) => this.inside(b)) || this.captured;
  }

  inside(r: Rect) {
    return this.mx >= r.x && this.my >= r.y && this.mx < r.x + r.w && this.my < r.y + r.h;
  }

  hover(x: number, y: number, w: number, h: number) {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  block(x: number, y: number, w: number, h: number) {
    this.blocks.push({ x, y, w, h });
  }

  /** consume the left click (so it doesn't fall through) */
  eat() {
    this.clicked = false;
    this.input.consumeMouse(0);
  }
  eatR() {
    this.rclicked = false;
    this.input.consumeMouse(2);
  }

  fill(x: number, y: number, w: number, h: number, c: number, a = 1) {
    if (this.audit && a >= 0.85 && w > 2 && h > 2) this.rec('fill', x, y, w, h);
    this.ctx.fillStyle = a >= 1 ? PALETTE[c] : rgba(c, a);
    this.ctx.fillRect(x, y, w, h);
  }

  panel(x: number, y: number, w: number, h: number, style: PanelStyle = 'wood', blocking = true) {
    x = Math.round(x);
    y = Math.round(y);
    if (blocking) this.block(x, y, w, h);
    if (this.audit) this.rec('panel', x, y, w, h);
    const f = (xx: number, yy: number, ww: number, hh: number, c: number) => this.fill(xx, yy, ww, hh, c);
    switch (style) {
      case 'wood':
        f(x + 2, y + h, w - 2, 2, C.ink); // drop shadow
        this.fill(x + 2, y + h, w - 2, 2, C.ink, 0.4);
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.walnut);
        f(x + 1, y + 1, w - 2, 1, C.oak);
        f(x + 1, y + 1, 1, h - 2, C.oak);
        f(x + 2, y + h - 2, w - 3, 1, C.bark);
        f(x + 4, y + 4, w - 8, h - 8, C.ink);
        f(x + 5, y + 5, w - 10, h - 10, C.butter);
        f(x + 5, y + 5, w - 10, 1, C.cream);
        // brass corner rivets
        for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) {
          f(cx, cy, 2, 2, C.brass);
        }
        break;
      case 'paper':
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.cream);
        f(x + 1, y + h - 2, w - 2, 1, C.butter);
        break;
      case 'dark':
        this.fill(x, y, w, h, C.ink, 0.88);
        f(x, y, w, 1, C.plum);
        f(x, y + h - 1, w, 1, C.plum);
        f(x, y, 1, h, C.plum);
        f(x + w - 1, y, 1, h, C.plum);
        break;
      case 'brass':
        f(x, y, w, h, C.ink);
        f(x + 1, y + 1, w - 2, h - 2, C.brass);
        f(x + 1, y + 1, w - 2, 1, C.amber);
        f(x + 1, y + h - 2, w - 2, 1, C.copper);
        break;
      case 'inset':
        f(x, y, w, h, C.tan);
        f(x, y, w, 1, C.oak);
        f(x, y, 1, h, C.oak);
        break;
      case 'slot':
        f(x, y, w, h, C.oak);
        f(x + 1, y + 1, w - 2, h - 2, C.tan);
        f(x + 1, y + 1, w - 2, 1, C.walnut);
        f(x + 1, y + 1, 1, h - 2, C.walnut);
        break;
    }
  }

  text(s: string, x: number, y: number, c = C.ink, opts: { scale?: number; shadow?: number; align?: 'left' | 'center' | 'right'; maxW?: number } = {}) {
    const sc = opts.scale ?? 1;
    let tx = x;
    if (opts.align === 'center') tx = x - Math.floor((textWidth(s) * sc) / 2);
    else if (opts.align === 'right') tx = x - textWidth(s) * sc;
    if (this.audit && s.trim()) this.rec('text', Math.round(tx), Math.round(y), textWidth(s) * sc, FONT_H * sc, s);
    return drawText(this.ctx, s, Math.round(tx), Math.round(y), PALETTE[c], sc, opts.shadow !== undefined ? PALETTE[opts.shadow] : null);
  }

  /** wrapped paragraph; returns height used */
  para(s: string, x: number, y: number, w: number, c = C.ink, lineH = LINE_H): number {
    const lines = wrapText(s, w);
    lines.forEach((l, i) => this.text(l, x, y + i * lineH, c));
    return lines.length * lineH;
  }

  button(id: string, x: number, y: number, w: number, h: number, label: string, opts: { disabled?: boolean; active?: boolean; tip?: TipLine[] | string; icon?: string; style?: 'wood' | 'green' | 'red' | 'flat' } = {}): boolean {
    const hov = this.hover(x, y, w, h) && !opts.disabled;
    const down = hov && this.input.mouse.down[0];
    const style = opts.style ?? 'wood';
    const base = opts.disabled ? C.stone : style === 'green' ? C.moss : style === 'red' ? C.brick : opts.active ? C.copper : style === 'flat' ? C.tan : C.oak;
    const hi = opts.disabled ? C.pebble : style === 'green' ? C.grass : style === 'red' ? C.terracotta : opts.active ? C.apricot : style === 'flat' ? C.butter : C.tan;
    if (this.audit) this.rec('button', x, y, w, h);
    this.fill(x, y, w, h, C.ink);
    this.fill(x + 1, y + 1, w - 2, h - 2, hov ? hi : base);
    if (!down) {
      this.fill(x + 1, y + 1, w - 2, 1, hov ? C.cream : hi);
      this.fill(x + 1, y + h - 2, w - 2, 1, C.walnut);
    }
    let tx = x + w / 2;
    if (opts.icon) {
      const iw = label ? 12 : 16;
      const ix = label ? x + 4 : x + (w - iw) / 2;
      this.spriteIcon(opts.icon, Math.round(ix), Math.round(y + (h - iw) / 2 + (down ? 1 : 0)), iw);
      tx = x + 4 + iw + (w - 4 - iw) / 2;
    }
    if (label) {
      const col = opts.disabled ? C.slate : style === 'flat' ? C.ink : C.cream;
      this.text(label, tx, y + Math.floor((h - 7) / 2) + (down ? 1 : 0), col, { align: 'center', shadow: style === 'flat' || opts.disabled ? undefined : C.bark });
    }
    if (hov) {
      this.hoverId = id;
      if (opts.tip) this.tip(typeof opts.tip === 'string' ? [{ text: opts.tip }] : opts.tip);
    }
    if (hov && this.clicked) {
      this.eat();
      this.sfx('click');
      return true;
    }
    return false;
  }

  /** small icon button */
  iconButton(id: string, x: number, y: number, icon: string, tip?: string, active = false): boolean {
    return this.button(id, x, y, 18, 18, '', { icon, tip, active });
  }

  tip(lines: TipLine[], width = 180) {
    this.tooltip = lines;
    this.tipWidth = width;
  }

  /** Draw a named sprite in a size×size box: item icons (`i:<id>`) via drawItemIcon, anything else fitted at a whole-number scale. */
  spriteIcon(name: string, x: number, y: number, size: number) {
    if (name.startsWith('i:')) drawItemIcon(this.ctx, name.slice(2), x, y, size);
    else drawFit(this.ctx, sprite(name), x, y, size, size);
  }

  itemIcon(k: number, x: number, y: number, size = 16, n = 0, alpha = 1) {
    const d = ITEMS[k >> 2];
    if (!d) return;
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    drawItemIcon(this.ctx, d.id, Math.round(x), Math.round(y), size);
    this.ctx.globalAlpha = 1;
    const q = k & 3;
    if (q) {
      const qs = sprite('q:' + q);
      this.ctx.drawImage(qs.img, qs.x, qs.y, 7, 7, Math.round(x), Math.round(y + size - 7), 7, 7);
    }
    if (n > 1) {
      const t = n >= 10000 ? Math.floor(n / 1000) + 'k' : String(n);
      this.text(t, x + size + 1, y + size - 7, C.cream, { align: 'right', shadow: C.ink });
    }
  }

  /** An inventory slot. Returns interaction flags. */
  slot(x: number, y: number, st: { k: number; n: number } | null, opts: { size?: number; selected?: boolean; ghost?: number; dim?: boolean; label?: string } = {}) {
    const S = opts.size ?? 20;
    const hov = this.hover(x, y, S, S);
    if (hov) this.hoverId = 'slot';
    this.fill(x, y, S, S, opts.selected ? C.amber : C.oak);
    this.fill(x + 1, y + 1, S - 2, S - 2, hov ? C.butter : C.tan);
    this.fill(x + 1, y + 1, S - 2, 1, C.walnut);
    this.fill(x + 1, y + 1, 1, S - 2, C.walnut);
    if (opts.selected) {
      this.fill(x - 1, y - 1, S + 2, 1, C.amber);
      this.fill(x - 1, y + S, S + 2, 1, C.amber);
      this.fill(x - 1, y - 1, 1, S + 2, C.amber);
      this.fill(x + S, y - 1, 1, S + 2, C.amber);
    }
    const off = (S - 16) / 2;
    if (st) this.itemIcon(st.k, x + off, y + off, 16, st.n, opts.dim ? 0.4 : 1);
    else if (opts.ghost !== undefined) this.itemIcon(opts.ghost, x + off, y + off, 16, 0, 0.3);
    if (opts.label) this.text(opts.label, x + 2, y + 1, C.walnut);
    const res = { hover: hov, click: hov && this.clicked, rclick: hov && this.rclicked };
    if (res.click) this.eat();
    if (res.rclick) this.eatR();
    return res;
  }

  bar(x: number, y: number, w: number, h: number, frac: number, col: number, bg = C.ink) {
    this.fill(x, y, w, h, bg);
    this.fill(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), h - 2, col);
  }

  /** vertical scroll region helper: returns offset after wheel input */
  scrollOffset(id: string, x: number, y: number, w: number, h: number, contentH: number): number {
    let off = this.scroll.get(id) ?? 0;
    if (this.hover(x, y, w, h) && this.input.mouse.wheel) {
      off += this.input.mouse.wheel * 24;
      this.input.mouse.wheel = 0;
    }
    off = Math.max(0, Math.min(Math.max(0, contentH - h), off));
    this.scroll.set(id, off);
    if (contentH > h) {
      const th = Math.max(10, (h * h) / contentH);
      this.fill(x + w - 3, y, 3, h, C.tan);
      this.fill(x + w - 3, y + (off / (contentH - h)) * (h - th), 3, th, C.walnut);
    }
    return off;
  }

  clip(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    if (this.audit) this.clips.push({ x, y, w, h });
  }
  unclip() {
    this.ctx.restore();
    if (this.audit) this.clips.pop();
  }

  /** single-line text field */
  textField(id: string, x: number, y: number, w: number, value: string, max = 20): string {
    const hov = this.hover(x, y, w, 16);
    if (this.clicked && hov) {
      this.focus = id;
      this.eat();
    } else if (this.clicked && !hov && this.focus === id) this.focus = null;
    const focused = this.focus === id;
    this.fill(x, y, w, 16, C.ink);
    this.fill(x + 1, y + 1, w - 2, 14, focused ? C.cream : C.butter);
    if (focused) {
      this.input.textFocus = true;
      for (const ch of this.input.text) {
        if (ch === '\b') value = value.slice(0, -1);
        else if (value.length < max && /[\w .'!?&-]/.test(ch)) value += ch;
      }
      if (this.input.keyPressed('Enter')) this.focus = null;
    }
    this.text(value, x + 4, y + 4, C.ink);
    if (focused && Math.floor(this.time * 2) % 2 === 0) this.fill(x + 5 + textWidth(value), y + 3, 1, 9, C.ink);
    return value;
  }

  end() {
    // dragged stack follows the mouse; it and the tooltip float above the UI on purpose
    this.auditLayer = 'tip';
    if (this.hand) this.itemIcon(this.hand.k, this.mx - 8, this.my - 8, 16, this.hand.n);
    if (this.tooltip && this.tooltip.length) this.drawTip(this.tooltip);
    this.auditLayer = 'ui';
    if (!this.focus) this.input.textFocus = false;
  }

  private drawTip(lines: TipLine[]) {
    const maxW = this.tipWidth;
    const wrapped: { text: string; color: number; icon?: string }[] = [];
    for (const l of lines) {
      const ws = wrapText(l.text, maxW - (l.icon ? 12 : 0));
      ws.forEach((t, i) => wrapped.push({ text: t, color: l.color ?? C.cream, icon: i === 0 ? l.icon : undefined }));
    }
    let w = 0;
    for (const l of wrapped) w = Math.max(w, textWidth(l.text) + (l.icon ? 12 : 0));
    w += 10;
    const h = wrapped.length * LINE_H + 8;
    let x = this.mx + 12, y = this.my + 12;
    if (x + w > this.w) x = this.mx - w - 4;
    if (y + h > this.h) y = this.h - h - 2;
    x = Math.max(2, x);
    y = Math.max(2, y);
    this.fill(x + 2, y + 2, w, h, C.ink, 0.4);
    this.fill(x, y, w, h, C.ink);
    this.fill(x + 1, y + 1, w - 2, h - 2, C.plum);
    this.fill(x + 1, y + 1, w - 2, 1, C.wine);
    wrapped.forEach((l, i) => {
      let tx = x + 5;
      if (l.icon) {
        this.spriteIcon(l.icon, tx, y + 4 + i * LINE_H - 1, 10);
        tx += 12;
      }
      this.text(l.text, tx, y + 5 + i * LINE_H, l.color);
    });
  }
}
