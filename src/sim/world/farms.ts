// Farm map variants: reshape the farm area after the base world is generated.
// The rest of the valley (town, river, mine, quarry, beach) is the same on every map,
// so villager schedules and story locations keep working.
import { hash2, fbm } from '../../engine/rng';
import type { FarmKind } from '../../data/modes';
import { TileMap, T, Z, O } from './tilemap';

interface Box { x0: number; y0: number; x1: number; y1: number }

export function shapeFarm(m: TileMap, seed: number, kind: FarmKind, F: Box, plantTree: (m: TileMap, x: number, y: number, sp: string, stage: number) => void) {
  if (kind === 'classic') return;
  const idx = (x: number, y: number) => m.idx(x, y);
  const G = (x: number, y: number, t: T) => m.inb(x, y) && (m.ground[idx(x, y)] = t);
  const clearObj = (x: number, y: number) => {
    if (!m.inb(x, y)) return;
    const i = idx(x, y);
    m.obj[i] = O.NONE;
    m.objData[i] = 0;
    m.trees.delete(i);
  };
  const Ob = (x: number, y: number, o: O, d = 0) => {
    const i = idx(x, y);
    m.trees.delete(i);
    m.obj[i] = o;
    m.objData[i] = d;
  };
  // tiles that must stay as they are on every map: house yard, buildings, gates
  const kept = (x: number, y: number) => {
    const i = idx(x, y);
    if (m.buildingAt[i] || m.zone[i] === Z.GREENHOUSE) return true;
    if (Math.hypot(x - 50, y - 24) < 8.5) return true; // farmhouse yard, shipping crate, mailbox
    if (y >= 42 && y <= 48 && x > 85) return true; // east gate road
    if (x >= 53 && x <= 58 && y > 93) return true; // south gate
    if (x <= 26 && y >= 58 && y <= 64) return true; // west gate
    return false;
  };
  const inFarm = (x: number, y: number) => x > F.x0 && x < F.x1 && y >= F.y0 && y < F.y1;
  const soft = (x: number, y: number) => {
    const g = m.g(x, y);
    return g === T.GRASS || g === T.DIRT || g === T.TOWNGRASS;
  };

  if (kind === 'riverside') {
    // a stream from the northern cliffs, through the farm and the south woods to the sea
    const bridges = [[30, 31], [57, 58], [84, 85], [110, 111]];
    for (let y = F.y0 - 2; y < 125; y++) {
      const cx = 68 + 5 * Math.sin(y / 8.5) + 2 * Math.sin(y / 3.7 + 2);
      const bridge = bridges.some(([a, b]) => y === a || y === b);
      for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++) {
        if (!m.inb(x, y) || kept(x, y)) continue;
        const d = Math.abs(x + 0.5 - cx);
        if (d < 1.7) {
          clearObj(x, y);
          G(x, y, bridge ? T.PLANKS : T.RIVER);
        } else if (d < 2.7) {
          clearObj(x, y);
          if (soft(x, y) && y >= F.y0) G(x, y, hash2(x, y, seed + 7) < 0.6 ? T.SAND : T.GRASS);
        } else if (d < 3.6 && soft(x, y) && hash2(x, y, seed + 9) < 0.18 && !m.obj[idx(x, y)]) Ob(x, y, O.REEDS);
      }
    }
    // the stream steals some soil: a few more rocks on the far bank
    for (let y = F.y0; y < F.y1; y++)
      for (let x = 74; x < F.x1; x++) {
        if (kept(x, y) || !soft(x, y) || m.obj[idx(x, y)]) continue;
        if (hash2(x, y, seed + 13) < 0.06) Ob(x, y, O.ROCK, Math.floor(hash2(x, y, 5) * 3));
      }
  }

  if (kind === 'ruins') {
    // the ruined floors of an old clockwork workshop
    const halls: Box[] = [{ x0: 60, y0: 25, x1: 73, y1: 35 }, { x0: 29, y0: 39, x1: 43, y1: 50 }, { x0: 61, y0: 57, x1: 79, y1: 70 }, { x0: 33, y0: 76, x1: 47, y1: 88 }];
    for (const h of halls) {
      for (let y = h.y0; y <= h.y1; y++)
        for (let x = h.x0; x <= h.x1; x++) {
          if (kept(x, y)) continue;
          const edge = x === h.x0 || x === h.x1 || y === h.y0 || y === h.y1;
          const r = hash2(x, y, seed + 21);
          clearObj(x, y);
          if (fbm(x / 3, y / 3, seed + 23, 2) > 0.38 || edge) G(x, y, T.PATH);
          if (edge) {
            const door = (x === Math.floor((h.x0 + h.x1) / 2) || y === Math.floor((h.y0 + h.y1) / 2));
            if (!door && r < 0.62) Ob(x, y, r < 0.12 ? O.BOULDER : O.ROCK, Math.floor(r * 30) % 3);
          } else if (r < 0.05) Ob(x, y, O.ARTIFACT);
          else if (r < 0.09) Ob(x, y, O.ROCK, Math.floor(r * 100) % 3);
          else if (r < 0.11) Ob(x, y, O.TWIG, 0);
        }
    }
    // a copper seam the old tinkers mined: ore drills can run here
    const vein = { cx: 84, cy: 63, r: 2.6 };
    for (let y = vein.cy - 4; y <= vein.cy + 4; y++)
      for (let x = vein.cx - 4; x <= vein.cx + 4; x++) {
        if (!inFarm(x, y) || kept(x, y)) continue;
        if (Math.hypot(x - vein.cx, y - vein.cy) + (hash2(x, y, seed + 29) - 0.5) * 1.1 <= vein.r) {
          clearObj(x, y);
          G(x, y, T.ORE_VEIN);
          m.objData[idx(x, y)] = 0;
        }
      }
    // scattered old cogs to dig up
    for (let k = 0; k < 14; k++) {
      const x = F.x0 + 3 + Math.floor(hash2(k, 3, seed + 31) * (F.x1 - F.x0 - 6));
      const y = F.y0 + 10 + Math.floor(hash2(k, 7, seed + 31) * (F.y1 - F.y0 - 14));
      if (!kept(x, y) && soft(x, y)) Ob(x, y, O.ARTIFACT);
    }
  }

  if (kind === 'highlands') {
    // two cliff terraces with ramps; the plateaus are stony and windy
    const bands = [40, 69];
    const ramps = [[31, 35], [53, 58], [76, 80]];
    for (const by of bands)
      for (let x = F.x0 + 1; x < F.x1; x++) {
        const wob = Math.round(Math.sin(x / 5 + by) * 1.2);
        const ramp = ramps.some(([a, b]) => x >= a && x <= b);
        for (let y = by + wob; y <= by + wob + 1; y++) {
          if (kept(x, y)) continue;
          clearObj(x, y);
          if (ramp) G(x, y, T.DIRT);
          else G(x, y, y === by + wob ? T.CLIFFTOP : T.CLIFF);
        }
      }
    for (let y = F.y0; y < F.y1; y++)
      for (let x = F.x0 + 1; x < F.x1; x++) {
        if (kept(x, y)) continue;
        const i = idx(x, y);
        const r = hash2(x, y, seed + 41);
        if (m.obj[i] === O.WEED && r < 0.55) Ob(x, y, O.ROCK, Math.floor(r * 100) % 3);
        else if (!m.obj[i] && soft(x, y) && r < 0.025) Ob(x, y, O.ORE_ROCK, r < 0.012 ? 1 : 0);
        else if (!m.obj[i] && soft(x, y) && r < 0.05) Ob(x, y, O.ROCK, Math.floor(r * 1000) % 3);
      }
  }

  if (kind === 'wildwood') {
    // the forest has crept over the fields: dense trees outside a small clearing
    const species = ['oak', 'pine', 'maple', 'birch', 'pine', 'oak'];
    for (let y = F.y0 + 1; y < F.y1; y++)
      for (let x = F.x0 + 1; x < F.x1; x++) {
        if (kept(x, y) || !soft(x, y)) continue;
        if (Math.hypot(x - 50, y - 26) < 12) continue; // a clearing to start farming
        const i = idx(x, y);
        if (m.obj[i] === O.TREE) continue;
        const r = hash2(x, y, seed + 51);
        const dens = fbm(x / 7, y / 7, seed + 53, 2);
        if (r < 0.12 + dens * 0.2) {
          clearObj(x, y);
          plantTree(m, x, y, species[Math.floor(hash2(x, y, seed + 55) * species.length)], r < 0.03 ? 2 : 4);
        } else if (!m.obj[i] && r < 0.4) {
          const q = hash2(x, y, seed + 57);
          if (q < 0.2) Ob(x, y, O.BUSH);
          else if (q < 0.3) Ob(x, y, O.MUSHROOM);
          else if (q < 0.36) Ob(x, y, O.STUMP);
          else if (q < 0.39) Ob(x, y, O.LOG);
          else if (q < 0.6) Ob(x, y, O.TALLGRASS);
          else if (q < 0.7) Ob(x, y, O.FLOWER, Math.floor(q * 100) % 6);
        }
      }
  }
}
