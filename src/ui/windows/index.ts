// Window registry. Windows are immediate-mode draw functions returning "keep open".
import { C } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { RESEARCH } from '../../data/research';
import { SEASON_NAMES } from '../../data/types';
import { key } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { drawMenu } from './menu';
import { drawStruct } from './struct';
import { centered, frame } from './common';
import { settingsPanel } from './settings';
import { ICON } from '../font';
import { applyResearchMods } from '../../sim/save';
import { runPerfScene } from '../../app/perf';

export interface WinState {
  id: string;
  arg?: any;
  t: number;
  pause?: boolean;
  data: any;
}

export interface WindowDef {
  draw: (ui: UI, play: PlayScreen, st: WinState) => boolean;
  /** blocks world input */
  modal?: boolean;
  /** pauses the sim (if the setting allows) */
  pause?: boolean;
  onClose?: (play: PlayScreen, st: WinState) => void;
}

export const WINDOWS: Record<string, WindowDef> = {
  menu: { draw: drawMenu },
  struct: { draw: drawStruct, pause: false },
  pause: { draw: drawPause },
  summary: { draw: drawSummary, onClose: (play) => afterSummary(play) },
  confirm: { draw: drawConfirm },
  debug: { draw: drawDebug, modal: false, pause: false },
  message: { draw: drawMessage },
};

export function registerWindow(id: string, def: WindowDef) {
  WINDOWS[id] = def;
}

function drawPause(ui: UI, play: PlayScreen, st: WinState): boolean {
  if (st.data.settings) {
    if (settingsPanel(ui, play.app, () => (st.data.settings = false))) st.data.settings = false;
    return true;
  }
  if (st.data.help) return drawHelp(ui, play, st);
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.35);
  const w = 170, h = 196;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Paused')) return false;
  const bw = w - 40;
  let yy = y + 16;
  const btn = (id: string, label: string, style?: any) => {
    const r = ui.button(id, x + 20, yy, bw, 18, label, { style });
    yy += 22;
    return r;
  };
  if (btn('resume', 'Resume', 'green')) return false;
  if (btn('save', 'Save game')) play.save();
  if (btn('export', 'Export save file')) play.exportSave();
  if (btn('settings', 'Settings')) st.data.settings = true;
  if (btn('help', 'Controls & tips')) st.data.help = true;
  if (btn('quit', 'Save & quit to title', 'red')) {
    play.save(true);
    play.app.toTitle();
    return false;
  }
  ui.text(`Slot ${play.slot}`, x + w / 2, yy + 2, C.oak, { align: 'center' });
  return true;
}

function drawHelp(ui: UI, play: PlayScreen, st: WinState): boolean {
  const w = 380, h = 250;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Controls')) {
    st.data.help = false;
    return true;
  }
  const b = play.app.settings.binds;
  const k = (a: keyof typeof b) => b[a].map((c) => c.replace('Key', '').replace('Digit', '')).join('/');
  const lines: [string, string][] = [
    ['Move', `${k('up')}${k('left')}${k('down')}${k('right')} (hold ${k('run')} to walk slowly)`],
    ['Use tool / place', 'Left click (hold to repeat; hold hoe/can to charge)'],
    ['Interact / harvest / talk', `Right click or ${k('interact')}`],
    ['Hotbar', '1-0 or mouse wheel'],
    ['Backpack / crafting', `${k('inventory')} / ${k('craft')}`],
    ['Research tree', k('research')],
    ['Production stats', k('stats')],
    ['Journal / map', `${k('journal')} / ${k('map')}`],
    ['Rotate', `${k('rotate')} (also rotates placed structures under the mouse)`],
    ['Pick structure', `${k('pipette')} (copies the structure under the mouse into your hand)`],
    ['Deconstruct area', `${k('deconstruct')} then drag a box`],
    ['Copy / paste blueprint', `${k('copy')} drag a box, then ${k('paste')} to paste`],
    ['Eat held item', k('eat')],
    ['Zoom', `${k('zoomIn')} / ${k('zoomOut')} or Ctrl + wheel`],
    ['Debug panel', k('debug')],
  ];
  lines.forEach(([a, c], i) => {
    ui.text(a, x + 14, y + 18 + i * 13, C.ink);
    ui.text(c, x + 140, y + 18 + i * 13, C.walnut);
  });
  if (ui.button('hback', x + w / 2 - 30, y + h - 24, 60, 16, 'Back')) st.data.help = false;
  return true;
}

