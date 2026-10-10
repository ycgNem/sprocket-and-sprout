// The in-game screen: input -> sim commands, camera, build tools, HUD + windows, events -> juice.
import { quickStack } from '../sim/quickstack';
import { pendingPerk } from '../sim/perks';
import { canPlaceDecor, placeDecor } from '../sim/systems/house';
import { FURN_BY_ID } from '../data/furniture';
import { petAt, petHearts } from '../sim/systems/pet';
import { C, PALETTE, rgba } from '../data/palette';
import { STRUCT_BY_ID } from '../data/structures';
import { NPC_BY_ID } from '../data/npcs';
import { ICON } from '../ui/font';
import { ITEM_BY_ID, matchesSpec } from '../data/items';
import type { NPCLook } from '../data/types';
import { SEC_PER_MIN, type Game, type GameEvent } from '../sim/Game';
import { DX, DY, Dir, Ent } from '../sim/ents';
import { key, kDef, kId, itemName } from '../sim/inventory';
import { canPlace, deconstruct, place, rotateStruct, structFootprint } from '../sim/build';
import { eatHeld, interact, useHeld } from '../sim/actions';
import { facingTile, curMap } from '../sim/systems/player';
import { saveGame, freeSlot, exportSaveJSON } from '../sim/save';
import { drawSprite, sprite } from '../render/atlas';
import { TILE } from '../render/art/terrain';
import { structSize } from '../render/art/structs';
import { drawHud, HudState, toastLife } from '../ui/hud';
import { drawLessonCard, queueLesson, type LessonQueue } from '../ui/lessoncard';
import { lesson } from '../sim/lessons';
import { WINDOWS, WinState } from '../ui/windows';
import '../ui/windows/all';
import { Blueprint, copyBlueprint, pasteBlueprint, rotateBlueprint, blueprintCost } from '../sim/blueprint';
import type { App, Screen } from './app';
import { unlockAch } from '../sim/systems/achievements';
import { drawAchBanner, AchBanner } from '../ui/windows/achievements';
import { recordAch } from './profile';
import { OPENING } from '../sim/systems/modes';
import { RIVER } from '../sim/opening';
import { O, T } from '../sim/world/tilemap';
import { MState } from '../sim/mstate';
import { isSpringArm, isWindable, windArm } from '../sim/systems/arms';
import { structRateLine, structStateLine } from '../ui/statelines';
import { WorksView } from './worksview';
import { PULSE_COL, pulseEnts, pulseOf } from '../ui/pulse';
import { checkTips } from './tips';
import { drawFx, Juice, ladderPitch, RIBBON_Y, type Pt } from '../render/juice';
import { ACH_BY_ID } from '../sim/systems/achievements';
import { promptAt, questTarget, toolVerb } from '../sim/prompts';
import { POST_TIMES } from '../sim/systems/economy';
import { quote } from '../sim/systems/economy';
import { unlocksOf } from '../sim/systems/research';
import { RESEARCH, ERA_NAMES } from '../data/research';
import { DEBUG_KEYS, keyLabel } from '../engine/input';
import { textWidth } from '../ui/font';

export interface Toast { text: string; t: number; icon?: string; color?: number }

const KONAMI = 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,KeyB,KeyA';
/** how long a placement can be taken back with Ctrl+Z (real seconds) */
const UNDO_SECS = 10;

export class PlayScreen implements Screen {
  app: App;
  g: Game;
  look: NPCLook;
  slot: number;
  hud: HudState = { pickups: [], toasts: [] };
  achQ: AchBanner[] = [];
  private keyTrail: string[] = [];
  private zoomSeen = { min: false, max: false };
  win: WinState | null = null;
  rot: Dir = 0;
  drag: { x: number; y: number } | null = null;
  mode: 'normal' | 'decon' | 'copy' | 'paste' = 'normal';
  rectStart: { x: number; y: number } | null = null;
  blueprint: Blueprint | null = null;
  charge = 0;
  chargeT = 0;
  holdT = 0;
  stepT = 0;
  lastTarget: [number, number] = [0, 0];
  saveMsg = '';
  sleepFade = 0;
  debug = false;
  autoBuildT = 0;
  playtime = 0;
  /** the mouse is on a tile just out of tool reach (red outline, no action) */
  outOfReach = false;
  /** factory pulse: highlight machines in one state for a few seconds */
  pulseFocus: { kind: 'ok' | 'starved' | 'blocked' | 'power'; t: number } | null = null;
  /** the works seen from here: inspector, state sounds, fix ping, chest fill bars */
  works = new WorksView();
  /** lesson cards waiting to show (src/ui/lessoncard.ts) */
  lessons: LessonQueue = { q: [] };
  /** your last placements (one drag each), taken back with Ctrl+Z within UNDO_SECS (ROADMAP.md 6.5) */
  private undoStack: { ids: number[]; t: number }[] = [];
  private lastWhere = '';
  tipT = 0;
  /** money last frame: a rise while you play becomes a coin shower into the odometer */
  private lastMoney = 0;
  /** where this frame's coin shower starts (UI px), if an event said so */
  private coinSrc: Pt | null = null;
  /** seconds the next coin shower waits (the courier grabbing the parcel) */
  private coinWait = 0;

  constructor(app: App, g: Game, look: NPCLook, slot?: number) {
    this.app = app;
    this.g = g;
    this.look = look;
    this.slot = slot ?? (g as any).__slot ?? freeSlot();
    const r = app.renderer;
    r.cam.x = g.player.x;
    r.cam.y = g.player.y - 0.5;
    r.cam.targetZoom = r.cam.zoom = Math.max(2, Math.round(r.H / (16 * 20)));
    app.audio.setScene('farm');
    g.sys.ui = this;
    r.juice.sfx = (id, v, p) => app.audio.sfx(id, v, p);
    r.ambient.onRustle = () => app.audio.sfx('rustle', 0.3);
    this.lastMoney = Math.floor(g.player.money);
    (window as any).__game = g;
    (window as any).__play = this;
    g.sys.onStart?.forEach?.((f: any) => f(g));
  }

  /** R: rotate the blueprint, the held structure, or the structure under the mouse */
  rotateAction() {
    const g = this.g;
    if (this.mode === 'paste' && this.blueprint) this.blueprint = rotateBlueprint(this.blueprint);
    else if (this.heldPlaceable()) {
      this.rot = ((this.rot + 1) & 3) as Dir;
      this.app.audio.sfx('rotate');
    } else {
      const t = this.mouseTile();
      const e = g.player.where === 'world' ? g.ents.at(t.x, t.y) : null;
      if (e) {
        rotateStruct(g, e);
        this.works.changed(g, t.x, t.y);
        // easter egg: spin one structure 20 times in quick succession
        const now = this.playtime;
        if (this.spin.id !== e.id || now - this.spin.t > 10) this.spin = { id: e.id, n: 0, t: now };
        if (++this.spin.n >= 20) unlockAch(g, 'spin');
      }
    }
  }
  private spin = { id: 0, n: 0, t: 0 };

  cursorKind() {
    if (this.app.ui.overUI) return 'arrow' as const;
    if (this.mode !== 'normal' || (!this.win && this.heldPlaceable())) return 'build' as const;
    return 'arrow' as const;
  }

  get paused() {
    return !!this.win && (this.win.pause ?? true) && this.app.settings.pauseInMenus;
  }

  tick() {
    const g = this.g;
    g.paused = this.paused && !g.sleeping;
    g.tick();
  }

  /** a window that takes over the screen is open (non-modal ones, like the fade, don't count) */
  get modalOpen(): boolean {
    return !!this.win && (WINDOWS[this.win.id]?.modal ?? true);
  }

  openWindow(id: string, arg?: any) {
    const def = WINDOWS[id];
    if (!def) return;
    this.win = { id, arg, t: 0, pause: def.pause ?? true, data: {} };
    this.app.audio.sfx('open');
    this.drag = null;
  }

  closeWindow() {
    if (!this.win) return;
    const def = WINDOWS[this.win.id];
    def?.onClose?.(this, this.win);
    // return a dragged stack to the inventory
    if (this.app.ui.hand) {
      const left = this.g.player.inv.add(this.app.ui.hand.k, this.app.ui.hand.n);
      if (left) this.g.sys.drops?.spawn?.(this.g, this.app.ui.hand.k, left, this.g.player.x, this.g.player.y);
      this.app.ui.hand = null;
    }
    this.win = null;
    this.app.audio.sfx('close');
  }

  save(silent = false) {
    const ok = saveGame(this.g, this.look, this.slot);
    if (!silent) this.toast(ok ? 'Game saved.' : 'Saving failed (storage full?)');
    return ok;
  }

