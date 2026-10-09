// Application shell: screens (title, new game, load, settings, play), main loop wiring.
import { C, skin3 } from '../data/palette';
import { GameLoop } from '../engine/loop';
import { Input } from '../engine/input';
import { Renderer } from '../render/renderer';
import { artReady, hasImage, resetSprites, setArtMode, sprite } from '../render/atlas';
import { resetSkin } from '../ui/skin';
import { registerAllArt, registerMapBuildings, setPlayerLook } from '../render/art';
import { UI } from '../ui/ui';
import { Game } from '../sim/Game';
import '../sim';
import { loadSettings, saveSettings, Settings } from './settings';
import { Audio } from '../engine/audio/audio';
import { PlayScreen } from './play';
import { listSaves, loadGame, deleteSave, importSaveJSON, SaveMeta } from '../sim/save';
import { ICON, textWidth } from '../ui/font';
import type { NPCLook } from '../data/types';
import { settingsPanel } from '../ui/windows/settings';
import { buildDemoFactory } from './demo';
import { registerLook } from '../render/art/chars';
import { PixelCursor, CursorKind } from '../ui/cursor';
import { MODES, MODE_BY_ID, FARMS, FARM_BY_ID, GameMode, FarmKind } from '../data/modes';
import { generateWorld, FARM } from '../sim/world/worldgen';
import { tileColor } from '../ui/hud';
import { PALETTE } from '../data/palette';
import { recordStart } from './profile';

export interface Screen {
  frame(dt: number): void;
  tick?(): void;
  /** optional cursor override (e.g. 'build' while placing) */
  cursorKind?(): CursorKind | null;
}

export class App {
  canvas: HTMLCanvasElement;
  input = new Input();
  ui = new UI();
  renderer: Renderer;
  settings: Settings;
  audio: Audio;
  screen!: Screen;
  loop: GameLoop;
  dpr = 1;
  cursor: PixelCursor;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.cursor = new PixelCursor(canvas);
    this.settings = loadSettings();
    this.input.binds = this.settings.binds;
    this.input.attach(canvas);
    this.renderer = new Renderer(canvas);
    this.audio = new Audio(this.settings);
    this.ui.sfx = (id) => this.audio.sfx(id);
    registerAllArt();
    // ?art=old shows the procedural 1.0 art (side-by-side comparisons during the overhaul)
    if (new URLSearchParams(location.search).get('art') === 'old') setArtMode('old');
    // imported sheets load in the background; repaint cached terrain once they are in
    artReady().then(() => {
      resetSprites();
      resetSkin();
      this.renderer.invalidateAll();
    });
    const resize = () => {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.renderer.resize(Math.floor(window.innerWidth * this.dpr), Math.floor(window.innerHeight * this.dpr));
    };
    window.addEventListener('resize', resize);
    resize();
    // first gesture unlocks audio
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.screen = new TitleScreen(this);
    // errors are reported but never freeze the game loop
    let lastErr = 0;
    const report = (where: string, e: unknown) => {
      const now = performance.now();
      if (now - lastErr > 2000) {
        lastErr = now;
        console.error(`[${where}]`, e);
        (this.screen as any).toast?.('Oops, something went wrong (see console). The game keeps running.');
      }
    };
    this.loop = new GameLoop(
      () => {
        try {
          this.screen.tick?.();
        } catch (e) {
          report('tick', e);
        }
      },
      (dt) => {
        try {
          this.screen.frame(dt);
        } catch (e) {
          report('frame', e);
          this.ui.ctx?.restore?.();
        }
        this.updateCursor();
        this.input.endFrame();
      },
    );
    this.loop.start();
    // browsers lose tabs: save whenever the page is hidden or closed
    const saveNow = () => {
      const s = this.screen as any;
      if (s instanceof PlayScreen && !s.g.sleeping) s.save(true);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
    (window as any).__app = this;
    (window as any).__Game = Game;
  }

