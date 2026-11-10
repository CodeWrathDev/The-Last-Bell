import Phaser from 'phaser';
import { TILE, DEPTH } from '../config.js';
import { T } from '../assets/TextureFactory.js';
import { SOLID, mulberry } from '../maps/MapBuilder.js';

const POOL_DRIPS = 20, POOL_SPLASH = 14;

/**
 * Per-map ambient life, all pooled and pixel-snapped: drifting fog bands, indoor dust, falling leaves,
 * roof drips with splashes, puddle ripples and swaying grass. Everything is destroyed with the map.
 */
export class Environment {
  constructor(scene) {
    this.scene = scene; this.objs = []; this.fogs = []; this.dust = []; this.leaves = []; this.emitters = []; this.drips = []; this.splashes = [];
    this.sway = []; this.t = 0;
  }
  add(o) { this.objs.push(o); return o; }

  build(m) {
    const sc = this.scene, W = m.w * TILE, H = m.h * TILE, rnd = mulberry(1234 + m.w * 7 + m.h);
    this.W = W; this.H = H; this.outdoor = !!m.meta.outdoor;

    if (this.outdoor) {
      // Three dithered fog bands at different depths/speeds (tiled, never scaled, so pixels stay crisp).
      [[H * 0.30, 0.8, 5], [H * 0.55, 0.6, 9], [H * 0.78, 0.5, 3]].forEach(([y, a, v], i) => {
        const f = this.add(sc.add.tileSprite(0, y, W, 128, 'fog').setOrigin(0, 0.5).setDepth(DEPTH.FOG).setAlpha(a));
        f.v = v; f.flip = i === 1; this.fogs.push(f);
      });
      for (let i = 0; i < 7; i++) {
        const l = this.add(sc.add.image(rnd() * W, rnd() * H, 'particles', 'leaf_' + (i % 3)).setDepth(DEPTH.ABOVE - 1).setAlpha(0.9));
        l.vy = 14 + rnd() * 16; l.ph = rnd() * 6; l.vx = -6 - rnd() * 8; this.leaves.push(l);
      }
      this.buildGrass(m, rnd); this.buildPuddles(m, rnd); this.buildDrips(m, rnd);
    } else {
      this.buildWindowRain(m, rnd);
      this.buildShafts(m, rnd);
      this.buildLeaks(m, rnd);
      for (let i = 0; i < 30; i++) {
        const d = this.add(sc.add.image(rnd() * W, rnd() * H, 'particles', 'dust_' + (i % 2)).setDepth(DEPTH.ABOVE + 2).setAlpha(0.35 + rnd() * 0.4));
        d.vx = (rnd() - 0.5) * 5; d.vy = -1 - rnd() * 3; d.ph = rnd() * 6; this.dust.push(d);
      }
    }
  }

