import { VIEW_W, VIEW_H } from '../config.js';

/**
 * Screen-space rain from pooled pixel streaks (three lengths for three speeds) with pooled splash sprites
 * where drops hit the ground. Used by the menu and the in-game UI scene.
 */
export class RainField {
  constructor(scene, count, depth, { splashes = 14 } = {}) {
    this.drops = []; this.pool = []; this.depth = depth;
    for (let i = 0; i < count; i++) {
      const v = 420 + Math.random() * 560, f = v > 820 ? 2 : v > 620 ? 1 : 0;
      const img = scene.add.image(0, 0, 'rain', 'rain_' + f).setDepth(depth).setAlpha(0.22 + (v - 420) / 1400);
      this.drops.push({ img, x: Math.random() * (VIEW_W + 120), y: Math.random() * VIEW_H, v });
    }
    for (let i = 0; i < splashes; i++) {
      const s = scene.add.sprite(0, 0, 'rain', 'splash_0').setDepth(depth).setVisible(false).setAlpha(0.8);
      s.on('animationcomplete', () => s.setVisible(false));
      this.pool.push(s);
    }
    this.on = true; this.q = 2;
  }
  update(dt) {
    for (const d of this.drops) {
      d.y += d.v * dt; d.x -= d.v * dt * 0.22;
      if (d.y > VIEW_H + 20 || d.x < -20) {
        if (this.on && this.q !== 0 && d.y > VIEW_H * 0.4 && Math.random() < 0.22) {   // a drop that landed: show a splash
          const s = this.pool.find((q) => !q.visible);
          if (s) s.setPosition(Math.round(d.x), Math.round(Math.min(d.y, VIEW_H - 6))).setVisible(true).play('fx_splash');
        }
        d.y = -20; d.x = Math.random() * (VIEW_W + 140);
      }
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
    }
  }
  /** q: 2 = all drops + splashes, 1 = half, 0 = a quarter and no splashes. */
  setQuality(q) {
    this.q = q;
    this.drops.forEach((d, i) => d.img.setVisible(this.on && (q >= 2 || (q === 1 ? i % 2 === 0 : i % 4 === 0))));
  }
  setVisible(v) { this.on = v; this.drops.forEach((d) => d.img.setVisible(v)); if (!v) this.pool.forEach((s) => s.setVisible(false)); }
}
