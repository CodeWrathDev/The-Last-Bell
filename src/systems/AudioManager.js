import { ORDER } from './ChapterState.js';

// Audio logic layer for THE LAST BELL: volume channels, surface footsteps, spatial gain/pan, event cooldowns and
// the adaptive music director. It talks to a `backend` ({ setLayer(name, gain), oneShot(name, {gain, pan, rate}) }),
// so it is unit-testable in Node. NOTE: no production audio assets exist yet; backends use synthesised PLACEHOLDERS.

export const CHANNELS = ['master', 'music', 'sfx', 'ambient', 'voice'];
export class Mixer {
  constructor(v = {}) { this.v = { master: 1, music: 0.7, sfx: 0.9, ambient: 0.8, voice: 1, ...v }; }
  set(ch, x) { if (!CHANNELS.includes(ch)) throw new Error('bad channel ' + ch); this.v[ch] = Math.max(0, Math.min(1, x)); }
  gain(ch) { return ch === 'master' ? this.v.master : this.v.master * this.v[ch]; }
}

export const SURFACES = ['concrete', 'tile', 'wood'];
/** Sound name for a footstep, or null when the player is not actually moving. */
export function footstepName(surface, mode, moving) {
  if (!moving) return null;
  if (!SURFACES.includes(surface)) surface = 'concrete';
  const m = mode === 'run' ? 'run' : mode === 'crouch' ? 'crouch' : 'walk';
  return m === 'crouch' ? 'step_crouch' : `step_${m}_${surface}`;
}
export const FOOTSTEP_GAIN = { crouch: 0.12, walk: 0.3, run: 0.6 }; // running is always louder

/** Distance attenuation + left/right pan relative to the listener's facing (radians). */
export function spatial(listener, src, maxDist = 400) {
  const dx = src.x - listener.x, dy = src.y - listener.y, d = Math.hypot(dx, dy);
  const gain = d >= maxDist ? 0 : Math.pow(1 - d / maxDist, 2);
  const rel = Math.atan2(dy, dx) - (listener.facing ?? 0);
  return { gain, pan: d < 1 ? 0 : Math.max(-1, Math.min(1, Math.sin(rel))), distance: d };
}

export class EventScheduler {
  constructor(rng = Math.random) { this.rng = rng; this.next = {}; }
  /** True (and arms the cooldown) if `key` may fire at `now`. Cooldown is min..max seconds, randomised. */
  tryFire(key, now, min, max) {
    if (now < (this.next[key] ?? 0)) return false;
    this.next[key] = now + min + this.rng() * (max - min);
    return true;
  }
}

// Music states from the design doc (1 normal ... 7 ending). Only one is the target; at most two layers sound at once.
export const MUSIC = { 1: 'music_normal', 2: 'music_night', 3: 'music_nearby', 4: 'music_chase', 5: 'music_reunion', 6: 'music_reveal', 7: 'music_ending' };
export class MusicDirector {
  constructor(fadeSeconds = 2) { this.fade = fadeSeconds; this.target = 1; this.prev = null; this.w = { 1: 1 }; }

  /** ctx: {chapter, finalStep, monsterActive, monsterState, monsterDist} */
  pick(ctx) {
    if (ctx.chapter === 'ending') return 7;
    if (ctx.chapter === 'final') return 6;
    if (ctx.monsterActive && ctx.monsterState === 'chase') return 4;
    if (ctx.monsterActive && ctx.monsterDist < 256) return 3;
    if (ctx.chapter === 'ch5') return 5;
    if (ORDER.indexOf(ctx.chapter) === 0) return 1;
    return 2;
  }
  update(dt, ctx) {
    const t = this.pick(ctx);
    if (t !== this.target) { this.prev = this.target; this.target = t; if (this.w[t] === undefined) this.w[t] = 0; }
    const step = dt / this.fade;
    for (const k of Object.keys(this.w)) {
      const key = Number(k);
      this.w[k] = key === this.target ? Math.min(1, this.w[k] + step) : Math.max(0, this.w[k] - step);
      if (this.w[k] === 0 && key !== this.target) delete this.w[k];
    }
    return this.w;
  }
}

export class AudioManager {
  constructor(backend, rng = Math.random) {
    this.backend = backend; this.mixer = new Mixer(); this.music = new MusicDirector(); this.sched = new EventScheduler(rng);
    this.now = 0; this.silentT = 0; this.ramp = 1; this.listener = { x: 0, y: 0, facing: 0 };
  }
  setListener(x, y, facing) { this.listener = { x, y, facing }; }
  footstep(surface, mode, moving) {
    const name = footstepName(surface, mode, moving);
    if (!name) return null;
    this.backend.oneShot(name, { gain: FOOTSTEP_GAIN[mode === 'run' ? 'run' : mode === 'crouch' ? 'crouch' : 'walk'] * this.mixer.gain('sfx'), pan: 0, rate: 0.95 + Math.random() * 0.1 });
    return name;
  }
  /** Positional one-shot (monster crawl, distant bell, voice from far away...). */
  at(name, src, { channel = 'sfx', maxDist = 400 } = {}) {
    const s = spatial(this.listener, src, maxDist);
    if (s.gain <= 0) return false;
    this.backend.oneShot(name, { gain: s.gain * this.mixer.gain(channel), pan: s.pan, rate: 1 });
    return true;
  }
  /** Horror one-shots with randomised cooldowns so silence can build tension. */
  horrorEvent(name, min = 20, max = 45) {
    if (!this.sched.tryFire(name, this.now, min, max)) return false;
    this.backend.oneShot(name, { gain: this.mixer.gain('ambient'), pan: 0, rate: 1 });
    return true;
  }
  /** The music cuts out at once for `seconds`, then returns gently (used when something suddenly appears). */
  silence(seconds) { this.silentT = Math.max(this.silentT, seconds); this.ramp = 0; }
  update(dt, ctx) {
    this.now += dt;
    if (this.silentT > 0) this.silentT -= dt; else this.ramp = Math.min(1, this.ramp + dt / 2.5);
    const duck = this.silentT > 0 ? 0 : this.ramp;
    const w = this.music.update(dt, ctx);
    const live = new Set();
    for (const [k, v] of Object.entries(w)) { live.add(k); this.backend.setLayer(MUSIC[k], v * duck * this.mixer.gain('music')); }
    for (const k of this.active || []) if (!live.has(k)) this.backend.setLayer(MUSIC[k], 0); // fully faded layers are silenced
    this.active = live;
  }
}
