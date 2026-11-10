// THE LAST BELL logic tests (no browser). Run: node tools/test-last-bell.mjs
import assert from 'node:assert/strict';
import { TILE } from '../src/config.js';
import { SoundBus, perceived, SOUND } from '../src/systems/SoundBus.js';
import { MonsterBrain, MS, SPEED, SOUND_MEMORY, LISTEN_TIME, SEARCH_TIME } from '../src/systems/MonsterBrain.js';
import { CompanionBrain, CompanionTalk } from '../src/systems/CompanionBrain.js';
import { ChapterState, ORDER, FINAL_STEPS } from '../src/systems/ChapterState.js';
import { PuzzleSystem } from '../src/systems/PuzzleSystem.js';
import { ROOMS, DOORS, ACTIONS, MONSTER_ROUTES } from '../src/maps/schoolGraph.js';
import { COMPANION_LINES, FINAL_LINES, ENDING, CHAPTERS } from '../src/data/canon.js';
import { buildMap } from '../src/maps/index.js';
import { levelToEvent } from '../src/systems/MicInput.js';
import { Mixer, footstepName, spatial, EventScheduler, MusicDirector, AudioManager } from '../src/systems/AudioManager.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const c = (t) => t * TILE + 16;

// 30x15 test hall: outer wall, a dividing wall at x=15 with a doorway at y=7..8.
function grid() {
  const g = Array.from({ length: 15 }, (_, y) => Array.from({ length: 30 }, (_, x) => y === 0 || y === 14 || x === 0 || x === 29));
  for (let y = 1; y < 14; y++) if (y !== 7 && y !== 8) g[y][15] = true;
  return g;
}
const W = (o = {}) => ({ px: 0, py: 0, hidden: false, hideTile: null, flashOn: false, ...o });
const run = (m, sec, w, dt = 1 / 30) => { for (let i = 0; i < sec / dt; i++) m.update(dt, typeof w === 'function' ? w() : w); };

// ---------- sound ----------
test('louder sounds carry farther than quiet ones', () => {
  const bus = new SoundBus(), g = null;
  const walk = bus.emit('walk', 0, 0), run_ = bus.emit('run', 0, 0), slam = bus.emit('door_slam', 0, 0);
  assert.ok(perceived(walk, 150, 0, g) > 0);
  assert.ok(perceived(run_, 150, 0, g) > perceived(walk, 150, 0, g));
  assert.ok(perceived(slam, 300, 0, g) > 0);
  assert.ok(SOUND.run.radius > SOUND.walk.radius && SOUND.break.radius > SOUND.door_slam.radius);
});
test('walls shorten how far a sound carries', () => {
  const g = grid(), ev = { x: c(10), y: c(3), loudness: 0.6, radius: 220 };
  const clear = perceived(ev, c(14), c(3), g);            // same side, 4 tiles
  const across = perceived({ ...ev, x: c(13) }, c(17), c(3), g); // through the wall, 4 tiles
  assert.ok(clear > 0 && across === 0, `clear=${clear} across=${across}`);
});
test('sound events expire after their duration', () => {
  const bus = new SoundBus(); bus.emit('door', 0, 0); assert.equal(bus.recent.length, 1);
  bus.tick(1); assert.equal(bus.recent.length, 0);
});

