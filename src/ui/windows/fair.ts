// The Sprocket Fair (ROADMAP.md 7.7, Phase 5): the Professor's window on the square. Pick a
// blueprint that fits the 6x6 test bed (the blueprint tool's copy or the drafting table's library),
// run it, and watch the bed: the line built with the real structure sprites at 1:1, its goods moving,
// a minute of works time played in about 15 seconds. Then its score against the year's three
// entries, and the prizes. The sim: src/sim/testbed.ts (the bed), src/sim/fair.ts (entries, prizes).
import { C, PALETTE } from '../../data/palette';
import { STRUCT_BY_ID } from '../../data/structures';
import type { FestivalDef } from '../../data/types';
import { keyLabel } from '../../engine/input';
import { drawSprite, hasImage, sprite } from '../../render/atlas';
import type { Blueprint } from '../../sim/blueprint';
import { drafting, fits } from '../../sim/drafting';
import { BeltKind, type Ent } from '../../sim/ents';
import { candleText, fairEntries, fairResult, type FairResult } from '../../sim/fair';
import { kDef, key } from '../../sim/inventory';
import { villagerName } from '../../sim/systems/orders';
import { festivalName } from '../../sim/systems/festivals';
import { itemPos } from '../../sim/systems/belts';
import { BED, BED_TICKS, bedDone, bedScore, bedTally, startBed, stepBed, type BedRun } from '../../sim/testbed';
import { MState } from '../../sim/mstate';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ICON, ellipsize, textWidth } from '../font';
import { centered, frame } from './common';
import type { WinState } from './index';
import { drawTokenStall } from './stall';

const T = 16;
/** the minute plays in about 15 seconds: 240 ticks of works time a second */
const TICKS_PER_SEC = BED_TICKS / 15;

interface Choice { name: string; bp: Blueprint; from: string }

interface FairData {
  mode?: 'pick' | 'run' | 'done' | 'stall';
  sel?: number;
  run?: BedRun;
  name?: string;
  res?: FairResult;
  /** button rectangles (UI pixels) for the real-input e2e: [x, y, w, h] */
  btn?: Record<string, number[]>;
}

/** the blueprints that fit the bed: the blueprint tool's copy first, then the drafting table's */
function choices(play: PlayScreen): Choice[] {
  const out: Choice[] = [];
  const tool = play.blueprint;
  if (tool?.items.length && fits(tool, BED, BED)) out.push({ name: 'Your blueprint tool copy', bp: tool, from: 'tool' });
  for (const e of drafting(play.g).lib) if (e.bp.items.length && fits(e.bp, BED, BED)) out.push({ name: e.name, bp: e.bp, from: e.from });
  return out;
}

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');

/** "the Professor", "Bram", "Juniper" */
const who = (id: string) => villagerName(id);

/** the distinct machines in a blueprint (item ids), for its row */
function machinesOf(bp: Blueprint): string[] {
  const out: string[] = [];
  for (const it of bp.items) {
    const d = STRUCT_BY_ID.get(it.def);
    if (d && (d.kind === 'machine' || d.kind === 'generator') && !out.includes(d.item)) out.push(d.item);
  }
  return out;
}

export function drawFair(ui: UI, play: PlayScreen, st: WinState, f: FestivalDef): boolean {
  const d = st.data as FairData;
  d.mode ??= 'pick';
  d.btn = {};
  const W = Math.min(ui.w - 16, 440), H = Math.min(ui.h - 28, 268);
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, festivalName(f, true))) return false;
  if (d.mode === 'run' && d.run) return drawRun(ui, play, d, x, y, W, H);
  if (d.mode === 'done' && d.res) return drawDone(ui, play, d, x, y, W, H);
  if (d.mode === 'stall') {
    drawTokenStall(ui, play, x + 14, y + 16, f.host);
    if (ui.button('fair_back', x + 14, y + H - 28, 70, 18, 'Back')) d.mode = 'pick';
    return true;
  }
  return drawPick(ui, play, d, f, x, y, W, H);
}

