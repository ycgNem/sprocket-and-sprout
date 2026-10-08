// The in-game screen: input -> sim commands, camera, build tools, HUD + windows, events -> juice.
import { C, PALETTE, rgba } from '../data/palette';
import { STRUCT_BY_ID } from '../data/structures';
import type { NPCLook } from '../data/types';
import type { Game, GameEvent } from '../sim/Game';
import { DX, DY, Dir, Ent } from '../sim/ents';
import { key, kDef, kId, itemName } from '../sim/inventory';
import { canPlace, deconstruct, place, rotateStruct, structFootprint } from '../sim/build';
import { eatHeld, interact, useHeld } from '../sim/actions';
import { facingTile, curMap } from '../sim/systems/player';
import { saveGame, freeSlot, exportSaveJSON } from '../sim/save';
import { drawSprite, sprite } from '../render/atlas';
import { TILE } from '../render/art/terrain';
import { structSize } from '../render/art/structs';
import { drawHud, HudState } from '../ui/hud';
import { WINDOWS, WinState } from '../ui/windows';
import '../ui/windows/all';
import { Blueprint, copyBlueprint, pasteBlueprint, rotateBlueprint, blueprintCost } from '../sim/blueprint';
import type { App, Screen } from './app';

export interface Toast { text: string; t: number; icon?: string; color?: number }

