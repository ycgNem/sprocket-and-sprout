// Ground tiles, edge fringes, water foam, tilled soil. All seasonal, all procedural.
import { C } from '../../data/palette';
import { hash2, valueNoise } from '../../engine/rng';
import { defSpriteFamily } from '../atlas';
import { T } from '../../sim/world/tilemap';
import { PixBuf } from './pixbuf';

export const TILE = 16;

/** draw priority for fringe overlap: higher draws over lower */
export const PRIO: Record<number, number> = {
  [T.DEEP]: 0, [T.OCEAN]: 1, [T.RIVER]: 1, [T.LAKE]: 1, [T.POND]: 1, [T.MINEWATER]: 1, [T.LAVA]: 1,
  [T.SAND]: 2, [T.ROCK]: 3, [T.ORE_VEIN]: 3, [T.DIRT]: 4, [T.GARDEN]: 4, [T.MINEFLOOR]: 3,
  [T.PATH]: 5, [T.PLANKS]: 6, [T.GRASS]: 7, [T.TOWNGRASS]: 7, [T.CLIFF]: 8, [T.CLIFFTOP]: 9, [T.MINEWALL]: 9, [T.VOID]: 0,
};

export const FRINGE_SOURCES = new Set([T.GRASS, T.TOWNGRASS, T.SAND, T.DIRT]);

interface GrassPal { base: number; alt: number; dark: number; spark: number[] }
export function grassPal(season: number, town = false): GrassPal {
  switch (season) {
    case 0: return { base: C.grass, alt: C.leaf, dark: C.moss, spark: town ? [C.leaf] : [C.blush, C.butter, C.cream] };
    case 1: return { base: C.grass, alt: C.moss, dark: C.moss, spark: [C.leaf, C.lime] };
    case 2: return { base: C.moss, alt: C.grass, dark: C.pine, spark: [C.apricot, C.terracotta, C.amber] };
    default: return { base: C.cream, alt: C.frost, dark: C.pebble, spark: [C.frost, C.pebble] };
  }
}

const ORE_SPECK = [C.copper, C.pebble, C.stone, C.brass, C.ink, C.lavender, C.pebble, C.terracotta];

/** Resurrect 64's teal ramp (no 1.0 names) for the Crystal stratum */
const TEAL_DK = 39, TEAL = 40, TEAL_LT = 43;
/**
 * Deepworks floors and walls by terrain art class (the stratum's `art` in src/data/deepworks.ts:
 * 0 Earth, 1 Frost, 2 Ember as in 1.1, then 3 Clayworks, 4 Crystal, 5 Starfall): [base, alt, speck]
 * and [base, lit ledge]. The imported sheet recolors its own tiles the same way (`derive`).
 */
const MINE_FLOOR: [number, number, number][] = [
  [C.walnut, C.bark, C.pebble], [C.slate, C.stone, C.frost], [C.wine, C.plum, C.blush],
  [C.tan, C.oak, C.apricot], [TEAL_DK, TEAL, TEAL_LT], [C.bark, C.plum, C.violet],
];
const MINE_WALL: [number, number][] = [
  [C.bark, C.walnut], [C.slate, C.stone], [C.plum, C.wine], [C.berry, C.rust], [C.deepsea, C.dusk], [C.violet, C.lavender],
];

