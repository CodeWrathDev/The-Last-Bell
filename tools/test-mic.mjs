// Microphone logic test (no browser): a fake microphone feeds MicInput; checks calibration, room noise, sensitivity, clicks and permission errors.
// Run: node tools/test-mic.mjs
import assert from 'node:assert/strict';
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
let LEVEL = 0, ctxState = 'running', denyWith = null;
class FakeAnalyser { constructor() { this.fftSize = 1024; } connect() {} getFloatTimeDomainData(b) { for (let i = 0; i < b.length; i++) b[i] = LEVEL * Math.SQRT2 * Math.sin(i * 0.37); } }
class FakeCtx { constructor() { this.state = ctxState; this.destination = {}; } createMediaStreamSource() { return { connect() {} }; } createAnalyser() { return new FakeAnalyser(); } createGain() { return { gain: {}, connect() {} }; } resume() { this.state = 'running'; return Promise.resolve(); } close() {} }
globalThis.window = { AudioContext: FakeCtx, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async () => { if (denyWith) { const e = new Error('x'); e.name = denyWith; throw e; } return { getTracks: () => [{ stop() {} }] }; } } }, configurable: true });
const { MicInput, MIC_THRESHOLD, MIC_FULL_SCALE } = await import('../src/systems/MicInput.js');
const { Settings } = await import('../src/systems/Settings.js');
const { SoundBus } = await import('../src/systems/SoundBus.js');

let n = 0; const test = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };
const make = async (sens = 2) => { Settings.set('microphone', true); Settings.set('micSens', sens); const bus = new SoundBus(), ev = []; bus.subscribe((e) => ev.push(e)); const m = new MicInput(bus, () => ({ x: 0, y: 0 })); LEVEL = 0.01; assert.equal(await m.start(), true); return { m, ev, bus }; };
const run = (m, sec, lvl, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) { LEVEL = typeof lvl === 'function' ? lvl(t) : lvl; m.update(dt); } };

await test('starts in CALIBRATING, then LISTENING; the bar level stays near zero in a quiet room', async () => {
  const { m, ev } = await make(); assert.equal(m.status, 'calibrating'); run(m, 2, 0.01); assert.equal(m.status, 'listening');
  run(m, 60, 0.01); assert.ok(m.level < 0.01, 'bar at rest: ' + m.level); assert.equal(ev.length, 0);
});
await test('a noisy room (fan / traffic, steady 0.03) never makes the monster hear you, even at 5x sensitivity', async () => {
  for (const sens of [1, 2, 5]) { const { m, ev } = await make(sens); run(m, 120, 0.03); assert.equal(ev.length, 0, 'sens ' + sens + ' events ' + ev.length); }
});
await test('room noise that slowly changes (0.01 -> 0.05) does not trigger either', async () => {
  const { m, ev } = await make(2); run(m, 2, 0.01); run(m, 90, (t) => 0.01 + 0.04 * Math.min(1, t / 90)); assert.equal(ev.length, 0);
});
await test('talking (0.12) fills the bar and makes a voice noise; stopping makes the bar fall', async () => {
  const { m, ev } = await make(2); run(m, 2, 0.01); run(m, 1.5, 0.12);
  assert.ok(m.level / MIC_FULL_SCALE > 0.6, 'bar fill ' + m.level / MIC_FULL_SCALE); assert.ok(ev.length >= 1 && ev.every((e) => e.type === 'voice'));
  run(m, 2, 0.01); assert.ok(m.level < 0.02);
});
await test('a single click / cough spike (60 ms) is ignored', async () => {
  const { m, ev } = await make(2); run(m, 2, 0.01); run(m, 0.06, 0.4); run(m, 2, 0.01); assert.equal(ev.length, 0);
});
await test('nothing is heard during the first second of calibration', async () => {
  const { m, ev } = await make(2); run(m, 1.0, 0.3); assert.equal(ev.length, 0);
});
await test('sensitivity works: a soft voice (0.05) counts at 4x but not at 0.5x', async () => {
  const lo = await make(0.5); run(lo.m, 2, 0.01); run(lo.m, 2, 0.05); assert.equal(lo.ev.length, 0);
  const hi = await make(4); run(hi.m, 2, 0.01); run(hi.m, 2, 0.05); assert.ok(hi.ev.length >= 1);
  assert.ok(hi.m.level > lo.m.level * 3);
});
await test('no events while paused / in a cutscene (canEmit = false), but the bar still moves', async () => {
  const { m, ev } = await make(2); run(m, 2, 0.01); for (let i = 0; i < 60; i++) { LEVEL = 0.2; m.update(1 / 30, false); } assert.equal(ev.length, 0); assert.ok(m.level > MIC_THRESHOLD);
});
await test('a suspended AudioContext (no tap yet) does not calibrate on silence and recovers', async () => {
  ctxState = 'suspended'; const { m } = await make(2); ctxState = 'running';
  m.ctx.state = 'suspended'; m.ctx.resume = () => new Promise(() => {}); run(m, 3, 0.01); assert.equal(m.status, 'calibrating');
  m.ctx.state = 'running'; run(m, 2, 0.01); assert.equal(m.status, 'listening');
});
await test('permission denied / no microphone / not secure give a readable status (not a dead bar)', async () => {
  Settings.set('microphone', true);
  for (const [name, want] of [['NotAllowedError', 'denied'], ['NotFoundError', 'nomic'], ['SomethingElse', 'error']]) { denyWith = name; const m = new MicInput(new SoundBus(), () => ({ x: 0, y: 0 })); assert.equal(await m.start(), false); assert.equal(m.status, want); }
  denyWith = null; const nav = globalThis.navigator.mediaDevices; Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  const m2 = new MicInput(new SoundBus(), () => ({ x: 0, y: 0 })); assert.equal(await m2.start(), false); assert.equal(m2.status, 'insecure');
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: nav }, configurable: true });
});
await test('stop() resets everything', async () => { const { m } = await make(2); m.stop(); assert.equal(m.active, false); assert.equal(m.status, 'off'); assert.equal(m.level, 0); });
await test('HUD volume meter moves with EVERY sound (even quiet ones) and the trigger line moves with the sensitivity', async () => {
  const { m } = await make(1); run(m, 2, 0.002); const quiet = m.shown; run(m, 0.5, 0.02); const soft = m.shown; run(m, 0.5, 0.15); const loud = m.shown;
  assert.ok(quiet < soft && soft < loud, [quiet, soft, loud].join(' < ')); assert.ok(loud - quiet > 0.4, 'bar travels visibly: ' + (loud - quiet));
  const t1 = m.trig; Settings.set('micSens', 4); run(m, 0.1, 0.002); assert.ok(m.trig < t1, 'higher sensitivity moves the line down');
});
console.log('\n' + n + ' mic tests passed');
