// Window registry. Windows are immediate-mode draw functions returning "keep open".
import { petSys } from '../../sim/systems/pet';
import { guild, postContracts } from '../../sim/systems/contracts';
import { FURNITURE } from '../../data/furniture';
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
import { ICON, ellipsize, textWidth, wrapText } from '../font';
import { DEBUG_KEYS, keyLabel } from '../../engine/input';
import { applyResearchMods } from '../../sim/save';
import { runPerfScene } from '../../app/perf';
import { getArtMode, setArtMode } from '../../render/atlas';
import { resetSkin } from '../skin';
import { drawFx, ladderPitch } from '../../render/juice';
import { QUEST_BY_ID } from '../../data/goals';
import { CROP_BY_ID } from '../../data/crops';
import { cropTotal } from '../../sim/systems/farming';
import { priceMult, unitPrice } from '../../sim/systems/economy';

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
  const k = (a: keyof typeof b) => b[a].map(keyLabel).join('/');
  // movement reads as "WASD or arrows" rather than every binding of every direction
  const dirs = ['up', 'left', 'down', 'right'] as const;
  const alt = dirs.map((d) => b[d][1]).filter(Boolean);
  const move = dirs.map((d) => keyLabel(b[d][0] ?? '')).join('') + (alt.length === 4 ? (alt.every((c) => c.startsWith('Arrow')) ? ' or arrows' : ' or ' + alt.map(keyLabel).join('')) : '');
  const lines: [string, string][] = [
    ['Move', `${move} (hold ${k('run')} to walk slowly)`],
    ['Use tool / place', 'Left click (hold to repeat; hold hoe/can to charge)'],
    ['Interact / harvest / talk', `Right click or ${k('interact')}`],
    ['Hotbar', '1-0 or mouse wheel'],
    ['Backpack / crafting', `${k('inventory')} / ${k('craft')}`],
    ['Research tree', k('research')],
    ['Production stats', k('stats')],
    ['Journal / map', `${k('journal')} / ${k('map')}`],
    ['Rotate', `${k('rotate')} (also rotates placed structures under the mouse)`],
    ['Pick structure', `${k('pipette')} (copies the structure under the mouse)`],
    ['Deconstruct area', `${k('deconstruct')} then drag a box`],
    ['Copy / paste blueprint', `${k('copy')} drag a box, then ${k('paste')} to paste`],
    ['Eat held item', k('eat')],
    ['Zoom', `${k('zoomIn')} in, ${k('zoomOut')} out, or Ctrl + wheel`],
    ...(DEBUG_KEYS ? [['Debug panel', k('debug')] as [string, string]] : []),
  ];
  lines.forEach(([a, c], i) => {
    ui.text(a, x + 14, y + 18 + i * 13, C.ink);
    ui.text(c, x + 140, y + 18 + i * 13, C.walnut);
  });
  if (ui.button('hback', x + w / 2 - 30, y + h - 24, 60, 16, 'Back')) st.data.help = false;
  return true;
}

/**
 * The night tally. Rows reveal one by one with rising ticks, the total counts up with a coin
 * shower of sound, a record day gets a stamp and confetti, and a teaser line says what's waiting
 * this morning. Enter/Space/click finishes the count; the next press closes.
 */