// ---------- monster (v9: BLIND, hunts by sound only) ----------
const mk = (o = {}) => { const g = o.grid || grid(); return new MonsterBrain({ x: c(5), y: c(3), grid: g, patrol: [{ x: c(5), y: c(3) }], rng: seeded(o.seed || 1), ...o }); };
test('monster is blind: standing in plain view, in front of it, flashlight on, silent -> it never chases', () => {
  const m = mk({ seed: 2 }); m.facing = 0;
  run(m, 20, W({ px: c(9), py: c(3), flashOn: true }));   // 4 tiles straight ahead, lit up
  assert.notEqual(m.state, MS.CHASE); assert.equal(m.last, null);
});
test('monster never \"knows\" the player through a wall either (no wall tracking)', () => {
  const m = mk({ x: c(10), seed: 3, patrol: [{ x: c(10), y: c(3) }] });
  run(m, 20, W({ px: c(20), py: c(3) }));
  assert.notEqual(m.state, MS.CHASE); assert.equal(m.last, null);
});
test('a heard sound sends it to the SOUND, not to the player', () => {
  const m = mk({ seed: 2 }), bus = new SoundBus(); bus.subscribe((e) => m.hear(e));
  bus.emit('run', c(9), c(3));                       // run noise 4 tiles away
  assert.equal(m.state, MS.CHASE); assert.ok(m.events.includes('rush'));
  run(m, 1.2, W({ px: c(5), py: c(12) }));            // the player is somewhere else entirely
  assert.ok(Math.hypot(m.x - c(9), m.y - c(3)) < 40, 'went to the noise: ' + [m.x, m.y]);
});
test('while the noise keeps coming it keeps chasing the newest noise', () => {
  const m = mk({ seed: 7 }), bus = new SoundBus(); bus.subscribe((e) => m.hear(e));
  bus.emit('run', c(9), c(3)); assert.equal(m.state, MS.CHASE);
  run(m, 0.4, W({ px: c(12), py: c(3) }));
  bus.emit('run', c(12), c(3)); assert.equal(m.state, MS.CHASE); assert.ok(m.last.x > c(11), 'target moved to the new noise');
  for (let i = 0; i < 30 * 4; i++) { if (i % 8 === 0) bus.emit('run', c(14), c(3)); m.update(1 / 30, W({ px: c(14), py: c(3), hidden: true })); assert.equal(m.state, MS.CHASE, 'still chasing at t=' + i); }
});
test('the moment the noise stops it STOPS chasing: freezes, listens, then crawls back to patrol', () => {
  const m = mk({ seed: 4, patrol: [{ x: c(3), y: c(3) }, { x: c(8), y: c(10) }] }), bus = new SoundBus(); bus.subscribe((e) => m.hear(e));
  bus.emit('run', c(12), c(3));                                        // one loud noise, then silence
  const seen = [m.state]; let lostAt = null, t = 0; const player = W({ px: c(5), py: c(12) });
  for (let i = 0; i < 30 * 40; i++) { t += 1 / 30; m.update(1 / 30, player); if (m.events.includes('lost')) lostAt = t; if (seen[seen.length - 1] !== m.state) seen.push(m.state); }
  assert.deepEqual(seen.slice(0, 5), [MS.CHASE, MS.LISTEN, MS.SEARCH, MS.RETURN_TO_PATROL, MS.PATROL]);   // v33: it searches the area before giving up
  assert.ok(lostAt !== null && lostAt <= SOUND_MEMORY + SOUND.run.duration + 0.15, 'gave up straight after the sound ended: ' + lostAt);
});
test('after the noise stops it stands perfectly still while listening, and never walks toward the player', () => {
  const m = mk({ seed: 5 }), bus = new SoundBus(); bus.subscribe((e) => m.hear(e));
  bus.emit('run', c(12), c(3));
  const player = W({ px: c(5), py: c(12) }); let guard = 0;
  while (m.state === MS.CHASE && guard++ < 30 * 10) m.update(1 / 30, player);
  assert.equal(m.state, MS.LISTEN);
  const x0 = m.x, y0 = m.y; run(m, LISTEN_TIME - 0.3, player);
  assert.equal(m.state, MS.LISTEN); assert.ok(Math.hypot(m.x - x0, m.y - y0) < 0.01, 'frozen while listening');
});
test('a new noise while it is listening starts a new chase', () => {
  const m = mk({ seed: 6 }); m.enter(MS.LISTEN, 2);
  assert.ok(m.hear({ id: 9, x: c(9), y: c(3), loudness: 0.6, radius: 180, duration: 0.4 })); assert.equal(m.state, MS.CHASE);
});
test('quiet noise is ignored from far away, loud noise is not', () => {
  const g = grid(), a = mk({ grid: g, x: c(3), seed: 3 }), b = mk({ grid: g, x: c(3), seed: 3 });
  const bus = new SoundBus(); bus.subscribe((e) => { a.hear(e); });
  const bus2 = new SoundBus(); bus2.subscribe((e) => { b.hear(e); });
  bus.emit('walk', c(14), c(3)); bus2.emit('door_slam', c(14), c(3));   // v16: walking is audible out to ~7 tiles now, so test from 11
  assert.equal(a.state, MS.PATROL); assert.equal(b.state, MS.CHASE);
});
test('a hidden player is not caught by touch; an exposed player it bumps into is, even while it only crawls around', () => {
  const m = mk({ seed: 5 });
  run(m, 3, W({ px: c(5) + 6, py: c(3), hidden: true })); assert.ok(!m.contact && m.state !== MS.CHASE);
  const m2 = mk({ seed: 5 }); m2.update(1 / 30, W({ px: c(5) + 6, py: c(3) })); assert.ok(m2.contact && m2.events.includes('catch'));
});
test('monster never teleports: per-tick movement never exceeds chase speed', () => {
  const m = mk({ seed: 6, patrol: [{ x: c(3), y: c(3) }, { x: c(25), y: c(10) }], x: c(5), y: c(5) }), bus = new SoundBus(); bus.subscribe((e) => m.hear(e));
  let px = m.x, py = m.y, worst = 0; const dt = 1 / 30;
  for (let i = 0; i < 30 * 90; i++) { if (i % 40 === 0) bus.emit('run', c(20 + (i % 3)), c(12)); m.update(dt, W({ px: c(20), py: c(12), hidden: true })); worst = Math.max(worst, Math.hypot(m.x - px, m.y - py)); px = m.x; py = m.y; }
  assert.ok(worst <= SPEED.lunge * dt + 1.01, 'worst step ' + worst);
});
test('monster pathfinds through the doorway to a sound on the other side (while the sound continues)', () => {
  const m = mk({ x: c(10), y: c(7), seed: 7, patrol: [] });
  for (let i = 0; i < 30 * 10; i++) { if (i % 10 === 0) m.hear({ id: i, x: c(20), y: c(7), loudness: 1, radius: 420, duration: 0.4 }); m.update(1 / 30, W({ px: c(25), py: c(12), hidden: true })); }
  assert.ok(m.x > c(15), 'crossed the wall line, x=' + m.x);
});