  /** UI scale: automatic picks the largest integer scale that fits ~640x360 */
  get uiScale(): number {
    if (this.settings.uiScale > 0) return this.settings.uiScale;
    const w = this.canvas.width, h = this.canvas.height;
    return Math.max(1, Math.min(Math.floor(w / 560), Math.floor(h / 340)));
  }

  private updateCursor() {
    const ui = this.ui;
    let kind: CursorKind = 'arrow';
    if (ui.hand) kind = 'grab';
    else if (ui.hoverId) kind = 'hand';
    else kind = this.screen.cursorKind?.() ?? 'arrow';
    // one cursor pixel = one UI pixel, in CSS pixels
    this.cursor.set(kind, this.uiScale / this.dpr, this.settings.pixelCursor);
  }

  saveSettings() {
    this.input.binds = this.settings.binds;
    saveSettings(this.settings);
    this.audio.applySettings(this.settings);
  }

  startGame(g: Game, look: NPCLook, slot?: number) {
    setPlayerLook(look);
    registerMapBuildings(g.map);
    this.renderer.invalidateAll();
    this.screen = new PlayScreen(this, g, look, slot);
  }

  toTitle() {
    this.screen = new TitleScreen(this);
  }
}

// ---------------- Title ----------------
class TitleScreen implements Screen {
  demo: Game;
  t = 0;
  mode: 'main' | 'load' | 'settings' | 'new' = 'main';
  saves: SaveMeta[] = [];
  newGame: NewGameForm;
  importMsg = '';
  constructor(public app: App) {
    this.demo = new Game({ seed: 4242, name: 'Demo', farmName: 'Demo' });
    buildDemoFactory(this.demo);
    registerMapBuildings(this.demo.map);
    setPlayerLook({ skin: C.apricot, hair: C.walnut, hairStyle: 'short', shirt: C.moss, pants: C.river });
    app.renderer.invalidateAll();
    app.renderer.cam.x = 60;
    app.renderer.cam.y = 40;
    this.demo.time.min = 17 * 60;
    this.demo.player.y = -50;
    this.saves = listSaves();
    this.newGame = new NewGameForm(app);
    app.audio.setScene('title');
  }

  tick() {
    this.demo.tick();
  }

  frame(dt: number) {
    const app = this.app;
    this.t += dt;
    const r = app.renderer;
    r.cam.targetZoom = Math.max(2, Math.round(r.H / 360));
    r.cam.zoom = r.cam.targetZoom;
    r.cam.x = 62 + Math.sin(this.t * 0.03) * 14;
    r.cam.y = 34 + Math.sin(this.t * 0.021) * 8;
    if (this.demo.time.min > 22 * 60) this.demo.time.min = 16 * 60;
    r.draw(this.demo, dt);
    const ui = app.ui;
    ui.begin(r.ctx, app.input, app.uiScale, dt);
    ui.fill(0, 0, ui.w, ui.h, C.ink, 0.25);
    if (this.mode === 'main') this.mainMenu();
    else if (this.mode === 'load') this.loadMenu();
    else if (this.mode === 'settings') {
      if (settingsPanel(ui, app, () => (this.mode = 'main'))) this.mode = 'main';
    } else if (this.mode === 'new') {
      const res = this.newGame.draw(ui);
      if (res === 'back') this.mode = 'main';
    }
    ui.text(`v${version}  -  pixel art made with PixelLab, sound made procedurally`, 4, ui.h - 10, C.cream, { shadow: C.ink });
    ui.end();
    app.audio.update(dt, null);
  }

