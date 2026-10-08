// Tile map: terrain, zones, natural objects. Pure data, used by sim and renderer.

export enum T {
  VOID, GRASS, DIRT, SAND, RIVER, DEEP, PATH, PLANKS, CLIFF, ROCK, LAKE, POND, OCEAN,
  MINEFLOOR, MINEWALL, MINEWATER, LAVA, ORE_VEIN, TOWNGRASS, GARDEN, CLIFFTOP,
  WOODFLOOR, HOUSEWALL,
}

export enum Z { WILD, FARM, TOWN, FOREST, BEACH, QUARRY, MOUNTAIN, GREENHOUSE, MINE }

export enum O {
  NONE, TREE, STUMP, LOG, ROCK, BOULDER, WEED, TWIG, TALLGRASS, BUSH, FLOWER, ORE_ROCK, FORAGE, ARTIFACT,
  FENCE, BUILDING, LAMPPOST, BENCH, BARREL, GEM_ROCK, LADDER, SHAFT, ELEVATOR, REEDS, LILYPAD, MUSHROOM,
  SIGNPOST, WELL, NOTICEBOARD, MAILBOX, FLOWERBED, HEDGE, CRATE, STALAGMITE, ICE_ROCK, MINE_EXIT, CRYSTAL,
  // farmhouse furniture
  BED, STOVE, TABLE, FIREPLACE, SHELF, RUG, HOUSEPLANT, WINDOW, ALMANAC, CHAIR, DOORMAT, DRESSER, CLOCK,
  // mine treasure chest (objData: 0 small, 1 grand, 2 opened)
  TREASURE,
}

export const WATER_TERRAIN = new Set([T.RIVER, T.DEEP, T.LAKE, T.POND, T.OCEAN, T.MINEWATER, T.LAVA]);
export const BLOCK_TERRAIN = new Set([T.RIVER, T.DEEP, T.LAKE, T.POND, T.OCEAN, T.CLIFF, T.MINEWALL, T.MINEWATER, T.LAVA, T.CLIFFTOP, T.VOID, T.HOUSEWALL]);
export const SOLID_OBJ = new Set([
  O.TREE, O.STUMP, O.LOG, O.ROCK, O.BOULDER, O.WEED, O.TWIG, O.BUSH, O.ORE_ROCK, O.FENCE, O.BUILDING, O.LAMPPOST,
  O.BENCH, O.BARREL, O.GEM_ROCK, O.SIGNPOST, O.WELL, O.NOTICEBOARD, O.MAILBOX, O.HEDGE, O.CRATE, O.STALAGMITE, O.ICE_ROCK, O.CRYSTAL,
  O.BED, O.STOVE, O.TABLE, O.FIREPLACE, O.SHELF, O.HOUSEPLANT, O.ALMANAC, O.DRESSER, O.CLOCK, O.TREASURE,
]);

/** Ore types stored in objData for ORE_ROCK / ORE_VEIN tiles. */
export const ORE_TYPES = ['copper_ore', 'tin_ore', 'iron_ore', 'gold_ore', 'coal', 'starmetal_ore', 'stone', 'clay'] as const;

export interface TreeState {
  species: string;
  /** 0 seed, 1 sprout, 2 sapling, 3 young, 4 mature */
  stage: number;
  days: number;
  fruit: number;
  tapped: boolean;
  hp: number;
}

export interface BuildingInfo {
  id: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  door: [number, number];
  /** palette accents for the art */
  roof: number;
  wall: number;
}

export class TileMap {
  w: number;
  h: number;
  ground: Uint8Array;
  zone: Uint8Array;
  obj: Uint8Array;
  /** object hp / variant / ore type */
  objData: Uint8Array;
  /** extra decoration variant seed per tile */
  deco: Uint8Array;
  trees = new Map<number, TreeState>();
  forage = new Map<number, string>();
  buildings: BuildingInfo[] = [];
  /** tile -> building index + 1 */
  buildingAt: Int16Array;
  /** named locations */
  locs = new Map<string, [number, number]>();
  /** bump when terrain/objects change so the renderer rebakes chunks */
  version = 0;
  dirtyChunks = new Set<number>();
  static CHUNK = 32;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.ground = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.obj = new Uint8Array(n);
    this.objData = new Uint8Array(n);
    this.deco = new Uint8Array(n);
    this.buildingAt = new Int16Array(n);
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }
  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  g(x: number, y: number): T {
    return this.inb(x, y) ? this.ground[y * this.w + x] : T.VOID;
  }
  o(x: number, y: number): O {
    return this.inb(x, y) ? this.obj[y * this.w + x] : O.NONE;
  }
  z(x: number, y: number): Z {
    return this.inb(x, y) ? this.zone[y * this.w + x] : Z.WILD;
  }

  setG(x: number, y: number, t: T) {
    if (!this.inb(x, y)) return;
    this.ground[y * this.w + x] = t;
    this.markDirty(x, y);
  }
  setO(x: number, y: number, o: O, data = 0) {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    this.obj[i] = o;
    this.objData[i] = data;
    if (o !== O.TREE) this.trees.delete(i);
    if (o !== O.FORAGE) this.forage.delete(i);
    this.markDirty(x, y);
  }

  markDirty(x: number, y: number) {
    const C = TileMap.CHUNK;
    const cw = Math.ceil(this.w / C);
    this.dirtyChunks.add(Math.floor(y / C) * cw + Math.floor(x / C));
    // neighbors (for autotiling edges)
    if (x % C === 0 && x > 0) this.dirtyChunks.add(Math.floor(y / C) * cw + Math.floor((x - 1) / C));
    if (x % C === C - 1) this.dirtyChunks.add(Math.floor(y / C) * cw + Math.floor((x + 1) / C));
    if (y % C === 0 && y > 0) this.dirtyChunks.add(Math.floor((y - 1) / C) * cw + Math.floor(x / C));
    if (y % C === C - 1) this.dirtyChunks.add(Math.floor((y + 1) / C) * cw + Math.floor(x / C));
    this.version++;
  }

  isWater(x: number, y: number) {
    return WATER_TERRAIN.has(this.g(x, y));
  }

  /** static walkability (ignores player structures) */
  walkable(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = y * this.w + x;
    if (BLOCK_TERRAIN.has(this.ground[i])) return false;
    if (SOLID_OBJ.has(this.obj[i])) return false;
    if (this.buildingAt[i]) return false;
    return true;
  }

  addBuilding(b: BuildingInfo) {
    this.buildings.push(b);
    const n = this.buildings.length;
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!this.inb(x, y)) continue;
        this.buildingAt[this.idx(x, y)] = n;
        this.obj[this.idx(x, y)] = O.NONE;
      }
  }

  buildingAtTile(x: number, y: number): BuildingInfo | null {
    if (!this.inb(x, y)) return null;
    const n = this.buildingAt[this.idx(x, y)];
    return n ? this.buildings[n - 1] : null;
  }

  loc(id: string): [number, number] {
    const l = this.locs.get(id);
    if (!l) throw new Error('unknown location ' + id);
    return l;
  }
}
