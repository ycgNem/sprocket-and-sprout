// Sprite atlas: sprites are generated lazily by code and packed into shared pages.
import { makeCanvas, ctx2d, Ctx } from './art/pixel';

export interface Sprite {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  /** anchor offset (pixels) used when drawing at a world position */
  ox: number;
  oy: number;
}

const PAGE = 2048;
interface Page { c: HTMLCanvasElement; ctx: Ctx; shelfY: number; shelfH: number; x: number }
const pages: Page[] = [];

function newPage(): Page {
  const c = makeCanvas(PAGE, PAGE);
  const p = { c, ctx: ctx2d(c), shelfY: 0, shelfH: 0, x: 0 };
  pages.push(p);
  return p;
}

function alloc(w: number, h: number): { p: Page; x: number; y: number } {
  let p = pages[pages.length - 1] ?? newPage();
  if (p.x + w + 1 > PAGE) {
    p.shelfY += p.shelfH + 1;
    p.shelfH = 0;
    p.x = 0;
  }
  if (p.shelfY + h + 1 > PAGE) {
    p = newPage();
  }
  const x = p.x, y = p.shelfY;
  p.x += w + 1;
  p.shelfH = Math.max(p.shelfH, h);
  return { p, x, y };
}

type Gen = { w: number; h: number; ox?: number; oy?: number; draw: (ctx: Ctx, c: HTMLCanvasElement) => void; big?: boolean };
const generators = new Map<string, Gen | ((name: string) => Gen | null)>();
const cache = new Map<string, Sprite>();
const prefixGens: [string, (name: string) => Gen | null][] = [];

/** Register a named sprite generator. */
export function defSprite(name: string, gen: Gen) {
  generators.set(name, gen);
}

/** Register a generator for all sprites whose name starts with prefix. */
export function defSpriteFamily(prefix: string, fn: (name: string) => Gen | null) {
  prefixGens.push([prefix, fn]);
}

export function hasSprite(name: string) {
  return cache.has(name) || generators.has(name) || prefixGens.some(([p]) => name.startsWith(p));
}

let missing: Sprite | null = null;
function missingSprite(): Sprite {
  if (!missing) {
    const c = makeCanvas(16, 16);
    const ctx = ctx2d(c);
    ctx.fillStyle = '#d14b6a';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1a1220';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);
    missing = { img: c, x: 0, y: 0, w: 16, h: 16, ox: 0, oy: 0 };
  }
  return missing;
}

export function sprite(name: string): Sprite {
  let s = cache.get(name);
  if (s) return s;
  let g = generators.get(name) as Gen | undefined;
  if (!g) {
    for (const [p, fn] of prefixGens) {
      if (name.startsWith(p)) {
        const r = fn(name);
        if (r) { g = r; break; }
      }
    }
  }
  if (!g) {
    if (import.meta.env?.DEV) console.warn('missing sprite', name);
    s = missingSprite();
    cache.set(name, s);
    return s;
  }
  const tmp = makeCanvas(g.w, g.h);
  const tctx = ctx2d(tmp);
  g.draw(tctx, tmp);
  if (g.big || g.w > 256 || g.h > 256) {
    s = { img: tmp, x: 0, y: 0, w: g.w, h: g.h, ox: g.ox ?? 0, oy: g.oy ?? 0 };
  } else {
    const a = alloc(g.w, g.h);
    a.p.ctx.drawImage(tmp, a.x, a.y);
    s = { img: a.p.c, x: a.x, y: a.y, w: g.w, h: g.h, ox: g.ox ?? 0, oy: g.oy ?? 0 };
  }
  cache.set(name, s);
  return s;
}

/** Draw a sprite with its anchor at (x, y). */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1, flipX = false) {
  if (flipX) {
    ctx.save();
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.img, s.x, s.y, s.w, s.h, -s.ox * scale, Math.round(y - s.oy * scale), s.w * scale, s.h * scale);
    ctx.restore();
    return;
  }
  ctx.drawImage(s.img, s.x, s.y, s.w, s.h, Math.round(x - s.ox * scale), Math.round(y - s.oy * scale), s.w * scale, s.h * scale);
}

export function invalidateSprite(name: string) {
  cache.delete(name);
}

/** Drop every cached sprite whose name starts with prefix, so it regenerates on next use. */
export function invalidateSpritePrefix(prefix: string) {
  for (const name of cache.keys()) if (name.startsWith(prefix)) cache.delete(name);
}
