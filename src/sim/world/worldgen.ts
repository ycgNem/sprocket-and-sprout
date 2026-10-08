// Overworld generation: hand-shaped macro layout + seeded procedural decoration.
import { Rng, fbm, hash2, valueNoise } from '../../engine/rng';
import { C } from '../../data/palette';
import { TileMap, T, Z, O, BuildingInfo } from './tilemap';

export const WORLD_W = 200;
export const WORLD_H = 150;

export const FARM = { x0: 22, y0: 16, x1: 93, y1: 98 };
export const HOUSE = { x: 46, y: 17, w: 7, h: 5 };
export const SHIPBIN_POS: [number, number] = [54, 21];
export const GREENHOUSE = { x: 28, y: 18, w: 11, h: 8 };
export const PLAYER_START: [number, number] = [49.5, 23.5];

export function riverX(y: number) {
  return 98 + 3 * Math.sin(y / 11) + 1.5 * Math.sin(y / 4.7 + 1);
}

export function generateWorld(seed: number): TileMap {
  const m = new TileMap(WORLD_W, WORLD_H);
  const rng = new Rng(seed);
  const W = WORLD_W, H = WORLD_H;

  // ---------- base ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = m.idx(x, y);
      m.ground[i] = T.GRASS;
      m.deco[i] = Math.floor(hash2(x, y, seed) * 256);
    }

  const rect = (x0: number, y0: number, x1: number, y1: number, f: (x: number, y: number) => void) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) f(x, y);
  };
  const setZ = (x: number, y: number, z: Z) => (m.zone[m.idx(x, y)] = z);
  const G = (x: number, y: number, t: T) => m.inb(x, y) && (m.ground[m.idx(x, y)] = t);
  const Ob = (x: number, y: number, o: O, d = 0) => {
    if (!m.inb(x, y)) return;
    const i = m.idx(x, y);
    m.obj[i] = o;
    m.objData[i] = d;
  };

  // ---------- zones (rough) ----------
  rect(0, 0, W - 1, H - 1, (x, y) => {
    const n = (fbm(x / 9, y / 9, seed + 7, 3) - 0.5) * 6;
    let z = Z.WILD;
    if (x < 20 + n && y > 10) z = Z.FOREST;
    if (y > 99 + n * 0.5 && y < 123 && x < 96) z = Z.FOREST;
    if (x >= FARM.x0 && x <= FARM.x1 && y >= FARM.y0 && y <= FARM.y1) z = Z.FARM;
    if (x >= 103 && x <= 171 && y >= 28 && y <= 104) z = Z.TOWN;
    if (x >= 172 && y >= 6 && y <= 50) z = Z.QUARRY;
    if (y >= 123 + n * 0.4) z = Z.BEACH;
    setZ(x, y, z);
  });

  // ---------- mountains (north) ----------
  for (let x = 0; x < W; x++) {
    const top = 11 + Math.round((valueNoise(x / 7, 0, seed + 3) - 0.5) * 6) + (x > 110 && x < 140 ? -1 : 0);
    for (let y = 0; y <= top; y++) {
      G(x, y, y < top - 2 ? T.CLIFFTOP : T.CLIFF);
      setZ(x, y, Z.MOUNTAIN);
    }
  }
  // farm sits below the mountains
  rect(FARM.x0, 0, FARM.x1, FARM.y0 - 1, (x, y) => {
    G(x, y, y < FARM.y0 - 3 ? T.CLIFFTOP : T.CLIFF);
    setZ(x, y, Z.MOUNTAIN);
  });
  // quarry walls
  rect(172, 0, W - 1, 5, (x, y) => { G(x, y, T.CLIFFTOP); setZ(x, y, Z.MOUNTAIN); });
  rect(196, 0, W - 1, 52, (x, y) => { G(x, y, T.CLIFF); setZ(x, y, Z.MOUNTAIN); });
  rect(172, 51, W - 1, 54, (x, y) => { G(x, y, T.CLIFF); setZ(x, y, Z.MOUNTAIN); });

  // ---------- quarry ----------
  rect(172, 6, 195, 50, (x, y) => { G(x, y, T.ROCK); setZ(x, y, Z.QUARRY); });
  // quarry entrance gap from the east road
  rect(170, 39, 173, 42, (x, y) => G(x, y, T.PATH));
  const veins: [number, number, number, number][] = [
    // cx, cy, radius, ore type index (ORE_TYPES)
    [178, 14, 3, 0], [188, 12, 3, 4], [190, 26, 3, 1], [179, 30, 3, 2], [186, 40, 2, 3], [180, 45, 2, 4], [192, 46, 2, 0],
  ];
  for (const [cx, cy, r, ore] of veins) {
    rect(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
      const d = Math.hypot(x - cx, y - cy) + (hash2(x, y, seed + 11) - 0.5) * 1.2;
      if (d <= r) {
        G(x, y, T.ORE_VEIN);
        m.objData[m.idx(x, y)] = ore;
      }
    });
  }
  // quarry rocks (respawning)
  rect(173, 7, 195, 49, (x, y) => {
    if (m.g(x, y) !== T.ROCK) return;
    const h = hash2(x, y, seed + 21);
    if (h < 0.1) Ob(x, y, O.ROCK, Math.floor(h * 40) % 3);
    else if (h < 0.14) Ob(x, y, O.ORE_ROCK, [0, 1, 0, 2, 4, 1, 0, 2][Math.floor(h * 1000) % 8]);
    else if (h < 0.15) Ob(x, y, O.BOULDER);
  });

  // ---------- lake (north-east, below mountains) ----------
  const lake = { cx: 158, cy: 22, rx: 11, ry: 7 };
  rect(lake.cx - lake.rx - 3, lake.cy - lake.ry - 3, lake.cx + lake.rx + 3, lake.cy + lake.ry + 3, (x, y) => {
    const dx = (x - lake.cx) / lake.rx, dy = (y - lake.cy) / lake.ry;
    const d = Math.sqrt(dx * dx + dy * dy) + (fbm(x / 4, y / 4, seed + 31, 2) - 0.5) * 0.35;
    if (d < 1) { G(x, y, T.LAKE); setZ(x, y, Z.WILD); }
    else if (d < 1.18 && m.g(x, y) === T.GRASS) G(x, y, T.SAND);
  });
  // dock
  rect(152, 26, 153, 31, (x, y) => G(x, y, T.PLANKS));

  // ---------- river ----------
  for (let y = 6; y < H; y++) {
    const cx = riverX(y);
    for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < 2.4) { G(x, y, T.RIVER); setZ(x, y, Z.WILD); }
      else if (d < 3.2 && y > 12 && m.zone[m.idx(x, y)] !== Z.FARM && hash2(x, y, seed) < 0.5) G(x, y, T.SAND);
    }
  }

  // ---------- ocean + beach ----------
  for (let x = 0; x < W; x++) {
    const shore = 132 + Math.round((valueNoise(x / 8, 5, seed + 41) - 0.5) * 4);
    const sand = 124 + Math.round((valueNoise(x / 6, 9, seed + 43) - 0.5) * 3);
    for (let y = sand; y < H; y++) {
      if (y < shore) { G(x, y, T.SAND); setZ(x, y, Z.BEACH); }
      else if (y < shore + 4) { G(x, y, T.OCEAN); setZ(x, y, Z.BEACH); }
      else { G(x, y, T.DEEP); setZ(x, y, Z.BEACH); }
    }
  }
  // pier
  rect(138, 124, 140, 141, (x, y) => G(x, y, T.PLANKS));
  // tidepools
  rect(60, 127, 70, 133, (x, y) => {
    if (hash2(x, y, seed + 51) < 0.25 && m.g(x, y) === T.SAND) Ob(x, y, O.ROCK, 1);
  });

  // ---------- forest pond ----------
  const pond = { cx: 10, cy: 66, rx: 5, ry: 4 };
  rect(pond.cx - 7, pond.cy - 6, pond.cx + 7, pond.cy + 6, (x, y) => {
    const dx = (x - pond.cx) / pond.rx, dy = (y - pond.cy) / pond.ry;
    const d = Math.sqrt(dx * dx + dy * dy) + (hash2(x, y, seed + 61) - 0.5) * 0.25;
    if (d < 1) G(x, y, T.POND);
  });
  // farm pond (water for the watering can)
  const fp = { cx: 82, cy: 30, rx: 4, ry: 3 };
  rect(fp.cx - 6, fp.cy - 5, fp.cx + 6, fp.cy + 5, (x, y) => {
    const dx = (x - fp.cx) / fp.rx, dy = (y - fp.cy) / fp.ry;
    if (Math.sqrt(dx * dx + dy * dy) + (hash2(x, y, seed + 62) - 0.5) * 0.3 < 1) G(x, y, T.POND);
  });

  // ---------- paths ----------
  const path = (x0: number, y0: number, x1: number, y1: number, w = 2, t = T.PATH) => {
    rect(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1) + (y0 === y1 ? 0 : w - 1), Math.max(y0, y1) + (y0 === y1 ? w - 1 : 0), (x, y) => {
      const g = m.g(x, y);
      if (g === T.RIVER || g === T.LAKE || g === T.POND) G(x, y, T.PLANKS);
      else if (g !== T.CLIFF && g !== T.CLIFFTOP) G(x, y, t);
    });
  };
  // bridges & roads
  path(90, 44, 128, 44, 3); // farm east gate -> north bridge -> north avenue
  path(128, 13, 128, 124, 2); // north/south avenue (mine to beach)
  path(103, 60, 170, 60, 2); // main street
  path(128, 40, 173, 40, 2); // east road to quarry
  path(90, 88, 128, 88, 3); // south bridge road
  path(103, 60, 103, 88, 2); // west street
  // town square plaza
  rect(122, 53, 143, 68, (x, y) => G(x, y, T.PATH));
  // farm gates
  path(14, 60, 22, 60, 2); // west gate to forest
  path(55, 98, 55, 124, 2, T.DIRT); // south gate through forest to beach
  path(8, 43, 14, 43, 2, T.DIRT); // to hermit hut
  path(14, 43, 14, 61, 2, T.DIRT);

  // mine approach
  rect(123, 12, 134, 17, (x, y) => { G(x, y, T.PATH); setZ(x, y, Z.TOWN); });

  // ---------- buildings ----------
  const bld = (id: string, kind: string, name: string, x: number, y: number, w: number, h: number, roof: number, wall: number, locId?: string) => {
    const door: [number, number] = [x + Math.floor(w / 2), y + h - 1];
    const b: BuildingInfo = { id, kind, name, x, y, w, h, door, roof, wall };
    m.addBuilding(b);
    // clear the front & make a little stoop
    rect(door[0] - 1, y + h, door[0] + 1, y + h + 1, (xx, yy) => {
      m.obj[m.idx(xx, yy)] = O.NONE;
      if (m.g(xx, yy) === T.GRASS) G(xx, yy, T.PATH);
    });
    if (locId) {
      m.locs.set(locId, [door[0], y + h]);
      m.locs.set(locId + '_in', [door[0], door[1]]);
    }
    return b;
  };
  bld('store', 'shop', 'Thistlewick Mercantile', 106, 50, 8, 6, C.rose, C.cream, 'store');
  bld('inn', 'shop', 'The Copper Kettle', 144, 50, 9, 6, C.copper, C.tan, 'inn');
  bld('smithy', 'shop', 'The Anvil & Ember', 156, 63, 7, 6, C.slate, C.stone, 'smithy');
  bld('carpenter', 'shop', 'Oakroot Joinery', 106, 64, 8, 6, C.moss, C.oak, 'carpenter');
  bld('workshop', 'shop', 'Cogwhistle Workshop', 114, 76, 8, 6, C.brass, C.walnut, 'workshop');
  bld('clinic', 'shop', 'Valley Clinic', 134, 72, 7, 5, C.aqua, C.cream, 'clinic');
  bld('library', 'house', 'Library & Schoolhouse', 144, 72, 8, 6, C.violet, C.tan, 'library');
  bld('mayor_house', 'house', "Mayor's Manor", 150, 32, 8, 6, C.wine, C.butter, 'mayor_house');
  bld('ranch', 'shop', 'Meadowlark Ranch', 158, 84, 9, 6, C.brick, C.oak, 'ranch');
  bld('home_ines', 'house', 'Marrow Cottage', 104, 79, 6, 5, C.sky, C.cream, 'home_ines');
  bld('home_sable', 'house', 'Moss House', 136, 83, 6, 5, C.moss, C.butter, 'home_sable');
  bld('home_hazel', 'house', 'Quill Cottage', 146, 83, 6, 5, C.blush, C.cream, 'home_hazel');
  bld('house_a', 'house', 'Cottage', 112, 31, 6, 5, C.terracotta, C.cream);
  bld('house_b', 'house', 'Cottage', 134, 31, 6, 5, C.river, C.tan);
  bld('fisher_hut', 'shop', "Halloway's Bait & Tackle", 146, 117, 6, 5, C.river, C.pebble, 'fisher_hut');
  bld('hermit_hut', 'house', "Thorne's Hollow", 5, 37, 6, 5, C.moss, C.walnut, 'hermit_hut');
  const tower = bld('clocktower', 'tower', 'Old Clocktower', 131, 54, 5, 6, C.slate, C.pebble);
  m.locs.set('clocktower', [tower.door[0], tower.y + tower.h]);
  bld('mine', 'mine', 'Old Mine', 126, 9, 5, 4, C.walnut, C.stone);
  m.locs.set('mine_entrance', [128, 14]);
  // farm buildings
  const house = bld('farmhouse', 'farmhouse', 'Farmhouse', HOUSE.x, HOUSE.y, HOUSE.w, HOUSE.h, C.terracotta, C.cream);
  m.locs.set('farmhouse', [house.door[0], house.y + house.h]);
  bld('greenhouse', 'greenhouse', 'Greenhouse', GREENHOUSE.x, GREENHOUSE.y, GREENHOUSE.w, 2, C.frost, C.walnut);

  // greenhouse interior (zone + soil floor) under the glass roof
  rect(GREENHOUSE.x, GREENHOUSE.y + 2, GREENHOUSE.x + GREENHOUSE.w - 1, GREENHOUSE.y + GREENHOUSE.h - 1, (x, y) => {
    setZ(x, y, Z.GREENHOUSE);
    G(x, y, T.DIRT);
  });

  // ---------- named locations ----------
  const L = (id: string, x: number, y: number) => m.locs.set(id, [x, y]);
  L('square', 133, 63); L('square_east', 140, 62); L('square_west', 125, 61); L('board', 126, 65);
  L('garden', 120, 95); L('inn_patio', 154, 57);
  L('pier', 139, 139); L('beach', 128, 128); L('beach_west', 80, 128); L('tidepools', 64, 129);
  L('lake_dock', 152, 30); L('lake_shore', 162, 32); L('riverbank_north', 104, 32); L('riverbank_south', 104, 100);
  L('bridge_north', 98, 45); L('bridge_south', 98, 89); L('forest_path', 16, 61); L('forest_glade', 48, 112);
  L('forest_pond', 16, 66); L('quarry', 176, 40); L('hilltop', 167, 74); L('farm_gate', 92, 45); L('orchard_road', 115, 45);
  L('player_start', Math.floor(PLAYER_START[0]), Math.floor(PLAYER_START[1]));

  // community garden & notice board
  rect(116, 92, 124, 98, (x, y) => G(x, y, T.GARDEN));
  rect(116, 92, 124, 98, (x, y) => { if ((x + y) % 2 === 0) Ob(x, y, O.FLOWERBED, (x * 7 + y) % 4); });
  Ob(126, 64, O.NOTICEBOARD);

  // ---------- town decoration ----------
  rect(103, 28, 171, 104, (x, y) => {
    const i = m.idx(x, y);
    if (m.buildingAt[i] || m.ground[i] !== T.GRASS) return;
    m.ground[i] = T.TOWNGRASS;
    const h = hash2(x, y, seed + 71);
    const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.g(x + dx, y + dy) === T.PATH);
    if (nearPath && h < 0.035) Ob(x, y, O.LAMPPOST);
    else if (h < 0.025) plantTree(m, x, y, h < 0.012 ? 'maple' : 'oak', 4);
    else if (h < 0.06) Ob(x, y, O.FLOWER, Math.floor(h * 1000) % 6);
    else if (h < 0.075) Ob(x, y, O.BUSH);
  });
  // square furniture
  for (const [x, y] of [[124, 56], [124, 66], [141, 56], [141, 66]] as const) Ob(x, y, O.LAMPPOST);
  for (const [x, y] of [[127, 58], [138, 58], [127, 66], [138, 66]] as const) Ob(x, y, O.BENCH);
  for (const [x, y] of [[123, 60], [142, 60], [130, 67], [136, 67]] as const) Ob(x, y, O.FLOWERBED, (x + y) % 4);
  // hedges around homes
  for (const b of m.buildings) {
    if (b.kind !== 'house') continue;
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const y = b.y + b.h + 2;
      if (Math.abs(x - b.door[0]) > 1 && m.g(x, y) === T.TOWNGRASS && !m.obj[m.idx(x, y)]) Ob(x, y, O.HEDGE);
    }
  }
  // ranch paddock fence
  rect(158, 91, 170, 100, (x, y) => {
    if ((x === 158 || x === 170 || y === 91 || y === 100) && m.g(x, y) !== T.PATH && !(y === 91 && x >= 161 && x <= 163)) Ob(x, y, O.FENCE);
    else if (m.obj[m.idx(x, y)] && m.obj[m.idx(x, y)] !== O.FENCE) m.obj[m.idx(x, y)] = O.NONE;
  });

  // ---------- forests ----------
  const treeSpecies = ['oak', 'pine', 'maple', 'birch', 'pine'];
  for (let y = 12; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = m.idx(x, y);
      const z = m.zone[i];
      if (m.ground[i] !== T.GRASS || m.obj[i] || m.buildingAt[i]) continue;
      const h = hash2(x, y, seed + 81);
      const dens = fbm(x / 6, y / 6, seed + 83, 2);
      if (z === Z.FOREST) {
        if (h < 0.18 + dens * 0.25) {
          const sp = treeSpecies[Math.floor(hash2(x, y, seed + 85) * treeSpecies.length)];
          plantTree(m, x, y, y > 100 && hash2(x, y, 9) < 0.3 ? 'willow' : sp, 4);
        } else if (h < 0.5) {
          const r = hash2(x, y, seed + 87);
          if (r < 0.15) Ob(x, y, O.BUSH);
          else if (r < 0.3) Ob(x, y, O.FLOWER, Math.floor(r * 100) % 6);
          else if (r < 0.4) Ob(x, y, O.TALLGRASS);
          else if (r < 0.43) Ob(x, y, O.MUSHROOM);
          else if (r < 0.46) Ob(x, y, O.STUMP);
          else if (r < 0.47) Ob(x, y, O.LOG);
        }
      } else if (z === Z.WILD || z === Z.BEACH) {
        if (m.ground[i] === T.GRASS) {
          if (h < 0.05) plantTree(m, x, y, treeSpecies[Math.floor(h * 100) % 5], 4);
          else if (h < 0.12) Ob(x, y, O.FLOWER, Math.floor(h * 1000) % 6);
          else if (h < 0.2) Ob(x, y, O.TALLGRASS);
        }
      }
    }
  // keep the forest paths & glade clear
  const clear = (cx: number, cy: number, r: number) =>
    rect(cx - r, cy - r, cx + r, cy + r, (x, y) => {
      if (Math.hypot(x - cx, y - cy) <= r) {
        const i = m.idx(x, y);
        if (m.obj[i] === O.TREE || m.obj[i] === O.STUMP || m.obj[i] === O.LOG || m.obj[i] === O.BUSH) Ob(x, y, O.NONE);
      }
    });
  clear(48, 112, 4);
  for (let y = 98; y < 125; y++) clear(56, y, 1);
  for (let x = 6; x < 22; x++) clear(x, 61, 1);
  for (let y = 43; y < 62; y++) clear(15, y, 1);
  for (let x = 8; x < 15; x++) clear(x, 44, 1);
  rect(44, 108, 52, 116, (x, y) => {
    if (Math.hypot(x - 48, y - 112) <= 4 && hash2(x, y, seed) < 0.35) Ob(x, y, O.FLOWER, Math.floor(hash2(x, y, 3) * 6));
  });
  // beach decoration: palms and shells
  for (let x = 0; x < W; x++)
    for (let y = 120; y < 134; y++) {
      if (m.g(x, y) !== T.SAND || m.obj[m.idx(x, y)]) continue;
      const h = hash2(x, y, seed + 91);
      if (h < 0.015 && y < 129) plantTree(m, x, y, 'palm', 4);
    }
  // lake reeds & lilies
  rect(140, 10, 176, 36, (x, y) => {
    const g = m.g(x, y);
    const h = hash2(x, y, seed + 93);
    if (g === T.LAKE && h < 0.05) Ob(x, y, O.LILYPAD);
    if ((g === T.SAND || g === T.GRASS) && h < 0.25 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.g(x + dx, y + dy) === T.LAKE)) Ob(x, y, O.REEDS);
  });
  // pond lilies/reeds
  rect(2, 58, 18, 74, (x, y) => {
    const h = hash2(x, y, seed + 95);
    if (m.g(x, y) === T.POND && h < 0.08) Ob(x, y, O.LILYPAD);
    if (m.g(x, y) === T.GRASS && h < 0.3 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.g(x + dx, y + dy) === T.POND)) Ob(x, y, O.REEDS);
  });

  // ---------- the overgrown farm ----------
  rect(FARM.x0, FARM.y0, FARM.x1, FARM.y1, (x, y) => {
    const i = m.idx(x, y);
    if (m.buildingAt[i] || m.zone[i] === Z.GREENHOUSE) return;
    const g = m.ground[i];
    if (g !== T.GRASS) return;
    // patches of bare dirt
    if (fbm(x / 5, y / 5, seed + 101, 2) > 0.62) m.ground[i] = T.DIRT;
    // starting clearing around the house
    const dHouse = Math.hypot(x - (HOUSE.x + 3), y - (HOUSE.y + 7));
    if (dHouse < 7.5) return;
    if (y >= 43 && y <= 47 && x > 86) return; // east gate road
    if (Math.abs(x - 55) <= 1 && y > 94) return; // south gate
    const h = hash2(x, y, seed + 103);
    const thick = fbm(x / 8, y / 8, seed + 105, 3);
    if (h < 0.035 + thick * 0.04) plantTree(m, x, y, ['oak', 'maple', 'pine'][Math.floor(hash2(x, y, 5) * 3)], h < 0.01 ? 2 : 4);
    else if (h < 0.17) Ob(x, y, O.WEED, Math.floor(h * 1000) % 3);
    else if (h < 0.23) Ob(x, y, O.ROCK, Math.floor(h * 1000) % 3);
    else if (h < 0.28) Ob(x, y, O.TWIG, Math.floor(h * 1000) % 2);
    else if (h < 0.285) Ob(x, y, O.STUMP);
    else if (h < 0.288) Ob(x, y, O.BOULDER);
    else if (thick > 0.55 && h < 0.4) Ob(x, y, O.TALLGRASS);
  });
  // farm border: trees on west/south edges
  rect(FARM.x0, FARM.y0, FARM.x1, FARM.y1, (x, y) => {
    if (x === FARM.x0 || y === FARM.y1) {
      if ((x === FARM.x0 && Math.abs(y - 61) <= 2) || (y === FARM.y1 && Math.abs(x - 56) <= 2)) return;
      if (!m.obj[m.idx(x, y)] && !m.buildingAt[m.idx(x, y)]) plantTree(m, x, y, 'pine', 4);
    }
  });
  Ob(SHIPBIN_POS[0] + 2, SHIPBIN_POS[1], O.MAILBOX);

  // artifact spots everywhere outdoors (respawn daily too)
  for (let k = 0; k < 40; k++) spawnArtifact(m, rng);

  return m;
}

export function plantTree(m: TileMap, x: number, y: number, species: string, stage: number) {
  if (!m.inb(x, y)) return;
  const i = m.idx(x, y);
  m.obj[i] = O.TREE;
  m.objData[i] = 0;
  m.trees.set(i, { species, stage, days: 0, fruit: 0, tapped: false, hp: 10 });
}

export function spawnArtifact(m: TileMap, rng: Rng) {
  for (let tries = 0; tries < 30; tries++) {
    const x = rng.int(1, m.w - 2), y = rng.int(13, m.h - 20);
    const i = m.idx(x, y);
    const g = m.ground[i];
    if ((g === T.GRASS || g === T.DIRT || g === T.SAND || g === T.TOWNGRASS) && !m.obj[i] && !m.buildingAt[i] && m.zone[i] !== Z.FARM) {
      m.obj[i] = O.ARTIFACT;
      m.markDirty(x, y);
      return;
    }
  }
}
