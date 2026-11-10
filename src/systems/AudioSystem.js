import { Howl, Howler } from 'howler';
import { Settings } from './Settings.js';

// All sound is synthesised at runtime (no audio files), then played through Howler.js.
const SR = 22050;
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const nz = () => rnd() * 2 - 1;
const TAU = Math.PI * 2;
const mk = (secs, fn) => {
  const n = (secs * SR) | 0, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i / SR, i, n);
  return a;
};

const GENS = {
  rain: () => { let a = 0, b = 0; return mk(4, () => { a += (nz() - a) * 0.35; b += (a - b) * 0.5; return (a - b) * 0.8 + (rnd() < 0.002 ? nz() * 0.25 : 0); }); },
  hum: () => mk(2, (t) => Math.sin(TAU * 100 * t) * 0.1 + Math.sin(TAU * 200 * t) * 0.05 + Math.sin(TAU * 300 * t) * 0.02),
  step: () => { let lp = 0; return mk(0.14, (t) => { lp += (nz() - lp) * 0.18; return lp * Math.exp(-t * 32) * 1.3; }); },
  creak: () => { let ph = 0; return mk(1.1, (t) => { ph += (TAU * (140 + 60 * Math.sin(t * 9) + t * 70)) / SR; const env = Math.sin(Math.PI * Math.min(1, t / 1.1)); return ((ph % TAU) / Math.PI - 1) * 0.25 * env * (0.6 + 0.4 * Math.sin(t * 37)); }); },
  bell: () => mk(3.2, (t) => { let s = 0; [1, 2, 2.76, 5.4, 8.9].forEach((m, i) => { s += Math.sin(TAU * 520 * m * t) * Math.exp(-t * (1.1 + i * 0.7)) / (i + 1); }); return s * 0.35; }),
  whisper: () => { let lp = 0; return mk(1.8, (t) => { const x = nz(); lp += (x - lp) * 0.25; const env = Math.pow(Math.sin(Math.PI * t / 1.8), 2) * (0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7.3)); return (x - lp) * 0.35 * env; }); },
  thunder: () => { let lp = 0; return mk(3, (t) => { lp += (nz() - lp) * 0.03; return Math.max(-1, Math.min(1, lp * 7 * (1 - Math.exp(-t * 15)) * Math.exp(-t * 1.1))); }); },
  pickup: () => mk(0.3, (t) => Math.sin(TAU * (t < 0.1 ? 880 : 1320) * t) * Math.exp(-t * 9) * 0.4),
  click: () => mk(0.05, (t) => (Math.sin(TAU * 1500 * t) > 0 ? 1 : -1) * Math.exp(-t * 90) * 0.25),
  unlock: () => mk(0.4, (t) => (Math.sin(TAU * 2000 * t) * Math.exp(-((t % 0.18) * 60)) * (t < 0.36 ? 1 : 0)) * 0.35),
  door: () => { let lp = 0; return mk(0.5, (t) => { lp += (nz() - lp) * 0.2; return (Math.sin(TAU * 70 * t) * 0.6 + lp * 0.6) * Math.exp(-t * 9); }); },
  hurt: () => { let lp = 0; return mk(0.5, (t) => { lp += (nz() - lp) * 0.3; return (Math.sin(TAU * (220 - 280 * t) * t) * 0.5 + lp * 0.5) * Math.exp(-t * 6); }); },
  scare: () => mk(1.2, (t) => { const e = Math.exp(-t * 3) * Math.min(1, t * 80); return (nz() * 0.4 + Math.sin(TAU * 233 * t) * 0.3 + Math.sin(TAU * 247 * t) * 0.3) * e; }),
  // ---- THE LAST BELL placeholder sound set (all synthesised; replace with licensed/recorded audio) ----
  ...(() => {
    const out = {};
    const lp = (k) => { let y = 0; return (x) => (y += (x - y) * k); };
    // footsteps by surface: concrete = gritty scuff, tile = sharp tick + ring, wood = low hollow thump
    const surf = {
      concrete: (t, f) => f(nz()) * Math.exp(-t * 34) * 1.2,
      tile: (t, f) => (f(nz()) * 0.7 + Math.sin(TAU * 1900 * t) * 0.3) * Math.exp(-t * 55) * 1.1,
      wood: (t, f) => (Math.sin(TAU * 110 * t) * 0.7 + f(nz()) * 0.4) * Math.exp(-t * 22) * 1.2,
    };
    const cut = { concrete: 0.2, tile: 0.5, wood: 0.12 };
    for (const sname of Object.keys(surf)) {
      for (const mode of ['walk', 'run']) out[`step_${mode}_${sname}`] = () => { const f = lp(cut[sname] * (mode === 'run' ? 1.4 : 1)); return mk(mode === 'run' ? 0.12 : 0.15, (t) => surf[sname](t, f)); };
      out[`crawl_${sname}`] = () => { const f = lp(0.08), g = lp(0.4); return mk(0.9, (t) => { const drag = (f(nz()) * 1.6) * (0.4 + 0.6 * Math.abs(Math.sin(t * 9))); const slap = sname === 'tile' ? g(nz()) * Math.exp(-((t % 0.3) * 40)) * 0.6 : 0; return (drag + slap) * 0.5 * Math.sin(Math.PI * Math.min(1, t / 0.9)); }); };
    }
    out.step_crouch = () => { const f = lp(0.08); return mk(0.18, (t) => f(nz()) * Math.exp(-t * 28) * 0.5); };
    out.door_slam = () => { const f = lp(0.12); return mk(0.9, (t) => (Math.sin(TAU * 55 * t) * 0.8 + f(nz()) * 0.9) * Math.exp(-t * 6)); };
    out.drop = () => { const f = lp(0.3); return mk(0.6, (t) => (Math.sin(TAU * 140 * t) * 0.5 + f(nz()) * 0.6) * Math.exp(-t * 11) + (rnd() < 0.01 ? nz() * 0.3 * Math.exp(-t * 4) : 0)); };
    out.chair_move = () => { const f = lp(0.2); return mk(0.8, (t) => f(nz()) * 0.5 * Math.sin(Math.PI * t / 0.8) * (0.5 + 0.5 * Math.sin(t * 60))); };
    out.fan_stop = () => mk(1.6, (t) => Math.sin(TAU * (140 * Math.exp(-t * 1.6)) * t) * 0.18 * Math.exp(-t * 1.2));
    out.breath = () => { const f = lp(0.35); return mk(2.2, (t) => { const ph = Math.sin(TAU * t / 1.1 + Math.sin(t * 2.3)); const env = Math.pow(Math.max(0, ph), 2); return (nz() - f(nz())) * 0.35 * env; }); };
    out.breath_close = () => { const f = lp(0.3); return mk(1.6, (t) => { const ph = Math.sin(TAU * t / 0.8); return (nz() - f(nz())) * 0.55 * Math.pow(Math.max(0, ph), 2) + Math.sin(TAU * 90 * t) * 0.05; }); };
    out.heartbeat = () => mk(1, (t) => (Math.sin(TAU * 58 * t) * Math.exp(-((t % 1) * 22)) + 0.7 * Math.sin(TAU * 50 * t) * Math.exp(-(((t + 0.7) % 1) * 22))) * 0.7);
    out.girl_call = () => { const f = lp(0.25); return mk(2.2, (t) => (Math.sin(TAU * (330 + 40 * Math.sin(t * 3)) * t) * 0.25 + (nz() - f(nz())) * 0.1) * Math.pow(Math.sin(Math.PI * t / 2.2), 2)); }; // PLACEHOLDER for a Burmese voice line
    out.fan = () => mk(1, (t) => Math.sin(TAU * 38 * t) * 0.08 + Math.sin(TAU * 76 * t) * 0.04);
    // ---- adaptive music layers (placeholders) ----
    const piano = (freq, t, amp = 0.2) => (Math.sin(TAU * freq * t) + 0.5 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t * 2) + 0.25 * Math.sin(TAU * freq * 3 * t)) * Math.exp(-t * 1.6) * amp;
    const song = (notes, len, step, amp) => mk(len, (t) => { let s = 0; for (let k = 0; k < notes.length; k++) { const t0 = k * step; if (t >= t0) s += piano(notes[k], t - t0, amp); } return s; });
    // ---- SCARY music: a detuned, sagging music box that plays the WRONG notes (minor seconds, tritones), over beating low drones, wind
    // and a thin high whine. Every note tail wraps around the loop end and every drone is a whole number of cycles per loop: seamless loops.
    const creep = (L, notes, o = {}) => {
      const { drone = [55, 55.5], droneAmp = 0.12, boxAmp = 0.2, whine = 0, thump = 0, wind = 0.06, sag = 0.015 } = o;
      const fix = (f) => Math.round(f * L) / L, d = drone.map(fix), w = lp(0.05), wh = fix(whine || 1);
      return mk(L, (t) => {
        let s = 0;
        const sw = 0.65 + 0.35 * Math.sin(TAU * 2 * t / L);                       // the drone slowly swells and sinks
        for (let i = 0; i < d.length; i++) s += Math.sin(TAU * d[i] * t) * droneAmp * sw;
        for (let k = 0; k < notes.length; k++) {                                   // the music box, with two cold echoes
          if (((t - notes[k][0]) % L + L) % L > 4.5) continue;                      // (this note has long since died away)
          for (let e = 0; e < 3; e++) {
          const age = ((t - notes[k][0] - e * 0.47) % L + L) % L;
          if (age > 3.5) continue;
          const f = notes[k][1] * (1 - sag * Math.min(age, 1.5)), env = Math.exp(-age * 2.4) * (e === 0 ? 1 : e === 1 ? 0.45 : 0.2);
          s += (Math.sin(TAU * f * age) + 0.35 * Math.sin(TAU * f * 2.76 * age) * Math.exp(-age * 6)) * env * boxAmp;
          }
        }
        s += w(nz()) * wind * (0.5 + 0.5 * Math.sin(TAU * 3 * t / L));              // wind through the corridors
        if (whine) s += Math.sin(TAU * wh * t) * 0.012 * (0.5 + 0.5 * Math.sin(TAU * 5 * t / L));
        if (thump) { const a = t % thump, b = ((t - 0.28) % thump + thump) % thump; s += Math.sin(TAU * 46 * a) * Math.exp(-a * 9) * 0.32 + Math.sin(TAU * 42 * b) * Math.exp(-b * 9) * 0.2; }
        return Math.tanh(s * 1.2) * 0.8;
      });
    };
    out.music_normal = () => creep(16, [[0, 587.3], [1.5, 698.5], [3, 659.3], [4.5, 587.3], [6, 523.3], [8, 587.3], [9.5, 698.5], [11, 622.3], [12.5, 554.4], [14, 523.3]], { drone: [73.4, 73.9], droneAmp: 0.08, boxAmp: 0.22, wind: 0.04 });
    out.music_night = () => creep(16, [[0.5, 659.3], [2, 698.5], [3.5, 622.3], [6, 466.2], [8.5, 659.3], [10, 622.3], [11, 587.3], [12.5, 466.2], [14, 440]], { drone: [55, 55.5, 77.8], droneAmp: 0.11, boxAmp: 0.2, whine: 1760, wind: 0.08 });
    out.music_nearby = () => creep(6, [[0.4, 698.5], [2.4, 659.3], [4.1, 466.2]], { drone: [48, 51, 72.5], droneAmp: 0.16, boxAmp: 0.1, whine: 2094, thump: 1.2, wind: 0.1, sag: 0.03 });
    out.music_reunion = () => creep(16, [[0, 440], [2, 523.3], [4, 493.9], [6, 392], [8, 440], [10, 523.3], [12, 587.3], [14, 493.9]], { drone: [55, 82.5], droneAmp: 0.1, boxAmp: 0.22, wind: 0.04 });
    out.music_chase = () => { const f = lp(0.1), L = 2.8; return mk(L, (t) => {
      const a = t % 0.35, env = Math.pow(Math.sin(Math.PI * t / L), 2);
      let s = Math.sin(TAU * 58 * a) * Math.exp(-a * 13) * 0.7 + f(nz()) * 0.14;                               // driving sub-pulse
      s += Math.sin(TAU * (380 * t + 260 * t * t / L) + 3 * Math.sin(TAU * 7 * t)) * 0.08 * env;               // a screeching, rising siren
      s += (Math.sin(TAU * 110 * t) + Math.sin(TAU * 155.6 * t)) * 0.05 * ((t % 0.7) < 0.12 ? 1 : 0.2);        // tritone stabs
      return Math.tanh(s * 1.4) * 0.8;
    }); };
    out.music_reveal = () => mk(4, (t) => Math.sin(TAU * 520 * t) * 0.012 * Math.exp(-t * 0.4));
    out.music_ending = () => song([110, 130.8, 98, 123.5, 87.3, 110], 12, 2, 0.2);
    return out;
  })(),
};

