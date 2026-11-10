import { TILE } from '../config.js';
import { moveBody, bfs, nearestFree } from './Collision.js';
import { perceived } from './SoundBus.js';

// THE crawling creature (the girl's other form). Pure logic, no Phaser.
//
// IT IS BLIND. It has no eyes that work: no sight, no line of sight, no flashlight detection. It knows about the player
// ONLY through sound events it actually hears (SoundBus). The rules are:
//   * crawling around (PATROL): it creeps along its route, now and then freezing to listen;
//   * it hears a noise  -> it charges at where the noise came from (CHASE);
//   * the noise keeps coming (you keep walking / running / slamming doors) -> it keeps chasing, heading for the newest noise;
//   * the noise STOPS (you stand still, crouch, hide) -> after a very short moment it stops dead (LISTEN), head up,
//     then goes back to crawling around. It never remembers where you are.
//   * it can still BUMP into you: if it touches you (even while only crawling around) it grabs you.
//
// v33 "REAL HORROR" BEHAVIOUR (still blind, still sound-driven, but it no longer feels like a vending machine):
//   * CREEP   - a quiet / far noise does not make it charge. It creeps toward the noise slowly and silently (no roar), so you never know it is coming.
//   * LUNGE   - when it gets close to a loud noise it bursts forward faster than it ever walks (still slower than your sprint).
//   * SEARCH  - after it loses you it does NOT go away. It stays and searches the area around the last noise (3-4 spots), sniffing.
//               If you are hiding and it sniffs right next to your hiding spot, you hear/feel it ('sniff_close'). It never gives up at once.
//   * PROWL   - the director: when it picks where to patrol next it often picks the spot nearest to YOU, so it keeps drifting into your area.
//   * AGGRO   - it learns: every chase makes it a little sharper (hears farther, remembers the noise longer). It calms down slowly with time.
//   * It slowly turns its head toward you while listening (it "senses" you) - but it still never knows where you are.
export const MS = {
  PATROL: 'patrol', CHASE: 'chase', LISTEN: 'listen', SEARCH: 'search', RETURN_TO_PATROL: 'return_to_patrol',
};
export const SPEED = { patrol: 54, chase: 146, ret: 68, hunt: 164, creep: 76, lunge: 162, search: 66 };
// FINAL CHAPTER: once the girl has turned, the creature is no longer blind. It SEES you and never stops (hunt 128 > walk 95, < run 165,
// so sprinting buys you a few seconds, but stamina runs out and there is nowhere to go).
export const HEARING = 1.55;
export const SOUND_MEMORY = 1.6;
export const LISTEN_TIME = 4.2;
export const SEARCH_TIME = 11;   // seconds it searches around the last noise before it gives up and goes back to patrol
export const LOUD = 0.2;         // softer sounds now make it charge instead of merely creeping
export const LUNGE_DIST = 5 * TILE;  // seconds it stands frozen and listening after the noise stops
const tileOf = (v) => Math.floor(v / TILE);

export class MonsterBrain {
  constructor({ x, y, patrol = [], grid, rng = Math.random }) {
    this.body = { x, y, hw: 9, hh: 9 };   // about twice the player body (12x8) in width
    this.grid = grid; this.patrol = patrol; this.rng = rng;
    this.state = MS.PATROL; this.timer = 1; this.patrolIdx = 0;
    this.path = null; this.pathGoal = null; this.repathT = 0;
    this.heard = null;                              // the last sound it accepted: { x, y, id }
    this.last = null;                               // where that sound SEEMED to come from (a noisy estimate, not the player)
    this.hearT = 0;                                 // seconds left until the noise it is chasing counts as "stopped"
    this.listenCooldown = 6 + rng() * 6;
    this.facing = 0; this.events = []; this.contact = false; this.vx = 0; this.vy = 0;
    this.stunT = 0; this.hunting = false; this.charging = 0;
    this.cautious = false;                          // true while it is only CREEPing toward a quiet noise
    this.aggro = 0;                                 // 0..1: gets sharper with every chase, calms down with time
    this.searchT = 0; this.searchPts = []; this.searchWait = 0; this.sniffT = 3; this.lunged = false; this.lungeT = 0;
  }
  /** After a phantom scare: for `seconds` it knows exactly where the player is and runs straight at them (hiding still saves you). */
  charge(seconds = 3) { this.stunT = 0; this.charging = seconds; this.path = null; this.hearT = 0.5; this.enter(MS.CHASE); this.events.push('rush'); }
  /** Final chapter: stop being blind and run the player down for good. */
  startHunt() { this.hunting = true; this.stunT = 0; this.path = null; this.enter(MS.CHASE); }
  /** After it catches the player it backs off (it cannot be fought, but the player gets a chance to get away). */
  retreat(seconds = 5) { this.stunT = seconds; this.last = null; this.hearT = 0; this.path = null; this.enter(MS.RETURN_TO_PATROL); }
  get x() { return this.body.x; }
  get y() { return this.body.y; }
  setHideSpots() { /* kept for API compatibility: a blind creature does not check hiding places, hiding just keeps you silent */ }
  enter(state, timer = 0) { this.state = state; this.timer = timer; this.path = null; this.pathGoal = null; }

