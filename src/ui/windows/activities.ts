// Activity windows: fishing tension reel, mine elevator, festivals: Lantern Night's fireflies and
// Frostlight Skate here, the Sprocket Fair's test bed (fair.ts) and the Harvest Haul's auction
// (auction.ts) in their own files.
import { C } from '../../data/palette';
import { FESTIVALS } from '../../data/goals';
import { ITEM_BY_ID } from '../../data/items';
import { key } from '../../sim/inventory';
import { fishing } from '../../sim/systems/fishing';
import { festivalName, finishActivity } from '../../sim/systems/festivals';
import { drawFair } from './fair';
import { drawHaul } from './auction';
import { drawTokenStall } from './stall';
import { DEEP_FLAGS, FLOOD_LEVEL, FLOOD_TEXT, mine } from '../../sim/systems/mine';
import { STRATA } from '../../data/deepworks';
import { sprite, drawSprite, drawItemIcon } from '../../render/atlas';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { ICON, wrapText } from '../font';

// ---------------- fishing ----------------
function drawFishing(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const f = fishing(g);
  ui.block(0, 0, ui.w, ui.h);
  if (f.state !== 'reel') {
    // show the result briefly
    if (f.result && st.t < 30) {
      const w = 220, h = 40;
      const x = (ui.w - w) / 2, y = ui.h * 0.25;
      ui.panel(x, y, w, h, 'paper', false);
      if (f.result.k !== undefined) ui.itemIcon(f.result.k, x + 8, y + 12, 16);
      ui.para(f.result.text, x + 30, y + 10, w - 38, f.result.ok ? C.moss : C.brick);
      if (st.data.endT === undefined) st.data.endT = st.t;
      return st.t - st.data.endT < 1.6;
    }
    return false;
  }
  const reel = ui.input.mouse.down[0] || ui.input.isDown('interact') || ui.input.down.has('Space');
  f.reeling = reel;
  const W = 260, H = 70;
  const x = Math.floor((ui.w - W) / 2), y = Math.floor(ui.h * 0.62);
  ui.panel(x, y - 30, W, H + 40);
  const fish = f.fish!;
  ui.itemIcon(key(fish.id), x + 8, y - 20, 16);
  ui.text(fish.legendary ? '!!! ' + fish.name + ' !!!' : 'Something is on the line!', x + 28, y - 16, fish.legendary ? C.rose : C.ink);
  ui.text(reel ? 'Reeling...' : 'Hold the mouse (or Space) to reel, release to ease off', x + W / 2, y + 56, C.walnut, { align: 'center' });
  // tension gauge
  const gx = x + 12, gy = y + 8, gw = W - 24, gh = 16;
  ui.fill(gx - 1, gy - 1, gw + 2, gh + 2, C.ink);
  ui.fill(gx, gy, gw, gh, C.river);
  // danger zone at the top end
  ui.fill(gx + gw * 0.92, gy, gw * 0.08, gh, C.brick);
  // sweet zone
  const zx = gx + (f.zone - f.zoneW / 2) * gw, zw = f.zoneW * gw;
  const inZone = Math.abs(f.tension - f.zone) <= f.zoneW / 2;
  ui.fill(zx, gy, zw, gh, inZone ? C.lime : C.leaf);
  ui.fill(zx, gy, zw, 2, C.cream);
  // needle
  const nx = gx + Math.min(1, f.tension) * gw;
  ui.fill(nx - 1, gy - 3, 3, gh + 6, C.ink);
  ui.fill(nx, gy - 2, 1, gh + 4, f.tension > 0.9 ? C.rose : C.butter);
  // fish icon wiggles at the zone
  const wig = Math.sin(ui.time * 20) * (inZone ? 1 : 3);
  drawItemIcon(ui.ctx, fish.id, Math.round(zx + zw / 2 - 6 + wig), gy - 16, 12);
  ui.text('slack', gx, gy + gh + 4, C.oak);
  ui.text('SNAP', gx + gw, gy + gh + 4, C.brick, { align: 'right' });
  // catch progress
  ui.text('Catch', gx, gy + 30, C.walnut);
  ui.bar(gx + 32, gy + 30, gw - 32, 8, f.progress, f.perfect ? C.amber : C.moss);
  if (f.perfect) ui.text(ICON.star, gx + gw + 2, gy + 29, C.amber);
  return true;
}