function toDataUri(f32) {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}

// Recorded monster sounds (public/assets/audio/monster). Relative URLs work because vite `base` is './'.
const mon = (f) => `assets/audio/monster/${f}.mp3`;
const dr = (f) => `assets/audio/doors/${f}.mp3`;
export const FILES = {
  door: dr('creaky_old_door'),         // a door creaks open (recorded; replaces the synth thump)
  door_slam: dr('door_slam'),          // a door slams shut (recorded)
  mon_grunts: mon('ghostly_grunts'),   // ghostly grunts: it is somewhere near
  mon_growl: mon('growl_gulp'),        // wet growl / gulp: it noticed something
  mon_roar: mon('roar_long'),          // long roar that ends: it SAW you, the chase begins
  mon_roar_eye: mon('roar_eye'),       // short sustained roar: it heard a noise and is rushing at you
  mon_knock: mon('glass_knock'),       // slow knocking: it is searching right next to you
  mon_jaws: mon('jaws_open'),          // jaws creaking open: it arrives / stops to listen
};

const MUTE_KEY = 'kyaungnya-muted';
// v36: monster sounds were too loud. One multiplier per sound family (roars hit hardest; still clearly audible, not too quiet).
export const MONSTER_GAIN = { mon_roar: 0.22, mon_roar_eye: 0.22, mon_growl: 0.6, mon_grunts: 0.6, mon_knock: 0.65, mon_jaws: 0.6, breath: 0.7, breath_close: 0.7, scare: 0.5 };
const monsterGain = (name) => MONSTER_GAIN[name] ?? (name.startsWith('crawl_') ? 0.7 : 1);