// ---------------- picking a line ----------------
function drawPick(ui: UI, play: PlayScreen, d: FairData, f: FestivalDef, x: number, y: number, W: number, H: number): boolean {
  const g = play.g;
  let yy = y + 14;
  yy += ui.para(f.intro, x + 12, yy, W - 24, C.walnut);
  // this year's entries
  yy += 4;
  ui.text(`To beat this year (coins of goods a minute):`, x + 12, yy, C.ink);
  yy += 11;
  for (const e of fairEntries(g.time.year)) {
    ui.text(ellipsize(`${who(e.who)}: ${e.what}`, W - 90), x + 18, yy, C.oak);
    ui.text(n0(e.score), x + W - 14, yy, C.oak, { align: 'right' });
    yy += 10;
  }
  // the prizes: the Founder's candles once a save, tokens every year
  const left = [1, 2, 3, 4].filter((c) => !g.flags.has('candle_' + c)).length;
  yy += 2;
  yy += ui.para(left ? `Beat one entry, two, all three, then the best by half again: each wins one of the Founder's candles (${left} left to win). Tokens and coins every year.` : "You've won all four of the Founder's candles. Tokens and coins every year.", x + 12, yy, W - 24, C.walnut, 9);
  yy += 5;
  const list = choices(play);
  d.sel = Math.min(d.sel ?? 0, Math.max(0, list.length - 1));
  const listH = y + H - 34 - yy;
  if (!list.length) {
    // nothing fits: how to make one
    ui.panel(x + 10, yy, W - 20, listH, 'paper', false);
    const copy = keyLabel(ui.input.binds.copy[0] ?? 'KeyV');
    const tool = play.blueprint;
    const msg = (tool?.items.length ? `Your blueprint tool's copy is ${tool.w} by ${tool.h}: too big for the bed. ` : 'You have no blueprint that fits the bed yet. ') +
      `On your farm, press ${copy} and drag across a corner of one of your lines, 6 tiles by 6 or smaller, then come back: the bed takes the blueprint tool's copy. Lines fed straight from a field need a chest at their start here.`;
    ui.para(msg, x + 18, yy + 6, W - 36, C.walnut);
  } else {
    ui.text('Your lines that fit the bed:', x + 12, yy, C.ink);
    yy += 11;
    const rowH = 18, rows = Math.max(1, Math.floor((y + H - 34 - yy) / rowH));
    const off = ui.scrollOffset('fair_list', x + 10, yy, W - 20, rows * rowH, list.length * rowH);
    ui.clip(x + 10, yy, W - 20, rows * rowH);
    list.forEach((c, i) => {
      const ry = yy + i * rowH - off;
      if (ry < yy - rowH || ry > yy + rows * rowH) return;
      const sel = i === d.sel;
      d.btn!['row' + i] = [x + 10, ry, W - 20, rowH - 1];
      const hov = ui.hover(x + 10, ry, W - 20, rowH - 1);
      // the chosen line: an amber band with a rim; the others quiet stripes
      if (sel) {
        ui.fill(x + 10, ry, W - 20, rowH - 1, C.amber, 0.4);
        ui.fill(x + 10, ry, 2, rowH - 1, C.amber);
      } else ui.fill(x + 10, ry, W - 20, rowH - 1, C.tan, hov ? 0.55 : i % 2 ? 0.25 : 0.12);
      const icons = machinesOf(c.bp).slice(0, 5);
      icons.forEach((id, k) => ui.itemIcon(key(id), x + 14 + k * 14, ry + 2, 12));
      const tx = x + 18 + Math.max(1, icons.length) * 14;
      ui.text(ellipsize(c.name + (c.from && c.from !== 'tool' ? ` (${who(c.from)})` : ''), W - (tx - x) - 120), tx, ry + 5, C.ink);
      ui.text(`${c.bp.w}x${c.bp.h}, ${c.bp.items.length} pieces`, x + W - 16, ry + 5, C.walnut, { align: 'right' });
      if (hov && ui.clicked) {
        ui.eat();
        d.sel = i;
        ui.sfx('click');
      }
    });
    ui.unclip();
  }
  // run, and the stall
  const by = y + H - 26;
  d.btn!.run = [x + 12, by, 120, 18];
  if (ui.button('fair_run', x + 12, by, 120, 18, 'Run on the bed', { style: 'green', disabled: !list.length, tip: 'Builds the line on the 6x6 bed and runs it for a minute of works time' })) {
    const c = list[d.sel ?? 0];
    if (c) {
      d.run = startBed(g, c.bp);
      d.name = c.name;
      d.mode = 'run';
      ui.sfx('place');
    }
  }
  if (ui.button('fair_stall', x + 140, by, 90, 18, 'Token stall')) d.mode = 'stall';
  const best = g.counters.best_f_fair;
  if (best) ui.text(`Your best: ${n0(best)}`, x + W - 14, by + 5, C.walnut, { align: 'right' });
  return true;
}

