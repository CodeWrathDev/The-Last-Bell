import { angDiff } from '../systems/Collision.js';

// Camera rig. Pure logic (no Phaser) so it can be unit-tested in Node.
// World units are map tiles (1 unit = 32 px). The player's `heading` is the direction they face.
// v43: FIRST PERSON. The camera sits at the player's eyes and looks exactly where the player looks (no boom, no lag).
//      Set RIG.FIRST_PERSON = false to get the old third-person follow camera back.

export const RIG = {
  FIRST_PERSON: true,
  EYE: 1.38,          // eye height standing (world units; walls are 2.25, desks 0.8)
  EYE_CROUCH: 0.42,   // how far the eyes sink while sneaking
  HIDE_EYE: 0.55,     // eye height while hiding under a desk
  FP_FLASH_BOOM: 0.8, // flashlight reach offset in first person (the beam starts at the eyes)
  PITCH_MAX: 46,      // look up/down limit, in screen pixels of horizon shift (buffer is 270 px tall)
  BOOM: 3.4,          // ideal distance behind the player
  MIN_BOOM: 2.7,      // the camera may sink into a wall behind the player (the renderer skips faces behind it) rather than crowd the player
  POS_LAG: 7.5,       // camera position smoothing (1/s): higher = snappier
  YAW_LAG: 5.2,       // camera heading smoothing (1/s): the lag you see when turning
  TURN: 2.35,         // keyboard turn speed, rad/s
  BACK_SPEED: 0.62,   // walking backwards is slower
  CAM_BLOCK_H: 1.3,   // cells at least this tall block the camera (desks do not: the camera looks over them)
};

export class Rig3D {
  constructor() {
    this.heading = 0; this.yaw = 0; this.ix = 0; this.iy = 0; this.x = 0; this.y = 0; this.boom = RIG.BOOM; this.pitch = 0;
  }

  /** Mouse / touch look: dx = radians of turn, dy = pixels of pitch (positive = look down). */
  lookBy(dx, dy = 0) {
    this.heading = wrap(this.heading + dx);
    this.pitch = Math.max(-RIG.PITCH_MAX, Math.min(RIG.PITCH_MAX, this.pitch + dy));
  }

  turn(dt, amount) { this.heading = wrap(this.heading + amount * RIG.TURN * dt); }
  turnBy(rad) { this.heading = wrap(this.heading + rad); }

  /** Camera-relative input -> world-space velocity direction. fwd/strafe in -1..1 (forward/right positive). */
  static move(heading, fwd, strafe) {
    const c = Math.cos(heading), s = Math.sin(heading);
    return { vx: c * fwd - s * strafe, vy: s * fwd + c * strafe };
  }

  snap(px, py, heading, blocked) {
    this.heading = wrap(heading); this.yaw = this.heading;
    if (RIG.FIRST_PERSON) { this.pitch = 0; this.firstPerson(px, py); return; }
    this.ix = px - Math.cos(this.heading) * RIG.BOOM; this.iy = py - Math.sin(this.heading) * RIG.BOOM;
    this.place(px, py, blocked);
  }

  /** px,py = player feet (units). `blocked(x, y)` is true where the camera cannot go (tall walls). */
  update(dt, px, py, blocked) {
    if (RIG.FIRST_PERSON) { this.yaw = this.heading; this.firstPerson(px, py); return; }
    const kp = 1 - Math.exp(-dt * RIG.POS_LAG), ky = 1 - Math.exp(-dt * RIG.YAW_LAG);
    this.yaw = wrap(this.yaw + angDiff(this.heading, this.yaw) * ky);
    const tx = px - Math.cos(this.heading) * RIG.BOOM, ty = py - Math.sin(this.heading) * RIG.BOOM;
    this.ix += (tx - this.ix) * kp; this.iy += (ty - this.iy) * kp;
    this.place(px, py, blocked);
  }

  /** First person: the camera IS the player's head. */
  firstPerson(px, py) { this.x = px; this.y = py; this.ix = px; this.iy = py; this.yaw = this.heading; this.boom = RIG.FP_FLASH_BOOM; }

  /** Pulls the camera in along the boom if a wall is in the way, so it never ends up inside geometry. */
  place(px, py, blocked) {
    const dx = this.ix - px, dy = this.iy - py, len = Math.hypot(dx, dy) || 1e-6;
    let t = 1;
    const n = Math.ceil(len / 0.08);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (blocked(px + dx * k, py + dy * k)) { t = Math.max(0, (i - 1) / n); break; }
    }
    let dist = len * t - 0.32;
    dist = Math.max(RIG.MIN_BOOM, dist);
    if (dist > len) dist = len;
    this.boom = dist;
    this.x = px + (dx / len) * dist; this.y = py + (dy / len) * dist;
  }
}

export const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** Cardinal heading with the most open floor ahead (used when restoring a save, which stores no heading). */
export function bestHeading(grid, tx, ty) {
  const dirs = [[1, 0, 0], [0, 1, Math.PI / 2], [-1, 0, Math.PI], [0, -1, -Math.PI / 2]];
  let best = -Math.PI / 2, bd = -1;
  for (const [dx, dy, h] of dirs) {
    let d = 0, x = Math.floor(tx), y = Math.floor(ty);
    while (d < 40) { x += dx; y += dy; if (y < 0 || x < 0 || y >= grid.length || x >= grid[0].length || grid[y][x]) break; d++; }
    if (d > bd) { bd = d; best = h; }
  }
  return best;
}
