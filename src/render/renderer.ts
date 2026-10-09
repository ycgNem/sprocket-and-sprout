// World renderer: camera, chunk-baked ground, culled + y-sorted dynamic sprites,
// belts with their items, arms, wires, lighting and weather.
import { cartHere } from '../sim/systems/cart';
import { kId } from '../sim/inventory';
import { C, PALETTE, rgba } from '../data/palette';
import { CROP_BY_ID } from '../data/crops';
import { MEGA_BY_ID } from '../data/goals';
import { FURN_BY_ID } from '../data/furniture';
import { TREE_BY_ID } from '../data/trees';
import { hash2 } from '../engine/rng';
import type { Game } from '../sim/Game';
import { BeltKind, DX, DY, Ent } from '../sim/ents';
import { itemPos } from '../sim/systems/belts';
import { armTiles } from '../sim/systems/arms';
import { powerState } from '../sim/systems/power';
import { curMap } from '../sim/systems/player';
import { O, T, TileMap, Z } from '../sim/world/tilemap';
import { GREENHOUSE, SHIPBIN_POS } from '../sim/world/worldgen';
import { drawSprite, drawItemIcon, sprite, Sprite } from './atlas';
import { makeCanvas, ctx2d } from './art/pixel';
import { PRIO, FRINGE_SOURCES, TILE, paintTerrain } from './art/terrain';
import { PixBuf } from './art/pixbuf';
import { EXTRA_TOP } from './art/structs';
import { Particles } from './particles';
import { Lighting } from './lighting';
import { Weather } from './weather';
import { Ambient } from './ambient';

const CH = TileMap.CHUNK;
const FLAT_OBJ = new Set([
  O.ROCK, O.WEED, O.TWIG, O.STUMP, O.LOG, O.TALLGRASS, O.BUSH, O.FLOWER, O.ORE_ROCK, O.ARTIFACT, O.FENCE, O.BENCH,
  O.BARREL, O.GEM_ROCK, O.LADDER, O.SHAFT, O.REEDS, O.LILYPAD, O.MUSHROOM, O.SIGNPOST, O.WELL, O.MAILBOX, O.FLOWERBED,
  O.HEDGE, O.CRATE, O.ELEVATOR, O.MINE_EXIT, O.ICE_ROCK, O.STALAGMITE, O.CRYSTAL, O.BOULDER, O.TREASURE,
]);

interface Chunk { c: HTMLCanvasElement; ver: number; season: number; theme: number }

export interface Drawable {
  y: number;
  f: () => void;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 3;
  targetZoom = 3;
  shake = 0;
  follow(tx: number, ty: number, dt: number, snap = false) {
    const k = snap ? 1 : 1 - Math.pow(0.0005, dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.pow(0.0001, dt));
    if (Math.abs(this.zoom - this.targetZoom) < 0.01) this.zoom = this.targetZoom;
    this.shake = Math.max(0, this.shake - dt * 3);
  }
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  cam = new Camera();
  chunks = new Map<string, Chunk>();
  particles = new Particles();
  lighting = new Lighting();
  weather = new Weather();
  ambient = new Ambient();
  W = 0;
  H = 0;
  time = 0;
  drawables: Drawable[] = [];
  /** world-pixel view rect */
  view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** per-frame overlays added by the UI (ghosts, highlights) */
  overlays: ((ctx: CanvasRenderingContext2D) => void)[] = [];
  /** stats */
  drawCount = 0;
  lastMap: TileMap | null = null;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w;
    this.H = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** screen px -> world tile coords */
  screenToTile(sx: number, sy: number): { x: number; y: number } {
    const z = this.cam.zoom;
    const wx = (sx - this.W / 2) / z + this.cam.x * TILE;
    const wy = (sy - this.H / 2) / z + this.cam.y * TILE;
    return { x: wx / TILE, y: wy / TILE };
  }

  tileToScreen(tx: number, ty: number): { x: number; y: number } {
    const z = this.cam.zoom;
    return { x: (tx * TILE - this.cam.x * TILE) * z + this.W / 2, y: (ty * TILE - this.cam.y * TILE) * z + this.H / 2 };
  }

  invalidateAll() {
    this.chunks.clear();
  }

  // ---------------- chunks ----------------
  private chunk(m: TileMap, cx: number, cy: number, season: number, theme: number): HTMLCanvasElement {
    const key = `${m === this.lastMap ? 'm' : 'x'}${cx},${cy}`;
    const cw = Math.ceil(m.w / CH);
    const ci = cy * cw + cx;
    let ch = this.chunks.get(key);
    const dirty = m.dirtyChunks.has(ci);
    if (ch && ch.season === season && ch.theme === theme && !dirty) return ch.c;
    if (!ch) {
      ch = { c: makeCanvas(CH * TILE, CH * TILE), ver: 0, season, theme };
      this.chunks.set(key, ch);
    }
    m.dirtyChunks.delete(ci);
    ch.season = season;
    ch.theme = theme;
    this.bake(m, cx, cy, ch.c, season, theme);
    return ch.c;
  }