// ---------------- the run ----------------
function drawRun(ui: UI, play: PlayScreen, d: FairData, x: number, y: number, W: number, H: number): boolean {
  const g = play.g;
  const run = d.run!;
  // the minute, about 15 seconds of it a minute
  stepBed(run, Math.max(1, Math.round(TICKS_PER_SEC * Math.min(0.1, ui.dt))));
  const bx = x + 16, by = y + 34;
  drawBed(ui, play, run, bx, by);
  const rx = bx + BED * T + 18, rw = x + W - 14 - rx;
  const tally = bedTally(run);
  const secs = Math.floor(run.ticks / 60);
  ui.text(ellipsize(d.name ?? 'Your line', rw), rx, y + 16, C.ink);
  ui.text(`The minute: 0:${String(Math.min(60, secs)).padStart(2, '0')} of 1:00`, rx, y + 30, C.walnut);
  ui.bar(rx, y + 41, rw, 5, run.ticks / BED_TICKS, C.amber);
  ui.text(`${n0(tally.coins)}`, rx, y + 52, C.ink, { scale: 2 });
  ui.text('coins of goods so far', rx, y + 70, C.walnut);
  // the entries tick over as the score passes them
  let yy = y + 86;
  for (const e of fairEntries(g.time.year)) {
    const passed = tally.coins > e.score;
    ui.text(`${passed ? ICON.star + ' ' : ''}${who(e.who)}: ${n0(e.score)}`, rx, yy, passed ? C.moss : C.oak);
    yy += 10;
  }
  // what it has finished so far, and what its last machines are cooking
  yy += 6;
  goodsRow(ui, tally, rx, yy, rw);
  if (run.skipped.length) {
    const names = [...new Set(run.skipped)].map((id) => STRUCT_BY_ID.get(id)?.name ?? id);
    ui.para(`Left off the bed (it needs a river, a vein or a tree, or hangs over the edge): ${names.join(', ')}`, rx, yy + 22, rw, C.brick, 9);
  }
  const bty = y + H - 26;
  d.btn!.skip = [x + 12, bty, 110, 18];
  if (ui.button('fair_skip', x + 12, bty, 110, 18, 'Skip to the bell')) stepBed(run, BED_TICKS);
  if (bedDone(run)) {
    d.res = fairResult(g, bedScore(run));
    d.mode = 'done';
    play.app.audio.sfx(d.res.beaten ? 'levelup' : 'collect');
    if (d.res.candles.length) play.toast(`Sprocket Fair prize: ${d.res.candles.map(candleText).join('; ')}!`, undefined, C.amber);
  }
  return true;
}

