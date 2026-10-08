// Night darkness with warm light pools. Rendered at low resolution then upscaled smooth.
import { PALETTE_RGB, C } from '../data/palette';
import type { Game } from '../sim/Game';
import { O } from '../sim/world/tilemap';
import { curMap } from '../sim/systems/player';
import type { Renderer } from './renderer';

const RES = 4; // screen px per light-map px

export class Lighting {
  c: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  /** extra global flash (lightning) */
  flash = 0;

  draw(main: CanvasRenderingContext2D, g: Game, r: Renderer, underground: boolean) {
    const night = 1 - g.daylight;
    const rainDim = g.isRaining() && !underground ? 0.18 : g.weather === 'snow' ? 0.06 : 0;
    let dark = underground ? 0.62 : Math.min(0.78, night * 0.78 + rainDim);
    if (this.flash > 0) {
      main.fillStyle = `rgba(255,247,228,${Math.min(0.6, this.flash)})`;
      main.fillRect(0, 0, r.W, r.H);
      this.flash -= 0.05;
    }
    // dusk tint
    if (!underground && night > 0.05 && night < 0.95) {
      const [rr, gg, bb] = PALETTE_RGB[C.apricot];
      main.fillStyle = `rgba(${rr},${gg},${bb},${0.12 * Math.sin(night * Math.PI)})`;
      main.fillRect(0, 0, r.W, r.H);
    }
    if (dark < 0.02) return;
    const w = Math.ceil(r.W / RES), h = Math.ceil(r.H / RES);
    if (!this.c || this.c.width !== w || this.c.height !== h) {
      this.c = document.createElement('canvas');
      this.c.width = w;
      this.c.height = h;
      this.ctx = this.c.getContext('2d')!;
    }
    const lc = this.ctx!;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, w, h);
    const [nr, ng, nb] = PALETTE_RGB[underground ? C.ink : C.deepsea];
    lc.fillStyle = `rgba(${Math.round(nr * 0.4)},${Math.round(ng * 0.4)},${Math.round(nb * 0.7)},${dark})`;
    lc.fillRect(0, 0, w, h);
    lc.globalCompositeOperation = 'destination-out';
    const lights = this.collect(g, r, underground);
    const z = r.cam.zoom;
    for (const L of lights) {
      const s = r.tileToScreen(L.x, L.y);
      const rad = (L.r * 16 * z) / RES;
      const x = s.x / RES, y = s.y / RES;
      if (x + rad < 0 || y + rad < 0 || x - rad > w || y - rad > h) continue;
      const flick = L.flicker ? 1 + Math.sin(r.time * 9 + L.x * 3) * 0.04 + Math.sin(r.time * 23 + L.y) * 0.03 : 1;
      const gr = lc.createRadialGradient(x, y, 0, x, y, rad * flick);
      gr.addColorStop(0, `rgba(0,0,0,${L.i})`);
      gr.addColorStop(0.55, `rgba(0,0,0,${L.i * 0.6})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = gr;
      lc.beginPath();
      lc.arc(x, y, rad * flick, 0, Math.PI * 2);
      lc.fill();
    }
    main.save();
    main.imageSmoothingEnabled = true;
    main.drawImage(this.c, 0, 0, w * RES, h * RES);
    main.imageSmoothingEnabled = false;
    // warm additive glow
    main.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.c) continue;
      const s = r.tileToScreen(L.x, L.y);
      const rad = L.r * 16 * z * 0.55;
      if (s.x + rad < 0 || s.y + rad < 0 || s.x - rad > r.W || s.y - rad > r.H) continue;
      const [cr, cg, cb] = PALETTE_RGB[L.c];
      const gr = main.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
      gr.addColorStop(0, `rgba(${cr},${cg},${cb},${0.22 * dark})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      main.fillStyle = gr;
      main.fillRect(s.x - rad, s.y - rad, rad * 2, rad * 2);
    }
    main.restore();
  }

  private collect(g: Game, r: Renderer, underground: boolean) {
    const out: { x: number; y: number; r: number; i: number; c?: number; flicker?: boolean }[] = [];
    const m = curMap(g);
    const v = r.view;
    const tx0 = Math.max(0, Math.floor(v.x0 / 16) - 8), ty0 = Math.max(0, Math.floor(v.y0 / 16) - 8);
    const tx1 = Math.min(m.w - 1, Math.ceil(v.x1 / 16) + 8), ty1 = Math.min(m.h - 1, Math.ceil(v.y1 / 16) + 8);
    const p = g.player;
    out.push({ x: p.x, y: p.y - 0.6, r: underground ? 6 : 2.2, i: underground ? 1 : 0.5, c: underground ? C.amber : undefined, flicker: underground });
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) {
        const o = m.obj[m.idx(x, y)];
        if (o === O.LAMPPOST) out.push({ x: x + 0.5, y: y - 0.3, r: 5, i: 1, c: C.amber, flicker: true });
        else if (o === O.CRYSTAL) out.push({ x: x + 0.5, y: y + 0.3, r: 2.5, i: 0.7, c: C.lavender });
      }
    if (m === g.map) {
      for (const b of m.buildings) {
        if (b.x > tx1 || b.x + b.w < tx0 || b.y > ty1 || b.y + b.h < ty0) continue;
        if (b.kind === 'house' || b.kind === 'shop' || b.kind === 'farmhouse') out.push({ x: b.x + b.w / 2, y: b.y + b.h - 0.8, r: 3.5, i: 0.75, c: C.amber, flicker: true });
      }
      const seen = new Set<number>();
      for (let y = ty0; y <= ty1; y++)
        for (let x = tx0; x <= tx1; x++) {
          const e = g.ents.at(x, y);
          if (!e || seen.has(e.id) || e.ghost) continue;
          seen.add(e.id);
          const L = e.def.light;
          if (e.def.kind === 'lamp') out.push({ x: e.x + 0.5, y: e.y - 0.4, r: L?.r ?? 6, i: 1, c: C.amber, flicker: true });
          else if (L && e.working) out.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: L.r, i: 0.9, c: L.color, flicker: true });
          else if (e.def.kind === 'hive' || e.def.id === 'mist_tower' || e.def.kind === 'lab') out.push({ x: e.x + e.w / 2, y: e.y, r: 2, i: 0.5, c: C.aqua });
        }
      // glowing crops
      for (let y = ty0; y <= ty1; y++)
        for (let x = tx0; x <= tx1; x++) {
          const s = g.soil.get(m.idx(x, y));
          if (s?.crop?.ready && (s.crop.id === 'glowmelon' || s.crop.id === 'emberpepper' || s.crop.id === 'starpetal')) out.push({ x: x + 0.5, y: y + 0.4, r: 1.6, i: 0.6, c: s.crop.id === 'glowmelon' ? C.aqua : s.crop.id === 'starpetal' ? C.lavender : C.apricot });
        }
      for (const L of g.sys.festivalLights ?? []) out.push(L);
    } else {
      for (const L of g.sys.mine?.lights ?? []) out.push(L);
    }
    return out;
  }
}
