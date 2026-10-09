// Journal (quests, friends, collections, mail), world map, notice board, restoration board, museum.
import { C, PALETTE } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import { FISH } from '../../data/fish';
import { PROJECTS } from '../../data/goals';
import { QUEST_BY_ID } from '../../data/goals';
import { SEASON_NAMES } from '../../data/types';
import { key } from '../../sim/inventory';
import { hearts, npcSys, giftTaste } from '../../sim/systems/npcs';
import { acceptRequest, objText, questSys } from '../../sim/systems/quests';
import { donate, donateMuseum, goals, museumAccepts, MUSEUM_TOTAL, payProject, projectNeed, projectReady, readMail } from '../../sim/systems/goals';
import { tileColor } from '../hud';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { sprite } from '../../render/atlas';
import { daysLeftInWeek, guildRank, specLabel } from '../../sim/systems/contracts';
import { GUILD_RANKS } from '../../data/contracts';
import { ICON } from '../font';
import { itemTooltip } from '../tooltips';
import { portrait, heartsRow } from './town';

// ---------------- journal ----------------
function drawJournal(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(ui.w - 20, 440), h = Math.min(ui.h - 30, 300);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Journal')) return false;
  st.data.tab = st.data.tab ?? st.arg ?? 'quests';
  const tabs = [['quests', 'Quests'], ['friends', 'Friends'], ['collect', 'Collections'], ['feats', 'Achievements'], ['mail', 'Mail']];
  let jump = false;
  tabs.forEach(([id, label], i) => {
    if (ui.button('jt' + id, x + 10 + i * 70, y + 10, 66, 14, label, { active: st.data.tab === id })) {
      if (id === 'feats') jump = true;
      else st.data.tab = id;
    }
  });
  if (jump || st.data.tab === 'feats') {
    // achievements live in their own window now
    play.openWindow('achievements');
    return true;
  }
  const bx = x + 10, by = y + 30, bw = w - 20, bh = h - 40;
  ui.panel(bx, by, bw, bh, 'inset', false);
  if (st.data.tab === 'quests') {
    const q = questSys(g);
    const gs = g.sys.guild;
    const guildH = gs?.unlocked ? 24 + gs.list.length * 10 : 0;
    let yy = by + 6 - ui.scrollOffset('jq', bx, by, bw, bh, 40 + guildH + q.active.length * 60 + q.done.length * 10);
    ui.clip(bx, by, bw, bh);
    if (gs?.unlocked) {
      ui.text(`Trading Guild contracts (${daysLeftInWeek(g)} day${daysLeftInWeek(g) === 1 ? '' : 's'} left)`, bx + 8, yy, C.ink);
      ui.text(GUILD_RANKS[guildRank(g)].name, bx + bw - 8, yy, C.oak, { align: 'right' });
      yy += 11;
      for (const c of gs.list) {
        ui.text(`${c.done ? '+' : '-'} ${specLabel(c.spec)}: ${c.have}/${c.need}  (${ICON.coin}${c.reward.toLocaleString()})`, bx + 14, yy, c.done ? C.moss : C.walnut);
        yy += 10;
      }
      yy += 8;
    }
    for (const a of q.active) {
      const d = QUEST_BY_ID.get(a.id);
      if (!d) continue;
      ui.text(d.title, bx + 8, yy, C.ink);
      ui.text(`from ${NPC_BY_ID.get(d.giver)?.name ?? 'the town'}`, bx + bw - 8, yy, C.oak, { align: 'right' });
      yy += 11;
      yy += ui.para(d.desc, bx + 8, yy, bw - 16, C.walnut, 9) + 2;
      d.objectives.forEach((o, i) => {
        ui.text('- ' + objText(g, o, a.prog[i]), bx + 14, yy, C.moss);
        yy += 10;
      });
      if (d.hint) {
        yy += ui.para('Tip: ' + d.hint, bx + 14, yy, bw - 28, C.oak, 9);
      }
      yy += 8;
    }
    if (q.done.length) {
      ui.text(`Completed (${q.done.length})`, bx + 8, yy, C.oak);
      yy += 11;
      for (const id of q.done.slice().reverse()) {
        ui.text('+ ' + (QUEST_BY_ID.get(id)?.title ?? id), bx + 14, yy, C.moss);
        yy += 10;
      }
    }
    ui.unclip();
  } else if (st.data.tab === 'friends') {
    const list = npcSys(g).list;
    const rowH = 30;
    const pet = g.sys.pet?.stage === 'adopted' ? g.sys.pet : null;
    const first = pet ? 1 : 0;
    const off = ui.scrollOffset('jf', bx, by, bw, bh, (list.length + first) * rowH + 4);
    ui.clip(bx, by, bw, bh);
    if (pet) {
      const ry = by + 2 - off;
      ui.fill(bx + 4, ry, 22, 22, C.tan, 0.5);
      const ps = sprite(`pet:${pet.kind}:${pet.coat}:2`);
      ui.ctx.drawImage(ps.img, ps.x, ps.y, ps.w, ps.h, bx + 4, ry + 2, 20, 20);
      ui.text(pet.name, bx + 34, ry + 3, C.ink);
      ui.text(`Your ${pet.kind}`, bx + 34, ry + 13, C.oak);
      const ph = Math.min(5, Math.floor(pet.points / 200));
      ui.text(ICON.heart.repeat(ph) + '.'.repeat(5 - ph), bx + 230, ry + 3, C.rose);
      ui.text(pet.bowlFull ? 'Water bowl full' : 'Water bowl empty', bx + 230, ry + 13, pet.bowlFull ? C.moss : C.walnut);
      if (pet.petted) ui.text('petted', bx + bw - 8, ry + 3, C.moss, { align: 'right' });
    }
    list.forEach((n, i0) => {
      const i = i0 + first;
      const d = NPC_BY_ID.get(n.id)!;
      const ry = by + 2 + i * rowH - off;
      if (ry < by - rowH || ry > by + bh) return;
      portrait(ui, n.id, bx + 4, ry, 18);
      ui.text(n.met ? d.name : '???', bx + 34, ry + 3, C.ink);
      if (g.flags.has('partner:' + n.id)) ui.text(ICON.heart + ' partner', bx + 34 + d.name.length * 6 + 6, ry + 3, C.rose);
      ui.text(n.met ? d.job : 'You haven\'t met yet', bx + 34, ry + 13, C.oak);
      heartsRow(ui, hearts(n), bx + 230, ry + 3);
      ui.text(`Birthday: ${SEASON_NAMES[d.birthday.season]} ${d.birthday.day}`, bx + 230, ry + 13, C.walnut);
      if (n.talked) ui.text('talked', bx + bw - 8, ry + 3, C.moss, { align: 'right' });
      if (n.giftedToday) ui.text('gift', bx + bw - 8, ry + 13, C.rose, { align: 'right' });
      if (ui.hover(bx, ry, bw, rowH - 2) && n.met) {
        // known gift tastes: love items you have gifted
        const lines = [{ text: d.name, color: C.amber }, { text: d.personality }, { text: `Friendship ${n.points}/${2500}`, color: C.pebble }];
        const held = g.player.inv.slots[g.player.sel];
        if (held) lines.push({ text: `Would think of your ${ITEMS[held.k >> 2].name}: ${giftTaste(d, ITEMS[held.k >> 2].id)}`, color: C.lime });
        ui.tip(lines, 220);
      }
    });
    ui.unclip();
  } else if (st.data.tab === 'collect') {
    const gs = goals(g);
    st.data.sub = st.data.sub ?? 'shipped';
    [['shipped', 'Shipped'], ['fish', 'Fish'], ['museum', 'Museum']].forEach(([id, label], i) => { if (ui.button('cs' + id, bx + 6 + i * 60, by + 4, 56, 12, label, { active: st.data.sub === id, style: 'flat' })) st.data.sub = id; });
    const gy = by + 20;
    let list: { id: string; got: boolean; extra?: string }[] = [];
    if (st.data.sub === 'shipped') list = ITEMS.filter((d) => ['crop', 'fruit', 'flower', 'forage', 'animal', 'artisan', 'food'].includes(d.cat) && d.price > 0).map((d) => ({ id: d.id, got: (gs.shipped[d.id] ?? 0) > 0, extra: `shipped ${gs.shipped[d.id] ?? 0}` }));
    else if (st.data.sub === 'fish') list = FISH.map((f) => ({ id: f.id, got: !!gs.fish[f.id], extra: gs.fish[f.id] ? `caught ${gs.fish[f.id].n}, best ${gs.fish[f.id].max} cm` : `${f.where.join('/')}, ${f.seasons.map((s) => SEASON_NAMES[s]).join(' ')}` }));
    else list = ITEMS.filter((d) => museumAccepts(d.id)).map((d) => ({ id: d.id, got: gs.museum.includes(d.id), extra: gs.museum.includes(d.id) ? 'donated' : 'not donated yet' }));
    const got = list.filter((l) => l.got).length;
    ui.text(`${got} / ${list.length}`, bx + bw - 8, by + 6, C.walnut, { align: 'right' });
    const cols = Math.floor((bw - 12) / 20);
    const off = ui.scrollOffset('jc' + st.data.sub, bx, gy, bw, bh - 22, Math.ceil(list.length / cols) * 20);
    ui.clip(bx, gy, bw, bh - 22);
    list.forEach((l, i) => {
      const sx = bx + 6 + (i % cols) * 20, sy = gy + Math.floor(i / cols) * 20 - off;
      if (sy < gy - 20 || sy > by + bh) return;
      ui.panel(sx, sy, 18, 18, 'slot', false);
      if (l.got) ui.itemIcon(key(l.id), sx + 1, sy + 1, 16);
      else {
        ui.ctx.globalAlpha = 0.15;
        ui.itemIcon(key(l.id), sx + 1, sy + 1, 16);
        ui.ctx.globalAlpha = 1;
      }
      if (ui.hover(sx, sy, 18, 18)) ui.tip([{ text: l.got ? ITEM_BY_ID.get(l.id)!.name : '???', color: C.amber }, { text: l.extra ?? '', color: C.pebble }]);
    });
    ui.unclip();
  } else if (st.data.tab === 'mail') {
    const mail = goals(g).mail;
    const sel = mail[st.data.mi ?? 0];
    const lw = 130;
    mail.forEach((m, i) => {
      const ry = by + 4 + i * 14;
      if (ry > by + bh - 14) return;
      if (ui.button('ml' + i, bx + 4, ry, lw, 13, (m.read ? '' : '* ') + m.title.slice(0, 22), { style: 'flat', active: (st.data.mi ?? 0) === i })) st.data.mi = i;
    });
    if (sel) {
      readMail(g, sel);
      const tx = bx + lw + 12;
      ui.panel(tx - 4, by + 4, bw - lw - 14, bh - 8, 'paper', false);
      ui.text(sel.title, tx, by + 10, C.ink);
      ui.text(`from ${NPC_BY_ID.get(sel.from)?.name ?? sel.from}`, tx, by + 20, C.oak);
      ui.para(sel.text.replace(/\{player\}/g, g.player.name), tx, by + 34, bw - lw - 30, C.walnut);
      if (sel.items?.length) ui.text('Attached: ' + sel.items.map((i) => `${i.n} ${ITEM_BY_ID.get(i.item)?.name}`).join(', ') + ' (received)', tx, by + bh - 20, C.moss);
    } else ui.text('No letters yet.', bx + 10, by + 10, C.oak);
  }
  return true;
}

