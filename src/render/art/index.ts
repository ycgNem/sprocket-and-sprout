// Registers every procedural sprite family.
import { registerTerrainSprites } from './terrain';
import { registerObjectSprites, registerBuildingDesc } from './objects';
import { registerCharSprites, registerLook, getLook } from './chars';
import { invalidateSpritePrefix } from '../atlas';
import { registerIconSprites } from './icons';
import { registerStructSprites, structIcon } from './structs';
import { registerLivingSprites } from './living';
import { registerHomeSprites } from './home';
import { registerSheetSprites } from './sheets';
import { NPCS } from '../../data/npcs';
import { C } from '../../data/palette';
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
  registerSheetSprites();
  for (const n of NPCS) registerLook(n.id, n.look);
  // Mags the peddler, who drives the traveling cart
  registerLook('peddler', { skin: C.tan, hair: C.lavender, hairStyle: 'hat', shirt: C.violet, pants: C.bark, accent: C.butter, height: 'short', glasses: true });
}

export function registerMapBuildings(m: TileMap) {
  for (const b of m.buildings) registerBuildingDesc({ id: b.id, kind: b.kind, w: b.w, h: b.h, roof: b.roof, wall: b.wall });
}

export function setPlayerLook(look: NPCLook) {
  const old = getLook('player');
  if (old && JSON.stringify(old) === JSON.stringify(look)) return;
  registerLook('player', look);
  // sprites are cached by name, so frames drawn with the previous look would stick
  invalidateSpritePrefix('ch:player:');
  invalidateSpritePrefix('portrait:player:');
}
