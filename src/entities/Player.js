import { DEPTH, PLAYER, FLASH_DRAIN } from '../config.js';
import { moveBody, angDiff } from '../systems/Collision.js';


export class Player {
  constructor(scene) {
    this.scene = scene;
    // Body is the box at the feet; (x, y) of the body is its centre.
    this.body = { x: 0, y: 0, hw: 6, hh: 4 };
    this.sprite = scene.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 0.95);
    this.act = null; this.actT = 0; this.dead = false;
    this.dir = 'down'; this.aim = Math.PI / 2; this.animT = 0; this.stepT = 0;
    this.stamina = 100; this.exhausted = false; this.hearts = 1; this.battery = 100; // ONE heart for the whole game: any catch is fatal
    this.flashOn = false; this.hidden = false; this.invuln = 0;
    this.moving = false; this.running = false; this.crouch = false; this.crouching = false; this.stepped = false; this.preHide = null; this.hideTile = null;
  }

  get x() { return this.body.x; }
  get y() { return this.body.y + this.body.hh; } // feet

  setFeet(x, y) { this.body.x = x; this.body.y = y - this.body.hh; this.sync(); }

  sync() {
    const s = this.sprite;
    s.setPosition(Math.round(this.x), Math.round(this.y));
    s.setDepth(this.hidden ? DEPTH.ENTITIES + 5 : DEPTH.ENTITIES + this.y / 1000);
  }

  update(dt, vx, vy, wantRun, grid) {
    this.stepped = false;
    const moving = !this.hidden && (vx !== 0 || vy !== 0);
    this.moving = moving; this.running = false; this.crouching = moving && this.crouch;
    if (moving) {
      const len = Math.hypot(vx, vy); vx /= len; vy /= len;
      this.running = wantRun && !this.crouch && !this.exhausted && this.stamina > 0;
      const speed = (this.running ? PLAYER.RUN : PLAYER.WALK * (this.crouch ? 0.5 : 1)) * (this.speedMul ?? 1);
      if (this.running) {
        this.stamina -= PLAYER.RUN_DRAIN * dt;
        if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.running = false; }
      }
      moveBody(grid, this.body, vx * speed * dt, vy * speed * dt);
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      this.aim += angDiff(Math.atan2(vy, vx), this.aim) * Math.min(1, dt * 10);
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = this.running ? 0.26 : this.crouch ? 0.62 : 0.4; this.stepped = true; }
      this.animT += dt * (this.running ? 9 : 6);
    } else this.animT = 0;

    if (!this.running) {
      this.stamina = Math.min(100, this.stamina + (moving ? PLAYER.REGEN_MOVE : PLAYER.REGEN_IDLE) * dt);
      if (this.exhausted && this.stamina >= 30) this.exhausted = false;
    }

    if (this.flashOn && !this.hidden) {
      this.battery -= FLASH_DRAIN * dt;
      if (this.battery <= 0) { this.battery = 0; this.flashOn = false; this.batteryDied = true; }
    }
    if (this.invuln > 0) this.invuln -= dt;

    // Third-person view: the camera always sees the player's back, and the flashlight points where the camera looks.
    if (this.facing3d != null) { this.dir = 'up'; this.aim = this.facing3d; }
    this.animate(dt, moving);
    this.sprite.setAlpha(this.hidden ? 0.3 : this.invuln > 0 ? (Math.floor(this.invuln * 12) % 2 ? 0.35 : 1) : 1);
    this.sync();
  }

  /** One-shot action animation (pickup, search, opendoor, fear, death) that overrides locomotion for `secs`. */
  doAction(key, secs) {
    if (this.dead) return;
    this.act = key; this.actT = secs;
    this.sprite.anims.play('player_' + key, true);
  }

  die() { this.dead = true; this.act = 'death'; this.actT = 99; this.flashOn = false; this.sprite.anims.play('player_death'); }

  animate(dt, moving) {
    if (this.dead) return;
    if (this.actT > 0) { this.actT -= dt; if (this.actT > 0) return; this.act = null; }
    let key;
    if (this.hidden) key = 'hide';
    else if (this.act === 'fear') key = 'fear';
    else {
      const base = moving
        ? (this.running ? 'run' : this.crouch ? (this.flashOn ? 'fsneak' : 'sneak') : this.flashOn ? 'fwalk' : 'walk')
        : (this.flashOn ? 'fidle' : 'idle');
      key = `${base}_${this.dir}`;
    }
    this.sprite.anims.play('player_' + key, true);
  }

  hide(spot) {
    this.preHide = { x: this.x, y: this.y };
    this.hideTile = { tx: spot.tx, ty: spot.ty };
    this.hidden = true; this.flashOn = false;
    this.body.x = spot.x; this.body.y = spot.y;
  }

  unhide() {
    if (!this.hidden) return;
    this.hidden = false; this.hideTile = null;
    if (this.preHide) this.setFeet(this.preHide.x, this.preHide.y);
  }

  /** Nearest hiding tile within ~1.4 tiles of the player, or null. */
  findHideSpot(spots) {
    let best = null, bd = 46;
    for (const s of spots) { const d = Math.hypot(s.x - this.x, s.y - (this.y - 4)); if (d < bd) { bd = d; best = s; } }
    return best;
  }
}