// ---------------- elevator ----------------
function drawElevator(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const floors: number[] = st.arg;
  // below level 10 the Deepworks are flooded until the town's Waterworks drains them
  const flooded = !g.flags.has(DEEP_FLAGS.drained) && (mine(g).deepest >= FLOOD_LEVEL || g.flags.has('elev_' + FLOOD_LEVEL));
  const intro = wrapText(g.player.where === 'mine' ? 'The old lift creaks. Which level?' : 'The old lift stops at every works chamber you have reached. Which level?', 196);
  const note = flooded ? wrapText('Below level 10: ' + FLOOD_TEXT, 196) : [];
  const rows = Math.ceil(floors.length / 5);
  const bodyY = 12 + intro.length * 10 + 6;
  const w = 220, h = bodyY + rows * 22 + note.length * 10 + (note.length ? 8 : 0) + 34;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'The Deepworks lift')) return false;
  intro.forEach((l, i) => ui.text(l, x + 12, y + 12 + i * 10, C.walnut));
  floors.forEach((f, i) => {
    const stratum = STRATA[Math.max(0, Math.min(STRATA.length - 1, Math.floor((f - 1) / 5)))];
    // the level you're on is a flat button (you are here); from the surface, level 1 is the default
    const here = g.player.where === 'mine' && mine(g).floor === f;
    const tip = [{ text: `Level ${f}: ${stratum.name}${here ? ' (you are here)' : ''}`, color: C.amber }];
    if (ui.button('fl' + f, x + 12 + (i % 5) * 40, y + bodyY + Math.floor(i / 5) * 22, 36, 18, String(f), { style: here ? 'flat' : f === 1 && g.player.where !== 'mine' ? 'green' : 'wood', tip }) && !here) {
      play.win = null;
      mine(g).enter(g, f);
    }
  });
  note.forEach((l, i) => ui.text(l, x + 12, y + bodyY + rows * 22 + 4 + i * 10, C.river));
  if (g.player.where === 'mine' && ui.button('flup', x + 12, y + h - 26, 80, 18, 'To surface', { style: 'flat' })) {
    play.win = null;
    mine(g).leave(g);
  }
  return play.win !== null;
}

// ---------------- festivals ----------------
interface Game2 { score: number; t: number; [k: string]: any }

function drawFestival(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const f = FESTIVALS.find((x) => x.id === st.arg)!;
  // the works festivals have windows of their own: the Professor's test bed, the Mayor's auction
  if (f.activity === 'fair') return drawFair(ui, play, st, f);
  if (f.activity === 'haul') return drawHaul(ui, play, st, f);
  if (st.data.mode === 'play') return drawMinigame(ui, play, st, f.activity);
  if (st.data.mode === 'done') {
    const w = 260, h = 110;
    const { x, y } = centered(ui, w, h);
    if (!frame(ui, x, y, w, h, festivalName(f, true))) return false;
    ui.text(`Score: ${Math.round(st.data.score)}`, x + w / 2, y + 14, C.ink, { align: 'center', scale: 2 });
    ui.para(st.data.msg ?? '', x + 12, y + 40, w - 24, C.walnut);
    if (ui.button('fdone', x + w / 2 - 30, y + h - 26, 60, 18, 'Hooray!', { style: 'green' })) return false;
    return true;
  }
  const w = 300, h = 210;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, festivalName(f, true))) return false;
  wrapText(f.intro, w - 24).forEach((l, i) => ui.text(l, x + 12, y + 14 + i * 10, C.walnut));
  const played = g.flags.has(`fest_${f.id}_${g.time.year}`);
  ui.text(`Prizes: ${f.prizes.map((p) => `${p.score}+ pts`).join(', ')}`, x + 12, y + 70, C.oak);
  if (ui.button('fplay', x + 12, y + 84, 120, 20, played ? 'Play for fun' : 'Play!', { style: 'green' })) {
    st.data.mode = 'play';
    st.data.game = null;
  }
  ui.text(`Best: ${g.counters['best_' + f.id] ?? 0}`, x + 140, y + 90, C.walnut);
  drawTokenStall(ui, play, x + 12, y + 114, f.host);
  return true;
}

function endGame(play: PlayScreen, st: WinState, score: number) {
  const f = FESTIVALS.find((x) => x.id === st.arg)!;
  const res = finishActivity(play.g, f, score);
  st.data.mode = 'done';
  st.data.score = score;
  st.data.msg = !res.first ? 'Just for fun this time - prizes are once per festival.' : res.prize ? `You won ${res.prize.money} coins and ${res.prize.items.map((i) => `${i.n} ${ITEM_BY_ID.get(i.item)!.name}`).join(', ')}!` : 'Not quite a prize, but here are 2 tokens for trying!';
  play.app.audio.sfx(res.prize ? 'levelup' : 'collect');
}

