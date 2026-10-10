// The sim side of lesson cards (ROADMAP.md 6.4): the first time a situation happens, remember it
// (a saved flag) and ask the play screen to show its card. It imports only data, so any sim
// module can call it directly.
import type { Game } from './Game';
import { LESSON_BY_ID } from '../data/lessons';

export function lesson(g: Game, id: string): boolean {
  if (!LESSON_BY_ID.has(id) || g.flags.has('lesson:' + id)) return false;
  g.flags.add('lesson:' + id);
  g.emit({ t: 'lesson', id });
  return true;
}

/** the lessons this save has seen, in the order the Notebook lists them */
export function lessonsSeen(g: Game): string[] {
  return [...LESSON_BY_ID.keys()].filter((id) => g.flags.has('lesson:' + id));
}