class AudioSystem {
  constructor() {
    this.howls = {}; this.loops = {}; this.broken = false;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
  }

  init() { try { Howler.mute(this.muted); } catch { this.broken = true; } }

  get(name, loop = false) {
    if (this.howls[name]) return this.howls[name];
    try {
      this.howls[name] = FILES[name]
        ? new Howl({ src: [FILES[name]], format: ['mp3'], loop, volume: 1, preload: true })
        : new Howl({ src: [toDataUri(GENS[name]())], format: ['wav'], loop, volume: 1 });
    } catch (e) { this.broken = true; return null; }
    return this.howls[name];
  }

  /** Channel gain (master x channel) from the saved settings. */
  gain(ch = 'sfx') { return ch === 'master' ? Settings.get('master') : Settings.get('master') * (Settings.get(ch) ?? 1); }

  play(name, volume = 1, rate = 1, { pan = 0, ch = 'sfx' } = {}) {
    if (this.broken || !(GENS[name] || FILES[name])) return null;
    const h = this.get(name);
    if (!h) return null;
    const id = h.play();
    h.volume(Math.max(0, Math.min(1, volume * monsterGain(name) * this.gain(ch))), id); h.rate(rate, id);
    if (pan) { try { h.stereo(Math.max(-1, Math.min(1, pan)), id); } catch { /* stereo unsupported */ } }
    if (FILES[name]) (this.fileIds ||= {})[name] = id;
    return id;
  }

