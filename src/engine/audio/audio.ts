// Procedural audio: synthesized SFX, ambient beds, and a generative music loop
// whose key, scale, tempo and instrumentation follow the season and time of day.
import type { Game } from '../../sim/Game';
import { playSfxr } from './sfxr';

interface Vol { master: number; music: number; sfx: number }

type Env = { a: number; d: number; s?: number; r?: number };

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  delay!: DelayNode;
  delayFb!: GainNode;
  noiseBuf!: AudioBuffer;
  vol: Vol;
  scene: 'title' | 'farm' | 'mine' | 'festival' | 'night' | 'home' = 'title';
  private nextNote = 0;
  private step = 0;
  private chord = 0;
  private rain: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } | null = null;
  private wind: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } | null = null;
  private hum: { o: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;
  private crickets = 0;
  private birds = 0;
  private lastSfx = new Map<string, number>();
  /** pitch multiplier for the sound being synthesized (sfx's pitch argument) */
  private pm = 1;
  muted = false;

  constructor(settings: Vol) {
    this.vol = { master: settings.master, music: settings.music, sfx: settings.sfx };
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      // a soft echo for the music
      this.delay = ctx.createDelay(2);
      this.delay.delayTime.value = 0.42;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.32;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      this.delay.connect(lp);
      lp.connect(this.delayFb);
      this.delayFb.connect(this.delay);
      lp.connect(this.musicBus);
      // white noise buffer
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVol();
      this.nextNote = ctx.currentTime + 0.3;
    } catch {
      this.ctx = null;
    }
  }

  applySettings(s: Vol) {
    this.vol = { master: s.master, music: s.music, sfx: s.sfx };
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.7, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05);
  }

  setScene(s: Audio['scene']) {
    this.scene = s;
  }

  // ---------------- primitives ----------------
  private tone(freq: number, type: OscillatorType, env: Env, vol: number, bus: AudioNode, t0 = 0, slide = 0, detune = 0): OscillatorNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    freq *= this.pm;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + env.a + env.d);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + env.a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * (env.s ?? 0.001)), t + env.a + env.d);
    if (env.r) g.gain.exponentialRampToValueAtTime(0.0001, t + env.a + env.d + env.r);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + env.a + env.d + (env.r ?? 0) + 0.05);
    return o;
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, t0 = 0, sweep = 0, bus?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const f = ctx.createBiquadFilter();
    f.type = filter;
    freq *= this.pm;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** Play a named sound effect. `v` scales volume (e.g. for distance); `pitch` multiplies the pitch (streak ladders). */
  sfx(id: string, v = 1, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || v <= 0.02) return;
    const now = ctx.currentTime;
    const last = this.lastSfx.get(id) ?? 0;
    if (now - last < 0.03) return;
    this.lastSfx.set(id, now);
    const B = this.sfxBus;
    const r = () => 1 + (Math.random() - 0.5) * 0.08;
    // sounds designed in jsfxr take priority; the rest are synthesized below
    if (playSfxr(ctx, B, id, 0.35 * v, r() * pitch)) return;
    this.pm = pitch;
    switch (id) {
      case 'click': this.tone(900 * r(), 'square', { a: 0.002, d: 0.04 }, 0.06 * v, B); break;
      case 'hover': this.tone(1400, 'sine', { a: 0.002, d: 0.025 }, 0.02 * v, B); break;
      case 'open': this.noise(0.12, 0.08 * v, 'bandpass', 900, 1, 0, 2); this.tone(520, 'triangle', { a: 0.01, d: 0.08 }, 0.05 * v, B, 0, 1.3); break;
      case 'close': this.noise(0.1, 0.06 * v, 'bandpass', 1400, 1, 0, 0.5); this.tone(620, 'triangle', { a: 0.01, d: 0.07 }, 0.04 * v, B, 0, 0.7); break;
      case 'pickup': this.tone(660 * r(), 'square', { a: 0.003, d: 0.05 }, 0.05 * v, B); this.tone(990 * r(), 'square', { a: 0.003, d: 0.07 }, 0.05 * v, B, 0.05); break;
      case 'collect': [523, 659, 784].forEach((f, i) => this.tone(f, 'triangle', { a: 0.004, d: 0.12 }, 0.07 * v, B, i * 0.05)); break;
      case 'coin':
      case 'ship':
      case 'sell': this.tone(1320, 'square', { a: 0.002, d: 0.06 }, 0.05 * v, B); this.tone(1760, 'square', { a: 0.002, d: 0.16 }, 0.05 * v, B, 0.06); break;
      case 'buy': this.tone(880, 'triangle', { a: 0.002, d: 0.08 }, 0.07 * v, B); this.tone(1320, 'triangle', { a: 0.002, d: 0.14 }, 0.07 * v, B, 0.07); break;
      case 'error': this.tone(140, 'square', { a: 0.005, d: 0.18 }, 0.06 * v, B, 0, 0.8); break;
      case 'hoe': this.noise(0.14, 0.25 * v, 'lowpass', 500); this.tone(95 * r(), 'sine', { a: 0.003, d: 0.12 }, 0.25 * v, B, 0, 0.6); break;
      case 'dig': this.noise(0.2, 0.25 * v, 'lowpass', 700, 1, 0, 0.6); break;
      case 'thud': this.tone(80, 'sine', { a: 0.003, d: 0.12 }, 0.2 * v, B, 0, 0.7); this.noise(0.06, 0.08 * v, 'lowpass', 300); break;
      case 'water': this.noise(0.3, 0.12 * v, 'highpass', 1800, 0.7, 0, 1.6); this.noise(0.25, 0.07 * v, 'bandpass', 600, 2, 0.05); break;
      case 'refill': for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 400, 'sine', { a: 0.005, d: 0.06 }, 0.06 * v, B, i * 0.06, 1.5); break;
      case 'splash': this.noise(0.35, 0.2 * v, 'lowpass', 1500, 1, 0, 0.3); break;
      case 'chop': this.noise(0.08, 0.3 * v, 'bandpass', 1300 * r(), 3); this.tone(220 * r(), 'triangle', { a: 0.002, d: 0.08 }, 0.15 * v, B, 0, 0.7); break;
      case 'treefall': this.noise(0.9, 0.3 * v, 'lowpass', 400, 1, 0, 0.3); this.tone(70, 'sine', { a: 0.05, d: 0.6 }, 0.25 * v, B, 0.2); break;
      case 'rustle': this.noise(0.25, 0.1 * v, 'highpass', 2500, 0.5, 0, 0.7); break;
      case 'pick': this.tone(1800 * r(), 'triangle', { a: 0.001, d: 0.05 }, 0.08 * v, B, 0, 0.9); this.noise(0.05, 0.15 * v, 'highpass', 3000); break;
      case 'rockbreak': this.noise(0.3, 0.3 * v, 'lowpass', 1200, 1, 0, 0.4); this.tone(120, 'square', { a: 0.002, d: 0.1 }, 0.06 * v, B, 0, 0.5); break;
      case 'clang': this.tone(1200, 'square', { a: 0.001, d: 0.2 }, 0.04 * v, B, 0, 0.98); this.tone(1810, 'sine', { a: 0.001, d: 0.3 }, 0.05 * v, B); break;
      case 'cut': this.noise(0.09, 0.15 * v, 'highpass', 2200 * r(), 0.7); break;
      case 'swing': this.noise(0.14, 0.08 * v, 'bandpass', 900, 1.5, 0, 2.5); break;
      case 'plant': this.tone(520 * r(), 'sine', { a: 0.004, d: 0.1 }, 0.1 * v, B, 0, 0.75); this.noise(0.05, 0.05 * v, 'lowpass', 800); break;
      case 'harvest': [660, 880].forEach((f, i) => this.tone(f * r(), 'triangle', { a: 0.004, d: 0.1 }, 0.08 * v, B, i * 0.06)); this.noise(0.12, 0.07 * v, 'highpass', 2000); break;
      case 'place': this.tone(150, 'sine', { a: 0.002, d: 0.1 }, 0.25 * v, B, 0, 0.6); this.tone(900, 'square', { a: 0.001, d: 0.02 }, 0.03 * v, B, 0.02); break;
      // the winding verb: a spring ratchet, six quick clicks rising
      case 'ratchet': for (let i = 0; i < 6; i++) this.tone(1500 + i * 90, 'square', { a: 0.001, d: 0.018 }, 0.035 * v, B, i * 0.045); this.noise(0.05, 0.05 * v, 'highpass', 4000, 1, 0.28); break;
      // a structure stops (ROADMAP.md 4.3): starved = a hollow click, blocked = a dull clunk
      case 'state_starved': this.tone(520, 'triangle', { a: 0.002, d: 0.09 }, 0.05 * v, B, 0, 0.75); this.tone(390, 'triangle', { a: 0.002, d: 0.12 }, 0.04 * v, B, 0.07, 0.8); break;
      case 'state_blocked': this.tone(110, 'square', { a: 0.003, d: 0.14 }, 0.05 * v, B, 0, 0.6); this.noise(0.08, 0.08 * v, 'lowpass', 500); break;
      case 'switch_off': this.tone(700, 'square', { a: 0.001, d: 0.03 }, 0.05 * v, B); this.tone(300, 'sine', { a: 0.01, d: 0.25 }, 0.06 * v, B, 0.03, 0.5); break;
      case 'switch_on': this.tone(700, 'square', { a: 0.001, d: 0.03 }, 0.05 * v, B); this.tone(300, 'sine', { a: 0.02, d: 0.3 }, 0.06 * v, B, 0.03, 2); break;
      case 'pickup_struct':this.tone(200, 'sine', { a: 0.002, d: 0.08 }, 0.2 * v, B, 0, 1.6); break;
      case 'rotate': this.tone(1100, 'square', { a: 0.001, d: 0.02 }, 0.04 * v, B); this.tone(1300, 'square', { a: 0.001, d: 0.02 }, 0.04 * v, B, 0.03); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.06, 0.15 * v, 'bandpass', 700 + i * 120, 2, i * 0.11); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', { a: 0.005, d: 0.25 }, 0.1 * v, B, i * 0.08)); break;
      case 'research': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'sine', { a: 0.01, d: 0.5 }, 0.08 * v, B, i * 0.1)); break;
      case 'machine_done': this.tone(1250, 'sine', { a: 0.002, d: 0.35 }, 0.05 * v, B); this.tone(2500, 'sine', { a: 0.002, d: 0.2 }, 0.02 * v, B); break;
      case 'insert': this.tone(400, 'triangle', { a: 0.002, d: 0.05 }, 0.08 * v, B, 0, 1.5); break;
      case 'hit': this.noise(0.08, 0.25 * v, 'bandpass', 600, 2); this.tone(200, 'square', { a: 0.002, d: 0.08 }, 0.06 * v, B, 0, 0.5); break;
      case 'hurt': this.tone(220, 'square', { a: 0.003, d: 0.2 }, 0.08 * v, B, 0, 0.5); this.noise(0.1, 0.15 * v, 'lowpass', 900); break;
      case 'monster_die': this.tone(600, 'square', { a: 0.002, d: 0.2 }, 0.06 * v, B, 0, 0.3); this.noise(0.2, 0.15 * v, 'lowpass', 2000, 1, 0, 0.2); break;
      case 'bite': this.tone(1500, 'sine', { a: 0.001, d: 0.05 }, 0.12 * v, B); this.tone(1500, 'sine', { a: 0.001, d: 0.05 }, 0.12 * v, B, 0.1); break;
      case 'cast': this.noise(0.25, 0.1 * v, 'bandpass', 1500, 1, 0, 0.4); break;
      // firedamp (the Deepworks' Ember): a rising hiss as a pocket builds, then the vent's whoosh
      case 'hiss': this.noise(0.95, 0.07 * v, 'highpass', 2600, 0.7, 0, 1.6); this.noise(0.5, 0.04 * v, 'highpass', 4200, 0.7, 0.45, 1.2); break;
      case 'vent': this.noise(0.8, 0.2 * v, 'bandpass', 500, 0.8, 0, 2.4); this.noise(0.6, 0.08 * v, 'highpass', 2000, 0.6, 0.05, 0.6); break;
      case 'reel': this.tone(2000 + Math.random() * 300, 'square', { a: 0.001, d: 0.01 }, 0.015 * v, B); break;
      case 'catch': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 'square', { a: 0.003, d: 0.12 }, 0.05 * v, B, i * 0.07)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 'triangle', { a: 0.01, d: 0.2 }, 0.08 * v, B, i * 0.12)); break;
      case 'door': this.tone(110, 'sawtooth', { a: 0.05, d: 0.3 }, 0.03 * v, B, 0, 1.4); this.noise(0.1, 0.06 * v, 'lowpass', 400, 1, 0.3); break;
      case 'step': this.noise(0.04, 0.04 * v, 'lowpass', 900 * r()); break;
      case 'step_wood': this.tone(180 * r(), 'triangle', { a: 0.002, d: 0.04 }, 0.05 * v, B); break;
      case 'step_stone': this.noise(0.03, 0.05 * v, 'highpass', 2500 * r()); break;
      case 'thunder': this.noise(2.5, 0.35 * v, 'lowpass', 300, 1, 0, 0.3); this.noise(0.4, 0.25 * v, 'lowpass', 900, 1); break;
      case 'chime': [1046, 1318, 1568].forEach((f, i) => this.tone(f, 'sine', { a: 0.005, d: 0.6 }, 0.05 * v, B, i * 0.15)); break;
      case 'quest': [659, 784, 988, 1318].forEach((f, i) => this.tone(f, 'triangle', { a: 0.005, d: 0.3 }, 0.08 * v, B, i * 0.09)); break;
      case 'talk': this.tone(300 + Math.random() * 200, 'square', { a: 0.002, d: 0.03 }, 0.025 * v, B); break;
      case 'heart': [880, 1108, 1318].forEach((f, i) => this.tone(f, 'sine', { a: 0.01, d: 0.3 }, 0.06 * v, B, i * 0.08)); break;
      case 'sleep': [523, 392, 330, 262].forEach((f, i) => this.tone(f, 'sine', { a: 0.05, d: 0.6 }, 0.06 * v, B, i * 0.3)); break;
      case 'rooster': this.tone(700, 'sawtooth', { a: 0.02, d: 0.25, s: 0.6, r: 0.2 }, 0.03 * v, B, 0, 1.4); this.tone(900, 'sawtooth', { a: 0.02, d: 0.35 }, 0.03 * v, B, 0.3, 0.7); break;
      case 'meow': {
        const f = 560 + Math.random() * 120;
        this.tone(f, 'triangle', { a: 0.03, d: 0.13, s: 0.5 }, 0.05 * v, B, 0, 1.45);
        this.tone(f * 1.45, 'triangle', { a: 0.01, d: 0.22 }, 0.045 * v, B, 0.15, 0.62);
        break;
      }
      case 'squeak':
        // the hamster: two quick, high chirps
        this.tone(2300 + Math.random() * 400, 'sine', { a: 0.004, d: 0.05 }, 0.035 * v, B, 0, 1.2);
        this.tone(2700 + Math.random() * 300, 'sine', { a: 0.004, d: 0.06 }, 0.03 * v, B, 0.07, 0.9);
        break;
      case 'bark':
        for (let i = 0; i < (Math.random() < 0.5 ? 1 : 2); i++) {
          this.tone(320 + Math.random() * 60, 'square', { a: 0.005, d: 0.09 }, 0.04 * v, B, i * 0.18, 0.55);
          this.noise(0.06, 0.05 * v, 'bandpass', 900, 2, i * 0.18, 0, B);
        }
        break;
      default: this.tone(600, 'sine', { a: 0.002, d: 0.05 }, 0.03 * v, B);
    }
    this.pm = 1;
  }

  // ---------------- music ----------------
  private musicParams(g: Game | null) {
    const season = g ? g.time.season : 0;
    const hour = g ? g.time.min / 60 : 18;
    const night = hour >= 20 || hour < 6;
    const evening = hour >= 17 && !night;
    // scales relative to root (semitones)
    const SCALES: Record<string, number[]> = {
      majpent: [0, 2, 4, 7, 9], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], minpent: [0, 3, 5, 7, 10], mixo: [0, 2, 4, 5, 7, 9, 10],
    };
    let root = [60, 55, 57, 62][season];
    let scale = [SCALES.majpent, SCALES.lydian, SCALES.dorian, SCALES.minpent][season];
    let tempo = [92, 100, 84, 70][season];
    let density = [0.55, 0.62, 0.5, 0.38][season];
    let wave: OscillatorType = season === 3 ? 'sine' : 'triangle';
    if (evening) { tempo *= 0.9; density *= 0.8; }
    if (night) { tempo *= 0.75; density *= 0.45; root -= 12; wave = 'sine'; }
    if (this.scene === 'mine') { root = 45; scale = SCALES.minpent; tempo = 60; density = 0.3; wave = 'sine'; }
    if (this.scene === 'festival') { root = 62; scale = SCALES.mixo; tempo = 118; density = 0.8; wave = 'square'; }
    if (this.scene === 'home') { tempo *= 0.8; density *= 0.6; wave = 'sine'; root += 12; }
    if (this.scene === 'title') { root = 57; scale = SCALES.majpent; tempo = 80; density = 0.5; }
    // chord progressions (scale degrees)
    const prog = season === 2 || this.scene === 'mine' ? [0, 5, 3, 4] : season === 3 ? [0, 3, 5, 4] : [0, 3, 4, 2];
    return { root, scale, tempo, density, wave, prog, night };
  }

  private mtof(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  private note(m: number, dur: number, vol: number, wave: OscillatorType, t0: number, echo = true) {
    const ctx = this.ctx!;
    const t = t0;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o2.type = 'sine';
    o.frequency.value = this.mtof(m);
    o2.frequency.value = this.mtof(m) * 2.001;
    const g2 = ctx.createGain();
    g2.gain.value = 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.musicBus);
    if (echo) g.connect(this.delay);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private pad(ms: number[], dur: number, vol: number, t0: number) {
    const ctx = this.ctx!;
    for (const m of ms) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      o.type = 'sawtooth';
      o.frequency.value = this.mtof(m);
      o.detune.value = (Math.random() - 0.5) * 12;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }

  private scheduleMusic(g: Game | null) {
    const ctx = this.ctx!;
    const P = this.musicParams(g);
    const beat = 60 / P.tempo / 2; // eighth notes
    const deg = (d: number) => {
      const n = P.scale.length;
      const o = Math.floor(d / n);
      return P.root + P.scale[((d % n) + n) % n] + o * 12;
    };
    while (this.nextNote < ctx.currentTime + 0.25) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 8);
      if (this.step % 16 === 0) {
        this.chord = P.prog[bar / 2 % P.prog.length | 0];
        const c = this.chord;
        this.pad([deg(c) - 12, deg(c + 2) - 12, deg(c + 4) - 12], beat * 16, P.night ? 0.018 : 0.012, t);
        this.note(deg(c) - 24, beat * 6, 0.07, 'sine', t, false);
      }
      if (this.step % 8 === 4 && Math.random() < 0.6) this.note(deg(this.chord) - 24 + 7, beat * 3, 0.04, 'sine', t, false);
      // melody
      if (Math.random() < P.density) {
        const offs = [0, 2, 4, 1, 3, 5, 7];
        const d = this.chord + offs[Math.floor(Math.random() * (this.step % 4 === 0 ? 3 : offs.length))];
        const len = beat * (Math.random() < 0.3 ? 3 : 1.6);
        this.note(deg(d) + (Math.random() < 0.15 ? 12 : 0), len, P.night ? 0.035 : 0.05, P.wave, t);
      }
      // festival percussion
      if (this.scene === 'festival' && this.step % 2 === 0) this.noise(0.05, this.step % 4 === 0 ? 0.08 : 0.04, 'highpass', 6000, 1, t - ctx.currentTime, 0, this.musicBus);
      this.nextNote += beat * (this.step % 2 === 0 ? 1.04 : 0.96); // a little swing
      this.step++;
    }
  }

  // ---------------- ambience ----------------
  private loopNoise(filter: BiquadFilterType, freq: number): { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.ambBus);
    src.start();
    return { src, g, f };
  }

  update(dt: number, g: Game | null, nearbyMachines = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.scheduleMusic(g);
    if (!g) return;
    const t = ctx.currentTime;
    const outdoor = g.player.where === 'world';
    // rain bed
    const indoorRain = g.player.where === 'house' && g.isRaining();
    const rainy = outdoor && g.isRaining();
    if (!this.rain) this.rain = this.loopNoise('lowpass', 1800);
    // rain on the roof sounds muffled from inside the farmhouse
    this.rain.g.gain.setTargetAtTime(rainy ? (g.weather === 'storm' ? 0.22 : 0.12) : indoorRain ? 0.05 : 0, t, 0.8);
    this.rain.f.frequency.setTargetAtTime(indoorRain ? 500 : 1800, t, 0.5);
    // wind
    if (!this.wind) this.wind = this.loopNoise('bandpass', 400);
    const windy = outdoor ? Math.max(0, g.wind - 0.8) * 0.08 + (g.weather === 'snow' ? 0.03 : 0) : 0;
    this.wind.g.gain.setTargetAtTime(windy, t, 1);
    this.wind.f.frequency.setTargetAtTime(300 + Math.sin(t * 0.3) * 150, t, 0.5);
    // machine hum, louder with more working machines nearby
    if (!this.hum) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), gg = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o2.type = 'triangle';
      o2.frequency.value = 82.5;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 240;
      o.connect(f);
      o2.connect(f);
      f.connect(gg);
      gg.gain.value = 0;
      gg.connect(this.ambBus);
      o.start();
      o2.start();
      this.hum = { o, o2, g: gg };
    }
    this.hum.g.gain.setTargetAtTime(outdoor ? Math.min(0.05, nearbyMachines * 0.004) : 0, t, 0.5);
    if (nearbyMachines > 0 && Math.random() < dt * Math.min(4, nearbyMachines * 0.3)) this.tone(1500 + Math.random() * 1500, 'square', { a: 0.001, d: 0.008 }, 0.008, this.ambBus); // little ticks
    // critters
    const hour = g.time.min / 60;
    if (outdoor && !g.isRaining() && g.time.season !== 3) {
      if (hour > 6 && hour < 18) {
        this.birds -= dt;
        if (this.birds <= 0) {
          this.birds = 2 + Math.random() * 6;
          const base = 2000 + Math.random() * 1500;
          const n = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 'sine', { a: 0.005, d: 0.07 }, 0.02, this.ambBus, i * 0.09, 1.3);
        }
      } else if (hour > 20 || hour < 4) {
        this.crickets -= dt;
        if (this.crickets <= 0) {
          this.crickets = 0.6 + Math.random() * 1.2;
          for (let i = 0; i < 3; i++) this.tone(4200, 'square', { a: 0.001, d: 0.015 }, 0.006, this.ambBus, i * 0.04);
        }
      }
    }
    // the fireplace crackles when you're home
    if (g.player.where === 'house' && Math.random() < dt * 5) this.noise(0.012 + Math.random() * 0.02, 0.025 + Math.random() * 0.03, 'bandpass', 1800 + Math.random() * 2500, 3, 0, 0, this.ambBus);
    if (g.sys.thunder) {
      g.sys.thunder = false;
      this.sfx('thunder');
    }
  }
}