function drawSummary(ui: UI, play: PlayScreen, st: WinState): boolean {
  const s = st.arg;
  const g = play.g;
  const a = play.app.audio, J = play.app.renderer.juice;
  const sold: { k: number; n: number; price: number; coins?: number }[] = s.sold ?? [];
  const rows = sold.slice(0, 10);
  const D = st.data as { shown?: number; ticks?: number; done?: boolean; tease?: string[]; stamped?: boolean };
  // the works first: yesterday's bottleneck in numbers and what the night shift made (ROADMAP.md 4.3, 4.14)
  if (!D.tease) D.tease = [...worksLines(s), ...morningTease(play, sold)].slice(0, 4);
  // full 16 px icons in the night tally (the day's reward deserves more than belt-size icons)
  const ROW = 17;
  const w = 300, h = Math.min(316, 116 + Math.min(10, sold.length) * ROW + D.tease.length * 11 + ((s.quests ?? []).length ? 14 : 0));
  const { x, y } = centered(ui, w, h);
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.5);
  if (!frame(ui, x, y, w, h, `${SEASON_NAMES[s.season]} ${s.day}, Year ${s.year}`)) return false;
  // timeline: rows 0.3 s + 0.14 s each, then the total counts up over ~1.1 s
  const T0 = 0.3, STEP = 0.14, COUNT = 1.1;
  const tRows = T0 + rows.length * STEP;
  const skip = ui.input.keyPressed('Enter') || ui.input.keyPressed('Space') || ui.clicked;
  if (!D.done && skip && st.t > 0.1) {
    st.t = tRows + COUNT + 0.01;
    D.done = true;
    ui.clicked = false;
  } else if (D.done && skip && st.t > tRows + COUNT + 0.15) return false;
  const shown = Math.min(rows.length, Math.max(0, Math.floor((st.t - T0) / STEP) + 1));
  if (shown > (D.shown ?? 0)) {
    for (let i = D.shown ?? 0; i < shown; i++) a.sfx('pickup', 0.5, ladderPitch(i));
    D.shown = shown;
  }
  const ck = Math.max(0, Math.min(1, (st.t - tRows) / COUNT));
  const counted = Math.round(s.total * (1 - Math.pow(1 - ck, 3)));
  const ticks = Math.floor(ck * 12);
  if (ck < 1 && ticks > (D.ticks ?? -1) && s.total > 0) {
    D.ticks = ticks;
    a.sfx('coin_tick', 0.7, ladderPitch(Math.min(10, ticks)));
  }
  if (ck >= 1) D.done = true;
  const record = s.total > 0 && s.total > (s.best ?? 0) && (s.best ?? 0) > 0;
  // a record day: the headline itself turns into the stamp (with the wax seal pressing in)
  if (record && ck >= 1) {
    const sf = Math.min(2, Math.floor((st.t - tRows - COUNT) / 0.08));
    const hw = textWidth('Best day yet!');
    drawFx(ui.ctx, 'fx:seal', Math.max(0, sf), x + w / 2 - hw / 2 - 14, y + 18);
    ui.text('Best day yet!', x + w / 2, y + 14, C.brick, { align: 'center' });
  } else ui.text(s.passedOut ? 'You collapsed from exhaustion...' : s.total > 0 ? 'A good day\'s work.' : 'A quiet day.', x + w / 2, y + 14, s.passedOut ? C.brick : C.walnut, { align: 'center' });
  if (s.passedOut) ui.text('You passed out and slept in until 10am.', x + w / 2, y + 26, C.brick, { align: 'center' });
  let yy = y + 40;
  if (!sold.length) ui.text('Nothing was shipped. Fill the crate by the house before bed!', x + w / 2, yy, C.oak, { align: 'center' });
  rows.forEach((it, i) => {
    if (i >= shown) return;
    // each row slides in from the right
    const age = st.t - (T0 + i * STEP);
    const dx = age < 0.1 && !D.done ? Math.round((1 - age / 0.1) * 12) : 0;
    ui.itemIcon(it.k, x + 18 + dx, yy - 5, 16);
    ui.text(`${ITEMS[it.k >> 2].name} x${it.n}`, x + 38 + dx, yy, C.ink);
    ui.text(`${ICON.coin}${(it.coins ?? it.price * it.n).toLocaleString()}`, x + w - 20 + dx, yy, C.moss, { align: 'right' });
    yy += ROW;
  });
  if (sold.length > 10 && shown >= rows.length) ui.text(`...and ${sold.length - 10} more kinds`, x + 38, yy, C.oak);
  // quests finished today, under the sales
  const qs: string[] = s.quests ?? [];
  if (qs.length && shown >= rows.length) {
    const qy = y + h - 60 - D.tease.length * 11;
    drawFx(ui.ctx, 'fx:scroll', 3, x + 26, qy + 8);
    ui.text(`Quests done: ${qs.slice(0, 2).join(', ')}${qs.length > 2 ? ` +${qs.length - 2}` : ''}`, x + 38, qy, C.walnut, { maxW: w - 58 });
  }
  // the coin pile grows with the count; the total rolls up beside it
  const ty = y + h - 46 - D.tease.length * 11;
  if (s.total > 0) {
    const pf = Math.min(3, Math.floor((counted / Math.max(s.total, s.best ?? 0, 1)) * 4));
    drawFx(ui.ctx, 'fx:pile', pf, x + w - 132, ty + 9);
  }
  ui.text(`Total: ${ICON.coin}${counted.toLocaleString()}`, x + w - 20, ty, C.ink, { align: 'right' });
  ui.text(`Purse: ${ICON.coin}${g.player.money.toLocaleString()}`, x + 20, ty, C.walnut);
  if (record && ck >= 1) {
    if (!D.stamped) {
      D.stamped = true;
      a.sfx('levelup', 0.8);
      J.confetti(x + w / 2, y + 18, 40, true, 80);
    }
  }
  // what's waiting this morning: a reason to get up
  D.tease.forEach((line, i) => ui.text(ellipsize(line, w - 16), x + w / 2, y + h - 40 - (D.tease!.length - i) * 11 + 6, C.pine, { align: 'center' }));
  if (ui.button('sumok', x + w / 2 - 40, y + h - 26, 80, 18, D.done ? 'Good morning!' : 'Skip', { style: 'green' })) {
    if (D.done) return false;
    st.t = tRows + COUNT + 0.01;
    D.done = true;
  }
  return true;
}