  /** Offer a sound event. Returns true if the creature heard it.
   *  A heard sound makes it CHARGE at where the noise came from (it does not know where YOU are, only where the noise was). */
  hear(ev) {
    if (this.stunT > 0 || this.hunting) return false;   // (a hunter that can already see you does not need to listen)
    const p = perceived({ ...ev, radius: ev.radius * HEARING * (1 + this.aggro * 0.25) }, this.x, this.y, this.grid);
    if (p < 0.05) return false;
    // Position estimate gets worse with distance and with quiet sounds.
    const d = Math.hypot(ev.x - this.x, ev.y - this.y), err = d * 0.12 * (1 - p);
    const a = this.rng() * Math.PI * 2;
    const spot = { x: ev.x + Math.cos(a) * err, y: ev.y + Math.sin(a) * err };
    this.heard = { ...spot, id: ev.id }; this.last = spot;
    const loud = p >= LOUD;
    this.hearT = Math.max(this.hearT, SOUND_MEMORY + this.aggro * 0.8 + (ev.duration || 0));
    const wasCreeping = this.cautious;
    if (this.state !== MS.CHASE) {
      this.facing = Math.atan2(ev.y - this.y, ev.x - this.x);
      this.cautious = !loud; this.lunged = false;
      this.enter(MS.CHASE);
      this.events.push('hear', loud ? 'rush' : 'creep');   // 'rush' = roar and charge; 'creep' = silent, slow, much worse
    } else if (loud && wasCreeping) { this.cautious = false; this.lunged = false; this.events.push('rush'); }   // a creeping monster that hears something LOUD snaps into a charge
    return true;
  }

  follow(tx, ty, speed, dt) {
    const b = this.body, d = Math.hypot(tx - b.x, ty - b.y);
    if (d < 6) return true;
    let wx = tx, wy = ty;
    // it cannot see the target, so it always paths by the map (it "smells" its way round walls and through doors)
    if (d >= 40) {
      this.repathT -= dt;
      const key = tileOf(tx) + ',' + tileOf(ty);
      if (!this.path || this.pathGoal !== key || this.repathT <= 0) {
        const g = nearestFree(this.grid, tileOf(tx), tileOf(ty));
        this.path = g ? bfs(this.grid, tileOf(b.x), tileOf(b.y), g.tx, g.ty) : null;
        this.pathGoal = key; this.repathT = 0.6;
      }
      if (this.path && this.path.length) {
        let n = this.path[0];
        if (Math.hypot(n.tx * TILE + 16 - b.x, n.ty * TILE + 16 - b.y) < 5) { this.path.shift(); n = this.path[0]; }
        if (n) { wx = n.tx * TILE + 16; wy = n.ty * TILE + 16; }
      }
    }
    const dx = wx - b.x, dy = wy - b.y, len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * speed; this.vy = (dy / len) * speed;
    this.facing = Math.atan2(dy, dx);
    moveBody(this.grid, b, this.vx * dt, 0);
    moveBody(this.grid, b, 0, this.vy * dt);
    return false;
  }

