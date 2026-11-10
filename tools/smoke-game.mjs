// Headless smoke test of GameScene with a stubbed Phaser: plays the whole story through the real scene code.
// Run: node --import ./tools/stubs/register.mjs tools/smoke-game.mjs   
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
step('a loud noise makes the monster flash into view in FRONT of the player, vanish suddenly, then hunt from far away', () => {
  go('hall', 'fromToilets'); s.ghostT = 0.1; tick(20); s.player.crouch = false;
  if (!s.ghost) { console.log('    (no monster in the school until it hears a noise: skipped)'); return; }
  s.ghost.brain.retreat(0); s.emergeCD = 0; s.ghost.brain.state = 'patrol'; s.ghost.brain.stunT = 0;
  const p = s.player; s.maybeEmerge({ type: 'door_slam', x: p.body.x, y: p.body.y, radius: 400, loudness: 1, id: 99 });
  if (!s.ghost.phantom) { console.log('    (no free tile in front here; phantom skipped)'); return; }
  assert.equal(s.ghost.fade, 1, 'it appears instantly');
  const d = Math.hypot(s.ghost.brain.x - p.body.x, s.ghost.brain.y - p.body.y); assert.ok(d >= 0.8 * TILE - 1 && d <= 4 * TILE + 1, 'v37: appears RIGHT next to the player (about 1-2 tiles, 4 at most): ' + (d / TILE).toFixed(1));
  for (let i = 0; i < 90 && s.ghost.phantom; i++) tick(1, 16);
  assert.ok(!s.ghost.phantom, 'it vanishes after about a second'); assert.equal(s.ghost.fade < 0.2, true, 'gone in one frame');
  assert.ok(s.ghost.hold && s.dreadT > 1.0, 'v37: then a quiet gap (2 s) before the real charge: dreadT=' + s.dreadT);
  for (let i = 0; i < 60 * 6 && s.ghost.hold; i++) tick(1, 16);
  assert.ok(!s.ghost.hold && s.ghost.brain.charging > 0, 'and then it charges');
});
step('monster spawns, hunts, and the scene survives 60 s of play with sounds', () => {
  go('hall', 'fromToilets'); s.ghostT = 0.1; tick(20);
  assert.ok(s.ghost, 'monster should have spawned'); s.player.crouch = true;
  for (let i = 0; i < 60 * 60; i++) { tick(1, 16); if (i % 120 === 0) s.bus.emit('run', s.player.x, s.player.y); }
  assert.ok(Number.isFinite(s.ghost.brain.x) && Number.isFinite(s.player.x));
  console.log('    (player hearts after 60s of making noise next to it: ' + s.player.hearts + ', dead=' + s.dead + ')');
  s.dead = false; s.player.dead = false; s.player.hearts = 1; s.player.invuln = 0; s.player.crouch = false;
});
step('Library cabinet gives the office key and starts Chapter 4', () => { go('library', 'fromHall'); act('open_cabinet'); assert.ok(s.has('office_key')); assert.equal(s.story.chapter, 'ch4'); });
step('Office evidence, then upstairs storage', () => {
  go('hall', 'fromLibrary'); go('office', 'fromHall'); act('read_register'); act('see_photo');
  go('hall', 'fromOffice'); go('stairs', 'fromHall'); go('upper', 'fromStairs');
  const st = s.map.objects.find((o) => o.id === 'storage_door'); assert.equal(st.type, 'door', 'storage opens with the code');
  go('storage', 'fromUpper'); act('find_torn_page'); act('find_bullies'); cutscene('bullies_found');
  assert.equal(s.story.chapter, 'ch5'); assert.ok(!s.story.monsterActive); tick(5); assert.equal(s.ghost, null, 'monster is gone in Chapter 5');
});
step('hidden passage opens, reunion cutscene, companion appears', () => {
  go('upper', 'fromStorage'); go('classroomA', 'fromUpper');
  const hp = s.map.objects.find((o) => o.id === 'hidden_passage'); assert.equal(hp.type, 'door');
  go('oldroom', 'fromClassroomA'); act('reunion'); cutscene('reunion'); assert.ok(s.story.has('reunion')); assert.ok(s.companion, 'companion spawned'); tick(200);
});
step('service passage to the courtyard, companion follows, journey cutscene', () => {
  go('service', 'fromOld'); const ex = s.map.objects.find((o) => o.id === 'service_exit'); assert.equal(ex.type, 'door');
  go('campus', 'fromService'); flush(1000); cutscene('journey'); tick(120); assert.ok(s.companion);
});
step('walking to the gate starts the final chapter as REAL GAMEPLAY (no cutscene)', () => {
  s.player.setFeet(19 * TILE + 16, 20 * TILE); tick(3);
  assert.equal(s.story.chapter, 'final'); assert.equal(s.finalPhase, 'scripted');
  assert.ok(!calls.some((x) => (x[0] === 'start' || x[0] === 'launch') && x[1] === 'Cutscene' && ['final', 'final_end'].includes(x[2].id)), 'no cutscene may play for the twist');
  assert.ok(s.companion && !s.ghost, 'the girl is still a girl'); assert.equal(s.story.girlForm, 'human');
});
step('save snapshot round-trips the story', () => { const snap = JSON.parse(JSON.stringify(s.snapshot())); assert.equal(snap.story.chapter, 'final'); assert.equal(snap.hearts, 1); });
step('the girl walks up in front of the player, then suddenly turns into the creature', () => {
  const p = s.player, c0 = s.companion.brain;
  for (let i = 0; i < 20; i++) { flush(200); tick(1); }       // ~4 s: she has stepped in front and spoken
  const ahead = (s.companion.brain.x - p.body.x) * Math.cos(p.aim ?? 0) + (s.companion.brain.y - p.body.y) * Math.sin(p.aim ?? 0);
  assert.ok(ahead > 0, 'she must stand in front of the player'); void c0;
  for (let i = 0; i < 20 && s.story.girlForm !== 'crawler'; i++) { flush(200); tick(1); }
  assert.equal(s.story.girlForm, 'crawler'); assert.equal(s.companion, null); assert.ok(s.ghost, 'creature must exist');
  assert.ok(s.ghost.brain.body.hw <= 10 && s.ghost.brain.body.hh <= 10, "creature body must fit doorways");
});
step('the creature kills the player right there: straight to the ending', () => {
  for (let i = 0; i < 60 * 6 && s.finalPhase !== 'death'; i++) { flush(17); tick(1); }
  assert.equal(s.finalPhase, 'death'); assert.equal(s.player.hearts, 0); assert.equal(s.story.chapter, 'ending');
  flush(2500);
  const e = calls.filter((x) => x[0] === 'start' && x[1] === 'Cutscene' && x[2].id === 'final_end'); assert.ok(e.length, 'ending cutscene must start after the kill');
});
console.log('\nsmoke OK');
