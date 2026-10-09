// Designs the jsfxr sounds in src/engine/audio/sfxr.ts as parameter sets (cozy: soft attack, short
// decay, low-passed; loudness per id lives in BANK_GAIN, base58 strings carry no volume) and prints their base58 strings for SFXR_BANK. With --wav it also writes
// e2e/out/sfx/<id>.wav to listen to, and prints length and loudness as a sanity check.
// Usage: node scripts/sfx-design.mjs [--wav]
import fs from 'node:fs';
import { sfxr } from 'jsfxr';

const SQUARE = 0, SINE = 2, NOISE = 3;
const base = { oldParams: true, wave_type: SQUARE, p_env_attack: 0, p_env_sustain: 0.05, p_env_punch: 0, p_env_decay: 0.15, p_base_freq: 0.4, p_freq_limit: 0, p_freq_ramp: 0, p_freq_dramp: 0, p_vib_strength: 0, p_vib_speed: 0, p_arp_mod: 0, p_arp_speed: 0, p_duty: 0.5, p_duty_ramp: 0, p_repeat_speed: 0, p_pha_offset: 0, p_pha_ramp: 0, p_lpf_freq: 1, p_lpf_ramp: 0, p_lpf_resonance: 0, p_hpf_freq: 0, p_hpf_ramp: 0, sound_vol: 0.5, sample_rate: 44100, sample_size: 8 };

export const DESIGNS = {
  // an item lands in the bag: a soft two-note "bloop" upward
  pickup: { wave_type: SINE, p_base_freq: 0.42, p_freq_ramp: 0.1, p_env_sustain: 0.1, p_env_punch: 0.35, p_env_decay: 0.22, p_arp_mod: 0.32, p_arp_speed: 0.66, p_lpf_freq: 0.85 },
  // a crop plucked from the soil: a round, slightly woody pop that rises
  harvest: { wave_type: SQUARE, p_duty: 0.3, p_base_freq: 0.36, p_freq_ramp: 0.22, p_env_sustain: 0.07, p_env_punch: 0.55, p_env_decay: 0.22, p_lpf_freq: 0.42, p_lpf_resonance: 0.3, p_hpf_freq: 0.05 },
  // a menu button: a short wooden tick
  click: { wave_type: SQUARE, p_duty: 0.55, p_base_freq: 0.5, p_freq_ramp: -0.1, p_env_sustain: 0.03, p_env_decay: 0.1, p_lpf_freq: 0.55, p_hpf_freq: 0.12 },
  // a structure set down: a low, satisfying "thock"
  place: { wave_type: SQUARE, p_duty: 0.4, p_base_freq: 0.2, p_freq_ramp: -0.32, p_env_sustain: 0.02, p_env_punch: 0.65, p_env_decay: 0.2, p_lpf_freq: 0.32, p_lpf_resonance: 0.2 },
  // a machine finishes a batch: a little brass bell (pitched per machine by the game)
  // a coin landing in the purse (short, so a shower of them stays clean)
  coin_tick: { wave_type: SINE, p_base_freq: 0.62, p_env_sustain: 0.04, p_env_punch: 0.5, p_env_decay: 0.16, p_arp_mod: 0.45, p_arp_speed: 0.7, p_lpf_freq: 0.95 },
  machine_done: { wave_type: SINE, p_base_freq: 0.58, p_env_sustain: 0.02, p_env_punch: 0.4, p_env_decay: 0.32, p_vib_strength: 0.05, p_vib_speed: 0.6, p_lpf_freq: 0.9 },
};

const out = {};
for (const [id, d] of Object.entries(DESIGNS)) out[id] = sfxr.b58encode({ ...base, ...d });
for (const [id, s] of Object.entries(out)) console.log(`  ${id}: '${s}',`);

if (process.argv.includes('--wav')) {
  fs.mkdirSync('e2e/out/sfx', { recursive: true });
  for (const [id, d] of Object.entries(DESIGNS)) {
    const wave = sfxr.toWave({ ...base, ...d });
    const b64 = wave.dataURI.split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(`e2e/out/sfx/${id}.wav`, buf);
    const pcm = buf.subarray(44);
    let peak = 0, sum = 0;
    for (const v of pcm) { const s = (v - 128) / 128; peak = Math.max(peak, Math.abs(s)); sum += s * s; }
    console.log(`${id.padEnd(13)} ${(pcm.length / 44100 * 1000).toFixed(0).padStart(4)} ms  peak ${peak.toFixed(2)}  rms ${Math.sqrt(sum / pcm.length).toFixed(3)}`);
  }
}
