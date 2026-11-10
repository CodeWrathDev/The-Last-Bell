import Phaser from 'phaser';
import { VIEW_W, VIEW_H, TILE } from '../config.js';
import { T } from '../assets/TextureFactory.js';
import { SOLID } from '../maps/MapBuilder.js';
import { Lighting } from '../systems/Lighting.js';
import { RainField } from '../systems/Weather.js';
import { touch } from '../systems/Controls.js';
import { audio } from '../systems/AudioSystem.js';
import { ITEMS } from '../data/items.js';
import { chapterText, objectiveFor } from '../data/story.js';
import { tr, bind, onLang, isMy, digits, graphemes, getLang, setLang, LANG_NAME } from '../systems/Lang.js';
import { Settings } from '../systems/Settings.js';
import { openSettings } from '../ui/SettingsPanel.js';
import { FONT, makeButton } from '../ui/widgets.js';
import { tex } from '../assets/Loader.js';
import { MIC_STATUS_TEXT, MIC_SENS_MIN, MIC_SENS_MAX, MIC_SENS_STEP, micSens } from '../systems/MicInput.js';

const panel = (scene, x, y, w, h, d, frame = 'ui_panel') => scene.add.nineslice(x, y, 'ui', frame, w, h, 8, 8, 8, 8).setOrigin(0).setDepth(d);

const CONTROLS_LINES = [
  'CONTROLS',
  'Move: WASD / Arrow keys (touch: left stick)',
  'Look: mouse (click the game first) or drag the right side',
  'Run: Shift      Sneak (slow, quiet, body low): hold Ctrl or press C',
  'Turn: Left/Right arrows',
  'Interact: E      Hide / come out: Space (near desks)',
  'Throw chalk to distract it: G      Flashlight: F',
  'Inventory: I      Use battery: Q',
  'Pause: Esc / P      Mute: M',
  '',
  'It hunts by SOUND. Walk or crouch. Running is loud.',
  'You cannot fight it.',
  'Optional: enable Microphone in Settings so real noise attracts it (local analysis only).',
];
const controlsText = () => CONTROLS_LINES.map(tr).join('\n');

const txt = (scene, x, y, s, size = 16, color = '#e6ecff', extra = {}) =>
  scene.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, ...extra });