  /** Fade out and stop the most recent play of a recorded sound (e.g. cut the long roar when the chase ends). */
  fadeOut(name, ms = 600) {
    const h = this.howls[name], id = this.fileIds?.[name];
    if (!h || id === undefined) return;
    try { h.fade(h.volume(id), 0, ms, id); setTimeout(() => { try { h.stop(id); } catch { /* ignore */ } }, ms + 30); } catch { /* ignore */ }
  }
  isPlaying(name) { const h = this.howls[name], id = this.fileIds?.[name]; try { return !!(h && id !== undefined && h.playing(id)); } catch { return false; } }

  /** Start loading the recorded sounds so the first monster appearance does not stutter. */
  preload() { if (!this.broken) for (const n of Object.keys(FILES)) this.get(n); }

  /** Looping ambience; volume 0 stops it audibly (fades). */
  loop(name, volume, fadeMs = 900, ch = 'ambient') {
    if (this.broken || !GENS[name]) return;
    if (volume <= 0 && !this.loops[name]) return;
    const h = this.get(name, true);
    if (!h) return;
    let L = this.loops[name];
    if (!L) { L = this.loops[name] = { id: h.play(), vol: 0, ch }; h.volume(0, L.id); }
    const target = volume * this.gain(ch);
    h.fade(L.vol, target, fadeMs, L.id); L.vol = target; L.ch = ch; L.raw = volume;
  }

  /** Re-apply the volume sliders to every running loop (call after changing a setting). */
  refreshVolumes() { for (const [name, L] of Object.entries(this.loops)) { const t = (L.raw ?? 0) * this.gain(L.ch); try { this.howls[name].volume(t, L.id); } catch { /* ignore */ } L.vol = t; } }

  stopAll() {
    for (const [name, L] of Object.entries(this.loops)) { try { this.howls[name].stop(L.id); } catch { /* ignore */ } }
    this.loops = {};
    for (const n of Object.keys(FILES)) { try { this.howls[n]?.stop(); } catch { /* ignore */ } }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    try { Howler.mute(this.muted); } catch { /* ignore */ }
    return this.muted;
  }
}

export const audio = new AudioSystem();
