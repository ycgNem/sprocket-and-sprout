// Pure lookup rules for imported sheets (unit-tested in tests/art.test.ts): sprite-name patterns
// and the terrain dual grid's tile choice per grid vertex.

/** Does a sprite name match a pattern (`*` = one `:` segment, a final `**` = the rest)? */
export function matchSprite(pattern: string, name: string): boolean {
  if (pattern === name) return true;
  const p = pattern.split(':'), n = name.split(':');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '**' && i === p.length - 1) return true;
    if (i >= n.length || (p[i] !== '*' && p[i] !== n[i])) return false;
  }
  return p.length === n.length;
}

/** draw order when a vertex has no set for its classes: the higher priority class takes the corner */
export const CLASS_PRIO: Record<string, number> = { deep: 0, water: 1, sand: 2, dirt: 3, path: 4, soil: 5, wet: 6, grass: 7 };
/** a class that has to give way turns into its kin first (dry and watered soil stay one plot) */
const KIN: Record<string, string> = { soil: 'wet', wet: 'soil', water: 'deep', deep: 'water' };

export interface TerrainIndex {
  bases: Record<string, unknown[]>;
  sets: { lower: string; upper: string; tiles: Record<string, unknown[]> }[];
}

export type VertexPick = { base: string; v: number } | { set: number; mask: number; v: number } | null;

const variant = (list: unknown[] | undefined, h: number) => (list && list.length ? Math.min(list.length - 1, Math.floor(h * list.length)) : -1);

/**
 * The tile for a grid vertex whose four surrounding map tiles have classes nw, ne, sw, se: a base
 * tile when they agree, the Wang tile of the pair's set (mask bits NW 8, NE 4, SW 2, SE 1 = upper)
 * for two classes. Classes without a set for their pair give way, the rarest (then the lowest
 * priority) first, to their kin if present (soil ↔ wet, water ↔ deep), else to the most common
 * class, which leaves a hard edge. h (0..1) picks the variant.
 */
export function pickVertex(m: TerrainIndex, corners: string[], h: number): VertexPick {
  const cs = [...corners];
  for (let guard = 0; guard < 4; guard++) {
    const kinds = [...new Set(cs)];
    if (kinds.length === 1) {
      const v = variant(m.bases[kinds[0]], h);
      return v < 0 ? null : { base: kinds[0], v };
    }
    if (kinds.length === 2) {
      const [a, b] = kinds;
      let i = m.sets.findIndex((s) => s.lower === a && s.upper === b), upper = b;
      if (i < 0) { i = m.sets.findIndex((s) => s.lower === b && s.upper === a); upper = a; }
      if (i >= 0) {
        const mask = (cs[0] === upper ? 8 : 0) | (cs[1] === upper ? 4 : 0) | (cs[2] === upper ? 2 : 0) | (cs[3] === upper ? 1 : 0);
        const v = variant(m.sets[i].tiles[String(mask)], h);
        if (v >= 0) return { set: i, mask, v };
      }
    }
    const count = (k: string) => cs.filter((c) => c === k).length;
    kinds.sort((a, b) => count(a) - count(b) || (CLASS_PRIO[a] ?? 0) - (CLASS_PRIO[b] ?? 0));
    const loser = kinds[0];
    const winner = KIN[loser] && kinds.includes(KIN[loser]) ? KIN[loser] : kinds[kinds.length - 1];
    for (let j = 0; j < 4; j++) if (cs[j] === loser) cs[j] = winner;
  }
  return null;
}
