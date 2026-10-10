// World renderer: camera, chunk-baked ground, culled + y-sorted dynamic sprites,
// belts with their items, arms, wires, lighting and weather.
import { cartHere } from '../sim/systems/cart';
import { kId } from '../sim/inventory';
import { C, PALETTE, rgba } from '../data/palette';
import { CROP_BY_ID } from '../data/crops';
import { MEGA_BY_ID } from '../data/goals';
import { FURN_BY_ID } from '../data/furniture';
import { TREE_BY_ID } from '../data/trees';
import { ANIMAL_BY_ID } from '../data/creatures';
import { hash2 } from '../engine/rng';
import type { Game, Soil } from '../sim/Game';
import { BeltKind, DX, DY, Ent, type Ents } from '../sim/ents';
import { itemPos } from '../sim/systems/belts';
import { armTiles } from '../sim/systems/arms';
import { powerState } from '../sim/systems/power';
import { curMap } from '../sim/systems/player';
import { O, T, TileMap, Z } from '../sim/world/tilemap';
import { GREENHOUSE, SHIPBIN_POS } from '../sim/world/worldgen';
import { drawSprite, drawItemIcon, hasImage, invalidateSpritePrefix, sprite, Sprite } from './atlas';
import { charArtHeight, charFrames, compareIds, sheetToolFrame, smokePoints, terrainArt, type TerrainArt } from './art/sheets';
import { getLook, registerLook } from './art/chars';
import { makeCanvas, ctx2d } from './art/pixel';
import { PRIO, FRINGE_SOURCES, TILE, paintTerrain } from './art/terrain';
import { PixBuf } from './art/pixbuf';
import { EXTRA_TOP } from './art/structs';
import { Particles } from './particles';
import { drawFx, Juice } from './juice';
import { PULSE_COL, machineState } from '../ui/pulse';
import { Lighting } from './lighting';
import { Weather } from './weather';
import { Ambient } from './ambient';
import { camShakeOffset, wobbleOffset } from './shake';
import { drawStateGlyphs } from './glyphs';
import { drawPlanks, planksUnder } from './planks';
import { blendVertex, needsBlend } from './blend';
import { drawDryDrops, drawRail, pushGantry } from './fieldworks';
import { MState } from '../sim/mstate';
import { rusty } from './rust';
import { STRATA, CHAMBER_BY_KIND, VENT_ON, VENT_TELL } from '../data/deepworks';
import { deepFrames } from './art/deep';
import type { MineState } from '../sim/systems/mine';
import { pushTownworks } from './townworks';
import { drawFairPlate, pushFairground } from './fairground';
import { LANDMARK, SQUARE_LAMP } from '../sim/world/townworks';

const CH = TileMap.CHUNK;
/** seconds the rust takes to lift off a restored machine */
const RESTORE_FADE = 0.6;
/** flat objects baked into the ground that get a shadow, and its width */
const SHADOWED_OBJ = new Map<O, number>([
  [O.ROCK, 12], [O.BOULDER, 14], [O.STUMP, 12], [O.LOG, 14], [O.BUSH, 14], [O.ORE_ROCK, 12], [O.GEM_ROCK, 12], [O.BARREL, 12],
  [O.CRATE, 12], [O.HEDGE, 14], [O.ICE_ROCK, 12], [O.STALAGMITE, 10], [O.CRYSTAL, 10], [O.TREASURE, 12], [O.WELL, 14], [O.SIGNPOST, 8],
  [O.MAILBOX, 8], [O.BENCH, 14],
]);
/** shadow width under a tree by growth stage (seed, sprout, sapling, young, mature) */
const TREE_SHADOW = [0, 8, 12, 20, 28];
const FLAT_OBJ = new Set([
  O.ROCK, O.WEED, O.TWIG, O.STUMP, O.LOG, O.TALLGRASS, O.BUSH, O.FLOWER, O.ORE_ROCK, O.ARTIFACT, O.FENCE, O.BENCH,
  O.BARREL, O.GEM_ROCK, O.LADDER, O.SHAFT, O.REEDS, O.LILYPAD, O.MUSHROOM, O.SIGNPOST, O.WELL, O.MAILBOX, O.FLOWERBED,
  O.HEDGE, O.CRATE, O.ELEVATOR, O.MINE_EXIT, O.ICE_ROCK, O.STALAGMITE, O.CRYSTAL, O.BOULDER, O.TREASURE, O.GALLERY,
]);

