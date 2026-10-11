// How far each structure's imported art rises above its footprint: state glyphs, labels and wires
// hang above it, and the factory sheet's build sizes its frames by it (art/factory/gen/structs.mjs
// reads this table as text, so keep its shape).
import { STRUCT_BY_ID } from '../../data/structures';

/** extra pixels above the footprint for tall art */
export const EXTRA_TOP: Record<string, number> = {
  gleaner: 10, field_gantry: 12, rail: 0, keg: 4, jar: 14, furnace: 8, oven: 12, cheese_press: 8, hand_loom: 8, seed_sifter: 4, compost_bin: 2, charcoal_kiln: 8,
  brick_kiln: 16, bee_skep: 4, lab: 10, mill: 20, thresher: 10, sawmill: 12, steam_loom: 14, bottler: 14, assembler: 12, assembler_2: 14,
  blast_furnace: 22, crusher: 12, roaster: 10, kitchen: 16, harvester: 14, planter: 10, drill_steam: 16, drill_brass: 16,
  sprinkler_1: 2, sprinkler_2: 3, sprinkler_3: 4, mist_tower: 18, scarecrow: 14, lamp: 16, pole_wood: 20, pole_iron: 22,
  pole_tower: 40, waterwheel: 10, windmill: 30, steam_engine: 18, sunlens: 8, spring_battery: 6, chest_wood: 2, chest_iron: 2,
  chest_brass: 3, crate_out: 2, crate_req: 2, crate_store: 2, hive: 18, shipping_crate: 3, coop_1: 18, coop_2: 20, coop_3: 22,
  barn_1: 22, barn_2: 24, barn_3: 26, silo: 28, well: 8, construction_site: 16, freight_depot: 20, sign: 6, flower_pot: 4, fence_wood: 2, fence_stone: 0,
  gate: 2, tapper: 0, fish_trap: 0, fish_pond: 2,
};

export function structSize(id: string, rot: number): { W: number; H: number; top: number } {
  const def = STRUCT_BY_ID.get(id)!;
  let [w, h] = def.size;
  if (def.kind !== 'splitter' && (rot === 1 || rot === 3)) [w, h] = [h, w];
  const top = EXTRA_TOP[id] ?? 4;
  return { W: w * 16, H: h * 16 + top, top };
}