  drawLogo(ui: UI, cx: number, y: number) {
    const bob = Math.round(Math.sin(this.t * 1.5) * 2);
    // the drawn wordmark (logo sheet): its O is the spinning sprocket, 8 frames per tooth
    if (hasImage('logo:word')) {
      const w = sprite('logo:word');
      const x0 = Math.round(cx - w.w / 2), y0 = y - 6 + bob;
      // a soft stepped plate keeps "& Sprout" readable over the demo farm
      for (let i = 0; i < 3; i++) ui.fill(x0 - 14 + i * 3, y - 12 + i * 3, w.w + 28 - i * 6, 68 - i * 6, C.ink, 0.16);
      ui.ctx.drawImage(w.img, w.x, w.y, w.w, w.h, x0, y0, w.w, w.h);
      // the O slot centre is meta.oSlotCentre in src/art/logo.json
      const gear = sprite('logo:gear:' + (Math.floor(this.t * 9) & 7));
      ui.ctx.drawImage(gear.img, gear.x, gear.y, gear.w, gear.h, x0 + 64 - gear.ox, y0 + 19 - gear.oy, gear.w, gear.h);
      ui.text('a cozy farm-factory in the valley of Thistlewick', cx, y + 42, C.cream, { align: 'center', shadow: C.ink });
      return;
    }
    const left = cx - 4 - textWidth('Sprocket') * 4, right = cx + 22 + textWidth('Sprout') * 4;
    const gx = left - 16; // the spinning gear sits just left of the word, clear of the letters
    // a soft stepped plate so the logo reads over whatever the demo camera drifts across
    const px0 = gx - 18, px1 = right + 10, py0 = y - 8, py1 = y + 54;
    for (let i = 0; i < 3; i++) ui.fill(px0 + i * 3, py0 + i * 3, px1 - px0 - i * 6, py1 - py0 - i * 6, C.ink, 0.18);
    ui.text('Sprocket', cx - 4, y + bob, C.amber, { scale: 4, shadow: C.bark, align: 'right' });
    ui.text('&', cx + 6, y + 14 + bob, C.cream, { scale: 2, shadow: C.bark });
    ui.text('Sprout', cx + 22, y + bob, C.leaf, { scale: 4, shadow: C.pine });
    ui.text('a cozy farm-factory in the valley of Thistlewick', cx, y + 42, C.cream, { align: 'center', shadow: C.ink });
    const gy = y + 4 + bob;
    for (let i = 0; i < 8; i++) {
      const t = this.t + (i / 8) * Math.PI * 2;
      ui.fill(Math.round(gx + Math.cos(t) * 9) - 1, Math.round(gy + 12 + Math.sin(t) * 9) - 1, 3, 3, C.brass);
    }
  }

  mainMenu() {
    const ui = this.app.ui;
    const cx = Math.floor(ui.w / 2);
    this.drawLogo(ui, cx, Math.floor(ui.h * 0.16));
    const bw = 140, bh = 20;
    let y = Math.floor(ui.h * 0.45);
    const hasSave = this.saves.length > 0;
    if (hasSave && ui.button('cont', cx - bw / 2, y, bw, bh, 'Continue', { style: 'green' })) this.load(this.saves[0].slot);
    if (hasSave) y += bh + 6;
    if (ui.button('new', cx - bw / 2, y, bw, bh, 'New Game')) this.mode = 'new';
    y += bh + 6;
    if (ui.button('load', cx - bw / 2, y, bw, bh, 'Load Game', { disabled: !hasSave })) this.mode = 'load';
    y += bh + 6;
    if (ui.button('settings', cx - bw / 2, y, bw, bh, 'Settings')) this.mode = 'settings';
    y += bh + 6;
    if (ui.button('import', cx - bw / 2, y, bw, bh, 'Import Save (.json)')) this.importFile();
    // the browser offers to install the site as an app (Chrome/Edge): put that one click away
    const prompt = (window as any).__installPrompt;
    if (prompt) {
      y += bh + 6;
      if (ui.button('install', cx - bw / 2, y, bw, bh, 'Install as an app', { style: 'green', tip: 'Adds Sprocket & Sprout to your desktop and Start menu. Works offline.' })) {
        prompt.prompt();
        (window as any).__installPrompt = null;
      }
    }
    if (this.importMsg) ui.text(this.importMsg, cx, y + bh + 6, C.cream, { align: 'center', shadow: C.ink });
  }

