import Phaser from 'phaser';
import { TILE, VIEW_W, VIEW_H, DEPTH, REACH } from '../config.js';
import { T } from '../assets/TextureFactory.js';
import { buildMap, MAP_BUILDERS } from '../maps/index.js';
import { Player } from '../entities/Player.js';
import { Ghost } from '../entities/Ghost.js';
import { Environment } from '../systems/Environment.js';
import { tex } from '../assets/Loader.js';
import { Controls } from '../systems/Controls.js';
import { Save } from '../systems/SaveSystem.js';
import { audio } from '../systems/AudioSystem.js';
import { ITEMS } from '../data/items.js';
import { intro, DAWN_ENFORCED, MINUTES_PER_SECOND } from '../data/story.js';
import { FINAL_LINES } from '../data/canon.js';
import { tr, isMy } from '../systems/Lang.js';
import { ChapterState } from '../systems/ChapterState.js';
import { ACTIONS } from '../maps/schoolGraph.js';
import { SoundBus } from '../systems/SoundBus.js';
import { AudioManager } from '../systems/AudioManager.js';
import { placeholderBackend, SURFACE_BY_MAP } from '../systems/AudioBackend.js';
import { Companion } from '../entities/Companion.js';
import { nearestFree, hasLOS } from '../systems/Collision.js';
import { Settings } from '../systems/Settings.js';
import { MicInput, MIC_STATUS_TEXT } from '../systems/MicInput.js';
import { FONT } from '../ui/widgets.js';
import { View3D } from '../render3d/View3D.js';

const HIDERS = new Set([T.DESK, T.DESK2, T.DESK3, T.READTABLE]);
const INTERACTIVE = new Set(['note', 'prop', 'pickup', 'container', 'lockeddoor', 'gate', 'action']);
const LABEL = { note: 'Read', prop: 'Examine', pickup: 'Pick up', container: 'Search', lockeddoor: 'Open', gate: 'Examine', action: 'Examine' };
const flick = (t, ph) => 0.55 + 0.45 * Math.abs(Math.sin(t * 0.011 + ph)) * (Math.sin(t * 0.037 + ph * 3) > -0.6 ? 1 : 0.2);

export const newState = () => ({
  v: 1, map: 'campus', x: null, y: null, inv: [], battery: 100, hearts: 1, stamina: 100,
  picked: {}, unlocked: {}, notes: [], objective: 'start', chapterShown: 0, minutes: 0, introDone: false, story: null,
  auditoriumIntroSeen: false, basementIntroSeen: false,
});