interface Chunk { c: HTMLCanvasElement; ver: number; season: number; theme: number; soilSig: number }

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
  juice = new Juice();
  lighting = new Lighting();
  weather = new Weather();
  ambient = new Ambient();
  W = 0;
  H = 0;
  time = 0;
  /** structures restored from rust and when (this.time): the rust lifts over RESTORE_FADE s */
  restored = new Map<number, number>();
  drawables: Drawable[] = [];
  /** art overhaul: draw the procedural (1.0) player beside the player, same frame (debug panel) */
  compareArt = false;
  /** the Screen shake setting: off means no camera kick and no tree/structure wobble */
  shakeOn = true;
  /** world-pixel view rect */
  view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** per-frame overlays added by the UI (ghosts, highlights) */
  overlays: ((ctx: CanvasRenderingContext2D) => void)[] = [];
  /** which way each bumblebot faces (from its last position) */
  private botFace = new Map<number, { x: number; left: boolean }>();
  /** when each villager's chat with the player began (renderer time), for a sheet's greeting frames */
  private greetAt = new Map<string, number>();
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
    const wx = (sx - this.W / 2) / z + Math.round(this.cam.x * TILE);
    const wy = (sy - this.H / 2) / z + Math.round(this.cam.y * TILE);
    return { x: wx / TILE, y: wy / TILE };
  }

  tileToScreen(tx: number, ty: number): { x: number; y: number } {
    const z = this.cam.zoom;
    return { x: (tx * TILE - Math.round(this.cam.x * TILE)) * z + this.W / 2, y: (ty * TILE - Math.round(this.cam.y * TILE)) * z + this.H / 2 };
  }

  invalidateAll() {
    this.chunks.clear();
  }

  /** tilled soil is drawn by the terrain art (baked into chunks) instead of per-frame soil sprites */
  soilBaked(): boolean {
    return !!terrainArt()?.hasBase('soil');
  }

  // ---------------- chunks ----------------
  /**
   * Per-chunk signature of the tilled soil (tiles and wet state), for terrain art that bakes soil
   * into the ground: a chunk rebakes when its signature changes. Soil on a chunk edge also counts
   * for the neighbor, whose border vertex tiles it shapes.
   */
  private soilSigs(soil: Map<number, Soil>, m: TileMap): Map<number, number> {
    const sig = new Map<number, number>();
    const cw = Math.ceil(m.w / CH);
    for (const [i, s] of soil) {
      const x = i % m.w, y = (i / m.w) | 0;
      const v = Math.imul(i + 1, 2654435761) ^ (s.water ? 0x5bd1e995 : 0x27d4eb2f);
      for (let cy = Math.floor((y - 1) / CH); cy <= Math.floor((y + 1) / CH); cy++)
        for (let cx = Math.floor((x - 1) / CH); cx <= Math.floor((x + 1) / CH); cx++) {
          if (cx < 0 || cy < 0) continue;
          const ci = cy * cw + cx;
          sig.set(ci, ((sig.get(ci) ?? 0) + v) | 0);
        }
    }
    return sig;
  }

  private chunk(m: TileMap, cx: number, cy: number, season: number, theme: number, soil: Map<number, Soil> | null, soilSig: number): HTMLCanvasElement {
    const key = `${m === this.lastMap ? 'm' : 'x'}${cx},${cy}`;
    const cw = Math.ceil(m.w / CH);
    const ci = cy * cw + cx;
    let ch = this.chunks.get(key);
    const dirty = m.dirtyChunks.has(ci);
    if (ch && ch.season === season && ch.theme === theme && ch.soilSig === soilSig && !dirty) return ch.c;
    if (!ch) {
      ch = { c: makeCanvas(CH * TILE, CH * TILE), ver: 0, season, theme, soilSig };
      this.chunks.set(key, ch);
    }
    m.dirtyChunks.delete(ci);
    ch.season = season;
    ch.theme = theme;
    ch.soilSig = soilSig;
    const art = terrainArt();
    if (art) this.bakeArt(m, cx, cy, ch.c, season, theme, art, soil);
    else this.bake(m, cx, cy, ch.c, season, theme);
    return ch.c;
  }

  /** The terrain class a map tile draws as (terrain art), or null for nothing (void). */
  private terrainClass(m: TileMap, x: number, y: number, theme: number, soil: Map<number, Soil> | null): string | null {
    x = Math.max(0, Math.min(m.w - 1, x));
    y = Math.max(0, Math.min(m.h - 1, y));
    const i = m.idx(x, y);
    if (soil) {
      const s = soil.get(i);
      if (s) return s.water ? 'wet' : 'soil';
    }
    switch (m.ground[i] as T) {
      case T.GRASS: case T.TOWNGRASS: case T.CLIFFTOP: return 'grass';
      case T.DIRT: case T.GARDEN: return 'dirt';
      case T.PATH: return 'path';
      case T.SAND: return 'sand';
      case T.RIVER: case T.LAKE: case T.POND: case T.OCEAN: case T.MINEWATER: return 'water';
      case T.DEEP: return 'deep';
      case T.PLANKS: return 'planks';
      case T.CLIFF: return 'cliff';
      case T.ROCK: return 'rock';
      case T.ORE_VEIN: return 'ore' + m.objData[i];
      case T.MINEFLOOR: return 'minefloor' + theme;
      case T.MINEWALL: return 'minewall' + theme;
      case T.LAVA: return 'lava';
      case T.WOODFLOOR: return 'woodfloor';
      case T.HOUSEWALL: { const v = m.deco[i] % 8; return v === 0 ? 'wall' : v === 3 ? 'wall_upper' : 'wall_top'; }
      default: return null;
    }
  }

  /**
   * Ground from imported terrain art: a dual grid (one Wang tile per grid vertex, picked from the
   * four tiles meeting there), per-tile classes (cliffs, planks, floors) on top, then decals and
   * flat objects. Classes without art fall back to the procedural painter.
   */
  private bakeArt(m: TileMap, cx: number, cy: number, c: HTMLCanvasElement, season: number, theme: number, art: TerrainArt, soil: Map<number, Soil> | null) {
    const ctx = ctx2d(c);
    ctx.clearRect(0, 0, c.width, c.height);
    const x0 = cx * CH, y0 = cy * CH;
    const N = CH + 2;
    // classes of the chunk's tiles plus a 1-tile border; per-tile classes get a Wang underlay
    const WANG_FALLBACK: Record<string, string[]> = { deep: ['water'], wet: ['soil'], soil: [], path: [], sand: [], water: [], grass: [], dirt: [] };
    const UNDER: Record<string, string> = { planks: 'water', cliff: 'grass', rock: 'dirt' };
    const wangOf = (k: string | null): string | null => {
      if (!k) return null;
      const u = k in WANG_FALLBACK ? k : k.startsWith('ore') ? 'dirt' : UNDER[k];
      if (!u) return null;
      if (art.hasBase(u)) return u;
      for (const f of WANG_FALLBACK[u] ?? []) if (art.hasBase(f)) return f;
      return null;
    };
    const cls: (string | null)[] = new Array(N * N);
    const wang: (string | null)[] = new Array(N * N);
    for (let ly = -1; ly <= CH; ly++)
      for (let lx = -1; lx <= CH; lx++) {
        const k = this.terrainClass(m, x0 + lx, y0 + ly, theme, soil);
        cls[(ly + 1) * N + lx + 1] = k;
        // a plank walk on land sits on its land, not on a ring of water (src/render/planks.ts)
        wang[(ly + 1) * N + lx + 1] = k === 'planks' ? planksUnder(m, x0 + lx, y0 + ly) : wangOf(k);
      }
    const at = (lx: number, ly: number) => cls[(ly + 1) * N + lx + 1];
    const wAt = (lx: number, ly: number) => wang[(ly + 1) * N + lx + 1];
    // pass 1: vertex tiles
    const missing: [number, number][] = [];
    const sp = (name: string, px: number, py: number) => {
      const s = sprite(name);
      ctx.drawImage(s.img, s.x, s.y, s.w, s.h, px, py, s.w, s.h);
    };
    for (let vy = 0; vy <= CH; vy++)
      for (let vx = 0; vx <= CH; vx++) {
        const cs = [wAt(vx - 1, vy - 1), wAt(vx, vy - 1), wAt(vx - 1, vy), wAt(vx, vy)];
        const known = cs.filter((k): k is string => !!k);
        if (!known.length) continue;
        // a corner without a Wang class takes the most common class around it
        const common = known.sort((a, b) => known.filter((k) => k === b).length - known.filter((k) => k === a).length)[0];
        const [nw, ne, sw, se] = cs.map((k) => k ?? common);
        // meetings with no transition art (flagstone and water, tilled soil and a path, three terrains
        // at once) are painted rather than cut square (src/render/blend.ts)
        const corners = [nw!, ne!, sw!, se!];
        if (needsBlend(art.hasSet, corners) && blendVertex(art, corners, x0 + vx, y0 + vy, season, ctx, vx * TILE - 8, vy * TILE - 8)) continue;
        const name = art.vertex(nw!, ne!, sw!, se!, hash2(x0 + vx, y0 + vy, 7), season);
        if (name) sp(name, vx * TILE - 8, vy * TILE - 8);
        else missing.push([vx, vy]);
      }
    // pass 2: per-tile classes, and the procedural painter for anything without art
    const old = (lx: number, ly: number) => {
      const x = x0 + lx, y = y0 + ly, i = m.idx(x, y);
      const t = m.ground[i] as T;
      const pb = new PixBuf(TILE, TILE);
      const extra = t === T.ORE_VEIN ? m.objData[i] : t === T.MINEFLOOR || t === T.MINEWALL ? theme : 0;
      paintTerrain(pb, t, t === T.MINEFLOOR || t === T.MINEWALL ? 0 : season, m.deco[i] % 8, 0, 0, extra, x * TILE, y * TILE);
      const tc = makeCanvas(TILE, TILE);
      pb.drawTo(ctx2d(tc));
      ctx.drawImage(tc, lx * TILE, ly * TILE);
    };
    const oldTiles = new Set<number>();
    for (const [vx, vy] of missing)
      for (const [lx, ly] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]])
        if (lx >= 0 && ly >= 0 && lx < CH && ly < CH && m.inb(x0 + lx, y0 + ly)) oldTiles.add(ly * CH + lx);
    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (!m.inb(x, y)) continue;
        const k = at(lx, ly);
        if (!k) continue;
        if (k in WANG_FALLBACK) {
          if (!wAt(lx, ly)) oldTiles.add(ly * CH + lx);
          continue;
        }
        // plank decks: boards along the run, rails over water, ends at land (src/render/planks.ts)
        if (k === 'planks' && drawPlanks(m, x, y, season, (n) => sp(n, lx * TILE, ly * TILE))) {
          oldTiles.delete(ly * CH + lx);
          continue;
        }
        const h = hash2(x, y, 9);
        let role = k;
        if (k === 'cliff') {
          const above = at(lx, ly - 1), below = at(lx, ly + 1);
          if (above !== 'cliff' && art.hasTile('cliff_top')) role = 'cliff_top';
          else if (below !== 'cliff' && art.hasTile('cliff_base')) role = 'cliff_base';
        }
        const name = art.tile(role, h, season) ?? (k.startsWith('ore') ? art.tile('ore', h, season) ?? art.tile('rock', h, season) : null) ??
          (/\d$/.test(k) ? art.tile(k.slice(0, -1), h, season) : null);
        if (name) {
          sp(name, lx * TILE, ly * TILE);
          oldTiles.delete(ly * CH + lx);
          if (k.startsWith('minewall')) {
            // cave walls away from open floor sink into shadow (only faces next to the floor show rock)
            const open = (yy: number) => { const gg = m.g(x, yy); return gg !== T.MINEWALL && gg !== T.VOID; };
            if (!open(y + 1)) {
              ctx.fillStyle = PALETTE[C.ink];
              ctx.fillRect(lx * TILE, ly * TILE, TILE, open(y + 2) ? 8 : TILE);
            }
          }
        } else oldTiles.add(ly * CH + lx);
      }
    for (const k of oldTiles) old(k % CH, Math.floor(k / CH));
    // pass 3: decals where a tile and its 8 neighbors share a class (never across a transition);
    // none indoors (the Workshop wing's flagstones)
    if (!m.indoors) for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const k = at(lx, ly);
        if (k !== 'grass' && k !== 'dirt' && k !== 'sand' && k !== 'path') continue;
        const x = x0 + lx, y = y0 + ly;
        // paths stay mostly clean: a stray leaf or pebble on 1 cobble in 12
        if (hash2(x, y, 3) > (k === 'path' ? 0.08 : 0.2) || m.obj[m.idx(x, y)]) continue;
        let same = true;
        for (let dy = -1; dy <= 1 && same; dy++) for (let dx = -1; dx <= 1; dx++) if (at(lx + dx, ly + dy) !== k) { same = false; break; }
        if (!same) continue;
        const name = art.decal(k, hash2(x, y, 5), season);
        if (!name) continue;
        const s = sprite(name);
        sp(name, lx * TILE + Math.floor(hash2(x, y, 11) * (TILE - s.w + 1)), ly * TILE + Math.floor(hash2(x, y, 13) * (TILE - s.h + 1)));
      }
    this.bakeObjects(m, x0, y0, ctx, season);
  }

  /** Flat objects and forage baked into the ground (both terrain paths). */
  private bakeObjects(m: TileMap, x0: number, y0: number, ctx: CanvasRenderingContext2D, season: number) {
    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const x = x0 + lx, y = y0 + ly;
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        const v = m.deco[i] % 8;
        const px = lx * TILE, py = ly * TILE;
        const o = m.obj[i] as O;
        if (o && FLAT_OBJ.has(o)) {
          const s2 = sprite(`o:${o}:${o === O.FLOWER || o === O.FLOWERBED ? m.objData[i] % 6 : o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.TREASURE || o === O.GALLERY ? m.objData[i] : v % 3}:${season}`);
          // a soft shadow under things that stand on the ground (STYLE.md)
          const sw = SHADOWED_OBJ.get(o);
          if (sw) drawSprite(ctx, sprite(`shadow:${sw}`), px + 8, py + 14);
          ctx.drawImage(s2.img, s2.x, s2.y, 16, 16, px, py, 16, 16);
        } else if (o === O.FORAGE) {
          const id = m.forage.get(i);
          if (id) drawItemIcon(ctx, id, px + 2, py + 2, 12);
        }
      }
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
          const s2 = sprite(`o:${o}:${o === O.FLOWER || o === O.FLOWERBED ? m.objData[i] % 6 : o === O.ORE_ROCK || o === O.GEM_ROCK || o === O.TREASURE || o === O.GALLERY ? m.objData[i] : v % 3}:${season}`);
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
    // indoors and underground the floor has no seasons (a stone workshop floor never snows)
    const season = g.player.where !== 'world' ? 0 : g.time.season;
    // the Deepworks' stratum picks its terrain art class (minefloor<art>, minewall<art>)
    const theme = g.player.where === 'mine' ? STRATA[g.sys.mine?.theme ?? 0]?.art ?? 0 : 0;
    const cam = this.cam;
    const z = cam.zoom;
    const sh = this.shakeOn ? camShakeOffset(cam.shake, Math.random()) : 0;
    // the camera snaps to whole world pixels like the sprites do, so they don't shimmer against it
    const camPx = Math.round(cam.x * TILE), camPy = Math.round(cam.y * TILE);
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

    // chunks (with terrain art that has tilled-soil tiles, the soil is part of the farm's ground)
    const soil = m === g.map && this.soilBaked() ? g.soil : null;
    const soilSig = soil ? this.soilSigs(soil, m) : new Map<number, number>();
    const cx0 = Math.floor(tx0 / CH), cy0 = Math.floor(ty0 / CH), cx1 = Math.floor(tx1 / CH), cy1 = Math.floor(ty1 / CH);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.chunk(m, cx, cy, season, theme, soil, soil ? soilSig.get(cy * Math.ceil(m.w / CH) + cx) ?? 0 : 0);
        ctx.drawImage(c, cx * CH * TILE, cy * CH * TILE);
      }
    // open water drifts: pure water vertices cycle through their ripple variants, staggered per tile
    const tArt = terrainArt();
    if (tArt) {
      for (let vy = ty0; vy <= ty1 + 1; vy++)
        for (let vx = tx0; vx <= tx1 + 1; vx++) {
          const k = this.terrainClass(m, vx, vy, theme, null);
          if (k !== 'water' && k !== 'deep') continue;
          if (this.terrainClass(m, vx - 1, vy - 1, theme, null) !== k || this.terrainClass(m, vx, vy - 1, theme, null) !== k || this.terrainClass(m, vx - 1, vy, theme, null) !== k) continue;
          // lily pads and reeds are baked into the ground under this tile: keep it still
          if (m.inb(vx - 1, vy - 1) && m.inb(vx, vy) && (m.obj[m.idx(vx - 1, vy - 1)] || m.obj[m.idx(vx, vy - 1)] || m.obj[m.idx(vx - 1, vy)] || m.obj[m.idx(vx, vy)])) continue;
          const ph = hash2(vx, vy, 17);
          const step = Math.floor(this.time / (1.6 + ph * 1.4) + ph * 7);
          const name = tArt.vertex(k, k, k, k, hash2(vx + step * 31, vy - step * 17, 7), season);
          if (!name) continue;
          const s = sprite(name);
          ctx.drawImage(s.img, s.x, s.y, s.w, s.h, vx * TILE - 8, vy * TILE - 8, s.w, s.h);
        }
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
    // the Deepworks' hazards on the floor: cracks under a loose ceiling, a star-shard's mark
    if (g.player.where === 'mine') this.drawHazards(g, false);
    // the Sprocket Fair's plate on the square while it's on (src/render/fairground.ts)
    if (m === g.map) drawFairPlate(ctx, g);

    const D: Drawable[] = (this.drawables = []);
    // soil + crops
    if (m === g.map) this.drawSoil(g, tx0, ty0, tx1, ty1, D);
    // floor structures (belts etc.) and y-sorted structures: the farm's, or the farmhouse's (Workshop HQ)
    if (m === g.map) this.drawStructs(g, g.ents, tx0, ty0, tx1, ty1, D);
    else if (g.player.where === 'house') this.drawStructs(g, g.houseEnts, tx0, ty0, tx1, ty1, D);
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
          const sxx = x * TILE + 8 + (shake > 0 ? (this.shakeOn ? wobbleOffset(shake, this.time) : 0) : tr.stage >= 2 ? this.ambient.swayAt(x, y) : 0);
          // fade trees in front of the player
          D.push({ y: y + 0.95, f: () => {
            const p = g.player;
            const near = tr.stage >= 3 && p.y < y + 0.9 && p.y > y - 2.2 && Math.abs(p.x - (x + 0.5)) < 1.3;
            if (tr.stage >= 1) drawSprite(ctx, sprite(`shadow:${TREE_SHADOW[tr.stage] ?? 28}`), x * TILE + 8, y * TILE + 14);
            if (near) ctx.globalAlpha = 0.55;
            drawSprite(ctx, s, sxx, y * TILE + 15);
            ctx.globalAlpha = 1;
          } });
        } else if (o === O.LAMPPOST && m.objData[i] !== SQUARE_LAMP) {
          // (the square's twelve lamps are drawn by pushTownworks: they light on the player's power)
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
      // the town keystones' landmarks draw their own states (pushTownworks, below)
      if (b.kind === LANDMARK) continue;
      // imported frames overhang their footprint (the airship's balloon by 68 px), so cull wider
      if ((b.x + b.w + 1) * TILE < vx0 || (b.x - 1) * TILE > vx1 || (b.y - 5) * TILE > vy1 || (b.y + b.h) * TILE < vy0) continue;
      const st = b.id === 'clocktower' ? (g.flags.has('clock_fixed') ? 1 : 0) : b.id === 'greenhouse' ? (g.flags.has('greenhouse_fixed') ? 1 : 0) : g.daylight < 0.55 ? 1 : 0;
      // the airship bobs: its sheet has 4 frames (bld:airship:<season>:<night>:<frame>)
      const s = sprite(b.id === 'airship' ? `bld:airship:${season}:${st}:${Math.floor(this.time * 3) % 4}` : `bld:${b.id}:${season}:${st}`);
      D.push({ y: b.y + b.h - 0.05, f: () => drawSprite(ctx, s, b.x * TILE, b.y * TILE) });
    }
    // the town keystones: the Town Mill, the Waterworks, the square's lamps, the tram (src/render/townworks.ts)
    if (m === g.map) pushTownworks(g, this, D);
    if (m === g.map) pushFairground(g, this, D);
    // actors
    this.drawActors(g, m, D);
    // sort + draw
    D.sort((a, b) => a.y - b.y);
    for (const d of D) d.f();
    this.drawCount = D.length;
    // over the actors: firedamp haze, a star-shard coming down
    if (g.player.where === 'mine') this.drawHazards(g, true);

    this.ambient.update(dt, g, this);
    this.ambient.draw(ctx, this.time);
    // greenhouse glass roof
    if (m === g.map) this.drawGreenhouseRoof(g);
    if (m === g.map) this.drawTownExtras(g);
    // power wires
    if (m === g.map) this.drawWires(g);
    // the machine contract's glyphs: one mark at each stop's cause (ROADMAP.md 4.3)
    if (m === g.map) drawStateGlyphs(ctx, g, tx0, ty0, tx1, ty1, this.time);
    if (m === g.map) drawDryDrops(ctx, g, tx0, ty0, tx1, ty1, this.time);
    // ui overlays in world space (ghosts, highlights)
    for (const o of this.overlays) o(ctx);
    this.overlays = [];
    // particles
    this.particles.update(dt);
    this.particles.draw(ctx);
    this.juice.update(dt);
    this.juice.drawWorld(ctx);
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
          // Workshop HQ: the wing's workbench and tool wall, the drafting table (2 tiles each)
          case O.WORKBENCH: if (v === 0) name = 'hf:workbench:0:0'; break;
          case O.TOOLWALL: if (v === 0) { name = 'hf:toolwall:0:0'; sy = -5; } break;
          case O.DRAFTING: if (v === 0) name = 'hf:drafting:0:0'; break;
        }
        if (!name) continue;
        const s = sprite(name);
        D.push({ y: sy, f: () => {
          drawSprite(ctx, s, flip ? px + 16 : px, py, 1, flip);
          if (o === O.FIREPLACE && hasImage('hf:fire:0')) {
            drawSprite(ctx, sprite(`hf:fire:${Math.floor(t * 9) % 6}`), px, py);
            if (Math.sin(t * 3.1) > 0.97) { ctx.fillStyle = PALETTE[C.butter]; ctx.fillRect(px + 15 + Math.round(Math.sin(t * 40) * 3), Math.round(py - ((t * 20) % 4)), 1, 1); }
          } else if (o === O.FIREPLACE) {
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
            // pendulum: imported frames 0 center, 1 right, 2 center, 3 left
            const sw = Math.sin(t * 3);
            if (hasImage('hf:pendulum:0')) drawSprite(ctx, sprite(`hf:pendulum:${sw > 0.5 ? 1 : sw < -0.5 ? 3 : 0}`), px, py);
            else {
              ctx.fillStyle = PALETTE[C.brass];
              ctx.fillRect(Math.round(cx - 0.5 + sw * 1.5), py + 3, 2, 2);
            }
          } else if (o === O.STOVE && g.flags.has('home_kitchen')) {
            if (hasImage('hf:steam:0')) {
              ctx.globalAlpha = 0.6;
              drawSprite(ctx, sprite(`hf:steam:${Math.floor(t * 5) % 4}`), px + 12, py - 3);
              ctx.globalAlpha = 1;
            } else if (Math.sin(t * 2 + 1) > 0.3) { ctx.fillStyle = rgba(C.cream, 0.5); ctx.fillRect(px + 9 + Math.sin(t * 4) * 1.5, py - 6 - ((t * 6) % 5), 2, 1); }
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
        if (d.id === 'f_tank' && hasImage('hf:fish:0:0')) {
          // three fish drifting about the imported tank's water (px+2..29, py-12..-2)
          for (let k = 0; k < 3; k++) {
            const a = t * (0.5 + k * 0.2) + k * 2;
            const fx = px + 5 + ((Math.sin(a) + 1) / 2) * 21, fy = py - 9 + k * 2 + Math.sin(t * 1.3 + k) * 1.2;
            drawSprite(ctx, sprite(`hf:fish:${k}:${Math.floor(t * 4 + k) % 2}`), Math.round(fx), Math.round(fy), 1, Math.cos(a) < 0);
          }
          if (Math.sin(t * 2.2) > 0.6) { ctx.fillStyle = PALETTE[C.frost]; ctx.fillRect(px + 22, py - 4 - Math.floor((t * 6) % 6), 1, 1); }
        } else if (d.id === 'f_gilded_clock' && hasImage('hf:gpend:0')) {
          const sw = Math.sin(t * 2.4);
          drawSprite(ctx, sprite(`hf:gpend:${sw > 0.5 ? 1 : sw < -0.5 ? 3 : 0}`), px, py);
        } else if (d.id === 'f_tank') {
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
    const baked = this.soilBaked();
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
        if (!baked) {
          const sp = sprite(`soil:${s.water ? 1 : 0}:${mask}`);
          ctx.drawImage(sp.img, sp.x, sp.y, 16, 16, x * TILE, y * TILE, 16, 16);
        }
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
          const ripe = c.ready && !c.dead;
          D.push({ y: y + 0.6, f: () => {
            // a ripe crop twinkles about every 2 s, staggered per tile, drawn over the plant, and
            // gives a one-pixel "pick me" hop as it does; planted/watered crops hop too
            const k = ripe ? Math.floor((((this.time * 0.5 + hash2(x, y, 23)) % 1) * 12)) : 9;
            drawSprite(ctx, cs, x * TILE, y * TILE + (this.juice.tileHopOf(i) || (k === 1 ? -1 : 0)));
            if (!ripe) return;
            if (k > 2) return;
            const tx = x * TILE + 3 + Math.floor(hash2(x, y, 29) * 10), ty = y * TILE - 6 + Math.floor(hash2(x, y, 31) * 8);
            if (hasImage('fx:twinkle:0')) drawSprite(ctx, sprite(`fx:twinkle:${k}`), tx, ty);
            else {
              ctx.fillStyle = PALETTE[C.cream];
              ctx.fillRect(tx, ty, 1, 1);
            }
          } });
        }
      }
  }

  private drawStructs(g: Game, ents: Ents, tx0: number, ty0: number, tx1: number, ty1: number, D: Drawable[]) {
    const ctx = this.ctx;
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
          // tread phase: 16 one-pixel steps with imported belts (locked to item speed), else 4
          const fine = hasImage(`belt:${tier}:0:0:15`);
          // a Blocked belt stops its chevrons (a queue in front of a busy machine keeps rolling)
          const bf = e.state === MState.Blocked || e.st.rust ? 0 : fine ? Math.floor(this.time * b.speed * 16) % 16 : Math.floor(this.time * b.speed * 4) % 4;
          const uf = fine && !hasImage(`ug:${tier}:0:0:15`) ? bf >> 2 : bf;
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
            const sp = sprite(`ug:${tier}:${e.rot}:${b.kind === BeltKind.UnderIn ? 1 : 0}:${uf}`);
            drawSprite(ctx, sp, e.x * TILE, e.y * TILE);
          } else {
            const name = `belt:${tier}:${e.rot}:${b.curve}:${bf}`;
            drawSprite(ctx, sprite(e.st.rust ? rusty(name) : name), e.x * TILE, e.y * TILE);
            this.drawRustFade(e, name, e.x * TILE, e.y * TILE);
          }
          this.collectBeltItems(e, beltItems, pos);
          continue;
        }
        if (e.arm) {
          D.push({ y: e.y + 0.5, f: () => this.drawArm(g, e) });
          continue;
        }
        if (d.kind === 'path') continue;
        // the Field Works: rails lie flat; the gantry's bridge rides them (src/render/fieldworks.ts)
        if (d.kind === 'rail') {
          drawRail(ctx, e);
          continue;
        }
        if (d.kind === 'gantry') {
          pushGantry(g, e, D, ctx, this.time);
          continue;
        }
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
        // buildings (coops, barns…) light their windows at night like the town's houses
        const on = e.working || (d.kind === 'lamp' && g.daylight < 0.6) || (d.kind === 'generator' && (e.gen?.out ?? 0) > 0) || (d.kind === 'hive' && e.st.bots > 0) ||
          (d.kind === 'building' && g.daylight < 0.55);
        const animated = on && (e.mach || d.kind === 'generator' || d.kind === 'drill' || d.kind === 'harvester' || d.kind === 'planter' || d.kind === 'beehouse' || d.kind === 'gleaner' ||
          d.kind === 'lamp' || d.kind === 'hive' || d.kind === 'sprinkler' || d.kind === 'lab');
        // on a short grid machines animate slower (ROADMAP.md 4.7)
        const f = d.id === 'waterwheel' ? Math.floor(this.time * 6) % 4 : animated ? (d.powerUse && e.sat < 0.99 ? Math.floor(this.time * 8 * Math.max(0.15, e.sat) + e.id) % 4 : frame) : 0;
        const sname = e.st.rust ? `st:${d.id}:0:0:${season}` : `st:${d.id}:${f}:${on ? 1 : 0}:${season}`;
        const s = sprite(e.st.rust ? rusty(sname) : sname);
        if (d.kind === 'fence' || d.kind === 'gate') {
          D.push({ y: e.y + 0.7, f: () => drawSprite(ctx, s, e.x * TILE, e.y * TILE) });
          continue;
        }
        const shadowW = d.kind === 'decor' || d.kind === 'lamp' ? 10 : Math.round(e.w * TILE * 0.8);
        const hit = g.sys.structShake?.get(e.id) ?? 0;
        D.push({ y: e.y + e.h - 0.02, f: () => {
          drawSprite(ctx, sprite(`shadow:${shadowW}`), e.x * TILE + e.w * 8, (e.y + e.h) * TILE - 2);
          drawSprite(ctx, s, e.x * TILE + (hit && this.shakeOn ? wobbleOffset(hit, this.time) : 0), e.y * TILE + this.juice.hopOf(e.id));
          this.drawRustFade(e, sname, e.x * TILE, e.y * TILE + this.juice.hopOf(e.id));
          if (e.st.rust) this.drawRustBadge(e);
          // imported windmill art animates its own sails
          if (d.id === 'windmill' && !hasImage(`st:windmill:${f}:${on ? 1 : 0}:${season}`)) this.drawWindmillBlades(g, e);
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
          // up close, a working machine shows a brass ring (inside its own footprint, so it never
          // covers the arm or belt next to it) that fills as the batch cooks; from afar, the pip
          const close = e.mach?.crafting && Math.hypot(e.x + e.w / 2 - g.player.x, e.y + e.h / 2 - g.player.y) < 4.5;
          if (close) drawFx(ctx, 'fx:ring', Math.min(8, Math.floor(e.mach!.progress * 9)), e.x * TILE + e.w * 8, (e.y + e.h) * TILE - 7 + this.juice.hopOf(e.id));
          else if (e.mach && e.mach.crafting) this.drawProgressPip(e, e.mach.progress);
          if (e.mach || d.kind === 'lab') this.drawStatusLamp(e);
          if (e.def.kind === 'decor' && e.def.id === 'sign' && e.st.k !== null && e.st.k !== undefined) {
            drawItemIcon(ctx, itemIdCache(e.st.k), e.x * TILE + 3, e.y * TILE - 3, 10);
          }
        } });
        // chimney smoke: imported machines list their chimney mouths (factory sheet meta.smoke)
        const chim = smokePoints();
        if (on && chim) {
          const pt = chim[d.id];
          if (pt && Math.random() < dt60(this) * 0.08) this.particles.smoke(e.x * TILE + pt[0], e.y * TILE + pt[1]);
        } else if (on && EXTRA_TOP[d.id] >= 8 && (e.mach?.station === 'smelter' || e.def.fuel || d.id === 'steam_engine' || d.id === 'kitchen' || d.id === 'bottler' || d.kind === 'drill' || d.id === 'steam_loom')) {
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

  /**
   * A clockwork arm (ROADMAP.md 4.11: at rest a wound spring, not a question mark). The parts are
   * art/factory/gen/arms.mjs: the turntable `armb:<id>` (its top the mainspring barrel, the arbor at
   * (8, 8)), the claw `armh:<id>:<0 open|1 closed>:<0 N|1 E|2 S|3 W>`, the spring arm's winding key
   * `armh:key:<f>[:<1|3>]` and the powered arms' motor coil `armh:coil:<f>`, both on the shoulder
   * turret away from the claw, so the arm never hides them (kd below). The two segments are drawn
   * here: chunky capsules with a plum rim, lit from the upper left.
   * Pose, in tile pixels on the ground plane (gx, gy) with height z, drawn at (gx, gy - z): the
   * claw sits folded low on the base's pick-side rim at t 0 (the rest pose), lifts and swings round
   * the swing side, and sets down on the drop-side rim at t 1. The Reaching Arm lies out over the
   * tile between instead.
   */
  drawArm(g: Game, e: Ent) {
    const ctx = this.ctx;
    const a = e.arm!;
    const id = e.def.id;
    const rust = !!e.st.rust;
    const rs = (n: string) => (rust ? rusty(n) : n);
    const x0 = e.x * TILE, y0 = e.y * TILE;
    const art = hasImage(`armh:${id}:0:1`);
    // a seized arm slumped a moment into its swing: askew, its claw down on the ground
    const t = rust ? 0.2 : a.t;
    const k = t - Math.sin(2 * Math.PI * t) / (2 * Math.PI);
    const lift = rust ? 0 : Math.sin(Math.PI * t);
    const ang = Math.atan2(-DY[e.rot], -DX[e.rot]) + (e.rot % 2 === 0 ? 1 : -1) * Math.PI * k;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rEnd = a.reach > 1 ? a.reach * TILE - 10.5 : 9, rMid = a.reach > 1 ? 6 : 4.5;
    const r = rEnd + (rMid - rEnd) * lift;
    const ZS = 3, ZE = 1.5;
    const zh = rust ? 0.5 : ZE + 7 * lift;
    const wgx = 8 + ca * r, wgy = 8 + sa * r;
    const sx = x0 + 8, sy = y0 + 8 - ZS;
    const wx = x0 + wgx, wy = y0 + wgy - zh;
    // the elbow halfway out, raised as two rigid segments would when the claw comes in (the
    // Reaching Arm telescopes past 4 px rather than folding up over its own claw)
    const half = Math.hypot(rEnd, ZS - ZE) / 2, d = Math.hypot(r, zh - ZS) / 2;
    const ez = ZS + (zh - ZS) / 2 + 1.5 + Math.min(4, Math.sqrt(Math.max(0, half * half - d * d)));
    const ex = x0 + 8 + ca * r * 0.5, ey = y0 + 8 + sa * r * 0.5 - ez;
    const dir = (((Math.round(ang / (Math.PI / 2)) + 1) % 4) + 4) % 4;
    // segment ramps (dark, base, light; Resurrect 64 indices): light oak, brass, rose, purple, blue
    const segRamp: Record<string, number[]> = {
      arm_basic: [21, 22, 23], arm_fast: [21, 17, 18], arm_long: [55, 56, 57], arm_filter: [50, 51, 52], arm_bulk: [46, 47, 48],
    };
    const ramp = rust ? [19, 20, 3] : segRamp[id] ?? segRamp.arm_basic;
    /** a capsule from (x1,y1) to (x2,y2): plum rim, then a 3-tone body lit from the upper left */
    const seg = (x1: number, y1: number, x2: number, y2: number, w: number) => {
      const rr = w / 2, dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-6, l = Math.sqrt(l2);
      let nx = -dy / l, ny = dx / l;
      if (nx + ny < 0) { nx = -nx; ny = -ny; }
      const bx0 = Math.floor(Math.min(x1, x2) - rr - 1.5), bx1 = Math.ceil(Math.max(x1, x2) + rr + 1.5);
      const by0 = Math.floor(Math.min(y1, y2) - rr - 1.5), by1 = Math.ceil(Math.max(y1, y2) + rr + 1.5);
      const tone: number[][] = [[], [], [], []];
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
        const qx = px - (x1 + dx * u), qy = py - (y1 + dy * u);
        const dd = Math.hypot(qx, qy);
        if (dd > rr + 1) continue;
        const side = qx * nx + qy * ny;
        tone[dd > rr ? 0 : side < -rr / 3 ? 3 : side > rr / 3 ? 1 : 2].push(x, y);
      }
      const cols = [C.ink, ramp[0], ramp[1], ramp[2]];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = PALETTE[cols[i]];
        const L = tone[i];
        for (let j = 0; j < L.length; j += 2) ctx.fillRect(L[j], L[j + 1], 1, 1);
      }
    };
    /** a 2x2 brass pin, lit top-left */
    const pin = (px: number, py: number) => {
      const x = Math.round(px) - 1, y = Math.round(py) - 1;
      const c = rust ? [21, 20, 20, 19] : [28, 18, 17, 21];
      ctx.fillStyle = PALETTE[C.ink];
      ctx.fillRect(x - 1, y, 4, 2);
      ctx.fillRect(x, y - 1, 2, 4);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j], n) => { ctx.fillStyle = PALETTE[c[n]]; ctx.fillRect(x + i, y + j, 1, 1); });
    };
    // the winding key (spring arms) or the motor coil (powered arms), always clear of the arm: a
    // north/south arm keeps it on the side away from its swing; an east/west arm carries it round
    // on the turret's back (side-on, face-on mid-swing, the other side). kd: 0 N, 1 E, 2 S, 3 W
    const kd = e.rot % 2 === 0 ? (e.rot === 0 ? 1 : 3) : (dir + 2) % 4;
    const keyBehind = kd === 0;
    const drawKey = () => {
      const kx = x0 + [8, 9, 8, 7][kd], ky = y0 + [5.5, 8, 10.5, 8][kd] - ZS - 1;
      if (!art) {
        // procedural fallback: the old tiny key
        ctx.fillStyle = PALETTE[C.ink];
        ctx.fillRect(kx - 2, ky - 4, 5, 5);
        ctx.fillStyle = PALETTE[C.brass];
        if (e.st.wind > 0 && Math.floor(this.time * 12) % 2) ctx.fillRect(kx - 1, ky - 2, 3, 1);
        else ctx.fillRect(kx, ky - 3, 1, 3);
        return;
      }
      if (!a.powered) {
        // turning while wound (the winding verb, ROADMAP.md 4.4); a seized arm's key hangs askew
        const f = rust ? 1 : e.st.wind > 0 ? Math.floor(this.time * 8) % 4 : 0;
        drawSprite(ctx, sprite(rs(kd % 2 ? `armh:key:${f}:${kd}` : `armh:key:${f}`)), kx, Math.round(ky));
      } else {
        const on = !rust && !e.off && e.working && e.sat > 0.001;
        drawSprite(ctx, sprite(rs(`armh:coil:${on ? 1 + (Math.floor(this.time * 10) % 3) : 0}`)), kx + (kd === 1 ? 3 : kd === 3 ? -3 : 0), Math.round(ky));
      }
    };
    const drawFore = () => {
      seg(ex, ey, wx, wy, 2);
      pin(ex, ey);
      const claw = `armh:${id}:${a.held ? 1 : 0}:${dir}`;
      if (art) drawSprite(ctx, sprite(rs(claw)), Math.round(wx), Math.round(wy));
      else {
        ctx.fillStyle = PALETTE[C.slate];
        ctx.fillRect(Math.round(wx) - 2, Math.round(wy) - 1, 4, 2);
      }
      if (a.held) {
        // the goods between the jaws
        const o = [[0, -3], [3, 0], [0, 3], [-3, 0]][dir];
        drawItemIcon(ctx, itemIdCache(a.held.k), Math.round(wx + o[0]) - 5, Math.round(wy + o[1]) - 6, 10);
      }
    };
    // ground shadows: under the turntable, and under the claw while it is up
    drawSprite(ctx, sprite('shadow:13'), x0 + 8, y0 + 14);
    if (zh > 3.5) drawSprite(ctx, sprite('shadow:6'), Math.round(x0 + wgx), Math.round(y0 + wgy));
    drawSprite(ctx, sprite(rs(`armb:${id}`)), x0, y0);
    this.drawRustFade(e, `armb:${id}`, x0, y0);
    // back to front: what sits north of the arbor first
    const clawBehind = wgy < 8;
    if (keyBehind) drawKey();
    if (clawBehind) drawFore();
    seg(sx, sy, ex, ey, 3);
    pin(sx, sy);
    if (!keyBehind) drawKey();
    if (!clawBehind) drawFore();
    if (rust) this.drawRustBadge(e);
  }

  /** a rusted machine wears a small broken cog at its top corner: it needs restoring (F) */
  private drawRustBadge(e: Ent) {
    const ctx = this.ctx;
    const x = (e.x + e.w) * TILE - 7, y = e.y * TILE - 2;
    const cog = ['.X.X.', 'XXXXX', 'XX.XX', 'XXXXX', '.X.X.'];
    ctx.fillStyle = PALETTE[C.ink];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (cog[r][c] === 'X') ctx.fillRect(x + c - 1, y + r, 3, 1), ctx.fillRect(x + c, y + r - 1, 1, 3);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (cog[r][c] === 'X') {
      ctx.fillStyle = PALETTE[(r + c) % 4 === 0 ? C.copper : C.rust];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
    // the crack
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x + 3, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + 3, 1, 1);
  }

  /** just restored: the rusted sprite fades off the working one over RESTORE_FADE seconds */
  private drawRustFade(e: Ent, name: string, x: number, y: number) {
    const t0 = this.restored.get(e.id);
    if (t0 === undefined) return;
    const k = (this.time - t0) / RESTORE_FADE;
    if (k >= 1 || k < 0) {
      this.restored.delete(e.id);
      return;
    }
    this.ctx.globalAlpha = 1 - k;
    drawSprite(this.ctx, sprite(rusty(name)), x, y);
    this.ctx.globalAlpha = 1;
  }

  private drawNoPower(e: Ent) {
    const ctx = this.ctx;
    if (Math.floor(this.time * 2) % 2) return;
    const x = e.x * TILE + e.w * 8 - 4, y = e.y * TILE - 8;
    if (hasImage('fx:nopower')) {
      drawSprite(ctx, sprite('fx:nopower'), x, y);
      return;
    }
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x - 1, y - 1, 9, 9);
    ctx.fillStyle = PALETTE[C.amber];
    ctx.fillRect(x, y, 7, 7);
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x + 3, y + 1, 1, 3);
    ctx.fillRect(x + 2, y + 3, 3, 1);
    ctx.fillRect(x + 3, y + 5, 1, 1);
  }

  /** a little lamp on every machine: green working, amber waiting for input, red blocked (blinking) */
  private drawStatusLamp(e: Ent) {
    const st = machineState(e);
    if (!st) return;
    const ctx = this.ctx;
    const x = (e.x + e.w) * TILE - 5, y = e.y * TILE + 2 + this.juice.hopOf(e.id);
    ctx.fillStyle = PALETTE[C.ink];
    ctx.fillRect(x - 1, y - 1, 4, 4);
    const off = st !== 'ok' && Math.floor(this.time * 2.5) % 2 === 1;
    ctx.fillStyle = PALETTE[off ? C.bark : PULSE_COL[st]];
    ctx.fillRect(x, y, 2, 2);
    if (!off) {
      ctx.fillStyle = PALETTE[C.cream];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawProgressPip(e: Ent, p: number) {
    const ctx = this.ctx;
    const w = Math.min(12, e.w * TILE - 4);
    const x = e.x * TILE + (e.w * TILE - w) / 2, y = e.y * TILE + e.h * TILE - 3;
    if (w === 12 && hasImage('fx:pipframe')) {
      // imported trough (12 px track) filled with the 1x1 fill color, whole pixels
      drawSprite(ctx, sprite('fx:pipframe'), x, y);
      const f = sprite('fx:pipfill'), n = Math.round(w * Math.min(1, p));
      if (n > 0) ctx.drawImage(f.img, f.x, f.y, 1, 1, x, y + 1, n, 1);
      return;
    }
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
      if (unread > 0 && hasImage('fx:letter')) {
        drawSprite(ctx, sprite('fx:mailflag'), mx * TILE + 11, my * TILE - 6);
        drawSprite(ctx, sprite('fx:letter'), mx * TILE + 3, Math.round(my * TILE - 15 + Math.sin(this.time * 3) * 2));
      } else if (unread > 0) {
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
            const pn = `fx:pennant:${i % cols.length}`;
            if (hasImage(pn)) {
              drawSprite(ctx, sprite(pn), Math.round(x), Math.round(y));
              continue;
            }
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
    // imported glass: gh:glass:<0 broken|1 intact>, a 16x16 pane with its mullions, tiled
    if (hasImage('gh:glass:1')) {
      // repaired: glass panes, see-through. Derelict: a faint broken frame with whole panes
      // missing, so the beds under it read as open, farmable ground (it is a seasonal plot)
      ctx.globalAlpha = inside ? 0.12 : fixed ? 0.4 : 0.3;
      for (let y = 0; y < h; y += 16)
        for (let x = 0; x < w; x += 16) {
          if (!fixed && hash2(x / 16, y / 16, 11) < 0.45) continue;
          const s = sprite(`gh:glass:${fixed ? 1 : 0}`);
          ctx.drawImage(s.img, s.x, s.y, Math.min(16, w - x), Math.min(16, h - y), x0 + x, y0 + y, Math.min(16, w - x), Math.min(16, h - y));
        }
      ctx.globalAlpha = 1;
      return;
    }
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

  /**
   * The Deepworks' hazards (src/sim/systems/mine.ts). Under the actors: the cracks of a loose
   * ceiling (grit trickles once it rumbles), the stain of a firedamp pocket and the ringed marks
   * where star-shards land. Over them: firedamp (a faint haze while quiet, puffs that build as it
   * hisses, a green plume while it vents) and a shard on its way down.
   */
  private drawHazards(g: Game, over: boolean) {
    const st = g.sys.mine as MineState | undefined;
    if (!st?.map || !st.hazards.length) return;
    const ctx = this.ctx, t = this.time, v = this.view;
    const px1 = (c: number, x: number, y: number) => { ctx.fillStyle = PALETTE[c]; ctx.fillRect(x, y, 1, 1); };
    const ring = (cx: number, cy: number, r: number, c: number) => ctx.drawImage(ringImg(r, c), cx - r, cy - r);
    for (const h of st.hazards) {
      const px = h.x * TILE, py = h.y * TILE;
      if (px < v.x0 - 32 || px > v.x1 + 32 || py < v.y0 - 80 || py > v.y1 + 32) continue;
      const hh = hash2(h.x, h.y, 61);
      if (h.kind === 'crack' && !over) {
        // the shadow of the loose slab above, a jagged crack across the floor (lit on its far edge, so
        // it reads on the veined Earth floor) with a branch off it, and grit already fallen
        ctx.fillStyle = rgba(C.ink, 0.3);
        ctx.fillRect(px + 1, py + 1, 14, 14);
        let x = 3 + Math.floor(hh * 9);
        for (let y = 1; y < 15; y++) {
          px1(C.ink, px + x, py + y);
          if (x < 14) px1(C.tan, px + x + 1, py + y);
          if (y === 7) for (let k = 1; k < 5; k++) { px1(C.ink, px + Math.min(14, x + k), py + y + (k >> 1)); px1(C.tan, px + Math.min(14, x + k), py + y + 1 + (k >> 1)); }
          x = Math.max(1, Math.min(14, x + Math.floor(hash2(h.x * 16 + y, h.y, 62) * 3) - 1));
        }
        px1(C.pebble, px + 2 + Math.floor(hh * 11), py + 12);
        px1(C.stone, px + 3 + Math.floor(hh * 9), py + 13);
        px1(C.pebble, px + 12 - Math.floor(hh * 8), py + 3);
        if (h.state === 4) {
          // propped: two timber posts and a cap beam over the crack
          ctx.fillStyle = PALETTE[C.walnut];
          ctx.fillRect(px + 2, py - 10, 2, 22);
          ctx.fillRect(px + 12, py - 10, 2, 22);
          ctx.fillRect(px + 1, py - 12, 14, 3);
          ctx.fillStyle = PALETTE[C.oak];
          ctx.fillRect(px + 2, py - 10, 1, 22);
          ctx.fillRect(px + 12, py - 10, 1, 22);
          ctx.fillRect(px + 1, py - 12, 14, 1);
        }
        if (h.state === 1) {
          // grit trickling down before the slab goes
          for (let k = 0; k < 3; k++) {
            const f = (t * 2.2 + k * 0.37 + hh) % 1;
            ctx.fillStyle = PALETTE[k % 2 ? C.stone : C.pebble];
            ctx.fillRect(px + 3 + k * 5, Math.round(py - 22 + f * 30), k === 1 ? 2 : 1, k === 1 ? 2 : 1);
          }
        }
      } else if (h.kind === 'shard') {
        const cx = px + 8, cy = py + 9;
        if (!over) {
          // a star-shaped scorch that glows, brighter while a shard is coming. Starfall's floor
          // glitters gold, so the mark sits on a dark disc inside a butter ring with a dark ring
          // either side; the ring grows as the shard nears and blinks just before it lands
          const hot = h.state === 1;
          const near = hot ? Math.max(0, Math.min(1, 1 - h.t / 1.2)) : 0;
          const pulse = hot ? Math.floor(t * 12) % 2 : Math.sin(t * 3 + hh * 6) > 0.2 ? 1 : 0;
          const r = hot ? 5 : 3 + pulse;
          const rr = hot ? 6 + Math.round(near * 3) : 6 + (Math.sin(t * 2.4 + hh * 6) > 0.5 ? 1 : 0);
          ctx.fillStyle = rgba(C.ink, hot ? 0.5 : 0.38);
          for (let dy = -(rr - 1); dy <= rr - 1; dy++) {
            const w = Math.floor(Math.sqrt((rr - 1) ** 2 - dy * dy));
            ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
          }
          ctx.fillStyle = PALETTE[C.bark];
          ctx.fillRect(cx - 3, cy - 1, 7, 3);
          ctx.fillRect(cx - 1, cy - 3, 3, 7);
          ctx.fillStyle = PALETTE[hot ? C.gold : C.amber];
          ctx.fillRect(cx - r, cy, r * 2 + 1, 1);
          ctx.fillRect(cx, cy - r + 1, 1, r * 2 - 1);
          if (hot || pulse) px1(C.cream, cx, cy);
          ring(cx, cy, rr + 1, C.ink);
          ring(cx, cy, rr - 1, C.ink);
          ring(cx, cy, rr, hot && pulse ? C.cream : C.butter);
        } else if (h.state === 1) {
          // the shard streaks down onto its mark
          const p = Math.max(0, Math.min(1, 1 - h.t / 1.2));
          const sy = Math.round(cy - (1 - p * p) * 72);
          ctx.fillStyle = rgba(C.gold, 0.5);
          ctx.fillRect(cx - 1, sy - 12, 1, 10);
          ctx.fillStyle = PALETTE[C.cream];
          ctx.fillRect(cx - 1, sy - 3, 3, 4);
          ctx.fillStyle = PALETTE[C.gold];
          ctx.fillRect(cx, sy - 4, 1, 6);
        }
      } else if (h.kind === 'gas' && !over) {
        // the pocket's stain on the floor, so you can see where it lies while it's quiet
        const build = h.state === 1 ? 1 - h.t / VENT_TELL : 0;
        ctx.fillStyle = rgba(C.lime, h.state === 3 ? 0.2 : 0.08 + build * 0.1);
        ctx.fillRect(px + 2, py + 1, 12, 14);
        ctx.fillRect(px + 1, py + 2, 14, 12);
      } else if (h.kind === 'gas' && h.state === 3) {
        // venting: a green plume boiling up out of the floor, two tiles high, over a bright jet at
        // its mouth (it fades in and out)
        const q = 1 - h.t / VENT_ON, fade = Math.max(0, Math.min(1, q * 8, (1 - q) * 5));
        for (let k = 0; k < 6; k++) {
          const f = (t * 1.4 + k / 6 + hh) % 1, s = Math.round(4 + f * 8);
          const bx = Math.round(px + 8 + Math.sin(t * 3 + k * 1.9 + h.x) * (1 + f * 3) - s / 2), by = Math.round(py + 12 - f * 34 - s / 2);
          ctx.fillStyle = rgba(k % 2 ? C.leaf : C.lime, (0.8 - f * 0.6) * fade);
          ctx.fillRect(bx + 1, by, s - 2, s);
          ctx.fillRect(bx, by + 1, s, s - 2);
        }
        const jet = Math.floor(t * 14 + hh * 7) % 2;
        ctx.fillStyle = rgba(C.lime, 0.9 * fade);
        ctx.fillRect(px + 5, py + 10, 6, 3);
        ctx.fillRect(px + 6, py + 5 - jet, 4, 5 + jet);
        ctx.fillStyle = rgba(C.cream, 0.7 * fade);
        ctx.fillRect(px + 7, py + 7 - jet, 2, 5);
      } else if (h.kind === 'gas') {
        // quiet, a faint haze drifting over the pocket; hissing (the tell), it thickens and puffs
        // bubble up off the floor, quicker as the vent nears
        const build = h.state === 1 ? 1 - h.t / VENT_TELL : 0;
        for (let k = 0; k < 3; k++) {
          const ox = Math.round(Math.sin(t * 0.7 + k * 2.1 + h.x) * 3), oy = Math.round(Math.cos(t * 0.5 + k * 1.7 + h.y) * 2);
          ctx.fillStyle = rgba(k === 1 ? C.leaf : C.lime, 0.14 + build * 0.2);
          const bx = px + 1 + k * 4 + ox, by = py + 2 + (k % 2) * 5 + oy;
          ctx.fillRect(bx + 1, by, 6, 6);
          ctx.fillRect(bx, by + 1, 8, 4);
        }
        if (h.state === 1)
          for (let k = 0; k < 3; k++) {
            const f = (t * (1.5 + build * 2.5) + k / 3 + hh) % 1, s = 2 + Math.round(build * 2);
            ctx.fillStyle = rgba(C.lime, 0.6 - f * 0.45);
            ctx.fillRect(Math.round(px + 3 + k * 4 + Math.sin(t * 11 + k) * build), Math.round(py + 12 - f * (5 + build * 9)), s, s);
          }
      }
    }
  }

  private drawActors(g: Game, m: TileMap, D: Drawable[]) {
    const ctx = this.ctx;
    const v = this.view;
    const onScreen = (x: number, y: number) => x * TILE > v.x0 - 32 && x * TILE < v.x1 + 32 && y * TILE > v.y0 - 32 && y * TILE < v.y1 + 48;
    // player
    const p = g.player;
    // frames: 0-3 walk, 4-5 tool use, 6 standing (procedural sprites draw 6 like 0), 7-8 a tool
    // swing an imported sheet draws with the tool in hand (no rotated icon then)
    const early = !!p.anim && p.anim.t < p.anim.dur * 0.45;
    const toolFrame = p.anim ? sheetToolFrame('player', p.anim.kind, early ? 0 : 1) : null;
    const sheetTool = !!toolFrame;
    const pf: number | string = p.anim ? toolFrame ?? (early ? 4 : 5) : p.moving ? Math.floor(p.walkT * 1.6) % 4 : 6;
    const pfOld = typeof pf === 'string' ? (early ? 4 : 5) : pf;
    D.push({ y: p.y, f: () => {
      const sh = sprite('shadow:12');
      drawSprite(ctx, sh, p.x * TILE, p.y * TILE);
      if (p.invuln > 0 && Math.floor(this.time * 20) % 2) return;
      const s = sprite(`ch:player:${p.dir}:${pf}`);
      drawSprite(ctx, s, p.x * TILE, p.y * TILE, 1, p.dir === 3);
      // held tool / item during animations
      if (p.anim) {
        if (!sheetTool) this.drawToolSwing(g);
      }
      else {
        const held = p.inv.slots[p.sel];
        const hd = held ? ITEMS[held.k >> 2] : null;
        if (held && hd && !hd.tool && !hd.weapon && !hd.places && hd.cat !== 'seed' && hd.cat !== 'fertilizer' && !g.player.moving) {
          drawItemIcon(ctx, itemIdCache(held.k), Math.round(p.x * TILE - 5), Math.round(p.y * TILE - charArtHeight('player') - 12), 10);
        }
      }
    } });
    if (this.compareArt) {
      const tx = p.x - 1.5;
      D.push({ y: p.y, f: () => {
        drawSprite(ctx, sprite('shadow:12'), tx * TILE, p.y * TILE);
        drawSprite(ctx, sprite(`ch:player:${p.dir}:${pfOld}:old`), tx * TILE, p.y * TILE, 1, p.dir === 3);
      } });
      // candidate sheets (art-director imports) in a row to the right, same look and frame
      const look = getLook('player');
      compareIds().forEach((id, i) => {
        if (look && getLook(id) !== look) { registerLook(id, look); invalidateSpritePrefix(`ch:${id}:`); }
        const cx = p.x + 1.5 * (i + 1);
        D.push({ y: p.y, f: () => {
          drawSprite(ctx, sprite('shadow:12'), cx * TILE, p.y * TILE);
          drawSprite(ctx, sprite(`ch:${id}:${p.dir}:${pf}`), cx * TILE, p.y * TILE, 1, p.dir === 3);
        } });
      });
    }
    // npcs
    const npcs: any[] = m === g.map ? g.sys.npcs?.list ?? [] : [];
    for (const n of npcs) {
      if (!n.visible || !onScreen(n.x, n.y)) continue;
      const f = n.moving ? Math.floor(n.walkT * 1.6) % 4 : this.npcStandFrame(g, n);
      D.push({ y: n.y, f: () => {
        drawSprite(ctx, sprite('shadow:12'), n.x * TILE, n.y * TILE);
        drawSprite(ctx, sprite(`ch:${n.id}:${n.dir}:${f}`), n.x * TILE, n.y * TILE, 1, n.dir === 3);
        if (n.emote) this.drawEmote(n.x, n.y - (charArtHeight(n.id) + 8) / TILE, n.emote);
      } });
    }
    // animals
    const animals: any[] = m === g.map ? g.sys.animals?.list ?? [] : [];
    for (const a of animals) {
      if (!a.visible || !onScreen(a.x, a.y)) continue;
      // imported animals have a 4-frame walk (stand, stride, …), the procedural ones 2
      const nf = hasImage(`an:${a.kind}:3:${a.baby ? 1 : 0}`) ? 4 : 2;
      const f = a.moving ? Math.floor(a.walkT * nf) % nf : 0;
      const big = !a.baby && ANIMAL_BY_ID.get(a.kind)?.building === 'barn';
      D.push({ y: a.y, f: () => {
        drawSprite(ctx, sprite(big ? 'shadow:18' : 'shadow:12'), a.x * TILE, a.y * TILE);
        drawSprite(ctx, sprite(`an:${a.kind}:${f}:${a.baby ? 1 : 0}`), a.x * TILE, a.y * TILE, 1, a.dir === 3);
        if (a.emote) this.drawEmote(a.x, a.y - (big ? 1.9 : 1.4), a.emote);
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
      // imported pets: walk cycle 0 1 4 5, sleep breathes 3 ↔ 6
      const full = hasImage(`pet:${pet.kind}:${pet.coat}:5`);
      const walk = full ? [0, 1, 4, 5][Math.floor(pet.walkT * 4.4) % 4] : Math.floor(pet.walkT * 2.2) % 2;
      const pose = pet.mode === 'sleep' ? (full && Math.floor(this.time) % 2 ? 6 : 3) : pet.mode === 'sit' || pet.mode === 'ride' ? 2 : pet.moving ? walk : 0;
      D.push({ y: pet.y, f: () => {
        drawSprite(ctx, sprite('shadow:10'), pet.x * TILE, pet.y * TILE);
        drawSprite(ctx, sprite(`pet:${pet.kind}:${pet.coat}:${pose}`), pet.x * TILE, pet.y * TILE, 1, pet.dir === 3);
        if (pet.emote) this.drawEmote(pet.x, pet.y - (full ? 1.4 : 1.1), pet.emote);
      } });
    }
    // Tock, the Professor's clockwork helper (src/sim/systems/tock.ts): the pets' walk cycle and poses
    const tock = g.sys.tock;
    if (tock?.here && g.player.where === 'world' && onScreen(tock.x, tock.y)) {
      const night = g.time.min >= 22 * 60;
      const pose = tock.moving ? [0, 1, 4, 5][Math.floor(tock.walkT * 4.4) % 4] : tock.mode === 'sit' ? 2 : tock.mode === 'wait' && night ? (Math.floor(this.time) % 2 ? 6 : 3) : 0;
      D.push({ y: tock.y, f: () => {
        drawSprite(ctx, sprite('shadow:10'), tock.x * TILE, tock.y * TILE);
        drawSprite(ctx, sprite(`pet:tock:0:${pose}`), tock.x * TILE, tock.y * TILE, 1, tock.dir === 3);
      } });
    }
    if (pet && pet.stage === 'adopted' && g.player.where === 'world' && onScreen(pet.bowl[0], pet.bowl[1])) {
      const [bx, by] = pet.bowl;
      D.push({ y: by + 0.3, f: () => drawSprite(ctx, sprite(`bowl:${pet.bowlFull ? 1 : 0}`), bx * TILE, by * TILE) });
    }
    // the Deepworks: a works chamber's machines (src/render/art/deep.ts until the art pass)
    const mst = g.player.where === 'mine' ? (g.sys.mine as MineState | undefined) : undefined;
    for (const c of mst?.chambers ?? []) {
      if (!onScreen(c.x + c.w / 2, c.y) && !onScreen(c.x + c.w / 2, c.y - 2)) continue;
      const d = CHAMBER_BY_KIND.get(c.kind);
      const on = !!d?.restore && g.flags.has(d.restore.flag);
      const n = deepFrames(c.kind, on);
      const s = sprite(`deep:${c.kind}:${on ? 1 : 0}:${n > 1 ? Math.floor(this.time * (c.kind === 'star' ? 2 : 3)) % n : 0}`);
      D.push({ y: c.y + 0.95, f: () => drawSprite(ctx, s, c.x * TILE, (c.y + 1) * TILE) });
    }
    // lamps set down on the floor: the farm's lantern post, lit
    const lampF = Math.floor(this.time * 8) % 4;
    for (const [lx, ly] of mst?.lamps ?? []) {
      if (!onScreen(lx + 0.5, ly + 0.5)) continue;
      const s = sprite(`st:lamp:${lampF}:1:0`);
      D.push({ y: ly + 0.98, f: () => {
        drawSprite(ctx, sprite('shadow:10'), lx * TILE + 8, (ly + 1) * TILE - 2);
        drawSprite(ctx, s, lx * TILE, ly * TILE);
      } });
    }
    // the Deepworks' pests
    for (const mo of mst?.monsters ?? []) {
      if (!onScreen(mo.x, mo.y)) continue;
      // a clatter-crab sits tucked into its shell (the imported crab's hidden frame) until it's hit
      const sitting = mo.def.behavior === 'block' && mo.state === 0 && mo.hp === mo.maxHp;
      const f = sitting && hasImage(`mon:${mo.id}:4`) ? 4 : Math.floor(this.time * (mo.state === 2 ? 12 : 6) + mo.phase) % 4;
      D.push({ y: mo.y, f: () => {
        drawSprite(ctx, sprite('shadow:10'), mo.x * TILE, mo.y * TILE);
        if (mo.def.behavior === 'block' && mo.state === 2) ctx.globalAlpha = Math.max(0, Math.min(1, mo.cool));
        else if (mo.hurt > 0) ctx.globalAlpha = 0.5 + Math.sin(this.time * 40) * 0.5;
        drawSprite(ctx, sprite(`mon:${mo.id}:${f}`), mo.x * TILE, mo.y * TILE - (mo.z ?? 0), 1, mo.face < 0);
        ctx.globalAlpha = 1;
        if (mo.hp < mo.maxHp && mo.hp > 0) {
          ctx.fillStyle = PALETTE[C.ink];
          ctx.fillRect(mo.x * TILE - 7, mo.y * TILE - 22, 14, 3);
          ctx.fillStyle = PALETTE[C.amber];
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
        // imported bumblebot: bot:<frame 0-3> (rotor/wing cycle), anchored at its bottom center
        if (hasImage('bot:0')) {
          drawSprite(ctx, sprite('shadow:8'), b.x * TILE, b.y * TILE);
          const last = this.botFace.get(b.id);
          const left = last && Math.abs(b.x - last.x) > 0.001 ? b.x < last.x : last?.left ?? false;
          this.botFace.set(b.id, { x: b.x, left });
          drawSprite(ctx, sprite(`bot:${Math.floor(this.time * 12 + b.id) % 4}`), Math.round(b.x * TILE), Math.round(b.y * TILE - 9 + bob), 1, left);
        } else drawItemIcon(ctx, 'bumblebot', Math.round(b.x * TILE - 8), Math.round(b.y * TILE - 24 + bob), 16);
        if (b.carry) drawItemIcon(ctx, itemIdCache(b.carry.k), Math.round(b.x * TILE - 5), Math.round(b.y * TILE - 12 + bob), 10);
      } });
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

  /**
   * A standing villager's frame: a sheet with greeting frames (g0…) plays them once when a chat
   * starts, one with idle frames (i0…) loops them at a breathing pace; others hold frame 0.
   */
  private npcStandFrame(g: Game, n: { id: string; x: number }): number | string {
    const talking = g.sys.dialogue?.npc === n.id || g.sys.cutscene?.npc === n.id;
    if (!talking) this.greetAt.delete(n.id);
    else if (!this.greetAt.has(n.id)) this.greetAt.set(n.id, this.time);
    const gn = charFrames(n.id, 'g');
    if (gn && talking) {
      const k = Math.floor((this.time - this.greetAt.get(n.id)!) * 6);
      if (k < gn) return 'g' + k;
    }
    const idle = charFrames(n.id, 'i');
    // each villager breathes on its own beat
    return idle ? 'i' + (Math.floor(this.time * 5 + n.x * 3) % idle) : 0;
  }

  private drawEmote(x: number, y: number, e: string) {
    const ctx = this.ctx;
    // imported bubbles: emote:<heart|exclaim|question|note|zzz|smile>, anchored at the tail tip
    const name = 'emote:' + ({ heart: 'heart', '!': 'exclaim', '?': 'question', note: 'note', zzz: 'zzz' }[e] ?? 'smile');
    if (hasImage(name)) {
      drawSprite(ctx, sprite(name), Math.round(x * TILE), Math.round(y * TILE) + 2);
      return;
    }
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
    const x = p.x * TILE + Math.cos(ang) * r, y = p.y * TILE - (charArtHeight('player') + 2) / 2 + Math.sin(ang) * r;
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

/** a one-pixel ring of radius r in a palette colour (the midpoint circle), drawn once and kept */
const RINGS = new Map<number, HTMLCanvasElement>();
function ringImg(r: number, c: number): HTMLCanvasElement {
  const k = r * 64 + c;
  let cv = RINGS.get(k);
  if (!cv) {
    cv = makeCanvas(r * 2 + 1, r * 2 + 1);
    const x2 = ctx2d(cv);
    x2.fillStyle = PALETTE[c];
    for (let x = r, y = 0, e = 1 - r; x >= y; ) {
      for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) x2.fillRect(r + a, r + b, 1, 1);
      y++;
      if (e < 0) e += 2 * y + 1;
      else {
        x--;
        e += 2 * (y - x) + 1;
      }
    }
    RINGS.set(k, cv);
  }
  return cv;
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