  importFile() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const txt = await f.text();
      const res = importSaveJSON(txt);
      this.importMsg = res.ok ? 'Save imported into slot ' + res.slot + '!' : 'Import failed: ' + res.error;
      this.saves = listSaves();
    };
    inp.click();
  }

  load(slot: number) {
    const res = loadGame(slot);
    if (!res) {
      this.importMsg = 'Could not load that save.';
      return;
    }
    this.app.startGame(res.game, res.look, res.slot);
  }

  loadMenu() {
    const ui = this.app.ui;
    const w = 300, h = 60 + this.saves.length * 30;
    const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2);
    ui.panel(x, y, w, h);
    ui.text('Load a farm', x + w / 2, y + 10, C.walnut, { align: 'center', scale: 2 });
    this.saves.forEach((s, i) => {
      const yy = y + 34 + i * 30;
      ui.panel(x + 10, yy, w - 20, 26, 'inset', false);
      ui.text(`${s.name} of ${s.farm} Farm`, x + 16, yy + 4, C.ink);
      ui.text(`${s.date}  ${ICON.coin}${s.money}  slot ${s.slot}`, x + 16, yy + 14, C.walnut);
      if (ui.button('ld' + i, x + w - 90, yy + 4, 40, 18, 'Load', { style: 'green' })) this.load(s.slot);
      if (ui.button('del' + i, x + w - 46, yy + 4, 30, 18, 'Del', { style: 'red', tip: 'Delete this save forever' })) {
        if (confirm(`Delete ${s.name}'s farm in slot ${s.slot}? This can't be undone.`)) {
          deleteSave(s.slot);
          this.saves = listSaves();
          if (!this.saves.length) this.mode = 'main';
        }
      }
    });
    if (ui.button('back', x + w / 2 - 40, y + h - 26, 80, 18, 'Back')) this.mode = 'main';
  }
}

// ---------------- New game form ----------------
const SKINS = [C.cream, C.blush, C.apricot, C.tan, C.oak, C.walnut, C.bark];
const HAIRS = [C.bark, C.walnut, C.oak, C.amber, C.brick, C.ink, C.pebble, C.rose, C.violet, C.river, C.moss, C.cream];
const STYLES: NPCLook['hairStyle'][] = ['short', 'long', 'bun', 'curly', 'ponytail', 'spiky', 'braids', 'cap', 'hat', 'bald'];
const SHIRTS = [C.moss, C.river, C.rose, C.amber, C.violet, C.sky, C.terracotta, C.cream, C.slate, C.leaf, C.brick, C.blush];
const PANTS = [C.river, C.walnut, C.slate, C.bark, C.moss, C.deepsea, C.wine, C.tan];

class NewGameForm {
  name = '';
  farm = '';
  fav = 'Tea';
  look: NPCLook = { skin: C.apricot, hair: C.walnut, hairStyle: 'short', shirt: C.moss, pants: C.river, accent: C.rose };
  idx = { skin: 2, hair: 1, style: 0, shirt: 0, pants: 0 };
  t = 0;
  constructor(public app: App) {}

  step: 'who' | 'where' = 'who';
  mode: GameMode = 'story';
  farmKind: FarmKind = 'classic';
  previews = new Map<string, HTMLCanvasElement>();