// ---------- companion ----------
test('companion follows, stops when the player stops, and keeps a natural distance', () => {
  const g = grid(), k = new CompanionBrain({ x: c(3), y: c(7), grid: g, rng: seeded(8) });
  let px = c(4); for (let i = 0; i < 30 * 5; i++) { px += 60 / 30; k.update(1 / 30, { px, py: c(7), playerMoving: true }); }
  const d = Math.hypot(px - k.x, 0); assert.ok(d > 30 && d < 200, 'distance ' + d);
  const before = [k.x, k.y];
  for (let i = 0; i < 30 * 5; i++) k.update(1 / 30, { px, py: c(7), playerMoving: false });
  assert.ok(Math.hypot(k.x - before[0], k.y - before[1]) < 60 && Math.hypot(px - k.x, 0) >= 20, 'stopped near player');
});
test('companion walks through a doorway behind the player (navigation)', () => {
  const g = grid(), k = new CompanionBrain({ x: c(10), y: c(7), grid: g, rng: seeded(9) });
  let px = c(12); for (let i = 0; i < 30 * 12; i++) { px = Math.min(c(22), px + 60 / 30); k.update(1 / 30, { px, py: c(8), playerMoving: true }); }
  assert.ok(k.x > c(16), 'followed through the door: ' + k.x);
});
test('companion recovers when stuck', () => {
  const g = grid(), k = new CompanionBrain({ x: c(10), y: c(2), grid: g, rng: seeded(10) });
  g[2][11] = true; g[1][11] = true; g[3][11] = true; // she is boxed in on the right; player is to the right
  const ev = []; for (let i = 0; i < 30 * 20; i++) { k.update(1 / 30, { px: c(14), py: c(2), playerMoving: true }); ev.push(...k.events); }
  assert.ok(Math.hypot(k.x - c(14), k.y - c(2)) < 200, 'ended near player');
});
test('companion dialogue: cooldown, no repeat spam, and never hints she is the monster', () => {
  const t = new CompanionTalk(seeded(11)); assert.ok(t.request('route'));
  assert.equal(t.request('sound'), null);              // cooldown
  t.tick(13); assert.ok(t.request('sound')); t.tick(13); assert.equal(t.request('sound'), null); // single line is not repeated
  const all = Object.values(COMPANION_LINES).flat().join(' ');
  for (const bad of [FINAL_LINES.question, FINAL_LINES.plea]) assert.ok(!all.includes(bad));
  assert.ok(!/ကြောက်စရာ|သရဲ|ပြိုင်ဘက်/.test(all));
});
test('companion startles at a loud nearby sound', () => {
  const g = grid(), k = new CompanionBrain({ x: c(5), y: c(5), grid: g, rng: seeded(12) });
  const bus = new SoundBus(); let line = null; bus.subscribe((e) => { line = k.react(e) || line; });
  bus.emit('door_slam', c(7), c(5)); assert.ok(k.frozen > 0);
});

