// Imported pixel-art sheets: every src/art/<name>.png with its <name>.json manifest, written by
// scripts/art-import.mjs (see STYLE.md). A sheet takes over the procedural sprites of the same
// names; the procedural art stays reachable as `name:old` and through setArtMode('old').
import { artReady, defImageFamily, getArtMode } from '../atlas';
import { getLook } from './chars';
import { PALETTE, ramp3, skin3 } from '../../data/palette';
import type { NPCLook } from '../../data/types';
import { matchSprite, pickVertex } from './match';

/** One frame of a `sprites` sheet (scripts/sprites-import.mjs). */
export interface SpriteEntry {
  /** sprite name or pattern: `*` matches one `:` segment, a final `**` the rest */
  match: string;
  /** rect in the sheet [x, y, w, h] */
  r: [number, number, number, number];
  /** anchor offset [ox, oy], as the procedural sprite had */
  o: [number, number];
  flipX?: boolean;
  recolor?: Record<string, string>;
}

/** What art-import writes next to each sheet (plus the recipe's `meta` fields). */
export interface SheetMeta {
  name: string;
  kind?: 'character' | 'sprites' | 'terrain';
  /** sprites sheets: frames by sprite name (first match wins) */
  sprites?: SpriteEntry[];
  frame: [number, number];
  anchor: [number, number];
  /** median art height of the frames (px), measured by art-import */
  artHeight?: number;
  rows: string[];
  cols: string[];
  /** palette-swap key ramps [shadow, base, light] per look part */
  keys?: Partial<Record<'skin' | 'hair' | 'shirt' | 'pants' | 'accent', string[]>>;
  /** character sheets: look ids it draws ('preview_*' matches a prefix) */
  ids?: string[];
  /** character sheets: hair styles drawn on the sheet; other looks keep the procedural sprite */
  styles?: string[];
  /** character sheets: game frame number -> column name (0-3 walk, 4 raise, 5 strike, 6 stand, 7-8 tool swing) */
  frames?: Record<string, string>;
  /** character sheets: tool animations (sim anim kinds) drawn as frames 7-8 with the tool in hand
   * (newer sheets map `<kind>0` / `<kind>1` in `frames` instead, one pair per tool) */
  toolKinds?: string[];
}

const metas = import.meta.glob<SheetMeta>('../../art/*.json', { eager: true, import: 'default' });
const urls = import.meta.glob<string>('../../art/*.png', { eager: true, query: '?url', import: 'default' });

/** the renderer's direction order: 0 up, 1 right, 2 down, 3 left */
const DIRS = ['up', 'right', 'down', 'left'];

/** Recolor map from a sheet's key ramps to a look's ramps (empty when the look is the sheet's own). */
export function lookSwap(keys: SheetMeta['keys'], look: NPCLook): Record<string, string> | undefined {
  if (!keys) return undefined;
  const target: Record<string, [number, number, number] | null> = {
    skin: skin3(look.skin),
    hair: ramp3(look.hair),
    shirt: ramp3(look.shirt),
    pants: ramp3(look.pants),
    accent: look.accent !== undefined ? ramp3(look.accent) : null,
  };
  const map: Record<string, string> = {};
  for (const [part, ks] of Object.entries(keys)) {
    const t = target[part];
    if (!t || !ks) continue;
    ks.forEach((k, i) => {
      const to = PALETTE[t[Math.min(i, 2)]];
      if (to !== k.toLowerCase()) map[k.toLowerCase()] = to;
    });
  }
  return Object.keys(map).length ? map : undefined;
}

const charSheets: SheetMeta[] = [];
const serves = (m: SheetMeta, id: string) => (m.ids ?? []).some((p) => (p.endsWith('*') ? id.startsWith(p.slice(0, -1)) : id === p));
const drawsLook = (m: SheetMeta, id: string) => {
  const look = getLook(id);
  return !!look && serves(m, id) && (!m.styles || m.styles.includes(look.hairStyle));
};

/**
 * The frame token of a tool swing this look's sheet draws with the tool in hand: `<kind>0` (raise) /
 * `<kind>1` (strike) when the sheet maps them, else 7/8 for its `toolKinds`; null when the renderer
 * must draw the swing itself.
 */
export function sheetToolFrame(id: string, kind: string, phase: 0 | 1): string | null {
  if (getArtMode() !== 'new') return null;
  const m = charSheets.find((m) => drawsLook(m, id));
  if (!m) return null;
  if (m.frames?.[kind + phase]) return kind + phase;
  return m.toolKinds?.includes(kind) ? String(7 + phase) : null;
}

/** How tall the character art of this look is (px, feet to top), for things drawn above the head. */
export function charArtHeight(id: string): number {
  const m = getArtMode() === 'new' ? charSheets.find((m) => drawsLook(m, id)) : undefined;
  return m?.artHeight ?? 22; // the procedural 16x24 characters
}

/**
 * How many frames of an extra animation this look's sheet maps as `<prefix>0`, `<prefix>1`, … in
 * `meta.frames` (0 without one): `i` idle, `g` greeting. Cached per look and prefix.
 */
