// Ambient life and juice in world space: butterflies, hopping birds, jumping fish,
// and toppling trees when they're chopped down.
import { C, PALETTE } from '../data/palette';
import type { Game } from '../sim/Game';
import { T } from '../sim/world/tilemap';
import { curMap } from '../sim/systems/player';
import { drawSprite, hasImage, sprite } from './atlas';
import type { Renderer } from './renderer';

const TILE = 16;

interface Fly { x: number; y: number; vx: number; vy: number; ph: number; c: number; t: number }
interface Bird { x: number; y: number; vx: number; vy: number; z: number; flying: boolean; t: number; hop: number; c: number }
interface Fall { s: string; x: number; y: number; t: number; dir: number }
interface Jump { x: number; y: number; t: number }

export class Ambient {
  flies: Fly[] = [];
  birds: Bird[] = [];
  falls: Fall[] = [];
  jumps: Jump[] = [];
  private jumpCd = 2;

  treeFall(spriteName: string, x: number, y: number, dir: number) {
    this.falls.push({ s: spriteName, x, y, t: 0, dir });
  }

  update(dt: number, g: Game, r: Renderer) {
    const m = curMap(g);
    const outdoors = m === g.map;
    const v = r.view;
    const vx0 = v.x0 / TILE, vy0 = v.y0 / TILE, vx1 = v.x1 / TILE, vy1 = v.y1 / TILE;
    const fair = outdoors && !g.isRaining() && g.weather !== 'snow';
    // butterflies by day in spring/summer
    const wantFlies = fair && g.daylight > 0.6 && g.time.season < 2 ? 6 : 0;
    while (this.flies.length < wantFlies) {
      const cols = [C.butter, C.blush, C.lavender, C.cream, C.amber];
      this.flies.push({ x: vx0 + Math.random() * (vx1 - vx0), y: vy0 + Math.random() * (vy1 - vy0), vx: 0, vy: 0, ph: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], t: 0 });
    }
    if (this.flies.length > wantFlies) this.flies.length = wantFlies;
    for (const f of this.flies) {
      f.t += dt;
      f.vx += (Math.sin(f.t * 0.7 + f.ph) * 0.8 - f.vx) * dt;
      f.vy += (Math.cos(f.t * 1.1 + f.ph * 2) * 0.6 - f.vy) * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < vx0 - 2 || f.x > vx1 + 2 || f.y < vy0 - 2 || f.y > vy1 + 2) {
        f.x = vx0 + Math.random() * (vx1 - vx0);
        f.y = vy0 + Math.random() * (vy1 - vy0);
      }
    }
    // little birds hopping on the grass; they flee from the player
    const wantBirds = fair && g.daylight > 0.5 && g.time.season !== 3 ? 3 : 0;
    if (this.birds.filter((b) => !b.flying).length < wantBirds && Math.random() < dt * 0.5) {
      const x = vx0 + Math.random() * (vx1 - vx0), y = vy0 + Math.random() * (vy1 - vy0);
      const gt = m.g(Math.floor(x), Math.floor(y));
      if ((gt === T.GRASS || gt === T.TOWNGRASS) && !m.obj[m.idx(Math.floor(x), Math.floor(y))] && Math.hypot(x - g.player.x, y - g.player.y) > 5) {
        this.birds.push({ x, y, vx: 0, vy: 0, z: 0, flying: false, t: 0, hop: Math.random(), c: Math.random() < 0.5 ? C.walnut : C.slate });
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.t += dt;
      if (!b.flying) {
        b.hop -= dt;
        if (b.hop <= 0) {
          b.hop = 0.4 + Math.random() * 1.6;
          b.vx = (Math.random() - 0.5) * 2;
        }
        b.z = Math.max(0, Math.sin(Math.max(0, b.hop - 0.2) * 10) * 2);
        b.x += b.vx * dt * (b.hop > 0.2 ? 0.6 : 0);
        if (Math.hypot(b.x - g.player.x, b.y - g.player.y) < 2.6) {
          b.flying = true;
          b.vx = (b.x > g.player.x ? 1 : -1) * (3 + Math.random() * 2);
          b.vy = -2 - Math.random();
        }
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += 30 * dt;
        if (b.t > 8 || b.z > 120) this.birds.splice(i, 1);
      }
    }
    // jumping fish in visible water
    this.jumpCd -= dt;
    if (outdoors && this.jumpCd <= 0) {
      this.jumpCd = 1.5 + Math.random() * 3;
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(vx0 + Math.random() * (vx1 - vx0)), y = Math.floor(vy0 + Math.random() * (vy1 - vy0));
        const t = m.g(x, y);
        if (t === T.RIVER || t === T.LAKE || t === T.POND || t === T.OCEAN) {
          this.jumps.push({ x: x + 0.5, y: y + 0.5, t: 0 });
          r.particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, 5, [C.frost, C.aqua], { speed: 20, up: 25, life: 0.4 });
          break;
        }
      }
    }
    for (let i = this.jumps.length - 1; i >= 0; i--) if ((this.jumps[i].t += dt) > 0.6) this.jumps.splice(i, 1);
    for (let i = this.falls.length - 1; i >= 0; i--) if ((this.falls[i].t += dt) > 0.9) this.falls.splice(i, 1);
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    // imported critters: amb:fish:<0 up|1 down>, amb:bird:<0 brown|1 gray>:<0 sit|1 hop|2-3 flap>,
    // amb:fly:<color 0-4>:<0 open|1 closed>; anchored at the body's bottom center
    const art = hasImage('amb:fly:0:0');
    for (const j of this.jumps) {
      const k = j.t / 0.6;
      const x = j.x * TILE + (k - 0.5) * 8, y = j.y * TILE - Math.sin(k * Math.PI) * 9;
      if (art) {
        drawSprite(ctx, sprite(`amb:fish:${k < 0.5 ? 0 : 1}`), Math.round(x), Math.round(y) + 2);
        continue;
      }
      ctx.fillStyle = PALETTE[C.pebble];
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 2);
      ctx.fillStyle = PALETTE[C.sky];
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - 2, 1, 3);
    }
    for (const b of this.birds) {
      const x = Math.round(b.x * TILE), y = Math.round(b.y * TILE - b.z);
      if (art) {
        const fr = b.flying ? 2 + (Math.floor(time * 16) % 2) : b.z > 0.5 ? 1 : 0;
        if (!b.flying) drawSprite(ctx, sprite('shadow:4'), x, Math.round(b.y * TILE) + 1);
        drawSprite(ctx, sprite(`amb:bird:${b.c === C.walnut ? 0 : 1}:${fr}`), x, y + 1, 1, b.vx < 0);
        continue;
      }
      ctx.fillStyle = PALETTE[C.ink];
      ctx.fillRect(x - 2, y - 2, 5, 3);
      ctx.fillStyle = PALETTE[b.c];
      ctx.fillRect(x - 1, y - 2, 3, 2);
      ctx.fillStyle = PALETTE[C.amber];
      ctx.fillRect(x + (b.vx >= 0 ? 2 : -3), y - 2, 1, 1);
      if (b.flying) {
        const flap = Math.floor(time * 16) % 2;
        ctx.fillStyle = PALETTE[b.c];
        ctx.fillRect(x - 4, y - 3 - flap, 3, 1);
        ctx.fillRect(x + 2, y - 3 - flap, 3, 1);
      } else {
        ctx.fillStyle = 'rgba(26,18,32,0.25)';
        ctx.fillRect(x - 2, Math.round(b.y * TILE) + 1, 5, 1);
      }
    }
    const FLY_COLS = [C.butter, C.blush, C.lavender, C.cream, C.amber];
    for (const f of this.flies) {
      const x = Math.round(f.x * TILE), y = Math.round(f.y * TILE);
      const open = Math.floor(time * 10 + f.ph) % 2 === 0;
      if (art) {
        drawSprite(ctx, sprite(`amb:fly:${Math.max(0, FLY_COLS.indexOf(f.c))}:${open ? 0 : 1}`), x, y + 1);
        continue;
      }
      ctx.fillStyle = PALETTE[f.c];
      if (open) {
        ctx.fillRect(x - 2, y - 1, 2, 2);
        ctx.fillRect(x + 1, y - 1, 2, 2);
      } else ctx.fillRect(x - 1, y - 2, 3, 2);
      ctx.fillStyle = PALETTE[C.ink];
      ctx.fillRect(x, y - 1, 1, 2);
    }
    for (const f of this.falls) {
      const k = Math.min(1, f.t / 0.7);
      const ang = f.dir * (k * k) * (Math.PI / 2);
      ctx.save();
      ctx.globalAlpha = f.t > 0.7 ? Math.max(0, 1 - (f.t - 0.7) / 0.2) : 1;
      ctx.translate(f.x * TILE, f.y * TILE);
      ctx.rotate(ang);
      drawSprite(ctx, sprite(f.s), 0, 0);
      ctx.restore();
    }
  }
}
