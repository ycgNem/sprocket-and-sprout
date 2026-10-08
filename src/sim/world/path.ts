// A* pathfinding on the tile grid (4-directional) with a binary heap.
import type { TileMap } from './tilemap';

class Heap {
  a: number[] = [];
  f: Float64Array;
  constructor(n: number) {
    this.f = new Float64Array(n);
  }
  push(i: number, f: number) {
    this.f[i] = f;
    const a = this.a;
    a.push(i);
    let c = a.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[c]]) break;
      [a[p], a[c]] = [a[c], a[p]];
      c = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l;
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r;
        if (m === c) break;
        [a[m], a[c]] = [a[c], a[m]];
        c = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

let gBuf: Float64Array | null = null;
let fromBuf: Int32Array | null = null;
let stampBuf: Int32Array | null = null;
let stamp = 1;

/** Returns list of tiles from start (exclusive) to goal (inclusive), or null. */
export function findPath(m: TileMap, sx: number, sy: number, gx: number, gy: number, walk: (x: number, y: number) => boolean, maxNodes = 20000): [number, number][] | null {
  const W = m.w, N = m.w * m.h;
  if (!gBuf || gBuf.length !== N) {
    gBuf = new Float64Array(N);
    fromBuf = new Int32Array(N);
    stampBuf = new Int32Array(N);
  }
  stamp++;
  const G = gBuf, from = fromBuf!, st = stampBuf!;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  const heap = new Heap(N);
  G[start] = 0;
  st[start] = stamp;
  from[start] = -1;
  heap.push(start, Math.abs(sx - gx) + Math.abs(sy - gy));
  let visited = 0;
  const closed = new Set<number>();
  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (++visited > maxNodes) return null;
    const cx = cur % W, cy = (cur - cx) / W;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 1 ? 1 : d === 3 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 0 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const ni = ny * W + nx;
      if (ni !== goal && !walk(nx, ny)) continue;
      const ng = G[cur] + 1;
      if (st[ni] === stamp && G[ni] <= ng) continue;
      st[ni] = stamp;
      G[ni] = ng;
      from[ni] = cur;
      heap.push(ni, ng + (Math.abs(nx - gx) + Math.abs(ny - gy)) * 1.05);
    }
  }
  if (st[goal] !== stamp) return null;
  const path: [number, number][] = [];
  let c = goal;
  while (c !== start && c >= 0) {
    path.push([c % W, Math.floor(c / W)]);
    c = from[c];
  }
  path.reverse();
  return path;
}