// ---------- story state ----------
test('map states follow the five canon states', () => {
  const s = new ChapterState(), seen = [];
  for (const f of ['prologue_done', 'transformed', 'power_on', 'has_office_key', 'photo_seen']) { seen.push(s.mapState); s.setFlag(f); }
  assert.deepEqual(seen, [1, 2, 3, 3, 3]);
  for (const f of ['records_found', 'bullies_found']) s.setFlag(f);
  assert.equal(s.chapter, 'ch5'); assert.equal(s.mapState, 4);
  s.setFlag('gate_approach'); assert.equal(s.chapter, 'final'); assert.equal(s.mapState, 5);
});
test('monster hunts only in Ch3-4 (then after the reveal); companion only in Ch5', () => {
  const s = new ChapterState(), act = [];
  const step = (f) => { act.push([s.chapter, s.monsterActive, s.companionActive]); if (f) s.setFlag(f); };
  ['prologue_done', 'transformed', 'power_on', 'has_office_key'].forEach(step);
  step('photo_seen'); s.setFlag('records_found'); s.setFlag('bullies_found'); step();
  const by = Object.fromEntries(act.map((a) => [a[0], a]));
  assert.deepEqual([by.prologue[1], by.ch1[1], by.ch2[1]], [false, false, false]);
  assert.equal(by.ch3[1], true); assert.equal(by.ch4[1], true);
  assert.deepEqual([by.ch5[1], by.ch5[2]], [false, true]);
});
test('harmless scares start in Chapter 1, but the real monster waits until Chapter 3', () => {
  const s = new ChapterState();
  assert.equal(s.hauntingActive, false);
  s.setFlag('prologue_done');
  assert.equal(s.chapter, 'ch1');
  assert.equal(s.hauntingActive, true);
  assert.equal(s.monsterActive, false);
  s.setFlag('transformed');
  s.setFlag('power_on');
  assert.equal(s.chapter, 'ch3');
  assert.equal(s.monsterActive, true);
});
test('final sequence runs in strict order; identity is hidden until transform; no escape, no attack', () => {
  const s = new ChapterState(); for (const f of ['prologue_done', 'transformed', 'power_on', 'has_office_key', 'photo_seen', 'records_found', 'bullies_found', 'reunion', 'gate_approach']) s.setFlag(f);
  assert.equal(s.chapter, 'final'); assert.equal(s.identityRevealed, false);
  assert.throws(() => s.advanceFinal('transform'));
  for (const st of FINAL_STEPS.slice(1)) { s.advanceFinal(st); if (st === 'transform') { assert.ok(s.identityRevealed && s.monsterActive); } else if (FINAL_STEPS.indexOf(st) < 3) assert.ok(!s.identityRevealed); }
  assert.equal(s.canEscape, false); assert.equal(s.canPlayerAttack, false); assert.equal(s.chapter, 'ending');
  assert.equal(ENDING.gameOver, 'GAME OVER');
});
test('state saves and loads', () => {
  const s = new ChapterState(); s.setFlag('prologue_done'); const r = ChapterState.from(JSON.parse(JSON.stringify(s)));
  assert.equal(r.chapter, 'ch1'); assert.ok(r.has('prologue_done'));
});
test('every chapter has Burmese and English titles', () => {
  for (const k of ORDER.slice(0, 7)) assert.ok(CHAPTERS[k]?.my && CHAPTERS[k]?.en, k);
});

