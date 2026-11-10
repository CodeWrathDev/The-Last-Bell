import { TILE } from '../config.js';
import { moveBody, hasLOS, bfs, nearestFree } from './Collision.js';
import { perceived } from './SoundBus.js';
import { COMPANION_LINES } from '../data/canon.js';

// The girl as a human companion. She follows the player's trail, stops when the player stops, freezes on danger,
// recovers if stuck, and speaks rarely. Pure logic, no Phaser.
const FOLLOW_MIN = 44, FOLLOW_MAX = 90, CATCHUP = 170, STUCK_RELOCATE = 4;
const SPEED = { walk: 70, catchup: 120 };
const TALK_GAP = 12; // seconds between lines

export class CompanionTalk {
  constructor(rng = Math.random) { this.rng = rng; this.t = TALK_GAP; this.used = {}; }
  tick(dt) { this.t += dt; }
  /** Returns a line (and starts the cooldown) or null. `force` skips the cooldown (story beats). */
  request(trigger, force = false) {
    const pool = COMPANION_LINES[trigger];
    if (!pool || (!force && this.t < TALK_GAP)) return null;
    const used = (this.used[trigger] ??= new Set());
    let fresh = pool.filter((l) => !used.has(l));
    if (!fresh.length) { if (!force && pool.length === 1) return null; used.clear(); fresh = pool; }
    const line = fresh[Math.floor(this.rng() * fresh.length)];
    used.add(line); this.t = 0;
    return line;
  }
}

export class CompanionBrain {
  constructor({ x, y, grid, rng = Math.random }) {
    this.body = { x, y, hw: 7, hh: 5 };
    this.grid = grid; this.rng = rng;
    this.trail = []; this.queue = []; this.frozen = 0; this.sitting = false;
    this.stuckT = 0; this.progressRef = { x, y, t: 0 };
    this.talk = new CompanionTalk(rng); this.events = []; this.silence = 0; this.facing = 0; this.moving = false;
    this.path = null; this.pathGoal = null; this.repathT = 0;
  }
  get x() { return this.body.x; }
  get y() { return this.body.y; }
  sit(on) { this.sitting = on; }
  freeze(seconds) { this.frozen = Math.max(this.frozen, seconds); }

  /** A sound she can hear: she startles (and may speak), but she does not lure anything. */
  react(ev) {
    if (perceived(ev, this.x, this.y, this.grid) < 0.2) return null;
    this.freeze(1.2); this.events.push('startle');
    return this.talk.request('sound');
  }

  say(trigger, force = false) { return this.talk.request(trigger, force); }

  update(dt, w) { // w = {px, py, playerMoving}
    this.events.length = 0; this.moving = false; this.talk.tick(dt);
    const b = this.body, dx = w.px - b.x, dy = w.py - b.y, dist = Math.hypot(dx, dy);
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(w.px - last.x, w.py - last.y) >= 20) { const p = { x: w.px, y: w.py }; this.trail.push(p); this.queue.push(p); if (this.trail.length > 40) this.trail.shift(); if (this.queue.length > 40) this.queue.shift(); }

    this.silence = w.playerMoving ? 0 : this.silence + dt;
    if (this.silence > 25) { this.silence = 0; const l = this.talk.request('silence'); if (l) this.events.push({ say: l }); }

    if (this.sitting) return;
    if (this.frozen > 0) { this.frozen -= dt; return; }
    // Stop when the player stops (and whenever she is already close enough).
    if (dist <= FOLLOW_MIN || (!w.playerMoving && dist <= FOLLOW_MAX)) { this.stuckT = 0; this.progressRef = { x: b.x, y: b.y, t: 0 }; return; }

    const speed = dist > CATCHUP ? SPEED.catchup : SPEED.walk;
    let tx = w.px, ty = w.py;
    if (!hasLOS(this.grid, b.x, b.y, w.px, w.py) || dist >= 40) {
      // Follow the trail: the oldest crumb that is still ahead of her, otherwise path to the player.
      while (this.queue.length && Math.hypot(this.queue[0].x - b.x, this.queue[0].y - b.y) < 10) this.queue.shift(); // reached
      const head = this.queue[0];
      const crumb = head && hasLOS(this.grid, b.x, b.y, head.x, head.y) ? head : null;
      if (crumb) { tx = crumb.x; ty = crumb.y; }
      else {
        this.repathT -= dt;
        const key = Math.floor(w.px / TILE) + ',' + Math.floor(w.py / TILE);
        if (!this.path || this.pathGoal !== key || this.repathT <= 0) {
          const g = nearestFree(this.grid, Math.floor(w.px / TILE), Math.floor(w.py / TILE));
          this.path = g ? bfs(this.grid, Math.floor(b.x / TILE), Math.floor(b.y / TILE), g.tx, g.ty) : null;
          this.pathGoal = key; this.repathT = 0.8;
        }
        if (this.path && this.path.length) {
          let n = this.path[0];
          if (Math.hypot(n.tx * TILE + 16 - b.x, n.ty * TILE + 16 - b.y) < 5) { this.path.shift(); n = this.path[0]; }
          if (n) { tx = n.tx * TILE + 16; ty = n.ty * TILE + 16; }
        }
      }
    }
    const mx = tx - b.x, my = ty - b.y, len = Math.hypot(mx, my) || 1;
    const bx = b.x, by = b.y;
    moveBody(this.grid, b, (mx / len) * speed * dt, 0);
    moveBody(this.grid, b, 0, (my / len) * speed * dt);
    this.facing = Math.atan2(my, mx); this.moving = true;

    // Stuck detection / recovery.
    this.progressRef.t += dt;
    if (Math.hypot(b.x - this.progressRef.x, b.y - this.progressRef.y) > 8) this.progressRef = { x: b.x, y: b.y, t: 0 };
    else if (this.progressRef.t > 1.5) { this.path = null; this.stuckT += this.progressRef.t; this.progressRef.t = 0; }
    if (this.stuckT >= STUCK_RELOCATE) {
      // Recovery: step to the nearest free tile next to the player's recent trail (never through the monster's rules).
      const c = this.trail[Math.max(0, this.trail.length - 3)] || { x: w.px, y: w.py };
      const f = nearestFree(this.grid, Math.floor(c.x / TILE), Math.floor(c.y / TILE));
      if (f) { b.x = f.tx * TILE + 16; b.y = f.ty * TILE + 16; this.events.push('recovered'); }
      this.stuckT = 0; this.path = null;
    }
    void bx; void by;
  }
}