  /** @param {number} dt @param {{px:number,py:number,hidden:boolean}} w  (only the player's position is used, for TOUCH) */
  update(dt, w) {
    this.events.length = 0; this.contact = false; this.vx = 0; this.vy = 0;
    const b = this.body, dist = Math.hypot(w.px - b.x, w.py - b.y);
    if (this.stunT > 0) this.stunT -= dt;
    this.aggro = Math.max(0, this.aggro - dt * 0.008);
    // Blind: the only way it "finds" you without a sound is by bumping into you.
    if (this.stunT <= 0 && !w.hidden && dist < (this.state === MS.CHASE ? 24 : 20)) { this.contact = true; this.events.push('catch'); }
    if (this.hunting) { this.follow(w.px, w.py, SPEED.hunt, dt); return; }   // sighted: straight at the player, every frame
    if (this.charging > 0) {                                                  // phantom scare charge: locked onto the player
      this.charging -= dt;
      if (w.hidden) this.charging = 0;
      else { this.state = MS.CHASE; this.last = { x: w.px, y: w.py }; this.hearT = Math.max(this.hearT, 0.5); this.follow(w.px, w.py, SPEED.chase * 0.9, dt); return; }
    }

    switch (this.state) {
      case MS.PATROL: {
        const p = this.patrol[this.patrolIdx];
        if (!p) break;
        if (this.timer > 0) { this.timer -= dt; break; }
        this.listenCooldown -= dt;
        if (this.listenCooldown <= 0) { this.listenCooldown = 6 + this.rng() * 8; this.enter(MS.LISTEN, 2); this.events.push('listen'); break; }
        if (this.follow(p.x, p.y, SPEED.patrol, dt)) {
          let n = this.patrolIdx;
          if (this.patrol.length > 1) {
            // PROWL (the director): most of the time it heads for the patrol point NEAREST TO YOU, so it keeps drifting into your area.
            if (this.rng() < 0.6 && w.px !== undefined && dist < 20 * TILE) { let bd = 1e9; this.patrol.forEach((q, i) => { const dq = Math.hypot(q.x - w.px, q.y - w.py); if (i !== this.patrolIdx && dq < bd) { bd = dq; n = i; } }); if (n !== this.patrolIdx) this.events.push('prowl'); }
            if (n === this.patrolIdx) while (n === this.patrolIdx) n = Math.floor(this.rng() * this.patrol.length);
          }
          this.patrolIdx = n; this.timer = 1.2 + this.rng() * 2;
        }
        break;
      }
      case MS.CHASE: {
        // charge at the newest noise; the moment the noise has stopped for SOUND_MEMORY seconds, STOP and listen.
        this.hearT -= dt;
        if (this.last) {
          const dd = Math.hypot(this.last.x - b.x, this.last.y - b.y);
          let sp = this.cautious ? SPEED.creep : SPEED.chase;
          // LUNGE: a charging monster bursts forward when the noise is close (never a creeping one: that one stays slow and silent)
          if (!this.cautious && dd < LUNGE_DIST && dd > 10) { if (!this.lunged) { this.lunged = true; this.lungeT = 0.9; this.events.push('lunge'); } }
          if (this.lungeT > 0) { this.lungeT -= dt; sp = SPEED.lunge; }
          this.follow(this.last.x, this.last.y, sp, dt);
        }
        if (this.hearT <= 0) {
          this.aggro = Math.min(1, this.aggro + 0.2);
          const at = this.last ? { ...this.last } : { x: b.x, y: b.y };
          this.searchCenter = at; this.last = null; this.heard = null; this.cautious = false;
          this.enter(MS.LISTEN, LISTEN_TIME); this.events.push('lost');
        }
        break;
      }
      case MS.LISTEN: // frozen, head up, ears open. Hearing something again starts a new chase (see hear()).
        this.timer -= dt;
        // it "feels" you: the head turns slowly toward you (but it does NOT know where you are, it never moves toward you from here)
        { const want = Math.atan2(w.py - b.y, w.px - b.x); let df = ((want - this.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.facing += Math.max(-0.5 * dt, Math.min(0.5 * dt, df)); }
        if (this.timer <= 0) { this.beginSearch(); }
        break;
      case MS.SEARCH: {
        // It does not leave. It crawls to 3-4 spots around where it last heard you, stopping to sniff at each one.
        this.searchT -= dt;
        if (this.searchT <= 0 || !this.searchPts.length && this.searchWait <= 0) { this.enter(MS.RETURN_TO_PATROL); this.events.push('search_end'); break; }
        if (this.searchWait > 0) {
          this.searchWait -= dt;
          this.sniffT -= dt;
          if (this.sniffT <= 0) { this.sniffT = 2.2 + this.rng() * 1.6; this.events.push('sniff'); }
          // hiding right next to where it is sniffing: tension event (does not hurt: hiding still keeps you safe)
          if (w.hidden && dist < 52 && !this.closeFlag) { this.closeFlag = true; this.events.push('sniff_close'); }
          if (dist >= 52) this.closeFlag = false;
          break;
        }
        const t = this.searchPts[0];
        if (this.follow(t.x, t.y, SPEED.search, dt)) { this.searchPts.shift(); this.searchWait = 1.1 + this.rng() * 1.4; this.sniffT = 0.3; this.facing += (this.rng() - 0.5) * 2; }
        break;
      }
      case MS.RETURN_TO_PATROL: {
        const p = this.patrol[this.nearestPatrol()];
        if (!p) { this.enter(MS.PATROL, 3); break; }
        if (this.follow(p.x, p.y, SPEED.ret, dt)) { this.patrolIdx = this.nearestPatrol(); this.enter(MS.PATROL, 1.5); }
        break;
      }
    }
  }

  /** Pick 3-4 reachable spots around where it last heard you and go sniff at them. */
  beginSearch() {
    const c = this.searchCenter || { x: this.x, y: this.y };
    this.searchPts = []; this.closeFlag = false;
    for (let i = 0; i < 12 && this.searchPts.length < 4; i++) {
      const a = this.rng() * Math.PI * 2, r = (1.5 + this.rng() * 3.5) * TILE;
      const g = nearestFree(this.grid, tileOf(c.x + Math.cos(a) * r), tileOf(c.y + Math.sin(a) * r));
      if (g) this.searchPts.push({ x: g.tx * TILE + 16, y: g.ty * TILE + 16 });
    }
    this.searchT = SEARCH_TIME + this.aggro * 5; this.searchWait = 0.8; this.sniffT = 0.4;
    this.enter(MS.SEARCH); this.events.push('search');
  }

  nearestPatrol() {
    let best = 0, bd = 1e9;
    this.patrol.forEach((p, i) => { const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
}