const extraFrames = new Map<string, number>();
export function charFrames(id: string, prefix: string): number {
  if (getArtMode() !== 'new') return 0;
  const k = id + ':' + prefix;
  let n = extraFrames.get(k);
  if (n === undefined) {
    const m = charSheets.find((m) => drawsLook(m, id));
    n = 0;
    while (m?.frames?.[prefix + n]) n++;
    extraFrames.set(k, n);
  }
  return n;
}

/** Look ids of the candidate player sheets (ids `cand_*`) the debug Compare lineup shows. */
export function compareIds(): string[] {
  return charSheets.map((m) => m.ids?.[0]).filter((x): x is string => !!x && x.startsWith('cand'));
}

function defCharSheet(url: string, m: SheetMeta) {
  charSheets.push(m);
  extraFrames.clear();
  const [fw, fh] = m.frame;
  const [ax, ay] = m.anchor;
  // sprite names: ch:<look id>:<dir>:<frame>
  defImageFamily('ch:', [url], (name) => {
    const [, id, ds, fs] = name.split(':');
    if (!drawsLook(m, id)) return null;
    const look = getLook(id)!;
    const dir = +ds;
    // without a left row the right one is used and the renderer mirrors it
    const left = dir === 3 && m.rows.includes('left');
    const row = m.rows.indexOf(DIRS[dir === 3 && !left ? 1 : dir]);
    const col = m.cols.indexOf(m.frames?.[fs] ?? m.cols[0]);
    if (row < 0 || col < 0) return null;
    // the left row is stored mirrored because the renderer flips left-facing sprites back
    // only player sheets follow a look; NPC sheets are drawn as they are
    const looked = serves(m, 'player') || serves(m, 'preview_') || id.startsWith('cand');
    return { url, x: col * fw, y: row * fh, w: fw, h: fh, ox: ax, oy: ay, flipX: left, recolor: looked ? lookSwap(m.keys, look) : undefined };
  });
}

// ---- terrain (scripts/terrain-import.mjs) ----
// Ground is drawn on a dual grid: one 16 px tile per grid *vertex*, centered on it, picked from the
// classes of the four map tiles that meet there (Wang corner sets). Classes without transitions
// (cliffs, planks, floors) are drawn per map tile on top.

type XY = [number, number];
export interface TerrainMeta {
  name: string;
  kind: 'terrain';
  tile: number;
  /** pure tiles per class, several variants each */
  bases: Record<string, XY[]>;
  /** Wang corner sets: tiles[mask] are variants for that corner mask (NW 8, NE 4, SW 2, SE 1; set = upper) */
  sets: { lower: string; upper: string; tiles: Record<string, XY[]> }[];
  /** per-tile classes (cliff, cliff_top, planks, woodfloor …), variants each */
  tiles: Record<string, XY[]>;
  /** small overlays scattered on a class ("grass", or "grass@3" for one season only): [x, y, w, h] */
  decals?: Record<string, [number, number, number, number][]>;
  /** recolor per season index ("2" fall, "3" winter) applied to every terrain tile */
  seasons?: Record<string, Record<string, string>>;
  /** per-tile classes drawn as a recolor of another class's tiles until they have art of their own
   * (the Deepworks' Clayworks, Crystal and Starfall floors and walls: minefloor3-5, minewall3-5) */
  derive?: Record<string, { from: string; recolor: Record<string, string> }>;
}

export interface TerrainArt {
  /** Wang tile (or base tile when all four corners agree) for four corner classes; null if no art */
  vertex(nw: string, ne: string, sw: string, se: string, h: number, season: number): string | null;
  /** a per-tile class tile; null if none */
  tile(cls: string, h: number, season: number): string | null;
  /** a decal for a class this season; null if none */
  decal(cls: string, h: number, season: number): string | null;
  hasBase(cls: string): boolean;
  hasTile(cls: string): boolean;
  /** is there a Wang set for this pair of classes (either way round)? */
  hasSet(a: string, b: string): boolean;
}

let terrain: TerrainArt | null = null;
/** set once the sheets have loaded, so no chunk is baked from missing frames */
let terrainReady = false;
/** The imported terrain, or null with the procedural art (?art=old), before it loads or without one. */
export function terrainArt(): TerrainArt | null {
  return getArtMode() === 'new' && terrainReady ? terrain : null;
}

