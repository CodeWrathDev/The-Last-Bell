import Phaser from 'phaser';
import { VIEW_W, VIEW_H, CRAWLER } from '../config.js';
import { CUTSCENES } from '../data/cutscenes.js';
import { audio } from '../systems/AudioSystem.js';
import { Settings } from '../systems/Settings.js';
import { Save } from '../systems/SaveSystem.js';
import { FONT } from '../ui/widgets.js';
import { tr, pick, isMy, bind } from '../systems/Lang.js';

const SEEN_KEY = 'last-bell-seen-cutscenes';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
const markSeen = (id) => { try { const s = seen(); s.add(id); localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ } };
const FLOOR_Y = 430;

/** Runs a script from data/cutscenes.js on a small stage (layered title art, drawn rooms, sprite actors, Burmese subtitles).
 *  Used both standalone (prologue, ending) and as an overlay on the paused game (data.overlay = true). */
export class CutsceneScene extends Phaser.Scene {
  constructor() { super('Cutscene'); }

  init(data) {
    // Phaser re-uses this scene instance, so EVERY per-run flag must be reset here. (A stale `done = true` made finish() return
    // immediately, so the second cutscene in a row, 'The Missing Girl', could never end and the game froze.)
    this.cfg = data; this.def = CUTSCENES[data.id]; this.cancelled = false; this.skipped = false; this.done = false;
    this.deathReached = false; this.advancing = false; this.actors = {}; this.advance = null; this.hintOff = false;
  }

