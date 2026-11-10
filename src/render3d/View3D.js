import { Settings } from '../systems/Settings.js';
import Phaser from 'phaser';
import { TILE, CRAWLER } from '../config.js';
import { tex } from '../assets/Loader.js';
import { FONT } from '../ui/widgets.js';
import { Renderer3D } from './Renderer3D.js';
import { Rig3D, RIG, bestHeading } from './Rig3D.js';
import { angDiff } from '../systems/Collision.js';
import { drawHide, drawHands, drawCross } from './FpOverlay.js';
import { touch } from '../systems/Controls.js';
import { tr } from '../systems/Lang.js';
import { spawnHeading } from './mapView.js';
import { Pix, Tileset } from './Pix.js';
import { pixFromImage, textPix, signPix } from './DomAssets.js';
import { flashFlicker } from '../systems/FlashFlicker.js';

const VW = 480, VH = 270;                 // internal resolution: exactly half of the 960x540 game view, so every pixel is a clean 2x2
const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const flick = (t, ph) => 0.55 + 0.45 * Math.abs(Math.sin(t * 0.011 + ph)) * (Math.sin(t * 0.037 + ph * 3) > -0.6 ? 1 : 0.2);

/**
 * Phaser-side adapter for the perspective renderer (v43: FIRST PERSON, see RIG.FIRST_PERSON in Rig3D.js). It owns a 480x270 canvas texture that is drawn 2x
 * (nearest-neighbour) over the whole game view, feeds the renderer from the live game state (player, ghost, lamps,
 * pickups) and moves the third-person camera. The game logic itself (movement, collision, AI) is unchanged.
 */
