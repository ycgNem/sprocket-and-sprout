// Registers every procedural sprite family.
import { registerTerrainSprites } from './terrain';
import { registerObjectSprites, registerBuildingDesc } from './objects';
import { registerCharSprites, registerLook } from './chars';
import { registerIconSprites } from './icons';
import { registerStructSprites, structIcon } from './structs';
import { registerLivingSprites } from './living';
import { registerHomeSprites } from './home';
import { NPCS } from '../../data/npcs';
import type { TileMap } from '../../sim/world/tilemap';
import type { NPCLook } from '../../data/types';

let done = false;
export function registerAllArt() {
  if (done) return;
  done = true;
  registerTerrainSprites();
  registerObjectSprites();
  registerCharSprites();
  registerIconSprites(structIcon);
  registerStructSprites();
  registerLivingSprites();
  registerHomeSprites();
  for (const n of NPCS) registerLook(n.id, n.look);
}

export function registerMapBuildings(m: TileMap) {
  for (const b of m.buildings) registerBuildingDesc({ id: b.id, kind: b.kind, w: b.w, h: b.h, roof: b.roof, wall: b.wall });
}

export function setPlayerLook(look: NPCLook) {
  registerLook('player', look);
}