function drawSummary(ui: UI, play: PlayScreen, st: WinState): boolean {
  const s = st.arg;
  const g = play.g;
  const sold: { k: number; n: number; price: number }[] = s.sold ?? [];
  const w = 300, h = Math.min(250, 96 + Math.min(10, sold.length) * 12);
  const { x, y } = centered(ui, w, h);
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.5);
  if (!frame(ui, x, y, w, h, `${SEASON_NAMES[s.season]} ${s.day}, Year ${s.year}`)) return false;
  ui.text(s.passedOut ? 'You collapsed from exhaustion...' : 'A good day\'s work.', x + w / 2, y + 14, s.passedOut ? C.brick : C.walnut, { align: 'center' });
  if (s.penalty) ui.text(`Someone carried you home. The clinic bill was ${ICON.coin}${s.penalty}.`, x + w / 2, y + 26, C.brick, { align: 'center' });
  let yy = y + 40;
  if (!sold.length) ui.text('Nothing was shipped.', x + w / 2, yy, C.oak, { align: 'center' });
  sold.slice(0, 10).forEach((it) => {
    ui.itemIcon(it.k, x + 20, yy - 3, 12);
    ui.text(`${ITEMS[it.k >> 2].name} x${it.n}`, x + 36, yy, C.ink);
    ui.text(`${ICON.coin}${it.price * it.n}`, x + w - 20, yy, C.moss, { align: 'right' });
    yy += 12;
  });
  if (sold.length > 10) ui.text(`...and ${sold.length - 10} more kinds`, x + 36, yy, C.oak);
  ui.text(`Total: ${ICON.coin}${s.total.toLocaleString()}`, x + w - 20, y + h - 40, C.ink, { align: 'right', scale: 1 });
  ui.text(`Purse: ${ICON.coin}${g.player.money.toLocaleString()}`, x + 20, y + h - 40, C.walnut);
  if (ui.button('sumok', x + w / 2 - 40, y + h - 26, 80, 18, 'Good morning!', { style: 'green' })) return false;
  if (ui.input.keyPressed('Enter') || ui.input.keyPressed('Space')) return false;
  return true;
}

function afterSummary(play: PlayScreen) {
  if (play.app.settings.autosave) {
    if (play.save(true)) play.toast('Autosaved.');
  }
  play.app.audio.sfx('rooster', 0.6);
  play.g.sys.onMorning?.forEach?.((f: any) => f(play.g, play));
}

function drawConfirm(ui: UI, play: PlayScreen, st: WinState): boolean {
  const a = st.arg as { text: string; yes: () => void; no?: () => void; yesLabel?: string; noLabel?: string };
  const w = 240, h = 74;
  const { x, y } = centered(ui, w, h);
  ui.panel(x, y, w, h);
  ui.para(a.text, x + 12, y + 12, w - 24, C.ink);
  if (ui.button('yes', x + w / 2 - 74, y + h - 26, 68, 18, a.yesLabel ?? 'Yes', { style: 'green' }) || ui.input.keyPressed('Enter')) {
    play.win = null;
    a.yes();
    return play.win !== null ? true : false;
  }
  if (ui.button('no', x + w / 2 + 6, y + h - 26, 68, 18, a.noLabel ?? 'No')) {
    a.no?.();
    return false;
  }
  return true;
}

function drawMessage(ui: UI, play: PlayScreen, st: WinState): boolean {
  const a = st.arg as { title: string; text: string; icon?: string };
  const w = 280;
  const lines = Math.ceil(a.text.length / 50) + a.text.split('\n').length;
  const h = 60 + lines * 10;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, a.title)) return false;
  if (a.icon) ui.itemIcon(key(a.icon), x + 14, y + 16, 16);
  ui.para(a.text, x + (a.icon ? 38 : 14), y + 16, w - (a.icon ? 52 : 28), C.ink);
  if (ui.button('msgok', x + w / 2 - 30, y + h - 24, 60, 16, 'OK', { style: 'green' }) || ui.input.keyPressed('Enter')) return false;
  void play;
  return true;
}

