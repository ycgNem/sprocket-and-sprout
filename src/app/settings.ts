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
}

const KEY = 'sns_settings_v1';

export function defaultSettings(): Settings {
  return {
    master: 0.8, music: 0.55, sfx: 0.8, uiScale: 0, binds: structuredClone(DEFAULT_BINDS),
    overnight: 'full', pauseInMenus: true, showGrid: false, screenShake: true, autosave: true, pixelCursor: true, keyPrompts: true,
  };
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    const out = { ...d, ...s };
    out.binds = { ...d.binds, ...(s.binds ?? {}) };
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
