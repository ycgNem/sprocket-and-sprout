// The Sprocket Fair (ROADMAP.md 7.7, Phase 5): the Professor's window on the square, and the
// drafting table's bench test. Pick a blueprint that fits the 6x6 plate (the blueprint tool's copy
// or the drafting table's library), run it, and watch the plate: the line built with the real
// structure sprites at 1:1, its goods moving, the first of its five minutes played in about 12
// seconds and the other four fast-forwarded in 3. Then the value it added, a minute, against the
// year's three entries, and the prizes (the bench test has none). The sim: src/sim/testbed.ts (the
// plate), src/sim/fair.ts (entries, prizes).
import { C, PALETTE } from '../../data/palette';
import { STRUCT_BY_ID } from '../../data/structures';
import type { FestivalDef } from '../../data/types';
import { ITEM_BY_ID } from '../../data/items';
import { keyLabel } from '../../engine/input';
import { drawSprite, hasImage, sprite } from '../../render/atlas';
import type { Blueprint } from '../../sim/blueprint';
import { structFootprint } from '../../sim/build';
import { drafting, fits } from '../../sim/drafting';
import { BeltKind, type Ent } from '../../sim/ents';
import { candleText, clockYear, fairEntries, fairResult, type FairResult } from '../../sim/fair';
import { Game } from '../../sim/Game';
import { kDef, key } from '../../sim/inventory';
import { villagerName } from '../../sim/systems/orders';
import { festivalName } from '../../sim/systems/festivals';
import { itemPos } from '../../sim/systems/belts';
import { BED, BED_TICKS, bedDone, bedScore, bedTally, startBed, stepBed, type BedRun, type BedTally } from '../../sim/testbed';
import { MState } from '../../sim/mstate';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { ICON, ellipsize, textWidth } from '../font';
import { centered, frame } from './common';
import { registerWindow, type WinState } from './index';
import { drawTokenStall } from './stall';

const T = 16;
/** the first minute plays in about 12 seconds, the other four fast-forward in about 3 */
const FIRST = 60 * 60;
const FIRST_RATE = FIRST / 12, FAST_RATE = (BED_TICKS - FIRST) / 3;

interface Choice { name: string; bp: Blueprint; from: string }

interface FairData {
  mode?: 'pick' | 'run' | 'done' | 'stall';
  sel?: number;
  run?: BedRun;
  name?: string;
  bp?: Blueprint;
  res?: FairResult;
  /** the drafting table's bench test: no prizes, and Back returns to the table */
  bench?: boolean;
  /** button rectangles (UI pixels) for the real-input e2e: [x, y, w, h] */
  btn?: Record<string, number[]>;
}

/** the blueprints that fit the plate: the blueprint tool's copy first, then the drafting table's */
function choices(play: PlayScreen): Choice[] {
  const out: Choice[] = [];
  const tool = play.blueprint;
  if (tool?.items.length && fits(tool, BED, BED)) out.push({ name: 'Your blueprint tool copy', bp: tool, from: 'tool' });
  for (const e of drafting(play.g).lib) if (e.bp.items.length && fits(e.bp, BED, BED)) out.push({ name: e.name, bp: e.bp, from: e.from });
  return out;
}

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
/** a value added: "+612", "-1,271", "0" */
const signed = (n: number) => (Math.round(n) > 0 ? '+' : '') + n0(n);

/** "the Professor", "Bram", "Juniper" */
const who = (id: string) => villagerName(id);

