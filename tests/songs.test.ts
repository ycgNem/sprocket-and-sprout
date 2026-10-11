// The music (src/engine/audio/songs.ts): three composed songs a player can skip through (the owner
// after 2.0: "redo the music, and add 3 tracks people can skip through"). The notation reads, every
// event falls inside its song in a range the synthesizer plays well, and N skips by default.
import { describe, expect, it } from 'vitest';
import { SONGS, chordOf, midiOf, voicing } from '../src/engine/audio/songs';
import { ACTIONS, DEFAULT_BINDS } from '../src/engine/input';

describe('the music', () => {
  it('is three songs with names in the UI font, each a minute or two long', () => {
    expect(SONGS.length).toBe(3);
    expect(new Set(SONGS.map((s) => s.title)).size).toBe(3);
    for (const s of SONGS) {
      expect(/^[\x20-\x7e]+$/.test(s.title) && !/[$_]/.test(s.title), s.title).toBe(true);
      const secs = (s.length * 60) / s.bpm;
      expect(secs, s.title).toBeGreaterThan(60);
      expect(secs, s.title).toBeLessThan(150);
    }
  });

  it('every event falls inside its song, in order, at a playable pitch', () => {
    for (const s of SONGS) {
      let last = -1;
      for (const e of s.events) {
        expect(e.beat).toBeGreaterThanOrEqual(last);
        last = e.beat;
        expect(e.beat + e.dur, `${s.title} at beat ${e.beat}`).toBeLessThanOrEqual(s.length + 0.1);
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1.2);
        for (const n of e.notes) {
          expect(n, `${s.title} ${e.inst}`).toBeGreaterThanOrEqual(28);
          expect(n, `${s.title} ${e.inst}`).toBeLessThanOrEqual(96);
        }
      }
      // something sounds in every bar
      for (let b = 0; b < s.bars; b++) expect(s.events.some((e) => e.beat >= b * s.beatsPerBar && e.beat < (b + 1) * s.beatsPerBar), `${s.title} bar ${b + 1}`).toBe(true);
    }
  });

  it('reads notes and chords, and voices a chord close around its centre', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('F#5')).toBe(78);
    expect(midiOf('Bb3')).toBe(58);
    expect(voicing(chordOf('C'), 60)).toEqual([55, 60, 64]);
    expect(voicing(chordOf('Am7'), 60)).toEqual([55, 57, 60, 64]);
    expect(chordOf('C/E').bass).toBe(4);
    expect(() => chordOf('H7')).toThrow();
    expect(() => midiOf('C')).toThrow();
  });

  it('a song can be skipped with N, which nothing else uses', () => {
    expect(ACTIONS).toContain('music');
    expect(DEFAULT_BINDS.music).toEqual(['KeyN']);
    for (const a of ACTIONS) if (a !== 'music') expect(DEFAULT_BINDS[a], a).not.toContain('KeyN');
  });
});
