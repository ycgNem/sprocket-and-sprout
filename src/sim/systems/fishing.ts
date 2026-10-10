// Fishing: charge a cast, wait for a bite, hook it, then play the tension-reel minigame:
// hold to reel (tension rises), release to ease off. Keep tension inside the moving
// sweet zone to land the fish; max tension snaps the line.
import { C } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { FISH } from '../../data/fish';
import type { FishDef } from '../../data/types';
import { Game, registerSystem } from '../Game';
import { key, kDef } from '../inventory';
import { T } from '../world/tilemap';
import { curMap } from './player';

export type FishState = 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'reel';

export interface Fishing {
  state: FishState;
  power: number;
  bx: number;
  by: number;
  t: number;
  waitFor: number;
  water: string;
  fish: FishDef | null;
  trash: string | null;
  // minigame
  tension: number;
  zone: number;
  zoneV: number;
  zoneW: number;
  progress: number;
  reeling: boolean;
  perfect: boolean;
  tug: number;
  busy: boolean;
  result: { ok: boolean; text: string; k?: number; size?: number } | null;
  resultT: number;
  cast: (g: Game, tx: number, ty: number) => void;
  press: (g: Game) => void;
  release: (g: Game) => void;
}

export function fishing(g: Game): Fishing {
  if (!g.sys.fishing) {
    g.sys.fishing = {
      state: 'idle', power: 0, bx: 0, by: 0, t: 0, waitFor: 0, water: '', fish: null, trash: null,
      tension: 0.3, zone: 0.5, zoneV: 0, zoneW: 0.2, progress: 0.3, reeling: false, perfect: true, tug: 0, busy: false, result: null, resultT: 0,
      cast: startCharge, press: onPress, release: onRelease,
    } as Fishing;
  }
  return g.sys.fishing;
}

function rodTier(g: Game) {
  const st = g.player.inv.slots[g.player.sel];
  const d = st ? kDef(st.k) : null;
  return d?.tool?.kind === 'rod' ? d.tool.tier : -1;
}

function waterKind(g: Game, x: number, y: number): string | null {
  const m = curMap(g);
  const t = m.g(x, y);
  if (t === T.RIVER) return 'river';
  if (t === T.LAKE) return 'lake';
  if (t === T.POND) return 'pond';
  if (t === T.OCEAN || t === T.DEEP) return 'ocean';
  if (t === T.MINEWATER) return 'mine';
  return null;
}

function startCharge(g: Game) {
  const f = fishing(g);
  if (f.state === 'idle') {
    if (g.player.energy <= -15) {
      g.toast('Too tired to fish.');
      return;
    }
    f.state = 'charging';
    f.power = 0;
    f.busy = true;
  }
}

function onPress(g: Game) {
  const f = fishing(g);
  if (f.state === 'bite') hook(g);
  else if (f.state === 'waiting' || f.state === 'casting') reelIn(g, 'You reeled in too early.');
}

function onRelease(g: Game) {
  const f = fishing(g);
  if (f.state === 'charging') cast(g);
}

function cast(g: Game) {
  const f = fishing(g);
  const p = g.player;
  const dist = 1.2 + f.power * 5.5;
  const dx = [0, 1, 0, -1][p.dir], dy = [-1, 0, 1, 0][p.dir];
  f.bx = p.x + dx * dist;
  f.by = p.y - 0.3 + dy * dist;
  const w = waterKind(g, Math.floor(f.bx), Math.floor(f.by));
  g.spend(Math.max(1, 4 - (p.skills.fishing ?? 0) * 0.2));
  p.anim = { kind: 'rod', t: 0, dur: 0.35, tx: Math.floor(f.bx), ty: Math.floor(f.by) };
  p.busy = 0.35;
  g.emit({ t: 'sfx', id: 'cast' });
  if (!w) {
    f.state = 'idle';
    f.busy = false;
    g.toast('The line lands on dry ground.');
    return;
  }
  f.water = w;
  f.state = 'waiting';
  const bait = p.inv.countId('deluxe_bait') > 0 ? 2 : p.inv.countId('bait') > 0 ? 1 : 0;
  f.waitFor = (2.5 + g.rng.next() * 7) * (bait === 2 ? 0.45 : bait === 1 ? 0.7 : 1) * (g.hasPerk('luremaster') ? 0.6 : 1);
  f.t = 0;
  g.emit({ t: 'fx', kind: 'splash', x: f.bx, y: f.by, n: 5 });
}

