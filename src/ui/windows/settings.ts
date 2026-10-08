// Settings panel: audio, UI scale, gameplay toggles and key rebinding.
import { C } from '../../data/palette';
import { ACTIONS, ACTION_LABELS, DEFAULT_BINDS, keyLabel } from '../../engine/input';
import type { UI } from '../ui';
import type { App } from '../../app/app';

let tab: 'general' | 'keys' = 'general';
let rebinding: string | null = null;

export function slider(ui: UI, id: string, x: number, y: number, w: number, v: number): number {
  const hov = ui.hover(x - 2, y - 3, w + 4, 12);
  ui.fill(x, y + 2, w, 3, C.walnut);
  ui.fill(x, y + 2, Math.round(w * v), 3, C.amber);
  const kx = x + Math.round(w * v) - 3;
  ui.fill(kx, y - 1, 7, 9, C.ink);
  ui.fill(kx + 1, y, 5, 7, hov ? C.butter : C.tan);
  if (hov && ui.input.mouse.down[0]) {
    v = Math.max(0, Math.min(1, (ui.mx - x) / w));
    ui.eat();
  }
  void id;
  return v;
}

function toggle(ui: UI, id: string, x: number, y: number, label: string, v: boolean, tip?: string): boolean {
  const r = ui.button(id, x, y, 14, 14, v ? 'x' : '', { active: v, tip });
  ui.text(label, x + 20, y + 4, C.ink);
  return r ? !v : v;
}

/** Returns true when the panel should close. */
export function settingsPanel(ui: UI, app: App, onClose: () => void): boolean {
  const s = app.settings;
  const w = 320, h = 250;
  const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2);
  ui.panel(x, y, w, h);
  ui.text('Settings', x + w / 2, y + 10, C.walnut, { align: 'center', scale: 2 });
  if (ui.button('tgen', x + 14, y + 30, 70, 16, 'General', { active: tab === 'general' })) tab = 'general';
  if (ui.button('tkeys', x + 88, y + 30, 70, 16, 'Keybinds', { active: tab === 'keys' })) tab = 'keys';
  let changed = false;
  if (tab === 'general') {
    let yy = y + 56;
    const row = (label: string, v: number, set: (n: number) => void) => {
      ui.text(label, x + 16, yy, C.ink);
      const nv = slider(ui, label, x + 120, yy, 150, v);
      ui.text(Math.round(nv * 100) + '%', x + 280, yy, C.walnut);
      if (nv !== v) {
        set(nv);
        changed = true;
      }
      yy += 16;
    };
    row('Master volume', s.master, (n) => (s.master = n));
    row('Music', s.music, (n) => (s.music = n));
    row('Sound effects', s.sfx, (n) => (s.sfx = n));
    yy += 4;
    ui.text('UI scale', x + 16, yy + 3, C.ink);
    const opts = [0, 1, 2, 3, 4];
    opts.forEach((o, i) => {
      if (ui.button('sc' + o, x + 120 + i * 34, yy, 30, 14, o === 0 ? 'Auto' : o + 'x', { active: s.uiScale === o })) {
        s.uiScale = o;
        changed = true;
      }
    });
    yy += 22;
    const t1 = toggle(ui, 'pim', x + 16, yy, 'Pause while menus are open', s.pauseInMenus);
    if (t1 !== s.pauseInMenus) { s.pauseInMenus = t1; changed = true; }
    yy += 18;
    const t2 = toggle(ui, 'ovn', x + 16, yy, 'Factory keeps running overnight', s.overnight === 'full', 'When you sleep, machines and belts keep working through the night (a short fast-forward). Turn off on slow computers.');
    if (t2 !== (s.overnight === 'full')) { s.overnight = t2 ? 'full' : 'skip'; changed = true; }
    yy += 18;
    const t3 = toggle(ui, 'grid', x + 16, yy, 'Show tile grid while building', s.showGrid);
    if (t3 !== s.showGrid) { s.showGrid = t3; changed = true; }
    yy += 18;
    const t4 = toggle(ui, 'shake', x + 16, yy, 'Screen shake', s.screenShake);
    if (t4 !== s.screenShake) { s.screenShake = t4; changed = true; }
    yy += 18;
    const t5 = toggle(ui, 'auto', x + 16, yy, 'Autosave every morning', s.autosave);
    if (t5 !== s.autosave) { s.autosave = t5; changed = true; }
  } else {
    const listY = y + 52, listH = h - 84;
    const contentH = ACTIONS.length * 14;
    const off = ui.scrollOffset('keys', x + 10, listY, w - 20, listH, contentH);
    ui.clip(x + 10, listY, w - 20, listH);
    ACTIONS.forEach((a, i) => {
      const yy = listY + i * 14 - off;
      if (yy < listY - 14 || yy > listY + listH) return;
      ui.text(ACTION_LABELS[a], x + 16, yy + 3, C.ink);
      const label = rebinding === a ? 'press a key...' : s.binds[a].map(keyLabel).join(' / ');
      if (ui.button('kb' + a, x + 170, yy, 120, 13, label, { active: rebinding === a, style: 'flat' })) {
        rebinding = a;
        ui.input.captureKey = (code) => {
          if (code !== 'Escape') {
            // remove the key from other actions to avoid conflicts
            for (const other of ACTIONS) s.binds[other] = s.binds[other].filter((k) => k !== code);
            s.binds[a] = [code];
          }
          rebinding = null;
          app.saveSettings();
        };
      }
    });
    ui.unclip();
    if (ui.button('kreset', x + 14, y + h - 26, 90, 18, 'Reset keys')) {
      s.binds = structuredClone(DEFAULT_BINDS);
      changed = true;
    }
  }
  if (changed) app.saveSettings();
  if (ui.button('sdone', x + w - 84, y + h - 26, 70, 18, 'Done', { style: 'green' }) || ui.input.wasPressed('pause')) {
    ui.input.consume('pause');
    onClose();
    return true;
  }
  return false;
}
