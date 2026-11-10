import { TILE } from '../config.js';
import { moveBody, hasLOS, bfs, nearestFree, angDiff } from './Collision.js';

// Pure ghost AI (no Phaser). The Ghost entity feeds it the world each frame.
export const GS = {
  IDLE: 'idle', PATROL: 'patrol', INVESTIGATE: 'investigate',
  CHASE: 'chase', SEARCH: 'search', RETURN: 'return', REPEL: 'repel',
};

const SPEED = { patrol: 46, investigate: 70, chase: 108, search: 58, return: 60, repel: 135 };
const tileOf = (v) => Math.floor(v / TILE);

export class GhostBrain {
  /**
   * @param {{x:number,y:number,patrol:{x:number,y:number}[],grid:boolean[][],rng?:()=>number}} o
   * x,y = body centre in pixels; patrol points are pixel centres.
   */
  constructor({ x, y, patrol = [], grid, rng = Math.random, speedMul = 1 }) {
    this.body = { x, y, hw: 8, hh: 8 };
    this.speed = Object.fromEntries(Object.entries(SPEED).map(([k, v]) => [k, v * speedMul]));
    this.grid = grid; this.patrol = patrol; this.rng = rng;
    this.state = GS.IDLE; this.timer = 2 + rng() * 3;
    this.patrolIdx = 0; this.path = null; this.pathGoal = null; this.repathT = 0;
    this.last = { x, y }; this.loseT = 0; this.cooldown = 0; this.litTime = 0;
    this.lit = false; this.contact = false; this.events = []; this.vx = 0; this.vy = 0;
    this.spots = []; this.spotIdx = 0; this.spotWait = 0; this.searchT = 0; this.checked = new Set();
    this.noiseTarget = null;
  }
  get x() { return this.body.x; }
  get y() { return this.body.y; }

  enter(state, timer = 0) { this.state = state; this.timer = timer; this.path = null; this.pathGoal = null; }

  /** A sound at (x,y) that carries `radius` pixels. Ignored while chasing / fleeing. */
  hear(x, y, radius) {
    if ([GS.CHASE, GS.REPEL].includes(this.state) || this.cooldown > 0) return false;
    if (Math.hypot(x - this.x, y - this.y) > radius) return false;
    this.noiseTarget = { x, y };
    this.enter(GS.INVESTIGATE, 0);
    this.events.push('hear');
    return true;
  }

  /** Force the ghost to flee for a few seconds (flashlight, or after landing a hit). */
  repel(seconds = 3.5, cooldown = 7) { this.enter(GS.REPEL, seconds); this.cooldown = cooldown; this.litTime = 0; }

  follow(tx, ty, speed, dt) {
    const b = this.body;
    const d = Math.hypot(tx - b.x, ty - b.y);
    if (d < 6) return true;
    let wx = tx, wy = ty;
    const direct = d < 40;
    if (!direct) {
      this.repathT -= dt;
      const goalKey = tileOf(tx) + ',' + tileOf(ty);
      if (!this.path || this.pathGoal !== goalKey || this.repathT <= 0) {
        const g = nearestFree(this.grid, tileOf(tx), tileOf(ty));
        this.path = g ? bfs(this.grid, tileOf(b.x), tileOf(b.y), g.tx, g.ty) : null;
        this.pathGoal = goalKey; this.repathT = 0.6;
      }
      if (this.path && this.path.length) {
        let n = this.path[0];
        if (Math.hypot(n.tx * TILE + 16 - b.x, n.ty * TILE + 16 - b.y) < 5) { this.path.shift(); n = this.path[0]; }
        if (n) { wx = n.tx * TILE + 16; wy = n.ty * TILE + 16; }
      }
    }
    const dx = wx - b.x, dy = wy - b.y, len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * speed; this.vy = (dy / len) * speed;
    moveBody(this.grid, b, this.vx * dt, 0);
    moveBody(this.grid, b, 0, this.vy * dt);
    return false;
  }