function pickFish(g: Game, w: string): FishDef | null {
  const h = g.time.min / 60;
  const floor = g.sys.mine?.floor ?? 0;
  const pool = FISH.filter((f) => !f.trap && f.where.includes(w as any) && f.seasons.includes(g.time.season) && h >= f.hours[0] && h < f.hours[1]
    && (!f.weather || (f.weather === 'rain' ? g.isRaining() : !g.isRaining()))
    && (!f.legendary || !(g.counters['caught_' + f.id] > 0))
    // the Deepworks' pools (src/sim/systems/mine.ts): every fish still bites above the flood at
    // level 10, so draining the deeper pools (the old pump) never takes one away
    && (w !== 'mine' || (f.id === 'blindfish' ? floor <= 15 : f.id === 'glimmer_guppy' ? floor >= 7 : floor >= 10)));
  if (!pool.length) return null;
  const lvl = g.player.skills.fishing ?? 0;
  return g.rng.weighted(pool, (f) => (f.legendary ? 0.15 + lvl * 0.03 : 1 + (100 - f.difficulty) / 60));
}

function hook(g: Game) {
  const f = fishing(g);
  if (g.rng.next() < 0.08) {
    f.trash = g.rng.pick(['old_boot', 'tin_can', 'driftwood', 'tangled_line', 'kelp']);
    land(g, key(f.trash), 0);
    return;
  }
  const fish = pickFish(g, f.water);
  if (!fish) {
    reelIn(g, 'Nothing seems to be biting here right now.');
    return;
  }
  f.fish = fish;
  f.state = 'reel';
  f.tension = 0.35;
  f.zone = 0.5;
  f.zoneV = 0;
  const tier = Math.max(0, rodTier(g));
  f.zoneW = 0.16 + tier * 0.035 + (g.player.skills.fishing ?? 0) * 0.008 + g.buffLvl('fishing') * 0.025 - fish.difficulty * 0.0006;
  if (g.hasPerk('steady')) f.zoneW *= 1.2;
  f.progress = 0.3;
  f.perfect = true;
  f.tug = 0;
  // consume bait
  const p = g.player;
  if (p.inv.countId('deluxe_bait') > 0) p.inv.removeSpec('deluxe_bait', 1);
  else if (p.inv.countId('bait') > 0) p.inv.removeSpec('bait', 1);
  g.emit({ t: 'sfx', id: 'bite' });
  g.emit({ t: 'ui', open: 'fishing' });
}

function reelIn(g: Game, msg?: string) {
  const f = fishing(g);
  f.state = 'idle';
  f.busy = false;
  f.fish = null;
  if (msg) g.toast(msg);
}

function land(g: Game, k: number, size: number) {
  const f = fishing(g);
  const d = kDef(k);
  g.give(k, 1);
  g.emit({ t: 'sfx', id: d.cat === 'trash' ? 'splash' : 'catch' });
  if (d.cat === 'trash' || d.id === 'kelp') g.count('trash_' + d.id);
  if (d.cat === 'fish' && g.time.min >= 1500 && g.weather === 'storm') g.sys.achUnlock?.(g, 'graveyard');
  if (d.cat === 'fish') {
    g.count('fish_caught');
    g.count('caught_' + d.id);
    g.sys.collections?.fish?.(g, d.id, size);
    g.addXp('fishing', Math.round(5 + (f.fish?.difficulty ?? 10) * 0.6 * (f.perfect ? 1.6 : 1)));
    g.sys.quests?.notify?.(g, 'catch', 1, d.id);
    // the first catch of a legendary earns a wall trophy
    if (d.tags?.includes('legendary') && !g.flags.has('trophy_' + d.id) && ITEM_BY_ID.has('f_trophy_' + d.id)) {
      g.flags.add('trophy_' + d.id);
      g.give(key('f_trophy_' + d.id), 1);
      g.toast(`A legend! You get a mounted ${d.name} for your farmhouse wall.`, undefined, C.amber);
    }
  }
  f.result = { ok: true, text: d.cat === 'trash' ? `You fished up... a ${d.name}.` : `Caught a ${d.name}!${size ? ` (${size} cm)` : ''}${f.perfect ? ' Perfect!' : ''}`, k, size };
  f.resultT = 2.5;
  f.state = 'idle';
  f.busy = false;
}