// ---------------- map ----------------
let mapCanvas: HTMLCanvasElement | null = null;
let mapKey = '';
function drawMap(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const m = g.map;
  const scale = Math.max(1, Math.min(Math.floor((ui.w - 40) / m.w), Math.floor((ui.h - 60) / m.h))) || 1;
  const mw = m.w * scale, mh = m.h * scale;
  const fit = Math.min((ui.w - 40) / m.w, (ui.h - 60) / m.h);
  const s2 = scale >= 1 && m.w * scale < ui.w - 40 ? scale : fit;
  const w = Math.round(m.w * s2) + 16, h = Math.round(m.h * s2) + 30;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Valley of Thistlewick')) return false;
  const k = `${g.time.season}:${m.version >> 6}:${g.ents.version >> 4}`;
  if (!mapCanvas || mapKey !== k) {
    mapKey = k;
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = m.w;
    mapCanvas.height = m.h;
    const ctx = mapCanvas.getContext('2d')!;
    const img = ctx.createImageData(m.w, m.h);
    for (let yy = 0; yy < m.h; yy++)
      for (let xx = 0; xx < m.w; xx++) {
        const hex = PALETTE[tileColor(g, m, xx, yy)];
        const i = (yy * m.w + xx) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }
  const ox = x + 8, oy = y + 18;
  ui.ctx.imageSmoothingEnabled = false;
  ui.ctx.drawImage(mapCanvas, ox, oy, m.w * s2, m.h * s2);
  const labels: [string, string][] = [['farmhouse', g.player.farmName + ' Farm'], ['square', 'Town Square'], ['mine_entrance', 'Old Mine'], ['quarry', 'Quarry'], ['lake_dock', 'Mirror Lake'], ['pier', 'Pier'], ['forest_pond', 'Forest Pond'], ['hermit_hut', "Thorne's Hollow"], ['forest_glade', 'Glade'], ['ranch', 'Ranch'], ['fisher_hut', 'Bait & Tackle']];
  for (const [loc, name] of labels) {
    const l = m.locs.get(loc);
    if (!l) continue;
    const lx = ox + l[0] * s2, ly = oy + l[1] * s2;
    ui.fill(lx - 1, ly - 1, 3, 3, C.ink);
    ui.text(name, lx, ly - 10, C.cream, { align: 'center', shadow: C.ink });
  }
  for (const n of npcSys(g).list) if (n.visible) ui.fill(ox + n.x * s2 - 1, oy + n.y * s2 - 1, 2, 2, C.lavender);
  const p = g.player;
  if (p.where === 'world') {
    const px = ox + p.x * s2, py = oy + p.y * s2;
    if (Math.floor(ui.time * 3) % 2) ui.fill(px - 2, py - 2, 5, 5, C.rose);
    ui.fill(px - 1, py - 1, 3, 3, C.cream);
  } else ui.text(`You are on mine floor ${g.sys.mine?.floor}`, x + w / 2, y + h - 10, C.walnut, { align: 'center' });
  void mw;
  void mh;
  void st;
  return true;
}

// ---------------- notice board ----------------
function drawBoard(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const q = questSys(g);
  const w = 380, h = 220;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Notice Board')) return false;
  ui.text('Help wanted! Bring the items to the person who asked.', x + 14, y + 12, C.walnut);
  q.requests.forEach((r, i) => {
    const ry = y + 28 + i * 58;
    const d = NPC_BY_ID.get(r.npc)!;
    ui.panel(x + 12, ry, w - 24, 54, 'paper', false);
    portrait(ui, r.npc, x + 16, ry + 4, 32, 0);
    ui.text(d.name, x + 64, ry + 5, C.ink);
    ui.para(`"${r.text}"`, x + 64, ry + 15, w - 160, C.walnut, 9);
    ui.itemIcon(key(r.item), x + 64, ry + 34, 14);
    ui.text(`${r.n} x ${ITEM_BY_ID.get(r.item)!.name}   Reward: ${ICON.coin}${r.reward} + friendship`, x + 82, ry + 38, C.oak);
    if (r.done) ui.text('Done!', x + w - 30, ry + 6, C.moss, { align: 'right' });
    else if (q.current === i) ui.text('Accepted', x + w - 30, ry + 6, C.amber, { align: 'right' });
    else if (ui.button('acc' + i, x + w - 76, ry + 4, 56, 16, 'Accept', { style: 'green' })) {
      const err = acceptRequest(g, i);
      if (err) play.toast(err);
    }
  });
  if (!q.requests.length) ui.text('No requests today.', x + 14, y + 40, C.oak);
  void st;
  return true;
}

// ---------------- restoration ----------------
function drawRestoration(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const gs = goals(g);
  const w = Math.min(ui.w - 20, 440), h = Math.min(ui.h - 30, 300);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Clocktower Restoration Board')) return false;
  const areas = [...new Set(PROJECTS.map((p) => p.area))];
  st.data.area = st.data.area ?? areas[0];
  areas.forEach((a, i) => {
    const done = PROJECTS.filter((p) => p.area === a).every((p) => gs.doneProjects.includes(p.id));
    if (ui.button('ra' + a, x + 10 + i * Math.floor((w - 40) / areas.length), y + 10, Math.floor((w - 40) / areas.length) - 4, 14, (done ? '+ ' : '') + a, { active: st.data.area === a })) st.data.area = a;
  });
  ui.text(`${gs.doneProjects.length}/${PROJECTS.length} projects restored`, x + w - 12, y + h - 58, C.walnut, { align: 'right' });
  const list = PROJECTS.filter((p) => p.area === st.data.area);
  let yy = y + 30;
  for (const p of list) {
    const done = gs.doneProjects.includes(p.id);
    ui.panel(x + 10, yy, w - 20, 46, done ? 'brass' : 'paper', false);
    ui.text(p.name + (done ? '  - restored!' : ''), x + 16, yy + 4, C.ink);
    ui.text(p.desc, x + 16, yy + 13, C.walnut);
    p.items.forEach((it, i) => {
      const need = projectNeed(g, p.id, it.item);
      const ix = x + 16 + i * 46, iy = yy + 24;
      const icon = it.item[0] === '#' ? ({ '#preserve': 'jam_strawberry', '#wine': 'wine_grape' } as any)[it.item] ?? 'fiber' : it.item;
      ui.slot(ix, iy, { k: key(icon), n: 1 }, { size: 18, dim: need > 0 });
      ui.text(`${it.n - need}/${it.n}`, ix + 20, iy + 6, need <= 0 ? C.moss : C.walnut);
      if (ui.hover(ix, iy, 40, 18)) ui.tip([{ text: it.item[0] === '#' ? 'Any ' + it.item.slice(1) : ITEM_BY_ID.get(it.item)!.name, color: C.amber }, { text: done ? 'Done' : 'Click a matching item in your bag below to donate it', color: C.pebble }]);
    });
    if (p.money) ui.text(`+ ${ICON.coin}${p.money}`, x + w - 120, yy + 30, C.oak);
    if (!done && p.money && projectReady(g, p.id) && ui.button('pay' + p.id, x + w - 70, yy + 26, 54, 15, 'Pay', { style: 'green', disabled: g.player.money < p.money })) payProject(g, p.id);
    ui.text('Reward: ' + p.reward.text, x + w - 16, yy + 4, done ? C.moss : C.oak, { align: 'right' });
    yy += 50;
  }
  // inventory strip for donating
  const iy = y + h - 48;
  ui.text('Your bag: click an item to donate it to this area', x + 10, iy - 2, C.walnut);
  const inv = g.player.inv;
  for (let i = 0; i < 36; i++) {
    const sx = x + 10 + (i % 18) * 23, sy = iy + 8 + Math.floor(i / 18) * 20;
    const s = inv.slots[i];
    const useful = s && list.some((p) => !gs.doneProjects.includes(p.id) && p.items.some((it) => projectNeed(g, p.id, it.item) > 0 && (it.item === ITEMS[s.k >> 2].id || (it.item[0] === '#' && ITEMS[s.k >> 2].tags?.includes(it.item.slice(1))))));
    const r = ui.slot(sx, sy, s, { size: 19, dim: !!s && !useful });
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n).slice(0, 2));
    if (r.click && s && useful) {
      for (const p of list) {
        const t = donate(g, p.id, s.k, s.n);
        if (t) {
          inv.remove(s.k, t);
          break;
        }
      }
    }
  }
  return true;
}