/** the distinct machines in a blueprint (item ids), for its row */
export function machinesOf(bp: Blueprint): string[] {
  const out: string[] = [];
  for (const it of bp.items) {
    const d = STRUCT_BY_ID.get(it.def);
    if (d && (d.kind === 'machine' || d.kind === 'generator' || d.kind === 'gleaner' || d.kind === 'harvester') && !out.includes(d.item)) out.push(d.item);
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
  if (d.mode === 'done' && d.run) return drawDone(ui, play, d, x, y, W, H);
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
  ui.text('To beat this year (the value a line adds, coins a minute):', x + 12, yy, C.ink);
  yy += 11;
  for (const e of fairEntries(g.time.year)) {
    ui.text(ellipsize(`${who(e.who)}: ${e.what}`, W - 90), x + 18, yy, C.oak);
    ui.text(n0(e.score), x + W - 14, yy, C.oak, { align: 'right' });
    yy += 10;
  }
  // the prizes: the Founder's candles once a save, tokens every year
  const left = [1, 2, 3, 4].filter((c) => !g.flags.has('candle_' + c)).length;
  yy += 2;
  const clock = clockYear(g.time.year) ? 'then the best by half again' : 'then, from next year, the best by half again';
  yy += ui.para(left ? `Beat one entry, two, all three, ${clock}: each wins one of the Founder's candles (${left} left to win). Tokens and coins every year.` : "You've won all four of the Founder's candles. Tokens and coins every year.", x + 12, yy, W - 24, C.walnut, 9);
  yy += 5;
  const list = choices(play);
  d.sel = Math.min(d.sel ?? 0, Math.max(0, list.length - 1));
  const listH = y + H - 34 - yy;
  if (!list.length) {
    // nothing fits: how to make one
    ui.panel(x + 10, yy, W - 20, listH, 'paper', false);
    const copy = keyLabel(ui.input.binds.copy[0] ?? 'KeyV');
    const tool = play.blueprint;
    const msg = (tool?.items.length ? `Your blueprint tool's copy is ${tool.w} by ${tool.h}: too big for the plate. ` : 'You have no blueprint that fits the plate yet. ') +
      `On your farm, press ${copy} and drag across one of your lines, 6 by 6 or smaller (the box shows its size), then come back. Chests at its start, an arm taking its goods to a crate.`;
    ui.para(msg, x + 18, yy + 6, W - 36, C.walnut);
  } else {
    ui.text('Your lines that fit the plate:', x + 12, yy, C.ink);
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
  if (ui.button('fair_run', x + 12, by, 120, 18, 'Run on the plate', { style: 'green', disabled: !list.length, tip: 'Builds the line on the 6x6 plate and runs it for five minutes of works time' })) {
    const c = list[d.sel ?? 0];
    if (c) {
      d.run = startBed(g, c.bp);
      d.name = c.name;
      d.bp = c.bp;
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
  // the first minute in about 12 seconds, then the other four fast (a short frame cap keeps a stutter from skipping it)
  stepBed(run, Math.max(1, Math.round((run.ticks < FIRST ? FIRST_RATE : FAST_RATE) * Math.min(0.1, ui.dt))));
  const bx = x + 16, by = y + 34;
  drawBed(ui, play, run, bx, by);
  const rx = bx + BED * T + 18, rw = x + W - 14 - rx;
  const tally = bedTally(run);
  const secs = Math.floor(run.ticks / 60);
  const mins = run.ticks / FIRST;
  ui.text(ellipsize(d.name ?? 'Your line', rw), rx, y + 16, C.ink);
  ui.text(run.ticks < FIRST ? 'Minute 1 of 5' : 'Minutes 2 to 5, fast', rx, y + 30, C.walnut);
  ui.text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} of 5:00`, rx + rw, y + 30, C.walnut, { align: 'right' });
  ui.bar(rx, y + 41, rw, 5, run.ticks / BED_TICKS, run.ticks < FIRST ? C.amber : C.sky);
  ui.text(signed(tally.coins), rx, y + 52, tally.coins < 0 ? C.brick : C.ink, { scale: 2 });
  const rate = mins > 0.15 ? tally.coins / mins : 0;
  ui.text(`value added so far${mins > 0.15 ? `, about ${n0(rate)} a minute` : ''}`, rx, y + 70, C.walnut);
  // the entries tick over as the line's rate passes them
  let yy = y + 84;
  for (const e of fairEntries(g.time.year)) {
    const passed = mins > 0.15 && rate > e.score;
    ui.text(`${passed ? ICON.star + ' ' : ''}${who(e.who)}: ${n0(e.score)}`, rx, yy, passed ? C.moss : C.oak);
    yy += 10;
  }
  goodsRows(ui, tally, rx, yy + 4, rw);
  bedNotes(ui, run, bx - 2, by + BED * T + 8, BED * T + 4, y + H - 32);
  const bty = y + H - 26;
  d.btn!.skip = [x + 12, bty, 110, 18];
  if (ui.button('fair_skip', x + 12, bty, 110, 18, 'Skip to the bell')) stepBed(run, BED_TICKS);
  if (bedDone(run)) {
    d.mode = 'done';
    if (!d.bench) {
      d.res = fairResult(g, bedScore(run));
      play.app.audio.sfx(d.res.beaten ? 'levelup' : 'collect');
      if (d.res.candles.length) play.toast(`Sprocket Fair prize: ${d.res.candles.map(candleText).join('; ')}!`, undefined, C.amber);
    } else play.app.audio.sfx('collect');
  }
  return true;
}

// ---------------- the result ----------------
function drawDone(ui: UI, play: PlayScreen, d: FairData, x: number, y: number, W: number, H: number): boolean {
  const g = play.g;
  const run = d.run!;
  const score = bedScore(run);
  const r = d.res;
  const bx = x + 16, by = y + 34;
  drawBed(ui, play, run, bx, by);
  const rx = bx + BED * T + 18, rw = x + W - 14 - rx;
  ui.text(ellipsize(d.name ?? 'Your line', rw), rx, y + 16, C.ink);
  ui.text(signed(score), rx, y + 28, score > 0 ? C.ink : C.brick, { scale: 2 });
  const best = r?.best ? ', your best' : '';
  ui.text(`coins a minute of value added${best}`, rx, y + 46, C.walnut);
  let yy = y + 60;
  const es = fairEntries(g.time.year);
  for (const e of es) {
    const won = score > e.score;
    ui.text(ellipsize(`${won ? 'Beat' : 'Short of'} ${who(e.who)}'s ${e.what} (${n0(e.score)})`, rw), rx, yy, won ? C.moss : C.oak);
    yy += 10;
  }
  // the last candle: half again the top entry's score, from the second year
  const top = es.reduce((a, b) => (b.score > a.score ? b : a));
  const byHalf = score >= top.score * 1.5;
  const clock = g.flags.has('candle_4') ? '' : ' wins the Gilded Clock';
  const half = !clockYear(g.time.year) ? `From next year, half again ${who(top.who)}'s score${clock}` : byHalf ? `Half again ${who(top.who)}'s score: done!` : `Half again ${who(top.who)}'s: ${n0(top.score * 1.5)}${clock}`;
  ui.text(ellipsize(half, rw), rx, yy, byHalf && clockYear(g.time.year) ? C.moss : C.oak);
  yy += 14;
  // the prizes (the bench test has none)
  const lines: [string, number][] = [];
  if (d.bench) lines.push([`A bench test: no prizes. Bring it to the Sprocket Fair on the square, spring 13.`, C.walnut]);
  else if (r) {
    for (const c of r.candles) lines.push([`Won: ${candleText(c)}.`, C.amber]);
    if (r.tickets || r.money) lines.push([`This year's prize: ${r.tickets} tokens${r.money ? ` and ${n0(r.money)} coins` : ''}.`, C.walnut]);
    else if (score > 0) lines.push(["This year's prize is paid for a run as good as this one. Better runs still count.", C.walnut]);
  }
  if (score <= 0) lines.push([tally0(run) ? 'It used up more than it made: no prize. The score is what a line makes, less the stocked goods it uses up.' : 'Nothing made. The plate fills the chests that feed machines; a machine needs an arm taking its goods away.', C.brick]);
  for (const [l, c] of lines) yy += ui.para(l, rx, yy, rw, c, 9) + 2;
  // what the line made and used in its five minutes, and anything left off
  const tally = bedTally(run);
  const gy = Math.max(yy + 2, y + H - 66);
  goodsRows(ui, tally, rx, gy, rw);
  bedNotes(ui, run, bx - 2, by + BED * T + 8, BED * T + 4, y + H - 32);
  const bty = y + H - 26;
  d.btn!.again = [x + 12, bty, 100, 18];
  d.btn!.done = [x + W - 82, bty, 70, 18];
  if (ui.button('fair_again', x + 12, bty, 100, 18, d.bench ? 'Run again' : 'Run another')) {
    if (d.bench && d.bp) {
      d.run = startBed(g, d.bp);
      d.mode = 'run';
    } else {
      d.mode = 'pick';
      d.run = undefined;
    }
    d.res = undefined;
  }
  if (ui.button('fair_done', x + W - 82, bty, 70, 18, d.bench ? 'Back' : 'Done', { style: 'green' })) return false;
  return true;
}

/** did the line use anything up (so a score at or below zero is a loss, not an empty plate)? */
const tally0 = (run: BedRun) => run.used.size > 0;

/** what the line made (with the batches cooking) and the stock it used up: icons and counts, two rows */
function goodsRows(ui: UI, tally: BedTally, x: number, y: number, w: number): number {
  const row = (label: string, list: { k: number; n: number }[], cooking: { k: number; n: number }[], col: number, yy: number) => {
    ui.text(label, x, yy + 5, C.walnut);
    let xx = x + 30;
    for (const gd of list) {
      const t = n0(gd.n);
      if (xx + 18 + textWidth(t) > x + w) return;
      ui.itemIcon(gd.k, xx, yy, 16);
      ui.text(t, xx + 18, yy + 5, col);
      xx += 24 + textWidth(t);
    }
    for (const gd of cooking) {
      const t = `${gd.n.toFixed(1)} cooking`;
      if (xx + 18 + textWidth(t) > x + w) return;
      ui.itemIcon(gd.k, xx, yy, 16, 0, 0.65);
      ui.text(t, xx + 18, yy + 5, C.walnut);
      xx += 24 + textWidth(t);
    }
    if (!list.length && !cooking.length) ui.text('nothing yet', xx, yy + 5, C.pebble);
  };
  row('Made', tally.made, tally.cooking, C.ink, y);
  row('Used', tally.used, [], C.brick, y + 18);
  return y + 36;
}

/** what didn't run as brought: pieces that can't stand on the plate, machines left off, stock it didn't get */
function bedNotes(ui: UI, run: BedRun, x: number, y: number, w: number, maxY: number) {
  const name = (id: string) => STRUCT_BY_ID.get(id)?.name ?? ITEM_BY_ID.get(id)?.name ?? id;
  const counted = (ids: string[]) => [...new Set(ids)].map((id) => { const n = ids.filter((i) => i === id).length; return n > 1 ? `${name(id)} x${n}` : name(id); }).join(', ');
  const notes: string[] = [];
  if (run.idle.length) notes.push(`Left off, nothing carries its goods away: ${counted(run.idle)}.`);
  if (run.skipped.length) notes.push(`Can't stand on the plate (a river, a vein, a tree, or over the edge): ${counted(run.skipped)}.`);
  if (run.missing.length) notes.push(`No stock for: ${run.missing.map(name).join(', ')} (none at home, or worth nothing).`);
  if (run.noBasket) notes.push('A gleaner or crane that never picked has no basket.');
  for (const n of notes) {
    const h = ui.para(n, x, y, w, C.brick, 9);
    if (y + h > maxY) break;
    y += h + 1;
  }
}

// ---------------- the plate, drawn ----------------
/** the 6x6 plate and its line at 1:1 (pixel-grid rule): stone plates in a brass rim (as on the square), then the line */
export function drawBed(ui: UI, play: PlayScreen, run: BedRun, bx: number, by: number) {
  ui.fill(bx - 3, by - 3, BED * T + 6, BED * T + 6, C.ink);
  ui.fill(bx - 2, by - 2, BED * T + 4, BED * T + 4, C.brass);
  for (let ty = 0; ty < BED; ty++)
    for (let tx = 0; tx < BED; tx++) {
      const px = bx + tx * T, py = by + ty * T;
      ui.fill(px, py, T, T, C.stone);
      ui.fill(px, py, T - 1, 1, C.pebble);
      ui.fill(px, py, 1, T - 1, C.pebble);
      ui.fill(px, py + T - 1, T, 1, C.slate);
      ui.fill(px + T - 1, py, 1, T, C.slate);
    }
  drawLine(ui, play, run.g, bx, by, 1);
}

/**
 * A world's structures drawn at a whole-number scale with the structure sprites (belts with their
 * goods, arms, machines with their working frames), back to front: the plate's line, and the
 * drafting table's preview of a blueprint.
 */
export function drawLine(ui: UI, play: PlayScreen, g: Game, bx: number, by: number, scale: number) {
  const ctx = ui.ctx;
  const season = play.g.time.season;
  const time = ui.time;
  const frame = Math.floor(time * 8) % 4;
  ctx.save();
  ctx.translate(bx, by);
  if (scale !== 1) ctx.scale(scale, scale);
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
    // rails and gantries have drawings of their own in the world; nothing that big fits the plate
    if (def.kind === 'path' || def.kind === 'rail' || def.kind === 'gantry') continue;
    const on = e.working || (def.kind === 'generator' && (e.gen?.out ?? 0) > 0);
    const animated = on && (!!e.mach || def.kind === 'generator' || def.kind === 'lamp' || def.kind === 'sprinkler' || def.kind === 'gleaner' || def.kind === 'harvester');
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

// ---------------- a blueprint, drawn (the drafting table's preview) ----------------
const layouts = new WeakMap<Blueprint, { n: number; g: Game; w: number; h: number }>();

/** a blueprint laid out in a little world of its own (cached), for drawing with drawLine */
function layoutOf(bp: Blueprint): { g: Game; w: number; h: number } {
  const c = layouts.get(bp);
  if (c && c.n === bp.items.length) return c;
  let x0 = 0, y0 = 0, x1 = Math.max(0, bp.w - 1), y1 = Math.max(0, bp.h - 1);
  for (const it of bp.items) {
    const def = STRUCT_BY_ID.get(it.def);
    if (!def) continue;
    for (const t of structFootprint(def, it.dx, it.dy, def.rotatable ? it.rot : 0)) {
      x0 = Math.min(x0, t.x);
      y0 = Math.min(y0, t.y);
      x1 = Math.max(x1, t.x);
      y1 = Math.max(y1, t.y);
    }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const g = new Game({ blank: { w, h }, seed: 1 });
  for (const it of bp.items) {
    if (!STRUCT_BY_ID.has(it.def)) continue;
    try {
      g.ents.add(it.def, it.dx - x0, it.dy - y0, it.rot);
    } catch {
      // a piece that no longer fits its drawing is left out of the picture
    }
  }
  const out = { n: bp.items.length, g, w, h };
  layouts.set(bp, out);
  return out;
}

/**
 * A blueprint drawn with the structure sprites in a box, at the largest whole scale that fits (1:1
 * at least: a bigger drawing shows its top-left corner). Returns the scale, 0 when it was cropped.
 */
export function drawBlueprint(ui: UI, play: PlayScreen, bp: Blueprint, x: number, y: number, w: number, h: number): number {
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, C.deepsea);
  const L = layoutOf(bp);
  const pw = L.w * T, ph = L.h * T;
  const scale = Math.max(1, Math.min(Math.floor((w - 4) / pw), Math.floor((h - 4) / ph)));
  const fitsBox = pw * scale <= w - 4 && ph * scale <= h - 4;
  const ox = fitsBox ? x + Math.floor((w - pw * scale) / 2) : x + 2, oy = fitsBox ? y + Math.floor((h - ph * scale) / 2) : y + 2;
  // a faint grid under it, one square a tile
  for (let ty = 0; ty < L.h; ty++)
    for (let tx = 0; tx < L.w; tx++) {
      const sx = ox + tx * T * scale, sy = oy + ty * T * scale;
      if (sx >= x + w - 2 || sy >= y + h - 2) continue;
      ui.fill(sx, sy, Math.min(T * scale, x + w - 2 - sx), 1, C.slate, 0.4);
      ui.fill(sx, sy, 1, Math.min(T * scale, y + h - 2 - sy), C.slate, 0.4);
    }
  ui.clip(x + 1, y + 1, w - 2, h - 2);
  drawLine(ui, play, L.g, ox, oy, scale);
  ui.unclip();
  return fitsBox ? scale : 0;
}

// ---------------- the blueprint tool's copy box ----------------
/** the copy box's size by the cursor while you drag it: green when it fits the Fair's 6x6 plate, rose when it doesn't */
export function copySizeTag(ui: UI, w: number, h: number) {
  const ok = fits({ w, h, items: [] }, BED, BED);
  const size = `${w} x ${h}`, sub = ok ? "fits the Fair's plate" : "the Fair's plate is 6 x 6";
  const tw = Math.max(textWidth(size), textWidth(sub)) + 10, th = 22;
  const x = Math.max(2, Math.min(ui.w - tw - 2, ui.mx + 12)), y = Math.max(2, ui.my - th - 6);
  ui.fill(x + 2, y + 2, tw, th, C.ink, 0.4);
  ui.fill(x, y, tw, th, C.ink);
  ui.fill(x + 1, y + 1, tw - 2, th - 2, C.plum);
  ui.fill(x + 1, y + 1, 2, th - 2, ok ? C.leaf : C.rose);
  ui.text(size, x + 6, y + 4, ok ? C.lime : C.rose);
  ui.text(sub, x + 6, y + 13, C.pebble);
}

// ---------------- the drafting table's bench test ----------------
/** the bench test (arg: { name, bp, sel }): the Fair's run and result, without the prizes; Back returns to the table */
function drawBench(ui: UI, play: PlayScreen, st: WinState): boolean {
  const d = st.data as FairData;
  const arg = st.arg as { name: string; bp: Blueprint; sel?: number };
  d.bench = true;
  d.btn = {};
  if (!d.run) {
    d.run = startBed(play.g, arg.bp);
    d.name = arg.name;
    d.bp = arg.bp;
    d.mode = 'run';
  }
  const W = Math.min(ui.w - 16, 440), H = Math.min(ui.h - 28, 268);
  const { x, y } = centered(ui, W, H);
  const back = () => play.openWindow('drafting', { sel: arg.sel });
  if (!frame(ui, x, y, W, H, 'Bench test')) {
    back();
    return true;
  }
  const keep = d.mode === 'done' ? drawDone(ui, play, d, x, y, W, H) : drawRun(ui, play, d, x, y, W, H);
  if (!keep) {
    back();
    return true;
  }
  return true;
}

registerWindow('bench', { draw: drawBench });
