import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../config.js';
import { RainField } from '../systems/Weather.js';
import { Save } from '../systems/SaveSystem.js';
import { audio } from '../systems/AudioSystem.js';
import { FONT, makeButton } from '../ui/widgets.js';
import { openSettings } from '../ui/SettingsPanel.js';
import { bind, tr, trf, isMy, getLang, setLang, onLang, LANG_NAME } from '../systems/Lang.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    audio.init();
    audio.stopAll();
    this.sel = 0; this.t = 0;
    // Layered title art (480x270 native pixels, drawn at x2 with nearest filtering)
    const layer = (k, y = 0, d = 0) => this.add.image(0, y, k).setOrigin(0).setScale(2).setDepth(d);
    layer('menu_sky', 0, 0); this.trees = layer('menu_trees', 0, 1); layer('menu_school', 0, 2).setTint(0x8088a8);   // the school is dimmer: it should loom, not glow layer('menu_ground', 440, 3);
    // Windows that flicker; one of them hides a figure
    this.windows = [];
    for (const [row, i] of [[0, 3], [1, 6], [0, 7], [1, 1]]) {
      const w = this.add.image(2 * (201 + i * 25), 2 * (151 + (row ? 36 : 0)), 'ui', 'win_lit').setOrigin(0).setScale(2).setDepth(4).setAlpha(0.0);
      this.windows.push(w);
    }
    this.windows[0].setAlpha(0.8); this.litWin = this.windows[0];
    // The title screen now uses the same pixel crawler as the game instead of
    // a smooth human ghost. It appears between the lit windows for a few
    // frames, then dissolves back into the rain.
    this.menuGhost = this.add.sprite(2 * (201 + 5 * 25) - 4, 2 * 151 + 56, 'ghost_crawler', 0)
      .setOrigin(0.5, 1).setScale(0.62).setDepth(5).setAlpha(0);
    this.menuGhost.play('crawler_idle_4');
    // Low ground fog drifting across the school + heavy vignette for a darker, moodier title
    this.fogA = this.add.tileSprite(0, 330, VIEW_W, 128, 'fog').setOrigin(0, 0.5).setDepth(6).setAlpha(0.55);
    this.fogB = this.add.tileSprite(0, 430, VIEW_W, 128, 'fog').setOrigin(0, 0.5).setDepth(7).setAlpha(0.4).setFlipX(true);
    this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setDepth(8).setAlpha(0.85);
    this.rain = new RainField(this, 130, 8);

    // Title: the game's name in the chosen language (the Burmese title is longer, so it is a little smaller)
    this.title = this.add.text(VIEW_W / 2, 110, '', { fontFamily: FONT, fontSize: '76px', color: '#f4f6ff', fontStyle: 'bold', stroke: '#6a0f1c', strokeThickness: 8 }).setOrigin(0.5).setDepth(9);
    bind(this.title, () => tr('THE LAST BELL'));
    this.fitTitle = () => this.title.setFontSize(isMy() ? '58px' : '76px');
    this.fitTitle(); { const off = onLang(this.fitTitle); this.events.once('shutdown', off); }
    this.title.setShadow(0, 0, '#b8434a', 18, true, true);

    const hasSave = Save.has();
    const defs = [
      ['Continue', () => this.start('continue'), hasSave],
      ['New Game', () => this.start('new'), true],
      ['Settings', () => { this.settings = openSettings(this, 40, () => { this.settings = null; }); }, true],
      ['Controls', () => this.toggleHelp(), true],
      [() => tr('Sound') + ': ' + tr(audio.muted ? 'Off' : 'On'), () => { audio.toggleMute(); this.btns[4].setLabel(() => tr('Sound') + ': ' + tr(audio.muted ? 'Off' : 'On')); }, true],
    ];
    this.btns = defs.map(([label, fn, enabled], i) => {
      const b = makeButton(this, 170, 236 + i * 52, 260, 46, label, fn, { depth: 10 });
      b.setEnabled(enabled); b.onHover = () => { this.sel = i; this.mark(); }; return b;
    });
    if (!hasSave) this.sel = 1;
    this.mark();

    this.help = this.add.container(0, 0).setDepth(30).setVisible(false);
    const HELP = ['CONTROLS', '', 'Move: WASD / Arrow keys   (touch: left-side stick)', 'Look: mouse (click the game first)  or  drag the right side', 'Run: Shift        Interact: E', 'Hide under desks: Space      Flashlight: F',
      'Throw chalk to distract it: G      Crouch (quiet): C', 'Inventory: I      Use battery: Q', 'Pause: Esc or P   Mute: M', '',
      'It hunts by SOUND. Walk or crouch. Running is loud.', '', 'Click or press any key to close'];
    this.helpText = bind(this.add.text(VIEW_W / 2, VIEW_H / 2, '', { fontFamily: FONT, fontSize: '22px', color: '#e6ecff', align: 'center', lineSpacing: 8, wordWrap: { width: VIEW_W - 120 } }).setOrigin(0.5), () => HELP.map(tr).join('\n'));
    this.help.add([this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.8).setOrigin(0), this.helpText]);
    this.help.add(this.add.zone(0, 0, VIEW_W, VIEW_H).setOrigin(0).setInteractive().on('pointerdown', () => this.toggleHelp()));

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1)); kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-W', () => this.move(-1)); kb.on('keydown-S', () => this.move(1));
    kb.on('keydown-ENTER', () => this.activate()); kb.on('keydown-SPACE', () => this.activate());
    kb.on('keydown-ESC', () => { if (this.help.visible) this.toggleHelp(); });
    kb.on('keydown-M', () => { audio.toggleMute(); this.btns[4].setLabel(() => tr('Sound') + ': ' + tr(audio.muted ? 'Off' : 'On')); });

    bind(this.add.text(VIEW_W / 2, VIEW_H - 46, '', { fontFamily: FONT, fontSize: '14px', color: '#8a8aa8', align: 'center', wordWrap: { width: VIEW_W - 80 } }).setOrigin(0.5).setDepth(9), 'Content note: bullying, loss and implied suicide (never shown). Horror themes.');
    bind(this.add.text(VIEW_W / 2, VIEW_H - 16, '', { fontFamily: FONT, fontSize: '13px', color: '#56628a', align: 'center', wordWrap: { width: VIEW_W - 80 } }).setOrigin(0.5).setDepth(9), 'Some friendships never end. Some spirits never leave.');

    // Language switch (top right): the whole game follows it - menus, HUD, story, notes, cutscenes and the signs in the 3D world.
    this.langBtns = ['en', 'my'].map((code, i) => {
      const b = makeButton(this, VIEW_W - 164 + i * 96, 34, 90, 36, () => LANG_NAME[code], () => { setLang(code); this.markLang(); }, { depth: 12, size: 16 });
      b.code = code; return b;
    });
    this.markLang();
    audio.loop('rain', 0.35);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  markLang() { this.langBtns.forEach((b) => b.setActive(b.code === getLang())); }
  mark() { this.btns.forEach((b, i) => b.setActive(i === this.sel)); }
  move(d) {
    if (this.help.visible || this.settings) return;
    for (let k = 0; k < this.btns.length; k++) {
      this.sel = (this.sel + d + this.btns.length) % this.btns.length;
      if (!this.btns[this.sel].disabled) break;
    }
    this.mark();
  }
  activate() {
    if (this.help.visible) { this.toggleHelp(); return; }
    const b = this.btns[this.sel]; if (b && !b.disabled) b.box.emit('pointerdown');
  }
  toggleHelp() { this.help.setVisible(!this.help.visible); }

  start(mode) {
    if (this.starting) return;
    this.starting = true;
    if (mode === 'new') Save.clear();
    audio.play('door', 0.8, 0.8);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, () => {
      if (mode === 'new') this.scene.start('Cutscene', { id: 'prologue', next: { scene: 'Cutscene', data: { id: 'disappearance', next: { scene: 'Game', data: { mode: 'new', afterPrologue: true } } } } });
      else this.scene.start('Game', { mode });
    });
  }

  update(time, delta) {
    this.rain.update(Math.min(delta, 50) / 1000);
    const f = 0.55 + 0.45 * Math.abs(Math.sin(time * 0.011)) * (Math.sin(time * 0.037) > -0.5 ? 1 : 0.15);
    this.litWin.setAlpha(0.85 * f);
    this.windows.slice(1).forEach((w, i) => w.setAlpha(Math.max(0, Math.sin(time * 0.0004 + i * 2.1) - 0.2) * 0.85 * (0.7 + 0.3 * f)));
    this.menuGhost.setAlpha(Math.max(0, Math.sin(time * 0.0007) - 0.55) * 1.55 * f);
    this.menuGhost.x = 648 + Math.round(Math.sin(time * 0.0011) * 2);
    this.trees.x = Math.round(Math.sin(time * 0.0005) * 1.5);
    this.fogA.tilePositionX += 9 * (Math.min(delta, 50) / 1000); this.fogB.tilePositionX += 5 * (Math.min(delta, 50) / 1000);
    // title glow breathes; a faint flicker like a failing bulb
    this.title.setAlpha(0.92 + 0.08 * Math.sin(time * 0.003) - (Math.sin(time * 0.041) > 0.96 ? 0.25 : 0));
    this.title.setShadow(0, 0, '#b8434a', 14 + 8 * Math.sin(time * 0.0025), true, true);
    if (Math.random() < 0.002) {   // lightning: a double flash, then thunder rolls in late
      this.cameras.main.flash(120, 200, 210, 255);
      this.time.delayedCall(170, () => this.cameras.main.flash(200, 170, 185, 255));
      this.time.delayedCall(600 + Math.random() * 700, () => audio.play('thunder', 0.4));
    }
  }
}