// ---------------- museum ----------------
function drawMuseum(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const gs = goals(g);
  const w = 360, h = 200;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Library & Museum')) return false;
  ui.para(`Sable keeps the town's collection of minerals, gems and relics. Donated: ${gs.museum.length}/${MUSEUM_TOTAL}. Milestones bring gifts!`, x + 12, y + 12, w - 24, C.walnut);
  const inv = g.player.inv;
  ui.text('Click a gem, mineral or relic to donate it:', x + 12, y + 44, C.ink);
  for (let i = 0; i < 36; i++) {
    const sx = x + 12 + (i % 12) * 22, sy = y + 56 + Math.floor(i / 12) * 22;
    const s = inv.slots[i];
    const ok = s && museumAccepts(ITEMS[s.k >> 2].id) && !gs.museum.includes(ITEMS[s.k >> 2].id);
    const r = ui.slot(sx, sy, s, { dim: !!s && !ok });
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n, [{ text: ok ? 'Click to donate' : gs.museum.includes(ITEMS[s.k >> 2].id) ? 'Already donated' : 'The museum doesn\'t collect this', color: ok ? C.lime : C.pebble }]).slice(0, 4));
    if (r.click && ok && s) donateMuseum(g, ITEMS[s.k >> 2].id);
  }
  ui.text('Next gift at ' + ([5, 10, 15, 20, 25].find((n) => n > gs.museum.length) ?? 'complete!') + ' donations', x + 12, y + h - 18, C.oak);
  void st;
  void NPCS;
  return true;
}

registerWindow('journal', { draw: drawJournal });
registerWindow('map', { draw: drawMap });
registerWindow('board', { draw: drawBoard });
registerWindow('restoration', { draw: drawRestoration });
registerWindow('museum', { draw: drawMuseum });
registerWindow('mail', { draw: (ui, play, st) => { st.data.tab = 'mail'; return drawJournal(ui, play, st); } });