/** Draw a terrain tile into a pixbuf at (ox, oy). */
export function paintTerrain(pb: PixBuf, t: T, season: number, v: number, ox = 0, oy = 0, extra = 0, gx = 0, gy = 0) {
  const seed = v * 97 + t * 13 + season * 7;
  const S = TILE;
  const at = (x: number, y: number) => hash2(x, y, seed);
  /** world-continuous noise helpers */
  const W = (x: number, y: number) => hash2(gx + x, gy + y, 11);
  const W2 = (x: number, y: number) => hash2((gx + x) >> 1, (gy + y) >> 1, 13);
  const blob = (x: number, y: number, sc: number, sd: number) => valueNoise((gx + x) / sc, (gy + y) / sc, sd);
  switch (t) {
    case T.GRASS:
    case T.TOWNGRASS:
    case T.CLIFFTOP: {
      const p = t === T.CLIFFTOP ? (season === 3 ? grassPal(3) : { base: C.moss, alt: C.pine, dark: C.pine, spark: [C.grass] }) : grassPal(season, t === T.TOWNGRASS);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const b = blob(x, y, 30, 5) * 0.75 + blob(x, y, 8, 6) * 0.25;
          const h = W2(x, y);
          let c = p.base;
          const snow = season === 3;
          if (b > (snow ? 0.7 : 0.64)) c = h < (snow ? 0.3 : 0.5) ? p.alt : p.base;
          else if (b < 0.27) c = h < (snow ? 0.12 : 0.3) ? p.dark : p.base;
          else if (h < 0.02) c = p.alt;
          else if (h > 0.988) c = p.dark;
          pb.set(ox + x, oy + y, c);
        }
      // grass blades: little v tufts
      const blades = t === T.TOWNGRASS ? 1 : 3;
      for (let i = 0; i < blades; i++) {
        const bx = Math.floor(W(i, 99) * 13) + 1, by = Math.floor(W(99, i) * 12) + 3;
        pb.set(ox + bx, oy + by, p.dark);
        pb.set(ox + bx - 1, oy + by - 1, p.dark);
        pb.set(ox + bx + 1, oy + by - 1, p.dark);
        pb.set(ox + bx + 1, oy + by - 2, p.alt);
      }
      if (v % 5 === 0 && t !== T.CLIFFTOP) {
        const sx = Math.floor(at(7, 7) * 12) + 2, sy = Math.floor(at(8, 8) * 12) + 2;
        pb.set(ox + sx, oy + sy, p.spark[v % p.spark.length]);
      }
      break;
    }
    case T.DIRT:
    case T.GARDEN: {
      const snow = season === 3 && t === T.DIRT;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const h = W2(x, y);
          const b = blob(x, y, 9, 7);
          let c = t === T.GARDEN ? C.walnut : C.oak;
          if (b < 0.35 && h < 0.6) c = t === T.GARDEN ? C.bark : C.walnut;
          else if (h < 0.08) c = t === T.GARDEN ? C.bark : C.walnut;
          else if (W(x, y) > 0.985) c = C.tan;
          if (snow && blob(x, y, 7, 9) > 0.38) c = W2(x, y) < 0.08 ? C.frost : C.cream;
          pb.set(ox + x, oy + y, c);
        }
      if (t === T.GARDEN) for (let x = 0; x < S; x++) pb.set(ox + x, oy + 7, C.bark);
      break;
    }
    case T.SAND:
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const h = W2(x, y);
          const b = blob(x, y, 12, 8);
          pb.set(ox + x, oy + y, (b < 0.22 && h < 0.4) || h < 0.03 ? C.tan : W(x, y) > 0.985 ? C.cream : C.butter);
        }
      if (v % 3 === 0) {
        const sx = Math.floor(at(3, 3) * 12) + 2, sy = Math.floor(at(4, 4) * 12) + 2;
        pb.set(ox + sx, oy + sy, C.tan);
        pb.set(ox + sx + 1, oy + sy, C.tan);
      }
      break;
    case T.PATH: {
      // cobblestones
      pb.rect(ox, oy, S, S, C.slate);
      const rows = [0, 5, 10];
      for (let r = 0; r < 3; r++) {
        const y0 = rows[r];
        const off = (r + v) % 2 ? 3 : 0;
        for (let x0 = -off; x0 < S; x0 += 6) {
          const w = 5, h = 4;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const xx = x0 + x, yy = y0 + y;
              if (xx < 0 || xx >= S || yy >= S) continue;
              if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
              const hh = hash2(xx + x0 * 3, yy, seed);
              pb.set(ox + xx, oy + yy, y === 0 ? C.pebble : hh < 0.3 ? C.stone : season === 3 && hh > 0.8 ? C.frost : C.stone);
            }
        }
      }
      break;
    }
    case T.PLANKS:
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const board = Math.floor(y / 4);
          const seam = y % 4 === 3 || (x === ((board * 5 + v) % 16));
          pb.set(ox + x, oy + y, seam ? C.bark : y % 4 === 0 ? C.oak : at(x, y) < 0.1 ? C.oak : C.walnut);
        }
      break;
    case T.WOODFLOOR:
      // warm honey boards with staggered seams and the odd knot
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const yy = gy + y, xx = gx + x;
          const board = Math.floor(yy / 5);
          const seam = yy % 5 === 4 || (xx + board * 11) % 29 === 0;
          const knot = hash2(xx >> 1, board, 5) < 0.012;
          const tone = hash2(Math.floor((xx + board * 11) / 29), board, 9);
          const base = tone < 0.4 ? C.tan : C.oak;
          const grain = hash2(xx >> 2, yy, 17) < 0.12;
          pb.set(ox + x, oy + y, seam ? C.walnut : knot ? C.bark : yy % 5 === 0 && base === C.oak ? C.tan : grain ? (base === C.tan ? C.oak : C.walnut) : base);
        }
      break;
    case T.HOUSEWALL:
      if (v === 0) {
        // wall face: striped wallpaper above a wooden wainscot
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            let c: number;
            if (y >= 10) c = y === 10 ? C.tan : y === S - 1 ? C.bark : (gx + x) % 8 === 0 ? C.bark : C.walnut;
            else c = (gx + x) % 6 < 2 ? C.blush : (gx + x) % 6 === 3 && y % 4 === 1 ? C.rose : C.cream;
            pb.set(ox + x, oy + y, c);
          }
      } else if (v === 3) {
        // upper wall: wallpaper under a crown moulding
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            let c = (gx + x) % 6 < 2 ? C.blush : (gx + x) % 6 === 3 && y % 4 === 1 ? C.rose : C.cream;
            if (y < 2) c = C.bark;
            else if (y === 2) c = C.walnut;
            else if (y === 3) c = C.oak;
            else if (y === 4) c = C.tan;
            pb.set(ox + x, oy + y, c);
          }
      } else {
        // wall top seen from above: dark timber
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) pb.set(ox + x, oy + y, at(x, y) < 0.1 ? C.walnut : C.bark);
        if (v === 2) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (at(x, y) < 0.5) pb.set(ox + x, oy + y, C.ink);
      }
      break;
    case T.RIVER:
    case T.LAKE:
    case T.POND:
    case T.OCEAN:
    case T.MINEWATER: {
      const base = t === T.OCEAN ? C.river : t === T.POND ? C.river : C.river;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const h = hash2(x >> 1, y, seed);
          pb.set(ox + x, oy + y, h < 0.12 ? C.sky : h > 0.92 ? C.deepsea : base);
        }
      // ripple marks
      const rx = Math.floor(at(1, 2) * 10) + 2, ry = Math.floor(at(2, 1) * 12) + 2;
      for (let i = 0; i < 4; i++) pb.set(ox + rx + i, oy + ry, C.sky);
      break;
    }
    case T.DEEP:
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) pb.set(ox + x, oy + y, hash2(x >> 1, y, seed) < 0.1 ? C.river : C.deepsea);
      break;
    case T.LAVA:
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const h = hash2(x >> 1, y >> 1, seed);
          pb.set(ox + x, oy + y, h < 0.3 ? C.amber : h < 0.6 ? C.terracotta : C.brick);
        }
      break;
    case T.ROCK:
    case T.ORE_VEIN:
    case T.MINEFLOOR: {
      const [base, alt, speck] = t === T.MINEFLOOR ? MINE_FLOOR[extra] ?? MINE_FLOOR[0] : [C.stone, C.slate, C.pebble];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const b = blob(x, y, 10, 21 + t);
          const h = W2(x, y);
          let c = base;
          if (b < 0.35 && h < 0.55) c = alt;
          else if (W(x, y) > 0.992) c = speck;
          else if (t === T.MINEFLOOR && W(x + 3, y) > 0.985) c = alt;
          pb.set(ox + x, oy + y, c);
        }
      // the Clayworks' floor is old brick paving; Starfall's glitters
      if (t === T.MINEFLOOR && extra === 3) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((gy + y) % 8 === 7 || ((gx + x + ((gy + y) >> 3) * 4) % 8 === 0)) pb.set(ox + x, oy + y, alt);
      if (t === T.MINEFLOOR && extra === 5) for (let i = 0; i < 3; i++) pb.set(ox + Math.floor(W(i, 77) * 16), oy + Math.floor(W(77, i) * 16), W(i, i) > 0.5 ? C.gold : C.amber);
      if (t === T.ORE_VEIN) {
        const sc = ORE_SPECK[extra] ?? C.copper;
        for (let i = 0; i < 9; i++) {
          const x = Math.floor(at(i, 50) * 14) + 1, y = Math.floor(at(50, i) * 14) + 1;
          pb.set(ox + x, oy + y, sc);
          pb.set(ox + x + 1, oy + y, sc);
          pb.set(ox + x, oy + y + 1, C.ink);
        }
      }
      break;
    }
    case T.CLIFF: {
      // layered rock: blocks of varying width with lit tops and shadowed undersides
      for (let y = 0; y < S; y++) {
        const wy = gy + y;
        const band = Math.floor(wy / 7);
        const by = wy - band * 7;
        for (let x = 0; x < S; x++) {
          const wx = gx + x + band * 5;
          const blockW = 6 + Math.floor(hash2(band, Math.floor(wx / 9), 3) * 6);
          const bx = wx % blockW;
          let c = blob(x, y, 11, 4) > 0.55 ? C.stone : C.slate;
          if (by === 0) c = C.pebble;
          else if (by === 1) c = C.stone;
          else if (by === 6) c = C.plum;
          if (bx === 0 && by > 0) c = C.plum;
          if (W(x, y) > 0.97) c = C.slate;
          if (season === 3 && by === 0) c = C.cream;
          else if (by === 0 && W2(x, y) < 0.15 && season < 3) c = C.moss;
          pb.set(ox + x, oy + y, c);
        }
      }
      break;
    }
    case T.MINEWALL: {
      // dark rock with layered ledges, like the cliffs but deeper in shadow
      const [base, lit] = MINE_WALL[extra] ?? MINE_WALL[0];
      for (let y = 0; y < S; y++) {
        const wy = gy + y;
        const band = Math.floor(wy / 6);
        const by = wy - band * 6;
        for (let x = 0; x < S; x++) {
          const wx = gx + x + band * 7;
          const bw = 5 + Math.floor(hash2(band, Math.floor(wx / 8), 5) * 6);
          let c = blob(x, y, 9, 33) > 0.5 ? base : C.ink;
          if (by === 0) c = lit;
          if (wx % bw === 0) c = C.ink;
          if (W(x, y) > 0.985) c = lit;
          pb.set(ox + x, oy + y, c);
        }
      }
      break;
    }
    default:
      pb.rect(ox, oy, S, S, C.ink);
  }
}

