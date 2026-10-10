// The patch notes on the title screen ("What's new"): every version's notes from
// src/data/patchnotes.ts, newest first, in one scrolling column. The button glows until this
// version's notes have been opened once (per browser).
import { PATCH_NOTES } from '../data/patchnotes';
import { C } from '../data/palette';
import { LINE_H, wrapText } from './font';
import type { UI } from './ui';

const SEEN_KEY = 'sns-notes-seen';

/** has this browser opened the newest notes yet? */
export function notesSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === PATCH_NOTES[0]?.version;
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, PATCH_NOTES[0]?.version ?? '');
  } catch {
    /* private window: it glows again next time */
  }
}

interface Row { text: string; x: number; y: number; c: number; scale?: number; dot?: boolean }

let laid: { w: number; rows: Row[]; h: number } | null = null;

function layout(w: number) {
  if (laid?.w === w) return laid;
  const rows: Row[] = [];
  let y = 0;
  const line = (text: string, x: number, c: number, gap = 0, scale?: number, dot?: boolean) => {
    y += gap;
    rows.push({ text, x, y, c, scale, dot });
    y += scale ? LINE_H * scale : LINE_H;
  };
  PATCH_NOTES.forEach((n, i) => {
    if (i) y += 14;
    line(`${n.version}  -  ${n.date}`, 0, C.amber, 0, 2);
    for (const l of wrapText(n.title, w)) line(l, 0, C.walnut, 1);
    y += 3;
    for (const l of wrapText(n.intro, w)) line(l, 0, C.ink);
    for (const s of n.sections) {
      line(s.title, 0, C.rust, 7);
      for (const it of s.items) wrapText(it, w - 9).forEach((l, j) => line(l, 9, C.ink, j ? 0 : 2, undefined, !j));
    }
  });
  laid = { w, rows, h: y };
  return laid;
}

/** the notes panel; false when it's closed */
export function drawNotes(ui: UI, t: number): boolean {
  if (t === 0) markSeen();
  const w = Math.min(460, ui.w - 16), h = ui.h - 24;
  const x = Math.floor((ui.w - w) / 2), y = Math.floor((ui.h - h) / 2);
  ui.panel(x, y, w, h);
  ui.text("What's new", x + w / 2, y + 8, C.walnut, { align: 'center', scale: 2 });
  const ax = x + 14, ay = y + 32, aw = w - 26, ah = h - 62;
  const L = layout(aw - 8);
  const off = ui.scrollOffset('notes', ax, ay, aw, ah, L.h);
  ui.clip(ax, ay, aw - 4, ah);
  for (const r of L.rows) {
    const ry = ay + r.y - off;
    if (ry < ay - 20 || ry > ay + ah) continue;
    if (r.dot) ui.fill(ax + r.x - 6, ry + 3, 2, 2, C.oak);
    ui.text(r.text, ax + r.x, ry, r.c, r.scale ? { scale: r.scale } : {});
  }
  ui.unclip();
  // the keyboard scrolls too
  const step = (ui.input.keyPressed('ArrowDown') || ui.input.keyPressed('KeyS') ? 30 : 0) - (ui.input.keyPressed('ArrowUp') || ui.input.keyPressed('KeyW') ? 30 : 0) + (ui.input.keyPressed('PageDown') ? ah - 20 : 0) - (ui.input.keyPressed('PageUp') ? ah - 20 : 0);
  if (step) ui.scroll.set('notes', Math.max(0, Math.min(Math.max(0, L.h - ah), off + step)));
  ui.text('Scroll for more: mouse wheel or the arrow keys', x + 14, y + h - 21, C.oak);
  if (ui.button('notes_back', x + w - 74, y + h - 26, 60, 18, 'Back') || ui.input.keyPressed('Escape')) return false;
  return true;
}