// ---------- map graph / puzzles ----------
const ps = () => new PuzzleSystem(new ChapterState());
test('locked doors stay locked until their puzzle is solved', () => {
  const p = ps(); p.state.setFlag('prologue_done'); p.state.setFlag('transformed');
  assert.equal(p.doorState('D2').open, false);
  assert.equal(p.doorState('D4').why, 'locked');
  assert.equal(p.doorState('D3').open, false);
  assert.ok(!p.roomsReachable().has('library'));
});
test('the whole story is solvable from the start, with no softlock, and every room becomes reachable', () => {
  const p = ps(); let progress = true, guard = 0;
  while (progress && guard++ < 50) {
    progress = false;
    const here = p.roomsReachable();
    for (const a of ACTIONS) if (here.has(a.room) && p.canDo(a.id, a.room)) { assert.ok(p.perform(a.id, a.room).ok); progress = true; }
  }
  assert.equal(p.state.chapter, 'final', 'stuck in ' + p.state.chapter + ' flags=' + [...p.state.flags]);
  const all = p.roomsReachable(); for (const r of ROOMS) assert.ok(all.has(r), 'unreachable: ' + r);
  assert.equal(p.done.size, ACTIONS.length);
});
test('final exit route physically links the old classroom back to the gate', () => {
  const p = ps(); const s = p.state;
  for (const f of ['prologue_done', 'transformed', 'power_on', 'has_office_key', 'has_key_10b', 'photo_seen', 'records_found', 'bullies_found', 'reunion']) s.setFlag(f);
  const reach = p.roomsReachable('oldroom'); assert.ok(reach.has('courtyard') && reach.has('gate'));
});
test('doors reference real rooms; monster routes use real rooms and are connected when the school is fully open', () => {
  for (const d of DOORS) assert.ok(ROOMS.includes(d.a) && ROOMS.includes(d.b), d.id);
  for (const [name, route] of Object.entries(MONSTER_ROUTES)) for (const r of route) assert.ok(ROOMS.includes(r), name + ':' + r);
  const adj = (a, b) => DOORS.some((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a));
  for (const route of Object.values(MONSTER_ROUTES)) for (let i = 0; i < route.length; i++) { const a = route[i], b = route[(i + 1) % route.length]; assert.ok(a === b || adj(a, b), `${a}->${b}`); }
});
test('dead ends are only toilets, storage and the gate', () => {
  const deg = Object.fromEntries(ROOMS.map((r) => [r, DOORS.filter((d) => d.a === r || d.b === r).length]));
  const dead = ROOMS.filter((r) => deg[r] === 1).sort();
  assert.deepEqual(dead, ['gate', 'storage', 'toilets']);
});

// ---------- map <-> graph consistency ----------
const MAP_OF = { gate: 'campus', courtyard: 'campus', corridor: 'hall', c10A: 'classroomA', c10B: 'classroomB', library: 'library', office: 'office', toilets: 'toilets', stairs: 'stairs', upper: 'upper', storage: 'storage', oldroom: 'oldroom', service: 'service' };
const links = (id) => buildMap(id).objects.filter((o) => o.type === 'door' || o.type === 'lockeddoor');
test('every door in the room graph exists physically in both maps, with the same locks', () => {
  for (const d of DOORS) {
    const A = MAP_OF[d.a], B = MAP_OF[d.b]; if (A === B) continue;
    const ab = links(A).find((o) => o.target === B), ba = links(B).find((o) => o.target === A);
    assert.ok(ab && ba, `door ${d.id}: ${A}<->${B} missing a side`);
    const lockedSide = [ab, ba].find((o) => o.type === 'lockeddoor');
    const flags = lockedSide ? (lockedSide.needsFlags || []) : [];
    assert.deepEqual([...flags].sort(), [...d.needs].sort(), `door ${d.id} lock flags`);
  }
});
test('every puzzle action in the graph has a matching object in its room map (or is scripted)', () => {
  const SCRIPTED = new Set(['prologue_end', 'enter_night_school', 'gate_approach']);
  for (const a of ACTIONS) {
    if (SCRIPTED.has(a.id)) continue;
    const o = buildMap(MAP_OF[a.room]).objects.find((x) => x.type === 'action' && x.id === a.id);
    assert.ok(o, 'no map object for ' + a.id);
    assert.deepEqual([...(o.needs || [])].sort(), [...a.needs].sort(), a.id + ' needs');
  }
});
test('monster patrol points exist in every map that hosts the monster', () => {
  for (const id of Object.keys(MAP_OF).map((r) => MAP_OF[r])) { const m = buildMap(id); if (id !== 'oldroom' && id !== 'service') assert.ok(m.meta.ghostPatrol?.length >= 2, id + ' has no patrol'); }
});

