// jsfxr sound bank: retro SFX stored as base58 strings. The first three were designed at
// https://sfxr.me; the rest are parameter sets in scripts/sfx-design.mjs (rerun it to change
// them). Each sound is rendered once into the game's own AudioContext (so it obeys the SFX
// volume) and cached. Add an entry here to replace the procedural version of a sound in
// Audio.sfx; ids not in the bank keep their synthesized fallback.
import { sfxr } from 'jsfxr';

/** id -> base58 definition. Design a sound at sfxr.me, press "serialize", paste the string. */
export const SFXR_BANK: Record<string, string> = {
  coin: '34T6PkupZ6TgLaNTTnzZmQ2XMh7gpgZpALPt2a3mXXUmZYde7MVE9C8hhmBAjNU3YecTtLzwQDqo7DVoPnX7AijEpoiE6YZK7kJLXNype2VgkkvDrfkkmZAFq',
  levelup: '11111JWWg499eQ6CqTvGHsE6T5y3U2Tkw77p23PU8EeZgiBrgCVcPRmdHnafpEN6ALk5XpHsJnjAyiuS3wP2REG2Ui2kfWQx7HxDHu9iHQkj8gLf9M6ozrrT',
  hurt: '34T6Pm1CUSouKM3VQ5aMAvsVmWsA2PpQZcSVe6q5XbJENbDho8HY8BSnRRWEBhiVnM2qbL7dSrehUVn9imTunFrrFkhQNsguEk6EUd2NGzo8pk3ssn1nJb6rs',
  // scripts/sfx-design.mjs
  pickup: '57uBnWgpsMuJCJGHndFBtWtuLoFBXVGCb11Gfg6u3XiUFbTaFogD2sLVbzZJVeZe1TEfpqp5UxkWxPpMKce8fXNkDUK5pQAXM8mz6BQAwXFjM74iChUFwZ6sR',
  harvest: '111113svfEgTc931YiWWGSDnUTqxJyTjpZBTB5fLmJgMzKMzVM2C4eGZdHiBLWjuMUfeX7bSS7RhcCLZQfjRDXyxt57VhvpV3bidxwjCcaN9W4MqRkA65dRq',
  click: '11111BFZZ5aCLQJUWY1sLk8atJVvi8pSfY5rPme3DDqYS74kRUV29bJ4TGhhHJSgjNSty5qGUBssTLQxG7Xt2uDvYTXFTtTjRntWtDMoAcafN5XWLSmNHefZ',
  place: '11111mqnbdazM2LyYZhScMj4R64bxXyx4ZTfw9MVTL12rEyc8ir98EmNkW9xT6wBGoPAkq3PecvnGihmKj1MUnGEzAxAhd8LyEDMing1Hna9bcXyBZwi4Ky',
  coin_tick: '57uBnWSzhdtKiRrbjq3bhLhWLsbCS1XAEXXXB3Ci29B4KbJX7GVUmdnzwugKmfHyEKbuvzDpoNFvYSe9ZFEScZVRcfSrKf98jU6dYoYq8ze8kCnxQAxTmoCv3',
  machine_done: '57uBnWSzi74McMA2KUayWTyaeLwUnD7UmnEdu4T8eBdoJWhbVfMx5aR2NP5qKoAQ3rKgBCwbjpZ2Unp4skiujmgM15cc61K8yMHBBz34TRg5sFjJMnVCtkySo',
};
// 'sell' and 'ship' share the coin sound.
SFXR_BANK.sell = SFXR_BANK.coin;
SFXR_BANK.ship = SFXR_BANK.coin;

/**
 * Loudness per sound (base58 strings carry no volume). Frequent sounds sit low so a busy farm
 * never gets shrill: clicks and machine bells are background, the harvest pop is the star.
 */
export const BANK_GAIN: Record<string, number> = {
  click: 0.45, pickup: 0.6, harvest: 0.85, place: 0.9, coin_tick: 0.5, machine_done: 0.3,
};

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
  g.gain.value = vol * (BANK_GAIN[id] ?? 1);
  src.connect(g);
  g.connect(bus);
  src.start();
  return true;
}