/** the night tally's works lines: the bottleneck and the night shift */
function worksLines(s: { bottleneck?: string | null; nightBatches?: number }): string[] {
  const out: string[] = [];
  if (s.bottleneck) out.push(...wrapText('Yesterday: ' + s.bottleneck, 280).slice(0, 2));
  if (s.nightBatches) out.push(`The night shift ran ${s.nightBatches} batch${s.nightBatches === 1 ? '' : 'es'} while you slept.`);
  return out;
}

/** one or two lines about what's ready this morning */
function morningTease(play: PlayScreen, sold: { k: number; n: number }[] = []): string[] {
  const g = play.g;
  const out: string[] = [];
  // the market is saturating what you ship most: say so while there's time to switch
  for (const r of [...sold].sort((a, b) => b.n - a.n).slice(0, 3)) {
    const d = ITEMS[r.k >> 2];
    if (!d || r.n < 8 || priceMult(g, r.k >> 2) > 0.6) continue;
    out.push(`${d.name} is flooding the market: ${unitPrice(g, r.k)}, was ${d.price}.`);
    break;
  }
  let ripe = 0;
  for (const s of g.soil.values()) if (s.crop?.ready && !s.crop.dead) ripe++;
  let goods = 0;
  for (const e of g.ents.machines) goods += e.mach?.outBuf.reduce((n, o) => n + o.n, 0) ?? 0;
  if (ripe) out.push(`${ripe} crop${ripe > 1 ? 's are' : ' is'} ripe and ready to pick.`);
  if (goods) out.push(`Your machines made ${goods} good${goods > 1 ? 's' : ''} overnight.`);
  // crops only grow on watered days: say so before promising a date
  let dry = 0;
  if (!g.isRaining()) for (const s of g.soil.values()) if (s.crop && !s.crop.ready && !s.crop.dead && !s.water) dry++;
  if (dry && out.length < 2) out.push(`${dry} crop${dry > 1 ? 's need' : ' needs'} water today to keep growing.`);
  // the soonest crop still growing: a date to look forward to (counting watered days)
  if (out.length < 2) {
    let best: { name: string; days: number } | null = null;
    for (const s of g.soil.values()) {
      const c = s.crop;
      if (!c || c.ready || c.dead) continue;
      const cr = CROP_BY_ID.get(c.id);
      if (!cr) continue;
      const days = cropTotal(cr) - c.days;
      if (!best || days < best.days) best = { name: ITEM_BY_ID.get(cr.produce)?.name ?? cr.name, days };
    }
    if (best) {
      const nm = best.name.toLowerCase(), plural = nm.endsWith('s') ? nm : nm + 's';
      out.push(`Your ${plural} ripen ${best.days <= 1 ? 'tomorrow' : `in ${best.days} watered days`}.`);
    }
  }
  if (!out.length) {
    const q = (g.sys.quests?.active ?? [])[0] as { id: string } | undefined;
    const title = q ? QUEST_BY_ID.get(q.id)?.title : null;
    if (title) out.push(`Today: ${title}`);
  }
  return out.slice(0, 2);
}

