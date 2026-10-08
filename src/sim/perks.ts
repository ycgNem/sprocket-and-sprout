// Choosing professions at skill levels 5 and 10.
import { PERKS, PERK_BY_ID, perkChoices } from '../data/perks';
import { C } from '../data/palette';
import { Game, SKILLS } from './Game';

export function pendingPerk(g: Game): { skill: string; level: 5 | 10 } | null {
  const p = g.player;
  for (const skill of SKILLS)
    for (const level of [5, 10] as const) {
      if ((p.skills[skill] ?? 0) < level) continue;
      if (!p.perks.some((id) => { const d = PERK_BY_ID.get(id); return d?.skill === skill && d.level === level; })) return { skill, level };
    }
  return null;
}

export function choosePerk(g: Game, id: string): boolean {
  const d = PERK_BY_ID.get(id);
  const pend = pendingPerk(g);
  if (!d || !pend) return false;
  if ((g.player.skills[d.skill] ?? 0) < d.level) return false;
  if (perkChoices(d.skill, d.level).some((o) => g.player.perks.includes(o.id))) return false;
  g.player.perks.push(id);
  if (id === 'defender') {
    g.player.maxHp += 25;
    g.player.hp += 25;
  }
  g.toast(`New profession: ${d.name}! ${d.desc}`, undefined, C.amber);
  g.emit({ t: 'sfx', id: 'levelup' });
  return true;
}

export function perksFor(g: Game, skill: string) {
  return PERKS.filter((d) => d.skill === skill && g.player.perks.includes(d.id));
}