// v37 phantom scare tuning (distances in tiles, times in seconds)
const PHANTOM_NEAR = { lo: 1.0, hi: 2.0 };   // how close to you the phantom flashes in
const PHANTOM_SHOW = 0.8;                    // how long it stays there
const DREAD_GAP = { min: 2.0, max: 2.0 };    // quiet gap between the phantom vanishing and the real creature charging

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create(data = {}) {
    let saved = data.mode === 'continue' ? Save.load() : null;
    if (saved && !saved.story) saved = null; // saves from the old story are not compatible
    this.state = saved ? { ...newState(), ...saved } : newState();
    this.ui = null; this.lamps = []; this.glows = []; this.objs = []; this.disposables = [];
    this.hideSpots = []; this.ghost = null; this.meta = {}; this.grid = [[true]]; this.map = null;
    this.blackout = 0; this.zb = 1; this.threat = 0; this.transitioning = false; this.dead = false;
    this.ambientEventT = 28 + Math.random() * 24;
    this.doorCD = 0; this.ghostT = Infinity; this.scareT = 40 + Math.random() * 30; this.whisperT = 5;
    this.calmT = 0; this.hourIdx = Math.floor(this.state.minutes / 60); this.hint = null;
    // THE LAST BELL systems
    this.story = this.state.story ? ChapterState.from(this.state.story) : new ChapterState();
    if (data.afterPrologue && this.story.chapter === 'prologue') this.story.setFlag('prologue_done');
    this.state.story = this.story.toJSON();
    this.bus = new SoundBus(); this.audioMgr = new AudioManager(placeholderBackend);
    this.companion = null; this.cutsceneActive = false; this.throwCD = 0; this.surface = 'concrete'; this.finalStarted = false; this.finalPhase = null;
    this.mic = new MicInput(this.bus, () => ({ x: this.player.x, y: this.player.y }));
    this.micTried = !!Settings.get('microphone');
    if (Settings.get('microphone')) this.mic.start().then((ok) => { if (!ok && Settings.get('microphone')) this.toast(tr('Microphone unavailable. Keyboard noise only.') + ' (' + tr(MIC_STATUS_TEXT[this.mic.status] ?? 'ERROR') + ')'); });
    this.events.once('shutdown', () => this.mic.stop());
    this.quietT = 99;   // seconds since the player last made a noise
    this.bus.subscribe((e) => {
      if (Math.hypot(e.x - this.player.body.x, e.y - this.player.body.y) < 40) { this.quietT = 0; this.noiseKick = Math.max(this.noiseKick ?? 0, e.loudness ?? 0); }   // the player's OWN noise (a thrown chalk does not count)
      if (this.ghost) this.ghost.brain.hear(e); else this.noiseAccum(e);
      this.maybeEmerge(e);
      const l = this.companion?.brain.react(e); if (l) this.U((u) => u.bubble(l));
    });

    this.controls = new Controls(this);
    this.player = new Player(this);
    this.view3d = new View3D(this);   // third-person perspective renderer (draws over the 2D world, which keeps running for game logic)
    this.player.hearts = 1;   // ONE heart for the whole game (old saves with 3 hearts are clamped)
    this.player.battery = data.retry ? Math.max(25, this.state.battery) : this.state.battery;
    this.player.stamina = this.state.stamina;

    audio.init(); audio.preload();
    this.scene.launch('UI', { game: this });
    this.events.once('shutdown', () => {
      this.controls.destroy(); audio.stopAll();
      if (this.scene.isActive('UI') || this.scene.isPaused('UI')) this.scene.stop('UI');
    });

    const hasPos = saved && this.state.x != null;
    this.loadMap(this.state.map, 'start', hasPos ? { x: this.state.x, y: this.state.y } : null);
    if (!saved) {
      Save.write(this.snapshot());
      this.time.delayedCall(900, () => this.intro());
    } else this.state.introDone = true;
  }

  // ------------------------------------------------------------------ helpers
  get frozen() { return this.transitioning || this.dead || this.cutsceneActive || !!this.ui?.modal; }
  U(fn) { if (this.ui?.ready) fn(this.ui); }
  toast(t) { this.U((u) => u.toast(t)); }
  say(lines) { this.U((u) => u.say(lines)); }

  snapshot() {
    const p = this.player, s = this.state;
    return { ...s, story: this.story.toJSON(), map: this.mapId, h3: this.view3d ? +this.view3d.rig.heading.toFixed(3) : undefined, x: Math.round(p.x), y: Math.round(p.y), hearts: p.hearts, battery: p.battery, stamina: p.stamina };
  }
  saveGame() { if (this.finalPhase) return true; /* the final chase is never saved */ const ok = Save.write(this.snapshot()); return ok; }

  intro() {
    if (this.state.introDone) return;
    this.state.introDone = true;
    this.chapterCard();
    this.time.delayedCall(2800, () => { audio.play('door_slam', 0.6, 0.9); this.say(intro()); });
  }

  chapterCard() { this.U((u) => { u.refreshObjective(); u.showChapter(this.story.chapter === 'ending' ? 'final' : this.story.chapter); }); this.state.chapterShown = this.story.chapter; }
  setObjective() { this.U((u) => u.refreshObjective()); this.saveGame(); }

  // ------------------------------------------------------------------ story flow
  /** Set a story flag; handles the chapter change it may cause. */
  flag(f) {
    const next = this.story.setFlag(f);
    this.state.story = this.story.toJSON();
    this.U((u) => u.refreshObjective());
    if (next) this.onChapter(next);
    return next;
  }

  onChapter(ch) {
    this.meta = this.stateMeta(this.map.meta);
    this.chapterCard();
    if (ch === 'ch3') {
      if (this.ghost?.phantom) this.removeGhost();
      this.ghostT = 4;
    }
    this.saveGame();
  }

  /** Environmental state (1 day ... 5 final) applied on top of the map's own look. */
  stateMeta(base) {
    const ms = this.story.mapState, m = { ...base }, amb = base.ambient ?? 0.85;
    delete m.apparition; // only one monster in this game
    if (ms === 1) Object.assign(m, { ambient: 0.1, dry: true });
    else if (ms === 3) Object.assign(m, { ambient: Math.min(0.96, amb + 0.06), tint: [36, 6, 22] });
    else if (ms === 4) Object.assign(m, { ambient: Math.max(0.5, amb - 0.14), tint: [18, 14, 30] });
    else if (ms === 5) Object.assign(m, { ambient: 0.97, tint: [0, 0, 6] });
    return m;
  }

  /** Play a cutscene on top of the (frozen) game, then continue. */
  playCutscene(id, after) {
    if (this.cutsceneActive) return;
    this.cutsceneActive = true; this.player.flashOn = false;
    this.game.events.once('cutscene:done', () => { this.cutsceneActive = false; after?.(); });
    this.scene.launch('Cutscene', { id, overlay: true });
  }

  spawnCompanion(speak = false) {
    if (this.companion || !this.story.companionActive || !this.story.has('reunion')) return;
    const p = this.player, f = nearestFree(this.grid, Math.floor((p.x - 14) / TILE), Math.floor(p.y / TILE)) || { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE) };
    this.companion = this.track(new Companion(this, { x: f.tx * TILE + 16, y: f.ty * TILE + 16, grid: this.grid }));
    if (speak) this.time.delayedCall(1400, () => this.companion?.say('reunion', true));
    else this.time.delayedCall(2500, () => this.companion?.say(this.mapId === 'campus' ? 'exit' : 'route'));
  }

  doorReady(d) { return (!d.chapter || this.story.atLeast(d.chapter)) && (d.needsFlags || []).every((f) => this.story.has(f)); }

  doAction(o) {
    const d = o.def, key = this.mapId + ':' + d.id, A = ACTIONS.find((a) => a.id === d.id);
    if (d.chapter && !this.story.atLeast(d.chapter)) { this.say(tr('Nothing here seems important yet.')); return; }
    if (this.state.picked[key]) { this.say(tr(d.done || 'There is nothing more to find.')); return; }
    if ((A?.needs || []).some((f) => !this.story.has(f))) { this.say(tr(d.needHint || 'You are missing something.')); return; }
    const apply = () => {
      this.state.picked[key] = true;
      this.player.doAction('search', 0.8); audio.play('pickup', 0.6);
      this.bus.emit('pickup', this.player.x, this.player.y);
      if (d.item) this.addItem(d.item);
      if (d.text) this.say(tr(d.text) + (d.item ? `\n\n[${tr('Picked up')}: ${tr(ITEMS[d.item]?.name || d.item)}]` : ''));
      for (const f of [...(A?.gives || []), ...(d.gives || [])]) this.flag(f);
      if (d.id === 'reunion') this.spawnCompanion(true);
      this.saveGame();
    };
    if (d.cutscene) this.playCutscene(d.cutscene, apply); else apply();
  }

  /** Walking to the gate with the girl: the final chapter. The whole twist is played IN the game (no cutscene):
   *  bell -> "do you remember me?" -> the lights die -> she is the creature -> a real chase you cannot win -> the kill. */
  startFinal() {
    if (this.finalStarted) return; this.finalStarted = true;
    this.flag('gate_approach');   // -> chapter 'final' (chapter card + the last autosave happen here; the chase itself is never saved)
    this.story.finalStep = 'approach'; this.story.girlForm = 'human'; this.state.story = this.story.toJSON();
    this.runFinal();
  }

  runFinal() {
    const p = this.player, st = this.story, c = this.companion;
    const later = (ms, fn) => this.time.delayedCall(ms, () => { if (this.finalPhase !== 'death') fn(); });
    this.finalPhase = 'scripted'; this.cutsceneActive = true; p.flashOn = false; p.crouch = false;
    audio.stopAll();
    st.advanceFinal('bell'); audio.play('bell', 0.9);
    this.cameras.main.shake(500, 0.004); this.zoomPunch(1.05, 400);
    // she steps out of the dark right in front of you and walks up to face you
    const aim = p.aim ?? 0, cx = Math.cos(aim), cy = Math.sin(aim);
    let startD = 0;
    for (const d of [5, 4, 3, 2]) { const x = p.body.x + cx * d * TILE, y = p.body.y + cy * d * TILE; if (this.grid[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] === false && hasLOS(this.grid, x, y, p.body.x, p.body.y)) { startD = d * TILE; break; } }
    const endD = 40, sx = p.body.x + cx * (startD || endD), sy = p.body.y + cy * (startD || endD);
    if (c) {
      c.brain.sitting = true; c.brain.body.x = sx; c.brain.body.y = sy; c.sprite.setFlipX(cx < 0);
      this.time.delayedCall(60, () => { this.blackout = 0.15; });
      if (startD > endD) later(900, () => {
        c.sprite.anims.play('hgirl_walk', true);
        this.tweens.add({ targets: c.brain.body, x: p.body.x + cx * endD, y: p.body.y + cy * endD, duration: 2000, ease: 'Sine.easeInOut', onComplete: () => c.sprite.anims.play('hgirl_idle', true) });
      });
    }
    later(3400, () => {
      st.advanceFinal('turn');
      audio.play('girl_call', 0.5, 1.1);
      this.U((u) => u.bubble(FINAL_LINES.thanks));
    });
    // ...the lights die...
    later(6200, () => { audio.play('whisper', 0.8, 0.6); this.distort(900, 0.18); this.cameras.main.shake(900, 0.006); });
    for (let i = 0; i < 6; i++) later(6200 + i * 150, () => { this.blackout = i % 2 ? 0 : 1; });
    // ...and in one frame she is the creature, and it kills you.
    later(6900, () => this.finalTransform());
    later(7500, () => { this.blackout = 0; this.lunge(); });
  }

  /** The creature leaps the last step. */
  lunge() {
    const g = this.ghost, p = this.player; if (!g) { this.finalDeath(); return; }
    this.tweens.add({ targets: g.brain.body, x: p.body.x, y: p.body.y, duration: 220, ease: 'Quad.easeIn' });
    this.time.delayedCall(260, () => this.finalDeath());
  }

  finalTransform() {
    const p = this.player, st = this.story, c = this.companion;
    const at = c ? { x: c.brain.x, y: c.brain.y } : { x: p.body.x + 28, y: p.body.y };
    if (c) { c.destroy(); this.disposables = this.disposables.filter((d) => d !== c); this.companion = null; }
    st.advanceFinal('transform');   // girlForm -> 'crawler'
    this.ghost = new Ghost(this, { x: at.x, y: at.y, patrol: [], grid: this.grid });
    this.ghost.appear();            // there is no fade: the girl is simply gone and the creature is there
    this.ghost.brain.facing = Math.atan2(p.body.y - at.y, p.body.x - at.x);
    this.track(this.ghost);
    st.advanceFinal('attack');
    this.monsterVoice('mon_roar', 1); audio.play('scare', 0.9, 0.7);
    this.cameras.main.shake(500, 0.012); this.zoomPunch(1.08, 260);
    this.U((u) => { u.bubble(FINAL_LINES.plea); });
    this.blackout = 0;
  }

  /** She caught you. One heart, no second chance: straight into the ending. */
  finalDeath() {
    if (this.finalPhase === 'death') return; this.finalPhase = 'death';
    const p = this.player;
    this.dead = true; p.hearts = 0; p.die();
    this.distort(900, 0.3); this.zoomPunch(1.12, 300); this.cameras.main.shake(600, 0.02);
    this.U((u) => u.flashRed());
    audio.play('hurt', 1); audio.play('scare', 0.8); this.monsterVoice('mon_roar_eye', 1);
    try { this.story.advanceFinal('death'); } catch { /* already past it */ }
    this.time.delayedCall(2200, () => {
      audio.stopAll(); this.scene.stop('UI');
      this.scene.start('Cutscene', { id: 'final_end', next: { scene: 'Menu', data: {} } });
    });
  }

  has(id) { return this.state.inv.includes(id); }
  addItem(id) { this.state.inv.push(id); this.U((u) => { u.refreshInventory(); u.collectFx(id); }); }

  useItem(id) {
    const i = this.state.inv.indexOf(id);
    if (i < 0) return tr('You do not have that.');
    if (id === 'battery') {
      if (this.player.battery >= 99) return tr('The flashlight is already full.');
      this.state.inv.splice(i, 1);
      this.player.battery = Math.min(100, this.player.battery + 60);
      audio.play('unlock', 0.6);
      this.U((u) => u.refreshInventory());
      return tr('Flashlight recharged (+60%).');
    }
    return tr(ITEMS[id]?.desc) || tr('Nothing happens.');
  }

  // ------------------------------------------------------------------ map
  clearMap() {
    this.disposables.forEach((d) => d?.destroy && d.destroy());
    this.disposables = []; this.lamps = []; this.glows = []; this.objs = []; this.hideSpots = [];
    this.ghost = null; this.companion = null; this.patrolSpawned = false; this.canopy = null; this.tubes = []; this.sparkT = 0;
    this.env?.destroy(); this.env = null; this.app = null; this.appT = undefined;
  }
  track(o) { this.disposables.push(o); return o; }

  loadMap(id, spawnName, pos) {
    this.clearMap();
    const m = buildMap(id);
    this.map = m; this.mapId = id; this.meta = this.stateMeta(m.meta); this.surface = SURFACE_BY_MAP[id] || 'concrete';

    // Apply persistent unlocks before computing collision.
    for (const o of m.objects) {
      if (o.type === 'lockeddoor' && (this.state.unlocked[id + ':' + o.id] || this.doorReady(o))) this.openDoorDef(m, o);
    }
    this.grid = m.collisionGrid();

    const tm = this.track(this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: m.w, height: m.h }));
    const ts = tm.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layers = {};
    for (const [name, depth] of [['ground', DEPTH.GROUND], ['deco', DEPTH.DECOR], ['above', DEPTH.ABOVE]]) {
      const L = tm.createBlankLayer(name, ts, 0, 0, m.w, m.h);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const v = m.layers[name][y][x]; if (v >= 0) L.putTileAt(v, x, y); }
      L.setDepth(depth);
      if (name === 'above') L.setAlpha(0.85);
      this.layers[name] = L;
    }

    // Hiding places = desks / benches.
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (HIDERS.has(m.layers.deco[y][x])) this.hideSpots.push({ tx: x, ty: y, x: x * TILE + 16, y: y * TILE + 16 });
    }

    for (const def of m.objects) this.spawnObject(def);

    if (!this.view3d) { this.env = new Environment(this); this.env.build(m); if (this.quality !== undefined) this.applyQuality(); }

    // Player
    const sp = pos || m.spawns[spawnName] || m.spawns.start;
    this.player.hidden = false;
    this.player.setFeet(sp.x, sp.y);
    this.cameras.main.setZoom(this.view3d ? 1 : (m.meta.zoom || 1));
    if (this.view3d) {
      this.layers && Object.values(this.layers).forEach((L) => L.setVisible(false));
      this.disposables.forEach((d) => d?.setVisible && d.setVisible(false));   // the 2D world is hidden; the perspective view replaces it
      this.view3d.enterMap(m, pos ? null : spawnName, sp, pos ? this.state.h3 : undefined);
    }
    this.placeCamera(0, true);
    if (this.player.dead === false && this.zoomIn) { this.zb = 0.94; this.tweens.add({ targets: this, zb: 1, duration: 700, ease: 'Sine.easeOut' }); }
    this.zoomIn = true;
    this.doorCD = 0.9; this.blackout = 0; this.ambientEventT = 24 + Math.random() * 34;

    // Ghost spawns after a grace period.
    this.ghostT = m.meta.ghostPatrol
      ? this.story.chapter === 'ch3' ? Math.min(m.meta.ghostDelay ?? 15, 5) : (m.meta.ghostDelay ?? 15)
      : Infinity;

    // Ambience
    const ms = this.story.mapState;
    audio.loop('rain', this.meta.outdoor && !this.meta.dry ? 0.55 : ms === 1 ? 0 : 0.14);
    audio.loop('hum', this.meta.fluorescent ? (ms === 5 ? 0.08 : 0.3) : 0);
    audio.loop('heartbeat', ms === 5 ? 0.45 : 0);

    this.ui?.ready && this.ui.onMap();
    this.U((u) => u.refreshObjective());
    this.spawnCompanion(false);
    // Chapter 1: stepping into the hallway is the night arrival and the first transformation.
    if (id === 'hall' && this.story.chapter === 'ch1' && !this.story.has('transformed')) {
      this.time.delayedCall(500, () => this.playCutscene('night_arrival', () => this.flag('transformed')));
    }
    // Chapter 5: the first time they reach the courtyard together.
    if (id === 'campus' && this.story.chapter === 'ch5' && this.story.has('reunion') && !this.state.journeySeen) {
      this.state.journeySeen = true;
      this.time.delayedCall(700, () => this.playCutscene('journey'));
    }
    // Optional story wing: the school reveals a second history once the player follows the assembly plan.
    // These sequences are saved as one-shot state so re-entering the rooms never repeats them.
    if (id === 'auditorium' && this.story.atLeast('ch3') && !this.state.auditoriumIntroSeen) {
      this.state.auditoriumIntroSeen = true; this.saveGame();
      this.time.delayedCall(650, () => this.playCutscene('assembly_whisper'));
    }
    if (id === 'basement' && this.story.atLeast('ch4') && !this.state.basementIntroSeen) {
      this.state.basementIntroSeen = true; this.saveGame();
      this.time.delayedCall(650, () => this.playCutscene('bell_chamber'));
    }
  }

  openDoorDef(m, o) {
    o.type = 'door'; o.spawn = o.spawn || 'fromHall'; o.unlockedNow = true;
    for (let i = 0; i < Math.max(1, Math.round(o.w / TILE)); i++) m.set('deco', o.tileX + i, o.tileY, T.DOOR);
  }

  spawnObject(def) {
    const w = def.w ?? TILE, h = def.h ?? TILE;
    const key = this.mapId + ':' + def.id;
    const o = { def, rect: { x: def.x, y: def.y, w, h } };

    if (def.type === 'pickup' && this.state.picked[key]) return;
    if (def.type === 'canopy') {
      const bottom = def.y + 32, mk = (k, d) => this.track(this.add.image(def.x, bottom, k).setOrigin(0.5, 1).setDepth(d).setAlpha(0.96));
      o.layers = [mk('banyan_back', DEPTH.ABOVE + 1), mk('banyan_front', DEPTH.ABOVE + 1.1), mk('banyan_roots', DEPTH.ABOVE + 1.2)];
      o.sprite = o.layers[0]; this.canopy = o; return;
    }
    if (def.type === 'sign') {
      this.track(this.add.nineslice(def.x, def.y, 'ui', 'ui_dialog', def.bw + 10, def.bh + 6, 8, 8, 8, 8).setDepth(DEPTH.SIGN));
      this.track(this.add.text(def.x, def.y, def.text, { fontFamily: FONT, fontSize: (def.size || 16) + 'px', color: '#f0e6c8' }).setOrigin(0.5).setDepth(DEPTH.SIGN + 0.1));
      return;
    }
    if (def.type === 'decor') { this.spawnDecor(def); if (def.blocks) this.objs.push(o); return; }
    if (def.type === 'chalk') {
      def.lines.forEach((ln, i) => this.track(this.add.text(def.x, def.y + (i ? 12 : -4), ln, { fontFamily: FONT, fontSize: (i ? 8 : 11) + 'px', color: i ? '#e8d8d0' : '#dfe9dc' }).setOrigin(0.5).setAlpha(i ? 0.8 : 0.7).setDepth(DEPTH.DECOR + 0.7)));
      return;
    }
    if (def.type === 'light') {
      const L = this.addLamp(def.x, def.y, def.light, !!def.flicker, def.tint ?? 0xcfe0ff, def.glow ?? 0.1, def.intensity ?? 1);
      if (def.pulse) { L.pulse = true; L.i0 = L.i; }
      if (def.sway) { L.sway = def.sway; L.x0 = L.x; }   // a bulb swinging on its cord
      if (def.tube) { const t = this.track(this.add.image(def.tube[0] + 16, def.tube[1], ...tex('tube_on')).setOrigin(0.5, 0).setDepth(DEPTH.DECOR + 0.8)); this.tubes.push({ t, L }); }
      return;
    }
    if (def.type === 'lamp') {
      o.sprite = this.track(this.add.image(def.x + 16, def.y + 32, ...tex(def.sprite)).setOrigin(0.5, 1).setDepth(DEPTH.ENTITIES + (def.y + 32) / 1000));
      this.addLamp(def.x + 16, def.y + 32 - 52, def.light, !!def.flicker, 0xffd68a, 0.2);
      this.objs.push(o); return;
    }
    if (def.sprite && (def.type === 'pickup' || def.type === 'note')) {
      o.sprite = this.track(this.add.image(def.x + w / 2, def.y + h / 2, ...tex(def.sprite)).setDepth(DEPTH.PICKUP));
      o.baseY = o.sprite.y;
      o.lamp = this.addLamp(def.x + w / 2, def.y + h / 2, 36, false, 0xfff0b0, 0.16, 0.55);
    } else if (def.sprite) {
      o.sprite = this.track(this.add.image(def.x + 16, def.y + 32, ...tex(def.sprite)).setOrigin(def.ox ?? 0.5, 1).setDepth(DEPTH.ENTITIES + (def.y + 32) / 1000));
      if (def.sprite === 'flagpole') {   // the flag is its own animated sprite, hung from the pole's top
        const f = this.track(this.add.sprite(def.x + 18, def.y - 84, 'objects', 'flag_0').setOrigin(0, 0).setDepth(DEPTH.ABOVE - 1));
        f.play({ key: 'fx_flag', frameRate: 4 + Math.random() * 2 });
      }
    }
    if (def.type === 'container' && this.state.picked[key]) o.empty = true;
    this.objs.push(o);
  }

  addLamp(x, y, r, flicker, tint, glowAlpha, intensity = 1) {
    const L = { x, y, r, flicker, phase: Math.random() * 10, i: intensity, i0: intensity, tint };
    this.lamps.push(L);
    const img = this.track(this.add.image(x, y, 'light_radial').setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setDepth(DEPTH.GLOW).setScale((r * 2) / 128).setAlpha(glowAlpha));
    this.glows.push({ img, L, base: glowAlpha });
    return L;
  }

  spawnDecor(def) {
    const [k, f] = tex(def.sprite), cx = def.x + (def.w || 0) / 2, by = def.y + (def.h || 0);
    const sp = def.anim ? this.add.sprite(cx, by, k, f) : this.add.image(cx, by, k, f);
    sp.setOrigin(def.ox ?? 0.5, def.oy ?? 1);
    const depth = def.depth === 'above' ? DEPTH.ABOVE + 1 : def.depth === 'wall' ? DEPTH.DECOR + 0.5 : def.blocks ? DEPTH.ENTITIES + by / 1000 : DEPTH.PICKUP - 1;
    sp.setDepth(depth);
    if (def.rot) sp.setFlipX(def.rot < 0);
    if (def.alpha) sp.setAlpha(def.alpha);
    if (def.anim) sp.play({ key: def.anim, startFrame: (Math.random() * 4) | 0, frameRate: def.anim === 'fx_fan' ? 12 + Math.random() * 4 : 2 });
    this.track(sp);
    return sp;
  }

  /** Short pulse of barrel distortion on the camera (WebGL only), used for ghost encounters. */
  distort(ms = 420, amt = 0.16) {
    const cam = this.cameras.main;
    if (this.distortFx || this.game.renderer.type !== Phaser.WEBGL || !cam.postFX) return;
    try {
      const fx = this.distortFx = cam.postFX.addBarrel(1);
      this.tweens.addCounter({ from: 0, to: 1, duration: ms, yoyo: true, ease: 'Sine.easeInOut',
        onUpdate: (t) => { fx.amount = 1 + amt * t.getValue(); },
        onComplete: () => { cam.postFX.remove(fx); this.distortFx = null; } });
    } catch { this.distortFx = null; }
  }

  zoomPunch(f = 1.07, ms = 170) { this.tweens.add({ targets: this, zb: f, duration: ms, yoyo: true, ease: 'Sine.easeOut' }); }

  // ------------------------------------------------------------------ transitions
  changeMap(target, spawn) {
    if (this.transitioning) return;
    if (!MAP_BUILDERS[target]) {
      this.doorCD = 1.2;
      this.say(tr('The way is open, but the rest of the school is still being built. (Coming in the next version.)'));
      return;
    }
    const follow = !!(this.ghost && this.ghost.chasing && Math.hypot(this.ghost.brain.x - this.player.x, this.ghost.brain.y - this.player.y) < 8 * TILE);
    this.transitioning = true;
    audio.play(follow || this.player.running ? 'door_slam' : 'door', follow ? 1 : 0.9);   // creak when you walk, SLAM when you run or something is on your heels
    this.bus.emit('door', this.player.x, this.player.y);
    this.player.doAction('opendoor', 0.3);
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.time.delayedCall(260, () => {
      const from = this.mapId;
      this.player.flashOn = false; this.player.hideTile = null;
      this.loadMap(target, spawn);
      this.followDoor = follow && this.story.monsterActive;
      if (this.followDoor) this.ghostT = 2.2; // it heard the door and comes after you
      this.saveGame();
      this.cameras.main.fadeIn(280, 0, 0, 0);
      this.time.delayedCall(280, () => { this.transitioning = false; });
      void from;
    });
  }

  // ------------------------------------------------------------------ camera
  placeCamera(dt, snap = false) {
    if (this.view3d) { this.view3d.step(dt, snap); return; }
    const cam = this.cameras.main, mw = this.map.w * TILE, mh = this.map.h * TILE;
    cam.setZoom((this.meta.zoom || 1) * this.zb);
    const z = cam.zoom;
    const offX = VIEW_W / 2 - VIEW_W / (2 * z), offY = VIEW_H / 2 - VIEW_H / (2 * z);
    const lim = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Phaser.Math.Clamp(v, lo, hi));
    const tx = lim(this.player.x - VIEW_W / 2, -offX, mw - VIEW_W / z - offX);
    const ty = lim(this.player.y - 14 - VIEW_H / 2, -offY, mh - VIEW_H / z - offY);
    const k = snap ? 1 : 1 - Math.exp(-dt * 7);
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * k, cam.scrollY + (ty - cam.scrollY) * k);
  }

  // ------------------------------------------------------------------ gameplay
  nearestInteractable() {
    const p = this.player, cx = p.x, cy = p.y - 4;
    let best = null, bd = REACH;
    for (const o of this.objs) {
      if (!INTERACTIVE.has(o.def.type)) continue;
      const r = o.rect;
      const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  interact(o) {
    const d = o.def, key = this.mapId + ':' + d.id;
    audio.play('click', 0.4);
    switch (d.type) {
      case 'note':
        this.say(tr(d.text));
        if (!this.state.notes.includes(d.text)) {
          this.state.notes.push(d.text); this.U((u) => u.refreshInventory());
        }
        break;
      case 'prop': this.say(tr(d.text)); break;
      case 'gate': this.say(tr('The gate is chained shut with a heavy padlock. There must be another way out... or a key.')); break;
      case 'pickup': {
        this.state.picked[key] = true;
        this.player.doAction('pickup', 0.5);
        this.sparkle(o.sprite?.x ?? this.player.x, o.sprite?.y ?? this.player.y);
        this.addItem(d.id);
        audio.play('pickup', 0.7);
        o.sprite?.destroy(); o.lamp && (o.lamp.i = 0);
        this.objs = this.objs.filter((x) => x !== o);
        this.say(tr(d.text) + `\n\n[${tr('Picked up')}: ${tr(ITEMS[d.id]?.name || d.id)}]`);
        this.saveGame();
        break;
      }
      case 'container':
        if (o.empty) { this.say(tr(d.empty || 'Empty.')); break; }
        o.empty = true; this.state.picked[key] = true;
        this.player.doAction('search', 0.9);
        this.addItem(d.id); audio.play('pickup', 0.7);
        this.say(tr(d.text) + `\n\n[${tr('Picked up')}: ${tr(ITEMS[d.id]?.name || d.id)}]`);
        this.saveGame();
        break;
      case 'lockeddoor':
        if (this.doorReady(d)) {
          this.state.unlocked[key] = true;
          this.player.doAction('opendoor', 0.5);
          audio.play('unlock', 0.9); this.time.delayedCall(250, () => audio.play('door', 0.8));
          this.openDoorDef(this.map, d);
          for (let i = 0; i < Math.max(1, Math.round(d.w / TILE)); i++) this.layers.deco.putTileAt(T.DOOR, d.tileX + i, d.tileY);
          this.grid = this.map.collisionGrid();
          this.view3d?.mapChanged();
          this.bus.emit('door', this.player.x, this.player.y);
          this.say(tr('The lock gives way and the door swings open.'));
          this.saveGame();
        } else if (d.chapter && !this.story.atLeast(d.chapter)) this.say(tr('Not yet. Something else has to happen first.'));
        else this.say(tr(d.text) + '\n\n' + tr('(It will not budge.)'));
        break;
      case 'action': this.doAction(o); break;
      default: break;
    }
  }

  toggleFlash() {
    const p = this.player;
    if (p.hidden) { this.toast(tr('You cannot use the flashlight while hiding.')); return; }
    if (p.battery <= 0) { this.toast(tr('The battery is dead.')); audio.play('click', 0.3, 0.6); return; }
    p.flashOn = !p.flashOn; audio.play('click', 0.6);
    this.bus.emit('flashlight', p.x, p.y);
  }

  noise(x, y) { this.bus.emit('walk', x, y); }

  tryHide() {
    const p = this.player;
    if (p.hidden) { p.unhide(); audio.play('click', 0.4); return; }
    const s = p.findHideSpot(this.hideSpots);
    if (!s) { this.toast(tr('Nothing to hide under here.')); return; }
    p.hide(s); audio.play('click', 0.4);
    this.toast(tr('Hiding... hold still. Press Space to come out.'));
  }

  hurt() {
    const p = this.player;
    if (this.finalPhase === 'hunt') { this.finalDeath(); return; }   // the girl got you: the ending, not a normal game over
    if (p.invuln > 0 || this.dead) return;
    p.hearts -= 1; p.invuln = 2.5;
    if (p.hearts > 0) p.doAction('fear', 0.9);
    this.distort(380, 0.2); this.zoomPunch(1.06, 140);
    audio.play('hurt', 0.9); audio.play('scare', 0.6);
    this.cameras.main.shake(280, 0.012);
    this.U((u) => u.flashRed());
    if (this.ghost) this.ghost.brain.retreat(6);
    if (p.hearts <= 0) this.die(tr('The cold hands pulled you into the dark.'));
    this.calmT = 0;
  }

  die(reason) {
    this.dead = true; this.player.die();
    this.U((u) => u.gameOver(reason));
  }

  retry() {
    // UI is a separate overlay scene. Stop it first so its game-over buttons
    // cannot remain above the restarted game and steal the next click.
    if (this.scene.isActive('UI') || this.scene.isPaused('UI')) this.scene.stop('UI');
    this.scene.restart({ mode: Save.has() ? 'continue' : 'new', retry: true });
  }
  quitToMenu() {
    // Leaving Game while UI is still running used to leave an invisible input
    // layer over the Menu, which made Replay/Main Menu appear unclickable.
    if (this.scene.isActive('UI') || this.scene.isPaused('UI')) this.scene.stop('UI');
    audio.stopAll();
    this.scene.start('Menu');
  }

  updateAmbientEffects(dt) {
    if (this.frozen || this.dead || this.finalPhase || !this.map) return;
    this.ambientEventT = (this.ambientEventT ?? 30) - dt;
    if (this.ambientEventT > 0) return;
    this.ambientEventT = 42 + Math.random() * 78;
    const indoor = !this.meta.outdoor;
    const profile = this.meta.horrorProfile || (this.meta.outdoor ? 'rain' : 'school');
    const pool = profile === 'assembly'
      ? ['shadow', 'chair', 'light', 'bell']
      : profile === 'basement'
        ? ['shadow', 'pipe', 'light', 'door']
        : profile === 'rooftop'
          ? ['lightning', 'bell', 'shadow', 'rain']
          : indoor ? ['shadow', 'light', 'chair', 'door'] : ['lightning', 'shadow', 'rain'];
    const kind = pool[(Math.random() * pool.length) | 0];
    const p = this.player;
    const near = (min = 4, max = 10) => {
      const a = Math.random() * Math.PI * 2, r = (min + Math.random() * (max - min)) * TILE;
      return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
    };
    if (kind === 'shadow') {
      this.U((u) => u.shadowSweep?.());
      audio.play('whisper', 0.28, 0.7);
      this.distort(420, 0.045);
    } else if (kind === 'light') {
      const was = this.blackout; this.blackout = Math.max(this.blackout, 0.28);
      audio.play('fan_stop', 0.22, 0.8);
      this.time.delayedCall(180 + Math.random() * 260, () => { if (!this.dead) this.blackout = was; });
    } else if (kind === 'chair') {
      const q = near(4, 8); this.audioMgr.at('chair_move', q, { maxDist: 12 * TILE }); this.U((u) => u.shadowSweep?.());
    } else if (kind === 'door') {
      const q = near(5, 9); this.audioMgr.at('door', q, { maxDist: 14 * TILE });
      if (Math.random() < 0.45) this.time.delayedCall(1300, () => this.audioMgr.at('door_slam', q, { maxDist: 14 * TILE }));
    } else if (kind === 'pipe') {
      const q = near(3, 7); this.audioMgr.at('creak', q, { maxDist: 10 * TILE }); this.cameras.main.shake(120, 0.0025);
    } else if (kind === 'bell') {
      const q = near(7, 12); this.audioMgr.at('bell', q, { maxDist: 20 * TILE });
    } else if (kind === 'lightning') {
      this.U((u) => u.lightning()); this.time.delayedCall(500 + Math.random() * 800, () => audio.play('thunder', 0.45));
    } else if (kind === 'rain') {
      this.U((u) => u.shadowSweep?.()); this.audioMgr.at('rain', near(5, 12), { maxDist: 16 * TILE });
    }
  }

  scare() {
    const p = this.player, at = this.audioMgr;
    const rp = (min, max) => { const a = Math.random() * Math.PI * 2, r = (min + Math.random() * (max - min)) * TILE; return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }; };
    const pick = ['flicker', 'creak', 'steps', 'bell', 'whisper', 'chair', 'knock', 'lightdip', 'door', 'schoolbell', 'child'][Math.floor(Math.random() * 11)];
    if (pick === 'flicker') { this.blackout = 1.4; audio.play('whisper', 0.4); }
    else if (pick === 'creak') { audio.play('creak', 0.5, 0.8 + Math.random() * 0.3); this.cameras.main.shake(180, 0.004); }
    else if (pick === 'steps') for (let i = 0; i < 6; i++) this.time.delayedCall(i * 380, () => audio.play('step', 0.25 - i * 0.03, 0.7));
    else if (pick === 'bell') audio.play('bell', 0.35);
    else if (pick === 'chair') at.at('chair_move', rp(4, 8), { maxDist: 12 * TILE });          // a chair drags in an empty room
    else if (pick === 'knock') at.at('mon_knock', rp(5, 9), { channel: 'sfx', maxDist: 13 * TILE });
    else if (pick === 'lightdip') { this.blackout = 0.2; this.time.delayedCall(450, () => { this.blackout = 0.15; }); }   // the lights dip twice
    else if (pick === 'door') { const q = rp(5, 9); at.at('door', q, { maxDist: 14 * TILE }); if (Math.random() < 0.4) this.time.delayedCall(2200, () => at.at('door_slam', q, { maxDist: 14 * TILE })); } // a door slowly opens by itself
    else if (pick === 'schoolbell') { const q = rp(9, 13); for (let i = 0; i < 3; i++) this.time.delayedCall(i * 2300, () => at.at('bell', q, { maxDist: 22 * TILE })); this.blackout = 0.2; }   // the school bell rings in the empty school, at the wrong hour
    else if (pick === 'child') { const q = rp(6, 10); at.at('girl_call', q, { channel: 'voice', maxDist: 14 * TILE }); this.time.delayedCall(2600, () => at.at('girl_call', q, { channel: 'voice', maxDist: 14 * TILE })); }   // a child's voice from an empty classroom
    else audio.play('whisper', 0.5);
  }

  /** Drops visual extras if the frame rate stays low (and starts lower on phones). Never touches gameplay. */
  watchFps(dt) {
    if (this.quality === undefined) {
      const os = this.sys.game.device.os;
      const q = Settings.get('quality'); this.quality = q === 'low' ? 0 : q === 'high' ? 2 : ((os.android || os.iOS || os.iPad) ? 1 : 2); this.fpsT = 0; this.fpsN = 0; this.fpsSum = 0; this.applyQuality();
    }
    this.fpsT += dt; this.fpsN++; this.fpsSum += dt;
    if (this.fpsT < 3) return;
    const fps = this.fpsN / this.fpsSum; this.fpsT = 0; this.fpsN = 0; this.fpsSum = 0;
    if (fps < 48 && this.quality > 0) { this.quality--; this.applyQuality(); }
  }
  applyQuality() { this.env?.setQuality(this.quality); this.ui?.rain?.setQuality?.(this.quality); }

  sparkle(x, y) {
    const sp = this.add.sprite(x, y - 6, 'particles', 'sparkle_0').setDepth(DEPTH.ABOVE - 1);
    sp.play('fx_sparkle'); sp.once('animationcomplete', () => sp.destroy());
  }

  // ------------------------------------------------------------------ frame
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const ctl = this.controls.poll(); // always poll so presses never go stale
    const p = this.player;

    this.env?.update(dt);
    this.watchFps(dt);
    for (const g of this.glows) {
      if (g.L.sway) { g.L.x = g.L.x0 + Math.sin(time * 0.0016 + g.L.phase) * g.L.sway; g.img.x = Math.round(g.L.x); }
      if (g.L.pulse) g.L.i = g.L.i0 * (0.55 + 0.45 * Math.sin(time * 0.004));
      const a = g.base * (g.L.pulse ? g.L.i / g.L.i0 : 1) * (g.L.flicker ? flick(time, g.L.phase) : 1) * (this.blackout > 0 ? 0.1 : 1) * (g.L.i === 0 ? 0 : 1);
      g.img.setAlpha(a);
    }
    for (const tb of this.tubes) {
      if (tb.L.sway) tb.t.x = Math.round(tb.L.x + 16);
      const on = this.blackout <= 0 && (!tb.L.flicker || flick(time, tb.L.phase) > 0.5);
      if (on !== tb.on) { tb.on = on; tb.t.setFrame(on ? 'tube_on' : 'tube_dim'); }
    }
    for (const o of this.objs) if (o.baseY !== undefined && o.sprite?.scene) o.sprite.y = o.baseY + Math.sin(time * 0.004 + o.rect.x) * 2;
    if (this.canopy) {
      const c = this.canopy.def, inside = Math.abs(p.x - c.x) < 190 && p.y < c.y - 10 && p.y > c.y - 280;
      const [bk, fr, rt] = this.canopy.layers, tgt = inside ? 0.42 : 0.96;
      for (const L of this.canopy.layers) L.setAlpha(L.alpha + (tgt - L.alpha) * Math.min(1, dt * 6));
      const sw = (ph, a) => Math.round(Math.sin(time * 0.0007 + ph) * a);   // leaves and roots sway on different phases
      bk.x = c.x + sw(0, 1.4); fr.x = c.x + sw(1.7, 2.2); fr.y = c.y + 32 + sw(3, 1); rt.x = c.x + sw(2.4, 1.8);
    }

    this.sparkT -= dt;
    if (this.sparkT <= 0) { this.sparkT = 1.2 + Math.random() * 1.6; const c = this.objs.filter((q) => q.baseY !== undefined && q.sprite?.scene); if (c.length) { const q = c[(Math.random() * c.length) | 0]; this.sparkle(q.sprite.x + (Math.random() * 14 - 7), q.sprite.y - 4); } }
    if (this.frozen) { p.sync(); this.placeCamera(dt); this.updateThreat(); return; }

    // time
    this.state.minutes += dt * MINUTES_PER_SECOND;
    const hr = Math.floor(this.state.minutes / 60);
    if (hr !== this.hourIdx) { this.hourIdx = hr; audio.play('bell', 0.5); this.U((u) => u.toast(tr('The school bell tolls in the distance...'))); }
    if (DAWN_ENFORCED && this.state.minutes >= 540) { this.die(tr('Dawn broke, and you never left.')); return; }
    if (this.blackout > 0) this.blackout -= dt;

    // actions
    if (ctl.flash) this.toggleFlash();
    if (ctl.hide) this.tryHide();
    if (ctl.crouch) { p.crouch = !p.crouch; this.toast(tr(p.crouch ? 'Sneaking: slow and almost silent.' : 'Standing.')); }
    if (ctl.crouchHeld !== !!this.crouchHeldWas) { p.crouch = !!ctl.crouchHeld; this.crouchHeldWas = !!ctl.crouchHeld; }   // hold Ctrl to sneak
    if (ctl.run) p.crouch = false;
    this.throwCD -= dt;
    if (ctl.throw && this.throwCD <= 0 && !p.hidden) this.throwChalk();
    const near = this.nearestInteractable();
    if (ctl.interact && near && !p.hidden) this.interact(near);

    const mv = this.view3d ? this.view3d.moveInput(dt, ctl) : { vx: ctl.vx, vy: ctl.vy };
    p.update(dt, mv.vx, mv.vy, ctl.run, this.grid);
    if (p.batteryDied) { p.batteryDied = false; audio.play('click', 0.5, 0.6); this.toast(tr('The flashlight dies!')); }
    if (p.stepped) {
      const mode = p.crouching ? 'crouch' : p.running ? 'run' : 'walk';
      this.audioMgr.footstep(this.surface, mode, true);
      this.bus.emit(mode, p.x, p.y);
    }

    // doors
    this.doorCD -= dt;
    if (this.doorCD <= 0 && !p.hidden) {
      const box = { l: p.body.x - p.body.hw, r: p.body.x + p.body.hw, t: p.body.y - p.body.hh, b: p.body.y + p.body.hh };
      for (const o of this.objs) {
        if (o.def.type !== 'door') continue;
        const r = o.rect, e = 4;
        if (box.r > r.x - e && box.l < r.x + r.w + e && box.b > r.y - e && box.t < r.y + r.h + e) {
          if (o.def.chapter && !this.story.atLeast(o.def.chapter)) { this.toast(tr('The way is blocked. Not yet.')); this.doorCD = 1.6; break; }
          this.changeMap(o.def.target, o.def.spawn); break;
        }
      }
    }

    // hint
    let hint = null;
    if (p.hidden) hint = 'Space  ' + tr('Come out');
    else if (near) hint = `E  ${tr(near.def.type === 'container' && near.empty ? 'Examine' : LABEL[near.def.type])}`;
    else if (p.findHideSpot(this.hideSpots)) hint = 'Space  ' + tr('Hide');
    if (hint !== this.hint) { this.hint = hint; this.U((u) => u.setHint(hint)); }

    // ghost
    this.updateGhost(dt, time);
    if (this.companion) this.companion.update(dt, { px: p.x, py: p.y, playerMoving: p.moving });
    this.audioMgr.setListener(p.x, p.y, p.aim);
    this.bus.tick(dt); this.mic.update(dt, !this.frozen);
    // NOISE LEVEL (shown on the side meter): how loud you are right now. Sneaking is tiny, walking is low, running is high.
    { const tgt = p.hidden ? 0 : p.moving ? (p.running ? 0.85 : p.crouching ? 0.08 : 0.3) : 0;
      this.noise = (this.noise ?? 0) + (tgt - (this.noise ?? 0)) * Math.min(1, dt * (tgt > (this.noise ?? 0) ? 10 : 2.5));
      this.noiseKick = Math.max(0, (this.noiseKick ?? 0) - dt * 1.2);
      this.noiseShown = Math.max(this.noise, this.noiseKick); }
    // the Settings toggle takes effect immediately: start the mic when switched on, stop it when switched off
    const wantMic = !!Settings.get('microphone');
    if (wantMic && !this.mic.active && !this.micTried) { this.micTried = true; this.mic.start().then((ok) => { if (!ok && Settings.get('microphone')) this.toast(tr('Microphone unavailable. Keyboard noise only.') + ' (' + tr(MIC_STATUS_TEXT[this.mic.status] ?? 'ERROR') + ')'); }); }
    else if (!wantMic) { if (this.mic.active || this.mic.status !== 'off') this.mic.stop(); this.micTried = false; }
    this.audioMgr.update(dt, {
      chapter: this.story.chapter, monsterActive: this.story.monsterActive && !!this.ghost,
      monsterState: this.ghost?.state, monsterDist: this.ghost ? Math.hypot(this.ghost.brain.x - p.x, this.ghost.brain.y - p.y) : 1e9,
    });
    if (this.mapId === 'campus' && !this.finalStarted && ((this.story.chapter === 'ch5' && this.story.has('reunion') && p.y > TILE * 19) || this.story.chapter === 'final')) this.startFinal();

    // (no heart regeneration: you only have one)
    this.calmT += dt;

    // Timed environmental horror: visual events are sparse and map-sensitive so the school feels alive without becoming noise.
    this.updateAmbientEffects(dt);

    // random scares (never mid-chase)
    this.scareT -= dt;
    if (this.scareT <= 0) { this.scareT = 45 + Math.random() * 60; if (!this.ghost?.chasing && this.story.mapState >= 2 && this.story.mapState !== 4) this.scare(); }

    // thunder
    if (this.meta.outdoor && !this.meta.dry) {
      this.thunderT = (this.thunderT ?? 20 + Math.random() * 20) - dt;
      if (this.thunderT <= 0) { this.thunderT = 25 + Math.random() * 35; this.U((u) => u.lightning()); this.time.delayedCall(700 + Math.random() * 900, () => audio.play('thunder', 0.6)); }
    }

    this.placeCamera(dt);
  }

  /** Throw a piece of chalk ahead: it clatters where it lands and draws the creature (the only way to distract it). */
  throwChalk() {
    const p = this.player; this.throwCD = 4;
    let x = p.x, y = p.y - 6; const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    for (let d = 8; d <= 6 * TILE; d += 8) {
      const nx = p.x + dx * d, ny = p.y - 6 + dy * d;
      if (this.grid[Math.floor(ny / TILE)]?.[Math.floor(nx / TILE)] !== false) break;
      x = nx; y = ny;
    }
    this.player.doAction('pickup', 0.4);
    this.time.delayedCall(250, () => { this.bus.emit('throw', x, y); this.audioMgr.at('drop', { x, y }, { maxDist: 12 * TILE }); });
    this.toast(tr('You toss a piece of chalk.'));
  }

  /** v16: the creature does not always have to walk the whole school to you. A noise you make can make it come OUT OF THE DARK
   *  a few tiles from you - preferably behind or beside you, where you are not looking - wrapped in black mist, already hunting the sound. */
  /** A noise can make the creature flash into being IN FRONT of you for a heartbeat (music dies, it is simply there),
   *  then it is gone again in one frame. The real hunter is far away and charges at where you made the noise. */
  maybeEmerge(e) {
    const p = this.player, g = this.ghost;
    if (!this.story.monsterActive || !this.meta.ghostPatrol || this.finalPhase || this.cutsceneActive || p.hidden || this.phantomT > 0 || this.dreadT > 0) return;
    if ((this.emergeCD ?? 0) > 0) return;
    const chance = { run: 0.12, door: 0.3, door_slam: 1, drop: 1, break: 1, voice: 0.4 }[e.type];
    if (!chance || Math.random() > chance) return;
    if (Math.hypot(e.x - p.body.x, e.y - p.body.y) > 40) return;           // only the player's own noise (a thrown chalk keeps its decoy role)
    if (g && (g.glimpse || g.state === 'chase' || g.state === 'listen' || g.state === 'search')) return;
    if (!g && (this.ghostT === Infinity)) return;
    this.spawnPhantom(e, true);
  }

  /** The phantom scare. chase=true: a noise triggered it, so after the dark pause the real creature charges you (endPhantom/launchCharge).
   *  chase=false: a QUIET scare out of nowhere - it flashes in right next to you, then it is just gone. It never chases. */
  spawnPhantom(e, chase) {
    const p = this.player, g = this.ghost;
    const roll = Math.random();
    // Noise scares are unpredictable: sometimes a fake-out (nothing appears), sometimes it stands further away down the corridor.
    if (chase && roll < 0.2) { this.emergeCD = 12 + Math.random() * 10; this.fakeOut(); return; }
    // v37: the phantom appears RIGHT in your face: about 1 to 2 tiles in front of you (it used to be 1.8-3.5, sometimes 5-8).
    // A quiet scare is deliberately face-to-face: choose a clear tile on the
    // player's look direction first, then fall back to the wider front cone
    // only if the map geometry leaves no exact tile in front.
    let cands = chase ? this.frontSpots(PHANTOM_NEAR.lo * TILE, PHANTOM_NEAR.hi * TILE) : this.faceScareSpot();
    if (!cands.length) cands = this.frontSpots(0.8 * TILE, 2.6 * TILE);
    if (!cands.length) cands = this.frontSpots(0.8 * TILE, 4 * TILE);
    if (!cands.length) return;
    cands.sort((a, c) => a.da - c.da);
    const front = cands.filter((c) => c.da < 0.5), pool = front.length ? front : cands.slice(0, 3), at = pool[Math.floor(Math.random() * pool.length)];
    this.emergeCD = chase ? 60 + Math.random() * 30 : 18 + Math.random() * 14; this.phantomT = chase ? PHANTOM_SHOW : 0.7; this.phantomChase = chase;
    if (!g) {
      this.ghost = new Ghost(this, { x: at.x, y: at.y, patrol: [], grid: this.grid });
      this.ghost.brain.setHideSpots(this.hideSpots); this.track(this.ghost);
    } else { g.brain.body.x = at.x; g.brain.body.y = at.y; g.brain.path = null; g.brain.pathGoal = null; g.brain.state = 'patrol'; }
    const gh = this.ghost;
    gh.brain.facing = Math.atan2(p.body.y - at.y, p.body.x - at.x);
    gh.appear();
    this.audioMgr.silence(this.phantomT + 1.2);                 // the music is suddenly gone
    if (chase) { audio.play('scare', 0.8, 0.8); this.monsterVoice('mon_roar', 1); this.cameras.main.shake(260, 0.008); this.distort(260, 0.14); }   // a NOISE brought it: full scare
    else {
      // Quiet scare: a close breath/whisper and a one-frame silhouette. It
      // never sets dread, never hunts and can never damage the player.
      // FACE-TO-FACE SCARE (v43): it stands right in front of you with a sting, a growl and a breath, shakes the view a little, then is gone.
      // It is only a scare: phantom = true means it can never hurt you, never chases and never sets dread.
      audio.play('scare', 0.62, 0.8);
      this.audioMgr.at(Math.random() < 0.5 ? 'mon_growl' : 'mon_grunts', { x: at.x, y: at.y }, { channel: 'sfx', maxDist: 10 * TILE });   // a close growl (not a roar: it never attacks)
      this.audioMgr.at('breath_close', { x: at.x, y: at.y }, { maxDist: 8 * TILE });
      this.time.delayedCall(260, () => { if (!this.dead && this.phantomT > 0) audio.play('whisper', 0.35, 0.82); });
      this.cameras.main.shake(220, 0.006); this.zoomPunch(1.05, 260); this.distort(420, 0.1);
    }
    this.noiseEv = e;
  }

  /** Every 50-100 s the phantom may flash in even if you were completely quiet (never mid-chase, never while hiding). */
  quietPhantomTick(dt) {
    this.quietPhantomT = (this.quietPhantomT ?? 22 + Math.random() * 25) - dt;
    if (this.quietPhantomT > 0) return;
    const p = this.player, g = this.ghost;
    const ok = this.story.hauntingActive && !this.finalPhase && !this.cutsceneActive && !p.hidden && !(this.phantomT > 0) && !(this.dreadT > 0) && !((this.emergeCD ?? 0) > 0)
      && !(g && (g.glimpse || g.state === 'chase' || g.state === 'listen' || g.state === 'search'));
    if (!ok) { this.quietPhantomT = 8; return; }
    this.quietPhantomT = 28 + Math.random() * 32;
    this.spawnPhantom(null, false);
  }

  /** NERVOUS MOMENTS (v43): every 9-20 s in the haunted school something harmless happens that only makes you tense - footsteps stop right behind you,
   *  breathing at your ear, a slow knock, a far growl, the lights dip. No monster appears and nothing can hurt you. */
  nervousTick(dt) {
    this.nervousT = (this.nervousT ?? 10 + Math.random() * 8) - dt;
    if (this.nervousT > 0) return;
    const p = this.player, g = this.ghost;
    const ok = this.story.hauntingActive && !this.finalPhase && !this.cutsceneActive && !p.hidden && !(this.phantomT > 0) && !(this.dreadT > 0)
      && !(g && (g.glimpse || g.chasing || g.state === 'chase' || g.state === 'listen' || g.state === 'search'));
    if (!ok) { this.nervousT = 5; return; }
    this.nervousT = 9 + Math.random() * 11;
    const at = this.audioMgr, far = (min, max) => { const a = Math.random() * Math.PI * 2, r = (min + Math.random() * (max - min)) * TILE; return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }; };
    const kind = ['steps_behind', 'breath', 'knock', 'growl_far', 'dip', 'whisper'][(Math.random() * 6) | 0];
    if (kind === 'steps_behind') {                       // footsteps close in behind you... and stop
      for (let i = 0; i < 5; i++) this.time.delayedCall(i * 420, () => { if (!this.dead) at.at('step', this.behind(4 - i * 0.7), { maxDist: 8 * TILE }); });
      this.time.delayedCall(2300, () => { if (!this.dead) { at.at('breath_close', this.behind(1.0), { maxDist: 6 * TILE }); this.distort(500, 0.05); } });
    } else if (kind === 'breath') {                      // breath right at your ear
      at.at('breath_close', this.behind(0.8), { maxDist: 6 * TILE }); this.distort(600, 0.05);
      this.time.delayedCall(900, () => { if (!this.dead) audio.play('whisper', 0.3, 0.75); });
    } else if (kind === 'knock') {                       // slow knocking, three times
      const q = far(4, 8);
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 900, () => { if (!this.dead) at.at('mon_knock', q, { channel: 'sfx', maxDist: 12 * TILE }); });
    } else if (kind === 'growl_far') {                   // something large growls in another part of the school
      at.at('mon_growl', far(9, 14), { channel: 'sfx', maxDist: 18 * TILE }); this.cameras.main.shake(160, 0.002);
    } else if (kind === 'dip') {                         // the lights dip and the music dies for a moment
      this.blackout = Math.max(this.blackout, 0.3); at.silence(2.2); audio.play('fan_stop', 0.25, 0.8);
      this.time.delayedCall(260 + Math.random() * 300, () => { if (!this.dead) this.blackout = 0; });
    } else audio.play('whisper', 0.42, 0.7);
  }

  removeGhost() {
    if (!this.ghost) return;
    this.disposables = this.disposables.filter((d) => d !== this.ghost); this.ghost.destroy(); this.ghost = null;
  }

  /** THERE IS NO CRAWLING AROUND. The creature is not in the school until it HEARS you. Noise piles up (a few steps do nothing, running,
   *  doors, dropped things and the microphone pile up fast, and it fades away again over time). When it is loud for long enough it comes. */
  noiseAccum(e) {
    const p = this.player;
    if (!this.story.monsterActive || !this.meta.ghostPatrol || this.finalPhase || this.cutsceneActive || this.ghostT > 0 || this.dreadT > 0 || this.phantomT > 0 || p.hidden) return;
    const w = { walk: 0.2, run: 0.7, door: 0.7, door_slam: 1.5, drop: 1.5, break: 2, voice: 0.8, throw: 1.2, pickup: 0.15 }[e.type];
    if (!w) return;
    this.hearAcc = (this.hearAcc ?? 0) + w;
    if (this.hearAcc >= 1.2) { this.hearAcc = 0; this.summonGhost(e); }
  }

  /** A GLIMPSE: for at most 3 seconds something crawls through the edge of your sight - a few tiles away, in front of you - and then it is simply
   *  gone. It is deaf and harmless while it does this; it only shows you that it is there. Not every noise brings it (the rest of the time it charges). */
  glimpse() {
    const p = this.player, c = this.frontSpots(5 * TILE, 9 * TILE).filter((x) => x.da < 0.8);
    if (!c.length) return false;
    const a = c[Math.floor(Math.random() * c.length)], others = c.filter((o) => Math.hypot(o.x - a.x, o.y - a.y) > 3 * TILE);
    const b = others.length ? others[Math.floor(Math.random() * others.length)] : { x: a.x + (a.x - p.body.x) * 0.5, y: a.y + (a.y - p.body.y) * 0.5 };
    this.ghost = new Ghost(this, { x: a.x, y: a.y, patrol: [{ x: b.x, y: b.y }], grid: this.grid });
    const g = this.ghost, br = g.brain;
    br.timer = 0; br.stunT = 99; br.listenCooldown = 99; br.patrolIdx = 0;        // starts crawling at once; deaf and harmless
    g.glimpse = true; g.glimpseT = 1.5 + Math.random() * 1.5; g.fadeRate = 2.5;   // never more than 3 s
    this.track(g);
    this.audioMgr.at('mon_grunts', { x: a.x, y: a.y }, { channel: 'sfx', maxDist: 14 * TILE });
    return true;
  }

  /** It comes out of the dark from far away (about 11 tiles) and charges at the noise. */
  /** Spawn the school stalker on a quiet patrol once the chapter has settled. It remains blind and harmless until it hears a sound. */
  spawnPatrollingGhost() {
    if (this.ghost || !this.meta.ghostPatrol) return;
    const patrol = this.meta.ghostPatrol.map(([tx, ty]) => ({ x: tx * TILE + 16, y: ty * TILE + 16 }));
    if (!patrol.length) return;
    const first = patrol[Math.floor(Math.random() * patrol.length)];
    this.ghost = new Ghost(this, { x: first.x, y: first.y, patrol, grid: this.grid });
    this.ghost.persistentPatrol = true;
    this.ghost.brain.state = 'patrol';
    this.ghost.brain.patrolIdx = 0;
    this.ghost.fade = 1; this.ghost.sprite.setAlpha(0.72);
    this.ghost.brain.setHideSpots(this.hideSpots);
    this.track(this.ghost);
  }

  summonGhost(e) {
    // A patrol creature already exists in the school: feed it the new sound instead of creating a second brain.
    if (this.ghost?.persistentPatrol && !this.ghost.phantom && !this.ghost.hold) {
      this.ghost.brain.hear({ ...e, loudness: Math.max(e.loudness ?? 0.6, 0.8), radius: 60 * TILE });
      this.ghost.pop();
      return;
    }
    if (!e.forceChase && Math.random() < 0.65 && this.glimpse()) return;   // most of the time it is only a glimpse (see below)
    const p = this.player, pts = this.meta.ghostPatrol.map(([tx, ty]) => ({ x: tx * TILE + 16, y: ty * TILE + 16 }));
    let best = null, bd = 1e9;
    for (const q of pts) { const d = Math.hypot(q.x - p.body.x, q.y - p.body.y); if (d > 6 * TILE && Math.abs(d - 11 * TILE) < bd) { bd = Math.abs(d - 11 * TILE); best = q; } }
    if (!best) { let fd = -1; for (const q of pts) { const d = Math.hypot(q.x - p.body.x, q.y - p.body.y); if (d > fd) { fd = d; best = q; } } }
    this.ghost = new Ghost(this, { x: best.x, y: best.y, patrol: [], grid: this.grid });
    this.ghost.brain.setHideSpots(this.hideSpots); this.track(this.ghost);
    this.ghost.brain.hear({ ...e, loudness: Math.max(e.loudness ?? 0.6, 0.8), radius: 60 * TILE });
    this.audioMgr.at('mon_growl', { x: best.x, y: best.y }, { channel: 'sfx', maxDist: 40 * TILE });
    this.time.delayedCall(1200, () => { if (this.ghost) this.audioMgr.at('mon_jaws', { x: this.ghost.brain.x, y: this.ghost.brain.y }, { maxDist: 16 * TILE }); });
  }

  /** Free floor tiles between lo and hi pixels from the player, in line of sight, with their angle off the view direction. */
  faceScareSpot() {
    const p = this.player, aim = p.aim ?? 0;
    for (const d of [1.25, 1.55, 1.9, 2.2]) {
      const x = p.body.x + Math.cos(aim) * d * TILE;
      const y = p.body.y + Math.sin(aim) * d * TILE;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (this.grid[ty]?.[tx] === false && hasLOS(this.grid, x, y, p.body.x, p.body.y)) return [{ x, y, da: 0 }];
    }
    return [];
  }

  /** Free floor tiles between lo and hi pixels from the player, in line of sight, with their angle off the view direction. */
  frontSpots(lo, hi) {
    const p = this.player, aim = p.aim ?? 0, out = [], r = Math.ceil(hi / TILE) + 1, tx0 = Math.floor(p.body.x / TILE), ty0 = Math.floor(p.body.y / TILE);
    for (let ty = ty0 - r; ty <= ty0 + r; ty++) for (let tx = tx0 - r; tx <= tx0 + r; tx++) {
      if (this.grid[ty]?.[tx] !== false) continue;
      const x = tx * TILE + 16, y = ty * TILE + 16, d = Math.hypot(x - p.body.x, y - p.body.y);
      if (d < lo || d > hi || !hasLOS(this.grid, x, y, p.body.x, p.body.y)) continue;
      let da = Math.abs(Math.atan2(y - p.body.y, x - p.body.x) - aim); da = Math.min(da, Math.PI * 2 - da);
      out.push({ x, y, da });
    }
    return out;
  }

  /** A point `tiles` tiles directly behind the player (where they are NOT looking). */
  behind(tiles) { const p = this.player, a = (p.aim ?? 0) + Math.PI; return { x: p.body.x + Math.cos(a) * tiles * TILE, y: p.body.y + Math.sin(a) * tiles * TILE }; }

  /** Fake-out: the music dies, something breathes right behind you, the lights dip... and nothing is there. */
  fakeOut() {
    this.audioMgr.silence(2.6); audio.play('scare', 0.4, 0.7); this.cameras.main.shake(200, 0.004); this.blackout = 0.4;
    this.audioMgr.at('breath_close', this.behind(1.2), { maxDist: 8 * TILE });
    this.time.delayedCall(900, () => audio.play('whisper', 0.45, 0.7));
  }

  /** The phantom is gone in one frame. Then: DARKNESS and SILENCE with something breathing behind you (the player relaxes...)
   *  and only then does the real creature burst out near you, in front of you (launchCharge). */
  endPhantom() {
    const g = this.ghost; if (!g || !g.phantom) return;
    if (!this.phantomChase) {
      g.vanish(); this.blackout = 0.2;
      if (g.persistentPatrol) { g.phantom = false; g.fade = 1; g.sprite.setAlpha(0.72); g.brain.state = 'patrol'; }
      else this.removeGhost();
      return;
    }   // a quiet scare: it is simply gone, or slips back into its patrol route
    g.vanish(); g.hold = true;
    // v37: a LONG, quiet gap (2 s, it was 0.7-1.6 s): the phantom is gone, the lights come back, and you wait... something breathes
    // behind you, closer each time. Then the real creature bursts out in front of you. (Hiding during the gap still saves you.)
    this.dreadT = DREAD_GAP.min + Math.random() * (DREAD_GAP.max - DREAD_GAP.min);
    const gap = this.dreadT;
    this.blackout = Math.min(gap, 1.1); this.audioMgr.silence(gap + 0.6);       // only the first second is pitch dark; the rest is silence with the lights on
    audio.play('whisper', 0.5, 0.7);
    this.audioMgr.at('breath_close', this.behind(2.4), { maxDist: 8 * TILE });
    const still = () => this.ghost?.hold && this.dreadT > 0;
    this.time.delayedCall(gap * 450, () => { if (still()) { audio.play('whisper', 0.4, 0.6); this.audioMgr.at('breath_close', this.behind(1.8), { maxDist: 8 * TILE }); this.distort(500, 0.06); } });
    this.time.delayedCall(gap * 800, () => { if (still()) { this.audioMgr.at('breath_close', this.behind(1.0), { maxDist: 8 * TILE }); this.cameras.main.shake(300, 0.003); } });
  }

  launchCharge() {
    const g = this.ghost, p = this.player; if (!g || !g.hold) return;
    this.blackout = 0;
    const cands = this.frontSpots(2.5 * TILE, 4.5 * TILE).filter((c) => c.da < 0.6);
    if (cands.length) { const at = cands[Math.floor(Math.random() * cands.length)]; g.brain.body.x = at.x; g.brain.body.y = at.y; }
    g.brain.path = null; g.brain.pathGoal = null;
    g.brain.facing = Math.atan2(p.body.y - g.brain.y, p.body.x - g.brain.x);
    g.pop();                                                    // appears INSTANTLY, close in front of you
    g.brain.charge(3);
    this.monsterVoice('mon_roar_eye', 1); audio.play('scare', 0.9); this.cameras.main.shake(320, 0.012); this.zoomPunch(1.09, 220); this.distort(300, 0.16);
  }

  updateGhost(dt) {
    const p = this.player;
    if (this.emergeCD > 0) this.emergeCD -= dt;
    this.quietPhantomTick(dt);
    this.nervousTick(dt);
    if (this.phantomT > 0) { this.phantomT -= dt; if (this.phantomT <= 0) this.endPhantom(); }
    if (this.dreadT > 0) { this.dreadT -= dt; if (this.dreadT <= 0) this.launchCharge(); }
    if (!this.story.monsterActive) {
      if (this.ghost?.phantom) {
        this.ghost.update(dt, { px: p.body.x, py: p.body.y, hidden: p.hidden, hideTile: p.hideTile, flashOn: p.flashOn });
      } else if (this.ghost) {
        this.disposables = this.disposables.filter((d) => d !== this.ghost); this.ghost.destroy(); this.ghost = null;
      }
      this.updateThreat(); return;
    }
    this.hearAcc = Math.max(0, (this.hearAcc ?? 0) - dt * 0.6);   // noise fades from its memory
    if (!this.ghost) {
      this.ghostT -= dt;
      if (this.followDoor && this.ghostT <= 0 && this.meta.ghostPatrol) {          // it heard the door slam behind you and comes after you
        this.followDoor = false;
        this.summonGhost({ id: -1, x: p.x, y: p.y, loudness: 0.9, type: 'door', forceChase: true });
      } else if (!this.followDoor && this.ghostT <= 0 && this.meta.ghostPatrol) {
        this.patrolSpawned = true;
        this.spawnPatrollingGhost();
      }
      this.updateThreat();
      return;
    }
    const g = this.ghost;
    g.update(dt, { px: p.body.x, py: p.body.y, hidden: p.hidden, hideTile: p.hideTile, flashOn: p.flashOn });
    // It does not crawl around: once it has lost the noise (and finished listening) it simply fades back into the dark and is gone.
    if (g.glimpse) { g.glimpseT -= dt; g.leaving = g.glimpseT <= 0; g.leaveRate = 6; }   // vanishes almost at once
    else g.leaving = !this.finalPhase && !g.brain.hunting && !g.phantom && !g.hold && g.brain.state === 'patrol';
    if (g.leaving && g.fade <= 0.02) { this.removeGhost(); this.updateThreat(); return; }
    for (const e of g.brain.events) {
      if (e === 'rush') { // it HEARD a noise and charges at it (it is blind: this is the only way it ever finds you)
        audio.fadeOut('mon_roar_eye', 200); this.monsterVoice('mon_roar', 0.95); audio.play('scare', 0.35);
        this.cameras.main.shake(180, 0.005); this.zoomPunch(1.07, 200); this.distort(360, 0.12); this.calmT = 0;
        if (!this.blindHint) { this.blindHint = true; this.toast(tr('It is blind. It hunts by SOUND - stop moving and it stops.')); }
      }
      if (e === 'lost') { audio.fadeOut('mon_roar', 900); audio.fadeOut('mon_roar_eye', 700); this.toast(tr('It can no longer hear you... stay silent.')); }
      if (e === 'creep') { this.audioMgr.at('mon_growl', { x: g.brain.x, y: g.brain.y }, { maxDist: 9 * TILE }); this.distort(500, 0.06); this.calmT = 0; }       // v33: a quiet noise -> it CREEPS toward you, no roar, just a low growl
      if (e === 'lunge') { this.monsterVoice('mon_roar_eye', 0.95); this.cameras.main.shake(240, 0.007); this.zoomPunch(1.06, 180); this.distort(280, 0.12); }           // v33: it bursts forward when it is close
      if (e === 'sniff') this.audioMgr.at(Math.random() < 0.5 ? 'breath_close' : 'mon_knock', { x: g.brain.x, y: g.brain.y }, { maxDist: 8 * TILE });                 // v33: searching: sniffing / knocking around the last noise
      if (e === 'sniff_close') { this.audioMgr.at('breath_close', { x: g.brain.x, y: g.brain.y }, { maxDist: 5 * TILE }); this.cameras.main.shake(300, 0.004); this.distort(700, 0.08); }   // v33: right next to your hiding spot
      if (e === 'listen') this.audioMgr.at(Math.random() < 0.5 ? 'mon_jaws' : 'mon_growl', { x: g.brain.x, y: g.brain.y }, { maxDist: 10 * TILE });
      // A silent player can be brushed by the blind patrol without triggering
      // a roar; the contact is meant to feel like a near miss. Only a player
      // who made a recent sound gets the loud catch cue.
      if (e === 'catch' && this.quietT <= 1.5 && !audio.isPlaying('mon_roar') && !audio.isPlaying('mon_roar_eye')) this.monsterVoice('mon_roar_eye', 0.9);
    }
    // It is blind: if you are being quiet (no noise for 1.5 s) it brushes past and does NOT attack.
    this.quietT += dt;
    if (g.brain.contact && !g.phantom) { if (this.quietT > 1.5 && !this.finalPhase && !(g.brain.charging > 0)) g.brain.retreat(3); else this.hurt(); }   // the flash-in apparition can never hurt
    // a big roar whenever it is close and hunting (the old, loud one)
    this.nearRoarT = (this.nearRoarT ?? 0) - dt;
    if (!g.phantom && g.chasing && this.nearRoarT <= 0 && Math.hypot(g.brain.x - p.body.x, g.brain.y - p.body.y) < 7 * TILE) {
      this.nearRoarT = 6 + Math.random() * 3; audio.fadeOut('mon_roar_eye', 100); this.monsterVoice('mon_roar', 1); this.cameras.main.shake(260, 0.008); this.zoomPunch(1.05, 200);
    }
    this.updateThreat();
  }

  /** A monster roar: always clearly audible (it is a threat cue), panned toward where it is, a little quieter when far. */
  monsterVoice(name, vol = 0.9) {
    const g = this.ghost; if (!g) return;
    const p = this.player, dx = g.brain.x - p.x, dy = g.brain.y - p.y, d = Math.hypot(dx, dy);
    const rel = Math.atan2(dy, dx) - (p.aim ?? 0);
    audio.play(name, vol * (0.3 + 0.7 * Math.max(0, 1 - d / (14 * TILE))), 1, { pan: d < 1 ? 0 : Math.sin(rel) * 0.8, ch: 'sfx' });
  }

  /** The Shadow Teacher: a harmless, unsettling apparition that creeps in at the end of a corridor, then is gone. */
  updateApparition(dt) {
    const a = this.meta.apparition; if (!a) return;
    const p = this.player;
    if (!this.app) {
      this.appT = (this.appT ?? a.delay) - dt;
      if (this.appT > 0) return;
      const ends = a.ends.map(([tx, ty]) => ({ x: tx * TILE + 16, y: ty * TILE + 28 })).filter((e) => Math.hypot(e.x - p.x, e.y - p.y) > 280);
      if (!ends.length || p.hidden) { this.appT = 6; return; }
      const e = ends[(Math.random() * ends.length) | 0];
      const sp = this.add.sprite(e.x, e.y, 'ghost_teacher', 0).setOrigin(0.5, 0.97).setDepth(DEPTH.ENTITIES + e.y / 1000);
      sp.play('teacher_appear'); sp.once('animationcomplete', () => sp.play('teacher_walk'));
      const L = this.addLamp(e.x, e.y - 34, 46, true, 0x8a70ff, 0.07, 0.5);
      this.app = { sp, L, t: 0, dir: Math.sign(p.x - e.x) || 1 };
      audio.play('whisper', 0.55, 0.6); this.cameras.main.shake(220, 0.003); this.distort(500, 0.1);
      return;
    }
    const A = this.app; A.t += dt;
    A.sp.x += A.dir * 12 * dt; A.sp.setPosition(Math.round(A.sp.x), A.sp.y); A.L.x = A.sp.x;
    this.glows.find((g) => g.L === A.L)?.img.setX(A.sp.x);
    if (A.t > 3.4) A.sp.setAlpha(Math.random() < 0.5 ? 0.15 : 1);
    if (A.t > 3.9 || (p.flashOn && Math.hypot(A.sp.x - p.x, A.sp.y - p.y) < 150 && A.t > 1.2)) {
      A.L.i = 0; this.lamps = this.lamps.filter((l) => l !== A.L); A.sp.destroy(); this.app = null; this.appT = 38 + Math.random() * 40;
    }
  }

  updateThreat() {
    const g = this.ghost, p = this.player, dt = Math.min(this.game.loop.delta, 50) / 1000;
    let t = 0, dread = 0, fd = 1;
    if (g && !g.hold) {
      const d = Math.hypot(g.brain.x - p.body.x, g.brain.y - p.body.y);
      t = Math.max(0, 1 - d / 320) * 0.7;
      if (g.chasing) t = Math.max(t, 0.65);
      if (g.chasing || g.brain.charging > 0) dread = Math.max(0.45, 1 - d / (9 * TILE));
      // the flashlight struggles when it is near, and cuts out when it is very close
      if (d < 7 * TILE && !g.phantom) {
        const k = 1 - d / (7 * TILE), tt = this.time.now, sn = Math.sin(tt * 0.045) * Math.sin(tt * 0.0173 + 1);
        fd = sn > -1.05 + k * 1.4 ? 1 : (k > 0.7 ? 0 : 0.25);
      }
    }
    p.flashDim = fd;
    this.threat += (t - this.threat) * 0.1;
    this.dread = (this.dread ?? 0) + (dread - (this.dread ?? 0)) * 0.15;
    // heartbeat: faster and louder the closer it gets
    if (this.dread > 0.12 && this.story.mapState !== 5) {
      this.hbT = (this.hbT ?? 0) - dt;
      if (this.hbT <= 0) { const rate = 1 + 0.9 * this.dread; audio.play('heartbeat', 0.35 + 0.5 * this.dread, rate); this.hbT = 1 / rate; }
    } else this.hbT = 0;
  }
}
