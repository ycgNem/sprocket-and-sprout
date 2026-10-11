// Registers the sprites made at runtime (the imported sheets cover the rest): shadows of any width,
// belt-size icons from the imported icons, and the looks the character sheets recolor by.
import { registerLook, getLook, registerShadowSprites } from './chars';
import { invalidateSpritePrefix } from '../atlas';
import { registerBeltIcons } from './icons';
import { registerSheetSprites } from './sheets';
import { NPCS } from '../../data/npcs';
import { C } from '../../data/palette';
import type { NPCLook } from '../../data/types';

let done = false;
export function registerAllArt() {
  if (done) return;
  done = true;
  registerShadowSprites();
  registerBeltIcons();
  registerSheetSprites();
  for (const n of NPCS) registerLook(n.id, n.look);
  // Mags the peddler, who drives the traveling cart
  registerLook('peddler', { skin: C.tan, hair: C.lavender, hairStyle: 'hat', shirt: C.violet, pants: C.bark, accent: C.butter, height: 'short', glasses: true });
}

export function setPlayerLook(look: NPCLook) {
  const old = getLook('player');
  if (old && JSON.stringify(old) === JSON.stringify(look)) return;
  registerLook('player', look);
  // sprites are cached by name, so frames drawn with the previous look would stick
  invalidateSpritePrefix('ch:player:');
  invalidateSpritePrefix('portrait:player:');
}
