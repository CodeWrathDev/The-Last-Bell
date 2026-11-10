// Headless smoke test of CutsceneScene (every script) and UIScene (objective, chapter card, bubble, settings) with stubbed Phaser.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { CutsceneScene } = await import('../src/scenes/CutsceneScene.js');
const { CUTSCENES } = await import('../src/data/cutscenes.js');
const { UIScene } = await import('../src/scenes/UIScene.js');
const { ChapterState } = await import('../src/systems/ChapterState.js');
const { objectiveFor } = await import('../src/data/story.js');

let n = 0;
for (const id of Object.keys(CUTSCENES)) {
  const s = new CutsceneScene(); const out = []; const ev = new EventEmitter();
  s.time = { get now() { return Date.now(); }, delayedCall: (ms, fn) => { const t = { dead: false, remove() { this.dead = true; } }; setTimeout(() => { if (!t.dead) fn(); }, 0); return t; } };
  s.tweens = { add: (cfg) => { queueMicrotask(() => cfg.onComplete?.()); return {}; } };
  s.game = { events: ev }; s.scene = { start: (k, d) => out.push(['start', k]), stop: () => out.push(['stop']) };
  s.init({ id, overlay: id !== 'prologue' && id !== 'final_end', next: { scene: 'Menu', data: {} } });
  const done = new Promise((res) => { ev.on('cutscene:done', () => res('event')); s.scene.start = (k) => res('start:' + k); });
  s.create();
  const r = await Promise.race([done, new Promise((res) => setTimeout(() => res('TIMEOUT'), 4000))]);
  assert.notEqual(r, 'TIMEOUT', 'cutscene did not finish: ' + id);
  console.log(`ok  cutscene ${id} finished (${r})`); n++;
}

// REGRESSION: Phaser re-uses one scene instance. prologue -> disappearance ('The Missing Girl') on the SAME instance used to freeze,
// because a stale `done = true` made finish() a no-op. init() must reset all per-run state.
{
  const s = new CutsceneScene(); const ev = new EventEmitter(); let resolveRun;
  s.time = { get now() { return Date.now(); }, delayedCall: (ms, fn) => { const t = { dead: false, remove() { this.dead = true; } }; setTimeout(() => { if (!t.dead) fn(); }, 0); return t; } };
  s.tweens = { add: (cfg) => { queueMicrotask(() => cfg.onComplete?.()); return {}; } };
  s.game = { events: ev }; s.scene = { start: () => resolveRun('start'), stop: () => resolveRun('stop') };
  for (const id of ['prologue', 'disappearance', 'night_arrival', 'monster_intro', 'reunion', 'journey']) {
    const done = new Promise((res) => { resolveRun = res; });
    s.init({ id, overlay: !['prologue', 'disappearance'].includes(id), next: { scene: 'Game', data: {} } });
    s.create();
    const r = await Promise.race([done, new Promise((res) => setTimeout(() => res('TIMEOUT'), 4000))]);
    assert.notEqual(r, 'TIMEOUT', 'reused scene froze on cutscene: ' + id);
  }
  console.log('ok  six cutscenes in a row on one reused scene instance (no freeze)'); n++;
}

// UI scene
const story = new ChapterState();
const gs = { story, state: { inv: [], notes: [], objective: 'x' }, meta: {}, map: { w: 10, h: 10, meta: { name: 'Test', outdoor: true }, layers: { ground: Array.from({ length: 10 }, () => Array(10).fill(0)), deco: Array.from({ length: 10 }, () => Array(10).fill(-1)) } }, threat: 0, player: {}, saveGame: () => true, cameras: { main: {} } };
const ui = new UIScene(); ui.time = { now: 0, delayedCall: () => ({}) }; ui.tweens = { add: () => ({}), killTweensOf: () => {} };
ui.init({ game: gs });
try { ui.create(); } catch (e) { console.log('UI create threw:', e.message); throw e; }
for (const ch of ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'final']) { story.chapter = ch; ui.refreshObjective(); ui.showChapter(ch); }
ui.bubble('ငါ့ကို လာရှာတာလား။'); ui.bubble('ဒီလမ်းကို ငါသိတယ်။');
ui.say(['hello']); ui.closeDialogue();
ui.openSettingsPanel();
console.log('ok  UI scene: objective, chapter cards, bubble, dialogue, settings'); n++;

// v41 NOISE + MIC meters: every mic state draws without throwing, shows the right status text, and the +/- buttons change the sensitivity
{
  const { Settings } = await import('../src/systems/Settings.js');
  ui.game = ui.game ?? {}; ui.game.loop = { delta: 16 }; gs.noiseShown = 0.3;
  const cases = [['off', false, null], ['asking', true, { active: false, status: 'asking' }], ['calibrating', true, { active: true, status: 'calibrating', calT: 0.4, level: 0, peak: 0 }],
    ['listening', true, { active: true, status: 'listening', shown: 0.9, trig: 0.5 }], ['denied', true, { active: false, status: 'denied' }], ['insecure', true, { active: false, status: 'insecure' }]];
  const want = { off: 'OFF', asking: 'ALLOW MIC', calibrating: 'CALIBRATING', listening: 'LISTENING', denied: 'BLOCKED', insecure: 'NEEDS HTTPS' };
  const rec = () => ({ text: '', setText(t) { this.text = t; return this; }, setColor() { return this; } });
  ui.micStatus = rec(); ui.sensText = rec(); ui.micTag = rec();
  for (const [name, on, mic] of cases) { Settings.set('microphone', on); ui.drawMicMeter(mic); assert.equal(ui.micStatus.text, want[name], name); }
  ui.drawMicMeter({ active: true, status: 'listening', shown: 0.9, trig: 0.5 }); assert.equal(ui.micTag.text, 'LOUD!', 'a loud voice shows LOUD!');
  ui.drawMicMeter({ active: true, status: 'listening', shown: 0.1, trig: 0.5 }); assert.equal(ui.micTag.text, '', 'quiet: no LOUD!');
  Settings.set('micSens', 2); ui.changeMicSens(0.5); ui.drawMicMeter(null); assert.equal(Settings.get('micSens'), 2.5); assert.equal(ui.sensText.text, '2.5x');
  ui.changeMicSens(-0.5); ui.changeMicSens(-0.5); assert.equal(Settings.get('micSens'), 1.5);
  Settings.set('micSens', 0.5); ui.changeMicSens(-0.5); assert.equal(Settings.get('micSens'), 0.5, 'clamped at the minimum');
  Settings.set('micSens', 5); ui.changeMicSens(0.5); assert.equal(Settings.get('micSens'), 5, 'clamped at the maximum');
  Settings.set('microphone', false); ui.toggleMic(); assert.equal(Settings.get('microphone'), true, 'MIC button turns the microphone on'); ui.toggleMic(); assert.equal(Settings.get('microphone'), false, '...and off again');
  console.log('ok  NOISE + MIC meters: all mic states draw, status text, sensitivity +/- and MIC button'); n++;
}
for (const ch of ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']) { story.chapter = ch; assert.ok(objectiveFor(story).length > 10); }
console.log(`\nui smoke OK (${n})`);
