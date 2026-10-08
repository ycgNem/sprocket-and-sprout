// Application shell: screens (title, new game, load, settings, play), main loop wiring.
import { C } from '../data/palette';
import { GameLoop } from '../engine/loop';
import { Input } from '../engine/input';
import { Renderer } from '../render/renderer';
import { registerAllArt, registerMapBuildings, setPlayerLook } from '../render/art';
import { UI } from '../ui/ui';
import { Game } from '../sim/Game';
import '../sim';
import { loadSettings, saveSettings, Settings } from './settings';
import { Audio } from '../engine/audio/audio';
import { PlayScreen } from './play';
import { listSaves, loadGame, deleteSave, importSaveJSON, SaveMeta } from '../sim/save';
import { ICON } from '../ui/font';
import type { NPCLook } from '../data/types';
import { settingsPanel } from '../ui/windows/settings';
import { buildDemoFactory } from './demo';
import { registerLook } from '../render/art/chars';

export interface Screen {
  frame(dt: number): void;
  tick?(): void;
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.input.binds = this.settings.binds;
    this.input.attach(canvas);
    this.renderer = new Renderer(canvas);
    this.audio = new Audio(this.settings);
    this.ui.sfx = (id) => this.audio.sfx(id);
    registerAllArt();
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
    this.loop = new GameLoop(
      () => this.screen.tick?.(),
      (dt) => {
        this.screen.frame(dt);
        this.input.endFrame();
      },
    );
    this.loop.start();
    (window as any).__app = this;
    (window as any).__Game = Game;
  }

  /** UI scale: automatic picks the largest integer scale that fits ~640x360 */
  get uiScale(): number {
    if (this.settings.uiScale > 0) return this.settings.uiScale;
    const w = this.canvas.width, h = this.canvas.height;
    return Math.max(1, Math.min(Math.floor(w / 560), Math.floor(h / 340)));
  }

  saveSettings() {
    this.input.binds = this.settings.binds;
    saveSettings(this.settings);
    this.audio.applySettings(this.settings);
  }

  startGame(g: Game, look: NPCLook) {
    setPlayerLook(look);
    registerMapBuildings(g.map);
    this.renderer.invalidateAll();
    this.screen = new PlayScreen(this, g, look);
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
    ui.text('v0.9  -  all art and sound made procedurally', 4, ui.h - 10, C.cream, { shadow: C.ink });
    ui.end();
    app.audio.update(dt, null);
  }

  drawLogo(ui: UI, cx: number, y: number) {
    const bob = Math.round(Math.sin(this.t * 1.5) * 2);
    ui.text('Sprocket', cx - 4, y + bob, C.amber, { scale: 4, shadow: C.bark, align: 'right' });
    ui.text('&', cx + 6, y + 14 + bob, C.cream, { scale: 2, shadow: C.bark });
    ui.text('Sprout', cx + 22, y + bob, C.leaf, { scale: 4, shadow: C.pine });
    ui.text('a cozy farm-factory in the valley of Thistlewick', cx, y + 42, C.cream, { align: 'center', shadow: C.ink });
    // little gear + sprout ornaments
    const gx = cx - 120, gy = y + 4;
    const a = this.t;
    for (let i = 0; i < 8; i++) {
      const t = a + (i / 8) * Math.PI * 2;
      ui.fill(Math.round(gx + Math.cos(t) * 9), Math.round(gy + 12 + Math.sin(t) * 9), 3, 3, C.brass);
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
    this.app.startGame(res.game, res.look);
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

  draw(ui: UI): 'back' | null {
    this.t += 1 / 60;
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
    yy += 22;
    ui.text('Favorite thing', x + 16, yy + 4, C.ink);
    this.fav = ui.textField('fav', x + 100, yy, 120, this.fav, 14);
    yy += 28;
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
        const col = (k === 'skin' ? SKINS : k === 'hair' ? HAIRS : k === 'shirt' ? SHIRTS : PANTS)[this.idx[k]];
        ui.fill(x + 136, ry + 2, 24, 10, C.ink);
        ui.fill(x + 137, ry + 3, 22, 8, col);
      }
    });
    this.look = { skin: SKINS[this.idx.skin], hair: HAIRS[this.idx.hair], hairStyle: STYLES[this.idx.style], shirt: SHIRTS[this.idx.shirt], pants: PANTS[this.idx.pants], accent: C.rose };
    setPlayerLook(this.look);
    // preview (re-register clears cache by using a unique id)
    const pid = 'preview_' + [this.idx.skin, this.idx.hair, this.idx.style, this.idx.shirt, this.idx.pants].join('_');
    registerLook(pid, this.look);
    const dir = Math.floor(this.t * 0.8) % 4;
    const frame = Math.floor(this.t * 6) % 4;
    const px = x + 292, py = y + 110;
    ui.panel(px - 30, py - 50, 60, 76, 'inset', false);
    try {
      const { sprite } = require_atlas();
      const s = sprite(`ch:${pid}:${dir === 3 ? 1 : dir}:${frame}`);
      ui.ctx.save();
      if (dir === 3) {
        ui.ctx.translate(px, 0);
        ui.ctx.scale(-1, 1);
        ui.ctx.drawImage(s.img, s.x, s.y, s.w, s.h, -16, py - 40, 32, 48);
      } else ui.ctx.drawImage(s.img, s.x, s.y, s.w, s.h, px - 16, py - 40, 32, 48);
      ui.ctx.restore();
    } catch {
      /* look not registered yet */
    }
    const ok = this.name.trim().length > 0 && this.farm.trim().length > 0;
    if (ui.button('begin', x + w - 110, y + h - 28, 96, 20, 'Begin!', { style: 'green', disabled: !ok, tip: ok ? 'Start your first spring' : 'Enter your name and farm name' })) {
      const g = new Game({ name: this.name.trim(), farmName: this.farm.trim(), favorite: this.fav.trim() || 'Tea' });
      this.app.startGame(g, this.look);
    }
    if (ui.button('back', x + 14, y + h - 28, 60, 20, 'Back')) return 'back';
    return null;
  }
}

import * as atlas from '../render/atlas';
function require_atlas() {
  return atlas;
}
