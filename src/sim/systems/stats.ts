// Production statistics: items produced / consumed with ring-buffer histories
// at three resolutions (1 s, 10 s, 60 s buckets; 60 buckets each).

export const RES = [1, 10, 60] as const;
const N = 60;

class Series {
  /** [resolution][bucket] */
  prod = RES.map(() => new Float32Array(N));
  cons = RES.map(() => new Float32Array(N));
  totalProd = 0;
  totalCons = 0;
}

export class Stats {
  series = new Map<number, Series>();
  /** current partial bucket counters per resolution */
  private curP = new Map<number, number>();
  private curC = new Map<number, number>();
  /** sim seconds within each resolution's current bucket */
  private acc = [0, 0, 0];
  /** index of the current bucket per resolution */
  head = [0, 0, 0];
  private pend: [Map<number, number>, Map<number, number>][] = RES.map(() => [new Map(), new Map()]);

  private get(idx: number): Series {
    let s = this.series.get(idx);
    if (!s) {
      s = new Series();
      this.series.set(idx, s);
    }
    return s;
  }

  /** item produced (k = item key; quality is folded) */
  add(k: number, n: number) {
    const idx = k >> 2;
    this.get(idx).totalProd += n;
    for (const p of this.pend) p[0].set(idx, (p[0].get(idx) ?? 0) + n);
  }

  use(k: number, n: number) {
    const idx = k >> 2;
    this.get(idx).totalCons += n;
    for (const p of this.pend) p[1].set(idx, (p[1].get(idx) ?? 0) + n);
  }

  tick(_g: unknown, dt: number) {
    for (let r = 0; r < RES.length; r++) {
      this.acc[r] += dt;
      if (this.acc[r] >= RES[r]) {
        this.acc[r] -= RES[r];
        const h = (this.head[r] = (this.head[r] + 1) % N);
        for (const s of this.series.values()) {
          s.prod[r][h] = 0;
          s.cons[r][h] = 0;
        }
        const [pp, pc] = this.pend[r];
        // write the finished bucket at the previous head
        const prev = (h + N - 1) % N;
        for (const [idx, n] of pp) this.get(idx).prod[r][prev] += n;
        for (const [idx, n] of pc) this.get(idx).cons[r][prev] += n;
        pp.clear();
        pc.clear();
      }
    }
  }

  /** items per minute over the window of a resolution (average of complete buckets) */
  rate(idx: number, res: number, which: 'prod' | 'cons'): number {
    const s = this.series.get(idx);
    if (!s) return 0;
    const arr = s[which][res];
    let sum = 0;
    for (let i = 0; i < N; i++) if (i !== this.head[res]) sum += arr[i];
    return (sum / ((N - 1) * RES[res])) * 60;
  }

  /** ordered history oldest -> newest (complete buckets only), as items/min */
  history(idx: number, res: number, which: 'prod' | 'cons'): number[] {
    const s = this.series.get(idx);
    const out: number[] = [];
    for (let i = 1; i < N; i++) {
      const j = (this.head[res] + i) % N;
      out.push(s ? (s[which][res][j] / RES[res]) * 60 : 0);
    }
    return out;
  }

  totals() {
    return [...this.series.entries()].map(([idx, s]) => ({ idx, prod: s.totalProd, cons: s.totalCons }));
  }

  toJSON() {
    return this.totals();
  }

  load(data: { idx: number; prod: number; cons: number }[]) {
    for (const d of data) {
      const s = this.get(d.idx);
      s.totalProd = d.prod;
      s.totalCons = d.cons;
    }
  }
}
