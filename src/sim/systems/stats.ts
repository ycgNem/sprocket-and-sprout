// Production statistics: items produced / consumed with ring-buffer histories
// at three resolutions (1 s, 10 s, 60 s buckets; 60 buckets each), and per structure the state
// it was in for each of the last 60 seconds (what the Line tab's diagnosis reads).
import type { Ent, Ents } from '../ents';
import { MState, STATE_COUNT } from '../mstate';

/** a works day in sim seconds: 6am-2am awake (1,200 game minutes x 0.7 s) plus the 4-hour night shift */
export const DAY_SECS = 1200 * 0.7 + 240 * 0.7;

/** the last 60 one-second samples of every structure's state (ROADMAP.md 4.1, time in state) */
export class StateLog {
  /** id -> 60 samples (state + 1, 0 = no sample yet) */
  private ring = new Map<number, Uint8Array>();
  private head = 0;
  private acc = 0;

  /** id -> items received through its ports per second (last 60 s), and items it made or moved */
  private inRing = new Map<number, Float32Array>();
  private outRing = new Map<number, Float32Array>();
  private pendIn = new Map<number, number>();
  private pendOut = new Map<number, number>();

  /**
   * Today's and yesterday's totals per structure (6am to 6am): seconds in each state, then items
   * received and items made or moved. Farm-paced lines can't be judged on a minute, so the Lines
   * tab and the night tally read these (ROADMAP.md 4.2).
   */
  private today = new Map<number, Float64Array>();
  private yesterday = new Map<number, Float64Array>();
  private dayAt(id: number): Float64Array {
    let d = this.today.get(id);
    if (!d) this.today.set(id, (d = new Float64Array(STATE_COUNT + 3)));
    return d;
  }

  /** goods arrived at a structure through a port (arm drop, belt end, drill) */
  received(e: Ent, n: number) {
    const id = (e.parent ?? e).id;
    this.pendIn.set(id, (this.pendIn.get(id) ?? 0) + n);
    this.dayAt(id)[STATE_COUNT] += n;
  }
  /** a machine finished goods, or an arm carried them */
  moved(e: Ent, n: number) {
    const id = (e.parent ?? e).id;
    this.pendOut.set(id, (this.pendOut.get(id) ?? 0) + n);
    this.dayAt(id)[STATE_COUNT + 1] += n;
  }

  /** 6am: today becomes yesterday */
  rollDay() {
    this.yesterday = this.today;
    this.today = new Map();
  }

  /**
   * A day's record for a structure: share of the sampled time in each state, seconds sampled,
   * items in and out. `which` 'auto' reads yesterday when it ran at least 10 minutes, else today.
   */
  day(e: Ent, which: 'today' | 'yesterday' | 'auto' = 'auto'): { shares: number[]; harvestWait: number; secs: number; inN: number; outN: number; which: 'today' | 'yesterday' } {
    const id = (e.parent ?? e).id;
    const y = this.yesterday.get(id), t = this.today.get(id);
    const secsOf = (d?: Float64Array) => (d ? d.slice(0, STATE_COUNT).reduce((a, b) => a + b, 0) : 0);
    const pick = which === 'auto' ? (secsOf(y) >= 600 ? 'yesterday' : 'today') : which;
    const d = pick === 'yesterday' ? y : t;
    const secs = secsOf(d);
    const shares = new Array(STATE_COUNT).fill(0);
    if (d && secs > 0) for (let i = 0; i < STATE_COUNT; i++) shares[i] = d[i] / secs;
    return { shares, harvestWait: d && secs > 0 ? d[STATE_COUNT + 2] / secs : 0, secs, inN: d?.[STATE_COUNT] ?? 0, outN: d?.[STATE_COUNT + 1] ?? 0, which: pick };
  }

  /** items per works day (1,008 sim s: 6am-2am awake plus the night shift), from a day's record */
  perDay(e: Ent, dir: 'in' | 'out', which: 'today' | 'yesterday' | 'auto' = 'auto'): number {
    const d = this.day(e, which);
    if (d.secs <= 0) return 0;
    const n = dir === 'in' ? d.inN : d.outN;
    // a full day is reported as counted; a partial one is extrapolated
    return d.which === 'yesterday' && d.secs >= 900 ? n : (n / d.secs) * DAY_SECS;
  }

  tick(ents: Ents, dt: number) {
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc -= 1;
    this.head = (this.head + 1) % 60;
    for (const e of ents.map.values()) {
      if (e.ghost || e.parent) continue;
      let r = this.ring.get(e.id);
      if (!r) this.ring.set(e.id, (r = new Uint8Array(60)));
      r[this.head] = e.state + 1;
      const day = this.dayAt(e.id);
      day[e.state] += 1;
      if (e.fieldWait) day[STATE_COUNT + 2] += 1;
    }
    for (const [rings, pend] of [[this.inRing, this.pendIn], [this.outRing, this.pendOut]] as const) {
      for (const r of rings.values()) r[this.head] = 0;
      for (const [id, n] of pend) {
        let r = rings.get(id);
        if (!r) rings.set(id, (r = new Float32Array(60)));
        r[this.head] = n;
      }
      pend.clear();
    }
    // forget removed structures once a minute
    if (this.head === 0) for (const m of [this.ring, this.inRing, this.outRing]) for (const id of m.keys()) if (!ents.map.has(id)) m.delete(id);
  }

  /** items per minute over the sampled part of the last minute: what arrived (in) or what it made/moved (out) */
  rate(e: Ent, which: 'in' | 'out'): number {
    const id = (e.parent ?? e).id;
    const r = (which === 'in' ? this.inRing : this.outRing).get(id);
    if (!r) return 0;
    const st = this.ring.get(id);
    let n = 0, sum = 0;
    for (let i = 0; i < 60; i++) {
      if (st && !st[i]) continue;
      n++;
      sum += r[i];
    }
    return n ? (sum / n) * 60 : 0;
  }

  /** share of the sampled seconds (up to the last 60) that e spent in each state */
  shares(e: Ent): number[] {
    const out = new Array(STATE_COUNT).fill(0);
    const r = this.ring.get((e.parent ?? e).id);
    if (!r) return out;
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const v = r[i];
      if (!v) continue;
      out[v - 1]++;
      n++;
    }
    return n ? out.map((c) => c / n) : out;
  }

  share(e: Ent, s: MState): number {
    return this.shares(e)[s];
  }

  /** forget everything (a loaded save starts a fresh minute) */
  clear() {
    this.ring.clear();
    this.inRing.clear();
    this.outRing.clear();
    this.today.clear();
    this.yesterday.clear();
  }
}

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
  /** per-structure time in state */
  states = new StateLog();
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

  tick(g: { ents: Ents }, dt: number) {
    this.states.tick(g.ents, dt);
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
