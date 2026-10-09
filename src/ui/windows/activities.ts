// Activity windows: fishing tension reel, mine elevator, festivals and their minigames.
import { shortName } from '../../data/cookbook';
import { C } from '../../data/palette';
import { FESTIVALS, TOKEN_SHOP } from '../../data/goals';
import { ITEM_BY_ID } from '../../data/items';
import { NPC_BY_ID } from '../../data/npcs';
import { key } from '../../sim/inventory';
import { fishing } from '../../sim/systems/fishing';
import { finishActivity } from '../../sim/systems/festivals';
import { mine } from '../../sim/systems/mine';
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
  const w = 220, h = 70 + Math.ceil(floors.length / 5) * 22;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'The Old Mine')) return false;
  ui.text(g.player.where === 'mine' ? 'The lift creaks. Where to?' : 'Choose a floor. The old lift reaches every fifth floor you\'ve found.', x + 12, y + 12, C.walnut);
  floors.forEach((f, i) => {
    if (ui.button('fl' + f, x + 12 + (i % 5) * 40, y + 30 + Math.floor(i / 5) * 22, 36, 18, String(f), { style: f === 1 ? 'green' : 'wood' })) {
      play.win = null;
      mine(g).enter(g, f);
    }
  });
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
  if (st.data.mode === 'play') return drawMinigame(ui, play, st, f.activity);
  if (st.data.mode === 'done') {
    const w = 260, h = 110;
    const { x, y } = centered(ui, w, h);
    if (!frame(ui, x, y, w, h, f.name)) return false;
    ui.text(`Score: ${Math.round(st.data.score)}`, x + w / 2, y + 14, C.ink, { align: 'center', scale: 2 });
    ui.para(st.data.msg ?? '', x + 12, y + 40, w - 24, C.walnut);
    if (ui.button('fdone', x + w / 2 - 30, y + h - 26, 60, 18, 'Hooray!', { style: 'green' })) return false;
    return true;
  }
  const w = 300, h = 210;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, f.name)) return false;
  const host = NPC_BY_ID.get(f.host)!;
  wrapText(f.intro, w - 24).forEach((l, i) => ui.text(l, x + 12, y + 14 + i * 10, C.walnut));
  const played = g.flags.has(`fest_${f.id}_${g.time.year}`);
  ui.text(`Prizes: ${f.prizes.map((p) => `${p.score}+ pts`).join(', ')}`, x + 12, y + 70, C.oak);
  if (ui.button('fplay', x + 12, y + 84, 120, 20, played ? 'Play for fun' : 'Play!', { style: 'green' })) {
    st.data.mode = 'play';
    st.data.game = null;
  }
  ui.text(`Best: ${g.counters['best_' + f.id] ?? 0}`, x + 140, y + 90, C.walnut);
  // token stall
  ui.text(`Token stall (${shortName(host.name)}): you have ${g.player.inv.countId('ticket')} tokens`, x + 12, y + 114, C.ink);
  TOKEN_SHOP.forEach((t, i) => {
    const sx = x + 12 + (i % 4) * 70, sy = y + 128 + Math.floor(i / 4) * 34;
    const r = ui.slot(sx, sy, { k: key(t.item), n: 1 });
    ui.text(`${t.tickets}`, sx + 24, sy + 6, C.walnut);
    if (r.hover) ui.tip([{ text: ITEM_BY_ID.get(t.item)!.name, color: C.amber }, { text: `${t.tickets} festival tokens`, color: C.pebble }]);
    if (r.click) {
      if (g.player.inv.countId('ticket') >= t.tickets) {
        g.player.inv.removeSpec('ticket', t.tickets);
        g.give(key(t.item), 1);
        ui.sfx('buy');
      } else ui.sfx('error');
    }
  });
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
  ui.fill(ax, ay, aw, ah, kind === 'skate' ? C.frost : kind === 'firefly' ? C.deepsea : kind === 'kite' ? C.sky : C.grass);
  const down = ui.input.mouse.down[0] || ui.input.down.has('Space');
  if (kind === 'kite') {
    const T = 40;
    // breeze band drifts up and down
    G.band = 0.5 + Math.sin(G.t * 0.9) * 0.25 + Math.sin(G.t * 2.3) * 0.08;
    G.h = G.h ?? 0.5;
    G.v = (G.v ?? 0) + (down ? 1.3 : -0.9) * dt;
    G.v *= 0.96;
    G.h = Math.max(0, Math.min(1, G.h + G.v * dt));
    const bandH = 0.22;
    const inBand = Math.abs(G.h - G.band) < bandH / 2;
    if (inBand) G.score += dt * 30;
    ui.fill(ax, ay + (G.band - bandH / 2) * ah, aw, bandH * ah, C.aqua);
    for (let i = 0; i < 5; i++) ui.fill(ax + ((G.t * 60 + i * 61) % aw), ay + (G.band - 0.05 + (i % 2) * 0.1) * ah, 12, 1, C.cream);
    const kx = ax + aw * 0.6, ky = ay + G.h * ah;
    ui.fill(kx - 5, ky - 7, 10, 14, inBand ? C.rose : C.blush);
    ui.fill(kx - 1, ky - 7, 2, 14, C.wine);
    for (let i = 0; i < 8; i++) ui.fill(kx - 3 - i * 2 + Math.sin(G.t * 6 + i) * 2, ky + 7 + i * 3, 2, 2, C.butter);
    ui.fill(ax + 20, ay + ah - 6, 2, 6, C.walnut);
    ui.text(`Hold to pull down, release to rise. ${Math.ceil(T - G.t)}s`, x + 8, y + 7, C.ink);
    ui.text(`${Math.round(G.score)}`, x + W - 10, y + 7, C.ink, { align: 'right' });
    if (G.t >= T) endGame(play, st, Math.round(G.score * 1.0));
  } else if (kind === 'firefly') {
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
  } else if (kind === 'pumpkin') {
    G.roll = G.roll ?? 0;
    G.phase = G.phase ?? 'aim';
    const laneL = ax + 20, laneR = ax + aw - 20;
    // target rings at the far end
    const tx = (laneL + laneR) / 2, ty = ay + 30;
    for (const [r, c] of [[34, C.cream], [24, C.rose], [14, C.cream], [6, C.rose]] as const) {
      ui.fill(tx - r, ty - r / 2, r * 2, r, c);
    }
    ui.fill(laneL - 2, ay, 2, ah, C.moss);
    ui.fill(laneR, ay, 2, ah, C.moss);
    const sx = (laneL + laneR) / 2, sy = ay + ah - 16;
    if (G.phase === 'aim') {
      G.aim = Math.sin(G.t * 2.2) * 0.9;
      for (let i = 0; i < 6; i++) ui.fill(sx + G.aim * i * 6, sy - i * 8, 2, 2, C.ink);
      if (ui.clicked) { ui.eat(); G.phase = 'power'; G.pt = 0; }
    } else if (G.phase === 'power') {
      G.pt += dt;
      G.power = 0.5 + Math.sin(G.pt * 3) * 0.5;
      ui.bar(ax + 8, ay + ah - 10, 60, 6, G.power, C.amber);
      if (ui.clicked) { ui.eat(); G.phase = 'roll'; G.px = sx; G.py = sy; G.vx = G.aim * 40; G.vy = -(60 + G.power * 150); }
    } else if (G.phase === 'roll') {
      G.px += G.vx * dt;
      G.py += G.vy * dt;
      G.vx *= 0.995;
      G.vy *= 0.985;
      if (G.px < laneL + 4 || G.px > laneR - 4) G.vx *= -0.6;
      if (Math.abs(G.vy) < 6 || G.py < ay + 4) {
        const d = Math.hypot((G.px - tx) / 34, (G.py - ty) / 17);
        const pts = d < 0.18 ? 100 : d < 0.42 ? 50 : d < 0.72 ? 25 : d < 1 ? 10 : 0;
        G.score += pts;
        G.last = pts;
        G.roll++;
        G.phase = G.roll >= 3 ? 'end' : 'aim';
        ui.sfx(pts >= 50 ? 'levelup' : 'thud');
      }
    }
    const px = G.phase === 'roll' ? G.px : sx, py = G.phase === 'roll' ? G.py : sy;
    ui.fill(px - 6, py - 5, 12, 10, C.apricot);
    ui.fill(px - 1, py - 7, 2, 3, C.moss);
    ui.fill(px - 3, py - 5, 1, 10, C.terracotta);
    ui.fill(px + 2, py - 5, 1, 10, C.terracotta);
    ui.text(`Roll ${Math.min(3, G.roll + 1)}/3  ${G.phase === 'aim' ? 'click to aim' : G.phase === 'power' ? 'click for power' : ''}`, x + 8, y + 7, C.ink);
    ui.text(`${G.score}${G.last !== undefined ? ` (+${G.last})` : ''}`, x + W - 10, y + 7, C.ink, { align: 'right' });
    if (G.phase === 'end') endGame(play, st, G.score);
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
