// Little surprises while you sleep: a meteorite, a crop fairy, a windstorm, a gift by the mailbox.
import { CROP_BY_ID } from '../../data/crops';
import { Game, registerSystem } from '../Game';
import { O, T, Z } from '../world/tilemap';

function freeFarmTile(g: Game, w = 1, h = 1): [number, number] | null {
  const m = g.map;
  for (let tries = 0; tries < 400; tries++) {
    const x = g.rng.int(2, m.w - 3 - w), y = g.rng.int(2, m.h - 3 - h);
    let ok = true;
    for (let yy = y - 1; yy <= y + h && ok; yy++)
      for (let xx = x - 1; xx <= x + w && ok; xx++) {
        const i = m.idx(xx, yy);
        if (m.zone[i] !== Z.FARM || !m.walkable(xx, yy) || m.obj[i] || g.soil.has(i) || g.ents.at(xx, yy)) ok = false;
      }
    if (ok) return [x, y];
  }
  return null;
}

function meteorite(g: Game): string | null {
  const spot = freeFarmTile(g, 3, 3);
  if (!spot) return null;
  const [x, y] = spot;
  for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) g.map.setG(xx, yy, T.DIRT);
  for (const [dx, dy] of [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2]]) {
    g.map.setO(x + dx, y + dy, O.ORE_ROCK);
    g.map.objData[g.map.idx(x + dx, y + dy)] = 5; // starmetal
  }
  g.count('meteorites');
  return 'A meteorite crashed onto your farm in the night! The glowing rocks look like starmetal.';
}

function cropFairy(g: Game): string | null {
  if (g.time.season === 3) return null;
  const growing = [...g.soil.entries()].filter(([, s]) => s.crop && !s.crop.ready && !s.crop.dead);
  if (growing.length < 6) return null;
  const [ci] = growing[g.rng.int(0, growing.length - 1)];
  const cx = ci % g.map.w, cy = Math.floor(ci / g.map.w);
  let n = 0;
  for (const [i, s] of growing) {
    const x = i % g.map.w, y = Math.floor(i / g.map.w);
    if (Math.abs(x - cx) > 4 || Math.abs(y - cy) > 4) continue;
    const cr = CROP_BY_ID.get(s.crop!.id);
    if (!cr) continue;
    s.crop!.stage = cr.stages.length;
    s.crop!.days = cr.stages.reduce((a, b) => a + b, 0);
    s.crop!.ready = true;
    n++;
  }
  if (!n) return null;
  g.count('fairies');
  return `A crop fairy visited your fields during the night. ${n} crops grew ripe overnight!`;
}

function windstorm(g: Game): string | null {
  let n = 0;
  for (let k = 0; k < 14; k++) {
    const t = freeFarmTile(g);
    if (!t) break;
    g.map.setO(t[0], t[1], g.rng.pick([O.TWIG, O.TWIG, O.ROCK, O.WEED]));
    n++;
  }
  return n ? 'A windstorm blew through overnight and scattered branches and stones across the farm.' : null;
}

function giftPouch(g: Game): string | null {
  const coins = 200 + g.rng.int(0, 4) * 100;
  g.player.money += coins;
  g.earned += coins;
  return `You found a little pouch of ${coins} coins by the mailbox. The note just says: "For the new farmer. Keep going! - A friend"`;
}

registerSystem({
  name: 'nights',
  dayStart(g) {
    g.sys.nightMsg = null;
    if (g.map.w < 100 || g.daysPlayed < 4) return;
    if (g.sys.festivals?.today?.(g)) return;
    const r = g.rng.next();
    let msg: string | null = null;
    if (r < 0.035) msg = meteorite(g);
    else if (r < 0.065) msg = cropFairy(g);
    else if (r < 0.1 && g.time.season !== 1) msg = windstorm(g);
    else if (r < 0.115 && g.time.year === 1) msg = giftPouch(g);
    g.sys.nightMsg = msg;
  },
});

export const NIGHT_EVENTS = { meteorite, cropFairy, windstorm, giftPouch };
