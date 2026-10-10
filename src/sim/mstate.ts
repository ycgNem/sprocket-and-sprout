// The machine contract's states (ROADMAP.md 4.1). Every structure that handles items is in
// exactly one of six states, with one line of detail ("Waiting for cogbeans", "Crate is full").
// Systems set it as they tick; the renderer's glyphs, the tooltips, the pulse lamps and the Line
// tab all read it, so "why did it stop?" has one answer everywhere.
import type { Ent } from './ents';

export enum MState {
  /** nothing to do and nothing expected (never fed, switched off, no recipe) */
  Idle = 0,
  Working = 1,
  /** wants input and none is coming */
  Starved = 2,
  /** its output has nowhere to go */
  Blocked = 3,
  /** no grid, a switched-off pole, or under a quarter of the power it needs */
  Unpowered = 4,
  NeedsFuel = 5,
}

export const STATE_COUNT = 6;
export const STATE_NAME: Record<MState, string> = {
  [MState.Idle]: 'Idle',
  [MState.Working]: 'Working',
  [MState.Starved]: 'Starved',
  [MState.Blocked]: 'Blocked',
  [MState.Unpowered]: 'Unpowered',
  [MState.NeedsFuel]: 'Needs fuel',
};

/** seconds a state must last before its glyph shows: arms flicker between swings, machines don't */
export function glyphDelay(e: Ent): number {
  if (e.arm) return e.state === MState.Starved ? 10 : 3;
  if (e.belt) return 0;
  return 2;
}

/** Set an entity's state and detail line; `now` is the sim clock (g.simTime). */
export function setState(e: Ent, s: MState, why: string, now: number) {
  if (e.state !== s) {
    e.state = s;
    e.since = now;
  }
  e.why = why;
  e.fieldWait = false;
  e.refused = undefined;
}

/** why a consumer on a switched-off pole does nothing */
export function offText(e: Ent): string {
  return e.offNight ? 'Night shift only: runs 2am-6am' : 'Switched off at its pole';
}

/** an arm or belt stopped by an item its taker can't use at all: Blocked, naming the item */
export function setRefused(e: Ent, taker: Ent, k: number, item: string, now: number) {
  setState(e, MState.Blocked, `The ${taker.def.name.toLowerCase()} can't use ${item}`, now);
  e.refused = k;
}

/**
 * Starved only because its field has nothing ripe: a healthy, field-limited line. Idle, with no
 * glyph, sound or lamp (ROADMAP.md 4.2 "waiting for harvest").
 */
export function setHarvestWait(e: Ent, why: string, now: number) {
  setState(e, MState.Idle, why, now);
  e.fieldWait = true;
}

/** a stop that's just a queue in front of a busy taker (ROADMAP.md 4.2 "queued, not blocked") */
export function setQueued(e: Ent, taker: Ent | null, now: number) {
  setState(e, MState.Working, taker ? `Queued: the ${taker.def.name.toLowerCase()} is busy` : 'Queued', now);
}

/** is this structure busy (so a full queue in front of it is healthy)? */
export function isBusy(e: Ent | null | undefined): boolean {
  return !!e && (e.state === MState.Working || !!e.mach?.crafting);
}

/** How long the entity has been in its current state (sim seconds). */
export function stateAge(e: Ent, now: number): number {
  return now - (e.since ?? 0);
}

/** The one line a tooltip or window shows: the detail if there is one, else the state's name. */
export function stateText(e: Ent): string {
  return e.why || STATE_NAME[e.state ?? MState.Idle];
}

/** a problem state (the ones with a glyph and an advice line) */
export function isProblem(s: MState): boolean {
  return s === MState.Starved || s === MState.Blocked || s === MState.Unpowered || s === MState.NeedsFuel;
}