  exportSave() {
    const txt = exportSaveJSON(this.g, this.look);
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sprocket-sprout-${this.g.player.farmName.replace(/\W+/g, '_')}-y${this.g.time.year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  toast(text: string, icon?: string, color?: number) {
    // several quests starting at once read as one line
    const NQ = 'New quest: ';
    if (text.startsWith(NQ)) {
      const prev = this.hud.toasts.find((t) => t.text.startsWith('New quest') && t.t < 1.5);
      if (prev) {
        prev.text = 'New quests: ' + prev.text.replace(/^New quests?: /, '') + ', ' + text.slice(NQ.length);
        prev.t = 0;
        return;
      }
    }
    const ex = this.hud.toasts.find((t) => t.text === text);
    if (ex) {
      ex.t = 0;
      return;
    }
    this.hud.toasts.push({ text, t: 0, icon, color });
    if (this.hud.toasts.length > 4) this.hud.toasts.shift();
  }

  /** player feet -> approx body center */
  private reachOk(tx: number, ty: number, r: number) {
    const p = this.g.player;
    return Math.hypot(tx + 0.5 - p.x, ty + 0.5 - (p.y - 0.3)) <= r;
  }

  mouseTile(): { x: number; y: number; fx: number; fy: number } {
    const app = this.app;
    const m = app.input.mouse;
    const t = app.renderer.screenToTile(m.x * app.dpr, m.y * app.dpr);
    return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y };
  }

  /** day the profession prompt was dismissed */
  perkSnooze = -1;

  heldPlaceable(): string | null {
    const st = this.g.player.inv.slots[this.g.player.sel];
    if (!st || this.g.player.where !== 'world') return null;
    const d = kDef(st.k);
    return d.places ?? null;
  }

  frame(dt: number) {
    const app = this.app, g = this.g, input = app.input, r = app.renderer, ui = app.ui;
    this.playtime += dt;
    // building is a planning activity: the clock slows to a quarter while you do it
    g.slowClock = g.player.where === 'world' && !!(this.mode !== 'normal' || (!this.win && this.heldPlaceable()) || this.win?.id === 'struct');
    // tips belong to the scene they were shown in
    if (g.player.where !== this.lastWhere) {
      this.lastWhere = g.player.where;
      this.hud.toasts = this.hud.toasts.filter((t) => !t.text.startsWith('Tip:'));
    }
    if (this.pulseFocus && (this.pulseFocus.t -= dt) <= 0) this.pulseFocus = null;
    // ---- sleeping fast-forward ----
    if (g.sleeping) {
      if (app.settings.overnight === 'full') {
        if (!app.loop.fastForward) app.loop.fastForward = () => g.sleeping;
      } else {
        // skipping the night still runs the works from bedtime to 2am (the night shift follows),
        // so both overnight settings make the same goods
        g.runWorks(Math.max(0, 1560 - g.time.min) * SEC_PER_MIN);
        g.time.min = 1560;
        g.endDay(false);
      }
      this.sleepFade = Math.min(1, this.sleepFade + dt * 2);
    } else this.sleepFade = Math.max(0, this.sleepFade - dt * 1.5);

    // ---- movement intent ----
    const modal = this.modalOpen;
    let mx = 0, my = 0;
    if (!modal && !g.sleeping) {
      if (input.isDown('left')) mx -= 1;
      if (input.isDown('right')) mx += 1;
      if (input.isDown('up')) my -= 1;
      if (input.isDown('down')) my += 1;
    }
    g.moveX = mx;
    g.moveY = my;
    g.walkSlow = input.isDown('run');
    // footsteps
    if (g.player.moving) {
      this.stepT += dt * (g.walkSlow ? 2.5 : 4);
      if (this.stepT > 1) {
        this.stepT = 0;
        const cm = curMap(g), ptx = Math.floor(g.player.x), pty = Math.floor(g.player.y);
        const t = cm.g(ptx, pty);
        const ob = cm.o(ptx, pty);
        // weeds and twigs are walkable: wading through them rustles
        if (ob === O.WEED || ob === O.TALLGRASS || ob === O.TWIG) {
          app.audio.sfx('rustle', 0.5);
          r.particles.burst(g.player.x * 16, g.player.y * 16, 2, [C.leaf, C.moss], { speed: 12, up: 8, g: 30, life: 0.4, size: 1 });
        } else app.audio.sfx(t === 7 || t === 21 ? 'step_wood' : t === 6 || t === 9 ? 'step_stone' : 'step', 0.6);
        if (t === 2 || t === 3 || t === 6 || t === 13) r.particles.burst(g.player.x * 16, g.player.y * 16, 2, [C.tan, C.pebble], { speed: 10, up: 6, g: 20, life: 0.35, size: 1 });
      }
    }

    // ---- camera ----
    const p = g.player;
    let camX = p.x, camY = p.y - 0.6;
    if (p.where === 'house') {
      // the room is small: frame it, following the player only when zoomed in
      const hm = curMap(g);
      const vw = r.W / (16 * r.cam.zoom), vh = r.H / (16 * r.cam.zoom);
      camX = hm.w <= vw - 1 ? hm.w / 2 : Math.max(vw / 2 - 0.5, Math.min(hm.w - vw / 2 + 0.5, camX));
      camY = hm.h <= vh - 1 ? hm.h / 2 - 0.4 : Math.max(vh / 2 - 1.5, Math.min(hm.h - vh / 2 + 0.5, camY));
    }
    r.cam.follow(camX, camY, dt, Math.hypot(r.cam.x - camX, r.cam.y - camY) > 24);
    if (!modal && (input.wasPressed('zoomIn') || (input.ctrl && input.mouse.wheel < 0))) r.cam.targetZoom = Math.min(6, r.cam.targetZoom + 1);
    if (!modal && (input.wasPressed('zoomOut') || (input.ctrl && input.mouse.wheel > 0))) r.cam.targetZoom = Math.max(1, r.cam.targetZoom - 1);
    if (input.ctrl) input.mouse.wheel = 0;
    if (r.cam.targetZoom <= 1) this.zoomSeen.min = true;
    if (r.cam.targetZoom >= 6) this.zoomSeen.max = true;
    if (this.zoomSeen.min && this.zoomSeen.max) unlockAch(g, 'birdseye');

    // ---- world draw ----
    r.shakeOn = app.settings.screenShake;
    this.worldOverlays();
    r.draw(g, dt);
    if (this.sleepFade > 0) {
      r.ctx.setTransform(1, 0, 0, 1, 0, 0);
      r.ctx.fillStyle = rgba(C.ink, this.sleepFade * 0.92);
      r.ctx.fillRect(0, 0, r.W, r.H);
    }

    // ---- events ----
    this.processEvents(g.events);
    this.works.update(this, dt);
    if (!this.win && g.sys.mode?.showResult) this.openWindow('rush');
    g.events.length = 0;

    // ---- UI ----
    ui.begin(r.ctx, input, app.uiScale, dt);
    // a modal window owns the screen: the HUD would only peek out around its edges
    if (!this.modalOpen) drawHud(ui, this, dt);
    drawLessonCard(ui, this, dt);
    this.drawPrompt(ui, dt);
    if (!this.modalOpen) this.works.labels(this, ui, this.hoverEnt());
    if (!this.modalOpen && !ui.overUI) this.noticeLooked(this.hoverEnt());
    this.drawPostTimer(ui);
    this.drawCompass(ui);
    this.worldHover(ui);
    if (this.win) {
      this.win.t += dt;
      const def = WINDOWS[this.win.id];
      const pop = Math.min(1, this.win.t / 0.12);
      if (pop < 1 && def?.modal !== false) {
        // windows rise into place by whole pixels and fade in (no fractional scaling)
        ui.ctx.save();
        ui.ctx.translate(0, Math.round((1 - pop) * 8));
        ui.ctx.globalAlpha = 0.4 + 0.6 * pop;
      }
      const keep = def ? def.draw(ui, this, this.win) : false;
      if (pop < 1 && def?.modal !== false) ui.ctx.restore();
      if (!keep) this.closeWindow();
    }
    // flights into the HUD, the streak counter, banners and confetti ride on top (the streak and
    // banners wait while a window is open; the night tally's confetti shows over it)
    r.juice.drawUI(ui, this.toUI(g.player.x, g.player.y - 1.9), this.modalOpen, dt);
    if (g.sleeping || this.sleepFade > 0.5) {
      ui.text('Z z z', ui.w / 2, ui.h / 2 - 20, C.cream, { align: 'center', scale: 3 });
      const h = Math.floor(g.time.min / 60) % 24, mm = Math.floor(g.time.min % 60 / 10) * 10;
      ui.text(`${((h + 11) % 12) + 1}:${mm.toString().padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`, ui.w / 2, ui.h / 2 + 12, C.pebble, { align: 'center' });
      if (g.sleeping) ui.text('The farm hums through the night...', ui.w / 2, ui.h / 2 + 26, C.pebble, { align: 'center' });
    }
    // like toasts, the banner waits for the window to close rather than covering its title
    if (!this.modalOpen && !r.juice.banners.length) this.achQ = drawAchBanner(ui, this.achQ, dt);
    if (this.debug) WINDOWS.debug?.draw(ui, this, { id: 'debug', t: 0, data: {} });
    ui.end();

    // ---- input (world) ----
    if (!g.sleeping) this.handleKeys();
    if (!modal && !ui.overUI && !g.sleeping) this.handleWorldMouse(dt);
    else this.drag = null;

    // ---- audio ----
    let near = 0;
    if (g.player.where === 'world') {
      for (const e of g.ents.machines) if (e.working && Math.abs(e.x - p.x) < 12 && Math.abs(e.y - p.y) < 9) near++;
      for (const e of g.ents.arms) if (e.working && Math.abs(e.x - p.x) < 10 && Math.abs(e.y - p.y) < 8) near += 0.3;
      // loaded belts add to the hum, so a busy line sounds busy
      let carried = 0;
      for (const e of g.ents.belts) if (e.belt && Math.abs(e.x - p.x) < 10 && Math.abs(e.y - p.y) < 8) carried += e.belt.lanes[0].k.length + e.belt.lanes[1].k.length;
      near += Math.min(4, carried * 0.06);
    }
    const fest = g.sys.festivals?.active;
    app.audio.setScene(g.player.where === 'mine' ? 'mine' : g.player.where === 'house' ? 'home' : fest ? 'festival' : 'farm');
    app.audio.update(dt, g, near);
    // hud timers
    // toasts wait while a window covers the screen, then play out once it closes
    if (!this.modalOpen && !r.juice.banners.length) for (const t of this.hud.toasts) t.t += dt;
    this.hud.toasts = this.hud.toasts.filter((t) => t.t < toastLife(t.text));
    this.tipT += dt;
    if (this.tipT > 0.5) {
      this.tipT = 0;
      checkTips(this);
    }
    for (const pk of this.hud.pickups) pk.t += dt;
    this.hud.pickups = this.hud.pickups.filter((pk) => pk.t < 3);
    // Founder's Day review on the first morning of each new year
    if (!this.win && !g.sleeping && g.flags.has('eval_pending')) this.openWindow('evaluation');
    // a new profession to choose (asks again tomorrow if you close it)
    if (!this.win && !g.sleeping && this.perkSnooze !== g.dayIndex && !g.sys.fishing?.busy && g.tickN % 30 === 0 && pendingPerk(g)) this.openWindow('perk');
    // auto-build ghosts with your own inventory when close (tinker's satchel)
    this.autoBuildT += dt;
    if (this.autoBuildT > 0.25) {
      this.autoBuildT = 0;
      this.autoBuildGhosts();
    }
  }

  private promptKey = '';
  private promptT = 0;

  /**
   * The key bubble: whatever the interact key would do on the tile you face ("F Enter",
   * "F Harvest"), and, for the first few days, what a left click does with the tool in hand.
   */
  private drawPrompt(ui: any, dt: number) {
    const g = this.g;
    // a running harvest streak owns the space over your head; the bubble comes back when it fades
    const streak = this.app.renderer.juice.streak;
    if (this.win || g.sleeping || this.mode !== 'normal' || this.heldPlaceable() || g.sys.fishing?.busy || !this.app.settings.keyPrompts || (streak.n >= 3 && streak.t < 1.8) || this.app.renderer.juice.banners.length) {
      this.promptKey = '';
      return;
    }
    const [fx, fy] = facingTile(g);
    let pr = promptAt(g, fx, fy);
    let key = keyLabel(this.app.input.binds.interact[0] ?? 'KeyF');
    if (!pr && g.daysPlayed < 3 && !this.outOfReach) {
      const [tx, ty] = this.lastTarget;
      const verb = toolVerb(g, tx, ty);
      if (verb) {
        // tool hints hang below the tile, clear of the player's head
        pr = { verb, x: tx + 0.5, y: ty + 1.05 };
        key = 'Click';
      }
    }
    if (!pr) {
      this.promptKey = '';
      return;
    }
    const id = key + pr.verb + Math.round(pr.x) + ',' + Math.round(pr.y);
    if (id !== this.promptKey) {
      this.promptKey = id;
      this.promptT = 0;
    }
    this.promptT += dt;
    // facing down, the thing is under the player's feet: the bubble hangs below it instead
    const facingDown = key !== 'Click' && g.player.dir === 2;
    const at = this.toUI(pr.x, facingDown ? Math.max(pr.y, fy) + 1.05 : pr.y);
    const kw = textWidth(key) + 6, vw = textWidth(pr.verb);
    const w = Math.max(kw + vw + 10, pr.hint ? textWidth(pr.hint) + 8 : 0), h = pr.hint ? 24 : 15;
    let below = key === 'Click' || facingDown;
    // the two places the bubble can hang: under the thing, or over it (top edges, UI px)
    const belowY = Math.round((below ? at.y : this.toUI(pr.x, fy + 1.05).y) + 3);
    const aboveY = Math.round((facingDown ? this.toUI(pr.x, Math.min(pr.y, fy - 1.7)).y : key === 'Click' ? this.toUI(pr.x, pr.y - 1.15).y : at.y) - h - 6);
    // never over the hotbar and the held-item label: flip above the tile instead
    if (below && belowY + h > ui.h - 64) below = false;
    // never under the HUD (quest tracker, toasts, pickups): flip to the other side of the tile,
    // and if that's covered too, slide sideways clear of whatever covers it
    const occ: { x: number; y: number; w: number; h: number }[] = this.hud.occupied ?? [];
    const hits = (bx: number, by: number) => occ.find((o) => bx < o.x + o.w + 2 && bx + w + 2 > o.x && by < o.y + o.h + 2 && by + h + 4 > o.y);
    let x = Math.round(at.x - w / 2);
    const cover = hits(x, below ? belowY : aboveY);
    if (cover) {
      const flipY = below ? aboveY : belowY;
      if (!hits(x, flipY) && flipY > 2 && flipY + h < ui.h - 64) below = !below;
      else x = cover.x + cover.w / 2 < ui.w / 2 ? cover.x + cover.w + 4 : cover.x - w - 4;
    }
    const rise = this.promptT < 0.12 ? (below ? -2 : 2) : 0;
    const y = (below ? belowY : aboveY) + rise;
    const tailX = Math.max(x + 3, Math.min(x + w - 4, Math.round(at.x)));
    this.hud.occupied?.push({ x, y: y - 2, w, h: h + 4 });
    ui.ctx.globalAlpha = Math.min(1, this.promptT / 0.12);
    // bubble with a tail pointing at the thing
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 2, C.plum);
    ui.fill(x + 1, y + 1, w - 2, 1, C.slate);
    if (below) {
      ui.fill(tailX - 2, y - 1, 5, 1, C.ink);
      ui.fill(tailX - 1, y - 2, 3, 1, C.ink);
      ui.fill(tailX - 1, y - 1, 3, 1, C.plum);
    } else {
      ui.fill(tailX - 2, y + h, 5, 1, C.ink);
      ui.fill(tailX - 1, y + h + 1, 3, 1, C.ink);
      ui.fill(tailX - 1, y + h, 3, 1, C.plum);
    }
    // the key cap
    ui.fill(x + 3, y + 3, kw, 9, C.ink);
    ui.fill(x + 3, y + 2, kw, 9, C.cream);
    ui.fill(x + 3, y + 10, kw, 1, C.pebble);
    ui.text(key, x + 6, y + 3, C.ink);
    ui.text(pr.verb, x + kw + 7, y + 4, C.cream);
    if (pr.hint) ui.text(pr.hint, x + 4, y + 14, C.pebble);
    ui.ctx.globalAlpha = 1;
  }

