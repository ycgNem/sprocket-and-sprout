// Persistent player settings (separate from save games).
import { DEFAULT_BINDS, Action } from '../engine/input';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** 0 = automatic */
  uiScale: number;
  binds: Record<Action, string[]>;
  overnight: 'full' | 'skip';
  pauseInMenus: boolean;
  showGrid: boolean;
  screenShake: boolean;
  autosave: boolean;
  /** draw the brass pixel-art mouse cursor (false = system cursor) */
  pixelCursor: boolean;
  /** key bubbles next to things you can use ("F Enter") */
  keyPrompts: boolean;
  /** the camera zoom you last chose, as steps from the window's own (src/app/play.ts) */
  zoomStep: number;
}

const KEY = 'sns_settings_v1';

export function defaultSettings(): Settings {
  return {
    master: 0.8, music: 0.55, sfx: 0.8, uiScale: 0, binds: structuredClone(DEFAULT_BINDS),
    overnight: 'full', pauseInMenus: true, showGrid: false, screenShake: true, autosave: true, pixelCursor: true, keyPrompts: true, zoomStep: 0,
  };
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    const out = { ...d, ...s };
    const saved: Record<string, string[]> = s.binds ?? {};
    out.binds = { ...d.binds, ...saved };
    // an action added since these settings were saved keeps its default key only if nothing took it
    const taken = new Set(Object.values(saved).flat());
    for (const a of Object.keys(d.binds) as (keyof typeof d.binds)[]) if (!saved[a]) out.binds[a] = d.binds[a].filter((k) => !taken.has(k));
    return out;
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