/** Fringe pixels of terrain `src` reaching into a neighbor tile from direction d (0 N,1 E,2 S,3 W). */
export function paintFringe(pb: PixBuf, src: T, season: number, d: number, v: number) {
  const S = TILE;
  let a: number, b: number;
  if (src === T.SAND) { a = C.butter; b = C.tan; }
  else if (src === T.DIRT) { a = C.oak; b = C.walnut; }
  else { const p = grassPal(season, src === T.TOWNGRASS); a = p.base; b = p.dark; }
  for (let i = 0; i < S; i++) {
    const depth = 1 + Math.floor(hash2(i, d * 7 + v, 31) * 3) + (hash2(i >> 2, d, 33) < 0.3 ? 1 : 0);
    for (let k = 0; k < depth; k++) {
      let x = 0, y = 0;
      if (d === 0) { x = i; y = k; }
      else if (d === 2) { x = i; y = S - 1 - k; }
      else if (d === 1) { x = S - 1 - k; y = i; }
      else { x = k; y = i; }
      pb.set(x, y, k === depth - 1 ? b : a);
    }
  }
}

export function registerTerrainSprites() {
  // terrain tiles: t:<terrain>:<season>:<variant>[:extra]
  defSpriteFamily('t:', (name) => {
    const [, ts, ss, vs, es] = name.split(':');
    const t = +ts as T, season = +ss, v = +vs, extra = es ? +es : 0;
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        paintTerrain(pb, t, season, v, 0, 0, extra);
        pb.drawTo(ctx);
      },
    };
  });
  // fringes: f:<src terrain>:<season>:<dir>:<variant>
  defSpriteFamily('f:', (name) => {
    const [, ts, ss, ds, vs] = name.split(':');
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        paintFringe(pb, +ts as T, +ss, +ds, +vs);
        pb.drawTo(ctx);
      },
    };
  });
  // water foam edges: wf:<dir>
  defSpriteFamily('wf:', (name) => {
    const d = +name.split(':')[1];
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        for (let i = 0; i < TILE; i++) {
          const k = hash2(i, d, 5) < 0.35 ? 1 : 0;
          const put = (kk: number, c: number) => {
            if (d === 0) pb.set(i, kk, c);
            else if (d === 2) pb.set(i, TILE - 1 - kk, c);
            else if (d === 1) pb.set(TILE - 1 - kk, i, c);
            else pb.set(kk, i, c);
          };
          put(0, C.aqua);
          if (k) put(1, C.frost);
          if (hash2(i, d, 9) < 0.15) put(2, C.sky);
        }
        pb.drawTo(ctx);
      },
    };
  });
  // cliff face shadow/rim: cf:<kind> kind 0 = bottom shadow, 1 = top rim
  defSpriteFamily('cf:', (name) => {
    const kind = +name.split(':')[1];
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        if (kind === 0) {
          for (let x = 0; x < TILE; x++) {
            pb.set(x, TILE - 1, C.ink);
            pb.set(x, TILE - 2, C.slate);
            if (hash2(x, 3, 3) < 0.4) pb.set(x, TILE - 3, C.slate);
          }
        } else {
          for (let x = 0; x < TILE; x++) {
            pb.set(x, 0, C.pebble);
            if (hash2(x, 4, 4) < 0.5) pb.set(x, 1, C.pebble);
          }
        }
        pb.drawTo(ctx);
      },
    };
  });
  // tilled soil: soil:<wet>:<mask N E S W bits>
  defSpriteFamily('soil:', (name) => {
    const [, ws, ms] = name.split(':');
    const wet = ws === '1', mask = +ms;
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        const base = wet ? C.bark : C.walnut, alt = wet ? C.plum : C.bark, hi = wet ? C.walnut : C.oak;
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const h = hash2(x, y, 77);
            pb.set(x, y, h < 0.2 ? alt : h > 0.9 ? hi : base);
          }
        // furrow lines
        for (let x = 1; x < TILE - 1; x++) {
          pb.set(x, 4, alt);
          pb.set(x, 11, alt);
          if (x % 3 === 0) { pb.set(x, 5, hi); pb.set(x, 12, hi); }
        }
        // rims where the neighbor is not tilled
        const rim = wet ? C.plum : C.bark;
        if (!(mask & 1)) for (let x = 0; x < TILE; x++) pb.set(x, 0, rim);
        if (!(mask & 2)) for (let y = 0; y < TILE; y++) pb.set(TILE - 1, y, rim);
        if (!(mask & 4)) for (let x = 0; x < TILE; x++) { pb.set(x, TILE - 1, rim); pb.set(x, TILE - 2, hi); }
        if (!(mask & 8)) for (let y = 0; y < TILE; y++) pb.set(0, y, rim);
        pb.drawTo(ctx);
      },
    };
  });
  // fertilizer specks: fert:<color>
  defSpriteFamily('fert:', (name) => {
    const c = +name.split(':')[1];
    return {
      w: TILE, h: TILE,
      draw: (ctx) => {
        const pb = new PixBuf(TILE, TILE);
        for (let i = 0; i < 10; i++) pb.set(2 + Math.floor(hash2(i, c, 3) * 12), 2 + Math.floor(hash2(c, i, 4) * 12), c);
        pb.drawTo(ctx);
      },
    };
  });
}