  /** tooltips for things under the mouse in the world: villagers, animals, structures */
  private worldHover(ui: any) {
    // while Inspect is held, the line inspector's labels take the hover's place
    if (this.win || ui.overUI || this.g.sleeping || this.app.input.isDown('inspect')) return;
    const g = this.g;
    const t = this.mouseTile();
    const pt = petAt(g, t.fx, t.fy + 0.3);
    if (pt) {
      const h = petHearts(pt);
      ui.tip(pt.stage === 'stray'
        ? [{ text: `A stray ${pt.kind}`, color: C.amber }, { text: 'F or right-click to say hello', color: C.pebble }]
        : [{ text: pt.name, color: C.amber }, { text: `Your ${pt.kind}  ` + ICON.heart.repeat(h) + '.'.repeat(5 - h), color: C.rose }, { text: pt.petted ? 'Petted today' : 'F or right-click to pet', color: C.pebble }, { text: pt.bowlFull ? 'Water bowl is full' : 'Water bowl is empty (use the watering can)', color: pt.bowlFull ? C.aqua : C.pebble }]);
      return;
    }
    const bowl = g.sys.pet?.stage === 'adopted' && g.player.where === 'world' ? g.sys.pet.bowl : null;
    if (bowl && bowl[0] === t.x && bowl[1] === t.y) {
      ui.tip([{ text: `${g.sys.pet.name}'s water bowl`, color: C.amber }, { text: g.sys.pet.bowlFull ? 'Full of fresh water' : 'Empty. Use your watering can on it.', color: g.sys.pet.bowlFull ? C.aqua : C.pebble }]);
      return;
    }
    if (g.player.where === 'house') {
      const tip = g.sys.house?.hover?.(g, t.x, t.y);
      if (tip) ui.tip(tip);
      return;
    }
    if (g.player.where !== 'world') return;
    const n = g.sys.npcs?.at?.(g, t.fx, t.fy + 0.3);
    if (n) {
      const d = NPC_BY_ID.get(n.id)!;
      const h = Math.min(10, Math.floor(n.points / 250));
      ui.tip([{ text: d.name, color: C.amber }, { text: d.job, color: C.pebble }, { text: ICON.heart.repeat(Math.max(0, h)) + (h < 10 ? ' ' + Math.round(((n.points % 250) / 250) * 100) + '% to next heart' : ''), color: C.rose }, { text: n.talked ? 'You talked today' : 'F or right-click to chat (or give your held item)', color: C.pebble }]);
      return;
    }
    const a = g.sys.animals?.at?.(g, t.fx, t.fy + 0.3);
    if (a) {
      ui.tip([{ text: a.name, color: C.amber }, { text: a.petted ? 'Petted today' : 'F or right-click to pet', color: C.pebble }]);
      return;
    }
    if (g.player.where !== 'world') return;
    const e = g.ents.rootAt(t.x, t.y);
    if (e && !e.ghost) {
      const lines: { text: string; color?: number }[] = [{ text: e.def.name + (e.ghost ? ' (ghost)' : ''), color: C.amber }];
      // the machine contract's one line: what it's doing, or exactly what it waits for
      const sl = structStateLine(g, e);
      if (sl) lines.push(sl);
      const rt = structRateLine(g, e);
      if (rt) lines.push({ text: rt, color: C.pebble });
      if (e.gen) lines.push({ text: 'Output ' + Math.round(e.gen.out) + ' / ' + Math.round(e.gen.cap) + ' sparks', color: C.aqua });
      if (e.def.kind === 'belt' || e.def.kind === 'underground' || e.def.kind === 'splitter') {
        if (e.state === MState.Blocked) ui.tip(lines.slice(0, 3));
        return;
      }
      const ik = keyLabel(this.app.input.binds.inspect?.[0] ?? 'KeyI');
      // winding needs the key in reach (the same reach as the right-click)
      const windHint = this.reachOk(e.x, e.y, 2.6) || (e.w > 1 && this.reachOk(e.x + e.w - 1, e.y + e.h - 1, 2.6)) ? 'Right-click: wind it (2x for 30s)' : 'Walk up to it to wind it';
      lines.push({ text: isWindable(e) ? `${windHint}  F: open  ${ik}: inspect` : `F or right-click to open, hold ${ik} to inspect the line`, color: C.pebble });
      ui.tip(lines.slice(0, 6));
    }
  }

  private autoBuildGhosts() {
    const g = this.g;
    const p = g.player;
    if (p.where !== 'world') return;
    let built = 0;
    for (const e of g.ents.all()) {
      if (!e.ghost || e.parent || built >= 2) continue;
      if (Math.hypot(e.x + 0.5 - p.x, e.y + 0.5 - p.y) > 9 + g.mods.reach) continue;
      const k = key(e.def.item);
      if (p.inv.count(k) <= 0) continue;
      p.inv.remove(k, 1);
      g.ents.materialize(e);
      g.sys.afterMaterialize?.(g, e);
      g.emit({ t: 'fx', kind: 'dust', x: e.x + e.w / 2, y: e.y + e.h / 2 });
      built++;
    }
    if (built) this.app.audio.sfx('place', 0.5);
  }