export class PlayScreen implements Screen {
  app: App;
  g: Game;
  look: NPCLook;
  slot: number;
  hud: HudState = { pickups: [], toasts: [] };
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
    (window as any).__game = g;
    (window as any).__play = this;
    g.sys.onStart?.forEach?.((f: any) => f(g));
  }

  get paused() {
    return !!this.win && (this.win.pause ?? true) && this.app.settings.pauseInMenus;
  }

  tick() {
    const g = this.g;
    g.paused = this.paused && !g.sleeping;
    g.tick();
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
    this.hud.toasts.push({ text, t: 0, icon, color });
    if (this.hud.toasts.length > 6) this.hud.toasts.shift();
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

  heldPlaceable(): string | null {
    const st = this.g.player.inv.slots[this.g.player.sel];
    if (!st) return null;
    const d = kDef(st.k);
    return d.places ?? null;
  }

  frame(dt: number) {
    const app = this.app, g = this.g, input = app.input, r = app.renderer, ui = app.ui;
    this.playtime += dt;
    // ---- sleeping fast-forward ----
    if (g.sleeping) {
      if (app.settings.overnight === 'full') {
        if (!app.loop.fastForward) app.loop.fastForward = () => g.sleeping;
      } else {
        g.time.min = 1560;
        g.endDay(false);
      }
      this.sleepFade = Math.min(1, this.sleepFade + dt * 2);
    } else this.sleepFade = Math.max(0, this.sleepFade - dt * 1.5);

    // ---- movement intent ----
    const modal = !!this.win && (WINDOWS[this.win.id]?.modal ?? true);
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
        const t = curMap(g).g(Math.floor(g.player.x), Math.floor(g.player.y));
        app.audio.sfx(t === 7 ? 'step_wood' : t === 6 || t === 9 ? 'step_stone' : 'step', 0.6);
      }
    }

    // ---- camera ----
    const p = g.player;
    r.cam.follow(p.x, p.y - 0.6, dt, false);
    if (!modal && (input.wasPressed('zoomIn') || (input.ctrl && input.mouse.wheel < 0))) r.cam.targetZoom = Math.min(6, r.cam.targetZoom + 1);
    if (!modal && (input.wasPressed('zoomOut') || (input.ctrl && input.mouse.wheel > 0))) r.cam.targetZoom = Math.max(1, r.cam.targetZoom - 1);
    if (input.ctrl) input.mouse.wheel = 0;

    // ---- world draw ----
    this.worldOverlays();
    r.draw(g, dt);
    if (this.sleepFade > 0) {
      r.ctx.setTransform(1, 0, 0, 1, 0, 0);
      r.ctx.fillStyle = rgba(C.ink, this.sleepFade * 0.92);
      r.ctx.fillRect(0, 0, r.W, r.H);
    }

    // ---- events ----
    this.processEvents(g.events);
    g.events.length = 0;

    // ---- UI ----
    ui.begin(r.ctx, input, app.uiScale, dt);
    drawHud(ui, this, dt);
    if (this.win) {
      this.win.t += dt;
      const def = WINDOWS[this.win.id];
      const keep = def ? def.draw(ui, this, this.win) : false;
      if (!keep) this.closeWindow();
    }
    if (g.sleeping || this.sleepFade > 0.5) {
      ui.text('Z z z', ui.w / 2, ui.h / 2 - 20, C.cream, { align: 'center', scale: 3 });
      const h = Math.floor(g.time.min / 60) % 24, mm = Math.floor(g.time.min % 60 / 10) * 10;
      ui.text(`${((h + 11) % 12) + 1}:${mm.toString().padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`, ui.w / 2, ui.h / 2 + 12, C.pebble, { align: 'center' });
      if (g.sleeping) ui.text('The farm hums through the night...', ui.w / 2, ui.h / 2 + 26, C.pebble, { align: 'center' });
    }
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
    }
    const fest = g.sys.festivals?.active;
    app.audio.setScene(g.player.where === 'mine' ? 'mine' : fest ? 'festival' : 'farm');
    app.audio.update(dt, g, near);
    // hud timers
    for (const t of this.hud.toasts) t.t += dt;
    this.hud.toasts = this.hud.toasts.filter((t) => t.t < 4.5);
    for (const pk of this.hud.pickups) pk.t += dt;
    this.hud.pickups = this.hud.pickups.filter((pk) => pk.t < 3);
    // auto-build ghosts with your own inventory when close (tinker's satchel)
    this.autoBuildT += dt;
    if (this.autoBuildT > 0.25) {
      this.autoBuildT = 0;
      this.autoBuildGhosts();
    }
  }

  private autoBuildGhosts() {
    const g = this.g;
    const p = g.player;
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
    if (input.wasPressed('debug')) this.debug = !this.debug;
    if (input.wasPressed('pause')) {
      input.consume('pause');
      if (this.mode !== 'normal') {
        this.mode = 'normal';
        this.rectStart = null;
        return;
      }
      if (this.win) this.closeWindow();
      else this.openWindow('pause');
      return;
    }
    if (this.win && WINDOWS[this.win.id]?.modal !== false) {
      // window shortcuts toggle closed
      const map: Record<string, string> = { inventory: 'menu', craft: 'menu', research: 'research', stats: 'stats', journal: 'journal', map: 'map' };
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
    for (let i = 0; i < 10; i++) if (input.wasPressed(('hot' + (i + 1)) as any)) g.player.sel = i;
    if (input.mouse.wheel && !ui.overUI) {
      g.player.sel = (g.player.sel + (input.mouse.wheel > 0 ? 1 : 11)) % 12;
      input.mouse.wheel = 0;
    }
    if (input.wasPressed('rotate')) {
      if (this.mode === 'paste' && this.blueprint) this.blueprint = rotateBlueprint(this.blueprint);
      else if (this.heldPlaceable()) {
        this.rot = ((this.rot + 1) & 3) as Dir;
        this.app.audio.sfx('rotate');
      } else {
        const t = this.mouseTile();
        const e = g.ents.at(t.x, t.y);
        if (e) rotateStruct(g, e);
      }
    }
    if (input.wasPressed('eat')) eatHeld(g);
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
      }
    }
    if (input.wasPressed('interact')) {
      const [fx, fy] = facingTile(g);
      interact(g, fx, fy);
    }
    if (input.wasPressed('build')) this.openWindow('menu', 'crafting');
  }

  private pipette() {
    const g = this.g;
    const t = this.mouseTile();
    const e = g.ents.rootAt(t.x, t.y);
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
      if (input.mouse.pressed[0]) this.drag = { x: t.x, y: t.y };
      if (input.mouse.released[0] && this.drag) {
        const line = this.dragLine(placeable, this.drag.x, this.drag.y, t.x, t.y);
        let placed = 0;
        for (const L of line) {
          const st = p.inv.slots[p.sel];
          if (!st || kDef(st.k).places !== placeable) break;
          if (!this.reachOk(L.x, L.y, buildReach)) continue;
          if (!canPlace(g, placeable, L.x, L.y, L.rot).ok) continue;
          p.inv.remove(st.k, 1);
          place(g, placeable, L.x, L.y, L.rot);
          placed++;
          if (def.kind === 'belt') this.rot = L.rot;
        }
        if (!placed && line.length === 1) {
          const chk = canPlace(g, placeable, t.x, t.y, this.rot);
          if (!chk.ok) {
            this.toast(chk.reason ?? "Can't place that here.");
            app.audio.sfx('error');
          } else if (!this.reachOk(t.x, t.y, buildReach)) this.toast('Too far away.');
        }
        g.sys.quests?.notify?.(g, 'build', placed, placeable);
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
    if (!this.reachOk(tx, ty, d?.tool || d?.weapon || d?.plant || d?.fertilizer ? toolReach : 2.3)) [tx, ty] = facingTile(g);
    this.lastTarget = [tx, ty];
    const chargeable = d?.tool && (d.tool.kind === 'hoe' || d.tool.kind === 'can') && d.tool.tier > 0;
    const lmb = input.mouse.down[0] || input.mouse.pressed[0];
    if (lmb && !g.sys.fishing?.busy) {
      if (chargeable) {
        this.chargeT += dt;
        this.charge = Math.min(d!.tool!.tier, Math.floor(this.chargeT / 0.45));
      } else {
        this.holdT -= dt;
        if (input.mouse.pressed[0] || this.holdT <= 0) {
          if (useHeld(g, tx, ty)) this.holdT = 0.36;
          else if (input.mouse.pressed[0] && d?.edible && !d.plant) eatHeld(g);
          else this.holdT = 0.1;
        }
      }
    }
    if (input.mouse.released[0] || (input.mouse.pressed[0] && !input.mouse.down[0])) {
      if (chargeable) {
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
      if (!interact(g, ix, iy) && d?.edible) eatHeld(g);
    }
  }

  /** ghost preview, target highlight, area selection rectangles */
  private worldOverlays() {
    const r = this.app.renderer, g = this.g;
    if (this.win && WINDOWS[this.win.id]?.modal !== false) return;
    const t = this.mouseTile();
    const ctx = r.ctx;
    const grid = this.app.settings.showGrid;
    r.overlays.push(() => {
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
        const line = this.drag ? this.dragLine(placeable, this.drag.x, this.drag.y, t.x, t.y) : [{ x: t.x, y: t.y, rot: this.rot }];
        for (const L of line) {
          const chk = canPlace(g, placeable, L.x, L.y, L.rot);
          const inReach = this.reachOk(L.x, L.y, 9 + g.mods.reach);
          this.drawGhostStruct(placeable, L.x, L.y, L.rot, chk.ok && inReach);
        }
        this.drawPlacementHints(placeable, t.x, t.y);
        return;
      }
      // tool target highlight
      const [tx, ty] = this.lastTarget;
      const st = g.player.inv.slots[g.player.sel];
      const d = st ? kDef(st.k) : null;
      ctx.strokeStyle = rgba(C.cream, 0.7);
      ctx.lineWidth = 1;
      if (d?.tool && (d.tool.kind === 'hoe' || d.tool.kind === 'can') && this.charge > 0) {
        const { toolArea } = require_actions();
        for (const [x, y] of toolArea(d.tool.kind, this.charge, tx, ty, g.player.dir)) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      } else if (g.player.where === 'world' || d) {
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      }
      // hover info for structures
      const e = g.ents.rootAt(t.x, t.y);
      if (e && !e.ghost && (e.def.kind === 'arm' || e.def.kind === 'drill')) this.drawArmHint(e);
      if (e && !e.ghost && (e.def.kind === 'pole')) this.drawPoleArea(e);
    });
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

  processEvents(evs: GameEvent[]) {
    const r = this.app.renderer, a = this.app.audio, g = this.g;
    const P = r.particles;
    const camX = r.cam.x, camY = r.cam.y;
    for (const e of evs) {
      switch (e.t) {
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
            case 'dust': P.burst(x, y, n, [C.tan, C.pebble], { speed: 30, up: 10, g: 40, life: 0.5 }); break;
            case 'dirt': P.burst(x, y, n, [C.walnut, C.oak, C.bark], { speed: 35, up: 40, life: 0.45 }); break;
            case 'chips': P.burst(x, y - 8, n, [C.tan, C.oak, C.walnut], { speed: 50, up: 50, life: 0.5 }); break;
            case 'leaves': P.burst(x, y - 16, n, e.c !== undefined ? [e.c, C.leaf] : [C.leaf, C.grass, C.moss], { speed: 40, up: 20, g: 30, life: 1.2, size: 2 }); break;
            case 'rock': P.burst(x, y, n, [C.stone, C.pebble, C.slate], { speed: 55, up: 50, life: 0.5 }); break;
            case 'grass': P.burst(x, y, n, [C.grass, C.leaf, C.lime], { speed: 40, up: 30, life: 0.6 }); break;
            case 'splash': P.burst(x, y, n, [C.aqua, C.frost, C.sky], { speed: 35, up: 45, life: 0.5 }); break;
            case 'sparkle': for (let i = 0; i < 5; i++) P.sparkle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, e.c ?? C.butter); break;
            case 'seed': P.burst(x, y, 5, [C.tan, C.oak], { speed: 20, up: 25, life: 0.4 }); break;
            case 'puff': if (Math.random() < 0.5) P.smoke(x, y); break;
            case 'hearts': P.burst(x, y - 20, 6, [C.rose, C.blush], { speed: 25, up: 40, g: -10, life: 1, size: 2 }); break;
            case 'coins': P.burst(x, y, 10, [C.amber, C.brass, C.butter], { speed: 60, up: 60, life: 0.7 }); break;
            case 'hit': P.burst(x, y - 8, n, [C.cream, C.rose], { speed: 70, up: 20, life: 0.3 }); break;
            case 'magic': P.burst(x, y - 8, n, [C.lavender, C.aqua, C.cream], { speed: 40, up: 30, g: -20, life: 1 }); break;
            default: P.burst(x, y, n, [C.cream], {});
          }
          break;
        }
        case 'levelup':
          this.toast(`${e.skill[0].toUpperCase() + e.skill.slice(1)} level ${e.level}!`, 'i:bundle_star', C.amber);
          break;
        case 'research':
          a.sfx('research');
          break;
        case 'dayEnd':
          this.app.loop.fastForward = null;
          this.openWindow('summary', e.summary);
          break;
        case 'ui':
          this.openWindow(e.open, e.arg);
          break;
      }
    }
    void g;
  }
}

import * as actionsMod from '../sim/actions';
function require_actions() {
  return actionsMod;
}

export { itemName, kId };
