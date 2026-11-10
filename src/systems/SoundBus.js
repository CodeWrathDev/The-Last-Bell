import { hasLOS } from './Collision.js';

// Every noise the player (or a thrown object) makes becomes an event. Monsters subscribe and decide for themselves.
// radius is in pixels (TILE = 32). loudness 0..1.
export const SOUND = {
  // Footsteps carry far enough for the stalker to react across a room or corridor.
  crouch:    { loudness: 0.18, radius: 90,  duration: 0.4 },
  walk:      { loudness: 0.5,  radius: 190, duration: 0.55 },
  run:       { loudness: 0.9,  radius: 420, duration: 0.7 },
  flashlight:{ loudness: 0.25, radius: 60,  duration: 0.2 },
  pickup:    { loudness: 0.35, radius: 80,  duration: 0.3 },
  door:      { loudness: 0.6,  radius: 250, duration: 0.7 },
  door_slam: { loudness: 0.95, radius: 480, duration: 1.2 },
  throw:     { loudness: 0.7,  radius: 280, duration: 0.8 }, // used to distract: emitted where the object lands
  drop:      { loudness: 0.9,  radius: 420, duration: 1.0 },
  break:     { loudness: 1.0,  radius: 560, duration: 1.4 },
  voice:     { loudness: 0.75, radius: 500, duration: 1.0 }, // optional microphone noise (MicInput)
};

export const WALL_FACTOR = 0.5; // sound with no clear line to the listener carries half as far

/** Loudness (0..1) as perceived at (lx, ly); 0 if inaudible. */
export function perceived(ev, lx, ly, grid = null) {
  const d = Math.hypot(ev.x - lx, ev.y - ly);
  let r = ev.radius;
  if (grid && !hasLOS(grid, ev.x, ev.y, lx, ly)) r *= WALL_FACTOR;
  if (d >= r) return 0;
  return ev.loudness * (1 - d / r);
}

export class SoundBus {
  constructor() { this.now = 0; this.listeners = []; this.recent = []; this.nextId = 1; }
  subscribe(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  tick(dt) { this.now += dt; this.recent = this.recent.filter((e) => this.now - e.t < e.duration); }
  /** Emit a sound. `type` is a key of SOUND; `over` can override loudness/radius/duration. */
  emit(type, x, y, over = {}) {
    const base = SOUND[type];
    if (!base) throw new Error('Unknown sound type: ' + type);
    const ev = { id: this.nextId++, type, x, y, ...base, ...over, t: this.now };
    this.recent.push(ev);
    for (const fn of this.listeners) fn(ev);
    return ev;
  }
}