  /** Rain streaks that run down the glass of every rainy window (kept inside the pane by logic, no masks). */
  buildWindowRain(m, rnd) {
    this.panes = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.layers.deco[y][x] !== T.WINDOWRAIN) continue;
      for (let k = 0; k < 6; k++) {
        const s = this.add(this.scene.add.image(0, 0, 'rain', 'rain_0').setDepth(DEPTH.DECOR + 0.55).setAlpha(0.35 + rnd() * 0.45));
        s.px = x * TILE + 6 + ((k * 4 + (rnd() * 3) | 0) % 20); s.top = y * TILE + 6; s.bot = y * TILE + 24; s.y = s.top + rnd() * 18; s.v = 12 + rnd() * 34;
        this.panes.push(s);
      }
    }
  }

  /** Cold moonlight shafts falling from every rainy window onto the floor (additive, very faint, slowly breathing). */
  buildShafts(m, rnd) {
    this.shafts = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.layers.deco[y][x] !== T.WINDOWRAIN) continue;
      const img = this.add(this.scene.add.image(x * TILE + 16, (y + 1) * TILE, 'light_cone')
        .setOrigin(0, 0.5).setRotation(Math.PI / 2).setScale(0.95, 0.8).setTint(0x7a9cff)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.DECOR + 0.3).setAlpha(0.07));
      img.base = 0.05 + rnd() * 0.04; img.ph = rnd() * 6;
      this.shafts.push(img);
    }
  }

  /** Ceiling leaks: map meta `leaks: [[tileX, tileY], ...]` (tileY = floor tile where the water lands). Drip -> splash -> ripple. */
  buildLeaks(m, rnd) {
    const leaks = m.meta.leaks; if (!leaks?.length) return;
    this.initDripPools();
    for (const [tx, ty] of leaks) {
      const x = tx * TILE + 16, yFloor = ty * TILE + 20;
      const stain = this.add(this.scene.add.ellipse(x, yFloor + 2, 22, 9, 0x0b1020, 0.55).setDepth(DEPTH.GROUND + 0.4));
      stain.isStain = true;
      const r = this.add(this.scene.add.sprite(x, yFloor, 'rain', 'ripple_0').setDepth(DEPTH.DECOR - 0.5).setAlpha(0.8));
      r.play({ key: 'fx_ripple', repeat: -1, repeatDelay: 300 + rnd() * 700, delay: rnd() * 1200 });
      this.emitters.push({ x, y0: 2 * TILE - 2, y1: yFloor, t: rnd() * 2, period: 0.9 + rnd() * 1.4 });
    }
  }

  initDripPools() {
    if (this.drips.length) return;
    const sc = this.scene;
    for (let i = 0; i < POOL_DRIPS; i++) { const d = this.add(sc.add.image(0, 0, 'rain', 'drip_0').setDepth(DEPTH.ABOVE - 2).setVisible(false)); d.live = false; this.drips.push(d); }
    for (let i = 0; i < POOL_SPLASH; i++) { const s = this.add(sc.add.sprite(0, 0, 'rain', 'splash_0').setDepth(DEPTH.ABOVE - 2).setVisible(false)); s.on('animationcomplete', () => s.setVisible(false)); this.splashes.push(s); }
  }

  /** 0 = lowest (mobile / slow GPU), 1 = medium, 2 = full. Called by the FPS watchdog in GameScene. */
  setQuality(q) {
    this.quality = q;
    this.objs.forEach((o) => { if (o.texture?.key === 'particles' && /^(tuft|leaf)_/.test(o.frame?.name || '')) o.setVisible(q >= 2); });
    this.fogs.forEach((f, i) => f.setVisible(q >= 2 || i === 0));
    this.dust.forEach((d, i) => d.setVisible(q >= 1 || i % 2 === 0));
    (this.shafts || []).forEach((sh) => sh.setVisible(q >= 1));
  }

  buildGrass(m, rnd) {
    let n = 0;
    for (let tries = 0; tries < 600 && n < 70; tries++) {
      const tx = (rnd() * m.w) | 0, ty = (rnd() * m.h) | 0;
      const g = m.layers.ground[ty][tx];
      if ((g !== T.GRASS && g !== T.GRASS2) || m.layers.deco[ty][tx] >= 0) continue;
      const s = this.add(this.scene.add.sprite(tx * TILE + 4 + rnd() * 24, ty * TILE + 10 + rnd() * 20, 'particles', 'tuft_1').setOrigin(0.5, 1).setDepth(DEPTH.DECOR + 0.2));
      s.play({ key: 'fx_tuft', startFrame: (rnd() * 3) | 0, frameRate: 1.2 + rnd() * 1.6 });
      n++;
    }
  }

  buildPuddles(m, rnd) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.layers.ground[y][x] !== T.PUDDLE) continue;
      for (let k = 0; k < 2; k++) {
        const r = this.add(this.scene.add.sprite(x * TILE + 10 + rnd() * 12, y * TILE + 14 + rnd() * 10, 'rain', 'ripple_0').setDepth(DEPTH.DECOR - 0.5).setAlpha(0.85));
        r.play({ key: 'fx_ripple', repeat: -1, repeatDelay: 500 + rnd() * 1400, delay: rnd() * 2000 });
      }
    }
  }

  buildDrips(m, rnd) {
    const sc = this.scene;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if ((m.layers.deco[y][x] !== T.ROOFEDGE && m.layers.deco[y][x] !== T.ROOFTINEDGE) || (x * 7 + y) % 3 !== 0) continue;
      let ly = y + 1; while (ly < m.h && SOLID.has(m.layers.deco[ly][x])) ly++;
      this.emitters.push({ x: x * TILE + 6 + rnd() * 20, y0: y * TILE + 18, y1: ly * TILE + 4, t: rnd() * 2 });
    }
    this.initDripPools();
  }

  splash(x, y) {
    const s = this.splashes.find((q) => !q.visible); if (!s) return;
    s.setPosition(Math.round(x), Math.round(y)).setVisible(true).play('fx_splash');
  }

  update(dt) {
    this.t += dt;
    for (const f of this.fogs) f.tilePositionX += (f.flip ? -1 : 1) * f.v * dt;
    if (this.panes) for (const p of this.panes) { p.y += p.v * dt; if (p.y > p.bot) { p.y = p.top; p.v = 16 + Math.random() * 26; } p.setPosition(p.px, Math.round(p.y)); }
    if (this.shafts) for (const sh of this.shafts) sh.setAlpha(sh.base * (0.7 + 0.3 * Math.sin(this.t * 0.9 + sh.ph)) * (1 + 6 * (this.scene.ui?.light?.flash || 0)));
    for (const l of this.leaves) {
      l.y += l.vy * dt; l.x += (l.vx + Math.sin(this.t * 1.6 + l.ph) * 14) * dt;
      if (l.y > this.H + 6 || l.x < -8) { l.y = -6; l.x = Math.random() * this.W; }
      l.setPosition(Math.round(l.x), Math.round(l.y));
    }
    for (const d of this.dust) {
      d.x += (d.vx + Math.sin(this.t * 0.6 + d.ph) * 3) * dt; d.y += d.vy * dt;
      if (d.y < -4) d.y = this.H + 2; if (d.x < -4) d.x = this.W + 2; if (d.x > this.W + 4) d.x = -2;
      d.setPosition(Math.round(d.x), Math.round(d.y));
    }
    for (const e of this.emitters) {
      e.t -= dt;
      if (e.t > 0) continue;
      e.t = e.period ? e.period * (0.8 + Math.random() * 0.5) : 0.7 + Math.random() * 2.4;
      const d = this.drips.find((q) => !q.live); if (!d) continue;
      d.live = true; d.vy = 0; d.ex = e; d.setPosition(Math.round(e.x), e.y0).setVisible(true);
    }
    for (const d of this.drips) {
      if (!d.live) continue;
      d.vy += 520 * dt; d.y += d.vy * dt;
      if (d.y >= d.ex.y1) { d.live = false; d.setVisible(false); this.splash(d.x, d.ex.y1); }
      else d.y = Math.round(d.y);
    }
  }

  /** Splashes from the screen-space rain are drawn by RainField; this is for world-space ones. */
  destroy() { this.objs.forEach((o) => o?.destroy && o.destroy()); this.objs = []; this.fogs = []; this.dust = []; this.leaves = []; this.emitters = []; this.drips = []; this.splashes = []; this.shafts = []; }
}
