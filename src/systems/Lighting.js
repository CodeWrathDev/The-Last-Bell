import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../config.js';
import { flashFlicker } from './FlashFlicker.js';

const DS = 2; // darkness canvas is half resolution, scaled up with NEAREST so the dithered light edges stay pixel-crisp
const DW = VIEW_W / DS, DH = VIEW_H / DS;

/**
 * Draws a dark-blue overlay and "erases" holes for every light:
 * lamps, ghost glow, the player's halo and the flashlight cone.
 * Lives in the UI scene (zoom 1), so it converts world -> screen coordinates itself.
 */
export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.tex = scene.textures.createCanvas('darkness', DW, DH);
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ctx = this.tex.context;
    this.ctx.imageSmoothingEnabled = false;
    this.img = scene.add.image(0, 0, 'darkness').setOrigin(0, 0).setScale(DS).setDepth(1);
    this.radial = scene.textures.get('light_radial').getSourceImage();
    this.cone = scene.textures.get('light_cone').getSourceImage();
    this.flash = 0; // lightning boost
  }

  render(gs, time) {
    const ctx = this.ctx, cam = gs.cameras.main, z = cam.zoom;
    const wvx = cam.scrollX + VIEW_W / 2 - VIEW_W / (2 * z), wvy = cam.scrollY + VIEW_H / 2 - VIEW_H / (2 * z);
    const k = z / DS;
    const amb = Math.max(0, (gs.meta?.ambient ?? 0.85) - this.flash);

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, DW, DH);
    const [tr, tg, tb] = gs.meta?.tint ?? (gs.meta?.outdoor ? [4, 8, 22] : [14, 8, 26]); // outdoor: cold blue, indoor: bruised purple
    ctx.fillStyle = `rgba(${tr},${tg},${tb},${amb})`;
    ctx.fillRect(0, 0, DW, DH);
    ctx.globalCompositeOperation = 'destination-out';

    const punch = (wx, wy, r, a) => {
      const cx = (wx - wvx) * k, cy = (wy - wvy) * k, rr = r * k;
      if (cx + rr < 0 || cy + rr < 0 || cx - rr > DW || cy - rr > DH) return;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.drawImage(this.radial, cx - rr, cy - rr, rr * 2, rr * 2);
    };

    const black = gs.blackout > 0 ? 0.12 : 1;
    for (const L of gs.lamps) {
      let a = 1;
      if (L.flicker) a = 0.55 + 0.45 * Math.abs(Math.sin(time * 0.011 + L.phase)) * (Math.sin(time * 0.037 + L.phase * 3) > -0.6 ? 1 : 0.2);
      punch(L.x, L.y, L.r, (L.i ?? 1) * a * black);
    }

    const g = gs.ghost;
    if (g && g.visible) punch(g.sprite.x, g.sprite.y - 14, 46, 0.4 + (g.chasing ? 0.2 : 0));

    const p = gs.player;
    if (p) {
      const px = p.x, py = p.y - 14;
      const on = p.flashOn && !p.hidden;
      punch(px, py, on ? 54 : 34, p.hidden ? 0.25 : 0.85);
      if (on) {
        const cx = (px + Math.cos(p.aim) * 8 - wvx) * k, cy = (py + Math.sin(p.aim) * 8 - wvy) * k;
        const s = (k * 270) / 160;
        const dim = (p.battery < 15 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 0.02)) : 1) * flashFlicker(time) * 0.75;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, cy); ctx.rotate(p.aim); ctx.scale(s, s);
        ctx.globalAlpha = dim;
        ctx.drawImage(this.cone, 0, -80);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    this.tex.refresh();
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04);
  }
}
