// jsfxr sound bank: retro SFX designed at https://sfxr.me and stored as base58 strings.
// Each sound is rendered once into the game's own AudioContext (so it obeys the SFX
// volume) and cached. Add an entry here to replace the procedural version of a sound
// in Audio.sfx; ids not in the bank keep their synthesized fallback.
import { sfxr } from 'jsfxr';

/** id -> base58 definition. Design a sound at sfxr.me, press "serialize", paste the string. */
export const SFXR_BANK: Record<string, string> = {
  coin: '34T6PkupZ6TgLaNTTnzZmQ2XMh7gpgZpALPt2a3mXXUmZYde7MVE9C8hhmBAjNU3YecTtLzwQDqo7DVoPnX7AijEpoiE6YZK7kJLXNype2VgkkvDrfkkmZAFq',
  levelup: '11111JWWg499eQ6CqTvGHsE6T5y3U2Tkw77p23PU8EeZgiBrgCVcPRmdHnafpEN6ALk5XpHsJnjAyiuS3wP2REG2Ui2kfWQx7HxDHu9iHQkj8gLf9M6ozrrT',
  hurt: '34T6Pm1CUSouKM3VQ5aMAvsVmWsA2PpQZcSVe6q5XbJENbDho8HY8BSnRRWEBhiVnM2qbL7dSrehUVn9imTunFrrFkhQNsguEk6EUd2NGzo8pk3ssn1nJb6rs',
};
// 'sell' and 'ship' share the coin sound.
SFXR_BANK.sell = SFXR_BANK.coin;
SFXR_BANK.ship = SFXR_BANK.coin;

const cache = new Map<string, AudioBuffer>();

export function hasSfxr(id: string): boolean {
  return id in SFXR_BANK;
}

/** Render (once) and return the AudioBuffer for a bank sound, or null if it is not in the bank. */
export function sfxrBuffer(ctx: AudioContext, id: string): AudioBuffer | null {
  const def = SFXR_BANK[id];
  if (!def) return null;
  let buf = cache.get(def);
  if (!buf) {
    buf = sfxr.toWebAudio(def, ctx).buffer!;
    cache.set(def, buf);
  }
  return buf;
}

/** Play a bank sound through `bus`. `vol` scales loudness; `pitch` is a playback-rate multiplier. */
export function playSfxr(ctx: AudioContext, bus: AudioNode, id: string, vol = 1, pitch = 1): boolean {
  const buf = sfxrBuffer(ctx, id);
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(bus);
  src.start();
  return true;
}