function drawMinigame(ui: UI, play: PlayScreen, st: WinState, kind: string): boolean {
  const W = 300, H = 200;
  const { x, y } = centered(ui, W, H);
  ui.panel(x, y, W, H);
  ui.block(0, 0, ui.w, ui.h);
  const dt = 1 / 60;
  const G: Game2 = (st.data.game ??= { score: 0, t: 0 });
  G.t += dt;
  const ax = x + 8, ay = y + 20, aw = W - 16, ah = H - 28;
  ui.fill(ax, ay, aw, ah, kind === 'skate' ? C.frost : C.deepsea);
  if (kind === 'firefly') {
    const T = 40;
    G.flies = G.flies ?? [];
    if (G.flies.length < 9 && Math.random() < 0.08) G.flies.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, gold: Math.random() < 0.15, life: 3 + Math.random() * 3 });
    for (let i = G.flies.length - 1; i >= 0; i--) {
      const fl = G.flies[i];
      fl.life -= dt;
      fl.x += fl.vx * dt + Math.sin(G.t * 3 + i) * 0.003;
      fl.y += fl.vy * dt + Math.cos(G.t * 2 + i) * 0.003;
      const fx = ax + fl.x * aw, fy = ay + fl.y * ah;
      const glow = 0.5 + Math.sin(G.t * 8 + i) * 0.5;
      ui.fill(fx - 2, fy - 2, 5, 5, fl.gold ? C.amber : C.lime, glow * 0.5);
      ui.fill(fx - 1, fy - 1, 3, 3, fl.gold ? C.butter : C.lime);
      if (ui.clicked && Math.hypot(ui.mx - fx, ui.my - fy) < 7) {
        G.score += fl.gold ? 3 : 1;
        G.flies.splice(i, 1);
        ui.eat();
        ui.sfx('pickup');
        continue;
      }
      if (fl.life <= 0 || fl.x < 0 || fl.x > 1 || fl.y < 0 || fl.y > 1) G.flies.splice(i, 1);
    }
    ui.text(`Click the fireflies! ${Math.ceil(T - G.t)}s`, x + 8, y + 7, C.ink);
    ui.text(`${G.score}`, x + W - 10, y + 7, C.ink, { align: 'right' });
    if (G.t >= T) endGame(play, st, G.score);
  } else if (kind === 'skate') {
    const T = 60;
    G.px = G.px ?? 0.5;
    G.py = G.py ?? 0.5;
    G.vx = G.vx ?? 0;
    G.vy = G.vy ?? 0;
    const inp = ui.input;
    const acc = 0.9;
    if (inp.isDown('left') || inp.down.has('KeyA')) G.vx -= acc * dt;
    if (inp.isDown('right') || inp.down.has('KeyD')) G.vx += acc * dt;
    if (inp.isDown('up') || inp.down.has('KeyW')) G.vy -= acc * dt;
    if (inp.isDown('down') || inp.down.has('KeyS')) G.vy += acc * dt;
    G.vx *= 0.99;
    G.vy *= 0.99;
    G.px += G.vx * dt;
    G.py += G.vy * dt;
    if (G.px < 0.03 || G.px > 0.97) { G.vx *= -0.7; G.px = Math.max(0.03, Math.min(0.97, G.px)); }
    if (G.py < 0.05 || G.py > 0.95) { G.vy *= -0.7; G.py = Math.max(0.05, Math.min(0.95, G.py)); }
    G.lights = G.lights ?? [];
    G.cracks = G.cracks ?? [];
    if (G.lights.length < 4) G.lights.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 });
    if (G.cracks.length < 2 + Math.floor(G.t / 12) && Math.random() < 0.01) G.cracks.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, t: 0 });
    for (let i = G.lights.length - 1; i >= 0; i--) {
      const l = G.lights[i];
      const lx = ax + l.x * aw, ly = ay + l.y * ah;
      ui.fill(lx - 2, ly - 2, 5, 5, C.amber);
      ui.fill(lx - 1, ly - 1, 3, 3, C.butter);
      if (Math.hypot(l.x - G.px, (l.y - G.py) * 0.65) < 0.05) { G.lights.splice(i, 1); G.score++; ui.sfx('pickup'); }
    }
    for (const c of G.cracks) {
      c.t += dt;
      const cx = ax + c.x * aw, cy = ay + c.y * ah;
      const r = Math.min(10, c.t * 6);
      ui.fill(cx - r, cy, r * 2, 1, C.slate);
      ui.fill(cx, cy - r / 2, 1, r, C.slate);
      if (r >= 10 && Math.hypot((c.x - G.px) * aw, (c.y - G.py) * ah) < 9 && !G.slip) { G.slip = 1; G.score = Math.max(0, G.score - 2); G.vx *= -1; G.vy *= -1; ui.sfx('hurt'); }
    }
    if (G.slip) { G.slip -= dt; if (G.slip <= 0) G.slip = 0; }
    const s = sprite('ch:player:2:0');
    drawSprite(ui.ctx, s, ax + G.px * aw, ay + G.py * ah + 3);
    ui.text(`WASD to skate. Grab lights, avoid cracks! ${Math.ceil(T - G.t)}s`, x + 8, y + 7, C.ink);
    ui.text(`${G.score}`, x + W - 10, y + 7, C.ink, { align: 'right' });
    if (G.t >= T) endGame(play, st, G.score);
  }
  if (ui.input.wasPressed('pause')) {
    ui.input.consume('pause');
    st.data.mode = null;
  }
  return true;
}

// a short fade when changing maps
function drawFade(ui: UI, _play: PlayScreen, st: WinState): boolean {
  const a = Math.max(0, 1 - st.t * 3);
  ui.fill(0, 0, ui.w, ui.h, C.ink, a);
  return a > 0;
}

registerWindow('fishing', { draw: drawFishing, pause: false });
registerWindow('elevator', { draw: drawElevator });
registerWindow('festival', { draw: drawFestival });
registerWindow('fade', { draw: drawFade, modal: false, pause: false });