// ---------- real maps: monster and companion on the actual school geometry ----------
test('on every real map the monster patrols to every patrol point (no stuck, never inside a wall)', () => {
  for (const id of ['campus', 'hall', 'classroomA', 'classroomB', 'library', 'office', 'toilets', 'stairs', 'upper', 'storage']) {
    const m = buildMap(id), g = m.collisionGrid(), pts = (m.meta.ghostPatrol || [[0, 0]]).map(([tx, ty]) => ({ x: tx * TILE + 16, y: ty * TILE + 16 }));
    if (!m.meta.ghostPatrol) continue;
    const mon = new MonsterBrain({ x: pts[0].x, y: pts[0].y, grid: g, patrol: pts, rng: seeded(100 + id.length) });
    const visited = new Set(); const far = { px: -9999, py: -9999, hidden: false, hideTile: null, flashOn: false };
    for (let i = 0; i < 30 * 2400 && visited.size < pts.length; i++) {
      mon.update(1 / 30, far);
      pts.forEach((p, k) => { if (Math.hypot(p.x - mon.x, p.y - mon.y) < 12) visited.add(k); });
      assert.ok(!(g[Math.floor(mon.y / TILE)]?.[Math.floor(mon.x / TILE)]), id + ': inside a wall at ' + [mon.x, mon.y]);
    }
    assert.equal(visited.size, pts.length, id + ': visited ' + visited.size + '/' + pts.length);
  }
});
test('on the real hallway, sneaking (crouch) is not heard from 5 tiles but running is heard from 7 tiles (v16 harder noise)', () => {
  const m = buildMap('hall'), g = m.collisionGrid(), y = 5 * TILE + 16;
  const mk = () => new MonsterBrain({ x: 10 * TILE, y, grid: g, patrol: [{ x: 10 * TILE, y }], rng: seeded(5) });
  const bus = new SoundBus(); let a = mk(), b = mk();
  bus.subscribe((e) => { a.hear(e); }); bus.emit('crouch', 15 * TILE, y); assert.equal(a.state, MS.PATROL);
  const bus2 = new SoundBus(); bus2.subscribe((e) => { b.hear(e); }); bus2.emit('run', 17 * TILE, y); assert.equal(b.state, MS.CHASE);
});
test('companion follows the player down the real hallway and through the courtyard door', () => {
  const m = buildMap('hall'), g = m.collisionGrid(), k = new CompanionBrain({ x: 4 * TILE, y: 5 * TILE, grid: g, rng: seeded(3) });
  let px = 6 * TILE; const y = 5 * TILE; for (let i = 0; i < 30 * 20; i++) { px = Math.min(30 * TILE, px + 70 / 30); k.update(1 / 30, { px, py: y, playerMoving: px < 30 * TILE }); }
  assert.ok(Math.abs(px - k.x) < 130, 'companion within range: ' + (px - k.x));
});

test('optional microphone: quiet room makes no event, loud shout makes a big one', () => {
  assert.equal(levelToEvent(0.01), null); assert.equal(levelToEvent(0.03), null, 'quiet room noise is ignored');
  const talk = levelToEvent(0.16), shout = levelToEvent(0.55);
  assert.ok(talk && shout && shout.radius > talk.radius && shout.loudness > talk.loudness);
  assert.equal(levelToEvent(0.45, 0.12, false), null);
});