  nearestPatrol() {
    let best = 0, bd = 1e9;
    this.patrol.forEach((p, i) => { const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /**
   * @param {number} dt seconds
   * @param {{px:number,py:number,hidden:boolean,hideTile:{tx:number,ty:number}|null,hideSpots:{tx:number,ty:number,x:number,y:number}[],
   *          flashOn:boolean,flashAngle:number,flashRange:number}} w
   */
  update(dt, w) {
    this.events.length = 0; this.contact = false; this.vx = 0; this.vy = 0;
    if (this.cooldown > 0) this.cooldown -= dt;
    const b = this.body, dx = w.px - b.x, dy = w.py - b.y, dist = Math.hypot(dx, dy);
    const los = dist < 420 && hasLOS(this.grid, b.x, b.y, w.px, w.py);

    // Flashlight: lit when the player's cone points at the ghost with a clear line.
    this.lit = false;
    if (w.flashOn && !w.hidden && los && dist < w.flashRange) {
      if (Math.abs(angDiff(Math.atan2(b.y - w.py, b.x - w.px), w.flashAngle)) < 0.42) this.lit = true;
    }
    this.litTime = this.lit ? this.litTime + dt : Math.max(0, this.litTime - dt * 0.6);
    if (this.litTime > 2.2 && this.state !== GS.REPEL) { this.repel(); this.events.push('repel'); }

    // Senses: the player's light draws attention from further away.
    const sightR = w.flashOn ? 270 : 170;
    const sees = !w.hidden && los && dist < sightR;
    if (sees) this.last = { x: w.px, y: w.py };
    if (sees && this.cooldown <= 0 && this.state !== GS.CHASE && this.state !== GS.REPEL) { this.enter(GS.CHASE); this.loseT = 0; this.events.push('spot'); }

    // Touching the player.
    if (!w.hidden && dist < 22 && this.state !== GS.REPEL && this.cooldown <= 0) this.contact = true;

    switch (this.state) {
      case GS.IDLE:
        this.timer -= dt;
        if (this.timer <= 0) this.enter(this.patrol.length ? GS.PATROL : GS.IDLE, 3);
        break;

      case GS.PATROL: {
        const p = this.patrol[this.patrolIdx];
        if (!p) { this.enter(GS.IDLE, 3); break; }
        if (this.timer > 0) { this.timer -= dt; break; }
        if (this.follow(p.x, p.y, this.speed.patrol, dt)) {
          let n = this.patrolIdx;
          if (this.patrol.length > 1) while (n === this.patrolIdx) n = Math.floor(this.rng() * this.patrol.length);
          this.patrolIdx = n; this.timer = 1.5 + this.rng() * 2;
        }
        break;
      }

      case GS.INVESTIGATE: {
        const t = this.noiseTarget;
        if (!t) { this.enter(GS.RETURN); break; }
        if (this.follow(t.x, t.y, this.speed.investigate, dt)) {
          this.timer += dt;
          if (this.timer > 1.6) { this.last = t; this.beginSearch(5); }
        }
        break;
      }

      case GS.CHASE:
        if (sees) {
          this.loseT = 0;
          const slow = this.lit ? 0.55 : 1;
          this.follow(w.px, w.py, this.speed.chase * slow, dt);
        } else {
          this.loseT += dt;
          this.follow(this.last.x, this.last.y, this.speed.chase * 0.9, dt);
          if (this.loseT > 1.4) { this.events.push('lost'); this.beginSearch(10); }
        }
        break;

      case GS.SEARCH: {
        this.searchT -= dt;
        const s = this.spots[this.spotIdx];
        if (!s) {
          // Nothing left to check: sweep around the last known position.
          if (this.follow(this.last.x, this.last.y, this.speed.search, dt)) this.searchT -= dt * 2;
        } else if (this.follow(s.x, s.y, this.speed.search, dt) || Math.hypot(s.x - b.x, s.y - b.y) < 26) {
          this.spotWait += dt;
          if (this.spotWait > 1.6) {
            const k = s.tx + ',' + s.ty;
            if (w.hidden && w.hideTile && w.hideTile.tx === s.tx && w.hideTile.ty === s.ty && !this.checked.has(k)) {
              // 50% chance each distinct hiding place check actually finds you.
              this.checked.add(k);
              if (this.rng() < 0.5) { this.events.push('found'); this.enter(GS.CHASE); break; }
            }
            this.spotIdx++; this.spotWait = 0;
          }
        }
        if (this.searchT <= 0) { this.events.push('gave_up'); this.enter(GS.RETURN); }
        break;
      }

      case GS.RETURN: {
        const p = this.patrol[this.nearestPatrol()];
        if (!p) { this.enter(GS.IDLE, 4); break; }
        if (this.follow(p.x, p.y, this.speed.return, dt)) { this.patrolIdx = this.nearestPatrol(); this.enter(GS.PATROL, 1.5); }
        break;
      }

      case GS.REPEL: {
        // Flee to the patrol point furthest from the player.
        let far = this.patrol[0], fd = -1;
        for (const p of this.patrol) { const d = Math.hypot(p.x - w.px, p.y - w.py); if (d > fd) { fd = d; far = p; } }
        if (far) this.follow(far.x, far.y, this.speed.repel, dt);
        this.timer -= dt;
        if (this.timer <= 0) this.enter(GS.RETURN);
        break;
      }
    }
  }

  beginSearch(seconds) {
    const near = (w) => Math.hypot(w.x - this.last.x, w.y - this.last.y);
    this.spots = (this._spots || []).filter((s) => near(s) < 9 * TILE).sort((a, b) => near(a) - near(b));
    this.spotIdx = 0; this.spotWait = 0; this.searchT = seconds; this.checked = new Set();
    this.enter(GS.SEARCH);
    this.searchT = seconds;
  }

  setHideSpots(spots) { this._spots = spots; }
}