// ---------------- debug panel ----------------
function drawDebug(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const app = play.app;
  const w = 168, x = 4, y = 120;
  ui.panel(x, y, w, 236, 'dark');
  ui.text('DEBUG (`)', x + 6, y + 5, C.amber);
  const L = app.loop;
  ui.text(`fps ${Math.round(L.fps)}  tick ${L.tickMs.toFixed(2)}ms  draw ${L.frameMs.toFixed(1)}ms`, x + 6, y + 15, C.cream);
  ui.text(`ents ${g.ents.map.size} belts ${g.ents.belts.length} mach ${g.ents.machines.length}`, x + 6, y + 25, C.cream);
  ui.text(`drawables ${app.renderer.drawCount} parts ${app.renderer.particles.list.length}`, x + 6, y + 35, C.cream);
  ui.text(`tile ${Math.floor(g.player.x)},${Math.floor(g.player.y)} speed x${L.speed}`, x + 6, y + 45, C.cream);
  let yy = y + 58;
  const b = (id: string, label: string) => {
    const col = (yy - y - 58) / 18;
    void col;
    const r = ui.button('dbg_' + id, x + 6 + (st.data.col ? 80 : 0), yy, 76, 15, label, { style: 'flat' });
    return r;
  };
  const row = (a: [string, string, () => void], c?: [string, string, () => void]) => {
    if (ui.button('dbg_' + a[0], x + 6, yy, 76, 15, a[1], { style: 'flat' })) a[2]();
    if (c && ui.button('dbg_' + c[0], x + 86, yy, 76, 15, c[1], { style: 'flat' })) c[2]();
    yy += 17;
  };
  void b;
  row(['money', '+5000g', () => (g.player.money += 5000)], ['energy', 'Full energy', () => { g.player.energy = g.player.maxEnergy + g.mods.energy; g.player.hp = g.player.maxHp; }]);
  row(['hour', '+1 hour', () => (g.time.min = Math.min(1559, g.time.min + 60))], ['day', 'Sleep now', () => g.goToBed()]);
  row(['speed', `Speed x${L.speed === 1 ? 4 : L.speed === 4 ? 16 : 1}`, () => (L.speed = L.speed === 1 ? 4 : L.speed === 4 ? 16 : 1)], ['season', 'Next season', () => { g.time.day = 28; g.time.min = 1559; }]);
  row(['research', 'All research', () => { for (const r of RESEARCH) g.research.done.add(r.id); g.flags.add('lab'); applyResearchMods(g); }], ['water', 'Water all', () => { for (const s of g.soil.values()) s.water = true; }]);
  row(['grow', 'Grow crops', () => { for (const s of g.soil.values()) if (s.crop && !s.crop.dead) { s.crop.days += 3; s.crop.frac = 0; } g.sys.debugGrow?.(g); }], ['weather', `Wthr: ${g.weather}`, () => { const ws = ['sun', 'rain', 'storm', 'snow', 'wind'] as const; g.weather = ws[(ws.indexOf(g.weather as any) + 1) % 5]; }]);
  row(['kit', 'Factory kit', () => giveKit(g)], ['res', 'Resources', () => giveRes(g)]);
  row(['perf', 'Perf scene', () => runPerfScene(play)], ['tp', 'Warp: town', () => { g.player.x = 133.5; g.player.y = 64.5; g.player.where = 'world'; }]);
  row(['tpq', 'Warp: quarry', () => { g.player.x = 178.5; g.player.y = 40.5; g.player.where = 'world'; }], ['tpf', 'Warp: farm', () => { g.player.x = 49.5; g.player.y = 24.5; g.player.where = 'world'; }]);
  row(['mine', 'Mine +5 fl', () => g.sys.mine?.debugDescend?.(g, 5)], ['hearts', 'Friends +2h', () => { for (const n of g.sys.npcs?.list ?? []) n.points = Math.min(2500, (n.points ?? 0) + 500); }]);
  // give item by name
  st.data.q = ui.textField('dbg_q', x + 6, yy, 110, st.data.q ?? '', 18);
  if (ui.button('dbg_give', x + 120, yy, 42, 16, 'Give', { style: 'flat' })) {
    const q = (st.data.q as string).toLowerCase().replace(/ /g, '_');
    const d = ITEM_BY_ID.get(q) ?? ITEMS.find((i) => i.name.toLowerCase().includes((st.data.q as string).toLowerCase()));
    if (d) g.give(key(d.id), d.stack === 1 ? 1 : 50);
  }
  return true;
}

function giveKit(g: any) {
  for (const [id, n] of [['belt_1', 200], ['arm_basic', 40], ['arm_fast', 20], ['splitter_1', 10], ['under_1', 10], ['chest_wood', 10], ['furnace', 10], ['keg', 10], ['jar', 10], ['pole_wood', 30], ['waterwheel', 4], ['windmill', 4], ['steam_engine', 2], ['mill', 4], ['assembler', 4], ['lab', 2], ['harvester', 4], ['planter', 4], ['sprinkler_2', 20], ['drill_steam', 4]] as const) g.give(key(id), n, false);
  g.toast('Factory kit added.');
}
function giveRes(g: any) {
  for (const [id, n] of [['wood', 500], ['stone', 500], ['copper_bar', 100], ['iron_bar', 100], ['coal', 200], ['fiber', 300], ['plank', 200], ['copper_gear', 100], ['brass_gear', 50], ['iron_plate', 100], ['copper_coil', 100], ['glass', 50], ['brick', 100], ['bundle_green', 100], ['bundle_copper', 100]] as const) g.give(key(id), n, false);
  g.toast('Resources added.');
}