// ---------- audio logic ----------
test('mixer applies master and channel volumes', () => {
  const m = new Mixer(); m.set('master', 0.5); m.set('music', 0.4); assert.equal(m.gain('music'), 0.2); assert.throws(() => m.set('bogus', 1));
});
test('footsteps depend on surface, never play when stationary, and running is louder', () => {
  assert.equal(footstepName('tile', 'walk', false), null);
  assert.equal(footstepName('wood', 'walk', true), 'step_walk_wood');
  assert.equal(footstepName('tile', 'run', true), 'step_run_tile');
  assert.equal(footstepName('lava', 'walk', true), 'step_walk_concrete');
  const calls = []; const a = new AudioManager({ oneShot: (n, o) => calls.push([n, o.gain]), setLayer() {} });
  a.footstep('tile', 'walk', true); a.footstep('tile', 'run', true); assert.ok(calls[1][1] > calls[0][1]);
});
test('spatial audio attenuates with distance and pans toward the source', () => {
  const L = { x: 0, y: 0, facing: 0 };
  assert.ok(spatial(L, { x: 50, y: 0 }).gain > spatial(L, { x: 300, y: 0 }).gain);
  assert.equal(spatial(L, { x: 500, y: 0 }).gain, 0);
  assert.ok(spatial(L, { x: 0, y: 100 }).pan > 0.9 && spatial(L, { x: 0, y: -100 }).pan < -0.9);
});
test('horror events respect randomised cooldowns', () => {
  const s = new EventScheduler(seeded(13)); assert.ok(s.tryFire('bell', 0, 20, 40)); assert.ok(!s.tryFire('bell', 10, 20, 40)); assert.ok(s.tryFire('bell', 41, 20, 40));
});
test('adaptive music picks the right state, crossfades, and never leaves more than two layers on', () => {
  const d = new MusicDirector(2);
  const ctx = (o) => ({ chapter: 'ch3', monsterActive: true, monsterState: 'patrol', monsterDist: 999, ...o });
  assert.equal(d.pick(ctx({ chapter: 'prologue', monsterActive: false })), 1);
  assert.equal(d.pick(ctx({ chapter: 'ch2', monsterActive: false })), 2);
  assert.equal(d.pick(ctx({ monsterDist: 100 })), 3);
  assert.equal(d.pick(ctx({ monsterState: 'chase' })), 4);
  assert.equal(d.pick(ctx({ chapter: 'ch5', monsterActive: false })), 5);
  assert.equal(d.pick(ctx({ chapter: 'final' })), 6);
  assert.equal(d.pick(ctx({ chapter: 'ending' })), 7);
  let maxLayers = 0; const seq = [ctx({ chapter: 'ch2', monsterActive: false }), ctx({ monsterDist: 100 }), ctx({ monsterState: 'chase' })];
  for (const c2 of seq) for (let i = 0; i < 90; i++) { const w = d.update(1 / 30, c2); maxLayers = Math.max(maxLayers, Object.keys(w).length); }
  assert.equal(d.target, 4); assert.ok(maxLayers <= 3);
  const mid = new MusicDirector(2); mid.update(0.01, ctx({ chapter: 'prologue', monsterActive: false }));
  const w = mid.update(1, ctx({ chapter: 'ch2', monsterActive: false })); assert.ok(w[1] > 0 && w[2] > 0, 'crossfading');
});

console.log(`\n${n} tests passed`);