function afterSummary(play: PlayScreen) {
  if (play.app.settings.autosave) {
    if (play.save(true)) play.toast('Autosaved.');
  }
  play.app.audio.sfx('rooster', 0.6);
  play.g.sys.onMorning?.forEach?.((f: any) => f(play.g, play));
  if (play.g.sys.nightMsg) {
    play.openWindow('message', { title: 'During the night...', text: play.g.sys.nightMsg });
    play.g.sys.nightMsg = null;
  }
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
  const lines = wrapText(a.text, w - (a.icon ? 52 : 28)).length;
  const h = 52 + lines * 10;
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
  const w = 248, x = 4, y = 96;
  ui.panel(x, y, w, 222, 'dark');
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
  const btns: [string, string, () => void][] = [];
  const row = (a: [string, string, () => void], c?: [string, string, () => void]) => {
    btns.push(a);
    if (c) btns.push(c);
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
  row(['pet', 'Stray pet', () => { const p = petSys(g); if (p.stage === 'none') { p.stage = 'stray'; p.map = 'world'; const [hx, hy] = g.map.loc('farmhouse'); p.x = hx - 1.5; p.y = hy + 2.5; } g.toast('A stray waits by the farmhouse.'); }], ['guild', 'Guild + depot', () => { g.research.done.add('r_belts'); g.research.done.add('r_arms'); const gs = guild(g); if (!gs.unlocked) { gs.unlocked = true; postContracts(g); } g.give(key('freight_depot'), 1); }]);
  row(['home', 'Renovate', () => { for (const f of ['home_kitchen', 'home_featherbed', 'home_pantry', 'home_hearth']) g.flags.add(f); g.toast('Farmhouse fully renovated.'); }], ['furn', 'Furniture', () => { for (const f of FURNITURE) g.give(key(f.id), 1, false); g.toast('One of every furniture piece added.'); }]);
  row(['year', 'Founders day', () => { g.flags.add('eval_pending'); }], ['locket', 'Locket', () => g.give(key('heart_charm'), 1)]);
  row(['mine', 'Mine +5 fl', () => g.sys.mine?.debugDescend?.(g, 5)], ['hearts', 'Friends +2h', () => { for (const n of g.sys.npcs?.list ?? []) n.points = Math.min(2500, (n.points ?? 0) + 500); }]);
  // art overhaul: imported sheets vs the procedural 1.0 art
  row(['art', `Art: ${getArtMode()}`, () => { setArtMode(getArtMode() === 'new' ? 'old' : 'new'); resetSkin(); app.renderer.invalidateAll(); }], ['cmp', `Compare ${app.renderer.compareArt ? 'on' : 'off'}`, () => (app.renderer.compareArt = !app.renderer.compareArt)]);
  btns.forEach(([id, label, fn], i) => {
    const bx = x + 6 + (i % 3) * 80, by = yy + Math.floor(i / 3) * 17;
    if (ui.button('dbg_' + id, bx, by, 76, 15, label, { style: 'flat' })) fn();
  });
  yy += Math.ceil(btns.length / 3) * 17;
  // give item by name
  st.data.q = ui.textField('dbg_q', x + 6, yy, 150, st.data.q ?? '', 18);
  if (ui.button('dbg_give', x + 160, yy, 42, 16, 'Give', { style: 'flat' })) {
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