  private handleKeys() {
    const input = this.app.input, g = this.g, ui = this.app.ui;
    // easter egg: the Konami code
    for (const code of input.pressed) {
      this.keyTrail.push(code);
      if (this.keyTrail.length > 10) this.keyTrail.shift();
    }
    if (this.keyTrail.join(',') === KONAMI) {
      this.keyTrail = [];
      if (unlockAch(g, 'konami')) {
        g.give(key('radish_seed'), 30);
        this.toast('Up, up, down, down... the valley grants you 30 extra lives. Well, radish seeds.', 'i:radish_seed', C.lavender);
      } else this.toast('The valley remembers. No more free radishes.', undefined, C.lavender);
      this.app.renderer.particles.burst(g.player.x * TILE, (g.player.y - 1) * TILE, 30, [C.rose, C.amber, C.leaf, C.sky, C.lavender], { speed: 90, up: 90, life: 1.4 });
    }
    if (input.wasPressed('pause')) {
      input.consume('pause');
      ui.focus = null;
      if (this.mode !== 'normal') {
        this.mode = 'normal';
        this.rectStart = null;
        return;
      }
      if (this.win) this.closeWindow();
      else this.openWindow('pause');
      return;
    }
    // typing into a text field (e.g. naming your pet) must not trigger shortcuts
    if (ui.focus) return;
    if (DEBUG_KEYS && input.wasPressed('debug')) this.debug = !this.debug;
    if (this.win && WINDOWS[this.win.id]?.modal !== false) {
      // window shortcuts toggle closed
      const map: Record<string, string> = { inventory: 'menu', craft: 'menu', research: 'research', stats: 'stats', journal: 'journal', map: 'map', achievements: 'achievements' };
      for (const [a, w] of Object.entries(map)) {
        if (!input.wasPressed(a as any)) continue;
        const tab = a === 'inventory' ? 'inventory' : a === 'craft' ? 'crafting' : undefined;
        if (this.win?.id === w && (!tab || this.win.data.tab === tab)) this.closeWindow();
        else if (this.win?.id === 'menu' && w === 'menu') this.win.data.tab = tab;
        else { this.closeWindow(); this.openWindow(w, tab); }
        input.consume(a as any);
        break;
      }
      return;
    }
    if (input.wasPressed('inventory')) this.openWindow('menu', 'inventory');
    if (input.wasPressed('craft')) this.openWindow('menu', 'crafting');
    if (input.wasPressed('research')) this.openWindow('research');
    if (input.wasPressed('stats')) this.openWindow('stats');
    if (input.wasPressed('journal')) this.openWindow('journal');
    if (input.wasPressed('map')) this.openWindow('map');
    if (input.wasPressed('achievements')) this.openWindow('achievements');
    for (let i = 0; i < 10; i++) if (input.wasPressed(('hot' + (i + 1)) as any)) g.player.sel = i;
    if (input.mouse.wheel && !ui.overUI) {
      g.player.sel = (g.player.sel + (input.mouse.wheel > 0 ? 1 : 11)) % 12;
      input.mouse.wheel = 0;
    }
    if (input.wasPressed('rotate')) this.rotateAction();
    if (input.wasPressed('eat')) eatHeld(g);
    if (input.wasPressed('stack')) {
      const r = quickStack(g);
      if (r.moved) {
        this.toast(`Stacked ${r.moved} item${r.moved > 1 ? 's' : ''} into ${r.chests} ${g.player.where === 'house' ? 'cellar' : r.chests > 1 ? 'chests' : 'chest'}.`);
        this.app.audio.sfx('insert');
      } else this.toast(g.player.where === 'house' && !g.sys.house?.pantry ? 'No root cellar to stack into.' : 'Nothing to stack: nearby chests hold none of your bag items.');
    }
    if (input.ctrl && input.pressed.has('KeyZ')) {
      input.consume('drop');
      this.undo();
    }
    if (input.wasPressed('pipette')) this.pipette();
    if (input.wasPressed('deconstruct')) {
      this.mode = this.mode === 'decon' ? 'normal' : 'decon';
      this.rectStart = null;
    }
    if (input.wasPressed('copy')) {
      this.mode = this.mode === 'copy' ? 'normal' : 'copy';
      this.rectStart = null;
    }
    if (input.wasPressed('paste')) {
      if (this.blueprint) this.mode = this.mode === 'paste' ? 'normal' : 'paste';
      else this.toast('Copy an area first with ' + 'V' + ' (drag a rectangle).');
    }
    if (input.wasPressed('drop')) {
      const st = g.player.inv.slots[g.player.sel];
      if (st && !kDef(st.k).tool) {
        g.sys.drops?.spawn?.(g, st.k, 1, g.player.x + DX[g.player.dir] * 1.2, g.player.y + DY[g.player.dir] * 1.2);
        g.player.inv.remove(st.k, 1);
        g.count('dropped');
        const gt = g.map.g(Math.floor(g.player.x + DX[g.player.dir] * 1.2), Math.floor(g.player.y + DY[g.player.dir] * 1.2));
        if (g.player.where === 'world' && (gt === T.OCEAN || gt === T.DEEP)) unlockAch(g, 'tide');
      }
    }
    if (input.wasPressed('interact')) {
      const [fx, fy] = facingTile(g);
      // Shift+F opens a structure's window instead of collecting and loading (to lock a recipe);
      // not while walking: Shift is also the walk-slowly key
      const walking = input.isDown('up') || input.isDown('down') || input.isDown('left') || input.isDown('right');
      const fe = input.shift && !walking && g.player.where === 'world' ? g.ents.rootAt(fx, fy) : null;
      if (fe && !fe.ghost && !fe.st.rust && (fe.mach || fe.inv || fe.arm || fe.gen || fe.def.kind === 'pole')) this.openWindow('struct', fe.id);
      else interact(g, fx, fy);
    }
    if (input.wasPressed('build')) this.openWindow(g.mode === 'sandbox' ? 'palette' : 'menu', 'crafting');
  }

  private pipette() {
    const g = this.g;
    const t = this.mouseTile();
    const e = g.player.where === 'world' ? g.ents.rootAt(t.x, t.y) : null;
    if (!e) return;
    const k = key(e.def.item);
    const inv = g.player.inv;
    const idx = inv.slots.findIndex((s) => s && s.k === k);
    if (idx < 0) {
      this.toast(`No ${e.def.name} in your bag.`);
      return;
    }
    if (idx < 10) g.player.sel = idx;
    else {
      // swap into the selected hotbar slot
      const a = inv.slots[g.player.sel];
      inv.slots[g.player.sel] = inv.slots[idx];
      inv.slots[idx] = a;
    }
    this.rot = e.rot;
  }

  /** belt drag line from start to current mouse tile */
  private dragLine(defId: string, sx: number, sy: number, ex: number, ey: number): { x: number; y: number; rot: Dir }[] {
    const def = STRUCT_BY_ID.get(defId)!;
    const dx = ex - sx, dy = ey - sy;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const n = horiz ? Math.abs(dx) : Math.abs(dy);
    const step = horiz ? Math.sign(dx) : Math.sign(dy);
    let rot = this.rot;
    if ((def.kind === 'belt') && n > 0) rot = (horiz ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0) as Dir;
    const [w, h] = def.size;
    const span = horiz ? (rot % 2 ? h : w) : rot % 2 ? w : h;
    const out: { x: number; y: number; rot: Dir }[] = [];
    for (let i = 0; i <= n; i += Math.max(1, span)) out.push({ x: horiz ? sx + i * step : sx, y: horiz ? sy : sy + i * step, rot });
    return out;
  }