export class View3D {
  constructor(scene) {
    this.scene = scene;
    this.r = new Renderer3D(VW, VH, RIG.FIRST_PERSON ? { plane: 0.9, horizon: 0.5, camZ: RIG.EYE } : undefined);   // first person: wider field of view, level horizon
    this.rig = new Rig3D();
    const tm = scene.textures;
    this.canvasTex = tm.exists('view3d') ? tm.get('view3d') : tm.createCanvas('view3d', VW, VH);
    this.canvasTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ctx = this.canvasTex.context;
    this.imageData = new ImageData(new Uint8ClampedArray(this.r.px.buffer), VW, VH);
    // Depth 1000 sits above every 2D world object (fog 90, weather 110) but below the UI scene, which draws on top.
    this.img = scene.add.image(0, 0, 'view3d').setOrigin(0, 0).setScale(960 / VW).setDepth(1000);
    this.frames = new Map(); this.texts = new Map(); this.assets = null;
    this.wasMoving = false;
    this.ck = 0; this.hk = 0; this.dk = 0; this.hinted = false;
    // Desktop mouse look: click the game once to capture the mouse (pointer lock); Esc or opening a menu releases it.
    const canvas = scene.game.canvas, sens = () => Settings.get('sens') ?? 1;
    this.onMouse = (e) => {
      if (document.pointerLockElement !== canvas || scene.frozen) return;
      this.rig.lookBy((e.movementX || 0) * 0.0022 * sens(), (e.movementY || 0) * 0.2 * sens());
    };
    document.addEventListener('mousemove', this.onMouse);
    scene.input.on('pointerdown', (p) => {
      if (p.wasTouch || touch.enabled || scene.frozen || document.pointerLockElement === canvas) return;
      try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* the browser refused: click-drag still works */ }
    });
    // Fallback when the mouse is not captured: click-drag to look around.
    scene.input.on('pointermove', (p) => {
      if (!p.isDown || p.wasTouch || scene.frozen || document.pointerLockElement === canvas) return;
      this.rig.lookBy((p.x - p.prevPosition.x) * 0.0065 * sens(), (p.y - p.prevPosition.y) * 0.3 * sens());
    });
    scene.events.once('shutdown', () => {
      this.img.destroy(); document.removeEventListener('mousemove', this.onMouse);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    });
  }

  // ------------------------------------------------------------------ assets
  buildAssets() {
    const sc = this.scene, tilesImg = sc.textures.get('tiles').getSourceImage();
    const tiles = new Tileset(pixFromImage(tilesImg, 0, 0, tilesImg.width, tilesImg.height));
    this.assets = {
      tiles,
      sprite: (name) => { const [k, f] = tex(name); return this.frame(k, f); },
      text: (str, size, color, opts) => {
        const key = str + '|' + size + '|' + color + '|' + (opts ? JSON.stringify(opts) : '');
        if (!this.texts.has(key)) this.texts.set(key, textPix(str, size, color, FONT, opts));
        return this.texts.get(key);
      },
      sign: (spec) => {
        const key = 'sign|' + JSON.stringify(spec);
        if (!this.texts.has(key)) this.texts.set(key, signPix({ ...spec, family: FONT }));
        return this.texts.get(key);
      },
    };
  }

  /** Pixel buffer of one texture frame (atlas frame name or spritesheet index), cached. */
  frame(key, name) {
    const id = key + '|' + name;
    let p = this.frames.get(id);
    if (p === undefined) {
      const fr = this.scene.textures.getFrame(key, name);
      p = fr ? pixFromImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight) : null;
      this.frames.set(id, p);
    }
    return p;
  }

  // ------------------------------------------------------------------ map / camera
  blocked() { const r = this.r; return (x, y) => r.hAt(Math.floor(x), Math.floor(y)) >= RIG.CAM_BLOCK_H; }

  enterMap(map, spawnName, spawn, restored) {
    if (!this.assets) this.buildAssets();
    this.r.setMap(map, this.assets);
    const gs = this.scene, p = gs.player;
    const heading = restored != null ? restored : spawnName ? spawnHeading(gs.mapId, spawnName) : bestHeading(gs.grid, p.x / TILE, p.y / TILE);
    this.rig.snap(p.x / TILE, p.y / TILE, heading, this.blocked());
    p.facing3d = this.rig.heading;
    this.last = null;
    if (RIG.FIRST_PERSON && !this.hinted && !touch.enabled) { this.hinted = true; gs.time.delayedCall(1800, () => gs.toast?.(tr('Click the game to look with the mouse. Esc lets go.'))); }
  }

  /** The language changed: door plates, signboards and chalk are text baked into cached textures, so rebuild them. */
  refreshLang() { this.texts.clear(); if (this.scene.map && this.assets) this.r.setMap(this.scene.map, this.assets); }

  /** The map's structure changed (a door was unlocked). */
  mapChanged() { if (this.scene.map) this.r.setMap(this.scene.map, this.assets); }

  /** Camera-relative input -> world velocity for Player.update. Also advances the heading. */
  moveInput(dt, ctl) {
    const p = this.scene.player;
    if (ctl.turn) this.rig.turn(dt, ctl.turn * (Settings.get('sens') ?? 1));
    const fwd = -ctl.vy, strafe = ctl.vx;
    const v = Rig3D.move(this.rig.heading, fwd, strafe);
    p.speedMul = fwd < -0.1 ? RIG.BACK_SPEED : 1;
    p.facing3d = this.rig.heading;
    return v;
  }

  /** Where a world point lands on the 960x540 screen (used by UI effects). */
  screenOf(x, y, z = 0.6) {
    if (RIG.FIRST_PERSON && Math.hypot(x / TILE - this.rig.x, y / TILE - this.rig.y) < 0.8) return { x: 640, y: 470 };   // your own hands: bottom of the screen
    const q = this.r.project(x / TILE, y / TILE, z);
    return { x: q.sx * (960 / VW), y: q.sy * (540 / VH) };
  }

  // ------------------------------------------------------------------ frame
  step(dt, snap) {
    const gs = this.scene, p = gs.player, r = this.r, time = gs.time.now;
    if (!gs.map || !this.assets) return;
    const px = p.x / TILE, py = p.y / TILE;
    const cam = gs.cameras.main; cam.setZoom(1); cam.setScroll(0, 0);
    if (snap) this.rig.snap(px, py, this.rig.heading, this.blocked()); else this.rig.update(dt, px, py, this.blocked());
    const rig = this.rig, ui = gs.ui, FP = RIG.FIRST_PERSON;
    if (FP && gs.frozen && document.pointerLockElement === gs.game.canvas) document.exitPointerLock?.();   // menus and cutscenes need the cursor
    // caught: the head snaps toward the creature and you fall to the floor
    this.dk += ((gs.dead ? 1 : 0) - this.dk) * Math.min(1, dt * 3);
    if (FP && gs.dead && gs.ghost) { const gx = gs.ghost.sprite.x / TILE, gy = gs.ghost.sprite.y / TILE; rig.heading += angDiff(Math.atan2(gy - py, gx - px), rig.heading) * Math.min(1, dt * 6); rig.pitch *= 0.9; }

    // ---- lights
    const black = gs.blackout > 0 ? 0.12 : 1, lights = [];
    const tubeLamps = new Set(gs.tubes.map((t) => t.L));
    for (const L of gs.lamps) {
      const a = L.flicker ? flick(time, L.phase) : 1, i = (L.i ?? 1) * a * black;
      if (i <= 0) continue;
      lights.push({ x: (L.x + (tubeLamps.has(L) ? 16 : 0)) / TILE, y: L.y / TILE, r: (L.r / TILE) * 1.2, i, tint: L.tint != null ? hex(L.tint) : [0.81, 0.88, 1] });
    }
    lights.push({ x: px, y: py, r: 2.3, i: p.hidden ? 0.15 : 0.5, tint: [1, 0.95, 0.85] });
    const g = gs.ghost;
    // v16 dark theme: no red. The creature carries only a faint cold-violet glow (so you can still make it out) and a cloud of
    // black mist (drawn by the renderer) that swells while it hunts and billows out when it emerges from the dark.
    const mists = [];
    if (g && g.sprite.alpha > 0.05) {
      const au = g.aura ?? 0.5, gx = g.sprite.x / TILE, gy = g.sprite.y / TILE;
      lights.push({ x: gx, y: gy, r: 2.6 + 1.6 * au, i: 0.12 + 0.2 * au, tint: [0.34, 0.2, 0.6] });
      mists.push({ x: gx, y: gy, r: 3.2 + 1.6 * au + (g.mist || 0) * 1.4, i: Math.min(1, (g.mistBase ?? 0.55) * g.fade + 0.3 * au + (g.mist || 0) * 0.5) });
    }

    const flash = ui?.light ? ui.light.flash : 0;
    if (ui?.light && ui.light.flash > 0) ui.light.flash = Math.max(0, ui.light.flash - 0.04);
    // v16: darker world (outdoors 1.7 -> 1.05, indoors 1.15 -> 0.8): the dark has to be something you are afraid of
    const base = Math.max(0, (1 - (gs.meta.ambient ?? 0.85)) + flash) * (gs.meta.outdoor ? 1.05 : 0.8);
    const amb = { r: base * 0.9, g: base * 0.9, b: base * 1.2 };

    // ---- sprites
    const sprites = [], push = (s) => { const pix = s.sprite && s.sprite.frame && this.frame(s.sprite.texture.key, s.sprite.frame.name); if (pix) sprites.push({ ...s.o, pix }); };
    // SNEAKING lowers the body: the camera sinks and the player shrinks down (smoothly)
    this.ck = (this.ck ?? 0) + ((p.crouch && !p.hidden ? 1 : 0) - (this.ck ?? 0)) * 0.15;
    this.hk += ((p.hidden ? 1 : 0) - this.hk) * 0.14;
    if (!FP) push({ sprite: p.sprite, o: { x: px, y: py, z: 0, ox: p.sprite.originX, oy: p.sprite.originY, alpha: p.sprite.alpha, scale: 1 - 0.22 * this.ck, bright: 0.62, shadow: 0.42 } });   // first person: you do not see your own body
    if (g) push({ sprite: g.sprite, o: { x: g.sprite.x / TILE, y: g.sprite.y / TILE, z: 0, ox: g.sprite.originX, oy: g.sprite.originY, alpha: g.sprite.alpha, scale: CRAWLER.SCALE, bright: 0.3, glow: false, dark: 0.55, shadow: CRAWLER.SHADOW } });
    const cmp = gs.companion; if (cmp?.sprite?.scene) push({ sprite: cmp.sprite, o: { x: cmp.sprite.x / TILE, y: cmp.sprite.y / TILE, z: 0, ox: cmp.sprite.originX, oy: cmp.sprite.originY, alpha: 1, flip: cmp.sprite.flipX, bright: 0.7, shadow: 0.4 } });
    if (gs.app?.sp?.scene) { const a = gs.app.sp; push({ sprite: a, o: { x: a.x / TILE, y: a.y / TILE, z: 0, ox: a.originX, oy: a.originY, alpha: a.alpha, flip: a.flipX, bright: 0.5, glow: true } }); }
    for (const o of gs.objs) {
      if ((o.def.type !== 'pickup' && o.def.type !== 'note') || !o.sprite?.scene) continue;
      push({ sprite: o.sprite, o: { x: o.sprite.x / TILE, y: (o.baseY ?? o.sprite.y) / TILE, z: 0.5 + ((o.baseY ?? o.sprite.y) - o.sprite.y) / TILE, ox: 0.5, oy: 0.5, scale: 0.62, bright: 0.8, glow: true } });
    }

    const fixtures = gs.tubes.map((t) => ({ x: t.L.x + 16, y: t.L.y, on: t.on !== false }));
    // ---- camera: eyes at head height (sinks while sneaking, drops under the desk while hiding, hits the floor when caught)
    let camZ, bob;
    if (FP) {
      camZ = RIG.EYE - RIG.EYE_CROUCH * this.ck - (RIG.EYE - RIG.HIDE_EYE) * this.hk - 0.95 * this.dk;
      // head bob: one dip per footstep (steps are 0.26 s running, 0.4 s walking, 0.62 s sneaking)
      const amp = p.running ? 3.2 : p.crouching ? 1.2 : 2.2, fq = p.running ? 1.34 : p.crouching ? 0.85 : 1.31;
      bob = p.moving && !p.hidden ? Math.round(Math.abs(Math.sin(p.animT * fq)) * amp - amp / 2) : Math.round(Math.sin(time * 0.0013));
      bob += Math.round(rig.pitch);
    } else {
      camZ = r.camZ - 0.4 * (this.ck ?? 0);
      bob = p.moving ? Math.round(Math.sin(p.animT * (p.running ? 1.05 : 0.9)) * 1.2) : 0;
    }
    r.render(
      { x: rig.x, y: rig.y, yaw: rig.yaw, camZ, zoom: gs.zb || 1, bob },
      { time: time / 1000, lights, sprites, amb, fixtures, mists, sky: gs.blackout > 0 ? 0.5 : 1,
        flash: { on: p.flashOn && !p.hidden, boom: rig.boom, dim: (p.battery < 15 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 0.02)) : 1) * (p.flashDim ?? 1) * flashFlicker(time) } });
    if (FP) { drawHide(r, this.hk); drawHands(r, p, time, this.ck, this.dk); drawCross(r, p, gs.dead); }
    this.ctx.putImageData(this.imageData, 0, 0);
    this.canvasTex.refresh();
  }
}