// ---------- v33: real-horror behaviour ----------
test('v33 a quiet noise makes it CREEP (slow, no roar); a loud one makes it charge', () => {
  const g = grid(), q = mk({ grid: g, seed: 3 }), l = mk({ grid: g, seed: 3 });
  q.hear({ id: 1, x: c(5) + 20, y: c(3), loudness: 0.2, radius: 100, duration: 0.4 });   // faint footstep, close: perceived below the charge threshold
  assert.equal(q.state, MS.CHASE); assert.ok(q.cautious && q.events.includes('creep') && !q.events.includes('rush'));
  l.hear({ id: 2, x: c(9), y: c(3), loudness: 0.8, radius: 260, duration: 0.5 });
  assert.ok(!l.cautious && l.events.includes('rush'));
  q.hear({ id: 3, x: c(7), y: c(3), loudness: 0.9, radius: 400, duration: 1 });          // a loud noise while creeping -> snaps into a charge
  assert.ok(!q.cautious && q.events.includes('rush'));
});
test('v33 it bursts forward (lunge) when a loud noise is close, and the burst is still slower than a sprint', () => {
  const m = mk({ seed: 8, x: c(3) }); m.hear({ id: 1, x: c(12), y: c(3), loudness: 0.9, radius: 400, duration: 2 });
  let lunged = false, top = 0, px = m.x; for (let i = 0; i < 30 * 4; i++) { m.update(1 / 30, W({ px: c(12), py: c(3), hidden: true })); if (m.events.includes('lunge')) lunged = true; top = Math.max(top, Math.abs(m.x - px) * 30); px = m.x; }
  assert.ok(lunged, 'lunge event'); assert.ok(top > SPEED.chase && top <= SPEED.lunge + 1, 'top speed ' + top); assert.ok(SPEED.lunge < 165);
});
test('v33 after losing the noise it SEARCHES around the spot (sniffing) instead of leaving at once', () => {
  const m = mk({ seed: 4, x: c(5), patrol: [{ x: c(3), y: c(3) }, { x: c(8), y: c(10) }] }); m.hear({ id: 1, x: c(12), y: c(3), loudness: 0.9, radius: 400, duration: 0.5 });
  const ev = new Set(); let inSearch = 0; const pl = W({ px: c(5), py: c(12), hidden: true });
  for (let i = 0; i < 30 * 40; i++) { m.update(1 / 30, pl); m.events.forEach((e) => ev.add(e)); if (m.state === MS.SEARCH) inSearch += 1 / 30; }
  assert.ok(ev.has('search') && ev.has('sniff') && ev.has('search_end'), [...ev].join());
  assert.ok(inSearch > 4 && inSearch <= SEARCH_TIME + 5 + 0.5, 'searched for ' + inSearch);
});
test('v33 it sniffs right beside a hiding spot (tension event) but a hidden player is still never caught', () => {
  const m = mk({ seed: 9 }); m.enter(MS.SEARCH); m.searchT = 6; m.searchPts = []; m.searchWait = 6; m.sniffT = 1;
  let close = false, caught = false; for (let i = 0; i < 30 * 5; i++) { m.update(1 / 30, W({ px: c(5) + 20, py: c(3), hidden: true })); if (m.events.includes('sniff_close')) close = true; if (m.contact) caught = true; }
  assert.ok(close && !caught);
});
test('v33 aggro: each chase makes it sharper (remembers noise longer), and it calms down with time', () => {
  const m = mk({ seed: 2 }); const a0 = m.aggro;
  m.hear({ id: 1, x: c(9), y: c(3), loudness: 0.9, radius: 300, duration: 0.3 }); for (let i = 0; i < 30 * 6 && m.state === MS.CHASE; i++) m.update(1 / 30, W({ px: c(5), py: c(12), hidden: true }));
  assert.ok(m.aggro > a0, 'aggro ' + m.aggro); const hi = m.aggro; for (let i = 0; i < 30 * 30; i++) m.update(1 / 30, W({ px: c(5), py: c(12), hidden: true })); assert.ok(m.aggro < hi);
});
test('v33 prowl: it often patrols toward the spot nearest the player', () => {
  const pts = [{ x: c(3), y: c(3) }, { x: c(25), y: c(3) }, { x: c(3), y: c(12) }]; let near = 0;
  for (let s = 1; s <= 10; s++) { const m = mk({ seed: s, x: c(3), y: c(3), patrol: pts }); m.patrolIdx = 0; m.timer = 0; m.listenCooldown = 999;
    const pl = W({ px: c(25), py: c(4) }); for (let i = 0; i < 30 * 60 && !m.events.includes('prowl'); i++) m.update(1 / 30, pl); if (m.patrolIdx === 1 || m.events.includes('prowl')) near++; }
  assert.ok(near >= 3, 'prowled ' + near + '/10');
});