  private bake(m: TileMap, cx: number, cy: number, c: HTMLCanvasElement, season: number, theme: number) {
    const ctx = ctx2d(c);
    ctx.clearRect(0, 0, c.width, c.height);
    const x0 = cx * CH, y0 = cy * CH;
    // pass 1: paint ground pixels directly with world-continuous noise
    const pb = new PixBuf(CH * TILE, CH * TILE);
    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        const t = m.ground[i] as T;
        const extra = t === T.ORE_VEIN ? m.objData[i] : t === T.MINEFLOOR || t === T.MINEWALL ? theme : 0;
        paintTerrain(pb, t, t === T.MINEFLOOR || t === T.MINEWALL ? 0 : season, m.deco[i] % 8, lx * TILE, ly * TILE, extra, x * TILE, y * TILE);
        // cave walls: only faces next to open floor show rock; the rest is deep shadow
        if (t === T.MINEWALL) {
          const open = (xx: number, yy: number) => { const gg = m.g(xx, yy); return gg !== T.MINEWALL && gg !== T.VOID; };
          const nearFloor = open(x, y + 1) || open(x, y + 2);
          if (!nearFloor) {
            const edge = open(x - 1, y) || open(x + 1, y) || open(x, y - 1);
            for (let py = 0; py < TILE; py++)
              for (let px = 0; px < TILE; px++) {
                const hsh = hash2(x * TILE + px, y * TILE + py, 41);
                pb.set(lx * TILE + px, ly * TILE + py, edge && (px < 2 || px > 13 || py < 2) ? C.plum : hsh < 0.03 ? C.plum : C.ink);
              }
          } else if (!open(x, y + 1)) {
            // two tiles above floor: darken the top half
            for (let py = 0; py < 8; py++) for (let px = 0; px < TILE; px++) if (hash2(px, py + y, 43) < 0.7) pb.set(lx * TILE + px, ly * TILE + py, C.ink);
          }
        }
      }
    pb.drawTo(ctx);
    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        const t = m.ground[i] as T;
        const v = m.deco[i] % 8;
        const px = lx * TILE, py = ly * TILE;
        // fringes from higher priority neighbors
        const pr = PRIO[t] ?? 0;
        for (let d = 0; d < 4; d++) {
          const nt = m.g(x + DX[d], y + DY[d]);
          if (nt === t || nt === T.VOID) continue;
          if (FRINGE_SOURCES.has(nt) && (PRIO[nt] ?? 0) > pr && t !== T.CLIFF && t !== T.CLIFFTOP && t !== T.PLANKS) {
            const f = sprite(`f:${nt === T.TOWNGRASS ? T.GRASS : nt}:${season}:${d}:${(v + d) % 3}`);
            ctx.drawImage(f.img, f.x, f.y, 16, 16, px, py, 16, 16);
          }
        }
        if (m.isWater(x, y)) {
          for (let d = 0; d < 4; d++) {
            const nx = x + DX[d], ny = y + DY[d];
            if (m.inb(nx, ny) && !m.isWater(nx, ny) && m.g(nx, ny) !== T.PLANKS) {
              const f = sprite(`wf:${d}`);
              ctx.drawImage(f.img, f.x, f.y, 16, 16, px, py, 16, 16);
            }
          }
        }
        if (t === T.CLIFF || t === T.MINEWALL) {
          const below = m.g(x, y + 1);
          if (below !== T.CLIFF && below !== T.CLIFFTOP && below !== T.MINEWALL && below !== T.VOID) {
            const f = sprite('cf:0');
            ctx.drawImage(f.img, f.x, f.y, 16, 16, px, py, 16, 16);
          }
          const above = m.g(x, y - 1);
          if (above === T.CLIFFTOP) {
            const f = sprite('cf:1');
            ctx.drawImage(f.img, f.x, f.y, 16, 16, px, py, 16, 16);
          }
        }
        const o = m.obj[i] as O;
        if (o && FLAT_OBJ.has(o)) {
          const s2 = sprite(`o:${o}:${o === O.FLOWER || o === O.FLOWERBED ? m.objData[i] % 6 : o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.TREASURE ? m.objData[i] : v % 3}:${season}`);
          ctx.drawImage(s2.img, s2.x, s2.y, 16, 16, px, py, 16, 16);
        } else if (o === O.FORAGE) {
          const id = m.forage.get(i);
          if (id) {
            drawItemIcon(ctx, id, px + 2, py + 2, 12);
          }
        }
      }
  }

  // ---------------- main draw ----------------
  draw(g: Game, dt: number) {
    this.time += dt;
    const ctx = this.ctx;
    const m = curMap(g);
    if (m !== this.lastMap) {
      this.chunks.clear();
      this.lastMap = m;
    }
    const season = g.player.where === 'mine' ? 0 : g.time.season;
    const theme = g.sys.mine?.theme ?? 0;
    const cam = this.cam;
    const z = cam.zoom;
    const sh = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 6 : 0;
    const camPx = cam.x * TILE, camPy = cam.y * TILE;
    const ox = Math.round(this.W / 2 - camPx * z + sh), oy = Math.round(this.H / 2 - camPy * z + sh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE[m === g.map ? C.deepsea : C.ink];
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = false;
    const vx0 = -ox / z, vy0 = -oy / z, vx1 = (this.W - ox) / z, vy1 = (this.H - oy) / z;
    this.view = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
    const tx0 = Math.max(0, Math.floor(vx0 / TILE) - 1), ty0 = Math.max(0, Math.floor(vy0 / TILE) - 1);
    const tx1 = Math.min(m.w - 1, Math.ceil(vx1 / TILE) + 1), ty1 = Math.min(m.h - 1, Math.ceil(vy1 / TILE) + 3);

    // chunks
    const cx0 = Math.floor(tx0 / CH), cy0 = Math.floor(ty0 / CH), cx1 = Math.floor(tx1 / CH), cy1 = Math.floor(ty1 / CH);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.chunk(m, cx, cy, season, theme);
        ctx.drawImage(c, cx * CH * TILE, cy * CH * TILE);
      }
    // water shimmer
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) {
        if (!m.isWater(x, y)) continue;
        const ph = hash2(x, y, 3);
        const t = (this.time * 0.6 + ph * 7) % 7;
        if (t < 0.6) {
          ctx.fillStyle = PALETTE[m.g(x, y) === T.LAVA ? C.butter : C.frost];
          const sx = x * TILE + Math.floor(ph * 12) + 2, sy = y * TILE + Math.floor(hash2(y, x, 4) * 12) + 2;
          ctx.fillRect(sx, sy, t < 0.3 ? 2 : 3, 1);
        }
      }

    const D: Drawable[] = (this.drawables = []);
    // soil + crops
    if (m === g.map) this.drawSoil(g, tx0, ty0, tx1, ty1, D);
    // floor structures (belts etc.) and y-sorted structures
    if (m === g.map) this.drawStructs(g, tx0, ty0, tx1, ty1, D);
    // trees + tall objects
    for (let y = ty0; y <= ty1 + 3; y++)
      for (let x = tx0 - 1; x <= tx1 + 1; x++) {
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        const o = m.obj[i];
        if (o === O.TREE) {
          const tr = m.trees.get(i);
          if (!tr) continue;
          const shake = g.sys.treeShake?.get(i) ?? 0;
          const fruitN = tr.fruit > 0 ? Math.min(3, tr.fruit) : 0;
          const s = sprite(`tree:${tr.species}:${tr.stage}:${season}:${fruitN}:${m.deco[i] % 3}`);
          const sxx = x * TILE + 8 + (shake > 0 ? Math.sin(this.time * 50) * shake * 2 : 0);
          // fade trees in front of the player
          D.push({ y: y + 0.95, f: () => {
            const p = g.player;
            const near = tr.stage >= 3 && p.y < y + 0.9 && p.y > y - 3.2 && Math.abs(p.x - (x + 0.5)) < 1.3;
            if (near) ctx.globalAlpha = 0.55;
            drawSprite(ctx, s, sxx, y * TILE + 15);
            ctx.globalAlpha = 1;
          } });
        } else if (o === O.LAMPPOST) {
          const lit = g.daylight < 0.6 || m !== g.map;
          const s = sprite(`lamp:${lit ? 1 : 0}`);
          D.push({ y: y + 0.9, f: () => drawSprite(ctx, s, x * TILE, y * TILE) });
        } else if (o === O.NOTICEBOARD) {
          const s = sprite('board:0');
          D.push({ y: y + 0.9, f: () => drawSprite(ctx, s, x * TILE, y * TILE) });
        }
      }
    if (g.player.where === 'house') {
      this.drawHouse(g, m, D);
      this.drawDecor(g, D);
    }
    // buildings
    for (const b of m.buildings) {
      if ((b.x + b.w) * TILE < vx0 || b.x * TILE > vx1 || (b.y - 3) * TILE > vy1 || (b.y + b.h) * TILE < vy0) continue;
      const st = b.id === 'clocktower' ? (g.flags.has('clock_fixed') ? 1 : 0) : b.id === 'greenhouse' ? (g.flags.has('greenhouse_fixed') ? 1 : 0) : g.daylight < 0.55 ? 1 : 0;
      const s = sprite(`bld:${b.id}:${season}:${st}`);
      D.push({ y: b.y + b.h - 0.05, f: () => drawSprite(ctx, s, b.x * TILE, b.y * TILE) });
    }
    // actors
    this.drawActors(g, m, D);
    // sort + draw
    D.sort((a, b) => a.y - b.y);
    for (const d of D) d.f();
    this.drawCount = D.length;

    this.ambient.update(dt, g, this);
    this.ambient.draw(ctx, this.time);
    // greenhouse glass roof
    if (m === g.map) this.drawGreenhouseRoof(g);
    if (m === g.map) this.drawTownExtras(g);
    // power wires
    if (m === g.map) this.drawWires(g);
    // ui overlays in world space (ghosts, highlights)
    for (const o of this.overlays) o(ctx);
    this.overlays = [];
    // particles
    this.particles.update(dt);
    this.particles.draw(ctx);
    // weather + lighting in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (m === g.map) this.weather.draw(ctx, g, this, dt);
    this.lighting.draw(ctx, g, this, m !== g.map);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Farmhouse furniture, y-sorted with the player; the hearth fire and clock are animated. */
  private drawHouse(g: Game, m: TileMap, D: Drawable[]) {
    const ctx = this.ctx, season = g.time.season, t = this.time;
    const night = g.daylight < 0.45 ? 1 : 0;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = m.idx(x, y), o = m.obj[i] as O, v = m.objData[i];
        const px = x * TILE, py = y * TILE;
        let name = '', sy = y + 0.95, flip = false;
        switch (o) {
          case O.BED: if (v === 0) { name = `hf:bed:${season === 3 ? 1 : 0}:0`; sy = y + 1.95; } break;
          case O.DRESSER: name = 'hf:dresser:0:0'; break;
          case O.FIREPLACE: if (v === 0) name = 'hf:fireplace:0:0'; break;
          case O.STOVE: name = `hf:stove:${g.flags.has('home_kitchen') ? 1 : 0}:0`; break;
          case O.SHELF: name = `hf:shelf:${v}:0`; break;
          case O.TABLE: name = `hf:table:0:${season}`; break;
          case O.CHAIR: name = 'hf:chair:0:0'; flip = v === 1; sy = y + 0.5; break;
          case O.ALMANAC: name = 'hf:almanac:0:0'; break;
          case O.HOUSEPLANT: name = `hf:plant:${v}:0`; break;
          case O.WINDOW: name = `hf:window:${night}:${season}`; sy = -5; break;
          case O.CLOCK: name = 'hf:clock:0:0'; sy = -5; break;
          case O.RUG: if (v === 0) { name = 'hf:rug:0:0'; sy = -10; } break;
          case O.DOORMAT: name = 'hf:doormat:0:0'; sy = -10; break;
        }
        if (!name) continue;
        const s = sprite(name);
        D.push({ y: sy, f: () => {
          drawSprite(ctx, s, flip ? px + 16 : px, py, 1, flip);
          if (o === O.FIREPLACE) {
            // flickering flames over the logs
            const fx = px + 10, fy = py + 9;
            for (let k = 0; k < 6; k++) {
              const h = 4 + Math.sin(t * 9 + k * 1.9) * 1.6 + Math.sin(t * 23 + k) * 1.2 + (k === 2 || k === 3 ? 3 : 0);
              const xx = fx + k * 2;
              ctx.fillStyle = PALETTE[C.terracotta];
              ctx.fillRect(xx, fy - h, 2, h);
              ctx.fillStyle = PALETTE[C.amber];
              ctx.fillRect(xx, fy - h * 0.7, 2, h * 0.7);
              ctx.fillStyle = PALETTE[C.butter];
              ctx.fillRect(xx + (k % 2), fy - h * 0.35, 1, h * 0.35);
            }
            if (Math.sin(t * 3.1) > 0.97) { ctx.fillStyle = PALETTE[C.butter]; ctx.fillRect(fx + 5 + Math.sin(t * 40) * 3, fy - 9 - ((t * 20) % 4), 1, 1); }
          } else if (o === O.CLOCK) {
            // live hands
            const cx = px + 8, cy = py - 3;
            const min = g.time.min % 60, hr = (g.time.min / 60) % 12;
            const hand = (a: number, len: number, c: number) => {
              ctx.fillStyle = PALETTE[c];
              for (let r = 0; r <= len; r += 0.5) ctx.fillRect(Math.round(cx + Math.sin(a) * r - 0.5), Math.round(cy - Math.cos(a) * r - 0.5), 1, 1);
            };
            hand((hr / 12) * Math.PI * 2, 1.8, C.ink);
            hand((min / 60) * Math.PI * 2, 2.6, C.walnut);
            // pendulum
            ctx.fillStyle = PALETTE[C.brass];
            ctx.fillRect(Math.round(cx - 0.5 + Math.sin(t * 3) * 1.5), py + 3, 2, 2);
          } else if (o === O.STOVE && g.flags.has('home_kitchen')) {
            if (Math.sin(t * 2 + 1) > 0.3) { ctx.fillStyle = rgba(C.cream, 0.5); ctx.fillRect(px + 9 + Math.sin(t * 4) * 1.5, py - 6 - ((t * 6) % 5), 2, 1); }
          }
        } });
      }
  }

  /** a filtered splitter shows its item on the box */
  private drawSplitFilter(root: Ent, cx: number, cy: number) {
    const fk = root.belt?.sFilter ?? -1;
    if (fk < 0) return;
    this.ctx.fillStyle = PALETTE[C.ink];
    this.ctx.fillRect(cx - 6, cy - 6, 12, 12);
    drawItemIcon(this.ctx, kId(fk), cx - 5, cy - 5, 10);
  }

  /** furniture the player placed inside the farmhouse */
  private drawDecor(g: Game, D: Drawable[]) {
    const ctx = this.ctx, t = this.time, season = g.time.season;
    for (const d of g.sys.house?.decor ?? []) {
      const f = FURN_BY_ID.get(d.id);
      if (!f) continue;
      const s = sprite(`hf:${f.sprite}:${season}`);
      const px = d.x * TILE, py = d.y * TILE;
      const sy = f.flat ? -9 : f.wall ? -4 : d.y + f.h - 0.05;
      D.push({ y: sy, f: () => {
        drawSprite(ctx, s, px, py);
        if (d.id === 'f_tank') {
          // three goldfish drifting about
          for (let k = 0; k < 3; k++) {
            const fx = px + 6 + ((Math.sin(t * (0.5 + k * 0.2) + k * 2) + 1) / 2) * 18, fy = py - 4 + k * 2 + Math.sin(t * 1.3 + k) * 1.2;
            ctx.fillStyle = PALETTE[k === 1 ? C.butter : C.amber];
            ctx.fillRect(Math.round(fx), Math.round(fy), 2, 1);
          }
          if (Math.sin(t * 2.2) > 0.6) { ctx.fillStyle = PALETTE[C.frost]; ctx.fillRect(px + 22, py - 4 - Math.floor((t * 6) % 6), 1, 1); }
        }
      } });
    }
  }

  private drawSoil(g: Game, tx0: number, ty0: number, tx1: number, ty1: number, D: Drawable[]) {
    const ctx = this.ctx;
    const m = g.map;
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) {
        const i = m.idx(x, y);
        const s = g.soil.get(i);
        if (!s) continue;
        let mask = 0;
        if (g.soil.has(i - m.w)) mask |= 1;
        if (x < m.w - 1 && g.soil.has(i + 1)) mask |= 2;
        if (g.soil.has(i + m.w)) mask |= 4;
        if (x > 0 && g.soil.has(i - 1)) mask |= 8;
        const sp = sprite(`soil:${s.water ? 1 : 0}:${mask}`);
        ctx.drawImage(sp.img, sp.x, sp.y, 16, 16, x * TILE, y * TILE, 16, 16);
        if (s.fert) {
          const col = s.fert.includes('tonic') ? C.lime : s.fert.includes('mulch') ? C.sky : C.amber;
          const f = sprite(`fert:${col}`);
          ctx.drawImage(f.img, f.x, f.y, 16, 16, x * TILE, y * TILE, 16, 16);
        }
        const c = s.crop;
        if (c) {
          if (c.giant >= 0) {
            if (c.giant === i) {
              const gs = sprite('giant:' + c.id);
              D.push({ y: y + 2.95, f: () => drawSprite(ctx, gs, x * TILE, y * TILE) });
            }
            continue;
          }
          const cr = CROP_BY_ID.get(c.id);
          if (!cr) continue;
          const stage = c.ready ? cr.stages.length : Math.min(c.stage, cr.stages.length - 1);
          const cs = sprite(`crop:${c.id}:${stage}:${c.ready ? 1 : 0}:${m.deco[i] % 3}:${c.dead ? 1 : 0}`);
          const sway = c.ready && !c.dead ? Math.round(Math.sin(this.time * 2 + x * 0.7) * 0.6) : 0;
          D.push({ y: y + 0.6, f: () => drawSprite(ctx, cs, x * TILE + sway, y * TILE) });
          if (c.ready && !c.dead && Math.floor(this.time * 2 + x + y) % 9 === 0) {
            // sparkle on ripe crops
            ctx.fillStyle = PALETTE[C.cream];
            ctx.fillRect(x * TILE + 3 + ((x * 7) % 9), y * TILE - 2, 1, 1);
          }
        }
      }
  }

  private drawStructs(g: Game, tx0: number, ty0: number, tx1: number, ty1: number, D: Drawable[]) {
    const ctx = this.ctx;
    const ents = g.ents;
    const frame = Math.floor(this.time * 8) % 4;
    const season = g.time.season;
    const seen = new Set<number>();
    const pos = { x: 0, y: 0 };
    const beltItems: [number, number, number][] = [];
    for (let y = ty0 - 2; y <= ty1 + 2; y++)
      for (let x = tx0 - 3; x <= tx1 + 1; x++) {
        const e0 = ents.at(x, y);
        if (!e0) continue;
        const e = e0;
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (e.ghost) {
          D.push({ y: e.y + e.h - 0.1, f: () => this.drawGhost(e) });
          continue;
        }
        const d = e.def;
        if (e.belt) {
          const b = e.belt;
          const tier = d.tier ?? 1;
          const bf = Math.floor(this.time * b.speed * 4) % 4;
          if (d.kind === 'splitter') {
            if (!e.parent) {
              // draw belts under both halves then the splitter box across them
              const sp = sprite(`belt:${tier}:${e.rot}:0:${bf}`);
              drawSprite(ctx, sp, e.x * TILE, e.y * TILE);
              if (e.child) drawSprite(ctx, sp, e.child.x * TILE, e.child.y * TILE);
              const box = sprite(`split:${tier}:${frame}`);
              const cxp = (e.x + (e.child ? (e.child.x - e.x) / 2 : 0)) * TILE + 8, cyp = (e.y + (e.child ? (e.child.y - e.y) / 2 : 0)) * TILE + 8;
              D.push({ y: e.y + 0.55, f: () => {
                ctx.save();
                ctx.translate(cxp, cyp);
                ctx.rotate((e.rot * Math.PI) / 2);
                ctx.drawImage(box.img, box.x, box.y, 32, 16, -16, -8, 32, 16);
                ctx.restore();
                this.drawSplitFilter(e, cxp, cyp);
              } });
            } else {
              const root = e.parent;
              if (!seen.has(root.id)) {
                seen.add(root.id);
                const sp = sprite(`belt:${tier}:${root.rot}:0:${bf}`);
                drawSprite(ctx, sp, root.x * TILE, root.y * TILE);
                drawSprite(ctx, sp, e.x * TILE, e.y * TILE);
                const box = sprite(`split:${tier}:${frame}`);
                const cxp = (root.x + (e.x - root.x) / 2) * TILE + 8, cyp = (root.y + (e.y - root.y) / 2) * TILE + 8;
                D.push({ y: root.y + 0.55, f: () => {
                  ctx.save();
                  ctx.translate(cxp, cyp);
                  ctx.rotate((root.rot * Math.PI) / 2);
                  ctx.drawImage(box.img, box.x, box.y, 32, 16, -16, -8, 32, 16);
                  ctx.restore();
                  this.drawSplitFilter(root, cxp, cyp);
                } });
                this.collectBeltItems(root, beltItems, pos);
              }
            }
          } else if (d.kind === 'underground') {
            const sp = sprite(`ug:${tier}:${e.rot}:${b.kind === BeltKind.UnderIn ? 1 : 0}:${bf}`);
            drawSprite(ctx, sp, e.x * TILE, e.y * TILE);
          } else {
            const sp = sprite(`belt:${tier}:${e.rot}:${b.curve}:${bf}`);
            drawSprite(ctx, sp, e.x * TILE, e.y * TILE);
          }
          this.collectBeltItems(e, beltItems, pos);
          continue;
        }
        if (e.arm) {
          D.push({ y: e.y + 0.5, f: () => this.drawArm(g, e) });
          continue;
        }
        if (d.kind === 'path') continue;
        if (d.kind === 'megaproject' && e.st.project) {
          const def = MEGA_BY_ID.get(e.st.project);
          if (def) {
            let frac = 0;
            if (!e.st.complete) {
              const stg = def.stages[e.st.stage];
              const tot = stg ? stg.items.reduce((a, i) => a + i.n, 0) : 1;
              const got = stg ? stg.items.reduce((a, i) => a + Math.min(i.n, e.st.delivered?.[i.item] ?? 0), 0) : 0;
              frac = (e.st.stage + got / tot) / def.stages.length;
            } else frac = 1;
            const q = e.st.complete ? 8 : Math.min(7, Math.floor(frac * 8));
            const ms = sprite(`mega:${def.id}:${q}:${Math.floor(this.time * 2) % 2}`);
            D.push({ y: e.y + e.h - 0.02, f: () => drawSprite(ctx, ms, e.x * TILE, e.y * TILE) });
            continue;
          }
        }
        const on = e.working || (d.kind === 'lamp' && g.daylight < 0.6) || (d.kind === 'generator' && (e.gen?.out ?? 0) > 0) || (d.kind === 'hive' && e.st.bots > 0);
        const animated = on && (e.mach || d.kind === 'generator' || d.kind === 'drill' || d.kind === 'harvester' || d.kind === 'planter' || d.kind === 'beehouse');
        const f = d.id === 'waterwheel' ? Math.floor(this.time * 6) % 4 : animated ? frame : 0;
        const s = sprite(`st:${d.id}:${f}:${on ? 1 : 0}:${season}`);
        if (d.kind === 'fence' || d.kind === 'gate') {
          D.push({ y: e.y + 0.7, f: () => drawSprite(ctx, s, e.x * TILE, e.y * TILE) });
          continue;
        }
        D.push({ y: e.y + e.h - 0.02, f: () => {
          drawSprite(ctx, s, e.x * TILE, e.y * TILE);
          if (d.id === 'windmill') this.drawWindmillBlades(g, e);
          if (d.kind === 'drill') this.drawDrillArrow(e);
          if (d.kind === 'pond' && e.st.pop) {
            // the school swimming in circles
            const n = Math.min(10, e.st.pop);
            for (let k = 0; k < n; k++) {
              const a = this.time * (0.4 + (k % 3) * 0.15) + k * 2.1;
              const r = 6 + (k % 4) * 2.5;
              const fx = e.x * TILE + 24 + Math.cos(a) * r, fy = e.y * TILE + 26 + Math.sin(a) * r * 0.75;
              ctx.fillStyle = rgba(k % 3 === 0 ? C.butter : C.apricot, 0.8);
              ctx.fillRect(Math.round(fx), Math.round(fy), 3, 1);
              ctx.fillRect(Math.round(fx) + (Math.cos(a) > 0 ? -1 : 3), Math.round(fy), 1, 1);
            }
          }
          if (e.mach && e.mach.crafting) this.drawProgressPip(e, e.mach.progress);
          if (e.def.kind === 'decor' && e.def.id === 'sign' && e.st.k !== null && e.st.k !== undefined) {
            drawItemIcon(ctx, itemIdCache(e.st.k), e.x * TILE + 3, e.y * TILE - 3, 10);
          }
          if (e.def.kind === 'machine' && e.def.powerUse && e.sat < 0.5 && e.working) this.drawNoPower(e);
        } });
        // chimney smoke
        if (on && EXTRA_TOP[d.id] >= 8 && (e.mach?.station === 'smelter' || e.def.fuel || d.id === 'steam_engine' || d.id === 'kitchen' || d.id === 'bottler' || d.kind === 'drill' || d.id === 'steam_loom')) {
          if (Math.random() < dt60(this) * 0.08) this.particles.smoke(e.x * TILE + e.w * TILE - 6, e.y * TILE - EXTRA_TOP[d.id] + 2);
        }
      }
    // belt items, drawn on top of belts but below sorted sprites
    for (const [k, px, py] of beltItems) {
      // 10x10 belt icon (8x8 fill + outline) drawn 1:1 on whole pixels, centered on its lane
      const s = sprite('ib:' + itemIdCache(k));
      ctx.drawImage(s.img, s.x, s.y, 10, 10, Math.round(px * TILE) - 5, Math.round(py * TILE) - 5, 10, 10);
    }
  }

  private collectBeltItems(e: Ent, out: [number, number, number][], pos: { x: number; y: number }) {
    const b = e.belt!;
    for (let li = 0; li < 2; li++) {
      const L = b.lanes[li];
      for (let i = 0; i < L.k.length; i++) {
        if (b.kind === BeltKind.UnderIn && L.p[i] > 0.55) continue;
        itemPos(e, li, L.p[i], pos);
        out.push([L.k[i], pos.x, pos.y]);
      }
    }
  }

  private drawGhost(e: Ent) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.45;
    if (e.def.kind === 'belt' || e.def.kind === 'underground') drawSprite(ctx, sprite(`belt:${e.def.tier}:${e.rot}:0:0`), e.x * TILE, e.y * TILE);
    else if (e.def.kind === 'arm') drawSprite(ctx, sprite(`armb:${e.def.id}`), e.x * TILE, e.y * TILE);
    else if (e.def.kind !== 'splitter') drawSprite(ctx, sprite(`st:${e.def.id}:0:0:1`), e.x * TILE, e.y * TILE);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(C.sky, 0.25);
    ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
  }

  drawArm(g: Game, e: Ent) {
    const ctx = this.ctx;
    const a = e.arm!;
    const base = sprite(`armb:${e.def.id}`);
    drawSprite(ctx, base, e.x * TILE, e.y * TILE);
    // swing from pick side (t=0) to drop side (t=1) over the top
    const cx = e.x * TILE + 8, cy = e.y * TILE + 7;
    const reach = a.reach * 13;
    const ang0 = Math.atan2(-DY[e.rot], -DX[e.rot]);
    const ang = ang0 + a.t * Math.PI * (e.rot % 2 === 0 ? 1 : -1);
    const lift = Math.sin(a.t * Math.PI) * 4;
    const hx = cx + Math.cos(ang) * reach * (0.35 + 0.65 * Math.abs(Math.cos(a.t * Math.PI))), hy = cy + Math.sin(ang) * reach * (0.35 + 0.65 * Math.abs(Math.cos(a.t * Math.PI))) - lift;
    const col = e.def.id === 'arm_basic' ? C.oak : e.def.id === 'arm_fast' ? C.brass : e.def.id === 'arm_long' ? C.rose : e.def.id === 'arm_filter' ? C.lavender : C.sky;
    const ex = (cx + hx) / 2 + Math.cos(ang + Math.PI / 2) * 2, ey = (cy + hy) / 2 - 5 - lift;
    pxLine(ctx, cx, cy - 1, ex, ey, C.ink, 3);
    pxLine(ctx, ex, ey, hx, hy, C.ink, 3);
    pxLine(ctx, cx, cy - 1, ex, ey, col, 1);
    pxLine(ctx, ex, ey, hx, hy, col, 1);
    ctx.fillStyle = PALETTE[C.brass];
    ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2);
    ctx.fillStyle = PALETTE[C.slate];
    ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 1, 4, 2);
    if (a.held) {
      drawItemIcon(ctx, itemIdCache(a.held.k), Math.round(hx - 5), Math.round(hy - 7), 10);
    }
    if (a.powered && e.sat < 0.05) this.drawNoPower(e);
  }

  private drawNoPower(e: Ent) {
    const ctx = this.ctx;
    if (Math.floor(this.time * 2) % 2) return;
    const x = e.x * TILE + e.w * 8 - 4, y = e.y * TILE - 8;
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x - 1, y - 1, 9, 9);
    ctx.fillStyle = PALETTE[C.amber];
    ctx.fillRect(x, y, 7, 7);
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x + 3, y + 1, 1, 3);
    ctx.fillRect(x + 2, y + 3, 3, 1);
    ctx.fillRect(x + 3, y + 5, 1, 1);
  }

  private drawProgressPip(e: Ent, p: number) {
    const ctx = this.ctx;
    const w = Math.min(12, e.w * TILE - 4);
    const x = e.x * TILE + (e.w * TILE - w) / 2, y = e.y * TILE + e.h * TILE - 3;
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x - 1, y, w + 2, 3);
    ctx.fillStyle = PALETTE[C.lime];
    ctx.fillRect(x, y + 1, Math.round(w * Math.min(1, p)), 1);
  }

  private drawWindmillBlades(g: Game, e: Ent) {
    const ctx = this.ctx;
    const cx = e.x * TILE + 16, cy = e.y * TILE - 22;
    const a0 = (this.time * g.wind * 1.4) % (Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i * Math.PI) / 2;
      const ex = cx + Math.cos(a) * 15, ey = cy + Math.sin(a) * 15;
      pxLine(ctx, cx, cy, ex, ey, C.ink, 3);
      pxLine(ctx, cx, cy, ex, ey, C.walnut, 1);
      const mx = cx + Math.cos(a) * 9, my = cy + Math.sin(a) * 9;
      const nx = Math.cos(a + Math.PI / 2) * 3, ny = Math.sin(a + Math.PI / 2) * 3;
      pxLine(ctx, mx, my, mx + nx + Math.cos(a) * 5, my + ny + Math.sin(a) * 5, C.cream, 2);
    }
    ctx.fillStyle = PALETTE[C.brass];
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
  }

  private drawDrillArrow(e: Ent) {
    const ctx = this.ctx;
    const cx = e.x * TILE + e.w * 8 + DX[e.rot] * (e.w * 8 + 1), cy = e.y * TILE + e.h * 8 + DY[e.rot] * (e.h * 8 + 1);
    ctx.fillStyle = PALETTE[C.amber];
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  }

  private drawWires(g: Game) {
    const ps = powerState(g);
    const ctx = this.ctx;
    const v = this.view;
    for (const [a, b] of ps.wires) {
      const ax = (a.x + a.w / 2) * TILE, ay = a.y * TILE - (EXTRA_TOP[a.def.id] ?? 16) + 2;
      const bx = (b.x + b.w / 2) * TILE, by = b.y * TILE - (EXTRA_TOP[b.def.id] ?? 16) + 2;
      if (Math.max(ax, bx) < v.x0 || Math.min(ax, bx) > v.x1 || Math.max(ay, by) < v.y0 - 20 || Math.min(ay, by) > v.y1) continue;
      ctx.fillStyle = PALETTE[C.copper];
      const n = Math.max(4, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t + Math.sin(t * Math.PI) * 6;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }

  /** small world-space details: mailbox flag, festival bunting, clock hands, NPC name tags */
  private drawTownExtras(g: Game) {
    const ctx = this.ctx;
    const m = g.map;
    // mailbox flag when there's unread mail
    const unread = g.sys.mail?.unread?.() ?? 0;
    const mb = SHIPBIN_POS;
    if (mb) {
      const [mx, my] = [mb[0] + 2, mb[1]];
      if (unread > 0) {
        const wave = Math.round(Math.sin(this.time * 4));
        ctx.fillStyle = PALETTE[C.ink];
        ctx.fillRect(mx * TILE + 11, my * TILE - 6, 1, 8);
        ctx.fillStyle = PALETTE[C.rose];
        ctx.fillRect(mx * TILE + 12, my * TILE - 6 + wave * 0, 4, 3);
        // bouncing letter hint
        const by = my * TILE - 14 + Math.sin(this.time * 3) * 2;
        ctx.fillStyle = PALETTE[C.ink];
        ctx.fillRect(mx * TILE + 3, by - 1, 10, 8);
        ctx.fillStyle = PALETTE[C.cream];
        ctx.fillRect(mx * TILE + 4, by, 8, 6);
        ctx.fillStyle = PALETTE[C.rose];
        ctx.fillRect(mx * TILE + 7, by + 2, 2, 2);
      }
    }
    // festival bunting around the square
    if (g.sys.festivals?.active) {
      const sq = m.locs.get('square');
      if (sq) {
        const cols = [C.rose, C.amber, C.sky, C.leaf, C.lavender];
        const x0 = (sq[0] - 10) * TILE, x1 = (sq[0] + 11) * TILE, y0 = (sq[1] - 9) * TILE, y1 = (sq[1] + 5) * TILE;
        const edge = (ax: number, ay: number, bx: number, by: number) => {
          const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
          for (let i = 0; i < n; i++) {
            const t = i / n;
            const x = ax + (bx - ax) * t, y = ay + (by - ay) * t + Math.sin(t * Math.PI * 4) * 3 - 20;
            ctx.fillStyle = PALETTE[C.walnut];
            ctx.fillRect(Math.round(x), Math.round(y), 6, 1);
            ctx.fillStyle = PALETTE[cols[i % cols.length]];
            ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 3, 3);
            ctx.fillRect(Math.round(x) + 2, Math.round(y) + 4, 1, 1);
          }
        };
        edge(x0, y0, x1, y0);
        edge(x0, y1, x1, y1);
      }
    }
    // the restored clocktower shows the real time
    if (g.flags.has('clock_fixed')) {
      const b = m.buildings.find((x) => x.id === 'clocktower');
      if (b) {
        const cx = b.x * TILE + (b.w * TILE) / 2, cy = b.y * TILE - 18 + 30;
        const h = (g.time.min / 60) % 12, mi = g.time.min % 60;
        const ah = (h / 12) * Math.PI * 2 - Math.PI / 2, am = (mi / 60) * Math.PI * 2 - Math.PI / 2;
        pxLine(ctx, cx, cy, cx + Math.cos(ah) * 4, cy + Math.sin(ah) * 4, C.ink, 1);
        pxLine(ctx, cx, cy, cx + Math.cos(am) * 6, cy + Math.sin(am) * 6, C.brick, 1);
      }
    }
  }

  private drawGreenhouseRoof(g: Game) {
    const ctx = this.ctx;
    const G = GREENHOUSE;
    const p = g.player;
    const inside = p.x >= G.x && p.x < G.x + G.w && p.y >= G.y && p.y < G.y + G.h + 0.3;
    const fixed = g.flags.has('greenhouse_fixed');
    ctx.globalAlpha = inside ? 0.12 : fixed ? 0.5 : 0.65;
    const x0 = G.x * TILE, y0 = (G.y + 2) * TILE - 6, w = G.w * TILE, h = (G.h - 2) * TILE + 2;
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 16) {
        const broken = !fixed && hash2(Math.floor(x / 16), Math.floor(y / 12), 9) < 0.35;
        if (broken) continue;
        ctx.fillStyle = PALETTE[(y / 2) % 6 === 0 ? C.walnut : (x / 16 + y / 12) % 2 ? C.aqua : C.frost];
        ctx.fillRect(x0 + x, y0 + y, 15, 2);
      }
    ctx.globalAlpha = 1;
    // frame
    ctx.fillStyle = PALETTE[C.walnut];
    for (let x = 0; x <= w; x += 16) ctx.fillRect(x0 + x, y0, 1, h);
    ctx.fillRect(x0, y0 + h, w, 1);
  }

  private drawActors(g: Game, m: TileMap, D: Drawable[]) {
    const ctx = this.ctx;
    const v = this.view;
    const onScreen = (x: number, y: number) => x * TILE > v.x0 - 32 && x * TILE < v.x1 + 32 && y * TILE > v.y0 - 32 && y * TILE < v.y1 + 48;
    // player
    const p = g.player;
    const pf = p.anim ? (p.anim.t < p.anim.dur * 0.45 ? 4 : 5) : p.moving ? Math.floor(p.walkT * 1.6) % 4 : 0;
    D.push({ y: p.y, f: () => {
      const sh = sprite('shadow:12');
      drawSprite(ctx, sh, p.x * TILE, p.y * TILE);
      if (p.invuln > 0 && Math.floor(this.time * 20) % 2) return;
      const s = sprite(`ch:player:${p.dir}:${pf}`);
      drawSprite(ctx, s, p.x * TILE, p.y * TILE, 1, p.dir === 3);
      // held tool / item during animations
      if (p.anim) this.drawToolSwing(g);
      else {
        const held = p.inv.slots[p.sel];
        const hd = held ? ITEMS[held.k >> 2] : null;
        if (held && hd && !hd.tool && !hd.weapon && !hd.places && hd.cat !== 'seed' && hd.cat !== 'fertilizer' && !g.player.moving) {
          drawItemIcon(ctx, itemIdCache(held.k), Math.round(p.x * TILE - 5), Math.round(p.y * TILE - 34), 10);
        }
      }
    } });
    // npcs
    const npcs: any[] = m === g.map ? g.sys.npcs?.list ?? [] : [];
    for (const n of npcs) {
      if (!n.visible || !onScreen(n.x, n.y)) continue;
      const f = n.moving ? Math.floor(n.walkT * 1.6) % 4 : 0;
      D.push({ y: n.y, f: () => {
        drawSprite(ctx, sprite('shadow:12'), n.x * TILE, n.y * TILE);
        drawSprite(ctx, sprite(`ch:${n.id}:${n.dir}:${f}`), n.x * TILE, n.y * TILE, 1, n.dir === 3);
        if (n.emote) this.drawEmote(n.x, n.y - 1.9, n.emote);
      } });
    }
    // animals
    const animals: any[] = m === g.map ? g.sys.animals?.list ?? [] : [];
    for (const a of animals) {
      if (!a.visible || !onScreen(a.x, a.y)) continue;
      const f = a.moving ? Math.floor(a.walkT * 2) % 2 : 0;
      D.push({ y: a.y, f: () => {
        drawSprite(ctx, sprite('shadow:12'), a.x * TILE, a.y * TILE);
        drawSprite(ctx, sprite(`an:${a.kind}:${f}:${a.baby ? 1 : 0}`), a.x * TILE, a.y * TILE, 1, a.dir === 3);
        if (a.emote) this.drawEmote(a.x, a.y - 1.4, a.emote);
      } });
    }
    // your partner by the hearth in the evening
    if (g.player.where === 'house' && g.sys.partnerHome?.(g)) {
      const id = [...g.flags].find((f: string) => f.startsWith('partner:'))!.slice(8);
      const [px, py] = [8.5, 7.5];
      D.push({ y: py, f: () => {
        drawSprite(ctx, sprite('shadow:12'), px * TILE, py * TILE);
        drawSprite(ctx, sprite(`ch:${id}:2:0`), px * TILE, py * TILE);
      } });
    }
    // Mags' traveling cart by the square
    const cpos = g.sys.cart?.pos as [number, number] | undefined;
    if (cpos && g.player.where === 'world' && cartHere(g) && onScreen(cpos[0] + 1.5, cpos[1])) {
      D.push({ y: cpos[1] + 1.4, f: () => drawSprite(ctx, sprite('cartw:0'), cpos[0] * TILE, cpos[1] * TILE) });
      const mx = cpos[0] + 3.6, my = cpos[1] + 1.8;
      D.push({ y: my, f: () => {
        drawSprite(ctx, sprite('shadow:12'), mx * TILE, my * TILE);
        drawSprite(ctx, sprite(`ch:peddler:2:0`), mx * TILE, my * TILE);
      } });
    }
    // the farm pet and its water bowl
    const pet = g.sys.pet;
    if (pet && pet.stage !== 'none' && pet.map === g.player.where && onScreen(pet.x, pet.y)) {
      const pose = pet.mode === 'sleep' ? 3 : pet.mode === 'sit' ? 2 : pet.moving ? Math.floor(pet.walkT * 2.2) % 2 : 0;
      D.push({ y: pet.y, f: () => {
        drawSprite(ctx, sprite('shadow:10'), pet.x * TILE, pet.y * TILE);
        drawSprite(ctx, sprite(`pet:${pet.kind}:${pet.coat}:${pose}`), pet.x * TILE, pet.y * TILE, 1, pet.dir === 3);
        if (pet.emote) this.drawEmote(pet.x, pet.y - 1.1, pet.emote);
      } });
    }
    if (pet && pet.stage === 'adopted' && g.player.where === 'world' && onScreen(pet.bowl[0], pet.bowl[1])) {
      const [bx, by] = pet.bowl;
      D.push({ y: by + 0.3, f: () => drawSprite(ctx, sprite(`bowl:${pet.bowlFull ? 1 : 0}`), bx * TILE, by * TILE) });
    }
    // monsters
    const mons: any[] = g.player.where === 'mine' ? g.sys.mine?.monsters ?? [] : [];
    for (const mo of mons) {
      if (!onScreen(mo.x, mo.y)) continue;
      const f = Math.floor(this.time * 6 + mo.phase) % 4;
      D.push({ y: mo.y, f: () => {
        drawSprite(ctx, sprite('shadow:10'), mo.x * TILE, mo.y * TILE);
        if (mo.hurt > 0) ctx.globalAlpha = 0.5 + Math.sin(this.time * 40) * 0.5;
        drawSprite(ctx, sprite(`mon:${mo.id}:${f}`), mo.x * TILE, mo.y * TILE - (mo.z ?? 0), 1, mo.vx < 0);
        ctx.globalAlpha = 1;
        if (mo.hp < mo.maxHp) {
          ctx.fillStyle = PALETTE[C.ink];
          ctx.fillRect(mo.x * TILE - 7, mo.y * TILE - 22, 14, 3);
          ctx.fillStyle = PALETTE[C.rose];
          ctx.fillRect(mo.x * TILE - 6, mo.y * TILE - 21, Math.round(12 * Math.max(0, mo.hp / mo.maxHp)), 1);
        }
      } });
    }
    // item drops
    const drops: any[] = g.sys.drops?.list?.filter((d: any) => (d.map ?? 'world') === g.player.where) ?? [];
    for (const d of drops) {
      if (!onScreen(d.x, d.y)) continue;
      D.push({ y: d.y, f: () => {
        const bob = Math.sin(this.time * 4 + d.x * 3) * 1.5;
        drawSprite(ctx, sprite('shadow:8'), d.x * TILE, d.y * TILE);
        drawItemIcon(ctx, itemIdCache(d.k), Math.round(d.x * TILE - 6), Math.round(d.y * TILE - 13 - d.z * TILE + bob), 12);
      } });
    }
    // bumblebots (always above)
    const bots: any[] = m === g.map ? g.sys.bots?.list ?? [] : [];
    for (const b of bots) {
      if (!onScreen(b.x, b.y)) continue;
      D.push({ y: b.y + 3, f: () => {
        const bob = Math.sin(this.time * 9 + b.id) * 1.5;
        drawItemIcon(ctx, 'bumblebot', Math.round(b.x * TILE - 8), Math.round(b.y * TILE - 24 + bob), 16);
        if (b.carry) drawItemIcon(ctx, itemIdCache(b.carry.k), Math.round(b.x * TILE - 5), Math.round(b.y * TILE - 12 + bob), 10);
      } });
    }
    // fireballs in the mine
    if (g.player.where === 'mine') {
      for (const b of g.sys.mine?.bolts ?? []) {
        if (!onScreen(b.x, b.y)) continue;
        D.push({ y: b.y + 0.5, f: () => {
          const fl = Math.floor(this.time * 20) % 2;
          ctx.fillStyle = PALETTE[C.terracotta];
          ctx.fillRect(Math.round(b.x * TILE) - 3, Math.round(b.y * TILE) - 10, 6, 6);
          ctx.fillStyle = PALETTE[fl ? C.amber : C.butter];
          ctx.fillRect(Math.round(b.x * TILE) - 2, Math.round(b.y * TILE) - 9, 4, 4);
        } });
      }
    }
    // fishing line + bobber
    const fish = g.sys.fishing;
    if (fish && fish.state && fish.state !== 'idle') {
      D.push({ y: 999, f: () => {
        const rx = p.x * TILE + (p.dir === 3 ? -8 : p.dir === 1 ? 8 : 4), ry = p.y * TILE - 26;
        const bx = fish.bx * TILE, by = fish.by * TILE + (fish.state === 'bite' ? Math.sin(this.time * 30) * 1.5 : Math.sin(this.time * 3));
        ctx.fillStyle = rgba(C.cream, 0.8);
        const n = 24;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          ctx.fillRect(Math.round(rx + (bx - rx) * t), Math.round(ry + (by - ry) * t + Math.sin(t * Math.PI) * 10), 1, 1);
        }
        if (fish.state !== 'casting') {
          ctx.fillStyle = PALETTE[C.ink];
          ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 5, 5);
          ctx.fillStyle = PALETTE[C.rose];
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 2);
          ctx.fillStyle = PALETTE[C.cream];
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) + 1, 3, 1);
          if (fish.state === 'bite') {
            ctx.fillStyle = PALETTE[C.butter];
            ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 12, 3, 7);
            ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 4, 3, 2);
          }
        }
      } });
    }
  }

  private drawEmote(x: number, y: number, e: string) {
    const ctx = this.ctx;
    const px = Math.round(x * TILE) - 6, py = Math.round(y * TILE) - 10;
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(px - 1, py - 1, 14, 12);
    ctx.fillStyle = PALETTE[C.cream];
    ctx.fillRect(px, py, 12, 10);
    ctx.fillRect(px + 4, py + 10, 3, 2);
    const col = e === 'heart' ? C.rose : e === 'happy' ? C.amber : e === 'sad' ? C.sky : e === 'note' ? C.violet : C.ink;
    ctx.fillStyle = PALETTE[col];
    if (e === 'heart') { ctx.fillRect(px + 3, py + 3, 2, 2); ctx.fillRect(px + 7, py + 3, 2, 2); ctx.fillRect(px + 3, py + 4, 6, 2); ctx.fillRect(px + 4, py + 6, 4, 1); ctx.fillRect(px + 5, py + 7, 2, 1); }
    else if (e === '!') { ctx.fillRect(px + 5, py + 2, 2, 4); ctx.fillRect(px + 5, py + 7, 2, 1); }
    else if (e === '?') { ctx.fillRect(px + 4, py + 2, 4, 1); ctx.fillRect(px + 7, py + 3, 1, 2); ctx.fillRect(px + 5, py + 5, 2, 1); ctx.fillRect(px + 5, py + 7, 2, 1); }
    else if (e === 'note') { ctx.fillRect(px + 7, py + 2, 1, 5); ctx.fillRect(px + 4, py + 6, 3, 2); ctx.fillRect(px + 8, py + 2, 2, 1); }
    else if (e === 'zzz') { ctx.fillRect(px + 3, py + 2, 4, 1); ctx.fillRect(px + 5, py + 3, 1, 1); ctx.fillRect(px + 4, py + 4, 1, 1); ctx.fillRect(px + 3, py + 5, 4, 1); ctx.fillRect(px + 8, py + 5, 2, 1); ctx.fillRect(px + 8, py + 7, 2, 1); }
    else { ctx.fillRect(px + 3, py + 3, 2, 2); ctx.fillRect(px + 7, py + 3, 2, 2); ctx.fillRect(px + 3, py + 7, 6, 1); }
  }

  private drawToolSwing(g: Game) {
    const ctx = this.ctx;
    const p = g.player;
    const a = p.anim!;
    const k = a.kind;
    const held = p.inv.slots[p.sel];
    if (!held) return;
    const s = sprite('i:' + itemIdCache(held.k));
    const t = a.t / a.dur;
    const dirAng = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][p.dir];
    const swing = k === 'water' ? 0.2 : k === 'rod' ? -0.6 + t * 0.3 : -1.1 + t * 2.0;
    const ang = dirAng + swing * (p.dir === 3 ? -1 : 1);
    const r = 9;
    const x = p.x * TILE + Math.cos(ang) * r, y = p.y * TILE - 12 + Math.sin(ang) * r;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang + Math.PI / 4);
    ctx.drawImage(s.img, s.x, s.y, 16, 16, -6, -6, 12, 12);
    ctx.restore();
  }
}

function dt60(r: Renderer) {
  void r;
  return 1;
}

// item index -> id (renderer only)
import { ITEMS } from '../data/items';
export function itemIdCache(k: number): string {
  return ITEMS[k >> 2].id;
}

/** pixel line with given thickness in world pixels */
export function pxLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: number, th: number) {
  ctx.fillStyle = PALETTE[c];
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const o = Math.floor(th / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t) - o, Math.round(y0 + (y1 - y0) * t) - o, th, th);
  }
}

export { Z, TREE_BY_ID };
export type { Sprite };
