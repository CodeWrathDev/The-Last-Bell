// SILENT PLAYER test: a player who does nothing must never be hurt, chased or summoned (headless GameScene, stubbed Phaser).
// Run: node --import ./tools/stubs/register.mjs tools/test-quiet.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { GameScene } = await import('../src/scenes/GameScene.js');
const { TILE } = await import('../src/config.js');

const queue = []; let now = 0;
const fakeTime = { get now() { return now; }, delayedCall(ms, fn) { const t = { at: now + ms, fn, remove() { this.dead = true; } }; queue.push(t); return t; }, addEvent() { return {}; } };
const flush = (ms) => { const end = now + ms; while (true) { const due = queue.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; queue.splice(queue.indexOf(due), 1); now = Math.max(now, due.at); due.fn(); } now = end; };

const calls = []; const events = new EventEmitter();
const s = new GameScene();
s.time = fakeTime; s.game = { loop: { delta: 16 }, events, renderer: { type: 1 }, device: { os: {} } };
s.sys = { game: { device: { os: {} } } };
s.scene = { launch: (k, d) => calls.push(['launch', k, d]), start: (k, d) => calls.push(['start', k, d]), stop: (k) => calls.push(['stop', k]), isActive: () => false, isPaused: () => false, restart: () => {} };
s.create({ mode: 'new', afterPrologue: true });
s.controls.poll = () => ({ vx: 0, vy: 0, turn: 0, run: false, interact: false, flash: false, hide: false, crouch: false, throw: false });
const tick = (n = 1, dt = 16) => { for (let i = 0; i < n; i++) { now += dt; s.update(now, dt); flush(0); } };
const cutscene = (id) => { const c = calls.filter((x) => x[0] === 'launch' && x[1] === 'Cutscene' && x[2].id === id); assert.ok(c.length, 'cutscene not launched: ' + id); events.emit('cutscene:done', id, {}); flush(10); };
const go = (map, spawn) => { s.transitioning = false; s.changeMap(map, spawn); flush(700); tick(3); assert.equal(s.mapId, map); };
const act = (id) => { const o = s.objs.find((x) => x.def.id === id); assert.ok(o, 'no object ' + id + ' in ' + s.mapId); s.doAction(o); flush(10); };
const step = (name, fn) => { fn(); console.log('ok  ' + name); };

step('the player has exactly ONE heart', () => { assert.equal(s.player.hearts, 1); });
step('new game starts in Chapter 1 on the campus', () => { assert.equal(s.story.chapter, 'ch1'); assert.equal(s.mapId, 'campus'); tick(30); });
step('hallway arrival plays the night cutscene and starts Chapter 2', () => { go('hall', 'fromCampus'); flush(600); cutscene('night_arrival'); assert.equal(s.story.chapter, 'ch2'); assert.equal(s.story.mapState, 3); });
step('locked doors stay locked until puzzles are solved', () => {
  const d4 = s.map.objects.find((o) => o.id === 'door_9'); assert.ok(d4 && (d4.type === 'lockeddoor'), 'door 10B should still be locked');
  const lib = s.map.objects.find((o) => o.id === 'door_20'); assert.equal(lib.type, 'lockeddoor');
});
step('Classroom 10A puzzles', () => { go('classroomA', 'fromHall'); tick(10); act('read_notice'); act('take_key_10b'); assert.ok(s.story.has('has_key_10b') && s.has('key_10b')); });
step('10B opens after the key, fuse found', () => { go('hall', 'fromClassroomA'); const d = s.map.objects.find((o) => o.id === 'door_9'); assert.equal(d.type, 'door', '10B should now be open'); go('classroomB', 'fromHall'); act('take_fuse'); assert.ok(s.story.has('has_fuse')); });
step('toilets: restore power starts Chapter 3 with NO story cutscene', () => { go('hall', 'fromClassroomB'); go('toilets', 'fromHall'); act('restore_power'); assert.equal(s.story.chapter, 'ch3'); flush(3000); assert.ok(!s.cutsceneActive, 'no cutscene at chapter 3'); assert.ok(s.story.monsterActive); });

// ---- from here: the player stands still, mic off, for 10 minutes, several times over
const log = { hurt: 0, summon: 0, chasePhantom: 0, quietPhantom: 0, roarsInQuiet: 0 };
const origHurt = s.hurt.bind(s), origSummon = s.summonGhost.bind(s), origPhantom = s.spawnPhantom.bind(s), origVoice = s.monsterVoice.bind(s);
s.hurt = (...a) => { log.hurt++; return origHurt(...a); };
s.summonGhost = (...a) => { log.summon++; return origSummon(...a); };
s.spawnPhantom = (e, chase) => { if (chase) log.chasePhantom++; else log.quietPhantom++; return origPhantom(e, chase); };
s.monsterVoice = (name, vol) => { log.roarsInQuiet++; return origVoice(name, vol); };
step('a player who does nothing for 10 minutes (x4) is never hurt, summoned or chased', () => {
  go('hall', 'fromToilets'); s.ghostT = 0.1; tick(120); for (const k of Object.keys(log)) log[k] = 0;   // (walking through the door is a noise: start counting after it)
  flush(5000); tick(120); s.phantomT = 0; s.dreadT = 0; s.removeGhost?.(); for (const k of Object.keys(log)) log[k] = 0;   // the door you just walked through IS a noise: start counting after it
  const seen = {}; s.bus.subscribe((e) => { seen[e.type] = (seen[e.type] || 0) + 1; });
  for (let round = 0; round < 4; round++) {
    s.quietPhantomT = 1; s.emergeCD = 0;
    for (let i = 0; i < 600 * 62; i++) { tick(1, 16); if (s.dead) break; }
    assert.ok(!s.dead, 'player died while doing nothing (round ' + round + ')');
  }
  console.log('    ', JSON.stringify(log), 'sounds the standing player made:', JSON.stringify(seen));
  assert.deepEqual(seen, {}, 'a motionless player made noises: ' + JSON.stringify(seen));
  assert.equal(log.hurt, 0, 'hurt while doing nothing'); assert.equal(log.summon, 0, 'monster summoned while doing nothing'); assert.equal(log.chasePhantom, 0, 'a noise scare happened with no noise');
  assert.ok(!s.ghost || !s.ghost.chasing, 'it is chasing a silent player');
});
step('quiet "flash-in" scares make NO roar (they are a glimpse, not an attack)', () => { assert.equal(log.roarsInQuiet, 0, 'roars played: ' + log.roarsInQuiet); });
step('a voice noise from the microphone DOES bring it (the feature still works)', () => {
  s.removeGhost(); s.phantomT = 0; s.dreadT = 0; s.emergeCD = 99; s.hearAcc = 0; s.ghostT = 0; const p = s.player;
  for (let i = 0; i < 6; i++) s.bus.emit('voice', p.body.x, p.body.y, { loudness: 0.7, radius: 250, duration: 0.6 });
  assert.ok(log.summon >= 1 || s.ghost, 'repeated loud voice noises should bring it');
});
console.log('quiet-player test OK');