  draw(ui: UI): 'back' | null {
    this.t += 1 / 60;
    if (this.step === 'where') return this.drawWhere(ui);
    const w = 340, h = 230;
    const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2);
    ui.panel(x, y, w, h);
    ui.text('A new life in Thistlewick', x + w / 2, y + 10, C.walnut, { align: 'center', scale: 2 });
    let yy = y + 36;
    ui.text('Your name', x + 16, yy + 4, C.ink);
    this.name = ui.textField('name', x + 100, yy, 120, this.name, 14);
    yy += 22;
    ui.text('Farm name', x + 16, yy + 4, C.ink);
    this.farm = ui.textField('farm', x + 100, yy, 120, this.farm, 14);
    ui.text("Farm", x + 224, yy + 4, C.walnut);
    yy += 30;
    // appearance
    const rows: [string, keyof NewGameForm['idx'], number][] = [['Skin', 'skin', SKINS.length], ['Hair color', 'hair', HAIRS.length], ['Hair style', 'style', STYLES.length], ['Shirt', 'shirt', SHIRTS.length], ['Pants', 'pants', PANTS.length]];
    rows.forEach(([label, k, n], i) => {
      const ry = yy + i * 18;
      ui.text(label, x + 16, ry + 4, C.ink);
      if (ui.button('l' + k, x + 100, ry, 16, 14, '<')) this.idx[k] = (this.idx[k] + n - 1) % n;
      if (ui.button('r' + k, x + 180, ry, 16, 14, '>')) this.idx[k] = (this.idx[k] + 1) % n;
      const label2 = k === 'style' ? STYLES[this.idx.style] : '';
      if (label2) ui.text(label2, x + 148, ry + 4, C.walnut, { align: 'center' });
      else {
        const col = k === 'skin' ? skin3(SKINS[this.idx.skin])[1] : (k === 'hair' ? HAIRS : k === 'shirt' ? SHIRTS : PANTS)[this.idx[k]];
        ui.fill(x + 136, ry + 2, 24, 10, C.ink);
        ui.fill(x + 137, ry + 3, 22, 8, col);
      }
    });
    this.look = { skin: SKINS[this.idx.skin], hair: HAIRS[this.idx.hair], hairStyle: STYLES[this.idx.style], shirt: SHIRTS[this.idx.shirt], pants: PANTS[this.idx.pants], accent: C.rose };
    // preview (re-register clears cache by using a unique id)
    const pid = 'preview_' + [this.idx.skin, this.idx.hair, this.idx.style, this.idx.shirt, this.idx.pants].join('_');
    registerLook(pid, this.look);
    const dir = Math.floor(this.t * 0.8) % 4;
    const frame = Math.floor(this.t * 6) % 4;
    const px = x + 292, py = y + 110;
    ui.panel(px - 30, py - 50, 60, 76, 'inset', false);
    try {
      const { sprite, drawSprite } = require_atlas();
      // x2, feet near the bottom of the panel (works for any frame size: imported sheets are taller)
      drawSprite(ui.ctx, sprite(`ch:${pid}:${dir}:${frame}`), px, py + 18, 2, dir === 3);
    } catch {
      /* look not registered yet */
    }
    const ok = this.name.trim().length > 0 && this.farm.trim().length > 0;
    if (ui.button('next', x + w - 110, y + h - 28, 96, 20, 'Next >', { style: 'green', disabled: !ok, tip: ok ? 'Choose a game mode and farm map' : 'Enter your name and farm name' })) this.step = 'where';
    if (ui.button('back', x + 14, y + h - 28, 60, 20, 'Back')) return 'back';
    return null;
  }

  /** a tiny map of the farm area for the chosen layout (1 pixel per tile) */
  preview(kind: FarmKind): HTMLCanvasElement {
    const hit = this.previews.get(kind);
    if (hit) return hit;
    const m = generateWorld(777, kind);
    const W = FARM.x1 - FARM.x0 + 1, H = FARM.y1 - FARM.y0 + 1;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const cx = c.getContext('2d')!;
    const img = cx.createImageData(W, H);
    const fake = { map: null, time: { season: 0 }, soil: new Map(), ents: null };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const hex = PALETTE[tileColor(fake, m, FARM.x0 + x, FARM.y0 + y)];
        const i = (y * W + x) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    cx.putImageData(img, 0, 0);
    this.previews.set(kind, c);
    return c;
  }

  drawWhere(ui: UI): 'back' | null {
    const w = Math.min(460, ui.w - 16), h = Math.min(272, ui.h - 16);
    const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2);
    ui.panel(x, y, w, h);
    ui.text('How will you play?', x + w / 2, y + 10, C.walnut, { align: 'center', scale: 2 });
    // modes (left)
    const colW = Math.floor((w - 36) / 2);
    const lx = x + 12;
    ui.text('Game mode', lx, y + 32, C.ink);
    MODES.forEach((m, i) => {
      const by = y + 42 + i * 19;
      if (ui.button('mode_' + m.id, lx, by, colW, 17, m.name, { active: this.mode === m.id })) this.mode = m.id;
    });
    const md = MODE_BY_ID.get(this.mode)!;
    let ty = y + 42 + MODES.length * 19 + 4;
    ui.panel(lx, ty, colW, h - (ty - y) - 36, 'inset', false);
    ui.text(md.tag, lx + 5, ty + 5, C.walnut);
    md.lines.forEach((l, i) => ui.para('- ' + l, lx + 5, ty + 17 + i * 18, colW - 10, C.bark, 9));
    // farm maps (right)
    const rx = x + 24 + colW;
    ui.text('Farm map', rx, y + 32, C.ink);
    FARMS.forEach((f, i) => {
      const bx = rx + (i % 2) * Math.floor(colW / 2), by = y + 42 + Math.floor(i / 2) * 19;
      if (ui.button('farm_' + f.id, bx, by, Math.floor(colW / 2) - 2, 17, f.short, { active: this.farmKind === f.id, tip: f.name })) this.farmKind = f.id;
    });
    const fd = FARM_BY_ID.get(this.farmKind)!;
    ty = y + 42 + 3 * 19 + 2;
    const pv = this.preview(this.farmKind);
    const ph = h - (ty - y) - 36;
    // one map pixel per tile, shown at a whole-number zoom (or an exact 1/n shrink) so it stays crisp
    const maxW = Math.min(colW, Math.round((ph - 26) * (pv.width / pv.height))), maxH = ph - 32;
    const zk = Math.min(maxW / pv.width, maxH / pv.height);
    const zd = zk >= 1 ? Math.floor(zk) : 1 / Math.ceil(1 / zk);
    const pw = Math.floor(pv.width * zd), pvh = Math.floor(pv.height * zd);
    ui.panel(rx, ty, colW, ph, 'inset', false);
    ui.fill(rx + 4, ty + 4, pw + 2, pvh + 2, C.ink);
    ui.ctx.drawImage(pv, rx + 5, ty + 5, pw, pvh);
    ui.text(fd.name, rx + pw + 10, ty + 6, C.ink);
    fd.lines.forEach((l, i) => ui.para(l, rx + pw + 10, ty + 18 + i * 20, colW - pw - 14, C.bark, 9));
    ui.para('The town, mine and beach are the same on every map. Each map has its own achievement.', rx + 4, ty + ph - 23, colW - 8, C.oak, 9);
    // begin
    const full = listSaves().length >= 6;
    if (ui.button('begin', x + w - 110, y + h - 28, 96, 20, 'Begin!', { style: 'green', tip: full ? 'All 6 save slots are full: the oldest will be replaced' : 'Start your first spring' })) {
      const oldest = listSaves().sort((a, b) => a.saved - b.saved)[0];
      if (!full || confirm(`All 6 save slots are full. Replace the oldest farm (${oldest.name} of ${oldest.farm})?`)) {
        const g = new Game({ name: this.name.trim(), farmName: this.farm.trim(), favorite: 'Tea', mode: this.mode, farm: this.farmKind });
        recordStart(this.farmKind, this.mode);
        this.app.startGame(g, this.look);
      }
    }
    if (ui.button('back2', x + 14, y + h - 28, 60, 20, '< Back')) this.step = 'who';
    return null;
  }
}

import * as atlas from '../render/atlas';
import { version } from '../../package.json';
function require_atlas() {
  return atlas;
}
