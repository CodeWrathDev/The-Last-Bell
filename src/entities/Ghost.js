import { DEPTH, TILE, CRAWLER } from '../config.js';
import { MonsterBrain, MS } from '../systems/MonsterBrain.js';
import { audio } from '../systems/AudioSystem.js';
import { crawlerDir } from '../systems/CrawlerDir.js';

// THE crawling creature (the girl's other form). There is exactly one monster in the game.
/** Sprite wrapper around the pure MonsterBrain. */
export class Ghost {
  constructor(scene, opts) {
    this.scene = scene;
    this.brain = new MonsterBrain({ x: opts.x, y: opts.y, patrol: opts.patrol, grid: opts.grid });
    this.sprite = scene.add.sprite(this.brain.x, this.brain.y, 'ghost_crawler', 0).setOrigin(0.5, CRAWLER.ORIGIN_Y).setAlpha(0);
    this.dirIdx = 4; this.dirHeading = Math.PI / 2;          // starts facing the camera
    this.sprite.anims.play('crawler_idle_4');
    this.t = 0; this.fade = 0; this.cur = ''; this.stepT = 0; this.breathT = 3; this.gruntT = 3 + Math.random() * 3; this.knockT = 5; this.chaseRoarT = 7; this.aura = 0; this.fadeRate = 0.5; this.mist = 0; this.mistBase = 0.55;
  }
  /** Rises out of the dark right beside the player: fades in fast and bursts a cloud of black mist. */
  emerge() { this.fade = 0; this.fadeRate = 1.8; this.mist = 1.6; this.sprite.setAlpha(0); }
  /** A ghost-like apparition: appears INSTANTLY (no fade) and stands still until vanish() snaps it away. */
  appear() { this.phantom = true; this.fade = 1; this.fadeRate = 0.5; this.mist = 1.6; this.sprite.setAlpha(1); }
  /** Pops into existence INSTANTLY (no fade) as the real, hunting creature. */
  pop() { this.hold = false; this.phantom = false; this.fade = 1; this.mist = 1.6; this.sprite.setAlpha(1); }
  /** Gone in one frame (no fade-out); the real creature then fades back in far away. */
  vanish() { this.phantom = false; this.fade = 0; this.fadeRate = 0.35; this.mist = 0; this.sprite.setAlpha(0); }
  get chasing() { return this.brain.state === MS.CHASE; }
  get state() { return this.brain.state; }

  update(dt, world) {
    const b = this.brain;
    if (!this.phantom && !this.hold) b.update(dt, world);   // a phantom just stands there (it is only a scare)
    this.t += dt; this.fade = this.leaving ? Math.max(0, this.fade - dt * (this.leaveRate ?? 0.9)) : Math.min(1, this.fade + dt * this.fadeRate); this.mist = Math.max(0, this.mist - dt * 0.25);
    if (this.hold) this.fade = 0;                  // the dark pause: it is nowhere (yet)
    const feet = b.y + b.body.hh;
    this.sprite.setPosition(Math.round(b.x), Math.round(feet));
    this.sprite.setDepth(DEPTH.ENTITIES + feet / 1000);
    const moving = Math.abs(b.vx) + Math.abs(b.vy) > 1;
    // Which of the 8 pre-rendered views to show: its travel direction (or where it is looking, when standing still)
    // measured against the camera. 0 = walking away (back view) ... 4 = walking toward the camera (face view).
    if (moving && Math.hypot(b.vx, b.vy) > 4) this.dirHeading = Math.atan2(b.vy, b.vx); else if (!moving) this.dirHeading = b.facing;
    const yaw = this.scene.view3d?.rig?.yaw;
    this.dirIdx = crawlerDir(this.dirHeading, typeof yaw === 'number' ? yaw : -Math.PI / 2, this.dirIdx, CRAWLER.DIRS);
    const anim = b.charging > 0 ? 'lunge' : this.chasing ? 'chase' : (b.state === 'listen' || b.state === 'search') ? 'stalk' : moving ? 'crawl' : 'idle';
    const key = `crawler_${anim}_${this.dirIdx}`;
    if (key !== this.cur) {
      // keep the gait / hair phase when only the direction changes, so legs and hair never snap back to frame 0
      const frames = anim === 'idle' ? 4 : 6, idx = Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1) % frames;
      this.cur = key; this.sprite.anims.play({ key, startFrame: idx }, true);
    }
    const vis = this.fade;
    this.sprite.setAlpha(vis * (this.chasing ? 1 : 0.95));
    // Dread aura strength 0..1 (read by View3D): always faintly there, swells while it hunts, throbs like a heartbeat.
    this.aura = vis * (this.chasing ? 1 : (this.state === 'listen' || this.state === 'search') ? 0.7 : 0.45) * (0.85 + 0.15 * Math.sin(this.t * (this.chasing ? 9 : 3)));

    // Directional audio: the player locates it by ear (spatial gain + pan, louder when close).
    const am = this.scene.audioMgr;
    if (am && !this.hold) {
      this.stepT -= dt; this.breathT -= dt;
      const surface = this.scene.surface || 'concrete';
      if (moving && this.stepT <= 0) { this.stepT = this.chasing ? 0.28 : 0.55; am.at('crawl_' + surface, { x: b.x, y: b.y }, { maxDist: 9 * TILE }); }
      // Recorded monster sounds. They are positional: you hear which side it is on and how close it is.
      const pd = Math.hypot(b.x - world.px, b.y - world.py), at = { x: b.x, y: b.y };
      this.gruntT -= dt; this.knockT -= dt; this.chaseRoarT -= dt;
      if (this.chasing) {
        if (this.chaseRoarT <= 0 && !audio.isPlaying('mon_roar') && !audio.isPlaying('mon_roar_eye')) { this.chaseRoarT = 8 + Math.random() * 4; am.at('mon_roar_eye', at, { channel: 'sfx', maxDist: 16 * TILE }); }
      } else {
        this.chaseRoarT = 5;
        if (this.gruntT <= 0) { this.gruntT = 9 + Math.random() * 8; am.at(Math.random() < 0.35 ? 'mon_growl' : 'mon_grunts', at, { channel: 'sfx', maxDist: 13 * TILE }); }
        // frozen and listening close to you: slow knocking / sniffing
        if (this.state === 'listen' && pd < 7 * TILE && this.knockT <= 0) { this.knockT = 7 + Math.random() * 4; am.at('mon_knock', at, { channel: 'sfx', maxDist: 9 * TILE }); }
      }
      if (this.breathT <= 0) { this.breathT = this.chasing ? 1.4 : 2.6 + Math.random() * 1.6; am.at(Math.hypot(b.x - world.px, b.y - world.py) < 3 * TILE ? 'breath_close' : 'breath', { x: b.x, y: b.y }, { maxDist: 8 * TILE }); }
    }
  }
  destroy() { audio.fadeOut('mon_roar', 400); audio.fadeOut('mon_roar_eye', 400); this.sprite.destroy(); }
}
void audio;