function defTerrainSheet(url: string, m: TerrainMeta) {
  const T = m.tile ?? 16;
  const recolor = (s: number) => m.seasons?.[String(s)];
  const frame = (xy: XY | [number, number, number, number], s: number) => ({ url, x: xy[0], y: xy[1], w: (xy as number[])[2] ?? T, h: (xy as number[])[3] ?? T, ox: 0, oy: 0, recolor: recolor(s) });
  // tb:<class>:<v>:<season>  tw:<set>:<mask>:<v>:<season>  tt:<class>:<v>:<season>  td:<key>:<v>:<season>
  defImageFamily('tb:', [url], (n) => { const [, c, v, s] = n.split(':'); const xy = m.bases[c]?.[+v]; return xy ? frame(xy, +s) : null; });
  defImageFamily('tw:', [url], (n) => { const [, i, k, v, s] = n.split(':'); const xy = m.sets[+i]?.tiles[k]?.[+v]; return xy ? frame(xy, +s) : null; });
  // a class's own tiles win; a class without any is drawn as its `derive` recolor of another
  const derived = (c: string) => (m.tiles[c]?.length ? undefined : m.derive?.[c] && m.tiles[m.derive[c].from]?.length ? m.derive[c] : undefined);
  defImageFamily('tt:', [url], (n) => {
    const [, c, v, s] = n.split(':');
    const d = derived(c);
    const xy = (d ? m.tiles[d.from] : m.tiles[c])?.[+v];
    if (!xy) return null;
    const f = frame(xy, +s);
    return d ? { ...f, recolor: { ...(f.recolor ?? {}), ...d.recolor } } : f;
  });
  defImageFamily('td:', [url], (n) => { const [, c, v, s] = n.split(':'); const r = m.decals?.[c]?.[+v]; return r ? frame(r, +s) : null; });
  const vi = <V>(list: V[] | undefined, h: number) => (list && list.length ? Math.min(list.length - 1, Math.floor(h * list.length)) : -1);
  terrain = {
    hasBase: (c) => !!m.bases[c]?.length,
    hasTile: (c) => !!m.tiles[c]?.length || !!derived(c),
    hasSet: (a, b) => m.sets.some((s) => (s.lower === a && s.upper === b) || (s.lower === b && s.upper === a)),
    tile(c, h, s) {
      const d = derived(c);
      const v = vi(d ? m.tiles[d.from] : m.tiles[c], h);
      return v < 0 ? null : `tt:${c}:${v}:${s}`;
    },
    decal(c, h, s) {
      const key = m.decals?.[`${c}@${s}`] ? `${c}@${s}` : c;
      const v = vi(m.decals?.[key], h);
      return v < 0 ? null : `td:${key}:${v}:${s}`;
    },
    vertex(nw, ne, sw, se, h, s) {
      const p = pickVertex(m, [nw, ne, sw, se], h);
      if (!p) return null;
      return 'base' in p ? `tb:${p.base}:${p.v}:${s}` : `tw:${p.set}:${p.mask}:${p.v}:${s}`;
    },
  };
}

/** A `sprites` sheet: every entry takes over the procedural sprites its pattern matches. */
function defSpritesSheet(url: string, m: SheetMeta) {
  const byPrefix = new Map<string, { exact: Map<string, SpriteEntry>; patterns: SpriteEntry[] }>();
  for (const e of m.sprites ?? []) {
    const prefix = e.match.slice(0, e.match.indexOf(':') + 1) || e.match;
    let g = byPrefix.get(prefix);
    if (!g) byPrefix.set(prefix, (g = { exact: new Map(), patterns: [] }));
    if (e.match.includes('*')) g.patterns.push(e);
    else if (!g.exact.has(e.match)) g.exact.set(e.match, e);
  }
  for (const [prefix, g] of byPrefix)
    defImageFamily(prefix, [url], (name) => {
      const e = g.exact.get(name) ?? g.patterns.find((p) => matchSprite(p.match, name));
      if (!e) return null;
      const [x, y, w, h] = e.r;
      // frameGen keeps a flipped frame's anchor on its pixel column; `o` is the anchor as displayed
      return { url, x, y, w, h, ox: e.flipX ? w - e.o[0] : e.o[0], oy: e.o[1], flipX: e.flipX, recolor: e.recolor };
    });
}

let smoke: Record<string, [number, number]> | null = null;
/**
 * Chimney mouths of imported machines (a sprites sheet's meta.smoke: structure id -> [x, y] from
 * the footprint's top-left), or null with the procedural art. Ids not listed don't smoke.
 */
export function smokePoints(): Record<string, [number, number]> | null {
  return getArtMode() === 'new' ? smoke : null;
}

export function registerSheetSprites() {
  // the first sheet to name a sprite wins: a sheet with a higher meta.priority goes first (a newer
  // sheet replacing a few frames of an older group), then file order
  const prio = (m: SheetMeta) => ((m as { meta?: { priority?: number } }).meta?.priority ?? 0);
  const entries = Object.entries(metas).sort((a, b) => prio(b[1]) - prio(a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [path, m] of entries) {
    const url = urls[path.replace(/\.json$/, '.png')];
    if (!url) {
      console.error('sprite sheet manifest without a PNG', path);
      continue;
    }
    if (m.kind === 'character') defCharSheet(url, m);
    else if (m.kind === 'sprites') {
      defSpritesSheet(url, m);
      const sm = (m as { meta?: { smoke?: Record<string, [number, number]> } }).meta?.smoke;
      if (sm) smoke = { ...(smoke ?? {}), ...sm };
    }
    else if (m.kind === 'terrain') defTerrainSheet(url, m as unknown as TerrainMeta);
  }
  artReady().then(() => (terrainReady = true));
}
