// Player movement + collision against the current map, structures and crops.
import { CROP_BY_ID } from '../../data/crops';
import { Game, registerSystem, SEC_PER_MIN } from '../Game';
import { T, TileMap } from '../world/tilemap';
import { decorSolid, houseMap } from './house';
import { DX, DY } from '../ents';

export function curMap(g: Game): TileMap {
  const w = g.player.where;
  if (w === 'mine' && g.sys.mine?.map) return g.sys.mine.map;
  if (w === 'house') return houseMap(g);
  return g.map;
}

export function solidAt(g: Game, tx: number, ty: number): boolean {
  const m = curMap(g);
  if (!m.walkable(tx, ty)) return true;
  if (g.player.where === 'house') {
    // furniture, and the structures placed indoors (Workshop HQ)
    const e = g.houseEnts.at(tx, ty);
    return decorSolid(g, tx, ty) || !!(e && !e.ghost && e.def.solid);
  }
  if (m !== g.map) return !!g.sys.mine?.solid?.(g, tx, ty);
  const e = g.ents.at(tx, ty);
  if (e && !e.ghost && e.def.solid) return true;
  const s = g.soil.get(m.idx(tx, ty));
  if (s?.crop && !s.crop.dead) {
    const cr = CROP_BY_ID.get(s.crop.id);
    if (cr?.trellis && s.crop.stage >= 1) return true;
    if (s.crop.giant >= 0) return true;
  }
  return false;
}

const HW = 0.3, HUP = 0.3, HDN = 0.02;
function blocked(g: Game, x: number, y: number) {
  const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW);
  const y0 = Math.floor(y - HUP), y1 = Math.floor(y + HDN);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(g, tx, ty)) return true;
  return false;
}

export function movePlayer(g: Game, dt: number) {
  const p = g.player;
  p.busy = Math.max(0, p.busy - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.anim) {
    p.anim.t += dt;
    if (p.anim.t >= p.anim.dur) p.anim = null;
  }
  let mx = g.moveX, my = g.moveY;
  // knockback
  if (Math.abs(p.kx) + Math.abs(p.ky) > 0.01) {
    tryMove(g, p.kx * dt, p.ky * dt);
    p.kx *= Math.pow(0.002, dt);
    p.ky *= Math.pow(0.002, dt);
  }
  if (g.sleeping || p.busy > 0.05 || g.sys.cutscene) mx = my = 0;
  rideBelt(g, dt);
  const len = Math.hypot(mx, my);
  if (len < 0.01) {
    p.moving = false;
    p.walkT = 0;
    return;
  }
  mx /= len;
  my /= len;
  const m = curMap(g);
  let speed = 5;
  if (g.walkSlow) speed = 2.4;
  if (p.exhausted) speed *= 0.6;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const gt = m.g(tx, ty);
  if (gt === T.PATH || gt === T.PLANKS) speed *= 1.12;
  speed *= 1 + g.buffLvl('speed') * 0.08;
  const ox = p.x, oy = p.y;
  tryMove(g, mx * speed * dt, my * speed * dt);
  const prevDir = p.dir;
  if (Math.abs(mx) > Math.abs(my) + 0.1) p.dir = mx > 0 ? 1 : 3;
  else p.dir = my > 0 ? 2 : 0;
  trackWalk(g, Math.hypot(p.x - ox, p.y - oy), prevDir);
  p.moving = true;
  p.walkT += dt * speed;
}

/** Conveyor belts carry whatever stands on them, farmers included. */
function rideBelt(g: Game, dt: number) {
  const p = g.player;
  if (p.where !== 'world' || g.sleeping) return;
  const e = g.ents.at(Math.floor(p.x), Math.floor(p.y - 0.1));
  // a rusted belt is dead: it carries nothing, farmers included
  if (!e || e.ghost || e.st.rust || e.def.kind !== 'belt' || !e.belt) return;
  const sp = (e.belt.speed ?? 1.5) * 0.9;
  const ox = p.x, oy = p.y;
  tryMove(g, DX[e.rot] * sp * dt, DY[e.rot] * sp * dt);
  const st = (g.sys._ride ??= { d: 0 });
  st.d += Math.hypot(p.x - ox, p.y - oy);
  if (st.d >= 1) {
    g.count('belt_ride', Math.floor(st.d));
    st.d -= Math.floor(st.d);
  }
}

/** distance walked, plus the "walking in circles" easter egg */
function trackWalk(g: Game, dist: number, prevDir: number) {
  const st = (g.sys._walk ??= { d: 0, turns: 0, sense: 0, t: 0 });
  st.d += dist;
  if (st.d >= 1) {
    g.count('walked', Math.floor(st.d));
    st.d -= Math.floor(st.d);
  }
  st.t += 1 / 60;
  const p = g.player;
  if (p.dir === prevDir) {
    if (st.t > 1.2) st.turns = 0;
    return;
  }
  const sense = (p.dir - prevDir + 4) % 4 === 1 ? 1 : (prevDir - p.dir + 4) % 4 === 1 ? -1 : 0;
  if (sense && sense === st.sense && st.t < 1.2) st.turns++;
  else st.turns = 1;
  st.sense = sense;
  st.t = 0;
  // three full circles
  if (st.turns >= 12) {
    st.turns = 0;
    if (g.sys.achUnlock?.(g, 'dizzy')) g.emit({ t: 'float', text: '@_@', x: p.x, y: p.y - 2 });
  }
}

function tryMove(g: Game, dx: number, dy: number) {
  const p = g.player;
  const m = curMap(g);
  if (dx) {
    const nx = Math.max(0.4, Math.min(m.w - 0.4, p.x + dx));
    if (!blocked(g, nx, p.y)) p.x = nx;
    else if (!dy) {
      // slide around corners
      for (const off of [0.3, -0.3]) if (!blocked(g, nx, p.y + off) && !blocked(g, p.x, p.y + off)) { p.y += Math.sign(off) * Math.min(Math.abs(dx), 0.05); break; }
    }
  }
  if (dy) {
    const ny = Math.max(0.4, Math.min(m.h - 0.1, p.y + dy));
    if (!blocked(g, p.x, ny)) p.y = ny;
    else if (!dx) {
      for (const off of [0.3, -0.3]) if (!blocked(g, p.x + off, ny) && !blocked(g, p.x + off, p.y)) { p.x += Math.sign(off) * Math.min(Math.abs(dy), 0.05); break; }
    }
  }
}

/** The tile the player is facing. */
export function facingTile(g: Game): [number, number] {
  const p = g.player;
  const fx = [0, 1, 0, -1][p.dir], fy = [-1, 0, 1, 0][p.dir];
  return [Math.floor(p.x + fx * 0.75), Math.floor(p.y - 0.2 + fy * 0.75)];
}

function tickBuff(g: Game, dt: number) {
  const b = g.player.buff;
  if (!b || g.sleeping) return;
  b.left -= dt / SEC_PER_MIN;
  if (b.left <= 0) {
    g.player.buff = null;
    g.toast('Your food buff wore off.');
  }
}

registerSystem({ name: 'player', realtime: true, tick(g, dt) { movePlayer(g, dt); tickBuff(g, dt); } });
