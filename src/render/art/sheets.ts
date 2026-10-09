// Imported pixel-art sheets: every src/art/<name>.png with its <name>.json manifest, written by
// scripts/art-import.mjs (see STYLE.md). A sheet takes over the procedural sprites of the same
// names; the procedural art stays reachable as `name:old` and through setArtMode('old').
import { defImageFamily, getArtMode } from '../atlas';
import { getLook } from './chars';
import { PALETTE, ramp3, skin3 } from '../../data/palette';
import type { NPCLook } from '../../data/types';

/** What art-import writes next to each sheet (plus the recipe's `meta` fields). */
export interface SheetMeta {
  name: string;
  kind?: 'character';
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
  /** character sheets: tool animations (sim anim kinds) drawn on the sheet as frames 7-8, with the tool */
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
 * Tool animations the imported sheet for this look draws itself (frames 7-8, tool included), so
 * the renderer skips its rotated tool icon. Empty with the procedural art.
 */
export function sheetToolKinds(id: string): readonly string[] {
  if (getArtMode() !== 'new') return [];
  return charSheets.find((m) => drawsLook(m, id))?.toolKinds ?? [];
}

/** How tall the character art of this look is (px, feet to top), for things drawn above the head. */
export function charArtHeight(id: string): number {
  const m = getArtMode() === 'new' ? charSheets.find((m) => drawsLook(m, id)) : undefined;
  return m?.artHeight ?? 22; // the procedural 16x24 characters
}

/** Look ids of the extra character sheets (candidates) the debug Compare lineup shows. */
export function compareIds(): string[] {
  return charSheets.filter((m) => !serves(m, 'player')).map((m) => m.ids?.[0]).filter((x): x is string => !!x);
}

function defCharSheet(url: string, m: SheetMeta) {
  charSheets.push(m);
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
    return { url, x: col * fw, y: row * fh, w: fw, h: fh, ox: ax, oy: ay, flipX: left, recolor: lookSwap(m.keys, look) };
  });
}

export function registerSheetSprites() {
  for (const [path, m] of Object.entries(metas)) {
    const url = urls[path.replace(/\.json$/, '.png')];
    if (!url) {
      console.error('sprite sheet manifest without a PNG', path);
      continue;
    }
    if (m.kind === 'character') defCharSheet(url, m);
  }
}