function reelTick(g: Game, dt: number) {
  const f = fishing(g);
  const fish = f.fish!;
  const diff = fish.difficulty / 100;
  // tension physics
  const reelRate = 0.75 + diff * 0.2;
  if (f.reeling) f.tension += reelRate * dt;
  else f.tension -= (0.6 + diff * 0.15) * dt;
  // fish tugs
  f.tug -= dt;
  const r = g.rng;
  if (f.tug <= 0) {
    f.tug = fish.behavior === 'dart' ? 0.5 + r.next() * 1.2 : fish.behavior === 'erratic' ? 0.25 + r.next() * 0.6 : 0.8 + r.next() * 1.5;
    const amp = (0.15 + diff * 0.55) * (fish.behavior === 'calm' ? 0.5 : fish.behavior === 'dart' ? 1.4 : 1);
    f.zoneV += (r.next() - 0.5) * amp * 3;
    if (fish.behavior === 'sink') f.zoneV += amp * 0.6;
    if (fish.behavior === 'float') f.zoneV -= amp * 0.6;
    if (fish.behavior === 'dart' || fish.behavior === 'erratic') f.tension += (r.next() - 0.3) * amp * 0.25;
  }
  f.zoneV *= Math.pow(0.25, dt);
  f.zone += f.zoneV * dt;
  const half = f.zoneW / 2;
  if (f.zone < half + 0.05) { f.zone = half + 0.05; f.zoneV = Math.abs(f.zoneV) * 0.5; }
  if (f.zone > 0.95 - half) { f.zone = 0.95 - half; f.zoneV = -Math.abs(f.zoneV) * 0.5; }
  f.tension = Math.max(0, f.tension);
  const inZone = Math.abs(f.tension - f.zone) <= half;
  f.progress += (inZone ? 0.22 - diff * 0.06 : -(0.12 + diff * 0.12)) * dt;
  if (!inZone) f.perfect = false;
  if (f.tension >= 1) {
    f.result = { ok: false, text: 'Snap! The line broke.' };
    f.resultT = 2;
    g.emit({ t: 'sfx', id: 'lose' });
    reelIn(g);
    return;
  }
  if (f.progress <= 0) {
    f.result = { ok: false, text: `The ${fish.name.toLowerCase()} got away...` };
    f.resultT = 2;
    g.emit({ t: 'sfx', id: 'lose' });
    reelIn(g);
    return;
  }
  if (g.tickN % 6 === 0 && f.reeling) g.emit({ t: 'sfx', id: 'reel' });
  if (f.progress >= 1) {
    const lvl = g.player.skills.fishing ?? 0;
    const q = f.perfect ? (g.rng.next() < 0.25 + lvl * 0.03 ? 3 : 2) : g.rng.next() < 0.3 + lvl * 0.04 ? 1 : 0;
    const base = 12 + fish.difficulty * 0.6 + (fish.legendary ? 40 : 0);
    const size = Math.round(base * (0.7 + g.rng.next() * 0.6));
    land(g, key(fish.id, kDef(key(fish.id)).quality ? q : 0), size);
  }
}

registerSystem({
  name: 'fishing',
  realtime: true,
  tick(g, dt) {
    const f = g.sys.fishing as Fishing | undefined;
    if (!f) {
      fishing(g);
      return;
    }
    if (f.resultT > 0) {
      f.resultT -= dt;
      if (f.resultT <= 0) f.result = null;
    }
    switch (f.state) {
      case 'charging':
        f.power = Math.min(1, f.power + dt * 1.2);
        if (rodTier(g) < 0) reelIn(g);
        break;
      case 'waiting':
        f.t += dt;
        if (g.player.moving || rodTier(g) < 0) reelIn(g);
        else if (f.t >= f.waitFor) {
          f.state = 'bite';
          f.t = 0;
          g.emit({ t: 'sfx', id: 'bite' });
          g.emit({ t: 'fx', kind: 'splash', x: f.bx, y: f.by, n: 8 });
        }
        break;
      case 'bite':
        f.t += dt;
        if (f.t > 0.9) reelIn(g, 'It got away! Click as soon as it bites.');
        break;
      case 'reel':
        reelTick(g, dt);
        break;
    }
  },
  dayStart(g) {
    fishing(g);
  },
});
