import { RIG } from '../render3d/Rig3D.js';
// Shared touch state: the UI scene writes it, the game scene reads it.
export const touch = {
  enabled: false, x: 0, y: 0, run: false,
  q: { interact: false, flash: false, hide: false, crouch: false, throw: false },
};

/** Keyboard + touch input for the game scene. Edge actions are event-driven so no press is lost or repeated. */
export class Controls {
  constructor(scene) {
    const kb = scene.input.keyboard;
    this.kb = kb;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,CTRL');
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,TAB');
    this.q = { interact: false, flash: false, hide: false, crouch: false, throw: false };
    this.offs = [];
    const on = (name, act) => {
      const h = (e) => { if (!e.repeat) this.q[act] = true; };
      kb.on('keydown-' + name, h);
      this.offs.push(() => kb.off('keydown-' + name, h));
    };
    on('E', 'interact'); on('F', 'flash'); on('SPACE', 'hide'); on('C', 'crouch'); on('G', 'throw');
  }

  /** Returns this frame's input and clears the one-shot actions. */
  poll() {
    const k = this.keys;
    // First person: W/S (or Up/Down) walk forward/back, A/D strafe, mouse looks around, Left/Right arrows also turn.
    let vx = (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    let turn = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
    if (!vx && !vy && !turn && touch.enabled) {
      if (RIG.FIRST_PERSON) { vx = Math.abs(touch.x) > 0.18 ? touch.x : 0; vy = touch.y; }   // touch stick: walk + strafe (the right half of the screen looks around)
      else { turn = Math.abs(touch.x) > 0.18 ? touch.x : 0; vy = touch.y; }                  // third person: up/down walk, left/right turn
    }
    const out = {
      vx, vy, turn, run: k.SHIFT.isDown || touch.run,
      interact: this.q.interact || touch.q.interact,
      flash: this.q.flash || touch.q.flash,
      hide: this.q.hide || touch.q.hide,
      crouch: this.q.crouch || touch.q.crouch, throw: this.q.throw || touch.q.throw, crouchHeld: k.CTRL.isDown,
    };
    this.q.interact = this.q.flash = this.q.hide = this.q.crouch = this.q.throw = false;
    touch.q.interact = touch.q.flash = touch.q.hide = touch.q.crouch = touch.q.throw = false;
    return out;
  }

  destroy() { this.offs.forEach((f) => f()); this.offs = []; }
}
