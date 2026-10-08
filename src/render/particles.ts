// Lightweight particle system in world pixel space (pooled).
import { C, PALETTE } from '../data/palette';
import { drawText, textWidth } from '../ui/font';

interface P {
  x: number; y: number; vx: number; vy: number; g: number; life: number; max: number;
  c: number; size: number; kind: number; text?: string; fade: boolean;
}

export class Particles {
  list: P[] = [];
  private pool: P[] = [];

  private spawn(): P {
    const p = this.pool.pop() ?? ({} as P);
    p.text = undefined;
    p.fade = true;
    p.kind = 0;
    this.list.push(p);
    return p;
  }

  burst(x: number, y: number, n: number, cols: number[], opts: { speed?: number; up?: number; g?: number; life?: number; size?: number } = {}) {
    if (this.list.length > 3000) return;
    for (let i = 0; i < n; i++) {
      const p = this.spawn();
      const a = Math.random() * Math.PI * 2;
      const s = (opts.speed ?? 40) * (0.4 + Math.random() * 0.8);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - (opts.up ?? 30);
      p.g = opts.g ?? 140;
      p.life = p.max = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.8);
      p.c = cols[Math.floor(Math.random() * cols.length)];
      p.size = opts.size ?? (Math.random() < 0.5 ? 1 : 2);
    }
  }

  smoke(x: number, y: number) {
    const p = this.spawn();
    p.x = x + (Math.random() - 0.5) * 3; p.y = y;
    p.vx = 4 + Math.random() * 4; p.vy = -12 - Math.random() * 6;
    p.g = -2; p.life = p.max = 1.6 + Math.random();
    p.c = Math.random() < 0.5 ? C.pebble : C.cream;
    p.size = 2 + (Math.random() < 0.3 ? 1 : 0);
    p.kind = 1;
  }

  sparkle(x: number, y: number, c = C.butter) {
    const p = this.spawn();
    p.x = x; p.y = y; p.vx = 0; p.vy = -6; p.g = 0;
    p.life = p.max = 0.5; p.c = c; p.size = 1; p.kind = 2;
  }

  text(x: number, y: number, text: string, c = C.cream) {
    const p = this.spawn();
    p.x = x; p.y = y; p.vx = 0; p.vy = -18; p.g = 10;
    p.life = p.max = 1.1; p.c = c; p.size = 1; p.kind = 3; p.text = text;
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        this.pool.push(p);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 1) {
        p.vx *= 0.99;
        if (p.life < p.max * 0.5) p.size = Math.max(1, p.size);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = p.life / p.max;
      if (p.kind === 3 && p.text) {
        ctx.globalAlpha = Math.min(1, t * 2);
        drawText(ctx, p.text, Math.round(p.x - textWidth(p.text) / 2), Math.round(p.y), PALETTE[p.c], 1, PALETTE[C.ink]);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = p.kind === 1 ? Math.min(0.7, t) : p.fade ? Math.min(1, t * 2.5) : 1;
      ctx.fillStyle = PALETTE[p.c];
      const s = p.kind === 1 ? Math.ceil(p.size * (1.5 - t * 0.5)) : p.size;
      if (p.kind === 2) {
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
      } else ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