// ---------------- the result ----------------
function drawDone(ui: UI, play: PlayScreen, d: FairData, x: number, y: number, W: number, H: number): boolean {
  const g = play.g;
  const r = d.res!;
  const run = d.run!;
  const bx = x + 16, by = y + 34;
  drawBed(ui, play, run, bx, by);
  const rx = bx + BED * T + 18, rw = x + W - 14 - rx;
  ui.text(ellipsize(d.name ?? 'Your line', rw), rx, y + 16, C.ink);
  ui.text(n0(r.score), rx, y + 28, C.ink, { scale: 2 });
  ui.text(`coins of goods a minute${r.best ? ', your best' : ''}`, rx, y + 46, C.walnut);
  let yy = y + 60;
  const es = fairEntries(g.time.year);
  for (const e of es) {
    const won = r.score > e.score;
    ui.text(ellipsize(`${won ? 'Beat' : 'Short of'} ${who(e.who)}'s ${e.what} (${n0(e.score)})`, rw), rx, yy, won ? C.moss : C.oak);
    yy += 10;
  }
  // the last candle: half again the top entry's score
  const top = es.reduce((a, b) => (b.score > a.score ? b : a));
  const half = r.byHalf ? `Half again ${who(top.who)}'s score: done!` : `Half again ${who(top.who)}'s: ${n0(top.score * 1.5)}${g.flags.has('candle_4') ? '' : ' wins the Gilded Clock'}`;
  ui.text(ellipsize(half, rw), rx, yy, r.byHalf ? C.moss : C.oak);
  yy += 14;
  // the prizes
  const lines: string[] = [];
  for (const c of r.candles) lines.push(`Won: ${candleText(c)}.`);
  if (r.tickets || r.money) lines.push(`This year's prize: ${r.tickets} tokens${r.money ? ` and ${n0(r.money)} coins` : ''}.`);
  else lines.push("This year's prize is paid for a run as good as this one. Better runs still count.");
  if (r.score <= 0) lines.push('Nothing finished. The bed fills the chests that feed machines, so a line fed straight from a field needs a chest at its start.');
  for (const l of lines) yy += ui.para(l, rx, yy, rw, l.startsWith('Won') ? C.amber : C.walnut, 9) + 2;
  // what the line made in its minute
  goodsRow(ui, bedTally(run), rx, Math.max(yy + 2, y + H - 50), rw);
  const bty = y + H - 26;
  d.btn!.again = [x + 12, bty, 100, 18];
  d.btn!.done = [x + W - 82, bty, 70, 18];
  if (ui.button('fair_again', x + 12, bty, 100, 18, 'Run another')) {
    d.mode = 'pick';
    d.run = undefined;
    d.res = undefined;
  }
  if (ui.button('fair_done', x + W - 82, bty, 70, 18, 'Done', { style: 'green' })) return false;
  return true;
}

/** the line's goods: what it finished, with counts, then the batches its last machines are cooking */
function goodsRow(ui: UI, tally: ReturnType<typeof bedTally>, x: number, y: number, w: number) {
  let xx = x;
  for (const gd of tally.goods.slice(0, 4)) {
    const label = `${gd.n}`;
    if (xx + 18 + textWidth(label) > x + w) return;
    ui.itemIcon(gd.k, xx, y, 16);
    ui.text(label, xx + 18, y + 5, C.ink);
    xx += 26 + textWidth(label);
  }
  for (const gd of tally.cooking.slice(0, 2)) {
    const label = `${gd.n.toFixed(1)} cooking`;
    if (xx + 18 + textWidth(label) > x + w) return;
    ui.itemIcon(gd.k, xx, y, 16, 0, 0.65);
    ui.text(label, xx + 18, y + 5, C.walnut);
    xx += 26 + textWidth(label);
  }
}