  private handleWorldMouse(dt: number) {
    const app = this.app, g = this.g, input = app.input;
    const t = this.mouseTile();
    const p = g.player;
    const buildReach = 9 + g.mods.reach;
    if (p.where !== 'world' && this.mode !== 'normal') this.mode = 'normal';
    // rectangle tools
    if (this.mode === 'decon' || this.mode === 'copy') {
      if (input.mouse.pressed[0]) this.rectStart = { x: t.x, y: t.y };
      if (input.mouse.released[0] && this.rectStart) {
        const x0 = Math.min(this.rectStart.x, t.x), x1 = Math.max(this.rectStart.x, t.x);
        const y0 = Math.min(this.rectStart.y, t.y), y1 = Math.max(this.rectStart.y, t.y);
        if (this.mode === 'decon') {
          const seen = new Set<number>();
          let n = 0;
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
              const e = g.ents.rootAt(x, y);
              if (e && !seen.has(e.id)) {
                seen.add(e.id);
                if (deconstruct(g, e)) n++;
              }
            }
          if (n) this.toast(`Picked up ${n} structure${n > 1 ? 's' : ''}.`);
        } else {
          this.blueprint = copyBlueprint(g, x0, y0, x1, y1);
          if (this.blueprint.items.length) {
            this.mode = 'paste';
            this.toast(`Copied ${this.blueprint.items.length} structures. Click to paste, R to rotate.`);
          } else {
            this.mode = 'normal';
            this.toast('Nothing to copy there.');
          }
        }
        this.rectStart = null;
        if (this.mode === 'decon') this.mode = 'normal';
      }
      if (input.mouse.pressed[2]) {
        this.mode = 'normal';
        this.rectStart = null;
      }
      return;
    }
    if (this.mode === 'paste' && this.blueprint) {
      if (input.mouse.pressed[0]) {
        const res = pasteBlueprint(g, this.blueprint, t.x, t.y);
        this.toast(`Placed ${res.placed}, ${res.ghosts} waiting for parts (ghosts build when you carry the items).`);
        app.audio.sfx('place');
      }
      if (input.mouse.pressed[2]) this.mode = 'normal';
      return;
    }
    const placeable = this.heldPlaceable();
    if (placeable) {
      const def = STRUCT_BY_ID.get(placeable)!;
      // the Keeper's Line's arms snap onto their marked tile when you aim near it, and turn themselves
      const snap = this.armSnap(t);
      const tt = snap ? { ...t, x: snap.x, y: snap.y } : t;
      if (snap && snap.rot !== null && def.kind === 'arm') this.rot = snap.rot;
      if (input.mouse.pressed[0]) this.drag = { x: tt.x, y: tt.y };
      if (input.mouse.released[0] && this.drag) {
        const line = this.dragLine(placeable, this.drag.x, this.drag.y, tt.x, tt.y);
        let placed = 0;
        const ids: number[] = [];
        for (const L of line) {
          const st = p.inv.slots[p.sel];
          if (!st || kDef(st.k).places !== placeable) break;
          if (!this.reachOk(L.x, L.y, buildReach)) continue;
          if (!canPlace(g, placeable, L.x, L.y, L.rot).ok) continue;
          p.inv.remove(st.k, 1);
          ids.push(place(g, placeable, L.x, L.y, L.rot).id);
          this.works.changed(g, L.x, L.y);
          placed++;
          if (def.kind === 'belt') this.rot = L.rot;
        }
        if (!placed && line.length === 1) {
          const chk = canPlace(g, placeable, tt.x, tt.y, this.rot);
          if (!chk.ok) {
            this.toast(chk.reason ?? "Can't place that here.");
            app.audio.sfx('error');
          } else if (!this.reachOk(tt.x, tt.y, buildReach)) this.toast('Too far away.');
        }
        g.sys.quests?.notify?.(g, 'build', placed, placeable);
        if (ids.length) {
          this.undoStack.push({ ids, t: this.playtime });
          if (this.undoStack.length > 5) this.undoStack.shift();
          // the first thing you place by hand: undo exists
          lesson(g, 'undo');
        }
        this.drag = null;
      }
      if (input.mouse.pressed[2]) {
        const e = g.ents.rootAt(t.x, t.y);
        if (e) deconstruct(g, e);
        else interact(g, t.x, t.y);
      }
      return;
    }
    // tools & items
    const st = p.inv.slots[p.sel];
    const d = st ? kDef(st.k) : null;
    const toolReach = 1.9 + (d?.tool?.kind === 'rod' ? 50 : 0);
    let tx = t.x, ty = t.y;
    this.outOfReach = false;
    if (!this.reachOk(tx, ty, d?.tool || d?.weapon || d?.plant || d?.fertilizer ? toolReach : 2.3)) {
      // a near miss shows a red outline and does nothing; a far click works on the tile you face
      const near = Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - (p.y - 0.3)) <= 4.5;
      if (near && (d?.tool || d?.plant || d?.fertilizer) && !d?.weapon && d?.tool?.kind !== 'rod' && p.where === 'world') {
        this.outOfReach = true;
        this.holdT = 0;
        this.charge = 0;
        this.chargeT = 0;
      } else [tx, ty] = facingTile(g);
    }
    this.lastTarget = [tx, ty];
    const chargeable = d?.tool && (d.tool.kind === 'hoe' || d.tool.kind === 'can') && d.tool.tier > 0;
    if (d?.furniture && input.mouse.pressed[0]) {
      if (p.where === 'house') {
        const err = placeDecor(g, d.id, t.x, t.y);
        if (err) this.toast(err);
      } else this.toast('Furniture goes inside your farmhouse.');
      return;
    }
    const lmb = input.mouse.down[0] || input.mouse.pressed[0];
    if (lmb && !g.sys.fishing?.busy && !this.outOfReach) {
      if (chargeable) {
        this.chargeT += dt;
        this.charge = Math.min(d!.tool!.tier, Math.floor(this.chargeT / 0.45));
      } else {
        this.holdT -= dt;
        if (input.mouse.pressed[0] || this.holdT <= 0) {
          if (useHeld(g, tx, ty)) this.holdT = 0.36;
          else if (input.mouse.pressed[0] && d?.edible && (d.cat === 'food' || d.tags?.includes('drink'))) eatHeld(g);
          else this.holdT = 0.1;
        }
      }
    }
    if (input.mouse.released[0] || (input.mouse.pressed[0] && !input.mouse.down[0])) {
      if (chargeable && !this.outOfReach) {
        useHeld(g, tx, ty, this.charge);
        this.charge = 0;
        this.chargeT = 0;
      }
      g.sys.fishing?.release?.(g);
    }
    if (!lmb) this.holdT = 0;
    if (input.mouse.pressed[0]) g.sys.fishing?.press?.(g);
    if (input.mouse.pressed[2]) {
      let ix = t.x, iy = t.y;
      if (!this.reachOk(ix, iy, 2.6)) [ix, iy] = facingTile(g);
      // right-click on a spring arm or a gleaner turns its key (the winding verb); F opens its window
      const we = p.where === 'world' ? g.ents.rootAt(ix, iy) : null;
      if (we && !we.ghost && isWindable(we)) windArm(g, we);
      else if (!interact(g, ix, iy) && d?.edible) eatHeld(g);
    }
  }

  /** during "A Helping Hand", an arm held within a tile of the marked spot snaps onto it */
  /** Ctrl+Z: pick up your last placement (one drag) if it was within UNDO_SECS, with a full refund */
  private undo() {
    const g = this.g;
    while (this.undoStack.length && this.playtime - this.undoStack[this.undoStack.length - 1].t > UNDO_SECS) this.undoStack.pop();
    const last = this.undoStack.pop();
    if (!last) {
      this.toast(`Nothing to undo (Ctrl+Z takes back a placement within ${UNDO_SECS} seconds).`);
      return;
    }
    let n = 0, name = '';
    for (const id of last.ids) {
      const e = g.ents.get(id);
      if (!e || e.ghost) continue;
      name = e.def.name;
      if (deconstruct(g, e)) n++;
    }
    if (n) {
      this.toast(`Undone: picked up ${n > 1 ? n + ' ' : 'the '}${n > 1 ? name.toLowerCase() + 's' : name.toLowerCase()}.`);
      this.app.audio.sfx('pickup');
    }
  }

  /** a held arm within a tile of a marked arm tile snaps onto it (B3's also turns itself) */
  armSnap(t: { x: number; y: number }): { x: number; y: number; rot: Dir | null } | null {
    const held = this.heldPlaceable();
    if (!held || STRUCT_BY_ID.get(held)?.kind !== 'arm') return null;
    let best: { x: number; y: number; rot: Dir | null } | null = null, bd = 2;
    for (const s of this.armSlots()) {
      const d = Math.max(Math.abs(t.x - s.x), Math.abs(t.y - s.y));
      if (d < bd) [best, bd] = [s, d];
    }
    return best;
  }

  /**
   * The Keeper's Line's empty arm tiles: B3's chest -> jar turns itself (the first arm you place);
   * B6's (its chest -> the second jar, and its out-arm) only snap, so facing gets practised (R).
   */
  armSlots(): { x: number; y: number; rot: Dir | null }[] {
    const g = this.g;
    // only the slots the current step marks: in B6 the out-arm's slot sits one tile from where the
    // fix's third arm goes, and snapping there took the player's fix away (the 2.0 critic)
    const now = (g.sys.quests?.now?.(g, 1) ?? [])[0] as { id: string; index: number } | undefined;
    const step = now ? `${now.id}:${now.index}` : '';
    const out: { x: number; y: number; rot: Dir | null }[] = [];
    if (step === 'k3_hands:0') out.push({ x: OPENING.feedArm[0], y: OPENING.feedArm[1], rot: 0 });
    if (step === 'k6_bottleneck:1') out.push({ x: OPENING.jar2Feed[0], y: OPENING.jar2Feed[1], rot: null });
    if (step === 'k6_bottleneck:4') out.push({ x: OPENING.jar2Out[0], y: OPENING.jar2Out[1], rot: null });
    // B8: Bram's Brass Arms load the mill from the grain bin and empty it into the meal chest
    if (step === 'k8_river:3') out.push({ x: RIVER.binArm[0], y: RIVER.binArm[1], rot: 1 }, { x: RIVER.outArm[0], y: RIVER.outArm[1], rot: 1 });
    return out.filter((s) => !g.ents.at(s.x, s.y));
  }

  /** ghost preview, target highlight, area selection rectangles */
  private worldOverlays() {
    const r = this.app.renderer, g = this.g;
    if (this.win && WINDOWS[this.win.id]?.modal !== false) return;
    const t = this.mouseTile();
    const ctx = r.ctx;
    const grid = this.app.settings.showGrid;
    r.overlays.push(() => this.guideOverlays());
    r.overlays.push(() => {
      const he = this.hoverEnt();
      this.works.fillBar(ctx, he);
      this.works.overlay(this, ctx, he);
    });
    r.overlays.push(() => {
      const hs = g.player.inv.slots[g.player.sel];
      const hf = hs && g.player.where === 'house' ? FURN_BY_ID.get(kDef(hs.k).furniture ?? '') : null;
      if (hf) {
        // furniture ghost
        const ok = !canPlaceDecor(g, hf, t.x, t.y);
        ctx.globalAlpha = 0.6;
        drawSprite(ctx, sprite(`hf:${hf.sprite}:${g.time.season}`), t.x * TILE, t.y * TILE);
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(ok ? C.leaf : C.rose, 0.3);
        ctx.fillRect(t.x * TILE, t.y * TILE, hf.w * TILE, hf.h * TILE);
        return;
      }
      if (this.mode === 'decon' || this.mode === 'copy') {
        const col = this.mode === 'decon' ? C.rose : C.sky;
        const s = this.rectStart ?? t;
        const x0 = Math.min(s.x, t.x), x1 = Math.max(s.x, t.x), y0 = Math.min(s.y, t.y), y1 = Math.max(s.y, t.y);
        ctx.fillStyle = rgba(col, 0.25);
        ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
        ctx.strokeStyle = PALETTE[col];
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, (x1 - x0 + 1) * TILE - 1, (y1 - y0 + 1) * TILE - 1);
        return;
      }
      if (this.mode === 'paste' && this.blueprint) {
        const cost = blueprintCost(this.blueprint);
        for (const it of this.blueprint.items) {
          const ok = canPlace(g, it.def, t.x + it.dx, t.y + it.dy, it.rot, { ghostOk: true }).ok;
          this.drawGhostStruct(it.def, t.x + it.dx, t.y + it.dy, it.rot, ok);
        }
        void cost;
        return;
      }
      const placeable = this.heldPlaceable();
      if (placeable) {
        if (grid) this.drawGrid(t.x, t.y);
        const sn = this.armSnap(t) ?? t;
        const line = this.drag ? this.dragLine(placeable, this.drag.x, this.drag.y, sn.x, sn.y) : [{ x: sn.x, y: sn.y, rot: this.rot }];
        for (const L of line) {
          const chk = canPlace(g, placeable, L.x, L.y, L.rot);
          const inReach = this.reachOk(L.x, L.y, 9 + g.mods.reach);
          this.drawGhostStruct(placeable, L.x, L.y, L.rot, chk.ok && inReach);
        }
        this.drawPlacementHints(placeable, t.x, t.y);
        // an arm's take/drop squares show on hover while placing too (ROADMAP.md 4.4)
        const he = g.ents.rootAt(t.x, t.y);
        if (he && !he.ghost && (he.def.kind === 'arm' || he.def.kind === 'drill')) this.drawArmHint(he);
        return;
      }
      // tool target highlight
      const [tx, ty] = this.lastTarget;
      const st = g.player.inv.slots[g.player.sel];
      const d = st ? kDef(st.k) : null;
      ctx.strokeStyle = this.outOfReach ? rgba(C.rose, 0.9) : rgba(C.cream, 0.7);
      ctx.lineWidth = 1;
      if (d?.tool && (d.tool.kind === 'hoe' || d.tool.kind === 'can') && this.charge > 0 && !this.outOfReach) {
        const { toolArea } = require_actions();
        for (const [x, y] of toolArea(d.tool.kind, this.charge, tx, ty, g.player.dir)) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      } else if (g.player.where === 'world' || d) {
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      }
      // hover info for structures
      const e = g.player.where === 'world' ? g.ents.rootAt(t.x, t.y) : null;
      if (e && !e.ghost && (e.def.kind === 'arm' || e.def.kind === 'drill')) this.drawArmHint(e);
      if (e && !e.ghost && (e.def.kind === 'pole')) this.drawPoleArea(e);
    });
  }

  /** factory-pulse highlights and the opening's "do it here" markers */
  private guideOverlays() {
    const g = this.g, ctx = this.app.renderer.ctx;
    if (g.player.where !== 'world') return;
    const blink = 0.45 + 0.35 * Math.sin(this.playtime * 7);
    if (this.pulseFocus) {
      ctx.strokeStyle = rgba(PULSE_COL[this.pulseFocus.kind], blink + 0.2);
      ctx.lineWidth = 2;
      for (const e of pulseEnts(g)) {
        if (pulseOf(g, e) !== this.pulseFocus.kind) continue;
        ctx.strokeRect(e.x * TILE - 1, e.y * TILE - 1, e.w * TILE + 2, e.h * TILE + 2);
      }
      ctx.lineWidth = 1;
    }
    const q = g.sys.quests?.active as { id: string }[] | undefined;
    const has = (id: string) => !!q?.some((a) => a.id === id);
    const mark = (x: number, y: number, w = 1, h = 1) => {
      ctx.fillStyle = rgba(C.amber, blink * 0.35);
      ctx.fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
      ctx.strokeStyle = rgba(C.butter, blink + 0.3);
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE + 1, y * TILE + 1, w * TILE - 2, h * TILE - 2);
      ctx.lineWidth = 1;
      // the bouncing guide arrow (juice sheet; drawFx falls back to a code-drawn one); hidden
      // while you stand right at it, so it never draws over your legs
      const ax = x + w / 2, near = Math.abs(g.player.x - ax) < 1.2 && g.player.y > y - 0.6 && g.player.y < y + 1.4;
      const bob = Math.round(Math.sin(this.playtime * 5) * 2);
      if (!near) drawFx(ctx, 'fx:arrow', Math.floor(this.playtime * 8), ax * TILE, y * TILE - 3 + bob);
    };
    // the Keeper's Line marks where its current step happens (ROADMAP.md 6)
    const now = (g.sys.quests?.now?.(g, 1) ?? [])[0] as { id: string; index: number } | undefined;
    const at = (xy: [number, number]) => mark(xy[0], xy[1]);
    const free = (xy: [number, number]) => !g.ents.at(xy[0], xy[1]);
    const rusted = (xy: [number, number]) => !!g.ents.at(xy[0], xy[1])?.st.rust;
    const soilAt = (xy: [number, number]) => g.soil.get(g.map.idx(xy[0], xy[1]));
    switch (now ? `${now.id}:${now.index}` : '') {
      case 'k1_line:0': {
        const B = OPENING.beans;
        let ripe = false;
        for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) if (g.soil.get(g.map.idx(x, y))?.crop?.ready) ripe = true;
        if (ripe) mark(B.x, B.y, B.w, B.h);
        else at(OPENING.jar);
        break;
      }
      case 'k1_line:1':
        at(OPENING.jar);
        break;
      case 'k1_line:2': {
        // pickles in the bag go to the crate; otherwise take them from the jar
        const bin = g.ents.get(g.shipBinId);
        const carrying = g.player.inv.slots.some((s) => s && matchesSpec(kDef(s.k), '#preserve'));
        if (carrying && bin) mark(bin.x, bin.y);
        else at(OPENING.jar);
        break;
      }
      case 'k2_springs:1':
        if (rusted(OPENING.armTile)) at(OPENING.armTile);
        break;
      case 'k3_hands:0':
        if (free(OPENING.feedArm)) at(OPENING.feedArm);
        break;
      case 'k4_grow:0':
        for (const xy of OPENING.bed) if (!soilAt(xy)) at(xy);
        break;
      case 'k4_grow:1':
        for (const xy of OPENING.bed) if (soilAt(xy) && !soilAt(xy)!.crop) at(xy);
        break;
      case 'k4_grow:2':
        for (const xy of OPENING.bed) if (soilAt(xy)?.crop && !soilAt(xy)!.water) at(xy);
        break;
      case 'k4_grow:3':
        if (rusted(OPENING.gleaner)) at(OPENING.gleaner);
        break;
      case 'k5_desk:0':
      case 'k5_desk:2':
        mark(OPENING.desk[0], OPENING.desk[1], 2, 2);
        break;
      case 'k5_desk:3':
        mark(OPENING.belts[0][0], OPENING.belts[0][1], OPENING.belts.length, 1);
        break;
      case 'k5_desk:4':
        for (const xy of OPENING.belts) if (rusted(xy)) at(xy);
        break;
      case 'k5_desk:5':
        if (rusted(OPENING.gleanArm)) at(OPENING.gleanArm);
        break;
      case 'k6_bottleneck:0':
        if (g.player.inv.countId('jar') > 0 && free(OPENING.jar2)) at(OPENING.jar2);
        break;
      case 'k6_bottleneck:1':
        if (free(OPENING.jar2Chest)) at(OPENING.jar2Chest);
        if (free(OPENING.jar2Feed)) at(OPENING.jar2Feed);
        break;
      case 'k6_bottleneck:4':
        if (free(OPENING.jar2Out)) at(OPENING.jar2Out);
        for (const [x, y] of OPENING.jar2Belts) if (free([x, y])) mark(x, y);
        break;
      case 'k7_town:1': {
        // the crate, whose "Ship to" tag the post follows, until it's tagged
        const bin = g.ents.get(g.shipBinId);
        if (bin && !bin.st.tag) mark(bin.x, bin.y);
        break;
      }
      case 'k8_river:0': {
        // first a crock locked to oil (its window), then the crate tagged for the Smithy
        const oil = g.ents.machines.some((e) => e.def.id === 'jar' && e.mach?.locked && e.mach.recipe?.out[0].item === 'cogbean_oil');
        const bin = g.ents.get(g.shipBinId);
        if (!oil) at(g.ents.at(OPENING.jar2[0], OPENING.jar2[1]) ? OPENING.jar2 : OPENING.jar);
        else if (bin && bin.st.tag !== 'bram') mark(bin.x, bin.y);
        break;
      }
      case 'k8_river:1':
        if (rusted(RIVER.wheel)) mark(RIVER.wheel[0], RIVER.wheel[1], 2, 2);
        break;
      case 'k8_river:2':
        for (const xy of [...RIVER.poles, RIVER.bin]) if (rusted(xy)) at(xy);
        if (rusted(RIVER.mill)) mark(RIVER.mill[0], RIVER.mill[1], 2, 2);
        break;
      case 'k8_river:3':
        for (const xy of [RIVER.binArm, RIVER.outArm]) if (free(xy)) at(xy);
        break;
    }
    // a villager or place the quest wants you to reach, when it's on screen
    const tg = questTarget(g);
    if (tg && this.onScreenUI(this.toUI(tg.x, tg.y), this.app.ui)) {
      const bob = Math.round(Math.sin(this.playtime * 5) * 2);
      drawFx(ctx, 'fx:arrow', Math.floor(this.playtime * 8), tg.x * TILE, tg.y * TILE - 4 + bob);
    }
  }

  /** is a UI point inside the visible screen (with a margin)? */
  private onScreenUI(p: Pt, ui: { w: number; h: number }, m = 10) {
    return p.x > m && p.x < ui.w - m && p.y > m && p.y < ui.h - m;
  }

  /** the off-screen compass: a pointer at the screen edge toward the quest's villager or place */
  private drawCompass(ui: any) {
    const g = this.g;
    if (this.modalOpen) return;
    const tg = questTarget(g);
    if (!tg) return;
    const at = this.toUI(tg.x, tg.y);
    // on screen, the bobbing arrow over the target does the pointing, with a name tag over a
    // villager so "Talk to Prof. Cogwhistle" finds the right face in a crowd
    if (this.onScreenUI(at, ui)) {
      if (tg.npc) {
        const tw = textWidth(tg.label) + 8, th = 11;
        const tx = Math.round(at.x - tw / 2), ty = Math.round(at.y - 34);
        ui.fill(tx, ty, tw, th, C.ink, 0.85);
        ui.fill(tx + 1, ty + 1, tw - 2, 1, C.slate);
        ui.text(tg.label, tx + 4, ty + 3, C.butter);
      }
      return;
    }
    const cx = ui.w / 2, cy = ui.h / 2;
    const dx = at.x - cx, dy = at.y - cy;
    const w = textWidth(tg.label) + 22, h = 14;
    const k = Math.min((ui.w / 2 - w / 2 - 6) / Math.max(1, Math.abs(dx)), (ui.h / 2 - 12) / Math.max(1, Math.abs(dy)));
    let x = Math.round(cx + dx * k), y = Math.round(cy + dy * k);
    // steer around what the HUD drew this frame (tracker, toasts, pickups, right column, hotbar)
    const occ = this.hud.occupied ?? [];
    for (let pass = 0; pass < 4; pass++) {
      const hit = occ.find((o) => x + w / 2 + 2 > o.x && x - w / 2 - 2 < o.x + o.w && y + h / 2 + 2 > o.y && y - h / 2 - 2 < o.y + o.h);
      if (!hit) break;
      if (hit.y + hit.h / 2 < ui.h / 2) y = hit.y + hit.h + h / 2 + 3;
      else y = hit.y - h / 2 - 3;
    }
    y = Math.max(h / 2 + 2, Math.min(ui.h - 76, y));
    const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
    const dir = (Math.round((Math.atan2(dx, -dy) / (Math.PI * 2)) * 8) + 8) % 8;
    const bob = Math.round(Math.sin(this.playtime * 5) * 1.5);
    ui.fill(x0, y0, w, h, C.ink, 0.85);
    ui.fill(x0 + 1, y0 + 1, w - 2, 1, C.slate);
    drawFx(ui.ctx, 'fx:compass', dir, x0 + 8 + (dir === 1 || dir === 2 || dir === 3 ? bob : dir >= 5 ? -bob : 0), y0 + 7 + (dir === 3 || dir === 4 || dir === 5 ? bob : dir === 7 || dir === 0 || dir === 1 ? -bob : 0));
    ui.text(tg.label, x0 + 16, y0 + 4, C.cream);
  }

  /** a countdown over the shipping crate to the next post collection (noon, 6pm) */
  private drawPostTimer(ui: any) {
    const g = this.g;
    if (this.modalOpen || g.player.where !== 'world' || g.sleeping || this.app.renderer.juice.banners.length) return;
    const bin = g.ents.get(g.shipBinId);
    if (!bin) return;
    if (!this.onScreenUI(this.toUI(bin.x + 0.5, bin.y + 0.5), ui, 0)) return;
    const waiting = !!bin.inv && !bin.inv.isEmpty();
    const q = g.sys.quests?.active as { id: string }[] | undefined;
    if (!waiting && !q?.some((a) => a.id === 'k1_line' || a.id === 'k2_springs')) return;
    const next = POST_TIMES.find((t) => t > g.time.min);
    const left = next === undefined ? -1 : next - g.time.min;
    const label = left < 0 ? 'Post tonight' : left < 1 ? 'Post any second!' : `Post in ${left >= 60 ? Math.floor(left / 60) + 'h ' : ''}${Math.floor(left % 60)}m`;
    // beside the crate, on the side away from the player (its values pop up above it, the key
    // bubble sits over it)
    const w = textWidth(label) + 18, h = 13;
    const place = (onLeft: boolean) => {
      const at = this.toUI(onLeft ? bin.x : bin.x + bin.w, bin.y + 0.45);
      return { x: Math.round(onLeft ? at.x - 5 - w : at.x + 5), y: Math.round(at.y - h / 2) };
    };
    // never over the HUD (clock, factory pulse, tracker, hotbar): try the other side, else skip
    const occ = this.hud.occupied ?? [];
    const clear = (p: { x: number; y: number }) => p.x >= 2 && p.x + w <= ui.w - 2 && !occ.some((o) => p.x + w + 2 > o.x && p.x - 2 < o.x + o.w && p.y + h > o.y && p.y < o.y + o.h);
    let left2 = g.player.x > bin.x + bin.w / 2;
    if (!clear(place(left2))) left2 = !left2;
    const pos = place(left2);
    if (!clear(pos)) return;
    const { x, y } = pos;
    ui.fill(left2 ? x + w : x - 2, y + 4, 2, 5, C.ink);
    ui.fill(left2 ? x + w : x - 1, y + 5, 1, 3, C.walnut);
    ui.fill(x, y, w, h, C.ink);
    ui.fill(x + 1, y + 1, w - 2, h - 2, C.walnut);
    ui.fill(x + 1, y + 1, w - 2, 1, C.oak);
    // a little clock face
    ui.fill(x + 3, y + 3, 7, 7, C.cream);
    ui.fill(x + 6, y + 4, 1, 3, C.ink);
    ui.fill(x + 6, y + 6, 2, 1, C.ink);
    ui.text(label, x + 13, y + 3, left >= 0 && left < 30 ? C.butter : C.cream);
  }

  private drawGrid(cx: number, cy: number) {
    const ctx = this.app.renderer.ctx;
    ctx.fillStyle = rgba(C.cream, 0.12);
    for (let y = cy - 8; y <= cy + 8; y++) ctx.fillRect((cx - 8) * TILE, y * TILE, 17 * TILE, 1);
    for (let x = cx - 8; x <= cx + 8; x++) ctx.fillRect(x * TILE, (cy - 8) * TILE, 1, 17 * TILE);
  }

  drawGhostStruct(defId: string, x: number, y: number, rot: Dir, ok: boolean) {
    const ctx = this.app.renderer.ctx;
    const def = STRUCT_BY_ID.get(defId)!;
    ctx.globalAlpha = 0.6;
    if (def.kind === 'belt') drawSprite(ctx, sprite(`belt:${def.tier}:${rot}:0:0`), x * TILE, y * TILE);
    else if (def.kind === 'underground') drawSprite(ctx, sprite(`ug:${def.tier}:${rot}:1:0`), x * TILE, y * TILE);
    else if (def.kind === 'arm') {
      drawSprite(ctx, sprite(`armb:${def.id}`), x * TILE, y * TILE);
      // direction arrow
      ctx.fillStyle = PALETTE[C.amber];
      const ax = x * TILE + 8 + DX[rot] * 6, ay = y * TILE + 8 + DY[rot] * 6;
      ctx.fillRect(ax - 1, ay - 1, 3, 3);
    } else if (def.kind === 'splitter') {
      const box = sprite(`split:${def.tier}:0`);
      const ox = DX[(rot + 1) & 3] * 8, oy = DY[(rot + 1) & 3] * 8;
      ctx.save();
      ctx.translate(x * TILE + 8 + ox, y * TILE + 8 + oy);
      ctx.rotate((rot * Math.PI) / 2);
      ctx.drawImage(box.img, box.x, box.y, 32, 16, -16, -8, 32, 16);
      ctx.restore();
    } else drawSprite(ctx, sprite(`st:${defId}:0:0:${this.g.time.season}`), x * TILE, y * TILE);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(ok ? C.leaf : C.rose, 0.3);
    for (const t of structFootprint(def, x, y, def.rotatable ? rot : 0)) ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    if (def.kind === 'belt' || def.kind === 'underground' || def.kind === 'drill') {
      // flow arrow
      ctx.fillStyle = PALETTE[C.cream];
      const cx = x * TILE + 8, cy = y * TILE + 8;
      for (let i = 0; i < 3; i++) ctx.fillRect(cx + DX[rot] * (i * 2) - 1, cy + DY[rot] * (i * 2) - 1, 2, 2);
    }
    void structSize;
  }

  private drawPlacementHints(defId: string, x: number, y: number) {
    const def = STRUCT_BY_ID.get(defId)!;
    const ctx = this.app.renderer.ctx;
    if (def.kind === 'arm') {
      const reach = def.reach ?? 1;
      const px = x - DX[this.rot] * reach, py = y - DY[this.rot] * reach;
      const dx = x + DX[this.rot] * reach, dy = y + DY[this.rot] * reach;
      ctx.strokeStyle = PALETTE[C.leaf];
      ctx.strokeRect(px * TILE + 1.5, py * TILE + 1.5, TILE - 3, TILE - 3);
      ctx.strokeStyle = PALETTE[C.amber];
      ctx.strokeRect(dx * TILE + 1.5, dy * TILE + 1.5, TILE - 3, TILE - 3);
    }
    if (def.kind === 'pole' || def.kind === 'sprinkler' || def.kind === 'harvester' || def.kind === 'planter' || def.kind === 'scarecrow' || def.kind === 'hive') {
      const r = def.kind === 'pole' ? def.supply ?? 2 : def.kind === 'sprinkler' ? Math.max(1, def.reach ?? 0) : def.reach ?? 3;
      const [w, h] = def.size;
      ctx.fillStyle = rgba(def.kind === 'pole' ? C.sky : C.leaf, 0.14);
      ctx.fillRect((x - r) * TILE, (y - r) * TILE, (w + r * 2) * TILE, (h + r * 2) * TILE);
      if (def.kind === 'pole') {
        // show wire reach circle loosely + nearby poles
        for (const pole of this.g.ents.poles) {
          const dist = Math.hypot(pole.x - x, pole.y - y);
          if (dist <= Math.min(def.reach ?? 7, pole.def.reach ?? 7)) {
            ctx.fillStyle = rgba(C.copper, 0.8);
            for (let i = 0; i <= 10; i++) ctx.fillRect(((x + 0.5) + (pole.x - x) * (i / 10)) * TILE, ((y) + (pole.y - y) * (i / 10)) * TILE - 12, 1, 1);
          }
        }
      }
    }
  }

  private drawArmHint(e: Ent) {
    const ctx = this.app.renderer.ctx;
    if (e.arm) {
      const reach = e.arm.reach;
      ctx.strokeStyle = PALETTE[C.leaf];
      ctx.strokeRect((e.x - DX[e.rot] * reach) * TILE + 1.5, (e.y - DY[e.rot] * reach) * TILE + 1.5, TILE - 3, TILE - 3);
      ctx.strokeStyle = PALETTE[C.amber];
      ctx.strokeRect((e.x + DX[e.rot] * reach) * TILE + 1.5, (e.y + DY[e.rot] * reach) * TILE + 1.5, TILE - 3, TILE - 3);
    }
  }

  private drawPoleArea(e: Ent) {
    const ctx = this.app.renderer.ctx;
    const s = e.def.supply ?? 2;
    ctx.fillStyle = rgba(C.sky, 0.12);
    ctx.fillRect((e.x - s) * TILE, (e.y - s) * TILE, (e.w + s * 2) * TILE, (e.h + s * 2) * TILE);
  }

  /** the structure under the mouse in the world (null indoors, in windows or over UI) */
  hoverEnt(): Ent | null {
    if (this.g.player.where !== 'world' || (this.win && WINDOWS[this.win.id]?.modal !== false)) return null;
    const t = this.mouseTile();
    const e = this.g.ents.rootAt(t.x, t.y);
    return e && !e.ghost ? e : null;
  }

  /**
   * What you look at counts: a keystone's observe stage (hover a water wheel, the keeper's belt
   * run), and the Keeper's Line's B6 (a stopped machine read)
   */
  private noticeLooked(e: Ent | null) {
    if (!e) return;
    this.g.flags.add('observed:' + e.def.id);
    if (this.g.flags.has('keepers_line') && (e.state === MState.Starved || e.state === MState.Blocked)) this.g.flags.add('read:starved');
  }

  /** world tile coordinates -> UI px */
  toUI(tx: number, ty: number): Pt {
    const s = this.app.renderer.tileToScreen(tx, ty);
    return { x: s.x / this.app.uiScale, y: s.y / this.app.uiScale };
  }

  /** hotbar slot holding this item, or -1 when it went to the bag */
  private slotOf(k: number) {
    const i = this.g.player.inv.slots.findIndex((s) => s?.k === k);
    return i >= 0 && i < 12 ? i : -1;
  }

  processEvents(evs: GameEvent[]) {
    const r = this.app.renderer, a = this.app.audio, g = this.g;
    const P = r.particles, J = r.juice;
    const camX = r.cam.x, camY = r.cam.y;
    const onScreen = (x: number, y: number) => Math.abs(x - camX) < 16 && Math.abs(y - camY) < 10;
    for (const e of evs) {
      switch (e.t) {
        case 'harvest': {
          // the pick climbs a pentatonic ladder as the streak grows, the crop arcs into its slot
          const step = Math.min(e.streak - 1, 10);
          a.sfx('harvest', 1, ladderPitch(step));
          const from = this.toUI(e.x, e.y - 0.5);
          const slot = this.slotOf(e.k);
          const id = kId(e.k);
          for (let i = 0; i < Math.min(3, e.n); i++) J.flyItem(id, { x: from.x + i * 3, y: from.y }, slot, i * 0.07, i ? undefined : () => a.sfx('pickup', 0.4, ladderPitch(step)));
          J.streak.n = e.streak;
          J.streak.t = 0;
          J.streak.punch = 0;
          if (e.k & 3) J.fx('fx:glint', e.x * TILE, e.y * TILE - 8, { fps: 10 });
          if (e.bonus) {
            J.ring(e.x * TILE, e.y * TILE - 4, C.butter, 22);
            J.confetti(e.x * TILE, e.y * TILE - 8, 18);
            P.text(e.x * TILE, e.y * TILE - 16, 'Bonus!', C.butter);
            a.sfx('chime', 0.8);
          }
          break;
        }
        case 'lesson':
          queueLesson(this, e.id);
          a.sfx('chime', 0.4, 1.5);
          break;
        case 'restored': {
          // the rust lifts (src/render/renderer.ts drawRustFade), a dust puff and a sparkle
          r.restored.set(e.ent, r.time);
          P.burst(e.x * TILE, e.y * TILE, 14, [C.rust, C.walnut, C.tan], { speed: 40, up: 30, life: 0.6, size: 1 });
          J.fx('fx:glint', e.x * TILE, e.y * TILE - 8, { fps: 12 });
          J.ring(e.x * TILE, e.y * TILE, C.butter, 18);
          J.hop(e.ent);
          P.text(e.x * TILE, e.y * TILE - 14, 'Restored!', C.butter);
          break;
        }
        case 'made': {
          if (!onScreen(e.x, e.y) || g.player.where !== 'world') break;
          J.hop(e.ent);
          J.iconPop(e.item, e.x * TILE, e.y * TILE - 6);
          // every machine has its own note on the ladder, so a busy factory plays a little tune
          const d = Math.hypot(e.x - camX, e.y - camY);
          a.sfx('machine_done', Math.max(0, 0.6 - d / 24), ladderPitch(e.ent % 9));
          break;
        }
        case 'quest': {
          a.sfx('quest');
          J.banner({ title: 'Quest complete!', sub: e.title + (e.money ? `   ${ICON.coin}${e.money.toLocaleString()}` : ''), color: 29, items: e.items.map((it) => ({ id: it.item, n: it.n })) });
          const top: Pt = { x: this.app.ui.w / 2, y: RIBBON_Y + 26 };
          J.confetti(top.x, top.y, 46, true, 90);
          this.coinSrc = top;
          e.items.forEach((it, i) => J.flyItem(it.item, { x: top.x - 20 + i * 14, y: top.y + 6 }, this.slotOf(key(it.item)), 0.45 + i * 0.12));
          break;
        }
        case 'crated':
          // automation = coins: what the arm just shipped will fetch
          if (onScreen(e.x, e.y) && g.player.where === 'world') {
            // facing the crate, the key bubble sits over it: pop beside it instead
            const [fx, fy] = facingTile(g);
            const side = e.ent !== undefined && g.ents.rootAt(fx, fy)?.id === e.ent ? 20 : 0;
            // what the post will really pay: the same kind already in the crate ships first and saturates the price
            const crate = e.ent !== undefined ? g.ents.get(e.ent) : undefined;
            const ahead = crate?.inv ? Math.max(0, crate.inv.slots.reduce((a, s) => a + (s && s.k >> 2 === e.k >> 2 ? s.n : 0), 0) - e.n) : 0;
            J.pop('+' + quote(g, e.k, e.n, ahead), e.x * TILE + side, e.y * TILE - 2 + (side ? 10 : 0), C.amber, 2);
            J.fx('fx:glint', e.x * TILE + 4, e.y * TILE - 2, { fps: 12 });
            if (e.ent !== undefined) J.hop(e.ent);
          }
          break;
        case 'post': {
          // the brass courier lands on the crate and takes the parcel; the coins burst as it does
          const bin = g.ents.get(g.shipBinId);
          // (only when the crate is in view: nobody waits for a bird they can't see)
          if (bin && g.player.where === 'world' && this.onScreenUI(this.toUI(bin.x + 0.5, bin.y + 0.5), this.app.ui, 0)) {
            // on the crate's front corner, half over the grass, so the bird's shape reads
            J.courier((bin.x + bin.w) * TILE - 2, bin.y * TILE + 5);
            this.coinWait = Juice.COURIER_GRAB;
          }
          // the ribbon drops in once the courier has the parcel, so it doesn't hide the landing
          J.bannerNext({ title: `The ${e.label} post!`, sub: `${ICON.coin}${e.total.toLocaleString()} for your crate`, color: C.copper, items: [], wait: this.coinWait ? Juice.COURIER_GRAB + 0.3 : 0 });
          break;
        }
        case 'hop':
          if (e.tile !== undefined) J.hopTile(e.tile);
          if (e.ent !== undefined) J.hop(e.ent);
          break;
        case 'sfx': {
          let v = e.v ?? 1;
          if (e.x !== undefined && e.y !== undefined) v *= Math.max(0, 1 - Math.hypot(e.x - camX, e.y - camY) / 18);
          a.sfx(e.id, v);
          break;
        }
        case 'toast':
          this.toast(e.text, e.icon, e.color);
          break;
        case 'float':
          P.text(e.x * TILE, e.y * TILE - 8, e.text, e.c ?? C.cream);
          break;
        case 'shake':
          if (this.app.settings.screenShake) r.cam.shake = Math.max(r.cam.shake, e.amt);
          break;
        case 'pickup': {
          const ex = this.hud.pickups.find((pk) => pk.k === e.k && pk.t < 2);
          if (ex) {
            ex.n += e.n;
            ex.t = 0;
          } else this.hud.pickups.push({ k: e.k, n: e.n, t: 0 });
          if (this.hud.pickups.length > 5) this.hud.pickups.shift();
          break;
        }
        case 'fx': {
          const x = e.x * TILE, y = e.y * TILE;
          const n = e.n ?? 8;
          switch (e.kind) {
            case 'dust': P.burst(x, y, n, [C.tan, C.pebble], { speed: 30, up: 10, g: 40, life: 0.5 }); J.fx('fx:puff', x, y - 3, { fps: 12 }); break;
            case 'dirt': {
              // chunks in the colours of the ground that was hit, plus an impact star
              const gt = curMap(g).g(Math.floor(e.x), Math.floor(e.y));
              const cols = gt === T.SAND ? [C.tan, C.apricot, C.oak] : gt === T.GRASS ? [C.walnut, C.oak, C.grass, C.leaf] : [C.walnut, C.oak, C.bark];
              P.burst(x, y, n + 4, cols, { speed: 40, up: 50, life: 0.5 });
              J.fx('fx:star', x, y - 2, { fps: 18 });
              break;
            }
            case 'chips': P.burst(x, y - 8, n, [C.tan, C.oak, C.walnut], { speed: 50, up: 50, life: 0.5 }); J.fx('fx:star', x, y - 8, { fps: 18 }); break;
            case 'leaves': P.burst(x, y - 16, n, e.c !== undefined ? [e.c, C.leaf] : [C.leaf, C.grass, C.moss], { speed: 40, up: 20, g: 30, life: 1.2, size: 2 }); break;
            case 'rock': P.burst(x, y, n, [C.stone, C.pebble, C.slate], { speed: 55, up: 50, life: 0.5 }); J.fx('fx:star', x, y - 4, { fps: 18 }); break;
            case 'grass': P.burst(x, y, n, [C.grass, C.leaf, C.lime], { speed: 40, up: 30, life: 0.6 }); break;
            case 'splash': P.burst(x, y, n, [C.aqua, C.frost, C.sky], { speed: 35, up: 45, life: 0.5 }); break;
            case 'sparkle': for (let i = 0; i < 5; i++) P.sparkle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, e.c ?? C.butter); break;
            case 'seed': P.burst(x, y, 5, [C.tan, C.oak], { speed: 20, up: 25, life: 0.4 }); break;
            case 'puff': if (Math.random() < 0.5) P.smoke(x, y); break;
            case 'hearts':
              for (let i = 0; i < 3; i++) J.fx('fx:heart', x + (i - 1) * 7, y - 18 - i * 3, { vy: -16 - i * 4, life: 0.9, fps: 4, loop: true });
              break;
            case 'coins':
              P.burst(x, y, 10, [C.amber, C.brass, C.butter], { speed: 60, up: 60, life: 0.7 });
              this.coinSrc = this.toUI(e.x, e.y);
              break;
            case 'hit': P.burst(x, y - 8, n, [C.cream, C.rose], { speed: 70, up: 20, life: 0.3 }); J.fx('fx:star', x, y - 8, { fps: 18 }); break;
            case 'scroll': J.fx('fx:scroll', x, y, { fps: 9, life: 1.4 }); break;
            // the winding verb: a brass ring and a few sparks off the key
            case 'wind': J.ring(x, y - 4, C.brass, 12, 0.35); P.burst(x, y - 4, 4, [C.brass, C.butter], { speed: 30, up: 25, life: 0.35, size: 1 }); break;
            case 'magic': P.burst(x, y - 8, n, [C.lavender, C.aqua, C.cream], { speed: 40, up: 30, g: -20, life: 1 }); break;
            case 'treefall': if (e.s) r.ambient.treeFall(e.s, e.x, e.y, e.dir ?? 1); break;
            default: P.burst(x, y, n, [C.cream], {});
          }
          break;
        }
        case 'levelup': {
          this.toast(`${e.skill[0].toUpperCase() + e.skill.slice(1)} level ${e.level}!`, 'i:bundle_star', C.amber);
          a.sfx('levelup');
          const px = g.player.x * TILE, py = (g.player.y - 1) * TILE;
          J.ring(px, py, C.butter, 26, 0.6);
          J.ring(px, py, C.amber, 16, 0.4);
          J.confetti(px, py - 8, 26);
          break;
        }
        case 'research': {
          a.sfx('research');
          const def = RESEARCH.find((x) => x.id === e.id);
          const unl = unlocksOf(e.id).items.map((i) => ITEM_BY_ID.get(i)?.name ?? i);
          const sub = (def?.name ?? 'Research') + (unl.length ? '  -  new: ' + unl.slice(0, 2).join(', ') + (unl.length > 2 ? '...' : '') : '');
          J.banner({ title: 'Discovery!', sub, color: 50, items: [] });
          J.confetti(this.app.ui.w / 2, RIBBON_Y + 26, 40, true, 90);
          break;
        }
        case 'era': {
          // an era's town keystone is done: a banner, then the card with what the town gave back
          a.sfx('research');
          J.banner({ title: `The ${ERA_NAMES[e.era]} era`, sub: e.title, color: 50, items: [] });
          J.confetti(this.app.ui.w / 2, RIBBON_Y + 26, 60, true, 120);
          this.openWindow('message', { title: e.title, icon: 'clockwork_core', text: `The ${ERA_NAMES[e.era]} works are running, and the town notices. Its thanks, for good:\n\n${e.pieces.map((p) => '+ ' + p).join('\n')}\n\nThe research tree (T) names the next era's keystone.` });
          break;
        }
        case 'ach': {
          recordAch(e.id, g.player.farmName);
          // the first two days are busy enough: small (bronze, not secret) ones are a quiet toast
          const ad = ACH_BY_ID.get(e.id);
          if (ad && ad.tier === 1 && !ad.secret && g.daysPlayed < 2) {
            this.toast(`Achievement: ${ad.name}`, undefined, C.amber);
            break;
          }
          this.achQ.push({ id: e.id, t: 0 });
          a.sfx('levelup');
          P.burst(g.player.x * TILE, (g.player.y - 1.2) * TILE, 14, [C.butter, C.amber, C.cream], { speed: 60, up: 70, life: 0.9 });
          break;
        }
        case 'dayEnd':
          this.app.loop.fastForward = null;
          this.openWindow('summary', e.summary);
          break;
        case 'ui':
          this.openWindow(e.open, e.arg);
          break;
      }
    }
    // money that arrives while you play showers into the odometer as coins
    const money = Math.floor(g.player.money);
    const dm = money - this.lastMoney;
    this.lastMoney = money;
    if (dm > 0 && !this.modalOpen && !g.sleeping && this.sleepFade === 0) J.coins(this.coinSrc ?? this.toUI(g.player.x, g.player.y - 1.2), dm, this.coinWait);
    this.coinSrc = null;
    this.coinWait = 0;
  }
}

import * as actionsMod from '../sim/actions';
function require_actions() {
  return actionsMod;
}

export { itemName, kId };
