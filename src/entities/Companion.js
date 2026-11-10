import { DEPTH } from '../config.js';
import { CompanionBrain } from '../systems/CompanionBrain.js';

/** The girl as a human companion (Chapter 5): a normal schoolgirl sprite (not the ghost sheet), so nothing hints at the twist. */
export class Companion {
  constructor(scene, { x, y, grid }) {
    this.scene = scene;
    this.brain = new CompanionBrain({ x, y, grid });
    this.sprite = scene.add.sprite(x, y, 'npc_girl', 0).setOrigin(0.5, 0.96).setAlpha(1);
    this.sprite.anims.play('hgirl_idle'); this.cur = 'hgirl_idle';
  }
  say(trigger, force = false) { const line = this.brain.say(trigger, force); if (line) this.scene.U((u) => u.bubble(line)); return line; }
  update(dt, world) {
    const b = this.brain, px = b.x, py = b.y;
    b.update(dt, world);
    for (const e of b.events) if (e && e.say) this.scene.U((u) => u.bubble(e.say));
    const feet = b.y + b.body.hh;
    this.sprite.setPosition(Math.round(b.x), Math.round(feet)).setDepth(DEPTH.ENTITIES + feet / 1000);
    const key = b.moving ? 'hgirl_walk' : 'hgirl_idle';
    if (key !== this.cur) { this.cur = key; this.sprite.anims.play(key, true); }
    if (Math.abs(b.x - px) > 0.2) this.sprite.setFlipX(b.x < px);
    void py;
  }
  destroy() { this.sprite.destroy(); }
}