// ---------------- the bed, drawn ----------------
/** the 6x6 bed and its line at 1:1 (pixel-grid rule): flagstones, belts and their goods, structures back to front */
function drawBed(ui: UI, play: PlayScreen, run: BedRun, bx: number, by: number) {
  const g = run.g, ctx = ui.ctx;
  const season = play.g.time.season;
  const time = ui.time;
  const frame = Math.floor(time * 8) % 4;
  // a brass-rimmed plate of flagstones on the square
  ui.fill(bx - 3, by - 3, BED * T + 6, BED * T + 6, C.ink);
  ui.fill(bx - 2, by - 2, BED * T + 4, BED * T + 4, C.brass);
  for (let ty = 0; ty < BED; ty++)
    for (let tx = 0; tx < BED; tx++) {
      ui.fill(bx + tx * T, by + ty * T, T, T, (tx + ty) % 2 ? C.pebble : C.stone);
      ui.fill(bx + tx * T, by + ty * T, T, 1, C.slate, 0.35);
      ui.fill(bx + tx * T, by + ty * T, 1, T, C.slate, 0.35);
    }
  ctx.save();
  ctx.translate(bx, by);
  const D: { y: number; f: () => void }[] = [];
  const goods: [number, number, number][] = [];
  const pos = { x: 0, y: 0 };
  const collect = (e: Ent) => {
    const b = e.belt!;
    for (let li = 0; li < 2; li++) {
      const L = b.lanes[li];
      for (let i = 0; i < L.k.length; i++) {
        if (b.kind === BeltKind.UnderIn && L.p[i] > 0.55) continue;
        itemPos(e, li, L.p[i], pos);
        goods.push([L.k[i], pos.x, pos.y]);
      }
    }
  };
  for (const e of g.ents.all()) {
    if (e.ghost) continue;
    const def = e.def;
    if (e.belt) {
      const b = e.belt;
      const tier = def.tier ?? 1;
      const fine = hasImage(`belt:${tier}:0:0:15`);
      const bf = e.state === MState.Blocked ? 0 : fine ? Math.floor(time * b.speed * 16) % 16 : Math.floor(time * b.speed * 4) % 4;
      if (def.kind === 'splitter') {
        collect(e);
        if (e.parent) continue;
        const sp = sprite(`belt:${tier}:${e.rot}:0:${bf}`);
        drawSprite(ctx, sp, e.x * T, e.y * T);
        if (e.child) drawSprite(ctx, sp, e.child.x * T, e.child.y * T);
        const box = sprite(`split:${tier}:${frame}`);
        const cx = (e.x + (e.child ? (e.child.x - e.x) / 2 : 0)) * T + 8, cy = (e.y + (e.child ? (e.child.y - e.y) / 2 : 0)) * T + 8;
        D.push({ y: e.y + 0.55, f: () => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((e.rot * Math.PI) / 2);
          ctx.drawImage(box.img, box.x, box.y, 32, 16, -16, -8, 32, 16);
          ctx.restore();
        } });
        continue;
      }
      if (def.kind === 'underground') {
        const uf = fine && !hasImage(`ug:${tier}:0:0:15`) ? bf >> 2 : bf;
        drawSprite(ctx, sprite(`ug:${tier}:${e.rot}:${b.kind === BeltKind.UnderIn ? 1 : 0}:${uf}`), e.x * T, e.y * T);
      } else drawSprite(ctx, sprite(`belt:${tier}:${e.rot}:${b.curve}:${bf}`), e.x * T, e.y * T);
      collect(e);
      continue;
    }
    if (e.arm) {
      D.push({ y: e.y + 0.5, f: () => play.app.renderer.drawArm(g, e) });
      continue;
    }
    // rails and gantries have drawings of their own in the world; nothing that big fits the bed
    if (def.kind === 'path' || def.kind === 'rail' || def.kind === 'gantry') continue;
    const on = e.working || (def.kind === 'generator' && (e.gen?.out ?? 0) > 0);
    const animated = on && (!!e.mach || def.kind === 'generator' || def.kind === 'lamp' || def.kind === 'sprinkler');
    const sname = `st:${def.id}:${animated ? frame : 0}:${on ? 1 : 0}:${season}`;
    const shadowW = def.kind === 'decor' || def.kind === 'lamp' ? 10 : Math.round(e.w * T * 0.8);
    D.push({ y: e.y + e.h - 0.02, f: () => {
      drawSprite(ctx, sprite(`shadow:${shadowW}`), e.x * T + e.w * 8, (e.y + e.h) * T - 2);
      drawSprite(ctx, sprite(sname), e.x * T, e.y * T);
      // a cooking batch's progress, under the machine
      if (e.mach?.crafting) {
        ctx.fillStyle = PALETTE[C.ink];
        ctx.fillRect(e.x * T + 2, (e.y + e.h) * T - 3, e.w * T - 4, 2);
        ctx.fillStyle = PALETTE[C.amber];
        ctx.fillRect(e.x * T + 2, (e.y + e.h) * T - 3, Math.round((e.w * T - 4) * Math.min(1, e.mach.progress)), 2);
      }
    } });
  }
  // goods on the belts, 1:1 on whole pixels, under the structures
  for (const [k, px, py] of goods) {
    const s = sprite('ib:' + kDef(k).id);
    ctx.drawImage(s.img, s.x, s.y, 10, 10, Math.round(px * T) - 5, Math.round(py * T) - 5, 10, 10);
  }
  D.sort((a, b) => a.y - b.y);
  for (const dr of D) dr.f();
  ctx.restore();
}