/** Static label: an English key (or () => string) that follows the language. */
const ltxt = (scene, x, y, key, size, color, extra) => bind(txt(scene, x, y, '', size, color, extra), key);

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  init(data) { this.gs = data.game; this.ready = false; }

  get modal() { return this.dlg.open || this.invOpen || this.pauseOpen || this.over; }

  create() {
    const gs = this.gs;
    gs.ui = this;
    this.dlg = { open: false, lines: [], i: 0, chars: 0, justOpened: false };
    this.invOpen = false; this.pauseOpen = false; this.over = false; this.invSel = 0; this.pauseSel = 0;

    this.light = new Lighting(this);
    this.rain = new RainField(this, 110, 2);
    this.vignette = this.add.image(0, 0, 'vignette_dark').setOrigin(0).setScale(2).setDepth(3).setAlpha(0);
    this.redRect = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xaa0000, 0).setOrigin(0).setDepth(4);
    this.whiteRect = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xffffff, 0).setOrigin(0).setDepth(4);
    // A rare, fast-moving silhouette crosses the whole view during ambient scares.
    this.shadowSweepRect = this.add.rectangle(-180, VIEW_H / 2, 220, VIEW_H * 1.55, 0x07030f, 0).setOrigin(0.5).setAngle(-10).setDepth(5);

    this.buildHud(); this.buildDialogue(); this.buildInventory(); this.buildPause(); this.buildGameOver(); this.buildBanner();
    // Touch controls: ONLY on real touch devices (phones/tablets, or a browser's touch emulation), never on a desktop with a mouse.
    // `?touch=1` forces them on, `?touch=0` forces them off. If a phone is missed by the checks, they appear on the first finger touch.
    const q = typeof location !== 'undefined' ? location.search : '';
    const realTouch = () => typeof window !== 'undefined' && ((navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window)
      && !!window.matchMedia?.('(pointer: coarse)').matches;
    const enableTouch = () => { if (this.touchBuilt) return; this.touchBuilt = true; touch.enabled = true; this.buildTouch(); };
    if (/[?&]touch=0/.test(q)) { /* forced off */ }
    else if (/[?&]touch=1/.test(q) || realTouch()) enableTouch();
    else {
      const first = (p) => { if (p.wasTouch) { this.input.off('pointerdown', first); enableTouch(); } };
      this.input.on('pointerdown', first);
      this.events.once('shutdown', () => this.input.off('pointerdown', first));
    }

    // keyboard (event-driven so presses are never missed or repeated)
    const kb = this.input.keyboard;
    const on = (k, fn) => kb.on('keydown-' + k, (e) => { if (!e.repeat) fn(e); });
    on('I', () => this.toggleInventory()); on('TAB', () => this.toggleInventory());
    on('ESC', () => { if (this.bigOpen) this.toggleBigMap(); else this.onEsc(); }); on('P', () => { if (!this.over) this.togglePause(); });
    on('M', () => this.toggleMute()); on('V', () => { if (!this.modal && !this.over) this.toggleMic(); }); on('N', () => this.toggleBigMap());
    on('Q', () => { if (this.invOpen) this.useSelected(); else if (!this.modal) this.toast(this.gs.useItem('battery')); });
    for (const k of ['E', 'SPACE', 'ENTER']) on(k, () => this.confirm());
    on('UP', () => this.nav(0, -1)); on('DOWN', () => this.nav(0, 1)); on('LEFT', () => this.nav(-1, 0)); on('RIGHT', () => this.nav(1, 0));
    on('W', () => this.nav(0, -1)); on('S', () => this.nav(0, 1)); on('A', () => this.nav(-1, 0)); on('D', () => this.nav(1, 0));

    this.events.once('shutdown', () => { this.touchBuilt = false; touch.enabled = false; touch.x = touch.y = 0; touch.run = false; if (gs.ui === this) gs.ui = null; });

    // The language can be switched from the pause menu / settings while playing: refresh everything that was built from text.
    const offLang = onLang(() => {
      gs.hint = '\u0000';                                // force the interaction hint to be rebuilt in the new language
      this.refreshObjective(); this.refreshInventory(); this.onMapLabels(); this.refreshPauseLabels();
      gs.view3d?.refreshLang?.();                       // door plates, signboards and chalk in the 3D world
    });
    this.events.once('shutdown', offLang);

    this.ready = true;
    this.onMap(); this.refreshObjective(); this.refreshInventory();
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    panel(this, 12, 8, 212, 72, 10);
    this.portrait = this.add.image(40, 44, 'ui', 'portrait').setDepth(11);
    this.hearts = [0].map((i) => this.add.image(84 + i * 22, 24, 'ui', 'ui_heart').setDepth(11));
    this.flashIcon = this.add.image(86, 53, 'ui', 'ui_flash').setDepth(11);
    this.add.image(100, 45, 'ui', 'ui_bar_frame').setOrigin(0).setDepth(11);
    this.batFill = this.add.image(102, 47, 'ui', 'ui_bar_green').setOrigin(0).setDepth(12);
    this.add.rectangle(102, 64, 100, 4, 0x05070f, 0.85).setOrigin(0).setDepth(11);
    this.stamFill = this.add.image(102, 64, 'ui', 'ui_bar_blue').setOrigin(0).setDepth(12);
    this.timeText = txt(this, VIEW_W / 2, 14, '', 18, '#cfd8ff', { stroke: '#05070f', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(11);
    this.locText = txt(this, VIEW_W / 2, 36, '', 13, '#8fa0cf', { stroke: '#05070f', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(11);

    // objective tracker
    this.objPanel = panel(this, 12, 86, 292, 60, 10);
    this.objTitle = txt(this, 20, 92, '', 14, '#e8c46a', { fontStyle: 'bold' }).setDepth(11);
    this.objBody = txt(this, 20, 112, '', 14, '#dfe6ff', { wordWrap: { width: 270 } }).setDepth(11);

    // NOISE + MIC meters (v41 redo). Left bar = the noise your body makes (walking, running, doors). Right bar = the microphone, with a white line
    // where your voice starts to count; MIC button turns it on/off; - and + change its sensitivity (how easily your voice fills the bar).
    this.mx = VIEW_W - 84; this.my = 148; this.mbarY = 192; this.mbarH = 120; this.noiseBX = this.mx + 10; this.micBX = this.mx + 48;
    this.micPanel = panel(this, this.mx, this.my, 76, 230, 10);
    this.micG = this.add.graphics().setDepth(12);
    this.micBtn = makeButton(this, this.mx + 38, this.my + 16, 64, 20, () => (Settings.get('microphone') ? 'MIC ON' : 'MIC OFF'), () => this.toggleMic(), { depth: 12, size: 11 });
    ltxt(this, this.noiseBX + 8, this.mbarY + this.mbarH + 4, 'NOISE', 8, '#cfd8ff', { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(12);
    ltxt(this, this.micBX + 8, this.mbarY + this.mbarH + 4, 'MIC', 8, '#cfd8ff', { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(12);
    this.micStatus = txt(this, this.mx + 38, this.mbarY + this.mbarH + 20, '', 9, '#9fb0d8', { align: 'center' }).setOrigin(0.5, 0).setDepth(12);
    this.micTag = txt(this, this.mx + 38, this.my + 34, '', 10, '#ffb0b0', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(12);
    const sensY = this.mbarY + this.mbarH + 50;
    this.sensMinus = makeButton(this, this.mx + 14, sensY, 22, 20, () => '-', () => this.changeMicSens(-MIC_SENS_STEP), { depth: 12, size: 14 });
    this.sensPlus = makeButton(this, this.mx + 62, sensY, 22, 20, () => '+', () => this.changeMicSens(MIC_SENS_STEP), { depth: 12, size: 14 });
    this.sensText = txt(this, this.mx + 38, sensY, '', 11, '#e8c46a', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(13);

    // minimap
    this.MINI_W = 156; this.MINI_H = 104;                      // v16: much smaller (was 264x184). The full map (N) is still there for the big picture.
    this.miniX = VIEW_W - this.MINI_W - 14; this.miniY = 24;
    this.miniFrame = panel(this, this.miniX - 6, this.miniY - 6, this.MINI_W + 12, this.MINI_H + 12, 10);
    this.miniFrame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleBigMap());
    ltxt(this, this.miniX + this.MINI_W / 2, this.miniY - 16, 'N  ·  full map', 12, '#cfd8ff').setOrigin(0.5).setDepth(11);
    this.miniImg = null; this.miniDot = this.add.graphics().setDepth(12);

    this.hintBg = panel(this, VIEW_W / 2 - 60, VIEW_H - 186, 120, 36, 10, 'ui_button').setVisible(false);
    this.hintText = txt(this, VIEW_W / 2, VIEW_H - 168, '', 20, '#ffffff', { stroke: '#05070f', strokeThickness: 5 }).setOrigin(0.5).setDepth(11);
    this.toastText = txt(this, VIEW_W / 2, 74, '', 16, '#ffe9a0', { stroke: '#05070f', strokeThickness: 4, align: 'center', wordWrap: { width: 560 } }).setOrigin(0.5, 0).setDepth(12).setAlpha(0);

    // small always-available buttons next to the minimap
    const mk = (x, label, fn) => {
      const b = this.add.nineslice(x, 38, 'ui', 'ui_button', 38, 34, 8, 8, 8, 8).setDepth(11).setInteractive({ useHandCursor: true });
      ltxt(this, x, 38, label, 14).setOrigin(0.5).setDepth(12);
      b.on('pointerdown', fn); b.on('pointerover', () => b.setTexture('ui', 'ui_button_active')); b.on('pointerout', () => b.setTexture('ui', 'ui_button'));
      return b;
    };
    mk(this.miniX - 34, 'II', () => { if (!this.over) this.togglePause(); });
    this.bagBtn = mk(this.miniX - 76, 'Bag', () => this.toggleInventory());
    mk(this.miniX - 118, 'Map', () => this.toggleBigMap());
  }

  refreshObjective() {
    const st = this.gs.story; if (!st) return;
    const ch = chapterText(st.chapter === 'ending' ? 'final' : st.chapter);
    this.objTitle.setText(`${ch.tag}${isMy() ? ' - ' : ': '}${ch.title}`);
    this.objBody.setText(objectiveFor(st));
    const h = 28 + this.objBody.height;
    this.objPanel.setSize(292, h + 8);
  }

  onMap() {
    const gs = this.gs, m = gs.map; if (!m) return;
    this.locText.setText(tr(m.meta.name));
    this.rain.setVisible(!!m.meta.outdoor && !this.gs.meta?.dry);
    // minimap texture (also used, scaled up, by the full-screen map)
    const s = Math.max(2, Math.min(Math.floor(this.MINI_W / m.w), Math.floor(this.MINI_H / m.h), 10));
    this.miniS = s;
    this.miniK = Math.min(1, this.MINI_W / (m.w * s), this.MINI_H / (m.h * s));   // the texture is drawn at full detail, then shrunk to fit the small frame
    if (this.textures.exists('minimap')) this.textures.remove('minimap');
    const ct = this.textures.createCanvas('minimap', m.w * s, m.h * s), c = ct.context;
    const col = (top) => {
      if (top === T.DOOR) return '#f0c85a';
      if (top === T.DOORLOCK) return '#c8454e';
      if ([T.ROOF, T.ROOFEDGE].includes(top)) return '#6a2c2e';
      if ([T.ROOFTIN, T.ROOFTINEDGE].includes(top)) return '#24584e';
      if ([T.WINDOW, T.WINDOWLIT, T.WINDOWBROKEN, T.WINDOWRAIN].includes(top)) return '#6f86b8';
      if ([T.WALL, T.WALLBASE, T.WALLSTAIN, T.WALLPEEL, T.WALLINT, T.WALLINTBASE, T.PILLAR].includes(top)) return '#a89c70';
      if ([T.TRUNK, T.BUSH, T.CANOPY].includes(top)) return '#1f5a34';
      if (top === T.BED) return '#3a2a1c';
      if (top === T.FENCE || top === T.GATE) return '#7a8498';
      if (SOLID.has(top)) return '#2b3250';
      if (top === T.GRASS || top === T.GRASS2) return '#244a32';
      if (top === T.PUDDLE) return '#2a4a7a';
      if ([T.PATH, T.PATHWET, T.PATHCRACK, T.PATHLEAF, T.PATHMOSS, T.DRAIN, T.STAIRS, T.COURT, T.COURTH, T.COURTV].includes(top)) return '#5a6688';
      return '#4a5878';
    };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const g = m.layers.ground[y][x], d = m.layers.deco[y][x];
      c.fillStyle = col(d >= 0 ? d : g); c.fillRect(x * s, y * s, s, s);
    }
    for (const o of m.objects || []) {                          // landmarks: pickups, notes, lockers... as small dots
      if (!['pickup', 'note', 'container', 'door', 'lockeddoor'].includes(o.type)) continue;
      c.fillStyle = o.type === 'door' ? '#ffe27a' : o.type === 'lockeddoor' ? '#ff6a6a' : '#9fe8ff';
      c.fillRect(Math.floor(o.x / TILE) * s, Math.floor(o.y / TILE) * s, s, s);
    }
    ct.refresh();
    this.miniImg?.destroy();
    this.miniImg = this.add.image(this.miniX + (this.MINI_W - m.w * s * this.miniK) / 2, this.miniY + (this.MINI_H - m.h * s * this.miniK) / 2, 'minimap').setOrigin(0).setScale(this.miniK).setDepth(11);
    this.miniFrame.setSize(this.MINI_W + 12, this.MINI_H + 12);
    if (this.bigOpen) { this.toggleBigMap(); this.toggleBigMap(); }
  }

  onMapLabels() { const m = this.gs.map; if (m) this.locText.setText(tr(m.meta.name)); if (this.bigOpen) { this.toggleBigMap(); this.toggleBigMap(); } }

  /** Full-screen map (N or the Map button): the same texture scaled to fill the screen, with a pulsing player marker. */
  toggleBigMap() {
    const gs = this.gs, m = gs.map; if (!m || this.over) return;
    if (this.bigOpen) { this.bigObjs?.forEach((o) => o.destroy()); this.bigObjs = null; this.bigOpen = false; return; }
    const k = Math.min((VIEW_W - 80) / (m.w * this.miniS), (VIEW_H - 120) / (m.h * this.miniS));
    const w = m.w * this.miniS * k, h = m.h * this.miniS * k, x0 = (VIEW_W - w) / 2, y0 = 78;
    const bg = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x03050a, 0.88).setOrigin(0).setDepth(60).setInteractive().on('pointerdown', () => this.toggleBigMap());
    const fr = panel(this, x0 - 10, y0 - 10, w + 20, h + 20, 61);
    const img = this.add.image(x0, y0, 'minimap').setOrigin(0).setScale(k).setDepth(62);
    const title = txt(this, VIEW_W / 2, 30, tr(m.meta.name || 'Map'), 28, '#f4f6ff', { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(63);
    const hint = txt(this, VIEW_W / 2, VIEW_H - 30, tr('N / Esc / click: close'), 14, '#9fb0d8').setOrigin(0.5).setDepth(63);
    this.bigDot = this.add.graphics().setDepth(64);
    this.bigGeom = { x0, y0, k };
    this.bigObjs = [bg, fr, img, title, hint, this.bigDot]; this.bigOpen = true;
  }

  toast(msg) {
    if (!msg) return;
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2200, duration: 600 });
  }
  setHint(t) {
    this.hintText.setText(t || '');
    this.hintBg.setVisible(!!t);
    if (t) { const w = this.hintText.width + 36; this.hintBg.setSize(w, 36).setPosition(VIEW_W / 2 - w / 2, VIEW_H - 186); }
  }

  /** An item flies from the player's feet into the Bag button. */
  collectFx(id) {
    const gs = this.gs, cam = gs.cameras.main, z = cam.zoom, p = gs.player;
    const wvx = cam.scrollX + VIEW_W / 2 - VIEW_W / (2 * z), wvy = cam.scrollY + VIEW_H / 2 - VIEW_H / (2 * z);
    const sp = gs.view3d ? gs.view3d.screenOf(p.x, p.y, 0.8) : null;
    const ic = this.add.image(sp ? sp.x : (p.x - wvx) * z, sp ? sp.y : (p.y - 24 - wvy) * z, ...tex(ITEMS[id]?.icon || 'item_note')).setDepth(26).setScale(2);
    this.tweens.add({ targets: ic, x: this.bagBtn.x, y: this.bagBtn.y, scale: 0.7, duration: 650, ease: 'Cubic.easeIn',
      onComplete: () => { ic.destroy(); this.tweens.add({ targets: this.bagBtn, scaleX: 1.25, scaleY: 1.25, duration: 90, yoyo: true }); audio.play('click', 0.3, 1.5); } });
  }

  flashRed() {
    this.redRect.setAlpha(0.45); this.tweens.add({ targets: this.redRect, alpha: 0, duration: 500 });
  }

  /** A narrow, soft-edged shadow sweeps across the screen, like something passing between the player and the light. */
  shadowSweep() {
    const s = this.shadowSweepRect; if (!s) return;
    this.tweens.killTweensOf(s);
    s.setPosition(-180, VIEW_H / 2).setAlpha(0);
    this.tweens.add({ targets: s, x: VIEW_W + 180, alpha: 0.34, duration: 560, hold: 90, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => s.setAlpha(0) });
  }
  lightning() {
    this.light.flash = 0.55;
    this.whiteRect.setAlpha(0.2); this.tweens.add({ targets: this.whiteRect, alpha: 0, duration: 260 });
    this.time.delayedCall(180, () => { this.light.flash = 0.4; });
  }

  // ---------------------------------------------------------------- chapter banner
  buildBanner() {
    this.banner = this.add.container(0, 0).setDepth(25).setAlpha(0);
    this.banner.add([
      this.add.rectangle(0, VIEW_H / 2 - 60, VIEW_W, 130, 0x000000, 0.7).setOrigin(0, 0),
    ]);
    this.bnTop = txt(this, VIEW_W / 2, VIEW_H / 2 - 36, '', 16, '#b8434a').setOrigin(0.5);
    this.bnEn = txt(this, VIEW_W / 2, VIEW_H / 2 + 8, '', 34, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
    this.banner.add([this.bnTop, this.bnEn]);
  }
  showChapter(id) {
    const c = chapterText(id); if (!c.title) return;
    this.bnTop.setText(c.tag); this.bnEn.setText(isMy() ? c.title : c.title.toUpperCase());
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, duration: 600, yoyo: true, hold: 2000 });
  }

  // ---------------------------------------------------------------- dialogue
  buildDialogue() {
    const y = VIEW_H - 156;   // v16: a little taller so Burmese lines (taller glyph stacks) fit
    this.dlgY = y; this.dlgH = 136;
    this.dlgZone = this.add.zone(0, 0, VIEW_W, VIEW_H).setOrigin(0).setDepth(19).setInteractive();
    this.dlgZone.input.enabled = false;
    this.dlgZone.on('pointerdown', () => this.confirm());
    this.dlgBox = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.dlgBox.add([
      panel(this, 40, y, VIEW_W - 80, 136, 20, 'ui_dialog'),
    ]);
    this.dlgFace = this.add.image(96, y + 68, 'ui', 'portrait');
    this.dlgBox.add(this.dlgFace);
    this.dlgText = txt(this, 142, y + 16, '', 19, '#f2f5ff', { wordWrap: { width: VIEW_W - 220 }, lineSpacing: 6 });
    this.dlgArrow = txt(this, VIEW_W - 70, y + 106, 'v', 18, '#e8c46a');
    this.dlgBox.add([this.dlgText, this.dlgArrow]);
  }
  /** Splits a translated text into pages that fit the dialogue box (Burmese needs more height per line than English). */
  paginate(text) {
    const t = this.dlgText;
    if (typeof t.getWrappedText !== 'function') return [text];
    t.setText(text);
    const rows = t.getWrappedText(text);
    if (!rows || rows.length < 2 || !t.height) return [text];
    const lineH = t.height / rows.length, per = Math.max(2, Math.floor((this.dlgH - 26) / lineH));
    if (rows.length <= per) return [text];
    const pages = [];
    for (let i = 0; i < rows.length; i += per) pages.push(rows.slice(i, i + per).join('\n'));
    return pages;
  }
  say(lines) {
    const src = (Array.isArray(lines) ? lines : [lines]).map((l) => tr(l));
    this.dlg.lines = src.flatMap((l) => this.paginate(l));
    this.dlg.i = 0; this.dlg.chars = 0; this.dlg.open = true; this.dlg.justOpened = true;
    this.dlgBox.setVisible(true); this.dlgZone.input.enabled = true; this.dlgText.setText('');
    this.dlgFace.setFrame(this.gs.threat > 0.5 ? 'portrait_scared' : 'portrait');
    audio.play('click', 0.25, 1.3);
  }
  closeDialogue() {
    this.dlg.open = false; this.dlgBox.setVisible(false); this.dlgZone.input.enabled = false;
  }

  // ---------------------------------------------------------------- inventory
  buildInventory() {
    const x0 = (VIEW_W - 560) / 2, y0 = 70;
    this.inv = this.add.container(0, 0).setDepth(22).setVisible(false);
    this.inv.add([
      this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0),
      panel(this, x0, y0, 560, 380, 22),
      ltxt(this, x0 + 20, y0 + 12, 'INVENTORY', 20, '#e8c46a', { fontStyle: 'bold' }),
      ltxt(this, x0 + 290, y0 + 12, 'NOTES FOUND', 20, '#e8c46a', { fontStyle: 'bold' }),
    ]);
    this.invDyn = [];
    this.invDesc = txt(this, x0 + 20, y0 + 270, '', 16, '#dfe6ff', { wordWrap: { width: 520 } });
    this.invNotes = txt(this, x0 + 290, y0 + 44, '', 13, '#bfc8e8', { wordWrap: { width: 255 }, lineSpacing: 4 });
    this.inv.add([this.invDesc, this.invNotes]);
    this.invUse = makeButton(this, x0 + 450, y0 + 340, 160, 36, 'Use (Q)', () => this.useSelected(), { depth: 23, size: 16 });
    this.invClose = makeButton(this, x0 + 110, y0 + 340, 160, 36, 'Close (I)', () => this.toggleInventory(), { depth: 23, size: 16 });
    this.invUse.setVisible(false); this.invClose.setVisible(false);
    this.invOrigin = { x: x0, y: y0 };
  }

  groupedItems() {
    const g = {};
    for (const id of this.gs.state.inv) g[id] = (g[id] || 0) + 1;
    return Object.entries(g).map(([id, n]) => ({ id, n }));
  }

  refreshInventory() {
    if (!this.invDyn) return;
    this.invDyn.forEach((o) => o.destroy()); this.invDyn = [];
    const items = this.groupedItems(), { x, y } = this.invOrigin;
    this.invSel = Math.min(this.invSel, Math.max(0, items.length - 1));
    items.forEach((it, i) => {
      const sx = x + 20 + (i % 4) * 68, sy = y + 46 + Math.floor(i / 4) * 68;
      const box = panel(this, sx, sy, 64, 64, 23, i === this.invSel ? 'ui_slot_sel' : 'ui_slot').setInteractive({ useHandCursor: true }).setVisible(this.invOpen);
      box.on('pointerdown', () => { this.invSel = i; this.refreshInventory(); });
      const ic = this.add.image(sx + 32, sy + 32, ...tex(ITEMS[it.id]?.icon || 'item_note')).setScale(2).setDepth(24).setVisible(this.invOpen);
      const n = it.n > 1 ? txt(this, sx + 58, sy + 44, 'x' + it.n, 13, '#fff').setOrigin(1, 0).setDepth(25).setVisible(this.invOpen) : null;
      this.invDyn.push(box, ic, ...(n ? [n] : []));
    });
    const sel = items[this.invSel];
    this.invDesc.setText(sel ? `${tr(ITEMS[sel.id]?.name)}\n${tr(ITEMS[sel.id]?.desc)}` : tr('Your pockets are empty.'));
    this.invUse.setVisible(this.invOpen && !!sel && !!ITEMS[sel?.id]?.usable);
    const notes = this.gs.state.notes;
    this.invNotes.setText(notes.length ? notes.slice(-6).map((n) => { const t = tr(n), g = graphemes(t); return '- ' + (g.length > 70 ? g.slice(0, 68).join('') + '...' : t); }).join('\n') : tr('No notes yet.'));
  }

  toggleInventory() {
    if (this.dlg.open || this.pauseOpen || this.over) return;
    this.invOpen = !this.invOpen;
    this.inv.setVisible(this.invOpen); this.invClose.setVisible(this.invOpen);
    this.refreshInventory();
    audio.play('click', 0.3);
  }
  useSelected() {
    const it = this.groupedItems()[this.invSel];
    if (!it || !ITEMS[it.id]?.usable) { this.toast(tr('That cannot be used.')); return; }
    this.toast(this.gs.useItem(it.id)); this.refreshInventory();
  }

  // ---------------------------------------------------------------- pause
  buildPause() {
    this.pause = this.add.container(0, 0).setDepth(28).setVisible(false);
    this.pause.add([
      this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.7).setOrigin(0),
      panel(this, VIEW_W / 2 - 180, 24, 360, 492, 28),
      ltxt(this, VIEW_W / 2, 66, 'PAUSED', 34, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5),
    ]);
    const snd = () => tr('Sound') + ': ' + tr(audio.muted ? 'Off' : 'On');
    const lng = () => tr('Language') + ': ' + LANG_NAME[getLang()];
    const defs = [
      ['Resume', () => this.togglePause()],
      ['Save Game', () => { this.toast(tr(this.gs.saveGame() ? 'Game saved.' : 'Could not save (storage blocked).')); }],
      [snd, () => this.toggleMute()],
      [lng, () => setLang(getLang() === 'en' ? 'my' : 'en')],
      ['Settings', () => this.openSettingsPanel()],
      ['Controls', () => this.say(controlsText())],
      ['Main Menu', () => { this.gs.saveGame(); this.gs.quitToMenu(); }],
    ];
    this.pauseBtns = defs.map(([label, fn], i) => {
      const b = makeButton(this, VIEW_W / 2, 124 + i * 52, 290, 44, label, fn, { depth: 29 });
      b.onHover = () => { this.pauseSel = i; this.markPause(); };
      b.setVisible(false); return b;
    });
    this.SND_IDX = 2;
  }
  refreshPauseLabels() { /* pause buttons are bound labels: they re-render themselves */ }
  openSettingsPanel() {
    this.pauseBtns.forEach((b) => b.setVisible(false)); this.pause.setVisible(false);
    this.settingsUI = openSettings(this, 60, () => { this.settingsUI = null; this.pause.setVisible(this.pauseOpen); this.pauseBtns.forEach((b) => b.setVisible(this.pauseOpen)); });
  }

  /** Speech bubble line (the companion's Burmese dialogue). Respects the subtitle setting. */
  bubble(line) {
    if (Settings.get('subtitles') === false) return;
    this.bubbleObj?.destroy(); this.bubbleBg?.destroy();
    const t = txt(this, VIEW_W / 2, VIEW_H - 214, tr(line), 24, '#fff4fa', { align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5).setDepth(18);
    const bg = this.add.rectangle(t.x, t.y, t.width + 36, t.height + 18, 0x120a14, 0.72).setDepth(17);
    this.bubbleObj = t; this.bubbleBg = bg;
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 3200, duration: 600, onComplete: () => { t.destroy(); bg.destroy(); if (this.bubbleObj === t) { this.bubbleObj = null; this.bubbleBg = null; } } });
  }

  markPause() { this.pauseBtns.forEach((b, i) => b.setActive(i === this.pauseSel)); }
  togglePause() {
    if (this.dlg.open) return;
    if (this.invOpen) this.toggleInventory();
    this.pauseOpen = !this.pauseOpen;
    this.pause.setVisible(this.pauseOpen);
    this.pauseBtns.forEach((b) => b.setVisible(this.pauseOpen));
    this.pauseSel = 0; this.markPause();
  }
  toggleMute() {
    const m = audio.toggleMute();
    this.pauseBtns?.[this.SND_IDX]?.setLabel(() => tr('Sound') + ': ' + tr(audio.muted ? 'Off' : 'On'));
    this.toast(tr(m ? 'Sound off' : 'Sound on'));
  }
  onEsc() {
    if (this.dlg.open) { this.closeDialogue(); return; }
    if (this.invOpen) { this.toggleInventory(); return; }
    if (!this.over) this.togglePause();
  }

  // ---------------------------------------------------------------- game over
  buildGameOver() {
    this.goBox = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.goBox.add([
      this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x1a0006, 0.88).setOrigin(0),
      this.add.image(VIEW_W / 2, 66, 'ui', 'portrait_scared').setScale(2),
      ltxt(this, VIEW_W / 2, 160, 'YOU DID NOT ESCAPE', 44, '#d03a48', { fontStyle: 'bold' }).setOrigin(0.5),
    ]);
    this.goReason = txt(this, VIEW_W / 2, 245, '', 18, '#dfe6ff', { align: 'center', wordWrap: { width: 700 } }).setOrigin(0.5);
    this.goBox.add(this.goReason);
    this.goBtns = [
      makeButton(this, VIEW_W / 2, 330, 280, 46, 'Try Again', () => this.gs.retry(), { depth: 41 }),
      makeButton(this, VIEW_W / 2, 390, 280, 46, 'Main Menu', () => this.gs.quitToMenu(), { depth: 41 }),
    ];
    this.goBtns.forEach((b) => b.setVisible(false));
  }
  gameOver(reason) {
    this.over = true; this.goReason.setText(tr(reason || ''));
    this.goBox.setVisible(true); this.goBtns.forEach((b) => b.setVisible(true));
    this.goSel = 0; this.goBtns.forEach((b, i) => b.setActive(i === 0));
  }

  // ---------------------------------------------------------------- input routing
  confirm() {
    if (this.over) { this.goBtns[this.goSel || 0].box.emit('pointerdown'); return; }
    if (this.dlg.justOpened) return; // the same key press that opened it
    if (this.dlg.open) {
      const d = this.dlg;
      const n = graphemes(d.lines[d.i]).length;
      if (d.chars < n) { d.chars = n; return; }
      if (d.i < d.lines.length - 1) { d.i++; d.chars = 0; audio.play('click', 0.2, 1.3); } else this.closeDialogue();
      return;
    }
    if (this.pauseOpen) { this.pauseBtns[this.pauseSel].box.emit('pointerdown'); return; }
    if (this.invOpen) this.useSelected();
  }
  nav(dx, dy) {
    if (this.over) { this.goSel = ((this.goSel || 0) + (dx + dy) + 2) % 2; this.goBtns.forEach((b, i) => b.setActive(i === this.goSel)); return; }
    if (this.dlg.open) return;
    if (this.pauseOpen && dy) { this.pauseSel = (this.pauseSel + dy + this.pauseBtns.length) % this.pauseBtns.length; this.markPause(); return; }
    if (this.invOpen) {
      const n = this.groupedItems().length; if (!n) return;
      this.invSel = Phaser.Math.Clamp(this.invSel + dx + dy * 4, 0, n - 1); this.refreshInventory();
    }
  }

  // ---------------------------------------------------------------- touch controls
  buildTouch() {
    this.stick = { id: null, ox: 0, oy: 0 }; this.look = { id: null, x: 0, y: 0 };
    this.touchBtns = []; this.touchLit = [];
    this.stickBase = this.add.circle(0, 0, 58, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.35).setDepth(15).setVisible(false);
    this.stickKnob = this.add.circle(0, 0, 26, 0xffffff, 0.35).setDepth(16).setVisible(false);
    window.addEventListener('contextmenu', (e) => e.preventDefault());             // no long-press menu on phones
    const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch (e) { /* not supported */ } };
    // One round button. The finger target is 35% bigger than the drawn circle so a thumb never misses it. `lit()` = is its toggle on.
    const btn = (x, y, r, label, down, lit) => {
      const c = this.add.circle(x, y, r, 0x141a2e, 0.7).setStrokeStyle(3, 0x8fa0cf, 0.85).setDepth(15)
        .setInteractive(new Phaser.Geom.Circle(r, r, r * 1.35), Phaser.Geom.Circle.Contains);
      const lab = ltxt(this, x, y, label, r > 40 ? 22 : 16, '#ffffff').setOrigin(0.5).setDepth(16);
      c.on('pointerdown', () => { c.setFillStyle(0x2b3a6a, 0.9); buzz(); down(); });
      const rel = () => c.setFillStyle(lit?.() ? 0x3f5ea8 : 0x141a2e, lit?.() ? 0.9 : 0.7);
      c.on('pointerup', rel); c.on('pointerout', rel);
      if (lit) this.touchLit.push({ c, lit, rel });
      this.touchBtns.push(c, lab);
    };
    const R = VIEW_W, B = VIEW_H, pl = () => this.gs.player;
    // Right-thumb layout (bottom-right corner, nothing under the minimap / noise meter): big E in the corner, the rest in an arc around it.
    btn(R - 100, B - 100, 52, 'E', () => { touch.q.interact = true; });
    btn(R - 215, B - 62, 38, 'Light', () => { touch.q.flash = true; }, () => !!pl()?.flashOn);
    btn(R - 100, B - 225, 38, 'Run', () => { touch.run = !touch.run; }, () => touch.run);          // tap to toggle (a finger is free for E / camera)
    btn(R - 215, B - 168, 38, 'Hide', () => { touch.q.hide = true; });
    btn(R - 330, B - 62, 34, 'Sneak', () => { touch.q.crouch = true; }, () => !!pl()?.crouch);   // slow + quiet + body low (tap again to stand)
    btn(R - 330, B - 150, 34, 'Chalk', () => { touch.q.throw = true; });                          // throw chalk to distract it
    btn(R - 215, B - 268, 30, 'Batt', () => { if (!this.modal) this.toast(this.gs.useItem('battery')); });
    btn(R - 330, B - 238, 30, 'Snd', () => this.toggleMute());
    this.events.on('update', () => { for (const t of this.touchLit) t.rel(); });

    // Portrait phones shrink the 960x540 view a lot: grow the buttons so they stay tappable (they scale around their own centres).
    const fit = () => {
      const cv = this.game.canvas, w = cv?.clientWidth || window.innerWidth;
      const k = Phaser.Math.Clamp(34 / (w / VIEW_W * 30), 1, 1.6);   // aim for ~34 css px radius on the small buttons
      this.touchBtns.forEach((o) => o.setScale(k));
    };
    fit(); window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
    this.events.once('shutdown', () => { window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', fit); });

    // LEFT half = floating move stick (up/down walk, left/right strafe). RIGHT half (outside the buttons) = drag to look around.
    this.input.on('pointerdown', (p, over) => {
      if (this.modal || over.length || p.id === undefined) return;
      if (p.x <= VIEW_W * 0.5) {
        if (this.stick.id !== null) return;
        this.stick = { id: p.id, ox: p.x, oy: p.y };
        this.stickBase.setPosition(p.x, p.y).setVisible(true); this.stickKnob.setPosition(p.x, p.y).setVisible(true);
      } else if (this.look.id === null) this.look = { id: p.id, x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p) => {
      if (p.id === this.look.id) { const rig = this.gs.view3d?.rig; if (rig && !this.gs.frozen) rig.lookBy((p.x - this.look.x) * 0.0075 * (Settings.get('sens') ?? 1), (p.y - this.look.y) * 0.3 * (Settings.get('sens') ?? 1)); this.look.x = p.x; this.look.y = p.y; return; }
      if (p.id !== this.stick.id) return;
      const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy, d = Math.hypot(dx, dy), k = Math.min(d, 58) / (d || 1);
      this.stickKnob.setPosition(this.stick.ox + dx * k, this.stick.oy + dy * k);
      touch.x = d > 10 ? dx / Math.max(d, 30) : 0; touch.y = d > 10 ? dy / Math.max(d, 30) : 0;
      const m = Math.hypot(touch.x, touch.y); if (m > 1) { touch.x /= m; touch.y /= m; }
    });
    const end = (p) => {
      if (p.id === this.look.id) { this.look.id = null; return; }
      if (p.id !== this.stick.id) return;
      this.stick.id = null; touch.x = touch.y = 0; this.stickBase.setVisible(false); this.stickKnob.setVisible(false);
    };
    this.input.on('pointerup', end); this.input.on('pointerupoutside', end);
  }

  // ---------------------------------------------------------------- frame
  /** MIC button: the same setting as in the Settings menu. */
  toggleMic() {
    const on = !Settings.get('microphone'); Settings.set('microphone', on);
    this.toast(on ? tr('Microphone on - your voice is a noise too.') : tr('Microphone off.'));
  }
  /** - / + buttons: how easily your voice fills the MIC bar (and counts as a noise). */
  changeMicSens(d) {
    const v = Math.max(MIC_SENS_MIN, Math.min(MIC_SENS_MAX, Math.round((micSens() + d) * 100) / 100));
    Settings.set('micSens', v); this.toast(tr('Microphone sensitivity') + ': ' + v.toFixed(1) + 'x');
  }

  /** Left bar = how much noise YOU make (walking, running, sneaking, doors); the ghost hears the red zone from far away.
   *  Right bar = the microphone: the fill is your voice (above the room's own noise, times the sensitivity), the white line is where it starts to count. */
  drawMicMeter(mic) {
    const gs = this.gs, g = this.micG; g.clear();
    const y = this.mbarY, h = this.mbarH, w = 16, fh = (v) => Math.round(h * Math.max(0, Math.min(1, v)));
    // --- body noise
    const nx = this.noiseBX, lvl = Math.max(0, Math.min(1, gs.noiseShown ?? 0));
    this.noisePeak = Math.max(lvl, (this.noisePeak ?? 0) - this.game.loop.delta / 1000 * 0.25);
    const loud = lvl >= 0.6, mid = lvl >= 0.25;
    g.fillStyle(0x05070f, 0.9).fillRect(nx, y, w, h);
    g.fillStyle(loud ? 0xff4a3a : mid ? 0xe8c46a : 0x56d27a, 1).fillRect(nx, y + h - fh(lvl), w, fh(lvl));
    g.fillStyle(0xffffff, 0.8).fillRect(nx, y + h - fh(this.noisePeak) - 1, w, 2);
    g.fillStyle(0xff8a7a, 1).fillRect(nx - 2, y + h - fh(0.6) - 1, w + 4, 2);                  // "it hears you from far away" line
    // --- microphone
    const mx = this.micBX, on = Settings.get('microphone'), live = !!mic?.active && mic.status === 'listening', cal = !!mic?.active && mic.status === 'calibrating';
    const voice = mic?.active ? Math.min(1, mic.shown ?? 0) : 0, tl = mic?.active ? (mic.trig ?? 0.5) : 0.5;   // v44: dB volume meter + movable trigger line
    const ml = Math.max(voice, lvl);                                                           // v42: the MIC bar shows EVERYTHING the monster can hear: your voice AND walking, running, door slams
    this.micPeak = Math.max(ml, (this.micPeak ?? 0) - this.game.loop.delta / 1000 * 0.25);
    g.fillStyle(0x05070f, 0.9).fillRect(mx, y, w, h);
    g.fillStyle(ml >= 0.6 || (live && voice >= tl) ? 0xff4a3a : ml >= 0.25 ? 0xe8c46a : 0x56d27a, 1).fillRect(mx, y + h - fh(ml), w, fh(ml));
    g.fillStyle(0xffffff, 0.8).fillRect(mx, y + h - fh(this.micPeak) - 1, w, 2);
    if (cal && ml < 0.02) { const t = (mic.calT / 1.2) % 1; g.fillStyle(0xe8c46a, 0.9).fillRect(mx, y + h - fh(t * 0.5) - 1, w, 3); }   // measuring the room: a sweeping marker
    if (on) g.fillStyle(0xffffff, 0.9).fillRect(mx - 2, y + h - fh(tl) - 1, w + 4, 2);         // the line where your VOICE starts to count
    const col = !on ? 0x555a66 : live ? 0x56d27a : mic?.status === 'nosignal' ? 0xff3a3a : cal ? 0xe8c46a : 0xff6a5a;
    g.fillStyle(col, 1).fillCircle(this.mx + 38, y - 6, 3);                                    // status light
    const st = !on ? 'off' : (mic?.status ?? 'asking');
    this.micStatus.setText(tr(MIC_STATUS_TEXT[st] ?? 'ERROR')).setColor(live ? '#8fe0a8' : cal ? '#e8c46a' : on ? '#ff9a8a' : '#7a8296');
    this.sensText.setText(micSens().toFixed(1) + 'x');
    this.micTag.setText(loud || (live && voice >= tl) || ml >= 0.6 ? tr('LOUD!') : '');
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000, gs = this.gs, p = gs.player;
    if (!gs.map || !p) return;
    this.dlg.justOpened = false;

    // dialogue typewriter
    if (this.dlg.open) {
      const d = this.dlg, g = graphemes(d.lines[d.i] || '');
      d.chars = Math.min(g.length, d.chars + dt * 55);
      this.dlgText.setText(g.slice(0, Math.floor(d.chars)).join(''));
      this.dlgArrow.setVisible(d.chars >= g.length && Math.floor(time / 400) % 2 === 0);
    }

    // world overlays
    if (gs.view3d) this.light.img.setVisible(false); else this.light.render(gs, time);   // the perspective view does its own lighting
    if (gs.meta?.outdoor && !gs.meta.dry) this.rain.update(dt);

    // vignette follows ghost proximity
    const tv = gs.threat * (0.75 + 0.25 * Math.sin(time * 0.012 * (1 + gs.threat * 2)));
    // DREAD: while it hunts you, the screen edges close in and pulse red in time with the (accelerating) heartbeat
    const dv = gs.dread ?? 0, hbMs = 1000 / (1 + 0.9 * dv), hbPulse = Math.exp(-((time % hbMs) / hbMs) * 6);
    this.vignette.setAlpha(Math.max(0, tv, dv > 0.05 ? dv * (0.5 + 0.4 * hbPulse) : 0));
    if (dv > 0.05 && this.tweens.getTweensOf(this.redRect).length === 0) this.redRect.setAlpha(dv * 0.2 * hbPulse);

    this.drawMicMeter(gs.mic);

    // HUD
    const beat = p.hearts === 1 && Math.floor(time / 380) % 2 === 0;
    this.hearts.forEach((h, i) => h.setFrame(i < p.hearts ? (beat && i === 0 ? 'ui_heart_big' : 'ui_heart') : 'ui_heart_empty'));
    this.portrait.setFrame(gs.threat > 0.55 || p.invuln > 0 || p.act === 'fear' ? 'portrait_scared' : 'portrait');
    const b = p.battery / 100, low = b < 0.2;
    this.batFill.setFrame(b > 0.5 ? 'ui_bar_green' : low ? 'ui_bar_red' : 'ui_bar_amber').setVisible(b > 0.01).setDisplaySize(Math.max(1, 100 * b), 8)
      .setAlpha(low && Math.floor(time / 260) % 2 ? 0.45 : 1);
    this.flashIcon.setAlpha(p.flashOn ? 1 : 0.55).setTint(p.flashOn ? 0xfff0b0 : 0xffffff);
    this.stamFill.setFrame(p.exhausted ? 'ui_bar_red' : 'ui_bar_blue').setDisplaySize(Math.max(1, 100 * (p.stamina / 100)), 4);

    const mins = Math.floor(gs.state.minutes), tot = 21 * 60 + mins, hh = Math.floor(tot / 60) % 24, mm = tot % 60;
    const h12 = hh % 12 || 12, hm = `${h12}:${String(mm).padStart(2, '0')}`;
    // Myanmar clock: a day-part word, then the time in Myanmar digits (ည = night, မနက် = morning, ညနေ = evening)
    const part = hh >= 19 || hh < 4 ? 'ည' : hh < 12 ? 'မနက်' : hh < 17 ? 'နေ့' : 'ညနေ';
    this.timeText.setText(isMy() ? `${part} ${digits(hm)}` : `${hm} ${hh >= 12 ? 'PM' : 'AM'}`);

    // minimap dot
    const s = this.miniS || 3, m = gs.map, pulse = 1 + 0.25 * Math.sin(this.time.now / 180);
    const mk = s * (this.miniK || 1), ox = this.miniX + (this.MINI_W - m.w * mk) / 2, oy = this.miniY + (this.MINI_H - m.h * mk) / 2;
    this.miniDot.clear().fillStyle(0xffffff, 1).fillCircle(ox + (p.x / TILE) * mk, oy + (p.y / TILE) * mk, 3.2 * pulse).fillStyle(0xff3040, 1).fillCircle(ox + (p.x / TILE) * mk, oy + (p.y / TILE) * mk, 2.2);
    if (this.bigOpen && this.bigDot && this.bigGeom) {
      const { x0, y0, k } = this.bigGeom, bx = x0 + (p.x / TILE) * s * k, by = y0 + (p.y / TILE) * s * k;
      this.bigDot.clear().fillStyle(0xffffff, 1).fillCircle(bx, by, 9 * pulse).fillStyle(0xff3040, 1).fillCircle(bx, by, 6);
    }
  }
}