  create() {
    if (!this.def) { this.finish(); return; }
    this.bgLayer = this.add.container(0, 0).setDepth(0);
    this.stage = this.add.container(0, 0).setDepth(10);
    this.tintRect = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0).setOrigin(0).setDepth(40);
    this.fadeRect = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0).setDepth(50);
    this.subBox = this.add.container(0, 0).setDepth(60).setVisible(false);
    // v16: ONE subtitle line in the chosen language (it used to show Burmese and English together)
    this.subBg = this.add.rectangle(VIEW_W / 2, VIEW_H - 70, VIEW_W - 120, 112, 0x000000, 0.66).setOrigin(0.5);
    this.subWho = this.add.text(80, VIEW_H - 124, '', { fontFamily: FONT, fontSize: '14px', color: '#e8c46a' });
    this.subMy = this.add.text(VIEW_W / 2, VIEW_H - 70, '', { fontFamily: FONT, fontSize: '26px', color: '#f2f5ff', align: 'center', wordWrap: { width: VIEW_W - 180 } }).setOrigin(0.5, 0.5);
    this.subBox.add([this.subBg, this.subWho, this.subMy]);

    this.canSkip = !this.def.noSkip && seen().has(this.cfg.id);
    this.hint = this.add.text(VIEW_W - 24, 20, '', { fontFamily: FONT, fontSize: '14px', color: '#8a95b8' }).setOrigin(1, 0).setDepth(70);
    this.hintKey = this.canSkip ? 'Space: skip' : 'Space: continue';
    bind(this.hint, () => (this.hintOff ? '' : tr(this.hintKey)));
    const kb = this.input.keyboard;
    this.onKey = () => { if (this.canSkip && !this.advancing) this.skip(); else if (this.advance) this.advance(); };
    this.onEnter = () => this.advance?.(); this.onPointer = () => this.advance?.();
    kb.on('keydown-SPACE', this.onKey); kb.on('keydown-ENTER', this.onEnter);
    this.input.on('pointerdown', this.onPointer);
    this.events.once('shutdown', () => { this.cancelled = true; kb.off('keydown-SPACE', this.onKey); kb.off('keydown-ENTER', this.onEnter); this.input.off('pointerdown', this.onPointer); });
    this.run().catch((e) => { console.error(e); this.finish(); });
  }

  // ---------------------------------------------------------------- flow
  sleep(ms, canAdvance = false) {
    return new Promise((res) => {
      if (this.cancelled || this.skipped) return res();
      const t = this.time.delayedCall(ms, () => { this.advance = null; res(); });
      this.advance = canAdvance ? () => { t.remove(false); this.advance = null; res(); } : null;
    });
  }
  tween(cfg) { return new Promise((res) => { if (this.cancelled || this.skipped) return res(); this.tweens.add({ ...cfg, onComplete: () => res() }); }); }

  skip() { this.skipped = true; this.advance?.(); this.finish(); }

  async run() {
    const d = this.def;
    if (d.title) { await this.card(d.title); }
    for (const st of d.steps) { if (this.cancelled || this.skipped) return; await this.step(st); }
    this.finish();
  }

  async card(t) {
    this.fadeRect.setAlpha(1);
    // 'CHAPTER 1 — The Missing Girl': the tag on a small red line, the chapter name big, both in the chosen language
    const [tag, ...rest] = t.en.split(' — '), name = rest.length ? pick(rest.join(' — '), t.my) : pick(t.en, t.my);
    const a = this.add.text(VIEW_W / 2, VIEW_H / 2 - 30, rest.length ? tr(tag) : '', { fontFamily: FONT, fontSize: '22px', color: '#b8434a' }).setOrigin(0.5).setDepth(80).setAlpha(0);
    const b = this.add.text(VIEW_W / 2, VIEW_H / 2 + 20, name, { fontFamily: FONT, fontSize: '36px', color: '#f4f6ff', align: 'center', wordWrap: { width: VIEW_W - 140 } }).setOrigin(0.5).setDepth(80).setAlpha(0);
    await this.tween({ targets: [a, b], alpha: 1, duration: 700 });
    await this.sleep(1700);
    await this.tween({ targets: [a, b], alpha: 0, duration: 600 });
    a.destroy(); b.destroy();
  }

  finish() {
    if (this.done) return; this.done = true;
    markSeen(this.cfg.id);
    this.subBox?.setVisible(false);
    const fire = () => {
      audio.stopAll?.();
      if (this.cfg.overlay) { this.game.events.emit('cutscene:done', this.cfg.id, { skipped: this.skipped, death: this.deathReached }); this.scene.stop(); return; }
      const n = this.cfg.next || { scene: 'Menu', data: {} };
      this.scene.start(n.scene, n.data);
    };
    if (this.cfg.id === 'final_end') { try { Save.clear(); } catch { /* ignore */ } }
    if (this.fadeRect && !this.skipped) this.tweens.add({ targets: this.fadeRect, alpha: 1, duration: 400, onComplete: fire }); else fire();
  }

  // ---------------------------------------------------------------- step interpreter
  async step(s) {
    if (s.bg) return this.setBg(s.bg);
    if (s.fade) return this.tween({ targets: this.fadeRect, alpha: s.fade === 'in' ? 0 : 1, duration: s.ms ?? 500 });
    if (s.wait) return this.sleep(s.wait);
    if (s.actor) return this.addActor(s.actor);
    if (s.remove) { for (const id of s.remove) { this.actors[id]?.sp.destroy(); delete this.actors[id]; } return; }
    if (s.move) return this.moveActor(s.move);
    if (s.face) { const a = this.actors[s.face.id]; if (a) { a.face = s.face.dir; this.playIdle(a); } return; }
    if (s.anim) { const a = this.actors[s.anim.id]; if (a) a.sp.play(s.anim.key, true); return; }
    if (s.fadeActor) { const a = this.actors[s.fadeActor.id]; if (a) await this.tween({ targets: a.sp, alpha: s.fadeActor.a, duration: s.fadeActor.ms }); return; }
    if (s.say) return this.say(s.say);
    if (s.sfx) { audio.play(s.sfx, s.vol ?? 0.6); return; }
    if (s.music === 'fade_out') { audio.stopAll(); return; }
    if (s.shake) { this.cameras.main.shake(s.shake, 0.008); return; }
    if (s.flicker) return this.flicker(s.flicker);
    if (s.tint) return this.tween({ targets: this.tintRect, alpha: s.tint.a, duration: s.tint.ms }, this.tintRect.setFillStyle(s.tint.color, 1));
    if (s.zoom) { const a = this.actors[s.zoom.focus]; const cam = this.cameras.main; if (a) cam.pan(a.sp.x, a.sp.y - 40, s.zoom.ms, 'Sine.easeInOut'); cam.zoomTo(s.zoom.to, s.zoom.ms, 'Sine.easeInOut'); return this.sleep(s.zoom.ms); }
    if (s.transform) return this.transform(s.transform);
    if (s.death) { this.deathReached = true; this.cameras.main.setZoom(1); this.cameras.main.setScroll(0, 0); this.stage.removeAll(true); this.actors = {}; return; }
    if (s.bigtext) return this.bigText(s.bigtext);
    if (s.credits) return this.credits(s.credits);
  }

  setBg(name) {
    this.bgLayer.removeAll(true);
    this.cameras.main.setZoom(1); this.cameras.main.setScroll(0, 0);
    const L = (k, y = 0) => this.add.image(0, y, k).setOrigin(0).setScale(2);
    const R = (x, y, w, h, c, a = 1) => this.add.rectangle(x, y, w, h, c, a).setOrigin(0);
    const G = [];
    const art = (tint, wash) => { G.push(L('menu_sky'), L('menu_trees'), L('menu_school'), L('menu_ground', 440)); G.forEach((g) => g.setTint(tint)); if (wash) G.push(this.add.rectangle(0, 0, VIEW_W, VIEW_H, wash[0], wash[1]).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD)); };
    const room = (wall, floor, board, win) => {
      G.push(R(0, 0, VIEW_W, 330, wall), R(0, 330, VIEW_W, VIEW_H - 330, floor), R(250, 70, 460, 150, board), R(262, 82, 436, 126, 0x1c2a22));
      for (const wx of [60, 800]) { G.push(R(wx, 90, 100, 130, win)); G.push(R(wx + 48, 90, 4, 130, 0x222222)); G.push(R(wx, 150, 100, 4, 0x222222)); }
      for (let i = 0; i < 6; i++) { G.push(R(120 + i * 140, 420, 90, 12, 0x5a4026)); G.push(R(130 + i * 140, 432, 8, 60, 0x3a2a18)); G.push(R(190 + i * 140, 432, 8, 60, 0x3a2a18)); }
    };
    switch (name) {
      case 'day': art(0xffffff, [0xffe0a0, 0.55]); break;
      case 'day_dim': art(0xb0b0b0, [0xd0a070, 0.25]); break;
      case 'gate': art(0x3a4466); this.gateProps(G, 0x1a1e2a); break;
      case 'night_dark': art(0x222a40); break;
      case 'night_calm': art(0x445077, [0x302010, 0.2]); break;
      case 'gate_final': art(0x151a28); this.gateProps(G, 0x0c0e16); break;
      case 'classroom': room(0xd9c9a0, 0xa98a5a, 0x5a4026, 0xcfe8ff); break;
      case 'window_dusk': room(0xcaa070, 0x8a6a40, 0x5a4026, 0xff9a50); break;
      case 'classroom_old': room(0x6a6a60, 0x3e3a34, 0x3a3226, 0x607080); break;
      case 'assembly': {
        G.push(R(0, 0, VIEW_W, 330, 0x171525), R(0, 330, VIEW_W, VIEW_H - 330, 0x30243c));
        G.push(R(150, 60, 660, 150, 0x241d36), R(180, 210, 600, 42, 0x5a273f));
        for (let i = 0; i < 7; i++) G.push(R(110 + i * 110, 410, 74, 16, 0x47304c), R(120 + i * 110, 426, 8, 54, 0x281d2d));
        for (let i = 0; i < 6; i++) G.push(R(70 + i * 150, 92, 90, 10, 0x812f50));
        G.push(R(0, 0, VIEW_W, VIEW_H, 0x160b1f, 0.16)); break;
      }
      case 'basement': {
        G.push(R(0, 0, VIEW_W, 320, 0x11172a), R(0, 320, VIEW_W, VIEW_H - 320, 0x1b2430));
        for (let i = 0; i < 9; i++) G.push(R(50 + i * 110, 80, 12, 360, 0x283247));
        for (let i = 0; i < 5; i++) G.push(R(80 + i * 180, 260, 120, 18, 0x3b4659));
        G.push(R(0, 0, VIEW_W, VIEW_H, 0x06101c, 0.24)); break;
      }
      case 'rooftop': {
        G.push(R(0, 0, VIEW_W, 300, 0x0a1026), R(0, 300, VIEW_W, VIEW_H - 300, 0x252b47));
        for (let x = 30; x < VIEW_W; x += 34) G.push(R(x, 270, 8, 190, 0x66738e));
        G.push(R(0, 268, VIEW_W, 8, 0x66738e), R(0, 0, VIEW_W, VIEW_H, 0x081126, 0.18)); break;
      }
      case 'black': break;
      default: break;
    }
    this.bgLayer.add(G);
    // Story scenes get a small pixel-art atmosphere pass on top of the base
    // illustration: drifting fog, a dark vignette and scanline-like bands.
    // It keeps every story beat tied to the same rainy school world.
    if (name !== 'black' && name !== 'day') {
      const fog = this.add.tileSprite(0, 414, VIEW_W, 150, 'fog').setOrigin(0, 0.5).setAlpha(name === 'basement' ? 0.42 : 0.28).setDepth(4);
      const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, name === 'assembly' || name === 'night_dark' ? 0x110817 : 0x050912, 0.20).setOrigin(0).setDepth(5);
      const scan = this.add.graphics().setDepth(6).setAlpha(0.10);
      for (let y = 0; y < VIEW_H; y += 6) scan.lineStyle(1, 0x8da0c8, 0.22).lineBetween(0, y, VIEW_W, y);
      this.bgLayer.add([fog, shade, scan]);
    }
  }

  update(time, delta) {
    const dt = Math.min(delta || 16, 50) / 1000;
    const fog = this.bgLayer?.list?.find((o) => o.type === 'TileSprite');
    if (fog) fog.tilePositionX += 7 * dt;
  }
  gateProps(G, c) {
    for (let x = 80; x < VIEW_W - 80; x += 36) G.push(this.add.rectangle(x, 300, 8, 170, c).setOrigin(0));
    G.push(this.add.rectangle(80, 300, VIEW_W - 160, 8, c).setOrigin(0), this.add.rectangle(80, 440, VIEW_W - 160, 8, c).setOrigin(0));
    G.push(this.add.rectangle(VIEW_W / 2 - 90, 240, 16, 220, c).setOrigin(0), this.add.rectangle(VIEW_W / 2 + 74, 240, 16, 220, c).setOrigin(0));
  }

  // ---------------------------------------------------------------- actors
  addActor(a) {
    // Scripts can revisit a beat after a skip or a language change. Replacing
    // an existing id keeps one logical character mapped to one sprite.
    if (this.actors[a.id]?.sp) this.actors[a.id].sp.destroy();
    delete this.actors[a.id];
    const kind = a.kind;
    let sp;
    if (kind === 'boy' || kind === 'bully') {
      sp = this.add.sprite(a.x, a.y, 'player', 0).setOrigin(0.5, 1).setScale(4);
      if (kind === 'bully') sp.setTint(0xd8a0a0);
    } else if (kind === 'girl') sp = this.add.sprite(a.x, a.y, 'npc_girl', 0).setOrigin(0.5, 0.96).setScale(3.6);   // a normal schoolgirl until the twist
    else sp = this.add.sprite(a.x, a.y, 'ghost_crawler', 0).setOrigin(0.5, CRAWLER.ORIGIN_Y).setScale(4 * CRAWLER.SCALE);   // same size as the boy (also scale 4)
    if (a.alpha !== undefined) sp.setAlpha(a.alpha);
    const rec = { id: a.id, kind, sp, face: a.face || 'right', sit: !!a.sit };
    if (a.lie) { sp.setAngle(88); sp.y += 10; }
    if (a.sit) sp.y += 6;
    this.stage.add(sp); this.actors[a.id] = rec;
    this.playIdle(rec);
    return Promise.resolve();
  }
  playIdle(a) {
    if (a.kind === 'boy' || a.kind === 'bully') a.sp.play('player_idle_' + (a.face === 'left' ? 'left' : 'right'), true);
    else if (a.kind === 'girl') { a.sp.play('hgirl_idle', true); a.sp.setFlipX(a.face === 'left'); }
    else a.sp.play(a.face === 'left' ? 'crawler_crawl_l' : 'crawler_crawl_r', true);
  }
  async moveActor(m) {
    const a = this.actors[m.id]; if (!a) return;
    const dir = m.x < a.sp.x ? 'left' : 'right';
    a.face = dir;
    if (a.kind === 'boy' || a.kind === 'bully') a.sp.play('player_walk_' + dir, true);
    else if (a.kind === 'girl') { a.sp.play('hgirl_walk', true); a.sp.setFlipX(dir === 'left'); }
    else a.sp.play(dir === 'left' ? 'crawler_crawl_l' : 'crawler_crawl_r', true);
    if (!m.ms) { a.sp.x = m.x; this.playIdle(a); return; }
    await this.tween({ targets: a.sp, x: m.x, duration: m.ms, ease: 'Sine.easeInOut' });
    if (a.sp.scene) this.playIdle(a);
  }
  async transform(t) {
    const a = this.actors[t.id]; if (!a) return;
    const sp = a.sp; audio.play('whisper', 0.7, 0.6);
    for (let i = 0; i < 10; i++) { if (this.cancelled || this.skipped) return; sp.setAlpha(i % 2 ? 0.2 : 1); sp.x += (i % 2 ? 4 : -4); await this.sleep(t.ms / 12); }
    // the mask slips: for a beat she is the pale ghost girl, then she drops to the floor as the creature
    sp.setTexture('ghost_girl').setOrigin(0.5, 0.96).setAlpha(1).play('girl_chase', true); sp.setFlipX(a.face === 'left');
    audio.play('scare', 0.5, 1.4); this.cameras.main.shake(260, 0.01);
    await this.sleep(650);
    if (this.cancelled || this.skipped) return;
    sp.setTexture('ghost_crawler').setOrigin(0.5, CRAWLER.ORIGIN_Y).setScale(4 * CRAWLER.SCALE).setAlpha(1).setFlipX(false);
    sp.y += 6; a.kind = 'crawler'; sp.play(a.face === 'left' ? 'crawler_chase_l' : 'crawler_chase_r', true);
    audio.play('scare', 0.9, 0.7);
  }
  async flicker(ms) { const end = this.time.now + ms; while (this.time.now < end && !this.cancelled && !this.skipped) { this.tintRect.setFillStyle(0x000000, 1).setAlpha(Math.random() < 0.5 ? 0.75 : 0); await this.sleep(70 + Math.random() * 90); } this.tintRect.setAlpha(0); }

  // ---------------------------------------------------------------- text
  async say(l) {
    const who = { boy: '', girl: '', narr: '', bully: '' };
    void who;
    const show = Settings.get('subtitles') !== false;
    this.subBox.setVisible(show);
    this.subWho.setText(l.who === 'narr' ? '' : l.who === 'girl' ? '' : '');
    const line = pick(l.en, l.my);
    this.subMy.setText(line);
    this.subMy.setColor(l.who === 'girl' ? '#fff0f8' : l.who === 'narr' ? '#c8d0ec' : '#f2f5ff');
    if (l.who === 'girl') audio.play('girl_call', 0.18, 1.2, { ch: 'voice' });
    await this.sleep(1700 + line.length * 45, true);
    this.subBox.setVisible(false);
  }
  async bigText(b) {
    const size = isMy() ? Math.round(b.size * 0.72) : b.size;
    const my = this.add.text(VIEW_W / 2, VIEW_H / 2, tr(b.text), { fontFamily: FONT, fontSize: size + 'px', color: b.color, align: 'center', wordWrap: { width: VIEW_W - 160 }, fontStyle: 'bold' }).setOrigin(0.5).setDepth(90).setAlpha(0);
    const sub = b.sub ? this.add.text(VIEW_W / 2, VIEW_H / 2 + size, tr(b.sub), { fontFamily: FONT, fontSize: '22px', color: '#b8434a' }).setOrigin(0.5).setDepth(90).setAlpha(0) : null;
    this.fadeRect.setAlpha(1);
    const all = sub ? [my, sub] : [my];
    await this.tween({ targets: all, alpha: 1, duration: 900 });
    await this.sleep(b.ms);
    await this.tween({ targets: all, alpha: 0, duration: 800 });
    my.destroy(); sub?.destroy();
  }
  async credits(lines) {
    const t = this.add.text(VIEW_W / 2, VIEW_H + 20, lines.map(tr).join('\n'), { fontFamily: FONT, fontSize: '24px', color: '#cfd8ff', align: 'center', lineSpacing: 12 }).setOrigin(0.5, 0).setDepth(90);
    this.hintOff = true; this.hint.setText('');
    await this.tween({ targets: t, y: -t.height - 20, duration: 16000, ease: 'Linear' });
    t.destroy();
  }
}
