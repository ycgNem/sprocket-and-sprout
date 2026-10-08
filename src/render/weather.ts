// Screen-space weather: rain streaks + splashes, storms with lightning, snow, windy leaves.
import { C, PALETTE, rgba } from '../data/palette';
import type { Game } from '../sim/Game';
import type { Renderer } from './renderer';

interface Drop { x: number; y: number; v: number; l: number; ph: number }

export class Weather {
  drops: Drop[] = [];
  splashes: { x: number; y: number; t: number }[] = [];
  nextBolt = 5;
  kind = '';

  draw(ctx: CanvasRenderingContext2D, g: Game, r: Renderer, dt: number) {
    const w = g.weather;
    const z = r.cam.zoom;
    const W = r.W, H = r.H;
    const inGreenhouse = false;
    if (inGreenhouse) return;
    const want = w === 'rain' ? 260 : w === 'storm' ? 480 : w === 'snow' ? 220 : w === 'wind' ? (g.time.season === 3 ? 30 : 40) : g.time.season === 0 && w === 'sun' ? 18 : g.time.season === 2 ? 22 : 0;
    if (this.kind !== w + g.time.season) {
      this.kind = w + g.time.season;
      this.drops = [];
    }
    while (this.drops.length < want) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 0.7 + Math.random() * 0.6, l: Math.random(), ph: Math.random() * 6 });
    if (this.drops.length > want) this.drops.length = want;
    const wind = g.wind;
    if (w === 'rain' || w === 'storm') {
      ctx.fillStyle = rgba(C.deepsea, w === 'storm' ? 0.18 : 0.1);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rgba(C.frost, 0.55);
      const len = 6 * z;
      const sx = (w === 'storm' ? 2.2 : 1) * wind * 1.2;
      for (const d of this.drops) {
        d.y += 900 * d.v * dt;
        d.x += sx * 120 * dt;
        if (d.y > H) {
          if (Math.random() < 0.4) this.splashes.push({ x: d.x, y: Math.random() * H, t: 0 });
          d.y = -len;
          d.x = Math.random() * (W + 200) - 100;
        }
        if (d.x > W + 50) d.x -= W + 100;
        const step = Math.max(1, Math.round(z / 2));
        for (let i = 0; i < len; i += step) ctx.fillRect(Math.round(d.x + (i * sx) / 6), Math.round(d.y + i), step, step);
      }
      ctx.fillStyle = rgba(C.frost, 0.6);
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.t += dt;
        if (s.t > 0.25) {
          this.splashes.splice(i, 1);
          continue;
        }
        const rr = s.t * 16 * z;
        ctx.fillRect(s.x - rr, s.y, z, z);
        ctx.fillRect(s.x + rr, s.y, z, z);
        ctx.fillRect(s.x, s.y - rr * 0.5, z, z);
      }
      if (w === 'storm') {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = 6 + Math.random() * 14;
          r.lighting.flash = 0.7;
          (g as any).sys.thunder = true;
        }
      }
    } else if (w === 'snow') {
      ctx.fillStyle = rgba(C.frost, 0.06);
      ctx.fillRect(0, 0, W, H);
      for (const d of this.drops) {
        d.y += 40 * d.v * z * dt;
        d.x += (Math.sin(r.time * 1.3 + d.ph) * 14 + wind * 10) * dt * z * 0.5;
        if (d.y > H) { d.y = -4; d.x = Math.random() * W; }
        if (d.x > W) d.x -= W;
        if (d.x < 0) d.x += W;
        ctx.fillStyle = PALETTE[d.l < 0.3 ? C.frost : C.cream];
        const s = d.l < 0.5 ? z : z * 2;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), s, s);
      }
    } else if (want > 0) {
      // drifting petals (spring), leaves (fall/windy)
      const s = g.time.season;
      const cols = s === 0 ? [C.blush, C.cream] : s === 2 ? [C.apricot, C.terracotta, C.amber] : s === 3 ? [C.cream] : [C.leaf, C.grass];
      for (const d of this.drops) {
        d.x += (30 + wind * 50) * d.v * dt * z * 0.6;
        d.y += (14 + Math.sin(r.time * 2 + d.ph) * 18) * dt * z * 0.6;
        if (d.x > W + 10) { d.x = -10; d.y = Math.random() * H; }
        if (d.y > H) d.y = -5;
        ctx.fillStyle = PALETTE[cols[Math.floor(d.l * cols.length)]];
        const flip = Math.sin(r.time * 4 + d.ph) > 0;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), flip ? z * 2 : z, flip ? z : z * 2);
      }
    }
    // summer evening fireflies
    if (g.time.season === 1 && g.daylight < 0.5 && w === 'sun') {
      for (let i = 0; i < 24; i++) {
        const t = r.time * 0.3 + i * 13.7;
        const x = ((Math.sin(t * 0.7 + i) * 0.5 + 0.5) * W + i * 97) % W, y = ((Math.cos(t * 0.5 + i * 2) * 0.5 + 0.5) * H + i * 53) % H;
        const a = Math.max(0, Math.sin(r.time * 2 + i * 1.7));
        ctx.fillStyle = rgba(C.lime, a * 0.9);
        ctx.fillRect(Math.round(x), Math.round(y), z, z);
      }
    }
  }
}
